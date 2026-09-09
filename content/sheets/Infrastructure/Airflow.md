# Apache Airflow Cheatsheet for Data & Analytics Engineers

> A structured Airflow reference for data & analytics engineers — installation and DAG authoring through TaskFlow, dynamic task mapping, asset-aware scheduling, sensors, testing, performance, and security. Written against **Apache Airflow 3.3.1** (latest stable as of September 2026). Airflow 3 is a major, breaking-change release: DAG authoring now goes through the stable `airflow.sdk` namespace, `execution_date` is gone in favor of `logical_date`, core operators (Bash/Python/Empty/etc.) moved into the `standard` provider, `SubDagOperator` is removed in favor of TaskGroups, and the webserver is now a generic `api-server`. Where relevant, this sheet calls out the Airflow 2.x equivalent so migrating teams can map old patterns to new ones.

## 📑 Table of Contents

1. [🧑‍💻 Complete Working Examples](#complete-working-examples)
2. [🚀 Installation & Project Setup](#installation-project-setup)
3. [📊 Building Your First DAG](#building-your-first-dag)
4. [🧩 TaskFlow API](#taskflow-api)
5. [🔗 Operators & Providers](#operators-providers)
6. [🌐 Task Dependencies & Control Flow](#task-dependencies-control-flow)
7. [🗂️ Dynamic Task Mapping](#dynamic-task-mapping)
8. [📦 Assets & Data-Aware Scheduling](#assets-data-aware-scheduling)
9. [⏱️ Scheduling & Timetables](#scheduling-timetables)
10. [🪟 Sensors & Deferrable Operators](#sensors-deferrable-operators)
11. [🔀 Branching & Conditional Logic](#branching-conditional-logic)
12. [🔑 Variables, Connections & Params](#variables-connections-params)
13. [💾 XComs](#xcoms)
14. [🏗️ DAG Design Patterns](#dag-design-patterns)
15. [🧪 Testing & Debugging](#testing-debugging)
16. [⚡ Performance & Scaling](#performance-scaling)
17. [🔐 Security & Access Control](#security-access-control)
18. [🛠️ CLI Reference](#cli-reference)
19. [⚠️ Common Gotchas](#common-gotchas)
20. [🎯 Best Practices](#best-practices)
21. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

**Syntax cheatsheet**

| Task                     | Syntax                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| Define a DAG             | `with DAG(dag_id=..., start_date=..., schedule=..., catchup=False) as dag:` or `@dag(...)` |
| Define a task            | `@task` decorator (TaskFlow) or classic `SomeOperator(task_id=..., ...)`                   |
| Set dependencies         | `a >> b >> c`, `a >> [b, c]`, `chain(a, b, c)`                                             |
| Pass data between tasks  | Return a value from a `@task` function — it's auto-pushed/pulled via XCom                  |
| Map over a list          | `my_task.expand(param=[...])`, `my_task.partial(fixed=1).expand(x=[...])`                  |
| Branch                   | `@task.branch` returning the task_id(s) to run next                                        |
| Schedule on data         | `schedule=[asset_a, asset_b]` instead of a cron string                                     |
| Read a Variable          | `Variable.get("key")` / `Variable.get("key", deserialize_json=True)`                       |
| Group tasks visually     | `with TaskGroup(group_id="...") as tg: ...`                                                |
| Test one task            | `airflow tasks test <dag_id> <task_id> <logical_date>`                                     |
| Run whole DAG in-process | `my_dag_function().test()`                                                                 |
| Lint for Airflow 3       | `ruff check dags/ --select AIR301,AIR302 --show-fixes`                                     |

**Schedule cheat sheet**

| Value                                                               | Meaning                                                                      |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `None`                                                              | Manual/externally triggered only, no automatic runs                          |
| `"@once"`                                                           | Run exactly one time                                                         |
| `"@hourly"` / `"@daily"` / `"@weekly"` / `"@monthly"` / `"@yearly"` | Cron presets                                                                 |
| `"0 6 * * *"`                                                       | Cron expression (6 AM daily)                                                 |
| `timedelta(hours=4)`                                                | Fixed interval                                                               |
| `[asset_a, asset_b]`                                                | Asset-aware / data-driven scheduling                                         |
| `AssetOrTimeSchedule(...)`                                          | Combine a cron/trigger timetable with asset dependencies                     |
| `CronTriggerTimetable(...)`                                         | Cron-like schedule that triggers at the _end_ of the interval, not the start |
| Custom `Timetable` subclass                                         | Fully custom scheduling logic (holidays, business days, etc.)                |

**Trigger rule cheat sheet**

| Trigger rule                  | Task runs when...                                          |
| ----------------------------- | ---------------------------------------------------------- |
| `all_success` (default)       | All upstream tasks succeeded                               |
| `all_failed`                  | All upstream tasks failed                                  |
| `all_done`                    | All upstream tasks finished, regardless of state (cleanup) |
| `one_failed`                  | At least one upstream task failed                          |
| `one_success`                 | At least one upstream task succeeded                       |
| `none_failed`                 | No upstream failed (skips are OK)                          |
| `none_failed_min_one_success` | No upstream failed and at least one succeeded              |
| `none_skipped`                | No upstream task was skipped                               |
| `always`                      | Runs no matter what happened upstream                      |

## 🧑‍💻 Complete Working Examples

Five end-to-end DAGs you can copy, rename, and adapt. Each one is a self-contained pattern — read the **Purpose** blurb to decide which one matches the problem you're solving before you start combining techniques from the reference sections above.

### 1. Daily API-to-Warehouse ETL (TaskFlow basics)

**Purpose:** This is the pattern to reach for whenever you need a straightforward, scheduled extract → transform → load job — pulling from an API or file, cleaning the data, and writing it somewhere durable. It demonstrates the core TaskFlow building blocks: passing data between tasks via return values (no manual XCom calls), typed function signatures, per-task retries, and a linear dependency chain. Use this as your default starting template for any new batch pipeline before reaching for more advanced patterns.

```python
import pendulum
from airflow.sdk import dag, task

@dag(
    dag_id="daily_sales_etl",
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    schedule="0 6 * * *",
    catchup=False,
    default_args={"retries": 3},
    tags=["sales", "etl"],
)
def daily_sales_etl():

    @task
    def extract() -> list[dict]:
        """Pull yesterday's raw sales records from the source API."""
        import requests
        resp = requests.get("https://internal-api.company.com/sales/yesterday")
        resp.raise_for_status()
        return resp.json()

    @task
    def transform(records: list[dict]) -> list[dict]:
        """Drop cancelled orders and normalize currency to USD."""
        return [
            {**r, "amount_usd": r["amount"] * r.get("fx_rate", 1.0)}
            for r in records
            if r.get("status") != "cancelled"
        ]

    @task
    def load(records: list[dict]) -> int:
        """Upsert cleaned records into the warehouse; returns row count."""
        from airflow.providers.postgres.hooks.postgres import PostgresHook
        hook = PostgresHook(postgres_conn_id="warehouse")
        hook.insert_rows(
            table="sales_fact",
            rows=[(r["id"], r["amount_usd"]) for r in records],
            target_fields=["order_id", "amount_usd"],
            replace=True,
            replace_index="order_id",
        )
        return len(records)

    @task
    def notify(row_count: int) -> None:
        print(f"daily_sales_etl loaded {row_count} rows")

    notify(load(transform(extract())))

daily_sales_etl()
```

### 2. Dynamic Multi-Region File Processing (Task Mapping)

**Purpose:** Use this pattern any time the _number_ of things to process varies from run to run — a list of files that landed overnight, one job per region/customer/partition, etc. — and you don't want to hardcode a fixed set of parallel tasks. It shows `expand()` fanning out one mapped task per discovered file, `partial()` fixing a shared argument across all mapped instances, and a downstream task that aggregates the mapped results back into one summary. This replaces the old anti-pattern of writing a Python `for` loop at the top of the DAG file to generate static tasks.

```python
import pendulum
from airflow.sdk import dag, task

@dag(
    dag_id="regional_file_processor",
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    schedule="@hourly",
    catchup=False,
)
def regional_file_processor():

    @task
    def list_incoming_files() -> list[str]:
        """Discover this hour's landed files — the count varies every run."""
        import boto3
        s3 = boto3.client("s3")
        resp = s3.list_objects_v2(Bucket="data-lake", Prefix="incoming/regional/")
        return [obj["Key"] for obj in resp.get("Contents", [])]

    @task
    def process_file(key: str, dedupe: bool) -> dict:
        """Runs once per file, in parallel, as a separate mapped task instance."""
        region = key.split("/")[-1].split("_")[0]
        # ... read, clean, and write the file here ...
        return {"region": region, "rows": 500}

    @task
    def summarize(results: list[dict]) -> None:
        """Fan-in: aggregate every mapped task's return value."""
        total = sum(r["rows"] for r in results)
        print(f"Processed {len(results)} files, {total} total rows")

    files = list_incoming_files()
    results = process_file.partial(dedupe=True).expand(key=files)
    summarize(results)

regional_file_processor()
```

### 3. Cross-DAG Producer/Consumer via Assets (data-aware scheduling)

**Purpose:** Reach for this whenever one pipeline's output should trigger another pipeline — and that trigger should fire based on _data actually being ready_, not on a guessed time offset. This is the modern replacement for chaining two DAGs with `ExternalTaskSensor` polling loops: the consumer DAG has no schedule of its own and simply wakes up the moment the producer's task successfully updates the Asset. It demonstrates declaring a shared `Asset`, marking it as an `outlet` on the producing task, and using it as the `schedule` for the consuming DAG.

```python
import pendulum
from airflow.sdk import DAG, Asset, task

raw_orders = Asset("s3://data-lake/raw/orders/")

# --- Producer DAG: runs on a schedule, updates the asset when it finishes ---
with DAG(
    dag_id="orders_producer",
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    schedule="@daily",
    catchup=False,
) as producer_dag:

    @task(outlets=[raw_orders])
    def extract_and_land_orders():
        """Writes the day's raw orders to the lake, then marks the asset updated."""
        ...  # extract from source system, write to s3://data-lake/raw/orders/

    extract_and_land_orders()

# --- Consumer DAG: no time schedule — triggers only when raw_orders updates ---
with DAG(
    dag_id="orders_consumer",
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    schedule=[raw_orders],
    catchup=False,
) as consumer_dag:

    @task
    def clean_and_load_orders():
        """Runs automatically the moment orders_producer lands new data."""
        ...  # read from s3://data-lake/raw/orders/, clean, load to warehouse

    clean_and_load_orders()
```

### 4. Data Quality Gate with Branching and Alerting

**Purpose:** Use this whenever a pipeline needs to make a decision and react differently depending on the outcome — most commonly, validating data quality and either continuing normally or alerting a human instead of silently loading bad data. It shows `@task.branch` picking one of two downstream paths, and a cleanup/alert task with `trigger_rule="one_failed"` so it _only_ fires when something upstream actually went wrong — the opposite of the default `all_success` behavior.

```python
import pendulum
from airflow.sdk import dag, task
from airflow.providers.standard.operators.python import PythonOperator

@dag(
    dag_id="orders_quality_gate",
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    schedule="@daily",
    catchup=False,
)
def orders_quality_gate():

    @task
    def extract() -> list[dict]:
        return [{"id": 1, "amount": 42.0}]  # ... real extraction here

    @task
    def count_nulls(records: list[dict]) -> int:
        return sum(1 for r in records if r.get("amount") is None)

    @task.branch
    def check_quality(null_count: int) -> str:
        """Route to the happy path or the alert path based on data quality."""
        return "load_orders" if null_count == 0 else "alert_data_team"

    @task
    def load_orders() -> None:
        print("Quality check passed — loading into the warehouse")

    @task(trigger_rule="none_failed_min_one_success")
    def alert_data_team() -> None:
        """Only reached when check_quality routed here — page/notify the team."""
        print("ALERT: null amounts detected in today's orders extract")

    records = extract()
    null_count = count_nulls(records)
    check_quality(null_count) >> [load_orders(), alert_data_team()]

orders_quality_gate()
```

### 5. Wait-for-File Then Process (deferrable sensor)

**Purpose:** Use this pattern for pipelines that depend on an upstream system dropping a file or object on its own schedule, where you don't control the timing and don't want a worker slot tied up polling for hours. It shows a deferrable sensor (`deferrable=True`) that hands waiting off to the triggerer process — freeing the worker completely between checks — followed by processing once the file actually appears, with `execution_timeout` guarding against a file that never arrives.

```python
from datetime import timedelta
import pendulum
from airflow.sdk import dag, task
from airflow.providers.amazon.aws.sensors.s3 import S3KeySensor

@dag(
    dag_id="wait_and_process_export",
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    schedule="@daily",
    catchup=False,
)
def wait_and_process_export():

    wait_for_export = S3KeySensor(
        task_id="wait_for_export",
        bucket_name="partner-exports",
        bucket_key="exports/{{ ds }}/full_export.csv",
        deferrable=True,                       # frees the worker slot while waiting
        timeout=60 * 60 * 6,                   # give up after 6 hours
        execution_timeout=timedelta(hours=7),
    )

    @task
    def process_export() -> int:
        """Only runs once wait_for_export confirms the file exists."""
        import boto3
        s3 = boto3.client("s3")
        obj = s3.get_object(Bucket="partner-exports", Key="exports/latest/full_export.csv")
        rows = obj["Body"].read().decode().splitlines()
        return len(rows)

    @task
    def log_result(row_count: int) -> None:
        print(f"Processed export with {row_count} rows")

    wait_for_export >> log_result(process_export())

wait_and_process_export()
```

## 🚀 Installation & Project Setup

```bash
# Install with a constraints file (pins provider/dependency versions to a tested set)
pip install "apache-airflow==3.3.1" \
  --constraint "https://raw.githubusercontent.com/apache/airflow/constraints-3.3.1/constraints-3.12.txt"

# Install with extras for the providers you actually need
pip install "apache-airflow[postgres,amazon,cncf.kubernetes]==3.3.1" \
  --constraint "https://raw.githubusercontent.com/apache/airflow/constraints-3.3.1/constraints-3.12.txt"

# One-command local dev environment: runs api-server, scheduler,
# dag-processor and triggerer together with SQLite + SequentialExecutor
export AIRFLOW_HOME=~/airflow
airflow standalone

# Production-style component startup (each runs as its own process/service)
airflow db migrate            # initialize/upgrade the metadata database
airflow api-server --port 8080   # replaces the old `airflow webserver`
airflow scheduler
airflow dag-processor         # DAG file parsing is always a separate service in Airflow 3
airflow triggerer              # required for deferrable operators/sensors
```

```
# Typical project layout
my-airflow-project/
├── dags/
│   ├── etl_daily_sales.py
│   └── assets.py
├── plugins/
├── include/               # SQL files, config, helper data
├── tests/
│   └── test_dag_validity.py
├── requirements.txt
└── airflow.cfg            # or use AIRFLOW__SECTION__KEY env vars instead
```

```bash
# Config via environment variables (preferred for containers/CI)
export AIRFLOW__CORE__EXECUTOR=LocalExecutor
export AIRFLOW__DATABASE__SQL_ALCHEMY_CONN="postgresql+psycopg2://user:pass@host/airflow"
export AIRFLOW__CORE__DAGS_FOLDER=/opt/airflow/dags
export AIRFLOW__CORE__LOAD_EXAMPLES=False

# Audit/migrate an existing airflow.cfg ahead of an Airflow 3 upgrade
airflow config lint
airflow config update
```

## 📊 Building Your First DAG

```python
from datetime import datetime, timedelta
from airflow.sdk import DAG
from airflow.providers.standard.operators.bash import BashOperator
from airflow.providers.standard.operators.python import PythonOperator

default_args = {
    "owner": "data-eng",
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": True,
    "email": ["alerts@company.com"],
}

with DAG(
    dag_id="etl_daily_sales",
    description="Daily sales extract-transform-load pipeline",
    start_date=datetime(2026, 1, 1),
    schedule="0 6 * * *",        # `schedule_interval` was removed in Airflow 3 — use `schedule`
    catchup=False,                # defaults to False in Airflow 3 (was True in 2.x)
    default_args=default_args,
    max_active_runs=1,
    tags=["sales", "etl"],
) as dag:

    extract = PythonOperator(task_id="extract", python_callable=lambda: None)
    transform = BashOperator(task_id="transform", bash_command="python transform.py")
    load = PythonOperator(task_id="load", python_callable=lambda: None)

    extract >> transform >> load
```

```python
# Equivalent DAG using the @dag / @task decorators (TaskFlow style)
import pendulum
from airflow.sdk import dag, task

@dag(
    dag_id="etl_daily_sales_taskflow",
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    schedule="@daily",
    catchup=False,
    tags=["sales", "etl"],
)
def etl_daily_sales_taskflow():

    @task
    def extract() -> dict:
        return {"rows": 1200}

    @task
    def transform(data: dict) -> dict:
        data["rows_clean"] = data["rows"] - 5
        return data

    @task
    def load(data: dict) -> None:
        print(f"Loaded {data['rows_clean']} rows")

    load(transform(extract()))

etl_daily_sales_taskflow()
```

## 🧩 TaskFlow API

```python
from datetime import timedelta
from airflow.sdk import task

# Task-level configuration mirrors operator kwargs
@task(retries=2, retry_delay=timedelta(minutes=1), execution_timeout=timedelta(minutes=30))
def fetch_data(source: str) -> dict:
    ...

# multiple_outputs=True splits a returned dict into separate, individually
# addressable XComs instead of one blob
@task(multiple_outputs=True)
def split_name(full_name: str) -> dict:
    first, last = full_name.split(" ", 1)
    return {"first_name": first, "last_name": last}

names = split_name("Ada Lovelace")
print(names["first_name"])   # pulled from XCom automatically at run time

# Run a task in an isolated virtualenv (own dependency set)
@task.virtualenv(requirements=["pandas==2.2.2"], system_site_packages=False)
def process_with_pandas():
    import pandas as pd
    ...

# Run a task in a Docker container
@task.docker(image="python:3.12-slim")
def containerized_task():
    ...

# Run against a specific external Python interpreter already on the worker
@task.external_python(python="/usr/bin/python3.11")
def legacy_step():
    ...

# Skip all downstream tasks if a condition isn't met
@task.short_circuit
def check_has_data(row_count: int) -> bool:
    return row_count > 0

# Branch to one of several downstream task ids
@task.branch
def choose_path(row_count: int) -> str:
    return "large_batch_path" if row_count > 10_000 else "small_batch_path"

# Access Airflow context variables as keyword arguments
@task
def print_run_info(logical_date=None, dag_run=None, ti=None):
    print(f"Running for {logical_date}, run_id={dag_run.run_id}, attempt={ti.try_number}")
```

## 🔗 Operators & Providers

```bash
# Core operators (Bash, Python, Empty, etc.) live in the `standard` provider
# in Airflow 3 — install it explicitly if you use a minimal Airflow install
pip install apache-airflow-providers-standard

# Common third-party providers
pip install apache-airflow-providers-amazon
pip install apache-airflow-providers-google
pip install apache-airflow-providers-snowflake
pip install apache-airflow-providers-postgres
pip install apache-airflow-providers-cncf-kubernetes
pip install apache-airflow-providers-dbt-cloud
```

```python
# Core / "standard" provider operators (Airflow 2.x had these under
# airflow.operators.* directly — that path is deprecated in Airflow 3)
from airflow.providers.standard.operators.bash import BashOperator
from airflow.providers.standard.operators.python import (
    PythonOperator,
    PythonVirtualenvOperator,
    BranchPythonOperator,
    ShortCircuitOperator,
)
from airflow.providers.standard.operators.empty import EmptyOperator
from airflow.providers.standard.operators.trigger_dagrun import TriggerDagRunOperator
from airflow.providers.standard.sensors.filesystem import FileSensor

# Common third-party operators
from airflow.providers.amazon.aws.operators.s3 import S3CreateObjectOperator
from airflow.providers.amazon.aws.transfers.s3_to_redshift import S3ToRedshiftOperator
from airflow.providers.google.cloud.operators.bigquery import BigQueryInsertJobOperator
from airflow.providers.snowflake.operators.snowflake import SQLExecuteQueryOperator
from airflow.providers.cncf.kubernetes.operators.pod import KubernetesPodOperator

run_pod = KubernetesPodOperator(
    task_id="run_spark_job",
    name="spark-job",
    namespace="data-eng",
    image="my-registry/spark-job:1.4.0",
    cmds=["python", "job.py"],
    get_logs=True,
)
```

```bash
# Discover what's installed / available
airflow providers list
airflow providers get apache-airflow-providers-amazon
```

## 🌐 Task Dependencies & Control Flow

```python
# Bitshift operators for dependencies
a >> b >> c        # a before b before c
c << b << a         # same thing, written the other way

# Fan-out / fan-in
a >> [b, c] >> d     # b and c both depend on a; d depends on both b and c

# chain() flattens a long sequence, including lists at each step
from airflow.sdk import chain

chain(a, [b, c], d, [e, f])

# cross_downstream: every item in the first list precedes every item in the second
from airflow.utils.helpers import cross_downstream

cross_downstream([a, b], [c, d])

# Trigger rules control when a task fires relative to upstream outcomes
cleanup = BashOperator(
    task_id="cleanup",
    bash_command="rm -rf /tmp/staging/*",
    trigger_rule="all_done",   # run regardless of upstream success/failure
)

# TaskGroups organize related tasks visually and namespace their task_ids
from airflow.sdk import TaskGroup

with TaskGroup(group_id="extract_group") as extract_group:
    extract_orders = PythonOperator(task_id="extract_orders", python_callable=lambda: None)
    extract_customers = PythonOperator(task_id="extract_customers", python_callable=lambda: None)

extract_group >> transform

# Label an edge in the graph view
from airflow.sdk import Label

start_task >> Label("if approved") >> approve_task
start_task >> Label("if rejected") >> reject_task
```

## 🗂️ Dynamic Task Mapping

```python
from airflow.sdk import task
from airflow.providers.standard.operators.bash import BashOperator

@task
def get_files() -> list[str]:
    return ["orders_2026_01.csv", "orders_2026_02.csv", "orders_2026_03.csv"]

@task
def process_file(filename: str) -> int:
    ...
    return 1

# expand() creates one mapped task instance per input element
process_file.expand(filename=get_files())

# expand_kwargs() maps over pre-paired argument sets (not a cross product)
process_file.expand_kwargs([
    {"filename": "orders_2026_01.csv"},
    {"filename": "orders_2026_02.csv"},
])

# partial() fixes some arguments while expand() maps the rest
@task
def load_file(filename: str, mode: str) -> None:
    ...

load_file.partial(mode="upsert").expand(filename=get_files())

# Mapping also works with classic operators via .partial()/.expand()
BashOperator.partial(task_id="run_script").expand(
    bash_command=["echo processing_1", "echo processing_2", "echo processing_3"]
)

# Limit how many mapped instances of one task run concurrently per DAG run
process_file.override(max_active_tis_per_dagrun=5).expand(filename=get_files())

# Aggregate mapped results back into a single downstream task
@task
def summarize(results: list[int]) -> int:
    return sum(results)

totals = process_file.expand(filename=get_files())
summarize(totals)
```

## 📦 Assets & Data-Aware Scheduling

```python
# Airflow 3 renamed "Datasets" (2.4+) to "Assets" — same concept:
# schedule a DAG based on another task updating a resource, not just time.
from airflow.sdk import DAG, Asset, task

raw_orders = Asset("s3://data-lake/raw/orders/")
clean_orders = Asset("s3://data-lake/clean/orders/")

with DAG(dag_id="produce_orders", schedule="@daily", start_date=..., catchup=False):

    @task(outlets=[raw_orders])
    def extract_orders():
        ...

with DAG(dag_id="consume_orders", schedule=[raw_orders], start_date=..., catchup=False):

    @task
    def clean_orders_task():
        ...

# @asset: define a Dag AND its single task in one asset-oriented decorator
from airflow.sdk import asset

@asset(schedule="@daily")
def daily_summary():
    ...  # completing this task marks the `daily_summary` asset as updated

# @asset.multi when one task produces several assets
from airflow.sdk import Asset, asset

@asset.multi(schedule="@daily", outlets=[Asset("asset_a"), Asset("asset_b")])
def produce_two_assets():
    ...

# AssetAlias lets a task register outlets dynamically at run time
from airflow.sdk import AssetAlias

@task(outlets=[AssetAlias("daily-partitions")])
def emit_partition(*, outlet_events=None):
    outlet_events[AssetAlias("daily-partitions")].add(
        Asset("s3://bucket/partition=2026-09-09/")
    )

# Combine a time-based trigger with asset dependencies
from airflow.timetables.assets import AssetOrTimeSchedule
from airflow.timetables.trigger import CronTriggerTimetable

with DAG(
    dag_id="hybrid_schedule",
    schedule=AssetOrTimeSchedule(
        timetable=CronTriggerTimetable("0 5 * * *", timezone="UTC"),
        assets=[raw_orders],
    ),
    start_date=...,
    catchup=False,
):
    ...
```

## ⏱️ Scheduling & Timetables

```python
import pendulum
from airflow.sdk import DAG

# Timezone-aware start_date using pendulum (recommended over naive datetime)
with DAG(
    dag_id="quarterly_report",
    start_date=pendulum.datetime(2026, 1, 1, tz="America/New_York"),
    schedule="0 0 1 */3 *",   # first day of every quarter, midnight local time
    catchup=False,
):
    ...

# Manual/externally-triggered only
with DAG(dag_id="on_demand_pipeline", schedule=None, start_date=..., catchup=False):
    ...

# Custom Timetable for scheduling logic cron can't express (business days, etc.)
from airflow.timetables.base import DataInterval, Timetable

class BusinessDayTimetable(Timetable):
    def next_dagrun_info(self, *, last_automated_data_interval, restriction):
        ...  # returns the next DagRunInfo, skipping weekends

with DAG(dag_id="business_days_only", timetable=BusinessDayTimetable(), start_date=..., catchup=False):
    ...

# CronTriggerTimetable fires at the END of the interval (like a plain crontab),
# unlike the classic cron `schedule` string which fires at the START
from airflow.timetables.trigger import CronTriggerTimetable

with DAG(
    dag_id="fires_at_interval_end",
    schedule=CronTriggerTimetable("0 9 * * *", timezone="UTC"),
    start_date=...,
    catchup=False,
):
    ...
```

```bash
# Preview when a DAG will next run without waiting on the scheduler
airflow dags next-execution etl_daily_sales
```

## 🪟 Sensors & Deferrable Operators

```python
from datetime import timedelta
from airflow.providers.standard.sensors.filesystem import FileSensor
from airflow.providers.standard.sensors.time_delta import TimeDeltaSensorAsync

wait_for_file = FileSensor(
    task_id="wait_for_file",
    filepath="/data/incoming/orders.csv",
    poke_interval=30,
    timeout=60 * 60,
    mode="reschedule",   # frees the worker slot between pokes; "poke" holds it the whole time
)

# Deferrable sensors/operators hand off waiting to the triggerer process,
# freeing the worker slot completely instead of just polling less often
wait_10_min = TimeDeltaSensorAsync(task_id="wait_10_min", delta=timedelta(minutes=10))

# Many provider sensors/operators expose deferrable=True directly
from airflow.providers.amazon.aws.sensors.s3 import S3KeySensor

wait_for_key = S3KeySensor(
    task_id="wait_for_key",
    bucket_name="data-lake",
    bucket_key="raw/orders/*.csv",
    wildcard_match=True,
    deferrable=True,
)
```

## 🔀 Branching & Conditional Logic

```python
from airflow.providers.standard.operators.python import BranchPythonOperator, ShortCircuitOperator
from airflow.providers.standard.operators.trigger_dagrun import TriggerDagRunOperator
from airflow.sdk import task

# Classic-operator branching
def choose_branch(**context):
    return "path_a" if context["logical_date"].day % 2 == 0 else "path_b"

branch = BranchPythonOperator(task_id="branch", python_callable=choose_branch)
branch >> [path_a_task, path_b_task]

# TaskFlow equivalent
@task.branch
def choose_branch_taskflow(logical_date=None) -> str:
    return "path_a" if logical_date.day % 2 == 0 else "path_b"

# ShortCircuitOperator skips ALL downstream tasks when the callable returns False
gate = ShortCircuitOperator(task_id="gate", python_callable=lambda: check_flag())

# Conditionally kick off a separate DAG
trigger = TriggerDagRunOperator(
    task_id="trigger_downstream",
    trigger_dag_id="downstream_dag",
    wait_for_completion=False,
    conf={"batch_id": "{{ run_id }}"},
)
```

## 🔑 Variables, Connections & Params

```python
from airflow.sdk import Variable, Connection

# Variables: simple key/value config stored in the metadata DB (or a secrets backend)
api_key = Variable.get("api_key")
config = Variable.get("pipeline_config", deserialize_json=True)
Variable.set("last_run_id", "{{ run_id }}")

# Connections: prefer a Hook over reading raw Connection fields in task code
pg_conn = Connection.get("my_postgres")

from airflow.providers.postgres.hooks.postgres import PostgresHook
rows = PostgresHook(postgres_conn_id="my_postgres").get_records("SELECT 1")

# DAG- and task-level Params: typed, validated, and editable in the UI at trigger time
from airflow.sdk import DAG, Param

with DAG(
    dag_id="parameterized_dag",
    schedule=None,
    start_date=...,
    params={
        "environment": Param("staging", enum=["staging", "production"]),
        "batch_size": Param(1000, type="integer", minimum=1, maximum=100_000),
    },
) as dag:

    @task
    def run(params: dict):
        print(params["environment"], params["batch_size"])
```

```bash
# Manage Variables & Connections from the CLI (useful for CI/CD seeding)
airflow variables set api_key "abc123"
airflow variables import variables.json
airflow connections add my_postgres --conn-type postgres --conn-host db.internal --conn-login etl
airflow connections export connections.json
```

```ini
# Point secrets at a real backend instead of the metadata DB (airflow.cfg)
[secrets]
backend = airflow.providers.amazon.aws.secrets.secrets_manager.SecretsManagerBackend
backend_kwargs = {"connections_prefix": "airflow/connections", "variables_prefix": "airflow/variables"}
```

## 💾 XComs

```python
from airflow.sdk import task

# TaskFlow return values are auto-pushed to XCom and auto-pulled by consumers
@task
def compute() -> int:
    return 42

@task
def use(value: int) -> None:
    print(value)

use(compute())

# Manual push/pull with classic operators, via the task instance context
def _push(**context):
    context["ti"].xcom_push(key="row_count", value=42)

def _pull(**context):
    row_count = context["ti"].xcom_pull(task_ids="push_task", key="row_count")

# multiple_outputs=True splits a dict return into individually keyed XComs
@task(multiple_outputs=True)
def get_stats() -> dict:
    return {"rows": 100, "errors": 2}

stats = get_stats()
print(stats["rows"])   # pulled by key, not the whole dict

# Custom XCom backend for large payloads (store in S3/GCS, keep only a
# pointer in the metadata DB) — configured in airflow.cfg:
# [core]
# xcom_backend = my_project.xcom_backends.S3XComBackend
```

## 🏗️ DAG Design Patterns

```python
# Idiomatic TaskFlow ETL
import pendulum
from airflow.sdk import dag, task

@dag(start_date=pendulum.datetime(2026, 1, 1, tz="UTC"), schedule="@daily", catchup=False)
def etl_pipeline():

    @task
    def extract() -> list[dict]:
        return [{"id": 1, "amount": 100}, {"id": 2, "amount": 250}]

    @task
    def transform(records: list[dict]) -> list[dict]:
        return [r for r in records if r["amount"] > 0]

    @task
    def load(records: list[dict]) -> None:
        print(f"Loaded {len(records)} records")

    load(transform(extract()))

etl_pipeline()

# SubDagOperator is REMOVED in Airflow 3 — use TaskGroups to organize
# a large DAG into logical, collapsible sections instead
from airflow.sdk import TaskGroup

with TaskGroup(group_id="load_group") as load_group:
    load_orders = PythonOperator(task_id="load_orders", python_callable=lambda: None)
    load_customers = PythonOperator(task_id="load_customers", python_callable=lambda: None)

# Cross-DAG dependencies: prefer Assets (data-aware) over polling with
# ExternalTaskSensor where possible — it's push-based, not poll-based
consumer_schedule = [Asset("s3://data-lake/clean/orders/")]

# Dynamically generate multiple DAGs from a config list
configs = [{"table": "orders"}, {"table": "customers"}]

for cfg in configs:
    dag_id = f"sync_{cfg['table']}"
    with DAG(dag_id=dag_id, schedule="@daily", start_date=..., catchup=False) as generated_dag:

        @task
        def sync(table: str = cfg["table"]):
            ...

        sync()

    globals()[dag_id] = generated_dag
```

## 🧪 Testing & Debugging

```bash
# Quick syntax/import sanity check — just run the file
python dags/etl_daily_sales.py

# List all DAGs the scheduler/dag-processor has picked up
airflow dags list

# Surface parse errors before they silently disappear from the UI
airflow dags list-import-errors

# Run a single task instance for a specific logical date, no scheduler needed
airflow tasks test etl_daily_sales extract 2026-09-01

# Lint DAGs for Airflow-3 breaking changes (AIR301/302) and soft-deprecations (AIR311/312)
ruff check dags/ --select AIR301,AIR302 --show-fixes
ruff check dags/ --select AIR301 --fix     # auto-apply safe fixes
```

```python
# DAG.test() executes an entire DAG run in-process (no scheduler/executor),
# handy for local debugging of task-to-task data flow
if __name__ == "__main__":
    etl_pipeline().test()
```

```python
# pytest-based DAG validation, run in CI on every PR
import pytest
from airflow.models import DagBag

@pytest.fixture(scope="session")
def dagbag():
    return DagBag(dag_folder="dags/", include_examples=False)

def test_no_import_errors(dagbag):
    assert len(dagbag.import_errors) == 0

def test_dag_has_expected_tasks(dagbag):
    dag = dagbag.get_dag("etl_daily_sales")
    assert dag is not None
    assert set(dag.task_ids) == {"extract", "transform", "load"}

def test_dag_has_no_cycles(dagbag):
    for dag_id, dag in dagbag.dags.items():
        assert dag.test_cycle() is None, f"Cycle detected in {dag_id}"
```

## ⚡ Performance & Scaling

```python
# Pools cap concurrent task instances against a shared, limited resource
# (e.g. a database that can only take 5 concurrent connections)
BashOperator(task_id="query_db", bash_command="...", pool="db_pool", priority_weight=10)
```

```bash
airflow pools set db_pool 5 "Limit concurrent DB connections"
airflow pools list
```

```python
# DAG-level concurrency controls
with DAG(
    dag_id="throttled_dag",
    max_active_runs=1,     # only one DAG run in flight at a time
    max_active_tasks=10,    # cap concurrent task instances across all runs
    start_date=...,
    schedule="@hourly",
    catchup=False,
) as dag:
    ...
```

**Executor comparison**

| Executor             | Best for                                                          |
| -------------------- | ----------------------------------------------------------------- |
| `SequentialExecutor` | Local smoke-testing only (default with SQLite)                    |
| `LocalExecutor`      | Single-machine deployments, parallel tasks via subprocesses       |
| `CeleryExecutor`     | Distributed workers, mature message-queue based scaling           |
| `KubernetesExecutor` | Each task runs as its own pod — strong isolation, elastic scaling |
| `EdgeExecutor`       | Remote/edge workers outside the main cluster network              |

**Performance tips**

1. Keep DAG files light — avoid heavy imports, DB calls, or network requests at module (top) level; the dag-processor re-parses every file repeatedly.
2. Prefer deferrable operators/sensors for anything that mostly waits (API polling, file arrival) — they free the worker slot entirely.
3. Use dynamic task mapping instead of loops that generate hundreds of static tasks in the DAG file.
4. Set `max_active_tis_per_dagrun` on mapped tasks that hit rate-limited downstream systems.
5. Use pools for any shared, capacity-limited resource (databases, external APIs).
6. Avoid `PythonOperator` closures that pull large objects into the DAG file's global scope.
7. Turn off `catchup` unless you specifically need historical backfill runs.
8. Use asset-aware scheduling instead of `ExternalTaskSensor` polling loops across DAGs.
9. Batch small tasks together where task-orchestration overhead would dominate actual work.
10. Monitor scheduler heartbeat and DAG-processor parse duration — a slow-parsing DAG file degrades the whole scheduler.

## 🔐 Security & Access Control

```bash
# Airflow 3 uses pluggable Auth Managers. The FAB auth manager gives
# classic role-based access control (Admin/Op/User/Viewer/Public roles)
airflow fab-db create-user \
  --username admin --role Admin \
  --firstname A --lastname B \
  --email admin@company.com --password '***'
```

```ini
# airflow.cfg — select the auth manager
[core]
auth_manager = airflow.providers.fab.auth_manager.fab_auth_manager.FabAuthManager

# For quick local dev only — a single implicit "admin" user, no real auth
# auth_manager = airflow.api_fastapi.auth.managers.simple.simple_auth_manager.SimpleAuthManager
```

```python
# Connections are encrypted at rest using a Fernet key — generate and set one
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

```bash
export AIRFLOW__CORE__FERNET_KEY="<generated key>"
airflow rotate-fernet-key   # rotate without breaking existing encrypted values
```

- Route secrets (connections, variables) through a real secrets backend (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault) instead of the metadata database in production.
- Use `AIRFLOW__WEBSERVER__EXPOSE_CONFIG=False` (and the api-server equivalent) so the UI doesn't leak `airflow.cfg` contents.
- Scope connections/variables access with RBAC roles; don't hand every DAG author `Admin`.
- Audit logs record who triggered, paused, or modified a DAG — review them for sensitive pipelines.

## 🛠️ CLI Reference

| Command group   | Example                                                            | Purpose                                        |
| --------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| `api-server`    | `airflow api-server --port 8080`                                   | Serve the UI + REST API (replaces `webserver`) |
| `scheduler`     | `airflow scheduler`                                                | Schedule DAG runs and queue tasks              |
| `dag-processor` | `airflow dag-processor`                                            | Parse DAG files into the metadata DB           |
| `triggerer`     | `airflow triggerer`                                                | Run deferrable operators/sensors               |
| `standalone`    | `airflow standalone`                                               | All-in-one local dev environment               |
| `dags`          | `airflow dags list`, `airflow dags trigger <id>`                   | Inspect / trigger DAGs                         |
| `tasks`         | `airflow tasks test <dag> <task> <date>`                           | Run/inspect individual tasks                   |
| `backfill`      | `airflow backfill create --dag-id x --from-date ... --to-date ...` | Reprocess historical runs                      |
| `connections`   | `airflow connections add ...`                                      | Manage connections                             |
| `variables`     | `airflow variables set key value`                                  | Manage Variables                               |
| `pools`         | `airflow pools set name slots description`                         | Manage resource pools                          |
| `providers`     | `airflow providers list`                                           | List installed provider packages               |
| `config`        | `airflow config lint`, `airflow config update`                     | Audit/migrate `airflow.cfg`                    |
| `db`            | `airflow db migrate`, `airflow db clean`                           | Manage the metadata database                   |
| `assets`        | `airflow assets list`                                              | Inspect defined Assets                         |

## ⚠️ Common Gotchas

- **`execution_date` is gone** — use `logical_date` everywhere (context, templates, CLI output). Airflow 2.11 added `logical_date` alongside the old field specifically to ease this migration.
- **Core operators moved** — `BashOperator`, `PythonOperator`, `EmptyOperator`, and friends now live in `airflow.providers.standard`, not `airflow.operators.*`. The old import paths are deprecated/removed.
- **`schedule_interval` is removed** — use the unified `schedule` parameter, which also accepts asset lists and `Timetable` objects.
- **`SubDagOperator` is removed** — replace nested SubDAGs with `TaskGroup`, which gives the same visual grouping without a second scheduler/executor layer.
- **DAG authoring imports changed** — prefer `from airflow.sdk import DAG, task, dag, Asset, ...` over deep internal paths like `airflow.models.dag.DAG`; the internal paths are deprecated and will eventually be removed.
- **Webserver renamed to api-server** — Helm chart values, health checks, and monitoring configs that reference `webserver` need updating to `apiServer`/`api-server`.
- **`catchup` now defaults to `False`** — a DAG with a past `start_date` will _not_ auto-backfill missed runs unless you explicitly set `catchup=True`.
- **Direct DB access from task code is restricted** — workers talk to a Task Execution API, not the metadata database directly; code that queried Airflow's internal DB tables from within a task needs to use the API/SDK equivalent instead.
- **`Dataset` renamed to `Asset`** — pipelines written against `airflow.datasets.Dataset` need to switch to `airflow.sdk.Asset`; the concept and behavior are otherwise the same.
- **`days_ago()` helper is deprecated** — pass an explicit, timezone-aware `start_date` (e.g. via `pendulum.datetime(...)`) instead.
- **DAG-run concurrency is per-DAG-run for mapped tasks** — use `max_active_tis_per_dagrun` on the mapped task, not just `max_active_tasks` on the DAG, to throttle a single fan-out.
- **Deferrable ≠ sensor `mode="reschedule"`** — reschedule mode still consumes a worker slot each poke; deferrable operators release the slot entirely between checks via the triggerer.

## 🎯 Best Practices

```python
# Idempotent tasks: re-running the same logical_date should produce the
# same result, not duplicate/append data
@task
def load_partition(logical_date=None):
    partition = logical_date.format("YYYY-MM-DD")
    # overwrite/upsert the partition rather than blindly INSERT-appending
    ...

# Keep DAG files declarative and side-effect-free at import time —
# do heavy lifting inside task callables, not at module scope
# BAD:  df = pd.read_csv("s3://...")   <- runs on every DAG-processor parse
# GOOD: move the read inside a @task function

# Prefer TaskFlow + typed returns for readability and automatic XCom wiring
@task
def get_config() -> dict:
    return {"batch_size": 500}

# Fail fast and loudly — let exceptions propagate so retries/alerts trigger
@task
def validate(row_count: int):
    assert row_count > 0, "Extract returned zero rows"

# Pin provider versions alongside apache-airflow itself
# requirements.txt
# apache-airflow==3.3.1
# apache-airflow-providers-amazon==9.x.x
# apache-airflow-providers-standard==1.x.x

# Use tags and a clear naming convention (team_domain_frequency) for
# discoverability once you have hundreds of DAGs
```

## 💡 Pro Tips

1. **Always set an explicit, timezone-aware `start_date`** using `pendulum.datetime(...)`.
2. **Run `ruff check --select AIR301,AIR302`** before every Airflow 3 upgrade, not just once.
3. **Default to TaskFlow (`@task`/`@dag`)** for new pipelines — less boilerplate, automatic XCom wiring.
4. **Use Assets over cross-DAG sensors** whenever the dependency is "did this data get produced," not "did time pass."
5. **Keep secrets out of `airflow.cfg` and Variables** — use a real secrets backend in production.
6. **Test with `DAG.test()` locally** before deploying — it runs the whole DAG without needing a scheduler.
7. **Lint DAG files in CI** with `DagBag` import-error tests so a broken DAG never reaches production.
8. **Use dynamic task mapping**, not `for` loops that generate hundreds of static tasks in a DAG file.
9. **Set `max_active_runs` deliberately** — an unbounded backlog after downtime can overwhelm downstream systems.
10. **Prefer deferrable operators** for anything I/O-bound and long-waiting (API polling, file sensors).
11. **Group related tasks with `TaskGroup`**, not nested DAGs — `SubDagOperator` is gone for a reason.
12. **Version-pin providers** alongside Airflow core to avoid surprise breaking changes on redeploy.
13. **Watch DAG-processor parse time** — a single slow-importing DAG file can slow down scheduling for everyone.
14. **Use Params for anything a human should be able to change at trigger time** from the UI.
15. **Read the official upgrade guide (`ruff` AIR rules) before every major version bump** — Airflow's breaking-change cadence is real, and the linter catches most of it automatically.
