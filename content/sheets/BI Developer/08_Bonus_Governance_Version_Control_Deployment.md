# 🛡️ Bonus: Governance, Version Control & Deployment — BI Developer Cheatsheet (Deep Dive)

## Table of Contents
1. [Source Control for BI Assets](#1-source-control-for-bi-assets)
2. [CI/CD Pipeline Example](#2-cicd-pipeline-example)
3. [Naming & Folder Conventions](#3-naming--folder-conventions)
4. [Access Control (RBAC) Matrix Example](#4-access-control-rbac-matrix-example)
5. [Change Management Process](#5-change-management-process)
6. [Monitoring & Auditing](#6-monitoring--auditing)
7. [Data Catalog Example Entry](#7-data-catalog-example-entry)
8. [Worked Example: Promoting a Power BI Dataset Through Environments](#8-worked-example-promoting-a-power-bi-dataset-through-environments)

---

## 1. Source Control for BI Assets

| Asset | Format | How to Version |
|---|---|---|
| Power BI reports/datasets | `.pbip` (Power BI Project format — file-based, diffable) | Git repo, standard PR review |
| Power BI reports (legacy) | `.pbix` (binary) | Git LFS, but diffs are not human-readable |
| Tableau workbooks | `.twb` (XML) or `.twbx` (packaged) | Git repo — `.twb` diffs are readable XML |
| dbt models/metrics | `.sql` / `.yml` | Git repo — standard code review workflow |
| Tabular model definitions | `.bim` / TMDL (Tabular Model Definition Language) | Git repo, works well with Tabular Editor |

**Tip:** Prefer `.pbip` over `.pbix` and `.twb` over `.twbx` where possible — they're plain-text/XML-based and produce meaningful diffs in pull requests, unlike opaque binary formats.

---

## 2. CI/CD Pipeline Example

**Example: GitHub Actions pipeline for a dbt project feeding BI datasets**
```yaml
# .github/workflows/dbt-ci.yml
name: dbt CI
on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dbt
        run: pip install dbt-snowflake
      - name: Run dbt build (models + tests) against a dev schema
        run: dbt build --target ci
      - name: Fail if any data quality test fails
        run: dbt test --target ci
```

**Example: Power BI Deployment Pipeline stages**
```
Dev Workspace  →  Test Workspace  →  Production Workspace
   (developer        (QA validates       (business users
    builds/tests)      against sample      consume via App)
                        data & RLS)
```
Each stage can have **deployment rules** that automatically swap data source connection strings (e.g., Dev points to a dev database, Prod points to the production warehouse) so promoting a report doesn't require manual reconfiguration.

---

## 3. Naming & Folder Conventions

### Table/Column Naming
```
Fact_Sales, Fact_Inventory          -- fact tables prefixed "Fact_"
Dim_Customer, Dim_Product, Dim_Date -- dimension tables prefixed "Dim_"
KPI_TotalRevenue, KPI_ChurnRate     -- certified/governed measures prefixed "KPI_" (optional convention)
```

### Workspace/Project Folder Structure Example
```
BI Platform
├── 00_Shared_Datasets        (certified datasets/data sources only)
├── 01_Sales_Analytics
│   ├── Dev
│   ├── Test
│   └── Prod
├── 02_Finance_Reporting
│   ├── Dev
│   ├── Test
│   └── Prod
└── 03_Executive_Dashboards
    └── Prod (read-only, curated content only)
```

---

## 4. Access Control (RBAC) Matrix Example

| Role | View Reports | Edit Reports | Edit Datasets/Data Sources | Manage Permissions | Publish to Prod |
|---|---|---|---|---|---|
| **Viewer** (business user) | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Analyst/Report Author** | ✅ | ✅ | ❌ (uses certified datasets) | ❌ | ❌ |
| **BI Developer** | ✅ | ✅ | ✅ | ❌ | ✅ (via pipeline/PR) |
| **BI Admin/Governance Lead** | ✅ | ✅ | ✅ | ✅ | ✅ |

Combine this workspace/project-level RBAC with **RLS/OLS** at the data level (see the RLS cheatsheet) for full defense-in-depth — RBAC controls *what content* a user can access; RLS controls *what data within that content* they can see.

---

## 5. Change Management Process

```
1. Proposed change (new measure, model change, RLS update) opened as a ticket/PR
2. Impact analysis: which reports/datasets depend on the object being changed?
   (Use lineage view in Power BI Service / dbt's `dbt docs generate` DAG)
3. Peer review: another BI developer reviews the DAX/SQL/model change
4. Test in Dev/Test workspace against realistic data + RLS test users
5. Approval from data/BI governance owner for certified/shared assets
6. Deploy via pipeline to Production
7. Communicate the change to affected report consumers (especially for
   breaking changes to certified datasets)
8. Monitor post-deployment for errors or user-reported discrepancies
```

---

## 6. Monitoring & Auditing

### Usage Metrics
- Power BI: built-in **Usage Metrics report** per workspace (views, unique viewers, report load time).
- Tableau: **Server Admin Views** (workbook views, user activity, slow-loading views).

### Refresh Failure Alerts
```
Power BI: Configure dataset refresh failure notifications
  (Settings > Datasets > [Dataset] > Refresh alerts)
Tableau: Configure extract refresh failure email alerts at the Server/Cloud level
```

### Data Quality Monitoring (Upstream)
```yaml
# Example dbt test config catching issues before they reach BI tools
models:
  - name: fct_sales
    columns:
      - name: order_id
        tests:
          - unique
          - not_null
      - name: customer_id
        tests:
          - relationships:
              to: ref('dim_customer')
              field: customer_id
```

### Access Audit
Periodically export and review:
- Who has access to each workspace/project and at what permission level.
- Which datasets/data sources contain PII and who can query them.
- Stale content (reports not viewed in 90+ days) as candidates for archival.

---

## 7. Data Catalog Example Entry

A minimal catalog entry that should exist for every certified dataset:

```yaml
dataset_name: "Sales Model"
description: "Certified sales dataset — grain: 1 row per order line. Source of truth for revenue reporting."
owner: "BI Team (jane.doe@company.com)"
refresh_schedule: "Daily, 6:00 AM UTC"
storage_mode: "Import"
row_level_security: "Yes — dynamic, by Region (see UserAccessMap)"
sensitivity: "Internal"
upstream_source: "fct_sales (Gold layer, Snowflake)"
certified: true
certified_date: "2026-03-01"
known_limitations: "Returns data lags by 1 day due to source system batch job."
```

---

## 8. Worked Example: Promoting a Power BI Dataset Through Environments

**Scenario:** A BI developer builds a new "Customer Churn" dataset and needs to promote it safely to production.

1. **Dev**: Build the dataset in a `Dev` workspace, pointing Power Query parameters at a `dev` database.
2. **Source Control**: Save as `.pbip`, commit to a feature branch, open a PR.
3. **Peer Review**: Another BI developer reviews the DAX measures and model relationships in the PR diff.
4. **Test**: Merge to `main`, deploy via Deployment Pipeline to `Test` workspace — parameters automatically swap to point at the `test` database. QA validates numbers and RLS with test user accounts.
5. **Certify**: Once validated, the dataset is marked **Certified** and documented in the data catalog.
6. **Prod**: Promote via the pipeline to `Prod` — parameters swap to the production database. Publish an **App** so business users consume it without direct workspace access.
7. **Monitor**: Set up refresh failure alerts and review Usage Metrics after a week to confirm adoption and performance.

This is the same **Dev → Test → Prod, with source control and peer review at every promotion step** pattern used across mature BI/data engineering teams, regardless of the specific tool.
