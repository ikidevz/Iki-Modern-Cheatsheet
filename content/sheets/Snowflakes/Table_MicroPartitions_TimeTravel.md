# 🔺 Table Internals: Micro-Partitions, Clustering, Time Travel, Streams, Cloning

> Storage-layer internals every senior DE needs for schema design, cost control, and CDC pipelines.

---

## 1. Micro-Partitions — the atomic storage unit

- Immutable, columnar, compressed blocks, **50–500MB uncompressed** each
- Created automatically on every write (`INSERT`, `COPY INTO`, `MERGE`, `UPDATE`)
- Snowflake stores **metadata per partition, per column**: min, max, distinct count, null count → drives pruning
- Data is **never updated in place** — any DML rewrites affected micro-partitions and creates new ones (old ones retained for Time Travel/Fail-safe)
- Compression is columnar and automatic — Snowflake picks the encoding per column (dictionary, RLE, delta) without any user configuration

```sql
-- Table storage metrics
SELECT
    table_name,
    active_bytes / POWER(1024,3) AS active_gb,
    time_travel_bytes / POWER(1024,3) AS time_travel_gb,
    failsafe_bytes / POWER(1024,3) AS failsafe_gb,
    retention_time
FROM snowflake.account_usage.table_storage_metrics
WHERE table_name = 'ORDERS';

-- Partition count & pruning health
SELECT SYSTEM$CLUSTERING_INFORMATION('orders', '(order_date)');
```

### 1.1 Why immutability matters operationally

Because micro-partitions are never mutated, every `UPDATE`/`DELETE`/`MERGE` is really a **read + rewrite** of the affected partitions:

```sql
-- An UPDATE touching 5% of rows scattered across a badly-clustered 10M-row table
-- can force a rewrite of nearly ALL micro-partitions if those 5% are spread evenly —
-- this is the hidden cost of "small" updates on unclustered wide tables.
UPDATE orders SET status = 'archived' WHERE order_date < '2020-01-01';

-- Check how many partitions a DML actually touched (via Query Profile "Partitions written")
SELECT query_id, query_text
FROM table(information_schema.query_history())
WHERE query_text ILIKE '%UPDATE orders%'
ORDER BY start_time DESC LIMIT 5;
```

This is precisely why clustering keys matter for DML-heavy tables, not just read-heavy ones — a good clustering key keeps updates physically localized to fewer partitions.

---

## 2. Table Types (a decision every DE makes at CREATE time)

| Type | Time Travel | Fail-safe | Use for |
|---|---|---|---|
| **Permanent** (default) | Up to 90 days (Enterprise+) | 7 days | Production tables |
| **Transient** | Up to 1 day | None | Staging/ETL intermediate tables — saves storage cost, no fail-safe |
| **Temporary** | Session-scoped only | None | Scratch tables inside a single session/script |

```sql
CREATE TRANSIENT TABLE staging_orders (...);   -- no fail-safe cost, ideal for pipeline intermediates
CREATE TEMPORARY TABLE scratch_calc (...);     -- auto-dropped at session end

-- Convert an existing table's type is NOT possible in-place — must recreate
CREATE TRANSIENT TABLE staging_orders_v2 CLONE staging_orders;
DROP TABLE staging_orders;
ALTER TABLE staging_orders_v2 RENAME TO staging_orders;
```

> 🔑 **Cost lever most teams miss:** every intermediate/staging table in an ETL pipeline defaulting to `PERMANENT` silently accrues 7 days of Fail-safe storage cost on data nobody will ever need to recover. Switching high-churn staging tables to `TRANSIENT` is one of the easiest storage cost wins available.

---

## 3. Clustering Keys (Snowflake's answer to Z-ordering)

- Define the **physical co-location** of rows across micro-partitions
- Snowflake auto-clusters on natural ingestion order by default (usually load order) — explicit clustering keys are for tables that are:
  - Large (multi-TB+)
  - Frequently filtered/joined on a specific column that ISN'T the natural load order
  - Suffering from re-clustering after heavy DML (updates/deletes reshuffle order)

