# Microsoft Fabric Cheatsheet — *Bonus (2026 strategic direction)*

> Unified SaaS analytics platform that brings Data Factory, Synapse (Spark/Warehouse), Power BI, and real-time streaming under one workspace, backed by a single open storage layer called **OneLake**.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Type | SaaS, unified analytics platform (not just PaaS building blocks like Synapse) |
| Underlying storage | **OneLake** — a single, tenant-wide Delta/Parquet lake ("OneDrive for data") |
| Componentry | Data Factory (pipelines/Dataflow Gen2), Synapse Data Engineering (Spark/Lakehouse), Synapse Data Warehouse, Power BI, Real-Time Intelligence (Eventstream/KQL), Data Science |
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
| **Eventstream** | No-code real-time event routing/processing (successor role to Stream Analytics + Event Hubs config) |
| **Real-Time Intelligence / KQL Database** | Real-time analytics store & query engine (Kusto Query Language) for streaming/telemetry data |
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
```

### `semantic-link-labs` — extended automation (community/Microsoft-maintained)
```python
%pip install semantic-link-labs
import sempy_labs as labs

# Run the Best Practice Analyzer against a semantic model
labs.run_model_bpa(dataset="Sales Model", workspace="Finance")

# Migrate an Import/DirectQuery model to Direct Lake
labs.migrate_calc_tables_to_lakehouse(dataset="Sales Model", workspace="Finance")
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
```

---

## 9. Eventstream & Real-Time Intelligence (Streaming Layer)

- **Eventstream**: no-code canvas to route events from Event Hubs/Kafka/IoT sources into a Lakehouse, KQL Database, or Power BI in real time — replaces hand-wiring Event Hubs + Stream Analytics for many common cases.
- **KQL Database**: a Kusto-based real-time analytics store, ideal for high-volume telemetry/log data with sub-second query latency.

```kql
// Sample KQL query against a Real-Time Intelligence KQL Database
Events
| where Timestamp > ago(1h)
| summarize EventCount = count() by EventType, bin(Timestamp, 5m)
| order by Timestamp desc
```

---

## 10. Pipelines — Lakehouse-Specific Activities

Fabric Data Factory pipelines add activities tailored to the Lakehouse pattern:

| Activity | Purpose |
|---|---|
| **Lakehouse Maintenance** | Automates Delta table upkeep — runs `OPTIMIZE`/`VACUUM` on a schedule |
| **Refresh SQL analytics endpoint** | Forces the auto-generated SQL endpoint to resync after a Spark write |
| **Dataflow Gen2 (as an activity)** | Chains a Power Query transformation into a broader pipeline |

---

## 11. Pricing

| Component | Billed by |
|---|---|
| **Fabric Capacity (F-SKU)** | F2 to F2048 — all workload usage (Spark, Warehouse, Power BI, pipelines) metered against this single purchased capacity |
| **OneLake storage** | Standard pay-as-you-go storage pricing, separate from compute capacity |
| **Power BI Pro licenses** | Still needed per-user for creating/editing content in most cases (capacity covers compute, not necessarily every license) |

💡 For mixed workloads (data engineering + Power BI + pipelines all in one org), capacity-based billing is often more predictable than summing several separate Azure service bills.

---

## 12. Common Gotchas

- A Fabric capacity is a **shared resource pool** — a runaway Spark job or huge Power BI refresh can throttle every other workload on that same capacity.
- **OneLake mirroring** and Shortcuts avoid data duplication, but stale shortcuts (source deleted/moved) fail silently until queried.
- Migrating Dedicated SQL Pool → Fabric Warehouse is the **highest-effort** migration step — plan and test thoroughly, unlike the relatively low-risk pipeline/notebook migrations.
- Direct Lake mode can silently **fall back to DirectQuery** if a semantic model uses unsupported features (certain calculated columns/tables) — check compatibility after migrating.
- Fabric is evolving quickly (new features ship frequently) — always check Microsoft Learn for the current state of a specific capability before committing to an architecture.

---

## 13. Useful Links

- Docs: https://learn.microsoft.com/en-us/fabric/
- OneLake overview: https://learn.microsoft.com/en-us/fabric/onelake/onelake-overview
- Direct Lake overview: https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview
- Semantic Link (`sempy`): https://learn.microsoft.com/en-us/fabric/data-science/semantic-link-overview
- Pricing: https://azure.microsoft.com/en-us/pricing/details/microsoft-fabric/
