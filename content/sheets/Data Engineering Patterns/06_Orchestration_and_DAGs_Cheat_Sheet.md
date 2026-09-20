# Orchestration and DAGs Cheatsheet for Data Engineers

> A structured reference for representing pipeline work as dependency graphs — task design, retries, backfills, sensors, cross-DAG dependencies, and the Airflow/Dagster/Prefect landscape. Expanded from a short pattern note into a full implementation guide.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 When You Need an Orchestrator](#when-you-need-an-orchestrator)
4. [🏗️ Building a DAG](#building-a-dag)
5. [🔁 Retries and Failure Handling](#retries-and-failure-handling)
6. [📅 Scheduling, Data Intervals, and Backfills](#scheduling-data-intervals-and-backfills)
7. [🔗 Cross-DAG Dependencies and Sensors](#cross-dag-dependencies-and-sensors)
8. [📦 Passing Data Between Tasks](#passing-data-between-tasks)
9. [🛠️ Tooling Landscape](#tooling-landscape)
10. [🔍 Monitoring and Alerting](#monitoring-and-alerting)
11. [🧬 Dynamic DAG Generation](#dynamic-dag-generation)
12. [📁 Task Groups and Modular DAG Design](#task-groups-and-modular-dag-design)
13. [🎼 Dagster and Prefect Side-by-Side Examples](#dagster-and-prefect-side-by-side-examples)
14. [🧪 Testing DAGs](#testing-dags)
15. [🚀 Deploying DAGs (CI/CD)](#deploying-dags-cicd)
16. [⚠️ Common Gotchas](#common-gotchas)
17. [✅ Best Practices Checklist](#best-practices-checklist)
18. [📚 Airflow vs Dagster vs Prefect](#airflow-vs-dagster-vs-prefect)
19. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| Structure | Directed Acyclic Graph (DAG): tasks + dependencies, no cycles |
| Dependency syntax | `extract >> transform >> publish` |
| Parallel branches | `[transform, quality_check] >> publish` |
| Data passing | Durable storage (table, file, object store) — not task memory/XCom for large data |
| Retries | Per-task retry count + backoff, not whole-DAG re-run |
| Backfill | Re-run historical data intervals with current DAG logic |
| Common tools | Airflow, Dagster, Prefect, Mage |

## 🧠 Core Concept

Orchestration represents pipeline work as a **dependency graph** — a DAG (Directed Acyclic Graph) — so tasks run in the correct order, independent work runs in parallel, and the system exposes retries, failure states, and history centrally instead of each script managing its own scheduling and error handling.

```python
extract >> transform >> publish
extract >> quality_check
[transform, quality_check] >> publish
```

```text
        ┌──> transform ──┐
extract ┤                 ├──> publish
        └──> quality_check┘
```

The orchestrator's job isn't to *do* the data work — it's to decide **when and in what order** the work happens, retry it when it fails, and give you visibility into the whole pipeline's history.

## 🎯 When You Need an Orchestrator

**Use an orchestrator when:**
- A workflow has multiple steps with real dependencies, schedules, or backfill requirements.
- Retries, notifications, and operational history need to be centrally visible, not scattered across cron logs on different machines.
- Independent branches of work can and should run in parallel.

**Skip it when:**
- You have one script, run manually or by a single simple cron job, with no dependencies to manage — an orchestrator adds operational overhead (a scheduler service to run, DAGs to maintain) that isn't justified yet.

## 🏗️ Building a DAG

```python
from airflow.decorators import dag, task
from datetime import datetime

@dag(schedule="@daily", start_date=datetime(2026, 1, 1), catchup=False)
def sales_pipeline():

    @task
    def extract(data_interval_start=None):
        return extract_from_source(data_interval_start.date())

    @task
    def transform(raw_path: str):
        return transform_to_mart(raw_path)

    @task
    def quality_check(raw_path: str):
        run_quality_gate(raw_path)

    @task
    def publish(mart_path: str):
        publish_to_warehouse(mart_path)

    raw = extract()
    mart = transform(raw)
    quality_check(raw)
    publish(mart)

sales_pipeline()
```

```python
# Dagster equivalent: assets express "what exists," not just "what task ran"
from dagster import asset

@asset
def raw_orders(context) -> str:
    return extract_from_source(context.partition_key)

@asset
def mart_orders(raw_orders: str) -> str:
    return transform_to_mart(raw_orders)
```

## 🔁 Retries and Failure Handling

```python
@task(retries=3, retry_delay=timedelta(minutes=5), retry_exponential_backoff=True)
def flaky_extract():
    return call_unreliable_api()

@task(trigger_rule="all_done")   # runs regardless of upstream success/failure
def send_final_status(task_results):
    notify_slack(task_results)
```

Design each task to be **idempotent** (see [idempotent-pipelines.md](./Idempotent_Pipelines_Cheat_Sheet.md)) before relying on automatic retries — retrying a non-idempotent task turns a transient failure into a data-correctness bug.

## 📅 Scheduling, Data Intervals, and Backfills

```python
@dag(schedule="@daily", start_date=datetime(2026, 1, 1), catchup=True)
def daily_dag():
    @task
    def run(data_interval_start=None, data_interval_end=None):
        # data_interval_start/end represent the WINDOW being processed,
        # which may not be "now" — critical for correct backfills
        process_window(data_interval_start, data_interval_end)
    run()
```

```bash
# Trigger a backfill over a historical date range using current DAG logic
airflow dags backfill sales_pipeline --start-date 2026-01-01 --end-date 2026-01-31
```

| Concept | Meaning |
|---|---|
| `schedule` | How often the DAG is triggered |
| `data_interval_start/end` | The window of data this run is responsible for (not "now") |
| `catchup` | Whether missed intervals since `start_date` are backfilled automatically on deploy |
| Backfill | Re-running historical intervals through the *current* DAG logic |

## 🔗 Cross-DAG Dependencies and Sensors

```python
from airflow.sensors.external_task import ExternalTaskSensor

wait_for_upstream = ExternalTaskSensor(
    task_id="wait_for_upstream_dag",
    external_dag_id="upstream_ingestion",
    external_task_id="publish",
    timeout=3600,
    mode="reschedule",   # frees the worker slot while waiting, unlike mode="poke"
)
```

Cross-DAG sensors let one team's pipeline depend on another team's pipeline's *output*, without tightly coupling their code or deploy cycles — but they add latency and a failure mode of their own (the sensor itself can time out).

## 📦 Passing Data Between Tasks

```python
# BAD: passing large data through the orchestrator's metadata store (e.g., Airflow XCom)
@task
def extract():
    return huge_dataframe.to_dict()   # bloats the metadata DB, slow, memory-heavy

# GOOD: pass a reference to durable storage; tasks read/write there directly
@task
def extract(data_interval_start=None) -> str:
    path = f"s3://staging/orders/{data_interval_start:%Y-%m-%d}/"
    write_to_storage(path, fetch_from_source())
    return path   # small, just a pointer

@task
def transform(input_path: str) -> str:
    df = read_from_storage(input_path)
    ...
```

The orchestrator's metadata store is for small control-flow values (paths, row counts, flags) — never for the actual dataset.

## 🛠️ Tooling Landscape

| Category | Tools |
|---|---|
| Task/DAG-centric orchestrators | Apache Airflow, Prefect |
| Asset-centric orchestrators | Dagster (models "data assets," not just tasks) |
| Lightweight/notebook-friendly | Mage, Kestra |
| Warehouse-native scheduling | dbt Cloud jobs, Snowflake Tasks, BigQuery Scheduled Queries |

## 🔍 Monitoring and Alerting

```python
@dag(
    schedule="@daily",
    start_date=datetime(2026, 1, 1),
    default_args={
        "on_failure_callback": notify_pagerduty,
        "sla": timedelta(hours=2),
    },
)
def monitored_pipeline():
    ...
```

Monitor: task duration trends (not just pass/fail), SLA misses, queue/scheduler latency, and DAG "freshness" (time since last successful run) as a dashboard metric in its own right.

## 🧬 Dynamic DAG Generation

Sometimes the set of tasks itself is data-driven — one task per table in a list, one DAG per tenant — and hand-writing each is unsustainable.

```python
# Generate one task per table from a config file, rather than hand-coding each
TABLES = ["orders", "customers", "products", "refunds"]

@dag(schedule="@daily", start_date=datetime(2026, 1, 1))
def ingest_all_tables():
    @task
    def ingest(table_name: str):
        extract_and_load(table_name)

    ingest.expand(table_name=TABLES)   # Airflow dynamic task mapping — one mapped task instance per table
```

```python
# Generating entire DAGs dynamically (one per tenant) from a config source
def create_tenant_dag(tenant_id: str):
    @dag(dag_id=f"tenant_{tenant_id}_pipeline", schedule="@daily", start_date=datetime(2026, 1, 1))
    def tenant_dag():
        @task
        def process():
            run_tenant_pipeline(tenant_id)
        process()
    return tenant_dag()

for tenant in get_active_tenants():
    globals()[f"dag_{tenant}"] = create_tenant_dag(tenant)   # register each generated DAG at module scope
```

Prefer Airflow's **dynamic task mapping** (`.expand()`) over manually looping and creating N static tasks in DAG code — mapped tasks show up individually in the UI with individual retry/status, without needing N copy-pasted task definitions.

## 📁 Task Groups and Modular DAG Design

```python
from airflow.utils.task_group import TaskGroup

@dag(schedule="@daily", start_date=datetime(2026, 1, 1))
def modular_pipeline():
    with TaskGroup("extract_group") as extract_group:
        extract_orders = extract_task("orders")
        extract_customers = extract_task("customers")

    with TaskGroup("transform_group") as transform_group:
        build_fact = transform_task("fct_orders")
        build_dim = transform_task("dim_customer")

    extract_group >> transform_group
```

Task groups are purely a **visual/organizational** grouping in the UI (they don't change execution semantics), but on a DAG with 30+ tasks the difference between a flat task list and a grouped, collapsible view is the difference between a debuggable DAG and a wall of boxes nobody wants to open.

## 🎼 Dagster and Prefect Side-by-Side Examples

```python
# Dagster: a full asset graph with explicit dependencies and partitioning
from dagster import asset, DailyPartitionsDefinition

daily_partitions = DailyPartitionsDefinition(start_date="2026-01-01")

@asset(partitions_def=daily_partitions)
def raw_orders(context) -> str:
    return extract_from_source(context.partition_key)

@asset(partitions_def=daily_partitions)
def fct_orders(context, raw_orders: str) -> str:
    return transform_to_mart(raw_orders)

@asset(partitions_def=daily_partitions)
def daily_revenue_mart(context, fct_orders: str) -> None:
    publish_to_warehouse(fct_orders)
```

```python
# Prefect: flows and tasks, Pythonic control flow, minimal ceremony
from prefect import flow, task

@task(retries=3, retry_delay_seconds=300)
def extract(run_date):
    return extract_from_source(run_date)

@task
def transform(raw_path):
    return transform_to_mart(raw_path)

@flow(name="sales-pipeline")
def sales_pipeline(run_date):
    raw = extract(run_date)
    mart = transform(raw)
    publish_to_warehouse(mart)

if __name__ == "__main__":
    sales_pipeline(run_date="2026-09-17")
```

Dagster's asset model makes **"what does this pipeline produce, and is it fresh"** a first-class, queryable concept (asset materialization history, freshness policies) rather than something you infer from task run history — worth weighing heavily if lineage/freshness observability is a priority.

## 🧪 Testing DAGs

```python
def test_dag_has_no_import_errors(dagbag):
    assert len(dagbag.import_errors) == 0

def test_dag_structure():
    dag = dagbag.get_dag("sales_pipeline")
    assert dag is not None
    assert len(dag.tasks) == 4
    extract_task = dag.get_task("extract")
    assert "transform" in [t.task_id for t in extract_task.downstream_list]

def test_task_logic_in_isolation():
    # Test the underlying function directly — DON'T require a running Airflow instance
    result = extract_from_source(run_date=date(2026, 1, 1))
    assert result is not None

def test_no_cycles(dag):
    assert dag.test_cycle() is None   # Airflow's built-in cycle detector, useful in CI
```

The highest-value DAG tests are usually the cheapest: "does the DAG file even import without errors" catches a surprising fraction of production incidents (a typo, a missing import) before they ever reach the scheduler.

## 🚀 Deploying DAGs (CI/CD)

```yaml
# .github/workflows/deploy_dags.yml — lint, test, then sync DAG files to the orchestrator
name: Deploy DAGs
on:
  push:
    branches: [main]
    paths: ["dags/**"]

jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements.txt
      - run: pytest tests/test_dags.py         # import errors, structure, cycle checks
      - run: python -m py_compile dags/*.py     # fast syntax sanity check
      - name: Sync DAGs to Airflow
        run: aws s3 sync dags/ s3://airflow-dags-bucket/dags/ --delete
```

Treat DAG code with the same CI rigor as application code: lint, test, and deploy through a pipeline — a DAG file pushed directly to a production scheduler folder with no review is how a syntax error takes down an entire team's pipelines at 2am.

## ⚠️ Common Gotchas

- **`catchup=True` on first deploy fires one run per missed interval** — decide deliberately whether that's wanted, especially for a DAG with a `start_date` far in the past.
- **Non-idempotent tasks + automatic retries** silently corrupt data — retries assume idempotency.
- **Passing large datasets through the orchestrator's own metadata store** (XCom, etc.) degrades scheduler performance and sometimes hits hard size limits.
- **Circular dependencies** aren't just bad practice — a real cycle makes the graph invalid and the DAG won't even parse/run.
- **Sensors left in `mode="poke"`** hold a worker slot for the entire wait, starving other tasks — prefer `mode="reschedule"` for long waits.
- **Treating "DAG succeeded" as "data is correct"** — a DAG can complete successfully while processing zero rows or garbage data; pair orchestration success with quality gates.
- **Tight coupling via cross-DAG sensors** on internal implementation details (task IDs) breaks silently when the upstream team refactors their DAG.
- **Hand-looped static tasks instead of dynamic task mapping** — N copy-pasted task definitions in DAG code are harder to maintain and don't show individual retry/status the way mapped tasks do.
- **DAG files pushed straight to production with no CI** — a syntax error or bad import in one DAG file can, depending on the deployment setup, disrupt scheduler parsing for other DAGs too.
- **No "does the DAG even import" test** — this is the cheapest possible test and catches a disproportionate share of real incidents.
- **Deeply nested or excessive task groups** used purely for visual tidiness at the cost of actually understanding execution order — task groups organize the UI, they don't replace understanding the dependency graph.

## ✅ Best Practices Checklist

- [ ] Tasks are idempotent before retries are relied upon
- [ ] Data is passed between tasks via durable storage, not the orchestrator's metadata store
- [ ] `catchup` behavior is a deliberate choice, documented per DAG
- [ ] `data_interval_start/end` (not wall-clock "now") drives what window each run processes
- [ ] Cross-team dependencies use sensors on stable, published interfaces — not internal task IDs
- [ ] SLAs and freshness are monitored, not just task success/failure
- [ ] Failure callbacks route to the team that owns the failing task

## 📚 Airflow vs Dagster vs Prefect

| Dimension | Airflow | Dagster | Prefect |
|---|---|---|---|
| Core abstraction | Tasks in a DAG | Software-defined assets | Tasks/flows (Pythonic) |
| Local dev experience | Historically heavier | Strong (asset materialization, typed I/O) | Lightweight, Python-native |
| Data awareness | Task-centric (what ran) | Asset-centric (what exists, its freshness/lineage) | Task-centric, flexible |
| Ecosystem maturity | Very mature, huge plugin ecosystem | Growing fast, strong modern DX | Mature, simpler mental model |
| Good fit | Large, complex, many-team orgs with existing Airflow investment | Teams wanting asset lineage/observability built in | Teams wanting simpler, Pythonic orchestration |

## 💡 Pro Tips

1. **Design every task assuming it will be retried** — idempotency is a prerequisite, not a nice-to-have.
2. **Never pass large data through the orchestrator's own metadata store** — pass a storage pointer instead.
3. **Use `data_interval_start/end`, not `datetime.now()`,** inside tasks so backfills and scheduled runs share identical logic.
4. **Prefer `mode="reschedule"` sensors** over `mode="poke"` for anything waiting more than a few seconds.
5. **Treat DAG success and data correctness as separate signals** — pair orchestration with quality gates.
6. **Keep DAGs declarative and thin** — push actual business logic into testable functions/modules the DAG merely calls.
7. **Monitor freshness and duration trends**, not just pass/fail — a DAG that "succeeds" every day but takes 3x longer than usual is telling you something.
8. **Version-control DAG definitions** and treat DAG changes with the same review rigor as application code.
9. **Avoid deep cross-DAG coupling** on internal task names — publish a stable "contract" (e.g., a sensor on a dataset's existence) instead.
10. **Decide `catchup` deliberately** for every new DAG — don't let it be an accidental default that fires a storm of backfill runs.
11. **Use dynamic task mapping** for data-driven task sets (one per table/tenant) instead of hand-looping static task definitions.
12. **Test that the DAG imports cleanly** as a first, cheap CI gate before any deeper structural test.
13. **Deploy DAGs through CI/CD**, not by hand-copying files to a production scheduler folder.
14. **Consider Dagster's asset model** specifically when "what exists and how fresh is it" matters as much as "what ran and did it succeed."
15. **Use task groups for readability on large DAGs**, but don't mistake visual organization for actually simplifying the underlying dependency graph.

