# Cube.js Cheatsheet for Analytics Engineers

> A structured reference for building a semantic/headless BI layer with Cube — data modeling (YAML & JS), joins, pre-aggregations, and querying via REST, GraphQL, and the SQL API.

## 📑 Table of Contents

1. [🚀 Setup and Project Structure](#setup-and-project-structure)
2. [🧩 Data Modeling Basics](#data-modeling-basics)
3. [🔗 Joins](#joins)
4. [🧮 Measures & Dimensions Deep Dive](#measures-dimensions-deep-dive)
5. [🍕 Segments](#segments)
6. [⚡ Pre-Aggregations](#pre-aggregations)
7. [🔄 Refresh Strategies](#refresh-strategies)
8. [🌐 Querying: REST, GraphQL, SQL API](#querying-rest-graphql-sql-api)
9. [⚛️ Client-Side Usage](#client-side-usage)
10. [🔐 Security Context & Multi-Tenancy](#security-context-multi-tenancy)
11. [🏬 Real-World Example: SaaS Subscription Analytics](#real-world-example-saas-subscription-analytics)
12. [🧱 Extending & Reusing Cubes](#extending-reusing-cubes)
13. [🚀 Advanced Pre-Aggregation Strategies](#advanced-pre-aggregation-strategies)
14. [🌉 Data Blending Across Sources](#data-blending-across-sources)
15. [🛠️ Troubleshooting Common Errors](#troubleshooting-common-errors)
16. [⚠️ Common Gotchas](#common-gotchas)
17. [🎯 Best Practices](#best-practices)
18. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Task                        | Syntax                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| Define a cube (YAML)         | `model/cubes/orders.yml` with `cubes:` block                             |
| Define a cube (JS)           | `cube('Orders', { sql_table: ..., measures: {...}, dimensions: {...} })` |
| Query via REST               | `POST /cubejs-api/v1/load` with a JSON query body                        |
| Query via GraphQL            | `POST /cubejs-api/graphql`                                               |
| Query via SQL API             | `SELECT MEASURE(orders.count) FROM orders` (Postgres-wire protocol)      |
| Add a pre-aggregation        | `pre_aggregations:` block inside a cube                                  |
| Force a pre-agg rebuild      | `cubejs-server` CLI or Cube Cloud UI → "Refresh"                          |
| Client query (JS)            | `cubejsApi.load({ measures: [...], dimensions: [...] })`                 |
| React hook                   | `useCubeQuery({ measures: [...] })`                                       |
| Extend a cube                | `extends: base_cube_name` at the top of a cube definition                |
| Rollup join pre-agg          | `pre_aggregations:` with `type: rollupJoin` spanning two cubes           |
| Lambda pre-agg (real-time)   | `pre_aggregations:` with `type: rollupLambda`, unions batch + streaming  |
| Blend two data sources       | Separate `data_source` per cube + a join between them                    |
| Cron-based scheduled refresh | `CUBEJS_SCHEDULED_REFRESH_TIMER` env var or `refresh_key.every`          |

**Measure type cheat sheet**

| Type       | Use case                                  |
| ---------- | ------------------------------------------ |
| `count`     | Row count                                  |
| `sum`       | Total of a numeric column                  |
| `avg`       | Average of a numeric column                |
| `min`/`max` | Extremes                                   |
| `count_distinct` | Distinct count (exact)                |
| `count_distinct_approx` | Distinct count (approximate, faster on big data) |
| `number`    | Custom SQL expression evaluating to a number |

## 🚀 Setup and Project Structure

```bash
# Scaffold a new Cube project
npx cubejs-cli create my-analytics-api -d postgres

# Project layout
my-analytics-api/
  .env                    # DB credentials, Cube tokens
  cube.js                 # server config (or cube.py for Python config)
  model/
    cubes/
      orders.yml
      customers.yml
    views/
      revenue_overview.yml
```

```bash
# Run locally
npm run dev            # starts Cube Playground at localhost:4000

# Run in production
docker run -p 4000:4000 \
  -e CUBEJS_DB_TYPE=postgres \
  -e CUBEJS_API_SECRET=... \
  -v $(pwd):/cube/conf \
  cubejs/cube:latest
```

## 🧩 Data Modeling Basics

```yaml
# model/cubes/orders.yml
cubes:
  - name: orders
    sql_table: public.orders

    measures:
      - name: count
        type: count

      - name: total_amount
        sql: amount
        type: sum

      - name: average_order_value
        sql: amount
        type: avg

    dimensions:
      - name: id
        sql: id
        type: number
        primary_key: true

      - name: status
        sql: status
        type: string

      - name: created_at
        sql: created_at
        type: time
```

```javascript
// model/cubes/orders.js — equivalent definition in JavaScript
cube('Orders', {
  sql_table: `public.orders`,

  measures: {
    count: { type: 'count' },
    totalAmount: { sql: 'amount', type: 'sum' },
    averageOrderValue: { sql: 'amount', type: 'avg' },
  },

  dimensions: {
    id: { sql: 'id', type: 'number', primaryKey: true },
    status: { sql: 'status', type: 'string' },
    createdAt: { sql: 'created_at', type: 'time' },
  },
});
```

```yaml
# Views compose multiple cubes into a single, BI-tool-friendly denormalized surface
views:
  - name: revenue_overview
    cubes:
      - join_path: orders
        includes:
          - total_amount
          - count
          - created_at
      - join_path: orders.customers
        includes:
          - region
          - name
```

## 🔗 Joins

```yaml
cubes:
  - name: orders
    sql_table: public.orders
    joins:
      - name: customers
        sql: "{CUBE}.customer_id = {customers}.id"
        relationship: many_to_one   # also: one_to_many, one_to_one
```

```javascript
cube('Orders', {
  sql_table: `public.orders`,
  joins: {
    Customers: {
      sql: `${CUBE}.customer_id = ${Customers}.id`,
      relationship: `many_to_one`,
    },
  },
});
```

Notes:
- Joins are declared on one side only — Cube resolves the path automatically when a query references dimensions/measures from both cubes.
- `{CUBE}` refers to the current cube's alias; use the referenced cube's name for the other side.

## 🧮 Measures & Dimensions Deep Dive

```yaml
cubes:
  - name: orders
    measures:
      # Filtered measure
      - name: completed_revenue
        sql: amount
        type: sum
        filters:
          - sql: "{CUBE}.status = 'completed'"

      # Rolling window measure
      - name: rolling_30d_revenue
        sql: amount
        type: sum
        rolling_window:
          trailing: 30 day

    dimensions:
      # Calculated / case-based dimension
      - name: order_size_bucket
        sql: >
          CASE
            WHEN {CUBE}.amount < 50 THEN 'small'
            WHEN {CUBE}.amount < 200 THEN 'medium'
            ELSE 'large'
          END
        type: string

      # Sub-query dimension referencing another cube
      - name: customer_lifetime_orders
        sub_query: true
        sql: "{customers.total_orders}"
        type: number
```

## 🍕 Segments

```yaml
cubes:
  - name: orders
    segments:
      - name: completed
        sql: "{CUBE}.status = 'completed'"
      - name: high_value
        sql: "{CUBE}.amount > 500"
```

```javascript
// Segments are reusable named filters, applied in queries
{
  measures: ['Orders.count'],
  segments: ['Orders.completed', 'Orders.highValue'],
}
```

## ⚡ Pre-Aggregations

```yaml
cubes:
  - name: orders
    pre_aggregations:
      - name: daily_revenue
        measures:
          - total_amount
          - count
        dimensions:
          - status
        time_dimension: created_at
        granularity: day
        partition_granularity: month
        refresh_key:
          every: 1 hour
```

```javascript
cube('Orders', {
  // ...
  preAggregations: {
    dailyRevenue: {
      measures: [CUBE.totalAmount, CUBE.count],
      dimensions: [CUBE.status],
      timeDimension: CUBE.createdAt,
      granularity: `day`,
      partitionGranularity: `month`,
      refreshKey: { every: `1 hour` },
    },
  },
});
```

Pre-aggregations materialize rolled-up summary tables (in the source DB, or a dedicated pre-aggregation warehouse like Cube Store) so repeated dashboard queries hit a small table instead of scanning raw fact data.

## 🔄 Refresh Strategies

```yaml
cubes:
  - name: orders
    refresh_key:
      every: 10 minute                     # time-based refresh
      # OR
      sql: "SELECT MAX(updated_at) FROM orders"   # data-driven refresh
```

```javascript
// Incrementally build partitions instead of rebuilding the whole pre-agg
preAggregations: {
  dailyRevenue: {
    // ...
    partitionGranularity: `month`,
    refreshKey: { every: `1 hour`, incremental: true, updateWindow: `7 day` },
  },
}
```

## 🌐 Querying: REST, GraphQL, SQL API

```bash
# REST API
curl -X POST http://localhost:4000/cubejs-api/v1/load \
  -H "Authorization: <CUBE_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "measures": ["Orders.totalAmount", "Orders.count"],
      "dimensions": ["Orders.status"],
      "timeDimensions": [{
        "dimension": "Orders.createdAt",
        "granularity": "month",
        "dateRange": "last 6 months"
      }]
    }
  }'
```

```graphql
# GraphQL API
query {
  cube(
    limit: 100
    timeDimensions: [{ dimension: Orders.createdAt, granularity: month, dateRange: "last 6 months" }]
  ) {
    orders {
      totalAmount
      count
      status
    }
  }
}
```

```sql
-- SQL API (Postgres wire protocol) — plug Cube into any Postgres-speaking BI tool
SELECT
  status,
  MEASURE(total_amount) AS total_amount,
  MEASURE(count) AS order_count
FROM orders
WHERE created_at >= NOW() - INTERVAL '6 month'
GROUP BY 1;
```

## ⚛️ Client-Side Usage

```javascript
import cubejs from '@cubejs-client/core';

const cubejsApi = cubejs('CUBE_API_TOKEN', { apiUrl: 'http://localhost:4000/cubejs-api/v1' });

const resultSet = await cubejsApi.load({
  measures: ['Orders.totalAmount'],
  dimensions: ['Orders.status'],
  timeDimensions: [{ dimension: 'Orders.createdAt', granularity: 'month', dateRange: 'last 6 months' }],
});

console.log(resultSet.tablePivot());
```

```jsx
// React hook
import { useCubeQuery } from '@cubejs-client/react';

function RevenueChart() {
  const { resultSet, isLoading, error } = useCubeQuery({
    measures: ['Orders.totalAmount'],
    timeDimensions: [{ dimension: 'Orders.createdAt', granularity: 'month' }],
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>{error.toString()}</div>;
  return <Chart data={resultSet.chartPivot()} />;
}
```

## 🔐 Security Context & Multi-Tenancy

```javascript
// cube.js — inject a security context from the JWT and use it to scope every query
module.exports = {
  contextToAppId: ({ securityContext }) => `CUBEJS_APP_${securityContext.tenant_id}`,
  queryRewrite: (query, { securityContext }) => {
    query.filters.push({
      member: 'Orders.tenantId',
      operator: 'equals',
      values: [securityContext.tenant_id],
    });
    return query;
  },
};
```

```yaml
# Row-level security expressed directly in the cube using COMPILE_CONTEXT
cubes:
  - name: orders
    sql: >
      SELECT * FROM public.orders
      WHERE tenant_id = '{COMPILE_CONTEXT.securityContext.tenant_id}'
```

## 🏬 Real-World Example: SaaS Subscription Analytics

A worked example modeling MRR-style subscription analytics — three joined cubes plus a view exposing a stable interface to a BI tool.

```yaml
# model/cubes/subscriptions.yml
cubes:
  - name: subscriptions
    sql_table: public.subscriptions

    joins:
      - name: accounts
        sql: "{CUBE}.account_id = {accounts}.id"
        relationship: many_to_one
      - name: plans
        sql: "{CUBE}.plan_id = {plans}.id"
        relationship: many_to_one

    measures:
      - name: active_count
        type: count
        filters:
          - sql: "{CUBE}.status = 'active'"

      - name: mrr
        sql: "{CUBE}.monthly_amount"
        type: sum
        filters:
          - sql: "{CUBE}.status = 'active'"

      - name: churned_mrr
        sql: "{CUBE}.monthly_amount"
        type: sum
        filters:
          - sql: "{CUBE}.status = 'churned'"

    dimensions:
      - name: id
        sql: id
        type: number
        primary_key: true
      - name: status
        sql: status
        type: string
      - name: started_at
        sql: started_at
        type: time
      - name: churned_at
        sql: churned_at
        type: time

# model/cubes/plans.yml
cubes:
  - name: plans
    sql_table: public.plans
    dimensions:
      - name: id
        sql: id
        type: number
        primary_key: true
      - name: tier
        sql: tier
        type: string

# model/cubes/accounts.yml
cubes:
  - name: accounts
    sql_table: public.accounts
    dimensions:
      - name: id
        sql: id
        type: number
        primary_key: true
      - name: region
        sql: region
        type: string
```

```yaml
# model/views/mrr_overview.yml — the only thing a BI tool ever sees
views:
  - name: mrr_overview
    cubes:
      - join_path: subscriptions
        includes: [mrr, churned_mrr, active_count, started_at, status]
      - join_path: subscriptions.plans
        includes: [tier]
      - join_path: subscriptions.accounts
        includes: [region]
```

```bash
curl -X POST http://localhost:4000/cubejs-api/v1/load \
  -H "Authorization: <CUBE_API_TOKEN>" -H "Content-Type: application/json" \
  -d '{
    "query": {
      "measures": ["MrrOverview.mrr", "MrrOverview.churnedMrr"],
      "dimensions": ["MrrOverview.tier", "MrrOverview.region"],
      "timeDimensions": [{"dimension": "MrrOverview.startedAt", "granularity": "month", "dateRange": "last 12 months"}]
    }
  }'
```

## 🧱 Extending & Reusing Cubes

```yaml
# Base cube with shared logic
cubes:
  - name: base_events
    sql_table: public.events
    measures:
      - name: count
        type: count
    dimensions:
      - name: occurred_at
        sql: occurred_at
        type: time

  # Extend it for a specific event type without repeating shared fields
  - name: signup_events
    extends: base_events
    sql: "SELECT * FROM {base_events.sql()} WHERE event_type = 'signup'"
```

```javascript
// JS equivalent using cube extension
const BaseEvents = cube('BaseEvents', {
  sql_table: `public.events`,
  measures: { count: { type: `count` } },
  dimensions: { occurredAt: { sql: `occurred_at`, type: `time` } },
});

cube('SignupEvents', {
  extends: BaseEvents,
  sql: `SELECT * FROM ${BaseEvents.sql()} WHERE event_type = 'signup'`,
});
```

```yaml
# Parameterize a repeated pattern across similar cubes with cube factories (JS-only)
# — YAML config doesn't support factory functions, so use cube.js/cube.py for this pattern
```

Extension is Cube's main DRY mechanism: shared measures/dimensions/joins live once on a base cube, and specific variants extend it and override or add only what's different — avoiding copy-pasted cube definitions across similar event or entity types.

## 🚀 Advanced Pre-Aggregation Strategies

```yaml
# Rollup join: pre-aggregate a join between two large cubes so query-time
# joins never hit raw tables
cubes:
  - name: orders
    pre_aggregations:
      - name: orders_customers_rollup
        type: rollupJoin
        measures: [orders.total_amount]
        dimensions: [customers.region]
        rollups:
          - orders.daily_revenue
          - customers.region_rollup
```

```yaml
# Lambda pre-aggregation: union a batch (pre-aggregated) rollup with
# fresh streaming/real-time data so dashboards feel live without full rebuilds
cubes:
  - name: orders
    pre_aggregations:
      - name: orders_lambda
        type: rollupLambda
        rollups:
          - orders.daily_revenue          # batch rollup, refreshed hourly
        union_with_source_data: true       # unions in real-time rows since last refresh
```

```yaml
# original_sql pre-aggregation: materialize a cube's base query itself,
# useful when the source query is expensive (heavy joins/CTEs) even before rollup
cubes:
  - name: orders
    pre_aggregations:
      - name: orders_base
        type: originalSql
```

| Pre-agg type    | When to use                                                              |
| ---------------- | --------------------------------------------------------------------------- |
| `rollup` (default)| Standard summary table for one cube's measures/dimensions at a granularity |
| `rollupJoin`      | Pre-aggregate an expensive join across cubes                               |
| `rollupLambda`     | Near-real-time dashboards that still want the speed of rollups             |
| `originalSql`      | The base query itself is expensive; cache it before further rollups        |

## 🌉 Data Blending Across Sources

```javascript
// cube.js — register multiple data sources
module.exports = {
  dbType: ({ dataSource }) => {
    if (dataSource === 'events') return 'bigquery';
    return 'postgres';
  },
  driverFactory: ({ dataSource }) => {
    if (dataSource === 'events') return new BigQueryDriver({ /* ... */ });
    return new PostgresDriver({ /* ... */ });
  },
};
```

```yaml
# Tag each cube with the data source it lives in
cubes:
  - name: orders
    data_source: default          # e.g. Postgres
    sql_table: public.orders

  - name: page_views
    data_source: events           # e.g. BigQuery
    sql_table: analytics.page_views
```

```text
Cube can join across data_source boundaries, but the join happens at the
Cube layer (post-aggregation), not pushed down as a single SQL query —
each side is queried independently and results are combined in Cube's
own execution engine. This works well for blending at reasonable
cardinality, but isn't a substitute for a proper warehouse-side join on
very large datasets.
```

## 🛠️ Troubleshooting Common Errors

| Symptom                                                | Likely cause                                                     | Fix                                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Query is slow despite having a pre-aggregation defined      | Query shape (fields/granularity) doesn't exactly match the pre-agg      | Check the Playground's pre-agg match indicator; add the missing field to the pre-agg |
| `Error: Can't find join path`                               | Two cubes referenced in a query have no declared join between them       | Add a `joins:` entry on one of the cubes, or query through a view that already defines the path |
| Numbers look inflated after adding a join                    | Wrong `relationship` cardinality (e.g. `one_to_many` where it should be `many_to_one`) | Verify actual foreign-key cardinality and correct the join definition |
| Pre-aggregation never finishes refreshing                    | `refresh_key` interval is shorter than the actual build time             | Lengthen the refresh interval or narrow the pre-agg's date range/partitioning |
| Security context filter doesn't apply to cached results        | Pre-aggregations are shared across tenants and not partitioned by tenant | Add the tenant dimension to the pre-agg or partition pre-aggs per tenant |
| SQL API query fails with "unsupported SQL construct"           | Query uses SQL the Cube SQL API can't translate (window functions, complex subqueries) | Simplify the query, or query the REST/GraphQL API directly with Cube's native query format |

## ⚠️ Common Gotchas

- **Pre-aggregations must include every dimension/measure used in a query** to be eligible — a query that adds one extra field silently falls back to the raw cube (slower, but not an error), so watch query latency, not just correctness.
- **`refresh_key` defaults can be too aggressive or too stale** — the default `every: 1 hour`-ish behavior may not match how fresh your dashboards actually need to be; set it explicitly.
- **Joins are directional in definition but bidirectional in use** — declaring the join once is enough, but `relationship` (`many_to_one` vs `one_to_many`) must match the actual cardinality or aggregations double-count.
- **`sub_query` dimensions can be expensive** — each one runs a correlated subquery per row; prefer a join or pre-aggregation when possible.
- **The SQL API doesn't support arbitrary SQL** — it only understands the shape Cube can translate into its query format (measures, dimensions, filters); complex hand-written joins won't pass through.
- **Security context changes require careful caching** — pre-aggregations are typically shared across tenants unless partitioned by tenant, so row-level security via `queryRewrite` alone doesn't restrict pre-agg storage, only query results.

## 🎯 Best Practices

```yaml
# GOOD: views expose a clean, stable interface; cubes stay implementation detail
views:
  - name: revenue_overview
    cubes:
      - join_path: orders
        includes: [total_amount, count]
```

- Model **cubes around fact/dimension tables**, then use **views** to compose the denormalized shape BI tools actually query — don't expose raw cubes directly to end users.
- Add **pre-aggregations for every dashboard's exact query shape** (measures + dimensions + granularity) rather than one broad pre-agg you hope covers everything.
- Set `refresh_key` deliberately per cube based on how fresh that data needs to be — don't rely on defaults for high-traffic dashboards.
- Keep **row-level security in `queryRewrite`**, not scattered across individual cube `sql` blocks, so it's auditable in one place.
- Use **Cube Store** (or a dedicated pre-aggregation warehouse) in production instead of materializing pre-aggregations back into the transactional source DB.

## 💡 Pro Tips

1. **Use the Playground's "Pre-Aggregations" tab** during development — it tells you whether a query hit a pre-agg or fell back to raw data.
2. **Name measures/dimensions consistently** (`camelCase` in JS, matching `snake_case` in YAML) so REST/GraphQL/SQL API consumers see one naming convention.
3. **Partition pre-aggregations by time** (`partition_granularity`) for large fact tables — enables incremental refresh instead of full rebuilds.
4. **Prefer `count_distinct_approx`** over `count_distinct` on large tables where exact counts aren't required — it's dramatically faster.
5. **Use views as the contract** with BI tools; refactor underlying cubes freely as long as the view's field names stay stable.
6. **Test `queryRewrite` logic** with unit tests — it's security-critical code that's easy to get subtly wrong.
7. **Watch the `refreshKey` SQL cost** — a data-driven refresh key (`SELECT MAX(updated_at)...`) runs on every refresh check, so keep it cheap and indexed.
8. **Use the SQL API for tools that only speak SQL** (legacy BI, some notebooks) instead of building custom REST integration.
9. **Version your model directory in git** like any other codebase — cube definitions are the semantic layer's source of truth.
10. **Monitor pre-aggregation build times** in Cube Cloud (or your own logging) — a pre-agg that takes longer to build than its refresh interval will never catch up.
