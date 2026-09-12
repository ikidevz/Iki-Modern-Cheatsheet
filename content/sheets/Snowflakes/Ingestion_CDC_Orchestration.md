# 📥 Ingestion, CDC & Orchestration

> Snowpipe, batch loads, Streams+Tasks pipelines, and DAG orchestration — the daily-driver DE toolkit.

---

## 1. Stages (where files land before/instead of loading)

```sql
-- Internal stage (Snowflake-managed storage)
CREATE STAGE my_internal_stage;

-- User stage (implicit, always exists per user — @~)
PUT file:///local/path/orders.csv @~;

-- Table stage (implicit, always exists per table — @%tablename)
COPY INTO orders FROM @%orders;

-- External stage pointing at existing cloud storage
CREATE STAGE my_s3_stage
    URL = 's3://my-bucket/raw/'
    STORAGE_INTEGRATION = my_s3_integration;   -- preferred over embedding keys

-- Storage integration (the secure, recommended way to connect cloud storage — no keys in DDL)
CREATE STORAGE INTEGRATION my_s3_integration
    TYPE = EXTERNAL_STAGE
    STORAGE_PROVIDER = 'S3'
    ENABLED = TRUE
    STORAGE_AWS_ROLE_ARN = 'arn:aws:iam::123456789:role/snowflake-role'
    STORAGE_ALLOWED_LOCATIONS = ('s3://my-bucket/raw/');

-- Grab the AWS IAM user/external ID Snowflake generated, to complete the trust policy on the AWS side
DESC STORAGE INTEGRATION my_s3_integration;

-- List files in a stage
LIST @my_s3_stage;

-- Remove processed files from a stage (housekeeping)
REMOVE @my_s3_stage/orders/ PATTERN='.*2025.*';
```

### 1.1 File Formats (define once, reuse everywhere)

```sql
CREATE FILE FORMAT my_json_format
    TYPE = 'JSON'
    STRIP_OUTER_ARRAY = TRUE
    NULL_IF = ('NULL', 'null', '');

CREATE FILE FORMAT my_csv_format
    TYPE = 'CSV'
    FIELD_DELIMITER = ','
    SKIP_HEADER = 1
    FIELD_OPTIONALLY_ENCLOSED_BY = '"'
    NULL_IF = ('NULL', '\\N', '');

CREATE FILE FORMAT my_parquet_format
    TYPE = 'PARQUET';

-- Reference a named format instead of inlining options every time
COPY INTO raw.orders FROM @my_s3_stage/orders/ FILE_FORMAT = (FORMAT_NAME = 'my_json_format');
```

---

## 2. Bulk Loading: `COPY INTO`

The workhorse for batch/scheduled loads.

```sql
COPY INTO raw.orders
FROM @my_s3_stage/orders/
FILE_FORMAT = (TYPE = 'PARQUET')
PATTERN = '.*orders_2026.*[.]parquet'
ON_ERROR = 'CONTINUE'          -- or 'SKIP_FILE', 'SKIP_FILE_<n>', 'ABORT_STATEMENT' (default)
PURGE = FALSE                  -- set TRUE to delete source files after successful load
FORCE = FALSE;                 -- FALSE (default) skips files already loaded — this is what makes COPY INTO idempotent

-- Check load history / diagnose failures
SELECT *
FROM table(information_schema.copy_history(
    table_name => 'ORDERS',
    start_time => dateadd('hours', -24, current_timestamp())
));

-- Validate a load without committing (dry run)
COPY INTO raw.orders
FROM @my_s3_stage/orders/
FILE_FORMAT = (TYPE = 'PARQUET')
VALIDATION_MODE = 'RETURN_ERRORS';

-- Column mapping / transformation during load (avoid a separate staging + transform step
-- for simple cases)
COPY INTO raw.orders (order_id, order_date, amount)
FROM (
    SELECT $1:id::INT, $1:date::DATE, $1:total::NUMBER(10,2)
    FROM @my_s3_stage/orders/
)
FILE_FORMAT = (TYPE = 'JSON');
```

> 🔑 **Idempotency key fact:** `COPY INTO` tracks a **load metadata cache** of already-loaded files per table/stage combo for **64 days**. Re-running the same `COPY INTO` against the same stage will NOT reload files it already ingested — this is what makes it safe to schedule on a loop without manual watermarking, unlike a naive `INSERT` from an external table scan.

### 2.1 Error Handling Strategies

