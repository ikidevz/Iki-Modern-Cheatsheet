# Master Data Management (MDM) Cheatsheet for Data Engineers

> A structured reference for creating a single trusted "golden record" for core business entities (customers, products, vendors) across fragmented source systems — entity resolution, survivorship rules, match/merge pipelines, and how MDM relates to cataloging and data quality.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 When You Need MDM](#when-you-need-mdm)
4. [🏗️ Reference Architecture](#reference-architecture)
5. [🔍 Entity Resolution (Matching)](#entity-resolution-matching)
6. [🥇 Survivorship Rules](#survivorship-rules)
7. [🔀 Match/Merge Pipeline](#matchmerge-pipeline)
8. [🌳 The Crosswalk / ID Mapping Table](#the-crosswalk--id-mapping-table)
9. [🔄 Handling Merges and Splits Over Time](#handling-merges-and-splits-over-time)
10. [🏛️ Governance Models: Registry vs Golden Record vs Hybrid](#governance-models-registry-vs-golden-record-vs-hybrid)
11. [🛠️ Tooling Landscape](#tooling-landscape)
12. [🧪 Testing an MDM Pipeline](#testing-an-mdm-pipeline)
13. [⚠️ Common Gotchas](#common-gotchas)
14. [✅ Best Practices Checklist](#best-practices-checklist)
15. [📚 MDM vs Data Catalog vs Data Warehouse Dimension](#mdm-vs-data-catalog-vs-data-warehouse-dimension)
16. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| Goal | One trusted "golden record" per real-world entity, across fragmented sources |
| Core steps | Standardize → match → merge → survive (pick winning field values) → publish |
| Matching | Deterministic (exact key match) + probabilistic (fuzzy/similarity-based) |
| Survivorship | Explicit rules per field: most recent, most trusted source, most complete |
| Mapping | A crosswalk table links every source system's ID to the golden record ID |
| Common tools | Informatica MDM, Reltio, dbt + custom entity resolution, open-source (Zingg, Splink) |

## 🧠 Core Concept

Master Data Management resolves the same real-world entity — a customer, a product, a vendor — that exists as **slightly different, inconsistent records across multiple source systems** (CRM, ERP, support desk, e-commerce platform) into one trusted "golden record" that the rest of the organization can rely on as the definitive version.

```text
CRM:      "Jon Smith", jon.smith@email.com, "123 Main St"
ERP:      "Jonathan Smith", jsmith@email.com, "123 Main Street, Apt 4"
Support:  "J. Smith", jon.smith@email.com, (no address)
                        │
                        ▼ entity resolution + survivorship
Golden record: customer_master_id=M-00042, name="Jonathan Smith", email="jon.smith@email.com",
               address="123 Main Street, Apt 4", sources=[CRM, ERP, Support]
```

## 🎯 When You Need MDM

**Invest in MDM when:**
- The same core entity (customer, product, vendor) is created and maintained independently across multiple systems with no shared identifier.
- Downstream reporting or operations are visibly broken by duplicate/inconsistent entities (double-counted customers in a revenue report, duplicate vendor payments).
- Regulatory or business requirements need a single authoritative view of an entity (KYC/AML customer identity, product master for regulatory reporting).

**Skip or defer MDM when:**
- A single system is already the clear system of record for an entity, and other systems reference it by a shared key — there's no fragmentation problem to solve.
- The organization is small enough that entity counts are low and manual reconciliation, while imperfect, is genuinely manageable.

## 🏗️ Reference Architecture

```text
Source systems (CRM, ERP, Support, E-commerce)
        │  (each with its own local ID and inconsistent representation of the same entities)
        ▼
Standardization layer (normalize casing, formats, addresses)
        ▼
Entity resolution (match records that represent the same real-world entity)
        ▼
Survivorship (pick the best value per field across matched records)
        ▼
Golden record store + crosswalk table (maps every source ID to the golden ID)
        ▼
Published back to source systems AND/OR consumed directly by the warehouse
```

## 🔍 Entity Resolution (Matching)

```python
# Deterministic matching: exact match on a strong, shared identifier — cheap and highly reliable
def deterministic_match(record_a, record_b):
    return record_a.get("tax_id") == record_b.get("tax_id") and record_a["tax_id"] is not None

# Probabilistic (fuzzy) matching: needed when no shared strong identifier exists
from rapidfuzz import fuzz

def probabilistic_match_score(record_a, record_b):
    name_score = fuzz.token_sort_ratio(record_a["name"], record_b["name"])
    email_score = 100 if record_a["email"] == record_b["email"] else 0
    address_score = fuzz.token_sort_ratio(record_a["address"], record_b["address"])
    return 0.4 * name_score + 0.4 * email_score + 0.2 * address_score

def is_probable_match(record_a, record_b, threshold=85):
    return probabilistic_match_score(record_a, record_b) >= threshold
```

```python
# Blocking: comparing every record to every other record is O(n^2) and infeasible at scale —
# blocking groups records into smaller candidate buckets FIRST, then only compares within a bucket
def block_key(record):
    return (record["postal_code"], record["name"][0].lower())   # e.g., same zip + same first initial

blocks = defaultdict(list)
for record in all_records:
    blocks[block_key(record)].append(record)
# Only run the expensive pairwise comparison WITHIN each block, not across the whole dataset
```

Blocking is what makes entity resolution computationally tractable at real-world scale — without it, matching a million-record customer base against itself is a trillion comparisons.

## 🥇 Survivorship Rules

```python
# Survivorship: for each field, define WHICH source wins when matched records disagree
SURVIVORSHIP_RULES = {
    "email": "most_recently_updated",
    "legal_name": "most_trusted_source",       # e.g., always prefer the ERP/legal system over CRM
    "phone": "most_complete",                  # prefer a non-null, well-formatted value over a blank/malformed one
    "address": "most_recently_updated",
}

SOURCE_TRUST_RANKING = {"erp": 1, "crm": 2, "support_desk": 3}   # lower number = more trusted

def survive_field(field_name, matched_records):
    rule = SURVIVORSHIP_RULES[field_name]
    candidates = [r for r in matched_records if r.get(field_name)]
    if not candidates:
        return None
    if rule == "most_recently_updated":
        return max(candidates, key=lambda r: r["updated_at"])[field_name]
    if rule == "most_trusted_source":
        return min(candidates, key=lambda r: SOURCE_TRUST_RANKING.get(r["source"], 99))[field_name]
    if rule == "most_complete":
        return max(candidates, key=lambda r: len(str(r[field_name])))[field_name]
```

Survivorship rules must be **explicit and field-by-field**, not a single blanket "most recent wins" — different fields have genuinely different trust characteristics (legal name should come from the legal/ERP system regardless of recency; a phone number is fine to take from whichever source has it most recently and completely).

## 🔀 Match/Merge Pipeline

```python
def run_mdm_pipeline(source_records: list):
    standardized = [standardize(r) for r in source_records]
    blocks = build_blocks(standardized)

    clusters = []
    for block in blocks.values():
        clusters.extend(cluster_matching_records(block, match_fn=is_probable_match))

    golden_records = []
    for cluster in clusters:
        golden = {
            field: survive_field(field, cluster) for field in TRACKED_FIELDS
        }
        golden["golden_id"] = generate_stable_golden_id(cluster)
        golden["source_ids"] = [r["source_id"] for r in cluster]
        golden_records.append(golden)

    publish_golden_records(golden_records)
    update_crosswalk_table(golden_records)
```

Run this pipeline **idempotently and incrementally** where possible — see [idempotent-pipelines.md](./Idempotent_Pipelines_Cheat_Sheet.md) — since re-running full entity resolution over the entire entity base on every source update doesn't scale past a moderate size.

## 🌳 The Crosswalk / ID Mapping Table

```sql
-- The crosswalk is what lets every system and every warehouse query resolve
-- "which golden record does THIS source system's record belong to"
CREATE TABLE mdm.crosswalk (
    golden_id STRING,
    source_system STRING,
    source_record_id STRING,
    match_confidence DECIMAL(5,2),
    matched_at TIMESTAMP
);

-- Resolving a source record to its golden record downstream
SELECT g.*
FROM mdm.golden_customers g
JOIN mdm.crosswalk c ON g.golden_id = c.golden_id
WHERE c.source_system = 'crm' AND c.source_record_id = 'CRM-88213';
```

The crosswalk table is the single most operationally important artifact in an MDM system — without it, there's no way to trace a golden record back to its constituent source records, which makes both auditing and incremental updates impossible.

## 🔄 Handling Merges and Splits Over Time

```python
def handle_late_discovered_match(existing_golden_id, newly_matched_source_record):
    """Two previously-separate golden records are discovered to be the same entity —
    merge them, but PRESERVE the crosswalk history so nothing referencing the old ID breaks silently."""
    merge_golden_records(primary_id=existing_golden_id, merged_into=newly_matched_source_record["golden_id"])
    record_golden_id_redirect(old_id=newly_matched_source_record["golden_id"], new_id=existing_golden_id)

def handle_incorrect_match_split(golden_id, source_record_to_detach):
    """A previous match turns out to be wrong — split it back out into its own golden record,
    again preserving a clear audit trail of the correction."""
    new_golden_id = generate_stable_golden_id([source_record_to_detach])
    detach_from_golden_record(golden_id, source_record_to_detach, new_golden_id)
    record_split_history(original_golden_id=golden_id, split_into=new_golden_id)
```

Golden IDs are not immutable forever — matching improves, mistakes get corrected, and businesses genuinely merge/split entities (a company acquisition, a customer account split). An MDM system needs an explicit **redirect/history mechanism** so downstream consumers referencing an old golden ID aren't silently broken when it's merged or split.

## 🏛️ Governance Models: Registry vs Golden Record vs Hybrid

| Model | How it works | Trade-off |
|---|---|---|
| Registry (thin MDM) | Only the crosswalk/matching lives centrally; actual field data stays in source systems, resolved at query time | Lower storage/sync overhead, but every query pays a join/lookup cost |
| Golden record (thick MDM) | A fully materialized, survived record is stored centrally and is the queried source of truth | Fast queries, but requires an active, well-maintained survivorship pipeline |
| Hybrid | Golden record for frequently-queried core fields; registry-style resolution for rarely-needed detail fields | Balances the two, but adds design complexity in deciding the split |

## 🛠️ Tooling Landscape

| Category | Tools |
|---|---|
| Enterprise MDM platforms | Informatica MDM, Reltio, IBM InfoSphere MDM |
| Open-source entity resolution | Splink (probabilistic matching at scale, Spark-native), Zingg, Dedupe.io |
| DIY / warehouse-native | dbt + custom SQL/Python matching logic, as shown throughout this sheet |
| Adjacent | Address standardization/validation services (Smarty, Loqate) as a standardization pre-step |

## 🧪 Testing an MDM Pipeline

```python
def test_deterministic_match_on_shared_tax_id():
    record_a = {"tax_id": "12-3456789", "name": "Acme Corp"}
    record_b = {"tax_id": "12-3456789", "name": "ACME Corporation"}
    assert deterministic_match(record_a, record_b)

def test_probabilistic_match_catches_typo_variants():
    record_a = {"name": "Jonathan Smith", "email": "jon@email.com", "address": "123 Main St"}
    record_b = {"name": "Jon Smyth", "email": "jon@email.com", "address": "123 Main Street"}
    assert is_probable_match(record_a, record_b)

def test_probabilistic_match_rejects_genuinely_different_entities():
    record_a = {"name": "Jonathan Smith", "email": "jon@email.com", "address": "123 Main St"}
    record_b = {"name": "Jane Doe", "email": "jane@otheremail.com", "address": "456 Oak Ave"}
    assert not is_probable_match(record_a, record_b)

def test_survivorship_prefers_trusted_source_for_legal_name():
    matched = [
        {"source": "crm", "legal_name": "Acme Co", "updated_at": "2026-09-17"},
        {"source": "erp", "legal_name": "Acme Corporation", "updated_at": "2026-01-01"},
    ]
    assert survive_field("legal_name", matched) == "Acme Corporation"   # ERP wins despite being older

def test_golden_id_stable_across_reruns():
    result_1 = run_mdm_pipeline(sample_records)
    result_2 = run_mdm_pipeline(sample_records)
    assert result_1[0]["golden_id"] == result_2[0]["golden_id"]   # idempotent, not regenerated randomly each run
```

## ⚠️ Common Gotchas

- **No blocking strategy** — attempting full pairwise comparison across the entire entity base doesn't scale past a small dataset.
- **A single blanket survivorship rule** ("most recent always wins") applied to every field, when different fields genuinely need different trust logic.
- **No crosswalk/audit trail** — without it, there's no way to trace a golden record back to source records, audit a match decision, or safely handle a later correction.
- **Golden IDs treated as permanently immutable** — real-world merges, splits, and corrected mismatches need an explicit redirect/history mechanism, or downstream consumers silently break.
- **Over-aggressive fuzzy matching thresholds** — too loose a threshold merges genuinely distinct entities together, which is often worse and harder to detect than leaving duplicates unmerged.
- **Treating MDM as a one-time project** rather than an ongoing pipeline — new source records arrive continuously and need continuous (ideally incremental) matching, not an annual bulk reconciliation.

## ✅ Best Practices Checklist

- [ ] A blocking strategy makes entity resolution computationally tractable at real scale
- [ ] Survivorship rules are explicit and defined per field, not a single blanket rule
- [ ] A crosswalk table maps every source record to its golden ID, with match confidence recorded
- [ ] Golden ID merges/splits are handled with an explicit redirect/history mechanism
- [ ] Matching thresholds are tuned and tested against both true-positive and true-negative examples
- [ ] The MDM pipeline runs incrementally and idempotently, not as an occasional full reprocess
- [ ] Match/merge decisions are auditable — who/what merged which records, and why

## 📚 MDM vs Data Catalog vs Data Warehouse Dimension

| Concept | Solves | Scope |
|---|---|---|
| MDM | "Which records across systems represent the same real-world entity?" | Cross-system entity identity |
| Data catalog | "What data exists, where, and who owns it?" | Org-wide dataset inventory |
| Warehouse dimension (e.g., `dim_customer`) | "What are this entity's attributes, including history?" (SCD) | Single warehouse's modeled view |

In practice, a warehouse's `dim_customer` table is often **built from** the MDM golden record — MDM resolves cross-system identity first, then the warehouse layer applies SCD Type 2 versioning on top of the resolved entity. See [slowly-changing-dimensions.md](./Slowly_Changing_Dimensions_Cheat_Sheet.md).

## 💡 Pro Tips

1. **Always block before matching** — pairwise comparison across an unblocked full dataset doesn't scale.
2. **Define survivorship per field, not as one blanket rule** — legal name, email, and phone genuinely have different trust characteristics.
3. **Build the crosswalk table first** — it's the foundation everything else (auditing, incremental updates, corrections) depends on.
4. **Design for golden ID merges and splits from day one** — treat them as a normal, expected operation with a redirect mechanism, not an exceptional edge case.
5. **Tune matching thresholds against real labeled examples** (true matches and true non-matches), not intuition alone.
6. **Run MDM incrementally**, matching new/changed records against existing golden records rather than reprocessing everything on every run.
7. **Make match decisions auditable** — record which records were compared, the match score, and why they were merged.
8. **Standardize before matching** (casing, address formats, phone formats) — most "fuzzy matching isn't working" problems are actually standardization problems.
9. **Start with your highest-value, most-fragmented entity** (usually customer) rather than trying to build MDM for every entity type at once.
10. **Connect MDM's golden ID to your warehouse's dimension tables** — MDM resolves cross-system identity, SCD Type 2 then tracks that resolved entity's history over time.
