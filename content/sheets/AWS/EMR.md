# Amazon EMR — Data Engineering Cheat Sheet

_Managed Hadoop/Spark/Hive/Presto clusters for large-scale distributed processing, plus EMR Serverless for a no-cluster-management option._

---

## Overview

EMR is the go-to for Spark/Hadoop workloads too large or too custom for Glue's managed Spark environment — heavy transformations, ML feature pipelines, or migrations from on-prem Hadoop. It gives you far more control over cluster configuration, instance types, and the software stack than Glue does.

## When to Use EMR (and When Not To)

**Use EMR when:**

- You need fine-grained control over Spark/Hadoop configuration, custom JARs, or a specific ecosystem tool (Hive, Presto/Trino, HBase, Flink)
- Jobs are large enough that instance-type and Spot-mix optimization meaningfully affects cost
- You're migrating an existing on-prem Hadoop/Spark workload with minimal rewrite
- You need long-running interactive clusters for notebooks (EMR Studio) shared by a data science team

**Consider alternatives when:**

- Your ETL is a standard Spark job with no special tuning needs → Glue is less operational overhead
- You want zero cluster management and pay-per-use billing → EMR Serverless
- The job is small/simple enough for Lambda → use Lambda instead

## Key Concepts

- **Instance groups vs. instance fleets:** Fleets let you mix instance types and Spot/On-Demand automatically
- **EMR Serverless:** Pay per vCPU/memory-second, no cluster to size or manage — good default for batch Spark jobs
- **Steps:** Discrete units of work (a Spark/Hive job) submitted to a running or transient cluster
- **Bootstrap actions:** Scripts that run on every node at cluster launch (install libraries, tune configs)
- **EMRFS:** S3 as the Hadoop-compatible filesystem, with consistent view options
- **EMR on EKS:** Run Spark jobs on an existing Kubernetes cluster instead of dedicated EMR instances
- **Managed Scaling:** EMR automatically adds/removes core and task nodes based on workload
- **EMR Studio:** Managed Jupyter-based notebook environment for interactive Spark development

## Common Architecture Patterns

**Transient batch cluster:**
`EventBridge schedule` → `run_job_flow (Spark step)` → cluster processes and self-terminates → `S3 (curated)` — the most common, cost-efficient pattern for nightly batch ETL.

**Long-running interactive cluster:**
Persistent EMR cluster + EMR Studio notebooks for a data science team doing exploratory analysis on large datasets — traded off against the always-on cost.

**Spot-heavy cost optimization:**
Master node on On-Demand (never interrupted), core nodes a mix of On-Demand (baseline), task nodes 100% Spot (elastic burst capacity) — Spark's resilience to executor loss makes this a very common, safe pattern.

---

## Worked Examples

### Example 1: One-shot transient cluster for a nightly Spark job

**Scenario:** A heavy join/aggregation job runs once a night and should not leave any infrastructure running afterward.

```hcl
resource "aws_emr_cluster" "nightly_batch" {
  name          = "nightly-aggregation"
  release_label = "emr-7.1.0"
  applications  = ["Spark"]
  core_instance_group { instance_type = "m6g.xlarge", instance_count = 4 }
  master_instance_group { instance_type = "m6g.xlarge" }
  service_role  = aws_iam_role.emr_service.arn
  step { name = "aggregate", action_on_failure = "TERMINATE_CLUSTER"
    hadoop_jar_step { jar = "command-runner.jar", args = ["spark-submit", "s3://acme-scripts/emr/aggregate.py"] } }
}
```

```python
cluster_id = run_transient_cluster("s3://acme-scripts/emr/aggregate.py")
state = wait_for_cluster(cluster_id)
assert state == "TERMINATED"
```

### Example 2: EMR Serverless for unpredictable batch sizes

**Scenario:** Job input size varies wildly day to day (10 GB to 2 TB); you don't want to hand-tune cluster sizing.

```hcl
resource "aws_emrserverless_application" "variable_batch" {
  name          = "variable-batch-etl"
  release_label = "emr-7.1.0"
  type          = "SPARK"
  maximum_capacity { cpu = "400 vCPU", memory = "1000 GB" }
  auto_stop_configuration { enabled = true, idle_timeout_minutes = 10 }
}
```

