# 🔧 DevOps & CI/CD

> SnowSQL/CLI, schema migrations, Terraform, native Git integration, and dbt — how Snowflake objects get version-controlled and deployed.

---

## 1. SnowSQL (CLI)

```bash
# Install & connect
snowsql -a <account_locator> -u <username> -r <role> -w <warehouse> -d <database> -s <schema>

# Run a script non-interactively (CI-friendly)
snowsql -a myaccount -u ci_user --private-key-path ./rsa_key.p8 \
    -f deploy_schema.sql -o exit_on_error=true -o friendly=false

# Variable substitution — critical for parameterizing deploys across environments
snowsql -f migrate.sql -D env_name=PROD -D db_name=SALES_PROD
```

```sql
-- Inside migrate.sql, reference substitution variables like:
CREATE DATABASE IF NOT EXISTS &db_name;
```

### 1.1 Connection Configuration

```ini
# ~/.snowsql/config
[connections.prod]
accountname = myaccount
username = ci_user
private_key_path = /secrets/rsa_key.p8
warehousename = deploy_wh
dbname = sales_db
rolename = SYSADMIN
```

```bash
snowsql -c prod -f deploy_schema.sql
```

---

## 2. Snowflake CLI (`snow`) — the modern replacement for SnowSQL

```bash
# Newer unified CLI — connection management, SQL execution, and object lifecycle
snow connection add --connection-name prod
snow sql -q "SELECT CURRENT_VERSION()" -c prod

# Native app / Snowpark project scaffolding and deployment
snow snowpark deploy
snow streamlit deploy

# Manage Snowpark Container Services from the CLI
snow spcs image-repository create my_repo
snow spcs service create my_service --spec-path spec.yaml
```

---

## 3. Schema Migrations with `schemachange` (Flyway/Liquibase-style for Snowflake)

The most common pattern for versioned, repeatable DDL deployment.

```
migrations/
  V1.1.1__create_orders_table.sql
  V1.1.2__add_clustering_key.sql
  V1.2.0__add_masking_policy.sql
  R__update_analyst_grants.sql       -- "Repeatable" migration, reruns whenever content changes
```

```bash
# schemachange tracks applied migrations in a CHANGE_HISTORY table, only runs new ones
pip install schemachange
schemachange deploy \
    -f migrations/ \
    -a myaccount \
    -u ci_user \
    -r SYSADMIN \
    -w DEPLOY_WH \
    -d SALES_DB \
    --private-key-path ./rsa_key.p8

# Verify what WOULD run without applying (dry-run equivalent)
schemachange deploy --dry-run -f migrations/ -a myaccount -u ci_user -r SYSADMIN -w DEPLOY_WH -d SALES_DB
```

```sql
-- schemachange auto-creates and reads from this table to know what's already applied
SELECT * FROM sales_db.schemachange.change_history ORDER BY installed_on DESC;
```

> 🔑 **Why this matters:** unlike application code, DDL isn't naturally idempotent — `schemachange` (or an equivalent) gives you the "only run once, in order, tracked" guarantee that `COPY INTO`'s load history gives you for data. Without it, teams end up manually tracking "did we run this ALTER on prod yet?" in a Slack thread.

### 3.1 Versioned vs Repeatable Migrations

- **Versioned** (`V1.1.1__...sql`): applied exactly once, in order, ever — for structural changes (`CREATE TABLE`, `ALTER TABLE ADD COLUMN`)
- **Repeatable** (`R__...sql`): re-applied every deploy if the file's content changed since last run — ideal for `CREATE OR REPLACE VIEW`, grant scripts, stored procedure definitions that get iterated on

---

## 4. Terraform (infrastructure as code)

```hcl
terraform {
  required_providers {
    snowflake = {
      source  = "Snowflake-Labs/snowflake"
      version = "~> 0.90"
    }
  }
}

provider "snowflake" {
  role = "SYSADMIN"
}

resource "snowflake_warehouse" "etl_wh" {
  name           = "ETL_WH"
  warehouse_size = "MEDIUM"
  auto_suspend   = 60
  auto_resume    = true
}

resource "snowflake_database" "sales" {
  name = "SALES_DB"
}

resource "snowflake_schema" "public" {
  database = snowflake_database.sales.name
  name     = "PUBLIC"
}

resource "snowflake_role" "analyst" {
  name = "ANALYST_ROLE"
}

resource "snowflake_grant_privileges_to_role" "analyst_select" {
  role_name  = snowflake_role.analyst.name
  privileges = ["SELECT"]
  on_schema_object {
    all {
      object_type_plural = "TABLES"
      in_schema           = "${snowflake_database.sales.name}.${snowflake_schema.public.name}"
    }
  }
}

resource "snowflake_resource_monitor" "monthly_budget" {
  name         = "MONTHLY_ETL_BUDGET"
  credit_quota = 1000
  frequency    = "MONTHLY"

  notify_triggers  = [75, 90]
  suspend_trigger  = 100
}
```

