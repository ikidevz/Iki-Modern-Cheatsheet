# 🖥️ Virtual Warehouse & Compute Management

> Provisioning, scaling, and controlling the cost of Snowflake's compute layer.

---

## 1. Creating & Sizing Warehouses

```sql
CREATE WAREHOUSE etl_wh
    WAREHOUSE_SIZE = 'MEDIUM'
    AUTO_SUSPEND = 60              -- seconds of inactivity before suspend
    AUTO_RESUME = TRUE
    INITIALLY_SUSPENDED = TRUE;

-- T-shirt sizes double credit consumption at each step:
-- XS(1 credit/hr) → S(2) → M(4) → L(8) → XL(16) → 2XL(32) → 3XL(64) → 4XL(128) → 5XL(256) → 6XL(512)

ALTER WAREHOUSE etl_wh SET WAREHOUSE_SIZE = 'LARGE';   -- resize (near-instant, in-flight queries finish on old size)

-- Full parameter set worth knowing at creation time
CREATE WAREHOUSE bi_wh
    WAREHOUSE_SIZE = 'SMALL'
    AUTO_SUSPEND = 300
    AUTO_RESUME = TRUE
    MIN_CLUSTER_COUNT = 1
    MAX_CLUSTER_COUNT = 3
    SCALING_POLICY = 'STANDARD'
    INITIALLY_SUSPENDED = TRUE
    COMMENT = 'BI dashboard workload — concurrency-sensitive, small individual queries';
```

> 🔑 **Billing granularity:** per-second billing with a **60-second minimum** per resume. Constantly resuming/suspending a warehouse every 30 seconds still costs a full 60-second minimum each time — auto-suspend of 60s (not 10s) is usually the sweet spot to avoid death-by-a-thousand-minimums.

### 1.1 Snowpark-Optimized Warehouses

A specialized warehouse type with more memory per node, for memory-intensive Snowpark ML workloads (large model training, big pandas conversions):

```sql
CREATE WAREHOUSE ml_wh
    WAREHOUSE_SIZE = 'MEDIUM'
    WAREHOUSE_TYPE = 'SNOWPARK-OPTIMIZED'
    AUTO_SUSPEND = 300;
```

> Costs more per credit-hour than a standard warehouse of the same T-shirt size — only use it when you've confirmed a workload is genuinely memory-bound (check for spilling on a standard warehouse first).

---

## 2. Multi-Cluster Warehouses (horizontal scaling for concurrency)

Solves **queuing**, not query speed — this is the key distinction from vertical sizing.

```sql
CREATE WAREHOUSE bi_wh
    WAREHOUSE_SIZE = 'MEDIUM'
    MIN_CLUSTER_COUNT = 1
    MAX_CLUSTER_COUNT = 4
    SCALING_POLICY = 'STANDARD'    -- or 'ECONOMY' (favors fewer clusters, tolerates some queuing)
    AUTO_SUSPEND = 300
    AUTO_RESUME = TRUE;

-- STANDARD: spins up a new cluster fast at the first sign of queuing (favors latency)
-- ECONOMY: waits, tries to fully utilize existing clusters first (favors cost)

-- Check if you actually need this — queuing evidence:
SELECT
    query_id,
    warehouse_name,
    queued_overload_time,   -- non-zero = queuing occurred, THIS is the multi-cluster signal
    total_elapsed_time
FROM table(information_schema.query_history())
WHERE warehouse_name = 'BI_WH'
ORDER BY start_time DESC;

-- Check actual multi-cluster scaling behavior historically
SELECT *
FROM snowflake.account_usage.warehouse_events_history
WHERE warehouse_name = 'BI_WH'
  AND event_name IN ('CLUSTER_START', 'CLUSTER_STOP')
ORDER BY timestamp DESC;
```

> ⚠️ **Sizing mistake:** teams often size UP (bigger warehouse) to fix concurrency problems, when the actual signal (`queued_overload_time` > 0 with normal `execution_time`) calls for multi-cluster (more clusters of the *same* size), not vertical resize. Bigger warehouses fix scan-bound single queries; multi-cluster fixes "too many people querying at once."

