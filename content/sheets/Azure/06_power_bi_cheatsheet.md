# Power BI Cheatsheet — *Bonus (Data Analyst focus)*

> Microsoft's BI and data-visualization platform — the primary analyst-facing tool on top of Synapse, Databricks, and (increasingly) Microsoft Fabric.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Type | BI, reporting, and data-visualization platform |
| Components | Power BI Desktop (authoring), Power BI Service (cloud, sharing), Power BI Mobile |
| Best for | Interactive dashboards, self-service analytics, enterprise reporting with governance (RLS, gateways) |
| 2026 note | Power BI is a **native workload inside Microsoft Fabric** — semantic models there can use **Direct Lake** mode against OneLake tables for Import-level speed with near-real-time freshness (no separate refresh needed) — see `07_microsoft_fabric_cheatsheet.md` |

---

## 2. Core Concepts

| Concept | Description |
|---|---|
| **Semantic Model (Dataset)** | The data model: tables, relationships, measures (DAX), underlying a report |
| **Report** | Interactive pages of visuals built on a semantic model |
| **Dashboard** | Single-page pinned collection of visuals/tiles from one or more reports |
| **Workspace** | Container for related reports/models/dataflows; unit of sharing & permissions |
| **Dataflow (Power Query)** | Reusable, cloud-based ETL logic (Power Query/M) producing tables other models can consume |
| **DAX** | Data Analysis Expressions — the formula language for measures/calculated columns |
| **Gateway** | On-prem data gateway for refreshing models that read from on-prem sources |
| **Storage modes** | **Import** (cached in-memory), **DirectQuery** (live query passthrough), **Direct Lake** (Fabric only) |

---

## 3. Connecting to Data Sources

| Source | Typical mode |
|---|---|
| Azure Synapse (Dedicated/Serverless SQL Pool) | Import or DirectQuery |
| Azure Databricks (SQL Warehouse) | Import or DirectQuery (via Databricks connector) |
| ADLS Gen2 / Blob | Import (via Power Query, reads files directly) |
| Microsoft Fabric Lakehouse/Warehouse | Import, DirectQuery, or **Direct Lake** |
| Azure SQL Database | Import or DirectQuery |

```
// Example M query (Power Query) — read from ADLS Gen2 and filter
let
    Source = AzureStorage.DataLake("https://myadlsaccount.dfs.core.windows.net/data/"),
    Filtered = Table.SelectRows(Source, each [Extension] = ".parquet"),
    Content = Table.Combine(Table.AddColumn(Filtered, "Data", each Parquet.Document([Content]))[Data])
in
    Content
```

---

## 4. DAX Cheat Sheet — Common Measures

```dax
-- Basic aggregation
Total Sales = SUM(Sales[Amount])

-- Filtered measure
PH Sales = CALCULATE([Total Sales], Sales[Country] = "PH")

-- Time intelligence
Sales YTD = TOTALYTD([Total Sales], 'Date'[Date])
Sales PY = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Date'[Date]))
Sales YoY % = DIVIDE([Total Sales] - [Sales PY], [Sales PY])

-- Running total
Running Total = CALCULATE([Total Sales], FILTER(ALLSELECTED('Date'[Date]), 'Date'[Date] <= MAX('Date'[Date])))

-- Ranking
Sales Rank = RANKX(ALL(Sales[ProductName]), [Total Sales])

-- Percent of total
% of Total Sales = DIVIDE([Total Sales], CALCULATE([Total Sales], ALL(Sales)))

-- Distinct count
Unique Customers = DISTINCTCOUNT(Sales[CustomerId])

-- Conditional (IF / SWITCH)
Customer Tier =
SWITCH(
    TRUE(),
    [Total Sales] > 10000, "Gold",
    [Total Sales] > 1000, "Silver",
    "Bronze"
)

-- Calculated column vs measure: prefer measures for anything aggregated
-- (calculated columns are computed at refresh time and stored, bloating the model)
```

---

## 5. Row-Level Security (RLS)

```dax
-- RLS role filter expression (applied on the Sales table)
[Country] = USERPRINCIPALNAME()   -- or lookup via a mapping table

-- More flexible: mapping table approach
'UserCountryMapping'[Email] = USERPRINCIPALNAME()
```
Assign users to roles in Power BI Service → **Security** settings per workspace/model.

---

## 6. Power BI REST API — Automating with Python

Power BI has a full REST API (unlike Looker Studio) — ideal for CI/CD, scheduled refreshes, and embedding.

```bash
pip install msal requests
```

### Authenticate (service principal) & call the API
```python
import msal
import requests

app = msal.ConfidentialClientApplication(
    client_id="YOUR_CLIENT_ID",
    client_credential="YOUR_CLIENT_SECRET",
    authority="https://login.microsoftonline.com/YOUR_TENANT_ID",
)
token_response = app.acquire_token_for_client(scopes=["https://analysis.windows.net/powerbi/api/.default"])
access_token = token_response["access_token"]

headers = {"Authorization": f"Bearer {access_token}"}
```

