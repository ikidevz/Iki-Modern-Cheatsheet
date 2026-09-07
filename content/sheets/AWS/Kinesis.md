# Amazon Kinesis — Data Engineering Cheat Sheet

*Real-time data streaming — ingesting and processing clickstreams, logs, IoT data, and CDC events at scale.*

---

## Overview

Kinesis is AWS's real-time streaming layer. Data Streams gives you low-level shard-based control; Firehose is the fully managed "just deliver this to S3/Redshift" option most data pipelines actually want. Kinesis Data Analytics adds SQL/Flink-based stream processing on top.

## When to Use Kinesis (and When Not To)

**Use Kinesis when:**
- You need continuous, real-time (sub-second to seconds) ingestion of events at high volume
- Multiple independent consumers need to read the same stream (fan-out)
- You need ordered processing within a partition key (e.g. per-user event ordering)

**Consider alternatives when:**
- You just need reliable point-to-point async messaging → use SQS instead (simpler, no shard management)
- Throughput is low/bursty and you don't need strict ordering → EventBridge or SQS is often simpler
- You need a managed, open-source-compatible streaming platform → consider Amazon MSK (Kafka) if you have existing Kafka tooling/expertise

## Key Concepts

- **Kinesis Data Streams:** Low-latency, shard-based streaming (you manage consumers)
- **Kinesis Data Firehose:** Fully managed delivery to S3/Redshift/OpenSearch, with built-in buffering/transformation
- **Shards:** Unit of throughput (1 MB/s in, 2 MB/s out per shard) — determines parallelism
- **Partition key:** Determines which shard a record lands on — pick a key with high cardinality to avoid hot shards
- **Enhanced fan-out:** Dedicated 2 MB/s throughput per consumer instead of shared pull
- **Kinesis Data Analytics:** Run SQL or Apache Flink directly against a stream for real-time aggregation/alerting
- **On-Demand mode:** Auto-scales capacity without manual shard management, billed per throughput used
- **Sequence numbers:** Unique per-record identifiers within a shard, used for checkpointing/ordering

## Common Architecture Patterns

**Simple delivery pipeline (most common):**
`Producers` → `Kinesis Firehose` → buffered/transformed → `S3` → queried by `Athena`/loaded into `Redshift`.

**Real-time processing with fan-out:**
`Kinesis Data Stream` → multiple consumers in parallel: `Lambda (alerting)`, `KDA/Flink (windowed aggregation)`, `Firehose (archival to S3)` — each reads independently via enhanced fan-out.

**CDC streaming:**
`DMS (CDC from RDS)` → `Kinesis Data Stream` → `Lambda/KDA (apply transforms)` → `Firehose` → `S3 (Iceberg table via Glue)` for near real-time analytics on operational data.

---

## Worked Examples

### Example 1: Simple Firehose delivery pipeline to S3
**Scenario:** Clickstream events need to land in S3 as compressed, partitioned Parquet with minimal code.
```hcl
resource "aws_kinesis_firehose_delivery_stream" "simple_delivery" {
  name        = "clicks-to-s3"
  destination = "extended_s3"
  extended_s3_configuration {
    role_arn   = aws_iam_role.firehose.arn
    bucket_arn = aws_s3_bucket.data_lake.arn
    prefix     = "raw/clicks/"
    buffering_interval = 60
  }
}
```
```python
put_to_firehose("clicks-to-s3", [{"event": "click", "user_id": "u1", "ts": "2026-09-03T10:00:00Z"}])
```

### Example 2: Real-time fraud alerting with enhanced fan-out
**Scenario:** A dedicated low-latency consumer flags suspicious transactions within milliseconds, without competing with the archival Firehose consumer.
```hcl
resource "aws_kinesis_stream_consumer" "fraud_alerts" {
  name       = "fraud-alert-consumer"
  stream_arn = aws_kinesis_stream.transactions.arn
}
```
```python
def handler(event, context):
    for record in event["Records"]:
        txn = json.loads(base64.b64decode(record["kinesis"]["data"]))
        if txn["amount"] > 10000 and txn["country"] != txn["billing_country"]:
            sns.publish(TopicArn="arn:aws:sns:us-east-1:123456789012:fraud-alerts",
                        Message=f"Suspicious transaction: {txn['transaction_id']}")
```

