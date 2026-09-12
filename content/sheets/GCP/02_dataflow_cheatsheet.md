# Google Cloud Dataflow Cheatsheet

> Fully-managed, serverless service for executing **Apache Beam** batch and streaming data-processing pipelines.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Type | Managed execution engine for Apache Beam pipelines |
| Programming model | Unified batch + streaming (same API for both) |
| SDKs | Java, Python, Go (Beam SDKs) |
| Best for | Complex ETL/ELT, real-time stream processing, event-driven pipelines |
| Not for | Simple SQL transforms already expressible in BigQuery (use Dataform/scheduled queries instead — cheaper) |

---

## 2. Core Apache Beam Concepts

| Concept | Description |
|---|---|
| **Pipeline** | The full data-processing job (DAG of transforms) |
| **PCollection** | Distributed, immutable dataset flowing through the pipeline |
| **PTransform** | An operation applied to a PCollection (`Map`, `ParDo`, `GroupByKey`, `Combine`) |
| **Runner** | Executes the pipeline (DataflowRunner, DirectRunner for local testing) |
| **Window** | Slices an unbounded PCollection into finite chunks by time (fixed, sliding, session) |
| **Watermark** | Beam's estimate of "all data up to time T has arrived" — drives when windows close |
| **Trigger** | Controls *when* to emit results for a window (default, early, late data) |
| **Side Input** | Broadcast a small PCollection into another transform for lookups |
| **State & Timers** | Per-key persistent state for advanced streaming logic |

---

## 3. Batch vs Streaming

| | Batch | Streaming |
|---|---|---|
| Source | Bounded (GCS files, BQ tables) | Unbounded (Pub/Sub, Kafka) |
| Windowing | Optional (often global window) | Required for aggregations |
| Typical use | Nightly ETL, backfills | Real-time analytics, alerting |
| Autoscaling | Based on backlog/parallelism | Based on Pub/Sub backlog & CPU |

---

## 4. Architecture

```
 Source (GCS / Pub/Sub / BQ)
        │
        ▼
 ┌─────────────────────┐
 │  Dataflow Service    │  ← optimizes & orchestrates the job graph
 │  (control plane)     │
 └─────────┬────────────┘
           ▼
 ┌─────────────────────┐
 │  Worker VMs (Compute  │  ← autoscaled, run your Beam transforms
 │  Engine, managed)     │
 └─────────┬────────────┘
           ▼
 Sink (BigQuery / GCS / Pub/Sub / Bigtable)
```

- **Streaming Engine**: offloads shuffle/state to the service backend → smaller, cheaper workers.
- **Dataflow Shuffle** (batch): offloads shuffle for batch jobs off worker disks.
- **Flexible Resource Scheduling (FlexRS)**: cheaper batch via delayed scheduling + preemptible VMs.

---

## 5. gcloud CLI

```bash
# List jobs
gcloud dataflow jobs list --region=us-central1

# Job details
gcloud dataflow jobs describe JOB_ID --region=us-central1

# Cancel / drain
gcloud dataflow jobs cancel JOB_ID --region=us-central1
gcloud dataflow jobs drain JOB_ID --region=us-central1     # finish in-flight data first

# Run a classic template
gcloud dataflow jobs run my-job \
  --gcs-location=gs://dataflow-templates/latest/GCS_Text_to_BigQuery \
  --region=us-central1 \
  --parameters inputFilePattern=gs://bucket/input.csv,outputTable=proj:ds.table

# Run a Flex Template
gcloud dataflow flex-template run my-flex-job \
  --template-file-gcs-location=gs://bucket/templates/my-template.json \
  --region=us-central1 \
  --parameters input=gs://bucket/in,output=gs://bucket/out

# Update a running streaming job in place (same job graph, new code)
gcloud dataflow jobs update JOB_ID --region=us-central1 \
  --gcs-location=gs://bucket/templates/new-template.json
```

---

