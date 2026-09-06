# MySQL Cheatsheet for Data/Analytics Engineers

> A structured, task-oriented reference for MySQL as used in analytics and data engineering work — connection basics through joins, window functions, CTEs, performance, and admin. Jump via the table of contents or search for a `##` heading.

## 📑 Table of Contents

1. [🔌 Connection & Authentication](#connection-authentication)
2. [🗄️ Database Operations](#database-operations)
3. [📊 Table Operations](#table-operations)
4. [🔧 Column Operations](#column-operations)
5. [📝 Data Types](#data-types)
6. [✏️ CRUD Operations](#crud-operations)
7. [🔎 WHERE Clauses](#where-clauses)
8. [🔗 Joins](#joins)
9. [📈 Advanced Aggregations](#advanced-aggregations)
10. [🪟 Window Functions](#window-functions)
11. [🔄 CTEs - Clean Complex Queries](#ctes---clean-complex-queries)
12. [📋 JSON Functions (MySQL 5.7+)](#json-functions-mysql-57)
13. [💾 Materialized Views (using tables)](#materialized-views-using-tables)
14. [👁️ Views](#views)
15. [⚙️ Stored Procedures & Functions](#stored-procedures-functions)
16. [🔄 Transactions](#transactions)
17. [🔖 Indexes (Analytics-Focused)](#indexes-analytics-focused)
18. [🔎 Full-Text Search](#full-text-search)
19. [⚡ Performance Optimization for Analytics](#performance-optimization-for-analytics)
20. [✅ Data Quality Checks](#data-quality-checks)
21. [🔍 Data Profiling](#data-profiling)
22. [📅 Date/Time Analytics](#datetime-analytics)
23. [🧹 String Functions for Data Cleaning](#string-functions-for-data-cleaning)
24. [🎲 Sampling Techniques](#sampling-techniques)
25. [🎯 Analytics Use Case Examples](#analytics-use-case-examples)
26. [⚠️ Common Gotchas](#common-gotchas)
27. [📤 Data Export for Analysis Tools](#data-export-for-analysis-tools)
28. [👤 User Management](#user-management)
29. [💼 Backup & Restore](#backup-restore)
30. [🖥️ System Information](#system-information)

## ⚡ Quick Reference

**Syntax cheatsheet**

| Task                   | Syntax                                                                      |
| ---------------------- | --------------------------------------------------------------------------- |
| Connect                | `mysql -h host -P 3306 -u user -p dbname`                                   |
| List / switch database | `SHOW DATABASES;` · `USE db;`                                               |
| List / describe table  | `SHOW TABLES;` · `DESCRIBE t;`                                              |
| Select                 | `SELECT cols FROM t WHERE ... ORDER BY ... LIMIT n OFFSET m;`               |
| Insert                 | `INSERT INTO t (a,b) VALUES (1,2);`                                         |
| Upsert                 | `INSERT ... ON DUPLICATE KEY UPDATE col = VALUES(col);`                     |
| Update                 | `UPDATE t SET a = 1 WHERE ...;`                                             |
| Delete                 | `DELETE FROM t WHERE ...;`                                                  |
| Join                   | `FROM t1 [INNER\|LEFT\|RIGHT\|CROSS] JOIN t2 ON t1.id = t2.fk;`             |
| Group & filter groups  | `GROUP BY col HAVING COUNT(*) > n;`                                         |
| Window function        | `ROW_NUMBER()\|RANK()\|LAG()\|LEAD() OVER (PARTITION BY ... ORDER BY ...)`  |
| CTE                    | `WITH cte AS (SELECT ...) SELECT * FROM cte;`                               |
| Index                  | `CREATE INDEX idx ON t (col1, col2);`                                       |
| Query plan             | `EXPLAIN SELECT ...;`                                                       |
| Backup / restore       | `mysqldump -u user -p db > backup.sql` · `mysql -u user -p db < backup.sql` |

**Common built-in functions**

| Category      | Functions                                                              |
| ------------- | ---------------------------------------------------------------------- |
| String        | `CONCAT`, `SUBSTRING`, `TRIM`, `REPLACE`, `UPPER`/`LOWER`, `LENGTH`    |
| Numeric       | `ROUND`, `FLOOR`, `CEIL`, `ABS`, `MOD`                                 |
| Date/Time     | `NOW()`, `CURDATE()`, `DATE_ADD`/`DATE_SUB`, `DATEDIFF`, `DATE_FORMAT` |
| NULL handling | `IFNULL`, `COALESCE`, `NULLIF`                                         |
| Conditional   | `CASE WHEN ... THEN ... ELSE ... END`, `IF(cond, a, b)`                |

## 🔌 Connection & Authentication

```sql
-- Connect to MySQL
mysql -u username -p
mysql -u username -p database_name
mysql -h hostname -u username -p database_name

-- Connect with specific port
mysql -h hostname -P 3306 -u username -p

-- Exit MySQL
EXIT; or QUIT; or \q
```

## 🗄️ Database Operations

```sql
-- Show all databases
SHOW DATABASES;

-- Create database
CREATE DATABASE database_name;
CREATE DATABASE IF NOT EXISTS database_name;

-- Use/Select database
USE database_name;

-- Drop database
DROP DATABASE database_name;
DROP DATABASE IF EXISTS database_name;

-- Show current database
SELECT DATABASE();
```

## 📊 Table Operations

```sql
-- Show all tables
SHOW TABLES;

-- Create table
CREATE TABLE table_name (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    age INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Show table structure
DESCRIBE table_name;
SHOW COLUMNS FROM table_name;

-- Show create table statement
SHOW CREATE TABLE table_name;

-- Drop table
DROP TABLE table_name;
DROP TABLE IF EXISTS table_name;

-- Rename table
RENAME TABLE old_name TO new_name;
ALTER TABLE old_name RENAME TO new_name;

-- Truncate table (delete all data)
TRUNCATE TABLE table_name;
```

## 🔧 Column Operations

```sql
-- Add column
ALTER TABLE table_name ADD COLUMN column_name datatype;
ALTER TABLE table_name ADD column_name VARCHAR(255) AFTER existing_column;

-- Modify column
ALTER TABLE table_name MODIFY COLUMN column_name new_datatype;
ALTER TABLE table_name CHANGE old_column_name new_column_name datatype;

-- Drop column
ALTER TABLE table_name DROP COLUMN column_name;

-- Add primary key
ALTER TABLE table_name ADD PRIMARY KEY (column_name);

-- Drop primary key
ALTER TABLE table_name DROP PRIMARY KEY;
```

## 📝 Data Types

```sql
-- Numeric
TINYINT, SMALLINT, MEDIUMINT, INT, BIGINT
DECIMAL(precision, scale), NUMERIC(precision, scale)
FLOAT, DOUBLE

-- String
CHAR(length)        -- Fixed length
VARCHAR(length)     -- Variable length
TEXT, MEDIUMTEXT, LONGTEXT
BINARY, VARBINARY
BLOB, MEDIUMBLOB, LONGBLOB

-- Date/Time
DATE                -- YYYY-MM-DD
TIME                -- HH:MM:SS
DATETIME            -- YYYY-MM-DD HH:MM:SS
TIMESTAMP           -- YYYY-MM-DD HH:MM:SS
YEAR                -- YYYY

-- JSON (MySQL 5.7+)
JSON
```

## ✏️ CRUD Operations

### INSERT

```sql
-- Insert single record
INSERT INTO table_name (column1, column2) VALUES (value1, value2);

-- Insert multiple records
INSERT INTO table_name (column1, column2) VALUES
    (value1, value2),
    (value3, value4);

-- Insert with SELECT
INSERT INTO table_name (column1, column2)
SELECT column1, column2 FROM other_table WHERE condition;

-- Insert or update (upsert)
INSERT INTO table_name (id, name) VALUES (1, 'John')
ON DUPLICATE KEY UPDATE name = VALUES(name);
```

### SELECT

```sql
-- Basic select
SELECT * FROM table_name;
SELECT column1, column2 FROM table_name;

-- With conditions
SELECT * FROM table_name WHERE condition;
SELECT * FROM table_name WHERE column1 = 'value' AND column2 > 10;

-- Sorting
SELECT * FROM table_name ORDER BY column1 ASC, column2 DESC;

-- Limiting results
SELECT * FROM table_name LIMIT 10;
SELECT * FROM table_name LIMIT 10 OFFSET 20;

-- Grouping
SELECT column1, COUNT(*) FROM table_name GROUP BY column1;
SELECT column1, COUNT(*) FROM table_name GROUP BY column1 HAVING COUNT(*) > 5;

-- Distinct values
SELECT DISTINCT column1 FROM table_name;
```

### UPDATE

```sql
-- Update records
UPDATE table_name SET column1 = value1 WHERE condition;
UPDATE table_name SET column1 = value1, column2 = value2 WHERE condition;

-- Update with JOIN
UPDATE table1 t1
JOIN table2 t2 ON t1.id = t2.id
SET t1.column1 = t2.column1
WHERE condition;
```

### DELETE

```sql
-- Delete records
DELETE FROM table_name WHERE condition;

-- Delete all records (keep structure)
DELETE FROM table_name;

-- Delete with JOIN
DELETE t1 FROM table1 t1
JOIN table2 t2 ON t1.id = t2.id
WHERE condition;
```

## 🔎 WHERE Clauses

```sql
-- Comparison operators
WHERE column = value
WHERE column != value (or <> value)
WHERE column > value
WHERE column >= value
WHERE column < value
WHERE column <= value

-- Pattern matching
WHERE column LIKE 'pattern%'      -- Starts with
WHERE column LIKE '%pattern'      -- Ends with
WHERE column LIKE '%pattern%'     -- Contains
WHERE column REGEXP 'pattern'     -- Regular expression

-- Range and lists
WHERE column BETWEEN value1 AND value2
WHERE column IN (value1, value2, value3)
WHERE column NOT IN (value1, value2)

-- NULL checks
WHERE column IS NULL
WHERE column IS NOT NULL

-- Logical operators
WHERE condition1 AND condition2
WHERE condition1 OR condition2
WHERE NOT condition

-- Date filters
WHERE date_column >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
WHERE YEAR(date_column) = 2024
WHERE date_column BETWEEN '2024-01-01' AND '2024-12-31'
```

## 🔗 Joins

```sql
-- INNER JOIN
SELECT * FROM table1 t1
INNER JOIN table2 t2 ON t1.id = t2.foreign_id;

-- LEFT JOIN
SELECT * FROM table1 t1
LEFT JOIN table2 t2 ON t1.id = t2.foreign_id;

-- RIGHT JOIN
SELECT * FROM table1 t1
RIGHT JOIN table2 t2 ON t1.id = t2.foreign_id;

-- FULL OUTER JOIN (not directly supported, use UNION)
SELECT * FROM table1 t1 LEFT JOIN table2 t2 ON t1.id = t2.foreign_id
UNION
SELECT * FROM table1 t1 RIGHT JOIN table2 t2 ON t1.id = t2.foreign_id;

-- CROSS JOIN
SELECT * FROM table1 CROSS JOIN table2;

-- Self JOIN
SELECT a.name, b.name as manager
FROM employees a
LEFT JOIN employees b ON a.manager_id = b.id;
```

## 📈 Advanced Aggregations

```sql
-- ROLLUP - Generate subtotals and grand totals
SELECT
    COALESCE(region, 'All Regions') as region,
    COALESCE(category, 'All Categories') as category,
    SUM(sales) as total_sales
FROM sales_data
GROUP BY region, category WITH ROLLUP;

-- Multiple aggregations with CASE
SELECT
    product_category,
    COUNT(*) as total_orders,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
    AVG(CASE WHEN status = 'completed' THEN order_value END) as avg_completed_value,
    SUM(CASE WHEN order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as orders_last_30d
FROM orders
GROUP BY product_category;

-- Conditional aggregations for pivot-like results
SELECT
    DATE_FORMAT(date, '%Y-%m') as month,
    SUM(CASE WHEN product = 'A' THEN sales ELSE 0 END) as product_a_sales,
    SUM(CASE WHEN product = 'B' THEN sales ELSE 0 END) as product_b_sales,
    SUM(CASE WHEN product = 'C' THEN sales ELSE 0 END) as product_c_sales
FROM sales
GROUP BY DATE_FORMAT(date, '%Y-%m');

-- Percentile calculations
SELECT
    department,
    AVG(salary) as avg_salary,
    MIN(salary) as min_salary,
    MAX(salary) as max_salary,
    (SELECT salary FROM employees e2
     WHERE e2.department = e1.department
     ORDER BY salary
     LIMIT 1 OFFSET FLOOR(COUNT(*) * 0.5)) as median_salary
FROM employees e1
GROUP BY department;
```

## 🪟 Window Functions

```sql
-- ROW_NUMBER - Assign unique row numbers
SELECT
    name,
    department,
    salary,
    ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) as row_num
FROM employees;

-- RANK and DENSE_RANK - Handle ties differently
SELECT
    name,
    score,
    RANK() OVER (ORDER BY score DESC) as rank,
    DENSE_RANK() OVER (ORDER BY score DESC) as dense_rank
FROM students;

-- LAG and LEAD - Access previous/next rows
SELECT
    date,
    revenue,
    LAG(revenue, 1) OVER (ORDER BY date) as prev_day_revenue,
    LEAD(revenue, 1) OVER (ORDER BY date) as next_day_revenue,
    revenue - LAG(revenue, 1) OVER (ORDER BY date) as day_over_day_change
FROM daily_sales;

-- Running totals and moving averages
SELECT
    date,
    amount,
    SUM(amount) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as running_total,
    AVG(amount) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as moving_avg_7day
FROM transactions;

-- NTILE - Divide into buckets (quartiles, deciles, etc.)
SELECT
    customer_id,
    total_spend,
    NTILE(4) OVER (ORDER BY total_spend DESC) as quartile,
    NTILE(10) OVER (ORDER BY total_spend DESC) as decile
FROM customer_summary;

-- FIRST_VALUE and LAST_VALUE
SELECT
    product_id,
    date,
    price,
    FIRST_VALUE(price) OVER (PARTITION BY product_id ORDER BY date) as initial_price,
    LAST_VALUE(price) OVER (PARTITION BY product_id ORDER BY date
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as latest_price
FROM product_prices;
```

## 🔄 CTEs - Clean Complex Queries

```sql
-- Basic CTE
WITH monthly_sales AS (
    SELECT
        DATE_FORMAT(order_date, '%Y-%m') as month,
        SUM(amount) as total_sales
    FROM orders
    GROUP BY DATE_FORMAT(order_date, '%Y-%m')
)
SELECT * FROM monthly_sales WHERE total_sales > 10000;

-- Multiple CTEs
WITH
customer_totals AS (
    SELECT customer_id, SUM(amount) as total_spent
    FROM orders
    GROUP BY customer_id
),
customer_segments AS (
    SELECT
        customer_id,
        total_spent,
        CASE
            WHEN total_spent > 1000 THEN 'High Value'
            WHEN total_spent > 500 THEN 'Medium Value'
            ELSE 'Low Value'
        END as segment
    FROM customer_totals
)
SELECT segment, COUNT(*) as customer_count, AVG(total_spent) as avg_spent
FROM customer_segments
GROUP BY segment;

-- Recursive CTE (for hierarchical data)
WITH RECURSIVE employee_hierarchy AS (
    SELECT id, name, manager_id, 1 as level
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    SELECT e.id, e.name, e.manager_id, eh.level + 1
    FROM employees e
    INNER JOIN employee_hierarchy eh ON e.manager_id = eh.id
)
SELECT * FROM employee_hierarchy ORDER BY level, name;
```

## 📋 JSON Functions (MySQL 5.7+)

```sql
-- JSON creation
JSON_OBJECT('key', 'value')
JSON_ARRAY(value1, value2)

-- JSON extraction
JSON_EXTRACT(json_column, '$.key')
json_column->'$.key'              -- Shorthand
json_column->>'$.key'             -- Unquoted

-- JSON modification
JSON_SET(json_column, '$.key', 'new_value')
JSON_INSERT(json_column, '$.new_key', 'value')
JSON_REPLACE(json_column, '$.key', 'new_value')
JSON_REMOVE(json_column, '$.key')

-- JSON aggregation
SELECT
    category,
    JSON_ARRAYAGG(product_name) as products,
    JSON_OBJECTAGG(product_id, price) as product_prices
FROM products
GROUP BY category;
```

## 💾 Materialized Views (using tables)

```sql
-- Create summary table for fast analytics
CREATE TABLE sales_summary AS
SELECT
    DATE(order_date) as date,
    product_id,
    SUM(quantity) as total_quantity,
    SUM(amount) as total_revenue,
    COUNT(DISTINCT customer_id) as unique_customers
FROM orders
WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
GROUP BY DATE(order_date), product_id;

-- Add index for performance
CREATE INDEX idx_date_product ON sales_summary(date, product_id);

-- Refresh materialized view
TRUNCATE TABLE sales_summary;
INSERT INTO sales_summary
SELECT
    DATE(order_date) as date,
    product_id,
    SUM(quantity) as total_quantity,
    SUM(amount) as total_revenue,
    COUNT(DISTINCT customer_id) as unique_customers
FROM orders
WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
GROUP BY DATE(order_date), product_id;
```

## 👁️ Views

```sql
-- Create view
CREATE VIEW view_name AS
SELECT column1, column2 FROM table_name WHERE condition;

-- Create or replace view
CREATE OR REPLACE VIEW customer_metrics AS
SELECT
    customer_id,
    COUNT(*) as order_count,
    SUM(amount) as lifetime_value,
    AVG(amount) as avg_order_value,
    MAX(order_date) as last_order_date
FROM orders
GROUP BY customer_id;

-- Show views
SHOW FULL TABLES WHERE Table_type = 'VIEW';

-- Drop view
DROP VIEW view_name;
```

## ⚙️ Stored Procedures & Functions

```sql
-- Create stored procedure
DELIMITER //
CREATE PROCEDURE procedure_name(IN param1 INT, OUT param2 VARCHAR(255))
BEGIN
    -- procedure body
    SELECT column1 INTO param2 FROM table_name WHERE id = param1;
END //
DELIMITER ;

-- Call procedure
CALL procedure_name(1, @result);
SELECT @result;

-- Create function
DELIMITER //
CREATE FUNCTION function_name(param1 INT) RETURNS VARCHAR(255)
READS SQL DATA
BEGIN
    DECLARE result VARCHAR(255);
    SELECT column1 INTO result FROM table_name WHERE id = param1;
    RETURN result;
END //
DELIMITER ;

-- Drop procedure/function
DROP PROCEDURE procedure_name;
DROP FUNCTION function_name;
```

## 🔄 Transactions

```sql
-- Start transaction
START TRANSACTION;
BEGIN;

-- Commit transaction
COMMIT;

-- Rollback transaction
ROLLBACK;

-- Savepoints
SAVEPOINT savepoint_name;
ROLLBACK TO savepoint_name;
```

## 🔖 Indexes (Analytics-Focused)

```sql
-- Create index
CREATE INDEX index_name ON table_name (column1, column2);
CREATE UNIQUE INDEX index_name ON table_name (column1);

-- Composite index (column order matters!)
CREATE INDEX idx_analytics ON fact_table (date_key, product_key, customer_key);

-- Show indexes
SHOW INDEX FROM table_name;

-- Drop index
DROP INDEX index_name ON table_name;
ALTER TABLE table_name DROP INDEX index_name;

-- Analyze table (update statistics)
ANALYZE TABLE table_name;
```

## 🔎 Full-Text Search

```sql
-- Add a FULLTEXT index (InnoDB 5.6+ or MyISAM)
ALTER TABLE articles ADD FULLTEXT INDEX ft_idx (title, body);

-- Natural language search, ranked by relevance
SELECT id, title, MATCH(title, body) AGAINST ('data engineering') AS relevance
FROM articles
WHERE MATCH(title, body) AGAINST ('data engineering')
ORDER BY relevance DESC;

-- Boolean mode: +required -excluded "exact phrase" *wildcard
SELECT * FROM articles
WHERE MATCH(title, body) AGAINST ('+mysql -oracle "query tuning"' IN BOOLEAN MODE);

-- Query expansion (find conceptually related rows)
SELECT * FROM articles
WHERE MATCH(title, body) AGAINST ('database' WITH QUERY EXPANSION);
```

## ⚡ Performance Optimization for Analytics

```sql
-- EXPLAIN - Analyze query execution plan
EXPLAIN SELECT * FROM large_table WHERE indexed_column = 'value';
EXPLAIN FORMAT=JSON SELECT * FROM table_name WHERE condition;

-- Show query profile
SET profiling = 1;
SELECT * FROM table_name WHERE condition;
SHOW PROFILES;
SHOW PROFILE FOR QUERY 1;

-- Index usage analysis
SELECT
    table_name,
    index_name,
    seq_in_index,
    column_name,
    cardinality
FROM information_schema.statistics
WHERE table_schema = 'your_database'
ORDER BY table_name, index_name, seq_in_index;

-- Identify missing indexes (slow queries without index)
SELECT * FROM information_schema.tables
WHERE table_schema = 'your_database'
AND table_rows > 10000
AND table_name NOT IN (
    SELECT DISTINCT table_name
    FROM information_schema.statistics
    WHERE table_schema = 'your_database'
);

-- Composite index recommendation
CREATE INDEX idx_composite ON table_name (frequently_filtered_col, join_col, sorted_col);

-- Covering index (include all columns in query)
CREATE INDEX idx_covering ON orders (customer_id, order_date, status, amount);
```

## ✅ Data Quality Checks

```sql
-- Check for duplicates
SELECT column1, column2, COUNT(*) as duplicate_count
FROM table_name
GROUP BY column1, column2
HAVING COUNT(*) > 1;

-- Check for NULL values
SELECT
    COUNT(*) as total_rows,
    SUM(CASE WHEN column1 IS NULL THEN 1 ELSE 0 END) as column1_nulls,
    SUM(CASE WHEN column2 IS NULL THEN 1 ELSE 0 END) as column2_nulls,
    ROUND(100.0 * SUM(CASE WHEN column1 IS NULL THEN 1 ELSE 0 END) / COUNT(*), 2) as column1_null_pct
FROM table_name;

-- Check for data consistency
SELECT
    'Total records' as check_type,
    COUNT(*) as count
FROM orders
UNION ALL
SELECT
    'Records with invalid dates',
    COUNT(*)
FROM orders
WHERE order_date > CURDATE() OR order_date < '2000-01-01'
UNION ALL
SELECT
    'Records with negative amounts',
    COUNT(*)
FROM orders
WHERE amount < 0;

-- Find outliers using IQR method
WITH quartiles AS (
    SELECT
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY value) as q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) as q3
    FROM measurements
)
SELECT m.*
FROM measurements m
CROSS JOIN quartiles q
WHERE m.value < (q.q1 - 1.5 * (q.q3 - q.q1))
   OR m.value > (q.q3 + 1.5 * (q.q3 - q.q1));
```

## 🔍 Data Profiling

```sql
-- Get table statistics
SELECT
    table_name,
    table_rows,
    ROUND(data_length / 1024 / 1024, 2) as data_size_mb,
    ROUND(index_length / 1024 / 1024, 2) as index_size_mb,
    ROUND((data_length + index_length) / 1024 / 1024, 2) as total_size_mb
FROM information_schema.tables
WHERE table_schema = 'your_database'
ORDER BY (data_length + index_length) DESC;

-- Column statistics
SELECT
    column_name,
    COUNT(*) as total_count,
    COUNT(DISTINCT column_name) as unique_count,
    SUM(CASE WHEN column_name IS NULL THEN 1 ELSE 0 END) as null_count,
    MIN(column_name) as min_value,
    MAX(column_name) as max_value
FROM table_name;

-- Value frequency distribution
SELECT
    column_name,
    COUNT(*) as frequency,
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM table_name), 2) as percentage
FROM table_name
GROUP BY column_name
ORDER BY frequency DESC
LIMIT 20;

-- Cardinality check for all columns
SELECT
    'column1' as column_name,
    COUNT(DISTINCT column1) as distinct_count,
    COUNT(*) as total_count,
    ROUND(100.0 * COUNT(DISTINCT column1) / COUNT(*), 2) as uniqueness_pct
FROM table_name
UNION ALL
SELECT 'column2', COUNT(DISTINCT column2), COUNT(*),
    ROUND(100.0 * COUNT(DISTINCT column2) / COUNT(*), 2)
FROM table_name;
```

## 📅 Date/Time Analytics

```sql
-- Date dimension generation
WITH RECURSIVE date_series AS (
    SELECT DATE('2024-01-01') as date
    UNION ALL
    SELECT DATE_ADD(date, INTERVAL 1 DAY)
    FROM date_series
    WHERE date < '2024-12-31'
)
SELECT
    date,
    DAYNAME(date) as day_name,
    WEEK(date) as week_number,
    MONTH(date) as month,
    QUARTER(date) as quarter,
    YEAR(date) as year,
    CASE WHEN DAYOFWEEK(date) IN (1, 7) THEN 1 ELSE 0 END as is_weekend
FROM date_series;

-- Time-based cohort analysis
SELECT
    DATE_FORMAT(first_purchase_date, '%Y-%m') as cohort_month,
    TIMESTAMPDIFF(MONTH, first_purchase_date, purchase_date) as months_since_first,
    COUNT(DISTINCT customer_id) as active_customers,
    SUM(amount) as total_revenue
FROM (
    SELECT
        customer_id,
        purchase_date,
        MIN(purchase_date) OVER (PARTITION BY customer_id) as first_purchase_date,
        amount
    FROM purchases
) cohort_data
GROUP BY cohort_month, months_since_first
ORDER BY cohort_month, months_since_first;

-- Year-over-year comparison
SELECT
    DATE_FORMAT(date, '%Y-%m') as month,
    SUM(revenue) as current_revenue,
    LAG(SUM(revenue), 12) OVER (ORDER BY DATE_FORMAT(date, '%Y-%m')) as prev_year_revenue,
    ROUND(100.0 * (SUM(revenue) - LAG(SUM(revenue), 12) OVER (ORDER BY DATE_FORMAT(date, '%Y-%m'))) /
        LAG(SUM(revenue), 12) OVER (ORDER BY DATE_FORMAT(date, '%Y-%m')), 2) as yoy_growth_pct
FROM sales
GROUP BY DATE_FORMAT(date, '%Y-%m');
```

## 🧹 String Functions for Data Cleaning

```sql
-- Clean and standardize text
SELECT
    TRIM(BOTH ' ' FROM name) as cleaned_name,
    UPPER(TRIM(email)) as standardized_email,
    REPLACE(phone, '-', '') as phone_digits_only,
    REGEXP_REPLACE(address, '[^a-zA-Z0-9 ]', '') as clean_address
FROM customers;

-- Extract patterns
SELECT
    email,
    SUBSTRING_INDEX(email, '@', 1) as username,
    SUBSTRING_INDEX(email, '@', -1) as domain,
    CASE
        WHEN email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$'
        THEN 'Valid'
        ELSE 'Invalid'
    END as email_validity
FROM users;

-- Fuzzy matching (true Levenshtein edit distance)
-- MySQL has no built-in Levenshtein function; this stored function implements
-- the standard dynamic-programming algorithm so it can be used in SQL directly.
DELIMITER //
CREATE FUNCTION levenshtein(s1 VARCHAR(255), s2 VARCHAR(255))
RETURNS INT
DETERMINISTIC
BEGIN
    DECLARE s1_len, s2_len, i, j, c, c_temp, cost INT;
    DECLARE s1_char CHAR;
    DECLARE cv0, cv1 VARBINARY(256);

    SET s1_len = CHAR_LENGTH(s1), s2_len = CHAR_LENGTH(s2), cv1 = 0x00, j = 1, i = 1, c = 0;

    IF s1 = s2 THEN
        RETURN 0;
    ELSEIF s1_len = 0 THEN
        RETURN s2_len;
    ELSEIF s2_len = 0 THEN
        RETURN s1_len;
    END IF;

    WHILE j <= s2_len DO
        SET cv1 = CONCAT(cv1, UNHEX(HEX(j))), j = j + 1;
    END WHILE;

    WHILE i <= s1_len DO
        SET s1_char = SUBSTRING(s1, i, 1), c = i, cv0 = UNHEX(HEX(i)), j = 1;
        WHILE j <= s2_len DO
            SET c = c + 1;
            IF s1_char = SUBSTRING(s2, j, 1) THEN
                SET cost = 0;
            ELSE
                SET cost = 1;
            END IF;
            SET c_temp = CONV(HEX(SUBSTRING(cv1, j, 1)), 16, 10) + cost;
            IF c > c_temp THEN
                SET c = c_temp;
            END IF;
            SET c_temp = CONV(HEX(SUBSTRING(cv1, j + 1, 1)), 16, 10) + 1;
            IF c > c_temp THEN
                SET c = c_temp;
            END IF;
            SET cv0 = CONCAT(cv0, UNHEX(HEX(c))), j = j + 1;
        END WHILE;
        SET cv1 = cv0, i = i + 1;
    END WHILE;

    RETURN c;
END//
DELIMITER ;

-- Usage: find near-duplicate names within a small edit distance
SELECT
    a.name as name1,
    b.name as name2,
    levenshtein(a.name, b.name) as edit_distance
FROM names a
CROSS JOIN names b
WHERE a.id < b.id
HAVING edit_distance <= 2
ORDER BY edit_distance;
```

## 🎲 Sampling Techniques

```sql
-- Random sampling (percentage)
SELECT * FROM large_table
WHERE RAND() < 0.01  -- 1% sample
LIMIT 10000;

-- Systematic sampling
SELECT * FROM large_table
WHERE id % 100 = 0;  -- Every 100th row

-- Stratified sampling
SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY RAND()) as rn
    FROM products
) sampled
WHERE rn <= 10;  -- 10 samples per category
```

## 🎯 Analytics Use Case Examples

```sql
-- Customer RFM Analysis (Recency, Frequency, Monetary)
WITH customer_rfm AS (
    SELECT
        customer_id,
        DATEDIFF(CURDATE(), MAX(order_date)) as recency,
        COUNT(order_id) as frequency,
        SUM(amount) as monetary
    FROM orders
    GROUP BY customer_id
)
SELECT
    customer_id,
    recency,
    frequency,
    monetary,
    NTILE(5) OVER (ORDER BY recency DESC) as r_score,
    NTILE(5) OVER (ORDER BY frequency) as f_score,
    NTILE(5) OVER (ORDER BY monetary) as m_score
FROM customer_rfm;

-- Funnel Analysis
SELECT
    step,
    COUNT(DISTINCT user_id) as users,
    ROUND(100.0 * COUNT(DISTINCT user_id) /
        FIRST_VALUE(COUNT(DISTINCT user_id)) OVER (ORDER BY step), 2) as conversion_rate
FROM (
    SELECT user_id, 1 as step FROM page_views WHERE page = 'landing'
    UNION ALL
    SELECT user_id, 2 FROM page_views WHERE page = 'product'
    UNION ALL
    SELECT user_id, 3 FROM cart_additions
    UNION ALL
    SELECT user_id, 4 FROM purchases
) funnel
GROUP BY step
ORDER BY step;

-- Moving Average for Trend Analysis
SELECT
    date,
    revenue,
    AVG(revenue) OVER (
        ORDER BY date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) as ma_7day,
    AVG(revenue) OVER (
        ORDER BY date
        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
    ) as ma_30day
FROM daily_revenue
ORDER BY date;
```

## ⚠️ Common Gotchas

- **`=` vs `IS NULL`** — `WHERE col = NULL` never matches anything; use `IS NULL` / `IS NOT NULL`.
- **`ONLY_FULL_GROUP_BY`** (default since 5.7.5) rejects `SELECT` columns that aren't in `GROUP BY` or wrapped in an aggregate — use `ANY_VALUE()` if you intentionally need a non-grouped column.
- **Case-insensitive by default** — with common `*_ci` collations (e.g. `utf8mb4_general_ci`), `'Alice' = 'alice'` is `TRUE`. Use a `_cs` or `_bin` collation if you need case-sensitive comparisons.
- **`AUTO_INCREMENT` gaps are normal** — failed inserts, rolled-back transactions, and deletes never reclaim the counter; don't assume IDs are contiguous.
- **`ON DUPLICATE KEY UPDATE`** only works if the conflicting column(s) have a `UNIQUE` or `PRIMARY KEY` constraint — otherwise it just inserts a duplicate row.
- **Storage engine matters** — `InnoDB` (default) gives you transactions, row-level locking, and foreign keys; check `SHOW TABLE STATUS` if something isn't rolling back the way you expect.
- **Identifier case sensitivity is platform-dependent** — table/database name case sensitivity depends on the OS and the `lower_case_table_names` setting (Linux vs Windows/macOS can behave differently for identical code).
- **`LIMIT` without `ORDER BY`** has no guaranteed row order — always pair them for reproducible pagination.
- **Implicit type conversion can silently break indexes** — comparing a string column to a bare number (`WHERE varchar_col = 123`) may skip the index. Keep literal types matched to column types.

## 📤 Data Export for Analysis Tools

```sql
-- Export to CSV
SELECT 'column1', 'column2', 'column3'  -- Header row
UNION ALL
SELECT column1, column2, column3
FROM table_name
INTO OUTFILE '/tmp/export.csv'
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n';

-- Export with custom delimiter for tools like Tableau
SELECT * FROM analytics_table
INTO OUTFILE '/tmp/tableau_export.txt'
FIELDS TERMINATED BY '\t'
LINES TERMINATED BY '\n';
```

## 👤 User Management

```sql
-- Create user
CREATE USER 'username'@'localhost' IDENTIFIED BY 'password';
CREATE USER 'username'@'%' IDENTIFIED BY 'password';

-- Grant privileges
GRANT ALL PRIVILEGES ON database_name.* TO 'username'@'localhost';
GRANT SELECT, INSERT ON table_name TO 'username'@'localhost';

-- Grant read-only access (common for analysts)
GRANT SELECT ON database_name.* TO 'analyst'@'%';

-- Show grants
SHOW GRANTS FOR 'username'@'localhost';

-- Revoke privileges
REVOKE ALL PRIVILEGES ON database_name.* FROM 'username'@'localhost';

-- Drop user
DROP USER 'username'@'localhost';

-- Change password
ALTER USER 'username'@'localhost' IDENTIFIED BY 'new_password';
```

## 💼 Backup & Restore

```bash
# Export database
mysqldump -u username -p database_name > backup.sql
mysqldump -u username -p --all-databases > all_databases.sql

# Export specific tables
mysqldump -u username -p database_name table1 table2 > tables_backup.sql

# Export with compression
mysqldump -u username -p database_name | gzip > backup.sql.gz

# Import database
mysql -u username -p database_name < backup.sql
mysql -u username -p < all_databases.sql
gunzip < backup.sql.gz | mysql -u username -p database_name
```

## 🖥️ System Information

```sql
-- Show MySQL version
SELECT VERSION();

-- Show current user
SELECT USER();

-- Show processlist
SHOW PROCESSLIST;

-- Show variables
SHOW VARIABLES LIKE 'variable_name%';

-- Show status
SHOW STATUS LIKE 'status_name%';

-- Show engines
SHOW ENGINES;

-- Show database size
SELECT
    table_schema as database_name,
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size_mb
FROM information_schema.tables
GROUP BY table_schema;
```
