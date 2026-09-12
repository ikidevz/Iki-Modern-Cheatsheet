# Google BigQuery Cheatsheet

> Serverless, highly scalable data warehouse for analytics at petabyte scale.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Type | Serverless, fully-managed enterprise data warehouse (SQL) |
| Storage engine | Colossus (columnar, distributed) |
| Query engine | Dremel (tree architecture, massively parallel) |
| Networking | Google's Jupiter network (separates storage & compute) |
| Best for | OLAP analytics, BI reporting, ad-hoc SQL, ML on structured data |
| Not for | OLTP / low-latency single-row transactions |

**Key idea:** Storage and compute are decoupled and billed separately, so you can store huge datasets cheaply and only pay for the compute (query) power you actually use.

---

## 2. Core Concepts

| Concept | Description |
|---|---|
| **Project** | Top-level container for billing & resources |
| **Dataset** | Namespace/container for tables, views, and routines. Region/location is set here |
| **Table** | Native, external, or view. Has schema + optional partitioning/clustering |
| **Job** | Async unit of work: query, load, extract, copy |
| **Slot** | Unit of computational capacity (virtual CPU) used to execute queries |
| **Reservation** | A pool of slots you purchase/assign for capacity-based pricing |
| **Routine** | Stored procedure or UDF (SQL or JS) |

---

## 3. Pricing Models

| Model | How it's billed | Best for |
|---|---|---|
| **On-demand** | $ per TB of data scanned by query | Unpredictable/spiky workloads |
| **Capacity-based (Editions: Standard/Enterprise/Enterprise Plus)** | $ per slot-hour, reserved or autoscaled | Predictable, heavy workloads |
| **Storage** | Active ($/GB/mo) vs Long-term (>90 days untouched, ~50% cheaper) | All tables |
| **Streaming inserts** | $ per 200MB inserted (some free tier via Storage Write API) | Real-time ingestion |

💡 **Cost tip:** Use `--dry_run` (or the query validator in the UI) to see bytes scanned *before* running a query.

---

## 4. `bq` CLI Reference

```bash
# Auth / config
gcloud auth login
gcloud config set project my-project

# Datasets
bq mk --dataset --location=US my_dataset
bq ls my_dataset
bq rm -r -d my_dataset          # -r recursive, -d dataset
bq update --description "Curated sales data" my_dataset

# Tables
bq mk --table my_dataset.my_table schema.json
bq mk --table --time_partitioning_field=event_ts \
  --time_partitioning_type=DAY --clustering_fields=country,user_id \
  my_dataset.events schema.json
bq show my_dataset.my_table
bq show --schema --format=prettyjson my_dataset.my_table
bq rm -t my_dataset.my_table

# Load data
bq load --source_format=CSV --skip_leading_rows=1 --autodetect \
    my_dataset.my_table gs://my-bucket/data.csv

bq load --source_format=CSV --skip_leading_rows=1 \
    my_dataset.my_table gs://my-bucket/data.csv ./schema.json

bq load --source_format=PARQUET my_dataset.my_table gs://my-bucket/data/*.parquet

bq load --source_format=NEWLINE_DELIMITED_JSON \
  --replace my_dataset.my_table gs://my-bucket/data/*.json

# Query
bq query --use_legacy_sql=false \
  'SELECT * FROM `my_project.my_dataset.my_table` LIMIT 10'

bq query --use_legacy_sql=false --destination_table=my_dataset.result_table \
  --replace 'SELECT country, COUNT(*) c FROM `my_dataset.events` GROUP BY 1'

bq query --dry_run --use_legacy_sql=false \
  'SELECT * FROM `my_dataset.events`'   # estimate bytes scanned, no execution

# Extract (export)
bq extract --destination_format=NEWLINE_DELIMITED_JSON \
  my_dataset.my_table gs://my-bucket/export/*.json

bq extract --destination_format=CSV --compression=GZIP \
  my_dataset.my_table gs://my-bucket/export/data-*.csv.gz

# Copy table
bq cp my_dataset.src_table my_dataset.dest_table
bq cp -a my_dataset.src_table my_dataset.dest_table   # append

# Jobs
bq ls -j -a           # list jobs
bq show -j <job_id>   # job details
bq cancel <job_id>
```

---

## 5. SQL Cheatsheet (Standard SQL)

