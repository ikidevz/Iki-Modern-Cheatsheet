# 🔐 Data Sharing, Security & Governance

> RBAC, masking, row access policies, tagging, and Secure Data Sharing — the daily-relevant governance surface for a senior DE (grants, lineage, compliance).

---

## 1. RBAC Model

Snowflake RBAC is **role-based, hierarchical, and roles are granted to roles** (not just to users) — this is the part people coming from simpler RBAC systems get wrong.

```sql
-- Create a role and build a hierarchy
CREATE ROLE analyst_role;
CREATE ROLE senior_analyst_role;
GRANT ROLE analyst_role TO ROLE senior_analyst_role;   -- senior inherits everything analyst can do
GRANT ROLE senior_analyst_role TO USER jane_doe;

-- Standard privilege grant pattern
GRANT USAGE ON WAREHOUSE etl_wh TO ROLE analyst_role;
GRANT USAGE ON DATABASE sales_db TO ROLE analyst_role;
GRANT USAGE ON SCHEMA sales_db.public TO ROLE analyst_role;
GRANT SELECT ON ALL TABLES IN SCHEMA sales_db.public TO ROLE analyst_role;

-- CRITICAL: future grants — without this, new tables created tomorrow are invisible to the role
GRANT SELECT ON FUTURE TABLES IN SCHEMA sales_db.public TO ROLE analyst_role;

-- See what a role can actually do (debugging access issues)
SHOW GRANTS TO ROLE analyst_role;
SHOW GRANTS OF ROLE analyst_role;      -- who/what holds this role
SHOW GRANTS ON TABLE sales_db.public.orders;   -- who can access this specific object

-- Revoke a privilege
REVOKE SELECT ON TABLE sales_db.public.orders FROM ROLE analyst_role;
```

> 🔑 **The #1 access-debugging gotcha:** a user can hold a role that has `SELECT` on a table, but if their **current session role** isn't set to that role (or a role that inherits it), the query still fails with "object does not exist or not authorized." Always check `SELECT CURRENT_ROLE()` first when debugging "I should have access but don't."

```sql
-- Default role vs session role — a common source of confusion
SELECT CURRENT_ROLE(), CURRENT_AVAILABLE_ROLES();
USE ROLE senior_analyst_role;   -- explicitly switch, doesn't happen automatically mid-session

-- Set a user's default role (what they land on when connecting, unless overridden)
ALTER USER jane_doe SET DEFAULT_ROLE = senior_analyst_role;
```

**System-defined roles (know the hierarchy):**

| Role | Purpose |
|---|---|
| `ORGADMIN` | Manages accounts within an organization |
| `ACCOUNTADMIN` | Top-level account admin — should have very few members, MFA-enforced |
| `SECURITYADMIN` | Manages grants and roles |
| `USERADMIN` | Manages users and roles (narrower than SECURITYADMIN) |
| `SYSADMIN` | Typically owns all warehouse/db/schema objects — custom roles chain up to here |
| `PUBLIC` | Implicitly granted to every user — anything granted here is visible to everyone |

### 1.1 Custom Role Hierarchy Design (a real architecture decision)

A common, scalable pattern for a mid-size org:

```sql
-- Functional roles (own objects, granted by domain)
CREATE ROLE sales_data_owner;
CREATE ROLE marketing_data_owner;

-- Access-level roles (granted to people, inherit from functional roles)
CREATE ROLE sales_analyst_ro;      -- read-only
CREATE ROLE sales_engineer_rw;     -- read-write

GRANT SELECT ON ALL TABLES IN SCHEMA sales_db.public TO ROLE sales_analyst_ro;
GRANT ALL ON ALL TABLES IN SCHEMA sales_db.public TO ROLE sales_engineer_rw;

-- Always attach ALL custom roles up to SYSADMIN so admins retain visibility/ownership control
GRANT ROLE sales_data_owner TO ROLE SYSADMIN;
```

> ⚠️ **Anti-pattern to avoid:** granting object privileges directly to individual users instead of through roles. It works in a demo, then becomes unmanageable and unauditable within a quarter — always grant to roles, grant roles to users.

---

## 2. Dynamic Data Masking

Column-level masking, applied at query time, based on the querying role — same underlying data, different visibility.

