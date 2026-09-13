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

# List activity runs for a pipeline run (drill into what failed)
az datafactory activity-run query-by-pipeline-run --resource-group my-rg --factory-name my-adf \
  --run-id RUN_ID --last-updated-after 2026-09-01T00:00:00Z --last-updated-before 2026-09-13T00:00:00Z

# Triggers
az datafactory trigger create --resource-group my-rg --factory-name my-adf \
  --trigger-name DailyTrigger --properties @trigger.json
az datafactory trigger start --resource-group my-rg --factory-name my-adf --trigger-name DailyTrigger
az datafactory trigger stop --resource-group my-rg --factory-name my-adf --trigger-name DailyTrigger

# Delete resources
az datafactory pipeline delete --resource-group my-rg --factory-name my-adf --pipeline-name CopyPipeline
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
| `Switch` | Multi-branch logic based on a value (like a `switch` statement) |
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
| `Fail` | Explicitly fail a pipeline with a custom error message |
| `Validation` | Wait until a file/folder meets a condition before proceeding |

### Example: ForEach + Copy (process a list of files)
```json
{
  "name": "ForEachFile",
  "type": "ForEach",
  "typeProperties": {
    "items": { "value": "@pipeline().parameters.fileList", "type": "Expression" },
    "isSequential": false,
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

### Example: Get Metadata + If Condition (skip processing if no new file)
```json
{
  "name": "CheckFileExists",
  "type": "GetMetadata",
  "typeProperties": {
    "dataset": { "referenceName": "InputFileDataset", "type": "DatasetReference" },
    "fieldList": ["exists", "lastModified", "size"]
  }
}
```
```json
{
  "name": "IfFileExists",
  "type": "IfCondition",
  "typeProperties": {
    "expression": { "value": "@activity('CheckFileExists').output.exists", "type": "Expression" },
    "ifTrueActivities": [{ "name": "ProcessFile", "type": "Copy" }],
    "ifFalseActivities": [{ "name": "LogNoFile", "type": "Fail",
        "typeProperties": { "message": "No file found for today", "errorCode": "404" } }]
  }
}
```

### Example: Error handling — "on failure" path
ADF pipelines model try/catch via activity dependency conditions (`Succeeded`, `Failed`, `Skipped`, `Completed`) drawn between activities rather than a code block:
```json
{
  "name": "MainCopyActivity",
  "type": "Copy",
  "typeProperties": { "source": {}, "sink": {} }
},
{
  "name": "SendFailureAlert",
  "type": "WebActivity",
  "dependsOn": [{ "activity": "MainCopyActivity", "dependencyConditions": ["Failed"] }],
  "typeProperties": {
    "url": "https://prod-xx.westus.logic.azure.com:443/workflows/xxx/triggers/manual/paths/invoke",
    "method": "POST",
    "body": { "message": "@concat('Pipeline failed: ', pipeline().Pipeline)" }
  }
}
```

---

## 7. Dynamic Content Expressions Cheat Sheet

```
@pipeline().parameters.sourcePath          -- pipeline parameter
@pipeline().RunId                          -- system variable: current run ID
@pipeline().TriggerTime                    -- system variable: when the trigger fired
@activity('CopyActivityName').output       -- output of a previous activity
@activity('LookupActivity').output.firstRow.columnName
@dataset().fileName                        -- dataset parameter
@utcnow()                                  -- current UTC timestamp
@formatDateTime(utcnow(), 'yyyy-MM-dd')    -- formatted date, common for partitioned paths
@concat('raw/', formatDateTime(utcnow(), 'yyyy/MM/dd'), '/data.csv')
@if(equals(activity('Lookup').output.firstRow.status, 'active'), 'Y', 'N')
@json(activity('WebActivity').output.Response)   -- parse a JSON string response
```

---

## 8. Incremental Load Pattern (Watermark-Based)

A common production pattern to avoid re-copying an entire source table every run:

```json
// 1. Lookup: get the last watermark value stored from the previous run
{ "name": "LookupOldWatermark", "type": "Lookup",
  "typeProperties": { "source": { "type": "AzureSqlSource",
      "sqlReaderQuery": "SELECT WatermarkValue FROM WatermarkTable WHERE TableName = 'Orders'" } } }
