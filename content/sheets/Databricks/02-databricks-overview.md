# Databricks Overview Cheatsheet

> What Databricks is, how it's structured, and the core vocabulary you need before going deeper. This is the expanded reference — architecture internals, editions, identity, and workspace administration included.

---

## 1. What Is Databricks?

Databricks is a unified **data + AI platform** built by the original creators of Apache Spark, Delta Lake, and MLflow. It runs *inside* your cloud provider (AWS, Azure, or GCP) and provides a managed environment spanning:

- **Data Engineering** — batch and streaming ETL/ELT pipelines
- **Data Warehousing / SQL Analytics** — BI-grade SQL performance on the lake
- **Machine Learning & AI** — training, tracking, serving, and now GenAI/LLMOps
- **Real-time Streaming** — Structured Streaming, DLT streaming tables
- **Governance** — Unity Catalog across every asset above

The architecture it popularized is the **Lakehouse**: a single copy of data, stored in open formats (Delta Lake/Parquet/Iceberg via UniForm) on cheap cloud object storage, with the reliability, performance, and governance features traditionally only found in proprietary data warehouses.

### Why This Matters in Practice
Historically, organizations ran **two stacks**: a data lake (cheap, flexible, but unreliable and hard to govern) feeding a data warehouse (reliable, fast, but expensive and rigid, and a copy of the data). The Lakehouse collapses this into one system — one copy of data, one governance model, one place for both BI and ML to read from. This reduces data duplication, staleness, and reconciliation problems between "the BI numbers" and "the ML feature," which historically diverged because they were computed from different copies.

---

## 2. Why Lakehouse (vs. Data Lake vs. Data Warehouse)

| | Data Warehouse | Data Lake | Lakehouse |
|---|---|---|---|
| Data types | Structured only | Structured + unstructured | Structured + unstructured |
| ACID transactions | ✅ | ❌ | ✅ (via Delta Lake) |
| Schema enforcement | ✅ | ❌ (schema-on-read) | ✅ (with evolution support) |
| Storage cost | High (proprietary storage) | Low (object storage) | Low (object storage) |
| Compute/storage coupling | Often coupled | Decoupled | Decoupled |
| BI + ML on same copy | ❌ (usually separate systems) | Partial | ✅ |
| Streaming + batch unification | Limited | Manual | ✅ (same table, same API) |
| Vendor/format lock-in | Often high (proprietary format) | Low | Low (open formats: Delta, Parquet, Iceberg) |
| Time travel / audit history | Sometimes | ❌ | ✅ |
| Fine-grained governance | ✅ | Historically weak | ✅ (Unity Catalog) |

---

## 3. Control Plane vs. Data Plane

Databricks splits responsibilities across two "planes" for security and cost reasons. Understanding this split is usually the first thing a security/compliance review asks about.

| Plane | Lives in | Contains |
|-------|----------|----------|
| **Control Plane** | Databricks-managed cloud account | Web UI, notebook source/revision history, job scheduler, cluster manager APIs, Unity Catalog metadata |
| **Classic Data Plane** | **Your** cloud account (VPC/VNet) | Clusters (VMs), your data in object storage, SQL Warehouse compute (Classic/Pro) |
| **Serverless Data Plane** | Databricks-managed, logically isolated per workspace | Serverless SQL warehouses, serverless jobs/notebooks compute, serverless DLT/Lakeflow compute |

**Key implications:**
- In the **Classic** model, your raw data at rest **never leaves your cloud account** — Databricks orchestrates compute against it but doesn't ingest a copy. This is the standard answer for "where does my data go?"
- In the **Serverless** model, compute runs in a Databricks-managed plane, but is single-tenant/isolated per workspace and typically operates over encrypted, ephemeral storage for shuffle/spill — data at rest for your tables remains in your object storage regardless of which plane executed the compute.
- Networking features like **PrivateLink / VNet injection / Secure Cluster Connectivity (No Public IP)** exist specifically to lock down the channel between control plane and data plane for enterprises with strict network policies.

---

## 4. Deployment & Regional Model

- A **Databricks Account** sits at the top (billing, identity, Unity Catalog metastores, budgets).
- Under an account, you create one or more **Workspaces**, each tied to a specific cloud region and a specific cloud subscription/project/account.
- A **Unity Catalog metastore** is created **per region** and attached to every workspace in that region — this is what allows multiple workspaces (dev/staging/prod, or per business unit) to share one governance plane.
- Cross-region data access typically goes through **Delta Sharing** or explicit cross-region replication, not directly through UC (since a metastore is region-scoped).