### Example 3: CDC stream from DMS merged into a curated Iceberg table
**Scenario:** Database changes flow through Kinesis and need to be upserted (not just appended) into an analytics table.
```hcl
resource "aws_kinesis_stream" "cdc_orders" {
  name        = "cdc-orders-stream"
  shard_count = 2
  stream_mode_details { stream_mode = "ON_DEMAND" }
}
```
```python
def handler(event, context):
    for record in event["Records"]:
        change = json.loads(base64.b64decode(record["kinesis"]["data"]))
        op = change["metadata"]["operation"]  # insert/update/delete
        run_query(f"""
            MERGE INTO curated.orders t USING (SELECT {change['data']['order_id']} AS order_id) s
            ON t.order_id = s.order_id
            WHEN MATCHED AND '{op}' = 'delete' THEN DELETE
            WHEN MATCHED THEN UPDATE SET status = '{change['data']['status']}'
            WHEN NOT MATCHED THEN INSERT (order_id, status) VALUES ({change['data']['order_id']}, '{change['data']['status']}')
        """)
```

---

## Terraform

```hcl
resource "aws_kinesis_stream" "clickstream" {
  name             = "clickstream-events"
  shard_count      = 4
  retention_period = 48 # hours

  stream_mode_details {
    stream_mode = "PROVISIONED" # or "ON_DEMAND" to auto-scale
  }

  encryption_type = "KMS"
  kms_key_id      = aws_kms_key.kinesis.arn

  shard_level_metrics = [
    "IncomingBytes",
    "OutgoingBytes",
    "IteratorAgeMilliseconds",
  ]
}

resource "aws_kinesis_firehose_delivery_stream" "to_s3" {
  name        = "clickstream-to-s3"
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn   = aws_iam_role.firehose.arn
    bucket_arn = aws_s3_bucket.data_lake.arn
    prefix     = "raw/clickstream/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/"
    error_output_prefix = "errors/clickstream/!{firehose:error-output-type}/"

    buffering_size     = 64  # MB
    buffering_interval = 300 # seconds

    compression_format = "GZIP"

    processing_configuration {
      enabled = true
      processors {
        type = "Lambda"
        parameters {
          parameter_name  = "LambdaArn"
          parameter_value = aws_lambda_function.firehose_transform.arn
        }
      }
    }

    cloudwatch_logging_options {
      enabled         = true
      log_group_name  = "/aws/kinesisfirehose/clickstream-to-s3"
      log_stream_name = "S3Delivery"
    }
  }

  kinesis_source_configuration {
    kinesis_stream_arn = aws_kinesis_stream.clickstream.arn
    role_arn            = aws_iam_role.firehose.arn
  }
}

# Enhanced fan-out consumer for a dedicated, low-latency reader
resource "aws_kinesis_stream_consumer" "realtime_alerting" {
  name       = "realtime-alerting-consumer"
  stream_arn = aws_kinesis_stream.clickstream.arn
}

resource "aws_lambda_event_source_mapping" "stream_consumer" {
  event_source_arn                  = aws_kinesis_stream_consumer.realtime_alerting.arn
  function_name                      = aws_lambda_function.alerting.arn
  starting_position                  = "LATEST"
  batch_size                         = 500
  maximum_batching_window_in_seconds = 5
  parallelization_factor             = 2
}
```

### AWS CLI Quick Reference
```bash
# Describe a stream (shard count, status)
aws kinesis describe-stream-summary --stream-name clickstream-events

# Put a single test record
aws kinesis put-record --stream-name clickstream-events --partition-key user123 --data '{"event":"test"}'

# Get shard iterator + read records (manual consumer, for debugging)
aws kinesis get-shard-iterator --stream-name clickstream-events --shard-id shardId-000000000000 --shard-iterator-type LATEST
aws kinesis get-records --shard-iterator <iterator-from-above>

# Update shard count (provisioned mode only)
aws kinesis update-shard-count --stream-name clickstream-events --target-shard-count 8 --scaling-type UNIFORM_SCALING

# Check Firehose delivery stream status
aws firehose describe-delivery-stream --delivery-stream-name clickstream-to-s3
```

