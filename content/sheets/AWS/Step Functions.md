# AWS Step Functions — Data Engineering Cheat Sheet

*Serverless orchestration for multi-step workflows — the coordination layer that ties Glue, EMR, Lambda, and Redshift together into a pipeline.*

---

## Overview

Step Functions is the "conductor" of an AWS-native data pipeline: it decides what runs next, retries failures, and gives you a visual execution history — all without writing your own scheduler/poller. It's the AWS-native alternative to Airflow/MWAA when your orchestration needs are mostly "call these AWS services in sequence/parallel with retry logic."

## When to Use Step Functions (and When Not To)

**Use Step Functions when:**
- Your pipeline is a sequence/DAG of calls to AWS services (Glue, EMR, Lambda, ECS, SNS) and you want native retry/error handling without custom polling code
- You need a visual execution history for debugging and auditing exactly what ran, when, and why it failed
- You want pay-per-transition pricing with zero infrastructure to manage

**Consider alternatives when:**
- You need Python-defined DAGs with a large ecosystem of pre-built operators/hooks, or you're migrating existing Airflow DAGs → use MWAA instead
- Your orchestration logic is trivial (single call, no branching/retry needs) → a direct EventBridge rule may be simpler
- You need complex backfills, dynamic task generation based on external state, or dataset-aware scheduling → Airflow's ecosystem is generally richer here

## Key Concepts

- **State machine:** JSON (Amazon States Language) definition of states and transitions
- **Standard vs. Express workflows:** Standard = long-running (up to 1 year), exactly-once, visual history, priced per state transition; Express = high-volume, at-least-once, cheaper, priced per execution duration
- **Service integrations:** Native calls to Glue, EMR, Lambda, SNS/SQS, ECS without custom polling code
- **Error handling:** `Retry`/`Catch` blocks per state — critical for resilient pipelines
- **Map/Parallel states:** Fan-out over a list of inputs (e.g. process each S3 partition concurrently)
- **Distributed Map:** A Map variant designed for very large fan-outs (up to 10,000 concurrent child workflows) — ideal for per-file S3 processing
- **Callback pattern (`.waitForTaskToken`):** Pause a workflow until an external system (human approval, third-party API) calls back with a token
- **Execution history:** Every state transition, input/output, and error is recorded and viewable in the console — invaluable for post-incident review

## Common Architecture Patterns

**Sequential ETL pipeline:**
`Crawl (Glue)` → `Transform (Glue Job)` → `Load (Lambda → Redshift Data API)` → `Notify (SNS)`, with `Catch` branches routing any failure to an alerting state.

**Fan-out per-partition processing:**
A `Map` state iterates over a list of S3 prefixes (e.g. one per day in a backfill) and runs the same sub-workflow concurrently for each — replacing a hand-rolled loop-and-poll script.

**Human-in-the-loop approval:**
`Run validation Lambda` → `Task with .waitForTaskToken (send approval email)` → pipeline pauses until a reviewer calls `SendTaskSuccess` → `Continue to production load`.

---

## Worked Examples

### Example 1: Simple sequential ETL pipeline
**Scenario:** Crawl, transform, and notify — the smallest useful Step Functions pipeline.
```hcl
resource "aws_sfn_state_machine" "simple_etl" {
  name     = "simple-etl"
  role_arn = aws_iam_role.step_functions.arn
  definition = jsonencode({
    StartAt = "Transform"
    States = {
      Transform = { Type = "Task", Resource = "arn:aws:states:::glue:startJobRun.sync",
                    Parameters = { JobName = "transform-events-job" }, End = true }
    }
  })
}
```
```python
exec_arn = start_execution({"date": "2026-09-03"}, name="simple-etl-2026-09-03")
wait_for_execution(exec_arn)
```

### Example 2: Fan-out backfill across many date partitions
**Scenario:** Reprocess the last 30 days of data concurrently instead of one day at a time.
```hcl
# Map state definition excerpt (embedded in the larger state machine JSON)
# States.ProcessDates = { Type = "Map", ItemsPath = "$.dates", MaxConcurrency = 10, ... }
```
```python
dates = [f"2026-08-{d:02d}" for d in range(1, 31)]
exec_arn = start_execution({"dates": dates}, name="backfill-august-2026")
wait_for_execution(exec_arn)
```