```
Account
 ├── Metastore (us-east-1)
 │     ├── Workspace: dev
 │     ├── Workspace: staging
 │     └── Workspace: prod
 └── Metastore (eu-west-1)
       └── Workspace: eu-prod
```

---

## 5. Core Building Blocks

| Component | Purpose |
|-----------|---------|
| **Workspace** | Top-level container: notebooks, folders, dashboards, repos, permissions |
| **Notebook** | Interactive multi-language (SQL, Python, Scala, R) code environment with cell-level execution |
| **Cluster** | Set of VMs running Spark to execute code |
| **SQL Warehouse** | Compute optimized for SQL/BI workloads (Serverless, Pro, or Classic) |
| **Unity Catalog Metastore** | Account-level governance layer: catalogs → schemas → tables/volumes/models/functions |
| **Job / Workflow** | Scheduled or triggered execution of notebooks/scripts/pipelines |
| **DLT / Lakeflow Declarative Pipeline** | Declarative ETL pipeline definition with built-in quality checks |
| **Repos** | Git-backed folders for source control of notebooks/code |
| **MLflow Experiment** | Tracked container of ML training runs |
| **Model Registry / UC Models** | Versioned, governed store of ML models |
| **Feature Store / Feature Engineering** | Centralized, reusable ML feature tables with point-in-time correctness |
| **Delta Sharing** | Open protocol to share live data across orgs/platforms without copying |
| **Genie Space** | Natural-language Q&A interface over governed tables |
| **Marketplace** | Catalog of shareable datasets, notebooks, and Solution Accelerators (some free, some commercial) |
| **Clean Rooms** | Privacy-safe, multi-party data collaboration without exposing raw rows to either party |

---

## 6. Notebooks in Depth

