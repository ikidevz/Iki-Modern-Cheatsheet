# Tools & Platforms Landscape

Each category below lists common tools plus guidance on how to choose between them.

## Ingestion Tools

| Tool | Notes |
|---|---|
| Fivetran | Managed, fully hosted connectors; low-maintenance, paid per row |
| Airbyte | Open-source alternative to Fivetran; self-host or cloud |
| Debezium | Log-based CDC for databases, feeds into Kafka |
| Stitch | Simple managed ELT connector service |

**When to Use / Trade-offs:** Choose managed connectors (Fivetran/Stitch) when engineering time is scarcer than budget. Choose Airbyte when cost control and self-hosting flexibility matter more, or a connector isn't available on Fivetran. Choose Debezium when you need low-latency, log-based CDC rather than periodic polling.

**Common Pitfalls:** Committing to a per-row-priced managed connector before estimating volume growth — costs can scale unexpectedly with data growth.

---

## Transformation Tools

| Tool | Notes |
|---|---|
| dbt | SQL-based transformation, testing, and documentation layer; the ELT-era standard |
| Apache Spark | Distributed processing for large-scale batch/streaming transforms |
| SQL (native warehouse) | Simplest option — stored procedures/scheduled queries directly in the warehouse |

**When to Use / Trade-offs:** dbt is the default choice for warehouse-native SQL transformation with built-in testing/docs. Reach for Spark when transformations require distributed compute beyond what a warehouse handles efficiently, or need to process data outside a warehouse (e.g., raw files in a lake).

**Common Pitfalls:** Using Spark for transformations that a warehouse's native SQL engine could handle more simply and cheaply.

---

## Warehouses / Lakehouses

| Platform | Notes |
|---|---|
| Snowflake | Cloud-native warehouse, separates storage/compute, strong ecosystem |
| BigQuery | Serverless, pay-per-query, tightly integrated with GCP |
| Redshift | AWS-native warehouse, strong for AWS-centric stacks |
| Databricks (Delta Lake) | Lakehouse — unifies data lake storage with warehouse-like transactions |

**When to Use / Trade-offs:** Pick based on existing cloud ecosystem (BigQuery for GCP shops, Redshift for AWS shops) unless there's a specific reason to go multi-cloud (Snowflake). Choose Databricks/lakehouse when workloads mix heavy ML/data science with traditional BI.

**Common Pitfalls:** Choosing a warehouse purely on benchmark comparisons without factoring in existing team skills and cloud ecosystem lock-in.

---

## Orchestrators

| Tool | Notes |
|---|---|
| Apache Airflow | Most widely adopted; Python-based DAGs, large plugin ecosystem |
| Dagster | Asset-centric orchestration, strong typing and testing story |
| Prefect | Python-native, simpler setup than Airflow, good for smaller teams |
| Mage | Newer, notebook-like DX for building pipelines |

**When to Use / Trade-offs:** Airflow is the safest default for hiring/ecosystem reasons. Dagster suits teams wanting stronger data-asset abstractions and testing built in from the start. Prefect suits smaller teams wanting less operational overhead than Airflow.

**Common Pitfalls:** Adopting Airflow for a two-person team with simple scheduling needs, taking on more operational overhead than the use case requires.

---

## Streaming Platforms

| Tool | Notes |
|---|---|
| Apache Kafka | De facto standard event streaming platform/log |
| AWS Kinesis | Managed streaming, native AWS integration |
| Apache Flink | Low-latency stream processing engine |
| Google Pub/Sub | Managed messaging, tightly integrated with GCP |

**When to Use / Trade-offs:** Kafka is the standard choice when self-managing infra or needing broad ecosystem support. Kinesis/Pub/Sub reduce operational overhead within their respective clouds. Flink is typically paired with Kafka for the actual stream processing logic, rather than being a replacement for it.

**Common Pitfalls:** Standing up self-managed Kafka without the operational expertise to run it reliably — managed alternatives (Kinesis, Confluent Cloud) are often the safer starting point.
