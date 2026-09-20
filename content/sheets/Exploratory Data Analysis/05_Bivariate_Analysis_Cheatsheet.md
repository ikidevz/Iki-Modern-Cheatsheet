# Bivariate Analysis Cheatsheet

> Study pairs of variables to find associations, group differences, trends, and possible confounding — and treat every pattern you find as a hypothesis, not a conclusion. Same TOC / quick-reference / gotchas format as the rest of the collection; every snippet verified against a synthetic 500-row customer dataset (pandas 3.0.2, scipy 1.17.1).

## 📑 Table of Contents

1. [🚀 Import and Setup](#import-and-setup)
2. [⚡ Quick Reference](#quick-reference)
3. [🔢 Numeric vs Numeric](#numeric-vs-numeric)
4. [🔢🏷️ Numeric vs Categorical](#numeric-vs-categorical)
5. [🏷️🏷️ Categorical vs Categorical](#categorical-vs-categorical)
6. [📅 Time vs a Measure](#time-vs-a-measure)
7. [🧩 Confounding and Simpson's Paradox](#confounding-and-simpsons-paradox)
8. [🎚️ Partial Correlation: Controlling for a Third Variable](#partial-correlation-controlling-for-a-third-variable)
9. [🔀 Interaction Effects](#interaction-effects)
10. [⏪ Lag and Lead Correlation](#lag-and-lead-correlation)
11. [📏 Effect Size](#effect-size)
12. [📝 Worked Examples](#worked-examples)
13. [⚠️ Gotchas](#gotchas)
14. [🎯 Best Practices](#best-practices)

## ⚡ Quick Reference

| Pairing | Go-to summary | Go-to plot |
| --- | --- | --- |
| Numeric vs numeric | `df[[a, b]].corr()` | Scatter plot / trend line |
| Numeric vs categorical | `df.groupby(cat)[num].agg(["mean","median"])` | Grouped box / violin plot |
| Categorical vs categorical | `pd.crosstab(a, b)` | Proportional / stacked bar chart |
| Time vs a measure | `df.set_index(date).resample(freq)[num].mean()` | Line chart |
| Association strength (2 categoricals) | `scipy.stats.chi2_contingency(pd.crosstab(a,b))` | — |

## 🚀 Import and Setup

```python
import pandas as pd
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt
import seaborn as sns

df = pd.read_csv("customers.csv", parse_dates=["signup_date"])
```

## 🔢 Numeric vs Numeric

```python
print(df[["revenue", "tenure_months"]].corr())
```

```
                revenue  tenure_months
revenue        1.000000      -0.026061
tenure_months -0.026061       1.000000
```

```python
sns.scatterplot(data=df, x="tenure_months", y="revenue", hue="segment", alpha=0.6)
sns.regplot(data=df, x="tenure_months", y="revenue", scatter=False, color="black")
plt.title("Revenue vs Tenure")
plt.show()
```

A correlation of ‑0.03 here means essentially no linear relationship between tenure and revenue in this sample — always look at the scatter plot anyway, since a near-zero Pearson correlation can hide a real *nonlinear* relationship (see the [Correlation Analysis Cheatsheet](07_Correlation_Analysis_Cheatsheet.md) for more on this trap).

## 🔢🏷️ Numeric vs Categorical

```python
summary = df.groupby("segment", observed=True)["revenue"].agg(["count", "mean", "median", "std"])
print(summary.round(2))
```

```
            count     mean   median      std
segment
Consumer      249   515.93   436.66   392.95
Enterprise     66  2628.94  1986.43  3002.96
SMB           185  1252.87   932.52  1394.44
```

```python
sns.boxplot(data=df, x="segment", y="revenue")
plt.title("Revenue by Segment")
plt.show()

sns.violinplot(data=df, x="segment", y="revenue")
```

Enterprise customers both earn more on average *and* show far more spread (std 3,002.96 vs. Consumer's 392.95) — a group difference in variance, not just in the mean, is itself worth noting; it affects which statistical test is appropriate if you go on to test the difference formally (Welch's t-test rather than Student's, for unequal variances).

## 🏷️🏷️ Categorical vs Categorical

```python
ct = pd.crosstab(df["segment"], df["churned"])
print(ct)
```

```
churned       0   1
segment
Consumer    178  71
Enterprise   43  23
SMB         133  52
```

```python
# Row-normalized: churn rate within each segment
print(pd.crosstab(df["segment"], df["churned"], normalize="index").round(3))
```

```
churned         0      1
segment
Consumer    0.715  0.285
Enterprise  0.652  0.348
SMB         0.719  0.281
```

```python
# Statistical test for association
chi2, p, dof, expected = stats.chi2_contingency(ct)
print(f"chi2={chi2:.2f}, p={p:.3f}")   # chi2=1.18, p=0.554 -> no significant association here

# Proportional stacked bar chart
pd.crosstab(df["segment"], df["churned"], normalize="index").plot(kind="bar", stacked=True)
plt.ylabel("Proportion")
plt.title("Churn Rate by Segment")
plt.show()
```

## 📅 Time vs a Measure

```python
monthly_revenue = df.set_index("signup_date").resample("ME")["revenue"].mean()
print(monthly_revenue.head())

monthly_revenue.plot(kind="line", marker="o")
plt.title("Average Revenue by Signup Month")
plt.ylabel("Revenue")
plt.show()
```

Always be explicit about the time grain (`"ME"` for month-end here) — the same series aggregated weekly vs. monthly can tell visually different stories, especially with noisy data.

## 🧩 Confounding and Simpson's Paradox

A pattern that holds overall can reverse — or disappear — once you condition on a third variable. Before trusting any bivariate finding, check whether it survives within meaningful subgroups:

```python
# Overall relationship
print(df.groupby("segment", observed=True)["churned"].mean().round(3))

# Same relationship, but split further by region — does the ranking of segments hold?
print(df.groupby(["region", "segment"], observed=True)["churned"].mean().round(3))
```

If the segment ranking on churn rate flips (or vanishes) once you also condition on region, region is a confounder worth controlling for explicitly — not something to average away.

## 🎚️ Partial Correlation: Controlling for a Third Variable

A raw bivariate correlation can be inflated, deflated, or entirely created by a third variable both columns happen to share a relationship with. Partial correlation removes that shared influence:

```python
def partial_corr(x, y, z):
    # residualize x on z, and y on z, then correlate what's left
    bx = np.polyfit(z, x, 1); rx = x - np.polyval(bx, z)
    by = np.polyfit(z, y, 1); ry = y - np.polyval(by, z)
    return stats.pearsonr(rx, ry)

sub = df[["revenue", "satisfaction_score", "tenure_months"]].dropna()
r_raw, p_raw = stats.pearsonr(sub["revenue"], sub["satisfaction_score"])
r_partial, p_partial = partial_corr(sub["revenue"].values, sub["satisfaction_score"].values,
                                      sub["tenure_months"].values)
print(f"raw r={r_raw:.3f} (p={p_raw:.3f}); partial r (control tenure)={r_partial:.3f} (p={p_partial:.3f})")
```

```
raw r=0.017 (p=0.710); partial r (control tenure)=0.016 (p=0.733)
```

Here the raw and partial correlations are nearly identical — tenure isn't confounding the revenue/satisfaction relationship (which, either way, is negligible in this sample). When the two numbers diverge substantially, that gap *is* the size of the confounding effect the third variable was masking or manufacturing.

## 🔀 Interaction Effects

Two categorical variables can each show a weak main effect on their own, yet combine to matter a great deal — or the reverse. An interaction test checks whether the effect of one variable *depends on the level* of another:

```python
import statsmodels.formula.api as smf
import statsmodels.api as sm

d = df.dropna(subset=["region"])
model = smf.ols("revenue ~ C(segment) * C(region)", data=d).fit()
anova_table = sm.stats.anova_lm(model, typ=2)
print(anova_table)
```

```
                            sum_sq     df          F        PR(>F)
C(segment)            2.527786e+08    2.0  62.877443  6.098945e-25
C(region)             5.914678e+06    3.0   0.980831  4.015234e-01
C(segment):C(region)  1.096389e+07    6.0   0.909072  4.879954e-01
Residual              9.507725e+08  473.0        NaN           NaN
```

The `C(segment):C(region)` row is the interaction term — its p-value (0.488) says segment's effect on revenue doesn't meaningfully depend on region in this sample. Segment alone is doing essentially all the work (p ≈ 6×10⁻²⁵); region adds nothing, on its own or in combination.

## ⏪ Lag and Lead Correlation

For time-ordered data, the "right" pairing of two series isn't always same-period — a marketing spend or signup surge often shows its effect on revenue a period *later*:

```python
ts = df.set_index("signup_date").sort_index()
monthly = ts.resample("ME").agg({"revenue": "sum"})
monthly["signups"] = ts.resample("ME").size()

for lag in range(3):
    c = monthly["signups"].shift(lag).corr(monthly["revenue"])
    print(f"lag={lag} month(s): corr={c:.3f}")
```

```
lag=0 month(s): corr=0.479
lag=1 month(s): corr=-0.078
lag=2 month(s): corr=0.096
```

The strongest relationship here is at lag 0 (same-month signups and revenue move together, unsurprising since more signups directly means more revenue-generating customers that month) — a real lagged effect would show its peak correlation at lag 1 or later instead, which is worth checking explicitly rather than assuming.

## 📏 Effect Size

A p-value says whether a group difference is *detectable*; it says nothing about whether the difference is *large*. Report an effect size alongside any group comparison that will inform a decision:

```python
a = df[df.segment == "Enterprise"]["revenue"]
b = df[df.segment == "Consumer"]["revenue"]

pooled_std = np.sqrt(((len(a) - 1) * a.var() + (len(b) - 1) * b.var()) / (len(a) + len(b) - 2))
cohens_d = (a.mean() - b.mean()) / pooled_std
print(f"Cohen's d = {cohens_d:.3f}")   # 1.496 -> a very large effect by conventional benchmarks
```

| Cohen's d | Conventional interpretation |
| --- | --- |
| ~0.2 | Small |
| ~0.5 | Medium |
| ~0.8+ | Large |

A d of 1.496 confirms the Enterprise-vs-Consumer revenue gap isn't just statistically real, it's *substantively* large — worth distinguishing from a statistically significant but practically trivial difference you might get with a huge sample size and a d near 0.1.

## 📝 Worked Examples

**1. General-purpose bivariate summary function**

```python
def bivariate_summary(df: pd.DataFrame, x: str, y: str) -> None:
    x_numeric = pd.api.types.is_numeric_dtype(df[x])
    y_numeric = pd.api.types.is_numeric_dtype(df[y])

    if x_numeric and y_numeric:
        r = df[[x, y]].corr().iloc[0, 1]
        print(f"{x} vs {y}: Pearson r = {r:.3f}")
    elif x_numeric != y_numeric:
        num, cat = (x, y) if x_numeric else (y, x)
        print(df.groupby(cat, observed=True)[num].agg(["mean", "median"]).round(2))
    else:
        ct = pd.crosstab(df[x], df[y])
        chi2, p, _, _ = stats.chi2_contingency(ct)
        print(f"{x} vs {y}: chi2={chi2:.2f}, p={p:.3f}")

bivariate_summary(df, "revenue", "tenure_months")   # Pearson r = -0.026
bivariate_summary(df, "segment", "revenue")          # grouped mean/median table
bivariate_summary(df, "segment", "churned")          # chi2=1.18, p=0.554
```

**2. Checking whether a marketing "insight" survives controlling for tenure**

A stakeholder claims satisfied customers spend more, and wants to act on it. Before recommending anything, check whether tenure (which drives both satisfaction and spending habits independently) is doing the real work:

```python
r_raw, p_raw = stats.pearsonr(sub["revenue"], sub["satisfaction_score"])
r_partial, p_partial = partial_corr(sub["revenue"].values, sub["satisfaction_score"].values,
                                      sub["tenure_months"].values)
print(f"raw: r={r_raw:.3f} p={p_raw:.3f} | partial: r={r_partial:.3f} p={p_partial:.3f}")
```

Verdict: both the raw (r=0.017) and partial (r=0.016) correlations are negligible and non-significant — there's no real relationship to control for in the first place. The stakeholder's claim doesn't hold up in this data regardless of tenure; the right next step is to ask what evidence generated the original claim, not to build a campaign on it.

**3. Testing whether a promotion's effect on revenue differs by region**

A team wants to know if a segment-based promotion strategy should be customized by region, or if one strategy fits every region equally:

```python
model = smf.ols("revenue ~ C(segment) * C(region)", data=d).fit()
anova_table = sm.stats.anova_lm(model, typ=2)
print(anova_table.loc["C(segment):C(region)", "PR(>F)"])   # 0.488
```

Verdict: the interaction term is far from significant — segment's effect on revenue is consistent across regions in this data, so a single segment-based strategy is defensible without region-specific customization. Re-run this check before generalizing to a market where the underlying regional dynamics might genuinely differ.

## ⚠️ Gotchas

- **A near-zero Pearson correlation does not mean "no relationship"** — it means no *linear* relationship. Always look at the scatter plot; Pearson r is blind to U-shaped, threshold, or other nonlinear patterns.
- **Comparing group means alone hides differences in variance** — Enterprise and Consumer differ as much in spread as in average here; a difference-in-means test that assumes equal variance (Student's t) is the wrong tool without checking first.
- **`pd.crosstab(..., normalize="index")` vs. `normalize="columns"` answer different questions** — "what fraction of this segment churned" is not the same number as "what fraction of churners came from this segment." Pick the normalization that matches the question you're actually asking.
- **A statistically significant chi-square result on a large table doesn't tell you *which* cells drive the association** — inspect the row-normalized table (or standardized residuals) before writing a conclusion about which categories are actually different.
- **A relationship that holds in aggregate can reverse within subgroups (Simpson's paradox)** — don't skip the "does this survive conditioning on a plausible confounder" check just because the topline correlation looks clean.
- **`resample()` needs a sorted, datetime-indexed frame** — an unsorted date column will silently produce a nonsensical, out-of-order time series.
- **The simple partial-correlation approach shown here (residualize-then-correlate) assumes a linear relationship with the control variable** — it won't fully remove a nonlinear confounding effect; for that, control via a more flexible model (e.g. a GAM or tree-based residuals) instead.
- **An interaction test needs enough data in every combination of categories to have power** — a non-significant interaction term on small per-cell counts (a few of the 12 segment×region cells here have under 20 rows) could reflect low power just as easily as a genuinely absent interaction.
- **Lag correlation at lag 0 will often look strongest simply because same-period effects are usually the most direct** — don't conclude "no lagged effect exists" from a lag-0 peak without also checking whether the mechanism you're hypothesizing is plausible at longer lags.
- **A large sample size can make a practically meaningless effect statistically significant** — always report Cohen's d (or another effect size) alongside a p-value, especially before recommending action based on a "significant" result.

## 🎯 Best Practices

1. **Match the summary and the plot to the variable types** — numeric-numeric wants a scatter, numeric-categorical wants a grouped box/violin, categorical-categorical wants a crosstab/proportional bar.
2. **Treat every bivariate finding as a hypothesis** — check sample size per group, look for confounders, and see whether a handful of points are driving the pattern before trusting it.
3. **Report spread alongside the mean/median** when comparing groups — a difference in variance is often as informative as a difference in the average.
4. **Be explicit about crosstab normalization direction** — state in words which question the percentages answer.
5. **Check for confounding on at least one plausible third variable** before treating a two-variable pattern as the whole story.
6. **Compute a partial correlation whenever a stakeholder proposes acting on a bivariate finding** — it's a cheap way to catch a confounded relationship before it drives a decision.
7. **Test for interaction before assuming a one-size-fits-all treatment effect across subgroups** — a significant interaction term means the "same" strategy shouldn't be applied uniformly.
8. **Report an effect size, not just a p-value, on any comparison headed for a business decision** — statistical significance and practical significance are different questions.
