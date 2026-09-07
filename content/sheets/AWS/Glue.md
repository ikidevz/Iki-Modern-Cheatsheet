# AWS Glue — Data Engineering Cheat Sheet

*Serverless data integration — a managed Hive Metastore-compatible catalog (Glue Data Catalog) plus Spark-based ETL jobs and crawlers.*

---

## Overview

Glue is the metadata and ETL backbone of an AWS data lake. The Data Catalog is shared across Athena, Redshift Spectrum, and EMR, so a table crawled once by Glue is queryable everywhere. Glue jobs run Spark (or plain Python) without you managing any cluster infrastructure.

## When to Use Glue (and When Not To)

**Use Glue when:**
- You need a shared metadata catalog across Athena/Redshift Spectrum/EMR
- Your ETL logic is a fairly standard Spark transformation (joins, aggregations, format conversion) and you don't want to manage cluster infrastructure
- You want built-in job bookmarking for incremental processing
- You need scheduled schema discovery over evolving S3 data

**Consider alternatives when:**
- You need fine-grained Spark tuning or custom cluster configuration → use EMR instead
- Your transform is a small, fast, event-triggered function → use Lambda instead
- You need sub-second cold start for interactive queries → use Athena directly instead of a Glue job

## Key Concepts

- **Data Catalog:** Central metadata store (databases/tables) shared across Athena, Redshift Spectrum, EMR
- **Crawlers:** Infer schema from S3/JDBC sources and populate the Catalog
- **Jobs:** Glue ETL (Spark), Glue Streaming, or Python Shell jobs
- **Job Bookmarks:** Track processed data so re-runs don't reprocess the same files
- **Workflows/Triggers:** Chain crawlers → jobs → crawlers into a DAG
- **DPU (Data Processing Unit):** Billing/compute unit for Glue jobs
- **Glue Studio:** Visual, drag-and-drop ETL job builder (generates PySpark code)
- **Glue DataBrew:** No-code data prep/cleaning tool for analysts
- **Connections:** Reusable JDBC/network configs so jobs can reach VPC-resident databases
- **Classifiers:** Custom logic a crawler uses to recognize non-standard file formats

## Common Architecture Patterns

**Catalog-first data lake:**
`S3 (raw)` → `Glue Crawler` → `Glue Data Catalog` → queried by `Athena` / `Redshift Spectrum` / `EMR Spark`

**Incremental ETL with bookmarks:**
`S3 (new files land daily)` → `Glue Job (bookmark-enabled)` → processes only new files each run → `S3 (curated)`

**Change Data Capture (CDC) merge:**
`DMS CDC output in S3` → `Glue Job (Iceberg/Hudi merge)` → upserts into a curated Iceberg table, giving row-level updates on top of S3

---

## Worked Examples

### Example 1: Crawl a new raw dataset into the catalog
**Scenario:** A new source system starts landing files in S3 and you need it queryable within a day.
```hcl
resource "aws_glue_crawler" "orders_crawler" {
  name          = "orders-crawler"
  role          = aws_iam_role.glue_role.arn
  database_name = aws_glue_catalog_database.curated.name
  s3_target { path = "s3://acme-data-lake-raw/orders/" }
  schedule = "cron(0 1 * * ? *)"
}
```
```python
run_crawler("orders-crawler")
list_tables("curated_db")  # confirm "orders" table now exists
```

### Example 2: Incremental ETL with job bookmarks
**Scenario:** A nightly job should only process files added since the last successful run.
```hcl
resource "aws_glue_job" "incremental_orders_etl" {
  name     = "incremental-orders-etl"
  role_arn = aws_iam_role.glue_role.arn
  command {
    name            = "glueetl"
    script_location = "s3://acme-scripts/glue/orders_etl.py"
    python_version  = "3"
  }
  default_arguments = { "--job-bookmark-option" = "job-bookmark-enable" }
}
```
```python
state = run_glue_job("incremental-orders-etl")
assert state == "SUCCEEDED"
get_recent_job_runs("incremental-orders-etl")  # confirm only new files were scanned
```

