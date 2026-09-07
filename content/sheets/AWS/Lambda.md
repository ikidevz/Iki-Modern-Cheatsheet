# AWS Lambda — Data Engineering Cheat Sheet

*Event-driven serverless compute — the glue code of a data platform (file-arrival triggers, light transforms, orchestration helpers, API-based ingestion).*

---

## Overview

Lambda fills the gaps between the bigger data services: reacting to an S3 upload, calling the Redshift Data API, kicking off a Step Functions execution, or doing a lightweight transform that doesn't justify spinning up Glue/EMR.

## When to Use Lambda (and When Not To)

**Use Lambda when:**
- The work is triggered by a discrete event (file arrival, stream record, API call, schedule) and completes quickly
- The transform is lightweight (parsing, validation, small reshaping, calling another AWS API)
- You need glue logic between services (e.g. "when Glue job finishes, notify Slack and update a DynamoDB status table")

**Consider alternatives when:**
- The job may run longer than 15 minutes → use Glue, EMR, or Fargate instead
- The transform is CPU/memory-heavy over large datasets → use Glue/EMR/Spark instead
- You need persistent, stateful, low-latency compute → use Fargate/ECS or EC2 instead

## Key Concepts

- **Event sources:** S3, Kinesis, DynamoDB Streams, EventBridge, SQS, Step Functions
- **Layers:** Share common dependencies (e.g. `pandas`, `pyarrow`) across functions
- **Concurrency limits:** Reserved vs. provisioned concurrency to control cost/cold starts
- **Timeout ceiling:** 15 minutes max — not suited for long-running ETL (use Glue/EMR instead)
- **Event source mapping:** Required for pull-based sources like Kinesis/DynamoDB Streams
- **Cold starts:** Extra latency on the first invocation of a new execution environment; mitigated by provisioned concurrency
- **Destinations:** Route async invocation success/failure to SQS, SNS, EventBridge, or another Lambda without custom error-handling code
- **Lambda Extensions:** Attach observability/security agents (e.g. Datadog, Lumigo) alongside your function code
- **Container image support:** Package Lambda as a container (up to 10 GB) instead of a zip — useful for heavier dependencies like `pandas`/`numpy`/ML libraries

## Common Architecture Patterns

**S3-triggered validation/routing:**
`S3 raw/` → `Lambda (validate schema, route by type)` → good records to `S3 staging/`, bad records to `S3 quarantine/` + SNS alert.

**Fan-out via SQS:**
`Lambda` → `SQS` → many parallel `Lambda` consumers — decouples producer speed from consumer capacity, adds retry/DLQ semantics for free.

**Micro-orchestration helper inside Step Functions:**
A `Task` state in Step Functions calls a small Lambda to do something no native service integration covers (e.g. a custom API call, a bespoke validation check) before continuing the workflow.

---

## Worked Examples

### Example 1: S3-triggered schema validator
**Scenario:** Reject malformed files before they reach the Glue catalog, routing bad files to a quarantine prefix.
```hcl
resource "aws_lambda_function" "schema_validator" {
  function_name = "validate-incoming-schema"
  handler       = "validator.handler"
  runtime       = "python3.12"
  role          = aws_iam_role.lambda_exec.arn
  filename      = data.archive_file.validator_zip.output_path
}
```
```python
def handler(event, context):
    for record in event["Records"]:
        key = record["s3"]["object"]["key"]
        obj = s3.get_object(Bucket=record["s3"]["bucket"]["name"], Key=key)
        if not is_valid_schema(obj["Body"].read()):
            s3.copy_object(Bucket="acme-data-lake-raw", CopySource={"Bucket": "acme-data-lake-raw", "Key": key},
                            Key=key.replace("raw/", "quarantine/"))
```

### Example 2: Kinesis stream consumer writing aggregates to DynamoDB
**Scenario:** Maintain a running per-minute event count for a real-time dashboard.
```hcl
resource "aws_lambda_event_source_mapping" "kinesis_to_lambda" {
  event_source_arn  = aws_kinesis_stream.clickstream.arn
  function_name     = aws_lambda_function.minute_aggregator.arn
  starting_position = "LATEST"
  batch_size        = 200
}
```
```python
def handler(event, context):
    counts = {}
    for record in event["Records"]:
        payload = json.loads(base64.b64decode(record["kinesis"]["data"]))
        minute = payload["timestamp"][:16]
        counts[minute] = counts.get(minute, 0) + 1
    for minute, count in counts.items():
        dynamodb.update_item(TableName="minute_counts", Key={"minute": {"S": minute}},
                              UpdateExpression="ADD event_count :c", ExpressionAttributeValues={":c": {"N": str(count)}})
```

