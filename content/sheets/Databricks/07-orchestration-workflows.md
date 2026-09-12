# Orchestration & Workflows Cheatsheet

> Scheduling, chaining, and monitoring everything that runs on Databricks — Jobs, tasks, triggers, control flow, and alerting.

---

## 1. Core Concepts

| Term | Meaning |
|------|---------|
| **Job** | A container of one or more tasks, with a schedule/trigger and shared settings |
| **Task** | A single unit of work: notebook, Python script, JAR, SQL, dbt, DLT pipeline, `for-each` loop, etc. |
| **Task dependency** | DAG edges — tasks run only after their upstream dependencies succeed (or per custom run condition) |
| **Job Run** | One execution instance of a Job |
| **Job Cluster** | Ephemeral cluster created for the run and torn down afterward (vs. an always-on interactive/all-purpose cluster) |
| **Task Values** | Small key-value outputs one task can pass to downstream tasks in the same run |

```
        ┌────────────┐
        │  ingest     │
        └──────┬─────┘
               │
        ┌──────▼─────┐
        │ transform   │
        └──────┬─────┘
        ┌──────┴──────┐
        ▼             ▼
 ┌────────────┐ ┌────────────┐
 │  gold_1     │ │  gold_2    │
 └────────────┘ └────────────┘
```

---

## 2. Task Types

| Task Type | Use case |
|-----------|----------|
| **Notebook** | Most common — run a notebook with parameters |
| **Python script / wheel** | Run packaged Python code (`.py` file or installed wheel entry point) |
| **JAR** | Run compiled Scala/Java |
| **SQL** | Run a query, dashboard refresh, or alert against a SQL Warehouse |
| **DLT / Lakeflow Pipeline** | Trigger a declarative pipeline update |
| **dbt** | Run dbt models within a job, using a SQL Warehouse or cluster as the compute |
| **`for each`** | Fan-out a task over a list of parameter values (parallel or sequential, with a concurrency limit) |
| **Run Job** | Call another Job as a task — enables modular, reusable pipeline composition |
| **Condition (If/Else)** | Branch execution based on a boolean expression or task value |
| **Email / Webhook / Dashboard refresh** | Lightweight non-compute tasks for notification or BI refresh steps |

---

## 3. Defining Dependencies & Parameters

```json
{
  "name": "daily_sales_pipeline",
  "tasks": [
    {
      "task_key": "ingest",
      "notebook_task": {"notebook_path": "/Repos/prod/ingest", "base_parameters": {"env": "prod"}},
      "job_cluster_key": "main_cluster"
    },
    {
      "task_key": "transform",
      "depends_on": [{"task_key": "ingest"}],
      "notebook_task": {"notebook_path": "/Repos/prod/transform"},
      "job_cluster_key": "main_cluster"
    }
  ],
  "job_clusters": [
    {"job_cluster_key": "main_cluster", "new_cluster": {"spark_version": "15.4.x-scala2.12", "num_workers": 4, "node_type_id": "Standard_DS3_v2"}}
  ]
}
```

```python
# Reading parameters inside a notebook task
dbutils.widgets.get("env")
```

### Task Values — Passing Data Between Tasks
```python
# In "extract_count" task
dbutils.jobs.taskValues.set(key="row_count", value=15000)

# In a downstream task
count = dbutils.jobs.taskValues.get(taskKey="extract_count", key="row_count", default=0)
```
Useful for lightweight coordination (row counts, computed thresholds, dynamic file paths) without writing intermediate results to a table just to communicate between steps.

### Conditional Branching
```json
{
  "task_key": "check_threshold",
  "condition_task": {"op": "GREATER_THAN", "left": "{{tasks.extract_count.values.row_count}}", "right": "1000"}
}
```
Downstream tasks can depend on this condition task's outcome (`depends_on` with `outcome: "true"` / `"false"`) to implement if/else branches natively in the DAG.

---

## 4. Triggers

| Trigger type | Use case |
|---------------|----------|
| **Scheduled (cron)** | Fixed cadence, e.g. daily at 2 AM |
| **File arrival** | Fires when new files land in a specified storage location |
| **Continuous** | Immediately restarts the job when the previous run finishes/fails (for streaming-like jobs) |
| **Table update trigger** | Fires when a source Delta table changes (useful for event-driven, dependency-based pipelines instead of fixed schedules) |
| **Manual / API** | Triggered via UI, CLI, or REST API |
| **Run Job task** | Triggered as part of another job's DAG (parent-child composition) |

```json
"schedule": {
  "quartz_cron_expression": "0 0 2 * * ?",
  "timezone_id": "UTC"
}
```

### Cron Expression Breakdown
`0 0 2 * * ?` → second(0) minute(0) hour(2) day-of-month(*) month(*) day-of-week(?) → runs daily at 02:00. Always set `timezone_id` explicitly — relying on the workspace default timezone is a common source of "why did this run at the wrong time after DST changed" bugs.

---

## 5. Retries, Timeouts & Concurrency

```json
{
  "max_retries": 2,
  "min_retry_interval_millis": 60000,
  "retry_on_timeout": true,
  "timeout_seconds": 3600,
  "max_concurrent_runs": 1
}
```

- **`max_concurrent_runs: 1`** prevents overlapping runs from racing on the same tables — critical for `MERGE`-heavy pipelines where two concurrent runs could conflict (`ConcurrentAppendException`) or double-process data.
- Set **per-task retries** for flaky steps (e.g., third-party API calls) separately from the whole-job retry policy.
- **Repair Run**: if only some tasks in a DAG failed, you can re-run *just the failed tasks* (and their downstream dependents) instead of the entire job from scratch — saves time and avoids redundant reprocessing of already-succeeded steps.

