# Example 1: Batch ELT Pipeline — E-Commerce Orders

**Pipeline Type: ELT** — raw data lands in Snowflake untransformed (Fivetran), all cleaning/modeling happens after load, inside the warehouse via dbt.

## Scenario & Business Context

A mid-size e-commerce company needs nightly-refreshed orders and customer data in Snowflake for BI reporting (revenue dashboards, customer segmentation). Source is a production Postgres database that must not be queried directly by analysts. Reporting needs to correctly reflect a customer's attributes (region, segment) *as of the time of each order*, not just their current values.

## Architecture

```
Postgres (OLTP)
   │  incremental extract (updated_at watermark)
   ▼
Fivetran Connector
   │  load raw, no transformation
   ▼
Snowflake raw.orders / raw.customers          (Bronze)
   │  dbt staging models (clean, type, dedupe)
   ▼
Snowflake staging.stg_orders / stg_customers  (Silver)
   │  dbt mart models
   ▼
Snowflake marts.dim_customer (SCD2) / marts.fact_orders   (Gold)
   │
   ▼
BI Dashboard (Looker / Tableau)

Orchestrated by: Airflow
```

## Full Implementation

### 1. Extraction config (Fivetran)
- Connector: Postgres → Snowflake, sync mode: incremental, cursor column `updated_at`.
- Sync frequency: every night at 01:00 UTC (2 hours before the dbt run window, to allow buffer for sync delays).

### 2. Staging layer (dbt)

```sql
-- models/staging/stg_orders.sql
{{ config(materialized='view') }}

SELECT
  order_id,
  TRIM(customer_id)                                AS customer_id,
  CAST(amount_cents AS DECIMAL(12,2)) / 100         AS amount,
  status,
  CONVERT_TIMEZONE('UTC', created_at)               AS created_at_utc,
  CONVERT_TIMEZONE('UTC', updated_at)               AS updated_at_utc
FROM {{ source('raw', 'orders') }}
QUALIFY ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY updated_at DESC) = 1
```

```sql
-- models/staging/stg_customers.sql
{{ config(materialized='view') }}

SELECT
  customer_id,
  TRIM(LOWER(email))       AS email,
  region,
  segment,
  CONVERT_TIMEZONE('UTC', updated_at) AS updated_at_utc
FROM {{ source('raw', 'customers') }}
QUALIFY ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY updated_at DESC) = 1
```

### 3. Dimension table — SCD Type 2 (dbt snapshot)

```sql
-- snapshots/dim_customer_snapshot.sql
{% snapshot dim_customer_snapshot %}
{{
  config(
    target_schema='marts',
    unique_key='customer_id',
    strategy='timestamp',
    updated_at='updated_at_utc',
  )
}}
SELECT * FROM {{ ref('stg_customers') }}
{% endsnapshot %}
```

dbt's native snapshot feature implements SCD Type 2 automatically — it adds `dbt_valid_from` / `dbt_valid_to` columns, closing out old rows and inserting new ones on change.

### 4. Fact table

```sql
-- models/marts/fact_orders.sql
{{ config(materialized='incremental', unique_key='order_id') }}

SELECT
  o.order_id,
  o.customer_id,
  o.amount,
  o.status,
  o.created_at_utc,
  c.region        AS customer_region_at_order_time,
  c.segment       AS customer_segment_at_order_time
FROM {{ ref('stg_orders') }} o
LEFT JOIN {{ ref('dim_customer_snapshot') }} c
  ON o.customer_id = c.customer_id
  AND o.created_at_utc BETWEEN c.dbt_valid_from AND COALESCE(c.dbt_valid_to, '9999-12-31')
{% if is_incremental() %}
WHERE o.updated_at_utc > (SELECT MAX(created_at_utc) FROM {{ this }})
{% endif %}
```

### 5. Tests

```yaml
# models/marts/schema.yml
models:
  - name: fact_orders
    columns:
      - name: order_id
        tests: [unique, not_null]
      - name: customer_id
        tests:
          - relationships:
              to: ref('dim_customer_snapshot')
              field: customer_id
      - name: amount
        tests:
          - dbt_utils.accepted_range:
              min_value: 0
```

### 6. Orchestration (Airflow)

```python
from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.providers.fivetran.operators.fivetran import FivetranOperator
from airflow.providers.slack.operators.slack_webhook import SlackWebhookOperator
from datetime import datetime, timedelta

default_args = {
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "retry_exponential_backoff": True,
}

with DAG(
    "ecommerce_orders_elt",
    schedule_interval="0 3 * * *",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    default_args=default_args,
) as dag:

    sync_orders = FivetranOperator(task_id="sync_orders", connector_id="orders_connector")
    sync_customers = FivetranOperator(task_id="sync_customers", connector_id="customers_connector")

    dbt_snapshot = BashOperator(
        task_id="dbt_snapshot",
        bash_command="dbt snapshot --select dim_customer_snapshot",
    )
    dbt_run = BashOperator(
        task_id="dbt_run",
        bash_command="dbt run --select +fact_orders",
    )
    dbt_test = BashOperator(
        task_id="dbt_test",
        bash_command="dbt test --select +fact_orders",
    )
    alert_on_failure = SlackWebhookOperator(
        task_id="alert_on_failure",
        http_conn_id="slack_webhook",
        message="🚨 ecommerce_orders_elt failed — check Airflow logs.",
        trigger_rule="one_failed",
    )

    [sync_orders, sync_customers] >> dbt_snapshot >> dbt_run >> dbt_test >> alert_on_failure
```

## Design Rationale

- **ELT, not ETL** — raw data lands untransformed, preserving reprocessing ability without re-hitting Postgres.
- **dbt snapshots for SCD2** — avoids hand-rolled `MERGE` logic; dbt manages `dbt_valid_from`/`dbt_valid_to` natively.
- **Point-in-time join** in `fact_orders` — attributes each order to the customer's region/segment *at order time*, not current values, so historical reports don't silently rewrite themselves when a customer moves regions.
- **Retries + exponential backoff** on Airflow tasks absorb transient Fivetran/Snowflake hiccups without manual intervention.
- **Test gate before alerting** — `dbt_test` runs before the DAG is considered complete; failures trigger Slack alerts rather than silently corrupting downstream dashboards.

## Production Considerations

- Set a **Fivetran sync SLA sensor** before `dbt_snapshot` if sync duration is variable, rather than a fixed schedule offset.
- Monitor **snapshot table growth** — SCD2 tables grow indefinitely; consider archiving old `dbt_valid_to` rows older than N years to a cold storage table.
- Add a **freshness check** (`dbt source freshness`) on `raw.orders` to detect if Fivetran silently stopped syncing.

## How to Extend This Example

- Add a `dim_product` and extend `fact_orders` to a full star schema with product-level detail.
- Swap Fivetran for Airbyte self-hosted if data volume growth makes per-row pricing costly.
- Add a **data contract** (see file 07) formalizing the `orders`/`customers` schema with the source team.
- Introduce **anomaly detection** on daily order volume (see file 07) to catch upstream extraction failures faster than a manual dashboard check would.
