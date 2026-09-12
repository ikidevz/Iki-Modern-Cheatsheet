# ⚙️ Snowflake Architecture & Runtime

> How Snowflake actually executes a query, under the hood. Read this alongside `Warehouse_Compute_Management.md` (compute scaling) and `Table_MicroPartitions_TimeTravel.md` (storage internals) — this file is the connective tissue between them.

---

## 1. The Three-Layer Architecture

Snowflake's core design principle: **storage, compute, and services are physically separate and scale independently.**

| Layer | What it does | Scales via | Billed as |
|---|---|---|---|
| **Storage** | Durable, compressed, columnar data in cloud object storage (S3/Azure Blob/GCS) | Automatic, unlimited | Storage ($/TB/month) |
| **Compute** | Virtual Warehouses (VWs) — MPP clusters that execute queries | Manual/auto resize, multi-cluster | Credits (per-second, 60s min) |
| **Cloud Services** | Metadata, query parsing/optimization, security, transactions, result cache | Managed by Snowflake, not user-provisioned | Free unless >10% of daily compute credits |

**Why this matters as a DE:** you can spin up 5 warehouses of different sizes hitting the *same* table concurrently with zero contention, because none of them own the data — they all read from the same immutable micro-partitions in storage. This is the #1 conceptual difference from a traditional MPP DB (or from Spark-on-Databricks, where compute and the Spark driver/executors are far more tightly coupled to the job).

### 1.1 Why this architecture exists (the "so what")

Traditional shared-nothing MPP warehouses (Teradata, older Redshift) tie storage to specific compute nodes — resizing compute means physically redistributing data across nodes, which is slow and disruptive. Snowflake's decoupling means:

- Resizing a warehouse is a **metadata operation** (provision new nodes, point them at the same storage) — takes seconds, not hours
- You never "run out of disk" on a compute node — storage is theoretically unlimited object storage
- Multiple independent teams can have dedicated compute without duplicating data
- Compute can be fully OFF (zero cost) while storage persists indefinitely

### 1.2 Physical deployment model

Under the hood, each cloud provider deployment (AWS/Azure/GCP) runs in a specific region, and an "account" lives in exactly one region unless you set up **cross-region replication** or a multi-region organization. This matters for:
- Data residency/compliance requirements (GDPR — data must stay in EU region)
- Latency (compute should generally live in the same region as consumers)
- Disaster recovery (replication is a deliberate, separate feature — not automatic across regions)

```sql
-- Check which region/cloud your account lives in
SELECT CURRENT_REGION();
SELECT SYSTEM$ALLOWLIST();   -- IP ranges/hostnames for network configuration
```

---

## 2. Cloud Services Layer (the part people forget exists)

This layer runs constantly, is fully managed, and is doing more work than most engineers realize:

- **Query parsing & optimization** — cost-based optimizer builds the execution plan *before* any warehouse touches data
- **Metadata management** — table stats, micro-partition min/max values, row counts (this is what makes some queries return instantly with **zero compute**)
- **Security & access control** — RBAC evaluation, masking policy evaluation, row access policy evaluation
- **Transaction manager** — MVCC, ensures ACID across concurrent writers
- **Infrastructure manager** — provisions/deprovisions warehouse compute nodes
- **Authentication & session management** — SSO/OAuth token validation, MFA enforcement, session timeouts
- **Query result caching** — the 24-hour result cache lives here, not in any warehouse

> 🔑 **Interview-favorite fact:** `SELECT COUNT(*) FROM table` or `SELECT MIN(col) FROM table` (on a column with cached stats) can return with **"Bytes scanned: 0"** and **zero warehouse credits burned** — the cloud services layer answers purely from metadata. Check this in Query Profile.

```sql
-- Prove it to yourself: run this, then check Query Profile → "Partitions scanned: 0"
SELECT COUNT(*) FROM snowflake_sample_data.tpch_sf1.orders;

-- Check how much of your daily compute is actually cloud services overhead
-- (billed only once you cross 10% of daily compute credits)
SELECT
    date_trunc('day', start_time) AS day,
    SUM(credits_used_cloud_services) AS cloud_services_credits,
    SUM(credits_used_compute) AS compute_credits,
    ROUND(SUM(credits_used_cloud_services) / NULLIF(SUM(credits_used_compute), 0) * 100, 2) AS pct_overhead
FROM snowflake.account_usage.metering_daily_history
GROUP BY 1
ORDER BY 1 DESC;
```

