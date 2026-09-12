# Google Cloud Composer Cheatsheet

> Fully-managed **Apache Airflow** for authoring, scheduling, and monitoring workflows (orchestration layer that ties all other GCP data services together).

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Type | Managed Apache Airflow |
| Versions | Composer 2 (GKE Autopilot-based, current) vs legacy Composer 1 |
| Best for | Orchestrating multi-step, cross-service pipelines (BigQuery → Dataflow → Dataproc → alerts) |
| Not for | The transformation logic itself — Composer *orchestrates*, it doesn't do heavy compute |

---

## 2. Core Airflow Concepts

| Concept | Description |
|---|---|
| **DAG** | Directed Acyclic Graph — defines a workflow as Python code |
| **Task** | A single unit of work (an Operator instance) inside a DAG |
| **Operator** | Template for a task (e.g., `BigQueryInsertJobOperator`, `PythonOperator`) |
| **Sensor** | Special operator that waits for a condition (file arrival, job completion) |
| **Task Instance** | A specific run of a task for a specific `execution_date` |
| **Scheduler** | Decides when DAGs/tasks should run |
| **Executor** | How tasks are run (Composer 2 uses Celery/Kubernetes executor) |
| **XCom** | Mechanism for passing small pieces of data between tasks |
| **TaskGroup** | Visually/logically groups related tasks in the UI |
| **Environment** | The managed Composer instance (Airflow webserver + scheduler + workers on GKE) |

---

## 3. Environment Management (gcloud)

```bash
# Create an environment
gcloud composer environments create my-env \
  --location=us-central1 \
  --image-version=composer-2-airflow-2.9.1 \
  --environment-size=medium

# List / describe
gcloud composer environments list --locations=us-central1
gcloud composer environments describe my-env --location=us-central1

# Upload a DAG
gcloud composer environments storage dags import \
  --environment=my-env --location=us-central1 --source=my_dag.py

# Set Airflow variables
gcloud composer environments run my-env --location=us-central1 \
  variables set -- my_var my_value

# Install a PyPI package
gcloud composer environments update my-env --location=us-central1 \
  --update-pypi-package=pandas==2.2.2

# Trigger a DAG run manually
gcloud composer environments run my-env --location=us-central1 \
  dags trigger -- my_dag_id

# View task logs from CLI
gcloud composer environments run my-env --location=us-central1 \
  tasks logs -- my_dag_id my_task_id 2026-09-01
```

---

## 4. Example DAG 1 — Basic Cross-Service Pipeline

```python
from airflow import DAG
from airflow.providers.google.cloud.operators.bigquery import BigQueryInsertJobOperator
from airflow.providers.google.cloud.operators.dataproc import DataprocSubmitJobOperator
from airflow.providers.google.cloud.transfers.gcs_to_bigquery import GCSToBigQueryOperator
from airflow.utils.dates import days_ago

default_args = {"retries": 2, "retry_delay": 300}

with DAG(
    dag_id="daily_sales_pipeline",
    schedule_interval="0 6 * * *",       # 6 AM daily
    start_date=days_ago(1),
    catchup=False,
    default_args=default_args,
    tags=["sales", "etl"],
) as dag:

    load_raw = GCSToBigQueryOperator(
        task_id="load_raw_sales",
        bucket="my-bucket",
        source_objects=["sales/{{ ds }}/*.csv"],
        destination_project_dataset_table="my_project.raw.sales",
        source_format="CSV",
        skip_leading_rows=1,
        write_disposition="WRITE_TRUNCATE",
    )

    transform = BigQueryInsertJobOperator(
        task_id="transform_sales",
        configuration={
            "query": {
                "query": "{% include 'sql/transform_sales.sql' %}",
                "useLegacySql": False,
                "destinationTable": {
                    "projectId": "my_project", "datasetId": "curated", "tableId": "sales"
                },
                "writeDisposition": "WRITE_TRUNCATE",
            }
        },
    )

    run_spark_enrichment = DataprocSubmitJobOperator(
        task_id="enrich_with_spark",
        job={"placement": {"cluster_name": "ephemeral-cluster"},
             "pyspark_job": {"main_python_file_uri": "gs://bucket/enrich.py"}},
        region="us-central1",
        project_id="my_project",
    )

    load_raw >> transform >> run_spark_enrichment
```

## 5. Example DAG 2 — Python Callables, Branching & XComs

