# Supporting Services — Data Engineering Cheat Sheet

*Athena, Lake Formation, DMS, IAM, CloudWatch, Secrets Manager, and VPC — the services that round out a complete AWS data platform.*

---

## Worked Examples (Cross-Service)

### Example 1: Ad-hoc cost-capped exploration query
**Scenario:** An analyst wants to explore a new dataset without risking an accidental multi-TB scan.
```hcl
resource "aws_athena_workgroup" "sandbox" {
  name = "analyst-sandbox"
  configuration {
    result_configuration { output_location = "s3://acme-athena-results/sandbox/" }
    bytes_scanned_cutoff_per_query = 5368709120 # 5 GB hard cap
  }
}
```
```python
rows = run_athena_query("SELECT * FROM curated_db.events LIMIT 100", "curated_db", workgroup="analyst-sandbox")
```

### Example 2: Locking down PII before opening access to a new team
**Scenario:** A new marketing analytics team needs `SELECT` on the customers table, but must never see raw emails or phone numbers.
```hcl
resource "aws_lakeformation_permissions" "marketing_restricted" {
  principal   = aws_iam_role.marketing_analyst.arn
  permissions = ["SELECT"]
  table_with_columns {
    database_name          = "curated_db"
    name                     = "customers"
    excluded_column_names   = ["email", "phone_number", "ssn"]
  }
}
```
```python
grant_column_restricted_select(
    principal_arn="arn:aws:iam::123456789012:role/marketing-analyst",
    database="curated_db", table="customers",
    excluded_columns=["email", "phone_number", "ssn"],
)
```

### Example 3: End-to-end CDC replication with a credentials rotation safety net
**Scenario:** Replicate an operational orders database into the lake, with credentials that rotate automatically so the pipeline never breaks on a manual password change.
```hcl
resource "aws_secretsmanager_secret_rotation" "orders_db_creds" {
  secret_id           = aws_secretsmanager_secret.orders_db.id
  rotation_lambda_arn = aws_lambda_function.rotate_orders_secret.arn
  rotation_rules { automatically_after_days = 30 }
}
```
```python
creds = get_secret_cached("data-platform/orders-db")
# DMS endpoint picks up rotated creds automatically on next connection attempt
status = check_task_status("arn:aws:dms:us-east-1:123456789012:task:orders-cdc-to-s3")
print(status)
```

---

## Amazon Athena

Serverless SQL query engine over S3 via the Glue Catalog — no infrastructure to manage.

### When to Use
Ad-hoc exploration, one-off analysis, or lightweight BI queries directly over your data lake — without loading data into a warehouse first. Not ideal for high-concurrency, sub-second dashboards (Redshift or a cache layer fits better there).

### Terraform
```hcl
resource "aws_athena_workgroup" "analytics" {
  name = "analytics-workgroup"

  configuration {
    result_configuration {
      output_location = "s3://my-company-athena-results/"

      encryption_configuration {
        encryption_option = "SSE_KMS"
        kms_key_arn        = aws_kms_key.athena.arn
      }
    }

    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true

    bytes_scanned_cutoff_per_query = 10737418240 # 10 GB safety cap per query
  }
}

resource "aws_athena_named_query" "daily_active_users" {
  name      = "daily-active-users"
  workgroup = aws_athena_workgroup.analytics.name
  database  = "curated_db"
  query     = "SELECT event_date, COUNT(DISTINCT user_id) FROM events GROUP BY event_date;"
}
```

### Python (boto3)
```python
import boto3
import time

athena = boto3.client("athena", region_name="us-east-1")

def run_athena_query(sql: str, database: str, workgroup: str = "analytics-workgroup") -> list[dict]:
    response = athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={"Database": database},
        WorkGroup=workgroup,
    )
    query_id = response["QueryExecutionId"]

    while True:
        status = athena.get_query_execution(QueryExecutionId=query_id)
        state = status["QueryExecution"]["Status"]["State"]
        if state in ("SUCCEEDED", "FAILED", "CANCELLED"):
            break
        time.sleep(2)

    if state != "SUCCEEDED":
        raise RuntimeError(status["QueryExecution"]["Status"].get("StateChangeReason"))

    # Report how much data was scanned — useful for cost tracking per query
    scanned_bytes = status["QueryExecution"]["Statistics"]["DataScannedInBytes"]
    print(f"Scanned {scanned_bytes / 1e9:.2f} GB")

    results = athena.get_query_results(QueryExecutionId=query_id)
    return results["ResultSet"]["Rows"]

def results_to_dicts(rows: list[dict]) -> list[dict]:
    header = [c["VarCharValue"] for c in rows[0]["Data"]]
    return [
        dict(zip(header, [c.get("VarCharValue") for c in row["Data"]]))
        for row in rows[1:]
    ]
```