## 6. Python Beam SDK — Setup

```bash
pip install 'apache-beam[gcp]'
```

```python
from apache_beam.options.pipeline_options import PipelineOptions

options = PipelineOptions(
    runner="DataflowRunner",       # use "DirectRunner" for local testing
    project="my-project",
    region="us-central1",
    temp_location="gs://my-bucket/tmp",
    staging_location="gs://my-bucket/staging",
    job_name="my-etl-job",
    streaming=False,               # True for streaming pipelines
    save_main_session=True,        # needed if using global imports in DoFns
)
```

---

## 7. Example 1 — Basic Batch Pipeline (GCS → GCS)

```python
import apache_beam as beam

with beam.Pipeline(options=options) as p:
    (p
     | "Read" >> beam.io.ReadFromText("gs://my-bucket/input.csv", skip_header_lines=1)
     | "Parse" >> beam.Map(lambda line: line.split(","))
     | "Filter" >> beam.Filter(lambda row: row[2] == "PH")
     | "FormatOutput" >> beam.Map(lambda row: ",".join(row))
     | "Write" >> beam.io.WriteToText("gs://my-bucket/output", file_name_suffix=".csv"))
```

## 8. Example 2 — Streaming Pub/Sub → BigQuery

```python
import json
import apache_beam as beam

with beam.Pipeline(options=options) as p:
    (p
     | "ReadPubSub" >> beam.io.ReadFromPubSub(topic="projects/my-project/topics/events")
     | "Decode" >> beam.Map(lambda b: json.loads(b.decode("utf-8")))
     | "Window" >> beam.WindowInto(beam.window.FixedWindows(60))  # 1-min windows
     | "KeyByType" >> beam.Map(lambda e: (e["event_type"], 1))
     | "CountPerKey" >> beam.CombinePerKey(sum)
     | "FormatRow" >> beam.Map(lambda kv: {"event_type": kv[0], "count": kv[1]})
     | "WriteBQ" >> beam.io.WriteToBigQuery(
           "my-project:my_dataset.event_counts",
           schema="event_type:STRING,count:INTEGER",
           write_disposition=beam.io.BigQueryDisposition.WRITE_APPEND,
           create_disposition=beam.io.BigQueryDisposition.CREATE_IF_NEEDED))
```

## 9. Example 3 — Custom `DoFn` with Side Input (enrichment lookup)

```python
class EnrichRow(beam.DoFn):
    def process(self, element, lookup):
        element["country_name"] = lookup.get(element["country_code"], "Unknown")
        yield element

with beam.Pipeline(options=options) as p:
    lookup_pcoll = (p | "ReadLookup" >> beam.io.ReadFromText("gs://bucket/countries.csv")
                      | "ParseLookup" >> beam.Map(lambda l: tuple(l.split(","))))

    rows = (p | "ReadRows" >> beam.io.ReadFromText("gs://bucket/events.csv")
              | "ParseRows" >> beam.Map(lambda l: dict(zip(["country_code", "amount"], l.split(",")))))

    enriched = rows | "Enrich" >> beam.ParDo(EnrichRow(), lookup=beam.pvalue.AsDict(lookup_pcoll))
    enriched | "Write" >> beam.io.WriteToText("gs://bucket/enriched")
```

## 10. Example 4 — Branching Pipeline (multiple outputs from one source)

```python
with beam.Pipeline(options=options) as p:
    events = p | "Read" >> beam.io.ReadFromText("gs://bucket/events.csv")

    purchases = events | "FilterPurchases" >> beam.Filter(lambda l: "purchase" in l)
    views     = events | "FilterViews"     >> beam.Filter(lambda l: "view" in l)

    purchases | "WritePurchases" >> beam.io.WriteToText("gs://bucket/purchases")
    views     | "WriteViews"     >> beam.io.WriteToText("gs://bucket/views")
```

## 11. Example 5 — CoGroupByKey (joining two PCollections)

