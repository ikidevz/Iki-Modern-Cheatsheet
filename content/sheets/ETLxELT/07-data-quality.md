# Data Quality & Testing

## Validation Rules

**Definition:** Constraints checked against data to catch errors before they propagate downstream.

**Key Points:**
- Not-null/required fields — reject or flag records missing critical fields.
- Uniqueness — enforce on primary/business keys to catch duplication bugs.
- Referential integrity — foreign keys should resolve to valid parent records.
- Range/format checks — dates within expected bounds, emails match a pattern, enums restricted to known values.

**Example:**
```sql
-- Referential integrity check
SELECT o.order_id FROM orders o
LEFT JOIN customers c ON o.customer_id = c.customer_id
WHERE c.customer_id IS NULL;
```

**When to Use / Trade-offs:**
- Run validation as close to ingestion as possible so bad data is caught before it's used in multiple downstream models.

**Common Pitfalls:**
- Validating only at the final reporting layer — by then, bad data may already be baked into multiple derived tables.

---

## Data Contracts

**Definition:** A formal agreement between data producers and consumers defining schema, semantics, and SLAs for a dataset.

**Key Points:**
- Typically includes field names/types, nullability, update frequency, ownership, and breaking-change notification process.
- Prevents upstream teams from silently changing schemas that break downstream pipelines.

**Example:**
```yaml
dataset: orders
owner: checkout-team
fields:
  order_id: {type: string, nullable: false}
  amount_cents: {type: integer, nullable: false}
update_frequency: "every 15 minutes"
breaking_change_notice: "2 weeks via #data-contracts channel"
```

**When to Use / Trade-offs:**
- Data contracts pay off most in larger organizations where producer and consumer teams are different and communication is otherwise informal/ad hoc.

**Common Pitfalls:**
- Writing a data contract once and never enforcing it with automated schema checks — it becomes documentation nobody follows.

---

## Testing Frameworks & Strategies

**Definition:** Tools and methods for systematically verifying pipeline and data correctness.

**Key Points:**
- dbt tests — built-in (`unique`, `not_null`, `relationships`, `accepted_values`) and custom SQL-based tests.
- Great Expectations — standalone validation framework with expressive "expectations" and generated data docs.
- Unit tests — test individual transformation logic with fixed input/output pairs.
- Regression tests — compare pipeline output against a known-good snapshot after changes.

**Example:**
```yaml
# dbt schema test
models:
  - name: orders
    columns:
      - name: order_id
        tests: [unique, not_null]
      - name: customer_id
        tests:
          - relationships: {to: ref('customers'), field: customer_id}
```

**When to Use / Trade-offs:**
- dbt tests are the fastest path to coverage for warehouse-native SQL transformations.
- Great Expectations suits more complex, cross-system validation needs outside a single dbt project.

**Common Pitfalls:**
- Writing transformation logic without any accompanying tests, relying purely on manual spot-checks to catch regressions.

---

## Anomaly Detection

**Definition:** Automated detection of unexpected shifts in data volume, freshness, or distribution.

**Key Points:**
- Row-count anomalies — sudden spike/drop vs historical average.
- Freshness anomalies — data arriving later than expected.
- Distribution anomalies — a metric's statistical profile shifts unexpectedly (mean, null rate, cardinality).

**Example:**
- A table that normally receives ~50,000 rows/day suddenly receives 500 — an automated check flags this before it reaches a dashboard.

**When to Use / Trade-offs:**
- Threshold-based anomaly checks are simple and effective for stable, predictable pipelines.
- Statistical/ML-based anomaly detection (Monte Carlo, dbt-elementary) is worth it for high-volume, business-critical datasets where manual threshold-tuning doesn't scale.

**Common Pitfalls:**
- Setting static thresholds that don't account for seasonality (e.g., flagging normal weekend traffic drops as anomalies).
