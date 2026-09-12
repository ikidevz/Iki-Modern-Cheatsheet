# Azure Event Hubs Cheatsheet — *Bonus*

> Big-data streaming platform and event ingestion service — the Pub/Sub / Kafka equivalent for real-time pipelines on Azure.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Type | Managed, high-throughput event streaming/ingestion service |
| Protocol support | AMQP 1.0 (native) and **Kafka protocol** (drop-in compatible with Kafka clients) |
| Best for | Real-time telemetry/event ingestion at massive scale, feeding Stream Analytics/Databricks/Synapse |
| Not for | Simple point-to-point queueing with complex routing rules (use Service Bus instead) |

---

## 2. Core Concepts

| Concept | Description |
|---|---|
| **Namespace** | Management container for one or more Event Hubs (like a Kafka cluster) |
| **Event Hub** | The actual stream/topic — a named event ingestion endpoint |
| **Partition** | Ordered sequence within an Event Hub; enables parallel consumption (like a Kafka partition) |
| **Consumer Group** | An independent "view" of the event stream — each app reads at its own pace/offset |
| **Throughput Unit (TU) / Processing Unit (PU) / Capacity Unit (CU)** | Pre-purchased capacity, depending on tier (Standard/Premium/Dedicated) |
| **Event Hubs Capture** | Automatically archives streamed events to Blob/ADLS Gen2 in Avro/Parquet — zero code |
| **Checkpointing** | Consumers persist their read position (offset) so they can resume after restart |
| **Schema Registry** | Optional enforced Avro/JSON schemas for events |

---

## 3. Tiers

| Tier | Notes |
|---|---|
| **Basic** | Limited retention (1 day), no Capture, no Kafka support |
| **Standard** | 1–7 day retention, Kafka support, Capture available |
| **Premium** | Dedicated compute resources (CUs), better isolation & throughput, up to 90-day retention |
| **Dedicated** | Single-tenant cluster, highest throughput/scale, fixed pricing |

---

## 4. Azure CLI Reference

```bash
# Create namespace + Event Hub
az eventhubs namespace create --name my-eventhub-ns --resource-group my-rg \
  --location eastus --sku Standard

az eventhubs eventhub create --name orders --namespace-name my-eventhub-ns \
  --resource-group my-rg --partition-count 4 --message-retention 3

# Consumer groups
az eventhubs eventhub consumer-group create --name my-consumer-group \
  --eventhub-name orders --namespace-name my-eventhub-ns --resource-group my-rg

# Authorization rules (connection strings)
az eventhubs namespace authorization-rule create --name SendListenRule \
  --namespace-name my-eventhub-ns --resource-group my-rg --rights Send Listen

az eventhubs namespace authorization-rule keys list --name SendListenRule \
  --namespace-name my-eventhub-ns --resource-group my-rg

# Enable Capture (auto-archive to ADLS Gen2)
az eventhubs eventhub update --name orders --namespace-name my-eventhub-ns \
  --resource-group my-rg --enable-capture true --capture-interval 300 \
  --capture-size-limit 314572800 \
  --destination-name EventHubArchive.AzureBlockBlob \
  --storage-account myadlsaccount --blob-container captured-events
```

---

## 5. Python Client Library (`azure-eventhub`)

```bash
pip install azure-eventhub azure-eventhub-checkpointstoreblob-aio azure-identity
```

### Send events (producer)
```python
from azure.eventhub import EventHubProducerClient, EventData

producer = EventHubProducerClient.from_connection_string(
    conn_str="Endpoint=sb://my-eventhub-ns.servicebus.windows.net/;SharedAccessKeyName=...;SharedAccessKey=...",
    eventhub_name="orders",
)

with producer:
    event_data_batch = producer.create_batch()
    event_data_batch.add(EventData('{"order_id": "o1", "amount": 49.99}'))
    event_data_batch.add(EventData('{"order_id": "o2", "amount": 19.99}'))
    producer.send_batch(event_data_batch)
```

### Send with a partition key (keeps related events ordered together)
```python
event_data_batch = producer.create_batch(partition_key="user-123")
event_data_batch.add(EventData('{"order_id": "o3", "user_id": "user-123"}'))
producer.send_batch(event_data_batch)
```

### Send using Azure AD auth instead of a connection string
```python
from azure.identity import DefaultAzureCredential
from azure.eventhub import EventHubProducerClient

credential = DefaultAzureCredential()
producer = EventHubProducerClient(
    fully_qualified_namespace="my-eventhub-ns.servicebus.windows.net",
    eventhub_name="orders",
    credential=credential,
)
```

### Consume events (with checkpointing to Blob Storage — production pattern)
```python
from azure.eventhub import EventHubConsumerClient
from azure.eventhub.extensions.checkpointstoreblob import BlobCheckpointStore

checkpoint_store = BlobCheckpointStore.from_connection_string(
    "BLOB_STORAGE_CONNECTION_STRING", container_name="checkpoints"
)

consumer = EventHubConsumerClient.from_connection_string(
    conn_str="Endpoint=sb://my-eventhub-ns.servicebus.windows.net/;...",
    consumer_group="$Default",
    eventhub_name="orders",
    checkpoint_store=checkpoint_store,
)

def on_event(partition_context, event):
    print(f"Partition {partition_context.partition_id}: {event.body_as_str()}")
    partition_context.update_checkpoint(event)   # persist progress

with consumer:
    consumer.receive(on_event=on_event, starting_position="-1")   # "-1" = from the beginning
```

