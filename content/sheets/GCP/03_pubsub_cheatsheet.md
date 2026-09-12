# Google Cloud Pub/Sub Cheatsheet

> Fully-managed, real-time, asynchronous messaging service for decoupling producers and consumers at global scale.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Type | Managed publish/subscribe messaging (event ingestion & delivery) |
| Delivery guarantee | At-least-once by default; exactly-once delivery available |
| Scale | Millions of messages/sec, global by default |
| Best for | Event-driven architectures, streaming ingestion, decoupling microservices |
| Not for | Ordered strict FIFO across a whole topic (needs ordering keys), long-term storage of messages |

---

## 2. Core Concepts

| Concept | Description |
|---|---|
| **Topic** | Named resource where publishers send messages |
| **Subscription** | Named resource representing a stream of messages from a topic to be delivered to a subscriber |
| **Message** | Data (bytes) + optional attributes (key-value metadata) |
| **Publisher** | App/service that sends messages to a topic |
| **Subscriber** | App/service that receives messages via a subscription |
| **Ack deadline** | Time subscriber has to acknowledge a message before redelivery (default 10s, max 600s) |
| **Push vs Pull** | Push: Pub/Sub calls your HTTPS endpoint. Pull: subscriber actively fetches messages |
| **Ordering key** | Guarantees ordered delivery for messages sharing the same key |
| **Dead-letter topic** | Captures messages that fail delivery after N attempts |
| **Schema** | Optional Avro/Protobuf schema enforced on a topic |
| **Snapshot & Seek** | Replay messages from a point in time or a saved snapshot |

---

## 3. Delivery & Ordering Semantics

| Feature | Notes |
|---|---|
| At-least-once (default) | Messages may be redelivered; consumers must be idempotent |
| Exactly-once delivery | Enable on subscription; prevents duplicate *acknowledged* delivery within a region |
| Message ordering | Requires `enable_message_ordering=true` + same `ordering_key`; only guarantees order per key |
| Retention | Default 7 days (configurable up to 31 days); unacked messages retained until acked or expired |

---

## 4. gcloud CLI

```bash
# Topics
gcloud pubsub topics create my-topic
gcloud pubsub topics list
gcloud pubsub topics delete my-topic

# Topic with a schema attached
gcloud pubsub schemas create my-schema --type=AVRO --definition-file=schema.avsc
gcloud pubsub topics create my-topic --schema=my-schema --message-encoding=JSON

# Subscriptions
gcloud pubsub subscriptions create my-sub --topic=my-topic --ack-deadline=30
gcloud pubsub subscriptions create my-push-sub --topic=my-topic \
  --push-endpoint=https://my-service.run.app/handler

# Ordered delivery subscription
gcloud pubsub subscriptions create ordered-sub --topic=my-topic --enable-message-ordering

# Exactly-once delivery
gcloud pubsub subscriptions create eo-sub --topic=my-topic --enable-exactly-once-delivery

# With dead-letter + retry policy
gcloud pubsub subscriptions create my-sub --topic=my-topic \
  --dead-letter-topic=my-dlq-topic --max-delivery-attempts=5 \
  --min-retry-delay=10s --max-retry-delay=600s

# Publish / Pull (testing)
gcloud pubsub topics publish my-topic --message="hello world" --attribute=env=prod
gcloud pubsub topics publish my-topic --message="user 123 order" --ordering-key=user-123
gcloud pubsub subscriptions pull my-sub --auto-ack --limit=10

# Seek / Snapshot (replay)
gcloud pubsub snapshots create my-snapshot --subscription=my-sub
gcloud pubsub subscriptions seek my-sub --snapshot=my-snapshot
gcloud pubsub subscriptions seek my-sub --time=2026-09-01T00:00:00Z

# IAM
gcloud pubsub topics add-iam-policy-binding my-topic \
  --member="serviceAccount:sa@my-project.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher"
```

---

## 5. Python Client — Publishing

