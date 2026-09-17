# dbt Semantic Layer / MetricFlow Cheatsheet for Analytics Engineers

> A structured reference for defining and querying metrics with dbt's Semantic Layer and MetricFlow — semantic models, metric types, entities/joins, time spines, and querying via CLI, SQL, and the GraphQL/JDBC APIs.

## 📑 Table of Contents

1. [🚀 Setup and Prerequisites](#setup-and-prerequisites)
2. [🧠 Core Concepts](#core-concepts)
3. [🧩 Semantic Models](#semantic-models)
4. [📏 Metric Types](#metric-types)
5. [🔗 Entities & Joins](#entities-joins)
6. [📅 Time Spine & Granularity](#time-spine-granularity)
7. [🎯 Filters](#filters)
8. [💻 MetricFlow CLI](#metricflow-cli)
9. [🌐 Querying the Semantic Layer](#querying-the-semantic-layer)
10. [✅ Validation & Testing](#validation-testing)
11. [📊 BI Tool Integration](#bi-tool-integration)
12. [🛒 Real-World Example: E-Commerce Metric Tree](#real-world-example-e-commerce-metric-tree)
13. [🧮 Advanced Metric Patterns](#advanced-metric-patterns)
14. [🏷️ Metric Metadata & Governance](#metric-metadata-governance)
15. [🖥️ dbt Cloud CLI vs. OSS MetricFlow](#dbt-cloud-cli-vs-oss-metricflow)
16. [🛠️ Troubleshooting Common Errors](#troubleshooting-common-errors)
17. [⚠️ Common Gotchas](#common-gotchas)
18. [🎯 Best Practices](#best-practices)
19. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Task                          | Syntax / Command                                                        |
| ----------------------------- | ------------------------------------------------------------------------ |
| Define a semantic model       | `semantic_models:` block in a `.yml` file under `models/`                |
| Define a metric               | `metrics:` block, referencing a `measure` or another `metric`            |
| List metrics                  | `mf list metrics`                                                        |
| List dimensions for a metric  | `mf list dimensions --metrics revenue`                                   |
| Query from CLI                | `mf query --metrics revenue --group-by metric_time__month`               |
| Validate configs              | `mf validate-configs`                                                    |
| See generated SQL             | `mf query --metrics revenue --group-by metric_time__day --explain`       |
| Query via dbt Cloud API       | GraphQL endpoint or JDBC driver (see [Querying](#querying-the-semantic-layer)) |
| Query via SQL (dbt Cloud)     | `SELECT * FROM {{ semantic_layer.query(metrics=['revenue']) }}` (Jinja-style, tool-dependent) |
| Period-over-period comparison  | `derived` metric with `offset_window` on a repeated metric reference          |
| Compile without running        | `mf query ... --compile-only` / `dbt sl compile`                             |
| dbt Cloud CLI equivalent        | `dbt sl query --metrics revenue --group-by metric_time__month`               |
| List saved queries              | `dbt sl list saved-queries`                                                    |
| Create a metric filter           | `filter:` block on the metric, using `{{ Dimension(...) }}` Jinja syntax       |

**Metric type cheat sheet**

| Metric type  | Use case                                                    |
| ------------ | ------------------------------------------------------------ |
| `simple`     | Direct aggregation of a single measure (sum, count, etc.)     |
| `ratio`      | Numerator measure ÷ denominator measure (e.g. conversion rate)|
| `cumulative` | Running total / rolling window over time                      |
| `derived`    | Arithmetic expression combining other metrics                 |
| `conversion` | Rate of entities that complete a follow-up event within a window |

## 🚀 Setup and Prerequisites

```bash
# Install MetricFlow alongside your dbt adapter
pip install dbt-metricflow

# MetricFlow reads your dbt project's manifest, so you need a compiled project
dbt parse          # generates manifest.json used by MetricFlow
mf tutorial         # optional: spins up a local example project to explore

# Confirm the CLI is talking to your project
mf list metrics
```

Requirements:
- dbt-core ≥ 1.6 (semantic layer syntax stabilized around this version)
- A dbt adapter that supports the Semantic Layer (Snowflake, BigQuery, Databricks, Redshift, Postgres — check current adapter support)
- For hosted querying (not just local `mf query`), a dbt Cloud account with Semantic Layer enabled, or a self-hosted MetricFlow server

## 🧠 Core Concepts

MetricFlow separates **what a metric means** from **how it's computed at query time**. You define the building blocks once; MetricFlow generates the SQL for any requested slice.

```text
Semantic Model  →  wraps a dbt model, declares its measures/dimensions/entities
Measure         →  an aggregation over a column (sum, count, average, etc.)
Dimension       →  a column you can group or filter by (categorical or time)
Entity          →  a join key (primary, foreign, or unique) linking semantic models
Metric          →  a named, queryable calculation built from one or more measures
```

The mental model: semantic models are like fact/dimension tables described declaratively; metrics are saved, reusable aggregations over them — so "revenue" is defined once and every consumer (dashboard, notebook, spreadsheet) gets the same number.

## 🧩 Semantic Models

```yaml
# models/marts/semantic_models.yml
semantic_models:
  - name: orders
    description: "One row per order"
    model: ref('fct_orders')
    defaults:
      agg_time_dimension: order_date

    entities:
      - name: order_id
        type: primary
      - name: customer_id
        type: foreign
      - name: store_id
        type: foreign

    dimensions:
      - name: order_date
        type: time
        type_params:
          time_granularity: day
      - name: order_status
        type: categorical
      - name: is_first_order
        type: categorical

    measures:
      - name: order_total
        agg: sum
        expr: amount_usd
        agg_time_dimension: order_date
      - name: order_count
        agg: count
        expr: order_id
      - name: distinct_customers
        agg: count_distinct
        expr: customer_id
```

Key fields:
- `model:` — a `ref()` to the dbt model this semantic model wraps (usually a mart or fact table)
- `defaults.agg_time_dimension` — the time dimension used when a metric doesn't specify one
- `entities` — join keys; `type` is `primary`, `foreign`, or `unique`
- `dimensions` — attributes to group/filter by; `type: time` requires `time_granularity`
- `measures` — the raw aggregations metrics are built from (`sum`, `average`, `count`, `count_distinct`, `min`, `max`, `sum_boolean`)

## 📏 Metric Types

```yaml
# models/marts/metrics.yml
metrics:
  # Simple: direct wrap of a measure
  - name: revenue
    type: simple
    label: "Revenue"
    type_params:
      measure: order_total

  # Ratio: numerator / denominator
  - name: average_order_value
    type: ratio
    label: "Average Order Value"
    type_params:
      numerator: order_total
      denominator: order_count

  # Cumulative: running total or rolling window
  - name: cumulative_revenue
    type: cumulative
    label: "Cumulative Revenue (all-time)"
    type_params:
      measure: order_total

  - name: trailing_30d_revenue
    type: cumulative
    label: "Trailing 30-Day Revenue"
    type_params:
      measure: order_total
      cumulative_type_params:
        window: 30 days

  # Derived: arithmetic across other metrics
  - name: revenue_growth_pct
    type: derived
    label: "Revenue Growth %"
    type_params:
      expr: "(current_revenue - prior_revenue) / prior_revenue"
      metrics:
        - name: revenue
          alias: current_revenue
        - name: revenue
          alias: prior_revenue
          offset_window: 7 days

  # Conversion: rate of base → conversion event within a window
  - name: signup_to_purchase_conversion
    type: conversion
    label: "Signup → Purchase Conversion Rate"
    type_params:
      entity: user_id
      calculation: conversion_rate
      base_measure: signups
      conversion_measure: purchases
      conversion_type_params:
        window: 7 days
```

## 🔗 Entities & Joins

MetricFlow joins semantic models automatically based on shared entities — you never hand-write the `JOIN` clause.

```yaml
# Two semantic models sharing the customer_id entity join automatically
semantic_models:
  - name: orders
    entities:
      - name: customer_id
        type: foreign
    # ...

  - name: customers
    entities:
      - name: customer_id
        type: primary
    dimensions:
      - name: customer_region
        type: categorical
    # ...
```

```bash
# Query a measure from `orders` grouped by a dimension from `customers` —
# MetricFlow resolves the join via the shared customer_id entity
mf query --metrics revenue --group-by customer__customer_region
```

Note the `customer__` prefix — dimensions from a joined semantic model are referenced as `<entity_name>__<dimension_name>`.

## 📅 Time Spine & Granularity

```yaml
# models/metricflow_time_spine.sql (a model MetricFlow needs for time-based joins)
# SELECT date_day FROM ... generating one row per calendar day

# models/_time_spine.yml
models:
  - name: metricflow_time_spine
    time_spine:
      standard_granularity_column: date_day
    columns:
      - name: date_day
        granularity: day
```

```bash
# Group by the built-in metric_time dimension at any granularity
mf query --metrics revenue --group-by metric_time__day
mf query --metrics revenue --group-by metric_time__week
mf query --metrics revenue --group-by metric_time__month
mf query --metrics revenue --group-by metric_time__quarter
mf query --metrics revenue --group-by metric_time__year
```

## 🎯 Filters

```bash
# where filter on a categorical dimension
mf query --metrics revenue \
  --group-by metric_time__month \
  --where "{{ Dimension('order_id__order_status') }} = 'completed'"

# filter on a joined dimension
mf query --metrics revenue \
  --group-by metric_time__month \
  --where "{{ Dimension('customer__customer_region') }} = 'APAC'"

# limit and order results
mf query --metrics revenue --group-by metric_time__month --order-by metric_time__month --limit 12
```

```yaml
# Metric-level filter, applied every time the metric is used
metrics:
  - name: completed_order_revenue
    type: simple
    type_params:
      measure: order_total
    filter: |
      {{ Dimension('order_id__order_status') }} = 'completed'
```

## 💻 MetricFlow CLI

```bash
mf list metrics                                  # all defined metrics
mf list dimensions --metrics revenue             # valid dimensions for a metric
mf list entities                                  # all entities across semantic models
mf validate-configs                               # catch broken refs, missing joins, type errors

mf query --metrics revenue,order_count \
  --group-by metric_time__month,customer__customer_region \
  --order-by -metric_time__month \
  --limit 100

mf query --metrics revenue --group-by metric_time__day --explain   # print generated SQL, don't run it
mf query --metrics revenue --group-by metric_time__day --compile-only  # compile without executing
```

## 🌐 Querying the Semantic Layer

```python
# Python: dbt Semantic Layer GraphQL client (via the official SDK)
from dbtsl import SemanticLayerClient

client = SemanticLayerClient(
    environment_id=123456,
    auth_token="dbt_sl_...",
    host="semantic-layer.cloud.getdbt.com",
)

with client.session():
    df = client.query(
        metrics=["revenue", "order_count"],
        group_by=["metric_time__month", "customer__customer_region"],
        order_by=["-metric_time__month"],
    )
```

```sql
-- JDBC driver: query metrics with familiar SQL-like syntax from a BI tool or notebook
SELECT *
FROM {{ semantic_layer.query(
    metrics=['revenue'],
    group_by=['metric_time__month']
) }}
```

```graphql
# Raw GraphQL query against the Semantic Layer API
query {
  query(
    metrics: [{ name: "revenue" }]
    groupBy: [{ name: "metric_time__month" }]
  ) {
    jsonResult
  }
}
```

## ✅ Validation & Testing

```bash
# Catch config errors before shipping: broken measure refs, ambiguous joins,
# missing time dimensions, invalid entity types
mf validate-configs

# Dry-run a query to check the generated SQL without hitting the warehouse
mf query --metrics revenue --group-by metric_time__day --explain
```

```yaml
# Standard dbt tests still apply to the underlying models
models:
  - name: fct_orders
    columns:
      - name: order_id
        tests: [unique, not_null]
      - name: customer_id
        tests:
          - relationships:
              to: ref('dim_customers')
              field: customer_id
```

## 📊 BI Tool Integration

```text
Tools that can query the dbt Semantic Layer directly (via JDBC, GraphQL, or a native
connector — check current partner docs for exact setup):
  - Tableau
  - Google Sheets
  - Hex
  - Mode
  - Excel (via dbt's Semantic Layer connector)
  - Any tool that can hit a JDBC/ODBC endpoint or call the GraphQL API
```

The value proposition: the BI tool queries *metrics*, not raw tables — so "revenue" always means the same thing whether it's viewed in Tableau, a Python notebook, or a spreadsheet.

## 🛒 Real-World Example: E-Commerce Metric Tree

A worked example showing how semantic models and metrics stack into a real metric tree for an e-commerce business — three semantic models joined by shared entities, with metrics layered from simple → ratio → derived.

```yaml
# models/marts/semantic_models.yml
semantic_models:
  - name: orders
    model: ref('fct_orders')
    defaults: { agg_time_dimension: order_date }
    entities:
      - name: order_id
        type: primary
      - name: customer_id
        type: foreign
    dimensions:
      - name: order_date
        type: time
        type_params: { time_granularity: day }
      - name: order_status
        type: categorical
    measures:
      - name: order_total
        agg: sum
        expr: amount_usd
      - name: order_count
        agg: count
        expr: order_id

  - name: order_items
    model: ref('fct_order_items')
    defaults: { agg_time_dimension: order_date }
    entities:
      - name: order_item_id
        type: primary
      - name: order_id
        type: foreign
      - name: product_id
        type: foreign
    measures:
      - name: item_quantity
        agg: sum
        expr: quantity
      - name: item_count
        agg: count
        expr: order_item_id

  - name: customers
    model: ref('dim_customers')
    entities:
      - name: customer_id
        type: primary
    dimensions:
      - name: customer_region
        type: categorical
      - name: signup_date
        type: time
        type_params: { time_granularity: day }
```

```yaml
# models/marts/metrics.yml — layered metric tree
metrics:
  # Layer 1: simple metrics straight off measures
  - name: revenue
    type: simple
    type_params: { measure: order_total }

  - name: orders
    type: simple
    type_params: { measure: order_count }

  - name: units_sold
    type: simple
    type_params: { measure: item_quantity }

  # Layer 2: ratios built from Layer 1
  - name: average_order_value
    type: ratio
    type_params: { numerator: order_total, denominator: order_count }

  - name: units_per_order
    type: ratio
    type_params: { numerator: item_quantity, denominator: order_count }

  # Layer 3: derived — week-over-week comparison built from a Layer-1 metric
  - name: revenue_wow_change
    type: derived
    type_params:
      expr: "current_week - prior_week"
      metrics:
        - name: revenue
          alias: current_week
        - name: revenue
          alias: prior_week
          offset_window: 7 days
```

```bash
# One query answering "AOV by region, this month, completed orders only"
mf query \
  --metrics average_order_value \
  --group-by customer__customer_region \
  --where "{{ Dimension('order_id__order_status') }} = 'completed'" \
  --start-time '2026-09-01' --end-time '2026-09-30'
```

## 🧮 Advanced Metric Patterns

```yaml
# Month-over-month AND year-over-year in the same derived metric family
metrics:
  - name: revenue_mom_pct
    type: derived
    label: "Revenue MoM %"
    type_params:
      expr: "(this_month - last_month) / nullif(last_month, 0)"
      metrics:
        - name: revenue
          alias: this_month
        - name: revenue
          alias: last_month
          offset_window: 1 month

  - name: revenue_yoy_pct
    type: derived
    label: "Revenue YoY %"
    type_params:
      expr: "(this_year - last_year) / nullif(last_year, 0)"
      metrics:
        - name: revenue
          alias: this_year
        - name: revenue
          alias: last_year
          offset_window: 1 year
```

```yaml
# Combining multiple filter conditions on a metric with AND / OR
metrics:
  - name: high_value_completed_revenue
    type: simple
    type_params: { measure: order_total }
    filter: |
      {{ Dimension('order_id__order_status') }} = 'completed'
      and {{ Measure('order_total') }} > 100
```

```yaml
# Nesting: a derived metric can reference another derived metric
metrics:
  - name: revenue_growth_acceleration
    type: derived
    type_params:
      expr: "this_period_growth - last_period_growth"
      metrics:
        - name: revenue_mom_pct
          alias: this_period_growth
        - name: revenue_mom_pct
          alias: last_period_growth
          offset_window: 1 month
```

```text
Percent-of-total (e.g. "this region's share of total revenue") is NOT a
built-in metric type — MetricFlow has no window-function metric type.
Two common workarounds:
  1. Query the metric grouped by the dimension, then compute the share
     in the BI tool / notebook (most common).
  2. Materialize a pre-aggregated "total" as its own metric and combine
     with a `derived` metric — works for a fixed grouping, not ad-hoc slicing.
```

## 🏷️ Metric Metadata & Governance

```yaml
metrics:
  - name: revenue
    type: simple
    label: "Revenue"                       # human-readable name shown in BI tools
    description: >
      Gross merchandise revenue in USD, before refunds. Owned by the
      Finance team; see #data-finance for questions.
    type_params:
      measure: order_total
    config:
      meta:
        owner: "finance-team"
        tier: "gold"                       # informal governance tagging convention
```

- `label` is what shows up in connected BI tools — keep it business-friendly, not a snake_case identifier.
- `description` renders in dbt docs and in Semantic Layer-aware BI tools' field pickers; treat it as end-user documentation, not a code comment.
- `config.meta` is free-form — many teams use it to tag an owning team, a governance tier (gold/silver/bronze), or a deprecation flag consumed by custom docs tooling.
- Exact support for `group`/`access` modifiers on metrics varies by dbt version — check your version's docs before relying on them for access control.

## 🖥️ dbt Cloud CLI vs. OSS MetricFlow

| Task                     | OSS `mf` (local MetricFlow)              | dbt Cloud CLI (`dbt sl`)                    |
| ------------------------- | ------------------------------------------ | ---------------------------------------------- |
| List metrics              | `mf list metrics`                          | `dbt sl list metrics`                          |
| Query a metric            | `mf query --metrics revenue --group-by ...`| `dbt sl query --metrics revenue --group-by ...`|
| Validate configs          | `mf validate-configs`                      | `dbt sl validate`                              |
| Runs against              | Your local warehouse credentials directly  | The hosted Semantic Layer (production runs)    |
| Needs a compiled manifest | `dbt parse` first                          | Handled automatically against the latest run   |
| BI tool connectivity      | Not directly — local only                  | Yes — this is what powers JDBC/GraphQL access  |

The practical difference: `mf` is great for local development and fast iteration; the hosted Semantic Layer (queried through `dbt sl` or a connected BI tool) is what production dashboards actually hit, and it always reflects the last successful **production** job run, not your local dev branch.

## 🛠️ Troubleshooting Common Errors

| Error message (paraphrased)                         | Likely cause                                                       | Fix                                                              |
| ------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `Dimension 'region' not found`                          | Missing the entity prefix for a joined dimension                        | Use `customer__region`, not `region`                                |
| `No agg_time_dimension found for measure`                | Measure/semantic model has no time dimension declared                   | Set `defaults.agg_time_dimension` or per-measure `agg_time_dimension` |
| `Ambiguous join path between semantic models`            | Two unrelated semantic models share an entity name coincidentally       | Rename one entity, or add an explicit join path if supported by version |
| Query returns `NULL`/`Infinity` in a ratio metric         | Denominator measure was zero for that slice                             | Wrap with `nullif(denominator, 0)` logic or handle in the BI layer   |
| `Metric not found` from a connected BI tool but `mf list metrics` shows it | BI tool is pointed at the hosted Semantic Layer, which reflects the last **production** job, not your dev branch | Merge to the branch that triggers production, or run a job first    |
| CI fails on `mf validate-configs` but passed locally      | Local run used stale `manifest.json`                                    | Re-run `dbt parse` right before validating, in the same CI step     |

## ⚠️ Common Gotchas

- **`agg_time_dimension` must be set** on every measure (or inherited from `defaults`) — metrics can't be queried by time without it.
- **Dimension references from joined models need the entity prefix** (`customer__region`, not just `region`) — forgetting the prefix gives a "dimension not found" error.
- **`ratio` and `derived` metrics can silently divide by zero** — guard denominators or expect nulls/infs downstream.
- **`mf validate-configs` doesn't catch everything** — a measure with the wrong `agg` type (e.g. `sum` on a non-numeric column) can still pass validation and fail at query time.
- **Local `mf query` runs against your dev warehouse credentials** — it does not go through the hosted Semantic Layer API, so results can differ from what a connected BI tool sees if dev/prod data diverges.
- **Cumulative metrics without a `window` compute an all-time running total** — easy to do by accident when you meant a rolling window.
- **Conversion metrics require a shared entity** between the base and conversion measures — cross-entity conversion metrics aren't supported.
- **There is no built-in "percent of total" metric type** — teams often try to force this into a `derived` metric and get stuck; compute the share in the BI layer instead (see [Advanced Metric Patterns](#advanced-metric-patterns)).
- **The hosted Semantic Layer only reflects the last successful production job** — a metric that exists on your feature branch won't appear to a connected BI tool until it's merged and deployed.
- **`offset_window` changes the query's effective date range** — requesting `offset_window: 1 year` on a metric with only 6 months of source data returns nulls for the offset period, not an error.

## 🎯 Best Practices

```yaml
# GOOD: one clear owner semantic model per fact table, metrics layered on top
semantic_models:
  - name: orders          # wraps fct_orders, one source of truth
    # ...

metrics:
  - name: revenue          # simple, reusable building block
  - name: aov              # ratio built from revenue + order_count
  - name: revenue_growth_pct  # derived, built from revenue
```

- Model metrics in **layers**: simple metrics on raw measures first, then ratio/derived metrics that reference them — avoid re-deriving the same math in multiple places.
- Keep **semantic models 1:1 with a mart-layer fact table** rather than raw sources — let dbt's staging/intermediate layers handle cleaning first.
- Name metrics the way the business talks (`revenue`, not `sum_amount_usd`) — the metric name is the public API.
- Version-control metric definitions in the same PR review process as model changes; treat a metric rename as a breaking change for downstream consumers.
- Add `mf validate-configs` to CI so broken semantic layer configs fail the build, not a stakeholder's dashboard.

## 💡 Pro Tips

1. **Start with measures, not metrics** — get the semantic model's raw aggregations right first, then layer metrics on top.
2. **Use `--explain` liberally** while developing — reading the generated SQL catches join and filter mistakes fast.
3. **Prefer `derived` over duplicating logic** — if two metrics share a calculation, factor it into a shared metric and reference it.
4. **Set `agg_time_dimension` at the semantic model's `defaults`** level so you don't repeat it per measure.
5. **Use `offset_window` in derived metrics** for period-over-period comparisons instead of separate warehouse queries.
6. **Keep the time spine model simple** — one row per day, no joins, so MetricFlow's time-based joins stay cheap.
7. **Treat metric YAML like an API contract** — breaking changes (renames, type changes) need a deprecation path for BI consumers.
8. **Use `mf list dimensions --metrics X`** before writing a query — it tells you exactly what's queryable without trial and error.
9. **Co-locate semantic models with the mart they describe** in your dbt project structure, not in one giant global file.
10. **Validate configs in CI** (`mf validate-configs`) on every PR that touches `semantic_models:` or `metrics:` YAML.