### Example 3: Custom validation step inside a Step Functions pipeline
**Scenario:** A Step Functions `Task` state needs a bespoke row-count check that no native service integration covers.
```hcl
resource "aws_lambda_function" "row_count_check" {
  function_name = "validate-row-count"
  handler       = "check.handler"
  runtime       = "python3.12"
  role          = aws_iam_role.lambda_exec.arn
  filename      = data.archive_file.check_zip.output_path
}
```
```python
def handler(event, context):
    result = run_athena_query(f"SELECT COUNT(*) as cnt FROM events WHERE event_date = '{event['date']}'", "curated_db")
    row_count = int(results_to_dicts(result)[0]["cnt"])
    if row_count < event["expected_minimum"]:
        raise ValueError(f"Row count {row_count} below expected minimum {event['expected_minimum']}")
    return {"row_count": row_count, "status": "passed"}
```

---

## Terraform

```hcl
resource "aws_lambda_function" "s3_trigger_processor" {
  function_name = "process-new-s3-object"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "handler.lambda_handler"
  runtime       = "python3.12"
  timeout       = 60
  memory_size   = 512

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      TARGET_DATABASE = "curated_db"
      LOG_LEVEL        = "INFO"
    }
  }

  layers = [aws_lambda_layer_version.data_deps.arn]

  reserved_concurrent_executions = 20

  dead_letter_config {
    target_arn = aws_sqs_queue.lambda_dlq.arn
  }

  tracing_config {
    mode = "Active" # X-Ray tracing
  }
}

resource "aws_lambda_function_event_invoke_config" "async_config" {
  function_name = aws_lambda_function.s3_trigger_processor.function_name

  destination_config {
    on_failure {
      destination = aws_sqs_queue.lambda_dlq.arn
    }
    on_success {
      destination = aws_sns_topic.processing_success.arn
    }
  }

  maximum_retry_attempts = 2
}

resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.s3_trigger_processor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.data_lake.arn
}

resource "aws_s3_bucket_notification" "trigger" {
  bucket = aws_s3_bucket.data_lake.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.s3_trigger_processor.arn
    events               = ["s3:ObjectCreated:*"]
    filter_prefix        = "raw/"
    filter_suffix        = ".json"
  }

  depends_on = [aws_lambda_permission.allow_s3]
}

# Kinesis event source mapping (pull-based trigger)
resource "aws_lambda_event_source_mapping" "kinesis_trigger" {
  event_source_arn  = aws_kinesis_stream.clickstream.arn
  function_name     = aws_lambda_function.stream_processor.arn
  starting_position = "LATEST"
  batch_size        = 100

  maximum_retry_attempts        = 3
  bisect_batch_on_function_error = true

  destination_config {
    on_failure {
      destination_arn = aws_sqs_queue.lambda_dlq.arn
    }
  }
}
```

### AWS CLI Quick Reference
```bash
# Invoke a function synchronously with a test payload
aws lambda invoke --function-name process-new-s3-object --payload file://test-event.json response.json

# Tail logs live (requires AWS CLI v2)
aws logs tail /aws/lambda/process-new-s3-object --follow

# Update function code from a zip in S3
aws lambda update-function-code --function-name process-new-s3-object --s3-bucket my-deploy-bucket --s3-key lambda/v1.2.0.zip

# Publish a version and point an alias at it (safe deploys)
aws lambda publish-version --function-name process-new-s3-object
aws lambda update-alias --function-name process-new-s3-object --name prod --function-version 12

# Check current concurrency usage against account limits
aws lambda get-account-settings --query 'AccountLimit'
```