```sql
-- Strategy 1: skip bad rows, keep loading (good for high-volume, tolerant-of-loss pipelines)
COPY INTO raw.orders FROM @my_s3_stage/orders/ ON_ERROR = 'CONTINUE';

-- Strategy 2: quarantine bad files into a dead-letter pattern
COPY INTO raw.orders FROM @my_s3_stage/orders/ ON_ERROR = 'SKIP_FILE';

SELECT file_name, first_error_message, error_count
FROM table(information_schema.copy_history(table_name=>'ORDERS', start_time=>dateadd('day',-1,current_timestamp())))
WHERE status != 'LOADED';

-- Strategy 3: fail hard, investigate before any partial load lands (safest for financial data)
COPY INTO raw.orders FROM @my_s3_stage/orders/ ON_ERROR = 'ABORT_STATEMENT';
```

---

## 3. Snowpipe (event-driven, near-real-time micro-batch)

Auto-ingests new files as they land, without a running warehouse (serverless, billed per-file/per-second).

```sql
CREATE PIPE my_pipe
    AUTO_INGEST = TRUE
AS
COPY INTO raw.orders
FROM @my_s3_stage/orders/
FILE_FORMAT = (TYPE = 'PARQUET');

-- AUTO_INGEST relies on cloud provider event notifications (S3 Event Notifications → SQS,
-- or Azure Event Grid, or GCS Pub/Sub) — you must wire the bucket notification to the
-- SQS ARN Snowflake gives you:
SHOW PIPES LIKE 'my_pipe';   -- grab the "notification_channel" column

-- Manually trigger ingestion for files Snowpipe missed (notification gaps happen)
ALTER PIPE my_pipe REFRESH;

-- Refresh only a specific path/prefix (avoids rescanning the entire stage)
ALTER PIPE my_pipe REFRESH PREFIX = 'orders/2026/09/';

-- Check pipe status / lag
SELECT SYSTEM$PIPE_STATUS('my_pipe');

-- Pause/resume a pipe (e.g., during a planned maintenance window on the source system)
ALTER PIPE my_pipe SET PIPE_EXECUTION_PAUSED = TRUE;
ALTER PIPE my_pipe SET PIPE_EXECUTION_PAUSED = FALSE;

-- Historical load + error diagnostics for a pipe
SELECT *
FROM table(information_schema.copy_history(
    table_name => 'ORDERS',
    start_time => dateadd('hours', -24, current_timestamp())
))
WHERE pipe_name = 'MY_PIPE';
```

> ⚠️ **Common failure mode:** cloud notification queue misconfigured or hits a permissions issue → files land but never load, and there's no error thrown because Snowpipe never even sees the event. Always alert on `SYSTEM$PIPE_STATUS` lag, not just pipeline "success."

### 3.1 REST API Ingestion (push-based Snowpipe, no cloud event wiring needed)

```bash
# For sources that can call an API directly instead of relying on cloud storage events
curl -X POST \
  "https://<account>.snowflakecomputing.com/v1/data/pipes/mydb.myschema.my_pipe/insertFiles" \
  -H "Authorization: Bearer <jwt_token>" \
  -d '{"files": [{"path": "orders/batch_001.json"}]}'
```

---

## 4. Snowpipe Streaming (row-level, sub-second, no files/stages)

For high-throughput streaming sources (Kafka, custom apps) where writing intermediate files is wasteful.

- Ingests **rows directly via API** (Java/Python SDK) — no stage, no file, no `COPY INTO`
- Much lower latency than file-based Snowpipe (seconds vs minutes)
- Billed on ingested data volume + compute, not per-file
- Kafka Connector has a **Snowpipe Streaming mode** (`snowflake.ingestion.method = SNOWPIPE_STREAMING`) — flip this vs the legacy file-based Kafka connector mode for materially lower latency

```json
// Kafka connector config, streaming mode
{
  "name": "snowflake-sink",
  "config": {
    "connector.class": "com.snowflake.kafka.connector.SnowflakeSinkConnector",
    "topics": "orders-topic",
    "snowflake.topic2table.map": "orders-topic:raw_orders",
    "snowflake.ingestion.method": "SNOWPIPE_STREAMING",
    "snowflake.url.name": "myaccount.snowflakecomputing.com",
    "snowflake.user.name": "svc_kafka",
    "snowflake.private.key": "<pem_key>",
    "snowflake.database.name": "SALES_DB",
    "snowflake.schema.name": "RAW",
    "buffer.flush.time": "10",
    "buffer.count.records": "10000"
  }
}
```

