# Microsoft Fabric Cheatsheet — *Bonus (2026 strategic direction)*

> Unified SaaS analytics platform that brings Data Factory, Synapse (Spark/Warehouse), Power BI, and real-time streaming under one workspace, backed by a single open storage layer called **OneLake**.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Type | SaaS, unified analytics platform (not just PaaS building blocks like Synapse) |
| Underlying storage | **OneLake** — a single, tenant-wide Delta/Parquet lake ("OneDrive for data") |
| Componentry | Data Factory (pipelines/Dataflow Gen2), Synapse Data Engineering (Spark/Lakehouse), Synapse Data Warehouse, Power BI, Real-Time Intelligence (Eventstream/KQL), Data Science, Data Activator |
| Billing | Capacity-based (F-SKUs), not per-service |
| 2026 status | Microsoft's own leadership has described Fabric as **"the next version of Azure Synapse."** Synapse remains supported with no end-of-life date, but net-new investment (Direct Lake, OneLake mirroring, Copilot, current Spark versions) is concentrated on Fabric. New projects are generally advised to start on Fabric; existing tuned Synapse workloads (esp. GPU Spark pools, fixed 200-node scaling) can stay put for now. |

---

## 2. Core Concepts

| Concept | Description |
|---|---|
| **Capacity (F-SKU)** | Purchased compute capacity (F2 through F2048) that all workloads in assigned workspaces consume from — like a shared resource pool instead of per-service billing |
| **Workspace** | Container for Fabric items (lakehouses, warehouses, notebooks, reports), assigned to a capacity |
| **OneLake** | One logical data lake per tenant; every Fabric item's data lands here as Delta/Parquet automatically |
| **Lakehouse** | Combines a file store (Files) + managed Delta tables (Tables), queryable via Spark **and** a built-in **SQL analytics endpoint** |
| **Warehouse** | A full T-SQL data warehouse experience, but Delta-native and OneLake-backed (successor to Dedicated SQL Pool) |
| **Dataflow Gen2** | Power Query-based, low-code ETL — writes results straight into a Lakehouse |
| **Data Factory (in Fabric)** | Pipelines — architecturally similar to Azure Data Factory / Synapse Pipelines |
| **Copy Job** | A simpler alternative to a full pipeline for one-off/scheduled bulk copy tasks — less setup than a Copy Activity in a pipeline |
| **Eventstream** | No-code real-time event routing/processing (successor role to Stream Analytics + Event Hubs config) |
| **Real-Time Intelligence / KQL Database** | Real-time analytics store & query engine (Kusto Query Language) for streaming/telemetry data |
| **Data Activator** | No-code service to trigger alerts/actions when data meets a condition (e.g., "notify me if sales drop 20%") |
| **Direct Lake** | Power BI storage mode reading Delta tables in OneLake directly into memory — Import-level speed without a separate refresh/ETL step |
| **Shortcuts** | Zero-copy references to data in ADLS Gen2, S3, or other Fabric items — avoids duplicating data into OneLake |
| **Semantic Link (`sempy`)** | Python library for Fabric notebooks bridging Spark DataFrames and Power BI semantic models |

---

## 3. Architecture at a Glance

```
                     ┌─────────────────────────────────────────┐
                     │              OneLake (one per tenant)     │
                     │      Delta/Parquet tables, one copy       │
                     └───────────────┬───────────────────────────┘
             ┌───────────────────────┼────────────────────────┬─────────────────┐
             ▼                       ▼                        ▼                 ▼
     ┌───────────────┐      ┌───────────────┐        ┌───────────────┐  ┌───────────────┐
     │  Data Factory  │      │ Data Engineering│       │  Data Warehouse│  │ Real-Time Intel│
     │  (pipelines,   │      │ (Lakehouse,    │        │  (T-SQL,       │  │ (Eventstream,  │
     │  Dataflow Gen2)│      │  Spark notebooks)│      │  SQL endpoint) │  │  KQL Database) │
     └───────────────┘      └───────────────┘        └───────────────┘  └───────────────┘
                                       │
                                       ▼
                             ┌───────────────────┐
                             │   Power BI          │  ← Direct Lake mode reads OneLake directly
                             │  (native workload)  │
                             └───────────────────┘
```

---

## 4. Fabric vs Synapse — Quick Comparison

| | Azure Synapse | Microsoft Fabric |
|---|---|---|
| Model | PaaS — you provision/manage SQL pools, Spark pools | SaaS — capacity-based, workspaces just consume it |
| Storage | Per-pool storage, separate from lake | **OneLake** — single copy, shared across all workloads |
| Power BI integration | Import/DirectQuery only | **Direct Lake** — near-import speed, no separate refresh |
| Spark versions | Frozen at older versions for new deployments | Current: Spark 3.4/3.5/4.0 |
| GPU Spark / fixed 200-node scaling | ✅ Supported | ❌ Not yet matched |
| Billing | Per-pool (DWU-hours, vCore-hours) | Single capacity (F-SKU) shared by all workloads |
| Governance/AI | Azure ML integration | Native Copilot, Fabric Data Agents, AI Foundry integration |

