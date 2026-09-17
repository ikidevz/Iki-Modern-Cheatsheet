# Data Governance Frameworks Cheatsheet

> A conceptual reference for data governance frameworks — DAMA-DMBOK, DCAM, COBIT, and the operating models/roles that put them into practice. Complements [Master Data Management (MDM)](./Master_Data_Management_MDM_Cheatsheet.md) and [Data Mesh](./Data_Mesh_Cheatsheet.md), whose "federated computational governance" principle is a specific operating-model choice within this broader space.

## 📑 Table of Contents

1. [🧠 Core Concept](#core-concept)
2. [⚡ Quick Reference](#quick-reference)
3. [🎡 DAMA-DMBOK: The 11 Knowledge Areas](#dama-dmbok-the-11-knowledge-areas)
4. [📊 Other Major Frameworks](#other-major-frameworks)
5. [🧱 DCAM's 8 Components in Depth](#dcams-8-components-in-depth)
6. [🔀 Framework Comparison](#framework-comparison)
7. [👥 Roles & RACI](#roles-raci)
8. [🏛️ Governance Operating Models](#governance-operating-models)
9. [📈 Maturity Model with Worked Criteria](#maturity-model-with-worked-criteria)
10. [🔐 Worked Example: Operationalizing GDPR/CCPA](#worked-example-operationalizing-gdprccpa)
11. [📋 Worked Example: A Governance Council Charter](#worked-example-a-governance-council-charter)
12. [⚠️ Common Gotchas](#common-gotchas)
13. [🎯 Best Practices](#best-practices)
14. [💡 Pro Tips](#pro-tips)

## 🧠 Core Concept

**Data governance** is the system of decision rights, policies, standards, and accountability that ensures data is managed as a valued organizational asset. It answers: who can create/modify/access data, what quality bar it must meet, how it's classified and protected, and who is accountable when something goes wrong.

Data governance is often confused with **data management** — the broader discipline of actually doing the work (architecture, modeling, integration, storage). Governance is the *policy and accountability layer that sits over* data management: management is "how we do the work," governance is "who decides how the work should be done, and who's accountable for outcomes." Most frameworks in this space (DAMA-DMBOK especially) cover both, with governance positioned as the umbrella/coordinating function.

## ⚡ Quick Reference

| Term | Meaning |
|---|---|
| Data governance | Policies, decision rights, and accountability for managing data as an asset |
| Data management | The operational disciplines (architecture, modeling, quality, integration, security) governance oversees |
| Data owner | Business-accountable individual for a data domain's definition, quality, and appropriate use |
| Data steward | Operationally responsible for day-to-day data quality, definitions, and issue resolution within a domain |
| Data custodian | Technically responsible for the systems that store/process the data (often IT/DBAs) |
| Data governance council | Cross-functional body that sets policy, resolves cross-domain conflicts, and prioritizes initiatives |
| Policy | A rule that must be followed (e.g., "PII must be encrypted at rest") |
| Standard | A specification of how to comply with a policy (e.g., "use AES-256 for encryption at rest") |

| Framework | Type | Best Fit |
|---|---|---|
| DAMA-DMBOK | Comprehensive body of knowledge (11 knowledge areas) | Broad, vendor-neutral reference for building a full data management program |
| DCAM | Capability maturity assessment model (8 components, ~34 capabilities, ~101 sub-capabilities) | Benchmarking/assessing program maturity, especially in regulated industries (finance) |
| COBIT | IT governance framework | Aligning data/IT governance with enterprise risk, compliance, and control objectives |

## 🎡 DAMA-DMBOK: The 11 Knowledge Areas

DAMA International's **Data Management Body of Knowledge (DMBOK)** is the most widely referenced vendor-neutral framework. It's commonly visualized as the "DAMA wheel" — Data Governance sits at the hub, connecting to and coordinating 10 surrounding knowledge areas (11 total including governance itself).

```
                 ┌─────────────────────┐
                 │   Data Governance    │
                 │      (the hub)       │
                 └──────────┬──────────┘
       ┌───────────┬────────┼────────┬───────────┐
       │           │        │        │           │
   Architecture  Modeling  Storage  Security  Integration &
                 & Design  & Ops              Interop.
       │           │        │        │           │
   Document &   Reference  DW & BI  Metadata   Data Quality
   Content Mgmt  & Master           Mgmt        Mgmt
                 Data
```

| Knowledge Area | What It Covers |
|---|---|
| Data Governance | Policies, decision rights, roles/accountability for managing data as a business asset (the coordinating hub) |
| Data Architecture | Enterprise data structures, models, and frameworks aligning data design with business strategy |
| Data Modeling & Design | Conceptual, logical, and physical data models supporting integration, operations, and analytics |
| Data Storage & Operations | Physical storage design, database management, performance, and operational support |
| Data Security | Privacy, confidentiality, access control, and protection across the data lifecycle |
| Data Integration & Interoperability | Combining and moving data across systems while preserving meaning and lineage |
| Document & Content Management | Managing unstructured/semi-structured content (documents, records) as data assets |
| Reference & Master Data | Managing shared, authoritative data (see the [MDM Cheatsheet](./Master_Data_Management_MDM_Cheatsheet.md)) |
| Data Warehousing & Business Intelligence | Enabling analytics and reporting infrastructure |
| Metadata Management | Managing "data about data" for discoverability, lineage, and context |
| Data Quality Management | Ensuring data is accurate, complete, consistent, and fit for purpose |

DMBOK is intentionally **non-prescriptive** — it defines *what* a mature program needs to address across these areas without dictating *how*, which is why it's often used as a shared vocabulary/checklist rather than an implementation manual.

## 📊 Other Major Frameworks

### DCAM (Data Management Capability Assessment Model)

Published by the EDM Council, DCAM is a **maturity assessment model** rather than a body of knowledge — it defines capabilities across 8 components and scores an organization's maturity in each, producing a capability roadmap. Widely used in financial services, partly due to regulatory expectations (e.g., BCBS 239) for demonstrable data governance maturity. See [DCAM's 8 Components in Depth](#dcams-8-components-in-depth) below.

### COBIT (Control Objectives for Information and Related Technologies)

An **IT governance and management framework** from ISACA, broader than data alone — it covers governance of all enterprise IT, with data governance as one component nested inside overall IT risk, compliance, and control objectives. Organizations already using COBIT for IT governance often extend it to cover data governance rather than adopting a separate data-specific framework.

### Regulatory-Driven Frameworks

Many governance programs are shaped as much by compliance regimes as by a named framework: **GDPR** (EU data protection, right to erasure/portability), **CCPA/CPRA** (California consumer privacy), **HIPAA** (US healthcare data), and industry-specific rules (e.g., **BCBS 239** for bank risk data aggregation) impose concrete requirements — data lineage, consent management, retention limits, breach notification — that governance programs must operationalize regardless of which body-of-knowledge framework they nominally follow. See the [worked GDPR/CCPA example](#worked-example-operationalizing-gdprccpa) below.

## 🧱 DCAM's 8 Components in Depth

DCAM organizes roughly 34 capabilities and 101 sub-capabilities into 8 components, grouped into foundational, execution, collaboration, and an optional analytics component:

| # | Component | Group | What It Assesses |
|---|---|---|---|
| 1 | Data Strategy & Business Case | Foundational | Whether a documented data management strategy, roadmap, and stakeholder alignment exist |
| 2 | Data Management Program & Funding | Foundational | Whether the program has a sustainable funding model and change-management/communication plan |
| 3 | Business & Data Architecture | Execution | Whether business and data architecture are documented and aligned to strategy |
| 4 | Data & Technology Architecture | Execution | Whether the technical architecture (platforms, integration, infrastructure) supports the data strategy |
| 5 | Data Quality Management | Execution | Whether data quality rules, dimensions, and control processes are defined and enforced |
| 6 | Data Governance | Execution | Whether governance roles, policy, and decision rights are formally established |
| 7 | Data Control Environment | Collaboration | Whether controls (issue management, lineage, metadata) actually operate across producers and consumers day to day |
| 8 | Analytics Management | Optional | Whether advanced analytics/AI-ML practices (model explainability, responsible AI) are governed |

Each capability under these components is scored against defined maturity criteria (see [Maturity Model](#maturity-model-with-worked-criteria) below), producing both a component-level and an overall program score — this is what makes DCAM an *assessment* model rather than just a reference list like DMBOK.

## 🔀 Framework Comparison

| | DAMA-DMBOK | DCAM | COBIT |
|---|---|---|---|
| Type | Body of knowledge / reference model | Capability maturity assessment | IT governance framework |
| Scope | Data management broadly (11 areas) | Data management capability maturity (8 components) | All enterprise IT governance, data as one domain |
| Prescriptive? | No — defines "what," not "how" | Yes — scored capability levels with defined criteria | Yes — control objectives and maturity levels |
| Typical use | Shared vocabulary, program design, training/certification | Benchmarking maturity, especially regulated industries | Aligning data governance with broader IT risk/compliance |
| Industry association | Cross-industry, most common general reference | Strong in financial services | Cross-industry, strong in audit/compliance functions |

## 👥 Roles & RACI

| Role | Accountability |
|---|---|
| Chief Data Officer (CDO) | Executive sponsor and ultimate accountability for the data governance program |
| Data Governance Council | Cross-functional body (business + IT + compliance) setting policy and resolving disputes |
| Data Owner | Business-accountable for a specific data domain's definitions, quality bar, and appropriate use — typically a senior business role |
| Data Steward | Day-to-day operational responsibility for data quality, definitions, and issue triage within a domain — the hands-on role |
| Data Custodian | Technical responsibility for the systems/infrastructure storing and processing the data |
| Data Consumer | Uses data under the policies set by the above roles; responsible for appropriate use |

An expanded RACI across several representative activities:

| Activity | Data Owner | Data Steward | Data Custodian | Governance Council | CDO |
|---|---|---|---|---|---|
| Propose a new data standard (e.g., customer ID format) | C | R | C | I | I |
| Approve the standard | A | C | I | R | I |
| Implement technically | I | C | R | I | I |
| Monitor ongoing compliance | A | R | C | I | I |
| Resolve a cross-domain data conflict | C | C | I | R | A |
| Approve program budget/funding | I | I | I | C | A |
| Investigate a data breach/incident | I | R | R | C | A |
| Sign off on a new regulatory obligation's data impact | A | C | I | R | A |

## 🏛️ Governance Operating Models

| Model | Description | Trade-off |
|---|---|---|
| Centralized | One central governance team/office sets and enforces all policy | Strong consistency, but can bottleneck as the organization grows |
| Decentralized | Each business unit/domain governs its own data independently | Fast and locally optimal, but risks inconsistent standards and duplicated effort |
| Federated | A central council sets *global* standards; domains implement and enforce them locally, often via automated policy checks | Balances consistency and domain autonomy — the model behind Data Mesh's "federated computational governance" principle, but requires real coordination discipline to avoid becoming decentralized-in-practice |

## 📈 Maturity Model with Worked Criteria

Most governance maturity assessments (DCAM included) use a staged scale similar to the following five levels — shown here with worked example criteria for one capability, "PII classification," to make the levels concrete:

| Level | General Description | Worked Example: PII Classification Capability |
|---|---|---|
| 1. Initial/Ad hoc | Reactive, undocumented, depends on individual heroics | No formal PII inventory exists; classification happens informally when someone happens to notice a sensitive field |
| 2. Developing | Some policies/roles exist, inconsistently applied | A PII policy document exists, but only a few domains have actually classified their fields against it |
| 3. Defined | Documented policies, standards, and roles exist org-wide | Every domain has a documented, steward-reviewed PII inventory using a standard taxonomy |
| 4. Managed/Measured | Effectiveness is actively measured (KPIs) | PII classification coverage is tracked as a KPI (e.g., "94% of production tables classified"), reviewed quarterly by the council |
| 5. Optimizing | Continuously improved, increasingly automated | An automated scanner classifies new tables against the taxonomy at creation time, with stewards reviewing only low-confidence flags |

## 🔐 Worked Example: Operationalizing GDPR/CCPA

Regulatory requirements are often what actually forces a governance program from paper into practice. A concrete walkthrough for one requirement — the right to erasure ("right to be forgotten") — shows how the roles and artifacts above combine:

1. **Policy (set by the Governance Council):** "Any individual may request deletion of their personal data; the organization must comply within 30 days unless a documented legal retention exception applies."
2. **Standard (defined by Data Architecture, per DMBOK's Data Architecture knowledge area):** all systems holding personal data must implement a `delete_by_subject_id(subject_id)` capability, and every table containing PII must be registered in the metadata catalog with a `pii_owner` tag.
3. **Master data dependency:** because the same individual's data lives in multiple systems (CRM, billing, support), the erasure request has to resolve to the *same* person across all of them — which only works if [MDM](./Master_Data_Management_MDM_Cheatsheet.md) has already built a reliable cross-system identity link; without it, "delete everything about this person" can't reliably find everything.
4. **Data steward action:** upon a request, the data steward for each affected domain (Customer, Billing, Support) executes the deletion or anonymization procedure for their systems and confirms completion.
5. **Data custodian action:** IT/DBA teams ensure the deletion actually propagates through backups and downstream replicas per the documented retention/backup policy, not just the primary table.
6. **Governance council role:** tracks erasure-request SLA compliance as a program KPI (tying back to maturity level 4 above) and handles escalations where a legal retention exception conflicts with the deletion request.

This single regulatory requirement touches architecture, MDM, stewardship, technical custodianship, and council-level measurement — illustrating why "just write a privacy policy" is never sufficient on its own.

## 📋 Worked Example: A Governance Council Charter

A lightweight charter a newly-formed council might adopt, illustrating how the abstract "roles and RACI" sections above become an operating document:

```
DATA GOVERNANCE COUNCIL CHARTER (excerpt)

Purpose: Set enterprise-wide data policy, resolve cross-domain data
conflicts, and track data management maturity.

Membership: CDO (chair), one Data Owner per major domain (Customer,
Product, Finance, HR), Head of Data Architecture, Head of Security/
Compliance, Head of Platform Engineering.

Cadence: Monthly policy review; ad hoc for urgent escalations
(e.g., an active compliance deadline or data incident).

Decision rights:
  - The Council APPROVES: enterprise-wide policies and standards,
    cross-domain data conflicts, program funding priorities.
  - Domain Owners RETAIN: day-to-day data quality decisions and
    domain-specific data models, within approved global standards.

Escalation path: Data Steward -> Data Owner -> Governance Council
-> CDO, with a target 5-business-day resolution for non-urgent
escalations.

Review: This charter and all active policies are reviewed annually
or upon a material regulatory change.
```

Even a short, concrete charter like this does more to make federated governance real than a much longer policy document with no defined decision rights or escalation path.

## ⚠️ Common Gotchas

- **Governance as a compliance checkbox** — standing up a council and a policy binder without operational teeth (no enforcement, no consequences) produces "governance theater" that doesn't change behavior.
- **Confusing data governance with data management** — a program that only builds pipelines and catalogs (management) without decision rights and accountability (governance) will have technically good infrastructure and no one accountable when it's misused.
- **One framework treated as gospel** — DAMA-DMBOK, DCAM, and COBIT are references, not laws; most real programs blend elements (DMBOK's vocabulary, DCAM-style maturity scoring, COBIT's risk alignment) rather than adopting one wholesale.
- **Centralizing everything "for consistency"** — an overly centralized model recreates the same bottleneck data mesh was designed to avoid; federated models need real investment in automation to avoid becoming either fully centralized or fully ungoverned.
- **No business ownership** — governance run entirely by IT/data teams without real business data-owner accountability tends to produce policies the business doesn't follow because they were never consulted.
- **Policy without automation** — relying on manual review and documentation for enforcement doesn't scale; mature programs embed policy checks into pipelines and catalogs (this is where governance and [Data Fabric](./Data_Fabric_Cheatsheet.md)'s active-metadata automation intersect).
- **Erasure/access requests that can't actually find all the data** — as the GDPR worked example shows, without solid MDM identity resolution, a "right to be forgotten" request can silently miss systems that hold the same person's data under a different internal key.
- **A charter with no decision rights** — a governance council that meets regularly but never actually documents who can override whom on a conflict tends to relitigate the same disputes indefinitely.

## 🎯 Best Practices

- Assign a named business owner (not "the data team") to every major data domain.
- Separate policy (the rule) from standard (how to comply) so policies stay stable while technical standards evolve.
- Start with the highest-risk/highest-value domains (regulated data, customer PII, financial reporting) rather than trying to govern everything at once.
- Measure governance the way you'd measure any program: data quality scores, policy compliance rates, time-to-resolve data issues, not just "policies exist."
- Automate policy enforcement wherever possible (schema validation, PII scanning, access control) rather than relying purely on manual review.
- Revisit the operating model (centralized/decentralized/federated) as the organization scales — the right model at 50 people is rarely right at 5,000.
- Write a short, concrete council charter with explicit decision rights and an escalation path before debating which body-of-knowledge framework to adopt.

## 💡 Pro Tips

1. **The DAMA wheel is a checklist, not a roadmap** — use its 11 areas to find gaps in your program, but sequence implementation based on your actual risk and pain points, not the wheel's ordering.
2. **DCAM-style scoring is useful even without a formal certification** — self-assessing capability maturity per area (using the 5-level scale, scored per capability) gives you a defensible, quantified roadmap for governance investment.
3. **Federated governance only works with real automation** — the "federated computational governance" pattern from data mesh is a direct answer to the classic centralized-vs-decentralized trade-off, but it requires the self-serve platform to actually enforce policy in code.
4. **Compliance regimes are often the real forcing function** — GDPR, CCPA, HIPAA, and BCBS 239 requirements frequently drive more concrete governance investment than any named framework; map your framework's knowledge areas to your actual regulatory obligations early, as the erasure-request walkthrough illustrates.
5. **Roles matter more than tools** — a well-defined owner/steward/custodian model with real accountability produces better outcomes than an expensive governance platform with no one accountable for using it.
6. **A short charter beats a long policy binder** — the worked charter example above fits on one page and does more real governance work than a much longer document that never specifies who decides what.