### DDL / DML
```sql
-- Create table with partitioning + clustering
CREATE TABLE my_dataset.events (
  event_id STRING,
  user_id  STRING,
  event_ts TIMESTAMP,
  country  STRING
)
PARTITION BY DATE(event_ts)
CLUSTER BY country, user_id
OPTIONS (
  partition_expiration_days = 90,
  description = "Raw event stream"
);

-- Create table AS SELECT (CTAS)
CREATE OR REPLACE TABLE my_dataset.daily_summary
PARTITION BY summary_date AS
SELECT DATE(event_ts) AS summary_date, country, COUNT(*) AS n
FROM my_dataset.events
GROUP BY 1, 2;

-- Create a view
CREATE OR REPLACE VIEW my_dataset.v_daily_active AS
SELECT DATE(event_ts) AS day, COUNT(DISTINCT user_id) AS dau
FROM my_dataset.events
GROUP BY 1;

-- Create a materialized view (auto-refreshing, incremental)
CREATE MATERIALIZED VIEW my_dataset.mv_daily_active AS
SELECT DATE(event_ts) AS day, COUNT(DISTINCT user_id) AS dau
FROM my_dataset.events
GROUP BY 1;

-- Alter table: add / drop column
ALTER TABLE my_dataset.events ADD COLUMN IF NOT EXISTS session_id STRING;
ALTER TABLE my_dataset.events DROP COLUMN IF EXISTS legacy_field;
ALTER TABLE my_dataset.events SET OPTIONS (expiration_timestamp = NULL);

-- Merge (upsert)
MERGE my_dataset.target T
USING my_dataset.staging S
ON T.id = S.id
WHEN MATCHED THEN UPDATE SET T.value = S.value, T.updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (id, value, updated_at) VALUES (S.id, S.value, CURRENT_TIMESTAMP())
WHEN NOT MATCHED BY SOURCE THEN DELETE;

-- DML
INSERT INTO my_dataset.events (event_id, user_id, event_ts, country)
VALUES ('e1', 'u1', CURRENT_TIMESTAMP(), 'PH');

INSERT INTO my_dataset.events (event_id, user_id, event_ts, country)
SELECT event_id, user_id, event_ts, country FROM my_dataset.staging_events;

UPDATE my_dataset.events SET country = 'PHL' WHERE country = 'PH';
DELETE FROM my_dataset.events WHERE event_ts < '2024-01-01';

-- Create a scalar UDF (SQL)
CREATE OR REPLACE FUNCTION my_dataset.normalize_country(c STRING)
RETURNS STRING AS (
  CASE WHEN c = 'PH' THEN 'Philippines' ELSE c END
);

-- Create a JS UDF
CREATE OR REPLACE FUNCTION my_dataset.extract_domain(url STRING)
RETURNS STRING
LANGUAGE js AS """
  try { return new URL(url).hostname; } catch (e) { return null; }
""";

-- Create a table-valued function (TVF)
CREATE OR REPLACE TABLE FUNCTION my_dataset.events_for_country(c STRING)
AS SELECT * FROM my_dataset.events WHERE country = c;

-- Create a stored procedure
CREATE OR REPLACE PROCEDURE my_dataset.refresh_summary()
BEGIN
  CREATE OR REPLACE TABLE my_dataset.daily_summary AS
  SELECT DATE(event_ts) AS day, COUNT(*) AS n FROM my_dataset.events GROUP BY 1;
END;

CALL my_dataset.refresh_summary();
```

