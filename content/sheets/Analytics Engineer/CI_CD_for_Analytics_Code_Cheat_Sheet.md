# CI/CD for Analytics Code Cheatsheet for Analytics Engineers

> A structured reference for building CI/CD pipelines around SQL and dbt projects — slim CI, GitHub Actions/GitLab CI examples, pre-commit hooks, environment promotion, and deployment patterns.

## 📑 Table of Contents

1. [🧠 Core Concepts](#core-concepts)
2. [🚀 dbt Slim CI](#dbt-slim-ci)
3. [🐙 GitHub Actions Examples](#github-actions-examples)
4. [🦊 GitLab CI Example](#gitlab-ci-example)
5. [🪝 Pre-Commit Hooks](#pre-commit-hooks)
6. [🧪 Testing Strategies](#testing-strategies)
7. [🌎 Environment Management](#environment-management)
8. [📦 Deployment Patterns](#deployment-patterns)
9. [📋 Artifact & State Comparison](#artifact-state-comparison)
10. [☁️ dbt Cloud CI Jobs & API Triggering](#dbt-cloud-ci-jobs-api-triggering)
11. [🌬️ Orchestrator-Triggered Pipelines](#orchestrator-triggered-pipelines)
12. [🔐 Secrets Management](#secrets-management)
13. [🧬 Matrix Testing Across Environments](#matrix-testing-across-environments)
14. [⏮️ Rollback Strategies](#rollback-strategies)
15. [🛠️ Troubleshooting Common CI Failures](#troubleshooting-common-ci-failures)
16. [⚠️ Common Gotchas](#common-gotchas)
17. [🎯 Best Practices](#best-practices)
18. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Task                              | Syntax / Command                                                        |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Run only changed models + downstream | `dbt build --select state:modified+ --state ./prod-artifacts`             |
| Defer unbuilt upstream refs        | `dbt build --select state:modified+ --defer --state ./prod-artifacts`      |
| Compile without running            | `dbt compile`                                                              |
| Lint SQL                           | `sqlfluff lint models/` or `sqlfluff fix models/`                          |
| Format SQL                         | `sqlfmt .` (or `sqlfluff fix` depending on tool choice)                    |
| Generate + save docs artifacts     | `dbt docs generate` → produces `manifest.json`, `catalog.json`             |
| Run dbt tests only                 | `dbt test --select state:modified+`                                        |
| Dry-run a GitHub Action locally    | `act -j <job_name>` (via `nektos/act`)                                     |
| Trigger a dbt Cloud job via API    | `POST /api/v2/accounts/{id}/jobs/{job_id}/run/`                            |
| Trigger dbt from Airflow           | `BashOperator`/`DbtCloudRunJobOperator` in a DAG                            |
| Mask a secret in logs              | `::add-mask::` (GitHub Actions) / masked CI/CD variable (GitLab)            |
| Roll back a bad prod deploy        | Re-point blue/green view, or re-run deploy job against last-good commit    |
| Run the same suite on two warehouses | CI matrix strategy (`strategy.matrix` in GitHub Actions)                  |

**CI stage cheat sheet**

| Stage         | What it checks                                              |
| ------------- | ------------------------------------------------------------- |
| Lint          | SQL style, formatting, naming conventions (`sqlfluff`)         |
| Compile       | Jinja/ref resolution, no syntax errors (`dbt compile`)          |
| Unit test     | Fixture-based tests on SQL logic (dbt unit tests, `dbt-unit-testing`) |
| Data test     | Warehouse-run tests on real data (`dbt test`, slim CI)          |
| Build         | Actually materializes modified models + downstream in a temp schema |
| Deploy        | Promotes to production schema/target on merge to main            |

## 🧠 Core Concepts

Analytics CI/CD differs from application CI/CD in one key way: **tests run against real (or sampled) data in a real warehouse**, not against mocked inputs — so pipelines need warehouse credentials, temp schemas, and cost awareness baked in from the start.

```text
PR opened  →  lint + compile (fast, no warehouse cost)
           →  slim CI build (build only changed models + downstream, in a temp/PR schema)
           →  dbt test on those models
           →  status check passes/fails on the PR
Merge to main → full or slim build against production target
              → dbt docs generate + publish
              → (optional) tag artifacts as new "prod state" for next PR's slim CI
```

## 🚀 dbt Slim CI

Slim CI avoids rebuilding the entire warehouse on every PR by comparing against a saved "state" (the production manifest) and only running what changed.

```bash
# Step 1: on every successful prod deploy, save the manifest as the new baseline
dbt compile --target prod
# upload target/manifest.json to a durable location (S3, GCS, artifacts store)

# Step 2: in CI, download the last prod manifest, then build only what changed
dbt build \
  --select state:modified+ \
  --state ./prod-artifacts \
  --target ci

# state:modified+ means: anything that changed, PLUS everything downstream of it
```

```bash
# Defer: don't rebuild unchanged upstream models at all — read them straight from prod
dbt build \
  --select state:modified+ \
  --defer \
  --state ./prod-artifacts \
  --target ci
```

```bash
# Useful state selectors
dbt ls --select state:modified          # just the changed nodes
dbt ls --select state:modified+         # changed nodes + downstream
dbt ls --select state:new               # models added since baseline
dbt ls --select result:error+           # rerun failures + downstream (after a failed run)
```

## 🐙 GitHub Actions Examples

```yaml
# .github/workflows/dbt_ci.yml
name: dbt CI

on:
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install sqlfluff sqlfluff-templater-dbt
      - run: sqlfluff lint models/ --dialect snowflake

  slim_ci:
    needs: lint
    runs-on: ubuntu-latest
    env:
      DBT_PROFILES_DIR: ./
      SNOWFLAKE_ACCOUNT: ${{ secrets.SNOWFLAKE_ACCOUNT }}
      SNOWFLAKE_USER: ${{ secrets.SNOWFLAKE_USER }}
      SNOWFLAKE_PASSWORD: ${{ secrets.SNOWFLAKE_PASSWORD }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install dbt-snowflake

      - name: Download prod manifest
        run: aws s3 cp s3://my-bucket/prod-artifacts/manifest.json ./prod-artifacts/manifest.json

      - name: dbt deps
        run: dbt deps

      - name: Slim CI build
        run: |
          dbt build \
            --select state:modified+ \
            --defer --state ./prod-artifacts \
            --target ci

      - name: Post results as PR comment
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: 'dbt Slim CI finished — see job logs for details.'
            })
```

```yaml
# .github/workflows/dbt_deploy.yml — runs on merge to main
name: dbt Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install dbt-snowflake

      - run: dbt deps
      - run: dbt build --target prod

      - name: Save manifest for next PR's slim CI
        run: aws s3 cp target/manifest.json s3://my-bucket/prod-artifacts/manifest.json

      - run: dbt docs generate --target prod
      - name: Publish docs
        run: aws s3 sync target/ s3://my-bucket/dbt-docs/ --delete
```

## 🦊 GitLab CI Example

```yaml
# .gitlab-ci.yml
stages:
  - lint
  - test
  - deploy

variables:
  DBT_PROFILES_DIR: "./"

lint:
  stage: lint
  image: python:3.11
  script:
    - pip install sqlfluff sqlfluff-templater-dbt
    - sqlfluff lint models/ --dialect bigquery

slim_ci:
  stage: test
  image: python:3.11
  only:
    - merge_requests
  script:
    - pip install dbt-bigquery
    - dbt deps
    - gsutil cp gs://my-bucket/prod-artifacts/manifest.json ./prod-artifacts/manifest.json
    - dbt build --select state:modified+ --defer --state ./prod-artifacts --target ci

deploy_prod:
  stage: deploy
  image: python:3.11
  only:
    - main
  script:
    - pip install dbt-bigquery
    - dbt deps
    - dbt build --target prod
    - gsutil cp target/manifest.json gs://my-bucket/prod-artifacts/manifest.json
    - dbt docs generate --target prod
```

## 🪝 Pre-Commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/sqlfluff/sqlfluff
    rev: 3.0.0
    hooks:
      - id: sqlfluff-lint
        additional_dependencies: ['sqlfluff-templater-dbt']
      - id: sqlfluff-fix
        additional_dependencies: ['sqlfluff-templater-dbt']

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
```

```bash
pip install pre-commit
pre-commit install          # installs the git hook
pre-commit run --all-files  # run once against the whole repo
```

## 🧪 Testing Strategies

```yaml
# Schema/data tests — run against real warehouse data
models:
  - name: fct_orders
    columns:
      - name: order_id
        tests: [unique, not_null]
      - name: amount
        tests:
          - dbt_utils.accepted_range:
              min_value: 0
```

```python
# dbt unit tests (dbt-core 1.8+) — fixture-based, no warehouse data required
# tests/unit/test_fct_orders.yml
unit_tests:
  - name: test_discount_applied_correctly
    model: fct_orders
    given:
      - input: ref('stg_orders')
        rows:
          - { order_id: 1, amount: 100, discount_pct: 0.1 }
    expect:
      rows:
        - { order_id: 1, final_amount: 90 }
```

```bash
dbt test --select state:modified+           # only test what changed
dbt build --select state:modified+ --fail-fast  # stop at first failure, save CI minutes
```

## 🌎 Environment Management

```yaml
# profiles.yml — separate targets per environment
my_project:
  target: dev
  outputs:
    dev:
      type: snowflake
      schema: dbt_dev_{{ env_var('DBT_USER') }}
      threads: 4
    ci:
      type: snowflake
      schema: dbt_ci_pr_{{ env_var('CI_PR_NUMBER') }}
      threads: 8
    prod:
      type: snowflake
      schema: analytics
      threads: 16
```

```bash
# Isolate each PR's build in its own schema to avoid clobbering concurrent CI runs
DBT_SCHEMA_SUFFIX=pr_${CI_PR_NUMBER} dbt build --target ci

# Clean up ephemeral CI schemas after the PR closes
dbt run-operation drop_schema --args '{schema_name: dbt_ci_pr_123}'
```

## 📦 Deployment Patterns

```text
Direct promote:     merge to main → dbt build --target prod (simplest, some downtime risk)
Blue/green schema:  build into `analytics_green`, swap views to point at it, then drop `analytics_blue`
Continuous deploy:  every merge to main auto-deploys; feature flags / model versioning gate risky changes
Scheduled deploy:   CI validates on merge, but a separate scheduled job (e.g. Airflow, dbt Cloud job) runs the actual prod build
```

```sql
-- Blue/green cutover: swap a view, not the underlying table, for near-zero downtime
CREATE OR REPLACE VIEW analytics.fct_orders AS
SELECT * FROM analytics_green.fct_orders;
```

## 📋 Artifact & State Comparison

```bash
# dbt writes these to target/ after every invocation
target/manifest.json     # full compiled project graph — the basis for state:modified
target/run_results.json  # what ran, timing, pass/fail per node
target/catalog.json      # column-level metadata, generated by `dbt docs generate`

# Compare two manifests to see what would run, without executing anything
dbt ls --select state:modified --state ./prod-artifacts --output json
```

## ☁️ dbt Cloud CI Jobs & API Triggering

```text
dbt Cloud's built-in CI job type automatically:
  - spins up a temporary schema per PR (dbt_cloud_pr_<job_id>_<pr_id>)
  - uses "defer to production" against the last successful prod run
  - runs `dbt build --select state:modified+` equivalent under the hood
  - posts a status check back to GitHub/GitLab/Azure DevOps automatically
```

```bash
# Trigger a dbt Cloud job manually via API (e.g. from a script or another CI system)
curl -X POST \
  "https://cloud.getdbt.com/api/v2/accounts/${ACCOUNT_ID}/jobs/${JOB_ID}/run/" \
  -H "Authorization: Token ${DBT_CLOUD_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"cause": "Triggered from external CI pipeline"}'
```

```yaml
# GitHub Actions: trigger a dbt Cloud job and wait for it to finish
- name: Run dbt Cloud job
  uses: dbt-labs/dbt-cloud-action@v0.3.0
  with:
    dbt_cloud_token: ${{ secrets.DBT_CLOUD_API_TOKEN }}
    dbt_cloud_account_id: ${{ secrets.DBT_CLOUD_ACCOUNT_ID }}
    dbt_cloud_job_id: ${{ secrets.DBT_CLOUD_JOB_ID }}
```

Use dbt Cloud's native CI job when the team is already on dbt Cloud — it saves reimplementing manifest storage, schema isolation, and PR status checks yourself. Use self-hosted CI (GitHub Actions/GitLab CI running dbt-core directly) when you need custom pipeline steps dbt Cloud doesn't support, or you're on dbt-core without a Cloud subscription.

## 🌬️ Orchestrator-Triggered Pipelines

```python
# Airflow DAG triggering a dbt Cloud job and waiting on it
from airflow import DAG
from airflow.providers.dbt.cloud.operators.dbt import DbtCloudRunJobOperator
from datetime import datetime

with DAG("dbt_prod_build", start_date=datetime(2026, 1, 1), schedule="@daily") as dag:
    trigger_dbt = DbtCloudRunJobOperator(
        task_id="trigger_dbt_cloud_job",
        dbt_cloud_conn_id="dbt_cloud_default",
        job_id=12345,
        check_interval=30,
        timeout=3600,
    )
```

```python
# Airflow DAG running dbt-core directly via BashOperator (self-hosted dbt)
from airflow.operators.bash import BashOperator

run_dbt = BashOperator(
    task_id="dbt_build_prod",
    bash_command="cd /opt/dbt_project && dbt build --target prod",
)
```

```text
Decide who owns scheduling: a CI system (GitHub Actions cron trigger, GitLab
scheduled pipeline) is fine for simple daily builds, but once dbt runs need
to be sequenced with upstream data loads (Fivetran, Airbyte) or downstream
reverse-ETL jobs, an orchestrator (Airflow, Dagster, Prefect) that
understands the full DAG — not just the dbt DAG — is the better fit.
```

## 🔐 Secrets Management

```yaml
# GitHub Actions: reference repo/org secrets, never hardcode credentials
env:
  SNOWFLAKE_ACCOUNT: ${{ secrets.SNOWFLAKE_ACCOUNT }}
  SNOWFLAKE_PASSWORD: ${{ secrets.SNOWFLAKE_PASSWORD }}
```

```yaml
# GitLab CI: masked + protected variables, set in Settings > CI/CD > Variables
# (mark "Mask variable" so values never appear in job logs, and
#  "Protect variable" so they're only exposed on protected branches)
```

```bash
# Explicitly mask a dynamically-generated secret value in GitHub Actions logs
echo "::add-mask::$GENERATED_TOKEN"
```

```text
Least-privilege principle for CI warehouse credentials:
  - CI/PR builds:  a role limited to a CI/scratch schema, read access to raw sources
  - Prod deploy:   a separate role with write access to the production schema only
  - Never reuse a personal developer's credentials for a service account
```

## 🧬 Matrix Testing Across Environments

```yaml
# GitHub Actions: run the same test suite against multiple warehouse targets
jobs:
  test:
    strategy:
      matrix:
        target: [snowflake_ci, bigquery_ci]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dbt build --select state:modified+ --target ${{ matrix.target }}
```

```yaml
# Matrix across dbt versions, useful when maintaining a package/adapter
strategy:
  matrix:
    dbt-version: ["1.7.*", "1.8.*", "1.9.*"]
steps:
  - run: pip install "dbt-core==${{ matrix.dbt-version }}" dbt-snowflake
```

Matrix testing matters most for teams maintaining a dbt **package** used across multiple warehouses, or mid-migration between two warehouses — running both targets on every PR catches divergence before it becomes a production surprise.

## ⏮️ Rollback Strategies

```sql
-- Blue/green: rollback is just re-pointing the view back to the last-good schema
CREATE OR REPLACE VIEW analytics.fct_orders AS
SELECT * FROM analytics_blue.fct_orders;   -- was pointed at _green, now reverted
```

```bash
# Direct-promote rollback: re-run the deploy job against the last-known-good commit
git checkout <last_good_sha>
dbt build --target prod
```

```yaml
# Model versioning as a softer rollback path — old consumers keep querying
# v1 while a breaking change ships as v2, with no hard cutover moment
models:
  - name: dim_customers
    latest_version: 2
    versions:
      - v: 1
      - v: 2
        columns: [ ... ]
```

```text
Rollback is much harder for incremental models than table/view materializations —
reversing a bad incremental run may require a manual full-refresh
(`dbt build --full-refresh --select fct_orders`) rather than a simple revert,
since incorrectly-inserted rows from the bad run are already in the table.
```

## 🛠️ Troubleshooting Common CI Failures

| Symptom                                                   | Likely cause                                                        | Fix                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `state:modified+` selects far more models than expected           | Prod manifest artifact is stale or missing                                | Verify the manifest upload step ran and succeeded on the last prod deploy   |
| CI passes but prod deploy fails on the same commit                 | CI and prod ran against different warehouse/target configs (e.g. different adapter versions) | Pin dbt/adapter versions identically across CI and prod jobs                 |
| Two PRs' CI runs interfere with each other                          | Both wrote to the same non-parameterized CI schema                        | Parameterize schema name by PR number/branch                               |
| `dbt deps` step is the slowest part of every CI run                  | No caching of the `dbt_packages/` directory                              | Cache `dbt_packages/` keyed on `packages.yml` hash                          |
| Job silently uses stale code                                        | Checkout step pinned to a branch ref, not the PR's actual head SHA        | Use `${{ github.event.pull_request.head.sha }}` explicitly                  |
| Scheduled full-refresh job times out                                 | Full refresh scans/rebuilds everything with no incremental filtering      | Split into per-domain scheduled jobs, or increase job timeout deliberately  |

## ⚠️ Common Gotchas

- **Slim CI needs a durable, always-current prod manifest** — if the artifact upload step after a prod deploy fails silently, every subsequent PR's `state:modified+` comparison is against stale state and can under- or over-select models.
- **`--defer` without `--state` does nothing** — both flags are required together; a defer with no state argument fails or silently no-ops depending on dbt version.
- **CI schemas that aren't cleaned up accumulate warehouse cost** — set a TTL or explicit teardown step for `dbt_ci_pr_*` schemas.
- **Concurrent PRs writing to the same CI schema clobber each other** — always parameterize the schema name by PR number/branch.
- **`dbt test` after `dbt build` re-runs tests that build already ran** — use `dbt build` alone (it runs models and their tests together) rather than a separate `dbt run` + `dbt test` unless you need them decoupled.
- **Lint-only CI doesn't catch logic errors** — `sqlfluff lint` and `dbt compile` both pass on SQL that's syntactically fine but semantically wrong; only `dbt test`/`dbt build` against real data catches that.
- **Docs artifacts go stale** if `dbt docs generate` isn't re-run on every prod deploy — published docs can silently drift from the actual warehouse state.

## 🎯 Best Practices

```yaml
# GOOD: lint fails fast before any warehouse cost is incurred
jobs:
  lint:            # no DB credentials needed, runs in seconds
    # ...
  slim_ci:
    needs: lint    # only runs (and costs money) if lint passes
```

- Order CI stages **cheapest-and-fastest first** (lint → compile → slim build → test) so failures are caught before expensive warehouse work runs.
- Always use **`state:modified+`**, never a full rebuild, for PR CI on any project past a small size — full rebuilds don't scale in cost or time.
- Isolate every PR's build in **its own ephemeral schema**, and tear it down automatically when the PR closes or merges.
- Store the **prod manifest in durable, versioned storage** (S3/GCS with versioning enabled) — treat it as critical CI infrastructure, not a throwaway file.
- Gate merges to `main` on **both lint and slim CI test success** — never allow a merge based on lint alone.
- Re-generate and republish **docs on every prod deploy**, not on a separate schedule, so `dbt docs generate` output never drifts from reality.

## 💡 Pro Tips

1. **Cache `dbt deps` and the virtualenv** between CI runs — package resolution is one of the slowest steps and rarely changes.
2. **Use `--fail-fast`** in CI to stop on the first test failure instead of burning warehouse credits running everything to completion.
3. **Post a PR comment with the list of models that will be built** (`dbt ls --select state:modified+`) before running slim CI — reviewers immediately see blast radius.
4. **Pin dbt and adapter versions exactly** in CI (not just `dbt-core`) — adapter version drift is a common source of "works locally, fails in CI."
5. **Separate the lint job from the warehouse job** so contributors get style feedback in seconds, not minutes.
6. **Use `dbt build` over separate `run`+`test` invocations** in CI — it interleaves model builds with their tests and fails faster on a broken dependency chain.
7. **Automate prod manifest upload as the very last step of the deploy job** — if the deploy itself fails, you don't want a manifest claiming otherwise.
8. **Add a scheduled (not just PR-triggered) full-refresh job** — slim CI never re-tests unchanged models, so a periodic full run catches drift slim CI can't see.
9. **Treat `sqlfluff` config (`.sqlfluff`) as shared team config**, checked into the repo, not personal editor settings — consistent linting only works if everyone lints against the same rules.
10. **Log warehouse credits/bytes-scanned per CI run** where your warehouse supports it (e.g. Snowflake `QUERY_HISTORY`) — CI cost creep is easy to miss until the bill arrives.
