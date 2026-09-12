# Cost, Governance & Troubleshooting Cheatsheet

> Understanding the billing model, keeping spend under control, and fixing the errors you'll actually hit in production.

---

## 1. How Databricks Billing Works

**Total cost = Databricks DBU cost + underlying cloud infrastructure cost (VMs, storage, networking).**

| Component | Billed by |
|-----------|-----------|
| **DBU (Databricks Unit)** | Processing capability consumed per hour, rate varies by compute type & tier |
| **Cloud VM cost** | Billed directly by AWS/Azure/GCP for the underlying instances |
| **Storage** | Billed by your cloud provider (S3/ADLS/GCS), not Databricks |
| **Networking** | Cross-AZ/region data transfer, billed by your cloud provider |

DBU rate varies by:
- **Compute type**: All-Purpose > Jobs Compute > SQL Warehouse (Serverless often cheaper overall due to per-second billing and zero idle cost)
- **Tier**: Standard < Premium < Enterprise
- **Photon**: higher DBU rate per hour, but often lower *total* cost because the job finishes faster — always compare total job cost, not the hourly rate alone

### Committed-Use Discounts
Cloud providers offer **reserved instance / committed use / savings plan** discounts on the underlying VM cost (separate from Databricks' own DBU commitment discounts, which Databricks offers directly for pre-purchased usage). Large, steady-state workloads (always-on job clusters, SQL Warehouses running 24/7) are the best candidates for these commitments; bursty/serverless workloads generally aren't.

---

## 2. Where Money Leaks — Common Cost Mistakes

| Mistake | Fix |
|---------|-----|
| All-Purpose clusters left running idle | Set `autotermination_minutes`, prefer Job Clusters for scheduled work |
| Running production jobs on interactive clusters | Always use Job Clusters / Serverless for scheduled workloads |
| Over-provisioned cluster sizes "just in case" | Right-size based on actual Spark UI metrics, use autoscaling |
| No cluster policies | Admins can't cap max workers/instance types → runaway costs from a single misconfigured job |
| Small file problem | More I/O + task overhead = wasted compute time for the same result |
| Not using Spot instances for fault-tolerant batch workers | Losing 60-90% potential savings on eligible workloads |
| Unbounded `VACUUM`/`OPTIMIZE` never run | Storage bloat, slower queries, more scanned bytes on every read |
| Querying huge tables without partition/clustering filters | Full table scans that could've been skipped entirely |
| Duplicate/abandoned experimentation clusters | No naming/tagging convention makes orphaned resources hard to find and clean up |
| High-concurrency SQL Warehouses oversized for actual usage | Right-size using warehouse query history/queue metrics, not guesswork |

---

## 3. Cost Monitoring — System Tables

```sql
-- Total DBU + cost breakdown by workspace/sku
SELECT usage_date, sku_name, SUM(usage_quantity) AS dbus
FROM system.billing.usage
GROUP BY usage_date, sku_name
ORDER BY usage_date DESC;

-- Cost attribution by cluster tags (e.g., team, project)
SELECT custom_tags['team'] AS team, SUM(usage_quantity) AS dbus
FROM system.billing.usage
GROUP BY team;

-- Job run cost/duration trends
SELECT * FROM system.lakeflow.job_run_timeline
WHERE period_start_time > current_date() - 7;

-- List price reference for converting DBUs to a currency estimate
SELECT * FROM system.billing.list_prices;
```

**Practical setup:** build a dashboard on `system.billing.usage` joined to `system.billing.list_prices`, filtered/grouped by tags, and set **budget alerts** (Account Console → Budgets) to notify before overspend on a per-team or per-project basis.

---

## 4. Tagging for Chargeback

```json
"custom_tags": {
  "team": "data-engineering",
  "project": "sales-pipeline",
  "environment": "prod"
}
```
- Enforce tags via **cluster policies** (mandatory fields) so nothing runs untagged.
- Tags flow into `system.billing.usage` for accurate cost allocation across teams — untagged compute is essentially invisible to chargeback reporting.
- Consider a **FinOps review cadence** (monthly/quarterly) where team leads review their own tagged spend dashboard — visibility alone often drives significant self-correction.

---

## 5. Governance Checklist (Admin View)

- [ ] Unity Catalog enabled on every workspace, no new Hive Metastore usage
- [ ] Groups synced from IdP via SCIM; grants target groups, not individuals
- [ ] Cluster policies enforce instance type allowlists + auto-termination + mandatory tags
- [ ] Production jobs run as service principals, not personal accounts
- [ ] Audit logs (`system.access.audit`) monitored for anomalous access
- [ ] Sensitive columns covered by masking views/native column masks
- [ ] External locations & storage credentials scoped to least privilege
- [ ] Data retention/VACUUM policy documented per table sensitivity
- [ ] Budget alerts configured per team/project
- [ ] Disaster recovery plan documented (cross-region replication strategy for critical tables, if applicable)

---

## 6. Common Errors & Fixes

| Error | Likely Cause | Fix |
|-------|--------------|-----|
| `AnalysisException: Table or view not found` | Wrong catalog/schema context, missing `USE CATALOG` | Fully qualify `catalog.schema.table`, check `USE` statements |
| `AnalysisException: cannot resolve column` | Typo, or column dropped/renamed upstream | Check `DESCRIBE TABLE`, review recent schema changes via `DESCRIBE HISTORY` |
| `Delta table doesn't exist / not a Delta table` | Reading a non-Delta path with `format("delta")`, or a path typo | Verify path/format, check `DESCRIBE DETAIL` |
| `ConcurrentAppendException` | Two writers modified overlapping data at once | Narrow MERGE conditions, use row-level concurrency, add retry logic |
| `ConcurrentDeleteReadException` | A file being read was concurrently deleted by another transaction | Serialize conflicting jobs (`max_concurrent_runs: 1`), retry |
| `Failed to merge fields ... schema mismatch` | New/changed columns in source data | Use `mergeSchema` deliberately, or fix upstream schema drift at the source |
| `Py4JJavaError: OutOfMemoryError` | Executor/driver memory exceeded (often from `collect()` or skew) | Avoid large `collect()`, fix skew, increase memory / repartition |
| `java.io.FileNotFoundException` on Delta read while streaming | Concurrent `VACUUM` removed files a stream still needs | Increase retention before vacuuming; coordinate with consumers |
| `Cluster terminated: INIT_SCRIPT_FAILURE` | Bad init script | Check init script logs in the cluster event log |
| `PERMISSION_DENIED` on a UC object | Missing `USE CATALOG`/`USE SCHEMA` privilege somewhere up the chain | `SHOW GRANTS`, grant proper privileges up the full namespace chain |
| Job stuck / not starting | Cluster policy conflict, cloud quota limits, pool exhaustion | Check cluster event log, cloud provider quota/limits dashboard |
| Streaming job falling behind | Insufficient cluster size, bad trigger interval, skew | Check input vs. processing rate in the Streaming tab of the Spark UI, scale up/tune trigger |
| `INVALID_STATE` / checkpoint incompatibility on stream restart | Changed the streaming query's logic/aggregation shape without a new checkpoint | Use a new checkpoint location when making a structurally incompatible change |
| `RESOURCE_DOES_NOT_EXIST` from API/CLI calls | Wrong workspace host, or resource deleted since bundle was last deployed | Re-check `DATABRICKS_HOST`, re-run `bundle deploy` |

---

## 7. Debugging Workflow

```
1. Reproduce: find the failing Job Run / notebook cell
2. Check driver logs (stdout/stderr) in the run's UI page
3. Check Spark UI (Stages tab) for the failing stage
4. Isolate: run the failing cell/task standalone with a smaller data sample
5. Check DESCRIBE HISTORY / DESCRIBE DETAIL if it's a Delta issue
6. Check system.access.audit if it's a permissions issue
7. Check the cluster event log if it's an infra/startup issue
8. If still stuck, collect a thread dump / driver log bundle before opening a support case
```

---

## 8. Useful Diagnostic Commands

```sql
DESCRIBE HISTORY my_table;
DESCRIBE DETAIL my_table;
SHOW GRANTS ON TABLE my_table;
SHOW TBLPROPERTIES my_table;

SELECT * FROM system.access.audit WHERE request_params.full_name_arg = 'cat.schema.table';
```

```python
spark.sparkContext.setLogLevel("WARN")
dbutils.fs.ls("/mnt/path")             # inspect files directly
spark.conf.get("spark.sql.shuffle.partitions")
spark.sparkContext.uiWebUrl            # get the Spark UI URL programmatically
```

---

## 9. Network & Infra-Level Troubleshooting

| Symptom | Check |
|---------|-------|
| Cluster fails to launch, times out | Cloud provider VM quota limits, subnet IP exhaustion, security group/NSG rules blocking control-plane communication |
| Intermittent connection errors to external services | NAT gateway throughput limits, firewall rules, DNS resolution inside the VPC |
| Slow cluster startup consistently (not first-time) | Large init scripts/libraries reinstalling every time — consider baking into a custom container image or using pools |
| UC external location access denied | Storage credential's IAM role/trust policy misconfigured, or bucket policy doesn't trust the role |

---

## 10. Budget Guardrails (Account Console)

| Feature | What it does |
|---------|----------------|
| **Budgets** | Alert when spend (filtered by tag) crosses a threshold |
| **Cluster Policies** | Prevent oversized/untagged/non-compliant compute from being created at all |
| **IP Access Lists** | Restrict workspace access by network range |
| **Compliance Security Profile** | Enforces hardened defaults (Enterprise tier) for regulated environments |

---

## 11. FinOps Playbook (Step by Step)

1. **Tag everything** via enforced cluster policies — untagged spend can't be attributed or optimized.
2. **Build a baseline dashboard** on `system.billing.usage` broken down by team/workspace/SKU.
3. **Identify top 10 cost drivers** (usually a small number of jobs/warehouses account for most spend).
4. **Apply the tuning priority order** from [Performance Tuning](./08-performance-tuning-optimization.md) to the top cost drivers first — a 2x speedup on your biggest job saves more than micro-optimizing ten small ones.
5. **Right-size and switch to Job Clusters/Serverless** wherever workloads are still running on shared interactive clusters.
6. **Review quarterly** — data volumes and usage patterns drift, so a cluster sized correctly six months ago may no longer be optimal.

---

## Related Cheatsheets
- [Cluster & Compute Management](./09-cluster-compute-management.md)
- [Unity Catalog & Governance](./06-unity-catalog-governance.md)
- [Performance Tuning & Optimization](./08-performance-tuning-optimization.md)
