# Data Catalog & Lineage Tooling Cheatsheet for Data & Analytics Engineers

> A structured reference for metadata management — cataloging tools (OpenMetadata, DataHub, Amundsen, Unity Catalog), the OpenLineage standard, lineage graph concepts, ingestion patterns, and governance workflows.

## 📑 Table of Contents

1. [🧠 Core Concepts](#core-concepts)
2. [🗺️ Tool Landscape](#tool-landscape)
3. [🚀 DataHub: Setup & Ingestion](#datahub-setup-ingestion)
4. [🚀 OpenMetadata: Setup & Ingestion](#openmetadata-setup-ingestion)
5. [🔗 OpenLineage & Marquez](#openlineage-marquez)
6. [🧬 Column-Level Lineage](#column-level-lineage)
7. [🏷️ Business Glossary & Tagging](#business-glossary-tagging)
8. [🔍 Metadata APIs & GraphQL/SDK Access](#metadata-apis-graphql-sdk-access)
9. [🔐 Governance: Ownership, Classification & Access](#governance-ownership-classification-access)
10. [🏔️ dbt Lineage & Docs](#dbt-lineage-docs)
11. [🧭 Amundsen: Search-First Discovery](#amundsen-search-first-discovery)
12. [🔷 Unity Catalog](#unity-catalog)
13. [🐘 Apache Atlas & the Hadoop Ecosystem](#apache-atlas-the-hadoop-ecosystem)
14. [📜 Data Contracts](#data-contracts)
15. [✅ Data Quality as Catalog Metadata](#data-quality-as-catalog-metadata)
16. [⚠️ Common Gotchas](#common-gotchas)
17. [🎯 Best Practices](#best-practices)
18. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Task                    | DataHub                                        | OpenMetadata                              | OpenLineage/Marquez               |
| ------------------------ | -------------------------------------------------| --------------------------------------------| ------------------------------------ |
| Ingest metadata          | `datahub ingest -c recipe.yaml`                 | `metadata ingest -c recipe.yaml`           | Emit `RunEvent`s from job code      |
| Search entities          | Web UI / GraphQL `search` query                 | Web UI / REST `/search/query`              | Marquez UI graph view               |
| Get lineage              | GraphQL `searchAcrossLineage`                    | REST `/lineage/{entityType}/{id}`          | `GET /lineage?nodeId=...`           |
| Tag / classify           | `datahub put` or UI                              | UI / REST `/classifications`               | N/A (lineage-focused, not a catalog) |
| Programmatic emit        | Python `DatahubRestEmitter`                      | Python `OpenMetadata` client                | Python `openlineage-python` client  |

## 🧠 Core Concepts

- **Data catalog** — a searchable inventory of data assets (tables, dashboards, pipelines, ML models) with metadata: schema, owner, description, tags, usage stats, quality signals.
- **Lineage** — the graph of *what produced what*: table-to-table, job-to-table, and (at finer grain) column-to-column dependencies. Answers "where did this come from" (upstream) and "what breaks if I change this" (downstream/impact analysis).
- **Technical metadata** — schema, types, partitioning, row counts — usually auto-extracted by scanning source systems.
- **Business metadata** — glossary terms, ownership, descriptions, tags, SLAs — usually curated by humans or synced from a source of truth (e.g., a Slack channel owner, a wiki).
- **Push vs pull metadata collection**:
  - *Pull (crawling)*: the catalog connects to a source (warehouse, BI tool) and scans its metadata on a schedule.
  - *Push (event-based)*: producers (ETL jobs, orchestrators) actively emit lineage/run events as they execute — this is what OpenLineage standardizes.

## 🗺️ Tool Landscape

| Tool | Type | Notes |
| --- | --- | --- |
| **DataHub** (LinkedIn-originated) | Catalog + lineage | Push-based (metadata events) architecture, GraphQL API, strong lineage visualization, Kafka-backed metadata stream |
| **OpenMetadata** | Catalog + lineage + quality | Unified platform including data quality tests and observability, REST-first, Postgres/MySQL backed |
| **Amundsen** (Lyft-originated) | Catalog | Search/discovery focused, simpler lineage story than DataHub/OpenMetadata, less actively evolving |
| **Apache Atlas** | Catalog + lineage | Hadoop-ecosystem native, integrates tightly with Hive/HBase/Ranger for governance |
| **Unity Catalog** (Databricks) | Catalog + governance | Native to Databricks/Delta Lake, unifies access control + lineage + discovery within that ecosystem |
| **AWS Glue Data Catalog** | Technical catalog | Metastore for the AWS analytics stack (Athena/EMR/Redshift Spectrum), minimal business metadata features |
| **Collibra / Alation** | Enterprise catalog (commercial) | Strong governance/stewardship workflows, business-user-friendly UI, licensing cost |
| **Marquez** | Lineage backend | Reference implementation of the OpenLineage spec, lineage-focused rather than full catalog/search |
| **OpenLineage** | Spec, not a tool | Vendor-neutral standard for emitting lineage events; consumed by Marquez, DataHub, and others |

## 🚀 DataHub: Setup & Ingestion

```bash
pip install acryl-datahub
datahub docker quickstart          # local dev instance (GMS + UI + Kafka + Elasticsearch)
```

```yaml
# recipe.yaml — ingest metadata from a Snowflake warehouse
source:
  type: snowflake
  config:
    account_id: myaccount
    username: ${SNOWFLAKE_USER}
    password: ${SNOWFLAKE_PASSWORD}
    warehouse: COMPUTE_WH
    include_table_lineage: true
    include_view_lineage: true
    profiling:
      enabled: true

sink:
  type: datahub-rest
  config:
    server: http://localhost:8080
```

```bash
datahub ingest -c recipe.yaml
```

```python
# Programmatic emission (e.g., from within an ETL job)
from datahub.emitter.rest_emitter import DatahubRestEmitter
from datahub.metadata.schema_classes import DatasetPropertiesClass, MetadataChangeProposalWrapper

emitter = DatahubRestEmitter("http://localhost:8080")
mcp = MetadataChangeProposalWrapper(
    entityUrn="urn:li:dataset:(urn:li:dataPlatform:snowflake,analytics.sales.orders,PROD)",
    aspect=DatasetPropertiesClass(description="Cleaned order-level fact table"),
)
emitter.emit(mcp)
```

## 🚀 OpenMetadata: Setup & Ingestion

```bash
# Local dev with docker compose
mkdir openmetadata-docker && cd openmetadata-docker
curl -sL -o docker-compose.yml \
  https://github.com/open-metadata/OpenMetadata/releases/download/<version>/docker-compose.yml
docker compose up -d          # UI at http://localhost:8585
```

```yaml
# ingestion.yaml — ingest from a Postgres source
source:
  type: postgres
  serviceName: prod-postgres
  serviceConnection:
    config:
      type: Postgres
      username: openmetadata
      password: ${DB_PASSWORD}
      hostPort: localhost:5432
      database: analytics
  sourceConfig:
    config:
      type: DatabaseMetadata
      markDeletedTables: true

sink:
  type: metadata-rest
  config: {}

workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth
```

```bash
metadata ingest -c ingestion.yaml

# Also supports dedicated pipelines for profiling and quality tests
metadata profile -c profiler.yaml
metadata test -c test_suite.yaml
```

## 🔗 OpenLineage & Marquez

```python
# Emitting OpenLineage events directly from a Python job (framework-agnostic)
from openlineage.client import OpenLineageClient
from openlineage.client.run import RunEvent, RunState, Run, Job, Dataset
from openlineage.client.uuid import generate_new_uuid
from datetime import datetime

client = OpenLineageClient(url="http://localhost:5000")

run_id = str(generate_new_uuid())
job = Job(namespace="analytics", name="daily_orders_etl")

client.emit(RunEvent(
    eventType=RunState.START, eventTime=datetime.utcnow().isoformat(),
    run=Run(runId=run_id), job=job, producer="my-etl-script",
    inputs=[Dataset(namespace="postgres://prod", name="public.raw_orders")],
    outputs=[],
))

# ... job runs ...

client.emit(RunEvent(
    eventType=RunState.COMPLETE, eventTime=datetime.utcnow().isoformat(),
    run=Run(runId=run_id), job=job, producer="my-etl-script",
    inputs=[Dataset(namespace="postgres://prod", name="public.raw_orders")],
    outputs=[Dataset(namespace="postgres://prod", name="analytics.orders_clean")],
))
```

```bash
# Airflow: OpenLineage integration auto-emits lineage for standard operators
pip install apache-airflow-providers-openlineage
export OPENLINEAGE_URL=http://localhost:5000
export OPENLINEAGE_NAMESPACE=analytics

# Spark: attach the OpenLineage listener, get automatic lineage for DataFrame jobs
spark-submit \
  --packages io.openlineage:openlineage-spark:1.x.x \
  --conf spark.extraListeners=io.openlineage.spark.agent.OpenLineageSparkListener \
  --conf spark.openlineage.transport.url=http://localhost:5000 \
  job.py
```

```bash
# Marquez — the reference OpenLineage backend
docker compose up   # from the marquez repo; UI at http://localhost:3000
curl -X POST http://localhost:5000/api/v1/lineage -d @event.json  # raw event ingestion
curl http://localhost:5000/api/v1/namespaces/analytics/jobs/daily_orders_etl/runs
```

- **OpenLineage is the standard, Marquez is one implementation** — DataHub, and several orchestrators (Airflow, Dagster) can also consume or produce OpenLineage events, making it the closest thing to a portable lineage contract across tools.
- **Facets** extend the base event schema with structured extra data: `schema`, `dataQualityMetrics`, `columnLineage`, `sql`, without breaking compatibility for consumers that don't understand a given facet.

## 🧬 Column-Level Lineage

```sql
-- Most catalogs derive column lineage by parsing SQL (e.g., dbt-generated SQL, or query logs)
-- Example: a transformation whose column lineage should resolve automatically
CREATE TABLE analytics.customer_ltv AS
SELECT
    c.customer_id,
    c.email,                          -- customer_ltv.email  <- raw_customers.email
    SUM(o.amount) AS lifetime_value    -- customer_ltv.lifetime_value <- raw_orders.amount (via SUM)
FROM raw_customers c
JOIN raw_orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.email;
```

- Column-level lineage is typically produced one of three ways: **SQL parsing** (static analysis of query text), **query-log analysis** (mining warehouse query history), or **explicit facets** emitted by the job itself (most reliable, but requires instrumentation).
- This is what powers **impact analysis** — "if I drop/rename this column, which 14 downstream dashboards break?" — the highest-value use case for most analytics teams.
- Accuracy varies a lot by tool and by SQL complexity (`SELECT *`, dynamic SQL, and UDFs commonly defeat static parsers) — always spot-check column lineage on complex queries before trusting it for a breaking change.

## 🏷️ Business Glossary & Tagging

```yaml
# DataHub glossary term definition (YAML business glossary source)
- name: Customer Lifetime Value
  id: CLV
  description: "Total historical revenue attributed to a customer."
  term_source: INTERNAL
  owners: ["urn:li:corpuser:analytics-team"]
  domain: Finance
```

```python
# Tag a dataset/column programmatically (OpenMetadata example)
from metadata.generated.schema.entity.data.table import Table
client.patch(
    entity=Table, source=table_entity,
    destination=table_entity.copy(update={"tags": [{"tagFQN": "PII.Sensitive"}]})
)
```

- **Glossary terms** map business language ("Customer Lifetime Value") to the physical columns/tables that implement it — critical for self-serve BI where analysts don't know the schema.
- **Tags/classifications** (`PII`, `Confidential`, `Deprecated`) drive both discovery (filter search by tag) and governance (mask/restrict tagged columns automatically in some platforms).
- **Domains** group assets by business area (Finance, Marketing, Growth) independent of which physical system/database they live in.

## 🔍 Metadata APIs & GraphQL/SDK Access

```graphql
# DataHub GraphQL: search + lineage in one call
query {
  searchAcrossLineage(
    input: { urn: "urn:li:dataset:(...)", direction: DOWNSTREAM, types: [DATASET], start: 0, count: 10 }
  ) {
    searchResults { entity { urn type } degree }
  }
}
```

```bash
# OpenMetadata REST
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8585/api/v1/lineage/table/<table-id>?upstreamDepth=3&downstreamDepth=3"
```

- Programmatic access matters most for **automating impact analysis in CI** (e.g., "block a PR that changes a column referenced by 20 downstream dbt models") and for **building custom internal tools** on top of catalog data.

## 🔐 Governance: Ownership, Classification & Access

- **Ownership** — every table/dashboard should resolve to a human or team owner; catalogs surface this in search results and use it to route data-quality alerts.
- **PII classification** — auto-detected (regex/ML-based column name & sample-value scanning) or manually tagged; feeds into masking/access-control policies in platforms like Unity Catalog or Atlas+Ranger.
- **Deprecation workflows** — mark a table `Deprecated` with a pointer to its replacement; catalogs surface a warning in search/lineage views so consumers migrate before a hard cutover.
- **Data contracts** (emerging pattern) — some catalogs (DataHub, OpenMetadata) support formalizing a schema + SLA + quality expectations as a "contract" attached to a dataset, enforced in CI.

## 🏔️ dbt Lineage & Docs

```bash
dbt docs generate      # builds manifest.json + catalog.json with model-level lineage & column docs
dbt docs serve          # local lineage graph UI
```

```yaml
# schema.yml — column-level descriptions feed directly into catalog ingestion
models:
  - name: customer_ltv
    description: "One row per customer with lifetime value metrics."
    columns:
      - name: customer_id
        description: "Primary key, matches raw_customers.id"
      - name: lifetime_value
        description: "Sum of all completed order amounts."
```

```yaml
# DataHub/OpenMetadata can both ingest dbt's manifest.json directly for accurate,
# model-level lineage instead of re-deriving it from raw SQL parsing.
source:
  type: dbt
  config:
    manifest_path: "./target/manifest.json"
    catalog_path: "./target/catalog.json"
```

- **dbt's `ref()`/`source()` functions already encode exact lineage** — ingesting `manifest.json` into a catalog is far more reliable than SQL-parsing raw queries, and is the recommended integration path wherever dbt is in use.

## 🧭 Amundsen: Search-First Discovery

```yaml
# databuilder job: ingest metadata from a Postgres source into Amundsen's Neo4j/Atlas backend
# (Amundsen uses a separate ETL library, "databuilder", rather than a single ingestion CLI)
```

```python
from databuilder.extractor.postgres_metadata_extractor import PostgresMetadataExtractor
from databuilder.job.job import DefaultJob
from databuilder.task.task import DefaultTask
from databuilder.loader.file_system_neo4j_csv_loader import FsNeo4jCSVLoader

job_config = ConfigFactory.from_dict({
    'extractor.postgres_metadata.conn_string': 'postgresql://user:pass@host/db',
    'extractor.postgres_metadata.extractor.database': 'analytics',
})
job = DefaultJob(
    conf=job_config,
    task=DefaultTask(extractor=PostgresMetadataExtractor(), loader=FsNeo4jCSVLoader())
)
job.launch()
```

- Amundsen's architecture separates **metadata storage (Neo4j or Apache Atlas)**, a **search layer (Elasticsearch)**, and the **frontend/API** — it was built at Lyft specifically to optimize table/dashboard *search and discovery* (a Google-like search bar for data) rather than governance workflows.
- Compared to DataHub/OpenMetadata, Amundsen's lineage graph and quality-integration features are thinner — it's the right choice when the primary pain point is "our analysts can't find the right table," and a heavier tradeoff when column-level lineage or built-in data quality are must-haves.

## 🔷 Unity Catalog

```sql
-- Unity Catalog's three-level namespace: catalog.schema.table
USE CATALOG main;
USE SCHEMA sales;
SELECT * FROM main.sales.orders;

-- Grant/revoke access declaratively, enforced across all compute (not per-cluster ACLs)
GRANT SELECT ON TABLE main.sales.orders TO `analytics-team`;
GRANT USE CATALOG ON CATALOG main TO `data-scientists`;

-- Column-level masking via a UC function
CREATE FUNCTION main.sales.mask_ssn(ssn STRING) RETURNS STRING
RETURN CASE WHEN is_member('pii-viewers') THEN ssn ELSE '***-**-****' END;

ALTER TABLE main.sales.customers ALTER COLUMN ssn SET MASK main.sales.mask_ssn;
```

```python
# Lineage is automatic and free with Unity Catalog once tables are registered — no separate
# ingestion job required; every read/write through Databricks compute is tracked.
# Query it via the REST API or the Catalog Explorer UI:
import requests
resp = requests.get(
    "https://<workspace>/api/2.1/unity-catalog/lineage-tracking/table-lineage",
    params={"table_name": "main.sales.orders"},
    headers={"Authorization": f"Bearer {token}"}
)
```

- Unity Catalog's core value proposition is that **cataloging, access control, and lineage are unified and automatic** within the Databricks/Delta ecosystem — no separate crawler/ingestion pipeline needed for assets that live there.
- The tradeoff is scope: it catalogs what runs through Databricks compute well, but external systems (a standalone Postgres OLTP database, a BI tool's own semantic layer) still need a general-purpose catalog (DataHub/OpenMetadata) alongside it if you need a single company-wide view.

## 🐘 Apache Atlas & the Hadoop Ecosystem

```json
// Atlas type definition — Atlas is schema-driven: you define entity/relationship "types" first
{
  "entityDefs": [{
    "name": "custom_report",
    "superTypes": ["DataSet"],
    "attributeDefs": [
      { "name": "owner_team", "typeName": "string", "isOptional": true }
    ]
  }]
}
```

```bash
# Atlas ships Hive/HBase/Sqoop/Storm "hooks" that emit lineage automatically as jobs run
# (configured in hive-site.xml, not a separate ingestion step)
hive.exec.post.hooks=org.apache.atlas.hive.hook.HiveHook
```

```bash
curl -u admin:admin -X GET \
  "http://atlas-host:21000/api/atlas/v2/lineage/<guid>?depth=3&direction=BOTH"
```

- Atlas is the **governance layer historically paired with Apache Ranger** in Hadoop-centric platforms (Cloudera, on-prem Hive/HBase clusters) — Ranger enforces policies, Atlas provides the classification/lineage metadata those policies key off of.
- Its **hook-based, push-model lineage** for Hive/Sqoop/Storm jobs predates OpenLineage and is Hadoop-ecosystem-specific — less relevant for cloud-warehouse-first stacks (Snowflake/BigQuery/Databricks), where DataHub/OpenMetadata/Unity Catalog are more common today.

## 📜 Data Contracts

```yaml
# A data contract formalizes schema + SLA + ownership as a reviewable, versioned artifact —
# increasingly supported natively by DataHub and OpenMetadata, or maintained as YAML in a repo.
apiVersion: v1
kind: DataContract
metadata:
  name: orders_contract
  owner: analytics-platform-team
spec:
  dataset: hive.sales.orders
  schema:
    - name: order_id
      type: bigint
      nullable: false
    - name: amount
      type: decimal(10,2)
      nullable: false
    - name: status
      type: string
      constraints: { enum: ["placed", "shipped", "cancelled"] }
  sla:
    freshness: "P1D"          # data must be no more than 1 day stale
    availability: "99.5%"
  qualityChecks:
    - "row_count > 0"
    - "null_fraction(order_id) == 0"
```

```yaml
# Enforced in CI: a schema-changing PR against a contracted table fails the pipeline
# unless the contract is updated in the same change, forcing an explicit, reviewed decision.
```

- Contracts move schema/SLA expectations from **tribal knowledge and after-the-fact breakage** to an **explicit, versioned artifact both producers and consumers can review changes against** — the data equivalent of an API contract (OpenAPI spec) between services.
- Most valuable at **organizational boundaries** — between a source team's operational database and a downstream analytics team's pipeline — where the two sides don't share context by default.

## ✅ Data Quality as Catalog Metadata

```python
# OpenMetadata: attach quality test results directly to a catalogued table
from metadata.generated.schema.tests.testCase import TestCase
# Test suites (row count, null checks, custom SQL) run on a schedule and surface as a
# pass/fail badge directly on the table's catalog page, alongside its schema and lineage.
```

```yaml
# Great Expectations results published to DataHub as "assertions" via its OpenLineage/GE integration
# — dashboard/table consumers can see "last 20 quality checks: 19 passed, 1 failed" without
# leaving the catalog UI.
```

- Surfacing **quality signal alongside discovery metadata** (schema, owner, lineage) is what turns a catalog from documentation into a genuine trust signal — an analyst deciding whether to use a table sees its reliability track record, not just its column names.
- This is the connective tissue between the catalog and a dedicated data-quality/testing tool (Great Expectations, dbt tests, Soda) — the testing tool owns *running* the checks; the catalog owns *displaying* the results where discovery happens.

## ⚠️ Common Gotchas

- **SQL-parsed lineage breaks on dynamic SQL, `SELECT *`, and stored procedures** — always verify column lineage on your most complex/critical pipelines rather than trusting it wholesale.
- **Catalogs go stale without scheduled ingestion** — a one-time manual ingest gives a snapshot, not living metadata; schedule crawlers/ingestion jobs (daily/hourly) or wire up push-based emission.
- **Push-based lineage (OpenLineage) requires instrumentation in every producer** — a job that doesn't emit events is invisible in the lineage graph, creating silent gaps ("orphan" nodes) that are easy to miss.
- **Business glossary and tags rot without ownership** — nobody assigned to maintain descriptions/tags means a catalog with lots of empty or stale metadata, which erodes trust and adoption fast.
- **Two catalogs can disagree** — if both a warehouse-native catalog (e.g., Unity Catalog) and a general-purpose one (DataHub) are deployed, decide which is the source of truth to avoid metadata drift.
- **Column-level lineage at scale is compute-intensive** — full historical query-log parsing across a large warehouse can be slow/expensive; most tools support incremental/sampled parsing instead.

## 🎯 Best Practices

- Prefer **framework-native lineage sources** (dbt manifest, Spark/Airflow OpenLineage listeners) over SQL-text parsing wherever available — much higher fidelity.
- Assign **explicit ownership** to every catalogued dataset as part of onboarding it, not as an afterthought.
- Treat the catalog's **PII/classification tags as the trigger for access policy**, not a separate manual process, so tagging and enforcement can't drift apart.
- Automate **impact analysis in CI** for any team running dbt/SQL-based transformations — catch breaking schema changes before merge, not after a downstream dashboard breaks.
- Pick **one system of record** for lineage/catalog metadata per organization, even if multiple tools ingest from it, to avoid conflicting "truths" about the same asset.

## 💡 Pro Tips

1. **Ingest dbt's `manifest.json`/`catalog.json` before trying SQL-parsed lineage** — it's free, exact, and already available in most dbt shops.
2. **OpenLineage facets are extensible** — attach custom facets (e.g., `dataQualityMetrics`, business KPIs) to standard run events instead of inventing a parallel metadata pipeline.
3. **Use lineage depth limits (`upstreamDepth`/`downstreamDepth`)** when querying large graphs — unbounded traversal on a busy warehouse graph can be slow and overwhelming to render.
4. **A "deprecated" tag with a linked replacement dataset** is one of the highest-leverage governance moves — it turns tribal knowledge about "don't use that old table" into something discoverable.
5. **Marquez is a great lightweight starting point** if you just want lineage without standing up a full catalog — you can layer a catalog on top later since both speak OpenLineage.
6. **Profile + quality metrics attached to catalog entries** (OpenMetadata's built-in profiler, or Great Expectations results surfaced via facets) turn a catalog from "documentation" into a live trust signal.
