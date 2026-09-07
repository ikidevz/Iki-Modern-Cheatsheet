# Amazon MWAA (Managed Airflow) — Data Engineering Cheat Sheet

*Fully managed Apache Airflow — for teams that want Python-defined DAGs and the broader Airflow operator ecosystem instead of Step Functions' JSON state machines.*

---

## Overview

MWAA is the choice when you need Airflow's mature scheduling model, huge operator/provider ecosystem, or you're migrating an existing Airflow deployment to AWS without a rewrite. Unlike Step Functions, orchestration logic lives in Python DAG files, and there's a rich ecosystem of community-maintained operators for almost every data tool imaginable.

## When to Use MWAA (and When Not To)

**Use MWAA when:**
- You're migrating an existing Airflow deployment and want to avoid rewriting DAGs
- You need complex scheduling semantics (data-aware scheduling, dynamic task mapping, backfills, SLAs) that Airflow supports natively
- Your team already knows Airflow and values its large operator/provider ecosystem and active community
- You need cross-cloud or hybrid orchestration (calling non-AWS APIs/services) as first-class citizens alongside AWS tasks

**Consider alternatives when:**
- Your orchestration is AWS-native and fairly linear → Step Functions has less operational overhead and no environment to manage
- You want to avoid environment/dependency management entirely → Step Functions is serverless with zero patching
- Cost is a primary concern for light, infrequent workflows → MWAA bills per environment-hour even when idle, whereas Step Functions is pay-per-use

## Key Concepts

- **Environment:** The managed Airflow deployment (webserver, scheduler, workers)
- **DAGs bucket:** An S3 bucket/prefix MWAA polls for `.py` DAG files
- **requirements.txt / plugins.zip:** How you install extra Python packages and custom operators
- **Private vs. public webserver access mode:** Private is standard for production (VPN/Direct Connect/VPC access needed)
- **Environment class:** `mw1.small` / `mw1.medium` / `mw1.large` — sizes the scheduler/worker capacity
- **Worker autoscaling:** `min_workers`/`max_workers` let Celery workers scale with queued task count
- **Connections & Variables:** Airflow's own secrets/config store, which can be backed by Secrets Manager instead of the metadata DB
- **DAG parsing:** MWAA (like all Airflow) periodically re-parses all DAG files — slow/heavy top-level code in a DAG file slows down the whole scheduler

## Common Architecture Patterns

**Multi-system orchestration:**
A single DAG chains a `GlueJobOperator`, an `EmrAddStepsOperator`, an on-prem database check via a custom `PythonOperator`, and a Slack notification — the kind of heterogeneous pipeline Airflow's operator ecosystem handles particularly well.

**Data-aware scheduling:**
Downstream DAGs trigger automatically when an upstream DAG updates a registered **Dataset**, instead of relying purely on fixed cron schedules — useful when pipeline timing varies day to day.

**Migrated on-prem Airflow:**
Existing DAGs, plugins, and `requirements.txt` are moved largely as-is into an MWAA environment's S3 DAGs bucket, with connection strings updated to point at AWS-hosted (Redshift/RDS) resources instead of on-prem systems.

---

## Worked Examples

### Example 1: Basic DAG chaining a crawler and a Glue job
**Scenario:** The simplest useful MWAA DAG — crawl then transform, daily.
```python
with DAG("basic_daily_etl", schedule="0 3 * * *", start_date=datetime(2026, 1, 1), catchup=False) as dag:
    crawl = GlueCrawlerOperator(task_id="crawl", config={"Name": "raw-zone-crawler"})
    transform = GlueJobOperator(task_id="transform", job_name="transform-events-job")
    crawl >> transform
```
```bash
aws mwaa create-cli-token --name data-pipelines-airflow  # then trigger via the CLI endpoint
```

### Example 2: Dataset-aware DAG chaining (no fixed schedule)
**Scenario:** A reporting DAG should only run after the curated events dataset actually updates, not on a fixed clock.
```python
curated_events = Dataset("s3://acme-data-lake-curated/events/")

with DAG("upstream_etl", schedule="0 3 * * *", start_date=datetime(2026,1,1)) as upstream:
    transform = GlueJobOperator(task_id="transform", job_name="transform-events-job", outlets=[curated_events])

with DAG("downstream_report", schedule=[curated_events], start_date=datetime(2026,1,1)) as downstream:
    build_report = PythonOperator(task_id="build_report", python_callable=lambda: print("building report"))
```

