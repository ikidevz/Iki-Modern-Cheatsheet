# AWS Athena — Data Engineering Cheat Sheet

_Serverless, interactive SQL query service — a managed Trino/Presto engine that queries data in place on S3 (or federated sources), using the Glue Data Catalog for metadata._

---

## Overview

Athena is the query layer of an AWS data lake. It reads the same Glue Data Catalog that Glue ETL jobs, Redshift Spectrum, and EMR use, so any table registered once is queryable from Athena with zero cluster provisioning. You write standard SQL, Athena spins up transient compute behind the scenes, and you pay per byte scanned (or per reserved DPU if you use Capacity Reservations) — there's no cluster to size, patch, or leave running idle.

## When to Use Athena (and When Not To)

**Use Athena when:**

- You need ad-hoc or interactive SQL over data that already lives in S3, in place, without moving it
- Query volume is bursty or unpredictable and you don't want to manage warehouse infrastructure for it
- You need to query across many file formats (Parquet, ORC, Avro, JSON, CSV, Iceberg) with one engine
- You need to join S3 data with operational stores (DynamoDB, RDS, Redshift) without building an ETL pipeline first, via Federated Query
- You need PySpark-style analysis without managing a Spark cluster (Athena for Apache Spark notebooks)

**Consider alternatives when:**

- You have high-concurrency, latency-sensitive dashboards hitting the same data repeatedly → provisioned Redshift is more cost-predictable
- The same expensive query runs thousands of times a day → materialize the result into a warehouse or a CTAS table instead of re-scanning raw data each time
- Your task is heavy transformation logic, not querying → use Glue ETL (Spark) jobs instead
- You need fine-grained cluster tuning or guaranteed throughput at very large scale → EMR or Redshift instead

## Key Concepts

- **Query Engine:** Managed Trino/Presto fork; Athena engine version 3 is the current default and tracks upstream Trino continuously
- **Workgroups:** Isolate queries per team/project; enforce settings (output location, encryption, per-query byte limits) and separate cost/usage metrics
- **Data Catalog:** Athena reads the Glue Data Catalog (or an external Hive metastore) for database/table metadata — nothing new to maintain if Glue already crawls your data
- **Query Result Location:** S3 path where Athena writes result sets and keeps query history/metadata
- **Partitioning & Partition Projection:** Partition pruning skips irrelevant data at scan time; partition projection computes partitions from a naming convention instead of requiring `MSCK REPAIR TABLE` or a crawler
- **CTAS (CREATE TABLE AS SELECT):** Materializes a query result as a new table, typically converting raw CSV/JSON into partitioned, compressed Parquet
- **Federated Query:** Query non-S3 sources (DynamoDB, RDS, Redshift, CloudWatch, custom systems) through Lambda-based data source connectors, joined directly with S3 tables
- **Athena for Apache Spark:** Serverless, notebook-based interactive PySpark sessions — no cluster to launch
- **Prepared Statements:** Parameterized queries you can re-execute with different bind values instead of re-parsing SQL each time
- **Apache Iceberg Tables:** Native ACID support — row-level `UPDATE`/`DELETE`/`MERGE` and time travel on top of S3
- **Capacity Reservations:** Reserved compute (DPUs) with one-minute granularity for predictable, high-volume workloads, as an alternative to on-demand per-byte pricing
- **Query Result Reuse:** Athena can return a cached result for an identical query within a configurable max age, skipping the re-scan entirely

## Common Architecture Patterns

**Ad-hoc analytics over the data lake:**
`S3 (curated, Parquet)` → `Glue Data Catalog` → `Athena SQL` → BI tool (QuickSight) or analyst

**ETL-by-query with CTAS:**
`Athena CTAS` reads raw CSV/JSON in S3 → writes partitioned, compressed Parquet to a new S3 prefix → registers the new table in the Glue Catalog automatically

**Federated query across operational and analytical data:**
`Athena` → `Lambda data source connector` → `DynamoDB / RDS / Redshift`, joined in the same query with an S3-backed table — no upfront ETL required

---

## Worked Examples

### Example 1: Stand up a workgroup and run your first query

**Scenario:** A new team needs an isolated workgroup with cost guardrails before anyone queries the shared catalog.

```hcl
resource "aws_athena_workgroup" "analytics_team" {
  name = "analytics-team-wg"

  configuration {
    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true
    bytes_scanned_cutoff_per_query     = 5368709120 # 5 GB safety cap

    result_configuration {
      output_location = "s3://acme-athena-results/analytics-team/"
    }
  }
}
```