*Tip: Always set `output_location`; without it, query results scatter across default locations that are hard to govern. In boto3, always poll `get_query_execution` — `start_query_execution` returns immediately. Use `bytes_scanned_cutoff_per_query` to guard against accidental full-table scans.*

---

## AWS Lake Formation

Centralized permissions layer on top of the Glue Catalog — column/row-level security across Athena, Redshift Spectrum, EMR.

### When to Use
As soon as more than one team queries the same catalog, or you need column/row-level restrictions (e.g. masking PII for analysts but not for the finance team). Retrofitting this after a lake has grown organically with ad-hoc IAM/S3 policies is significantly harder than adopting it early.

### Terraform
```hcl
resource "aws_lakeformation_data_lake_settings" "main" {
  admins = [aws_iam_role.data_lake_admin.arn]
}

resource "aws_lakeformation_resource" "raw_bucket" {
  arn = aws_s3_bucket.data_lake.arn
}

resource "aws_lakeformation_permissions" "analyst_read" {
  principal   = aws_iam_role.analyst.arn
  permissions = ["SELECT"]

  table {
    database_name = aws_glue_catalog_database.curated.name
    name           = "events"
  }
}

# Column-level security: hide PII columns from a broad "analyst" role
resource "aws_lakeformation_permissions" "analyst_column_restricted" {
  principal   = aws_iam_role.analyst.arn
  permissions = ["SELECT"]

  table_with_columns {
    database_name    = aws_glue_catalog_database.curated.name
    name              = "customers"
    excluded_column_names = ["ssn", "email", "phone_number"]
  }
}

# Row-level via data filters (Lake Formation 3.0+)
resource "aws_lakeformation_data_cells_filter" "region_filter" {
  table_data {
    database_name    = aws_glue_catalog_database.curated.name
    table_name        = "sales"
    name              = "us-region-only"
    table_catalog_id  = data.aws_caller_identity.current.account_id

    row_filter {
      filter_expression = "region = 'US'"
    }

    column_wildcard {}
  }
}
```

### Python (boto3)
```python
import boto3

lakeformation = boto3.client("lakeformation", region_name="us-east-1")

def grant_table_select(principal_arn: str, database: str, table: str):
    lakeformation.grant_permissions(
        Principal={"DataLakePrincipalIdentifier": principal_arn},
        Resource={"Table": {"DatabaseName": database, "Name": table}},
        Permissions=["SELECT"],
    )

def grant_column_restricted_select(principal_arn: str, database: str, table: str, excluded_columns: list[str]):
    lakeformation.grant_permissions(
        Principal={"DataLakePrincipalIdentifier": principal_arn},
        Resource={
            "TableWithColumns": {
                "DatabaseName": database,
                "Name": table,
                "ColumnWildcard": {"ExcludedColumnNames": excluded_columns},
            }
        },
        Permissions=["SELECT"],
    )

def list_permissions_for_principal(principal_arn: str):
    response = lakeformation.list_permissions(
        Principal={"DataLakePrincipalIdentifier": principal_arn}
    )
    for grant in response["PrincipalResourcePermissions"]:
        print(grant["Resource"], grant["Permissions"])
```

*Tip: Migrate to Lake Formation permissions early — retrofitting fine-grained access control onto an existing lake is painful. Use `list_permissions_for_principal` periodically as an access audit.*

---

## AWS DMS (Database Migration Service)

CDC (change data capture) replication from operational databases (RDS/on-prem) into S3 or Redshift.

### When to Use
Continuously replicating operational database changes into your data lake/warehouse without building custom CDC logic, or performing a one-time database migration/homogeneous-to-heterogeneous engine switch (e.g. Oracle → Aurora PostgreSQL).

