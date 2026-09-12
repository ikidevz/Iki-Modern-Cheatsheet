# Ingestion, ETL & DLT (Lakeflow) Cheatsheet

> Getting data in, transforming it reliably, and the medallion architecture that ties it all together — now with CDC patterns, testing, and cloud-specific ingestion setup.

---

## 1. The Medallion Architecture

```
   RAW SOURCES              BRONZE                 SILVER                  GOLD
┌───────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ Files, APIs,   │──▶│ Raw ingest,      │──▶│ Cleaned, deduped,│──▶│ Aggregated,      │
│ Kafka, DBs     │   │ as-is + metadata │   │ conformed schema │   │ business-ready   │
└───────────────┘   └──────────────────┘   └──────────────────┘   └──────────────────┘
                       "what happened"        "what's true"          "what matters"
```

| Layer | Purpose | Typical operations |
|-------|---------|---------------------|
| **Bronze** | Immutable landing zone, exact copy + ingest metadata (source file, ingest timestamp) | Auto Loader / COPY INTO / Lakeflow Connect, minimal transformation, no filtering |
| **Silver** | Validated, deduplicated, joined, conformed types, business keys resolved | Data quality checks, joins, dedup, type casting, `MERGE`/`apply_changes` |
| **Gold** | Aggregated, denormalized for consumption; often one table per BI use case | Aggregations, business logic, star-schema marts, feature tables |

**Why keep Bronze immutable and separate from Silver?** If a downstream transformation bug is discovered, you can **replay Bronze** to rebuild Silver/Gold correctly, without re-extracting from the (possibly unavailable, rate-limited, or since-changed) original source system. Bronze is your system-of-record for "what did we actually receive."

---

## 2. Ingestion Options Compared

| Method | Best for | Notes |
|--------|----------|-------|
| **Auto Loader** (`cloudFiles`) | Continuous/incremental file ingestion from cloud storage | Scalable file discovery, schema inference & evolution, exactly-once, handles millions of files |
| **COPY INTO** | Simple, idempotent, SQL-based batch loads | Good for scheduled batch jobs on relatively low file volumes; simpler mental model than streaming |
| **Lakeflow Connect** | Managed ingestion from SaaS apps/databases (Salesforce, Workday, SQL Server, PostgreSQL, etc.) | No-code/low-code managed connectors, handles CDC from source databases automatically |
| **Structured Streaming** (Kafka/Kinesis/Event Hubs/Pub-Sub) | Real-time event streams | Native streaming sources, full control over watermarking/state |
| **JDBC / `spark.read`** | One-off or small relational pulls | Not ideal for large incremental loads — no built-in incremental/CDC tracking |
| **Delta Sharing** | Consuming data shared by another org/platform without copying | Zero-copy, cross-platform, no ingestion pipeline needed at all |

---

## 3. Auto Loader Deep Dive

```python
df = (spark.readStream
      .format("cloudFiles")
      .option("cloudFiles.format", "json")
      .option("cloudFiles.schemaLocation", "/mnt/schemas/events")
      .option("cloudFiles.inferColumnTypes", "true")
      .option("cloudFiles.schemaEvolutionMode", "addNewColumns")
      .load("/mnt/raw/events"))

(df.writeStream
   .option("checkpointLocation", "/mnt/checkpoints/events")
   .trigger(availableNow=True)          # process all available data then stop
   .toTable("bronze.events"))
```

| Option | Purpose |
|--------|---------|
| `cloudFiles.format` | Source file format (json, csv, parquet, avro, text, binaryFile...) |
| `cloudFiles.schemaLocation` | Where inferred/evolved schema is tracked between runs |
| `cloudFiles.useNotifications` | Use cloud-native file notifications (S3 event notifications via SQS, Azure Event Grid, GCS Pub/Sub) instead of directory listing — scales to millions of files without repeatedly listing the whole path |
| `cloudFiles.schemaEvolutionMode` | `addNewColumns` (default, fails current batch then adds column), `rescue` (routes unexpected fields to `_rescued_data`), `failOnNewColumns`, `none` |
| `cloudFiles.maxFilesPerTrigger` / `cloudFiles.maxBytesPerTrigger` | Rate-limit files/bytes processed per micro-batch |
| `cloudFiles.partitionColumns` | Infer Hive-style partition columns from the file path |
| `cloudFiles.rescuedDataColumn` | Captures fields that don't match the expected schema instead of dropping/failing |

