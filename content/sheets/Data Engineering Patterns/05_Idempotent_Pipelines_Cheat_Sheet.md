# Idempotent Pipelines Cheatsheet for Data Engineers

> A structured reference for designing pipelines that produce the same correct result no matter how many times a run is repeated — merge/upsert patterns, atomic partition replacement, run-key deduplication, and side-effect safety. Expanded from a short pattern note into a full implementation guide.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 Why Idempotency Matters](#why-idempotency-matters)
4. [🔑 Core Techniques](#core-techniques)
5. [🔀 MERGE / Upsert Pattern](#merge-upsert-pattern)
6. [📦 Atomic Partition Replacement](#atomic-partition-replacement)
7. [🗝️ Run-Key and Offset Deduplication](#run-key-and-offset-deduplication)
8. [📤 Idempotent Side Effects](#idempotent-side-effects)
9. [🌐 Idempotency Across Layers](#idempotency-across-layers)
10. [🔍 Testing for Idempotency](#testing-for-idempotency)
11. [🗂️ Idempotent File-Based Ingestion](#idempotent-file-based-ingestion)
12. [🧭 The Saga Pattern for Distributed Transactions](#the-saga-pattern-for-distributed-transactions)
13. [🌊 Exactly-Once in Flink and Kafka Transactions](#exactly-once-in-flink-and-kafka-transactions)
14. [🔑 Deep Dive: Idempotency Keys for Webhooks](#deep-dive-idempotency-keys-for-webhooks)
15. [⚠️ Common Gotchas](#common-gotchas)
16. [✅ Best Practices Checklist](#best-practices-checklist)
17. [📚 Idempotent vs Exactly-Once vs At-Least-Once](#idempotent-vs-exactly-once-vs-at-least-once)
18. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| Duplicate writes | `MERGE`/upsert on a stable business key |
| Partial partition rewrite | Replace the whole partition atomically, don't append |
| Retry safety | Record completed run keys and source offsets before/after commit |
| Side effects (emails, API calls) | Deduplication key + idempotency key on the call itself |
| Failure recovery | Re-run the same job for the same input window with no manual cleanup |
| Anti-pattern | `INSERT` without a uniqueness constraint or dedup step |

## 🧠 Core Concept

An idempotent pipeline produces the **same correct result** whether it runs once or is retried five times after a timeout, crash, or manual re-trigger. Idempotency is what turns "a pipeline failed halfway through" from an incident requiring manual cleanup into a non-event — you just run it again.

```text
run 1 (crashes halfway) --> run 2 (retried, same input) --> run 3 (retried again)
        all three produce IDENTICAL final state, because the pipeline is idempotent
```

This property is what makes retries, replay, and backfills safe defaults instead of dangerous last resorts.

## 🎯 Why Idempotency Matters

- **Retries become safe.** Orchestrators (Airflow, Dagster) retry failed tasks automatically — if the task isn't idempotent, retries corrupt data instead of fixing the failure.
- **Backfills become trivial.** Reprocessing three months of history is routine, not a special, carefully-choreographed one-off.
- **Incident recovery is fast.** "Just re-run it" replaces multi-step manual cleanup runbooks.
- **Exactly-once delivery is nearly impossible to guarantee end-to-end** across distributed systems — idempotency is the practical substitute: *at-least-once delivery + idempotent processing = effectively-once results.*

## 🔑 Core Techniques

- Use **stable business keys** and `MERGE`/upsert operations instead of blind `INSERT`.
- **Replace a partition atomically** instead of appending, when reprocessing a whole window.
- **Record completed run keys and source offsets** so a retry can detect "this was already done."
- **Keep external side effects behind deduplication keys** — sending an email or firing a webhook isn't naturally idempotent, so it needs explicit protection.

## 🔀 MERGE / Upsert Pattern

```sql
MERGE INTO mart.orders AS target
USING staging.orders AS source
ON target.order_id = source.order_id
WHEN MATCHED THEN UPDATE SET status = source.status
WHEN NOT MATCHED THEN INSERT (order_id, status)
VALUES (source.order_id, source.status);
```

```python
# Python/DataFrame equivalent when writing to a lakehouse table
from delta.tables import DeltaTable

DeltaTable.forPath(spark, "s3://mart/orders").alias("target").merge(
    staged_orders.alias("source"), "target.order_id = source.order_id"
).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()
```

Running this twice with the same `staged_orders` input produces the same table state both times — the second run just re-applies no-op updates.

## 📦 Atomic Partition Replacement

```python
# Safe: whole partition replaced in one atomic write
(result.write.mode("overwrite")
    .option("replaceWhere", "run_date = '2026-09-17'")
    .partitionBy("run_date")
    .parquet("s3://mart/daily_revenue/"))

# Unsafe: appending means a retry after partial failure duplicates rows
result.write.mode("append").parquet("s3://mart/daily_revenue/")   # DON'T for retryable jobs
```

Partition overwrite makes the question "did this run already happen?" irrelevant — the output for that partition is fully determined by the input, every time.

## 🗝️ Run-Key and Offset Deduplication

```python
def process_run(run_id: str, run_date):
    if has_already_completed(run_id):
        logging.info(f"Run {run_id} already completed — skipping")
        return

    result = compute(run_date)
    with transaction():
        publish(result)
        mark_completed(run_id)   # commit output + run marker atomically

# Streaming/CDC equivalent: checkpoint offsets, not "processed" booleans
def consume_changes(topic):
    last_offset = get_committed_offset(topic)
    for message in kafka_consumer(topic, start_offset=last_offset):
        apply_change(message)
        commit_offset(topic, message.offset)   # only after successful apply
```

The critical detail: **the output write and the "mark completed" write must be atomic together** (same transaction, or the completion marker derived from the output itself) — otherwise a crash between the two leaves an inconsistent state.

## 📤 Idempotent Side Effects

```python
def send_notification(order_id, event_type):
    idempotency_key = f"{order_id}:{event_type}"
    if notification_already_sent(idempotency_key):
        return
    api_client.send(
        payload={"order_id": order_id, "event": event_type},
        headers={"Idempotency-Key": idempotency_key},   # many APIs (Stripe, etc.) support this natively
    )
    record_notification_sent(idempotency_key)
```

Side effects that leave the pipeline (emails, webhooks, payment calls) are the hardest part of idempotency because the effect happens outside your transactional boundary — always pair them with an explicit dedup key, and prefer APIs that accept an idempotency key natively.

## 🌐 Idempotency Across Layers

| Layer | Idempotent pattern |
|---|---|
| Batch write | Partition overwrite / `MERGE` on business key |
| Streaming consumer | Upsert semantics + offset checkpointing |
| CDC apply | Upsert on primary key, tombstone-aware delete |
| External API call | Client-supplied idempotency key |
| Orchestrator task | Deterministic output for a given input; safe to retry |
| File-based ingestion | Dedup on file hash/name + processed-file registry |

## 🔍 Testing for Idempotency

```python
def test_pipeline_is_idempotent():
    result_1 = run_pipeline(run_date="2026-09-17")
    result_2 = run_pipeline(run_date="2026-09-17")   # run again, same input
    assert result_1 == result_2
    assert row_count(target_table, "run_date = '2026-09-17'") == expected_row_count  # not doubled
```

Make "run it twice and diff the output" a standard test in CI for any pipeline that will be retried by an orchestrator — which is nearly all of them.

## 🗂️ Idempotent File-Based Ingestion

File-drop ingestion (SFTP, S3 event notifications, batch file uploads) needs its own dedup strategy, since "has this file already been processed" isn't answered by a partition overwrite alone — a retried job might read the *same file* and produce correct output, but a naive append still duplicates it.

```python
import hashlib

def compute_file_hash(path: str) -> str:
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()

def ingest_file(path: str):
    file_hash = compute_file_hash(path)
    if is_already_processed(file_hash):
        logging.info(f"File {path} (hash {file_hash}) already processed — skipping")
        return

    df = read_file(path)
    (df.write.mode("overwrite")
        .option("replaceWhere", f"source_file_hash = '{file_hash}'")
        .partitionBy("source_file_hash")
        .parquet("s3://staging/ingested/"))
    mark_processed(file_hash, path)   # commit atomically with the write, or derive from a table scan
```

```sql
-- Registry table pattern: an explicit ledger of what's been ingested, queryable and auditable
CREATE TABLE ingestion_registry (
    file_hash STRING PRIMARY KEY,
    file_path STRING,
    processed_at TIMESTAMP,
    row_count INT
);
```

Hashing file *contents* (not just the filename) also protects against the subtler bug where an upstream system re-delivers a file under the same name with different contents — a filename-only dedup check would silently skip the corrected file.

## 🧭 The Saga Pattern for Distributed Transactions

When a "transaction" spans multiple systems that can't share a single database transaction (e.g., reserve inventory in one service, charge a card in another, create a shipment in a third), a two-phase-commit-style all-or-nothing guarantee usually isn't practical — the **saga pattern** instead chains idempotent steps with explicit compensating actions for rollback.

```python
def run_order_saga(order):
    completed_steps = []
    try:
        reserve_inventory(order, idempotency_key=f"reserve:{order.id}")
        completed_steps.append("inventory")

        charge_payment(order, idempotency_key=f"charge:{order.id}")
        completed_steps.append("payment")

        create_shipment(order, idempotency_key=f"ship:{order.id}")
        completed_steps.append("shipment")

    except SagaStepFailed as e:
        # Compensate in reverse order — each compensation is ALSO idempotent
        if "payment" in completed_steps:
            refund_payment(order, idempotency_key=f"refund:{order.id}")
        if "inventory" in completed_steps:
            release_inventory(order, idempotency_key=f"release:{order.id}")
        raise
```

Every forward step *and* every compensating step carries its own idempotency key — the saga as a whole can be safely retried at any point (including mid-compensation) without double-charging, double-reserving, or double-refunding.

## 🌊 Exactly-Once in Flink and Kafka Transactions

Most systems settle for at-least-once + idempotent processing, but Kafka's transactional API combined with Flink's two-phase-commit sink can deliver genuine exactly-once semantics end-to-end when the extra operational cost is justified.

```java
// Kafka producer configured for transactional exactly-once writes
Properties props = new Properties();
props.put("transactional.id", "order-processor-1");
props.put("enable.idempotence", "true");

KafkaProducer<String, String> producer = new KafkaProducer<>(props);
producer.initTransactions();

try {
    producer.beginTransaction();
    producer.send(new ProducerRecord<>("processed-orders", orderId, processedPayload));
    // Commit the CONSUMER offset as part of the SAME transaction as the produce —
    // this is what makes read-process-write genuinely exactly-once
    producer.sendOffsetsToTransaction(offsets, consumerGroupMetadata);
    producer.commitTransaction();
} catch (Exception e) {
    producer.abortTransaction();
}
```

```python
# Flink: enabling exactly-once checkpointing ties source offsets, operator state,
# and sink commits into one atomic unit via two-phase commit
env.enable_checkpointing(60000, CheckpointingMode.EXACTLY_ONCE)
env.get_checkpoint_config().set_min_pause_between_checkpoints(30000)
```

The cost: transactional writes add latency and throughput overhead, and exactly-once only holds **within** the transactional boundary — if the sink is a system that isn't itself transactional (e.g., a simple REST call), you're back to needing an idempotency key on that call regardless.

## 🔑 Deep Dive: Idempotency Keys for Webhooks

Webhook delivery is inherently at-least-once from the sender's side (most providers retry on any non-2xx response or timeout), so webhook *receivers* must be built idempotent from day one.

```python
def handle_webhook(request):
    event_id = request.headers.get("X-Event-Id") or request.json()["id"]

    # Use a short-TTL cache/table as a fast dedup check before doing any real work
    if webhook_already_processed(event_id):
        return Response(status=200)   # acknowledge again — don't reprocess, but don't error either

    try:
        with transaction():
            process_webhook_event(request.json())
            mark_webhook_processed(event_id, ttl_days=30)
        return Response(status=200)
    except Exception:
        # Do NOT mark as processed on failure — let the sender's retry mechanism try again
        return Response(status=500)
```

| Design choice | Why it matters |
|---|---|
| Dedup on the provider's event ID, not your own generated ID | The provider's ID is what's stable across their retries |
| Mark "processed" only after successful handling, inside the same transaction | A crash mid-processing must NOT mark it processed — the retry needs to actually happen |
| Return 200 for already-processed events, not an error | Returning an error on a duplicate can make some providers retry more aggressively, worsening the problem |
| TTL the dedup registry, don't keep it forever | Balances storage growth against realistic retry windows (providers rarely retry past a few days) |

## ⚠️ Common Gotchas

- **Blind `INSERT`/append on retry duplicates rows** — the single most common idempotency bug.
- **Marking "completed" before the output write is durably committed** creates a window where a crash leaves the marker set but the data missing (or vice versa).
- **Non-deterministic transforms** (e.g., `CURRENT_TIMESTAMP()` embedded in business logic, unseeded random sampling) make even a `MERGE`-based pipeline produce different results on retry.
- **External side effects with no dedup key** — a retried task that "worked" internally but crashed after calling an external API will call it again.
- **Auto-incrementing surrogate keys generated per-run** — regenerating primary keys on every run breaks referential stability across retries and backfills.
- **Offsets committed before processing completes** — if you commit a Kafka offset before the downstream write succeeds, a crash silently loses that message on restart.
- **Deduping files by name instead of content hash** — a re-delivered file with the same name but corrected contents gets silently skipped.
- **A saga's compensating actions that aren't themselves idempotent** — if a compensation (refund, release) can be triggered twice during a retried rollback, you've just moved the duplication bug one layer deeper.
- **Marking a webhook processed before the handler actually succeeds** — a crash mid-handling then permanently loses that event, since the sender won't know to retry something you've already acknowledged.
- **Assuming exactly-once Kafka/Flink semantics extend past the transactional boundary** — a non-transactional downstream sink (a plain REST call) still needs its own idempotency key regardless of upstream guarantees.

## ✅ Best Practices Checklist

- [ ] Every write path uses `MERGE`/upsert or atomic partition overwrite, never blind append
- [ ] Output write and "mark completed" state change happen atomically together
- [ ] Transform logic is deterministic given its input (no embedded "now," no unseeded randomness)
- [ ] External side effects carry an explicit idempotency/dedup key
- [ ] Offsets/checkpoints are committed only after the corresponding write succeeds
- [ ] CI includes a "run twice, diff the output" test for retryable pipelines
- [ ] Surrogate keys are stable across re-runs, not regenerated per run

## 📚 Idempotent vs Exactly-Once vs At-Least-Once

| Concept | Guarantee | Practical reality |
|---|---|---|
| At-least-once delivery | Message/event delivered ≥1 time | The common default in distributed systems |
| Exactly-once delivery | Message/event delivered exactly 1 time | Very hard/expensive to guarantee end-to-end |
| Idempotent processing | Same input → same output, regardless of retry count | The practical, achievable substitute for exactly-once |

**Idempotent processing + at-least-once delivery = effectively-once results** — this is the pragmatic target for almost all real pipelines.

## 💡 Pro Tips

1. **Default to `MERGE`/upsert or partition overwrite** — treat blind append as a deliberate, rare exception, not the default.
2. **Make the completion marker derived from the output**, or commit both in one transaction — never two separate, unsynchronized writes.
3. **Remove non-determinism from transform logic** — pass `run_date`/`now()` in as a parameter, don't call a clock function inside the transform.
4. **Give every external side effect an idempotency key**, and prefer APIs (Stripe, many webhook providers) that support one natively.
5. **Test idempotency explicitly in CI** — "run twice, assert identical output" catches regressions before production does.
6. **Checkpoint after successful processing, not before** — commit offsets/markers only once the corresponding write is durable.
7. **Keep surrogate keys stable** across re-runs — derive them from business keys via a stable hash or a persistent key-mapping table, not a fresh auto-increment per run.
8. **Treat idempotency as a design constraint from day one** — retrofitting it after a pipeline is in production is far more expensive than building it in from the start.
9. **Document the pipeline's idempotency boundary** — which layer guarantees it (the write, the orchestrator retry, the consumer) so nobody accidentally breaks it during a refactor.
10. **Assume retries will happen** — orchestrators retry by default; design every task as if it will run at least twice.
11. **Hash file contents, not filenames**, for dedup in any file-drop ingestion pipeline.
12. **Give every saga step a matching, equally idempotent compensating action** before relying on the saga pattern for cross-service transactions.
13. **Mark webhooks processed only after successful handling, inside the same transaction** as the work itself.
14. **Reach for Kafka transactions/Flink exactly-once only when the operational cost is justified** — at-least-once + idempotent processing is sufficient for the large majority of pipelines.
15. **Dedup webhook receivers on the provider's event ID**, and return success (not an error) for already-processed duplicates to avoid triggering more aggressive retries.

