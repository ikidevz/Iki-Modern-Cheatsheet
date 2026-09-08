# Load

## Load Strategies

**Definition:** The method used to write transformed data into the target table.

**Key Points:**
- Append — always insert new rows. Simple, good for immutable event/log data.
- Overwrite (Full Refresh) — truncate and reload the entire table.
- Upsert / Merge — insert new rows, update existing ones based on a key.

**Example:**
```sql
MERGE INTO target t
USING staging s
ON t.id = s.id
WHEN MATCHED THEN UPDATE SET t.value = s.value, t.updated_at = s.updated_at
WHEN NOT MATCHED THEN INSERT (id, value, updated_at) VALUES (s.id, s.value, s.updated_at);
```

**When to Use / Trade-offs:**
- Append — event/log tables where records are immutable and never updated.
- Overwrite — small reference/lookup tables where full refresh is cheap.
- Upsert/Merge — standard choice for dimension tables and any CDC-based pipeline.

**Common Pitfalls:**
- Using overwrite on a large fact table, causing unnecessary compute cost and downtime during the reload window.
- Merging on a non-unique key, silently creating duplicate or incorrectly-updated rows.

---

## Partitioning & Clustering

**Definition:** Physical or logical organization of table data to reduce the amount scanned per query.

**Key Points:**
- Partitioning splits data by a column (commonly date) so queries scan only relevant partitions.
- Clustering sorts/organizes data within partitions by additional columns to improve pruning on filtered queries.
- Choose partition keys based on how data is most commonly filtered, not just how it's naturally structured.

**Example:**
```sql
-- BigQuery: partition by date, cluster by customer_id
CREATE TABLE sales
PARTITION BY DATE(event_date)
CLUSTER BY customer_id
AS SELECT * FROM staging.sales;
```

**When to Use / Trade-offs:**
- Partition on the column most queries filter by (usually a date field for time-series/fact tables).
- Avoid partitioning on high-cardinality columns with no natural filtering pattern — it fragments data without query benefit.

**Common Pitfalls:**
- Over-partitioning (e.g., by minute instead of by day) creates excessive small partitions, increasing metadata overhead and slowing query planning.
- Partitioning by a column rarely used in `WHERE` clauses, providing no pruning benefit.

---

## Idempotency & Exactly-Once Semantics

**Definition:** A load operation is idempotent if running it multiple times produces the same result as running it once.

**Key Points:**
- Achieve idempotency via deterministic keys + upsert/merge, or delete-then-insert scoped to the exact batch window being reprocessed.
- True end-to-end "exactly-once" is rare in practice — most systems achieve at-least-once delivery combined with idempotent writes to simulate it.

**Example:**
```sql
-- Idempotent reload of a specific date partition
DELETE FROM sales WHERE event_date = :batch_date;
INSERT INTO sales SELECT * FROM staging.sales WHERE event_date = :batch_date;
```

**When to Use / Trade-offs:**
- Always design loads to be idempotent — pipelines will eventually be retried or re-run, whether intentionally or due to failure recovery.

**Common Pitfalls:**
- Pure `INSERT`-only loads with no dedupe/merge logic — a retried job creates duplicate rows.
- Assuming a message queue's "at-least-once" delivery guarantee alone prevents duplicates — it doesn't, without idempotent processing on the consumer side.

---

## Backfilling Strategies

**Definition:** The process of reprocessing historical data through a pipeline, typically after a bug fix, schema change, or new pipeline launch.

**Key Points:**
- Use a separate backfill job parameterized by date range, distinct from the live/incremental pipeline.
- Backfill in small, resumable chunks (e.g., day-by-day) rather than one giant run.
- Validate row counts/checksums after backfill against source or a known-good snapshot.

**Example:**
```bash
# Airflow backfill for a date range
airflow dags backfill -s 2026-01-01 -e 2026-01-31 my_dag_id
```

**When to Use / Trade-offs:**
- Chunked backfills trade a longer total runtime for resumability — a failure only requires re-running the failed chunk, not the entire range.

**Common Pitfalls:**
- Running a full-range backfill in one unchunked job — a failure partway through forces a full restart.
- Backfilling without validating against source counts, silently leaving gaps or duplicates.