```python
orders = p | "ReadOrders" >> beam.io.ReadFromText("gs://bucket/orders.csv") \
           | "KeyOrders" >> beam.Map(lambda l: (l.split(",")[0], l))     # key by user_id
users  = p | "ReadUsers"  >> beam.io.ReadFromText("gs://bucket/users.csv") \
           | "KeyUsers"   >> beam.Map(lambda l: (l.split(",")[0], l))

joined = ({"orders": orders, "users": users}
          | "CoGroup" >> beam.CoGroupByKey()
          | "FormatJoin" >> beam.Map(lambda kv: (kv[0], kv[1]["orders"], kv[1]["users"])))
```

## 12. Example 6 — Windowing, Triggers & Late Data (streaming)

```python
import apache_beam as beam
from apache_beam.transforms.trigger import AfterWatermark, AfterProcessingTime, AccumulationMode

windowed = (events
    | "FixedWindow" >> beam.WindowInto(
        beam.window.FixedWindows(300),                      # 5-min windows
        trigger=AfterWatermark(early=AfterProcessingTime(60)),  # emit early results every 60s
        accumulation_mode=AccumulationMode.ACCUMULATING,
        allowed_lateness=beam.window.Duration(seconds=3600)) # accept up to 1h late data
    | "CountPerWindow" >> beam.combiners.Count.PerKey())

# Session windows (group bursts of activity per user)
sessions = (events
    | "SessionWindow" >> beam.WindowInto(beam.window.Sessions(gap_size=600)))  # 10-min gap
```

## 13. Example 7 — Dead-Letter Pattern (handling bad records)

```python
class SafeParse(beam.DoFn):
    OUTPUT_TAG_ERRORS = "errors"

    def process(self, element):
        try:
            yield json.loads(element)
        except Exception as e:
            yield beam.pvalue.TaggedOutput(self.OUTPUT_TAG_ERRORS, {"raw": element, "error": str(e)})

results = (p | "Read" >> beam.io.ReadFromPubSub(topic="projects/my-project/topics/events")
             | "Parse" >> beam.ParDo(SafeParse()).with_outputs(SafeParse.OUTPUT_TAG_ERRORS, main="parsed"))

results.parsed | "WriteGood" >> beam.io.WriteToBigQuery("my_dataset.events")
results.errors | "WriteDeadLetter" >> beam.io.WriteToBigQuery("my_dataset.events_errors")
```

## 14. Example 8 — Reading from BigQuery & Writing to Bigtable

```python
from apache_beam.io.gcp.bigquery import ReadFromBigQuery
from apache_beam.io.gcp.bigtableio import WriteToBigTable

rows = p | "ReadBQ" >> ReadFromBigQuery(query="SELECT * FROM `my_dataset.events`", use_standard_sql=True)

def to_bigtable_row(record):
    from google.cloud.bigtable.row import DirectRow
    row = DirectRow(row_key=record["event_id"].encode())
    row.set_cell("cf1", "country", record["country"])
    return row

(rows
 | "ToBigtableRow" >> beam.Map(to_bigtable_row)
 | "WriteBigtable" >> WriteToBigTable(project_id="my-project", instance_id="my-instance", table_id="events"))
```

## 15. Example 9 — Testing a Pipeline Locally (`DirectRunner` + `TestPipeline`)

```python
import unittest
import apache_beam as beam
from apache_beam.testing.test_pipeline import TestPipeline
from apache_beam.testing.util import assert_that, equal_to

class PipelineTest(unittest.TestCase):
    def test_filter_ph(self):
        with TestPipeline() as p:
            input_data = p | beam.Create([{"country": "PH"}, {"country": "US"}])
            output = input_data | beam.Filter(lambda x: x["country"] == "PH")
            assert_that(output, equal_to([{"country": "PH"}]))

if __name__ == "__main__":
    unittest.main()
```

## 16. Example 10 — Custom Pipeline Options (your own CLI args)

