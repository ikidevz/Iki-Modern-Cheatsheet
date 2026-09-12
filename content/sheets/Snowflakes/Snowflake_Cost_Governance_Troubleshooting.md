# 💰 Cost, Governance & Troubleshooting

> `ACCOUNT_USAGE`/`ORGANIZATION_USAGE` views, credit attribution, and the debugging queries you reach for when something's slow, expensive, or broken.

---

## 1. The Two Metadata Schemas (know which one to use)

| Schema | Latency | Retention | Use for |
|---|---|---|---|
| `INFORMATION_SCHEMA` | Real-time | Limited (recent only, e.g. 7 days for query history via table functions) | Live debugging, "what just happened" |
| `SNOWFLAKE.ACCOUNT_USAGE` | Up to 45min–3hr delay | 1 year | Historical analysis, cost reports, trend dashboards |
| `SNOWFLAKE.ORGANIZATION_USAGE` | Similar delay | 1 year | Cross-account rollups (multi-account orgs) |

```sql
-- Grant needed to query ACCOUNT_USAGE (not available by default to custom roles)
GRANT IMPORTED PRIVILEGES ON DATABASE snowflake TO ROLE analyst_role;
```

### 1.1 A Third Option: `SNOWFLAKE.INFORMATION_SCHEMA` Table Functions vs Views

Some data is available as both a table function (parameterized, real-time) and an `ACCOUNT_USAGE` view (broader history, delayed):

```sql
-- Table function: real-time, but you must specify a time window and it has a row limit
SELECT * FROM TABLE(information_schema.query_history(
    end_time_range_start => dateadd('hour', -1, current_timestamp())
));

-- ACCOUNT_USAGE view: no row limit, full year of history, but delayed
SELECT * FROM snowflake.account_usage.query_history
WHERE start_time > dateadd('hour', -1, current_timestamp());
```

Rule of thumb: **incident response and "what's happening right now" → table functions. Trend reports, monthly cost reviews, capacity planning → ACCOUNT_USAGE.**

---

## 2. Credit Consumption Breakdown

```sql
-- Total credits by service type (warehouse compute vs serverless features)
SELECT
    usage_date,
    warehouse_name,
    credits_used,
    credits_used_compute,
    credits_used_cloud_services
FROM snowflake.account_usage.warehouse_metering_history
WHERE usage_date > DATEADD('day', -30, CURRENT_DATE())
ORDER BY usage_date DESC;

-- Serverless feature costs — these DON'T show up in warehouse metering (easy to miss!)
SELECT service_type, SUM(credits_used) AS credits
FROM snowflake.account_usage.metering_history
WHERE start_time > DATEADD('day', -30, CURRENT_TIMESTAMP())
GROUP BY 1
ORDER BY 2 DESC;
-- service_type includes: WAREHOUSE_METERING, AUTOMATIC_CLUSTERING, MATERIALIZED_VIEW,
--                         PIPE (Snowpipe), SEARCH_OPTIMIZATION, QUERY_ACCELERATION, AI_SERVICES

-- Storage cost breakdown (active vs Time Travel vs Fail-safe — often the surprise line item)
SELECT
    table_name,
    active_bytes / POWER(1024,4) AS active_tb,
    time_travel_bytes / POWER(1024,4) AS time_travel_tb,
    failsafe_bytes / POWER(1024,4) AS failsafe_tb
FROM snowflake.account_usage.table_storage_metrics
ORDER BY active_bytes DESC
LIMIT 20;

-- Month-over-month credit trend, broken out by top-level category
SELECT
    DATE_TRUNC('month', usage_date) AS month,
    service_type,
    SUM(credits_used) AS credits
FROM snowflake.account_usage.metering_history
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;
```

> 🔑 **Cost surprise checklist, in order of "how often this is the actual culprit":** (1) auto-reclustering on a badly chosen clustering key running 24/7, (2) materialized views nobody queries anymore, (3) Time Travel retention set too high on staging/dev tables that churn constantly, (4) a warehouse's `AUTO_SUSPEND` left at default/disabled after a one-off job.

---

## 3. Cost Attribution via Tags

```sql
-- Tag warehouses/databases by team or cost center, then roll up spend
ALTER WAREHOUSE etl_wh SET TAG cost_center = 'data_engineering';

SELECT
    t.tag_value AS cost_center,
    SUM(w.credits_used) AS total_credits
FROM snowflake.account_usage.warehouse_metering_history w
JOIN snowflake.account_usage.tag_references t
    ON t.object_name = w.warehouse_name AND t.tag_name = 'COST_CENTER'
WHERE w.usage_date > DATEADD('day', -30, CURRENT_DATE())
GROUP BY 1
ORDER BY 2 DESC;
```

