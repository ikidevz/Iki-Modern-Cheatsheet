# ETL/ELT Cheatsheet — Index

A structured reference for working data engineers, organized by pipeline stage and cross-cutting concern. Each file below is self-contained; sections within a file are anchored by `##` headers for direct linking.

| # | File | Covers |
|---|---|---|
| 1 | [Fundamentals & Core Concepts](01-fundamentals.md) | ETL vs ELT, batch/streaming, OLTP/OLAP, warehouse/lake/lakehouse, push vs pull |
| 2 | [Extract](02-extract.md) | Source types, extraction patterns, CDC, schema drift, rate limiting |
| 3 | [Transform](03-transform.md) | Cleaning, data modeling, SCD types, deduplication, aggregations |
| 4 | [Load](04-load.md) | Load strategies, partitioning, idempotency, backfilling |
| 5 | [Orchestration & Scheduling](05-orchestration.md) | DAGs, scheduling patterns, retries, backfill/re-run |
| 6 | [Streaming & Real-Time Processing](06-streaming.md) | Stream concepts, windowing, delivery guarantees, Lambda/Kappa |
| 7 | [Data Quality & Testing](07-data-quality.md) | Validation rules, data contracts, testing frameworks, anomaly detection |
| 8 | [Architecture & Design Patterns](08-architecture-patterns.md) | Medallion, Kimball vs Inmon, Data Mesh, anti-patterns |
| 9 | [Performance & Optimization](09-performance.md) | Partitioning/indexing, query optimization, parallelism, caching |
| 10 | [Monitoring, Observability & Lineage](10-monitoring-observability.md) | Logging/alerting, lineage, SLAs/freshness |
| 11 | [Security & Governance](11-security-governance.md) | RBAC, PII handling, compliance, encryption |
| 12 | [Tools & Platforms Landscape](12-tools-landscape.md) | Ingestion, transformation, warehouse, orchestrator, streaming tool comparisons |
| 13 | [Quick Reference](13-quick-reference.md) | SQL/CLI snippet index, glossary, tool decision table |
| 14 | [Worked Examples — Index](14-00-examples-index.md) | 10 production-grade, end-to-end scenarios, each in its own file, combining concepts from files 1–13 |

## How Entries Are Documented

Every concept below `##` in files 1–11 follows the same template, so entries are scannable and comparable at a glance:

- **Definition** — what it is, in one or two sentences
- **Key Points** — the details that matter operationally
- **Example** — code, config, or a worked scenario where applicable
- **When to Use / Trade-offs** — the decision criteria
- **Common Pitfalls** — mistakes seen in production systems

## Suggested Navigation

- New to a concept → start at **Fundamentals**, then the stage file (Extract/Transform/Load) it belongs to.
- Debugging a live pipeline → **Monitoring** → **Data Quality** → **Orchestration**.
- Choosing tooling → **Tools & Platforms Landscape** → **Quick Reference** decision table.
- Design review / new pipeline → **Architecture & Design Patterns** → relevant stage file → **Security & Governance**.
- Want to see concepts applied together, not in isolation → **Worked Examples** (file 14).
