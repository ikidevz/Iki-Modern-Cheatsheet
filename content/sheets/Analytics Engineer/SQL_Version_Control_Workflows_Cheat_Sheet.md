# SQL Version Control Workflows Cheatsheet for Analytics Engineers

> A structured reference for managing SQL and dbt project changes in git — repo structure, branching strategy, commit/PR conventions, migration tooling, and safe schema-change practices.

## 📑 Table of Contents

1. [🗂️ Repo Structure](#repo-structure)
2. [🌿 Branching Strategies](#branching-strategies)
3. [📝 Commit Conventions](#commit-conventions)
4. [🔍 PR & Code Review Checklist](#pr-code-review-checklist)
5. [🧱 Migration Tooling](#migration-tooling)
6. [⚠️ Safe Schema Change Patterns](#safe-schema-change-patterns)
7. [🪝 Git Hooks for SQL Formatting](#git-hooks-for-sql-formatting)
8. [📦 Working with dbt Artifacts Across Branches](#working-with-dbt-artifacts-across-branches)
9. [🏢 Monorepo vs. Polyrepo for Analytics](#monorepo-vs-polyrepo-for-analytics)
10. [🧩 Resolving Merge Conflicts in SQL & YAML](#resolving-merge-conflicts-in-sql-yaml)
11. [📖 Real-World Example: Branch-to-Production Walkthrough](#real-world-example-branch-to-production-walkthrough)
12. [🔀 Handling Long-Running Branches](#handling-long-running-branches)
13. [🛠️ Troubleshooting Common Git/dbt Issues](#troubleshooting-common-gitdbt-issues)
14. [⚠️ Common Gotchas](#common-gotchas)
15. [🎯 Best Practices](#best-practices)
16. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Task                              | Syntax / Command                                                     |
| ---------------------------------- | ------------------------------------------------------------------------ |
| Create a feature branch            | `git checkout -b feature/add-revenue-model`                              |
| Diff SQL logic between branches    | `git diff main..feature/add-revenue-model -- models/`                    |
| Lint before commit                 | `sqlfluff lint models/` (or via pre-commit hook)                          |
| Squash commits before merge        | `git rebase -i main`                                                     |
| Compare compiled SQL vs prod       | `dbt compile && diff target/compiled/... prod-artifacts/compiled/...`    |
| Run a new migration                | `sqitch deploy` / `flyway migrate` / `alembic upgrade head`               |
| Roll back a migration              | `sqitch revert` / `flyway undo` / `alembic downgrade -1`                  |
| Tag a release                      | `git tag -a v1.4.0 -m "Add customer LTV metric"`                          |
| Resolve a `.yml` merge conflict    | Resolve manually, then `dbt parse` to confirm the merged YAML still compiles |
| Find who last changed a model      | `git blame models/marts/fct_orders.sql`                                   |
| See a model's full change history  | `git log --follow -- models/marts/fct_orders.sql`                          |
| Stash WIP to switch branches       | `git stash` / `git stash pop`                                             |
| Cherry-pick a hotfix to another branch | `git cherry-pick <commit_sha>`                                        |

**Branching model cheat sheet**

| Model              | Fits when...                                                    |
| ------------------- | ------------------------------------------------------------------ |
| Trunk-based          | Small team, frequent small PRs, strong CI/slim-CI safety net       |
| GitFlow-lite         | Multiple concurrent releases, need a staging branch before prod    |
| Environment branches | `dev` → `staging` → `main`, each mapped to a dbt target/schema     |

## 🗂️ Repo Structure

```text
analytics/
  models/
    staging/           # 1:1 with source tables, light cleaning only
      stg_orders.sql
      _stg_orders.yml
    intermediate/       # reusable logic, not exposed to BI tools
      int_orders_joined.sql
    marts/               # final, documented, tested consumer-facing models
      finance/
        fct_orders.sql
        _fct_orders.yml
      marketing/
  macros/
  tests/
    unit/
  seeds/
  snapshots/
  analyses/
  dbt_project.yml
  packages.yml
  .sqlfluff
  .pre-commit-config.yaml
  .github/workflows/
```

Conventions worth adopting:
- `stg_` / `int_` / `fct_` / `dim_` prefixes so a model's layer is obvious from its filename alone.
- One `.yml` file per model (or per directory) documenting columns/tests, colocated with the `.sql` file.
- Folder-per-domain (`finance/`, `marketing/`) inside `marts/` once the project grows past a handful of models.

## 🌿 Branching Strategies

```bash
# Trunk-based: short-lived branches, merge to main frequently
git checkout main
git pull
git checkout -b feature/add-ltv-metric
# ... small, focused change ...
git push -u origin feature/add-ltv-metric
# open PR → CI (slim CI + lint) → review → squash-merge to main

# Environment branches: dev -> staging -> main, each tied to a dbt target
git checkout -b feature/add-ltv-metric dev
# ... work, PR into dev ...
# periodically: PR dev -> staging (deploys to staging schema)
# periodically: PR staging -> main (deploys to prod schema)
```

```bash
# Keep a feature branch current without a messy merge-commit history
git fetch origin
git rebase origin/main
# resolve conflicts, then
git push --force-with-lease
```

## 📝 Commit Conventions

```text
# Conventional Commits, adapted for analytics work
feat(marts): add customer_ltv metric to fct_customers
fix(staging): correct null handling in stg_orders.amount
refactor(intermediate): extract shared join logic into int_orders_joined
test(marts): add uniqueness test on fct_orders.order_id
docs(marts): document grain and freshness SLA for fct_orders
chore(ci): bump dbt-snowflake to 1.8.2
```

```bash
# Reference the model/metric changed and why, not just what changed
git commit -m "fix(marts): exclude test accounts from revenue metric

Test accounts (account_type = 'test') were inflating monthly revenue
by ~3%. Excluded via a new segment filter in fct_orders. See DATA-482."
```

## 🔍 PR & Code Review Checklist

```markdown
<!-- .github/pull_request_template.md -->
## What changed and why


## Models affected
- [ ] Ran `dbt build --select state:modified+` locally/in CI
- [ ] Checked downstream models for breaking changes

## Data validation
- [ ] Spot-checked row counts before/after
- [ ] Added/updated tests (`unique`, `not_null`, `relationships`, custom)

## Docs
- [ ] Updated column descriptions in the relevant `.yml`
- [ ] Updated grain/SLA notes if the model's semantics changed

## Breaking changes
- [ ] None
- [ ] Yes — downstream consumers notified: ___
```

Reviewer checklist for SQL logic specifically:
- Does the join type (`LEFT` vs `INNER`) match the intended grain, and could it silently drop or duplicate rows?
- Are `NULL`s handled explicitly where they affect aggregations (`SUM`, `COUNT`, `AVG`)?
- Is the model's grain documented, and does the diff change it?
- Are hard-coded values (dates, IDs, thresholds) that should be config/variables instead?

## 🧱 Migration Tooling

```bash
# Sqitch: SQL-native migration tool, no ORM required
sqitch init my_project --engine pg
sqitch add add_customer_ltv_column -n "Add ltv column to customers"
# edit deploy/add_customer_ltv_column.sql, revert/..., verify/...
sqitch deploy db:pg://user@localhost/mydb
sqitch revert db:pg://user@localhost/mydb
```

```sql
-- deploy/add_customer_ltv_column.sql
ALTER TABLE customers ADD COLUMN ltv NUMERIC;

-- revert/add_customer_ltv_column.sql
ALTER TABLE customers DROP COLUMN ltv;
```

```bash
# Flyway: versioned migration files, convention-based ordering
# V1__create_customers_table.sql
# V2__add_ltv_column.sql
flyway -url=jdbc:postgresql://localhost/mydb -user=user migrate
flyway -url=jdbc:postgresql://localhost/mydb -user=user info      # see applied/pending
flyway undo                                                        # (paid feature) roll back last version
```

```python
# Alembic (common in Python-adjacent warehouses / metadata DBs, less common for the warehouse itself)
alembic revision -m "add ltv column to customers"
alembic upgrade head
alembic downgrade -1
```

For dbt-centric projects, "migrations" are usually just **new/changed models + `dbt run`**, with `snapshots/` handling slowly-changing-dimension-style history — dedicated migration tools like Sqitch/Flyway show up more for the underlying application database or a non-dbt-managed warehouse schema.

## ⚠️ Safe Schema Change Patterns

```sql
-- UNSAFE: renaming a column breaks every downstream consumer instantly
ALTER TABLE fct_orders RENAME COLUMN amt TO amount;

-- SAFER: add the new column, backfill, update consumers, then drop the old one later
ALTER TABLE fct_orders ADD COLUMN amount NUMERIC;
UPDATE fct_orders SET amount = amt;
-- (deploy, let consumers migrate over a release or two)
ALTER TABLE fct_orders DROP COLUMN amt;
```

```yaml
# dbt contracts catch breaking type changes at build time, before they hit consumers
models:
  - name: fct_orders
    config:
      contract:
        enforced: true
    columns:
      - name: amount
        data_type: numeric(18,2)
```

```text
Expand/contract pattern for breaking changes:
1. Expand  — add the new shape alongside the old (new column, new model, new metric)
2. Migrate — update all known consumers to the new shape
3. Contract — remove the old shape once nothing references it (verify via query logs / lineage)
```

## 🪝 Git Hooks for SQL Formatting

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/sqlfluff/sqlfluff
    rev: 3.0.0
    hooks:
      - id: sqlfluff-fix
        args: [--dialect, snowflake]
        additional_dependencies: ['sqlfluff-templater-dbt']
```

```bash
# Enforce formatting client-side before it ever reaches CI
pre-commit install
git commit -m "..."   # sqlfluff-fix runs automatically, blocks commit if it can't auto-fix
```

## 📦 Working with dbt Artifacts Across Branches

```bash
# Compare compiled SQL between your branch and main to see the *actual* diff
# a review of raw Jinja can hide (macros expanding differently, etc.)
git checkout main && dbt compile --target dev
cp -r target/compiled ./main-compiled

git checkout feature/add-ltv-metric && dbt compile --target dev
diff -r main-compiled target/compiled
```

```bash
# Keep each branch's dev schema isolated so parallel work doesn't collide
dbt run --target dev --vars '{schema_suffix: my_initials}'
```

## 🏢 Monorepo vs. Polyrepo for Analytics

| Approach   | Looks like                                              | Fits when...                                                       |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| Monorepo    | One dbt project (or one repo with multiple dbt projects) holding all models | Single team or tightly coordinated teams; shared marts and sources need atomic cross-domain PRs |
| Polyrepo    | Separate repos per domain (`analytics-finance`, `analytics-marketing`), often using dbt Mesh / cross-project `ref()` | Multiple independent teams who want to own their own release cadence and CI |

```yaml
# dbt Mesh-style cross-project ref (polyrepo pattern) — a downstream project
# depends on a public model published by an upstream project, without
# needing that project's full source code
models:
  - name: fct_orders
    access: public          # exposes this model for cross-project ref()
```

```text
# Downstream project's dependency
# dependencies.yml
projects:
  - name: finance_analytics
```

```text
Rule of thumb: start monorepo. Split into polyrepo only once a specific
team's release cadence is genuinely blocked by unrelated teams' PRs — the
coordination cost of dbt Mesh/cross-project contracts is real, and isn't
worth paying until the monorepo's coordination cost is worse.
```

## 🧩 Resolving Merge Conflicts in SQL & YAML

```sql
-- A conflict in a model's SQL — resolve by reading intent from both branches,
-- not just picking one side mechanically
<<<<<<< HEAD
SELECT order_id, amount, status
FROM {{ ref('stg_orders') }}
WHERE status != 'test'
=======
SELECT order_id, amount, currency, status
FROM {{ ref('stg_orders') }}
>>>>>>> feature/add-currency
-- Correct resolution usually keeps BOTH intents:
SELECT order_id, amount, currency, status
FROM {{ ref('stg_orders') }}
WHERE status != 'test'
```

```yaml
# YAML conflicts are common on shared _schema.yml files when two PRs both
# add columns/tests to the same model — resolve by merging both column lists,
# never by deleting one side wholesale
columns:
<<<<<<< HEAD
  - name: order_id
    tests: [unique, not_null]
=======
  - name: order_id
    tests: [unique, not_null]
  - name: currency
    tests: [not_null]
>>>>>>> feature/add-currency
# Resolved: keep order_id's tests once, add the new currency column
```

```bash
# After resolving any conflict touching models/ or .yml files, always re-parse
# before committing the merge — a syntactically "resolved" YAML file can still
# be semantically broken (duplicate keys, orphaned refs)
dbt parse
dbt compile
```

## 📖 Real-World Example: Branch-to-Production Walkthrough

A full walkthrough of one change — adding a `discount_pct` column to an order fact table — from branch to production.

```bash
# 1. Branch off latest main
git checkout main && git pull
git checkout -b feat/add-discount-pct-to-fct-orders

# 2. Make the change
#    - edit models/marts/finance/fct_orders.sql to add the new column
#    - edit models/marts/finance/_fct_orders.yml to document + test it

# 3. Validate locally before pushing
dbt run --select fct_orders --target dev
dbt test --select fct_orders --target dev
sqlfluff lint models/marts/finance/fct_orders.sql

# 4. Push and open a PR
git add models/marts/finance/
git commit -m "feat(marts): add discount_pct to fct_orders

Finance needs discount rate visibility per order for the Q3 promo
analysis. Sourced from stg_orders.discount_amount / stg_orders.amount.
See DATA-511."
git push -u origin feat/add-discount-pct-to-fct-orders
```

```yaml
# 5. CI runs automatically on the PR (see the CI/CD cheat sheet for pipeline detail)
# - lint job: sqlfluff lint models/
# - slim CI job: dbt build --select state:modified+ --defer --state ./prod-artifacts
```

```bash
# 6. After approval, squash-merge to main
# 7. Merge triggers the deploy job: dbt build --target prod, docs regenerated,
#    manifest re-uploaded as the new baseline for the next PR's slim CI

# 8. Tag the release if this is a notable/customer-visible change
git tag -a v2.3.0 -m "Add discount_pct to fct_orders"
git push origin v2.3.0
```

## 🔀 Handling Long-Running Branches

```bash
# Rebase regularly instead of letting a branch drift for weeks
git checkout feat/big-refactor
git fetch origin
git rebase origin/main
# resolve conflicts incrementally, commit-by-commit, rather than one giant
# conflict resolution at the very end
```

```text
If a change genuinely can't ship in a single small PR (e.g. a multi-week
warehouse migration), prefer:
  1. An integration branch that itself gets frequent small PRs merged into
     it (keeps individual reviews small even if the overall effort is large)
  2. Feature-flagging the new logic behind a dbt variable so it can merge
     to main disabled, and be turned on later without a big-bang cutover
```

```yaml
# dbt var-based feature flag: merge the new logic to main, dark-launched
{% if var('enable_new_discount_logic', false) %}
  discount_pct = amount_discounted / amount
{% else %}
  discount_pct = null
{% endif %}
```

```bash
# Turn the flag on for a specific environment first
dbt build --target staging --vars '{enable_new_discount_logic: true}'
```

## 🛠️ Troubleshooting Common Git/dbt Issues

| Symptom                                                  | Likely cause                                                     | Fix                                                                  |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `dbt compile` fails after a merge with "model not found"          | A `ref()` points to a model renamed/removed on the other branch          | Search the merged branch for the old model name and update the `ref()`      |
| PR shows a huge, unreviewable diff                                | Branch went stale for weeks without rebasing against `main`               | Rebase earlier and more often; split unrelated changes into separate PRs    |
| Merge "succeeded" but `_schema.yml` has duplicate model entries    | A YAML conflict was resolved by keeping both sides verbatim               | Manually de-duplicate the YAML keys, then `dbt parse` to confirm            |
| `git push` rejected after rebase                                    | Remote branch has commits your rebase rewrote                              | `git push --force-with-lease` (never bare `--force` on a shared branch)     |
| Teammate's local dev schema has data that doesn't match yours       | Each dev builds against their own `dbt_dev_<user>` schema from possibly different branch states | Expected behavior — compare via `dbt run --select` on the same branch, not raw schema diffing |
| Cherry-picked hotfix conflicts oddly with main                       | The hotfix commit depended on other, un-cherry-picked commits from its original branch | Cherry-pick the full dependency chain, or rebase-merge the whole fix branch instead |

## ⚠️ Common Gotchas

- **Force-pushing after a rebase without `--force-with-lease`** can silently overwrite a collaborator's pushed commits on a shared branch — always use `--force-with-lease`, never bare `--force`, on anything but a solo branch.
- **Renaming a model file without updating `ref()`s elsewhere** breaks the DAG at compile time, not at review time — `dbt compile` locally catches this before it reaches CI.
- **Squash-merging loses granular history** that can matter for debugging a regression introduced across several small commits — fine for most feature branches, riskier for large refactors.
- **Reviewing raw `.sql` diffs misses macro-expansion changes** — a one-line macro edit can silently change generated SQL across dozens of models; diff compiled SQL for high-risk macro changes.
- **Migration tools and dbt can drift out of sync** if some schema changes go through Sqitch/Flyway and others go through dbt `run` — pick one system of record per schema/table and document which.
- **Dropping a column "later" often never happens** — expand/contract migrations need a tracked follow-up ticket or they become permanent dead weight.

## 🎯 Best Practices

```bash
# GOOD: small, reviewable PRs scoped to one logical change
git checkout -b fix/null-handling-stg-orders
# touches 1-2 files, one clear purpose, fast to review
```

- Keep PRs **small and single-purpose** — a PR that touches staging, marts, and macros at once is hard to review for correctness and hard to revert if something breaks.
- Require **lint + slim CI to pass** before merge, enforced by branch protection rules, not by convention alone.
- Use **`ref()` and `source()` exclusively**, never hard-coded table names, so git history and lineage graphs stay accurate as tables move between schemas.
- Document a model's **grain and primary key** in its `.yml` the same PR that introduces it — grain changes later are much easier to review against a documented baseline.
- Treat **breaking changes to shared marts** as a cross-team communication event, not just a merged PR — a Slack heads-up or deprecation period prevents silent downstream breakage.

## 💡 Pro Tips

1. **Diff compiled SQL, not just Jinja**, for any PR that touches a macro used by more than a couple of models.
2. **Use `dbt run-operation` scripts for one-off backfills** and check them into version control — future-you needs to know how last quarter's number was patched.
3. **Tag releases** (`git tag -a v1.4.0`) at each prod deploy so you can bisect "when did this metric change" against actual deploy points.
4. **Keep a `CHANGELOG.md` for marts** that BI consumers read — a git log is not a substitute for a human-readable changelog aimed at non-engineers.
5. **Branch names should describe intent, not ticket numbers alone** (`fix/null-handling-stg-orders`, not `DATA-482`) — reviewers get context without opening another tool.
6. **Use `dbt list --select state:modified+` before opening a PR** to preview blast radius yourself, before a reviewer has to ask "what does this actually affect?"
7. **Never rebase a branch other people have already pulled** — merge instead, or coordinate explicitly.
8. **Enforce `.sqlfluff` config in CI, not just locally** — local pre-commit hooks can be skipped with `--no-verify`; CI is the actual gate.
9. **Store migration scripts and their rollback scripts together** (deploy/revert pairs) — a migration without a tested rollback is a one-way door.
10. **Review the `_yml` doc changes as carefully as the SQL** — stale or wrong column descriptions erode trust in docs faster than having no docs at all.