### IaC Best Practices
- Package dependencies via **Lambda Layers** rather than bundling them into every function zip — smaller deploys, faster CI.
- Use `data.archive_file` (or a CI-built artifact + S3 upload) to compute `source_code_hash` so Terraform detects real code changes.
- Set **reserved concurrency** on functions that write to downstream systems with limited throughput (e.g. Redshift, RDS) to avoid overwhelming them.
- For anything that might run >15 minutes or needs heavier compute, hand off to Step Functions + Glue/EMR instead of forcing it into Lambda.
- Attach Lambda to a VPC only when it needs to reach private resources (RDS, Redshift) — it adds cold-start latency and ENI overhead otherwise.
- Always configure a **dead-letter queue or `on_failure` destination** — silently dropped failed invocations are a common source of "missing data" bugs.
- Use `aws_lambda_function_event_invoke_config` to cap `maximum_retry_attempts` for async invocations — Lambda's default retry behavior can duplicate side effects if handlers aren't idempotent.

---

## Python (boto3)

Two sides matter for Lambda in a data pipeline: **the handler code that runs inside the function**, and **the boto3 calls you make from elsewhere to manage/invoke functions**.

### The Lambda handler (runs inside AWS)

```python
import json
import boto3
import urllib.parse
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize clients at module scope so they're reused across warm invocations
s3 = boto3.client("s3")
glue = boto3.client("glue")

def lambda_handler(event, context):
    """Triggered on s3:ObjectCreated:* — kicks off downstream processing."""
    processed = 0
    for record in event["Records"]:
        bucket = record["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])
        logger.info(f"New object: s3://{bucket}/{key}")

        try:
            # Example: trigger a Glue job for this specific file
            glue.start_job_run(
                JobName="transform-events-job",
                Arguments={"--input_path": f"s3://{bucket}/{key}"},
            )
            processed += 1
        except Exception:
            logger.exception(f"Failed to process {key}")
            raise  # re-raise so the invocation is recorded as a failure (triggers DLQ/retry)

    return {"statusCode": 200, "body": json.dumps({"processed": processed})}


def kinesis_handler(event, context):
    """Triggered by a Kinesis event source mapping — processes a batch of records."""
    import base64

    for record in event["Records"]:
        payload = json.loads(base64.b64decode(record["kinesis"]["data"]))
        logger.info(f"Processing record: {payload}")
        # ... write to S3/Firehose/downstream system
    return {"batchItemFailures": []}  # report partial batch failures here if needed
```

### Managing Lambda from outside (deploy/invoke tooling)

```python
import boto3
import json
from botocore.exceptions import ClientError

lambda_client = boto3.client("lambda", region_name="us-east-1")

# Invoke synchronously and read the response
def invoke_function(function_name: str, payload: dict) -> dict:
    response = lambda_client.invoke(
        FunctionName=function_name,
        InvocationType="RequestResponse",  # "Event" for async fire-and-forget
        Payload=json.dumps(payload).encode(),
    )
    return json.loads(response["Payload"].read())

# Invoke asynchronously (fire-and-forget, relies on destinations/DLQ for failure handling)
def invoke_async(function_name: str, payload: dict):
    lambda_client.invoke(
        FunctionName=function_name,
        InvocationType="Event",
        Payload=json.dumps(payload).encode(),
    )

# Update function code (e.g. from a CI/CD pipeline)
def update_code(function_name: str, s3_bucket: str, s3_key: str):
    lambda_client.update_function_code(
        FunctionName=function_name,
        S3Bucket=s3_bucket,
        S3Key=s3_key,
    )
    # Wait for the update to finish propagating before publishing a version
    waiter = lambda_client.get_waiter("function_updated")
    waiter.wait(FunctionName=function_name)

# Publish a version and shift an alias (safe, gradual rollout pattern)
def deploy_new_version(function_name: str, alias: str = "prod"):
    version = lambda_client.publish_version(FunctionName=function_name)["Version"]
    lambda_client.update_alias(FunctionName=function_name, Name=alias, FunctionVersion=version)
    return version

# List functions and their memory/timeout config (quick inventory/audit)
def list_functions():
    paginator = lambda_client.get_paginator("list_functions")
    for page in paginator.paginate():
        for fn in page["Functions"]:
            print(fn["FunctionName"], fn["MemorySize"], fn["Timeout"], fn["Runtime"])

# Fetch recent CloudWatch logs for a function (quick debugging without leaving Python)
def get_recent_logs(function_name: str, minutes: int = 15):
    import time
    logs = boto3.client("logs")
    log_group = f"/aws/lambda/{function_name}"
    start_time = int((time.time() - minutes * 60) * 1000)
    response = logs.filter_log_events(logGroupName=log_group, startTime=start_time)
    return [e["message"] for e in response["events"]]

if __name__ == "__main__":
    try:
        result = invoke_function(
            "process-new-s3-object",
            {"Records": [{"s3": {"bucket": {"name": "my-bucket"}, "object": {"key": "raw/test.json"}}}]},
        )
        print(result)
    except ClientError as e:
        print(f"Lambda error: {e.response['Error']['Message']}")
```

