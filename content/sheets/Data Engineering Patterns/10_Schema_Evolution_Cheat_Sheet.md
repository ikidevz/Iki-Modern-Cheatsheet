# Schema Evolution Cheatsheet for Data Engineers

> A structured reference for changing data structures over time without breaking producers, consumers, storage, or historical data — compatibility modes, schema registries, versioning, and deprecation workflows. Expanded from a short pattern note into a full implementation guide.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 When Schema Evolution Discipline Matters Most](#when-schema-evolution-discipline-matters-most)
4. [📐 Compatibility Modes](#compatibility-modes)
5. [✅ Safe (Additive) Changes](#safe-additive-changes)
6. [🚫 Breaking Changes and How to Handle Them](#breaking-changes-and-how-to-handle-them)
7. [🗂️ Schema Registries](#schema-registries)
8. [🔄 Deploy Order for Breaking Changes](#deploy-order-for-breaking-changes)
9. [🧮 Backfilling New Fields](#backfilling-new-fields)
10. [🛠️ Tooling Landscape](#tooling-landscape)
11. [🧬 Protobuf Evolution Rules](#protobuf-evolution-rules)
12. [🧾 JSON Schema Evolution](#json-schema-evolution)
13. [🔎 Avro Reader/Writer Schema Resolution](#avro-readerwriter-schema-resolution)
14. [🌐 Multi-Version API Support](#multi-version-api-support)
15. [🧪 Testing Schema Changes Against Historical Data](#testing-schema-changes-against-historical-data)
16. [⚠️ Common Gotchas](#common-gotchas)
17. [✅ Best Practices Checklist](#best-practices-checklist)
18. [📚 Forward vs Backward vs Full Compatibility](#forward-vs-backward-vs-full-compatibility)
19. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| Safe changes | Additive: new nullable column, new field with a default |
| Unsafe changes | Rename, type narrowing, removing a required field |
| Deploy order | Consumers before producers, for breaking changes |
| Versioning | Version the contract explicitly when compatibility can't be maintained |
| Backfill | Populate new fields before making them required/non-null |
| Enforcement | CI checks or a schema registry compatibility check, not code review alone |

## 🧠 Core Concept

Schema evolution is the discipline of changing data structures — table columns, event payloads, API contracts — **over time**, while keeping every producer, consumer, storage layer, and piece of historical data compatible with the change. The core tension: schemas *must* change as the business changes, but a naive change can silently break every downstream reader the moment it's deployed.

```text
v1 schema  --additive change-->  v2 schema (backward compatible: old readers still work)
                                        │
                                        └──breaking change--> v3 schema (requires coordinated rollout or a new version)
```

## 🎯 When Schema Evolution Discipline Matters Most

**Matters most when:**
- Multiple independent teams or services produce/consume the same schema (events, shared tables, APIs).
- Historical data must remain readable after the schema changes (time travel, replay, audits).
- Producers and consumers deploy independently and can't be coordinated to release simultaneously.

**Matters less when:**
- A single team owns both producer and consumer and can coordinate a synchronized deploy — still good practice, but the blast radius of a mistake is much smaller.

## 📐 Compatibility Modes

| Mode | Guarantee | Typical rule |
|---|---|---|
| Backward compatible | New schema can read data written with the old schema | New fields must be optional/have defaults |
| Forward compatible | Old schema can read data written with the new schema | New readers must ignore unknown fields gracefully |
| Full compatible | Both backward and forward | Only additive, optional changes allowed |

Most registries (Confluent Schema Registry, AWS Glue Schema Registry) let you declare which mode applies **per subject/topic**, and reject incompatible schema registrations automatically.

## ✅ Safe (Additive) Changes

```sql
-- Adding a nullable column with a default is backward compatible:
-- old rows get the default, old readers that don't know the column simply ignore it
ALTER TABLE mart.orders
ADD COLUMN currency VARCHAR DEFAULT 'USD';

UPDATE mart.orders
SET currency = 'USD'
WHERE currency IS NULL;
```

```json
// Adding an optional field to an Avro/JSON event schema
{
  "type": "record",
  "name": "OrderEvent",
  "fields": [
    {"name": "order_id", "type": "string"},
    {"name": "amount", "type": "double"},
    {"name": "currency", "type": ["null", "string"], "default": null}
  ]
}
```

| Safe change | Why it's safe |
|---|---|
| Add a nullable/defaulted field | Old readers ignore it; old data gets the default |
| Widen a numeric type (int → long) | No precision loss for existing values |
| Add a new optional enum value (if consumers handle unknowns gracefully) | Existing values unaffected |

## 🚫 Breaking Changes and How to Handle Them

| Breaking change | Why it breaks things | Mitigation |
|---|---|---|
| Rename a field/column | Old consumers looking for the old name get nulls/errors | Add the new field, deprecate the old one, remove only after a window |
| Remove a required field | Consumers relying on it fail or get nulls | Make it optional first, monitor usage, then remove |
| Narrow a type (long → int, string → enum) | Existing values may not fit the new type | Add a new field with the new type; migrate consumers; deprecate old field |
| Change field semantics without renaming | Silent logic bugs downstream — the worst kind | Always rename when meaning changes, never reuse a field name for a new meaning |

```json
// Correct pattern: add new, deprecate old, remove later — never a same-release rename
{
  "fields": [
    {"name": "order_id", "type": "string"},
    {"name": "amount_cents", "type": "long"},
    {"name": "amount", "type": "double", "doc": "DEPRECATED: use amount_cents. Removal planned 2026-12-01."}
  ]
}
```

## 🗂️ Schema Registries

```python
# Registering a schema and having compatibility enforced automatically
from confluent_kafka.schema_registry import SchemaRegistryClient

client = SchemaRegistryClient({"url": "http://schema-registry:8081"})
client.set_compatibility(subject_name="orders-value", level="BACKWARD")

# Registration fails loudly if the new schema breaks backward compatibility
client.register_schema("orders-value", new_schema)
```

A registry turns "did I just break every consumer of this topic?" from a question discovered in production into a **registration-time failure** — this is the single highest-leverage schema-evolution investment for event-driven systems.

## 🔄 Deploy Order for Breaking Changes

```text
For a genuinely unavoidable breaking change:
1. Deploy consumers that can handle BOTH the old and new schema (dual-read)
2. Deploy the producer to emit the new schema
3. Once all consumers confirm they've stopped needing the old shape, remove dual-read support
```

**Deploy consumers before producers.** A consumer that already knows how to handle the new shape is safe to receive it early; a producer that emits the new shape before consumers are ready guarantees breakage.

## 🧮 Backfilling New Fields

```sql
-- Backfill historical rows with a sensible default BEFORE making a field required
ALTER TABLE mart.orders ADD COLUMN currency VARCHAR;
UPDATE mart.orders SET currency = 'USD' WHERE currency IS NULL;

-- Only after backfill is complete and verified, consider a NOT NULL constraint
ALTER TABLE mart.orders ALTER COLUMN currency SET NOT NULL;
```

Skipping the backfill step and going straight to `NOT NULL` is one of the most common ways a "safe-looking" additive change turns into an outage for any job that reads historical partitions.

## 🛠️ Tooling Landscape

| Category | Tools |
|---|---|
| Schema registries | Confluent Schema Registry, AWS Glue Schema Registry, Apicurio |
| Serialization formats with schema support | Avro, Protobuf, JSON Schema |
| Table format schema evolution | Delta Lake (`mergeSchema`), Apache Iceberg (`ALTER TABLE`) |
| CI enforcement | Buf (Protobuf breaking-change detection), schema-registry compatibility checks in CI |

```bash
# Example: Buf detects breaking Protobuf changes in CI before merge
buf breaking --against '.git#branch=main'
```

## 🧬 Protobuf Evolution Rules

Protobuf's wire format is built around numbered fields, which gives it a distinct — and stricter — set of evolution rules than Avro/JSON.

```protobuf
// v1
message OrderEvent {
  string order_id = 1;
  double amount = 2;
}

// v2: SAFE — new field with a new number, old messages simply don't have field 3
message OrderEvent {
  string order_id = 1;
  double amount = 2;
  string currency = 3;      // new optional field, safe to add
}
```

```protobuf
// UNSAFE changes in Protobuf:
message OrderEvent {
  string order_id = 1;
  double amount = 2;   // NEVER change this field's number or its type incompatibly
  // reserved 4;        // ALWAYS reserve numbers of removed fields — never reuse them
}
```

| Protobuf rule | Why |
|---|---|
| Never change a field's number | The number, not the name, is what's on the wire — changing it corrupts every existing serialized message |
| Never reuse a removed field's number | A future field reusing an old number will misinterpret old serialized data still in flight/at rest |
| Always mark removed fields `reserved` | Prevents accidental reuse of retired field numbers |
| Renaming a field (keeping the number) is safe | The wire format doesn't care about field names, only numbers — but it does confuse humans reading the `.proto` file |
| Changing a field's type is usually unsafe | Only a small set of "wire-compatible" type changes are safe (e.g., `int32` ↔ `int64` in some cases) — verify with `buf breaking` |

```bash
# Buf's breaking-change detector is the standard way to enforce these rules in CI
buf breaking --against '.git#branch=main'
```

## 🧾 JSON Schema Evolution

JSON Schema has no built-in registry-enforced compatibility the way Avro/Protobuf ecosystems typically do, so discipline has to be enforced through convention and CI tooling.

```json
// v1
{
  "type": "object",
  "properties": {
    "order_id": {"type": "string"},
    "amount": {"type": "number"}
  },
  "required": ["order_id", "amount"],
  "additionalProperties": false
}
```

```json
// v2: adding an optional field is safe ONLY IF additionalProperties allows it
// or the field is added to "properties" (not just appearing unexpectedly in payloads)
{
  "type": "object",
  "properties": {
    "order_id": {"type": "string"},
    "amount": {"type": "number"},
    "currency": {"type": "string", "default": "USD"}
  },
  "required": ["order_id", "amount"],
  "additionalProperties": false
}
```

```python
# Automated compatibility check: validate that every historical sample payload
# still validates against the new schema (a cheap, effective backward-compatibility test)
import jsonschema

for old_payload in sample_historical_payloads:
    jsonschema.validate(instance=old_payload, schema=new_schema)  # raises if the new schema rejects old data
```

`additionalProperties: false` is a double-edged sword: it catches typos and unexpected fields, but it also means **every new field addition is technically a schema change that must be deployed to validators before producers can safely emit it** — teams often relax to `additionalProperties: true` specifically to make additive evolution frictionless, accepting the reduced typo-catching in exchange.

## 🔎 Avro Reader/Writer Schema Resolution

Avro's defining feature is that a **reader schema and a writer schema don't have to match** — Avro resolves the difference at read time, which is what makes Avro's compatibility rules work in practice.

```python
# The writer used schema v1 to serialize; the reader uses schema v2 to deserialize
writer_schema = {"type": "record", "name": "Order", "fields": [
    {"name": "order_id", "type": "string"},
    {"name": "amount", "type": "double"},
]}

reader_schema = {"type": "record", "name": "Order", "fields": [
    {"name": "order_id", "type": "string"},
    {"name": "amount", "type": "double"},
    {"name": "currency", "type": "string", "default": "USD"},   # reader has a NEW field with a default
]}

# Avro resolution fills in the reader's new field from its default,
# since the writer's data doesn't contain it — this is backward compatibility in action
import fastavro
record = fastavro.schemaless_reader(buffer, writer_schema=writer_schema, reader_schema=reader_schema)
# record == {"order_id": "...", "amount": ..., "currency": "USD"}
```

This reader/writer resolution mechanism is *why* "new field must have a default" is the rule for Avro backward compatibility — the default is literally what fills the gap when older data (written before the field existed) is read by newer code.

## 🌐 Multi-Version API Support

When a REST/GraphQL API's contract needs a genuinely breaking change, versioning the endpoint (rather than mutating the existing contract) lets consumers migrate on their own schedule.

```python
# URL-versioned REST API: old and new versions coexist during a migration window
@app.route("/v1/orders/<order_id>")
def get_order_v1(order_id):
    order = fetch_order(order_id)
    return {"id": order.id, "amount": order.amount}   # legacy shape

@app.route("/v2/orders/<order_id>")
def get_order_v2(order_id):
    order = fetch_order(order_id)
    return {"id": order.id, "amount_cents": order.amount_cents, "currency": order.currency}  # new shape
```

```graphql
# GraphQL prefers additive evolution + explicit field deprecation over versioned endpoints
type Order {
  id: ID!
  amount: Float @deprecated(reason: "Use amountCents instead. Removal planned 2026-12-01.")
  amountCents: Int!
  currency: String!
}
```

GraphQL's schema is designed around **never truly needing a v2 endpoint** — clients request only the fields they use, so adding fields is free, and deprecating (rather than removing) old fields lets consumers migrate at their own pace while the schema stays singular.

## 🧪 Testing Schema Changes Against Historical Data

```python
def test_new_consumer_reads_old_messages():
    """Replay a sample of real historical messages through the NEW consumer logic."""
    for old_message in load_historical_sample("orders_2025_q4.avro"):
        result = new_consumer_logic(old_message)   # must not raise, must produce sensible output
        assert result is not None
        assert "currency" in result   # backfilled via the schema default, even though old data lacks it

def test_new_schema_registration_is_compatible():
    from confluent_kafka.schema_registry import SchemaRegistryClient
    client = SchemaRegistryClient({"url": "http://schema-registry:8081"})
    is_compatible = client.test_compatibility("orders-value", new_schema)
    assert is_compatible   # fails the build BEFORE a bad schema reaches the registry
```

Running the new consumer/reader logic against a **real sample of historical data** (not just a hand-crafted unit test fixture) catches compatibility issues that a purely synthetic test would miss — production data has edge cases (unexpected nulls, unusual but valid values) that are easy to forget to construct by hand.

## ⚠️ Common Gotchas

- **Reusing a field name for a new meaning** is the most dangerous change of all — it passes type checks while silently corrupting semantics.
- **Skipping backfill before enforcing `NOT NULL`** breaks historical reads/reprocessing.
- **Deploying producers before consumers** for a breaking change guarantees an outage window.
- **Assuming "additive" is always safe** — adding a required (non-nullable, no-default) field is *not* additive-safe; it's a breaking change in disguise.
- **No compatibility check in CI** — relying on code review alone to catch schema breakage doesn't scale and misses cross-team breakage the reviewer can't see.
- **Forgetting downstream table-format consumers** — a Kafka schema change that's backward compatible can still break a Delta/Iceberg table on the other end if `mergeSchema` isn't handled deliberately.
- **Reusing a retired Protobuf field number** — the wire format doesn't know or care about names, only numbers; reuse silently corrupts old serialized data still being read.
- **Relying on JSON Schema `additionalProperties: false` while evolving frequently** — every additive change then requires deploying validators before producers, defeating the purpose of "safe, frictionless" additive evolution.
- **Testing new consumer logic only against hand-crafted fixtures**, never real historical data — production data has edge cases synthetic fixtures rarely anticipate.
- **Standing up a new API version for every change** when the underlying data model (GraphQL, especially) already supports additive evolution and field-level deprecation without a new version at all.

## ✅ Best Practices Checklist

- [ ] Every schema change is classified explicitly: additive, or breaking
- [ ] Breaking changes follow add-new → deprecate-old → remove-later, never a same-release rename
- [ ] New fields are backfilled before being made required
- [ ] A schema registry (or equivalent CI check) enforces compatibility automatically
- [ ] Consumers are deployed before producers for any breaking change
- [ ] Field renames are never reused for a different meaning
- [ ] Deprecated fields have a communicated, dated removal window

## 📚 Forward vs Backward vs Full Compatibility

| Mode | Old reader + new data | New reader + old data | Typical use |
|---|---|---|---|
| Backward | N/A | ✅ Works | Rolling out new consumers gradually |
| Forward | ✅ Works | N/A | Rolling out new producers before all consumers upgrade |
| Full | ✅ Works | ✅ Works | Safest default for shared, multi-team schemas |

## 💡 Pro Tips

1. **Default every shared schema to "full compatibility" enforcement** unless there's a specific reason not to.
2. **Never rename in place** — add the new field, deprecate the old one, remove only after a communicated window.
3. **Backfill before you enforce** — a `NOT NULL` constraint on a freshly-added column needs historical data populated first.
4. **Automate compatibility checks in CI**, not just in code review — human reviewers miss cross-team breakage.
5. **Deploy consumers before producers** whenever a breaking change is genuinely unavoidable.
6. **Version the contract explicitly** (a new topic/table version) when compatibility truly can't be maintained — don't force-fit an incompatible change into the same schema.
7. **Communicate deprecation windows with dates**, not vague "eventually" language, and track who's still using the deprecated field.
8. **Treat "changed meaning, same field name" as the worst-case breaking change** — it doesn't even fail loudly.
9. **Test schema changes against real historical data**, not just the new schema in isolation — replay old partitions/messages through the new consumer.
10. **Keep a living schema changelog per shared dataset/topic** so consumers can self-serve "what changed and when" instead of asking in Slack.
11. **Always `reserve` retired Protobuf field numbers** — never let a future field reuse one.
12. **Validate historical sample payloads against every new JSON Schema** before deploying it, as a cheap automated compatibility check.
13. **Understand Avro's reader/writer resolution** — it's the mechanism that makes "new field needs a default" actually work, not just an arbitrary rule.
14. **Prefer additive evolution + field deprecation over new API versions** wherever the protocol supports it (GraphQL especially) — fewer versions to maintain in parallel.
15. **Replay real historical data through new consumer logic** in CI, not just synthetic fixtures, before shipping a schema change.