- **Multi-language cells**: prefix a cell with `%python`, `%sql`, `%scala`, `%r`, or `%md` (Markdown) to mix languages in one notebook — variables don't cross language boundaries directly, but temp views and DataFrames registered as SQL tables do.
- **Magic commands**: `%run ./other_notebook` (include another notebook's code), `%fs ls /path` (list files), `%sh` (run shell commands on the driver).
- **Widgets** (parameters): `dbutils.widgets.text("env", "dev")` then `dbutils.widgets.get("env")` — used to parameterize notebooks for job runs.
- **`dbutils`** utility namespace: `dbutils.fs` (file ops), `dbutils.secrets` (credential access), `dbutils.notebook.run()` (call another notebook and get a return value), `dbutils.widgets` (parameters).
- **Version history**: every notebook has built-in revision history in the UI, separate from (but complementary to) Git-based version control via Repos.
- **Collaboration**: real-time co-editing, inline comments, and command-level run permissions.
- **Source format**: notebooks can be exported/stored as `.ipynb` or as **source `.py`/`.sql`/`.scala` files with `# COMMAND ----------` cell markers** — the latter is strongly preferred for Git-based workflows because diffs are far cleaner.

---

## 7. Personas & Where They Work

| Persona | Primary Surface |
|---------|------------------|
| Data Engineer | Notebooks, Workflows, DLT/Lakeflow, Jobs, Repos |
| Data Analyst | Databricks SQL Editor, Dashboards (Lakeview), Genie |
| ML Engineer / Data Scientist | Notebooks, MLflow, Feature Store, Model Serving, AutoML |
| Platform/Admin | Account Console, Unity Catalog, cluster policies, IAM, budgets |
| Business User | AI/BI Dashboards, Genie Spaces, Marketplace |

---

## 8. Editions / Pricing Tiers

| Tier | Adds |
|------|------|
| **Standard** | Core platform features, basic access control |
| **Premium** | Role-based access control, audit logging, Unity Catalog, cluster policies, IP access lists |
| **Enterprise** | Advanced security: customer-managed keys (CMK), compliance certifications (HIPAA, FedRAMP, etc. depending on cloud/region), enhanced security monitoring, Compliance Security Profile |

> Billing is based on **DBUs (Databricks Units) consumed** + the underlying cloud VM/storage cost billed separately by your cloud provider. See the [Cost, Governance & Troubleshooting cheatsheet](./11-cost-governance-troubleshooting.md) for the full economics.

---

## 9. Identity & Access Foundations

| Concept | Detail |
|---------|--------|
| **SSO** | Workspaces integrate with your identity provider (Okta, Azure AD/Entra ID, Ping, etc.) via SAML/OIDC |
| **SCIM Provisioning** | Automatically syncs users and groups from your IdP into the Databricks account, so group membership is managed centrally, not manually |
| **Service Principals** | Non-human identities used for jobs, CI/CD, and API automation — never run production workloads as a personal user |
| **Personal Access Tokens (PATs)** | Legacy auth method for CLI/API; OAuth machine-to-machine tokens via service principals are now the recommended approach |
| **Workspace-level vs. Account-level permissions** | Some settings (SSO, metastore assignment, billing) are account-level and managed in the **Account Console**; most day-to-day permissions are workspace-level |

---

## 10. Key Terminology Quick Reference

| Term | Meaning |
|------|---------|
| **Workspace URL** | Unique per-deployment URL, e.g. `adb-xxxx.azuredatabricks.net` or `xxxx.cloud.databricks.com` |
| **DBFS** | Databricks File System — a legacy abstraction over cloud storage; being phased out in favor of **Volumes** for governed file access |
| **Volumes** | Unity Catalog–governed storage for non-tabular files (replaces ad hoc DBFS mounts) |
| **Secrets / Secret Scope** | Secure storage for credentials referenced in code, never hardcoded |
| **Runtime (DBR)** | Pre-configured version of Spark + libraries + optimizations that clusters run |
| **Photon** | Native vectorized execution engine, drop-in accelerator for Spark SQL/DataFrame operators |
| **Genie** | Natural-language interface for querying governed data with AI, grounded in table metadata |
| **Mosaic AI** | Databricks' suite for building/serving/fine-tuning GenAI & LLM applications |
| **Lakeview / AI-BI Dashboards** | Native dashboarding layer built directly on Databricks SQL |
| **Clean Room** | Isolated, governed environment for two+ parties to run joint queries without exposing raw underlying data |

---

## 11. High-Level Architecture Diagram

```
                     ┌───────────────────────────┐
                     │      Account Console       │
                     │ (Unity Catalog, Billing,   │
                     │  Identity, Workspaces)     │
                     └────────────┬──────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
  ┌─────▼─────┐            ┌──────▼──────┐           ┌──────▼──────┐
  │Workspace A │            │ Workspace B │           │ Workspace C │
  │ (dev)      │            │  (staging)  │           │   (prod)    │
  └─────┬─────┘            └──────┬──────┘           └──────┬──────┘
        │                         │                         │
   Clusters / Jobs           Clusters / Jobs           Clusters / Jobs
   / SQL Warehouses          / SQL Warehouses          / SQL Warehouses
        │                         │                         │
        └───────────────┬─────────┴──────────┬──────────────┘
                         ▼                    ▼
                 Cloud Object Storage   Unity Catalog Metastore
                 (S3 / ADLS / GCS)      (shared governance, 1 per region)
```

---

## 12. REST API & CLI — First Touchpoints

```bash
# Install & authenticate
pip install databricks-cli   # or use the newer `databricks` unified CLI
databricks auth login --host https://<workspace>.cloud.databricks.com

# Sanity checks
databricks clusters list
databricks workspace list /Users/me
databricks catalogs list
```

Almost every UI action has a corresponding **REST API** endpoint (`/api/2.1/jobs/...`, `/api/2.1/clusters/...`, `/api/2.1/unity-catalog/...`) — this is what powers Terraform, Asset Bundles, and custom automation.

---

## 13. Common First-Week Gotchas

| Gotcha | Explanation |
|--------|-------------|
| "Why can't I see this table?" | Missing `USE CATALOG`/`USE SCHEMA` privilege somewhere up the chain, not just `SELECT` on the table itself |
| "My cluster takes 5+ minutes to start" | Normal cold start for classic clusters; use Pools or Serverless for faster starts |
| "DBFS root vs. mounted storage vs. Volumes — which do I use?" | Prefer **Volumes** for new work; DBFS root/mounts are legacy patterns being deprecated in UC-first workspaces |
| "Notebook `.ipynb` diffs are unreadable in Git" | Switch to source-format `.py` files with cell markers |
| "Why is my job so much more expensive on an all-purpose cluster?" | All-purpose DBU rate > Jobs compute rate; always use Job Clusters/Serverless for scheduled work |

---

## 14. Where to Go Next

- Writing Spark code → [Spark Architecture & Runtime](./03-spark-architecture-runtime.md)
- Building tables → [Delta Table Deep Dive](./04-delta-table-deep-dive.md)
- Governing data → [Unity Catalog & Governance](./06-unity-catalog-governance.md)
- Scheduling pipelines → [Orchestration & Workflows](./07-orchestration-workflows.md)
