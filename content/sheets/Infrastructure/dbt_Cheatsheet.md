# dbt (data build tool) — Complete Reference Cheatsheet

> A structured, documented dbt reference for the transformation layer of a modern ELT stack: project structure, models, tests, snapshots, incremental builds, Jinja/macros, governance, and the CLI commands you'll run day to day. Each section explains **what it is**, **when to use it**, and **how it's written**, not just the syntax.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concepts](#core-concepts)
3. [🚀 Project Setup & Structure](#project-setup-structure)
4. [💻 CLI Commands](#cli-commands)
5. [🎯 Model Selection Syntax](#model-selection-syntax)
6. [🏗️ Models & Materializations](#models-materializations)
7. [🔗 ref() & source()](#ref-source)
8. [📥 Sources](#sources)
9. [🌱 Seeds](#seeds)
10. [📸 Snapshots (SCD Type 2)](#snapshots-scd-type-2)
11. [✅ Tests](#tests)
12. [🧪 Unit Tests](#unit-tests)
13. [🪄 Jinja & Macros](#jinja-macros)
14. [⏱️ Incremental Models](#incremental-models)
15. [📦 Packages](#packages)
16. [📚 Documentation](#documentation)
17. [🛡️ Model Governance (Contracts, Versions, Groups, Access)](#model-governance)
18. [🌍 Environments, Profiles & Targets](#environments-profiles-targets)
19. [🔧 Variables](#variables)
20. [🪝 Hooks & Operations](#hooks-operations)
21. [📡 Exposures](#exposures)
22. [🔀 State Comparison, Defer & Slim CI](#state-comparison-defer-slim-ci)
23. [📏 Naming & Style Conventions](#naming-style-conventions)
24. [🐍 Python Models](#python-models)
25. [⚡ Performance & Materialization Strategy](#performance-materialization-strategy)
26. [🐞 Debugging & Logging](#debugging-logging)
27. [⚠️ Common Gotchas](#common-gotchas)

---

## ⚡ Quick Reference

**CLI commands**

| Command                                | Purpose                                                           |
| -------------------------------------- | ----------------------------------------------------------------- |
| `dbt debug`                            | Test the warehouse connection and config                          |
| `dbt deps`                             | Install packages listed in `packages.yml`                         |
| `dbt seed`                             | Load CSVs in `seeds/` as tables                                   |
| `dbt run`                              | Build models (compile + execute), skips tests                     |
| `dbt test`                             | Run schema + custom tests                                         |
| `dbt build`                            | Run models, tests, seeds, and snapshots together in DAG order     |
| `dbt snapshot`                         | Execute snapshot definitions                                      |
| `dbt compile`                          | Render Jinja to raw SQL without executing                         |
| `dbt docs generate` / `dbt docs serve` | Build / serve the documentation site                              |
| `dbt clean`                            | Remove `target/` and `dbt_packages/`                              |
| `dbt run-operation <macro>`            | Call a macro directly, outside a model                            |
| `dbt ls`                               | List resources matching a selector                                |
| `dbt source freshness`                 | Check configured source freshness thresholds                      |
| `dbt init`                             | Scaffold a new dbt project interactively                          |
| `dbt parse`                            | Parse the project and write the manifest without running anything |
| `dbt retry`                            | Re-run only the nodes that failed in the previous invocation      |

**Model selection syntax**

| Syntax                   | Meaning                                          |
| ------------------------ | ------------------------------------------------ |
| `-s model_name`          | Just that model                                  |
| `-s +model_name`         | The model and everything upstream of it          |
| `-s model_name+`         | The model and everything downstream of it        |
| `-s +model_name+`        | The model plus all ancestors and descendants     |
| `-s tag:nightly`         | Everything tagged `nightly`                      |
| `-s path:models/staging` | Everything under a folder                        |
| `-s source:raw+`         | Everything downstream of a source                |
| `--exclude model_c`      | Selection minus `model_c`                        |
| `-s 1+stg_orders`        | Only 1 level upstream (depth-limited)            |
| `-s state:modified+`     | Modified nodes + downstream (requires `--state`) |

**Materializations**

| Materialization     | Behavior                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `view` (default)    | A SQL view — no data stored, always fresh                                                  |
| `table`             | A full physical table, rebuilt every run                                                   |
| `incremental`       | Appends/merges only new or changed rows                                                    |
| `ephemeral`         | Not a database object — inlined as a CTE wherever it's `ref()`'d                           |
| `materialized_view` | A warehouse-native materialized view (adapter-dependent, e.g. Snowflake/Postgres/BigQuery) |

---

## 🧠 Core Concepts

dbt is the **T** in ELT — it doesn't extract or load data (that's handled upstream, e.g. by Fivetran/Airbyte or a custom ingestion job). It transforms data that's already sitting in your warehouse using SQL plus a thin layer of Jinja templating. You write `select` statements in `.sql` files; dbt wraps each one in a `create view/table as` and figures out the run order automatically from `ref()`/`source()` calls, building a **DAG** (directed acyclic graph).

**Why this matters in practice:** because dependency order comes entirely from `ref()`/`source()` calls rather than manual sequencing, you never write "run A, then B, then C" — dbt derives that from the SQL itself. This is also what makes selective builds (`-s +fct_sales`), parallel execution (`--threads`), and lineage graphs in `dbt docs` possible.

A common layering convention:

```
sources (raw, untouched)
   → staging      (1:1 with source tables, light cleaning/renaming, mostly views)
   → intermediate (business logic, joins — often ephemeral)
   → marts        (final consumption-ready facts & dimensions, tables)
```

- **Staging**: one model per source table. Renames columns to a consistent convention, casts types, and does _no_ joining or business logic. This is the only layer allowed to reference `source()`.
- **Intermediate**: where joins, business logic, and reusable building blocks live. Often `ephemeral` because they're only consumed by one or two marts and don't need their own table.
- **Marts**: wide, denormalized, analytics-ready tables — typically modeled as facts (events/transactions, e.g. `fct_orders`) and dimensions (entities, e.g. `dim_customer`).

Some teams add a Data Vault–style **integration** layer (hubs, satellites, links) between staging and marts for auditability and historized joins before rolling up into marts. Either pattern works — dbt doesn't enforce a layout, it just needs `ref()`/`source()` to know the dependency order.

**Compilation vs. execution:** dbt always compiles Jinja → raw SQL first (viewable in `target/compiled/`), then executes that SQL against the warehouse. `dbt compile` stops after step one, which makes it the go-to tool for debugging what a model _actually_ sends to the database.

---

## 🚀 Project Setup & Structure

```
my_dbt_project/
├── dbt_project.yml          # project-level config
├── packages.yml             # package dependencies
├── profiles.yml             # connection info (usually ~/.dbt/, NOT committed to the repo)
├── models/
│   ├── staging/
│   │   ├── stg_orders.sql
│   │   └── _staging__schema.yml
│   ├── intermediate/
│   └── marts/
│       ├── dim_customer.sql
│       └── fct_sales.sql
├── seeds/
│   └── country_codes.csv
├── snapshots/
│   └── customers_snapshot.sql
├── macros/
│   └── cents_to_dollars.sql
├── tests/
│   └── assert_positive_amounts.sql
└── analyses/
```

- `analyses/` — `.sql` files that are compiled (Jinja rendered) but never run/materialized. Handy for one-off ad hoc queries you still want version-controlled and ref()-aware.
- `dbt_packages/` (not shown) — where `dbt deps` installs packages; git-ignored.
- `target/` (not shown) — build artifacts: compiled SQL, run results, the `manifest.json`. Also git-ignored.

```yaml
# dbt_project.yml
name: "schi_platform"
version: "1.0.0"
config-version: 2

profile: "schi_platform"

model-paths: ["models"]
seed-paths: ["seeds"]
snapshot-paths: ["snapshots"]
macro-paths: ["macros"]
test-paths: ["tests"]
analysis-paths: ["analyses"]
clean-targets: ["target", "dbt_packages"]

models:
  schi_platform:
    staging:
      +materialized: view
      +schema: staging
    intermediate:
      +materialized: ephemeral
    marts:
      +materialized: table
      +schema: marts
```

Field-by-field notes:

- `profile` links the project to a named block in `profiles.yml` — this is how one project can be pointed at different warehouses on different machines.
- `models:` config uses a nested structure that mirrors your `models/` folder tree; anything set at a folder level cascades down to every model inside it unless overridden closer to the model.
- `+` prefix (`+materialized`, `+schema`, `+tags`) marks a config key when set at the project or folder level (as opposed to inside a model's own `config()` block, where the `+` is dropped).

```yaml
# profiles.yml (Snowflake example)
schi_platform:
  target: dev
  outputs:
    dev:
      type: snowflake
      account: xy12345.us-east-1
      user: "{{ env_var('DBT_USER') }}"
      password: "{{ env_var('DBT_PASSWORD') }}"
      role: TRANSFORMER
      database: DEV_DB
      warehouse: DEV_WH
      schema: dbt_yourname
      threads: 4
    prod:
      type: snowflake
      account: xy12345.us-east-1
      user: "{{ env_var('DBT_USER') }}"
      password: "{{ env_var('DBT_PASSWORD') }}"
      role: TRANSFORMER
      database: PROD_DB
      warehouse: PROD_WH
      schema: analytics
      threads: 8
```

- `profiles.yml` holds **credentials and connection info** and is environment-specific — it should never be committed to version control. `dbt_project.yml` holds **project logic** and is committed.
- `threads` controls how many models dbt builds in parallel (as long as the DAG allows it); raising it speeds up runs but increases warehouse concurrency load.
- Always reference secrets via `env_var()` rather than hardcoding them, so the same file works across machines/CI without leaking credentials.

---

## 💻 CLI Commands

```bash
dbt debug                        # verify connection + config
dbt deps                         # install packages.yml dependencies

dbt seed                         # load all seeds/*.csv
dbt seed -s country_codes        # load just one seed

dbt run                          # build all models
dbt run -s stg_orders            # build a single model
dbt run -s +fct_sales            # build fct_sales and everything upstream of it
dbt run -s staging.*             # build everything under the staging folder

dbt test                         # run all schema + custom tests
dbt test -s stg_orders           # test a single model

dbt build                        # run + test + seed + snapshot together, in DAG order
                                  # (the recommended single command for CI)

dbt snapshot                     # execute snapshots
dbt compile                      # render Jinja to raw SQL without running it
dbt docs generate                # build the documentation catalog
dbt docs serve                   # serve docs locally (default port 8080)
dbt clean                        # remove target/ and dbt_packages/

dbt run-operation grant_select --args '{schema: marts}'   # call a macro directly
dbt ls -s marts.*                                          # list matching resources
dbt source freshness                                       # check source freshness

dbt run --full-refresh -s fct_sales               # rebuild an incremental model from scratch
dbt run --vars '{"start_date": "2024-01-01"}'      # pass a runtime variable
dbt run --target prod                              # run against a different profiles.yml target
```

**Useful global flags** (work with most commands):

| Flag                     | Effect                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `--select` / `-s`        | Choose which nodes to operate on (see selection syntax below)                                                      |
| `--exclude`              | Remove nodes from the selection                                                                                    |
| `--full-refresh`         | Rebuild an incremental model (or all selected) from scratch                                                        |
| `--fail-fast`            | Stop the run immediately on the first failure instead of continuing the DAG                                        |
| `--threads N`            | Override the profile's thread count for this invocation                                                            |
| `--vars '{...}'`         | Pass runtime variables as JSON/YAML                                                                                |
| `--target`               | Use a different `profiles.yml` target                                                                              |
| `--defer --state <path>` | Resolve unselected `ref()`s against a previous run's manifest (see Slim CI)                                        |
| `--empty`                | Build models against zero-row limited inputs — fast way to validate SQL compiles/runs without processing real data |
| `-q` / `--quiet`         | Suppress most log output, useful in scripts                                                                        |

---

## 🎯 Model Selection Syntax

```bash
dbt run -s +fct_sales+                                     # fct_sales, its parents, and its children
dbt run -s tag:nightly,+config.materialized:incremental    # intersection (comma = AND)
dbt run -s tag:nightly --exclude tag:deprecated             # union minus exclude
dbt run -s 1+stg_orders                                      # only 1 level upstream (depth-limited)
dbt run -s stg_orders+2                                       # only 2 levels downstream
dbt run -s source:raw+                                        # everything downstream of a source
dbt run -s state:modified+ --state ./prod-manifest             # modified models + downstream (CI slim runs)
```

Selection is built from **graph operators** (`+`, depth numbers, `@`) combined with **selection methods** (`tag:`, `path:`, `source:`, `config.`, `test_type:`, `test_name:`, `exposure:`, `group:`, `resource_type:`). A few more worth knowing:

```bash
dbt run -s exposure:streamlit_dashboard+     # models feeding a documented exposure, and anything downstream
dbt run -s @fct_sales                        # fct_sales, its ancestors, AND the ancestors' other descendants
dbt ls -s config.materialized:view           # anything configured as a view
dbt run -s result:error --state ./prev_run   # re-select nodes that errored in a previous invocation
```

- Comma (`,`) between selectors = **intersection** (AND). Space between `-s` arguments = **union** (OR).
- `--exclude` is always applied last, after the union/intersection of `--select`.
- `dbt ls` is the safest way to _preview_ what a selector matches before running `dbt run`/`dbt build` with it — it just prints the node list.

---

## 🏗️ Models & Materializations

```sql
-- models/marts/fct_sales.sql
{{
  config(
    materialized='table',
    schema='marts',
    tags=['nightly']
  )
}}

select
    o.order_id,
    o.customer_id,
    o.order_date,
    o.amount
from {{ ref('stg_orders') }} o
where o.amount > 0
```

```sql
-- view (default) — cheap, always fresh, no storage
{{ config(materialized='view') }}

-- table — full rebuild every run
{{ config(materialized='table') }}

-- incremental — only new/changed rows processed after the first run
{{ config(materialized='incremental', unique_key='order_id') }}

-- ephemeral — no DB object; inlined as a CTE wherever it's ref()'d
{{ config(materialized='ephemeral') }}

-- materialized_view — warehouse-native, adapter must support it
{{ config(materialized='materialized_view') }}
```

**Choosing between them:**

| Situation                                                        | Materialization     |
| ---------------------------------------------------------------- | ------------------- |
| Small model, queried infrequently, always needs latest data      | `view`              |
| Intermediate logic used by only 1–2 downstream models            | `ephemeral`         |
| Model queried often by BI tools, moderate row count              | `table`             |
| Large, append-heavy fact table (millions+ rows)                  | `incremental`       |
| Warehouse-native auto-refreshing view (adapter support required) | `materialized_view` |

You can also write **custom materializations** as macros (`{% materialization my_mat, adapter='snowflake' %}`) if none of the built-ins fit — rare, but useful for things like `create or replace table ... clone` patterns.

---

## 🔗 ref() & source()

```sql
-- ref(): reference another dbt model. dbt resolves the real schema/database
-- for the current target AND builds the DAG edge automatically.
select * from {{ ref('stg_customers') }}

-- ref() into another installed package
select * from {{ ref('package_name', 'model_name') }}

-- ref() a specific model version (see Model Governance)
select * from {{ ref('dim_customer', version=2) }}

-- source(): reference a raw table that dbt does NOT build, defined in a sources.yml
select * from {{ source('raw', 'orders') }}
```

```yaml
# models/staging/_staging__sources.yml
version: 2

sources:
  - name: raw
    database: RAW_DB
    schema: RAW_SCHEMA
    tables:
      - name: orders
        loaded_at_field: _loaded_at
        freshness:
          warn_after: { count: 12, period: hour }
          error_after: { count: 24, period: hour }
      - name: customers
```

`ref()` is what turns a folder of SQL files into a DAG: dbt parses every `ref()`/`source()` call at compile time to build the dependency graph, then topologically sorts it before running anything. This is also why you should never string-concatenate a model name inside `ref()` — dbt needs to statically detect it during parsing.

---

## 📥 Sources

```bash
dbt source freshness              # check freshness for all configured sources
dbt source freshness -s raw.orders  # check a single source table
```

Always build staging models on top of `source()`, never a hardcoded raw table name — that's what lets `dbt source freshness` and lineage graphs track the raw layer correctly. It also means if the raw table ever moves to a new database/schema, you update it in one `sources.yml` entry instead of hunting through every model.

Sources can also declare `loader` (e.g. `fivetran`, `airbyte`) and per-table `meta`/`tags`, which show up in the generated docs and can be used for selection (`-s source:raw`).

---

## 🌱 Seeds

```bash
dbt seed                       # load all seed CSVs
dbt seed -s country_codes       # load one
dbt seed --full-refresh         # drop and recreate instead of upsert
```

```yaml
# dbt_project.yml
seeds:
  schi_platform:
    country_codes:
      +column_types:
        code: varchar(2)
```

```sql
-- referenced exactly like a model once loaded
select * from {{ ref('country_codes') }}
```

Seeds are for small, mostly-static reference data (country codes, status mappings) — not for loading real source/transactional data, which belongs in your ingestion pipeline, not dbt. As a rough guideline: if a CSV would need updating more than occasionally, or has more than a few hundred rows, it probably shouldn't be a seed.

---

## 📸 Snapshots (SCD Type 2)

```sql
-- snapshots/customers_snapshot.sql
{% snapshot customers_snapshot %}

{{
    config(
      target_schema='snapshots',
      unique_key='customer_id',
      strategy='timestamp',
      updated_at='updated_at',
      invalidate_hard_deletes=True,
    )
}}

select * from {{ source('raw', 'customers') }}

{% endsnapshot %}
```

A snapshot exists to solve one problem: your source table only shows the _current_ state of a row, but you need to know what it looked like historically (e.g. "what tier was this customer on last March?"). Snapshots run on a schedule and record each detected change as a new row, turning a mutable source table into an immutable, queryable history.

Two strategies:

```sql
-- timestamp strategy: relies on a reliable updated_at column
strategy='timestamp',
updated_at='updated_at',

-- check strategy: compares specific columns row-by-row (use when there's no reliable timestamp)
strategy='check',
check_cols=['status', 'email'],   -- or check_cols='all'
```

- `invalidate_hard_deletes=True` closes out (`dbt_valid_to`) the record for rows that disappear from the source entirely, rather than leaving them looking "still current" forever.
- Use `check_cols='all'` cautiously — it flags a new row on _any_ column change, including ones you may not care about tracking history for (e.g. an internal `updated_at` bumping with no real business change).

dbt automatically adds `dbt_valid_from`, `dbt_valid_to`, `dbt_scd_id`, and `dbt_updated_at` to track history. To query only the **current** state of each entity:

```sql
select * from {{ ref('customers_snapshot') }}
where dbt_valid_to is null
```

---

## ✅ Tests

Tests are just SQL queries that should return zero rows; if they return rows, the test fails. This makes them fully composable with the rest of dbt (they compile with Jinja, run in the DAG, and can be `ref()`-aware).

**Generic (schema) tests** — applied via YAML, reusable across any column:

```yaml
version: 2

models:
  - name: fct_sales
    columns:
      - name: order_id
        tests:
          - unique
          - not_null
      - name: status
        tests:
          - accepted_values:
              values: ["pending", "shipped", "cancelled"]
      - name: customer_id
        tests:
          - relationships:
              to: ref('dim_customer')
              field: customer_id
```

**Custom singular test** — a one-off query that should return zero rows:

```sql
-- tests/assert_positive_amounts.sql
select *
from {{ ref('fct_sales') }}
where amount < 0
```

**Custom generic test** — reusable, parameterized (write once, apply to any model/column):

```sql
-- macros/test_is_even.sql
{% test is_even(model, column_name) %}
select {{ column_name }}
from {{ model }}
where {{ column_name }} % 2 != 0
{% endtest %}
```

```yaml
columns:
  - name: quantity
    tests:
      - is_even
```

**From packages** (dbt-utils / dbt-expectations):

```yaml
tests:
  - dbt_utils.expression_is_true:
      expression: "amount >= 0"
  - dbt_expectations.expect_column_values_to_be_between:
      min_value: 0
      max_value: 1000000
```

**Test configuration** — controlling severity and failure inspection:

```yaml
columns:
  - name: email
    tests:
      - not_null:
          config:
            severity: warn # 'warn' logs but doesn't fail the run; default is 'error'
            error_if: ">10" # only error if more than 10 failing rows
            warn_if: ">0"
            store_failures: true # persist failing rows to a table for inspection
```

`store_failures: true` is especially useful during development on a large model — instead of just knowing a test failed, you get an actual table of the offending rows to query.

---

## 🧪 Unit Tests

Unit tests are different from the schema/custom tests above: instead of validating a model's _real_ output, they validate its **logic** against small, hand-crafted mock inputs — closer to what "unit test" means in software engineering. They're most valuable for models with non-trivial `case when` logic, complex joins, or business rules you want to lock in before refactoring.

```yaml
# models/marts/_marts__unit_tests.yml
unit_tests:
  - name: test_discount_logic
    model: fct_sales
    given:
      - input: ref('stg_orders')
        rows:
          - { order_id: 1, amount: 100, customer_tier: "gold" }
          - { order_id: 2, amount: 100, customer_tier: "standard" }
    expect:
      rows:
        - { order_id: 1, amount: 100, discount_pct: 0.10 }
        - { order_id: 2, amount: 100, discount_pct: 0.00 }
```

- `given` supplies fake rows in place of a real `ref()`/`source()`, so the test runs fast and doesn't depend on warehouse data.
- `expect` is the exact output you assert the model produces from those inputs.
- Run with the same commands as any other test: `dbt test -s test_discount_logic` or as part of `dbt build`.
- Unit tests are a newer addition to dbt (introduced in dbt Core 1.8) — check your dbt version supports the `unit_tests:` YAML key before relying on it.

---

## 🪄 Jinja & Macros

```sql
-- conditionals
{% if target.name == 'prod' %}
    select * from {{ ref('fct_sales') }}
{% else %}
    select * from {{ ref('fct_sales') }} limit 1000
{% endif %}

-- loops
{% for status in ['pending', 'shipped', 'cancelled'] %}
    select '{{ status }}' as status
    {% if not loop.last %} union all {% endif %}
{% endfor %}
```

```sql
-- macros/cents_to_dollars.sql
{% macro cents_to_dollars(column_name) %}
    ({{ column_name }} / 100.0)
{% endmacro %}
```

```sql
-- usage
select {{ cents_to_dollars('amount_cents') }} as amount_dollars
from {{ ref('stg_orders') }}
```

**Whitespace control:** a `-` at the start or end of a Jinja tag (`{%- ... -%}`) trims surrounding whitespace/newlines in the compiled SQL. Handy for keeping compiled output readable when using loops or conditionals inline.

```sql
{%- for status in statuses -%}
  '{{ status }}'{% if not loop.last %}, {% endif %}
{%- endfor -%}
```

**Setting variables inside Jinja** with `{% set %}`, useful for computing something once and reusing it:

```sql
{% set payment_methods = ['credit_card', 'paypal', 'bank_transfer'] %}

select
  {% for method in payment_methods %}
  sum(case when payment_method = '{{ method }}' then amount end) as {{ method }}_total
  {%- if not loop.last %},{% endif %}
  {% endfor %}
from {{ ref('stg_payments') }}
```

**Handy `dbt_utils` macros:**

```sql
{{ dbt_utils.generate_surrogate_key(['customer_id', 'subsidiary_code']) }}
{{ dbt_utils.date_spine(datepart="day", start_date="'2020-01-01'", end_date="current_date") }}
{{ dbt_utils.star(from=ref('stg_orders'), except=['_loaded_at']) }}
{{ dbt_utils.union_relations(relations=[ref('stg_sub_a_orders'), ref('stg_sub_b_orders')]) }}
{{ dbt_utils.pivot('status', dbt_utils.get_column_values(ref('stg_orders'), 'status')) }}
{{ dbt_utils.deduplicate(relation=ref('stg_customers'), partition_by='customer_id', order_by='updated_at desc') }}
```

`union_relations` in particular is the standard way to conform several source-specific staging models (e.g. one per subsidiary) into a single hub-style model, instead of hand-writing a `union all` chain. `generate_surrogate_key` is the standard way to build a stable hashed primary key from a combination of natural-key columns, especially useful in fact tables with composite grains.

---

## ⏱️ Incremental Models

```sql
{{
    config(
        materialized='incremental',
        unique_key='order_id',
        incremental_strategy='merge',
        on_schema_change='append_new_columns'
    )
}}

select *
from {{ source('raw', 'orders') }}

{% if is_incremental() %}
    where _loaded_at > (select max(_loaded_at) from {{ this }})
{% endif %}
```

- `{{ this }}` — the current model's own compiled table reference; used here to look up its own high-water mark.
- `is_incremental()` — `True` only when the model already exists as a table AND you're not running with `--full-refresh`.
- `incremental_strategy` options: `merge` (common default on Snowflake/BigQuery), `delete+insert`, `append`, `insert_overwrite` (rebuilds whole partitions — common on BigQuery with partitioned tables).
- `on_schema_change`: `ignore` (default), `fail`, `append_new_columns`, or `sync_all_columns` — controls what happens when the model's column set changes between runs.

**A common safety pattern** — widen the incremental window slightly to catch late-arriving/updated rows instead of a strict `>`:

```sql
{% if is_incremental() %}
    where _loaded_at >= (select coalesce(max(_loaded_at), '1900-01-01') from {{ this }}) - interval '3 days'
{% endif %}
```

**BigQuery `insert_overwrite` with partitions:**

```sql
{{
    config(
        materialized='incremental',
        incremental_strategy='insert_overwrite',
        partition_by={'field': 'order_date', 'data_type': 'date'}
    )
}}
```

---

## 📦 Packages

```yaml
# packages.yml
packages:
  - package: dbt-labs/dbt_utils
    version: [">=1.0.0", "<2.0.0"]
  - package: calogica/dbt_expectations
    version: [">=0.10.0", "<0.11.0"]
  - git: "https://github.com/some-org/internal-dbt-package.git"
    revision: main
```

```bash
dbt deps   # installs into dbt_packages/ (git-ignored, not committed)
```

Popular packages worth knowing beyond `dbt_utils`:

- **`dbt_expectations`** — Great Expectations–style assertions (`expect_column_values_to_be_between`, `expect_table_row_count_to_equal`, etc.).
- **`codegen`** — generates boilerplate YAML/SQL, e.g. `dbt run-operation generate_source` from an existing raw schema.
- **`audit_helper`** — compares two relations row-by-row/column-by-column, useful when migrating logic and validating the new model matches the old one.

Pin version ranges rather than exact versions where reasonable, but always pin _something_ — an unpinned package can silently change behavior on the next `dbt deps`.

---

## 📚 Documentation

```yaml
# models/staging/_staging__schema.yml
models:
  - name: stg_orders
    description: "One row per order, lightly cleaned from the raw orders source."
    columns:
      - name: order_id
        description: "Primary key."
        tests: [unique, not_null]
```

```sql
{# reusable doc blocks #}
{% docs order_status %}
Possible values: pending, shipped, cancelled.
{% enddocs %}
```

```yaml
- name: status
  description: "{{ doc('order_status') }}"
```

```bash
dbt docs generate   # builds the catalog (reads warehouse metadata + your descriptions)
dbt docs serve       # serves an interactive lineage graph + column docs locally
```

`meta` fields let you attach arbitrary metadata (owner, PII flags, data classification) to models/columns, which then surfaces in the generated docs site and can be read by macros at compile time:

```yaml
models:
  - name: dim_customer
    meta:
      owner: "data-team@example.com"
      contains_pii: true
```

`persist_docs` (set in `config()` or `dbt_project.yml`) pushes model/column `description`s into the warehouse's own comment/metadata system (e.g. Snowflake `COMMENT`), so they're visible to anyone querying the table directly, not just people who open `dbt docs`.

---

## 🛡️ Model Governance

_(Contracts, Versions, Groups, Access — for larger teams enforcing stability on shared models)_

**Model contracts** enforce a model's column names, data types, and constraints at build time — if the actual query output doesn't match the declared contract, the run fails instead of silently shipping a schema change downstream.

```yaml
models:
  - name: dim_customer
    config:
      contract:
        enforced: true
    columns:
      - name: customer_id
        data_type: int
        constraints:
          - type: not_null
          - type: primary_key
      - name: email
        data_type: varchar
```

**Model versions** let you evolve a widely-consumed model's contract without breaking every downstream consumer immediately — old and new versions can coexist while consumers migrate on their own schedule.

```yaml
models:
  - name: dim_customer
    latest_version: 2
    versions:
      - v: 1
        defined_in: dim_customer_v1
      - v: 2
```

```sql
-- a downstream model can pin to a specific version:
select * from {{ ref('dim_customer', version=1) }}
```

**Groups & access modifiers** restrict which models can `ref()` a given model — useful for enforcing that only the marts layer, not every random downstream model, can build directly on a sensitive intermediate model.

```yaml
models:
  - name: int_customer_orders_joined
    config:
      group: finance
      access: private # 'private' | 'protected' | 'public'
```

- `private` — only referenceable by models in the same group.
- `protected` (the default) — referenceable anywhere in the same project, but not from other projects.
- `public` — referenceable from anywhere, including other dbt projects (relevant to multi-project setups, sometimes called "dbt Mesh").

---

## 🌍 Environments, Profiles & Targets

```bash
dbt run --target prod            # switch to a different target block in profiles.yml
dbt run --profiles-dir ./         # point at a custom profiles.yml location
```

Inside Jinja, you can branch on the active target:

```sql
{{ target.name }}      {# 'dev', 'prod', etc. #}
{{ target.database }}
{{ target.schema }}
```

A common use is limiting expensive queries outside of prod during development:

```sql
select * from {{ ref('fct_sales') }}
{% if target.name != 'prod' %}
limit 1000
{% endif %}
```

---

## 🔧 Variables

```yaml
# dbt_project.yml
vars:
  start_date: "2020-01-01"
```

```bash
dbt run --vars '{"start_date": "2024-01-01"}'   # overrides the project default at runtime
```

```sql
select * from {{ ref('stg_orders') }}
where order_date >= '{{ var("start_date") }}'
```

`var()` accepts a second argument as a default, so a model doesn't hard-fail if the variable was never defined anywhere:

```sql
{{ var("start_date", "2000-01-01") }}
```

Precedence, highest to lowest: `--vars` on the CLI → `vars:` in `dbt_project.yml` → the default passed into `var()` in the model itself.

---

## 🪝 Hooks & Operations

```sql
{{
    config(
        pre_hook="delete from {{ this }} where order_date < '2020-01-01'",
        post_hook="grant select on {{ this }} to role reporting_role"
    )
}}
```

```yaml
# dbt_project.yml — project-wide hooks
on-run-start:
  - "create schema if not exists {{ target.schema }}_audit"
on-run-end:
  - "{{ log('Run finished', info=True) }}"
```

```bash
dbt run-operation grant_select --args '{schema: marts, role: reporting_role}'
```

- `pre_hook`/`post_hook` run relative to a **single model's** build (before/after its `create` statement).
- `on-run-start`/`on-run-end` run once per **whole invocation**, regardless of how many models are selected.
- `run-operation` is the standard way to invoke a macro for side effects (grants, schema creation, cleanup) outside of the normal model-building flow — often used in CI/CD pipelines.

---

## 📡 Exposures

Document downstream consumers of your models (dashboards, ML notebooks, reverse-ETL syncs) so they show up in the lineage graph and `dbt docs`:

```yaml
exposures:
  - name: streamlit_dashboard
    type: dashboard
    maturity: high
    url: https://internal.example.com/dashboard
    depends_on:
      - ref('fct_sales')
      - ref('dim_customer')
    owner:
      name: Data Team
      email: data@example.com
```

Exposures make impact analysis concrete: before changing `fct_sales`, run `dbt ls -s fct_sales+` (or filter to `exposure:`) to see exactly which dashboards and downstream consumers would be affected, instead of guessing.

---

## 🔀 State Comparison, Defer & Slim CI

For large projects, rebuilding and testing _every_ model on every pull request is slow and expensive. dbt's **state** comparison lets you build only what actually changed.

```bash
# generate a manifest from the last successful prod run first, then:
dbt build -s state:modified+ --state ./prod-manifest --defer
```

- `--state <path>` points at a previous `manifest.json` (usually from the last successful prod run) to diff against.
- `state:modified` selects only models whose SQL, config, or YAML actually changed since that manifest.
- `--defer` lets unselected upstream models resolve their `ref()`s against the **production** tables instead of requiring you to rebuild your entire DAG in a throwaway CI schema — so a PR that only touches `fct_sales` doesn't need to also rebuild every staging model it depends on.

This combination ("Slim CI") is the standard pattern for keeping CI fast as a project grows: build/test only what changed, but let it safely reference the rest of the DAG as it already exists in prod.

---

## 📏 Naming & Style Conventions

Not enforced by dbt itself, but near-universal community convention:

| Prefix           | Meaning                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------- |
| `stg_`           | Staging model, 1:1 with a source table                                                  |
| `int_`           | Intermediate model, business logic / joins                                              |
| `fct_`           | Fact table (events, transactions — one row per event)                                   |
| `dim_`           | Dimension table (entities — one row per customer, product, etc.)                        |
| `rpt_` / `mart_` | Reporting-ready, consumption-layer table (sometimes used instead of bare `fct_`/`dim_`) |

Other conventions worth adopting:

- One model = one `.sql` file = one `select` statement; avoid multiple `create table` statements in one file.
- CTEs at the top of a model should mirror `ref()`/`source()` calls one-to-one, with a final `select` at the bottom — keeps long models scannable.
- Snake_case for all model, column, and macro names; avoid reserved SQL keywords as column names.
- Every model file has a sibling (or shared folder-level) `.yml` file documenting it — undocumented, untested models are easy to lose track of as a project grows.

---

## 🐍 Python Models

On adapters that support it (e.g. Snowflake with Snowpark, Databricks, BigQuery with Dataproc), dbt models can be written in Python instead of SQL — useful for logic that's awkward in SQL, like calling a Python ML library.

```python
# models/marts/customer_churn_score.py
import pandas as pd

def model(dbt, session):
    dbt.config(materialized="table")
    orders_df = dbt.ref("stg_orders").to_pandas()
    # ... feature engineering / scoring logic ...
    return orders_df
```

- Still participates in the same DAG — `dbt.ref()`/`dbt.source()` inside the `model()` function work like `ref()`/`source()` in SQL.
- Selection, testing, and documentation all work the same way as SQL models.
- Python models are the exception, not the default — most transformation logic is still better expressed (and more portable) in SQL.

---

## ⚡ Performance & Materialization Strategy

| Layer                     | Typical materialization | Why                                                    |
| ------------------------- | ----------------------- | ------------------------------------------------------ |
| Staging                   | `view`                  | Cheap, always fresh, no storage cost                   |
| Intermediate              | `ephemeral` or `view`   | Usually only referenced once or twice downstream       |
| Marts (small/medium)      | `table`                 | Fast reads for BI tools/dashboards                     |
| Marts (large fact tables) | `incremental`           | Avoid rebuilding millions of historical rows every run |

- Set `+materialized:` at the **folder level** in `dbt_project.yml` instead of repeating `config()` in every model.
- Use `dbt run --full-refresh` after changing an incremental model's transformation logic or its `unique_key` — the incremental filter alone won't retroactively fix already-built rows.
- `dbt build` (not `dbt run`) in CI, so a broken test fails the pipeline instead of silently shipping bad data downstream.
- Raise `threads` cautiously — more parallelism helps until you hit warehouse concurrency/queueing limits, at which point it can slow things down instead of speeding them up.
- For very wide marts, prefer `incremental` with a tight, indexed/partitioned filter column over repeatedly scanning the full history in a `table` rebuild.

---

## 🐞 Debugging & Logging

```bash
dbt compile -s fct_sales           # see the raw SQL a model actually generates
dbt run -s fct_sales --debug        # verbose logs, including full queries sent to the warehouse
dbt show -s fct_sales --limit 20    # preview a model's output without materializing it
```

```sql
-- print debug info at compile time (shows up in the CLI output)
{{ log("start_date var is: " ~ var('start_date'), info=True) }}

-- fail a run explicitly with a custom message, e.g. inside a macro guard clause
{% if var('start_date') is none %}
  {{ exceptions.raise_compiler_error("start_date must be set") }}
{% endif %}
```

- `target/compiled/<project>/models/.../fct_sales.sql` — the exact SQL dbt generated for that model, useful when a model fails and you need to see what actually ran (as opposed to the Jinja source).
- `target/run/` — the same, but for the SQL dbt actually executed (post-materialization wrapper, e.g. `create or replace table as`).
- `dbt show` is a fast way to sanity-check a model's logic without fully materializing it — especially handy while iterating on a new model.

---

## ⚠️ Common Gotchas

- **Never hardcode a `schema.table` name in a model** — always use `ref()`/`source()`, or dbt can't build the DAG and the model breaks the moment you point at a different environment.
- **Ephemeral models can't be queried directly** — they're compiled inline as CTEs into whatever references them; there's no actual table/view to `select from` in the warehouse.
- **`is_incremental()` is `False` on the very first run** — a brand-new incremental model just does a full table build; the incremental filter logic only kicks in once the table already exists.
- **Changing incremental logic doesn't retroactively fix historical rows** — you need `--full-refresh` after altering the transformation, the incremental filter, or the `unique_key`.
- **SCD2 snapshots need `dbt_valid_to is null` when joining for "current" state** — forgetting it fans out every historical row for any entity that ever changed, silently inflating every downstream aggregate. This is an easy mistake to make and a hard one to notice until the numbers look wrong.
- **`merge`-based incremental models need at most one source-side match per target key** — a join inside the model that produces duplicate rows per `unique_key` will make the run fail (or silently misbehave, depending on the adapter).
- **`dbt run` does _not_ run tests** — only `dbt build` runs models and tests together in DAG order. Relying on `dbt run` alone in CI means broken data can ship without a single test ever executing.
- **`{{ this }}` only resolves inside a model's own compiled SQL** — useful for incremental watermark lookups, not a general way to reference another model.
- **`+schema:` appends to, it doesn't replace, the target's default schema** — unless you also set `+database:` or override `generate_schema_name`, models can land somewhere other than where you expected.
- **A failing `not_null`/`unique` test doesn't stop the model from having already been built** — `dbt build` runs a model then its tests; a bad table is _already sitting in the warehouse_ by the time you see the test failure, unless you're on an adapter/config that supports transactional rollback.
- **Model contracts only catch mismatches between the declared and actual output** — they don't validate the values themselves; you still need regular tests (`not_null`, `accepted_values`, etc.) for data quality.
- **`--defer` needs a valid `--state` manifest from a real previous run** — pointing it at a stale or unrelated manifest can defer to tables that no longer match your current model definitions.