**Migration path (lowest → highest effort):** Pipelines (architecturally similar, easiest) → Spark notebooks (minor Lakehouse-reference changes) → Dedicated SQL Pool → Fabric Warehouse (most planning required).

---

## 5. Creating & Working with a Lakehouse (Notebook / PySpark)

```python
# Inside a Fabric notebook, `spark` is already initialized

# Read Files section of a Lakehouse
df = spark.read.format("csv").option("header", "true").load("Files/raw/events.csv")

# Write as a managed Delta table (Tables section) — instantly queryable via SQL endpoint too
df.write.format("delta").mode("overwrite").saveAsTable("events")

# Query it back with Spark SQL
spark.sql("SELECT country, COUNT(*) n FROM events GROUP BY country").show()
```

### Cross-item queries (Lakehouse + Warehouse together)
```python
# Read a table that lives in a Fabric Warehouse from a Spark notebook
df = spark.read.synapsesql("MyWarehouse.dbo.FactSales")
```

### Using Shortcuts (zero-copy reference to existing ADLS Gen2 data)
```python
# Once a Shortcut is created in the UI pointing at abfss://container@account.dfs.core.windows.net/path,
# it appears as a normal folder under Files/ — no data movement, no duplication
df = spark.read.parquet("Files/shortcut_to_existing_lake/events/")
```

### `notebookutils` (Fabric's equivalent of Databricks' `dbutils` / Synapse's `mssparkutils`)
```python
from notebookutils import mssparkutils

# File system operations
mssparkutils.fs.ls("Files/raw/")

# Chain notebooks together
result = mssparkutils.notebook.run("ChildNotebook", timeout_seconds=300, arguments={"date": "2026-09-12"})

# Read a secret from a linked Key Vault
api_key = mssparkutils.credentials.getSecret("my-keyvault", "api-key")

# Exit a notebook with a value (readable by a parent pipeline's activity output)
mssparkutils.notebook.exit("Success: 204 rows processed")
```

---

## 6. T-SQL in a Fabric Warehouse

```sql
-- Fabric Warehouse is Delta-native — CTAS works the same conceptually as Synapse
CREATE TABLE dbo.DailySales AS
SELECT CAST(order_ts AS DATE) AS order_date, country, SUM(amount) AS total_sales
FROM dbo.FactOrders
GROUP BY CAST(order_ts AS DATE), country;

-- Query the SQL analytics endpoint of a Lakehouse directly (read-only, auto-generated)
SELECT country, COUNT(*) FROM MyLakehouse.dbo.events GROUP BY country;
```

---

## 7. Semantic Link (`sempy`) — Bridging Spark & Power BI from Python

```python
# Available by default in Fabric notebooks
import sempy.fabric as fabric

# List workspaces, items, semantic models
workspaces = fabric.list_workspaces()
datasets = fabric.list_datasets(workspace="Finance")

# Read a Power BI semantic model's table straight into a pandas DataFrame
df = fabric.read_table("Sales Model", "FactSales")

# Evaluate a DAX measure programmatically
result = fabric.evaluate_measure("Sales Model", ["Total Sales", "Sales YoY %"], groupby_columns=["Country"])
print(result)

# List all measures in a model (useful for documentation/auditing)
measures = fabric.list_measures("Sales Model")

# List reports in a workspace
reports = fabric.list_reports(workspace="Finance")
```

### `semantic-link-labs` — extended automation (community/Microsoft-maintained)
```python
%pip install semantic-link-labs
import sempy_labs as labs

# Run the Best Practice Analyzer against a semantic model
labs.run_model_bpa(dataset="Sales Model", workspace="Finance")

# Migrate an Import/DirectQuery model to Direct Lake
labs.migrate_calc_tables_to_lakehouse(dataset="Sales Model", workspace="Finance")

# Migrate a capacity from Premium (P SKU) to Fabric (F SKU)
labs.migrate_capacities(source_capacity="MyPremiumCapacity", target_capacity="MyFabricCapacity")
```

---

## 8. Fabric REST API — Automating from Outside Notebooks

```bash
pip install msal requests
```

```python
import msal, requests

app = msal.ConfidentialClientApplication(
    client_id="YOUR_CLIENT_ID", client_credential="YOUR_CLIENT_SECRET",
    authority="https://login.microsoftonline.com/YOUR_TENANT_ID",
)
token = app.acquire_token_for_client(scopes=["https://api.fabric.microsoft.com/.default"])["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# List workspaces
resp = requests.get("https://api.fabric.microsoft.com/v1/workspaces", headers=headers)
for ws in resp.json()["value"]:
    print(ws["displayName"], ws["id"])

# Create a Lakehouse item in a workspace
requests.post(
    f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items",
    headers=headers,
    json={"displayName": "SalesLakehouse", "type": "Lakehouse"},
)

# Trigger a pipeline / notebook run via a Job Scheduler API call
requests.post(
    f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items/{item_id}/jobs/instances",
    headers=headers,
    params={"jobType": "RunNotebook"},
)

# Poll a job instance for status
job_status = requests.get(
    f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items/{item_id}/jobs/instances/{job_instance_id}",
    headers=headers,
).json()
print(job_status["status"])

# Scale a capacity programmatically (e.g., scale up before a heavy nightly batch)
requests.patch(
    f"https://management.azure.com/subscriptions/MY_SUB_ID/resourceGroups/my-rg/"
    f"providers/Microsoft.Fabric/capacities/my-capacity?api-version=2023-11-01",
    headers=headers, json={"sku": {"name": "F64"}},
)
```

