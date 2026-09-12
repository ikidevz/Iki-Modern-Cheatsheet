# Azure Data Engineering & Analytics — Service Selection Guide

> A quick index for choosing the right tool. Read this first, then dive into the individual cheatsheets.

---

## 1. The Toolkit at a Glance

| File | Service | Role |
|---|---|---|
| `01_azure_data_factory_cheatsheet.md` | **Azure Data Factory** | Orchestration & data-movement pipelines |
| `02_azure_synapse_analytics_cheatsheet.md` | **Azure Synapse Analytics** | Data warehouse (SQL pools) + Spark, unified workspace |
| `03_azure_databricks_cheatsheet.md` | **Azure Databricks** | Managed Spark + Delta Lake, ML, collaborative notebooks |
| `04_azure_data_lake_storage_gen2_cheatsheet.md` | **ADLS Gen2** | Data lake / staging object storage |
| `05_azure_event_hubs_cheatsheet.md` | **Event Hubs** | Real-time event ingestion / streaming |
| `06_power_bi_cheatsheet.md` | **Power BI** | BI dashboards & reporting (Data Analyst tool) |
| `07_microsoft_fabric_cheatsheet.md` | **Microsoft Fabric** | Unified SaaS platform — the 2026 strategic direction |

---

## 2. Decision Guide by Use Case

| I need to... | Use |
|---|---|
| Orchestrate/move data between systems on a schedule | **Azure Data Factory** (or Fabric Data Factory) |
| Run ad-hoc SQL / build an enterprise warehouse | **Azure Synapse Analytics** (Dedicated/Serverless SQL Pool) |
| Do large-scale Spark ETL, ML, or streaming with Delta Lake | **Azure Databricks** |
| Ingest real-time events from apps/devices | **Azure Event Hubs** |
| Process a real-time stream into aggregates, no-code | **Fabric Eventstream** or Stream Analytics |
| Store raw files / act as a data lake | **ADLS Gen2** |
| Build a dashboard for stakeholders | **Power BI** |
| Start a brand-new analytics platform in 2026 | **Microsoft Fabric** — Microsoft's stated direction for new workloads |
| Keep an existing, tuned Synapse investment (GPU Spark, fixed scaling) | **Stay on Azure Synapse** — no forced migration, fully supported |

---

## 3. A Typical End-to-End Architecture (Classic Azure PaaS)

```
 Event sources (apps, IoT, CDC)
        │
        ▼
   ┌────────────┐
   │ Event Hubs  │  ← real-time ingestion
   └─────┬──────┘
         ▼
   ┌────────────┐        ┌──────────────────┐
   │ Databricks  │───────▶│  ADLS Gen2        │  (bronze/raw landing zone)
   │(Structured  │        └──────────────────┘
   │ Streaming)  │
   └─────┬──────┘
         ▼
   ┌────────────────┐
   │ Azure Synapse    │  ← curated warehouse (silver/gold)
   │ (Dedicated Pool) │
   └────────┬────────┘
            ▼
   ┌────────────────┐        ┌─────────────────┐
   │ Synapse/Gold     │───────▶│ Power BI          │  ← dashboards
   │ Tables           │        └─────────────────┘
   └────────────────┘

 Azure Data Factory orchestrates/schedules the batch pieces above
 (Copy activities, Databricks Notebook activities, pipeline triggers) end-to-end.
```

## 4. The Fabric-Unified Alternative (2026 Strategic Direction)

```
 Event sources (apps, IoT, CDC)
        │
        ▼
 ┌─────────────────────────────────────────────────────┐
 │                Microsoft Fabric (single capacity)      │
 │                                                         │
 │   Eventstream → Lakehouse (OneLake, Delta) → Warehouse │
 │        │              │                        │       │
 │   Data Factory    Spark Notebooks         T-SQL/CTAS   │
 │   (pipelines)     (PySpark, Autoloader-   (curated     │
 │                    style ingestion)        marts)      │
 │                          │                              │
 │                          ▼                              │
 │                    Power BI (Direct Lake)                │
 └─────────────────────────────────────────────────────┘
```
Notice everything reads/writes the **same OneLake copy** — no separate ETL step just to get data into Power BI.

---

## 5. Data Engineer vs Data Analyst — Typical Tool Split

| Role | Primary tools | Secondary/occasional |
|---|---|---|
| **Data Engineer** | ADF/Fabric Data Factory, Databricks, Event Hubs, ADLS Gen2 | Synapse Spark/SQL pools, Fabric notebooks |
| **Analytics Engineer** | Synapse SQL / Fabric Warehouse, Databricks SQL, Dataflow Gen2 | ADF pipelines (light orchestration) |
| **Data Analyst** | Power BI, Synapse Serverless SQL, Fabric Warehouse/Lakehouse SQL endpoint | Dataflow Gen2 (light self-service ETL) |

