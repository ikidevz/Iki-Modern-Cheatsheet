# Spark Architecture & Runtime Cheatsheet

> How Spark actually executes your code on a Databricks cluster — driver, executors, memory internals, DAGs, and the Databricks Runtime enhancements on top of open-source Spark.

---

## 1. Cluster Roles

| Role | Responsibility |
|------|-----------------|
| **Driver** | Runs your `main()`/notebook code, builds the DAG, negotiates resources, schedules tasks, collects results, serves the Spark UI |
| **Executors** | JVM processes on worker nodes that run tasks and store data (cache/shuffle) |
| **Cluster Manager** | Allocates resources across nodes — on Databricks this is handled automatically behind the scenes |

```
┌────────────────────────┐
│         Driver          │  ← runs your notebook/script, builds DAG, schedules tasks
└────────────┬────────────┘
             │ sends tasks, receives status/results
   ┌─────────┼─────────┐
   ▼         ▼         ▼
┌──────┐ ┌──────┐  ┌──────┐
│Exec 1│ │Exec 2│  │Exec 3│   ← each has N cores, runs tasks in parallel, holds cached/shuffle data
└──────┘ └──────┘  └──────┘
```

- **Executor cores** = number of concurrent tasks it can run simultaneously.
- **Executor memory** is divided (per the Unified Memory Manager) into:
  - **Execution memory** — used for shuffles, joins, sorts, aggregations
  - **Storage memory** — used for cached DataFrames/RDDs
  - **User memory** — used for your own data structures/objects (e.g., inside UDFs)
  - **Reserved memory** — fixed overhead Spark keeps for internal bookkeeping
  - Execution and storage memory share a **unified region** and can borrow from each other dynamically (`spark.memory.fraction`, `spark.memory.storageFraction`), which is why a big `.cache()` can evict cached blocks under execution memory pressure.

---

## 2. Execution Model: Jobs → Stages → Tasks

| Level | Trigger | Description |
|-------|---------|--------------|
| **Application** | Cluster attach / notebook session | The whole SparkSession lifetime |
| **Job** | An action (`.count()`, `.write()`, `.collect()`) | The full unit of work for one action |
| **Stage** | A shuffle boundary | Sequence of transformations that can run without moving data across the network |
| **Task** | One per data partition | Smallest unit of work, run on one executor core |

