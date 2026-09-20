# FinOps & Cost Optimization for Data Platforms Cheatsheet

> A structured reference for managing and reducing data platform spend — the FinOps framework applied to data, warehouse-specific levers (Snowflake/BigQuery/Databricks), storage/compute optimization, tagging & showback, and monitoring tooling.

## 📑 Table of Contents

1. [🧠 The FinOps Framework](#the-finops-framework)
2. [💰 Where Data Platform Cost Actually Comes From](#where-data-platform-cost-actually-comes-from)
3. [❄️ Snowflake Cost Optimization](#snowflake-cost-optimization)
4. [🔷 BigQuery Cost Optimization](#bigquery-cost-optimization)
5. [🧱 Databricks Cost Optimization](#databricks-cost-optimization)
6. [☁️ Cloud Storage & Compute Levers](#cloud-storage-compute-levers)
7. [🏷️ Tagging, Showback & Chargeback](#tagging-showback-chargeback)
8. [📊 Monitoring & Alerting Tools](#monitoring-alerting-tools)
9. [📈 Key FinOps KPIs for Data Teams](#key-finops-kpis-for-data-teams)
10. [🗓️ Query & Pipeline Cost Estimation](#query-pipeline-cost-estimation)
11. [🟥 Redshift Cost Optimization](#redshift-cost-optimization)
12. [☸️ Kubernetes Cost Allocation (Kubecost)](#kubernetes-cost-allocation-kubecost)
13. [🚨 Cost Anomaly Detection](#cost-anomaly-detection)
14. [🧮 Chargeback Worked Example](#chargeback-worked-example)
15. [📊 FinOps Maturity Model](#finops-maturity-model)
16. [⚠️ Common Gotchas](#common-gotchas)
17. [🎯 Best Practices](#best-practices)
18. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Cost driver             | Primary lever                                              |
| ------------------------- | -------------------------------------------------------------- |
| Warehouse compute         | Right-size warehouse/cluster, auto-suspend, query pruning     |
| Storage                   | Lifecycle policies, tiering (hot/cool/archive), compaction     |
| Data scanned per query    | Partitioning, clustering, columnar formats, `LIMIT`/pushdown   |
| Idle infra                | Auto-scaling to zero, spot/preemptible instances               |
| Data egress               | Keep compute + storage in the same region/cloud                |
| Orchestration overhead    | Right-size worker pools, avoid always-on clusters for batch     |

## 🧠 The FinOps Framework

The FinOps Foundation defines three iterative phases — apply them specifically to data platforms:

1. **Inform** — get visibility into what's being spent and by whom: cost allocation via tags, per-team/per-pipeline dashboards, anomaly detection.
2. **Optimize** — act on visibility: rightsizing warehouses/clusters, reserved capacity vs on-demand, storage tiering, query optimization, eliminating waste (idle clusters, unused tables, orphaned snapshots).
3. **Operate** — make cost a continuous, cross-functional practice: budgets/alerts wired into CI/CD, cost reviews in sprint planning, cost-aware architecture decisions baked into design reviews.

```
Inform (visibility) → Optimize (act) → Operate (institutionalize) → repeat
```

- **Unit economics** matter more than raw totals for data platforms — track cost *per query*, *per pipeline run*, *per GB processed*, or *per active user*, not just a monthly bill total.
- **Shared responsibility** — FinOps for data works best when engineers who write the queries/pipelines see the cost impact of their own choices, not just a central platform team.

## 💰 Where Data Platform Cost Actually Comes From

| Category | Examples | Notes |
| --- | --- | --- |
| Compute | Warehouse credits (Snowflake), slots/bytes-scanned (BigQuery), DBUs + cluster VMs (Databricks) | Usually the largest and most controllable line item |
| Storage | Object storage (S3/GCS/ADLS), warehouse-native storage, backups/snapshots | Grows monotonically unless actively managed (lifecycle policies) |
| Data transfer / egress | Cross-region, cross-cloud, internet egress | Easy to overlook; can dominate for multi-cloud or federated setups |
| Orchestration | Airflow/Dagster worker infra, managed orchestration service fees | Often "always-on" cost even when pipelines are idle |
| Licensing / SaaS | BI tools, catalog/observability platforms, per-seat or per-query pricing | Frequently under-monitored compared to raw cloud infra |
| Idle/orphaned resources | Forgotten dev clusters, unattached volumes, stale snapshots, zombie warehouses | Classic "silent waste" — invisible until someone audits |

## ❄️ Snowflake Cost Optimization

```sql
-- Auto-suspend / auto-resume: the single highest-leverage Snowflake lever
ALTER WAREHOUSE compute_wh SET AUTO_SUSPEND = 60;   -- seconds of idle before suspending
ALTER WAREHOUSE compute_wh SET AUTO_RESUME = TRUE;

-- Right-size: start small, scale up only if query performance requires it
ALTER WAREHOUSE compute_wh SET WAREHOUSE_SIZE = 'SMALL';

-- Use multi-cluster warehouses for concurrency spikes, not permanently large single warehouses
ALTER WAREHOUSE compute_wh SET
  MIN_CLUSTER_COUNT = 1, MAX_CLUSTER_COUNT = 4, SCALING_POLICY = 'STANDARD';

-- Inspect actual credit consumption
SELECT warehouse_name, SUM(credits_used) AS credits, DATE_TRUNC('day', start_time) AS day
FROM snowflake.account_usage.warehouse_metering_history
GROUP BY 1, 3 ORDER BY credits DESC;

-- Find your most expensive queries
SELECT query_text, warehouse_name, total_elapsed_time, credits_used_cloud_services
FROM snowflake.account_usage.query_history
ORDER BY total_elapsed_time DESC
LIMIT 50;

-- Resource monitors: hard/soft spend caps with alerts
CREATE RESOURCE MONITOR monthly_monitor
  WITH CREDIT_QUOTA = 1000
  TRIGGERS ON 75 PERCENT DO NOTIFY
           ON 100 PERCENT DO SUSPEND;
ALTER WAREHOUSE compute_wh SET RESOURCE_MONITOR = monthly_monitor;
```

- **Storage cost is driven by Time Travel + Fail-safe retention** — shortening `DATA_RETENTION_TIME_IN_DAYS` on tables that don't need long history reduces storage bills.
- **Clustering keys speed up pruning** on huge tables, but re-clustering itself costs credits — only worth it for genuinely large, frequently-filtered tables.

## 🔷 BigQuery Cost Optimization

```sql
-- On-demand pricing bills per byte SCANNED, not per row returned — column pruning matters a lot
SELECT order_id, amount FROM `project.dataset.orders`;   -- not SELECT *

-- Dry-run a query to see bytes scanned before running it
-- (bq CLI)
bq query --dry_run --use_legacy_sql=false 'SELECT * FROM `project.dataset.orders`'

-- Partitioning + clustering to prune scanned data
CREATE TABLE dataset.orders
PARTITION BY DATE(order_date)
CLUSTER BY customer_id
AS SELECT * FROM dataset.raw_orders;

-- Query only necessary partitions
SELECT * FROM dataset.orders
WHERE order_date BETWEEN '2024-01-01' AND '2024-01-31';  -- prunes to ~1 month of partitions

-- Materialized views cache expensive aggregations, refreshed incrementally
CREATE MATERIALIZED VIEW dataset.daily_revenue AS
SELECT DATE(order_date) AS day, SUM(amount) AS revenue
FROM dataset.orders GROUP BY 1;
```

```sql
-- Switch from on-demand (pay-per-byte-scanned) to flat-rate/capacity-based (slots) pricing
-- once steady-state usage makes it cheaper — check via BigQuery's own pricing calculator/reservation API.

-- Monitor bytes billed per job
SELECT job_id, user_email, total_bytes_billed, total_bytes_billed / POW(10,12) * 6.25 AS est_cost_usd
FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
ORDER BY total_bytes_billed DESC LIMIT 50;
```

| Pricing model | Best for |
| --- | --- |
| On-demand (pay per byte scanned) | Spiky, unpredictable, low/medium overall volume |
| Flat-rate / capacity reservations (slots) | Steady, high, predictable query volume — often cheaper at scale |

## 🧱 Databricks Cost Optimization

```python
# Cluster policies: enforce auto-termination and instance types org-wide
# (set via cluster policy JSON, not per-notebook)
{
  "autotermination_minutes": {"type": "fixed", "value": 30},
  "node_type_id": {"type": "allowlist", "values": ["i3.xlarge", "i3.2xlarge"]},
  "spark_conf.spark.databricks.cluster.profile": {"type": "fixed", "value": "serverless"}
}
```

- **Job clusters vs all-purpose clusters** — job clusters spin up for a run and terminate automatically; all-purpose (interactive) clusters left running between notebook sessions are one of the most common sources of Databricks waste.
- **Photon** (Databricks' vectorized engine) often reduces DBU-hours enough to offset its higher per-DBU rate — benchmark before assuming it's more expensive.
- **Spot/preemptible instances** for worker nodes on fault-tolerant batch jobs cut compute cost significantly; keep the driver node on-demand for stability.
- **Delta table maintenance** (`OPTIMIZE`, `VACUUM`) reduces both storage bloat and the compute cost of scanning many small files on every downstream query.

```sql
OPTIMIZE sales.orders ZORDER BY (customer_id);
VACUUM sales.orders RETAIN 168 HOURS;   -- 7 days; balance recovery window vs storage cost
```

- Use the **system tables** (`system.billing.usage`) to break down DBU consumption by workspace, cluster, and job/job-run for chargeback.

## ☁️ Cloud Storage & Compute Levers

```bash
# S3 lifecycle policy: auto-transition and expire aging data (AWS CLI example)
aws s3api put-bucket-lifecycle-configuration --bucket my-data-lake --lifecycle-configuration '{
  "Rules": [{
    "ID": "archive-old-data",
    "Filter": {"Prefix": "raw/"},
    "Status": "Enabled",
    "Transitions": [
      {"Days": 30, "StorageClass": "STANDARD_IA"},
      {"Days": 90, "StorageClass": "GLACIER"}
    ],
    "Expiration": {"Days": 730}
  }]
}'
```

| Lever | Typical savings |
| --- | --- |
| Storage tiering (hot → infrequent → archive/cold) | 40-80% on aging data |
| Compaction (small files → fewer, larger files) | Reduces both storage overhead and scan/list costs |
| Spot/preemptible compute for fault-tolerant batch jobs | 60-90% off on-demand compute rates |
| Reserved/committed-use discounts for steady-state workloads | 20-50% off on-demand rates |
| Auto-scaling to zero for dev/test environments | Eliminates idle spend entirely outside working hours |
| Same-region compute + storage | Avoids cross-region/cross-cloud egress charges entirely |

## 🏷️ Tagging, Showback & Chargeback

```sql
-- Tag warehouses/clusters/resources so cost can be attributed to a team or pipeline
ALTER WAREHOUSE etl_wh SET TAG cost_center = 'data-eng', team = 'analytics-platform';
```

```yaml
# Common tagging schema for data infra
tags:
  team: analytics-platform
  environment: production
  pipeline: daily_revenue_etl
  cost_center: CC-1042
  owner: jane.doe@company.com
```

- **Showback** — report cost per team/pipeline without actually billing them; builds awareness first, low-friction to roll out.
- **Chargeback** — actually allocate cost to team budgets; requires accurate, enforced tagging and usually a cultural/organizational commitment, not just a tooling change.
- **Tag enforcement** — untagged resources should fail policy checks (via IaC linting/OPA policies) rather than being cleaned up after the fact; retrofitting tags onto years of untagged infra is painful.

## 📊 Monitoring & Alerting Tools

| Tool | Focus |
| --- | --- |
| Native cloud cost tools (AWS Cost Explorer, GCP Billing, Azure Cost Management) | Baseline visibility, free, less data-platform-specific |
| Kubecost | Kubernetes-native cost allocation — relevant for Spark-on-K8s, Flink-on-K8s workloads |
| Vantage | Multi-cloud cost visibility & anomaly alerts, good tagging/showback UX |
| CloudHealth / CloudZero / Finout | Enterprise FinOps platforms with deeper unit-economics and anomaly detection |
| Snowflake/BigQuery/Databricks native cost dashboards | Warehouse-specific, most accurate for that platform's own billing units |
| Custom dashboards (dbt + BI on billing export tables) | Cheapest, most flexible, requires build/maintenance effort |

```sql
-- Example: build your own warehouse cost dashboard by exporting billing data to your warehouse
-- (BigQuery billing export, Snowflake ACCOUNT_USAGE, AWS Cost and Usage Report -> S3 -> query engine)
SELECT service.description, SUM(cost) AS total_cost, DATE_TRUNC(usage_start_time, DAY) AS day
FROM `project.billing_export.gcp_billing_export_v1`
GROUP BY 1, 3
ORDER BY total_cost DESC;
```

## 📈 Key FinOps KPIs for Data Teams

| KPI | Why it matters |
| --- | --- |
| Cost per query / cost per pipeline run | Normalizes cost against actual usage, not just total spend |
| Cost per GB processed or stored | Tracks efficiency improvements over time independent of data growth |
| % of spend covered by committed/reserved capacity | Higher = more predictable, usually cheaper baseline |
| Idle resource cost (identified waste) | Directly actionable — the "low hanging fruit" number |
| Forecast accuracy (budget vs actual) | Signals whether cost governance/process is actually working |
| Cost anomalies detected & resolved (MTTR) | How fast the org reacts to unexpected spend spikes |

## 🗓️ Query & Pipeline Cost Estimation

```sql
-- Always estimate before running unfamiliar expensive queries
EXPLAIN SELECT ...;                          -- Trino/Presto, Postgres — inspect plan before running
-- BigQuery: bq query --dry_run
-- Snowflake: check QUERY_HISTORY's bytes_scanned/credits after similar past queries
```

- Build **cost estimation into CI for scheduled pipelines** — a dbt model or Airflow DAG change that would meaningfully increase bytes-scanned/credits should surface in code review, not in next month's bill.
- **Budget alerts tied to Slack/PagerDuty**, not just a monthly finance report, are what actually change behavior in time to matter.

## 🟥 Redshift Cost Optimization

```sql
-- Redshift Serverless: RPU-based billing responds to workload shape, not just table design
-- Check current RPU usage and query cost attribution
SELECT * FROM sys_serverless_usage ORDER BY start_time DESC LIMIT 20;

-- Provisioned clusters: right-size node type/count based on actual utilization
SELECT * FROM stv_node_storage_capacity;

-- Distribution & sort keys are the Redshift-specific equivalent of partitioning/clustering
CREATE TABLE sales.orders (
    order_id BIGINT, customer_id BIGINT, amount DECIMAL(10,2), order_date DATE
)
DISTSTYLE KEY
DISTKEY (customer_id)              -- co-locate joins on this key, avoid cross-node shuffles
SORTKEY (order_date);              -- enables range-restricted scans (like partition pruning)

-- WLM / query queue configuration limits how much concurrent compute ad-hoc queries can consume
-- (via workload management console or Redshift Serverless workgroups)

-- Identify the most expensive queries
SELECT query, TRIM(querytxt) AS sql, total_exec_time
FROM svl_qlog
ORDER BY total_exec_time DESC LIMIT 20;
```

- **Concurrency Scaling and Redshift Serverless** both bill for burst capacity — spiky, unpredictable ad-hoc workloads can rack up cost quickly without WLM/workgroup limits capping concurrent RPUs.
- **VACUUM and ANALYZE** reclaim space from deleted/updated rows and keep the query planner's statistics fresh — skipping them silently degrades both storage efficiency and query cost over time on frequently-updated tables.

## ☸️ Kubernetes Cost Allocation (Kubecost)

```bash
helm repo add kubecost https://kubecost.github.io/cost-analyzer/
helm install kubecost kubecost/cost-analyzer --namespace kubecost --create-namespace
```

```bash
# Query allocated cost by namespace (e.g., separating a Spark-on-K8s or Flink-on-K8s team's spend)
curl "http://kubecost.kubecost:9090/model/allocation?window=7d&aggregate=namespace"

# Cost by label (e.g., attribute to a specific data pipeline via a pod label)
curl "http://kubecost.kubecost:9090/model/allocation?window=30d&aggregate=label:pipeline"
```

```yaml
# Ensure workloads carry cost-attributable labels — the #1 prerequisite for accurate Kubecost data
metadata:
  labels:
    team: data-platform
    pipeline: daily-revenue-etl
    cost-center: CC-1042
```

- Kubecost breaks down cost by **namespace, deployment, label, or controller**, mapping raw node/cluster billing back to the workloads actually consuming it — essential once Spark/Flink/Trino run as Kubernetes-native workloads instead of dedicated VMs with their own line-item bill.
- **Idle/unallocated cluster capacity** is a distinct line Kubecost tracks separately — a cluster provisioned for peak load that mostly sits at 20% utilization shows up explicitly, rather than being silently smeared across whatever happens to be running.

## 🚨 Cost Anomaly Detection

```sql
-- A simple anomaly rule: flag daily spend more than 2 standard deviations above a trailing 30-day mean
WITH daily_cost AS (
    SELECT usage_date, SUM(cost) AS total_cost
    FROM billing_export
    GROUP BY usage_date
),
stats AS (
    SELECT
        usage_date, total_cost,
        AVG(total_cost) OVER (ORDER BY usage_date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) AS avg_30d,
        STDDEV(total_cost) OVER (ORDER BY usage_date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) AS stddev_30d
    FROM daily_cost
)
SELECT usage_date, total_cost, avg_30d, stddev_30d
FROM stats
WHERE total_cost > avg_30d + 2 * stddev_30d;
```

- Most cloud providers and FinOps platforms (AWS Cost Anomaly Detection, GCP's built-in anomaly alerts, Vantage, CloudZero) ship **managed anomaly detection** using more sophisticated seasonal models than a simple rolling z-score — prefer the managed option where available, and treat a hand-rolled SQL rule (like above) as a fallback or a way to build intuition.
- **Route anomaly alerts to the team that owns the spend**, not just a central FinOps inbox — the person who can actually explain "we ran a one-off backfill" or "a job's retry loop went wild" is the one who wrote the pipeline.

## 🧮 Chargeback Worked Example

```
Total monthly warehouse spend: $50,000
Total credits/DBUs consumed:   100,000

Team A consumed: 42,000 credits (from tagged warehouse usage)
Team B consumed: 35,000 credits
Team C consumed: 23,000 credits

Team A chargeback = 50,000 * (42,000 / 100,000) = $21,000
Team B chargeback = 50,000 * (35,000 / 100,000) = $17,500
Team C chargeback = 50,000 * (23,000 / 100,000) = $11,500
```

```sql
-- Compute the same allocation directly from a tagged usage table
SELECT
    tag_team,
    SUM(credits_used) AS team_credits,
    SUM(credits_used) / SUM(SUM(credits_used)) OVER () AS pct_of_total,
    SUM(credits_used) / SUM(SUM(credits_used)) OVER () * 50000 AS chargeback_usd
FROM warehouse_metering_history
GROUP BY tag_team;
```

- A **proportional allocation model** (each team pays their share of measured usage) is the simplest, most defensible chargeback method — it requires accurate tagging as a hard prerequisite, which is why tag enforcement (covered above) has to come first.
- Some organizations instead use a **flat allocation plus overage model** (each team gets a baseline budget, pays a premium only above it) to avoid punishing teams for legitimate growth while still discouraging waste.

## 📊 FinOps Maturity Model

| Stage | Characteristics | Typical focus |
| --- | --- | --- |
| **Crawl** | Cost visibility exists but is manual/ad-hoc; tagging inconsistent; no regular review cadence | Get basic dashboards and tagging in place |
| **Walk** | Automated dashboards per team; budgets and alerts configured; showback is routine | Rightsizing, reserved capacity decisions, anomaly response |
| **Run** | Cost is a first-class input to architecture/design decisions; chargeback is standard; unit economics tracked | Continuous optimization, cost-aware CI checks, forecasting accuracy |

- Most data teams starting a FinOps practice are in **Crawl** — the highest-leverage early investment is consistent tagging and one shared dashboard, not sophisticated anomaly detection or chargeback modeling.
- Moving from Walk to Run is primarily a **cultural shift** (cost reviews become routine, engineers see cost impact of their own PRs) rather than a tooling upgrade — tooling alone doesn't move an org up the maturity curve.

## ⚠️ Common Gotchas

- **Auto-suspend set too aggressively causes warehouse "cold start" thrashing** — constant suspend/resume cycles on a warehouse hit every minute can cost more in resume overhead than leaving it running a bit longer; tune the idle timeout to actual query patterns.
- **`SELECT *` on partitioned/columnar tables defeats partition and column pruning** — in byte-scanned pricing models (BigQuery) this can be the single biggest avoidable cost driver in an organization.
- **Storage lifecycle policies applied too aggressively can break compliance/audit requirements** — check retention requirements before auto-expiring data, not after.
- **Reserved/committed-use discounts lock in a baseline** — over-committing on capacity you later don't need is its own form of waste; forecast conservatively before committing.
- **Tags are easy to skip and hard to retrofit** — without enforcement at resource-creation time (IaC policy, not tribal knowledge), tagging coverage decays within months.
- **Dev/test environments left running 24/7** are a classic, boring, and surprisingly large source of waste — auto-shutdown schedules are cheap insurance.
- **Materialized views and pre-aggregations reduce query-time cost but add their own storage + refresh compute cost** — measure net savings, don't assume they're free.

## 🎯 Best Practices

- Start with **Inform** (visibility/tagging) before trying to optimize blindly — you can't fix what you can't attribute.
- Set **budgets and resource monitors with alerting**, not just after-the-fact dashboards, so anomalies get caught within hours, not at month-end billing.
- Make **cost visible to the engineers who create it** — a query cost estimate in a PR, or a per-pipeline dashboard, changes behavior far more effectively than a central FinOps team policing spend after the fact.
- Default new **warehouses/clusters to conservative sizes with auto-suspend/auto-termination** enabled — make the cheap path the default, not an opt-in.
- Revisit **storage tiering and retention policies quarterly** — data growth is continuous, so "set once" policies decay in effectiveness.

## 💡 Pro Tips

1. **Dry-run/`EXPLAIN` before running unfamiliar large queries** — five seconds of estimation avoids five-figure accidental bills, especially in byte-scanned pricing models.
2. **Idle compute is the single most common waste category across every platform** — auto-suspend, auto-terminate, and scale-to-zero policies alone often capture the majority of achievable savings.
3. **Unit economics (cost per query/GB/user) tell a better story than aggregate totals** — a rising bill with falling cost-per-unit means the business is growing efficiently, not overspending.
4. **Compaction and file-size management pay off in both storage and compute cost** — small files are a "tax" that shows up on every downstream query scanning them.
5. **Treat cost anomaly alerts like production incidents** — fast triage (a runaway query, a misconfigured auto-scaling group) prevents small mistakes from becoming a bad month.
6. **Reserved capacity is a forecasting bet, not a default** — only commit once usage patterns are stable enough to model confidently.
