# Data Quality, Contracts & Observability — System Design for Data Engineers

> Schema contracts, freshness SLAs, and catching bad data before it spreads — designing the
> quality and observability layer of a pipeline as a first-class component, not an
> afterthought bolted on after an incident.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Quick-Reference Table](#quick-reference-table)
3. [Data Contracts](#data-contracts)
4. [Schema Evolution: Breaking vs. Non-Breaking Changes](#schema-evolution-breaking-vs-non-breaking-changes)
5. [Python: A Schema Compatibility Checker](#python-a-schema-compatibility-checker)
6. [Where to Enforce Quality Checks](#where-to-enforce-quality-checks)
7. [Python: A Mini Data Quality Framework](#python-a-mini-data-quality-framework)
8. [Freshness SLAs & SLOs](#freshness-slas--slos)
9. [Statistical Anomaly Detection (Beyond Fixed Rules)](#statistical-anomaly-detection-beyond-fixed-rules)
10. [SLA Breach Alerting in Practice](#sla-breach-alerting-in-practice)
11. [A Data Contract, Made Concrete](#a-data-contract-made-concrete)
12. [Lineage](#lineage)
13. [Common Tools](#common-tools)
14. [Gotchas](#gotchas)
15. [Pro Tips](#pro-tips)

---

## Core Concepts

Data quality problems are expensive precisely because they're **silent** — a pipeline can
run "successfully" (no errors, no crashed jobs) while quietly producing wrong numbers, and
those wrong numbers can propagate through a dozen downstream tables and dashboards before
anyone notices. The design goal of this category is to catch problems **as early and as
loudly as possible** — ideally at the producer/ingestion boundary, not three tables downstream
when someone finally notices a dashboard looks off.

## Quick-Reference Table

| Concept | What It Solves |
|---|---|
| **Data contract** | An explicit, versioned agreement between a data producer and consumer about schema and semantics — prevents "the upstream team changed something and broke us with no warning" |
| **Schema evolution rules** | Defines which changes are safe to make without breaking existing consumers |
| **Quality checks (dbt tests, Great Expectations)** | Catch null/duplicate/out-of-range/referential-integrity issues automatically, as part of the pipeline, not as a manual spot-check |
| **Freshness SLA/SLO** | A stated, monitored commitment for how stale data is allowed to get before it's considered a failure |
| **Lineage** | Traces where a piece of data came from and what it feeds into — critical for impact analysis and incident response |

## Data Contracts

A data contract is an explicit agreement — schema, semantics, and update cadence — between
whoever produces a dataset and whoever consumes it, ideally version-controlled and enforced
automatically rather than living only in institutional memory or a Slack thread. In practice
this often means: the producing team can't change a table's schema or the meaning of a
column without a coordinated, versioned change, because downstream consumers (dashboards, ML
models, other pipelines) depend on the current shape holding.

Design implication: **the contract belongs to the interface, not to either side alone.**
Treat schema changes the way you'd treat an API version bump — communicate, version,
deprecate gradually, never silently break.

## Schema Evolution: Breaking vs. Non-Breaking Changes

| Change | Backward Compatible? | Notes |
|---|---|---|
| Add an optional/nullable field with a default | ✅ Yes | Old readers ignore it; new readers get the default for old data |
| Add a required field with no default | ❌ No | Old data has no value to populate it with |
| Remove a field | ❌ No (for readers still expecting it) | Safe only after all consumers have migrated off it |
| Rename a field | ❌ No | Functionally a remove + add; needs a migration window with both names present |
| Widen a numeric type (int32 → int64) | ✅ Usually | Value range only grows |
| Narrow a numeric type (int64 → int32) | ❌ No | Risk of overflow/truncation on existing large values |
| Change a field's semantic meaning without changing its name/type | ❌ No (but tooling won't catch it!) | The most dangerous kind — passes every automated schema check while being wrong |

That last row matters: automated schema-compatibility tooling only catches *structural*
breakage. A column silently changing meaning (e.g. `amount` switching from USD to local
currency) breaks every downstream consumer without tripping any schema check — this is what
data contracts and semantic documentation are for, not schema validation alone.

## Python: A Schema Compatibility Checker

A simplified version of what schema registries (Confluent Schema Registry, AWS Glue Schema
Registry) do automatically on every schema registration:

```python
def check_backward_compatible(old_schema: dict, new_schema: dict) -> dict:
    """Simplified backward-compatibility check: can a new-schema writer's data still be
    read correctly by old-schema readers? Rule of thumb: fields may be added only with a
    default, and no existing field may be removed or have its type changed."""
    issues = []
    old_fields = {f["name"]: f for f in old_schema["fields"]}
    new_fields = {f["name"]: f for f in new_schema["fields"]}

    for name, old_f in old_fields.items():
        if name not in new_fields:
            issues.append(f"REMOVED required field '{name}' -- breaks backward compatibility")
            continue
        new_f = new_fields[name]
        if old_f["type"] != new_f["type"]:
            issues.append(f"TYPE CHANGED for '{name}': {old_f['type']} -> {new_f['type']}")

    for name, new_f in new_fields.items():
        if name not in old_fields and "default" not in new_f:
            issues.append(f"ADDED field '{name}' with NO DEFAULT -- old readers can't populate it")

    return {"compatible": len(issues) == 0, "issues": issues}


old_schema = {"fields": [
    {"name": "user_id", "type": "long"},
    {"name": "event_type", "type": "string"},
]}

new_schema_ok = {"fields": [
    {"name": "user_id", "type": "long"},
    {"name": "event_type", "type": "string"},
    {"name": "session_id", "type": "string", "default": ""},
]}

new_schema_bad = {"fields": [
    {"name": "user_id", "type": "string"},     # type changed!
    {"name": "session_id", "type": "string"},  # no default, and event_type removed
]}

print("Additive change (with default):", check_backward_compatible(old_schema, new_schema_ok))
print("Breaking change:", check_backward_compatible(old_schema, new_schema_bad))
```

Output:

```
Additive change (with default): {'compatible': True, 'issues': []}
Breaking change: {'compatible': False, 'issues': ["TYPE CHANGED for 'user_id': long -> string", "REMOVED required field 'event_type' -- breaks backward compatibility", "ADDED field 'session_id' with NO DEFAULT -- old readers can't populate it"]}
```

## Where to Enforce Quality Checks

```
Ingestion boundary          In-pipeline (transform)          Serving layer
──────────────────          ────────────────────────          ─────────────
Schema validation       →   dbt tests / Great Expectations →  Freshness monitors on
against contract             on staging/mart tables             the final tables
Reject/quarantine bad        (nulls, uniqueness, referential    consumers actually query
records at the door           integrity, accepted values)
```

**Design principle: push checks as far upstream as possible.** A malformed record rejected
at ingestion never has the chance to corrupt three downstream tables; the same check run
only at the serving layer means the damage already happened and now needs to be traced back
and cleaned up.

## Python: A Mini Data Quality Framework

A miniature version of what Great Expectations / dbt tests do — useful for demonstrating the
underlying mechanics in an interview even if you'd use a real framework in production:

```python
import pandas as pd
from datetime import datetime, timedelta


class DataQualityCheck:
    def __init__(self, df: pd.DataFrame):
        self.df = df
        self.results = []

    def not_null(self, column):
        n_null = self.df[column].isnull().sum()
        passed = n_null == 0
        self.results.append((f"not_null({column})", passed, f"{n_null} nulls found"))
        return self

    def unique(self, column):
        n_dupes = self.df[column].duplicated().sum()
        passed = n_dupes == 0
        self.results.append((f"unique({column})", passed, f"{n_dupes} duplicates found"))
        return self

    def in_range(self, column, min_val, max_val):
        out_of_range = ((self.df[column] < min_val) | (self.df[column] > max_val)).sum()
        passed = out_of_range == 0
        self.results.append((f"in_range({column}, {min_val}, {max_val})", passed,
                              f"{out_of_range} rows out of range"))
        return self

    def freshness(self, timestamp_column, max_age_minutes):
        latest = pd.to_datetime(self.df[timestamp_column]).max()
        age_minutes = (datetime.now() - latest.to_pydatetime()).total_seconds() / 60
        passed = age_minutes <= max_age_minutes
        self.results.append((f"freshness({timestamp_column})", passed,
                              f"{age_minutes:.1f} min old (max {max_age_minutes})"))
        return self

    def summary(self) -> bool:
        for name, passed, detail in self.results:
            print(f"[{'PASS' if passed else 'FAIL'}] {name}: {detail}")
        return all(p for _, p, _ in self.results)


df = pd.DataFrame({
    "order_id": [1, 2, 3, 3],
    "amount": [50.0, None, 999999.0, 20.0],
    "updated_at": [datetime.now() - timedelta(minutes=m) for m in [2, 5, 3, 200]],
})

dq = DataQualityCheck(df)
all_passed = (dq.not_null("amount")
                .unique("order_id")
                .in_range("amount", 0, 10000)
                .freshness("updated_at", max_age_minutes=30)
                .summary())
print("\nAll checks passed:", all_passed)
```

Output:

```
[FAIL] not_null(amount): 1 nulls found
[FAIL] unique(order_id): 1 duplicates found
[FAIL] in_range(amount, 0, 10000): 1 rows out of range
[PASS] freshness(updated_at): 2.0 min old (max 30)

All checks passed: False
```

In production this is precisely the shape of a dbt test suite or a Great Expectations
checkpoint — the value in walking through the mini version in an interview is showing you
understand *what* the check is actually verifying, not just that you can name the tool.

## Freshness SLAs & SLOs

- **SLA (Service Level Agreement)**: an external, often contractual, commitment ("dashboard
  data is refreshed within 1 hour of ingestion, 99% of the time").
- **SLO (Service Level Objective)**: an internal target used to operate against, usually
  stricter than the SLA to leave margin ("we target 45 minutes internally to protect a
  1-hour external SLA").
- Implementation is usually a small control table tracking last-successful-run timestamps
  per pipeline/table, monitored by an alerting job that pages when the gap exceeds the
  threshold — conceptually identical to the `freshness()` check above, just running
  continuously against production rather than once against a DataFrame.

## Statistical Anomaly Detection (Beyond Fixed Rules)

Rule-based checks (`not_null`, `in_range`) catch known failure modes, but they can't catch
"this table normally has ~10M rows and today it has 4.8M" unless someone happened to write a
rule with that exact threshold. A **z-score-based anomaly detector** compares today's value
against recent history and flags statistically unusual deviations, catching problems no one
thought to write an explicit rule for:

```python
import statistics

class VolumeAnomalyDetector:
    """Detects anomalies in daily row-count volume using a z-score against rolling
    history -- catches problems a fixed rule can't, like a 50% drop from a normally
    10-million-row table that's still technically 'a lot of rows'."""

    def __init__(self, history_window=14, z_threshold=3.0):
        self.history_window = history_window
        self.z_threshold = z_threshold
        self.history = []

    def check(self, today_count: int) -> dict:
        if len(self.history) < 3:
            self.history.append(today_count)
            return {"status": "insufficient_history", "z_score": None}

        mean = statistics.mean(self.history)
        stdev = statistics.stdev(self.history) if len(self.history) > 1 else 1
        z = (today_count - mean) / stdev if stdev > 0 else 0

        is_anomaly = abs(z) > self.z_threshold
        self.history.append(today_count)
        if len(self.history) > self.history_window:
            self.history.pop(0)

        return {"status": "anomaly" if is_anomaly else "normal", "z_score": round(z, 2),
                "expected_range": (round(mean - self.z_threshold*stdev), round(mean + self.z_threshold*stdev))}


detector = VolumeAnomalyDetector(z_threshold=3.0)
daily_counts = [10_000_000, 10_200_000, 9_900_000, 10_100_000, 10_050_000, 4_800_000]  # last is a big drop
for day, count in enumerate(daily_counts):
    print(f"Day {day}: count={count:,} -> {detector.check(count)}")
```

Output:

```
Day 0: count=10,000,000 -> {'status': 'insufficient_history', 'z_score': None}
Day 1: count=10,200,000 -> {'status': 'insufficient_history', 'z_score': None}
Day 2: count=9,900,000 -> {'status': 'insufficient_history', 'z_score': None}
Day 3: count=10,100,000 -> {'status': 'normal', 'z_score': 0.44, 'expected_range': (9575076, 10491591)}
Day 4: count=10,050,000 -> {'status': 'normal', 'z_score': 0.0, 'expected_range': (9662702, 10437298)}
Day 5: count=4,800,000 -> {'status': 'anomaly', 'z_score': -46.96, 'expected_range': (9714590, 10385410)}
```

The day-5 drop trips the detector with an enormous z-score (-46.96) — nowhere near the
expected range even accounting for normal day-to-day variance. This is the mechanism behind
tools like Monte Carlo/Bigeye/Soda: rule-based checks catch what you thought to specify;
anomaly detection catches the shape of "wrong" you didn't anticipate.

## SLA Breach Alerting in Practice

Turning the freshness concept into an actual monitor that would page someone:

```python
from datetime import datetime, timedelta

class FreshnessSLAMonitor:
    def __init__(self, sla_minutes: int):
        self.sla_minutes = sla_minutes
        self.alerts = []

    def check(self, table_name: str, last_success: datetime, now: datetime):
        age_minutes = (now - last_success).total_seconds() / 60
        if age_minutes > self.sla_minutes:
            alert = f"SLA BREACH: {table_name} is {age_minutes:.0f} min stale (SLA: {self.sla_minutes} min)"
            self.alerts.append(alert)
            return alert
        return f"OK: {table_name} is {age_minutes:.0f} min old"


monitor = FreshnessSLAMonitor(sla_minutes=60)
now = datetime(2026, 9, 13, 15, 0, 0)
print(monitor.check("fct_sales", last_success=now - timedelta(minutes=30), now=now))
print(monitor.check("fct_inventory", last_success=now - timedelta(minutes=125), now=now))
print("Active alerts:", monitor.alerts)
```

Output:

```
OK: fct_sales is 30 min old
SLA BREACH: fct_inventory is 125 min stale (SLA: 60 min)
Active alerts: ['SLA BREACH: fct_inventory is 125 min stale (SLA: 60 min)']
```

In production, `monitor.check` would run on a schedule (e.g. every 5 minutes) against a
control table of `last_success` timestamps per pipeline, with `alerts` routed to a paging
system rather than a Python list — but the underlying logic is exactly this comparison.

## A Data Contract, Made Concrete

Rather than leaving "data contract" as an abstract agreement, here's what one actually looks
like as a versioned artifact both producer and consumer teams can point to:

```yaml
# contracts/orders_v2.yaml
dataset: bronze.orders
version: 2
owner: checkout-team
consumers: [analytics-eng, fraud-ml-team]
schema:
  - name: order_id
    type: string
    required: true
  - name: customer_id
    type: string
    required: true
  - name: amount
    type: decimal(10,2)
    required: true
  - name: currency
    type: string
    required: true
    added_in_version: 2   # documents WHEN a field was introduced
    default: "USD"          # so old consumers reading pre-v2 data know what to assume
sla:
  freshness_minutes: 15
  availability_pct: 99.9
breaking_change_policy: "Breaking changes require a new dataset version and a minimum
  30-day deprecation window on the previous version before it stops being written."
```

The value of writing this down isn't the YAML syntax — it's that `added_in_version` and
`default` together answer the exact question that caused a real bug in the schema
compatibility discussion earlier ("what does an old reader do with a new field?"), and
`breaking_change_policy` gives consumers a concrete, enforceable expectation instead of an
informal understanding that erodes as team membership changes over time.

## Lineage

Lineage tracks, for any given table or column, **where its data came from** (upstream
sources and transformations) and **what depends on it** (downstream tables, dashboards,
models). Two practical uses come up constantly in interviews:

- **Impact analysis**: "if I change this column's meaning, what breaks?" — answered by
  walking the lineage graph forward.
- **Incident response**: "this number looks wrong, where did it come from?" — answered by
  walking the lineage graph backward to the source.

Most modern transformation tools (dbt) generate lineage automatically from the DAG of
model dependencies; catalog tools (see `09-metadata-catalog-design.md`) then surface it
for humans to browse.

## Common Tools

| Tool | Role |
|---|---|
| **dbt tests** | Declarative tests (not_null, unique, accepted_values, relationships) run as part of the transformation DAG |
| **Great Expectations** | Standalone data validation framework, richer expectation library, checkpoint-based execution, good for validating raw/bronze data before it enters the warehouse |
| **Confluent / AWS Glue Schema Registry** | Enforces schema compatibility rules on every schema registration for Kafka/Avro pipelines |
| **Monte Carlo / Bigeye / Soda** | Data observability platforms — automated anomaly detection on freshness, volume, and distribution, beyond hand-written rule-based checks |

## Gotchas

- Automated schema checks catch **structural** breakage, not **semantic** breakage — a
  column silently changing meaning while keeping its name and type passes every automated
  check while still corrupting every downstream consumer.
- Running quality checks only at the very end of the pipeline means a bad record has already
  fanned out into every downstream table before anyone finds out — push checks upstream.
  large tables.
- Treating "the pipeline ran without errors" as equivalent to "the data is correct" — these
  are different claims, and only quality checks (not job success/failure status) verify the
  second one.
- No alerting tied to freshness/quality checks — a check that fails silently into a log file
  nobody reads provides zero actual protection.

## Pro Tips

- When describing your pipeline's quality strategy, name the specific layer each check runs
  at (ingestion vs. transform vs. serving) — this shows you're deliberately trapping issues
  early rather than running a generic, undifferentiated pile of checks.
- If asked "how would you catch a subtle data quality issue," distinguish rule-based checks
  (nulls, ranges, uniqueness — deterministic, cheap) from anomaly-detection-based checks
  (statistical drift in volume/distribution — catches things you didn't think to write a
  rule for, at the cost of false positives).
- Volunteer the lineage connection when discussing incident response: "and because we have
  column-level lineage, when this number looked wrong we could trace it back to the specific
  upstream table in minutes rather than hours."
- Mention data contracts specifically when a design involves multiple teams producing and
  consuming the same data — it's the single concept interviewers most associate with
  "has this person worked in a real multi-team data organization."
