# Quick Reference

## SQL Snippet Index

```sql
-- Incremental extraction watermark
SELECT * FROM source_table WHERE updated_at > :last_run_timestamp;

-- Deduplication (keep latest per key)
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) AS rn
  FROM staging_table
) WHERE rn = 1;

-- Upsert / Merge
MERGE INTO target t
USING staging s ON t.id = s.id
WHEN MATCHED THEN UPDATE SET t.value = s.value
WHEN NOT MATCHED THEN INSERT (id, value) VALUES (s.id, s.value);

-- Running total (window function)
SELECT date, amount,
       SUM(amount) OVER (ORDER BY date) AS running_total
FROM sales;

-- SCD Type 2 close-out + insert
UPDATE dim_customer SET end_date = CURRENT_DATE, is_current = FALSE
WHERE customer_id = :id AND is_current = TRUE;
INSERT INTO dim_customer (customer_id, name, start_date, end_date, is_current)
VALUES (:id, :new_name, CURRENT_DATE, NULL, TRUE);

-- Referential integrity check
SELECT o.order_id FROM orders o
LEFT JOIN customers c ON o.customer_id = c.customer_id
WHERE c.customer_id IS NULL;

-- Freshness check
SELECT MAX(updated_at) < CURRENT_TIMESTAMP - INTERVAL '2 hours' AS is_stale
FROM orders;
```

## CLI Command Index

```bash
# Airflow: trigger a DAG run manually
airflow dags trigger my_dag_id

# Airflow: backfill a date range
airflow dags backfill -s 2026-01-01 -e 2026-01-31 my_dag_id

# dbt: run all models
dbt run

# dbt: run tests
dbt test

# dbt: run a single model and its downstream dependents
dbt run --select my_model+

# dbt: full refresh an incremental model
dbt run --select my_model --full-refresh
```

## Glossary

| Term | Definition |
|---|---|
| CDC | Change Data Capture — capturing row-level changes from a source in near real-time |
| Idempotency | Property where re-running an operation produces the same result as running it once |
| Watermark | A column/value used to track progress for incremental extraction |
| SCD | Slowly Changing Dimension — pattern for tracking changes to dimension data over time |
| DAG | Directed Acyclic Graph — defines task dependencies with no circular references |
| Data Contract | Formal schema/SLA agreement between data producer and consumer |
| Backfill | Reprocessing historical data through a pipeline |
| Lineage | Traceable path of data from source to final output |
| Data Skew | Uneven distribution of data across partitions causing processing bottlenecks |
| Freshness | How recent a dataset is relative to expectations |
| Schema Drift | Unannounced changes to a source system's schema |
| Medallion Architecture | Bronze/Silver/Gold layered data organization pattern |

## Tool Comparison Quick Table

| Need | Reach For |
|---|---|
| Managed ingestion, no code | Fivetran / Airbyte |
| Log-based CDC | Debezium |
| SQL-based transformation | dbt |
| Large-scale distributed compute | Spark |
| Workflow orchestration | Airflow / Dagster / Prefect |
| Real-time event streaming | Kafka / Kinesis |
| Cloud warehouse | Snowflake / BigQuery / Redshift |
| Lakehouse (lake + warehouse) | Databricks / Delta Lake |
| Data quality testing | dbt tests / Great Expectations |
| Lineage & observability | OpenLineage / Monte Carlo / dbt docs |

## Decision Checklist (Quick Gut-Check)

- **New pipeline, unsure ETL vs ELT?** → Default to ELT if using a modern cloud warehouse.
- **Choosing a load strategy?** → Upsert/merge unless data is purely immutable events (then append).
- **Need historical accuracy on a changing attribute?** → SCD Type 2.
- **Pipeline keeps duplicating data on retry?** → Add idempotent merge logic, not just retries.
- **Dashboard numbers look wrong?** → Check Data Quality → Monitoring → Lineage, in that order.
