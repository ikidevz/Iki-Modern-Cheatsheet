# Performance & Optimization

## Partitioning & Indexing Strategies

**Definition:** Techniques for organizing table storage so queries scan the minimum amount of data necessary.

**Key Points:**
- Partition large tables by a high-cardinality, frequently filtered column (usually date) to enable partition pruning.
- Avoid over-partitioning — too many tiny partitions increases metadata overhead and slows planning.
- Indexes matter most in OLTP/row-store systems; columnar warehouses (BigQuery, Snowflake) rely on partitioning/clustering instead.

**Example:**
```sql
-- Snowflake clustering key
ALTER TABLE sales CLUSTER BY (event_date, region);
```

**When to Use / Trade-offs:**
- Partition on the column most queries filter by; clustering helps further when a second common filter column exists.

**Common Pitfalls:**
- Adding traditional B-tree style indexes in a columnar warehouse where they provide no benefit and add write overhead.

---

## Query Optimization

**Definition:** Practices for writing SQL/pipeline logic that minimizes compute and I/O cost.

**Key Points:**
- Filter and aggregate as early as possible (push down predicates).
- Avoid `SELECT *` — only pull needed columns, especially in columnar storage.
- Aggregate before large joins when possible to shrink join inputs.
- Use `EXPLAIN`/query plans to check for full table scans, broadcast join issues, or spill-to-disk.

**Example:**
```sql
-- Push filter before join
WITH recent_orders AS (
  SELECT * FROM orders WHERE order_date >= '2026-01-01'
)
SELECT r.*, c.name FROM recent_orders r
JOIN customers c ON r.customer_id = c.customer_id;
```

**When to Use / Trade-offs:**
- Always check query plans for expensive operations (full scans, large shuffles) before assuming a slow query needs more compute rather than a rewrite.

**Common Pitfalls:**
- Joining before filtering, forcing the engine to process far more rows than necessary.
- Relying on `SELECT *` in production models, pulling unused columns that increase scan cost.

---

## Parallelism & Distributed Processing

**Definition:** Splitting large workloads across multiple workers/nodes to process data concurrently.

**Key Points:**
- Distributed engines (Spark, warehouse compute clusters) split data into partitions processed in parallel.
- Data skew — uneven partition sizes cause some workers to take far longer than others — is a common root cause of slow jobs.
- Right-size parallelism/cluster to the workload; over-provisioning wastes cost, under-provisioning causes queuing/spill.

**Example:**
- A Spark job partitioned by `customer_id` where one customer has 40% of all rows will bottleneck on that single skewed partition regardless of total cluster size.

**When to Use / Trade-offs:**
- Repartition on a more evenly distributed key, or use salting techniques, when skew is detected.

**Common Pitfalls:**
- Diagnosing a slow job as "needs more compute" when the actual cause is data skew that additional nodes won't fix.

---

## Caching Strategies

**Definition:** Techniques to avoid recomputing or re-scanning data that hasn't changed.

**Key Points:**
- Cache frequently-accessed, slow-changing datasets (e.g., dimension tables) to avoid recomputation.
- Materialized views / incremental models (dbt `incremental` materialization) avoid full-table recomputation on every run.
- Result caching at the warehouse layer speeds up repeated identical queries at no extra compute cost.

**Example:**
```sql
-- dbt incremental model
{{ config(materialized='incremental', unique_key='order_id') }}
SELECT * FROM {{ source('raw', 'orders') }}
{% if is_incremental() %}
WHERE updated_at > (SELECT MAX(updated_at) FROM {{ this }})
{% endif %}
```

**When to Use / Trade-offs:**
- Use incremental materialization for large, append-heavy tables where full rebuilds are wasteful; use full-refresh materialization when the underlying logic changes often or the table is small.

**Common Pitfalls:**
- Using incremental models without a strategy to periodically full-refresh, causing accumulated drift if upstream backfills or corrections happen.
