# Multivariate Analysis Cheatsheet

> Where bivariate analysis stops at pairs, multivariate analysis looks at three or more variables together — the structure, clusters, and outliers that only appear in combination. Same TOC / quick-reference / gotchas format as the rest of the collection; every snippet verified against a synthetic 500-row customer dataset plus a correlated behavioral-metrics table built specifically to give PCA and clustering something real to find (pandas 3.0.2, scipy 1.17.1, scikit-learn, umap-learn).

## 📑 Table of Contents

1. [🚀 Import and Setup](#import-and-setup)
2. [⚡ Quick Reference](#quick-reference)
3. [🔲 Pair Plots and Scatterplot Matrices](#pair-plots-and-scatterplot-matrices)
4. [🎻 Parallel Coordinates](#parallel-coordinates)
5. [📉 Dimensionality Reduction: PCA](#dimensionality-reduction-pca)
6. [🌌 Dimensionality Reduction: t-SNE and UMAP](#dimensionality-reduction-t-sne-and-umap)
7. [📐 Multivariate Outlier Detection: Mahalanobis Distance](#multivariate-outlier-detection-mahalanobis-distance)
8. [🧭 Clustering as an Exploratory Tool](#clustering-as-an-exploratory-tool)
9. [📝 Worked Examples](#worked-examples)
10. [⚠️ Gotchas](#gotchas)
11. [🎯 Best Practices](#best-practices)

## ⚡ Quick Reference

| Task | Syntax |
| --- | --- |
| Pair plot (all numeric pairs at once) | `sns.pairplot(df, hue="category")` |
| Parallel coordinates | `pandas.plotting.parallel_coordinates(df, "category")` |
| Standardize before any distance-based method | `StandardScaler().fit_transform(X)` |
| PCA | `sklearn.decomposition.PCA(n_components=k)` |
| t-SNE embedding | `sklearn.manifold.TSNE(n_components=2)` |
| UMAP embedding | `umap.UMAP(n_components=2)` |
| Mahalanobis distance | `scipy.spatial.distance.mahalanobis(x, mean, inv_cov)` |
| K-means clustering | `sklearn.cluster.KMeans(n_clusters=k)` |
| Cluster quality score | `sklearn.metrics.silhouette_score(X, labels)` |

## 🚀 Import and Setup

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import StandardScaler

df = pd.read_csv("customers.csv", parse_dates=["signup_date"])

# A correlated behavioral-metrics table, joined in for this cheatsheet: a single
# latent "engagement" factor drives all four columns, which is exactly the kind
# of structure multivariate methods are built to recover
behavior = pd.read_csv("customer_behavior.csv")   # logins_per_month, session_minutes,
                                                     # features_used, support_tickets
merged = df.merge(behavior, on="customer_id")
num_cols = ["logins_per_month", "session_minutes", "features_used", "support_tickets"]
X = merged[num_cols]
Xs = StandardScaler().fit_transform(X)
```

## 🔲 Pair Plots and Scatterplot Matrices

The natural extension of a single scatter plot — every numeric pair, plotted at once, with distributions on the diagonal:

```python
sns.pairplot(merged[num_cols + ["segment"]], hue="segment", diag_kind="kde", plot_kws={"alpha": 0.4})
plt.show()
```

Coloring by `segment` here turns a grid of scatter plots into a multivariate story: if one segment's points cluster visibly apart across several panels at once, that's a multi-feature separation a single bivariate pass (checking each pair in isolation) would only hint at, one weak signal at a time.

## 🎻 Parallel Coordinates

A pair plot doesn't scale past 5-6 variables before the grid becomes unreadable. Parallel coordinates plot every variable as a vertical axis and draw one line per row, connecting its position on each — readable with more variables, at the cost of losing the direct pairwise view:

```python
from pandas.plotting import parallel_coordinates

normed = merged[["segment"] + num_cols].copy()
for c in num_cols:
    normed[c] = (normed[c] - normed[c].min()) / (normed[c].max() - normed[c].min())

plt.figure(figsize=(10, 5))
parallel_coordinates(normed.sample(100, random_state=1), "segment", alpha=0.4)
plt.show()
```

Normalizing every axis to [0, 1] first is required — without it, a variable with a naturally larger numeric range (like `session_minutes`) visually dominates the plot regardless of its actual importance.

## 📉 Dimensionality Reduction: PCA

Principal Component Analysis finds the linear combinations of your variables that capture the most variance — useful both to compress correlated features into fewer dimensions and, via the loadings, to understand *what* those features have in common:

```python
from sklearn.decomposition import PCA

pca = PCA(random_state=42).fit(Xs)
print("explained variance ratio:", pca.explained_variance_ratio_.round(3))
print("cumulative:", np.cumsum(pca.explained_variance_ratio_).round(3))
```

```
explained variance ratio: [0.698 0.157 0.083 0.062]
cumulative:                [0.698 0.855 0.938 1.   ]
```

A single component capturing 69.8% of the variance across 4 features is a strong signal that these columns aren't really 4 independent pieces of information — they're mostly one underlying dimension, expressed 4 different ways. The loadings confirm what that dimension is:

```python
loadings = pd.DataFrame(pca.components_.T, index=num_cols,
                         columns=[f"PC{i+1}" for i in range(len(num_cols))])
print(loadings.round(3))
```

```
                    PC1    PC2    PC3    PC4
logins_per_month  0.537  0.192 -0.222  0.791
session_minutes   0.524  0.267 -0.565 -0.579
features_used     0.514  0.261  0.795 -0.189
support_tickets  -0.415  0.908 -0.016  0.057
```

PC1 loads positively and similarly on `logins_per_month`, `session_minutes`, and `features_used`, and negatively on `support_tickets` — in plain language, PC1 *is* an "engagement" axis: customers who log in more, spend more time, and use more features also file fewer support tickets, and PCA found that pattern automatically from the correlation structure alone, without being told to look for it.

```python
pcs = pca.transform(Xs)[:, :2]
sns.scatterplot(x=pcs[:, 0], y=pcs[:, 1], hue=merged["segment"], alpha=0.6)
plt.xlabel("PC1 (engagement)"); plt.ylabel("PC2")
plt.show()
```

## 🌌 Dimensionality Reduction: t-SNE and UMAP

PCA is linear — it can miss structure that only shows up as nonlinear neighborhoods. t-SNE and UMAP both aim to preserve *local* neighborhood structure in a 2D embedding, at the cost of the global-distance interpretability PCA still offers:

```python
from sklearn.manifold import TSNE

tsne = TSNE(n_components=2, perplexity=30, random_state=42, init="pca")
tsne_emb = tsne.fit_transform(Xs)

sns.scatterplot(x=tsne_emb[:, 0], y=tsne_emb[:, 1], hue=merged["segment"], alpha=0.6)
plt.title("t-SNE Embedding")
plt.show()
```

```python
import umap

reducer = umap.UMAP(n_components=2, random_state=42)
umap_emb = reducer.fit_transform(Xs)

sns.scatterplot(x=umap_emb[:, 0], y=umap_emb[:, 1], hue=merged["segment"], alpha=0.6)
plt.title("UMAP Embedding")
plt.show()
```

| Method | Preserves | Speed | Distances between clusters meaningful? |
| --- | --- | --- | --- |
| PCA | Global variance structure, linear | Fast | Yes |
| t-SNE | Local neighborhoods | Slow on large n | No — cluster *sizes* and *inter-cluster distances* are not interpretable |
| UMAP | Local + more global structure than t-SNE | Faster than t-SNE | Somewhat more than t-SNE, still not fully reliable |

## 📐 Multivariate Outlier Detection: Mahalanobis Distance

A point can be unremarkable on every single feature and still be a genuine multivariate outlier — Mahalanobis distance measures "how many standard deviations away, accounting for correlation between features," generalizing the univariate z-score to many dimensions at once:

```python
from scipy.spatial.distance import mahalanobis
from scipy.stats import chi2

cov = np.cov(X.values, rowvar=False)
inv_cov = np.linalg.inv(cov)
mean_vec = X.values.mean(axis=0)

m_dist = np.array([mahalanobis(row, mean_vec, inv_cov) for row in X.values])

# squared Mahalanobis distance ~ chi-square with df = number of features, under
# a multivariate-normal assumption — gives a principled cutoff rather than a
# hand-picked threshold
threshold = np.sqrt(chi2.ppf(0.975, df=X.shape[1]))
flagged = merged[m_dist > threshold]
print(f"threshold={threshold:.2f}, flagged={len(flagged)}")   # threshold=3.34, flagged=10
```

Compare this against the [Outlier Detection Cheatsheet](08_Outlier_Detection_Cheatsheet.md)'s Isolation Forest and Elliptic Envelope results on the same kind of data — Mahalanobis distance is the classical, distribution-assumption-based version of the same idea Elliptic Envelope implements more robustly under the hood.

## 🧭 Clustering as an Exploratory Tool

Clustering during EDA isn't about building a production segmentation model — it's a way to ask "does this data have natural groups at all," before you go looking for what defines them:

```python
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

for k in range(2, 6):
    km = KMeans(n_clusters=k, random_state=42, n_init=10).fit(Xs)
    sil = silhouette_score(Xs, km.labels_)
    print(f"k={k}: silhouette={sil:.3f}")
```

```
k=2: silhouette=0.368
k=3: silhouette=0.274
k=4: silhouette=0.264
k=5: silhouette=0.244
```

Silhouette score peaks at k=2 (0.368) and declines steadily after — evidence that this data naturally separates into two groups, not three, four, or five, however many a business stakeholder might have assumed going in. Profile the winning clusters before naming them:

```python
best = KMeans(n_clusters=2, random_state=42, n_init=10).fit(Xs)
merged["cluster"] = best.labels_
print(merged.groupby("cluster")[num_cols].mean().round(2))
```

```
         logins_per_month  session_minutes  features_used  support_tickets
cluster
0                   11.11            19.16           4.24             1.42
1                    5.08             9.97           1.93             2.85
```

The two clusters line up exactly with the "engagement" axis PCA already found — cluster 0 is the high-engagement group (more logins, more time, fewer tickets), cluster 1 the low-engagement group. Two independent methods converging on the same structure is much stronger evidence than either one alone.

## 📝 Worked Examples

**1. Confirming a single latent factor drives four observed metrics**

```python
pca = PCA(random_state=42).fit(Xs)
print(pca.explained_variance_ratio_.round(3))
# [0.698 0.157 0.083 0.062]
```

Verdict: with PC1 alone capturing 69.8% of the variance, a downstream model probably doesn't need all 4 raw behavioral columns — a single "engagement score" (PC1, or an equally-weighted composite guided by the loadings) captures most of the same information with a quarter of the dimensionality and no meaningful loss.

**2. Discovering natural customer groups before being told how many to expect**

```python
for k in range(2, 6):
    km = KMeans(n_clusters=k, random_state=42, n_init=10).fit(Xs)
    print(k, round(silhouette_score(Xs, km.labels_), 3))
# 2: 0.368 (best), 3: 0.274, 4: 0.264, 5: 0.244
```

Verdict: a product team assumed three engagement tiers ("power users," "regular," "at-risk") going in. The data supports two, not three — the silhouette score drops immediately past k=2. Worth raising before building a three-tier campaign around a distinction the data doesn't actually support as cleanly as a two-tier one.

**3. Flagging a multivariate outlier that no single-column check would catch**

```python
suspect = merged.loc[m_dist.argmax()]
print(suspect[num_cols])
# logins_per_month very high AND support_tickets very high — individually both
# plausible values, but an unusual *combination*
```

Verdict: a customer logging in frequently while also filing many support tickets is unusual only in combination — each value alone falls within a normal univariate range (neither the [Outlier Detection Cheatsheet](08_Outlier_Detection_Cheatsheet.md)'s IQR rule nor a simple z-score would flag either column). Mahalanobis distance catches exactly this kind of case, and it's worth a manual look: is this a power user hitting real product friction, or a data quality issue merging two records?

## ⚠️ Gotchas

- **Every distance-based method here (PCA, t-SNE, UMAP, Mahalanobis, K-means) requires standardized inputs** — skipping `StandardScaler` lets whichever column happens to have the largest numeric range dominate every result, regardless of its actual importance.
- **t-SNE and UMAP inter-cluster distances and cluster sizes are not meaningful** — two clusters that look close together (or far apart) in a t-SNE/UMAP plot are not necessarily close (or far) in the original feature space; only PCA preserves that global interpretation.
- **t-SNE's `perplexity` and UMAP's `n_neighbors` materially change the resulting shape** — treat the embedding as one particular view of the local structure, not the definitive picture; re-running with different settings that produce a similar overall grouping is much stronger evidence than a single run.
- **Mahalanobis distance's chi-square cutoff assumes multivariate normality** — on data that's heavily skewed or has its own outlier-driven covariance estimate (the covariance matrix itself is not robust to the outliers it's being used to detect), the cutoff is approximate at best; Elliptic Envelope's robust covariance estimate (in the [Outlier Detection Cheatsheet](08_Outlier_Detection_Cheatsheet.md)) is the more defensible choice when this matters.
- **K-means assumes roughly spherical, similarly-sized clusters** — it will impose that shape on data even when the true structure is elongated or unevenly sized; a silhouette score that's mediocre at every k is itself evidence that K-means may be the wrong tool, not that you haven't found the right k yet.
- **`np.linalg.inv(cov)` fails or becomes numerically unstable when features are highly collinear** — the same issue noted for the partial correlation matrix in the [Correlation Analysis Cheatsheet](07_Correlation_Analysis_Cheatsheet.md); check for near-duplicate columns before computing Mahalanobis distance.

## 🎯 Best Practices

1. **Standardize before doing anything distance-based** — it's the single most common mistake in every method on this page.
2. **Use PCA loadings to name components, not just plot them** — "PC1 = engagement" is a finding; "PC1 explains 70% of variance" alone is not yet an insight.
3. **Let the data suggest the number of clusters (via silhouette score or the PCA scree plot) before assuming a business-driven number is correct** — cross-check an assumed segmentation against what the structure actually supports.
4. **Treat t-SNE/UMAP as exploratory pictures, not a place to read off distances** — use PCA when the actual magnitude of separation matters, and t-SNE/UMAP when only local grouping does.
5. **Cross-check multivariate findings against a second method** — PCA and K-means converging on the same "engagement" structure in the worked examples above is far more trustworthy than either result standing alone.