```sql
-- Define a clustering key
ALTER TABLE orders CLUSTER BY (order_date);

-- Composite clustering key (order matters — most selective / most-filtered first)
ALTER TABLE events CLUSTER BY (customer_id, event_date);

-- Expression-based clustering key (useful when queries always filter on a derived value)
ALTER TABLE events CLUSTER BY (TO_DATE(event_timestamp));

-- Check clustering depth/quality (lower avg_depth = better)
SELECT SYSTEM$CLUSTERING_INFORMATION('orders');

-- Drop a clustering key (stop paying for auto-reclustering credits)
ALTER TABLE orders DROP CLUSTERING KEY;

-- Manual reclustering is automatic & background — you cannot force it synchronously,
-- but you CAN monitor the credits it's consuming:
SELECT *
FROM snowflake.account_usage.automatic_clustering_history
WHERE table_name = 'ORDERS'
ORDER BY start_time DESC;
```

> ⚠️ **Cost gotcha:** Automatic reclustering runs as a background *serverless* service and bills separately from your warehouse credits. A poorly chosen clustering key on a high-churn table can silently burn serverless credits 24/7. Always check `automatic_clustering_history` if a bill spikes unexpectedly.

### 3.1 Choosing a clustering key — a practical framework

1. **Only cluster tables above ~1TB.** Below that, pruning gains rarely outweigh reclustering cost.
2. **Pick the column(s) most frequently used in `WHERE`/`JOIN` predicates**, not the ones used in `GROUP BY` — clustering helps scan pruning, not aggregation.
3. **Prefer low-to-medium cardinality, naturally ordered columns** (dates, sequential IDs) over high-cardinality random columns (UUIDs) — random values don't co-locate well regardless of clustering.
4. **Re-evaluate after major query pattern shifts.** A clustering key chosen for last year's dashboard may actively hurt this year's different filter pattern.

```sql
-- A/B test: measure pruning before and after changing the clustering key
SELECT SYSTEM$CLUSTERING_INFORMATION('orders', '(order_date)');
ALTER TABLE orders CLUSTER BY (customer_region, order_date);
-- wait for background reclustering to catch up, then re-check:
SELECT SYSTEM$CLUSTERING_INFORMATION('orders', '(customer_region, order_date)');
```

---

## 4. Time Travel

Query, clone, or restore data **as of a past point in time** — no backups needed for most recovery scenarios.

| Edition | Default retention | Max retention |
|---|---|---|
| Standard | 1 day | 1 day |
| Enterprise+ | 1 day | 90 days (permanent tables only) |

```sql
-- Set retention at table creation
CREATE TABLE orders (...) DATA_RETENTION_TIME_IN_DAYS = 30;

-- Change retention on existing table
ALTER TABLE orders SET DATA_RETENTION_TIME_IN_DAYS = 7;

-- Query as of a timestamp
SELECT * FROM orders AT(TIMESTAMP => '2026-09-01 00:00:00'::timestamp);

-- Query as of N minutes/hours ago (relative offset, in seconds — negative)
SELECT * FROM orders AT(OFFSET => -3600);   -- 1 hour ago

-- Query as of a specific query ID (before that query ran)
SELECT * FROM orders BEFORE(STATEMENT => '<query_id>');

-- Restore an accidentally dropped table (huge time-saver, no restore-from-backup needed)
UNDROP TABLE orders;
UNDROP SCHEMA my_schema;
UNDROP DATABASE my_database;

-- Restore data from an accidental bad UPDATE/DELETE without a full table restore
CREATE OR REPLACE TABLE orders_fixed AS
SELECT * FROM orders AT(OFFSET => -600);   -- 10 min before the bad job ran

-- See what queries ran against a table recently (to find the "before" point)
SELECT query_id, query_text, start_time
FROM table(information_schema.query_history())
WHERE query_text ILIKE '%orders%'
ORDER BY start_time DESC;
```

