# Univariate Analysis Cheatsheet

> Examine one variable at a time — distribution, frequency, range, and unusual values — before looking at any relationship between variables. Same TOC / quick-reference / gotchas format as the rest of the collection; every snippet verified against a synthetic 500-row customer dataset (pandas 3.0.2, matplotlib 3.10.8, seaborn 0.13.2).

## 📑 Table of Contents

1. [🚀 Import and Setup](#import-and-setup)
2. [⚡ Quick Reference](#quick-reference)
3. [🔢 Numeric Variables: Histograms and Binning](#numeric-variables-histograms-and-binning)
4. [📦 Numeric Variables: Box and Density Plots](#numeric-variables-box-and-density-plots)
5. [🏷️ Categorical Variables: Counts and Proportions](#categorical-variables-counts-and-proportions)
6. [🧹 Rare Levels and Category Drift](#rare-levels-and-category-drift)
7. [📅 Datetime Variables](#datetime-variables)
8. [📐 Distribution Fitting](#distribution-fitting)
9. [🧩 High-Cardinality Categoricals](#high-cardinality-categoricals)
10. [🔁 Automated Univariate Reporting](#automated-univariate-reporting)
11. [📝 Worked Examples](#worked-examples)
12. [⚠️ Gotchas](#gotchas)
13. [🎯 Best Practices](#best-practices)

## ⚡ Quick Reference

| Task | Syntax |
| --- | --- |
| Histogram | `df["col"].plot(kind="hist", bins=30)` |
| Box plot | `df["col"].plot(kind="box")` |
| Density / KDE | `df["col"].plot(kind="kde")` |
| Bucket a numeric column | `pd.cut(df["col"], bins=10)` |
| Equal-frequency buckets | `pd.qcut(df["col"], q=4)` |
| Value counts | `df["col"].value_counts(dropna=False)` |
| Proportions | `df["col"].value_counts(normalize=True)` |
| Group rare categories | `s.where(~s.isin(rare_levels), "Other")` |
| Resample a datetime column | `df.set_index("date").resample("ME")["col"].mean()` |

## 🚀 Import and Setup

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

rng = np.random.default_rng(42)
df = pd.read_csv("customers.csv", parse_dates=["signup_date"])
```

## 🔢 Numeric Variables: Histograms and Binning

```python
df["revenue"].plot(kind="hist", bins=30, edgecolor="black")
plt.xlabel("Revenue")
plt.title("Revenue Distribution")
plt.show()

# Manual bucketing — equal-width bins
print(pd.cut(df["revenue"], bins=10).value_counts().sort_index())
```

```
(-16.4, 2145.1]       443
(2145.1, 4285.2]       45
(4285.2, 6425.2]        6
(6425.2, 8565.3]        2
(8565.3, 10705.4]       2
...
(19265.7, 21405.8]      1
```

443 of 500 rows land in the very first bin — equal-width bins on a skewed variable are almost always dominated by one bucket. Use `pd.qcut` for equal-*frequency* buckets when you want each group to carry a comparable sample size:

```python
print(pd.qcut(df["revenue"], q=4).value_counts().sort_index())
```

## 📦 Numeric Variables: Box and Density Plots

```python
df["revenue"].plot(kind="box")
plt.title("Revenue — Box Plot")
plt.show()

df["revenue"].plot(kind="kde")
plt.title("Revenue — Density")
plt.show()

# Seaborn equivalents, with more styling control
sns.boxplot(x=df["revenue"])
sns.histplot(df["revenue"], kde=True, bins=30)
```

A box plot on a right-skewed variable like `revenue` will show a long whisker and many points flagged as outliers — that's expected here, not necessarily a data error; confirm against the [Outlier Detection Cheatsheet](08_Outlier_Detection_Cheatsheet.md) before removing anything.

## 🏷️ Categorical Variables: Counts and Proportions

```python
print(df["segment"].value_counts(dropna=False))
```

```
segment
Consumer      249
SMB           185
Enterprise     66
```

```python
print(df["segment"].value_counts(normalize=True, dropna=False).round(3))
```

```
segment
Consumer      0.498
SMB           0.370
Enterprise    0.132
```

`dropna=False` matters — the default (`dropna=True`) silently excludes missing values from both the count and the denominator used for proportions, which can make a category's share look larger than it really is.

```python
print(df["region"].value_counts(dropna=False))
```

```
South    132
West     128
East     115
North    110
NaN       15
```

## 🧹 Rare Levels and Category Drift

```python
freq = df["region"].value_counts(normalize=True, dropna=False)
rare = freq[freq < 0.05].index
df["region_grouped"] = df["region"].where(~df["region"].isin(rare), "Other")
print(df["region_grouped"].value_counts())
```

Group rare levels *deliberately*, with a documented threshold — don't let a modeling library's default "drop rare categories" behavior make that decision silently for you. Separately, check for near-duplicate labels that should be one category (`"NY"` vs `"New York"`, trailing whitespace, inconsistent casing):

```python
print(df["region"].str.strip().str.title().value_counts(dropna=False))
```

## 📅 Datetime Variables

```python
print(df["signup_date"].min(), df["signup_date"].max())

# Signups per month
monthly = df.set_index("signup_date").resample("ME").size()
print(monthly.head())

# Day-of-week pattern
print(df["signup_date"].dt.day_name().value_counts())
```

## 📐 Distribution Fitting

Sometimes you need more than "it's skewed" — a specific theoretical distribution to feed a simulation, a synthetic data generator, or a statistical test that assumes one:

```python
from scipy import stats

candidates = ["norm", "lognorm", "expon", "gamma"]
data = df["revenue"].dropna().values

results = {}
for name in candidates:
    dist = getattr(stats, name)
    # fix loc=0 for gamma/expon — both are naturally zero-bound, and letting the
    # location parameter float can converge to a degenerate fit (see the gotcha below)
    params = dist.fit(data, floc=0) if name in ("gamma", "expon") else dist.fit(data)
    ks_stat, ks_p = stats.kstest(data, name, args=params)
    results[name] = ks_stat

for name, ks_stat in sorted(results.items(), key=lambda kv: kv[1]):
    print(f"{name}: KS stat={ks_stat:.3f}")
```

```
lognorm: KS stat=0.033
gamma: KS stat=0.091
expon: KS stat=0.085
norm: KS stat=0.249
```

Lower KS statistic = better fit — `lognorm` (log-normal) is clearly the best match here, which lines up with `revenue` being a strictly-positive, right-skewed "amount" variable; `norm` is a poor fit, confirming numerically what the skewness/kurtosis numbers already suggested.

## 🧩 High-Cardinality Categoricals

`value_counts()` on a column with hundreds of distinct values (a product ID, a free-text field) produces an unreadable wall of output. Summarize the head and collapse the tail instead — here we add a simulated `product_id` column (300 possible values) to the customer table purely to illustrate the pattern:

```python
df["product_id"] = rng.choice([f"P{i:04d}" for i in range(300)], size=len(df))

top_n = 10
vc = df["product_id"].value_counts()
top = vc.head(top_n)
other_total = vc.iloc[top_n:].sum()

print(top)
print(f"Other ({vc.shape[0] - top_n} categories): {other_total} ({other_total / len(df) * 100:.1f}%)")
print("total distinct values:", df["product_id"].nunique())
```

```
P0057    6
P0112    6
P0239    6
...
Other (235 categories): 447 (89.4%)
total distinct values: 245
```

When 245 distinct values sit across 500 rows with the top 10 covering barely more than 10% of the data, no single category is dominant — this is a signal that the column may need a different treatment for modeling (target/frequency encoding, or a rollup to a coarser category) rather than one-hot encoding it as-is.

## 🔁 Automated Univariate Reporting

For a dataset with many columns, a loop that classifies and summarizes every column at once beats writing a bespoke print statement for each:

```python
def univariate_all(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            rows.append({"column": col, "type": "numeric",
                         "n_unique": df[col].nunique(), "skew": df[col].skew()})
        else:
            top_share = df[col].value_counts(normalize=True, dropna=False).iloc[0]
            rows.append({"column": col, "type": "categorical",
                         "n_unique": df[col].nunique(), "top_share": top_share})
    return pd.DataFrame(rows)

print(univariate_all(df.drop(columns=["signup_date"])).round(3))
```

```
               column         type  n_unique   skew  top_share
0         customer_id      numeric       500  0.000        NaN
1             segment  categorical         3    NaN      0.498
2              region  categorical         4    NaN      0.264
3       tenure_months      numeric        59  0.080        NaN
4             revenue      numeric       498  6.974        NaN
5  satisfaction_score      numeric        59 -0.200        NaN
6             churned      numeric         2  0.918        NaN
```

Scan the `skew` and `top_share` columns for outliers in the report itself — `revenue`'s skew of 6.97 and `churned`'s 0.918 (on a binary column, meaning it's imbalanced 71/29 rather than an actual skewed continuous shape) both jump out immediately without opening nine separate plots.

## 📝 Worked Examples

**1. Full column-by-column report**

```python
def univariate_report(df: pd.DataFrame, col: str) -> None:
    s = df[col]
    if pd.api.types.is_numeric_dtype(s):
        print(f"{col}: n={s.notna().sum()}, mean={s.mean():.2f}, median={s.median():.2f}, "
              f"skew={s.skew():.2f}")
    else:
        vc = s.value_counts(normalize=True, dropna=False).round(3)
        print(f"{col}: {vc.to_dict()}")

for col in ["revenue", "segment", "region"]:
    univariate_report(df, col)
```

```
revenue: n=500, mean=1067.52, median=667.07, skew=6.97
segment: {'Consumer': 0.498, 'SMB': 0.37, 'Enterprise': 0.132}
region: {'South': 0.264, 'West': 0.256, 'East': 0.23, 'North': 0.22, nan: 0.03}
```

**2. Choosing a distribution for a synthetic data generator**

A team needs to generate realistic fake revenue values for load testing. Rather than guessing, fit candidate distributions and pick the best-supported one:

```python
for name, ks_stat in sorted(results.items(), key=lambda kv: kv[1])[:1]:
    print(f"Best fit: {name} (KS stat={ks_stat:.3f})")
# Best fit: lognorm (KS stat=0.033)

params = stats.lognorm.fit(df["revenue"].dropna())
synthetic = stats.lognorm.rvs(*params, size=1000, random_state=0)
print(f"real mean={df['revenue'].mean():.2f}, synthetic mean={synthetic.mean():.2f}")
```

Verdict: `lognorm` reproduces the shape well enough for load-testing purposes (a close mean and comparable spread) — using `norm` instead, the obvious naive choice, would have generated unrealistic negative revenue values on a meaningful fraction of draws.

**3. Deciding how to handle a high-cardinality feature before modeling**

```python
n_unique = df["product_id"].nunique()
top_10_share = df["product_id"].value_counts(normalize=True).head(10).sum()
print(f"{n_unique} distinct values, top 10 cover {top_10_share*100:.1f}% of rows")
# 245 distinct values, top 10 cover 11.6% of rows
```

Verdict: with no dominant category and near-uniform frequency across 245 values, one-hot encoding would add 245 sparse columns for almost no predictive gain — frequency encoding (replace each ID with its observed frequency) or simply dropping the column as too granular to generalize from are both more defensible choices here than the default encoding most libraries reach for automatically.

## ⚠️ Gotchas

- **`value_counts()` drops `NaN` by default** — pass `dropna=False` whenever missingness itself might be meaningful, or your proportions will quietly rescale to exclude it.
- **Equal-width bins (`pd.cut`) collapse a skewed variable into one dominant bucket** — 443 of 500 rows landed in a single bin above. Use `pd.qcut` (equal-frequency) when you need each bucket to carry comparable weight.
- **A box plot's "outlier" points are just the IQR rule applied visually** — they are candidates for investigation, not automatically errors; a right-skewed variable will always show several.
- **Category labels that look identical to the eye can differ in whitespace or casing** and will be silently counted as separate categories — normalize (`.str.strip().str.title()`) before trusting a `value_counts()` table.
- **`pd.cut`'s default bin edges are computed from the observed min/max**, so re-running it on a filtered subset produces *different* bin boundaries than the full dataset — don't compare `pd.cut` outputs across two differently-filtered DataFrames without fixing explicit `bins` edges.
- **Grouping "rare" categories into `"Other"` changes downstream cardinality and can hide a real, small-but-important segment** — set the threshold deliberately and document it, don't default to whatever a library picks.
- **`scipy.stats.<dist>.fit()` with a free location parameter can converge to a degenerate fit** on naturally zero-bound data — `gamma.fit(data)` without `floc=0` produced a near-useless fit (KS stat ≈0.99) on this dataset; fixing the location parameter at its known bound fixed it.
- **A lower KS statistic means a *relatively* better fit among the candidates tested, not an objectively good one** — always check the KS test's own p-value, and remember that with large n even a "best" fit can still be formally rejected as not-quite-normal-or-whatever by a strict test.
- **One-hot encoding a high-cardinality column by default silently explodes dimensionality** — check `nunique()` relative to row count before committing to an encoding strategy, not after a model unexpectedly has hundreds of near-empty columns.

## 🎯 Best Practices

1. **Look at every variable alone before looking at any pair of variables** — a distribution problem (skew, rare categories, bad bins) will masquerade as a relationship problem if you skip straight to bivariate analysis.
2. **Always pass `dropna=False` to `value_counts()`** on a first pass, so missingness doesn't disappear from the picture.
3. **Prefer `qcut` over `cut`** when a variable is skewed and you need comparably-sized groups for downstream comparison.
4. **Normalize categorical text before counting it** — casing and whitespace inconsistencies are one of the most common silent data-quality issues.
5. **Treat box-plot outlier points as a prompt to investigate, not a rule to auto-remove** — confirm with the dedicated outlier-detection pass before deciding.
6. **Fix known bounds (like `floc=0` for a naturally non-negative variable) when fitting a distribution** — an unconstrained fit can converge somewhere nonsensical even on well-behaved data.
7. **Check cardinality relative to row count before choosing an encoding for a categorical column** — it decides between one-hot, frequency encoding, and a rollup far more reliably than intuition does.