```python
from apache_beam.options.pipeline_options import PipelineOptions

class MyOptions(PipelineOptions):
    @classmethod
    def _add_argparse_args(cls, parser):
        parser.add_argument("--input_table", required=True)
        parser.add_argument("--output_table", required=True)

opts = MyOptions()
custom = opts.view_as(MyOptions)
print(custom.input_table, custom.output_table)
```

## 17. Example 11 — Launching a Job from Python (no `gcloud` needed)

```python
import apache_beam as beam

pipeline_options = PipelineOptions(
    runner="DataflowRunner", project="my-project", region="us-central1",
    temp_location="gs://my-bucket/tmp",
)
with beam.Pipeline(options=pipeline_options) as p:
    (p | beam.io.ReadFromText("gs://bucket/in.csv")
       | beam.Map(str.upper)
       | beam.io.WriteToText("gs://bucket/out"))
# Running this script directly submits and (with DataflowRunner) returns immediately;
# use p.run().wait_until_finish() outside the `with` block if you need to block.
```

---

## 18. Templates

| Type | Description |
|---|---|
| **Classic templates** | Pre-staged pipeline graph (JSON); parameters fixed at staging time |
| **Flex templates** | Packaged as a Docker container; more flexible parameters, supports custom dependencies |
| **Google-provided templates** | Ready-made (GCS→BQ, Pub/Sub→BQ, JDBC→BQ, etc.) — great for simple pipelines with zero code |

---

## 19. Performance & Autoscaling

- **Horizontal autoscaling**: adjusts worker count based on backlog/CPU (streaming) or throughput (batch).
- **Vertical scaling**: choose appropriate `--machine_type` (e.g., `n2-standard-4`).
- Use **Streaming Engine** (`--enable_streaming_engine`) to reduce worker resource needs.
- Avoid large **side inputs** — they must fit in worker memory.
- Combine small files before processing (`ReadFromText` with wildcard can create many small bundles).
- Use `--number_of_worker_harness_threads` and `--experiments=use_runner_v2` for tuning.

---

## 20. Pricing

Billed per **vCPU, memory, and Persistent Disk** consumed by workers, per second, based on:
- Worker machine type & count (with autoscaling)
- Streaming Engine adds a small resource-based surcharge but reduces total worker needs
- Shuffle/Dataflow Prime resources billed separately

💡 Use **FlexRS** for non-urgent batch jobs to cut costs (~40% savings via delayed, preemptible scheduling).

---

## 21. Monitoring

- **Dataflow job graph UI**: visualize stages, throughput, and bottlenecks per step.
- **Cloud Monitoring metrics**: `system_lag`, `data_freshness`, CPU utilization, backlog bytes.
- **Cloud Logging**: worker + job logs, filterable by step.
- Set up **alerts** on `system_lag` growing unbounded → sign of an under-provisioned streaming job.

---

## 22. Common Gotchas

- Forgetting `--streaming` flag turns a Pub/Sub pipeline into an (invalid) batch job.
- Non-deterministic `DoFn` code can cause duplicate processing on retries — aim for idempotency.
- Large side inputs cause worker OOM — use `beam.pvalue.AsSingleton`/lookups via external cache (e.g., Bigtable) instead.
- Draining vs Cancelling: **drain** finishes in-flight windows; **cancel** drops them immediately.
- Schema mismatches to BigQuery sinks fail the whole bundle — validate schemas upstream.
- Watermark stuck due to one slow/stalled source partition delays all downstream windows.
- `save_main_session=True` is required if a `DoFn` references globally-imported modules — otherwise workers raise `NameError`.

---

## 23. Useful Links

- Docs: https://cloud.google.com/dataflow/docs
- Apache Beam docs: https://beam.apache.org/documentation/
- Google-provided templates: https://cloud.google.com/dataflow/docs/guides/templates/provided-templates
- Python SDK reference: https://beam.apache.org/releases/pydoc/current/
