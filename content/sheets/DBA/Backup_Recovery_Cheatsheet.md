# Backup & Recovery Cheatsheet

A DBA-focused reference for backing up and restoring MySQL and PostgreSQL: full vs. incremental vs. differential strategies, point-in-time recovery (PITR), the current tooling landscape, and the restore drills that actually get tested.

> Verified against: **PostgreSQL 18** (current stable; PG 19 in beta), **MySQL 8.4 LTS / 9.7 Innovation**, **Percona XtraBackup 8.x**, **Barman 3.17**, **pgBackRest 2.58**. Tool-landscape notes below (pgBackRest's April 2026 maintenance scare and rescue, Orchestrator's 2026 revival) were confirmed via web search since they postdate most training data and materially affect tool choice today.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Quick Reference Table](#2-quick-reference-table)
3. [Backup Types](#3-backup-types)
4. [MySQL Backup Methods](#4-mysql-backup-methods)
5. [PostgreSQL Backup Methods](#5-postgresql-backup-methods)
6. [Point-in-Time Recovery (PITR)](#6-point-in-time-recovery-pitr)
7. [Backup Tooling Landscape (2026)](#7-backup-tooling-landscape-2026)
8. [Backup Storage & Retention](#8-backup-storage--retention)
9. [Encryption & Security of Backups](#9-encryption--security-of-backups)
10. [Restore Testing & Drills](#10-restore-testing--drills)
11. [Cloud-Managed Database Backups](#11-cloud-managed-database-backups)
12. [Backup Strategy by Data Size / Criticality](#12-backup-strategy-by-data-size--criticality)
13. [Backup Performance & Compression Tuning](#13-backup-performance--compression-tuning)
14. [Sharded & Multi-Tenant Backup Strategies](#14-sharded--multi-tenant-backup-strategies)
15. [Worked Examples](#15-worked-examples)
16. [Gotchas](#16-gotchas)

---

## 1. Core Concepts

| Concept | What it means |
|---|---|
| **Full backup** | A complete copy of every byte of data at one point in time. Baseline for every restore chain. |
| **Incremental backup** | Captures only blocks/pages changed since the *last backup of any type* (full or incremental). Smallest, fastest to take; slowest to restore (must replay the whole chain). |
| **Differential backup** | Captures everything changed since the *last full backup*. Larger than incremental, but restores in exactly two steps (full + latest differential). |
| **Logical backup** | A backup expressed as SQL statements or a portable dump format (`mysqldump`, `pg_dump`) — table/row-level, engine-independent, slow at scale, but flexible (partial restores, cross-version). |
| **Physical backup** | A byte-for-byte copy of data files (`pg_basebackup`, XtraBackup, filesystem snapshot) — fast at scale, restores in the same engine/major-version family, not human-readable. |
| **PITR (Point-in-Time Recovery)** | Restoring a full/base backup, then replaying transaction logs (binlog for MySQL, WAL for PostgreSQL) up to an arbitrary timestamp or transaction ID — the mechanism behind "restore to 30 seconds before the DROP TABLE." |
| **RPO (Recovery Point Objective)** | Maximum acceptable data loss, measured in time. An RPO of 5 minutes means your backup/log-shipping cadence must guarantee you never lose more than 5 minutes of committed transactions. |
| **RTO (Recovery Time Objective)** | Maximum acceptable time to get back online after a failure. Drives whether you need warm standbys or can tolerate a multi-hour restore-from-backup. |
| **Backup consistency** | A backup must represent a single consistent point in time even though files are copied over minutes/hours — achieved via WAL/binlog replay to a consistent LSN/GTID, not by freezing the whole database. |
| **Crash-consistent vs. application-consistent** | Crash-consistent = as if the server lost power mid-write (the DB engine's own crash recovery fixes it up, which is exactly what WAL/redo logs are for). Application-consistent = extra coordination (e.g., quiescing writes) so dependent systems agree too. Database physical backups are crash-consistent by design; this is normal and expected. |

---

## 2. Quick Reference Table

| I want to… | MySQL | PostgreSQL |
|---|---|---|
| Take a full logical backup | `mysqldump --single-transaction --routines --triggers -A > full.sql` | `pg_dumpall` or `pg_dump -Fc dbname > dbname.dump` |
| Take a full physical backup (hot, no downtime) | `xtrabackup --backup --target-dir=/backup/full` | `pg_basebackup -D /backup/full -Fp -Xs -P` |
| Take an incremental physical backup | `xtrabackup --backup --target-dir=/backup/inc1 --incremental-basedir=/backup/full` | Not native to `pg_basebackup` — use pgBackRest/Barman incremental/differential |
| Enable log shipping for PITR | Enable binary logging: `log_bin=ON`, `binlog_format=ROW` | Enable WAL archiving: `archive_mode=on`, `archive_command='...'`, or a replication slot |
| Restore to an exact timestamp | `mysqlbinlog --stop-datetime="..." binlog.000123 \| mysql` | `recovery_target_time = '...'` in `postgresql.conf` / `recovery.signal` |
| Restore a single table without touching the rest | Import from logical dump filtered to that table, or `mysqlpump --include-tables` | `pg_restore --table=tablename` from a custom-format (`-Fc`) dump |
| Verify a backup is restorable | `xtrabackup --prepare` then spin up a copy | `pg_verifybackup` (built-in since PG 13) or an actual restore |
| Check current binlog/WAL position | `SHOW BINARY LOG STATUS;` (MySQL 8.4+; replaces `SHOW MASTER STATUS`) | `SELECT pg_current_wal_lsn();` |

---

## 3. Backup Types

```
Full ──────────────────────────────────────────────► (restore: apply just this)
Full → Diff1 → Diff2 ──────────────────────────────► (restore: Full + latest Diff)
Full → Inc1 → Inc2 → Inc3 ──────────────────────────► (restore: Full + Inc1 + Inc2 + Inc3, in order)
```

- **Full-only** is simplest to reason about and restore, but backup windows/storage grow with data size — fine for small-to-medium databases.
- **Full + differential** trades a bit more storage per differential for a much simpler, faster restore (never more than 2 backup sets to apply).
- **Full + incremental** minimizes backup storage and window but is the most fragile restore chain — losing or corrupting *any* incremental in the chain breaks every backup after it. Always pair with checksums and periodic "synthetic full" consolidation.
- **Logical vs. physical is an orthogonal axis** to full/incremental/differential — you can have a logical full dump, or a physical incremental snapshot, etc.

---

## 4. MySQL Backup Methods

### `mysqldump` (logical)
```bash
# Full instance, consistent snapshot without locking InnoDB tables
mysqldump --single-transaction --routines --triggers --events \
  --all-databases --master-data=2 > full_backup.sql

# Single database, compressed
mysqldump --single-transaction db_name | gzip > db_name.sql.gz
```
- `--single-transaction` opens one REPEATABL------ transaction so InnoDB tables are consistent without a global lock; it does **not** help MyISAM (still needs `--lock-tables`).
- `--master-data=2` (or the modern `--source-data=2`) embeds the binlog position as a commented `CHANGE MASTER TO` / `CHANGE REPLICATION SOURCE TO` statement — the anchor point for PITR replay after restoring this dump.
- Fine for small-to-medium databases (roughly under ~50–100 GB, workload-dependent); slow to restore at scale because it replays every `INSERT` as SQL.

### Percona XtraBackup (physical, hot)
```bash
# Full backup
xtrabackup --backup --target-dir=/backup/full --user=root

# Prepare (replay redo logs so it's restorable)
xtrabackup --prepare --target-dir=/backup/full

# Incremental, based on the full
xtrabackup --backup --target-dir=/backup/inc1 \
  --incremental-basedir=/backup/full

# Restore: prepare full with --apply-log-only, then apply each increment in order, then final prepare
xtrabackup --prepare --apply-log-only --target-dir=/backup/full
xtrabackup --prepare --apply-log-only --target-dir=/backup/full --incremental-dir=/backup/inc1
xtrabackup --prepare --target-dir=/backup/full --incremental-dir=/backup/inc2   # last one: no --apply-log-only

# Copy prepared files back and start MySQL
xtrabackup --copy-back --target-dir=/backup/full
```
- Streams the raw InnoDB files without blocking writers (uses the redo log to catch up, same idea as `pg_basebackup`), which is why it's the standard for large, always-on MySQL instances.
- MySQL Enterprise Backup is Oracle's commercial equivalent with near-identical mechanics.

### mydumper / myloader
- A parallel, multi-threaded alternative to `mysqldump`/`mysql` for logical backup/restore — dramatically faster on multi-core hosts because it dumps/loads tables concurrently instead of one connection doing everything serially.

---

## 5. PostgreSQL Backup Methods

### `pg_dump` / `pg_dumpall` (logical)
```bash
# Single database, custom format (compressed, supports parallel restore, selective restore)
pg_dump -Fc -f dbname.dump dbname

# Parallel dump (directory format only)
pg_dump -Fd -j 4 -f dbname_dir dbname

# Whole cluster (roles + all databases) — plain SQL only, no -Fc
pg_dumpall -f cluster_full.sql

# Restore
pg_restore -d dbname --jobs=4 dbname.dump
pg_restore -d dbname --table=orders dbname.dump   # single table
```
- `-Fc` (custom) and `-Fd` (directory) are compressed and support `pg_restore`'s selective/parallel restore; plain `-Fp` SQL text does not.
- `pg_dump` takes an internally consistent MVCC snapshot without blocking writers — no `--single-transaction`-style flag needed, that's just how MVCC snapshots work.
- `pg_dumpall` only captures globals (roles, tablespaces) and does per-database plain-text dumps — most shops pair `pg_dumpall --globals-only` with per-database `pg_dump -Fc`.

### `pg_basebackup` (physical, hot)
```bash
pg_basebackup -D /backup/base -Fp -Xs -P -c fast --checkpoint=fast

# -Fp  plain format (a ready-to-run data directory)
# -Xs  stream WAL concurrently with the backup so it's self-contained
# -c fast  request an immediate checkpoint instead of waiting for the next scheduled one
```
- Built-in, but has no native incremental mode pre-PG 17. **PostgreSQL 17 added incremental backups** via `pg_basebackup --incremental` combined with WAL summarization (`summarize_wal = on`) — genuinely new capability worth knowing if you're still assuming Postgres can only do full physical backups.
- For incremental/differential backups on PG < 17, or for retention/scheduling/cloud-storage integration, use pgBackRest or Barman (below) rather than scripting `pg_basebackup` + `rsync` yourself.

### WAL Archiving (needed for PITR regardless of tool)
```conf
# postgresql.conf
wal_level = replica          # or logical if you need logical replication too
archive_mode = on
archive_command = 'test ! -f /archive/%f && cp %p /archive/%f'
```
- In production, `archive_command` almost always ships WAL to object storage (S3/GCS/Azure Blob) via the backup tool's own archiving, not a bare `cp`.

---

## 6. Point-in-Time Recovery (PITR)

**MySQL:**
1. Restore the most recent full backup (mysqldump import, or XtraBackup `--copy-back`).
2. Note the binlog file/position (or GTID set) that backup corresponds to.
3. Replay binlogs forward from that point: `mysqlbinlog --start-position=... --stop-datetime="2026-09-17 08:14:00" binlog.000045 binlog.000046 | mysql -u root`.
4. With GTIDs enabled (`gtid_mode=ON`), you can target `--exclude-gtids` to skip a specific bad transaction (e.g., the accidental `DROP TABLE`) instead of stopping at a timestamp — more precise than time-based cutoffs.

**PostgreSQL:**
1. Restore the base backup to a fresh data directory.
2. Create a `standby.signal` (or, on older versions, a `recovery.conf`) and set:
   ```conf
   restore_command = 'cp /archive/%f %p'
   recovery_target_time = '2026-09-17 08:14:00+00'
   # or: recovery_target_xid, recovery_target_lsn, recovery_target_name (a named restore point)
   recovery_target_action = 'promote'   # or 'pause' to inspect before committing to the target
   ```
3. Start PostgreSQL — it replays WAL from the archive up to the target and then promotes.
4. `pg_create_restore_point('before_migration')` beforehand gives you a named, human-readable target instead of guessing a timestamp.

**Both engines share the same shape**: full/base backup + a continuous, unbroken log stream (binlog/WAL) covering the gap up to the target moment. The single most common PITR failure in the field is a *gap* in that log stream — an archive command that silently failed, or log retention that expired before anyone needed it.

---

## 7. Backup Tooling Landscape (2026)

**pgBackRest** was, for roughly a decade, the de facto standard for PostgreSQL physical backups — parallel backup/restore, built-in incremental and differential, WAL archiving with compression and encryption, and direct S3/Azure/GCS support. On **April 27, 2026**, its sole maintainer announced he was stepping away and archived the repository, which briefly left the PostgreSQL ecosystem without a clear default backup tool. A coalition of six companies (including AWS, Percona, and Supabase) picked up sponsorship and maintenance about three weeks later, so pgBackRest is active again — but the scare pushed a lot of shops to seriously evaluate **Barman** (EDB-maintained, Python, supports both rsync/SSH and streaming-replication-based backup, the default backup plugin for CloudNativePG on Kubernetes) and **WAL-G** (simpler, cloud-native, popular for multi-tenant/managed-Postgres setups) as alternatives or as a second tool for redundancy. If you're standing up new PostgreSQL backup infrastructure today, it's worth checking each project's current maintenance status before committing rather than assuming pgBackRest's old "default choice" reputation still tells the whole story.

**MySQL** doesn't have an equivalent single-point-of-failure story — Percona XtraBackup (open-source) and MySQL Enterprise Backup (commercial) have both been stable, actively maintained options for physical backups for years, and mydumper/myloader for fast logical backups.

**Practical takeaway:** don't just pick the tool everyone used two years ago — check whether it's still maintained, and consider running backup verification (restore drills, below) that's tool-agnostic enough to survive a tool migration.

---

## 8. Backup Storage & Retention

| Consideration | Guidance |
|---|---|
| **3-2-1 rule** | 3 copies of data, on 2 different media/storage types, with 1 copy offsite/off-infrastructure (different cloud account or region, not just a different disk on the same host). |
| **Retention policy** | Match to compliance/business needs, not defaults — e.g., 7 daily + 4 weekly + 12 monthly + 7 yearly is a common tiered scheme. Most tools (pgBackRest, Barman, XtraBackup wrappers) support retention as a first-class config, not a cron job you write yourself. |
| **Immutable/WORM storage** | For ransomware resilience, at least one backup copy should be write-once or otherwise unable to be altered/deleted by the same credentials that manage production (S3 Object Lock, separate backup-only IAM role). |
| **Backup encryption at rest** | Non-negotiable for anything containing PII/PHI/PCI data — see [Section 9](#9-encryption--security-of-backups). |
| **Cross-region/cross-account copies** | Protects against a compromised or misconfigured account taking out both production and its backups simultaneously. |

---

## 9. Encryption & Security of Backups

- **Encrypt in transit and at rest.** pgBackRest and Barman both support native encryption (AES-256) of the backup repository; if using raw `mysqldump`/`pg_dump`, pipe through `gpg` or `openssl enc` before writing to storage.
- **Separate credentials for backup storage** from production database credentials — a compromised app server or DB user should not automatically have delete access to the backup bucket.
- **Don't forget backups in your access-control audit** — a full logical dump is often the single largest concentration of sensitive data in an organization's infrastructure, and it's easy to under-protect because "it's just a backup."
- **Rotate backup encryption keys** on the same cadence as other credential rotation policies, and make sure old keys are retained long enough to decrypt backups still within your retention window.

---

## 10. Restore Testing & Drills

A backup you haven't restored is a *hypothesis*, not a backup. Practical drill program:

1. **Automated restore-and-verify**, at minimum weekly: restore the latest backup to a scratch instance and run a checksum/row-count/`pg_verifybackup` sanity check — fully automated, alerts on failure.
2. **Full PITR drill**, at minimum quarterly: pick a real timestamp from a few hours ago, restore + replay logs to that exact point, and confirm the data matches what you'd expect (a known transaction landed or didn't).
3. **Timed restore drill**, tied to your RTO: time the *entire* process (locate backup → provision host → restore → replay logs → application reconnect) and compare against your stated RTO — most orgs discover their real RTO is 3-5x their assumed one the first time they measure it end-to-end.
4. **Chaos/game-day exercises**: intentionally take down the primary in a non-production environment and have the on-call DBA execute the actual documented runbook, not a tabletop walkthrough.
5. **Document the runbook outside the database** — if the restore instructions live only in a wiki page hosted on infrastructure that goes down with the database, that's a single point of failure in your own recovery plan.

---

## 11. Cloud-Managed Database Backups

| Platform | What's automatic | What you still own |
|---|---|---|
| **AWS RDS/Aurora** | Automated daily snapshots + continuous transaction log backup for PITR within the retention window (1–35 days) | Cross-region copies, long-term retention beyond the window, testing restores, backups surviving account-level compromise |
| **Cloud SQL (GCP)** | Automated backups + binary/WAL logs for PITR | Same as above; export to GCS for long-term/cross-project retention |
| **Azure Database for MySQL/PostgreSQL** | Automated backups, geo-redundant option | Long-term retention policies, restore testing |
| **Self-managed on any cloud VM** | Nothing — you own the entire stack above | Everything in this document |

Managed-service PITR windows are convenience, not disaster recovery — a botched migration discovered after the retention window closes, or a compromised account with delete permissions on the DB instance, both still require an independent, separately-controlled backup copy.

---

## 12. Backup Strategy by Data Size / Criticality

| Scenario | Suggested approach |
|---|---|
| Small DB (<50 GB), non-critical | Nightly logical dump (`mysqldump`/`pg_dump`), 7–30 day retention, single storage location |
| Medium DB, business-critical | Nightly physical full + hourly incremental (XtraBackup/pgBackRest/Barman), WAL/binlog archiving for PITR, offsite copy |
| Large DB (TB+), high-transaction | Physical full weekly + daily incremental/differential + continuous WAL/binlog streaming, parallel backup/restore, tested RTO/RPO against SLA, cross-region copy |
| Regulated data (PII/PHI/PCI) | All of the above + encryption at rest/in transit, immutable storage tier, documented chain of custody, retention aligned to regulatory minimums (not just business convenience) |

---

## 13. Backup Performance & Compression Tuning

Backup windows are a real constraint, not an afterthought — a full backup that takes longer than your maintenance window either runs during peak traffic (contending for I/O with production) or forces you into a less-safe strategy.

| Lever | Effect | Trade-off |
|---|---|---|
| **Compression algorithm** | `gzip` (universal, moderate ratio/speed), `zstd` (better ratio *and* faster than gzip at equivalent levels — the modern default choice for pgBackRest, Barman, and XtraBackup), `lz4` (fastest, lowest ratio — good when CPU is the bottleneck, not storage cost) | Higher compression ratio costs CPU time; on a CPU-constrained primary, a faster/weaker algorithm can finish sooner even though the resulting file is larger |
| **Parallel workers** (`xtrabackup --parallel=N`, `pg_dump -j N`, pgBackRest's `process-max`) | Roughly linear backup-time reduction up to the number of usable cores/disks | Diminishing returns past the storage subsystem's actual parallel I/O capacity; over-parallelizing a backup on a busy primary steals I/O bandwidth from production queries |
| **Delta/block-level incrementals** (pgBackRest, XtraBackup, PG 17+ `pg_basebackup --incremental`) | Backup size and time scale with *changes*, not total data size | Restore time increases with chain length (Section 3) — a performance win on the backup side is a cost on the restore side |
| **I/O throttling** (`--throttle` in XtraBackup, `archive-timeout`/rate-limiting in pgBackRest, `iotop`-informed `nice`/`ionice`) | Keeps backup I/O from starving production query latency | Directly extends the backup window — a deliberate trade between "backup finishes fast" and "production stays fast while it runs" |
| **Snapshot-based backup** (LVM snapshots, cloud block-storage snapshots (EBS/PD snapshots), ZFS/Btrfs snapshots) | Near-instantaneous from the database's perspective — a snapshot is a metadata operation, not a data copy | Still needs the database to reach a consistent point first (a brief `FLUSH TABLES WITH READ LOCK` in MySQL, or relying on WAL replay for PostgreSQL crash-consistency); the actual data copy/upload to durable storage still takes time and I/O in the background |

**Rule of thumb**: for a database under ~500 GB, single-threaded `gzip`-based backups are usually fine. Past that, parallelism and `zstd` stop being optional — a backup tool defaulting to single-threaded `gzip` on a multi-TB database is often the actual reason a "backup window" complaint exists in the first place, not a fundamental data-size problem.

---

## 14. Sharded & Multi-Tenant Backup Strategies

**Sharded databases** (data horizontally partitioned across multiple independent database instances) introduce a coordination problem that single-instance backup strategies don't have: a backup taken shard-by-shard, sequentially, does not represent one consistent point in time across the whole dataset.

- **Cross-shard consistency isn't usually required for restore correctness** if shards are truly independent (no cross-shard foreign keys or transactions) — in that case, back each shard up independently on its own schedule, and restore drills should still validate each shard individually.
- **If cross-shard consistency does matter** (e.g., a sharding scheme with occasional cross-shard transactions, or analytics that join across shards), coordinate backup start times as tightly as possible and record each shard's backup LSN/GTID, so a restore can replay each shard forward to the *same wall-clock target* via PITR rather than assuming the raw backups themselves are mutually consistent.
- **Shard-aware retention and restore tooling matters at scale** — restoring "the database" when there are 200 shards means restoring 200 independent backup sets; without orchestration tooling (a script that loops the same restore procedure across every shard, checked for individual failures), a partial restore that silently skips a failed shard is a realistic and dangerous failure mode.

**Multi-tenant SaaS databases** (many tenants in one schema, or one schema-per-tenant, or one database-per-tenant) have their own version of this problem:

| Multi-tenancy model | Backup implication |
|---|---|
| Shared schema, `tenant_id` column | Standard whole-database backup covers everyone — but a **single-tenant restore** (a common support request: "restore just our data to last Tuesday") requires either row-level extraction from a PITR-restored scratch copy, or application-level export/import, since neither `pg_dump`/`mysqldump` nor physical backups restore "one tenant's rows" natively |
| Schema-per-tenant (PostgreSQL) | `pg_dump --schema=tenant_123` gives clean per-tenant logical backups — the most operationally convenient model for per-tenant restore requests |
| Database-per-tenant | Cleanest isolation for backup/restore (each tenant is a normal, independent backup/restore target) at the cost of per-database operational overhead multiplying with tenant count |

**Practical takeaway**: if "restore one customer's data without touching everyone else's" is a support request you expect to get, that requirement should shape the multi-tenancy model *before* it becomes a backup-strategy problem — retrofitting per-tenant restore capability onto a shared-schema design after the fact is materially harder than choosing schema-per-tenant or database-per-tenant up front for tenants where this matters.

---

## 15. Worked Examples

### Example 1 — PITR recovery from an accidental `DROP TABLE` (PostgreSQL)
A developer runs `DROP TABLE orders;` against production at 14:32:07 UTC, and it's noticed four minutes later.
1. Confirm WAL archiving has been running continuously (check `pg_stat_archiver` on the still-running primary for any recent `archive_command` failures) — if archiving has a gap, this whole approach is unavailable and you fall back to the last full backup only.
2. Provision a scratch instance (never do this recovery *on* the still-running primary) and restore the most recent base backup taken before 14:32:07.
3. Set `restore_command = 'cp /archive/%f %p'` and `recovery_target_time = '2026-09-17 14:32:06+00'` (one second *before* the drop) with `recovery_target_action = 'promote'`.
4. Start PostgreSQL on the scratch instance; it replays WAL up to that instant and promotes, with the `orders` table intact.
5. Verify: `SELECT count(*) FROM orders;` and spot-check the most recent rows against what the team remembers being there.
6. Extract just the `orders` table via `pg_dump --table=orders` from the scratch instance, and restore it into production — this recovers the one lost table with essentially zero impact on everything else that happened in production during those four minutes.
7. **Post-incident**: this only worked because `recovery_target_time` could be set to one second before the drop — if the exact drop time weren't known, `recovery_target_action = 'pause'` combined with inspecting the database before promoting (or targeting a named restore point created just before risky migrations, per Section 6) avoids needing to guess.

### Example 2 — MySQL XtraBackup incremental chain restore after a corrupted increment
A nightly full + hourly incremental XtraBackup strategy has been running for a week. At hour 5 of the current day, the primary fails and needs full rebuild from backup.
1. Inventory the chain: `full` (last night) → `inc1` → `inc2` → `inc3` → `inc4` (5 AM) → `inc5` (6 AM, today's most recent).
2. Verification step (which should have been automated, per Section 10) reveals `inc3` is corrupted (a truncated file from a disk issue during that backup window).
3. Because incremental chains are strictly sequential (Section 3/Gotchas), `inc4` and `inc5` are now unusable — they were built on top of `inc3`'s state, and the chain breaks at the first bad link.
4. **Actual restorable point**: `full` → `inc1` → `inc2` only — meaning the real RPO for this incident is "as of `inc2`," not "as of `inc5`," a gap of roughly 3 hours more data loss than the backup schedule nominally promised.
5. Restore: `xtrabackup --prepare --apply-log-only --target-dir=full`, then apply `inc1` with `--apply-log-only`, then apply `inc2` as the final (non-`apply-log-only`) prepare step, then `--copy-back`.
6. Start MySQL, then use `mysqlbinlog` against the retained binlogs (if the failed primary's binlog files are still recoverable from its disk, or from a replica) to replay forward from `inc2`'s GTID position to as close to the failure time as the binlogs allow — potentially recovering some or all of the "lost" 3 hours despite the broken incremental chain.
7. **Root-cause fix**: this is exactly the scenario the "synthetic full" consolidation practice (Section 3) exists to limit the blast radius of — a shorter incremental chain (consolidating to a fresh full every 6 hours instead of every 24) would have meant losing at most ~1 hour instead of ~3 when a link breaks.

### Example 3 — Rebuilding backup strategy after a tooling-abandonment scare
A team using pgBackRest as their sole PostgreSQL backup tool watches the April 2026 maintainer-departure news (Section 7) and decides to de-risk rather than wait and see.
1. **Immediate action**: verify current backups are still restorable (a restore drill, not just "the tool still runs") — an abandonment scare is exactly the moment latent restore-testing gaps get discovered the hard way if nobody checks proactively.
2. **Short-term**: confirm pgBackRest's actual maintenance status hasn't lapsed further (by the time the coalition picked it up weeks later, this had resolved) rather than panic-migrating off a tool that's actually fine.
3. **Medium-term de-risking, regardless of pgBackRest's outcome**: stand up Barman or WAL-G as a *second*, independently-configured backup path for the same cluster — not a replacement, but a hedge, so a future single-tool failure (maintenance lapse, a bug, a licensing change) doesn't leave zero working backups.
4. **Document the fallback runbook**: if the primary tool becomes unusable, which secondary tool takes over, and has that switch actually been tested (not just configured)?
5. **Takeaway generalized beyond this specific incident**: for any category-defining single-vendor or single-maintainer open-source dependency in the backup/DR path specifically (the one layer where "the tool is gone and we can't recover" is catastrophic rather than merely inconvenient), a tested second option is cheap insurance relative to the cost of discovering the gap during an actual disaster.

### Example 4 — A quarterly restore drill reveals the real RTO
A team's documented DR plan states a 1-hour RTO for their primary PostgreSQL cluster (500 GB). The first fully timed drill:
1. **00:00** — Incident declared (drill start).
2. **00:04** — On-call engineer locates the correct backup set and begins provisioning a new instance (takes longer than expected — the "standard" instance-provisioning script assumed infrastructure that wasn't actually pre-staged for DR).
3. **00:22** — Instance ready; `pg_basebackup`-based restore begins.
4. **00:51** — Base restore complete; WAL replay begins for PITR to the target time.
5. **01:08** — WAL replay complete, database promoted.
6. **01:15** — Application reconnected and verified end-to-end (this step wasn't in the original runbook at all — someone had to figure out the connection-string cutover manually).
7. **Actual RTO: ~75 minutes against a documented 60-minute target** — a 25% gap, concentrated almost entirely in two places: unstaged infrastructure provisioning and an undocumented application-cutover step.
8. **Remediation**: pre-stage DR infrastructure (or use infrastructure-as-code that's actually tested, not just written) to cut step 1's time dramatically, and add the application-cutover procedure explicitly to the runbook so it's not improvised live next time. Re-drill in one quarter to confirm the gap actually closed rather than assuming the fix worked.

---

## 16. Gotchas

- **`--single-transaction` doesn't help MyISAM tables** — it relies on InnoDB's MVCC snapshot; a mixed-engine database still needs `--lock-tables` (or better, migrate off MyISAM) for consistency.
- **A broken archive_command fails silently by default** — PostgreSQL just keeps retrying and piling up WAL in `pg_wal/`, which can fill the disk and take down the primary; alert on `archive_command` failures and on WAL directory size, not just on backup job success/failure.
- **Incremental chains are fragile** — one corrupted or missing incremental breaks every backup after it in the chain. Periodically consolidate into a fresh full ("synthetic full") rather than letting an incremental chain grow indefinitely.
- **`pg_dump` is not a hot-standby-safe backup by itself** — it captures one database's logical state, not the whole cluster (roles, tablespaces, other databases); use `pg_dumpall --globals-only` alongside it, or `pg_basebackup`/pgBackRest for full-cluster coverage.
- **Binlog/WAL retention shorter than your backup retention breaks PITR** — if a full backup is 30 days old but binlogs/WAL are purged after 7 days, you cannot replay forward from that backup to anything except its own snapshot moment.
- **Restoring across major versions rarely works for physical backups** — `pg_basebackup`/XtraBackup restores are tied to the same major version's on-disk format; only logical dumps (`pg_dump`, `mysqldump`) are safely portable across major-version upgrades.
- **"The backup job succeeded" ≠ "the backup is restorable."** Exit code 0 confirms the tool ran, not that the resulting files can rebuild a working database — this is the entire justification for [Section 10](#10-restore-testing--drills).
- **Point-in-time targets are exclusive of the exact transaction in some tooling** — always test whether `recovery_target_time`/`--stop-datetime` includes or excludes the boundary transaction; assuming the wrong direction can mean you either keep or lose the exact bad statement you were trying to recover from.
- **Don't assume a backup tool's ecosystem status is stable** — as pgBackRest's April 2026 near-abandonment showed, even category-defining open-source tools can lose funding abruptly; know your tool's bus factor and have a documented fallback.
