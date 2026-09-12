# Delta Table Deep Dive Cheatsheet

> Delta Lake is the open storage format underneath every table in the Lakehouse. This is your reference for the transaction log internals, concurrency control, time travel, MERGE, optimization, clustering, and schema management.

---

## 1. What Delta Lake Adds Over Plain Parquet

| Feature | Plain Parquet | Delta Lake |
|---------|---------------|------------|
| ACID transactions | ❌ | ✅ |
| Time travel | ❌ | ✅ |
| Schema enforcement/evolution | ❌ | ✅ |
| Upserts / Deletes / Merges | ❌ | ✅ |
| Unified batch + streaming source | ❌ | ✅ |
| File-level statistics for skipping | ❌ | ✅ (min/max stats in the log) |
| Concurrent writer safety | ❌ | ✅ (optimistic concurrency control) |
| Row-level change tracking (CDF) | ❌ | ✅ |

A Delta table = **Parquet data files** + a **`_delta_log/` directory** of JSON/checkpoint files describing every transaction ever committed against the table.

---

## 2. The Transaction Log (`_delta_log`) — Internals

```
my_table/
├── part-00000-....snappy.parquet
├── part-00001-....snappy.parquet
└── _delta_log/
    ├── 00000000000000000000.json   ← commit 0 (CREATE TABLE / metaData action)
    ├── 00000000000000000001.json   ← commit 1 (INSERT → add actions)
    ├── 00000000000000000002.json   ← commit 2 (MERGE → add + remove actions)
    ├── ...
    ├── 00000000000000000010.checkpoint.parquet   ← periodic checkpoint (state snapshot)
    └── _last_checkpoint                          ← pointer to the latest checkpoint
```

Each JSON commit file is a list of **actions**:

| Action | Meaning |
|--------|---------|
| `metaData` | Schema, partitioning, table properties as of this point |
| `add` | A data file was added to the table's logical contents |
| `remove` | A data file was logically removed (tombstoned, not necessarily deleted from disk yet) |
| `commitInfo` | Metadata about the operation (who, what operation, timestamp, metrics) |
| `protocol` | Minimum reader/writer protocol version required to read/write the table |
| `txn` | Idempotency markers used by streaming writers to avoid duplicate commits |

- Readers reconstruct the **current table state** by replaying the log from the most recent checkpoint forward to the latest JSON commit.
- **Checkpoints** (Parquet, containing the full flattened state) are written every 10 commits by default, so a reader doesn't need to replay thousands of tiny JSON files from the beginning of history.
- This log is what enables **ACID guarantees**: a writer computes its change, then atomically tries to write the *next* sequential commit file. If another writer got there first, the transaction fails and can retry after re-reading the new state.

### Protocol Versions
Delta has a **reader protocol version** and a **writer protocol version** recorded in the log. Enabling newer features (e.g., Deletion Vectors, Column Mapping, Liquid Clustering) can bump the minimum protocol version required, which means **older Delta clients may no longer be able to read/write the table** until they upgrade. Check with:
```sql
DESCRIBE DETAIL my_table;   -- shows minReaderVersion / minWriterVersion
```

---

## 3. Optimistic Concurrency Control

Delta doesn't use locks. Instead, every writer:
1. Reads the current table version.
2. Computes its changes assuming that version is still current.
3. Attempts to commit the **next** version number atomically.
4. If another writer already committed that version, Delta checks whether the two transactions **conflict** (e.g., did they touch overlapping files/partitions?). If not, it can sometimes retry transparently; if they do conflict, one fails.

| Exception | Cause |
|-----------|-------|
| `ConcurrentAppendException` | Two writers appended data that could conflict with a concurrent read/delete predicate |
| `ConcurrentDeleteReadException` | A file being read was concurrently deleted by another transaction |
| `MetadataChangedException` | Table schema/properties changed concurrently |
| `ProtocolChangedException` | Table protocol version changed concurrently |

**Mitigations:** narrow your `MERGE`/`UPDATE`/`DELETE` predicates as much as possible (so conflicting transactions are less likely to overlap), enable **row-level concurrency** (see below), or serialize known-conflicting jobs via job orchestration (`max_concurrent_runs: 1`).

---

## 4. Creating & Writing Delta Tables

