# User & Access Management Cheatsheet

A DBA-focused reference for roles, privileges, and auditing at the database engine level in MySQL and PostgreSQL — the access-control layer that sits underneath (and is often more consequential than) application-level permission systems.

> Verified against: **PostgreSQL 18** (predefined roles, Row-Level Security), **MySQL 8.4 LTS / 9.7** (roles, since MySQL 8.0; the `mysql_native_password` authentication plugin is deprecated in favor of `caching_sha2_password`/`sha256_password`).

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Quick Reference Table](#2-quick-reference-table)
3. [Users vs. Roles](#3-users-vs-roles)
4. [Privilege Model — PostgreSQL](#4-privilege-model--postgresql)
5. [Privilege Model — MySQL](#5-privilege-model--mysql)
6. [Row-Level Security (RLS)](#6-row-level-security-rls)
7. [Principle of Least Privilege — Practical Patterns](#7-principle-of-least-privilege--practical-patterns)
8. [Authentication Methods](#8-authentication-methods)
9. [Auditing](#9-auditing)
10. [Service Accounts & Application Credentials](#10-service-accounts--application-credentials)
11. [Common RBAC Design Patterns](#11-common-rbac-design-patterns)
12. [Compliance Mapping (SOC 2, PCI-DSS, HIPAA)](#12-compliance-mapping-soc-2-pci-dss-hipaa)
13. [LDAP/Active Directory Integration](#13-ldapactive-directory-integration)
14. [Worked Examples](#14-worked-examples)
15. [Gotchas](#15-gotchas)

---

## 1. Core Concepts

| Concept | What it means |
|---|---|
| **Authentication** | Proving *who* is connecting (password, certificate, SSO/LDAP, OS-level trust). |
| **Authorization** | Determining *what* an authenticated identity is allowed to do — the privilege/role system covered in this cheatsheet. |
| **Principal** | The identity a permission is granted to — a user/role in both engines' terminology (PostgreSQL unifies users and roles into one object type; MySQL keeps them conceptually distinct but roles are themselves special grantable accounts). |
| **Privilege** | A specific permission (SELECT, INSERT, EXECUTE, CREATE, etc.) on a specific object (table, schema, database, function, or the whole instance). |
| **Grant** | The act of assigning a privilege to a principal, optionally with the ability for that principal to re-grant it further (`WITH GRANT OPTION` / `WITH ADMIN OPTION`). |
| **Role hierarchy / inheritance** | Roles can be members of other roles, inheriting their privileges — the mechanism behind "grant to a group, add users to the group" instead of managing per-user grants directly. |
| **Row-Level Security (RLS)** | Restricting which *rows* a principal can see/modify within a table they otherwise have table-level access to — a finer-grained layer beneath ordinary table/column grants. |
| **Principle of least privilege** | Every principal should have exactly the access it needs to do its job, no more — the organizing philosophy behind every pattern in this document. |
| **Privilege escalation** | Gaining more access than intended, typically via a misconfigured grant chain, an overly broad role membership, or a function/procedure that runs with elevated privileges (`SECURITY DEFINER` in PostgreSQL, `SQL SECURITY DEFINER` in MySQL) without careful scoping. |

---

## 2. Quick Reference Table

| I want to… | PostgreSQL | MySQL |
|---|---|---|
| Create a login-capable user | `CREATE ROLE alice LOGIN PASSWORD '...';` | `CREATE USER 'alice'@'%' IDENTIFIED BY '...';` |
| Create a non-login group role | `CREATE ROLE analysts;` | `CREATE ROLE 'analysts';` |
| Add a user to a group | `GRANT analysts TO alice;` | `GRANT 'analysts' TO 'alice'@'%'; SET DEFAULT ROLE 'analysts' TO 'alice'@'%';` |
| Grant read-only on a table | `GRANT SELECT ON orders TO analysts;` | `GRANT SELECT ON db.orders TO 'analysts';` |
| Grant read-only on *future* tables in a schema | `ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT ON TABLES TO analysts;` | No direct equivalent — MySQL has no schema-level default-privilege mechanism; must re-grant per new object |
| See what a role can do | `\du` and `\dp` in psql, or query `information_schema.role_table_grants` | `SHOW GRANTS FOR 'alice'@'%';` |
| Revoke a privilege | `REVOKE SELECT ON orders FROM analysts;` | `REVOKE SELECT ON db.orders FROM 'analysts';` |
| Restrict rows a user can see | Row-Level Security (`CREATE POLICY ...`) | No built-in RLS — must use views, application-layer filtering, or third-party extensions |
| Force password rotation | `ALTER ROLE alice VALID UNTIL '2026-12-31';` | `ALTER USER 'alice'@'%' PASSWORD EXPIRE INTERVAL 90 DAY;` |
| See currently connected sessions and their user | `SELECT * FROM pg_stat_activity;` | `SHOW PROCESSLIST;` or `performance_schema.processlist` |

---

## 3. Users vs. Roles

- **PostgreSQL** has a single underlying object type (`ROLE`) for both "users" (roles with `LOGIN`) and "groups" (roles without `LOGIN`, used purely as privilege containers) — `CREATE USER` is literally just `CREATE ROLE ... LOGIN` as a convenience alias.
- **MySQL** (since 8.0) added roles as a distinct concept layered on top of its user-account model — a user account (`'name'@'host'`, note the mandatory host component) is always the login identity, and roles are granted to it as reusable privilege bundles, with `SET DEFAULT ROLE` controlling which granted roles are automatically active on login.
- **MySQL's `'user'@'host'` pairing is a real, easy-to-forget distinction** — `'alice'@'10.0.1.5'` and `'alice'@'%'` are two entirely separate accounts as far as MySQL's grant tables are concerned, even though they share a username.
- **Group-based access control (grant to a role, add users to the role) scales dramatically better than per-user grants** in both engines — the moment you're writing the same `GRANT` statement for a third individual user, that's the signal to introduce a role instead.

---

## 4. Privilege Model — PostgreSQL

```sql
-- Group role for reporting analysts
CREATE ROLE analysts NOLOGIN;
GRANT CONNECT ON DATABASE app TO analysts;
GRANT USAGE ON SCHEMA reporting TO analysts;
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO analysts;
ALTER DEFAULT PRIVILEGES IN SCHEMA reporting GRANT SELECT ON TABLES TO analysts;

-- Individual login role, inheriting the group's privileges
CREATE ROLE alice LOGIN PASSWORD 'change_me' IN ROLE analysts;
```
- **Privilege scopes, broadest to narrowest**: cluster (superuser status, `CREATEDB`/`CREATEROLE` attributes) → database (`CONNECT`, `CREATE`) → schema (`USAGE`, `CREATE`) → object (table/view/sequence/function: `SELECT`/`INSERT`/`UPDATE`/`DELETE`/`EXECUTE`/etc.) → column (`GRANT SELECT (col1, col2) ON t`) → row (Row-Level Security, Section 6).
- **`ALTER DEFAULT PRIVILEGES` is the key mechanism for "grants that apply to objects that don't exist yet"** — without it, every new table created in a schema needs its grants re-applied manually, which is both a maintenance burden and a common source of silent access gaps.
- **Predefined roles** (`pg_read_all_data`, `pg_write_all_data`, `pg_monitor`, `pg_signal_backend`, and others) ship built-in for common broad-but-scoped needs — granting `pg_read_all_data` to a reporting service account, for instance, is safer and clearer than granting superuser just to get broad read access.
- **`SECURITY DEFINER` functions** run with the privileges of the function's *owner*, not the caller — powerful for controlled privilege escalation (letting a low-privilege user perform one specific elevated action through a tightly scoped function) but dangerous if the function's owner has broad privileges and the function itself isn't carefully written (e.g., not setting `search_path` explicitly, which is a known privilege-escalation vector).

---

## 5. Privilege Model — MySQL

```sql
CREATE ROLE 'analysts';
GRANT SELECT ON app.reporting_view TO 'analysts';

CREATE USER 'alice'@'%' IDENTIFIED BY 'change_me';
GRANT 'analysts' TO 'alice'@'%';
SET DEFAULT ROLE 'analysts' TO 'alice'@'%';
```
- **Privilege scopes, broadest to narrowest**: global (`*.*` — instance-wide, includes dangerous ones like `SUPER`, `FILE`, `PROCESS`) → database (`dbname.*`) → table (`dbname.tablename`) → column (`GRANT SELECT (col1, col2) ON dbname.tablename`) → routine (stored procedures/functions).
- **`WITH GRANT OPTION`** lets a grantee re-grant the privilege further — use sparingly; it's easy to lose track of who can extend access once this is set on a broad grant.
- **Dynamic privileges** (introduced 8.0, e.g., `BACKUP_ADMIN`, `REPLICATION_SLAVE_ADMIN`, `CONNECTION_ADMIN`) replace the old model where anything not covered by a static privilege required full `SUPER` — this is the direct MySQL analog to PostgreSQL's predefined roles, and using them instead of blanket `SUPER` grants is the modern least-privilege pattern.
- **`FLUSH PRIVILEGES` is rarely needed in modern MySQL** — it's only required after direct manipulation of the grant tables (`mysql.user`, etc.) via raw `INSERT`/`UPDATE`, not after using `GRANT`/`REVOKE`/`CREATE USER` statements, which take effect immediately. A common outdated habit worth dropping.

---

## 6. Row-Level Security (RLS)

**PostgreSQL** has native RLS — the standout access-control feature it has that MySQL simply doesn't:
```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.current_tenant')::int);

-- Optionally, a separate policy for writes vs. reads
CREATE POLICY tenant_isolation_write ON orders
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::int);
```
- Once RLS is enabled, `SELECT`/`UPDATE`/`DELETE` privileges granted at the table level are still required — RLS policies add an *additional* filter on top, they don't replace ordinary grants.
- **Table owners bypass RLS by default** unless `FORCE ROW LEVEL SECURITY` is also set — a common, easy-to-miss gap when the application connects as the table owner rather than a dedicated less-privileged role.
- The classic use case is **multi-tenant SaaS**: instead of trusting every application query to remember `WHERE tenant_id = ...`, RLS enforces it at the database level regardless of what the application code does or forgets to do — a genuine defense-in-depth layer against a single missed `WHERE` clause leaking cross-tenant data.

**MySQL** has no built-in equivalent — row-level restriction must be implemented via views with a filter baked in, application-layer enforcement, or (rarely) third-party plugins. This is a real, material capability gap between the two engines worth knowing when choosing an engine for a multi-tenant workload with strict isolation requirements.

---

## 7. Principle of Least Privilege — Practical Patterns

- **Application service accounts get exactly the privileges the application needs** — typically `SELECT`/`INSERT`/`UPDATE`/`DELETE` on specific application tables, never `DROP`/`CREATE`/`ALTER`, and never superuser/`SUPER` regardless of how convenient it would be during development.
- **Separate accounts for separate purposes**: an application runtime account, a migration/schema-change account (used only during deploys, with elevated DDL privileges), a reporting/read-only account, and human DBA accounts — never one shared "does everything" credential.
- **Break-glass/emergency access** should exist as a documented, audited, time-boxed procedure (e.g., a temporary role grant with an expiry, logged and alerted on) rather than a permanently-provisioned superuser account "just in case."
- **Column-level grants** for sensitive fields (e.g., a support team role that can see customer records but not payment card fields) are underused in practice but directly supported by both engines' `GRANT SELECT (col1, col2)` syntax.
- **Review role membership periodically** — access accumulates over time (someone changes teams but keeps old grants) far more often than it gets proactively cleaned up; treat access review as a recurring process, not a one-time setup task.

---

## 8. Authentication Methods

| Method | PostgreSQL | MySQL |
|---|---|---|
| Password | `scram-sha-256` (the modern default; `md5` is legacy and should be phased out) | `caching_sha2_password` (default since 8.0; `mysql_native_password` is deprecated) |
| Certificate (mutual TLS) | `cert` auth method in `pg_hba.conf` | `REQUIRE X509` / `REQUIRE SUBJECT '...'` on the user account |
| LDAP/Active Directory | `ldap` auth method in `pg_hba.conf` | `authentication_ldap_simple` / `authentication_ldap_sasl` plugins |
| OAuth/SSO | Native OAuth 2.0 support added in **PostgreSQL 18** | Via PAM or third-party plugins; no native OAuth built into core MySQL |
| Host-based trust (no password) | `trust`/`peer` methods — appropriate only for tightly controlled local/socket connections, never over a network | Unix socket auth via the `auth_socket`/`unix_socket` plugin |
| Connection encryption | `ssl = on` + `pg_hba.conf` `hostssl` entries | `require_secure_transport = ON` |

- **`pg_hba.conf` is PostgreSQL's central authentication-method-selection file** — it maps `(connection type, database, user, source address)` tuples to an authentication method, evaluated top-to-bottom, first match wins. A common misconfiguration is an overly broad early rule (e.g., `trust` for a wide CIDR range) that shadows a more specific, more secure rule further down.
- **Both engines are moving away from MD5-family password hashing** toward SCRAM (PostgreSQL) and SHA-256-based caching (MySQL) — if you're still running `md5` auth or `mysql_native_password`, migrating is a genuine security improvement, not just a version-compliance checkbox.

---

## 9. Auditing

| | PostgreSQL | MySQL |
|---|---|---|
| Built-in query logging | `log_statement`, `log_min_duration_statement` in `postgresql.conf` | General query log, slow query log |
| Dedicated audit extension | `pgaudit` (widely used, session- and object-level audit logging, configurable granularity) | MySQL Enterprise Audit (commercial) or the open-source `audit_log` plugin (Percona Server/MySQL Community with the plugin installed) |
| What to actually audit | Login attempts (success and failure), privilege changes (`GRANT`/`REVOKE`/`ALTER ROLE`), DDL, and access to specifically sensitive tables — not every `SELECT` on every table, which generates overwhelming noise with little investigative value | Same principle applies |
| Where logs should live | Shipped to a system separate from the database itself (a SIEM, a dedicated log-aggregation service) — logs stored only on the database host are lost in exactly the scenario (compromise, disk failure) where you'd need them most | Same |

- **Audit logging has a real performance cost proportional to its granularity** — full statement-level auditing on a high-throughput OLTP system is a genuine trade-off to make deliberately, not something to enable by default "just in case."
- **Failed login attempts are as important to audit as successful ones** — a pattern of failed authentication is often the earliest signal of a credential-stuffing or brute-force attempt.
- **Privilege changes deserve their own alerting**, not just logging — a `GRANT SUPERUSER`/`GRANT ALL PRIVILEGES` outside of a known, approved change window is worth an immediate alert, not a line in a log nobody reviews until an incident forces the question.

---

## 10. Service Accounts & Application Credentials

- **Never share one database credential across every application/service** — each service (or at minimum, each distinct trust boundary) should have its own account, so a compromised credential's blast radius is scoped and revocation doesn't require rotating every consumer at once.
- **Store credentials in a secrets manager, not in application config files or environment variables committed anywhere near source control** — this is an application-security concern as much as a DBA one, but the DBA is usually the one who has to actually rotate the credential when it leaks.
- **Rotate credentials on a schedule, and immediately upon any suspected exposure** — both engines support `ALTER USER/ROLE ... PASSWORD EXPIRE` policies to enforce rotation cadence rather than relying on manual discipline.
- **Connection pooling accounts (PgBouncer, ProxySQL) need their own careful privilege scoping** — a pooler that authenticates once and multiplexes many application connections behind it can inadvertently become a single point that, if compromised, has the combined privileges of everything behind it; scope the pooler's own database-level credential as tightly as the least-privileged consumer it serves, and use pooler-level user-specific pools where the workload supports it.

---

## 11. Common RBAC Design Patterns

| Pattern | Description |
|---|---|
| **Tiered read access** | `readonly` role (SELECT-only) → `readwrite` role (adds INSERT/UPDATE/DELETE) → `admin` role (adds DDL) — each a strict superset of the one below, individuals granted the lowest tier that satisfies their actual need |
| **Per-schema/per-domain roles** | In multi-team databases, a role per business domain/schema (`billing_readonly`, `billing_readwrite`, `inventory_readonly`, ...) rather than instance-wide roles — keeps blast radius of any single compromised credential scoped to one domain |
| **Environment-scoped credentials** | Entirely separate accounts (and ideally entirely separate instances) per environment (dev/staging/prod) — a credential that works in staging should never also work in production |
| **Time-boxed elevated access** | A role grant with a `VALID UNTIL` expiry (PostgreSQL) or an equivalent manual process (MySQL lacks a native per-grant expiry) for temporary elevated access during an incident or a specific task, rather than a permanent grant "for convenience" |
| **Separation of duties** | The account that can modify schema/DDL is not the same account the application uses for runtime queries — so an application-layer SQL injection vulnerability, for instance, cannot also alter the schema or grant itself further privileges |

---

## 12. Compliance Mapping (SOC 2, PCI-DSS, HIPAA)

Database-level access control is where a significant fraction of compliance audit evidence actually comes from — mapping the patterns in this cheatsheet to specific framework requirements saves real audit-prep time.

| Framework requirement (typical phrasing) | What it maps to in this cheatsheet |
|---|---|
| "Access is granted based on least privilege / need-to-know" | Section 7 (Least Privilege patterns), Section 11 (tiered RBAC) — the audit evidence is your actual grant structure plus documentation of *why* each role has what it has |
| "Access is reviewed periodically" | A documented, recurring access-review process (Section 12's own closing gotcha below) — auditors specifically want to see evidence of the review happening, not just a policy stating it should |
| "Privileged access is logged and monitored" | Section 9 (Auditing) — specifically privilege-change events (`GRANT`/`REVOKE`/`ALTER ROLE`), not just data access |
| "Access is revoked promptly upon termination/role change" | A documented, timed process (ideally automated via your identity provider, see Section 13) with evidence of actual revocation timestamps relative to the termination/change event |
| "Data is encrypted in transit" | Section 8's TLS/`ssl=on`/`require_secure_transport` configuration, plus evidence it's actually enforced (not just available) via `pg_hba.conf` `hostssl`-only rules or `REQUIRE SUBJECT`/`REQUIRE X509` |
| "Segregation of duties" | Section 11's separation-of-duties pattern — schema/DDL accounts distinct from application runtime accounts, with evidence (grant listings) that this is actually the case, not just documented as a policy |
| PCI-DSS specifically: "unique ID for each person with access" | Directly conflicts with any shared service account used by multiple humans — individual named accounts (with role membership for shared privilege sets) are required for anyone with interactive database access under PCI-DSS, distinct from application service accounts |
| HIPAA specifically: "audit controls" (§164.312(b)) | Section 9's auditing, scoped to include access to any table holding PHI specifically — a general audit policy that doesn't clearly cover the PHI-holding tables by name is a common audit finding |

**Practical audit-prep advice**: maintain a living document mapping each compliance requirement to the specific database configuration/process that satisfies it, updated whenever the access model changes — reconstructing this mapping from scratch during actual audit season, under time pressure, is far more painful than keeping it current incrementally. Auditors generally want to see *evidence over time* (log history, past review records), not just that the configuration is currently correct.

---

## 13. LDAP/Active Directory Integration

Centralizing database authentication against an existing corporate directory avoids the sprawl of independently-managed database-local accounts.

**PostgreSQL** (`pg_hba.conf`):
```conf
# Authenticate against AD/LDAP, but the PostgreSQL role must already exist
host  all  all  10.0.0.0/8  ldap ldapserver=ad.corp.internal ldapbasedn="dc=corp,dc=internal" ldapsearchattribute=uid
```
- PostgreSQL's LDAP auth methods **authenticate** against the directory but do not automatically **create or manage roles** — the PostgreSQL role must exist locally with the matching name, and its privilege grants are still managed via ordinary `GRANT` statements. LDAP integration solves "prove who you are without another password to manage," not "automatically provision database privileges from AD group membership" — that mapping has to be built separately (commonly via a provisioning script reacting to AD group changes, or a third-party identity-governance tool).

**MySQL** (`authentication_ldap_sasl`/`authentication_ldap_simple` plugins):
```sql
CREATE USER 'alice'@'%' IDENTIFIED WITH authentication_ldap_simple AS 'uid=alice,ou=people,dc=corp,dc=internal';
```
- Similarly, the MySQL user account must exist with the plugin configured per-user (or via a proxy-user mapping pattern where LDAP-authenticated connections are mapped to a shared MySQL proxy account with the actual privileges) — MySQL's LDAP support does not auto-provision accounts from directory group membership out of the box either.

**Common integration patterns, regardless of engine**:
- **Group-to-role mapping via automation**: a scheduled job (or an identity-governance platform like SailPoint/Okta workflows) reads AD/LDAP group membership and reconciles it against database role grants — add someone to the `db-analysts` AD group, and the automation grants them the corresponding database role within its next sync cycle, without a DBA manually running `GRANT` for each new hire.
- **Deprovisioning is the higher-stakes half of this integration** — the sync job removing database access promptly when someone leaves an AD group (or the company) matters more for security posture than the provisioning half, and deserves explicit testing/alerting if the sync job itself fails silently.
- **Break-glass accounts should bypass LDAP dependency deliberately** — if the directory service itself is down, a small number of local-auth emergency accounts (tightly controlled, logged, and rotated) prevent "we can't even log in to fix the outage because auth depends on the thing that's down."

---

## 14. Worked Examples

### Example 1 — Designing RBAC for a multi-tenant SaaS from scratch
A new product needs database access for: the application's own runtime, a support team that needs read access to help debug customer issues, a data/analytics team building dashboards, and DBAs doing schema migrations.
```sql
-- Application runtime: exactly what the app needs, nothing more
CREATE ROLE app_runtime NOLOGIN;
GRANT CONNECT ON DATABASE saas_app TO app_runtime;
GRANT USAGE ON SCHEMA app TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO app_runtime;
-- Explicitly no DDL, no superuser, no access to other schemas

-- Support: read-only, and NOT on payment-related columns
CREATE ROLE support_readonly NOLOGIN;
GRANT CONNECT ON DATABASE saas_app TO support_readonly;
GRANT USAGE ON SCHEMA app TO support_readonly;
GRANT SELECT ON app.customers, app.orders, app.support_tickets TO support_readonly;
REVOKE SELECT (payment_method_token, billing_address) ON app.customers FROM support_readonly;

-- Analytics: read-only on a separate reporting schema (materialized views), not raw production tables
CREATE ROLE analytics_readonly NOLOGIN;
GRANT CONNECT ON DATABASE saas_app TO analytics_readonly;
GRANT USAGE ON SCHEMA reporting TO analytics_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO analytics_readonly;

-- DBA/migration role: DDL rights, used only during deploys, never for day-to-day app traffic
CREATE ROLE schema_admin NOLOGIN;
GRANT CONNECT, CREATE ON DATABASE saas_app TO schema_admin;
GRANT ALL PRIVILEGES ON SCHEMA app TO schema_admin;

-- Individual named human accounts, granted the appropriate role(s) — never login directly as a role
CREATE ROLE priya LOGIN PASSWORD '...' IN ROLE support_readonly;
CREATE ROLE diego LOGIN PASSWORD '...' IN ROLE analytics_readonly;
```
1. **Every design decision here maps to a principle from earlier sections**: `app_runtime` follows least-privilege (Section 7) and has no DDL, so an application-layer vulnerability can't alter schema; `support_readonly` uses column-level revokes to keep payment data out of reach even for legitimate debugging access; `analytics_readonly` only touches a separate reporting schema (materialized views, per the Query Plan cheatsheet) rather than hitting production tables directly, protecting both data-sensitivity boundaries and production query performance; `schema_admin` is a distinct account from `app_runtime`, enforcing separation of duties (Section 11).
2. **This also satisfies several of Section 12's compliance mappings directly**: distinct named human accounts (PCI-DSS's unique-ID requirement), tiered/scoped roles (least-privilege evidence), and a schema-admin account used only during deploys (segregation of duties) are all visible directly in this grant structure without any extra process layered on top.

### Example 2 — Incident response for a leaked application credential
A developer accidentally commits the `app_runtime` database password to a public GitHub repository; it's discovered and reported 6 hours later.
1. **Immediate containment**: rotate the credential immediately — `ALTER ROLE app_runtime_login PASSWORD 'new_random_value';` (PostgreSQL) or `ALTER USER 'app_runtime'@'%' IDENTIFIED BY 'new_random_value';` (MySQL) — and update the application's configuration/secrets manager to the new value, restarting/redeploying the application to pick it up.
2. **Scope the blast radius using Section 9's auditing**: query the audit log for all activity under this credential during the exposure window (from commit time to rotation time) — did any connections originate from IPs outside the application's own known infrastructure? Any unexpected queries, especially DDL or bulk `SELECT`s inconsistent with normal application query patterns?
3. **Confirm the exposure is actually closed**: verify no active sessions remain authenticated with the old credential (some connection pooling layers may hold long-lived connections that don't immediately drop on password rotation — explicitly terminate any sessions still using the old credential if the engine/pooler doesn't do so automatically).
4. **Assess whether this account's privilege scope limited the damage**: because `app_runtime` (per Example 1's design) has no DDL rights and no access to other schemas, the worst case even with a genuinely malicious actor using the leaked credential during the exposure window is data read/write within the `app` schema only — a direct, concrete payoff of the least-privilege design done up front, worth explicitly noting in the incident writeup as validation of the access model rather than something to redesign reactively.
5. **Process fix, not just credential fix**: add secret-scanning to the CI/CD pipeline (many platforms offer this natively) so a committed credential is caught and auto-rotated within minutes rather than discovered 6 hours later by a third party, and confirm the credential rotation procedure itself was fast and low-friction — if step 1 took an hour because nobody remembered how, that's its own finding to fix regardless of how this particular incident turned out.

---

## 15. Gotchas

- **MySQL's `'user'@'host'` pairing means `'alice'@'%'` and `'alice'@'192.168.1.10'` are different accounts with potentially different privileges** — a very common source of "why doesn't this grant apply" confusion.
- **`FLUSH PRIVILEGES` is not needed after ordinary `GRANT`/`REVOKE`/`CREATE USER` in modern MySQL** — running it out of habit is harmless but signals a mental model that's a decade out of date and worth correcting.
- **PostgreSQL table owners bypass Row-Level Security by default** — always confirm whether the connecting role is the table owner before assuming RLS policies are actually being enforced; use `FORCE ROW LEVEL SECURITY` when the owner itself should also be subject to policies.
- **`SECURITY DEFINER` functions (PostgreSQL) and `SQL SECURITY DEFINER` routines (MySQL) run with the *definer's* privileges, not the caller's** — a powerful and useful pattern for scoped privilege escalation, but a real privilege-escalation risk if the definer is highly privileged and the routine doesn't carefully control what it does (in PostgreSQL specifically, always set `search_path` explicitly inside `SECURITY DEFINER` functions to prevent search-path-based object hijacking).
- **`WITH GRANT OPTION` / `WITH ADMIN OPTION` privileges are easy to lose track of** — a privilege granted with re-grant rights can spread further than the original grantor intended, with no built-in audit trail of who re-granted what unless auditing (Section 9) is explicitly enabled.
- **Default/overly broad `pg_hba.conf` rules earlier in the file shadow more specific rules later** — always double-check evaluation order, especially after adding a new, more restrictive rule that you expect to take precedence.
- **Revoking a role's privileges does not retroactively revoke access already cached in an open session** in some circumstances — depending on the engine and connection pooling layer, an already-authenticated session may retain effectively-granted privileges until it reconnects; don't assume a `REVOKE` takes effect instantaneously for every already-open connection without verifying.
- **"We'll clean up access later" almost never happens without a scheduled review process** — stale grants from former employees, decommissioned services, or long-finished one-off tasks are one of the most common findings in any real access-control audit, precisely because there's no natural trigger that surfaces them otherwise.
