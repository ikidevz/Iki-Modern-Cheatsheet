# Monitoring, Observability & Lineage

## Logging & Alerting

**Definition:** Capturing pipeline execution details and notifying the right people when something needs attention.

**Key Points:**
- Log at each pipeline stage: rows in/out, duration, errors — enough to reconstruct what happened without re-running.
- Alert only on actionable conditions (job failure, SLA breach, anomaly threshold) to avoid alert fatigue.
- Route alerts by severity: paging for critical failures, async notification (Slack/email) for warnings.

**Example:**
```python
logger.info(f"Extracted {row_count} rows in {duration}s from {source_table}")
if row_count == 0:
    alert_slack(channel="#data-alerts", message=f"Zero rows extracted from {source_table}")
```

**When to Use / Trade-offs:**
- Structured logging (JSON logs with consistent fields) pays off quickly once pipelines multiply — it enables querying logs like data rather than reading raw text.

**Common Pitfalls:**
- Over-alerting on every warning-level event, causing the team to start ignoring alerts altogether ("alert fatigue").
- Logging without row counts/duration, making it impossible to spot gradual degradation over time.

---

## Data Lineage Tracking

**Definition:** Tracing how data flows and transforms from source to final table/report.

**Key Points:**
- Column-level lineage shows exactly which upstream fields feed a given output column.
- Tools: dbt's built-in lineage graph, OpenLineage, Monte Carlo, Atlan, Collibra.
- Use lineage before making schema changes to understand downstream blast radius.

**Example:**
- Before dropping a column from `stg_orders`, checking lineage reveals it feeds three downstream Gold-layer marts and two BI dashboards — informing a safer deprecation plan.

**When to Use / Trade-offs:**
- Table-level lineage is often sufficient for smaller teams; column-level lineage becomes valuable once pipelines and schemas grow complex enough that impact isn't obvious from table names alone.

**Common Pitfalls:**
- Making breaking schema changes without checking lineage first, causing silent downstream failures discovered only when a report breaks.

---

## SLAs & Freshness Monitoring

**Definition:** Defined expectations for how current and reliable a dataset should be, and the monitoring that verifies it.

**Key Points:**
- Freshness — how recent the data in a table is relative to expectations (e.g., "updated within the last 2 hours").
- Define SLAs per dataset: acceptable latency, acceptable failure rate, and who's notified on breach.
- Monitor both pipeline SLAs (job completed on time) and data SLAs (data is correct and fresh) — a job can succeed while data quality still fails.

**Example:**
```sql
-- Freshness check
SELECT MAX(updated_at) < CURRENT_TIMESTAMP - INTERVAL '2 hours' AS is_stale
FROM orders;
```

**When to Use / Trade-offs:**
- Define SLAs explicitly and document them alongside the dataset (e.g., in a data contract) rather than leaving freshness expectations implicit.

**Common Pitfalls:**
- Monitoring only "did the job run successfully" without separately checking whether the resulting data is actually fresh and correct.
