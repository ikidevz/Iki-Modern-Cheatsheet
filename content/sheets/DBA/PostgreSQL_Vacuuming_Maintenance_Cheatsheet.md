# PostgreSQL Vacuuming & Maintenance Cheatsheet

A DBA-focused reference for PostgreSQL's MVCC-driven maintenance model: why vacuuming exists at all, autovacuum tuning, bloat detection/management, and the routine upkeep tasks that keep a cluster healthy long-term.

> Verified against: **PostgreSQL 18** — the async I/O subsystem introduced in PG 18 measurably speeds up vacuum's I/O-bound phases, and PG 17's autovacuum improvements (memory structure changes reducing overhead on large tables) are both confirmed via web search since they postdate most training data.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Quick Reference Table](#2-quick-reference-table)
3. [Why Vacuum Exists: MVCC and Dead Tuples](#3-why-vacuum-exists-mvcc-and-dead-tuples)
4. [Autovacuum: How It Works](#4-autovacuum-how-it-works)
5. [Autovacuum Tuning Parameters](#5-autovacuum-tuning-parameters)
6. [Per-Table Autovacuum Overrides](#6-per-table-autovacuum-overrides)
7. [Bloat: Detection & Management](#7-bloat-detection--management)
8. [Transaction ID (XID) Wraparound](#8-transaction-id-xid-wraparound)
9. [VACUUM FULL vs. pg_repack](#9-vacuum-full-vs-pg_repack)
10. [ANALYZE & Statistics Maintenance](#10-analyze--statistics-maintenance)
11. [Routine Maintenance Checklist](#11-routine-maintenance-checklist)
12. [Monitoring Queries](#12-monitoring-queries)
13. [TOAST Tables & Partitioned-Table Vacuuming](#13-toast-tables--partitioned-table-vacuuming)
14. [Scheduling Maintenance with pg_cron](#14-scheduling-maintenance-with-pg_cron)
15. [Worked Examples](#15-worked-examples)
16. [Gotchas](#16-gotchas)

---

## 1. Core Concepts

| Concept | What it means |
|---|---|
| **MVCC (Multi-Version Concurrency Control)** | PostgreSQL never overwrites a row in place on `UPDATE`; it writes a whole new row version and marks the old one as expired but leaves it physically in place, so concurrent readers can still see a consistent snapshot. |
| **Dead tuple** | An old row version left behind after `UPDATE`/`DELETE` that is no longer visible to any current or future transaction — physically still consuming disk space until vacuum reclaims it. |
| **VACUUM** | The process that scans a table, identifies dead tuples no longer visible to any transaction, and marks their space as reusable by future inserts/updates — it does **not** shrink the file on disk (that's what `VACUUM FULL` is for). |
| **Autovacuum** | A background daemon that runs `VACUUM` and `ANALYZE` automatically per-table based on activity thresholds, so DBAs don't have to schedule it manually — the default, and correct, approach for the vast majority of workloads. |
| **Bloat** | Disk space consumed by dead tuples (table bloat) or by out-of-date index entries pointing at dead tuples (index bloat) that vacuum hasn't yet reclaimed or reused — bloat degrades both storage efficiency and query performance (more pages to scan for the same live data). |
| **Freezing** | Marking old row versions with a special "frozen" transaction ID so PostgreSQL's 32-bit transaction ID counter can safely wrap around without those old rows appearing to be from "the future." This is what prevents wraparound data loss. |
| **Visibility map** | A per-table bitmap tracking which pages contain only tuples visible to every transaction — lets vacuum (and index-only scans) skip pages that don't need attention, dramatically speeding up subsequent vacuums. |
| **Free Space Map (FSM)** | Tracks pages with reusable free space so future inserts/updates can reuse it instead of extending the file — maintained automatically by vacuum. |

---

## 2. Quick Reference Table

| I want to… | Command |
|---|---|
| Manually vacuum one table | `VACUUM tablename;` |
| Vacuum and update planner statistics together | `VACUUM ANALYZE tablename;` |
| Vacuum and reclaim disk space back to the OS (locks the table) | `VACUUM FULL tablename;` |
| See per-table dead tuple counts | `SELECT relname, n_dead_tup, n_live_tup FROM pg_stat_user_tables ORDER BY n_dead_tup DESC;` |
| See when a table was last vacuumed/analyzed | `SELECT relname, last_vacuum, last_autovacuum, last_analyze, last_autoanalyze FROM pg_stat_user_tables;` |
| Check transaction ID age (wraparound risk) | `SELECT relname, age(relfrozenxid) FROM pg_class ORDER BY age(relfrozenxid) DESC;` |
| Estimate table/index bloat | `pgstattuple` extension, or community bloat-estimate queries (no exact built-in bloat number exists) |
| Rebuild a table without a long exclusive lock | `pg_repack` (external extension) |
| Disable autovacuum for one table (rare, use with care) | `ALTER TABLE t SET (autovacuum_enabled = false);` |
| Force an immediate autovacuum-equivalent run | `VACUUM (VERBOSE, ANALYZE) tablename;` |
| Kill a stuck vacuum | `SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE query LIKE 'autovacuum%' AND pid = ...;` |

---

## 3. Why Vacuum Exists: MVCC and Dead Tuples

```
UPDATE orders SET status = 'shipped' WHERE id = 42;
```
Under MVCC, this does **not** modify the existing row in place. It:
1. Writes a brand-new row version with `status = 'shipped'`.
2. Marks the old row version's `xmax` (the transaction ID that expired it) so it's invisible to any transaction starting after this commit.
3. Leaves the old row version physically on disk — it's still needed by any transaction that started *before* this update and hasn't finished yet (MVCC snapshot isolation).

Every `UPDATE` and `DELETE` therefore *adds* dead tuples rather than freeing space immediately. Without vacuum, a table under sustained update/delete load grows without bound even though its "live" row count stays flat — this is the entire reason autovacuum exists, and it's a direct, unavoidable consequence of how MVCC provides concurrency without locking readers against writers.

---

## 4. Autovacuum: How It Works

- A launcher process periodically checks every table against its vacuum/analyze thresholds and spawns worker processes (`autovacuum_max_workers`, default 3) to handle the tables that need it.
- **Vacuum threshold formula**: a table is vacuumed when `dead tuples > autovacuum_vacuum_threshold + (autovacuum_vacuum_scale_factor × total rows)`. With defaults (threshold 50, scale factor 0.2), a 1-million-row table gets vacuumed once it accumulates roughly 200,050 dead tuples.
- **Analyze threshold formula** is the same shape, with its own threshold/scale-factor pair (`autovacuum_analyze_threshold`, `autovacuum_analyze_scale_factor`, defaults 50 and 0.1).
- **The default scale factor (0.2) doesn't scale well to huge tables**: on a 500-million-row table, 20% means autovacuum won't trigger until ~100 million dead tuples have accumulated — by then, both bloat and the vacuum's own runtime are enormous. This is the single most common reason large, high-churn tables need per-table overrides (Section 6).
- **Cost-based vacuum throttling** (`autovacuum_vacuum_cost_delay`, `autovacuum_vacuum_cost_limit`) intentionally paces vacuum's I/O so it doesn't starve foreground query traffic — the trade-off is that a throttled vacuum takes longer to finish, which matters if the table is racing toward wraparound.
- **PostgreSQL 18's async I/O subsystem** speeds up vacuum's page-reading phase measurably by issuing multiple concurrent I/O requests instead of the previous mostly-sequential pattern — the practical effect is shorter vacuum runtimes on I/O-bound workloads without any config change required, though realized gains depend heavily on storage type.

---

## 5. Autovacuum Tuning Parameters

| Parameter | Default | What it controls |
|---|---|---|
| `autovacuum` | `on` | Master on/off switch — leave on; disabling it entirely and vacuuming manually is a common and dangerous anti-pattern |
| `autovacuum_max_workers` | 3 | Concurrent autovacuum worker processes cluster-wide — too low means large clusters with many active tables queue up behind each other |
| `autovacuum_naptime` | 1min | How often the launcher wakes up to check thresholds |
| `autovacuum_vacuum_scale_factor` | 0.2 | Fraction of table size (in dead tuples) that triggers a vacuum — the parameter most worth lowering for large tables |
| `autovacuum_vacuum_threshold` | 50 | Flat dead-tuple count added to the scale-factor calculation — mostly matters for small tables |
| `autovacuum_analyze_scale_factor` | 0.1 | Same idea, for triggering `ANALYZE` (statistics refresh) instead of vacuum |
| `autovacuum_vacuum_cost_delay` | 2ms (as of PG 12+) | Pause inserted between I/O-throttled vacuum work batches |
| `autovacuum_vacuum_cost_limit` | 200 | "Cost budget" consumed before an autovacuum worker pauses for `cost_delay` — raising this (or the related `vacuum_cost_limit`) lets vacuum work faster at the expense of more I/O contention with foreground queries |
| `autovacuum_freeze_max_age` | 200,000,000 | Transaction-ID age at which autovacuum is forced to run an aggressive freeze pass regardless of dead-tuple thresholds — the backstop against wraparound (Section 8) |
| `maintenance_work_mem` | 64MB | Memory available to vacuum (and `CREATE INDEX`, `ALTER TABLE`) for building its list of dead tuple locations — too low forces vacuum into multiple passes over large tables, dramatically slowing it down |

**Common production tuning pattern**: raise `autovacuum_max_workers` and `maintenance_work_mem` cluster-wide, then apply lower scale factors and higher cost limits on a per-table basis (Section 6) to the specific large/high-churn tables that need more aggressive treatment, rather than globally lowering scale factors for every table in the cluster.

---

## 6. Per-Table Autovacuum Overrides

```sql
ALTER TABLE events SET (
  autovacuum_vacuum_scale_factor = 0.01,   -- vacuum at 1% dead tuples instead of 20%
  autovacuum_vacuum_cost_limit = 1000,     -- let it work faster once triggered
  autovacuum_analyze_scale_factor = 0.02
);
```
- Large, high-churn tables (event logs, queue tables, session tables) are the classic candidates for aggressive per-table overrides — a 0.2 scale factor on a table with millions of rows and constant updates means enormous, rarely-triggered vacuums instead of small, frequent ones.
- **Insert-only or insert-mostly tables** benefit from `autovacuum_vacuum_insert_scale_factor`/`autovacuum_vacuum_insert_threshold` (added in PG 13) — these trigger vacuum based on *insert* volume, not just dead tuples, which matters because inserts alone don't create dead tuples but do need the visibility map updated for index-only scans to stay efficient.
- A table you're about to bulk-load can have autovacuum temporarily disabled (`autovacuum_enabled = false`) during the load and a manual `VACUUM ANALYZE` run immediately after — re-enable it afterward; leaving it permanently off is the anti-pattern in Section 13.

---

## 7. Bloat: Detection & Management

- **PostgreSQL has no exact built-in "bloat %" number** — `n_dead_tup` in `pg_stat_user_tables` gives a live estimate, but for a precise measurement install the `pgstattuple` extension:
  ```sql
  CREATE EXTENSION pgstattuple;
  SELECT * FROM pgstattuple('orders');
  -- dead_tuple_percent, free_percent, tuple_percent give the real picture
  ```
- **Index bloat** is a separate, equally real problem — a B-tree index accumulates dead entries the same way tables accumulate dead tuples, and `REINDEX` (or `pg_repack`'s index-rebuild mode) is the fix, not `VACUUM` alone (regular vacuum does reclaim some index space, but heavily bloated indexes usually need a rebuild).
- **Common bloat causes**: a long-running transaction (or an idle-in-transaction session) holding back the oldest visible snapshot, preventing vacuum from reclaiming tuples newer than it — this is a frequent, easy-to-miss root cause worth checking first before assuming autovacuum tuning is the problem.
- **Symptoms of significant bloat**: sequential scans taking noticeably longer than the live row count would suggest, index scans doing extra work to skip dead entries, and disk usage growing faster than actual data volume.

---

## 8. Transaction ID (XID) Wraparound

- PostgreSQL transaction IDs are 32-bit and wrap around after ~4.29 billion transactions. Every row is stamped with the XID of the transaction that created it; without periodic freezing, an old row's XID could eventually appear to be "in the future" relative to a wrapped-around counter, making it invisible — a catastrophic, silent data-loss scenario.
- **Freezing** rewrites a row's visibility metadata to a special `FrozenTransactionId` so it's permanently visible regardless of counter wraparound. Regular vacuum freezes opportunistically; `autovacuum_freeze_max_age` (default 200 million) forces an aggressive freeze pass on any table whose oldest unfrozen XID gets that old, specifically to guarantee this never gets missed.
- **Emergency backstop**: if a table's XID age approaches `autovacuum_freeze_max_age × 2` (roughly), PostgreSQL starts throwing increasingly urgent warnings, and if age approaches ~2 billion, it will refuse new writes to protect against wraparound entirely — at that point it's an active incident, not routine maintenance.
- **Monitor proactively**, don't wait for the warnings:
  ```sql
  SELECT relname, age(relfrozenxid) AS xid_age
  FROM pg_class
  WHERE relkind = 'r'
  ORDER BY xid_age DESC LIMIT 20;
  ```
- **The most common cause of wraparound emergencies** is a table where autovacuum was disabled (manually, or effectively disabled by a permanently-open long-running transaction) and nobody noticed for months.

---

## 9. VACUUM FULL vs. pg_repack

| | `VACUUM FULL` | `pg_repack` |
|---|---|---|
| **Locking** | Takes an `ACCESS EXCLUSIVE` lock for the entire operation — blocks all reads and writes | Uses a brief exclusive lock only at the start/end; the bulk of the rewrite happens concurrently with normal traffic |
| **Mechanism** | Rewrites the entire table into a new file, then swaps it in | Creates a new table, copies rows over while logging concurrent changes via triggers, then swaps |
| **When to use** | Small tables, or maintenance windows where downtime is acceptable | Large, actively-used tables where an exclusive lock for the whole rewrite is unacceptable |
| **Disk space needed** | Roughly 2x the table's live data size during the operation | Similar, roughly 2x, since it also builds a full second copy |
| **Built-in?** | Yes, no extension needed | No — external extension, must be installed separately |

**Neither is a routine tool** — both are for addressing bloat that's already accumulated (or reclaiming disk space back to the OS, since regular `VACUUM` never shrinks the file), not something to schedule as ordinary maintenance. Fix the underlying autovacuum tuning first; reach for `VACUUM FULL`/`pg_repack` for a one-time cleanup of a table that got badly bloated before tuning caught up.

---

## 10. ANALYZE & Statistics Maintenance

- `ANALYZE` (run automatically as part of autovacuum, per Section 4's threshold formula) samples table rows and updates `pg_statistic` — this is what feeds the query planner's cardinality estimates (see the Query Plan & Performance Tuning cheatsheet).
- **A table can be perfectly vacuumed but still have terrible query plans** if its statistics are stale — vacuum and analyze are related but distinct maintenance concerns, and `VACUUM ANALYZE` runs both together for exactly this reason.
- **Run `ANALYZE` manually right after any bulk load, bulk update, or restore** — autovacuum's analyze threshold may not trigger soon enough after a sudden, large distributional shift, and the planner will make bad decisions in the meantime.
- `default_statistics_target` (default 100) controls sampling depth; skewed or high-cardinality columns used heavily in `WHERE` clauses often benefit from a higher per-column target via `ALTER TABLE ... ALTER COLUMN ... SET STATISTICS n`.

---

## 11. Routine Maintenance Checklist

**Daily/automatic (autovacuum's job, verify it's actually keeping up):**
- Dead tuple ratios staying within expected bounds per table
- No table's transaction ID age climbing unbounded
- Autovacuum workers not perpetually busy/queued (a sign `autovacuum_max_workers` is too low for the workload)

**Weekly:**
- Review `pg_stat_user_tables` for tables with `last_autovacuum` older than expected given their write volume
- Check for long-running/idle-in-transaction sessions that could be blocking vacuum progress
- Review slow-growing vs. fast-growing tables and revisit per-table overrides accordingly

**Monthly/quarterly:**
- Run `pgstattuple` on the largest/most bloat-prone tables to get an exact bloat percentage rather than relying on estimates
- Reassess `autovacuum_vacuum_scale_factor` overrides as table sizes grow — a setting tuned for a 10M-row table may be wrong once it's 100M rows
- Confirm backup/WAL retention still comfortably covers your actual autovacuum and freeze cadence (a very long-delayed freeze pass on a huge table can itself take a long time, which interacts with WAL volume and backup windows)

---

## 12. Monitoring Queries

```sql
-- Tables most in need of attention right now
SELECT relname, n_live_tup, n_dead_tup,
       round(n_dead_tup::numeric / GREATEST(n_live_tup,1) * 100, 1) AS dead_pct,
       last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 20;

-- Transaction ID wraparound risk, cluster-wide
SELECT relname, age(relfrozenxid) AS xid_age
FROM pg_class
WHERE relkind = 'r'
ORDER BY xid_age DESC
LIMIT 20;

-- Currently running vacuum/autovacuum processes and their progress
SELECT pid, relid::regclass, phase, heap_blks_total, heap_blks_scanned, heap_blks_vacuumed
FROM pg_stat_progress_vacuum;

-- Long-running/idle-in-transaction sessions that could be blocking vacuum
SELECT pid, state, now() - xact_start AS xact_age, query
FROM pg_stat_activity
WHERE state != 'idle' AND xact_start IS NOT NULL
ORDER BY xact_age DESC;
```

---

## 13. TOAST Tables & Partitioned-Table Vacuuming

**TOAST (The Oversized-Attribute Storage Technique)** is PostgreSQL's mechanism for storing large column values (long text, JSONB, bytea) out-of-line from the main table row, in a companion table.

- **Every table with a potentially-large column gets an automatically-created, hidden TOAST table** (`pg_toast.pg_toast_<oid>`) — it does not show up in `pg_stat_user_tables` under a friendly name, which is exactly why it's easy to overlook when reviewing vacuum health.
- **TOAST tables need vacuuming independently**, and they have their own `n_dead_tup`/`n_live_tup`/`relfrozenxid` — a table full of frequently-updated large JSONB columns can have a perfectly healthy-looking main table while its TOAST table quietly bloats or drifts toward wraparound risk unnoticed.
- **Find a table's TOAST table explicitly**:
  ```sql
  SELECT relname AS main_table, reltoastrelid::regclass AS toast_table
  FROM pg_class
  WHERE relname = 'events' AND relkind = 'r';
  ```
- **TOAST-specific autovacuum overrides** use the `toast.` prefix: `ALTER TABLE events SET (toast.autovacuum_vacuum_scale_factor = 0.01);` — worth setting explicitly on any table with large, frequently-updated TOASTed columns, using the same reasoning as Section 6's per-table overrides for the main table.

**Partitioned tables** add a structural wrinkle: the parent table itself typically holds zero rows (all data lives in child partitions), so autovacuum activity is entirely a per-partition concern.

- **Each partition is vacuumed and analyzed independently**, on its own thresholds — a scale-factor override applied to the parent via `ALTER TABLE parent_table SET (...)` does **not** cascade to existing child partitions; it only affects the parent's own (typically empty) storage.
- **The correct pattern for consistent overrides across partitions**: apply the `ALTER TABLE ... SET (...)` to each partition individually (scriptable via a loop over `pg_inherits`), or set the override in a partition-creation template/trigger so every new partition inherits it automatically rather than relying on someone remembering to set it by hand each time.
- **Old, cold partitions still count toward XID wraparound risk** even if they receive zero new writes — a partition holding 2019 data that nobody queries anymore still needs periodic freezing, since its `relfrozenxid` age climbs at the same cluster-wide transaction-ID rate as every other table, not based on its own activity level. `autovacuum_freeze_max_age` will eventually force a freeze pass on it regardless of how "cold" it looks operationally.
- **Detached/archived partitions** (via `ALTER TABLE ... DETACH PARTITION`) stop being vacuumed as part of the partitioned table's automatic maintenance the moment they're detached — if a detached partition is kept around as a standalone table rather than dropped, it needs its own ongoing vacuum/freeze attention like any regular table, which is easy to forget once it's "just an old partition sitting there."

---

## 14. Scheduling Maintenance with pg_cron

While autovacuum should handle routine vacuum/analyze automatically, some maintenance tasks genuinely benefit from explicit scheduling — off-peak `VACUUM FULL`/`REINDEX` windows, `ANALYZE` right after known bulk-load times, or `pg_repack` runs.

```sql
CREATE EXTENSION pg_cron;

-- Nightly ANALYZE on a table that gets a large batch import every evening
SELECT cron.schedule('nightly-analyze-events', '15 2 * * *', 'ANALYZE events;');

-- Weekly REINDEX CONCURRENTLY on a known bloat-prone index, off-peak
SELECT cron.schedule('weekly-reindex-orders-idx', '0 3 * * 0',
  'REINDEX INDEX CONCURRENTLY idx_orders_status;');

-- Review scheduled jobs and recent run history
SELECT * FROM cron.job;
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```
- **`pg_cron` runs inside the database itself** (as a background worker), which means scheduled jobs survive independently of any external cron/scheduler infrastructure and are visible/auditable via ordinary SQL — a meaningful operational advantage over an OS-level cron job calling `psql` scripts, which is invisible from inside the database and easy to lose track of during a host migration.
- **`REINDEX CONCURRENTLY`** (available since PG 12) avoids the exclusive lock a plain `REINDEX` takes, at the cost of taking longer and requiring roughly double the disk space during the rebuild — the standard choice for reindexing a table that must stay available, same trade-off shape as `pg_repack` vs. `VACUUM FULL` in Section 9.
- **Don't use `pg_cron` to replace autovacuum's routine job** — it's for the explicit, deliberate maintenance operations (full reindexes, forced analyzes after known bulk events, `pg_repack` runs) that autovacuum doesn't cover, not a substitute for the automatic dead-tuple vacuuming autovacuum already handles well.
- **Alert on job failures**, not just successes — `cron.job_run_details.status` should be checked by monitoring (see the Monitoring & Observability cheatsheet), since a silently-failing scheduled maintenance job is exactly the kind of "nothing obviously broke, but the safety net quietly stopped working" failure mode that's hardest to catch without deliberate alerting.

---

## 15. Worked Examples

### Example 1 — Tuning a high-churn queue table from first principles
A `job_queue` table holds ~200,000 rows at any given time; jobs are inserted, updated to `processing`, then updated to `done` and deleted within minutes — meaning the table sees roughly 2 million update/delete operations per day against a comparatively small row count.
1. **Symptom**: query latency against `job_queue` has been creeping up over several weeks; `SELECT * FROM pg_stat_user_tables WHERE relname = 'job_queue';` shows `n_dead_tup` frequently sitting above 500,000 — more dead tuples than live rows.
2. **Diagnosis**: with the default `autovacuum_vacuum_scale_factor = 0.2`, a table hovering around 200,000 live rows only triggers a vacuum once it accumulates roughly 40,050 dead tuples — but this workload generates dead tuples far faster than that threshold is reached relative to how fast they need cleaning, so multiple vacuum cycles' worth of bloat piles up between triggers proportionally to the *churn* rate, not the row count.
3. **Fix**:
   ```sql
   ALTER TABLE job_queue SET (
     autovacuum_vacuum_scale_factor = 0.0,
     autovacuum_vacuum_threshold = 2000,
     autovacuum_vacuum_cost_limit = 2000
   );
   ```
   Setting the scale factor to 0 and relying purely on a flat threshold means vacuum triggers consistently every ~2,000 dead tuples regardless of table size — appropriate specifically because this table's *size* is stable while its *churn* is what actually drives bloat.
4. **Result**: `n_dead_tup` now stays consistently under 5,000; query latency returns to baseline within a day as accumulated bloat gets worked off by more frequent, smaller vacuum passes.
5. **Generalized takeaway**: scale-factor-based thresholds implicitly assume dead-tuple accumulation tracks table size — for tables where churn is high relative to a comparatively stable row count (queues, session tables, staging tables), a flat threshold tuned to the actual churn rate is often the better model than a percentage of table size.

### Example 2 — Recovering from a near-wraparound emergency
Monitoring (Section 12's query) surfaces a table with `age(relfrozenxid)` at 1.85 billion, dangerously close to the ~2 billion hard limit where PostgreSQL begins refusing writes.
1. **Root cause investigation**: `SELECT * FROM pg_stat_user_tables WHERE relname = 'audit_log';` shows `last_autovacuum` is `NULL` — autovacuum has apparently never successfully completed on this table.
2. **Deeper investigation**: `SELECT pid, state, now() - xact_start FROM pg_stat_activity WHERE state != 'idle' ORDER BY 3 DESC;` reveals a reporting connection that's been sitting in `idle in transaction` for 11 days — a forgotten connection from a debugging session that opened a transaction and never committed or rolled back.
3. **Immediate mitigation**: terminate the stuck session — `SELECT pg_terminate_backend(pid);` — which immediately unblocks every vacuum that's been silently unable to make progress against this table (and likely others) for 11 days.
4. **Recovery**: manually trigger an aggressive vacuum: `VACUUM (FREEZE, VERBOSE) audit_log;` — with the blocking transaction gone, this can now actually advance `relfrozenxid` and pull the table back from the edge.
5. **Structural fix, not just incident cleanup**: set `idle_in_transaction_session_timeout = '10min'` cluster-wide so an abandoned open transaction is automatically terminated long before it can block vacuum for days, and add explicit alerting (per Section 12's monitoring queries and the Monitoring & Observability cheatsheet) on both XID age *and* idle-in-transaction session age, so the next instance of this pattern is caught in minutes rather than discovered at 92% of the way to a wraparound-forced outage.

---

## 16. Gotchas

- **Disabling autovacuum cluster-wide "because it was causing I/O spikes" is one of the most common self-inflicted DBA disasters** — the correct fix is tuning cost delay/limit and per-table thresholds, not turning it off; tables silently bloat and XID age silently climbs until a wraparound emergency forces an aggressive, disruptive freeze under pressure.
- **A single long-running transaction (or an idle-in-transaction connection left open by a buggy application) can block vacuum progress cluster-wide**, not just on the tables it touches — vacuum can't reclaim anything newer than the oldest still-open snapshot. This is a top-3 root cause of "autovacuum isn't keeping up" tickets that turns out to have nothing to do with autovacuum tuning at all.
- **`VACUUM` (without `FULL`) never returns disk space to the operating system** — it marks space reusable *within* the table's existing files. A table that was once huge and is now mostly empty will not shrink on disk without `VACUUM FULL` or `pg_repack`, even though its dead tuples have been fully vacuumed.
- **Replication slots delay vacuum's ability to reclaim space** in the same way they delay WAL removal — a stalled logical or physical replication slot means vacuum can't clean up tuples that a lagging subscriber might still need to see.
- **Bulk `UPDATE`/`DELETE` operations create a burst of dead tuples all at once**, which can overwhelm the throttled pace of routine autovacuum — run a manual `VACUUM ANALYZE` immediately after any large batch operation rather than waiting for autovacuum to notice.
- **`autovacuum_freeze_max_age` interacts with `max_wal_size`-driven checkpoint frequency** — an aggressive forced freeze on a huge table can generate a large volume of WAL in a short window, worth accounting for in backup/WAL-archiving capacity planning, not just query performance planning.
- **Toast tables (used for large column values) have their own, separate autovacuum settings and statistics** and are easy to forget about entirely when reviewing `pg_stat_user_tables`, since they don't appear under their parent table's name.
- **Partitioned tables' autovacuum behavior is per-partition**, not per parent — a scale-factor override set on the parent table does not automatically apply to child partitions unless explicitly set on each, or unless using a templating mechanism to apply it consistently.