---

## 6. Alerting & Notifications

```json
"email_notifications": {
  "on_start": ["team@company.com"],
  "on_success": [],
  "on_failure": ["oncall@company.com"],
  "on_duration_warning_threshold_exceeded": ["oncall@company.com"]
},
"webhook_notifications": {
  "on_failure": [{"id": "slack-webhook-id"}]
}
```

- **Duration warning thresholds** let you get alerted when a job is running *longer than usual* even before it outright fails — useful for catching gradual performance degradation early.
- **SQL Alerts**: defined separately against a query + SQL Warehouse; trigger when a metric crosses a threshold (e.g., row count drops to 0, freshness lag exceeds SLA).
- Use **system tables** (`system.lakeflow.job_run_timeline`, `system.billing.usage`) to build meta-monitoring dashboards over job health, duration trends, and cost across the whole account.

---

## 7. Job Clusters vs. All-Purpose Clusters vs. Serverless

| | Job Cluster | All-Purpose (Interactive) Cluster | Serverless Jobs |
|---|---|---|---|
| Lifecycle | Created for the run, terminated after | Long-running, shared by users | Fully managed, no cluster spec |
| DBU rate | Cheaper Jobs Compute rate | More expensive All-Purpose rate | Usage-based, no idle cost |
| Startup time | Cold start each run (unless pooled) | Already warm if running | Near-instant |
| Use case | Production scheduled workloads | Interactive development, ad hoc queries | Bursty/unpredictable production workloads |

> **Production rule of thumb:** always use **Job Clusters** or **Serverless** for scheduled workflows — never point production jobs at a shared interactive/all-purpose cluster. This is both a cost issue (higher DBU rate) and a reliability issue (someone else's interactive query can starve or crash your production job).

---

## 8. Serverless Jobs

- No cluster configuration required — Databricks manages compute transparently, scaling per-task automatically.
- Faster startup (no cold VM boot), simplified cost model (pay for usage, not idle time).
- Ideal for bursty, unpredictable, or many-small-jobs workloads where manually sizing a job cluster would mean over- or under-provisioning most of the time.
- Environment/dependency management is done via a lightweight **serverless environment spec** (Python version + package requirements) rather than a full cluster configuration.

```json
{
  "tasks": [{"task_key": "t1", "notebook_task": {"notebook_path": "/Repos/prod/etl"}}]
  // omit job_cluster_key / new_cluster entirely → runs serverless
}
```

---

## 9. Modular Workflows: "Run Job" Task

Break large pipelines into reusable, independently-owned Jobs and compose them:

```
Job A ("ingest_all_sources")
   └─ Run Job → Job B ("transform_customer")
   └─ Run Job → Job C ("transform_orders")
```
Benefits: independent ownership/permissions per sub-job, reusability across multiple parent pipelines, isolated failure blast radius (a bug in `transform_orders` doesn't require redeploying `ingest_all_sources`), and clearer on-call ownership boundaries between teams.

---

## 10. `for-each` Task (Fan-Out)

```json
{
  "task_key": "process_regions",
  "for_each_task": {
    "inputs": "{{tasks.get_regions.values.region_list}}",
    "concurrency": 5,
    "task": {
      "task_key": "process_one_region",
      "notebook_task": {"notebook_path": "/Repos/prod/process_region", "base_parameters": {"region": "{{input}}"}}
    }
  }
}
```
Runs the inner task once per element in the input list, up to `concurrency` in parallel — useful for per-tenant, per-region, or per-table processing patterns without hand-writing a loop across separate job definitions.

---

## 11. Managing Workflows as Code

Preferred production pattern: define jobs in **Databricks Asset Bundles (YAML)** rather than clicking in the UI — see the [DevOps & CI/CD cheatsheet](./10-devops-cicd.md).

```yaml
resources:
  jobs:
    daily_sales_pipeline:
      name: daily_sales_pipeline
      schedule:
        quartz_cron_expression: "0 0 2 * * ?"
        timezone_id: UTC
      max_concurrent_runs: 1
      tasks:
        - task_key: ingest
          notebook_task:
            notebook_path: ../src/ingest.py
      email_notifications:
        on_failure: ["oncall@company.com"]
```

---

## 12. Permissions on Jobs

Jobs support their own ACLs, independent of the underlying notebook/code permissions:

| Permission | Grants |
|------------|--------|
| **Can View** | See run history/logs |
| **Can Manage Run** | Trigger runs, cancel, repair |
| **Can Manage** | Edit job definition, change schedule/notifications |
| **Is Owner** | Full control, can change owner |

> Set the job's **"Run as"** identity (a service principal) separately from who has edit permissions — this way, engineers can update pipeline logic via CI/CD without the job's execution identity ever being tied to a personal account that might lose access when someone leaves the team.

---

## 13. CLI & API Quick Reference

```bash
databricks jobs list
databricks jobs get --job-id 12345
databricks jobs run-now --job-id 12345
databricks jobs run-now --job-id 12345 --python-params '["--env","prod"]'
databricks runs list --job-id 12345
databricks runs get-output --run-id 67890
databricks jobs repair-run --run-id 67890 --rerun-tasks '["transform"]'
```

---

## Related Cheatsheets
- [Ingestion, ETL & DLT](./05-ingestion-etl-dlt.md)
- [Cluster & Compute Management](./09-cluster-compute-management.md)
- [DevOps & CI/CD](./10-devops-cicd.md)
