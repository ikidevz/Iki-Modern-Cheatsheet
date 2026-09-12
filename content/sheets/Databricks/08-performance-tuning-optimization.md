# Performance Tuning & Optimization Cheatsheet

> Diagnosing and fixing slow Spark/Databricks jobs — joins, skew, partitioning, caching, memory, and the configuration knobs that actually matter.

---

## 1. The Tuning Priority Order

1. **Fix the data layout** (file sizes, clustering/partitioning) — biggest ROI, one-time cost
2. **Fix the query/joins** (broadcast, filter pushdown, avoid unnecessary shuffles)
3. **Fix skew** (salting, AQE skew join handling)
4. **Right-size the cluster** (only after the above — throwing hardware at a bad query wastes money)
5. **Micro-tune Spark configs** — last resort, smallest ROI relative to effort

This order matters because tuning configs on a query with a fundamentally bad data layout or join strategy gives marginal gains, while fixing the layout/join can produce 10-100x improvements.

---

## 2. Diagnosing: Where to Look First

| Symptom | Likely cause | Where to check |
|---------|--------------|------------------|
| Job much slower than expected | Skew, small files, spilling to disk | Spark UI → Stages (max vs. median task time) |
| One task takes forever | Data skew | Stages tab, sort tasks by duration |
| High "shuffle spill (disk)" | Not enough memory / too few partitions | Stages tab → task metrics |
| Query plan shows `SortMergeJoin` for a small table | Missed broadcast opportunity | SQL tab → query plan |
| Many small tasks, low CPU utilization | Too many small files | `DESCRIBE DETAIL table` → numFiles |
| High GC time | Executor memory pressure, too many small objects | Executors tab |
| Query scans far more bytes than expected | Missing partition/clustering filter, no predicate pushdown | Query plan → `PushedFilters`, files scanned metric |

---

## 3. Small File Problem

```sql
DESCRIBE DETAIL my_table;   -- check numFiles and sizeInBytes

OPTIMIZE my_table;                          -- compact files
OPTIMIZE my_table ZORDER BY (col1, col2);   -- compact + co-locate

ALTER TABLE my_table SET TBLPROPERTIES (
  'delta.autoOptimize.optimizeWrite' = 'true',
  'delta.autoOptimize.autoCompact' = 'true'
);
```
**Target file size:** ~128 MB–1 GB. Too many tiny files → task-scheduling overhead dominates; too few giant files → poor parallelism and worse data-skipping granularity (a query touching any row in a huge file must scan the whole file).

**Root causes of small files:** over-partitioning (partitioning by a high-cardinality column), frequent small streaming micro-batch writes without compaction, or many small `INSERT` statements instead of batched writes.

---

## 4. Partitioning & Clustering Strategy

| Approach | When to use |
|----------|-------------|
| **Liquid Clustering** | Default choice for most new tables — handles skew and evolving query patterns without full rewrites |
| **Hive-style partitioning** (`PARTITIONED BY`) | Coarse, bounded-cardinality keys (e.g., `date`) where you always filter on that column |
| **Z-ORDER** | Legacy tables not yet on Liquid Clustering; co-locate frequently-filtered columns |

> Avoid partitioning by high-cardinality columns (e.g., `user_id`) — creates thousands of tiny partitions ("over-partitioning"), each potentially containing only a handful of small files.

```sql
CREATE TABLE events (...) PARTITIONED BY (event_date);
CREATE TABLE events (...) CLUSTER BY (event_date, user_id);  -- preferred modern approach
```

**Partition pruning** happens when a query's `WHERE` clause matches the partition/clustering key — Spark skips reading entire partitions/files that can't contain matching rows, without even opening them. Confirm it's happening via `EXPLAIN` (look for `PartitionFilters` in the scan node) rather than assuming.

---

## 5. Join Strategies

