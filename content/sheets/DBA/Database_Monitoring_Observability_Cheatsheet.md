# Database Monitoring & Observability Cheatsheet

A DBA-focused reference for what to actually watch in MySQL and PostgreSQL: the metrics that predict incidents rather than just describing them, alert thresholds that avoid both noise and blind spots, and the built-in instrumentation each engine offers before reaching for a third-party tool.

> Verified against: **PostgreSQL 18**, **MySQL 8.4 LTS / 9.7**. This cheatsheet is the observability layer underneath the [Query Plan & Performance Tuning](Query_Plan_Performance_Tuning_Cheatsheet.md), [Replication & Failover](Replication_Failover_Cheatsheet.md), and [PostgreSQL Vacuuming & Maintenance](PostgreSQL_Vacuuming_Maintenance_Cheatsheet.md) cheatsheets — this file covers *how you'd notice* the problems those files explain how to fix.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Quick Reference Table](#2-quick-reference-table)
3. [The Golden Signals for a Database](#3-the-golden-signals-for-a-database)
4. [PostgreSQL Built-in Observability](#4-postgresql-built-in-observability)
5. [MySQL Built-in Observability](#5-mysql-built-in-observability)
6. [Connection & Lock Monitoring](#6-connection--lock-monitoring)
7. [Replication & Backup Monitoring](#7-replication--backup-monitoring)
8. [Capacity & Growth Monitoring](#8-capacity--growth-monitoring)
9. [Alerting Thresholds — Starting Points](#9-alerting-thresholds--starting-points)
10. [Third-Party Monitoring Stacks](#10-third-party-monitoring-stacks)
11. [Building a Useful Dashboard](#11-building-a-useful-dashboard)
12. [Prometheus Alerting Rules — Worked Examples](#12-prometheus-alerting-rules--worked-examples)
13. [Capacity Planning Projections — Worked Example](#13-capacity-planning-projections--worked-example)
14. [Worked Examples: Incident Investigations](#14-worked-examples-incident-investigations)
15. [Gotchas](#15-gotchas)

---

## 1. Core Concepts

| Concept | What it means |
|---|---|
| **Metric** | A numeric measurement sampled over time (connections in use, cache hit ratio, replication lag) — the basis for dashboards and alerting thresholds. |
| **Log** | A discrete, timestamped event record (a slow query, a failed login, a checkpoint completing) — richer detail per event than a metric, harder to aggregate at scale. |
| **Trace** | A record of a single request's path through a system, less commonly instrumented at the database layer itself but increasingly available via query tagging/correlation IDs threaded from the application. |
| **Leading vs. lagging indicator** | A leading indicator predicts a problem before it causes an outage (connection pool utilization trending toward saturation); a lagging indicator confirms the problem already happened (an actual connection-refused error). Good observability weights leading indicators heavily, precisely so alerts fire before user impact. |
| **Cache/buffer hit ratio** | The fraction of reads satisfied from memory (shared_buffers/InnoDB buffer pool) versus disk — a fundamental efficiency signal for both engines. |
| **Saturation** | How "full" a finite resource is (connections, disk, memory, I/O bandwidth) — one of the four "golden signals" (latency, traffic, errors, saturation) borrowed from general SRE practice and directly applicable to databases. |
| **Alert fatigue** | The failure mode where too many low-value alerts cause real ones to be ignored — as much a monitoring design problem as a technical one, and the main reason threshold choice (Section 9) matters as much as instrumentation coverage. |

---

## 2. Quick Reference Table

| I want to… | PostgreSQL | MySQL |
|---|---|---|
| See currently running queries | `SELECT * FROM pg_stat_activity;` | `SHOW PROCESSLIST;` / `performance_schema.processlist` |
| Find the slowest queries overall | `pg_stat_statements` (extension, near-universal in practice) | `performance_schema.events_statements_summary_by_digest` or the slow query log |
| Check cache/buffer hit ratio | Query `pg_stat_database` (`blks_hit` / (`blks_hit`+`blks_read`)) | `SHOW ENGINE INNODB STATUS\G` or `Innodb_buffer_pool_read_requests` / `Innodb_buffer_pool_reads` status vars |
| Check replication lag | `pg_stat_replication` (primary) / `pg_last_wal_replay_lsn()` (replica) | `SHOW REPLICA STATUS\G` → `Seconds_Behind_Source` |
| Check disk/table growth | `pg_total_relation_size()`, `pg_database_size()` | `information_schema.TABLES` (`DATA_LENGTH` + `INDEX_LENGTH`) |
| Check for blocking locks | Join `pg_locks` to `pg_stat_activity` | `performance_schema.data_lock_waits`, or `SHOW ENGINE INNODB STATUS\G` |
| See connections in use vs. max | `SELECT count(*) FROM pg_stat_activity;` vs. `max_connections` | `SHOW STATUS LIKE 'Threads_connected';` vs. `max_connections` |
| Check checkpoint/flush health | `pg_stat_bgwriter` | `SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_pages_flushed';` |
| Export metrics to a monitoring stack | `postgres_exporter` (Prometheus) | `mysqld_exporter` (Prometheus) |

---

## 3. The Golden Signals for a Database

Adapting the standard SRE "four golden signals" to the database layer:

| Signal | Database-specific examples |
|---|---|
| **Latency** | Query response time (p50/p95/p99, not just average — averages hide the tail latency that actually causes user-visible pain), connection setup time |
| **Traffic** | Queries per second, transactions per second, connections per second |
| **Errors** | Failed queries, deadlocks, connection refusals, replication errors, constraint violations at abnormal rates |
| **Saturation** | Connection pool utilization, buffer/cache hit ratio, disk space remaining, I/O queue depth, CPU/memory utilization, replication lag |

**p99 latency matters more than average latency for database health** — an average that looks fine can hide a subset of queries (often exactly the ones hitting a missing index or lock contention) that are badly degraded for a meaningful fraction of users; always track and alert on percentiles, not just means.

---

## 4. PostgreSQL Built-in Observability

| View/extension | What it shows |
|---|---|
| `pg_stat_activity` | Every current backend: state, query, wait event, transaction start time — the single most useful "what is happening right now" view |
| `pg_stat_statements` (extension, `shared_preload_libraries`) | Aggregated per-normalized-query statistics: total/mean/max time, calls, rows, shared-buffer hits — the foundation of almost all real-world PostgreSQL query performance work |
| `pg_stat_database` | Per-database counters: transactions committed/rolled back, blocks hit/read (cache ratio), deadlocks, temp file usage |
| `pg_stat_user_tables` / `pg_stat_user_indexes` | Per-table/index scan counts, tuple counts, vacuum/analyze history — see the Vacuuming cheatsheet for the maintenance-specific angle |
| `pg_stat_bgwriter` | Checkpoint frequency and background-writer activity — frequent forced checkpoints (rather than scheduled ones) signal `max_wal_size` is too small for the write volume |
| `pg_stat_replication` | Per-replica lag and state, from the primary's perspective |
| `pg_locks` | Every lock currently held or awaited, joinable to `pg_stat_activity` for human-readable blocking chains |
| `pg_stat_progress_vacuum` / `pg_stat_progress_analyze` / `pg_stat_progress_basebackup` | Live progress of long-running maintenance/backup operations |

```sql
-- Top 10 queries by total time (requires pg_stat_statements)
SELECT query, calls, total_exec_time, mean_exec_time, rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- Cache hit ratio — should generally be well above 99% for a healthy OLTP workload
SELECT sum(blks_hit) / GREATEST(sum(blks_hit) + sum(blks_read), 1)::float AS cache_hit_ratio
FROM pg_stat_database;
```

---

## 5. MySQL Built-in Observability

| Source | What it shows |
|---|---|
| `performance_schema` | The modern, low-overhead instrumentation framework (enabled by default since 5.7) — instruments statements, waits, stages, memory, and more, replacing older, coarser mechanisms |
| `sys` schema | A set of human-friendly views/functions built on top of `performance_schema` (e.g., `sys.statement_analysis`, `sys.schema_unused_indexes`, `sys.io_global_by_file_by_bytes`) — usually the fastest path to an answer without hand-writing `performance_schema` joins |
| Slow query log | File-based log of queries exceeding `long_query_time` — simple, reliable, but file-based (less queryable than `performance_schema` without an external log pipeline) |
| `SHOW ENGINE INNODB STATUS` | A large, semi-structured text dump of InnoDB internals: buffer pool stats, row lock waits, deadlock information (the *last* deadlock only), transaction list |
| `information_schema` | Metadata: table sizes, index definitions, foreign keys — combine with `performance_schema` for size + activity together |
| `SHOW GLOBAL STATUS` | The classic, still-relevant set of cumulative server counters (`Threads_connected`, `Innodb_buffer_pool_reads`, `Questions`, `Slow_queries`, ...) |

```sql
-- Top statements by total latency (requires performance_schema enabled, which is the default)
SELECT digest_text, count_star, sum_timer_wait/1000000000 AS total_ms
FROM performance_schema.events_statements_summary_by_digest
ORDER BY sum_timer_wait DESC
LIMIT 10;

-- Cache/buffer pool hit ratio
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read%';
-- hit ratio ≈ 1 - (Innodb_buffer_pool_reads / Innodb_buffer_pool_read_requests)
```

---

## 6. Connection & Lock Monitoring

- **Connection saturation is one of the most common, most preventable outage causes** — both engines have a hard `max_connections` ceiling; monitor `pg_stat_activity` count / `Threads_connected` as a percentage of that ceiling, and alert well before 100% (a connection pooler like PgBouncer or ProxySQL in front of the database is the standard fix for high connection churn, not simply raising `max_connections` indefinitely — each additional connection has real memory overhead).
- **Blocking chains**: a query waiting on a lock held by another query is normal and often brief; the problem is *long-held* locks that cascade into a growing queue of waiters. Both engines let you find the head of a blocking chain:
  ```sql
  -- PostgreSQL: who's blocking whom
  SELECT blocked.pid AS blocked_pid, blocked.query AS blocked_query,
         blocking.pid AS blocking_pid, blocking.query AS blocking_query
  FROM pg_locks bl
  JOIN pg_stat_activity blocked ON bl.pid = blocked.pid
  JOIN pg_locks kl ON kl.locktype = bl.locktype AND kl.database IS NOT DISTINCT FROM bl.database
       AND kl.relation IS NOT DISTINCT FROM bl.relation AND kl.pid != bl.pid AND kl.granted
  JOIN pg_stat_activity blocking ON kl.pid = blocking.pid
  WHERE NOT bl.granted;
  ```
  ```sql
  -- MySQL: performance_schema.data_lock_waits joined to processlist gives the equivalent
  SELECT * FROM performance_schema.data_lock_waits;
  ```
- **Deadlocks** should be logged and alerted on as a rate, not just individually — an occasional deadlock under real concurrency is often expected and self-resolving (the engine kills one transaction automatically); a *rising rate* of deadlocks signals an application-level locking-order problem worth fixing at the source.
- **Idle-in-transaction connections** (PostgreSQL: `state = 'idle in transaction'` in `pg_stat_activity`) are a frequent, easy-to-miss cause of both connection exhaustion and blocked vacuum progress (see the Vacuuming cheatsheet) — alert on their age, not just their existence.

---

## 7. Replication & Backup Monitoring

- **Replication lag** (Section 2's quick reference) should be monitored continuously with alerting thresholds tied to your actual RPO — see the Replication & Failover and High Availability & Disaster Recovery cheatsheets for the underlying mechanics.
- **Replication slot lag** (PostgreSQL) deserves its own alert distinct from "replica lag," because a slot can accumulate unbounded WAL on the primary even when no replica is actively falling behind on applying what it has received — monitor `pg_replication_slots.active` and the slot's retained WAL size directly.
- **Backup job success/failure** should alert on both outcomes — a failed backup job is obvious to alert on; a *silently stopped* backup schedule (the job simply didn't run) is easy to miss without an explicit "last successful backup was more than N hours ago" check, independent of whether any job actually failed.
- **Archive/WAL shipping failures** (a broken `archive_command`) fail silently by default in PostgreSQL and pile up in `pg_wal/` — monitor both "is archiving succeeding" and "how much WAL is currently unarchived," not just backup completion.

---

## 8. Capacity & Growth Monitoring

| What to track | Why |
|---|---|
| Table/index size growth rate | Predicts disk exhaustion before it happens, and flags unexpectedly fast-growing tables that may need retention/archival policies |
| Connection count trend over time | Distinguishes a genuine traffic-growth capacity need from a connection leak in application code |
| Query volume (QPS/TPS) trend | Baseline for capacity planning and for detecting anomalies (a sudden spike can be legitimate growth or a runaway job/bug) |
| Buffer pool / shared_buffers hit ratio trend | A *declining* trend over weeks/months, even without a single bad day, signals the working set has outgrown available cache and a memory increase (or query/index optimization) is due |
| Disk I/O utilization and queue depth | Leading indicator of storage becoming the bottleneck before latency visibly degrades |
| Transaction ID age (PostgreSQL) | See the Vacuuming cheatsheet — this is a capacity-adjacent metric in the sense that it's a slow-building risk that needs monitoring well before it becomes an emergency |

Track these as trends over weeks/months, not just instantaneous values — a dashboard that only shows "right now" catches active incidents but misses the slow-building problems (disk filling up over three weeks, cache ratio eroding over a quarter) that are far cheaper to address early.

---

## 9. Alerting Thresholds — Starting Points

These are reasonable starting points to tune against your own workload's actual baseline, not universal constants:

| Metric | Warning | Critical |
|---|---|---|
| Connection utilization | >70% of `max_connections` | >90% |
| Replication lag | > a few seconds above your steady-state baseline | > your documented RPO |
| Cache/buffer hit ratio | Below ~95% sustained (varies a lot by workload — a reporting/analytics DB scanning huge tables will legitimately run lower) | Below ~90% sustained |
| Disk space remaining | <20% free | <10% free |
| Replication slot retained WAL | Growing steadily over hours with no corresponding replica progress | Approaching a size that threatens disk capacity |
| Long-running/idle-in-transaction sessions | Present for more than a few minutes past your normal query duration | Present for tens of minutes, actively blocking vacuum or other sessions |
| Deadlock rate | Any sustained increase over baseline | A rate high enough to be visibly affecting application error rates |
| Backup freshness | Last successful backup older than expected cadence + a grace period | Last successful backup older than your documented RPO tolerance |

**Tune every threshold against your own historical baseline** rather than a generic number pulled from a cheatsheet (including this one) — a workload that normally runs at 85% cache hit ratio because it's genuinely analytics-heavy shouldn't page on a threshold copied from an OLTP-tuned example.

---

## 10. Third-Party Monitoring Stacks

| Stack | Approach |
|---|---|
| **Prometheus + Grafana + `postgres_exporter`/`mysqld_exporter`** | The most common open-source combination — exporters translate engine-native stats into Prometheus metrics, Grafana visualizes and alerts | 
| **Percona Monitoring and Management (PMM)** | Purpose-built for MySQL/PostgreSQL/MongoDB, ships pre-built dashboards and query analytics out of the box, lower setup effort than assembling Prometheus/Grafana from scratch |
| **Datadog / New Relic / commercial APM** | Broader application-plus-infrastructure observability with database-specific integrations — usually the right call when the organization already standardizes on one of these for everything else, rather than running a database-only stack in isolation |
| **Cloud-native (CloudWatch, Cloud Monitoring, Azure Monitor)** | The default for managed database services — convenient and pre-wired, but often shallower than engine-native instrumentation (e.g., may not expose full `pg_stat_statements`/`performance_schema` detail) |

**Whatever stack you choose, make sure engine-native views (`pg_stat_statements`, `performance_schema`) are still queryable directly** — a monitoring stack's dashboards are a summarized view for humans, but ad-hoc incident investigation often needs to go straight to the source views this cheatsheet lists, not just whatever the dashboard chose to surface.

---

## 11. Building a Useful Dashboard

A good first-page database dashboard, regardless of stack, generally covers:

1. **Connections**: current count vs. max, trend over the last 24h
2. **Query latency**: p50/p95/p99 over time, not just an average
3. **Throughput**: queries/transactions per second
4. **Cache hit ratio**: trend, not just current value
5. **Replication lag**: per-replica, with the worst-lagging replica highlighted
6. **Disk space and growth rate**: remaining capacity and days-until-full at current growth rate
7. **Top queries by total time**: a live link into `pg_stat_statements`/`performance_schema` rather than a static list, so investigation during an incident starts from the dashboard rather than a fresh query
8. **Lock waits/blocking sessions**: current count, and a drill-down into the blocking chain

Resist the urge to put everything on one dashboard — a second, deeper dashboard per concern (replication detail, per-table maintenance status, backup history) keeps the primary "is everything okay right now" view fast to read during an actual incident.

---

## 12. Prometheus Alerting Rules — Worked Examples

Concrete `postgres_exporter`/`mysqld_exporter` alert definitions, tuned to the thresholds from Section 9:

```yaml
groups:
  - name: postgresql_alerts
    rules:
      - alert: PostgreSQLConnectionsHigh
        expr: sum(pg_stat_activity_count) / pg_settings_max_connections > 0.7
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "Connection usage above 70% on {{ $labels.instance }}"

      - alert: PostgreSQLConnectionsCritical
        expr: sum(pg_stat_activity_count) / pg_settings_max_connections > 0.9
        for: 2m
        labels: { severity: critical }
        annotations:
          summary: "Connection usage above 90% on {{ $labels.instance }} — imminent connection exhaustion"

      - alert: PostgreSQLReplicationLagHigh
        expr: pg_replication_lag_seconds > 30
        for: 3m
        labels: { severity: warning }
        annotations:
          summary: "Replica {{ $labels.instance }} lagging {{ $value }}s behind primary"

      - alert: PostgreSQLLowCacheHitRatio
        expr: |
          rate(pg_stat_database_blks_hit[10m]) /
          (rate(pg_stat_database_blks_hit[10m]) + rate(pg_stat_database_blks_read[10m])) < 0.90
        for: 15m
        labels: { severity: warning }
        annotations:
          summary: "Cache hit ratio below 90% on {{ $labels.instance }} — sustained over 15m"

      - alert: PostgreSQLIdleInTransactionTooLong
        expr: max(pg_stat_activity_max_tx_duration{state="idle in transaction"}) > 300
        for: 1m
        labels: { severity: warning }
        annotations:
          summary: "Idle-in-transaction session open for over 5 minutes — risk of blocking vacuum"

      - alert: PostgreSQLBackupStale
        expr: time() - pg_backup_last_success_timestamp > 90000   # 25h — grace period over a 24h cadence
        for: 5m
        labels: { severity: critical }
        annotations:
          summary: "No successful backup in over 25 hours on {{ $labels.instance }}"
```

**Design choices worth noting**: the `for:` duration on each rule (requiring the condition to hold for a sustained period before firing) is deliberate — it filters out momentary blips that would otherwise cause the alert-fatigue problem discussed in Section 9/Gotchas, while still catching genuinely sustained problems quickly. The backup-staleness alert is a *rate-based absence* check (Section 7's "silent failure" pattern) rather than depending on the backup job explicitly reporting failure — it fires even if the backup job stopped running entirely and never reported anything at all.

---

## 13. Capacity Planning Projections — Worked Example

Turning the growth-trend metrics from Section 8 into an actual forward projection:

```sql
-- PostgreSQL: table growth rate over the trailing 30 days, requires periodic size snapshots
-- (captured via a scheduled job writing pg_total_relation_size() to a tracking table)
SELECT
  date_trunc('day', captured_at) AS day,
  pg_size_pretty(size_bytes) AS size,
  size_bytes - lag(size_bytes) OVER (ORDER BY captured_at) AS daily_growth_bytes
FROM table_size_history
WHERE table_name = 'events'
ORDER BY captured_at DESC
LIMIT 30;
```

**Worked projection**: the `events` table has grown from 210 GB to 267 GB over the trailing 30 days — an average of ~1.9 GB/day. The underlying disk volume has 800 GB total capacity with 340 GB currently free.

1. **Naive linear projection**: 340 GB free ÷ 1.9 GB/day ≈ 179 days until this single table exhausts current free space — assuming linear growth and no other tables/WAL/indexes also growing concurrently (a simplification worth stating explicitly, not silently assuming).
2. **Accounting for other growth**: total disk usage (all tables, indexes, WAL) has actually grown by ~3.4 GB/day over the same window — using the *total* growth rate against total free space gives a more honest ≈100 days until exhaustion, a meaningfully shorter runway than looking at one table in isolation.
3. **Action threshold**: setting a capacity-planning trigger at "act when projected exhaustion is under 60 days" means this system should already have a disk-expansion or archival/partitioning project underway now, not in 100 days — the whole point of projecting forward is to convert a slow-building problem into a scheduled, unhurried piece of work instead of an emergency.
4. **Non-linear risk factors to flag alongside the projection**: is growth actually linear, or accelerating (a growing user base, a new feature generating more rows per day than six months ago)? A projection built on a 30-day trailing average during a period of accelerating growth will underestimate how soon the real exhaustion date arrives — re-run the projection regularly rather than trusting a single calculation indefinitely.

---

## 14. Worked Examples: Incident Investigations

### Example 1 — "The database is slow" turns out to be a connection pooler problem
A team gets reports of intermittent slow page loads. Database-native dashboards (query latency, cache hit ratio, replication lag) all look completely normal throughout the incident window.
1. **The gap Section 6's gotcha describes**: nothing in the database's own metrics is wrong, because the problem isn't in the database.
2. Checking the PgBouncer layer in front of the database (which the team hadn't been monitoring at all) reveals `pool_size` has been maxed out, with client connections queueing for an available backend connection — the application's connection pool configuration was recently changed to open more concurrent connections per instance than PgBouncer's pool was sized to handle after a recent horizontal-scaling change to the application tier.
3. Fix: resize PgBouncer's `pool_size` and `max_client_conn` to match the application's actual new connection concurrency, and add PgBouncer's own metrics (`pgbouncer_pools_client_waiting`, average wait time) to the primary dashboard going forward.
4. **Structural fix**: this becomes the concrete justification for adding "monitor the pooler, not just the database" as a standing item in the dashboard-review checklist (Section 11), specifically because this exact blind spot had just cost real investigation time.

### Example 2 — A capacity alert catches a runaway table before it becomes an outage
The capacity-projection job (Section 13) flags that a `sessions` table's growth rate has tripled week-over-week, on pace to exhaust disk in 12 days instead of its usual multi-month runway.
1. Investigation via `pg_stat_user_tables` shows `sessions` insert volume has genuinely tripled — cross-referencing with a recent deploy log shows a new feature launched five days ago that creates a session row per API call instead of per user login, a much higher-frequency event than the original design assumed.
2. Immediate mitigation: the on-call engineer buys time with `pg_repack`-free options first — checking whether old session rows are being cleaned up at all reveals a missing cleanup job (sessions were meant to expire and be deleted after 24 hours, but the cleanup cron job had silently stopped running weeks earlier, unrelated to the new feature — a second latent problem the projection incidentally surfaced).
3. Fixes: restore the session-cleanup job, and separately, the new feature's session-creation pattern is revisited by the application team once they see the actual growth-rate data — a concrete case of monitoring data changing a product/engineering decision, not just informing an infrastructure response.
4. **Why this counts as the system working as intended**: nothing here was a page-in-the-night incident — the growth was caught by a proactive capacity projection with a two-week runway, giving time for calm investigation and a real fix rather than an emergency disk expansion under pressure, which is exactly the value proactive capacity monitoring (Section 8) is meant to provide over purely reactive alerting.

---

## 15. Gotchas

- **Average latency hides the problem that actually pages people** — always track p95/p99 alongside (or instead of) the mean; a mean that looks perfectly healthy can coexist with a meaningful fraction of requests timing out.
- **`pg_stat_statements` and `performance_schema` both reset on server restart** (and `pg_stat_statements` can be reset manually) — a dashboard or alert based on cumulative counters needs to account for resets, or use rate-of-change queries rather than raw cumulative values.
- **A "healthy" cache hit ratio is workload-dependent, not a universal number** — an analytics workload scanning large tables will legitimately show a lower ratio than an OLTP workload with a small hot working set; alert on deviation from *that workload's own baseline*, not a generic industry number.
- **Monitoring the database without monitoring the connection pooler in front of it misses an entire failure class** — a pooler that's exhausted its own connection limit, or misconfigured to route to a dead replica, looks like "the database is fine" from inside the database's own metrics.
- **Silent failures are more dangerous than loud ones** — a backup job that stops running, an `archive_command` that's been failing for days, a replication slot slowly filling disk: none of these throw an obvious "error" in the way a crashed process does, and all three need an explicit "this hasn't happened recently enough" check rather than only alerting on explicit failure events.
- **Alert fatigue from too-sensitive thresholds trains people to ignore pages** — it is better to have fewer, well-tuned alerts that reliably indicate real problems than comprehensive coverage that pages constantly for noise; iterate thresholds based on actual false-positive rate, not just theoretical coverage.
- **Dashboards go stale as the schema/workload evolves** — a dashboard built around last year's top-10 slow queries doesn't automatically surface this year's new problem query; periodically revisit what's actually being watched, not just whether the dashboard still loads.