### Two File Discovery Modes
| Mode | How it works | When to use |
|------|--------------|-------------|
| **Directory listing** (default) | Periodically lists the target directory to find new files | Simple setup, fine for low-to-moderate file volume/directory sizes |
| **File notifications** | Subscribes to cloud storage event notifications (auto-sets up SQS/Event Grid/Pub-Sub under the hood) | Required at high file volume/deep directory trees — avoids expensive repeated listing |

**Trigger modes:**
```python
.trigger(processingTime="30 seconds")   # micro-batch interval
.trigger(availableNow=True)             # batch-like: drain all currently available data then stop (preferred for scheduled/batch-style jobs)
.trigger(once=True)                     # deprecated single-batch mode, prefer availableNow
.trigger(continuous="1 second")         # low-latency experimental mode, limited operator support
```

### Handling Malformed Records
```python
.option("cloudFiles.rescuedDataColumn", "_rescued_data")
```
Fields that don't match the inferred schema (extra columns, type mismatches) land in a JSON string column instead of silently being dropped or crashing the pipeline — inspect this column periodically to catch upstream schema drift early.

---

## 4. COPY INTO (Simple SQL Ingestion)

```sql
COPY INTO my_catalog.bronze.orders
FROM '/mnt/raw/orders/'
FILEFORMAT = CSV
FORMAT_OPTIONS ('header' = 'true', 'inferSchema' = 'true')
COPY_OPTIONS ('mergeSchema' = 'true', 'force' = 'false');
```
- **Idempotent**: Delta tracks which source files have already been loaded (via metadata in the transaction log) and automatically skips them on re-run — safe to schedule the same `COPY INTO` repeatedly.
- Good fit for scheduled batch jobs with a moderate (not huge) number of files; for very high file counts, Auto Loader's notification mode scales better.
- `force = true` re-loads files even if already ingested — use only for deliberate backfills.

---

## 5. Lakeflow Declarative Pipelines (formerly Delta Live Tables / DLT)

A **declarative** framework: you describe the *what* (target tables and their SQL/Python logic), Databricks handles the *how* (task orchestration, retries, cluster management, incremental processing, dependency resolution).

```python
import dlt
from pyspark.sql.functions import col

@dlt.table(comment="Raw bronze ingestion of orders")
def bronze_orders():
    return (spark.readStream.format("cloudFiles")
            .option("cloudFiles.format", "json")
            .load("/mnt/raw/orders"))

@dlt.table
@dlt.expect_or_drop("valid_amount", "amount > 0")
@dlt.expect("has_customer", "customer_id IS NOT NULL")
def silver_orders():
    return dlt.read_stream("bronze_orders").withColumn("amount", col("amount").cast("decimal(10,2)"))

@dlt.table
def gold_daily_revenue():
    return (dlt.read("silver_orders")
            .groupBy("order_date")
            .agg({"amount": "sum"}))
```

```sql
-- SQL syntax equivalent
CREATE OR REFRESH STREAMING TABLE bronze_orders
AS SELECT * FROM STREAM read_files('/mnt/raw/orders', format => 'json');

CREATE OR REFRESH STREAMING TABLE silver_orders (
  CONSTRAINT valid_amount EXPECT (amount > 0) ON VIOLATION DROP ROW
)
AS SELECT * FROM STREAM(bronze_orders);
```

### Data Quality Expectations

| Directive | Behavior on failure |
|-----------|----------------------|
| `@dlt.expect(name, condition)` | Logs violation in pipeline event log, **keeps** the row |
| `@dlt.expect_or_drop(name, condition)` | **Drops** the violating row, logs the count |
| `@dlt.expect_or_fail(name, condition)` | **Fails the entire pipeline update** |
| `@dlt.expect_all(dict)` | Apply multiple expectations of the "keep + log" kind at once |
| `@dlt.expect_all_or_drop(dict)` | Apply multiple drop-on-violation expectations at once |

### Change Data Capture with `apply_changes` (Auto CDC)

Instead of hand-writing `MERGE` for upserts/SCD handling, DLT provides a declarative CDC primitive:

```python
dlt.create_streaming_table("silver_customers")

dlt.apply_changes(
    target="silver_customers",
    source="bronze_customer_changes",
    keys=["customer_id"],
    sequence_by=col("change_ts"),
    apply_as_deletes=col("operation") == "DELETE",
    except_column_list=["operation", "change_ts"],
    stored_as_scd_type=2   # or 1 for simple overwrite-in-place
)
```
This single call handles out-of-order events (via `sequence_by`), deletes, and full **SCD Type 1 or Type 2** history tracking — replacing what would otherwise be a hand-rolled, easy-to-get-wrong `MERGE` statement.

### Pipeline Modes