### Example 3: Chained workflow — crawl, transform, re-crawl
**Scenario:** After transforming data into `curated/`, a second crawler should register the new curated table automatically.
```hcl
resource "aws_glue_trigger" "recrawl_after_etl" {
  name          = "recrawl-curated-after-etl"
  type          = "CONDITIONAL"
  workflow_name = aws_glue_workflow.daily_etl.name
  predicate {
    conditions { job_name = aws_glue_job.incremental_orders_etl.name, state = "SUCCEEDED" }
  }
  actions { crawler_name = aws_glue_crawler.curated_crawler.name }
}
```
```python
# Kick off the whole workflow and poll its run state
glue.start_workflow_run(Name="daily-etl-workflow")
runs = glue.get_workflow_run(Name="daily-etl-workflow", RunId="wr_123", IncludeGraph=True)
print(runs["Run"]["Status"])
```

---

## Terraform

```hcl
resource "aws_glue_catalog_database" "curated" {
  name = "curated_db"
}

resource "aws_glue_crawler" "raw_crawler" {
  name          = "raw-zone-crawler"
  role          = aws_iam_role.glue_role.arn
  database_name = aws_glue_catalog_database.curated.name

  s3_target {
    path = "s3://my-company-data-lake-raw/events/"
  }

  schedule = "cron(0 2 * * ? *)" # nightly at 2 AM UTC

  schema_change_policy {
    update_behavior = "UPDATE_IN_DATABASE"
    delete_behavior = "LOG"
  }

  configuration = jsonencode({
    Version = 1.0
    Grouping = {
      TableGroupingPolicy = "CombineCompatibleSchemas"
    }
  })
}

resource "aws_glue_job" "etl_job" {
  name     = "transform-events-job"
  role_arn = aws_iam_role.glue_role.arn

  command {
    name            = "glueetl"
    script_location = "s3://my-company-scripts/glue/transform_events.py"
    python_version  = "3"
  }

  glue_version      = "4.0"
  worker_type       = "G.1X"
  number_of_workers = 5
  timeout           = 60
  max_retries       = 1

  default_arguments = {
    "--job-bookmark-option"              = "job-bookmark-enable"
    "--enable-metrics"                   = "true"
    "--enable-continuous-cloudwatch-log" = "true"
    "--enable-spark-ui"                  = "true"
    "--spark-event-logs-path"            = "s3://my-company-scripts/glue/spark-logs/"
    "--TempDir"                          = "s3://my-company-scripts/glue/temp/"
  }
}

# A reusable JDBC connection for jobs that read from RDS
resource "aws_glue_connection" "rds" {
  name = "rds-orders-db"

  connection_properties = {
    JDBC_CONNECTION_URL = "jdbc:postgresql://orders-db.abc123.us-east-1.rds.amazonaws.com:5432/orders"
    USERNAME             = var.rds_username
    PASSWORD             = var.rds_password
  }

  physical_connection_requirements {
    subnet_id              = var.private_subnet_id
    security_group_id_list = [aws_security_group.glue_connection.id]
    availability_zone       = "us-east-1a"
  }
}

# Chain crawler -> job -> crawler with a workflow
resource "aws_glue_workflow" "daily_etl" {
  name = "daily-etl-workflow"
}

resource "aws_glue_trigger" "start_on_schedule" {
  name          = "start-crawler-trigger"
  type          = "SCHEDULED"
  schedule      = "cron(0 2 * * ? *)"
  workflow_name = aws_glue_workflow.daily_etl.name

  actions {
    crawler_name = aws_glue_crawler.raw_crawler.name
  }
}

resource "aws_glue_trigger" "run_job_after_crawl" {
  name          = "run-etl-after-crawl"
  type          = "CONDITIONAL"
  workflow_name = aws_glue_workflow.daily_etl.name

  predicate {
    conditions {
      crawler_name = aws_glue_crawler.raw_crawler.name
      crawl_state   = "SUCCEEDED"
    }
  }

  actions {
    job_name = aws_glue_job.etl_job.name
  }
}
```

