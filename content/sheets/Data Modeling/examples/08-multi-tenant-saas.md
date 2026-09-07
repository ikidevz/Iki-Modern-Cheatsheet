# 8. Multi-tenant SaaS

## Scenario

A B2B SaaS product where multiple customer organizations ("tenants") share the same application, but their data must be strictly isolated from each other. The core modeling decision isn't entities/relationships — it's **which tenant-isolation strategy to use**, since it affects every table in the schema.

## The Three Isolation Strategies

### Strategy 1: Shared Schema, Shared Tables (Tenant ID Column)

Every table gets a `tenant_id` column; all tenants' data lives in the same tables.

```sql
CREATE TABLE tenant (
    tenant_id BIGSERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE app_user (
    user_id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenant(tenant_id),
    email VARCHAR(255) NOT NULL,
    UNIQUE (tenant_id, email)   -- email unique PER TENANT, not globally
);

CREATE TABLE project (
    project_id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenant(tenant_id),
    name VARCHAR(255) NOT NULL
);

-- CRITICAL: every query must filter by tenant_id, or use Row-Level Security
CREATE INDEX idx_project_tenant ON project(tenant_id);
```

**Enforcing isolation with PostgreSQL Row-Level Security (defense in depth):**
```sql
ALTER TABLE project ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON project
    USING (tenant_id = current_setting('app.current_tenant_id')::BIGINT);
```

| Pros | Cons |
|---|---|
| Cheapest to run (one database, one schema) | Highest risk — a single missing `WHERE tenant_id = ?` leaks data across tenants |
| Easiest to add new tenants (just insert a row) | Noisy-neighbor risk — one huge tenant's queries can slow down others |
| Simplest for cross-tenant analytics (internal reporting) | Harder to give one tenant a customized schema |

### Strategy 2: Schema-per-Tenant

Same database, but each tenant gets their own PostgreSQL schema (namespace) with identical table structures.

```sql
CREATE SCHEMA tenant_acme;
CREATE SCHEMA tenant_globex;

CREATE TABLE tenant_acme.project (project_id BIGSERIAL PRIMARY KEY, name VARCHAR(255));
CREATE TABLE tenant_globex.project (project_id BIGSERIAL PRIMARY KEY, name VARCHAR(255));
```

| Pros | Cons |
|---|---|
| Stronger isolation than shared tables | Schema migrations must run against every tenant's schema |
| Per-tenant customization is easier | Connection/query routing logic gets more complex |
| Easier to back up/restore a single tenant | Doesn't scale cleanly past a few hundred–thousand tenants |

### Strategy 3: Database-per-Tenant

Each tenant gets a fully separate database (sometimes on separate physical servers).

| Pros | Cons |
|---|---|
| Strongest isolation — physically separate data | Most expensive and operationally complex |
| Easy to meet strict compliance/data-residency requirements (e.g., EU tenant data must stay in the EU) | Cross-tenant reporting requires aggregating across many databases |
| Per-tenant scaling/tuning possible | Not practical for thousands of small tenants |

## Decision Guide

| If... | Choose |
|---|---|
| You have thousands of small/mid tenants, cost-sensitive | Shared schema + tenant_id |
| You need moderate isolation and per-tenant customization, tenant count is moderate (dozens-hundreds) | Schema-per-tenant |
| You have large enterprise tenants with compliance/data-residency requirements | Database-per-tenant |
| Mixed tenant sizes (common in practice) | Hybrid: small tenants share a schema; large/enterprise tenants get dedicated databases |

## Sample Query Pattern (Shared Schema Strategy)

**Every single query needs tenant scoping — this is the #1 rule of this pattern:**
```sql
-- CORRECT
SELECT * FROM project WHERE tenant_id = 42 AND status = 'active';

-- DANGEROUS — missing tenant_id filter, leaks all tenants' data
SELECT * FROM project WHERE status = 'active';
```

**Application-layer safeguard pattern** (in addition to RLS): wrap all data access in a repository layer that automatically injects `tenant_id` from the authenticated session, so individual feature code can never forget the filter.

## NoSQL Variant: Tenant Isolation in Document/Wide-Column Stores

The same three strategies apply conceptually, with NoSQL-specific implementations:

- **Shared collection + tenant_id field** (MongoDB): every document gets a `tenant_id` field; queries always filter on it; a compound index `{tenant_id: 1, ...}` should lead every index.
  ```json
  { "_id": "proj_501", "tenant_id": "tenant_acme", "name": "Website Redesign" }
  ```
