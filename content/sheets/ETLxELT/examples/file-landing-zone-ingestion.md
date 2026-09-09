# Example 8: File-Based Landing Zone Ingestion

**Pipeline Type: ETL** — schema validation and row-level splitting (valid vs quarantine) happen in Python *before* anything is loaded into Snowflake.

## Scenario & Business Context

A logistics partner drops daily CSV files of shipment records into an S3 bucket on an inconsistent schedule, with occasional malformed rows and schema changes the partner doesn't announce in advance. The pipeline must ingest reliably without a single bad file breaking the whole load.

## Architecture

```
Partner SFTP → S3 landing/ (raw file drop, event-triggered)
                    │
                    ▼
        Lambda/Airflow sensor detects new file (S3 event)
                    │
                    ▼
        Schema validation + row-level checks
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  Valid rows → raw.shipments   Invalid rows → quarantine.shipments_rejects
        │
        ▼
   dbt staging/marts (Silver/Gold)
```

## Full Implementation

### 1. S3 event-triggered detection (Airflow sensor)

```python
from airflow.providers.amazon.aws.sensors.s3 import S3KeySensor

wait_for_file = S3KeySensor(
    task_id="wait_for_shipment_file",
    bucket_name="partner-landing-zone",
    bucket_key="shipments/{{ ds }}/*.csv",
    wildcard_match=True,
    timeout=60 * 60 * 6,   # alert if file hasn't arrived within 6 hours
    poke_interval=300,
)
```

### 2. Schema validation before loading (Python, using pandas + pandera-style checks)

```python
import pandas as pd

REQUIRED_COLUMNS = {"shipment_id", "tracking_number", "status", "ship_date", "weight_kg"}

def validate_and_split(filepath: str):
    df = pd.read_csv(filepath)

    missing_cols = REQUIRED_COLUMNS - set(df.columns)
    if missing_cols:
        raise ValueError(f"Schema drift detected — missing columns: {missing_cols}")

    valid_mask = (
        df["shipment_id"].notna()
        & df["weight_kg"].apply(lambda x: pd.notna(x) and x > 0)
        & df["status"].isin(["pending", "in_transit", "delivered", "returned"])
    )

    valid_rows = df[valid_mask]
    invalid_rows = df[~valid_mask].copy()
    invalid_rows["rejection_reason"] = "failed_row_validation"

    return valid_rows, invalid_rows
```

### 3. Load valid rows, quarantine invalid rows

```python
def load_to_snowflake(valid_df, invalid_df, batch_date):
    valid_df.to_sql("shipments", snowflake_engine, schema="raw", if_exists="append", index=False)

    if not invalid_df.empty:
        invalid_df.to_sql("shipments_rejects", snowflake_engine, schema="quarantine", if_exists="append", index=False)
        alert_slack(
            channel="#data-quality",
            message=f"⚠️ {len(invalid_df)} rows quarantined from shipments file ({batch_date})"
        )
```

### 4. dbt freshness + row-count sanity check

```yaml
sources:
  - name: raw
    tables:
      - name: shipments
        freshness:
          warn_after: {count: 26, period: hour}
          error_after: {count: 48, period: hour}
```

```sql
-- tests/assert_shipment_volume_within_range.sql
-- Fails if today's row count is less than 20% of the 7-day rolling average — likely a partial/truncated file
WITH daily_counts AS (
  SELECT ship_date, COUNT(*) AS row_count
  FROM {{ source('raw', 'shipments') }}
  GROUP BY ship_date
),
rolling_avg AS (
  SELECT ship_date, AVG(row_count) OVER (ORDER BY ship_date ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING) AS avg_7d
  FROM daily_counts
)
SELECT d.ship_date, d.row_count, r.avg_7d
FROM daily_counts d JOIN rolling_avg r ON d.ship_date = r.ship_date
WHERE d.row_count < 0.2 * r.avg_7d
```

### 5. Airflow DAG assembly

```python
with DAG("shipment_file_ingestion", schedule_interval="@daily", catchup=False) as dag:
    wait_for_file = S3KeySensor(...)  # as above
    validate_and_load = PythonOperator(task_id="validate_and_load", python_callable=validate_and_split_and_load)
    dbt_run = BashOperator(task_id="dbt_run", bash_command="dbt run --select +fact_shipments")
    dbt_test = BashOperator(task_id="dbt_test", bash_command="dbt test --select +fact_shipments")

    wait_for_file >> validate_and_load >> dbt_run >> dbt_test
```

## Design Rationale

- **Row-level quarantine instead of failing the whole file** — a handful of malformed rows shouldn't block the other 99% of valid shipment data from being available same-day (see file 07 — Validation Rules).
- **Explicit schema check before load** — catches schema drift (a renamed or missing column) immediately with a clear error, rather than letting malformed data silently flow into `raw.shipments` with nulls (see file 02 — Schema Drift).
- **S3 sensor with timeout** — treats "file didn't arrive" as a distinct, alertable failure mode separate from "file arrived but was invalid," since the two require different responses.
- **Rolling-average volume check** — catches partial/truncated file uploads that pass row-level validation but represent a much smaller file than expected (a subtler failure mode than a fully malformed file).

## Production Considerations

- Keep **quarantined rows queryable and reviewable** by the partner-facing team, not just logged — they'll often need to go back to the partner with specific examples of malformed data.
- Version and **archive raw files** (don't delete after processing) — reprocessing after a validation logic bug fix requires the original file, not just what was already loaded.
- Watch for **partner schema changes without notice** — build in periodic manual review of quarantine volume trends, since partners often don't proactively announce format changes.

## How to Extend This Example

- Add a **checksum/row-count manifest file** requirement with the partner, if possible, to detect truncated uploads before even attempting validation.
- Generalize the validation framework into a reusable library (e.g., using Great Expectations) so new partner file feeds can reuse the same quarantine pattern with a new schema config, not new code.
- Add a **self-serve quarantine dashboard** so the partner-ops team can see and act on rejected rows without needing engineering to query the quarantine table directly.