### 2.1 What actually triggers cloud services billing

Cloud services credits are only billed on the portion that exceeds 10% of that day's compute credit consumption. Heavy contributors to cloud services load:

- Complex query compilation (deeply nested views, huge `IN` lists, many CTEs)
- Frequent small metadata-only queries (thousands of tiny `SHOW`/`DESCRIBE` calls from a poorly-written orchestration script)
- Access control evaluation on tables with many masking/row-access policies stacked
- `INFORMATION_SCHEMA` table function calls at high frequency

---

## 3. Query Lifecycle (what happens when you hit run)

```
1. Client sends SQL → Cloud Services
2. Parse → Bind → Rewrite (views/CTEs inlined, predicates pushed)
3. Cost-based Optimizer generates plan
      ↳ checks RESULT CACHE first (24hr TTL, exact query match) — if hit, return immediately, 0 credits
4. Plan dispatched to the target Virtual Warehouse
5. Warehouse checks LOCAL DISK CACHE (SSD cache of previously scanned micro-partitions)
6. Prune micro-partitions using metadata (min/max, partition elimination)
7. Scan remaining micro-partitions from remote storage → execute (filter/join/agg)
8. Result written to Result Cache + returned to client
```

```sql
-- Disable result cache to force a fresh execution (useful for benchmarking)
ALTER SESSION SET USE_CACHED_RESULT = FALSE;

-- Confirm whether a query hit result cache
SELECT
    query_id,
    query_text,
    warehouse_name,
    execution_status,
    total_elapsed_time,
    bytes_scanned,
    percentage_scanned_from_cache   -- 100 = fully served from result cache
FROM table(information_schema.query_history())
ORDER BY start_time DESC
LIMIT 20;
```

### 3.1 The Optimizer, step by step

1. **Parsing** — syntax validation, builds an abstract syntax tree
2. **Binding** — resolves object names against the metadata store (this is where "table does not exist or not authorized" errors surface)
3. **Rewrite** — inlines views/CTEs, pushes predicates down through joins where semantically valid, eliminates dead branches (e.g., `WHERE 1=0`)
4. **Statistics-based costing** — uses micro-partition metadata (row counts, distinct counts, min/max) to estimate the cost of alternative join orders and strategies
5. **Plan generation** — chooses join algorithms (hash join is the default/common case), join order, and whether to broadcast small dimension tables
6. **Compilation to bytecode** — plan is compiled into an executable form dispatched to warehouse nodes

### 3.2 Session vs Statement vs Object parameters

Snowflake parameters exist at multiple scopes, and the more specific scope always wins:

```sql
-- Account-level default (affects all new sessions unless overridden)
ALTER ACCOUNT SET STATEMENT_TIMEOUT_IN_SECONDS = 3600;

-- Session-level (this connection only, until disconnect)
ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = 600;

-- Object-level (specific warehouse — applies to all sessions using it, unless overridden)
ALTER WAREHOUSE etl_wh SET STATEMENT_TIMEOUT_IN_SECONDS = 1800;

-- Precedence: Session > Warehouse > Account (most specific wins)
SHOW PARAMETERS LIKE 'STATEMENT_TIMEOUT_IN_SECONDS';
```

---

## 4. The Three Caching Layers (know these cold)

| Cache | Lives where | TTL / eviction | What it caches |
|---|---|---|---|
| **Result Cache** | Cloud Services | 24 hours, resets on each hit, invalidated if underlying data changes | Full query result for an *identical* SQL text |
| **Local Disk (Warehouse) Cache** | SSD on each compute node | Cleared on warehouse suspend/resize | Raw micro-partition data scanned by recent queries |
| **Metadata Cache** | Cloud Services | Persistent, updated on DML | Min/max values, distinct counts, null counts per micro-partition |

**Practical implication:** a warehouse that auto-suspends aggressively (e.g., 60s) loses its local disk cache on every suspend, meaning the *next* query re-scans from remote storage even if it's the "same" workload. This is the classic cost-vs-performance tradeoff — covered in depth in `Warehouse_Compute_Management.md`.

### 4.1 Result Cache: exact rules for a hit