**Transformations** (lazy — build the DAG but don't execute):
- **Narrow**: `select`, `filter`, `withColumn`, `map`, `union` — each output partition depends on only one input partition, no shuffle needed
- **Wide**: `groupBy`, `join` (non-broadcast), `distinct`, `repartition`, `orderBy` — output partitions depend on multiple input partitions, **requires a shuffle**

**Actions** (trigger execution): `count`, `collect`, `show`, `write`, `take`, `foreach`, `toPandas`

> Spark builds a **DAG (Directed Acyclic Graph)** of transformations and only executes when an action is called (lazy evaluation) — this enables the Catalyst optimizer to see the *whole* query before deciding how to run it, rather than executing operations one at a time as they're written.

### Why Laziness Matters
Because nothing runs until an action, you can chain `.filter()` → `.select()` → `.join()` freely and Spark will **reorder and fuse** these operations (e.g., pushing filters below joins) before ever touching data. This is fundamentally different from eager, row-by-row processing engines (like pandas) and is the reason Spark code that "looks" inefficient is often automatically rewritten into an efficient plan.

---

## 3. Catalyst Optimizer & Query Planning

Every DataFrame/SQL query passes through these phases:

1. **Unresolved Logical Plan** — parsed from SQL/DataFrame code, table/column references not yet validated
2. **Resolved (Analyzed) Logical Plan** — references validated against the catalog (Unity Catalog / Hive Metastore), types checked
3. **Optimized Logical Plan** — rule-based optimizations applied: predicate pushdown, constant folding, column pruning, boolean simplification, null propagation
4. **Physical Plan(s)** — one or more candidate execution strategies generated (e.g., which join algorithm)
5. **Cost Model** selects the best physical plan using table/column statistics when available
6. **Whole-Stage Code Generation** — compiles chains of operators into optimized JVM bytecode, avoiding virtual function call overhead row-by-row

```sql
EXPLAIN FORMATTED SELECT * FROM sales WHERE region = 'APAC';
EXPLAIN COST SELECT ...;             -- shows the cost-based plan with stats
EXPLAIN EXTENDED SELECT ...;         -- shows every plan phase, useful for debugging
```

### Reading an EXPLAIN Plan (What to Look For)
- **`PushedFilters`** in a scan node → predicate pushdown is working (filter applied at the storage layer, not after reading everything)
- **`BroadcastHashJoin` vs. `SortMergeJoin`** → confirms which join strategy was actually chosen
- **`Exchange`** nodes → mark shuffle boundaries; count them to estimate shuffle cost
- **`*(N)` prefix** on operators → whole-stage codegen stage number; operators sharing a number were fused into one compiled unit

---

## 4. Adaptive Query Execution (AQE)

AQE re-optimizes the physical plan **during** execution using real runtime statistics gathered from completed shuffle stages — enabled by default in Databricks Runtime.

| Feature | What it fixes | Config |
|---------|-----------------|--------|
| **Dynamically coalescing shuffle partitions** | Too many small post-shuffle partitions from an overestimated `shuffle.partitions` | `spark.sql.adaptive.coalescePartitions.enabled` |
| **Dynamically switching join strategies** | Converts sort-merge join → broadcast join if a side turns out smaller than expected at runtime | `spark.sql.adaptive.enabled` |
| **Dynamically optimizing skew joins** | Splits skewed partitions into smaller sub-partitions to prevent one task from dominating | `spark.sql.adaptive.skewJoin.enabled` |
| **Dynamic Partition Pruning (DPP)** | Avoids scanning partitions of a large table that can't possibly join with a filtered small table (common in star-schema joins) | `spark.sql.optimizer.dynamicPartitionPruning.enabled` |

```python
spark.conf.set("spark.sql.adaptive.enabled", "true")            # default: true
spark.conf.set("spark.sql.adaptive.skewJoin.enabled", "true")
spark.conf.set("spark.sql.adaptive.coalescePartitions.enabled", "true")
```

**Why it matters:** before AQE, Spark had to commit to a physical plan based only on *estimated* (often stale or wrong) statistics gathered before execution. AQE observes the *actual* size of intermediate shuffle output and re-plans downstream stages accordingly — this alone fixes a large fraction of "why did Spark pick a bad join strategy" problems.

---

## 5. Photon Engine

Photon is Databricks' native, vectorized C++ execution engine — a **drop-in replacement** for the JVM Spark execution layer for supported operators, without requiring any code changes.

- **Vectorized processing**: operates on batches of column values at once (SIMD-friendly) rather than row-by-row, dramatically reducing per-row interpretation overhead.
- Accelerates: scans, filters, aggregations, joins, sorts, window functions, `MERGE`/`UPDATE`/`DELETE`, and writes.
- Enabled per-cluster/warehouse via a runtime toggle; no code changes required.
- **Falls back to standard Spark JVM execution automatically** for any operator it doesn't yet support, so correctness is never at risk — only whether you get the speedup.
- Typically shows the largest gains on **I/O + CPU intensive, SQL-shaped workloads** (aggregations, joins, wide scans); gains are smaller for workloads dominated by Python UDFs or ML training, since those don't run through the SQL engine at all.

```python
# Check if a cluster is Photon-enabled: look for the runtime name suffix
# e.g. "15.4 LTS (includes Apache Spark 3.5.0, Scala 2.12) — Photon"
spark.conf.get("spark.databricks.photon.enabled")
```

---

## 6. Partitions & Parallelism

| Concept | Detail |
|---------|--------|
| **Input partitions** | Determined by file splits (roughly block/file size) when reading, tunable via `spark.sql.files.maxPartitionBytes` |
| **Shuffle partitions** | Controlled by `spark.sql.shuffle.partitions` (default 200); AQE's `coalescePartitions` can reduce this automatically at runtime |
| **Ideal partition size** | ~128 MB–1 GB per partition is a common target; aim for at least `2–4x` the total number of cores so the cluster stays busy across the whole stage |
| **Too many partitions** | Task scheduling/serialization overhead dominates actual compute time |
| **Too few partitions** | Under-utilized cluster (idle cores), larger shuffle spill per task, higher risk of OOM on any single task |

```python
df.rdd.getNumPartitions()
df.repartition(200)             # full shuffle, even distribution across N partitions
df.repartition("col")           # hash-partition by column value (useful before a join on that column)
df.repartitionByRange("col")    # range-partition, useful before range-based operations
df.coalesce(10)                 # narrow transformation, reduces partitions without a full shuffle (fast, but can create uneven sizes)
```

> `coalesce()` is not simply a "cheaper `repartition()`" — it merges existing partitions in place, so it **cannot increase** partition count and can produce **uneven** partition sizes if the input was already skewed.

---

## 7. Shuffles — What Triggers Them, and Why They're Expensive

| Operation | Shuffle? |
|-----------|----------|
| `groupBy().agg()` | ✅ |
| `join()` (non-broadcast) | ✅ |
| `distinct()` | ✅ |
| `orderBy()` / `sort()` | ✅ |
| `repartition()` | ✅ |
| `map`, `filter`, `select`, `withColumn` | ❌ (narrow transformations) |
| `coalesce()` (reducing only) | ❌ (usually — no network shuffle, just partition merging) |
| broadcast join | ❌ on the large side (small side is broadcast, not shuffled) |

A shuffle involves: **serializing** data on the source executors, **writing** shuffle files to local disk, **transferring** them over the network to destination executors, and **deserializing/sorting/merging** on the receiving side. This combination of disk I/O + network I/O + serialization overhead is why **shuffle minimization is the single highest-leverage performance lever** in Spark — see the [Performance Tuning cheatsheet](./08-performance-tuning-optimization.md).

---

## 8. Caching & Persistence

```python
df.cache()                                  # shorthand for persist(MEMORY_AND_DISK)
df.persist(StorageLevel.MEMORY_AND_DISK)
df.persist(StorageLevel.DISK_ONLY)
df.persist(StorageLevel.MEMORY_ONLY_SER)    # serialized, more CPU, less memory
df.unpersist()

spark.sql("CACHE TABLE my_table")
spark.sql("CACHE TABLE my_table OPTIONS ('storageLevel' 'DISK_ONLY')")
spark.sql("UNCACHE TABLE my_table")
```

| Storage Level | Memory | Disk | Serialized | Notes |
|---------------|--------|------|------------|-------|
| `MEMORY_ONLY` | ✅ | ❌ | ❌ | Fastest, but data is lost/recomputed if it doesn't fit |
| `MEMORY_AND_DISK` (default for `.cache()`) | ✅ | ✅ spill | ❌ | Safe default |
| `MEMORY_ONLY_SER` | ✅ | ❌ | ✅ | More CPU (deserialize on read), less memory footprint |
| `DISK_ONLY` | ❌ | ✅ | ✅ | For datasets too large for memory, still faster than recompute |

> On Databricks, prefer the **Delta Disk Cache** (a.k.a. "IO cache") over manual `.cache()` for repeated reads of the *same underlying table files* — it automatically caches remote Parquet/Delta files on local SSD across queries and users, without you managing lifecycle explicitly. `.cache()`/`.persist()` is still the right tool when you need to **pin a specific transformed DataFrame** in memory across multiple actions within one job.

```python
spark.conf.get("spark.databricks.io.cache.enabled")   # Delta/IO cache toggle
```

---

## 9. Spark UI — What to Look At

| Tab | Use it for |
|-----|-----------|
| **Jobs** | Overall job duration, which jobs/actions are slow, failed stages |
| **Stages** | Task-level skew (max task time vs. median), shuffle read/write size, spill metrics |
| **SQL / DataFrame** | Visual query plan, time spent per operator, row counts flowing through each node |
| **Storage** | Cached DataFrame sizes, memory vs. disk breakdown |
| **Executors** | GC time per executor, task distribution, spill to disk, active/dead executors |
| **Environment** | Effective Spark configs actually in use (useful to confirm a config really took effect) |

**Red flags to watch for:**
- Long **GC time** relative to task time → memory pressure, consider fewer/bigger executors or reducing cached data
- Large **"shuffle spill (disk)"** → not enough execution memory for the shuffle, or too few partitions for the data volume
- Huge **skew** between task min/max duration in a stage → a few keys dominate; see skew handling in [Performance Tuning](./08-performance-tuning-optimization.md)
- **Single-task stages** on large data → missing parallelism, often from `coalesce(1)` before a write or a non-splittable file format

---

## 10. Structured Streaming Execution Model (Brief)

Structured Streaming treats a stream as an **unbounded table** that's incrementally appended to, and re-uses the same Catalyst/AQE machinery as batch queries.

- **Micro-batch mode** (default): processes available data in discrete batches on a trigger interval.
- **Continuous mode**: experimental, lower-latency, more limited operator support.
- **Checkpointing**: durably stores offsets + state so a failed stream can resume without data loss or duplication (exactly-once, given idempotent sinks).
- **State store**: for stateful operations (`groupBy` with aggregation, stream-stream joins), Spark maintains state across micro-batches, typically backed by RocksDB on Databricks for large state.

See the [Ingestion, ETL & DLT cheatsheet](./05-ingestion-etl-dlt.md) for the applied, ingestion-focused view of streaming.

---

## 11. Databricks Runtime (DBR) Flavors

| Runtime | Use case |
|---------|----------|
| **Standard DBR** | General Spark workloads |
| **DBR ML** | Pre-installed ML libraries (scikit-learn, TensorFlow, PyTorch, XGBoost, MLflow) plus GPU driver support |
| **Photon** | Toggled on top of a runtime version rather than a fully separate runtime in modern versions |
| **LTS (Long Term Support)** | Recommended for production — longer support/patch window, more stability guarantees |
| **GPU Runtime** | Deep learning workloads, includes CUDA/cuDNN pre-installed |

**Rule of thumb:** always pin production jobs to a specific **LTS** version (e.g., `15.4.x-scala2.12`) and upgrade deliberately in a lower environment first — never leave production jobs on "latest" auto-resolving versions.

---

## 12. Serialization: Why It Matters

Spark moves data between the JVM and, for Python (`PySpark`), between the JVM and Python worker processes — this crossing has real cost.

| Path | Mechanism | Notes |
|------|-----------|-------|
| DataFrame API (Python) | Logical plan sent to JVM, executed in JVM/Photon, no per-row Python involved | Fast — this is why DataFrame ops outperform Python UDFs |
| Python UDF (row-at-a-time) | Each row serialized JVM ↔ Python via py4j | Slow — breaks whole-stage codegen, adds serialization overhead |
| **Pandas UDF** (vectorized, Arrow-based) | Batches of rows sent as Arrow columnar buffers | Much faster than row UDFs, still slower than native functions |

```python
# Prefer native functions
from pyspark.sql.functions import upper
df.withColumn("name", upper("name"))

# If you must use a UDF, prefer a Pandas (vectorized) UDF
import pandas as pd
from pyspark.sql.functions import pandas_udf

@pandas_udf("string")
def upper_udf(s: pd.Series) -> pd.Series:
    return s.str.upper()
```

---

## Related Cheatsheets
- [Performance Tuning & Optimization](./08-performance-tuning-optimization.md) — deep dive on skew, joins, caching strategy
- [Cluster & Compute Management](./09-cluster-compute-management.md) — sizing driver/executors correctly
- [Ingestion, ETL & DLT](./05-ingestion-etl-dlt.md) — streaming execution applied to pipelines