```sql
-- Create a masking policy
CREATE MASKING POLICY ssn_mask AS (val STRING) RETURNS STRING ->
    CASE
        WHEN CURRENT_ROLE() IN ('COMPLIANCE_ROLE', 'ACCOUNTADMIN') THEN val
        ELSE 'XXX-XX-' || RIGHT(val, 4)
    END;

-- Apply it to a column
ALTER TABLE customers MODIFY COLUMN ssn SET MASKING POLICY ssn_mask;

-- Policy applies transparently — same query, different result per role
-- (as COMPLIANCE_ROLE) → 123-45-6789
-- (as ANALYST_ROLE)    → XXX-XX-6789

-- Conditional masking based on a SECOND column (e.g., mask email unless region = 'US')
CREATE MASKING POLICY email_mask AS (val STRING, region STRING) RETURNS STRING ->
    CASE
        WHEN CURRENT_ROLE() = 'COMPLIANCE_ROLE' THEN val
        WHEN region != 'US' THEN val
        ELSE REGEXP_REPLACE(val, '.+@', '*****@')
    END;

ALTER TABLE customers MODIFY COLUMN email
    SET MASKING POLICY email_mask USING (email, region);

-- Full/partial masking based on a hierarchy of roles (common in regulated industries)
CREATE MASKING POLICY tiered_pii_mask AS (val STRING) RETURNS STRING ->
    CASE
        WHEN IS_ROLE_IN_SESSION('COMPLIANCE_ROLE') THEN val
        WHEN IS_ROLE_IN_SESSION('SUPPORT_ROLE') THEN LEFT(val, 2) || '****'
        ELSE '***MASKED***'
    END;

-- See which columns have masking policies applied account-wide
SELECT *
FROM snowflake.account_usage.policy_references
WHERE policy_kind = 'MASKING_POLICY';

-- Unset a masking policy from a column
ALTER TABLE customers MODIFY COLUMN ssn UNSET MASKING POLICY;
```

### 2.1 External Tokenization (masking that also protects at rest)

For cases where even the storage layer shouldn't hold the raw value, pair masking policies with **External Tokenization** (calling an external function to tokenize/detokenize via a partner service) rather than storing plaintext PII in Snowflake at all. This is a specialized setup (external functions + a tokenization vendor) — reach for it when compliance requires that raw PII never lands in Snowflake's storage layer, even encrypted.

---

## 3. Row Access Policies

Restrict *which rows* a role can see — the row-level equivalent of masking.

```sql
CREATE ROW ACCESS POLICY region_filter AS (region STRING) RETURNS BOOLEAN ->
    CURRENT_ROLE() = 'ACCOUNTADMIN'
    OR region = CURRENT_ROLE()   -- e.g. role 'APAC' only sees region = 'APAC' rows
    ;

ALTER TABLE sales ADD ROW ACCESS POLICY region_filter ON (region);

-- A user querying SELECT * FROM sales transparently only sees rows their role is entitled to
-- No application-level filtering logic needed — enforced at the storage/query layer

-- Mapping-table-driven row access (scales better than hardcoding roles in the policy body)
CREATE TABLE region_access_map (role_name STRING, allowed_region STRING);
INSERT INTO region_access_map VALUES ('APAC_ROLE', 'APAC'), ('EMEA_ROLE', 'EMEA');

CREATE ROW ACCESS POLICY region_filter_v2 AS (region STRING) RETURNS BOOLEAN ->
    EXISTS (
        SELECT 1 FROM region_access_map
        WHERE role_name = CURRENT_ROLE() AND allowed_region = region
    );

ALTER TABLE sales ADD ROW ACCESS POLICY region_filter_v2 ON (region);

-- Drop a row access policy
ALTER TABLE sales DROP ROW ACCESS POLICY region_filter;

-- Audit which tables have row access policies
SELECT * FROM snowflake.account_usage.policy_references WHERE policy_kind = 'ROW_ACCESS_POLICY';
```

> ⚠️ **Performance note:** row access policies are evaluated on every query against the protected table — a policy with an expensive subquery (like the mapping-table pattern above) adds overhead to every single scan. Keep the policy body as cheap as possible; a small, well-indexed-by-clustering mapping table is fine, a policy joining across multiple large tables is not.

---

## 4. Tag-Based Governance

Tags let you classify objects (PII, cost center, data domain) and then apply masking/access rules **at the tag level** instead of per-column — this is what scales governance past a handful of tables.

