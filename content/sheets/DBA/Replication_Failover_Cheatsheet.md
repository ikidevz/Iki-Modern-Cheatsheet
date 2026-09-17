# Replication & Failover Cheatsheet

A DBA-focused reference for replication topologies, the mechanics of MySQL and PostgreSQL replication, and the tooling that turns "a replica exists" into "automatic failover actually works."

> Verified against: **PostgreSQL 18**, **MySQL 8.4 LTS / 9.7**, **Patroni** (current standard PostgreSQL HA framework), **Orchestrator** (revived under ProxySQL as of April 2026, with new PostgreSQL support as of that revival — confirmed via web search since this postdates most training data).

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Quick Reference Table](#2-quick-reference-table)
3. [Replication Topologies](#3-replication-topologies)
4. [MySQL Replication](#4-mysql-replication)
5. [PostgreSQL Replication](#5-postgresql-replication)
6. [Synchronous vs. Asynchronous Replication](#6-synchronous-vs-asynchronous-replication)
7. [Automatic Failover Tooling](#7-automatic-failover-tooling)
8. [Split-Brain Prevention (Fencing)](#8-split-brain-prevention-fencing)
9. [Replication Lag: Causes & Mitigation](#9-replication-lag-causes--mitigation)
10. [Manual Failover Runbook](#10-manual-failover-runbook)
11. [Conflict Resolution in Multi-Primary Setups](#11-conflict-resolution-in-multi-primary-setups)
12. [Delayed Replicas & Cross-Cloud Replication](#12-delayed-replicas--cross-cloud-replication)
13. [Worked Examples](#13-worked-examples)
14. [Gotchas](#14-gotchas)

---

## 1. Core Concepts

| Concept | What it means |
|---|---|
| **Primary/source (formerly "master")** | The node accepting writes. Every write-capable topology has exactly one, at any given moment, per replication set. |
| **Replica/standby (formerly "slave")** | A node continuously applying a stream of changes from the primary. Read-only by default in both engines. |
| **Physical replication** | Ships low-level storage changes (PostgreSQL WAL records, or InnoDB redo-log-adjacent binlog ROW events) — the replica is a byte-level twin of the primary. |
| **Logical replication** | Ships logical change events (row-level INSERT/UPDATE/DELETE, decoded from WAL/binlog) — allows replicating a subset of tables, cross-version replication, and different schemas on each side. |
| **Replication lag** | The delay between a transaction committing on the primary and becoming visible on a replica — measured in time (seconds behind) or in bytes/LSN distance. |
| **Failover** | Promoting a replica to primary after the original primary fails — either automatic (a controller detects failure and promotes) or manual (a human runs the promotion). |
| **Switchover** | A *planned*, orchestrated primary change (e.g., for maintenance) — no data loss, no failure detection needed, just an orderly handoff. |
| **Split-brain** | Two nodes both believe they are primary and both accept writes — the most dangerous replication failure mode, because it silently diverges data until someone notices. |
| **Quorum / distributed consensus** | The mechanism (etcd, Consul, ZooKeeper, or a voting protocol) that a failover controller uses to agree on "who is allowed to be primary right now," preventing split-brain. |
| **GTID (Global Transaction Identifier)** | A unique ID assigned to every committed transaction (MySQL) that lets a replica identify exactly which transactions it has and hasn't applied — replaces manual binlog-file+offset bookkeeping. |
| **LSN (Log Sequence Number)** | PostgreSQL's equivalent positional marker in the WAL stream — every replica and every backup can be pinpointed to an exact LSN. |

---

## 2. Quick Reference Table

| I want to… | MySQL | PostgreSQL |
|---|---|---|
| Set up basic replication | `CHANGE REPLICATION SOURCE TO SOURCE_HOST=..., SOURCE_AUTO_POSITION=1;` then `START REPLICA;` | `pg_basebackup` from primary, set `primary_conninfo` in the replica, create `standby.signal` |
| Check replica status/lag | `SHOW REPLICA STATUS\G` → `Seconds_Behind_Source` | `SELECT * FROM pg_stat_replication;` (on primary) or `pg_last_wal_replay_lsn()` (on replica) |
| Promote a replica to primary | `RESET REPLICA ALL;` (manual) or let Orchestrator/Group Replication do it | `pg_ctl promote` or `SELECT pg_promote();` (manual) or let Patroni do it |
| Enable synchronous replication | Semisynchronous plugin (`rpl_semi_sync_source_enabled=1`) | `synchronous_standby_names = 'replica1'` + `synchronous_commit = on` |
| Replicate only some tables | `replicate-do-table` / logical replication with filters | `CREATE PUBLICATION ... FOR TABLE ...` (logical replication) |
| Automatic failover | Group Replication / InnoDB Cluster, Orchestrator + ProxySQL | Patroni (+ etcd/Consul) or Orchestrator (PostgreSQL support since 2026) |
| Prevent split-brain | Group Replication's built-in group membership, or a proxy + STONITH fencing script | Patroni's DCS-based leader lock + a fencing/`recovery_min_apply_delay` guard |

---

## 3. Replication Topologies

| Topology | Description | Best for |
|---|---|---|
| **Single primary, N replicas** | One write node, multiple read-only replicas | The default, safest starting point — read scaling, HA standby |
| **Chained replication** | Replica B replicates from replica A instead of the primary | Reducing load on the primary when replica count is high (cascading) |
| **Multi-primary / active-active** | More than one node accepts writes (MySQL Group Replication in multi-primary mode, PostgreSQL via BDR/pglogical or Citus) | Multi-region write locality — at the cost of conflict resolution complexity |
| **Circular replication** | Each node replicates to the next in a ring | Legacy pattern, largely superseded by proper multi-primary tooling — fragile, avoid for new designs |
| **Star / hub-and-spoke logical replication** | A central node publishes to many independent subscriber databases, often with per-subscriber filtering | Data distribution to reporting/analytics systems, not HA |

**Rule of thumb:** default to single-primary unless you have a specific, well-understood reason for multi-primary — conflict resolution in active-active setups is a genuinely hard problem, not a checkbox.

---

## 4. MySQL Replication

### Binlog-based (classic) replication
```sql
-- On the primary
SET GLOBAL log_bin = ON;                -- (set in config, requires restart)
SET GLOBAL binlog_format = 'ROW';       -- ROW is the safe default; STATEMENT can silently diverge on non-deterministic functions

-- On the replica
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST='primary.internal',
  SOURCE_USER='repl_user',
  SOURCE_PASSWORD='...',
  SOURCE_AUTO_POSITION=1;   -- GTID-based positioning, no manual file/offset tracking
START REPLICA;
SHOW REPLICA STATUS\G
```
- `SHOW REPLICA STATUS` / `START REPLICA` / `STOP REPLICA` replaced `SHOW SLAVE STATUS` / `START SLAVE` / `STOP SLAVE` as the primary terminology starting in MySQL 8.0.22, with the old commands kept as deprecated aliases.
- **GTID mode** (`gtid_mode=ON`, `enforce_gtid_consistency=ON`) is the modern default — every transaction gets a UUID:sequence identifier, so `SOURCE_AUTO_POSITION=1` lets a replica reconnect to any server in the topology (including a newly promoted primary) without manually calculating binlog file/position.

### Group Replication / InnoDB Cluster
- Built-in multi-master or single-primary replication using a Paxos-derived consensus protocol — the group agrees which transactions commit, giving built-in split-brain protection without an external tool.
- InnoDB Cluster wraps Group Replication with MySQL Router (connection routing) and MySQL Shell (`dba.createCluster()`, `.status()`, `.rejoinInstance()`) for a full managed-HA experience.
- Trade-off: writes require certification across the group (a form of synchronous-ish commit ordering), which adds latency compared to plain async replication — appropriate for correctness-critical clusters, not for maximizing single-write throughput.

### Semisynchronous replication
```sql
INSTALL PLUGIN rpl_semi_sync_source SONAME 'semisync_source.so';
SET GLOBAL rpl_semi_sync_source_enabled = 1;
SET GLOBAL rpl_semi_sync_source_timeout = 10000;  -- ms before falling back to async
```
- The primary waits for at least one replica to *acknowledge receipt* (not necessarily apply) of a transaction's binlog event before returning commit to the client — a middle ground between full async (fast, can lose data) and true multi-node consensus (slower, zero data loss on failover).

---

## 5. PostgreSQL Replication

### Streaming physical replication
```bash
# On the replica, after pg_basebackup:
cat >> postgresql.auto.conf <<EOF
primary_conninfo = 'host=primary.internal port=5432 user=repl_user password=...'
EOF
touch /var/lib/postgresql/18/main/standby.signal
```
- The replica is a byte-for-byte copy that continuously replays WAL streamed over a replication connection — this is what powers hot standbys, read replicas, and Patroni-managed clusters alike.
- `SELECT * FROM pg_stat_replication;` on the primary shows every connected replica's `state`, `sent_lsn`, `write_lsn`, `flush_lsn`, `replay_lsn` — the gap between `sent_lsn` and `replay_lsn` is your actual lag in bytes.

### Replication slots
```sql
SELECT pg_create_physical_replication_slot('replica1_slot');
```
- A replication slot tells the primary "don't recycle WAL until this specific replica has consumed it" — prevents a slow/disconnected replica from missing WAL it needs, but **also means a permanently offline replica with a slot will cause WAL to accumulate without bound** on the primary until the disk fills. Monitor slot lag as closely as replica lag itself.

### Logical replication
```sql
-- On the publisher
CREATE PUBLICATION my_pub FOR TABLE orders, customers;

-- On the subscriber
CREATE SUBSCRIPTION my_sub
  CONNECTION 'host=primary.internal dbname=app user=repl_user'
  PUBLICATION my_pub;
```
- Row-level, filterable, and works **across major PostgreSQL versions** (unlike physical replication) — the standard mechanism for zero/near-zero-downtime major version upgrades, selective data distribution, and multi-region active-active setups (via extensions like pglogical or BDR that add conflict resolution on top of the built-in primitive).
- Does not replicate DDL, sequences (by default), or large objects automatically — schema changes must be applied to the subscriber separately, which is the most common logical-replication gotcha in practice.

### Cascading replication
- A replica can itself be `primary_conninfo` source for another replica, reducing connection/WAL-fan-out load on the true primary — supported natively, no extra tooling needed.

---

## 6. Synchronous vs. Asynchronous Replication

| Mode | Data-loss risk on failover | Write latency impact | When to use |
|---|---|---|---|
| **Asynchronous** | Can lose the last few transactions not yet shipped | None | Read replicas, reporting, most DR scenarios where RPO > 0 is acceptable |
| **Semisynchronous (MySQL)** | Primary confirms at least one replica *received* the transaction before ack'ing the client | Adds one network round-trip | Balances safety and latency for most production HA setups |
| **Synchronous (PostgreSQL `synchronous_commit=on` + `synchronous_standby_names`)** | Zero data loss for committed transactions, as long as the named synchronous replica was actually up | Adds latency = round-trip to the sync replica | Financial/compliance workloads where RPO must be exactly zero |
| **Fully synchronous multi-node (Group Replication in a strict mode, or quorum-based systems)** | Zero data loss, tolerant of a single node failure | Higher latency, throughput capped by the slowest quorum member | Correctness-critical clusters where both RPO=0 and automatic failover are required simultaneously |

A synchronous replica that goes down **blocks all writes** on the primary unless configured with a fallback (`rpl_semi_sync_source_timeout` in MySQL; PostgreSQL's `synchronous_standby_names` supports quorum syntax like `ANY 1 (replica1, replica2)` so any one of several can satisfy the requirement) — always plan for this failure mode explicitly, not just the happy path.

---

## 7. Automatic Failover Tooling

| Tool | Engine | Consensus mechanism | Notes |
|---|---|---|---|
| **Patroni** | PostgreSQL | External DCS (etcd/Consul/ZooKeeper) | The long-standing standard for PostgreSQL HA; a daemon runs alongside each node, uses a distributed lock for leader election, integrates with HAProxy/pgBouncer for client routing |
| **Orchestrator** | MySQL (original), now also PostgreSQL | Its own topology-discovery + voting logic; no external DCS required | Started at Outbrain/Booking.com/GitHub as a MySQL-only topology manager; briefly archived, then revived and actively maintained under ProxySQL as of April 2026, which also added a PostgreSQL provider (`pg_is_in_recovery`, `pg_promote()`-based) — genuinely new capability worth knowing about if your last mental model of Orchestrator was "MySQL-only" |
| **MySQL Group Replication / InnoDB Cluster** | MySQL | Built-in Paxos-derived consensus | No external tooling needed; tightest integration but MySQL-specific |
| **MHA (Master High Availability)** | MySQL | Script-based, no live consensus | Older, still deployed in legacy environments; largely superseded by Group Replication or Orchestrator for new builds |
| **repmgr** | PostgreSQL | Its own metadata + optional witness node | Lighter-weight alternative to Patroni for simpler topologies; less commonly used for fully automatic failover in large fleets |

**Choosing between Patroni and Orchestrator for Postgres today:** Patroni requires you to run and operate an external consensus store (etcd/Consul/ZooKeeper) but has years of production hardening; Orchestrator's PostgreSQL support is newer but appeals if you're already running Orchestrator for MySQL and want one failover brain across both engines, or want to avoid standing up a separate DCS. Evaluate both against your existing operational footprint rather than defaulting to whichever is more familiar.

---

## 8. Split-Brain Prevention (Fencing)

- **STONITH ("Shoot The Other Node In The Head")**: the failover controller forcibly powers off, reboots, or network-isolates the old primary before letting a new one accept writes — the surest way to guarantee only one primary is ever reachable.
- **Fencing via the proxy layer**: route all client connections through ProxySQL/HAProxy/pgBouncer and have the failover controller reconfigure the proxy's backend atomically as part of promotion, so old-primary traffic simply has nowhere to go even if the old primary is technically still up.
- **Watchdog timers**: Patroni supports a hardware or software watchdog that self-fences a node that loses contact with the DCS for too long, rather than relying purely on the DCS's view of the world.
- **Never rely on "the old primary will just notice and step down"** — a partitioned primary that can't reach the DCS/consensus group but can still reach clients is exactly the split-brain scenario fencing exists to prevent.

---

## 9. Replication Lag: Causes & Mitigation

| Cause | Mitigation |
|---|---|
| Single-threaded replica apply (older MySQL) | Enable multi-threaded replication (`replica_parallel_workers` / `slave_parallel_workers` > 1, with `LOGICAL_CLOCK` parallelization) |
| Large, unindexed writes replaying serially | Fix the underlying query/index on the primary — replicas replay the *effects* of statements, so a slow write is slow everywhere |
| Long-running transactions holding back replay | Enforce transaction-length limits/timeouts; a replica generally can't apply changes past a lock held by an in-flight long transaction |
| Network bandwidth/latency to a cross-region replica | Compress WAL/binlog shipping, or accept async replication with a wider RPO for that specific replica |
| Replica hardware weaker than primary | Match hardware for any replica in the failover pool; under-provisioned "just for reads" replicas make poor failover targets |
| A replication slot held by an offline consumer (PostgreSQL) | Monitor `pg_replication_slots` for slots with growing `pg_wal` retention and drop/fix stale ones before they fill the primary's disk |

Monitor lag as a first-class SLO, not an afterthought — `Seconds_Behind_Source` (MySQL) and the LSN gap on `pg_stat_replication` (PostgreSQL) should both feed into alerting with thresholds tied to your actual RPO.

---

## 10. Manual Failover Runbook

Even with automatic tooling, every DBA should be able to do this by hand:

1. **Confirm the primary is actually down** (not a network partition that would cause split-brain if you promote too eagerly) — check from multiple vantage points.
2. **Pick the most caught-up replica** — compare GTID sets (MySQL) or `replay_lsn` (PostgreSQL) across all replicas; the one with the highest applied position has the least data loss.
3. **Fence the old primary** if there's any chance it's still reachable by clients (see [Section 8](#8-split-brain-prevention-fencing)).
4. **Promote**: `RESET REPLICA ALL;` then reconfigure as writable (MySQL), or `pg_ctl promote` / `SELECT pg_promote();` (PostgreSQL).
5. **Repoint remaining replicas** to replicate from the new primary.
6. **Repoint the application/proxy layer** to the new primary's connection endpoint.
7. **Verify writes are flowing and lag is recovering** on all remaining replicas before declaring the incident resolved.
8. **Post-incident**: rebuild the old primary as a new replica (don't just "fix and reuse" without confirming its data didn't diverge) and document the actual RTO achieved against the target.

---

## 11. Conflict Resolution in Multi-Primary Setups

Multi-primary/active-active replication (Section 3) introduces a problem single-primary topologies never face: two nodes can accept conflicting writes to the same row before either has seen the other's change.

| Conflict type | Example | Typical resolution strategy |
|---|---|---|
| **Update-update** | Node A and Node B both `UPDATE` the same row within the replication lag window | Last-write-wins (LWW) by timestamp (simplest, but silently discards one update — acceptable for some workloads, unacceptable for financial data), or application-defined merge logic |
| **Insert-insert (PK collision)** | Both nodes `INSERT` a row with the same primary key (common with auto-increment IDs generated independently on each node) | Avoid entirely by design: use UUIDs or node-prefixed sequences (e.g., odd IDs on node A, even on node B) so PK collisions are structurally impossible, rather than relying on conflict resolution to clean up after the fact |
| **Update-delete** | Node A updates a row that Node B concurrently deletes | Usually resolved as "delete wins," but this is a policy choice, not a law of nature — verify what your specific tooling does by default |
| **Unique constraint violation** | Two nodes insert different rows that both satisfy a unique constraint post-merge | Often surfaces as outright replication failure requiring manual intervention, rather than automatic resolution — the most disruptive conflict class |

**PostgreSQL (BDR/pglogical)**: exposes configurable conflict-resolution policies per table (last-update-wins, first-update-wins, or a custom conflict-handling function) — BDR in particular logs every conflict it resolves, which is essential for auditing whether the automatic resolution is actually acceptable for a given table's data.

**MySQL Group Replication in multi-primary mode**: uses certification-based conflict detection — a transaction that would conflict with one already certified on another node is aborted and rolled back on the node that tried to commit it second, surfaced to the application as a transaction failure to retry, rather than silently resolved server-side.

**The practical, most common answer**: avoid needing conflict resolution at all by routing writes for any given row (or any given tenant/shard/partition) to exactly one primary at a time, even within a nominally multi-primary cluster — "multi-primary" doesn't have to mean "every node can write every row concurrently." Reserve true concurrent-write conflict resolution for the specific use cases (multi-region write locality with genuinely partitionable data) where the complexity is actually justified.

---

## 12. Delayed Replicas & Cross-Cloud Replication

**Delayed (time-lagged) replicas** intentionally apply changes some fixed interval behind the primary — a deliberate, different tool from ordinary HA replicas:
```sql
-- PostgreSQL
ALTER SYSTEM SET recovery_min_apply_delay = '4h';
```
```sql
-- MySQL
CHANGE REPLICATION SOURCE TO SOURCE_DELAY = 14400;  -- seconds
```
- **Purpose**: a human-error safety net distinct from PITR — if someone runs a bad `UPDATE`/`DELETE` against production, a 4-hour-delayed replica gives a 4-hour window to notice and stop replication on that replica *before* the bad statement reaches it, at which point it becomes a same-engine, no-log-replay-needed source for recovering the lost data.
- **Trade-off**: a delayed replica is not usable as a normal HA failover target (it's, by design, stale) and needs its own dedicated purpose in the topology — don't count it toward your failover replica pool.
- **Complements, doesn't replace, PITR** — PITR can recover from any point given a full backup and continuous logs; a delayed replica is faster/simpler for the specific "someone just fat-fingered a statement and we caught it within the delay window" case, without needing to provision a scratch instance and replay logs at all.

**Cross-cloud replication** (e.g., an AWS-hosted primary replicating to a GCP or on-prem replica) is a legitimate DR-diversification pattern (avoiding a shared-provider failure domain, per the HA/DR cheatsheet) but has its own sharp edges:
- **Network path is now the public internet or a dedicated interconnect**, not intra-VPC networking — latency, bandwidth cost, and reliability are all materially different, and synchronous replication across clouds is rarely practical for this reason.
- **Egress bandwidth costs** for continuous WAL/binlog streaming across cloud providers are a real, recurring line-item cost that's easy to underestimate when only thinking about the DR benefit.
- **Managed-service replication features often don't span providers** — AWS RDS's native cross-region read replicas, for instance, only replicate within AWS; a genuinely cross-cloud replica usually means self-managing the replication layer (a self-hosted instance on the second provider, configured with standard `CHANGE REPLICATION SOURCE`/`primary_conninfo` replication) rather than a managed-service feature doing it for you.
- **Security posture must be replicated too**, not just data — encryption in transit across the public internet, IP allowlisting, and credential management for the cross-cloud replication connection all need the same rigor as the primary's own access controls.

---

## 13. Worked Examples

### Example 1 — Patroni-managed PostgreSQL cluster: config and a real failover
A 3-node PostgreSQL cluster (`pg1` primary, `pg2`/`pg3` replicas) managed by Patroni with a 3-node etcd cluster as the DCS.
```yaml
# patroni.yml (abridged, on pg1)
scope: prod-cluster
name: pg1
restapi:
  listen: 0.0.0.0:8008
etcd3:
  hosts: etcd1:2379,etcd2:2379,etcd3:2379
bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 10
    maximum_lag_on_failover: 1048576   # 1 MB — a replica lagging more than this is disqualified from promotion
    postgresql:
      use_pg_rewind: true
      parameters:
        synchronous_commit: "on"
        synchronous_standby_names: "ANY 1 (pg2,pg3)"
```
Failover sequence when `pg1` crashes:
1. Patroni agents on `pg2`/`pg3` notice `pg1`'s key in etcd has expired (missed its TTL renewal).
2. The etcd cluster's consensus ensures only one Patroni agent can acquire the now-vacant leader lock.
3. Patroni compares `pg2` and `pg3`'s replay positions; `pg2` is more caught up (it was the synchronous standby, per `synchronous_standby_names`), so it wins the lock.
4. `pg2`'s Patroni agent runs `pg_promote()` and updates its DCS leader key.
5. `pg3`'s Patroni agent notices the new leader key and reconfigures its `primary_conninfo` to point at `pg2`.
6. HAProxy/pgBouncer, configured to poll Patroni's REST API (`/master`, `/replica` health-check endpoints), redirects traffic to `pg2` within one health-check interval.
7. Total observed downtime in this scenario: typically 10-30 seconds, bounded mostly by `ttl`/`loop_wait` and the proxy's health-check polling interval — both tunable, with a real trade-off between faster failover detection and more false-positive failovers from transient blips.

### Example 2 — MySQL Group Replication: a three-node cluster surviving a node loss
A 3-node InnoDB Cluster, single-primary mode.
```
mysql-shell> dba.createCluster('prodCluster')
mysql-shell> cluster.addInstance('node2:3306')
mysql-shell> cluster.addInstance('node3:3306')
mysql-shell> cluster.status()
```
- Under normal operation, `node1` is the read-write primary; `node2`/`node3` are read-only secondaries applying certified transactions via Group Replication's Paxos-derived protocol.
- `node1` suffers a hardware failure. Because the group maintains a live membership view via its consensus protocol (not an external DCS), the remaining two nodes (`node2`, `node3`) — still a majority of the original 3 — detect the loss and automatically elect a new primary among themselves within seconds, with MySQL Router (which continuously polls group membership) redirecting new connections to the new primary immediately.
- **The key structural point**: with only 3 nodes, losing 1 still leaves a majority (2 of 3) able to reach quorum and continue accepting writes. Losing 2 of 3 simultaneously would leave the group unable to reach quorum, and the surviving single node would correctly refuse to accept writes rather than risk operating without consensus — this is exactly the CP (consistency-over-availability) behavior described in the HA/DR cheatsheet's CAP theorem discussion, and it's why group sizes are chosen odd and sized to tolerate the expected simultaneous-failure count (a 3-node group tolerates 1 failure; a 5-node group tolerates 2).

### Example 3 — Diagnosing and fixing chronic replication lag
A read replica is consistently 45-90 seconds behind its MySQL primary during business hours, causing stale-read complaints from a reporting dashboard that queries it directly.
1. **Check `SHOW REPLICA STATUS\G`**: `Seconds_Behind_Source` confirms the lag; `Replica_SQL_Running_State` shows the replica thread is actively applying, not stalled — so this is a throughput problem, not a stuck-replica problem.
2. **Check parallelism**: `SHOW VARIABLES LIKE 'replica_parallel_workers';` returns `1` — the replica is applying changes single-threaded despite the primary having a high write rate across many independently-updated tables.
3. **Fix**: set `replica_parallel_workers = 8` and `replica_parallel_type = LOGICAL_CLOCK` (allows genuinely independent transactions, as determined by the primary's own commit-ordering metadata, to apply concurrently on the replica).
4. **Re-measure**: lag drops to under 2 seconds during the same business-hour load — confirming the bottleneck was serial apply throughput, not network bandwidth or replica hardware.
5. **Follow-up**: because the reporting dashboard's staleness tolerance turned out to be "a couple of seconds is fine, 90 seconds was not," this also becomes a concrete, measured input to that dashboard's documented RPO — worth writing down so the next lag investigation starts from a known acceptable threshold instead of a vague complaint.

---

## 14. Gotchas

- **`STATEMENT`-based binlog format can silently diverge** replicas from the primary on non-deterministic SQL (`NOW()`, `RAND()`, `UUID()` evaluated per-replica instead of once) — `ROW` format avoids this entirely and is the modern default for good reason.
- **A replication slot with no connected replica is a ticking disk-fill timer** on PostgreSQL primaries — always monitor slot lag, not just replica lag.
- **Logical replication does not replicate DDL** — a schema migration must be applied to the subscriber independently, and forgetting this is the single most common cause of "replication just stopped" tickets on logical setups.
- **Synchronous replication with no fallback quorum syntax blocks all writes** if the sole synchronous replica goes down — use `ANY n (...)` or `FIRST n (...)` quorum syntax in PostgreSQL, or a semisync timeout in MySQL, rather than a hard dependency on one specific node.
- **GTID sets must never be manually edited** without fully understanding `gtid_purged`/`gtid_executed` semantics — a mismatched GTID set between primary and replica is a common cause of replication breaking after a restore or a manual intervention.
- **Promoting the wrong replica (not the most caught-up one) during failover is a common, avoidable data-loss cause** — always compare position across *all* replicas before promoting, not just the first one that responds.
- **Fencing is not optional "extra security"** — an automatic failover system without fencing is a split-brain generator waiting for its first network partition.
- **Cross-region async replicas have a real, nonzero RPO** — don't let "we have a replica in another region" get quietly treated as equivalent to a synchronous, zero-data-loss DR posture without saying so explicitly in the runbook.