```sql
-- Managed table (data lifecycle owned by Unity Catalog)
CREATE TABLE my_catalog.my_schema.orders (
  order_id BIGINT,
  customer STRING,
  amount DECIMAL(10,2),
  order_ts TIMESTAMP
) USING DELTA
COMMENT 'Order transactions'
TBLPROPERTIES ('quality' = 'silver');

-- External table (you own the storage location)
CREATE TABLE my_catalog.my_schema.orders
USING DELTA
LOCATION 's3://my-bucket/orders/';

-- CTAS (create table as select)
CREATE TABLE gold.daily_revenue AS
SELECT order_date, SUM(amount) AS revenue FROM silver.orders GROUP BY order_date;
```

```python
df.write.format("delta").mode("overwrite").saveAsTable("my_catalog.my_schema.orders")

(df.write.format("delta")
   .mode("append")
   .option("mergeSchema", "true")
   .save("/path/to/table"))

# Overwrite only matching partitions, not the whole table
(df.write.format("delta")
   .mode("overwrite")
   .option("replaceWhere", "order_date >= '2026-09-01'")
   .save("/path/to/table"))
```

### Generated & Identity Columns
```sql
CREATE TABLE events (
  event_ts TIMESTAMP,
  event_date DATE GENERATED ALWAYS AS (CAST(event_ts AS DATE)),
  id BIGINT GENERATED ALWAYS AS IDENTITY
) USING DELTA;
```
Generated columns are computed automatically on write and can be used as partitioning/clustering keys even when the source data doesn't include them directly — Delta also uses the generation expression for **partition pruning** when you filter on the source column.

---

## 5. ACID Operations: INSERT / UPDATE / DELETE / MERGE

```sql
INSERT INTO orders VALUES (1, 'Alice', 99.99, current_timestamp());

UPDATE orders SET amount = amount * 1.1 WHERE customer = 'Alice';

DELETE FROM orders WHERE order_ts < '2023-01-01';

-- MERGE = the workhorse for upserts (CDC, SCD, dedup)
MERGE INTO orders t
USING staged_orders s
ON t.order_id = s.order_id
WHEN MATCHED AND s.is_deleted THEN DELETE
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *
WHEN NOT MATCHED BY SOURCE THEN DELETE;   -- optional: remove target rows absent from source
```

**How `UPDATE`/`DELETE`/`MERGE` physically work:** Delta identifies the data files containing matching rows, rewrites *only those files* with the changes applied (unless Deletion Vectors are enabled — see below), and atomically swaps them into the table version via `remove`+`add` actions. It never mutates a Parquet file in place.