```bash
terraform plan -out=tfplan
terraform apply tfplan

# Import existing manually-created objects into Terraform state (common early-adoption step)
terraform import snowflake_warehouse.etl_wh ETL_WH
```

> **What Terraform should own vs what it shouldn't:** warehouses, databases, schemas, roles/grants, resource monitors, integrations — the *structural* objects. Leave table DDL and row-level data to `schemachange`/dbt migrations; mixing the two in one Terraform state tends to get painful fast (state drift on every table change).

### 4.1 Environment Promotion Strategy

```hcl
# environments/prod/main.tf
module "warehouses" {
  source       = "../../modules/warehouses"
  environment  = "prod"
  etl_wh_size  = "LARGE"
}

# environments/dev/main.tf
module "warehouses" {
  source       = "../../modules/warehouses"
  environment  = "dev"
  etl_wh_size  = "XSMALL"    -- smaller, cheaper compute in dev
}
```

A common pattern: separate Terraform workspaces/state files per environment (dev/staging/prod), with a shared module defining the object *shape*, parameterized per environment for sizing and naming.

---

## 5. Native Git Integration (Snowflake as the deploy target, Git as source of truth)

```sql
-- Connect a Git repo directly to Snowflake (no external CI runner needed for simple cases)
CREATE API INTEGRATION git_api_integration
    API_PROVIDER = git_https_api
    API_ALLOWED_PREFIXES = ('https://github.com/my-org/')
    ENABLED = TRUE;

CREATE GIT REPOSITORY my_repo
    API_INTEGRATION = git_api_integration
    ORIGIN = 'https://github.com/my-org/snowflake-objects.git';

-- Fetch latest and execute a script directly from the repo, no clone/checkout step
ALTER GIT REPOSITORY my_repo FETCH;

EXECUTE IMMEDIATE FROM @my_repo/branches/main/migrations/deploy.sql;

-- List files available in the connected repo
LS @my_repo/branches/main/;

-- Deploy a Python UDF/stored procedure straight from a Git-connected stage
CREATE OR REPLACE PROCEDURE rebuild_summary()
    RETURNS STRING
    LANGUAGE PYTHON
    RUNTIME_VERSION = '3.10'
    IMPORTS = ('@my_repo/branches/main/src/pipeline.py')
    HANDLER = 'pipeline.run';
```

> Useful for lightweight teams that want Git-as-source-of-truth without standing up a full external CI runner just to `snowsql -f`. For anything beyond simple deploy scripts, most teams still run this from GitHub Actions/GitLab CI rather than purely native.

---

## 6. GitHub Actions Example (typical CI/CD pattern)

```yaml
name: Deploy Snowflake Schema
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dbt
        run: pip install dbt-snowflake
      - name: Run dbt tests against a scratch schema
        env:
          DBT_TARGET: ci
        run: |
          dbt deps
          dbt run --target ci
          dbt test --target ci

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install schemachange
        run: pip install schemachange
      - name: Deploy migrations
        env:
          SNOWFLAKE_PRIVATE_KEY: ${{ secrets.SNOWFLAKE_PRIVATE_KEY }}
        run: |
          schemachange deploy -f migrations/ -a ${{ vars.SF_ACCOUNT }} \
            -u ${{ vars.SF_USER }} -r SYSADMIN -w DEPLOY_WH -d SALES_DB
```

> 🔑 **Test-before-deploy pattern:** run `dbt test` (or equivalent data quality checks) against a CI-scoped scratch schema/database *before* merging to main — often built via a zero-copy `CLONE` of prod taken at PR-open time, so CI tests against realistic data without touching production.

```sql
-- CI scratch environment via clone (fast, cheap, safe to run destructive tests against)
CREATE DATABASE ci_scratch_pr_142 CLONE sales_db_prod;
-- ...run tests...
DROP DATABASE ci_scratch_pr_142;   -- teardown step in the CI job
```

---

## 7. dbt on Snowflake

```yaml
# profiles.yml
sales_project:
  target: prod
  outputs:
    prod:
      type: snowflake
      account: myaccount
      user: dbt_user
      private_key_path: /path/rsa_key.p8
      role: TRANSFORMER_ROLE
      database: SALES_DB
      warehouse: TRANSFORM_WH
      schema: analytics
      threads: 8
    ci:
      type: snowflake
      account: myaccount
      user: ci_user
      private_key_path: /path/ci_rsa_key.p8
      role: CI_ROLE
      database: CI_SCRATCH
      warehouse: DEV_WH
      schema: analytics
      threads: 4
```

```sql
-- models/orders_summary.sql — Snowflake-specific config options in the model header
{{
  config(
    materialized='incremental',
    unique_key='order_id',
    cluster_by=['order_date'],
    incremental_strategy='merge'
  )
}}

SELECT * FROM {{ ref('stg_orders') }}
{% if is_incremental() %}
WHERE order_date > (SELECT MAX(order_date) FROM {{ this }})
{% endif %}
```

