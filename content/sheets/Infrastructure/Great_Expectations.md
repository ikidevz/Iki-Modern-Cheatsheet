# Great Expectations (GX Core) Cheatsheet

> A structured reference for GX Core — data contexts, data sources, expectations, checkpoints, and orchestration. Validated against **GX Core 1.22** (latest stable, Aug 2026; supports Python 3.10–3.13, with experimental 3.14 support via `GX_PYTHON_EXPERIMENTAL`). Two current facts worth knowing up front: Great Expectations was acquired in May 2026, **GX Cloud was discontinued June 1, 2026**, and the open-source **GX Core** (Apache-2.0) now continues under new stewardship by Fivetran — the canonical repo moved to `github.com/fivetran/great_expectations`. Everything in this sheet uses the **GX Core 1.0+ Fluent API** (Data Sources → Data Assets → Batch Definitions → Expectation Suites → Validation Definitions → Checkpoints), which fully replaced the pre-1.0 YAML/`DataContext`-config API in August 2024 — if you find a tutorial using `context.add_or_update_checkpoint(validator=...)` or `BatchRequest`, it's describing the legacy 0.x API. Note also that the automated profiler ("Data Assistants") from 0.18 was removed in 1.0 with no direct replacement as of this writing — see Section 10 for the current workaround.

## 📑 Table of Contents

