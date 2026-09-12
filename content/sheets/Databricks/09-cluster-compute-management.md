# Cluster & Compute Management Cheatsheet

> Choosing, sizing, securing, and governing the compute that runs your workloads — clusters, pools, policies, and serverless.

---

## 1. Compute Types Overview

| Type | Purpose | Lifecycle |
|------|---------|-----------|
| **All-Purpose Cluster** | Interactive notebook development, shared by a team | Long-running, manually or auto-terminated |
| **Job Cluster** | Runs a scheduled Job's tasks | Created at run start, terminated at run end |
| **SQL Warehouse** | SQL/BI query compute (Serverless, Pro, Classic) | Auto-starts/stops based on query traffic |
| **Serverless Compute** (Jobs/Notebooks/DLT) | Fully managed, no cluster config | Instant, managed by Databricks |
| **Instance Pools** | Pre-warmed idle VMs to reduce cluster start time | Long-running pool of idle instances |

---

## 2. Cluster Modes

| Mode | Description |
|------|-------------|
| **Single Node** | Driver only, no separate workers — good for small data, light ML, debugging, or single-machine libraries |
| **Standard (Multi Node)** | One driver + multiple worker nodes — default for most distributed workloads |
| **High Concurrency (Shared)** | Optimized for many concurrent users/queries with strong process isolation, supports table ACLs |

> Modern guidance: prefer **Unity Catalog–enabled "Shared" access mode** clusters for team/interactive work — better isolation and full UC feature support (vs. legacy "No Isolation Shared" clusters, which are being phased out).

---

## 3. Access Modes (Unity Catalog Compatibility)

| Access Mode | Supports UC? | Supports multiple languages? | Notes |
|-------------|--------------|-------------------------------|-------|
| **Single User** | ✅ | ✅ | Assigned to exactly one user/service principal; fastest, fewest restrictions |
| **Shared** | ✅ | ✅ (Python/SQL/Scala) | Multi-user, enforces UC governance & process isolation between users |
| **No Isolation Shared** (legacy) | ⚠️ Limited | ✅ | Being phased out — avoid for new workloads, doesn't support fine-grained UC enforcement |

**Why access mode matters:** it determines what security guarantees the cluster can make. A Single User cluster can run arbitrary code with that user's full permissions (fast but only safe for one identity). A Shared cluster must isolate users from each other's data and credentials, which restricts some low-level operations (e.g., certain RDD APIs, some third-party libraries that require unrestricted JVM access).

---

## 4. Sizing a Cluster

| Question | Guidance |
|----------|----------|
| How much data will one stage shuffle/process? | Total executor memory should comfortably exceed the largest shuffle/stage working set |
| How parallel is the workload? | Total cores ≈ 2–4x the number of partitions you want in flight at once |
| CPU-bound or I/O-bound? | I/O-bound (lots of small reads) → more, smaller nodes; CPU-bound (heavy transforms) → fewer, bigger nodes |
| Memory-heavy (wide joins, caching)? | Choose memory-optimized instance types |
| GPU workload? | Choose GPU-enabled node types, matched to the DBR ML/GPU runtime |

**Driver sizing:** the driver only needs to be large if you `collect()` large results, run wide broadcast joins (the broadcast side is collected to the driver first), or manage huge numbers of tasks/partitions (task scheduling/bookkeeping overhead scales with driver-side metadata). Otherwise a modest driver instance is fine — don't default to matching driver and worker size out of habit.

### Node Type Families (Conceptual)

| Family | Best for |
|--------|----------|
| **General purpose** | Balanced CPU/memory, good default for most ETL |
| **Memory-optimized** | Wide joins, large aggregations, caching-heavy workloads |
| **Compute-optimized** | CPU-bound transforms, UDF-heavy Python workloads |
| **Storage-optimized (local NVMe)** | Heavy shuffle workloads, Delta disk cache-heavy read patterns |
| **GPU-enabled** | Deep learning training/inference |

---

## 5. Autoscaling

```json
"autoscale": {
  "min_workers": 2,
  "max_workers": 8
}
```
- Databricks adds/removes workers based on pending task backlog, not just raw CPU utilization.
- Good default for variable workloads; for **very predictable, short jobs**, a fixed-size cluster can start faster and be more cost-predictable than waiting for autoscaling to react.
- **Autoscaling doesn't help if a single task is the bottleneck** (e.g., skew) — more nodes won't split an unsplittable task; fix the skew first (see [Performance Tuning](./08-performance-tuning-optimization.md)).
- Scale-down is intentionally more conservative than scale-up to avoid thrashing (repeatedly adding/removing nodes).

---

## 6. Auto-Termination & Idle Management

```json
"autotermination_minutes": 30
```
- Always set on **interactive/all-purpose clusters** to avoid paying for idle time between sessions.
- Not applicable to job clusters (they terminate automatically at run end) or Serverless compute.
- A common cost audit finding: forgotten all-purpose clusters with no auto-termination running 24/7 for a single occasional user.

---

## 7. Instance Pools

```json
{
  "instance_pool_name": "shared-pool",
  "min_idle_instances": 2,
  "max_capacity": 20,
  "node_type_id": "Standard_DS3_v2"
}
```
- Keeps a warm buffer of idle VMs so clusters attached to the pool start in seconds instead of minutes (skipping cloud VM provisioning time).
- You still pay standard cloud VM cost for idle pool instances, but **no DBU is charged while idle** — cuts cost vs. an idle running all-purpose cluster while keeping fast start times for frequent, short-lived clusters (e.g., many small job clusters).
- Pools can pre-download the Databricks Runtime container image too, further reducing cold-start time.

---

## 8. Cluster Policies

Admin-defined JSON templates that constrain what users can configure — critical for cost control and compliance.

