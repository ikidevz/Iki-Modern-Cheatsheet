# Streaming & Real-Time Processing

## Stream Processing Concepts

**Definition:** Continuous processing of data as it arrives, rather than in scheduled batches.

**Key Points:**
- Core components: producer (emits events) → broker/log (Kafka, Kinesis, Pub/Sub) → consumer/processor (Flink, Spark Streaming, ksqlDB).
- Events are typically immutable and appended to a log, enabling replay.

**Example:**
```
Order Service → Kafka topic "orders" → Flink job (enrich + aggregate) → Sink (warehouse / dashboard)
```

**When to Use / Trade-offs:**
- Justify streaming infrastructure when latency requirements (seconds or less) genuinely can't be met by micro-batch, since it adds meaningful operational overhead.

**Common Pitfalls:**
- Adopting a streaming architecture for a reporting use case that would be perfectly served by hourly batch, adding unnecessary complexity and cost.

---

## Windowing Strategies

**Definition:** Methods for grouping continuous event streams into finite chunks for aggregation.

**Key Points:**

| Window Type | Behavior |
|---|---|
| Tumbling | Fixed-size, non-overlapping intervals (e.g., every 5 min) |
| Sliding | Fixed-size, overlapping intervals (e.g., last 5 min, updated every 1 min) |
| Session | Groups events by activity gaps (e.g., close window after 10 min of inactivity) |

**Example:**
```sql
-- Flink SQL tumbling window
SELECT window_start, COUNT(*)
FROM TABLE(TUMBLE(TABLE events, DESCRIPTOR(event_time), INTERVAL '5' MINUTES))
GROUP BY window_start;
```

**When to Use / Trade-offs:**
- Tumbling windows are simplest for regular periodic metrics.
- Sliding windows suit smoothed/rolling metrics (e.g., rolling 5-minute average).
- Session windows fit user-behavior analysis where activity is naturally bursty (web sessions, app usage).

**Common Pitfalls:**
- Choosing tumbling windows for use cases needing smooth trend lines, causing visible "steps" in dashboards where sliding windows would look better.

---

## Delivery Guarantees

**Definition:** The contract a streaming system provides about whether messages might be lost or duplicated during processing.

**Key Points:**
- At-most-once — message may be lost, never duplicated. Fastest, least safe.
- At-least-once — message never lost, may be duplicated. Most common; pair with idempotent processing.
- Exactly-once — message processed once, no loss or duplication. Hardest to guarantee end-to-end.

**Example:**
- Kafka Streams / Flink with transactional sinks can achieve exactly-once from source to sink within supported systems.

**When to Use / Trade-offs:**
- At-least-once + idempotent downstream writes is the pragmatic default for most pipelines — true exactly-once often requires the entire chain (source, processing, sink) to support it.

**Common Pitfalls:**
- Assuming "exactly-once" processing guarantees eliminate the need for idempotent writes at the sink — most real systems still benefit from defensive idempotency.

---

## Lambda vs Kappa Architecture

**Definition:** Two architectural approaches for combining real-time and historical data processing.

**Key Points:**
- Lambda — runs separate batch and speed (streaming) layers in parallel, merged at a serving layer.
- Kappa — a single streaming pipeline handles both real-time and historical reprocessing by replaying the log.

**Example:**
- Lambda: nightly Spark batch job recomputes accurate historical aggregates while a Flink streaming job serves approximate real-time numbers; both feed a shared serving layer.
- Kappa: all processing happens through one Flink/Kafka Streams pipeline; historical reprocessing is done by replaying Kafka topics with long retention.

**When to Use / Trade-offs:**
- Lambda suits cases needing both guaranteed historical accuracy and low-latency approximate results, at the cost of maintaining two codebases.
- Kappa is simpler to maintain (one pipeline) but requires a log system that can cheaply retain and replay large volumes of historical data.

**Common Pitfalls:**
- Maintaining Lambda's dual codebases long-term without keeping batch and streaming transformation logic in sync, causing metric discrepancies between the two layers.