1. [🧑‍💻 Complete Working Examples](#complete-working-examples)
2. [🚀 Installation & Setup](#installation-setup)
3. [🗂️ Data Context Basics](#data-context-basics)
4. [🔌 Data Sources & Data Assets](#data-sources-data-assets)
5. [📦 Batch Definitions & Batches](#batch-definitions-batches)
6. [✅ Expectations & Expectation Suites](#expectations-expectation-suites)
7. [🔗 Validation Definitions](#validation-definitions)
8. [🚦 Checkpoints & Actions](#checkpoints-actions)
9. [📊 Validation Results & Data Docs](#validation-results-data-docs)
10. [🌱 Bootstrapping Suites from Real Data](#bootstrapping-suites-from-real-data)
11. [🧩 Custom Expectations](#custom-expectations)
12. [🗄️ Working with SQL & Warehouses](#working-with-sql-warehouses)
13. [🐼 Working with Pandas & Spark DataFrames](#working-with-pandas-spark-dataframes)
14. [🔁 Orchestration (Airflow, CI/CD)](#orchestration-airflow-ci-cd)
15. [⚙️ Configuration & Project Structure](#configuration-project-structure)
16. [🔍 Testing & Debugging](#testing-debugging)
17. [🗓️ Multi-Batch Validation & Partitioned Data](#multi-batch-validation-partitioned-data)
18. [🔄 Migrating from GX 0.x to GX Core 1.x](#migrating-from-gx-0x-to-gx-core-1x)
19. [🎨 Data Docs Hosting & Sharing](#data-docs-hosting-sharing)
20. [📐 Result Format, Sampling & Performance](#result-format-sampling-performance)
21. [⚠️ Common Gotchas](#common-gotchas)
22. [🎯 Best Practices](#best-practices)
23. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

**Core workflow syntax cheatsheet**

| Step                 | Syntax                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Get/create a context | `context = gx.get_context()`                                                                                |
| Add a data source    | `context.data_sources.add_pandas(name="...")`                                                               |
| Add a data asset     | `data_source.add_dataframe_asset(name="...")`                                                               |
| Define a batch       | `data_asset.add_batch_definition_whole_dataframe(name="...")`                                               |
| Get a batch          | `batch_definition.get_batch(batch_parameters={"dataframe": df})`                                            |
| Create a suite       | `context.suites.add(gx.ExpectationSuite(name="..."))`                                                       |
| Add an expectation   | `suite.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="..."))`                        |
| Link batch + suite   | `context.validation_definitions.add(gx.ValidationDefinition(name=..., data=batch_definition, suite=suite))` |
| Create a checkpoint  | `context.checkpoints.add(gx.Checkpoint(name=..., validation_definitions=[...]))`                            |
| Run validation       | `checkpoint.run(batch_parameters={"dataframe": df})`                                                        |
| Inspect results      | `result.describe()` / `result.success`                                                                      |
| Build Data Docs      | `context.build_data_docs()`                                                                                 |

**Common Expectations by category**

| Category          | Examples                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| Nullness/presence | `ExpectColumnValuesToNotBeNull`, `ExpectColumnToExist`                                                 |
| Uniqueness        | `ExpectColumnValuesToBeUnique`, `ExpectCompoundColumnsToBeUnique`                                      |
| Range/set         | `ExpectColumnValuesToBeBetween`, `ExpectColumnValuesToBeInSet`, `ExpectColumnDistinctValuesToEqualSet` |
| Format/pattern    | `ExpectColumnValuesToMatchRegex`, `ExpectColumnValuesToMatchStrftimeFormat`                            |
| Type/schema       | `ExpectColumnValuesToBeOfType`, `ExpectTableColumnsToMatchOrderedList`                                 |
| Aggregate/stats   | `ExpectColumnMeanToBeBetween`, `ExpectColumnMedianToBeBetween`, `ExpectColumnStdevToBeBetween`         |
| Table-level       | `ExpectTableRowCountToBeBetween`, `ExpectTableRowCountToEqual`                                         |
| Multi-column      | `ExpectColumnPairValuesAToBeGreaterThanB`, `ExpectMulticolumnSumToEqual`                               |

**Built-in Checkpoint Actions**

| Action                             | Fires on                                            |
| ---------------------------------- | --------------------------------------------------- |
| `UpdateDataDocsAction`             | Every run — refreshes the HTML Data Docs site       |
| `SlackNotificationAction`          | Configurable (success/failure) — posts to a webhook |
| `EmailAction`                      | Configurable — sends an email via SMTP              |
| `PagerdutyAlertAction`             | Failure — pages an on-call rotation                 |
| `MicrosoftTeamsNotificationAction` | Configurable — posts to a Teams webhook             |

## 🧑‍💻 Complete Working Examples

Eight end-to-end examples you can copy, rename, and run. Each starts with a **Purpose** blurb so you can pick the right pattern before assembling pieces from the reference sections below. The first five cover the core validate/organize/orchestrate loop; the last three put the later sections (migration, multi-batch drift checks, and self-hosted Data Docs) into practice.

### 1. First Data Quality Check on a Pandas DataFrame (Quickstart)

**Purpose:** This is the fastest path from "I have a DataFrame" to "I know whether it's good data" — the template to reach for when learning GX or prototyping a new check. It walks the full Fluent workflow once, start to finish, with every object it touches.

```python
import pandas as pd
import great_expectations as gx

df = pd.DataFrame({
    "order_id": [1, 2, 3, 4],
    "amount": [19.99, 42.50, -5.00, 100.00],
})

context = gx.get_context()   # ephemeral, in-memory context — nothing persisted to disk

data_source = context.data_sources.add_pandas("orders_pandas")
data_asset = data_source.add_dataframe_asset(name="orders_df")
batch_definition = data_asset.add_batch_definition_whole_dataframe("orders_batch")

suite = context.suites.add(gx.ExpectationSuite(name="orders_suite"))
suite.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="order_id"))
suite.add_expectation(gx.expectations.ExpectColumnValuesToBeBetween(column="amount", min_value=0))

validation_definition = context.validation_definitions.add(
    gx.ValidationDefinition(name="orders_validation", data=batch_definition, suite=suite)
)

checkpoint = context.checkpoints.add(
    gx.Checkpoint(name="orders_checkpoint", validation_definitions=[validation_definition])
)

result = checkpoint.run(batch_parameters={"dataframe": df})
print(result.success)      # False — row 3 has a negative amount
result.describe()          # human-readable pass/fail breakdown per expectation
```

### 2. Validating a Table in a SQL Warehouse with a Reusable Suite

**Purpose:** Use this for the most common production pattern — checking a table that lands in Postgres/Snowflake/BigQuery on a schedule. Unlike the DataFrame example, the Data Source and Batch Definition here point at a live table, so the exact same Checkpoint can be re-run every day against whatever the table currently contains.

```python
import great_expectations as gx

context = gx.get_context()

data_source = context.data_sources.add_postgres(
    name="warehouse",
    connection_string="postgresql+psycopg2://etl:***@warehouse.company.com:5432/analytics",
)
table_asset = data_source.add_table_asset(name="orders_table", table_name="orders")
batch_definition = table_asset.add_batch_definition_whole_table("orders_full_table")

suite = context.suites.add(gx.ExpectationSuite(name="orders_table_suite"))
suite.add_expectation(gx.expectations.ExpectColumnValuesToBeUnique(column="order_id"))
suite.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="customer_id"))
suite.add_expectation(gx.expectations.ExpectTableRowCountToBeBetween(min_value=1))

validation_definition = context.validation_definitions.add(
    gx.ValidationDefinition(name="orders_table_validation", data=batch_definition, suite=suite)
)

checkpoint = context.checkpoints.add(
    gx.Checkpoint(name="orders_table_checkpoint", validation_definitions=[validation_definition])
)

result = checkpoint.run()    # no batch_parameters needed — it queries the live table directly
if not result.success:
    raise ValueError("Data quality check failed on analytics.orders — see Data Docs for details")
```

### 3. A Comprehensive Expectation Suite for a Real Dataset

**Purpose:** Use this as a template for writing a genuinely useful suite — most real data contracts need more than one or two null checks. This combines nullness, uniqueness, range, format, and cross-column expectations into a single suite that actually captures the shape of a realistic `orders` table, with an optional `severity` tag for distinguishing hard failures from soft warnings.

```python
import great_expectations as gx

suite = gx.ExpectationSuite(name="orders_full_contract")

suite.add_expectation(gx.expectations.ExpectColumnToExist(column="order_id"))
suite.add_expectation(gx.expectations.ExpectColumnValuesToBeUnique(column="order_id"))
suite.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="customer_id"))
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToBeInSet(
        column="status", value_set=["pending", "shipped", "delivered", "cancelled"]
    )
)
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToMatchRegex(
        column="email", regex=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", severity="warning"
    )
)
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToBeBetween(
        column="amount", min_value=0, max_value=100_000, severity="critical"
    )
)
suite.add_expectation(
    gx.expectations.ExpectColumnPairValuesAToBeGreaterThanB(
        column_A="shipped_at", column_B="ordered_at", or_equal=True
    )
)
suite.add_expectation(gx.expectations.ExpectTableRowCountToBeBetween(min_value=100))

context = gx.get_context()
context.suites.add(suite)
```

### 4. Automated Validation in an Airflow Pipeline with Actions & Alerts

**Purpose:** Use this to stop bad data before it reaches downstream consumers, instead of validating after the fact. It wires a Checkpoint — built fresh inside the DAG so it always reflects current code — into Airflow via the official GX provider, and attaches actions so a failure both updates Data Docs and pages the data team, not just logs a Python exception no one reads.

```python
from great_expectations_provider.operators.validate_checkpoint import GXValidateCheckpointOperator

def configure_checkpoint(context):
    import great_expectations as gx
    from great_expectations.checkpoint import SlackNotificationAction, UpdateDataDocsAction

    data_source = context.data_sources.add_postgres(
        name="warehouse", connection_string="postgresql+psycopg2://etl:***@warehouse:5432/analytics"
    )
    batch_definition = (
        data_source.add_table_asset(name="orders_table", table_name="orders")
        .add_batch_definition_whole_table("orders_full_table")
    )

    suite = context.suites.add(
        gx.ExpectationSuite(
            name="orders_pipeline_suite",
            expectations=[
                gx.expectations.ExpectColumnValuesToNotBeNull(column="order_id"),
                gx.expectations.ExpectColumnValuesToBeBetween(column="amount", min_value=0),
            ],
        )
    )

    validation_definition = context.validation_definitions.add(
        gx.ValidationDefinition(name="orders_pipeline_validation", data=batch_definition, suite=suite)
    )

    return context.checkpoints.add(
        gx.Checkpoint(
            name="orders_pipeline_checkpoint",
            validation_definitions=[validation_definition],
            actions=[
                UpdateDataDocsAction(name="update_data_docs"),
                SlackNotificationAction(
                    name="notify_data_team",
                    slack_webhook="{{ conn.slack_webhook.password }}",
                    notify_on="failure",
                ),
            ],
        )
    )

validate_orders = GXValidateCheckpointOperator(
    task_id="validate_orders_table",
    configure_checkpoint=configure_checkpoint,
)
# Wire it into the DAG so downstream loads only run after data passes:
# extract_orders >> validate_orders >> load_orders_to_mart
```

### 5. Bootstrapping a Baseline Suite from Real Data

**Purpose:** Use this when facing an unfamiliar dataset and needing a reasonable starting suite fast. Since GX 1.0 removed the automated profiler/Data Assistants without a direct replacement, this shows the current pragmatic workaround: pull real descriptive stats from a sample batch and turn them into a first-draft suite you then tighten by hand — better than starting from a blank page, worse than trusting it unreviewed.

```python
import great_expectations as gx

context = gx.get_context()
data_source = context.data_sources.add_pandas("sample_source")
data_asset = data_source.add_dataframe_asset(name="sample_df")
batch_definition = data_asset.add_batch_definition_whole_dataframe("sample_batch")
batch = batch_definition.get_batch(batch_parameters={"dataframe": df})

preview = batch.head(n=20)   # eyeball the actual data before trusting any generated expectation
print(preview)

stats = df.describe(include="all")
suite = gx.ExpectationSuite(name="draft_suite_from_stats")

for column in df.select_dtypes(include=["number"]).columns:
    observed_min, observed_max = df[column].min(), df[column].max()
    suite.add_expectation(
        gx.expectations.ExpectColumnValuesToBeBetween(
            column=column,
            min_value=observed_min,
            max_value=observed_max,
        )
    )

for column in df.columns:
    if df[column].isna().mean() == 0:   # never null in this sample — propose NOT NULL, then review it
        suite.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column=column))

context.suites.add(suite)
# Treat every generated expectation here as a DRAFT — review each one against
# actual business rules before relying on it in a Checkpoint.
```

### 6. Migrating a Legacy 0.x Suite to the 1.x Fluent API

**Purpose:** Use this the first time you touch an existing GX 0.x project — the goal isn't a line-by-line syntax swap, it's re-deriving each suite's actual intent and rebuilding it against the current data before trusting it. This shows the practical migration sequence: read the old suite's rules, rebuild them as a 1.x suite, then validate both against the same data to confirm they actually agree before cutting over.

```python
# --- The OLD suite (0.x), for reference — do not run this, it's legacy API ---
# validator.expect_column_values_to_not_be_null(column="order_id")
# validator.expect_column_values_to_be_unique(column="order_id")
# validator.expect_column_values_to_be_between(column="amount", min_value=0)

# --- The NEW suite (1.x), rebuilt from the same intent ---
import great_expectations as gx
import pandas as pd

context = gx.get_context()
df = pd.read_sql("SELECT * FROM orders LIMIT 5000", con=engine)   # sample of real data to verify against

data_source = context.data_sources.add_pandas("migration_check")
batch_definition = (
    data_source.add_dataframe_asset(name="orders_sample")
    .add_batch_definition_whole_dataframe("orders_sample_batch")
)
batch = batch_definition.get_batch(batch_parameters={"dataframe": df})

new_suite = gx.ExpectationSuite(name="orders_suite_v2")
new_suite.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="order_id"))
new_suite.add_expectation(gx.expectations.ExpectColumnValuesToBeUnique(column="order_id"))
new_suite.add_expectation(gx.expectations.ExpectColumnValuesToBeBetween(column="amount", min_value=0))

result = batch.validate(new_suite)
print(result.success)   # confirm this matches what the 0.x suite reported on the same data

if result.success:
    context.suites.add(new_suite)
    print("Migrated suite verified and saved — safe to retire the 0.x version")
```

### 7. Monitoring Data Drift Across Monthly Partitions

**Purpose:** Use this whenever a single pass/fail check isn't enough and you need to know _how_ a table is changing over time — a null rate creeping up, row counts trending down, or values drifting outside a historically normal range. This validates the same suite against several months of historical partitions and reports the trend, rather than just the latest run's result.

```python
import great_expectations as gx

context = gx.get_context()
data_source = context.data_sources.add_postgres(
    name="warehouse", connection_string="postgresql+psycopg2://etl:***@warehouse:5432/analytics"
)
table_asset = data_source.add_table_asset(name="orders", table_name="orders")
monthly_batch_definition = table_asset.add_batch_definition_monthly(
    name="orders_monthly", column="created_at"
)

suite = gx.ExpectationSuite(name="orders_drift_suite")
suite.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="customer_id"))
suite.add_expectation(gx.expectations.ExpectTableRowCountToBeBetween(min_value=1))

history = []
for month in range(1, 9):   # Jan through Aug 2026
    batch = monthly_batch_definition.get_batch(batch_parameters={"year": 2026, "month": month})
    result = batch.validate(suite)
    history.append({"month": month, "success": result.success})

for entry in history:
    status = "OK" if entry["success"] else "DRIFT DETECTED"
    print(f"2026-{entry['month']:02d}: {status}")

# Feed `history` into your existing metrics/dashboarding stack (Prometheus,
# a warehouse table, Grafana) rather than treating each month as a one-off check
```

### 8. Self-Hosting Data Docs on S3 for Team-Wide Visibility

**Purpose:** Use this to replace what GX Cloud's hosted dashboards used to provide, now that GX Cloud is discontinued — a shared, always-current view of validation results that the whole team can open without anyone's local filesystem. This wires `UpdateDataDocsAction` to publish directly to an S3-hosted site as part of every Checkpoint run.

```python
import great_expectations as gx
from great_expectations.checkpoint import UpdateDataDocsAction

context = gx.get_context(mode="file", project_root_dir=".")

s3_site_config = {
    "class_name": "SiteBuilder",
    "store_backend": {
        "class_name": "TupleS3StoreBackend",
        "bucket": "company-gx-data-docs",
        "prefix": "orders-pipeline",
    },
    "site_index_builder": {"class_name": "DefaultSiteIndexBuilder"},
}
context.add_data_docs_site(site_name="team_s3_site", site_config=s3_site_config)

checkpoint = context.checkpoints.add(
    gx.Checkpoint(
        name="orders_checkpoint_shared",
        validation_definitions=[validation_definition],
        actions=[
            UpdateDataDocsAction(name="publish_to_s3", site_names=["team_s3_site"]),
        ],
    )
)

checkpoint.run()
# Team members now open the S3 site URL directly — put it behind your
# existing SSO/reverse-proxy setup, since the site itself has no auth
print("Data Docs published to s3://company-gx-data-docs/orders-pipeline/")
```

## 🚀 Installation & Setup

```bash
pip install great_expectations
pip install "great_expectations[postgresql]"     # backend-specific extras
pip install "great_expectations[spark,snowflake]"

python -c "import great_expectations as gx; print(gx.__version__)"
```

```bash
# Optional: a File Data Context persists config/suites/results to disk
# instead of the default in-memory "ephemeral" context
mkdir my_gx_project && cd my_gx_project
python -c "import great_expectations as gx; gx.get_context(mode='file', project_root_dir='.')"
```

```python
import great_expectations as gx

context = gx.get_context()                                   # ephemeral — nothing persisted, great for scripts/tests
context = gx.get_context(mode="file", project_root_dir=".")  # file-backed — persists to ./gx/
```

## 🗂️ Data Context Basics

```python
import great_expectations as gx

context = gx.get_context()

# The context is the entry point for every CRUD operation across GX's core objects
context.data_sources        # add/get/list Data Sources
context.suites              # add/get/list Expectation Suites
context.validation_definitions
context.checkpoints

# Listing what already exists
context.data_sources.all()
context.suites.all()
context.checkpoints.all()
```

- An **ephemeral** context lives only for the current Python process — ideal for tests, notebooks, and one-off scripts.
- A **file** context persists everything (data source configs, suites, checkpoints, validation results) to a `gx/` directory — use this for anything that needs to survive between runs or be checked into version control.

## 🔌 Data Sources & Data Assets

```python
# Pandas — in-memory DataFrames
pandas_ds = context.data_sources.add_pandas(name="pandas_source")
df_asset = pandas_ds.add_dataframe_asset(name="my_df")

# CSV files
csv_asset = pandas_ds.add_csv_asset(name="orders_csv", filepath_or_buffer="orders.csv")

# SQL — generic connection string, or a backend-specific convenience method
sql_ds = context.data_sources.add_sql(name="generic_sql", connection_string="postgresql+psycopg2://...")
pg_ds = context.data_sources.add_postgres(name="pg_source", connection_string="postgresql+psycopg2://...")

table_asset = pg_ds.add_table_asset(name="orders", table_name="orders")
query_asset = pg_ds.add_query_asset(name="recent_orders", query="SELECT * FROM orders WHERE created_at > now() - interval '7 days'")

# Spark
spark_ds = context.data_sources.add_spark(name="spark_source")
spark_df_asset = spark_ds.add_dataframe_asset(name="spark_df")
```

## 📦 Batch Definitions & Batches

```python
# Whole-table / whole-dataframe — validate everything currently in the asset
batch_definition = table_asset.add_batch_definition_whole_table("orders_full")
batch_definition = df_asset.add_batch_definition_whole_dataframe("orders_full")

# Time-based partitions — validate one slice at a time (daily/monthly/yearly)
daily_batch_definition = table_asset.add_batch_definition_daily(
    name="orders_daily", column="created_at"
)

# Getting an actual Batch — DataFrame sources need batch_parameters; tables usually don't
batch = batch_definition.get_batch()                                  # SQL table
batch = batch_definition.get_batch(batch_parameters={"dataframe": df})  # pandas/spark DataFrame

batch.head(n=10)             # quick sanity look at what you're about to validate
```

## ✅ Expectations & Expectation Suites

```python
import great_expectations as gx

suite = gx.ExpectationSuite(name="my_suite")

suite.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="id"))
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToBeBetween(column="amount", min_value=0, max_value=10_000)
)

# Inline validation against a single Batch, without building a full Checkpoint —
# handy for quick, ad-hoc checks during exploration
result = batch.validate(gx.expectations.ExpectColumnValuesToNotBeNull(column="id"))
result = batch.validate(suite)     # validate an entire suite at once

context.suites.add(suite)                              # persist it for reuse
retrieved = context.suites.get(name="my_suite")         # fetch it back later
suite.add_expectation(gx.expectations.ExpectColumnToExist(column="new_col"))
context.suites.add_or_update(suite)                     # save changes to an existing suite
```

## 🔗 Validation Definitions

```python
import great_expectations as gx

# A Validation Definition is the explicit link between a Batch Definition (WHAT data)
# and an Expectation Suite (WHAT rules) — Checkpoints run one or more of these.
validation_definition = context.validation_definitions.add(
    gx.ValidationDefinition(name="orders_validation", data=batch_definition, suite=suite)
)

context.validation_definitions.get(name="orders_validation")
context.validation_definitions.all()
```

## 🚦 Checkpoints & Actions

```python
import great_expectations as gx
from great_expectations.checkpoint import UpdateDataDocsAction, SlackNotificationAction, EmailAction

checkpoint = context.checkpoints.add(
    gx.Checkpoint(
        name="orders_checkpoint",
        validation_definitions=[validation_definition],   # a checkpoint can run several at once
        actions=[
            UpdateDataDocsAction(name="update_data_docs"),
            SlackNotificationAction(
                name="notify_on_failure",
                slack_webhook="https://hooks.slack.com/services/...",
                notify_on="failure",
            ),
            EmailAction(
                name="email_data_team",
                smtp_address="smtp.company.com",
                smtp_port=587,
                receiver_emails="data-team@company.com",
                notify_on="failure",
            ),
        ],
    )
)

result = checkpoint.run()                                        # for table/query batch definitions
result = checkpoint.run(batch_parameters={"dataframe": df})       # for DataFrame batch definitions

checkpoint.run()   # re-run any time — great for a scheduled job that always checks "current" data
```

## 📊 Validation Results & Data Docs

```python
result = checkpoint.run()

result.success                 # overall pass/fail across every validation definition in the run
result.describe()              # human-readable summary
for validation_result in result.run_results.values():
    print(validation_result["validation_result"].success)

context.build_data_docs()      # regenerate the static HTML site
context.open_data_docs()       # open it in a browser (local/file contexts)
```

- Data Docs render every Expectation in plain language alongside its most recent Validation Result — this is the artifact to hand to non-technical stakeholders, not the raw JSON.
- `UpdateDataDocsAction` in a Checkpoint's `actions` list keeps Data Docs current automatically after every run — without it, you must call `build_data_docs()` manually.

## 🌱 Bootstrapping Suites from Real Data

```python
# No built-in profiler in GX Core 1.x (see the top-of-sheet note) — the practical
# approach is: sample real data, look at it, then write expectations that
# reflect genuine business rules, using observed stats only as a starting point.

sample = df.sample(min(len(df), 1000), random_state=42)
print(sample.describe(include="all"))
print(sample.isna().mean().sort_values(ascending=False))   # null rates, per column

# Turn genuinely-confirmed rules into expectations — don't blindly encode
# whatever happened to be true in the sample as a permanent constraint
suite = gx.ExpectationSuite(name="reviewed_suite")
suite.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="order_id"))
```

- Third-party profiling helpers exist in the ecosystem, but always treat any auto-generated expectation as a draft — an automatically inferred `min_value`/`max_value` just encodes whatever the sample happened to contain, not an actual business rule.

## 🧩 Custom Expectations

```python
from great_expectations.expectations.expectation import ColumnMapExpectation
from great_expectations.expectations.metrics import ColumnMapMetricProvider, column_condition_partial

class ColumnValuesToBeValidOrderStatus(ColumnMapMetricProvider):
    condition_metric_name = "column_values.valid_order_status"

    @column_condition_partial(engine=None)  # implement per-backend as needed
    def _pandas(cls, column, **kwargs):
        return column.isin(["pending", "shipped", "delivered", "cancelled"])

class ExpectColumnValuesToBeValidOrderStatus(ColumnMapExpectation):
    map_metric = "column_values.valid_order_status"
    success_keys = ("mostly",)

# Use it exactly like any built-in Expectation once registered
suite.add_expectation(ExpectColumnValuesToBeValidOrderStatus(column="status"))
```

- Reach for a custom Expectation when a business rule doesn't map cleanly onto any of the ~300 built-ins — most teams never need this, since combinations of `ExpectColumnValuesToBeInSet`, regex matching, and multi-column expectations cover the large majority of real rules.

## 🗄️ Working with SQL & Warehouses

```python
# Connection strings follow standard SQLAlchemy format
pg_ds = context.data_sources.add_postgres(
    name="warehouse", connection_string="postgresql+psycopg2://user:pass@host:5432/db"
)
snowflake_ds = context.data_sources.add_sql(
    name="snowflake",
    connection_string="snowflake://user:pass@account/database/schema?warehouse=WH&role=ROLE",
)

# Validate a query result directly, without materializing a full table asset
recent_orders_asset = pg_ds.add_query_asset(
    name="recent_orders",
    query="SELECT * FROM orders WHERE created_at >= current_date - interval '1 day'",
)
```

- Prefer `add_table_asset` for stable, recurring checks against a named table, and `add_query_asset` for one-off or narrowly-scoped validations (e.g., "just today's partition") where materializing the whole table isn't necessary.
- Store connection strings via environment variables or your secrets manager — never hardcode credentials into a script that gets checked into version control.

## 🐼 Working with Pandas & Spark DataFrames

```python
# Pandas
pandas_ds = context.data_sources.add_pandas("pandas_source")
df_asset = pandas_ds.add_dataframe_asset(name="my_df")
batch_definition = df_asset.add_batch_definition_whole_dataframe("my_batch")
batch = batch_definition.get_batch(batch_parameters={"dataframe": my_dataframe})

# Spark — same shape, different data source constructor
spark_ds = context.data_sources.add_spark("spark_source")
spark_asset = spark_ds.add_dataframe_asset(name="my_spark_df")
spark_batch_definition = spark_asset.add_batch_definition_whole_dataframe("my_spark_batch")
spark_batch = spark_batch_definition.get_batch(batch_parameters={"dataframe": my_spark_dataframe})
```

- The `batch_parameters={"dataframe": ...}` handoff is how any in-memory DataFrame (pandas or Spark) gets validated — the Data Asset defines the _shape_ of the check, the actual data is only supplied at `get_batch()`/`checkpoint.run()` time.

## 🔁 Orchestration (Airflow, CI/CD)

```python
# Airflow — official provider wraps checkpoint construction + run in one operator
from great_expectations_provider.operators.validate_checkpoint import GXValidateCheckpointOperator

validate = GXValidateCheckpointOperator(
    task_id="validate_orders",
    configure_checkpoint=configure_checkpoint,   # a function returning a built Checkpoint, as in Example 4
)
```

```yaml
# CI/CD — run a validation suite as a build step, failing the pipeline on bad data
# .github/workflows/data-quality.yml
name: Data Quality
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install great_expectations
      - run: python scripts/run_gx_checkpoint.py # exits non-zero on result.success == False
```

```python
# scripts/run_gx_checkpoint.py — the exit-code contract CI/CD needs
import sys
result = checkpoint.run()
sys.exit(0 if result.success else 1)
```

- GX has no first-party dbt integration — expectation suites live entirely in GX's own project, separate from dbt models and tests. Teams that are dbt-native often lean on `dbt test`/`dbt-expectations` instead and reserve GX for cases needing its richer suite/Data Docs workflow.

## ⚙️ Configuration & Project Structure

```
my_gx_project/
├── gx/
│   ├── great_expectations.yml       # file-context config
│   ├── expectations/                # saved ExpectationSuite JSON
│   ├── checkpoints/                 # saved Checkpoint JSON
│   ├── validation_definitions/
│   └── uncommitted/
│       ├── data_docs/               # generated HTML — gitignore this
│       └── validations/             # raw validation result JSON — gitignore this
```

```bash
# .gitignore for a GX project — commit the definitions, not the generated output
echo "gx/uncommitted/" >> .gitignore
```

## 🔍 Testing & Debugging

```python
# Validate a single Expectation ad hoc before committing it to a suite
result = batch.validate(gx.expectations.ExpectColumnValuesToBeBetween(column="amount", min_value=0))
print(result.success, result.result)   # `.result` holds observed values, unexpected counts, etc.

# Inspect exactly which rows failed
unexpected = result.result.get("partial_unexpected_list")
print(unexpected)
```

```python
# Unit-test suites in CI with pytest, same idea as testing any other code
import pytest

def test_orders_suite_catches_negative_amounts():
    bad_df = pd.DataFrame({"order_id": [1], "amount": [-5.0]})
    batch = batch_definition.get_batch(batch_parameters={"dataframe": bad_df})
    result = batch.validate(suite)
    assert not result.success
```

## 🗓️ Multi-Batch Validation & Partitioned Data

```python
# Time-based Batch Definitions split one table/asset into multiple batches —
# useful for validating "this month's data" specifically, or for trend-checking
# the same Expectation across many historical slices instead of just the latest one.
daily_batch_definition = table_asset.add_batch_definition_daily(
    name="orders_daily", column="created_at"
)
monthly_batch_definition = table_asset.add_batch_definition_monthly(
    name="orders_monthly", column="created_at"
)

# Validate just the most recent partition
batch = daily_batch_definition.get_batch(batch_parameters={"year": 2026, "month": 9, "day": 9})
result = batch.validate(suite)

# Validate the same suite across several historical partitions to spot drift —
# e.g. did row counts or null rates shift over the last 6 months?
import datetime

results = []
for month in range(1, 7):
    params = {"year": 2026, "month": month}
    batch = monthly_batch_definition.get_batch(batch_parameters=params)
    results.append((params, batch.validate(suite)))

for params, result in results:
    print(params, result.success)
```

```python
# Cross-source reconciliation — compare a value computed against one source
# to the same value from another (row counts matching between a staging
# table and the final warehouse table, for example)
suite.add_expectation(
    gx.expectations.ExpectQueryResultsToMatchSource(
        query="SELECT count(*) FROM staging.orders",
        source_query="SELECT count(*) FROM warehouse.orders",
    )
)
```

- Partitioned Batch Definitions are the right tool whenever "validate everything" is either too slow or the wrong question — you usually care about _today's_ partition, not last year's, on every run.
- Re-validating the same suite across several historical batches is a lightweight way to catch drift (a null rate creeping up, a distribution shifting) without standing up a separate anomaly-detection system.

## 🔄 Migrating from GX 0.x to GX Core 1.x

The single biggest gotcha in this whole sheet is mixing these two APIs. Side by side:

| Task                      | Legacy 0.x API                                                                            | GX Core 1.x Fluent API                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Get a context             | `context = ge.get_context()` (YAML-config based)                                          | `context = gx.get_context()` (ephemeral or file mode)                                                  |
| Add a data source         | `context.add_datasource(...)` (YAML block)                                                | `context.data_sources.add_pandas(...)` / `add_postgres(...)`                                           |
| Get data to validate      | `BatchRequest(datasource_name=..., data_asset_name=...)`                                  | `data_asset.add_batch_definition_...(...).get_batch(...)`                                              |
| Create a suite            | `context.add_or_update_expectation_suite(expectation_suite_name=...)`                     | `context.suites.add(gx.ExpectationSuite(name=...))`                                                    |
| Add an expectation        | `validator.expect_column_values_to_not_be_null(column="id")` (snake_case, on a Validator) | `suite.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="id"))` (PascalCase class) |
| Tie data + rules together | _(implicit — a Validator already bundles both)_                                           | `gx.ValidationDefinition(data=batch_definition, suite=suite)` (explicit object)                        |
| Run validation            | `checkpoint = context.add_or_update_checkpoint(name=..., validator=validator)`            | `context.checkpoints.add(gx.Checkpoint(validation_definitions=[...]))`                                 |
| Auto-generate a suite     | `context.assistants.onboarding.run(batch_request=...)`                                    | _(no direct replacement — see Section 10)_                                                             |

```python
# Practical migration approach: don't try to mechanically translate a big
# 0.x project line by line. Instead, re-derive suites from their INTENT:

# 1. Export what each 0.x suite currently checks, in plain language
old_suite_summary = "orders.order_id: not null, unique. orders.amount: >= 0."

# 2. Recreate it as a fresh 1.x suite, verifying against real data as you go
new_suite = gx.ExpectationSuite(name="orders_suite_v2")
new_suite.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="order_id"))
new_suite.add_expectation(gx.expectations.ExpectColumnValuesToBeUnique(column="order_id"))
new_suite.add_expectation(gx.expectations.ExpectColumnValuesToBeBetween(column="amount", min_value=0))

# 3. Run the NEW suite against the SAME batch the old one used to validate,
#    and confirm the pass/fail outcome actually matches before cutting over
result = batch.validate(new_suite)
assert result.success == expected_from_old_suite
```

- Don't run 0.x and 1.x `great_expectations` in the same virtualenv/project — the import paths, config file formats, and object models are different enough that having both installed invites subtle bugs.
- If you're maintaining a large 0.x deployment, budget migration as a real project with review, not a version bump — this is closer to "Airflow 2 → 3" or "Python 2 → 3" in scope than a routine dependency update.

## 🎨 Data Docs Hosting & Sharing

```python
# Default: a local filesystem site under gx/uncommitted/data_docs/ — fine for
# solo work, not for a team, and NOT a replacement for what GX Cloud used to do
context.build_data_docs()
context.open_data_docs()
```

```python
# Host Data Docs on S3 so the whole team can see the same results —
# the standard self-hosted alternative now that GX Cloud is discontinued
s3_site_config = {
    "class_name": "SiteBuilder",
    "store_backend": {
        "class_name": "TupleS3StoreBackend",
        "bucket": "company-gx-data-docs",
        "prefix": "data_docs",
    },
    "site_index_builder": {"class_name": "DefaultSiteIndexBuilder"},
}
context.add_data_docs_site(site_name="s3_site", site_config=s3_site_config)
context.build_data_docs(site_names=["s3_site"])
```

```python
# Or Google Cloud Storage — same pattern, different backend class
gcs_site_config = {
    "class_name": "SiteBuilder",
    "store_backend": {
        "class_name": "TupleGCSStoreBackend",
        "bucket": "company-gx-data-docs",
        "project": "my-gcp-project",
    },
}
context.add_data_docs_site(site_name="gcs_site", site_config=gcs_site_config)
```

- Put the S3/GCS bucket behind your normal access controls (IAM, signed URLs, or a reverse proxy with SSO) — Data Docs sites have no built-in authentication of their own.
- Rebuild the hosted site as a step in the same pipeline that runs your Checkpoints (via `UpdateDataDocsAction`, pointed at the hosted site name) so it never silently goes stale.

## 📐 Result Format, Sampling & Performance

```python
# result_format controls how much detail comes back per Expectation —
# COMPLETE is verbose (every unexpected value) and can be expensive on huge tables
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToNotBeNull(
        column="order_id",
        result_format={"result_format": "COMPLETE", "partial_unexpected_count": 20},
    )
)
```

**`result_format` levels**

| Level          | Returns                                                             |
| -------------- | ------------------------------------------------------------------- |
| `BOOLEAN_ONLY` | Just `success: true/false` — cheapest, least informative            |
| `BASIC`        | + counts of unexpected values, no examples                          |
| `SUMMARY`      | + a small sample of unexpected values (default)                     |
| `COMPLETE`     | + every unexpected value — can be slow/large on big failing batches |

```python
# For expensive checks on very large tables, validate a representative
# sample instead of the full table where that's an acceptable trade-off
sample_query_asset = pg_ds.add_query_asset(
    name="orders_sample",
    query="SELECT * FROM orders TABLESAMPLE SYSTEM (1)",   # ~1% sample, Postgres syntax
)
```

- Default to `SUMMARY` in production Checkpoints — `COMPLETE` is genuinely useful while debugging a specific failure, but returning every unexpected row on a table with millions of violations will slow the run and bloat Data Docs.
- Row-count and null-rate style Expectations (`ExpectTableRowCountToBeBetween`, `ExpectColumnValuesToNotBeNull`) are usually cheap even on huge tables since the backend can push the aggregation down; regex/format Expectations on every row of a huge table are the ones worth sampling.

## ⚠️ Common Gotchas

- **The pre-1.0 and 1.0+ APIs are not interchangeable** — `context.add_or_update_checkpoint(validator=...)`, `BatchRequest`, and snake*case `expect_column_values_to*...()`calls on a`Validator` object are all legacy 0.x patterns; the current Fluent API uses PascalCase Expectation classes and the Data Source → Asset → Batch Definition chain shown throughout this sheet.
- **There is no built-in automated profiler in 1.x** — Data Assistants/`UserConfigurableProfiler` were removed in the 1.0 release with no direct replacement; treat any "auto-generate a suite" workflow you find in older docs as 0.x-only.
- **DataFrame sources need `batch_parameters` at run time, tables usually don't** — forgetting `batch_parameters={"dataframe": df}` on a pandas/Spark checkpoint run is one of the most common first-time errors, since it fails with a somewhat generic error rather than an obvious "you forgot the DataFrame" message.
- **A Checkpoint without `UpdateDataDocsAction` won't refresh Data Docs automatically** — you'll keep looking at stale HTML until you either add the action or call `context.build_data_docs()` manually after every run.
- **An ephemeral context loses everything when the process exits** — suites, checkpoints, and results all vanish; use a file (or GX-managed) context for anything that needs to persist between runs.
- **`severity` on an Expectation doesn't change whether the Checkpoint's overall `result.success` is `False`** on failure — it's metadata for tiering/display, not a way to make a failing expectation "not count." Check the actual gating behavior in your Checkpoint/actions if you're relying on severity to distinguish blocking vs. non-blocking failures.
- **GX Cloud is gone (discontinued June 1, 2026)** — any tutorial or blog post referencing GX Cloud dashboards, hosted Data Docs, or the GX Agent is describing a product that no longer exists; GX Core (this sheet) is the only supported path going forward.
- **No serious dbt integration** — don't expect GX expectation suites to read dbt model metadata or vice versa without custom glue code.
- **Time-partitioned Batch Definitions need the right `batch_parameters` keys for their grain** — a `_daily` definition expects `{"year", "month", "day"}`, a `_monthly` one expects `{"year", "month"}`; passing the wrong shape produces a confusing error rather than a clear "wrong grain" message.
- **A `COMPLETE` `result_format` on a badly-failing check against a huge table can make the run itself slow** — the detail is generated at validation time, not lazily, so it costs real time and memory even if nobody ever looks at the full unexpected list.
- **Self-hosted Data Docs sites (S3/GCS) have no built-in authentication** — anyone with the URL (or bucket access) can read them; put them behind SSO or a private bucket policy rather than assuming "we didn't share the link" is enough.

## 🎯 Best Practices

```python
# Fail loudly and specifically — don't just log a warning and move on
result = checkpoint.run()
if not result.success:
    raise ValueError(f"Data quality check '{checkpoint.name}' failed — see Data Docs for details")

# Keep suites in version control as code, not as hand-edited JSON in a UI
# gx/expectations/orders_suite.json  -> commit this to git

# Name suites and checkpoints after the CONTRACT, not the technology
# GOOD: "orders_daily_contract"
# LESS USEFUL: "postgres_check_1"
```

- Treat an Expectation Suite as a data contract between teams — version it, review changes to it in PRs, and don't let it silently drift from what the data actually looks like.
- Validate as early in the pipeline as possible — catching bad data at extraction is cheaper than catching it after three downstream models have already consumed it.
- Separate "hard" expectations (block the pipeline) from "soft" ones (log/alert but don't block) explicitly in how you structure Checkpoints and actions, rather than relying on `severity` metadata to do that gating for you.
- Keep `gx/uncommitted/` out of version control — Data Docs HTML and raw validation JSON are generated artifacts, not source of truth.

## 💡 Pro Tips

1. **Start every new dataset with `batch.head()`** before writing a single Expectation — know what you're actually validating.
2. **Use `add_query_asset` for narrow, time-scoped checks** ("just today's partition") instead of validating an entire massive table every run.
3. **Wire `UpdateDataDocsAction` into every Checkpoint by default** — stale documentation is worse than none, because people trust it.
4. **Validate inline with `batch.validate(expectation)` while iterating**, then promote confirmed expectations into a saved Suite once you're confident in them.
5. **Use a file context, not ephemeral, the moment a check needs to run more than once** — suites and checkpoints defined in a throwaway script can't be reused or reviewed in a PR.
6. **Treat any auto-generated or stats-derived expectation as a draft**, not a finished rule — GX Core 1.x has no built-in profiler to lean on, so there's no substitute for a human review pass.
7. **Page on `PagerdutyAlertAction` only for genuinely blocking failures** — reserve Slack/email notifications for things a human should look at but that don't need someone paged at 2am.
8. **Run Checkpoints as an explicit pipeline step (Airflow, CI/CD)**, not as an afterthought script someone remembers to run manually.
9. **Name things after the business contract, not the underlying table** — `orders_daily_contract` ages better than `postgres_orders_check_v2`.
10. **Bookmark the migration guide before touching an existing 0.x project** — the jump to 1.0's Fluent API is a genuine rewrite, not an incremental update, and mixing old and new patterns in the same codebase causes confusing failures.
11. **Re-validate the same suite across historical partitions, not just the latest one**, whenever you need to catch drift rather than just outright breakage.
12. **Point every environment's Checkpoints at the same hosted Data Docs site** — a shared S3/GCS site is the direct replacement for what GX Cloud's dashboard used to provide.
13. **Default to `SUMMARY` result_format everywhere except while actively debugging one specific failure** — `COMPLETE` is a diagnostic tool, not a production default.