```python
# Python SDK — direct row ingestion (no Kafka needed)
from snowflake.ingest.streaming import SnowflakeStreamingIngestClient

client = SnowflakeStreamingIngestClient("my_client", db_name="SALES_DB", schema_name="RAW", pipe_name="orders_pipe")
channel = client.open_channel("channel_1")
channel.insert_row({"order_id": 123, "amount": 49.99})
channel.close()
```

```text
Use Snowpipe Streaming when:      Use classic Snowpipe when:
- Kafka/event-stream source        - Files already land in cloud storage
- Sub-minute latency required      - Minute-level latency is fine
- High-frequency small payloads    - Batch-oriented file drops
```

---

## 5. Tasks (native scheduler)

```sql
-- Simple scheduled task
CREATE TASK refresh_orders_summary
    WAREHOUSE = etl_wh
    SCHEDULE = 'USING CRON 0 * * * * UTC'   -- hourly, standard cron syntax
AS
INSERT INTO orders_summary SELECT ... FROM orders;

-- Tasks are created SUSPENDED by default — must explicitly resume
ALTER TASK refresh_orders_summary RESUME;

-- Interval-based schedule instead of cron (simple "every N minutes")
CREATE TASK poll_task
    WAREHOUSE = etl_wh
    SCHEDULE = '5 MINUTE'
AS
CALL check_for_new_data();

-- Task DAG: chain tasks with dependencies via AFTER
CREATE TASK load_raw
    WAREHOUSE = etl_wh
    SCHEDULE = 'USING CRON 0 * * * * UTC'
AS
COPY INTO raw.orders FROM @my_s3_stage/orders/ FILE_FORMAT=(TYPE='PARQUET');

CREATE TASK transform_orders
    WAREHOUSE = etl_wh
    AFTER load_raw          -- runs only after load_raw succeeds
AS
MERGE INTO curated.orders t
USING raw.orders_stream s ON t.order_id = s.order_id
WHEN MATCHED THEN UPDATE SET t.status = s.status
WHEN NOT MATCHED THEN INSERT (order_id, status) VALUES (s.order_id, s.status);

-- Fan-out: multiple tasks depending on the same parent
CREATE TASK build_daily_summary AFTER load_raw AS INSERT INTO daily_summary SELECT ...;
CREATE TASK build_customer_summary AFTER load_raw AS INSERT INTO customer_summary SELECT ...;

-- Conditional execution — skip a run if no new data (saves credits)
CREATE TASK transform_orders
    WAREHOUSE = etl_wh
    AFTER load_raw
    WHEN SYSTEM$STREAM_HAS_DATA('orders_stream')
AS
MERGE INTO curated.orders ...;

-- Monitor DAG execution history
SELECT *
FROM table(information_schema.task_history())
WHERE name IN ('LOAD_RAW', 'TRANSFORM_ORDERS')
ORDER BY scheduled_time DESC;

-- Get the current DAG structure for a root task
SELECT SYSTEM$TASK_DEPENDENTS_ENABLE('load_raw');
SHOW TASKS LIKE 'load_raw';

-- Serverless tasks (no warehouse needed, Snowflake auto-manages compute size)
CREATE TASK refresh_orders_summary
    SCHEDULE = 'USING CRON 0 * * * * UTC'
    -- no WAREHOUSE clause = serverless, billed differently (own credit line)
AS
INSERT INTO orders_summary SELECT ... FROM orders;

-- Set a target size ceiling for serverless task compute (cost control)
ALTER TASK refresh_orders_summary SET USER_TASK_MANAGED_INITIAL_SIZE = 'MEDIUM';

-- Error handling: retry configuration
ALTER TASK transform_orders SET SUSPEND_TASK_AFTER_NUM_FAILURES = 3;

-- Manual one-off run outside the schedule (useful for backfills/testing)
EXECUTE TASK transform_orders;
```

> 🔑 **The canonical Snowflake-native CDC pattern:** `Stream` (tracks changes) + `Task` (`WHEN SYSTEM$STREAM_HAS_DATA` + `MERGE`) running on a schedule tighter than the base table's retention period. This replaces most of what you'd reach for Auto Loader + DLT for on Databricks.

### 5.1 Task Ownership & Grants

```sql
-- A task runs with the privileges of its OWNER role, not the role that triggers/resumes it
-- Common gotcha: task created by one role, ownership transferred, task now silently fails
-- with permission errors because the new owner role lacks a needed grant
SHOW GRANTS ON TASK transform_orders;

GRANT EXECUTE TASK ON ACCOUNT TO ROLE etl_role;   -- required to RESUME/ALTER tasks at all
```