### Slowly Changing Dimension (SCD Type 2) Pattern
```sql
MERGE INTO dim_customer t
USING updates s
ON t.customer_id = s.customer_id AND t.is_current = true
WHEN MATCHED AND t.attr_hash <> s.attr_hash THEN
  UPDATE SET t.is_current = false, t.end_date = current_date()
WHEN NOT MATCHED THEN
  INSERT (customer_id, attr_hash, start_date, is_current)
  VALUES (s.customer_id, s.attr_hash, current_date(), true);
```
> This simplified pattern closes the old row but requires a **second pass** to insert the new version row (since one `MERGE` clause can't both update an old row and insert a new one for the same key match). DLT's `apply_changes` (see [Ingestion cheatsheet](./05-ingestion-etl-dlt.md)) automates full SCD Type 1/2 handling for you.

---

## 6. Time Travel

```sql
-- By version
SELECT * FROM orders VERSION AS OF 12;
SELECT * FROM orders@v12;

-- By timestamp
SELECT * FROM orders TIMESTAMP AS OF '2026-08-01T00:00:00Z';

-- Restore a table to a prior state (creates a new commit, doesn't rewrite history)
RESTORE TABLE orders TO VERSION AS OF 12;

-- Inspect history
DESCRIBE HISTORY orders;
```

```python
spark.read.format("delta").option("versionAsOf", 12).table("orders")
spark.read.format("delta").option("timestampAsOf", "2026-08-01").table("orders")
```

**Use cases:** debugging "what did this table look like before yesterday's bad job run," reproducing ML training data exactly, auditing, and recovering from accidental deletes/overwrites without restoring from a separate backup system.

> Time travel depends on the underlying data files still existing — `VACUUM` **permanently removes** old files and limits how far back you can travel. Always check `delta.deletedFileRetentionDuration` and `delta.logRetentionDuration` before vacuuming aggressively.

---

## 7. File Maintenance: OPTIMIZE, Z-ORDER, VACUUM

```sql
-- Compact small files into larger ones (fixes the "small file problem")
OPTIMIZE orders;

-- Compact + co-locate rows with similar values in these columns (multi-dimensional clustering)
OPTIMIZE orders ZORDER BY (customer_id, order_ts);

-- Remove files no longer referenced by the log, older than the retention window
VACUUM orders RETAIN 168 HOURS;   -- default = 7 days (168 hours)
VACUUM orders DRY RUN;            -- preview what would be deleted, without deleting
```

**How `OPTIMIZE` (bin-packing) works:** it reads existing small files within a target range and rewrites them into fewer, appropriately-sized files (targeting roughly 1 GB by default, tunable), then atomically commits the swap. Concurrent readers/writers are unaffected — they simply see the old files until the new commit is visible, and old files become eligible for `VACUUM` afterward.

**How Z-ORDER works:** it interleaves the bits of multiple column values into a single sort key (a "Z-order curve") so that files end up containing rows that are close together across *multiple* dimensions simultaneously — improving data-skipping effectiveness for queries that filter on any of the Z-ordered columns, not just the first one (unlike simple multi-column sort).

### Liquid Clustering (Modern Replacement for Partitioning + Z-Order)
```sql
CREATE TABLE orders (...) CLUSTER BY (customer_id, order_ts);
ALTER TABLE orders CLUSTER BY (customer_id);   -- change clustering keys without a full rewrite
OPTIMIZE orders;                                -- incrementally re-clusters, no full table rewrite needed
```

| | Hive-style Partitioning | Z-ORDER | Liquid Clustering |
|---|---|---|---|
| Rewrite cost to change keys | Full table rewrite | Full `OPTIMIZE` rewrite | Incremental, only affected files |
| Handles high-cardinality keys well | ❌ (creates too many small partitions) | ✅ | ✅ |
| Avoids small-file/skew issues | ❌ | Partial | ✅ |
| Recommended for new tables | ❌ | ⚠️ legacy | ✅ default choice |

> **Liquid Clustering** is now the recommended default over Hive-style partitioning for most new tables — it avoids partition skew and small-file issues, supports evolving clustering keys over time, and combines the benefits of partitioning and Z-ordering into one incremental mechanism.

### Predictive Optimization
Databricks can automatically run `OPTIMIZE` and `VACUUM` on Unity Catalog managed tables on a Databricks-determined schedule, based on table usage patterns — removing the need to manually schedule maintenance jobs for most managed tables.
```sql
ALTER TABLE orders SET TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true');
-- Predictive Optimization is typically enabled/managed at the catalog or account level
```

---

## 8. Schema Enforcement & Evolution

```python
# Enforcement: this FAILS if schema doesn't match (safety net against silently bad writes)
df.write.format("delta").mode("append").save(path)

# Evolution: explicitly allow new columns to be added
df.write.format("delta").mode("append").option("mergeSchema", "true").save(path)

# Or enable it session/table-wide (use deliberately, not blanket-enabled everywhere)
spark.conf.set("spark.databricks.delta.schema.autoMerge.enabled", "true")
```

```sql
ALTER TABLE orders ADD COLUMN discount DECIMAL(5,2);
ALTER TABLE orders ALTER COLUMN amount COMMENT 'USD';
ALTER TABLE orders ALTER COLUMN amount TYPE DOUBLE;         -- widening type changes supported
ALTER TABLE orders DROP COLUMN legacy_col;                  -- requires column mapping mode enabled
ALTER TABLE orders SET TBLPROPERTIES ('delta.columnMapping.mode' = 'name');
ALTER TABLE orders RENAME COLUMN old_name TO new_name;      -- also requires column mapping
```

**Column Mapping** decouples a column's logical name from its physical storage location in the Parquet files, which is what makes `RENAME COLUMN` and `DROP COLUMN` possible without rewriting all underlying data files.

---

## 9. Constraints & Data Quality

```sql
ALTER TABLE orders ADD CONSTRAINT positive_amount CHECK (amount >= 0);
ALTER TABLE orders ADD CONSTRAINT valid_customer FOREIGN KEY (customer_id) REFERENCES customers(id);
ALTER TABLE orders CHANGE COLUMN order_id SET NOT NULL;
ALTER TABLE orders DROP CONSTRAINT positive_amount;
```
`CHECK` constraints are enforced on every write — a violating row causes the **entire write to fail** (Delta does not silently drop bad rows the way DLT's `expect_or_drop` does). This makes constraints a good hard safety net, while DLT expectations are better for graceful data-quality handling. See [Ingestion, ETL & DLT](./05-ingestion-etl-dlt.md).

---

## 10. Change Data Feed (CDF)

Tracks row-level changes (`insert` / `update_preimage` / `update_postimage` / `delete`) so downstream consumers can process only what changed, instead of re-reading the whole table.

```sql
ALTER TABLE orders SET TBLPROPERTIES (delta.enableChangeDataFeed = true);

SELECT * FROM table_changes('orders', 10, 15);   -- changes between versions 10 and 15
SELECT * FROM table_changes('orders', '2026-08-01', '2026-08-02');
```

```python
spark.read.format("delta") \
  .option("readChangeFeed", "true") \
  .option("startingVersion", 10) \
  .table("orders")
```

**Typical use case:** a Silver table enables CDF, and a downstream Gold aggregation reads only the changed rows via `table_changes()` to incrementally update aggregates, instead of recomputing the full aggregation from scratch every run.

---

## 11. Deletion Vectors & Row-Level Concurrency

- **Deletion Vectors**: instead of rewriting an entire Parquet file when a `DELETE`/`UPDATE`/`MERGE` only touches a few rows in it, Delta writes a small side file marking which rows are logically deleted, and readers merge this in transparently. This dramatically speeds up write-heavy `MERGE`/`DELETE` workloads by avoiding large file rewrites for small changes. Files accumulate deletion vectors over time and get physically compacted during a later `OPTIMIZE`.
- **Row-level concurrency**: allows concurrent writers to update **different rows in the same files** without conflicting — previously, two transactions touching the same file (even different rows) could conflict under optimistic concurrency control; row-level concurrency (built on Deletion Vectors) narrows the conflict detection down to the actual rows touched.

```sql
ALTER TABLE orders SET TBLPROPERTIES ('delta.enableDeletionVectors' = true);
```

> Deletion Vectors bump the table's minimum reader protocol version — very old Delta clients/engines may need an upgrade to read a table with them enabled.

---

## 12. Delta Universal Format (UniForm) & Interoperability

Delta **UniForm** allows a single set of Parquet data files to be read as **Delta, Iceberg, or Hudi** simultaneously by generating the respective metadata for each format alongside the native Delta log — useful when downstream tools/consumers expect Iceberg-compatible catalogs but you still want to write via Delta.

```sql
ALTER TABLE orders SET TBLPROPERTIES ('delta.universalFormat.enabledFormats' = 'iceberg');
```

**Deep Clone vs. Shallow Clone:**
```sql
CREATE TABLE orders_backup DEEP CLONE orders;      -- copies data files too (full independent copy)
CREATE TABLE orders_dev SHALLOW CLONE orders;      -- metadata-only clone, references original files (fast, cheap, great for dev/test)
```

---

## 13. Useful Table Properties Reference

```sql
ALTER TABLE orders SET TBLPROPERTIES (
  'delta.autoOptimize.optimizeWrite' = 'true',
  'delta.autoOptimize.autoCompact' = 'true',
  'delta.logRetentionDuration' = 'interval 30 days',
  'delta.deletedFileRetentionDuration' = 'interval 7 days',
  'delta.enableChangeDataFeed' = 'true',
  'delta.enableDeletionVectors' = 'true',
  'delta.columnMapping.mode' = 'name'
);
```

```sql
DESCRIBE DETAIL orders;          -- format, location, size, numFiles, protocol versions, properties
DESCRIBE HISTORY orders;         -- full operation log with metrics per commit
SHOW TBLPROPERTIES orders;
```

---

## 14. Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Too many small files | Enable `autoOptimize`, run `OPTIMIZE` regularly or rely on Predictive Optimization, use Liquid Clustering |
| `VACUUM` breaks time travel for a running stream/consumer | Increase retention before vacuuming, coordinate with downstream consumers first |
| Schema mismatch errors on append | Use `mergeSchema` deliberately per-write, don't blanket-enable auto-merge account-wide |
| Concurrent writer conflicts | Narrow `MERGE` predicates, enable row-level concurrency, serialize known-conflicting jobs |
| Querying old Parquet files directly (bypassing the Delta log) | Never read the data directory with a plain Parquet reader — always go through the Delta table interface |
| Over-partitioning by high-cardinality column | Prefer Liquid Clustering, or partition by a coarse column (e.g., date) only |
| Forgetting `CHECK` constraints fail the whole write | Use DLT expectations instead if you want to drop/quarantine bad rows rather than fail the job |

---

## Related Cheatsheets
- [Ingestion, ETL & DLT](./05-ingestion-etl-dlt.md)
- [Performance Tuning & Optimization](./08-performance-tuning-optimization.md)
- [Unity Catalog & Governance](./06-unity-catalog-governance.md)