### 3.1 Budgets (native cost alerting, complements Resource Monitors)

```sql
-- Native Budgets feature: broader than Resource Monitors (can span multiple warehouses/
-- serverless features under one spending threshold with notifications)
CREATE SNOWFLAKE.CORE.BUDGET data_eng_budget()
    SET spending_limit = 5000, notify_users = ('jane_doe');
CALL data_eng_budget.add_resource('WAREHOUSE', 'ETL_WH');
CALL data_eng_budget.add_resource('WAREHOUSE', 'LOADER_WH');
```

---

## 4. Query-Level Troubleshooting Queries

```sql
-- Longest-running queries in the last 24 hours
SELECT query_id, user_name, warehouse_name, query_text,
       total_elapsed_time/1000 AS sec
FROM snowflake.account_usage.query_history
WHERE start_time > DATEADD('hour', -24, CURRENT_TIMESTAMP())
ORDER BY total_elapsed_time DESC
LIMIT 25;

-- Failed queries and their error messages
SELECT query_id, user_name, error_code, error_message, query_text
FROM snowflake.account_usage.query_history
WHERE execution_status = 'FAIL'
  AND start_time > DATEADD('hour', -24, CURRENT_TIMESTAMP())
ORDER BY start_time DESC;

-- Queries stuck queuing (concurrency signal — see Warehouse_Compute_Management.md)
SELECT query_id, warehouse_name, queued_overload_time, queued_provisioning_time
FROM snowflake.account_usage.query_history
WHERE queued_overload_time > 0
ORDER BY start_time DESC
LIMIT 25;

-- Login/auth troubleshooting (failed logins, MFA issues, network policy blocks)
SELECT event_timestamp, user_name, error_message, client_ip, reported_client_type
FROM snowflake.account_usage.login_history
WHERE is_success = 'NO'
ORDER BY event_timestamp DESC
LIMIT 25;

-- Most common error codes account-wide this week (surface systemic issues)
SELECT error_code, COUNT(*) AS occurrences
FROM snowflake.account_usage.query_history
WHERE execution_status = 'FAIL'
  AND start_time > DATEADD('day', -7, CURRENT_TIMESTAMP())
GROUP BY 1
ORDER BY 2 DESC;
```

---

## 5. Task & Pipeline Health Checks

```sql
-- Task failures across the account (catch silent DAG breaks)
SELECT name, state, error_code, error_message, scheduled_time
FROM snowflake.account_usage.task_history
WHERE state = 'FAILED'
  AND scheduled_time > DATEADD('day', -1, CURRENT_TIMESTAMP())
ORDER BY scheduled_time DESC;

-- Snowpipe load errors (files landed but failed to load — silent data gaps)
SELECT pipe_name, file_name, first_error_message, last_load_time
FROM snowflake.account_usage.copy_history
WHERE status != 'LOADED'
  AND last_load_time > DATEADD('day', -1, CURRENT_TIMESTAMP());

-- Stream staleness check (prevents the "CDC silently broke over the weekend" incident)
SHOW STREAMS;   -- check the "stale" column for TRUE

-- Dynamic table refresh lag violations
SELECT name, target_lag, scheduling_state
FROM TABLE(information_schema.dynamic_table_refresh_history())
WHERE state = 'FAILED';
```

---

## 6. Access & Governance Auditing

```sql
-- Who has ACCOUNTADMIN (should be a very short, monitored list)
SHOW GRANTS OF ROLE ACCOUNTADMIN;

-- Objects with no access in the last 90 days (candidates for cleanup / access review)
SELECT DISTINCT table_name
FROM snowflake.account_usage.access_history,
     LATERAL FLATTEN(input => base_objects_accessed)
WHERE query_start_time > DATEADD('day', -90, CURRENT_TIMESTAMP());
-- compare this list against SHOW TABLES to find unused-but-still-costing-storage tables

-- Recent role/grant changes (who changed what access, useful post-incident)
SELECT *
FROM snowflake.account_usage.grants_to_roles
WHERE created_on > DATEADD('day', -7, CURRENT_TIMESTAMP())
ORDER BY created_on DESC;
```

---

## 7. Building a Cost Dashboard (the pattern, not just one query)

A senior-DE-owned Snowflake cost dashboard typically joins three views:

