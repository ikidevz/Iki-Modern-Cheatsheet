# Data Contracts Cheatsheet for Analytics Engineers

> A structured reference for defining, enforcing, and versioning data contracts between producers and consumers — dbt contracts, schema validation tools, breaking-change management, and CI enforcement.

## 📑 Table of Contents

1. [🧠 Core Concepts](#core-concepts)
2. [📜 dbt Contracts](#dbt-contracts)
3. [🧾 Contract YAML Anatomy](#contract-yaml-anatomy)
4. [✅ Schema Validation Tools](#schema-validation-tools)
5. [🔢 Versioning & Breaking Changes](#versioning-breaking-changes)
6. [🧪 Contract Testing in CI](#contract-testing-in-ci)
7. [🚨 Monitoring & Alerting](#monitoring-alerting)
8. [🤝 Producer/Consumer Communication](#producer-consumer-communication)
9. [🔄 Real-World Example: End-to-End Event Contract](#real-world-example-end-to-end-event-contract)
10. [📡 Schema Registry & Streaming Contracts](#schema-registry-streaming-contracts)
11. [🧰 Choosing a Validation Tool](#choosing-a-validation-tool)
12. [🛠️ Troubleshooting Common Contract Failures](#troubleshooting-common-contract-failures)
13. [⚠️ Common Gotchas](#common-gotchas)
14. [🎯 Best Practices](#best-practices)
15. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Task                              | Syntax / Tool                                                        |
| ---------------------------------- | ------------------------------------------------------------------------ |
| Enforce a dbt model's schema       | `config: { contract: { enforced: true } }`                               |
| Declare a column's exact type      | `data_type: numeric(18,2)` under the column in `.yml`                    |
| Add a not-null/PK constraint       | `constraints:` block on a column or model                                |
| Version a breaking model change    | `versions:` block with `v: 1`, `v: 2`, each with a `defined_in`           |
| Validate data against a schema     | Great Expectations `expect_column_values_to_be_of_type`                  |
| Validate data against a schema     | Soda Core `checks for <table>: - schema:`                                |
| JSON Schema validation (APIs/events) | `jsonschema.validate(instance, schema)` (Python)                       |
| Register an Avro schema             | `POST /subjects/<subject>/versions` (Confluent Schema Registry)        |
| Check Avro compatibility            | `POST /compatibility/subjects/<subject>/versions/latest`               |
| Compile a Protobuf schema           | `protoc --python_out=. event.proto`                                    |
| Choose a compatibility mode         | `BACKWARD` / `FORWARD` / `FULL` (Schema Registry setting)               |

**Contract enforcement layer cheat sheet**

| Layer                     | Enforces...                                              |
| --------------------------- | ----------------------------------------------------------- |
| dbt `contract: enforced`     | Column names, types, order (at build time, in-warehouse)     |
| dbt `constraints`            | `not_null`, `primary_key`, `foreign_key`, `check` (warehouse-dependent) |
| Great Expectations / Soda    | Row-level data quality: ranges, nullability, freshness, distributions |
| JSON Schema / Avro / Protobuf | Structure of events/API payloads before they ever reach the warehouse |

## 🧠 Core Concepts

A data contract is an explicit, versioned agreement about the **shape and guarantees** of a dataset between the team that produces it and the teams that consume it — turning "please don't change that column" from a tribal-knowledge request into an enforced, testable rule.

```text
Producer                          Contract                          Consumer
(owns the model/event source) → (schema + types + SLAs, versioned) → (dashboards, ML models, other teams)

Without a contract: a producer's silent change breaks consumers downstream, discovered days later.
With a contract:    the producer's CI build fails immediately if the change violates the agreement.
```

Contracts typically cover:
- **Schema** — column names, types, nullability, ordering
- **Semantics** — what a column means, its grain, its valid value set
- **SLAs** — freshness (data no older than X), completeness, uptime of the pipeline producing it

## 📜 dbt Contracts

```yaml
# models/marts/_fct_orders.yml
models:
  - name: fct_orders
    config:
      contract:
        enforced: true
    columns:
      - name: order_id
        data_type: varchar
        constraints:
          - type: not_null
          - type: primary_key
      - name: customer_id
        data_type: varchar
        constraints:
          - type: not_null
      - name: amount
        data_type: numeric(18,2)
      - name: order_status
        data_type: varchar
```

```bash
# With contract: enforced, dbt refuses to build if the model's actual output
# doesn't match the declared columns/types exactly
dbt build --select fct_orders
# Compilation Error: This model has an enforced contract that failed.
# Please ensure the name, data_type, and number of columns in your `yml`
# file match the columns in your SQL file.
```

Contracts require: every column in the model's `SELECT` listed in the `.yml` with an explicit `data_type`, and the SQL's column order matching the YAML order.

## 🧾 Contract YAML Anatomy

```yaml
models:
  - name: dim_customers
    config:
      contract:
        enforced: true
    constraints:
      - type: primary_key
        columns: [customer_id]
      - type: foreign_key
        columns: [region_id]
        to: ref('dim_regions')
        to_columns: [region_id]
    columns:
      - name: customer_id
        data_type: varchar
        constraints:
          - type: not_null
      - name: region_id
        data_type: varchar
      - name: signup_date
        data_type: date
```

Model-level `constraints` express relationships across columns (composite keys, foreign keys); column-level `constraints` express single-column rules (`not_null`, `unique`, `check`).

## ✅ Schema Validation Tools

```python
# Great Expectations: expectation suite for a table
import great_expectations as gx

context = gx.get_context()
validator = context.sources.pandas_default.read_csv("orders.csv")

validator.expect_column_values_to_not_be_null("order_id")
validator.expect_column_values_to_be_of_type("amount", "float64")
validator.expect_column_values_to_be_between("amount", min_value=0)
validator.expect_column_values_to_be_in_set(
    "order_status", ["pending", "completed", "cancelled"]
)
validator.save_expectation_suite(discard_failed_expectations=False)
```

```yaml
# Soda Core: declarative checks against a warehouse table
# checks.yml
checks for orders:
  - schema:
      fail:
        when required column missing: [order_id, customer_id, amount]
      warn:
        when wrong column type:
          amount: numeric
  - row_count > 0
  - missing_count(order_id) = 0
  - duplicate_count(order_id) = 0
  - freshness(created_at) < 24h
```

```bash
soda scan -d my_datasource -c configuration.yml checks.yml
```

```python
# JSON Schema: validating event payloads before they reach a pipeline
import jsonschema

schema = {
    "type": "object",
    "required": ["event_id", "user_id", "event_type", "timestamp"],
    "properties": {
        "event_id": {"type": "string"},
        "user_id": {"type": "string"},
        "event_type": {"type": "string", "enum": ["click", "view", "purchase"]},
        "timestamp": {"type": "string", "format": "date-time"},
    },
}

jsonschema.validate(instance=event_payload, schema=schema)
```

## 🔢 Versioning & Breaking Changes

```yaml
# dbt model versions: ship v2 alongside v1, migrate consumers, then deprecate v1
models:
  - name: dim_customers
    latest_version: 2
    versions:
      - v: 1
        defined_in: dim_customers_v1
        deprecation_date: 2026-12-31
      - v: 2
        defined_in: dim_customers_v2
        columns:
          - include: all
          - name: customer_tier   # new column only in v2
            data_type: varchar
```

```bash
# Consumers explicitly opt into a version instead of being silently broken
{{ ref('dim_customers', v=1) }}   -- still works until deprecation_date
{{ ref('dim_customers', v=2) }}   -- new consumers use this
```

```text
Semver-style thinking for schema changes, even without literal semver tags:
  MAJOR  — column removed, type changed incompatibly, meaning of a column changed → new version, migration path required
  MINOR  — column added (nullable, additive) → safe, no version bump needed
  PATCH  — bug fix that doesn't change shape (e.g. corrected values, same schema) → safe, but consumers should be notified if values look different
```

## 🧪 Contract Testing in CI

```yaml
# .github/workflows/contract_ci.yml
name: Contract CI

on:
  pull_request:
    paths:
      - 'models/marts/**'

jobs:
  contract_check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install dbt-snowflake
      - run: dbt deps
      - name: Build contracted models — fails on any schema drift
        run: dbt build --select config.contract:true --target ci
```

```bash
# Fail CI if a PR changes a contracted model's public columns without a version bump
dbt build --select fct_orders --target ci
# a removed/retyped column here fails the build immediately, before merge
```

## 🚨 Monitoring & Alerting

```yaml
# Soda: send alerts to Slack when a check fails in production
soda scan -d prod_datasource -c configuration.yml checks.yml \
  --notify slack://data-alerts

checks for fct_orders:
  - freshness(created_at) < 6h:
      name: "Orders table freshness SLA"
  - anomaly detection for row_count:
      name: "Unexpected row count change"
```

```yaml
# dbt source freshness as a lightweight contract on upstream data
sources:
  - name: raw_app_db
    tables:
      - name: orders
        loaded_at_field: _loaded_at
        freshness:
          warn_after: { count: 6, period: hour }
          error_after: { count: 24, period: hour }
```

```bash
dbt source freshness    # run as a scheduled check, alert on warn/error
```

## 🤝 Producer/Consumer Communication

```markdown
<!-- CONTRACT.md, checked into the producer's repo alongside the model -->
# Contract: fct_orders (v2)

**Owner:** Finance Data Team
**Grain:** One row per order
**Freshness SLA:** Updated within 1 hour of order placement
**Breaking change policy:** New major version + 90-day deprecation window for the prior version

## Guaranteed columns
| Column | Type | Nullable | Notes |
|---|---|---|---|
| order_id | varchar | No | Primary key |
| customer_id | varchar | No | FK to dim_customers |
| amount | numeric(18,2) | No | USD, post-discount |
| order_status | varchar | No | One of: pending, completed, cancelled |

## Deprecation notices
- `amt` column removed in v2 (2026-01-15) — use `amount` instead.
```

## 🔄 Real-World Example: End-to-End Event Contract

A worked example following one contract from producer service to warehouse: a `purchase_completed` event.

```protobuf
// 1. Producer defines the contract as a Protobuf schema (event.proto),
//    versioned in the producer service's own repo
syntax = "proto3";

message PurchaseCompleted {
  string event_id = 1;
  string user_id = 2;
  string order_id = 3;
  double amount = 4;
  string currency = 5;
  int64 occurred_at_unix_ms = 6;
}
```

```python
# 2. Producer service validates against the schema before publishing
from event_pb2 import PurchaseCompleted

event = PurchaseCompleted(
    event_id="evt_123", user_id="u_456", order_id="o_789",
    amount=49.99, currency="USD", occurred_at_unix_ms=1737072000000,
)
producer.send("purchase_completed", event.SerializeToString())
```

```yaml
# 3. Ingestion lands raw events into the warehouse (e.g. via Kafka Connect,
#    Fivetran, or a custom loader) into a raw/staging table
# raw.purchase_completed_events: event_id, user_id, order_id, amount, currency, occurred_at_unix_ms
```

```yaml
# 4. dbt enforces the SAME contract shape downstream, one layer removed
#    from the original Protobuf — this is where analytics engineers own the agreement
models:
  - name: stg_purchase_completed
    config:
      contract:
        enforced: true
    columns:
      - name: event_id
        data_type: varchar
        constraints: [{ type: not_null }, { type: primary_key }]
      - name: user_id
        data_type: varchar
        constraints: [{ type: not_null }]
      - name: order_id
        data_type: varchar
      - name: amount
        data_type: numeric(18,2)
      - name: currency
        data_type: varchar
      - name: occurred_at
        data_type: timestamp
```

```yaml
# 5. Source freshness acts as the SLA half of the contract on the raw table
sources:
  - name: raw_events
    tables:
      - name: purchase_completed_events
        loaded_at_field: _loaded_at
        freshness:
          warn_after: { count: 30, period: minute }
          error_after: { count: 2, period: hour }
```

```text
The contract exists at three layers, each owned by a different party:
  Protobuf schema     → owned by the producer service team, enforced at publish time
  Warehouse raw table  → owned by the platform/ingestion team, enforced by the loader
  dbt staging contract → owned by the analytics engineering team, enforced at build time
A break at any layer should fail loudly at that layer, not surface as a
mysterious downstream dashboard discrepancy three hops later.
```

## 📡 Schema Registry & Streaming Contracts

```json
// Avro schema registered in a Confluent Schema Registry
{
  "type": "record",
  "name": "PurchaseCompleted",
  "fields": [
    { "name": "event_id", "type": "string" },
    { "name": "user_id", "type": "string" },
    { "name": "order_id", "type": "string" },
    { "name": "amount", "type": "double" },
    { "name": "currency", "type": "string" },
    { "name": "occurred_at_unix_ms", "type": "long" }
  ]
}
```

```bash
# Register a new schema version
curl -X POST http://schema-registry:8081/subjects/purchase_completed-value/versions \
  -H "Content-Type: application/vnd.schemaregistry.v1+json" \
  -d '{"schema": "<escaped Avro schema JSON>"}'

# Check whether a proposed change is compatible before publishing it
curl -X POST http://schema-registry:8081/compatibility/subjects/purchase_completed-value/versions/latest \
  -H "Content-Type: application/vnd.schemaregistry.v1+json" \
  -d '{"schema": "<escaped new Avro schema JSON>"}'
```

| Compatibility mode | Allows                                                        | Breaks                                    |
| --------------------- | ------------------------------------------------------------------ | -------------------------------------------- |
| `BACKWARD`            | New schema can read data written with the old schema                 | Removing a required field consumers rely on   |
| `FORWARD`              | Old schema can read data written with the new schema                  | Adding a required field without a default     |
| `FULL`                 | Both directions — the strictest, safest default for shared topics      | Most structural changes without careful staging |

```text
Why this matters for analytics engineers even though it's often owned by
a platform/data-eng team: the Schema Registry is the contract enforcement
point BEFORE data ever reaches the warehouse. If it's set to `NONE`
(no compatibility checking), warehouse-side dbt contracts become a
secondary safety net catching problems days later instead of an
upstream gate catching them before publish.
```

## 🧰 Choosing a Validation Tool

| Tool                 | Best for                                                     | Runs where                          |
| ---------------------- | ------------------------------------------------------------- | -------------------------------------- |
| dbt `contract: enforced` | Warehouse-native schema shape (names, types, order)             | dbt build, in-warehouse               |
| dbt `constraints`        | Relational rules (`not_null`, `primary_key`, `foreign_key`)      | dbt build, warehouse-dependent enforcement |
| Great Expectations       | Rich, code-first data-quality suites; good Python/notebook integration | Standalone Python, or orchestrated via Airflow |
| Soda Core / Soda Cloud   | Declarative YAML checks, freshness/anomaly detection, team-friendly | CLI or scheduled job, warehouse-native |
| JSON Schema              | Validating API/webhook payloads before they're even queued        | Application/producer code             |
| Avro / Protobuf + Schema Registry | High-throughput streaming events with strict compatibility rules | Kafka/streaming producers and consumers |

```text
A common, complementary stack rather than a single choice:
  Schema Registry (Avro/Protobuf) → gate at publish time for streaming events
  dbt contracts                    → gate at build time for warehouse models
  Soda / Great Expectations         → gate at scheduled-check time for data quality/freshness
Pick based on WHERE in the pipeline you need the check to fire, not
which tool is "best" in isolation.
```

## 🛠️ Troubleshooting Common Contract Failures

| Symptom                                                       | Likely cause                                                          | Fix                                                                     |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `dbt build` fails with a contract error after no apparent SQL change  | An upstream source column's type changed (e.g. warehouse auto-detected a new type) | Pin explicit casts in staging models so contracted models aren't at the mercy of source type drift |
| Contract passes in CI but fails in prod                              | CI ran against a sampled/limited dataset that didn't surface an edge-case type mismatch | Ensure CI runs against a representative sample, or accept contracts are a build-time not data-time guarantee and pair with tests |
| Schema Registry rejects a "harmless" field addition                    | Field was added as required with no default, violating `BACKWARD` compatibility | Add new fields as optional / with a default value                              |
| Great Expectations suite passes locally but fails in the scheduled job  | Local run used a stale/cached dataset; scheduled job hit fresh data with genuine drift | Treat the scheduled failure as real signal, not a fluke — investigate the actual data |
| Consumers report a "broken" dashboard despite the contract holding      | The contract enforces shape, not values — a logic bug produced valid-shaped but wrong data | Add value-level tests/checks (Great Expectations, Soda, dbt data tests) alongside the shape contract |
| Two teams' contracts disagree on the same shared table's ownership      | No single system of record for who owns the contract on that table            | Assign one owning team per contracted table and record it in the contract doc  |

## ⚠️ Common Gotchas

- **`contract: enforced` requires an exact column list and order** — adding a debug column in the SQL without updating the YAML fails the build, which is the point, but it surprises people the first time.
- **Contracts enforce shape, not values** — a contract-passing model can still return wrong numbers; pair contracts with `dbt test`/Great Expectations/Soda for value-level correctness.
- **Constraints aren't enforced identically across warehouses** — some warehouses enforce `primary_key`/`foreign_key` at the database level, others (e.g. many cloud warehouses) only document them without runtime enforcement; check your adapter's docs.
- **Versioning a model doesn't automatically migrate consumers** — `versions:` gives consumers a safe path to move at their own pace, but someone still has to do the outreach and follow-up.
- **A contract with no monitoring is just documentation** — schema contracts caught in CI protect against code changes; freshness/volume/anomaly contracts need a scheduled check, not just a one-time YAML file.
- **Event/payload contracts (JSON Schema, Avro, Protobuf) live outside the warehouse** — a warehouse-side dbt contract doesn't protect against a producer service silently changing its event shape upstream of ingestion.

## 🎯 Best Practices

```yaml
# GOOD: contract enforced on every model that other teams depend on
models:
  - name: fct_orders          # widely consumed → contract required
    config:
      contract:
        enforced: true
  - name: int_orders_scratch  # internal-only intermediate model → no contract needed
```

- Enforce contracts on **any model consumed outside its owning team** — internal/intermediate models generally don't need one.
- Pair **schema contracts (dbt) with value-level checks (tests/Great Expectations/Soda)** — shape and correctness are different guarantees and need different tooling.
- Write a **human-readable contract doc** (owner, grain, SLA, breaking-change policy) alongside the machine-enforced YAML — the YAML enforces it, the doc explains it.
- Treat a **contract violation in CI as a hard stop**, not a warning — the whole point is that breaking changes never reach consumers silently.
- Set an **explicit deprecation window** (e.g. 90 days) for old model versions, with the date written into the contract, not left implicit.

## 💡 Pro Tips

1. **Start contracts on your most-consumed marts first** — the ROI on catching a breaking change is highest where the most dashboards/models depend on it.
2. **Use `dbt build --select config.contract:true`** as a dedicated CI job so contract violations get their own clear failure message, separate from general test failures.
3. **Document the deprecation policy once, at the team level**, and reference it from every contract doc — don't re-litigate "how long is the migration window" per model.
4. **Combine dbt model versions with source freshness checks** — a "shape" contract and a "freshness" contract are both part of the full agreement with consumers.
5. **Alert the producer team, not just the consumer**, when a freshness/volume contract breaks — the fastest fix usually happens upstream.
6. **Use anomaly-detection checks (Soda, Great Expectations) sparingly at first** — tune thresholds on a couple of high-value tables before rolling out broadly, or alert fatigue sets in fast.
7. **Version event schemas (JSON Schema/Avro/Protobuf) in the same repo as the producer service**, not the analytics repo — the contract should live closest to where it can actually be enforced at write time.
8. **Review contract changes with the same rigor as an API change** — a column rename in a contracted model is exactly as breaking as removing a REST API field.
9. **Keep a registry of active contracts and their consumers** (even a simple spreadsheet or wiki page) — "who reads this table" is the first question in any incident involving a broken contract.
10. **Re-validate contracts after warehouse migrations** — a type that behaved one way in Redshift can behave subtly differently in Snowflake or BigQuery; don't assume a contract that passed pre-migration still holds post-migration.