| Strategy | When Spark picks it | Force it |
|----------|----------------------|----------|
| **Broadcast Hash Join** | One side is small enough to fit in memory (default threshold 10MB, tune higher) | `df.hint("broadcast")` or `broadcast(df)` |
| **Sort Merge Join** | Both sides large, join key sortable | Default for large-large joins |
| **Shuffle Hash Join** | One side moderately small; disabled by default in favor of SMJ | `spark.sql.join.preferSortMergeJoin=false` |
| **Broadcast Nested Loop Join** | No equi-join condition (e.g., range/inequality joins) with a small side | Rarely forced manually; watch for it appearing unintentionally on cross joins |
| **Bucketed Join** | Both tables pre-bucketed on the join key | Requires matching bucketing config at write time (less common on Delta than legacy Hive tables) |

```python
from pyspark.sql.functions import broadcast
big_df.join(broadcast(small_df), "id")

spark.conf.set("spark.sql.autoBroadcastJoinThreshold", 100 * 1024 * 1024)  # 100MB
```

**Always check `EXPLAIN` to confirm the join type actually used**, not just what you hinted — AQE may override your hint at runtime based on actual observed sizes, which is usually a good thing but worth verifying when debugging.

```sql
EXPLAIN FORMATTED SELECT * FROM big_table b JOIN small_table s ON b.id = s.id;
```

---

## 6. Handling Data Skew

Symptoms: one or two tasks in a stage take 10-100x longer than the rest; the Spark UI shows a huge gap between median and max task duration in the Stages tab.

```python
# 1. Let AQE handle it automatically (enabled by default)
spark.conf.set("spark.sql.adaptive.skewJoin.enabled", "true")

# 2. Manual salting technique for extreme skew AQE can't fully resolve
from pyspark.sql.functions import rand, concat, lit, floor

salted = df.withColumn("salt", floor(rand() * 10))
salted_key = concat(df["key"], lit("_"), salted["salt"])
# join on salted key, explode the small side 10x to match salt range
```

```sql
-- Isolate skew culprits before deciding on a fix
SELECT key, COUNT(*) c FROM my_table GROUP BY key ORDER BY c DESC LIMIT 20;
```

**When AQE skew handling isn't enough:** extreme skew (e.g., one key has 1000x more rows than the next-largest) sometimes needs manual salting because AQE's splitting strategy has practical limits on how finely it subdivides a single skewed partition.

---

## 7. Caching Strategy

| Mechanism | When to use |
|-----------|-------------|
| **Delta/Disk Cache** (automatic on Databricks) | Default — caches remote Parquet on local NVMe SSD, transparent, shared across queries/users on the same cluster |
| **`.cache()` / `.persist()`** | Reused DataFrame across multiple actions within the same job/session, fits in memory |
| **Materializing to a table** | Reused across *jobs* (not just within one session) — write an intermediate Delta table instead of relying on in-memory cache that dies with the cluster |

```python
df.cache()
df.count()          # trigger the cache materialization (cache is lazy until an action runs)
...
df.unpersist()       # always release when done to free memory for other stages
```

> Don't `.cache()` DataFrames you only use once — it adds serialization/storage overhead with no benefit, and can even evict genuinely useful cached data under memory pressure.

---

## 8. Reading & Writing Efficiently

```python
# Predicate pushdown — filter as early as possible, before joins/aggregations
df.filter("event_date = '2026-09-01'").join(...)

# Column pruning — select only needed columns before wide operations
df.select("id", "amount")

# Avoid UDFs when a native function exists (UDFs break Catalyst optimization & whole-stage codegen)
# BAD:
udf_func = udf(lambda x: x.upper())
# GOOD:
from pyspark.sql.functions import upper
df.withColumn("name", upper("name"))
```

**Table statistics for the cost-based optimizer:**
```sql
ANALYZE TABLE my_table COMPUTE STATISTICS FOR ALL COLUMNS;
ANALYZE TABLE my_table COMPUTE STATISTICS FOR COLUMNS col1, col2;
```
Fresh column statistics help Catalyst make better join-order and join-strategy decisions, especially in multi-way joins — stale or missing stats are a common hidden cause of a suboptimal physical plan even with AQE enabled.

---

## 9. Photon & AQE — Turn Them On, Verify They're Working

