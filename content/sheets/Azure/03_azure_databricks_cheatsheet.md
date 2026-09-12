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

# Jobs
databricks jobs create --json-file job-config.json
databricks jobs run-now --job-id 42
databricks runs get --run-id 100

# DBFS
databricks fs cp local_file.csv dbfs:/mnt/data/local_file.csv
databricks fs ls dbfs:/mnt/data/

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

## 6. Python SDK / REST API — Managing Databricks Programmatically

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

---

## 7. Unity Catalog (Governance)

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
```

---

## 8. Pricing

| Component | Billed by |
|---|---|
| Databricks compute | **DBU** (Databricks Unit) per hour, varies by cluster type/tier (Standard/Premium) |
| Underlying VMs | Standard Azure Compute pricing (billed separately by Azure) |
| SQL Warehouses (serverless) | Per DBU-second while running, auto-stop when idle |

💡 Use **Job clusters** (ephemeral, spun up per job) instead of leaving **All-Purpose clusters** running — job clusters are cheaper and auto-terminate.

---

## 9. Monitoring

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
```

---

## 10. Common Gotchas

- Leaving **All-Purpose clusters** running interactively overnight is the most common cost leak — set aggressive auto-termination.
- Forgetting `mergeSchema` on evolving streaming sources causes writes to fail once a new column appears upstream.
- `VACUUM` permanently deletes old file versions — running it with too short a retention breaks concurrent time-travel reads/other readers.
- Small-file problem in Delta tables from many small streaming micro-batches — schedule regular `OPTIMIZE` compaction.
- Not using **Job clusters** for scheduled jobs (using an interactive cluster instead) wastes money and risks resource contention with other users.
- Mixing Unity Catalog and legacy Hive Metastore tables in the same workspace can cause confusing permission/visibility issues during migration.

---

## 11. Useful Links

- Docs: https://learn.microsoft.com/en-us/azure/databricks/
- Delta Lake docs: https://docs.delta.io/latest/index.html
- Pricing: https://azure.microsoft.com/en-us/pricing/details/databricks/
- Python SDK reference: https://databricks-sdk-py.readthedocs.io/