---

## 6. Dynamic Tables (declarative, Databricks-DLT-style pipelines)

The newer, higher-abstraction alternative to hand-rolled Stream+Task — you declare the *result*, Snowflake figures out the incremental refresh.

```sql
CREATE DYNAMIC TABLE orders_summary
    TARGET_LAG = '1 hour'          -- how fresh the result must stay
    WAREHOUSE = etl_wh
AS
SELECT
    customer_id,
    DATE_TRUNC('day', order_date) AS order_day,
    SUM(amount) AS daily_total
FROM raw.orders
GROUP BY 1, 2;

-- Chain dynamic tables — Snowflake resolves the DAG and refresh order automatically
CREATE DYNAMIC TABLE orders_summary_weekly
    TARGET_LAG = '1 day'
    WAREHOUSE = etl_wh
AS
SELECT customer_id, DATE_TRUNC('week', order_day) AS week, SUM(daily_total) AS weekly_total
FROM orders_summary
GROUP BY 1, 2;

-- DOWNSTREAM target lag: let a table inherit freshness requirements from its consumer
-- rather than specifying an absolute value
CREATE DYNAMIC TABLE orders_summary
    TARGET_LAG = DOWNSTREAM
    WAREHOUSE = etl_wh
AS
SELECT ...;

-- Inspect the auto-generated refresh graph & lag compliance
SELECT *
FROM table(information_schema.dynamic_table_refresh_history('ORDERS_SUMMARY'));

SHOW DYNAMIC TABLES LIKE 'orders_summary%';   -- check "target_lag" vs actual observed lag

-- Manually trigger a refresh outside the normal schedule (useful right after a backfill)
ALTER DYNAMIC TABLE orders_summary REFRESH;

-- Suspend/resume like a task
ALTER DYNAMIC TABLE orders_summary SUSPEND;
ALTER DYNAMIC TABLE orders_summary RESUME;
```

> **When to reach for Dynamic Tables vs Stream+Task:** Dynamic Tables win for multi-step transformation DAGs where you don't want to hand-write incremental `MERGE` logic (closest analog to Databricks DLT). Stream+Task wins when you need fine-grained control over exactly what happens on each change (custom business logic per row, side effects, calling external functions).

### 6.1 Incremental vs Full Refresh

Snowflake automatically chooses between an incremental refresh (only processing changed rows, using change-tracking under the hood similar to Streams) and a full refresh (recomputing everything) based on the query complexity:

```sql
-- Check which refresh mode was actually used for recent runs
SELECT
    name, refresh_start_time, refresh_end_time, refresh_action, state
FROM table(information_schema.dynamic_table_refresh_history('ORDERS_SUMMARY'))
ORDER BY refresh_start_time DESC;
-- refresh_action: 'INCREMENTAL' or 'FULL' — non-incrementalizable queries
-- (e.g., queries with non-deterministic functions, certain window functions) force FULL every time
```

---

## 7. External Tables & Iceberg (query-in-place, no load)

```sql
-- Query files directly in cloud storage without loading (schema-on-read)
CREATE EXTERNAL TABLE ext_orders (
    order_id NUMBER AS (value:order_id::number),
    order_date DATE AS (value:order_date::date)
)
LOCATION = @my_s3_stage/orders/
FILE_FORMAT = (TYPE = 'PARQUET')
AUTO_REFRESH = TRUE;   -- keeps metadata in sync as new files land

-- Iceberg tables: Snowflake as a compute engine over externally-managed Iceberg storage
-- (interoperable with other engines like Spark, Trino reading the same files)
CREATE ICEBERG TABLE orders_iceberg
    EXTERNAL_VOLUME = 'my_external_volume'
    CATALOG = 'SNOWFLAKE'
    BASE_LOCATION = 'orders/';

-- Snowflake as an Iceberg REST catalog for external engines to read/write against
CREATE ICEBERG TABLE orders_iceberg
    EXTERNAL_VOLUME = 'my_external_volume'
    CATALOG = 'my_external_glue_catalog'   -- point at an externally-managed catalog instead
    CATALOG_TABLE_NAME = 'orders';
```

> **Why Iceberg matters for a multi-engine shop:** if Databricks/Spark also needs to read the *same physical data* Snowflake writes (or vice versa) without a duplicate ETL/export step, Iceberg tables are the interoperability layer — both engines read/write the same open-format files.

---

## 8. Orchestration Beyond Native Tasks

Native Tasks work well for Snowflake-only DAGs, but most real pipelines span multiple systems (S3 → Snowflake → dbt → BI tool refresh). External orchestrators are common:

