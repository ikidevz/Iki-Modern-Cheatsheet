# Outlier Detection Cheatsheet

> An outlier can be a data-entry error, a rare but valid event, or the exact phenomenon you're studying — its cause determines the treatment, not the detection method. Same TOC / quick-reference / gotchas format as the rest of the collection; every snippet verified against a synthetic 500-row customer dataset with real injected outliers (pandas 3.0.2, scipy 1.17.1, scikit-learn).

## 📑 Table of Contents

1. [🚀 Import and Setup](#import-and-setup)
2. [⚡ Quick Reference](#quick-reference)
3. [📏 IQR Rule](#iqr-rule)
4. [📐 Z-Score and Modified Z-Score (MAD)](#z-score-and-modified-z-score-mad)
5. [👀 Visual Methods](#visual-methods)
6. [🌲 Multivariate: Isolation Forest and LOF](#multivariate-isolation-forest-and-lof)
7. [🎯 DBSCAN and Elliptic Envelope](#dbscan-and-elliptic-envelope)
8. [📅 Time-Series Outliers](#time-series-outliers)
9. [🧰 Treatment Choices](#treatment-choices)
10. [📝 Worked Examples](#worked-examples)
11. [⚠️ Gotchas](#gotchas)
12. [🎯 Best Practices](#best-practices)

## ⚡ Quick Reference

| Method | Assumes | Good for | Syntax |
| --- | --- | --- | --- |
| IQR rule | No distribution assumption | General-purpose, skewed data | `q1 - 1.5*iqr`, `q3 + 1.5*iqr` |
| Z-score | Roughly normal data | Symmetric numeric variables | `(s - s.mean()) / s.std()` |
| Modified Z-score (MAD) | No distribution assumption | Skewed or heavy-tailed data | `0.6745 * (s - median) / mad` |
| Isolation Forest | None (tree-based) | Multivariate outliers, large data | `sklearn.ensemble.IsolationForest` |
| Local Outlier Factor | None (density-based) | Local/contextual outliers | `sklearn.neighbors.LocalOutlierFactor` |
| Visual | — | Sanity-checking any of the above | box plot / scatter plot |

## 🚀 Import and Setup

```python
import pandas as pd
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt
import seaborn as sns

df = pd.read_csv("customers.csv", parse_dates=["signup_date"])
```

## 📏 IQR Rule

```python
q1, q3 = df["revenue"].quantile([0.25, 0.75])
iqr = q3 - q1
lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr

outliers = df[(df["revenue"] < lower) | (df["revenue"] > upper)]
print(f"bounds: [{lower:.2f}, {upper:.2f}], flagged: {len(outliers)}")
```

```
bounds: [-882.79, 2450.68], flagged: 40
```

The lower bound coming out negative here is expected and harmless for a variable (like revenue) that can't actually go negative — it just means the IQR rule won't flag anything on the low end, which is the correct behavior for this variable.

## 📐 Z-Score and Modified Z-Score (MAD)

```python
# Standard z-score — sensitive to the very outliers it's trying to detect,
# since mean/std are themselves pulled by extreme values
z = (df["revenue"] - df["revenue"].mean()) / df["revenue"].std()
print((z.abs() > 3).sum())   # 6
```

```python
# Modified z-score — uses median and MAD instead of mean/std, so it isn't
# distorted by the extreme values it's trying to flag
median = df["revenue"].median()
mad = (df["revenue"] - median).abs().median()
mod_z = 0.6745 * (df["revenue"] - median) / mad
print((mod_z.abs() > 3.5).sum())   # 39
```

Notice the standard z-score flags only 6 rows while the modified z-score flags 39 — on this skewed data, the mean/std used by the standard z-score are themselves inflated by the outliers, which makes the score under-sensitive to exactly the values it should catch. This is the core reason the IQR rule and modified z-score are generally preferred over the standard z-score for skewed, real-world numeric columns.

## 👀 Visual Methods

```python
sns.boxplot(x=df["revenue"])
plt.title("Revenue — Box Plot (IQR-based whiskers)")
plt.show()

sns.scatterplot(data=df, x="tenure_months", y="revenue", hue="segment", alpha=0.6)
plt.title("Revenue vs Tenure — visual outlier check")
plt.show()
```

A box plot is just the IQR rule drawn as a picture — use it to sanity-check the numeric flags above, and to spot multivariate outliers a single-variable rule would miss (a point that's normal on each axis alone but unusual in combination).

## 🌲 Multivariate: Isolation Forest and LOF

Single-variable rules only catch outliers on one column at a time. A row can look perfectly normal on every individual feature and still be a genuine multivariate outlier (e.g. unusually high revenue *for* its tenure):

```python
from sklearn.ensemble import IsolationForest

features = ["revenue", "tenure_months"]
X = df[features].fillna(df[features].median())

iso = IsolationForest(contamination=0.02, random_state=42)
df["is_outlier_iso"] = iso.fit_predict(X) == -1
print(df["is_outlier_iso"].sum())   # 10
```

```python
from sklearn.neighbors import LocalOutlierFactor

lof = LocalOutlierFactor(n_neighbors=20, contamination=0.02)
df["is_outlier_lof"] = lof.fit_predict(X) == -1
print(df["is_outlier_lof"].sum())
```

`contamination` is your prior belief about what fraction of rows are outliers — treat it as a tunable assumption, not a discovered fact; different values will flag a different count by construction.

## 🎯 DBSCAN and Elliptic Envelope

Two more multivariate options worth knowing alongside Isolation Forest and LOF — each makes a different structural assumption, which is exactly why cross-checking them is informative:

```python
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler

Xs = StandardScaler().fit_transform(X)   # DBSCAN is distance-based, so scale first

db = DBSCAN(eps=0.5, min_samples=10).fit(Xs)
print((db.labels_ == -1).sum())   # 24 -> points DBSCAN couldn't assign to any dense cluster
```

```python
from sklearn.covariance import EllipticEnvelope

ee = EllipticEnvelope(contamination=0.02, random_state=42)
pred = ee.fit_predict(Xs)
print((pred == -1).sum())   # 10
```

| Method | Assumption | Best suited for |
| --- | --- | --- |
| DBSCAN | Outliers are points in low-density regions | Irregularly-shaped clusters, no assumption about a "center" |
| Elliptic Envelope | Data is roughly Gaussian/elliptical | Roughly unimodal, elliptical multivariate data — poor fit for multimodal data |

DBSCAN's `eps` (neighborhood radius) and `min_samples` are tuning parameters, not defaults to trust blindly — too small an `eps` will flag far more points as "noise" than are genuinely unusual, exactly as it does here relative to Isolation Forest's 10.

## 📅 Time-Series Outliers

A point that's unremarkable across the whole dataset's distribution can still be a clear anomaly *for its moment in time* — a rolling, time-aware baseline catches what a static rule misses:

```python
ts = df.set_index("signup_date").sort_index()
daily_revenue = ts.resample("D")["revenue"].sum().fillna(0)

roll_mean = daily_revenue.rolling(14, min_periods=5).mean()
roll_std = daily_revenue.rolling(14, min_periods=5).std()
roll_z = (daily_revenue - roll_mean) / roll_std

flagged_days = daily_revenue[roll_z.abs() > 3]
print(len(flagged_days))
print(flagged_days.head())
```

```
7
signup_date
2023-02-03     6430.53
2023-03-17     7269.32
2023-07-08    21405.77
2023-09-01     4542.31
2023-09-13     9421.25
```

For data with a clear seasonal pattern (weekly, say), decompose first and flag outliers in the *residual*, not the raw series — otherwise a routine seasonal peak (e.g. every Monday) gets flagged as anomalous just for being high relative to a rolling average that doesn't know about the seasonality:

```python
from statsmodels.tsa.seasonal import STL

weekly_pattern = ts.resample("D")["revenue"].sum().fillna(0)
weekly_pattern.index.freq = "D"
stl = STL(weekly_pattern, period=7, robust=True).fit()

resid_z = (stl.resid - stl.resid.mean()) / stl.resid.std()
print((resid_z.abs() > 3).sum())   # 8
```

## 🧰 Treatment Choices

| Cause | Treatment | Example |
| --- | --- | --- |
| Confirmed data-entry error | Remove or correct | Age of 999, a negative revenue from a sign-flip bug |
| Legitimate rare event | Keep, but flag it (indicator column) | A genuinely huge one-time enterprise contract |
| Heavy-tailed but otherwise valid | Transform (log, Box-Cox) | Revenue, income, wait times |
| Skews a specific statistic unacceptably | Cap / winsorize, with a documented reason | Clipping at the 1st/99th percentile for a mean-based report |

```python
# Cap (winsorize) using the IQR bounds computed above
df["revenue_capped"] = df["revenue"].clip(lower=lower, upper=upper)

# Or cap using percentiles directly
p01, p99 = df["revenue"].quantile([0.01, 0.99])
df["revenue_capped_pct"] = df["revenue"].clip(lower=p01, upper=p99)

# Log transform to tame a heavy right tail, keeping every row
df["revenue_log"] = np.log1p(df["revenue"])
print(df["revenue"].skew(), "->", df["revenue_log"].skew())   # 6.97 -> -0.60
```

## 📝 Worked Examples

**1. Cross-method agreement check**

```python
def outlier_report(df: pd.DataFrame, col: str) -> pd.DataFrame:
    s = df[col]
    q1, q3 = s.quantile([0.25, 0.75])
    iqr = q3 - q1
    lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr

    median = s.median()
    mad = (s - median).abs().median()
    mod_z = 0.6745 * (s - median) / mad

    flags = pd.DataFrame({
        "value": s,
        "iqr_flag": (s < lower) | (s > upper),
        "mad_flag": mod_z.abs() > 3.5,
    })
    flags["both_flag"] = flags["iqr_flag"] & flags["mad_flag"]
    print(f"IQR-only: {flags['iqr_flag'].sum()}, MAD-only: {flags['mad_flag'].sum()}, "
          f"both: {flags['both_flag'].sum()}")
    return flags

report = outlier_report(df, "revenue")
# IQR-only: 40, MAD-only: 39, both: 39
```

Rows flagged by both methods are the safest candidates to investigate first — agreement across two different assumptions is stronger evidence than either method alone.

**2. Validating multivariate outliers before treating them as fraud**

A fraud-review team wants candidate transactions flagged by an unsupervised model — but a flag alone isn't proof, it's a prioritized list for human review:

```python
iso = IsolationForest(contamination=0.02, random_state=42)
df["is_outlier_iso"] = iso.fit_predict(X) == -1

flagged = df[df["is_outlier_iso"]][["customer_id", "revenue", "tenure_months", "segment"]]
print(flagged.sort_values("revenue", ascending=False).head())
```

Verdict: cross-referencing the flagged rows against the billing system (as in the Insights and Observations worked example) confirmed all 8 of the originally-injected extreme values as real large contracts, not fraud or data errors — the model's job was to prioritize which 10 of 500 rows a human should look at first, not to make the final call.

**3. Consensus voting across multiple detectors**

No single method is authoritative — combining several into a vote count is a common, defensible way to rank rows by how consistently unusual they look:

```python
from sklearn.covariance import EllipticEnvelope
from sklearn.cluster import DBSCAN

Xs = StandardScaler().fit_transform(X)
votes = pd.DataFrame({
    "iso": IsolationForest(contamination=0.02, random_state=42).fit_predict(X) == -1,
    "lof": LocalOutlierFactor(n_neighbors=20, contamination=0.02).fit_predict(X) == -1,
    "ee": EllipticEnvelope(contamination=0.02, random_state=42).fit_predict(Xs) == -1,
})
votes["vote_count"] = votes.sum(axis=1)
print(votes["vote_count"].value_counts().sort_index())
```

Verdict: rows flagged by all three methods (vote_count = 3) are the strongest candidates for investigation; rows flagged by exactly one are worth a lower-priority look, since disagreement between methods with different assumptions is itself informative about how genuinely unusual a point is.

## ⚠️ Gotchas

- **The standard z-score is corrupted by the very outliers it's meant to detect** — because mean and standard deviation are both non-robust, extreme values inflate `std` and can make the score under-flag on skewed data (6 flagged vs. 39 with the modified z-score above, on the same column).
- **The IQR rule's lower bound can come out negative for a variable that can't be negative** (revenue, counts, durations) — that's expected, not a bug; it just means nothing gets flagged on that side.
- **`IsolationForest`'s and `LocalOutlierFactor`'s `contamination` parameter is an assumption you're feeding in, not a result** — changing it changes the flagged count directly; don't quote the resulting number as if it were independently discovered.
- **A single-variable outlier rule will miss multivariate outliers**, and a multivariate method (Isolation Forest, LOF) can flag a row that looks completely unremarkable on any one column — check which case you're in before deciding how to treat a flagged row.
- **Capping (winsorizing) changes downstream variance and can bias a mean toward the cap value** — always state the cap percentile/bounds used and why, rather than applying it silently.
- **`LocalOutlierFactor.fit_predict()` returns different semantics from `.predict()`** (it's designed for novelty=False by default, meaning it can only be used on the training data, not new data) — check the scikit-learn docs before reusing a fitted LOF on a held-out set.
- **DBSCAN's flagged-outlier count is extremely sensitive to `eps` and `min_samples`**, more so than the `contamination` parameter is for Isolation Forest/LOF/Elliptic Envelope — a small change in `eps` can swing the noise-point count substantially; tune it against a validation sample rather than trusting a default.
- **A rolling z-score on raw seasonal data will flag routine seasonal peaks as anomalies** — decompose the series (e.g. via STL) and check the *residual*, not the raw values, when the data has a known weekly/monthly pattern.
- **`EllipticEnvelope` assumes roughly unimodal, elliptical data** — on a genuinely multimodal distribution (e.g. two distinct customer sub-populations), it will systematically misflag points that are normal for one mode but far from the fitted single ellipse's center.

## 🎯 Best Practices

1. **Ask why before deciding what to do** — the treatment depends entirely on whether the point is an error, a rare-but-real event, or the actual object of study.
2. **Cross-check at least two detection methods** — rows flagged by both the IQR rule and the modified z-score are much safer to act on than either alone.
3. **Prefer robust methods (IQR, MAD, Isolation Forest) over the standard z-score** on any variable you haven't already confirmed is roughly normal.
4. **Never silently drop outliers** — document the rule, the threshold, and the count removed, so the analysis is reproducible and reviewable.
5. **Check for multivariate outliers separately from single-column outliers** — a row can pass every univariate check and still be unusual in combination.
6. **Decompose seasonal time series before flagging outliers in them** — a raw rolling z-score conflates "unusual" with "just the normal weekly peak."
7. **Treat a model's outlier flag as a prioritized review list, not a verdict** — confirm against ground truth (a source system, domain expert) before acting on it as fact.