```json
{
  "num_workers": {"type": "range", "maxValue": 10},
  "node_type_id": {"type": "allowlist", "values": ["Standard_DS3_v2", "Standard_DS4_v2"]},
  "autotermination_minutes": {"type": "fixed", "value": 60, "hidden": true},
  "custom_tags.team": {"type": "fixed", "value": "data-engineering"},
  "spark_conf.spark.databricks.cluster.profile": {"type": "fixed", "value": "singleNode"}
}
```
- Restrict instance types, cap max node count, enforce mandatory tags (for cost allocation/chargeback), lock specific Spark configs, and hide advanced options from end users who shouldn't need them.
- Combine with **budget policies** to automatically tag compute for chargeback/showback reporting.
- Policies can also be used to pre-select a specific Databricks Runtime version, enforce Photon, or restrict which libraries/init scripts can be attached.

---

## 9. Spot / Preemptible Instances

```json
"aws_attributes": {"availability": "SPOT_WITH_FALLBACK", "spot_bid_price_percent": 100}
```
- Use spot instances for **worker nodes** on fault-tolerant, restartable workloads (batch ETL, DLT pipelines) to cut compute cost significantly — Spark's task-level retry mechanism handles worker loss transparently by re-running lost tasks on remaining nodes.
- Keep the **driver on-demand** always — losing the driver kills the whole job/session, unlike losing a single worker.
- Use `_WITH_FALLBACK` variants so Databricks automatically falls back to on-demand instances if spot capacity is unavailable, trading some cost savings for reliability.
- Less suitable for long-running, stateful streaming jobs where frequent worker churn could repeatedly disrupt state recovery — evaluate case by case.

---

## 10. Serverless Compute

| Serverless Product | Replaces |
|---------------------|----------|
| **Serverless SQL Warehouses** | Classic/Pro SQL Warehouses when you don't want to manage sizing |
| **Serverless Jobs Compute** | Job clusters — no cluster spec needed |
| **Serverless Notebooks** | Interactive all-purpose clusters |
| **Serverless DLT/Lakeflow pipelines** | Manually-sized DLT pipeline clusters |

**Trade-offs:** less fine-grained infra control (no custom init scripts/custom instance types in most cases), but near-instant startup, automatic scaling, and often a simpler cost model. A strong default for teams that don't want to own infra tuning, or for bursty workloads where a dedicated always-tuned cluster would be wasteful.

---

## 11. SQL Warehouse Sizing

SQL Warehouses use **T-shirt sizes** (2X-Small through 4X-Large or larger) rather than explicit node counts — each size roughly doubles the cluster capacity of the previous one.

| Consideration | Guidance |
|----------------|----------|
| Many concurrent BI users, simple queries | Smaller size + **multi-cluster** scaling (auto-adds clusters under concurrent load, not just bigger nodes) |
| Few users, very large/complex queries | Larger single-cluster size |
| Unpredictable, spiky BI traffic | Serverless SQL Warehouse — scales automatically, no idle cost |

```json
"min_num_clusters": 1,
"max_num_clusters": 4,
"auto_stop_mins": 10
```

---

## 12. Networking & Security for Compute

| Feature | Purpose |
|---------|---------|
| **VPC/VNet injection** | Deploy the classic data plane into your own pre-configured network, with your own security groups/NSGs |
| **Secure Cluster Connectivity (No Public IP)** | Removes public IPs from cluster nodes; all control-plane communication is outbound-only via a relay |
| **PrivateLink** | Keeps traffic between control plane and data plane, and between clients and the workspace, off the public internet |
| **Instance Profiles (AWS) / Managed Identities (Azure)** | Attach cloud IAM roles to clusters for storage access, superseded for most new work by UC Storage Credentials |
| **Customer-managed keys (CMK)** | Enterprise-tier option to encrypt notebook/DBFS/managed storage content with your own KMS key |

---

## 13. Init Scripts & Libraries

```python
# Cluster-scoped init script (runs on every node at startup)
dbutils.fs.put("/databricks/init/install_libs.sh", """
#!/bin/bash
pip install some-package==1.2.3
""")
```
- Prefer **cluster libraries** (PyPI/Maven/wheel installed via the UI/API) over init scripts when possible — more visible, versioned, and easier to audit/manage than an arbitrary shell script.
- **Global init scripts** (admin-managed, run on every cluster in the workspace) are useful for organization-wide agents/monitoring but should be used sparingly since they affect every cluster.
- Use **Environment/Compute policies** to standardize approved library sets and prevent unreviewed init scripts across a team.

---

## 14. Cluster Event Log

Every cluster has an **event log** capturing lifecycle events: creation, resize (autoscale up/down), termination (and why — idle timeout, manual, spot eviction, error), driver/executor loss. This is the first place to check when a cluster fails to start, unexpectedly terminates, or autoscaling doesn't behave as expected.

---

## 15. Quick Decision Guide

```
Interactive dev, one person?         → Single Node or Single User cluster, autoterminate 30-60min
Team notebook, multiple users?        → Shared access mode cluster, UC-enabled
Scheduled production ETL?             → Job Cluster or Serverless Jobs, spot workers + on-demand driver
BI dashboards / ad hoc SQL?           → SQL Warehouse (Serverless preferred), auto-stop enabled
Unpredictable, bursty jobs?           → Serverless compute
Fast cluster startup at scale needed? → Instance Pools
Need to cap team spend?               → Cluster Policies + budget tags
Strict network isolation required?    → VPC injection + Secure Cluster Connectivity + PrivateLink
```

---

## Related Cheatsheets
- [Performance Tuning & Optimization](./08-performance-tuning-optimization.md)
- [Cost, Governance & Troubleshooting](./11-cost-governance-troubleshooting.md)
- [Orchestration & Workflows](./07-orchestration-workflows.md)
