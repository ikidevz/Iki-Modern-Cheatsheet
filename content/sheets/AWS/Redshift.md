# Amazon Redshift — Data Engineering Cheat Sheet

*Petabyte-scale MPP (massively parallel processing) data warehouse for analytics/BI workloads.*

---

## Overview

Redshift is where curated data lands for SQL-based analytics and BI tools. It can also query S3 directly (Spectrum) without loading data in, and the newer Data API lets you run queries without managing a persistent DB connection.

## When to Use Redshift (and When Not To)

**Use Redshift when:**
- You need fast, complex SQL analytics (joins, window functions, aggregations) over structured/semi-structured data at scale
- Multiple BI tools (QuickSight, Tableau, Looker) need concurrent access to the same curated dataset
- You need to combine warehouse tables with S3 data lake tables in a single query (Spectrum)

**Consider alternatives when:**
- Your workload is mostly key-value lookups → use DynamoDB instead
- You need ad-hoc, infrequent SQL over S3 with no warehouse to manage → use Athena instead
- Your data volume is small (<100 GB) and query patterns are simple → RDS/Aurora may be cheaper and simpler

## Key Concepts

- **Provisioned clusters vs. Redshift Serverless:** Serverless auto-scales and bills per RPU-second — good for spiky workloads
- **Distribution styles:** `KEY`, `ALL`, `EVEN`, `AUTO` — controls how rows spread across nodes
- **Sort keys:** Compound or interleaved — controls physical row order for query pruning
- **WLM (Workload Management):** Queues to isolate ETL vs BI query resources
- **Redshift Spectrum:** Query S3 data directly via the Glue Catalog without loading it in
- **COPY command:** Bulk-load from S3/DynamoDB/Kinesis far faster than row-by-row INSERT
- **Data API:** Run SQL over HTTPS without a persistent JDBC/ODBC connection — ideal for Lambda/Step Functions
- **Concurrency Scaling:** Automatically adds transient capacity during bursts of concurrent queries
- **Materialized views:** Precompute expensive joins/aggregations; can auto-refresh
- **Zero-ETL integrations:** Near real-time replication from Aurora/RDS into Redshift without a manual pipeline

## Common Architecture Patterns

**Curated warehouse loaded from the data lake:**
`S3 (curated/, Parquet)` → `COPY command` → `Redshift tables` → `BI tools via JDBC/ODBC`

**Lake + warehouse hybrid via Spectrum:**
`Redshift local tables (hot, frequently queried)` JOIN `Spectrum external tables (cold, S3-only)` — query both in one SQL statement without duplicating cold data into the warehouse.

**Event-driven load pattern:**
`S3 ObjectCreated` → `Lambda` → `Redshift Data API executes COPY` → `Materialized view refresh` → dashboards see new data within minutes.

---

## Worked Examples

### Example 1: Nightly bulk load from S3
**Scenario:** Curated Parquet files land daily and need to be loaded into a fact table.
```hcl
resource "aws_iam_role" "redshift_copy" {
  name = "redshift-copy-role"
  assume_role_policy = data.aws_iam_policy_document.redshift_assume.json
}
```
```python
copy_from_s3(
    table="fact_orders",
    s3_path="s3://acme-data-lake-curated/orders/",
    iam_role_arn="arn:aws:iam::123456789012:role/redshift-copy-role",
)
refresh_materialized_view("mv_daily_order_totals")
```

### Example 2: Redshift Serverless for a spiky BI workload
**Scenario:** A dashboard team queries heavily during business hours only; you don't want to pay for an idle provisioned cluster overnight.
```hcl
resource "aws_redshiftserverless_workgroup" "bi_team" {
  namespace_name = aws_redshiftserverless_namespace.main.namespace_name
  workgroup_name  = "bi-team-wg"
  base_capacity   = 8 # RPUs, scales up automatically under load
  subnet_ids      = var.private_subnet_ids
}
```
```python
run_query("SELECT region, SUM(revenue) FROM fact_orders GROUP BY region;",
          cluster_id=None)  # Serverless uses workgroup name instead of cluster ID via redshift-data API
```

