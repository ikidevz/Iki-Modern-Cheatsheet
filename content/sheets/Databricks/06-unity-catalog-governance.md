# Unity Catalog & Governance Cheatsheet

> Centralized, fine-grained governance for all data and AI assets across every workspace in your account — namespace, access control, lineage, sharing, and federation.

---

## 1. The Three-Level Namespace

```
metastore (1 per region, account-level)
   └── catalog
         └── schema (a.k.a. database)
               └── table / view / volume / function / model
```

```sql
SELECT * FROM my_catalog.my_schema.my_table;
USE CATALOG my_catalog;
USE SCHEMA my_schema;
SELECT * FROM my_table;  -- now resolves via USE context
```

- **Metastore**: one per region, attached to one or more workspaces; the top-level container for all UC metadata. All workspaces attached to the same metastore share the same governance model and can query each other's data (subject to grants).
- **Catalog**: typically maps to an environment or business unit (e.g., `dev`, `prod`, `marketing`, `finance`). This is the primary isolation boundary most orgs design around.
- **Schema**: groups related tables (like a traditional database) — usually maps to a domain or a pipeline stage (`bronze`, `silver`, `gold`, or `sales`, `hr`).

### Namespace Resolution Order
When you reference an unqualified table name, Databricks resolves it using session context in this order: explicit 3-part name → current `SCHEMA` (via `USE SCHEMA`) → current `CATALOG` (via `USE CATALOG`) → workspace default catalog (if configured). Always fully qualify names in production code/jobs to avoid ambiguity from session state.

---

## 2. Object Types Governed by Unity Catalog

| Object | Description |
|--------|-------------|
| **Table** (managed/external) | Structured data, Delta by default (Iceberg/Parquet also supported) |
| **View** | Saved query, including dynamic views for row/column masking |
| **Volume** | Governed storage for non-tabular files (replaces raw DBFS mounts) |
| **Function** (UDF) | Reusable SQL/Python logic, governed and grantable like any other asset |
| **Model** | ML models registered via the UC Model Registry |
| **External Location** | Named, governed pointer to a cloud storage path, backed by a Storage Credential |
| **Storage Credential** | Named, governed cloud IAM credential (role/service principal/managed identity) used to access storage |
| **Connection** | Governed connection to an external system (used by Lakehouse Federation) |
| **Share / Recipient** | Delta Sharing objects for cross-org/cross-platform data sharing |
| **Clean Room** | Isolated collaborative environment for privacy-safe joint analysis across organizations |

---

## 3. Managed vs. External Tables

