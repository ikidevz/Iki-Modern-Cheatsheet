# Databricks Cheatsheet (Master Reference)

> A complete, standalone, one-page Databricks cheatsheet — every core concept, command, and pattern across the platform in condensed form. Each section links to a full deep-dive cheatsheet for more detail, but this page alone covers enough to work productively across the whole platform.

---

## 🧭 Series Index

| # | Cheatsheet | Focus |
|---|-----------|-------|
| 1 | **Databricks (Master)** | This page |
| 2 | [Databricks Overview](./02-databricks-overview.md) | Platform architecture, control/data plane, editions, identity |
| 3 | [Spark Architecture & Runtime](./03-spark-architecture-runtime.md) | Driver/executors, memory, Catalyst, AQE, Photon |
| 4 | [Delta Table Deep Dive](./04-delta-table-deep-dive.md) | Transaction log, ACID, time travel, MERGE, clustering |
| 5 | [Ingestion, ETL & DLT](./05-ingestion-etl-dlt.md) | Auto Loader, COPY INTO, Lakeflow Pipelines, CDC |
| 6 | [Unity Catalog & Governance](./06-unity-catalog-governance.md) | Namespace, ACLs, lineage, masking, sharing |
| 7 | [Orchestration & Workflows](./07-orchestration-workflows.md) | Jobs, tasks, triggers, alerting |
| 8 | [Performance Tuning & Optimization](./08-performance-tuning-optimization.md) | Partitioning, joins, skew, caching |
| 9 | [Cluster & Compute Management](./09-cluster-compute-management.md) | Cluster types, pools, policies, serverless |
| 10 | [DevOps & CI/CD](./10-devops-cicd.md) | Asset Bundles, Repos, CI/CD pipelines |
| 11 | [Cost, Governance & Troubleshooting](./11-cost-governance-troubleshooting.md) | DBU economics, error reference, FinOps |
| 12 | [MLflow & ML](./12-mlflow-ml.md) | Tracking, Model Registry, serving, GenAI |

---

## 1. What Is Databricks (30-Second Version)

Databricks is a unified **data + AI platform**, built by the creators of Apache Spark, Delta Lake, and MLflow, that runs inside your own cloud account (AWS/Azure/GCP). It implements the **Lakehouse** architecture: one copy of data in open formats (Delta Lake) on cheap object storage, with ACID transactions, schema enforcement, and governance (Unity Catalog) layered on top — collapsing the old two-stack "data lake feeds a data warehouse" pattern into one system that serves BI, data engineering, and ML/AI alike.

**Control plane** (Databricks-managed): UI, job scheduler, notebook source, UC metadata.
**Data plane** (your cloud account, or a serverless managed plane): actual compute + your data at rest.

---

## 2. Core Building Blocks — Quick Reference

| Component | What it is |
|-----------|-----------|
| **Workspace** | Container for notebooks, jobs, clusters, repos, dashboards |
| **Notebook** | Multi-language (`%python`/`%sql`/`%scala`/`%r`) interactive code environment |
| **Cluster** | VMs (driver + executors) running Spark |
| **SQL Warehouse** | Compute optimized for BI/SQL (Serverless/Pro/Classic) |
| **Unity Catalog Metastore** | Governance layer: `catalog.schema.table` |
| **Job / Workflow** | Scheduled/triggered execution of tasks (notebook, SQL, DLT, dbt...) |
| **DLT / Lakeflow Pipeline** | Declarative ETL with built-in data quality checks |
| **Repos** | Git-backed notebook/code folders |
| **MLflow Experiment** | Tracked ML training runs |
| **Model Registry (UC Models)** | Versioned, governed ML model store |
| **Feature Store** | Reusable, point-in-time-correct ML feature tables |
| **Delta Sharing** | Zero-copy data sharing across orgs/platforms |
| **Volumes** | UC-governed storage for non-tabular files (replaces DBFS mounts) |

---

## 3. Spark Runtime — Quick Reference

**Roles:** Driver (builds DAG, schedules tasks) → Executors (run tasks, hold cached/shuffle data).