### Example 3: Querying S3 and Redshift together via Spectrum
**Scenario:** Combine three-year-old archived S3 data with the last 90 days of "hot" data already loaded into Redshift.
```sql
CREATE EXTERNAL SCHEMA spectrum_orders
FROM DATA CATALOG DATABASE 'curated_db' IAM_ROLE 'arn:aws:iam::123456789012:role/redshift-copy-role';
```
```python
sql = """
    SELECT r.order_id, r.revenue FROM fact_orders r
    UNION ALL
    SELECT s.order_id, s.revenue FROM spectrum_orders.orders_archive s
    WHERE s.order_date < '2023-01-01';
"""
result = run_query(sql)
print(results_to_dicts(result))
```

---

## Terraform

```hcl
resource "aws_redshift_subnet_group" "main" {
  name       = "redshift-subnet-group"
  subnet_ids = var.private_subnet_ids
}

resource "aws_redshift_parameter_group" "main" {
  name   = "analytics-warehouse-params"
  family = "redshift-1.0"

  parameter {
    name  = "enable_user_activity_logging"
    value = "true"
  }
  parameter {
    name  = "require_ssl"
    value = "true"
  }
}

resource "aws_redshift_cluster" "warehouse" {
  cluster_identifier = "analytics-warehouse"
  database_name      = "analytics"
  master_username     = "admin"
  master_password     = var.redshift_master_password # store in Secrets Manager
  node_type           = "ra3.xlplus"
  cluster_type        = "multi-node"
  number_of_nodes     = 3

  cluster_subnet_group_name    = aws_redshift_subnet_group.main.name
  cluster_parameter_group_name = aws_redshift_parameter_group.main.name
  vpc_security_group_ids       = [aws_security_group.redshift.id]

  encrypted  = true
  kms_key_id = aws_kms_key.redshift.arn

  automated_snapshot_retention_period = 7
  preferred_maintenance_window        = "sun:03:00-sun:04:00"
  skip_final_snapshot                 = false
  final_snapshot_identifier           = "analytics-warehouse-final"

  enhanced_vpc_routing = true

  iam_roles = [aws_iam_role.redshift_copy.arn]
}

# Modern alternative: Redshift Serverless
resource "aws_redshiftserverless_namespace" "main" {
  namespace_name    = "analytics-ns"
  db_name            = "analytics"
  admin_username     = "admin"
  admin_user_password = var.redshift_master_password
  kms_key_id         = aws_kms_key.redshift.arn
  iam_roles          = [aws_iam_role.redshift_copy.arn]
}

resource "aws_redshiftserverless_workgroup" "main" {
  namespace_name      = aws_redshiftserverless_namespace.main.namespace_name
  workgroup_name       = "analytics-wg"
  base_capacity        = 32 # RPUs
  subnet_ids           = var.private_subnet_ids
  security_group_ids   = [aws_security_group.redshift.id]
  enhanced_vpc_routing = true
}

# Concurrency scaling / usage limits to control cost
resource "aws_redshift_usage_limit" "concurrency_cap" {
  cluster_identifier = aws_redshift_cluster.warehouse.id
  feature_type        = "concurrency-scaling"
  limit_type           = "time"
  amount               = 60 # minutes per day before it stops scaling
  breach_action        = "log"
}

output "redshift_endpoint" {
  value = aws_redshift_cluster.warehouse.endpoint
}
```

### AWS CLI Quick Reference
```bash
# Check cluster status
aws redshift describe-clusters --cluster-identifier analytics-warehouse --query 'Clusters[0].ClusterStatus'

# Run SQL via the Data API (no JDBC connection needed)
aws redshift-data execute-statement \
  --cluster-identifier analytics-warehouse --database analytics --db-user admin \
  --sql "SELECT COUNT(*) FROM events;"

# Check the status of a Data API statement
aws redshift-data describe-statement --id <statement-id>

# Resize a cluster (elastic resize is fastest for node-count changes)
aws redshift resize-cluster --cluster-identifier analytics-warehouse --number-of-nodes 5

# Create a manual snapshot before a risky schema change
aws redshift create-cluster-snapshot --cluster-identifier analytics-warehouse --snapshot-identifier pre-migration-snapshot
```