A result cache hit requires **all** of the following:
- Byte-identical SQL text (differences in whitespace formatting are normalized, but literal differences like a changed date filter are not)
- The querying role has the same privileges as when the result was cached (no re-grant/revoke since)
- None of the underlying micro-partitions have changed (any DML on any referenced table invalidates it)
- The result was produced within the last 24 hours, and each cache hit resets the 24-hour clock (a query re-run daily can theoretically cache-hit forever)
- Session parameters that affect results (timezone, `WEEK_START`, etc.) match

```sql
-- Functions that are NEVER cached, even with identical SQL, because they're non-deterministic
SELECT CURRENT_TIMESTAMP();     -- always fresh
SELECT UNIFORM(1, 100, RANDOM()); -- always fresh
SELECT * FROM my_stream;        -- streams are never result-cached (state advances on read)
```

### 4.2 Local Disk Cache mechanics

- Each warehouse node maintains an LRU-ish SSD cache of columnar data blocks it has scanned
- Cache is **per-warehouse, per-node** — a query hitting a different warehouse (even same size) starts cold
- Resizing a warehouse (`ALTER WAREHOUSE ... SET WAREHOUSE_SIZE`) provisions new nodes — the new, larger node set starts with a **cold cache** even though the old nodes were warm
- This is why "just make it bigger" isn't free — you trade node-count parallelism for cache-locality on the first post-resize query

---

## 5. Micro-Partitions & Pruning (the storage/compute bridge)

- Every table is automatically sliced into **micro-partitions**: immutable, compressed, columnar, typically **50–500MB uncompressed**
- Snowflake stores **metadata per micro-partition**, per column: min value, max value, distinct count, null count
- Query pruning uses this metadata to **skip micro-partitions entirely** before any scan happens — this is why clustering keys matter (see `Table_MicroPartitions_TimeTravel.md`)

```sql
-- Table-level clustering/pruning health
SELECT SYSTEM$CLUSTERING_INFORMATION('sales.public.orders', '(order_date)');

-- Row/byte-level scan stats for a specific query (pull the gap between scanned vs total)
SELECT
    query_id,
    partitions_scanned,
    partitions_total,
    ROUND(partitions_scanned / partitions_total * 100, 1) AS pct_scanned
FROM table(information_schema.query_history())
WHERE query_id = '<id>';

-- Or directly in Query Profile UI:
-- "Partitions scanned" vs "Partitions total" — the gap = pruning efficiency
```

---

## 6. Concurrency Model

- Snowflake uses **multi-version concurrency control (MVCC)** — readers never block writers, writers never block readers
- Each DML statement is a **transaction** that creates new micro-partitions; old ones are retained for Time Travel, not mutated in place
- Multiple warehouses can query/write the **same table** concurrently without lock contention at the row level — conflicts only arise on **concurrent DML to overlapping micro-partitions** (rare, surfaces as a transaction conflict error)

### 6.1 Transaction Isolation & Conflict Handling

Snowflake supports statement-level and explicit multi-statement transactions:

```sql
BEGIN;
UPDATE orders SET status = 'shipped' WHERE order_id = 123;
INSERT INTO order_audit VALUES (123, 'shipped', CURRENT_TIMESTAMP());
COMMIT;

-- Explicit rollback
BEGIN;
DELETE FROM orders WHERE order_date < '2020-01-01';
-- ...realize this was a mistake...
ROLLBACK;
```

- Default isolation level is effectively **Read Committed** — a query sees the data as of the start of the statement
- Two concurrent transactions modifying the **same micro-partitions** will cause one to fail with a transaction conflict error (`Transaction abort due to a concurrent DDL/DML operation`) — this is rare in practice because micro-partitions are large and DML at scale rarely targets the identical physical partition simultaneously, but it does happen with high-frequency `MERGE` on hot tables
- Retry logic in pipelines (especially `MERGE`-heavy Stream/Task consumers) should catch and retry on this specific error code

```sql
-- Check for recent transaction conflicts across the account
SELECT query_id, query_text, error_message
FROM snowflake.account_usage.query_history
WHERE error_message ILIKE '%concurrent%'
ORDER BY start_time DESC;
```

---

## 7. Execution Model: Why "no shuffle tuning" is mostly true

Unlike Spark (where you actively manage partition counts, shuffle partitions, broadcast thresholds, AQE), Snowflake:

