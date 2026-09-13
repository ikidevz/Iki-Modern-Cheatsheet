# Azure Databricks Cheatsheet

> Managed, collaborative Apache Spark platform built on Delta Lake — the go-to engine for large-scale data engineering, ML, and the "Lakehouse" pattern.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Type | Managed Apache Spark + Delta Lake platform (notebooks, jobs, ML) |
| Storage format | Delta Lake (ACID transactions, time travel, schema enforcement on top of Parquet) |
| Best for | Large-scale Spark ETL, streaming ingestion (Autoloader), ML/AI, collaborative notebook development |
| Not for | Simple SQL-only warehousing at small scale (Synapse serverless/BigQuery-style tools are simpler) |

---

## 2. Core Concepts

| Concept | Description |
|---|---|
| **Workspace** | The Databricks environment: notebooks, jobs, clusters, repos, all in one place |
| **Cluster** | Managed set of VMs running Spark; **All-Purpose** (interactive) vs **Job** (ephemeral, per-job) |
| **Notebook** | Interactive, multi-language (Python/SQL/Scala/R) document — primary dev interface |
| **Job / Workflow** | Scheduled or triggered execution of a notebook/JAR/Python script, with dependencies between tasks |
| **Delta Lake** | Open storage format adding ACID transactions, schema enforcement, time travel to Parquet |
| **Unity Catalog** | Centralized governance layer: catalogs → schemas → tables/views, with fine-grained access control |
| **DBFS** | Databricks File System — a managed abstraction over cloud storage |
| **Repos** | Git integration for notebooks/code, enabling CI/CD |
| **Delta Live Tables (DLT)** | Declarative framework for building reliable ETL pipelines with built-in quality checks |
| **Autoloader** | Efficient, scalable incremental file ingestion from cloud storage (structured streaming source) |
| **Cluster Policy** | Admin-defined constraints on cluster creation (node types, max size, tags) to control cost/compliance |

---

## 3. CLI (`databricks` CLI)

```bash
# Install & configure
pip install databricks-cli
databricks configure --token   # prompts for host + personal access token

# Workspace
databricks workspace ls /Users/me@company.com
databricks workspace import my_notebook.py /Shared/my_notebook -l PYTHON

# Clusters
databricks clusters list
databricks clusters create --json-file cluster-config.json
databricks clusters start --cluster-id 1234-567890-abcde123
databricks clusters terminate --cluster-id 1234-567890-abcde123

# Jobs
databricks jobs create --json-file job-config.json
databricks jobs run-now --job-id 42
databricks runs get --run-id 100
databricks runs list --job-id 42

# DBFS
databricks fs cp local_file.csv dbfs:/mnt/data/local_file.csv
databricks fs ls dbfs:/mnt/data/

# Repos (Git integration for CI/CD)
databricks repos create --url https://github.com/my-org/my-repo --provider gitHub --path /Repos/prod/my-repo
databricks repos update --repo-id 123456 --branch main

# Secrets (for credentials, never hardcode in notebooks)
databricks secrets create-scope --scope my-scope
databricks secrets put --scope my-scope --key my-api-key
```

---

## 4. PySpark Examples

### Example 1 — Read/write Delta tables
```python
df = spark.read.format("delta").load("/mnt/data/events")

df.filter(df.country == "PH") \
  .groupBy("event_type").count() \
  .write.format("delta").mode("overwrite").save("/mnt/data/event_counts")

# Or as a managed Unity Catalog table
df.write.format("delta").mode("overwrite").saveAsTable("main.analytics.event_counts")
```

### Example 2 — Delta Lake MERGE (upsert)
```python
from delta.tables import DeltaTable

target = DeltaTable.forPath(spark, "/mnt/data/customers")
updates = spark.read.parquet("/mnt/data/staging/customer_updates")

(target.alias("t")
    .merge(updates.alias("s"), "t.customer_id = s.customer_id")
    .whenMatchedUpdateAll()
    .whenNotMatchedInsertAll()
    .execute())
```

### Example 3 — Time travel (query historical versions)
```python
# By version number
df_v5 = spark.read.format("delta").option("versionAsOf", 5).load("/mnt/data/events")

# By timestamp
df_yesterday = spark.read.format("delta") \
    .option("timestampAsOf", "2026-09-11") \
    .load("/mnt/data/events")

# View table history
spark.sql("DESCRIBE HISTORY delta.`/mnt/data/events`").show()

# Roll back to a previous version (RESTORE)
spark.sql("RESTORE TABLE main.analytics.event_counts TO VERSION AS OF 5")
```