```python
from airflow import DAG
from airflow.operators.python import PythonOperator, BranchPythonOperator
from airflow.operators.empty import EmptyOperator
from airflow.utils.dates import days_ago

def check_row_count(**context):
    from google.cloud import bigquery
    client = bigquery.Client()
    count = list(client.query("SELECT COUNT(*) n FROM my_dataset.staging").result())[0].n
    context["ti"].xcom_push(key="row_count", value=count)   # pass data to next task
    return count

def decide_branch(**context):
    count = context["ti"].xcom_pull(task_ids="check_rows", key="row_count")
    return "process_data" if count > 0 else "skip_processing"

def process_data(**context):
    count = context["ti"].xcom_pull(task_ids="check_rows", key="row_count")
    print(f"Processing {count} rows")

with DAG(
    dag_id="conditional_pipeline",
    schedule_interval="@daily",
    start_date=days_ago(1),
    catchup=False,
) as dag:

    check_rows = PythonOperator(task_id="check_rows", python_callable=check_row_count)

    branch = BranchPythonOperator(task_id="branch", python_callable=decide_branch)

    process = PythonOperator(task_id="process_data", python_callable=process_data)
    skip = EmptyOperator(task_id="skip_processing")

    check_rows >> branch >> [process, skip]
```

## 6. Example DAG 3 — TaskGroups (organizing related tasks)

```python
from airflow import DAG
from airflow.utils.task_group import TaskGroup
from airflow.providers.google.cloud.operators.bigquery import BigQueryInsertJobOperator
from airflow.utils.dates import days_ago

with DAG("grouped_pipeline", schedule_interval="@daily", start_date=days_ago(1), catchup=False) as dag:

    with TaskGroup("extract_tasks") as extract_group:
        extract_orders = BigQueryInsertJobOperator(
            task_id="extract_orders",
            configuration={"query": {"query": "CALL my_dataset.extract_orders()", "useLegacySql": False}},
        )
        extract_users = BigQueryInsertJobOperator(
            task_id="extract_users",
            configuration={"query": {"query": "CALL my_dataset.extract_users()", "useLegacySql": False}},
        )

    with TaskGroup("transform_tasks") as transform_group:
        build_mart = BigQueryInsertJobOperator(
            task_id="build_mart",
            configuration={"query": {"query": "CALL my_dataset.build_mart()", "useLegacySql": False}},
        )

    extract_group >> transform_group
```

## 7. Example DAG 4 — Sensors (waiting for external conditions)

```python
from airflow import DAG
from airflow.providers.google.cloud.sensors.gcs import GCSObjectExistenceSensor
from airflow.providers.google.cloud.sensors.bigquery import BigQueryTableExistenceSensor
from airflow.providers.google.cloud.operators.bigquery import BigQueryInsertJobOperator
from airflow.utils.dates import days_ago

with DAG("file_triggered_pipeline", schedule_interval="@daily", start_date=days_ago(1), catchup=False) as dag:

    wait_for_file = GCSObjectExistenceSensor(
        task_id="wait_for_file",
        bucket="my-bucket",
        object="incoming/{{ ds }}/data.csv",
        mode="reschedule",     # don't hold a worker slot while waiting
        poke_interval=60,
        timeout=60 * 60 * 6,   # give up after 6 hours
    )

    wait_for_table = BigQueryTableExistenceSensor(
        task_id="wait_for_upstream_table",
        project_id="my-project",
        dataset_id="raw",
        table_id="upstream_data",
        mode="reschedule",
    )

    process = BigQueryInsertJobOperator(
        task_id="process",
        configuration={"query": {"query": "CALL my_dataset.process_daily()", "useLegacySql": False}},
    )

    [wait_for_file, wait_for_table] >> process
```

## 8. Example DAG 5 — Dynamic Task Mapping (Airflow 2.3+)

```python
from airflow import DAG
from airflow.decorators import task
from airflow.utils.dates import days_ago

with DAG("dynamic_per_country", schedule_interval="@daily", start_date=days_ago(1), catchup=False) as dag:

    @task
    def get_countries():
        return ["PH", "US", "SG", "JP"]

    @task
    def process_country(country: str):
        print(f"Processing data for {country}")

    process_country.expand(country=get_countries())
```

## 9. Example DAG 6 — Failure Callbacks & Alerting

```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.utils.dates import days_ago

def notify_slack_on_failure(context):
    import requests
    task_id = context["task_instance"].task_id
    dag_id = context["dag"].dag_id
    requests.post("https://hooks.slack.com/services/XXX",
                   json={"text": f"❌ Task {task_id} in DAG {dag_id} failed"})

default_args = {
    "on_failure_callback": notify_slack_on_failure,
    "retries": 1,
}

with DAG("monitored_pipeline", default_args=default_args,
         schedule_interval="@daily", start_date=days_ago(1), catchup=False) as dag:

    def risky_task():
        raise ValueError("Simulated failure")

    task1 = PythonOperator(task_id="risky_task", python_callable=risky_task)
```

## 10. Example DAG 7 — Cross-DAG Dependencies with Datasets (Airflow 2.4+)

