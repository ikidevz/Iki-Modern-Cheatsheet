# Transform

## Data Cleaning & Standardization

**Definition:** The process of correcting, normalizing, and making consistent raw data before it's modeled or aggregated.

**Key Points:**
- Trim whitespace, normalize casing, standardize date/timezone formats.
- Enforce consistent units (currency, measurement systems).
- Decide a null-handling strategy per column: default value, explicit null, or drop row — and document the choice.

**Example:**
```sql
SELECT
  TRIM(LOWER(email)) AS email,
  CAST(amount_cents AS DECIMAL(10,2)) / 100 AS amount_usd,
  CONVERT_TIMEZONE('UTC', event_time) AS event_time_utc
FROM raw.events;
```

**When to Use / Trade-offs:**
- Apply cleaning as early as possible in the pipeline (closest to raw) so every downstream consumer benefits consistently.

**Common Pitfalls:**
- Cleaning logic duplicated across multiple downstream models instead of centralized once in a shared staging layer.
- Silently dropping rows with nulls instead of logging/flagging them, hiding data quality issues.

---

## Data Modeling

**Definition:** The structural approach used to organize transformed data for querying and analysis.

**Key Points:**
- Star Schema — one fact table + denormalized dimension tables. Fast, simple joins. Most common in warehouses.
- Snowflake Schema — dimensions further normalized into sub-dimensions. Saves storage, more joins.
- Data Vault — Hubs (business keys), Links (relationships), Satellites (descriptive attributes). Highly auditable.
- One Big Table (OBT) — fully denormalized single table. Fastest reads, simplest for BI tools.

**Example:**
```
Star Schema:
  fact_orders (order_id, customer_id, product_id, date_id, amount)
  dim_customer (customer_id, name, region)
  dim_product (product_id, category, price)
  dim_date (date_id, day, month, year)
```

**When to Use / Trade-offs:**
- Star schema — default choice for most BI/reporting use cases.
- Snowflake — when storage cost matters more than query simplicity.
- Data Vault — regulated industries needing full audit history and rapidly changing source systems.
- OBT — small-to-medium datasets where query simplicity for non-technical users outweighs storage cost.

**Common Pitfalls:**
- Over-normalizing a warehouse schema like an OLTP system, causing excessive joins and slow dashboards.
- Choosing Data Vault for a simple use case, adding unnecessary modeling complexity.

---

## Slowly Changing Dimensions (SCD)

**Definition:** Patterns for handling changes to dimension attribute values over time (e.g., a customer's address changes).

**Key Points:**

| Type | Behavior | Use Case |
|---|---|---|
| Type 0 | Never changes | Fixed attributes (e.g., birth date) |
| Type 1 | Overwrite old value | No history needed |
| Type 2 | New row per change + effective dates | Full history tracking (most common) |
| Type 3 | New column for previous value | Only need "current + one prior" |
| Type 4 | Separate history table | High-frequency changes, keep main table lean |
| Type 6 | Combination of 1+2+3 | Hybrid — current value + history in one row |

**Example:**
```sql
-- SCD Type 2 pattern
UPDATE dim_customer
SET end_date = CURRENT_DATE, is_current = FALSE
WHERE customer_id = :id AND is_current = TRUE;

INSERT INTO dim_customer (customer_id, name, start_date, end_date, is_current)
VALUES (:id, :new_name, CURRENT_DATE, NULL, TRUE);
```

**When to Use / Trade-offs:**
- Type 1 is simplest but destroys history — fine for correcting errors, wrong for tracking real business change over time.
- Type 2 is the standard when historical accuracy in reports matters (e.g., "what region was this customer in when they made this purchase?").

**Common Pitfalls:**
- Using Type 1 for attributes that analysts actually need historical accuracy on (common mistake: overwriting a sales rep's territory, breaking historical attribution).
- Forgetting to close out the previous row's `end_date` in Type 2, resulting in multiple "current" rows for the same key.

---

## Deduplication

**Definition:** Removing or collapsing duplicate records that arise from retries, multiple extraction runs, or upstream system quirks.

**Key Points:**
- Identify a natural or business key, then keep only the most recent record per key.
- Late-arriving duplicates can appear across batch runs, not just within a single batch — dedupe at the merge/load step, not only within a batch.

**Example:**
```sql
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) AS rn
  FROM staging_table
) WHERE rn = 1;
```

**When to Use / Trade-offs:**
- Dedupe as close to the source/staging layer as possible so all downstream models inherit clean data.

**Common Pitfalls:**
- Deduplicating only within a single batch, missing duplicates that span multiple pipeline runs.
- Choosing the wrong tiebreaker column (e.g., `created_at` instead of `updated_at`), keeping a stale version of a record.

---

## Aggregations & Windowing Logic

**Definition:** Techniques for summarizing or computing derived metrics across rows.

**Key Points:**
- Aggregation (`GROUP BY`) collapses rows into summary values (SUM, COUNT, AVG).
- Window functions compute across a row set *without* collapsing it (`RANK()`, `LAG()`, `SUM() OVER (...)`).
- Common uses: running totals, period-over-period comparisons, ranking top-N per group.

**Example:**
```sql
-- Running total
SELECT date, amount,
       SUM(amount) OVER (ORDER BY date) AS running_total
FROM sales;

-- Top 3 products per category
SELECT * FROM (
  SELECT *, RANK() OVER (PARTITION BY category ORDER BY revenue DESC) AS rnk
  FROM product_sales
) WHERE rnk <= 3;
```

**When to Use / Trade-offs:**
- Use window functions when you need row-level detail *and* an aggregate context simultaneously (e.g., each row plus its rank within a group).
- Use plain `GROUP BY` when only the summary is needed, not the underlying rows.

**Common Pitfalls:**
- Using `GROUP BY` plus a self-join to simulate what a window function could do in one pass, hurting both readability and performance.