### Example 3: Mixed EMR + Glue pipeline with a wait sensor
**Scenario:** Wait for an upstream file, run a heavy EMR Spark step, then a lighter Glue cleanup job.
```python
with DAG("mixed_emr_glue", schedule="0 4 * * *", start_date=datetime(2026,1,1), catchup=False) as dag:
    wait = S3KeySensor(task_id="wait_for_file", bucket_name="acme-data-lake-raw",
                        bucket_key="events/{{ ds }}/_SUCCESS", mode="reschedule")
    create_cluster = EmrCreateJobFlowOperator(task_id="create_cluster", job_flow_overrides={
        "Name": "airflow-triggered-cluster", "Instances": {"InstanceCount": 3}})
    add_steps = EmrAddStepsOperator(task_id="run_spark_job", job_flow_id="{{ task_instance.xcom_pull('create_cluster') }}",
                                     steps=[{"Name": "spark-job", "HadoopJarStep": {"Jar": "command-runner.jar",
                                            "Args": ["spark-submit", "s3://acme-scripts/emr/big_job.py"]}}])
    cleanup = GlueJobOperator(task_id="cleanup", job_name="cleanup-job")
    wait >> create_cluster >> add_steps >> cleanup
```

---

## Terraform

```hcl
resource "aws_mwaa_environment" "airflow" {
  name              = "data-pipelines-airflow"
  airflow_version   = "2.9.2"
  environment_class = "mw1.medium"

  source_bucket_arn        = aws_s3_bucket.airflow_bucket.arn
  dag_s3_path               = "dags/"
  requirements_s3_path      = "requirements.txt"
  plugins_s3_path            = "plugins.zip"
  execution_role_arn        = aws_iam_role.mwaa_execution.arn

  network_configuration {
    security_group_ids = [aws_security_group.mwaa.id]
    subnet_ids          = var.private_subnet_ids # exactly 2, different AZs
  }

  webserver_access_mode = "PRIVATE_ONLY"

  logging_configuration {
    dag_processing_logs {
      enabled   = true
      log_level = "WARNING"
    }
    task_logs {
      enabled   = true
      log_level = "INFO"
    }
    scheduler_logs {
      enabled   = true
      log_level = "WARNING"
    }
    webserver_logs {
      enabled   = true
      log_level = "WARNING"
    }
    worker_logs {
      enabled   = true
      log_level = "INFO"
    }
  }

  min_workers = 1
  max_workers = 5

  airflow_configuration_options = {
    "core.default_task_retries"        = "2"
    "celery.worker_autoscale"           = "5,1"
    "secrets.backend"                   = "airflow.providers.amazon.aws.secrets.secrets_manager.SecretsManagerBackend"
    "secrets.backend_kwargs"            = jsonencode({
      connections_prefix = "airflow/connections"
      variables_prefix    = "airflow/variables"
    })
  }
}

# S3 bucket that holds DAGs/requirements/plugins
resource "aws_s3_bucket" "airflow_bucket" {
  bucket = "my-company-mwaa-dags"
}

resource "aws_s3_bucket_versioning" "airflow_bucket" {
  bucket = aws_s3_bucket.airflow_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}
```

### AWS CLI Quick Reference
```bash
# Check environment status
aws mwaa get-environment --name data-pipelines-airflow --query 'Environment.Status'

# Sync local DAGs to the DAGs bucket (CI/CD does this, not Terraform)
aws s3 sync ./dags s3://my-company-mwaa-dags/dags/ --delete

# Get a CLI token, then trigger a DAG via the Airflow CLI over HTTPS
TOKEN=$(aws mwaa create-cli-token --name data-pipelines-airflow --query 'CliToken' --output text)
HOST=$(aws mwaa create-cli-token --name data-pipelines-airflow --query 'WebServerHostname' --output text)
curl -X POST "https://$HOST/aws_mwaa/cli" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: text/plain" \
  --data-raw "dags trigger daily_etl_pipeline"

# List recent environment update history (useful when a deploy misbehaves)
aws mwaa list-environments
```

