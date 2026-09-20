# Disaster Recovery & Replication Cheatsheet for Data Engineers

> A structured reference for keeping data platforms resilient to failure — RTO/RPO definitions, backup strategies, multi-region replication patterns, failover procedures, and the trade-offs between different resilience architectures.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 Defining RTO and RPO](#defining-rto-and-rpo)
4. [🏗️ Backup Strategies](#backup-strategies)
5. [🌍 Replication Topologies](#replication-topologies)
6. [🔀 Active-Active vs Active-Passive](#active-active-vs-active-passive)
7. [🔁 Failover and Failback Procedures](#failover-and-failback-procedures)
8. [🧮 Replicating Pipelines, Not Just Data](#replicating-pipelines-not-just-data)
9. [🗂️ Point-in-Time Recovery](#point-in-time-recovery)
10. [🧯 Handling Partial/Corrupted Data Disasters](#handling-partialcorrupted-data-disasters)
11. [🛠️ Tooling Landscape](#tooling-landscape)
12. [🧪 Testing DR: Game Days and Chaos Drills](#testing-dr-game-days-and-chaos-drills)
13. [💰 Cost vs Resilience Trade-offs](#cost-vs-resilience-trade-offs)
14. [⚠️ Common Gotchas](#common-gotchas)
15. [✅ Best Practices Checklist](#best-practices-checklist)
16. [📚 Backup vs Replication vs Multi-Region Active-Active](#backup-vs-replication-vs-multi-region-active-active)
17. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| RTO | Recovery Time Objective — how long can we be down? |
| RPO | Recovery Point Objective — how much data can we afford to lose? |
| Backup | Point-in-time snapshots, tested restores, retained per compliance need |
| Replication | Continuous copy to a second region/cluster, for near-zero RPO |
| Failover | A defined, rehearsed procedure — not a plan that's only ever been discussed |
| Pipelines | Orchestrator DAGs, transform code, and configs need DR too, not just data |
| Common tools | Cloud-native cross-region replication, warehouse Time Travel/Fail-safe, Velero-style backup tooling |

## 🧠 Core Concept

Disaster recovery is the deliberate practice of ensuring that when something catastrophic happens — a region outage, accidental mass deletion, ransomware, a corrupted migration — the data platform can be restored to a known-good state within an **agreed, tested time and data-loss budget**, rather than discovering during the actual incident what's actually possible.

```text
Normal operation --> [DISASTER: region outage / mass deletion / corruption] --> Recovery
                                                                                    │
                            RPO: how much data lost? <──────────────────────────────┤
                            RTO: how long until restored and serving again? <───────┘
```

## 🎯 Defining RTO and RPO

```yaml
# RTO/RPO are BUSINESS decisions, not engineering defaults — define them per system,
# based on actual cost-of-downtime and cost-of-data-loss, not a one-size-fits-all number
disaster_recovery_targets:
  production_warehouse:
    rto: "4 hours"      # max acceptable time to restore service
    rpo: "15 minutes"   # max acceptable data loss
  analytics_sandbox:
    rto: "3 days"        # much lower business criticality
    rpo: "24 hours"
```

| Metric | Question it answers | Drives |
|---|---|---|
| RTO (Recovery Time Objective) | How long can this system be unavailable? | Failover architecture (standby cluster ready vs restore-from-backup) |
| RPO (Recovery Point Objective) | How much data can we afford to lose? | Backup/replication frequency (continuous replication vs nightly backup) |

A tight RTO/RPO (minutes) requires continuous replication and a warm/hot standby; a loose RTO/RPO (a day) can be satisfied by nightly backups — **matching the architecture to the actual business requirement, not over- or under-building, is the whole design problem.**

## 🏗️ Backup Strategies

```sql
-- Warehouse-native time travel / fail-safe as a first line of defense against accidental deletion
-- (Snowflake: query data as it existed before an accidental DELETE/DROP)
SELECT * FROM mart.orders AT (OFFSET => -3600);   -- as of 1 hour ago
UNDROP TABLE mart.orders;                          -- recover a dropped table within the retention window
```

```bash
# Object storage snapshots/versioning as the backup layer for lakehouse tables
aws s3api put-bucket-versioning --bucket lake-bucket --versioning-configuration Status=Enabled
```

```python
def scheduled_backup_job():
    """Backups need to be tested restores, not just successful export jobs —
    an untested backup is a hope, not a plan."""
    snapshot_path = export_snapshot("mart.orders", destination="s3://backups/orders/")
    verify_restore(snapshot_path, target="restore_verification_schema.orders")
    assert row_count("restore_verification_schema.orders") == row_count("mart.orders")
```

| Backup type | RPO achievable | Cost |
|---|---|---|
| Nightly full export | Up to 24 hours | Low |
| Warehouse time travel/fail-safe | Minutes to the retention window | Low-medium (built into most warehouses) |
| Continuous replication | Near-zero | Higher (always-on infrastructure) |

## 🌍 Replication Topologies

```text
Single-region:              [Primary region only] — no DR beyond backups
Active-passive (warm standby): [Primary region] --continuous replication--> [Standby region, idle until failover]
Active-active:               [Region A] <--bidirectional replication--> [Region B], both serving traffic
```

```sql
-- Cross-region replication configured at the warehouse level (Snowflake example)
CREATE DATABASE analytics_db_replica AS REPLICA OF analytics_db
  ON ACCOUNT secondary_account IN REGION 'us-west-2';

ALTER DATABASE analytics_db_replica REFRESH;   -- or scheduled automatically
```

Choosing a topology is fundamentally a **RTO/RPO-driven decision**: active-active gives the tightest RTO (traffic just routes elsewhere, no failover delay) at the highest cost and complexity; active-passive is a middle ground; backups-only accepts the loosest RTO/RPO at the lowest cost.

## 🔀 Active-Active vs Active-Passive

| Dimension | Active-Passive | Active-Active |
|---|---|---|
| Standby region traffic | Idle until failover | Actively serving traffic |
| RTO | Minutes (failover time) | Near-zero (already serving) |
| Cost | Lower (standby is often smaller/cheaper) | Higher (full capacity in both regions) |
| Complexity | Moderate | High (bidirectional replication conflict handling) |
| Common for | Most data platforms | Extremely high-availability requirements (financial trading, global consumer platforms) |

Most data platforms — as opposed to the transactional application layer — are well served by **active-passive** with a well-tested failover procedure; active-active's added complexity (especially around write-conflict resolution) is rarely justified for analytical workloads where a few minutes of failover time is acceptable.

## 🔁 Failover and Failback Procedures

```python
def execute_failover(target_region: str):
    """A failover procedure needs to be a documented, tested RUNBOOK — not
    something improvised for the first time during an actual outage."""
    verify_standby_is_current(target_region, max_lag_minutes=15)   # confirm RPO is actually met
    promote_standby_to_primary(target_region)
    update_dns_or_routing(target_region)
    notify_stakeholders(f"Failed over to {target_region}")
    verify_pipelines_resume_correctly(target_region)

def execute_failback(original_region: str):
    """Failing back is often riskier than failing over — the original region's
    data may have diverged during the outage and needs careful reconciliation."""
    reconcile_divergent_writes(original_region)
    resync_original_region_as_standby(original_region)
    schedule_planned_cutover_window(original_region)
```

Failback is frequently under-planned — teams rehearse failing over to the DR region but not the (often trickier) process of safely returning to the original primary once it's healthy again.

## 🧮 Replicating Pipelines, Not Just Data

```yaml
# DR planning that only covers DATA and forgets the PIPELINES that produce it
# leaves you with backed-up raw data and no way to regenerate anything from it
disaster_recovery_scope:
  data: [warehouse tables, lakehouse files, backups]
  pipelines: [orchestrator DAG definitions, transform code, dbt models]  # often forgotten
  configuration: [connection secrets, environment configs, IAM roles]     # also often forgotten
  infrastructure: [Terraform/IaC definitions for recreating compute]
```

A genuinely complete DR plan treats **orchestrator DAGs, transform code, secrets, and infrastructure-as-code** as recovery targets alongside the data itself — restoring a perfect data backup into a region with no pipelines, no orchestrator, and no way to authenticate is not a functioning recovery.

## 🗂️ Point-in-Time Recovery

```sql
-- Recovering to a specific point BEFORE a bad migration or accidental mass update
CREATE TABLE mart.orders_recovered CLONE mart.orders AT (TIMESTAMP => '2026-09-17 08:00:00');

-- Validate the recovered state before cutting over
SELECT COUNT(*) FROM mart.orders_recovered;
```

```python
def point_in_time_recovery(table: str, target_timestamp: str):
    """Point-in-time recovery is what separates 'restore from yesterday's backup'
    (losing up to a day of data) from 'restore to 30 seconds before the bad deploy'."""
    recovered = clone_table_at_timestamp(table, target_timestamp)
    validate_recovered_state(recovered, expected_row_count_range=get_historical_range(target_timestamp))
    return recovered
```

Point-in-time recovery capability (via warehouse time travel, WAL-based database replay, or versioned lakehouse table snapshots) is what makes RPOs tighter than "since the last nightly backup" achievable without needing full continuous replication infrastructure.

## 🧯 Handling Partial/Corrupted Data Disasters

```python
def handle_partial_corruption(table: str, corruption_detected_at: str):
    """Not every disaster is a full outage — a bad deploy corrupting SOME rows
    needs a different response than a full region failure."""
    last_known_good_snapshot = find_snapshot_before(table, corruption_detected_at)
    diff = compute_diff(current_state=table, known_good=last_known_good_snapshot)
    if diff.affected_row_count < SELECTIVE_RESTORE_THRESHOLD:
        selectively_restore_affected_rows(table, diff)   # targeted fix, avoid a full rollback
    else:
        full_point_in_time_restore(table, corruption_detected_at)
```

Partial corruption is far more common than full outages and often needs a **surgical, targeted restore** rather than a blunt full-table rollback that would also discard legitimate changes made after the corruption occurred.

## 🛠️ Tooling Landscape

| Category | Tools |
|---|---|
| Warehouse-native | Snowflake Time Travel/Fail-safe/replication, BigQuery table snapshots, Redshift cross-region snapshots |
| Lakehouse | Delta Lake/Iceberg time travel (see [data-lakehouse.md](./Data_Lakehouse_Cheat_Sheet.md#time-travel-and-versioning)), S3 versioning/replication |
| Kubernetes/infra backup | Velero, cloud-native cross-region infra replication |
| Orchestrator/config DR | Git (DAGs/transform code as the source of truth), Terraform state replication, secrets manager cross-region replication |

## 🧪 Testing DR: Game Days and Chaos Drills

```python
def run_dr_game_day():
    """Regularly SIMULATE a disaster in a controlled way — an untested DR plan
    is a hypothesis, not a capability."""
    start_time = now()
    simulate_region_failure(region="us-east-1")
    execute_failover(target_region="us-west-2")
    actual_rto = now() - start_time
    assert actual_rto <= TARGET_RTO, f"Failover took {actual_rto}, exceeding RTO of {TARGET_RTO}"
    verify_data_matches_rpo_expectation(max_acceptable_loss=TARGET_RPO)
    document_lessons_learned()
```

| Drill type | What it validates |
|---|---|
| Backup restore test | Backups are actually restorable, not just "successfully exported" |
| Failover game day | The full failover runbook works end to end, within the target RTO |
| Chaos engineering (random component kill) | The system degrades gracefully under partial, unplanned failure, not just the scenarios explicitly planned for |

## 💰 Cost vs Resilience Trade-offs

| Investment level | RTO/RPO achievable | Relative cost |
|---|---|---|
| Backups only | Hours to a day | Lowest |
| Active-passive with continuous replication | Minutes | Moderate |
| Active-active multi-region | Near-zero | Highest |

Every tier up in resilience roughly multiplies cost and operational complexity — the right investment level is the one that matches the **actual, business-agreed** cost of downtime and data loss, not the theoretical maximum resilience available.

## ⚠️ Common Gotchas

- **RTO/RPO never explicitly defined** — without agreed numbers, "how much DR investment is enough" has no answer, and the actual capability built rarely matches unstated expectations.
- **Backups that are never tested for restore** — a backup job reporting "success" tells you the export completed, not that the data is actually recoverable.
- **DR plans covering only data, forgetting pipelines/config/secrets** — a perfectly restored dataset with no orchestrator, no transform code, and no credentials isn't a functioning recovery.
- **Failover rehearsed, failback never rehearsed** — returning to the original region after it recovers is often riskier and more complex than the failover itself.
- **A full-table rollback used for partial/selective corruption** — discarding legitimate post-corruption changes when a targeted restore would have sufficed.
- **DR plans that exist only as documents, never exercised as game days** — an untested plan reliably fails in ways nobody anticipated during an actual incident.

## ✅ Best Practices Checklist

- [ ] RTO and RPO are explicitly defined per system, based on actual business cost of downtime/data loss
- [ ] Backups are regularly tested with an actual restore, not just verified as "exported successfully"
- [ ] DR scope covers pipelines, configuration, and secrets — not data alone
- [ ] A documented, rehearsed failover runbook exists, not just a discussed plan
- [ ] Failback procedures are planned and rehearsed, not assumed to be the reverse of failover
- [ ] Point-in-time recovery capability exists for tighter-than-nightly-backup RPOs
- [ ] Regular DR game days validate actual RTO/RPO against targets

## 📚 Backup vs Replication vs Multi-Region Active-Active

| Dimension | Backup | Replication (Active-Passive) | Active-Active |
|---|---|---|---|
| RPO | Hours-to-day | Minutes | Near-zero |
| RTO | Hours (restore time) | Minutes (failover time) | Near-zero |
| Cost | Lowest | Moderate | Highest |
| Complexity | Low | Moderate | High |
| Best fit | Most systems, non-critical data | Business-critical analytics platforms | Extreme availability requirements only |

## 💡 Pro Tips

1. **Define RTO/RPO as explicit business decisions per system** before designing any DR architecture — the numbers should drive the design, not the other way around.
2. **Test every backup with an actual restore**, on a schedule — an unrestored backup is unverified.
3. **Include pipelines, secrets, and infrastructure-as-code in DR scope**, not just the data itself.
4. **Rehearse failback, not just failover** — it's usually the harder, less-practiced half of the procedure.
5. **Use point-in-time recovery capability** (warehouse time travel, lakehouse snapshots) for RPOs tighter than a nightly backup can achieve, without needing full active-active infrastructure.
6. **Build a targeted/selective restore path for partial corruption** — don't force every recovery scenario through a full-table rollback.
7. **Run regular DR game days**, measuring actual RTO/RPO against targets, not just discussing the plan in a document.
8. **Default to active-passive for analytical workloads** — active-active's complexity is rarely justified outside extreme availability requirements.
9. **Treat DAG/transform code in version control as itself a form of DR** — a Git repo is a trivially portable, always-current backup of your pipeline logic.
10. **Revisit RTO/RPO targets periodically** — what was "critical" or "acceptable to lose a day of" when the system launched often changes as the business grows around it.
