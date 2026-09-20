# Data Versioning Cheatsheet (DVC / lakeFS) for Data & Analytics Engineers

> A structured reference for "git for data" tooling — DVC for dataset/model/pipeline versioning alongside Git, and lakeFS for Git-like branching directly on object storage. Covers setup, day-to-day commands, pipelines, remotes, and CI/CD integration.

## 📑 Table of Contents

1. [🧠 Why Version Data Separately from Code](#why-version-data-separately-from-code)
2. [🚀 DVC: Setup and Core Workflow](#dvc-setup-and-core-workflow)
3. [🏗️ DVC: Pipelines (dvc.yaml)](#dvc-pipelines-dvcyaml)
4. [🔬 DVC: Experiments, Metrics & Params](#dvc-experiments-metrics-params)
5. [☁️ DVC: Remotes](#dvc-remotes)
6. [🌊 lakeFS: Core Concepts](#lakefs-core-concepts)
7. [🚀 lakeFS: Setup and CLI](#lakefs-setup-and-cli)
8. [🐍 lakeFS: Python & S3-Compatible Access](#lakefs-python-s3-compatible-access)
9. [🪝 lakeFS: Hooks & CI/CD](#lakefs-hooks-cicd)
10. [🔀 DVC vs lakeFS: When to Use Which](#dvc-vs-lakefs-when-to-use-which)
11. [🧠 Content Addressing Internals](#content-addressing-internals)
12. [📚 DVC Data Registries & Import](#dvc-data-registries-import)
13. [🏔️ lakeFS with Iceberg/Delta & Query Engines](#lakefs-with-iceberg-delta-query-engines)
14. [🔗 DVC + lakeFS Combined Workflow](#dvc-lakefs-combined-workflow)
15. [🧪 CI/CD Patterns in Depth](#cicd-patterns-in-depth)
16. [⚠️ Common Gotchas](#common-gotchas)
17. [🎯 Best Practices](#best-practices)
18. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Task                       | DVC                                            | lakeFS                                                      |
| --------------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| Init                        | `dvc init`                                       | `lakectl repo create lakefs://repo s3://bucket`               |
| Track a file/dataset        | `dvc add data.csv`                               | `lakectl fs upload lakefs://repo/main/data.csv -s data.csv`   |
| Commit a version            | `git commit -m "..."` (after `dvc add`)          | `lakectl commit lakefs://repo/main -m "..."`                  |
| Create a branch             | `git checkout -b exp1`                           | `lakectl branch create lakefs://repo/exp1 -s lakefs://repo/main` |
| Push data                   | `dvc push`                                       | (data lives in object storage already; commit is the "push")  |
| Pull data                   | `dvc pull`                                       | `lakectl fs download lakefs://repo/main/`                     |
| Compare / diff              | `dvc diff`                                       | `lakectl diff lakefs://repo/main lakefs://repo/exp1`           |
| Merge                       | `git merge`                                      | `lakectl merge lakefs://repo/exp1 lakefs://repo/main`         |
| Rollback                    | `git checkout <commit> -- data.csv.dvc && dvc checkout` | `lakectl branch revert lakefs://repo/main <commit>`      |

## 🧠 Why Version Data Separately from Code

- **Git isn't built for large binary files** — every version of a multi-GB dataset stored directly in Git bloats the repo forever; DVC/lakeFS keep large data out of Git while still giving you commit-like versioning.
- **Reproducibility** — pairing a Git commit (code) with a data version (DVC pointer file or lakeFS commit) lets you exactly reproduce "what code + what data produced this model/result."
- **Two different philosophies**:
  - **DVC** — Git-native: small pointer/metadata files live in Git, actual data lives in a "remote" (S3/GCS/Azure/local); you version data the same way you version code, using Git commands.
  - **lakeFS** — storage-native: sits in front of your existing object storage bucket and gives you Git-like branch/commit/merge semantics *directly on the data*, independent of any Git repo, via an S3-compatible API.

## 🚀 DVC: Setup and Core Workflow

```bash
pip install dvc[s3]        # extras: s3, gs, azure, ssh, hdfs...

# Initialize inside an existing Git repo
git init
dvc init
git commit -m "Initialize DVC"

# Track a dataset — creates data.csv.dvc (small pointer file) + .gitignore entry
dvc add data/raw/data.csv
git add data/raw/data.csv.dvc data/raw/.gitignore
git commit -m "Add raw data v1"

# Configure a remote (where actual data bytes live)
dvc remote add -d storage s3://my-bucket/dvc-store
git commit -m "Configure remote" .dvc/config

# Push data to the remote, pull it back down elsewhere
dvc push
dvc pull

# Check out a specific data version tied to a Git commit/tag
git checkout v1.0
dvc checkout

# See what changed
dvc status
dvc diff HEAD~1
```

```
data/raw/data.csv.dvc      # small YAML pointer: hash, size, path — this is what Git tracks
data/raw/data.csv          # actual file — gitignored, fetched via `dvc pull`
.dvc/config                # remote configuration
```

## 🏗️ DVC: Pipelines (dvc.yaml)

```yaml
# dvc.yaml — declarative, reproducible, cached pipeline stages
stages:
  prepare:
    cmd: python src/prepare.py data/raw/data.csv data/prepared/data.csv
    deps:
      - src/prepare.py
      - data/raw/data.csv
    outs:
      - data/prepared/data.csv

  train:
    cmd: python src/train.py data/prepared/data.csv model.pkl
    deps:
      - src/train.py
      - data/prepared/data.csv
    params:
      - train.learning_rate
      - train.epochs
    outs:
      - model.pkl
    metrics:
      - metrics.json:
          cache: false
```

```bash
dvc repro                 # re-run only stages whose deps/params/code changed (DAG-aware caching)
dvc dag                   # visualize the pipeline DAG
dvc repro --force         # re-run everything regardless of cache
```

- Each stage's **cache key** is a hash of its `deps`, `params`, and `cmd` — unchanged stages are skipped on `dvc repro`, similar to how `make` skips up-to-date targets.
- This is what makes DVC pipelines genuinely reproducible: given the same code + data + params, `dvc repro` deterministically reproduces the same outputs (or skips work that's already been done).

## 🔬 DVC: Experiments, Metrics & Params

```yaml
# params.yaml
train:
  learning_rate: 0.01
  epochs: 50
```

```bash
# Run a tracked experiment (creates a lightweight, non-branch-polluting commit)
dvc exp run --set-param train.learning_rate=0.05

# Compare experiments
dvc exp show
dvc exp diff exp-abc123 exp-def456

# Promote a good experiment to a permanent branch
dvc exp branch exp-abc123 promising-lr

# Metrics/plots diffing across commits or experiments
dvc metrics diff main exp-abc123
dvc plots diff main exp-abc123
```

## ☁️ DVC: Remotes

```bash
# S3
dvc remote add -d myremote s3://bucket/path
dvc remote modify myremote region us-east-1

# GCS
dvc remote add -d myremote gs://bucket/path

# Azure
dvc remote add -d myremote azure://container/path

# SSH / on-prem storage
dvc remote add -d myremote ssh://user@host/path

# Local (e.g. shared NFS mount, or just for testing)
dvc remote add -d myremote /mnt/shared/dvc-store
```

```bash
# Multiple remotes: push/pull specific ones
dvc push -r myremote
dvc pull -r myremote

# Shared cache across projects/machines (avoid re-downloading identical files)
dvc cache dir /shared/dvc-cache
dvc config cache.shared group
```

## 🌊 lakeFS: Core Concepts

- **Repository** — wraps an existing object storage bucket/prefix; all lakeFS operations happen within a repo.
- **Branch** — a consistent, isolated view of the repo's data (like a Git branch) — creating one is a metadata operation, effectively instant and free of data copying (zero-copy branching).
- **Commit** — an immutable, named snapshot of a branch's state, with a commit hash, message, and metadata.
- **Merge** — combine changes from one branch into another, with conflict detection at the object level.
- **S3 Gateway** — lakeFS exposes an S3-compatible API, so most existing tools (Spark, Trino, Polars, pandas, `boto3`) can read/write `lakefs://repo/branch/path` as if it were a normal bucket, without code changes beyond the endpoint/URL.

```
lakefs://<repo>/<ref>/<path>
   ref = branch name, commit hash, or tag — this is the "time travel" axis
```

## 🚀 lakeFS: Setup and CLI

```bash
# Run locally via Docker (quickstart)
docker run --name lakefs -p 8000:8000 treeverse/lakefs run --quickstart

# Configure lakectl (CLI) — ~/.lakectl.yaml
# credentials: access_key_id / secret_access_key from the lakeFS setup UI

# Create a repository backed by an existing S3 bucket
lakectl repo create lakefs://my-repo s3://my-existing-bucket/lakefs-root

# Branching
lakectl branch create lakefs://my-repo/experiment-1 --source lakefs://my-repo/main
lakectl branch list lakefs://my-repo

# Upload, commit, diff
lakectl fs upload lakefs://my-repo/experiment-1/data/file.parquet -s ./file.parquet
lakectl commit lakefs://my-repo/experiment-1 -m "Add cleaned dataset"
lakectl diff lakefs://my-repo/main lakefs://my-repo/experiment-1

# Merge back once validated
lakectl merge lakefs://my-repo/experiment-1 lakefs://my-repo/main

# Tag a commit (e.g., "this is what shipped to prod")
lakectl tag create lakefs://my-repo/prod-2024-06-01 lakefs://my-repo/main
```

## 🐍 lakeFS: Python & S3-Compatible Access

```python
# Using boto3 / any S3 client — just point the endpoint at lakeFS
import boto3

s3 = boto3.client(
    's3',
    endpoint_url='http://localhost:8000',
    aws_access_key_id='AKIA...',
    aws_secret_access_key='...'
)
s3.upload_file('local.parquet', 'my-repo', 'main/data/local.parquet')

# Pandas / Polars can read straight from a lakeFS ref via the S3-compatible path
import pandas as pd
df = pd.read_parquet(
    's3://my-repo/main/data/orders.parquet',
    storage_options={
        'key': 'AKIA...', 'secret': '...',
        'client_kwargs': {'endpoint_url': 'http://localhost:8000'}
    }
)

# lakeFS's native Python client (higher-level, repo/branch/commit operations)
import lakefs

repo = lakefs.repository("my-repo")
branch = repo.branch("experiment-1").create(source_reference="main")
branch.object("data/file.csv").upload(data=open("file.csv", "rb"))
branch.commit(message="Add cleaned dataset")
repo.branch("main").merge_into("main", source_ref="experiment-1")
```

## 🪝 lakeFS: Hooks & CI/CD

```yaml
# .lakefs/hooks/validate_schema.yaml — pre-merge hook example
name: validate_parquet_schema
on:
  pre-merge:
    branches: ["main"]
hooks:
  - id: schema_check
    type: webhook
    properties:
      url: "https://ci.example.com/lakefs/validate-schema"
```

- **Pre-commit / pre-merge hooks** can block a merge into `main` unless data passes validation (schema checks, row-count sanity checks, format checks) — this is "CI for data," enforced at the storage layer.
- Typical pattern: **ETL writes to a branch → automated validation hook runs → merge to `main` only on success** — gives you atomic, all-or-nothing promotion of new data, so consumers never see a half-written dataset.

```bash
# CI pipeline pattern
lakectl branch create lakefs://repo/ci-$BUILD_ID --source lakefs://repo/main
spark-submit job.py --output lakefs://repo/ci-$BUILD_ID/output/
# hooks run automatically on merge attempt
lakectl merge lakefs://repo/ci-$BUILD_ID lakefs://repo/main
```

## 🔀 DVC vs lakeFS: When to Use Which

| | DVC | lakeFS |
| --- | --- | --- |
| Best fit | ML experiment tracking, small-to-mid teams, data tightly coupled to code/Git history | Data lake / lakehouse teams, large-scale pipelines, multiple tools writing to shared storage |
| Granularity | File/directory-level, tied to Git commits | Object-level, independent of any Git repo |
| Branching cost | Git branching (cheap) + data checkout (can be slow for big data) | Zero-copy, instant (metadata-only) regardless of data size |
| Tool integration | Python/CLI-centric, ML pipeline (`dvc.yaml`) support | S3-compatible — works with virtually any existing tool unmodified |
| Typical unit of work | A versioned dataset/model artifact per experiment | A versioned bucket/prefix used by many pipelines concurrently |

> They aren't mutually exclusive: some teams use DVC for ML experiment artifacts and lakeFS underneath the data lake those experiments read from.

## 🧠 Content Addressing Internals

```bash
# Inside a .dvc pointer file — this is the entire "version" of the data, as text in Git
cat data/raw/data.csv.dvc
```

```yaml
outs:
  - md5: a1b2c3d4e5f6...
    size: 154823421
    hash: md5
    path: data.csv
```

```bash
# The actual bytes live in the cache, addressed by their hash — not by filename
ls .dvc/cache/files/md5/a1/
# b2c3d4e5f6...   <- the real file, named only by the rest of its hash

# This is why checking out an old Git commit + `dvc checkout` is instant if the content
# already exists in cache: DVC just relinks/copies the cached object back into the workspace.
dvc checkout                 # restores working-tree files to match the current .dvc pointers
dvc gc -w                    # garbage-collect cache objects not referenced by the current workspace
dvc gc -a                    # garbage-collect objects not referenced by ANY branch/tag
```

- **Content addressing** (hash-of-content as the identifier) is what both DVC and lakeFS use under the hood — two commits that happen to contain byte-identical files automatically share storage, with zero extra logic required.
- This is also why **renaming a file without changing its content is nearly free** — the hash is unchanged, so no data is re-uploaded, only the pointer/metadata changes.
- lakeFS applies the same idea at the object-storage level: branching is instant because a new branch is just a new set of pointers into the same underlying, immutable objects — nothing is physically copied until something actually changes.

## 📚 DVC Data Registries & Import

```bash
# Treat a dedicated repo as a shared "data registry" other projects can pull specific versions from
# In the registry repo:
dvc add datasets/customer_master.csv
git tag v2024.06

# In a DOWNSTREAM project — import a specific version without copying history/pipeline code
dvc import https://github.com/org/data-registry.git datasets/customer_master.csv --rev v2024.06

# `dvc import` creates a .dvc file that tracks the SOURCE repo+revision — update later with:
dvc update customer_master.csv.dvc

# `dvc get` — one-off fetch without creating a tracked dependency (no .dvc file)
dvc get https://github.com/org/data-registry.git datasets/customer_master.csv -o local_copy.csv

# `dvc import-url` — track an external, non-DVC source (S3 path, HTTP URL) as a dependency
dvc import-url s3://public-bucket/reference/exchange_rates.csv data/exchange_rates.csv
```

- A **data registry repo** decouples "where data versions live" from "which project's pipeline code produced them" — multiple ML/analytics projects can depend on the same versioned reference dataset without duplicating it.
- `dvc import` (tracked, updatable) vs `dvc get` (one-shot copy) is the same distinction as a package dependency vs. downloading a file manually — use `import` when you want `dvc update` to later pull a newer registry version deliberately.

## 🏔️ lakeFS with Iceberg/Delta & Query Engines

```sql
-- Query a lakeFS branch directly from Trino/Spark by pointing at its S3-compatible path —
-- Iceberg/Delta tables work exactly as they would on a plain bucket, per-branch.
CREATE TABLE iceberg.sales.orders (order_id BIGINT, amount DECIMAL(10,2))
WITH (location = 's3a://my-repo/main/tables/orders');

-- Reading a DIFFERENT branch is just changing the ref segment of the path
SELECT * FROM iceberg.sales.orders_on_experiment;   -- catalog table pointed at s3a://my-repo/experiment-1/tables/orders
```

```python
# Spark reading/writing a lakeFS-backed Delta table
df = spark.read.format("delta").load("s3a://my-repo/main/tables/orders")

(df.withColumn("amount", df.amount * 1.1)
   .write.format("delta").mode("overwrite")
   .save("s3a://my-repo/experiment-1/tables/orders"))
```

- Because lakeFS exposes an **S3-compatible endpoint**, table formats that already understand S3 paths (Iceberg, Delta, Hudi) work with no format-specific integration work — you get branch/commit semantics on top of a lakehouse table for free.
- The main practical wrinkle: each table format's own metadata (Iceberg manifests, Delta `_delta_log`) is versioned *inside* the branch too, so merging two branches that both wrote to the same table needs the table format's own conflict handling, not just lakeFS's raw object diff.

## 🔗 DVC + lakeFS Combined Workflow

```bash
# A common pattern: lakeFS versions the raw/bronze lake data at scale; DVC versions the
# specific ML-ready extract + pipeline code that a model was trained on.

# 1. ETL reads from a specific lakeFS commit (reproducible input)
python extract.py --source "lakefs://my-repo/main/bronze/events@a1b2c3d" --out data/training_set.csv

# 2. DVC tracks the resulting training set + the code that produced it
dvc add data/training_set.csv
git add data/training_set.csv.dvc extract.py
git commit -m "Training set from lakeFS commit a1b2c3d"

# Now a single Git commit reproducibly points to BOTH:
#  - the exact lakeFS commit of the source lake data
#  - the exact DVC-tracked derived dataset used for training
```

## 🧪 CI/CD Patterns in Depth

```yaml
# GitHub Actions: reproduce a DVC pipeline and check for unexpected data drift on every PR
name: dvc-pipeline
on: [pull_request]
jobs:
  repro:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: iterative/setup-dvc@v1
      - run: dvc pull
      - run: dvc repro
      - run: dvc metrics diff --md main >> $GITHUB_STEP_SUMMARY
      - name: Fail if key metric regressed
        run: |
          python -c "
          import json, sys
          with open('metrics.json') as f: m = json.load(f)
          sys.exit(1 if m['accuracy'] < 0.85 else 0)
          "
```

```yaml
# lakeFS: gate a merge to main on a webhook validation hook, wired to a CI-run test suite
# .lakefs/hooks/validate.yaml
name: validate_before_merge
on: { pre-merge: { branches: ["main"] } }
hooks:
  - id: run_ci_checks
    type: webhook
    properties:
      url: "https://ci.example.com/api/lakefs-validate"
      timeout: 5m
```

- The DVC pattern above turns **model/data regressions into a CI-visible PR check**, the same way a failing unit test blocks a code PR — `dvc metrics diff` makes the comparison explicit in review.
- The lakeFS pattern makes **"can this data be promoted to `main`" a policy decision enforced by the platform**, not a convention that individual pipelines have to remember to follow.

## ⚠️ Common Gotchas

- **DVC pointer files must be committed to Git** — running `dvc add` alone doesn't version anything in Git history; forgetting `git add *.dvc && git commit` is the most common mistake.
- **`dvc pull` requires remote credentials configured** on every machine that needs the data — a fresh clone with no remote access will have `.dvc` pointer files but no actual data.
- **DVC cache can silently grow huge** — every version of every tracked file lives in `.dvc/cache` unless you run `dvc gc` to garbage-collect unreferenced objects.
- **lakeFS branches are cheap, but merges aren't automatic conflict resolution** — two branches modifying the same object path will still produce a conflict that needs manual resolution, just like Git.
- **lakeFS is a metadata/versioning layer, not a copy of your data** — deleting the underlying bucket (or misconfiguring the storage namespace) breaks every repo built on it; back up the underlying object store as you normally would.
- **Zero-copy branching means `main` and a branch can share underlying objects** — deleting objects directly in the bucket (bypassing lakeFS) can corrupt other branches referencing them; always mutate through lakeFS, not the raw bucket.

## 🎯 Best Practices

- Pair every DVC data version with a Git commit/tag so "code + data" can always be checked out together as one reproducible unit.
- Use `dvc.yaml` pipelines instead of ad-hoc scripts for anything with more than one processing stage — you get caching and a DAG for free.
- In lakeFS, treat `main` as protected — write to a feature/ingestion branch, validate with hooks, then merge, rather than writing directly to `main`.
- Tag lakeFS commits that correspond to production releases (`prod-2024-06-01`) so you can always reproduce "what data was live when."
- Periodically run `dvc gc` (with `-c` to also clean remote storage) to control storage costs from accumulated experiment artifacts.

## 💡 Pro Tips

1. **`dvc exp run` experiments don't pollute Git history** until you explicitly promote one with `dvc exp branch` — run dozens of variations freely.
2. **lakeFS's zero-copy branching makes "give every ETL job its own branch" cheap** — isolate every pipeline run and only merge on success, eliminating partial-write visibility entirely.
3. **`dvc dag` is a fast sanity check** before a big `dvc repro` — confirm the pipeline shape matches what you expect.
4. **lakeFS `FOR ... AS OF` style time travel plus a query engine (Trino/Spark) lets you query any historical branch/commit** exactly like querying a normal path — no special historical-query syntax needed.
5. **Use lakeFS hooks as your data contract enforcement point** — schema checks, null-rate checks, and row-count deltas can all block a bad merge before consumers ever see it.
6. **DVC remotes can be layered** — a fast local/shared cache plus a slower durable cloud remote, configured via multiple `dvc remote add` entries.