### Useful query patterns
```sql
-- Window functions
SELECT
  user_id, event_ts,
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_ts DESC) AS rn,
  LAG(event_ts) OVER (PARTITION BY user_id ORDER BY event_ts) AS prev_ts,
  SUM(1) OVER (PARTITION BY user_id ORDER BY event_ts
               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_count
FROM my_dataset.events;

-- Deduplicate rows keeping the latest per key
SELECT * EXCEPT(rn) FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_ts DESC) AS rn
  FROM my_dataset.events
) WHERE rn = 1;

-- Arrays & structs
SELECT user_id, ARRAY_AGG(event_id ORDER BY event_ts) AS event_ids
FROM my_dataset.events GROUP BY user_id;

SELECT user_id, ARRAY_AGG(STRUCT(event_id, event_ts) ORDER BY event_ts) AS events
FROM my_dataset.events GROUP BY user_id;

-- UNNEST a repeated field
SELECT user_id, e
FROM my_dataset.user_events, UNNEST(events) AS e;

-- PIVOT / UNPIVOT
SELECT * FROM (
  SELECT country, event_type FROM my_dataset.events
)
PIVOT (COUNT(*) FOR event_type IN ('click', 'view', 'purchase'));

-- APPROX functions for big data (cheaper than exact)
SELECT APPROX_COUNT_DISTINCT(user_id) AS approx_users,
       APPROX_QUANTILES(amount, 100)[OFFSET(50)] AS median_amount
FROM my_dataset.events;

-- Common Table Expressions (CTEs)
WITH daily AS (
  SELECT DATE(event_ts) AS day, COUNT(*) AS n
  FROM my_dataset.events GROUP BY 1
),
rolling AS (
  SELECT day, AVG(n) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS avg_7d
  FROM daily
)
SELECT * FROM rolling ORDER BY day;

-- Parameterized query (used from client libraries, see Section 6)
SELECT * FROM my_dataset.events
WHERE country = @country AND event_ts >= @start_date;

-- Scripting (variables, loops, conditionals)
DECLARE min_date DATE DEFAULT '2024-01-01';
DECLARE total INT64;

SET total = (SELECT COUNT(*) FROM my_dataset.events);

IF total > 1000000 THEN
  SELECT 'large dataset';
ELSE
  SELECT 'small dataset';
END IF;

FOR record IN (SELECT day FROM UNNEST(GENERATE_DATE_ARRAY(min_date, CURRENT_DATE())) AS day)
DO
  SELECT record.day;
END FOR;
```

---

## 6. Python Client Library (`google-cloud-bigquery`)

```bash
pip install google-cloud-bigquery google-cloud-bigquery-storage pandas db-dtypes
```

### Client setup & basic query
```python
from google.cloud import bigquery

client = bigquery.Client(project="my-project")

query = """
    SELECT country, COUNT(*) AS n
    FROM `my-project.my_dataset.events`
    GROUP BY country
    ORDER BY n DESC
"""
results = client.query(query).result()   # blocks until job completes

for row in results:
    print(row.country, row.n)
```

### Query straight into a pandas DataFrame
```python
df = client.query(query).to_dataframe()          # requires pandas + db-dtypes
print(df.head())

# Faster large-result downloads via BigQuery Storage API
df = client.query(query).to_dataframe(create_bqstorage_client=True)
```

### Parameterized queries (avoid SQL injection, enable caching)
```python
job_config = bigquery.QueryJobConfig(
    query_parameters=[
        bigquery.ScalarQueryParameter("country", "STRING", "PH"),
        bigquery.ScalarQueryParameter("start_date", "DATE", "2024-01-01"),
        bigquery.ArrayQueryParameter("statuses", "STRING", ["active", "trial"]),
    ]
)
query = """
    SELECT * FROM `my_dataset.events`
    WHERE country = @country AND event_ts >= @start_date
"""
df = client.query(query, job_config=job_config).to_dataframe()
```

### Create dataset & table programmatically
```python
dataset_ref = bigquery.Dataset("my-project.my_dataset")
dataset_ref.location = "US"
dataset = client.create_dataset(dataset_ref, exists_ok=True)

schema = [
    bigquery.SchemaField("event_id", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("user_id", "STRING"),
    bigquery.SchemaField("event_ts", "TIMESTAMP"),
    bigquery.SchemaField("country", "STRING"),
]
table = bigquery.Table("my-project.my_dataset.events", schema=schema)
table.time_partitioning = bigquery.TimePartitioning(
    type_=bigquery.TimePartitioningType.DAY, field="event_ts"
)
table.clustering_fields = ["country", "user_id"]
table = client.create_table(table, exists_ok=True)
```

### Load data — from GCS, from a DataFrame, and from local file
```python
# From GCS (Parquet)
job_config = bigquery.LoadJobConfig(
    source_format=bigquery.SourceFormat.PARQUET,
    write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
)
load_job = client.load_table_from_uri(
    "gs://my-bucket/data/*.parquet",
    "my-project.my_dataset.events",
    job_config=job_config,
)
load_job.result()   # wait for completion
print(f"Loaded {load_job.output_rows} rows")

# From a pandas DataFrame directly
import pandas as pd
df = pd.DataFrame({"event_id": ["e1", "e2"], "country": ["PH", "US"]})
job_config = bigquery.LoadJobConfig(write_disposition="WRITE_APPEND")
client.load_table_from_dataframe(df, "my_dataset.events", job_config=job_config).result()

# From a local CSV/JSON file
with open("local_data.csv", "rb") as f:
    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.CSV, skip_leading_rows=1, autodetect=True
    )
    client.load_table_from_file(f, "my_dataset.events", job_config=job_config).result()
```

