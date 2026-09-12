# 🚀 Performance Tuning & Optimization

> The "why is this query slow" reference. Diagnostic queries first, then the levers you actually have.

---

## 1. Diagnostic Workflow (run these in order)

```sql
-- Step 1: Find the slow query
SELECT
    query_id,
    query_text,
    warehouse_name,
    warehouse_size,
    total_elapsed_time / 1000 AS seconds,
    bytes_scanned,
    partitions_scanned,
    partitions_total,
    execution_status
FROM table(information_schema.query_history())
ORDER BY total_elapsed_time DESC
LIMIT 20;

-- Step 2: Get the full breakdown for one query
SELECT *
FROM table(information_schema.query_history())
WHERE query_id = '<id>';

-- Step 3: Open Query Profile in the UI for the visual execution plan, OR pull it programmatically:
SELECT SYSTEM$EXPLAIN_PLAN_JSON('<query_id>');

-- Step 4: Compare compilation time vs execution time vs queue time — tells you WHICH lever to pull
SELECT
    query_id,
    compilation_time,          -- optimizer/planning overhead
    execution_time,             -- actual scan/join/agg work
    queued_provisioning_time,   -- waiting for warehouse to spin up
    queued_overload_time,       -- waiting because warehouse is saturated (concurrency signal)
    list_external_files_time,   -- time spent listing files (external tables/stages)
    total_elapsed_time
FROM table(information_schema.query_history())
WHERE query_id = '<id>';
```

**What to look for in Query Profile, in priority order:**

1. **Most expensive node** — usually a `TableScan`, `Join`, or `Aggregate` — this is where time is actually spent
2. **Spilling to local/remote storage** — if you see "Bytes spilled to local storage" or worse "remote storage," the warehouse is too small for the working set (see §4)
3. **Partition pruning ratio** — `partitions_scanned / partitions_total` close to 1.0 means no pruning is happening at all
4. **Exploding join fan-out** — row counts multiplying unexpectedly mid-plan = a join condition issue, not a sizing issue
5. **Percentage of time in each operator** — the UI shows a % breakdown; anything over ~30% in a single node deserves investigation before touching warehouse size

---

## 2. Reading Query Profile Node Types

| Node type | What it means | Common fix if it's the bottleneck |
|---|---|---|
| `TableScan` | Reading micro-partitions from storage | Add/fix clustering key, add filters earlier |
| `Filter` | Applying `WHERE` predicates | Usually cheap; if expensive, check for non-sargable predicates |
| `Join` | Hash/merge join execution | Check join cardinality, filter before joining, verify join keys aren't causing fan-out |
| `Aggregate` | `GROUP BY`/window functions | Check for high-cardinality group keys, consider pre-aggregating upstream |
| `Sort` | `ORDER BY`, some window functions | Often spills to disk if data volume is large — check spilling metrics |
| `WindowFunction` | `OVER (PARTITION BY ...)` | Expensive on wide partitions; consider `QUALIFY` to filter after, not more windows |
| `ExternalScan` | External table / stage scan | Check `AUTO_REFRESH` is on, avoid excessive file listing overhead |

```sql
-- Pull node-level detail programmatically instead of clicking through the UI
SELECT SYSTEM$EXPLAIN_PLAN_JSON('<query_id>');
```

---

## 3. Pruning & Clustering Fixes

```sql
-- Check current pruning efficiency
SELECT SYSTEM$CLUSTERING_INFORMATION('orders', '(order_date)');

-- If average_depth is high and the table is frequently filtered on a non-natural-order column:
ALTER TABLE orders CLUSTER BY (order_date);

-- Rewrite queries to filter on clustering key columns FIRST — pushdown-friendly predicates
-- Bad: function wraps the column, defeats pruning
SELECT * FROM orders WHERE YEAR(order_date) = 2026;

-- Good: sargable predicate, prunable
SELECT * FROM orders WHERE order_date BETWEEN '2026-01-01' AND '2026-12-31';
```