```python
from airflow import DAG, Dataset
from airflow.operators.python import PythonOperator
from airflow.utils.dates import days_ago

sales_dataset = Dataset("bigquery://my-project/my_dataset/sales")

# Producer DAG
with DAG("produce_sales", schedule_interval="@daily", start_date=days_ago(1), catchup=False) as dag1:
    PythonOperator(task_id="load_sales", python_callable=lambda: None, outlets=[sales_dataset])

# Consumer DAG — triggers automatically when sales_dataset is updated
with DAG("consume_sales", schedule=[sales_dataset], start_date=days_ago(1), catchup=False) as dag2:
    PythonOperator(task_id="build_report", python_callable=lambda: None)
```

---

## 11. Common GCP Operators Cheat-Table

| Operator | Purpose |
|---|---|
| `BigQueryInsertJobOperator` | Run a BQ query/load/extract job |
| `BigQueryCheckOperator` | Data quality assertion via SQL |
| `GCSToBigQueryOperator` | Load files from GCS into BQ |
| `BigQueryToGCSOperator` | Export BQ table to GCS |
| `DataflowTemplatedJobStartOperator` | Launch a Dataflow classic template |
| `DataflowStartFlexTemplateOperator` | Launch a Dataflow flex template |
| `DataprocCreateClusterOperator` / `DataprocDeleteClusterOperator` | Manage ephemeral Dataproc clusters |
| `DataprocSubmitJobOperator` | Submit Spark/Hadoop/Hive job to Dataproc |
| `DataformCreateWorkflowInvocationOperator` | Trigger a Dataform run |
| `PubSubPublishMessageOperator` | Publish a message to Pub/Sub |
| `GCSObjectExistenceSensor` | Wait for a file to land in GCS |
| `BigQueryTableExistenceSensor` | Wait for a BQ table/partition to exist |

---

## 12. Variables, Connections & Secrets

```bash
# Variables (non-secret config)
airflow variables set my_key my_value

# Connections (e.g., external DB)
airflow connections add my_gcp_conn --conn-type google_cloud_platform

# Secrets — prefer Secret Manager backend over plaintext Airflow variables
```

Access variables/connections inside a DAG:
```python
from airflow.models import Variable

api_key = Variable.get("my_api_key")
config = Variable.get("pipeline_config", deserialize_json=True)
```

Configure the **Secret Manager backend** in `airflow.cfg`/environment overrides so credentials never sit in plaintext Airflow metadata DB.

---

## 13. Scaling & Environment Sizing

| Size | Use case |
|---|---|
| Small | Dev/test, few DAGs |
| Medium | Production, moderate DAG count/concurrency |
| Large | High DAG volume, many concurrent task instances |

- Composer 2 scales **workers automatically** (GKE Autopilot) between min/max worker counts you configure.
- Tune `[celery] worker_concurrency`, `[core] parallelism`, and `max_active_runs_per_dag` for throughput.
- Avoid one giant DAG with thousands of tasks — split into logical DAGs with `TriggerDagRunOperator`/datasets for cross-DAG dependencies.

---

## 14. Pricing

Billed for the underlying **GKE Autopilot resources** (vCPU, memory, storage) consumed by the Airflow webserver, scheduler, workers, plus a small Composer premium — no separate "per DAG run" charge.

---

## 15. Monitoring

- **Airflow UI**: DAG graph/grid view, task logs, Gantt chart.
- **Cloud Monitoring**: environment health, scheduler heartbeat, task success/failure rate.
- Set up **SLA misses** and **on_failure_callback** (e.g., post to Slack/Pub-Sub) for alerting.
- Cloud Logging captures all task logs centrally.

```python
# SLA example — alert if a task doesn't finish within 30 minutes
from datetime import timedelta

task1 = PythonOperator(
    task_id="critical_task", python_callable=lambda: None, sla=timedelta(minutes=30)
)
```

---

## 16. Common Gotchas

- DAGs are parsed repeatedly by the scheduler — expensive top-level code (API calls, heavy imports) in a DAG file slows down *all* DAG parsing.
- `catchup=True` (default in older Airflow) can trigger a flood of backfill runs if not set explicitly.
- Task retries + non-idempotent operators (e.g., blind `INSERT` instead of `MERGE`) cause duplicate data.
- GKE node pool upgrades during Composer maintenance windows can briefly disrupt running tasks — schedule maintenance windows carefully.
- Custom PyPI packages can conflict with Composer's pinned core dependencies — test in a staging environment first.
- Long-running sensors in default (`poke`) mode hold a worker slot the whole time — use `mode="reschedule"` instead.
- XComs are meant for small data (metadata, counts, file paths) — never pass large DataFrames through XCom.

---

## 17. Useful Links

- Docs: https://cloud.google.com/composer/docs
- Airflow Operators (Google provider): https://airflow.apache.org/docs/apache-airflow-providers-google/stable/operators/cloud/index.html
- Pricing: https://cloud.google.com/composer/pricing