### AWS CLI Quick Reference
```bash
# Start a crawler and check its state
aws glue start-crawler --name raw-zone-crawler
aws glue get-crawler --name raw-zone-crawler --query 'Crawler.State'

# Start a job run and get logs
aws glue start-job-run --job-name transform-events-job
aws glue get-job-run --job-name transform-events-job --run-id jr_abc123

# List tables in a database
aws glue get-tables --database-name curated_db --query 'TableList[].Name'

# Get the schema for a specific table
aws glue get-table --database-name curated_db --name events --query 'Table.StorageDescriptor.Columns'

# Batch-delete stale partitions (e.g. after a reprocessing run)
aws glue batch-delete-partition --database-name curated_db --table-name events --partitions-to-delete file://partitions.json
```

### IaC Best Practices
- Grant the Glue IAM role least-privilege access scoped to specific S3 prefixes, not `s3:*`.
- Store Glue ETL scripts in version-controlled S3 paths (e.g. tag/commit-hash suffixed) so job runs are reproducible.
- Use `glue_version` and `worker_type` explicitly — don't leave them on defaults that may change between provider versions.
- Prefer **Glue Workflows** (`aws_glue_workflow` + `aws_glue_trigger`) over ad-hoc Lambda orchestration when everything is Glue-native.
- For frequently changing schemas, run crawlers on a schedule but review `schema_change_policy` carefully — `LOG` is safer than silent deletes.
- Enable `--enable-continuous-cloudwatch-log` and `--enable-spark-ui` in `default_arguments` — the Spark UI is invaluable for diagnosing slow stages.

---

## Python (boto3)

```python
import boto3
import time
from botocore.exceptions import ClientError

glue = boto3.client("glue", region_name="us-east-1")

# Create a catalog database
def create_database(name: str):
    glue.create_database(DatabaseInput={"Name": name})

# Start a crawler and poll until it finishes
def run_crawler(crawler_name: str, poll_interval: int = 15):
    glue.start_crawler(Name=crawler_name)
    while True:
        response = glue.get_crawler(Name=crawler_name)
        state = response["Crawler"]["State"]
        if state == "READY":
            last_run = response["Crawler"].get("LastCrawl", {})
            print(f"Crawler finished: {last_run.get('Status')}")
            break
        print(f"Crawler state: {state}")
        time.sleep(poll_interval)

# Start a Glue ETL job and wait for completion
def run_glue_job(job_name: str, arguments: dict | None = None) -> str:
    response = glue.start_job_run(
        JobName=job_name,
        Arguments=arguments or {},
    )
    run_id = response["JobRunId"]

    while True:
        status = glue.get_job_run(JobName=job_name, RunId=run_id)
        state = status["JobRun"]["JobRunState"]
        if state in ("SUCCEEDED", "FAILED", "STOPPED", "TIMEOUT"):
            print(f"Job {job_name} finished with state: {state}")
            if state != "SUCCEEDED":
                print(f"Error: {status['JobRun'].get('ErrorMessage')}")
            return state
        time.sleep(20)

# List tables in a database (e.g. to validate a crawler run)
def list_tables(database_name: str):
    paginator = glue.get_paginator("get_tables")
    for page in paginator.paginate(DatabaseName=database_name):
        for table in page["TableList"]:
            print(table["Name"], table["StorageDescriptor"]["Location"])

# Programmatically register a table (e.g. from a CI pipeline instead of a crawler)
def create_table(database_name: str, table_name: str, s3_location: str, columns: list[dict]):
    glue.create_table(
        DatabaseName=database_name,
        TableInput={
            "Name": table_name,
            "StorageDescriptor": {
                "Columns": columns,  # e.g. [{"Name": "user_id", "Type": "string"}, ...]
                "Location": s3_location,
                "InputFormat": "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat",
                "OutputFormat": "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat",
                "SerdeInfo": {
                    "SerializationLibrary": "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
                },
            },
            "TableType": "EXTERNAL_TABLE",
            "Parameters": {"classification": "parquet"},
        },
    )

# Add a partition manually (faster than a full crawler run for one new partition)
def add_partition(database_name: str, table_name: str, partition_values: list[str], s3_location: str):
    table = glue.get_table(DatabaseName=database_name, Name=table_name)["Table"]
    glue.create_partition(
        DatabaseName=database_name,
        TableName=table_name,
        PartitionInput={
            "Values": partition_values,  # e.g. ["2026", "09", "03"]
            "StorageDescriptor": {
                **table["StorageDescriptor"],
                "Location": s3_location,
            },
        },
    )

# Get all job runs with their status (a simple health dashboard query)
def get_recent_job_runs(job_name: str, max_results: int = 10):
    response = glue.get_job_runs(JobName=job_name, MaxResults=max_results)
    for run in response["JobRuns"]:
        print(run["Id"], run["JobRunState"], run.get("ExecutionTime"), "seconds")

if __name__ == "__main__":
    try:
        run_crawler("raw-zone-crawler")
        run_glue_job(
            "transform-events-job",
            arguments={"--job-bookmark-option": "job-bookmark-enable"},
        )
        list_tables("curated_db")
    except ClientError as e:
        print(f"Glue error: {e.response['Error']['Message']}")
```