```sql
-- Create a tag
CREATE TAG pii_level ALLOWED_VALUES 'high', 'medium', 'low';
CREATE TAG data_domain ALLOWED_VALUES 'sales', 'marketing', 'finance', 'hr';

-- Apply it to a column
ALTER TABLE customers MODIFY COLUMN ssn SET TAG pii_level = 'high';
ALTER TABLE customers SET TAG data_domain = 'sales';

-- Attach a masking policy to the TAG (not the column) — auto-applies to every column tagged this way
ALTER TAG pii_level SET MASKING POLICY ssn_mask;

-- Find every column tagged as high-PII across the whole account (compliance audits)
SELECT *
FROM snowflake.account_usage.tag_references
WHERE tag_name = 'PII_LEVEL' AND tag_value = 'high';

-- Object tagging also drives cost attribution
ALTER WAREHOUSE etl_wh SET TAG cost_center = 'data_engineering';

-- Tag-based masking policy inheritance: newly tagged columns automatically inherit the
-- policy without any per-column ALTER TABLE — this is the real scalability win
ALTER TABLE new_pii_table MODIFY COLUMN national_id SET TAG pii_level = 'high';
-- ^ ssn_mask policy now applies automatically, no separate MASKING POLICY statement needed
```

---

## 5. Object-Level Security Details

```sql
-- Column-level grants (rare, but available for very fine-grained needs — usually masking
-- policies are preferred over restricting column visibility entirely)
GRANT SELECT (order_id, order_date) ON TABLE orders TO ROLE limited_role;

-- Secure views — hide the view definition/logic from consumers, and prevent the optimizer
-- from pushing user predicates INTO the view in ways that could leak filtered-out data
CREATE SECURE VIEW customer_summary AS
SELECT customer_id, SUM(amount) AS total_spend
FROM orders
GROUP BY customer_id;

-- Ownership transfer
GRANT OWNERSHIP ON TABLE orders TO ROLE new_owner_role;
```

> 🔑 **Why Secure Views matter beyond "hiding SQL":** a normal view can, in some optimizer scenarios, leak information through predicate pushdown side channels (e.g., a user filtering on a column not exposed by the view can sometimes infer data via query timing/errors). Secure Views disable this class of optimization for views that need to enforce strict data boundaries — always use them for any view sitting in front of masked/row-restricted data shared externally.

---

## 6. Network Policies & Authentication

```sql
-- Restrict which IP ranges can connect at all (defense in depth beyond RBAC)
CREATE NETWORK POLICY corp_network_only
    ALLOWED_IP_LIST = ('203.0.113.0/24', '198.51.100.0/24');

ALTER USER jane_doe SET NETWORK_POLICY = corp_network_only;
ALTER ACCOUNT SET NETWORK_POLICY = corp_network_only;   -- account-wide default

-- MFA enforcement
ALTER USER jane_doe SET MINS_TO_BYPASS_MFA = 0;   -- effectively require MFA always

-- SSO / OAuth via a security integration (delegate auth to an external IdP)
CREATE SECURITY INTEGRATION okta_sso
    TYPE = SAML2
    ENABLED = TRUE
    SAML2_ISSUER = '...'
    SAML2_SSO_URL = '...'
    SAML2_PROVIDER = 'OKTA';

-- Key-pair authentication for service accounts (recommended over passwords for CI/pipelines)
ALTER USER svc_etl SET RSA_PUBLIC_KEY = 'MIIBIjANBgkqh...';
```

> 🔑 **Service account best practice:** every automated pipeline/CI credential should use **key-pair auth**, not a password, and should be scoped to a role with the minimum privileges the pipeline actually needs — never `ACCOUNTADMIN` or `SYSADMIN` for a scheduled job's service user.

---

## 7. Secure Data Sharing

Share **live, read-only** data with another Snowflake account — no data copying, no ETL, no file exports.

```sql
-- Create a share, add objects, add a consumer account
CREATE SHARE sales_share;
GRANT USAGE ON DATABASE sales_db TO SHARE sales_share;
GRANT USAGE ON SCHEMA sales_db.public TO SHARE sales_share;
GRANT SELECT ON TABLE sales_db.public.orders TO SHARE sales_share;
ALTER SHARE sales_share ADD ACCOUNTS = ('partner_account_locator');

-- Consumer side: create a database FROM the share (read-only, always live/current)
CREATE DATABASE partner_sales_db FROM SHARE provider_account.sales_share;

-- Reader Accounts: for sharing with organizations that don't have their own Snowflake account
CREATE MANAGED ACCOUNT reader_acct
    ADMIN_NAME = 'admin', ADMIN_PASSWORD = '...', TYPE = 'READER';

-- List shares you're providing or consuming
SHOW SHARES;

-- Secure views are the standard way to share a masked/filtered slice of data, not raw tables
GRANT SELECT ON VIEW sales_db.public.customer_summary TO SHARE sales_share;
```

