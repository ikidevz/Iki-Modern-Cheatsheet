# Data Observability Cheatsheet for Data Engineers

> A structured reference for continuously monitoring data health in production — the five pillars of data observability (freshness, volume, schema, distribution, lineage), anomaly detection approaches, alert design, and how observability differs from (and complements) quality gates.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 When to Invest in Observability](#when-to-invest-in-observability)
4. [🏛️ The Five Pillars](#the-five-pillars)
5. [⏰ Freshness Monitoring](#freshness-monitoring)
6. [📊 Volume Monitoring](#volume-monitoring)
7. [📐 Schema Change Detection](#schema-change-detection)
8. [📈 Distribution and Statistical Monitoring](#distribution-and-statistical-monitoring)
9. [🔗 Lineage-Aware Incident Impact](#lineage-aware-incident-impact)
10. [🤖 Anomaly Detection Approaches](#anomaly-detection-approaches)
11. [🔔 Alert Design and Fatigue Prevention](#alert-design-and-fatigue-prevention)
12. [🛠️ Tooling Landscape](#tooling-landscape)
13. [🧪 Testing Observability Coverage](#testing-observability-coverage)
14. [⚠️ Common Gotchas](#common-gotchas)
15. [✅ Best Practices Checklist](#best-practices-checklist)
16. [📚 Observability vs Quality Gates vs Testing](#observability-vs-quality-gates-vs-testing)
17. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| Five pillars | Freshness, volume, schema, distribution, lineage |
| Detection style | Continuous, automated, post-publish — not a manual dashboard check |
| Baseline | Statistical (trailing average/std dev), not a hardcoded static threshold |
| Alert routing | To the team that owns the failing dataset, with enough context to act |
| Failure mode to avoid | "Silent data" — a pipeline that "succeeds" while producing wrong/incomplete data |
| Common tools | Monte Carlo, Metaplane, Bigeye, re_data, dbt + custom checks |

## 🧠 Core Concept

Data observability is the continuous, automated monitoring of a data system's health across production — answering "is my data okay *right now*, and would I know if it weren't?" without a human having to think to check. It's the data equivalent of application observability (metrics, logs, traces), applied to datasets instead of services.

```text
[ pipelines run continuously ]  -->  [ observability layer watches freshness/volume/schema/distribution/lineage ]
                                              │
                                              ▼ (anomaly detected)
                                  [ alert routed to the owning team, with context ]
```

The core insight observability adds over one-off quality checks: **most data incidents are things nobody thought to write an explicit check for** — observability's statistical/automated monitoring catches classes of failure that predefined rules miss entirely.

## 🎯 When to Invest in Observability

**Invest when:**
- You've had "silent data" incidents — a pipeline reported success while producing wrong, incomplete, or stale output that only a downstream user (or worse, a customer) noticed.
- The number of tables/pipelines has grown past what a human can manually spot-check regularly.
- Trust in data has eroded because incidents are discovered late, by consumers, rather than caught early, by the platform.

**Lighter-weight approaches suffice when:**
- A small number of well-understood pipelines already have thorough quality gates (see [data-quality-gates.md](./Data_Quality_Gates_Cheat_Sheet.md)) covering the realistic failure modes.
- The team is small enough that informal monitoring (someone checks the dashboard every morning) is genuinely working.

## 🏛️ The Five Pillars

| Pillar | Question it answers |
|---|---|
| Freshness | Is this data as recent as it's supposed to be? |
| Volume | Is the row count/size in the expected range? |
| Schema | Has the structure changed unexpectedly? |
| Distribution | Do the values look statistically normal (nulls, ranges, cardinality)? |
| Lineage | What upstream/downstream is affected if this dataset breaks? |

Quality gates (from the earlier cheat sheet) typically implement pillars 2–4 as **explicit, predefined checks** at pipeline boundaries; observability implements all five **continuously and often automatically-baselined**, catching drift nobody wrote a rule for.

## ⏰ Freshness Monitoring

```sql
-- Freshness as a continuously-monitored metric, not a one-time check
SELECT
    table_name,
    MAX(updated_at) AS latest_update,
    TIMESTAMPDIFF(MINUTE, MAX(updated_at), CURRENT_TIMESTAMP()) AS minutes_stale,
    expected_freshness_minutes,
    TIMESTAMPDIFF(MINUTE, MAX(updated_at), CURRENT_TIMESTAMP()) > expected_freshness_minutes AS is_stale
FROM observability.freshness_tracking
GROUP BY table_name, expected_freshness_minutes;
```

```python
def check_freshness_continuously():
    """Run on a short interval (e.g., every 5-10 minutes), independent of the
    pipeline's own schedule, so a pipeline that silently stopped running is caught
    even though nothing about the (non-running) pipeline itself failed."""
    for dataset in monitored_datasets:
        staleness = compute_staleness_minutes(dataset)
        if staleness > dataset.expected_freshness_minutes * 1.5:
            fire_alert("freshness", dataset, staleness_minutes=staleness)
```

The key design point: freshness monitoring runs **independently of the pipeline's own success/failure signal** — a pipeline that simply never triggered (a scheduler outage, a silently disabled DAG) produces no failure event at all, so only an external freshness check catches it.

## 📊 Volume Monitoring

```sql
-- Automatically baseline "normal" volume from trailing history, rather than a hardcoded threshold
WITH daily_counts AS (
    SELECT run_date, COUNT(*) AS row_count FROM mart.daily_revenue GROUP BY run_date
),
baseline AS (
    SELECT
        run_date, row_count,
        AVG(row_count) OVER (ORDER BY run_date ROWS BETWEEN 14 PRECEDING AND 1 PRECEDING) AS avg_14day,
        STDDEV(row_count) OVER (ORDER BY run_date ROWS BETWEEN 14 PRECEDING AND 1 PRECEDING) AS stddev_14day
    FROM daily_counts
)
SELECT * FROM baseline
WHERE ABS(row_count - avg_14day) > 3 * stddev_14day;   -- flags statistically unusual volume
```

A **statistical, trailing-window baseline** (as above) adapts automatically to seasonality and growth trends, unlike a hardcoded "alert if row count < 10,000" rule that needs manual updating as the business grows or as legitimate seasonal dips occur.

## 📐 Schema Change Detection

```python
def detect_schema_drift(table_name: str):
    """Compare the current live schema against the last known-good snapshot,
    catching upstream changes even when no one filed a change request."""
    current_schema = fetch_live_schema(table_name)
    last_known_schema = get_last_recorded_schema(table_name)

    added = set(current_schema) - set(last_known_schema)
    removed = set(last_known_schema) - set(current_schema)
    type_changes = {
        col: (last_known_schema[col], current_schema[col])
        for col in current_schema if col in last_known_schema and current_schema[col] != last_known_schema[col]
    }

    if removed or type_changes:
        fire_alert("schema_drift", table_name, removed=removed, type_changes=type_changes, severity="high")
    if added:
        fire_alert("schema_drift", table_name, added=added, severity="info")   # additive changes, lower urgency

    record_schema_snapshot(table_name, current_schema)
```

This is the automated-detection counterpart to the compatibility rules in [schema-evolution.md](./Schema_Evolution_Cheat_Sheet.md) — enforcement happens at the producer/registry level when possible, but observability catches drift that bypassed enforcement (an ungoverned source table, a third-party API response shape change).

## 📈 Distribution and Statistical Monitoring

```sql
-- Null-rate monitoring per column, trended over time
SELECT
    'customer_email' AS column_name,
    run_date,
    SUM(CASE WHEN customer_email IS NULL THEN 1 ELSE 0 END) / COUNT(*)::FLOAT AS null_rate
FROM staging.orders
GROUP BY run_date
ORDER BY run_date;

-- Cardinality monitoring: a sudden change in distinct value count often signals an upstream bug
SELECT run_date, COUNT(DISTINCT country) AS distinct_countries
FROM staging.orders
GROUP BY run_date;
```

```python
def flag_distribution_anomaly(column_stats_history):
    latest = column_stats_history[-1]
    baseline_mean = mean(s.null_rate for s in column_stats_history[-14:-1])
    baseline_std = stdev(s.null_rate for s in column_stats_history[-14:-1])
    if abs(latest.null_rate - baseline_mean) > 3 * baseline_std:
        fire_alert("distribution_anomaly", column="customer_email", metric="null_rate", value=latest.null_rate)
```

These distribution checks catch the class of incident that's most dangerous precisely *because* nothing "fails" in the traditional sense: the pipeline runs, the schema is unchanged, the row count is normal — but 40% of `customer_email` is suddenly null because an upstream form field got renamed.

## 🔗 Lineage-Aware Incident Impact

```python
def assess_incident_blast_radius(broken_dataset: str):
    """When an issue is detected, immediately surface what's downstream —
    turning 'something's wrong with raw.orders' into an actionable, prioritized list."""
    downstream = catalog.get_downstream(broken_dataset)
    return {
        "directly_affected": downstream,
        "dashboards_affected": [d for d in downstream if d.type == "dashboard"],
        "ml_models_affected": [d for d in downstream if d.type == "feature_table"],
    }
```

This is where observability and cataloging directly compose — see [data-cataloging.md](./Data_Cataloging_Cheat_Sheet.md#lineage-capture) for how the underlying lineage graph is built; observability consumes it to answer "who do I need to warn" the moment an anomaly fires.

## 🤖 Anomaly Detection Approaches

| Approach | How it works | Trade-off |
|---|---|---|
| Static threshold | Alert if metric crosses a fixed value | Simple, but needs manual tuning as the business changes |
| Trailing statistical baseline (mean/stddev) | Alert on deviation from recent historical norm | Adapts automatically, but needs enough history to be reliable |
| Seasonal decomposition | Accounts for known cyclic patterns (day-of-week, month-end) | More accurate for seasonal data, more complex to build/maintain |
| ML-based anomaly detection | Learns "normal" from multi-dimensional historical patterns | Highest effort/cost; justified mainly at large scale with many monitored metrics |

Most teams get the majority of the value from **trailing statistical baselines** — the added complexity of seasonal or ML-based detection is worth it mainly once you have enough monitored datasets that manual threshold tuning has become its own maintenance burden.

## 🔔 Alert Design and Fatigue Prevention

```python
def should_alert(anomaly, dataset):
    """Route by severity and suppress duplicate/flapping alerts —
    the single biggest driver of alert fatigue is the same anomaly firing repeatedly."""
    if is_already_open_incident(dataset, anomaly.type):
        return False   # don't re-alert on an already-acknowledged, ongoing issue
    if anomaly.severity == "info":
        return route_to_digest(anomaly)   # batch low-severity anomalies into a daily summary, not instant pings
    return route_to_oncall(anomaly, dataset.owner)
```

| Design choice | Why it matters |
|---|---|
| Route by severity | Not every anomaly needs an instant page — reserve paging for genuinely urgent, actionable issues |
| Suppress repeat alerts for an open incident | Prevents the same underlying issue from spamming the channel every monitoring cycle |
| Include lineage/impact in the alert body | An alert with "this affects the exec dashboard and 3 ML features" gets triaged faster than a bare metric name |
| Route to the owning team, not a general channel | Matches the ownership model from [data-cataloging.md](./Data_Cataloging_Cheat_Sheet.md#ownership-models) |

## 🛠️ Tooling Landscape

| Category | Tools |
|---|---|
| Dedicated observability platforms | Monte Carlo, Metaplane, Bigeye, Datadog Data Observability |
| Open-source | re_data, Elementary (dbt-native), OpenLineage-based custom builds |
| DIY / warehouse-native | Scheduled SQL checks + dbt + a metrics table, as shown throughout this sheet |

## 🧪 Testing Observability Coverage

```python
def test_freshness_monitor_fires_on_stale_data():
    inject_stale_dataset(hours_behind=5, expected_freshness_hours=1)
    run_freshness_check()
    assert alert_was_fired(type="freshness")

def test_schema_drift_detected_on_column_removal():
    record_baseline_schema("orders", {"order_id": "string", "amount": "decimal"})
    simulate_schema_change("orders", removed_columns=["amount"])
    run_schema_drift_check("orders")
    assert alert_was_fired(type="schema_drift", severity="high")

def test_no_false_positive_on_expected_seasonal_dip():
    inject_seasonal_low_volume_day(expected=True)   # e.g., a known holiday
    run_volume_check()
    assert not alert_was_fired(type="volume")   # a well-tuned baseline shouldn't flag expected dips
```

Test observability coverage the same way you'd test a quality gate — inject a known-bad condition and confirm the monitor actually fires, and inject a known-benign edge case (an expected seasonal dip) and confirm it does *not* fire.

## ⚠️ Common Gotchas

- **Monitoring only pipeline success/failure, not the data itself** — a pipeline that "succeeds" while producing wrong or incomplete data is exactly the failure mode observability exists to catch.
- **Static thresholds that need constant manual retuning** as volume grows or seasonality shifts — trailing statistical baselines solve most of this automatically.
- **Alert fatigue from unsuppressed, repeated alerts** on the same ongoing incident, which trains people to ignore the channel entirely.
- **No lineage context in alerts** — "table X looks anomalous" is far less actionable than "table X looks anomalous, and it feeds the exec dashboard and the churn model."
- **Freshness checks that depend on the pipeline's own reporting** — if the pipeline never ran at all, it never reports failure; freshness checks must run independently of the pipeline's own success signal.
- **Observability without an accountable owner per dataset** — an anomaly alert with nowhere clear to route breeds the same "nobody's job" problem as an uncataloged, unowned table.

## ✅ Best Practices Checklist

- [ ] All five pillars (freshness, volume, schema, distribution, lineage) have some form of continuous monitoring
- [ ] Freshness checks run independently of the pipeline's own success/failure signal
- [ ] Baselines are statistical/trailing, not hardcoded thresholds requiring manual retuning
- [ ] Alerts route to the dataset's accountable owner, with lineage/impact context included
- [ ] Repeat alerts for an already-open incident are suppressed
- [ ] Observability coverage is itself tested against known-bad and known-benign scenarios
- [ ] Observability complements, rather than replaces, explicit quality gates at pipeline boundaries

## 📚 Observability vs Quality Gates vs Testing

| Concept | When it runs | Detects |
|---|---|---|
| Quality gate | Inline, at a pipeline boundary, before publish | Predefined, explicit failure conditions the author anticipated |
| Data observability | Continuously, post-publish, across the whole estate | Drift and anomalies nobody wrote an explicit rule for |
| Unit/integration testing | Pre-deploy, in CI | Logic bugs in the transform code itself |

All three are complementary — observability's core value is catching the failure modes that predefined gates and tests, by definition, didn't anticipate. See [data-quality-gates.md](./Data_Quality_Gates_Cheat_Sheet.md#quality-gates-vs-testing-vs-monitoring) for the fuller three-way comparison this builds on.

## 💡 Pro Tips

1. **Run freshness checks independently of pipeline success signals** — a scheduler that silently stopped triggering a DAG produces no failure event on its own.
2. **Use trailing statistical baselines instead of static thresholds** wherever practical — they adapt to growth and seasonality automatically.
3. **Attach lineage/impact to every alert** so triage starts with "what's affected," not just "what metric moved."
4. **Suppress repeat alerts for an already-acknowledged incident** — this is the single biggest lever against alert fatigue.
5. **Route by severity, not everything to the same channel** — batch low-severity anomalies into a digest, reserve paging for genuinely urgent ones.
6. **Test your monitors against both known-bad and known-benign scenarios** — a monitor that fires on every expected seasonal dip gets ignored just as fast as one that never fires at all.
7. **Assign an accountable owner to every monitored dataset** — an anomaly with nowhere to route is as useless as no monitoring at all.
8. **Start with the five pillars on your highest-value datasets**, not an attempt at full-estate coverage on day one.
9. **Treat observability as complementary to quality gates**, not a replacement — gates catch anticipated failures cheaply at the boundary; observability catches everything else.
10. **Revisit and retune baselines periodically** — a 14-day trailing window set up during a slow season will misfire once volume patterns genuinely shift.
