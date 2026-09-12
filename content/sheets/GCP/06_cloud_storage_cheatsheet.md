# Google Cloud Storage (GCS) Cheatsheet — *Bonus*

> Unified object storage that underpins almost every GCP data pipeline as the **data lake** / staging layer for BigQuery, Dataflow, Dataproc, and Composer.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Type | Object storage (not a filesystem) |
| Structure | Bucket → Objects (keys), no real folders (simulated via `/` prefixes) |
| Best for | Data lake landing zone, staging for BQ loads, Dataflow temp/staging, ML datasets, backups |
| Consistency | Strong global consistency for all operations |

---

## 2. Storage Classes

| Class | Min storage duration | Use case | Relative cost |
|---|---|---|---|
| **Standard** | None | Frequently accessed / hot data | Highest storage, lowest access |
| **Nearline** | 30 days | Accessed ~once/month (backups) | Lower storage, some access cost |
| **Coldline** | 90 days | Accessed ~once/quarter | Even lower storage |
| **Archive** | 365 days | Long-term archival, rarely touched | Lowest storage, highest retrieval cost |

💡 Use **Autoclass** or **Object Lifecycle Management** to auto-transition objects between classes based on age/access.

---

## 3. CLI (`gcloud storage` — modern; `gsutil` — legacy but still common)

```bash
# Buckets
gcloud storage buckets create gs://my-bucket --location=us-central1 --default-storage-class=STANDARD
gcloud storage buckets list
gcloud storage buckets delete gs://my-bucket

# Upload / download
gcloud storage cp local_file.csv gs://my-bucket/data/
gcloud storage cp -r gs://my-bucket/data/ ./local_dir/
gcloud storage cp gs://my-bucket/a.csv gs://my-other-bucket/  # copy between buckets

# List / inspect
gcloud storage ls gs://my-bucket/data/
gcloud storage du -s gs://my-bucket   # total size

# Sync (like rsync)
gcloud storage rsync ./local_dir gs://my-bucket/data/ --recursive

# Delete
gcloud storage rm gs://my-bucket/data/old_file.csv
gcloud storage rm -r gs://my-bucket/data/2023/   # recursive

# Legacy gsutil equivalents (still widely used in scripts)
gsutil cp file.csv gs://my-bucket/
gsutil -m cp -r ./data gs://my-bucket/data   # -m = parallel/multithreaded
```

---

## 4. Python Client Library (`google-cloud-storage`)

```bash
pip install google-cloud-storage
```

### Client setup, bucket & blob basics
```python
from google.cloud import storage

client = storage.Client(project="my-project")

# Create bucket
bucket = client.create_bucket("my-bucket", location="us-central1")

# Get existing bucket
bucket = client.bucket("my-bucket")
```

### Upload — from file, string, and DataFrame
```python
# Upload a local file
blob = bucket.blob("data/events.csv")
blob.upload_from_filename("local_events.csv")

# Upload from an in-memory string
blob = bucket.blob("data/notes.txt")
blob.upload_from_string("hello world", content_type="text/plain")

# Upload a pandas DataFrame as CSV/Parquet without writing to local disk first
import pandas as pd
from io import BytesIO

df = pd.DataFrame({"id": [1, 2], "country": ["PH", "US"]})
buffer = BytesIO()
df.to_parquet(buffer, index=False)
buffer.seek(0)
bucket.blob("data/events.parquet").upload_from_file(buffer, content_type="application/octet-stream")
```

### Download — to file, to memory, to DataFrame
```python
# Download to local disk
bucket.blob("data/events.csv").download_to_filename("local_copy.csv")

# Download into memory
data_bytes = bucket.blob("data/events.csv").download_as_bytes()
text = bucket.blob("data/notes.txt").download_as_text()

# Download straight into a pandas DataFrame
import pandas as pd
from io import BytesIO

blob = bucket.blob("data/events.parquet")
df = pd.read_parquet(BytesIO(blob.download_as_bytes()))
```

### List blobs (with prefix filtering, like "folders")
```python
for blob in client.list_blobs("my-bucket", prefix="data/2026/"):
    print(blob.name, blob.size, blob.updated)

# List "directories" one level deep using a delimiter
blobs = client.list_blobs("my-bucket", prefix="data/", delimiter="/")
for page in blobs.pages:
    print("Prefixes (subfolders):", page.prefixes)
```

### Blob metadata & existence checks
```python
blob = bucket.blob("data/events.csv")
if blob.exists():
    blob.reload()   # fetch metadata
    print(blob.size, blob.content_type, blob.time_created, blob.md5_hash)

blob.metadata = {"pipeline": "daily_etl", "source": "sales_system"}
blob.patch()
```

### Copy, rename, delete
```python
source_blob = bucket.blob("data/events.csv")
destination_bucket = client.bucket("my-other-bucket")
bucket.copy_blob(source_blob, destination_bucket, "archive/events.csv")

# "Rename" = copy + delete (GCS has no native rename)
new_blob = bucket.rename_blob(source_blob, "data/events_renamed.csv")

# Delete
bucket.blob("data/old_file.csv").delete()

# Batch delete
blobs_to_delete = list(client.list_blobs("my-bucket", prefix="tmp/"))
bucket.delete_blobs(blobs_to_delete)
```