> 🔑 **Rule of thumb:** any predicate that wraps a column in a function (`YEAR()`, `CAST()`, `UPPER()`, string concatenation) usually **defeats micro-partition pruning** because the optimizer can't match it against stored min/max metadata. Rewrite to compare the raw column against a literal/range whenever possible.

### 3.1 Join Skew & Fan-Out

```sql
-- Diagnose: does a join key have wildly uneven cardinality?
SELECT customer_id, COUNT(*) AS cnt
FROM orders
GROUP BY customer_id
ORDER BY cnt DESC
LIMIT 10;

-- If a handful of keys dominate (e.g., a "null"/"unknown" bucket with millions of rows),
-- consider splitting the join into a skewed-key path and a normal path (a manual salting
-- pattern), similar to Spark skew handling — Snowflake has no automatic skew join hint
WITH skewed AS (
    SELECT * FROM orders WHERE customer_id = 'UNKNOWN'
), normal AS (
    SELECT * FROM orders WHERE customer_id != 'UNKNOWN'
)
SELECT * FROM normal n JOIN customers c ON n.customer_id = c.customer_id
UNION ALL
SELECT * FROM skewed s JOIN customers c ON s.customer_id = c.customer_id;
```

---

## 4. Warehouse Sizing (vertical scaling)

```sql
-- Resize a warehouse (bigger = more parallelism per query, NOT automatically faster for small queries)
ALTER WAREHOUSE etl_wh SET WAREHOUSE_SIZE = 'LARGE';

-- Check if a query is genuinely scan-bound (bigger warehouse helps) vs
-- cloud-services-bound (bigger warehouse does NOT help)
SELECT
    query_id,
    total_elapsed_time,
    compilation_time,      -- if this dominates, warehouse size is irrelevant
    execution_time,         -- if THIS dominates and bytes_scanned is high, size up
    queued_provisioning_time,
    queued_overload_time    -- non-zero = warehouse was too small/busy, queuing occurred
FROM table(information_schema.query_history())
WHERE query_id = '<id>';
```

**When resizing UP actually helps:**
- Large scans across many micro-partitions (more nodes = more parallel scan threads)
- Heavy aggregations/sorts spilling to disk (more memory per node)

**When resizing UP does nothing:**
- Query is compilation-bound (complex view chains, huge `IN` lists)
- Query is metadata-only (already 0 bytes scanned)
- Query is queuing due to **concurrency**, not size — that's a multi-cluster problem, not a size problem (see `Warehouse_Compute_Management.md`)

---

## 5. Spilling — the silent performance killer

```sql
SELECT
    query_id,
    bytes_spilled_to_local_storage,    -- ran out of memory, spilled to local SSD (slower)
    bytes_spilled_to_remote_storage    -- ran out of local disk too, spilled to remote (much slower)
FROM table(information_schema.query_history())
WHERE query_id = '<id>';
```

- **Local spilling** → warehouse is undersized for the operation (large sort/join/aggregate) — size up or reduce the working set
- **Remote spilling** → severe undersizing, treat as a hard signal to resize or restructure the query (e.g., pre-aggregate before joining, filter earlier)

```sql
-- Find your worst spilling offenders across the account (a good weekly health check query)
SELECT
    query_id, user_name, warehouse_name,
    bytes_spilled_to_local_storage, bytes_spilled_to_remote_storage,
    total_elapsed_time
FROM snowflake.account_usage.query_history
WHERE bytes_spilled_to_remote_storage > 0
  AND start_time > DATEADD('day', -7, CURRENT_TIMESTAMP())
ORDER BY bytes_spilled_to_remote_storage DESC
LIMIT 20;
```

---

## 6. Query Rewriting Patterns