### Trigger a dataset refresh
```python
workspace_id = "WORKSPACE_ID"
dataset_id = "DATASET_ID"

resp = requests.post(
    f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/datasets/{dataset_id}/refreshes",
    headers=headers,
)
print(resp.status_code)   # 202 Accepted
```

### Check refresh history/status
```python
resp = requests.get(
    f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/datasets/{dataset_id}/refreshes",
    headers=headers,
)
for refresh in resp.json()["value"]:
    print(refresh["status"], refresh["startTime"], refresh["endTime"])
```

### List reports/datasets in a workspace
```python
resp = requests.get(f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/reports", headers=headers)
for report in resp.json()["value"]:
    print(report["name"], report["id"], report["webUrl"])
```

### Push data into a Streaming/PUSH dataset (real-time tile updates)
```python
push_url = f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/datasets/{dataset_id}/tables/RealTimeSales/rows"

rows = {"rows": [{"OrderId": "o1", "Amount": 49.99, "Timestamp": "2026-09-12T10:00:00Z"}]}
resp = requests.post(push_url, headers=headers, json=rows)
```

### Export a report to PDF (for scheduled distribution)
```python
export_resp = requests.post(
    f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/reports/{report_id}/ExportTo",
    headers=headers,
    json={"format": "PDF"},
)
export_id = export_resp.json()["id"]

# Poll for completion, then download
import time
while True:
    status = requests.get(
        f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/reports/{report_id}/exports/{export_id}",
        headers=headers,
    ).json()
    if status["status"] == "Succeeded":
        file_resp = requests.get(
            f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/reports/{report_id}/exports/{export_id}/file",
            headers=headers,
        )
        with open("report.pdf", "wb") as f:
            f.write(file_resp.content)
        break
    time.sleep(5)
```

### Manage workspace access (add a user)
```python
requests.post(
    f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/users",
    headers=headers,
    json={"emailAddress": "analyst@company.com", "groupUserAccessRight": "Member"},
)
```

---

## 7. Chart Types Quick Reference

| Chart | Best for |
|---|---|
| Card / KPI | Single headline metric |
| Line chart | Trends over time |
| Clustered/Stacked bar | Category comparisons |
| Table / Matrix | Detailed breakdowns, pivot-style views |
| Map / Filled map | Geographic data |
| Combo chart | Two metrics at different scales |
| Decomposition tree | Ad-hoc drill-down / root-cause exploration |

---

## 8. Performance Tips

- Prefer **Import mode** for most reports — DirectQuery adds live query latency per interaction.
- Use **Direct Lake** (Fabric) when data is large and refresh-freshness matters more than raw import speed.
- Build **star schemas** (fact + dimension tables) — avoid single flat wide tables; DAX and compression both benefit.
- Move heavy transformation logic upstream (Dataflow Gen2, Synapse view, Databricks table) instead of in Power Query inside the report.
- Avoid excessive **calculated columns** — prefer measures, computed at query time, not stored per-row.
- Limit visuals per page; each interaction can trigger multiple backend queries.

---

## 9. Sharing & Governance

| Mechanism | Purpose |
|---|---|
| **Workspaces** | Group related content, control who can edit vs view |
| **Apps** | Packaged, polished distribution of a workspace's reports to a broad audience |
| **Row-Level Security (RLS)** | Restrict rows visible to each user/role |
| **Sensitivity labels** | Classify and protect reports containing sensitive data (integrates with Microsoft Purview) |
| **Deployment pipelines** | Dev → Test → Prod promotion of reports/datasets |

---

## 10. Pricing

| License | Notes |
|---|---|
| **Free** | Personal use, can't share via workspaces |
| **Pro** | Per-user/month; required to share/collaborate in workspaces |
| **Premium Per User (PPU)** | Pro + larger model size limits, paginated reports, AI features |
| **Premium / Fabric Capacity (F-SKU)** | Organization-wide capacity, no per-user Pro license needed for viewers, includes Fabric workloads |

---

## 11. Common Gotchas

- DirectQuery reports feel slow if the underlying warehouse (Synapse/Databricks) isn't tuned — every filter change re-queries live.
- RLS roles must be tested via **"View As Role"** — it's easy to accidentally leave a hole (e.g., a table without a filter relationship to the RLS table).
- Wide flat tables (instead of star schema) bloat model size and slow down DAX — model properly from the start.
- The on-prem **Data Gateway** is a single point of failure for scheduled refreshes of on-prem-sourced models — configure a cluster for HA in production.
- Calculated columns computed from other tables can break **Direct Lake** fallback to DirectQuery — check compatibility when migrating to Fabric.
- Refreshing large Import models too frequently can hit **capacity/API refresh limits** — consider incremental refresh policies.

---

## 12. Useful Links

- Docs: https://learn.microsoft.com/en-us/power-bi/
- DAX reference: https://learn.microsoft.com/en-us/dax/
- REST API reference: https://learn.microsoft.com/en-us/rest/api/power-bi/
- Pricing: https://powerbi.microsoft.com/en-us/pricing/