### Example 4 — OPTIMIZE, Z-ORDER & VACUUM (table maintenance)
```python
spark.sql("OPTIMIZE main.analytics.event_counts ZORDER BY (country, event_type)")
spark.sql("VACUUM main.analytics.event_counts RETAIN 168 HOURS")   # 7-day retention
```

### Example 5 — Autoloader (incremental streaming file ingestion)
```python
df = (spark.readStream
      .format("cloudFiles")
      .option("cloudFiles.format", "json")
      .option("cloudFiles.schemaLocation", "/mnt/schemas/events")
      .load("/mnt/landing/events/"))

query = (df.writeStream
         .format("delta")
         .option("checkpointLocation", "/mnt/checkpoints/events")
         .trigger(availableNow=True)     # process what's available, then stop (batch-like)
         .table("main.raw.events"))
```

### Example 6 — Structured Streaming from Event Hubs (Kafka protocol)
```python
kafka_options = {
    "kafka.bootstrap.servers": "myeventhub.servicebus.windows.net:9093",
    "subscribe": "orders",
    "kafka.sasl.mechanism": "PLAIN",
    "kafka.security.protocol": "SASL_SSL",
    "kafka.sasl.jaas.config": (
        'kafkashaded.org.apache.kafka.common.security.plain.PlainLoginModule required '
        'username="$ConnectionString" password="{EVENT_HUB_CONNECTION_STRING}";'
    ),
    "startingOffsets": "latest",
}

raw = spark.readStream.format("kafka").options(**kafka_options).load()

from pyspark.sql.functions import from_json, col
import json

parsed = raw.selectExpr("CAST(value AS STRING) as json_str") \
    .select(from_json(col("json_str"), schema).alias("data")).select("data.*")

query = (parsed.writeStream
         .format("delta")
         .option("checkpointLocation", "/mnt/checkpoints/orders")
         .table("main.raw.orders"))
```

### Example 7 — Window functions & joins
```python
from pyspark.sql import functions as F
from pyspark.sql.window import Window

orders = spark.table("main.raw.orders")
users = spark.table("main.raw.users")

joined = orders.join(users, on="user_id", how="left")

w = Window.partitionBy("user_id").orderBy(F.col("order_ts").desc())
latest = joined.withColumn("rn", F.row_number().over(w)).filter("rn = 1")
```

### Example 8 — Schema enforcement & evolution
```python
# Enforce schema (fails write if incompatible)
df.write.format("delta").mode("append").save("/mnt/data/events")

# Explicitly allow schema evolution (new columns)
df.write.format("delta").option("mergeSchema", "true").mode("append").save("/mnt/data/events")
```

### Example 9 — UDFs and Pandas UDFs (vectorized, much faster)
```python
from pyspark.sql.functions import udf, pandas_udf
from pyspark.sql.types import StringType
import pandas as pd

@udf(StringType())
def normalize_country(code):
    return "Philippines" if code == "PH" else code

@pandas_udf(StringType())
def normalize_country_vectorized(codes: pd.Series) -> pd.Series:
    return codes.replace({"PH": "Philippines"})

df = df.withColumn("country_name", normalize_country_vectorized(df.country))
```

### Example 10 — Broadcast joins & performance tuning
```python
from pyspark.sql.functions import broadcast

# Force a broadcast join when joining a large table to a small lookup table
result = orders.join(broadcast(small_country_lookup), on="country_code", how="left")

# Cache a DataFrame reused multiple times in the same session
users.cache()
users.count()   # triggers the cache to materialize

# Repartition before a wide shuffle-heavy operation; coalesce before writing few large files
df = df.repartition(200, "country")
df.coalesce(10).write.format("delta").mode("overwrite").save("/mnt/data/output")
```

### Example 11 — Exploding arrays / working with nested JSON
```python
from pyspark.sql.functions import explode, col

df = spark.read.json("/mnt/data/nested_events.json")
flat = df.select("user_id", explode("events").alias("event")) \
         .select("user_id", col("event.event_type"), col("event.timestamp"))
```

