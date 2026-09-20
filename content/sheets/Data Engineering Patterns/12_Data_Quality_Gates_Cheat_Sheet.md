# Data Quality Gates Cheatsheet for Data Engineers

> A structured reference for validating data at pipeline boundaries — schema checks, completeness/uniqueness/freshness rules, blocking vs warning severity, and enforceable data contracts. Expanded from a short pattern note into a full implementation guide with runnable checks.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 When to Add Quality Gates](#when-to-add-quality-gates)
4. [🏗️ Where Gates Belong in a Pipeline](#where-gates-belong-in-a-pipeline)
5. [✅ Core Check Types](#core-check-types)
6. [🚦 Blocking vs Warning Severity](#blocking-vs-warning-severity)
7. [📜 Data Contracts](#data-contracts)
8. [🛠️ Tooling Landscape](#tooling-landscape)
9. [📣 Publishing Failures for Fast Repair](#publishing-failures-for-fast-repair)
10. [🔍 Statistical / Anomaly Checks](#statistical-anomaly-checks)
11. [🧰 Great Expectations Full Example](#great-expectations-full-example)
12. [🌊 Soda Core YAML Checks](#soda-core-yaml-checks)
13. [🔌 Circuit Breaker Pattern for Pipelines](#circuit-breaker-pattern-for-pipelines)
14. [🧪 Testing the Gates Themselves](#testing-the-gates-themselves)
15. [📈 A Data Quality Scorecard](#a-data-quality-scorecard)
16. [⚠️ Common Gotchas](#common-gotchas)
17. [✅ Best Practices Checklist](#best-practices-checklist)
18. [📚 Quality Gates vs Testing vs Monitoring](#quality-gates-vs-testing-vs-monitoring)
19. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| Where to check | At every pipeline boundary (ingest, transform, publish) |
| Check types | Schema, completeness, uniqueness, freshness, business rules |
| Severity | Blocking (stop the pipeline) vs warning (log and continue) |
| Ownership | Thresholds owned by the data owner, not just the pipeline author |
| Failure output | Row-level detail, not just a pass/fail count |
| Common tools | Great Expectations, dbt tests, Soda, Deequ, custom SQL assertions |

## 🧠 Core Concept

Data quality gates are **executable checks placed at pipeline boundaries** that validate schema, completeness, uniqueness, freshness, and business rules before data is trusted or published downstream. The goal is to fail fast and loudly at the point of ingestion or transformation, rather than let corruption propagate silently into dashboards and models where it's expensive to trace back.

```text
[ raw/staged data ]  --schema check-->  --completeness/uniqueness check-->  --business rule check-->  [ publish (gate passed) ]
                                                    |
                                                    v (gate failed)
                                          [ block publish + alert owner ]
```

## 🎯 When to Add Quality Gates

**Add gates when:**
- A dataset is shared across teams or feeds a business-critical report/model — silent corruption there is expensive.
- You've been burned before by a null spike, duplicate key, or stale partition reaching production undetected.
- A downstream team has (implicitly or explicitly) a data contract with you about shape and freshness.

**Skip or lighten gates when:**
- The dataset is a personal scratch/exploratory table with a single consumer who understands its rough edges.
- The check would cost more compute/latency than the risk it mitigates — not every table needs the full suite.

## 🏗️ Where Gates Belong in a Pipeline

```python
def run_pipeline():
    raw = extract()
    validate_schema(raw)              # gate 1: fail fast on structural drift

    staged = transform(raw)
    validate_business_rules(staged)   # gate 2: fail before publish

    if quality_gate_passed(staged):
        publish(staged)               # only publish on a passed gate
    else:
        quarantine(staged)
        alert_owner()
```

Gates at the **boundary between stages** (not just at the very end) catch problems closer to their source, which makes debugging dramatically faster.

## ✅ Core Check Types

```sql
-- Completeness: required fields aren't null
SELECT COUNT(*) AS invalid_rows
FROM staging.orders
WHERE customer_id IS NULL OR amount < 0;

-- Uniqueness: a business key isn't duplicated
SELECT order_id
FROM staging.orders
GROUP BY order_id
HAVING COUNT(*) > 1;

-- Freshness: the latest partition isn't stale
SELECT MAX(order_date) AS latest_date,
       DATEDIFF(CURRENT_DATE, MAX(order_date)) AS days_stale
FROM staging.orders;

-- Referential integrity: foreign keys resolve
SELECT o.order_id
FROM staging.orders o
LEFT JOIN dim.customers c ON o.customer_id = c.customer_id
WHERE c.customer_id IS NULL;

-- Distribution / range sanity check
SELECT COUNT(*) AS out_of_range
FROM staging.orders
WHERE amount > 1000000 OR amount < 0;
```

```python
# Python/pandas-or-polars-style equivalent, useful inside orchestrated tasks
def validate_business_rules(df):
    errors = []
    if df.filter(pl.col("customer_id").is_null()).height > 0:
        errors.append("null customer_id found")
    dup_count = df.height - df.select("order_id").n_unique()
    if dup_count > 0:
        errors.append(f"{dup_count} duplicate order_id rows")
    if errors:
        raise DataQualityError(errors)
```

## 🚦 Blocking vs Warning Severity

Not every failed check should stop the pipeline — over-blocking trains teams to ignore or bypass gates.

```python
CHECKS = [
    {"name": "no_null_keys", "severity": "blocking"},
    {"name": "freshness_within_36h", "severity": "blocking"},
    {"name": "amount_within_historical_range", "severity": "warning"},
    {"name": "row_count_within_5pct_of_7day_avg", "severity": "warning"},
]

def run_gate(df, checks):
    failures = [c for c in checks if not run_check(df, c)]
    blocking_failures = [f for f in failures if f["severity"] == "blocking"]
    if blocking_failures:
        raise PipelineHalted(blocking_failures)
    for f in failures:
        log_warning(f)   # non-blocking: publish anyway, but make it visible
```

| Severity | Behavior | Use for |
|---|---|---|
| Blocking | Halts the pipeline, no publish | Null keys, duplicate business keys, missing partitions, broken referential integrity |
| Warning | Publishes, but logs/alerts | Row-count drift, statistical outliers, soft SLA misses |

## 📜 Data Contracts

Formalize expectations between producer and consumer so quality gates enforce an agreed contract, not an arbitrary rule the pipeline author invented alone.

```yaml
# Example data contract (conceptual)
dataset: staging.orders
owner: checkout-team
schema:
  order_id: {type: string, nullable: false, unique: true}
  customer_id: {type: string, nullable: false}
  amount: {type: decimal(10,2), nullable: false, min: 0}
freshness:
  expected_cadence: hourly
  max_staleness_minutes: 90
on_breach:
  blocking: [order_id, customer_id]
  warning: [amount]
```

## 🛠️ Tooling Landscape

| Category | Tools |
|---|---|
| Assertion frameworks | Great Expectations, Soda Core/Cloud, dbt tests |
| Scale-out (Spark-native) | Deequ (AWS), PyDeequ |
| Warehouse-native | Snowflake/BigQuery scheduled SQL assertions |
| Orchestrator integration | Airflow/Dagster sensors and task-level gates |

```python
# dbt test example (schema.yml)
# models:
#   - name: stg_orders
#     columns:
#       - name: order_id
#         tests: [unique, not_null]
#       - name: amount
#         tests:
#           - dbt_utils.accepted_range:
#               min_value: 0
```

## 📣 Publishing Failures for Fast Repair

```python
def publish_failure_report(failures, dataset):
    report = {
        "dataset": dataset,
        "failed_checks": [f["name"] for f in failures],
        "sample_bad_rows": get_sample_failing_rows(failures, limit=20),
        "timestamp": now(),
    }
    notify_owner_channel(report)   # Slack/PagerDuty/email — not just a log line
```

A failure with **row-level detail** ("here are 20 rows with the null customer_id") gets fixed in minutes; a failure with just "gate failed: 1 error" gets investigated for an hour first.

## 🔍 Statistical / Anomaly Checks

```sql
-- Volume anomaly: today's row count vs trailing 7-day average
WITH daily_counts AS (
    SELECT order_date, COUNT(*) AS row_count
    FROM staging.orders
    GROUP BY order_date
)
SELECT order_date, row_count,
       AVG(row_count) OVER (ORDER BY order_date ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING) AS avg_7day
FROM daily_counts
QUALIFY row_count < 0.5 * avg_7day OR row_count > 1.5 * avg_7day;
```

These catch problems structural checks miss entirely — a schema-valid, non-null, unique dataset that's simply 90% smaller than usual because an upstream job silently failed halfway through.

## 🧰 Great Expectations Full Example

```python
import great_expectations as gx

context = gx.get_context()
validator = context.sources.pandas_default.read_csv("staging/orders.csv")

# Build a full suite of expectations, mixing structural and business-rule checks
validator.expect_column_values_to_not_be_null("customer_id")
validator.expect_column_values_to_be_unique("order_id")
validator.expect_column_values_to_be_between("amount", min_value=0, max_value=1_000_000)
validator.expect_column_values_to_match_regex("email", r"^[^@]+@[^@]+\.[^@]+$")
validator.expect_table_row_count_to_be_between(min_value=1000, max_value=None)  # catches empty/truncated loads

result = validator.validate()
if not result.success:
    failed = [r for r in result.results if not r.success]
    for f in failed:
        print(f"FAILED: {f.expectation_config.expectation_type} on {f.expectation_config.kwargs}")
    raise DataQualityError(failed)
```

```python
# Wiring a Great Expectations checkpoint into an Airflow task
checkpoint = context.add_or_update_checkpoint(
    name="orders_checkpoint",
    validator=validator,
    action_list=[
        {"name": "store_validation_result", "action": {"class_name": "StoreValidationResultAction"}},
        {"name": "notify_slack_on_failure", "action": {"class_name": "SlackNotificationAction", "slack_webhook": SLACK_WEBHOOK}},
    ],
)
checkpoint_result = checkpoint.run()
if not checkpoint_result.success:
    raise PipelineHalted("Great Expectations checkpoint failed")
```

Great Expectations' strength is the **generated data docs** — an auto-published, human-readable report of every expectation and its pass/fail history, which doubles as living documentation of what "correct" means for a dataset.

## 🌊 Soda Core YAML Checks

```yaml
# checks.yml — declarative, readable by non-engineers, good for business-rule sign-off
checks for staging.orders:
  - row_count > 0
  - missing_count(customer_id) = 0
  - duplicate_count(order_id) = 0
  - invalid_percent(email) < 1%:
      valid format: email
  - freshness(order_date) < 2h
  - avg(amount) between 10 and 500:
      name: "average order value in expected range"
```

```bash
# Run checks as part of a pipeline step or CI job
soda scan -d warehouse_connection -c configuration.yml checks.yml
```

```python
# Programmatic invocation, so failures can drive pipeline branching logic
from soda.scan import Scan

scan = Scan()
scan.set_data_source_name("warehouse_connection")
scan.add_sodacl_yaml_file("checks.yml")
scan.execute()

if scan.has_check_fails():
    raise DataQualityError(scan.get_checks_fail())
```

Soda's YAML-first syntax is often the fastest way to get **business stakeholders reviewing and co-owning thresholds** — a `checks.yml` file is readable by an analyst who'd never touch a Python assertion.

## 🔌 Circuit Breaker Pattern for Pipelines

Borrowed from distributed systems: after repeated quality-gate failures on the same dataset, stop attempting to publish automatically and require a human to acknowledge before the pipeline resumes — this prevents a persistently broken upstream from spamming failures indefinitely while quietly leaving the dataset stuck on stale data.

```python
class QualityCircuitBreaker:
    def __init__(self, failure_threshold=3):
        self.failure_threshold = failure_threshold

    def check_and_run(self, dataset: str, run_fn):
        consecutive_failures = get_consecutive_failure_count(dataset)
        if consecutive_failures >= self.failure_threshold:
            if not is_manually_acknowledged(dataset):
                raise CircuitOpenError(
                    f"{dataset} has failed {consecutive_failures} times in a row — "
                    f"circuit open, awaiting manual acknowledgment before retrying"
                )
        try:
            run_fn()
            reset_failure_count(dataset)
        except DataQualityError:
            increment_failure_count(dataset)
            raise
```

This is distinct from ordinary blocking checks: a single blocking failure should already stop *that run's* publish, but a circuit breaker stops the *pipeline itself* from continuing to auto-retry against a source that's clearly broken, which is what prevents alert fatigue during a multi-hour upstream outage.

## 🧪 Testing the Gates Themselves

A quality gate that's never seen a failure hasn't been proven to work — treat gate logic itself as code that needs tests against known-bad fixtures.

```python
def test_gate_catches_null_customer_id():
    bad_df = make_df([{"order_id": "1", "customer_id": None, "amount": 10}])
    result = run_gate(bad_df, CHECKS)
    assert result.blocking_failures  # the gate must actually fail here

def test_gate_catches_duplicate_keys():
    bad_df = make_df([
        {"order_id": "1", "customer_id": "C1", "amount": 10},
        {"order_id": "1", "customer_id": "C2", "amount": 20},   # duplicate order_id
    ])
    result = run_gate(bad_df, CHECKS)
    assert any(f["name"] == "no_duplicate_keys" for f in result.blocking_failures)

def test_gate_passes_clean_data():
    good_df = make_df([{"order_id": "1", "customer_id": "C1", "amount": 10}])
    result = run_gate(good_df, CHECKS)
    assert not result.blocking_failures  # no false positives on valid data

def test_warning_checks_dont_block_publish():
    outlier_df = make_df([{"order_id": "1", "customer_id": "C1", "amount": 999_999}])  # triggers a warning check only
    result = run_gate(outlier_df, CHECKS)
    assert not result.blocking_failures
    assert result.warnings
```

## 📈 A Data Quality Scorecard

```python
def compute_quality_score(dataset: str, days: int = 30) -> dict:
    runs = get_gate_history(dataset, days=days)
    return {
        "total_runs": len(runs),
        "pct_passed_clean": pct(r for r in runs if not r.failures),
        "pct_passed_with_warnings": pct(r for r in runs if r.warnings and not r.blocking_failures),
        "pct_blocked": pct(r for r in runs if r.blocking_failures),
        "most_common_failure": most_common([f["name"] for r in runs for f in r.failures]),
        "avg_time_to_ack_blocking_failure_minutes": avg(r.ack_latency_minutes for r in runs if r.blocking_failures),
    }
```

Publishing this per-dataset scorecard turns "our data quality is bad" from a vague complaint into a specific, trackable metric — and makes it obvious which datasets need investment (chronically failing the same check) versus which are healthy and just need routine gate maintenance.

## ⚠️ Common Gotchas

- **Checking everything as "blocking" trains teams to bypass the gate** when a false positive blocks an urgent release — reserve blocking for genuinely unsafe-to-publish conditions.
- **Aggregate pass/fail counts without row-level detail** turn every failure into a slow investigation.
- **Thresholds set once and never revisited** drift out of sync with real seasonal/business patterns (e.g., holiday volume spikes trip a static threshold every year).
- **Checks that run after publish** don't prevent the bad data from reaching consumers — they only tell you it already did.
- **No owner for check thresholds** means checks are either ignored or overly conservative — thresholds need a human accountable for tuning them.
- **Testing only the happy path** — quality gates should also be tested against known-bad synthetic data to confirm they actually catch what they claim to.
- **No circuit breaker for repeated failures** — a persistently broken upstream can spam the same alert for hours or days without anyone escalating, while the dataset sits stuck on stale data.
- **Business-readable checks (Soda-style YAML) never reviewed by the business** — the format's whole advantage is stakeholder sign-off; skipping that review misses the point.
- **No quality scorecard at all** — without tracking pass/fail/warning rates over time, "our data quality is bad" stays a vague complaint instead of a specific, prioritizable list of chronically-failing checks.

## ✅ Best Practices Checklist

- [ ] Checks run at every pipeline boundary, before publish — not only at the end
- [ ] Severity is explicitly blocking vs warning, chosen deliberately per check
- [ ] Failures include row-level detail, not just a count
- [ ] Thresholds are owned by a named person/team and reviewed periodically
- [ ] Statistical/anomaly checks complement structural checks (nulls, duplicates)
- [ ] Data contracts formalize the agreement between producer and consumer
- [ ] Gates are themselves tested against known-bad synthetic data

## 📚 Quality Gates vs Testing vs Monitoring

| Concept | When it runs | Answers |
|---|---|---|
| Quality gate | Inline, in the pipeline, before publish | "Is this specific run's output safe to publish?" |
| Unit/integration test | Pre-deploy, in CI | "Does the transform logic behave correctly on known inputs?" |
| Monitoring/observability | Continuously, post-publish | "Is the system, as a whole, healthy over time?" |

All three are complementary — gates alone won't catch a logic bug that was never in the test suite, and monitoring alone won't stop bad data from ever being published.

## 💡 Pro Tips

1. **Put gates at every boundary**, not just the final publish step — earlier failure is cheaper to debug.
2. **Split severity deliberately** — blocking for unsafe conditions, warning for "worth a human look."
3. **Always emit row-level failure samples**, not just aggregate counts.
4. **Write data contracts down**, even informally — an agreed contract turns a gate from "arbitrary rule" into "enforced agreement."
5. **Add statistical checks alongside structural ones** — volume/distribution anomalies catch classes of failure nulls and duplicates checks miss.
6. **Assign an owner to every threshold** so they get tuned, not just inherited forever.
7. **Test your gates against synthetic bad data** during development — a gate that's never seen a failure might not actually catch one.
8. **Route failures to the team that can fix the source**, not just to a general data-platform inbox.
9. **Re-evaluate static thresholds seasonally** — Black Friday volume shouldn't trip a "row count anomaly" alert every year.
10. **Don't let a broken gate silently pass** — alert on the gate's own health (e.g., the check query itself failing to run), not only on check failures.
11. **Use a circuit breaker for repeated failures** — stop auto-retrying against a source that's clearly broken, and require a human acknowledgment before resuming.
12. **Pick the tool that matches who needs to read the checks** — Soda's YAML for business-reviewable rules, Great Expectations for rich data docs, dbt tests for checks that live alongside the models they validate.
13. **Publish a per-dataset quality scorecard** (pass rate, most common failure) so investment decisions are based on data, not anecdote.
14. **Write negative tests for every gate** — a fixture with the exact bad data the check exists to catch, asserting the check actually fires.
15. **Distinguish "this run is unsafe to publish" (a check failure) from "this pipeline is broken" (repeated failures)** — the former blocks one run, the latter should escalate.

