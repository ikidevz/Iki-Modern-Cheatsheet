# Google Cloud Dataproc Cheatsheet

> Managed Apache Hadoop, Spark, Flink, Presto/Trino, and Hive service — spin up clusters in ~90 seconds.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Type | Managed Hadoop/Spark ecosystem (clusters or serverless) |
| Engines supported | Spark, PySpark, Hadoop/MapReduce, Hive, Pig, Flink, Presto/Trino, Jupyter |
| Best for | Lift-and-shift of existing Hadoop/Spark workloads, large-scale batch ML/ETL, ML feature engineering at scale |
| Not for | Simple SQL transforms (use BigQuery), lightweight streaming (use Dataflow/Pub-Sub) |

---

## 2. Core Concepts

| Concept | Description |
|---|---|
| **Cluster** | Set of Compute Engine VMs (master + workers) running Hadoop/Spark |
| **Job** | A Spark/Hadoop/Hive/Pig job submitted to run on a cluster |
| **Workflow Template** | Reusable, parameterized DAG of jobs (with optional ephemeral cluster) |
| **Autoscaling Policy** | Rules to grow/shrink worker nodes based on YARN pending memory |
| **Initialization Action** | Startup script run on every node at cluster creation (install libs, configure) |
| **Ephemeral cluster** | Cluster created just for a job/workflow, then torn down — avoids idle cost |
| **Dataproc Serverless** | Run Spark batch/interactive jobs with **no cluster management** at all |
| **Component Gateway** | Secure web UI access to Spark History Server, Yarn UI, Jupyter, etc. |
| **Dataproc Metastore** | Managed, persistent Hive Metastore shared across ephemeral clusters |

---

## 3. Cluster Types

| Type | Use case |
|---|---|
| **Standard** | 1 master + N workers, general purpose |
| **Single-node** | Dev/test, small workloads (master doubles as worker) |
| **High-availability** | 3 masters, for production-critical long-running clusters |
| **Ephemeral** | Created per-job via Workflow Templates, auto-deleted after |
| **Dataproc Serverless (Spark)** | No cluster at all — submit Spark batches, GCP manages everything |

---

## 4. gcloud CLI

```bash
# Create a cluster
gcloud dataproc clusters create my-cluster \
  --region=us-central1 \
  --num-workers=2 \
  --worker-machine-type=n2-standard-4 \
  --master-machine-type=n2-standard-4 \
  --image-version=2.2-debian12 \
  --enable-component-gateway \
  --optional-components=JUPYTER

# Cluster with preemptible/spot secondary workers (cost saving)
gcloud dataproc clusters create my-cluster --region=us-central1 \
  --num-workers=2 --num-secondary-workers=4 \
  --secondary-worker-type=spot

# Autoscaling
gcloud dataproc autoscaling-policies import my-policy --source=policy.yaml
gcloud dataproc clusters create my-cluster --autoscaling-policy=my-policy --region=us-central1

# Submit a Spark job
gcloud dataproc jobs submit pyspark gs://my-bucket/job.py \
  --cluster=my-cluster --region=us-central1 \
  -- --input=gs://bucket/in --output=gs://bucket/out

# Submit a Hive/Hadoop job
gcloud dataproc jobs submit hive --cluster=my-cluster --region=us-central1 \
  --execute="SELECT COUNT(*) FROM my_table;"

# Submit Spark SQL job
gcloud dataproc jobs submit spark-sql --cluster=my-cluster --region=us-central1 \
  --execute="SELECT * FROM parquet.\`gs://bucket/data\` LIMIT 10;"

# Workflow templates (reusable DAG, ephemeral cluster)
gcloud dataproc workflow-templates create my-template --region=us-central1
gcloud dataproc workflow-templates set-managed-cluster my-template \
  --region=us-central1 --cluster-name=ephemeral-cluster --num-workers=2
gcloud dataproc workflow-templates add-job pyspark gs://bucket/job.py \
  --workflow-template=my-template --region=us-central1 --step-id=step1
gcloud dataproc workflow-templates instantiate my-template --region=us-central1

# Dataproc Serverless (no cluster needed)
gcloud dataproc batches submit pyspark gs://bucket/job.py \
  --region=us-central1 --deps-bucket=gs://bucket/deps

# Delete cluster
gcloud dataproc clusters delete my-cluster --region=us-central1
```

