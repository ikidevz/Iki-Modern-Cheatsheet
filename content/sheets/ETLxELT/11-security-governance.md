# Security & Governance

## Access Control (RBAC)

**Definition:** Role-Based Access Control — granting data access permissions based on defined roles rather than individual users.

**Key Points:**
- Grant permissions by role, not individual user, to scale governance cleanly (e.g., `analyst_role`, `engineer_role`, `admin_role`).
- Apply least-privilege: most roles should get read-only access to specific schemas, not warehouse-wide access.
- Separate roles for raw/bronze layer (restricted) vs curated/gold layer (broader access).

**Example:**
```sql
CREATE ROLE analyst_role;
GRANT SELECT ON SCHEMA marts TO ROLE analyst_role;
GRANT ROLE analyst_role TO USER jane_doe;
```

**When to Use / Trade-offs:**
- Role-based grants scale far better than per-user grants as team size grows — always default to roles even for small teams.

**Common Pitfalls:**
- Granting broad warehouse-admin access to analysts "temporarily" for a one-off task, and never revoking it.

---

## PII Handling & Masking

**Definition:** Identifying and protecting personally identifiable information as it moves through a pipeline.

**Key Points:**
- Identify and tag PII fields at ingestion (emails, names, SSNs, phone numbers) so downstream layers know what's sensitive.
- Masking techniques: hashing, tokenization, partial redaction (e.g., `***-**-1234`), or dynamic masking based on the querying role.
- Keep raw PII isolated in a restricted-access layer; expose masked/aggregated versions broadly.

**Example:**
```sql
-- Dynamic masking (Snowflake)
CREATE MASKING POLICY email_mask AS (val STRING) RETURNS STRING ->
  CASE WHEN CURRENT_ROLE() IN ('ADMIN_ROLE') THEN val ELSE '***MASKED***' END;
```

**When to Use / Trade-offs:**
- Dynamic masking (enforced at query time) is preferable to static masking (baked into a separate table) since it avoids maintaining duplicate masked/unmasked copies of the same data.

**Common Pitfalls:**
- Tagging PII fields once at ingestion but never re-checking as new columns are added by upstream schema changes.

---

## Compliance Basics

**Definition:** Regulatory frameworks governing how personal and sensitive data must be handled.

**Key Points:**
- GDPR (EU) — right to access, right to erasure ("right to be forgotten"), data minimization, consent tracking.
- HIPAA (US healthcare) — strict controls on Protected Health Information (PHI), audit logging, encryption requirements.
- CCPA (California) — similar consumer data rights to GDPR, applies to businesses meeting certain thresholds.
- Pipelines handling regulated data need deletion propagation support — a user's data must be removable from all downstream copies, not just the source.

**Example:**
- A GDPR deletion request requires removing a user's data not just from the source database, but from every downstream warehouse table, backup, and derived mart that copied it.

**When to Use / Trade-offs:**
- Building deletion propagation in from the start is far cheaper than retrofitting it after years of uncontrolled data copies exist across the warehouse.

**Common Pitfalls:**
- Treating compliance as a one-time source-database concern, ignoring copies that have propagated into warehouses, caches, and backups.

---

## Encryption

**Definition:** Protecting data confidentiality both while stored and while moving between systems.

**Key Points:**
- At rest — data encrypted in storage (warehouse, lake, backups), typically handled by the platform (AES-256 common default).
- In transit — data encrypted while moving between systems (TLS/SSL for API calls, database connections).
- Key management: prefer managed KMS (AWS KMS, GCP KMS, Azure Key Vault) over custom key handling.

**Example:**
- Enforcing `sslmode=require` on all database connection strings; enabling default at-rest encryption on all cloud storage buckets.

**When to Use / Trade-offs:**
- Rely on cloud-managed encryption defaults wherever possible — custom encryption implementations introduce risk without much added benefit for most use cases.

**Common Pitfalls:**
- Disabling SSL/TLS on internal connections "for simplicity," assuming internal network traffic is inherently safe.