---

## 6. Batch vs Streaming — Which Ingestion/Processing Combo?

| Requirement | Combo |
|---|---|
| Real-time (seconds) dashboards/alerts | Event Hubs → Fabric Eventstream/Stream Analytics → Power BI (streaming dataset) |
| Real-time into the lake for later batch use | Event Hubs → Databricks (Structured Streaming/Autoloader) → Delta Lake |
| Daily/hourly batch loads from files | ADLS Gen2 → ADF Copy Activity → Synapse/Fabric Warehouse |
| Complex big-data batch processing (Spark-heavy) | ADLS Gen2 → Databricks (PySpark/Delta) → Synapse/Fabric |
| Orchestrating any of the above on a schedule with dependencies | Azure Data Factory / Fabric Data Factory pipelines |

---

## 7. Cost-Saving Cheat Notes (cross-service)

- **Azure Data Factory**: stop Azure-SSIS IR and Data Flow debug sessions when not in use — both bill hourly while idle.
- **Synapse**: pause Dedicated SQL Pools outside business hours; use Serverless SQL for infrequent ad-hoc lake queries instead of a provisioned pool.
- **Databricks**: use ephemeral **Job clusters** instead of leaving All-Purpose clusters running; set aggressive auto-termination.
- **Event Hubs**: right-size Throughput Units and enable auto-inflate instead of over-provisioning a fixed high TU count.
- **ADLS Gen2**: apply lifecycle policies to move cold data to Cool/Cold/Archive tiers.
- **Power BI**: prefer Import/Direct Lake over DirectQuery where possible to cut repeated live-query costs on the warehouse.
- **Fabric**: watch capacity (F-SKU) utilization — a single heavy job can throttle every workload sharing that capacity; scale the SKU or isolate heavy workloads in their own capacity.

---

## 8. Reference Implementation — Tying It All Together in Python

A minimal, realistic sketch of how the classic PaaS pieces chain together. Each snippet is expanded with far more detail in its own cheatsheet.

```python
# 1) Publish an event (producer side, e.g. inside your application backend)
from azure.eventhub import EventHubProducerClient, EventData

producer = EventHubProducerClient.from_connection_string(
    conn_str="EVENT_HUB_CONNECTION_STRING", eventhub_name="orders"
)
with producer:
    batch = producer.create_batch()
    batch.add(EventData('{"order_id": "o1", "amount": 49.99, "country": "PH"}'))
    producer.send_batch(batch)
```

```python
# 2) Databricks Structured Streaming consumes Event Hubs (via Kafka protocol)
#    and lands raw data into a Delta bronze table (see 03_azure_databricks_cheatsheet.md)
raw = spark.readStream.format("kafka").options(**kafka_options).load()
parsed = raw.selectExpr("CAST(value AS STRING) as json_str")
query = (parsed.writeStream.format("delta")
         .option("checkpointLocation", "/mnt/checkpoints/orders")
         .table("main.raw.orders"))
```

```sql
-- 3) Synapse (or Fabric Warehouse) transforms raw -> curated via CTAS
CREATE TABLE dbo.DailySales
WITH (DISTRIBUTION = HASH(country), CLUSTERED COLUMNSTORE INDEX)
AS
SELECT CAST(order_ts AS DATE) AS order_date, country, SUM(amount) AS total_sales
FROM dbo.RawOrders
GROUP BY CAST(order_ts AS DATE), country;
```

```python
# 4) Azure Data Factory orchestrates the whole thing on a schedule
from azure.identity import DefaultAzureCredential
from azure.mgmt.datafactory import DataFactoryManagementClient

credential = DefaultAzureCredential()
adf_client = DataFactoryManagementClient(credential, subscription_id="MY_SUB_ID")
adf_client.pipelines.create_run("my-rg", "my-adf", "RefreshDailySales")
```

```python
# 5) Power BI refreshes its semantic model to pick up the new data
import requests
requests.post(
    f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/datasets/{dataset_id}/refreshes",
    headers=headers,
)
# Or, on Fabric: skip this step entirely — Direct Lake reads OneLake directly, no refresh needed.
```

---

## 9. Where to Go Deeper

Each linked cheatsheet includes: core concepts, CLI commands, extensive Python code examples, SQL/PySpark/DAX where relevant, pricing model, performance tips, monitoring pointers, and common gotchas — read the relevant one before implementing.