---

## 5. Python Client Library — Managing Clusters & Jobs Programmatically

```bash
pip install google-cloud-dataproc
```

### Create a cluster from Python
```python
from google.cloud import dataproc_v1

cluster_client = dataproc_v1.ClusterControllerClient(
    client_options={"api_endpoint": "us-central1-dataproc.googleapis.com:443"}
)

cluster = {
    "project_id": "my-project",
    "cluster_name": "my-cluster",
    "config": {
        "master_config": {"num_instances": 1, "machine_type_uri": "n2-standard-4"},
        "worker_config": {"num_instances": 2, "machine_type_uri": "n2-standard-4"},
        "software_config": {"image_version": "2.2-debian12"},
    },
}

operation = cluster_client.create_cluster(
    request={"project_id": "my-project", "region": "us-central1", "cluster": cluster}
)
result = operation.result()  # blocks until cluster is running
print(f"Cluster created: {result.cluster_name}")
```

### Submit a PySpark job from Python
```python
job_client = dataproc_v1.JobControllerClient(
    client_options={"api_endpoint": "us-central1-dataproc.googleapis.com:443"}
)

job = {
    "placement": {"cluster_name": "my-cluster"},
    "pyspark_job": {"main_python_file_uri": "gs://my-bucket/job.py",
                     "args": ["--input", "gs://bucket/in", "--output", "gs://bucket/out"]},
}

operation = job_client.submit_job_as_operation(
    request={"project_id": "my-project", "region": "us-central1", "job": job}
)
response = operation.result()
print(f"Job finished: {response.status.state}")
```

### Delete a cluster from Python
```python
operation = cluster_client.delete_cluster(
    request={"project_id": "my-project", "region": "us-central1", "cluster_name": "my-cluster"}
)
operation.result()
```

---

## 6. PySpark Examples

### Example 1 — Read Parquet, filter, aggregate, write to BigQuery
```python
from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("etl-job").getOrCreate()

df = spark.read.parquet("gs://my-bucket/raw/events/")

result = (df
    .filter(df.country == "PH")
    .groupBy("event_type")
    .count())

result.write.format("bigquery") \
    .option("table", "my_project.my_dataset.event_counts") \
    .option("temporaryGcsBucket", "my-temp-bucket") \
    .mode("overwrite") \
    .save()
```

### Example 2 — Read CSV & JSON with explicit schema
```python
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, TimestampType

schema = StructType([
    StructField("event_id", StringType(), False),
    StructField("user_id", StringType(), True),
    StructField("amount", DoubleType(), True),
    StructField("event_ts", TimestampType(), True),
])

df_csv = spark.read.csv("gs://bucket/events.csv", header=True, schema=schema)
df_json = spark.read.schema(schema).json("gs://bucket/events/*.json")
```

### Example 3 — Joins & window functions in Spark
```python
from pyspark.sql import functions as F
from pyspark.sql.window import Window

orders = spark.read.parquet("gs://bucket/orders")
users = spark.read.parquet("gs://bucket/users")

joined = orders.join(users, on="user_id", how="left")

w = Window.partitionBy("user_id").orderBy(F.col("order_ts").desc())
latest_order_per_user = joined.withColumn("rn", F.row_number().over(w)).filter("rn = 1")
```

### Example 4 — Reading directly from BigQuery into Spark
```python
df = spark.read.format("bigquery") \
    .option("table", "my_project.my_dataset.events") \
    .load()

df.createOrReplaceTempView("events")
result = spark.sql("SELECT country, COUNT(*) n FROM events GROUP BY country")
result.show()
```

### Example 5 — Writing to GCS in multiple formats
```python
result.write.mode("overwrite").parquet("gs://my-bucket/processed/event_counts")
result.write.mode("overwrite").option("header", True).csv("gs://my-bucket/processed/csv")
result.write.mode("append").format("avro").save("gs://my-bucket/processed/avro")
```

