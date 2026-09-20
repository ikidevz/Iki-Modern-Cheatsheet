# Slowly Changing Dimensions (SCD) Cheatsheet for Data Engineers

> A structured reference for preserving or overwriting dimension history as business attributes change — SCD Types 0-6, implementation patterns in SQL and dbt, late-arriving changes, and joining facts to point-in-time-correct dimension versions. Expanded from a short pattern note into a full implementation guide.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 When Each SCD Type Applies](#when-each-scd-type-applies)
4. [📐 SCD Type 0: Fixed](#scd-type-0-fixed)
5. [📐 SCD Type 1: Overwrite](#scd-type-1-overwrite)
6. [📐 SCD Type 2: Versioned History](#scd-type-2-versioned-history)
7. [📐 SCD Type 3: Previous Value Column](#scd-type-3-previous-value-column)
8. [📐 SCD Type 4: History Table](#scd-type-4-history-table)
9. [📐 SCD Type 6: Hybrid (1+2+3)](#scd-type-6-hybrid-123)
10. [🔗 Joining Facts to the Correct Dimension Version](#joining-facts-to-the-correct-dimension-version)
11. [⏰ Late-Arriving Dimension Changes](#late-arriving-dimension-changes)
12. [🛠️ Tooling Landscape](#tooling-landscape)
13. [❄️ SCD with Snowflake Streams and Tasks](#scd-with-snowflake-streams-and-tasks)
14. [🏔️ Full Delta Lake MERGE-Based Type 2 Pipeline](#full-delta-lake-merge-based-type-2-pipeline)
15. [🧩 Mini-Dimensions for Rapidly-Changing Attributes](#mini-dimensions-for-rapidly-changing-attributes)
16. [🌉 Bridge Tables for Many-to-Many Changing Relationships](#bridge-tables-for-many-to-many-changing-relationships)
17. [🧪 Testing SCD Pipelines](#testing-scd-pipelines)
18. [⚠️ Common Gotchas](#common-gotchas)
19. [✅ Best Practices Checklist](#best-practices-checklist)
20. [📚 SCD Type Comparison Table](#scd-type-comparison-table)
21. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| No history needed | Type 1 — overwrite |
| Full history needed | Type 2 — new versioned row, `valid_from`/`valid_to`, `is_current` |
| Only "previous value" needed | Type 3 — extra column for prior value |
| Join facts correctly | Join on the dimension version valid **at the fact's event time**, not the current row |
| Grain | Document the dimension's grain explicitly (one row per entity per version) |
| Late data | Reprocess/insert a correctly-dated historical version, don't just append at "now" |

## 🧠 Core Concept

Slowly Changing Dimensions describe how a dimension table (customer, product, employee) handles the fact that descriptive attributes **change over time** — a customer moves regions, a product gets reclassified, an employee changes department — while the fact tables referencing that dimension need either the current value or the value that was true *at the time the fact occurred*, depending on the business question being asked.

```text
customer_id=42:  segment='SMB'  (2024-01-01 to 2025-06-01)
                 segment='Mid-Market'  (2025-06-01 to present)

Question: "What was this customer's segment when they placed order #991 on 2025-03-15?"
Answer:   'SMB' — requires SCD history, not just the current row
```

## 🎯 When Each SCD Type Applies

| Type | Keeps history? | Use when |
|---|---|---|
| Type 0 | N/A (never changes) | Attribute is immutable by definition (e.g., date of birth) |
| Type 1 | No — overwrites | History doesn't matter for this attribute; correcting an error |
| Type 2 | Yes — full versioned rows | Reporting must reflect the value true at each point in time |
| Type 3 | Only "previous" value | Only ever need to compare current vs. immediately-prior value |
| Type 4 | Yes — separate history table | Current table must stay small/fast; history queried separately |
| Type 6 | Yes — hybrid | Need current, previous, AND full history simultaneously |

## 📐 SCD Type 0: Fixed

```sql
-- The attribute never changes after initial load — no update logic needed at all
CREATE TABLE dim_customer (
    customer_id   STRING,
    date_of_birth DATE,        -- Type 0: immutable, never updated
    signup_date   DATE         -- Type 0
);
```

## 📐 SCD Type 1: Overwrite

```sql
-- Simplest form: the old value is simply gone
UPDATE dim_customer
SET segment = 'Mid-Market'
WHERE customer_id = 'C042';
```

```python
# Upsert pattern (Type 1) — MERGE keeps it idempotent
DeltaTable.forPath(spark, "dim_customer").alias("target").merge(
    updates.alias("source"), "target.customer_id = source.customer_id"
).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()
```

Use for corrections (fixing a typo) or attributes where historical accuracy genuinely doesn't matter for reporting.

## 📐 SCD Type 2: Versioned History

```sql
CREATE TABLE dim_customer (
    customer_key   INT PRIMARY KEY,   -- surrogate key, unique per VERSION
    customer_id    STRING,            -- natural key, shared across versions
    segment        STRING,
    valid_from     DATE,
    valid_to       DATE,
    is_current     BOOLEAN
);

-- Step 1: close out the old version
UPDATE dim_customer
SET valid_to = CURRENT_DATE, is_current = false
WHERE customer_id = 'C042' AND is_current = true;

-- Step 2: insert the new version
INSERT INTO dim_customer (customer_id, segment, valid_from, is_current)
VALUES ('C042', 'Mid-Market', CURRENT_DATE, true);
```

```sql
-- MERGE-based Type 2 pattern (common in dbt snapshots and lakehouse pipelines)
MERGE INTO dim_customer AS target
USING (
    SELECT customer_id, segment, CURRENT_DATE AS effective_date
    FROM staging.customers
) AS source
ON target.customer_id = source.customer_id AND target.is_current = true
WHEN MATCHED AND target.segment != source.segment THEN
    UPDATE SET valid_to = source.effective_date, is_current = false
WHEN NOT MATCHED THEN
    INSERT (customer_id, segment, valid_from, is_current)
    VALUES (source.customer_id, source.segment, source.effective_date, true);
```

```yaml
# dbt snapshot: purpose-built for Type 2 SCD tracking
{% snapshot dim_customer_snapshot %}
{{
    config(
      target_schema='snapshots',
      unique_key='customer_id',
      strategy='check',
      check_cols=['segment', 'region'],
    )
}}
SELECT * FROM {{ source('crm', 'customers') }}
{% endsnapshot %}
```

## 📐 SCD Type 3: Previous Value Column

```sql
-- Keeps only the immediately-prior value, not full history
ALTER TABLE dim_customer ADD COLUMN previous_segment STRING;

UPDATE dim_customer
SET previous_segment = segment,
    segment = 'Mid-Market'
WHERE customer_id = 'C042';
```

Rarely sufficient on its own for real analytics (you lose everything before "previous"), but cheap and occasionally used for specific "did this change recently" comparisons.

## 📐 SCD Type 4: History Table

```sql
-- Current table stays small and fast for point lookups
CREATE TABLE dim_customer_current (
    customer_id STRING PRIMARY KEY,
    segment     STRING
);

-- Full history lives separately, queried only when needed
CREATE TABLE dim_customer_history (
    customer_id STRING,
    segment     STRING,
    valid_from  DATE,
    valid_to    DATE
);
```

Good when the "current" dimension is queried extremely frequently (e.g., in every fact join) and keeping it lean matters more than having history in the same table.

## 📐 SCD Type 6: Hybrid (1+2+3)

```sql
-- Combines: current value overwritten (1), previous value column (3), full history via versioned rows (2)
CREATE TABLE dim_customer (
    customer_key      INT PRIMARY KEY,
    customer_id       STRING,
    segment           STRING,       -- historical value for this version (Type 2)
    current_segment   STRING,       -- always the CURRENT value, updated on every version (Type 1)
    previous_segment  STRING,       -- value just before this version (Type 3)
    valid_from        DATE,
    valid_to          DATE,
    is_current        BOOLEAN
);
```

Powerful but adds real maintenance overhead — reserve Type 6 for dimensions where analysts genuinely need all three views simultaneously (rare; usually Type 2 alone with good query patterns is enough).

## 🔗 Joining Facts to the Correct Dimension Version

```sql
-- WRONG: joins to whatever the CURRENT segment is, misrepresenting historical facts
SELECT f.order_id, d.segment
FROM fct_orders f
JOIN dim_customer d ON f.customer_id = d.customer_id AND d.is_current = true;

-- RIGHT: joins to the dimension version valid AT THE TIME of the fact
SELECT f.order_id, d.segment
FROM fct_orders f
JOIN dim_customer d
    ON f.customer_id = d.customer_id
    AND f.order_date >= d.valid_from
    AND f.order_date < COALESCE(d.valid_to, '9999-12-31');
```

This is the single most common SCD bug: joining facts to the *current* dimension row instead of the row valid at the fact's event time, which silently rewrites history every time a dimension changes.

## ⏰ Late-Arriving Dimension Changes

```sql
-- A change is discovered late (e.g., backdated correction from a source system)
-- Insert the correctly-dated historical version, don't just append at "now"
INSERT INTO dim_customer (customer_id, segment, valid_from, valid_to, is_current)
VALUES ('C042', 'SMB', '2025-01-01', '2025-06-01', false);  -- correctly backdated, not "today"

-- Then re-point any facts in the affected window if the join logic requires it
```

Handling this correctly requires a defined process — most teams either backdate the insert (as above) or trigger a reprocessing job for the affected fact date range.

## 🛠️ Tooling Landscape

| Category | Tools |
|---|---|
| SQL-native | `MERGE` statements, warehouse-native `STREAM`/change tracking (Snowflake Streams) |
| dbt | Native `snapshot` feature purpose-built for Type 2 |
| Lakehouse | Delta Lake / Iceberg `MERGE` for versioned upserts |
| CDC-fed | Combine with [change-data-capture.md](./Change_Data_Capture_Cheat_Sheet.md) to drive SCD updates from source-system change events |

## ❄️ SCD with Snowflake Streams and Tasks

Snowflake's `STREAM` object tracks row-level changes on a table since the last time it was consumed, which maps naturally onto driving a Type 2 close-out/insert cycle without hand-rolled change detection.

```sql
-- A stream captures inserts/updates/deletes on the source table since last consumed
CREATE STREAM customers_stream ON TABLE staging.customers;

-- A task runs on a schedule, consuming the stream and applying Type 2 logic
CREATE TASK apply_customer_scd
  WAREHOUSE = transform_wh
  SCHEDULE = 'USING CRON 0 * * * * UTC'   -- hourly
AS
MERGE INTO core.dim_customer AS target
USING (
    SELECT customer_id, segment, region, CURRENT_TIMESTAMP() AS effective_ts
    FROM customers_stream
    WHERE METADATA$ACTION = 'INSERT'      -- Snowflake streams expose INSERT/DELETE metadata columns
) AS source
ON target.customer_id = source.customer_id AND target.is_current = true
WHEN MATCHED AND (target.segment != source.segment OR target.region != source.region) THEN
    UPDATE SET valid_to = source.effective_ts, is_current = false
WHEN NOT MATCHED THEN
    INSERT (customer_id, segment, region, valid_from, is_current)
    VALUES (source.customer_id, source.segment, source.region, source.effective_ts, true);

-- Resume the task (tasks are created suspended by default)
ALTER TASK apply_customer_scd RESUME;
```

```sql
-- A second task handles the INSERT for the new current row after the close-out,
-- since a single MERGE can't both close out AND the new version needs a separate
-- surrogate key generated — many teams split this into two chained tasks for clarity
CREATE TASK insert_new_customer_version
  WAREHOUSE = transform_wh
  AFTER apply_customer_scd
AS
INSERT INTO core.dim_customer (customer_id, segment, region, valid_from, is_current)
SELECT customer_id, segment, region, CURRENT_TIMESTAMP(), true
FROM staging.pending_customer_versions;
```

The advantage over a plain scheduled `MERGE` is that the stream **only contains what actually changed** since last consumption — no need to scan the entire source table on every run to detect what's new.

## 🏔️ Full Delta Lake MERGE-Based Type 2 Pipeline

```python
from delta.tables import DeltaTable
from pyspark.sql import functions as F

def apply_type2_scd(spark, staging_df, target_table: str):
    target = DeltaTable.forName(spark, target_table)

    # Step 1: identify rows whose tracked attributes actually changed
    current = target.toDF().filter("is_current = true")
    changed = (staging_df.alias("s")
        .join(current.alias("c"), "customer_id")
        .filter("s.segment != c.segment OR s.region != c.region")
        .select("s.*"))

    new_customers = staging_df.join(current, "customer_id", "left_anti")
    to_insert = changed.unionByName(new_customers)

    # Step 2: close out changed current rows
    (target.alias("t")
        .merge(changed.alias("s"), "t.customer_id = s.customer_id AND t.is_current = true")
        .whenMatchedUpdate(set={
            "valid_to": F.current_timestamp(),
            "is_current": F.lit(False),
        })
        .execute())

    # Step 3: insert new versions (both genuinely new customers and changed ones)
    (to_insert
        .withColumn("valid_from", F.current_timestamp())
        .withColumn("valid_to", F.lit(None).cast("timestamp"))
        .withColumn("is_current", F.lit(True))
        .write.format("delta").mode("append")
        .saveAsTable(target_table))
```

```python
def test_type2_scd_is_idempotent(spark):
    """Running the SCD apply twice on the SAME unchanged staging data
    should not create duplicate 'current' versions."""
    apply_type2_scd(spark, staging_df, "core.dim_customer")
    apply_type2_scd(spark, staging_df, "core.dim_customer")   # no changes this time
    current_count = spark.table("core.dim_customer").filter("is_current = true AND customer_id = 'C042'").count()
    assert current_count == 1
```

Splitting the update (close-out) and insert (new version) into two separate steps — rather than trying to force both into one `MERGE` — is the standard pattern in lakehouse SCD pipelines, since a single `MERGE` can't both update an existing row and insert a *different* row with a fresh surrogate key for the same match condition.

## 🧩 Mini-Dimensions for Rapidly-Changing Attributes

When one or two attributes on an otherwise-stable dimension change **very frequently** (e.g., a customer's real-time loyalty tier, updated daily), Type 2 on the whole dimension would explode the row count. A mini-dimension splits the volatile attributes into their own small dimension.

```sql
-- Stable attributes stay in the main dimension (rarely versioned)
CREATE TABLE dim_customer (
    customer_key INT PRIMARY KEY, customer_id STRING, name STRING, signup_date DATE
);

-- Volatile attributes get their own compact dimension, often with banded/bucketed values
-- to keep the row count manageable (e.g., "loyalty_tier" + "activity_band" combinations)
CREATE TABLE dim_customer_demographics (
    demographics_key INT PRIMARY KEY,
    loyalty_tier STRING,       -- 'bronze', 'silver', 'gold'
    activity_band STRING       -- 'low', 'medium', 'high'
);   -- only as many rows as the CROSS PRODUCT of tier x band, e.g., 3 x 3 = 9 rows total

-- The fact table carries BOTH keys, picking up the current demographics_key at fact load time
CREATE TABLE fct_orders (
    order_id STRING,
    customer_key INT REFERENCES dim_customer(customer_key),
    demographics_key INT REFERENCES dim_customer_demographics(demographics_key),
    amount DECIMAL(10,2)
);
```

This avoids the row-count explosion of tracking every daily loyalty-tier change as a full Type 2 version of the entire customer dimension — the mini-dimension has a small, bounded number of rows (one per distinct attribute-value combination), and the fact table simply points to whichever combination was true at the time.

## 🌉 Bridge Tables for Many-to-Many Changing Relationships

Some relationships aren't simple "one fact row, one dimension row" — a bank account might have multiple changing owners over time, or a sales deal might have multiple changing stakeholders. A bridge table resolves the many-to-many relationship while still supporting point-in-time correctness.

```sql
-- Bridge table: many-to-many between accounts and customers, with its own validity window
CREATE TABLE bridge_account_owner (
    account_id STRING,
    customer_key INT REFERENCES dim_customer(customer_key),
    ownership_pct DECIMAL(5,2),
    valid_from DATE,
    valid_to DATE
);

-- Querying "who owned this account when the fact occurred" joins through the bridge,
-- with the same time-range join pattern used for standard SCD Type 2 dimensions
SELECT f.transaction_id, b.customer_key, b.ownership_pct
FROM fct_transactions f
JOIN bridge_account_owner b
    ON f.account_id = b.account_id
    AND f.transaction_date >= b.valid_from
    AND f.transaction_date < COALESCE(b.valid_to, '9999-12-31');
```

The bridge table is essentially "SCD Type 2 for a relationship instead of an entity" — same `valid_from`/`valid_to` mechanics, applied to the join table rather than to the dimension itself.

## 🧪 Testing SCD Pipelines

```sql
-- Test: no two "current" rows for the same natural key (a common close-out bug)
SELECT customer_id, COUNT(*) AS current_row_count
FROM dim_customer
WHERE is_current = true
GROUP BY customer_id
HAVING COUNT(*) > 1;
-- Should return ZERO rows — any result here is a close-out bug

-- Test: no overlapping validity windows for the same natural key
SELECT a.customer_id
FROM dim_customer a
JOIN dim_customer b
    ON a.customer_id = b.customer_id
    AND a.customer_key != b.customer_key
    AND a.valid_from < COALESCE(b.valid_to, '9999-12-31')
    AND COALESCE(a.valid_to, '9999-12-31') > b.valid_from;
-- Should return ZERO rows — any result here means overlapping ranges exist
```

```python
def test_scd_no_gaps_in_history():
    """Every version's valid_from should equal the prior version's valid_to —
    a gap means some period has NO valid dimension row, which breaks fact joins."""
    versions = get_versions_ordered("C042")
    for prev, curr in zip(versions, versions[1:]):
        assert prev.valid_to == curr.valid_from, f"Gap detected between {prev} and {curr}"

def test_fact_join_finds_exactly_one_dimension_row():
    result = query("""
        SELECT f.order_id, COUNT(*) as match_count
        FROM fct_orders f
        JOIN dim_customer d ON f.customer_id = d.customer_id
            AND f.order_date >= d.valid_from AND f.order_date < COALESCE(d.valid_to, '9999-12-31')
        GROUP BY f.order_id
        HAVING COUNT(*) != 1
    """)
    assert result.empty   # every fact must match EXACTLY one dimension version, never zero or multiple
```

## ⚠️ Common Gotchas

- **Joining facts to `is_current = true` instead of the time-valid version** silently rewrites historical reporting every time a dimension attribute changes.
- **Forgetting the grain** — a Type 2 dimension has one row *per version*, not one row per entity; queries that assume one-row-per-entity will double-count.
- **Not handling late-arriving changes with correct backdating** — appending a correction at "today" instead of the actual effective date corrupts historical joins.
- **Surrogate key reuse across versions** — each version needs its own surrogate key (`customer_key`), while the natural key (`customer_id`) stays shared across versions.
- **Overlapping `valid_from`/`valid_to` ranges** due to a bug in the close-out step — always test that no two "current" versions exist for the same natural key at the same time.
- **Choosing Type 2 for every dimension by default** — it adds real query and storage complexity; Type 1 is often the right, simpler choice when history genuinely doesn't matter.
- **Applying full Type 2 to a rapidly-changing attribute** (daily loyalty tier, real-time activity score) explodes the dimension's row count — reach for a mini-dimension instead.
- **Trying to close out and insert the new version in a single `MERGE`** on a lakehouse table — most engines can't both update an existing row and insert a differently-keyed new row in one statement; split it into two steps.
- **Modeling a many-to-many changing relationship as a simple foreign key** instead of a bridge table — it silently forces a "pick one owner" simplification that loses real information.
- **No automated test for validity-window gaps** — a gap between one version's `valid_to` and the next's `valid_from` means some historical period has no matching dimension row at all, silently dropping facts from time-range joins.

## ✅ Best Practices Checklist

- [ ] The dimension's grain (one row per entity per version) is documented
- [ ] Facts join to the dimension version valid at the fact's event time, not the current row
- [ ] Surrogate keys are unique per version; natural keys are shared across versions
- [ ] `valid_from`/`valid_to` ranges never overlap for the same natural key
- [ ] Late-arriving changes are backdated correctly, not appended at "now"
- [ ] SCD type is chosen deliberately per dimension attribute, not applied uniformly by default
- [ ] Type 2 close-out and insert happen atomically (or via a tested `MERGE`) to avoid partial-update bugs

## 📚 SCD Type Comparison Table

| Type | History | Storage cost | Query complexity | Best for |
|---|---|---|---|---|
| 0 | None (immutable) | Lowest | Lowest | Truly fixed attributes |
| 1 | None (overwritten) | Low | Low | Corrections, no-history-needed attributes |
| 2 | Full | Higher (more rows) | Higher (date-range joins) | Point-in-time-correct reporting |
| 3 | One prior value | Low | Low | Simple "changed recently" checks |
| 4 | Full, separate table | Medium (split across tables) | Medium (two tables to query) | High-frequency current-value lookups + occasional history |
| 6 | Full + current + previous | Highest | Highest | Need all three views at once (rare) |

## 💡 Pro Tips

1. **Default to Type 1 unless you have a specific reporting need for history** — Type 2 is powerful but not free.
2. **Always join facts on a date range**, not `is_current = true`, when historical accuracy matters.
3. **Give every dimension version its own surrogate key** — never reuse a surrogate key across versions of the same entity.
4. **Test for overlapping validity ranges** as a standing data quality check on every Type 2 dimension.
5. **Use dbt snapshots** if you're already in the dbt ecosystem — it's purpose-built for Type 2 and handles the close-out/insert logic correctly.
6. **Define a late-arriving-data policy up front** — decide whether you'll backdate corrections or trigger fact reprocessing, and document it.
7. **Document the grain explicitly** in the table's schema/catalog entry — "one row per customer per version," not just "one row per customer."
8. **Combine with CDC** when the source system exposes row-level change events — it gives you exact `valid_from` timestamps instead of batch-run-time approximations.
9. **Avoid Type 6 unless genuinely needed** — most "we need current, previous, and history" requirements are satisfied by Type 2 plus a well-written query.
10. **Reconcile dimension row counts periodically** against the source system's entity count — a Type 2 dimension silently missing close-out updates accumulates duplicate "current" rows over time.
11. **Use Snowflake Streams (or equivalent change-tracking)** to drive Type 2 updates from only what changed, instead of re-scanning the entire source table every run.
12. **Split lakehouse Type 2 `MERGE` into a close-out step and a separate insert step** — trying to do both in one statement runs into most engines' `MERGE` limitations.
13. **Reach for a mini-dimension when one or two attributes change far more often than the rest** of an otherwise-stable dimension, rather than full Type 2 on the whole table.
14. **Model many-to-many changing relationships with a bridge table**, using the same `valid_from`/`valid_to` mechanics as a standard Type 2 dimension.
15. **Add a validity-window gap test to CI** — every version's `valid_to` should exactly equal the next version's `valid_from`, with zero gaps and zero overlaps.