### boto3 Tips
- `start_job_run` / `start_crawler` are async — always poll `get_job_run` / `get_crawler` (or use `waiter`s where available) rather than assuming completion.
- Pass job parameters via the `Arguments` dict with a `--` prefix, matching how `sys.argv` is parsed inside the Glue Spark script (`getResolvedOptions`).
- Use `get_paginator("get_tables")` / `get_paginator("get_partitions")` for catalogs with many tables/partitions — both are paginated APIs.
- For CI/CD, `create_job` / `update_job` let you push job definitions from a pipeline instead of editing them in the console — useful when Terraform manages infra but not job logic.
- `create_partition` is much cheaper than re-running a full crawler when you only need to register one new day's data — use it in a Lambda triggered right after a Glue job finishes.

---

## Security Best Practices
- Scope the Glue IAM role to specific S3 prefixes (`raw/*`, `curated/*`) rather than granting catalog-wide or bucket-wide access.
- Use **Lake Formation** permissions (see the Supporting Services page) instead of raw IAM/S3 policies once more than a couple of teams query the same catalog — it enables column and row-level security centrally.
- Store JDBC credentials for `aws_glue_connection` in Secrets Manager and reference them via `USERNAME`/`PASSWORD` resolved from a data source, never inline in Terraform.
- Enable encryption at rest for the Data Catalog itself (`aws_glue_data_catalog_encryption_settings`) in addition to S3 encryption.

## Cost Optimization
- Right-size `number_of_workers` — most ETL jobs don't need G.2X workers; start with G.1X and scale up only if you see memory pressure in the Spark UI.
- Enable **job bookmarks** so re-runs don't reprocess unchanged data — this alone often cuts DPU-hours by more than half on incremental pipelines.
- Use **Flex execution class** (`execution_class = "FLEX"`) for non-time-critical jobs — it's cheaper and uses spare compute capacity, at the cost of less predictable start times.
- Consolidate multiple small crawlers into fewer, prefix-scoped crawlers where schemas are compatible — each crawler run has a minimum billable duration.
- Set a `timeout` on every job; a stuck job silently burning DPU-hours for hours is a common source of surprise bills.

## Monitoring & Common Errors
| Symptom | Likely Cause | Fix |
|---|---|---|
| Crawler creates duplicate tables per partition | Incompatible schemas across files in the same prefix | Set `TableGroupingPolicy = "CombineCompatibleSchemas"`, standardize file schemas |
| Job bookmark not skipping old files | Bookmark disabled, or job code re-reads from a path outside the bookmarked source | Confirm `--job-bookmark-option=job-bookmark-enable` and that the source is passed via `create_dynamic_frame`, not a raw Spark read |
| `AnalysisException: Path does not exist` | Crawler registered a table pointing at a prefix that was later deleted/moved | Re-run crawler, or fix the table's `Location` via `update_table` |
| Job runs far longer than expected | Data skew across partitions, or too few workers for data volume | Check Spark UI stage timings; repartition or increase `number_of_workers` |
| `AccessDeniedException` connecting to RDS via Glue Connection | Security group doesn't allow Glue's ENIs, or subnet has no NAT/route | Verify `physical_connection_requirements` security group allows inbound from itself |

Monitor via CloudWatch metrics `glue.driver.aggregate.numFailedTasks`, job run duration, and DPU hours; enable **Continuous Logging** to stream Spark driver/executor logs during a run instead of only after completion.

---

[← Back to index](./00-index.md)
