# Snowflake Cheatsheet

> A structured Snowflake reference — warehouses, loading data, semi-structured data, time travel & cloning, streams & tasks, dynamic tables, governance & security, data sharing, Snowpark, Cortex, and cost/performance tuning.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concepts](#core-concepts)
3. [🔌 Connecting & CLI](#connecting-cli)
4. [🏭 Warehouses](#warehouses)
5. [🗄️ Databases, Schemas & Tables](#databases-schemas-tables)
6. [🔤 Data Types](#data-types)
7. [📥 Data Loading](#data-loading)
8. [🌐 External Tables](#external-tables)
9. [🧬 Semi-Structured Data (VARIANT)](#semi-structured-data-variant)
10. [⏳ Time Travel & Cloning](#time-travel-cloning)
11. [🌊 Streams & Tasks](#streams-tasks)
12. [⚙️ Dynamic Tables](#dynamic-tables)
13. [👁️ Views & Materialized Views](#views-materialized-views)
14. [🔄 Transactions](#transactions)
15. [🔐 Roles & Access Control](#roles-access-control)
16. [🛡️ Governance & Security](#governance-security)
17. [🤝 Secure Data Sharing](#secure-data-sharing)
18. [⚡ Query Performance & Optimization](#query-performance-optimization)
19. [💰 Cost Management](#cost-management)
20. [🧪 Stored Procedures, UDFs & Snowpark](#stored-procedures-udfs-snowpark)
21. [🤖 Cortex (AI/ML in SQL)](#cortex-ai-ml-in-sql)
22. [⚠️ Common Gotchas](#common-gotchas)

## ⚡ Quick Reference

**Syntax cheatsheet**

| Task                              | Syntax                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| Create warehouse                  | `CREATE WAREHOUSE wh WAREHOUSE_SIZE='XSMALL' AUTO_SUSPEND=60 AUTO_RESUME=TRUE;`     |
| Switch context                    | `USE WAREHOUSE wh;` · `USE DATABASE db;` · `USE SCHEMA s;`                          |
| Create table                      | `CREATE TABLE t (id INT, name STRING);`                                             |
| Load data                         | `COPY INTO t FROM @stage FILE_FORMAT=(TYPE=CSV);`                                   |
| Query JSON                        | `SELECT data:key::string FROM t;`                                                   |
| Time travel                       | `SELECT * FROM t AT(OFFSET => -3600);`                                              |
| Zero-copy clone                   | `CREATE TABLE t_clone CLONE t;`                                                     |
| Undrop                            | `UNDROP TABLE t;`                                                                   |
| Change tracking                   | `CREATE STREAM s ON TABLE t;`                                                       |
| Scheduled job                     | `CREATE TASK job WAREHOUSE=wh SCHEDULE='5 MINUTE' AS ...;`                          |
| Auto-refreshing incremental table | `CREATE DYNAMIC TABLE dt TARGET_LAG='5 minutes' WAREHOUSE=wh AS ...;`               |
| Grant access                      | `GRANT SELECT ON TABLE t TO ROLE analyst;`                                          |
| Mask a column                     | `CREATE MASKING POLICY p AS (v STRING) RETURNS STRING -> ...;`                      |
| Share data outbound               | `CREATE SHARE s; GRANT USAGE ON DATABASE db TO SHARE s;`                            |
| Explain a run                     | `SELECT * FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY()) ORDER BY start_time DESC;` |

**Warehouse sizes** (each doubles credits/hour vs the previous)

`XSMALL` → `SMALL` → `MEDIUM` → `LARGE` → `XLARGE` → `2XLARGE` → `3XLARGE` → `4XLARGE` → `5XLARGE` → `6XLARGE`

## 🧠 Core Concepts

Snowflake separates **storage** and **compute**, which is the thing that makes it behave differently from a traditional database:

- **Storage layer** — fully managed, columnar, automatically compressed and split into micro-partitions (~16MB each). You don't design physical storage or indexes.
- **Compute layer** — **virtual warehouses**: independently sized, independently billed clusters of compute that run your queries. Multiple warehouses can read the same data at the same time with zero contention, because storage isn't tied to any one warehouse.
- **Cloud services layer** — metadata, query optimization, security/auth, transaction management — the "brain" that ties it together.

Object hierarchy: **Account → Database → Schema → Table / View / Stage / Stream / Task / Dynamic Table / etc.**

## 🔌 Connecting & CLI

```bash
# SnowSQL (official CLI)
snowsql -a xy12345.us-east-1 -u your_user -d DEV_DB -s PUBLIC -w DEV_WH
```

```python
# Python connector
import snowflake.connector

conn = snowflake.connector.connect(
    account='xy12345.us-east-1',
    user='your_user',
    password='your_password',
    warehouse='DEV_WH',
    database='DEV_DB',
    schema='PUBLIC',
    role='TRANSFORMER'
)

cur = conn.cursor()
cur.execute("SELECT * FROM orders LIMIT 10")
df = cur.fetch_pandas_all()
```

```python
# Bulk-write a pandas DataFrame straight into a table
from snowflake.connector.pandas_tools import write_pandas

success, nchunks, nrows, _ = write_pandas(
    conn, df, 'ORDERS', auto_create_table=True
)
```

## 🏭 Warehouses

```sql
CREATE WAREHOUSE compute_wh
  WAREHOUSE_SIZE = 'XSMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE;

ALTER WAREHOUSE compute_wh SET WAREHOUSE_SIZE = 'MEDIUM';
ALTER WAREHOUSE compute_wh RESUME;
ALTER WAREHOUSE compute_wh SUSPEND;

-- Multi-cluster: auto-scales OUT for concurrency (more users), not up (bigger queries)
CREATE WAREHOUSE bi_wh
  WAREHOUSE_SIZE = 'SMALL'
  MIN_CLUSTER_COUNT = 1
  MAX_CLUSTER_COUNT = 4
  SCALING_POLICY = 'STANDARD';

SHOW WAREHOUSES;
```

Warehouse size scales _query speed_ (more compute per query); multi-cluster scales _concurrency_ (more simultaneous queries). They solve different problems — pick based on whether queries are individually slow or the warehouse is queuing under load.

## 🗄️ Databases, Schemas & Tables

```sql
CREATE DATABASE IF NOT EXISTS raw_db;
CREATE SCHEMA IF NOT EXISTS raw_db.raw_schema;

CREATE TABLE raw_db.raw_schema.orders (
    order_id INT,
    customer_id INT,
    order_date DATE,
    amount NUMBER(10,2)
);

-- Transient: no fail-safe period, cheaper storage, good for staging/ETL intermediates
CREATE TRANSIENT TABLE staging_orders (order_id INT, payload VARIANT);

-- Temporary: session-scoped only, dropped automatically when the session ends
CREATE TEMPORARY TABLE tmp_orders (order_id INT);

SHOW TABLES IN SCHEMA raw_db.raw_schema;
DESC TABLE orders;
```

## 🔤 Data Types

Snowflake's type system is more forgiving than most engines on the surface, but has sharp edges worth knowing before you hit them in production.

| Category        | Types                                                            | Notes                                                                                                                                                                              |
| --------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Numeric         | `NUMBER(p,s)`, `INT`/`INTEGER`/`BIGINT`, `FLOAT`, `DOUBLE`       | `INT` is just `NUMBER(38,0)` under the hood — Snowflake doesn't have a distinct fixed-width integer. Exceeding declared precision raises an error rather than silently truncating. |
| String          | `VARCHAR(n)`, `STRING`, `TEXT`, `CHAR`                           | All are variable-length under the hood; `VARCHAR` with no length is effectively unlimited (up to 16MB). Declaring a length is documentation, not a performance optimization.       |
| Date/Time       | `DATE`, `TIME`, `TIMESTAMP_NTZ`, `TIMESTAMP_LTZ`, `TIMESTAMP_TZ` | This is the most common source of bugs — see callout below.                                                                                                                        |
| Semi-structured | `VARIANT`, `OBJECT`, `ARRAY`                                     | See the [VARIANT section](#semi-structured-data-variant).                                                                                                                          |
| Other           | `BOOLEAN`, `BINARY`, `GEOGRAPHY`, `GEOMETRY`                     | `GEOGRAPHY` uses lat/lon on a spherical model (for maps); `GEOMETRY` is planar (for CAD-style shapes).                                                                             |

**`TIMESTAMP_*` variants, explained:**

- `TIMESTAMP_NTZ` ("no time zone") — stores wall-clock value only, no offset. Two sessions in different time zones see the identical stored value. This is the **default** for bare `TIMESTAMP` unless you've changed the session parameter.
- `TIMESTAMP_LTZ` ("local time zone") — stored internally as UTC, then rendered in the querying session's `TIMEZONE` parameter. Same instant, different displayed value per session.
- `TIMESTAMP_TZ` ("with time zone") — stores the UTC instant _and_ the offset it was inserted with, so the original offset survives round-trips.

```sql
-- Check/set the session's default for bare TIMESTAMP and its display zone
SHOW PARAMETERS LIKE 'TIMESTAMP_TYPE_MAPPING';
ALTER SESSION SET TIMEZONE = 'America/New_York';
```

If you're comparing timestamps loaded from different source systems (some UTC, some local), pick `TIMESTAMP_TZ` deliberately rather than defaulting to `NTZ` — mixing the two silently produces wrong comparisons because Snowflake won't warn you that one side "means" a different moment than the other.

## 📥 Data Loading

```sql
-- Internal stage (Snowflake-managed storage)
CREATE STAGE my_stage;
```

```bash
# Upload a local file into the stage (run from SnowSQL)
PUT file:///local/path/orders.csv @my_stage;
```

```sql
-- External stage (e.g. S3)
CREATE STAGE s3_stage
  URL = 's3://my-bucket/orders/'
  CREDENTIALS = (AWS_KEY_ID = '...' AWS_SECRET_KEY = '...')
  FILE_FORMAT = (TYPE = 'CSV' SKIP_HEADER = 1);

-- Reusable file format object
CREATE FILE FORMAT my_csv_format
  TYPE = 'CSV'
  FIELD_DELIMITER = ','
  SKIP_HEADER = 1
  NULL_IF = ('NULL', '');

COPY INTO orders
FROM @s3_stage
FILE_FORMAT = (FORMAT_NAME = my_csv_format)
ON_ERROR = 'CONTINUE';

-- Snowflake tracks which files were already loaded — force a reload if needed
COPY INTO orders
FROM @s3_stage
FILE_FORMAT = (FORMAT_NAME = my_csv_format)
FORCE = TRUE;

-- Snowpipe: continuous, event-driven loading (auto-triggered on new files in cloud storage)
CREATE PIPE my_pipe
  AUTO_INGEST = TRUE
AS
COPY INTO orders FROM @s3_stage FILE_FORMAT = (FORMAT_NAME = my_csv_format);
```

## 🌐 External Tables

External tables let you query files sitting in cloud storage **in place** — no `COPY INTO`, no duplicated storage cost in Snowflake. Trade-off: slower than native tables (metadata-only, files stay in their original format) and no time travel.

```sql
CREATE EXTERNAL TABLE ext_orders (
    order_id NUMBER AS (VALUE:c1::NUMBER),
    order_date DATE AS (VALUE:c2::DATE),
    amount NUMBER AS (VALUE:c3::NUMBER)
)
LOCATION = @s3_stage
FILE_FORMAT = (TYPE = 'CSV')
AUTO_REFRESH = TRUE;   -- picks up new files automatically via cloud storage event notifications

SELECT * FROM ext_orders WHERE order_date = '2024-01-01';
```

Use external tables for exploratory querying over a data lake, or as a landing point before deciding what's worth loading natively. If a table gets queried heavily or joined often, load it into Snowflake proper — external tables don't benefit from micro-partition pruning or clustering the way native tables do.

## 🧬 Semi-Structured Data (VARIANT)

```sql
CREATE TABLE events (data VARIANT);

INSERT INTO events
SELECT PARSE_JSON('{"user": {"id": 1, "name": "Alice"}}');

-- Access nested keys with : and cast explicitly
SELECT data:user:name::string AS user_name FROM events;

-- Expand a JSON array into rows
SELECT f.value:item_id::int AS item_id
FROM orders_json o,
LATERAL FLATTEN(input => o.data:items) f;

-- Build JSON from relational columns
SELECT OBJECT_CONSTRUCT('id', id, 'name', name) AS payload
FROM users;
```

## ⏳ Time Travel & Cloning

```sql
-- Query historical data (retention window is configurable, up to 90 days on Enterprise+)
SELECT * FROM orders AT (OFFSET => -3600);                              -- 1 hour ago
SELECT * FROM orders AT (TIMESTAMP => '2024-01-01 00:00:00'::timestamp);
SELECT * FROM orders BEFORE (STATEMENT => '<query_id>');

-- Restore a dropped object
DROP TABLE orders;
UNDROP TABLE orders;

-- Zero-copy clone: instant, metadata-only at creation — storage only diverges once one side is written to
CREATE TABLE orders_dev CLONE orders;
CREATE DATABASE dev_db CLONE prod_db;

-- How far back time travel can go
ALTER TABLE orders SET DATA_RETENTION_TIME_IN_DAYS = 30;   -- 0–90 depending on edition
```

## 🌊 Streams & Tasks

```sql
-- Stream: tracks row-level INSERT/UPDATE/DELETE changes since it was last consumed — the basis for CDC
CREATE STREAM orders_stream ON TABLE orders;

SELECT * FROM orders_stream;   -- includes METADATA$ACTION, METADATA$ISUPDATE, METADATA$ROW_ID

-- Consuming a stream (via DML that reads it) advances its offset
INSERT INTO orders_history
SELECT *, METADATA$ACTION, CURRENT_TIMESTAMP()
FROM orders_stream;

-- Task: scheduled or chained SQL/procedure execution
CREATE TASK refresh_orders_summary
  WAREHOUSE = compute_wh
  SCHEDULE = '5 MINUTE'
AS
  INSERT INTO orders_summary
  SELECT order_date, SUM(amount) FROM orders_stream GROUP BY 1;

-- Chain tasks into a DAG
CREATE TASK downstream_task
  WAREHOUSE = compute_wh
  AFTER refresh_orders_summary
AS
  CALL run_cleanup();

-- Tasks are created SUSPENDED by default — you must explicitly resume the root task
ALTER TASK refresh_orders_summary RESUME;

SHOW TASKS;
SELECT * FROM TABLE(INFORMATION_SCHEMA.TASK_HISTORY());
```

## ⚙️ Dynamic Tables

Dynamic tables are the **declarative** alternative to hand-rolling stream + task pipelines. You write the target query; Snowflake figures out the incremental refresh plan and keeps the table up to date on its own.

```sql
CREATE DYNAMIC TABLE orders_summary_dt
  TARGET_LAG = '5 minutes'
  WAREHOUSE = compute_wh
AS
  SELECT order_date, SUM(amount) AS total
  FROM orders
  GROUP BY order_date;

-- Chain dynamic tables — downstream lag is measured relative to upstream, so
-- a chain's effective freshness is roughly the sum of each hop's TARGET_LAG
CREATE DYNAMIC TABLE orders_summary_enriched_dt
  TARGET_LAG = '10 minutes'
  WAREHOUSE = compute_wh
AS
  SELECT s.*, c.region
  FROM orders_summary_dt s
  JOIN customers c ON s.customer_id = c.customer_id;

SHOW DYNAMIC TABLES;
SELECT * FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY());

-- Inspect why Snowflake chose full vs. incremental refresh for a given table
SELECT SYSTEM$EXPLAIN_PLAN_JSON(
  SYSTEM$DYNAMIC_TABLE_REFRESH_HISTORY_ID('orders_summary_dt')
);
```

**Dynamic tables vs. streams+tasks** — when to reach for which:

|               | Streams + Tasks                                                              | Dynamic Tables                                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Style         | Imperative — you write the merge/insert logic                                | Declarative — you write the target-state query                                                                                                                                      |
| Refresh logic | Manual (you decide what "new" means each run)                                | Automatic (Snowflake diffs and incrementalizes when it can)                                                                                                                         |
| Best for      | Complex branching logic, non-SQL-expressible steps, calling external systems | Straightforward transformation chains, especially multi-hop pipelines                                                                                                               |
| Fallback      | N/A                                                                          | Falls back to a full recompute if the query can't be incrementalized (e.g. certain window functions) — worth checking refresh history if a table seems more expensive than expected |

## 👁️ Views & Materialized Views

```sql
CREATE VIEW active_customers AS
SELECT * FROM customers WHERE status = 'active';

-- Materialized view: Snowflake keeps it automatically refreshed (no manual REFRESH command)
-- Requires Enterprise Edition+, and has restrictions: single source table, limited aggregates, no joins
CREATE MATERIALIZED VIEW mv_daily_sales AS
SELECT order_date, SUM(amount) AS total
FROM orders
GROUP BY order_date;
```

A materialized view's single-source-table restriction is exactly what dynamic tables lift — if you need a refreshed aggregate _with a join_, that's the signal to reach for a dynamic table instead.

## 🔄 Transactions

```sql
BEGIN;
UPDATE orders SET status = 'shipped' WHERE order_id = 1;
INSERT INTO order_log VALUES (1, 'shipped', CURRENT_TIMESTAMP());
COMMIT;
-- ROLLBACK; to undo instead
```

Snowflake auto-commits individual statements by default — wrap multiple statements in `BEGIN`/`COMMIT` only when you need them to succeed or fail together.

## 🔐 Roles & Access Control

```sql
CREATE ROLE analyst;

GRANT USAGE ON DATABASE raw_db TO ROLE analyst;
GRANT USAGE ON SCHEMA raw_db.raw_schema TO ROLE analyst;
GRANT SELECT ON ALL TABLES IN SCHEMA raw_db.raw_schema TO ROLE analyst;

-- Applies automatically to tables created AFTER this grant — huge time-saver
GRANT SELECT ON FUTURE TABLES IN SCHEMA raw_db.raw_schema TO ROLE analyst;

GRANT ROLE analyst TO USER jane_doe;
GRANT ROLE analyst TO ROLE reporting_role;   -- roles can inherit from other roles

SHOW GRANTS TO ROLE analyst;
SHOW GRANTS ON TABLE orders;

USE ROLE analyst;   -- switch the active role for the current session
```

Built-in roles: `ACCOUNTADMIN`, `SECURITYADMIN`, `SYSADMIN`, `PUBLIC`. Best practice: do everyday work through custom functional roles (`TRANSFORMER`, `ANALYST`, etc.) — not `ACCOUNTADMIN`.

## 🛡️ Governance & Security

Table/schema-level grants (above) control _whether_ a role can see a table. These features control _what_ they see once they're in — column- and row-level governance without maintaining separate masked copies of a table.

**Dynamic Data Masking** — redact or transform a column's value based on the querying role, evaluated at query time:

```sql
CREATE MASKING POLICY email_mask AS (val STRING) RETURNS STRING ->
  CASE
    WHEN CURRENT_ROLE() IN ('SUPPORT_ADMIN') THEN val
    ELSE REGEXP_REPLACE(val, '.+@', '*****@')
  END;

ALTER TABLE customers MODIFY COLUMN email SET MASKING POLICY email_mask;

-- Same policy can be applied to any column of a matching type across the account
```

**Row Access Policies** — restrict which _rows_ a role can see, e.g. multi-tenant data isolation:

```sql
CREATE ROW ACCESS POLICY region_policy AS (region STRING) RETURNS BOOLEAN ->
  CURRENT_ROLE() = 'ACCOUNTADMIN'
  OR EXISTS (
    SELECT 1 FROM allowed_regions
    WHERE role_name = CURRENT_ROLE() AND allowed_regions.region = region
  );

ALTER TABLE orders ADD ROW ACCESS POLICY region_policy ON (region);
```

**Object Tagging** — attach governance metadata (e.g. `PII`, `cost_center`) to objects, then query or enforce against it centrally:

```sql
CREATE TAG pii_level;
ALTER TABLE customers MODIFY COLUMN ssn SET TAG pii_level = 'high';

-- Find everything tagged a given way across the account — useful for audits
SELECT * FROM TABLE(INFORMATION_SCHEMA.TAG_REFERENCES('customers.ssn', 'column'));
```

**Other things worth knowing:**

- Masking policies and row access policies are evaluated **per query**, not baked into storage — changing the policy definition takes effect immediately for all future queries, no backfill needed.
- Both require the `Enterprise Edition` or higher.
- `ACCOUNTADMIN` and any role explicitly exempted in the policy logic can bypass masking — treat that as a privileged capability worth auditing (`SHOW GRANTS` won't show it; you have to read the policy body itself).

## 🤝 Secure Data Sharing

Snowflake's **Shares** let you expose live, read-only data to another Snowflake account (or a non-Snowflake consumer via a reader account) without copying or moving anything — the consumer queries your storage directly, governed by grants you control.

```sql
-- Provider side: create a share and grant it access
CREATE SHARE sales_share;
GRANT USAGE ON DATABASE raw_db TO SHARE sales_share;
GRANT USAGE ON SCHEMA raw_db.raw_schema TO SHARE sales_share;
GRANT SELECT ON TABLE raw_db.raw_schema.orders TO SHARE sales_share;

-- Add a specific consumer account to the share
ALTER SHARE sales_share ADD ACCOUNTS = ('consumer_account_id');

SHOW SHARES;
```

```sql
-- Consumer side: mount the shared data as a read-only database
CREATE DATABASE shared_sales FROM SHARE provider_account.sales_share;
SELECT * FROM shared_sales.raw_schema.orders;   -- reads live provider data, no copy
```

For consumers who don't have their own Snowflake account, providers can spin up a **reader account** on their behalf — Snowflake-managed, billed to the provider, scoped to read-only access on the shared data.

The **Snowflake Marketplace** is the public directory built on this same mechanism — third-party and public datasets you can attach to your account the same way, without any ETL.

## ⚡ Query Performance & Optimization

```sql
-- Recent query history
SELECT * FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY())
ORDER BY start_time DESC
LIMIT 10;

-- Per-operator stats for a specific query (great for diagnosing a slow join/spill)
SELECT * FROM TABLE(GET_QUERY_OPERATOR_STATS('<query_id>'));

-- Clustering key: helps micro-partition pruning on very large tables
ALTER TABLE orders CLUSTER BY (order_date);

SELECT SYSTEM$CLUSTERING_INFORMATION('orders', '(order_date)');
```

Snowflake has no traditional indexes. Performance instead comes from: automatic micro-partition pruning, clustering keys (only worth it on genuinely large tables), the automatic result cache (identical query + unchanged underlying data = instant, compute-free result), and choosing an appropriately sized warehouse for compute-bound work.

**Reading the Query Profile** (Snowsight's visual execution graph — the fastest way to diagnose a specific slow query):

- **Bytes spilled to local/remote storage** — the single most common red flag. It means the warehouse ran out of memory for that operation (usually a join or sort) and spilled to disk (local) or worse, cloud storage (remote). Fix: bigger warehouse, or reduce the row/column volume flowing into that operator.
- **Partitions scanned vs. partitions total** — a low ratio means pruning worked; a ratio near 100% on a filtered query usually means the filter column isn't correlated with how the table is naturally ordered or clustered.
- **Most expensive node** — Snowsight highlights the operator consuming the largest share of execution time; start there rather than reading the plan top-to-bottom.
- **Exploding joins** — watch the row count _between_ operators, not just at the final output; a join that balloons row count mid-plan and then aggregates back down is often crying out for a pre-aggregation or a `DISTINCT` earlier.

## 💰 Cost Management

```sql
-- Cap credit usage and get warned/auto-suspended before it runs away
CREATE RESOURCE MONITOR monthly_limit
  WITH CREDIT_QUOTA = 1000
  FREQUENCY = MONTHLY
  START_TIMESTAMP = IMMEDIATELY
  TRIGGERS
    ON 80 PERCENT DO NOTIFY
    ON 100 PERCENT DO SUSPEND;

ALTER WAREHOUSE compute_wh SET RESOURCE_MONITOR = monthly_limit;

-- Check recent credit usage per warehouse
SELECT *
FROM TABLE(INFORMATION_SCHEMA.WAREHOUSE_METERING_HISTORY(
  DATE_RANGE_START => DATEADD('day', -7, CURRENT_DATE())
));
```

Practical tips: keep `AUTO_SUSPEND` low (60s) on dev/ad-hoc warehouses, use **separate warehouses per workload** (ETL, BI, data science) so a heavy job in one doesn't inflate cost or contention for another, and right-size before defaulting to `LARGE`.

## 🧪 Stored Procedures, UDFs & Snowpark

```sql
-- SQL UDF
CREATE FUNCTION cents_to_dollars(cents NUMBER)
RETURNS NUMBER
AS
$$
  cents / 100.0
$$;
```

```sql
-- Python UDF
CREATE FUNCTION classify_amount(amount FLOAT)
RETURNS STRING
LANGUAGE PYTHON
RUNTIME_VERSION = '3.10'
HANDLER = 'classify'
AS
$$
def classify(amount):
    return 'high' if amount > 100 else 'low'
$$;
```

```sql
-- JavaScript stored procedure
CREATE PROCEDURE run_cleanup()
RETURNS STRING
LANGUAGE JAVASCRIPT
AS
$$
  var stmt = snowflake.createStatement({sqlText: "DELETE FROM staging WHERE processed = TRUE"});
  stmt.execute();
  return "Cleanup complete";
$$;

CALL run_cleanup();
```

```sql
-- Python stored procedure via Snowpark
CREATE PROCEDURE run_snowpark_job()
RETURNS STRING
LANGUAGE PYTHON
RUNTIME_VERSION = '3.10'
PACKAGES = ('snowflake-snowpark-python')
HANDLER = 'main'
AS
$$
def main(session):
    session.table('orders').filter('amount > 0').write.save_as_table('orders_clean')
    return "Done"
$$;
```

**Snowpark DataFrame API** — the day-to-day way engineers actually write transformations in Python/Scala/Java against Snowflake, pushing execution down to the warehouse rather than pulling data client-side:

```python
from snowflake.snowpark import Session
from snowflake.snowpark.functions import col, sum as sum_

session = Session.builder.configs(connection_params).create()

df = session.table("orders")

# Transformations build a lazy query plan — nothing executes until an action is called
result = (
    df.filter(col("amount") > 0)
      .group_by("order_date")
      .agg(sum_("amount").alias("total"))
      .sort(col("order_date"))
)

result.show()                              # action: triggers execution, prints preview
result.write.mode("overwrite").save_as_table("orders_summary")  # action: materializes to a table

# Register a Python function as a UDF, callable from both Snowpark and plain SQL
from snowflake.snowpark.functions import udf

@udf(name="classify_amount_py", is_permanent=True, stage_location="@my_stage", replace=True)
def classify_amount_py(amount: float) -> str:
    return "high" if amount > 100 else "low"
```

Snowpark DataFrames are **lazily evaluated**, same principle as Spark — chain as many transformations as you like; nothing runs against the warehouse until you call an action (`.show()`, `.collect()`, `.write...`, `.count()`). This matters for cost: building and discarding an unused DataFrame is free; calling an action on it isn't.

## 🤖 Cortex (AI/ML in SQL)

Cortex is Snowflake's built-in layer of LLM and ML functions, callable directly from SQL — no separate model hosting, no data leaving the account.

```sql
-- General-purpose LLM completion
SELECT SNOWFLAKE.CORTEX.COMPLETE(
  'llama3.1-70b',
  'Summarize this customer complaint in one sentence: ' || complaint_text
) AS summary
FROM support_tickets;

-- Purpose-built functions for common NLP tasks
SELECT SNOWFLAKE.CORTEX.SENTIMENT(review_text) AS sentiment_score FROM reviews;
SELECT SNOWFLAKE.CORTEX.SUMMARIZE(transcript) AS summary FROM call_transcripts;
SELECT SNOWFLAKE.CORTEX.TRANSLATE(review_text, 'en', 'es') AS translated FROM reviews;

-- Cortex Search: managed semantic/hybrid search over a table for RAG-style retrieval
CREATE CORTEX SEARCH SERVICE support_search
  ON support_tickets
  ATTRIBUTES ticket_id, category
  WAREHOUSE = compute_wh
  TARGET_LAG = '1 hour'
AS
  SELECT ticket_id, category, complaint_text FROM support_tickets;

-- Cortex Analyst: natural-language-to-SQL over a semantic model, for self-serve BI
-- (configured via a semantic model YAML file plus the CORTEX.ANALYST API — see Snowflake docs)
```

Cortex functions are billed per-token/per-call on top of normal warehouse compute, similar to Snowpipe or materialized view maintenance — factor that into cost monitoring rather than assuming it's covered by warehouse credits alone.
