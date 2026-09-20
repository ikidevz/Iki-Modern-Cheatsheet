# Real-time Streaming Cheatsheet for Data Engineers

> A structured reference for continuous, event-driven data processing — consumer groups, windowing, state management, exactly-once semantics, backpressure, and the Kafka/Flink/Kinesis landscape. Expanded from a short pattern note into a full implementation guide.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 When to Use Streaming](#when-to-use-streaming)
4. [🏗️ Reference Architecture](#reference-architecture)
5. [📥 Consumers, Partitions, and Consumer Groups](#consumers-partitions-and-consumer-groups)
6. [🪟 Windowing](#windowing)
7. [🧠 State Management](#state-management)
8. [✅ Delivery Semantics](#delivery-semantics)
9. [🚦 Backpressure and Scaling](#backpressure-and-scaling)
10. [🛠️ Tooling Landscape](#tooling-landscape)
11. [🔍 Monitoring](#monitoring)
12. [🔀 Stream-Stream and Stream-Table Joins](#stream-stream-and-stream-table-joins)
13. [🗂️ Schema Registry Integration](#schema-registry-integration)
14. [🔒 Exactly-Once with Kafka Transactions](#exactly-once-with-kafka-transactions)
15. [📊 ksqlDB for SQL-Native Stream Processing](#ksqldb-for-sql-native-stream-processing)
16. [🧪 Testing Stream Processing Logic](#testing-stream-processing-logic)
17. [⚠️ Common Gotchas](#common-gotchas)
18. [✅ Best Practices Checklist](#best-practices-checklist)
19. [📚 Streaming vs Micro-batch vs Batch](#streaming-vs-micro-batch-vs-batch)
20. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| Ingestion | Continuous consumption from a log (Kafka/Kinesis/Pub-Sub) |
| Unit of work | One event (or a small micro-batch), processed as it arrives |
| Checkpointing | Commit consumer offset only after successful processing |
| Ordering | Guaranteed per-partition, not globally |
| Delivery semantics | At-least-once is the practical default; exactly-once needs deliberate design |
| Common tools | Kafka, Flink, Kafka Streams, Spark Structured Streaming, Kinesis |
| Failure mode to design for | Backpressure, consumer lag, and reprocessing after downtime |

## 🧠 Core Concept

Real-time streaming continuously ingests, processes, and acts on events **as they are generated**, rather than waiting to accumulate a batch. The system is always running, consuming from an unbounded log, and the value of any given event decays with latency — the whole architecture is built around minimizing the time between "event happened" and "system reacted."

```text
[ event source ]  -->  [ log/broker (Kafka/Kinesis) ]  -->  [ stream processor ]  -->  [ sink: alert, dashboard, store ]
        continuous, unbounded, always-on
```

## 🎯 When to Use Streaming

**Use streaming when:**
- Fraud detection, alerting, live recommendations, or real-time dashboards need data that's seconds old, not hours old.
- Event-driven services are a more natural fit for the business process than scheduled jobs (e.g., react to "order placed," don't poll for it).
- The value of the data measurably decays with latency — a fraud signal detected after the transaction clears is nearly worthless.

**Avoid streaming when:**
- Batch or micro-batch latency is acceptable — streaming's operational complexity (state, ordering, exactly-once, always-on infrastructure) is a real cost, not a free upgrade.
- The team doesn't yet have on-call/observability maturity for an always-on system — a broken nightly batch job is far less urgent than a broken always-on pipeline silently dropping events.

## 🏗️ Reference Architecture

```python
for event in consumer:
    if event["amount"] > 10000:
        alert("high-value transaction", event)
    sink.write(event)
    consumer.commit(event["offset"])
```

```text
Kafka topic "transactions" (partitioned by account_id)
        │
        ▼
Stream processor (Flink/Kafka Streams) — stateful aggregation, windowing
        │
        ▼
Sink: alerting system, real-time dashboard, feature store
```

## 📥 Consumers, Partitions, and Consumer Groups

```python
# Multiple consumer instances in the same group split partitions among themselves,
# giving horizontal scalability with per-partition ordering preserved
consumer = KafkaConsumer(
    "transactions",
    group_id="fraud-detector",
    enable_auto_commit=False,     # manual commit for correctness control
    auto_offset_reset="earliest",
)

for message in consumer:
    process(message.value)
    consumer.commit()   # commit only after successful processing
```

| Concept | Meaning |
|---|---|
| Partition | Ordered, append-only sub-log; unit of parallelism |
| Consumer group | Set of consumers sharing the work of one topic; each partition goes to exactly one consumer in the group |
| Offset | Position in a partition a consumer has processed up to |
| Rebalance | Partitions reassigned across a consumer group when instances join/leave |

**Key rule:** ordering is guaranteed **within a partition**, not across partitions. Partition by the key that needs ordering (e.g., `account_id`) so all events for that key land in the same partition.

## 🪟 Windowing

```python
# Tumbling window: fixed, non-overlapping (e.g., "count events per 1-minute bucket")
stream.window(TumblingEventTimeWindows.of(Time.minutes(1))) \
      .aggregate(CountAggregator())

# Sliding window: overlapping (e.g., "rolling 5-minute count, updated every 30s")
stream.window(SlidingEventTimeWindows.of(Time.minutes(5), Time.seconds(30))) \
      .aggregate(CountAggregator())

# Session window: groups events by activity gaps (e.g., "user session ends after 10 min idle")
stream.window(EventTimeSessionWindows.withGap(Time.minutes(10))) \
      .aggregate(SessionAggregator())
```

```python
# Watermarks handle late-arriving events: how long to wait before "closing" a window
stream = stream.assign_timestamps_and_watermarks(
    WatermarkStrategy.for_bounded_out_of_orderness(Duration.of_seconds(30))
)
```

| Window type | Use case |
|---|---|
| Tumbling | Fixed-period aggregates (per-minute counts) |
| Sliding | Smoothed/rolling metrics |
| Session | User/entity activity grouping with variable gaps |

## 🧠 State Management

```python
# Stateful aggregation: running total per key, persisted in the processor's state store
def process_element(event, state: ValueState):
    current_total = state.value() or 0
    new_total = current_total + event["amount"]
    state.update(new_total)
    return new_total
```

Stream processors like Flink persist this state to a **durable, checkpointed state backend** (e.g., RocksDB with checkpoints to S3), so a crashed task resumes from its last consistent state rather than losing all accumulated aggregates.

```python
# Checkpointing configuration (Flink-style)
env.enable_checkpointing(60000)   # checkpoint every 60s
env.get_checkpoint_config().set_checkpointing_mode(CheckpointingMode.EXACTLY_ONCE)
```

## ✅ Delivery Semantics

| Semantic | Meaning | How to achieve |
|---|---|---|
| At-most-once | Event processed 0 or 1 times | Commit offset before processing (rarely desired — silent data loss) |
| At-least-once | Event processed ≥1 times | Commit offset after processing; consumer must be idempotent |
| Exactly-once | Event processed exactly once, end to end | Transactional writes + checkpointed offsets (Kafka transactions, Flink's exactly-once sinks) |

```python
# At-least-once pattern: process, then commit — a crash mid-way reprocesses, so the sink must be idempotent
for event in consumer:
    idempotent_apply(event)          # e.g., upsert keyed by event ID
    consumer.commit(event["offset"])
```

In practice, most systems target **at-least-once delivery + idempotent processing**, which achieves effectively-once results without the operational cost of true exactly-once end-to-end guarantees. See [idempotent-pipelines.md](./Idempotent_Pipelines_Cheat_Sheet.md).

## 🚦 Backpressure and Scaling

```python
# Backpressure: a slow sink shouldn't crash the pipeline — bound the in-flight work
consumer = KafkaConsumer(
    "transactions",
    max_poll_records=500,          # bound how much is pulled per poll
    fetch_max_wait_ms=500,
)

# Scale consumers horizontally, up to the partition count
# (more consumer instances than partitions = idle consumers doing nothing)
```

Monitor **consumer lag** (how many messages behind the latest offset) as the primary signal that a pipeline can't keep up — it degrades gracefully with a queue, unlike a crash, but left unaddressed it turns "real-time" into "eventually."

## 🛠️ Tooling Landscape

| Category | Tools |
|---|---|
| Log/broker | Apache Kafka, Redpanda, AWS Kinesis, Google Pub/Sub |
| Stream processing engines | Apache Flink, Kafka Streams, Spark Structured Streaming |
| Managed platforms | Confluent Cloud, AWS Managed Streaming for Kafka (MSK), Decodable |
| Sinks | Real-time OLAP stores (ClickHouse, Druid, Pinot), feature stores, alerting systems |

## 🔍 Monitoring

```python
metrics = {
    "consumer_lag": current_offset_latest - current_offset_consumed,
    "processing_latency_p99_ms": p99_latency,
    "checkpoint_duration_ms": last_checkpoint_duration,
    "records_per_second": throughput,
}
emit_metrics(metrics)
```

Track consumer lag, end-to-end latency percentiles, checkpoint success/duration, and rebalance frequency — a consumer group rebalancing constantly usually means unstable consumer instances, not a load problem.

## 🔀 Stream-Stream and Stream-Table Joins

Joining two streams (or a stream to a slower-changing reference table) is one of the most common — and most easily mishandled — real-time patterns, because "join" implies both sides are present *at the same time*, which isn't guaranteed in a streaming world.

```python
# Kafka Streams: stream-stream join with a bounded time window
# (an order and its payment confirmation, expected within 10 minutes of each other)
orders_stream.join(
    payments_stream,
    value_joiner=lambda order, payment: {**order, "payment_status": payment["status"]},
    join_windows=JoinWindows.of(Duration.ofMinutes(10)),
)
```

```python
# Stream-table join: enriching a fast-moving event stream with a slower reference table
# (the table side is typically backed by a compacted Kafka topic or a KTable materialization)
enriched = orders_stream.join(
    customers_table,     # KTable — always reflects the LATEST value per key, not historical
    key_selector=lambda order: order["customer_id"],
    value_joiner=lambda order, customer: {**order, "customer_segment": customer["segment"]},
)
```

| Join type | Behavior | Watch out for |
|---|---|---|
| Stream-stream | Joins events from both streams within a bounded time window | Events outside the window never match — size the window to realistic real-world delay |
| Stream-table | Enriches each event with the *current* value from a table | The table reflects "now," not "as of the event's time" — can cause the same subtle SCD-style bug as joining facts to `is_current = true` |
| Stream-GlobalTable | Like stream-table, but the table is fully replicated to every processing node | Higher memory cost, but avoids re-partitioning requirements |

## 🗂️ Schema Registry Integration

```python
# Producer: serialize with Avro against a registered schema, catching incompatible changes at produce time
from confluent_kafka.schema_registry.avro import AvroSerializer

avro_serializer = AvroSerializer(schema_registry_client, order_schema_str)
producer.produce(
    topic="orders",
    value=avro_serializer(order_event, SerializationContext("orders", MessageField.VALUE)),
)
```

```python
# Consumer: deserialize using the registry, which resolves reader/writer schema differences automatically
from confluent_kafka.schema_registry.avro import AvroDeserializer

avro_deserializer = AvroDeserializer(schema_registry_client)
for message in consumer:
    order_event = avro_deserializer(message.value(), SerializationContext("orders", MessageField.VALUE))
```

Tying stream processing to a schema registry means a producer's incompatible schema change fails at **registration time** rather than corrupting every downstream consumer — see [schema-evolution.md](./Schema_Evolution_Cheat_Sheet.md) for the compatibility rules this enforces.

## 🔒 Exactly-Once with Kafka Transactions

```python
# Kafka Streams sets exactly-once semantics with a single config, handling the
# transactional produce + offset commit internally
streams_config = {
    "processing.guarantee": "exactly_once_v2",
    "application.id": "fraud-detector",
}
```

```java
// Manually: a transactional producer that ties consumer offset commits to the produced output
producer.beginTransaction();
producer.send(new ProducerRecord<>("enriched-orders", key, enrichedPayload));
producer.sendOffsetsToTransaction(currentOffsets, consumerGroupMetadata);
producer.commitTransaction();
```

This ties the "read from topic A, process, write to topic B" cycle into one atomic unit — a crash mid-processing either commits nothing (both the read offset and the write roll back) or commits everything, eliminating the duplicate-processing window that at-least-once leaves open. The trade-off is real throughput overhead, so reserve it for stages where duplicate downstream writes are genuinely costly (e.g., double-charging), not as a default for every stage.

## 📊 ksqlDB for SQL-Native Stream Processing

```sql
-- Declare a stream over a Kafka topic
CREATE STREAM orders (order_id VARCHAR, customer_id VARCHAR, amount DOUBLE)
    WITH (KAFKA_TOPIC='orders', VALUE_FORMAT='AVRO');

-- Continuous, always-running aggregation materialized as a queryable table
CREATE TABLE revenue_by_customer AS
    SELECT customer_id, SUM(amount) AS total_revenue, COUNT(*) AS order_count
    FROM orders
    GROUP BY customer_id
    EMIT CHANGES;

-- Windowed aggregation, SQL-native tumbling window syntax
CREATE TABLE revenue_per_minute AS
    SELECT customer_id, SUM(amount) AS revenue
    FROM orders
    WINDOW TUMBLING (SIZE 1 MINUTE)
    GROUP BY customer_id
    EMIT CHANGES;

-- Point lookup against the continuously-updated table, from an application
SELECT * FROM revenue_by_customer WHERE customer_id = 'C042';
```

ksqlDB trades some of Flink's flexibility (custom state logic, complex event processing) for a much lower barrier to entry — teams already fluent in SQL can build and maintain real production streaming aggregations without learning a new processing framework.

## 🧪 Testing Stream Processing Logic

```python
# Unit test the pure transformation logic, independent of Kafka infrastructure
def test_fraud_rule_flags_high_amount():
    event = {"amount": 15000, "account_id": "A1"}
    assert is_fraud_candidate(event) is True

def test_fraud_rule_ignores_normal_amount():
    event = {"amount": 50, "account_id": "A1"}
    assert is_fraud_candidate(event) is False
```

```python
# Integration test using an embedded/test Kafka cluster (e.g., testcontainers)
def test_end_to_end_pipeline(kafka_test_cluster):
    produce_test_event(kafka_test_cluster, topic="transactions", event={"amount": 15000})
    consumed = consume_with_timeout(kafka_test_cluster, topic="alerts", timeout=5)
    assert consumed is not None
    assert consumed["alert_type"] == "high-value-transaction"
```

```python
# Testing windowing/lateness logic with controlled, synthetic out-of-order timestamps
def test_late_event_within_watermark_is_included():
    events = [make_event(ts=100), make_event(ts=90)]  # second event arrives "late" but within watermark tolerance
    result = run_windowed_aggregation(events, watermark_delay=30)
    assert result["count"] == 2   # both counted — 90 is within the 30-unit lateness allowance

def test_late_event_beyond_watermark_is_dropped():
    events = [make_event(ts=100), make_event(ts=50)]  # arrives past the watermark tolerance
    result = run_windowed_aggregation(events, watermark_delay=30)
    assert result["count"] == 1   # only the on-time event counted, per the defined lateness policy
```

## ⚠️ Common Gotchas

- **Committing offsets before processing succeeds** silently drops data on a crash — always commit after.
- **Assuming global ordering** — ordering is only guaranteed within a partition; cross-partition ordering requires application-level coordination.
- **Unbounded state growth** — a stateful aggregation with no TTL/eviction policy grows forever and eventually exhausts memory/disk.
- **Ignoring late-arriving events** — without a watermark strategy, a window "closes" and late events are silently dropped or handled inconsistently.
- **Treating streaming as strictly exactly-once by default** — most systems are at-least-once under the hood; unprotected non-idempotent sinks will see duplicates.
- **Under-provisioning partitions** — you can't add consumer parallelism beyond the partition count without repartitioning, which is a heavier operation than scaling up compute.
- **No backpressure handling** — a slow downstream sink can cause unbounded buffering and OOM crashes if not bounded.
- **Stream-table joins silently enriching with "current" state instead of "state as of the event"** — the same SCD point-in-time bug that affects warehouse fact-dimension joins shows up here too.
- **No bounded join window on stream-stream joins** — an unbounded join either never matches (if too narrow) or accumulates unbounded state waiting for a match that will never come (if unspecified).
- **Producing without a schema registry** means an incompatible producer change reaches every consumer simultaneously, instead of failing at registration time.
- **Reaching for full exactly-once semantics everywhere by default** — the throughput cost is real; reserve it for stages where duplicate writes are genuinely expensive, and use idempotent at-least-once elsewhere.

## ✅ Best Practices Checklist

- [ ] Offsets are committed only after successful, durable processing
- [ ] Partition key chosen to guarantee ordering where the business needs it
- [ ] State has an explicit TTL/eviction policy, not unbounded growth
- [ ] A watermark strategy defines how late-arriving events are handled
- [ ] Sinks are idempotent, since at-least-once delivery is the practical default
- [ ] Consumer lag and processing latency are monitored and alerted on
- [ ] Partition count is provisioned with headroom for expected consumer scaling

## 📚 Streaming vs Micro-batch vs Batch

| Dimension | Streaming | Micro-batch | Batch |
|---|---|---|---|
| Latency | Milliseconds–seconds | Seconds–minutes | Minutes–hours |
| Operational complexity | High (state, ordering, always-on) | Medium | Low |
| Cost model | Always-on compute | Scheduled, shorter windows | Cheapest per-record at scale |
| Good fit | Fraud detection, live alerting | Near-real-time dashboards | Reporting, training, reconciliation |

See [batch-processing.md](./Batch_Processing_Cheat_Sheet.md) for the batch side of this comparison.

## 💡 Pro Tips

1. **Commit offsets after processing, not before** — this single ordering choice determines your delivery semantics.
2. **Partition by the key that needs ordering** — ordering guarantees stop at the partition boundary.
3. **Set a TTL on all stateful aggregations** — unbounded state is a slow-motion outage.
4. **Design sinks to be idempotent** — treat exactly-once as an optimization, not a starting assumption.
5. **Monitor consumer lag as your primary health signal**, not just "is the consumer process running."
6. **Choose window type deliberately** — tumbling for fixed periods, sliding for smoothed metrics, session for activity-based grouping.
7. **Define a watermark/lateness policy explicitly** — don't let "what happens to late data" be an accident of defaults.
8. **Provision partitions with growth headroom** — repartitioning later is disruptive.
9. **Test failure/restart behavior deliberately** — kill a consumer mid-processing in staging and verify no data loss or duplication beyond your accepted semantics.
10. **Reserve streaming for genuinely latency-sensitive use cases** — a well-run batch or micro-batch pipeline is simpler, cheaper, and easier to operate when seconds-level freshness isn't actually required.
11. **Size stream-stream join windows to realistic real-world delay**, and monitor unmatched-event rate as a health signal.
12. **Tie producers and consumers to a schema registry** so incompatible changes fail at registration, not in every downstream consumer simultaneously.
13. **Reach for ksqlDB when the team is SQL-fluent and the logic is expressible declaratively** — it lowers the barrier to a maintained production streaming pipeline considerably.
14. **Unit test transformation/business logic separately from Kafka infrastructure**, and reserve slower integration tests (testcontainers) for verifying the wiring.
15. **Write explicit lateness-boundary tests** — one event just inside the watermark, one just outside — to pin down exactly how your pipeline handles the edge of its own policy.

