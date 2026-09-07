# 10. Data Warehouse Star Schema (Sales Analytics)

## Scenario

A retail company wants a BI dashboard showing sales trends by product, customer region, and time — filterable and drillable by store, category, and date range. This example builds a complete star schema from an operational (OLTP) source, including a full SCD Type 2 walkthrough.

## Step 1: Define the Grain

**Grain = one row per order line item.** This is the most important decision in dimensional modeling (see cheatsheet file 7) — get it wrong and every downstream report risks double-counting or under-counting.

## Entities & Relationships

```
                dim_date
                    |
dim_customer —— fact_sales —— dim_product
                    |
                dim_store
```

## Schema (PostgreSQL / Warehouse-style)

```sql
CREATE TABLE dim_date (
    date_key INT PRIMARY KEY,          -- format: YYYYMMDD, e.g., 20260315
    full_date DATE NOT NULL,
    day_of_week VARCHAR(10),
    month_name VARCHAR(10),
    quarter CHAR(2),
    year INT,
    is_weekend BOOLEAN,
    is_holiday BOOLEAN
);

CREATE TABLE dim_store (
    store_key SERIAL PRIMARY KEY,
    store_id VARCHAR(20) NOT NULL,     -- natural/business key from source system
    store_name VARCHAR(100),
    region VARCHAR(50),
    country VARCHAR(50)
);

CREATE TABLE dim_product (
    product_key SERIAL PRIMARY KEY,
    product_id VARCHAR(20) NOT NULL,   -- natural key
    product_name VARCHAR(255),
    category VARCHAR(100),
    brand VARCHAR(100)
);

-- Customer dimension with full SCD Type 2 support
CREATE TABLE dim_customer (
    customer_key SERIAL PRIMARY KEY,   -- surrogate key, changes per version
    customer_id VARCHAR(20) NOT NULL,  -- natural key, stable across versions
    name VARCHAR(100),
    city VARCHAR(100),
    region VARCHAR(50),
    effective_date DATE NOT NULL,
    end_date DATE,                     -- NULL = current version
    is_current BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE fact_sales (
    sales_key BIGSERIAL PRIMARY KEY,
    date_key INT NOT NULL REFERENCES dim_date(date_key),
    store_key INT NOT NULL REFERENCES dim_store(store_key),
    product_key INT NOT NULL REFERENCES dim_product(product_key),
    customer_key INT NOT NULL REFERENCES dim_customer(customer_key),
    quantity INT NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    sales_amount NUMERIC(12,2) NOT NULL,   -- additive measure
    discount_amount NUMERIC(10,2) DEFAULT 0
);

CREATE INDEX idx_fact_sales_date ON fact_sales(date_key);
CREATE INDEX idx_fact_sales_product ON fact_sales(product_key);
CREATE INDEX idx_fact_sales_customer ON fact_sales(customer_key);
```

## SCD Type 2 Walkthrough: Customer Moves Cities

**Initial state** — customer 501 lives in Manila:
```sql
INSERT INTO dim_customer (customer_id, name, city, region, effective_date, end_date, is_current)
VALUES ('CUST501', 'Jane Doe', 'Manila', 'NCR', '2026-01-01', NULL, true);
-- customer_key = 1
```

**Some sales happen while Jane lives in Manila** — `fact_sales` rows reference `customer_key = 1`.

**Jane moves to Cebu in August 2026.** The ETL process performs two steps:

```sql
-- Step 1: close out the old version
UPDATE dim_customer
SET end_date = '2026-08-14', is_current = false
WHERE customer_id = 'CUST501' AND is_current = true;

-- Step 2: insert the new version with a NEW surrogate key
INSERT INTO dim_customer (customer_id, name, city, region, effective_date, end_date, is_current)
VALUES ('CUST501', 'Jane Doe', 'Cebu', 'Central Visayas', '2026-08-15', NULL, true);
-- customer_key = 2
```

**The critical result:** Historical `fact_sales` rows from before the move still point to `customer_key = 1` (Manila), while new sales after the move point to `customer_key = 2` (Cebu). A regional sales report for August 2026 correctly attributes early-August sales to Manila and late-August sales to Cebu — this is exactly what SCD Type 2 is for.

## Sample Queries

**Total sales by region and month:**
```sql
SELECT d.year, d.month_name, c.region, SUM(f.sales_amount) AS total_sales
FROM fact_sales f
JOIN dim_date d ON f.date_key = d.date_key
JOIN dim_customer c ON f.customer_key = c.customer_key
GROUP BY d.year, d.month_name, c.region
ORDER BY d.year, d.month_name;
```

**Top-selling products by category, current quarter:**
```sql
SELECT p.category, p.product_name, SUM(f.quantity) AS units_sold
FROM fact_sales f
JOIN dim_product p ON f.product_key = p.product_key
JOIN dim_date d ON f.date_key = d.date_key
WHERE d.quarter = 'Q3' AND d.year = 2026
GROUP BY p.category, p.product_name
ORDER BY units_sold DESC
LIMIT 10;
```

**Customer's CURRENT city, regardless of history (join to `is_current` only):**
```sql
SELECT c.name, c.city
FROM dim_customer c
WHERE c.customer_id = 'CUST501' AND c.is_current = true;
```

**Sales attributed to a customer's location AT THE TIME of purchase (uses historical dim rows naturally, since fact rows reference the correct customer_key):**
```sql
SELECT c.city, SUM(f.sales_amount) AS sales
FROM fact_sales f
JOIN dim_customer c ON f.customer_key = c.customer_key
WHERE c.customer_id = 'CUST501'
GROUP BY c.city;
-- Returns separate rows for Manila and Cebu, correctly split by when sales happened
```

