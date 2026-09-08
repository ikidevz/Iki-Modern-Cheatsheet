# Architecture & Design Patterns

## Medallion Architecture

**Definition:** A layered data organization pattern using Bronze, Silver, and Gold layers of increasing refinement.

**Key Points:**
- Bronze — raw, unprocessed data landed as-is from source. Source of truth for reprocessing.
- Silver — cleaned, validated, deduplicated, conformed data. Joinable across sources.
- Gold — business-level aggregates and marts, ready for BI/reporting consumption.

**Example:**
```
raw.bronze_orders (as extracted)
  → staging.silver_orders (cleaned, deduped, typed)
    → marts.gold_daily_revenue (aggregated for BI)
```

**When to Use / Trade-offs:**
- Well suited to lakehouse platforms (Databricks, Delta Lake) but the concept generalizes to any warehouse with raw/staging/marts schemas.

**Common Pitfalls:**
- Skipping the Silver layer and transforming directly from Bronze to Gold, making it hard to reuse cleaned data across multiple downstream marts.

---

## Kimball vs Inmon

**Definition:** Two foundational, competing philosophies for designing an enterprise data warehouse.

**Key Points:**

| | Kimball | Inmon |
|---|---|---|
| Approach | Bottom-up: build dimensional data marts first | Top-down: build a normalized enterprise warehouse first |
| Structure | Star schemas per business process | 3NF central warehouse, marts derived from it |
| Speed to value | Faster initial delivery | Slower, but more consistent enterprise-wide model |
| Best for | Teams needing quick, department-level analytics | Large orgs needing a single, tightly governed source of truth |

**Example:**
- Kimball: sales team gets a `fact_sales` star schema live in weeks.
- Inmon: enterprise builds a full normalized warehouse first, then derives sales, marketing, and finance marts from that single source.

**When to Use / Trade-offs:**
- Kimball suits organizations prioritizing speed and department-level autonomy.
- Inmon suits organizations prioritizing long-term consistency and willing to invest more upfront.

**Common Pitfalls:**
- Mixing both approaches without a clear decision, resulting in inconsistent modeling standards across teams.

---

## Data Mesh

**Definition:** A decentralized data architecture paradigm where domain teams own and publish their own data as products, rather than a central team owning all data.

**Key Points:**
- Each domain exposes data as a data product with defined quality/SLA guarantees.
- Relies on federated governance and a self-serve data platform so domains don't reinvent infrastructure.

**Example:**
- The checkout domain team owns and publishes an `orders` data product with documented schema and freshness SLA; the marketing team consumes it without needing checkout's internal database access.

**When to Use / Trade-offs:**
- Data Mesh scales well for large organizations with many independent domains, but requires significant investment in shared tooling and governance to avoid fragmentation.
- For smaller organizations, a centralized data team is usually simpler and sufficient.

**Common Pitfalls:**
- Adopting Data Mesh terminology without the underlying self-serve platform investment, resulting in the same central bottlenecks under a new name.

---

## Common Anti-Patterns

**Definition:** Recurring design mistakes that cause pipelines to become fragile, slow, or untrustworthy over time.

**Key Points:**
- Spaghetti pipelines — ad-hoc scripts with hidden dependencies and no orchestration/versioning.
- Silent schema changes — transformations that break without alerting when upstream schema shifts.
- No idempotency — re-running a job creates duplicate/corrupted data.
- Transform-in-source — running heavy transformations directly against production OLTP databases.
- One giant monolithic job — a single pipeline doing extract+transform+load+notify with no modularity.

**Example:**
- A single 2,000-line script that extracts, transforms, and loads with no task boundaries — a failure at line 1,800 requires re-running the entire script from scratch, including expensive earlier steps.

**When to Use / Trade-offs:**
- N/A — these are patterns to actively avoid, not choose between.

**Common Pitfalls (Warning Signs):**
- No one on the team can explain the full pipeline without reading the code line-by-line.
- Pipeline failures require manual data cleanup because re-running duplicates data.
