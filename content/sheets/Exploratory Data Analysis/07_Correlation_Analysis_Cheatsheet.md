# Correlation Analysis Cheatsheet

> Correlation measures the strength and direction of a relationship — it never establishes causation on its own. Same TOC / quick-reference / gotchas format as the rest of the collection; every snippet verified against a synthetic 500-row customer dataset (pandas 3.0.2, scipy 1.17.1, numpy 2.4.4).

## 📑 Table of Contents

1. [🚀 Import and Setup](#import-and-setup)
2. [⚡ Quick Reference](#quick-reference)
3. [📐 Pearson, Spearman, and Kendall](#pearson-spearman-and-kendall)
4. [🔗 Point-Biserial and Categorical Associations](#point-biserial-and-categorical-associations)
5. [🗺️ Correlation Matrix and Heatmap](#correlation-matrix-and-heatmap)
6. [🎯 Significance and Sample Size](#significance-and-sample-size)
7. [🧮 Multicollinearity Screening](#multicollinearity-screening)
8. [⚠️ Pitfalls: Nonlinearity, Outliers, Spurious Correlation](#pitfalls-nonlinearity-outliers-spurious-correlation)
9. [🎚️ Partial Correlation Matrix](#partial-correlation-matrix)
10. [🧲 Distance Correlation and Mutual Information (Nonlinear Dependence)](#distance-correlation-and-mutual-information-nonlinear-dependence)
11. [🌳 Clustering Variables by Correlation](#clustering-variables-by-correlation)
12. [📝 Worked Examples](#worked-examples)
13. [⚠️ Gotchas](#gotchas)
14. [🎯 Best Practices](#best-practices)

## ⚡ Quick Reference

| Method | Use for | Syntax |
| --- | --- | --- |
| Pearson | Linear association, numeric vs numeric | `df[[a,b]].corr(method="pearson")` |
| Spearman | Monotonic (not necessarily linear) association, numeric or ordinal | `df[[a,b]].corr(method="spearman")` |
| Kendall | Small samples or many tied ranks | `df[[a,b]].corr(method="kendall")` |
| Point-biserial | One binary variable vs one continuous variable | `scipy.stats.pointbiserialr(binary, cont)` |
| Cramér's V | Two categorical (nominal) variables | custom function, below |
| Correlation + p-value pair | Any of the above with a significance test | `scipy.stats.pearsonr(a, b)` |
| Full matrix | Every numeric column pairwise | `df.select_dtypes("number").corr()` |

## 🚀 Import and Setup

```python
import pandas as pd
import numpy as np
from scipy import stats

df = pd.read_csv("customers.csv", parse_dates=["signup_date"])
```

## 📐 Pearson, Spearman, and Kendall

```python
num = df.select_dtypes(include="number").drop(columns=["customer_id"])

print(num.corr(method="pearson").round(2))
print(num.corr(method="spearman").round(2))
```

```
                    tenure_months  revenue  satisfaction_score  churned
tenure_months                1.00    -0.03               -0.05    -0.11
revenue                      -0.03     1.00                0.02     0.02
satisfaction_score           -0.05     0.02                1.00     0.00
churned                      -0.11     0.02                0.00     1.00
```

| Method | Detects | Sensitive to outliers? | Requires |
| --- | --- | --- | --- |
| Pearson | Linear relationships only | Yes | Roughly continuous, roughly normal data ideally |
| Spearman | Any monotonic relationship (ranks) | Less | Ordinal or continuous data |
| Kendall | Any monotonic relationship, via concordant/discordant pairs | Less | Works well with small n or many ties |

Pearson and Spearman are close here (`revenue` vs `tenure_months`: ‑0.026 vs ‑0.010) — when the two diverge a lot on the same pair, that's itself a signal of a nonlinear-but-monotonic relationship, or of outliers distorting Pearson specifically.

## 🔗 Point-Biserial and Categorical Associations

For a binary variable against a continuous one (equivalent to Pearson correlation, but named for this case):

```python
r_pb, p_pb = stats.pointbiserialr(df["churned"], df["revenue"])
print(f"r={r_pb:.3f}, p={p_pb:.3f}")   # r=0.021, p=0.646
```

For two nominal categorical variables, Pearson/Spearman don't apply — use Cramér's V, built on the chi-square statistic:

```python
def cramers_v(x: pd.Series, y: pd.Series) -> float:
    ct = pd.crosstab(x, y)
    chi2 = stats.chi2_contingency(ct)[0]
    n = ct.sum().sum()
    r, k = ct.shape
    phi2 = chi2 / n
    phi2corr = max(0, phi2 - ((k - 1) * (r - 1)) / (n - 1))
    rcorr = r - ((r - 1) ** 2) / (n - 1)
    kcorr = k - ((k - 1) ** 2) / (n - 1)
    return np.sqrt(phi2corr / min(kcorr - 1, rcorr - 1))

print(cramers_v(df["segment"], df["region"].fillna("Unknown")))   # 0.076 -> very weak association
```

Cramér's V ranges 0–1 like an absolute correlation, with no sign (nominal categories have no inherent order, so "direction" isn't meaningful).

## 🗺️ Correlation Matrix and Heatmap

```python
import matplotlib.pyplot as plt
import seaborn as sns

corr = num.corr(method="spearman")
sns.heatmap(corr, annot=True, fmt=".2f", cmap="coolwarm", center=0, vmin=-1, vmax=1)
plt.title("Spearman Correlation Matrix")
plt.show()
```

## 🎯 Significance and Sample Size

A correlation coefficient without a p-value (or a sense of sample size) is only half the story — the same r can be noise at n=20 and highly significant at n=5,000:

```python
r, p = stats.pearsonr(df["revenue"], df["tenure_months"])
print(f"r={r:.3f}, p={p:.3f}")   # r=-0.026, p=0.561 -> not distinguishable from zero here

rho, p2 = stats.spearmanr(df["revenue"], df["satisfaction_score"], nan_policy="omit")
print(f"rho={rho:.3f}, p={p2:.3f}")   # rho=0.020, p=0.670
```

`nan_policy="omit"` is required whenever the columns you're correlating contain missing values (as `satisfaction_score` does here) — `pearsonr`/`spearmanr` raise or return `NaN` on unhandled missing data otherwise.

## 🧮 Multicollinearity Screening

Before feeding correlated features into a linear model, flag pairs that carry near-duplicate information:

```python
corr = num.corr().abs()
upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
high_corr_pairs = [
    (row, col, upper.loc[row, col])
    for col in upper.columns for row in upper.index
    if pd.notna(upper.loc[row, col]) and upper.loc[row, col] > 0.8
]
print(high_corr_pairs)   # [] -> nothing above 0.8 in this sample
```

For a more formal multicollinearity check across several predictors at once, use the Variance Inflation Factor:

```python
from statsmodels.stats.outliers_influence import variance_inflation_factor
X = num.dropna()
vif = pd.Series(
    [variance_inflation_factor(X.values, i) for i in range(X.shape[1])],
    index=X.columns
)
print(vif.round(2))
```

A VIF above ~5–10 on a predictor is the usual rule-of-thumb flag for problematic multicollinearity.

## ⚠️ Pitfalls: Nonlinearity, Outliers, Spurious Correlation

```python
# A large Pearson coefficient can be driven entirely by one or two points —
# always inspect the scatter, don't trust the number alone
import matplotlib.pyplot as plt
plt.scatter(df["tenure_months"], df["revenue"], alpha=0.4)
plt.show()
```

Classic traps a correlation matrix will never warn you about on its own:

- Two variables both trending with time (or both derived from a shared third variable) can correlate strongly with no direct causal link between them.
- A relationship that is strongly U-shaped or cyclical can produce a Pearson r near zero despite an obviously real, strong pattern.
- A single extreme outlier can single-handedly create — or destroy — an apparent linear correlation.

## 🎚️ Partial Correlation Matrix

The pairwise correlation matrix from earlier can't distinguish a direct relationship between two variables from one that's entirely mediated by a third. A partial correlation matrix, built from the inverse covariance matrix, controls for every *other* variable in the table simultaneously:

```python
cov = num.dropna().cov().values
prec = np.linalg.inv(cov)                       # the precision (inverse covariance) matrix
d = np.sqrt(np.diag(prec))
partial_corr_matrix = -prec / np.outer(d, d)
np.fill_diagonal(partial_corr_matrix, 1)

print(pd.DataFrame(partial_corr_matrix, index=num.columns, columns=num.columns).round(3))
```

```
                    tenure_months  revenue  satisfaction_score  churned
tenure_months               1.000   -0.025              -0.054   -0.107
revenue                    -0.025    1.000               0.016    0.011
satisfaction_score         -0.054    0.016               1.000   -0.004
churned                    -0.107    0.011              -0.004    1.000
```

In this sample the partial matrix looks nearly identical to the raw Pearson matrix — a sign that none of these four variables' pairwise relationships are being meaningfully mediated by the others. A real difference between the two matrices is the signal to look for: it means a pairwise correlation you'd otherwise trust is actually explained away once you control for the rest of the table.

## 🧲 Distance Correlation and Mutual Information (Nonlinear Dependence)

Pearson, Spearman, and Kendall all assume some form of monotonic relationship. A variable pair can be strongly, deterministically related with *zero* Pearson correlation if the relationship is non-monotonic (e.g. U-shaped) — distance correlation and mutual information catch this where the classic methods can't:

```python
import dcor

# A deliberately U-shaped, strongly-related pair, constructed to show the trap:
x = np.linspace(-3, 3, 300)
y_nonlinear = x**2 + np.random.default_rng(1).normal(0, 0.5, 300)

pearson_r, _ = stats.pearsonr(x, y_nonlinear)
dcorr = dcor.distance_correlation(x, y_nonlinear)
print(f"Pearson r={pearson_r:.3f}, distance correlation={dcorr:.3f}")
```

```
Pearson r=-0.007, distance correlation=0.482
```

Pearson says "essentially no relationship" (r ≈ -0.007); distance correlation correctly reports a real, moderate-to-strong dependence (0.482), because unlike Pearson it's zero *only* when two variables are truly independent, not merely uncorrelated in a linear sense.

```python
from sklearn.feature_selection import mutual_info_regression

X = num.dropna().drop(columns=["revenue"])
y = num.dropna()["revenue"]
mi = mutual_info_regression(X, y, random_state=42)
print(pd.Series(mi, index=X.columns).sort_values(ascending=False).round(3))
```

Mutual information is another nonlinear-aware option, useful specifically as a feature-selection score — it estimates how much knowing one variable reduces uncertainty about another, with no assumption about the shape of the relationship.

## 🌳 Clustering Variables by Correlation

With many numeric columns, a flat correlation matrix gets hard to scan. Hierarchical clustering on `1 - |correlation|` as a distance groups variables that carry similar information — useful for spotting redundant feature clusters before feature selection:

```python
from scipy.cluster.hierarchy import linkage, dendrogram

corr = num.dropna().corr()
dist = 1 - corr.abs()
condensed = dist.values[np.triu_indices_from(dist.values, k=1)]
Z = linkage(condensed, method="average")

dendrogram(Z, labels=corr.columns.tolist())
plt.title("Variable Clustering by Correlation Distance")
plt.show()
```

Variables that merge together low on the dendrogram (a small linkage distance) are the ones behaving most similarly — strong multicollinearity candidates worth reviewing together rather than one pair at a time.

## 📝 Worked Examples

**1. Flagging features related to the target at a chosen threshold**

```python
def correlation_report(df: pd.DataFrame, target: str, threshold: float = 0.3) -> pd.Series:
    num = df.select_dtypes(include="number").drop(columns=[c for c in ["customer_id"] if c in df])
    corr_to_target = num.corr(method="spearman")[target].drop(target).sort_values(key=abs, ascending=False)
    flagged = corr_to_target[corr_to_target.abs() >= threshold]
    print(f"Correlations with {target} above |{threshold}|:")
    print(flagged if len(flagged) else "  (none)")
    return corr_to_target

report = correlation_report(df, "revenue")
# Correlations with revenue above |0.3|:
#   (none)  -> in this sample, no single numeric feature is strongly (Spearman) related to revenue
```

**2. Feature selection combining linear and nonlinear association**

Spearman alone found nothing above threshold against `revenue`. Before concluding "no predictors exist," check whether mutual information — which can catch nonlinear relationships Spearman misses — agrees:

```python
mi_scores = pd.Series(mi, index=X.columns).sort_values(ascending=False)
spearman_scores = num.corr(method="spearman")["revenue"].drop("revenue").abs()

comparison = pd.DataFrame({"mutual_info": mi_scores, "spearman_abs": spearman_scores}).round(3)
print(comparison)
```

Verdict: when both linear and nonlinear measures agree there's little signal, that's much stronger grounds for concluding "no useful numeric predictor of revenue in this table" than either method alone — and it's a legitimate, reportable finding, not a failed analysis.

**3. Catching a relationship Pearson would have missed entirely**

A dashboard shows Pearson correlations only and flags nothing between two variables believed (from domain knowledge) to be related. Before trusting the dashboard, check with a nonlinear-aware measure:

```python
pearson_r, _ = stats.pearsonr(x, y_nonlinear)
dcorr = dcor.distance_correlation(x, y_nonlinear)
print(f"Pearson: {pearson_r:.3f}  |  Distance correlation: {dcorr:.3f}")
```

Verdict: Pearson's near-zero reading would have wrongly told the team "these variables are unrelated" — the distance correlation of 0.482 reveals a real, moderate relationship the dashboard's Pearson-only view was structurally blind to. Whenever a domain expert insists a relationship exists but Pearson shows nothing, this is the check to run before dismissing their intuition.

## ⚠️ Gotchas

- **"Correlation, not causation" is the whole point of this cheatsheet, not a footnote** — a strong r only tells you two variables move together, never which one (if either) is driving the other.
- **Pearson assumes a linear relationship; a near-zero Pearson r can still hide a strong nonlinear one** — always look at the scatter plot behind a surprising coefficient, in either direction.
- **`corr()` silently uses pairwise-complete observations by default** — each cell in the matrix may be computed from a slightly different subset of rows if missingness differs by column, which can make the matrix internally inconsistent in edge cases.
- **`pearsonr`/`spearmanr` (unlike `df.corr()`) don't handle `NaN` automatically** — pass `nan_policy="omit"` or drop missing values first, or you'll get an error or a silent `NaN` result.
- **A correlation matrix's "high" pairs depend entirely on your chosen threshold** — 0.8 is a common convention, not a law; pick a threshold appropriate to your field and say so.
- **Cramér's V has no sign** — reporting it as positive or negative correlation is a category error; it measures strength of association only.
- **The precision-matrix partial correlation approach requires an invertible covariance matrix** — with highly collinear or near-duplicate columns (or more columns than rows), `np.linalg.inv(cov)` becomes numerically unstable or fails outright; drop redundant columns first.
- **Distance correlation and mutual information are strictly ≥ 0** — unlike Pearson/Spearman, they carry no direction, only strength; you still need to look at the data to know whether the relationship is positive, negative, or something more complex like U-shaped.
- **Mutual information estimates from `mutual_info_regression` are noisy on small samples and sensitive to the number of neighbors used internally** — treat the ranking between features as more reliable than the absolute score, and don't over-interpret small differences between two close values.
- **A correlation-distance dendrogram clusters by *linear* similarity by default** (it's built on Pearson/Spearman correlation) — two variables with a strong nonlinear relationship can still end up far apart on it, same trap as the raw correlation matrix.

## 🎯 Best Practices

1. **Choose the method by relationship type, not by habit** — Pearson for linear, Spearman/Kendall for monotonic-but-possibly-nonlinear, Cramér's V for nominal-nominal, point-biserial for binary-continuous.
2. **Always pair a coefficient with a p-value or a sense of sample size** — an r of 0.3 means very different things at n=30 and n=3,000.
3. **Look at the scatter plot behind any correlation you're about to report**, especially a surprising one — this is the single cheapest guard against Pearson's blindness to nonlinearity.
4. **Use the correlation matrix to flag redundancy, not to auto-drop variables** — a high pairwise correlation is a prompt for a modeling decision, not itself the decision.
5. **State plainly, in any write-up, that correlation doesn't establish causation** — it costs one sentence and prevents the most common misreading of this whole analysis.
6. **Compute a partial correlation matrix whenever more than two variables are genuinely in play** — a pairwise matrix alone can't tell you which relationships survive controlling for the rest of the table.
7. **Cross-check a "no relationship" finding from Pearson/Spearman with a nonlinear-aware measure** (distance correlation or mutual information) before ruling a variable out entirely — especially when domain knowledge suggests a relationship should exist.
