# 7. Dimensional Modeling (Data Warehousing)

## Purpose

Dimensional modeling is designed for **analytics and reporting (OLAP)**, not transactional integrity. It deliberately denormalizes data to make queries fast and intuitive for BI tools.

## Core Concepts

| Term | Meaning |
|---|---|
| **Fact Table** | Stores measurable, numeric events (sales, clicks, transactions) |
| **Dimension Table** | Stores descriptive context (who, what, where, when) |
| **Grain** | The level of detail one row in the fact table represents (e.g., "one row per order line item") |
| **Measure** | A numeric column in a fact table (e.g., `sales_amount`, `quantity`) |

## Star Schema

The most common dimensional pattern: one central fact table surrounded by denormalized dimension tables.

```
              [dim_date]
                  |
[dim_customer] — [fact_sales] — [dim_product]
                  |
              [dim_store]
```

```sql
CREATE TABLE dim_customer (
    customer_key INT PRIMARY KEY,     -- surrogate key
    customer_id VARCHAR(20),          -- natural/business key
    customer_name VARCHAR(100),
    city VARCHAR(50),
    region VARCHAR(50)
);

CREATE TABLE dim_product (
    product_key INT PRIMARY KEY,
    product_id VARCHAR(20),
    product_name VARCHAR(100),
    category VARCHAR(50),
    brand VARCHAR(50)
);

CREATE TABLE dim_date (
    date_key INT PRIMARY KEY,   -- e.g., 20260315
    full_date DATE,
    day_of_week VARCHAR(10),
    month VARCHAR(10),
    quarter VARCHAR(2),
    year INT
);

CREATE TABLE fact_sales (
    sales_key BIGINT PRIMARY KEY,
    customer_key INT REFERENCES dim_customer(customer_key),
    product_key INT REFERENCES dim_product(product_key),
    date_key INT REFERENCES dim_date(date_key),
    quantity INT,
    sales_amount NUMERIC(10,2)
);
```

**Why dimensions are denormalized:** `dim_product.category` and `dim_product.brand` sit directly on the product row instead of being split into separate normalized tables — this avoids extra joins when slicing sales by category in a BI tool.

## Snowflake Schema

Same idea, but dimensions are normalized into sub-dimensions — trades query simplicity for reduced redundancy.

```
[dim_product] → [dim_category] → [dim_department]
```

```sql
CREATE TABLE dim_category (
    category_key INT PRIMARY KEY,
    category_name VARCHAR(50),
    department_key INT REFERENCES dim_department(department_key)
);
```

| Star Schema | Snowflake Schema |
|---|---|
| Denormalized dimensions | Normalized dimensions |
| Simpler queries, fewer joins | More joins, more complex queries |
| More storage (redundancy) | Less storage |
| Generally preferred for BI tool performance | Used when storage/update efficiency matters more |

## Fact Table Types

| Type | Description | Example |
|---|---|---|
| **Transaction fact** | One row per event, as it happens | One row per sale |
| **Periodic snapshot** | One row per fixed time interval | Daily account balance snapshot |
| **Accumulating snapshot** | One row per process, updated as it progresses through stages | Order lifecycle (ordered → shipped → delivered), row updated at each stage |
| **Factless fact table** | Tracks that an event happened, with no measure | Student attended a class (just records the occurrence + keys) |

## Slowly Changing Dimensions (SCD)

How to handle a dimension's attribute changing over time (e.g., a customer moves cities).

| Type | Strategy | Effect |
|---|---|---|
| **Type 0** | Never update — keep original value forever | Used for immutable facts (e.g., birth date) |
| **Type 1** | Overwrite the old value | No history kept; simplest |
| **Type 2** | Add a new row with a new surrogate key + effective dates | Full history preserved — most common in practice |
| **Type 3** | Add a new column for "previous value" | Limited history (only last change tracked) |
| **Type 4** | Keep current value in main table, move history to a separate table | Keeps main table lean |
| **Type 6** | Hybrid of 1+2+3 | Combines overwrite + history + previous-value column |

### SCD Type 2 Example

```sql
CREATE TABLE dim_customer (
    customer_key INT PRIMARY KEY,     -- surrogate, changes per version
    customer_id VARCHAR(20),          -- natural key, stays the same
    city VARCHAR(50),
    effective_date DATE,
    end_date DATE,                    -- NULL = current record
    is_current BOOLEAN
);
```

When a customer moves from "Manila" to "Cebu": the old row gets `end_date` set and `is_current = false`; a new row is inserted with the new city, a new `customer_key`, and `is_current = true`. Historical fact rows still point to the *old* `customer_key`, preserving "at the time of that sale, the customer lived in Manila."

## Conformed Dimensions

A dimension shared and consistently defined across multiple fact tables/data marts (e.g., the same `dim_date` used by `fact_sales` and `fact_inventory`). Critical for allowing cross-process analysis ("compare sales trends to inventory trends by the same date dimension").

## Common Mistakes

- Not defining the **grain** clearly before building the fact table — leads to double-counting or mismatched aggregations.
- Using natural keys instead of surrogate keys in dimensions — breaks SCD Type 2 history tracking.
- Mixing additive and non-additive measures without labeling them (e.g., summing an "account balance" measure across time gives a nonsensical total — balances are non-additive, only "snapshot-able").
- Forgetting `dim_date` and joining directly on raw dates — a proper date dimension enables fiscal calendars, holiday flags, and fast filtering.

---
[← Previous: Relational Modeling](06-relational-modeling.md) | [Back to index](00-README.md) | [Next: NoSQL Data Modeling →](08-nosql-modeling.md)
