# High Availability & Disaster Recovery Cheatsheet

A DBA-focused reference for planning around RTO/RPO, designing multi-region and multi-AZ topologies, and the operational discipline (drills, runbooks, SLAs) that turns a DR plan on paper into one that actually works during a real incident.

> This cheatsheet is intentionally engine-agnostic and architectural — it complements the [Replication & Failover](Replication_Failover_Cheatsheet.md) and [Backup & Recovery](Backup_Recovery_Cheatsheet.md) cheatsheets, which cover the MySQL/PostgreSQL-specific mechanics referenced here.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Quick Reference Table](#2-quick-reference-table)
3. [RTO & RPO: Defining Your Actual Requirements](#3-rto--rpo-defining-your-actual-requirements)
4. [HA Architecture Tiers](#4-ha-architecture-tiers)
5. [Multi-AZ vs. Multi-Region](#5-multi-az-vs-multi-region)
6. [The CAP Theorem, Practically Applied](#6-the-cap-theorem-practically-applied)
7. [DR Strategies](#7-dr-strategies)
8. [Failover Automation vs. Human-in-the-Loop](#8-failover-automation-vs-human-in-the-loop)
9. [Building and Testing a DR Runbook](#9-building-and-testing-a-dr-runbook)
10. [Availability Math: What "Nines" Actually Cost](#10-availability-math-what-nines-actually-cost)
11. [DR for Cloud-Managed Databases](#11-dr-for-cloud-managed-databases)
12. [Cost Modeling: HA/DR Spend vs. Risk](#12-cost-modeling-hadr-spend-vs-risk)
13. [Sample DR Runbook Template](#13-sample-dr-runbook-template)
14. [Worked Examples](#14-worked-examples)
15. [Gotchas](#15-gotchas)

---

## 1. Core Concepts

| Concept | What it means |
|---|---|
| **RTO (Recovery Time Objective)** | How long the business can tolerate being down. Drives architecture: minutes → hot standby; hours → warm/cold standby or restore-from-backup is acceptable. |
| **RPO (Recovery Point Objective)** | How much data the business can tolerate losing, measured in time. Drives replication mode: RPO=0 → synchronous replication; RPO of minutes → asynchronous replication or frequent log shipping is fine. |
| **High Availability (HA)** | Architecture that survives the failure of individual components (a node, a disk, a rack) without a full outage — usually addresses the *common* failure modes within one site/region. |
| **Disaster Recovery (DR)** | Architecture and process for recovering from the loss of an entire site/region/provider — addresses *rare, large-blast-radius* failures that HA alone doesn't cover. |
| **Hot standby** | A fully running, continuously replicating replica ready to be promoted in seconds — minimizes RTO, at the cost of running (and paying for) duplicate infrastructure at all times. |
| **Warm standby** | Infrastructure exists and is kept reasonably current (e.g., replication with some lag, or frequent restores) but requires some manual/scripted steps to become fully active — a middle ground on cost vs. RTO. |
| **Cold standby** | Infrastructure must be provisioned and data restored from backup when needed — cheapest to maintain, longest RTO. |
| **Blast radius** | The scope of what a given failure takes down. A well-designed HA/DR architecture ensures no single failure's blast radius includes both the primary and every path to recovering from it. |
| **Failure domain** | A boundary within which failures are correlated — a rack, an availability zone, a region, a cloud provider, a DNS provider. Real resilience means your replicas/backups don't share a failure domain with the thing they're meant to protect against. |
| **Chaos engineering / game days** | Deliberately injecting failures in a controlled way to validate that HA/DR mechanisms work as designed, rather than trusting the architecture diagram. |

---

## 2. Quick Reference Table

| Requirement | Typical architecture |
|---|---|
| RTO: seconds, RPO: zero | Synchronous multi-node cluster with automatic failover (Patroni + sync replication, or Group Replication) within one region |
| RTO: minutes, RPO: near-zero | Async hot standby + automatic failover tooling, single region, multi-AZ |
| RTO: tens of minutes, RPO: seconds-to-minutes | Cross-region async replica, manual or semi-automated promotion |
| RTO: hours, RPO: hours | Warm standby restored periodically from backups, or backup-based cross-region DR |
| RTO: many hours/days, RPO: last nightly backup | Cold standby / restore-from-backup only, acceptable for genuinely non-critical systems |
| Zero data loss AND survive a full region outage | Synchronous cross-region replication — rare, expensive (speed of light imposes real latency floors over distance), used only for the highest-tier financial/regulatory workloads |

---

## 3. RTO & RPO: Defining Your Actual Requirements

- **RTO/RPO are business decisions, not technical ones** — a DBA can implement whatever target is set, but *setting* the target requires input from whoever owns the cost of downtime and the cost of data loss for that specific system. A DBA proposing "we should have zero RPO" without that conversation is solving the wrong problem (and often overpaying for it).
- **Different systems within the same organization can have wildly different RTO/RPO** — a payments ledger and an internal analytics warehouse are not the same tier, and treating them identically wastes money on one and under-protects the other.
- **RTO and RPO should be written down as an actual SLA**, not an assumption — "we think we can restore in about an hour" is not the same as a tested, documented, agreed-upon number.
- **The gap between assumed and measured RTO is almost always in the DBA's favor to close early** — see [Section 9](#9-building-and-testing-a-dr-runbook); most organizations discover their real RTO is significantly worse than assumed the first time they actually time a full drill.

---

## 4. HA Architecture Tiers

| Tier | Description | Typical RTO |
|---|---|---|
| **Tier 0 — single instance** | No replica at all, backups only | Hours (restore time) |
| **Tier 1 — single-region replica** | One or more async/sync replicas in the same region, manual or semi-automated failover | Minutes to tens of minutes |
| **Tier 2 — single-region automated failover** | Patroni/Orchestrator/Group Replication managing failover automatically within a region | Seconds to low minutes |
| **Tier 3 — multi-AZ automated failover** | Tier 2, with replicas spread across availability zones so a single-AZ outage doesn't take down the whole cluster | Seconds to low minutes, survives AZ-level failure |
| **Tier 4 — multi-region** | A DR replica (or full standby cluster) in a separate region, for surviving a regional-scale outage | Minutes to hours, depending on automation and network distance |
| **Tier 5 — multi-region active-active** | Multiple regions both accepting writes, with conflict resolution | Near-zero RTO for regional failure, at the cost of significant architectural complexity |

Most production systems should land on Tier 2 or 3 by default; Tier 4/5 should be a deliberate choice justified by actual business requirements, not a default "more is better" upgrade — the operational complexity and failure modes introduced by multi-region/active-active setups are real and non-trivial.

---

## 5. Multi-AZ vs. Multi-Region

| | Multi-AZ | Multi-Region |
|---|---|---|
| **Protects against** | Rack/data-center/power/network failure within one metro area | Regional-scale disaster (natural disaster, regional cloud provider outage, regional network partition) |
| **Typical latency between nodes** | Single-digit milliseconds — synchronous replication is practical | Tens to hundreds of milliseconds — synchronous replication imposes real, user-visible write latency |
| **Cost** | Moderate — still paying for redundant compute/storage, but within one region's networking | Higher — cross-region data transfer costs, and often fully duplicated infrastructure |
| **Typical replication mode** | Synchronous or semi-synchronous is realistic | Usually asynchronous, unless the workload can tolerate the latency cost of synchronous |
| **Common mistake** | Treating "multi-AZ" as sufficient DR — it is not; it does not protect against a regional outage, a bad deploy that corrupts data everywhere, or a compromised credential that has access to all AZs equally |

**A very common gap**: an organization believes it has "DR" because it runs multi-AZ, when multi-AZ only provides HA against infrastructure failure — it does nothing to protect against data corruption, a bad migration, or ransomware, all of which replicate faithfully to every AZ. That's what backups (a separate, non-replicated recovery mechanism) are for — see the Backup & Recovery cheatsheet.

---

## 6. The CAP Theorem, Practically Applied

CAP says a distributed system can only guarantee two of **Consistency**, **Availability**, and **Partition tolerance** at once — and since network partitions *will* happen, the real choice in practice is between consistency and availability during a partition.

- **CP systems** (e.g., Patroni-managed PostgreSQL with a quorum-based DCS, MySQL Group Replication in strict mode): during a partition, the minority side refuses writes entirely rather than risk inconsistency — you get correctness, at the cost of availability for whoever's on the wrong side of the partition.
- **AP systems** (rare in traditional relational DBA territory, more common in NoSQL): both sides keep accepting writes during a partition and reconcile later — availability at the cost of potential conflicts to resolve afterward.
- **Most relational-database HA setups are CP by design**, because silent data divergence (split-brain) is considered worse than a temporary availability gap — this is *why* quorum-based failover tooling exists at all, and why a 2-node cluster with no tie-breaker is a fundamentally unsafe topology (a network partition leaves no way to determine which side has quorum).
- **Practical takeaway**: an odd number of voting members (3, 5) in your consensus layer (etcd/Consul/ZooKeeper cluster) is not a nice-to-have, it's what makes quorum-based split-brain prevention actually work — a 2-node or even-numbered voting setup can tie, and a tie in a CP system means nobody can safely proceed.

---

## 7. DR Strategies

| Strategy | Description | Trade-off |
|---|---|---|
| **Backup and restore** | No standing DR infrastructure; restore from backup into freshly provisioned infrastructure when disaster strikes | Cheapest, but RTO is measured in hours and depends entirely on how fast infrastructure can be stood up and data restored |
| **Pilot light** | Minimal DR infrastructure kept running (e.g., a small database instance continuously replicating) that gets scaled up to full production capacity only when needed | Lower steady-state cost than full standby, but scaling up takes time and needs to be tested, not assumed |
| **Warm standby** | A scaled-down but fully functional replica environment running continuously, promoted and scaled up during a real disaster | Faster RTO than pilot light, meaningfully higher steady-state cost |
| **Hot standby / multi-site active-active** | Full-scale infrastructure running in the DR site at all times, either idle-but-ready or actively serving traffic | Fastest RTO, highest steady-state cost, most operational complexity |

Choose based on the RTO/RPO actually agreed for that system (Section 3) — over-provisioning DR for a system that doesn't need it is a real, recurring cost with no corresponding benefit.

---

## 8. Failover Automation vs. Human-in-the-Loop

| | Fully automatic | Human-in-the-loop |
|---|---|---|
| **Speed** | Fastest — no waiting on a human to notice, decide, and act | Slower, bounded by on-call response time |
| **Risk of false-positive failover** | Real — a flaky health check or a transient network blip can trigger an unnecessary failover, which has its own cost (a brief outage, a promoted replica that then needs to be demoted again) | Lower — a human can sanity-check before promoting |
| **Best for** | Tier 2/3 HA within a region, where failure detection is reliable and the failure modes are well-understood | Tier 4/5 cross-region DR, where the decision to fail over an entire region has broad business implications (cost, data consistency guarantees, customer communication) beyond pure technical recovery |
| **Common practice** | Automate the *mechanics* even for human-triggered failover (a runbook that executes a tested script once a human says "go") rather than making the human execute every step manually under pressure | |

**A very common mistake**: automating regional/DR failover with the same aggressiveness as in-region HA failover — a region-level failover often has consequences (split traffic, data reconciliation, customer-facing impact) serious enough that most organizations deliberately keep a human decision point there, even while fully automating the technical promotion steps once that decision is made.

---

## 9. Building and Testing a DR Runbook

A DR plan that has never been executed is a hypothesis. Concrete program:

1. **Write the runbook as literal, executable steps** — not "restore the database," but the actual commands, connection strings, and decision points, kept somewhere accessible *even if the primary infrastructure and its usual documentation platform are both down*.
2. **Assign and rehearse roles** — who declares a disaster, who executes the runbook, who communicates status to stakeholders, who verifies success. Ambiguity here costs real minutes during an actual incident.
3. **Run scheduled game days**, at a cadence proportional to the system's tier (quarterly for Tier 3+, at least annually for anything with a documented DR plan at all) — actually fail over to the DR site/replica, actually time it, actually verify the application works end-to-end against the new primary.
4. **Measure the real RTO/RPO achieved** during each drill and compare against the documented target — a persistent gap is a finding that needs to change either the architecture or the stated SLA, not something to note and ignore.
5. **Test partial failures, not just total ones** — what happens if only the database fails over but the application's connection pooling doesn't reconnect correctly? What happens if DNS propagation for the new endpoint is slower than expected?
6. **Include the "undo" path** — failing back to the original primary/region after it's recovered is its own procedure with its own risks (data reconciliation, avoiding a second split-brain), and is frequently the less-tested half of the runbook.
7. **Update the runbook after every drill and every real incident** — a runbook that isn't kept current with actual infrastructure changes is worse than no runbook, because it creates false confidence.

---

## 10. Availability Math: What "Nines" Actually Cost

| Availability | Downtime/year | Downtime/month |
|---|---|---|
| 99% ("two nines") | ~3.65 days | ~7.3 hours |
| 99.9% ("three nines") | ~8.77 hours | ~43.8 minutes |
| 99.95% | ~4.38 hours | ~21.9 minutes |
| 99.99% ("four nines") | ~52.6 minutes | ~4.4 minutes |
| 99.999% ("five nines") | ~5.26 minutes | ~26 seconds |

Each additional nine typically costs disproportionately more in engineering complexity and infrastructure spend than the one before it — five-nines architectures generally require eliminating *every* single point of failure, including ones (a single cloud provider, a single DNS registrar, a single certificate authority) that are easy to overlook because they sit outside the database layer entirely. Match the target to genuine business need; most systems do not need, and should not pay for, five-nines.

---

## 11. DR for Cloud-Managed Databases

- **Managed-service "Multi-AZ" is HA, not DR** — it protects against infrastructure failure within a region, not a regional outage, account compromise, or logical/human-error data corruption that replicates everywhere automatically.
- **Cross-region read replicas** (available on most managed platforms) are the standard building block for cloud-native DR — but promotion is not always instant, and cross-region replicas are typically asynchronous, meaning a real RPO > 0 that should be measured, not assumed.
- **Backup exports to a separate region/account** remain necessary even with managed cross-region replication, specifically to protect against the scenario where the *account itself* is compromised or the *provider* has a broader outage than "one region" — a DR plan that only ever touches infrastructure within one cloud account has a shared failure domain with the very account it's meant to protect against.
- **Test managed-service failover explicitly** — the managed platform's documented failover time is a vendor claim, not a measured fact for your specific workload and data volume until you've actually triggered it (most platforms support a manual "failover test" specifically for this).

---

## 12. Cost Modeling: HA/DR Spend vs. Risk

A useful way to justify (or challenge) an HA/DR investment is to make the trade-off explicit in dollar terms rather than leaving it as an intuition.

**Expected cost of downtime** ≈ (downtime hours/year) × (revenue or cost impact per hour) — plus harder-to-quantify factors (reputational damage, regulatory penalties, customer churn) that should still be named explicitly even when they can't be precisely priced.

| Tier (from Section 4) | Rough infrastructure cost multiplier vs. Tier 0 | What it buys |
|---|---|---|
| Tier 1 (single-region replica) | ~1.5–2x | Protection against single-instance failure; RTO in minutes |
| Tier 2/3 (automated failover, multi-AZ) | ~2–3x | Automated recovery from infrastructure failure; RTO in seconds-minutes |
| Tier 4 (multi-region standby) | ~3–5x | Survives a regional outage; RTO in minutes-hours depending on automation |
| Tier 5 (active-active multi-region) | ~4–8x+, plus material engineering complexity cost | Near-zero RTO for regional failure, at the cost of conflict resolution and operational overhead |

**The decision framework**: if the expected annual cost of downtime at a given tier (probability of an outage at that severity × cost per hour × expected hours) exceeds the incremental cost of the next tier up, the next tier is justified; if not, it's over-engineering. This calculation is necessarily approximate — the point is making the reasoning explicit and revisitable, not producing a precise number nobody can defend.

**Common cost-modeling mistakes**:
- **Pricing only the infrastructure, not the operational complexity** — a Tier 5 active-active setup costs far more in ongoing engineering attention (conflict resolution bugs, more complex deploys, more failure modes to reason about) than its infrastructure bill alone suggests.
- **Treating "the business said it needs 99.99%" as fixed** without walking back to what that actually costs to deliver and confirming the business owner is looking at the real number, not a round figure picked without context.
- **Not revisiting the tier as the system's actual business criticality changes** — a system that started as an internal tool and grew into a customer-facing revenue driver may have long outgrown the HA tier it was provisioned at during its original, lower-stakes rollout.

---

## 13. Sample DR Runbook Template

A concrete skeleton to adapt, following the "literal, executable steps" principle from Section 9:

```markdown
# DR Runbook: [System Name]
Last reviewed: [date]  |  Last drilled: [date]  |  Measured RTO: [actual] vs. Target: [SLA]

## Declaration Criteria
- [ ] Primary region/database unreachable for > [N] minutes from [monitoring source]
- [ ] Confirmed by: [who — e.g., on-call DBA + engineering manager, per your escalation policy]

## Roles
- Incident Commander: [role/rotation]
- Execution: [role/rotation — the person actually running commands]
- Communications: [role/rotation — status updates to stakeholders/customers]
- Verification: [role/rotation — confirms the application actually works post-failover]

## Pre-Failover Checks
1. Confirm this is not a network partition that would risk split-brain (check from [specific alternate vantage points])
2. Confirm DR replica/standby lag as of last known-good check: [where to look]

## Failover Steps
1. [Exact command/console action to fence the old primary]
2. [Exact command to promote the DR replica/standby]
3. [Exact command/config change to repoint the application/proxy layer]
4. [Exact DNS/connection-string cutover steps, including expected propagation time]

## Verification Steps
1. [Specific query/health-check confirming the new primary accepts writes]
2. [Specific application-level smoke test confirming end-to-end functionality]
3. [Confirm monitoring/alerting is now pointed at the new primary]

## Communication Templates
- Internal status update: [template]
- Customer-facing update (if applicable): [template]

## Fail-Back Procedure
1. [Steps to safely reintroduce the original primary as a replica, not a second primary]
2. [Data-reconciliation check before resuming normal traffic on the original region]

## Post-Incident
- [ ] Actual RTO/RPO achieved: ___
- [ ] Gap vs. target, and remediation owner: ___
- [ ] Runbook updated based on what was learned: ___
```

**The template's value is entirely in the blanks being filled in with real, tested specifics** — a copy of this skeleton with `[exact command]` placeholders never actually replaced is not meaningfully different from having no runbook at all during a real incident.

---

## 14. Worked Examples

### Example 1 — Calculating RTO/RPO requirements for a real system
A mid-sized e-commerce company is deciding what tier to provision for their order-processing database, currently sitting on Tier 1 by historical accident rather than deliberate choice.
1. **Business input gathered**: average revenue is ~$8,000/hour during business hours, ~$1,500/hour overnight; the business states that losing more than 15 minutes of order data would require significant manual reconciliation with payment processors, which they want to avoid.
2. **Translating to RTO/RPO**: RPO target set at 1 minute (comfortably under the stated 15-minute pain threshold, with margin); RTO target set at 10 minutes during business hours (weighing the ~$1,300 expected cost of a 10-minute outage against the incremental infrastructure cost of a faster tier) and a looser 30 minutes overnight (lower revenue impact justifies a cheaper posture at that time, though the team ultimately decides operational simplicity of one consistent tier outweighs the modest savings from a day/night split).
3. **Architecture decision**: RPO of 1 minute rules out simple nightly-backup-only approaches; RTO of 10 minutes rules out cold standby. Lands on Tier 3 (multi-AZ automated failover via Patroni) as sufficient for a single-region business — Tier 4 (multi-region) is evaluated and explicitly deferred, since the company has no regulatory requirement for regional resilience and the cost-modeling exercise (Section 12) shows the incremental spend isn't yet justified by their current outage-probability estimate for a full regional event.
4. **Documented outcome**: RTO 10 min / RPO 1 min becomes the written SLA for this specific system, distinct from (and stricter than) the company's internal analytics warehouse, which is explicitly scoped to a much looser Tier 1 posture — exactly the "different systems, different tiers" principle from Section 3.
5. **Revisit trigger**: the team documents that this decision should be revisited if international expansion introduces a genuine regulatory data-residency or uptime requirement, rather than leaving the tier decision as a one-time judgment call with no defined trigger to reconsider it.

### Example 2 — A regional failover drill that surfaces a hidden dependency
A company with a documented Tier 4 (multi-region standby) PostgreSQL setup runs its first full regional failover game day.
1. Application traffic is cut off from the primary region and DNS is updated to point at the DR region's promoted database.
2. The database itself comes up correctly and accepts writes within the expected RTO window.
3. **Unexpected failure**: the application's background job workers (which read job definitions from a separate, *not-replicated* configuration service that only exists in the primary region) start throwing errors — a dependency nobody had mapped as part of the database DR plan, because it isn't the database at all.
4. **Root cause**: the DR plan was scoped purely to "the database," but the application's actual availability depends on a graph of services, only one of which is the database covered by this runbook.
5. **Remediation**: the configuration service is added to the DR scope (either replicated to the DR region or made resilient to a region failure independently), and the runbook is updated to explicitly enumerate every dependency the application needs beyond the database itself — a direct, concrete instance of the "test partial failures, not just total ones" principle in Section 9, and a reminder that a database-only DR plan can pass its own test while the actual application still fails over incorrectly.

---

## 15. Gotchas

- **"We have replicas" is not the same as "we have tested failover"** — a replica that has silently been broken or badly lagging for weeks is discovered, almost universally, at the worst possible moment: during the actual incident it was meant to protect against.
- **A 2-node (or any even-numbered) consensus/voting layer creates tie conditions** that a CP-style HA system cannot safely resolve — always use an odd number of voting members, or a dedicated witness/arbiter node, in any quorum-based failover setup.
- **Multi-AZ ≠ DR, and treating it as such is one of the most common gaps found during real disaster-recovery audits** — see Section 5.
- **Synchronous cross-region replication has a real, physics-imposed latency floor** — don't commit to an RPO=0 SLA across regions without first measuring whether the resulting write latency is actually acceptable to the application and its users.
- **Automated regional failover without a human decision point** can turn a transient cross-region network blip into an unnecessary, costly full failover (and an equally costly, confusing fail-back) — most organizations deliberately keep a human in the loop at the region-failover decision point even while automating everything below it.
- **DR plans go stale as infrastructure evolves** — a runbook written for last year's architecture, unreviewed since, is a liability disguised as a safety net; tie runbook review to your regular architecture/infra change process, not just an annual calendar reminder.
- **Backups and replicas that share underlying infrastructure (same account, same region, same storage backend) share a failure domain with production** — genuine resilience requires independence across the dimensions that matter for your specific threat model (infrastructure failure, human error, malicious actor, provider-level outage), not just redundant copies that all happen to sit in the same basket.
- **The cost of high availability is easy to justify in the abstract and easy to over-provision in practice** — always tie the architecture tier back to a documented RTO/RPO decision (Section 3), not to "more redundancy is always better."
