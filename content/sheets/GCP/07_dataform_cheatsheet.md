# Google Cloud Dataform Cheatsheet — *Bonus*

> SQL-based transformation framework for BigQuery — GCP's native equivalent to **dbt**. Manages dependencies, testing, and documentation for your ELT/analytics-engineering layer.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Type | Managed, Git-backed SQL transformation tool (transform-in-warehouse / ELT) |
| Target warehouse | BigQuery (also supports Snowflake, Redshift, etc., but native/free for BQ) |
| Best for | Turning raw BQ tables into clean, tested, documented analytics-ready tables/views — the "T" in ELT |
| Not for | Ingestion (use Dataflow/Pub-Sub/Data Transfer Service) or orchestration across non-BQ systems (use Composer) |

---

## 2. Core Concepts

| Concept | Description |
|---|---|
| **Repository** | Git-backed project containing all Dataform code |
| **Workspace** | A development sandbox (branch) for editing code before committing |
| **`.sqlx` file** | A SQL file with extra config block — defines a table/view/incremental table |
| **`ref()`** | Function to reference another Dataform table — auto-builds the dependency graph |
| **Dependency graph (DAG)** | Automatically inferred from `ref()` calls between models |
| **Assertions** | Data-quality tests (uniqueness, not-null, custom SQL conditions) |
| **Unit tests** | Test transformation logic against fixture input data |
| **Tags** | Labels to group/selectively run subsets of models |
| **Release configuration** | Defines when/how compiled code is deployed (e.g., nightly) |
| **Workflow configuration** | Schedules execution of a release (replaces manual `dataform run`) |

---

## 3. Project Structure

```
my_dataform_repo/
├── definitions/
│   ├── sources/
│   │   └── sources.js            # declare raw source tables
│   ├── staging/
│   │   └── stg_orders.sqlx
│   ├── marts/
│   │   └── fct_daily_sales.sqlx
│   └── tests/
│       └── stg_orders_test.sqlx
├── includes/
│   └── constants.js              # shared JS variables/macros
├── dataform.json                 # project config (warehouse, default schema)
└── package.json
```

---

## 4. Example `.sqlx` Files

### Declaring sources
```js
// definitions/sources/sources.js
declare({ database: "my-project", schema: "raw", name: "orders" });
declare({ database: "my-project", schema: "raw", name: "users" });
declare({ database: "my-project", schema: "raw", name: "products" });
```

### A staging model (view)
```sql
-- definitions/staging/stg_orders.sqlx
config {
  type: "view",
  schema: "staging",
  description: "Cleaned raw orders",
  columns: {
    order_id: "Unique order identifier",
    order_ts: "Timestamp the order was placed, UTC"
  }
}

SELECT
  order_id,
  CAST(order_ts AS TIMESTAMP) AS order_ts,
  UPPER(country) AS country,
  amount
FROM ${ref("orders")}
WHERE amount IS NOT NULL
```

### A mart (table) with assertions
```sql
-- definitions/marts/fct_daily_sales.sqlx
config {
  type: "table",
  schema: "marts",
  tags: ["daily"],
  bigquery: {
    partitionBy: "order_date",
    clusterBy: ["country"]
  },
  assertions: {
    uniqueKey: ["order_date", "country"],
    nonNull: ["total_sales"],
    rowConditions: ["total_sales >= 0"]
  }
}

SELECT
  DATE(order_ts) AS order_date,
  country,
  SUM(amount) AS total_sales
FROM ${ref("stg_orders")}
GROUP BY 1, 2
```

### Incremental table (only process new rows)
```sql
-- definitions/marts/fct_orders_incremental.sqlx
config {
  type: "incremental",
  schema: "marts",
  uniqueKey: ["order_id"]
}

SELECT * FROM ${ref("stg_orders")}
${when(incremental(), `WHERE order_ts > (SELECT MAX(order_ts) FROM ${self()})`)}
```

### Multiple joins referencing several models
```sql
-- definitions/marts/dim_customer_360.sqlx
config { type: "table", schema: "marts" }

SELECT
  u.user_id,
  u.country,
  COUNT(o.order_id) AS total_orders,
  SUM(o.amount) AS lifetime_value,
  MAX(o.order_ts) AS last_order_ts
FROM ${ref("stg_users")} u
LEFT JOIN ${ref("stg_orders")} o USING (user_id)
GROUP BY 1, 2
```

### Using JS variables/macros from `includes/`
```js
// includes/constants.js
const CUTOFF_DATE = "2024-01-01";
module.exports = { CUTOFF_DATE };
```
```sql
-- definitions/marts/recent_orders.sqlx
config { type: "view", schema: "marts" }

SELECT * FROM ${ref("stg_orders")}
WHERE order_ts >= '${constants.CUTOFF_DATE}'
```

### Custom SQL operations (non-`SELECT` statements)
```sql
-- definitions/ops/grant_access.sqlx
config { type: "operations", hasOutput: false }

GRANT `roles/bigquery.dataViewer`
ON TABLE ${ref("fct_daily_sales")}
TO "group:analysts@company.com"
```

