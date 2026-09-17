# Medallion Architecture Cheatsheet

> A conceptual + practical reference for Medallion (multi-hop) Architecture — the Bronze/Silver/Gold layering pattern popularized by Databricks for organizing data in a lakehouse. Complements the [Lakehouse Formats Cheatsheet](./Lakehouse_Formats_Cheatsheet.md) and [Databricks Cheatsheet](./Databricks_Cheatsheet.md) already in this collection.

## 📑 Table of Contents

1. [🧠 Core Concept](#core-concept)
2. [⚡ Quick Reference](#quick-reference)
3. [🥉🥈🥇 The Three Layers in Depth](#the-three-layers-in-depth)
4. [🏗️ Reference Pipeline](#reference-pipeline)
5. [✅ Data Quality Gates Between Layers](#data-quality-gates-between-layers)
6. [👩‍💻 Worked Example: Clickstream Pipeline End-to-End](#worked-example-clickstream-pipeline-end-to-end)
7. [🌊 Streaming vs. Batch Medallion](#streaming-vs-batch-medallion)
8. [🔁 Schema Evolution Across Layers](#schema-evolution-across-layers)
9. [🔀 Medallion vs. Other Layering Conventions](#medallion-vs-other-layering-conventions)
10. [📁 Example Schema/Catalog Layout](#example-schemacatalog-layout)
11. [⚠️ Common Gotchas & Anti-Patterns](#common-gotchas-anti-patterns)
12. [🎯 Best Practices](#best-practices)
13. [💡 Pro Tips](#pro-tips)

## 🧠 Core Concept

Medallion architecture is a data design pattern that organizes a lakehouse into progressive layers of data quality — **Bronze (raw), Silver (cleaned/conformed), and Gold (business-level aggregates)** — with data flowing through each layer via a series of validations and transformations. It's also called a **multi-hop architecture**, because each hop through a layer incrementally improves structure, quality, and fitness for use.

The pattern was popularized by Databricks as a recommended (not required) best practice for building a single source of truth on a lakehouse, guaranteeing ACID-like guarantees as data passes through each stage before landing in a layout optimized for analytics. It is not tied to any single vendor or table format — the same Bronze/Silver/Gold logic is applied on Delta Lake, Iceberg, Hudi, or plain object storage with Parquet.

## ⚡ Quick Reference

| Layer | Purpose | Typical Users | What Happens |
|---|---|---|---|
| 🥉 Bronze | Raw data ingestion | Data engineers, data ops, compliance/audit | Landed as-is from source, append-only, minimal/no transformation |
| 🥈 Silver | Cleaning & conformance | Data engineers, analysts, data scientists | Dedup, type-fixing, filtering invalid records, joining into a usable enterprise view |
| 🥇 Gold | Business-level aggregation | BI developers, executives, ML engineers, operational teams | Dimensional modeling, aggregation, feature engineering — the layer BI tools query directly |

| Term | Meaning |
|---|---|
| Multi-hop architecture | Alternate name for medallion — data "hops" through Bronze → Silver → Gold |
| Append-only | Bronze tables are never updated/deleted in place — full historical record preserved for reprocessing |
| Just-enough cleansing | Silver's guiding principle — clean enough for a shared enterprise view, not over-engineered for one use case |
| Data quality gate | A validation/expectation checked when data moves between layers (e.g., Delta Live Tables expectations) |
| Golden/enterprise view | The unified, deduplicated, cross-referenced entities produced in Silver (e.g., one "customer" record from many source systems) |
| Watermark | A timestamp/offset marker used to process only new or changed records incrementally between layers |

## 🥉🥈🥇 The Three Layers in Depth

### Bronze — Raw Data

- Data lands **exactly as received** from source systems (CSV stays CSV, JSON stays JSON; database extracts often normalized to Parquet/Avro on landing).
- **Append-only** — never delete or modify in place. This preserves a full historical/audit trail and lets you reprocess from scratch if downstream logic changes.
- Additional metadata columns are typically added (ingestion timestamp, source system, batch/process ID) without altering the source content itself.
- Focus: fast, reliable Change Data Capture; historical archive (cold storage); lineage and auditability; reprocessing without re-reading from the source system.
- Intended users: data engineers building the next layer, data ops monitoring ingestion, compliance/audit teams needing an immutable record.

### Silver — Cleaned & Conformed

- Data from Bronze is **matched, merged, conformed, and cleansed "just enough"** to produce an enterprise view of key business entities (customers, products, transactions) — not a fully business-specific model yet.
- Typical operations: deduplication, standardizing date/time formats and naming conventions, filtering or flagging invalid records, type casting, joining related bronze tables into a coherent structure, resolving cross-reference/lookup tables.
- Retains detailed, granular records (not pre-aggregated) so it remains useful for exploratory analysis, data science feature engineering, and ad hoc investigation.
- Intended users: data engineers building Gold, analysts doing deeper investigation, data scientists building models.

### Gold — Business-Level Aggregates

- Data is organized into **project/use-case-specific, business-consumable views**: dimensional models (star schemas), rollups, and pre-aggregated metrics.
- This is the layer most BI tools, dashboards, and reports query directly — optimized for read performance and business semantics rather than flexibility.
- Also commonly hosts ML feature tables built from Silver's granular data.
- Intended users: executives and decision-makers, operational teams, BI developers, ML engineers consuming curated features.

## 🏗️ Reference Pipeline

```
 Source Systems (OLTP DBs, SaaS APIs, event streams, files)
          │
          ▼
 ┌─────────────────┐   append-only, as-is, + ingestion metadata
 │   BRONZE         │   (raw / landing zone)
 └────────┬─────────┘
          │  dedup, type-fix, validate, conform, join refs
          ▼
 ┌─────────────────┐   enterprise view of key entities
 │   SILVER         │   (cleaned / conformed)
 └────────┬─────────┘
          │  aggregate, model dimensionally, build features
          ▼
 ┌─────────────────┐   star schemas, rollups, ML features
 │   GOLD           │   (business-level / curated)
 └────────┬─────────┘
          │
          ▼
   BI dashboards · reports · ML models · reverse ETL
```

On Databricks specifically, this is commonly implemented with **Lakeflow / Delta Live Tables (DLT)**-style declarative pipelines, where streaming tables and materialized views handle incremental Bronze→Silver→Gold refresh with minimal orchestration code — but the same layering works with plain scheduled Spark/dbt jobs on any engine.

## ✅ Data Quality Gates Between Layers

Medallion architecture is as much about **where validation happens** as about storage layout:

| Gate | Typical Checks | Action on Failure |
|---|---|---|
| Bronze → Silver | Schema conformance, null-key checks, type validity, duplicate detection | Quarantine/flag row, or drop with logging (never silently fix in Bronze) |
| Silver → Gold | Referential integrity (foreign keys resolve), business-rule checks (valid ranges, valid enums), aggregation correctness | Fail the pipeline run or route offending records to an error table for review |

Declarative pipeline tools (e.g., DLT-style expectations) let you declare these checks as metadata attached to the transformation, with configurable behavior: `warn` (log only), `drop` (silently filter), or `fail` (stop the pipeline) — a good default is `drop`-with-logging for Silver and `fail` for critical Gold aggregates.

**Example DLT-style expectation syntax** (conceptual, Python):

```python
import dlt
from pyspark.sql.functions import col

@dlt.table(name="silver_orders")
@dlt.expect_or_drop("valid_order_id", "order_id IS NOT NULL")
@dlt.expect_or_drop("valid_amount", "order_amount > 0")
@dlt.expect("recent_order", "order_date >= '2020-01-01'")  # warn only, doesn't drop
def silver_orders():
    return (
        dlt.read_stream("bronze_orders")
        .dropDuplicates(["order_id"])
        .withColumn("order_amount", col("order_amount").cast("decimal(10,2)"))
    )
```

`expect_or_drop` quarantines/removes violating rows while logging the violation count; a plain `expect` just tracks and surfaces the metric without blocking the pipeline — useful for softer business rules you want visibility into before enforcing them.

## 👩‍💻 Worked Example: Clickstream Pipeline End-to-End

A media company ingests raw clickstream events and needs a daily "sessions by content category" Gold table.

**Bronze** (`bronze.clickstream_raw`): events land exactly as the tracking pixel sends them — a semi-structured JSON blob per row, plus `_ingested_at` and `_source_file` metadata columns. No parsing of the JSON payload happens here; even malformed JSON lands successfully (as a raw string) so nothing is ever silently lost at ingestion.

```sql
-- Bronze: append-only, minimal transformation
CREATE TABLE bronze.clickstream_raw (
  raw_payload STRING,        -- untouched JSON string from the tracker
  _ingested_at TIMESTAMP,
  _source_file STRING
) USING DELTA;
```

**Silver** (`silver.clickstream_events`): the JSON payload is parsed into typed columns, events with a null `user_id` or unparseable JSON are dropped (with the drop count logged), timestamps are normalized to UTC, and known bot traffic (matched against a reference list) is filtered out.

```sql
-- Silver: parsed, typed, deduplicated, conformed
CREATE TABLE silver.clickstream_events AS
SELECT
  get_json_object(raw_payload, '$.user_id')      AS user_id,
  get_json_object(raw_payload, '$.event_type')   AS event_type,
  get_json_object(raw_payload, '$.content_id')   AS content_id,
  to_utc_timestamp(
    get_json_object(raw_payload, '$.event_time'), 'America/New_York'
  )                                                AS event_time_utc
FROM bronze.clickstream_raw
WHERE get_json_object(raw_payload, '$.user_id') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ref.known_bots b
    WHERE b.user_agent = get_json_object(raw_payload, '$.user_agent')
  );
```

**Gold** (`gold.mart_sessions_by_category`): Silver's granular event-level data is joined with the Catalog domain's `content_category` reference table, sessionized (grouped into visit sessions by a 30-minute inactivity gap), and aggregated to the grain the dashboard actually needs — one row per day per content category.

```sql
-- Gold: aggregated to dashboard grain
CREATE TABLE gold.mart_sessions_by_category AS
SELECT
  DATE(event_time_utc)   AS event_date,
  c.content_category,
  COUNT(DISTINCT s.session_id) AS session_count,
  COUNT(*)                     AS event_count
FROM silver.clickstream_events e
JOIN silver.sessions s USING (user_id, event_time_utc)
JOIN ref.content_category c ON e.content_id = c.content_id
GROUP BY DATE(event_time_utc), c.content_category;
```

Notice the division of labor: Bronze never parses JSON (so a tracker bug that changes the payload shape never breaks ingestion); Silver does the one-time parsing and cleaning every downstream consumer needs; Gold does only the aggregation specific to this one dashboard. A second Gold table for a different use case (e.g., per-user engagement scoring) would read from the *same* Silver table rather than re-parsing Bronze from scratch.

## 🌊 Streaming vs. Batch Medallion

| | Batch Medallion | Streaming Medallion |
|---|---|---|
| Bronze ingestion | Scheduled bulk loads (hourly/daily) | Continuous ingestion from a message bus (Kafka, Kinesis, Event Hubs) |
| Silver processing | Full or incremental batch job, often watermark-based | Continuous streaming transformation, often with windowed aggregation |
| Gold refresh | Scheduled recompute (nightly rollups) | Continuously updated materialized views, sometimes with micro-batch triggers |
| Latency | Minutes to hours | Seconds to minutes |
| Typical tooling | Scheduled Spark/dbt jobs, orchestrated by Airflow/similar | Structured Streaming, Flink, or declarative pipeline tools with streaming tables |
| Best fit | Reporting, financial reconciliation, anything tolerant of hours-old data | Fraud detection, real-time inventory, operational dashboards |

Many real pipelines are **hybrid**: Bronze ingests continuously (streaming), Silver processes incrementally on a short micro-batch cadence, and Gold recomputes on a coarser schedule (e.g., every 15 minutes) because the business consumer doesn't need second-level freshness for an executive dashboard — matching each layer's refresh cadence to what its actual consumers need, rather than making every hop as real-time as technically possible.

## 🔁 Schema Evolution Across Layers

Source systems change their schemas over time (a new field added, a field renamed, a type widened). Medallion architecture handles this differently at each layer:

- **Bronze:** should tolerate schema evolution gracefully — most lakehouse formats support schema merging on write (e.g., Delta's `mergeSchema` option), so a new field from the source simply appears as a new (nullable) column rather than breaking ingestion.
- **Silver:** schema changes are handled deliberately — a new source field is evaluated and explicitly added to the conformed model (with a decision about its business meaning and validation rules) rather than passed through automatically; this is where "just enough cleansing" includes schema governance.
- **Gold:** schema changes are the most controlled — Gold tables are contracts with downstream BI tools and dashboards, so an added column is usually safe, but a renamed or removed column requires the same kind of breaking-change/versioning discipline as a [data mesh data contract](./Data_Mesh_Cheatsheet.md#data-contracts-in-practice), since a dashboard or report can silently break.

## 🔀 Medallion vs. Other Layering Conventions

| Medallion | dbt Convention | Classic Data Warehouse (Kimball/Inmon-style) |
|---|---|---|
| Bronze | Staging (`stg_`) | Staging area / ODS (operational data store) |
| Silver | Intermediate (`int_`) | Conformed / integrated layer |
| Gold | Marts (`mart_`/`fct_`/`dim_`) | Dimensional data marts (facts & dimensions) |

The underlying idea — raw → cleaned/conformed → business-curated — long predates the "medallion" name (it echoes staging/ODS/mart conventions from Kimball-style warehousing). What Medallion adds is a lakehouse-native vocabulary and an explicit emphasis on append-only, reprocessable Bronze plus incremental, declarative refresh between layers, which fits streaming and multi-format lakehouse storage better than the traditional batch-ETL warehouse mental model.

## 📁 Example Schema/Catalog Layout

```
catalog: enterprise_lakehouse
├── bronze
│   ├── bronze.orders_raw
│   ├── bronze.customers_raw
│   └── bronze.clickstream_raw
├── silver
│   ├── silver.orders_conformed
│   ├── silver.customers_deduped
│   └── silver.clickstream_events
└── gold
    ├── gold.fct_sales
    ├── gold.dim_customer
    └── gold.mart_sessions_by_category
```

Naming and catalog/schema separation (rather than just naming conventions) makes it easy to apply different retention, access control, and cost/storage tiers per layer — e.g., cheaper storage and longer retention for Bronze, stricter row/column-level security on Gold tables that feed executive dashboards.

## ⚠️ Common Gotchas & Anti-Patterns

- **Skipping Bronze "to save time"** — writing cleaned data directly with no raw landing zone means you lose the ability to reprocess from source when transformation logic changes or a bug is found downstream.
- **Putting business logic in Bronze** — Bronze should stay as-is from source; embedding business rules there makes reprocessing brittle and duplicates logic that belongs in Silver/Gold. In the clickstream example, parsing the JSON payload in Bronze (instead of Silver) would mean a single malformed event could break the whole ingestion job.
- **Over-cleaning in Silver** — Silver is "just enough" cleansing for a shared enterprise view; pushing every business-specific transformation into Silver turns it into a de facto (undocumented) Gold layer and bloats it for every consumer.
- **Gold sprawl** — an unbounded number of narrow, one-off Gold tables built per dashboard request, with no ownership or documentation, recreates the "many silos" problem inside the Gold layer itself.
- **Treating medallion as a hard requirement** — Databricks explicitly calls it a recommended pattern, not a mandate; simple use cases may not need all three layers, and forcing the pattern everywhere adds unnecessary hops.
- **No append-only discipline in Bronze** — allowing updates/deletes in Bronze defeats its purpose as an immutable historical record and audit trail.
- **Confusing "Silver is deduplicated" with "Silver is aggregated"** — Silver should stay at (or near) source grain; aggregation is Gold's job. In the worked example, `silver.clickstream_events` stays at one-row-per-event; only `gold.mart_sessions_by_category` aggregates.
- **Mismatched refresh cadence** — refreshing every layer as fast as technically possible (e.g., second-level Gold refresh for a dashboard only checked weekly) wastes compute without adding business value.

## 🎯 Best Practices

- Keep Bronze append-only and as close to source structure as practical, adding only ingestion metadata (load time, source, batch ID).
- Apply data quality expectations explicitly at each layer boundary, and log/quarantine failures rather than silently dropping or silently "fixing" bad data.
- Give each layer its own storage/schema namespace so retention, cost tier, and access policy can differ by layer.
- Document Gold tables like data products (owner, refresh SLA, consumers) to avoid uncontrolled Gold sprawl — this is where medallion architecture and data-product thinking from [Data Mesh](./Data_Mesh_Cheatsheet.md) overlap well.
- Prefer incremental/streaming processing between layers over full reprocessing where the volume justifies it, using CDC or watermark-based incremental logic.
- Reprocess from Bronze (not Silver) whenever transformation logic changes materially — that's the entire point of keeping raw history.
- Match each layer's refresh cadence to what its actual downstream consumers need, not to the fastest cadence technically achievable.

## 💡 Pro Tips

1. **Bronze is your insurance policy** — the cost of storing raw, unprocessed history is usually far lower than the cost of not being able to reprocess when a silent bug in Silver/Gold logic is discovered months later.
2. **Silver is the reusability layer** — the better Silver conforms entities once for everyone, the fewer near-duplicate Gold tables get built downstream. In the clickstream example, a second Gold use case reads the same `silver.clickstream_events` rather than re-parsing Bronze.
3. **Gold tables are products, not files** — apply the same discoverability/ownership/SLO thinking from data mesh's "data as a product" principle to your Gold layer, even in a fully centralized warehouse.
4. **Medallion is a naming convention over a well-known pattern** — if your org already has staging/ODS/marts, you likely already do "medallion" in spirit; adopting the term mainly helps when moving to lakehouse-native, streaming-capable tooling.
5. **Not every table needs three hops** — a low-volume reference table with no messy source quality issues can reasonably skip straight from Bronze to Gold.
6. **`expect` vs. `expect_or_drop` is a real design decision, not boilerplate** — use plain `expect` (warn-only) for new or unproven business rules so you can observe violation rates before deciding whether they should ever block a pipeline.
7. **Hybrid cadence beats uniform cadence** — streaming Bronze with micro-batch Silver and coarser-scheduled Gold is usually the pragmatic sweet spot; making everything equally real-time is rarely worth the added complexity and cost.
