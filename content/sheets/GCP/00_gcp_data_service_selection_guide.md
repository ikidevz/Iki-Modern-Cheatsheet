# GCP Data Engineering & Analytics — Service Selection Guide

> A quick index for choosing the right tool. Read this first, then dive into the individual cheatsheets.

---

## 1. The Toolkit at a Glance

| File | Service | Role |
|---|---|---|
| `01_bigquery_cheatsheet.md` | **BigQuery** | Data warehouse, SQL analytics, ML on structured data |
| `02_dataflow_cheatsheet.md` | **Dataflow** | Batch + streaming data processing (Apache Beam) |
| `03_pubsub_cheatsheet.md` | **Pub/Sub** | Real-time messaging / event ingestion |
| `04_dataproc_cheatsheet.md` | **Dataproc** | Managed Spark/Hadoop for big-data processing |
| `05_cloud_composer_cheatsheet.md` | **Cloud Composer** | Workflow orchestration (managed Airflow) |
| `06_cloud_storage_cheatsheet.md` | **Cloud Storage (GCS)** | Data lake / staging object storage |
| `07_dataform_cheatsheet.md` | **Dataform** | In-warehouse SQL transformations (ELT "T" layer) |
| `08_looker_studio_cheatsheet.md` | **Looker Studio** | Free BI dashboards & reporting |

---

## 2. Decision Guide by Use Case

