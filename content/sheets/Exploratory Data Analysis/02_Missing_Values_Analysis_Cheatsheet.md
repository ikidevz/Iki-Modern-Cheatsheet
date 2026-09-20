# Missing Values Analysis Cheatsheet

> Quantify missingness, reason about *why* it's missing before deciding what to do about it, then treat it deliberately. Same TOC / quick-reference / gotchas format as the rest of the collection; every snippet verified against a synthetic 500-row customer dataset with real injected missingness (pandas 3.0.2, scipy 1.17.1).

## 📑 Table of Contents

1. [🚀 Import and Setup](#import-and-setup)
2. [⚡ Quick Reference](#quick-reference)
3. [🔍 Quantifying Missingness](#quantifying-missingness)
4. [🧠 Missingness Mechanisms: MCAR, MAR, MNAR](#missingness-mechanisms-mcar-mar-mnar)
5. [🧪 Probing the Mechanism](#probing-the-mechanism)
6. [🗑️ Treatment: Deletion](#treatment-deletion)
7. [🧩 Treatment: Imputation](#treatment-imputation)
8. [🚩 Missingness Indicators](#missingness-indicators)
9. [📅 Time-Aware Fill](#time-aware-fill)
10. [🖼️ Visualizing Missingness](#visualizing-missingness)
11. [📈 A Multivariate MAR Probe](#a-multivariate-mar-probe)
12. [🔁 Multiple Imputation (MICE)](#multiple-imputation-mice)
13. [📝 Worked Examples](#worked-examples)
14. [⚠️ Gotchas](#gotchas)
15. [🎯 Best Practices](#best-practices)

## ⚡ Quick Reference

| Task | Syntax |
| --- | --- |
| Count missing per column | `df.isna().sum()` |
| Percent missing per column | `df.isna().mean() * 100` |
| Rows with any missing value | `df[df.isna().any(axis=1)]` |
| Drop rows with any missing | `df.dropna()` |
| Drop columns above a missing threshold | `df.dropna(axis=1, thresh=int(0.9 * len(df)))` |
| Fill with a constant | `df["col"].fillna(0)` |
| Fill with group-wise median | `df.groupby("g")["col"].transform(lambda s: s.fillna(s.median()))` |
| Forward / back fill | `df["col"].ffill()` / `df["col"].bfill()` |
| Add a missingness indicator | `df["col"].isna().astype(int)` |
| Chi-square test: is missingness related to a category? | `scipy.stats.chi2_contingency(pd.crosstab(missing_flag, category))` |

## 🚀 Import and Setup

```python
import pandas as pd
import numpy as np
from scipy.stats import chi2_contingency

df = pd.read_csv("customers.csv", parse_dates=["signup_date"])
```

## 🔍 Quantifying Missingness

```python
missing = df.isna().sum().rename("missing").to_frame()
missing["missing_pct"] = (missing["missing"] / len(df) * 100).round(2)
missing = missing[missing["missing"] > 0].sort_values("missing_pct", ascending=False)
print(missing)
```

```
                    missing  missing_pct
satisfaction_score       40         8.00
region                   15         3.00
```

That's the raw scale of the problem. The percentage alone doesn't tell you whether it's safe to drop, safe to impute, or a red flag — that depends on the *mechanism*, next.

## 🧠 Missingness Mechanisms: MCAR, MAR, MNAR

| Mechanism | Meaning | Example | Implication |
| --- | --- | --- | --- |
| **MCAR** (Missing Completely At Random) | Missingness is unrelated to any observed or unobserved value | A survey response lost to a random upload glitch | Safe to drop or simple-impute — no systematic bias introduced |
| **MAR** (Missing At Random) | Missingness depends on *other observed* columns, not the missing value itself | Newer signups haven't had time to submit a satisfaction score yet | Group-wise or model-based imputation using the related column is appropriate |
| **MNAR** (Missing Not At Random) | Missingness depends on the *unobserved value itself* | Dissatisfied customers are less likely to fill in a satisfaction survey at all | Dropping or naively imputing biases the result toward the observed (happier) subset — needs explicit modeling or a missingness indicator |

The label matters more than the percentage: 3% MNAR missingness can distort a result more than 30% MCAR missingness.

## 🧪 Probing the Mechanism

You can't prove MNAR from the data alone (by definition, you don't observe the missing values), but you *can* test whether missingness correlates with other observed columns — evidence for or against MAR.

```python
# Does satisfaction_score go missing more in some segments than others?
miss_flag = df["satisfaction_score"].isna().astype(int)
print(pd.crosstab(miss_flag, df["segment"], normalize="index").round(3))

# Formal test: is missingness independent of segment?
ct = pd.crosstab(miss_flag, df["segment"])
chi2, p, dof, expected = chi2_contingency(ct)
print(f"chi2={chi2:.2f}, p={p:.3f}")   # chi2=1.29, p=0.525 -> no significant association here
```

A significant p-value here is evidence of MAR (missingness tied to an observed variable) and rules out pure MCAR — it doesn't, and can't, rule out MNAR.

## 🗑️ Treatment: Deletion

```python
# Drop rows missing on any column
df_complete = df.dropna()

# Drop rows only if they're missing on a specific, essential column
df_clean = df.dropna(subset=["revenue"])

# Drop rows only if MOST columns are missing (keep partially-complete rows)
df_clean = df.dropna(thresh=df.shape[1] - 1)   # allow at most 1 missing field

# Drop columns that are mostly empty
df_clean = df.dropna(axis=1, thresh=int(0.9 * len(df)))   # keep cols ≥90% populated
```

Deletion is only defensible when missingness is small, plausibly MCAR, and the loss is documented — it silently changes your sample composition otherwise.

## 🧩 Treatment: Imputation

```python
# Constant / simple imputation
df["region"] = df["region"].fillna("Unknown")

# Numeric: overall median (robust to the skew a mean imputation would introduce)
df["satisfaction_score"] = df["satisfaction_score"].fillna(df["satisfaction_score"].median())

# Better: group-wise median, when missingness is MAR with respect to a group
df["satisfaction_score"] = df.groupby("segment")["satisfaction_score"] \
    .transform(lambda s: s.fillna(s.median()))

# Categorical: mode
df["region"] = df["region"].fillna(df["region"].mode().iloc[0])

# Model-based (KNN) imputation for numeric columns
from sklearn.impute import KNNImputer
num_cols = ["tenure_months", "revenue", "satisfaction_score"]
imputer = KNNImputer(n_neighbors=5)
df[num_cols] = imputer.fit_transform(df[num_cols])
```

## 🚩 Missingness Indicators

When absence itself might be predictive (common under MNAR — e.g. "didn't answer the satisfaction survey" is informative on its own), keep the signal even after you impute the value:

```python
df["satisfaction_score_was_missing"] = df["satisfaction_score"].isna().astype(int)
df["satisfaction_score"] = df["satisfaction_score"].fillna(df["satisfaction_score"].median())
```

This lets a downstream model use "was this missing" as a feature in its own right, instead of erasing the fact that it happened.

## 📅 Time-Aware Fill

For time-ordered data, forward/back fill is valid only when the ordering makes the assumption reasonable (e.g. a status that persists until changed):

```python
df_sorted = df.sort_values("signup_date")
df_sorted["satisfaction_score"] = df_sorted.groupby("segment")["satisfaction_score"].ffill()
```

Never `ffill`/`bfill` across a value that resets each period (e.g. a daily count) — it will fabricate history that never happened.

## 🖼️ Visualizing Missingness

A table of percentages hides *patterns* that a picture makes obvious — whether missingness clusters in the same rows, and whether it correlates with row order (a proxy for time, if the file isn't already sorted by date):

```python
import missingno as msno
import matplotlib.pyplot as plt

msno.matrix(df)          # one row per record, blank = missing — reveals row-level clustering
plt.show()

msno.bar(df)              # per-column completeness, sorted — a visual version of the % table above
plt.show()

msno.heatmap(df)          # correlation between *missingness* across column pairs (not the values themselves)
plt.show()

msno.dendrogram(df)       # hierarchically clusters columns by how similarly they go missing together
plt.show()
```

`msno.heatmap()` is easy to misread: a high value means two columns tend to go missing *together*, not that their (observed) values correlate — those are two different questions, and confusing them is one of the more common missingness-analysis mistakes.

## 📈 A Multivariate MAR Probe

The chi-square test above checks one candidate variable at a time. A logistic regression predicting the missingness indicator from *every* observed column at once is a stronger MAR probe — it can find a joint pattern that no single bivariate test would catch:

```python
import statsmodels.api as sm

X = pd.get_dummies(
    df[["segment", "region", "tenure_months", "revenue"]].assign(region=df["region"].fillna("Unknown")),
    columns=["segment", "region"], drop_first=True
)
X = sm.add_constant(X.astype(float))
y = df["satisfaction_score"].isna().astype(int)

model = sm.Logit(y, X).fit(disp=0)
print(model.summary().tables[1])
print("pseudo R2:", model.prsquared)   # 0.026 -> the observed columns explain almost none of the missingness
```

A low pseudo-R² across every observed predictor (0.026 here, with no individual p-value below 0.05) is meaningfully stronger evidence toward MCAR than any single chi-square test — it means missingness isn't well explained by *anything* you can currently see, which shifts the remaining suspicion toward either true randomness or an unmeasured (MNAR) driver.

## 🔁 Multiple Imputation (MICE)

Single-pass median/KNN imputation gives you one plausible dataset. Multiple Imputation by Chained Equations (MICE) models each missing column as a function of the others, iterates, and — properly used — generates several completed datasets whose spread reflects genuine imputation uncertainty:

```python
from sklearn.experimental import enable_iterative_imputer   # required to unlock IterativeImputer
from sklearn.impute import IterativeImputer

num_cols = ["tenure_months", "revenue", "satisfaction_score"]
imputer = IterativeImputer(random_state=42, max_iter=10)
imputed = imputer.fit_transform(df[num_cols])

imputed_df = pd.DataFrame(imputed, columns=num_cols)
print(imputed_df["satisfaction_score"].isna().sum())          # 0
print(imputed_df["satisfaction_score"].describe().round(2))
```

`scikit-learn`'s `IterativeImputer` gives you a single completed dataset (it's a MICE-*style* algorithm, not full multiple imputation) — for genuine multiple imputation with pooled uncertainty estimates across several completed datasets, reach for `statsmodels.imputation.mice.MICE` or R's `mice` package instead.

## 📝 Worked Examples

**1. Quantify, probe, and treat (satisfaction_score / region)**

```python
def missingness_report(df: pd.DataFrame) -> pd.DataFrame:
    report = df.isna().sum().rename("missing").to_frame()
    report["pct"] = (report["missing"] / len(df) * 100).round(2)
    return report[report["missing"] > 0].sort_values("pct", ascending=False)

report = missingness_report(df)
print(report)
# satisfaction_score: 8.0% missing, region: 3.0% missing

# Probe mechanism for satisfaction_score against segment (candidate MAR driver)
miss_flag = df["satisfaction_score"].isna().astype(int)
chi2, p, dof, _ = chi2_contingency(pd.crosstab(miss_flag, df["segment"]))
print(f"p={p:.3f}")   # 0.525 -> not significantly related to segment in this sample

# Decision: small %, no evidence of a segment-driven MAR pattern -> group-median impute
# and keep an indicator flag in case the true mechanism is MNAR (unmeasured satisfaction driver)
df["satisfaction_score_was_missing"] = miss_flag
df["satisfaction_score"] = df.groupby("segment")["satisfaction_score"] \
    .transform(lambda s: s.fillna(s.median()))
df["region"] = df["region"].fillna("Unknown")
```

**2. Interpolating a gappy time series correctly**

`satisfaction_score` has 40 missing values scattered across time. Two candidate fills behave very differently:

```python
ts = df.set_index("signup_date").sort_index()["satisfaction_score"]
print(ts.isna().sum())                              # 40

interp_linear = ts.interpolate(method="linear")      # assumes evenly-spaced index positions
interp_time = ts.interpolate(method="time")           # accounts for the actual gap durations
print(interp_linear.isna().sum(), interp_time.isna().sum())   # 0, 0
```

Verdict: with `signup_date` irregularly spaced (customers don't sign up at perfectly even intervals), `method="time"` is the correct choice — `method="linear"` silently treats every gap as the same width regardless of how many days it actually spans, which distorts the interpolated values whenever gaps vary in length.

**3. A full MICE pipeline with an MAR-probe gate**

Before committing to MICE over a simpler median fill, use the multivariate probe to check whether it's actually warranted:

```python
# Step 1: probe — is missingness explained by the observed columns at all?
model = sm.Logit(y, X).fit(disp=0)
print(model.prsquared)   # 0.026 -> weak signal; MICE has little to exploit here, but costs nothing to try

# Step 2: impute anyway, to compare against the simpler baseline
imputer = IterativeImputer(random_state=42, max_iter=10)
mice_result = pd.DataFrame(imputer.fit_transform(df[num_cols]), columns=num_cols)

# Step 3: compare the distribution shape against a plain median fill
median_result = df[num_cols].fillna(df[num_cols].median())
print("MICE std:", mice_result["satisfaction_score"].std().round(3))
print("Median-fill std:", median_result["satisfaction_score"].std().round(3))
```

Verdict: when the pseudo-R² from the probe is this low, MICE and a simple median fill will land close to each other — in that case, prefer the simpler, more explainable median fill for a production pipeline, and save MICE for columns where the probe actually shows a strong observed-variable relationship worth exploiting.

## ⚠️ Gotchas

- **A non-significant chi-square test against one candidate variable is not proof of MCAR** — it only rules out that *specific* variable as the driver; the true mechanism could still be MAR on an untested column, or MNAR.
- **Mean imputation shrinks variance and attenuates correlations** — it makes every imputed row look like an "average" row, which understates spread and can weaken relationships you're trying to measure. Median or group-wise imputation is usually safer.
- **`fillna()` on a `groupby` result needs `.transform()`, not `.apply()` or a bare assignment**, or the fill won't broadcast back to the original row index correctly.
- **Dropping rows changes your effective sample size and composition silently** — always report how many rows were dropped and check whether the dropped rows differ systematically from the rest (that difference is itself evidence about the mechanism).
- **Missingness indicators are only useful if you keep them *after* imputing** — adding the flag and then discarding it before modeling throws away the exact signal you added it for.
- **`ffill`/`bfill` assume the last known value is still true** — valid for a status field, invalid for a period-reset metric like monthly revenue.
- **`msno.heatmap()` shows correlation between *missingness*, not between the underlying values** — a strong cell means two columns tend to go missing together, which is a different (and often more actionable) fact than whether their values correlate.
- **`IterativeImputer` is hidden behind an experimental flag** — forgetting `from sklearn.experimental import enable_iterative_imputer` before importing it raises an `ImportError`, and the import order matters (the enable line must run first).
- **`interpolate(method="linear")` ignores the actual time gap between points** — on an irregularly-spaced datetime index, `method="time"` is almost always the more defensible default; `linear` quietly assumes every gap is equally wide.
- **A low pseudo-R² from the multivariate MAR probe is evidence, not proof, of MCAR** — it only rules out the columns you fed into the model; an unmeasured column could still be driving an MNAR mechanism the model never saw.

## 🎯 Best Practices

1. **Always quantify before treating** — a missingness report is a five-line function; run it before any imputation decision.
2. **Ask "why" before "how"** — the treatment choice should follow from a hypothesis about MCAR/MAR/MNAR, not from habit.
3. **Prefer group-wise over global imputation** when you have evidence of a MAR driver — it recovers more signal than a single global median.
4. **Keep a missingness indicator when in doubt** — it's cheap insurance against an MNAR mechanism you can't fully rule out.
5. **Document every drop and fill** — future readers (including future you) need to know the treatment was a deliberate choice, not an accident of `dropna()` defaults.
6. **Look at a missingness visualization before writing conclusions from the percentage table alone** — row-level clustering and cross-column missingness correlation are easy to miss in a table and obvious in `msno.matrix()`/`msno.heatmap()`.
7. **Reach for the multivariate MAR probe before reaching for MICE** — if no observed column explains the missingness, a complex imputation model usually won't outperform a simple, explainable one.
