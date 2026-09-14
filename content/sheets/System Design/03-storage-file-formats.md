# Storage & File Formats — System Design for Data Engineers

> Parquet vs. ORC vs. Avro, partitioning, the small-file problem, and where lakehouse vs.
> warehouse vs. lake actually sit relative to each other — a spectrum, not three separate boxes.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Quick-Reference Table: File Formats](#quick-reference-table-file-formats)
3. [Row-Based vs. Columnar: Measured, Not Just Asserted](#row-based-vs-columnar-measured-not-just-asserted)
4. [Column Pruning & Predicate Pushdown](#column-pruning--predicate-pushdown)
5. [Partitioning & Bucketing](#partitioning--bucketing)
6. [The Small-Files Problem](#the-small-files-problem)
7. [Compaction](#compaction)
8. [Data Lake vs. Warehouse vs. Lakehouse](#data-lake-vs-warehouse-vs-lakehouse)
9. [Clustering/Z-Ordering: Measured Impact on Pruning](#clusteringz-ordering-measured-impact-on-pruning)
10. [Table Format Comparison: Delta Lake vs. Iceberg vs. Hudi](#table-format-comparison-delta-lake-vs-iceberg-vs-hudi)
11. [Row Group Size Tuning](#row-group-size-tuning)
12. [Choosing a Format: Decision Table](#choosing-a-format-decision-table)
13. [Gotchas](#gotchas)
14. [Pro Tips](#pro-tips)

---

## Core Concepts

Storage design in a DE system design interview usually comes down to three interacting
decisions: **file format** (how bytes are laid out on disk), **partitioning/bucketing** (how
files are organized into directories/groups), and **platform** (lake, warehouse, or
lakehouse). Get these three right and query performance, cost, and operational headaches
mostly take care of themselves; get them wrong and no amount of compute thrown at the
problem fully compensates.

## Quick-Reference Table: File Formats

| Format | Layout | Best For | Weak For | Compression | Schema Evolution |
|---|---|---|---|---|---|
| **CSV/JSON** | Row-based, text | Interop, small/ad-hoc data, human readability | Analytics at scale, storage cost | Poor (text) | None built-in |
| **Avro** | Row-based, binary | Write-heavy pipelines, streaming (Kafka payloads), full-row reads | Analytical scans (must read whole row) | Good | Excellent (schema in every file, backward/forward compatible) |
| **Parquet** | Columnar, binary | Analytical scans, BI/warehouse queries, column pruning | Frequent small updates, single-row lookups | Excellent (per-column encoding + Snappy/ZSTD) | Good (nested/optional fields, additive changes) |
| **ORC** | Columnar, binary | Similar to Parquet, historically tied to Hive/Hadoop ecosystem | Same weaknesses as Parquet | Excellent (often edges out Parquet slightly) | Good |

## Row-Based vs. Columnar: Measured, Not Just Asserted

The usual claim is "columnar formats compress better and prune columns you don't need." Here
it is actually measured on 50,000 synthetic event rows (user_id, event_type, country, amount,
timestamp):

```python
import io
import random
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

random.seed(42)
n = 50_000
df = pd.DataFrame({
    "user_id": [random.randint(1, 100_000) for _ in range(n)],
    "event_type": [random.choice(["view", "click", "purchase", "add_to_cart"]) for _ in range(n)],
    "country": [random.choice(["US", "PH", "SG", "JP", "DE", "BR"]) for _ in range(n)],
    "amount": [round(random.uniform(1, 500), 2) for _ in range(n)],
    "event_ts": pd.date_range("2026-01-01", periods=n, freq="s"),
})

csv_bytes = df.to_csv(index=False).encode()
json_bytes = df.to_json(orient="records", lines=True, date_format="iso").encode()

table = pa.Table.from_pandas(df)
buf = io.BytesIO()
pq.write_table(table, buf, compression="snappy")
parquet_bytes = buf.getvalue()

print(f"Rows: {n}")
print(f"CSV size:        {len(csv_bytes)/1024:.1f} KB")
print(f"JSON-lines size: {len(json_bytes)/1024:.1f} KB")
print(f"Parquet(snappy): {len(parquet_bytes)/1024:.1f} KB")
print(f"Compression vs CSV: {len(csv_bytes)/len(parquet_bytes):.1f}x smaller")
```

Output:

```
Rows: 50000
CSV size:        2128.2 KB
JSON-lines size: 4716.0 KB
Parquet(snappy): 935.2 KB
Compression vs CSV: 2.3x smaller
```

Even with only 5 columns and modest cardinality, Parquet is already ~2.3x smaller than CSV and
~5x smaller than JSON-lines — and the gap widens further with more columns, higher-cardinality
repetition, and a stronger codec (ZSTD instead of Snappy typically adds another 20-40%).

## Column Pruning & Predicate Pushdown

The bigger win over raw size is **not reading data you don't need**:

```python
# Reading only the "amount" column out of a 5-column Parquet file --
# pyarrow only decodes the requested column's byte range, not the whole row.
col_only = pq.read_table(io.BytesIO(parquet_bytes), columns=["amount"])
print("Column-pruned read row count:", col_only.num_rows)
```

Output:

```
Column-pruned read row count: 50000
```

A row-based format (Avro/CSV/JSON) has no equivalent — to get the `amount` column you must
read and deserialize every field of every row. **Predicate pushdown** extends this: Parquet
stores per-row-group min/max statistics, so a query filtering `WHERE event_ts > '2026-06-01'`
can skip entire row groups (or entire files, if partitioned) without reading them at all.

## Partitioning & Bucketing

**Partitioning** splits data into directories by a low/medium-cardinality column, typically a
date: `s3://bucket/events/dt=2026-09-01/`, `dt=2026-09-02/`, etc. A query filtering on `dt`
only touches matching partitions — this is *partition pruning*, and it's usually the single
highest-leverage design decision in this category, because it turns a full-table scan into a
scan of just the relevant slice.

**Bucketing** (a.k.a. clustering) hashes a higher-cardinality column (e.g. `user_id`) into a
fixed number of buckets *within* each partition, so joins/aggregations on that column don't
need a full shuffle — rows with the same key already live together.

```python
def partition_path(base: str, dt: str, hour: int = None, country: str = None) -> str:
    """Common partitioning scheme: date first (coarsest, most commonly filtered),
    then optionally hour, then a lower-cardinality dimension like country."""
    parts = [base, f"dt={dt}"]
    if hour is not None:
        parts.append(f"hour={hour:02d}")
    if country is not None:
        parts.append(f"country={country}")
    return "/".join(parts)


print(partition_path("s3://events", dt="2026-09-13", hour=14, country="PH"))
```

Output:

```
s3://events/dt=2026-09-13/hour=14/country=PH
```

**Rule of thumb for partition column choice**: partition on what queries filter on *most
often and most selectively* — usually ingestion date. Avoid partitioning on very high
cardinality columns (e.g. `user_id` directly) since that produces the small-files problem
below; use bucketing for those instead.

## The Small-Files Problem

Splitting the same total data into more files multiplies fixed per-file overhead — footer
metadata, file-open costs, and (in distributed engines) per-file task scheduling overhead —
without adding any actual data value:

```python
def simulate_small_files(total_rows: int, num_files: int, per_file_overhead_bytes: int = 1024) -> dict:
    """Rough model: per-file overhead (Parquet footer, object-store metadata, engine
    per-file task scheduling) is roughly fixed regardless of how much data is inside."""
    rows_per_file = total_rows / num_files
    total_overhead = num_files * per_file_overhead_bytes
    return {
        "num_files": num_files,
        "rows_per_file": rows_per_file,
        "total_metadata_overhead_KB": round(total_overhead / 1024, 2),
    }


for k in [1, 100, 10_000, 1_000_000]:
    print(simulate_small_files(total_rows=10_000_000, num_files=k))
```

Output:

```
{'num_files': 1, 'rows_per_file': 10000000.0, 'total_metadata_overhead_KB': 1.0}
{'num_files': 100, 'rows_per_file': 100000.0, 'total_metadata_overhead_KB': 100.0}
{'num_files': 10000, 'rows_per_file': 1000.0, 'total_metadata_overhead_KB': 10000.0}
{'num_files': 1000000, 'rows_per_file': 10.0, 'total_metadata_overhead_KB': 1000000.0}
```

At 1,000,000 files for the same 10M rows, you're carrying ~1GB of pure metadata overhead for
data that would otherwise fit in a handful of well-sized files — and in a distributed engine
each file typically also means a separate task, so query planning/scheduling overhead grows
right alongside it. This is exactly what happens when streaming jobs write one small file per
micro-batch without a compaction step downstream.

## Compaction

Compaction periodically rewrites many small files into fewer, larger ones (typically
targeting 128MB–1GB per file, depending on the engine). It's a background maintenance job,
not a one-time fix — streaming ingestion will keep producing small files, so compaction has
to run continuously or on a schedule.

```python
def files_needed_for_target_size(total_bytes: int, target_file_bytes: int = 256 * 1024 * 1024) -> int:
    """How many files you'd want after compaction, given a target file size."""
    import math
    return max(1, math.ceil(total_bytes / target_file_bytes))


daily_bytes = 50 * 1024**3  # 50 GB/day
print("Target file count after compaction:", files_needed_for_target_size(daily_bytes))
```

Output:

```
Target file count after compaction: 200
```

Modern table formats (Delta Lake, Iceberg, Hudi) provide built-in compaction commands
(`OPTIMIZE`, rewrite actions) that handle this without a bespoke Spark job — worth naming in
an interview as the "boring, correct" answer rather than describing a hand-rolled compaction
service.

## Data Lake vs. Warehouse vs. Lakehouse

These are best understood as points on a spectrum of *how structured/managed the storage
layer is*, not three unrelated products:

```
Data Lake                    Lakehouse                    Data Warehouse
────────────                 ──────────                   ───────────────
Raw files (any format)   →   Open table format on top   →  Fully managed storage
on cheap object storage      of lake files (Delta/          + compute, proprietary
                              Iceberg/Hudi): ACID,           internal format
No schema enforcement         schema enforcement,           Schema enforced,
                               time travel, upserts           strong consistency
Cheapest, most flexible   →   Warehouse-like guarantees  →  Best performance/ease,
Compute-engine agnostic       + lake-like openness            least flexible/most $
```

- **Data lake**: cheapest and most flexible, but no transactional guarantees — concurrent
  writers can corrupt state, and there's no built-in schema enforcement.
- **Lakehouse**: adds a transaction log + metadata layer (Delta Lake, Apache Iceberg, Apache
  Hudi) on top of plain lake files, giving ACID transactions, time travel, and schema
  enforcement while keeping data in open formats that any engine can read.
- **Data warehouse**: fully managed, usually best out-of-the-box performance and simplest
  operational model, but storage is typically in a proprietary internal format and less
  portable across engines.

Most modern architectures land on lakehouse or a warehouse-with-external-tables hybrid,
specifically because it lets the same curated data serve both SQL analytics and ML training
without duplicating it into two storage systems.

## Clustering/Z-Ordering: Measured Impact on Pruning

Partitioning handles coarse-grained pruning (by date, say), but a query filtering on a
different, higher-cardinality column (like `user_id`) gets no help from date partitioning
alone. **Clustering** (Delta Lake's `Z-ORDER`, Databricks liquid clustering, or simply
sorting data before writing) co-locates similar values physically, so a query's predicate
can skip entire row groups whose min/max range doesn't overlap what it's looking for. Here
it is actually measured — the same 200,000 rows, written once in random order and once
sorted by `user_id`, then asking how many row groups a query for a narrow `user_id` range
would need to touch:

```python
import io
import random
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

random.seed(1)
n = 200_000

df_unsorted = pd.DataFrame({
    "user_id": [random.randint(1, 1_000_000) for _ in range(n)],
    "amount": [round(random.uniform(1, 500), 2) for _ in range(n)],
})
df_sorted = df_unsorted.sort_values("user_id").reset_index(drop=True)

def write_with_row_groups(df, row_group_size=10_000):
    table = pa.Table.from_pandas(df)
    buf = io.BytesIO()
    pq.write_table(table, buf, row_group_size=row_group_size, compression="snappy")
    return buf.getvalue()

unsorted_bytes = write_with_row_groups(df_unsorted)
sorted_bytes = write_with_row_groups(df_sorted)

def row_groups_needed_for_range(parquet_bytes, col, lo, hi):
    """Counts how many row groups' min/max stats overlap the queried range -- exactly
    what a query engine's predicate pushdown does to decide which row groups to read."""
    pf = pq.ParquetFile(io.BytesIO(parquet_bytes))
    needed = 0
    for i in range(pf.num_row_groups):
        rg_meta = pf.metadata.row_group(i)
        col_idx = [rg_meta.column(j).path_in_schema for j in range(rg_meta.num_columns)].index(col)
        stats = rg_meta.column(col_idx).statistics
        if stats is not None and stats.min <= hi and stats.max >= lo:
            needed += 1
    return needed, pf.num_row_groups

query_lo, query_hi = 500_000, 500_100  # a narrow user_id range
needed_unsorted, total_unsorted = row_groups_needed_for_range(unsorted_bytes, "user_id", query_lo, query_hi)
needed_sorted, total_sorted = row_groups_needed_for_range(sorted_bytes, "user_id", query_lo, query_hi)

print(f"Unsorted: {needed_unsorted}/{total_unsorted} row groups would need to be read")
print(f"Sorted/clustered: {needed_sorted}/{total_sorted} row groups would need to be read")
```

Output:

```
Unsorted: 20/20 row groups would need to be read
Sorted/clustered: 1/20 row groups would need to be read
```

Same data, same query — clustering by the filtered column takes this from reading **every**
row group to reading **one out of twenty**. This is exactly the mechanism behind Delta
Lake's `OPTIMIZE ... ZORDER BY (user_id)` and Databricks liquid clustering: they reorganize
existing data to make future filters on that column dramatically cheaper, without changing
the partitioning scheme at all. It's the natural answer to "the query pattern filters on a
column we can't partition by (too high cardinality) — what else can we do?"

## Table Format Comparison: Delta Lake vs. Iceberg vs. Hudi

The three dominant lakehouse table formats solve the same core problem (ACID transactions
and schema/time-travel on top of plain files) with different trade-offs:

| | Delta Lake | Apache Iceberg | Apache Hudi |
|---|---|---|---|
| **Origin** | Databricks | Netflix | Uber |
| **Primary strength** | Deepest integration with Spark/Databricks ecosystem | Engine-agnostic design, strong multi-engine support (Spark, Trino, Flink, Snowflake) | Strong support for incremental/streaming upserts, "merge-on-read" for low-latency writes |
| **Update model** | Copy-on-write by default (rewrite affected files), merge-on-read available | Copy-on-write or merge-on-read, configurable per table | Copy-on-write or merge-on-read, historically its core differentiator |
| **Clustering** | `OPTIMIZE ... ZORDER BY` | Sort order + partition evolution | Clustering service |
| **Best fit** | Teams already standardized on Databricks | Teams wanting maximum engine portability | Teams with heavy CDC/streaming-upsert workloads wanting minimal write latency |

**Interview-level takeaway**: don't over-index on picking "the right one" — all three solve
the ACID-on-lake-files problem; the differentiator that actually matters for a design
answer is **copy-on-write vs. merge-on-read**: copy-on-write makes reads fast (data is
always fully compacted) but writes/updates more expensive (must rewrite files); merge-on-read
makes writes cheap (append a delta, apply on read) at the cost of read-time overhead until
compaction catches up. Naming this trade-off explicitly is worth more than naming a specific
product.

## Row Group Size Tuning

Parquet row group size is itself a tunable trade-off, not a fixed constant:

| Row Group Size | Effect |
|---|---|
| Too small (e.g. a few KB) | More metadata overhead per byte of actual data (small-files problem, but *within* a single file); less effective compression (less repetition to exploit per group) |
| Too large (e.g. several GB) | Less granular pruning — a query touching even one row in a giant row group must read the whole group; higher memory pressure per read |
| Typical sweet spot | 128MB-1GB per row group is a common default range, tuned down for highly selective point-lookup-style queries and up for large sequential scans |

## Choosing a Format: Decision Table

| Situation | Recommended Format |
|---|---|
| Kafka message payloads / streaming pipelines | Avro (compact, schema registry integration, row-oriented matches per-message processing) |
| Analytical tables queried by BI tools / warehouses | Parquet (or ORC in Hive-heavy shops) |
| Interop with an external partner with no format preference | CSV/JSON, but convert to Parquet immediately on ingestion for internal use |
| Frequently-updated dimension tables | Lakehouse format (Delta/Iceberg/Hudi) with merge/upsert support, not raw Parquet |
| ML training data | Parquet, often partitioned by a training-relevant key (e.g. date range) rather than a serving-relevant key |

## Gotchas

- Partitioning on a high-cardinality column (e.g. raw `user_id`) creates millions of tiny
  partitions — this is the small-files problem wearing a different hat.
- Over-partitioning (e.g. partitioning by `dt` **and** `hour` **and** `country` **and**
  `event_type` all at once) can produce so many partition combinations that partition
  *pruning itself* becomes slow due to sheer metadata volume — there's a real ceiling.
  A common guideline: keep partition counts in the thousands, not millions.
  large tables.
- Compaction isn't optional maintenance — skipping it on a continuously-streamed lakehouse
  table degrades query performance over weeks/months in a way that's easy to miss until
  someone asks "why did this query get so much slower?"
- Row-based formats aren't strictly worse — they're the right choice for streaming/write-heavy
  paths precisely because you usually process one full record at a time there.
- "Schema evolution support" varies a lot between formats even within the same family —
  Avro's is the most mature (explicit reader/writer schema resolution); Parquet's is more
  limited (safe additive changes, but renaming/reordering columns is riskier).

## Pro Tips

- When asked "what file format would you use," always answer with the *access pattern*
  first ("this is a write-heavy streaming path, so I'd use Avro into Kafka, then convert to
  Parquet during the batch/streaming write to the lakehouse") rather than naming a format in
  isolation.
- Mention compaction proactively when you describe a streaming write path — interviewers
  often use "and how do you deal with all those small files?" as a planned follow-up.
- Frame lake/lakehouse/warehouse as a spectrum with an explicit trade-off (flexibility/cost
  vs. performance/ease) rather than reciting three independent definitions — it signals you
  understand *why* lakehouse architectures emerged, not just what they are.
- If the interviewer pushes on partition design, have a concrete default ready: partition by
  ingestion date, bucket by a high-cardinality join key, and compact on a schedule.
