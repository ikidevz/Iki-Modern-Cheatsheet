# Data Overview Cheatsheet

> The first-contact checklist for any new dataset: grain, shape, schema, and structural sanity checks — before you interpret a single number. Built in the same TOC / quick-reference / gotchas format as the rest of the collection; every snippet below was run against a synthetic 500-row customer dataset (pandas 3.0.2) to confirm real output.

## 📑 Table of Contents

1. [🚀 Import and Setup](#import-and-setup)
2. [⚡ Quick Reference](#quick-reference)
3. [📏 Shape, Schema, and dtypes](#shape-schema-and-dtypes)
4. [🔑 Grain and Uniqueness](#grain-and-uniqueness)
5. [👀 Previewing Rows](#previewing-rows)
6. [🗂️ Column Type Inventory](#column-type-inventory)
7. [🧬 Duplicate Rows](#duplicate-rows)
8. [🚧 Impossible and Out-of-Range Values](#impossible-and-out-of-range-values)
9. [💾 Memory Footprint](#memory-footprint)
10. [🔢 Cardinality Scan](#cardinality-scan)
11. [🔗 Multi-Table Grain and Join-Key Checks](#multi-table-grain-and-join-key-checks)
12. [🔬 Automated Profiling Tools](#automated-profiling-tools)
13. [🐘 Overview at Scale: Large Files](#overview-at-scale-large-files)
14. [🕰️ Schema Drift Detection](#schema-drift-detection)
15. [📝 Worked Examples](#worked-examples)
16. [⚠️ Gotchas](#gotchas)
17. [🎯 Best Practices](#best-practices)

## ⚡ Quick Reference

| Task | Syntax |
| --- | --- |
| Shape | `df.shape` |
| dtypes | `df.dtypes` |
| Full schema + non-null counts | `df.info()` |
| First / last rows | `df.head()` / `df.tail()` |
| Column names | `df.columns.tolist()` |
| Is a column a valid key? | `df["id"].is_unique` |
| Duplicate rows | `df.duplicated().sum()` |
| Numeric / categorical / datetime split | `df.select_dtypes(include="number")` etc. |
| Distinct value counts per column | `df.nunique()` |
| Memory usage | `df.memory_usage(deep=True).sum()` |
| Row count with a filter | `df.query("revenue < 0").shape[0]` |

## 🚀 Import and Setup

```python
import pandas as pd
import numpy as np

pd.set_option("display.max_columns", 100)
pd.set_option("display.width", 120)
pd.set_option("display.float_format", lambda x: f"{x:,.2f}")

df = pd.read_csv("customers.csv", parse_dates=["signup_date"])
```

## 📏 Shape, Schema, and dtypes

```python
print(df.shape)          # (500, 8) -> (rows, columns)
print(df.dtypes)
df.info()                 # dtypes + non-null counts + memory, in one call
```

`df.info()` is usually the single most useful first call — it gives you row count, per-column non-null counts (a free first look at missingness), dtypes, and total memory in one shot:

```
<class 'pandas.DataFrame'>
RangeIndex: 500 entries, 0 to 499
Data columns (total 8 columns):
 #   Column              Non-Null Count  Dtype
---  ------              --------------  -----
 0   customer_id         500 non-null    int64
 1   signup_date         500 non-null    datetime64[us]
 2   segment             500 non-null    str
 3   region              485 non-null    str
 4   tenure_months       500 non-null    float64
 5   revenue             500 non-null    float64
 6   satisfaction_score  460 non-null    float64
 7   churned             500 non-null    int64
dtypes: datetime64[us](1), float64(3), int64(2), str(2)
memory usage: 31.4 KB
```

The gap between `Non-Null Count` and the total row count (`region`: 485/500, `satisfaction_score`: 460/500) is your first missing-data signal — chase it further in the [Missing Values Analysis Cheatsheet](02_Missing_Values_Analysis_Cheatsheet.md).

## 🔑 Grain and Uniqueness

Before anything else, confirm what one row *means* and whether the candidate key actually behaves like one.

```python
# Is the presumed key column actually unique?
print(df["customer_id"].is_unique)          # True

# Any exact duplicate rows across every column?
print(df.duplicated().sum())                # 0

# Any duplicates on the key alone (even if other columns differ)?
print(df.duplicated(subset=["customer_id"]).sum())   # 0

# Composite-key grain check (e.g. one row per customer per month)
print(df.duplicated(subset=["customer_id", "signup_date"]).sum())
```

If the grain isn't what you assumed (e.g. multiple rows per customer instead of one), every downstream aggregate is wrong until you fix it — this check comes before descriptive statistics, not after.

## 👀 Previewing Rows

```python
df.head(5)
df.tail(5)
df.sample(5, random_state=42)   # random rows are often more revealing than the first 5
```

`head()` alone can hide sorting artifacts (e.g. a file sorted by signup date will show only early-2023 rows) — pair it with `.sample()`.

## 🗂️ Column Type Inventory

```python
numeric_cols = df.select_dtypes(include="number").columns.tolist()
datetime_cols = df.select_dtypes(include="datetime").columns.tolist()

# pandas 3.x: the default string dtype is now 'str', not 'object' — include both
# for compatibility across pandas 2.x and 3.x codebases
categorical_cols = df.select_dtypes(include=["str", "object", "category"]).columns.tolist()

print(numeric_cols)      # ['customer_id', 'tenure_months', 'revenue', 'satisfaction_score', 'churned']
print(categorical_cols)  # ['segment', 'region']
print(datetime_cols)     # ['signup_date']
```

Flag likely identifiers, targets, and timestamps explicitly rather than leaving everything as "numeric" — `customer_id` and `churned` are both `int64` here but play completely different analytical roles.

## 🧬 Duplicate Rows

```python
# Exact duplicates
dupes = df[df.duplicated(keep=False)]
print(len(dupes))

# Near-duplicates on a business key, ignoring a volatile column like a timestamp
business_dupes = df[df.duplicated(subset=["customer_id"], keep=False)]
```

## 🚧 Impossible and Out-of-Range Values

Cheap checks that catch upstream data bugs before they contaminate statistics:

```python
print((df["tenure_months"] < 0).sum())          # negative tenure — should be 0
print((df["revenue"] < 0).sum())                # negative revenue — should be 0
print((df["satisfaction_score"] > 10).sum())    # score should be capped at 10
print(df["signup_date"].max() > pd.Timestamp.now())   # future-dated signups
```

## 💾 Memory Footprint

```python
print(df.memory_usage(deep=True))
print(df.memory_usage(deep=True).sum() / 1024**2, "MB")
```

`deep=True` is required to get accurate memory for string/object columns — without it, pandas reports only the pointer size, not the actual string content, which can understate memory by an order of magnitude on text-heavy data.

## 🔢 Cardinality Scan

```python
print(df.nunique().sort_values())
```

```
churned                 2
segment                 3
region                  4
tenure_months          59
satisfaction_score     59
revenue               498
customer_id           500
signup_date            500
```

A quick way to spot candidate keys (cardinality ≈ row count), likely categoricals (low cardinality relative to row count), and columns that are secretly constants (cardinality of 1, which contributes nothing and can usually be dropped).

## 🔗 Multi-Table Grain and Join-Key Checks

A single-table overview isn't enough once your "dataset" is really several tables joined together — the grain and key checks above need to happen *across* tables too, before you trust any joined result.

```python
# orders: one row per order, foreign key back to customers
print(orders["order_id"].is_unique)                       # True — orders has its own clean grain

# Orphan foreign keys: order rows pointing at a customer_id that doesn't exist
orphans = orders[~orders["customer_id"].isin(df["customer_id"])]
print(len(orphans))                                        # 5 -> a real referential-integrity problem

# Join cardinality (fan-out) check: how many order rows does each customer contribute?
merged = df.merge(orders, on="customer_id", how="left")
print(merged.shape, df.shape, orders.shape)                 # (1243, 11) vs (500, 8) vs (1200, 4)
print(merged["customer_id"].value_counts().describe())
```

```
count    500.000000
mean       2.486000
std        1.473141
min        1.000000
25%        1.000000
50%        2.000000
75%        3.000000
max        8.000000
```

Two separate findings here, both invisible from either table alone: 5 orders reference a `customer_id` that doesn't exist in the customer table (a referential-integrity bug to chase down before trusting any join), and the join legitimately fans out from 500 customer rows to 1,243 rows — expected for a one-to-many relationship, but exactly the kind of row-count change that silently breaks a downstream `groupby` if you forget it happened.

## 🔬 Automated Profiling Tools

For a first-pass, whole-table scan, an automated profiler is faster than writing the checks above by hand — treat its output as a starting map, not a final report:

```python
from ydata_profiling import ProfileReport   # note: see the gotcha below on this package's naming

profile = ProfileReport(df, minimal=True, title="Customer Dataset Overview")
profile.to_file("overview_report.html")
```

`minimal=True` skips the most expensive parts (deep correlation/interaction analysis) — drop it for a small table where you want the full report, keep it for anything with enough rows or columns that the full report would be slow. `sweetviz` is a common alternative with a side-by-side comparison mode (`sv.compare(df_a, df_b)`) that's particularly good for exactly the schema-drift and drift-detection use cases below.

## 🐘 Overview at Scale: Large Files

The checks above assume the file fits comfortably in memory. Once it doesn't, adjust the *method*, not the *questions* — you still want shape, schema, grain, and missingness, just computed without loading everything at once:

```python
# Read only the header first to check schema before committing to a full load
print(pd.read_csv("large_file.csv", nrows=0).columns.tolist())

# Chunked reading: accumulate the checks you care about without holding it all in memory
chunk_missing = None
total_rows = 0
for chunk in pd.read_csv("large_file.csv", chunksize=100_000):
    total_rows += len(chunk)
    chunk_missing = chunk.isna().sum() if chunk_missing is None else chunk_missing + chunk.isna().sum()
print(total_rows, chunk_missing)

# Polars' lazy scan avoids loading the file at all until you .collect()
import polars as pl
lf = pl.scan_csv("large_file.csv")
print(lf.select(pl.len()).collect())          # row count without a full load
print(lf.head(5).collect())                    # cheap preview
```

## 🕰️ Schema Drift Detection

Recurring data drops ("the same" file, delivered monthly) drift more often than teams expect — a column gets silently renamed, retyped, added, or dropped upstream. Diff the schema explicitly rather than assuming this month's file matches last month's:

```python
def schema_diff(old: pd.DataFrame, new: pd.DataFrame) -> None:
    old_types, new_types = old.dtypes.astype(str), new.dtypes.astype(str)
    old_cols, new_cols = set(old_types.index), set(new_types.index)

    print("added columns:", new_cols - old_cols)
    print("removed columns:", old_cols - new_cols)

    common = old_cols & new_cols
    changed = {c: (old_types[c], new_types[c]) for c in common if old_types[c] != new_types[c]}
    print("dtype changed:", changed)

schema_diff(previous_month_df, df)
# added columns: {'tenure_months'}
# removed columns: {'tenure_mo'}
# dtype changed: {'revenue': ('float32', 'float64')}
```

A renamed column (`tenure_mo` → `tenure_months`) shows up as one column "added" and one "removed" — a human still needs to confirm whether that's a rename or a genuine schema change; the diff narrows down *where* to look, it doesn't resolve the ambiguity on its own.

## 📝 Worked Examples

**1. First 5 minutes with a new dataset**

```python
def quick_overview(df: pd.DataFrame) -> None:
    print(f"Shape: {df.shape}")
    print(f"Duplicate rows: {df.duplicated().sum()}")
    print(f"Memory: {df.memory_usage(deep=True).sum() / 1024**2:.2f} MB")
    print("\nMissingness:")
    miss = df.isna().sum()
    print(miss[miss > 0].sort_values(ascending=False))
    print("\nCardinality:")
    print(df.nunique().sort_values())
    print("\ndtypes:")
    print(df.dtypes)

quick_overview(df)
```

Running this against the sample data surfaces, in under a second: no duplicate rows, `region` and `satisfaction_score` have missing values worth investigating, `customer_id` is a clean key, and `segment`/`region`/`churned` are the low-cardinality columns worth treating as categorical.

**2. Onboarding a new multi-table dataset (customers + orders)**

A fresh `orders.csv` lands alongside the customer table. Before joining anything: check each table's own grain, then the relationship between them.

```python
print(orders["order_id"].is_unique)                                      # True: orders has a clean key
print((~orders["customer_id"].isin(df["customer_id"])).sum())            # 5 orphaned foreign keys
print(df.merge(orders, on="customer_id", how="left").shape)              # (1243, 11): confirms the fan-out
```

Verdict: safe to join, but flag the 5 orphan rows to the source-system owner before the join — a plain `how="inner"` join would have silently dropped them with no warning, quietly shrinking the order total.

**3. Diagnosing a monthly schema drift**

A dashboard breaks after this month's data refresh. Instead of debugging blind, diff the schema first:

```python
schema_diff(last_months_df, this_months_df)
# dtype changed: {'revenue': ('float32', 'float64')}
```

Verdict: `revenue` silently widened from `float32` to `float64` upstream — harmless for values, but it doubled that column's memory footprint and was enough to change a downstream `groupby().sum()`'s output dtype, which is what actually broke the dashboard's formatting.

## ⚠️ Gotchas

- **`df.info()` non-null counts are a byproduct, not a substitute, for a real missingness pass** — it tells you *that* something is missing, not *why*, and doesn't show missingness by group.
- **pandas 3.x changed the default string dtype from `object` to `str`** — code written for pandas 2.x that does `select_dtypes(include="object")` will silently miss every string column on pandas 3.x; include both, or pin to `"str"` explicitly once you know your pandas major version.
- **`.head()` on a sorted or partitioned file gives a biased preview** — always pair it with `.sample()` before assuming you've "seen" the data.
- **`memory_usage()` without `deep=True` undercounts object/string columns** — it reports the size of the pointers, not the strings themselves.
- **A unique-looking key column can still hide duplicate business records** — `customer_id` being unique doesn't mean the same real-world customer wasn't given two IDs; cross-check against a natural key (email, external ID) when one exists.
- **`df.duplicated()` only catches exact row matches** — trailing whitespace, inconsistent casing, or a `NaN` vs `None` mismatch in one column will hide a duplicate from you.
- **The profiling library has been renamed twice** — `pandas-profiling` → `ydata-profiling` → `fg-data-profiling` (current as of 2026). `pip install ydata-profiling` still works but is the deprecated name; new code should install `fg-data-profiling` and `import data_profiling`.
- **A left join's row-count change is easy to miss** — `df.merge(orders, how="left")` growing from 500 to 1,243 rows is expected fan-out, not a bug, but forgetting it happened is exactly how a later `groupby().sum()` ends up double-counting.
- **An inner join silently drops orphaned foreign keys** — the 5 orphan rows in the worked example would vanish with no error under `how="inner"`; check for orphans with an anti-join (`~fk.isin(other_table[key])`) before choosing the join type.
- **Chunked reading requires you to combine partial results yourself** — `chunk.isna().sum()` per chunk needs an explicit running total; there's no built-in accumulator, so a forgotten `+=` silently reports only the last chunk's counts.

## 🎯 Best Practices

1. **Do the overview before anything else** — every later EDA step inherits whatever grain and schema assumptions you make here.
2. **Write down the grain explicitly** ("one row = one customer as of signup") — it's easy to assume and easy to get subtly wrong.
3. **Treat `df.info()`'s non-null gaps as a to-do list**, not a finding — they point you at the missing-values pass, they don't replace it.
4. **Classify columns by role, not just dtype** — identifier, target, timestamp, feature — before doing anything statistical.
5. **Re-run the overview after every major transformation** — a join, a filter, or a reshape can silently change the grain or reintroduce duplicates.
6. **Check grain and referential integrity across tables, not just within one** — a join is only as trustworthy as the orphan-key check you ran before it.
7. **Diff the schema explicitly on every recurring data drop** — "the same file as last month" is an assumption, not a guarantee, and it's cheap to verify.
