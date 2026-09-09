# Example 6: Safe Backfill After a Bug Fix

**Pipeline Type: ELT** — backfill re-runs a dbt incremental model, transforming already-loaded raw data in-warehouse; nothing is re-extracted from source.

## Scenario & Business Context

A bug in the currency conversion logic under-counted revenue for the past 45 days. The fix is ready, but historical data must be corrected without disrupting the live daily pipeline, without double-counting, and with a clear audit trail of what changed.

## Architecture

```
Fix deployed to transformation logic
   │
   ▼
Chunked backfill job (1 day at a time, parameterized by execution_date)
   │
   ├── Day N: DELETE partition → re-INSERT with fixed logic (idempotent)
   │
   ▼
Validation: compare corrected totals vs pre-fix baseline snapshot
   │
   ▼
Audit log entry recorded (who, when, why, affected date range)
```

## Full Implementation

### 1. Parametrized transformation (must accept a date, never assume "now")

```sql
-- models/marts/fact_revenue.sql
{{ config(materialized='incremental', unique_key='order_id') }}

SELECT
  order_id,
  amount_local,
  currency,
  amount_local * {{ get_fx_rate('currency', 'order_date') }} AS amount_usd,  -- fixed logic
  order_date
FROM {{ ref('stg_orders') }}
{% if is_incremental() %}
WHERE order_date = '{{ var("backfill_date", run_started_at.strftime("%Y-%m-%d")) }}'
{% endif %}
```

### 2. Pre-backfill baseline snapshot (for validation later)

```sql
CREATE TABLE audit.fact_revenue_pre_backfill_20260215 AS
SELECT order_date, SUM(amount_usd) AS total_revenue
FROM marts.fact_revenue
WHERE order_date BETWEEN '2026-01-01' AND '2026-02-14'
GROUP BY order_date;
```

### 3. Chunked backfill script (idempotent per day)

```bash
#!/bin/bash
# backfill_revenue.sh — re-run safely; each day is independently idempotent
START_DATE="2026-01-01"
END_DATE="2026-02-14"

current="$START_DATE"
while [[ "$current" < "$END_DATE" || "$current" == "$END_DATE" ]]; do
  echo "Backfilling $current..."

  # Idempotent: delete then re-insert scoped to exactly this partition
  snowflake-cli query "DELETE FROM marts.fact_revenue WHERE order_date = '$current';"

  dbt run --select fact_revenue --vars "{\"backfill_date\": \"$current\"}"

  if [ $? -ne 0 ]; then
    echo "FAILED on $current — stopping. Re-run script to resume from this date."
    exit 1
  fi

  current=$(date -I -d "$current + 1 day")
done
echo "Backfill complete."
```

### 4. Post-backfill validation

```sql
-- Compare corrected totals against the pre-backfill baseline
SELECT
  b.order_date,
  b.total_revenue           AS revenue_before,
  a.total_revenue           AS revenue_after,
  a.total_revenue - b.total_revenue AS delta
FROM audit.fact_revenue_pre_backfill_20260215 b
JOIN (
  SELECT order_date, SUM(amount_usd) AS total_revenue
  FROM marts.fact_revenue
  WHERE order_date BETWEEN '2026-01-01' AND '2026-02-14'
  GROUP BY order_date
) a ON a.order_date = b.order_date
ORDER BY b.order_date;
```

### 5. Audit log entry

```sql
INSERT INTO audit.backfill_log (backfill_id, table_name, date_range_start, date_range_end, reason, executed_by, executed_at)
VALUES ('bf-2026-0215-01', 'marts.fact_revenue', '2026-01-01', '2026-02-14',
        'Fixed currency conversion bug (JIRA-4521)', 'jane.doe', CURRENT_TIMESTAMP);
```

## Design Rationale

- **Day-by-day chunking, not one 45-day job** — a failure on day 30 only requires resuming from day 30, not restarting the entire range (see file 04 — Backfilling Strategies).
- **`DELETE` + re-`INSERT` scoped to a single partition** — this is idempotent by construction: re-running the same day twice produces the same result, so the script is safe to re-run after any failure without manual cleanup (see file 04 — Idempotency).
- **Pre-backfill baseline snapshot** — without this, there's no way to later prove *what changed* and by how much, which matters for finance audit trails.
- **Explicit audit log** — regulated/finance-adjacent data changes should always be traceable to a person, reason, and ticket, not just visible in a Git commit history.

## Production Considerations

- Run backfills **during low-traffic windows** if the fact table is large and reads happen concurrently — a `DELETE` + `INSERT` briefly makes that day's data incomplete mid-operation.
- For very large fact tables, consider writing to a **shadow table** and atomically swapping partitions instead of `DELETE`+`INSERT`, to avoid any window of incomplete data.
- Never backfill directly against a table serving live BI queries without a swap or maintenance-window strategy — analysts may see partial data mid-backfill.

## How to Extend This Example

- Wrap the backfill script in an Airflow DAG using `dagrun_timeout` and per-task retries instead of a raw bash loop, for better observability (see file 05).
- Add a **dry-run mode** that computes the delta without writing, so the team can review expected impact before executing a financial data correction.
- Generalize the script into a reusable `backfill_utils.sh` used across all fact tables, rather than a one-off script per incident.
