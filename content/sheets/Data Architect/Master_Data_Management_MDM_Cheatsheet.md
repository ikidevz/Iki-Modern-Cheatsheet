# Master Data Management (MDM) Cheatsheet

> A conceptual reference for Master Data Management — the discipline of creating and maintaining a single, trusted "golden record" for an organization's core business entities. Complements [Data Governance Frameworks](./Data_Governance_Frameworks_Cheatsheet.md) (MDM is DAMA-DMBOK's "Reference & Master Data" knowledge area) and [Data Mesh](./Data_Mesh_Cheatsheet.md) (MDM is traditionally centralized; mesh offers a domain-owned alternative).

## 📑 Table of Contents

1. [🧠 Core Concept](#core-concept)
2. [⚡ Quick Reference](#quick-reference)
3. [🗂️ Types of Data: Master vs. Reference vs. Transactional vs. Metadata](#types-of-data)
4. [🏆 The Golden Record & Survivorship](#the-golden-record-survivorship)
5. [🧮 Worked Example: Survivorship in Action](#worked-example-survivorship-in-action)
6. [🏗️ The Four Implementation Styles](#the-four-implementation-styles)
7. [🧩 MDM Architecture Components](#mdm-architecture-components)
8. [🔍 Matching & Merging Techniques](#matching-merging-techniques)
9. [🧮 Worked Example: Scoring a Fuzzy Match](#worked-example-scoring-a-fuzzy-match)
10. [🌳 Worked Example: Hierarchy Management](#worked-example-hierarchy-management)
11. [📦 Common Master Data Domains](#common-master-data-domains)
12. [🏬 Worked Example: A Multi-Brand Retailer's MDM Program](#worked-example-a-multi-brand-retailers-mdm-program)
13. [🔀 MDM vs. Data Governance vs. Data Quality](#mdm-vs-data-governance-vs-data-quality)
14. [⚠️ Common Gotchas](#common-gotchas)
15. [🎯 Best Practices](#best-practices)
16. [💡 Pro Tips](#pro-tips)

## 🧠 Core Concept

**Master Data Management (MDM)** is the discipline of creating and maintaining a consistent, accurate, and authoritative version of an organization's core business entities — customers, products, vendors, locations, employees — across every system that touches them. Without MDM, the same customer might exist as five different records across CRM, billing, support, and marketing systems, each spelled slightly differently, with no way to know they're the same person.

MDM solves this by establishing a **golden record**: the single trusted representation of an entity, built by matching and merging records from multiple source systems, then either serving that golden record back out to consuming systems or acting as the reference index that points to where the real data lives.

## ⚡ Quick Reference

| Term | Meaning |
|---|---|
| Master data | Core business entities referenced repeatedly across many systems and processes (customer, product, vendor, location) |
| Golden record | The single, trusted, merged representation of an entity, assembled from all its source records |
| Survivorship rules | The rules that decide which source value "wins" for each attribute when merging conflicting records |
| Match/merge | The process of identifying records that represent the same real-world entity and combining them |
| System of Record (SOR) | The system authorized as the trusted source for a given piece of data |
| MDM hub | The central system/platform that stores, matches, and serves master data |
| Deterministic matching | Matching based on exact or rule-based key matches (e.g., same tax ID) |
| Probabilistic/fuzzy matching | Matching based on similarity scoring across multiple attributes when no exact key exists |

| Implementation Style | System of Record | Best Fit |
|---|---|---|
| Registry | Source systems remain the SOR | Fast, low-risk start; need cross-references without touching source systems |
| Consolidation | MDM hub aggregates a golden view, doesn't write back | Reporting/BI/analytics use cases |
| Coexistence | MDM hub *and* source systems can both update, bi-directionally synced | Balanced control with phased rollout |
| Centralized | MDM hub is the only system that accepts updates | Maximum control; hardest to implement |

## 🗂️ Types of Data: Master vs. Reference vs. Transactional vs. Metadata

| Type | Definition | Example |
|---|---|---|
| Master data | Core entities the business operates on, referenced across many transactions | Customer "Acme Corp", Product "SKU-12345" |
| Reference data | Standardized value sets used to classify or categorize other data, usually externally defined or slow-changing | Country codes (ISO 3166), currency codes, unit-of-measure lists |
| Transactional data | Records of business events/activities, referencing master and reference data | An order, an invoice, a shipment |
| Metadata | Data describing other data | A column's data type, a table's owner, a field's business definition |

MDM programs are often lumped in with reference data management because both deal with shared, authoritative values consumed widely — but master data (entities with complex lifecycles and identity-resolution needs) is a meaningfully harder problem than reference data (mostly static code lists).

## 🏆 The Golden Record & Survivorship

Building a golden record requires deciding, attribute by attribute, which source's value should "survive" when sources disagree. Common survivorship strategies:

| Strategy | Rule |
|---|---|
| Most recent wins | The most recently updated source value is kept |
| Most trusted source wins | A designated authoritative system (e.g., the CRM for "customer name") always wins for that attribute |
| Most complete wins | The source with the fewest nulls/most populated fields for that record wins |
| Highest data-quality-score wins | Values are scored by a quality engine (completeness, validity, freshness) and the highest score wins |
| Manual steward override | A human data steward resolves conflicts the automated rules can't confidently settle |

Survivorship rules should be defined per attribute, not per record — a CRM system might be the trusted source for a customer's name and phone, while a billing system is trusted for the legal entity name and tax ID, even for the same golden customer record.

## 🧮 Worked Example: Survivorship in Action

Three source systems hold records for the same customer, matched by the matching engine with high confidence:

| Attribute | CRM (updated 3 days ago) | Billing (updated 40 days ago) | Support Tool (updated 1 day ago) | Survivorship Rule | Golden Value |
|---|---|---|---|---|---|
| Customer Name | "Acme Corp" | "ACME CORPORATION" | "Acme Corp." | Most trusted source = CRM | **Acme Corp** |
| Legal Entity Name | *(not held)* | "Acme Corporation LLC" | *(not held)* | Most trusted source = Billing | **Acme Corporation LLC** |
| Phone | "555-0142" | "555-0142" | "555-0199" *(new number, most recent)* | Most recent wins | **555-0199** |
| Email | "billing@acme.com" | "billing@acme.com" | *(blank)* | Most complete wins (2 of 3 agree, 1 blank) | **billing@acme.com** |
| Tax ID | *(not held)* | "12-3456789" | *(not held)* | Only Billing holds it | **12-3456789** |

Two things this table makes concrete: first, survivorship is genuinely per-attribute (Billing wins for Tax ID and Legal Entity Name, CRM wins for Customer Name, "most recent" wins for Phone) — there is no single "trusted source" for the whole record. Second, a field only one system holds (Tax ID) doesn't need a conflict rule at all — it survives by default, which is why a good MDM hub tracks *provenance* (which system contributed each field) alongside the golden value, not just the final merged record.

## 🏗️ The Four Implementation Styles

### 1. Registry Style

The MDM hub holds only a lightweight **index/registry** — identifiers and cross-references pointing back to source systems — without physically consolidating the actual master data. Think of it as a matching layer, not a data store.

- **Benefits:** low risk, fast to implement, no disruption to existing systems.
- **Drawbacks:** one-way visibility only (no write-back), limited control over data quality, governance stays decentralized across the source systems.

### 2. Consolidation Style

The MDM hub actively pulls data from multiple source systems, matches/merges it into a golden record, and stores that consolidated view — but **does not write changes back** to the source systems.

- **Benefits:** high data quality in the consolidated view, strong for enterprise-wide reporting, relatively inexpensive and quick to set up.
- **Drawbacks:** mostly useful for analysis/reporting rather than operational use, since the source systems never see the corrected data.

### 3. Coexistence Style

A hybrid: the MDM hub holds the golden record **and** synchronizes bi-directionally with source systems — changes can be made in the hub or in an application system and propagate both ways.

- **Benefits:** improves data quality and access speed while retaining operational flexibility, supports phased/incremental rollout, natural evolution path from Consolidation.
- **Drawbacks:** increased complexity in keeping the hub and every source system in sync consistently; requires more robust governance and conflict-resolution processes.

### 4. Centralized Style

Also called the **Transactional style**. The MDM hub becomes the **sole system of record** — the only place updates are made — and all source/consuming systems read from (and are updated by) the hub.

- **Benefits:** maximum control and consistency; the golden record is essentially guaranteed not to drift once the hub and sources are aligned.
- **Drawbacks:** typically the hardest and most disruptive to implement, since it requires re-architecting how every consuming application creates/updates that entity.

**Progression pattern:** many organizations start with Registry or Consolidation (low risk, fast value), and evolve toward Coexistence or Centralized as governance maturity and organizational appetite for control increase.

## 🧩 MDM Architecture Components

| Component | Role |
|---|---|
| Source system connectors | Extract candidate master records from CRM, ERP, e-commerce, and other operational systems |
| Matching engine | Applies deterministic and/or probabilistic rules to identify records representing the same entity |
| Survivorship engine | Applies attribute-level rules to merge matched records into a golden record |
| Data model / hub | Stores the canonical entity model and the golden records |
| Stewardship workbench | UI for data stewards to review low-confidence matches, resolve conflicts, and manually merge/unmerge records |
| Integration / API layer | Publishes the golden record out to consuming systems (batch, API, or event-driven) and, in Coexistence/Centralized styles, accepts writes back |
| Hierarchy management | Manages relationships between entities (e.g., a company's subsidiary/parent structure, a product's category hierarchy) |

## 🔍 Matching & Merging Techniques

| Technique | How It Works | Best For |
|---|---|---|
| Deterministic matching | Exact match (or simple rule) on a reliable key: tax ID, email, SSN/national ID, SKU | High-confidence identifiers that are consistently populated and formatted |
| Probabilistic/fuzzy matching | Scores similarity across multiple weighted attributes (name, address, phone) when no reliable exact key exists | Real-world data with typos, name variants, incomplete records |
| Edit-distance algorithms (e.g., Levenshtein) | Measures how many character edits separate two strings | Catching typos and minor spelling variants in names/addresses |
| Phonetic algorithms (e.g., Soundex, Metaphone) | Encodes words by how they sound rather than exact spelling | Matching names spelled differently but pronounced similarly |
| Similarity scoring (e.g., Jaro-Winkler) | Weighted similarity score tuned for short strings like names, favoring matching prefixes | Person/company name matching where prefixes tend to match first |
| Blocking/indexing | Groups records into candidate buckets (e.g., same postal code) before running expensive pairwise comparisons | Making matching computationally feasible at scale |

Matching almost always combines several techniques (blocking to reduce candidate pairs, then multi-attribute probabilistic scoring), with a confidence threshold above which matches auto-merge and a lower band that routes to a human steward for review.

## 🧮 Worked Example: Scoring a Fuzzy Match

Two candidate records, blocked into the same bucket because they share a postal code:

| Field | Record A | Record B |
|---|---|---|
| Name | "Jon Smith" | "John Smyth" |
| Address | "123 Main St, Apt 4" | "123 Main Street #4" |
| Phone | "555-0142" | "555-0142" |
| Postal Code | "94105" | "94105" |

A typical multi-attribute scoring pass, using illustrative weights:

| Field | Similarity Technique | Score (0-1) | Weight | Weighted Contribution |
|---|---|---|---|---|
| Name | Jaro-Winkler ("Jon Smith" vs "John Smyth") | 0.89 | 0.35 | 0.31 |
| Address | Normalized token match ("St"≈"Street", "Apt"≈"#") | 0.85 | 0.25 | 0.21 |
| Phone | Exact match | 1.00 | 0.30 | 0.30 |
| Postal Code | Exact match (used for blocking, still contributes) | 1.00 | 0.10 | 0.10 |
| **Total confidence score** | | | | **0.92** |

If the auto-merge threshold is set at 0.90, this pair merges automatically. If it were set at 0.95, this pair would instead route to a data steward's review queue — illustrating why threshold tuning is a real governance decision (too low, and unrelated people get merged; too high, and the steward queue fills with matches that are actually correct), not just a technical default to accept.

## 🌳 Worked Example: Hierarchy Management

Beyond matching flat records, MDM often has to master the *relationships* between entities — this is frequently where the real business value hides. Consider a B2B customer hierarchy:

```
Acme Holdings LLC  (ultimate parent)
├── Acme Corporation  (subsidiary — the entity that actually places orders)
│   ├── Acme West Region  (billing sub-account)
│   └── Acme East Region  (billing sub-account)
└── Beta Industries Inc.  (subsidiary, acquired 2023)
```

Without hierarchy management, a sales team might see "Acme Corporation" and "Beta Industries" as two unrelated customers with no visibility that they're both part of the same parent account — missing an obvious cross-sell opportunity and under-reporting the parent's total spend. A golden record for "Acme Corporation" that also carries `parent_entity_id → Acme Holdings LLC` and `sibling_entities → [Beta Industries Inc.]` turns two disconnected flat records into one navigable account structure — the same underlying idea as a product category tree (a product's golden record carrying `parent_category_id`) or an org chart (an employee's golden record carrying `reports_to_employee_id`).

## 📦 Common Master Data Domains

| Domain | Example Entities | Typical Complexity Driver |
|---|---|---|
| Customer / Party | Individuals, companies, households | Deduplication across many touchpoints; individual vs. organization identity |
| Product | SKUs, product hierarchies, bundles | Attribute-rich, hierarchical, often multi-language/multi-market |
| Vendor / Supplier | Suppliers, contractors | Overlap with customer matching logic (a company can be both) |
| Location | Addresses, sites, stores, service territories | Standardization/validation against postal or geocoding references |
| Employee / HR | Employees, contractors, org structure | Sensitive data handling, org hierarchy changes over time |
| Financial | Chart of accounts, cost centers, legal entities | Regulatory reporting accuracy requirements |
| Asset | Equipment, facilities | Lifecycle state tracking (in service, retired, under maintenance) |

## 🏬 Worked Example: A Multi-Brand Retailer's MDM Program

A retail holding company owns three consumer brands, each with its own e-commerce platform, loyalty program, and customer database — and wants a single cross-brand view of "who is our customer" for marketing and fraud detection.

**Domain chosen first:** Customer/Party — the highest-value, most duplicated domain, with three source systems (one loyalty DB per brand) plus a shared payment processor.

**Implementation style chosen:** Consolidation, as a deliberate first phase — the marketing team needs a merged cross-brand view for campaign targeting, but none of the three brand platforms are ready to accept write-back from a central hub yet. (The roadmap calls for evolving to Coexistence in year two once each brand's engineering team has capacity to integrate.)

**Matching approach:** deterministic matching on email and phone (normalized to a common format first — stripping formatting characters, lowercasing email), falling back to probabilistic matching (name + address + loyalty-card last-4-digits) for the roughly 15% of records missing a reliable email or phone.

**Survivorship rules set by the governance council:** most-recently-active brand relationship wins for contact info (a customer's current preferred brand is likely to have their best contact details); the payment processor is the trusted source for billing address; loyalty tier is *not* merged into a single value at all — each brand's loyalty status is kept as a separate attribute on the golden record, since "loyalty tier" isn't actually the same concept across brands.

**Hierarchy layer added in phase two:** household-level linking — recognizing that two individual golden records share a shipping address and payment method, and linking them as a household for marketing suppression rules (e.g., "don't send the same catalog to two people in the same house").

This mirrors the domain's real complexity: not every attribute should be merged (loyalty tier), the implementation style is chosen deliberately based on organizational readiness rather than aspiration, and the hierarchy layer (household linking) is what actually delivers the cross-brand marketing value the program was funded for.

## 🔀 MDM vs. Data Governance vs. Data Quality

| | MDM | Data Governance | Data Quality |
|---|---|---|---|
| Focus | Producing one trusted version of core entities | Policy, ownership, and accountability for data broadly | Measuring/improving accuracy, completeness, consistency of data |
| Scope | A defined set of master data domains | The whole data estate | Any dataset, not just master data |
| Relationship | Relies on governance to define ownership/survivorship rules, and on data quality tooling to measure/improve source records | Provides the policy and accountability MDM operates under | Feeds MDM's matching/survivorship decisions (quality scores) and measures the golden record's fitness |

MDM is best understood as one specific, high-value application of data governance and data quality practices, focused narrowly on identity resolution for core entities rather than data management broadly.

## ⚠️ Common Gotchas

- **Boiling the ocean** — trying to master every entity in every domain at once; successful programs typically start with one high-value domain (often Customer or Product) and expand, as in the multi-brand retailer example.
- **Matching rules with no human escalation path** — fully automated matching without a stewardship workbench for low-confidence matches produces silent bad merges (or missed matches) that erode trust in the golden record.
- **No clear survivorship ownership** — if no one has decided which source wins for each attribute, "the golden record" becomes just another inconsistent copy.
- **Merging attributes that shouldn't be merged** — the retailer example's decision to keep loyalty tier per-brand rather than merged is a reminder that not every conflicting attribute has a single "true" value; sometimes the right answer is to preserve multiple values with context.
- **Choosing Centralized style before the organization is ready** — jumping straight to Centralized without governance maturity or stakeholder buy-in tends to fail; most successful programs earn their way there via Registry/Consolidation/Coexistence.
- **Treating MDM as a one-time project** — entities change constantly (mergers, renames, address changes); MDM is an ongoing operational capability, not a project with an end date.
- **Ignoring hierarchy/relationship data** — mastering flat entity records without their relationships (parent/subsidiary, product category trees, households) misses much of the real business value of a golden record, as the hierarchy example shows.
- **No feedback loop to source systems** — in Registry or pure Consolidation styles, source systems never get corrected, so the same bad data keeps entering the pipeline indefinitely.
- **Static match thresholds nobody revisits** — a 0.90 auto-merge threshold set at launch and never tuned as data volume and quality change over time either accumulates bad merges or floods the steward queue.

## 🎯 Best Practices

- Start with the domain that has the clearest business pain (usually Customer or Product) and the most measurable ROI (reduced duplicate mailings, better cross-sell visibility, cleaner regulatory reporting).
- Define survivorship rules per attribute, with a named business owner accountable for each rule, before building the matching engine.
- Build a stewardship workflow from day one — matching confidence thresholds should route uncertain cases to a human, not silently auto-merge or auto-reject.
- Measure MDM success with concrete metrics: duplicate rate reduction, match precision/recall, percentage of source systems successfully synced.
- Treat the golden record's schema and governance the same way you'd treat a [data product](./Data_Mesh_Cheatsheet.md#anatomy-of-a-data-product) — documented, versioned, with clear consumers.
- Revisit implementation style periodically — most programs are expected to evolve from Registry/Consolidation toward Coexistence as trust and governance maturity grow.
- Track match-score provenance and review auto-merge thresholds on a regular cadence as data volume and source mix change.

## 💡 Pro Tips

1. **Golden record quality is a function of survivorship discipline, not matching sophistication** — a mediocre matching algorithm with clear, well-owned survivorship rules beats a sophisticated matcher with no agreed rule for which source wins, as the three-source survivorship table shows.
2. **Blocking strategy matters as much as the matching algorithm** — how you bucket candidate records before comparison determines both match quality and whether the whole process is computationally feasible at real-world data volumes.
3. **Registry style is underrated as a permanent solution**, not just a stepping stone — for organizations that mainly need cross-reference and deduplication visibility (not write-back), Registry can be the right long-term choice, not merely the cheap first phase.
4. **MDM and data mesh pull in different directions on ownership** — classic MDM centralizes an entity's truth in one hub; data mesh decentralizes ownership to domains. Reconciling them (e.g., a "Customer" domain team owning the golden customer record as a proper data product) is a common real-world design question worth resolving explicitly rather than by default.
5. **Hierarchy management is where the real ROI often hides** — many MDM failures come from mastering flat records well while never modeling the parent/subsidiary or category relationships the business actually asked for insight into, as the household-linking phase of the retailer example illustrates.
6. **Not every conflicting attribute wants a single winner** — sometimes the right survivorship "rule" is to keep multiple context-tagged values (like per-brand loyalty tier) rather than forcing one value to survive; recognizing this distinction early avoids building a golden record that quietly discards real information.
