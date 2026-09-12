# Azure Data Factory (ADF) Cheatsheet

> Cloud-based ETL/ELT and data-integration service for orchestrating and automating data movement and transformation at scale.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Type | Managed data integration & orchestration service (low-code + code) |
| Programming model | Visual pipeline designer (Synapse-style) + JSON pipeline definitions |
| Best for | Scheduled batch ETL/ELT, hybrid on-prem/cloud data movement, orchestrating Databricks/Synapse/SQL jobs |
| Not for | Real-time/streaming (very low latency) processing — use Event Hubs + Stream Analytics/Databricks instead |
| 2026 note | Azure Data Factory's engine now also powers **Data Factory in Microsoft Fabric** (pipelines are architecturally similar) — see `07_microsoft_fabric_cheatsheet.md` |

---

## 2. Core Concepts

| Concept | Description |
|---|---|
| **Pipeline** | A logical grouping of activities that together perform a task |
| **Activity** | A single processing step (Copy, Lookup, ForEach, Databricks Notebook, Stored Procedure, etc.) |
| **Dataset** | A named view of data — points to data used as input/output of an activity |
| **Linked Service** | Connection info to an external resource (like a connection string) — SQL DB, ADLS, Databricks, etc. |
| **Integration Runtime (IR)** | Compute infrastructure that runs activities: **Azure IR** (fully managed), **Self-hosted IR** (on-prem/VNet access), **Azure-SSIS IR** (lift-and-shift SSIS) |
| **Trigger** | Defines when a pipeline run is kicked off: **Schedule**, **Tumbling window**, **Event-based** (blob created/deleted), **Manual** |
| **Mapping Data Flow** | Visual, code-free data transformation executed on managed Spark clusters |
| **Parameters & Variables** | Pipeline-level inputs and runtime state |
| **Data Flow Debug** | Interactive cluster session for building/testing Data Flows |

---

## 3. Pricing Model

| Component | Billed by |
|---|---|
| Pipeline orchestration | Per activity run |
| Data movement (Copy Activity) | Per DIU-hour (Data Integration Unit) |
| Data Flow execution | Per vCore-hour of the underlying Spark cluster |
| Pipeline activity (external, e.g. Databricks Notebook) | Orchestration fee only — the external compute (Databricks) bills separately |
| Azure-SSIS IR | Per hour the IR is running (start/stop it explicitly to save cost) |

💡 **Cost tip:** Pause/stop Azure-SSIS IR and Data Flow debug sessions when not in use — they bill by the hour even when idle.

---

## 4. Azure CLI Reference

```bash
# Login / set subscription
az login
az account set --subscription "My Subscription"

# Create a Data Factory
az datafactory create --resource-group my-rg --factory-name my-adf --location eastus

# List / show
az datafactory list --resource-group my-rg
az datafactory show --resource-group my-rg --factory-name my-adf

# Linked services / datasets / pipelines (from JSON definition files)
az datafactory linked-service create --resource-group my-rg --factory-name my-adf \
  --linked-service-name AzureBlobLS --properties @linkedService.json

az datafactory dataset create --resource-group my-rg --factory-name my-adf \
  --dataset-name InputDataset --properties @dataset.json

az datafactory pipeline create --resource-group my-rg --factory-name my-adf \
  --pipeline-name CopyPipeline --pipeline @pipeline.json

# Run a pipeline
az datafactory pipeline create-run --resource-group my-rg --factory-name my-adf \
  --pipeline-name CopyPipeline --parameters sourcePath=raw/2026-09-01

# Monitor a pipeline run
az datafactory pipeline-run show --resource-group my-rg --factory-name my-adf --run-id RUN_ID

# Triggers
az datafactory trigger create --resource-group my-rg --factory-name my-adf \
  --trigger-name DailyTrigger --properties @trigger.json
az datafactory trigger start --resource-group my-rg --factory-name my-adf --trigger-name DailyTrigger
```

---

## 5. Pipeline JSON — Copy Activity Example

```json
{
  "name": "CopyBlobToSql",
  "properties": {
    "activities": [
      {
        "name": "CopyFromBlobToSql",
        "type": "Copy",
        "inputs": [{ "referenceName": "BlobDataset", "type": "DatasetReference" }],
        "outputs": [{ "referenceName": "SqlDataset", "type": "DatasetReference" }],
        "typeProperties": {
          "source": { "type": "DelimitedTextSource" },
          "sink": { "type": "AzureSqlSink", "writeBehavior": "upsert" },
          "enableStaging": false
        }
      }
    ],
    "parameters": {
      "sourcePath": { "type": "string" }
    }
  }
}
```