### Example 3: Human approval before a production data release
**Scenario:** A data quality report must be manually approved before curated data is published for BI consumption.
```hcl
# Task state using the callback pattern (excerpt)
# States.AwaitApproval = { Type = "Task", Resource = "arn:aws:states:::sns:publish.waitForTaskToken", HeartbeatSeconds = 3600, ... }
```
```python
# A reviewer's approval tool calls this after checking a dashboard
def approve_release(task_token: str, approved: bool):
    if approved:
        sfn.send_task_success(taskToken=task_token, output=json.dumps({"approved": True}))
    else:
        sfn.send_task_failure(taskToken=task_token, error="Rejected", cause="Data quality concerns")
```

---

## Terraform

```hcl
resource "aws_sfn_state_machine" "etl_pipeline" {
  name     = "daily-etl-pipeline"
  role_arn = aws_iam_role.step_functions.arn
  type     = "STANDARD"

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.sfn_logs.arn}:*"
    include_execution_data = true
    level                   = "ERROR"
  }

  tracing_configuration {
    enabled = true
  }

  definition = jsonencode({
    Comment = "Daily ETL: crawl -> transform -> load"
    StartAt = "CrawlRawData"
    States = {
      CrawlRawData = {
        Type     = "Task"
        Resource = "arn:aws:states:::glue:startCrawler.sync"
        Parameters = {
          Name = aws_glue_crawler.raw_crawler.name
        }
        Next = "RunGlueETL"
      }
      RunGlueETL = {
        Type     = "Task"
        Resource = "arn:aws:states:::glue:startJobRun.sync"
        Parameters = {
          JobName = aws_glue_job.etl_job.name
        }
        Retry = [{
          ErrorEquals     = ["States.TaskFailed"]
          IntervalSeconds = 30
          MaxAttempts     = 2
          BackoffRate     = 2.0
        }]
        Catch = [{
          ErrorEquals = ["States.ALL"]
          Next        = "NotifyFailure"
        }]
        Next = "ProcessPartitions"
      }
      ProcessPartitions = {
        Type           = "Map"
        ItemsPath      = "$.partitions"
        MaxConcurrency = 10
        Iterator = {
          StartAt = "LoadPartition"
          States = {
            LoadPartition = {
              Type     = "Task"
              Resource = aws_lambda_function.redshift_loader.arn
              End      = true
            }
          }
        }
        Next = "NotifySuccess"
      }
      NotifySuccess = {
        Type     = "Task"
        Resource = "arn:aws:states:::sns:publish"
        Parameters = {
          TopicArn = aws_sns_topic.alerts.arn
          Message  = "ETL pipeline completed successfully"
        }
        End = true
      }
      NotifyFailure = {
        Type     = "Task"
        Resource = "arn:aws:states:::sns:publish"
        Parameters = {
          TopicArn = aws_sns_topic.alerts.arn
          "Message.$" = "$.error"
        }
        End = true
      }
    }
  })
}

resource "aws_cloudwatch_log_group" "sfn_logs" {
  name              = "/aws/vendedlogs/states/daily-etl-pipeline"
  retention_in_days = 30
}

# Schedule the pipeline with EventBridge instead of polling
resource "aws_cloudwatch_event_rule" "daily_trigger" {
  name                = "trigger-daily-etl"
  schedule_expression = "cron(0 2 * * ? *)"
}

resource "aws_cloudwatch_event_target" "sfn_target" {
  rule     = aws_cloudwatch_event_rule.daily_trigger.name
  arn      = aws_sfn_state_machine.etl_pipeline.arn
  role_arn = aws_iam_role.eventbridge_sfn.arn
}
```

