# Feature Distribution Cheatsheet

> Distribution shape drives which transformations, visualizations, and model assumptions are appropriate — get the shape right before doing anything downstream with the variable. Same TOC / quick-reference / gotchas format as the rest of the collection; every snippet verified against a synthetic 500-row customer dataset (pandas 3.0.2, scipy 1.17.1, scikit-learn).

## 📑 Table of Contents

1. [🚀 Import and Setup](#import-and-setup)
2. [⚡ Quick Reference](#quick-reference)
3. [👁️ Reading Shape: Symmetric, Skewed, Heavy-Tailed](#reading-shape-symmetric-skewed-heavy-tailed)
4. [🧪 Normality Checks](#normality-checks)
5. [📊 Binning for Visualization](#binning-for-visualization)
6. [🔄 Transformations](#transformations)
7. [📏 Scaling](#scaling)
8. [⛰️ Bimodality and Mixture Detection](#bimodality-and-mixture-detection)
9. [📐 Population Stability Index (Distribution Drift)](#population-stability-index-distribution-drift)
10. [🎯 Quantile Transformation](#quantile-transformation)
11. [🗃️ Discretization Strategies](#discretization-strategies)
12. [📝 Worked Examples](#worked-examples)
13. [⚠️ Gotchas](#gotchas)
14. [🎯 Best Practices](#best-practices)

## ⚡ Quick Reference

| Task | Syntax |
| --- | --- |
| Skew across all numeric columns | `df.select_dtypes("number").skew()` |
| Flag heavily skewed columns | `skew[skew.abs() > 1]` |
| Shapiro-Wilk normality test | `scipy.stats.shapiro(s)` |
| D'Agostino K² normality test | `scipy.stats.normaltest(s)` |
| Log transform (handles zeros) | `np.log1p(s)` |
| Square-root transform | `np.sqrt(s)` |
| Box-Cox (strictly positive only) | `scipy.stats.boxcox(s)` |
| Yeo-Johnson (handles zero/negative) | `sklearn.preprocessing.PowerTransformer(method="yeo-johnson")` |
| Standard scaling | `sklearn.preprocessing.StandardScaler` |
| Robust scaling (outlier-resistant) | `sklearn.preprocessing.RobustScaler` |

## 🚀 Import and Setup

```python
import pandas as pd
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt
import seaborn as sns

df = pd.read_csv("customers.csv", parse_dates=["signup_date"])
```

## 👁️ Reading Shape: Symmetric, Skewed, Heavy-Tailed

```python
numeric = df.select_dtypes(include="number")
skewed = numeric.skew().abs().sort_values(ascending=False)
print(skewed[skewed > 1])
```

```
revenue    6.974215
dtype: float64
```

| Shape | Signal | Typical cause |
| --- | --- | --- |
| Symmetric | Mean ≈ median, skew ≈ 0 | Naturally bounded/additive processes |
| Positive (right) skew | Mean > median, skew > 0, long right tail | Money, counts, durations — most real-world "amount" variables |
| Negative (left) skew | Mean < median, skew < 0, long left tail | Scores capped near a maximum (e.g. satisfaction near 10) |
| Heavy tails (high kurtosis) | More extreme values than a normal distribution predicts | Mixture of populations, rare high-impact events |

```python
sns.histplot(df["revenue"], kde=True, bins=40)
plt.title("Revenue — Positively Skewed")
plt.show()
```

## 🧪 Normality Checks

Useful before choosing a parametric test or deciding a transform is worth applying:

```python
# Shapiro-Wilk — most powerful for small-to-moderate samples (n < ~5000)
stat, p = stats.shapiro(df["revenue"].sample(300, random_state=1))
print(f"Shapiro-Wilk: stat={stat:.3f}, p={p:.3g}")   # p << 0.05 -> reject normality

# D'Agostino K^2 — combines skew and kurtosis into one test, works on full samples
stat2, p2 = stats.normaltest(df["revenue"])
print(f"D'Agostino: stat={stat2:.2f}, p={p2:.3g}")

# Visual check: a Q-Q plot is often more informative than either test alone
stats.probplot(df["revenue"], dist="norm", plot=plt)
plt.title("Revenue Q-Q Plot")
plt.show()
```

With n=500 rows here, both formal tests return p-values far below 0.05 — unsurprising given a skew of ~7. With very large samples, formal normality tests become oversensitive (they will reject normality for trivially small deviations); the Q-Q plot and the skew/kurtosis numbers usually tell you more than the p-value alone.

## 📊 Binning for Visualization

```python
# Data-driven bin count (Freedman-Diaconis, sensitive to outliers)
edges_fd = np.histogram_bin_edges(df["revenue"], bins="fd")
print(len(edges_fd) - 1, "bins")   # 102

# Sturges' rule (fewer bins, less sensitive to outliers, better for smaller n)
edges_sturges = np.histogram_bin_edges(df["revenue"], bins="sturges")
print(len(edges_sturges) - 1, "bins")   # 10
```

Freedman-Diaconis produces far more bins here (102 vs. 10) precisely because it's sensitive to the same outliers that are driving the skew — on heavily-skewed data, a fixed, reasoned bin count (or binning the log-transformed variable instead) is usually more readable than trusting an automatic rule.

## 🔄 Transformations

```python
# log1p handles zeros gracefully (log(1+x)), unlike a raw log
df["revenue_log"] = np.log1p(df["revenue"])
print(f"skew before: {df['revenue'].skew():.2f}, after log1p: {df['revenue_log'].skew():.2f}")
# skew before: 6.97, after log1p: -0.60

# Square root — gentler than log, works for right skew, requires non-negative values
df["revenue_sqrt"] = np.sqrt(df["revenue"])

# Box-Cox — finds the optimal power transform, but requires strictly positive values
transformed, best_lambda = stats.boxcox(df["revenue"])
print(f"optimal lambda: {best_lambda:.3f}")

# Yeo-Johnson — like Box-Cox but also handles zero and negative values
from sklearn.preprocessing import PowerTransformer
pt = PowerTransformer(method="yeo-johnson")
df["revenue_yj"] = pt.fit_transform(df[["revenue"]])
print(f"skew after Yeo-Johnson: {pd.Series(df['revenue_yj']).skew():.3f}")
# skew after Yeo-Johnson: 0.057
```

| Transform | Handles zero? | Handles negative? | Notes |
| --- | --- | --- | --- |
| `log1p` | Yes | No | Simple, interpretable, a strong default for right-skewed "amount" data |
| `sqrt` | Yes | No | Gentler than log — use when log over-corrects |
| Box-Cox | No | No | Finds the statistically optimal power; needs strictly positive input |
| Yeo-Johnson | Yes | Yes | Box-Cox's generalization — use whenever zeros or negatives are present |

`log1p` reduced `revenue`'s skew from 6.97 to ‑0.60 (now mildly *left*-skewed — a common outcome when a log transform slightly overcorrects a very heavy right tail); Yeo-Johnson got closer to symmetric (0.057) because it optimizes the power specifically to minimize skew rather than applying a fixed log.

## 📏 Scaling

Scaling changes the *range*, not the *shape* — do it after, not instead of, addressing skew if shape matters for your downstream method:

```python
from sklearn.preprocessing import StandardScaler, RobustScaler, MinMaxScaler

# Standard scaling: mean 0, std 1 — sensitive to outliers (uses mean/std)
std_scaled = StandardScaler().fit_transform(df[["revenue"]])

# Robust scaling: uses median/IQR instead — the right default when outliers are present
robust_scaled = RobustScaler().fit_transform(df[["revenue"]])

# Min-max scaling: compresses to [0, 1] — very sensitive to outliers, since the
# max alone sets the scale
minmax_scaled = MinMaxScaler().fit_transform(df[["revenue"]])
```

## ⛰️ Bimodality and Mixture Detection

Skew and kurtosis both assume a single-peaked distribution — they can look unremarkable on a genuinely bimodal variable (two distinct sub-populations mixed into one column), which needs a different check entirely:

```python
from sklearn.mixture import GaussianMixture

# A genuinely bimodal variable, simulated here for illustration: satisfaction scores
# drawn from two distinct customer groups (detractors around 3, promoters around 8.5) —
# this pattern is easy to miss when it's mixed into one real-world column
rng = np.random.default_rng(9)
bimodal_satisfaction = np.concatenate([rng.normal(3, 0.8, 150), rng.normal(8.5, 0.7, 350)])
values = bimodal_satisfaction.reshape(-1, 1)

gmm1 = GaussianMixture(n_components=1, random_state=0).fit(values)
gmm2 = GaussianMixture(n_components=2, random_state=0).fit(values)
print(f"BIC 1-component: {gmm1.bic(values):.1f}, BIC 2-component: {gmm2.bic(values):.1f}")
print(f"2-component means: {gmm2.means_.ravel().round(2)}")
```

```
BIC 1-component: 2390.2, BIC 2-component: 1762.7
2-component means: [8.49 3.04]
```

A substantially lower BIC for the 2-component model is evidence of real bimodality — the Bayesian Information Criterion penalizes the extra parameters, so a clear win despite that penalty means the two-population structure is genuinely a better fit, not overfitting. A quick, cheaper alternative that doesn't require fitting a model:

```python
from scipy.stats import skew, kurtosis

n = len(bimodal_satisfaction)
bc = (skew(bimodal_satisfaction)**2 + 1) / (kurtosis(bimodal_satisfaction) + 3*(n-1)**2/((n-2)*(n-3)))
print(f"bimodality coefficient: {bc:.3f}")   # 0.815 -> above the common 0.555 threshold
```

## 📐 Population Stability Index (Distribution Drift)

PSI is the standard credit-risk/ML-monitoring metric for whether a feature's distribution has shifted between two datasets (commonly: training data vs. current production data):

```python
def psi(expected: np.ndarray, actual: np.ndarray, bins: int = 10) -> float:
    breakpoints = np.quantile(expected, np.linspace(0, 1, bins + 1))
    breakpoints[0], breakpoints[-1] = -np.inf, np.inf
    e_perc = np.histogram(expected, bins=breakpoints)[0] / len(expected)
    a_perc = np.histogram(actual, bins=breakpoints)[0] / len(actual)
    e_perc, a_perc = np.clip(e_perc, 1e-4, None), np.clip(a_perc, 1e-4, None)
    return np.sum((a_perc - e_perc) * np.log(a_perc / e_perc))

baseline = df["revenue"].sample(300, random_state=1).values
similar_sample = df["revenue"].sample(300, random_state=2).values
shifted_sample = (df["revenue"].sample(300, random_state=3) * 1.4).values

print(f"PSI (similar sample): {psi(baseline, similar_sample):.4f}")   # 0.0284
print(f"PSI (shifted sample): {psi(baseline, shifted_sample):.4f}")   # 0.1223
```

| PSI | Conventional interpretation |
| --- | --- |
| < 0.10 | No significant shift |
| 0.10 – 0.25 | Moderate shift — investigate |
| > 0.25 | Major shift — the feature's distribution has meaningfully changed |

## 🎯 Quantile Transformation

Unlike a fixed-formula transform (log, Box-Cox), a quantile transform maps values to their rank-based percentile and then to a target distribution — it forces *any* input shape toward the target, which is powerful but worth understanding as rank-based, not formula-based:

```python
from sklearn.preprocessing import QuantileTransformer

qt = QuantileTransformer(output_distribution="normal", random_state=0)
transformed = qt.fit_transform(df[["revenue"]])
print(f"skew after quantile transform: {pd.Series(transformed.ravel()).skew():.3f}")   # -0.356
```

Because it's rank-based, a quantile transform is far more aggressive than log/Box-Cox at forcing normality — but it also means the transformed values no longer preserve the original relative spacing between points, which matters if you need to interpret the transformed scale directly rather than just feed it to a model.

## 🗃️ Discretization Strategies

Binning a continuous feature into buckets (for a model that handles categories better than continuous inputs, or for interpretability) has several genuinely different strategies, not one "binning":

```python
from sklearn.preprocessing import KBinsDiscretizer

for strategy in ["uniform", "quantile", "kmeans"]:
    kb = KBinsDiscretizer(n_bins=5, encode="ordinal", strategy=strategy)
    binned = kb.fit_transform(df[["revenue"]])
    counts = pd.Series(binned.ravel()).value_counts().sort_index()
    print(strategy, counts.tolist())
```

```
uniform [488, 8, 2, 1, 1]
quantile [100, 100, 100, 100, 100]
kmeans [412, 77, 9, 1, 1]
```

| Strategy | Bin widths | Result on skewed data |
| --- | --- | --- |
| `uniform` | Equal width | Almost everything falls in one bin (488/500 here) |
| `quantile` | Equal frequency | Balanced bins by construction (100/100/100/100/100) — the usual right default |
| `kmeans` | Cluster-based | Splits by natural groupings in the data, not a fixed rule |

## 📝 Worked Examples

**1. Column report with shape-aware recommendation**

```python
def distribution_report(df: pd.DataFrame, col: str) -> None:
    s = df[col].dropna()
    print(f"--- {col} ---")
    print(f"skew={s.skew():.2f}, kurtosis={s.kurtosis():.2f}")

    stat, p = stats.normaltest(s)
    print(f"normality test p={p:.3g}")

    if s.skew() > 1:
        log_skew = np.log1p(s).skew()
        print(f"log1p reduces skew to {log_skew:.2f}")
    elif s.skew() < -1:
        print("left-skewed: consider a reflect-then-log or Yeo-Johnson transform")
    else:
        print("roughly symmetric: no transform likely needed")

distribution_report(df, "revenue")
# skew=6.97, kurtosis=72.92
# normality test p=4.17e-149
# log1p reduces skew to -0.60
```

**2. Monitoring a model input feature for drift with PSI**

A model in production uses `revenue` as a feature. Rather than waiting for accuracy to degrade, check the feature's distribution against training data on a schedule:

```python
def psi_monitor(training_data: pd.Series, production_data: pd.Series, feature_name: str) -> None:
    score = psi(training_data.values, production_data.values)
    status = "OK" if score < 0.10 else "INVESTIGATE" if score < 0.25 else "ALERT"
    print(f"{feature_name}: PSI={score:.4f} [{status}]")

psi_monitor(baseline, similar_sample, "revenue")   # PSI=0.0284 [OK]
psi_monitor(baseline, shifted_sample, "revenue")   # PSI=0.1223 [INVESTIGATE]
```

Verdict: PSI in the 0.10–0.25 range on the shifted sample would trigger a review, not an automatic rollback — the next step is to check *why* the feature shifted (a genuine business change vs. a pipeline bug) before deciding whether the model needs retraining.

**3. Discovering a bimodal feature that changes a segmentation decision**

A team assumed `satisfaction_score` was a single, roughly-normal population and was about to report one overall average. Checking for mixture structure first changes the conclusion entirely:

```python
gmm2 = GaussianMixture(n_components=2, random_state=0).fit(values)
labels = gmm2.predict(values)
print(pd.Series(labels).value_counts())
print(f"group means: {gmm2.means_.ravel().round(2)}")
```

Verdict: reporting a single average across two populations centered at 3.0 and 8.5 would describe neither group accurately — the average lands in a range where almost no actual customer sits. The right move is to report the two group means and sizes separately, and treat "which group a customer falls into" as a variable worth investigating (what distinguishes detractors from promoters) rather than averaging the distinction away.

## ⚠️ Gotchas

- **Formal normality tests (Shapiro-Wilk, D'Agostino) get oversensitive at large sample sizes** — with enough rows, they will reject normality for deviations too small to matter practically. Always pair the test with the actual skew/kurtosis numbers and a Q-Q plot.
- **`scipy.stats.shapiro` caps out around n≈5,000 and its p-value accuracy degrades beyond that** — sample down for very large datasets rather than trusting the raw result on the full table.
- **A recent scipy change to `stats.anderson()` now requires an explicit `method=` argument to get a p-value** — calling it the old way still runs, but only returns a critical-value table, not a p-value, and raises a `FutureWarning`.
- **Log and square-root transforms silently fail on zero or negative values** — `log1p` handles zero, but neither handles negative numbers; reach for Yeo-Johnson when the column can be zero or negative.
- **Freedman-Diaconis binning is itself sensitive to the outliers you're often trying to visualize past** — it can produce an unreadable number of bins on heavily-skewed data (102 bins in the example above); a fixed bin count or binning the transformed variable is often more legible.
- **Scaling does not fix skew** — `StandardScaler`/`MinMaxScaler` change the numeric range, not the shape of the distribution; a heavily skewed variable is still heavily skewed after scaling.
- **`StandardScaler` and `MinMaxScaler` are themselves computed from mean/std or min/max**, which means they're distorted by the same outliers you may be trying to work around — `RobustScaler` is the safer default whenever outliers are present.
- **Skew and kurtosis can both look unremarkable on a bimodal variable** — they're built around the assumption of a single peak; always check for mixture structure separately (GMM/BIC or the bimodality coefficient) rather than trusting skew alone to rule it out.
- **PSI's bin edges are computed from the "expected" (baseline) dataset and reused on the "actual" dataset** — passing the two datasets in the wrong order changes which distribution is treated as the reference, and silently changes the resulting score's interpretation.
- **A quantile transform is rank-based, not formula-based** — it discards the original relative spacing between values entirely; don't use it when the transformed scale itself needs to remain interpretable (e.g. for reporting dollar-like values back to a stakeholder).
- **`KBinsDiscretizer(strategy="uniform")` on skewed data reproduces the same one-dominant-bucket problem as `pd.cut`** — `strategy="quantile"` is almost always the safer default on real-world "amount" variables, same reasoning as `qcut` vs. `cut` in the univariate cheatsheet.

## 🎯 Best Practices

1. **Always check skew/kurtosis numerically before choosing a transform** — don't pick log-transform reflexively; confirm the distribution actually needs it.
2. **Prefer `log1p` or Yeo-Johnson over a raw `log`/Box-Cox** whenever the variable can be zero — it avoids a silent `-inf` or an error.
3. **Pick the transform, then the scaler** — shape and range are separate problems; fix shape first if it matters for your downstream method (e.g. linear models, distance-based clustering).
4. **Use `RobustScaler` by default on real-world business data** — most "amount" variables carry enough outliers that mean/std-based scaling gets distorted.
5. **Don't over-trust a normality test's p-value on a large sample** — read it alongside the skew/kurtosis values and a Q-Q plot, not in isolation.
6. **Check for bimodality before reporting a single summary statistic** — a mean or median computed across two distinct sub-populations describes neither one accurately.
7. **Monitor PSI (or a similar drift metric) on any feature a production model depends on** — catching distribution drift early is cheaper than debugging a silent accuracy regression later.