### Example 12 — Delta Change Data Feed (CDF) — track row-level changes
```python
# Enable CDF on a table
spark.sql("ALTER TABLE main.raw.orders SET TBLPROPERTIES (delta.enableChangeDataFeed = true)")

# Read only what changed between two versions
changes = spark.read.format("delta") \
    .option("readChangeFeed", "true") \
    .option("startingVersion", 10) \
    .option("endingVersion", 15) \
    .table("main.raw.orders")

changes.select("order_id", "_change_type", "_commit_version").show()
```

---

## 5. Delta Live Tables (DLT) — Declarative Pipelines

```python
import dlt
from pyspark.sql.functions import col

@dlt.table(comment="Raw bronze layer from landing zone")
def bronze_events():
    return (spark.readStream.format("cloudFiles")
            .option("cloudFiles.format", "json")
            .load("/mnt/landing/events/"))

@dlt.table(comment="Cleaned silver layer")
@dlt.expect_or_drop("valid_amount", "amount IS NOT NULL AND amount >= 0")
def silver_events():
    return dlt.read_stream("bronze_events").filter(col("event_type").isNotNull())

@dlt.table(comment="Gold aggregate for BI")
def gold_daily_sales():
    return (dlt.read("silver_events")
            .groupBy("event_date", "country")
            .agg({"amount": "sum"}))
```

---

## 6. Multi-Task Workflows (Jobs with Dependencies)

Databricks Jobs support multiple tasks in a DAG, similar to an Airflow DAG but native to the platform:

```python
from databricks.sdk.service.jobs import Task, NotebookTask, TaskDependency

tasks = [
    Task(task_key="ingest", notebook_task=NotebookTask(notebook_path="/Shared/ingest")),
    Task(task_key="transform", notebook_task=NotebookTask(notebook_path="/Shared/transform"),
         depends_on=[TaskDependency(task_key="ingest")]),
    Task(task_key="quality_check", notebook_task=NotebookTask(notebook_path="/Shared/quality_check"),
         depends_on=[TaskDependency(task_key="transform")]),
    # A task that only runs if quality_check fails (conditional/error-handling task)
    Task(task_key="notify_on_failure", notebook_task=NotebookTask(notebook_path="/Shared/notify"),
         depends_on=[TaskDependency(task_key="quality_check")],
         run_if="ALL_FAILED"),
]
w.jobs.create(name="multi-task-etl", tasks=tasks)
```

---

## 7. Python SDK / REST API — Managing Databricks Programmatically

```bash
pip install databricks-sdk
```

### Cluster management
```python
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.compute import ClusterSpec

w = WorkspaceClient(host="https://adb-xxxx.azuredatabricks.net", token="dapi...")

cluster = w.clusters.create(
    cluster_name="etl-cluster",
    spark_version="14.3.x-scala2.12",
    node_type_id="Standard_DS3_v2",
    num_workers=2,
    autotermination_minutes=30,
).result()
print(cluster.cluster_id)
```

### Submit and run a job
```python
from databricks.sdk.service.jobs import Task, NotebookTask

job = w.jobs.create(
    name="daily-etl-job",
    tasks=[Task(
        task_key="run_etl",
        notebook_task=NotebookTask(notebook_path="/Shared/etl_notebook"),
        existing_cluster_id=cluster.cluster_id,
    )],
)

run = w.jobs.run_now(job_id=job.job_id)
result = run.result()   # blocks until completion
print(result.state.result_state)
```

### List jobs & recent runs (monitoring script)
```python
for job in w.jobs.list():
    print(job.job_id, job.settings.name)

runs = w.jobs.list_runs(job_id=job.job_id, limit=10)
for run in runs:
    print(run.run_id, run.state.result_state, run.start_time)
```

### Query Unity Catalog tables from Python (outside a notebook, via SQL Warehouse)
```python
from databricks import sql

with sql.connect(
    server_hostname="adb-xxxx.azuredatabricks.net",
    http_path="/sql/1.0/warehouses/abc123",
    access_token="dapi...",
) as conn:
    with conn.cursor() as cursor:
        cursor.execute("SELECT country, COUNT(*) n FROM main.analytics.event_counts GROUP BY country")
        for row in cursor.fetchall():
            print(row)
```

### Manage secrets programmatically
```python
w.secrets.create_scope(scope="my-scope")
w.secrets.put_secret(scope="my-scope", key="api-key", string_value="super-secret-value")
```

### Sync a Repo (CI/CD pattern — pull latest code before running a job)
```python
w.repos.update(repo_id=123456, branch="main")
```