**Execution hierarchy:** Job (one action) → Stage (shuffle boundary) → Task (one per partition).

| Narrow (no shuffle) | Wide (shuffle) |
|---|---|
| `select`, `filter`, `withColumn`, `map` | `groupBy`, `join` (non-broadcast), `distinct`, `orderBy`, `repartition` |

```python
df.rdd.getNumPartitions()
df.repartition(200)      # full shuffle, even distribution
df.repartition("col")    # hash-partition by column
df.coalesce(10)          # merge partitions, no full shuffle

df.cache()                # MEMORY_AND_DISK
df.persist(StorageLevel.DISK_ONLY)
df.unpersist()
```

```sql
EXPLAIN FORMATTED SELECT * FROM t WHERE x = 1;   -- inspect the physical plan
```

**AQE** (on by default) re-optimizes at runtime: coalesces shuffle partitions, switches join strategy, splits skewed partitions.
```python
spark.conf.set("spark.sql.adaptive.enabled", "true")
spark.conf.set("spark.sql.adaptive.skewJoin.enabled", "true")
```

**Photon**: native vectorized engine, accelerates scans/joins/aggregations/writes — toggle at the cluster level, no code changes, auto-falls-back for unsupported ops.

→ Full depth: [Spark Architecture & Runtime](./03-spark-architecture-runtime.md)

---

## 4. Delta Lake — Quick Reference

Delta table = Parquet files + `_delta_log/` transaction log (JSON commits + periodic checkpoints) giving ACID, time travel, and schema enforcement on top of plain files.

```sql
CREATE TABLE t (id INT, name STRING) USING DELTA;
CREATE TABLE t USING DELTA LOCATION 's3://bucket/path/';   -- external table

INSERT INTO t VALUES (1, 'a');
UPDATE t SET name = 'b' WHERE id = 1;
DELETE FROM t WHERE id = 1;

MERGE INTO target t USING source s ON t.id = s.id
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *;

-- Time travel
SELECT * FROM t VERSION AS OF 12;
SELECT * FROM t TIMESTAMP AS OF '2026-08-01';
RESTORE TABLE t TO VERSION AS OF 12;
DESCRIBE HISTORY t;

-- Maintenance
OPTIMIZE t ZORDER BY (col1, col2);
VACUUM t RETAIN 168 HOURS;

-- Modern clustering (preferred over Hive partitioning)
CREATE TABLE t (...) CLUSTER BY (customer_id, order_ts);

-- Schema evolution
ALTER TABLE t ADD COLUMN new_col STRING;
```
```python
df.write.format("delta").mode("append").option("mergeSchema", "true").save(path)
```

**Change Data Feed:**
```sql
ALTER TABLE t SET TBLPROPERTIES (delta.enableChangeDataFeed = true);
SELECT * FROM table_changes('t', 10, 15);
```

→ Full depth: [Delta Table Deep Dive](./04-delta-table-deep-dive.md)

---

## 5. Ingestion & ETL — Quick Reference

**Medallion architecture:** Bronze (raw, as-is) → Silver (cleaned, deduped, conformed) → Gold (aggregated, business-ready).

| Method | Use case |
|--------|----------|
| **Auto Loader** (`cloudFiles`) | Continuous/incremental file ingestion, schema inference & evolution |
| **COPY INTO** | Simple, idempotent SQL batch loads |
| **Lakeflow Connect** | Managed SaaS/DB connectors (Salesforce, SQL Server, etc.) |
| **Structured Streaming** | Kafka/Kinesis/Event Hubs real-time ingestion |
| **Delta Sharing** | Consume another org's live data, zero-copy |

```python
df = (spark.readStream.format("cloudFiles")
      .option("cloudFiles.format", "json")
      .option("cloudFiles.schemaLocation", "/mnt/schemas/events")
      .load("/mnt/raw/events"))

(df.writeStream.option("checkpointLocation", "/mnt/chk/events")
   .trigger(availableNow=True)
   .toTable("bronze.events"))
```