### Basic publish
```python
from google.cloud import pubsub_v1

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path("my-project", "my-topic")

future = publisher.publish(
    topic_path,
    data=b"hello world",
    origin="my-app",          # custom attribute
)
print(future.result())        # blocks until publish confirmed, returns message ID
```

### Publish with ordering key
```python
publisher = pubsub_v1.PublisherClient(
    publisher_options=pubsub_v1.types.PublisherOptions(enable_message_ordering=True)
)
future = publisher.publish(topic_path, data=b'{"amount": 100}', ordering_key="user-123")
```

### Publish JSON payloads (common pattern)
```python
import json

def publish_event(publisher, topic_path, event: dict, **attrs):
    data = json.dumps(event).encode("utf-8")
    return publisher.publish(topic_path, data=data, **attrs)

publish_event(publisher, topic_path, {"event_id": "e1", "amount": 42.0}, env="prod")
```

### Batch publishing (higher throughput)
```python
batch_settings = pubsub_v1.types.BatchSettings(
    max_messages=100,       # flush after 100 messages
    max_bytes=1024 * 1024,  # or 1 MB
    max_latency=0.1,        # or 100ms, whichever comes first
)
publisher = pubsub_v1.PublisherClient(batch_settings=batch_settings)

futures = []
for row in rows_to_publish:
    futures.append(publisher.publish(topic_path, data=json.dumps(row).encode()))

# Wait for all publishes to complete
for f in futures:
    f.result()
```

### Publish with retry & flow control settings
```python
from google.api_core import retry

publisher = pubsub_v1.PublisherClient(
    publisher_options=pubsub_v1.types.PublisherOptions(
        flow_control=pubsub_v1.types.PublishFlowControl(
            message_limit=1000,
            byte_limit=10 * 1024 * 1024,
            limit_exceeded_behavior=pubsub_v1.types.LimitExceededBehavior.BLOCK,
        )
    )
)
future = publisher.publish(topic_path, data=b"payload", retry=retry.Retry(deadline=60))
```

### Create a topic / schema from Python
```python
from google.cloud import pubsub_v1

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path("my-project", "my-topic")
publisher.create_topic(request={"name": topic_path})
```

---

## 6. Python Client — Subscribing

### Streaming pull (long-running subscriber, most common pattern)
```python
from google.cloud import pubsub_v1
from concurrent.futures import TimeoutError

subscriber = pubsub_v1.SubscriberClient()
sub_path = subscriber.subscription_path("my-project", "my-sub")

def callback(message):
    print(f"Received: {message.data}, attrs={message.attributes}")
    try:
        process(message.data)
        message.ack()
    except Exception:
        message.nack()   # triggers redelivery

streaming_pull_future = subscriber.subscribe(sub_path, callback=callback)
print("Listening for messages...")

with subscriber:
    try:
        streaming_pull_future.result(timeout=60)
    except TimeoutError:
        streaming_pull_future.cancel()
        streaming_pull_future.result()
```

### Streaming pull with flow control (limit concurrent messages)
```python
flow_control = pubsub_v1.types.FlowControl(max_messages=100, max_bytes=10 * 1024 * 1024)
streaming_pull_future = subscriber.subscribe(sub_path, callback=callback, flow_control=flow_control)
```

### Synchronous pull (simple batch-style consumption)
```python
response = subscriber.pull(request={"subscription": sub_path, "max_messages": 10})

ack_ids = []
for received_message in response.received_messages:
    print(received_message.message.data)
    ack_ids.append(received_message.ack_id)

if ack_ids:
    subscriber.acknowledge(request={"subscription": sub_path, "ack_ids": ack_ids})
```

### Extend ack deadline for slow processing
```python
subscriber.modify_ack_deadline(
    request={"subscription": sub_path, "ack_ids": [ack_id], "ack_deadline_seconds": 120}
)
```

### Handling exactly-once delivery acks
```python
def callback(message):
    ack_future = message.ack_with_response()
    try:
        ack_future.result(timeout=20)   # confirms the ack was durably recorded
        print("Ack succeeded")
    except pubsub_v1.subscriber.exceptions.AcknowledgeError as e:
        print(f"Ack failed: {e.error_code}")
```