---

## 9. Eventstream & Real-Time Intelligence (Streaming Layer)

- **Eventstream**: no-code canvas to route events from Event Hubs/Kafka/IoT sources into a Lakehouse, KQL Database, or Power BI in real time — replaces hand-wiring Event Hubs + Stream Analytics for many common cases.
- **KQL Database**: a Kusto-based real-time analytics store, ideal for high-volume telemetry/log data with sub-second query latency.
- **Data Activator**: watches a Power BI report, Eventstream, or KQL query result and fires an alert/action (email, Teams, Power Automate flow) when a threshold is crossed — no code required.

```kql
// Sample KQL query against a Real-Time Intelligence KQL Database
Events
| where Timestamp > ago(1h)
| summarize EventCount = count() by EventType, bin(Timestamp, 5m)
| order by Timestamp desc
```

```python
# Querying a KQL Database from Python (outside a Fabric notebook)
from azure.kusto.data import KustoClient, KustoConnectionStringBuilder

kcsb = KustoConnectionStringBuilder.with_aad_device_authentication("https://<cluster>.kusto.fabric.microsoft.com")
client = KustoClient(kcsb)
response = client.execute("MyKqlDatabase", "Events | take 10")
for row in response.primary_results[0]:
    print(row)
```

---

## 10. Pipelines — Lakehouse-Specific Activities

Fabric Data Factory pipelines add activities tailored to the Lakehouse pattern:

| Activity | Purpose |
|---|---|
| **Lakehouse Maintenance** | Automates Delta table upkeep — runs `OPTIMIZE`/`VACUUM` on a schedule |
| **Refresh SQL analytics endpoint** | Forces the auto-generated SQL endpoint to resync after a Spark write |
| **Dataflow Gen2 (as an activity)** | Chains a Power Query transformation into a broader pipeline |
| **Copy Job** | Standalone, simpler bulk/incremental copy task outside a full pipeline |

---

## 11. Git Integration & CI/CD

Fabric workspaces can sync bidirectionally with a Git repo (Azure DevOps or GitHub), similar to Synapse's Git integration:

- Each Fabric item (notebook, pipeline, semantic model definition) serializes to source-controllable files.
- Supports branching workflows: feature branch workspace → PR → merge → deploy via **Deployment Pipelines** (Dev → Test → Prod), the same mechanism used by Power BI.

```python
# Trigger a deployment pipeline stage promotion via REST API
requests.post(
    "https://api.fabric.microsoft.com/v1/deploymentPipelines/{pipeline_id}/deploy",
    headers=headers,
    json={"sourceStageId": "dev-stage-id", "targetStageId": "test-stage-id"},
)
```

---

## 12. Pricing

| Component | Billed by |
|---|---|
| **Fabric Capacity (F-SKU)** | F2 to F2048 — all workload usage (Spark, Warehouse, Power BI, pipelines) metered against this single purchased capacity |
| **OneLake storage** | Standard pay-as-you-go storage pricing, separate from compute capacity |
| **Power BI Pro licenses** | Still needed per-user for creating/editing content in most cases (capacity covers compute, not necessarily every license) |

💡 For mixed workloads (data engineering + Power BI + pipelines all in one org), capacity-based billing is often more predictable than summing several separate Azure service bills.

---

## 13. Common Gotchas

- A Fabric capacity is a **shared resource pool** — a runaway Spark job or huge Power BI refresh can throttle every other workload on that same capacity.
- **OneLake mirroring** and Shortcuts avoid data duplication, but stale shortcuts (source deleted/moved) fail silently until queried.
- Migrating Dedicated SQL Pool → Fabric Warehouse is the **highest-effort** migration step — plan and test thoroughly, unlike the relatively low-risk pipeline/notebook migrations.
- Direct Lake mode can silently **fall back to DirectQuery** if a semantic model uses unsupported features (certain calculated columns/tables) — check compatibility after migrating.
- Capacity throttling ("interactive delay"/"rejection" states) can be confusing the first time it's hit — monitor the Capacity Metrics app proactively rather than reactively.
- Fabric is evolving quickly (new features ship frequently) — always check Microsoft Learn for the current state of a specific capability before committing to an architecture.

---

## 14. Useful Links

- Docs: https://learn.microsoft.com/en-us/fabric/
- OneLake overview: https://learn.microsoft.com/en-us/fabric/onelake/onelake-overview
- Direct Lake overview: https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview
- Semantic Link (`sempy`): https://learn.microsoft.com/en-us/fabric/data-science/semantic-link-overview
- Pricing: https://azure.microsoft.com/en-us/pricing/details/microsoft-fabric/
