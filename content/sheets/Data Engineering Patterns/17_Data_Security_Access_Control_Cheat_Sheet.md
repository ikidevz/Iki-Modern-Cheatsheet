# Data Security & Access Control Cheatsheet for Data Engineers

> A structured reference for protecting data in a warehouse/lakehouse — encryption at rest and in transit, row/column-level security, dynamic masking, tokenization, least-privilege access models, secrets management, and audit logging.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 Threat Model for Data Platforms](#threat-model-for-data-platforms)
4. [🔐 Encryption at Rest and in Transit](#encryption-at-rest-and-in-transit)
5. [🧩 Row-Level Security](#row-level-security)
6. [🎭 Column-Level Masking and Tokenization](#column-level-masking-and-tokenization)
7. [🗝️ Least-Privilege Access Models (RBAC/ABAC)](#least-privilege-access-models-rbacabac)
8. [🤫 Secrets Management](#secrets-management)
9. [📜 Audit Logging](#audit-logging)
10. [🌍 Data Residency and Sovereignty](#data-residency-and-sovereignty)
11. [🧹 Data Retention and Right-to-Erasure](#data-retention-and-right-to-erasure)
12. [🛠️ Tooling Landscape](#tooling-landscape)
13. [🧪 Testing Access Controls](#testing-access-controls)
14. [⚠️ Common Gotchas](#common-gotchas)
15. [✅ Best Practices Checklist](#best-practices-checklist)
16. [📚 RBAC vs ABAC vs Tag-Based Policies](#rbac-vs-abac-vs-tag-based-policies)
17. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| Encryption | At rest (storage-level) and in transit (TLS), by default, everywhere |
| Row-level security | Policy functions restrict which rows a role can see |
| Column masking | Dynamic masking policies, tokenization for sensitive fields |
| Access model | Role-based (RBAC) or attribute-based (ABAC), least privilege |
| Secrets | Never in code/config files — a secrets manager, injected at runtime |
| Audit | Every query logged: who, what, when, against which objects |
| Data subject rights | Deletion/export requests must be executable, not theoretical |

## 🧠 Core Concept

Data security on an analytics platform is about ensuring **only the right people and systems can see, use, or export specific data**, while keeping that control auditable and enforceable centrally — rather than relying on every downstream tool and every analyst to individually respect an informal convention.

```text
[ raw sensitive data ]  --encryption + access policy + masking-->  [ same data, safely queryable by the right people ]
                                       │
                                       └─ every access is AUDITED, regardless of whether it was allowed or denied
```

## 🎯 Threat Model for Data Platforms

| Threat | Example | Primary control |
|---|---|---|
| Unauthorized internal access | An engineer without a business need queries raw PII | Row/column-level security, least privilege |
| Credential leakage | A hardcoded warehouse password in a Git repo | Secrets management, credential rotation |
| Data exfiltration | Bulk export of a sensitive table to a personal device | Audit logging, export controls, anomaly detection |
| Over-broad service accounts | A pipeline's service account has admin on the whole warehouse | Least privilege, scoped roles per pipeline |
| Insufficient encryption | Backups or exports stored unencrypted | Encryption at rest by default, encrypted export paths |
| Non-compliant data residency | EU customer data replicated to a US region without basis | Data residency controls, region-aware pipelines |

## 🔐 Encryption at Rest and in Transit

```sql
-- Most modern warehouses encrypt at rest by default — the practical work is ensuring
-- it's not disabled somewhere, and that CUSTOMER-MANAGED keys are used where required
-- (Snowflake example: verify encryption settings at the account level)
SHOW PARAMETERS LIKE 'ENCRYPTION%' IN ACCOUNT;
```

```python
# Application-side: always connect over TLS, never allow a fallback to plaintext
connection = create_connection(
    host="warehouse.internal",
    ssl_mode="require",       # reject any connection that can't negotiate TLS
    ssl_ca_cert="/etc/ssl/certs/warehouse-ca.pem",
)
```

| Layer | Control |
|---|---|
| Storage (at rest) | Warehouse/lakehouse-native encryption, ideally with customer-managed keys (CMK) for regulated data |
| Network (in transit) | TLS everywhere — between clients and warehouse, between pipeline stages, for any inter-service calls |
| Backups/exports | Encrypted by default; export tooling should refuse to write unencrypted extracts of sensitive tables |

## 🧩 Row-Level Security

```sql
-- Snowflake: a row access policy restricting visibility by region, tied to the querying role
CREATE ROW ACCESS POLICY region_policy AS (region STRING) RETURNS BOOLEAN ->
    CURRENT_ROLE() IN ('GLOBAL_ANALYST', 'ADMIN')
    OR region = (SELECT allowed_region FROM security.role_region_map WHERE role_name = CURRENT_ROLE());

ALTER TABLE core.fct_orders ADD ROW ACCESS POLICY region_policy ON (region);
```

```sql
-- BigQuery: row-level access policies achieve the same restriction
CREATE ROW ACCESS POLICY region_filter
ON core.fct_orders
GRANT TO ("group:eu-analysts@company.com")
FILTER USING (region = 'EU');
```

Row-level security means the **same physical table** serves every analyst, with the warehouse itself enforcing who sees which rows — far more robust than maintaining separate filtered views or copies per audience, which inevitably drift out of sync.

## 🎭 Column-Level Masking and Tokenization

```sql
-- Dynamic masking: the underlying data is untouched, but non-privileged roles see a masked value
CREATE MASKING POLICY email_mask AS (val STRING) RETURNS STRING ->
    CASE WHEN CURRENT_ROLE() IN ('PII_VIEWER', 'ADMIN') THEN val
         ELSE CONCAT(LEFT(val, 1), '***@***.com')
    END;

ALTER TABLE core.dim_customer MODIFY COLUMN email SET MASKING POLICY email_mask;
```

```python
# Tokenization: replace sensitive values with a reversible token, keeping analytical utility
# (e.g., counting distinct customers) without exposing the real value to most consumers
def tokenize(value: str, tokenization_vault) -> str:
    return tokenization_vault.get_or_create_token(value)   # deterministic: same input -> same token, every time

# Only a privileged, audited service can detokenize back to the real value
def detokenize(token: str, tokenization_vault, requestor_role: str) -> str:
    if requestor_role not in AUTHORIZED_DETOKENIZE_ROLES:
        raise PermissionError("Detokenization requires elevated, audited access")
    return tokenization_vault.reverse(token)
```

| Technique | Reversible? | Best for |
|---|---|---|
| Dynamic masking | No (display-only transformation) | Ad hoc analyst queries where the real value is never needed |
| Tokenization | Yes, by an authorized service | Preserving joinability/analytics on a sensitive field while hiding its real value from most consumers |
| Hashing | No (one-way) | Deduplication/joining on a sensitive field where you never need the original value back |

## 🗝️ Least-Privilege Access Models (RBAC/ABAC)

```sql
-- RBAC: access granted to roles, roles granted to users — never grant directly to a person
CREATE ROLE analyst_finance;
GRANT SELECT ON core.fct_orders TO ROLE analyst_finance;
GRANT ROLE analyst_finance TO USER jsmith;

-- Pipeline service accounts get their OWN narrowly-scoped role — never reuse a human's broad role
CREATE ROLE pipeline_orders_etl;
GRANT SELECT ON staging.orders_raw TO ROLE pipeline_orders_etl;
GRANT INSERT, UPDATE ON core.fct_orders TO ROLE pipeline_orders_etl;
-- Deliberately NOT granted: DROP, access to unrelated schemas, admin functions
```

```python
# ABAC: access decisions based on attributes (user's team, data's classification, time of day)
# rather than a fixed role list — more flexible, but requires a policy engine
def can_access(user, dataset):
    if dataset.classification == "restricted" and user.clearance_level < 3:
        return False
    if dataset.domain != user.team and not user.has_cross_domain_exception:
        return False
    return True
```

| Model | Strength | Trade-off |
|---|---|---|
| RBAC | Simple, widely supported by every warehouse | Role explosion as access needs get more granular |
| ABAC | Flexible, scales to fine-grained/contextual policy | Needs a policy engine (e.g., OPA); harder to audit "who can see what" at a glance |
| Tag-based (hybrid) | Combines the catalog's classification tags directly with access policy | Requires the catalog and access system to share the same tag taxonomy — see [data-cataloging.md](./Data_Cataloging_Cheat_Sheet.md#catalog-driven-access-control) |

## 🤫 Secrets Management

```python
# NEVER: hardcoded credentials in code or config files checked into version control
DB_PASSWORD = "hunter2"   # DON'T

# CORRECT: fetch from a secrets manager at runtime, never persisted to disk or logs
import boto3
secrets_client = boto3.client("secretsmanager")
db_password = secrets_client.get_secret_value(SecretId="prod/warehouse/password")["SecretString"]
```

```yaml
# Orchestrator-level secret injection (Airflow connection backed by a secrets backend)
# rather than storing credentials in the orchestrator's own metadata database in plaintext
AIRFLOW__SECRETS__BACKEND: airflow.providers.amazon.aws.secrets.secrets_manager.SecretsManagerBackend
```

Rotate credentials on a schedule and **immediately** on any suspected exposure (a secret accidentally committed to a public repo, even briefly, should be treated as compromised and rotated, not just removed from the commit).

## 📜 Audit Logging

```sql
-- Query history captures who ran what against which objects — the foundation of both
-- security investigation and cost/performance review
SELECT
    query_text, user_name, role_name, database_name, schema_name,
    start_time, total_elapsed_time, rows_produced
FROM snowflake.account_usage.query_history
WHERE start_time > DATEADD(day, -1, CURRENT_TIMESTAMP());
```

```python
def alert_on_suspicious_access_pattern(query_history):
    """Flag patterns that warrant investigation, not just log them passively."""
    for query in query_history:
        if query.rows_produced > BULK_EXPORT_THRESHOLD and "restricted" in query.tables_accessed_classifications:
            fire_security_alert("large_restricted_data_export", query)
        if query.user_name in recently_offboarded_users:
            fire_security_alert("access_by_offboarded_user", query)
```

Audit logging that's collected but never reviewed provides no real security value — pair the log with automated alerting on genuinely suspicious patterns (bulk exports of restricted data, access by an offboarded account), not just passive retention for a hypothetical future investigation.

## 🌍 Data Residency and Sovereignty

```python
# Pipelines that route or replicate data across regions need EXPLICIT residency awareness,
# not an accidental byproduct of "wherever compute happened to be available"
def route_for_residency(customer_region: str):
    if customer_region in EU_REGIONS:
        return {"warehouse_region": "eu-west-1", "processing_region": "eu-west-1"}
    return {"warehouse_region": "us-east-1", "processing_region": "us-east-1"}
```

Data residency requirements (GDPR, and similar region-specific regulations) mean a pipeline replicating data cross-region for convenience or cost reasons can create real compliance exposure — treat region-awareness as a first-class pipeline design constraint for any regulated dataset, not an afterthought.

## 🧹 Data Retention and Right-to-Erasure

```sql
-- Automated retention: delete/archive data past its defined retention window
DELETE FROM raw.customer_support_tickets WHERE created_at < DATEADD(year, -3, CURRENT_DATE);
```

```python
def process_erasure_request(customer_id: str):
    """A right-to-erasure request must actually reach every copy of the data —
    including downstream marts, Reverse ETL destinations, and backups within their retention window."""
    for dataset in catalog.get_datasets_containing_customer_data():
        delete_customer_rows(dataset, customer_id)
    for destination in reverse_etl_destinations_synced_with_customer_data():
        request_deletion_in_destination(destination, customer_id)
    log_erasure_completion(customer_id, datasets_processed=catalog.get_datasets_containing_customer_data())
```

A right-to-erasure process that only deletes from the primary warehouse table — while the same customer's data still lives in five downstream marts and a CRM synced via Reverse ETL — doesn't actually satisfy the request; lineage (see [data-cataloging.md](./Data_Cataloging_Cheat_Sheet.md#lineage-capture)) is what makes it possible to find every copy.

## 🛠️ Tooling Landscape

| Category | Tools |
|---|---|
| Secrets management | AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager |
| Access policy engines | Warehouse-native RBAC, Open Policy Agent (OPA) for ABAC |
| Data discovery/classification | DataHub, OpenMetadata, cloud-native DLP scanners (e.g., Google Cloud DLP, AWS Macie) |
| Audit/SIEM integration | Warehouse-native query history exported to Splunk/Datadog/a SIEM |

## 🧪 Testing Access Controls

```python
def test_masked_field_hidden_from_unprivileged_role():
    result = run_query_as(role="general_analyst", sql="SELECT email FROM dim_customer LIMIT 1")
    assert "***@***.com" in result[0]["email"]   # masked, not the real value

def test_row_level_security_restricts_region():
    result = run_query_as(role="eu_analyst", sql="SELECT DISTINCT region FROM fct_orders")
    assert set(r["region"] for r in result) == {"EU"}   # never sees non-EU rows

def test_pipeline_service_account_cannot_drop_tables():
    with pytest.raises(PermissionError):
        run_query_as(role="pipeline_orders_etl", sql="DROP TABLE core.fct_orders")

def test_erasure_request_removes_data_from_all_known_downstream_datasets():
    process_erasure_request(customer_id="C042")
    for dataset in catalog.get_datasets_containing_customer_data():
        assert not dataset_contains_customer(dataset, "C042")
```

Treat access-control policies as code with the same test rigor as transform logic — a masking policy or row-level security rule that "looks right" in a config file but was never actually tested against a live query is a common source of security incidents.

## ⚠️ Common Gotchas

- **Service accounts with broad, human-level access** — a pipeline's credentials should be scoped narrowly to exactly what that pipeline needs, never reused from (or as broad as) an admin/human role.
- **Masking policies applied inconsistently across copies of the same data** — a masked production table with an unmasked "quick copy" in a personal schema defeats the entire control.
- **Audit logs collected but never reviewed or alerted on** — passive retention without active monitoring provides no real-time security value.
- **Right-to-erasure handled only at the primary table**, missing downstream marts, Reverse ETL destinations, and backups.
- **Secrets checked into version control, even briefly** — treat any exposure as a compromise requiring rotation, not just removal from the commit history.
- **Data residency treated as a deployment detail** rather than a first-class pipeline design constraint, creating compliance exposure when data is replicated cross-region for convenience.
- **RBAC role explosion** — dozens of overlapping, poorly-documented roles accumulate over time until nobody can confidently answer "who can see this table."

## ✅ Best Practices Checklist

- [ ] Encryption at rest and in transit is enabled and verified, not just assumed
- [ ] Row/column-level security is applied at the table level, enforced by the warehouse itself
- [ ] Every pipeline service account has its own narrowly-scoped role, never a shared or human-level one
- [ ] Secrets are stored in a secrets manager and rotated on a schedule, never hardcoded
- [ ] Query history/audit logs are actively monitored for suspicious patterns, not just retained
- [ ] Data residency requirements are enforced as a pipeline design constraint for regulated data
- [ ] Right-to-erasure requests are processed against every known downstream copy, using lineage to find them all
- [ ] Access-control policies are tested in CI against known scenarios, not just configured and assumed correct

## 📚 RBAC vs ABAC vs Tag-Based Policies

| Dimension | RBAC | ABAC | Tag-Based |
|---|---|---|---|
| Basis for access decision | Assigned role | Attributes of user + resource + context | Classification tags shared with the catalog |
| Granularity | Coarse-to-medium | Fine-grained | Medium, scales with tagging discipline |
| Auditability | High ("who has role X") | Lower (policy logic can be complex) | High (tag drives both discovery and enforcement) |
| Best fit | Most organizations, most datasets | Highly regulated, context-sensitive access needs | Organizations with a mature, catalog-integrated classification system |

## 💡 Pro Tips

1. **Give every pipeline its own narrowly-scoped service account** — never let automation run under a broad or human-level role.
2. **Enforce row/column security at the table level**, so every consumer (BI tool, notebook, ad hoc query) gets the same protection automatically.
3. **Prefer tag-based policies tied to your catalog's classification** — one source of truth for both discovery and enforcement, per [data-cataloging.md](./Data_Cataloging_Cheat_Sheet.md#catalog-driven-access-control).
4. **Store every secret in a secrets manager, with scheduled rotation** — and treat any exposure, however brief, as requiring immediate rotation.
5. **Actively monitor audit logs for suspicious patterns**, not just retain them for a hypothetical future investigation.
6. **Build right-to-erasure as a lineage-driven process** that reaches every downstream copy, not just the primary table.
7. **Treat data residency as a pipeline design constraint** for regulated data, decided deliberately rather than left to wherever compute happens to run.
8. **Test access-control policies in CI** the same way you'd test transform logic — a policy that "looks right" isn't verified until it's actually exercised.
9. **Prefer tokenization over plain masking when analytical utility (joins, distinct counts) on a sensitive field is still needed.**
10. **Periodically audit and prune RBAC roles** — role explosion over time is one of the most common ways least-privilege quietly erodes.
