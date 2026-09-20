# Batch Processing Cheatsheet for Data Engineers

> A structured reference for designing, building, and operating batch pipelines — scheduling models, partitioning strategies, backfills, failure recovery, and the tooling landscape (Spark, dbt, SQL warehouses). Expanded from a one-paragraph pattern note into a full working reference with runnable examples and a decision framework for batch vs. the alternatives.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 When to Use Batch (and When Not To)](#when-to-use-batch-and-when-not-to)
4. [🏗️ Anatomy of a Batch Job](#anatomy-of-a-batch-job)
5. [📦 Partitioning Strategies](#partitioning-strategies)
6. [🔁 Backfills and Reprocessing](#backfills-and-reprocessing)
7. [🧮 Incremental vs Full-Refresh Batch](#incremental-vs-full-refresh-batch)
8. [🛠️ Tooling Landscape](#tooling-landscape)
9. [📈 Scheduling and SLAs](#scheduling-and-slas)
10. [🔍 Monitoring and Observability](#monitoring-and-observability)
11. [🌍 Real-World Scenario: Multi-Stage Daily Pipeline](#real-world-scenario-multi-stage-daily-pipeline)
12. [⏰ Handling Late-Arriving Data](#handling-late-arriving-data)
13. [🧪 Testing Batch Jobs](#testing-batch-jobs)
14. [⚡ Performance Tuning at Scale](#performance-tuning-at-scale)
15. [💰 Cost Optimization Patterns](#cost-optimization-patterns)
16. [🧰 Engine Comparison: Spark vs DuckDB vs Polars vs Warehouse-Native](#engine-comparison-spark-vs-duckdb-vs-polars-vs-warehouse-native)
17. [🔗 Multi-Source Joins and Dependency Fan-In](#multi-source-joins-and-dependency-fan-in)
18. [⚠️ Common Gotchas](#common-gotchas)
19. [✅ Best Practices Checklist](#best-practices-checklist)
20. [📚 Batch vs Streaming vs Micro-batch](#batch-vs-streaming-vs-micro-batch)
21. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| Trigger | Cron / scheduler-driven, fixed interval (hourly, daily) |
| Unit of work | A "run" over a bounded input (a day partition, a file drop) |
| Idempotency | Overwrite a partition, don't append |
| Failure recovery | Re-run the same job for the same window |
| Backfill | Re-run historical windows with the current logic |
| Output write | `mode("overwrite")` + `partitionBy` (Spark) or `MERGE`/`INSERT OVERWRITE` (SQL) |
| Typical grain | Day or hour partitions on an event-time column |
| Common tools | Spark, dbt, Airflow/Dagster, BigQuery/Snowflake scheduled tasks |

## 🧠 Core Concept

Batch processing collects data that has accumulated over a window of time and processes all of it in one bounded run, rather than reacting to each event as it arrives. The defining trait isn't the tool — it's the **execution model**: a batch job has a clear start, a clear end, a bounded input, and (ideally) a deterministic output for that input.

```text
[ accumulate events for a window ]  -->  [ scheduled run processes the whole window ]  -->  [ output partition/table updated ]
        (minutes to a day)                    (minutes to hours)                              (ready for consumers)
```

This makes batch the default choice for the majority of analytics workloads: it trades latency for simplicity, cost efficiency, and much easier correctness guarantees.

## 🎯 When to Use Batch (and When Not To)

**Use batch when:**
- Reports, reconciliation, dashboards, or model training can tolerate minutes-to-hours of delay.
- Processing large volumes together is measurably cheaper than processing them one at a time (columnar formats, vectorized compute, fewer per-record overheads).
- You want simple, well-understood failure recovery: re-run the window.
- The business logic changes often and you want to reprocess history cheaply when it does.

**Avoid batch when:**
- Consumers need sub-second to low-second freshness (fraud detection, live pricing) — see [real-time-streaming](./Real_Time_Streaming_Cheat_Sheet.md).
- The source system can't tolerate repeated full scans and only exposes a change log — see [change-data-capture](./Change_Data_Capture_Cheat_Sheet.md).
- Work naturally arrives as a continuous, unbounded stream with no meaningful "window boundary" for the business.

## 🏗️ Anatomy of a Batch Job

A production-grade batch job is more than the transform logic — it has explicit **extract**, **transform**, **validate**, and **publish** stages, plus a **run manifest** so it's auditable and safely re-runnable.

```python
from datetime import date
import pyspark.sql.functions as F

def run_daily_revenue_job(spark, run_date: date):
    input_path = f"s3://lake/events/date={run_date:%Y-%m-%d}/"
    output_path = "s3://mart/daily_revenue/"

    # 1. Extract — read only this run's bounded input
    daily = spark.read.parquet(input_path)

    # 2. Transform
    result = (
        daily.groupBy("country")
        .agg(F.sum("revenue").alias("revenue"), F.count("*").alias("orders"))
        .withColumn("run_date", F.lit(run_date))
    )

    # 3. Validate before publishing (see data-quality-gates.md)
    row_count = result.count()
    if row_count == 0:
        raise ValueError(f"No output rows for {run_date} — refusing to publish an empty partition")

    # 4. Publish — atomic partition replace, never append-only
    (result.write.mode("overwrite")
        .option("replaceWhere", f"run_date = '{run_date}'")
        .partitionBy("run_date")
        .parquet(output_path))

    # 5. Record the run manifest for idempotency and lineage
    return {"run_date": str(run_date), "rows_written": row_count, "input_path": input_path}
```

Notice the shape: **bounded input → deterministic transform → validation gate → atomic write → manifest**. Each piece maps to a section below.

## 📦 Partitioning Strategies

Partitioning is what makes batch jobs cheap to re-run and cheap to query.

```python
# Partition by the event-time grain consumers actually filter on
(df.write.mode("overwrite")
   .partitionBy("event_date")          # coarse partitions -> fast pruning
   .parquet("s3://mart/events/"))

# Two-level partitioning for high-volume, multi-tenant data
(df.write.mode("overwrite")
   .partitionBy("event_date", "region")
   .parquet("s3://mart/events/"))
```

| Grain | When to use | Trade-off |
|---|---|---|
| Hourly | High volume, intraday backfills needed | Many small files if volume is low |
| Daily | Most analytics workloads | Standard default |
| Monthly | Low-volume, slow-changing dimensions | Coarse — big re-run cost if wrong |

Rule of thumb: partition by the column your consumers filter on most, and keep partitions large enough to avoid the "small files problem" (thousands of tiny files kill read performance).

## 🔁 Backfills and Reprocessing

Backfills are batch's superpower: because logic is deterministic and inputs are bounded, you can regenerate any historical window on demand.

```python
from datetime import date, timedelta

def backfill(spark, start: date, end: date):
    d = start
    while d <= end:
        run_daily_revenue_job(spark, d)   # same function used for the daily schedule
        d += timedelta(days=1)

backfill(spark, date(2026, 1, 1), date(2026, 1, 31))
```

```sql
-- SQL-native equivalent: overwrite a specific partition range
INSERT OVERWRITE TABLE mart.daily_revenue PARTITION (run_date)
SELECT country, SUM(revenue) AS revenue, COUNT(*) AS orders, run_date
FROM staging.events
WHERE run_date BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY country, run_date;
```

**Design rule:** the backfill code path and the scheduled code path should be the *same function*, parameterized by date. Two separate implementations for "normal run" and "backfill" is a reliability bug waiting to happen.

## 🧮 Incremental vs Full-Refresh Batch

```python
# Full refresh: simplest, recomputes everything — fine for small/medium dims
full = (spark.read.table("staging.customers")
        .groupBy("segment").count())

# Incremental: only process the new/changed watermark range
last_watermark = get_last_processed_timestamp("customers_job")
incremental = (spark.read.table("staging.customers")
               .filter(F.col("updated_at") > last_watermark))
new_watermark = incremental.agg(F.max("updated_at")).first()[0]
# ... process incremental, then persist new_watermark atomically with the output
```

| Approach | Pros | Cons |
|---|---|---|
| Full refresh | Simple, self-healing, no watermark state | Expensive at scale, slow |
| Incremental (watermark) | Cheap, fast | Watermark bugs cause silent gaps; needs careful late-data handling |
| Incremental (CDC-fed) | Row-level precision, handles deletes | Requires CDC infrastructure upstream |

## 🛠️ Tooling Landscape

| Layer | Common tools |
|---|---|
| Compute engine | Apache Spark, DuckDB, Polars, Trino/Presto |
| SQL-native transform | dbt (batch models), warehouse scheduled tasks (Snowflake Tasks, BigQuery Scheduled Queries) |
| Orchestration | Airflow, Dagster, Prefect (see orchestration-and-dags.md) |
| Storage target | Parquet/Delta/Iceberg on object storage, warehouse tables |

```sql
-- dbt-style incremental model (materialization pattern)
{{ config(materialized='incremental', partition_by={'field': 'run_date', 'data_type': 'date'}) }}

SELECT country, SUM(revenue) AS revenue, run_date
FROM {{ ref('stg_events') }}
{% if is_incremental() %}
WHERE run_date > (SELECT MAX(run_date) FROM {{ this }})
{% endif %}
GROUP BY country, run_date
```

## 📈 Scheduling and SLAs

- Define an **SLA per job**: "daily_revenue must be published by 06:00 UTC."
- Build in **buffer time** between upstream dependency completion and your own SLA — upstream jobs run late.
- Use **cron expressions or orchestrator schedules**, not hand-rolled timers, so retries/backfills reuse the same scheduling primitives.

```python
# Airflow-style schedule with a data interval, not a "run at this time" cron
from airflow.decorators import dag, task
from datetime import datetime

@dag(schedule="@daily", start_date=datetime(2026, 1, 1), catchup=True)
def daily_revenue_dag():
    @task
    def run(data_interval_start=None):
        run_daily_revenue_job(spark, data_interval_start.date())
    run()
```

## 🔍 Monitoring and Observability

```python
# Emit metrics every run so drift and failures are visible, not silent
metrics = {
    "job": "daily_revenue",
    "run_date": str(run_date),
    "rows_written": row_count,
    "duration_seconds": elapsed,
    "input_partition_bytes": input_size,
}
emit_metrics(metrics)

# Freshness check a consumer (or the orchestrator) can query
SELECT MAX(run_date) AS latest_partition,
       DATEDIFF(CURRENT_DATE, MAX(run_date)) AS days_stale
FROM mart.daily_revenue;
```

## 🌍 Real-World Scenario: Multi-Stage Daily Pipeline

A realistic batch pipeline is rarely one job — it's a chain of stages, each with its own bounded input and idempotent write, wired together so a failure at stage 3 doesn't force re-running stages 1 and 2.

```python
from datetime import date
import pyspark.sql.functions as F

def stage_1_raw_to_staging(spark, run_date: date):
    """Bronze: light cleaning only, 1:1 with source."""
    raw = spark.read.json(f"s3://raw/orders/date={run_date:%Y-%m-%d}/")
    staged = (raw
        .withColumn("order_id", F.col("order_id").cast("string"))
        .withColumn("amount", F.col("amount").cast("decimal(10,2)"))
        .dropDuplicates(["order_id"]))          # defend against upstream duplicate delivery
    (staged.write.mode("overwrite")
        .option("replaceWhere", f"run_date = '{run_date}'")
        .partitionBy("run_date")
        .parquet("s3://staging/orders/"))
    return staged.count()

def stage_2_staging_to_core(spark, run_date: date):
    """Silver: joins, business logic, conformed keys."""
    orders = spark.read.parquet("s3://staging/orders/").filter(F.col("run_date") == str(run_date))
    customers = spark.read.table("core.dim_customer").filter(F.col("is_current"))
    core = (orders.join(customers, "customer_id", "left")
        .select("order_id", "customer_key", "amount", "run_date"))
    (core.write.mode("overwrite")
        .option("replaceWhere", f"run_date = '{run_date}'")
        .partitionBy("run_date")
        .parquet("s3://core/fct_orders/"))
    return core.count()

def stage_3_core_to_mart(spark, run_date: date):
    """Gold: denormalized, audience-specific aggregate."""
    fct = spark.read.parquet("s3://core/fct_orders/").filter(F.col("run_date") == str(run_date))
    mart = fct.groupBy("run_date").agg(F.sum("amount").alias("revenue"), F.count("*").alias("orders"))
    (mart.write.mode("overwrite")
        .option("replaceWhere", f"run_date = '{run_date}'")
        .partitionBy("run_date")
        .parquet("s3://mart/daily_revenue/"))
    return mart.count()

def run_pipeline(spark, run_date: date):
    """Each stage's manifest is checked before the next stage runs, so a failed
    stage 2 can be retried alone without redoing stage 1's (already-correct) output."""
    manifest = {}
    manifest["staging_rows"] = stage_1_raw_to_staging(spark, run_date)
    if manifest["staging_rows"] == 0:
        raise ValueError(f"No staged rows for {run_date}, halting before core/mart stages")
    manifest["core_rows"] = stage_2_staging_to_core(spark, run_date)
    manifest["mart_rows"] = stage_3_core_to_mart(spark, run_date)
    return manifest
```

Wiring this into an orchestrator (see [orchestration-and-dags.md](./Orchestration_and_DAGs_Cheat_Sheet.md)) as three separate tasks — rather than one monolithic function — means a transient failure in stage 3 retries only stage 3, and the DAG's history shows exactly where time is spent.

## ⏰ Handling Late-Arriving Data

Watermark-based incremental batch jobs assume "new" means "arrived since the last watermark" — but event time and arrival time diverge in the real world (mobile clients buffering offline, upstream retries, clock skew).

```python
from datetime import timedelta

def run_with_lateness_window(spark, run_date: date, lateness: timedelta = timedelta(days=2)):
    """Reprocess a trailing window on every run, not just the current day,
    so records that arrive late but belong to an earlier event_date are still captured."""
    window_start = run_date - lateness
    affected = (spark.read.table("staging.events")
        .filter(F.col("event_date").between(str(window_start), str(run_date))))

    result = (affected.groupBy("event_date", "country")
        .agg(F.sum("revenue").alias("revenue")))

    # Overwrite the ENTIRE trailing window, not just today — this is what
    # correctly absorbs late-arriving rows into their true event_date partition
    (result.write.mode("overwrite")
        .option("replaceWhere", f"event_date BETWEEN '{window_start}' AND '{run_date}'")
        .partitionBy("event_date")
        .parquet("s3://mart/daily_revenue/"))
```

```sql
-- SQL equivalent: recompute a trailing N-day window every run
INSERT OVERWRITE TABLE mart.daily_revenue PARTITION (event_date)
SELECT country, SUM(revenue) AS revenue, event_date
FROM staging.events
WHERE event_date BETWEEN DATE_SUB(CURRENT_DATE, 2) AND CURRENT_DATE
GROUP BY country, event_date;
```

| Strategy | How it works | Trade-off |
|---|---|---|
| Trailing reprocessing window | Recompute the last N days every run | Simple, correctness-first; costs N× the compute per run |
| Late-arrival side table | Route out-of-window records to a separate "corrections" table, merge periodically | Cheaper per run; adds a second code path to maintain |
| Accept-and-ignore | Drop anything outside the current window | Cheapest; only acceptable when late data is rare/immaterial |

## 🧪 Testing Batch Jobs

Batch transform logic is pure (bounded input → deterministic output), which makes it eminently unit-testable — treat "test the job with a fixture DataFrame" as standard practice, not an afterthought.

```python
import pytest
from pyspark.sql import Row

def test_daily_revenue_aggregation(spark):
    input_df = spark.createDataFrame([
        Row(country="US", revenue=100.0),
        Row(country="US", revenue=50.0),
        Row(country="UK", revenue=75.0),
    ])
    result = compute_daily_revenue(input_df).collect()
    result_by_country = {r["country"]: r["revenue"] for r in result}
    assert result_by_country["US"] == 150.0
    assert result_by_country["UK"] == 75.0

def test_empty_input_raises():
    empty_df = spark.createDataFrame([], schema="country STRING, revenue DOUBLE")
    with pytest.raises(ValueError, match="No output rows"):
        run_daily_revenue_job_from_df(empty_df, run_date=date(2026, 1, 1))

def test_idempotent_rerun(spark, tmp_output_path):
    run_daily_revenue_job(spark, date(2026, 1, 1))
    first_count = spark.read.parquet(tmp_output_path).count()
    run_daily_revenue_job(spark, date(2026, 1, 1))   # run again, same input
    second_count = spark.read.parquet(tmp_output_path).count()
    assert first_count == second_count   # no duplication from the re-run
```

Also test the **backfill code path directly** — since it should call the same function as the schedule, a backfill test is mostly a regression check that no one has silently forked the logic.

## ⚡ Performance Tuning at Scale

```python
# Broadcast small dimension tables to avoid a full shuffle join
from pyspark.sql.functions import broadcast

result = large_fact_df.join(broadcast(small_dim_df), "customer_id")

# Repartition before a wide operation to avoid data skew on a hot key
skewed_fixed = df.repartition(200, "customer_id")

# Cache an intermediate DataFrame reused across multiple downstream stages
staged = spark.read.parquet("s3://staging/orders/").cache()
staged.count()   # materialize the cache with an action

# Tune shuffle partitions to match cluster size (default 200 is often wrong)
spark.conf.set("spark.sql.shuffle.partitions", "400")

# Predicate pushdown: filter as early as possible, ideally at the read
df = spark.read.parquet("s3://lake/events/").filter(F.col("event_date") == "2026-09-17")
```

```sql
-- Warehouse-side: cluster/partition pruning does the same job SQL-natively
SELECT country, SUM(revenue)
FROM mart.daily_revenue
WHERE run_date = '2026-09-17'   -- pruned to a single partition, not a full scan
GROUP BY country;
```

| Symptom | Likely cause | Fix |
|---|---|---|
| One task takes far longer than others | Data skew on the join/group key | Salt the key, or broadcast the small side |
| Job spends most time in shuffle | Too many/few shuffle partitions for data volume | Tune `spark.sql.shuffle.partitions` |
| Slow reads despite partition filter | Partition column not used in the filter, or too many small files | Filter on the partition column explicitly; compact files |
| OOM on the driver | `.collect()` on a large DataFrame | Use `.write` or aggregate before collecting |

## 💰 Cost Optimization Patterns

```python
# Read only the columns you need — column pruning cuts I/O on wide Parquet tables
df = spark.read.parquet("s3://lake/events/").select("event_date", "country", "revenue")

# Use spot/preemptible compute for backfills — they're retryable by design, so
# losing a worker mid-backfill just means that partition retries
backfill_cluster_config = {"use_spot_instances": True, "max_retries": 3}

# Right-size the schedule — hourly jobs that only need daily freshness cost 24x for no benefit
# BAD: schedule="@hourly" when consumers only check the dashboard once a day
# GOOD: schedule="@daily"
```

| Lever | Savings mechanism |
|---|---|
| Column pruning | Read fewer bytes per query/job |
| Partition pruning | Skip irrelevant partitions entirely |
| Spot/preemptible compute for backfills | Idempotent, retryable jobs tolerate interruption cheaply |
| Right-sized schedule frequency | Don't pay for freshness nobody consumes |
| File compaction | Fewer file-open overheads on every downstream read |

## 🧰 Engine Comparison: Spark vs DuckDB vs Polars vs Warehouse-Native

| Engine | Best fit | Notes |
|---|---|---|
| Apache Spark | Large distributed batch (TB+ scale), complex joins across many sources | Mature ecosystem, higher operational overhead |
| DuckDB | Single-node batch on files up to tens of GB, embedded analytics | Zero infrastructure, excellent for local/CI-scale batch jobs |
| Polars | Single-node, very large in-memory/out-of-core transforms | Fast, lazy execution, great for medium-scale ETL without a cluster |
| Warehouse-native (dbt + SQL) | Batch transforms that live entirely inside the warehouse already | No separate compute to manage; scales with warehouse credits |

```python
# The same daily aggregation, DuckDB-native (no cluster needed)
import duckdb

duckdb.sql("""
    COPY (
        SELECT country, SUM(revenue) AS revenue, run_date
        FROM read_parquet('s3://lake/events/date=2026-09-17/*.parquet')
        GROUP BY country, run_date
    ) TO 's3://mart/daily_revenue/run_date=2026-09-17/' (FORMAT PARQUET)
""")
```

## 🔗 Multi-Source Joins and Dependency Fan-In

Many batch jobs don't read one input — they fan in from several upstream partitions that must all be ready before the join is correct.

```python
def all_upstreams_ready(run_date: date) -> bool:
    return (
        partition_exists("s3://staging/orders/", run_date)
        and partition_exists("s3://staging/refunds/", run_date)
        and partition_exists("s3://staging/customers/", run_date)
    )

def run_fanned_in_job(spark, run_date: date):
    if not all_upstreams_ready(run_date):
        raise UpstreamNotReadyError(f"Not all upstream partitions ready for {run_date}")

    orders = spark.read.parquet("s3://staging/orders/").filter(F.col("run_date") == str(run_date))
    refunds = spark.read.parquet("s3://staging/refunds/").filter(F.col("run_date") == str(run_date))
    customers = spark.read.table("core.dim_customer").filter(F.col("is_current"))

    net = (orders
        .join(refunds, "order_id", "left")
        .join(customers, "customer_id", "left")
        .withColumn("net_amount", F.col("amount") - F.coalesce(F.col("refund_amount"), F.lit(0))))
    return net
```

In an orchestrator, model this as explicit **upstream sensors or dataset dependencies** rather than a hopeful `sleep()` — see [orchestration-and-dags.md](./Orchestration_and_DAGs_Cheat_Sheet.md#cross-dag-dependencies-and-sensors) for the sensor pattern this relies on.

## ⚠️ Common Gotchas

- **Append-only writes silently duplicate data on retry.** Always overwrite the target partition, or `MERGE` on a business key — never blind `INSERT`/`append`.
- **"Catchup" scheduling surprises.** Orchestrators with `catchup=True` will fire one run per missed interval on first deploy — decide deliberately whether you want that.
- **Late-arriving data breaks watermark-based incrementals.** A record with yesterday's event time landing today won't be picked up unless you reprocess a trailing window.
- **Small files problem.** Many small per-hour writes into a daily-partitioned table degrade read performance — compact regularly.
- **Same-day partition, different results.** If a job re-runs on a partition whose source data changed underneath it (e.g., a late upstream correction), two runs of "the same window" can legitimately differ — record input snapshot metadata to explain this.
- **Time zone mismatches** between the scheduler's clock, the partition column, and the business calendar are one of the most common sources of off-by-one-day bugs.
- **Untested transform logic that "looks right"** — a job that has never run against an empty input, a single-row input, or a duplicate-key input will eventually meet one of those in production.
- **Skew-blind joins** — a single hot key (a test account, a bot, a whale customer) can make one Spark task take 100x longer than the rest while the job "looks stuck."
- **Fan-in jobs that don't check all upstreams are ready** — a job that reads whatever partitions happen to exist, rather than asserting all required ones are present, can silently compute on incomplete data.

## ✅ Best Practices Checklist

- [ ] Every job's write is idempotent (overwrite partition or `MERGE`, never blind append)
- [ ] The backfill code path is the same function as the scheduled path
- [ ] Partitions are sized to avoid both "too many tiny files" and "too coarse to prune"
- [ ] A run manifest records input partitions, output partitions, and row counts
- [ ] Quality gates run before the atomic publish, not after
- [ ] SLAs and freshness are monitored, not just job success/failure
- [ ] Late data has an explicit handling policy (reprocess trailing window, or accept the loss)

## 📚 Batch vs Streaming vs Micro-batch

| Dimension | Batch | Micro-batch | Streaming |
|---|---|---|---|
| Latency | Minutes–hours | Seconds–minutes | Milliseconds–seconds |
| Failure recovery | Re-run the window | Re-run the micro-batch | Checkpoint + replay |
| Cost model | Cheap per-record at scale | Middle ground | Always-on compute |
| Complexity | Low | Medium | High (state, ordering, exactly-once) |
| Good fit | Reporting, training, reconciliation | Near-real-time dashboards | Fraud detection, alerting |

## 💡 Pro Tips

1. **Make the run idempotent before you make it fast** — correctness first, performance second.
2. **Parameterize by date, not "now"** — every job should accept the window it's processing as an argument.
3. **Prefer partition overwrite over `MERGE`** when the whole partition is being recomputed — it's simpler and faster.
4. **Keep transform logic pure** (no side effects beyond the final write) so the same code safely backfills.
5. **Track a watermark table**, don't infer "what's new" from wall-clock time.
6. **Compact small files** on a schedule if you're doing hourly or streaming-into-batch writes.
7. **Alert on staleness, not just failure** — a job that "succeeds" but processes zero rows is often a silent bug.
8. **Separate extract/transform/validate/publish** into distinct, testable functions.
9. **Log input row counts and output row counts** on every run — a ratio outside the historical range is a cheap quality signal.
10. **Design for replay from day one** — assume you will need to reprocess history because business logic will change.
11. **Unit test transform logic against fixture DataFrames**, including empty-input and duplicate-key cases, not just the happy path.
12. **Reprocess a trailing window, not just "today,"** whenever late-arriving data is a realistic risk for the source.
13. **Broadcast small dimension tables** in joins to avoid unnecessary shuffles at scale.
14. **Use spot/preemptible compute for backfills** — idempotent, retryable jobs are exactly the workload spot instances are cheapest for.
15. **Model fan-in dependencies as explicit sensors/checks**, not implicit assumptions that upstream partitions happen to exist by the time you read them.