### Terraform
```hcl
resource "aws_dms_replication_instance" "cdc" {
  replication_instance_id    = "cdc-to-datalake"
  replication_instance_class = "dms.t3.medium"
  allocated_storage          = 50
  vpc_security_group_ids     = [aws_security_group.dms.id]
  replication_subnet_group_id = aws_dms_replication_subnet_group.main.id
  multi_az                    = true
  publicly_accessible         = false
}

resource "aws_dms_replication_subnet_group" "main" {
  replication_subnet_group_id          = "dms-subnet-group"
  replication_subnet_group_description = "DMS subnet group"
  subnet_ids                            = var.private_subnet_ids
}

resource "aws_dms_endpoint" "source_rds" {
  endpoint_id   = "source-orders-db"
  endpoint_type = "source"
  engine_name   = "postgres"
  server_name   = aws_db_instance.orders.address
  port          = 5432
  username      = var.db_username
  password      = var.db_password
  database_name = "orders"
}

resource "aws_dms_endpoint" "target_s3" {
  endpoint_id   = "target-datalake"
  endpoint_type = "target"
  engine_name   = "s3"

  s3_settings {
    bucket_name    = aws_s3_bucket.data_lake.bucket
    bucket_folder  = "raw/cdc/orders/"
    compression_type = "GZIP"
    data_format     = "parquet"
  }
}

resource "aws_dms_replication_task" "cdc_task" {
  replication_task_id      = "orders-cdc-to-s3"
  replication_instance_arn = aws_dms_replication_instance.cdc.replication_instance_arn
  source_endpoint_arn       = aws_dms_endpoint.source_rds.endpoint_arn
  target_endpoint_arn       = aws_dms_endpoint.target_s3.endpoint_arn
  migration_type            = "full-load-and-cdc"

  table_mappings = jsonencode({
    rules = [{
      "rule-type"   = "selection"
      "rule-id"     = "1"
      "rule-name"   = "1"
      "object-locator" = { "schema-name" = "public", "table-name" = "%" }
      "rule-action" = "include"
    }]
  })
}
```

### Python (boto3)
```python
import boto3

dms = boto3.client("dms", region_name="us-east-1")

def start_replication_task(task_arn: str, start_type: str = "start-replication"):
    dms.start_replication_task(
        ReplicationTaskArn=task_arn,
        StartReplicationTaskType=start_type,  # "resume-processing" or "reload-target" also valid
    )

def check_task_status(task_arn: str) -> dict:
    response = dms.describe_replication_tasks(
        Filters=[{"Name": "replication-task-arn", "Values": [task_arn]}]
    )
    task = response["ReplicationTasks"][0]
    return {
        "status": task["Status"],
        "percent_complete": task.get("ReplicationTaskStats", {}).get("FullLoadProgressPercent"),
    }

def get_table_statistics(task_arn: str):
    response = dms.describe_table_statistics(ReplicationTaskArn=task_arn)
    for table in response["TableStatistics"]:
        print(table["TableName"], table["FullLoadRows"], table["Inserts"], table["Updates"], table["Deletes"])
```

*Tip: Use `cdc` migration type (not `full-load-and-cdc`) once the initial backfill is done, to avoid re-scanning source tables. Monitor `describe_table_statistics` to catch tables that are silently failing to replicate.*

---

## IAM (the glue behind everything)

### Key Principles
- One **execution role per service**, scoped to specific resource ARNs — resist the urge to share a single "data-platform-role" across Glue/Lambda/EMR.
- Use `aws_iam_policy_document` data sources instead of inline JSON heredocs — they catch syntax errors at `plan` time.
- Tag every role with `Project`/`Owner`/`Environment` for cost allocation and audit trails.
- Use **permission boundaries** on roles that pipelines can create dynamically, to cap the maximum permissions even if the attached policy is later widened by mistake.

### Terraform
```hcl
data "aws_iam_policy_document" "glue_role_policy" {
  statement {
    effect  = "Allow"
    actions = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
    resources = [
      aws_s3_bucket.data_lake.arn,
      "${aws_s3_bucket.data_lake.arn}/raw/*",
      "${aws_s3_bucket.data_lake.arn}/curated/*",
    ]
  }

  statement {
    effect    = "Allow"
    actions   = ["glue:GetTable", "glue:GetDatabase", "glue:CreatePartition"]
    resources = ["*"] # Glue Catalog resources support limited ARN scoping; combine with Lake Formation for finer control
  }
}

resource "aws_iam_role_policy" "glue_role_policy" {
  name   = "glue-etl-policy"
  role   = aws_iam_role.glue_role.id
  policy = data.aws_iam_policy_document.glue_role_policy.json
}
```

