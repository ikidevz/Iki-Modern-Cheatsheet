# Metadata & Catalog Design — System Design for Data Engineers

> Making a growing platform discoverable and auditable — data catalogs, schema registries,
> and lineage tracking as their own system, not an incidental side effect of other tools.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Quick-Reference Table](#quick-reference-table)
3. [What a Data Catalog Actually Stores](#what-a-data-catalog-actually-stores)
4. [Python: A Minimal Data Catalog with Lineage](#python-a-minimal-data-catalog-with-lineage)
5. [Metadata as Its Own System](#metadata-as-its-own-system)
6. [Passive vs. Active Metadata](#passive-vs-active-metadata)
7. [Column-Level Lineage](#column-level-lineage)
8. [Automated PII Discovery & Tagging](#automated-pii-discovery--tagging)
9. [Catalog Freshness / Staleness Detection](#catalog-freshness--staleness-detection)
10. [Common Tools](#common-tools)
11. [Gotchas](#gotchas)
12. [Pro Tips](#pro-tips)

---

## Core Concepts

As a data platform grows past a handful of tables, "just ask the team that built it" stops
scaling as a discovery mechanism. A **data catalog** is the searchable inventory of what
data exists, who owns it, what it means, and how it's connected (lineage). This category is
frequently underweighted in interview prep because it doesn't sound as technically flashy as
streaming or fault tolerance — but it's exactly the kind of thing that separates "I've built
one pipeline" answers from "I've operated a platform with many teams and dozens of tables"
answers.

## Quick-Reference Table

| Concept | What It Answers |
|---|---|
| **Data catalog** | "What tables/datasets exist, and what do they mean?" |
| **Schema registry** | "What's the exact current (and historical) schema of this stream/table?" |
| **Lineage graph** | "Where did this data come from, and what depends on it downstream?" |
| **Ownership metadata** | "Who do I ask when this table looks wrong or I need a schema change?" |
| **Tagging/classification** | "Which tables contain PII, are deprecated, or belong to a specific domain?" |

## What a Data Catalog Actually Stores

- **Technical metadata**: schema, column types, partition scheme, file format, size, last
  updated.
- **Business metadata**: human descriptions, business glossary terms, ownership, domain.
- **Operational metadata**: freshness/SLA status, query popularity, cost to compute/store.
- **Lineage metadata**: upstream sources and downstream dependents, at the table and
  (increasingly, in mature tools) column level.
- **Governance metadata**: PII/sensitivity tags, access policies, retention rules — tying
  directly into `08-security-governance-multitenancy.md`.

## Python: A Minimal Data Catalog with Lineage

A simplified version of what tools like DataHub, Amundsen, or Unity Catalog provide,
illustrating the two core catalog operations: **search** and **lineage traversal**.

```python
from dataclasses import dataclass, field
from typing import List, Dict, Set
from collections import deque


@dataclass
class TableMetadata:
    name: str
    owner: str
    tags: List[str] = field(default_factory=list)
    schema: Dict[str, str] = field(default_factory=dict)
    description: str = ""


class DataCatalog:
    """A minimal in-memory data catalog: metadata registry + lineage graph."""

    def __init__(self):
        self.tables: Dict[str, TableMetadata] = {}
        self.lineage: Dict[str, Set[str]] = {}  # table -> set of downstream tables

    def register(self, metadata: TableMetadata):
        self.tables[metadata.name] = metadata
        self.lineage.setdefault(metadata.name, set())

    def add_lineage(self, upstream: str, downstream: str):
        self.lineage.setdefault(upstream, set()).add(downstream)
        self.lineage.setdefault(downstream, set())

    def search(self, tag: str = None, owner: str = None) -> List[str]:
        results = []
        for name, meta in self.tables.items():
            if tag and tag not in meta.tags:
                continue
            if owner and meta.owner != owner:
                continue
            results.append(name)
        return results

    def downstream_impact(self, table: str) -> List[str]:
        """BFS forward through the lineage graph: 'what breaks if I change this table?'"""
        visited, queue, result = set(), deque([table]), []
        while queue:
            current = queue.popleft()
            for nxt in self.lineage.get(current, []):
                if nxt not in visited:
                    visited.add(nxt)
                    result.append(nxt)
                    queue.append(nxt)
        return result

    def upstream_lineage(self, table: str) -> List[str]:
        """BFS backward: 'where did this table's data come from?'"""
        reverse: Dict[str, Set[str]] = {}
        for up, downs in self.lineage.items():
            for down in downs:
                reverse.setdefault(down, set()).add(up)

        visited, queue, result = set(), deque([table]), []
        while queue:
            current = queue.popleft()
            for prev in reverse.get(current, []):
                if prev not in visited:
                    visited.add(prev)
                    result.append(prev)
                    queue.append(prev)
        return result


catalog = DataCatalog()
catalog.register(TableMetadata("bronze.orders", owner="data-eng", tags=["pii"]))
catalog.register(TableMetadata("stg_orders", owner="data-eng", tags=["staging"]))
catalog.register(TableMetadata("fct_sales", owner="analytics-eng", tags=["mart", "pii"]))
catalog.register(TableMetadata("dash_revenue", owner="bi-team", tags=["dashboard"]))
catalog.register(TableMetadata("ml_churn_features", owner="ml-team", tags=["ml", "pii"]))

catalog.add_lineage("bronze.orders", "stg_orders")
catalog.add_lineage("stg_orders", "fct_sales")
catalog.add_lineage("fct_sales", "dash_revenue")
catalog.add_lineage("fct_sales", "ml_churn_features")

print("Tables tagged 'pii':", catalog.search(tag="pii"))
print("Downstream impact of changing bronze.orders:", catalog.downstream_impact("bronze.orders"))
print("Upstream lineage of dash_revenue:", catalog.upstream_lineage("dash_revenue"))
```

Output:

```
Tables tagged 'pii': ['bronze.orders', 'fct_sales', 'ml_churn_features']
Downstream impact of changing bronze.orders: ['stg_orders', 'fct_sales', 'ml_churn_features', 'dash_revenue']
Upstream lineage of dash_revenue: ['fct_sales', 'stg_orders', 'bronze.orders']
```

`downstream_impact` answers "what breaks if I change `bronze.orders`?" (everything, in this
small example) — the exact question an impact-analysis workflow needs to answer *before* a
risky schema change, not after it breaks a dashboard. `upstream_lineage` answers the reverse
question during an incident: "this dashboard's numbers look wrong — where did the data
actually come from?"

## Metadata as Its Own System

A common interview-level insight: metadata isn't a side effect that magically appears — it's
a system with its own producers, consumers, and freshness requirements, same as any data
pipeline:

```
Who writes metadata?              Who reads it?
──────────────────────            ─────────────────
dbt (model docs, tests,      →    Analysts searching for a table
  auto-generated lineage)    →    Engineers doing impact analysis before a change
Ingestion jobs (schema,      →    Governance/compliance auditing PII tag coverage
  row counts, freshness)     →    New team members onboarding onto the platform
Manual curation (business    →    Automated policy engines (e.g. "block export of
  glossary, ownership)              anything tagged 'pii' without approval")
```

If metadata is stale (an owner field pointing at someone who left 2 years ago, a lineage
graph that hasn't been regenerated since a big refactor), the catalog actively misleads
people — worse than having no catalog, because people trust it. Design implication: prefer
**automatically generated** metadata (from dbt manifests, schema registries, query logs)
over manually maintained metadata wherever the two options both exist, since automated
metadata can't drift out of sync with reality the way a manually-updated wiki page can.

## Passive vs. Active Metadata

- **Passive metadata**: browsable/searchable, used by humans (catalog UIs, documentation
  sites). Valuable but doesn't *do* anything on its own.
- **Active metadata**: consumed by automated systems to actually enforce behavior — e.g. a
  data-quality gate that blocks a pipeline from promoting data to production if its
  freshness metadata shows it's stale, or an export-control system that blocks moving a
  PII-tagged column to an unapproved destination.

Mature platforms increasingly push toward active metadata because passive catalogs, however
well-populated, rely on humans remembering to check them — active metadata bakes the check
into the pipeline itself.

## Column-Level Lineage

Table-level lineage answers "what tables depend on this table" — but that over-reports:
if only *one* column of a five-column table actually feeds a downstream calculation,
table-level lineage still flags the whole downstream table as "affected" by any change,
anywhere in the source table. Column-level lineage tracks dependencies at the (table,
column) grain instead:

```python
from typing import Dict, List, Set
from collections import deque

class ColumnLineageGraph:
    """Tracks lineage at the (table, column) grain -- lets you answer 'which specific
    downstream columns does THIS column feed,' which table-level lineage can't without
    over-reporting every column in the downstream table."""

    def __init__(self):
        self.edges: Dict[tuple, Set[tuple]] = {}

    def add_edge(self, src_table, src_col, dst_table, dst_col):
        self.edges.setdefault((src_table, src_col), set()).add((dst_table, dst_col))

    def impact(self, table, col) -> List[tuple]:
        visited, queue, result = set(), deque([(table, col)]), []
        while queue:
            current = queue.popleft()
            for nxt in self.edges.get(current, []):
                if nxt not in visited:
                    visited.add(nxt)
                    result.append(nxt)
                    queue.append(nxt)
        return result


lineage = ColumnLineageGraph()
lineage.add_edge("bronze.orders", "amount", "stg_orders", "amount")
lineage.add_edge("bronze.orders", "currency", "stg_orders", "currency")
lineage.add_edge("stg_orders", "amount", "fct_sales", "revenue_usd")
lineage.add_edge("stg_orders", "currency", "fct_sales", "revenue_usd")  # currency affects the conversion
lineage.add_edge("fct_sales", "revenue_usd", "dash_revenue", "total_revenue")

print("Column-level impact of changing bronze.orders.currency:")
for t, c in lineage.impact("bronze.orders", "currency"):
    print(f"  {t}.{c}")
```

Output:

```
Column-level impact of changing bronze.orders.currency:
  stg_orders.currency
  fct_sales.revenue_usd
  dash_revenue.total_revenue
```

Notably, `bronze.orders.amount` is **not** in this impact list even though it flows into the
same downstream tables — because this specific traversal started from `currency`, not
`amount`, and only follows edges that actually derive from the changed column. This precision
is exactly why column-level lineage is valuable (and, as noted in
`07-data-quality-observability.md`, exactly why it's harder to compute automatically than
table-level lineage — it requires actually parsing the transformation logic, not just the
table dependency graph).

## Automated PII Discovery & Tagging

Manually tagging every column across a growing platform doesn't scale. A common pragmatic
approach combines column-**name** hints with sampled-**value** pattern matching, tagging a
column only when both signals (or a sufficiently strong single signal) agree:

```python
import re
from typing import List

PII_PATTERNS = {
    "email": re.compile(r"^[\w.+-]+@[\w-]+\.[\w.-]+$"),
    "ssn": re.compile(r"^\d{3}-\d{2}-\d{4}$"),
    "phone": re.compile(r"^\+?\d{1,2}[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$"),
}

def auto_tag_pii(column_name: str, sample_values: List[str]) -> List[str]:
    tags = []
    name_hints = {"email": "email", "ssn": "ssn", "social_security": "ssn", "phone": "phone", "mobile": "phone"}
    for hint, tag in name_hints.items():
        if hint in column_name.lower():
            tags.append(f"pii:{tag}(name_hint)")

    for pii_type, pattern in PII_PATTERNS.items():
        matches = sum(1 for v in sample_values if pattern.match(str(v)))
        if sample_values and matches / len(sample_values) > 0.8:
            tags.append(f"pii:{pii_type}(value_match:{matches}/{len(sample_values)})")
    return list(set(tags))


columns_to_scan = {
    "customer_email_address": ["alice@example.com", "bob@example.com", "carol@example.com"],
    "order_id": ["o100", "o101", "o102"],
    "phone_number": ["+1-555-123-4567", "+1-555-987-6543", "+1-555-222-3333"],
}
for col, samples in columns_to_scan.items():
    print(f"{col}: {auto_tag_pii(col, samples)}")
```

Output:

```
customer_email_address: ['pii:email(name_hint)', 'pii:email(value_match:3/3)']
order_id: []
phone_number: ['pii:phone(value_match:3/3)', 'pii:phone(name_hint)']
```

This is a simplified version of what governance-focused catalog tools (Amundsen plugins,
DataHub classifiers, AWS Glue's sensitive-data detection) do continuously as new tables/
columns land — feeding directly into the RLS/masking policies from
`08-security-governance-multitenancy.md` as **active metadata** rather than a one-time manual
audit.

## Catalog Freshness / Staleness Detection

A catalog's own metadata can go stale exactly like data can — an ownership field pointing at
someone who left, a description describing a table's old shape. Applying the same
freshness-monitoring idea from `07-data-quality-observability.md` to the catalog's metadata
itself:

```python
from datetime import datetime, timedelta

class CatalogFreshnessChecker:
    def __init__(self, staleness_threshold_days=30):
        self.staleness_threshold_days = staleness_threshold_days

    def check(self, table_name, last_metadata_refresh: datetime, now: datetime):
        age_days = (now - last_metadata_refresh).days
        return {"table": table_name, "metadata_age_days": age_days,
                "stale": age_days > self.staleness_threshold_days}


checker = CatalogFreshnessChecker(staleness_threshold_days=30)
now = datetime(2026, 9, 13)
print(checker.check("fct_sales", now - timedelta(days=5), now))
print(checker.check("legacy_orders_v1", now - timedelta(days=180), now))
```

Output:

```
{'table': 'fct_sales', 'metadata_age_days': 5, 'stale': False}
{'table': 'legacy_orders_v1', 'metadata_age_days': 180, 'stale': True}
```

Flagging `legacy_orders_v1` as stale is itself a useful catalog signal — it tells browsing
users "trust this entry less, or check with the owning team before relying on it," which is
strictly better than a catalog that presents 5-day-fresh and 180-day-fresh entries with equal
apparent authority.

## Common Tools

| Tool | Role |
|---|---|
| **DataHub** | Open-source metadata platform: catalog, lineage, tagging, active metadata policies |
| **Amundsen** | Open-source data discovery/catalog tool, originally from Lyft |
| **Unity Catalog** (Databricks) | Unified catalog across a lakehouse: governance, lineage, access control in one place |
| **AWS Glue Data Catalog** | Managed metadata store, commonly the shared catalog behind Athena/EMR/Redshift Spectrum |
| **Confluent/Glue Schema Registry** | Specifically for streaming schema versions (ties into `07-data-quality-observability.md`) |

## Gotchas

- Treating catalog population as a one-time documentation effort rather than an ongoing,
  ideally automated process — a catalog that isn't kept current becomes actively misleading.
- Column-level lineage is significantly harder than table-level lineage to get right
  automatically (it requires understanding the actual SQL/transformation logic, not just
  the DAG of table dependencies) — don't casually promise it without the tooling to back it up.
- Forgetting that metadata itself needs governance — an internal catalog that exposes table
  descriptions and sample data without respecting the same PII/access rules as the
  underlying data can itself become a compliance leak.
- Assuming lineage automatically captures *why* a transformation exists, not just *that* it
  exists — the graph tells you what depends on what, not the business logic behind it;
  that still needs human-written documentation.

## Pro Tips

- If asked how you'd support a growing number of teams on a shared platform, lead with
  automated metadata generation (from dbt, schema registries, query logs) over "we'd have a
  wiki page" — it directly signals awareness of the staleness problem.
- Tie this category back to `07-data-quality-observability.md` and
  `08-security-governance-multitenancy.md` explicitly when it comes up — lineage powers
  impact analysis for quality, and tagging powers access policies for governance; presenting
  metadata as the connective tissue between those two categories is a strong synthesis point.
- If pushed on scale ("what about lineage across thousands of tables?"), acknowledge that
  automatic column-level lineage at that scale is a genuinely hard, actively-developed
  problem rather than overclaiming a clean solution — naming the real difficulty is more
  credible than pretending it's solved.
- Have one crisp sentence ready distinguishing catalog from schema registry: "the schema
  registry is the source of truth for a stream's exact current schema and its compatibility
  rules; the catalog is the human-facing index of what exists, what it means, and how it's
  connected — they're related but solve different problems."