### Generate a signed URL (temporary access without IAM changes)
```python
from datetime import timedelta

blob = bucket.blob("data/report.pdf")
url = blob.generate_signed_url(
    version="v4",
    expiration=timedelta(hours=1),
    method="GET",
)
print(url)

# Signed URL for uploads (let an external client PUT a file directly)
upload_url = blob.generate_signed_url(
    version="v4", expiration=timedelta(minutes=15), method="PUT",
    content_type="application/octet-stream",
)
```

### Set lifecycle rules programmatically
```python
bucket.lifecycle_rules = [
    {"action": {"type": "SetStorageClass", "storageClass": "NEARLINE"}, "condition": {"age": 30}},
    {"action": {"type": "Delete"}, "condition": {"age": 365, "isLive": True}},
]
bucket.patch()
```

### Resumable / chunked upload for large files
```python
blob = bucket.blob("data/large_file.parquet")
blob.chunk_size = 10 * 1024 * 1024   # 10MB chunks
blob.upload_from_filename("large_file.parquet")  # resumable automatically for big files
```

### Compose multiple objects into one (server-side, no download needed)
```python
blob_parts = [bucket.blob(f"tmp/part-{i}.csv") for i in range(3)]
destination = bucket.blob("data/combined.csv")
destination.compose(blob_parts)
```

### IAM policy management from Python
```python
policy = bucket.get_iam_policy(requested_policy_version=3)
policy.bindings.append({
    "role": "roles/storage.objectViewer",
    "members": {"group:analysts@company.com"},
})
bucket.set_iam_policy(policy)
```

---

## 5. Lifecycle Rules (JSON, for CLI)

```json
{
  "rule": [
    {
      "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
      "condition": {"age": 30}
    },
    {
      "action": {"type": "Delete"},
      "condition": {"age": 365, "isLive": true}
    }
  ]
}
```
```bash
gcloud storage buckets update gs://my-bucket --lifecycle-file=lifecycle.json
```

---

## 6. IAM, ACLs & Access Control

| Mechanism | Scope | Notes |
|---|---|---|
| **Uniform bucket-level IAM** | Bucket-wide | Recommended default; disables legacy per-object ACLs |
| **Fine-grained ACLs** | Per-object | Legacy; needed for some interop cases |
| **Signed URLs** | Time-limited, per-object | Grant temporary access without IAM changes (e.g., to an external user) |
| **Signed Policy Documents** | Time-limited uploads | Let untrusted clients upload directly with constraints |

```bash
gcloud storage sign-url gs://my-bucket/file.csv --private-key-file=key.json --duration=1h
```

Common roles: `roles/storage.objectViewer`, `objectCreator`, `objectAdmin`, `admin`.

---

## 7. Integration with Data Services

| Service | Pattern |
|---|---|
| **BigQuery** | `bq load` from GCS; external tables directly query GCS files (Parquet/Avro/CSV/JSON) |
| **Dataflow** | Reads sources, writes sinks, uses GCS for `--temp_location`/`--staging_location` |
| **Dataproc** | GCS connector lets Spark/Hadoop treat `gs://` like HDFS |
| **Composer/Airflow** | DAG files, plugins, and logs are stored in the environment's GCS bucket |
| **Pub/Sub** | GCS subscriptions write messages directly to files |

---

## 8. Performance Tips

- Avoid **too many small objects** — batch/compact files (target 100MB–1GB per file for analytics workloads).
- Use **parallel composite uploads** (`gcloud storage cp` does this automatically) for large files.
- For high-throughput random access, consider **request rate ramp-up** — GCS auto-scales but sudden spikes to a new prefix may throttle briefly.
- Co-locate bucket region with compute (BigQuery dataset, Dataflow region) to avoid cross-region egress cost/latency.

---

## 9. Pricing

- **Storage** ($/GB/month, varies by class)
- **Operations** (Class A: writes/lists, Class B: reads — priced per 1,000 ops)
- **Network egress** (free within same region to some GCP services; charged cross-region/internet)
- **Retrieval fees** for Nearline/Coldline/Archive

---

## 10. Common Gotchas

- Deleting a bucket does **not** ask twice — deleted objects (without versioning) are unrecoverable.
- Enable **Object Versioning** for critical data to protect against accidental overwrite/delete.
- "Folders" are cosmetic — listing a "folder" with millions of objects can be slow; design key prefixes for your access pattern (e.g., date-partitioned prefixes).
- Cross-region access between GCS and BigQuery/Dataflow adds latency and egress charges — always check regions match.
- Public buckets are a common security misconfiguration — audit with **IAM Recommender** / **Security Command Center**.
- `download_as_bytes()`/`to_dataframe()` on very large blobs will exhaust local/client memory — stream or chunk instead.

---

## 11. Useful Links

- Docs: https://cloud.google.com/storage/docs
- Pricing: https://cloud.google.com/storage/pricing
- Storage classes: https://cloud.google.com/storage/docs/storage-classes
- Python client reference: https://cloud.google.com/python/docs/reference/storage/latest
