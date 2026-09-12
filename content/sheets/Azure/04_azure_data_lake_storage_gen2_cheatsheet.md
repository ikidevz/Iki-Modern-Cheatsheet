# Azure Data Lake Storage Gen2 (ADLS Gen2) Cheatsheet — *Bonus*

> Hierarchical-namespace object storage built on Azure Blob Storage — the data lake layer underneath ADF, Synapse, and Databricks.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Type | Object storage with a **hierarchical namespace** (true directories, unlike flat Blob storage) |
| Structure | Storage Account → Containers (Filesystems) → Directories → Files (Blobs) |
| Best for | Data lake landing zone, staging for ADF/Synapse/Databricks, Delta Lake table storage |
| Relation to Blob Storage | ADLS Gen2 = Blob Storage + Hierarchical Namespace (HNS) enabled + a Data Lake-optimized API/driver |

---

## 2. Access Tiers

| Tier | Use case | Relative cost |
|---|---|---|
| **Hot** | Frequently accessed / hot data | Highest storage, lowest access |
| **Cool** | Accessed roughly monthly | Lower storage, some access cost, min 30-day retention |
| **Cold** | Accessed rarely (quarterly-ish) | Even lower storage, min 90-day retention |
| **Archive** | Long-term, rarely accessed, hours-long rehydration needed | Lowest storage, highest retrieval cost/latency |

💡 Use **Lifecycle Management policies** to auto-tier or delete blobs based on age/last-access-time.

---

## 3. Azure CLI Reference

```bash
# Create a storage account with hierarchical namespace enabled (this makes it ADLS Gen2)
az storage account create --name myadlsaccount --resource-group my-rg \
  --location eastus --sku Standard_LRS --kind StorageV2 --hierarchical-namespace true

# Containers (filesystems) & directories
az storage container create --account-name myadlsaccount --name data
az storage fs directory create --account-name myadlsaccount -f data -n raw/events

# Upload / download
az storage fs file upload --account-name myadlsaccount -f data \
  -s local_file.csv -p raw/events/local_file.csv

az storage fs file download --account-name myadlsaccount -f data \
  -p raw/events/local_file.csv -d ./local_copy.csv

# List
az storage fs file list --account-name myadlsaccount -f data --path raw/events

# ACLs (POSIX-like permissions, on top of RBAC)
az storage fs access set --account-name myadlsaccount -f data -p raw/events \
  --acl "user::rwx,group::r-x,other::---"

# Lifecycle management policy
az storage account management-policy create --account-name myadlsaccount \
  --resource-group my-rg --policy @lifecycle.json

# Generate a SAS token (time-limited access)
az storage fs generate-sas --account-name myadlsaccount -f data -p raw/events/file.csv \
  --permissions r --expiry 2026-12-31
```

---

## 4. Python Client Library (`azure-storage-file-datalake`)

```bash
pip install azure-storage-file-datalake azure-identity
```

### Client setup
```python
from azure.identity import DefaultAzureCredential
from azure.storage.filedatalake import DataLakeServiceClient

credential = DefaultAzureCredential()
service_client = DataLakeServiceClient(
    account_url="https://myadlsaccount.dfs.core.windows.net",
    credential=credential,
)
file_system_client = service_client.get_file_system_client(file_system="data")
```

### Create directories & upload files
```python
directory_client = file_system_client.get_directory_client("raw/events")
directory_client.create_directory()

file_client = directory_client.get_file_client("events_2026_09_11.csv")
with open("local_events.csv", "rb") as f:
    data = f.read()
    file_client.upload_data(data, overwrite=True)
```

### Upload a pandas DataFrame directly (no local file needed)
```python
import pandas as pd
from io import BytesIO

df = pd.DataFrame({"id": [1, 2], "country": ["PH", "US"]})
buffer = BytesIO()
df.to_parquet(buffer, index=False)
buffer.seek(0)

file_client = directory_client.get_file_client("events.parquet")
file_client.upload_data(buffer.read(), overwrite=True)
```

### Download — to file, to memory, to DataFrame
```python
# To local file
file_client = directory_client.get_file_client("events_2026_09_11.csv")
with open("downloaded.csv", "wb") as f:
    download = file_client.download_file()
    f.write(download.readall())

# Straight into memory / pandas
data_bytes = file_client.download_file().readall()

import pandas as pd
from io import BytesIO
df = pd.read_parquet(BytesIO(directory_client.get_file_client("events.parquet").download_file().readall()))
```

### List directories & files (like exploring "folders")
```python
paths = file_system_client.get_paths(path="raw/events")
for path in paths:
    print(path.name, path.is_directory, path.content_length)
```

### Delete files / directories
```python
directory_client.get_file_client("old_file.csv").delete_file()
directory_client.delete_directory()   # recursive delete of a whole directory
```

### Manage ACLs programmatically
```python
directory_client.update_access_control(acl="user::rwx,group::r-x,other::---")
acl_props = directory_client.get_access_control()
print(acl_props["acl"])
```

