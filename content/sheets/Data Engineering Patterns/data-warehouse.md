# Data Warehouse

A data warehouse stores structured, governed data for analytical SQL, reporting, and BI workloads.

## Use when

- Consumers need stable schemas and repeatable metrics.
- Interactive analytical queries matter more than raw ingestion speed.
- Governance, access control, and auditing are important.

## Core pattern

```text
source systems -> extract and validate -> modeled warehouse tables -> BI and analytics
```

Prefer dimensional models for broad reporting, enforce data quality before publishing, and partition or cluster large tables around common filters.

## Trade-offs

Warehouses provide strong query performance and governance, but schema changes require coordination and compute costs can grow with query volume.