> 🔑 **Why this matters for a DE:** Secure Data Sharing eliminates the "export → SFTP → reload" pattern entirely for cross-account/cross-org data handoffs — the consumer always sees live data with zero pipeline to maintain on either side.

---

## 8. Snowflake Marketplace

- Discover and mount **third-party datasets** (weather, demographics, financial) directly as a share — same zero-copy mechanism as internal sharing
- Also how you'd **publish and monetize** a dataset externally
- Mounted marketplace data behaves like any other database — join it directly in SQL, no ingestion step

```sql
-- Once acquired from Marketplace UI, query immediately like any other database
SELECT * FROM weather_data.public.daily_forecast WHERE city = 'Seattle';
```

---

## 9. Object Access Auditing & Compliance

```sql
-- Who accessed what, when — critical for compliance/audit requests
SELECT
    query_text,
    user_name,
    role_name,
    start_time
FROM snowflake.account_usage.query_history
WHERE query_text ILIKE '%customers%'
ORDER BY start_time DESC;

-- Column-level access history (which queries touched a specific PII column)
SELECT *
FROM snowflake.account_usage.access_history,
     LATERAL FLATTEN(input => direct_objects_accessed)
WHERE value:columnName::string = 'SSN';

-- Full lineage: what objects fed into a given table (source tracking for impact analysis)
SELECT *
FROM snowflake.account_usage.access_history,
     LATERAL FLATTEN(input => objects_modified)
WHERE value:objectName::string = 'SALES_DB.PUBLIC.ORDERS_SUMMARY';
```

### 9.1 Common Compliance Framework Mappings

| Requirement | Snowflake mechanism |
|---|---|
| PII must be masked for non-authorized roles | Dynamic Data Masking + Tags |
| Data residency (GDPR — EU data stays in EU) | Region-specific account deployment |
| Right to erasure | `DELETE` + reduced Time Travel/Fail-safe retention on the affected table, tracked via audit query |
| Access audit trail (SOC2/HIPAA) | `ACCESS_HISTORY`, `LOGIN_HISTORY`, `QUERY_HISTORY` in `ACCOUNT_USAGE` |
| Least-privilege access | Custom RBAC role hierarchy, `FUTURE GRANTS` scoping |
| Encryption at rest/in transit | On by default (AES-256, TLS) — not something you configure, but good to know for audits |

---

## 10. Quick Reference: Unity Catalog ↔ Snowflake Governance

| Databricks / Unity Catalog concept | Snowflake equivalent |
|---|---|
| Unity Catalog metastore | Account (governance is account-wide by default) |
| UC three-level namespace (catalog.schema.table) | Database.schema.table |
| Column masking (UC) | Dynamic Data Masking policies |
| Row filters (UC) | Row Access Policies |
| UC tags | Snowflake Tags |
| Delta Sharing | Secure Data Sharing |
| Databricks Marketplace | Snowflake Marketplace |
| System tables (`system.access.audit`) | `ACCOUNT_USAGE` / `ACCESS_HISTORY` views |
| UC lineage graph | `ACCESS_HISTORY` `objects_modified`/`direct_objects_accessed` flatten queries |
| Cluster policies / IP access lists | Network Policies |

---

## 11. Interview / Self-Check Q&A

**Q: A user's role has `SELECT` granted on a table, but they still get "not authorized." What's the first thing to check?**
A: Their current session role (`SELECT CURRENT_ROLE()`) — holding a role isn't the same as having switched to it (or a role that inherits it) for the current session.

**Q: Why grant privileges to roles instead of directly to users?**
A: Roles are reusable, auditable, and hierarchical — direct user grants don't scale, are hard to audit, and break the moment someone changes teams (you'd have to hunt down every object grant manually instead of just reassigning a role).

**Q: What's the difference between a masking policy and a row access policy?**
A: Masking policies control what a role sees WITHIN a column's value (redact/obfuscate); row access policies control WHICH rows a role sees at all (row-level filtering) — they compose together on the same table.

**Q: Why use tag-based masking instead of applying a masking policy directly to each column?**
A: New columns matching the same sensitivity classification automatically inherit the policy the moment they're tagged — no need to remember to run `ALTER TABLE ... SET MASKING POLICY` on every future PII column added anywhere in the account.

**Q: Why are Secure Views specifically recommended when sharing data externally via Secure Data Sharing?**
A: Regular views can leak information through certain optimizer predicate-pushdown behaviors; Secure Views disable those optimizations to guarantee the view's access boundary can't be bypassed by a crafted external query.