```sql
COPY INTO bronze.orders FROM '/mnt/raw/orders/'
FILEFORMAT = CSV FORMAT_OPTIONS ('header'='true');
```

**DLT / Lakeflow Declarative Pipelines:**
```python
import dlt

@dlt.table
def bronze_orders():
    return spark.readStream.format("cloudFiles").option("cloudFiles.format","json").load("/mnt/raw/orders")

@dlt.table
@dlt.expect_or_drop("valid_amount", "amount > 0")
def silver_orders():
    return dlt.read_stream("bronze_orders")

dlt.apply_changes(target="silver_customers", source="bronze_changes",
                   keys=["id"], sequence_by="ts", stored_as_scd_type=2)
```

→ Full depth: [Ingestion, ETL & DLT](./05-ingestion-etl-dlt.md)

---

## 6. Unity Catalog & Governance — Quick Reference

**Namespace:** `metastore (per region) → catalog → schema → table/view/volume/function/model`

```sql
USE CATALOG my_catalog; USE SCHEMA my_schema;
SELECT * FROM my_catalog.my_schema.my_table;

GRANT USE CATALOG ON CATALOG my_catalog TO `data-engineers`;
GRANT SELECT ON TABLE my_catalog.sales.orders TO `analysts`;
GRANT MODIFY ON TABLE my_catalog.sales.orders TO `etl-sp`;
SHOW GRANTS ON TABLE my_catalog.sales.orders;
```

| Object | Governed by UC |
|--------|-----------------|
| Table, View, Volume, Function, Model, External Location, Storage Credential, Share |

**Column mask / row filter:**
```sql
ALTER TABLE t ALTER COLUMN email SET MASK mask_email;
ALTER TABLE t SET ROW FILTER region_filter ON (region);
```

**Lineage:** automatic, column-level, viewable in Catalog Explorer, queryable via `system.access.table_lineage`.

**Delta Sharing:**
```sql
CREATE SHARE s; ALTER SHARE s ADD TABLE cat.schema.t;
CREATE RECIPIENT r; GRANT SELECT ON SHARE s TO RECIPIENT r;
```

→ Full depth: [Unity Catalog & Governance](./06-unity-catalog-governance.md)

---

## 7. Orchestration & Workflows — Quick Reference

| Concept | Meaning |
|---------|---------|
| **Job** | Container of tasks + schedule/trigger |
| **Task** | notebook / Python / SQL / DLT / dbt / for-each / Run Job / Condition |
| **Job Cluster** | Ephemeral, cheaper than all-purpose, used for scheduled runs |

```json
{
  "name": "daily_pipeline",
  "schedule": {"quartz_cron_expression": "0 0 2 * * ?", "timezone_id": "UTC"},
  "max_concurrent_runs": 1,
  "tasks": [
    {"task_key": "ingest", "notebook_task": {"notebook_path": "/Repos/prod/ingest"}, "job_cluster_key": "main"},
    {"task_key": "transform", "depends_on": [{"task_key": "ingest"}], "notebook_task": {"notebook_path": "/Repos/prod/transform"}, "job_cluster_key": "main"}
  ],
  "email_notifications": {"on_failure": ["oncall@company.com"]}
}
```

```python
dbutils.jobs.taskValues.set(key="row_count", value=15000)     # producer task
dbutils.jobs.taskValues.get(taskKey="extract", key="row_count", default=0)  # consumer task
```

```bash
databricks jobs run-now --job-id 12345
databricks jobs repair-run --run-id 67890 --rerun-tasks '["transform"]'
```

→ Full depth: [Orchestration & Workflows](./07-orchestration-workflows.md)

---

## 8. Performance Tuning — Quick Reference

**Priority order:** fix data layout → fix joins/shuffles → fix skew → right-size cluster → micro-tune configs.

```sql
DESCRIBE DETAIL t;                 -- check numFiles for small-file problem
OPTIMIZE t ZORDER BY (col);
ANALYZE TABLE t COMPUTE STATISTICS FOR ALL COLUMNS;
```

