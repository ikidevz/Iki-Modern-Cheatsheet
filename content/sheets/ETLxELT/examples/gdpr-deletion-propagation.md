# Example 10: GDPR PII Deletion Propagation Pipeline

**Pipeline Type: N/A** — this is a governance/deletion workflow, not a data-movement pipeline; it operates on data that was already loaded and transformed by upstream ELT pipelines.

## Scenario & Business Context

A user submits a GDPR "right to be forgotten" request. Their data exists in the source production database, the warehouse (raw, staging, and multiple marts), a data lake export, and a third-party email marketing tool. All copies must be deleted or irreversibly anonymized within the legally required window, with an auditable record proving completion.

## Architecture

```
Deletion Request (via support ticket / self-serve portal)
        │
        ▼
Deletion Orchestrator (Airflow DAG, triggered on-demand)
        │
   ┌────┼────────────────┬─────────────────┬──────────────────┐
   ▼    ▼                ▼                 ▼                  ▼
Source  Warehouse      Data Lake        3rd-party tools    Backups
 DB     (raw/staging/   (S3 exports)    (email marketing,   (flagged for
        marts)                          support tool)       next rotation)
        │
        ▼
Audit log entry + confirmation to requester
```

## Full Implementation

### 1. Deletion request intake (creates a tracked record)

```sql
CREATE TABLE governance.deletion_requests (
  request_id STRING,
  user_id STRING,
  requested_at TIMESTAMP,
  status STRING,       -- 'pending', 'in_progress', 'completed', 'failed'
  completed_at TIMESTAMP,
  legal_deadline TIMESTAMP
);

INSERT INTO governance.deletion_requests (request_id, user_id, requested_at, status, legal_deadline)
VALUES ('del-9981', 'user_48213', CURRENT_TIMESTAMP, 'pending', CURRENT_TIMESTAMP + INTERVAL '30 days');
```

### 2. Lineage-driven table discovery (find every table containing this user's data)

```sql
-- Uses a maintained registry of which tables contain PII and the join key to identify a user's rows.
-- This registry should be built once from lineage tooling (see file 10) and kept current as new models are added.
SELECT table_name, pii_key_column
FROM governance.pii_table_registry
WHERE contains_user_data = TRUE;
```

```yaml
# governance/pii_table_registry.yml (source of truth, reviewed whenever a new mart is added)
tables:
  - table_name: raw.customers
    pii_key_column: customer_id
  - table_name: staging.stg_customers
    pii_key_column: customer_id
  - table_name: marts.dim_customer_360
    pii_key_column: unified_customer_id
  - table_name: marts.customer_ltv
    pii_key_column: customer_id
```

### 3. Deletion execution DAG

```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime

def delete_from_warehouse(user_id, **kwargs):
    registry = load_pii_table_registry()
    results = {}
    for table in registry:
        try:
            execute_sql(f"DELETE FROM {table['table_name']} WHERE {table['pii_key_column']} = '{user_id}'")
            results[table['table_name']] = "deleted"
        except Exception as e:
            results[table['table_name']] = f"failed: {e}"
    return results

def delete_from_source_db(user_id, **kwargs):
    # Soft-delete or anonymize in production DB per application-level deletion logic
    call_internal_api(f"/users/{user_id}/gdpr-delete")

def delete_from_third_party_tools(user_id, **kwargs):
    email_tool_client.delete_contact(user_id)
    support_tool_client.anonymize_user(user_id)

def flag_backups_for_next_rotation(user_id, **kwargs):
    # Backups often can't be selectively edited; flag for deletion on next rotation cycle
    insert_row("governance.backup_deletion_flags", {"user_id": user_id, "flagged_at": "now"})

def finalize_and_audit(user_id, request_id, **kwargs):
    update_row("governance.deletion_requests", request_id, {"status": "completed", "completed_at": "now"})
    send_confirmation_email(user_id)

with DAG("gdpr_deletion_propagation", schedule_interval=None, start_date=datetime(2026,1,1)) as dag:
    t1 = PythonOperator(task_id="delete_source_db", python_callable=delete_from_source_db)
    t2 = PythonOperator(task_id="delete_warehouse", python_callable=delete_from_warehouse)
    t3 = PythonOperator(task_id="delete_third_party", python_callable=delete_from_third_party_tools)
    t4 = PythonOperator(task_id="flag_backups", python_callable=flag_backups_for_next_rotation)
    t5 = PythonOperator(task_id="finalize_and_audit", python_callable=finalize_and_audit)

    [t1, t2, t3, t4] >> t5
```

### 4. Verification query (prove no residual data remains)

```sql
-- Run post-deletion as a compliance check
SELECT table_name, pii_key_column
FROM governance.pii_table_registry t
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_name = t.table_name
)
-- In practice: dynamically query each registered table for the deleted user_id and confirm zero rows.
```

## Design Rationale

- **A maintained PII table registry, not ad-hoc discovery per request** — without a single source of truth for which tables contain user data, deletion requests risk missing tables added after the last manual audit (see file 11 — Compliance Basics).
- **Separate DAG triggered on-demand**, not part of the regular scheduled pipeline — deletion is a distinct, auditable workflow with its own SLA (legal deadline), not something to bury inside routine ETL runs.
- **Backups flagged rather than immediately altered** — most backup systems can't selectively delete a single user's data without breaking backup integrity; flagging for the next rotation cycle is the realistic, commonly accepted compliance pattern.
- **Audit trail on the request itself** (`governance.deletion_requests`) — proves compliance with the legal deadline, independent of whether any individual deletion task succeeded on the first attempt.

## Production Considerations

- The **PII table registry must be treated as a living document** — require it to be updated as part of the code review checklist whenever a new mart or export containing user data is added (tie to file 10 — Lineage, and file 07 — Data Contracts).
- **Partial failures need explicit handling** — if the third-party email tool's API is down, the DAG should retry that specific task and keep the request `in_progress`, not silently mark it `completed`.
- Distinguish **hard delete vs anonymization** — some analytical use cases may only require irreversibly anonymizing a record (removing name/email but keeping an anonymized transaction for aggregate reporting) rather than a full row delete; document which approach applies per table in the registry.

## How to Extend This Example

- Add a **self-serve deletion status page** for the requester, backed by `governance.deletion_requests`, so support doesn't need to manually check pipeline logs to answer "has my data been deleted yet?"
- Extend the PII registry to also drive **automated PII masking policy assignment** (see file 11), keeping deletion and masking governance driven by the same source of truth.
- Add **quarterly automated re-verification** — periodically re-run the verification query against all *previously completed* deletion requests to catch cases where a new pipeline accidentally reintroduced deleted user data (e.g., via a stale backup restore or reprocessing job).