| | Managed Table | External Table |
|---|---|---|
| Storage location | Chosen/owned by UC (under the catalog/schema's managed storage path) | You specify the exact path |
| `DROP TABLE` behavior | **Deletes underlying data files** | Only removes metadata, data stays in place |
| Predictive Optimization eligibility | ✅ (fully supported) | Partial/varies |
| Best for | Most day-to-day tables | Data that must persist independently, be accessed by non-UC tools, or is shared across systems |

```sql
-- Managed
CREATE TABLE cat.schema.t (id INT) USING DELTA;

-- External
CREATE TABLE cat.schema.t (id INT) USING DELTA LOCATION 's3://bucket/path/';
```

**Setting up External Locations (admin task):**
```sql
CREATE STORAGE CREDENTIAL my_credential
  WITH (AWS_IAM_ROLE = 'arn:aws:iam::123456789:role/uc-access-role');

CREATE EXTERNAL LOCATION my_location
  URL 's3://my-bucket/data/'
  WITH (STORAGE CREDENTIAL my_credential);

GRANT CREATE EXTERNAL TABLE ON EXTERNAL LOCATION my_location TO `data-engineers`;
```
This pattern — Storage Credential (the "how to authenticate") + External Location (the "where," bound to that credential) — is what lets UC broker secure, short-lived, scoped access to cloud storage without embedding cloud keys in notebooks. This mechanism is sometimes called **credential vending**.

---

## 4. Access Control (GRANT / REVOKE)

UC uses ANSI-SQL-style, **inheritable** privileges: a grant on a catalog cascades down to its schemas and tables unless a more specific (narrower) grant/deny overrides it.

```sql
GRANT USE CATALOG ON CATALOG my_catalog TO `data-engineers`;
GRANT USE SCHEMA ON SCHEMA my_catalog.sales TO `data-engineers`;
GRANT SELECT ON TABLE my_catalog.sales.orders TO `analysts`;
GRANT MODIFY ON TABLE my_catalog.sales.orders TO `etl-service-principal`;
GRANT ALL PRIVILEGES ON SCHEMA my_catalog.sales TO `sales-admins`;

REVOKE SELECT ON TABLE my_catalog.sales.orders FROM `analysts`;

SHOW GRANTS ON TABLE my_catalog.sales.orders;
SHOW GRANTS ON CATALOG my_catalog;
```

| Privilege | Grants ability to |
|-----------|--------------------|
| `USE CATALOG` / `USE SCHEMA` | Traverse the namespace (required before any object access below it — the most commonly forgotten grant) |
| `SELECT` | Read data |
| `MODIFY` | Insert/update/delete/merge |
| `CREATE TABLE` / `CREATE SCHEMA` / `CREATE FUNCTION` / `CREATE MODEL` | Create new objects of that type |
| `EXECUTE` | Run a function/model |
| `READ VOLUME` / `WRITE VOLUME` | Access files stored in a Volume |
| `ALL PRIVILEGES` | Everything applicable to that object type |
| `OWNER` | Full control including granting to others and transferring ownership |

> Best practice: grant privileges to **groups**, not individual users, and manage group membership via your identity provider (SCIM). This makes onboarding/offboarding and audits dramatically simpler.

---

## 5. Row-Level & Column-Level Security

**Column masking via dynamic views (portable pattern):**
```sql
CREATE VIEW sales.orders_masked AS
SELECT
  order_id,
  CASE WHEN is_member('pii-readers') THEN customer_email ELSE '***MASKED***' END AS customer_email
FROM sales.orders;
```

**Native row filters:**
```sql
CREATE FUNCTION region_filter(region STRING) RETURN
  is_member('admins') OR region = current_user_region();

ALTER TABLE sales.orders SET ROW FILTER region_filter ON (region);
```

**Native column masks:**
```sql
CREATE FUNCTION mask_email(email STRING) RETURNS STRING
  RETURN CASE WHEN is_member('pii-readers') THEN email ELSE '***' END;

ALTER TABLE sales.orders ALTER COLUMN customer_email SET MASK mask_email;
```

The native row filter/column mask approach is preferred over the dynamic-view pattern for new work — it applies directly on the base table (so every downstream view/query automatically inherits it) rather than requiring everyone to remember to query the masked view instead of the raw table.

### Attribute-Based Access Control (Tags)
Unity Catalog supports tagging catalogs, schemas, tables, and columns with key-value **governance tags** (e.g., `pii=true`, `cost_center=finance`), which can then be used inside row filter/column mask functions and in system-table-based reporting for a scalable, policy-driven approach instead of hardcoding table names into access rules.

```sql
ALTER TABLE sales.orders ALTER COLUMN customer_email SET TAGS ('pii' = 'true');
```

---

## 6. Data Lineage

Unity Catalog **automatically** captures column- and table-level lineage for anything run on Databricks compute — no extra configuration or manual annotation required.

- View via **Catalog Explorer** (Lineage tab) on any table/column — shows upstream sources and downstream consumers, including notebooks, jobs, DLT pipelines, dashboards, and ML models trained on that data.
- Lineage is captured at **column granularity**, so you can trace exactly which upstream columns fed into a specific downstream column via a transformation.
- Exposed programmatically via the **Lineage REST API** and the `system.access.table_lineage` / `system.access.column_lineage` system tables for integration into external catalogs or impact-analysis tooling.

**Common use case:** before dropping or renaming a column, query the lineage system tables to identify every downstream table/dashboard/job that depends on it, preventing silent breakage.

---

## 7. Auditing — System Tables

UC exposes built-in **system tables** (under the `system` catalog) for observability without any extra setup:

```sql
SELECT * FROM system.access.audit
WHERE action_name = 'getTable' AND event_time > current_date() - 1;

SELECT * FROM system.billing.usage;              -- DBU consumption
SELECT * FROM system.compute.clusters;           -- cluster inventory
SELECT * FROM system.access.table_lineage;       -- lineage as queryable data
SELECT * FROM system.information_schema.tables;  -- ANSI-standard metadata catalog
```

`system.information_schema` mirrors the ANSI-SQL standard `INFORMATION_SCHEMA` views (`tables`, `columns`, `schemata`, `table_privileges`) and is the recommended way to programmatically inventory objects and grants, rather than scraping `SHOW` command output.

---

## 8. Lakehouse Federation

Query external operational databases (PostgreSQL, MySQL, SQL Server, Snowflake, Redshift, BigQuery, and others) **directly through Unity Catalog** as a foreign catalog, without first ETL-ing the data into Delta.

```sql
CREATE CONNECTION pg_conn TYPE POSTGRESQL
OPTIONS (host = 'db.example.com', port = '5432', user = 'reader', password = secret('scope','pg_pw'));

CREATE FOREIGN CATALOG pg_catalog USING CONNECTION pg_conn
OPTIONS (database = 'analytics');

SELECT * FROM pg_catalog.public.customers;  -- queried live, governed the same as any UC table
```
Useful for ad hoc joins against operational systems or as a stepping stone before building a proper ingestion pipeline — not typically a replacement for high-volume production ETL due to load on the source system.

---

## 9. Delta Sharing

Share live Delta tables with other organizations (or other platforms) **without copying data**, using an open protocol.

```sql
CREATE SHARE sales_share;
ALTER SHARE sales_share ADD TABLE my_catalog.sales.orders;
CREATE RECIPIENT partner_org;
GRANT SELECT ON SHARE sales_share TO RECIPIENT partner_org;
```

- **Databricks-to-Databricks sharing**: recipient authenticates using their own UC identity — grants can be managed the same way as internal grants.
- **Open sharing**: recipient gets a credential file and can read shared tables from any client that supports the open Delta Sharing protocol — pandas, Spark, Power BI, Tableau, etc. — with no Databricks account required on their side.
- **Databricks Marketplace** is built on top of Delta Sharing, letting you publish/discover shareable datasets and Solution Accelerators across organizations.

---

## 10. Clean Rooms

For scenarios where two or more parties want to run **joint analysis** (e.g., audience overlap, attribution) without either party exposing raw row-level data to the other:
- Each party contributes tables from their own UC metastore into a shared, access-controlled Clean Room.
- Analysis code (typically pre-approved/templated queries) runs inside the Clean Room; only the **aggregate output**, not the underlying rows, is visible to participants.
- Useful for advertising/media measurement, healthcare data collaboration, and other privacy-sensitive cross-company analytics.

---

## 11. Identity: Users, Service Principals, Groups

| Identity type | Use case |
|---------------|----------|
| **User** | Human, authenticated via SSO/SCIM |
| **Service Principal** | Non-human identity for jobs, CI/CD, and automated workflows — the recommended identity to `run_as` for production jobs |
| **Group** | Collection of users/service principals — the recommended unit for grants |

```sql
-- Everything should be granted to groups synced from your IdP, e.g.:
GRANT SELECT ON SCHEMA sales TO `sales-analysts-group`;
```

---

## 12. Migrating from Hive Metastore

| Legacy (Hive Metastore) | Unity Catalog |
|--------------------------|----------------|
| `hive_metastore.db.table` | `catalog.schema.table` |
| Table ACLs (cluster-scoped, inconsistent across clusters) | Account-wide, workspace-independent grants |
| DBFS mounts (`/mnt/...`) | External Locations + Volumes |
| No built-in lineage | Automatic column-level lineage |
| No cross-workspace governance | Single governance plane shared across all workspaces on the metastore |
| Per-cluster credential passthrough | Centralized Storage Credentials with fine-grained grants |

Use the **UC upgrade wizard** / `SYNC` command in Catalog Explorer to bulk-migrate Hive tables and their permissions into Unity Catalog with minimal manual rework.

```sql
SYNC SCHEMA my_catalog.my_schema FROM hive_metastore.my_schema;
```

---

## 13. Governance Checklist

- [ ] Every workspace attached to a Unity Catalog metastore (no lingering Hive Metastore usage)
- [ ] Groups synced from IdP via SCIM; grants target groups, never individual users
- [ ] Storage Credentials scoped to least-privilege IAM roles, one per logical storage boundary
- [ ] Row filters/column masks applied on sensitive tables at the base-table level, not just via views
- [ ] Lineage reviewed before any breaking schema change (column drop/rename)
- [ ] Production jobs `run_as` a service principal, not a personal account
- [ ] Audit logs (`system.access.audit`) monitored for anomalous access patterns

---

## Related Cheatsheets
- [Cost, Governance & Troubleshooting](./11-cost-governance-troubleshooting.md)
- [DevOps & CI/CD](./10-devops-cicd.md)
- [MLflow & ML](./12-mlflow-ml.md) — model governance via UC