| Mode | Behavior |
|------|----------|
| **Triggered** | Runs once, processes new data, then stops (batch-like, cost efficient for periodic loads) |
| **Continuous** | Keeps running, low-latency streaming, cluster stays up |
| **Development** | Reuses cluster across runs for faster iteration, retries are less aggressive |
| **Production** | New cluster per update, full retry/error-handling semantics, more resilient |

### Pipeline Event Log
Every DLT pipeline writes a structured **event log** (queryable as a table) capturing lineage, data quality metric history, and per-run performance — useful for building meta-monitoring dashboards across many pipelines.

### Why Use It Over Plain Notebooks/Jobs?
- Automatic **dependency resolution** via the DAG inferred from `dlt.read()`/`dlt.read_stream()` calls — no manual task ordering needed.
- Built-in **data quality enforcement** (expectations) with quarantine/fail options per rule.
- Automatic **incremental processing** for streaming tables — you write the transformation once, DLT figures out what's new.
- Built-in **lineage graph** visualization across the whole pipeline.
- Handles **backfills**, retries, and cluster lifecycle automatically.
- Native CDC handling via `apply_changes`, avoiding hand-rolled SCD logic.

---

## 6. Streaming Concepts You Need

| Concept | Meaning |
|---------|---------|
| **Checkpointing** | Where Spark tracks stream progress/offsets for fault tolerance — never delete/reuse a checkpoint location across unrelated streams |
| **Watermarking** | Defines how late data can arrive before being dropped, required for bounding state size in stateful aggregations/joins |
| **Output modes** | `append` (new rows only, most common), `complete` (full result recomputed each batch, for small aggregations), `update` (only changed rows since last batch) |
| **`foreachBatch`** | Escape hatch to run arbitrary batch logic (e.g., a `MERGE`) against each micro-batch's DataFrame |
| **Idempotent sinks** | Required for exactly-once semantics end-to-end — Delta writes are idempotent by default when using checkpoints correctly |

```python
def upsert_to_delta(microBatchDF, batchId):
    microBatchDF.createOrReplaceTempView("updates")
    microBatchDF.sparkSession.sql("""
        MERGE INTO target t USING updates s ON t.id = s.id
        WHEN MATCHED THEN UPDATE SET * WHEN NOT MATCHED THEN INSERT *
    """)

streamDF.writeStream.foreachBatch(upsert_to_delta).option("checkpointLocation", "/mnt/chk/upsert").start()
```

```python
# Watermarking example — tolerate up to 10 minutes of late data
(streamDF
   .withWatermark("event_time", "10 minutes")
   .groupBy(window("event_time", "5 minutes"), "device_id")
   .count())
```

---

## 7. Backfills & Reprocessing Patterns

| Scenario | Approach |
|----------|----------|
| Bug found in a Silver transformation | Fix logic, use `dlt pipeline` "Full Refresh" (or drop + recreate the streaming table) to reprocess from Bronze |
| Need to reprocess only a date range | For batch (non-streaming) tables: `INSERT OVERWRITE ... WHERE` or `replaceWhere` on the affected partitions |
| New column needed retroactively | Backfill via a one-off batch job reading historical Bronze data, then resume the regular incremental stream |
| Auto Loader missed files (bucket policy issue, etc.) | Use `cloudFiles.backfillInterval` to periodically force a full directory listing alongside notifications, catching anything notifications missed |

```python
.option("cloudFiles.backfillInterval", "1 day")   # safety-net full listing alongside notification mode
```

---

## 8. Data Contracts & Upstream Coordination

As pipelines mature, treat the **Bronze schema as a contract** with upstream source owners:
- Document expected fields, types, and semantics for each source.
- Use `expect_or_fail` on critical fields at the Silver boundary to catch contract violations loudly rather than silently corrupting Gold aggregates.
- Track schema drift via the `_rescued_data` column and alert when it's non-empty for a sustained period.

---

## 9. Choosing the Right Tool

```
Need to ingest files continuously & incrementally at scale?    ─▶ Auto Loader
Need simple, idempotent, scheduled batch file loads?           ─▶ COPY INTO
Need a managed connector to a SaaS app or source database?     ─▶ Lakeflow Connect
Building a full multi-hop pipeline with quality checks + CDC?  ─▶ Lakeflow Declarative Pipelines (DLT)
Consuming another org's live data without copying?             ─▶ Delta Sharing
Need custom, complex streaming logic (arbitrary state)?        ─▶ raw Structured Streaming
```

---

## Related Cheatsheets
- [Delta Table Deep Dive](./04-delta-table-deep-dive.md)
- [Orchestration & Workflows](./07-orchestration-workflows.md)
- [DevOps & CI/CD](./10-devops-cicd.md) — testing DLT pipelines
