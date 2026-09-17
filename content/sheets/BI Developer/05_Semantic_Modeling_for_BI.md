# 🧩 Semantic Modeling for BI — BI Developer Cheatsheet (Deep Dive)

## Table of Contents
1. [What & Why](#1-what--why)
2. [Core Concepts](#2-core-concepts)
3. [Star Schema Example](#3-star-schema-example)
4. [Slowly Changing Dimensions (SCD) — With SQL](#4-slowly-changing-dimensions-scd--with-sql)
5. [Other Dimension Patterns](#5-other-dimension-patterns)
6. [Fact Table Types](#6-fact-table-types)
7. [Semantic Layer Tools — With Examples](#7-semantic-layer-tools--with-examples)
8. [Metric Governance Workflow](#8-metric-governance-workflow)
9. [Best Practices](#9-best-practices)
10. [Worked Example: Designing a Semantic Model for Subscription Revenue](#10-worked-example-designing-a-semantic-model-for-subscription-revenue)

---

## 1. What & Why

A **semantic layer** sits between raw data and reporting tools, providing a **single, consistent business definition** of metrics, dimensions, and relationships — so "Revenue" means the same thing in every report, regardless of who builds it.

Without a semantic layer, it's common for three different teams to define "Active Customer" three different ways (e.g., logged in last 30 days vs. made a purchase last 90 days vs. has an active subscription) — leading to conflicting numbers in board meetings. The semantic layer's job is to make "Active Customer" a governed, reusable definition computed the same way everywhere.

---

## 2. Core Concepts

| Concept | Definition |
|---|---|
| **Grain** | The level of detail of a single row in a fact table (e.g., one row = one order line) |
| **Fact Table** | Quantitative, transactional data (measures) at a defined grain |
| **Dimension Table** | Descriptive attributes used to filter/group facts (who, what, where, when) |
| **Conformed Dimension** | A dimension shared consistently across multiple fact tables/subject areas |
| **Metric/Measure Definition** | A governed, reusable calculation (e.g., "Net Revenue = Gross Revenue − Returns − Discounts") |
| **Surrogate Key** | System-generated integer key used for joins instead of the natural/business key |
| **Degenerate Dimension** | A dimension attribute (like an Order Number) stored directly in the fact table with no separate dimension table |

---

## 3. Star Schema Example

```
        DimDate        DimCustomer
            \             /
             \           /
            FactSales (grain: 1 row per order line)
             /           \
            /             \
       DimProduct        DimRegion
```

### Why Not Just Query the Raw Normalized Tables Directly?
A normalized OLTP schema might have 15+ tables to answer "total sales by region last quarter." A star schema **pre-joins and denormalizes** these into a handful of wide dimension tables, so BI tools only need simple joins — dramatically faster and easier for report authors to navigate.

---

## 4. Slowly Changing Dimensions (SCD) — With SQL

| Type | Behavior | Use Case |
|---|---|---|
| **Type 0** | Never changes | Birthdate |
| **Type 1** | Overwrite old value | Fix a typo, no history needed |
| **Type 2** | New row per change + effective dates + current flag | Track historical attribute changes (e.g., customer address history) |
| **Type 3** | Add a new column for previous value | Limited history (only last value) |

### SCD Type 2 Table Structure
```sql
CREATE TABLE dim_customer (
    customer_key      INT PRIMARY KEY,     -- surrogate key
    customer_id        VARCHAR(20),         -- natural/business key
    customer_name       VARCHAR(255),
    region              VARCHAR(50),
    effective_start_date DATE,
    effective_end_date   DATE,
    is_current           BOOLEAN
);
```

### SCD Type 2 Merge Logic (Simplified SQL)
```sql
-- Step 1: expire the old record if the region has changed
UPDATE dim_customer
SET effective_end_date = CURRENT_DATE - 1,
    is_current = FALSE
WHERE customer_id = :incoming_customer_id
  AND is_current = TRUE
  AND region <> :incoming_region;

-- Step 2: insert the new current record
INSERT INTO dim_customer (customer_key, customer_id, customer_name, region,
                           effective_start_date, effective_end_date, is_current)
VALUES (nextval('customer_key_seq'), :incoming_customer_id, :incoming_customer_name,
        :incoming_region, CURRENT_DATE, NULL, TRUE);
```
In modern stacks, this pattern is usually handled by **dbt snapshots**:
```yaml
# snapshots/dim_customer_snapshot.yml
snapshots:
  - name: dim_customer_snapshot
    relation: source('crm', 'customers')
    config:
      unique_key: customer_id
      strategy: timestamp
      updated_at: updated_at
```

### Why This Matters for BI
If a customer moves from "EMEA" to "APAC" region, a **Type 1** update would rewrite all their historical sales as "APAC" — misleading trend analysis. A **Type 2** approach preserves the fact that their sales were correctly attributed to EMEA at the time, which is essential for accurate historical reporting.

---

## 5. Other Dimension Patterns

### Role-Playing Dimensions
The same physical dimension table used multiple times in different roles — e.g., a single `dim_date` table used as "Order Date," "Ship Date," and "Delivery Date" via three separate relationships (or views) in the fact table.
```sql
-- Three separate foreign keys in the fact table, all referencing dim_date
fct_orders (order_date_key, ship_date_key, delivery_date_key, ...)
```
In Power BI, this typically requires creating **inactive relationships** activated per-measure with `USERELATIONSHIP()`:
```dax
Sales by Ship Date = CALCULATE([Total Sales], USERELATIONSHIP(fct_orders[ship_date_key], dim_date[DateKey]))
```

### Degenerate Dimensions
Attributes like `Order Number` or `Invoice Number` that have no additional descriptive attributes of their own — stored directly in the fact table rather than a separate dimension.

### Junk Dimensions
A single dimension table combining several low-cardinality flags/indicators (e.g., `IsGift`, `IsPromo`, `PaymentMethod`) into one table with a surrogate key, reducing the number of tiny dimension tables cluttering the model.

---

## 6. Fact Table Types

| Type | Description | Example |
|---|---|---|
| **Transaction Fact** | One row per business event | One row per order line |
| **Periodic Snapshot Fact** | One row per entity per time period, capturing a state | Daily account balance snapshot |
| **Accumulating Snapshot Fact** | One row per process instance, updated as it moves through stages | One row per order, with columns for each fulfillment milestone date |
| **Factless Fact** | No measures, just records that an event occurred (for counting) | Student attended a class (count of attendance events) |

---

## 7. Semantic Layer Tools — With Examples

| Tool | Approach |
|---|---|
| **Power BI Dataset (Tabular Model)** | Shared, certified datasets consumed by multiple reports |
| **Tableau Published Data Source** | Centralized data source with governed calcs, reused across workbooks |
| **dbt Semantic Layer / MetricFlow** | Metrics-as-code, defined in dbt, queried via multiple BI tools |
| **LookML (Looker)** | Code-based semantic modeling layer |
| **AtScale / Cube.dev** | Universal semantic layer across multiple BI front-ends |

### dbt Semantic Layer (MetricFlow) Example
```yaml
# models/semantic/metrics.yml
semantic_models:
  - name: fct_sales
    model: ref('fct_sales')
    defaults:
      agg_time_dimension: order_date
    entities:
      - name: order_id
        type: primary
      - name: customer
        type: foreign
    dimensions:
      - name: order_date
        type: time
        type_params:
          time_granularity: day
    measures:
      - name: sales_amount
        agg: sum

metrics:
  - name: net_revenue
    type: simple
    type_params:
      measure: sales_amount
    filter: "{{ Dimension('order__order_status') }} != 'returned'"
```
Any BI tool that can query the dbt Semantic Layer (via its API) gets the **same** `net_revenue` definition — no re-implementing the "exclude returns" logic per tool.

### LookML Example
```lookml
measure: total_revenue {
  type: sum
  sql: ${TABLE}.sales_amount ;;
  value_format_name: usd
}

dimension: order_month {
  type: string
  sql: DATE_TRUNC('month', ${order_date}) ;;
}
```

---

## 8. Metric Governance Workflow

A repeatable process for introducing or changing a certified metric:

```
1. Analyst proposes a new metric (e.g., "Net Promoter Score") with a plain-language definition.
2. BI/Data team reviews for consistency with existing definitions and naming conventions.
3. Metric formula implemented ONCE in the semantic layer (dbt metric / PBI measure / LookML measure).
4. Metric documented in the business glossary with owner, formula, and example.
5. Metric published/certified — reports reference the certified metric, not a local re-implementation.
6. Any future change to the formula goes through a change-request/PR review process (versioned in Git),
   since it will silently affect every downstream report using it.
```

### Example Business Glossary Entry
| Metric | Definition | Formula | Owner | Certified Source |
|---|---|---|---|---|
| Net Revenue | Total revenue after returns and discounts | `Gross Revenue - Returns - Discounts` | Finance Analytics | dbt metric `net_revenue` |
| Active Customer | Customer with ≥1 purchase in trailing 90 days | `COUNT(DISTINCT customer_id) WHERE last_order_date >= CURRENT_DATE - 90` | Growth Analytics | Power BI certified dataset "Customer Model" |

---

## 9. Best Practices

- **Single source of truth**: define each metric once; reuse everywhere (avoid "shadow" calculations per report).
- **Consistent naming conventions**: `Fact_`, `Dim_`, clear measure names (avoid ambiguous names like "Total" or "Amount").
- **Business glossary**: document metric definitions in plain language alongside technical formulas.
- **Version control** semantic models (e.g., Tabular Editor + Git for Power BI, dbt + Git for metrics).
- **Certify/endorse** trusted models so users know which dataset to build from.
- Separate **"raw" semantic layer** (facts/dims) from a **"curated" layer** (business-friendly measures/aliases) when complexity grows.
- Design for **conformed dimensions** across subject areas so a "Customer" dimension means the same thing whether used in a Sales fact table or a Support Tickets fact table (enables "drill across" analysis).

---

## 10. Worked Example: Designing a Semantic Model for Subscription Revenue

**Requirement:** Finance needs MRR (Monthly Recurring Revenue), churn rate, and net revenue retention, consistently defined across Power BI and a dbt-powered internal tool.

**Step 1 — Define grain and facts:**
```
fct_subscription_snapshot   -- Periodic Snapshot Fact: 1 row per subscription per month
  (subscription_key, customer_key, month_key, mrr_amount, status)
```

**Step 2 — Define metrics once in dbt Semantic Layer:**
```yaml
metrics:
  - name: mrr
    type: simple
    type_params:
      measure: mrr_amount
    filter: "{{ Dimension('subscription__status') }} = 'active'"

  - name: churned_mrr
    type: simple
    type_params:
      measure: mrr_amount
    filter: "{{ Dimension('subscription__status') }} = 'churned'"

  - name: net_revenue_retention
    type: ratio
    type_params:
      numerator: mrr
      denominator: mrr_prior_month
```

**Step 3 — Power BI consumes the same grain via Import mode from the Gold-layer table, replicating the identical filter logic in DAX** (or connects directly to the dbt Semantic Layer API if available), ensuring MRR calculated in Power BI always matches the number in Finance's dbt-powered tool.

**Step 4 — Certify the Power BI dataset and document the metric in the business glossary**, closing the loop so any new report builder references the certified `MRR` measure instead of writing their own.