### IaC Best Practices
- MWAA **requires exactly two private subnets in two different AZs** with NAT gateway egress — plan your VPC module for this ahead of time.
- Pin `airflow_version` explicitly and test `requirements.txt` upgrades in a lower environment before promoting — dependency conflicts are the #1 MWAA headache.
- Keep DAG files in the same S3 bucket Terraform manages, but let CI/CD (not Terraform) sync individual `.py` files — don't put DAG source in `aws_s3_object` resources (that causes noisy diffs).
- Start with `webserver_access_mode = "PRIVATE_ONLY"` and front it with VPN/SSO — avoid public webserver access in production.
- Size `min_workers`/`max_workers` conservatively at first; MWAA autoscaling reacts slower than Lambda/Fargate, so give it headroom.
- Point Airflow's **secrets backend** at Secrets Manager (`secrets.backend`) so Connections/Variables aren't stored only in the Airflow metadata database.
- Enable all five `logging_configuration` log types — `dag_processing_logs` in particular catches DAG import errors that otherwise fail silently in the UI.

---

## Python (boto3)

MWAA has two Python surfaces: the **DAG code** Airflow itself executes, and **boto3 calls to manage the environment / trigger DAGs from outside** (since MWAA has no public REST endpoint of its own by default — you go through a CLI token, or the newer Airflow REST API if enabled).

### A DAG file (deployed to the DAGs S3 path, run by Airflow — not boto3 directly)

```python
from airflow import DAG
from airflow.providers.amazon.aws.operators.glue import GlueJobOperator
from airflow.providers.amazon.aws.operators.glue_crawler import GlueCrawlerOperator
from airflow.providers.amazon.aws.operators.emr import EmrAddStepsOperator, EmrCreateJobFlowOperator
from airflow.providers.amazon.aws.sensors.s3 import S3KeySensor
from airflow.operators.python import PythonOperator
from airflow.datasets import Dataset
from datetime import datetime, timedelta

default_args = {
    "owner": "data-eng",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
}

curated_events_dataset = Dataset("s3://my-company-data-lake-curated/events/")

with DAG(
    dag_id="daily_etl_pipeline",
    default_args=default_args,
    schedule="0 3 * * *",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["etl", "daily"],
) as dag:

    wait_for_raw_data = S3KeySensor(
        task_id="wait_for_raw_data",
        bucket_name="my-company-data-lake-raw",
        bucket_key="events/{{ ds }}/_SUCCESS",
        timeout=60 * 60,
        poke_interval=60,
        mode="reschedule",  # frees the worker slot while waiting
    )

    crawl = GlueCrawlerOperator(
        task_id="crawl_raw_data",
        config={"Name": "raw-zone-crawler"},
    )

    transform = GlueJobOperator(
        task_id="run_glue_etl",
        job_name="transform-events-job",
        script_args={"--run_date": "{{ ds }}"},
    )

    def validate_row_count(**context):
        # Custom Python logic — e.g. check row counts before publishing "success"
        import boto3
        athena = boto3.client("athena")
        # ... run a validation query, raise if row count is unexpectedly low
        print("Validation passed")

    validate = PythonOperator(
        task_id="validate_output",
        python_callable=validate_row_count,
        outlets=[curated_events_dataset],  # marks this dataset "updated" for downstream DAGs
    )

    wait_for_raw_data >> crawl >> transform >> validate


# A downstream DAG can trigger automatically off the dataset update instead of a fixed schedule:
with DAG(
    dag_id="downstream_reporting",
    schedule=[curated_events_dataset],
    start_date=datetime(2026, 1, 1),
    catchup=False,
) as downstream_dag:
    ...
```

### Managing MWAA from outside (boto3)

```python
import boto3
import requests
from botocore.exceptions import ClientError

mwaa = boto3.client("mwaa", region_name="us-east-1")

ENVIRONMENT_NAME = "data-pipelines-airflow"

# MWAA has no direct REST API for DAGs by default — you request a short-lived CLI token,
# then call the Airflow CLI over HTTPS with it.
def trigger_dag(dag_id: str, conf: dict | None = None):
    response = mwaa.create_cli_token(Name=ENVIRONMENT_NAME)
    web_token = response["CliToken"]
    hostname = response["WebServerHostname"]

    command = f"dags trigger {dag_id}"
    if conf:
        import json
        command += f" --conf '{json.dumps(conf)}'"

    cli_response = requests.post(
        f"https://{hostname}/aws_mwaa/cli",
        headers={
            "Authorization": f"Bearer {web_token}",
            "Content-Type": "text/plain",
        },
        data=command,
    )
    print(cli_response.json())

# Check environment health before relying on it (e.g. in a CI/CD gate)
def get_environment_status() -> str:
    response = mwaa.get_environment(Name=ENVIRONMENT_NAME)
    return response["Environment"]["Status"]

# List DAG run status via the CLI token approach (no native boto3 call exists for this)
def get_dag_state(dag_id: str, execution_date: str):
    response = mwaa.create_cli_token(Name=ENVIRONMENT_NAME)
    web_token = response["CliToken"]
    hostname = response["WebServerHostname"]

    cli_response = requests.post(
        f"https://{hostname}/aws_mwaa/cli",
        headers={"Authorization": f"Bearer {web_token}", "Content-Type": "text/plain"},
        data=f"dags state {dag_id} {execution_date}",
    )
    return cli_response.json()

if __name__ == "__main__":
    try:
        if get_environment_status() == "AVAILABLE":
            trigger_dag("daily_etl_pipeline", conf={"run_date": "2026-09-03"})
    except ClientError as e:
        print(f"MWAA error: {e.response['Error']['Message']}")
```