```sql
-- Filter BEFORE joining, not after — reduces the join's build/probe size
-- Bad
SELECT o.*, c.name
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
WHERE o.order_date > '2026-01-01';

-- Better — pre-filter in a CTE so the optimizer has an easier time, and it's more readable
WITH recent_orders AS (
    SELECT * FROM orders WHERE order_date > '2026-01-01'
)
SELECT ro.*, c.name
FROM recent_orders ro
JOIN customers c ON ro.customer_id = c.customer_id;

-- Avoid SELECT * on wide tables — column pruning only helps if you actually project fewer columns
SELECT order_id, customer_id, amount   -- not SELECT *
FROM orders
WHERE order_date > '2026-01-01';

-- QUALIFY clause — avoids a wasteful subquery/CTE just to filter on a window function
SELECT order_id, customer_id, amount,
       ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) AS rn
FROM orders
QUALIFY rn = 1;

-- Avoid repeated scalar subqueries — compute once in a CTE instead
-- Bad: this subquery re-executes conceptually for every outer row in some plans
SELECT order_id, amount, (SELECT AVG(amount) FROM orders) AS avg_amount FROM orders;
-- Better
WITH avg_calc AS (SELECT AVG(amount) AS avg_amount FROM orders)
SELECT o.order_id, o.amount, a.avg_amount FROM orders o CROSS JOIN avg_calc a;

-- Use approximate functions when exact precision isn't required — dramatically cheaper at scale
SELECT APPROX_COUNT_DISTINCT(customer_id) FROM orders;   -- HyperLogLog-based, near-instant on huge tables
SELECT APPROX_PERCENTILE(amount, 0.95) FROM orders;
```

---

## 7. Search Optimization Service

For **highly selective point-lookups** on non-clustered columns in large tables (needle-in-haystack queries) — a separate serverless index-like service, billed independently.

```sql
ALTER TABLE orders ADD SEARCH OPTIMIZATION ON EQUALITY(order_id), SUBSTRING(customer_email);

-- Check what's enabled and its cost
SHOW TABLES LIKE 'orders';   -- "search_optimization" column
SELECT * FROM snowflake.account_usage.search_optimization_history
WHERE table_name = 'ORDERS';

-- Drop it if the access pattern no longer justifies the maintenance cost
ALTER TABLE orders DROP SEARCH OPTIMIZATION;
```

> Use for: point lookups (`WHERE order_id = 12345`), substring/`LIKE` searches, `IN` lists on high-cardinality columns. Don't use for range scans — clustering keys handle those better and cheaper.

---

## 8. Materialized Views vs Dynamic Tables vs Result Cache

| Mechanism | Refresh | Use when |
|---|---|---|
| **Result Cache** | Automatic, 24hr, exact-match only | Identical repeated queries (dashboards hitting the same query) |
| **Materialized View** | Automatic, incremental, background serverless cost | Single-table aggregation/projection reused across many different queries |
| **Dynamic Table** | Declared `TARGET_LAG`, incremental | Multi-step transformation pipelines, DAG-style |

```sql
CREATE MATERIALIZED VIEW daily_order_totals AS
SELECT order_date, SUM(amount) AS total
FROM orders
GROUP BY order_date;

-- Materialized views bill background maintenance credits even with zero queries against them —
-- monitor before creating too many:
SELECT * FROM snowflake.account_usage.materialized_view_refresh_history;
```

---

## 9. Warehouse-Level Performance Levers

```sql
-- Statement queuing/timeout tuning for predictable SLAs
ALTER WAREHOUSE etl_wh SET STATEMENT_QUEUED_TIMEOUT_IN_SECONDS = 300;
ALTER WAREHOUSE etl_wh SET STATEMENT_TIMEOUT_IN_SECONDS = 3600;

-- Query Acceleration Service for scan-heavy ad-hoc warehouses (see Architecture file for detail)
ALTER WAREHOUSE adhoc_wh SET ENABLE_QUERY_ACCELERATION = TRUE;
```

---

## 10. Workload-Specific Tuning Playbooks

**BI dashboard is slow for end users:**
1. Check result cache hit rate — are dashboards issuing byte-identical queries?
2. Check `queued_overload_time` — concurrency problem → multi-cluster warehouse, not bigger warehouse
3. Consider a Materialized View for the dashboard's core aggregation if many different dashboards hit variations of the same base aggregation