### AWS CLI Quick Reference
```bash
# Start an execution with input
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:us-east-1:123456789012:stateMachine:daily-etl-pipeline \
  --input '{"date": "2026-09-03"}'

# Check execution status
aws stepfunctions describe-execution --execution-arn <execution-arn>

# List failed executions in the last day
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:us-east-1:123456789012:stateMachine:daily-etl-pipeline \
  --status-filter FAILED

# Get the full execution history (every state transition)
aws stepfunctions get-execution-history --execution-arn <execution-arn>

# Send a task success/failure for a callback-pattern task
aws stepfunctions send-task-success --task-token <token> --output '{"approved": true}'
```

### IaC Best Practices
- Keep the state machine definition in Terraform as `jsonencode()` (as above) so it's version-controlled alongside the resources it orchestrates — avoid pasting raw JSON strings.
- Attach `Retry`/`Catch` to every `Task` state that calls an external service; assume transient failures will happen.
- Use `.sync` service integrations (like `glue:startJobRun.sync`) so Step Functions waits for completion instead of firing-and-forgetting.
- Default to **Standard** workflows for data pipelines (need exactly-once + long duration); reserve **Express** for high-throughput, sub-5-minute event processing.
- Scope the Step Functions IAM role to only the specific Glue jobs/Lambda ARNs it needs to invoke — not `*`.
- Enable `logging_configuration` and `tracing_configuration` — without them you lose most of the debugging value Step Functions otherwise gives you for free.
- Trigger scheduled pipelines via **EventBridge rules** targeting the state machine directly, rather than a Lambda that just calls `start_execution` on a timer.

---

## Python (boto3)

```python
import boto3
import json
import time
from botocore.exceptions import ClientError

sfn = boto3.client("stepfunctions", region_name="us-east-1")

STATE_MACHINE_ARN = "arn:aws:states:us-east-1:123456789012:stateMachine:daily-etl-pipeline"

# Start an execution with input parameters
def start_execution(input_payload: dict, name: str | None = None) -> str:
    kwargs = {
        "stateMachineArn": STATE_MACHINE_ARN,
        "input": json.dumps(input_payload),
    }
    if name:
        kwargs["name"] = name  # unique execution name, useful for idempotency

    response = sfn.start_execution(**kwargs)
    return response["executionArn"]

# Poll an execution until it finishes
def wait_for_execution(execution_arn: str, poll_interval: int = 10) -> str:
    while True:
        response = sfn.describe_execution(executionArn=execution_arn)
        status = response["status"]
        if status != "RUNNING":
            print(f"Execution finished: {status}")
            if status == "FAILED":
                print(f"Error: {response.get('error')}, Cause: {response.get('cause')}")
            return status
        time.sleep(poll_interval)

# List recent executions and their outcomes (useful for a health-check dashboard)
def list_recent_executions(status_filter: str = "FAILED"):
    paginator = sfn.get_paginator("list_executions")
    for page in paginator.paginate(stateMachineArn=STATE_MACHINE_ARN, statusFilter=status_filter):
        for execution in page["executions"]:
            print(execution["name"], execution["status"], execution["startDate"])

# Get the full event history for a failed execution (root-cause debugging)
def get_failure_details(execution_arn: str):
    paginator = sfn.get_paginator("get_execution_history")
    for page in paginator.paginate(executionArn=execution_arn, reverseOrder=True):
        for event in page["events"]:
            if "TaskFailed" in event["type"] or "ExecutionFailed" in event["type"]:
                detail_key = "taskFailedEventDetails" if "taskFailedEventDetails" in event else "executionFailedEventDetails"
                print(event[detail_key])
                return event[detail_key]

# Callback pattern: approve or reject a paused execution
def approve_task(task_token: str, approved: bool):
    if approved:
        sfn.send_task_success(taskToken=task_token, output=json.dumps({"approved": True}))
    else:
        sfn.send_task_failure(taskToken=task_token, error="RejectedByReviewer", cause="Manual review rejected the change")

# Send a heartbeat for a long-running callback task, so Step Functions knows it's still alive
def send_heartbeat(task_token: str):
    sfn.send_task_heartbeat(taskToken=task_token)

# Redrive a failed Standard workflow execution from the point of failure (no full re-run needed)
def redrive_execution(execution_arn: str):
    sfn.redrive_execution(executionArn=execution_arn)

if __name__ == "__main__":
    try:
        exec_arn = start_execution(
            {"date": "2026-09-03", "source_prefix": "raw/events/"},
            name="daily-etl-2026-09-03",
        )
        status = wait_for_execution(exec_arn)
        if status == "FAILED":
            get_failure_details(exec_arn)
    except ClientError as e:
        print(f"Step Functions error: {e.response['Error']['Message']}")
```

