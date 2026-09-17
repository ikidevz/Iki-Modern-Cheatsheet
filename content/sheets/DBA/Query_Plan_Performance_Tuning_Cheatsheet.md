# Query Plan & Performance Tuning Cheatsheet

A DBA-focused reference for reading execution plans, understanding index internals, and systematically tuning slow queries in MySQL and PostgreSQL.

> Verified against: **PostgreSQL 18** (B-tree skip scans on multicolumn indexes and async I/O are new since PG 18 — confirmed via web search since these postdate most training data), **MySQL 8.4 LTS / 9.7**.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Quick Reference Table](#2-quick-reference-table)
3. [Reading EXPLAIN Output — PostgreSQL](#3-reading-explain-output--postgresql)
4. [Reading EXPLAIN Output — MySQL](#4-reading-explain-output--mysql)
5. [Index Internals](#5-index-internals)
6. [Index Types & When to Use Them](#6-index-types--when-to-use-them)
7. [Join Algorithms](#7-join-algorithms)
8. [Statistics & the Query Planner](#8-statistics--the-query-planner)
9. [Common Anti-Patterns That Kill Performance](#9-common-anti-patterns-that-kill-performance)
10. [A Systematic Tuning Workflow](#10-a-systematic-tuning-workflow)
11. [Key Configuration Knobs](#11-key-configuration-knobs)
12. [Partitioning & Parallel Query as Performance Tools](#12-partitioning--parallel-query-as-performance-tools)
13. [Materialized Views & Query Result Caching](#13-materialized-views--query-result-caching)
14. [Worked Examples](#14-worked-examples)
15. [Gotchas](#15-gotchas)

---

## 1. Core Concepts

| Concept | What it means |
|---|---|
| **Query planner/optimizer** | The component that turns SQL into a physical execution plan by estimating the cost of alternative strategies (which index, which join order, which join algorithm) and picking the cheapest one it can find. |
| **Execution plan** | The actual tree of operations (scans, joins, sorts, aggregates) the engine will run (or did run) to answer a query. |
| **Cost-based optimization** | Plans are chosen by *estimated cost* (a unitless number derived from table/index statistics), not by any notion of "correctness" — a plan can be valid but still badly estimated. |
| **Cardinality estimate** | The planner's guess at how many rows a step will produce. Nearly every real-world "the planner picked a bad plan" problem traces back to a cardinality estimate that was wrong. |
| **Selectivity** | The fraction of rows a predicate is expected to match. Highly selective predicates (few matching rows) favor index scans; low selectivity favors sequential/full scans. |
| **Seek vs. scan** | A seek jumps directly to relevant rows via an index; a scan reads rows sequentially (all of them, or a contiguous range). Neither is inherently better — scanning is often faster than seeking when you need a large fraction of a table. |
| **Covering index** | An index that contains every column a query needs, so the engine never has to look up the underlying table row (avoids the extra "bookmark lookup"/heap fetch). |
| **N+1 query problem** | An application pattern that issues one query to get a list, then one additional query per row to fetch related data — invisible in application code review, glaring in a query log. |

---

## 2. Quick Reference Table

| I want to… | MySQL | PostgreSQL |
|---|---|---|
| See the plan without running the query | `EXPLAIN SELECT ...` | `EXPLAIN SELECT ...` |
| See the plan **and actual runtime/row counts** | `EXPLAIN ANALYZE SELECT ...` | `EXPLAIN (ANALYZE, BUFFERS) SELECT ...` |
| See the plan as a readable tree/JSON | `EXPLAIN FORMAT=TREE ...` / `FORMAT=JSON` | `EXPLAIN (FORMAT JSON) ...` |
| Find slow queries after the fact | Enable `slow_query_log`, or query `performance_schema.events_statements_summary_by_digest` | `pg_stat_statements` extension |
| Force a refresh of planner statistics | `ANALYZE TABLE tablename;` | `ANALYZE tablename;` |
| List indexes on a table | `SHOW INDEX FROM tablename;` | `\d tablename` in psql, or query `pg_indexes` |
| Find unused indexes | `sys.schema_unused_indexes` (via the `sys` schema) | `pg_stat_user_indexes` where `idx_scan = 0` |
| Check current locks/blocking queries | `SHOW ENGINE INNODB STATUS\G` / `performance_schema.data_locks` | `pg_locks` joined against `pg_stat_activity` |

---

## 3. Reading EXPLAIN Output — PostgreSQL

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT o.id, c.name FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.created_at > now() - interval '7 days';
```
```
Hash Join  (cost=45.00..1250.32 rows=3200 width=48) (actual time=1.2..18.4 rows=3105 loops=1)
  Hash Cond: (o.customer_id = c.id)
  ->  Index Scan using idx_orders_created_at on orders o  (cost=0.42..980.11 rows=3200 width=16)
        (actual time=0.05..12.1 rows=3105 loops=1)
        Index Cond: (created_at > (now() - '7 days'::interval))
        Buffers: shared hit=812 read=44
  ->  Hash  (cost=32.00..32.00 rows=1200 width=36) (actual time=1.0..1.0 rows=1200 loops=1)
        ->  Seq Scan on customers c  (cost=0.00..32.00 rows=1200 width=36)
Planning Time: 0.31 ms
Execution Time: 19.2 ms
```
- **Read bottom-up, inside-out**: the deepest/rightmost nodes execute first and feed rows upward.
- **`cost=A..B`**: A is the estimated cost to return the *first* row, B is the estimated cost to return *all* rows.
- **`rows=N` (estimate) vs. `actual ... rows=N` (reality)**: a large gap between these on any node is the single most useful diagnostic signal in the entire plan — it means the planner's statistics or assumptions were wrong, which cascades into wrong join-order/algorithm choices upstream.
- **`Buffers: shared hit=X read=Y`** (requires the `BUFFERS` option): `hit` = found in shared_buffers cache, `read` = had to hit disk/OS cache — a high `read` count on a query you expect to be "hot" points at cache pressure or an index/table larger than your working set.
- **`loops=N`**: for nodes inside a nested loop, this is how many times that node executed — a cheap-looking per-loop cost can still dominate total time if `loops` is large.

---

## 4. Reading EXPLAIN Output — MySQL

```sql
EXPLAIN ANALYZE
SELECT o.id, c.name FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.created_at > NOW() - INTERVAL 7 DAY;
```
```
-> Nested loop inner join  (cost=890 rows=3105) (actual time=0.08..14.2 rows=3098 loops=1)
    -> Index range scan on o using idx_orders_created_at, with index condition:
       (o.created_at > <cache>((now() - interval 7 day)))  (cost=450 rows=3200) (actual time=0.05..8.1 rows=3105 loops=1)
    -> Single-row index lookup on c using PRIMARY (id=o.customer_id)  (cost=0.25 rows=1) (actual time=0.001..0.001 rows=1 loops=3105)
```
- MySQL's `EXPLAIN ANALYZE` (available since MySQL 8.0.18) uses the tree format above by default — nesting indicates the execution hierarchy, same bottom-up-feeds-upward logic as PostgreSQL.
- **`type` column** in classic (non-`ANALYZE`) `EXPLAIN` output ranks access methods from best to worst: `system`/`const` (best — at most one row) → `eq_ref` → `ref` → `range` → `index` → `ALL` (worst — full table scan). Seeing `ALL` on a large table in a hot-path query is the first thing to investigate.
- **`Extra` column** flags worth knowing: `Using filesort` (an extra sort step not satisfied by an index — often fixable with a matching index), `Using temporary` (a temp table was needed, common with `GROUP BY`/`DISTINCT` on unindexed columns), `Using index` (a covering index satisfied the query without touching the table — good), `Using where` (a filter is applied after the storage engine returns rows — normal, not inherently bad).
- **`rows` (estimate) vs. `EXPLAIN ANALYZE`'s `actual rows`**: same diagnostic value as PostgreSQL — a large gap signals bad statistics or an unhelpful index.

---

## 5. Index Internals

Both engines' default index structure is a **B+ tree**: a balanced tree where every leaf is at the same depth, leaves are linked for efficient range scans, and internal nodes hold only routing keys (not full row data).

```
                [50]
              /      \
          [20,35]    [70,90]
         /   |   \    /   |   \
      [..] [..] [..][..] [..] [..]   <- leaf nodes, linked left-to-right for range scans
```

- **Lookup cost is O(log n)** — a B-tree stays shallow even at huge scale (a billion-row table is typically only 3-4 levels deep), which is why index seeks stay fast as tables grow.
- **Leaf nodes store the indexed column(s) plus a pointer**: in PostgreSQL, a pointer to the heap tuple (TID); in MySQL/InnoDB, secondary indexes store the *primary key value* as the pointer (not a physical row pointer), meaning every secondary-index lookup does an implicit second lookup into the clustered primary-key index — this is why InnoDB primary key choice matters so much for secondary-index performance.
- **Clustered vs. non-clustered**: InnoDB tables are always clustered by primary key (rows are physically stored in primary-key order) — a poorly chosen primary key (e.g., a random UUID) causes constant page splits and fragmentation on insert. PostgreSQL has no clustered-by-default storage; `CLUSTER` exists but is a one-time physical reorder, not maintained automatically.
- **Multicolumn index column order matters**: an index on `(a, b, c)` can serve queries filtering on `a`, `a+b`, or `a+b+c`, but generally cannot efficiently serve a query filtering on `b` alone — put the most selective / most commonly-filtered-alone column first, subject to the caveat below.
- **PostgreSQL 18 added B-tree skip scans**: a multicolumn index on `(a, b)` can now be used efficiently even for a query that filters only on `b`, by "skipping" through the distinct values of `a` — genuinely changes the classic "leading column must be in the WHERE clause" rule of thumb for recent PostgreSQL versions specifically.

---

## 6. Index Types & When to Use Them

| Index type | PostgreSQL | MySQL | Best for |
|---|---|---|---|
| B-tree | Default (`btree`) | Default (`BTREE`) | Equality, range queries, sorting — the general-purpose default |
| Hash | `USING hash` | `HASH` (Memory engine only, InnoDB uses adaptive hash internally) | Pure equality lookups only, no ranges/sorting — rarely worth it over B-tree in practice |
| GIN (Generalized Inverted Index) | `USING gin` | N/A (no direct equivalent) | Full-text search, JSONB containment (`@>`), array membership |
| GiST | `USING gist` | N/A | Geometric/range types, nearest-neighbor search, full-text (less common than GIN) |
| BRIN (Block Range Index) | `USING brin` | N/A | Very large tables with naturally correlated physical order (e.g., an append-only `created_at` column) — tiny index size, much less precise than B-tree |
| Full-text | `USING gin` on a `tsvector` | `FULLTEXT` | Natural-language search — different tuning models per engine, not interchangeable syntax |
| Spatial (R-tree family) | `USING gist` with PostGIS | `SPATIAL` (MyISAM/InnoDB) | Geographic/geometric queries |
| Partial index | `WHERE` clause on the `CREATE INDEX` | Not supported natively (functional workarounds only) | Indexing only a meaningful subset of rows (e.g., `WHERE status = 'active'`) — much smaller, much faster for that subset |
| Covering index (`INCLUDE`) | `CREATE INDEX ... INCLUDE (col)` | Add extra columns to a composite index | Satisfying a query entirely from the index, avoiding a heap/row lookup |

---

## 7. Join Algorithms

| Algorithm | How it works | Best when |
|---|---|---|
| **Nested loop** | For each row in the outer input, scan/seek the inner input for matches | The outer input is small and the inner input has a good index on the join key — otherwise this degrades to O(n×m) |
| **Hash join** | Build an in-memory hash table from the smaller input, then probe it with the larger input | Large inputs, no useful index on the join column, equality joins only |
| **Merge join** | Both inputs are sorted (or sorted as part of the plan) on the join key, then merged in one pass | Both inputs are already sorted (e.g., by index) or the join key has few duplicates — efficient for large, pre-sorted inputs |

The planner picks based on estimated input sizes and available indexes/sort orders — a nested loop that looked fine in testing with 100 rows can become catastrophic in production with 10 million, which is exactly why cardinality estimate accuracy (Section 8) matters so much more than memorizing which algorithm is "best."

---

## 8. Statistics & the Query Planner

- **PostgreSQL**: `ANALYZE` (run automatically by autovacuum's analyze threshold, or manually) samples the table and updates `pg_statistic` — histogram boundaries, most-common-values lists, correlation, null fraction. `default_statistics_target` (default 100) controls sample granularity; bump it per-column (`ALTER TABLE t ALTER COLUMN c SET STATISTICS 500;`) for columns with skewed or unusual distributions that the default sampling misrepresents.
- **MySQL/InnoDB**: statistics are stored persistently by default (`innodb_stats_persistent=ON` since 5.6) and refreshed via `ANALYZE TABLE`, on table-open events, or automatically based on a change-count threshold (`innodb_stats_auto_recalc`). InnoDB's statistics are index-based samples, coarser than PostgreSQL's per-column histograms, which is part of why MySQL's optimizer more often needs manual index hints in edge cases.
- **Extended/multivariate statistics**: PostgreSQL's `CREATE STATISTICS` lets you tell the planner about correlations *between* columns (e.g., `city` and `zip_code` aren't independent) that per-column statistics can't capture — fixes a specific, common class of cardinality misestimation on correlated filter columns.
- **Stale statistics are a top-3 cause of sudden plan regressions**: a plan that was fine for months can flip to a terrible one the moment a table's data distribution shifts enough that cached statistics no longer reflect reality — this is why "just run ANALYZE" is often the actual fix for "the query suddenly got slow."

---

## 9. Common Anti-Patterns That Kill Performance

- **Functions wrapped around indexed columns** in a `WHERE` clause (`WHERE DATE(created_at) = '2026-09-17'`) prevent index use unless a matching functional/expression index exists — rewrite as a range (`created_at >= '2026-09-17' AND created_at < '2026-09-18'`) or add an expression index.
- **Leading wildcard `LIKE '%term'`** cannot use a standard B-tree index (it can use trigram/GIN indexes in PostgreSQL, or full-text search in either engine) — a trailing wildcard (`'term%'`) can use a B-tree.
- **Implicit type conversion** (comparing a string column to an integer literal, or vice versa) silently defeats index usage in both engines.
- **`SELECT *` on wide tables** pulls unnecessary columns, defeats covering-index optimization, and increases network/buffer overhead for no benefit.
- **N+1 queries** from an ORM issuing one query per row instead of a single joined/batched query — invisible in code, glaring in `pg_stat_statements`/the slow query log as thousands of near-identical single-row lookups.
- **`OR` conditions across different columns** often prevent efficient index use where an equivalent `UNION` of two indexed queries would not — worth testing explicitly when an `OR` query is unexpectedly slow.
- **Over-indexing**: every index speeds up reads but slows down every write (insert/update/delete must maintain every index) and consumes storage/cache space — an unused index (`idx_scan = 0` in PostgreSQL, `schema_unused_indexes` in MySQL's `sys` schema) is pure overhead with zero benefit.
- **Large `OFFSET` pagination** (`LIMIT 20 OFFSET 100000`) forces the engine to generate and discard 100,000 rows before returning 20 — replace with keyset/cursor pagination (`WHERE id > last_seen_id ORDER BY id LIMIT 20`).

---

## 10. A Systematic Tuning Workflow

1. **Find the actual slow queries** — don't guess. Use `pg_stat_statements` (PostgreSQL) or the slow query log / `performance_schema` (MySQL) to rank by total time, not just individual query duration; a query that's fast but runs 100,000 times/hour often matters more than one slow query that runs once a day.
2. **Get the real plan with actual numbers**: `EXPLAIN (ANALYZE, BUFFERS)` / `EXPLAIN ANALYZE` — never tune based on the estimated-only plan alone.
3. **Find the estimate-vs-actual gap**: the node where estimated rows and actual rows diverge most is almost always the root cause, even if it's not the most expensive-looking node in isolation.
4. **Check statistics freshness** on the tables involved before changing indexes — a stale-statistics problem masquerading as a missing-index problem is extremely common.
5. **Consider the index, not just "add an index"**: does an existing index almost cover this query? Would a composite index, a partial index, or a covering index (`INCLUDE`) solve it more cheaply than a new single-column index?
6. **Test the change with production-representative data volume** — a plan that looks great against a 10,000-row staging copy can behave completely differently against a 50-million-row production table, because the planner's cost model is sensitive to scale.
7. **Re-run `EXPLAIN ANALYZE` after the change** to confirm the plan actually shifted the way you expected, not just that the query "feels" faster.
8. **Watch for regressions elsewhere** — a new index changes the planner's cost calculus for *every* query that touches that table, not just the one you were tuning; monitor overall write latency and other query patterns after adding indexes to write-heavy tables.

---

## 11. Key Configuration Knobs

| Knob | Engine | What it affects |
|---|---|---|
| `shared_buffers` | PostgreSQL | The engine's own page cache — typically 25% of system RAM as a starting point |
| `work_mem` | PostgreSQL | Memory available *per sort/hash operation* before spilling to disk — too low causes disk-based sorts/hashes on otherwise-fine queries; too high risks OOM under concurrency (it's per-operation, not per-connection) |
| `effective_cache_size` | PostgreSQL | A *hint* to the planner about total OS+DB cache available — doesn't allocate memory itself, just influences whether the planner expects an index scan's random I/O to be cheap |
| `random_page_cost` | PostgreSQL | The planner's assumed relative cost of a random disk read vs. sequential (default 4.0 assumes spinning disks) — lowering to ~1.1 on all-SSD/NVMe storage often shifts the planner toward more index usage, correctly |
| `innodb_buffer_pool_size` | MySQL | InnoDB's page cache — the single most impactful MySQL tuning knob, typically 50-75% of system RAM on a dedicated DB host |
| `innodb_io_capacity` | MySQL | Tells InnoDB how many I/O operations per second the underlying storage can sustain, pacing background flushing/purge accordingly — badly wrong values (too low on fast SSDs) cause needless throttling |
| `join_buffer_size` / `sort_buffer_size` | MySQL | Per-operation memory for joins/sorts without a usable index — analogous caveat to PostgreSQL's `work_mem`: it's per-operation, so raising it globally scales with concurrent connections |

---

## 12. Partitioning & Parallel Query as Performance Tools

**Table partitioning** splits one logical table into multiple physical pieces, transparent to most queries, chosen by a partition key.

| Partitioning strategy | PostgreSQL | MySQL |
|---|---|---|
| Range (e.g., by date) | `PARTITION BY RANGE (created_at)` | `PARTITION BY RANGE (YEAR(created_at))` |
| List (e.g., by region/category) | `PARTITION BY LIST (region)` | `PARTITION BY LIST (region_id)` |
| Hash (even distribution, no natural range/list key) | `PARTITION BY HASH (customer_id)` | `PARTITION BY HASH (customer_id)` |

- **Partition pruning**: the planner can skip entire partitions that a query's `WHERE` clause proves can't contain matching rows (e.g., a query filtering `created_at > '2026-09-01'` never touches partitions holding only 2024 data) — the single biggest performance win partitioning provides, and it requires the partition key to actually appear in the query's filter to take effect.
- **Maintenance benefits compound the pure-query-speed benefit**: `VACUUM`/`ANALYZE`/index maintenance operate per-partition, so a maintenance operation on "this month's partition" is far cheaper than the same operation against one giant unpartitioned table — this is often the *primary* motivation for partitioning very large, time-series-style tables, not query speed alone.
- **Dropping old data becomes near-instant**: `DROP TABLE orders_2023` (detaching/dropping a whole partition) replaces a slow, WAL/binlog-heavy `DELETE FROM orders WHERE created_at < '2024-01-01'` that would otherwise generate massive undo/redo volume and vacuum/purge overhead proportional to the rows deleted.
- **When partitioning backfires**: too many small partitions add planning overhead (the planner must consider pruning against every partition), and queries that *don't* filter on the partition key get no pruning benefit at all — partitioning a table by a key your actual query patterns rarely filter on is pure overhead with no upside.

**Parallel query execution**: both engines can split a single query's work across multiple CPU cores for large scans/aggregates/joins.
- **PostgreSQL**: controlled by `max_parallel_workers_per_gather` (per-query worker cap) and `max_parallel_workers` (cluster-wide cap); the planner decides whether parallelism is worthwhile based on estimated table size (`min_parallel_table_scan_size`) — small tables never get parallel plans because the coordination overhead would exceed the benefit.
- **MySQL**: historically weaker parallel-query support than PostgreSQL for standard `SELECT` workloads (parallelism is more prominent in specific operations like `CREATE INDEX` or in NDB/analytical-focused variants) — a genuine, still-relevant architectural difference worth knowing when choosing an engine for scan-heavy analytical workloads.
- **Parallel plans show up in `EXPLAIN`** as `Gather`/`Gather Merge` nodes (PostgreSQL) with worker counts — if a large-table query on a multi-core host isn't using them, checking `max_parallel_workers_per_gather` and the relevant cost-threshold settings (`parallel_setup_cost`, `parallel_tuple_cost`) is a reasonable first troubleshooting step before assuming it's a data-shape problem.

---

## 13. Materialized Views & Query Result Caching

| Mechanism | PostgreSQL | MySQL |
|---|---|---|
| Materialized view | `CREATE MATERIALIZED VIEW mv AS SELECT ...;` — physically stores results, must be explicitly refreshed | No native materialized view — emulated via a real table populated by a scheduled job/trigger, or third-party tooling |
| Refresh | `REFRESH MATERIALIZED VIEW mv;` (locks the view against reads by default) or `REFRESH MATERIALIZED VIEW CONCURRENTLY mv;` (requires a unique index on the MV, allows concurrent reads during refresh) | Application/cron-managed `TRUNCATE` + `INSERT ... SELECT`, or `REPLACE`-based refresh of the emulated table |
| Use case | Expensive aggregations/joins queried far more often than the underlying data changes (dashboards, reporting rollups) | Same use case, achieved through the emulation pattern above |

- **A materialized view trades freshness for speed** — it's a deliberate, explicit staleness window (until the next refresh), which is a very different contract from a regular view (always current, but re-executes the underlying query every time) or a cached application-layer result (implicit, often harder to reason about invalidation for).
- **`REFRESH ... CONCURRENTLY` is usually worth the setup cost** (the required unique index) for any materialized view queried by live user-facing traffic — a non-concurrent refresh locks the view for the refresh's full duration, which can be a meaningful outage for a dashboard if the underlying aggregation is expensive.
- **Query result caching at other layers** (application-level caches like Redis, or a connection pooler with query caching) is a complementary, not competing, technique — a materialized view reduces the cost of computing an expensive aggregation once; an external cache reduces the cost of *asking the database at all* for identical repeated requests. Systems under heavy read load commonly use both together.
- **MySQL's old built-in query cache was removed entirely in MySQL 8.0** — if migrating an older MySQL deployment that relied on it, that specific caching layer is simply gone and needs to be replaced with one of the patterns above, not reconfigured.

---

## 14. Worked Examples

### Example 1 — Diagnosing a cardinality-estimate-driven bad plan (PostgreSQL)
A reporting query joining `orders` and `order_items` on a filtered date range suddenly takes 40 seconds instead of its usual 200ms.
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, sum(oi.quantity * oi.price)
FROM orders o JOIN order_items oi ON oi.order_id = o.id
WHERE o.created_at > '2026-09-01'
GROUP BY o.id;
```
```
HashAggregate (cost=1200..1250 rows=500) (actual time=39800..39850 rows=48000 loops=1)
  -> Nested Loop  (cost=0.5..1150 rows=500) (actual time=0.1..39200 rows=980000 loops=1)
       -> Index Scan on orders o ... rows=500 ... actual rows=48000
       -> Index Scan on order_items oi ... rows=1 ... actual rows=20 (loops=48000)
```
1. The planner estimated 500 matching orders; there were actually 48,000 — a ~100x cardinality miss, almost certainly stale statistics (a recent, large data volume increase from a promotional campaign) rather than a schema problem.
2. Because the planner *believed* only 500 outer rows would exist, a nested loop looked cheap — with the real 48,000, it degrades into 48,000 separate index probes instead of the hash join that would have been chosen with accurate estimates.
3. Fix: `ANALYZE orders; ANALYZE order_items;` — re-running the same query afterward produces a `Hash Join` plan and returns in ~300ms.
4. Root cause, addressed structurally: `autovacuum_analyze_scale_factor` on `orders` was still the 0.1 default; given the table's new growth rate, statistics weren't refreshing often enough relative to how fast the row count (and its distribution) was changing — lowering the scale factor for this specific table (per the Vacuuming & Maintenance cheatsheet) prevents a recurrence rather than relying on someone noticing and manually running `ANALYZE` again next time.

### Example 2 — Fixing a MySQL query with `Using filesort` and `Using temporary`
```sql
EXPLAIN SELECT customer_id, count(*) 
FROM orders 
WHERE status = 'completed' 
GROUP BY customer_id 
ORDER BY count(*) DESC 
LIMIT 20;
```
```
+----+-------------+--------+------+---------------+------+---------+------+--------+---------------------------------+
| id | select_type | table  | type | possible_keys | key  | key_len | ref  | rows   | Extra                            |
+----+-------------+--------+------+---------------+------+---------+------+--------+---------------------------------+
|  1 | SIMPLE      | orders | ALL  | NULL          | NULL | NULL    | NULL | 980000 | Using where; Using temporary; Using filesort |
+----+-------------+--------+------+---------------+------+---------+------+--------+---------------------------------+
```
1. `type: ALL` — a full table scan on nearly a million rows, with no usable index on `status`.
2. `Using temporary` — the `GROUP BY` needs a temp table because there's no index supporting grouped access.
3. `Using filesort` — the `ORDER BY count(*)` requires an extra sort pass since it's sorting on an aggregate, not an indexed column.
4. Add a composite index: `CREATE INDEX idx_orders_status_customer ON orders (status, customer_id);` — this lets the engine seek directly to `status = 'completed'` rows and scan them pre-grouped by `customer_id` via the index's own order, eliminating the full scan and the temp table (the `filesort` on the aggregate result remains, since sorting by a computed `count(*)` can't be satisfied by any index — but sorting 20-ish thousand grouped rows instead of scanning/grouping 980,000 raw rows is a dramatically smaller sort).
5. Re-run `EXPLAIN`: `type` becomes `ref`, `rows` drops to the actual count of completed orders, `Using temporary` disappears — measured runtime drops from ~2.1s to ~90ms.

### Example 3 — When adding an index makes things worse
A table with heavy write traffic (50,000 inserts/hour) gets a new index added to speed up an infrequent admin report query.
1. Report query speeds up from 8s to 40ms — a clear win, in isolation.
2. Within a day, write-path latency alerts fire: `INSERT` p99 latency on that table has grown from 12ms to 45ms.
3. Investigation: the new index, on a UUID column with no natural ordering, causes constant B-tree page splits on every insert (each new UUID lands in a random position in the index rather than appending at the end) — the exact mechanism described in the Index Internals section for poorly-chosen index keys on high-insert tables.
4. Trade-off decision: the admin report runs twice a month; the insert path runs continuously and is customer-facing. The index is dropped, and the report query is rewritten to run against a nightly-refreshed materialized view (Section 13) instead — decoupling "make this occasional report fast" from "don't regress the hot write path," which a straightforward index could not do simultaneously.
5. **Generalized lesson**: every index tuning decision on a write-heavy table needs to weigh the read benefit against the write cost explicitly — the Query Plan cheatsheet's tuning workflow (Section 10) says to "watch for regressions elsewhere" for exactly this reason, and this is what that looks like in practice.

---

## 15. Gotchas

- **The estimated-cost plan and the executed plan can differ** — parameters, prepared-statement generic plans, or a plan cached before a data-distribution shift can all mean `EXPLAIN` (without `ANALYZE`) shows something that isn't what actually ran; when in doubt, always get the `ANALYZE` version.
- **`EXPLAIN ANALYZE` actually executes the query**, including any writes — never run it directly against an `UPDATE`/`DELETE`/`INSERT` in production without wrapping in a transaction you intend to roll back, or use PostgreSQL's `EXPLAIN (ANALYZE, ...)` inside a `BEGIN; ... ROLLBACK;` block.
- **A missing index isn't always the answer** — sometimes the correct fix is denormalization, a materialized view, batching, or simply accepting a sequential scan on a small table (the planner may be right that a full scan beats an index seek for a tiny table, and forcing an index can make it slower).
- **Index bloat** (PostgreSQL, from MVCC dead tuples) and **fragmentation** (both engines, from random-order inserts/deletes) silently degrade index efficiency over time without any schema change — periodic `REINDEX`/`OPTIMIZE TABLE` maintenance matters even when nothing "changed."
- **Cardinality estimates for correlated columns are wrong by default** in both engines unless you explicitly tell the planner about the correlation (PostgreSQL's `CREATE STATISTICS`) — this is an easy, high-value fix that's frequently skipped.
- **`LIMIT` can change the chosen plan entirely**, not just truncate the output — a query with `LIMIT 10` may get an index-scan-with-early-exit plan, while the same query without `LIMIT` gets a full scan + sort; don't assume adding `LIMIT` to a slow query is "free."
- **Foreign keys don't automatically create an index on the referencing column** in PostgreSQL (they do implicitly index the referenced/parent side via its own primary key, but not the child column) — a very common source of slow-cascading-delete and slow-join surprises.
- **Query plan caching (prepared statements) can pick a "generic" plan** that's worse for a specific parameter value than a fresh plan would be — PostgreSQL's `plan_cache_mode` and MySQL's prepared-statement re-planning behavior both matter for parameterized queries with highly skewed value distributions.
