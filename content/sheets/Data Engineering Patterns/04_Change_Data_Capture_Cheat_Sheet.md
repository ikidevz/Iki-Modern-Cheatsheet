# Change Data Capture (CDC) Cheatsheet for Data Engineers

> A structured reference for capturing and propagating row-level changes from source databases — log-based vs query-based CDC, ordering and exactly-once semantics, schema drift, and the Debezium/Kafka stack. Expanded from a short pattern note into a full implementation and operations guide.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 When to Use CDC](#when-to-use-cdc)
4. [🔬 CDC Capture Methods](#cdc-capture-methods)
5. [🏗️ Reference Architecture](#reference-architecture)
6. [🔧 Consuming Changes](#consuming-changes)
7. [🪦 Handling Tombstones and Deletes](#handling-tombstones-and-deletes)
8. [📐 Ordering Guarantees](#ordering-guarantees)
9. [🔄 Schema Changes in CDC Streams](#schema-changes-in-cdc-streams)
10. [🛠️ Tooling Landscape](#tooling-landscape)
11. [🔍 Monitoring and Lag](#monitoring-and-lag)
12. [📮 The Outbox Pattern for Cross-Table Ordering](#the-outbox-pattern-for-cross-table-ordering)
13. [🐬 Connector Configuration Examples](#connector-configuration-examples)
14. [🏔️ Landing CDC into a Lakehouse](#landing-cdc-into-a-lakehouse)
15. [🔁 Reprocessing and Re-Snapshotting](#reprocessing-and-re-snapshotting)
16. [🧪 Testing CDC Pipelines](#testing-cdc-pipelines)
17. [🔀 Multi-Table Transactional Consistency](#multi-table-transactional-consistency)
18. [⚠️ Common Gotchas](#common-gotchas)
19. [✅ Best Practices Checklist](#best-practices-checklist)
20. [📚 CDC vs Full-Scan vs Batch Extract](#cdc-vs-full-scan-vs-batch-extract)
21. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| Capture method | Log-based (transaction log / WAL / binlog) preferred over query-based |
| Ordering unit | Per-key ordering guaranteed; global ordering usually not |
| Checkpoint | Source log position (LSN / binlog offset / SCN) |
| Delete handling | Tombstone events, explicit `operation == 'DELETE'` |
| Common stack | Debezium + Kafka (or Kafka Connect), or managed (Fivetran, AWS DMS) |
| Failure recovery | Resume from last committed offset — never re-scan the full table |
| Consumer pattern | Upsert (merge) on primary key, delete on tombstone |

## 🧠 Core Concept

CDC publishes **inserts, updates, and deletes** from a source database as a stream of events, instead of repeatedly running `SELECT * FROM table` and diffing. It reads the database's internal transaction log — the same mechanism the database itself uses for replication — so it sees every committed change, in the order committed, with negligible load on the source.

```text
[ source DB transaction log ]  -->  [ CDC connector tails the log ]  -->  [ change events on a topic ]  -->  [ consumers apply upserts/deletes ]
```

This is fundamentally different from batch extraction: CDC is push-based and continuous, batch extraction is pull-based and periodic.

## 🎯 When to Use CDC

**Use CDC when:**
- A downstream warehouse or replica must stay close (seconds-to-minutes) to an OLTP source.
- Event-driven consumers need row-level changes, not periodic snapshots.
- The source table is too large or too write-heavy to re-scan on a schedule.
- You need to capture deletes, which periodic snapshot diffs often miss or handle expensively.

**Avoid CDC when:**
- The source doesn't expose a transaction log (some managed databases restrict this) and query-based CDC's polling overhead isn't acceptable.
- A daily batch extract already meets freshness requirements — CDC adds real operational complexity for no benefit.
- The source schema changes extremely frequently in incompatible ways with no coordination process.

## 🔬 CDC Capture Methods

| Method | How it works | Pros | Cons |
|---|---|---|---|
| Log-based | Tails the DB transaction log (WAL, binlog, redo log) | Low source load, captures deletes, ordered | Requires log access/retention, DB-specific connector |
| Query-based (timestamp) | Polls `WHERE updated_at > last_seen` | Simple, no special DB config | Misses hard deletes, misses updates that don't touch a timestamp column |
| Trigger-based | DB triggers write to a shadow "changes" table | Works on any schema | Adds write overhead to every transaction on the source |
| Snapshot + log (hybrid) | Initial full snapshot, then switch to log tailing | Correct initial state + low ongoing load | Snapshot phase can be slow on huge tables |

## 🏗️ Reference Architecture

```text
PostgreSQL (WAL) --> Debezium connector --> Kafka topic (per table) --> Kafka Connect sink / custom consumer --> Warehouse (upsert)
```

```python
# Simplified consumer loop against a change stream (Debezium-style envelope)
def consume_changes(topic: str):
    for message in kafka_consumer(topic):
        yield parse_debezium_envelope(message)  # -> {operation, before, after, source_lsn}

for change in consume_changes("orders"):
    if change.operation == "DELETE":
        warehouse.delete("orders", change.key)
    else:
        warehouse.upsert("orders", change.after)
    checkpoint(change.source_lsn)
```

A Debezium envelope typically looks like:

```json
{
  "before": {"id": 42, "status": "pending"},
  "after": {"id": 42, "status": "shipped"},
  "source": {"table": "orders", "lsn": 98234123, "ts_ms": 1737020000000},
  "op": "u",
  "ts_ms": 1737020000123
}
```

## 🔧 Consuming Changes

```sql
-- Applying a batch of CDC events as a MERGE (works well when consuming in micro-batches)
MERGE INTO warehouse.orders AS target
USING staged_changes AS source
ON target.order_id = source.order_id
WHEN MATCHED AND source.op = 'd' THEN DELETE
WHEN MATCHED AND source.op IN ('u', 'c') THEN UPDATE SET *
WHEN NOT MATCHED AND source.op IN ('u', 'c') THEN INSERT *;
```

```python
# Idempotent per-record apply (safe to replay from an earlier offset)
def apply_change(warehouse, change):
    if change.operation == "DELETE":
        warehouse.delete("orders", key=change.before["id"])
    else:
        # upsert is naturally idempotent: applying the same row twice is a no-op
        warehouse.upsert("orders", key=change.after["id"], row=change.after)
```

## 🪦 Handling Tombstones and Deletes

Kafka-based CDC often emits a **tombstone**: a message with the same key and a `null` value, signaling "this key is fully deleted and can be compacted away."

```python
def handle_message(message):
    if message.value is None:
        # Tombstone: safe to hard-delete from the sink, and let log compaction reclaim the topic
        warehouse.delete("orders", key=message.key)
    else:
        change = parse_debezium_envelope(message)
        apply_change(warehouse, change)
```

Don't confuse a tombstone (compaction signal) with a `"op": "d"` delete event (business delete) — a well-configured connector emits both, one after the other, and consumers should handle each correctly.

## 📐 Ordering Guarantees

- **Per-key ordering is guaranteed** when the CDC topic is partitioned by primary key — all changes to row `id=42` land in the same partition, in commit order.
- **Cross-key / cross-table ordering is not guaranteed** — don't assume an `orders` change and a related `order_items` change arrive in a globally consistent order without extra coordination (e.g., outbox pattern, transactional metadata).
- Always **checkpoint the source log position** (LSN/offset), not a wall-clock timestamp, so recovery resumes exactly where it left off.

## 🔄 Schema Changes in CDC Streams

CDC streams carry the source schema as-is, so a source `ALTER TABLE` shows up mid-stream.

```python
def apply_change(warehouse, change, schema_registry):
    schema = schema_registry.resolve(change.schema_id)
    # Additive changes (new nullable column): apply directly
    # Breaking changes (type change, column drop): route to a dead-letter topic for manual review
    if schema.has_breaking_change_since(warehouse.current_schema("orders")):
        dead_letter(change)
        return
    warehouse.upsert("orders", change.after)
```

See [schema-evolution.md](./Schema_Evolution_Cheat_Sheet.md) for compatibility rules that apply directly to CDC payloads.

## 🛠️ Tooling Landscape

| Category | Tools |
|---|---|
| Log-based CDC connectors | Debezium, AWS DMS, native Postgres/MySQL logical replication |
| Streaming backbone | Kafka, Redpanda, Kinesis, Pub/Sub |
| Managed CDC (batteries included) | Fivetran, Airbyte, Estuary Flow, StreamSets |
| Sink/apply frameworks | Kafka Connect sinks, custom consumers, Delta/Iceberg `MERGE` |

## 🔍 Monitoring and Lag

```python
# Consumer lag = how far behind the CDC pipeline is from the source's current log position
lag_seconds = current_source_lsn_timestamp - last_processed_change.ts_ms / 1000
emit_metric("cdc_consumer_lag_seconds", lag_seconds, tags={"table": "orders"})
```

Track: consumer lag, connector task failures/restarts, dead-letter queue depth, and snapshot completion time for newly-added tables.

## 📮 The Outbox Pattern for Cross-Table Ordering

When a single business transaction touches multiple tables (e.g., creating an order *and* its line items) and downstream consumers need a consistent, ordered view of that transaction, plain per-table CDC isn't enough — each table's changes land on its own topic/partition with no cross-table ordering guarantee.

```sql
-- The application writes its normal tables AND an outbox row, in the SAME transaction
BEGIN;
INSERT INTO orders (id, customer_id, status) VALUES (42, 7, 'created');
INSERT INTO order_items (order_id, sku, qty) VALUES (42, 'SKU-1', 2);
INSERT INTO outbox_events (aggregate_id, event_type, payload, created_at)
VALUES (42, 'OrderCreated', '{"order_id":42,"items":[{"sku":"SKU-1","qty":2}]}', now());
COMMIT;
```

```python
# CDC then only needs to tail the outbox_events table (one clean event per transaction),
# instead of stitching together separate orders/order_items change streams
def consume_outbox_events(topic="outbox_events"):
    for change in consume_changes(topic):
        event = json.loads(change.after["payload"])
        publish_business_event(change.after["event_type"], event)
```

This shifts the ordering/consistency problem from "reconstruct it downstream from multiple CDC streams" to "the producer already emitted one consistent event per transaction" — much easier to reason about, at the cost of adding outbox-table writes to the application.

## 🐬 Connector Configuration Examples

```json
// Debezium PostgreSQL connector config (via Kafka Connect REST API)
{
  "name": "orders-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "prod-db.internal",
    "database.port": "5432",
    "database.user": "cdc_replication",
    "database.dbname": "app",
    "topic.prefix": "prod",
    "table.include.list": "public.orders,public.order_items",
    "plugin.name": "pgoutput",
    "slot.name": "orders_cdc_slot",
    "publication.autocreate.mode": "filtered",
    "snapshot.mode": "initial",
    "heartbeat.interval.ms": "10000"
  }
}
```

```json
// Debezium MySQL connector — note the binlog-specific settings
{
  "name": "mysql-orders-connector",
  "config": {
    "connector.class": "io.debezium.connector.mysql.MySqlConnector",
    "database.hostname": "mysql-prod.internal",
    "database.server.id": "184054",
    "database.include.list": "shop",
    "table.include.list": "shop.orders",
    "database.history.kafka.topic": "schema-changes.shop",
    "include.schema.changes": "true",
    "snapshot.mode": "when_needed"
  }
}
```

Key settings to always set deliberately: **`snapshot.mode`** (controls initial-load behavior), **`heartbeat.interval.ms`** (keeps the log position advancing even on low-traffic tables, which matters for lag monitoring), and an explicit **replication slot/publication scope** (don't grant a blanket "replicate everything" slot on a shared production database).

## 🏔️ Landing CDC into a Lakehouse

```python
# Micro-batch consumption of CDC events, applied as a MERGE into a Delta table
def apply_cdc_batch(spark, changes_df, target_table: str):
    from delta.tables import DeltaTable
    target = DeltaTable.forName(spark, target_table)

    (target.alias("t")
        .merge(changes_df.alias("s"), "t.order_id = s.order_id")
        .whenMatchedDelete(condition="s.op = 'd'")
        .whenMatchedUpdateAll(condition="s.op IN ('u', 'c')")
        .whenNotMatchedInsertAll(condition="s.op IN ('u', 'c')")
        .execute())
```

```python
# Structured Streaming: consume the CDC Kafka topic continuously and apply via foreachBatch
def process_micro_batch(batch_df, batch_id):
    apply_cdc_batch(spark, batch_df, "core.orders")

(spark.readStream
    .format("kafka")
    .option("subscribe", "prod.public.orders")
    .load()
    .selectExpr("CAST(value AS STRING) as json")
    .select(F.from_json("json", cdc_schema).alias("data"))
    .select("data.*")
    .writeStream
    .foreachBatch(process_micro_batch)
    .option("checkpointLocation", "s3://checkpoints/orders_cdc/")
    .start())
```

The `checkpointLocation` here is what makes the streaming apply idempotent across restarts — Spark Structured Streaming tracks processed Kafka offsets in the checkpoint, resuming exactly where it left off.

## 🔁 Reprocessing and Re-Snapshotting

Sometimes you need to force a fresh snapshot: a consumer had a long bug that corrupted the sink, or a new table was added to an existing connector.

```json
// Debezium: trigger an incremental (ad hoc) snapshot for a specific table
// without stopping the connector or affecting other tables' ongoing streaming
{
  "type": "execute-snapshot",
  "data": {
    "data-collections": ["public.orders"],
    "type": "incremental"
  }
}
```

```python
# Manual full re-sync pattern: pause the connector, truncate the sink table,
# reset the connector's offset, and let it re-snapshot from scratch
def full_resync(connector_name, sink_table):
    pause_connector(connector_name)
    truncate_table(sink_table)
    reset_connector_offsets(connector_name)   # forces snapshot.mode to re-trigger
    resume_connector(connector_name)
```

Prefer Debezium's **incremental snapshot** feature over a full pause/truncate/resume where available — it re-snapshots specific tables without an all-or-nothing outage for every table on the connector.

## 🧪 Testing CDC Pipelines

```python
def test_upsert_apply_is_idempotent():
    change = make_change(op="u", after={"id": 42, "status": "shipped"})
    apply_change(warehouse, change)
    apply_change(warehouse, change)   # apply twice
    assert warehouse.get("orders", 42)["status"] == "shipped"   # no duplication, no error

def test_delete_removes_row():
    apply_change(warehouse, make_change(op="d", before={"id": 42}))
    assert warehouse.get("orders", 42) is None

def test_out_of_order_replay_is_safe():
    """Simulates re-consuming from an earlier offset after a checkpoint failure."""
    older_change = make_change(op="u", after={"id": 42, "status": "pending"}, lsn=100)
    newer_change = make_change(op="u", after={"id": 42, "status": "shipped"}, lsn=200)
    apply_change(warehouse, newer_change)
    apply_change(warehouse, older_change)   # replayed out of order
    # A naive upsert would incorrectly revert to "pending" here — assert your
    # apply logic checks LSN/version and discards stale replays
    assert warehouse.get("orders", 42)["status"] == "shipped"
```

That last test matters more than it looks: consumers that blindly `UPDATE SET *` without comparing source LSN/version can regress a row's state when offsets are replayed after a crash.

## 🔀 Multi-Table Transactional Consistency

```python
# Consuming multiple related CDC topics and buffering until a consistent
# "transaction boundary" marker (Debezium emits transaction metadata events)
def consume_with_transaction_boundaries():
    buffer = []
    for message in consume_changes("transaction"):  # Debezium's transaction metadata topic
        if message["status"] == "BEGIN":
            buffer = []
        elif message["status"] == "END":
            apply_buffered_changes_atomically(buffer)
            buffer = []
        else:
            buffer.append(message)
```

Debezium can emit a dedicated **transaction metadata topic** that marks transaction boundaries across all tables captured by a connector — use it when downstream consumers need "all changes from this source transaction, applied together" rather than the simpler (and usually sufficient) per-table upsert model.

## ⚠️ Common Gotchas

- **Initial snapshot can lock or heavily load the source table** on large tables — schedule it during low-traffic windows and use incremental snapshotting where supported.
- **Log retention on the source can expire before the connector catches up** after downtime, forcing a full re-snapshot — size log retention to your worst-case connector downtime.
- **Tombstones vs delete events are not the same thing** — mishandling either causes phantom or missing rows downstream.
- **Compacted Kafka topics only keep the latest value per key** — if downstream needs full history, don't rely on the topic as the system of record; land it in an append-only store first.
- **DDL on the source (column add/drop/rename) breaks naive consumers** — always validate schema compatibility before applying.
- **At-least-once delivery is the norm** — consumers must be idempotent (upsert semantics), not assume exactly-once arrival.
- **Blindly applying `UPDATE SET *` without checking LSN/version** can regress a row's state when offsets are replayed out of order after a checkpoint failure.
- **A shared, unscoped replication slot** ("replicate everything") on a production database is both a security risk and a performance risk if the connector falls behind — scope slots/publications to specific tables.
- **Forgetting `heartbeat.interval.ms`** on low-traffic tables means the log position appears frozen, making lag metrics misleading even when the connector is healthy.
- **Treating the outbox pattern as optional** when downstream consumers actually need cross-table transactional consistency — without it, "eventually consistent, individually correct" per-table streams can look inconsistent together.

## ✅ Best Practices Checklist

- [ ] Capture uses log-based CDC where the source supports it
- [ ] Consumers checkpoint the source log position, not wall-clock time
- [ ] Deletes and tombstones both have explicit, tested handling
- [ ] Consumer apply logic is idempotent (safe to replay from an earlier offset)
- [ ] Schema changes are validated for compatibility before being applied downstream
- [ ] Consumer lag and connector health are monitored and alerted on
- [ ] Log retention on the source covers the worst realistic connector downtime

## 📚 CDC vs Full-Scan vs Batch Extract

| Dimension | CDC (log-based) | Full-scan batch extract |
|---|---|---|
| Source load | Very low (reads log, not table) | High (full table scan each run) |
| Freshness | Seconds–minutes | Hours (schedule-dependent) |
| Captures deletes | Yes, natively | Only via full diff, expensive |
| Setup complexity | Higher (connector, log access, ordering) | Lower |
| Best fit | Warehouse sync, event-driven systems | Small tables, infrequent freshness needs |

## 💡 Pro Tips

1. **Prefer log-based CDC over query-based polling** whenever the source supports it — it's the only method that reliably captures deletes.
2. **Design consumers as upserts, always** — at-least-once delivery means replays will happen.
3. **Partition CDC topics by primary key** to get per-row ordering for free.
4. **Treat the outbox pattern** as the fix when you need ordering guarantees across multiple tables in one transaction.
5. **Alert on consumer lag, not just connector "up/down"** — a connector can be running and still fall behind.
6. **Size log retention generously** — a connector outage that exceeds log retention forces an expensive re-snapshot.
7. **Validate schema compatibility before applying**, and dead-letter anything breaking rather than silently corrupting the sink.
8. **Don't use a compacted topic as your historical system of record** — land raw CDC events in an append-only store if you need full history/audit.
9. **Test your delete path explicitly** — deletes are the change type most commonly forgotten in consumer logic.
10. **Version your CDC event schema** in a registry so producer and consumer evolution stays coordinated.
11. **Use the outbox pattern** whenever a consumer needs a consistent, ordered view across multiple tables changed in one transaction.
12. **Compare LSN/version on apply**, not just the key, to guard against out-of-order replays regressing row state.
13. **Scope replication slots/publications to specific tables** rather than granting connector access to an entire database.
14. **Prefer Debezium's incremental (ad hoc) snapshot** over a full pause/truncate/resync when only one table needs re-snapshotting.
15. **Write an explicit "replay out of order" test** for your apply logic — it's the CDC bug class that's easiest to introduce and hardest to notice in code review.

