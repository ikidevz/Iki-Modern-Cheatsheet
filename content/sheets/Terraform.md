# Terraform for Data Engineering — Complete Cheat Sheet

A comprehensive reference for provisioning and managing data platform infrastructure with Terraform on AWS, with notes on Azure/GCP equivalents, testing, CI/CD, and operational best practices.

---

## 📑 Table of Contents

1. [🏗️ Terraform Basics](#1-terraform-basics)
2. [🧩 HCL Syntax Reference](#2-hcl-syntax-reference)
3. [⌨️ Essential CLI Commands](#3-essential-cli-commands)
4. [🗂️ Project Structure](#4-project-structure)
5. [🔒 State Management](#5-state-management)
6. [🗄️ Data Storage Infrastructure](#6-data-storage-infrastructure)
7. [⚙️ Data Processing Infrastructure](#7-data-processing-infrastructure)
8. [🔀 Orchestration](#8-orchestration)
9. [📡 Streaming Infrastructure](#9-streaming-infrastructure)
10. [📊 Analytics Infrastructure](#10-analytics-infrastructure)
11. [🌐 Networking and Security](#11-networking-and-security)
12. [🔑 IAM Roles and Policies](#12-iam-roles-and-policies)
13. [📈 Monitoring and Alerting](#13-monitoring-and-alerting)
14. [🧮 Variables, Locals, and Outputs](#14-variables-locals-and-outputs)
15. [📦 Modules](#15-modules)
16. [🌍 Multi-Environment Patterns](#16-multi-environment-patterns)
17. [☁️ Multi-Cloud Notes (Azure / GCP)](#17-multi-cloud-notes-azure--gcp)
18. [🧪 Testing Terraform](#18-testing-terraform)
19. [🔁 CI/CD Integration](#19-cicd-integration)
20. [💰 Cost Management](#20-cost-management)
21. [🛡️ Security Hardening Checklist](#21-security-hardening-checklist)
22. [🩺 Troubleshooting](#22-troubleshooting)
23. [📋 Quick Reference Tables](#23-quick-reference-tables)

---

## 1. 🏗️ Terraform Basics

### Core Concepts

| Concept                          | Description                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Infrastructure as Code (IaC)** | Infrastructure is defined declaratively in configuration files instead of provisioned by hand             |
| **Provider**                     | A plugin that translates HCL into API calls for a platform (AWS, Azure, GCP, Snowflake, Databricks, etc.) |
| **Resource**                     | A managed infrastructure object (`aws_s3_bucket`, `aws_redshift_cluster`)                                 |
| **Data Source**                  | Read-only lookup of information that already exists (`data "aws_vpc" "existing"`)                         |
| **Variable**                     | Parameterized input to a configuration                                                                    |
| **Local**                        | A named expression computed once and reused within a module                                               |
| **Output**                       | A value exposed by a module for use elsewhere                                                             |
| **State**                        | A JSON file that maps real-world resources to your configuration                                          |
| **Module**                       | A reusable, self-contained collection of `.tf` files                                                      |
| **Provisioner**                  | Executes scripts on local/remote machines during create/destroy (last-resort tool)                        |
| **Backend**                      | Where state is stored (S3, Terraform Cloud, local, etc.)                                                  |

### Why Terraform for Data Engineering Specifically

- **Reproducible environments**: spin up an identical dev/staging/prod data platform (Glue, Redshift, EMR, Kinesis) from the same code.
- **Drift detection**: `terraform plan` catches manual console changes before they cause pipeline failures.
- **Change auditing**: infrastructure changes get the same PR review and version history as pipeline code.
- **Blast-radius control**: `-target`, workspaces, and module boundaries let you scope changes to one pipeline or dataset.
- **Dependency-aware provisioning**: Terraform builds a DAG so a Redshift cluster, its subnet group, and its security group are created in the correct order automatically.

---

## 2. 🧩 HCL Syntax Reference

### Basic Block Anatomy

```hcl
resource "<PROVIDER>_<TYPE>" "<LOCAL_NAME>" {
  argument1 = value1
  argument2 = value2

  nested_block {
    nested_argument = value
  }
}
```

### Data Types

```hcl
locals {
  a_string   = "hello"
  a_number   = 42
  a_bool     = true
  a_list     = ["a", "b", "c"]
  a_set      = toset(["a", "b", "c"])
  a_map      = { key1 = "value1", key2 = "value2" }
  an_object  = { name = "raw", size_gb = 100 }
  a_tuple    = ["a", 1, true]
}
```

### Expressions & Interpolation

```hcl
# String interpolation
bucket = "${var.project_name}-raw-${var.environment}"

# Conditional (ternary) expression
instance_count = var.environment == "prod" ? 3 : 1

# For expression (list)
uppercase_envs = [for e in var.environments : upper(e)]

# For expression (map)
tag_map = { for k, v in var.tags : k => upper(v) }

# Splat expression
subnet_ids = aws_subnet.private[*].id

# Dynamic block
dynamic "ingress" {
  for_each = var.ingress_rules
  content {
    from_port = ingress.value.from_port
    to_port   = ingress.value.to_port
    protocol  = ingress.value.protocol
  }
}
```

### Commonly Used Built-in Functions

| Function                    | Purpose                                  | Example                                                |
| --------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| `jsonencode()`              | Convert HCL to JSON string               | `jsonencode({Version="2012-10-17"})`                   |
| `merge()`                   | Combine maps                             | `merge(var.common_tags, {Name="x"})`                   |
| `lookup()`                  | Safe map lookup with default             | `lookup(var.map, "key", "default")`                    |
| `coalesce()`                | First non-null value                     | `coalesce(var.override, var.default)`                  |
| `element()`                 | Index into list (wraps around)           | `element(var.azs, 0)`                                  |
| `length()`                  | Count items                              | `length(var.subnet_cidrs)`                             |
| `try()`                     | Attempt an expression, fallback on error | `try(var.x.y, null)`                                   |
| `templatefile()`            | Render a template file                   | `templatefile("./init.tpl", {region=var.region})`      |
| `timestamp()`               | Current UTC timestamp                    | used for build tags, not resource names (causes diffs) |
| `cidrsubnet()`              | Calculate subnet CIDR                    | `cidrsubnet(var.vpc_cidr, 8, 1)`                       |
| `format()` / `formatlist()` | String formatting                        | `format("%s-%02d", "shard", 3)`                        |
| `regex()` / `regexall()`    | Pattern matching                         | `regex("^v(\\d+)", var.version)`                       |

### Meta-Arguments

```hcl
resource "aws_s3_bucket" "example" {
  count      = var.create_bucket ? 1 : 0   # conditional creation
  for_each   = toset(var.bucket_names)      # create one per item, keyed by value
  depends_on = [aws_iam_role.example]       # explicit dependency
  lifecycle {
    create_before_destroy = true
    prevent_destroy        = true
    ignore_changes          = [tags["LastModified"]]
  }
  provider = aws.us_east_1                  # provider alias
}
```

> **`count` vs `for_each`**: prefer `for_each` when items have stable, unique keys (e.g., bucket names). `count` is fragile — removing a middle item shifts every subsequent index and can cause Terraform to destroy/recreate unrelated resources.

---

## 3. ⌨️ Essential CLI Commands

```bash
# --- Lifecycle ---
terraform init                     # download providers/modules, configure backend
terraform init -upgrade            # upgrade provider/module versions within constraints
terraform init -reconfigure        # re-run backend config without migrating state
terraform validate                 # syntax + internal consistency check
terraform fmt -recursive           # auto-format all .tf files
terraform plan -out=plan.tfplan    # preview changes, save the plan
terraform apply plan.tfplan        # apply a saved plan (avoids re-computation drift)
terraform apply -auto-approve      # skip interactive confirmation (use in CI only)
terraform destroy                  # tear down everything in this state
terraform destroy -target=aws_glue_job.etl_job   # tear down one resource

# --- Inspection ---
terraform show                     # human-readable current state
terraform show -json plan.tfplan   # machine-readable plan (for policy checks)
terraform state list               # list all resources tracked in state
terraform state show aws_s3_bucket.data_lake_raw
terraform graph | dot -Tsvg > graph.svg   # visualize dependency graph
terraform output                   # print all outputs
terraform output -json redshift_cluster_endpoint

# --- State surgery ---
terraform state mv aws_s3_bucket.old aws_s3_bucket.new
terraform state rm aws_s3_bucket.example           # stop tracking, don't destroy
terraform state pull > state.json                  # download remote state
terraform state push state.json                    # upload local state (dangerous)
terraform import aws_s3_bucket.example my-bucket-name
terraform refresh                                  # sync state with real infra (implicit in plan)

# --- Workspaces (lightweight environment separation) ---
terraform workspace list
terraform workspace new staging
terraform workspace select staging
terraform workspace show

# --- Targeting & scoping ---
terraform plan  -target=module.data_lake
terraform apply -target=aws_glue_crawler.s3_crawler -target=aws_glue_job.etl_job

# --- Debugging ---
TF_LOG=DEBUG terraform apply         # verbose provider/core logs
TF_LOG_PATH=./tf.log terraform apply # write logs to file
terraform providers                  # show required providers and versions
terraform providers lock -platform=linux_amd64   # generate lock file for CI platform
```

---

## 4. 🗂️ Project Structure

### Recommended Layout for a Data Platform

```
data-platform/
├── environments/
│   ├── dev/
│   │   ├── main.tf              # calls modules with dev-specific inputs
│   │   ├── backend.tf           # dev state backend config
│   │   └── terraform.tfvars
│   ├── staging/
│   └── prod/
├── modules/
│   ├── networking/               # VPC, subnets, NAT, endpoints
│   ├── data-lake/                # S3 buckets, lifecycle, encryption
│   ├── data-warehouse/           # Redshift / Snowflake
│   ├── etl-pipeline/             # Glue jobs, crawlers, triggers
│   ├── streaming/                # Kinesis / MSK
│   ├── orchestration/            # MWAA / Step Functions
│   ├── analytics/                # EMR, Athena workgroups
│   └── observability/            # CloudWatch dashboards, alarms, SNS
├── policies/                      # Sentinel / OPA / Checkov policies
├── scripts/                       # helper shell scripts (pre-commit, tfsec runs)
├── tests/                         # Terratest / native `terraform test` files
├── variables.tf                   # root-level shared variables
├── versions.tf                    # provider + terraform version pins
└── README.md
```

### Naming Conventions

- Resources: `<project>-<component>-<environment>` e.g. `acme-data-lake-raw-prod`
- Files: one purpose per file — `s3.tf`, `iam.tf`, `redshift.tf`, `glue.tf` rather than one giant `main.tf`
- Tags: always include `Environment`, `Project`, `Owner`, `ManagedBy = "terraform"`, `CostCenter`, `DataClassification`

---

## 5. 🔒 State Management

### Remote Backend (S3 + DynamoDB Locking)

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket         = "acme-terraform-state"
    key            = "data-platform/prod/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"   # prevents concurrent applies
    kms_key_id     = "arn:aws:kms:us-west-2:123456789012:key/abcd-1234"
  }
}
```

> As of Terraform 1.10+, S3 backends can use **native S3 locking** (`use_lockfile = true`) instead of a separate DynamoDB table. Check your Terraform version before removing DynamoDB locking from an existing pipeline.

### State Bucket Bootstrap (chicken-and-egg problem)

The state bucket itself usually needs to be created _once_, outside the main configuration (manually, via a small bootstrap config with local state, or via a separate `bootstrap/` root module) before the rest of the platform can use it as a backend.

```hcl
# bootstrap/main.tf — run once with local state, then never touched again
resource "aws_s3_bucket" "tf_state" {
  bucket = "acme-terraform-state"
}

resource "aws_s3_bucket_versioning" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_dynamodb_table" "tf_lock" {
  name         = "terraform-state-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }
}
```

### State Hygiene Rules

- **Never** commit `.tfstate` files to version control — they can contain secrets (DB passwords, connection strings) in plaintext.
- Enable **state file encryption** at rest (SSE-KMS on the S3 backend).
- Use **one state file per environment**, not per developer — shared state is what makes Terraform collaborative and safe.
- Mark genuinely sensitive outputs with `sensitive = true` (this redacts CLI output but does **not** encrypt the state file itself).
- Split very large platforms into multiple **state files by domain** (networking, data-lake, warehouse) connected via `terraform_remote_state` data sources, so a bad `apply` in one domain can't touch another.

```hcl
# Reading another state file's outputs
data "terraform_remote_state" "networking" {
  backend = "s3"
  config = {
    bucket = "acme-terraform-state"
    key    = "networking/prod/terraform.tfstate"
    region = "us-west-2"
  }
}

resource "aws_redshift_cluster" "warehouse" {
  # ...
  vpc_security_group_ids = [data.terraform_remote_state.networking.outputs.redshift_sg_id]
}
```

---

## 6. 🗄️ Data Storage Infrastructure

### S3 Data Lake (Raw / Processed / Curated Zones)

```hcl
locals {
  lake_zones = ["raw", "processed", "curated"]
}

resource "aws_s3_bucket" "data_lake" {
  for_each = toset(local.lake_zones)
  bucket   = "${var.project_name}-data-lake-${each.key}-${var.environment}"

  tags = {
    Environment         = var.environment
    Zone                = each.key
    DataClassification  = each.key == "raw" ? "internal" : "confidential"
  }
}

resource "aws_s3_bucket_versioning" "data_lake" {
  for_each = aws_s3_bucket.data_lake
  bucket   = each.value.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data_lake" {
  for_each = aws_s3_bucket.data_lake
  bucket   = each.value.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.data_lake.arn
    }
    bucket_key_enabled = true   # reduces KMS request costs
  }
}

resource "aws_s3_bucket_public_access_block" "data_lake" {
  for_each                = aws_s3_bucket.data_lake
  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "raw_lifecycle" {
  bucket = aws_s3_bucket.data_lake["raw"].id

  rule {
    id     = "transition-and-expire"
    status = "Enabled"

    transition { days = 30  storage_class = "STANDARD_IA" }
    transition { days = 90  storage_class = "GLACIER" }
    transition { days = 365 storage_class = "DEEP_ARCHIVE" }

    noncurrent_version_expiration { noncurrent_days = 90 }
  }
}

# Object Lock for compliance / immutability requirements
resource "aws_s3_bucket_object_lock_configuration" "raw_lock" {
  bucket = aws_s3_bucket.data_lake["raw"].id
  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = 365
    }
  }
}
```

### KMS Key for Data Lake Encryption

```hcl
resource "aws_kms_key" "data_lake" {
  description             = "CMK for data lake encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "data_lake" {
  name          = "alias/${var.project_name}-data-lake"
  target_key_id = aws_kms_key.data_lake.key_id
}
```

### Redshift Data Warehouse

```hcl
resource "aws_redshift_subnet_group" "warehouse" {
  name       = "${var.project_name}-redshift-subnet-group"
  subnet_ids = var.private_subnet_ids
}

resource "aws_redshift_cluster" "warehouse" {
  cluster_identifier = "${var.project_name}-warehouse"
  database_name      = var.redshift_database_name
  master_username    = var.redshift_master_username
  master_password    = var.redshift_master_password   # use Secrets Manager in prod (see §12)
  node_type          = var.redshift_node_type
  cluster_type       = var.redshift_cluster_type
  number_of_nodes    = var.redshift_cluster_type == "multi-node" ? var.redshift_number_of_nodes : null

  db_subnet_group_name   = aws_redshift_subnet_group.warehouse.name
  vpc_security_group_ids = [aws_security_group.redshift.id]

  automated_snapshot_retention_period = 7
  preferred_maintenance_window        = "sun:05:00-sun:06:00"

  encrypted            = true
  kms_key_id           = aws_kms_key.redshift.arn
  enhanced_vpc_routing = true

  logging {
    enable        = true
    log_destination_type = "cloudwatch"
    log_exports   = ["connectionlog", "userlog", "useractivitylog"]
  }

  skip_final_snapshot       = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "${var.project_name}-final-snapshot" : null

  tags = { Purpose = "data-warehouse" }
}

# Concurrency scaling / RA3 managed storage requires ra3.* node types
```

### Redshift Serverless (modern alternative)

```hcl
resource "aws_redshiftserverless_namespace" "warehouse" {
  namespace_name      = "${var.project_name}-ns"
  db_name             = var.redshift_database_name
  admin_username      = var.redshift_master_username
  admin_user_password = var.redshift_master_password
  kms_key_id          = aws_kms_key.redshift.arn
}

resource "aws_redshiftserverless_workgroup" "warehouse" {
  namespace_name     = aws_redshiftserverless_namespace.warehouse.namespace_name
  workgroup_name     = "${var.project_name}-wg"
  base_capacity      = 32   # RPUs
  subnet_ids         = var.private_subnet_ids
  security_group_ids = [aws_security_group.redshift.id]
}
```

### RDS for Metadata / Operational Stores

```hcl
resource "aws_db_subnet_group" "metadata_db" {
  name       = "${var.project_name}-metadata-db-subnet-group"
  subnet_ids = var.private_subnet_ids
}

resource "aws_db_instance" "metadata_db" {
  identifier        = "${var.project_name}-metadata-db"
  engine            = "postgres"
  engine_version    = "16.3"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds.arn

  db_name  = "metadata"
  username = var.db_username
  manage_master_user_password = true   # Terraform delegates password to Secrets Manager

  db_subnet_group_name   = aws_db_subnet_group.metadata_db.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  multi_az            = var.environment == "prod"
  deletion_protection = var.environment == "prod"
  skip_final_snapshot  = var.environment != "prod"

  tags = { Purpose = "metadata-storage" }
}
```

### DynamoDB for High-Throughput Lookups / Feature Stores

```hcl
resource "aws_dynamodb_table" "feature_store" {
  name         = "${var.project_name}-feature-store"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "entity_id"
  range_key    = "feature_timestamp"

  attribute {
    name = "entity_id"
    type = "S"
  }
  attribute {
    name = "feature_timestamp"
    type = "N"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  point_in_time_recovery { enabled = true }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
}
```

---

## 7. ⚙️ Data Processing Infrastructure

### AWS Glue Catalog, Crawler, and ETL Job

```hcl
resource "aws_glue_catalog_database" "data_catalog" {
  name        = "${var.project_name}_data_catalog"
  description = "Data catalog for ${var.project_name}"
}

resource "aws_glue_crawler" "s3_crawler" {
  database_name = aws_glue_catalog_database.data_catalog.name
  name          = "${var.project_name}-s3-crawler"
  role          = aws_iam_role.glue_crawler_role.arn

  s3_target {
    path = "s3://${aws_s3_bucket.data_lake["raw"].bucket}/"
  }

  configuration = jsonencode({
    Version       = 1.0
    CrawlerOutput = { Partitions = { AddOrUpdateBehavior = "InheritFromTable" } }
  })

  schedule = "cron(0 2 * * ? *)"   # daily at 2 AM UTC

  recrawl_policy {
    recrawl_behavior = "CRAWL_NEW_FOLDERS_ONLY"   # cost optimization for large lakes
  }
}

resource "aws_glue_job" "etl_job" {
  name         = "${var.project_name}-etl-job"
  role_arn     = aws_iam_role.glue_job_role.arn
  glue_version = "4.0"
  worker_type  = "G.1X"
  number_of_workers = 2
  max_retries  = 1
  timeout      = 60

  command {
    name            = "glueetl"
    script_location = "s3://${aws_s3_bucket.scripts.bucket}/etl_script.py"
    python_version  = "3"
  }

  default_arguments = {
    "--job-bookmark-option"              = "job-bookmark-enable"
    "--enable-metrics"                   = "true"
    "--enable-continuous-cloudwatch-log" = "true"
    "--enable-spark-ui"                  = "true"
    "--spark-event-logs-path"            = "s3://${aws_s3_bucket.scripts.bucket}/spark-logs/"
    "--TempDir"                          = "s3://${aws_s3_bucket.scripts.bucket}/temp/"
  }

  execution_property {
    max_concurrent_runs = 2
  }
}

# Glue Trigger — event driven, chains crawler -> job
resource "aws_glue_trigger" "on_crawler_success" {
  name = "${var.project_name}-crawler-to-etl"
  type = "CONDITIONAL"

  predicate {
    conditions {
      crawler_name = aws_glue_crawler.s3_crawler.name
      crawl_state  = "SUCCEEDED"
    }
  }

  actions {
    job_name = aws_glue_job.etl_job.name
  }
}
```

### Glue Workflow (chains multiple jobs/crawlers with visual DAG)

```hcl
resource "aws_glue_workflow" "etl_pipeline" {
  name        = "${var.project_name}-workflow"
  description = "Full raw-to-curated pipeline"
}
```

### Lambda for Event-Driven Processing

```hcl
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src/data_processor"
  output_path = "${path.module}/build/data_processor.zip"
}

resource "aws_lambda_function" "data_processor" {
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  function_name    = "${var.project_name}-data-processor"
  role             = aws_iam_role.lambda_role.arn
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  timeout          = 300
  memory_size      = 512

  reserved_concurrent_executions = 10   # prevents runaway concurrency from flooding downstream systems

  environment {
    variables = {
      S3_BUCKET = aws_s3_bucket.data_lake["processed"].bucket
      DB_HOST   = aws_db_instance.metadata_db.address
    }
  }

  dead_letter_config {
    target_arn = aws_sqs_queue.lambda_dlq.arn
  }

  tracing_config { mode = "Active" }   # X-Ray tracing
}

resource "aws_sqs_queue" "lambda_dlq" {
  name                      = "${var.project_name}-lambda-dlq"
  message_retention_seconds = 1209600   # 14 days
}

resource "aws_s3_bucket_notification" "raw_zone_trigger" {
  bucket = aws_s3_bucket.data_lake["raw"].id

  lambda_function {
    lambda_function_arn = aws_lambda_function.data_processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "incoming/"
    filter_suffix       = ".json"
  }

  depends_on = [aws_lambda_permission.allow_s3]
}

resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.data_processor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.data_lake["raw"].arn
}
```

### EventBridge Scheduled Jobs (replaces cron-in-Glue in modern setups)

```hcl
resource "aws_scheduler_schedule" "nightly_etl" {
  name       = "${var.project_name}-nightly-etl"
  group_name = "default"

  flexible_time_window { mode = "OFF" }

  schedule_expression = "cron(0 2 * * ? *)"

  target {
    arn      = aws_glue_job.etl_job.arn
    role_arn = aws_iam_role.scheduler_role.arn
  }
}
```

---

## 8. 🔀 Orchestration

### Managed Airflow (MWAA)

```hcl
resource "aws_mwaa_environment" "orchestrator" {
  name              = "${var.project_name}-airflow"
  airflow_version   = "2.10.1"
  environment_class = "mw1.small"

  source_bucket_arn    = aws_s3_bucket.airflow_dags.arn
  dag_s3_path          = "dags/"
  requirements_s3_path = "requirements.txt"

  execution_role_arn = aws_iam_role.mwaa_execution.arn

  network_configuration {
    security_group_ids = [aws_security_group.mwaa.id]
    subnet_ids          = var.private_subnet_ids
  }

  logging_configuration {
    task_logs { enabled = true log_level = "INFO" }
    dag_processing_logs { enabled = true log_level = "INFO" }
    scheduler_logs { enabled = true log_level = "INFO" }
  }

  webserver_access_mode = "PRIVATE_ONLY"
}
```

### Step Functions for ETL Orchestration

```hcl
resource "aws_sfn_state_machine" "etl_orchestrator" {
  name     = "${var.project_name}-etl-orchestrator"
  role_arn = aws_iam_role.step_functions_role.arn

  definition = jsonencode({
    Comment = "Raw -> Processed -> Curated pipeline"
    StartAt = "RunCrawler"
    States = {
      RunCrawler = {
        Type     = "Task"
        Resource = "arn:aws:states:::aws-sdk:glue:startCrawler"
        Parameters = { Name = aws_glue_crawler.s3_crawler.name }
        Next     = "RunETLJob"
      }
      RunETLJob = {
        Type     = "Task"
        Resource = "arn:aws:states:::glue:startJobRun.sync"
        Parameters = { JobName = aws_glue_job.etl_job.name }
        End      = true
      }
    }
  })
}
```

---

## 9. 📡 Streaming Infrastructure

### Kinesis Data Streams + Firehose

```hcl
resource "aws_kinesis_stream" "data_stream" {
  name             = "${var.project_name}-data-stream"
  shard_count      = var.kinesis_shard_count
  retention_period = 24

  shard_level_metrics = ["IncomingRecords", "OutgoingRecords", "IteratorAgeMilliseconds"]

  stream_mode_details { stream_mode = "PROVISIONED" }   # or "ON_DEMAND" for unpredictable load

  encryption_type = "KMS"
  kms_key_id      = aws_kms_key.kinesis.arn
}

resource "aws_kinesis_firehose_delivery_stream" "to_s3" {
  name        = "${var.project_name}-firehose"
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn   = aws_iam_role.firehose_role.arn
    bucket_arn = aws_s3_bucket.data_lake["raw"].arn
    prefix     = "streaming/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/"
    error_output_prefix = "streaming-errors/!{firehose:error-output-type}/"

    buffering_size     = 5     # MB
    buffering_interval = 300   # seconds
    compression_format = "GZIP"

    dynamic_partitioning_configuration {
      enabled = true
    }

    processing_configuration {
      enabled = true
      processors {
        type = "Lambda"
        parameters {
          parameter_name  = "LambdaArn"
          parameter_value = aws_lambda_function.record_transformer.arn
        }
      }
    }
  }
}
```

### MSK (Managed Kafka) — for teams standardized on Kafka

```hcl
resource "aws_msk_cluster" "kafka" {
  cluster_name           = "${var.project_name}-kafka"
  kafka_version          = "3.7.x"
  number_of_broker_nodes = 3

  broker_node_group_info {
    instance_type   = "kafka.m5.large"
    client_subnets  = var.private_subnet_ids
    security_groups = [aws_security_group.msk.id]
    storage_info {
      ebs_storage_info { volume_size = 100 }
    }
  }

  encryption_info {
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
    encryption_at_rest_kms_key_arn = aws_kms_key.msk.arn
  }

  logging_info {
    broker_logs {
      cloudwatch_logs { enabled = true log_group = aws_cloudwatch_log_group.msk.name }
    }
  }
}
```

---

## 10. 📊 Analytics Infrastructure

### EMR Cluster (Spark / Hadoop / Hive)

```hcl
resource "aws_emr_cluster" "analytics" {
  name          = "${var.project_name}-analytics-cluster"
  release_label = "emr-7.2.0"
  applications  = ["Spark", "Hadoop", "Hive", "JupyterHub"]

  termination_protection            = false
  keep_job_flow_alive_when_no_steps = true
  auto_termination_policy { idle_timeout = 3600 }   # auto-terminate after 1hr idle — cost control

  ec2_attributes {
    subnet_id                         = var.private_subnet_id
    emr_managed_master_security_group = aws_security_group.emr_master.id
    emr_managed_slave_security_group  = aws_security_group.emr_slave.id
    instance_profile                  = aws_iam_instance_profile.emr_profile.arn
    key_name                          = var.key_pair_name
  }

  master_instance_group {
    instance_type = "m5.xlarge"
  }

  core_instance_group {
    instance_type  = "m5.large"
    instance_count = 2
    ebs_config {
      size                 = 40
      type                 = "gp3"
      volumes_per_instance = 1
    }
  }

  # Spot instances for task nodes = large cost savings on non-critical capacity
  task_instance_group {
    instance_type  = "m5.large"
    instance_count = 2
    bid_price      = "0.10"
  }

  service_role = aws_iam_role.emr_service_role.arn

  tags = { Purpose = "big-data-analytics" }
}
```

### EMR Serverless (no cluster management)

```hcl
resource "aws_emrserverless_application" "spark_app" {
  name          = "${var.project_name}-emr-serverless"
  release_label = "emr-7.2.0"
  type          = "SPARK"

  maximum_capacity {
    cpu    = "100 vCPU"
    memory = "1000 GB"
  }

  auto_stop_configuration {
    enabled              = true
    idle_timeout_minutes = 15
  }
}
```

### Athena for Serverless SQL Queries

```hcl
resource "aws_athena_workgroup" "analysts" {
  name = "${var.project_name}-analysts"

  configuration {
    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true

    result_configuration {
      output_location = "s3://${aws_s3_bucket.athena_results.bucket}/"
      encryption_configuration {
        encryption_option = "SSE_KMS"
        kms_key_arn       = aws_kms_key.athena.arn
      }
    }

    bytes_scanned_cutoff_per_query = 10737418240   # 10 GB cap — prevents runaway query costs
  }
}
```

---

## 11. 🌐 Networking and Security

### VPC for the Data Platform

```hcl
resource "aws_vpc" "data_platform" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "${var.project_name}-vpc" }
}

resource "aws_subnet" "private" {
  for_each          = { for idx, cidr in var.private_subnet_cidrs : idx => cidr }
  vpc_id            = aws_vpc.data_platform.id
  cidr_block        = each.value
  availability_zone = var.availability_zones[each.key]

  tags = { Name = "${var.project_name}-private-${each.key + 1}" }
}

resource "aws_subnet" "public" {
  for_each                = { for idx, cidr in var.public_subnet_cidrs : idx => cidr }
  vpc_id                  = aws_vpc.data_platform.id
  cidr_block              = each.value
  availability_zone       = var.availability_zones[each.key]
  map_public_ip_on_launch = true

  tags = { Name = "${var.project_name}-public-${each.key + 1}" }
}

resource "aws_eip" "nat" {
  domain = "vpc"
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = values(aws_subnet.public)[0].id
  tags          = { Name = "${var.project_name}-nat" }
}

# Gateway endpoint (free) for S3 — keeps Glue/EMR/Redshift traffic off the public internet
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.data_platform.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]
}

# Interface endpoint for Glue API calls
resource "aws_vpc_endpoint" "glue" {
  vpc_id              = aws_vpc.data_platform.id
  service_name        = "com.amazonaws.${var.aws_region}.glue"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = values(aws_subnet.private)[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true
}
```

### Security Groups (least privilege, source-referenced not CIDR-based)

```hcl
resource "aws_security_group" "redshift" {
  name_prefix = "${var.project_name}-redshift-"
  vpc_id      = aws_vpc.data_platform.id

  ingress {
    description     = "Analysts and ETL jobs"
    from_port       = 5439
    to_port         = 5439
    protocol        = "tcp"
    security_groups = [aws_security_group.etl_clients.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-redshift-sg" }
}
```

> **Rule of thumb**: reference other security groups (`security_groups = [...]`) instead of CIDR blocks wherever possible. It self-documents intent and survives IP/subnet changes.

---

## 12. 🔑 IAM Roles and Policies

### Glue Job Role — Least Privilege Pattern

```hcl
resource "aws_iam_role" "glue_job_role" {
  name = "${var.project_name}-glue-job-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "glue.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "glue_job_policy" {
  name = "${var.project_name}-glue-job-policy"
  role = aws_iam_role.glue_job_role.id

  # Scope actions to exact resource ARNs — never use Resource = "*" for data actions
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3DataAccess"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = flatten([
          for b in aws_s3_bucket.data_lake : [b.arn, "${b.arn}/*"]
        ])
      },
      {
        Sid      = "KMSDecryptEncrypt"
        Effect   = "Allow"
        Action   = ["kms:Decrypt", "kms:GenerateDataKey"]
        Resource = [aws_kms_key.data_lake.arn]
      },
      {
        Sid      = "CloudWatchLogs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws-glue/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "glue_service_role" {
  role       = aws_iam_role.glue_job_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"
}

data "aws_caller_identity" "current" {}
```

### Secrets Manager Instead of Plaintext Passwords

```hcl
resource "aws_secretsmanager_secret" "redshift_master" {
  name                    = "${var.project_name}/redshift/master-credentials"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "redshift_master" {
  secret_id = aws_secretsmanager_secret.redshift_master.id
  secret_string = jsonencode({
    username = var.redshift_master_username
    password = random_password.redshift.result
  })
}

resource "random_password" "redshift" {
  length  = 24
  special = true
}
```

> Never put real secrets directly in `.tf` or `.tfvars` files that get committed to git. Use `random_password` + Secrets Manager, or pull from an existing secret with a `data "aws_secretsmanager_secret_version"` lookup, or inject via environment variables / `TF_VAR_*` in CI.

### Cross-Account Data Sharing Role (common in data mesh setups)

```hcl
resource "aws_iam_role" "cross_account_reader" {
  name = "${var.project_name}-cross-account-reader"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { AWS = "arn:aws:iam::${var.consumer_account_id}:root" }
      Action    = "sts:AssumeRole"
      Condition = { StringEquals = { "sts:ExternalId" = var.external_id } }
    }]
  })
}
```

---

## 13. 📈 Monitoring and Alerting

```hcl
resource "aws_cloudwatch_metric_alarm" "glue_job_failure" {
  alarm_name          = "${var.project_name}-glue-job-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods   = 1
  metric_name          = "glue.driver.aggregate.numFailedTasks"
  namespace            = "Glue"
  period               = 300
  statistic            = "Sum"
  threshold            = 0
  alarm_actions        = [aws_sns_topic.data_alerts.arn]

  dimensions = { JobName = aws_glue_job.etl_job.name }
}

resource "aws_sns_topic" "data_alerts" {
  name = "${var.project_name}-data-platform-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.data_alerts.arn
  protocol  = "email"
  endpoint  = var.alerts_email
}

resource "aws_cloudwatch_dashboard" "pipeline_health" {
  dashboard_name = "${var.project_name}-pipeline-health"
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [["Glue", "glue.driver.aggregate.numCompletedTasks", "JobName", aws_glue_job.etl_job.name]]
          period  = 300
          title   = "Glue Job Task Completion"
        }
      }
    ]
  })
}
```

---

## 14. 🧮 Variables, Locals, and Outputs

```hcl
# variables.tf
variable "project_name" {
  description = "Name of the data engineering project"
  type        = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,30}$", var.project_name))
    error_message = "project_name must be lowercase alphanumeric/hyphens, 3-31 chars, starting with a letter."
  }
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "redshift_master_password" {
  description = "Master password for Redshift (prefer Secrets Manager in prod)"
  type        = string
  sensitive   = true
  default     = null
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "tags" {
  type    = map(string)
  default = {}
}
```

```hcl
# locals.tf
locals {
  common_tags = merge(var.tags, {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  })

  is_prod           = var.environment == "prod"
  redshift_node_count = local.is_prod ? 3 : 1
}
```

```hcl
# outputs.tf
output "s3_data_lake_buckets" {
  description = "Map of zone name to bucket name"
  value       = { for zone, bucket in aws_s3_bucket.data_lake : zone => bucket.bucket }
}

output "redshift_cluster_endpoint" {
  description = "Redshift cluster connection endpoint"
  value       = aws_redshift_cluster.warehouse.endpoint
  sensitive   = true
}

output "glue_catalog_database_name" {
  value = aws_glue_catalog_database.data_catalog.name
}

output "kinesis_stream_arn" {
  value = aws_kinesis_stream.data_stream.arn
}
```

---

## 15. 📦 Modules

### Module Structure

```
modules/data-lake/
├── main.tf
├── variables.tf
├── outputs.tf
├── versions.tf
└── README.md
```

```hcl
# modules/data-lake/variables.tf
variable "bucket_name" {
  type = string
}
variable "kms_key_arn" {
  type = string
}
variable "tags" {
  type    = map(string)
  default = {}
}
```

```hcl
# modules/data-lake/main.tf
resource "aws_s3_bucket" "this" {
  bucket = var.bucket_name
  tags   = var.tags
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
  }
}
```

```hcl
# modules/data-lake/outputs.tf
output "bucket_name" { value = aws_s3_bucket.this.bucket }
output "bucket_arn"  { value = aws_s3_bucket.this.arn }
```

### Calling the Module

```hcl
module "raw_zone" {
  source      = "./modules/data-lake"
  bucket_name = "${var.project_name}-raw-${var.environment}"
  kms_key_arn = aws_kms_key.data_lake.arn
  tags        = local.common_tags
}

# Registry / Git-sourced modules with version pinning
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8"

  name = "${var.project_name}-vpc"
  cidr = var.vpc_cidr
}

module "internal_glue_module" {
  source = "git::https://github.com/acme/terraform-modules.git//glue-pipeline?ref=v2.3.0"
}
```

### Module Design Guidelines

- Keep modules **single-purpose** (one module = one logical piece of infra: "data lake", "warehouse", "streaming").
- Expose **sensible defaults** but allow every meaningful value to be overridden via variables.
- Never hardcode `provider` blocks inside a reusable module — configure providers in the root and pass through.
- Version internal modules with git tags and pin consumers to `?ref=vX.Y.Z`, never `main`/`master`.
- Document required/optional variables and outputs in each module's `README.md`.

---

## 16. 🌍 Multi-Environment Patterns

### Pattern A: Directory-per-Environment (recommended for data platforms)

```
environments/dev/main.tf      -> module "platform" { source = "../../modules/platform" ; environment = "dev" ; ... }
environments/staging/main.tf  -> module "platform" { source = "../../modules/platform" ; environment = "staging" ; ... }
environments/prod/main.tf     -> module "platform" { source = "../../modules/platform" ; environment = "prod" ; ... }
```

Pros: explicit, separate state files, separate `.tfvars`, safe blast radius, easy to give different teams different approval workflows per environment.

### Pattern B: Terraform Workspaces

```bash
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod
```

```hcl
locals {
  env_config = {
    dev     = { redshift_nodes = 1, kinesis_shards = 1 }
    staging = { redshift_nodes = 2, kinesis_shards = 2 }
    prod    = { redshift_nodes = 3, kinesis_shards = 5 }
  }
  cfg = local.env_config[terraform.workspace]
}
```

Pros: less code duplication. Cons: single codebase can be riskier — a bug affects every environment simultaneously; state is still separate per workspace, but human error switching workspaces is a real risk. **Prefer Pattern A for prod-sensitive data platforms.**

### Example `.tfvars` per Environment

```hcl
# environments/prod/terraform.tfvars
project_name             = "acme-data-platform"
environment              = "prod"
redshift_node_type       = "ra3.xlplus"
redshift_number_of_nodes = 3
kinesis_shard_count      = 5

# environments/dev/terraform.tfvars
project_name             = "acme-data-platform"
environment              = "dev"
redshift_node_type       = "dc2.large"
redshift_number_of_nodes = 1
kinesis_shard_count      = 1
```

---

## 17. ☁️ Multi-Cloud Notes (Azure / GCP)

| Purpose                    | AWS                                             | Azure                                                   | GCP                                              |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| Object storage / data lake | `aws_s3_bucket`                                 | `azurerm_storage_account` + `azurerm_storage_container` | `google_storage_bucket`                          |
| Data warehouse             | `aws_redshift_cluster`                          | `azurerm_synapse_workspace`                             | `google_bigquery_dataset`                        |
| Managed Spark/ETL          | `aws_glue_job`, `aws_emr_cluster`               | `azurerm_databricks_workspace`, `azurerm_data_factory`  | `google_dataproc_cluster`, `google_dataflow_job` |
| Streaming                  | `aws_kinesis_stream`, `aws_msk_cluster`         | `azurerm_eventhub`                                      | `google_pubsub_topic`, `google_dataflow_job`     |
| Orchestration              | `aws_mwaa_environment`, `aws_sfn_state_machine` | `azurerm_data_factory` (pipelines)                      | Cloud Composer (`google_composer_environment`)   |
| Serverless functions       | `aws_lambda_function`                           | `azurerm_function_app`                                  | `google_cloudfunctions2_function`                |
| Managed relational DB      | `aws_db_instance`                               | `azurerm_postgresql_flexible_server`                    | `google_sql_database_instance`                   |
| Secrets                    | `aws_secretsmanager_secret`                     | `azurerm_key_vault_secret`                              | `google_secret_manager_secret`                   |
| IAM role                   | `aws_iam_role`                                  | `azurerm_role_definition` / `azurerm_role_assignment`   | `google_project_iam_member`                      |

```hcl
# Example: GCP BigQuery dataset + GCS bucket
resource "google_storage_bucket" "raw" {
  name     = "${var.project_name}-raw-${var.environment}"
  location = var.gcp_region
  uniform_bucket_level_access = true
}

resource "google_bigquery_dataset" "warehouse" {
  dataset_id = "${var.project_name}_warehouse"
  location   = var.gcp_region
}
```

```hcl
# Example: Azure Data Lake Storage Gen2 + Synapse
resource "azurerm_storage_account" "data_lake" {
  name                     = "${var.project_name}dl${var.environment}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  is_hns_enabled           = true   # enables hierarchical namespace (ADLS Gen2)
}
```

---

## 18. 🧪 Testing Terraform

### Native `terraform test` (built-in since 1.6)

```hcl
# tests/data_lake.tftest.hcl
run "bucket_naming_convention" {
  command = plan

  assert {
    condition     = aws_s3_bucket.data_lake["raw"].bucket == "acme-data-lake-raw-dev"
    error_message = "Raw bucket name does not follow naming convention"
  }
}

run "encryption_enabled" {
  command = apply

  assert {
    condition     = aws_s3_bucket_server_side_encryption_configuration.data_lake["raw"].rule[0].apply_server_side_encryption_by_default[0].sse_algorithm == "aws:kms"
    error_message = "Data lake bucket must use KMS encryption"
  }
}
```

```bash
terraform test
```

### Static Analysis & Policy-as-Code

```bash
tflint                       # linting: unused vars, provider best practices
tfsec .                      # security scanning
checkov -d .                 # security + compliance scanning (CIS benchmarks)
terrascan scan -i terraform  # policy-as-code scanning
```

### Terratest (Go-based integration tests)

```go
func TestDataLakeModule(t *testing.T) {
  opts := &terraform.Options{
    TerraformDir: "../modules/data-lake",
    Vars: map[string]interface{}{
      "bucket_name": "test-bucket-" + strings.ToLower(random.UniqueId()),
    },
  }
  defer terraform.Destroy(t, opts)
  terraform.InitAndApply(t, opts)

  bucketName := terraform.Output(t, opts, "bucket_name")
  aws.AssertS3BucketExists(t, "us-west-2", bucketName)
}
```

---

## 19. 🔁 CI/CD Integration

### GitHub Actions Example

```yaml
name: terraform
on:
  pull_request:
    paths: ["environments/**", "modules/**"]

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.9.5"
      - run: terraform fmt -check -recursive
      - run: terraform -chdir=environments/dev init
      - run: terraform -chdir=environments/dev validate
      - run: tflint --chdir=environments/dev
      - run: checkov -d environments/dev
      - run: terraform -chdir=environments/dev plan -out=plan.tfplan
      - name: Post plan to PR
        run: terraform -chdir=environments/dev show -no-color plan.tfplan

  apply:
    needs: plan
    if: github.ref == 'refs/heads/main'
    environment: production # requires manual approval gate in GitHub
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform -chdir=environments/prod init
      - run: terraform -chdir=environments/prod apply -auto-approve
```

### CI/CD Best Practices

- Run `plan` on every PR, `apply` only on merge to `main` with a manual gate for prod.
- Store cloud credentials as OIDC-federated roles, not long-lived access keys, in your CI provider.
- Pin the exact Terraform and provider versions in CI to match local dev (`versions.tf` + `.terraform.lock.hcl` committed to git).
- Fail the pipeline on `tfsec`/`checkov` high-severity findings before `plan` even runs.
- Comment the plan output back on the PR so reviewers see the diff, not just the code diff.

---

## 20. 💰 Cost Management

```hcl
# Tag everything for cost allocation
provider "aws" {
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      CostCenter  = var.cost_center
    }
  }
}
```

- Use **Infracost** in CI to see a dollar delta on every PR (`infracost breakdown --path .`).
- Prefer **Redshift Serverless / EMR Serverless / Athena** over always-on clusters for spiky or intermittent workloads.
- Set **S3 lifecycle rules** aggressively on raw-zone data that's rarely re-read after processing.
- Use **spot instances** for EMR task nodes and Glue's flexible execution where fault tolerance allows.
- Set `bytes_scanned_cutoff_per_query` on Athena workgroups to cap runaway query costs.
- Right-size Lambda `memory_size` (which also scales CPU) using AWS Lambda Power Tuning rather than guessing.

---

## 21. 🛡️ Security Hardening Checklist

- [ ] All S3 buckets: `block_public_access` enabled, versioning on, SSE-KMS with a dedicated CMK
- [ ] All secrets in Secrets Manager / Parameter Store `SecureString`, never in `.tf`/`.tfvars`
- [ ] `sensitive = true` on any output touching credentials or connection strings
- [ ] IAM policies scoped to explicit resource ARNs, no `Resource = "*"` on data-plane actions
- [ ] Security groups reference other SGs, not `0.0.0.0/0`, for anything except public-facing load balancers
- [ ] VPC endpoints used for S3/Glue/Secrets Manager/KMS so traffic never leaves AWS's network
- [ ] CloudTrail + Config enabled account-wide to detect drift and unauthorized changes outside Terraform
- [ ] State bucket encrypted, versioned, and access-logged; state locking enabled
- [ ] `terraform plan` reviewed by a second person before every prod `apply`
- [ ] Provider and module versions pinned; `.terraform.lock.hcl` committed

---

## 22. 🩺 Troubleshooting

### State Issues

```bash
terraform refresh                                   # sync state with real infra
terraform state rm aws_s3_bucket.example             # stop tracking without destroying
terraform state mv aws_s3_bucket.old aws_s3_bucket.new
terraform import aws_s3_bucket.example my-bucket-name
terraform force-unlock <LOCK_ID>                     # clear a stuck state lock (use carefully)
```

### Dependency Issues

```hcl
# Explicit dependency (use sparingly — prefer implicit references)
resource "aws_s3_bucket_notification" "example" {
  depends_on = [aws_lambda_permission.allow_s3]
}

# Implicit dependency (preferred) — referencing an attribute creates the graph edge automatically
resource "aws_s3_bucket_policy" "policy" {
  bucket = aws_s3_bucket.raw.id
}
```

### Common Errors and Fixes

| Error                                           | Likely Cause                                                                 | Fix                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `Error acquiring the state lock`                | Previous apply crashed / concurrent run                                      | `terraform force-unlock <ID>` after confirming no other apply is running    |
| `Resource already exists`                       | Resource created outside Terraform                                           | `terraform import` it into state                                            |
| `Cycle: resource A -> resource B -> resource A` | Circular dependency                                                          | Break the cycle with a data source lookup or restructure into two applies   |
| `InvalidClientTokenId`                          | Expired/misconfigured credentials                                            | Refresh AWS SSO/STS session or check provider `profile`/`region`            |
| Plan shows unexpected diff every run            | Provider computing a value differently than stored (e.g., JSON key ordering) | Wrap with `jsonencode()` consistently, or add to `lifecycle.ignore_changes` |
| `Error: Provider produced inconsistent result`  | Provider bug or race condition                                               | Pin provider to an older/newer known-good version, retry apply              |

### Validation & Detailed Planning

```bash
terraform validate
terraform plan -detailed-exitcode   # exit code 2 = changes present, useful in CI gating
terraform plan -target=aws_s3_bucket.data_lake
terraform apply -parallelism=5      # throttle concurrent resource operations (useful for rate-limited APIs)
```

---

## 23. 📋 Quick Reference Tables

### Command Cheat Sheet

| Task                 | Command                             |
| -------------------- | ----------------------------------- |
| Init                 | `terraform init`                    |
| Format               | `terraform fmt -recursive`          |
| Validate             | `terraform validate`                |
| Plan                 | `terraform plan -out=plan.tfplan`   |
| Apply                | `terraform apply plan.tfplan`       |
| Destroy one resource | `terraform destroy -target=<addr>`  |
| List state           | `terraform state list`              |
| Import               | `terraform import <addr> <id>`      |
| Show outputs         | `terraform output`                  |
| Switch workspace     | `terraform workspace select <name>` |

### Resource-to-Purpose Map (AWS)

| Data Engineering Need   | Terraform Resource                                                   |
| ----------------------- | -------------------------------------------------------------------- |
| Object storage / lake   | `aws_s3_bucket`, `aws_s3_bucket_lifecycle_configuration`             |
| Data catalog            | `aws_glue_catalog_database`, `aws_glue_crawler`                      |
| Batch ETL               | `aws_glue_job`, `aws_emr_cluster`, `aws_emrserverless_application`   |
| Event-driven processing | `aws_lambda_function`, `aws_s3_bucket_notification`                  |
| Streaming ingest        | `aws_kinesis_stream`, `aws_msk_cluster`                              |
| Streaming delivery      | `aws_kinesis_firehose_delivery_stream`                               |
| Orchestration           | `aws_mwaa_environment`, `aws_sfn_state_machine`, `aws_glue_workflow` |
| Data warehouse          | `aws_redshift_cluster`, `aws_redshiftserverless_workgroup`           |
| Ad-hoc SQL              | `aws_athena_workgroup`                                               |
| Metadata / app DB       | `aws_db_instance`                                                    |
| Fast key-value lookups  | `aws_dynamodb_table`                                                 |
| Secrets                 | `aws_secretsmanager_secret`                                          |
| Encryption              | `aws_kms_key`                                                        |
| Alerting                | `aws_cloudwatch_metric_alarm`, `aws_sns_topic`                       |

### Lifecycle Meta-Argument Cheat Sheet

| Argument                       | Effect                                                                |
| ------------------------------ | --------------------------------------------------------------------- |
| `create_before_destroy = true` | New resource is created before old one is destroyed (avoids downtime) |
| `prevent_destroy = true`       | Blocks `terraform destroy`/replacement of this resource entirely      |
| `ignore_changes = [tags]`      | Terraform stops diffing on the listed attribute(s)                    |
| `replace_triggered_by = [...]` | Forces replacement when a referenced resource/attribute changes       |
