# Lakehouse Table Formats — Delta Lake, Apache Iceberg, Apache Hudi & Apache Paimon Cheatsheet

> A structured, comparison-driven reference for the open table formats that power modern lakehouses — what problem they solve, how their internals differ, and side-by-side syntax (SQL and PySpark) for the operations you'll actually run: creating tables, evolving schemas, upserting, time travel, compaction, security, and choosing between them.

## 📑 Table of Contents

1. [🚀 Getting Started: What Problem These Solve](#getting-started-what-problem-these-solve)
2. [🏗️ Architecture Comparison](#architecture-comparison)
3. [📊 Feature Comparison](#feature-comparison)
4. [🆕 Apache Paimon: The Streaming-Native Fourth Option](#apache-paimon-the-streaming-native-fourth-option)
5. [🔨 Creating Tables](#creating-tables)
6. [🔀 Schema Evolution](#schema-evolution)
7. [🗂️ Partitioning Strategies](#partitioning-strategies)
8. [✍️ Upserts, Deletes & MERGE (CDC)](#upserts-deletes-merge-cdc)
9. [🕰️ Time Travel & Versioning](#time-travel-versioning)
10. [🧹 Compaction & File Maintenance](#compaction-file-maintenance)
11. [📚 Catalogs](#catalogs)
12. [🌊 Streaming Ingestion](#streaming-ingestion)
13. [🔄 Interoperability Between Formats](#interoperability-between-formats)
14. [🔌 Query Engine Support](#query-engine-support)
15. [🔬 Internals Deep Dive](#internals-deep-dive)
16. [🐍 PySpark / DataFrame API Reference](#pyspark-dataframe-api-reference)
17. [🔐 Security & Governance](#security-governance)
18. [🏛️ Real-World Architecture Patterns](#real-world-architecture-patterns)
19. [🛠️ Troubleshooting & Common Errors](#troubleshooting-common-errors)
20. [🧭 Choosing a Format](#choosing-a-format)
21. [💡 Gotchas & Best Practices](#gotchas-best-practices)
22. [📋 Common Patterns](#common-patterns)

## ⚡ Quick Reference

**Same task, four formats** (Spark SQL; a `catalog` prefix is assumed where each format needs one)

| Task                      | Apache Iceberg                                            | Delta Lake                                        | Apache Hudi                                                       | Apache Paimon                                                         |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| Create a table            | `CREATE TABLE t (...) USING iceberg`                      | `CREATE TABLE t (...) USING delta`                | `CREATE TABLE t (...) USING hudi TBLPROPERTIES(...)`              | `CREATE TABLE t (...) TBLPROPERTIES('primary-key'=..., 'bucket'=...)` |
| Time travel by timestamp  | `SELECT * FROM t TIMESTAMP AS OF '2024-01-01 00:00:00'`   | `SELECT * FROM t TIMESTAMP AS OF '2024-01-01'`    | `SELECT * FROM t TIMESTAMP AS OF '2024-01-01 00:00:00'`           | `SELECT * FROM t TIMESTAMP AS OF '2024-01-01 00:00:00'`               |
| Time travel by version    | `SELECT * FROM t VERSION AS OF 123456789`                 | `SELECT * FROM t VERSION AS OF 5`                 | `SELECT * FROM t TIMESTAMP AS OF '20240101000000'` (instant time) | `SELECT * FROM t VERSION AS OF 5` (snapshot id)                       |
| Upsert                    | `MERGE INTO t USING src ON ...`                           | `MERGE INTO t USING src ON ...`                   | `MERGE INTO t USING src ON ...`                                   | plain `INSERT INTO` — merge engine handles dedup automatically        |
| History / commit log      | `SELECT * FROM t.history`                                 | `DESCRIBE HISTORY t`                              | `CALL show_commits(table => 't')`                                 | `SELECT * FROM t$snapshots`                                           |
| Compact small files       | `CALL system.rewrite_data_files('t')`                     | `OPTIMIZE t`                                      | `CALL run_compaction(op => 'run', table => 't')` (MoR tables)     | `CALL sys.compact(table => 't')`                                      |
| Cluster/sort data layout  | (sort order metadata; Z-order via `rewrite_data_files`)   | `OPTIMIZE t ZORDER BY (col)` / `CLUSTER BY (col)` | clustering via `CALL run_clustering(table => 't')`                | incremental clustering via `'clustering.by'='col'`                    |
| Reclaim old file versions | `CALL system.expire_snapshots('t')`                       | `VACUUM t RETAIN 168 HOURS`                       | handled by the cleaner service (`hoodie.cleaner.*` configs)       | `CALL sys.expire_snapshots(table => 't')`                             |
| Partition evolution       | `ALTER TABLE t ADD PARTITION FIELD days(ts)` (no rewrite) | not supported (must redefine table)               | not supported (must redefine table)                               | not supported (must redefine table)                                   |

---

## 🚀 Getting Started: What Problem These Solve

Plain object storage (S3, GCS, ADLS) is just files — it has no concept of a "table," no transactions, and no way to know what "the current version" of a dataset is. Before these formats existed, the closest thing was the **Hive table format**: a directory of files plus a metastore that tracked directory-to-table mappings, which broke down at scale (listing millions of files to plan a query) and offered no real ACID guarantees.

**Open table formats** (also called "lakehouse formats") solve this by adding a metadata layer on top of plain Parquet/Avro/ORC files that gives you:

- **ACID transactions** — concurrent readers and writers don't see partial/corrupt state
- **Schema evolution** — add, rename, or drop columns without rewriting existing data
- **Time travel** — query the table as it existed at a past version or timestamp
- **Efficient upserts/deletes** — update or remove rows without rewriting the whole table
- **Engine independence** — the same physical table can be read/written by Spark, Flink, Trino, Snowflake, BigQuery, and others

Four formats matter here: **Apache Iceberg** (originated at Netflix), **Delta Lake** (originated at Databricks), **Apache Hudi** (originated at Uber), and **Apache Paimon** (originated at Alibaba, out of the Flink community). The first three dominate the "which format should my warehouse use" conversation; Paimon is the newer, streaming-native answer to a narrower but growing question — see Section 4.

---

## 🏗️ Architecture Comparison

### Apache Iceberg — Hierarchical Metadata Tree

```
metadata.json  (current table state: schema, partition spec, snapshot list)
     │
     ▼
manifest list  (one per snapshot — which manifests make up this snapshot)
     │
     ▼
manifest files  (which data files, plus per-file column stats: min/max, null counts)
     │
     ▼
data files  (Parquet / ORC / Avro)
```

Query planning reads `metadata.json` and the manifests to decide which data files to touch — often in milliseconds, even at petabyte scale — without ever listing directories. This tree structure is also what makes **partition evolution** possible: the partition spec lives in the metadata, not in a physical directory layout, so changing it doesn't require rewriting data.

### Delta Lake — Flat Transaction Log

```
_delta_log/
  00000000000000000000.json   (commit 0: initial schema + files added)
  00000000000000000001.json   (commit 1: files added/removed)
  00000000000000000002.json   (commit 2: ...)
  00000000000000000010.checkpoint.parquet   (periodic checkpoint = replay shortcut)
  ...
data files (Parquet)
```

Every write appends a new JSON commit file describing what changed. To know the table's current state, a reader replays the log forward from the most recent checkpoint. This is simple and works natively wherever the Delta library runs (especially Spark); outside Spark, engines must implement their own log-replay logic, which historically has lagged in feature coverage.

### Apache Hudi — Timeline + Two Table Types

```
.hoodie/
  <instant_time>.commit          (a completed write)
  <instant_time>.commit.requested
  <instant_time>.inflight
  ...  ← the "timeline": every action on the table, in order
```

Hudi's distinguishing architectural choice is offering **two table storage types**:

- **Copy-on-Write (CoW)** — updates rewrite the affected data files entirely. Reads are fast (plain Parquet, no merge step); writes are more expensive.
- **Merge-on-Read (MoR)** — updates are appended to row-based delta log files next to the base Parquet files; a background **compaction** job periodically merges them. Writes are fast; reads pay a merge cost until compaction catches up (or you query the read-optimized view, which skips uncompacted logs).

This CoW/MoR split is why Hudi is generally regarded as the strongest choice for high-frequency streaming upserts and CDC.

### Apache Paimon — LSM-Tree Storage

```
table/
  bucket-0/
    data-<uuid>-0.parquet         (sorted runs, like an LSM level)
    data-<uuid>-1.parquet
    changelog-<uuid>-0.parquet    (optional, if changelog producer enabled)
  bucket-1/
    ...
  snapshot/
    snapshot-1
    snapshot-2  ← current
  schema/
    schema-0
```

Paimon borrows its physical storage design from **LSM-trees** (log-structured merge-trees) — the same family of structure behind RocksDB and HBase — rather than the pure "snapshot of immutable files" model the other three share. Writes land as small sorted files that get merged into larger sorted runs over time via background compaction, which is what lets Paimon absorb very high write throughput without a MoR-style read penalty growing unbounded. Tables are split into **buckets** (a fixed or dynamic hash-partitioning of primary keys), which is Paimon's unit of parallelism for both writes and compaction.

---

## 📊 Feature Comparison

| Feature                  | Apache Iceberg                                                      | Delta Lake                                                    | Apache Hudi                                           | Apache Paimon                                                                                                          |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Governance               | Apache Software Foundation (vendor-neutral)                         | Originated & steered by Databricks                            | Apache Software Foundation                            | Apache Software Foundation                                                                                             |
| Partition evolution      | ✅ Yes — change partitioning without rewrite                        | ❌ No — requires redefining the table                         | ❌ No — requires redefining the table                 | ❌ No — requires redefining the table                                                                                  |
| Hidden partitioning      | ✅ Yes — partition transforms not exposed as columns                | ❌ No                                                         | ❌ No                                                 | ❌ No (uses buckets instead, see below)                                                                                |
| Schema evolution         | ✅ Full (add, drop, rename, reorder, widen)                         | ✅ Add, rename, widen (Delta 2.0+)                            | ✅ Full                                               | ✅ Add, drop, update, rename — no side effects                                                                         |
| Table storage modes      | Copy-on-Write + Merge-on-Read                                       | Copy-on-Write + deletion vectors (soft deletes)               | Copy-on-Write + Merge-on-Read (most mature)           | LSM-tree (CoW, MoR, and MoW w/ deletion vectors)                                                                       |
| Data layout optimization | Sort orders; Z-order via rewrite procedure                          | Z-Ordering, and Liquid Clustering (3.0+)                      | Clustering service                                    | Incremental clustering (z-order/Hilbert)                                                                               |
| Streaming ingestion      | Good, via Flink or structured streaming                             | Good, via Spark Structured Streaming                          | Best-in-class among the original three — built for it | Purpose-built from the ground up for exactly this                                                                      |
| Native CDC               | Via external stream processors                                      | Via external stream processors                                | Native, built into the write path                     | Native — direct CDC ingestion from MySQL/Kafka/MongoDB/Postgres                                                        |
| Update semantics         | MERGE / UPDATE / DELETE statements                                  | MERGE / UPDATE / DELETE statements                            | MERGE / UPDATE / DELETE statements                    | Configurable **merge engines** (dedup, partial-update, aggregation, first-row) applied automatically on plain `INSERT` |
| Time travel              | Snapshot-based (`VERSION`/`TIMESTAMP AS OF`)                        | Transaction-log-based                                         | Timeline/instant-based                                | Snapshot-based (id, timestamp, or named tag)                                                                           |
| Catalog approach         | Open REST Catalog spec (multi-engine)                               | Historically Hive Metastore; now also Unity Catalog           | Hive Metastore, or Hudi's own timeline server         | Filesystem catalog, Hive Metastore, or REST catalog                                                                    |
| Multi-engine support     | Broadest — Spark, Flink, Trino, Snowflake, BigQuery, DuckDB, Athena | Good — best inside Databricks, workable elsewhere via UniForm | Good — Spark, Flink, Trino, Presto                    | Strong on Flink; growing on Spark, Trino, StarRocks, Hive                                                              |
| Best-suited workload     | Multi-engine, multi-cloud lakehouses                                | Databricks-centric batch analytics/ML                         | Streaming/CDC ingestion pipelines                     | Unified streaming + batch, especially Flink-native pipelines                                                           |

---

## 🆕 Apache Paimon: The Streaming-Native Fourth Option

Paimon (formerly "Flink Table Store," donated to the Apache Incubator in 2023 and since graduated) answers a question the original three formats were never quite designed around: _what if streaming writes are the primary workload, not an add-on to a batch-first design?_

### What makes it different in practice

- **Primary-key tables merge automatically.** You don't write `MERGE INTO` — you just `INSERT INTO`, and a configured **merge engine** decides how records with the same key combine:
  - `deduplicate` (default) — keep only the latest record per key
  - `partial-update` — progressively fill in a record's columns across multiple partial writes, without overwriting fields that arrive as `NULL`
  - `aggregation` — apply an aggregate function (sum, count, etc.) per column across records sharing a key
  - `first-row` — keep only the earliest record per key (useful for pure dedup on ingestion)
- **Changelog producers** (`none`, `input`, `lookup`, `full-compaction`) control whether — and how — Paimon emits a complete before/after changelog for downstream streaming consumers, which matters a lot if something else is subscribing to changes on this table.
- **Multimodal ambitions.** Newer Paimon releases position it as a lakehouse for AI workloads too — storing embeddings and metadata alongside structured data, queryable via vector or full-text search in addition to SQL.

### Creating a Primary-Key Table

```sql
-- Flink SQL
CREATE TABLE orders (
  order_id BIGINT,
  customer_id BIGINT,
  amount     DECIMAL(10, 2),
  PRIMARY KEY (order_id) NOT ENFORCED
) WITH (
  'bucket' = '8',
  'merge-engine' = 'partial-update',
  'changelog-producer' = 'lookup'
);

-- Spark SQL — same primary-key concept, expressed as table properties
CREATE TABLE orders (
  order_id    BIGINT,
  customer_id BIGINT,
  amount      DECIMAL(10, 2)
) TBLPROPERTIES (
  'primary-key' = 'order_id',
  'bucket' = '8'
);
```

### Where it fits alongside the other three

Paimon overlaps most with Hudi's territory (streaming upserts, CDC) but takes a different bet: instead of a snapshot-plus-delta-log model bolted onto a batch-first format, it's LSM-native from the ground up, and it treats Flink — not Spark — as the first-class engine. If your pipeline is already Flink-centric, or your workload is dominated by continuous upserts from operational databases via CDC, Paimon is worth evaluating alongside Hudi rather than assuming Hudi by default.

---

## 🔨 Creating Tables

### Apache Iceberg

```sql
CREATE TABLE local.db.orders (
  order_id    BIGINT,
  customer_id BIGINT,
  order_date  DATE,
  amount      DECIMAL(10, 2)
)
USING iceberg
PARTITIONED BY (days(order_date));   -- a "hidden" partition transform, not a plain column
```

### Delta Lake

```sql
CREATE TABLE db.orders (
  order_id    BIGINT,
  customer_id BIGINT,
  order_date  DATE,
  amount      DECIMAL(10, 2)
)
USING delta
PARTITIONED BY (order_date);         -- physical partition column, exposed in the schema
```

### Apache Hudi

```sql
CREATE TABLE db.orders (
  order_id    BIGINT,
  customer_id BIGINT,
  order_date  DATE,
  amount      DECIMAL(10, 2)
)
USING hudi
TBLPROPERTIES (
  type = 'cow',                      -- 'cow' or 'mor'
  primaryKey = 'order_id',           -- required: the upsert key
  preCombineField = 'order_date'     -- required: breaks ties when the same key arrives twice
)
PARTITIONED BY (order_date);
```

### Apache Paimon

```sql
CREATE TABLE db.orders (
  order_id    BIGINT,
  customer_id BIGINT,
  order_date  DATE,
  amount      DECIMAL(10, 2)
) TBLPROPERTIES (
  'primary-key' = 'order_id',
  'bucket' = '8'
)
PARTITIONED BY (order_date);
```

Note the structural difference: **Hudi and Paimon both _require_ declaring a primary key up front**, because upserts are core to their design — Iceberg and Delta don't need this at table-creation time since `MERGE` handles keys per-statement. Paimon additionally requires a **bucket count**, since buckets are its fundamental unit of write parallelism (unlike Hudi/Iceberg/Delta, where parallelism comes from file/partition layout rather than a declared table property).

---

## 🔀 Schema Evolution

```sql
-- Iceberg: full evolution, including reordering and widening types, no data rewrite
ALTER TABLE local.db.orders ADD COLUMN discount DECIMAL(5,2);
ALTER TABLE local.db.orders RENAME COLUMN amount TO order_amount;
ALTER TABLE local.db.orders ALTER COLUMN order_id TYPE BIGINT;   -- safe int -> bigint widen

-- Delta: add/rename/widen; requires enabling column mapping for rename on existing tables
ALTER TABLE db.orders ADD COLUMN discount DECIMAL(5,2);
ALTER TABLE db.orders SET TBLPROPERTIES ('delta.columnMapping.mode' = 'name');
ALTER TABLE db.orders RENAME COLUMN amount TO order_amount;

-- Hudi: full evolution supported, same general ALTER TABLE syntax
ALTER TABLE db.orders ADD COLUMNS (discount DECIMAL(5,2));
ALTER TABLE db.orders RENAME COLUMN amount TO order_amount;

-- Paimon: full evolution, explicitly documented as having "no side effects" —
-- old data files aren't rewritten; the schema registry just tracks the change
ALTER TABLE db.orders ADD COLUMN discount DECIMAL(5,2);
ALTER TABLE db.orders RENAME COLUMN amount TO order_amount;
ALTER TABLE db.orders DROP COLUMN discount;
```

---

## 🗂️ Partitioning Strategies

```sql
-- Iceberg: partition transforms hide the physical layout — query normally, no need to
-- filter on a derived column yourself
CREATE TABLE local.db.events (event_id BIGINT, ts TIMESTAMP, user_id BIGINT)
USING iceberg
PARTITIONED BY (days(ts), bucket(16, user_id));

-- Iceberg's headline feature: evolve partitioning on a live table, no rewrite required
ALTER TABLE local.db.events ADD PARTITION FIELD hours(ts);   -- switch from daily to hourly going forward
ALTER TABLE local.db.events DROP PARTITION FIELD days(ts);

-- Delta: partitioning is a plain physical column, chosen once at CREATE TABLE time
CREATE TABLE db.events (event_id BIGINT, ts TIMESTAMP, event_date DATE, user_id BIGINT)
USING delta
PARTITIONED BY (event_date);
-- To repartition, you must rewrite the table — or use Liquid Clustering instead of static
-- partitioning from the start, which sidesteps this entirely:
CREATE TABLE db.events_v2 (event_id BIGINT, ts TIMESTAMP, user_id BIGINT)
USING delta
CLUSTER BY (user_id);

-- Hudi: partition path is set at table creation and baked into the physical layout,
-- same rewrite-to-change limitation as Delta's static partitioning
CREATE TABLE db.events (event_id BIGINT, ts TIMESTAMP, event_date STRING, user_id BIGINT)
USING hudi
TBLPROPERTIES (type = 'cow', primaryKey = 'event_id', preCombineField = 'ts')
PARTITIONED BY (event_date);

-- Paimon: partitioning works like Hive (a physical directory column), and is combined
-- with bucketing *within* each partition for write parallelism
CREATE TABLE db.events (event_id BIGINT, ts TIMESTAMP, event_date DATE, user_id BIGINT)
TBLPROPERTIES ('primary-key' = 'event_id,event_date', 'bucket' = '16')
PARTITIONED BY (event_date);
```

**Partitioning vs. bucketing, briefly:** partitioning splits a table into physically separate directories a query can skip entirely; bucketing (Iceberg's `bucket()` transform, or Paimon's `bucket` table property) hashes rows into a fixed number of files _within_ a partition, mainly to bound file count and parallelize writes — the two solve different problems and are often combined.

---

## ✍️ Upserts, Deletes & MERGE (CDC)

`MERGE INTO` syntax is nearly identical across Iceberg, Delta, and Hudi — this is one of the more genuinely interoperable corners of the ecosystem.

```sql
-- Works the same way on Iceberg, Delta, and Hudi tables
MERGE INTO orders AS target
USING orders_updates AS source
ON target.order_id = source.order_id
WHEN MATCHED AND source.is_deleted = true THEN DELETE
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *;
```

```sql
-- Plain DELETE and UPDATE are also supported directly on all three
DELETE FROM orders WHERE order_date < '2020-01-01';
UPDATE orders SET amount = amount * 1.1 WHERE customer_id = 42;
```

The difference shows up in _how_ each format executes this under the hood:

- **Iceberg** — copy-on-write rewrites affected data files; merge-on-read writes lightweight delete files that get reconciled at read time or during compaction.
- **Delta** — copy-on-write by default; **deletion vectors** (Delta 3.0+) let it mark rows deleted without a full file rewrite, closing much of the gap with merge-on-read formats.
- **Hudi** — this is Hudi's home turf: MoR tables append changed _columns_ to compact delta log files rather than rewriting full rows, which is why Hudi tends to lead write-heavy upsert benchmarks.

**Paimon is genuinely different here** — it deliberately avoids requiring `MERGE INTO` for the common case:

```sql
-- Paimon: a plain INSERT INTO a primary-key table triggers automatic merging,
-- according to whatever merge-engine the table was created with
INSERT INTO db.customers VALUES (101, 'alice@example.com', NULL, 'gold');
-- If the table's merge-engine is 'partial-update', a second write with only
-- some columns populated fills in just those fields on the existing record —
-- no explicit MERGE statement, no join condition to write

-- Paimon does still support MERGE INTO and batch DELETE/UPDATE for append tables
-- (tables without a declared primary key) or explicit conditional logic
MERGE INTO db.orders AS target
USING order_updates AS source
ON target.order_id = source.order_id
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *;
```

---

## 🕰️ Time Travel & Versioning

```sql
-- Iceberg
SELECT * FROM local.db.orders TIMESTAMP AS OF '2024-01-15 00:00:00';
SELECT * FROM local.db.orders VERSION AS OF 8945729384;
SELECT * FROM local.db.orders.history;              -- list all snapshots
SELECT * FROM local.db.orders.snapshots;

-- Delta
SELECT * FROM db.orders TIMESTAMP AS OF '2024-01-15';
SELECT * FROM db.orders VERSION AS OF 12;
DESCRIBE HISTORY db.orders;                          -- list all commits

-- Hudi — versions are addressed by "instant time" (a commit timestamp string),
-- not a simple incrementing integer
SELECT * FROM db.orders TIMESTAMP AS OF '2024-01-15 00:00:00';
SELECT * FROM db.orders TIMESTAMP AS OF '20240115000000';   -- Hudi's native instant format
CALL show_commits(table => 'db.orders', limit => 10);

-- Paimon: snapshot-based like Iceberg, plus first-class named tags (like a git tag)
-- for pinning a specific snapshot with a human-readable name
SELECT * FROM db.orders TIMESTAMP AS OF '2024-01-15 00:00:00';
SELECT * FROM db.orders VERSION AS OF 12;
CALL sys.create_tag(table => 'db.orders', tag => 'pre_migration', snapshot_id => 12);
SELECT * FROM db.orders VERSION AS OF 'pre_migration';
SELECT * FROM db.orders$snapshots;                   -- list all snapshots via a system table
```

---

## 🧹 Compaction & File Maintenance

Every format accumulates small files over time from frequent writes, and all four need periodic maintenance to keep read performance from degrading.

```sql
-- Iceberg: compact small data files, and expire old snapshots to reclaim storage
CALL local.system.rewrite_data_files(table => 'db.orders');
CALL local.system.expire_snapshots(table => 'db.orders', older_than => TIMESTAMP '2024-01-01 00:00:00');
CALL local.system.remove_orphan_files(table => 'db.orders');   -- clean up files not tracked by any snapshot

-- Delta: OPTIMIZE compacts files (optionally with Z-order or Liquid Clustering layout),
-- VACUUM removes files no longer referenced by the log
OPTIMIZE db.orders ZORDER BY (customer_id);
VACUUM db.orders RETAIN 168 HOURS;    -- default retention is 7 days; going lower risks breaking time travel

-- Hudi: compaction only matters for MoR tables (merges delta logs into base files);
-- the cleaner service separately reclaims old file versions
CALL run_compaction(op => 'run', table => 'db.orders');
CALL run_clustering(table => 'db.orders');

-- Paimon: compaction is the mechanism that merges LSM sorted runs, so it's more
-- central to normal operation here than "maintenance" in the other formats — many
-- production setups run it as a continuous background service, not a periodic job
CALL sys.compact(table => 'db.orders');
CALL sys.expire_snapshots(table => 'db.orders', older_than => '2024-01-01 00:00:00');
```

**Rule of thumb:** none of these formats are "self-maintaining" out of the box — skip compaction on a busy table and query performance degrades within weeks as small files pile up, regardless of which format you picked. Paimon is the partial exception: because compaction merges LSM levels rather than just tidying up small files, it's often run as a dedicated continuous job rather than a scheduled maintenance task.

---

## 📚 Catalogs

The catalog is what turns a folder of metadata files into something query engines can discover by name. This has become the more consequential choice in 2026 than the table format itself, since it determines how locked-in you actually are.

```sql
-- Iceberg supports several catalog implementations, chosen via Spark config:
-- Hive Metastore
SET spark.sql.catalog.local = org.apache.iceberg.spark.SparkCatalog;
SET spark.sql.catalog.local.type = hive;

-- AWS Glue
SET spark.sql.catalog.local.catalog-impl = org.apache.iceberg.aws.glue.GlueCatalog;

-- REST Catalog (open spec — implemented by Apache Polaris, Nessie, Lakekeeper, Tabular, and others)
SET spark.sql.catalog.local.catalog-impl = org.apache.iceberg.rest.RESTCatalog;
SET spark.sql.catalog.local.uri = 'https://catalog.example.com';
```

- **Iceberg** is built around an open **REST Catalog specification** — any engine, in any language, can talk to any REST-compliant catalog without importing a specific runtime. **Apache Polaris** (a vendor-neutral implementation, graduated to a top-level Apache project in 2026) is the reference example.
- **Delta Lake** has historically leaned on the **Hive Metastore**, with **Unity Catalog** (Databricks' governance layer) now the primary path for cross-workspace/cross-engine access.
- **Hudi** works with the Hive Metastore or its own lightweight timeline server for metadata sync.
- **Paimon** supports a plain filesystem catalog (no external service at all — the catalog _is_ a directory layout), the Hive Metastore, or a REST catalog — the filesystem catalog option makes it notably easy to get started without standing up any metastore infrastructure first.

---

## 🌊 Streaming Ingestion

```python
# Delta: Spark Structured Streaming writes directly with checkpointing
(streaming_df.writeStream
    .format("delta")
    .option("checkpointLocation", "/chk/orders")
    .outputMode("append")
    .toTable("db.orders"))
```

```python
# Hudi: purpose-built HoodieStreamer (formerly DeltaStreamer) ingests continuously
# from Kafka/other sources directly into a Hudi table with upsert semantics
spark-submit --class org.apache.hudi.utilities.streamer.HoodieStreamer \
  hudi-utilities-bundle.jar \
  --table-type MERGE_ON_READ \
  --source-class org.apache.hudi.utilities.sources.JsonKafkaSource \
  --target-table db.orders
```

```python
# Iceberg: streaming ingestion is typically via Flink's Iceberg sink, or Spark
# Structured Streaming writing Iceberg tables the same way as any other sink
(streaming_df.writeStream
    .format("iceberg")
    .option("checkpointLocation", "/chk/orders")
    .toTable("local.db.orders"))
```

```sql
-- Paimon: CDC ingestion is a first-class, declarative feature — no custom streaming
-- job to write, just point a built-in synchronization action at a source database
-- (this is a CLI action, not SQL, but shown here for comparison)
<FLINK_HOME>/bin/flink run \
  paimon-flink-action.jar mysql-sync-table \
  --warehouse s3://my-bucket/warehouse \
  --database db --table orders \
  --mysql-conf hostname=mysql-host --mysql-conf username=root \
  --mysql-conf database-name=source_db --mysql-conf table-name=orders \
  --primary-keys order_id
```

Paimon's CDC synchronization tools cover MySQL, Kafka, MongoDB, Pulsar, and PostgreSQL out of the box, with schema evolution propagated automatically as the source schema changes — this built-in tooling is the biggest practical difference from the "wire up your own Debezium + Kafka + streaming job" pattern the other three generally require.

---

## 🔄 Interoperability Between Formats

You don't always have to pick one format forever — a set of translation layers has emerged specifically to reduce lock-in risk:

- **Apache XTable** (formerly Onehouse's OneTable) — an open-source project that translates table _metadata_ between Iceberg, Delta, and Hudi, so the same physical Parquet files can be read as any of the three, without duplicating data.
- **Delta UniForm** — Databricks' built-in answer to the same problem: a Delta table can simultaneously expose Iceberg-compatible metadata, so Iceberg-only engines (Trino, Snowflake, Athena) can read it without a separate sync job.
- **Iceberg REST Catalog compatibility layers** — some catalogs (e.g., manifest sidecars) let non-Iceberg engines read Iceberg tables with reduced feature support.
- **Paimon ↔ Iceberg/Hive compatibility** — Paimon can expose an Iceberg-compatible metadata view for its tables (a narrower, one-directional version of what UniForm does for Delta), and its "format table" mode reads/writes plain Hive-style directories directly.

These are genuinely useful for de-risking a format choice, but every source that's benchmarked them agrees on the caveat: compatibility layers are functional, not first-class — expect a feature or performance gap versus reading a table in its native format with its native engine.

---

## 🔌 Query Engine Support

| Engine            |        Iceberg        |          Delta Lake           |    Hudi     |                    Paimon                    |
| ----------------- | :-------------------: | :---------------------------: | :---------: | :------------------------------------------: |
| Apache Spark      |          ✅           |          ✅ (native)          |     ✅      |                      ✅                      |
| Apache Flink      |      ✅ (strong)      |            Limited            | ✅ (strong) | ✅ (native — this is Paimon's origin engine) |
| Trino / Presto    |          ✅           |              ✅               |     ✅      |                 ✅ (growing)                 |
| Snowflake         |  ✅ (native tables)   |          via UniForm          |   Limited   |                   Limited                    |
| Google BigQuery   |     ✅ (BigLake)      |          via UniForm          |   Limited   |                Not yet common                |
| Databricks        | ✅ (via UniForm read) | ✅ (native, best performance) |   Limited   |                Not yet common                |
| AWS Athena        |          ✅           |              ✅               |     ✅      |                   Limited                    |
| DuckDB            |          ✅           |              ✅               |   Limited   |                   Limited                    |
| StarRocks / Doris |          ✅           |              ✅               |     ✅      | ✅ (strong — frequently paired with Paimon)  |

Engine support shifts quickly in this space — treat this table as directionally accurate rather than a permanent reference, and check each engine's current docs before committing to a combination.

---

## 🔬 Internals Deep Dive

A closer look at the mechanisms behind the headline features, for when "it just works" isn't enough context to debug a production issue.

### Deletion vectors (Delta, and Iceberg's V3 spec)

Instead of rewriting a whole Parquet file to remove or hide a handful of rows, a deletion vector is a small side file (or embedded bitmap) recording _which row positions in a data file are logically deleted_. Readers apply the vector at scan time, filtering out those rows without the writer ever touching the original file. This gets copy-on-write formats most of the write-amplification benefit of merge-on-read, without adopting a full MoR architecture. Delta introduced this in 3.0; the **Iceberg V3 table spec** (finalized and rolling out through 2025-2026) added equivalent deletion vector support, moving Iceberg's default delete strategy away from the older positional/equality delete files it used previously.

### Iceberg's Puffin file format

Puffin is Iceberg's format for storing statistics and index structures that don't fit neatly into the columnar min/max stats already in manifest files — most notably **theta sketches** for approximate distinct-value counts, used to give query planners better cardinality estimates without a full scan. It's a generic, extensible container, so it's also become the vehicle for newer additions like the deletion vector bitmaps mentioned above.

### Manifest rewriting

Over time, an Iceberg table can accumulate many small manifest files (one is typically written per commit), which slows query planning the same way small data files slow query execution. `rewrite_manifests` consolidates them:

```sql
CALL local.system.rewrite_manifests(table => 'db.orders');
```

This is a metadata-only operation — it doesn't touch data files — and is worth running periodically on any table with frequent small commits (e.g., a streaming sink writing every few minutes).

### Hudi's indexing options

Hudi's upsert performance depends heavily on how fast it can answer "which file currently holds the row for this key?" — that's what its **index** does, and it's configurable per table:

- **Bloom index** (default) — a Bloom filter per file, cheap and works well for most workloads, with a small false-positive rate that costs a bit of extra I/O.
- **Simple index** — a straightforward join against existing records; no filter, more predictable but pricier at scale.
- **Bucket index** — hashes keys to a fixed set of buckets (conceptually similar to Paimon's bucketing), trading some flexibility for very fast, deterministic lookups.
- **Record-level index** — a dedicated, persisted index structure (introduced to close the gap with database-style indexing), giving near-constant-time lookups even on very large tables.

### Row lineage (Iceberg V3)

The V3 spec also introduces stable **row IDs** that persist across compaction and rewrite operations — previously, a row's identity was tied to its file and position, which changed whenever a file was rewritten. Stable row lineage is what makes efficient, provable CDC feeds possible directly from table history, rather than needing to diff snapshots yourself.

### Paimon's LSM compaction levels

Like other LSM-tree systems, Paimon organizes files within a bucket into sorted "levels," where new writes land in the lowest level and background compaction merges them upward into progressively larger, more consolidated sorted runs. This is why Paimon can sustain very high write throughput: writes are cheap appends to the lowest level, and the more expensive merge work happens asynchronously in the background rather than on the write's critical path.

---

## 🐍 PySpark / DataFrame API Reference

SQL isn't the only interface — all four formats have first-class (if slightly uneven) PySpark DataFrame support.

```python
# Reading a table, all four formats
df_iceberg = spark.read.format("iceberg").load("local.db.orders")
df_delta   = spark.read.format("delta").load("/path/to/orders")          # or spark.table("db.orders")
df_hudi    = spark.read.format("hudi").load("/path/to/orders")
df_paimon  = spark.read.format("paimon").load("/path/to/orders")

# Time travel via DataFrame options
spark.read.format("iceberg").option("as-of-timestamp", "1704067200000").load("local.db.orders")
spark.read.format("delta").option("versionAsOf", "12").load("/path/to/orders")
spark.read.format("hudi").option("as.of.instant", "20240115000000").load("/path/to/orders")
spark.read.format("paimon").option("scan.snapshot-id", "12").load("/path/to/orders")

# Writing / appending
df.write.format("iceberg").mode("append").save("local.db.orders")
df.write.format("delta").mode("append").saveAsTable("db.orders")
df.write.format("hudi").options(**hudi_write_options).mode("append").save("/path/to/orders")
df.write.format("paimon").mode("append").save("/path/to/orders")

# Hudi needs its key config passed explicitly on every write, since the DataFrame
# writer doesn't read table metadata the way SQL MERGE does
hudi_write_options = {
    "hoodie.table.name": "orders",
    "hoodie.datasource.write.recordkey.field": "order_id",
    "hoodie.datasource.write.precombine.field": "order_date",
    "hoodie.datasource.write.operation": "upsert",
}

# Delta's Python-native merge builder (equivalent to SQL MERGE INTO)
from delta.tables import DeltaTable
target = DeltaTable.forName(spark, "db.orders")
(target.alias("t")
    .merge(source_df.alias("s"), "t.order_id = s.order_id")
    .whenMatchedUpdateAll()
    .whenNotMatchedInsertAll()
    .execute())

# Iceberg's Python-native merge builder works the same shape via PyIceberg
from pyiceberg.catalog import load_catalog
catalog = load_catalog("local")
table = catalog.load_table("db.orders")
# PyIceberg's upsert API (added in recent releases) wraps an equivalent
# insert/update/delete plan under the hood: table.upsert(df, join_cols=["order_id"])
```

---

## 🔐 Security & Governance

Table-format choice increasingly determines _which_ access-control model you inherit, not just how data is physically stored.

| Capability                     | Iceberg                                                                                                    | Delta Lake                                                       | Hudi                                     | Paimon                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| Row-level security             | Via catalog (Polaris/Lake Formation policies)                                                              | Via Unity Catalog row filters                                    | Via engine-level policies (e.g., Ranger) | Via catalog / engine-level policies     |
| Column-level security          | Via catalog policy tags                                                                                    | Via Unity Catalog column masks                                   | Via engine-level policies (e.g., Ranger) | Via catalog / engine-level policies     |
| Encryption at rest             | Handled by underlying object storage (SSE-S3/KMS) — plus optional Iceberg-native encryption in newer specs | Handled by underlying object storage, or Databricks-managed keys | Handled by underlying object storage     | Handled by underlying object storage    |
| Fine-grained audit logging     | Via catalog (varies by implementation)                                                                     | Unity Catalog audit logs                                         | Via engine/metastore audit logs          | Via catalog / engine audit logs         |
| Cross-engine consistent policy | Only if all engines share the same REST catalog                                                            | Only within Unity Catalog-governed engines                       | Not standardized — typically per-engine  | Not standardized — typically per-engine |

The practical takeaway: **the catalog is where governance actually lives**, not the table format itself. Two engines reading the same Iceberg table through _different_ catalogs can end up enforcing completely different access policies — which is exactly the kind of gap a unified catalog (Polaris, Unity Catalog, or a Lake Formation-fronted Glue catalog) exists to close. If consistent, cross-engine security policy is a hard requirement, weight the catalog decision at least as heavily as the table-format decision.

---

## 🏛️ Real-World Architecture Patterns

### Medallion Architecture (Bronze → Silver → Gold)

The dominant organizing pattern regardless of which format you pick — layers by increasing refinement, not by format:

```
Bronze (raw)              Silver (cleaned/conformed)         Gold (business-ready)
┌──────────────────┐     ┌──────────────────────────┐       ┌────────────────────┐
│ Raw CDC/events,    │────▶│ Deduplicated, typed,       │──────▶│ Aggregated,          │
│ append-only,       │     │ joined against dimension   │       │ denormalized,        │
│ schema-on-read     │     │ tables, quality-checked    │       │ BI-ready tables/views│
└──────────────────┘     └──────────────────────────┘       └────────────────────┘
```

- **Bronze** tables are typically append-only — Iceberg or Delta with minimal transformation, or a Paimon append table if the source is a raw event stream.
- **Silver** is where `MERGE`/upsert logic lives — deduplication, late-arriving data handling, schema conformance. This is the layer where Hudi's or Paimon's native merge handling saves the most engineering effort if the workload is CDC-heavy.
- **Gold** tables are often materialized views or scheduled-query outputs, optimized for the specific BI/ML consumption pattern rather than for further transformation.

### Streaming Lakehouse (CDC-to-Analytics, Minimal Latency)

```
Operational DB → Debezium/CDC connector → Kafka → Flink/Spark streaming job → Lakehouse table (Silver)
                                                                                        │
                                                                          BI tools / reverse ETL / ML
```

Hudi and Paimon are the two formats explicitly designed around this end-to-end shape — both offer built-in tooling (`HoodieStreamer`, Paimon's CDC sync actions) that removes a substantial amount of custom streaming-job code compared to hand-rolling the same pipeline against Iceberg or Delta.

### Multi-Engine Lakehouse (Format Chosen for Portability, Not a Single Engine)

```
                          ┌──────────────┐
                          │ REST Catalog   │  (Polaris / Nessie / Lakekeeper)
                          └──────┬───────┘
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
        ┌──────────┐       ┌──────────┐       ┌──────────┐
        │  Spark    │       │  Trino    │       │ Snowflake │   — all reading/writing
        │ (ingest)  │       │ (ad-hoc)  │       │  (BI)     │     the same Iceberg tables
        └──────────┘       └──────────┘       └──────────┘
```

This is the pattern Iceberg's design most directly targets: one physical copy of the data, one catalog, many engines each doing the part of the workload they're best at — no per-engine data copies, no separate sync jobs.

---

## 🛠️ Troubleshooting & Common Errors

| Symptom                                                                       | Likely cause                                                                                                 | Fix                                                                                                                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Query planning gets slower over time on an otherwise-stable table             | Manifest (Iceberg) or log/checkpoint (Delta) file sprawl from frequent small commits                         | Run `rewrite_manifests` (Iceberg) or ensure checkpoint frequency is reasonable (Delta); batch small writes upstream if possible                                                         |
| `Cannot time travel to version X — file not found`                            | Retention/vacuum already removed the underlying files for that version                                       | Time travel is bounded by retention settings (`VACUUM ... RETAIN`, Iceberg's `expire_snapshots`) — the version genuinely no longer exists                                               |
| Slow reads on a Hudi MoR table right after a burst of writes                  | Compaction hasn't caught up — reads are paying the merge cost live                                           | Trigger `run_compaction` manually, or tune `hoodie.compact.inline`/scheduling to run more frequently                                                                                    |
| Concurrent writer conflict / `ConcurrentModificationException`                | Two writers targeting overlapping partitions/files at the same time                                          | Most formats support optimistic concurrency with automatic retry for non-overlapping writes — for true overlapping writes, serialize them or partition the workload to avoid contention |
| Schema mismatch error on a Paimon `INSERT` with a partial-update merge engine | The write includes columns not part of the declared schema, or a type mismatch                               | Confirm the write's schema exactly matches the table (Paimon evolution requires an explicit `ALTER TABLE`, it won't silently absorb new columns)                                        |
| Non-Iceberg engine can't see a table written natively via Delta UniForm       | UniForm sync hasn't run yet, or the target engine's Iceberg reader doesn't support a feature UniForm exposed | Check UniForm's Iceberg-compatibility sync status; confirm the reading engine's Iceberg support level covers what's needed                                                              |
| `bucket count mismatch` error on a Paimon or Hudi bucket-indexed table        | Attempting to change the bucket count on an existing table                                                   | Bucket count is fixed at table creation for bucket-indexed tables in both formats — changing it requires rebuilding the table                                                           |

---

## 🧭 Choosing a Format

```
Are you (and will you stay) 100% inside Databricks?
├── Yes → Delta Lake. Liquid Clustering, deletion vectors, and predictive
│         optimization give a genuine 15-30% throughput edge on Databricks'
│         own runtime — but that edge evaporates the moment another engine
│         needs to read the same tables.
│
└── No, or "probably not forever" →
    Is the workload dominated by high-frequency streaming upserts / CDC?
    ├── Yes → Is the pipeline Flink-centric, or do you want merge behavior
    │         (dedup/partial-update/aggregation) without writing MERGE
    │         statements by hand?
    │         ├── Yes → Apache Paimon. Built LSM-native for exactly this;
    │         │         first-class CDC sync tooling from MySQL/Kafka/Mongo/Postgres.
    │         └── No / Spark-centric, or need the most battle-tested option →
    │                   Apache Hudi. Purpose-built for streaming upserts, native CDC
    │                   support, mature indexing options (bloom/bucket/record-level).
    │
    └── No / general-purpose, multi-engine analytics →
        Apache Iceberg. The vendor-neutral default in 2026: broadest engine
        support, partition evolution, and an open REST catalog spec mean
        you're not locked into any one vendor's roadmap.
```

A pragmatic middle path many teams take: **land data as Iceberg by default**, and reach for Delta, Hudi, or Paimon only when a specific workload (Databricks-only batch/ML, high-velocity CDC, or a Flink-native streaming pipeline) clearly benefits from it — using XTable or UniForm to keep the option to read cross-format open.

---

## 💡 Gotchas & Best Practices

- **`LIMIT` doesn't limit what gets scanned for cost purposes on any of these formats** the way people sometimes assume — query engines still plan against full metadata/manifest structures; the limit only trims the final result set.
- **Don't skip compaction.** All four formats will silently accumulate small files under frequent writes; left unmanaged, query planning time and read latency both degrade — this isn't a "pick the right format and avoid it" problem, it's an operational one regardless of format. Paimon's is closer to a required background service than an occasional maintenance job.
- **Hudi's and Paimon's required primary key at table creation is a one-way door** — changing the upsert key later generally means rebuilding the table, unlike Iceberg/Delta where MERGE keys are just a per-statement join condition.
- **Delta's `VACUUM` with a short retention window can silently break time travel** — any snapshot older than your retention period becomes unreadable; the 7-day default exists for a reason, and lowering it trades time-travel depth for storage cost. The same trade-off applies to Iceberg's `expire_snapshots` and Paimon's snapshot expiration.
- **Iceberg's partition evolution only affects new data going forward** — existing data files keep their original partition layout; old and new partition specs coexist in the same table (this is by design, but surprises people expecting an implicit rewrite).
- **Paimon's merge engines are a table-wide setting, not a per-write choice.** Picking `partial-update` means _every_ write to that table follows partial-update semantics — mixing merge strategies within one table isn't supported, so plan the merge engine around the table's actual update pattern up front.
- **"Multi-engine support" claims should be verified per-feature, not just per-engine.** An engine listed as supporting a format often means basic read/write — partition evolution, deletion vectors, or MoR log-file reads are frequently the last features a given engine implements, and current parity varies by engine version.
- **A compatibility layer (XTable, UniForm) is not the same as native support.** Treat it as a bridge for gradual migration or occasional cross-engine reads, not as a permanent architecture if performance on the secondary engine actually matters.
- **Bucket count is a hard commitment in bucket-indexed tables** (Paimon's `bucket` property, Hudi's bucket index) — under- or over-provisioning it early is much cheaper to fix than discovering the mismatch after the table is large.

---

## 📋 Common Patterns

### CDC Ingestion Pipeline (Hudi-flavored)

```sql
-- 1. Land raw CDC events from Kafka/Debezium into a staging table
-- 2. MERGE into the target Hudi table, using the CDC op type to route inserts/updates/deletes
MERGE INTO db.customers AS target
USING cdc_staging AS source
ON target.customer_id = source.customer_id
WHEN MATCHED AND source.op = 'd' THEN DELETE
WHEN MATCHED AND source.op = 'u' THEN UPDATE SET *
WHEN NOT MATCHED AND source.op = 'c' THEN INSERT *;
```

### CDC Ingestion Pipeline (Paimon-flavored — no custom job at all)

```bash
# The entire "pipeline" is a single declarative action pointed at the source database;
# Paimon handles the initial snapshot, ongoing binlog consumption, and schema evolution
<FLINK_HOME>/bin/flink run \
  paimon-flink-action.jar mysql-sync-table \
  --warehouse s3://my-bucket/warehouse \
  --database db --table customers \
  --mysql-conf hostname=mysql-host --mysql-conf database-name=source_db \
  --mysql-conf table-name=customers --primary-keys customer_id
```

### Multi-Engine Lakehouse (Iceberg-flavored)

```sql
-- Written once from Spark...
CREATE TABLE catalog.analytics.events (...) USING iceberg PARTITIONED BY (days(ts));
INSERT INTO catalog.analytics.events SELECT ... FROM raw_events;

-- ...read natively from Trino, Snowflake, and BigQuery without any export/copy step,
-- because they're all talking to the same REST catalog and the same underlying files
```

### Slowly Changing Dimension (Type 2) via MERGE — works on Iceberg, Delta, or Hudi

```sql
MERGE INTO dim_customer AS target
USING customer_updates AS source
ON target.customer_id = source.customer_id AND target.is_current = true
WHEN MATCHED AND (target.address != source.address OR target.tier != source.tier) THEN
  UPDATE SET target.is_current = false, target.end_date = current_date()
WHEN NOT MATCHED THEN
  INSERT (customer_id, address, tier, start_date, end_date, is_current)
  VALUES (source.customer_id, source.address, source.tier, current_date(), NULL, true);
```

### Real-Time Feature Store (Paimon's partial-update engine)

```sql
-- Different upstream jobs each contribute a subset of a feature vector's columns;
-- Paimon's partial-update merge engine assembles the complete row automatically,
-- with no coordination needed between the jobs writing each piece
CREATE TABLE feature_store.user_features (
  user_id           BIGINT,
  purchase_count_7d INT,
  last_login_ts     TIMESTAMP,
  churn_score       DOUBLE
) TBLPROPERTIES (
  'primary-key' = 'user_id',
  'merge-engine' = 'partial-update',
  'bucket' = '32'
);

-- Job A writes only purchase_count_7d, Job B writes only churn_score —
-- both target the same user_id, and Paimon merges them into one complete record
INSERT INTO feature_store.user_features (user_id, purchase_count_7d) VALUES (101, 4);
INSERT INTO feature_store.user_features (user_id, churn_score) VALUES (101, 0.12);
```