### boto3 Tips
- MWAA doesn't expose the Airflow REST API publicly by default — `create_cli_token` + a POST to `/aws_mwaa/cli` is the standard way to trigger DAGs or run CLI commands from outside. Newer MWAA environments can alternatively enable the **Airflow REST API** directly, which is simpler if available in your version — check current MWAA documentation, since this capability has been expanding.
- `create_cli_token` tokens are short-lived (minutes) — generate one right before use, don't cache it.
- Use `get_environment()` in deployment pipelines as a readiness gate before syncing new DAGs or declaring a deploy successful.
- For DAG code itself, prefer the `apache-airflow-providers-amazon` operators (`GlueJobOperator`, `EmrAddStepsOperator`, `S3KeySensor`, etc.) over raw boto3 calls inside `PythonOperator` — they come with built-in retries, logging, and Airflow UI visibility.
- Use `mode="reschedule"` on sensors (like `S3KeySensor`) instead of the default `mode="poke"` — it frees the worker slot between checks, which matters a lot when workers are a scarce, billed resource.

---

## Security Best Practices
- Keep `webserver_access_mode = "PRIVATE_ONLY"` in production and require VPN/Direct Connect/SSO-fronted access to the Airflow UI.
- Route Airflow **Connections and Variables** through the Secrets Manager backend (`secrets.backend`) rather than storing credentials in the Airflow metadata database or DAG code.
- Scope the MWAA execution role narrowly to the specific S3 buckets, Glue jobs, and EMR clusters your DAGs actually touch.
- Enable all MWAA log types and route them to a restricted-access log group — DAG code (and its logs) can inadvertently include sensitive data if not careful.
- Review third-party provider packages in `requirements.txt` for supply-chain risk before installing — they run with the same execution role as your DAGs.

## Cost Optimization
- MWAA bills per environment-hour regardless of DAG activity — for light or infrequent workflows, compare against Step Functions' pay-per-use model before committing to MWAA.
- Start with the smallest `environment_class` (`mw1.small`) and scale up only if scheduler/webserver metrics show strain — over-provisioning is a common default mistake.
- Tune `min_workers`/`max_workers` to your actual concurrent task load; idle workers still incur cost.
- Use `mode="reschedule"` on long-waiting sensors instead of `mode="poke"` to avoid tying up (and needing more) worker capacity.
- Consolidate very small, infrequent DAGs into fewer environments where possible — running multiple near-idle MWAA environments multiplies the fixed environment-hour cost.

## Monitoring & Common Errors
| Symptom | Likely Cause | Fix |
|---|---|---|
| DAG doesn't appear in the UI | Python import error in the DAG file | Check `dag_processing_logs` in CloudWatch — import errors are logged there, not in task logs |
| Tasks stuck in `queued` | Worker capacity exhausted | Increase `max_workers`, check `celery.worker_autoscale`, or reduce concurrent DAG/task load |
| `requirements.txt` install fails silently | An incompatible or unavailable package version referenced | Check the environment's `requirements_s3_path` install logs; pin compatible versions tested against the MWAA constraints file for your Airflow version |
| Sensor tasks consume all worker slots | Sensors running in default `mode="poke"` | Switch to `mode="reschedule"` |
| Webserver unreachable | Private access mode without VPN/proper networking configured | Verify VPN/Direct Connect routes to the private subnets, or security group rules |

Monitor scheduler heartbeat, `SchedulerHeartbeat` and queued-task-count CloudWatch metrics, and set alarms on DAG-level SLA misses (`sla_miss_callback` in DAG code) for pipelines with hard delivery deadlines.

---

[← Back to index](./00-index.md)
