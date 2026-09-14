# Interview Framework — System Design for Data Engineers

> Requirements → scale estimation → high-level design → deep dive → failure modes → recap.
> A repeatable structure so a 45-minute question never turns into 45 minutes of silence or a
> design that collapses the moment the interviewer asks "what if this fails?"

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [The Six-Phase Framework](#the-six-phase-framework)
3. [Quick-Reference Table](#quick-reference-table)
4. [Phase 1: Clarifying Requirements](#phase-1-clarifying-requirements)
5. [Phase 2: Scale Estimation (Preview)](#phase-2-scale-estimation-preview)
6. [Phase 3: High-Level Design](#phase-3-high-level-design)
7. [Phase 4: Deep Dive](#phase-4-deep-dive)
8. [Phase 5: Failure Modes & Trade-offs](#phase-5-failure-modes--trade-offs)
9. [Phase 6: Recap & Wrap-up](#phase-6-recap--wrap-up)
10. [Time-Boxing the Interview (Python)](#time-boxing-the-interview-python)
11. [Requirements Checklist Tool (Python)](#requirements-checklist-tool-python)
12. [Clarifying Question Bank](#clarifying-question-bank)
13. [Whiteboard / Diagram Conventions](#whiteboard--diagram-conventions)
14. [Python: A Clarifying-Question Generator](#python-a-clarifying-question-generator)
15. [Practice Prompts with Sample Requirement Breakdowns](#practice-prompts-with-sample-requirement-breakdowns)
16. [Common Mistakes](#common-mistakes)
17. [Gotchas](#gotchas)
18. [Pro Tips](#pro-tips)

---

## Core Concepts

A **data engineering system design interview** is not a coding interview and not a pure
architecture-trivia quiz. It's testing whether you can:

- Turn an ambiguous prompt ("design an analytics pipeline for our e-commerce platform")
  into concrete, falsifiable requirements.
- Reason quantitatively about scale before you reason architecturally about components.
- Produce a design that is *defensible* — you can explain why each component exists and
  what breaks if you removed it.
- Handle pushback ("what if traffic 10x's", "what if this node dies") without abandoning
  your design or freezing.

The interviewer is grading your **process** at least as much as your final diagram. A
mediocre design defended with clear reasoning beats a great design that fell out of your
head with no explanation.

## The Six-Phase Framework

```
┌──────────────┐   ┌──────────────┐   ┌───────────────┐   ┌────────────┐   ┌────────────────┐   ┌─────────────┐
│ 1. Clarify   │──▶│ 2. Estimate  │──▶│ 3. High-Level │──▶│ 4. Deep    │──▶│ 5. Failure     │──▶│ 6. Recap /  │
│  Requirements│   │  Scale       │   │  Design       │   │  Dive      │   │  Modes &       │   │  Wrap-up    │
│              │   │              │   │               │   │            │   │  Trade-offs    │   │             │
└──────────────┘   └──────────────┘   └───────────────┘   └────────────┘   └────────────────┘   └─────────────┘
   ~15%               ~15%                ~25%               ~30%              ~10%                ~5%
```

This is deliberately similar in spirit to product/backend system design frameworks, but the
content of each phase is DE-specific: phase 2 is about **data volume and velocity**, not
"requests per second to a REST API"; phase 4 usually means **data modeling, storage layout,
and processing engine choice**, not "which cache do I put in front of the database."

## Quick-Reference Table

| Phase | Time (of 45m) | Core Question | Deliverable |
|---|---|---|---|
| 1. Clarify requirements | ~15% (7 min) | What does this system need to do, for whom, how fresh, how correct? | Written (or verbally confirmed) functional + non-functional requirements list |
| 2. Estimate scale | ~15% (7 min) | How many events/rows/bytes per day, and what does that imply for throughput/storage? | Back-of-envelope numbers: events/sec, GB/day, storage/year |
| 3. High-level design | ~25% (11 min) | What are the major components and how does data flow between them? | A box diagram: sources → ingestion → storage → processing → serving |
| 4. Deep dive | ~30% (14 min) | How exactly does the piece the interviewer cares about work? | Schema, partitioning scheme, processing logic, code sketch |
| 5. Failure modes & trade-offs | ~10% (4 min) | What breaks, and what did you trade off to get here? | Named failure scenarios + your mitigation, named alternatives + why you didn't pick them |
| 6. Recap | ~5% (2 min) | Does the design still hold together end to end? | One-paragraph summary tying it back to the original requirements |

## Phase 1: Clarifying Requirements

Never start drawing boxes before this phase. The single most common failure mode in DE
system design interviews is designing the *wrong* system extremely well.

**Functional requirements** — what the system must do:
- What are the data sources (databases, event streams, third-party APIs, files)?
- What transformations or aggregations are needed, and by whom?
- Who/what consumes the output — dashboards, ML models, other services, ad-hoc analysts?
- Does the system need to support backfill / historical reprocessing?

**Non-functional requirements** — the constraints the design must satisfy:
- **Freshness / latency**: is 24-hour batch acceptable, or do consumers need seconds-level freshness?
- **Availability**: what happens to upstream systems if this pipeline is down?
- **Consistency**: is eventual consistency fine, or do some consumers need strong guarantees (e.g. financial reporting)?
- **Durability**: what's the acceptable data loss window (RPO)?
- **Cost**: is this a startup optimizing for cheap-and-good-enough, or an enterprise optimizing for correctness/compliance?
- **Compliance**: PII, GDPR/right-to-be-forgotten, data residency?

A good rule of thumb: **spend real time here even if the interviewer seems eager to move
on.** Asking two or three sharp clarifying questions signals seniority far more than jumping
straight to a Kafka diagram.

## Phase 2: Scale Estimation (Preview)

Covered in full in `02-scale-estimation.md`. In this phase you're converting the
requirements into numbers: events/day, average record size, retention period, peak-to-average
ratio. You don't need precision — you need order-of-magnitude numbers that will *drive*
architectural decisions later ("100K events/day" pushes you toward a simple batch job;
"500M events/day" pushes you toward a distributed streaming platform).

## Phase 3: High-Level Design

Sketch the pipeline as a small number of boxes, left to right:

```
Sources → Ingestion → Raw/Landing Storage → Processing → Curated Storage → Serving Layer
   │           │              │                  │              │               │
  DBs,     Kafka/Kinesis,  S3/GCS/ADLS,      Spark/Flink/     Warehouse/       BI tool,
  APIs,    CDC connectors, data lake         dbt/batch job    Lakehouse        ML feature
  files                    "bronze"                           "silver/gold"    store, API
```

Narrate *why* each box exists as you draw it — don't just draw a generic reference
architecture from memory. If the interviewer says "why Kafka and not just writing straight
to the warehouse?", you should already have an answer ready (decoupling producers from
consumers, replay capability, multiple consumers of the same stream).

Keep this phase intentionally shallow. You are not committing to file formats or exact
schemas yet — that's phase 4. The goal here is agreement on the overall shape before you
invest in details the interviewer might redirect anyway.

## Phase 4: Deep Dive

This is where most of your score comes from. The interviewer will usually steer you toward
one or two areas: a schema, a specific transformation, a partitioning strategy, exactly-once
semantics, or how a specific failure is handled. Go deep, specifically:

- Write (or sketch) an actual schema — table names, key columns, partition keys.
- Show real logic — a SQL query, a PySpark transformation, or Python pseudocode — not just
  hand-waving ("then we aggregate the data").
- Explain the reasoning behind your data model choice referencing `03-storage-file-formats.md`
  and the separate Data Modeling cheatsheet (star/snowflake/Data Vault, SCD strategy).
- If asked about ordering/exactly-once, reference `05-cdc-idempotent-processing.md` and
  `06-fault-tolerance.md` directly — don't re-derive idempotency from first principles under
  time pressure if you've already got a documented talk track.

## Phase 5: Failure Modes & Trade-offs

Proactively name at least one failure mode and how your design handles it, even before the
interviewer asks — it's a strong signal and it primes the follow-up conversation to be on
your terms. E.g. "if the streaming consumer crashes mid-batch, we rely on committed offsets
plus an idempotent upsert so reprocessing the last uncommitted batch doesn't duplicate rows."

Also be ready to name what you *didn't* pick and why: "I chose a data lakehouse over a pure
warehouse here because we need to serve both SQL analytics and ML training reads from the
same curated tables without duplicating storage — the trade-off is slightly more operational
complexity than a pure warehouse."

## Phase 6: Recap & Wrap-up

In the last couple of minutes, tie the design back to the original requirements in one or two
sentences: "So to recap: this meets the 5-minute freshness requirement via the streaming
path, supports backfill via the batch/CDC replay path, and keeps cost bounded by partitioning
on ingestion date and expiring raw data after 90 days." This single recap sentence is cheap
and disproportionately improves how coherent your whole answer feels in retrospect.

## Time-Boxing the Interview (Python)

A simple helper to internalize before the interview — not something you'd run live, but
useful for practicing under realistic time pressure:

```python
from typing import Dict


def time_budget(total_minutes: int = 45) -> Dict[str, int]:
    """Allocate interview minutes across phases of the DE system design framework."""
    phases = {
        "1. Clarify requirements":       0.15,
        "2. Estimate scale":             0.15,
        "3. High-level design":          0.25,
        "4. Deep dive":                  0.30,
        "5. Failure modes & trade-offs": 0.10,
        "6. Recap / wrap-up":            0.05,
    }
    allocated = {phase: round(total_minutes * pct) for phase, pct in phases.items()}
    drift = total_minutes - sum(allocated.values())
    # give any rounding leftover to the deep dive -- that's where interviewers probe hardest
    allocated["4. Deep dive"] += drift
    return allocated


if __name__ == "__main__":
    for phase, minutes in time_budget(45).items():
        print(f"{phase:32s} {minutes:>3d} min")
```

Output:

```
1. Clarify requirements            7 min
2. Estimate scale                  7 min
3. High-level design              11 min
4. Deep dive                      14 min
5. Failure modes & trade-offs      4 min
6. Recap / wrap-up                 2 min
```

Use this to calibrate practice sessions with a real timer — most candidates under-invest in
phase 1 and over-invest in phase 3, then run out of time before a real deep dive.

## Requirements Checklist Tool (Python)

A lightweight structure to organize what you've learned during phase 1 — useful both as a
practice tool and as a mental model for what "done" looks like before you start designing:

```python
from dataclasses import dataclass, field
from typing import List, Dict


@dataclass
class RequirementsChecklist:
    functional: List[str] = field(default_factory=list)
    non_functional: List[str] = field(default_factory=list)
    consumers: List[str] = field(default_factory=list)
    slas: Dict[str, str] = field(default_factory=dict)

    def add_functional(self, item: str) -> "RequirementsChecklist":
        self.functional.append(item)
        return self

    def add_non_functional(self, item: str) -> "RequirementsChecklist":
        self.non_functional.append(item)
        return self

    def is_ready_to_design(self) -> bool:
        """A rough completeness gate: don't start sketching until these are ticked."""
        return bool(self.functional) and bool(self.non_functional) and bool(self.consumers)

    def summary(self) -> str:
        lines = ["Functional:"] + [f"  - {f}" for f in self.functional]
        lines += ["Non-functional:"] + [f"  - {n}" for n in self.non_functional]
        lines += ["Consumers:"] + [f"  - {c}" for c in self.consumers]
        lines += ["SLAs:"] + [f"  - {k}: {v}" for k, v in self.slas.items()]
        return "\n".join(lines)


if __name__ == "__main__":
    rc = (RequirementsChecklist()
          .add_functional("Ingest clickstream events from web + mobile")
          .add_functional("Support ad-hoc SQL analytics with <1 day latency")
          .add_non_functional("99.9% pipeline availability")
          .add_non_functional("At most 5 min end-to-end freshness for the real-time path"))
    rc.consumers = ["Analytics team (BI dashboards)", "Fraud model (near-real-time features)"]
    rc.slas = {"freshness_batch": "24h", "freshness_streaming": "5min", "availability": "99.9%"}

    print("Ready to design?", rc.is_ready_to_design())
    print(rc.summary())
```

Output:

```
Ready to design? True
Functional:
  - Ingest clickstream events from web + mobile
  - Support ad-hoc SQL analytics with <1 day latency
Non-functional:
  - 99.9% pipeline availability
  - At most 5 min end-to-end freshness for the real-time path
Consumers:
  - Analytics team (BI dashboards)
  - Fraud model (near-real-time features)
SLAs:
  - freshness_batch: 24h
  - freshness_streaming: 5min
  - availability: 99.9%
```

## Clarifying Question Bank

Grouped so you can pull from the right bucket depending on what the prompt emphasizes:

**Data characteristics**
- What's the shape of a single record, roughly? (a handful of fields vs. deeply nested JSON)
- Is the data structured, semi-structured, or unstructured?
- Is schema expected to change over time? How often?

**Volume & velocity**
- Roughly how many events/rows are generated per day?
- Is traffic steady, or bursty (e.g. flash sales, end-of-month batch closes)?
- How long does data need to be retained?

**Consumers & access patterns**
- Who reads this data, and how (SQL queries, API calls, streaming subscriptions)?
- Is it point lookups, large scans, or both?
- Do consumers need the *latest* state, full history, or both?

**Correctness & compliance**
- Does this involve PII or regulated data?
- Do late-arriving or out-of-order events need to be handled, and how?
- Is exactly-once processing a hard requirement, or is at-least-once with dedup acceptable?

**Operational constraints**
- Is there an existing platform/tooling we should build on (e.g. "we're already on Snowflake + Airflow")?
- What's the team's operational maturity — can they run a self-managed Kafka cluster, or do they need managed services?
- Is there a budget constraint stated or implied?

## Whiteboard / Diagram Conventions

Keep diagrams consistent so the interviewer can follow you without re-explaining notation:

- Boxes = systems/services. Arrows = data flow direction (label with format/protocol when it matters: "Avro over Kafka", "Parquet on S3").
- Use a distinct shape or color note for "storage" vs. "compute" boxes — interviewers often
  ask you to reason about scaling storage and compute independently.
- Label freshness/latency on the arrows where it's a differentiator (e.g. "~5s" vs "~1hr").
- Don't over-diagram: 6–10 boxes is usually the right ceiling for a 45-minute conversation.

## Python: A Clarifying-Question Generator

A heuristic that maps keywords in a prompt to the clarifying-question buckets most relevant
to it — useful as a mental checklist generator for practice, not a replacement for actually
listening to what the interviewer emphasizes:

```python
def suggest_clarifying_questions(prompt: str) -> list:
    prompt_lower = prompt.lower()
    questions = []

    keyword_map = {
        ("real-time", "real time", "fraud", "alert"): [
            "What's the maximum acceptable end-to-end latency?",
            "Is at-least-once processing acceptable, or does this need stronger guarantees?",
        ],
        ("dashboard", "report", "analytics", "bi"): [
            "How fresh does the dashboard data need to be?",
            "Are consumers running ad-hoc queries or a fixed set of known queries?",
        ],
        ("multi-tenant", "tenant", "subsidiary", "customer"): [
            "How many tenants, and roughly what scale per tenant?",
            "What's the isolation requirement between tenants?",
        ],
        ("pii", "compliance", "gdpr", "sensitive"): [
            "Is there a right-to-be-forgotten or data residency requirement?",
            "Which specific fields are considered sensitive?",
        ],
        ("ml", "machine learning", "model", "feature"): [
            "Do features need to be consistent between training and serving (no train/serve skew)?",
            "Is this for batch scoring or online/real-time inference?",
        ],
    }

    for keywords, qs in keyword_map.items():
        if any(k in prompt_lower for k in keywords):
            questions.extend(qs)

    questions += [
        "Roughly what's the expected data volume (events/rows per day)?",
        "Who are the downstream consumers of this data?",
    ]
    return questions


prompt = "Design a real-time fraud alerting system for a multi-tenant payments platform."
for q in suggest_clarifying_questions(prompt):
    print("-", q)
```

Output:

```
- What's the maximum acceptable end-to-end latency?
- Is at-least-once processing acceptable, or does this need stronger guarantees?
- How many tenants, and roughly what scale per tenant?
- What's the isolation requirement between tenants?
- Roughly what's the expected data volume (events/rows per day)?
- Who are the downstream consumers of this data?
```

Notice the prompt triggered two keyword buckets (`real-time`/`fraud` and `multi-tenant`) —
in practice a single prompt often spans several of these categories at once, which is why
skimming for multiple signal words (not just the first one you notice) matters before you
start designing.

## Practice Prompts with Sample Requirement Breakdowns

Three short prompts, each with a worked phase-1 requirements breakdown, to practice the
framework against before moving to a full design:

**Prompt A**: *"Design a system to ingest IoT sensor readings from industrial equipment and
alert on anomalous readings."*
- Functional: ingest sensor readings; detect anomalies; alert relevant personnel.
- Non-functional: likely bursty/uneven traffic (equipment doesn't report at a perfectly
  steady rate); alerting latency probably needs to be low (safety-relevant); readings
  likely need long-term retention for maintenance/compliance history.
- Good clarifying questions: how many sensors, what's the reporting frequency per sensor,
  what counts as "anomalous" (a fixed threshold vs. a learned baseline), who/what receives
  an alert and how (page a human? trigger automated shutoff?).

**Prompt B**: *"Design a data pipeline to power a company's internal weekly business review
deck."*
- Functional: aggregate metrics across several source systems into a small set of curated
  tables/report views.
- Non-functional: freshness of "by end of week" is generous — this is very likely a pure
  batch problem, and reaching for streaming here would be a red flag, not a strength.
- Good clarifying questions: which source systems, what specific metrics, is historical
  trend data needed (implying retention/versioning) or just the latest week's snapshot.

**Prompt C**: *"Design a system that lets three separate business units share a common
customer analytics platform without seeing each other's data."*
- Functional: shared analytics platform; per-business-unit data isolation.
- Non-functional: this is fundamentally a `08-security-governance-multitenancy.md` problem
  wearing a "design a pipeline" costume — the ingestion/storage/processing choices matter
  far less here than getting the isolation model right.
- Good clarifying questions: how many business units total (3 named, but is the design
  expected to scale beyond that), is there a *cross*-business-unit reporting need (which
  would require a controlled aggregation path, not just per-tenant isolation).

## Common Mistakes

- **Designing before clarifying.** Jumping straight to "we'll use Kafka and Spark" before
  establishing scale or latency requirements — often the *wrong* tools for the actual ask.
- **Over-engineering for FAANG-scale by default.** Not every prompt is "design YouTube's
  analytics pipeline." Match the design to the stated (or reasonably inferred) scale.
- **Silence during estimation.** Thinking scale math in your head — narrate it, even if it's
  rough. The interviewer is grading the reasoning, not just the final number.
- **Ignoring the deep-dive signal.** If the interviewer keeps asking about one component,
  that's explicit signal to stop broadening the design and start narrowing.
- **No opinions.** Presenting three options with no recommendation. Always pick one and
  state your reasoning, then be ready to defend or revise it.

## Gotchas

- Spending the whole 45 minutes on the high-level design and never reaching a deep dive is a
  common way to under-perform even with a "correct" architecture — depth is where points live.
- Rigidly following your planned time budget when the interviewer is clearly probing
  somewhere specific will read as not listening. Treat the budget as a default, not a script.
- Some interviewers intentionally give an under-specified prompt to see if you ask questions
  at all — don't treat "design a data pipeline for X" as complete information.
- A design that's internally consistent but never ties back to the stated requirements
  (e.g. you designed for 5-second freshness when 24-hour batch was explicitly fine) reads as
  not having listened, even if the design itself is technically sound.

## Pro Tips

- State assumptions out loud as you make them: "I'll assume ~10M daily active users unless
  you tell me otherwise" — this converts silent guessing into visible reasoning.
- Reuse the same six-phase skeleton across every practice problem until it's automatic; the
  framework should free up your working memory for the actual design, not compete with it.
- When stuck, fall back to naming trade-offs explicitly rather than freezing: "there's a
  real trade-off here between full exactly-once semantics and simpler at-least-once + dedup
  — given the freshness requirement isn't strict, I'd lean toward the simpler option."
- Keep a small mental (or literal) library of 3–4 "default" architectures you can adapt
  (batch ELT into a warehouse, streaming ingestion with a lakehouse, CDC-based replication,
  hybrid Lambda-style pipeline) — most prompts are a variation on one of these.