---

## 6. Common Activities Cheat-Table

| Activity | Purpose |
|---|---|
| `Copy` | Move data between 100+ supported connectors (Blob, ADLS, SQL, SFTP, Salesforce...) |
| `Lookup` | Run a query and return a single row/value or a result set for use downstream |
| `ForEach` | Iterate over an array (e.g., a list of files or table names) |
| `If Condition` | Branch pipeline logic |
| `Until` | Loop until a condition is met |
| `Execute Pipeline` | Call another pipeline (modular design) |
| `Web` | Call a REST API |
| `Stored Procedure` | Run a SQL stored procedure |
| `Databricks Notebook` | Trigger a Databricks notebook as a pipeline step |
| `Synapse Notebook` | Trigger a Synapse Spark notebook |
| `Data Flow` | Run a Mapping Data Flow transformation |
| `Get Metadata` | Retrieve metadata (file existence, size, last modified) about a dataset |
| `Wait` | Pause pipeline execution for a set time |
| `Set Variable` / `Append Variable` | Manage pipeline variables |

### Example: ForEach + Copy (process a list of files)
```json
{
  "name": "ForEachFile",
  "type": "ForEach",
  "typeProperties": {
    "items": { "value": "@pipeline().parameters.fileList", "type": "Expression" },
    "activities": [
      {
        "name": "CopyEachFile",
        "type": "Copy",
        "typeProperties": {
          "source": { "type": "DelimitedTextSource" },
          "sink": { "type": "AzureSqlSink" }
        }
      }
    ]
  }
}
```

---

## 7. Integration Runtimes

| Type | Use case |
|---|---|
| **Azure IR** | Default, fully managed, for cloud-to-cloud data movement and Data Flow execution |
| **Self-hosted IR** | Install an agent on-prem/VNet to reach private data sources (on-prem SQL Server, file shares) |
| **Azure-SSIS IR** | Lift-and-shift existing SQL Server Integration Services (SSIS) packages to Azure |

```bash
# Create a self-hosted IR
az datafactory integration-runtime self-hosted create \
  --resource-group my-rg --factory-name my-adf --integration-runtime-name my-shir
# Then install the agent on-prem using the generated auth key
```

---

## 8. Triggers

| Trigger type | Use case |
|---|---|
| **Schedule** | Cron-like recurring runs (e.g., daily at 6 AM) |
| **Tumbling window** | Fixed-size, non-overlapping time windows with backfill support and dependency chaining |
| **Event-based** | Fires when a blob is created/deleted in a Storage account |
| **Manual** | Ad-hoc, triggered via API/CLI/UI |

```json
{
  "name": "DailyTrigger",
  "properties": {
    "type": "ScheduleTrigger",
    "typeProperties": {
      "recurrence": { "frequency": "Day", "interval": 1, "startTime": "2026-01-01T06:00:00Z" }
    },
    "pipelines": [{ "pipelineReference": { "referenceName": "CopyBlobToSql", "type": "PipelineReference" } }]
  }
}
```

---

## 9. Python SDK (`azure-mgmt-datafactory` + `azure-identity`)

```bash
pip install azure-mgmt-datafactory azure-identity
```

### Client setup
```python
from azure.identity import DefaultAzureCredential
from azure.mgmt.datafactory import DataFactoryManagementClient

credential = DefaultAzureCredential()
adf_client = DataFactoryManagementClient(credential, subscription_id="MY_SUBSCRIPTION_ID")
```

### Create a linked service (Blob Storage)
```python
from azure.mgmt.datafactory.models import (
    LinkedServiceResource, AzureBlobStorageLinkedService
)

blob_ls = AzureBlobStorageLinkedService(connection_string="DefaultEndpointsProtocol=https;...")
adf_client.linked_services.create_or_update(
    "my-rg", "my-adf", "AzureBlobLS", LinkedServiceResource(properties=blob_ls)
)
```

