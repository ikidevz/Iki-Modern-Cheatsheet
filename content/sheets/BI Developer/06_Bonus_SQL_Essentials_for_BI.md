# 🗄️ Bonus: SQL Essentials for BI — BI Developer Cheatsheet (Deep Dive)

## Table of Contents
1. [Window Functions](#1-window-functions)
2. [CTEs for Layered Logic](#2-ctes-for-layered-logic)
3. [Recursive CTEs (Hierarchies)](#3-recursive-ctes-hierarchies)
4. [Star Schema Join Pattern](#4-star-schema-join-pattern)
5. [Pivoting Data for Reporting](#5-pivoting-data-for-reporting)
6. [Date & Time Functions](#6-date--time-functions)
7. [Data Quality Checks](#7-data-quality-checks)
8. [Query Performance Basics](#8-query-performance-basics)

---

## 1. Window Functions

```sql
-- Window functions for running totals / rankings
SELECT
    order_date,
    customer_id,
    SUM(sales) OVER (PARTITION BY customer_id ORDER BY order_date) AS running_total,
    RANK() OVER (ORDER BY SUM(sales) DESC) AS sales_rank
FROM fact_sales
GROUP BY order_date, customer_id, sales;
```

### More Window Function Patterns
```sql
-- Moving average (3-row window)
SELECT
    order_date,
    SUM(sales) AS daily_sales,
    AVG(SUM(sales)) OVER (
        ORDER BY order_date
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) AS moving_avg_3day
FROM fact_sales
GROUP BY order_date;

-- Percent of total per partition
SELECT
    region,
    product_category,
    SUM(sales) AS category_sales,
    SUM(sales) * 1.0 / SUM(SUM(sales)) OVER (PARTITION BY region) AS pct_of_region
FROM fact_sales
GROUP BY region, product_category;

-- LEAD/LAG for period-over-period comparison
SELECT
    month,
    total_sales,
    LAG(total_sales) OVER (ORDER BY month) AS prior_month_sales,
    LEAD(total_sales) OVER (ORDER BY month) AS next_month_sales
FROM monthly_sales;

-- NTILE for creating quartile buckets (e.g., customer value segments)
SELECT
    customer_id,
    total_spend,
    NTILE(4) OVER (ORDER BY total_spend DESC) AS spend_quartile
FROM customer_lifetime_value;
```

---

## 2. CTEs for Layered Logic

```sql
-- CTE for readable, layered logic
WITH monthly_sales AS (
    SELECT DATE_TRUNC('month', order_date) AS month, SUM(sales) AS total_sales
    FROM fact_sales
    GROUP BY 1
)
SELECT month, total_sales,
       LAG(total_sales) OVER (ORDER BY month) AS prior_month,
       total_sales - LAG(total_sales) OVER (ORDER BY month) AS mom_change
FROM monthly_sales;
```

### Multiple Chained CTEs
```sql
WITH orders_cleaned AS (
    SELECT order_id, customer_id, order_date, sales_amount
    FROM raw_orders
    WHERE sales_amount > 0   -- filter out negative/test rows
),
customer_totals AS (
    SELECT customer_id, SUM(sales_amount) AS lifetime_value
    FROM orders_cleaned
    GROUP BY customer_id
),
customer_segments AS (
    SELECT customer_id, lifetime_value,
           CASE
               WHEN lifetime_value >= 10000 THEN 'VIP'
               WHEN lifetime_value >= 1000  THEN 'Regular'
               ELSE 'New/Low Value'
           END AS segment
    FROM customer_totals
)
SELECT segment, COUNT(*) AS customer_count, AVG(lifetime_value) AS avg_ltv
FROM customer_segments
GROUP BY segment;
```

---

## 3. Recursive CTEs (Hierarchies)

Used for org charts, manager hierarchies, or bill-of-materials structures (see the RLS cheatsheet's "Hierarchical RLS Pattern" for a BI use case).

```sql
WITH RECURSIVE employee_hierarchy AS (
    -- Anchor: top-level (CEO, no manager)
    SELECT employee_id, manager_id, employee_name,
           CAST(employee_id AS VARCHAR(500)) AS hierarchy_path,
           0 AS level
    FROM dim_employee
    WHERE manager_id IS NULL

    UNION ALL

    -- Recursive: join each employee to their manager's row above
    SELECT e.employee_id, e.manager_id, e.employee_name,
           eh.hierarchy_path || '/' || CAST(e.employee_id AS VARCHAR),
           eh.level + 1
    FROM dim_employee e
    JOIN employee_hierarchy eh ON e.manager_id = eh.employee_id
)
SELECT * FROM employee_hierarchy ORDER BY hierarchy_path;
```

---

## 4. Star Schema Join Pattern

```sql
-- Star schema join pattern
SELECT d.year, p.category, SUM(f.sales_amount) AS total_sales
FROM fact_sales f
JOIN dim_date d ON f.date_key = d.date_key
JOIN dim_product p ON f.product_key = p.product_key
GROUP BY d.year, p.category;
```

### Handling a Role-Playing Dimension (see Semantic Modeling cheatsheet)
```sql
SELECT
    order_date_dim.year AS order_year,
    ship_date_dim.year AS ship_year,
    SUM(f.sales_amount) AS total_sales
FROM fact_orders f
JOIN dim_date order_date_dim ON f.order_date_key = order_date_dim.date_key
JOIN dim_date ship_date_dim ON f.ship_date_key = ship_date_dim.date_key
GROUP BY order_date_dim.year, ship_date_dim.year;
```

---

## 5. Pivoting Data for Reporting

```sql
-- Pivot months into columns (ANSI standard, works in most modern warehouses)
SELECT
    product_category,
    SUM(CASE WHEN month = 1 THEN sales ELSE 0 END) AS jan_sales,
    SUM(CASE WHEN month = 2 THEN sales ELSE 0 END) AS feb_sales,
    SUM(CASE WHEN month = 3 THEN sales ELSE 0 END) AS mar_sales
FROM fact_sales_monthly
GROUP BY product_category;

-- Unpivot (turn columns back into rows) — useful before loading into a BI tool
SELECT product_category, 'Jan' AS month, jan_sales AS sales FROM wide_table
UNION ALL
SELECT product_category, 'Feb' AS month, feb_sales AS sales FROM wide_table;
```

---

## 6. Date & Time Functions

```sql
-- Common date truncation/extraction (syntax varies slightly by warehouse)
DATE_TRUNC('month', order_date)         AS order_month
EXTRACT(YEAR FROM order_date)           AS order_year
EXTRACT(DOW FROM order_date)            AS day_of_week   -- 0=Sunday

-- Date differences
DATEDIFF('day', order_date, ship_date)  AS days_to_ship

-- Generating a date spine (useful for building a dim_date table)
SELECT
    CAST('2020-01-01' AS DATE) + (n || ' days')::INTERVAL AS calendar_date
FROM generate_series(0, 3650) AS n;   -- ~10 years of dates (PostgreSQL syntax)
```

---

## 7. Data Quality Checks

Run these before certifying a dataset for BI consumption:

```sql
-- Check for duplicate keys (should return 0 rows)
SELECT order_id, COUNT(*)
FROM fct_sales
GROUP BY order_id
HAVING COUNT(*) > 1;

-- Check for orphaned foreign keys (fact rows with no matching dimension)
SELECT f.customer_id
FROM fct_sales f
LEFT JOIN dim_customer c ON f.customer_id = c.customer_id
WHERE c.customer_id IS NULL;

-- Check for unexpected NULLs in a required column
SELECT COUNT(*) AS null_count
FROM fct_sales
WHERE sales_amount IS NULL;

-- Sanity check: total row count trend day-over-day (catch broken pipelines)
SELECT load_date, COUNT(*) AS row_count
FROM fct_sales
GROUP BY load_date
ORDER BY load_date DESC
LIMIT 7;
```
These map directly to automated tests in tools like **dbt tests** (`unique`, `not_null`, `relationships`) or **Great Expectations**.

---

## 8. Query Performance Basics

- Use `EXPLAIN` / `EXPLAIN ANALYZE` to see the query plan before optimizing blindly.
- Filter as early as possible (push `WHERE` clauses before joins where the optimizer doesn't already do so).
- Index columns used in `JOIN` and `WHERE` clauses, especially foreign keys on large fact tables.
- Avoid `SELECT *` in views/models feeding BI tools — only pull needed columns to reduce I/O and improve query-folding behavior in Power Query.
- Materialize expensive aggregations as tables/materialized views rather than recomputing them in every dashboard query.
```sql
EXPLAIN ANALYZE
SELECT region, SUM(sales_amount)
FROM fct_sales
WHERE order_date >= '2024-01-01'
GROUP BY region;
```