```python
from pyspark.sql.functions import broadcast
big.join(broadcast(small), "id")     # force broadcast join for small tables

spark.conf.set("spark.sql.autoBroadcastJoinThreshold", 100*1024*1024)
```

| Symptom | Fix |
|---------|-----|
| One task much slower than others | Data skew → AQE skew join, or manual salting |
| High shuffle spill (disk) | Increase memory / more partitions |
| Many small files | `OPTIMIZE`, enable `autoOptimize`, Liquid Clustering |
| Bad join strategy chosen | `broadcast()` hint, fresh `ANALYZE TABLE` stats |
| Avoidable UDFs | Replace with native functions or Pandas UDFs |

→ Full depth: [Performance Tuning & Optimization](./08-performance-tuning-optimization.md)

---

## 9. Cluster & Compute — Quick Reference

| Type | Use case |
|------|----------|
| All-Purpose Cluster | Interactive dev (set `autotermination_minutes`) |
| Job Cluster | Scheduled production workloads (cheaper DBU rate) |
| SQL Warehouse | BI/SQL queries (prefer Serverless) |
| Serverless Compute | Bursty/unpredictable jobs, no cluster config |
| Instance Pools | Fast cluster startup via warm idle VMs |

```json
"autoscale": {"min_workers": 2, "max_workers": 8},
"autotermination_minutes": 30,
"aws_attributes": {"availability": "SPOT_WITH_FALLBACK"}
```

**Cluster policies** cap instance types, node count, enforce tags — critical for cost control.
**Access modes:** Single User, Shared (UC-enabled, multi-user), No Isolation Shared (legacy, avoid).

→ Full depth: [Cluster & Compute Management](./09-cluster-compute-management.md)

---

## 10. DevOps & CI/CD — Quick Reference

```yaml
# databricks.yml
bundle:
  name: my_project
targets:
  dev:
    workspace: {host: https://dev.cloud.databricks.com}
    mode: development
  prod:
    workspace: {host: https://prod.cloud.databricks.com}
    mode: production
    run_as: {service_principal_name: prod-sp}
```

```bash
databricks bundle init
databricks bundle validate
databricks bundle deploy -t prod
databricks bundle run etl_job -t dev
databricks bundle destroy -t dev
```

**Principles:** code in Git (Repos), infra as code (Asset Bundles/DABs), production runs as a **service principal**, secrets via `dbutils.secrets`, notebooks as thin wrappers around tested `.py` modules.

→ Full depth: [DevOps & CI/CD](./10-devops-cicd.md)

---

## 11. Cost, Governance & Troubleshooting — Quick Reference

**Billing = DBUs consumed + underlying cloud VM/storage cost.** DBU rate: All-Purpose > Jobs Compute > Serverless SQL (often cheapest due to zero idle cost).

```sql
SELECT usage_date, sku_name, SUM(usage_quantity) FROM system.billing.usage GROUP BY 1,2;
SELECT * FROM system.access.audit WHERE event_time > current_date() - 1;
```

| Common mistake | Fix |
|-----------------|-----|
| Idle all-purpose clusters | `autotermination_minutes`, use Job Clusters |
| Production on interactive cluster | Always Job Cluster / Serverless |
| No cluster policies | Enforce via admin policy |
| Small files / no OPTIMIZE | Schedule `OPTIMIZE`, use Liquid Clustering |

| Error | Cause |
|-------|-------|
| `ConcurrentAppendException` | Overlapping concurrent writers → narrow MERGE predicates |
| `AnalysisException: Table not found` | Missing `USE CATALOG`/`USE SCHEMA` |
| `PERMISSION_DENIED` | Missing grant up the namespace chain |
| `Py4JJavaError: OutOfMemoryError` | Skew, large `collect()`, or insufficient memory |

→ Full depth: [Cost, Governance & Troubleshooting](./11-cost-governance-troubleshooting.md)

---

## 12. MLflow & ML — Quick Reference