### boto3 Tips
- Pass a deterministic `name` (e.g. date-based) to `start_execution` for **idempotency** — Step Functions rejects a duplicate name for a still-running or recently-completed execution, which helps prevent accidental double-runs.
- Use `get_paginator("list_executions")` with `statusFilter="FAILED"` as a simple daily health check you can run from a monitoring Lambda.
- For nested workflows, `states:::states:startExecution.sync:2` lets one state machine call another and wait for it — handy for splitting a huge pipeline into reusable sub-pipelines (mirrors what you'd otherwise do manually with boto3 polling).
- `send_task_success` / `send_task_failure` / `send_task_heartbeat` are for **callback-pattern** tasks — useful when a step needs a human approval or an external system to signal completion.
- Use `redrive_execution` (for Standard workflows) to resume a failed execution from its failure point instead of re-running the whole pipeline from scratch — saves time and avoids reprocessing already-succeeded steps.

---

## Security Best Practices
- Scope the Step Functions execution IAM role narrowly — list specific Glue job ARNs, specific Lambda function ARNs, not `glue:*`/`lambda:*` on `*`.
- Enable **CloudWatch Logs** for the state machine and restrict access to those logs, since execution input/output (which may include sensitive data) is recorded there.
- For callback-pattern tasks, treat the task token like a credential — it grants the ability to resume/fail a specific execution, so don't log it or expose it insecurely.
- If input/output payloads carry PII, consider passing S3 references (paths) between states rather than the raw data itself, and rely on S3's access controls/encryption instead of Step Functions' execution history storage.

## Cost Optimization
- Use **Express workflows** for high-volume, short-duration pipelines (e.g. per-record stream processing) — they're billed by duration and memory rather than per-state-transition, which is much cheaper at high frequency.
- Minimize unnecessary `Pass`/`Wait` states in Standard workflows — each state transition is billed.
- Use `.sync` integrations instead of manual polling loops built from multiple states — fewer transitions, cleaner billing, and less code.
- For very large fan-outs, use **Distributed Map** rather than a regular `Map` state with high concurrency — it's designed and priced for large-scale parallel processing.

## Monitoring & Common Errors
| Symptom | Likely Cause | Fix |
|---|---|---|
| `States.Timeout` | A `.sync` task's underlying job ran longer than the state's `TimeoutSeconds` | Increase timeout or investigate why the underlying Glue/EMR job is slow |
| `States.Runtime` errors on a `Task` | Malformed input path (`$.foo` doesn't exist) or bad `Resource` ARN | Check the execution's input/output in the visual editor; validate `Parameters` paths |
| Execution "succeeds" but downstream data is missing | A `Catch` swallowed an error and routed to a "success-looking" state without alerting | Ensure every `Catch` branch leads to a clearly distinct failure/alert path, not a generic end state |
| Map state partially fails | One or more iterations failed but `MaxConcurrency`/error handling wasn't set per-iteration | Add `Retry`/`Catch` inside the `Iterator`, and check `ResultWriter`/`ToleratedFailurePercentage` for Distributed Map |
| Callback task stuck forever | External system never called `SendTaskSuccess`/`Failure`, and no `HeartbeatSeconds` set | Add a `HeartbeatSeconds` and/or `TimeoutSeconds` to callback tasks so they fail instead of hanging indefinitely |

Monitor `ExecutionsFailed`, `ExecutionsTimedOut`, and `ExecutionThrottled` CloudWatch metrics per state machine; alarm on `ExecutionsFailed > 0` as a baseline pipeline health check.

---

[← Back to index](./00-index.md)
