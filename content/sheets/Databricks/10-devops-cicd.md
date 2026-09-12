# DevOps & CI/CD Cheatsheet

> Treating Databricks like real software: source control, environments, automated testing, and deployment pipelines.

---

## 1. The Core Idea

Don't build production pipelines by clicking in the UI. Instead:

1. Write code (notebooks/`.py` files/SQL) in a **Git repo**.
2. Define infrastructure (jobs, pipelines, clusters) **as code** using **Databricks Asset Bundles (DABs)**.
3. Use **CI/CD** (GitHub Actions, Azure DevOps, GitLab CI, Jenkins) to test and deploy across dev → staging → prod.

```
Git Repo ──▶ CI (lint/test) ──▶ Bundle Deploy (dev) ──▶ Integration Tests ──▶ Bundle Deploy (prod)
```

This mirrors standard software engineering practice — the goal is that **no production change happens by hand**; everything is reviewable in a pull request and reproducible from source control.

---

## 2. Databricks Repos (Git Integration)

- Clone/sync a Git repo directly into a workspace folder (`/Repos/...`).
- Supports GitHub, GitLab, Bitbucket, Azure DevOps, and generic Git providers.
- Enables **branch-based development**: create a feature branch, edit notebooks, commit/push, open a PR — all from within the workspace UI, or by editing locally and syncing.

```bash
# Typical dev loop
git checkout -b feature/new-pipeline
# edit notebooks in Databricks UI (backed by Repos) or locally via an IDE + Databricks Connect
git add . && git commit -m "add new pipeline" && git push
# open PR in your Git provider
```

> Best practice: keep **environment-specific config** (catalog names, paths, credentials) out of notebooks entirely — parameterize via job parameters or bundle variables instead, so the exact same code runs unmodified in dev, staging, and prod.

---

## 3. Databricks Asset Bundles (DABs)

The modern **Infrastructure-as-Code** standard for Databricks — YAML definitions of jobs, pipelines, and clusters bundled together with your source code, deployed as one atomic unit.

```
my_project/
├── databricks.yml          # root bundle config
├── resources/
│   ├── jobs.yml
│   └── pipelines.yml
├── src/
│   ├── ingest.py
│   └── transform.py
└── tests/
    └── test_transform.py
```

```yaml
# databricks.yml
bundle:
  name: my_project

variables:
  catalog:
    default: dev_catalog

targets:
  dev:
    workspace:
      host: https://dev-workspace.cloud.databricks.com
    mode: development
    variables:
      catalog: dev_catalog
  prod:
    workspace:
      host: https://prod-workspace.cloud.databricks.com
    mode: production
    variables:
      catalog: prod_catalog
    run_as:
      service_principal_name: prod-sp
```

```yaml
# resources/jobs.yml
resources:
  jobs:
    etl_job:
      name: etl_job_${bundle.target}
      tasks:
        - task_key: ingest
          notebook_task:
            notebook_path: ../src/ingest.py
            base_parameters:
              catalog: ${var.catalog}
          new_cluster:
            spark_version: "15.4.x-scala2.12"
            num_workers: 2
```

```bash
databricks bundle init            # scaffold a new project from a template
databricks bundle validate        # check config correctness before deploying
databricks bundle deploy -t dev   # deploy resources to the dev target
databricks bundle deploy -t prod
databricks bundle run etl_job -t dev
databricks bundle destroy -t dev  # tear down deployed resources cleanly
```