### Streaming inserts (small, low-latency writes)
```python
rows_to_insert = [
    {"event_id": "e1", "user_id": "u1", "country": "PH"},
    {"event_id": "e2", "user_id": "u2", "country": "US"},
]
errors = client.insert_rows_json("my-project.my_dataset.events", rows_to_insert)
if errors:
    print(f"Encountered errors: {errors}")
```

### Storage Write API (high-throughput streaming — recommended over legacy streaming)
```python
from google.cloud.bigquery_storage_v1 import BigQueryWriteClient
from google.cloud.bigquery_storage_v1.types import AppendRowsRequest, ProtoSchema
# For most pipelines, prefer using this via Dataflow's BigQueryIO connector
# rather than calling the Storage Write API directly (see Dataflow cheatsheet).
```

### Copy, extract, delete
```python
# Copy a table
job = client.copy_table("my_dataset.src_table", "my_dataset.dest_table")
job.result()

# Extract table to GCS
extract_job = client.extract_table(
    "my_dataset.events", "gs://my-bucket/export/events-*.parquet",
    job_config=bigquery.ExtractJobConfig(destination_format="PARQUET"),
)
extract_job.result()

# Delete a table / dataset
client.delete_table("my_dataset.old_table", not_found_ok=True)
client.delete_dataset("my_dataset", delete_contents=True, not_found_ok=True)
```

### Inspect metadata & list resources
```python
table = client.get_table("my_dataset.events")
print(table.schema, table.num_rows, table.num_bytes)

for dataset in client.list_datasets():
    print(dataset.dataset_id)

for tbl in client.list_tables("my_dataset"):
    print(tbl.table_id)
```

### Running a job asynchronously with custom config & labels (cost tracking)
```python
job_config = bigquery.QueryJobConfig(
    labels={"team": "analytics", "pipeline": "daily_etl"},
    maximum_bytes_billed=10 * 1024**3,  # 10 GB safety cap
    priority=bigquery.QueryPriority.BATCH,   # cheaper, queued execution
)
query_job = client.query(query, job_config=job_config)
print(f"Job ID: {query_job.job_id}, bytes billed: {query_job.total_bytes_billed}")
```

### Reusable helper pattern for ETL scripts
```python
def run_query_to_table(sql: str, destination: str, client: bigquery.Client):
    job_config = bigquery.QueryJobConfig(
        destination=destination,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )
    job = client.query(sql, job_config=job_config)
    job.result()
    return job.destination

run_query_to_table(
    "SELECT country, COUNT(*) n FROM my_dataset.events GROUP BY 1",
    "my-project.my_dataset.country_counts",
    client,
)
```

---

## 7. Partitioning & Clustering

| Feature | Purpose | Notes |
|---|---|---|
| **Time-unit partitioning** | Split table by `DATE`/`TIMESTAMP`/`DATETIME` column (day/hour/month/year) | Prunes scanned data; max 10,000 partitions |
| **Integer-range partitioning** | Partition by integer buckets | Good for IDs |
| **Ingestion-time partitioning** | Auto-partitions by `_PARTITIONTIME` | Use when no natural date column |
| **Clustering** | Sort data within partitions by up to 4 columns | Improves filter/aggregate performance, auto re-clusters |

Rule of thumb: **Partition** on the column you filter by most (usually date); **cluster** on high-cardinality columns you filter/join/group by next.

---

## 8. Performance & Cost Optimization

- Select only needed columns (`SELECT *` scans the whole table — BigQuery is columnar).
- Filter on partition column early to enable **partition pruning**.
- Use `_PARTITIONDATE`/partition filters; require them with `require_partition_filter=true`.
- Prefer **materialized views** for repeated aggregations.
- Avoid `ORDER BY` on huge result sets without `LIMIT`.
- Use **BI Engine** to accelerate dashboards (in-memory analysis layer).
- Cache: identical queries within 24h reuse cached results for free (if table unchanged).
- Use `EXPORT DATA` instead of extracting via UI for large exports.

---

## 9. Data Loading Patterns

