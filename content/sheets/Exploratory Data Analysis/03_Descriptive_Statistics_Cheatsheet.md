# Descriptive Statistics Cheatsheet

> Build the numeric baseline — central tendency, spread, and shape — before a single chart gets drawn. Same TOC / quick-reference / gotchas format as the rest of the collection; every number below was actually computed against a synthetic 500-row customer dataset (pandas 3.0.2, scipy 1.17.1), not hand-typed.

## 📑 Table of Contents

1. [🚀 Import and Setup](#import-and-setup)
2. [⚡ Quick Reference](#quick-reference)
3. [📊 `describe()` — Numeric and Categorical](#describe-numeric-and-categorical)
4. [🎯 Central Tendency](#central-tendency)
5. [📐 Spread and Dispersion](#spread-and-dispersion)
6. [📈 Shape: Skewness and Kurtosis](#shape-skewness-and-kurtosis)
7. [🔢 Quantiles and Percentiles](#quantiles-and-percentiles)
8. [🏷️ Categorical Summaries](#categorical-summaries)
9. [👥 Grouped / Segmented Statistics](#grouped-segmented-statistics)
10. [🛡️ Robust Statistics](#robust-statistics)
11. [⚖️ Weighted Statistics](#weighted-statistics)
12. [📉 Rolling and Windowed Statistics](#rolling-and-windowed-statistics)
13. [🎲 Bootstrap Confidence Intervals](#bootstrap-confidence-intervals)
14. [📊 Detecting Drift Between Two Snapshots](#detecting-drift-between-two-snapshots)
15. [📝 Worked Examples](#worked-examples)
16. [⚠️ Gotchas](#gotchas)
17. [🎯 Best Practices](#best-practices)

## ⚡ Quick Reference

| Measure | Syntax | Robust to outliers? |
| --- | --- | --- |
| Mean | `s.mean()` | No |
| Median | `s.median()` | Yes |
| Mode | `s.mode()` | Yes |
| Standard deviation | `s.std()` | No |
| Variance | `s.var()` | No |
| IQR | `s.quantile(.75) - s.quantile(.25)` | Yes |
| MAD (median absolute deviation) | `(s - s.median()).abs().median()` | Yes |
| Trimmed mean | `scipy.stats.trim_mean(s, 0.1)` | Partially |
| Skewness | `s.skew()` | No |
| Kurtosis (excess) | `s.kurtosis()` | No |
| Full numeric summary | `df.describe()` | — |
| Full categorical summary | `df.describe(include=["str", "category"])` | — |

## 🚀 Import and Setup

```python
import pandas as pd
import numpy as np
from scipy import stats

df = pd.read_csv("customers.csv", parse_dates=["signup_date"])
```

## 📊 `describe()` — Numeric and Categorical

```python
print(df.describe().round(2))
```

```
       customer_id  tenure_months   revenue  satisfaction_score  churned
count       500.00         500.00    500.00               460.00   500.00
mean        250.50          29.11   1067.52                 7.56     0.29
std         144.48          17.28   1566.98                 1.38     0.46
min           1.00           1.00      5.00                 3.50     0.00
25%         125.75          14.75    367.26                 6.60     0.00
50%         250.50          29.00    667.07                 7.60     0.00
75%         375.25          43.00   1200.63                 8.60     1.00
max         500.00          59.00  21405.77                10.00     1.00
```

```python
# pandas 3.x default string dtype is 'str' — pass both for cross-version code
print(df.describe(include=["str", "category"]))
```

```
         segment region
count        500    485
unique         3      4
top     Consumer  South
freq         249    132
```

Note that `describe()`'s `count` for `satisfaction_score` (460) already tells you it's missing on 40 rows — cross-check against the [Missing Values Analysis Cheatsheet](02_Missing_Values_Analysis_Cheatsheet.md) before trusting the rest of the row.

## 🎯 Central Tendency

```python
s = df["revenue"].dropna()
print("mean:", s.mean().round(2))      # 1067.52
print("median:", s.median())            # 667.07
print("mode:", s.mode().iloc[0])        # 5.0 (a clipped floor value, appearing more than once)
```

| Measure | When to prefer it |
| --- | --- |
| Mean | Symmetric, outlier-light distributions; needed for totals/sums that must reconcile |
| Median | Skewed distributions (revenue, income, wait times) — resists being dragged by extreme values |
| Mode | Discrete/categorical values, or to describe the most common numeric bucket |

On `revenue` here, mean (1,067.52) sits well above the median (667.07) — a first, cheap signal that the distribution is right-skewed before you've plotted anything.

## 📐 Spread and Dispersion

```python
print("std:", s.std().round(2))          # 1566.98
print("var:", s.var().round(2))          # 2,455,415.11
print("iqr:", (s.quantile(.75) - s.quantile(.25)).round(2))   # 833.37
```

Standard deviation larger than the mean itself (1,566.98 vs. 1,067.52) is another early red flag for a heavy-tailed distribution, not just a wide one.

## 📈 Shape: Skewness and Kurtosis

```python
print(df["revenue"].skew())        # 6.97  (pandas: sample skewness, bias-adjusted)
print(df["revenue"].kurtosis())    # 72.92 (pandas: excess kurtosis, i.e. relative to normal=0)

print(stats.skew(df["revenue"]))       # 6.95 (scipy: population skewness by default)
print(stats.kurtosis(df["revenue"]))   # 72.18 (scipy: excess kurtosis by default)
```

| Value | Reading |
| --- | --- |
| Skew ≈ 0 | Roughly symmetric |
| Skew > 0 | Right-tailed (a few very large values pull the mean up) |
| Skew < 0 | Left-tailed |
| Excess kurtosis ≈ 0 | Tail weight similar to a normal distribution |
| Excess kurtosis > 0 | Heavier tails / more extreme values than normal (leptokurtic) |

A skew of ~7 and kurtosis of ~73 on `revenue` (driven by the injected high-value outliers) confirms what the mean/median gap already hinted at — this is a job for the [Outlier Detection](08_Outlier_Detection_Cheatsheet.md) and [Feature Distribution](09_Feature_Distribution_Cheatsheet.md) cheatsheets next, not a straight mean-based summary.

## 🔢 Quantiles and Percentiles

```python
print(df["revenue"].quantile([0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99]).round(2))
```

```
0.01      24.88
0.05     114.53
0.25     367.26
0.50     667.07
0.75    1200.63
0.95    3209.21
0.99    6597.53
```

The jump from the 95th to 99th percentile (3,209 → 6,598) versus the much gentler climb from 25th to 75th tells you the extreme tail is doing most of the work — exactly what the skewness number already suggested, now with concrete values to act on (e.g. as candidate winsorization bounds).

## 🏷️ Categorical Summaries

```python
print(df["segment"].value_counts(dropna=False))
print(df["segment"].value_counts(normalize=True, dropna=False).round(3))
```

## 👥 Grouped / Segmented Statistics

An overall summary often hides the story — always check whether it holds within meaningful subgroups:

```python
print(df.groupby("segment", observed=True)["revenue"].agg(["count", "mean", "median", "std"]).round(2))
```

```
            count     mean   median      std
segment
Consumer      249   515.93   436.66   392.95
Enterprise     66  2628.94  1986.43  3002.96
SMB           185  1252.87   932.52  1394.44
```

The overall mean of 1,067.52 doesn't describe any single segment well — Enterprise customers alone average 2,628.94. Always look one level below the topline number before writing conclusions.

## 🛡️ Robust Statistics

Robust statistics ignore or down-weight the influence of extreme values — useful precisely when skewness/kurtosis has already flagged a heavy-tailed distribution:

```python
# Trimmed mean: drop the top/bottom 10% before averaging
print(stats.trim_mean(df["revenue"], 0.1).round(2))   # 791.53 (vs. untrimmed mean 1067.52)

# Median Absolute Deviation (MAD) — a robust analog to standard deviation
median = df["revenue"].median()
mad = (df["revenue"] - median).abs().median()
print(mad)
```

## ⚖️ Weighted Statistics

A plain mean treats every row equally — sometimes that's wrong on purpose, e.g. when rows represent unequal exposure (customer-months) or come from a non-uniform sample that needs reweighting back to the population:

```python
weights = df["tenure_months"]   # weight by tenure as a proxy for exposure

w_mean = np.average(df["revenue"], weights=weights)
w_var = np.average((df["revenue"] - w_mean) ** 2, weights=weights)
print(f"weighted mean: {w_mean:.2f}, weighted std: {np.sqrt(w_var):.2f}")
# weighted mean: 1043.34, weighted std: 1610.13  (vs. unweighted mean 1067.52)
```

The weighted and unweighted means are close here, which itself is informative — it tells you `revenue` isn't strongly related to `tenure_months` (consistent with the ~-0.03 correlation found in the [Correlation Analysis Cheatsheet](07_Correlation_Analysis_Cheatsheet.md)); a bigger gap between weighted and unweighted results would be a sign the weighting variable matters.

## 📉 Rolling and Windowed Statistics

A single overall statistic hides trend — a rolling window shows whether the "typical" value is drifting over time:

```python
ts = df.set_index("signup_date").sort_index()["revenue"]
rolling_30d = ts.rolling("30D").mean()
print(rolling_30d.tail(3))
```

```
signup_date
2024-01-08 18:00:00    1193.39
2024-01-09 12:00:00    1167.00
2024-01-10 06:00:00    1175.94
```

Use a time-based window (`"30D"`) rather than a row-count window (`.rolling(30)`) whenever the index isn't perfectly evenly spaced — a row-count window silently spans a different amount of wall-clock time depending on how dense the data happens to be in that stretch.

## 🎲 Bootstrap Confidence Intervals

`describe()` gives you a point estimate with no sense of its uncertainty. A bootstrap confidence interval answers "how much would this statistic move if I'd collected a different sample of the same size?" — particularly useful for the median and other statistics that don't have a simple textbook formula for their standard error:

```python
from scipy import stats

# scipy's built-in bootstrap (preferred — vectorized and well-tested)
res = stats.bootstrap((df["revenue"],), np.median, confidence_level=0.95, random_state=0)
print(res.confidence_interval)   # ConfidenceInterval(low=593.69, high=724.38)

# manual version, useful when you need a statistic scipy doesn't support directly
rng = np.random.default_rng(0)
boot_medians = [np.median(rng.choice(df["revenue"], size=len(df), replace=True)) for _ in range(2000)]
ci_low, ci_high = np.percentile(boot_medians, [2.5, 97.5])
print(f"median={df['revenue'].median():.2f}, 95% CI=[{ci_low:.2f}, {ci_high:.2f}]")
```

A median of 667.07 with a 95% CI of roughly [594, 724] tells you the point estimate is reasonably stable at n=500 — report the interval alongside the point estimate whenever the statistic will inform a decision, not just the single number.

## 📊 Detecting Drift Between Two Snapshots

Comparing this month's descriptive statistics to last month's is one of the most common real uses of everything in this cheatsheet — and eyeballing two `describe()` tables side by side misses subtler shifts that a formal test catches:

```python
from scipy import stats

# Real check: does revenue differ between the first and second half of the signup window?
mid = df["signup_date"].median()
first_half = df[df["signup_date"] < mid]["revenue"]
second_half = df[df["signup_date"] >= mid]["revenue"]

stat, p = stats.ks_2samp(first_half, second_half)
print(f"KS stat={stat:.3f}, p={p:.3f}")   # KS stat=0.088, p=0.288 -> no significant drift here

# For comparison: a synthetic example with a genuine 25% shift, to show what a real drift looks like
baseline = df["revenue"].sample(300, random_state=1).reset_index(drop=True)
shifted = baseline * 1.25 + np.random.default_rng(3).normal(0, 50, size=300)
stat2, p2 = stats.ks_2samp(baseline, shifted)
print(f"KS stat={stat2:.3f}, p={p2:.5f}")   # KS stat=0.140, p=0.006 -> clearly detected
```

The Kolmogorov-Smirnov test compares entire distributions, not just means — it will catch a shape change (e.g. new variance or skew) that two `describe()` tables with similar means could otherwise hide.

## 📝 Worked Examples

**1. Column report with shape-aware recommendations**

```python
def describe_column(s: pd.Series, name: str) -> None:
    s = s.dropna()
    print(f"--- {name} ---")
    print(f"n={len(s)}, mean={s.mean():.2f}, median={s.median():.2f}, std={s.std():.2f}")
    print(f"IQR=[{s.quantile(.25):.2f}, {s.quantile(.75):.2f}], skew={s.skew():.2f}")
    if s.skew() > 1:
        print("-> notably right-skewed: prefer median/IQR over mean/std for summaries")

describe_column(df["revenue"], "revenue")
# n=500, mean=1067.52, median=667.07, std=1566.98
# IQR=[367.26, 1200.63], skew=6.97
# -> notably right-skewed: prefer median/IQR over mean/std for summaries
```

**2. Baseline balance check before an A/B test**

Before trusting a test's results, confirm the two groups actually started from comparable baselines — a routine use of grouped descriptive statistics:

```python
# Simulate a random 50/50 split and check pre-experiment revenue is balanced
rng = np.random.default_rng(11)
df["test_group"] = rng.choice(["control", "treatment"], size=len(df))
balance = df.groupby("test_group")["revenue"].agg(["count", "mean", "median", "std"]).round(2)
print(balance)
```

Verdict: if `mean`/`median` differ noticeably between `control` and `treatment` *before* the test even starts, that's a randomization problem to fix before looking at outcomes — not a finding to report as a treatment effect later.

**3. Flagging a monthly snapshot for drift**

A monthly automated job needs a simple pass/fail check, not a full manual review each time:

```python
def drift_check(baseline: pd.Series, current: pd.Series, alpha: float = 0.01) -> None:
    stat, p = stats.ks_2samp(baseline.dropna(), current.dropna())
    mean_shift_pct = (current.mean() - baseline.mean()) / baseline.mean() * 100
    flag = "DRIFT DETECTED" if p < alpha else "stable"
    print(f"{flag}: KS p={p:.4f}, mean shift={mean_shift_pct:+.1f}%")

drift_check(baseline, shifted)   # DRIFT DETECTED: KS p=0.0055, mean shift=+25.2%
drift_check(first_half, second_half)   # stable: KS p=0.2881, mean shift=+6.8%
```

Note the second call: a +6.8% mean shift alone might look worth flagging, but the KS test judges it statistically indistinguishable from sampling noise at this sample size — a threshold on the formal test is more reliable than eyeballing the percentage change.

## ⚠️ Gotchas

- **pandas and scipy compute skew/kurtosis with slightly different default bias corrections** — expect small (not large) numeric differences between `s.skew()` and `stats.skew(s)`; don't treat a discrepancy as a bug.
- **`kurtosis()` in both pandas and scipy is *excess* kurtosis by default** (normal distribution = 0, not 3) — quoting it as raw kurtosis will be off by 3.
- **Mean and standard deviation are both non-robust** — a handful of outliers (8 out of 500 rows here) was enough to pull `revenue`'s mean 60% above its median. If skew is high, lead with median/IQR, not mean/std.
- **`describe()`'s `count` row is your missingness check** — a column with a lower count than the others in the same table is silently excluding NaNs from every other statistic in that column, without saying so explicitly.
- **`mode()` can return more than one value** (ties) — always take `.iloc[0]` deliberately, or handle the multi-mode case explicitly, rather than assuming a single scalar.
- **A single overall summary can misrepresent every subgroup** — always check grouped statistics before generalizing from a topline mean or median.
- **`np.average(..., weights=...)` silently produces garbage if the weights contain `NaN`** — it doesn't raise an error, it just returns `NaN` for the whole calculation; drop or fill missing weights explicitly first.
- **`.rolling(30)` (a row-count window) and `.rolling("30D")` (a time window) are not interchangeable on unevenly-spaced data** — the row-count version silently covers a different amount of wall-clock time depending on how dense the data is in that stretch.
- **A bootstrap confidence interval describes sampling uncertainty, not measurement error or model uncertainty** — a tight CI still doesn't mean the statistic is unbiased if the underlying data collection itself is flawed.
- **The Kolmogorov-Smirnov test is sensitive to sample size in both directions** — it can flag a trivially small, practically meaningless shift as "significant" at very large n, and miss a real shift at very small n; always look at the actual magnitude (mean shift %, or the two histograms) alongside the p-value.

## 🎯 Best Practices

1. **Run mean and median side by side, every time** — a large gap between them is a free, instant skewness signal before you've computed anything else.
2. **Reach for robust statistics (median, IQR, MAD, trimmed mean) whenever skew or kurtosis is large** — they describe the "typical" case better than mean/std when a few values dominate.
3. **Always check group-wise statistics**, not just the overall summary — segment/mean interactions are one of the most common ways a topline number misleads.
4. **Treat `describe()`'s per-column `count` as a missingness flag**, not just metadata.
5. **Pair every statistic with the shape context** (skew/kurtosis) rather than reporting mean ± std in isolation on data you haven't checked for skew.
6. **Weight statistics deliberately when rows don't represent equal exposure** — an unweighted mean silently assumes every row should count the same.
7. **Report an uncertainty interval alongside any statistic that will inform a decision** — a bootstrap CI costs a few lines of code and prevents over-reading a point estimate.
8. **Automate drift checks on recurring data** — a KS test (or a simpler mean-shift threshold) run on every new snapshot catches problems long before a manual review would.