```python
result = run_emr_serverless_job(
    application_id=aws_emrserverless_application_id,
    execution_role_arn="arn:aws:iam::123456789012:role/emr-serverless-role",
    entry_point="s3://acme-scripts/emr/etl_job.py",
)
print(result["state"])
```

### Example 3: Spot-heavy cost-optimized cluster for fault-tolerant workloads

**Scenario:** A large backfill job can tolerate occasional executor loss; you want to minimize cost aggressively.

```hcl
resource "aws_emr_cluster" "spot_backfill" {
  name          = "spot-backfill-cluster"
  release_label = "emr-7.1.0"
  applications  = ["Spark"]
  master_instance_group { instance_type = "m6g.xlarge" } # On-Demand — never interrupted
  core_instance_group   { instance_type = "m6g.xlarge", instance_count = 2, bid_price = "0.15" }
  service_role = aws_iam_role.emr_service.arn
}
```

```python
# Add a task instance fleet (100% Spot) programmatically for extra burst capacity
emr.add_instance_fleet(ClusterId=cluster_id, InstanceFleet={
    "InstanceFleetType": "TASK",
    "TargetSpotCapacity": 10,
    "InstanceTypeConfigs": [{"InstanceType": "m6g.xlarge"}],
})
```

---

## Terraform

```hcl
resource "aws_emr_cluster" "spark_cluster" {
  name          = "batch-etl-cluster"
  release_label = "emr-7.1.0"
  applications  = ["Spark", "Hive"]

  ec2_attributes {
    subnet_id                         = var.private_subnet_id
    instance_profile                  = aws_iam_instance_profile.emr_ec2.arn
    emr_managed_master_security_group = aws_security_group.emr_master.id
    emr_managed_slave_security_group  = aws_security_group.emr_slave.id
  }

  master_instance_group {
    instance_type = "m6g.xlarge"
  }

  core_instance_group {
    instance_type  = "m6g.xlarge"
    instance_count = 3
    bid_price      = "0.20" # Spot pricing for cost savings
  }

  # Task instance fleet for elastic, mostly-Spot burst capacity
  master_instance_fleet {
    instance_type_configs {
      instance_type = "m6g.xlarge"
    }
    target_on_demand_capacity = 1
  }

  service_role = aws_iam_role.emr_service.arn

  auto_termination_policy {
    idle_timeout = 3600 # terminate after 1hr idle
  }

  managed_scaling_policy {
    compute_limits {
      unit_type              = "Instances"
      minimum_capacity_units = 3
      maximum_capacity_units = 20
    }
  }

  bootstrap_action {
    name = "install-python-deps"
    path = "s3://my-company-scripts/emr/bootstrap.sh"
  }

  configurations_json = jsonencode([
    {
      Classification = "spark-defaults"
      Properties = {
        "spark.dynamicAllocation.enabled" = "true"
        "spark.sql.shuffle.partitions"     = "200"
      }
    }
  ])

  step {
    name              = "run-etl-job"
    action_on_failure = "TERMINATE_CLUSTER"

    hadoop_jar_step {
      jar  = "command-runner.jar"
      args = ["spark-submit", "s3://my-company-scripts/emr/etl_job.py"]
    }
  }

  log_uri = "s3://my-company-scripts/emr/logs/"
}

# Lower-ops alternative: EMR Serverless
resource "aws_emrserverless_application" "spark_app" {
  name          = "etl-serverless"
  release_label = "emr-7.1.0"
  type          = "SPARK"

  maximum_capacity {
    cpu    = "200 vCPU"
    memory = "500 GB"
  }

  auto_start_configuration {
    enabled = true
  }

  auto_stop_configuration {
    enabled              = true
    idle_timeout_minutes = 15
  }
}
```

### AWS CLI Quick Reference

```bash
# Launch a transient cluster with an inline step
aws emr create-cluster --name "cli-etl-cluster" --release-label emr-7.1.0 \
  --applications Name=Spark --instance-type m6g.xlarge --instance-count 3 \
  --use-default-roles --auto-terminate \
  --steps Type=Spark,Args=[s3://my-company-scripts/emr/etl_job.py]

# Add a step to an already-running cluster
aws emr add-steps --cluster-id j-XXXXXXXXXXXXX \
  --steps Type=Spark,Args=[s3://my-company-scripts/emr/etl_job.py]

# Check cluster status
aws emr describe-cluster --cluster-id j-XXXXXXXXXXXXX --query 'Cluster.Status.State'

# List steps and their status
aws emr list-steps --cluster-id j-XXXXXXXXXXXXX

# Submit a job to EMR Serverless
aws emr-serverless start-job-run --application-id 00abc123 --execution-role-arn arn:aws:iam::123456789012:role/emr-serverless-role \
  --job-driver '{"sparkSubmit": {"entryPoint": "s3://my-company-scripts/emr/etl_job.py"}}'
```