### Example 6 — Using Spark SQL with a persistent Metastore (Dataproc Metastore)
```python
spark = SparkSession.builder \
    .appName("metastore-job") \
    .config("spark.sql.catalogImplementation", "hive") \
    .enableHiveSupport() \
    .getOrCreate()

spark.sql("CREATE TABLE IF NOT EXISTS analytics.events (id STRING, amount DOUBLE) STORED AS PARQUET")
spark.sql("INSERT INTO analytics.events SELECT event_id, amount FROM events_view")
```

### Example 7 — UDFs in PySpark
```python
from pyspark.sql.functions import udf
from pyspark.sql.types import StringType

def normalize_country(code):
    return "Philippines" if code == "PH" else code

normalize_udf = udf(normalize_country, StringType())
df = df.withColumn("country_name", normalize_udf(df.country))
```

### Example 8 — Submitting a PySpark job with `--properties` tuning
```bash
gcloud dataproc jobs submit pyspark gs://bucket/job.py \
  --cluster=my-cluster --region=us-central1 \
  --properties=spark.executor.memory=8g,spark.executor.cores=4,spark.sql.shuffle.partitions=200
```

---

## 7. Storage: GCS as HDFS Replacement

- Use `gs://` paths directly in Spark/Hadoop jobs via the built-in **GCS connector** — no HDFS cluster needed.
- Decouples storage from compute → clusters can be ephemeral/disposable.
- For jobs needing HDFS semantics (small file writes, append), a local HDFS on cluster disks is still available but discouraged for persistence.

---

## 8. Initialization Actions (example)

```bash
gcloud dataproc clusters create my-cluster \
  --region=us-central1 \
  --initialization-actions=gs://goog-dataproc-initialization-actions-us-central1/python/pip-install.sh \
  --metadata='PIP_PACKAGES=pandas requests'
```

Custom init script example (`install-libs.sh`):
```bash
#!/bin/bash
pip install --upgrade pandas scikit-learn google-cloud-storage
```

---

## 9. Pricing

- **Compute Engine costs** for master/worker VMs (standard GCE pricing) + **Dataproc premium** (small per-vCPU-hour surcharge).
- Use **preemptible/Spot VMs** for worker nodes to cut costs significantly (not recommended for masters).
- **Dataproc Serverless** bills per DCU (Data Compute Unit) — no idle cluster cost at all.
- Ephemeral clusters (Workflow Templates) avoid paying for idle time between jobs.

---

## 10. Monitoring

- **YARN ResourceManager UI** & **Spark History Server** via Component Gateway.
- Cloud Monitoring metrics: cluster CPU/memory/disk, YARN pending memory (drives autoscaling).
- Cloud Logging: driver + executor logs, job output.

```python
# Fetch job status programmatically
job = job_client.get_job(request={"project_id": "my-project", "region": "us-central1", "job_id": "JOB_ID"})
print(job.status.state)
```

---

## 11. Common Gotchas

- Leaving standard clusters running idle is a top cost leak — use autoscaling to zero workers or ephemeral clusters.
- Master node is a single point of failure unless using HA mode (3 masters).
- Mixing on-demand and preemptible/spot workers requires YARN to tolerate node loss — checkpoint long jobs.
- Image version pinning matters — untested version bumps can break job compatibility (Spark/Hadoop version changes).
- Small-file problem: too many tiny files in GCS hurts Spark job planning performance — compact files first.
- Cross-region reads from GCS to a cluster in another region add latency + egress cost.
- Default `spark.sql.shuffle.partitions=200` is often wrong for your data size — tune per job.

---

## 12. Useful Links

- Docs: https://cloud.google.com/dataproc/docs
- Dataproc Serverless: https://cloud.google.com/dataproc-serverless/docs
- Pricing: https://cloud.google.com/dataproc/pricing
- Python client reference: https://cloud.google.com/python/docs/reference/dataproc/latest