### 2.1 Setting Concurrency Limits Directly

```sql
-- Cap concurrent queries per cluster (rarely changed from default, but available)
ALTER WAREHOUSE bi_wh SET MAX_CONCURRENCY_LEVEL = 8;
```

---

## 3. Auto-Suspend / Auto-Resume Tuning

| `AUTO_SUSPEND` | Good for | Trade-off |
|---|---|---|
| 60s | Bursty, ad-hoc query patterns | Loses local disk cache fast, more cold-cache penalties |
| 300–600s | BI dashboards with steady traffic | Costs more idle credits, but keeps cache warm |
| Disabled (never suspend) | Rare — mission-critical, always-hot workloads | Full 24/7 billing regardless of usage |

```sql
ALTER WAREHOUSE etl_wh SET AUTO_SUSPEND = 300;
```

### 3.1 Modeling the actual cost trade-off

```sql
-- Estimate: is a longer auto-suspend actually cheaper once you factor in cold-cache re-scans?
-- Compare average query time for the FIRST query after each resume vs subsequent queries
SELECT
    warehouse_name,
    query_id,
    start_time,
    total_elapsed_time,
    ROW_NUMBER() OVER (PARTITION BY warehouse_name ORDER BY start_time) AS query_seq
FROM table(information_schema.query_history())
WHERE warehouse_name = 'ETL_WH'
ORDER BY start_time;
-- if query_seq = 1 (post-resume) queries are consistently much slower than steady-state,
-- that's the quantified cost of your current auto-suspend setting
```

---

## 4. Resource Monitors (hard cost guardrails)

```sql
CREATE RESOURCE MONITOR monthly_etl_budget
    WITH CREDIT_QUOTA = 1000
    FREQUENCY = MONTHLY
    START_TIMESTAMP = IMMEDIATELY
    TRIGGERS
        ON 75 PERCENT DO NOTIFY
        ON 90 PERCENT DO NOTIFY
        ON 100 PERCENT DO SUSPEND          -- lets running queries finish, blocks new ones
        ON 110 PERCENT DO SUSPEND_IMMEDIATE; -- kills running queries too

ALTER WAREHOUSE etl_wh SET RESOURCE_MONITOR = monthly_etl_budget;

-- Account-level monitor (applies to all warehouses without their own monitor)
ALTER ACCOUNT SET RESOURCE_MONITOR = account_wide_cap;

-- Multiple warehouses under one shared monitor (department-level budget)
ALTER WAREHOUSE bi_wh SET RESOURCE_MONITOR = monthly_etl_budget;
ALTER WAREHOUSE adhoc_wh SET RESOURCE_MONITOR = monthly_etl_budget;

-- Check current consumption against a monitor
SHOW RESOURCE MONITORS;

-- Who gets notified — configure recipients
ALTER RESOURCE MONITOR monthly_etl_budget SET NOTIFY_USERS = ('JANE_DOE', 'JOHN_SMITH');
```

> 🔑 **`SUSPEND` vs `SUSPEND_IMMEDIATE`:** `SUSPEND` is graceful (in-flight queries complete, no new ones start); `SUSPEND_IMMEDIATE` kills running queries mid-execution. Use `SUSPEND` for cost-control warehouses running scheduled ETL; reserve `SUSPEND_IMMEDIATE` as a true emergency brake — an interrupted `MERGE` mid-transaction is safe (transactional), but wastes the credits already spent.

### 4.1 Resource Monitor Reset Behavior