### IaC Best Practices

- Prefer **transient clusters** (spin up → run steps → auto-terminate) over long-running clusters for batch ETL; it's cheaper and reduces drift.
- Use `auto_termination_policy` or set `keep_job_flow_alive_when_no_steps = false` so idle clusters don't burn budget.
- Mix Spot (core/task nodes) with On-Demand (master node) for cost savings without risking job failure.
- For new projects, evaluate **EMR Serverless** first — it removes instance sizing and Spot-management complexity entirely.
- Externalize Spark job code/configs to S3 and pass them as step arguments — don't bake logic into bootstrap scripts.
- Set `managed_scaling_policy` instead of fixed `core_instance_group` counts when workload size varies run to run.
- Always set `log_uri` — without it, debugging a failed transient cluster after it terminates is much harder.

---

## Python (boto3)

```python
import boto3
import time
from botocore.exceptions import ClientError

emr = boto3.client("emr", region_name="us-east-1")

# Launch a transient cluster that runs one step then terminates
def run_transient_cluster(script_path: str) -> str:
    response = emr.run_job_flow(
        Name="on-demand-etl-cluster",
        ReleaseLabel="emr-7.1.0",
        Applications=[{"Name": "Spark"}],
        Instances={
            "InstanceGroups": [
                {
                    "Name": "Master",
                    "InstanceRole": "MASTER",
                    "InstanceType": "m6g.xlarge",
                    "InstanceCount": 1,
                },
                {
                    "Name": "Core",
                    "InstanceRole": "CORE",
                    "InstanceType": "m6g.xlarge",
                    "InstanceCount": 2,
                    "BidPrice": "0.20",
                },
            ],
            "Ec2SubnetId": "subnet-0123456789abcdef0",
            "KeepJobFlowAliveWhenNoSteps": False,
            "TerminationProtected": False,
        },
        Steps=[
            {
                "Name": "run-etl-job",
                "ActionOnFailure": "TERMINATE_CLUSTER",
                "HadoopJarStep": {
                    "Jar": "command-runner.jar",
                    "Args": ["spark-submit", script_path],
                },
            }
        ],
        LogUri="s3://my-company-scripts/emr/logs/",
        ServiceRole="EMR_DefaultRole",
        JobFlowRole="EMR_EC2_DefaultRole",
    )
    return response["JobFlowId"]

# Add a step to an existing, already-running cluster
def add_step(cluster_id: str, script_path: str) -> str:
    response = emr.add_job_flow_steps(
        JobFlowId=cluster_id,
        Steps=[
            {
                "Name": "additional-transform",
                "ActionOnFailure": "CONTINUE",
                "HadoopJarStep": {
                    "Jar": "command-runner.jar",
                    "Args": ["spark-submit", script_path],
                },
            }
        ],
    )
    return response["StepIds"][0]

# Poll a specific step until it completes (finer-grained than polling the whole cluster)
def wait_for_step(cluster_id: str, step_id: str, poll_interval: int = 20):
    while True:
        response = emr.describe_step(ClusterId=cluster_id, StepId=step_id)
        state = response["Step"]["Status"]["State"]
        print(f"Step state: {state}")
        if state in ("COMPLETED", "FAILED", "CANCELLED", "INTERRUPTED"):
            return state
        time.sleep(poll_interval)

# Poll cluster state until it terminates
def wait_for_cluster(cluster_id: str, poll_interval: int = 30):
    while True:
        response = emr.describe_cluster(ClusterId=cluster_id)
        state = response["Cluster"]["Status"]["State"]
        print(f"Cluster state: {state}")
        if state in ("TERMINATED", "TERMINATED_WITH_ERRORS"):
            return state
        time.sleep(poll_interval)

# EMR Serverless: submit and monitor a job run
def run_emr_serverless_job(application_id: str, execution_role_arn: str, entry_point: str) -> dict:
    emr_serverless = boto3.client("emr-serverless", region_name="us-east-1")
    response = emr_serverless.start_job_run(
        applicationId=application_id,
        executionRoleArn=execution_role_arn,
        jobDriver={"sparkSubmit": {"entryPoint": entry_point}},
    )
    job_run_id = response["jobRunId"]

    while True:
        status = emr_serverless.get_job_run(applicationId=application_id, jobRunId=job_run_id)
        state = status["jobRun"]["state"]
        if state in ("SUCCESS", "FAILED", "CANCELLED"):
            return status["jobRun"]
        time.sleep(15)

if __name__ == "__main__":
    try:
        cluster_id = run_transient_cluster("s3://my-company-scripts/emr/etl_job.py")
        wait_for_cluster(cluster_id)
    except ClientError as e:
        print(f"EMR error: {e.response['Error']['Message']}")
```