```python
result = run_query(
    "SELECT order_status, count(*) FROM curated_db.orders GROUP BY order_status",
    database="curated_db",
    workgroup="analytics-team-wg",
)
print(result)  # confirm rows come back and the query state is SUCCEEDED
```

### Example 2: CTAS to convert raw CSV into partitioned Parquet

**Scenario:** Analysts querying raw CSV directly are scanning far more bytes (and paying more) than necessary.

```hcl
resource "aws_athena_named_query" "ctas_orders_parquet" {
  name      = "ctas-orders-parquet"
  database  = "curated_db"
  workgroup = aws_athena_workgroup.analytics_team.id
  query     = <<-SQL
    CREATE TABLE curated_db.orders_parquet
    WITH (
      format = 'PARQUET',
      parquet_compression = 'SNAPPY',
      partitioned_by = ARRAY['order_date'],
      external_location = 's3://acme-data-lake-curated/orders_parquet/'
    ) AS
    SELECT order_id, customer_id, order_status, order_total,
           date(order_timestamp) AS order_date
    FROM curated_db.orders_raw_csv
  SQL
}
```

```python
state = run_named_query(aws_athena_named_query_id="ctas-orders-parquet")
assert state == "SUCCEEDED"
list_tables("curated_db")  # confirm "orders_parquet" now exists in the catalog
```

### Example 3: Federated query joining S3 with DynamoDB

**Scenario:** Clickstream events live in S3, but user profiles live in DynamoDB — the join needs to happen without an ETL pipeline.

```hcl
resource "aws_athena_data_catalog" "dynamo_users" {
  name = "dynamo-users-catalog"
  type = "LAMBDA"

  parameters = {
    function = aws_lambda_function.dynamo_connector.arn
  }
}
```

```python
query = """
SELECT c.event_type, u.plan_tier, count(*) AS events
FROM s3_events.clickstream c
JOIN "dynamo-users-catalog".default.users u
  ON c.user_id = u.user_id
GROUP BY c.event_type, u.plan_tier
"""
result = run_query(query, database="s3_events", workgroup="analytics-team-wg")
```

---

## Terraform

```hcl
resource "aws_athena_workgroup" "primary" {
  name  = "primary-wg"
  state = "ENABLED"

  configuration {
    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true
    bytes_scanned_cutoff_per_query     = 10737418240 # 10 GB

    result_configuration {
      output_location = "s3://my-company-athena-results/primary/"

      encryption_configuration {
        encryption_option = "SSE_KMS"
        kms_key_arn       = aws_kms_key.athena_results.arn
      }
    }

    engine_version {
      selected_engine_version = "Athena engine version 3"
    }
  }
}

# Athena databases are Glue databases under the hood — this creates both
resource "aws_athena_database" "curated" {
  name   = "curated_db"
  bucket = aws_s3_bucket.athena_metadata.id
}

# Store a reusable CTAS/analytical query as code instead of a console snippet
resource "aws_athena_named_query" "monthly_revenue" {
  name      = "monthly-revenue-summary"
  database  = aws_athena_database.curated.name
  workgroup = aws_athena_workgroup.primary.id
  query     = "SELECT date_trunc('month', order_timestamp) AS month, sum(order_total) FROM orders_parquet GROUP BY 1"
}

# A Lambda-based federated connector, registered as its own data catalog
resource "aws_athena_data_catalog" "rds_orders" {
  name = "rds-orders-catalog"
  type = "LAMBDA"

  parameters = {
    function = aws_lambda_function.jdbc_connector.arn
  }
}

# Reserved capacity for steady, high-volume workloads (alternative to on-demand pricing)
resource "aws_athena_capacity_reservation" "steady_state" {
  name            = "nightly-batch-reservation"
  target_dpus     = 24
}
```

### AWS CLI Quick Reference

```bash
# Run a query and capture its execution ID
aws athena start-query-execution \
  --query-string "SELECT count(*) FROM curated_db.orders_parquet" \
  --query-execution-context Database=curated_db \
  --work-group primary-wg

# Poll status
aws athena get-query-execution --query-execution-id abc-123 --query 'QueryExecution.Status.State'

# Fetch results once SUCCEEDED
aws athena get-query-results --query-execution-id abc-123

# List recent executions in a workgroup (useful for a cost/health audit)
aws athena list-query-executions --work-group primary-wg

# Cancel a runaway query
aws athena stop-query-execution --query-execution-id abc-123

# List workgroups and named queries
aws athena list-work-groups
aws athena list-named-queries --work-group primary-wg
```