### MLflow — track an experiment run from a notebook or job
```python
import mlflow

with mlflow.start_run(run_name="churn_model_v3"):
    mlflow.log_param("max_depth", 5)
    mlflow.log_metric("auc", 0.87)
    mlflow.spark.log_model(model, "model")

# Register the model to Unity Catalog for governed deployment
mlflow.register_model("runs:/<run_id>/model", "main.ml_models.churn_model")
```

---

## 8. Unity Catalog (Governance)

```sql
-- Three-level namespace: catalog.schema.table
CREATE CATALOG IF NOT EXISTS main;
CREATE SCHEMA IF NOT EXISTS main.analytics;
CREATE TABLE main.analytics.event_counts (country STRING, n BIGINT) USING DELTA;

-- Grants
GRANT SELECT ON TABLE main.analytics.event_counts TO `analysts@company.com`;
GRANT USAGE ON CATALOG main TO `analysts@company.com`;

-- Row-level & column-level security via masking functions / row filters
CREATE FUNCTION main.analytics.country_filter(country STRING) RETURN
  IF(IS_ACCOUNT_GROUP_MEMBER('admins'), true, country = current_user_country());
ALTER TABLE main.analytics.event_counts SET ROW FILTER main.analytics.country_filter ON (country);

-- External locations (governed access to ADLS Gen2 paths outside the managed catalog storage)
CREATE EXTERNAL LOCATION my_external_loc
URL 'abfss://data@myadls.dfs.core.windows.net/external/'
WITH (CREDENTIAL my_storage_credential);
```

---

## 9. Pricing

| Component | Billed by |
|---|---|
| Databricks compute | **DBU** (Databricks Unit) per hour, varies by cluster type/tier (Standard/Premium) |
| Underlying VMs | Standard Azure Compute pricing (billed separately by Azure) |
| SQL Warehouses (serverless) | Per DBU-second while running, auto-stop when idle |

💡 Use **Job clusters** (ephemeral, spun up per job) instead of leaving **All-Purpose clusters** running — job clusters are cheaper and auto-terminate. Use **cluster policies** to prevent users from spinning up oversized interactive clusters.

---

## 10. Monitoring

- **Spark UI** (per cluster): stages, tasks, DAG visualization, executor metrics.
- **Databricks Jobs UI**: run history, task-level logs, retry status.
- **System tables** (Unity Catalog): `system.billing.usage`, `system.access.audit` for cost/audit queries via SQL.
- **Ganglia / cluster metrics**: CPU, memory, network per node.

```sql
-- Query DBU consumption by job (system tables)
SELECT usage_metadata.job_id, SUM(usage_quantity) AS total_dbus
FROM system.billing.usage
WHERE usage_date >= current_date() - INTERVAL 7 DAYS
GROUP BY usage_metadata.job_id
ORDER BY total_dbus DESC;

-- Audit who queried a sensitive table
SELECT user_identity.email, request_params.full_name_arg, event_time
FROM system.access.audit
WHERE action_name = 'getTable' AND request_params.full_name_arg = 'main.analytics.event_counts'
ORDER BY event_time DESC;
```

---

## 11. Common Gotchas

- Leaving **All-Purpose clusters** running interactively overnight is the most common cost leak — set aggressive auto-termination.
- Forgetting `mergeSchema` on evolving streaming sources causes writes to fail once a new column appears upstream.
- `VACUUM` permanently deletes old file versions — running it with too short a retention breaks concurrent time-travel reads/other readers.
- Small-file problem in Delta tables from many small streaming micro-batches — schedule regular `OPTIMIZE` compaction.
- Not using **Job clusters** for scheduled jobs (using an interactive cluster instead) wastes money and risks resource contention with other users.
- Mixing Unity Catalog and legacy Hive Metastore tables in the same workspace can cause confusing permission/visibility issues during migration.
- `run_if` conditions on tasks are easy to get backwards (e.g., meaning to run only on failure but leaving the default `ALL_SUCCESS`) — always double check on error-handling tasks.

---

## 12. Useful Links

- Docs: https://learn.microsoft.com/en-us/azure/databricks/
- Delta Lake docs: https://docs.delta.io/latest/index.html
- Pricing: https://azure.microsoft.com/en-us/pricing/details/databricks/
- Python SDK reference: https://databricks-sdk-py.readthedocs.io/
