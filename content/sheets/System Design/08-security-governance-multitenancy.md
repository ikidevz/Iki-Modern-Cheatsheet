# Security, Governance & Multi-Tenancy — System Design for Data Engineers

> Access control, PII handling, and isolating tenants on shared infrastructure — designing
> for "who is allowed to see this row" as deliberately as you design for throughput.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Quick-Reference Table](#quick-reference-table)
3. [Row-Level & Column-Level Security](#row-level--column-level-security)
4. [Python: A Row-Level Security Filter](#python-a-row-level-security-filter)
5. [PII Handling: Masking vs. Tokenization vs. Encryption](#pii-handling-masking-vs-tokenization-vs-encryption)
6. [Python: Masking & Tokenizing PII](#python-masking--tokenizing-pii)
7. [Column-Level Encryption (Recoverable, Unlike Tokenization)](#column-level-encryption-recoverable-unlike-tokenization)
8. [Attribute-Based Access Control (ABAC)](#attribute-based-access-control-abac)
9. [Tamper-Evident Audit Logs (Hash Chaining)](#tamper-evident-audit-logs-hash-chaining)
10. [Multi-Tenant Isolation Patterns](#multi-tenant-isolation-patterns)
11. [Compliance-Driven Constraints](#compliance-driven-constraints)
12. [Audit Trails](#audit-trails)
13. [Gotchas](#gotchas)
14. [Pro Tips](#pro-tips)

---

## Core Concepts

Security and governance in a DE system design context is mostly about answering one
question precisely: **who (or what) is allowed to see, modify, or export which rows and
columns, and how is that enforced — not just documented?** In a multi-tenant or
multi-subsidiary platform this becomes a first-class architectural concern, not a
bolt-on permission check, because a design mistake here (one tenant's data leaking into
another's dashboard) is often a compliance incident, not just a bug.

## Quick-Reference Table

| Concept | What It Solves |
|---|---|
| **Row-level security (RLS)** | Restricts which *rows* a user/role can see within a shared table |
| **Column-level masking** | Hides or obscures specific *columns* (e.g. SSN, email) for users without elevated access |
| **Tokenization** | Replaces a PII value with a non-reversible, deterministic token that's still joinable |
| **Encryption at rest/in transit** | Protects data from unauthorized access outside the application's own access-control layer |
| **Multi-tenant isolation** | Determines how strongly one tenant's data/workload is separated from another's on shared infrastructure |
| **Audit trail** | A durable, tamper-evident record of who accessed or changed what, and when |

## Row-Level & Column-Level Security

- **Row-level security (RLS)**: the same physical table is shared across users/tenants, but
  a policy (often enforced at the warehouse/query-engine level, e.g. Snowflake row access
  policies, BigQuery row-level security) transparently filters rows based on the querying
  user's identity or role — the application code doesn't need to remember to add a `WHERE
  tenant_id = ...` clause on every single query, because the engine enforces it.
- **Column-level masking**: a policy that returns a masked/null value for a specific column
  unless the querying user has an elevated role — e.g. an analyst sees `***-**-1234` for a
  SSN column while a compliance officer sees the real value.

Design principle: **push enforcement into the data platform itself wherever possible**,
rather than relying on every application/dashboard built on top of the data to correctly
re-implement the same access rule. A rule enforced in one place (the warehouse policy) can't
be bypassed by a new BI tool that forgot to add the filter.

## Python: A Row-Level Security Filter

A simplified simulation of what a warehouse's row-access policy does under the hood for a
multi-tenant/multi-subsidiary analytics platform:

```python
import pandas as pd


class RowLevelSecurityFilter:
    """Simulates enforcing row-level security for a multi-tenant analytics platform --
    a tenant-scoped user should only ever see their own tenant's rows, regardless of
    what the underlying query asks for."""

    def __init__(self, user_tenant_access: dict):
        self.user_tenant_access = user_tenant_access  # user_id -> set of allowed tenant_ids

    def filter(self, df: pd.DataFrame, user_id: str, tenant_column="tenant_id") -> pd.DataFrame:
        allowed = self.user_tenant_access.get(user_id, set())
        return df[df[tenant_column].isin(allowed)]


df = pd.DataFrame({
    "tenant_id": ["SUB_A", "SUB_A", "SUB_B", "SUB_C"],
    "revenue": [1000, 1500, 2000, 3000],
})

rls = RowLevelSecurityFilter(user_tenant_access={
    "analyst_1": {"SUB_A"},
    "group_exec": {"SUB_A", "SUB_B", "SUB_C"},
})

print("analyst_1 sees:")
print(rls.filter(df, "analyst_1"))
print("\ngroup_exec sees:")
print(rls.filter(df, "group_exec"))
```

Output:

```
analyst_1 sees:
  tenant_id  revenue
0     SUB_A     1000
1     SUB_A     1500

group_exec sees:
  tenant_id  revenue
0     SUB_A     1000
1     SUB_A     1500
2     SUB_B     2000
3     SUB_C     3000
```

The same `df` and the same query — the *only* thing that changes the result set is the
querying identity. This is exactly the guarantee a warehouse-level RLS policy gives you,
enforced once centrally instead of re-implemented in every dashboard and notebook that
touches the table.

## PII Handling: Masking vs. Tokenization vs. Encryption

| Technique | Reversible? | Joinable Across Datasets? | Typical Use |
|---|---|---|---|
| **Masking** (e.g. `a****h@example.com`) | No (information is destroyed) | No | Display to low-privilege users who need to *see something* but not the real value |
| **Tokenization** | No (one-way, but deterministic) | **Yes** — same input always produces the same token | Analytics that need to join/group by a PII field without ever exposing the raw value |
| **Encryption** | Yes (with the right key) | Only if decrypted first | Data at rest/in transit protection, where the real value must be recoverable by authorized systems |

## Python: Masking & Tokenizing PII

```python
import hashlib


def mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if len(local) <= 2:
        masked_local = local[0] + "*"
    else:
        masked_local = local[0] + "*" * (len(local) - 2) + local[-1]
    return f"{masked_local}@{domain}"


def tokenize_pii(value: str, salt: str = "pipeline_salt_v1") -> str:
    """One-way tokenization for PII that still needs to be joinable (same input -> same
    token) without exposing the raw value downstream. A production system would use a
    managed KMS-backed tokenization service rather than a bare salted hash, but the
    mechanic -- deterministic, non-reversible, joinable -- is the same idea."""
    return hashlib.sha256((salt + value).encode()).hexdigest()[:16]


emails = ["alice.smith@example.com", "bo@example.com"]
for e in emails:
    print(f"{e:28s} -> masked: {mask_email(e):24s} tokenized: {tokenize_pii(e)}")

print("Same input -> same token (joinable):",
      tokenize_pii("alice.smith@example.com") == tokenize_pii("alice.smith@example.com"))
```

Output:

```
alice.smith@example.com     -> masked: a*********h@example.com  tokenized: 1e7908359ba2efff
bo@example.com               -> masked: b*@example.com           tokenized: e9f2a3d68ce6cdb2
Same input -> same token (joinable): True
```

Tokenization is the key idea for analytics pipelines specifically because it preserves
**joinability**: a customer's tokenized email is identical every time it's tokenized, so you
can still do `GROUP BY customer_token` or join two tokenized tables on it — something plain
one-way hashing without a well-managed, consistent salt would also achieve, but a naive
random-per-record masking would not.

## Column-Level Encryption (Recoverable, Unlike Tokenization)

Sometimes the raw value genuinely needs to be recoverable by an authorized system — this is
what encryption is for, as distinct from tokenization's deliberate one-way property:

```python
from cryptography.fernet import Fernet

class ColumnEncryptor:
    """Symmetric encryption for a column that must be recoverable by an authorized
    system. Fernet provides AUTHENTICATED encryption -- tampering with the ciphertext
    is detectable, not just theoretically reversible with the right key."""

    def __init__(self, key: bytes = None):
        self.key = key or Fernet.generate_key()
        self.cipher = Fernet(self.key)

    def encrypt(self, plaintext: str) -> str:
        return self.cipher.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        return self.cipher.decrypt(ciphertext.encode()).decode()


encryptor = ColumnEncryptor()
ssn_encrypted = encryptor.encrypt("123-45-6789")
print("Encrypted:", ssn_encrypted[:40], "...")
print("Decrypted (by authorized service holding the key):", encryptor.decrypt(ssn_encrypted))
```

Output:

```
Encrypted: gAAAAABqpzlg55rTGW3EbvYn2uIkr7QNYgnezT25 ...
Decrypted (by authorized service holding the key): 123-45-6789
```

In production, the key itself lives in a managed KMS (AWS KMS, GCP Cloud KMS, HashiCorp
Vault) — never alongside the encrypted data — and access to the *key* becomes the actual
access-control boundary, with its own audit trail of every decrypt operation.

## Attribute-Based Access Control (ABAC)

Role-based access control (RBAC) grants permissions to a fixed role. **ABAC** goes further:
the access decision depends on attributes of the *user*, the *resource*, and the *context*
(time of day, request origin) evaluated together — letting you express policies RBAC alone
can't, like "finance department can see finance data, but only during business hours if it's
classified high-sensitivity":

```python
class ABACPolicyEngine:
    def __init__(self, rules):
        self.rules = rules  # list of (name, predicate_fn)

    def evaluate(self, user: dict, resource: dict, context: dict) -> dict:
        for name, predicate in self.rules:
            if not predicate(user, resource, context):
                return {"decision": "DENY", "failed_rule": name}
        return {"decision": "ALLOW", "failed_rule": None}


rules = [
    ("same_department", lambda u, r, c: u["department"] == r["owning_department"] or u["role"] == "admin"),
    ("business_hours_only", lambda u, r, c: r["sensitivity"] != "high" or 8 <= c["hour"] <= 18),
    ("clearance_level", lambda u, r, c: u["clearance"] >= r["required_clearance"]),
]
engine = ABACPolicyEngine(rules)

resource = {"owning_department": "finance", "sensitivity": "high", "required_clearance": 3}
user_ok = {"department": "finance", "role": "analyst", "clearance": 3}
user_wrong_dept = {"department": "marketing", "role": "analyst", "clearance": 3}

print("Same dept, business hours:", engine.evaluate(user_ok, resource, {"hour": 14}))
print("Same dept, after hours:", engine.evaluate(user_ok, resource, {"hour": 22}))
print("Wrong dept:", engine.evaluate(user_wrong_dept, resource, {"hour": 14}))
```

Output:

```
Same dept, business hours: {'decision': 'ALLOW', 'failed_rule': None}
Same dept, after hours: {'decision': 'DENY', 'failed_rule': 'business_hours_only'}
Wrong dept: {'decision': 'DENY', 'failed_rule': 'same_department'}
```

The same user, same resource, gets a different decision purely based on time of day — this
is exactly the kind of policy that's awkward to express with roles alone (you'd need a
separate "finance-analyst-daytime" role) but falls out naturally from evaluating attributes
and context together.

## Tamper-Evident Audit Logs (Hash Chaining)

An audit log an attacker (or a careless insider) can quietly edit after the fact isn't much
of an audit log. **Hash chaining** — where each entry's hash incorporates the previous
entry's hash — makes tampering with any past entry detectable, because it breaks every hash
computed after it (the same core idea underlying blockchains, applied here to an audit trail
rather than a currency ledger):

```python
import hashlib
import json
from datetime import datetime

class AuditLog:
    def __init__(self):
        self.entries = []
        self._last_hash = "0" * 64

    def append(self, actor: str, action: str, resource: str):
        record = {"actor": actor, "action": action, "resource": resource,
                  "ts": datetime.now().isoformat(), "prev_hash": self._last_hash}
        record_str = json.dumps(record, sort_keys=True)
        record["hash"] = hashlib.sha256(record_str.encode()).hexdigest()
        self.entries.append(record)
        self._last_hash = record["hash"]

    def verify_integrity(self) -> bool:
        expected_prev = "0" * 64
        for entry in self.entries:
            if entry["prev_hash"] != expected_prev:
                return False
            check = {k: v for k, v in entry.items() if k != "hash"}
            if hashlib.sha256(json.dumps(check, sort_keys=True).encode()).hexdigest() != entry["hash"]:
                return False
            expected_prev = entry["hash"]
        return True


log = AuditLog()
log.append("analyst_1", "SELECT", "fct_customer_pii")
log.append("analyst_1", "EXPORT", "fct_customer_pii")
print("Integrity check (untampered):", log.verify_integrity())

log.entries[0]["action"] = "DELETE"  # simulate someone editing history after the fact
print("Integrity check (after tampering with entry 0):", log.verify_integrity())
```

Output:

```
Integrity check (untampered): True
Integrity check (after tampering with entry 0): False
```

Editing even the *oldest* entry breaks integrity verification, because every subsequent
entry's `prev_hash` chain depends on it — this is precisely the property that makes a hash
chain a meaningfully stronger guarantee than "we have logs," which a privileged user could
otherwise edit undetected.

## Multi-Tenant Isolation Patterns

| Pattern | Isolation Strength | Operational Overhead | Notes |
|---|---|---|---|
| **Shared schema, tenant_id column + RLS** | Lowest | Lowest | Simplest to operate; relies entirely on RLS policies being correctly applied everywhere; a single bug can leak across tenants |
| **Schema-per-tenant** | Medium | Medium | Each tenant gets its own schema in a shared database; stronger blast-radius containment, still shares compute |
| **Database-per-tenant** | Highest | Highest | Full isolation of both data and often compute; simplest security story, most expensive to operate at scale (hundreds of databases to manage/migrate) |

Choice depends heavily on tenant count and per-tenant scale: a platform with a handful of
large enterprise tenants (e.g. a 10-subsidiary conglomerate platform) can reasonably justify
schema-per-tenant or even database-per-tenant; a platform with thousands of small tenants
almost always needs the shared-schema + RLS pattern purely for operability, and leans harder
on getting that RLS policy exactly right since it's the only isolation boundary.

## Compliance-Driven Constraints

- **Right-to-be-forgotten (GDPR Art. 17)**: the design needs a real mechanism to delete (or
  irreversibly anonymize) a specific individual's data across every table/system it landed
  in — this is often the single hardest requirement to retrofit into an existing lakehouse,
  because immutable/append-only storage and time-travel features work directly against easy
  deletion. Worth naming explicitly if compliance comes up: e.g. Delta Lake/Iceberg support
  row-level deletes, but time-travel snapshots referencing the deleted row may need their own
  retention/vacuum policy to fully purge it.
- **Data residency**: some regulations require certain data to physically remain within a
  jurisdiction's borders — this affects where you can place storage/compute, not just how
  you encrypt or mask.
- **Retention limits**: some data (e.g. certain financial/health records) has a *maximum*
  retention period, which is the inverse of the usual "keep data forever for analytics"
  instinct and needs an explicit expiration/purge job.

## Audit Trails

A durable record of who accessed or modified what data, and when — required by many
compliance regimes and invaluable during incident investigation. Design considerations:
- Log access at the platform level (warehouse query history, RLS policy evaluations) rather
  than relying on every application to self-report.
- Make the audit log itself tamper-evident (append-only, access-controlled separately from
  the data it's auditing) — an audit trail an attacker can edit isn't much of a trail.
- Retain audit logs independently of the data retention policy — you often need to prove
  *who accessed* data even after the data itself has been deleted.

## Gotchas

- Relying on every dashboard/notebook/application to correctly re-implement a `WHERE
  tenant_id = ...` filter — this is a single-point-of-failure access control model; one
  forgotten filter in one new tool is a data leak.
- Masking PII for display while leaving the same column fully joinable/groupable in its raw
  form elsewhere in the same pipeline — a masked *view* on top of an ungoverned raw table
  isn't real protection if analysts can just query the underlying table directly.
- Treating encryption-at-rest as sufficient PII protection on its own — it protects against
  someone stealing the physical storage medium, not against an over-privileged internal user
  querying the table normally.
- Forgetting that right-to-be-forgotten in a lakehouse with time-travel/versioning requires an
  explicit purge/vacuum step — a "deleted" row can still be recoverable from an old snapshot
  until that snapshot itself expires.

## Pro Tips

- When asked how you'd support multiple tenants/subsidiaries on shared infrastructure, name
  the isolation pattern explicitly and justify it against tenant count/scale — "with 10
  large subsidiaries I'd lean toward schema-per-tenant for stronger isolation; with
  thousands of small tenants, shared schema + RLS for operability" is a strong, calibrated
  answer.
- Volunteer that enforcement should live in the data platform (warehouse RLS/masking
  policies), not the application layer — this is the single idea that most differentiates a
  mature answer from a naive one in this category.
- If PII comes up, be ready to distinguish masking from tokenization from encryption by their
  actual property (reversibility, joinability) rather than reciting definitions — interviewers
  often probe with "but what if we need to join on that field later?"
- Mention right-to-be-forgotten proactively if the design involves a lakehouse/time-travel
  feature — it's a realistic, common follow-up ("how would you actually delete a user's data
  here?") that catches people who haven't thought about it.