**Why DABs over clicking in the UI:**
- Version-controlled, code-reviewable infrastructure — a job schedule change goes through the same PR review as application code.
- Consistent, repeatable deployments across environments via `targets` and `variables`.
- Environment-specific overrides without duplicating job definitions (one YAML template, multiple targets).
- Native CI/CD integration — `databricks bundle deploy` is a single command a pipeline can call.
- **`mode: development`** vs. **`mode: production`** changes default behaviors (e.g., dev mode prefixes resource names with the deploying user and pauses schedules by default, to prevent a developer's test deploy from colliding with or accidentally running the real production schedule).

### Bundle Templates
`databricks bundle init` can scaffold from built-in templates (default Python project, DLT pipeline project, MLOps stack) or a custom template your platform team maintains — a good way to standardize project structure across many teams.

---

## 4. Environments & Promotion Strategy

| Environment | Purpose | Typical settings |
|-------------|---------|-------------------|
| **Dev** | Individual development, fast iteration | Small clusters, `mode: development`, personal or per-branch catalogs |
| **Staging/QA** | Integration testing, pre-prod validation | Prod-like data volume, isolated catalog, same job definitions as prod |
| **Prod** | Live workloads | Locked-down permissions, run-as service principal, alerting on, schedules active |

> Use **separate Unity Catalog catalogs** (`dev`, `staging`, `prod`) rather than separate metastores — keeps governance unified while isolating data. Bundle `variables` are the standard mechanism for pointing the same job definition at a different catalog per target.

---

## 5. CI/CD Pipeline Example (GitHub Actions)

```yaml
name: deploy
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install databricks-cli pytest

      - name: Run unit tests
        run: pytest tests/

      - name: Validate bundle
        run: databricks bundle validate -t dev
        env:
          DATABRICKS_HOST: ${{ secrets.DATABRICKS_HOST }}
          DATABRICKS_TOKEN: ${{ secrets.DATABRICKS_TOKEN }}

      - name: Deploy to dev
        if: github.event_name == 'pull_request'
        run: databricks bundle deploy -t dev

      - name: Run integration test job
        if: github.event_name == 'pull_request'
        run: databricks bundle run integration_test_job -t dev

      - name: Deploy to prod
        if: github.ref == 'refs/heads/main'
        run: databricks bundle deploy -t prod
        env:
          DATABRICKS_HOST: ${{ secrets.PROD_DATABRICKS_HOST }}
          DATABRICKS_TOKEN: ${{ secrets.PROD_DATABRICKS_TOKEN }}
```

**Typical gate structure:** PR → deploy to dev + run integration tests → merge to `main` → deploy to staging → manual approval gate → deploy to prod. Most CI systems support this as a multi-stage pipeline with required approvals between stages.

---

## 6. Testing Strategies

| Test type | Approach |
|-----------|----------|
| **Unit tests** | Pure Python functions (business logic extracted from notebooks) tested with `pytest`, no Spark needed where possible |
| **Local Spark tests** | Use `pyspark` locally or `chispa`/`spark-testing-base` for DataFrame equality/schema assertions |
| **Integration tests** | Run actual jobs/DLT pipelines against a `dev`/`staging` catalog with representative sample data |
| **Data quality tests** | DLT expectations, or standalone Great Expectations / dbt tests as a separate validation task |
| **Notebook-as-code** | Keep logic in importable `.py` modules; notebooks become thin orchestration wrappers — makes unit testing far easier since you can import and test functions directly without a Spark session |

```python
# tests/test_transform.py
from src.transform import clean_orders

def test_clean_orders_filters_negative_amounts(spark):
    df = spark.createDataFrame([(1, -5.0), (2, 10.0)], ["id", "amount"])
    result = clean_orders(df)
    assert result.count() == 1
```

```python
# conftest.py — a shared local SparkSession fixture for tests
import pytest
from pyspark.sql import SparkSession

@pytest.fixture(scope="session")
def spark():
    return SparkSession.builder.master("local[2]").appName("tests").getOrCreate()
```

---

## 7. Service Principals for Automation

Never run production jobs/CI as a personal user account — if that person leaves the company or their password rotates, production silently breaks.

```bash
databricks service-principals create --display-name "prod-etl-sp"
```
```yaml
# in bundle target
run_as:
  service_principal_name: prod-etl-sp
```
- Grant the service principal only the UC privileges it needs (least privilege) — typically `USE CATALOG`/`USE SCHEMA` + `SELECT`/`MODIFY` on specific schemas, not blanket account-wide access.
- Store its OAuth token/secret in your CI system's secret store, never in code or committed config files.
- Rotate service principal credentials on a schedule, and immediately upon any suspected exposure.

---

## 8. Secrets Management

```bash
databricks secrets create-scope my-scope
databricks secrets put-secret my-scope db-password
```
```python
password = dbutils.secrets.get(scope="my-scope", key="db-password")
```
- Reference secrets by scope/key — never hardcode credentials in notebooks or bundle YAML.
- **Databricks-backed scopes**: secrets stored and encrypted by Databricks itself, simplest to set up.
- **Cloud-native-backed scopes** (e.g., Azure Key Vault-backed scopes): secrets actually live in your cloud's secret manager, and Databricks references them — preferred for enterprises that already centralize secrets there and want a single source of truth/rotation policy.
- Secrets are automatically **redacted from notebook output/logs** if the exact string value appears — but this is a best-effort protection, not a substitute for proper access control.

---

## 9. Alternative IaC: Terraform Provider

For organizations already standardized on Terraform for all cloud infrastructure, the **Databricks Terraform Provider** can manage workspaces, clusters, jobs, Unity Catalog objects, and permissions alongside the rest of your cloud infra in one `terraform apply`.

```hcl
resource "databricks_job" "etl_job" {
  name = "etl_job"
  task {
    task_key = "ingest"
    notebook_task { notebook_path = "/Repos/prod/ingest" }
  }
}
```

**DABs vs. Terraform:** DABs are purpose-built for Databricks-native project structure (bundling code + config together, fast local iteration via `databricks bundle run`), while Terraform is better when Databricks resources need to be provisioned as part of a broader multi-cloud-service infrastructure graph (VPCs, IAM roles, workspace creation itself). Many orgs use Terraform to provision the workspace/metastore/network layer, and DABs for the jobs/pipelines that run inside it.

---

## 10. Notebook Hygiene for Version Control

- Use **`.py` files with `# COMMAND ----------` cell markers** (Databricks' source format) instead of `.ipynb` — much cleaner diffs in Git (no embedded output/execution-count noise).
- Extract reusable logic into importable modules/packages rather than copy-pasting across notebooks.
- Keep notebooks thin: parameter handling + calls into tested library code.
- Add a **pre-commit hook** (`black`, `ruff`, `isort`) to keep formatting consistent and catch obvious errors before they reach CI.

---

## 11. Deployment Safety Practices

| Practice | Why |
|----------|-----|
| **`bundle validate` in CI before every deploy** | Catches YAML/schema errors before they hit a real workspace |
| **Separate service principals per environment** | Blast-radius containment — a compromised dev SP can't touch prod |
| **Manual approval gate before prod deploy** | Human-in-the-loop check for anything with real business/customer impact |
| **`mode: production` bundle target for prod** | Prevents accidental resource name collisions/dev artifacts leaking into prod |
| **Rollback plan** | Since bundle deploys are declarative, redeploying a previous Git commit's bundle state is usually sufficient to roll back a job/pipeline definition |

---

## 12. Quick Command Reference

```bash
databricks auth login --host https://<workspace>.cloud.databricks.com
databricks bundle init
databricks bundle validate
databricks bundle deploy -t <target>
databricks bundle run <resource_key> -t <target>
databricks bundle destroy -t <target>
databricks workspace export-dir /Repos/prod ./local-backup
databricks repos update --path /Repos/prod/my_project --branch main
databricks service-principals create --display-name "ci-sp"
databricks secrets create-scope my-scope
```

---

## Related Cheatsheets
- [Orchestration & Workflows](./07-orchestration-workflows.md)
- [Unity Catalog & Governance](./06-unity-catalog-governance.md)
- [Ingestion, ETL & DLT](./05-ingestion-etl-dlt.md) — testing DLT pipelines