### IaC Best Practices
- Start with **ON_DEMAND** mode unless you have predictable, sustained throughput — it removes shard-sizing guesswork.
- Choose a partition key with even cardinality distribution; a bad key choice (e.g. constant value) creates hot shards no amount of Terraform config fixes.
- Use **Firehose** instead of raw Data Streams whenever the destination is just S3/Redshift/OpenSearch with light transformation — far less code to maintain.
- Set buffering size/interval on Firehose deliberately: larger buffers = fewer, bigger S3 files (better for downstream Spark/Athena performance).
- Enable KMS encryption on the stream and enforce it via IAM condition keys for producers/consumers.
- Always set `error_output_prefix` on Firehose so failed transformation/delivery records land somewhere inspectable instead of silently dropping.
- Use **enhanced fan-out consumers** (`aws_kinesis_stream_consumer`) for latency-sensitive consumers that shouldn't compete for the shared 2 MB/s read throughput.

---

## Python (boto3)

```python
import boto3
import json
import time
from botocore.exceptions import ClientError

kinesis = boto3.client("kinesis", region_name="us-east-1")

STREAM_NAME = "clickstream-events"

# Put a single record — partition key drives shard placement
def put_record(data: dict, partition_key: str):
    kinesis.put_record(
        StreamName=STREAM_NAME,
        Data=json.dumps(data).encode(),
        PartitionKey=partition_key,
    )

# Put a batch of records — far more efficient than one-at-a-time
def put_records_batch(records: list[dict]):
    entries = [
        {
            "Data": json.dumps(r["data"]).encode(),
            "PartitionKey": r["partition_key"],
        }
        for r in records
    ]
    response = kinesis.put_records(StreamName=STREAM_NAME, Records=entries)

    if response["FailedRecordCount"] > 0:
        # Records can partially fail — inspect and retry the failed ones
        retry_entries = []
        for i, record_result in enumerate(response["Records"]):
            if "ErrorCode" in record_result:
                print(f"Record {i} failed: {record_result['ErrorCode']}")
                retry_entries.append(entries[i])
        if retry_entries:
            kinesis.put_records(StreamName=STREAM_NAME, Records=retry_entries)

# Consume records from a shard (a simplified polling consumer;
# in production, prefer the Kinesis Client Library or Lambda event source mapping)
def consume_shard(shard_id: str):
    shard_iterator = kinesis.get_shard_iterator(
        StreamName=STREAM_NAME,
        ShardId=shard_id,
        ShardIteratorType="LATEST",
    )["ShardIterator"]

    while shard_iterator:
        response = kinesis.get_records(ShardIterator=shard_iterator, Limit=100)
        for record in response["Records"]:
            payload = json.loads(record["Data"])
            print(payload, "seq:", record["SequenceNumber"])

        # MillisBehindLatest tells you how far behind real-time this consumer is
        print(f"Lag: {response['MillisBehindLatest']}ms")

        shard_iterator = response.get("NextShardIterator")
        time.sleep(1)  # avoid hammering the API

def list_shards():
    response = kinesis.describe_stream(StreamName=STREAM_NAME)
    return [s["ShardId"] for s in response["StreamDescription"]["Shards"]]

# Check for hot shards by inspecting CloudWatch shard-level metrics
def check_shard_health():
    cloudwatch = boto3.client("cloudwatch")
    for shard_id in list_shards():
        response = cloudwatch.get_metric_statistics(
            Namespace="AWS/Kinesis",
            MetricName="IncomingBytes",
            Dimensions=[
                {"Name": "StreamName", "Value": STREAM_NAME},
                {"Name": "ShardId", "Value": shard_id},
            ],
            StartTime=time.time() - 300,
            EndTime=time.time(),
            Period=60,
            Statistics=["Sum"],
        )
        print(shard_id, response["Datapoints"])

# Firehose: put records directly (no shard iterators to manage)
def put_to_firehose(delivery_stream_name: str, records: list[dict]):
    firehose = boto3.client("firehose")
    entries = [{"Data": json.dumps(r).encode()} for r in records]
    firehose.put_record_batch(DeliveryStreamName=delivery_stream_name, Records=entries)

if __name__ == "__main__":
    try:
        put_records_batch([
            {"data": {"event": "page_view", "user_id": "u1"}, "partition_key": "u1"},
            {"data": {"event": "click", "user_id": "u2"}, "partition_key": "u2"},
        ])
    except ClientError as e:
        print(f"Kinesis error: {e.response['Error']['Message']}")
```