### Python (boto3)
```python
import boto3

iam = boto3.client("iam")

def get_role_policies(role_name: str):
    """Quick audit helper: list all policies attached to a role."""
    attached = iam.list_attached_role_policies(RoleName=role_name)
    inline = iam.list_role_policies(RoleName=role_name)
    return attached["AttachedPolicies"], inline["PolicyNames"]

def find_overly_permissive_roles(prefix: str = "") -> list[str]:
    """Flag roles with a wildcard '*' resource in an inline policy — a common audit finding."""
    flagged = []
    paginator = iam.get_paginator("list_roles")
    for page in paginator.paginate(PathPrefix=f"/{prefix}"):
        for role in page["Roles"]:
            policies = iam.list_role_policies(RoleName=role["RoleName"])
            for policy_name in policies["PolicyNames"]:
                doc = iam.get_role_policy(RoleName=role["RoleName"], PolicyName=policy_name)
                if '"Resource": "*"' in str(doc["PolicyDocument"]):
                    flagged.append(role["RoleName"])
    return flagged
```

---

## CloudWatch

### Key Principles
- Ship Glue/EMR/Lambda/MWAA logs to dedicated log groups with explicit retention (`aws_cloudwatch_log_group.retention_in_days`) — default is "never expire," which gets expensive.
- Build a metric alarm on Step Functions `ExecutionsFailed` and Lambda `Errors` as a baseline pipeline health check.
- Use **CloudWatch Composite Alarms** to combine multiple pipeline-health signals into one actionable alert instead of paging on every individual metric blip.
- Consider **CloudWatch Dashboards** (or exporting metrics to Grafana) for a single-pane view across all services in a pipeline.

### Terraform
```hcl
resource "aws_cloudwatch_log_group" "glue_job_logs" {
  name              = "/aws-glue/jobs/transform-events-job"
  retention_in_days = 30
}

resource "aws_cloudwatch_metric_alarm" "step_functions_failures" {
  alarm_name          = "etl-pipeline-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ExecutionsFailed"
  namespace           = "AWS/States"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    StateMachineArn = aws_sfn_state_machine.etl_pipeline.arn
  }
}

resource "aws_cloudwatch_dashboard" "pipeline_health" {
  dashboard_name = "data-platform-health"
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [["AWS/States", "ExecutionsFailed", "StateMachineArn", aws_sfn_state_machine.etl_pipeline.arn]]
          period  = 300
          stat     = "Sum"
          region   = "us-east-1"
          title    = "ETL Pipeline Failures"
        }
      }
    ]
  })
}
```

### Python (boto3)
```python
import boto3

cloudwatch = boto3.client("cloudwatch", region_name="us-east-1")
logs = boto3.client("logs", region_name="us-east-1")

def get_recent_errors(log_group: str, minutes: int = 60):
    import time
    start_time = int((time.time() - minutes * 60) * 1000)
    response = logs.filter_log_events(
        logGroupName=log_group,
        startTime=start_time,
        filterPattern="ERROR",
    )
    return [e["message"] for e in response["events"]]

def put_custom_metric(namespace: str, metric_name: str, value: float):
    cloudwatch.put_metric_data(
        Namespace=namespace,
        MetricData=[{"MetricName": metric_name, "Value": value}],
    )

def run_log_insights_query(log_group: str, query: str, minutes: int = 60):
    """Use CloudWatch Logs Insights for aggregation queries across many log streams."""
    import time
    start_query = logs.start_query(
        logGroupName=log_group,
        startTime=int(time.time() - minutes * 60),
        endTime=int(time.time()),
        queryString=query,
    )
    query_id = start_query["queryId"]
    while True:
        result = logs.get_query_results(queryId=query_id)
        if result["status"] in ("Complete", "Failed", "Cancelled"):
            return result["results"]
        time.sleep(2)
```

---

## Secrets Manager

Store all DB credentials (Redshift master password, JDBC connection strings) here, referenced by Glue Connections and Lambda environment variables — never in `.tfvars` committed to git.