### 4.1 Time Travel storage cost mechanics

Time Travel isn't a copy — it's **retained old micro-partitions that would otherwise be deleted**. The storage cost is the delta between active data and what's retained:

```sql
-- Find tables where Time Travel storage dwarfs active storage (usually high-churn tables
-- with an unnecessarily long retention period)
SELECT
    table_name,
    active_bytes / POWER(1024,3) AS active_gb,
    time_travel_bytes / POWER(1024,3) AS tt_gb,
    ROUND(time_travel_bytes / NULLIF(active_bytes, 0), 2) AS tt_ratio
FROM snowflake.account_usage.table_storage_metrics
ORDER BY time_travel_bytes DESC
LIMIT 20;
```

> 🔑 **Fail-safe (distinct from Time Travel):** an additional 7-day period *after* Time Travel expires, Snowflake-managed only, not queryable by users — requires opening a support case. Budget for it in storage cost estimates; it's not optional and not user-configurable for permanent tables.

---

## 5. Streams (native CDC)

A Stream tracks **row-level changes** (inserts/updates/deletes) on a table since the last time it was consumed — the backbone of incremental pipelines.

```sql
-- Create a stream on a table
CREATE STREAM orders_stream ON TABLE orders;

-- Standard stream (default) shows net changes; APPEND_ONLY only shows inserts (cheaper, faster)
CREATE STREAM orders_stream_appendonly ON TABLE orders APPEND_ONLY = TRUE;

-- INSERT_ONLY stream on external tables/views (specific variant for that use case)
CREATE STREAM ext_stream ON EXTERNAL TABLE ext_orders INSERT_ONLY = TRUE;

-- What a stream query looks like — includes metadata columns
SELECT
    *,
    metadata$action,      -- 'INSERT' or 'DELETE'
    metadata$isupdate,    -- TRUE if part of an UPDATE (shows as paired DELETE+INSERT)
    metadata$row_id
FROM orders_stream;

-- Consuming a stream (this ADVANCES the offset — only in a DML statement, e.g. inside a task/MERGE)
INSERT INTO orders_history
SELECT * FROM orders_stream WHERE metadata$action = 'INSERT';

-- Check if a stream has stale/pending data before it goes stale (streams can invalidate!)
SELECT SYSTEM$STREAM_HAS_DATA('orders_stream');

-- CRITICAL: a stream becomes STALE if unconsumed longer than the base table's
-- retention period — always pair with a Task on a schedule tighter than retention
SHOW STREAMS LIKE 'orders_stream';   -- check the "stale" column
```

### 5.1 Handling UPDATEs correctly in a stream-fed MERGE

A common bug: naively treating every stream row as an insert, when `UPDATE`s appear as a paired `DELETE` + `INSERT` row:

```sql
MERGE INTO curated.orders t
USING (
    SELECT * FROM orders_stream
    QUALIFY ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY metadata$action DESC) = 1
    -- dedupe: if both a DELETE and INSERT exist for the same key (an UPDATE), keep the INSERT
) s
ON t.order_id = s.order_id
WHEN MATCHED AND s.metadata$action = 'DELETE' AND NOT s.metadata$isupdate THEN DELETE
WHEN MATCHED THEN UPDATE SET t.status = s.status, t.amount = s.amount
WHEN NOT MATCHED AND s.metadata$action = 'INSERT' THEN INSERT (order_id, status, amount)
    VALUES (s.order_id, s.status, s.amount);
```

> ⚠️ **Common failure mode:** stream sits unconsumed over a long weekend, base table's retention period passes, stream goes **stale and unusable** — you lose the CDC history and must fall back to a full reload. Always monitor stream staleness alongside Task schedules (see `Ingestion_CDC_Orchestration.md`).

### 5.2 Streams on Views

