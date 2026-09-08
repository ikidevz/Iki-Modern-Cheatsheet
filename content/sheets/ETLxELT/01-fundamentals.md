# Fundamentals & Core Concepts

## ETL vs ELT

**Definition:** ETL (Extract, Transform, Load) transforms data *before* it reaches the target system. ELT (Extract, Load, Transform) loads raw data first and transforms it *inside* the target system.

**Key Points:**
- ETL relies on a separate transform engine/staging server between source and target.
- ELT pushes transformation work onto the destination warehouse's own compute.
- ELT keeps raw data available for reprocessing without re-extracting from source.

**Example:**

| | ETL | ELT |
|---|---|---|
| Order | Extract → Transform → Load | Extract → Load → Transform |
| Transform location | Staging server / ETL engine | Inside the target warehouse |
| Compute | Dedicated transform engine | Warehouse compute (Snowflake, BigQuery, Databricks) |
| Tools | Informatica, Talend, SSIS | Fivetran + dbt, Airbyte + dbt |

**When to Use / Trade-offs:**
- Use ETL when data must be cleaned/masked before it lands anywhere (strict compliance, small structured volumes).
- Use ELT when the warehouse has cheap, elastic compute and you want raw data preserved for flexible reprocessing.

**Common Pitfalls:**
- Choosing ETL out of habit when warehouse compute would be cheaper and simpler (ELT).
- Loading raw ELT data without access controls, exposing unmasked sensitive fields before transformation.

---

## Batch vs Micro-batch vs Streaming

**Definition:** Three processing paradigms distinguished by how frequently and in what size chunks data moves through a pipeline.

**Key Points:**
- Batch: scheduled, bulk processing (hourly/daily).
- Micro-batch: small batches on short intervals (seconds to minutes).
- Streaming: continuous, event-by-event processing with no fixed batch boundary.

**Example:**
- Batch: nightly job aggregates yesterday's sales into a reporting table.
- Micro-batch: Spark Structured Streaming processes new files every 30 seconds.
- Streaming: Flink job updates a fraud-detection score the instant a transaction event arrives.

**When to Use / Trade-offs:**
- Batch — lowest cost and complexity; fine when hours of latency are acceptable.
- Micro-batch — good middle ground; near-real-time without full streaming infrastructure.
- Streaming — needed for sub-second decisions (fraud detection, real-time personalization), at the cost of operational complexity.

**Common Pitfalls:**
- Building a full streaming pipeline when a daily batch job would satisfy the actual business requirement.
- Underestimating the operational burden (monitoring, state management, exactly-once handling) that streaming introduces.

---

## OLTP vs OLAP

**Definition:** OLTP (Online Transaction Processing) systems handle day-to-day transactional operations. OLAP (Online Analytical Processing) systems are optimized for complex analytical queries over large volumes.

**Key Points:**
- OLTP schemas are normalized to minimize redundancy and support fast, small writes.
- OLAP schemas are denormalized (star/snowflake) to minimize joins during large scans.
- OLTP systems are the *source*; OLAP/warehouse systems are typically the *destination* of ETL/ELT pipelines.

**Example:**

| | OLTP | OLAP |
|---|---|---|
| Purpose | Transactional apps | Analytics/reporting |
| Schema | Highly normalized | Denormalized (star/snowflake) |
| Query pattern | Short reads/writes | Complex aggregations over large scans |
| Example system | Postgres app DB | Snowflake, BigQuery, Redshift |

**When to Use / Trade-offs:**
- Never run heavy analytical queries directly against an OLTP production database — it competes with live application traffic.
- Always replicate/extract OLTP data into an OLAP system for reporting workloads.

**Common Pitfalls:**
- Analysts querying production OLTP databases directly, causing performance incidents for the live application.
- Normalizing a warehouse schema like an OLTP system, resulting in excessive joins and slow dashboards.

---

## Data Warehouse vs Data Lake vs Lakehouse

**Definition:** Three storage paradigms differing in schema enforcement, data structure, and cost profile.

**Key Points:**
- Data Warehouse — structured, schema-on-write, optimized for SQL analytics.
- Data Lake — raw/semi-structured, schema-on-read, cheap object storage.
- Lakehouse — lake storage with warehouse-like transactions and schema enforcement layered on top.

**Example:**
- Warehouse: Snowflake, Redshift, BigQuery.
- Lake: raw files in S3, ADLS, or GCS.
- Lakehouse: Databricks with Delta Lake, or a lake with Apache Iceberg/Hudi table formats.

**When to Use / Trade-offs:**
- Warehouse — best when data is well-structured and consumers need reliable, fast SQL access.
- Lake — best for cheap storage of diverse/raw data (logs, images, semi-structured JSON) before it's known how it'll be used.
- Lakehouse — best when you want lake economics with warehouse-grade reliability (ACID transactions, schema enforcement) in one system.

**Common Pitfalls:**
- Letting a data lake become a "data swamp" — ungoverned, undocumented raw files nobody can reliably query.
- Assuming lakehouse table formats (Iceberg/Delta/Hudi) are interchangeable — query engine support and features differ.

---

## Push vs Pull Architectures

**Definition:** Describes which side initiates data movement — the source system (push) or the pipeline (pull).

**Key Points:**
- Push: source sends data as events occur (webhooks, CDC streams, message queues).
- Pull: pipeline requests data on its own schedule (API polling, scheduled DB queries).

**Example:**
- Push: a payment provider sends a webhook the instant a transaction completes.
- Pull: a nightly job queries `SELECT * WHERE updated_at > :last_run`.

**When to Use / Trade-offs:**
- Push suits low-latency requirements but cedes timing control to the source.
- Pull is simpler to implement and control, but can miss real-time changes and adds periodic load to the source.

**Common Pitfalls:**
- Relying on pull for high-frequency data when push (CDC/webhooks) would reduce both latency and source load.
- Building push-based ingestion without idempotent handling — replayed or duplicate events corrupt downstream data.
