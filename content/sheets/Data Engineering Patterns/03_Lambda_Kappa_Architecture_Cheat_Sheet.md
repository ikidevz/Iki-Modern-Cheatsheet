# Lambda & Kappa Architecture Cheatsheet for Data Engineers

> A structured reference for combining batch and streaming into a coherent system architecture — the Lambda architecture's batch/speed/serving layers, the Kappa architecture's stream-only simplification, reconciliation strategies, and when each pattern (or neither) is the right call.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 When You Need Either Pattern](#when-you-need-either-pattern)
4. [🏗️ Lambda Architecture Anatomy](#lambda-architecture-anatomy)
5. [🔀 Reconciling Batch and Speed Layer Views](#reconciling-batch-and-speed-layer-views)
6. [🌊 Kappa Architecture Anatomy](#kappa-architecture-anatomy)
7. [🔁 Reprocessing in Kappa via Replay](#reprocessing-in-kappa-via-replay)
8. [🗄️ Serving Layer Design](#serving-layer-design)
9. [🧮 Handling Late Data in Both Architectures](#handling-late-data-in-both-architectures)
10. [🏔️ The Lakehouse as a Modern Simplification](#the-lakehouse-as-a-modern-simplification)
11. [🛠️ Tooling Landscape](#tooling-landscape)
12. [🧪 Testing Dual-Path Consistency](#testing-dual-path-consistency)
13. [💰 Cost and Operational Trade-offs](#cost-and-operational-trade-offs)
14. [⚠️ Common Gotchas](#common-gotchas)
15. [✅ Best Practices Checklist](#best-practices-checklist)
16. [📚 Lambda vs Kappa vs Unified Lakehouse](#lambda-vs-kappa-vs-unified-lakehouse)
17. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| Lambda | Batch layer (accurate, slow) + speed layer (fast, approximate) + serving layer (merges both) |
| Kappa | Stream-only; batch reprocessing done by replaying the stream from an earlier offset |
| Reconciliation | Speed layer view is overwritten/discarded once the batch layer catches up |
| Replay | Kappa's answer to "reprocess history" — re-run the same stream job from offset 0 |
| Modern alternative | Lakehouse tables with both streaming and batch writers targeting one table |
| Common tools | Lambda: Spark (batch) + Flink/Kafka Streams (speed); Kappa: Flink/Kafka Streams only |

## 🧠 Core Concept

Both architectures solve the same problem: consumers want **low-latency approximate results now** and **fully correct results eventually**, and a single processing path historically couldn't deliver both. Lambda solves this by running two parallel pipelines; Kappa solves it by making the streaming path good enough to be the only pipeline.

```text
Lambda:
  raw events --> [batch layer: full recompute, hours later, fully correct]  --> serving layer
             \-> [speed layer: streaming, seconds later, approximate]      -->/   (merged view)

Kappa:
  raw events --> [stream processing layer only] --> serving layer
             (reprocessing = replay the log from an earlier offset through the SAME job)
```

## 🎯 When You Need Either Pattern

**Consider Lambda when:**
- You need genuinely different correctness/latency guarantees for the same metric (a fast approximate dashboard number now, a fully reconciled number by morning).
- Your batch and streaming compute stacks are already separate and well-understood, and unifying them isn't worth the migration cost yet.

**Consider Kappa when:**
- You want one codebase and one operational surface, and your stream processor can handle reprocessing at the volume/speed you need.
- Log retention (or tiered storage) makes replaying months of history from the stream practical.

**Consider neither when:**
- A well-run batch pipeline already meets your latency requirements — this whole architectural conversation is unnecessary complexity for a problem you don't have. See [batch-processing.md](./Batch_Processing_Cheat_Sheet.md).
- A modern lakehouse table can be written by both a streaming job and a batch job without needing two separate logical layers — see the lakehouse section below, which is how most new systems actually solve this today.

## 🏗️ Lambda Architecture Anatomy

```python
# Speed layer: Flink/Kafka Streams job producing fast, approximate aggregates
def speed_layer_job():
    for event in stream_consumer:
        running_total = update_approx_aggregate(event)
        write_to_speed_table(event.key, running_total)   # low-latency store, e.g. Redis/Cassandra

# Batch layer: nightly Spark job recomputing the FULLY correct aggregate from raw storage
def batch_layer_job(run_date):
    raw = spark.read.parquet(f"s3://raw/events/date={run_date}/")
    correct_total = raw.groupBy("key").agg(F.sum("amount"))
    (correct_total.write.mode("overwrite")
        .option("replaceWhere", f"date = '{run_date}'")
        .saveAsTable("batch_view"))
```

```python
# Serving layer: merges both views, preferring batch once it's caught up for a given window
def serve(key, as_of_date):
    if batch_view_covers(as_of_date):
        return query_batch_view(key, as_of_date)          # authoritative, fully correct
    return query_speed_view(key) + query_batch_view(key, last_completed_batch_date)
```

The defining operational cost of Lambda is **maintaining the same business logic twice** — once in the batch framework's idioms, once in the streaming framework's — which is the primary reason Kappa exists.

## 🔀 Reconciling Batch and Speed Layer Views

```python
def reconcile_after_batch_completes(run_date):
    """Once the batch layer has a fully correct view for run_date,
    the speed layer's approximate data for that same window becomes redundant."""
    correct_total = query_batch_view(run_date=run_date)
    discard_speed_view_data(before=run_date)   # speed layer only needs to cover data NOT yet in batch
```

```sql
-- Serving query that transparently unions both, with batch as the tie-breaker for overlapping windows
SELECT key, SUM(amount) AS total
FROM (
    SELECT key, amount FROM batch_view WHERE event_date < CURRENT_DATE
    UNION ALL
    SELECT key, amount FROM speed_view WHERE event_date = CURRENT_DATE   -- only "today" is still approximate
) combined
GROUP BY key;
```

This reconciliation step — discarding stale speed-layer data once batch catches up — is what keeps the speed layer's storage bounded; without it, the speed layer accumulates redundant approximate data forever.

## 🌊 Kappa Architecture Anatomy

```python
# ONE processing job, running continuously — no separate batch codepath
def kappa_job():
    for event in stream_consumer:
        result = compute(event)     # the SAME logic used for both "live" and "historical" processing
        sink.write(result)
        consumer.commit(event.offset)
```

```text
Kafka topic (retained for the required historical window, or tiered to cheap storage)
        │
        ▼
Single stream processing job (Flink/Kafka Streams)
        │
        ▼
Serving layer (one view, always produced by the same code path)
```

Kappa's core simplification: there is no "eventually correct batch recompute" as a separate system — if the logic needs to change, you **replay the log through the updated job**, producing a new, corrected output from the same single code path.

## 🔁 Reprocessing in Kappa via Replay

```python
def reprocess_with_new_logic(new_output_topic: str):
    """Deploy the updated job pointed at a NEW output, replaying from the earliest
    retained offset, so the old (correct-for-its-time) output stays untouched
    until the new one is validated."""
    consumer = KafkaConsumer("events", group_id="reprocess-v2", auto_offset_reset="earliest")
    for event in consumer:
        result = compute_v2(event)       # updated business logic
        sink.write(new_output_topic, result)

# Once validated, cut consumers over to the new output topic, then retire the old one
```

```bash
# Practical constraint: replay speed is bounded by retained log volume and processing throughput —
# replaying a year of high-volume events can take hours to days depending on the processor's throughput
kafka-consumer-groups --bootstrap-server broker:9092 --describe --group reprocess-v2
```

**Critical requirement for Kappa to actually work:** log retention (or a tiered storage layer like Kafka's tiered storage, or replaying from a raw event lake instead of Kafka itself) must cover the realistic reprocessing horizon — if you need to reprocess a year of data but only retain 30 days, Kappa's core assumption breaks.

## 🗄️ Serving Layer Design

```python
# A serving layer needs to support point lookups AND range queries efficiently,
# regardless of which architecture produced the data
serving_store_options = {
    "point_lookups_low_latency": ["Redis", "DynamoDB", "Cassandra"],
    "analytical_range_queries": ["ClickHouse", "Druid", "Pinot"],
    "hybrid": ["Postgres with good indexing for moderate scale"],
}
```

The serving layer is often the most under-designed part of either architecture — teams invest heavily in the processing layers and then bolt on whatever database happens to be available, producing a serving layer that can't actually meet the latency the upstream processing was built to achieve.

## 🧮 Handling Late Data in Both Architectures

```python
# Lambda: late data is naturally absorbed by the NEXT batch run, since batch recomputes fully
# Kappa: late data needs an explicit watermark/lateness policy in the stream job itself
stream = stream.assign_timestamps_and_watermarks(
    WatermarkStrategy.for_bounded_out_of_orderness(Duration.of_minutes(10))
)
```

This is a genuine Lambda advantage: the batch layer's periodic full recompute is a built-in mechanism for absorbing late data, whereas Kappa needs the streaming job's watermark/lateness handling to be correct from the start — see [real-time-streaming.md](./Real_Time_Streaming_Cheat_Sheet.md#windowing) for watermark strategy details.

## 🏔️ The Lakehouse as a Modern Simplification

```python
# A single Delta/Iceberg table, written by BOTH a streaming job and a batch job,
# often replaces the need for either Lambda's dual pipelines or Kappa's replay-only model
(spark.readStream.format("kafka").load()
    .writeStream.format("delta")
    .option("checkpointLocation", "s3://checkpoints/events/")
    .start("s3://lake/events/"))   # streaming writer, low latency

def nightly_correction_job():
    corrected = compute_fully_correct_aggregate(spark.read.format("delta").load("s3://lake/events/"))
    (corrected.write.format("delta").mode("overwrite")
        .option("replaceWhere", "event_date = current_date() - 1")
        .save("s3://lake/corrected_aggregates/"))   # batch writer, corrects the prior day
```

Many teams today get Lambda's "fast now, correct eventually" guarantee without maintaining two separate logical architectures — just a lakehouse table with a streaming writer for freshness and a periodic batch job for correction, unified by the same storage and (often) largely shared transform code.

## 🛠️ Tooling Landscape

| Layer | Lambda tools | Kappa tools |
|---|---|---|
| Batch layer | Spark, dbt | N/A (replay serves this role) |
| Speed/stream layer | Flink, Kafka Streams, Spark Structured Streaming | Flink, Kafka Streams |
| Serving layer | Redis, Cassandra, Druid, Pinot | Same |
| Modern alternative | Delta Lake / Iceberg with dual writers | Kafka with tiered storage for long retention |

## 🧪 Testing Dual-Path Consistency

```python
def test_batch_and_speed_layers_agree_once_reconciled():
    """The classic Lambda correctness test: once the batch layer has processed
    a window, its result should match what the speed layer approximated."""
    speed_result = query_speed_view(key="A", window="2026-09-17")
    batch_result = query_batch_view(key="A", window="2026-09-17")
    assert abs(speed_result - batch_result) < ACCEPTABLE_APPROXIMATION_TOLERANCE

def test_kappa_replay_produces_same_output_as_original_run():
    """Replaying historical events through the SAME job version should reproduce
    the original output exactly — this is Kappa's version of an idempotency test."""
    original_output = get_original_run_output(window="2026-09-17")
    replayed_output = replay_and_capture_output(window="2026-09-17")
    assert original_output == replayed_output
```

## 💰 Cost and Operational Trade-offs

| Factor | Lambda | Kappa |
|---|---|---|
| Codebases to maintain | Two (batch + streaming logic) | One |
| Infrastructure | Batch cluster + streaming cluster | Streaming cluster only |
| Reprocessing cost | Batch layer already does full recompute regularly | Replay cost scales with retained log volume |
| Team skill surface | Needs both batch and streaming expertise | Needs deep streaming expertise |
| Log storage cost | Lower (raw storage, not necessarily long Kafka retention) | Higher (long retention or tiered storage required) |

## ⚠️ Common Gotchas

- **Business logic drift between batch and speed layers** — the two implementations of "the same" aggregation logic slowly diverge as each is maintained independently, producing numbers that don't reconcile.
- **No reconciliation step at all** — without explicitly discarding stale speed-layer data once batch catches up, storage grows unbounded and serving queries risk double-counting.
- **Assuming Kappa's replay is cheap** — replaying a year of high-volume events through a stream processor can take far longer than a purpose-built batch job would, if throughput wasn't specifically designed for reprocessing speed.
- **Insufficient log retention for Kappa** — if reprocessing needs exceed retained history, Kappa's core assumption (the log is the source of truth for replay) breaks down.
- **Treating Lambda as the default** — for many workloads a single well-run batch or lakehouse pipeline meets requirements without needing either architecture's added complexity.
- **No watermark/lateness policy in the Kappa job** — without it, "late data" has no defined handling at all, unlike Lambda where a periodic batch recompute absorbs it implicitly.

## ✅ Best Practices Checklist

- [ ] Batch and speed layer business logic is either shared or has an explicit reconciliation test (Lambda)
- [ ] Stale speed-layer data is discarded once the batch layer covers that window (Lambda)
- [ ] Log retention (or tiered storage) covers the realistic reprocessing horizon (Kappa)
- [ ] The stream job has an explicit watermark/lateness policy (Kappa)
- [ ] Replay produces byte-identical output to the original run, tested in CI (Kappa)
- [ ] A simpler batch-only or lakehouse-dual-writer approach was considered and ruled out first
- [ ] Serving layer latency/query patterns were designed deliberately, not bolted on last

## 📚 Lambda vs Kappa vs Unified Lakehouse

| Dimension | Lambda | Kappa | Unified Lakehouse |
|---|---|---|---|
| Codebases | Two | One | One (usually) |
| Correction mechanism | Periodic batch recompute | Full replay | Periodic batch job correcting the same table |
| Operational complexity | Highest | High | Moderate |
| Best fit | Legacy systems, distinct batch/stream stacks already in place | Teams fully invested in stream processing | Most new systems today |

## 💡 Pro Tips

1. **Default to a unified lakehouse approach** for new systems — most of what Lambda/Kappa solved is now handled by a table format supporting both streaming and batch writers.
2. **Share business logic between batch and speed layers** wherever the frameworks allow it (e.g., a shared Python/Scala library called from both Spark and Flink) — don't hand-maintain two implementations.
3. **Always build the reconciliation step** — a Lambda architecture without one accumulates redundant speed-layer data forever.
4. **Size log retention to your actual reprocessing horizon** before committing to Kappa — this is the single most consequential Kappa infrastructure decision.
5. **Test that replay reproduces identical output** — this is Kappa's equivalent of an idempotency test and should be a standing CI check.
6. **Design the serving layer deliberately**, matching its query patterns (point lookup vs range scan) to a database built for that access pattern.
7. **Build a watermark/lateness policy from day one in Kappa** — there's no periodic batch recompute to quietly absorb late data the way Lambda has.
8. **Reserve Lambda for genuine dual-guarantee needs** — "fast approximate now, correct later" — not as a default architecture pattern.
9. **Budget replay time realistically** — a year of high-volume events replayed through a stream processor can take much longer than people expect; benchmark before committing.
10. **Revisit the choice periodically** — a system built as Lambda five years ago may well be better served by a modern lakehouse table today.