```sql
SELECT
    DATE_TRUNC('day', wh.usage_date) AS day,
    wh.warehouse_name,
    wh.credits_used AS warehouse_credits,
    COALESCE(sc.credits_used, 0) AS clustering_credits,
    COALESCE(mv.credits_used, 0) AS materialized_view_credits
FROM snowflake.account_usage.warehouse_metering_history wh
LEFT JOIN snowflake.account_usage.automatic_clustering_history sc
    ON DATE_TRUNC('day', sc.start_time) = wh.usage_date
LEFT JOIN snowflake.account_usage.materialized_view_refresh_history mv
    ON DATE_TRUNC('day', mv.start_time) = wh.usage_date
WHERE wh.usage_date > DATEADD('day', -30, CURRENT_DATE())
ORDER BY day DESC;
```

Feed this into a BI tool or a scheduled Task + Streamlit-in-Snowflake app for a self-serve internal cost dashboard.

---

## 8. Incident Response Playbooks

**"Costs spiked 3x overnight, nobody knows why":**
1. `metering_history` grouped by `service_type` for the spike window — isolate warehouse vs serverless
2. If warehouse compute: `warehouse_metering_history` by warehouse, then `query_history` for that warehouse/window for the specific runaway query
3. If serverless: check `automatic_clustering_history`, `materialized_view_refresh_history`, `pipe_usage_history`, `search_optimization_history` in that order — clustering is the most common culprit

**"A critical dashboard query started failing this morning":**
1. `query_history` filtered on `execution_status = 'FAIL'` for that query text/warehouse
2. Check `error_message` — common causes: a masking/row-access policy change broke a downstream secure view, an upstream `MERGE`/Task failure left a table in an inconsistent state, or a grant was revoked
3. Cross-check `grants_to_roles`/`grants_to_users` for recent changes matching the failure time

**"Data looks wrong in a downstream table":**
1. Check `task_history` and `copy_history` for the upstream pipeline in the relevant window for silent failures
2. Check stream staleness (`SHOW STREAMS`) if the pipeline is Stream+Task based
3. Use Time Travel to compare `SELECT * FROM table AT(OFFSET => ...)` against current state to pinpoint when the divergence started

**"A support case needs to be opened with Snowflake":**
- Always grab the `query_id` — Snowflake Support can pull internal diagnostics instantly from it
- For Fail-safe recovery requests, note the exact object name and approximate time range needed

---

## 9. Quick Reference: Databricks System Tables ↔ Snowflake ACCOUNT_USAGE

| Databricks system table | Snowflake equivalent |
|---|---|
| `system.billing.usage` | `snowflake.account_usage.metering_history` / `warehouse_metering_history` |
| `system.query.history` | `snowflake.account_usage.query_history` |
| `system.access.audit` | `snowflake.account_usage.access_history` / `login_history` |
| `system.lakeflow.job_run_timeline` | `snowflake.account_usage.task_history` |
| `system.storage.*` (table sizes) | `snowflake.account_usage.table_storage_metrics` |
| DBU pricing tiers | Snowflake Credit pricing (per-second, warehouse-size-tiered) |
| Databricks Budgets/alerts | Snowflake Budgets / Resource Monitors |

---

## 10. Interview / Self-Check Q&A

**Q: Why shouldn't you use `ACCOUNT_USAGE` views for real-time incident alerting?**
A: They lag reality by up to a few hours (metadata replication delay) — for anything time-sensitive, use `INFORMATION_SCHEMA` table functions instead, which reflect near-real-time state.

**Q: A monthly bill has an unexplained large `AUTOMATIC_CLUSTERING` line item. What's your first diagnostic step?**
A: Query `automatic_clustering_history` grouped by table to find which table is consuming the most reclustering credits, then check `SYSTEM$CLUSTERING_INFORMATION` on that table — often the clustering key no longer matches the actual DML/query pattern, or was set on a table with excessive random-order churn.

**Q: What's the difference in how you'd use a Resource Monitor vs a Budget?**
A: Resource Monitors are warehouse-credit-focused hard/soft caps with suspend actions; Budgets are broader, spanning multiple warehouses and serverless features under a single spending threshold with notification-only alerting — Budgets are more of a "visibility" tool, Resource Monitors are more of an enforcement tool.

**Q: A pipeline appears to have "silently" stopped producing fresh data with no error anywhere. What are the top three things you check?**
A: (1) Stream staleness via `SHOW STREAMS`, (2) Task execution history for failures or a task left suspended, (3) Snowpipe/`copy_history` for files landing but failing validation — all three can fail "silently" from the consumer's perspective because no downstream query throws an error, the data is just stale.

**Q: Why is it valuable to always capture the `query_id` before opening a Snowflake Support case?**
A: Snowflake Support can pull detailed internal execution diagnostics directly from a query ID far faster than from a description of symptoms — it's the equivalent of a stack trace for query-level issues.