**Nightly batch ETL is slow:**
1. Check for spilling (`bytes_spilled_to_remote_storage`) — likely undersized warehouse for the join/aggregate volume
2. Check partition pruning — is the incremental filter (e.g., `WHERE load_date = today`) actually hitting the clustering key?
3. Check if `MERGE` statements are touching far more partitions than the actual change volume — may indicate a clustering key mismatch on the target table

**Single ad-hoc analyst query is slow:**
1. Check `partitions_scanned` vs `partitions_total` — full scans on huge tables from unfiltered exploratory queries are often just... expected. Consider Search Optimization Service if this is a recurring pattern.
2. Verify they're not accidentally cross-joining or missing a join condition (row count explosion is visible immediately in Query Profile)

---

## 11. Common Anti-Patterns Checklist

- [ ] `SELECT *` on wide tables when only a few columns are needed
- [ ] Functions wrapped around filter columns (`WHERE CAST(col AS DATE) = ...`)
- [ ] Oversized warehouse masking a bad query instead of fixing the query
- [ ] No clustering key on a multi-TB table with skewed filter patterns
- [ ] Ignoring `queued_overload_time` and assuming it's a "size" problem when it's a concurrency problem
- [ ] Excessive `MATERIALIZED VIEW`s that nobody queries, quietly burning serverless credits
- [ ] Not checking `bytes_spilled_to_remote_storage` before assuming a query is "just slow"
- [ ] Using `COUNT(DISTINCT ...)` on huge high-cardinality columns when `APPROX_COUNT_DISTINCT` would do
- [ ] Repeated correlated scalar subqueries instead of a single CTE computed once

---

## 12. Quick Reference: Databricks/Spark ↔ Snowflake Tuning

| Spark/Databricks lever | Snowflake lever |
|---|---|
| `spark.sql.shuffle.partitions` | Not exposed — optimizer-managed |
| Broadcast join hint | No manual hint — optimizer decides based on stats |
| AQE (Adaptive Query Execution) | Always-on, not user-configurable |
| Z-ORDER BY | `CLUSTER BY` |
| `OPTIMIZE`/compaction | Automatic |
| Cluster/executor sizing | Warehouse size (T-shirt sizes, XS→6XL) |
| Delta Cache / Disk Cache | Local Disk (Warehouse) Cache |
| Spark UI / Spark Plan | Query Profile |
| Skew join hints / salting | Manual salting pattern (no built-in hint) |
| `approx_count_distinct` | `APPROX_COUNT_DISTINCT` (same HyperLogLog concept) |

---

## 13. Interview / Self-Check Q&A

**Q: A query's `execution_time` is low but `total_elapsed_time` is high. What are the two most likely explanations, and how do you tell them apart?**
A: Either compilation overhead (check `compilation_time`) or queuing (check `queued_provisioning_time`/`queued_overload_time`) — pull all four fields from `query_history` to distinguish; resizing the warehouse fixes neither.

**Q: Why doesn't `WHERE YEAR(order_date) = 2026` prune partitions the way `WHERE order_date BETWEEN ...` does?**
A: Wrapping the column in a function prevents the optimizer from comparing it directly against the stored min/max metadata per micro-partition — the metadata is on the raw column values, not on the function's output.

**Q: When would you reach for the Search Optimization Service instead of a clustering key?**
A: For highly selective point-lookups or substring searches on high-cardinality, non-naturally-ordered columns (e.g., looking up a specific `order_id` or searching emails by substring) — clustering keys are better suited to range scans on naturally-ordered columns like dates.

**Q: A `MERGE` into a large target table takes much longer than expected for a small number of changed rows. What's the likely cause?**
A: The target table probably lacks a clustering key aligned with the `MERGE` key, so the changed rows are scattered across many micro-partitions, forcing a much larger rewrite than the logical change volume would suggest.

**Q: Why would remote spilling be worse than local spilling, and what's the fix for each?**
A: Local spilling writes to the warehouse node's own SSD (fast); remote spilling writes to network-attached cloud storage (much slower) because even local disk was exhausted. The fix for both is generally the same lever — resize the warehouse up, or restructure the query to reduce the in-memory working set (filter earlier, pre-aggregate, avoid unnecessary wide joins).