```
```json
// 2. Lookup: get the current max value from the source
{ "name": "LookupNewWatermark", "type": "Lookup",
  "typeProperties": { "source": { "type": "AzureSqlSource",
      "sqlReaderQuery": "SELECT MAX(ModifiedDate) AS NewWatermark FROM Orders" } } }
```
```json
// 3. Copy only rows between old and new watermark
{ "name": "IncrementalCopy", "type": "Copy",
  "typeProperties": { "source": { "type": "AzureSqlSource",
      "sqlReaderQuery": "@concat('SELECT * FROM Orders WHERE ModifiedDate > ''',
                          activity('LookupOldWatermark').output.firstRow.WatermarkValue,
                          ''' AND ModifiedDate <= ''',
                          activity('LookupNewWatermark').output.firstRow.NewWatermark, '''')" } } }
```
```json
// 4. Stored Procedure: persist the new watermark for next run
{ "name": "UpdateWatermark", "type": "SqlServerStoredProcedure",
  "typeProperties": { "storedProcedureName": "usp_update_watermark" } }
```

---

## 9. Integration Runtimes

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

## 10. Triggers

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

### Tumbling window trigger with dependency chaining
```json
{
  "name": "HourlyTumblingWindow",
  "properties": {
    "type": "TumblingWindowTrigger",
    "typeProperties": {
      "frequency": "Hour", "interval": 1,
      "startTime": "2026-01-01T00:00:00Z",
      "maxConcurrency": 5,
      "retryPolicy": { "count": 3, "intervalInSeconds": 300 },
      "dependsOn": [{ "type": "TumblingWindowTriggerDependencyReference",
                       "referenceTrigger": { "referenceName": "UpstreamTrigger" },
                       "offset": "-01:00:00" }]
    }
  }
}
```

### Event-based trigger (fires on new blob arrival)
```json
{
  "name": "OnNewFileTrigger",
  "properties": {
    "type": "BlobEventsTrigger",
    "typeProperties": {
      "blobPathBeginsWith": "/raw/blobs/",
      "blobPathEndsWith": ".csv",
      "events": ["Microsoft.Storage.BlobCreated"],
      "scope": "/subscriptions/.../resourceGroups/my-rg/providers/Microsoft.Storage/storageAccounts/myadls"
    }
  }
}
```

---

## 11. Python SDK (`azure-mgmt-datafactory` + `azure-identity`)

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

### Create a linked service backed by Key Vault (recommended over inline secrets)
```python
from azure.mgmt.datafactory.models import AzureKeyVaultLinkedService, LinkedServiceReference

kv_ls = AzureKeyVaultLinkedService(base_url="https://my-keyvault.vault.azure.net/")
adf_client.linked_services.create_or_update(
    "my-rg", "my-adf", "KeyVaultLS", LinkedServiceResource(properties=kv_ls)
)
```

### Create datasets
```python
from azure.mgmt.datafactory.models import (
    DatasetResource, AzureBlobDataset, DatasetReference, LinkedServiceReference
)

blob_dataset = AzureBlobDataset(
    linked_service_name=LinkedServiceReference(reference_name="AzureBlobLS"),
    folder_path="raw/events", file_name="events.csv", format={"type": "TextFormat"},
)
adf_client.datasets.create_or_update("my-rg", "my-adf", "BlobDataset", DatasetResource(properties=blob_dataset))
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

### Drill into activity-level failures on a failed run
```python
from azure.mgmt.datafactory.models import RunFilterParameters
from datetime import datetime, timedelta

activity_runs = adf_client.activity_runs.query_by_pipeline_run(
    "my-rg", "my-adf", run_id,
    RunFilterParameters(
        last_updated_after=datetime.utcnow() - timedelta(hours=1),
        last_updated_before=datetime.utcnow(),
    ),
)
for ar in activity_runs.value:
    if ar.status == "Failed":
        print(f"{ar.activity_name} failed: {ar.error}")
```

### List recent pipeline runs (monitoring/alerting scripts)
```python
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
from datetime import datetime

recurrence = ScheduleTriggerRecurrence(frequency="Day", interval=1, start_time=datetime(2026, 1, 1, 6, 0))
trigger = ScheduleTrigger(recurrence=recurrence, pipelines=[])
adf_client.triggers.create_or_update("my-rg", "my-adf", "DailyTrigger", TriggerResource(properties=trigger))
adf_client.triggers.begin_start("my-rg", "my-adf", "DailyTrigger").wait()
```

### Cancel a running pipeline
```python
adf_client.pipeline_runs.cancel("my-rg", "my-adf", run_id, is_recursive=True)
```

### Trigger a pipeline via raw REST call (no SDK dependency, useful in lightweight scripts)
```python
import requests
from azure.identity import DefaultAzureCredential

credential = DefaultAzureCredential()
token = credential.get_token("https://management.azure.com/.default").token

url = (
    "https://management.azure.com/subscriptions/MY_SUB_ID/resourceGroups/my-rg/"
    "providers/Microsoft.DataFactory/factories/my-adf/pipelines/CopyBlobToSql/createRun"
    "?api-version=2018-06-01"
)
resp = requests.post(url, headers={"Authorization": f"Bearer {token}"}, json={"sourcePath": "raw/2026-09-01"})
print(resp.json()["runId"])
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

## 12. Mapping Data Flow Expressions (quick reference)

```
// Derived column examples (Data Flow expression language, not SQL/Python)
iif(isNull(country), 'Unknown', upper(country))
toDate(order_date_string, 'yyyy-MM-dd')
concat(first_name, ' ', last_name)
regexExtract(url, 'utm_source=([^&]+)', 1)
soundex(last_name)
sha2(256, concat(email, salt))
```

---

## 13. CI/CD Basics

- ADF supports **Git integration** (Azure DevOps or GitHub) for source-controlled pipeline JSON.
- Publishing merges the collaboration branch into an `adf_publish` branch containing ARM templates.
- Deploy across environments (Dev → Test → Prod) using **ARM template deployment** with environment-specific parameter files, typically via an Azure DevOps/GitHub Actions pipeline.

```bash
# Deploy an exported ARM template to a new environment
az deployment group create --resource-group my-prod-rg \
  --template-file ARMTemplateForFactory.json \
  --parameters ARMTemplateParametersForFactory.json
```

---

## 14. Monitoring

- **Monitor tab** in ADF Studio: pipeline runs, activity runs, trigger runs, Gantt-style timeline.
- **Azure Monitor / Log Analytics**: diagnostic logs for alerting (e.g., alert on `PipelineFailedRuns`).
- **Alerts**: configure metric alerts on failed pipeline/activity runs, sent to email/Teams/webhook.

```kusto
// Log Analytics (KQL) query — pipeline failures in the last 24h
ADFPipelineRun
| where Status == "Failed"
| where TimeGenerated > ago(24h)
| project PipelineName, Status, Start, End, Error = tostring(parse_json(Error).message)
```

---

## 15. Common Gotchas

- Self-hosted IR machines need outbound internet access to Azure — firewall/proxy misconfigurations are the #1 setup issue.
- `ForEach` activities default to **parallel** execution — set `isSequential: true` if downstream order matters.
- Data Flow debug clusters bill per minute while active — always turn off debug mode when done.
- Tumbling window triggers can silently pile up backfill runs if paused for a long time — check the trigger's dependency window.
- Copy Activity performance is very sensitive to DIU count and partitioning — tune `parallelCopies` and source partition options for large loads.
- Hardcoded connection strings in Linked Services are a security risk — use **Azure Key Vault**-backed Linked Services instead.
- `dependsOn` conditions default to `Succeeded` — a failure path activity needs an explicit `Failed`/`Completed` dependency condition or it will never run.
- Expressions referencing `activity('X').output` fail with a confusing error if activity `X` was skipped (e.g., inside an untaken `If Condition` branch).

---

## 16. Useful Links

- Docs: https://learn.microsoft.com/en-us/azure/data-factory/
- Pricing: https://azure.microsoft.com/en-us/pricing/details/data-factory/
- Python SDK reference: https://learn.microsoft.com/en-us/python/api/overview/azure/mgmt-datafactory-readme
- Expression language reference: https://learn.microsoft.com/en-us/azure/data-factory/control-flow-expression-language-functions