### boto3 Tips
- Use `InvocationType="Event"` for fire-and-forget async triggers (e.g. kicking off a downstream process you don't need to wait on); use `"RequestResponse"` when you need the return value.
- Inside handlers, initialize boto3 clients **outside** the `lambda_handler` function (module scope) so they're reused across warm invocations instead of recreated every call.
- For local testing, use the `moto` library to mock AWS services so handler code can be unit-tested without hitting real AWS.
- `update_function_code` is how CI/CD pipelines deploy new versions — pair it with `publish_version` + aliases for safe, gradual rollouts, and use the `function_updated` waiter to avoid racing the deployment.
- Design handlers to be **idempotent** (e.g. keyed on S3 object version or a dedup ID) since Lambda's at-least-once delivery for async/stream sources means duplicate invocations will happen.

---

## Security Best Practices
- Give each function its own execution role scoped to exactly the resources it touches — never a shared "lambda-does-everything" role.
- Use **Lambda environment variable encryption** with a customer-managed KMS key for anything sensitive (though prefer Secrets Manager for actual credentials).
- Enable **AWS X-Ray tracing** (`tracing_config`) for functions in critical pipelines — it makes tracking a request across Lambda → Step Functions → Glue much easier during incident response.
- If a function needs no internet access, keep it out of a VPC entirely (simpler, faster, no ENI management); if it must reach a VPC resource, use VPC endpoints instead of a NAT gateway where possible to cut egress cost and reduce attack surface.
- Validate and sanitize all event input (S3 keys, Kinesis payloads) — a Lambda triggered by user-influenced data (e.g. an uploaded filename) is a real injection surface.

## Cost Optimization
- Tune `memory_size` deliberately — Lambda allocates CPU proportionally to memory, so a slightly higher memory setting sometimes **reduces** total cost by finishing faster.
- Use **ARM64 (Graviton2) architecture** (`architectures = ["arm64"]`) where your dependencies support it — typically ~20% cheaper for the same performance.
- Avoid unnecessarily long `timeout` values — a hung function due to a downstream outage will run (and bill) for the full timeout unless caught.
- Use **provisioned concurrency** only where cold-start latency genuinely matters (user-facing APIs) — it's billed continuously, unlike on-demand concurrency.
- Batch small, frequent invocations where possible (e.g. process Kinesis records in batches of 100 rather than triggering per-record).

## Monitoring & Common Errors
| Symptom | Likely Cause | Fix |
|---|---|---|
| `Task timed out after X seconds` | Downstream call (Glue/Redshift/API) slower than expected, or function logic hangs | Increase timeout cautiously; add explicit timeouts on outbound calls; investigate the slow dependency |
| Duplicate downstream side effects | At-least-once delivery + non-idempotent handler | Add a dedup key (e.g. S3 object ETag, Kinesis sequence number) and check-before-act |
| `Rate Exceeded` errors calling another AWS service | Too much concurrency hitting a downstream service's API limits | Set `reserved_concurrent_executions`, add exponential backoff/retry |
| Function works locally but fails in AWS with import errors | Missing dependency not included in the deployment package/layer | Rebuild the zip/layer in a Lambda-compatible environment (matching Python/OS) |
| Silent data loss on async invocations | No DLQ/destination configured | Add `dead_letter_config` or `on_failure` destination and alert on messages landing there |

Monitor `Errors`, `Throttles`, `Duration`, and `ConcurrentExecutions` in CloudWatch; set an alarm on the DLQ's `ApproximateNumberOfMessagesVisible` so failed events don't go unnoticed.

---

[← Back to index](./00-index.md)