### IaC Best Practices

- Set `enforce_workgroup_configuration = true` so per-workgroup settings (output location, encryption, byte cutoffs) can't be silently overridden by the client running the query.
- Always set `bytes_scanned_cutoff_per_query` on shared workgroups — it's the cheapest insurance against one bad `SELECT *` blowing up the bill.
- Point `result_configuration` at a dedicated, lifecycle-managed S3 prefix; result files accumulate indefinitely otherwise.
- Pin `engine_version` explicitly for workgroups running production pipelines so a Trino upgrade doesn't change query semantics under you unannounced.
- Prefer `aws_athena_named_query` over ad-hoc console SQL for anything re-run on a schedule — it's version-controlled and reviewable.
- Manage federated connectors (`aws_athena_data_catalog` + the backing Lambda) in the same module as the workgroups that use them, so IAM scoping stays traceable.

---

## Python (boto3)

```python
import boto3
import time
from botocore.exceptions import ClientError

athena = boto3.client("athena", region_name="us-east-1")

# Run a query and block until it finishes, returning rows as a list of dicts
def run_query(query: str, database: str, workgroup: str = "primary", poll_interval: int = 2) -> list[dict]:
    start = athena.start_query_execution(
        QueryString=query,
        QueryExecutionContext={"Database": database},
        WorkGroup=workgroup,
    )
    execution_id = start["QueryExecutionId"]

    while True:
        status = athena.get_query_execution(QueryExecutionId=execution_id)
        state = status["QueryExecution"]["Status"]["State"]
        if state in ("SUCCEEDED", "FAILED", "CANCELLED"):
            if state != "SUCCEEDED":
                reason = status["QueryExecution"]["Status"].get("StateChangeReason")
                raise RuntimeError(f"Query {execution_id} ended in {state}: {reason}")
            break
        time.sleep(poll_interval)

    return _fetch_all_rows(execution_id)

# Page through get_query_results and convert to list-of-dicts using the header row
def _fetch_all_rows(execution_id: str) -> list[dict]:
    rows, header = [], None
    paginator = athena.get_paginator("get_query_results")
    for page in paginator.paginate(QueryExecutionId=execution_id):
        data_rows = page["ResultSet"]["Rows"]
        if header is None:
            header = [c.get("VarCharValue", "") for c in data_rows[0]["Data"]]
            data_rows = data_rows[1:]
        for row in data_rows:
            values = [c.get("VarCharValue") for c in row["Data"]]
            rows.append(dict(zip(header, values)))
    return rows

# Run a previously-registered named query (e.g. a CTAS stored in Terraform)
def run_named_query(named_query_id: str, workgroup: str = "primary") -> str:
    nq = athena.get_named_query(NamedQueryId=named_query_id)
    start = athena.start_query_execution(
        QueryString=nq["NamedQuery"]["QueryString"],
        QueryExecutionContext={"Database": nq["NamedQuery"]["Database"]},
        WorkGroup=workgroup,
    )
    execution_id = start["QueryExecutionId"]
    while True:
        status = athena.get_query_execution(QueryExecutionId=execution_id)
        state = status["QueryExecution"]["Status"]["State"]
        if state in ("SUCCEEDED", "FAILED", "CANCELLED"):
            return state
        time.sleep(3)

# List tables in a database (Athena databases are Glue databases)
def list_tables(database_name: str):
    glue = boto3.client("glue")
    paginator = glue.get_paginator("get_tables")
    for page in paginator.paginate(DatabaseName=database_name):
        for table in page["TableList"]:
            print(table["Name"], table["StorageDescriptor"]["Location"])

# Check how many bytes a query scanned (for a cost/DPU audit dashboard)
def get_query_cost_stats(execution_id: str):
    status = athena.get_query_execution(QueryExecutionId=execution_id)
    stats = status["QueryExecution"]["Statistics"]
    print("Bytes scanned:", stats.get("DataScannedInBytes"))
    print("Engine execution time (ms):", stats.get("EngineExecutionTimeInMillis"))

if __name__ == "__main__":
    try:
        rows = run_query(
            "SELECT order_status, count(*) AS n FROM curated_db.orders_parquet GROUP BY order_status",
            database="curated_db",
            workgroup="primary-wg",
        )
        for row in rows:
            print(row)
    except ClientError as e:
        print(f"Athena error: {e.response['Error']['Message']}")
```