**Store-level revenue vs. same period last year (year-over-year):**
```sql
SELECT s.store_name, d.year,
       SUM(f.sales_amount) AS revenue
FROM fact_sales f
JOIN dim_store s ON f.store_key = s.store_key
JOIN dim_date d ON f.date_key = d.date_key
WHERE d.year IN (2025, 2026) AND d.quarter = 'Q3'
GROUP BY s.store_name, d.year
ORDER BY s.store_name, d.year;
```

## Advanced / Edge-Case Queries

**7-day moving average of daily sales (smoothing out day-to-day noise for trend charts):**
```sql
SELECT d.full_date,
       AVG(daily.total_sales) OVER (ORDER BY d.full_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS moving_avg_7d
FROM (
    SELECT date_key, SUM(sales_amount) AS total_sales
    FROM fact_sales
    GROUP BY date_key
) daily
JOIN dim_date d ON daily.date_key = d.date_key
ORDER BY d.full_date;
```

**Cohort revenue analysis — total revenue over time, grouped by the month of each customer's first purchase:**
```sql
WITH first_purchase AS (
    SELECT customer_key, MIN(date_key) AS first_date_key
    FROM fact_sales
    GROUP BY customer_key
)
SELECT fp_date.year AS cohort_year, fp_date.month_name AS cohort_month,
       sale_date.year AS sale_year, sale_date.month_name AS sale_month,
       SUM(f.sales_amount) AS revenue
FROM fact_sales f
JOIN first_purchase fp ON f.customer_key = fp.customer_key
JOIN dim_date fp_date ON fp.first_date_key = fp_date.date_key
JOIN dim_date sale_date ON f.date_key = sale_date.date_key
GROUP BY cohort_year, cohort_month, sale_year, sale_month
ORDER BY cohort_year, cohort_month, sale_year, sale_month;
```

**Percent of category total — each product's share of its category's sales (window function):**
```sql
SELECT p.category, p.product_name,
       SUM(f.sales_amount) AS product_sales,
       ROUND(SUM(f.sales_amount) * 100.0 / SUM(SUM(f.sales_amount)) OVER (PARTITION BY p.category), 1) AS pct_of_category
FROM fact_sales f
JOIN dim_product p ON f.product_key = p.product_key
GROUP BY p.category, p.product_name;
```

**New vs. returning customer sales split for a given month (a very common exec-dashboard metric):**
```sql
WITH first_purchase AS (
    SELECT customer_key, MIN(date_key) AS first_date_key
    FROM fact_sales
    GROUP BY customer_key
)
SELECT
    CASE WHEN f.date_key = fp.first_date_key THEN 'new' ELSE 'returning' END AS customer_status,
    SUM(f.sales_amount) AS revenue
FROM fact_sales f
JOIN first_purchase fp ON f.customer_key = fp.customer_key
JOIN dim_date d ON f.date_key = d.date_key
WHERE d.year = 2026 AND d.month_name = 'August'
GROUP BY customer_status;
```

**Handling a late-arriving dimension row (a fact loaded before its dimension row exists — common in real ETL pipelines) — insert a placeholder "Unknown" member and backfill later:**
```sql
-- 1. Insert a placeholder so the fact load doesn't fail on a missing FK
INSERT INTO dim_customer (customer_key, customer_id, name, city, region, effective_date, is_current)
VALUES (-1, 'UNKNOWN', 'Unknown Customer', 'Unknown', 'Unknown', '1900-01-01', true)
ON CONFLICT DO NOTHING;

-- 2. Once the real customer record arrives, backfill affected fact rows
UPDATE fact_sales
SET customer_key = (SELECT customer_key FROM dim_customer WHERE customer_id = 'CUST999' AND is_current = true)
WHERE customer_key = -1 AND /* some matching condition from the source system, e.g. */ true;
```

## Design Decisions & Trade-offs

- **`sales_amount` is additive** (safe to `SUM()` across any dimension) — always confirm a measure's additivity before building a fact table; some measures (like account balances, percentages, or ratios) are non-additive or only "semi-additive" and need special handling (e.g., average instead of sum, or only summable across some dimensions).
- **`dim_date` is a real table, not just a raw date column**, enabling fast filtering on business concepts (`is_holiday`, `quarter`) without date-function calculations on every query — a small upfront investment that pays off across every report built on this warehouse.
- **`dim_customer` uses SCD Type 2** specifically because "which region did this sale happen in, historically" is a real business question here (regional performance trends). If historical accuracy weren't important for this dimension, a simpler SCD Type 1 (just overwrite) would reduce complexity — the SCD strategy should be a deliberate choice per dimension, not a blanket rule.
- **Natural keys (`customer_id`, `product_id`, `store_id`) are preserved alongside surrogate keys** — needed to match warehouse rows back to source-system records during ETL, and to correctly implement SCD Type 2 lookups ("find the current version of this customer").

## Common Pitfalls

- Not deciding the grain before building the fact table, then discovering some ETL jobs load one row per order (not per line item), causing inconsistent, double-counted totals.
- Using SCD Type 1 (overwrite) for a dimension where historical attribution matters — silently rewrites history, making trend reports about that attribute meaningless after any change.
- Summing non-additive measures (e.g., summing a "discount percentage" across rows produces nonsense) without checking additivity first.
- Skipping `dim_date` and filtering directly on raw timestamps in the fact table — loses easy access to fiscal calendars, holidays, and pre-aggregated time buckets that analysts constantly need.

---
[← Previous: Hierarchical Data](09-hierarchical-data.md) | [Back to index](00-README.md)