| I need to... | Use |
|---|---|
| Run ad-hoc SQL / build a warehouse | **BigQuery** |
| Ingest real-time events from apps/devices | **Pub/Sub** |
| Process a real-time event stream into aggregates | **Dataflow** (streaming) |
| Run a nightly batch ETL job with custom transform logic | **Dataflow** (batch) or **Dataproc** (if it's existing Spark/Hadoop code) |
| Migrate an existing Hadoop/Spark workload | **Dataproc** |
| Transform raw BQ tables into clean analytics tables, with tests | **Dataform** |
| Chain BigQuery → Dataflow → Dataproc → alerting into one pipeline | **Cloud Composer** |
| Store raw files / act as a data lake | **Cloud Storage** |
| Build a dashboard for stakeholders | **Looker Studio** (or full Looker for enterprise governance) |
| Enterprise governed semantic layer, embedded analytics | **Looker** (full product, not covered here) |

---

## 3. A Typical End-to-End Architecture

```
 Event sources (apps, IoT, CDC)
        │
        ▼
   ┌──────────┐
   │ Pub/Sub  │  ← real-time ingestion
   └────┬─────┘
        ▼
   ┌──────────┐        ┌────────────────┐
   │ Dataflow │───────▶│ Cloud Storage   │  (raw/landing zone, backups)
   └────┬─────┘        └────────────────┘
        ▼
   ┌──────────────┐
   │  BigQuery     │  ← raw tables
   │  (raw layer)  │
   └──────┬────────┘
          ▼
   ┌──────────────┐
   │  Dataform     │  ← SQL transforms: raw → staging → marts
   └──────┬────────┘
          ▼
   ┌──────────────┐        ┌─────────────────┐
   │  BigQuery     │───────▶│ Looker Studio    │  ← dashboards
   │  (marts)      │        └─────────────────┘
   └──────────────┘

 Cloud Composer orchestrates/schedules the batch pieces above
 (Dataflow batch jobs, Dataform runs, Dataproc jobs) end-to-end.
```

---

## 4. Data Engineer vs Data Analyst — Typical Tool Split

| Role | Primary tools | Secondary/occasional |
|---|---|---|
| **Data Engineer** | Pub/Sub, Dataflow, Dataproc, Cloud Composer, Cloud Storage, BigQuery (DDL/pipelines) | Dataform, Terraform/IaC for GCP resources |
| **Analytics Engineer** | Dataform, BigQuery (SQL modeling) | Cloud Composer (light), Looker Studio |
| **Data Analyst** | BigQuery (SQL queries), Looker Studio | Dataform (light, for reusable metrics), Sheets/Connected Sheets |

---

## 5. Batch vs Streaming — Which Ingestion/Processing Combo?

| Requirement | Combo |
|---|---|
| Real-time (seconds) dashboards/alerts | Pub/Sub → Dataflow (streaming) → BigQuery |
| Near-real-time, simple schema, no transforms | Pub/Sub → BigQuery subscription (skip Dataflow) |
| Daily/hourly batch loads from files | GCS → BigQuery (`bq load`) or GCS → Dataflow (batch) → BigQuery |
| Complex big-data batch processing (existing Spark code) | GCS → Dataproc (Spark) → BigQuery/GCS |
| Orchestrating any of the above on a schedule with dependencies | Cloud Composer |

---

## 6. Cost-Saving Cheat Notes (cross-service)

- **BigQuery**: partition + cluster tables; avoid `SELECT *`; use flat-rate/editions if query volume is high and predictable.
- **Dataflow**: use FlexRS for non-urgent batch; enable Streaming Engine to shrink worker size.
- **Dataproc**: use ephemeral clusters + preemptible/spot workers; consider Dataproc Serverless to avoid idle cluster cost.
- **Pub/Sub**: watch message/GB volume; consider Pub/Sub Lite for very high steady-state throughput.
- **Cloud Storage**: apply lifecycle rules to move cold data to Nearline/Coldline/Archive.
- **Composer**: right-size environment (small/medium/large); avoid giant single DAGs that slow down scheduling for everyone.
- **Looker Studio**: use Extracts instead of Live connections to cut repeated BigQuery scan costs.

---

## 7. Reference Implementation — Tying It All Together in Python

A minimal, realistic sketch of how the pieces connect for a streaming-to-dashboard pipeline. Each snippet below is expanded with far more detail in its own cheatsheet — this just shows how they chain together.

```python
# 1) Publish an event (producer side — e.g. inside your application backend)
from google.cloud import pubsub_v1
import json

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path("my-project", "orders")
publisher.publish(topic_path, data=json.dumps({
    "order_id": "o123", "user_id": "u1", "amount": 49.99, "country": "PH"
}).encode("utf-8")).result()
```

```python
# 2) Dataflow streaming pipeline consumes Pub/Sub and lands raw data in BigQuery
import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions

options = PipelineOptions(runner="DataflowRunner", project="my-project",
                           region="us-central1", streaming=True,
                           temp_location="gs://my-bucket/tmp")

with beam.Pipeline(options=options) as p:
    (p
     | "Read" >> beam.io.ReadFromPubSub(topic="projects/my-project/topics/orders")
     | "Parse" >> beam.Map(lambda b: json.loads(b.decode("utf-8")))
     | "WriteRaw" >> beam.io.WriteToBigQuery(
           "my-project:raw.orders",
           schema="order_id:STRING,user_id:STRING,amount:FLOAT,country:STRING",
           write_disposition=beam.io.BigQueryDisposition.WRITE_APPEND))
```

```python
# 3) Dataform (or a scheduled query) transforms raw -> marts
#    (see 07_dataform_cheatsheet.md for the full .sqlx version)
from google.cloud import bigquery

client = bigquery.Client()
client.query("""
    CREATE OR REPLACE TABLE `my_project.marts.fct_daily_sales`
    PARTITION BY order_date AS
    SELECT DATE(_PARTITIONTIME) AS order_date, country, SUM(amount) AS total_sales
    FROM `my_project.raw.orders`
    GROUP BY 1, 2
""").result()
```

```python
# 4) Cloud Composer DAG orchestrates step 3 on a schedule
from airflow import DAG
from airflow.providers.google.cloud.operators.bigquery import BigQueryInsertJobOperator
from airflow.utils.dates import days_ago

with DAG("refresh_sales_marts", schedule_interval="@hourly",
         start_date=days_ago(1), catchup=False) as dag:
    BigQueryInsertJobOperator(
        task_id="build_fct_daily_sales",
        configuration={"query": {
            "query": "CALL my_dataset.refresh_fct_daily_sales()",
            "useLegacySql": False,
        }},
    )
# 5) Looker Studio then connects (Live or Extract) to `marts.fct_daily_sales`
#    for the analyst-facing dashboard — no code needed, just a data source connection.
```

---

## 8. Where to Go Deeper

Each linked cheatsheet includes: core concepts, CLI commands, extensive code snippets (Python-first, plus SQL/PySpark where relevant), pricing model, performance tips, monitoring pointers, and common gotchas — read the relevant one before implementing.
