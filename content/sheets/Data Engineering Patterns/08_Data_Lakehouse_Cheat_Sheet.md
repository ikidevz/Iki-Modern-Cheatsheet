# Data Lakehouse Cheatsheet for Data Engineers

> A structured reference for building on lakehouse table formats — Delta Lake, Apache Iceberg, and Apache Hudi — covering ACID transactions, time travel, schema enforcement, compaction, and how a lakehouse differs from a plain data lake or a warehouse. Expanded from a short pattern note into a full implementation guide.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 When to Use a Lakehouse](#when-to-use-a-lakehouse)
4. [🏗️ How Table Formats Work](#how-table-formats-work)
5. [🔀 ACID Writes and Merge](#acid-writes-and-merge)
6. [🕰️ Time Travel and Versioning](#time-travel-and-versioning)
7. [📐 Schema Enforcement and Evolution](#schema-enforcement-and-evolution)
8. [🧹 Compaction and Maintenance](#compaction-and-maintenance)
9. [🛠️ Format Comparison: Delta vs Iceberg vs Hudi](#format-comparison-delta-vs-iceberg-vs-hudi)
10. [🔍 Querying from Multiple Engines](#querying-from-multiple-engines)
11. [🔀 Concurrent Write Conflict Resolution](#concurrent-write-conflict-resolution)
12. [🧩 Partition Evolution (Hidden Partitioning)](#partition-evolution-hidden-partitioning)
13. [🌊 Streaming Writes into Lakehouse Tables](#streaming-writes-into-lakehouse-tables)
14. [🗺️ REST Catalogs and Multi-Engine Governance](#rest-catalogs-and-multi-engine-governance)
15. [🚚 Migrating from Hive Tables to Iceberg](#migrating-from-hive-tables-to-iceberg)
16. [🧪 Testing Lakehouse Pipelines](#testing-lakehouse-pipelines)
17. [⚠️ Common Gotchas](#common-gotchas)
18. [✅ Best Practices Checklist](#best-practices-checklist)
19. [📚 Lakehouse vs Data Lake vs Data Warehouse](#lakehouse-vs-data-lake-vs-data-warehouse)
20. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| Table formats | Delta Lake, Apache Iceberg, Apache Hudi |
| Write semantics | ACID transactions via a transaction log / metadata layer |
| Upsert | `MERGE INTO` on a business key |
| Point-in-time read | Time travel via version number or timestamp |
| Schema changes | Enforced by default; evolution via explicit `ALTER`/merge schema options |
| Small files | Compact regularly (`OPTIMIZE`, rewrite data files) |
| Storage | Open file formats (Parquet) on object storage (S3/GCS/ADLS) |

## 🧠 Core Concept

A lakehouse layers **transactional metadata and indexing** on top of plain object storage, giving a data lake the properties that historically required a warehouse: ACID transactions, schema enforcement, time travel, and efficient upserts — while keeping open file formats, low-cost storage, and direct access from many compute engines.

```text
Plain data lake:  files in object storage, no transactions, no enforced schema, "just Parquet"
Lakehouse:        files in object storage + a transaction log / metadata layer (Delta/Iceberg/Hudi)
                   -> ACID writes, time travel, schema enforcement, efficient MERGE, on the SAME storage
```

## 🎯 When to Use a Lakehouse

**Use a lakehouse when:**
- One storage layer needs to serve analytics, ML training, and raw/semi-structured data without duplicating copies into a separate warehouse.
- You need ACID guarantees, time travel, or safe concurrent writers on data living in object storage.
- You want open file formats and engine flexibility (Spark, Trino, Flink, DuckDB) rather than being locked into one warehouse's proprietary storage.

**Avoid/reconsider when:**
- Your workload is purely small-to-medium structured BI reporting — a managed warehouse (Snowflake/BigQuery) may be operationally simpler with less table-maintenance overhead.
- Your team doesn't have the platform capacity to run compaction, vacuuming, and metadata maintenance — an unmaintained lakehouse degrades badly (small files, bloated metadata logs).

## 🏗️ How Table Formats Work

All three major formats share the same core idea: a **metadata layer that tracks which data files currently make up the table**, so readers get a consistent snapshot and writers can commit atomically.

```text
table/
├── _delta_log/            (Delta) or metadata/ + manifests/ (Iceberg)
│   ├── 00000000000000000000.json   <- transaction log entries
│   └── 00000000000000000001.json
└── data files (Parquet)
    ├── part-0001.parquet
    └── part-0002.parquet
```

A reader doesn't list the storage bucket to guess what's current — it reads the log/manifest to get the exact, atomic list of files for a given snapshot.

## 🔀 ACID Writes and Merge

```python
from delta.tables import DeltaTable

target_path = "s3://lake/sales"
df.write.format("delta").mode("append").save(target_path)

# Upsert: match business key, update changed rows, insert new ones
DeltaTable.forPath(spark, target_path).alias("target").merge(
    updates.alias("source"), "target.id = source.id"
).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()
```

```python
# Equivalent pattern with Apache Iceberg (Spark SQL)
spark.sql("""
    MERGE INTO catalog.sales AS target
    USING updates AS source
    ON target.id = source.id
    WHEN MATCHED THEN UPDATE SET *
    WHEN NOT MATCHED THEN INSERT *
""")
```

Because writes are atomic, concurrent jobs either see the full pre-write or full post-write state — never a half-written table.

## 🕰️ Time Travel and Versioning

```python
# Delta Lake: query a prior version or timestamp
df_v5 = spark.read.format("delta").option("versionAsOf", 5).load(target_path)
df_yesterday = spark.read.format("delta").option("timestampAsOf", "2026-09-16").load(target_path)

# Roll back a table to a prior version (e.g., after a bad job run corrupted data)
DeltaTable.forPath(spark, target_path).restoreToVersion(5)
```

```sql
-- Apache Iceberg equivalent
SELECT * FROM catalog.sales VERSION AS OF 482910384712;
SELECT * FROM catalog.sales FOR SYSTEM_TIME AS OF '2026-09-16 00:00:00';
```

Time travel makes "someone published bad data" a five-minute rollback instead of an emergency restore from backups.

## 📐 Schema Enforcement and Evolution

```python
# Schema enforcement: a mismatched write fails loudly by default
df_with_extra_column.write.format("delta").mode("append").save(target_path)  # raises if columns don't match

# Explicitly allow additive schema evolution
(df_with_extra_column.write.format("delta")
    .mode("append")
    .option("mergeSchema", "true")
    .save(target_path))
```

```sql
-- Iceberg: schema changes are table DDL, versioned like any other change
ALTER TABLE catalog.sales ADD COLUMN currency STRING;
ALTER TABLE catalog.sales ALTER COLUMN amount TYPE DOUBLE;   -- safe, widening type change
```

See [schema-evolution.md](./Schema_Evolution_Cheat_Sheet.md) for the general compatibility rules this builds on.

## 🧹 Compaction and Maintenance

Lakehouse tables accumulate small files (from frequent small writes) and old file versions (retained for time travel) — both need active maintenance.

```python
# Delta: compact small files into larger ones
spark.sql("OPTIMIZE catalog.sales ZORDER BY (customer_id)")

# Delta: remove files no longer referenced by any retained version (respecting retention window)
spark.sql("VACUUM catalog.sales RETAIN 168 HOURS")  # 7 days
```

```sql
-- Iceberg: rewrite data files and expire old snapshots
CALL catalog.system.rewrite_data_files('sales');
CALL catalog.system.expire_snapshots('sales', TIMESTAMP '2026-09-10 00:00:00');
```

**Rule of thumb:** schedule compaction and snapshot expiry as their own recurring jobs — they don't happen automatically, and an un-compacted table's query performance degrades quietly until someone notices.

## 🛠️ Format Comparison: Delta vs Iceberg vs Hudi

| Format | Strength | Typical ecosystem |
|---|---|---|
| Delta Lake | Deep Spark/Databricks integration, mature `MERGE`/time travel | Databricks-centric stacks |
| Apache Iceberg | Strong multi-engine support, hidden partitioning, broad vendor adoption | Trino, Spark, Flink, Snowflake, BigQuery external tables |
| Apache Hudi | Strong incremental/CDC-oriented ingestion (upsert-heavy streaming) | Streaming-heavy ingestion pipelines |

All three are converging in capability; the practical decision is usually driven by which engines and catalogs your organization already standardizes on.

## 🔍 Querying from Multiple Engines

```python
# The same Iceberg table, queried from different engines via a shared catalog
spark.sql("SELECT * FROM catalog.sales LIMIT 10")
# Trino: SELECT * FROM iceberg.default.sales LIMIT 10;
# DuckDB: SELECT * FROM iceberg_scan('s3://lake/sales/metadata/...');
```

The catalog (Hive Metastore, AWS Glue, Unity Catalog, or a REST catalog) is what lets multiple engines agree on "current table state" without stepping on each other.

## 🔀 Concurrent Write Conflict Resolution

ACID guarantees prevent corruption, but two writers targeting overlapping data will still have one succeed and one fail (or retry) — understanding *which* conflicts are resolvable automatically vs which require application-level handling matters at scale.

```python
from delta.exceptions import ConcurrentAppendException, ConcurrentDeleteReadException

def merge_with_retry(spark, target_path, updates, max_retries=3):
    from delta.tables import DeltaTable
    for attempt in range(max_retries):
        try:
            DeltaTable.forPath(spark, target_path).alias("t").merge(
                updates.alias("s"), "t.id = s.id"
            ).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()
            return
        except ConcurrentAppendException:
            # Another writer committed a conflicting version between our read and write
            time.sleep(2 ** attempt)   # backoff and retry against the new version
    raise RuntimeError("MERGE failed after retries due to persistent write conflicts")
```

| Conflict type | Auto-resolved? | Notes |
|---|---|---|
| Two appends to different partitions | Yes | No overlap, both commit cleanly |
| Two `MERGE`s targeting the same rows | No — one retries | Design writers to catch and retry on conflict exceptions |
| Concurrent `OPTIMIZE` + write | Usually yes (Delta) | Compaction is designed to coexist with concurrent writes |
| Concurrent schema change + write | No | Serialize schema changes; don't run `ALTER TABLE` during active write windows |

**Practical rule:** design for **single-writer-per-table** where possible (one job, one schedule, owns all writes to a table). When multiple writers are unavoidable (e.g., multiple micro-batch streams), build retry-with-backoff into every `MERGE` call.

## 🧩 Partition Evolution (Hidden Partitioning)

A classic data lake pain point: changing a table's partitioning scheme (daily → hourly, or adding a new partition column) traditionally meant rewriting the entire table. Iceberg's **hidden partitioning** decouples partition layout from query syntax, letting the scheme evolve without a rewrite or query changes.

```sql
-- Iceberg: partition transforms are hidden from queries entirely
CREATE TABLE catalog.sales (
    order_id STRING, amount DECIMAL(10,2), order_ts TIMESTAMP
)
PARTITIONED BY (days(order_ts));   -- partition column is DERIVED, not a physical column

-- Queries never reference the partition column directly — Iceberg prunes automatically
SELECT * FROM catalog.sales WHERE order_ts >= '2026-09-01';

-- Evolve partitioning going forward WITHOUT rewriting existing data
ALTER TABLE catalog.sales REPLACE PARTITION FIELD days(order_ts) WITH hours(order_ts);
-- Old data stays partitioned by day; new data is written partitioned by hour;
-- queries against the whole table still work correctly and prune appropriately for each.
```

```sql
-- Delta Lake equivalent requires a physical partition column and a full rewrite to change it
-- (a real operational difference between the formats worth knowing before committing to one)
CREATE TABLE catalog.sales (order_id STRING, amount DECIMAL(10,2), order_date DATE)
USING DELTA PARTITIONED BY (order_date);
```

This is one of the more consequential practical differences between Iceberg and Delta: if partition scheme changes are a realistic future need (they usually are, as volume grows), hidden partitioning avoids an expensive full-table rewrite.

## 🌊 Streaming Writes into Lakehouse Tables

```python
# Structured Streaming writing continuously into a Delta table
(spark.readStream
    .format("kafka")
    .option("subscribe", "orders")
    .load()
    .select(F.from_json(F.col("value").cast("string"), order_schema).alias("data"))
    .select("data.*")
    .writeStream
    .format("delta")
    .outputMode("append")
    .option("checkpointLocation", "s3://checkpoints/orders_stream/")
    .trigger(processingTime="30 seconds")   # micro-batch interval — tune to balance latency vs file size
    .start("s3://lake/orders/"))
```

```python
# Combine streaming writes with periodic compaction — streaming naturally produces small files
def compact_streaming_table():
    spark.sql("OPTIMIZE catalog.orders WHERE order_date >= current_date() - INTERVAL 2 DAYS")

# Schedule this separately (e.g., hourly), since the streaming job itself won't compact on its own
```

Streaming ingestion is the most common source of the small-files problem — every micro-batch trigger produces at least one new file per partition. Pair any streaming write with a **separate, scheduled compaction job**, not an assumption that the streaming job will clean up after itself.

## 🗺️ REST Catalogs and Multi-Engine Governance

```python
# Iceberg REST catalog: a vendor-neutral catalog protocol multiple engines can share
from pyiceberg.catalog import load_catalog

catalog = load_catalog("prod", **{
    "uri": "https://iceberg-rest.internal/v1",
    "warehouse": "s3://lake/warehouse",
})
table = catalog.load_table("sales.orders")
print(table.schema())
```

```sql
-- Spark configured against the same REST catalog
spark.conf.set("spark.sql.catalog.prod", "org.apache.iceberg.spark.SparkCatalog")
spark.conf.set("spark.sql.catalog.prod.type", "rest")
spark.conf.set("spark.sql.catalog.prod.uri", "https://iceberg-rest.internal/v1")
```

A REST catalog matters because it means Spark, Trino, Snowflake, and DuckDB can all resolve "what does `sales.orders` currently look like" against the **same source of truth**, rather than each engine maintaining its own view via a proprietary integration — this is what makes "pick the best engine per workload, same tables" actually practical.

## 🚚 Migrating from Hive Tables to Iceberg

```sql
-- In-place migration: converts metadata only, existing Parquet files are NOT rewritten
CALL catalog.system.migrate('legacy_db.orders');

-- Alternative: create a new Iceberg table as a copy, for a zero-risk parallel cutover
CALL catalog.system.snapshot('legacy_db.orders', 'catalog.orders_iceberg');
```

```python
# Validate row counts and a sample of aggregates match before cutting reads/writes over
assert spark.table("legacy_db.orders").count() == spark.table("catalog.orders_iceberg").count()
old_sum = spark.table("legacy_db.orders").agg(F.sum("amount")).first()[0]
new_sum = spark.table("catalog.orders_iceberg").agg(F.sum("amount")).first()[0]
assert abs(old_sum - new_sum) < 0.01
```

**`migrate` is fast** (metadata-only, no data rewrite) but commits to the new format immediately — prefer **`snapshot`** for a reversible, side-by-side migration where you validate the new table thoroughly before repointing production traffic and can fall back instantly if something's wrong.

## 🧪 Testing Lakehouse Pipelines

```python
def test_merge_is_idempotent(spark, tmp_delta_path):
    updates = spark.createDataFrame([(1, "shipped")], ["id", "status"])
    for _ in range(2):
        DeltaTable.forPath(spark, tmp_delta_path).alias("t").merge(
            updates.alias("s"), "t.id = s.id"
        ).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()
    result = spark.read.format("delta").load(tmp_delta_path)
    assert result.filter("id = 1").count() == 1   # not duplicated by the second identical merge

def test_time_travel_rollback(spark, tmp_delta_path):
    delta_table = DeltaTable.forPath(spark, tmp_delta_path)
    version_before = delta_table.history(1).first()["version"]
    write_bad_data(tmp_delta_path)
    delta_table.restoreToVersion(version_before)
    assert spark.read.format("delta").load(tmp_delta_path).count() == expected_good_count

def test_schema_enforcement_rejects_mismatched_write(spark, tmp_delta_path):
    bad_schema_df = spark.createDataFrame([(1, "extra_unexpected_column")], ["id", "junk"])
    with pytest.raises(Exception):
        bad_schema_df.write.format("delta").mode("append").save(tmp_delta_path)  # no mergeSchema
```

## ⚠️ Common Gotchas

- **Small files problem is real and silent** — frequent small appends (e.g., from streaming ingestion) degrade read performance until compaction runs.
- **`VACUUM`/snapshot expiry deletes time-travel history** — set retention windows deliberately, and never vacuum below your minimum required rollback window.
- **Concurrent writers can still conflict** — ACID prevents corruption, but two conflicting `MERGE`s to the same partition will have one fail/retry; design for that.
- **Metadata log growth** on very high-frequency-write tables (thousands of tiny commits) can itself become a bottleneck — batch writes where possible.
- **Not all query engines support all format features equally** — verify engine-specific support (e.g., hidden partitioning, deletion vectors) before depending on it.
- **Schema enforcement is a default, not a guarantee against all corruption** — a `mergeSchema=true` write can still silently widen your schema in ways downstream consumers don't expect.
- **Multiple uncoordinated writers to the same table** produce frequent `MERGE` conflicts — design for single-writer-per-table where possible, and retry-with-backoff where it isn't.
- **Streaming writes without a separate compaction job** — the streaming job itself won't clean up the small files it produces; compaction has to be scheduled independently.
- **Running `migrate()` on a Hive table as your only migration path** commits immediately with no easy rollback — prefer `snapshot()` for a reversible, validated cutover on anything business-critical.
- **Assuming partition scheme is fixed forever** on Delta Lake, where changing it means a full rewrite — if partition evolution is a realistic future need, this is a real factor in the Delta vs. Iceberg decision.

## ✅ Best Practices Checklist

- [ ] Compaction (`OPTIMIZE`/rewrite data files) runs on a schedule, not ad hoc
- [ ] Snapshot/version retention is a deliberate, documented window
- [ ] `MERGE` operations target a stable business key with proper partition pruning
- [ ] Schema evolution changes are additive by default; breaking changes go through review
- [ ] A shared catalog (Glue/Hive Metastore/Unity/REST) is used so multiple engines see consistent table state
- [ ] Write frequency is batched enough to avoid metadata log bloat

## 📚 Lakehouse vs Data Lake vs Data Warehouse

| Dimension | Data Lake | Lakehouse | Data Warehouse |
|---|---|---|---|
| Storage | Object storage, open formats | Object storage, open formats + transaction log | Proprietary/managed storage |
| ACID transactions | No | Yes | Yes |
| Time travel | No (manual snapshotting only) | Yes, built in | Sometimes (vendor-dependent) |
| Schema enforcement | No | Yes, configurable | Yes |
| Engine flexibility | High | High | Low (usually one query engine) |
| Best fit | Cheap raw storage, ML lake | Unified analytics + ML on one copy | Governed BI/reporting |

## 💡 Pro Tips

1. **Schedule compaction as a first-class recurring job**, not a manual "run it when queries feel slow" task.
2. **Set retention windows deliberately** before running `VACUUM`/`expire_snapshots` — you can't time-travel past what you've expired.
3. **Partition and Z-order/sort by your most common filter columns** to keep `MERGE` and scans fast.
4. **Use a shared catalog** so Spark, Trino, and other engines agree on table state.
5. **Batch small writes** where possible — high-frequency tiny commits bloat the metadata log.
6. **Treat schema evolution as a reviewed change**, even though the format allows additive changes without much ceremony.
7. **Use time travel for incident response** — a bad publish is a rollback command away, not an emergency restore.
8. **Benchmark `MERGE` performance on your actual partition scheme** before committing to an upsert-heavy design at scale.
9. **Pick the format based on ecosystem fit** (engines and catalogs you already use), not on feature checklists alone — the three formats are converging.
10. **Monitor table health metrics** (file count, average file size, snapshot count) the same way you'd monitor pipeline SLAs.
11. **Design for single-writer-per-table** wherever the workload allows it — it sidesteps most `MERGE` conflict handling entirely.
12. **Pair every streaming write with a separately scheduled compaction job** — don't assume the stream cleans up after itself.
13. **Prefer `snapshot()` over `migrate()`** for Hive-to-Iceberg migrations you might need to roll back.
14. **Weigh hidden partitioning (Iceberg) against your expected need to evolve partition schemes** — it's a real, sometimes decisive, factor in format choice.
15. **Adopt a REST catalog** when more than one query engine needs to see the same tables consistently, rather than maintaining parallel per-engine catalog integrations.

