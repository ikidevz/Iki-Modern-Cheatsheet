# Orchestration & Scheduling

## DAGs & Dependency Management

**Definition:** A DAG (Directed Acyclic Graph) defines a pipeline's tasks and the dependencies between them, with no circular references allowed.

**Key Points:**
- Tasks should be atomic (do one thing) and idempotent (safe to re-run).
- Favor explicit dependencies over implicit ordering via shared state or timing assumptions.

**Example:**
```python
extract_task >> transform_task >> load_task
load_task >> [notify_task, update_dashboard_task]
```

**When to Use / Trade-offs:**
- Break large monolithic tasks into smaller atomic ones — this isolates failures and makes retries cheaper (you re-run only the failed step, not the whole pipeline).

**Common Pitfalls:**
- Hidden dependencies via shared files/tables instead of explicit DAG edges, making failure diagnosis difficult.
- Circular logical dependencies disguised across multiple DAGs (DAG A waits on DAG B which waits on DAG A).

---

## Scheduling Patterns

**Definition:** The mechanism that determines when a pipeline or task runs.

**Key Points:**
- Cron-based — fixed schedule (`0 6 * * *`). Predictable, simple.
- Event-driven — triggered by an external event (file arrival, queue message, upstream DAG completion).
- Sensors/Pollers — task waits/polls until a condition is met before proceeding.

**Example:**
```python
# Airflow sensor waiting on file arrival
wait_for_file = FileSensor(task_id="wait_for_file", filepath="/data/daily_export.csv", poke_interval=60)
```

**When to Use / Trade-offs:**
- Cron works well when upstream data reliably lands by a known time.
- Event-driven/sensor-based scheduling is more robust when upstream timing is variable, at the cost of added complexity.

**Common Pitfalls:**
- Cron schedules set too tight against upstream data availability, causing pipelines to run before data has landed.
- Long-polling sensors consuming a worker slot for hours, exhausting the orchestrator's parallelism.

---

## Common Orchestration Concepts

**Definition:** Terminology and mechanisms found across most orchestration tools (Airflow, Dagster, Prefect).

**Key Points:**

| Concept | Meaning |
|---|---|
| Backfill | Re-running a DAG for past dates |
| Catchup | Auto-running all missed scheduled intervals when a DAG is turned on late |
| SLA | Time by which a task/DAG must complete |
| Sensor | Task that waits on an external condition |
| Trigger Rule | Logic for when a task runs relative to upstream task outcomes (all_success, one_failed, etc.) |

**Example:**
```python
# Airflow: disable catchup to avoid running all historical intervals on DAG activation
dag = DAG("my_dag", schedule_interval="@daily", catchup=False)
```

**When to Use / Trade-offs:**
- Disable `catchup` unless you specifically want historical intervals auto-run when a DAG is newly enabled or was paused.

**Common Pitfalls:**
- Leaving `catchup=True` by default and having a newly deployed DAG suddenly trigger months of historical runs.

---

## Retry & Failure Handling

**Definition:** Policies governing how a pipeline responds when a task fails.

**Key Points:**
- Set sensible `retries` + `retry_delay` with exponential backoff for transient failures (network blips, rate limits).
- Distinguish transient failures (retry) from permanent failures (bad data, schema mismatch — alert instead of blindly retrying).
- Use dead-letter queues or quarantine tables for records that repeatedly fail transformation/load.

**Example:**
```python
task = PythonOperator(
    task_id="extract",
    retries=3,
    retry_delay=timedelta(minutes=5),
    retry_exponential_backoff=True,
)
```

**When to Use / Trade-offs:**
- Aggressive retries are appropriate for network-dependent tasks; they're wasteful and can mask real bugs for deterministic failures (e.g., a malformed SQL query will fail identically every retry).

**Common Pitfalls:**
- Retrying a task that fails due to a code bug — burns time/resources without any chance of success.
- No dead-letter handling — a single malformed record blocks an entire batch indefinitely.

---

## Backfill / Re-run Strategies

**Definition:** Approach for designing pipelines so historical windows can be reprocessed correctly and safely.

**Key Points:**
- Design DAGs to accept a `run_date`/`execution_date` parameter so any historical run reprocesses the correct window.
- Avoid DAGs that only know "now" — this makes backfilling impossible without code changes.
- Re-runs should be idempotent so partial re-processing doesn't create duplicates.

**Example:**
```python
def extract(execution_date, **kwargs):
    return query_source(f"WHERE event_date = '{execution_date}'")
```

**When to Use / Trade-offs:**
- Always parametrize pipelines by logical date rather than wall-clock "now," even if the initial use case seems purely real-time — backfills are inevitable.

**Common Pitfalls:**
- Hardcoding `CURRENT_DATE` in transformation SQL, making it impossible to correctly backfill a past date.
