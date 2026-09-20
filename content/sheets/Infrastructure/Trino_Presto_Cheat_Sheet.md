# Trino / Presto Cheatsheet for Data & Analytics Engineers

> A structured reference for distributed SQL query engines — architecture, catalogs/connectors, federated queries, performance tuning, and operations. Trino (formerly PrestoSQL) and PrestoDB have diverged since their 2020 split; syntax below is Trino-flavored, with Presto differences noted where they matter.

## 📑 Table of Contents

1. [🚀 Setup and CLI](#setup-and-cli)
2. [🧠 Architecture](#architecture)
3. [🔌 Catalogs & Connectors](#catalogs-connectors)
4. [📊 Core SQL Patterns](#core-sql-patterns)
5. [🔗 Federated / Cross-Catalog Queries](#federated-cross-catalog-queries)
6. [🪟 Window Functions & Advanced SQL](#window-functions-advanced-sql)
7. [🏔️ Lakehouse Table Formats (Iceberg/Delta/Hudi)](#lakehouse-table-formats)
8. [🔎 EXPLAIN & Query Analysis](#explain-query-analysis)
9. [⚡ Performance Tuning](#performance-tuning)
10. [🚦 Resource Groups & Session Properties](#resource-groups-session-properties)
11. [📊 Monitoring & Operations](#monitoring-operations)
12. [🔐 Security: Authentication & Fine-Grained Access Control](#security-authentication-fine-grained-access-control)
13. [🧮 User-Defined Functions & Materialized Views](#user-defined-functions-materialized-views)
14. [🛡️ Fault-Tolerant Execution & Spooling](#fault-tolerant-execution-spooling)
15. [🌍 Geospatial & Advanced Functions](#geospatial-advanced-functions)
16. [📐 Table Statistics & the Cost-Based Optimizer](#table-statistics-cost-based-optimizer)
17. [⚠️ Common Gotchas](#common-gotchas)
18. [🎯 Best Practices](#best-practices)
19. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Task                       | Syntax / Command                                                       |
| --------------------------- | ------------------------------------------------------------------------ |
| Connect via CLI             | `trino --server localhost:8080 --catalog hive --schema default`         |
| List catalogs / schemas     | `SHOW CATALOGS;` / `SHOW SCHEMAS FROM hive;`                            |
| List tables / describe      | `SHOW TABLES FROM hive.sales;` / `DESCRIBE hive.sales.orders;`          |
| Cross-catalog join          | `SELECT ... FROM hive.sales.orders o JOIN postgres.crm.users u ON ...`  |
| Explain a query             | `EXPLAIN SELECT ...;` / `EXPLAIN ANALYZE SELECT ...;`                   |
| Set a session property      | `SET SESSION query_max_memory = '10GB';`                                |
| Show running queries        | `SHOW QUERIES;` (or Web UI at `:8080`)                                  |
| Kill a query                | `CALL system.runtime.kill_query(query_id => '20240101_...', message => 'stop')` |
| Create table as (CTAS)      | `CREATE TABLE t AS SELECT ...`                                          |
| Create Iceberg table        | `CREATE TABLE t (...) WITH (format = 'PARQUET')`                        |

## 🚀 Setup and CLI

```bash
# Download the CLI
curl -O https://repo1.maven.org/maven2/io/trino/trino-cli/<version>/trino-cli-<version>-executable.jar
mv trino-cli-*-executable.jar trino && chmod +x trino

# Connect
./trino --server localhost:8080 --catalog hive --schema default --user analyst

# Batch mode
./trino --execute "SELECT count(*) FROM hive.sales.orders"

# From a file, output as CSV
./trino --catalog hive --schema sales --output-format CSV -f query.sql > results.csv
```

```properties
# etc/catalog/hive.properties — example connector config
connector.name=hive
hive.metastore.uri=thrift://metastore:9083
hive.s3.aws-access-key=...
hive.s3.aws-secret-key=...
hive.allow-drop-table=true

# etc/catalog/postgres.properties
connector.name=postgresql
connection-url=jdbc:postgresql://db-host:5432/mydb
connection-user=trino
connection-password=secret
```

## 🧠 Architecture

- **Coordinator** — parses SQL, builds a distributed query plan, schedules work across workers, tracks progress; there is exactly one per cluster (HA coordinators exist in some deployments/Starburst).
- **Workers** — execute query fragments (stages/tasks) in parallel, pulling data from connectors and shuffling between each other.
- **Connectors** — pluggable adapters that expose an external system (Hive/S3, Iceberg, PostgreSQL, MongoDB, Kafka, Elasticsearch...) as a catalog of schemas and tables; all query execution is pushed through the connector's SPI.
- **No storage of its own** — Trino is purely a compute/query engine; all data lives in the connected systems, which is what makes federated queries possible.
- **In-memory, MPP execution** — stages pipeline data between workers without (by default) spilling to disk, which is why memory configuration matters so much.

```
Client → Coordinator (parse, plan, schedule) → Workers (execute stages) → Connectors → Storage/Systems
```

## 🔌 Catalogs & Connectors

```sql
SHOW CATALOGS;
SHOW SCHEMAS FROM hive;
SHOW TABLES FROM hive.sales;
SHOW COLUMNS FROM hive.sales.orders;
DESCRIBE hive.sales.orders;

-- Fully qualified references are catalog.schema.table
SELECT * FROM hive.sales.orders LIMIT 10;

-- Switch context
USE hive.sales;
SELECT * FROM orders LIMIT 10;   -- now resolves against hive.sales
```

| Connector | Backing system | Notes |
| --- | --- | --- |
| `hive` | Hive Metastore + S3/HDFS/GCS | Classic data lake tables (ORC/Parquet/Avro/text) |
| `iceberg` | Apache Iceberg tables | Schema evolution, time travel, hidden partitioning |
| `delta-lake` | Delta Lake tables | Reads/writes Delta transaction log |
| `postgresql` / `mysql` / `sqlserver` | RDBMS via JDBC | Predicate/aggregation pushdown varies by connector |
| `mongodb` | MongoDB | Document → tabular projection |
| `kafka` | Kafka topics | Query topics as tables (mostly for exploration, not streaming) |
| `elasticsearch` | Elasticsearch/OpenSearch | Full-text search integration |
| `memory` | In-process | Testing/scratch tables, lost on restart |
| `tpch` / `tpcds` | Synthetic benchmark data | No setup needed, useful for testing queries |

## 📊 Core SQL Patterns

```sql
-- Standard ANSI SQL — most queries port directly from Postgres/MySQL
SELECT customer_id, count(*) AS orders, sum(amount) AS total
FROM hive.sales.orders
WHERE order_date >= DATE '2024-01-01'
GROUP BY customer_id
HAVING sum(amount) > 1000
ORDER BY total DESC
LIMIT 20;

-- CTAS (create table as select) — Trino's primary way to materialize results
CREATE TABLE hive.sales.orders_2024
WITH (format = 'PARQUET', partitioned_by = ARRAY['order_month'])
AS SELECT *, date_trunc('month', order_date) AS order_month
FROM hive.sales.orders
WHERE order_date >= DATE '2024-01-01';

-- INSERT INTO an existing table
INSERT INTO hive.sales.orders_2024 SELECT * FROM staging.new_orders;

-- UNNEST for array/map columns
SELECT order_id, item
FROM hive.sales.orders
CROSS JOIN UNNEST(items) AS t(item);

-- Common table expressions
WITH monthly AS (
    SELECT date_trunc('month', order_date) AS m, sum(amount) AS total
    FROM hive.sales.orders
    GROUP BY 1
)
SELECT * FROM monthly ORDER BY m;

-- Approximate aggregations (much cheaper on huge tables)
SELECT approx_distinct(customer_id) AS approx_customers FROM hive.sales.orders;
SELECT approx_percentile(amount, 0.95) AS p95 FROM hive.sales.orders;
```

## 🔗 Federated / Cross-Catalog Queries

```sql
-- Join a data lake table with a live operational database in a single query
SELECT o.order_id, o.amount, u.email, u.signup_date
FROM hive.sales.orders o
JOIN postgresql.crm.users u ON o.customer_id = u.id
WHERE o.order_date >= DATE '2024-01-01';

-- Enrich lake data with a lookup from Elasticsearch
SELECT o.order_id, o.amount, s.risk_score
FROM hive.sales.orders o
JOIN elasticsearch.fraud.scores s ON o.order_id = s.order_id;

-- Materialize a federated join back into the lake to avoid repeated cross-system cost
CREATE TABLE hive.sales.enriched_orders AS
SELECT o.*, u.email FROM hive.sales.orders o JOIN postgresql.crm.users u ON o.customer_id = u.id;
```

> Federated joins are powerful but push filtering/aggregation down only as far as each connector supports. Always check `EXPLAIN` to confirm predicate pushdown is happening on the RDBMS side rather than pulling entire tables into Trino.

## 🪟 Window Functions & Advanced SQL

```sql
SELECT
    customer_id,
    order_date,
    amount,
    sum(amount) OVER (PARTITION BY customer_id ORDER BY order_date) AS running_total,
    rank() OVER (PARTITION BY customer_id ORDER BY amount DESC) AS amount_rank,
    lag(amount, 1) OVER (PARTITION BY customer_id ORDER BY order_date) AS prev_amount
FROM hive.sales.orders;

-- GROUPING SETS / ROLLUP / CUBE
SELECT region, product, sum(amount)
FROM hive.sales.orders
GROUP BY ROLLUP (region, product);

-- JSON functions
SELECT json_extract_scalar(payload, '$.user.id') AS user_id
FROM hive.events.raw
WHERE json_extract_scalar(payload, '$.event_type') = 'purchase';

-- Lambda / higher-order functions on arrays
SELECT transform(items, x -> x * 1.1) AS items_with_tax FROM hive.sales.orders;
SELECT filter(items, x -> x > 100) AS big_items FROM hive.sales.orders;
```

## 🏔️ Lakehouse Table Formats

```sql
-- Iceberg: create, evolve schema, time travel
CREATE TABLE iceberg.sales.orders (
    order_id BIGINT, customer_id BIGINT, amount DECIMAL(10,2), order_date DATE
)
WITH (format = 'PARQUET', partitioning = ARRAY['month(order_date)']);

ALTER TABLE iceberg.sales.orders ADD COLUMN discount DECIMAL(5,2);

SELECT * FROM iceberg.sales.orders FOR TIMESTAMP AS OF TIMESTAMP '2024-06-01 00:00:00';
SELECT * FROM iceberg.sales.orders FOR VERSION AS OF 8938572;

-- Inspect table metadata/history/snapshots
SELECT * FROM iceberg.sales."orders$history";
SELECT * FROM iceberg.sales."orders$snapshots";
SELECT * FROM iceberg.sales."orders$partitions";

-- Compact small files (maintenance)
ALTER TABLE iceberg.sales.orders EXECUTE optimize;
ALTER TABLE iceberg.sales.orders EXECUTE expire_snapshots(retention_threshold => '7d');

-- Delta Lake
SELECT * FROM delta_lake.sales.orders;
CALL delta_lake.system.vacuum('sales', 'orders', '7d');
```

## 🔎 EXPLAIN & Query Analysis

```sql
EXPLAIN SELECT * FROM hive.sales.orders WHERE order_date = DATE '2024-01-01';
EXPLAIN (TYPE DISTRIBUTED) SELECT ...;   -- shows stage/fragment layout
EXPLAIN (TYPE IO) SELECT ...;            -- shows what will be scanned/written
EXPLAIN ANALYZE SELECT ...;              -- actually runs the query, reports real stats per operator
```

- Read `EXPLAIN ANALYZE` output bottom-up: scan stages first, then joins/aggregations, then the final output stage.
- Look for **"Filter"** pushed all the way down to a `TableScan` — if it isn't, you're scanning more data than necessary.
- Check `CPU: ...`, `Input: ... rows`, and `Output: ... rows` per operator to spot the stage doing the most work.

## ⚡ Performance Tuning

```sql
-- Partition pruning: filter on partition columns to skip whole files/partitions
SELECT * FROM hive.sales.orders WHERE order_month = DATE '2024-06-01';

-- Avoid SELECT * on wide columnar tables — column pruning saves real I/O
SELECT order_id, amount FROM hive.sales.orders;   -- not SELECT *

-- Broadcast join hint for small-table joins (avoid a full shuffle)
SELECT /*+ BROADCAST(small_dim) */ f.*, small_dim.name
FROM hive.sales.fact_orders f JOIN hive.sales.small_dim ON f.dim_id = small_dim.id;

-- Bucketed / sorted tables speed up joins and aggregations on the bucket key
CREATE TABLE hive.sales.orders_bucketed (order_id BIGINT, customer_id BIGINT, amount DECIMAL(10,2))
WITH (bucketed_by = ARRAY['customer_id'], bucket_count = 64);
```

| Lever | Effect |
| --- | --- |
| Columnar formats (Parquet/ORC) | Column pruning + predicate pushdown, big I/O savings |
| Partitioning | Skip entire directories/files that can't match the filter |
| File size (compaction) | Too many small files = scheduling overhead dominates; target 128MB–1GB files |
| `query.max-memory-per-node` | Prevents one query from starving the cluster; tune to workload |
| Join order / hints | Broadcast small tables, avoid shuffling large fact tables unnecessarily |
| Approximate functions | `approx_distinct`, `approx_percentile` — trade exactness for speed on huge data |

## 🚦 Resource Groups & Session Properties

```sql
-- Session-level tuning
SET SESSION query_max_memory = '20GB';
SET SESSION join_distribution_type = 'BROADCAST';
SET SESSION query_max_execution_time = '30m';
SHOW SESSION;
RESET SESSION query_max_memory;
```

```json
// etc/resource-groups.json — cap concurrency/memory per team or workload
{
  "rootGroups": [
    { "name": "etl", "maxQueued": 100, "hardConcurrencyLimit": 10, "softMemoryLimit": "80%" },
    { "name": "adhoc", "maxQueued": 50, "hardConcurrencyLimit": 5, "softMemoryLimit": "20%" }
  ],
  "selectors": [
    { "user": "etl_svc.*", "group": "etl" },
    { "user": ".*", "group": "adhoc" }
  ]
}
```

## 📊 Monitoring & Operations

```sql
SHOW QUERIES;
SELECT * FROM system.runtime.queries WHERE state = 'RUNNING';
SELECT * FROM system.runtime.nodes;                       -- cluster health
CALL system.runtime.kill_query(query_id => '...', message => 'runaway query');
```

- **Web UI** (`:8080`) — live query list, per-stage timeline, memory pools, worker status.
- Export metrics via **JMX** to Prometheus/Grafana for cluster-level dashboards (queued queries, memory pool usage, worker CPU).
- Track **queued vs running** query counts as an early signal of resource-group contention.

## 🔐 Security: Authentication & Fine-Grained Access Control

```properties
# config.properties — enable password auth over HTTPS
http-server.authentication.type=PASSWORD
http-server.https.enabled=true
http-server.https.port=8443
http-server.https.keystore.path=/etc/trino/keystore.jks

# password-authenticator.properties — delegate to LDAP
password-authenticator.name=ldap
ldap.url=ldaps://ldap.example.com:636
ldap.user-bind-pattern=uid=${USER},ou=people,dc=example,dc=com
```

```json
// System access control: rules.json — fine-grained, file-based authorization
{
  "catalogs": [
    { "user": "etl_svc", "catalog": "hive", "allow": "all" },
    { "group": "analysts", "catalog": "hive", "allow": "read-only" }
  ],
  "schemas": [
    { "group": "analysts", "catalog": "hive", "schema": "pii_.*", "owner": false }
  ]
}
```

```sql
-- Column masking and row-level filtering (via a catalog that supports it, e.g. Hive/Iceberg + Ranger,
-- or Trino's built-in system access control with column masks)
-- Example system access control config for a column mask:
-- { "catalog": "hive", "schema": "sales", "table": "customers", "column": "ssn",
--   "mask": "'***-**-' || substr(ssn, -4)" }

SHOW GRANTS ON hive.sales.orders;
GRANT SELECT ON hive.sales.orders TO ROLE analyst;
REVOKE SELECT ON hive.sales.orders FROM ROLE analyst;
CREATE ROLE analyst;
SET ROLE analyst;
```

- **Authentication** (who you are) is configured at the coordinator level — LDAP, Kerberos, OAuth2, or JWT are the common production choices; the CLI and JDBC/ODBC drivers all support passing credentials.
- **Authorization** (what you can do) is enforced per catalog via **system access control** — file-based rules for simple setups, or integration with Apache Ranger/OPA for centralized, auditable policy across many catalogs.
- **Column masking and row filtering** let you expose the same physical table to different roles with PII redacted or rows scoped to what that role should see, without maintaining separate views per audience.

## 🧮 User-Defined Functions & Materialized Views

```sql
-- SQL UDFs (Trino 425+) — inline, catalog-scoped functions
CREATE FUNCTION hive.sales.tax_amount(amount DECIMAL(10,2), rate DOUBLE)
RETURNS DECIMAL(10,2)
RETURN amount * CAST(rate AS DECIMAL(10,2));

SELECT order_id, hive.sales.tax_amount(amount, 0.08) FROM hive.sales.orders;

-- Recursive/inline functions with control flow
CREATE FUNCTION hive.sales.grade(score INT)
RETURNS VARCHAR
BEGIN
    IF score >= 90 THEN RETURN 'A'; END IF;
    IF score >= 80 THEN RETURN 'B'; END IF;
    RETURN 'C';
END;
```

```sql
-- Materialized views: precompute and cache an expensive query, refresh on demand
CREATE MATERIALIZED VIEW hive.sales.mv_daily_revenue AS
SELECT order_date, region, SUM(amount) AS revenue
FROM hive.sales.orders
GROUP BY order_date, region;

REFRESH MATERIALIZED VIEW hive.sales.mv_daily_revenue;
SHOW CREATE MATERIALIZED VIEW hive.sales.mv_daily_revenue;
DROP MATERIALIZED VIEW hive.sales.mv_daily_revenue;

-- Regular (non-materialized) views for reusable, always-live logic
CREATE VIEW hive.sales.v_active_customers AS
SELECT * FROM hive.sales.customers WHERE status = 'active';
```

- Materialized view **support and refresh semantics are connector-dependent** — Iceberg and Hive support them with varying degrees of incremental refresh; check the specific connector's docs before relying on automatic staleness handling.

## 🛡️ Fault-Tolerant Execution & Spooling

```properties
# config.properties — enable fault-tolerant execution (task or query retry)
retry-policy=TASK
exchange.deduplication-buffer-size=32MB
exchange.compression-codec=LZ4
exchange-manager.name=filesystem
exchange.base-directories=s3://bucket/trino-exchange-spooling
```

```sql
SET SESSION retry_policy = 'QUERY';   -- retry the entire query if it fails
```

| Retry policy | Behavior |
| --- | --- |
| `NONE` (default) | A worker failure kills the whole query — must be resubmitted manually |
| `QUERY` | The coordinator automatically retries the entire query from scratch on failure |
| `TASK` | Only the failed task is retried, using spooled intermediate exchange data — survives worker loss on very large, long-running queries without redoing everything |

- **Fault-tolerant execution (`TASK` retry)** is what makes Trino viable for very large batch ETL jobs that run for hours — without it, a single transient worker failure near the end of a multi-hour query means starting over.
- Requires an **exchange manager** (spooling to S3/HDFS/another filesystem) to persist intermediate shuffle data outside worker memory, which is what allows a task to be safely retried without re-running upstream stages.

## 🌍 Geospatial & Advanced Functions

```sql
-- Geospatial functions (via the built-in geospatial plugin, backed by ESRI's geometry library)
SELECT ST_Distance(
    ST_Point(-73.9857, 40.7484),
    ST_Point(-118.2437, 34.0522)
) AS degrees_apart;

SELECT * FROM hive.sales.stores
WHERE ST_Contains(
    ST_GeometryFromText('POLYGON((-74 40, -74 41, -73 41, -73 40, -74 40))'),
    ST_Point(longitude, latitude)
);

-- Common geospatial functions
ST_Area(geometry)
ST_Buffer(geometry, distance)
ST_Intersects(geom_a, geom_b)
ST_Within(geom_a, geom_b)
geometry_to_bing_tiles(geometry, zoom_level)   -- spatial partitioning for joins at scale

-- Array/map higher-order functions (frequently used in event/log analysis)
SELECT reduce(items, 0, (acc, x) -> acc + x, acc -> acc) AS total FROM orders;
SELECT zip_with(names, scores, (n, s) -> n || ':' || CAST(s AS VARCHAR)) FROM results;
SELECT map_filter(scores_map, (k, v) -> v > 50) FROM results;
```

## 📐 Table Statistics & the Cost-Based Optimizer

```sql
-- The CBO relies on table/column statistics to choose join order and join strategy
ANALYZE hive.sales.orders;
ANALYZE hive.sales.orders WITH (partitions = ARRAY[ARRAY['2024-06']]);

SHOW STATS FOR hive.sales.orders;
```

```
Column       | Min | Max  | NDV     | Null Fraction | Data Size
order_id     | 1   | 5e6  | 5000000 | 0.0            | 40MB
customer_id  | 1   | 2e5  | 200000  | 0.0            | 40MB
```

- Without statistics, Trino falls back to **syntactic/heuristic join ordering**, which can pick a much worse plan (e.g., broadcasting a table that's actually huge) — run `ANALYZE` on tables used in frequent joins, especially after large data loads.
- Stale statistics after a big load/delete are a common silent cause of a query that "used to be fast" suddenly regressing — re-run `ANALYZE` as a standard step after bulk writes to a table.

## ⚠️ Common Gotchas

- **Trino has no local storage** — every write goes through a connector, and not all connectors support writes (e.g., some JDBC connectors are read-only by default).
- **`DELETE`/`UPDATE` support is connector-dependent** — Hive-on-plain-text tables often can't do row-level deletes; Iceberg/Delta tables can.
- **Presto vs Trino syntax drift** — since the 2020 fork, function names and some session properties have diverged (e.g., Trino renamed several `presto.*` config properties); check the docs for the exact engine/version in use.
- **Implicit type coercion is stricter than MySQL** — comparing a `VARCHAR` to an `INTEGER` errors rather than silently casting.
- **Federated joins can silently pull entire tables** if the connector doesn't support pushdown for a given predicate — always verify with `EXPLAIN`.
- **No query-level transaction across catalogs** — a CTAS spanning multiple systems is not atomic; failures mid-write can leave partial data.
- **Memory errors (`Query exceeded per-node memory limit`)** usually mean a join is broadcasting a table that isn't actually small, or a `GROUP BY`/`DISTINCT` has very high cardinality — check the plan before just raising the memory limit.

## 🎯 Best Practices

- Always run `EXPLAIN` (or `EXPLAIN ANALYZE` on a sample) before running an unfamiliar query against a large table.
- Use CTAS to materialize expensive federated or multi-stage queries instead of re-computing them repeatedly.
- Keep source tables columnar (Parquet/ORC) and reasonably sized (compact small files) — this is the single highest-leverage tuning knob.
- Set per-team **resource groups** so ad-hoc analyst queries can't starve scheduled ETL.
- Prefer approximate functions (`approx_distinct`, `approx_percentile`) for dashboards where exactness isn't required.

## 💡 Pro Tips

1. **`EXPLAIN (TYPE IO)`** tells you exactly what will be scanned before you run a costly query — use it to sanity-check partition pruning.
2. **Iceberg's hidden partitioning** means you don't need to manually add partition columns to your `WHERE` clause the way Hive tables require.
3. **`approx_percentile` is far cheaper than exact percentile calculations** — reach for it on dashboards and monitoring queries.
4. **Broadcast joins are the default risk area for OOM** — if a "small" dimension table grows over time, a stale broadcast hint can start crashing queries.
5. **Use `system.runtime.queries`** for programmatic monitoring instead of scraping the Web UI.
6. **Bucketed tables pay off** when the same join/group-by key is used repeatedly across many queries — not worth it for one-off joins.
7. **CTAS + partitioned_by** is the standard pattern for materializing a federated or slow query result for reuse by BI tools.
