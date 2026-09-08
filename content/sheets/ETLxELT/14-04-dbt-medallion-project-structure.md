# Example 4: Production dbt Project — Medallion Layer Structure

**Pipeline Type: ELT** — dbt is an ELT-native tool by design; sources are already loaded raw before any staging/intermediate/marts transformation begins.

## Scenario & Business Context

A data team's dbt project has grown organically into a tangle of models with unclear dependencies. This example shows a production-grade layer structure (Bronze/Silver/Gold, i.e., staging/intermediate/marts) that scales cleanly as more sources and business domains are added.

## Architecture

```
models/
├── staging/              (Silver — 1:1 with raw sources, cleaned/typed only)
│   ├── stripe/
│   │   ├── stg_stripe__charges.sql
│   │   └── stg_stripe__customers.sql
│   └── postgres/
│       ├── stg_postgres__orders.sql
│       └── stg_postgres__customers.sql
├── intermediate/         (joins + reusable business logic, not final grain)
│   ├── int_customers__unioned.sql
│   └── int_orders__enriched_with_payments.sql
└── marts/                (Gold — business-facing, organized by domain)
    ├── finance/
    │   ├── fact_orders.sql
    │   └── fact_payments.sql
    └── customer/
        ├── dim_customer.sql
        └── customer_ltv.sql
```

## Full Implementation

### 1. Naming convention

- `stg_<source>__<entity>.sql` — staging models, always views, never joined to other sources.
- `int_<entity>__<description>.sql` — intermediate models, ephemeral or view materialized.
- `fact_<entity>.sql` / `dim_<entity>.sql` — marts, table or incremental materialized.

### 2. Staging model (source-specific, no joins)

```sql
-- models/staging/stripe/stg_stripe__charges.sql
{{ config(materialized='view') }}

SELECT
  id                          AS charge_id,
  customer_id,
  amount / 100.0              AS amount_usd,
  status,
  TO_TIMESTAMP(created)       AS created_at_utc
FROM {{ source('stripe', 'charges') }}
```

### 3. Intermediate model (joins, still not final grain)

```sql
-- models/intermediate/int_customers__unioned.sql
{{ config(materialized='ephemeral') }}

SELECT customer_id, email, 'stripe' AS source_system FROM {{ ref('stg_stripe__customers') }}
UNION ALL
SELECT customer_id, email, 'postgres' AS source_system FROM {{ ref('stg_postgres__customers') }}
```

### 4. Mart model (business-facing, final grain)

```sql
-- models/marts/customer/dim_customer.sql
{{ config(materialized='table') }}

SELECT
  customer_id,
  MAX(email)                          AS email,
  ARRAY_AGG(DISTINCT source_system)   AS known_in_systems
FROM {{ ref('int_customers__unioned') }}
GROUP BY customer_id
```

### 5. Project-level configuration (dbt_project.yml)

```yaml
models:
  my_project:
    staging:
      +materialized: view
      +schema: staging
    intermediate:
      +materialized: ephemeral
    marts:
      +materialized: table
      +schema: marts
      finance:
        +tags: ['finance']
      customer:
        +tags: ['customer']
```

### 6. Documentation & testing per layer

```yaml
# models/staging/stripe/_stripe__models.yml
version: 2
models:
  - name: stg_stripe__charges
    description: "One row per Stripe charge, cleaned and typed."
    columns:
      - name: charge_id
        tests: [unique, not_null]
```

## Design Rationale

- **Staging models never join across sources** — this keeps each staging model a stable, single-responsibility contract; a schema change in one source only requires updating one staging model (see file 03 — Data Modeling).
- **Intermediate as ephemeral** — these models exist to keep mart SQL readable but don't need to persist as physical tables, saving storage and avoiding "half-finished" tables analysts might mistakenly query directly.
- **Marts organized by business domain**, not by source system — this mirrors how Kimball-style dimensional modeling organizes fact tables per business process (see file 08).
- **Tags per domain** enable selective `dbt run --select tag:finance` runs, useful for domain-scoped deployment schedules or ownership boundaries (a lightweight step toward Data Mesh domain ownership, see file 08).

## Production Considerations

- Keep a **strict one-way dependency flow**: staging → intermediate → marts. Marts should never be referenced by staging or intermediate models (avoids circular logical dependencies).
- Use `dbt docs generate` regularly and treat the generated lineage graph as a living architecture diagram, not just documentation.
- As the project grows, split into **multiple dbt projects** connected via `dbt Mesh` / cross-project `ref()` if different teams own different domains independently.

## How to Extend This Example

- Add a `models/marts/marketing/` domain alongside finance/customer as new business needs arise, without touching existing domains.
- Introduce **exposures** (`exposures.yml`) to formally document which BI dashboards depend on which marts, making impact analysis before schema changes straightforward (ties to file 10 — Lineage).
- Add **unit tests** (dbt's native unit testing framework) for complex intermediate business logic, not just schema tests on final marts.