- Automatically determines parallelism based on warehouse size (nodes) and micro-partition count
- Has no user-exposed shuffle/partition count knobs — the optimizer handles join strategy (broadcast vs shuffle) internally
- Trade-off: **less manual tuning surface, but also less manual override** when the optimizer picks wrong — your main levers become clustering keys, warehouse size, and query rewriting, not physical execution parameters

### 7.1 Query Acceleration Service (QAS)

A serverless "overflow" mechanism for warehouses handling large, ad-hoc scans:

```sql
ALTER WAREHOUSE adhoc_wh SET ENABLE_QUERY_ACCELERATION = TRUE;
ALTER WAREHOUSE adhoc_wh SET QUERY_ACCELERATION_MAX_SCALE_FACTOR = 8;

-- Check eligibility and actual usage
SELECT * FROM TABLE(information_schema.query_acceleration_eligible(
    warehouse_name => 'ADHOC_WH'
));

SELECT * FROM snowflake.account_usage.query_acceleration_history
ORDER BY start_time DESC;
```

QAS offloads eligible portions of large scan-heavy queries to serverless compute outside the warehouse's fixed node count — useful for ad-hoc/BI warehouses with unpredictable large one-off scans, billed separately per use.

---

## 8. Quick Conceptual Bridge (Databricks ↔ Snowflake)

| Databricks / Spark concept | Snowflake equivalent |
|---|---|
| Spark driver + executors | Virtual Warehouse (nodes) |
| Shuffle partitions / AQE | Handled internally, not user-tunable |
| Delta transaction log | Metadata layer + micro-partition versioning |
| Photon | Vectorized execution engine (always on, not a separate toggle) |
| Z-ordering | Clustering keys |
| Broadcast join hint | No manual hint — optimizer decides (some hint support exists but is limited) |
| DBU | Snowflake Credit |
| Spark UI / DAG visualization | Query Profile |
| Dynamic Resource Allocation | Query Acceleration Service (partial analog) |
| `spark.sql.autoBroadcastJoinThreshold` | No equivalent — fully optimizer-managed |

---

## 9. Gotchas / Things That Trip People Up

- **Result cache requires byte-for-byte identical SQL text** (including whitespace/case in some edge cases with older behavior) *and* no underlying data change — don't assume it's semantic caching.
- **Warehouse size ≠ query speed for small queries.** A tiny query on an XS warehouse and the same query on a 4XL warehouse can take the same wall-clock time if it's cloud-services-bound (compilation, metadata) rather than scan-bound.
- **Suspending a warehouse ≠ free.** You still pay for the *next* warehouse resume's cold cache penalty in query latency, even though you pay $0 in credits while suspended.
- **`CURRENT_WAREHOUSE()` returning NULL** mid-session usually means the warehouse was dropped/renamed elsewhere — not a client bug.
- **Resizing mid-query doesn't affect the in-flight query.** `ALTER WAREHOUSE ... SET WAREHOUSE_SIZE` only applies to queries submitted *after* the resize completes.
- **`ACCOUNT_USAGE` views lag reality by up to a few hours.** Never use them for real-time alerting; use `INFORMATION_SCHEMA` table functions for anything time-sensitive.

---

## 10. Interview / Self-Check Q&A

**Q: Why can Snowflake return `COUNT(*)` with zero bytes scanned?**
A: Row counts per micro-partition are stored in metadata at the Cloud Services layer; a plain count doesn't need to touch the storage layer at all.

**Q: Two identical queries, one takes 2s, the next takes 200ms. Same warehouse, same data. Why?**
A: Likely a Local Disk Cache hit on the second run (data blocks already resident on the warehouse's SSD cache) — or a Result Cache hit if the query text is byte-identical.

**Q: You resize a warehouse from Medium to X-Large mid-pipeline. Does the currently running query speed up?**
A: No — the resize takes effect for queries submitted after it completes; in-flight queries finish on the original node allocation.

**Q: A query shows high `total_elapsed_time` but low `execution_time` and low `bytes_scanned`. What's happening?**
A: It's likely compilation-bound or queued (check `compilation_time` and `queued_overload_time`) — the warehouse never actually did meaningful scan work, so resizing it won't help.

**Q: Why doesn't Snowflake expose a broadcast-join hint like Spark does?**
A: The cost-based optimizer decides join strategy automatically using live micro-partition statistics; Snowflake's philosophy trades manual override control for reduced operational tuning surface.