```python
# Confirm AQE is active
spark.conf.get("spark.sql.adaptive.enabled")   # should be "true"
spark.conf.get("spark.databricks.photon.enabled")
```
- Check the cluster's Databricks Runtime shows "Photon" in the UI runtime label.
- Photon shows the biggest wins on: large scans, aggregations, joins, `MERGE`/`UPDATE`/`DELETE`, and Parquet/Delta writes.
- **Photon limitations:** some operators (certain complex UDFs, some Python-heavy operations, a subset of less common functions) fall back to standard JVM Spark automatically — check the query plan for `PhotonResultStage` vs. non-Photon nodes if you're investigating why a specific query isn't seeing expected acceleration.

---

## 10. Key Spark Configs Worth Knowing

| Config | Purpose |
|--------|---------|
| `spark.sql.shuffle.partitions` | Default post-shuffle partition count (AQE often overrides at runtime) |
| `spark.sql.adaptive.enabled` | Master switch for AQE |
| `spark.sql.adaptive.skewJoin.enabled` | Enables automatic skew-join handling under AQE |
| `spark.sql.autoBroadcastJoinThreshold` | Size threshold for auto-broadcast joins |
| `spark.databricks.delta.optimizeWrite.enabled` | Auto-compacts files during writes |
| `spark.databricks.io.cache.enabled` | Toggle the Delta disk cache |
| `spark.sql.files.maxPartitionBytes` | Max bytes packed into one input partition when reading |
| `spark.sql.optimizer.dynamicPartitionPruning.enabled` | Enables DPP for star-schema-style joins |

---

## 11. Memory Tuning Fundamentals

- **Unified memory model**: execution memory (shuffles/joins/sorts) and storage memory (caching) share a pool and can borrow from each other; `spark.memory.fraction` controls how much of executor JVM heap is available to this pool at all (vs. reserved for user code/internal bookkeeping).
- **Symptoms of memory pressure**: high GC time in the Executors tab, `OutOfMemoryError`, excessive shuffle spill to disk.
- **Common fixes**: increase executor memory, increase the number of partitions (smaller tasks = smaller per-task memory footprint), avoid large `collect()` calls that pull data to the driver, avoid caching more data than comfortably fits.

```python
# Avoid pulling large results to the driver
df.collect()          # BAD for large data — materializes everything in driver memory
df.limit(100).collect()  # fine
df.write.format("delta").save(path)  # let executors write directly instead
```

---

## 12. Streaming-Specific Tuning

| Lever | Effect |
|-------|--------|
| `maxFilesPerTrigger` / `maxBytesPerTrigger` (Auto Loader) | Controls micro-batch size, avoids overwhelming the cluster on backlog catch-up |
| `trigger(availableNow=True)` | Batch-like efficient processing instead of tiny continuous batches |
| Watermark tuning | Balances state size vs. late-data tolerance — a too-generous watermark grows state indefinitely |
| RocksDB state store | Default backing store for large stateful streaming state on Databricks; monitor state size growth over time |
| Checkpoint compaction | Watch checkpoint directory growth on very long-running streams |

---

## 13. Quick Diagnostic Checklist

- [ ] Are files right-sized (not too small/large)? → `OPTIMIZE`
- [ ] Is the query plan using the join strategy you expect? → `EXPLAIN`
- [ ] Is there skew? → check task duration distribution in Spark UI
- [ ] Are you filtering/selecting early? → predicate & column pushdown
- [ ] Any avoidable UDFs? → replace with native functions or Pandas UDFs
- [ ] Is AQE/Photon enabled? → check cluster config
- [ ] Are table statistics fresh? → `ANALYZE TABLE`
- [ ] Is caching used appropriately (not overused, not missing)?
- [ ] Is the cluster sized to the *data*, not guessed?

---

## Related Cheatsheets
- [Spark Architecture & Runtime](./03-spark-architecture-runtime.md)
- [Delta Table Deep Dive](./04-delta-table-deep-dive.md)
- [Cluster & Compute Management](./09-cluster-compute-management.md)
