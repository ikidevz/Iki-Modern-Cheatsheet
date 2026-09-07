# 5. Physical Data Modeling

## Purpose

Translate the logical model into an actual implementation on a specific database engine — exact data types, indexes, partitioning, constraints, and storage considerations.

## Choosing Data Types (Engine-Specific)

| Logical Type | PostgreSQL | MySQL | SQL Server |
|---|---|---|---|
| Text (short) | `VARCHAR(n)` | `VARCHAR(n)` | `VARCHAR(n)` / `NVARCHAR(n)` |
| Text (long) | `TEXT` | `TEXT` | `VARCHAR(MAX)` |
| Integer | `INT` / `BIGINT` | `INT` / `BIGINT` | `INT` / `BIGINT` |
| Decimal/Money | `NUMERIC(p,s)` | `DECIMAL(p,s)` | `DECIMAL(p,s)` / `MONEY` |
| Date/Time | `TIMESTAMP` | `DATETIME` | `DATETIME2` |
| Boolean | `BOOLEAN` | `TINYINT(1)` | `BIT` |
| UUID | `UUID` | `CHAR(36)` / `BINARY(16)` | `UNIQUEIDENTIFIER` |
| JSON | `JSONB` | `JSON` | `NVARCHAR(MAX)` + JSON functions |

**On-the-job tip:** Always pick the *smallest* type that safely fits your data range — using `BIGINT` for a column that will never exceed 1000 wastes storage and can hide poor planning. But don't over-optimize prematurely on a column that might grow (e.g., use `BIGINT` for auto-increment PKs on high-volume tables to avoid painful future migrations).

## Indexing Fundamentals

| Index Type | Best For | Trade-off |
|---|---|---|
| **B-Tree** (default) | Equality & range queries (`WHERE`, `ORDER BY`) | Standard, works for most cases |
| **Hash** | Pure equality lookups | Can't do range queries |
| **Composite (multi-column)** | Queries filtering on multiple columns together | Column order matters! |
| **Unique** | Enforcing uniqueness (also indexes) | Slight write overhead |
| **Full-text** | Text search | Larger storage, engine-specific syntax |
| **GIN/GiST (Postgres)** | JSONB, arrays, geo data | Postgres-specific |

**Composite index column order rule:** Put the most selective / most frequently filtered column first — an index on `(status, created_at)` helps `WHERE status = 'active'` and `WHERE status = 'active' AND created_at > X`, but does NOT help `WHERE created_at > X` alone.

**When indexes hurt:** Every index speeds up reads but slows down writes (INSERT/UPDATE/DELETE must update the index too). Don't index columns you rarely filter/sort by.

## Partitioning

Splitting a large table into smaller physical pieces while keeping one logical table name.

| Partition Type | Use Case |
|---|---|
| **Range** | Time-series data (e.g., partition `Orders` by month) |
| **List** | Discrete categories (e.g., partition by `region`) |
| **Hash** | Even distribution when there's no natural range/list key |

Example (PostgreSQL range partitioning):
```sql
CREATE TABLE orders (
    order_id BIGINT,
    order_date DATE,
    customer_id BIGINT
) PARTITION BY RANGE (order_date);

CREATE TABLE orders_2026_q1 PARTITION OF orders
    FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
```

**Why it matters on the job:** Queries that filter on the partition key only scan relevant partitions ("partition pruning"), dramatically speeding up large table scans, and makes archiving old data (drop a partition) trivial.

## Constraints at the Physical Level

```sql
CREATE TABLE orders (
    order_id BIGINT PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending','shipped','delivered','cancelled')),
    total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

- `NOT NULL` — enforce required fields at the DB level, don't rely only on app code.
- `CHECK` — enforce business rules (e.g., no negative prices).
- `FOREIGN KEY ... ON DELETE` — decide cascade behavior explicitly (`CASCADE`, `RESTRICT`, `SET NULL`).
- `UNIQUE` — enforce uniqueness beyond the PK (e.g., `email`).

## Storage & Performance Considerations

- **Row vs Column storage:** Row-oriented (Postgres, MySQL) is best for OLTP (fetch whole records). Column-oriented (Redshift, BigQuery, Snowflake) is best for OLAP (aggregate one column across millions of rows).
- **Normalization vs storage cost:** More normalized = less storage but more joins. More denormalized = more storage but fewer joins.
- **Clustering/sort keys** (in warehouses like Redshift/Snowflake): physically order data on disk by a frequently filtered column to speed up scans.
- **Vacuuming/maintenance** (Postgres-specific): dead tuples from updates/deletes need periodic cleanup (`VACUUM`) or performance degrades.

## Common Mistakes

- Choosing data types that don't match real-world constraints (e.g., `VARCHAR(10)` for names that can be longer, causing runtime errors).
- Adding indexes on every column "just in case," bloating writes.
- Ignoring partitioning until a table has hundreds of millions of rows and every query has become a full table scan.
- Not indexing foreign key columns — many engines don't auto-index FKs, and unindexed FKs kill join performance.

---
[← Previous: Normalization & Denormalization](04-normalization-denormalization.md) | [Back to index](00-README.md) | [Next: Relational Modeling →](06-relational-modeling.md)
