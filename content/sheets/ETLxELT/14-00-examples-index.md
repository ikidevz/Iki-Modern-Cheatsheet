# Worked Examples — Index

Ten production-grade, end-to-end examples, each combining multiple concepts from files 01–13 into a realistic implementation. Every example follows the same structure so they're easy to compare and extend:

**Scenario & Business Context → Architecture → Full Implementation → Design Rationale → Production Considerations → How to Extend This Example**

| # | Example | Type | Primary Concepts Used | Ties to Files |
|---|---|---|---|---|
| 1 | [Batch ELT Pipeline — E-Commerce Orders](14-01-batch-elt-ecommerce-orders.md) | ELT | Incremental extraction, SCD Type 2, star schema, dbt + Airflow | 02, 03, 04, 05 |
| 2 | [CDC-Based Near-Real-Time Inventory Sync](14-02-cdc-inventory-sync.md) | ELT | Log-based CDC, Kafka, idempotent MERGE, freshness monitoring | 02, 04, 06, 10 |
| 3 | [Streaming Clickstream Analytics](14-03-streaming-clickstream-analytics.md) | ETL | Stream processing, tumbling windows, delivery guarantees, dual-sink serving | 06, 09 |
| 4 | [Production dbt Project — Medallion Layer Structure](14-04-dbt-medallion-project-structure.md) | ELT | Staging/intermediate/marts layering, naming conventions, domain organization | 03, 08 |
| 5 | [Data Quality Gate Before Publishing to BI](14-05-data-quality-gate-pipeline.md) | ELT | dbt tests, quarantine pattern, alert routing, hard gating | 05, 07, 10 |
| 6 | [Safe Backfill After a Bug Fix](14-06-safe-backfill-after-bug-fix.md) | ELT | Chunked backfill, idempotency, audit logging | 04, 05 |
| 7 | [Multi-Source Customer 360 Pipeline](14-07-multi-source-customer-360.md) | ELT | Entity resolution, surrogate keys, deterministic + fuzzy matching | 03, 08 |
| 8 | [File-Based Landing Zone Ingestion](14-08-file-landing-zone-ingestion.md) | ETL | Schema validation, row-level quarantine, S3 event sensing | 02, 07 |
| 9 | [Real-Time Fraud Detection Streaming Pipeline](14-09-realtime-fraud-detection.md) | Hybrid | Sliding windows, feature stores, Lambda-style split, model drift monitoring | 06, 08, 09 |
| 10 | [GDPR PII Deletion Propagation Pipeline](14-10-gdpr-deletion-propagation.md) | N/A | PII registry, cross-system deletion, audit trail, compliance | 07, 10, 11 |

## Suggested Reading Order

- **New to production pipelines** → start with 1 (batch ELT) and 4 (dbt structure) — the most foundational patterns.
- **Working with real-time data** → 2 (CDC) → 3 (streaming analytics) → 9 (fraud detection, most advanced streaming example).
- **Reliability & trust in data** → 5 (quality gate) → 6 (backfill) → 8 (file ingestion quarantine).
- **Governance-heavy work** → 7 (entity resolution) → 10 (GDPR deletion).

Each example's **"How to Extend This Example"** section is intentionally open-ended — use it as a starting point to adapt the pattern to your own stack and constraints rather than copying the code verbatim.
