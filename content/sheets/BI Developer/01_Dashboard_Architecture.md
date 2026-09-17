# 📊 Dashboard Architecture — BI Developer Cheatsheet (Deep Dive)

## Table of Contents
1. [The BI Stack (Layered View)](#1-the-bi-stack-layered-view)
2. [Common Architectural Patterns](#2-common-architectural-patterns)
3. [Worked Example: Medallion Architecture End-to-End](#3-worked-example-medallion-architecture-end-to-end)
4. [Dashboard Types](#4-dashboard-types)
5. [Data Connectivity Modes](#5-data-connectivity-modes)
6. [Design Principles](#6-design-principles)
7. [Chart Selection Guide](#7-chart-selection-guide)
8. [Scalability Considerations](#8-scalability-considerations)
9. [Documentation Practices](#9-documentation-practices)
10. [Case Study: Retail Sales Dashboard](#10-case-study-retail-sales-dashboard)
11. [Common Anti-Patterns](#11-common-anti-patterns)

---

## 1. The BI Stack (Layered View)

```
┌─────────────────────────────────────────────────────────┐
│  CONSUMPTION LAYER   — Users, Embedded Apps, Alerts,      │
│                        Mobile, Exports, APIs               │
├─────────────────────────────────────────────────────────┤
│  VISUALIZATION LAYER — Power BI / Tableau / Looker /       │
│                        Qlik reports & dashboards            │
├─────────────────────────────────────────────────────────┤
│  SEMANTIC LAYER      — Data model, measures, KPIs,          │
│                        relationships, RLS/OLS                │
├─────────────────────────────────────────────────────────┤
│  STORAGE LAYER       — Data Warehouse / Lakehouse           │
│                        (Star Schema, Medallion Architecture) │
├─────────────────────────────────────────────────────────┤
│  TRANSFORMATION LAYER— ETL / ELT (dbt, ADF, Fivetran,        │
│                        SSIS, Airflow)                        │
├─────────────────────────────────────────────────────────┤
│  SOURCE LAYER        — OLTP DBs, APIs, Flat Files, SaaS      │
│                        Apps, Streaming Events                │
└─────────────────────────────────────────────────────────┘
```

### Layer Responsibilities in Detail

| Layer | Owns | Should NOT do |
|---|---|---|
| **Source** | Raw transactional data, immutable, system-of-record | Business logic, aggregation |
| **Transformation** | Cleansing, deduping, type casting, joining, business rules (dbt models, stored procs) | Presentation formatting, RLS |
| **Storage** | Conformed star schema / lakehouse tables, historized data (SCD) | Ad hoc calculations that vary per report |
| **Semantic** | Certified measures, relationships, RLS/OLS, naming | Raw ETL logic — should read from storage only |
| **Visualization** | Layout, interactivity, formatting, chart choice | Redefining business logic already in the semantic layer |
| **Consumption** | Access, sharing, alerts, embedding | Data transformation |

**Why this matters:** if a "Total Revenue" calculation is written differently in three individual reports at the visualization layer, you get three different numbers on three dashboards. Push business logic as far down the stack as possible (ideally into the semantic layer or transformation layer) so every consumer inherits the same definition.

---

## 2. Common Architectural Patterns

| Pattern | Description | Best For | Trade-offs |
|---|---|---|---|
| **Kimball (Star Schema)** | Dimensional modeling, facts + dimensions, denormalized for query speed | Most reporting/BI use cases | Some data redundancy; less flexible for deep hierarchical relationships |
| **Inmon (Normalized EDW)** | Fully normalized enterprise warehouse feeding downstream data marts | Enterprise-wide governed data | Slower to query directly; requires data marts on top for BI |
| **Data Vault** | Hubs, Links, Satellites — highly auditable, flexible to change | Regulated industries, agile ingestion, frequently changing sources | Complex, needs a presentation/star-schema layer on top for BI tools |
| **Medallion (Bronze/Silver/Gold)** | Raw → Cleansed → Curated layers in a lakehouse | Modern lakehouse (Databricks, Fabric, Synapse) | Requires lakehouse tooling (Delta/Iceberg); more infra to manage |
| **Data Mesh** | Domain-oriented, decentralized ownership with a shared self-serve platform | Large orgs with many autonomous teams | Governance overhead; requires strong platform team + standards |

---

## 3. Worked Example: Medallion Architecture End-to-End

**Scenario:** An e-commerce company ingesting order data from a transactional Postgres DB and a Shopify API.

```
BRONZE (Raw)
─────────────
raw_orders            -- 1:1 copy of source, append-only, includes _ingested_at, _source_system
raw_shopify_orders     -- landed JSON, minimally parsed

        ↓  (dbt model: stg_orders.sql — cast types, rename columns, dedupe)

SILVER (Cleansed / Conformed)
─────────────
stg_orders             -- deduplicated, typed, standardized column names
stg_customers          -- conformed customer records (merged from both sources)
stg_products           -- conformed product catalog

        ↓  (dbt model: fct_orders.sql, dim_customer.sql — apply business rules, SCD2)

GOLD (Curated / Business-Ready)
─────────────
fct_sales              -- grain: 1 row per order line, with FKs to dimensions
dim_customer           -- SCD Type 2, includes customer_key (surrogate), effective dates
dim_product            -- conformed product dimension
dim_date               -- standard calendar table

        ↓ (Power BI / Tableau semantic layer connects here)

SEMANTIC LAYER
─────────────
PBI Dataset "Sales Model"   -- measures: [Total Sales], [Net Revenue], RLS roles
Tableau Published Data Source "Sales" -- calculated fields, user filters
```

**Example dbt-style SQL for the Silver → Gold transformation (fct_sales):**

```sql
-- models/gold/fct_sales.sql
WITH orders AS (
    SELECT * FROM {{ ref('stg_orders') }}
),
customers AS (
    SELECT customer_key, customer_id FROM {{ ref('dim_customer') }}
    WHERE is_current = TRUE
)
SELECT
    o.order_id,
    o.order_line_id,
    c.customer_key,
    o.product_id,
    o.order_date,
    o.quantity,
    o.unit_price,
    o.quantity * o.unit_price AS sales_amount
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
```

This keeps **grain explicit** (one row per order line), pushes cleansing upstream, and ensures every downstream BI tool queries the same curated `fct_sales` table.

---

## 4. Dashboard Types

| Type | Purpose | Refresh Cadence | Example KPIs | Typical Audience |
|---|---|---|---|---|
| **Strategic** | Executive KPIs, trends, long-term direction | Daily/Weekly/Monthly | Revenue growth %, market share, YoY margin | C-suite, VPs |
| **Analytical** | Exploration, drill-down, root-cause analysis | On-demand / ad hoc | Cohort retention, funnel conversion, variance analysis | Analysts, product/marketing managers |
| **Operational** | Real-time monitoring of day-to-day processes | Minutes / near real-time / streaming | Orders in queue, SLA breaches, system uptime | Ops teams, call center supervisors |

### Design Implications by Type
- **Strategic** → fewer visuals, big numbers, trend sparklines, minimal filters, mobile-friendly.
- **Analytical** → more filters/parameters, drill-through pages, exportable detail tables.
- **Operational** → auto-refresh, alert thresholds/conditional formatting (red/amber/green), large screen/TV-friendly layouts.

---

## 5. Data Connectivity Modes

| Mode | Description | Pros | Cons | Good Fit |
|---|---|---|---|---|
| **Import (Cached)** | Data loaded into in-memory engine | Fast, full DAX/calc support, works offline | Needs scheduled refresh, storage limits (Pro: 1GB, PPU/Premium: larger) | Most standard reporting |
| **DirectQuery / Live** | Queries hit source live | Always fresh, no duplication, handles huge data volumes | Slower interactivity, limited transformations, adds load to source | Real-time ops dashboards, huge fact tables |
| **Composite/Hybrid** | Mix of Import + DirectQuery tables | Balance of speed & freshness (e.g., Import dims + DirectQuery facts) | More complex to design/debug; storage mode conflicts need care | Large fact table + small, frequently-reused dimensions |

### Decision Flow
```
Is data volume small enough to fit in memory AND refresh latency (e.g., hourly) acceptable?
 ├── YES → Import
 └── NO  → Does the source need to reflect changes within seconds/minutes?
            ├── YES → DirectQuery / Live
            └── NO  → Consider Composite: Import for dimensions, DirectQuery for large facts
```

---

## 6. Design Principles

- **Visual hierarchy** — most important KPI top-left (F-pattern reading), size/color to denote importance.
- **Pre-attentive attributes** — use color, size, position to highlight before conscious processing.
- **5-second rule** — a viewer should grasp the main insight within 5 seconds.
- **Consistency** — standard color palette, fonts, and KPI card styles across all dashboards.
- **Minimize chart junk** — avoid 3D charts, excessive gridlines, unnecessary legends.
- **Progressive disclosure** — summary view → drill-through/detail view, not everything on one screen.
- **Accessibility** — colorblind-safe palettes, sufficient contrast (WCAG AA: 4.5:1 text contrast), alt text on images.

### Example Color System (hex codes)
```
Primary:        #2A6FDB   (brand blue — main KPI highlights)
Positive/Good:  #2E9E5B   (green — targets met, growth)
Negative/Bad:   #D64545   (red — below target, decline)
Neutral/Grey:   #8A8F98   (context data, secondary labels)
Background:     #F7F8FA   (light canvas)
```
Keep it to **1 primary + 2 semantic (good/bad) + 1–2 neutrals**. Avoid using more than 5–6 distinct colors on a single page.

### Layout Grid Example
A common 12-column grid for a 1920×1080 dashboard:
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  KPI Card 1 │  KPI Card 2 │  KPI Card 3 │  KPI Card 4 │  ← Row 1: top-line metrics (fixed height ~15%)
├─────────────┴─────────────┴─────────────┴─────────────┤
│              Trend Chart (full width, ~35% height)      │  ← Row 2: primary trend
├───────────────────────────┬─────────────────────────────┤
│   Breakdown by Category    │   Breakdown by Region        │  ← Row 3: supporting detail (~35%)
├───────────────────────────┴─────────────────────────────┤
│                 Detail Table / Drill-through link        │  ← Row 4: detail (~15%)
└───────────────────────────────────────────────────────────┘
```

### Gestalt Principles Applied to Dashboards
| Principle | Application |
|---|---|
| **Proximity** | Group related KPIs together; add whitespace between unrelated sections |
| **Similarity** | Use the same color/shape for the same metric across charts |
| **Enclosure** | Use card backgrounds/borders to visually group a KPI + its trend sparkline |
| **Continuity** | Align chart axes and gridlines across stacked visuals for easy comparison |

---

## 7. Chart Selection Guide

| Business Question | Recommended Chart |
|---|---|
| How did a metric change over time? | Line chart |
| Compare a few categories? | Bar chart (horizontal if labels are long) |
| Compare parts of a whole? | 100% stacked bar (avoid pie unless ≤4 slices) |
| Show correlation between two measures? | Scatter plot |
| Show distribution of a single measure? | Histogram / box plot |
| Show a KPI vs. target? | Bullet chart / KPI card with target indicator |
| Show hierarchical part-to-whole? | Treemap or icicle chart |
| Show geographic distribution? | Filled/choropleth map or symbol map |
| Show flow/funnel between stages? | Funnel chart or Sankey diagram |

---

## 8. Scalability Considerations

- **Incremental refresh** instead of full reloads for large fact tables.
  ```
  Example Power BI incremental refresh policy:
  - RangeStart / RangeEnd parameters filter last 5 years
  - Store rows older than 3 years, refresh only last 10 days
  - Partitions created automatically per month
  ```
- **Aggregation tables** for high-cardinality data (pre-summarized for common queries).
  ```
  agg_sales_daily (date_key, region_key, product_category_key, total_sales, total_qty)
  -- Used automatically by Power BI's "Aggregations" feature when a query
  -- can be answered at this grain instead of hitting the detailed fact table.
  ```
- **Partitioning** by date/region to parallelize processing and enable partition-level refresh.
- **Query folding** — push transformation logic back to the source engine; verify with "View Native Query" in Power Query.
- **Caching layers** (dataset caching, BI engine caching, materialized views in the warehouse).

---

## 9. Documentation Practices

### Example Data Dictionary Entry
| Field Name | Table | Data Type | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|---|---|
| `sales_amount` | fct_sales | Decimal(18,2) | Net sales amount excluding tax | Shopify API | Sales Analytics Team | Internal |
| `customer_email` | dim_customer | Varchar(255) | Customer's registered email | Postgres CRM | Data Governance | Confidential (PII) |

### Example Lineage (textual)
```
Shopify API → raw_shopify_orders (Bronze)
   → stg_orders (Silver, dbt model: stg_orders.sql)
   → fct_sales (Gold, dbt model: fct_sales.sql)
   → Power BI Dataset "Sales Model" (Import, refreshes 6am daily)
   → "Executive Sales Dashboard" (Power BI Service)
```

### README Template (per dashboard)
```markdown
# Dashboard: Executive Sales Overview
- **Purpose:** Track revenue, margin, and growth vs. target for leadership.
- **Audience:** CEO, CFO, VP Sales
- **Refresh Schedule:** Daily at 6:00 AM UTC
- **Data Sources:** fct_sales (Gold layer), dim_customer, dim_date
- **Owner:** BI Team — jane.doe@company.com
- **RLS:** Yes — Region-based (see RLS documentation)
- **Known Limitations:** Returns data lags by 1 day due to source system batch job.
```

---

## 10. Case Study: Retail Sales Dashboard

**Requirement:** VP of Sales wants a dashboard showing revenue trend, top products, regional performance, and YoY comparison, refreshed daily, viewable by regional managers (each seeing only their region).

**Architecture decisions:**
1. **Storage:** Gold-layer `fct_sales` + `dim_product`, `dim_region`, `dim_date` (star schema).
2. **Connectivity:** Import mode — data volume (~5M rows/year) fits comfortably in memory; daily refresh is sufficient freshness.
3. **Security:** Dynamic RLS via `UserRegionMap` table, filtering `dim_region`.
4. **Layout:** KPI row (Total Revenue, YoY %, Avg Order Value, Units Sold) → trend line chart → top 10 products bar chart + regional map side-by-side → drill-through detail page.
5. **Governance:** Dataset certified as "Official Sales Dataset"; published to a dedicated Power BI App; deployment pipeline Dev → Test → Prod.

This flow — **grain-first modeling → right connectivity mode → security baked into the model → layout matched to audience → governed distribution** — is the repeatable pattern for most enterprise dashboards.

---

## 11. Common Anti-Patterns

| Anti-Pattern | Why It Hurts | Fix |
|---|---|---|
| **One giant dashboard with 20+ visuals** | Slow to load, overwhelming, hard to maintain | Split into overview + drill-through detail pages |
| **Business logic duplicated in every report** | Inconsistent numbers across dashboards | Centralize in semantic layer/certified dataset |
| **Using DirectQuery "just in case"** | Slower performance for no real benefit | Default to Import unless a genuine real-time need exists |
| **No date dimension (using date columns directly)** | Time intelligence breaks or requires manual calc | Always build a dedicated `dim_date` table |
| **RLS hidden only via bookmarks/UI tricks** | Not actual security — data is still exposed via export/API | Enforce RLS at the model/data-source level |
| **No documentation/data dictionary** | New team members can't maintain or trust the dashboard | Maintain README + data dictionary per dataset |
| **Pie charts with 8+ slices** | Impossible to compare visually | Use a sorted bar chart instead |