### IaC Best Practices
- Never hardcode `master_password` — pull it from `aws_secretsmanager_secret_version` at plan time.
- Default to **RA3 node types** for new provisioned clusters (managed storage, decoupled compute/storage).
- Consider **Redshift Serverless** for new projects unless you need fine-grained WLM control — it removes a whole class of sizing decisions.
- Lock security groups down to specific CIDR ranges/security groups, never `0.0.0.0/0`.
- Set `skip_final_snapshot = false` in production so `terraform destroy` can't silently drop your warehouse without a snapshot.
- Set `enhanced_vpc_routing = true` so COPY/UNLOAD traffic routes through your VPC (and can be inspected/logged) instead of the public internet.
- Attach `iam_roles` directly to the cluster for `COPY`/`UNLOAD` so jobs don't need to pass long-lived credentials.

---

## Python (boto3)

```python
import boto3
import time
from botocore.exceptions import ClientError

redshift = boto3.client("redshift", region_name="us-east-1")
redshift_data = boto3.client("redshift-data", region_name="us-east-1")

CLUSTER_ID = "analytics-warehouse"
DATABASE = "analytics"
DB_USER = "admin"

# Describe cluster status (e.g. before running a job that depends on it)
def get_cluster_status(cluster_id: str) -> str:
    response = redshift.describe_clusters(ClusterIdentifier=cluster_id)
    return response["Clusters"][0]["ClusterStatus"]

# Run SQL via the Data API — no persistent connection needed,
# great for Lambda / Step Functions tasks
def run_query(sql: str, cluster_id: str = CLUSTER_ID, database: str = DATABASE):
    response = redshift_data.execute_statement(
        ClusterIdentifier=cluster_id,
        Database=database,
        DbUser=DB_USER,
        Sql=sql,
    )
    statement_id = response["Id"]

    while True:
        status = redshift_data.describe_statement(Id=statement_id)
        state = status["Status"]
        if state in ("FINISHED", "FAILED", "ABORTED"):
            break
        time.sleep(2)

    if state == "FINISHED":
        if status.get("HasResultSet"):
            return redshift_data.get_statement_result(Id=statement_id)
        return None
    raise RuntimeError(f"Query failed: {status.get('Error')}")

# Typical pattern: bulk-load from S3 with the COPY command
def copy_from_s3(table: str, s3_path: str, iam_role_arn: str):
    sql = f"""
        COPY {table}
        FROM '{s3_path}'
        IAM_ROLE '{iam_role_arn}'
        FORMAT AS PARQUET;
    """
    run_query(sql)

# Run a batch of statements as one transaction (all succeed or all roll back)
def run_batch(sql_statements: list[str], cluster_id: str = CLUSTER_ID, database: str = DATABASE):
    response = redshift_data.batch_execute_statement(
        ClusterIdentifier=cluster_id,
        Database=database,
        DbUser=DB_USER,
        Sqls=sql_statements,
    )
    statement_id = response["Id"]
    while True:
        status = redshift_data.describe_statement(Id=statement_id)
        if status["Status"] in ("FINISHED", "FAILED", "ABORTED"):
            return status["Status"]
        time.sleep(2)

# Refresh a materialized view after a load completes
def refresh_materialized_view(view_name: str):
    run_query(f"REFRESH MATERIALIZED VIEW {view_name};")

# Resize a cluster programmatically (e.g. scale up before a heavy nightly batch)
def resize_cluster(cluster_id: str, number_of_nodes: int):
    redshift.resize_cluster(
        ClusterIdentifier=cluster_id,
        NumberOfNodes=number_of_nodes,
        ClusterType="multi-node",
    )

# Convert Data API results into a list of dicts (easier to work with than raw column arrays)
def results_to_dicts(query_result: dict) -> list[dict]:
    columns = [col["name"] for col in query_result["ColumnMetadata"]]
    rows = []
    for record in query_result["Records"]:
        row = {}
        for col, field in zip(columns, record):
            row[col] = next(iter(field.values()))  # unwrap {"stringValue": "..."} etc.
        rows.append(row)
    return rows

if __name__ == "__main__":
    try:
        if get_cluster_status(CLUSTER_ID) == "available":
            copy_from_s3(
                table="events",
                s3_path="s3://my-company-data-lake-curated/events/",
                iam_role_arn="arn:aws:iam::123456789012:role/redshift-copy-role",
            )
            refresh_materialized_view("mv_daily_active_users")
    except ClientError as e:
        print(f"Redshift error: {e.response['Error']['Message']}")
```