```python
# Airflow example using the Snowflake provider
from airflow.providers.snowflake.operators.snowflake import SnowflakeOperator

load_task = SnowflakeOperator(
    task_id='load_orders',
    snowflake_conn_id='snowflake_conn',
    sql='CALL load_orders_procedure();',
)

transform_task = SnowflakeOperator(
    task_id='transform_orders',
    snowflake_conn_id='snowflake_conn',
    sql='CALL transform_orders_procedure();',
)

load_task >> transform_task
```

**Decision framework — native Tasks vs external orchestrator:**

| Signal | Choose |
|---|---|
| Entire DAG lives inside Snowflake (load → transform → aggregate) | Native Tasks / Dynamic Tables |
| Pipeline spans multiple systems (APIs, other databases, ML training jobs) | Airflow / Dagster / external orchestrator |
| Team already standardized on an orchestrator for non-Snowflake work | External orchestrator, call into Snowflake via operator/connector |
| Need rich alerting/retries/backfill UI out of the box | External orchestrator (Task monitoring UI is comparatively basic) |

---

## 9. Data Quality Checks in the Pipeline

```sql
-- Simple inline data quality gate inside a Task DAG — fail the pipeline before bad data propagates
CREATE TASK validate_orders
    WAREHOUSE = etl_wh
    AFTER load_raw
AS
BEGIN
    LET bad_count := (SELECT COUNT(*) FROM raw.orders WHERE amount < 0 OR order_id IS NULL);
    IF (bad_count > 0) THEN
        CALL SYSTEM$SEND_EMAIL('notification_integration', 'data-team@company.com',
            'Data quality failure', bad_count || ' bad rows found in raw.orders');
        RAISE data_quality_error;
    END IF;
END;
```

> For anything beyond simple row-count/null checks, most teams pair this with **dbt tests** (`unique`, `not_null`, `relationships`, custom singular tests) run as a CI/CD gate — see `DevOps_CICD.md`.

---

## 10. Quick Reference: Databricks ↔ Snowflake Ingestion

| Databricks concept | Snowflake equivalent |
|---|---|
| Auto Loader (`cloudFiles`) | Snowpipe (`AUTO_INGEST`) |
| DLT (Delta Live Tables) | Dynamic Tables |
| Structured Streaming | Snowpipe Streaming |
| Workflows / Jobs | Tasks (+ Task DAGs via `AFTER`) |
| Change Data Feed | Streams |
| `MERGE INTO` (Delta) | `MERGE INTO` (identical syntax, same semantics) |
| Bronze/Silver/Gold medallion | Same pattern — commonly `raw` → `staging`/streams → `curated` schemas |
| Kafka → Delta ingestion | Kafka Connector (Snowpipe Streaming mode) |
| Airflow/Databricks Workflows hybrid | Airflow + Snowflake provider operator |

---

## 11. Interview / Self-Check Q&A

**Q: Why is `COPY INTO` idempotent by default, and how does it know not to reload a file?**
A: It maintains a 64-day load metadata cache keyed on file path + checksum per table/stage combination; re-running the same command skips files already recorded as loaded unless `FORCE = TRUE` is set.

**Q: Snowpipe shows healthy status but new files aren't loading. What's the most likely cause?**
A: A break in the cloud-provider event notification chain (S3 event notification → SQS misconfigured, or a permissions issue) — files land but Snowflake never receives the event. `ALTER PIPE ... REFRESH` is the manual workaround while you fix the wiring.

**Q: When would you choose Dynamic Tables over a hand-written Stream+Task MERGE pipeline?**
A: When the pipeline is a multi-step transformation DAG where you want declarative freshness (`TARGET_LAG`) rather than hand-managing incremental logic — Dynamic Tables is a better fit than Stream+Task when you don't need custom row-level side effects.

**Q: A Stream has been sitting unconsumed for two weeks on a table with 1-day retention. What happens if you query it now?**
A: The stream is stale — its change-tracking offset exceeded the base table's retention window, so the recorded changes were already purged. You cannot recover the missed changes; you'd need to recreate the stream and reconcile via full reload if needed.

**Q: Why might a Dynamic Table run a FULL refresh every time instead of incremental, even though the source table only changes slightly each run?**
A: The defining query isn't "incrementalizable" — non-deterministic functions, certain window function patterns, or overly complex joins can force Snowflake to fall back to recomputing the entire result each time. Check `dynamic_table_refresh_history` for the `refresh_action` column.