```sql
-- Streams can track changes through a view, not just a base table (useful for
-- exposing CDC on a filtered/joined logical dataset)
CREATE STREAM active_orders_stream ON VIEW active_orders_view;
```

---

## 6. Zero-Copy Cloning

Instant, metadata-only copy of a table/schema/database — no data duplication until diverged.

```sql
-- Clone a table (instant, no storage cost until rows change)
CREATE TABLE orders_dev CLONE orders;

-- Clone at a point in time (combine with Time Travel!)
CREATE TABLE orders_backup CLONE orders AT(OFFSET => -3600);

-- Clone an entire schema or database (great for spinning up dev/QA environments)
CREATE SCHEMA dev_schema CLONE prod_schema;
CREATE DATABASE dev_db CLONE prod_db;

-- Clones are independent after creation — DML on the clone does NOT affect the source
-- Storage cost only accrues on the DELTA between clone and source over time
```

> 🔑 **Common senior-DE use case:** spin up a full production-scale dev/QA database via `CLONE` in seconds, run destructive tests, then `DROP DATABASE` — costs almost nothing because no data was physically copied.

### 6.1 What does NOT come along with a clone

- **Grants are not cloned by default** — the clone inherits the creating role's ownership, not the source's grant structure. Use `COPY GRANTS` to preserve them:

```sql
CREATE TABLE orders_dev CLONE orders COPY GRANTS;
```

- **Tasks are cloned in a SUSPENDED state** regardless of the source's state — you must explicitly resume them, preventing an accidental duplicate pipeline from silently running against a dev clone
- **Pipes are cloned but do not carry over the auto-ingest notification wiring** — the cloud provider event source still points at the original pipe

---

## 7. Constraints (mostly informational, not enforced)

```sql
-- Snowflake does NOT enforce PK/FK/UNIQUE by default (used for optimizer hints + documentation/lineage only)
CREATE TABLE orders (
    order_id INT PRIMARY KEY,
    customer_id INT REFERENCES customers(customer_id)
);

-- The ONE constraint that IS enforced:
CREATE TABLE customers (
    customer_id INT NOT NULL,   -- NOT NULL is fully enforced
    email STRING
);

-- RELY hint tells the optimizer it CAN trust this constraint for join elimination/optimization
-- (only use this if you are 100% sure the data is actually clean — it's a promise, not a check)
ALTER TABLE orders ADD CONSTRAINT fk_customer
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) RELY;
```

> ⚠️ **Gotcha for anyone coming from a traditional RDBMS:** PK/FK/UNIQUE constraints are **not validated** unless declared `RELY` for query optimization hints — they will NOT stop you from inserting duplicate "primary keys." Data quality enforcement has to happen in your pipeline logic (dbt tests, `MERGE` logic, etc.), not the DDL.

---

## 8. Semi-Structured Data (VARIANT, OBJECT, ARRAY)

Snowflake treats JSON/Avro/Parquet-sourced semi-structured data as a first-class column type, not a bolted-on feature.

```sql
CREATE TABLE events (
    event_id INT,
    payload VARIANT   -- stores arbitrary JSON, still gets columnar compression under the hood
);

COPY INTO events FROM @my_stage/events/ FILE_FORMAT = (TYPE = 'JSON');

-- Querying nested JSON with colon/dot notation
SELECT
    payload:user_id::INT AS user_id,
    payload:metadata:device_type::STRING AS device_type
FROM events;

-- FLATTEN — the semi-structured equivalent of explode()
SELECT
    e.event_id,
    f.value:item_name::STRING AS item_name
FROM events e,
     LATERAL FLATTEN(input => e.payload:items) f;

-- Automatic columnarization: Snowflake analyzes VARIANT columns and stores frequently-accessed
-- paths in a columnar sub-structure internally (no user action needed) — this is why
-- VARIANT queries on well-structured JSON perform close to native column performance
```

