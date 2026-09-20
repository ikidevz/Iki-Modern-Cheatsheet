# Data Warehouse Cheatsheet for Data Engineers

> A structured reference for designing and operating an analytical data warehouse — dimensional modeling, layered architecture (staging/core/mart), partitioning and clustering, governance, and the modern cloud warehouse landscape. Expanded from a short pattern note into a full implementation guide.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 When to Use a Warehouse](#when-to-use-a-warehouse)
4. [🏗️ Layered Architecture](#layered-architecture)
5. [📐 Dimensional Modeling](#dimensional-modeling)
6. [🔀 Star Schema vs Snowflake Schema vs Wide Tables](#star-schema-vs-snowflake-schema-vs-wide-tables)
7. [🧮 Partitioning and Clustering](#partitioning-and-clustering)
8. [🔐 Governance and Access Control](#governance-and-access-control)
9. [🛠️ Tooling Landscape](#tooling-landscape)
10. [📊 Semantic Layer and Metrics](#semantic-layer-and-metrics)
11. [🧾 Handling Late-Arriving and Corrected Facts](#handling-late-arriving-and-corrected-facts)
12. [🏦 Data Vault as an Alternative Core Layer](#data-vault-as-an-alternative-core-layer)
13. [🗃️ Materialized Views vs Tables vs Incremental Models](#materialized-views-vs-tables-vs-incremental-models)
14. [💰 Cost and Performance Tuning](#cost-and-performance-tuning)
15. [🛍️ End-to-End Example Schema: E-Commerce](#end-to-end-example-schema-e-commerce)
16. [🧪 Testing a Warehouse's Data Models](#testing-a-warehouses-data-models)
17. [⚠️ Common Gotchas](#common-gotchas)
18. [✅ Best Practices Checklist](#best-practices-checklist)
19. [📚 Warehouse vs Lakehouse vs Lake](#warehouse-vs-lakehouse-vs-lake)
20. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| Core pattern | `source systems -> extract/validate -> modeled warehouse -> BI/analytics` |
| Modeling style | Dimensional (star schema): fact tables + dimension tables |
| Layers | Staging (raw, 1:1 with source) → Core/Warehouse (modeled) → Mart (consumption-ready) |
| Partitioning | By date/event-time for large fact tables |
| Governance | Row/column-level access control, audited queries |
| Common tools | Snowflake, BigQuery, Redshift, dbt for transformation |

## 🧠 Core Concept

A data warehouse stores **structured, governed data optimized for analytical SQL** — reporting, BI dashboards, and ad hoc analysis — rather than for transactional (OLTP) workloads. It trades write flexibility and row-level transactional speed for read performance at scale, stable schemas, and strong governance.

```text
source systems -> extract and validate -> modeled warehouse tables -> BI and analytics
```

The warehouse's job is to answer "what happened" reliably and fast for many concurrent analytical queries, using a schema that's been deliberately designed for that purpose — not simply mirroring the source system's transactional schema.

## 🎯 When to Use a Warehouse

**Use a warehouse when:**
- Consumers need stable schemas and repeatable, trustworthy metrics ("what is *the* definition of revenue?").
- Interactive analytical queries (dashboards, ad hoc SQL) matter more than raw ingestion speed.
- Governance, access control, and auditing of who-queried-what are organizational requirements.

**Consider alternatives when:**
- You need to serve ML training on raw/semi-structured data alongside analytics — a lakehouse avoids duplicating the same data into two systems.
- Ingestion volume and format diversity are so high that upfront modeling would create a bottleneck before any exploration can happen — land raw data in a lake first, model into the warehouse afterward.

## 🏗️ Layered Architecture

```text
staging.orders        (raw, 1:1 with source, minimal transformation)
    │
    ▼
core.fct_orders        (modeled: conformed keys, business logic applied, tested)
core.dim_customer
    │
    ▼
mart.exec_revenue_summary   (consumption-ready, denormalized for a specific audience)
```

```sql
-- Staging: light cleaning, no business logic
CREATE OR REPLACE TABLE staging.orders AS
SELECT
    CAST(order_id AS STRING) AS order_id,
    CAST(customer_id AS STRING) AS customer_id,
    CAST(amount AS DECIMAL(10,2)) AS amount,
    CAST(created_at AS TIMESTAMP) AS created_at
FROM raw.orders_extract;

-- Core: business logic, joins, conformed dimensions
CREATE OR REPLACE TABLE core.fct_orders AS
SELECT
    o.order_id,
    c.customer_key,
    o.amount,
    DATE(o.created_at) AS order_date
FROM staging.orders o
JOIN core.dim_customer c ON o.customer_id = c.customer_id;

-- Mart: denormalized, audience-specific
CREATE OR REPLACE TABLE mart.exec_revenue_summary AS
SELECT order_date, SUM(amount) AS revenue, COUNT(DISTINCT customer_key) AS customers
FROM core.fct_orders
GROUP BY order_date;
```

Keeping these layers distinct means business logic lives in exactly one place (core), and marts stay simple, disposable, and audience-specific.

## 📐 Dimensional Modeling

```text
                dim_customer
                     │
dim_date ── fct_orders ── dim_product
                     │
                dim_geography
```

```sql
-- Fact table: numeric measures at a specific grain, foreign keys to dimensions
CREATE TABLE core.fct_orders (
    order_id      STRING,
    customer_key  INT REFERENCES dim_customer(customer_key),
    product_key   INT REFERENCES dim_product(product_key),
    date_key      INT REFERENCES dim_date(date_key),
    quantity      INT,
    amount        DECIMAL(10,2)
);

-- Dimension table: descriptive attributes, slowly changing over time
CREATE TABLE core.dim_customer (
    customer_key   INT PRIMARY KEY,   -- surrogate key
    customer_id    STRING,            -- natural/business key
    segment        STRING,
    region         STRING,
    valid_from     DATE,
    valid_to       DATE,
    is_current     BOOLEAN
);
```

**Grain first, always.** Before adding a single column, decide the fact table's grain ("one row per order line item" vs "one row per order") — getting this wrong forces a full rebuild later. See [slowly-changing-dimensions.md](./Slowly_Changing_Dimensions_Cheat_Sheet.md) for how dimension history is tracked.

## 🔀 Star Schema vs Snowflake Schema vs Wide Tables

| Style | Structure | Trade-off |
|---|---|---|
| Star schema | Fact table + directly-joined, denormalized dimensions | Simple joins, fast, some redundancy in dimensions |
| Snowflake schema | Dimensions further normalized into sub-dimensions | Less redundancy, more joins, more complex queries |
| Wide/One Big Table (OBT) | Facts and dimension attributes pre-joined into one table | Fastest reads, no joins, but larger storage and harder to maintain conformity |

Modern column-store warehouses often favor **star schema or OBT** — storage is cheap and join elimination/pruning is good, so the normalization benefits of snowflaking matter less than query simplicity.

## 🧮 Partitioning and Clustering

```sql
-- BigQuery: partition by date, cluster by frequently-filtered columns
CREATE TABLE core.fct_orders
PARTITION BY order_date
CLUSTER BY customer_key, region
AS SELECT * FROM staging.orders;

-- Snowflake: micro-partitioning is automatic, but clustering keys can be declared for very large tables
ALTER TABLE core.fct_orders CLUSTER BY (order_date, region);
```

Partition/cluster on the columns your queries filter on most — this is what lets the warehouse skip scanning irrelevant data (partition pruning) instead of paying for a full table scan every query.

## 🔐 Governance and Access Control

```sql
-- Row-level security: restrict which rows a role can see
CREATE ROW ACCESS POLICY region_policy AS (region STRING) RETURNS BOOLEAN ->
    CURRENT_ROLE() = 'GLOBAL_ANALYST' OR region = CURRENT_USER_REGION();

ALTER TABLE core.fct_orders ADD ROW ACCESS POLICY region_policy ON (region);

-- Column-level masking for sensitive fields
CREATE MASKING POLICY email_mask AS (val STRING) RETURNS STRING ->
    CASE WHEN CURRENT_ROLE() IN ('PII_VIEWER') THEN val ELSE '***MASKED***' END;

ALTER TABLE core.dim_customer MODIFY COLUMN email SET MASKING POLICY email_mask;
```

Audit query history (who ran what, against which tables) as a first-class governance requirement, not an afterthought bolted on after an incident.

## 🛠️ Tooling Landscape

| Category | Tools |
|---|---|
| Cloud warehouses | Snowflake, BigQuery, Redshift, Databricks SQL |
| Transformation | dbt, SQL-based orchestrated transforms |
| Ingestion | Fivetran, Airbyte, custom extract jobs, CDC pipelines |
| BI/semantic layer | Looker (LookML), dbt Semantic Layer, Cube |

## 📊 Semantic Layer and Metrics

```yaml
# Example metric definition (semantic layer style)
metrics:
  - name: revenue
    type: sum
    sql: amount
    table: core.fct_orders
    filters: [status = 'completed']
```

A semantic layer defines metrics **once**, centrally, so "revenue" means the same thing in every dashboard — instead of every analyst re-deriving a slightly different `SUM(amount)` with slightly different filters.

## 🧾 Handling Late-Arriving and Corrected Facts

Facts aren't always immutable the moment they land — refunds, chargebacks, and corrections arrive after the original fact, and the warehouse needs a deliberate pattern for reconciling them.

```sql
-- Pattern 1: append correction rows, net them at query time (preserves full audit trail)
CREATE TABLE core.fct_orders (
    order_id STRING, amount DECIMAL(10,2), record_type STRING, -- 'original' | 'correction' | 'refund'
    created_at TIMESTAMP
);

SELECT order_id, SUM(amount) AS net_amount   -- corrections/refunds are negative amounts
FROM core.fct_orders
GROUP BY order_id;

-- Pattern 2: upsert the fact in place when only the latest state matters (loses audit trail)
MERGE INTO core.fct_orders AS target
USING staging.order_corrections AS source
ON target.order_id = source.order_id
WHEN MATCHED THEN UPDATE SET amount = source.corrected_amount
WHEN NOT MATCHED THEN INSERT (order_id, amount) VALUES (source.order_id, source.corrected_amount);
```

| Pattern | Preserves audit trail | Query complexity | Use when |
|---|---|---|---|
| Append correction rows | Yes | Higher (must net at query time) | Finance/compliance needs a full history of every adjustment |
| Upsert in place | No | Lower | Only the current, correct value matters for reporting |

## 🏦 Data Vault as an Alternative Core Layer

For environments needing very high auditability and resilience to frequent source-system changes, **Data Vault** modeling separates the core layer into hubs (business keys), links (relationships), and satellites (attributes/history) — trading query simplicity for maximum flexibility and traceability.

```sql
-- Hub: just the business key and metadata, nothing else — extremely stable over time
CREATE TABLE vault.hub_customer (
    customer_hash_key STRING PRIMARY KEY,   -- hash of the business key
    customer_id STRING,                     -- natural business key
    load_date TIMESTAMP,
    record_source STRING
);

-- Link: records a relationship between two hubs
CREATE TABLE vault.link_customer_order (
    link_hash_key STRING PRIMARY KEY,
    customer_hash_key STRING REFERENCES vault.hub_customer(customer_hash_key),
    order_hash_key STRING,
    load_date TIMESTAMP
);

-- Satellite: descriptive attributes, versioned over time (naturally supports Type 2 history)
CREATE TABLE vault.sat_customer_details (
    customer_hash_key STRING REFERENCES vault.hub_customer(customer_hash_key),
    segment STRING, region STRING,
    load_date TIMESTAMP,
    hash_diff STRING   -- hash of all attribute values, used to detect if a new satellite row is needed
);
```

| Dimension | Dimensional (star schema) | Data Vault |
|---|---|---|
| Query simplicity | High — BI-tool friendly | Lower — usually needs a dimensional layer built on top for consumption |
| Resilience to source changes | Moderate | High — hubs are extremely stable, satellites absorb change |
| Auditability | Good with Type 2 dimensions | Excellent — every load is preserved by design |
| Typical use | Most organizations, BI-first | Highly regulated, many volatile source systems, enterprise-scale |

Most teams layer a dimensional (star schema) mart **on top of** a Data Vault core, giving BI tools the simple star schema they expect while retaining the vault's raw auditability underneath.

## 🗃️ Materialized Views vs Tables vs Incremental Models

```sql
-- Materialized view: auto-refreshed by the warehouse, good for moderately-expensive aggregates
CREATE MATERIALIZED VIEW mart.daily_revenue_mv AS
SELECT order_date, SUM(amount) AS revenue
FROM core.fct_orders
GROUP BY order_date;
-- Snowflake/BigQuery refresh this incrementally and automatically on underlying data changes

-- Plain table via scheduled job: full control over refresh timing and logic, more operational overhead
CREATE OR REPLACE TABLE mart.daily_revenue AS
SELECT order_date, SUM(amount) AS revenue FROM core.fct_orders GROUP BY order_date;
```

```sql
-- dbt incremental model: explicit, version-controlled, testable — the common middle ground
{{ config(materialized='incremental', unique_key='order_date') }}
SELECT order_date, SUM(amount) AS revenue
FROM {{ ref('fct_orders') }}
{% if is_incremental() %}
WHERE order_date > (SELECT MAX(order_date) FROM {{ this }})
{% endif %}
GROUP BY order_date
```

| Approach | Refresh control | Version control | Best for |
|---|---|---|---|
| Materialized view | Automatic (warehouse-managed) | Limited (DDL only) | Simple aggregates, low-maintenance freshness |
| Plain table + scheduled job | Full manual control | Full (if defined in dbt/SQL files) | Complex logic needing custom refresh timing |
| dbt incremental model | Full, code-defined | Full, with tests and docs | Most production warehouse transforms |

## 💰 Cost and Performance Tuning

```sql
-- Snowflake: use result caching and appropriately-sized warehouses instead of always running "large"
ALTER WAREHOUSE analytics_wh SET WAREHOUSE_SIZE = 'MEDIUM' AUTO_SUSPEND = 60;

-- BigQuery: use clustering + partition filters to avoid billing for full scans
SELECT * FROM core.fct_orders
WHERE order_date = '2026-09-17'    -- partition filter required to avoid scanning the whole table
  AND customer_key = 12345;        -- cluster column narrows further within the partition

-- Identify your most expensive recurring queries and cache/materialize them
SELECT query_text, total_elapsed_time, credits_used
FROM snowflake.account_usage.query_history
ORDER BY credits_used DESC
LIMIT 20;
```

| Lever | Mechanism |
|---|---|
| Right-sized compute | Auto-suspend idle warehouses; scale up only for genuinely large workloads |
| Partition/cluster pruning | Avoid full scans by filtering on partition/cluster columns |
| Materializing expensive aggregates | Pay the compute cost once, not on every dashboard refresh |
| Query history review | Find and optimize (or cache) the handful of queries driving most of the cost |

## 🛍️ End-to-End Example Schema: E-Commerce

```sql
-- Dimensions
CREATE TABLE core.dim_customer (customer_key INT PRIMARY KEY, customer_id STRING, segment STRING, region STRING, valid_from DATE, valid_to DATE, is_current BOOLEAN);
CREATE TABLE core.dim_product (product_key INT PRIMARY KEY, sku STRING, category STRING, brand STRING);
CREATE TABLE core.dim_date (date_key INT PRIMARY KEY, full_date DATE, day_of_week STRING, is_holiday BOOLEAN, fiscal_quarter STRING);

-- Fact at "one row per order line item" grain
CREATE TABLE core.fct_order_lines (
    order_id STRING, line_number INT,
    customer_key INT REFERENCES core.dim_customer(customer_key),
    product_key INT REFERENCES core.dim_product(product_key),
    date_key INT REFERENCES core.dim_date(date_key),
    quantity INT, unit_price DECIMAL(10,2), line_amount DECIMAL(10,2)
);

-- Mart aggregating up to daily category revenue for an executive dashboard
CREATE OR REPLACE TABLE mart.daily_category_revenue AS
SELECT d.full_date, p.category, SUM(f.line_amount) AS revenue, COUNT(DISTINCT f.order_id) AS orders
FROM core.fct_order_lines f
JOIN core.dim_date d ON f.date_key = d.date_key
JOIN core.dim_product p ON f.product_key = p.product_key
GROUP BY d.full_date, p.category;
```

Notice the fact table's grain is explicit in its name (`fct_order_lines`, one row per line item) — a downstream analyst summing `quantity` without grouping by `order_id` first would silently double-count if they mistook the grain for "one row per order."

## 🧪 Testing a Warehouse's Data Models

```sql
-- dbt schema tests (schema.yml) — the most common way to test warehouse models
-- models:
--   - name: fct_order_lines
--     columns:
--       - name: order_id
--         tests: [not_null]
--       - name: customer_key
--         tests:
--           - relationships:
--               to: ref('dim_customer')
--               field: customer_key
```

```python
def test_mart_reconciles_with_core():
    core_total = query("SELECT SUM(line_amount) FROM core.fct_order_lines")
    mart_total = query("SELECT SUM(revenue) FROM mart.daily_category_revenue")
    assert abs(core_total - mart_total) < 0.01   # marts must reconcile to the core layer they're derived from

def test_no_orphaned_fact_rows():
    orphans = query("""
        SELECT COUNT(*) FROM core.fct_order_lines f
        LEFT JOIN core.dim_customer c ON f.customer_key = c.customer_key
        WHERE c.customer_key IS NULL
    """)
    assert orphans == 0
```

## ⚠️ Common Gotchas

- **Skipping the staging layer** and modeling directly from raw source data couples business logic to source system quirks, making refactors painful.
- **No conformed dimensions** — two marts computing "customer segment" differently produces numbers that don't reconcile, eroding trust in the whole warehouse.
- **Schema changes without coordination** break every downstream mart and dashboard silently until someone notices numbers look wrong.
- **Over-normalizing (snowflaking) when it's not needed** adds join complexity most BI users and tools handle poorly.
- **Ignoring partition pruning** — a warehouse table partitioned by date that's queried without a date filter still scans everything, at full cost.
- **Treating marts as permanent** — marts should be cheap, disposable, and audience-specific; if a "mart" becomes load-bearing infrastructure for many teams, promote its logic into core.
- **Upserting corrections in place when audit history is legally required** — always confirm whether finance/compliance needs the full correction trail before choosing the simpler upsert pattern.
- **Running warehouses oversized "just in case"** — auto-suspend and right-sizing are usually the single biggest lever on cloud warehouse spend.
- **Full table scans hiding behind a missing partition filter** — a query that "usually" filters by date but has one code path that doesn't will occasionally scan (and bill for) the entire table.
- **A mart that silently disagrees with its own core layer** — without a reconciliation test, drift between mart and core logic goes unnoticed until someone manually checks the numbers.

## ✅ Best Practices Checklist

- [ ] Staging, core, and mart layers are kept distinct, with business logic living only in core
- [ ] Fact table grain is decided and documented before columns are added
- [ ] Dimensions are conformed (shared) across fact tables, not redefined per mart
- [ ] Large fact tables are partitioned/clustered on commonly filtered columns
- [ ] Row/column-level security is applied where sensitive data exists
- [ ] Metrics are defined once in a semantic layer, not re-derived per dashboard
- [ ] Query history/audit logging is enabled for governance and cost review

## 📚 Warehouse vs Lakehouse vs Lake

| Dimension | Data Warehouse | Lakehouse | Data Lake |
|---|---|---|---|
| Schema | Enforced, modeled upfront | Enforced, flexible evolution | Schema-on-read, often unmodeled |
| Best for | Governed BI/reporting | Unified analytics + ML | Cheap raw storage, exploration |
| Query performance | Highest for structured SQL | High, engine-dependent | Lower without curation |
| Governance maturity | High, built-in | Growing, catalog-dependent | Typically weakest by default |

See [data-lakehouse.md](./Data_Lakehouse_Cheat_Sheet.md) for the lakehouse side of this comparison in depth.

## 💡 Pro Tips

1. **Decide fact table grain before anything else** — it's the hardest thing to change later.
2. **Keep business logic in exactly one layer (core)** — staging stays dumb, marts stay thin.
3. **Conform dimensions across fact tables** so metrics reconcile organization-wide.
4. **Partition/cluster on your actual query filters**, not on what seems structurally tidy.
5. **Define metrics once in a semantic layer** — stop letting every dashboard reinvent "revenue."
6. **Version-control your warehouse SQL** (dbt models) so schema changes are reviewed, not ad hoc.
7. **Apply row/column security at the table level**, not by hoping every downstream tool respects a convention.
8. **Audit query history** — it's both a security control and a cost/performance diagnostic tool.
9. **Treat marts as disposable** — if a mart becomes critical shared infrastructure, promote its logic upstream into core.
10. **Reconcile warehouse totals against source system totals periodically** — it's the cheapest trust-building exercise available.
11. **Decide the correction/refund pattern (append vs upsert) explicitly**, based on whether audit history is a real requirement, not a coin flip.
12. **Consider Data Vault only when source-system volatility and auditability genuinely demand it** — for most teams, a well-run star schema is simpler and sufficient.
13. **Match materialization strategy to the workload**: materialized views for simple auto-refreshed aggregates, dbt incremental models for anything with real transform logic.
14. **Review query cost history regularly** and materialize or cache the handful of queries driving most of the spend.
15. **Add reconciliation tests between mart and core layers** to CI so drift is caught automatically, not by an analyst noticing odd numbers weeks later.