### boto3 Tips

- `start_query_execution` is async — always poll `get_query_execution` (or wrap it in your own waiter) before trying to read results.
- `get_query_results` returns the header as the first row of the first page — strip it once, not on every page, when building a paginator loop.
- Use `get_paginator("get_query_results")` for anything beyond a trivial row count; Athena paginates result sets by default.
- Read `QueryExecution.Statistics.DataScannedInBytes` after every run if you're tracking cost — it's the single number that maps directly to your bill on on-demand pricing.
- For CI/CD, `create_named_query` / `list_named_queries` let a pipeline register and audit saved queries the same way `create_job` does for Glue.
- Use `Workgroup` on every `start_query_execution` call explicitly — relying on the caller's default workgroup is a common source of queries landing in the wrong result bucket.

---

## Security Best Practices

- Set `enforce_workgroup_configuration = true` so users can't redirect query results to an unmanaged S3 bucket or disable encryption from the client side.
- Encrypt query results with SSE-KMS in the workgroup's `result_configuration`, in addition to encrypting the underlying source data in S3.
- Use **Lake Formation** permissions (see the Supporting Services page) instead of raw IAM/S3 policies once more than a couple of teams query the same catalog — it centralizes column- and row-level security across Athena, Redshift Spectrum, and EMR.
- Scope federated-query Lambda connector IAM roles to only the specific database/table the connector needs — a connector with broad RDS or DynamoDB access defeats the purpose of a scoped catalog.
- Enable CloudTrail logging for `athena:StartQueryExecution` and related API calls so query access to sensitive tables is auditable after the fact.

## Cost Optimization

- Convert raw CSV/JSON into compressed, columnar Parquet or ORC via CTAS — this is usually the single biggest lever, often cutting bytes scanned (and cost) by 90%+.
- Partition your tables on commonly filtered columns, and use **partition projection** so Athena doesn't need `MSCK REPAIR TABLE` or a crawler pass to see new partitions.
- Set `bytes_scanned_cutoff_per_query` on every shared workgroup to cap the damage from an unbounded `SELECT *`.
- Enable **query result reuse** for dashboards or reports that re-run the same query repeatedly against slowly-changing data.
- For steady, predictable high-volume workloads, compare on-demand per-byte pricing against a **Capacity Reservation** — reserved DPUs can be materially cheaper at consistent, heavy usage levels.
- Set S3 lifecycle rules on the query results bucket; result files accumulate silently and are easy to forget about.

## Monitoring & Common Errors

| Symptom                                                  | Likely Cause                                                                 | Fix                                                                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `HIVE_METASTORE_ERROR`: table not found                  | Table isn't registered in the Glue Data Catalog for the database you queried | Confirm the database/table name, run the Glue crawler, or `CREATE TABLE`/`CREATE EXTERNAL TABLE` manually                 |
| Query scans far more bytes than expected                 | Table isn't partitioned, or query doesn't filter on the partition column     | Add partitioning, enable partition projection, and filter on the partition key in `WHERE`                                 |
| `TOO_MANY_OPEN_PARTITIONS` on CTAS/INSERT INTO           | Query is fanning out into too many small partitions in one write             | Reduce partition cardinality, add bucketing, or write in batches                                                          |
| Query fails immediately: "exceeded bytes scanned cutoff" | Workgroup's `bytes_scanned_cutoff_per_query` is lower than the query needs   | Optimize the query/partitioning first; only raise the cutoff if the scan is genuinely necessary                           |
| Federated query is slow or times out                     | Lambda connector cold starts, low concurrency, or no filter push-down        | Increase connector Lambda memory/concurrency, push filters into the `WHERE` clause so the connector can prune source-side |
| Same query returns stale-looking results                 | Query result reuse served a cached result older than expected                | Lower the max result age, or disable result reuse for that query                                                          |

Monitor via CloudWatch metrics under the `AWS/Athena` namespace (`ProcessedBytes`, `TotalExecutionTime`, `EngineExecutionTime`) per workgroup, and review `QueryExecution.Statistics.DataScannedInBytes` per run for a query-level cost audit trail.
