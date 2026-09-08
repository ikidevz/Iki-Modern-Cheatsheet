# Google BigQuery - Essential Cheatsheet

> A structured, task-oriented BigQuery (GoogleSQL / Standard SQL) reference for data analysis — from `bq` CLI basics and filtering through window functions, arrays/structs, JSON, partitioning & clustering, and common analysis patterns.

## 📑 Table of Contents

1. [🚀 Getting Started](#getting-started)
2. [🔍 Exploring Data](#exploring-data)
3. [🎯 Filtering & Selecting Data](#filtering-selecting-data)
4. [📊 Aggregations & GROUP BY](#aggregations-group-by)
5. [🔗 JOINs for Combining Data](#joins-for-combining-data)
6. [📈 Window Functions & QUALIFY](#window-functions-qualify)
7. [📅 Date & Time Operations](#date-time-operations)
8. [🔄 Common Table Expressions (CTEs)](#common-table-expressions-ctes)
9. [🔀 CASE Statements](#case-statements)
10. [🔎 Subqueries](#subqueries)
11. [🧬 Arrays & Structs (Nested/Repeated Data)](#arrays-structs-nested-repeated-data)
12. [📦 JSON Functions](#json-functions)
13. [👁️ Views & Materialized Views](#views-materialized-views)
14. [🗂️ Partitioning, Clustering & Query Performance](#partitioning-clustering-query-performance)
15. [🔤 Useful String Functions](#useful-string-functions)
16. [💾 Data Export & Import](#data-export-import)
17. [💡 Cost Control & Best Practices](#cost-control-best-practices)
18. [📋 Common Analysis Patterns](#common-analysis-patterns)

## ⚡ Quick Reference

**`bq` CLI essentials**

| Command                                                              | Purpose                                       |
| -------------------------------------------------------------------- | --------------------------------------------- |
| `bq ls` / `bq ls my_dataset`                                         | List datasets / list tables in a dataset      |
| `bq show my_dataset.my_table`                                        | Describe a table (schema, row count, size)    |
| `bq query --use_legacy_sql=false 'SELECT ...'`                       | Run a query from the CLI                      |
| `bq query --dry_run --use_legacy_sql=false 'SELECT ...'`             | Estimate bytes scanned (cost) without running |
| `bq load --source_format=CSV ds.table gs://bucket/f.csv schema.json` | Load data from Cloud Storage                  |
| `bq extract ds.table gs://bucket/out*.csv`                           | Export a table to Cloud Storage               |
| `bq mk --table ds.table schema.json`                                 | Create a table                                |

**Syntax cheatsheet**

| Task                            | Syntax                                                              |
| ------------------------------- | ------------------------------------------------------------------- |
| Filter                          | `WHERE col > x AND col2 IN (...)`                                   |
| Group & filter groups           | `GROUP BY col HAVING COUNT(*) > n`                                  |
| Join                            | `FROM a JOIN b ON a.id = b.a_id` (`LEFT`/`RIGHT`/`FULL`/`CROSS`)    |
| Unnest a repeated field         | `FROM t, UNNEST(t.array_col) AS item`                               |
| Window function                 | `fn() OVER (PARTITION BY ... ORDER BY ...)`                         |
| Filter on a window result       | `... QUALIFY ROW_NUMBER() OVER (...) = 1`                           |
| CTE                             | `WITH cte AS (SELECT ...) SELECT * FROM cte;`                       |
| JSON access                     | `JSON_VALUE(col, '$.k')` (string) · `JSON_QUERY(col, '$.k')` (JSON) |
| Struct access                   | `STRUCT(a AS x, b AS y)` then read with `col.x`                     |
| Partition + cluster a table     | `PARTITION BY DATE(ts) CLUSTER BY user_id`                          |
| Check query cost before running | `bq query --dry_run --use_legacy_sql=false 'SELECT ...'`            |

---

## 🚀 Getting Started

### Setup & Connecting

```bash
# Install the gcloud/bq CLI, then authenticate
gcloud auth login
gcloud config set project my-project-id

# One-time bq configuration (default project/dataset)
bq init

# Run a query from the terminal (Standard SQL is the default, but be explicit)
bq query --use_legacy_sql=false \
'SELECT COUNT(*) FROM `bigquery-public-data.samples.shakespeare`'
```

### Ways to Run Queries

- **BigQuery Console** (console.cloud.google.com/bigquery) — SQL editor with autocomplete, query history, and a live "this query will process X GB" estimate.
- **`bq` CLI** — scriptable, good for CI/CD and scheduled jobs.
- **Client libraries** — `google-cloud-bigquery` (Python), Java, Go, Node, etc. for programmatic access.
- **BigQuery Studio / Colab notebooks** — for exploratory analysis mixing SQL and Python.

### Fully Qualified Names

```sql
-- project.dataset.table addressing
SELECT *
FROM `my-project-id.my_dataset.my_table`
LIMIT 10;

-- Backticks are required when the project ID contains hyphens
-- Omit the project if querying within your default project
SELECT * FROM my_dataset.my_table LIMIT 10;

-- BigQuery ships free public datasets for practice
SELECT *
FROM `bigquery-public-data.austin_bikeshare.bikeshare_trips`
LIMIT 10;
```

---

## 🔍 Exploring Data

### Table & Schema Metadata

```sql
-- Describe a table's columns via INFORMATION_SCHEMA (per-dataset view)
SELECT column_name, data_type, is_nullable
FROM my_dataset.INFORMATION_SCHEMA.COLUMNS
WHERE table_name = 'my_table';

-- List every table in a dataset with row counts and size
SELECT table_name, row_count, size_bytes, ROUND(size_bytes / 1e9, 2) AS size_gb
FROM my_dataset.__TABLES__
ORDER BY size_bytes DESC;

-- Same info from the CLI
-- bq show my_dataset.my_table
```

### Quick Data Overview

```sql
-- Count rows (fast — reads only metadata, doesn't scan the table)
SELECT COUNT(*) FROM my_dataset.my_table;

-- Sample data
SELECT * FROM my_dataset.my_table LIMIT 10;

-- Random-ish sample without a full scan (much cheaper than ORDER BY RAND())
SELECT *
FROM my_dataset.my_table TABLESAMPLE SYSTEM (10 PERCENT);

-- Basic statistics
SELECT
  COUNT(*) AS total_rows,
  COUNT(DISTINCT user_id) AS unique_users,
  MIN(created_at) AS earliest_date,
  MAX(created_at) AS latest_date
FROM my_dataset.my_table;
```

### Checking for Data Quality Issues

```sql
-- Null counts and percentage
SELECT
  COUNT(*) AS total,
  COUNTIF(email IS NOT NULL) AS non_null,
  COUNTIF(email IS NULL) AS null_count,
  ROUND(100 * COUNTIF(email IS NULL) / COUNT(*), 2) AS null_percent
FROM my_dataset.users;

-- Find duplicates
SELECT email, COUNT(*) AS cnt
FROM my_dataset.users
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- Value ranges + median via APPROX_QUANTILES (cheap, near-exact on huge tables)
SELECT
  MIN(age) AS min_age,
  MAX(age) AS max_age,
  AVG(age) AS avg_age,
  APPROX_QUANTILES(age, 2)[OFFSET(1)] AS median_age
FROM my_dataset.users;

-- Frequency / distribution of a categorical column
SELECT
  status,
  COUNT(*) AS frequency,
  ROUND(100 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
FROM my_dataset.orders
GROUP BY status
ORDER BY frequency DESC;
```

---

## 🎯 Filtering & Selecting Data

### WHERE Clause Essentials

```sql
-- Basic comparisons
SELECT * FROM sales WHERE amount > 1000;
SELECT * FROM sales WHERE status = 'completed';
SELECT * FROM sales WHERE created_at >= '2024-01-01';

-- Multiple conditions
SELECT * FROM sales
WHERE amount > 1000
  AND status = 'completed'
  AND created_at >= '2024-01-01';

-- IN operator
SELECT * FROM products
WHERE category IN ('electronics', 'computers', 'phones');

-- NOT IN
SELECT * FROM users
WHERE status NOT IN ('banned', 'suspended');

-- BETWEEN
SELECT * FROM sales
WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31';

-- Pattern matching: LIKE is case-sensitive in BigQuery — use LOWER() for ILIKE-style matching
SELECT * FROM users WHERE email LIKE '%@gmail.com';
SELECT * FROM users WHERE LOWER(email) LIKE '%@gmail.com';
SELECT * FROM products WHERE name LIKE 'iPhone%';       -- starts with

-- Regex matching (RE2 syntax)
SELECT * FROM users WHERE REGEXP_CONTAINS(email, r'^[\w.+-]+@gmail\.com$');

-- NULL checks
SELECT * FROM users WHERE phone_number IS NULL;
SELECT * FROM users WHERE phone_number IS NOT NULL;

-- Date filtering
SELECT * FROM sales WHERE created_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY);
SELECT * FROM sales WHERE EXTRACT(YEAR FROM created_at) = 2024;
SELECT * FROM sales WHERE DATE_TRUNC(DATE(created_at), MONTH) = '2024-01-01';
```

### Filtering on Partitioned Tables (Important!)

```sql
-- If the table is partitioned by a DATE/TIMESTAMP column, filter directly on it —
-- this triggers partition pruning and can cut cost by orders of magnitude
SELECT *
FROM my_dataset.events
WHERE event_date BETWEEN '2024-01-01' AND '2024-01-31';  -- scans ~31 days, not the whole table

-- For legacy ingestion-time partitioned tables, filter on the pseudo-column
SELECT *
FROM my_dataset.events
WHERE _PARTITIONDATE BETWEEN '2024-01-01' AND '2024-01-31';
```

---

## 📊 Aggregations & GROUP BY

### Basic Aggregations

```sql
SELECT
  COUNT(*) AS total_orders,
  SUM(amount) AS total_revenue,
  AVG(amount) AS average_order,
  MIN(amount) AS smallest_order,
  MAX(amount) AS largest_order,
  STDDEV(amount) AS std_deviation
FROM orders;

-- Exact vs approximate distinct counts
SELECT
  COUNT(DISTINCT user_id) AS exact_unique_users,        -- exact, more expensive at scale
  APPROX_COUNT_DISTINCT(user_id) AS approx_unique_users  -- ~1-2% error, much cheaper on huge tables
FROM orders;

-- COUNTIF — a conditional count without a subquery or CASE
SELECT
  COUNTIF(status = 'completed') AS completed_orders,
  COUNTIF(status = 'refunded') AS refunded_orders
FROM orders;
```

### GROUP BY for Summaries

```sql
-- Group by single column
SELECT category, COUNT(*) AS product_count, AVG(price) AS avg_price
FROM products
GROUP BY category
ORDER BY product_count DESC;

-- Group by multiple columns
SELECT category, brand, COUNT(*) AS product_count, AVG(price) AS avg_price
FROM products
GROUP BY category, brand
ORDER BY category, product_count DESC;

-- GROUP BY ALL — group by every non-aggregated column in the SELECT list (less repetition)
SELECT category, brand, COUNT(*) AS product_count
FROM products
GROUP BY ALL;

-- Group by date parts
SELECT
  DATE_TRUNC(order_date, MONTH) AS month,
  COUNT(*) AS order_count,
  SUM(amount) AS monthly_revenue
FROM orders
GROUP BY month
ORDER BY month;
```

### ROLLUP, CUBE & GROUPING SETS

```sql
-- ROLLUP: subtotals + grand total, following the hierarchy left-to-right
SELECT category, brand, SUM(revenue) AS revenue
FROM sales
GROUP BY ROLLUP(category, brand)
ORDER BY category, brand;
-- Produces: (category, brand) rows, (category, NULL) subtotals, and (NULL, NULL) grand total

-- CUBE: every combination of subtotals, not just the hierarchy
SELECT category, region, SUM(revenue) AS revenue
FROM sales
GROUP BY CUBE(category, region);

-- GROUPING SETS: pick exactly the aggregation levels you want
SELECT category, region, SUM(revenue) AS revenue
FROM sales
GROUP BY GROUPING SETS ((category, region), (category), ());
```

### Approximate Aggregation Functions

```sql
-- Top values without a full GROUP BY + ORDER BY + LIMIT (cheaper at huge scale)
SELECT APPROX_TOP_COUNT(country, 5) AS top_5_countries
FROM users;

-- Percentiles / quantiles (returns an array of cut points)
SELECT APPROX_QUANTILES(order_amount, 4) AS quartiles  -- [min, p25, p50, p75, max]
FROM orders;
```

---

## 🔗 JOINs for Combining Data

### Standard Joins

```sql
-- INNER JOIN
SELECT u.username, o.order_date, o.amount
FROM users u
JOIN orders o ON u.id = o.user_id;

-- LEFT JOIN — keep all users, even those with no orders
SELECT u.username, o.order_date, o.amount
FROM users u
LEFT JOIN orders o ON u.id = o.user_id;

-- FULL OUTER JOIN
SELECT u.username, o.order_date
FROM users u
FULL OUTER JOIN orders o ON u.id = o.user_id;

-- CROSS JOIN — every combination of rows (use deliberately; easy to explode row counts)
SELECT p.product_name, r.region_name
FROM products p
CROSS JOIN regions r;

-- Self-join (e.g., find each employee's manager)
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id;
```

### Joining Against a Repeated Field with UNNEST

```sql
-- UNNEST an ARRAY column and correlate it back to the row it came from
-- (this is the BigQuery-native way to "join" nested/repeated data)
SELECT o.order_id, item
FROM orders o, UNNEST(o.line_items) AS item
WHERE item.quantity > 1;

-- LEFT JOIN semantics with an array that might be empty: use CROSS JOIN + UNNEST(...) with OFFSET,
-- or LEFT JOIN UNNEST(...) to keep rows whose array is empty/NULL
SELECT o.order_id, item
FROM orders o
LEFT JOIN UNNEST(o.line_items) AS item;
```

---

## 📈 Window Functions & QUALIFY

### Ranking Functions

```sql
SELECT
  employee_name,
  department,
  salary,
  ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS row_num,
  RANK()       OVER (PARTITION BY department ORDER BY salary DESC) AS rank_with_gaps,
  DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS rank_no_gaps,
  NTILE(4)     OVER (PARTITION BY department ORDER BY salary DESC) AS salary_quartile
FROM employees;
```

### Offset & Frame Functions

```sql
SELECT
  order_date,
  amount,
  LAG(amount)  OVER (ORDER BY order_date) AS prev_amount,
  LEAD(amount) OVER (ORDER BY order_date) AS next_amount,
  FIRST_VALUE(amount) OVER (ORDER BY order_date
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS first_amount,
  SUM(amount) OVER (ORDER BY order_date
      ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS rolling_7day_sum,
  AVG(amount) OVER (ORDER BY order_date
      RANGE BETWEEN INTERVAL 7 DAY PRECEDING AND CURRENT ROW) AS rolling_7day_avg
FROM daily_sales;
```

### QUALIFY — Filter on a Window Result Without a Wrapping Subquery

```sql
-- BigQuery-native shortcut: filter directly on a window function result
-- Get the latest order per customer, no CTE/subquery needed
SELECT customer_id, order_id, order_date, order_total
FROM orders
QUALIFY ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) = 1;

-- Top 3 highest-paid employees per department
SELECT employee_name, department, salary
FROM employees
QUALIFY RANK() OVER (PARTITION BY department ORDER BY salary DESC) <= 3;
```

---

## 📅 Date & Time Operations

### The Four Temporal Types

| Type        | Stores                   | Timezone-aware?      |
| ----------- | ------------------------ | -------------------- |
| `DATE`      | calendar date only       | no                   |
| `TIME`      | time of day only         | no                   |
| `DATETIME`  | date + time, no timezone | no                   |
| `TIMESTAMP` | absolute point in time   | always stored as UTC |

```sql
-- Current values
SELECT CURRENT_DATE(), CURRENT_TIME(), CURRENT_DATETIME(), CURRENT_TIMESTAMP();

-- Arithmetic
SELECT DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY);
SELECT DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH);
SELECT TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR);

-- Differences
SELECT DATE_DIFF('2024-12-31', '2024-01-01', DAY) AS days_apart;
SELECT TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), created_at, MINUTE) AS minutes_ago FROM sessions;

-- Truncating to a period
SELECT DATE_TRUNC(order_date, MONTH)  AS month_start   FROM orders;
SELECT DATE_TRUNC(order_date, WEEK(MONDAY)) AS week_start FROM orders;
SELECT TIMESTAMP_TRUNC(created_at, HOUR) AS hour_bucket FROM events;

-- Extracting parts
SELECT
  EXTRACT(YEAR FROM order_date)     AS yr,
  EXTRACT(MONTH FROM order_date)    AS mo,
  EXTRACT(DAYOFWEEK FROM order_date) AS dow  -- 1=Sunday .. 7=Saturday
FROM orders;

-- Parsing and formatting
SELECT PARSE_DATE('%Y-%m-%d', '2024-03-15');
SELECT FORMAT_DATE('%B %d, %Y', DATE '2024-03-15');   -- "March 15, 2024"
SELECT PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S', '2024-03-15 14:30:00');

-- Converting between types (mind the timezone on TIMESTAMP conversions)
SELECT DATETIME(TIMESTAMP '2024-03-15 14:30:00 UTC', 'America/New_York');
SELECT TIMESTAMP(DATETIME '2024-03-15 14:30:00', 'America/New_York');
```

---

## 🔄 Common Table Expressions (CTEs)

```sql
-- Basic CTE
WITH high_value_orders AS (
  SELECT * FROM orders WHERE amount > 1000
)
SELECT customer_id, COUNT(*) AS order_count
FROM high_value_orders
GROUP BY customer_id;

-- Multiple, chained CTEs
WITH monthly_revenue AS (
  SELECT DATE_TRUNC(order_date, MONTH) AS month, SUM(amount) AS revenue
  FROM orders
  GROUP BY month
),
revenue_growth AS (
  SELECT
    month,
    revenue,
    LAG(revenue) OVER (ORDER BY month) AS prev_month_revenue
  FROM monthly_revenue
)
SELECT
  month,
  revenue,
  ROUND(100 * (revenue - prev_month_revenue) / NULLIF(prev_month_revenue, 0), 2) AS growth_pct
FROM revenue_growth
ORDER BY month;

-- Recursive CTE — walk a hierarchy (e.g., an org chart or category tree)
WITH RECURSIVE org_chart AS (
  SELECT employee_id, manager_id, name, 1 AS level
  FROM employees
  WHERE manager_id IS NULL              -- anchor: the top of the tree

  UNION ALL

  SELECT e.employee_id, e.manager_id, e.name, oc.level + 1
  FROM employees e
  JOIN org_chart oc ON e.manager_id = oc.employee_id
)
SELECT * FROM org_chart ORDER BY level, name;
```

---

## 🔀 CASE Statements

```sql
-- Simple CASE
SELECT
  order_id,
  amount,
  CASE
    WHEN amount >= 1000 THEN 'Large'
    WHEN amount >= 100  THEN 'Medium'
    ELSE 'Small'
  END AS order_size
FROM orders;

-- CASE inside an aggregate (conditional counting/summing — same idea as COUNTIF, more flexible)
SELECT
  DATE_TRUNC(order_date, MONTH) AS month,
  SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) AS completed_revenue,
  SUM(CASE WHEN status = 'refunded'  THEN amount ELSE 0 END) AS refunded_revenue
FROM orders
GROUP BY month;

-- CASE for pivoting categories into columns
SELECT
  user_id,
  COUNTIF(event_type = 'page_view')  AS page_views,
  COUNTIF(event_type = 'add_to_cart') AS add_to_carts,
  COUNTIF(event_type = 'purchase')   AS purchases
FROM events
GROUP BY user_id;
```

---

## 🔎 Subqueries

```sql
-- Scalar subquery
SELECT
  product_name,
  price,
  price - (SELECT AVG(price) FROM products) AS diff_from_avg
FROM products;

-- IN subquery
SELECT * FROM customers
WHERE customer_id IN (SELECT customer_id FROM orders WHERE amount > 5000);

-- EXISTS / NOT EXISTS (often cheaper than IN for large sets, and NULL-safe)
SELECT * FROM customers c
WHERE EXISTS (
  SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.amount > 5000
);

SELECT * FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id
);

-- Correlated subquery in the SELECT list
SELECT
  customer_id,
  (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.customer_id) AS order_count
FROM customers c;
```

---

## 🧬 Arrays & Structs (Nested/Repeated Data)

BigQuery natively stores nested (`STRUCT`) and repeated (`ARRAY`) fields, so a single table can hold what would otherwise need several joined tables.

### Building & Reading Arrays

```sql
-- Literal array
SELECT [1, 2, 3] AS numbers;
SELECT GENERATE_ARRAY(1, 10, 2) AS odd_numbers;  -- [1, 3, 5, 7, 9]

-- Aggregate rows into an array (the "opposite" of UNNEST)
SELECT
  customer_id,
  ARRAY_AGG(product_name) AS purchased_products,
  ARRAY_AGG(DISTINCT product_name ORDER BY product_name) AS distinct_products
FROM order_items
GROUP BY customer_id;

-- Array functions
SELECT
  ARRAY_LENGTH(tags) AS tag_count,
  ARRAY_TO_STRING(tags, ', ') AS tags_csv,
  tags[OFFSET(0)] AS first_tag           -- 0-indexed, errors if out of range
FROM articles;
```

### Structs

```sql
-- Build a struct inline
SELECT STRUCT(1 AS id, 'Alice' AS name) AS person;

-- Structs let you group related columns and read them with dot notation
SELECT
  order_id,
  shipping_address.city,
  shipping_address.zip_code
FROM orders;  -- assumes `shipping_address` is a STRUCT<city STRING, zip_code STRING, ...>

-- Array of structs — the classic "one row per order, many line items" nested shape
SELECT
  order_id,
  ARRAY_AGG(STRUCT(product_name, quantity, price)) AS line_items
FROM order_items
GROUP BY order_id;
```

### Flattening Nested Data

```sql
-- UNNEST turns an ARRAY<STRUCT<...>> column back into rows
SELECT
  o.order_id,
  item.product_name,
  item.quantity,
  item.price
FROM orders o, UNNEST(o.line_items) AS item;

-- Preserve the array index with WITH OFFSET
SELECT o.order_id, item, pos
FROM orders o, UNNEST(o.line_items) AS item WITH OFFSET AS pos;
```

---

## 📦 JSON Functions

```sql
-- BigQuery has a native JSON type, and also accepts JSON stored as a STRING
-- JSON_VALUE / JSON_QUERY work on both JSON columns and STRING columns holding JSON text

-- Extract a scalar (returns a SQL STRING/number, unquoted)
SELECT JSON_VALUE(raw_event, '$.user.id') AS user_id
FROM events;

-- Extract a JSON sub-object/array (stays JSON, keeps quotes on strings)
SELECT JSON_QUERY(raw_event, '$.items') AS items_json
FROM events;

-- Parse a STRING into the native JSON type
SELECT PARSE_JSON('{"a": 1, "b": [2, 3]}') AS parsed;

-- Convert any value (including JSON) back into a STRING
SELECT TO_JSON_STRING(STRUCT(1 AS id, 'Alice' AS name)) AS json_str;

-- Turn a JSON array into rows
SELECT user_id, item
FROM events, UNNEST(JSON_EXTRACT_ARRAY(raw_event, '$.items')) AS item;

-- Check a key exists / get all top-level keys
SELECT JSON_VALUE(raw_event, '$.promo_code') IS NOT NULL AS has_promo
FROM events;
```

---

## 👁️ Views & Materialized Views

```sql
-- Standard view — always runs the underlying query live, no storage cost
CREATE VIEW my_dataset.active_customers AS
SELECT customer_id, SUM(amount) AS lifetime_value
FROM orders
WHERE status = 'completed'
GROUP BY customer_id;

-- Query it like a table
SELECT * FROM my_dataset.active_customers WHERE lifetime_value > 1000;

-- Materialized view — precomputed and incrementally refreshed by BigQuery in the background;
-- queries against it (or against the base table, via smart tuning) can skip recomputation
CREATE MATERIALIZED VIEW my_dataset.daily_revenue_mv AS
SELECT DATE(order_date) AS day, SUM(amount) AS revenue
FROM my_dataset.orders
GROUP BY day;

-- Replace a view's definition
CREATE OR REPLACE VIEW my_dataset.active_customers AS
SELECT customer_id, SUM(amount) AS lifetime_value
FROM orders
WHERE status IN ('completed', 'shipped')
GROUP BY customer_id;
```

---

## 🗂️ Partitioning, Clustering & Query Performance

BigQuery has no indexes — instead, **partitioning** and **clustering** are how you keep queries fast and cheap by limiting how much data gets scanned.

### Creating Partitioned & Clustered Tables

```sql
-- Partition by day on a DATE/TIMESTAMP/DATETIME column, then cluster within each partition
CREATE TABLE my_dataset.events (
  event_id STRING,
  user_id STRING,
  event_date DATE,
  event_type STRING,
  payload JSON
)
PARTITION BY event_date
CLUSTER BY user_id, event_type;

-- Ingestion-time partitioning (no date column of your own — BigQuery buckets by load time)
CREATE TABLE my_dataset.raw_logs (message STRING)
PARTITION BY _PARTITIONDATE;

-- Partition by an integer range (e.g., a numeric customer_id)
CREATE TABLE my_dataset.customer_events (customer_id INT64, event STRING)
PARTITION BY RANGE_BUCKET(customer_id, GENERATE_ARRAY(0, 1000000, 10000));
```

### Checking Cost & Performance Before Running

```bash
# Dry run: shows bytes that WOULD be processed, without running the query or incurring cost
bq query --dry_run --use_legacy_sql=false \
'SELECT * FROM my_dataset.events WHERE event_date = "2024-01-01"'
```

```sql
-- Query execution details (slot time, bytes shuffled, stage breakdown) are visible in the
-- Console's "Execution details" tab after a query runs, or via INFORMATION_SCHEMA.JOBS
SELECT
  job_id,
  total_bytes_processed,
  total_slot_ms,
  ROUND(total_bytes_processed / 1e9, 2) AS gb_scanned
FROM my_dataset.INFORMATION_SCHEMA.JOBS_BY_PROJECT
ORDER BY creation_time DESC
LIMIT 10;
```

---

## 🔤 Useful String Functions

```sql
-- Concatenation
SELECT CONCAT(first_name, ' ', last_name) AS full_name FROM users;
SELECT first_name || ' ' || last_name AS full_name FROM users;   -- || also works

-- Case conversion
SELECT UPPER(email), LOWER(email), INITCAP(full_name) FROM users;

-- Trimming
SELECT TRIM(name), LTRIM(name), RTRIM(name) FROM users;

-- Substrings and splitting
SELECT SUBSTR(email, 1, STRPOS(email, '@') - 1) AS username FROM users;
SELECT SPLIT(email, '@')[OFFSET(0)] AS username FROM users;

-- Length
SELECT LENGTH(description), CHAR_LENGTH(description) FROM products;

-- Replace / regex replace / regex extract
SELECT REPLACE(description, 'old', 'new') FROM products;
SELECT REGEXP_REPLACE(phone, r'[^0-9]', '') AS digits_only FROM contacts;
SELECT REGEXP_EXTRACT(email, r'@(.+)$') AS domain FROM users;

-- Formatting values into a string (printf-style)
SELECT FORMAT('%s ordered $%0.2f on %t', username, amount, order_date) AS summary
FROM orders;
```

---

## 💾 Data Export & Import

### Loading Data In

```bash
# Load a CSV from Cloud Storage into a table (bq CLI)
bq load --source_format=CSV --skip_leading_rows=1 \
  my_dataset.users gs://my-bucket/users.csv \
  name:STRING,email:STRING,created_at:TIMESTAMP
```

```sql
-- Or load from within SQL
LOAD DATA INTO my_dataset.users
FROM FILES (
  format = 'CSV',
  skip_leading_rows = 1,
  uris = ['gs://my-bucket/users.csv']
);

-- Query a file in Cloud Storage without loading it first (external/federated table)
SELECT *
FROM EXTERNAL_QUERY(
  'my_dataset.gcs_connection',
  'SELECT * FROM users LIMIT 100'
);

-- Or define a persistent external table over Cloud Storage
CREATE EXTERNAL TABLE my_dataset.staging_users
OPTIONS (
  format = 'CSV',
  uris = ['gs://my-bucket/users_*.csv'],
  skip_leading_rows = 1
);
```

### Exporting Data Out

```bash
# Export a table to Cloud Storage (bq CLI)
bq extract --destination_format=CSV \
  my_dataset.report gs://my-bucket/report_*.csv
```

```sql
-- Or export directly from a query
EXPORT DATA OPTIONS (
  uri = 'gs://my-bucket/report_*.csv',
  format = 'CSV',
  overwrite = true,
  header = true
) AS
SELECT customer_id, SUM(amount) AS total_spent
FROM orders
GROUP BY customer_id;
```

---

## 💡 Cost Control & Best Practices

### BigQuery Bills by Bytes Scanned — Not Query Time

```sql
-- ❌ SELECT * scans every column, even ones you don't need — costly on wide tables
SELECT * FROM huge_table WHERE customer_id = 42;

-- ✅ Select only the columns you need — BigQuery is columnar, so this directly cuts bytes billed
SELECT customer_id, order_date, amount FROM huge_table WHERE customer_id = 42;

-- ❌ Scanning a whole partitioned table
SELECT * FROM events WHERE user_id = 'abc123';

-- ✅ Add a filter on the partition column too, even if redundant with your real filter
SELECT * FROM events
WHERE event_date >= '2024-01-01' AND user_id = 'abc123';
```

```bash
# Always dry-run an unfamiliar or expensive-looking query first
bq query --dry_run --use_legacy_sql=false 'SELECT ... FROM huge_table'
# -> "Query will process 482.3 GB" lets you decide before you pay for it
```

### Writing Clean, Efficient Queries

```sql
-- Use meaningful aliases
SELECT u.username, o.order_date, p.product_name
FROM users u
JOIN orders o ON u.id = o.user_id
JOIN products p ON o.product_id = p.id;

-- Prefer APPROX_* functions once a table is in the billions of rows and exactness isn't required
SELECT APPROX_COUNT_DISTINCT(user_id) FROM huge_events_table;

-- Filter as early as possible — put WHERE clauses in the innermost CTE/subquery, not the outer one
WITH filtered AS (
  SELECT * FROM events WHERE event_date = '2024-01-01'  -- prune first
)
SELECT event_type, COUNT(*) FROM filtered GROUP BY event_type;
```

### Common Mistakes to Avoid

```sql
-- ❌ Dividing without guarding against zero
SELECT revenue / user_count FROM stats;  -- errors if user_count is 0

-- ✅ Safe division
SELECT SAFE_DIVIDE(revenue, user_count) FROM stats;   -- returns NULL instead of erroring

-- ❌ CROSS JOINing an UNNEST without realizing it multiplies rows
SELECT order_id, item FROM orders, UNNEST(line_items) AS item;
-- (this is often exactly what you want — just be intentional about the row explosion)

-- ❌ Casting types implicitly and getting surprising truncation
SELECT CAST('2024-13-01' AS DATE);  -- errors: month 13 doesn't exist — good, BigQuery is strict here

-- ✅ Use SAFE_CAST to get NULL instead of a failed query on bad data
SELECT SAFE_CAST(raw_value AS INT64) FROM messy_import;
```

### A Few More Gotchas

- **BigQuery has no indexes.** Query cost and speed come from **partition pruning** and **clustering**, not from an index you create separately — design the table's `PARTITION BY`/`CLUSTER BY` around your actual query filters.
- **`LIMIT` does not reduce bytes billed.** `SELECT * FROM huge_table LIMIT 10` still scans (and bills for) every byte of every selected column unless the table is clustered/partitioned to prune first.
- **The query cache only helps identical, deterministic queries** run again within ~24 hours on unchanged data — it won't kick in if you add a comment, change whitespace non-trivially in some clients, or use `CURRENT_TIMESTAMP()`/`RAND()`.
- **`TIMESTAMP` is always UTC internally.** Display-timezone conversion (`DATETIME(ts, 'America/New_York')`) is a presentation step, not a storage property.
- **Streaming inserts (`INSERT` via the streaming API) can have a short delay before rows are available to `UPDATE`/`DELETE`** and before they show up in `_PARTITIONTIME`-based filters — batch loads don't have this quirk.

---

## 📋 Common Analysis Patterns

### Cohort Analysis

```sql
WITH user_cohorts AS (
  SELECT
    user_id,
    DATE_TRUNC(MIN(order_date), MONTH) AS cohort_month
  FROM orders
  GROUP BY user_id
),
cohort_activity AS (
  SELECT
    uc.cohort_month,
    DATE_TRUNC(o.order_date, MONTH) AS activity_month,
    COUNT(DISTINCT o.user_id) AS active_users
  FROM user_cohorts uc
  JOIN orders o ON uc.user_id = o.user_id
  GROUP BY uc.cohort_month, activity_month
)
SELECT
  cohort_month,
  activity_month,
  active_users,
  DATE_DIFF(activity_month, cohort_month, MONTH) AS months_since_cohort
FROM cohort_activity
ORDER BY cohort_month, activity_month;
```

### RFM Analysis (Recency, Frequency, Monetary)

```sql
WITH rfm AS (
  SELECT
    user_id,
    DATE_DIFF(CURRENT_DATE(), MAX(DATE(order_date)), DAY) AS recency_days,
    COUNT(*) AS frequency,
    SUM(amount) AS monetary
  FROM orders
  WHERE status = 'completed'
  GROUP BY user_id
),
rfm_scores AS (
  SELECT
    user_id, recency_days, frequency, monetary,
    NTILE(5) OVER (ORDER BY recency_days DESC) AS r_score,
    NTILE(5) OVER (ORDER BY frequency)         AS f_score,
    NTILE(5) OVER (ORDER BY monetary)          AS m_score
  FROM rfm
)
SELECT
  user_id, r_score, f_score, m_score,
  r_score + f_score + m_score AS rfm_total,
  CASE
    WHEN r_score >= 4 AND f_score >= 4 THEN 'Champions'
    WHEN r_score >= 3 AND f_score >= 3 THEN 'Loyal'
    WHEN r_score >= 4 AND f_score <= 2 THEN 'New'
    WHEN r_score <= 2 THEN 'At Risk'
    ELSE 'Regular'
  END AS segment
FROM rfm_scores;
```

### Funnel Analysis

```sql
WITH funnel_steps AS (
  SELECT
    COUNT(DISTINCT IF(event = 'page_view',   user_id, NULL)) AS step_1_viewed,
    COUNT(DISTINCT IF(event = 'add_to_cart', user_id, NULL)) AS step_2_added,
    COUNT(DISTINCT IF(event = 'checkout',    user_id, NULL)) AS step_3_checkout,
    COUNT(DISTINCT IF(event = 'purchase',    user_id, NULL)) AS step_4_purchased
  FROM events
  WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
)
SELECT
  step_1_viewed,
  step_2_added,
  ROUND(100 * step_2_added / NULLIF(step_1_viewed, 0), 2) AS view_to_cart_rate,
  step_3_checkout,
  ROUND(100 * step_3_checkout / NULLIF(step_2_added, 0), 2) AS cart_to_checkout_rate,
  step_4_purchased,
  ROUND(100 * step_4_purchased / NULLIF(step_3_checkout, 0), 2) AS checkout_to_purchase_rate,
  ROUND(100 * step_4_purchased / NULLIF(step_1_viewed, 0), 2) AS overall_conversion_rate
FROM funnel_steps;
```

### Sessionization from Raw Events (BigQuery-flavored, using arrays)

```sql
-- Group a user's events into sessions with a 30-minute inactivity gap,
-- using nested arrays instead of a self-join
WITH events_with_gaps AS (
  SELECT
    user_id,
    event_timestamp,
    TIMESTAMP_DIFF(
      event_timestamp,
      LAG(event_timestamp) OVER (PARTITION BY user_id ORDER BY event_timestamp),
      MINUTE
    ) AS minutes_since_prev
  FROM events
),
sessionized AS (
  SELECT
    user_id,
    event_timestamp,
    SUM(IF(minutes_since_prev IS NULL OR minutes_since_prev > 30, 1, 0))
      OVER (PARTITION BY user_id ORDER BY event_timestamp) AS session_id
  FROM events_with_gaps
)
SELECT
  user_id,
  session_id,
  MIN(event_timestamp) AS session_start,
  MAX(event_timestamp) AS session_end,
  COUNT(*) AS event_count
FROM sessionized
GROUP BY user_id, session_id
ORDER BY user_id, session_start;
```

---

That's it! Master these essentials and you'll handle the large majority of day-to-day BigQuery data-analysis work. 🎯