```yaml
# models/schema.yml — dbt tests, the CI data-quality gate
models:
  - name: orders_summary
    columns:
      - name: order_id
        tests: [unique, not_null]
      - name: customer_id
        tests:
          - relationships:
              to: ref('customers')
              field: customer_id
```

```bash
dbt run --target prod
dbt test
dbt run-operation snowflake__copy_grants   # dbt-snowflake specific macro helpers
dbt docs generate && dbt docs serve         # lineage graph + documentation site
```

> 🔑 **`copy_grants` gotcha:** dbt's default `CREATE OR REPLACE TABLE` behavior drops and recreates grants unless you set `copy_grants: true` in the model config or table-level DDL — a classic "why did the BI tool lose access after last night's dbt run" incident.

### 7.1 dbt + Dynamic Tables (newer dbt-snowflake materialization)

```sql
{{ config(materialized='dynamic_table', target_lag='1 hour', snowflake_warehouse='transform_wh') }}

SELECT customer_id, SUM(amount) AS total_spend
FROM {{ ref('stg_orders') }}
GROUP BY 1
```

---

## 8. Secrets Management in CI

```bash
# Never commit private keys — use CI provider secret stores
# GitHub Actions: repository/organization secrets
# GitLab CI: masked/protected CI/CD variables

# Rotate service account keys periodically — Snowflake supports two active keys per user
# for zero-downtime rotation:
ALTER USER svc_ci SET RSA_PUBLIC_KEY_2 = 'MIIBIjANB...';
# deploy the new private key to CI secrets, verify, THEN:
ALTER USER svc_ci UNSET RSA_PUBLIC_KEY;
ALTER USER svc_ci SET RSA_PUBLIC_KEY = 'MIIBIjANB...' /* the value that was in KEY_2 */;
ALTER USER svc_ci UNSET RSA_PUBLIC_KEY_2;
```

---

## 9. Rollback Strategies

Snowflake doesn't have a native "migration rollback" concept the way some app frameworks do — the practical patterns:

```sql
-- Table-level rollback via Time Travel, if a bad deploy corrupted data (not just schema)
CREATE OR REPLACE TABLE orders CLONE orders AT(OFFSET => -1800);

-- Schema rollback: write a new forward migration that reverses the previous one
-- (preferred over trying to "undo" — keeps the migration history linear and auditable)
-- V1.2.1__revert_masking_policy_change.sql
ALTER TABLE customers MODIFY COLUMN ssn UNSET MASKING POLICY;
```

> Treat rollbacks as **new forward migrations**, not history rewrites — this keeps `schemachange`'s change history table (and your audit trail) trustworthy.

---

## 10. Quick Reference: Databricks ↔ Snowflake DevOps

| Databricks concept | Snowflake equivalent |
|---|---|
| Databricks CLI | SnowSQL / `snow` CLI |
| Databricks Asset Bundles (DABs) | `schemachange` + Terraform (no single unified bundle format) |
| Repos (Git folders in workspace) | Native Git Integration (`GIT REPOSITORY` objects) |
| Terraform Databricks provider | Terraform Snowflake provider (`Snowflake-Labs/snowflake`) |
| Unity Catalog volumes for artifacts | Internal Stages |
| Databricks Workflows for CI | Tasks, or external CI (GitHub Actions/GitLab) triggering `schemachange` |
| Delta table CI testing via clone | Zero-copy `CLONE` for CI scratch environments |

---

## 11. Interview / Self-Check Q&A

**Q: Why use `schemachange` (or similar) instead of just running `.sql` files manually against prod?**
A: It tracks exactly which migrations have already been applied (via a change-history table), guarantees ordering, and prevents accidental re-application — turning DDL deploys into the same auditable, idempotent process you'd expect from application code migrations.

**Q: What's the risk of managing both table DDL and warehouse/role infrastructure in the same Terraform state?**
A: Frequent table-level changes (columns, clustering keys) cause constant state drift/plan noise in a state file that should mostly represent stable structural objects — most teams split table DDL into `schemachange`/dbt and keep Terraform scoped to warehouses, databases, roles, and grants.

**Q: How do you test a schema migration against realistic data without touching production?**
A: Zero-copy `CLONE` production into a CI-scoped scratch database at PR time, run the migration and tests against the clone, then drop it — fast and free until data actually diverges.

**Q: Why would a BI tool suddenly lose access to a table right after a dbt run, with no grant changes made intentionally?**
A: dbt's default `CREATE OR REPLACE TABLE` materialization drops and recreates the table, which also drops its grants unless `copy_grants: true` is configured — a very common "silent access regression" in dbt-on-Snowflake shops.

**Q: How do you rotate a service account's key pair with zero pipeline downtime?**
A: Snowflake supports two simultaneously active RSA public keys per user (`RSA_PUBLIC_KEY` and `RSA_PUBLIC_KEY_2`) — set the new key in the secondary slot, deploy the new private key to CI, verify it works, then unset the old key and promote the new one to the primary slot.