### Terraform
```hcl
resource "aws_secretsmanager_secret" "redshift_creds" {
  name = "data-platform/redshift/master"
}

resource "aws_secretsmanager_secret_version" "redshift_creds" {
  secret_id = aws_secretsmanager_secret.redshift_creds.id
  secret_string = jsonencode({
    username = "admin"
    password = var.redshift_master_password
    host      = aws_redshift_cluster.warehouse.endpoint
    port      = 5439
    dbname    = "analytics"
  })
}

# Automatic rotation every 30 days via a Lambda rotation function
resource "aws_secretsmanager_secret_rotation" "redshift_creds" {
  secret_id           = aws_secretsmanager_secret.redshift_creds.id
  rotation_lambda_arn = aws_lambda_function.rotate_redshift_secret.arn

  rotation_rules {
    automatically_after_days = 30
  }
}
```

### Python (boto3)
```python
import boto3
import json

secrets = boto3.client("secretsmanager", region_name="us-east-1")

def get_secret(secret_name: str) -> dict:
    response = secrets.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])

# Usage inside a Lambda/Glue job:
# creds = get_secret("data-platform/redshift/master")
# conn = psycopg2.connect(host=creds["host"], user=creds["username"], password=creds["password"])

# Simple in-memory cache so a warm Lambda doesn't call Secrets Manager on every invocation
_secret_cache: dict[str, dict] = {}

def get_secret_cached(secret_name: str) -> dict:
    if secret_name not in _secret_cache:
        _secret_cache[secret_name] = get_secret(secret_name)
    return _secret_cache[secret_name]
```

*Tip: Cache retrieved secrets in memory within a single Lambda invocation/warm container — don't call `get_secret_value` on every row processed.*

---

## VPC Basics for Data Engineering

- Most compute here (Redshift, EMR, MWAA, VPC-attached Lambda) needs **private subnets + NAT gateway** for egress (package installs, API calls) without public exposure.
- Use **VPC endpoints** (Gateway endpoint for S3, Interface endpoints for Glue/Secrets Manager/CloudWatch) to keep traffic off the public internet and cut NAT data-processing costs.

```hcl
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = var.vpc_id
  service_name      = "com.amazonaws.us-east-1.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = var.private_route_table_ids
}

resource "aws_vpc_endpoint" "glue" {
  vpc_id              = var.vpc_id
  service_name         = "com.amazonaws.us-east-1.glue"
  vpc_endpoint_type    = "Interface"
  subnet_ids           = var.private_subnet_ids
  security_group_ids   = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled  = true
}

resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = var.vpc_id
  service_name         = "com.amazonaws.us-east-1.secretsmanager"
  vpc_endpoint_type    = "Interface"
  subnet_ids           = var.private_subnet_ids
  security_group_ids   = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled  = true
}
```

### Python (boto3) — quick VPC/networking audit
```python
import boto3

ec2 = boto3.client("ec2", region_name="us-east-1")

def list_vpc_endpoints(vpc_id: str):
    response = ec2.describe_vpc_endpoints(Filters=[{"Name": "vpc-id", "Values": [vpc_id]}])
    for ep in response["VpcEndpoints"]:
        print(ep["ServiceName"], ep["VpcEndpointType"], ep["State"])

def check_nat_gateway_health(vpc_id: str):
    response = ec2.describe_nat_gateways(Filter=[{"Name": "vpc-id", "Values": [vpc_id]}])
    for nat in response["NatGateways"]:
        print(nat["NatGatewayId"], nat["State"])
```

---

## Putting It Together: A Minimal End-to-End Security Checklist

- [ ] Every S3 bucket has Block Public Access enabled and encryption enforced via bucket policy
- [ ] Every compute service (Glue/EMR/Lambda/MWAA/Redshift) has its own least-privilege IAM role
- [ ] All credentials live in Secrets Manager, not in Terraform variables or environment variables in plaintext
- [ ] Lake Formation (or equivalent Glue/IAM policies) enforces column/row-level access where PII is present
- [ ] VPC endpoints exist for S3, Glue, Secrets Manager, and CloudWatch to avoid unnecessary public internet egress
- [ ] CloudWatch alarms exist for pipeline failures (Step Functions `ExecutionsFailed`, Lambda `Errors`, Glue job failures)
- [ ] Log retention is explicitly set (not "never expire") on every log group

---

[← Back to index](./00-index.md)