```python
import mlflow
mlflow.set_experiment("/Users/me/exp")

with mlflow.start_run():
    mlflow.log_param("alpha", 0.5)
    mlflow.log_metric("rmse", 0.89)
    mlflow.sklearn.log_model(model, "model", registered_model_name="cat.schema.model")

mlflow.set_registry_uri("databricks-uc")
model = mlflow.pyfunc.load_model("models:/cat.schema.model@champion")
```

```python
from mlflow import MlflowClient
MlflowClient().set_registered_model_alias("cat.schema.model", "champion", version=3)
```

**Serving:**
```bash
curl -X POST https://<ws>/serving-endpoints/my-endpoint/invocations \
  -H "Authorization: Bearer $TOKEN" -d '{"dataframe_records": [...]}'
```

**Feature Store:** point-in-time-correct feature tables via `FeatureLookup` to eliminate train/serve skew.
**GenAI (Mosaic AI):** Foundation Model APIs, Vector Search (RAG), AI Gateway, MLflow Tracing for agent observability.

→ Full depth: [MLflow & ML](./12-mlflow-ml.md)

---

## 13. Master Glossary

| Term | One-liner |
|------|-----------|
| **Lakehouse** | Data lake flexibility + data warehouse reliability, one copy of data |
| **Delta Lake** | Parquet + transaction log → ACID, time travel, schema enforcement |
| **Unity Catalog** | Account-wide governance: `catalog.schema.table`, grants, lineage |
| **Photon** | Native vectorized (C++) execution engine, drop-in Spark accelerator |
| **DBU** | Databricks Unit — billing measure of processing capability |
| **AQE** | Adaptive Query Execution — runtime re-optimization of the physical plan |
| **Liquid Clustering** | Modern replacement for Hive partitioning + Z-order |
| **Auto Loader** | Incremental, scalable cloud file ingestion (`cloudFiles`) |
| **DLT / Lakeflow Declarative Pipelines** | Declarative ETL with built-in DAG + data quality |
| **Job Cluster** | Ephemeral compute for a scheduled job run |
| **Service Principal** | Non-human identity for production jobs/CI-CD |
| **Asset Bundle (DAB)** | YAML-based infra-as-code for jobs/pipelines/clusters |
| **MLflow** | Experiment tracking, model packaging, registry, serving |
| **Feature Store** | Governed, point-in-time-correct ML feature tables |
| **Delta Sharing** | Open protocol for zero-copy cross-org data sharing |

---

## 14. Frequently Asked Questions

**Where does my data actually live?**
In your own cloud object storage (S3/ADLS/GCS) — Databricks orchestrates compute against it but doesn't hold a separate copy in the classic model.

**Partitioning or Liquid Clustering for a new table?**
Default to Liquid Clustering — it avoids skew/small-file issues and supports evolving keys without a full rewrite.

**Why is my job so expensive?**
Almost always: running on an all-purpose cluster instead of a job cluster, missing autoscaling/auto-termination, or an unaddressed small-file/skew problem.

**How do I move a job from dev to prod safely?**
Databricks Asset Bundles with separate `targets`, environment-specific variables, and a service-principal `run_as` for prod.

**Notebook or DLT for a new pipeline?**
Use DLT/Lakeflow when you need automatic dependency resolution, built-in data quality expectations, or CDC handling (`apply_changes`). Use plain notebooks/Jobs for simpler, linear scripts.

**`.cache()` or Delta disk cache?**
Delta disk cache is automatic and best for repeated reads of the same table files across queries/users. `.cache()`/`.persist()` is better for pinning one specific transformed DataFrame across multiple actions within a single job.

---

## 15. How to Use This Series

- New to the platform → start here, then read **#2 Overview**.
- Engineering/ETL work → **#3–#5**.
- Governance and orchestration → **#6–#7**.
- Tuning, infra, DevOps, cost → **#8–#11**.
- ML and GenAI lifecycle → **#12**.

Bookmark this master page for quick lookups, and drill into the linked deep-dives whenever you need full internals, edge cases, or complete code examples.
