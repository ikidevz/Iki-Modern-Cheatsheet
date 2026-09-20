# Data Testing with pytest Cheatsheet for Data & Analytics Engineers

> A structured reference for testing data pipelines — pytest fundamentals, fixtures & factories for test data, DataFrame assertions (pandas/Polars/PySpark), mocking external systems, property-based testing, and CI integration.

## 📑 Table of Contents

1. [🚀 Setup and Basics](#setup-and-basics)
2. [🧩 Fixtures](#fixtures)
3. [🔁 Parametrize](#parametrize)
4. [🗂️ conftest.py & Project Structure](#conftest-py-project-structure)
5. [📊 Testing DataFrames](#testing-dataframes)
6. [⚡ Testing PySpark Jobs](#testing-pyspark-jobs)
7. [🎭 Mocking Databases & External Systems](#mocking-databases-external-systems)
8. [🏭 Test Data Factories](#test-data-factories)
9. [📸 Snapshot / Golden File Testing](#snapshot-golden-file-testing)
10. [🎲 Property-Based Testing with Hypothesis](#property-based-testing-with-hypothesis)
11. [🕰️ Freezing Time](#freezing-time)
12. [🏗️ Testing End-to-End Pipelines](#testing-end-to-end-pipelines)
13. [✅ Great Expectations vs pytest](#great-expectations-vs-pytest)
14. [🏷️ Markers & Test Organization](#markers-test-organization)
15. [📈 Coverage & CI Integration](#coverage-ci-integration)
16. [🏗️ dbt Test Integration](#dbt-test-integration)
17. [🌬️ Testing Airflow DAGs](#testing-airflow-dags)
18. [📜 Contract Testing Between Pipeline Stages](#contract-testing-between-pipeline-stages)
19. [🔁 Testing Pipeline Idempotency](#testing-pipeline-idempotency)
20. [🧬 Mutation Testing](#mutation-testing)
21. [⚠️ Common Gotchas](#common-gotchas)
22. [🎯 Best Practices](#best-practices)
23. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Task                        | Syntax                                                                |
| ------------------------------ | -------------------------------------------------------------------------- |
| Run tests                     | `pytest` / `pytest -v` / `pytest -k "transform"`                        |
| Run with coverage             | `pytest --cov=src --cov-report=term-missing`                            |
| Define a fixture              | `@pytest.fixture def sample_df(): ...`                                  |
| Parametrized test             | `@pytest.mark.parametrize("input,expected", [...])`                     |
| Assert pandas DataFrames equal| `pandas.testing.assert_frame_equal(df1, df2)`                           |
| Assert Polars DataFrames equal| `polars.testing.assert_frame_equal(df1, df2)`                           |
| Mark test as slow/integration | `@pytest.mark.slow`, run subset via `pytest -m "not slow"`              |
| Mock an object                | `mocker.patch("module.function", return_value=...)` (pytest-mock)      |
| Expect an exception           | `with pytest.raises(ValueError): ...`                                   |

## 🚀 Setup and Basics

```bash
pip install pytest pytest-cov pytest-mock pytest-xdist hypothesis freezegun
```

```python
# test_transform.py — pytest discovers files/functions matching test_*.py / *_test.py, test_*()
def add(a, b):
    return a + b

def test_add_positive_numbers():
    assert add(2, 3) == 5

def test_add_raises_on_bad_type():
    import pytest
    with pytest.raises(TypeError):
        add("a", 2)
```

```bash
pytest                          # run all tests
pytest test_transform.py        # one file
pytest test_transform.py::test_add_positive_numbers   # one test
pytest -v                       # verbose
pytest -k "add and not raises"  # keyword filter
pytest -x                       # stop on first failure
pytest --lf                     # re-run only last-failed tests
pytest -n auto                  # parallel (pytest-xdist)
```

## 🧩 Fixtures

```python
import pytest
import pandas as pd

@pytest.fixture
def sample_orders() -> pd.DataFrame:
    return pd.DataFrame({
        "order_id": [1, 2, 3],
        "customer_id": [10, 10, 20],
        "amount": [50.0, 75.5, 20.0],
    })

def test_total_revenue(sample_orders):
    assert sample_orders["amount"].sum() == 145.5

# Fixture scope controls how often it's recreated
@pytest.fixture(scope="session")   # once per test session — e.g., a Spark session
def spark():
    from pyspark.sql import SparkSession
    s = SparkSession.builder.master("local[2]").appName("tests").getOrCreate()
    yield s
    s.stop()

@pytest.fixture(scope="function")  # default — fresh instance per test
def temp_db():
    conn = create_in_memory_db()
    yield conn
    conn.close()   # teardown runs after the test, even on failure

# Fixtures can depend on other fixtures
@pytest.fixture
def loaded_db(temp_db, sample_orders):
    sample_orders.to_sql("orders", temp_db, index=False)
    return temp_db
```

| Scope | Recreated |
| --- | --- |
| `function` (default) | Once per test |
| `class` | Once per test class |
| `module` | Once per file |
| `session` | Once for the whole pytest run — use for expensive setup (Spark session, DB container) |

## 🔁 Parametrize

```python
import pytest

@pytest.mark.parametrize("amount,expected_tier", [
    (0, "free"),
    (50, "basic"),
    (500, "premium"),
    (-10, "invalid"),
])
def test_pricing_tier(amount, expected_tier):
    assert get_pricing_tier(amount) == expected_tier

# Multiple parametrize decorators multiply (Cartesian product) test cases
@pytest.mark.parametrize("currency", ["USD", "EUR"])
@pytest.mark.parametrize("amount", [0, 100])
def test_conversion(amount, currency):
    assert convert(amount, currency) is not None

# Parametrize with explicit IDs for readable test output
@pytest.mark.parametrize("input_val,expected", [(1, 1), (-1, 1), (0, 0)], ids=["pos", "neg", "zero"])
def test_abs(input_val, expected):
    assert abs(input_val) == expected

# Parametrizing a fixture itself (every test using it runs once per param)
@pytest.fixture(params=["csv", "parquet", "json"])
def file_format(request):
    return request.param

def test_read_any_format(file_format):
    df = read_data(f"sample.{file_format}")
    assert len(df) > 0
```

## 🗂️ conftest.py & Project Structure

```
project/
├── src/
│   └── pipeline/
│       ├── extract.py
│       ├── transform.py
│       └── load.py
├── tests/
│   ├── conftest.py          # shared fixtures, auto-discovered — no import needed
│   ├── unit/
│   │   └── test_transform.py
│   ├── integration/
│   │   └── test_pipeline_e2e.py
│   └── data/
│       └── sample_orders.csv    # small, checked-in fixture data
└── pytest.ini  (or pyproject.toml [tool.pytest.ini_options])
```

```python
# tests/conftest.py — fixtures here are automatically available to every test in this directory tree
import pytest
import pandas as pd

@pytest.fixture
def sample_orders():
    return pd.read_csv("tests/data/sample_orders.csv")

@pytest.fixture(autouse=True)
def set_test_env(monkeypatch):
    """Runs automatically before EVERY test — good for env var isolation."""
    monkeypatch.setenv("ENVIRONMENT", "test")
```

```ini
# pytest.ini
[pytest]
testpaths = tests
markers =
    slow: marks tests as slow (deselect with -m "not slow")
    integration: marks integration tests requiring external services
addopts = --strict-markers -ra
```

## 📊 Testing DataFrames

```python
import pandas as pd
import pandas.testing as pdt
import polars as pl
import polars.testing as plt

# pandas
def test_transform_adds_total_column():
    input_df = pd.DataFrame({"price": [10, 20], "qty": [2, 3]})
    result = add_total(input_df)
    expected = pd.DataFrame({"price": [10, 20], "qty": [2, 3], "total": [20, 60]})
    pdt.assert_frame_equal(result, expected)

pdt.assert_frame_equal(df1, df2, check_dtype=False, check_like=True)  # ignore dtype/column order
pdt.assert_series_equal(s1, s2)

# Polars
def test_polars_filter():
    df = pl.DataFrame({"amount": [10, -5, 20]})
    result = df.filter(pl.col("amount") > 0)
    expected = pl.DataFrame({"amount": [10, 20]})
    plt.assert_frame_equal(result, expected)

# Schema/dtype assertions (catch silent type drift early)
def test_schema_matches_contract():
    df = load_orders()
    expected_schema = {"order_id": "int64", "amount": "float64", "order_date": "datetime64[ns]"}
    assert dict(df.dtypes.astype(str)) == expected_schema

# Data quality assertions as tests, not just profiling
def test_no_nulls_in_key_columns():
    df = load_orders()
    assert df["order_id"].notna().all()
    assert df["order_id"].is_unique

def test_amount_within_expected_range():
    df = load_orders()
    assert (df["amount"] >= 0).all()
    assert df["amount"].max() < 1_000_000   # sanity bound, catches unit errors (cents vs dollars)
```

## ⚡ Testing PySpark Jobs

```python
import pytest
from pyspark.sql import SparkSession, Row

@pytest.fixture(scope="session")
def spark():
    return (
        SparkSession.builder
        .master("local[2]")
        .appName("pytest-spark")
        .config("spark.sql.shuffle.partitions", "2")   # keep test runs fast
        .getOrCreate()
    )

def test_deduplicate_orders(spark):
    input_df = spark.createDataFrame([
        Row(order_id=1, amount=10.0),
        Row(order_id=1, amount=10.0),   # duplicate
        Row(order_id=2, amount=20.0),
    ])
    result = deduplicate_orders(input_df)
    assert result.count() == 2

# Compare Spark DataFrames (chispa is the standard library for this)
from chispa.dataframe_comparer import assert_df_equality

def test_transform_matches_expected(spark):
    input_df = spark.createDataFrame([Row(price=10, qty=2)])
    expected_df = spark.createDataFrame([Row(price=10, qty=2, total=20)])
    result_df = add_total(input_df)
    assert_df_equality(result_df, expected_df, ignore_row_order=True)
```

- **Use `local[2]`, not `local[*]`** for test Spark sessions — enough parallelism to catch partitioning bugs without burning excessive CI time.
- **Session-scoped Spark fixture** avoids the ~seconds-long JVM startup cost on every single test.

## 🎭 Mocking Databases & External Systems

```python
# pytest-mock's `mocker` fixture wraps unittest.mock with automatic cleanup
def test_load_calls_execute(mocker):
    mock_conn = mocker.MagicMock()
    load_to_db(data=[{"id": 1}], conn=mock_conn)
    mock_conn.execute.assert_called_once()

# Patch a function/API call
def test_fetch_uses_correct_url(mocker):
    mock_get = mocker.patch("requests.get")
    mock_get.return_value.json.return_value = {"status": "ok"}
    result = fetch_status("https://api.example.com")
    mock_get.assert_called_with("https://api.example.com", timeout=10)
    assert result == "ok"

# In-memory SQLite as a lightweight real DB instead of mocking SQL entirely
import sqlite3
@pytest.fixture
def db_conn():
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE orders (id INTEGER, amount REAL)")
    yield conn
    conn.close()

def test_insert_and_query(db_conn):
    insert_order(db_conn, order_id=1, amount=50.0)
    result = db_conn.execute("SELECT amount FROM orders WHERE id=1").fetchone()
    assert result[0] == 50.0

# moto for mocking AWS services (S3, etc.)
from moto import mock_aws
import boto3

@mock_aws
def test_upload_to_s3():
    s3 = boto3.client("s3", region_name="us-east-1")
    s3.create_bucket(Bucket="test-bucket")
    upload_report(s3, bucket="test-bucket", key="report.csv", data=b"a,b\n1,2")
    obj = s3.get_object(Bucket="test-bucket", Key="report.csv")
    assert obj["Body"].read() == b"a,b\n1,2"
```

| Approach | When to use |
| --- | --- |
| `mocker.patch` / `MagicMock` | Unit tests — isolate logic from any real I/O, fastest |
| In-memory SQLite / DuckDB | Integration-style tests that need real SQL semantics without a live DB |
| `moto` (mocked AWS) | Testing S3/DynamoDB/etc. interactions without real cloud calls |
| Testcontainers (real Docker DB) | Highest fidelity, closest to prod, slower — reserve for critical integration suites |

## 🏭 Test Data Factories

```python
# Factory pattern avoids copy-pasted dict/DataFrame literals scattered across tests
import factory
from dataclasses import dataclass

@dataclass
class Order:
    order_id: int
    customer_id: int
    amount: float
    status: str = "completed"

class OrderFactory(factory.Factory):
    class Meta:
        model = Order
    order_id = factory.Sequence(lambda n: n)
    customer_id = factory.Faker("random_int", min=1, max=1000)
    amount = factory.Faker("pyfloat", positive=True, right_digits=2, max_value=1000)

def test_high_value_orders_flagged():
    orders = [OrderFactory(amount=5000.0), OrderFactory(amount=10.0)]
    flagged = flag_high_value(orders)
    assert len(flagged) == 1

# Simpler ad-hoc factory function, no extra dependency
def make_order(**overrides):
    defaults = {"order_id": 1, "customer_id": 10, "amount": 50.0, "status": "completed"}
    return {**defaults, **overrides}

def test_cancelled_orders_excluded():
    orders = [make_order(status="cancelled"), make_order(order_id=2)]
    assert len(filter_active(orders)) == 1
```

## 📸 Snapshot / Golden File Testing

```python
# syrupy: general-purpose snapshot testing for pytest
def test_transform_output(snapshot):
    result = transform_pipeline(sample_input())
    assert result == snapshot   # first run writes the snapshot, subsequent runs compare against it

# Manual golden-file pattern (no extra dependency)
import json
from pathlib import Path

def test_report_matches_golden_file():
    result = generate_report(sample_data())
    golden_path = Path("tests/golden/report.json")
    expected = json.loads(golden_path.read_text())
    assert result == expected

# Regenerating golden files deliberately, e.g.:
# GENERATE_GOLDEN=1 pytest tests/test_report.py
def test_generate_or_check(request):
    result = generate_report(sample_data())
    golden_path = Path("tests/golden/report.json")
    if os.environ.get("GENERATE_GOLDEN"):
        golden_path.write_text(json.dumps(result, indent=2))
    expected = json.loads(golden_path.read_text())
    assert result == expected
```

- Snapshot tests are best for **complex, hard-to-hand-write expected output** (large transformed DataFrames, rendered reports) — but review diffs carefully, since they can rubber-stamp regressions if updated blindly.

## 🎲 Property-Based Testing with Hypothesis

```python
from hypothesis import given, strategies as st
import hypothesis.extra.pandas as hpd

# Instead of hand-picking test cases, Hypothesis generates many, including edge cases
@given(a=st.integers(), b=st.integers())
def test_add_is_commutative(a, b):
    assert add(a, b) == add(b, a)

@given(amount=st.floats(min_value=0, max_value=1_000_000, allow_nan=False))
def test_apply_discount_never_negative(amount):
    assert apply_discount(amount, pct=10) >= 0

# Generate whole DataFrames matching a schema
@given(hpd.data_frames(columns=[
    hpd.column("amount", elements=st.floats(min_value=0, max_value=10000)),
    hpd.column("qty", elements=st.integers(min_value=1, max_value=100)),
]))
def test_total_is_never_negative(df):
    result = add_total(df)
    assert (result["total"] >= 0).all()
```

- Hypothesis is especially good at catching **edge cases you didn't think to write by hand** — empty strings, zero, negative numbers, extreme floats — on pure transformation logic.

## 🕰️ Freezing Time

```python
from freezegun import freeze_time
import datetime

@freeze_time("2024-06-01 12:00:00")
def test_report_uses_correct_date():
    assert generate_report_filename() == "report_2024-06-01.csv"

def test_time_travel_inline():
    with freeze_time("2024-01-01") as frozen:
        assert datetime.date.today() == datetime.date(2024, 1, 1)
        frozen.move_to("2024-01-02")
        assert datetime.date.today() == datetime.date(2024, 1, 2)
```

- Essential for testing **any logic with `now()`/`today()`** (partition naming, retention windows, "is this record stale") deterministically, instead of flaky tests that depend on when CI happens to run.

## 🏗️ Testing End-to-End Pipelines

```python
# Integration test exercising extract -> transform -> load with real (small) I/O
import pytest

@pytest.mark.integration
def test_pipeline_end_to_end(tmp_path, db_conn):
    input_path = tmp_path / "input.csv"
    input_path.write_text("order_id,amount\n1,50.0\n2,-5.0\n")

    run_pipeline(input_path=str(input_path), conn=db_conn)

    result = db_conn.execute("SELECT COUNT(*) FROM orders WHERE amount > 0").fetchone()
    assert result[0] == 1   # negative-amount row should have been filtered

# tmp_path / tmp_path_factory are built-in pytest fixtures for isolated temp directories
def test_writes_output_file(tmp_path):
    output_file = tmp_path / "output.parquet"
    process_and_save(sample_orders(), output_path=str(output_file))
    assert output_file.exists()
```

## ✅ Great Expectations vs pytest

| | pytest | Great Expectations |
| --- | --- | --- |
| Best for | Unit/integration testing of transformation *code* | Declarative data *quality* expectations, run against live datasets |
| When it runs | CI, on every code change | Often scheduled, against production/staging data itself |
| Output | Pass/fail per test function | Rich validation reports (HTML/JSON), data docs |
| Typical use | "Does this function correctly compute totals?" | "Does today's `orders` table have <1% nulls in `customer_id`?" |

```python
# They compose well: call GE expectations from inside a pytest test for CI-time validation
import great_expectations as gx

def test_orders_table_quality():
    context = gx.get_context()
    validator = context.sources.pandas_default.read_csv("tests/data/sample_orders.csv")
    validator.expect_column_values_to_not_be_null("order_id")
    validator.expect_column_values_to_be_between("amount", min_value=0, max_value=100000)
    result = validator.validate()
    assert result.success
```

## 🏷️ Markers & Test Organization

```python
import pytest

@pytest.mark.slow
def test_full_backfill():
    ...

@pytest.mark.integration
def test_requires_live_database():
    ...

@pytest.mark.skip(reason="Flaky pending upstream fix")
def test_known_broken():
    ...

@pytest.mark.skipif(sys.platform == "win32", reason="POSIX-only path handling")
def test_unix_paths():
    ...

@pytest.mark.xfail(reason="Bug tracked in JIRA-1234")
def test_edge_case_not_yet_fixed():
    ...
```

```bash
pytest -m "not slow"                  # skip slow tests in local dev loop
pytest -m "integration"               # run only integration tests (e.g., nightly CI job)
pytest -m "not integration"           # fast unit-only run for pre-commit
```

## 📈 Coverage & CI Integration

```bash
pytest --cov=src --cov-report=term-missing --cov-report=html
# Fail the build if coverage drops below a threshold
pytest --cov=src --cov-fail-under=80
```

```yaml
# .github/workflows/test.yml
name: tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r requirements.txt -r requirements-test.txt
      - run: pytest -m "not slow" --cov=src --cov-report=xml --cov-fail-under=80
      - run: pytest -m "integration"   # separate job/stage for slower integration tests
```

## 🏗️ dbt Test Integration

```yaml
# schema.yml — dbt's own generic + singular tests cover data-quality assertions declaratively
models:
  - name: orders
    columns:
      - name: order_id
        tests: [unique, not_null]
      - name: status
        tests:
          - accepted_values:
              values: ["placed", "shipped", "cancelled"]
      - name: customer_id
        tests:
          - relationships:
              to: ref('customers')
              field: customer_id
```

```bash
dbt test                          # run all schema + singular tests
dbt test --select orders          # scope to one model
dbt build                         # run models AND tests together, stopping downstream on failure
```

```python
# Calling dbt tests from within a pytest suite — useful for wrapping dbt in a larger CI gate
import subprocess

def test_dbt_tests_pass():
    result = subprocess.run(["dbt", "test", "--select", "orders"], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout
```

- **dbt's built-in tests are the right tool for declarative, per-column data-quality checks** against tables that already exist in the warehouse; **pytest is the right tool for testing the Python transformation code** (custom macros' logic, or any non-SQL step) around a dbt project.
- Wrapping `dbt test` inside a pytest call (as above) is mainly useful for **unifying CI reporting** — one `pytest` invocation and one coverage/result summary — not because pytest adds testing power dbt lacks for SQL-level checks.

## 🌬️ Testing Airflow DAGs

```python
# DAG-level structural tests — catch import errors, cycles, and missing dependencies fast
import pytest
from airflow.models import DagBag

@pytest.fixture(scope="session")
def dagbag():
    return DagBag(dag_folder="dags/", include_examples=False)

def test_no_import_errors(dagbag):
    assert len(dagbag.import_errors) == 0, dagbag.import_errors

def test_dag_has_no_cycles(dagbag):
    dag = dagbag.get_dag("daily_revenue_etl")
    assert dag is not None
    dag.test_cycle()   # raises AirflowDagCycleException if a cycle exists

def test_expected_task_count(dagbag):
    dag = dagbag.get_dag("daily_revenue_etl")
    assert len(dag.tasks) == 5

def test_task_dependencies(dagbag):
    dag = dagbag.get_dag("daily_revenue_etl")
    extract = dag.get_task("extract")
    assert "transform" in [t.task_id for t in extract.downstream_list]
```

```python
# Testing a single task's callable logic directly (unit test, no Airflow runtime needed)
from dags.daily_revenue_etl import transform_orders   # the plain Python function behind the task

def test_transform_orders_filters_negative_amounts():
    input_rows = [{"amount": 50}, {"amount": -10}]
    result = transform_orders(input_rows)
    assert len(result) == 1

# Full task-level execution test with a mocked context (heavier, closer to integration)
from airflow.models import TaskInstance
from airflow.utils.state import State

def test_task_runs_successfully(dagbag):
    dag = dagbag.get_dag("daily_revenue_etl")
    task = dag.get_task("transform")
    ti = TaskInstance(task=task, execution_date=pendulum.now())
    ti.run(ignore_ti_state=True)
    assert ti.state == State.SUCCESS
```

- **Keep task logic in plain, importable Python functions** rather than inline in the `PythonOperator`'s lambda/closure — this is what makes the "unit test the callable directly" pattern above possible without touching Airflow's runtime at all.
- **DAG structural tests (`DagBag`, cycle checks, task-count assertions) are cheap and catch a large class of "someone broke the DAG file" mistakes** before they reach a scheduler.

## 📜 Contract Testing Between Pipeline Stages

```python
# A "contract test" asserts the boundary between two pipeline stages, independent of either
# stage's internal implementation — e.g., "whatever extract() returns, transform() must accept."
import pandas as pd

EXTRACT_OUTPUT_SCHEMA = {"order_id": "int64", "customer_id": "int64", "amount": "float64", "order_date": "object"}

def test_extract_output_matches_contract():
    df = extract_orders()
    assert dict(df.dtypes.astype(str)) == EXTRACT_OUTPUT_SCHEMA

def test_transform_accepts_contract_shaped_input():
    # Build input purely from the CONTRACT, not from calling extract() itself —
    # this is what lets the two stages' tests evolve independently.
    contract_df = pd.DataFrame({
        "order_id": [1], "customer_id": [1], "amount": [10.0], "order_date": ["2024-01-01"]
    })
    result = transform_orders(contract_df)
    assert not result.empty

# Pact-style consumer-driven contracts for a pipeline that serves data to another team's system
def test_downstream_consumer_contract():
    """Encodes what the downstream consumer team said they rely on — breaks loudly if we
    change something they depend on without coordinating."""
    df = load_final_output()
    assert "customer_ltv" in df.columns          # they build a dashboard directly on this column
    assert df["customer_ltv"].dtype == "float64"
```

- Contract tests catch **the specific class of bug where two independently-changing pipeline stages (or two teams) silently drift apart** — stage A starts returning a renamed column, stage B breaks in production, and neither team's own unit tests caught it because each only tested itself in isolation.
- Write the contract test's input **from the documented/agreed shape, not by calling the upstream function** — otherwise the "contract" just re-tests today's implementation rather than the interface both sides agreed to.

## 🔁 Testing Pipeline Idempotency

```python
# A correct pipeline should produce the same result whether run once or accidentally run twice
# (a very common real-world failure mode: retried Airflow tasks, at-least-once CDC delivery, etc.)

def test_pipeline_is_idempotent(tmp_path, db_conn):
    input_path = tmp_path / "input.csv"
    input_path.write_text("order_id,amount\n1,50.0\n2,75.0\n")

    run_pipeline(input_path=str(input_path), conn=db_conn)
    first_run_count = db_conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0]

    run_pipeline(input_path=str(input_path), conn=db_conn)   # run again, same input
    second_run_count = db_conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0]

    assert first_run_count == second_run_count, "Re-running the pipeline duplicated rows"

def test_upsert_overwrites_not_appends(db_conn):
    upsert_order(db_conn, order_id=1, amount=50.0)
    upsert_order(db_conn, order_id=1, amount=75.0)   # same key, new value
    rows = db_conn.execute("SELECT amount FROM orders WHERE order_id=1").fetchall()
    assert len(rows) == 1
    assert rows[0][0] == 75.0
```

- Idempotency tests are especially important for **any pipeline consuming at-least-once sources (CDC, Kafka, retried orchestrator tasks)** — the "run twice, assert identical state" pattern above is the standard way to verify a pipeline handles reprocessing safely, rather than assuming it based on code review alone.

## 🧬 Mutation Testing

```bash
pip install mutmut
mutmut run --paths-to-mutate=src/transform.py
mutmut results
mutmut show 3          # inspect what mutation #3 was and whether tests caught it
```

```bash
# Alternative: cosmic-ray, more configurable, more setup
pip install cosmic-ray
cosmic-ray init config.toml session.sqlite
cosmic-ray baseline config.toml
cosmic-ray exec config.toml session.sqlite
cr-report session.sqlite
```

- Mutation testing **deliberately introduces small bugs (flip a comparison, change a constant) into your code and reruns the test suite** — a mutation that survives (tests still pass) reveals a gap in coverage that line-coverage percentages alone don't surface.
- Most valuable on **critical, well-covered-by-line-count transformation logic** where you want confidence the tests actually assert the right things, not just that they execute the lines — not worth running on the whole codebase routinely due to runtime cost.

## ⚠️ Common Gotchas

- **Fixture scope mismatches cause subtle state leakage** — a `session`-scoped mutable fixture (e.g., a DataFrame) modified by one test silently affects the next test unless you explicitly reset or copy it.
- **`assert_frame_equal` is strict by default** — dtype and column-order mismatches fail even when values are logically equal; use `check_dtype=False`/`check_like=True` deliberately, not as a reflex to silence failures.
- **Floating-point equality in assertions** — comparing computed float aggregates with `==` is fragile; use `pytest.approx()` or `check_exact=False` on DataFrame comparisons.
- **Tests that depend on `datetime.now()`/`date.today()` are flaky by construction** — freeze time explicitly instead of hoping the test runs fast enough.
- **Over-mocking hides real bugs** — mocking the database call itself in an "integration" test just tests your mock, not your SQL; reserve heavy mocking for true unit tests and use real (in-memory/containerized) systems for integration tests.
- **Spark session fixtures created per-test** add seconds of JVM startup overhead per test — always scope to `session` unless tests need genuine isolation.
- **Golden/snapshot files updated blindly (`--snapshot-update`) without reviewing the diff** can silently bake a regression in as the new "expected" output.

## 🎯 Best Practices

- Separate **fast unit tests** (pure functions, mocked I/O) from **slower integration tests** (real DB/Spark/cloud) via markers, and run the fast suite on every commit.
- Test **data quality invariants as pytest assertions** (no nulls in keys, values within expected range, uniqueness) alongside transformation logic tests — catch pipeline bugs, not just code bugs.
- Use **factories or fixtures for test data**, never hand-copy-pasted DataFrame literals scattered across many test files — one change point when the schema evolves.
- Keep **small, checked-in sample datasets** (`tests/data/`) for deterministic, fast integration tests instead of hitting live systems in CI.
- Set a **coverage floor in CI** (`--cov-fail-under`) but don't chase 100% — prioritize testing transformation logic and edge cases over trivial getters/setters.

## 💡 Pro Tips

1. **`tmp_path` (built into pytest) is the right way to test file I/O** — automatic cleanup, no test pollution, no cross-test collisions.
2. **`pytest -k` and `-m` together let you build a fast, targeted local dev loop** (`pytest -k "transform and not slow"`) without touching test file structure.
3. **Hypothesis often finds bugs faster than a human writing edge cases by hand** — especially valuable for pure transformation/validation functions with numeric inputs.
4. **`chispa` is to PySpark testing what `pandas.testing`/`polars.testing` are to their respective libraries** — don't hand-roll DataFrame comparison logic.
5. **Session-scoped fixtures for expensive setup (Spark, Docker containers via testcontainers) dramatically cut CI time** — measure before assuming function-scope is "safer," and reset state explicitly if needed instead.
6. **`freeze_time` + parametrize combine well** for testing date-dependent logic (retention windows, partition boundaries) across multiple points in time in one test.
7. **Run `pytest --collect-only`** to sanity-check which tests will actually run under a given `-k`/`-m` filter before trusting a CI stage's scope.
