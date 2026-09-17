# Enterprise Architecture Patterns Cheatsheet

> A conceptual reference for Enterprise Architecture (EA) frameworks and patterns — TOGAF, Zachman, FEAF, and ArchiMate — plus the integration and data-layer patterns EA governs. Ties together every other cheatsheet in this batch: Data Mesh, Data Fabric, Medallion Architecture, Data Governance, and MDM are all things an enterprise architecture program needs to place, standardize, and govern.

## 📑 Table of Contents

1. [🧠 Core Concept](#core-concept)
2. [⚡ Quick Reference](#quick-reference)
3. [🏗️ TOGAF & the ADM](#togaf-the-adm)
4. [🏢 Worked Example: TOGAF ADM for a Retail Modernization](#worked-example-togaf-adm-for-a-retail-modernization)
5. [🔲 The Zachman Framework](#the-zachman-framework)
6. [🔲 Worked Example: Filling a Zachman Cell](#worked-example-filling-a-zachman-cell)
7. [🇺🇸 FEAF](#feaf)
8. [🎨 ArchiMate](#archimate)
9. [🔀 Framework Comparison](#framework-comparison)
10. [🧩 Common EA Integration & Data Patterns](#common-ea-integration-data-patterns)
11. [🏛️ Architecture Governance](#architecture-governance)
12. [📦 EA Deliverables](#ea-deliverables)
13. [📋 Worked Example: An Architecture Principles Catalog](#worked-example-an-architecture-principles-catalog)
14. [⚠️ Common Gotchas](#common-gotchas)
15. [🎯 Best Practices](#best-practices)
16. [💡 Pro Tips](#pro-tips)

## 🧠 Core Concept

**Enterprise Architecture (EA)** is the discipline of describing and governing an organization's structure across business, information/data, application, and technology layers, so that IT investment and business strategy stay aligned as the organization changes and grows. EA frameworks give architects a shared vocabulary, a repeatable method for developing architecture, and a way to classify architectural artifacts so nothing important gets lost between "what the business needs" and "what gets built."

EA operates across four commonly recognized layers:

| Layer | Concerned With |
|---|---|
| Business Architecture | Strategy, governance, organization structure, key business processes |
| Data/Information Architecture | Data assets, models, and how information flows across the business (this is where Data Mesh, Data Fabric, Medallion, Governance, and MDM all live) |
| Application Architecture | The software systems and their relationships that support business capabilities |
| Technology Architecture | Hardware, infrastructure, networks, and platforms underpinning applications and data |

## ⚡ Quick Reference

| Framework | Type | Core Artifact |
|---|---|---|
| TOGAF | Methodology (a process to follow) | The Architecture Development Method (ADM) cycle |
| Zachman | Taxonomy (a classification scheme) | The 6×6 matrix of artifacts |
| FEAF | Government-specific methodology | Six reference models linked by the Consolidated Reference Model (CRM) |
| ArchiMate | Modeling language/notation | Layered diagrams (Business/Application/Technology + extensions) |

| Term | Meaning |
|---|---|
| Architecture Development Method (ADM) | TOGAF's iterative, phase-based process for developing an EA |
| Baseline architecture | The current, as-is state |
| Target architecture | The desired, to-be state |
| Gap analysis | Comparing baseline to target to identify what must change |
| Reference architecture | A reusable template/pattern for a class of solutions |
| Architecture Review Board (ARB) | The governance body that reviews and approves architecture decisions/exceptions |
| Capability map | A business-oriented view of what the organization can do, independent of how it's implemented |

## 🏗️ TOGAF & the ADM

**TOGAF** (The Open Group Architecture Framework) is the most widely adopted EA methodology. Its centerpiece is the **Architecture Development Method (ADM)** — an iterative cycle of phases that takes an organization from architecture vision through implementation and change management.

```
                    ┌───────────────────┐
                    │   Preliminary      │
                    │ (principles, scope)│
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
              ┌────▶│  A. Architecture   │◀────┐
              │     │     Vision         │      │
              │     └─────────┬─────────┘      │
   H. Architecture             │          Requirements
   Change Mgmt                 ▼           Management
              │     ┌─────────────────┐         (center,
              │     │ B. Business Arch │         touches
              │     ├─────────────────┤         every phase)
              │     │ C. Info Systems  │              │
              │     │    Architectures │              │
              │     │  (Data + Apps)   │              │
              │     ├─────────────────┤              │
              │     │ D. Technology    │              │
              │     │    Architecture  │              │
              │     └────────┬────────┘              │
              │              ▼                        │
              │     ┌─────────────────┐              │
              │     │ E. Opportunities │              │
              │     │    & Solutions   │              │
              │     ├─────────────────┤              │
              │     │ F. Migration     │              │
              │     │    Planning      │              │
              │     ├─────────────────┤              │
              └─────┤ G. Implementation│◀─────────────┘
                    │    Governance    │
                    └─────────────────┘
```

| Phase | Purpose |
|---|---|
| Preliminary | Establish the architecture team, framework, and principles the org will use |
| A: Architecture Vision | Define scope, stakeholders, and a high-level vision of the target state; get approval to proceed |
| B: Business Architecture | Document business strategy, governance, organization, and key processes (baseline + target) |
| C: Information Systems Architectures | Develop Data Architecture and Application Architecture (baseline + target) |
| D: Technology Architecture | Define the hardware, software platforms, and network infrastructure (baseline + target) |
| E: Opportunities & Solutions | Identify delivery vehicles — projects, programs — that will realize the target architecture |
| F: Migration Planning | Build a detailed, prioritized implementation and migration plan |
| G: Implementation Governance | Oversee actual implementation to ensure it conforms to the architecture |
| H: Architecture Change Management | Monitor for changes and trigger new ADM cycles as needed |
| Requirements Management | Not a sequential phase — sits at the center, feeding and receiving requirements from every other phase throughout the cycle |

The ADM is explicitly iterative: organizations rarely walk through it once start to finish — they cycle through it continuously as business needs evolve, often running multiple ADM cycles concurrently at different scopes (enterprise-wide vs. a single program).

## 🏢 Worked Example: TOGAF ADM for a Retail Modernization

A retailer is replacing its aging, centrally-batched data warehouse with a lakehouse and considering a phased move toward domain-owned data products. Walking it through the ADM:

| Phase | What Happens in This Example |
|---|---|
| Preliminary | The architecture team adopts TOGAF as its method and ratifies a principle: "prefer managed cloud services over self-hosted infrastructure." |
| A: Architecture Vision | Vision statement: "Reduce time-to-insight from days to hours by 2027, without increasing central data team headcount." Stakeholders: CDO, VP Engineering, domain leads. |
| B: Business Architecture | Documents that Orders, Catalog, and Fulfillment are the three domains generating the most reporting demand and the most current bottleneck tickets — baseline shows all three routing through one central team; target shows each owning its own reporting pipeline. |
| C: Information Systems Architectures | Data Architecture: adopt [Medallion Architecture](./Medallion_Architecture_Cheatsheet.md) on a lakehouse, with Orders/Catalog/Fulfillment as the first [data mesh](./Data_Mesh_Cheatsheet.md) domains. Application Architecture: identify which existing BI tools and ETL jobs must be retired or re-pointed. |
| D: Technology Architecture | Select the lakehouse platform, storage format, and orchestration tooling; define the self-serve platform's technical components (templated pipelines, catalog). |
| E: Opportunities & Solutions | Break the target state into delivery packages: "Phase 1: Orders domain pilot," "Phase 2: Catalog + Fulfillment onboarding," "Phase 3: retire legacy warehouse." |
| F: Migration Planning | Sequence Phase 1 first (highest pain, most motivated team) per the [data mesh adoption roadmap](./Data_Mesh_Cheatsheet.md#adoption-roadmap); set a 90-day pilot window. |
| G: Implementation Governance | The ARB reviews the Orders domain's first data product against the ratified architecture principles before it goes to production. |
| H: Architecture Change Management | Six months in, a new regulatory requirement (data residency) triggers a fast, targeted return to Phase D to revise the technology architecture — without restarting the whole cycle. |

This is the concrete shape of what "iterative" means in practice: Phase H doesn't restart at Phase A, it re-enters wherever the change actually requires rework.

## 🔲 The Zachman Framework

The **Zachman Framework**, created by John Zachman in 1987, is not a process — it's a **classification taxonomy**: a 6×6 matrix for organizing the architectural artifacts an enterprise produces, borrowed from how complex physical products (buildings, aircraft) are documented across multiple perspectives and abstraction levels.

| | What (Data) | How (Function) | Where (Network) | Who (People) | When (Time) | Why (Motivation) |
|---|---|---|---|---|---|---|
| **Scope (Planner)** | Business data classes | Business processes | Business locations | Org units | Business events | Business goals/strategy |
| **Business Model (Owner)** | Semantic/entity model | Business process model | Business logistics | Org/workflow model | Business master schedule | Business plan |
| **System Model (Designer)** | Logical data model | System/application architecture | Distributed system architecture | Human interface architecture | Processing structure | Business rule model |
| **Technology Model (Builder)** | Physical data model | System design | Technology architecture | Presentation architecture | Control structure | Rule design |
| **Detailed Representations (Sub-contractor)** | Data definitions | Program specs | Network architecture | Security architecture | Timing definitions | Rule specifications |
| **Functioning Enterprise** | Converted data | Executable programs | Deployed network | Trained/organized people | Business events | Enforced/executed rules |

Each cell represents a distinct artifact appropriate to that row's perspective and that column's aspect — a "logical data model" (System Model row, What column) is a fundamentally different artifact than a "physical data model" (Technology Model row, same column), even though both describe data. TOGAF's ADM phases can be mapped onto Zachman's cells (e.g., Phase C's Data Architecture work touches several "What" column cells across multiple rows), which is why the two are often used together — TOGAF as the *process*, Zachman as the *artifact taxonomy* that process fills in.

## 🔲 Worked Example: Filling a Zachman Cell

Continuing the retail modernization example, here's what the **"What" (Data)** column actually contains at each row, showing how the same subject — customer/order data — takes a completely different artifact shape at each level:

| Row | Artifact for "What" (Data) | Concrete Content in This Example |
|---|---|---|
| Scope (Planner) | Business data classes | "We manage Customers, Orders, Products, and Shipments" — a one-page list, no structure yet |
| Business Model (Owner) | Semantic/entity model | An entity-relationship diagram: Customer places Orders; an Order contains Order Lines referencing Products |
| System Model (Designer) | Logical data model | The conformed Silver-layer schema from the [Medallion Architecture](./Medallion_Architecture_Cheatsheet.md) design: `silver.customers_deduped(customer_id, name, email, ...)` |
| Technology Model (Builder) | Physical data model | The actual Delta Lake table DDL, partitioning strategy, and file layout on the chosen lakehouse platform |
| Detailed Representations | Data definitions | Column-level definitions in the data dictionary: `customer_id: UUID, primary key, never null, generated at first order` |
| Functioning Enterprise | Converted/running data | The live, populated production table actually being queried by dashboards today |

This is the practical value of Zachman: it stops "the data model" from being one ambiguous artifact and forces architects to be explicit about *which* of six very different things — from a one-line business concept to a running production table — they're actually talking about in a given conversation.

## 🇺🇸 FEAF

The **Federal Enterprise Architecture Framework (FEAF)**, developed for the U.S. federal government, is a specialized methodology (FEAF-II, 2013) built around six interconnected reference models, linked by the **Consolidated Reference Model (CRM)**, which gives agencies a shared language for describing and comparing IT investments:

| Reference Model | Domain | Purpose |
|---|---|---|
| Performance Reference Model (PRM) | Strategy | Links overall strategy and business architecture to IT investments, measuring performance against strategic outcomes |
| Business Reference Model (BRM) | Business | Describes government business services from the consumer's perspective, independent of which agency provides them |
| Data Reference Model (DRM) | Data | Standardizes data and information across government to improve sharing, discovery, and transparency, pulling data out of agency silos |
| Application Reference Model (ARM) | Applications | Categorizes software applications and components to detect duplicative investments and reuse opportunities |
| Infrastructure Reference Model (IRM) | Infrastructure | Standardizes technology infrastructure to promote interoperability and shared services |
| Security Reference Model (SRM) | Security | Ensures security and privacy principles are integrated across every other reference model |

The CRM's core value proposition is enabling a **line of sight** from strategic goals (PRM) all the way down to the software and hardware that implement them (ARM/IRM), specifically to help agencies spot duplicative investments and identify cross-agency collaboration opportunities — a concern less central to TOGAF or Zachman, which weren't built for a context where dozens of independent agencies need to compare architectures against each other. FEAF is most relevant to public-sector/government architecture work, where its reference models are often a compliance requirement rather than a voluntary choice.

## 🎨 ArchiMate

**ArchiMate** (also from The Open Group) is not a methodology or taxonomy — it's a **modeling language/notation** for actually drawing enterprise architecture diagrams with a standardized visual vocabulary. It defines layers (Business, Application, Technology) plus extensions (Motivation, Strategy, Implementation & Migration, Physical) and a consistent set of relationship types (realization, serving, triggering, flow) between elements across layers.

ArchiMate is frequently paired with TOGAF: TOGAF's ADM tells you *what activities to do and in what order*; ArchiMate gives you *the visual notation to actually document the resulting artifacts* consistently. A minimal ArchiMate-style relationship for the retail example: `[Business Service: "View Order Status"]` is **realized by** `[Application Component: "Order Tracking API"]`, which is **realized by** `[Technology Node: "Order Tracking API — Kubernetes deployment"]` — one traceable chain from a business-facing capability down to the infrastructure that runs it.

## 🔀 Framework Comparison

| | TOGAF | Zachman | FEAF | ArchiMate |
|---|---|---|---|---|
| What it is | A methodology (process) | A taxonomy (classification) | A government-specific methodology | A modeling notation |
| Answers | "What steps do we follow to build an EA?" | "What artifacts exist and how do they relate across perspectives?" | "How should a US federal agency structure its EA?" | "How do we draw/document the architecture consistently?" |
| Prescriptive about process? | Yes — the ADM is a defined cycle | No — doesn't prescribe a process, just a matrix | Yes — reference-model-driven process | No — it's a notation, not a process |
| Best paired with | Zachman (taxonomy) + ArchiMate (notation) | TOGAF or another process framework | Its own federal-specific artifacts | TOGAF (or any process framework needing diagrams) |
| Typical adopter | Large private-sector enterprises | Organizations wanting rigorous artifact classification | US federal agencies | Any organization documenting architecture visually |

## 🧩 Common EA Integration & Data Patterns

EA governs which integration and data patterns an organization standardizes on. Common patterns an architecture program will catalog and choose between:

| Pattern | Description | Typical Use |
|---|---|---|
| Point-to-point integration | Systems connect directly to each other | Small number of systems; becomes unmanageable (n² connections) as it scales |
| Hub-and-spoke | A central integration hub mediates all connections | Reduces n² connections to n, but the hub can become a bottleneck/single point of failure |
| Enterprise Service Bus (ESB) | A middleware bus providing routing, transformation, and protocol mediation between systems | Legacy SOA-era enterprises standardizing service communication |
| API Gateway / Microservices | Services expose well-defined APIs through a managed gateway (auth, rate limiting, routing) | Modern, independently deployable services; the current default pattern for new builds |
| Event-Driven Architecture | Systems communicate via published events on a broker (e.g., Kafka) rather than direct calls | Real-time, loosely-coupled, high-throughput integration needs |
| Data Warehouse / Lake / Lakehouse / Mesh / Fabric | The organization's chosen pattern(s) for analytical data — see the dedicated cheatsheets in this collection | Analytical/BI and ML data needs, chosen based on domain maturity and organizational scale |

EA is where the *choice* between, say, a centralized data warehouse and a decentralized data mesh gets made deliberately — as an architecture decision with documented trade-offs — rather than accreting organically team by team, as the retail modernization's Phase C decision illustrates.

## 🏛️ Architecture Governance

| Mechanism | Purpose |
|---|---|
| Architecture Review Board (ARB) | Cross-functional body that reviews proposed designs against principles/standards and approves exceptions |
| Architecture principles catalog | A documented, ratified set of principles ("buy before build," "prefer managed services," "data has one accountable owner") that guide all architecture decisions |
| Reference architectures | Pre-approved templates for common solution classes (e.g., "how we build a new microservice," "how we onboard a new data source") that speed up compliant delivery |
| Architecture compliance review | A checkpoint (often at project gates) verifying a delivered solution matches its approved architecture |
| Architecture debt register | A tracked list of known deviations from target architecture, with remediation plans, rather than silently accepted drift |

## 📦 EA Deliverables

A mature EA practice typically produces and maintains:

- **Principles catalog** — the ratified rules architecture decisions must follow.
- **Capability map** — a business-capability view of the organization, independent of current implementation, used to spot redundant investment and gaps.
- **Baseline & target architectures** — as-is and to-be states across business/data/application/technology layers.
- **Roadmap** — the sequenced set of initiatives that move the organization from baseline to target.
- **Reference architectures / patterns catalog** — reusable templates for recurring solution types.
- **Architecture repository** — the central store of all the above, kept current as change happens (not a one-time deliverable).

## 📋 Worked Example: An Architecture Principles Catalog

A short excerpt of the kind of ratified principles catalog produced in TOGAF's Preliminary phase and enforced by the ARB:

```
ARCHITECTURE PRINCIPLES CATALOG (excerpt)

P-01: Data Has One Accountable Owner
  Statement: Every production data asset has a named business owner
  responsible for its quality and appropriate use.
  Rationale: Prevents orphaned datasets with no one accountable
  when quality or access issues arise.
  Implication: New data products must register an owner in the
  catalog before going to production; the ARB rejects submissions
  without one.

P-02: Prefer Managed Services Over Self-Hosted Infrastructure
  Statement: New technology components should use a managed cloud
  service unless a documented requirement makes that infeasible.
  Rationale: Reduces operational burden on domain teams, consistent
  with a self-serve platform model.
  Implication: A request to self-host a database requires an
  explicit ARB exception with a written justification.

P-03: Breaking Changes Require a Notice Period
  Statement: Any breaking change to a published data or API contract
  requires a minimum 90-day deprecation notice to registered
  consumers.
  Rationale: Protects downstream consumers from silent outages.
  Implication: Directly operationalizes the data-contract discipline
  described in the Data Mesh cheatsheet.
```

Principles like these are what an ARB actually checks a proposal against during Phase G (Implementation Governance) — without a catalog this concrete, "architecture review" tends to become subjective and inconsistent from one review to the next.

## ⚠️ Common Gotchas

- **Framework worship over outcomes** — treating TOGAF/Zachman compliance as the goal rather than better-aligned business and IT investment; frameworks are means, not ends.
- **A method with no artifacts (or artifacts with no method)** — using only TOGAF's process without Zachman-style rigor on artifact classification (or vice versa) tends to leave gaps; most mature programs blend a process framework with a taxonomy and a notation.
- **An architecture repository nobody updates** — baseline/target architectures and the roadmap go stale fast if the ADM's iterative cycle (especially Phase H: Architecture Change Management) isn't actually operated as an ongoing practice.
- **ARB as a rubber stamp or as an innovation-blocking gate** — a review board with no real authority approves anything; one with no fast-track for reasonable exceptions strangles delivery velocity. Both failure modes are common.
- **EA disconnected from delivery teams** — architecture defined in isolation from the engineers actually building systems tends to be ignored in practice, regardless of how well-documented it is.
- **No link between EA's data-layer patterns and the actual data program** — an EA practice that mandates "we use a data mesh" without engaging the organizational and governance realities covered in the [Data Mesh](./Data_Mesh_Cheatsheet.md) and [Data Governance](./Data_Governance_Frameworks_Cheatsheet.md) cheatsheets tends to produce a mesh in name only.
- **A principles catalog with no teeth** — principles like P-01 through P-03 above only matter if the ARB actually rejects submissions that violate them; an unenforced catalog is functionally the same as having none.

## 🎯 Best Practices

- Pick a process framework (typically TOGAF) and a notation (typically ArchiMate) deliberately, rather than inventing a bespoke method from scratch.
- Keep the principles catalog short and genuinely enforced — a long list of unenforced principles is worse than a short list everyone actually follows.
- Give the ARB a documented fast-track for low-risk exceptions so governance doesn't become a delivery bottleneck.
- Maintain the architecture repository as a living asset with an owner, not a one-time consulting deliverable that goes stale.
- Involve delivery/engineering teams in defining reference architectures so they reflect what's actually buildable, not just what's ideal on a whiteboard.
- Treat the data-layer decisions (mesh vs. fabric vs. warehouse vs. lakehouse, governance operating model, MDM strategy) as first-class EA decisions with documented trade-offs, not afterthoughts bolted onto the technology architecture — exactly as Phase C of the worked ADM example does.

## 💡 Pro Tips

1. **TOGAF is the process, Zachman is the checklist, ArchiMate is the pen** — most confusion about "which framework should we use" disappears once you realize they answer different questions and are often used together.
2. **The ADM's center matters as much as its ring** — Requirements Management sits in the middle of the TOGAF cycle for a reason; architecture that doesn't continuously feed back into requirements drifts from business need over time.
3. **A capability map is the most durable EA artifact** — capabilities ("process customer payments") change far less often than the applications and technologies that implement them, making the capability map a stable anchor for roadmaps even as underlying systems are replaced.
4. **Architecture debt deserves the same visibility as technical debt** — tracking known deviations from target architecture explicitly (rather than letting them go undocumented) is what keeps an EA practice honest about its own gap between plan and reality.
5. **Zachman's real value shows up in disagreements** — when two architects seem to be arguing about "the data model" but are actually talking past each other, asking "which row are we even talking about" (per the filled-cell worked example) resolves more disputes than more discussion would.
6. **EA is where the other five cheatsheets in this batch get chosen, not just implemented** — the decision to adopt Data Mesh vs. a centralized warehouse, which governance operating model to run, and which MDM implementation style to pursue are architecture decisions that belong in the EA principles catalog and ARB process, not decisions made independently by whichever team gets there first.
7. **Phase H is where most EA practices quietly die** — many programs do Phases A-G well once and then never formally re-enter the cycle; treating architecture change management as an ongoing operational function (not a one-time project close-out) is what separates a living EA practice from a shelved slide deck.