| Method | Use case |
|---|---|
| Batch load (`bq load`, GCS → BQ) | Free, best for bulk historical data |
| **Storage Write API** | High-throughput streaming ingestion, exactly-once semantics |
| Legacy streaming inserts (`tabledata.insertAll`) | Simple streaming, small $ cost |
| **External tables** | Query data in-place on GCS/Drive/Bigtable without loading |
| **Federated queries** | Query Cloud SQL/Spanner directly via `EXTERNAL_QUERY` |
| BigQuery Data Transfer Service | Scheduled ingestion from SaaS sources (Ads, YouTube, etc.) |
| Cloud Storage → BQ via Dataflow/Dataproc | Complex transforms during load |

### External table example
```sql
CREATE OR REPLACE EXTERNAL TABLE my_dataset.ext_events
OPTIONS (
  format = 'PARQUET',
  uris = ['gs://my-bucket/events/*.parquet']
);
```

---

## 10. Security & Governance

- **IAM roles**: `roles/bigquery.dataViewer`, `dataEditor`, `dataOwner`, `jobUser`, `admin` — assign at project, dataset, or table level.
- **Authorized views**: share query results without granting access to underlying tables.
- **Row-level security**: `CREATE ROW ACCESS POLICY`.
- **Column-level security**: policy tags via Data Catalog / Dataplex taxonomies.
- **Data masking**: dynamic masking on tagged columns.
- **CMEK**: customer-managed encryption keys for tables.
- **Audit logs**: Cloud Audit Logs record every job/query.

```sql
-- Row-level security example: users only see their own country's rows
CREATE ROW ACCESS POLICY country_filter
ON my_dataset.events
GRANT TO ("group:analysts@company.com")
FILTER USING (country = SESSION_USER_COUNTRY());
```

---

## 11. BigQuery ML (quick reference)

```sql
CREATE OR REPLACE MODEL my_dataset.churn_model
OPTIONS(model_type='logistic_reg', input_label_cols=['churned']) AS
SELECT * EXCEPT(user_id) FROM my_dataset.training_data;

SELECT * FROM ML.PREDICT(MODEL my_dataset.churn_model,
  (SELECT * FROM my_dataset.new_users));

SELECT * FROM ML.EVALUATE(MODEL my_dataset.churn_model);

-- Forecasting model
CREATE OR REPLACE MODEL my_dataset.sales_forecast
OPTIONS(model_type='ARIMA_PLUS', time_series_timestamp_col='day',
        time_series_data_col='revenue') AS
SELECT day, revenue FROM my_dataset.daily_summary;

SELECT * FROM ML.FORECAST(MODEL my_dataset.sales_forecast, STRUCT(30 AS horizon));
```

### Calling BQML from Python
```python
client.query("""
    CREATE OR REPLACE MODEL my_dataset.churn_model
    OPTIONS(model_type='logistic_reg', input_label_cols=['churned']) AS
    SELECT * EXCEPT(user_id) FROM my_dataset.training_data
""").result()

predictions = client.query("""
    SELECT * FROM ML.PREDICT(MODEL my_dataset.churn_model,
      (SELECT * FROM my_dataset.new_users))
""").to_dataframe()
```

---

## 12. Monitoring & Metadata

```sql
-- Job history & cost
SELECT job_id, total_bytes_processed, total_slot_ms, creation_time
FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
ORDER BY creation_time DESC LIMIT 50;

-- Most expensive queries this week
SELECT user_email, query, total_bytes_billed
FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
ORDER BY total_bytes_billed DESC LIMIT 20;

-- Table storage stats
SELECT table_name, total_rows, total_logical_bytes
FROM my_dataset.INFORMATION_SCHEMA.TABLE_STORAGE;
```
- Use **Cloud Monitoring** dashboards for slot utilization (capacity pricing).
- Use **INFORMATION_SCHEMA.JOBS*** views to audit expensive queries.

---

## 13. Common Gotchas

- `SELECT *` on partitioned tables without a filter scans **everything** → cost blowup.
- Cross-region joins/queries fail — dataset location must match.
- Streaming buffer data can't be updated/deleted for ~30–90 min after insert.
- Views don't cache results; repeated queries against a view re-scan the base table.
- Legacy SQL vs Standard SQL syntax differences — always default to Standard SQL.
- Slot contention on shared on-demand pool can cause queueing during peak hours.
- `to_dataframe()` on huge result sets can exhaust client memory — page results or use a `LIMIT`/aggregation instead.

---

## 14. Useful Links

- Docs: https://cloud.google.com/bigquery/docs
- Pricing: https://cloud.google.com/bigquery/pricing
- BigQuery ML: https://cloud.google.com/bigquery-ml/docs
- Python client reference: https://cloud.google.com/python/docs/reference/bigquery/latest