> 🔑 **Design tip:** for JSON with a stable, known schema, extracting frequently-queried fields into real typed columns (via a view or a transformation step) still outperforms querying `VARIANT` paths directly for hot-path BI queries — VARIANT is great for flexibility and landing-zone/raw layers, less ideal as the final serving layer for high-QPS dashboards.

---

## 9. Sequences & Auto-Increment Patterns

```sql
CREATE SEQUENCE order_id_seq START = 1 INCREMENT = 1;

INSERT INTO orders (order_id, customer_id)
VALUES (order_id_seq.NEXTVAL, 501);

-- Or as a column default
CREATE TABLE orders (
    order_id INT DEFAULT order_id_seq.NEXTVAL,
    customer_id INT
);

-- IDENTITY columns (simpler syntax, same underlying mechanism)
CREATE TABLE orders (
    order_id INT IDENTITY(1,1),
    customer_id INT
);
```

> Note: Snowflake does not guarantee gap-free or strictly sequential sequence values across concurrent sessions (each node may pre-allocate a range) — treat sequence values as unique, not as a dense audit trail.

---

## 10. External Tables & Iceberg Tables (brief cross-reference)

Covered in depth in `Ingestion_CDC_Orchestration.md`, but the storage-internals-relevant point here: external tables store **metadata only** in Snowflake (file location, inferred schema) — the actual bytes remain in your cloud storage, unmanaged by Snowflake's micro-partition/clustering/Time-Travel machinery. Iceberg tables are a middle ground: Snowflake can read/write native Iceberg format files while another engine (Spark, Trino) reads the same files.

---

## 11. Quick Reference: Databricks/Delta ↔ Snowflake

| Delta Lake concept | Snowflake equivalent |
|---|---|
| `DESCRIBE HISTORY` | Time Travel + `QUERY_HISTORY` |
| `VERSION AS OF` / `TIMESTAMP AS OF` | `AT(OFFSET =>)` / `AT(TIMESTAMP =>)` |
| `RESTORE TABLE` | `CREATE TABLE ... CLONE ... AT(...)` |
| Change Data Feed (CDF) | Streams |
| `VACUUM` | Not needed — Time Travel/Fail-safe expiry handles it automatically |
| Z-ORDER BY | `CLUSTER BY` |
| `OPTIMIZE` (compaction) | Automatic micro-partitioning + auto-reclustering (no manual trigger) |
| Deep/Shallow clone | Zero-copy `CLONE` (closer to shallow, but fully independent post-clone) |
| Delta constraints (`CHECK`) | `NOT NULL` enforced; others informational (`RELY`) only |
| Struct/Map/Array columns | `VARIANT` / `OBJECT` / `ARRAY` |
| `explode()` | `LATERAL FLATTEN()` |

---

## 12. Interview / Self-Check Q&A

**Q: Why doesn't Snowflake need a `VACUUM` command?**
A: Old micro-partitions are automatically reclaimed once they age out of both Time Travel and Fail-safe retention — there's no manual compaction/cleanup step exposed to users.

**Q: A table has a clustering key defined but `SYSTEM$CLUSTERING_INFORMATION` shows a high average depth. What's wrong?**
A: Either reclustering hasn't caught up yet (it's a background, gradual serverless process, not instant), or the clustering key doesn't match the actual filter pattern of your queries.

**Q: You `UNDROP` a table — where did that data actually come from?**
A: Time Travel retention — the table's micro-partitions were flagged for deletion but retained within the retention window; `UNDROP` simply un-flags them.

**Q: Why would a stream go stale, and what's the fix once it has?**
A: The base table's Time Travel retention period elapsed before the stream was consumed, so the changes it was tracking were physically purged. There's no fix for the lost history — you must recreate the stream and, if needed, reconcile via a full reload.

**Q: Should you set every table's Time Travel retention to the max 90 days "to be safe"?**
A: No — it directly multiplies storage cost for high-churn tables. Reserve long retention for tables where accidental data loss is genuinely costly (core fact tables), and use short/no retention (transient tables) for staging/intermediate data.