### Create a pipeline programmatically
```python
from azure.mgmt.datafactory.models import (
    PipelineResource, CopyActivity, DatasetReference,
    BlobSource, AzureSqlSink, DelimitedTextSource
)

copy_activity = CopyActivity(
    name="CopyBlobToSql",
    inputs=[DatasetReference(reference_name="BlobDataset")],
    outputs=[DatasetReference(reference_name="SqlDataset")],
    source=DelimitedTextSource(),
    sink=AzureSqlSink(write_behavior="upsert"),
)

pipeline = PipelineResource(activities=[copy_activity])
adf_client.pipelines.create_or_update("my-rg", "my-adf", "CopyBlobToSql", pipeline)
```

### Trigger a pipeline run and poll for status
```python
run_response = adf_client.pipelines.create_run(
    "my-rg", "my-adf", "CopyBlobToSql",
    parameters={"sourcePath": "raw/2026-09-01"},
)
run_id = run_response.run_id
print(f"Started run: {run_id}")

import time
while True:
    run = adf_client.pipeline_runs.get("my-rg", "my-adf", run_id)
    print(f"Status: {run.status}")
    if run.status in ("Succeeded", "Failed", "Cancelled"):
        break
    time.sleep(15)
```

### List recent pipeline runs (monitoring/alerting scripts)
```python
from datetime import datetime, timedelta
from azure.mgmt.datafactory.models import RunFilterParameters

filter_params = RunFilterParameters(
    last_updated_after=datetime.utcnow() - timedelta(days=1),
    last_updated_before=datetime.utcnow(),
)
runs = adf_client.pipeline_runs.query_by_factory("my-rg", "my-adf", filter_params)
for run in runs.value:
    print(run.pipeline_name, run.status, run.run_start, run.run_end)

failed_runs = [r for r in runs.value if r.status == "Failed"]
if failed_runs:
    print(f"⚠️ {len(failed_runs)} failed runs in the last 24h")
```

### Create/start a trigger from Python
```python
from azure.mgmt.datafactory.models import TriggerResource, ScheduleTrigger, ScheduleTriggerRecurrence

recurrence = ScheduleTriggerRecurrence(frequency="Day", interval=1, start_time=datetime(2026, 1, 1, 6, 0))
trigger = ScheduleTrigger(recurrence=recurrence, pipelines=[])
adf_client.triggers.create_or_update("my-rg", "my-adf", "DailyTrigger", TriggerResource(properties=trigger))
adf_client.triggers.begin_start("my-rg", "my-adf", "DailyTrigger").wait()
```

### Calling ADF from a wider orchestrator (e.g., a Python Azure Function on a timer)
```python
import azure.functions as func
from azure.identity import DefaultAzureCredential
from azure.mgmt.datafactory import DataFactoryManagementClient

def main(mytimer: func.TimerRequest) -> None:
    credential = DefaultAzureCredential()
    client = DataFactoryManagementClient(credential, subscription_id="MY_SUB_ID")
    client.pipelines.create_run("my-rg", "my-adf", "CopyBlobToSql")
```

---

## 10. Mapping Data Flow Expressions (quick reference)

```
// Derived column examples (Data Flow expression language, not SQL/Python)
iif(isNull(country), 'Unknown', upper(country))
toDate(order_date_string, 'yyyy-MM-dd')
concat(first_name, ' ', last_name)
regexExtract(url, 'utm_source=([^&]+)', 1)
```

---

## 11. Monitoring

- **Monitor tab** in ADF Studio: pipeline runs, activity runs, trigger runs, Gantt-style timeline.
- **Azure Monitor / Log Analytics**: diagnostic logs for alerting (e.g., alert on `PipelineFailedRuns`).
- **Alerts**: configure metric alerts on failed pipeline/activity runs, sent to email/Teams/webhook.

---

## 12. Common Gotchas

- Self-hosted IR machines need outbound internet access to Azure — firewall/proxy misconfigurations are the #1 setup issue.
- `ForEach` activities default to **parallel** execution — set `isSequential: true` if downstream order matters.
- Data Flow debug clusters bill per minute while active — always turn off debug mode when done.
- Tumbling window triggers can silently pile up backfill runs if paused for a long time — check the trigger's dependency window.
- Copy Activity performance is very sensitive to DIU count and partitioning — tune `parallelCopies` and source partition options for large loads.
- Hardcoded connection strings in Linked Services are a security risk — use **Azure Key Vault**-backed Linked Services instead.

---

## 13. Useful Links

- Docs: https://learn.microsoft.com/en-us/azure/data-factory/
- Pricing: https://azure.microsoft.com/en-us/pricing/details/data-factory/
- Python SDK reference: https://learn.microsoft.com/en-us/python/api/overview/azure/mgmt-datafactory-readme
