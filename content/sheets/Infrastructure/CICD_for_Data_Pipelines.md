# CI/CD for Data Pipelines

> A structured reference for testing and deploying a data stack — running dbt tests and Airflow DAG validation on every PR, then safely promoting changes from dev to staging to production. Written for **dbt Core 1.11** (latest stable branch as of September 2026 — note that **dbt Core 2.0** entered alpha in June 2026 and will remove some legacy `state:modified` behavior flags, so pin versions deliberately in CI) and current GitHub Actions / GitLab CI syntax. This sheet focuses on self-managed CI (GitHub Actions, GitLab CI) rather than dbt Cloud or Airflow-managed-service consoles, since that's the harder, less-documented path — where a managed platform has a direct equivalent, it's called out inline.

## 📑 Table of Contents

1. [🧑‍💻 Complete Working Examples](#complete-working-examples)
2. [🚀 CI/CD Pipeline Structure for a dbt Project](#cicd-pipeline-structure-for-a-dbt-project)
3. [🧪 Running dbt build/test Against a Dedicated CI Schema](#running-dbt-build-test-against-a-dedicated-ci-schema)
4. [✈️ Airflow DAG Validation & Linting Before Deploy](#airflow-dag-validation-linting-before-deploy)
5. [🌍 Environment Promotion: Dev → Staging → Prod](#environment-promotion-dev-staging-prod)
6. [🔐 Secrets & Credentials Per Environment](#secrets-credentials-per-environment)
7. [📚 Automated dbt Docs Deployment](#automated-dbt-docs-deployment)
8. [🔄 Airflow DAG Syncing to the Orchestrator](#airflow-dag-syncing-to-the-orchestrator)
9. [⏪ Rollback Strategies](#rollback-strategies)
10. [🧰 Reusable Workflows & Templates](#reusable-workflows-templates)
11. [📣 Monitoring & Notifications](#monitoring-notifications)
12. [⚠️ Common Gotchas](#common-gotchas)
13. [🎯 Best Practices](#best-practices)
14. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

**GitHub Actions ↔ GitLab CI concept map**

| Concept                 | GitHub Actions                                  | GitLab CI                                                   |
| ----------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| Pipeline file           | `.github/workflows/*.yml`                       | `.gitlab-ci.yml`                                            |
| Unit of work            | `job` inside `jobs:`                            | `job` at top level, grouped by `stages:`                    |
| Run on PR/MR            | `on: pull_request`                              | `rules: - if: $CI_PIPELINE_SOURCE == "merge_request_event"` |
| Job dependency          | `needs: [job_a]`                                | `needs: [job_a]`                                            |
| Protected deploy target | `environment: production`                       | `environment: { name: production }` + protected environment |
| Manual approval gate    | required reviewers on the environment           | `when: manual` + protected environment                      |
| Secret reference        | `${{ secrets.NAME }}`                           | `$NAME` (CI/CD variable, masked + protected)                |
| Reusable pipeline       | reusable workflow (`workflow_call`)             | `include:` + `extends:`                                     |
| Pass files between jobs | `actions/upload-artifact` / `download-artifact` | `artifacts:` block (automatic within a pipeline)            |
| Caching                 | `actions/cache`                                 | `cache: { key, paths }`                                     |
| Matrix build            | `strategy: matrix:`                             | `parallel: matrix:`                                         |
| Cancel superseded runs  | `concurrency: { group, cancel-in-progress }`    | `interruptible: true` + resource group                      |

**dbt CI commands cheat sheet**

| Task                                      | Command                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| Install packages                          | `dbt deps`                                                                       |
| Check the connection                      | `dbt debug --target ci`                                                          |
| Full build (run + test)                   | `dbt build --target ci`                                                          |
| Slim CI: changed models + downstream only | `dbt build --select state:modified+ --state ./prod-manifest --defer --target ci` |
| Tests only                                | `dbt test --target ci`                                                           |
| Generate docs                             | `dbt docs generate --target ci`                                                  |

**Airflow CI commands cheat sheet**

| Task                                | Command                                                |
| ----------------------------------- | ------------------------------------------------------ |
| Import-error check                  | `airflow dags list-import-errors`                      |
| Quick syntax/import sanity check    | `python dags/my_dag.py`                                |
| Lint for Airflow-3 breaking changes | `ruff check dags/ --select AIR301,AIR302 --show-fixes` |
| DagBag structural tests             | `pytest tests/test_dag_validity.py`                    |

## 🧑‍💻 Complete Working Examples

Five end-to-end pipelines you can copy, rename, and adapt. Each starts with a **Purpose** blurb so you can pick the right pattern before assembling pieces from the reference sections below. Together they cover both platforms named in the title.

### 1. dbt Slim CI on Every Pull Request (GitHub Actions)

**Purpose:** This is the core loop for a dbt project — on every PR, build and test only the models that actually changed (plus anything downstream of them), against an isolated schema, so CI stays fast and never touches production data. It uses `state:modified+` against a production manifest artifact plus `--defer`, so unchanged upstream models are referenced from production instead of being rebuilt from scratch.

```yaml
# .github/workflows/dbt_ci.yml
name: dbt CI

on:
  pull_request:
    paths: ["dbt/**"]

concurrency:
  group: dbt-ci-${{ github.event.pull_request.number }}
  cancel-in-progress: true # a new push supersedes any still-running check on the same PR

jobs:
  dbt-build:
    runs-on: ubuntu-latest
    environment: ci
    env:
      DBT_PROFILES_DIR: ./dbt
      DBT_TARGET: ci
      DBT_SCHEMA: dbt_ci_pr_${{ github.event.pull_request.number }} # isolates parallel PRs
      SNOWFLAKE_PASSWORD: ${{ secrets.SNOWFLAKE_CI_PASSWORD }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }

      - run: pip install "dbt-snowflake==1.11.*"

      - name: Fetch production manifest for state comparison
        run: |
          curl -sSL "https://dbt-docs.company.com/manifest.json" -o ./prod-manifest/manifest.json

      - run: dbt deps
        working-directory: ./dbt

      - name: Slim CI build — only changed models and their downstream dependents
        working-directory: ./dbt
        run: |
          dbt build \
            --select state:modified+ \
            --state ../prod-manifest \
            --defer \
            --target ci

      - name: Drop the temporary CI schema
        if: always()
        working-directory: ./dbt
        run: dbt run-operation drop_ci_schema --target ci
```

### 2. Airflow DAG Validation & Linting on Merge Requests (GitLab CI)

**Purpose:** Use this to catch a broken DAG before it ever reaches the orchestrator — import errors, cycles, and Airflow-3 incompatibilities are all cheap to catch in CI and expensive to discover after a bad deploy silently stops a pipeline. This never spins up a real scheduler; it uses `DagBag` and `ruff`'s Airflow-specific lint rules against a throwaway SQLite metadata DB.

```yaml
# .gitlab-ci.yml
stages: [validate]

airflow-dag-validation:
  stage: validate
  image: apache/airflow:3.3.1-python3.12
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      changes: ["airflow/dags/**/*"]
  variables:
    AIRFLOW_HOME: $CI_PROJECT_DIR/airflow_home
  before_script:
    - pip install ruff pytest
    - airflow db migrate # lightweight SQLite metadata DB, just for import-time checks
  script:
    # 1. Every DAG file must at least import cleanly
    - for f in airflow/dags/*.py; do python "$f" || exit 1; done
    # 2. No DAG the scheduler would silently refuse to load
    - airflow dags list-import-errors --output json | tee import_errors.json
    - '[ "$(cat import_errors.json)" = "[]" ] || (echo "Import errors found" && exit 1)'
    # 3. Airflow-3-specific breaking-change lint
    - ruff check airflow/dags/ --select AIR301,AIR302
    # 4. Structural tests (task counts, no cycles, expected tags)
    - pytest airflow/tests/test_dag_validity.py -v
  artifacts:
    when: always
    paths: [import_errors.json]
```

### 3. Dev → Staging → Prod Promotion with Manual Approval (GitHub Actions)

**Purpose:** Use this once a project has more than one deployment target — it enforces that staging always deploys automatically from `main`, but production requires a human to click approve, using GitHub Environments' built-in protection rules instead of a bespoke approval mechanism. The same dbt commit is promoted through both environments; nothing is rebuilt from a different branch state along the way.

```yaml
# .github/workflows/promote.yml
name: Promote dbt Project

on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging # staging has NO required reviewers — deploys automatically
    steps:
      - uses: actions/checkout@v4
      - run: pip install "dbt-snowflake==1.11.*"
      - name: Deploy to staging
        working-directory: ./dbt
        env:
          DBT_TARGET: staging
          SNOWFLAKE_PASSWORD: ${{ secrets.SNOWFLAKE_PASSWORD }} # staging-scoped secret
        run: dbt build --target staging

  deploy-production:
    needs: deploy-staging # never promote to prod unless staging succeeded
    runs-on: ubuntu-latest
    environment: production # production DOES have required reviewers configured in repo settings
    steps:
      - uses: actions/checkout@v4 # same commit SHA as the staging job — no rebuild-from-branch-tip drift
      - run: pip install "dbt-snowflake==1.11.*"
      - name: Deploy to production
        working-directory: ./dbt
        env:
          DBT_TARGET: prod
          SNOWFLAKE_PASSWORD: ${{ secrets.SNOWFLAKE_PASSWORD }} # production-scoped secret, same var name, different value
        run: dbt build --target prod
```

### 4. Publishing dbt Docs and Syncing Airflow DAGs on Merge (GitHub Actions)

**Purpose:** Use this to keep two things automatically in sync with `main` after every merge: the human-facing dbt documentation site, and the actual DAG files the orchestrator runs. Both are "deploy the build artifact somewhere," just to different destinations — a static site host and an object-storage bucket the orchestrator watches.

```yaml
# .github/workflows/deploy_docs_and_dags.yml
name: Deploy Docs and DAGs

on:
  push:
    branches: [main]

jobs:
  deploy-dbt-docs:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - run: pip install "dbt-snowflake==1.11.*"
      - working-directory: ./dbt
        env: { DBT_TARGET: prod, SNOWFLAKE_PASSWORD: ${{ secrets.SNOWFLAKE_PASSWORD }} }
        run: |
          dbt deps
          dbt docs generate --target prod
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dbt/target

  sync-airflow-dags:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4     # OIDC — no long-lived AWS keys stored in GitHub
        with:
          role-to-assume: arn:aws:iam::123456789012:role/gha-airflow-deploy
          aws-region: us-east-1
      - name: Sync DAGs to the MWAA-backed S3 bucket
        run: |
          aws s3 sync airflow/dags/ s3://company-mwaa-bucket/dags/ \
            --delete \
            --exclude "*.pyc" --exclude "__pycache__/*"
```

### 5. Rollback via Re-Promoting a Known-Good Commit (GitHub Actions)

**Purpose:** Use this the moment a production deploy turns out to be broken — instead of re-running the full pipeline and hoping `main` is fixed, this redeploys the exact previously-working commit SHA on demand. It works identically for dbt and for the DAG-sync job because both deployments are keyed off a git ref, not "whatever the branch currently contains."

```yaml
# .github/workflows/rollback.yml
name: Rollback Production Deploy

on:
  workflow_dispatch:
    inputs:
      commit_sha:
        description: "The known-good commit SHA to redeploy"
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: production   # still goes through the same required-reviewer gate as a normal deploy
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.commit_sha }}   # check out the OLD commit, not main's tip

      - run: pip install "dbt-snowflake==1.11.*"
      - name: Redeploy dbt from the known-good commit
        working-directory: ./dbt
        env: { DBT_TARGET: prod, SNOWFLAKE_PASSWORD: ${{ secrets.SNOWFLAKE_PASSWORD }} }
        run: dbt build --target prod

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/gha-airflow-deploy
          aws-region: us-east-1
      - name: Roll DAGs back to the known-good commit's version
        run: aws s3 sync airflow/dags/ s3://company-mwaa-bucket/dags/ --delete

      - name: Record the rollback
        run: echo "Rolled back to ${{ github.event.inputs.commit_sha }} by ${{ github.actor }}"
```

## 🚀 CI/CD Pipeline Structure for a dbt Project

```yaml
# .github/workflows/dbt_ci.yml — typical stage shape
name: dbt CI
on:
  pull_request:
    paths: ["dbt/**"]
jobs:
  lint: # cheap, fast checks first — fail here before spending warehouse compute
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install sqlfluff
      - run: sqlfluff lint dbt/models --dialect snowflake

  build-and-test:
    needs: lint
    runs-on: ubuntu-latest
    steps: [] # dbt build/test steps — see Example 1

  docs-preview: # optional: generate docs for reviewers without publishing them anywhere
    needs: build-and-test
    runs-on: ubuntu-latest
    steps: []
```

```yaml
# .gitlab-ci.yml — equivalent stage shape
stages: [lint, build, docs]

lint:
  stage: lint
  script: [sqlfluff lint dbt/models --dialect snowflake]

build-and-test:
  stage: build
  needs: [lint]
  script: [] # dbt build/test — see Example 1's logic, GitLab syntax

docs-preview:
  stage: docs
  needs: [build-and-test]
  script: []
```

- Order jobs cheapest-and-fastest-first (lint → build/test → docs) so a trivial style issue fails in seconds, not after minutes of warehouse compute.
- Scope the trigger to the dbt project's path (`paths:`/`changes:`) in a monorepo so unrelated changes (e.g., only Airflow DAGs) don't burn warehouse compute running dbt CI unnecessarily.

## 🧪 Running dbt build/test Against a Dedicated CI Schema

```yaml
# profiles.yml — a dedicated `ci` target keeps CI runs fully isolated from dev/staging/prod
company_project:
  target: "{{ env_var('DBT_TARGET', 'dev') }}"
  outputs:
    ci:
      type: snowflake
      account: "{{ env_var('SNOWFLAKE_ACCOUNT') }}"
      user: "{{ env_var('SNOWFLAKE_CI_USER') }}"
      password: "{{ env_var('SNOWFLAKE_PASSWORD') }}"
      database: analytics_ci
      schema: "{{ env_var('DBT_SCHEMA', 'dbt_ci_default') }}"
      threads: 4
```

```sql
-- macros/generate_schema_name.sql — give every PR its own schema so parallel
-- PRs never collide, then let a cleanup job drop old ones
{% macro generate_schema_name(custom_schema_name, node) %}
  {%- if target.name == 'ci' -%}
    {{ env_var('DBT_SCHEMA', 'dbt_ci_' ~ invocation_id) }}
  {%- else -%}
    {{ default__generate_schema_name(custom_schema_name, node) }}
  {%- endif -%}
{% endmacro %}
```

```sql
-- macros/drop_ci_schema.sql — run as a cleanup step so temporary CI schemas
-- don't accumulate forever
{% macro drop_ci_schema() %}
  {% if target.name == 'ci' %}
    {% set drop_sql %}
      DROP SCHEMA IF EXISTS {{ target.database }}.{{ target.schema }} CASCADE
    {% endset %}
    {% do run_query(drop_sql) %}
  {% endif %}
{% endmacro %}
```

```bash
# Slim CI: only build/test what actually changed, deferring everything
# else to the production manifest instead of rebuilding it
dbt build \
  --select state:modified+ \
  --state ./prod-manifest \
  --defer \
  --target ci

# Full build — use for scheduled/nightly CI runs, not every PR push
dbt build --target ci
```

- `--defer --state ./prod-manifest` means unchanged upstream models resolve to their **production** relations instead of being rebuilt in the CI schema — this is what makes Slim CI both fast and representative of real data.
- The production `manifest.json` used for `--state` must come from a dbt Core version compatible with the CI run's version; a mismatch (especially across a major version bump like the upcoming dbt Core 2.0) can produce misleading `state:modified` results.

## ✈️ Airflow DAG Validation & Linting Before Deploy

```bash
# The full validation ladder, cheapest first
python dags/my_dag.py                              # 1. does it even import?
airflow dags list-import-errors                     # 2. anything the scheduler would silently reject?
ruff check dags/ --select AIR301,AIR302             # 3. Airflow-3 breaking-change lint
pytest tests/test_dag_validity.py                   # 4. structural assertions
```

```python
# tests/test_dag_validity.py — the standard pytest pattern for DAG CI checks
import pytest
from airflow.models import DagBag

@pytest.fixture(scope="session")
def dagbag():
    return DagBag(dag_folder="dags/", include_examples=False)

def test_no_import_errors(dagbag):
    assert len(dagbag.import_errors) == 0

def test_every_dag_has_a_tag(dagbag):
    for dag_id, dag in dagbag.dags.items():
        assert dag.tags, f"{dag_id} is missing tags"

def test_no_cycles(dagbag):
    for dag_id, dag in dagbag.dags.items():
        assert dag.test_cycle() is None, f"Cycle detected in {dag_id}"
```

- A CI job validating DAGs doesn't need a real scheduler or a Postgres metadata DB — `airflow db migrate` against the default SQLite backend is enough for import-time and `DagBag` checks, which keeps the CI container simple and fast.
- Run this as a required check on the PR, not just informationally — a DAG with an import error deploys silently broken otherwise, and nobody notices until the scheduler logs are checked hours later.

## 🌍 Environment Promotion: Dev → Staging → Prod

```yaml
# GitHub: environments are configured in repo Settings → Environments.
# staging: no required reviewers, auto-deploys on every merge to main
# production: required reviewers + optional wait timer, configured once in settings
jobs:
  deploy-staging:
    environment: staging
    # ...
  deploy-production:
    needs: deploy-staging
    environment: production # GitHub blocks this job until a reviewer approves
    # ...
```

```yaml
# GitLab: protected environments serve the same purpose
deploy-staging:
  stage: deploy
  environment: { name: staging }
  script: []

deploy-production:
  stage: deploy
  needs: [deploy-staging]
  environment: { name: production }
  when: manual # requires a human to click "play" in the pipeline UI
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

**Core promotion principle: build once, promote the artifact — don't rebuild per environment**

```yaml
# Checking out the SAME commit SHA for both staging and production jobs (as in
# Example 3) is what guarantees "what passed staging is exactly what ships to
# prod" — re-triggering a fresh build against main's current tip for the
# production job would let last-minute commits sneak into prod unvalidated.
```

- Keep environment-specific values (warehouse, schema, connection details) in the `--target` dbt profile output, not scattered across conditional logic in the pipeline YAML.
- Require staging to succeed before production is even offered as an option (`needs: deploy-staging`) — never let a human accidentally approve a production deploy that skipped staging.

## 🔐 Secrets & Credentials Per Environment

```yaml
# GitHub Actions — secrets scoped to an Environment override repo-level secrets
# of the same name, so `staging` and `production` can each define their own
# SNOWFLAKE_PASSWORD without any conditional logic in the workflow itself
jobs:
  deploy:
    environment: production # this job only sees the `production` environment's secrets
    steps:
      - run: echo "${{ secrets.SNOWFLAKE_PASSWORD }}" # resolves to the PRODUCTION value here
```

```yaml
# Prefer OIDC over long-lived cloud credentials wherever the provider supports it
permissions:
  id-token: write # required for GitHub's OIDC token exchange
  contents: read
steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789012:role/gha-deploy-role
      aws-region: us-east-1
```

```yaml
# GitLab — CI/CD variables can be scoped per-environment and marked
# Protected (only exposed on protected branches) + Masked (hidden in logs)
# Settings → CI/CD → Variables → set "Environment scope" to staging/production
```

- Never echo a secret directly in a script step "just to debug it" — most CI systems mask known secret values in logs, but a manual `echo $SECRET` or string concatenation can bypass that masking.
- Use the exact same variable _name_ across environments (`SNOWFLAKE_PASSWORD`) with a different scoped _value_ per environment — this is what lets the same workflow/job definition run unmodified against dev, staging, and prod.

## 📚 Automated dbt Docs Deployment

```yaml
# GitHub Pages, via a well-established community action
- run: dbt docs generate --target prod
  working-directory: ./dbt
- uses: peaceiris/actions-gh-pages@v4
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./dbt/target
```

```yaml
# GitLab Pages — a job literally named `pages` is auto-published by GitLab
pages:
  stage: docs
  script:
    - dbt docs generate --target prod
    - mv dbt/target public # GitLab Pages always publishes the `public/` directory
  artifacts:
    paths: [public]
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

```bash
# Or push the static site to S3 + CloudFront for teams already using AWS for hosting
aws s3 sync dbt/target/ s3://company-dbt-docs/ --delete
aws cloudfront create-invalidation --distribution-id ABCDEF123 --paths "/*"
```

- Regenerate docs from the exact manifest that was actually deployed to production, not from a separate/later build — otherwise the docs can describe a version of the project that isn't what's actually running.
- Put the published docs site behind SSO or a private bucket policy if the schema/model logic it documents is sensitive — none of the hosting options above have built-in authentication.

## 🔄 Airflow DAG Syncing to the Orchestrator

```bash
# Self-managed / MWAA — DAGs live in an S3 bucket the scheduler polls
aws s3 sync airflow/dags/ s3://company-mwaa-bucket/dags/ --delete

# Google Cloud Composer — a dedicated gcloud subcommand for DAG imports
gcloud composer environments storage dags import \
  --environment=production-composer --location=us-central1 \
  --source=airflow/dags/

# Astronomer — the Astro CLI handles image build + DAG deploy together
astro deploy --deployment-id <deployment-id>

# Self-hosted on Kubernetes, no managed DAG-sync feature — a Git-sync sidecar
# (or a GitOps controller watching the dags/ folder) is the standard pattern;
# see the Kubernetes cheatsheet's Kustomize & GitOps section for the general shape
```

- `--delete` on an `s3 sync` is what actually removes DAGs that were deleted from the repo — without it, deleted DAG files linger in the bucket (and the scheduler's UI) indefinitely.
- Sync DAGs as their own deploy step, decoupled from the dbt deploy job — a DAG-only change shouldn't have to wait on (or risk being blocked by) an unrelated dbt build failing.

## ⏪ Rollback Strategies

```bash
# dbt has no "down migration" — models are re-runnable transformations, not
# stateful schema migrations, so "rollback" means re-deploying the PREVIOUS
# commit's logic, not restoring a database backup (except for the underlying
# incremental/seed DATA, which the SQL rollback doesn't touch on its own)
git log --oneline dbt/ -10       # find the last known-good commit
# then trigger Example 5's workflow_dispatch with that commit's SHA
```

```sql
-- Blue-green pattern for models where an instant rollback matters: build the
-- new version into a shadow schema, validate it, then atomically swap
CREATE OR REPLACE VIEW analytics.orders AS SELECT * FROM analytics_next.orders;
-- Rolling back is just swapping the view definition back to the previous schema —
-- no rebuild required, because the previous schema was never dropped
```

```bash
# Airflow: DAG "rollback" is cheap because DAG files are just code, not state —
# redeploy the previous commit's DAG bundle through the same sync mechanism
git checkout <known-good-sha> -- airflow/dags/
aws s3 sync airflow/dags/ s3://company-mwaa-bucket/dags/ --delete

# If the orchestrator itself is deployed via Helm/Kubernetes (not just the DAGs):
helm rollback airflow 4
# or: kubectl rollout undo deployment/airflow-scheduler
```

- Tag every production deploy with the commit SHA it came from (in a deploy log, a Slack message, or a `deployed_version` file in the bucket) — rollback is only fast if you always know exactly what "the previous good state" was.
- For incremental models, a code-only rollback reverts the _logic_ but not necessarily bad _data_ already written by a broken run — pair a code rollback with `dbt run --full-refresh --select <model>` (or a `dbt clone`-based snapshot restore) when the bug actually corrupted data, not just future runs.
- Pause affected DAGs during an Airflow rollback if a broken version may have left tasks mid-flight — avoid the previous good version picking up and double-processing a run the broken version already partially executed.

## 🧰 Reusable Workflows & Templates

```yaml
# GitHub — a reusable workflow, callable from any repo/job
# .github/workflows/dbt-build-reusable.yml
on:
  workflow_call:
    inputs:
      target: { required: true, type: string }
    secrets:
      SNOWFLAKE_PASSWORD: { required: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install "dbt-snowflake==1.11.*"
      - run: dbt build --target ${{ inputs.target }}
        env: { SNOWFLAKE_PASSWORD: ${{ secrets.SNOWFLAKE_PASSWORD }} }
```

```yaml
# Calling it from another workflow — staging and prod both reuse the same logic
jobs:
  staging:
    uses: ./.github/workflows/dbt-build-reusable.yml
    with: { target: staging }
    secrets: inherit
```

```yaml
# GitLab — an included template plus `extends` for job-level reuse
# templates/dbt-build.yml
.dbt-build:
  script:
    - pip install "dbt-snowflake==1.11.*"
    - dbt build --target $DBT_TARGET

# .gitlab-ci.yml
include:
  - local: templates/dbt-build.yml

deploy-staging:
  extends: .dbt-build
  variables: { DBT_TARGET: staging }
```

- Extract the build/test logic into a reusable workflow or template the moment more than one job (dev, staging, prod, or a second dbt project in a monorepo) needs the same steps — copy-pasted pipeline YAML drifts out of sync quickly.

## 📣 Monitoring & Notifications

```yaml
# GitHub Actions — notify on failure only, not on every success
- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v2
  with:
    payload: |
      {"text": "❌ dbt CI failed on ${{ github.ref }} — ${{ github.event.pull_request.html_url }}"}
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

```yaml
# GitLab CI — the equivalent, using `rules: when: on_failure`
notify-failure:
  stage: .post
  rules:
    - when: on_failure
  script:
    - 'curl -X POST -H "Content-type: application/json" --data "{\"text\":\"Pipeline failed: $CI_PIPELINE_URL\"}" "$SLACK_WEBHOOK_URL"'
```

```python
# Turn dbt's own run_results.json into a richer notification than "it failed" —
# parse it for which specific models/tests failed
import json
with open("dbt/target/run_results.json") as f:
    results = json.load(f)
failures = [r["unique_id"] for r in results["results"] if r["status"] == "fail"]
print(f"Failed: {', '.join(failures)}" if failures else "All green")
```

- Alert on failure, not on every run — a Slack channel that pings on every green CI run trains people to ignore it, which defeats the purpose the day it actually fails.
- Parse `run_results.json` / `manifest.json` for specifics instead of a generic "dbt CI failed" message — "which model, which test" is what actually lets someone act on the alert quickly.

## ⚠️ Common Gotchas

- **A Slim CI job with a stale or mismatched production manifest gives false results** — `state:modified` compares against whatever `manifest.json` you fetched, so a manifest that's out of date (or from an incompatible dbt version) can either miss real changes or flag everything as "modified" unnecessarily.
- **`dbt Core 2.0` (alpha as of mid-2026) removes some `state:modified` behavior flags** — pin the dbt version explicitly in CI (`dbt-snowflake==1.11.*`, not an unpinned `dbt-snowflake`) so a routine `pip install` doesn't silently change CI selection behavior on you.
- **Forgetting `--delete` on an S3-based DAG sync** leaves deleted DAGs running (or at least visible) in the orchestrator indefinitely — always sync with deletion enabled unless you have a specific reason not to.
- **Environment secrets don't automatically inherit into reusable workflows** — a called reusable workflow needs `secrets: inherit` (GitHub) or its own variable scoping (GitLab) explicitly; omitting it silently leaves the secret empty rather than erroring loudly.
- **A production job that checks out `main`'s current tip instead of the exact SHA that passed staging** can deploy a commit that was never actually tested — always propagate the same ref/SHA through every stage of a promotion pipeline.
- **DAG validation without `include_examples=False`** on `DagBag` picks up Airflow's bundled example DAGs, which slows down CI and can mask real import errors in the noise.
- **dbt "rollback" that only reverts code, not data**, can leave an incremental model's already-written rows wrong even after the SQL is fixed — a code revert isn't automatically a data fix.
- **Manual approval gates that don't also gate the underlying deploy credentials** are theater — if the production secret is available to any job regardless of environment, a required reviewer on one job doesn't actually stop a different job from deploying to prod.

## 🎯 Best Practices

```yaml
# Fail fast and cheap first — lint before build, build before deploy
jobs:
  lint: {}
  build-and-test: { needs: [lint] }
  deploy-staging: { needs: [build-and-test] }
  deploy-production: { needs: [deploy-staging] }
```

- Scope every pipeline trigger with `paths:`/`changes:` in a monorepo — don't run dbt CI because someone edited an Airflow DAG docstring.
- Treat `main` as always-deployable: nothing merges without passing the same checks (dbt build/test, DAG validation) that gate a production deploy.
- Isolate CI's warehouse footprint completely — a dedicated CI database/schema, a CI-only warehouse-compute size, and a service account with the minimum grants needed, never the same credentials used for production loads.
- Keep the "promote an artifact" principle strict: build/compile once, reuse that exact output (or that exact commit SHA) across every environment rather than re-running `dbt compile` fresh per environment.
- Clean up ephemeral CI schemas on every run (`if: always()` / equivalent), success or failure — a CI job that only cleans up on success leaves orphaned schemas behind every time it fails.

## 💡 Pro Tips

1. **Pin dbt and provider adapter versions explicitly in CI** (`dbt-snowflake==1.11.*`) — an unpinned install can silently pick up a new major version (dbt Core 2.0 is coming) and break `state:modified` selection without any code change on your side.
2. **Give every open PR its own CI schema** (keyed by PR number or `invocation_id`) so two people's PRs never collide or shadow each other's test data.
3. **Fetch the production manifest as a build step, not a checked-in file** — a `manifest.json` committed to the repo goes stale immediately and defeats the purpose of `state:modified`.
4. **Use GitHub Environments / GitLab protected environments for the approval gate itself**, not a custom "wait for a Slack thumbs-up" script — the built-in mechanism is auditable and can't be bypassed by someone with just workflow-edit access.
5. **Always propagate the same commit SHA through staging and production jobs** — checking out `main` fresh in the production job breaks the "what passed staging is what ships" guarantee.
6. **Prefer OIDC over long-lived cloud credentials** for both the dbt warehouse connection (where supported) and any cloud DAG-sync step — a credential that never has to be rotated is a credential that can't leak from an old secret.
7. **Validate DAGs with a plain SQLite metadata DB in CI** — you don't need a full Postgres+Celery Airflow stack running just to catch an import error.
8. **Record the deployed commit SHA somewhere durable** (a file in the DAG bucket, a deploy log, a Slack message) — the single biggest thing that makes rollback fast is already knowing exactly what "good" looked like.
9. **Decouple the dbt deploy job from the DAG-sync job** — an unrelated dbt test failure shouldn't block shipping an urgent DAG fix, and vice versa.
10. **Extract shared pipeline logic into a reusable workflow/template as soon as a second environment or project needs it** — copy-pasted CI YAML across dev/staging/prod is a maintenance trap waiting to drift.
