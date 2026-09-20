# Data Cataloging Cheatsheet for Data Engineers

> A structured reference for building and operating a data catalog — metadata models, lineage capture, automated ingestion, ownership, classification, and freshness scoring. Expanded from a short pattern note into a full implementation and governance guide.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 When to Invest in a Catalog](#when-to-invest-in-a-catalog)
4. [🗂️ Metadata Model](#metadata-model)
5. [🔗 Lineage Capture](#lineage-capture)
6. [🏷️ Classification and Sensitive Data Tagging](#classification-and-sensitive-data-tagging)
7. [🤖 Automated vs Manual Ingestion](#automated-vs-manual-ingestion)
8. [📉 Freshness and Staleness Signals](#freshness-and-staleness-signals)
9. [👤 Ownership Models](#ownership-models)
10. [🛠️ Tooling Landscape](#tooling-landscape)
11. [🔍 Making the Catalog Actually Used](#making-the-catalog-actually-used)
12. [🧬 Column-Level Lineage with OpenLineage](#column-level-lineage-with-openlineage)
13. [📡 DataHub Ingestion Recipe Example](#datahub-ingestion-recipe-example)
14. [📊 Catalog Quality Scorecards](#catalog-quality-scorecards)
15. [🔐 Catalog-Driven Access Control](#catalog-driven-access-control)
16. [🔎 Search Relevance and Metadata Enrichment](#search-relevance-and-metadata-enrichment)
17. [⚠️ Common Gotchas](#common-gotchas)
18. [✅ Best Practices Checklist](#best-practices-checklist)
19. [📚 Catalog vs Data Dictionary vs Data Contract](#catalog-vs-data-dictionary-vs-data-contract)
20. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| Core entities | Dataset, column, owner, tag, lineage edge, quality signal |
| Registration | Automated on write, not a manual afterthought |
| Sensitive data | Tag at column level (`pii`, `financial`, `restricted`) |
| Lineage | Capture at the job/query level, derive column-level where possible |
| Freshness | Store `last_updated`, `expected_cadence`, compute `is_stale` |
| Common tools | DataHub, Amundsen, OpenMetadata, Collibra, Unity Catalog, Glue Catalog |
| Failure mode to avoid | A catalog nobody trusts because it's stale or incomplete |

## 🧠 Core Concept

A data catalog is a **searchable inventory** of what data exists, where it lives, who owns it, how trustworthy it is, and how it flows through the organization. It answers four questions a growing data org can no longer answer from memory: *What data do we have? Where did it come from? Can I trust it? Who do I ask?*

```text
[ datasets, jobs, dashboards ]  --register/scan-->  [ catalog: metadata + lineage + tags ]  --search/browse-->  [ consumers make trust decisions ]
```

The catalog is metadata infrastructure, not documentation — it should be populated automatically from the systems that produce data, not hand-maintained in a wiki.

## 🎯 When to Invest in a Catalog

**Invest when:**
- Enough teams and sources exist that "ask in Slack who owns this table" no longer scales.
- Compliance (GDPR, CCPA, SOC 2) requires demonstrating where sensitive data lives and flows.
- Analysts and data scientists routinely can't find or don't trust existing datasets, leading to duplicated pipelines.
- You need impact analysis before schema changes ("what breaks if I rename this column?").

**Don't over-invest when:**
- You have a handful of tables and one data team — a well-maintained README or dbt docs site covers the same need at a fraction of the cost.
- No one owns catalog upkeep — an unmaintained catalog is worse than no catalog, because it actively misleads.

## 🗂️ Metadata Model

```python
catalog.register(
    name="sales_daily",
    location="s3://lake/sales/",
    owner="data-platform",
    tags=["finance", "pii"],
    schema={
        "order_id": {"type": "string", "classification": "internal"},
        "customer_email": {"type": "string", "classification": "pii"},
        "amount": {"type": "decimal(10,2)", "classification": "financial"},
    },
    description="Daily aggregated sales by region, refreshed at 06:00 UTC.",
    expected_cadence="daily",
)
```

A useful metadata model has, at minimum:

| Field | Purpose |
|---|---|
| `name` / `location` | Identify and locate the physical dataset |
| `owner` | Single accountable team or person |
| `tags` | Domain, sensitivity, business area |
| `schema` + column-level classification | What's in it, and how sensitive |
| `description` | Human-readable context (what it's for, not just what it is) |
| `expected_cadence` | Baseline to compute staleness |
| `lineage` | Upstream/downstream dependencies |

## 🔗 Lineage Capture

```python
catalog.set_lineage("sales_daily", upstream=["raw.orders", "raw.refunds"])
catalog.set_lineage("exec_dashboard", upstream=["sales_daily"])

# Query blast radius before making a breaking change
downstream = catalog.get_downstream("raw.orders")
# -> ["sales_daily", "exec_dashboard", "finance_reconciliation"]
```

```text
raw.orders ─┐
            ├─> sales_daily ─> exec_dashboard
raw.refunds ┘                └─> finance_reconciliation
```

Prefer **automated lineage extraction** (parsing SQL/query logs, or orchestrator task dependencies) over manually declared lineage — manual lineage rots the moment a pipeline changes and no one remembers to update the catalog.

```python
# Example: deriving lineage from SQL parsing (conceptual)
import sqlglot
tables_read, tables_written = sqlglot.lineage(sql_query)
catalog.set_lineage(tables_written[0], upstream=tables_read)
```

## 🏷️ Classification and Sensitive Data Tagging

```python
catalog.tag_column("sales_daily", "customer_email", classification="pii")
catalog.tag_column("sales_daily", "amount", classification="financial")

# Compliance query: "everywhere PII lives"
pii_datasets = catalog.search(classification="pii")
```

| Classification | Examples | Typical controls downstream |
|---|---|---|
| `public` | Product catalog | None |
| `internal` | Order counts | Standard access controls |
| `pii` | Email, name, address | Masking, access review, retention policy |
| `financial` | Payment amounts, account numbers | Encryption, audit logging |
| `restricted` | Health, legal-hold data | Strict need-to-know access |

## 🤖 Automated vs Manual Ingestion

| Approach | Pros | Cons |
|---|---|---|
| Automated scanners (crawl warehouse/lake schemas) | Always current, scales with data volume | Misses business context (why the dataset exists) |
| Push from pipelines (register on write) | Rich context available at creation time | Requires discipline/tooling integration in every pipeline |
| Manual curation | High-quality descriptions | Doesn't scale, goes stale fast |

**Best practice:** automate the *structural* metadata (schema, location, row counts, freshness) entirely, and require *human* metadata (description, owner, business tags) as a gate before a dataset is marked "production-ready" — don't try to automate the human part away.

## 📉 Freshness and Staleness Signals

```python
def compute_staleness(dataset):
    hours_since_update = (now() - dataset.last_updated).total_hours()
    expected_hours = CADENCE_TO_HOURS[dataset.expected_cadence]
    return hours_since_update > expected_hours * 1.5  # 50% grace period

stale_datasets = [d for d in catalog.all() if compute_staleness(d)]
```

Surface staleness directly in search results — a catalog entry that doesn't show "last updated 47 days ago, expected daily" actively encourages people to trust bad data.

## 👤 Ownership Models

- Every dataset needs **exactly one accountable owner** (a team, not "the data team" generically) — shared ownership becomes no ownership.
- Ownership should be **declared in code** (pipeline config, dbt `meta` block) so it's version-controlled and automatically synced to the catalog, not edited only in a UI.
- Route **catalog quality issues** (missing description, no owner, stale data) back to the owning team via automated tickets, not a central catalog team chasing everyone manually.

## 🛠️ Tooling Landscape

| Category | Tools |
|---|---|
| Open-source catalogs | DataHub, OpenMetadata, Amundsen |
| Warehouse-native | Unity Catalog (Databricks), Glue Data Catalog (AWS), BigQuery Data Catalog |
| Enterprise governance suites | Collibra, Alation |
| dbt ecosystem | dbt docs + `meta`/`tags` in `schema.yml`, dbt Explorer |

## 🔍 Making the Catalog Actually Used

- Integrate catalog search into the tools people already use (BI tool, IDE, Slack bot) rather than requiring a separate portal visit.
- Show lineage and freshness **inline** wherever a dataset is referenced (dashboard footer, query editor autocomplete).
- Gate new production tables behind "must be registered with an owner and description" as a lightweight CI/PR check.

## 🧬 Column-Level Lineage with OpenLineage

Job/table-level lineage answers "what feeds what" — column-level lineage answers the sharper question "does this specific column's value trace back to that specific source column," which is what real impact analysis and PII-flow audits actually need.

```python
# Emitting OpenLineage events from a Spark/dbt job (conceptual — most integrations do this automatically)
from openlineage.client import OpenLineageClient
from openlineage.client.run import RunEvent, RunState, Job, Run, Dataset
from openlineage.client.facet import ColumnLineageDatasetFacet, ColumnLineageDatasetFacetFieldsAdditional

client = OpenLineageClient(url="http://marquez:5000")

client.emit(RunEvent(
    eventType=RunState.COMPLETE,
    job=Job(namespace="analytics", name="build_sales_daily"),
    run=Run(runId="a1b2c3"),
    inputs=[Dataset(namespace="lake", name="raw.orders"), Dataset(namespace="lake", name="raw.refunds")],
    outputs=[Dataset(
        namespace="lake", name="sales_daily",
        facets={"columnLineage": ColumnLineageDatasetFacet(fields={
            "revenue": ColumnLineageDatasetFacetFieldsAdditional(
                inputFields=[{"namespace": "lake", "name": "raw.orders", "field": "amount"}],
                transformationDescription="SUM(amount) GROUP BY country",
            )
        })}
    )],
))
```

```python
# Answering "if I change raw.orders.amount, exactly which downstream columns are affected?"
affected_columns = catalog.get_column_lineage(dataset="raw.orders", column="amount")
# -> [{"dataset": "sales_daily", "column": "revenue"},
#     {"dataset": "exec_dashboard", "column": "total_revenue"}]
```

Most modern orchestrators and transformation tools (dbt, Airflow via `openlineage-airflow`, Spark via the OpenLineage Spark listener) can emit these events automatically — treat manual column-lineage annotation as a fallback for tools without native support, not the default approach.

## 📡 DataHub Ingestion Recipe Example

```yaml
# datahub_recipe.yml — a declarative ingestion source, run on a schedule
source:
  type: snowflake
  config:
    account_id: "xy12345"
    warehouse: "ANALYTICS_WH"
    role: "DATAHUB_READER"
    include_table_lineage: true
    include_view_lineage: true
    profiling:
      enabled: true
      profile_table_level_only: false   # also profile column-level stats (null %, distinct count)
    stateful_ingestion:
      enabled: true                     # only process what changed since the last run

sink:
  type: datahub-rest
  config:
    server: "http://datahub-gms:8080"
```

```bash
# Run the ingestion recipe (typically scheduled via the same orchestrator as your pipelines)
datahub ingest -c datahub_recipe.yml
```

This one config gives you: automatically discovered tables/views, lineage between them, and column-level profiling stats (null percentage, distinct count, min/max) — the kind of structural metadata that should never be hand-maintained.

## 📊 Catalog Quality Scorecards

Treat "is the catalog itself healthy" as a metric you track, the same way you'd track pipeline SLAs.

```python
def compute_catalog_health_score(catalog):
    datasets = catalog.all_production_datasets()
    return {
        "total_datasets": len(datasets),
        "pct_with_owner": pct(d for d in datasets if d.owner),
        "pct_with_description": pct(d for d in datasets if d.description),
        "pct_fresh": pct(d for d in datasets if not compute_staleness(d)),
        "pct_with_pii_review": pct(d for d in datasets if d.pii_reviewed_at is not None),
        "avg_days_since_description_update": avg(days_since(d.description_updated_at) for d in datasets),
    }

def pct(predicate_results):
    results = list(predicate_results)
    return round(100 * len(results) / max(len(results), 1), 1)
```

```sql
-- Surfacing the worst offenders so an owning team has a concrete, actionable list
SELECT dataset_name, owner_team, days_since_last_update, has_description
FROM catalog.datasets
WHERE owner_team IS NULL OR has_description = false OR days_since_last_update > 30
ORDER BY days_since_last_update DESC;
```

Publish this scorecard somewhere visible (a dashboard, a weekly digest) and route the "worst offenders" list back to owning teams automatically — a catalog health metric nobody looks at doesn't improve catalog health.

## 🔐 Catalog-Driven Access Control

```python
# Access requests reference the catalog's classification, not a manually re-derived judgment call
def request_access(user, dataset_name):
    dataset = catalog.get(dataset_name)
    if "pii" in dataset.tags or "restricted" in dataset.tags:
        return route_to_approval_workflow(user, dataset, approver=dataset.owner)
    return grant_access_immediately(user, dataset)

# Tag-based policy enforcement at the warehouse level (Snowflake tag-based masking policy)
```

```sql
-- Snowflake: apply a masking policy to every column tagged 'pii' across the account,
-- driven by the same classification the catalog exposes for search/discovery
ALTER TAG pii_classification SET MASKING POLICY email_mask;
```

When the catalog's classification tags are the *same* tags that drive access control and masking policies (rather than two separately maintained systems), a column newly tagged `pii` during a routine catalog scan automatically inherits the right controls — instead of waiting for someone to notice and configure masking by hand.

## 🔎 Search Relevance and Metadata Enrichment

```python
# Boost search ranking using usage signals, not just text match on name/description
def search_rank_score(dataset, query):
    text_match = fuzzy_match_score(query, dataset.name, dataset.description)
    usage_boost = log1p(dataset.query_count_last_30_days)
    freshness_penalty = -0.1 if compute_staleness(dataset) else 0
    ownership_boost = 0.2 if dataset.owner else -0.3   # penalize orphaned datasets in search
    return text_match + usage_boost + freshness_penalty + ownership_boost
```

```python
# Auto-enrich descriptions using LLM-assisted summarization of the transformation SQL,
# then require human review/approval before publishing — never auto-publish unreviewed text
draft_description = summarize_sql_logic(model_sql=get_dbt_model_sql("sales_daily"))
catalog.propose_description("sales_daily", draft_description, status="pending_review")
```

Popularity/usage-weighted search (surfacing the `orders` table 10,000 analysts query daily above a similarly-named abandoned prototype) is one of the highest-leverage, lowest-effort improvements to catalog usability — most catalogs already capture query logs, the enrichment is just wiring them into ranking.

## ⚠️ Common Gotchas

- **Stale metadata is worse than no catalog** — it actively misleads users into trusting bad or defunct data.
- **Manually maintained lineage rots** the first time a pipeline is refactored without updating the catalog entry.
- **Cataloging without ownership** produces an inventory nobody feels responsible for keeping accurate.
- **Over-cataloging noise** (every temp/staging table) buries the datasets people actually need to find — catalog production/shared assets, not every intermediate table.
- **Tagging sensitive data once and never re-scanning** — schemas evolve, and a new column can introduce PII that goes untagged.
- **No feedback loop from consumers** (can't flag "this description is wrong") means errors persist indefinitely.
- **Job-level lineage only** when the real question is column-level — "what feeds this table" is a much weaker answer than "what feeds this specific column" for both impact analysis and PII audits.
- **Treating classification tags and access-control policy as two separate systems** — they drift apart, and a column tagged `pii` in the catalog with no corresponding masking policy gives a false sense of protection.
- **Search ranked purely by text match** surfaces abandoned prototypes above the heavily-used production table with a less-catchy name — usage signals matter as much as name matching.
- **Auto-publishing LLM-generated descriptions without human review** risks confidently-wrong metadata, which is worse than an honest "no description yet."

## ✅ Best Practices Checklist

- [ ] Every production dataset has exactly one accountable owner
- [ ] Structural metadata (schema, location, freshness) is captured automatically
- [ ] Sensitive columns are tagged and re-scanned as schemas evolve
- [ ] Lineage is derived from code/query parsing, not hand-maintained
- [ ] Staleness is computed and surfaced, not just "last updated" buried in details
- [ ] New production tables are gated on registration (owner + description) via CI
- [ ] Consumers have a lightweight way to flag incorrect catalog metadata

## 📚 Catalog vs Data Dictionary vs Data Contract

| Concept | Scope | Answers |
|---|---|---|
| Data catalog | Org-wide inventory | "What data exists, where, who owns it?" |
| Data dictionary | Single dataset/schema | "What does each column mean?" |
| Data contract | Producer-consumer agreement | "What am I guaranteed about this dataset's shape and SLAs?" |

They compose: a catalog entry links to the dictionary, and can reference the enforced contract for that dataset.

## 💡 Pro Tips

1. **Automate structural metadata completely** — never rely on humans to keep schema/location current.
2. **Require a human-written description as a production gate**, not an automated placeholder.
3. **Derive lineage from parsing, not manual entry** — it's the only way lineage stays accurate as pipelines evolve.
4. **Surface staleness prominently** — "last updated" buried three clicks deep doesn't stop bad-data incidents.
5. **Tag sensitivity at the column level**, not just the dataset level — one PII column shouldn't force treating an entire wide table as restricted.
6. **Integrate into existing workflows** (BI tool, IDE) — a catalog that requires a separate visit gets ignored.
7. **Give every dataset exactly one owner**, declared in code and synced automatically.
8. **Prune aggressively** — catalog shared/production assets, not every ephemeral staging table.
9. **Build a feedback loop** so users can flag stale or wrong catalog entries in one click.
10. **Review catalog health as a metric** (% datasets with owners, % with fresh metadata) — treat it like any other SLA.
11. **Emit column-level lineage automatically** via OpenLineage-integrated tools (dbt, Spark, Airflow) rather than hand-annotating it.
12. **Unify classification tags with access-control policy** — one tag, one source of truth, applied to both search and enforcement.
13. **Weight search ranking by usage**, not just text match, so heavily-queried production tables outrank abandoned prototypes.
14. **Use LLM-assisted description drafting as a starting point, never an auto-publish** — a human review step is non-negotiable.
15. **Publish a weekly "worst offenders" list** (missing owner, stale, no description) routed automatically to owning teams, rather than relying on a central team to chase it manually.