Resource monitors reset their consumption counter at the start of each `FREQUENCY` period (`DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`, or `NEVER`) — but a `SUSPEND`/`SUSPEND_IMMEDIATE` trigger does **not automatically un-suspend** the warehouse when the period resets; you may need to manually resume it or set it up to auto-resume on next use if it was only suspended (not `SUSPEND_IMMEDIATE`'d mid-query and left in a bad state).

---

## 5. Warehouse Isolation Strategy (a real design decision, not just naming)

A common senior-DE anti-pattern is **one giant shared warehouse** for everything. Better pattern:

```sql
-- Separate warehouses by workload SHAPE, not by team/project
CREATE WAREHOUSE etl_wh    WAREHOUSE_SIZE = 'LARGE'  AUTO_SUSPEND = 60;   -- batch, scan-heavy, bursty
CREATE WAREHOUSE bi_wh     WAREHOUSE_SIZE = 'SMALL'  AUTO_SUSPEND = 300  MAX_CLUSTER_COUNT = 4; -- concurrency-heavy, small queries
CREATE WAREHOUSE adhoc_wh  WAREHOUSE_SIZE = 'MEDIUM' AUTO_SUSPEND = 60;  -- analyst/exploration, unpredictable
CREATE WAREHOUSE loader_wh WAREHOUSE_SIZE = 'XSMALL' AUTO_SUSPEND = 60;  -- Snowpipe-adjacent light loads
```

Why: an ETL job competing with 50 BI dashboard refreshes on the same warehouse causes queuing that looks like a "Snowflake is slow" problem but is actually a workload-isolation problem. Splitting by shape (not org chart) also makes cost attribution and resource monitors meaningful per workload type.

### 5.1 A Fuller Reference Architecture

| Warehouse | Size | Auto-suspend | Multi-cluster | Typical workload |
|---|---|---|---|---|
| `LOADER_WH` | XS–S | 60s | No | Snowpipe-adjacent COPY INTO, light Task loads |
| `ETL_WH` | L–XL | 60–120s | No (usually vertical scaling suffices) | Nightly batch transform, heavy MERGE |
| `TRANSFORM_WH` | M–L | 60s | No | dbt runs, scheduled during defined windows |
| `BI_WH` | S–M | 300–600s | Yes (2–4 max) | Dashboard/BI tool concurrent query load |
| `ADHOC_WH` | M | 60s | No | Analyst exploration, unpredictable query shapes |
| `ML_WH` | M–L, Snowpark-optimized | 300s | No | Snowpark ML training/feature engineering |

---

## 6. Warehouse Cost Monitoring Queries

```sql
-- Credit consumption by warehouse, last 30 days
SELECT
    warehouse_name,
    DATE_TRUNC('day', start_time) AS day,
    SUM(credits_used) AS credits
FROM snowflake.account_usage.warehouse_metering_history
WHERE start_time > DATEADD('day', -30, CURRENT_TIMESTAMP())
GROUP BY 1, 2
ORDER BY 2 DESC, 3 DESC;

-- Idle vs active time ratio (finding oversized/underused warehouses)
SELECT
    warehouse_name,
    COUNT(*) AS total_queries,
    AVG(total_elapsed_time) AS avg_query_ms,
    SUM(CASE WHEN execution_status = 'SUCCESS' THEN 0 ELSE 1 END) AS failures
FROM table(information_schema.query_history())
GROUP BY 1;

-- Utilization check: credits consumed vs actual query seconds executed
-- (a big gap suggests too-long auto-suspend or a warehouse sitting idle-but-resumed)
SELECT
    m.warehouse_name,
    SUM(m.credits_used) AS credits,
    SUM(q.total_elapsed_time) / 1000 / 3600 AS query_hours
FROM snowflake.account_usage.warehouse_metering_history m
JOIN snowflake.account_usage.query_history q
    ON m.warehouse_name = q.warehouse_name
    AND DATE_TRUNC('day', m.start_time) = DATE_TRUNC('day', q.start_time)
WHERE m.start_time > DATEADD('day', -7, CURRENT_TIMESTAMP())
GROUP BY 1;
```

---

## 7. Gen2 Warehouses & Newer Compute Options

Snowflake periodically introduces newer warehouse generations with improved price/performance on the same T-shirt sizing scale — when available on your account, migrating is usually a drop-in `WAREHOUSE_SIZE`/type change rather than a pipeline rewrite. Always check current documentation for what's available on your account's cloud region, since compute generation rollout varies by region and edition.

```sql
-- Check what's actually available/enabled on your account
SHOW PARAMETERS LIKE '%WAREHOUSE%' IN ACCOUNT;
```

---

## 8. Troubleshooting Playbook

**Warehouse won't resume / hangs on resume:**
```sql
SELECT SYSTEM$WHITELIST();  -- confirm network connectivity isn't the issue
SHOW WAREHOUSES LIKE 'etl_wh';  -- check "state" column
```

**Unexpected credit spike overnight:**
```sql
SELECT warehouse_name, SUM(credits_used) AS credits
FROM snowflake.account_usage.warehouse_metering_history
WHERE start_time BETWEEN '2026-09-09 20:00:00' AND '2026-09-10 06:00:00'
GROUP BY 1 ORDER BY 2 DESC;
-- cross-reference against task_history and automatic_clustering_history for the same window
```

**Queries queuing even though "nothing else is running":**
```sql
-- Check for a runaway single query holding the warehouse (not necessarily many concurrent queries)
SELECT query_id, user_name, start_time, total_elapsed_time
FROM table(information_schema.query_history())
WHERE warehouse_name = 'ETL_WH' AND execution_status = 'RUNNING';
```

---

## 9. Quick Reference: Databricks ↔ Snowflake Compute

| Databricks concept | Snowflake equivalent |
|---|---|
| Cluster policies | Warehouse-level `ALTER WAREHOUSE` settings + RBAC on `CREATE WAREHOUSE` |
| Instance pools | Not applicable — Snowflake manages the underlying infra fully |
| Autoscaling (min/max workers) | Multi-cluster warehouse (`MIN/MAX_CLUSTER_COUNT`) |
| Cluster auto-termination | `AUTO_SUSPEND` |
| DBU consumption | Snowflake Credits |
| Job clusters vs all-purpose | Dedicated warehouses per workload shape (ETL/BI/adhoc) — same isolation principle |
| Budgets/alerts | Resource Monitors |
| Photon-optimized instances | Snowpark-Optimized Warehouses (rough analog for memory-heavy workloads) |
| Serverless SQL warehouses | Standard Snowflake warehouses (Snowflake compute is serverless-by-default architecturally) |

---

## 10. Interview / Self-Check Q&A

**Q: A dashboard warehouse is queuing during peak hours. Do you resize it bigger or add multi-cluster?**
A: Check `queued_overload_time` — if queries themselves run fine once started but wait to start, that's a concurrency problem, solved by `MAX_CLUSTER_COUNT` (multi-cluster), not a bigger single warehouse.

**Q: Why might a shorter `AUTO_SUSPEND` actually cost MORE overall despite billing less idle time?**
A: Every resume incurs a cold local-disk-cache penalty (re-scanning data from remote storage that would otherwise have been served from warm SSD cache) — for bursty-but-frequent workloads, a too-aggressive suspend can trade a small idle-credit saving for a larger repeated cold-scan cost.

**Q: What's the difference between `STANDARD` and `ECONOMY` scaling policy on a multi-cluster warehouse?**
A: `STANDARD` prioritizes low latency, spinning up additional clusters quickly at the first sign of queuing; `ECONOMY` prioritizes cost, preferring to queue briefly and fully utilize existing clusters before adding more.

**Q: A resource monitor is set to `SUSPEND` at 100%. What happens to a query that's already running when the threshold is hit?**
A: It's allowed to finish — `SUSPEND` blocks new queries from starting but doesn't interrupt in-flight ones; only `SUSPEND_IMMEDIATE` kills running queries.

**Q: Why would you create a dedicated `Snowpark-Optimized` warehouse instead of just sizing up a standard warehouse for an ML workload?**
A: Snowpark-Optimized warehouses provide substantially more memory per node for the same node count, which matters for memory-bound operations like large pandas conversions or in-memory model training — a standard warehouse of the same T-shirt size has less memory headroom and would spill sooner.