### Generate a SAS token from Python (temporary, scoped access)
```python
from azure.storage.filedatalake import generate_file_sas, FileSasPermissions
from datetime import datetime, timedelta

sas_token = generate_file_sas(
    account_name="myadlsaccount",
    file_system_name="data",
    directory_name="raw/events",
    file_name="events.parquet",
    credential="<account_key>",
    permission=FileSasPermissions(read=True),
    expiry=datetime.utcnow() + timedelta(hours=1),
)
sas_url = f"https://myadlsaccount.dfs.core.windows.net/data/raw/events/events.parquet?{sas_token}"
```

### Rename (move) a file — a first-class operation in ADLS Gen2 (unlike flat blob storage)
```python
file_client = directory_client.get_file_client("events.csv")
file_client.rename_file(new_name="data/archive/events_archived.csv")
```

### Set lifecycle management policy from Python
```python
from azure.mgmt.storage import StorageManagementClient
from azure.mgmt.storage.models import ManagementPolicy

policy = ManagementPolicy(
    policy={
        "rules": [{
            "name": "moveColdAfter30Days",
            "enabled": True,
            "type": "Lifecycle",
            "definition": {
                "actions": {
                    "baseBlob": {
                        "tierToCool": {"daysAfterModificationGreaterThan": 30},
                        "tierToArchive": {"daysAfterModificationGreaterThan": 180},
                        "delete": {"daysAfterModificationGreaterThan": 365},
                    }
                },
                "filters": {"blobTypes": ["blockBlob"], "prefixMatch": ["raw/"]},
            },
        }]
    }
)
mgmt_client = StorageManagementClient(credential, subscription_id="MY_SUB_ID")
mgmt_client.management_policies.create_or_update("my-rg", "myadlsaccount", "default", policy)
```

---

## 5. Authentication Options

| Method | Use case |
|---|---|
| **Azure AD / `DefaultAzureCredential`** | Recommended — works with managed identity, service principal, or local `az login` |
| **Storage Account Key** | Simple but broad access — avoid in production/shared code |
| **SAS Token** | Time-limited, scope-limited access — good for sharing with external parties |
| **Service Principal** | App registration with a client secret/certificate for automated pipelines |

---

## 6. IAM & ACLs

| Mechanism | Scope | Notes |
|---|---|---|
| **Azure RBAC** | Container/account/subscription level | `Storage Blob Data Reader/Contributor/Owner` roles |
| **POSIX-style ACLs** | Per file/directory | Fine-grained, Linux-like `rwx` permissions — layers on top of RBAC |
| **SAS tokens** | Time-limited, per-resource | Grant temporary access without changing IAM |

---

## 7. Integration with Data Services

| Service | Pattern |
|---|---|
| **Azure Data Factory** | Linked Service of type ADLS Gen2; Copy Activity source/sink |
| **Synapse** | `abfss://` paths in Spark notebooks; `OPENROWSET` in serverless SQL |
| **Databricks** | Mount via `abfss://` + OAuth/service principal, or use Unity Catalog external locations |
| **Power BI** | Connect directly as a data source, or query via a Synapse Serverless SQL view on top |

```python
# Reading ADLS Gen2 from a Databricks/Synapse Spark notebook
df = spark.read.parquet("abfss://data@myadlsaccount.dfs.core.windows.net/raw/events/")
```

---

## 8. Performance Tips

- Avoid **too many small files** — compact to 100MB–1GB files for analytics workloads (Spark/Synapse read performance).
- Use **hierarchical namespace** (enabled on ADLS Gen2 by default) for efficient directory rename/delete operations.
- Co-locate the storage account region with compute (Databricks workspace, Synapse workspace) to avoid cross-region latency/egress.
- Use **Premium (block blob)** tier for latency-sensitive workloads with heavy read/write transaction volume.

---

## 9. Pricing

- **Storage**: $/GB/month, varies by tier (Hot/Cool/Cold/Archive) and redundancy (LRS/ZRS/GRS).
- **Transactions**: priced per 10,000 operations, varies by tier and operation type (read vs write).
- **Data retrieval**: extra charge for reading Cool/Cold/Archive tier data.
- **Egress**: network egress out of Azure is billed; intra-region to compute is typically free/cheap.

---

## 10. Common Gotchas

- Hierarchical namespace **cannot be disabled** after account creation — decide upfront (regular Blob Storage vs ADLS Gen2).
- Deleting a directory recursively is irreversible without **soft delete**/versioning enabled — turn these on for critical data.
- Mixing flat Blob Storage tools/SDKs with ADLS Gen2 hierarchical features can cause confusing behavior — use the `filedatalake` SDK for directory-aware operations.
- Small file explosion from streaming writes (Autoloader, Event Hubs Capture) hurts downstream Spark/Synapse read performance — schedule compaction (`OPTIMIZE` in Delta).
- SAS tokens with overly broad permissions/long expiry are a common security misconfiguration — scope tightly and prefer Azure AD auth where possible.

---

## 11. Useful Links

- Docs: https://learn.microsoft.com/en-us/azure/storage/blobs/data-lake-storage-introduction
- Pricing: https://azure.microsoft.com/en-us/pricing/details/storage/data-lake/
- Python SDK reference: https://learn.microsoft.com/en-us/python/api/overview/azure/storage-file-datalake-readme