### Async consumption (higher throughput, production-recommended)
```python
import asyncio
from azure.eventhub.aio import EventHubConsumerClient
from azure.eventhub.extensions.checkpointstoreblobaio import BlobCheckpointStore

async def on_event(partition_context, event):
    print(f"Received: {event.body_as_str()}")
    await partition_context.update_checkpoint(event)

async def main():
    checkpoint_store = BlobCheckpointStore.from_connection_string(
        "BLOB_STORAGE_CONNECTION_STRING", container_name="checkpoints"
    )
    client = EventHubConsumerClient.from_connection_string(
        "EVENT_HUB_CONNECTION_STRING", consumer_group="$Default",
        eventhub_name="orders", checkpoint_store=checkpoint_store,
    )
    async with client:
        await client.receive(on_event=on_event, starting_position="-1")

asyncio.run(main())
```

### Reading events in batches (higher throughput pattern)
```python
def on_event_batch(partition_context, events):
    for event in events:
        print(event.body_as_str())
    partition_context.update_checkpoint()

consumer.receive_batch(on_event_batch=on_event_batch, max_batch_size=100, max_wait_time=5)
```

---

## 6. Using Kafka Clients Against Event Hubs

Event Hubs exposes a **Kafka-compatible endpoint**, so existing `kafka-python`/`confluent-kafka` code often works with minimal changes:

```python
from confluent_kafka import Producer

conf = {
    "bootstrap.servers": "my-eventhub-ns.servicebus.windows.net:9093",
    "security.protocol": "SASL_SSL",
    "sasl.mechanism": "PLAIN",
    "sasl.username": "$ConnectionString",
    "sasl.password": "Endpoint=sb://my-eventhub-ns.servicebus.windows.net/;SharedAccessKeyName=...;SharedAccessKey=...",
}
producer = Producer(conf)
producer.produce("orders", key="user-123", value='{"order_id": "o1"}')
producer.flush()
```

This is exactly the pattern used by **Databricks Structured Streaming** (see `03_azure_databricks_cheatsheet.md`, Example 6) to read Event Hubs via the Kafka connector.

---

## 7. Common Integration Patterns

| Pattern | How |
|---|---|
| **Event Hubs → Stream Analytics → Power BI/SQL** | No-code, SQL-like real-time queries and dashboards |
| **Event Hubs → Databricks (Structured Streaming)** | Kafka-protocol consumption into Delta Lake (bronze layer) |
| **Event Hubs → Azure Function** | Event-driven serverless processing (trigger binding) |
| **Event Hubs Capture → ADLS Gen2** | Zero-code archival of raw events for later batch processing |
| **Event Hubs → Synapse (via Stream Analytics or Spark)** | Real-time ingestion into the Synapse ecosystem |

### Azure Function triggered by Event Hubs (Python)
```python
import azure.functions as func
import logging

def main(events: func.EventHubEvent):
    for event in events:
        logging.info(f"Processing event: {event.get_body().decode('utf-8')}")
```

---

## 8. Pricing

| Tier | Billed by |
|---|---|
| Standard | Throughput Units (TUs) — each TU ≈ 1MB/s ingress, 2MB/s egress |
| Premium | Processing Units (PUs) — dedicated compute-based capacity |
| Dedicated | Fixed monthly price per Capacity Unit (CU), single-tenant cluster |
| Capture | Small additional per-hour charge while enabled |

---

## 9. Monitoring

- **Metrics**: incoming/outgoing messages, throttled requests, connection count — via Azure Monitor.
- **Consumer lag**: track the gap between the latest offset and each consumer group's checkpointed offset.
- Alert on **throttling** (`ServerBusyException`) → sign you've exceeded provisioned TUs/PUs, need to scale up or enable auto-inflate.

```bash
# Enable auto-inflate (Standard tier) to avoid throttling during spikes
az eventhubs namespace update --name my-eventhub-ns --resource-group my-rg \
  --enable-auto-inflate true --maximum-throughput-units 10
```

---

## 10. Common Gotchas

- Too few **partitions** limits maximum parallel consumers — partition count can't be decreased later, so plan for growth.
- Forgetting to checkpoint means a restarted consumer **reprocesses from the last checkpoint** (or the beginning) — design for idempotency.
- Basic tier has no Kafka support and only 1-day retention — most production pipelines need at least Standard.
- Throttling occurs silently as `ServerBusyException` if you exceed purchased TUs — monitor and enable auto-inflate.
- Event Hubs Capture writes many small files by default — plan downstream compaction if reading captured files directly.

---

## 11. Useful Links

- Docs: https://learn.microsoft.com/en-us/azure/event-hubs/
- Pricing: https://azure.microsoft.com/en-us/pricing/details/event-hubs/
- Python SDK reference: https://learn.microsoft.com/en-us/python/api/overview/azure/eventhub-readme