### boto3 Tips
- Prefer the **Data API** (`redshift-data` client) over `psycopg2`/JDBC when calling Redshift from Lambda or Step Functions — no connection pooling or VPC networking headaches.
- `execute_statement` is async — always poll `describe_statement` (or use `get_waiter` where supported) before reading results.
- Use `COPY ... FORMAT AS PARQUET` for loads whenever your S3 data is columnar — it's significantly faster than CSV/JSON COPY.
- For provisioned clusters, `redshift.resize_cluster()` lets you scale nodes programmatically for scheduled high-load windows (e.g. month-end reporting).
- Use `batch_execute_statement` when several DDL/DML statements need to succeed or fail together as one transaction.

---

## Security Best Practices
- Enable `require_ssl` in the cluster parameter group and reject unencrypted client connections.
- Use IAM roles attached to the cluster for `COPY`/`UNLOAD` rather than embedding AWS access keys in SQL statements.
- Rotate the master password via Secrets Manager rotation and reference it through `master_password` at apply time — never commit it to `.tfvars`.
- Use **column-level grants** or Lake Formation (for Spectrum tables) to restrict PII columns to specific roles rather than relying on table-level access alone.
- Place the cluster in private subnets with a security group that only allows the specific CIDR ranges of your BI tools/ETL jobs — never `0.0.0.0/0` on port 5439.

## Cost Optimization
- Use **Redshift Serverless** or pause/resume schedules on provisioned clusters for workloads with predictable idle windows (e.g. dev/test clusters off overnight).
- Right-size node count/type based on `WLM` queue wait times and `PercentageDiskUsed` — over-provisioned clusters are a common cost sink.
- Use **Reserved Instances** for steady-state production provisioned clusters once sizing is stable — significant discount over on-demand.
- Set a `concurrency-scaling` usage limit (`breach_action = "log"` or `"disable"`) to avoid surprise costs from burst concurrency.
- Compress/encode columns properly (`ANALYZE COMPRESSION`) — poor encoding inflates both storage and scan costs.

## Monitoring & Common Errors
| Symptom | Likely Cause | Fix |
|---|---|---|
| Queries queueing for a long time | WLM queue undersized for concurrent load | Tune WLM queues or enable concurrency scaling |
| `COPY` fails with "Load into table … failed" | Malformed rows, schema mismatch, or missing IAM permission on the S3 path | Check `STL_LOAD_ERRORS` table; verify IAM role has `s3:GetObject` on the exact prefix |
| Query plans show high disk-based operations | Insufficient memory allocated to the WLM queue, or bad sort/distribution keys | Increase queue memory %, or revisit `DISTKEY`/`SORTKEY` choices |
| Spectrum query is very slow | Underlying S3 data isn't partitioned/compressed well | Partition the S3 dataset, convert to Parquet, add Glue partition projection |
| High storage growth despite VACUUM | RA3 doesn't need manual VACUUM for space reclaim the way DS2 did, but sort order still degrades | Run `VACUUM SORT ONLY` or rely on Redshift's automatic table maintenance |

Monitor `PercentageDiskUsed`, `WLMQueueLength`, `CPUUtilization`, and `QueryDuration` via CloudWatch; enable **Redshift audit logging** (connection, user activity, user log) to a dedicated S3 bucket for compliance and troubleshooting.

---

[← Back to index](./00-index.md)
