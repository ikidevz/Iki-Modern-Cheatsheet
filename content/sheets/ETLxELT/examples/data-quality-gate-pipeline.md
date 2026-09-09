# Example 5: Data Quality Gate Before Publishing to BI

**Pipeline Type: ELT** — the gate sits after `dbt run`, meaning transformation has already happened in-warehouse post-load; testing validates the transformed output before publishing.

## Scenario & Business Context

A finance team was burned when a broken upstream extraction silently loaded negative revenue values into a dashboard used for a board meeting. The team now requires that no pipeline run can reach the BI layer unless it passes an explicit quality gate.

## Architecture

```
dbt run (build all models)
   │
   ▼
dbt test (schema + custom business-rule tests)
   │
   ├── PASS → publish_to_bi → notify "#data-ready" (Slack)
   └── FAIL → block downstream refresh → page on-call (PagerDuty)
```

## Full Implementation

### 1. Schema + business-rule tests

```yaml
# models/marts/finance/schema.yml
models:
  - name: fact_revenue
    columns:
      - name: order_id
        tests: [unique, not_null]
      - name: amount
        tests:
          - dbt_utils.accepted_range:
              min_value: 0
              inclusive: true
      - name: currency
        tests:
          - accepted_values:
              values: ['USD', 'EUR', 'GBP']
```

### 2. Custom singular test (business rule)

```sql
-- tests/assert_daily_revenue_not_zero.sql
-- Fails if any of the last 3 days has exactly zero revenue (likely a pipeline break, not real business behavior)
SELECT order_date, SUM(amount) AS daily_revenue
FROM {{ ref('fact_revenue') }}
WHERE order_date >= CURRENT_DATE - 3
GROUP BY order_date
HAVING SUM(amount) = 0
```

### 3. Airflow DAG with a hard gate

```python
from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import BranchPythonOperator
from airflow.providers.pagerduty.operators.pagerduty import PagerdutyEventsOperator
from airflow.providers.slack.operators.slack_webhook import SlackWebhookOperator

with DAG("finance_revenue_pipeline", schedule_interval="0 5 * * *", catchup=False) as dag:

    dbt_run = BashOperator(task_id="dbt_run", bash_command="dbt run --select +fact_revenue")

    # dbt test returns non-zero exit code on failure — Airflow marks the task failed automatically
    dbt_test = BashOperator(
        task_id="dbt_test",
        bash_command="dbt test --select +fact_revenue",
    )

    publish_to_bi = BashOperator(
        task_id="publish_to_bi",
        bash_command="trigger_bi_extract.sh fact_revenue",
        trigger_rule="all_success",
    )

    notify_ready = SlackWebhookOperator(
        task_id="notify_ready",
        http_conn_id="slack_webhook",
        message="✅ fact_revenue refreshed and validated. BI dashboards updated.",
        trigger_rule="all_success",
    )

    page_on_call = PagerdutyEventsOperator(
        task_id="page_on_call",
        summary="🚨 finance_revenue_pipeline failed quality gate — BI NOT refreshed.",
        severity="critical",
        trigger_rule="one_failed",
    )

    dbt_run >> dbt_test >> [publish_to_bi, page_on_call]
    publish_to_bi >> notify_ready
```

### 4. Quarantine pattern for partial failures

```sql
-- Instead of failing the whole batch on row-level issues, quarantine bad rows
-- and let good rows through, alerting on quarantine volume.
CREATE TABLE IF NOT EXISTS quarantine.fact_revenue_rejects AS
SELECT * FROM {{ ref('stg_revenue') }} WHERE amount < 0 OR order_id IS NULL;

-- Downstream mart excludes quarantined rows
SELECT * FROM {{ ref('stg_revenue') }}
WHERE order_id NOT IN (SELECT order_id FROM quarantine.fact_revenue_rejects)
```

## Design Rationale

- **Hard gate, not a dashboard warning banner** — the `publish_to_bi` task only runs on `all_success`, meaning bad data physically cannot reach the BI layer, rather than relying on someone noticing a broken dashboard (see file 07 — Testing Frameworks).
- **PagerDuty for gate failures, Slack for success** — severity-appropriate routing avoids alert fatigue while still guaranteeing a human is paged when the board-meeting dashboard is at risk (see file 10 — Logging & Alerting).
- **Custom singular test for zero-revenue days** — schema tests alone (`not_null`, `unique`) wouldn't catch a scenario where the pipeline runs "successfully" but an upstream break causes zero rows — a business-rule test closes that gap.
- **Quarantine over hard-fail** for row-level issues — lets 99% good data through same-day while isolating and alerting on the 1% bad, rather than blocking the entire report over a handful of bad rows.

## Production Considerations

- Track **quarantine table growth over time** — a rising trend indicates a worsening upstream data quality issue that needs root-causing, not just filtering.
- Version-control test thresholds (e.g., "zero revenue for 3 consecutive days") as business context evolves — a threshold tuned for a mature product may be wrong for a fast-growing one.
- Ensure the **PagerDuty alert includes a runbook link** — an on-call engineer at 2 AM needs actionable next steps, not just "pipeline failed."

## How to Extend This Example

- Add **anomaly-based tests** (e.g., dbt-elementary or Monte Carlo) alongside static threshold tests to catch subtler drift than a hard-coded rule would (see file 07 — Anomaly Detection).
- Extend the gate to check **freshness** (`dbt source freshness`) in addition to correctness — a pipeline can pass all tests yet still be running on stale source data.
- Add a **"data ready" API endpoint** that BI tools poll before rendering, rather than relying purely on a Slack notification for humans.