### Create a subscription (with dead-letter policy) from Python
```python
from google.cloud import pubsub_v1

subscriber = pubsub_v1.SubscriberClient()
sub_path = subscriber.subscription_path("my-project", "my-sub")
topic_path = f"projects/my-project/topics/my-topic"
dead_letter_topic = f"projects/my-project/topics/my-dlq-topic"

subscriber.create_subscription(
    request={
        "name": sub_path,
        "topic": topic_path,
        "ack_deadline_seconds": 30,
        "dead_letter_policy": {
            "dead_letter_topic": dead_letter_topic,
            "max_delivery_attempts": 5,
        },
    }
)
```

---

## 7. Pub/Sub vs Pub/Sub Lite

| | Pub/Sub | Pub/Sub Lite |
|---|---|---|
| Scaling | Fully automatic | Manually provisioned capacity (partitions/throughput) |
| Cost | Pay-per-use (higher per-GB) | Cheaper for very high, steady volume |
| Availability | Multi-zone/regional HA | Zonal |
| Use case | Most workloads, variable traffic | Cost-sensitive, predictable, very high-throughput pipelines |

---

## 8. Common Integration Patterns

| Pattern | How |
|---|---|
| **Pub/Sub → Dataflow → BigQuery** | Classic streaming ETL pipeline |
| **Pub/Sub → BigQuery subscription** | Direct write to BQ table, no Dataflow needed (for simple schemas) |
| **Pub/Sub → Cloud Functions/Run** | Event-driven serverless processing (push subscription) |
| **Pub/Sub → Cloud Storage subscription** | Direct batch writes of messages to GCS files |
| **Fan-out** | Multiple subscriptions on one topic = each gets a full copy of every message |

```bash
# BigQuery subscription (no Dataflow required)
gcloud pubsub subscriptions create bq-sub --topic=my-topic \
  --bigquery-table=my-project:my_dataset.my_table \
  --use-topic-schema
```

### Cloud Function triggered by Pub/Sub push (Python)
```python
import base64
import functions_framework

@functions_framework.cloud_event
def handle_pubsub(cloud_event):
    data = base64.b64decode(cloud_event.data["message"]["data"]).decode("utf-8")
    print(f"Received event: {data}")
```

---

## 9. Pricing

- Billed per **GiB of data** published, delivered (pulled/pushed), and for cross-region replication.
- First 10 GiB/month per billing account is free.
- Pub/Sub Lite bills for **provisioned throughput/storage capacity** instead (reserved-capacity model).

---

## 10. Monitoring

- Key metrics: `subscription/num_undelivered_messages` (backlog), `subscription/oldest_unacked_message_age`, `topic/send_message_operation_count`.
- Alert on growing backlog → subscriber can't keep up or is down.
- Use **Dead-letter topics** + alerting to catch poison-pill messages.

```python
# Check backlog programmatically via Cloud Monitoring client
from google.cloud import monitoring_v3

client = monitoring_v3.MetricServiceClient()
# query pubsub.googleapis.com/subscription/num_undelivered_messages
```

---

## 11. Common Gotchas

- Not acking within the ack deadline → automatic redelivery → **duplicate processing** if not idempotent.
- Ordering keys only guarantee order *within* a key, not across the topic.
- Push subscriptions require the endpoint to return `2xx` quickly, or Pub/Sub retries with backoff.
- Exactly-once delivery is *regional* — doesn't apply across multi-region topics.
- Large messages (>10MB) are rejected — offload payloads to GCS and publish a reference instead.
- Schema validation errors reject the publish call entirely if a schema is attached to the topic.
- Forgetting to call `.result()` on a publish future silently drops errors — always check/await futures.

---

## 12. Useful Links

- Docs: https://cloud.google.com/pubsub/docs
- Pricing: https://cloud.google.com/pubsub/pricing
- Pub/Sub Lite: https://cloud.google.com/pubsub/lite/docs
- Python client reference: https://cloud.google.com/python/docs/reference/pubsub/latest
