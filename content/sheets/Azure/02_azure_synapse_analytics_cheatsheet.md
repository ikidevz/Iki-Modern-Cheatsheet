# Azure Synapse Analytics Cheatsheet

> Unified analytics service combining data warehousing (SQL pools), big data (Spark pools), and pipelines (ADF-based) in one workspace.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Type | PaaS unified analytics platform: SQL + Spark + Pipelines in one workspace (Synapse Studio) |
| Compute models | Dedicated SQL Pool (MPP warehouse), Serverless SQL Pool (on-demand, pay-per-query), Spark Pool |
| Best for | Enterprise data warehousing, ad-hoc lake queries, Spark ETL, all inside one governed workspace |
| Not for | Sub-second real-time queries; very small/simple workloads (overhead of dedicated pools isn't worth it) |
| 2026 note | Microsoft's new investment is concentrated on **Microsoft Fabric**, described internally as "the next version of Synapse." Synapse remains fully supported with no announced end-of-life, and is still the right choice for tuned Dedicated SQL Pools, GPU-accelerated Spark, or strict sovereign-cloud constraints — see `07_microsoft_fabric_cheatsheet.md` for the comparison. |

---

## 2. Core Concepts

| Concept | Description |
|---|---|
| **Workspace** | The top-level Synapse resource containing all pools, pipelines, and Synapse Studio |
| **Dedicated SQL Pool** | Provisioned MPP data warehouse, billed in DWUs (Data Warehouse Units) |
| **Serverless SQL Pool** | Always-on, pay-per-TB-scanned SQL engine that queries files directly in the data lake |
| **Spark Pool** | Managed Apache Spark cluster for notebooks/jobs, autoscaling, auto-pause |
| **Synapse Pipelines** | ADF engine embedded in Synapse — same activities/concepts as `01_azure_data_factory_cheatsheet.md` |
| **Synapse Link** | Near-real-time analytics over operational data (Cosmos DB, SQL DB) without ETL |
| **Distribution** | How a table's rows are spread across the 60 underlying compute nodes: Hash, Round Robin, Replicate |
| **Workspace SQL/Spark database** | Shared metadata (Lake Database) queryable by both SQL and Spark engines |

---

## 3. Azure CLI Reference

```bash
# Create a Synapse workspace
az synapse workspace create --name my-synapse-ws --resource-group my-rg \
  --storage-account myadlsaccount --file-system synapsefs \
  --sql-admin-login-user sqladminuser --sql-admin-login-password 'P@ssw0rd!' \
  --location eastus

# Dedicated SQL Pool
az synapse sql pool create --name mysqlpool --workspace-name my-synapse-ws \
  --resource-group my-rg --performance-level DW200c

az synapse sql pool pause --name mysqlpool --workspace-name my-synapse-ws --resource-group my-rg
az synapse sql pool resume --name mysqlpool --workspace-name my-synapse-ws --resource-group my-rg
az synapse sql pool update --name mysqlpool --workspace-name my-synapse-ws \
  --resource-group my-rg --performance-level DW500c   # scale up/down

# Spark Pool
az synapse spark pool create --name mysparkpool --workspace-name my-synapse-ws \
  --resource-group my-rg --spark-version 3.4 \
  --node-count 3 --node-size Medium --enable-auto-pause true --delay 15

# Run a SQL script against a pool
az synapse sql pool query --name mysqlpool --workspace-name my-synapse-ws \
  --resource-group my-rg --query "SELECT TOP 10 * FROM dbo.Sales"
```

---

## 4. SQL — Dedicated SQL Pool (Data Warehousing)

### Table distribution & indexing (critical for MPP performance)
```sql
-- Hash-distributed fact table (spreads large tables across nodes by a key)
CREATE TABLE dbo.FactSales
(
    SaleId      BIGINT,
    ProductId   INT,
    CustomerId  INT,
    Amount      DECIMAL(10,2),
    SaleDate    DATE
)
WITH (
    DISTRIBUTION = HASH(CustomerId),
    CLUSTERED COLUMNSTORE INDEX,
    PARTITION (SaleDate RANGE RIGHT FOR VALUES
        ('2024-01-01', '2024-04-01', '2024-07-01', '2024-10-01'))
);

-- Replicated dimension table (small, frequently joined — copied to every node)
CREATE TABLE dbo.DimProduct
(
    ProductId INT, ProductName NVARCHAR(200), Category NVARCHAR(100)
)
WITH ( DISTRIBUTION = REPLICATE, CLUSTERED COLUMNSTORE INDEX );

-- Round-robin (default; use when no obvious distribution key, staging tables)
CREATE TABLE dbo.StagingSales (SaleId BIGINT, Amount DECIMAL(10,2))
WITH ( DISTRIBUTION = ROUND_ROBIN, HEAP );
```

### CTAS (Create Table As Select) — the recommended way to transform at scale
```sql
CREATE TABLE dbo.DailySalesSummary
WITH (DISTRIBUTION = HASH(ProductId), CLUSTERED COLUMNSTORE INDEX)
AS
SELECT ProductId, SaleDate, SUM(Amount) AS TotalSales
FROM dbo.FactSales
GROUP BY ProductId, SaleDate;
```

### Statistics (essential for the query optimizer)
```sql
CREATE STATISTICS stat_FactSales_CustomerId ON dbo.FactSales(CustomerId);
UPDATE STATISTICS dbo.FactSales;
```

### Workload management
```sql
-- Classify a login into a workload group with resource limits
CREATE WORKLOAD GROUP DataLoadGroup
WITH (MIN_PERCENTAGE_RESOURCE = 40, CAP_PERCENTAGE_RESOURCE = 60, REQUEST_MIN_RESOURCE_GRANT_PERCENT = 10);

CREATE WORKLOAD CLASSIFIER LoadClassifier
WITH (WORKLOAD_GROUP = 'DataLoadGroup', MEMBERNAME = 'etl_service_account');
```

---

## 5. SQL — Serverless SQL Pool (Query the Data Lake Directly)

```sql
-- Query Parquet files directly in ADLS Gen2, no loading required
SELECT
    r.filepath(1) AS [year],
    COUNT(*) AS n
FROM OPENROWSET(
    BULK 'https://myadls.dfs.core.windows.net/data/events/year=*/*.parquet',
    FORMAT = 'PARQUET'
) AS r
GROUP BY r.filepath(1);

-- Create an external table for repeated querying / BI tool access
CREATE EXTERNAL DATA SOURCE LakeData
WITH (LOCATION = 'https://myadls.dfs.core.windows.net/data/');

CREATE EXTERNAL FILE FORMAT ParquetFormat WITH (FORMAT_TYPE = PARQUET);

CREATE EXTERNAL TABLE dbo.ExtEvents
(
    event_id VARCHAR(50), user_id VARCHAR(50), amount FLOAT, country VARCHAR(10)
)
WITH (
    LOCATION = 'events/',
    DATA_SOURCE = LakeData,
    FILE_FORMAT = ParquetFormat
);

-- Create a view over the lake, queryable from Power BI like any SQL table
CREATE VIEW dbo.v_events AS
SELECT * FROM OPENROWSET(
    BULK 'https://myadls.dfs.core.windows.net/data/events/*.parquet', FORMAT = 'PARQUET'
) AS r;
```

---

## 6. PySpark in Synapse Notebooks

```python
# Cell 1: read from the lake
df = spark.read.parquet("abfss://data@myadls.dfs.core.windows.net/events/")

# Cell 2: transform
from pyspark.sql import functions as F
result = df.filter(df.country == "PH").groupBy("event_type").agg(F.count("*").alias("n"))

# Cell 3: write to a Synapse Lake Database table (queryable from both Spark and SQL)
result.write.mode("overwrite").saveAsTable("lake_db.event_counts")

# Cell 4: write directly into a Dedicated SQL Pool table
result.write \
    .format("com.databricks.spark.sqldw") \
    .option("url", "jdbc:sqlserver://my-synapse-ws.sql.azuresynapse.net:1433;database=mysqlpool") \
    .option("tempDir", "abfss://staging@myadls.dfs.core.windows.net/tmp") \
    .option("forwardSparkAzureStorageCredentials", "true") \
    .option("dbTable", "dbo.EventCounts") \
    .mode("overwrite") \
    .save()

# Using %%sql magic to run Spark SQL in the same notebook
spark.sql("SELECT country, COUNT(*) n FROM lake_db.event_counts GROUP BY country").show()
```

---

## 7. Python SDK — Managing Synapse Programmatically

```bash
pip install azure-synapse-artifacts azure-mgmt-synapse azure-identity
```

### Submit and monitor a Spark job (Synapse Artifacts API)
```python
from azure.identity import DefaultAzureCredential
from azure.synapse.spark import SparkClient
from azure.synapse.spark.models import SparkBatchJobOptions

credential = DefaultAzureCredential()
spark_client = SparkClient(
    credential=credential,
    endpoint="https://my-synapse-ws.dev.azuresynapse.net",
    spark_pool_name="mysparkpool",
)

job = spark_client.spark_batch.create_spark_batch_job(
    SparkBatchJobOptions(
        name="daily-etl-job",
        file="abfss://code@myadls.dfs.core.windows.net/jobs/etl_job.py",
        driver_memory="4g", driver_cores=2,
        executor_memory="4g", executor_cores=2, executor_count=2,
    )
)
print(f"Submitted job id: {job.id}")

status = spark_client.spark_batch.get_spark_batch_job(job.id)
print(status.state)
```

### Run a pipeline (Synapse Pipelines = ADF engine)
```python
from azure.synapse.artifacts import ArtifactsClient

artifacts_client = ArtifactsClient(credential=credential, endpoint="https://my-synapse-ws.dev.azuresynapse.net")
run = artifacts_client.pipeline.create_pipeline_run("CopyBlobToSql", parameters={"sourcePath": "raw/2026-09-01"})
print(f"Run ID: {run.run_id}")
```

### Manage Dedicated SQL Pool (pause/resume/scale for cost control)
```python
from azure.mgmt.synapse import SynapseManagementClient

mgmt_client = SynapseManagementClient(credential, subscription_id="MY_SUB_ID")

# Pause a pool overnight to save cost
mgmt_client.sql_pools.begin_pause("my-rg", "my-synapse-ws", "mysqlpool").wait()

# Resume it in the morning
mgmt_client.sql_pools.begin_resume("my-rg", "my-synapse-ws", "mysqlpool").wait()

# Scale it up before a heavy batch load
from azure.mgmt.synapse.models import SqlPool
mgmt_client.sql_pools.begin_update(
    "my-rg", "my-synapse-ws", "mysqlpool", SqlPool(sku={"name": "DW500c"})
).wait()
```

### Query a Dedicated SQL Pool from Python (via `pyodbc`)
```python
import pyodbc
import pandas as pd

conn_str = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=my-synapse-ws.sql.azuresynapse.net;DATABASE=mysqlpool;"
    "Authentication=ActiveDirectoryDefault;"
)
with pyodbc.connect(conn_str) as conn:
    df = pd.read_sql("SELECT TOP 100 * FROM dbo.FactSales", conn)
```

---

## 8. Distribution Strategy Cheat-Table

| Strategy | When to use |
|---|---|
| **Hash** | Large fact tables (millions+ rows); pick a high-cardinality join/group-by key |
| **Replicate** | Small dimension tables (<~2GB) frequently joined to fact tables |
| **Round Robin** | Staging tables, or when no good distribution key exists yet |

---

## 9. Performance Tuning

- Keep **clustered columnstore indexes** as the default for large analytical tables.
- Update **statistics** after major data loads — the optimizer relies on them heavily.
- Avoid **data skew**: pick hash keys with high, even cardinality (not booleans/low-cardinality columns).
- Use **CTAS** instead of `INSERT INTO ... SELECT` for large transforms — it's far more efficient in MPP.
- For serverless SQL, partition lake files (e.g., `year=2026/month=09/`) so `filepath()` filters can prune scanned data.
- Scale Dedicated SQL Pool up temporarily for big loads, then back down (or pause) afterward.

---

## 10. Synapse Link (Operational → Analytical, No ETL)

Enables near-real-time analytics directly over Cosmos DB or Azure SQL operational data without building a separate ETL pipeline — writes flow into an analytical column store automatically, queryable from Spark/serverless SQL.

---

## 11. Pricing

| Component | Billed by |
|---|---|
| Dedicated SQL Pool | DWU-hours (provisioned, pause to stop billing) |
| Serverless SQL Pool | $ per TB of data scanned |
| Spark Pool | vCore-hours while active (auto-pause when idle) |
| Pipelines | Same model as Azure Data Factory (per activity run + DIU-hours) |
| Storage | Standard ADLS Gen2 pricing |

---

## 12. Monitoring

- **Synapse Studio → Monitor hub**: SQL requests, Spark applications, pipeline runs, all in one place.
- **Dynamic Management Views (DMVs)**: `sys.dm_pdw_exec_requests`, `sys.dm_pdw_request_steps` for query diagnostics on Dedicated Pools.
- **Azure Monitor**: metrics + alerts on DWU utilization, failed pipeline runs, Spark job failures.

```sql
-- Check currently running/queued queries on a Dedicated SQL Pool
SELECT request_id, status, submit_time, total_elapsed_time
FROM sys.dm_pdw_exec_requests
WHERE status NOT IN ('Completed', 'Failed')
ORDER BY submit_time DESC;
```

---

## 13. Common Gotchas

- Leaving a Dedicated SQL Pool running 24/7 when it's only used for daytime queries is a top cost leak — pause it.
- Poor distribution key choice causes **data skew**, which silently degrades query performance across the whole MPP cluster.
- Serverless SQL Pool has **no persistent storage** of its own — every query re-scans lake files (cache with materialized results/CTAS to a Dedicated Pool if reused often).
- Spark Pool auto-pause has a startup delay (cold start) — first query after idle can be noticeably slower.
- Mixing round-robin distribution on large fact tables (instead of hash) causes excessive data movement during joins.
- CTAS replaces the table entirely — remember to re-apply grants/permissions afterward if they aren't inherited.

---

## 14. Useful Links

- Docs: https://learn.microsoft.com/en-us/azure/synapse-analytics/
- Pricing: https://azure.microsoft.com/en-us/pricing/details/synapse-analytics/
- Python SDK reference: https://learn.microsoft.com/en-us/python/api/overview/azure/synapse