- **Database-per-tenant** (MongoDB): each tenant gets a separate database on the same cluster — a common middle ground, since MongoDB makes creating new databases cheap.
- **Partition-key-per-tenant** (DynamoDB/Cassandra): use `tenant_id` as (part of) the partition key — this naturally co-locates each tenant's data and scales isolation with the database's native partitioning, e.g., `PK = TENANT#acme#PROJECT#501`.

## Advanced / Edge-Case Queries

**Cross-tenant leak integrity check — should ALWAYS return zero rows; run this in CI or as a scheduled audit against staging data seeded with 2+ tenants:**
```sql
-- Any project referencing a tenant_id that doesn't exist in the tenant table at all is an orphan/leak
SELECT p.project_id, p.tenant_id
FROM project p
LEFT JOIN tenant t ON p.tenant_id = t.tenant_id
WHERE t.tenant_id IS NULL;

-- In application code, the more common check is: does the query's WHERE clause include
-- tenant_id at all? Automated tools (or a thin repository layer) can scan for queries
-- against tenant-scoped tables that are missing a tenant_id predicate.
```

**Per-tenant resource usage for usage-based billing or capacity planning:**
```sql
SELECT t.company_name,
       COUNT(DISTINCT pr.project_id) AS project_count,
       COUNT(DISTINCT u.user_id) AS user_count
FROM tenant t
LEFT JOIN project pr ON t.tenant_id = pr.tenant_id
LEFT JOIN app_user u ON t.tenant_id = u.tenant_id
GROUP BY t.company_name
ORDER BY project_count DESC;
```

**Noisy-neighbor detection — tenants whose data volume is a statistical outlier relative to the rest (candidates for migration to a dedicated schema/database):**
```sql
WITH tenant_sizes AS (
    SELECT tenant_id, COUNT(*) AS row_count
    FROM project
    GROUP BY tenant_id
)
SELECT tenant_id, row_count
FROM tenant_sizes
WHERE row_count > (SELECT AVG(row_count) + 3 * STDDEV(row_count) FROM tenant_sizes);
```

**Bulk export of a single tenant's data (e.g., migrating them from shared schema to a dedicated schema/database):**
```sql
COPY (SELECT * FROM project WHERE tenant_id = 42) TO '/tmp/tenant_42_projects.csv' WITH CSV HEADER;
COPY (SELECT * FROM app_user WHERE tenant_id = 42) TO '/tmp/tenant_42_users.csv' WITH CSV HEADER;
```

**Per-tenant rate limiting table design (supports the "noisy neighbor" problem at the application layer):**
```sql
CREATE TABLE tenant_rate_limit (
    tenant_id BIGINT PRIMARY KEY REFERENCES tenant(tenant_id),
    requests_per_minute INT NOT NULL DEFAULT 1000,
    current_window_start TIMESTAMP NOT NULL DEFAULT now(),
    current_window_count INT NOT NULL DEFAULT 0
);
-- Application increments current_window_count per request and resets it each minute,
-- rejecting requests once current_window_count exceeds requests_per_minute for that tenant.
```

## Design Decisions & Trade-offs

- **`UNIQUE (tenant_id, email)` instead of `UNIQUE (email)`** on `app_user` — two different tenants' users can legitimately share an email address (e.g., a contractor working with two client companies); uniqueness should be scoped per-tenant, not global, unless the product explicitly requires one global user identity across tenants.
- **Row-Level Security is a defense-in-depth layer, not a replacement for careful query code** — RLS protects against a forgotten `WHERE` clause, but the application should still scope queries explicitly; relying on RLS alone can hide the fact that a query is doing far more table scanning than intended.
- **Choosing a strategy early matters immensely** because migrating from shared-schema to schema-per-tenant (or vice versa) after launch is a major, risky engineering project — not a config change.

## Common Pitfalls

- Forgetting `tenant_id` on a new table added later in the product's life, silently creating a cross-tenant data leak.
- Making `email` (or other natural keys) globally unique instead of tenant-scoped, blocking legitimate cross-tenant email reuse.
- Not indexing `tenant_id` as the leading column in composite indexes, causing full-table scans even when other filters are indexed.
- Choosing database-per-tenant for a product expecting tens of thousands of small tenants — operational overhead becomes unmanageable at that scale.

---
[← Previous: Subscription & Billing](07-subscription-billing.md) | [Back to index](00-README.md) | [Next: Hierarchical Data →](09-hierarchical-data.md)