### boto3 Tips

- `run_job_flow` is the call that both creates the cluster _and_ accepts initial `Steps` — you don't need a separate "create then add step" round trip for a simple transient job.
- Use `KeepJobFlowAliveWhenNoSteps=False` for one-shot batch jobs so the cluster self-terminates after the step completes.
- For EMR Serverless, use the `emr-serverless` client (`start_job_run`, `get_job_run`) instead — a different API from classic EMR.
- Wrap cluster creation/polling in Step Functions rather than a long-running Lambda — Lambda's 15-minute timeout is too short for most EMR job durations.
- Poll `describe_step` rather than `describe_cluster` when a cluster runs multiple steps — you get failure detail (e.g. stack trace pointer in `FailureDetails`) per step instead of just the aggregate cluster state.

---

## Security Best Practices

- Use `emr_managed_master_security_group` / `emr_managed_slave_security_group` (or fully custom ones) scoped to only the traffic EMR needs — don't open cluster nodes to `0.0.0.0/0`.
- Enable **EMRFS encryption** for S3 reads/writes and enable **in-transit + at-rest encryption** (`aws_emr_security_configuration`) for sensitive workloads.
- Use IAM roles per cluster (`JobFlowRole`, `ServiceRole`) scoped to the specific S3 prefixes and Glue Catalog databases the job needs.
- Place clusters in private subnets; use VPC endpoints for S3/Glue so cluster traffic doesn't traverse the public internet.
- If using EMR Studio/notebooks, restrict access via IAM + SSO rather than shared credentials.

## Cost Optimization

- Use **transient clusters** with `auto_termination_policy` — the single biggest EMR cost lever is not leaving clusters running idle.
- Mix Spot instances for core/task nodes; Spark's task-level retry tolerates executor loss well, making Spot safe for most batch workloads.
- Enable **Managed Scaling** instead of fixed instance counts so clusters right-size to actual data volume per run.
- For spiky or unpredictable workloads, default to **EMR Serverless** — it bills per-second of actual vCPU/memory use with `auto_stop_configuration`, removing idle-cluster risk entirely.
- Use Graviton-based instance types (`m6g`, `r6g`) where your Spark/Hadoop version supports ARM — meaningfully cheaper for the same throughput.

## Monitoring & Common Errors

| Symptom                                                                                 | Likely Cause                                                                     | Fix                                                                                                     |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Step fails immediately with `ActionOnFailure: TERMINATE_CLUSTER` and cluster disappears | Script path unreachable, or IAM role lacks S3 read on script                     | Check `LogUri` in S3 for the step's stderr before the cluster is gone; verify `JobFlowRole` permissions |
| Job runs slowly despite big cluster                                                     | Data skew, too many small files, or `spark.sql.shuffle.partitions` misconfigured | Check Spark UI/History Server; repartition data; tune shuffle partitions                                |
| Spot core nodes reclaimed mid-job                                                       | Spot capacity unavailable at bid price                                           | Use instance fleets with multiple instance types/AZs instead of a single Spot pool                      |
| `Class not found` errors on job submission                                              | JAR/dependency not on the cluster classpath                                      | Add via bootstrap action or `spark-submit --jars`, or bake into a custom AMI                            |
| Cluster stuck in `STARTING`                                                             | Subnet has no route to internet/NAT for bootstrap downloads                      | Verify subnet route table and NAT gateway, or use VPC endpoints                                         |

Enable the **EMR Persistent History Server** or an S3 `log_uri` so you can inspect Spark UI/logs after a transient cluster terminates — this is the single most useful debugging tool for EMR job failures.
