# Looker / LookML Cheatsheet for Data & Analytics

> A structured LookML reference — views, models, explores, dimensions & measures, joins, derived tables, Liquid templating, access control, and the Looker development workflow.

## 📑 Table of Contents

1. [🧠 Core Concepts: Models, Views & Explores](#core-concepts-models-views-explores)
2. [📄 View Files: Dimensions & Measures](#view-files-dimensions-measures)
3. [🔢 Field Types Reference](#field-types-reference)
4. [🕐 dimension_group: Dates & Times](#dimension_group-dates-times)
5. [🗺️ Model Files: Explores & Joins](#model-files-explores-joins)
6. [🔗 Join Types & Relationships](#join-types-relationships)
7. [🧩 Derived Tables](#derived-tables)
8. [💧 Liquid Templating](#liquid-templating)
9. [🎛️ Filters, Parameters & Templated Filters](#filters-parameters-templated-filters)
10. [🔐 Access Control & Row-Level Security](#access-control-row-level-security)
11. [♻️ Persistent Derived Tables (PDTs) & Datagroups](#persistent-derived-tables-pdts-datagroups)
12. [📊 Explore-Time Features: Pivots, Table Calcs, Custom Fields](#explore-time-features-pivots-table-calcs-custom-fields)
13. [🔌 Looker API & Embedding](#looker-api-embedding)
14. [🌳 Project Structure & Git Workflow](#project-structure-git-workflow)
15. [⚡ Performance & Caching](#performance-caching)
16. [🧰 LookML IDE Tips](#lookml-ide-tips)
17. [⚠️ Common Gotchas](#common-gotchas)
18. [🎯 Best Practices](#best-practices)
19. [💡 Pro Tips](#pro-tips)
20. [🧮 Advanced LookML Patterns: Symmetric Aggregates & Fan-Out](#advanced-lookml-patterns-symmetric-aggregates-fan-out)
21. [🧪 LookML Testing](#lookml-testing)
22. [🔀 CI/CD for LookML Projects](#cicd-for-lookml-projects)
23. [🗂️ Advanced Explore Configuration](#advanced-explore-configuration)
24. [📚 Worked Examples Across Business Scenarios](#worked-examples-across-business-scenarios-looker)

## ⚡ Quick Reference

**LookML syntax cheatsheet**

| Task                          | LookML                                                                |
| -------------------------------- | -------------------------------------------------------------------------- |
| Define a view's source table     | `sql_table_name: schema.table ;;`                                         |
| Simple dimension                 | `dimension: status { type: string sql: ${TABLE}.status ;; }`               |
| Simple measure                   | `measure: total_sales { type: sum sql: ${TABLE}.amount ;; }`                |
| Reference another field          | `${field_name}` (same view) / `${view_name.field_name}` (other view)       |
| Date/time group                  | `dimension_group: created { type: time timeframes: [date, week, month, year] sql: ${TABLE}.created_at ;; }` |
| Join two views                    | `explore: orders { join: customers { sql_on: ${orders.customer_id} = ${customers.id} ;; relationship: many_to_one } }` |
| Derived table (SQL)               | `derived_table: { sql: SELECT ... ;; }`                                    |
| Liquid conditional                | `{% if field._parameter_value == 'yes' %} ... {% endif %}`                 |
| Access filter (row-level security) | `access_filter: { field: users.region user_attribute: region }`          |

**File type map**

| File           | Purpose                                                               |
| ---------------- | --------------------------------------------------------------------- |
| `.view.lkml`     | Defines dimensions/measures for one table or derived table             |
| `.model.lkml`    | Defines explores (which views are joinable, connection, datagroups)    |
| `.dashboard.lkml`| Defines a LookML (code-based) dashboard                                |
| `manifest.lkml`  | Project-level settings, constants, extension/localization config       |

## 🧠 Core Concepts: Models, Views & Explores

```text
View    → maps to one database table or one derived table; defines its dimensions & measures
Model   → declares a database connection and a set of Explores; the entry point users pick in the Explore menu
Explore → a joinable "starting point" view plus its join graph to other views — this is what end users query against
```

```text
Project (Git repo)
 ├─ my_model.model.lkml        -- connection + explores
 ├─ views/
 │   ├─ orders.view.lkml
 │   ├─ customers.view.lkml
 │   └─ order_items.view.lkml
 └─ dashboards/
     └─ sales_overview.dashboard.lkml
```

## 📄 View Files: Dimensions & Measures

```lookml
view: orders {
  sql_table_name: analytics.orders ;;    # the ONLY place the physical table name is defined

  dimension: id {
    primary_key: yes
    type: number
    sql: ${TABLE}.id ;;
  }

  dimension: status {
    type: string
    sql: ${TABLE}.status ;;
  }

  dimension: is_completed {
    type: yesno
    sql: ${TABLE}.status = 'completed' ;;
  }

  dimension: order_amount {
    type: number
    value_format_name: usd
    sql: ${TABLE}.amount ;;
  }

  measure: total_orders {
    type: count
  }

  measure: total_revenue {
    type: sum
    sql: ${order_amount} ;;               # measures can reference dimensions in the same view
    value_format_name: usd
  }

  measure: average_order_value {
    type: average
    sql: ${order_amount} ;;
  }
}
```

`${TABLE}` is the alias Looker substitutes for the view's underlying table (or the view's own alias when referenced from a join) — it's the only place the raw table name should ever appear, so renaming the physical table means editing exactly one line (`sql_table_name`).

## 🔢 Field Types Reference

```text
Dimension types: string, number, yesno, time, date, location (lat/lon pair), tier, duration, zipcode
Measure types:   count, count_distinct, sum, average, min, max, median, sum_distinct, average_distinct,
                 list (comma-joined text), percent_of_total, percent_of_previous, running_total, number (custom formula)
```

```lookml
# Custom measure using other measures (type: number)
measure: profit_margin {
  type: number
  sql: ${total_profit} / NULLIF(${total_revenue}, 0) ;;
  value_format_name: percent_2
}

# tier dimension — bucket a numeric field into ranges
dimension: order_value_tier {
  type: tier
  tiers: [0, 50, 100, 250, 500]
  style: integer
  sql: ${order_amount} ;;
}
```

## 🕐 dimension_group: Dates & Times

```lookml
dimension_group: created {
  type: time
  timeframes: [raw, time, date, week, month, quarter, year]
  sql: ${TABLE}.created_at ;;
}
# Generates: created_raw, created_time, created_date, created_week, created_month, created_quarter, created_year
# Referenced in an Explore as orders.created_date, orders.created_month, etc.

dimension_group: age {
  type: duration
  intervals: [day, week, month]
  sql_start: ${TABLE}.created_at ;;
  sql_end: ${TABLE}.completed_at ;;
}
# Generates: age_days, age_weeks, age_months — duration between two timestamps
```

## 🗺️ Model Files: Explores & Joins

```lookml
connection: "my_warehouse_connection"

include: "/views/*.view.lkml"

explore: orders {
  label: "Orders"
  description: "Order-level analysis joined to customers and line items"

  join: customers {
    type: left_outer
    sql_on: ${orders.customer_id} = ${customers.id} ;;
    relationship: many_to_one
  }

  join: order_items {
    type: left_outer
    sql_on: ${orders.id} = ${order_items.order_id} ;;
    relationship: one_to_many
  }
}
```

## 🔗 Join Types & Relationships

```text
type: left_outer (default) | inner | full_outer | cross

relationship declares the JOIN CARDINALITY from the base view's perspective — it does not change the
generated SQL join type, but it tells Looker how to correctly fan out/scale aggregates:
  many_to_one   → many order rows to one customer (most common join direction)
  one_to_many   → one order to many order_items — Looker will warn if you SUM a fact from the "one" side
                   without accounting for the fan-out
  one_to_one
  many_to_many  → use sparingly; usually signals a modeling problem or a genuine bridge table
```

Getting `relationship` wrong doesn't break the SQL, but it silently produces double-counted or under-counted aggregates when a one-to-many join fans a measure out across duplicate rows — this is the single most common LookML correctness bug.

## 🧩 Derived Tables

```lookml
# SQL-based derived table
view: customer_order_summary {
  derived_table: {
    sql:
      SELECT
        customer_id,
        COUNT(*) AS order_count,
        SUM(amount) AS lifetime_value
      FROM analytics.orders
      GROUP BY 1 ;;
  }

  dimension: customer_id { type: number sql: ${TABLE}.customer_id ;; }
  measure: avg_lifetime_value { type: average sql: ${TABLE}.lifetime_value ;; }
}

# Native Derived Table (NDT) — built from LookML fields instead of raw SQL,
# so it inherits access filters and stays in sync with the source view automatically
view: order_summary_ndt {
  derived_table: {
    explore_source: orders {
      column: customer_id { field: orders.customer_id }
      column: total_amount { field: orders.total_revenue }
    }
  }
}
```

## 💧 Liquid Templating

Liquid lets LookML generate SQL conditionally based on filters, parameters, or user attributes at query time.

```lookml
parameter: date_granularity {
  type: unquoted
  allowed_value: { label: "Day" value: "day" }
  allowed_value: { label: "Month" value: "month" }
}

dimension: dynamic_date {
  type: string
  sql:
    {% if date_granularity._parameter_value == 'month' %}
      DATE_TRUNC(${TABLE}.created_at, MONTH)
    {% else %}
      DATE_TRUNC(${TABLE}.created_at, DAY)
    {% endif %} ;;
}

# Liquid referencing a user attribute for RLS-style filtering
dimension: is_own_region {
  type: yesno
  sql: ${TABLE}.region = '{{ _user_attributes['region'] }}' ;;
}
```

## 🎛️ Filters, Parameters & Templated Filters

```lookml
# A filter-only field (doesn't appear as a column, only usable in the Filters bar)
filter: date_filter {
  type: date
}

# Templated filter — inject a UI filter's value directly into raw SQL (derived tables/SQL Runner)
sql: SELECT * FROM orders WHERE {% condition date_filter %} created_at {% endcondition %} ;;

# Parameter — a user-selectable value with no underlying column, used to drive Liquid logic
parameter: unit_selector {
  type: unquoted
  allowed_value: { label: "Miles" value: "mi" }
  allowed_value: { label: "Kilometers" value: "km" }
}
```

## 🔐 Access Control & Row-Level Security

```lookml
explore: orders {
  access_filter: {
    field: customers.region
    user_attribute: region      # each user only sees rows matching their assigned "region" user attribute
  }
}

# Field-level access grants
dimension: ssn {
  sql: ${TABLE}.ssn ;;
  required_access_grants: [can_view_pii]
}

access_grant: can_view_pii {
  user_attribute: can_view_pii
  allowed_values: ["yes"]
}
```

User attributes are configured in the Looker Admin panel and can be set per-user, per-group, or pulled from an external identity provider (SSO) at login.

## ♻️ Persistent Derived Tables (PDTs) & Datagroups

```lookml
view: daily_summary {
  derived_table: {
    sql: SELECT ... ;;
    datagroup_trigger: daily_datagroup    # rebuild this PDT whenever the datagroup's trigger condition fires
    # or: sql_trigger_value: SELECT MAX(created_at) FROM orders ;;   (rebuild when this value changes)
  }
}
```

```lookml
# In the model file
datagroup: daily_datagroup {
  sql_trigger: SELECT CURRENT_DATE ;;     # datagroup considered "stale" once this query's result changes
  max_cache_age: "24 hours"
}
```

A PDT materializes its query result as a real table in a scratch schema on the database, refreshed by its trigger — this moves expensive aggregation off of every-query-time and onto a controlled refresh schedule.

## 📊 Explore-Time Features: Pivots, Table Calcs, Custom Fields

```text
Pivots: drag any dimension into the Pivots area of the Explore — reshapes the result table, doesn't require LookML changes
Table Calculations: spreadsheet-like formulas computed on the already-returned result set (e.g. running totals,
                     % of column) — written in Looker's own expression language, not SQL or LookML
Custom Fields: ad hoc dimensions/measures built by end users directly in the Explore UI without editing LookML —
               useful for one-off analysis, but not reusable/governed the way a real LookML field is
```

## 🔌 Looker API & Embedding

```text
Looker API (REST, versioned e.g. /api/4.0): run saved Looks/queries, manage users/groups/content,
                                             schedule deliveries, programmatically create dashboards
SDKs: official client libraries for Python, JavaScript/TypeScript, Ruby, Java, Kotlin, Swift, Go, C#
Embedding: Signed embedding (secret-signed URLs, simpler) vs. SSO embedding (full Looker session, more capable) —
           both let an external app host a Looker Explore/Dashboard/Look inside its own UI
Looker Actions: send query results out to Slack, email, webhooks, or third-party destinations from a schedule or one-off
```

## 🌳 Project Structure & Git Workflow

```text
Every LookML project is backed by a Git repository. Standard flow:
  1. Development Mode (personal branch) → edit LookML, validate, preview in an Explore
  2. Validate LookML (built-in linter — catches broken joins, undefined field references, SQL errors)
  3. Commit & push to your branch
  4. Open a pull request for review (external Git integration: GitHub/GitLab/Bitbucket)
  5. Deploy to Production (merge to the production branch Looker actually serves queries from)
```

## ⚡ Performance & Caching

```text
- Use PDTs for expensive aggregations queried repeatedly, instead of recomputing from raw derived-table SQL every time
- Set appropriate datagroup trigger granularity — too aggressive a trigger rebuilds PDTs more often than the data actually changes
- Persist only what's reused; a PDT that's queried once isn't worth the maintenance/rebuild overhead
- Use aggregate awareness (aggregate_table) to route Explore queries to a pre-aggregated rollup table when the
  requested grain allows it, instead of always hitting the raw fact table
- Avoid `type: many_to_many` joins in hot-path Explores — they tend to force expensive distinct/dedup logic
```

## 🧰 LookML IDE Tips

| Action                        | How                                              |
| -------------------------------- | --------------------------------------------------- |
| Validate LookML                  | IDE → Validate LookML (or auto-runs on save)          |
| See generated SQL                 | Explore → gear icon → "View SQL" / SQL tab in the IDE |
| Search across all files            | IDE → search icon (project-wide LookML search)         |
| Jump to field definition           | Cmd/Ctrl-click a field reference in the IDE            |
| Preview an Explore from the IDE    | "Explore" button on a model/view file's toolbar        |

## ⚠️ Common Gotchas

- **A `one_to_many` join fans out any measure computed from the "one" side** — summing a customer-level field across a join to order-level rows multiplies it per matching order unless you use a distinct-aware measure type or restructure the join.
- **`${TABLE}` only refers to the current view's own table** — referencing another view's field must use `${view_name.field_name}`, and that view must actually be joined in the Explore being queried, not just present somewhere in the project.
- **PDTs go stale silently between trigger fires** — a `sql_trigger_value` or `datagroup_trigger` that isn't actually sensitive to new data leaves users looking at outdated numbers with no visible warning.
- **Liquid `{% condition %}` blocks only work inside `sql:`/`html:` parameters**, not inside arbitrary LookML — and unescaped Liquid output in raw SQL derived tables is a real SQL-injection surface if it ever touches untrusted user input.
- **`relationship:` doesn't change the SQL join type** — it's purely a hint for aggregate correctness and fan-out warnings; changing `type: left_outer` to `inner` is what actually changes the generated SQL.
- **Access filters apply per-Explore, not per-view** — a view included in two different Explores needs the access filter configured on each Explore separately (or centralized via `access_grant`s on the fields themselves).
- **Native Derived Tables (NDTs) inherit access filters from their source Explore; SQL-based derived tables do not** — a raw-SQL derived table can accidentally bypass row-level security that the rest of the model enforces.

## 🎯 Best Practices

- Keep one view per physical table/derived table, with descriptive `label:`/`description:` on non-obvious fields so the Explore UI is self-documenting for business users.
- Prefer Native Derived Tables over raw SQL derived tables when the logic can be expressed in LookML — you keep access filters, lineage, and consistency with the rest of the model.
- Centralize row-level security via `access_grant`/`access_filter` rather than scattering per-user `IF` logic across dimensions.
- Validate LookML and review the generated SQL before merging any join or derived-table change — a passing validator doesn't guarantee correct aggregate math.
- Use `include:` with glob patterns (`/views/*.view.lkml`) to keep model files from becoming an unmaintainable list of individual filenames.
- Reserve `many_to_many` joins for genuine bridge-table scenarios and document why in the join's `description:`.

## 💡 Pro Tips

1. **`extends:` lets one view inherit and override fields from another** — useful for building specialized variants of a common view without duplicating every dimension.
2. **`sql_always_where:`** on a view enforces a WHERE clause on every query touching it (e.g., excluding soft-deleted rows) without relying on every author remembering to filter manually.
3. **`suggestable: no`** on a high-cardinality dimension prevents Looker from trying to build (and cache) a suggestion list for a field with millions of distinct values.
4. **`hidden: yes`** on intermediate fields used only inside other LookML expressions keeps the Explore field picker uncluttered for end users.
5. **Aggregate Awareness (`aggregate_table`)** can transparently redirect a query to a smaller rollup table when the requested grain matches, without the end user knowing or doing anything differently.
6. **Content Validator (Admin panel)** finds every dashboard/Look broken by a recent LookML change before users hit the error themselves.
7. **`group_label:`** organizes related fields under a shared collapsible header in the field picker, which matters a lot once a view has 40+ fields.
8. **Use `datagroup_trigger` (event-based) over `persist_for` (fixed time window)** wherever the underlying data has a clear "this changed" signal — it avoids both stale results and unnecessary rebuilds.
9. **The `sql_on` for a join can reference Liquid/parameters too** — letting a join itself change shape based on a user-selected parameter, not just the fields it returns.
10. **LookML's built-in linter catches undefined field references and broken joins, but not fan-out/double-counting bugs** — always sanity-check a new join's aggregate totals against a known-good number before shipping it.

## 🧮 Advanced LookML Patterns: Symmetric Aggregates & Fan-Out

```text
Symmetric aggregates: Looker's mechanism for correctly summing a measure from the "one" side of a
                       one_to_many join, even though the join has fanned that row out across multiple
                       matching rows on the "many" side. Looker automatically rewrites the generated SQL
                       (using a database-specific technique — e.g. HyperLogLog-style distinct-key hashing
                       on some dialects) so a customer-level total isn't multiplied by their order count.

You still need to declare it correctly: relationship: one_to_many on the join, and the measure being
summed needs a clean primary_key declared on ITS OWN view for symmetric aggregates to kick in — a
measure without a properly declared primary_key on its source view can silently fall back to naive
(and wrong) summation on a fanned-out join.
```

```lookml
view: customers {
  dimension: id {
    primary_key: yes          # required for symmetric aggregates to correctly protect this view's measures
    type: number
    sql: ${TABLE}.id ;;
  }
  measure: total_lifetime_value {
    type: sum
    sql: ${TABLE}.lifetime_value ;;
  }
}
```

```lookml
# sql_distinct_key: for derived tables/unusual joins where Looker can't infer a clean distinct key itself,
# tell it explicitly how to de-duplicate before aggregating
measure: unique_order_count {
  type: count_distinct
  sql: ${TABLE}.order_id ;;
  sql_distinct_key: ${TABLE}.order_id ;;
}
```

## 🧪 LookML Testing

```lookml
# A LookML data test — asserts an expectation about model output, run via `looker test` or the IDE
test: total_revenue_matches_source {
  explore_source: orders {
    column: total_revenue { field: orders.total_revenue }
  }
  assert: total_revenue_is_positive {
    expression: ${total_revenue} > 0 ;;
  }
}
```

```text
Running tests: IDE → Develop menu → Test, or `looker test run <project>` via the Looker CLI/API in CI —
               tests fail the build (and can block a merge) if a metric's logic silently changes in a
               way that breaks an asserted invariant (e.g., total revenue should never be negative).

Content Validator (separate from LookML data tests): scans every dashboard/Look in a project for
               broken field references after a LookML change, surfacing what will actually error for
               end users before they hit it themselves.
```

## 🔀 CI/CD for LookML Projects

```text
Standard pipeline (via GitHub/GitLab/Bitbucket integration):
  1. Developer branches, edits LookML in Development Mode, validates locally in the IDE
  2. Push branch → CI pipeline runs `looker test` (LookML data tests) and `looker validate`
     (schema/SQL validation against the actual connection) automatically
  3. Pull request review — reviewers can preview the branch's Explores directly in Looker before approving
  4. Merge to production branch → Looker deploys automatically (webhook-triggered) or on a schedule
  5. Content Validator run post-deploy to catch any downstream dashboard breakage immediately
```

```text
Looker CLI / API-driven checks commonly added to CI:
  - `looker lookml validate` — schema-level LookML correctness
  - custom API scripts using the Looker SDK to run a smoke-test query against key Explores and assert
    a non-empty, non-error result before allowing a deploy to proceed
```

## 🗂️ Advanced Explore Configuration

```lookml
explore: orders {
  # Restrict which fields are queryable in this Explore without hiding them project-wide
  fields: [ALL_FIELDS*, -customers.ssn, -customers.internal_notes]

  # Force a filter to always be present — prevents accidental full-table scans on a huge fact table
  always_filter: {
    filters: [orders.created_date: "30 days"]
  }

  # A conditionally required filter — user must filter on this, but Looker doesn't pre-apply a default
  conditionally_filter: {
    filters: [orders.created_date: "30 days"]
    unless: [orders.count]
  }

  # Access control at the Explore level, separate from row-level access_filter
  required_access_grants: [can_view_orders_explore]
}

# extends: build a specialized explore from a shared base without duplicating every join
explore: orders_finance_view {
  extends: [orders]
  join: refunds {
    sql_on: ${orders.id} = ${refunds.order_id} ;;
    relationship: one_to_many
  }
}
```

## 📚 Worked Examples Across Business Scenarios {#worked-examples-across-business-scenarios-looker}

### 1. Building a Customer Lifetime Value Explore Without Fan-Out Bugs

**Scenario:** Business users need a self-serve Explore joining Customers to Orders, where summing "Customer Lifetime Value" must NOT be inflated by the number of orders each customer has.

```lookml
view: customers {
  dimension: id { primary_key: yes type: number sql: ${TABLE}.id ;; }
  measure: total_lifetime_value {
    type: sum
    sql: ${TABLE}.lifetime_value ;;   # a pre-computed per-customer value living on the customers table itself
  }
}

explore: customers {
  join: orders {
    sql_on: ${customers.id} = ${orders.customer_id} ;;
    relationship: one_to_many        # correctly declared — Looker applies symmetric aggregates automatically
  }
}
```

```text
Because customers.id is declared as a clean primary_key, total_lifetime_value stays correct even when
a user adds orders.status to the Explore (which would fan out the join) — Looker's symmetric aggregate
logic protects the customer-level sum. Getting relationship: one_to_many wrong (or omitting the
primary_key) is exactly the scenario this protects against.
```

### 2. A Governed Self-Serve Revenue Explore with Guardrails

**Scenario:** Give analysts flexibility to explore revenue data, but prevent accidental full-table scans and PII exposure.

```lookml
explore: orders {
  label: "Revenue Analysis"
  always_filter: {
    filters: [orders.created_date: "90 days"]   # prevents a query against years of unfiltered raw data
  }
  fields: [ALL_FIELDS*, -customers.email, -customers.phone_number]   # hide PII from this Explore specifically
  join: customers {
    sql_on: ${orders.customer_id} = ${customers.id} ;;
    relationship: many_to_one
  }
}
```

### 3. A Persistent Derived Table for a Daily Executive Rollup

**Scenario:** An executive dashboard queries a heavy daily aggregation dozens of times a day; recomputing it live every time is wasteful.

```lookml
view: daily_revenue_rollup {
  derived_table: {
    sql:
      SELECT
        DATE(created_at) AS order_date,
        region,
        SUM(amount) AS total_revenue,
        COUNT(DISTINCT customer_id) AS unique_customers
      FROM analytics.orders
      GROUP BY 1, 2 ;;
    datagroup_trigger: daily_etl_datagroup
  }
  dimension: order_date { type: date sql: ${TABLE}.order_date ;; }
  dimension: region { type: string sql: ${TABLE}.region ;; }
  measure: total_revenue { type: sum sql: ${TABLE}.total_revenue ;; }
}
```

```lookml
# In the model file
datagroup: daily_etl_datagroup {
  sql_trigger: SELECT MAX(loaded_at) FROM analytics.etl_run_log WHERE table_name = 'orders' ;;
  max_cache_age: "25 hours"
}
```

```text
The PDT rebuilds only when the trigger query's result changes (i.e., when the nightly ETL actually
loads new order data) — not on a fixed timer, avoiding both stale dashboards and unnecessary rebuilds.
```

### 4. Row-Level Security for a Multi-Tenant SaaS Analytics Product

**Scenario:** Each customer of a SaaS product should only see their own account's data when viewing embedded Looker dashboards.

```lookml
explore: usage_events {
  access_filter: {
    field: accounts.account_id
    user_attribute: embed_account_id     # set per-session via SSO-embedded user attributes at login time
  }
}
```

```text
The embedding application passes embed_account_id as a signed user attribute in the SSO embed URL/JWT —
Looker applies it as a WHERE clause on every query against this Explore automatically, so the same
LookML project safely serves every tenant without per-tenant duplication.
```

### 5. Catching a Breaking Change Before It Ships (CI + Content Validator)

**Scenario:** A developer renames a column in the underlying warehouse table; the team wants this caught before it breaks 40 downstream dashboards.

```lookml
# A LookML data test guards the specific business logic that matters most
test: revenue_never_negative {
  explore_source: orders {
    column: total_revenue { field: orders.total_revenue }
  }
  assert: revenue_is_non_negative {
    expression: ${total_revenue} >= 0 ;;
  }
}
```

```text
Workflow: the renamed column breaks orders.view.lkml's sql: reference → `looker validate` fails in CI on
the pull request → the PR is blocked from merging until the LookML is updated to match the new column
name → Content Validator is run post-deploy as a second safety net to confirm no dashboard is left
pointing at a now-broken field.
```