### Unit test
```sql
-- definitions/tests/stg_orders_test.sqlx
config {
  type: "test",
  dataset: "stg_orders"
}

input "orders" {
  SELECT 'o1' AS order_id, '2024-01-01' AS order_ts, 'ph' AS country, 10.0 AS amount
  UNION ALL
  SELECT 'o2', '2024-01-01', 'us', NULL
}

SELECT 'o1' AS order_id, TIMESTAMP('2024-01-01') AS order_ts, 'PH' AS country, 10.0 AS amount
```

---

## 5. CLI

```bash
# Install
npm install -g @dataform/cli

# Init a new project
dataform init bigquery my_dataform_repo

# Install dependencies
dataform install

# Compile (dry-run, check for errors/circular deps)
dataform compile

# Run all models
dataform run

# Run a specific tag / model + its downstream dependents
dataform run --tags=daily
dataform run --actions=fct_daily_sales --include-deps

# Run tests/assertions only
dataform test
```

---

## 6. Automating Dataform with Python (Dataform API)

Dataform exposes a REST API (`dataform.googleapis.com`) that can be driven from Python for CI/CD or custom orchestration (e.g., calling it from a Cloud Function or a Composer `PythonOperator`).

```bash
pip install google-cloud-dataform
```

```python
from google.cloud import dataform_v1

client = dataform_v1.DataformClient()

repo_path = client.repository_path("my-project", "us-central1", "my_dataform_repo")

# Create a compilation result from the latest commit on main
compilation_result = client.create_compilation_result(
    request={
        "parent": repo_path,
        "compilation_result": {"git_commitish": "main"},
    }
)

# Trigger a workflow invocation (an actual run) from that compilation
workflow_invocation = client.create_workflow_invocation(
    request={
        "parent": repo_path,
        "workflow_invocation": {
            "compilation_result": compilation_result.name,
            "invocation_config": {"included_tags": ["daily"]},
        },
    }
)
print(f"Started run: {workflow_invocation.name}")

# Poll for completion
import time
while True:
    wi = client.get_workflow_invocation(request={"name": workflow_invocation.name})
    if wi.state in (dataform_v1.WorkflowInvocation.State.SUCCEEDED,
                    dataform_v1.WorkflowInvocation.State.FAILED):
        print(f"Finished with state: {wi.state}")
        break
    time.sleep(10)
```

### Triggering Dataform from Cloud Composer
```python
from airflow.providers.google.cloud.operators.dataform import (
    DataformCreateCompilationResultOperator,
    DataformCreateWorkflowInvocationOperator,
)

create_compilation = DataformCreateCompilationResultOperator(
    task_id="compile",
    project_id="my-project",
    region="us-central1",
    repository_id="my_dataform_repo",
    compilation_result={"git_commitish": "main"},
)

run_workflow = DataformCreateWorkflowInvocationOperator(
    task_id="run_dataform",
    project_id="my-project",
    region="us-central1",
    repository_id="my_dataform_repo",
    workflow_invocation={
        "compilation_result": "{{ task_instance.xcom_pull(task_ids='compile')['name'] }}"
    },
)

create_compilation >> run_workflow
```

---

## 7. Scheduling (Workflow Configurations)

In the Dataform UI/console, define:
1. A **Release Configuration** — compiles the repo (e.g., from `main` branch) on a schedule.
2. A **Workflow Configuration** — executes the compiled release on its own schedule (e.g., daily 5 AM), optionally filtered by tags.

This replaces needing a separate Composer DAG purely to run `dataform run` — though Composer can still trigger Dataform via the operators shown above if you need it as one step in a larger cross-service DAG.

---

## 8. Dataform vs dbt vs Scheduled Queries

| | Dataform | dbt | BQ Scheduled Query |
|---|---|---|---|
| Native to BigQuery | ✅ (built-in, free) | ❌ (separate tool/BigQuery adapter) | ✅ |
| Dependency graph | ✅ Automatic via `ref()` | ✅ Automatic via `ref()` | ❌ Manual |
| Testing/assertions | ✅ Built-in | ✅ Built-in | ❌ |
| Multi-warehouse | Limited | ✅ Broad support | ❌ BQ only |
| Best for | Teams fully on GCP/BQ | Multi-cloud/warehouse teams | One-off simple scheduled SQL |

---

## 9. Common Gotchas

- Circular `ref()` dependencies fail compilation — keep the DAG acyclic.
- `type: "incremental"` models need careful `uniqueKey`/`WHERE` logic or you'll get duplicate rows on reruns.
- Views (`type: "view"`) re-execute their SQL on every query against them — expensive for heavy transforms; use `table` for those.
- Assertions failing **block downstream dependent models** by default — decide if that's the behavior you want in production.
- Workspace changes aren't live until committed/pushed — easy to test in a workspace and forget to merge to `main`.

---

## 10. Useful Links

- Docs: https://cloud.google.com/dataform/docs
- Core concepts: https://cloud.google.com/dataform/docs/core-concepts
- Python client reference: https://cloud.google.com/python/docs/reference/dataform/latest