### boto3 Tips
- Always prefer `put_records` (batch, up to 500 records/call) over looping `put_record` — much higher throughput and lower cost in API calls.
- `put_records` can **partially fail** — check `FailedRecordCount` and retry only the failed entries, not the whole batch.
- For production consumers, don't hand-roll shard polling like above — use the **Kinesis Client Library (KCL)** or, more commonly in serverless pipelines, a **Lambda event source mapping** which handles checkpointing and shard rebalancing for you.
- For Firehose, boto3's `firehose` client (`put_record`, `put_record_batch`) is simpler — no shard iterators to manage since Firehose handles delivery for you.
- Watch `MillisBehindLatest` in `get_records` responses (or the `IteratorAgeMilliseconds` CloudWatch metric) to detect a consumer falling behind before it becomes a backlog problem.

---

## Security Best Practices
- Enable **server-side encryption (KMS)** on the stream, and scope producer/consumer IAM policies with `kms:GenerateDataKey`/`kms:Decrypt` only for the specific stream's key.
- Use resource-level IAM policies (`Resource: arn:aws:kinesis:...:stream/clickstream-events`) rather than `kinesis:*` on `*` — separate producer and consumer permissions (`kinesis:PutRecord` vs `kinesis:GetRecords`).
- For Firehose delivering to S3, ensure the destination bucket enforces encryption and that the Firehose role has only `s3:PutObject` on the specific prefix, not the whole bucket.
- Avoid putting PII directly into partition keys or unencrypted record data if downstream consumers/logs might expose it — mask/tokenize at the producer if needed.

## Cost Optimization
- Use **On-Demand mode** unless you can confidently forecast sustained throughput — provisioned shards you don't fully use are wasted spend.
- Batch writes with `put_records`/`put_record_batch` — fewer, larger API calls reduce PUT payload unit costs.
- Tune Firehose buffering (`buffering_size`/`buffering_interval`) toward the larger end when near-real-time isn't required — fewer, bigger S3 files also reduce downstream Athena/Glue costs.
- Set stream `retention_period` no higher than you actually need for replay — extended retention (beyond 24h) has additional cost.
- Right-size `parallelization_factor` on Lambda event source mappings — over-parallelizing increases concurrent Lambda invocations (and cost) without proportional throughput gain once you're no longer shard-bound.

## Monitoring & Common Errors
| Symptom | Likely Cause | Fix |
|---|---|---|
| `ProvisionedThroughputExceededException` | Shard(s) exceeding 1 MB/s in or 2 MB/s out | Increase shard count, switch to On-Demand, or fix a skewed partition key |
| Consumer falling behind (`IteratorAgeMilliseconds` climbing) | Consumer processing slower than incoming rate | Scale out consumers, use enhanced fan-out, increase Lambda batch size/parallelization |
| Firehose delivering very small S3 files | Buffering interval/size too low for the actual throughput | Increase `buffering_size`/`buffering_interval` |
| Records missing at destination | Firehose transformation Lambda erroring silently | Check `error_output_prefix` in S3 and the transform Lambda's CloudWatch logs |
| Hot shard (one shard far busier than others) | Low-cardinality or skewed partition key | Redesign partition key (e.g. hash + suffix) for more even distribution |

Monitor `IncomingBytes`/`IncomingRecords` (throughput), `IteratorAgeMilliseconds` (consumer lag), `WriteProvisionedThroughputExceeded`/`ReadProvisionedThroughputExceeded` (throttling) at the shard level to catch hot shards early.

---

[← Back to index](./00-index.md)
