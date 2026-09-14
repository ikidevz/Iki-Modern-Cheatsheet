# CDC & Idempotent Processing — System Design for Data Engineers

> Capturing source-system changes without duplicating or losing data — log-based vs.
> query-based CDC, ordering across streams, and the idempotent-upsert pattern that makes
> replay and backfill safe.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Quick-Reference Table](#quick-reference-table)
3. [Log-Based vs. Query-Based CDC](#log-based-vs-query-based-cdc)
4. [Ordering & Out-of-Order Events](#ordering--out-of-order-events)
5. [Idempotency: The Core Idea](#idempotency-the-core-idea)
6. [Python: An Idempotent CDC Applier](#python-an-idempotent-cdc-applier)
7. [Idempotency Keys for General Event Streams](#idempotency-keys-for-general-event-streams)
8. [SQL MERGE as an Idempotent Upsert](#sql-merge-as-an-idempotent-upsert)
9. [The Transactional Outbox Pattern](#the-transactional-outbox-pattern)
10. [Bootstrapping CDC: Initial Snapshot + Incremental](#bootstrapping-cdc-initial-snapshot--incremental)
11. [Common CDC Tools](#common-cdc-tools)
12. [Handling Schema Changes in CDC Streams](#handling-schema-changes-in-cdc-streams)
13. [Gotchas](#gotchas)
14. [Pro Tips](#pro-tips)

---

## Core Concepts

**Change Data Capture (CDC)** is the practice of capturing row-level inserts, updates, and
deletes from a source database as a stream of events, rather than periodically re-querying
the whole table. It's the backbone of most modern batch-replacement and real-time replication
architectures.

**Idempotency** is the property that applying the same operation more than once produces the
same result as applying it once. In CDC (and streaming generally) this matters because
**at-least-once delivery is the realistic default** — networks retry, consumers crash and
reprocess uncommitted batches, and CDC connectors sometimes redeliver events after a restart.
If your write logic isn't idempotent, "at-least-once + redelivery" silently becomes
"sometimes-more-than-once," which corrupts aggregates and duplicates records.

## Quick-Reference Table

| Concept | Summary |
|---|---|
| Log-based CDC | Reads the source DB's write-ahead/binary log directly (e.g. MySQL binlog, Postgres WAL) |
| Query-based CDC | Periodically polls the table for rows changed since the last poll (e.g. via an `updated_at` column) |
| LSN / offset | A monotonically increasing position in the change log used to order and dedup events |
| Idempotent upsert | A write that's safe to apply more than once — typically `MERGE`/`INSERT ... ON CONFLICT` keyed by primary key + a change-ordering column |
| At-least-once delivery | The realistic default guarantee for most streaming/CDC systems; correctness comes from idempotent consumers, not from the delivery guarantee alone |
| Exactly-once *processing* | Achieved in practice as "at-least-once delivery + idempotent writes," not as a literal guarantee from the transport layer |

## Log-Based vs. Query-Based CDC

| | Log-Based CDC | Query-Based CDC |
|---|---|---|
| **Mechanism** | Tails the database's internal write-ahead log (binlog/WAL) | Polls the table with `WHERE updated_at > last_checkpoint` |
| **Captures deletes?** | Yes (a delete is a distinct log entry) | Only if soft-deleted (a hard `DELETE` leaves no row to poll) |
| **Source load** | Low — reads the log, not the table | Higher — repeated polling queries hit the live table |
| **Latency** | Near-real-time (seconds) | Bound by poll interval |
| **Requires source changes?** | Usually needs log access enabled (e.g. `binlog_format=ROW`) | Usually needs an `updated_at` column maintained on every table |
| **Common tools** | Debezium, AWS DMS, Fivetran (log-based connectors) | Custom polling jobs, some SaaS connectors |

**Default recommendation** in most interviews: log-based CDC (via Debezium or a managed
equivalent) whenever the source system supports it — it's lower-overhead on the source,
captures deletes correctly, and gives you a natural ordering key (the LSN) for free.

## Ordering & Out-of-Order Events

CDC events from a *single* source table are typically delivered in log order. But once
events flow through a distributed message broker with multiple partitions, or are captured
from *multiple* source tables/shards, **cross-key ordering is not guaranteed** — only
per-key ordering (if you partition the broker topic by primary key) is realistic to rely on.

Design implication: never assume "the event I received most recently is the newest change."
Always compare against an explicit ordering field (LSN, source timestamp, or a monotonic
version column) before applying a write — this is the foundation idempotent CDC processing
is built on.

## Idempotency: The Core Idea

```
Naive (NOT idempotent):           Idempotent:
  UPDATE table SET                  MERGE INTO table USING (event) ON key
    balance = balance + amount        WHEN MATCHED AND event.lsn > table.last_lsn
  WHERE key = X                         THEN UPDATE SET ..., last_lsn = event.lsn
                                       WHEN NOT MATCHED THEN INSERT (..., last_lsn)
  Replaying this twice DOUBLE-      Replaying this twice is a no-op the second time --
  APPLIES the amount.                the LSN check makes re-application safe.
```

The pattern generalizes: **never write logic whose result depends on "how many times has
this run," only on "what is the current known state and the new event's position relative
to it."**

## Python: An Idempotent CDC Applier

A simulation of applying a CDC stream to a target table using an LSN-guarded upsert — this
is the mechanism that makes duplicate delivery and out-of-order arrival both safe:

```python
from dataclasses import dataclass
from typing import Dict, Optional, List
from enum import Enum


class ChangeOp(Enum):
    INSERT = "INSERT"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


@dataclass
class CDCEvent:
    lsn: int              # log sequence number -- monotonically increasing at the source
    op: ChangeOp
    key: str
    payload: Optional[dict]


class IdempotentCDCApplier:
    """Applies a CDC stream to a target table using MERGE-style idempotent upserts keyed
    by (primary key, LSN) rather than blind 'last received wins' -- this is what makes
    replaying the same event, or receiving it out of order/twice, safe."""

    def __init__(self):
        self.table: Dict[str, dict] = {}
        self.last_applied_lsn: Dict[str, int] = {}
        self.applied_count = 0
        self.skipped_stale_count = 0

    def apply(self, event: CDCEvent) -> str:
        last_lsn = self.last_applied_lsn.get(event.key, -1)

        if event.lsn <= last_lsn:
            # We've already applied an equal-or-newer change for this key --
            # reprocessing/duplicate delivery becomes a safe no-op.
            self.skipped_stale_count += 1
            return "skipped_stale_or_duplicate"

        if event.op == ChangeOp.DELETE:
            self.table.pop(event.key, None)
        else:
            self.table[event.key] = event.payload

        self.last_applied_lsn[event.key] = event.lsn
        self.applied_count += 1
        return "applied"


applier = IdempotentCDCApplier()
stream: List[CDCEvent] = [
    CDCEvent(lsn=100, op=ChangeOp.INSERT, key="cust_1", payload={"name": "Alice", "tier": "gold"}),
    CDCEvent(lsn=101, op=ChangeOp.UPDATE, key="cust_1", payload={"name": "Alice", "tier": "platinum"}),
    CDCEvent(lsn=100, op=ChangeOp.INSERT, key="cust_1", payload={"name": "Alice", "tier": "gold"}),  # duplicate redelivery
    CDCEvent(lsn=102, op=ChangeOp.INSERT, key="cust_2", payload={"name": "Bob", "tier": "silver"}),
    CDCEvent(lsn=99,  op=ChangeOp.UPDATE, key="cust_1", payload={"name": "Alice", "tier": "STALE"}),  # arrives late, out of order
    CDCEvent(lsn=103, op=ChangeOp.DELETE, key="cust_2", payload=None),
]

for e in stream:
    result = applier.apply(e)
    print(f"lsn={e.lsn:>3} op={e.op.value:<7} key={e.key:<8} -> {result}")

print("\nFinal table state:", applier.table)
print("Applied:", applier.applied_count, "| Skipped (stale/duplicate):", applier.skipped_stale_count)
```

Output:

```
lsn=100 op=INSERT  key=cust_1   -> applied
lsn=101 op=UPDATE  key=cust_1   -> applied
lsn=100 op=INSERT  key=cust_1   -> skipped_stale_or_duplicate
lsn=102 op=INSERT  key=cust_2   -> applied
lsn= 99 op=UPDATE  key=cust_1   -> skipped_stale_or_duplicate
lsn=103 op=DELETE  key=cust_2   -> applied

Final table state: {'cust_1': {'name': 'Alice', 'tier': 'platinum'}}
Applied: 4 | Skipped (stale/duplicate): 2
```

Note that `cust_1` correctly ends up as `platinum` (the highest-LSN change, lsn=101) even
though a stale `lsn=99` update and a duplicate `lsn=100` insert both arrived in the stream —
the LSN check silently absorbed both without corrupting state.

## Idempotency Keys for General Event Streams

Not every stream naturally carries an ordering field like LSN (e.g. a user-clickstream
event isn't "updating" anything, it's an independent fact). For these, idempotency is
usually achieved with a **unique event ID** and a dedup store:

```python
class IdempotentEventConsumer:
    """For append-only event streams (not CDC upserts): dedup by event_id within a
    retention window, since a truly append-only fact table has nothing to 'overwrite' --
    the risk is pure duplication, not stale overwrites."""

    def __init__(self):
        self.seen_ids: set = set()
        self.events: list = []

    def consume(self, event_id: str, payload: dict) -> str:
        if event_id in self.seen_ids:
            return "duplicate_ignored"
        self.seen_ids.add(event_id)
        self.events.append(payload)
        return "appended"


consumer = IdempotentEventConsumer()
print(consumer.consume("evt_001", {"user": "u1", "action": "click"}))
print(consumer.consume("evt_001", {"user": "u1", "action": "click"}))  # redelivered
print(consumer.consume("evt_002", {"user": "u2", "action": "view"}))
print("Total distinct events stored:", len(consumer.events))
```

Output:

```
appended
duplicate_ignored
appended
Total distinct events stored: 2
```

At production scale, `seen_ids` becomes a bounded structure (a time-windowed set, a
key-value store with TTL, or a probabilistic structure like a Bloom filter when memory is
the constraint and a small false-positive dedup rate is acceptable).

## SQL MERGE as an Idempotent Upsert

The pattern above translated into the SQL most warehouses/lakehouses actually run:

```sql
MERGE INTO dim_customer AS target
USING staged_cdc_events AS source
ON target.customer_id = source.customer_id
WHEN MATCHED AND source.lsn > target.last_applied_lsn AND source.op != 'DELETE'
    THEN UPDATE SET
        name = source.name,
        tier = source.tier,
        last_applied_lsn = source.lsn
WHEN MATCHED AND source.lsn > target.last_applied_lsn AND source.op = 'DELETE'
    THEN DELETE
WHEN NOT MATCHED AND source.op != 'DELETE'
    THEN INSERT (customer_id, name, tier, last_applied_lsn)
    VALUES (source.customer_id, source.name, source.tier, source.lsn);
```

Re-running this exact statement against the same staged batch a second time is a no-op —
the `source.lsn > target.last_applied_lsn` guard is doing the same job as the Python
`if event.lsn <= last_lsn` check above.

## The Transactional Outbox Pattern

A subtle problem lurks whenever a service needs to **both** write to its own database
**and** publish an event about that write: those are two separate systems, and there's no
way to make an ordinary database transaction and a message-broker publish atomic together.
If the DB commit succeeds but the publish fails (or vice versa), you get silent
inconsistency — this is the classic **dual-write problem**.

The **outbox pattern** solves it by writing the event into an `outbox` table in the **same**
local database transaction as the business write — since both are now in the same database,
they're atomic together for free. A separate poller (or, cleanly, log-based CDC applied to
the outbox table itself) then reliably publishes those rows to the actual message broker.

```python
from typing import Dict, List
import itertools


class OutboxDB:
    """Simulates committing a business write and its corresponding event in the SAME
    local transaction, into an `outbox` table -- avoiding the dual-write problem."""

    def __init__(self):
        self.orders: Dict[str, dict] = {}
        self.outbox: List[dict] = []
        self._seq = itertools.count(1)

    def place_order(self, order_id: str, payload: dict):
        # In a real DB, this INSERT into `orders` and INSERT into `outbox` happen in ONE
        # transaction -- either both commit or neither does.
        self.orders[order_id] = payload
        self.outbox.append({"seq": next(self._seq), "event_type": "OrderPlaced",
                             "order_id": order_id, "payload": payload, "published": False})

    def poll_and_publish(self) -> List[dict]:
        """A separate process (or CDC on the outbox table) reads unpublished rows and
        publishes them to a message broker, then marks them published."""
        to_publish = [e for e in self.outbox if not e["published"]]
        for e in to_publish:
            e["published"] = True
        return to_publish


db = OutboxDB()
db.place_order("o1", {"item": "widget", "qty": 3})
db.place_order("o2", {"item": "gadget", "qty": 1})

published = db.poll_and_publish()
print("Published events:", [(e["seq"], e["event_type"], e["order_id"]) for e in published])
print("Polling again (nothing new):", db.poll_and_publish())
```

Output:

```
Published events: [(1, 'OrderPlaced', 'o1'), (2, 'OrderPlaced', 'o2')]
Polling again (nothing new): []
```

Note the poller itself needs to be idempotent too (marking a row `published` before or as
part of the actual broker acknowledgment, with retry-safe logic) — the outbox pattern
solves the *dual-write* problem, but the publish step downstream of it still needs the same
at-least-once-plus-idempotent discipline as everything else in this file.

## Bootstrapping CDC: Initial Snapshot + Incremental

Every CDC pipeline has a "day 1" problem: before you can apply incremental changes, you need
an initial full snapshot of the source table. Getting the boundary between "snapshot" and
"incremental log" exactly right matters — get it wrong and you either duplicate or silently
drop rows that changed *while* the snapshot was being taken.

```python
from typing import Dict, List, Optional


class BootstrappedCDCConsumer:
    """A real CDC pipeline needs an initial full-table SNAPSHOT to seed the target,
    followed by incremental log-based changes starting from the exact LSN the snapshot
    was taken at."""

    def __init__(self):
        self.table: Dict[str, dict] = {}
        self.snapshot_done = False
        self.snapshot_lsn: Optional[int] = None

    def apply_snapshot(self, rows: List[dict], as_of_lsn: int):
        for row in rows:
            self.table[row["id"]] = row
        self.snapshot_done = True
        self.snapshot_lsn = as_of_lsn

    def apply_incremental(self, lsn: int, row: dict) -> str:
        if not self.snapshot_done:
            return "rejected_snapshot_not_done"
        if lsn <= self.snapshot_lsn:
            # already reflected in (or predates) the snapshot -- skip, don't reapply
            return "skipped_covered_by_snapshot"
        self.table[row["id"]] = row
        return "applied"


consumer = BootstrappedCDCConsumer()
consumer.apply_snapshot(
    rows=[{"id": "c1", "name": "Alice", "tier": "gold"}, {"id": "c2", "name": "Bob", "tier": "silver"}],
    as_of_lsn=500,
)
print("After snapshot:", consumer.table)

# a change that happened DURING the snapshot window -- already covered, must skip
print(consumer.apply_incremental(lsn=480, row={"id": "c1", "name": "Alice", "tier": "STALE"}))
# a change that happened AFTER the snapshot -- must apply
print(consumer.apply_incremental(lsn=510, row={"id": "c1", "name": "Alice", "tier": "platinum"}))
print("Final table:", consumer.table)
```

Output:

```
After snapshot: {'c1': {'id': 'c1', 'name': 'Alice', 'tier': 'gold'}, 'c2': {'id': 'c2', 'name': 'Bob', 'tier': 'silver'}}
skipped_covered_by_snapshot
applied
Final table: {'c1': {'id': 'c1', 'name': 'Alice', 'tier': 'platinum'}, 'c2': {'id': 'c2', 'name': 'Bob', 'tier': 'silver'}}
```

The critical detail: a real CDC tool (Debezium included) records the exact log position
**at the moment the snapshot query runs**, and only applies incremental changes strictly
after that position — this is precisely what `as_of_lsn` represents here. Without this
boundary, a row updated mid-snapshot could either be missed entirely (if the snapshot query
read it before the update, and the incremental stream is started from a position after the
update already happened) or double-processed.

## Common CDC Tools

| Tool | Notes |
|---|---|
| **Debezium** | Open-source, log-based CDC for MySQL/Postgres/MongoDB/SQL Server/Oracle; publishes change events to Kafka |
| **AWS DMS** | Managed log-based CDC into S3/Redshift/Kinesis |
| **Fivetran / Airbyte** | Managed connectors, some log-based, many query-based depending on the source |
| **Snowflake Streams** | Native change-tracking on a Snowflake table, consumed via `SELECT * FROM stream` then `MERGE` |
| **Delta Lake Change Data Feed (CDF)** | Exposes row-level changes on a Delta table itself, for downstream consumers |

## Handling Schema Changes in CDC Streams

- Log-based CDC tools typically propagate DDL changes (new column, type change) as their own
  event type — your consumer needs an explicit strategy: fail loudly, auto-add nullable
  columns, or quarantine the batch for review.
- **Never silently drop unknown fields** in a CDC payload — treat an unexpected new field as
  a signal, not noise, since it usually means the source schema changed upstream of you.
- Prefer additive-only automatic handling (new nullable columns) and require manual review
  for anything else (type changes, renames, drops) — this mirrors the schema-evolution
  discussion in `07-data-quality-observability.md`.

## Gotchas

- Assuming "the most recently received event is the newest" — true only within a single,
  correctly-partitioned stream; false the moment you have multiple partitions/producers.
- Building idempotency into the *ingestion* layer only and forgetting downstream
  aggregates/materialized views — if a fact table is safely deduplicated but a rollup built
  on top of it isn't recomputed idempotently, the corruption just moves one layer down.
- Query-based CDC silently missing hard deletes — a very common production bug when a team
  assumes soft-deletes ("is_deleted = true") are universal practice on the source system.
- Treating "exactly-once" as something the message broker guarantees end-to-end — brokers
  like Kafka guarantee **exactly-once within their own pipeline** under specific
  configurations, but the moment your consumer writes to an external system, correctness
  depends on *your* write being idempotent, not on the broker's internal guarantee.

## Pro Tips

- When asked "how do you handle duplicate events," always answer with the specific
  mechanism (LSN comparison, idempotency key + dedup store, MERGE with a guard condition) —
  not the word "idempotent" alone, which interviewers will immediately ask you to unpack.
  Immediately unpack it yourself.
- Volunteer the connection to fault tolerance early: "because writes are idempotent, if the
  consumer crashes and reprocesses the last uncommitted batch on restart, that's safe" ties
  this category directly into `06-fault-tolerance.md` and shows the concepts aren't siloed.
- If asked to compare CDC approaches, lead with source impact (log-based is lower-overhead)
  and delete-capture correctness (query-based often misses hard deletes) — these are the two
  differentiators interviewers most often want to hear named explicitly.
- Have the MERGE SQL pattern memorized well enough to write from scratch on a whiteboard —
  it's one of the highest-value few lines of SQL in this entire curriculum.
