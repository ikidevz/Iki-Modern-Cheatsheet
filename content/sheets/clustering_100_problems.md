# 100 Clustering Analysis Problems with Solutions (Python / scikit-learn)

A practice set covering **Beginner → Intermediate → Advanced → Expert/Specialized** clustering problems, each with a problem statement, a working `scikit-learn` solution, and a short explanation of the output/concept.

**Setup** (run once):
```bash
pip install scikit-learn numpy pandas matplotlib scipy
# Problems 76-100 (Expert/Specialized) additionally use:
pip install hdbscan scikit-fuzzy umap-learn minisom
```

All code blocks are self-contained and build their own synthetic data with NumPy (customer, financial, supplier, and marketing scenarios) or scikit-learn's synthetic-data generators (`make_blobs`, `make_moons`, `make_circles`) — no bundled real-world datasets (Iris, Wine, Digits, sample images) are used, so every problem is framed around a finance, business, marketing, or logistics scenario. You can copy-paste and run each one directly.

---

## Table of Contents

### Part 1 — Beginner (1–25)
1. [K-Means on Synthetic Blobs](#1-k-means-on-synthetic-blobs)
2. [Elbow Method for Choosing K](#2-elbow-method-for-choosing-k)
3. [K-Means on Synthetic Marketing Campaign Data](#3-k-means-on-synthetic-marketing-campaign-data)
4. [Visualizing Cluster Centers](#4-visualizing-cluster-centers)
5. [Why Scaling Matters Before Clustering](#5-why-scaling-matters-before-clustering)
6. [Silhouette Score Basics](#6-silhouette-score-basics)
7. [K-Means++ vs Random Initialization](#7-k-means-vs-random-initialization)
8. [Predicting Clusters for New Points](#8-predicting-clusters-for-new-points)
9. [Comparing Inertia Across K Values](#9-comparing-inertia-across-k-values)
10. [Clustering in 3 Dimensions](#10-clustering-in-3-dimensions)
11. [MiniBatchKMeans for Speed](#11-minibatchkmeans-for-speed)
12. [Agglomerative Clustering & Dendrograms](#12-agglomerative-clustering--dendrograms)
13. [DBSCAN on Moon-Shaped Data](#13-dbscan-on-moon-shaped-data)
14. [K-Means vs DBSCAN on Non-Convex Shapes](#14-k-means-vs-dbscan-on-non-convex-shapes)
15. [Gaussian Mixture Models Basics](#15-gaussian-mixture-models-basics)
16. [Comparing Predicted vs True Labels (ARI)](#16-comparing-predicted-vs-true-labels-ari)
17. [One-Hot Encoding Categorical Features](#17-one-hot-encoding-categorical-features)
18. [PCA Before Clustering](#18-pca-before-clustering)
19. [Clustering Synthetic Supplier Performance Profiles](#19-clustering-synthetic-supplier-performance-profiles)
20. [Clustering with Min-Max Scaling](#20-clustering-with-min-max-scaling)
21. [Silhouette Analysis Across K](#21-silhouette-analysis-across-k)
22. [Silhouette Diagram Plot](#22-silhouette-diagram-plot)
23. [K-Means Limitation: Concentric Circles](#23-k-means-limitation-concentric-circles)
24. [Handling Missing Values Before Clustering](#24-handling-missing-values-before-clustering)
25. [Simple Customer Segmentation](#25-simple-customer-segmentation)

### Part 2 — Intermediate (26–55)
26. [Comparing Linkage Methods](#26-comparing-linkage-methods)
27. [Cutting a Dendrogram at a Distance Threshold](#27-cutting-a-dendrogram-at-a-distance-threshold)
28. [Tuning DBSCAN with a K-Distance Graph](#28-tuning-dbscan-with-a-k-distance-graph)
29. [OPTICS Clustering](#29-optics-clustering)
30. [Mean Shift with Bandwidth Estimation](#30-mean-shift-with-bandwidth-estimation)
31. [Spectral Clustering on Non-Linear Data](#31-spectral-clustering-on-non-linear-data)
32. [BIRCH for Large Datasets](#32-birch-for-large-datasets)
33. [GMM Covariance Types Compared](#33-gmm-covariance-types-compared)
34. [Choosing GMM Components with BIC/AIC](#34-choosing-gmm-components-with-bicaic)
35. [Clustering Mixed Categorical + Numerical Data](#35-clustering-mixed-categorical--numerical-data)
36. [Text Clustering with TF-IDF](#36-text-clustering-with-tf-idf)
37. [PCA + K-Means Pipeline on High-Dimensional Data](#37-pca--k-means-pipeline-on-high-dimensional-data)
38. [t-SNE for Cluster Visualization](#38-t-sne-for-cluster-visualization)
39. [Comparing Algorithms with Multiple Metrics](#39-comparing-algorithms-with-multiple-metrics)
40. [Cluster Stability via Bootstrap Resampling](#40-cluster-stability-via-bootstrap-resampling)
41. [Removing Outliers Before Clustering](#41-removing-outliers-before-clustering)
42. [Clustering Synthetic Customer Shopping Archetypes](#42-clustering-synthetic-customer-shopping-archetypes)
43. [Image Color Quantization with K-Means](#43-image-color-quantization-with-k-means)
44. [StandardScaler vs RobustScaler](#44-standardscaler-vs-robustscaler)
45. [Clustering with Weighted Features](#45-clustering-with-weighted-features)
46. [Seeding K-Means with Known Centroids](#46-seeding-k-means-with-known-centroids)
47. [Internal Validation Metrics Without Ground Truth](#47-internal-validation-metrics-without-ground-truth)
48. [External Validation Metrics With Ground Truth](#48-external-validation-metrics-with-ground-truth)
49. [Handling Imbalanced Cluster Sizes](#49-handling-imbalanced-cluster-sizes)
50. [Geospatial Clustering with Haversine DBSCAN](#50-geospatial-clustering-with-haversine-dbscan)
51. [Time-Series Clustering via Feature Extraction](#51-time-series-clustering-via-feature-extraction)
52. [Anomaly Detection via DBSCAN](#52-anomaly-detection-via-dbscan)
53. [RFM Customer Segmentation](#53-rfm-customer-segmentation)
54. [Full Preprocessing + PCA + Clustering Pipeline](#54-full-preprocessing--pca--clustering-pipeline)
55. [Choosing K via Multi-Seed Stability](#55-choosing-k-via-multi-seed-stability)

### Part 3 — Advanced (56–75)
56. [Consensus (Ensemble) Clustering](#56-consensus-ensemble-clustering)
57. [Clustering with a Precomputed Distance Matrix](#57-clustering-with-a-precomputed-distance-matrix)
58. [Spectral Biclustering](#58-spectral-biclustering)
59. [Soft Clustering with GMM Probabilities](#59-soft-clustering-with-gmm-probabilities)
60. [Hierarchical Density Clustering (OPTICS Xi Method)](#60-hierarchical-density-clustering-optics-xi-method)
61. [Clustering with Mahalanobis Distance](#61-clustering-with-mahalanobis-distance)
62. [Feature Selection Before Clustering](#62-feature-selection-before-clustering)
63. [Incremental Clustering with partial_fit](#63-incremental-clustering-with-partial_fit)
64. [Using Cluster Labels as Features for Classification](#64-using-cluster-labels-as-features-for-classification)
65. [Cluster-Based Missing Value Imputation](#65-cluster-based-missing-value-imputation)
66. [Estimating K with the Gap Statistic](#66-estimating-k-with-the-gap-statistic)
67. [Multi-Modal Data: GMM vs K-Means](#67-multi-modal-data-gmm-vs-k-means)
68. [Constrained Clustering (Must-Link / Cannot-Link)](#68-constrained-clustering-must-link--cannot-link)
69. [Full Random-Seed Stability Assessment](#69-full-random-seed-stability-assessment)
70. [Comparing Dimensionality Reduction Methods for Clustering](#70-comparing-dimensionality-reduction-methods-for-clustering)
71. [Topic-Based Document Clustering with LDA](#71-topic-based-document-clustering-with-lda)
72. [Spectral Clustering on Graph Data](#72-spectral-clustering-on-graph-data)
73. [End-to-End Customer Segmentation Project](#73-end-to-end-customer-segmentation-project)
74. [The Curse of Dimensionality in Clustering](#74-the-curse-of-dimensionality-in-clustering)
75. [Building a Reusable Clustering Evaluation Framework](#75-building-a-reusable-clustering-evaluation-framework)

### Part 4 — Expert / Specialized (76–100)
76. [Fuzzy C-Means Soft Clustering](#76-fuzzy-c-means-soft-clustering)
77. [HDBSCAN for Variable-Density Clusters](#77-hdbscan-for-variable-density-clusters)
78. [Self-Organizing Maps for Clustering](#78-self-organizing-maps-for-clustering)
79. [Subspace Clustering via Feature Subsets](#79-subspace-clustering-via-feature-subsets)
80. [Per-Cluster Silhouette Diagnostic Plot](#80-per-cluster-silhouette-diagnostic-plot)
81. [Clustering Document Embeddings](#81-clustering-document-embeddings)
82. [Autoencoder-Based Deep Clustering](#82-autoencoder-based-deep-clustering)
83. [Clustering with Cosine Distance for Text/Embeddings](#83-clustering-with-cosine-distance-for-textembeddings)
84. [Biclustering (Co-Clustering) Rows and Columns](#84-biclustering-co-clustering-rows-and-columns)
85. [Sliding-Window Streaming Clustering](#85-sliding-window-streaming-clustering)
86. [K-Modes for Pure Categorical Data](#86-k-modes-for-pure-categorical-data)
87. [Dunn Index for Cluster Validity](#87-dunn-index-for-cluster-validity)
88. [Semi-Supervised Clustering with Label Propagation](#88-semi-supervised-clustering-with-label-propagation)
89. [Density-Based Algorithm Face-Off: DBSCAN vs HDBSCAN vs OPTICS](#89-density-based-algorithm-face-off-dbscan-vs-hdbscan-vs-optics)
90. [Cluster-and-Extend for Large-Scale Data](#90-cluster-and-extend-for-large-scale-data)
91. [Cluster-Based Anomaly Scoring](#91-cluster-based-anomaly-scoring)
92. [Multi-View Clustering on Concatenated Feature Sets](#92-multi-view-clustering-on-concatenated-feature-sets)
93. [Time-Series Clustering with Dynamic Time Warping](#93-time-series-clustering-with-dynamic-time-warping)
94. [Weighted K-Means for Business-Critical Points](#94-weighted-k-means-for-business-critical-points)
95. [Explaining Clusters with a Surrogate Decision Tree](#95-explaining-clusters-with-a-surrogate-decision-tree)
96. [Frequency Encoding High-Cardinality Categoricals Before Clustering](#96-frequency-encoding-high-cardinality-categoricals-before-clustering)
97. [Cluster Stability via Adjusted Mutual Information](#97-cluster-stability-via-adjusted-mutual-information)
98. [Two-Stage Coarse-to-Fine Clustering](#98-two-stage-coarse-to-fine-clustering)
99. [Visualizing Clusters with UMAP](#99-visualizing-clusters-with-umap)
100. [A Production-Ready sklearn Pipeline for Clustering](#100-a-production-ready-sklearn-pipeline-for-clustering)

---

# Part 1 — Beginner

## 1. K-Means on Synthetic Blobs
**Problem:** Generate 300 2D points forming 4 natural groups, fit K-Means with `k=4`, and plot the result with cluster centers marked.

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X, y_true = make_blobs(n_samples=300, centers=4, cluster_std=0.60, random_state=42)

kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
labels = kmeans.fit_predict(X)

plt.scatter(X[:, 0], X[:, 1], c=labels, cmap='viridis', s=30)
centers = kmeans.cluster_centers_
plt.scatter(centers[:, 0], centers[:, 1], c='red', marker='X', s=200, label='Centroids')
plt.legend()
plt.title("K-Means Clustering (k=4)")
plt.show()
```
**Explanation:** `fit_predict` fits the model and returns a cluster label per point in one step. `cluster_centers_` holds the final centroid coordinates. K-Means works well here because the blobs are roughly spherical and equally sized — its ideal use case.

---

## 2. Elbow Method for Choosing K
**Problem:** For the same blob data, plot inertia (within-cluster sum of squares) for `k = 1..10` to visually find the "elbow".

```python
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=300, centers=4, cluster_std=0.60, random_state=42)

inertias = []
K_range = range(1, 11)
for k in K_range:
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    km.fit(X)
    inertias.append(km.inertia_)

plt.plot(K_range, inertias, marker='o')
plt.xlabel("Number of clusters (k)")
plt.ylabel("Inertia")
plt.title("Elbow Method")
plt.show()
```
**Explanation:** Inertia always decreases as `k` increases, but the rate of decrease slows sharply after the "true" number of clusters — that bend is the elbow. Here it should appear around `k=4`.

---

## 3. K-Means on Synthetic Marketing Campaign Data
**Problem:** Cluster synthetic marketing campaign data (Click-Through Rate vs Cost per Acquisition) into 3 groups and compare visually against the true acquisition channel.

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans

rng = np.random.RandomState(42)
n = 100

# Simulate 3 acquisition channels with distinct CTR / CPA profiles
organic  = np.column_stack([rng.normal(4.5, 0.6, n), rng.normal(8, 2, n)])    # high CTR, low CPA
paid_ads = np.column_stack([rng.normal(2.0, 0.5, n), rng.normal(25, 4, n)])   # low CTR, high CPA
email    = np.column_stack([rng.normal(6.5, 0.7, n), rng.normal(4, 1.5, n)]) # highest CTR, lowest CPA

X = np.vstack([organic, paid_ads, email])
y_true = np.array([0]*n + [1]*n + [2]*n)

kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
labels = kmeans.fit_predict(X)

fig, axes = plt.subplots(1, 2, figsize=(10, 4))
axes[0].scatter(X[:, 0], X[:, 1], c=labels, cmap='viridis')
axes[0].set_xlabel("Click-Through Rate (%)"); axes[0].set_ylabel("Cost per Acquisition ($)")
axes[0].set_title("K-Means Clusters")
axes[1].scatter(X[:, 0], X[:, 1], c=y_true, cmap='viridis')
axes[1].set_title("True Acquisition Channel")
plt.show()
```
**Explanation:** Because CTR and CPA genuinely differ by channel (organic search converts cheaply, paid ads cost more per click, email sits in between), unsupervised K-Means recovers groupings that closely match the true channel labels — a nice sanity check that clustering can rediscover real business structure.

---

## 4. Visualizing Cluster Centers
**Problem:** After fitting K-Means, print each centroid's coordinates and annotate them directly on the scatter plot.

```python
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=200, centers=3, random_state=7)
kmeans = KMeans(n_clusters=3, random_state=7, n_init=10).fit(X)

plt.scatter(X[:, 0], X[:, 1], c=kmeans.labels_, cmap='cool', alpha=0.6)
for i, (cx, cy) in enumerate(kmeans.cluster_centers_):
    plt.scatter(cx, cy, c='black', marker='*', s=250)
    plt.annotate(f"C{i}: ({cx:.2f}, {cy:.2f})", (cx, cy), textcoords="offset points", xytext=(10, 10))
plt.title("Cluster Centers")
plt.show()
```
**Explanation:** `kmeans.labels_` stores the label assigned during training (equivalent to `fit_predict`'s output). Annotating centroids helps communicate results to non-technical stakeholders — e.g., "Cluster 0 is centered at these average values."

---

## 5. Why Scaling Matters Before Clustering
**Problem:** Show how an unscaled feature with a much larger numeric range distorts K-Means clustering, then fix it with `StandardScaler`.

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

rng = np.random.RandomState(0)
# Feature 1: small range, Feature 2: large range (e.g., income in dollars)
f1 = np.concatenate([rng.normal(0, 1, 100), rng.normal(5, 1, 100)])
f2 = np.concatenate([rng.normal(0, 1000, 100), rng.normal(5000, 1000, 100)])
X = np.column_stack([f1, f2])

labels_unscaled = KMeans(n_clusters=2, random_state=0, n_init=10).fit_predict(X)

X_scaled = StandardScaler().fit_transform(X)
labels_scaled = KMeans(n_clusters=2, random_state=0, n_init=10).fit_predict(X_scaled)

fig, axes = plt.subplots(1, 2, figsize=(10, 4))
axes[0].scatter(X[:, 0], X[:, 1], c=labels_unscaled); axes[0].set_title("Unscaled")
axes[1].scatter(X[:, 0], X[:, 1], c=labels_scaled); axes[1].set_title("Scaled")
plt.show()
```
**Explanation:** K-Means uses Euclidean distance, so a feature measured in the thousands (like income) dominates the distance calculation over a feature ranging 0–5. `StandardScaler` (mean 0, std 1) puts features on equal footing so clustering reflects both dimensions fairly.

---

## 6. Silhouette Score Basics
**Problem:** Compute the average silhouette score for a K-Means clustering with `k=4` on blob data.

```python
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
from sklearn.metrics import silhouette_score

X, _ = make_blobs(n_samples=300, centers=4, cluster_std=0.6, random_state=42)
labels = KMeans(n_clusters=4, random_state=42, n_init=10).fit_predict(X)

score = silhouette_score(X, labels)
print(f"Silhouette Score: {score:.3f}")
```
**Explanation:** The silhouette score ranges from -1 to 1: values near 1 mean points sit well inside their own cluster and far from neighboring clusters; near 0 means overlapping clusters; negative means likely mis-assigned points. Well-separated blobs typically score above 0.6.

---

## 7. K-Means++ vs Random Initialization
**Problem:** Compare final inertia when using `init='k-means++'` versus `init='random'` over multiple runs.

```python
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=500, centers=6, cluster_std=1.0, random_state=1)

km_plus = KMeans(n_clusters=6, init='k-means++', n_init=10, random_state=1).fit(X)
km_rand = KMeans(n_clusters=6, init='random', n_init=10, random_state=1).fit(X)

print(f"k-means++ inertia: {km_plus.inertia_:.2f}")
print(f"random inertia:    {km_rand.inertia_:.2f}")
```
**Explanation:** `k-means++` spreads initial centroids apart intelligently (probabilistically favoring far-apart points), reducing the chance of poor local minima. It usually converges to lower (better) inertia and needs fewer restarts than plain random init — which is why it's scikit-learn's default.

---

## 8. Predicting Clusters for New Points
**Problem:** Fit K-Means on training data, then assign cluster labels to brand-new, unseen points.

```python
import numpy as np
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X_train, _ = make_blobs(n_samples=300, centers=3, random_state=42)
kmeans = KMeans(n_clusters=3, random_state=42, n_init=10).fit(X_train)

new_points = np.array([[0, 0], [5, 5], [-5, -5]])
predicted = kmeans.predict(new_points)
print("New point cluster assignments:", predicted)
```
**Explanation:** Unlike DBSCAN or Agglomerative Clustering, K-Means learns explicit centroids, so it naturally supports `.predict()` on new data — it simply assigns each new point to its nearest centroid.

---

## 9. Comparing Inertia Across K Values
**Problem:** Print a table of `k` vs inertia vs silhouette score for `k = 2..8` to compare selection methods side-by-side.

```python
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
from sklearn.metrics import silhouette_score

X, _ = make_blobs(n_samples=400, centers=5, cluster_std=0.8, random_state=3)

print(f"{'k':>3} {'Inertia':>12} {'Silhouette':>12}")
for k in range(2, 9):
    labels = KMeans(n_clusters=k, random_state=3, n_init=10).fit_predict(X)
    inertia = KMeans(n_clusters=k, random_state=3, n_init=10).fit(X).inertia_
    sil = silhouette_score(X, labels)
    print(f"{k:>3} {inertia:>12.1f} {sil:>12.3f}")
```
**Explanation:** Inertia alone always favors more clusters (it keeps dropping), while silhouette score peaks near the true cluster count and then declines — this makes silhouette generally more reliable for picking `k`, especially when the elbow is ambiguous.

---

## 10. Clustering in 3 Dimensions
**Problem:** Generate 3D synthetic data with 3 clusters and visualize the result in a 3D scatter plot.

```python
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=300, centers=3, n_features=3, random_state=42)
labels = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(X)

fig = plt.figure(figsize=(7, 6))
ax = fig.add_subplot(111, projection='3d')
ax.scatter(X[:, 0], X[:, 1], X[:, 2], c=labels, cmap='viridis')
ax.set_xlabel('Feature 1'); ax.set_ylabel('Feature 2'); ax.set_zlabel('Feature 3')
plt.title("3D K-Means Clustering")
plt.show()
```
**Explanation:** K-Means works identically regardless of dimensionality — it just computes Euclidean distance in however many dimensions the data has. Visualization becomes the bottleneck past 3D, which is why techniques like PCA/t-SNE (later problems) become important for higher-dimensional data.

---

## 11. MiniBatchKMeans for Speed
**Problem:** Compare training time and clustering quality of `KMeans` vs `MiniBatchKMeans` on a larger dataset (50,000 points).

```python
import time
from sklearn.cluster import KMeans, MiniBatchKMeans
from sklearn.datasets import make_blobs
from sklearn.metrics import silhouette_score

X, _ = make_blobs(n_samples=50000, centers=8, random_state=42)

t0 = time.time()
labels_full = KMeans(n_clusters=8, random_state=42, n_init=10).fit_predict(X)
t_full = time.time() - t0

t0 = time.time()
labels_mb = MiniBatchKMeans(n_clusters=8, random_state=42, batch_size=256, n_init=10).fit_predict(X)
t_mb = time.time() - t0

print(f"KMeans:          {t_full:.2f}s, silhouette={silhouette_score(X, labels_full):.3f}")
print(f"MiniBatchKMeans: {t_mb:.2f}s, silhouette={silhouette_score(X, labels_mb):.3f}")
```
**Explanation:** `MiniBatchKMeans` updates centroids using small random subsets ("mini-batches") each iteration instead of the full dataset, dramatically speeding up training on large data at a small, usually acceptable, cost in cluster quality.

---

## 12. Agglomerative Clustering & Dendrograms
**Problem:** Perform hierarchical clustering and visualize the merge history as a dendrogram.

```python
import matplotlib.pyplot as plt
from scipy.cluster.hierarchy import dendrogram, linkage
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=30, centers=3, random_state=42)

Z = linkage(X, method='ward')
dendrogram(Z)
plt.title("Hierarchical Clustering Dendrogram")
plt.xlabel("Sample index")
plt.ylabel("Distance")
plt.show()
```
**Explanation:** A dendrogram shows the full merge history: leaves are individual points, and each join shows the distance at which two clusters were merged. Cutting the tree horizontally at some height yields a chosen number of flat clusters — taller vertical gaps suggest natural cut points.

---

## 13. DBSCAN on Moon-Shaped Data
**Problem:** Cluster two interleaving crescent ("moon") shapes, which K-Means cannot separate correctly, using DBSCAN.

```python
import matplotlib.pyplot as plt
from sklearn.cluster import DBSCAN
from sklearn.datasets import make_moons

X, _ = make_moons(n_samples=300, noise=0.07, random_state=42)
labels = DBSCAN(eps=0.2, min_samples=5).fit_predict(X)

plt.scatter(X[:, 0], X[:, 1], c=labels, cmap='viridis')
plt.title("DBSCAN on Moon Data")
plt.show()
```
**Explanation:** DBSCAN groups points based on density (points with enough neighbors within `eps`) rather than distance to a centroid, so it can trace arbitrarily shaped clusters like crescents. Points in low-density regions are labeled `-1` (noise).

---

## 14. K-Means vs DBSCAN on Non-Convex Shapes
**Problem:** Run both algorithms on the same moon dataset side-by-side to visually demonstrate K-Means' key limitation.

```python
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans, DBSCAN
from sklearn.datasets import make_moons

X, _ = make_moons(n_samples=300, noise=0.07, random_state=42)

km_labels = KMeans(n_clusters=2, random_state=42, n_init=10).fit_predict(X)
db_labels = DBSCAN(eps=0.2, min_samples=5).fit_predict(X)

fig, axes = plt.subplots(1, 2, figsize=(10, 4))
axes[0].scatter(X[:, 0], X[:, 1], c=km_labels, cmap='viridis'); axes[0].set_title("K-Means (fails)")
axes[1].scatter(X[:, 0], X[:, 1], c=db_labels, cmap='viridis'); axes[1].set_title("DBSCAN (succeeds)")
plt.show()
```
**Explanation:** K-Means assumes convex, roughly spherical clusters because it partitions space using straight-line (Voronoi) boundaries around centroids — it slices right through the crescents. DBSCAN has no such shape assumption, so it correctly separates the two moons.

---

## 15. Gaussian Mixture Models Basics
**Problem:** Fit a Gaussian Mixture Model with 3 components and compare its "soft" clustering to K-Means' "hard" clustering.

```python
import matplotlib.pyplot as plt
from sklearn.mixture import GaussianMixture
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=300, centers=3, cluster_std=1.2, random_state=42)

gmm = GaussianMixture(n_components=3, random_state=42)
labels = gmm.fit_predict(X)

plt.scatter(X[:, 0], X[:, 1], c=labels, cmap='viridis')
plt.scatter(gmm.means_[:, 0], gmm.means_[:, 1], c='red', marker='X', s=200)
plt.title("Gaussian Mixture Model Clustering")
plt.show()
```
**Explanation:** GMM models each cluster as a Gaussian distribution (with its own mean and covariance/shape) rather than a single point, letting clusters be elliptical rather than only spherical. `fit_predict` here returns the most likely component per point, but GMM can also output full probability distributions (see Problem 59).

---

## 16. Comparing Predicted vs True Labels (ARI)
**Problem:** Quantify how well K-Means recovers true labels using the Adjusted Rand Index.

```python
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
from sklearn.metrics import adjusted_rand_score

X, y_true = make_blobs(n_samples=300, centers=4, cluster_std=0.6, random_state=42)
y_pred = KMeans(n_clusters=4, random_state=42, n_init=10).fit_predict(X)

ari = adjusted_rand_score(y_true, y_pred)
print(f"Adjusted Rand Index: {ari:.3f}")
```
**Explanation:** ARI compares two labelings while correcting for chance agreement, and — unlike raw accuracy — it doesn't care that cluster "0" in the prediction might correspond to true label "2". A score of 1.0 means perfect agreement; ~0 means random labeling.

---

## 17. One-Hot Encoding Categorical Features
**Problem:** Cluster a small dataset that mixes a categorical column ("city") with numeric columns, after one-hot encoding.

```python
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer

df = pd.DataFrame({
    'age': [25, 45, 32, 51, 23, 40],
    'income': [40000, 85000, 52000, 90000, 38000, 78000],
    'city': ['NY', 'LA', 'NY', 'SF', 'LA', 'SF']
})

preprocess = ColumnTransformer([
    ('num', StandardScaler(), ['age', 'income']),
    ('cat', OneHotEncoder(), ['city'])
])
X = preprocess.fit_transform(df)

labels = KMeans(n_clusters=2, random_state=0, n_init=10).fit_predict(X)
df['cluster'] = labels
print(df)
```
**Explanation:** K-Means requires numeric input, so categorical columns must be encoded first. One-hot encoding avoids implying a false order (e.g., "LA=1, NY=2, SF=3" would wrongly suggest SF is "more" than NY), at the cost of adding one binary column per category.

---

## 18. PCA Before Clustering
**Problem:** Reduce a synthetic 4-feature company financial health dataset to 2 principal components before clustering, to enable visualization.

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

rng = np.random.RandomState(42)
n = 60

def make_tier(revenue_growth, margin, debt_ratio, cash_flow, n):
    return np.column_stack([
        rng.normal(revenue_growth, 3, n),
        rng.normal(margin, 4, n),
        rng.normal(debt_ratio, 0.15, n),
        rng.normal(cash_flow, 0.2, n)
    ])

distressed  = make_tier(-8, 2,  1.8, 0.3, n)   # revenue shrinking, thin margin, high debt
stable      = make_tier(3,  12, 0.8, 1.0, n)   # steady performer
high_growth = make_tier(22, 18, 0.5, 1.6, n)   # fast-growing, healthy balance sheet

X = np.vstack([distressed, stable, high_growth])  # 4 features: growth%, margin%, debt ratio, cash flow ratio

X_scaled = StandardScaler().fit_transform(X)
X_pca = PCA(n_components=2).fit_transform(X_scaled)

labels = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(X_pca)

plt.scatter(X_pca[:, 0], X_pca[:, 1], c=labels, cmap='viridis')
plt.xlabel("PC1"); plt.ylabel("PC2")
plt.title("K-Means on Company Financial Health (after PCA)")
plt.show()
```
**Explanation:** PCA projects data onto the directions (principal components) of maximum variance, letting you compress many features (here: revenue growth, margin, debt ratio, cash flow) into 2–3 dimensions for plotting while retaining most of the structure — useful whenever you have more than 3 original features, such as a multi-metric financial health scorecard.

---

## 19. Clustering Synthetic Supplier Performance Profiles
**Problem:** Apply K-Means to a synthetic supplier scorecard (10 procurement/logistics metrics) and evaluate against the true supplier tier.

```python
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score

rng = np.random.RandomState(42)
n = 60

def make_supplier_tier(means, n):
    return np.column_stack([rng.normal(m, abs(m) * 0.08 + 1, n) for m in means])

# columns: on_time_delivery%, defect_ppm, cost_variance%, lead_time_days, capacity_util%,
#          quality_score, compliance_score, order_accuracy%, response_hrs, financial_stability
tier1 = make_supplier_tier([98, 50,  1.5, 3,  92, 95, 98, 99,  2, 96], n)   # Strategic
tier2 = make_supplier_tier([90, 300, 4.0, 7,  78, 82, 88, 93,  8, 84], n)   # Preferred
tier3 = make_supplier_tier([75, 900, 9.0, 14, 60, 65, 70, 82, 20, 60], n)   # Transactional

X = np.vstack([tier1, tier2, tier3])
y_true = np.array([0] * n + [1] * n + [2] * n)

X_scaled = StandardScaler().fit_transform(X)
labels = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(X_scaled)
print(f"ARI vs true supplier tier: {adjusted_rand_score(y_true, labels):.3f}")
```
**Explanation:** Scaling is essential here because the 10 metrics have very different units (e.g., "defect PPM" runs into the hundreds while "response hours" is single digits). With scaling, K-Means typically recovers the 3 supplier tiers quite well (ARI often above 0.8) — a realistic procurement-analytics use case for segmenting a vendor base.

---

## 20. Clustering with Min-Max Scaling
**Problem:** Repeat the supplier scorecard clustering task using `MinMaxScaler` (0–1 range) instead of `StandardScaler`, and compare results.

```python
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score

rng = np.random.RandomState(42)
n = 60

def make_supplier_tier(means, n):
    return np.column_stack([rng.normal(m, abs(m) * 0.08 + 1, n) for m in means])

tier1 = make_supplier_tier([98, 50,  1.5, 3,  92, 95, 98, 99,  2, 96], n)
tier2 = make_supplier_tier([90, 300, 4.0, 7,  78, 82, 88, 93,  8, 84], n)
tier3 = make_supplier_tier([75, 900, 9.0, 14, 60, 65, 70, 82, 20, 60], n)

X = np.vstack([tier1, tier2, tier3])
y_true = np.array([0] * n + [1] * n + [2] * n)

X_minmax = MinMaxScaler().fit_transform(X)
labels = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(X_minmax)
print(f"ARI (MinMax scaled): {adjusted_rand_score(y_true, labels):.3f}")
```
**Explanation:** `MinMaxScaler` squeezes every feature into `[0, 1]` based on its min/max, which is more sensitive to outliers than `StandardScaler` (a single extreme value compresses everything else). Both usually work fine for well-behaved data; choose `MinMaxScaler` for bounded features or neural-network-adjacent pipelines, and `StandardScaler` when outliers (like a defect-rate spike from one bad supplier) are a concern.

---

## 21. Silhouette Analysis Across K
**Problem:** Loop over `k = 2..10`, compute silhouette scores, and print the best `k`.

```python
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
from sklearn.metrics import silhouette_score

X, _ = make_blobs(n_samples=500, centers=5, cluster_std=0.9, random_state=10)

best_k, best_score = None, -1
for k in range(2, 11):
    labels = KMeans(n_clusters=k, random_state=10, n_init=10).fit_predict(X)
    score = silhouette_score(X, labels)
    print(f"k={k}: silhouette={score:.3f}")
    if score > best_score:
        best_k, best_score = k, score

print(f"\nBest k = {best_k} (silhouette={best_score:.3f})")
```
**Explanation:** Automating the search removes guesswork from the elbow method. Silhouette score is bounded and comparable across different `k`, making "pick the k with the highest score" a reasonable, simple heuristic — though it should be sanity-checked against domain knowledge.

---

## 22. Silhouette Diagram Plot
**Problem:** Draw the classic per-sample silhouette plot (horizontal bars per cluster) for `k=3`.

```python
import matplotlib.pyplot as plt
import matplotlib.cm as cm
import numpy as np
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
from sklearn.metrics import silhouette_samples, silhouette_score

X, _ = make_blobs(n_samples=300, centers=3, cluster_std=0.8, random_state=42)
labels = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(X)
sil_values = silhouette_samples(X, labels)
avg_score = silhouette_score(X, labels)

fig, ax = plt.subplots(figsize=(7, 5))
y_lower = 10
for i in range(3):
    cluster_sil = np.sort(sil_values[labels == i])
    size = cluster_sil.shape[0]
    y_upper = y_lower + size
    color = cm.viridis(i / 3)
    ax.fill_betweenx(np.arange(y_lower, y_upper), 0, cluster_sil, facecolor=color)
    y_lower = y_upper + 10

ax.axvline(x=avg_score, color="red", linestyle="--", label=f"Average = {avg_score:.2f}")
ax.set_xlabel("Silhouette coefficient")
ax.set_ylabel("Cluster")
ax.legend()
plt.title("Silhouette Plot")
plt.show()
```
**Explanation:** Beyond the single average score, per-sample silhouette values reveal whether *every* cluster is well-formed or if one cluster is dragging the average down (thin, low, or negative bars) while others look great — a diagnostic the average score alone hides.

---

## 23. K-Means Limitation: Concentric Circles
**Problem:** Demonstrate that K-Means also fails on concentric circles, and confirm DBSCAN handles it correctly.

```python
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans, DBSCAN
from sklearn.datasets import make_circles

X, _ = make_circles(n_samples=300, factor=0.4, noise=0.05, random_state=42)

km_labels = KMeans(n_clusters=2, random_state=42, n_init=10).fit_predict(X)
db_labels = DBSCAN(eps=0.15, min_samples=5).fit_predict(X)

fig, axes = plt.subplots(1, 2, figsize=(10, 4))
axes[0].scatter(X[:, 0], X[:, 1], c=km_labels, cmap='viridis'); axes[0].set_title("K-Means")
axes[1].scatter(X[:, 0], X[:, 1], c=db_labels, cmap='viridis'); axes[1].set_title("DBSCAN")
plt.show()
```
**Explanation:** An inner circle and an outer ring share the same centroid, so K-Means (which only "sees" distance-to-centroid) cannot separate them — it instead cuts both rings in half. DBSCAN correctly identifies the ring and the core as two distinct density regions.

---

## 24. Handling Missing Values Before Clustering
**Problem:** Impute missing values in a small dataset with `SimpleImputer` before clustering, since K-Means cannot handle NaNs.

```python
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.cluster import KMeans

df = pd.DataFrame({
    'a': [1.0, 2.0, np.nan, 4.0, 5.0, np.nan],
    'b': [10, np.nan, 30, 40, np.nan, 60]
})

imputer = SimpleImputer(strategy='mean')
X = imputer.fit_transform(df)

labels = KMeans(n_clusters=2, random_state=0, n_init=10).fit_predict(X)
print("Imputed data:\n", X)
print("Labels:", labels)
```
**Explanation:** K-Means (and most sklearn clustering algorithms) will raise an error on `NaN` inputs. Mean imputation is a quick, simple fix for small amounts of missingness; for larger gaps, consider `KNNImputer` or model-based imputation (see Problem 65) to avoid distorting cluster structure.

---

## 25. Simple Customer Segmentation
**Problem:** Segment customers into groups based on `Annual Income` and `Spending Score` — a classic beginner business use case.

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans

rng = np.random.RandomState(1)
income = np.concatenate([rng.normal(25, 5, 50), rng.normal(60, 8, 50), rng.normal(90, 6, 50)])
spending = np.concatenate([rng.normal(20, 10, 50), rng.normal(50, 15, 50), rng.normal(85, 8, 50)])
X = np.column_stack([income, spending])

kmeans = KMeans(n_clusters=3, random_state=1, n_init=10)
labels = kmeans.fit_predict(X)

plt.scatter(X[:, 0], X[:, 1], c=labels, cmap='rainbow')
plt.xlabel("Annual Income (k$)"); plt.ylabel("Spending Score")
plt.title("Customer Segments")
plt.show()

for i in range(3):
    seg = X[labels == i]
    print(f"Segment {i}: avg income=${seg[:,0].mean():.1f}k, avg spending={seg[:,1].mean():.1f}")
```
**Explanation:** This is the textbook retail/marketing use of clustering: no labels exist upfront ("who is a high-value customer?"), so clustering discovers natural groups (e.g., low-income/low-spend, mid-income/mid-spend, high-income/high-spend) that marketing teams can then target with different strategies.

---
# Part 2 — Intermediate

## 26. Comparing Linkage Methods
**Problem:** Compare `ward`, `complete`, `average`, and `single` linkage on the same dataset to see how cluster shapes differ.

```python
import matplotlib.pyplot as plt
from sklearn.cluster import AgglomerativeClustering
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=200, centers=4, cluster_std=1.0, random_state=42)

linkages = ['ward', 'complete', 'average', 'single']
fig, axes = plt.subplots(1, 4, figsize=(16, 4))
for ax, link in zip(axes, linkages):
    labels = AgglomerativeClustering(n_clusters=4, linkage=link).fit_predict(X)
    ax.scatter(X[:, 0], X[:, 1], c=labels, cmap='viridis')
    ax.set_title(link)
plt.show()
```
**Explanation:** `ward` minimizes within-cluster variance (tends to give even-sized, spherical clusters); `complete` uses max pairwise distance (compact clusters, sensitive to outliers); `average` uses mean pairwise distance (a balance); `single` uses min pairwise distance (can chain into long, straggly clusters — prone to the "chaining effect").

---

## 27. Cutting a Dendrogram at a Distance Threshold
**Problem:** Instead of specifying `n_clusters`, cut the hierarchy at a chosen distance threshold to let the number of clusters emerge naturally.

```python
import matplotlib.pyplot as plt
from scipy.cluster.hierarchy import dendrogram, linkage, fcluster
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=50, centers=4, cluster_std=0.7, random_state=42)
Z = linkage(X, method='ward')

dendrogram(Z, color_threshold=10)
plt.axhline(y=10, color='gray', linestyle='--')
plt.title("Dendrogram with Cut Threshold")
plt.show()

labels = fcluster(Z, t=10, criterion='distance')
print("Number of clusters found:", len(set(labels)))
```
**Explanation:** `fcluster` with `criterion='distance'` cuts the tree wherever merge distances exceed `t`, so you don't need to pre-decide `k` — instead you decide "how different must two clusters be to stay separate," which can be more interpretable in some domains (e.g., biological taxonomy).

---

## 28. Tuning DBSCAN with a K-Distance Graph
**Problem:** Use the k-distance graph technique to choose a good `eps` value for DBSCAN.

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.neighbors import NearestNeighbors
from sklearn.datasets import make_moons

X, _ = make_moons(n_samples=300, noise=0.08, random_state=42)

k = 5  # = min_samples
neighbors = NearestNeighbors(n_neighbors=k).fit(X)
distances, _ = neighbors.kneighbors(X)
k_distances = np.sort(distances[:, k - 1])

plt.plot(k_distances)
plt.ylabel(f"{k}-th nearest neighbor distance")
plt.xlabel("Points sorted by distance")
plt.title("K-Distance Graph")
plt.show()
```
**Explanation:** Sorting each point's distance to its `k`-th nearest neighbor and plotting it produces a curve with a "knee" — the y-value at that knee is a strong candidate for `eps`, since it marks where points transition from dense (small distance) to sparse (large distance) regions.

---

## 29. OPTICS Clustering
**Problem:** Use OPTICS to cluster data with varying densities, which DBSCAN's single fixed `eps` struggles with.

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import OPTICS
from sklearn.datasets import make_blobs

X1, _ = make_blobs(n_samples=100, centers=[[0, 0]], cluster_std=0.3, random_state=1)
X2, _ = make_blobs(n_samples=100, centers=[[5, 5]], cluster_std=1.2, random_state=1)
X = np.vstack([X1, X2])

optics = OPTICS(min_samples=10, xi=0.05, min_cluster_size=0.05)
labels = optics.fit_predict(X)

plt.scatter(X[:, 0], X[:, 1], c=labels, cmap='viridis')
plt.title("OPTICS Clustering (varying density)")
plt.show()
```
**Explanation:** OPTICS builds a "reachability plot" that captures density variation across the whole dataset rather than a single global `eps`, letting it separate a tight, dense cluster and a loose, sparse cluster that DBSCAN (with one fixed `eps`) would either merge or shatter.

---

## 30. Mean Shift with Bandwidth Estimation
**Problem:** Use Mean Shift clustering, which automatically discovers the number of clusters, and estimate a good bandwidth first.

```python
import matplotlib.pyplot as plt
from sklearn.cluster import MeanShift, estimate_bandwidth
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=300, centers=4, cluster_std=0.8, random_state=42)

bandwidth = estimate_bandwidth(X, quantile=0.2, n_samples=300)
ms = MeanShift(bandwidth=bandwidth)
labels = ms.fit_predict(X)

print(f"Estimated bandwidth: {bandwidth:.2f}")
print(f"Number of clusters found: {len(set(labels))}")

plt.scatter(X[:, 0], X[:, 1], c=labels, cmap='viridis')
plt.scatter(ms.cluster_centers_[:, 0], ms.cluster_centers_[:, 1], c='red', marker='X', s=200)
plt.title("Mean Shift Clustering")
plt.show()
```
**Explanation:** Mean Shift iteratively shifts candidate centroids toward the densest nearby region (mode-seeking) until convergence, and the number of unique convergence points *becomes* the number of clusters — no need to specify `k` upfront, unlike K-Means or GMM.

---

## 31. Spectral Clustering on Non-Linear Data
**Problem:** Use spectral clustering — which relies on graph theory rather than raw distance — on non-convex shapes.

```python
import matplotlib.pyplot as plt
from sklearn.cluster import SpectralClustering
from sklearn.datasets import make_moons

X, _ = make_moons(n_samples=300, noise=0.07, random_state=42)

labels = SpectralClustering(n_clusters=2, affinity='nearest_neighbors',
                             n_neighbors=10, random_state=42).fit_predict(X)

plt.scatter(X[:, 0], X[:, 1], c=labels, cmap='viridis')
plt.title("Spectral Clustering on Moons")
plt.show()
```
**Explanation:** Spectral clustering builds a similarity graph (here, a k-nearest-neighbor graph), computes its graph Laplacian, and clusters using the Laplacian's top eigenvectors — effectively clustering in a transformed space where non-convex shapes become linearly separable.

---

## 32. BIRCH for Large Datasets
**Problem:** Use BIRCH, designed for very large datasets that don't fit comfortably in memory, and compare speed to standard K-Means.

```python
import time
from sklearn.cluster import Birch, KMeans
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=100000, centers=10, random_state=42)

t0 = time.time()
birch = Birch(n_clusters=10, threshold=0.5)
birch_labels = birch.fit_predict(X)
print(f"BIRCH: {time.time() - t0:.2f}s")

t0 = time.time()
km_labels = KMeans(n_clusters=10, random_state=42, n_init=10).fit_predict(X)
print(f"KMeans: {time.time() - t0:.2f}s")
```
**Explanation:** BIRCH incrementally builds a compact tree summary (a "Clustering Feature Tree") of the data in one pass, so it never needs to hold the full dataset in memory at once — making it well suited to streaming or very large datasets where K-Means' repeated full passes become expensive.

---

## 33. GMM Covariance Types Compared
**Problem:** Compare the four GMM covariance types (`full`, `tied`, `diag`, `spherical`) on elliptical clusters.

```python
import matplotlib.pyplot as plt
import numpy as np
from sklearn.mixture import GaussianMixture

rng = np.random.RandomState(0)
X1 = rng.multivariate_normal([0, 0], [[3, 1.5], [1.5, 1]], 150)
X2 = rng.multivariate_normal([6, 6], [[1, -0.8], [-0.8, 2]], 150)
X = np.vstack([X1, X2])

cov_types = ['full', 'tied', 'diag', 'spherical']
fig, axes = plt.subplots(1, 4, figsize=(16, 4))
for ax, cov in zip(axes, cov_types):
    labels = GaussianMixture(n_components=2, covariance_type=cov, random_state=0).fit_predict(X)
    ax.scatter(X[:, 0], X[:, 1], c=labels, cmap='viridis')
    ax.set_title(cov)
plt.show()
```
**Explanation:** `full` allows each component its own arbitrarily-oriented ellipse (most flexible, most parameters); `tied` shares one covariance shape across all components; `diag` restricts ellipses to axis-aligned; `spherical` forces circular clusters (closest to K-Means). More flexible types fit better but risk overfitting with limited data.

---

## 34. Choosing GMM Components with BIC/AIC
**Problem:** Select the optimal number of GMM components using the Bayesian and Akaike Information Criteria.

```python
import matplotlib.pyplot as plt
from sklearn.mixture import GaussianMixture
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=500, centers=4, cluster_std=0.9, random_state=42)

n_components = range(1, 10)
bics, aics = [], []
for n in n_components:
    gmm = GaussianMixture(n_components=n, random_state=42).fit(X)
    bics.append(gmm.bic(X))
    aics.append(gmm.aic(X))

plt.plot(n_components, bics, marker='o', label='BIC')
plt.plot(n_components, aics, marker='s', label='AIC')
plt.xlabel("Number of components"); plt.legend()
plt.title("BIC/AIC vs Number of GMM Components")
plt.show()

print("Best n_components (BIC):", n_components[bics.index(min(bics))])
```
**Explanation:** Unlike silhouette score, BIC and AIC directly penalize model complexity (more components = more parameters), so the *minimum* of the curve — not a knee or elbow — indicates the best trade-off between fit and simplicity. BIC penalizes complexity more heavily than AIC, so it tends to prefer fewer components.

---

## 35. Clustering Mixed Categorical + Numerical Data
**Problem:** Compute a custom distance matrix that handles a mix of categorical and numerical columns (a simplified Gower-like distance), then cluster with it.

```python
import numpy as np
import pandas as pd
from sklearn.cluster import AgglomerativeClustering
from scipy.spatial.distance import pdist, squareform

df = pd.DataFrame({
    'age': [25, 45, 32, 51, 23, 40],
    'income': [40, 85, 52, 90, 38, 78],
    'owns_car': ['no', 'yes', 'no', 'yes', 'no', 'yes']
})

num_cols = ['age', 'income']
cat_cols = ['owns_car']

num_data = (df[num_cols] - df[num_cols].min()) / (df[num_cols].max() - df[num_cols].min())
num_dist = squareform(pdist(num_data, metric='euclidean'))
cat_dist = squareform(pdist(pd.get_dummies(df[cat_cols]), metric='hamming'))

gower_like = (num_dist * len(num_cols) + cat_dist * len(cat_cols)) / (len(num_cols) + len(cat_cols))

labels = AgglomerativeClustering(n_clusters=2, metric='precomputed', linkage='average').fit_predict(gower_like)
df['cluster'] = labels
print(df)
```
**Explanation:** True Gower distance handles mixed types natively by averaging per-feature distances (normalized numeric distance for continuous columns, mismatch/match for categorical), avoiding the information loss of forcing everything into one-hot vectors. This simplified version demonstrates the same idea using a precomputed distance matrix fed into Agglomerative Clustering.

---

## 36. Text Clustering with TF-IDF
**Problem:** Cluster short text documents by topic using TF-IDF vectorization followed by K-Means.

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans

docs = [
    "The stock market rallied today after strong earnings reports.",
    "Investors are optimistic about tech company profits this quarter.",
    "The soccer match ended in a dramatic penalty shootout.",
    "The national team celebrated their championship victory.",
    "New vaccine trials show promising results against the virus.",
    "Doctors recommend the updated vaccine for at-risk patients."
]

vectorizer = TfidfVectorizer(stop_words='english')
X = vectorizer.fit_transform(docs)

labels = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(X)
for doc, label in zip(docs, labels):
    print(f"[Cluster {label}] {doc}")
```
**Explanation:** TF-IDF converts text into numeric vectors weighted by how distinctive each word is to a document relative to the whole corpus, so documents sharing distinctive vocabulary (e.g., "vaccine", "trials") end up close together in vector space and get grouped by K-Means.

---

## 37. PCA + K-Means Pipeline on High-Dimensional Data
**Problem:** Build a scikit-learn `Pipeline` that scales, reduces dimensionality with PCA, then clusters — all in one object — on a synthetic 64-feature customer spending dataset.

```python
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans

rng = np.random.RandomState(42)
n_categories, n_weeks, n_archetypes, n_per_archetype = 8, 8, 10, 50

# Each of the 10 "shopping archetypes" has its own spend fingerprint across
# 8 product categories x 8 weeks (flattened to 64 features per customer)
base_patterns = rng.uniform(10, 100, size=(n_archetypes, n_categories, n_weeks))
X_list = []
for a in range(n_archetypes):
    for _ in range(n_per_archetype):
        noisy = base_patterns[a] + rng.normal(0, 8, (n_categories, n_weeks))
        X_list.append(noisy.flatten())
X = np.clip(np.array(X_list), 0, None)  # 500 customers x 64 features

pipeline = Pipeline([
    ('scale', StandardScaler()),
    ('pca', PCA(n_components=10)),
    ('cluster', KMeans(n_clusters=10, random_state=42, n_init=10))
])

labels = pipeline.fit_predict(X)
print("Explained variance by 10 PCs:", pipeline.named_steps['pca'].explained_variance_ratio_.sum())
```
**Explanation:** Chaining steps in a `Pipeline` keeps preprocessing and modeling reproducible and prevents mistakes like forgetting to scale test data the same way as training data. Reducing 64 category-by-week spending features to 10 principal components before clustering also removes noise and speeds up the clustering step considerably — a realistic setup for segmenting customers by detailed purchase-pattern data.

---

## 38. t-SNE for Cluster Visualization
**Problem:** After clustering the synthetic 64-feature customer spending dataset, use t-SNE (instead of PCA) to visualize clusters in 2D, since t-SNE better preserves local neighborhood structure.

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE
from sklearn.cluster import KMeans

rng = np.random.RandomState(42)
n_categories, n_weeks, n_archetypes, n_per_archetype = 8, 8, 10, 50

base_patterns = rng.uniform(10, 100, size=(n_archetypes, n_categories, n_weeks))
X_list = []
for a in range(n_archetypes):
    for _ in range(n_per_archetype):
        noisy = base_patterns[a] + rng.normal(0, 8, (n_categories, n_weeks))
        X_list.append(noisy.flatten())
X = np.clip(np.array(X_list), 0, None)  # 500 customers x 64 features

labels = KMeans(n_clusters=10, random_state=42, n_init=10).fit_predict(X)

X_tsne = TSNE(n_components=2, random_state=42, perplexity=30).fit_transform(X)

plt.figure(figsize=(8, 6))
plt.scatter(X_tsne[:, 0], X_tsne[:, 1], c=labels, cmap='tab10', s=15)
plt.title("t-SNE Visualization of Customer Spending Archetypes")
plt.show()
```
**Explanation:** t-SNE is generally better than PCA at revealing well-separated, "blobby" cluster structure visually (though it distorts global distances and cluster sizes, so never use it for anything quantitative — only for visualization). Here it should reveal roughly 10 tight groupings corresponding to the underlying shopping archetypes.

---

## 39. Comparing Algorithms with Multiple Metrics
**Problem:** Run K-Means, DBSCAN, Agglomerative, and GMM on the same data and compare all four using three different internal metrics.

```python
import pandas as pd
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.mixture import GaussianMixture
from sklearn.datasets import make_blobs
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score

X, _ = make_blobs(n_samples=400, centers=4, cluster_std=0.9, random_state=42)

algorithms = {
    'KMeans': KMeans(n_clusters=4, random_state=42, n_init=10),
    'DBSCAN': DBSCAN(eps=0.8, min_samples=5),
    'Agglomerative': AgglomerativeClustering(n_clusters=4),
    'GMM': GaussianMixture(n_components=4, random_state=42)
}

results = []
for name, model in algorithms.items():
    labels = model.fit_predict(X)
    if len(set(labels)) > 1:
        results.append({
            'Algorithm': name,
            'Silhouette': silhouette_score(X, labels),
            'Calinski-Harabasz': calinski_harabasz_score(X, labels),
            'Davies-Bouldin': davies_bouldin_score(X, labels)
        })

print(pd.DataFrame(results).round(3))
```
**Explanation:** No single metric is universally "correct" — Silhouette and Calinski-Harabasz are higher-is-better (measuring separation/compactness), while Davies-Bouldin is lower-is-better (average similarity between each cluster and its most similar one). Comparing all three together gives a more trustworthy picture than relying on just one.

---

## 40. Cluster Stability via Bootstrap Resampling
**Problem:** Assess how stable a K-Means clustering is by re-fitting on bootstrap resamples and comparing labelings.

```python
import numpy as np
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
from sklearn.metrics import adjusted_rand_score

X, _ = make_blobs(n_samples=300, centers=4, cluster_std=0.8, random_state=42)
base_labels = KMeans(n_clusters=4, random_state=42, n_init=10).fit_predict(X)

rng = np.random.RandomState(0)
ari_scores = []
for i in range(20):
    idx = rng.choice(len(X), size=len(X), replace=True)
    X_boot = X[idx]
    boot_labels = KMeans(n_clusters=4, random_state=i, n_init=10).fit_predict(X_boot)
    ari_scores.append(adjusted_rand_score(base_labels[idx], boot_labels))

print(f"Mean ARI across bootstraps: {np.mean(ari_scores):.3f} (+/- {np.std(ari_scores):.3f})")
```
**Explanation:** If small changes to the input data (resampling with replacement) drastically change the resulting clusters, the clustering solution is unstable and shouldn't be trusted as "real" structure. A consistently high mean ARI across bootstrap runs is evidence the clusters reflect genuine patterns rather than noise.

---

## 41. Removing Outliers Before Clustering
**Problem:** Detect and remove outliers using the IQR method before running K-Means, since extreme points can pull centroids off target.

```python
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans

rng = np.random.RandomState(0)
X = rng.normal(0, 1, (200, 2))
X = np.vstack([X, [[15, 15], [-15, -15]]])  # inject 2 outliers

df = pd.DataFrame(X, columns=['x', 'y'])
Q1, Q3 = df.quantile(0.25), df.quantile(0.75)
IQR = Q3 - Q1
mask = ~((df < (Q1 - 1.5 * IQR)) | (df > (Q3 + 1.5 * IQR))).any(axis=1)
X_clean = df[mask].values

labels_with_outliers = KMeans(n_clusters=1, random_state=0, n_init=10).fit(X).cluster_centers_
labels_clean = KMeans(n_clusters=1, random_state=0, n_init=10).fit(X_clean).cluster_centers_

print("Centroid with outliers:", labels_with_outliers)
print("Centroid without outliers:", labels_clean)
print(f"Removed {len(df) - len(X_clean)} outlier(s)")
```
**Explanation:** Because K-Means minimizes squared distance, a handful of far-flung outliers can pull a centroid noticeably away from where the bulk of "normal" data actually sits. Filtering values beyond `1.5 * IQR` from the quartiles (a standard rule of thumb) is a simple pre-clustering safeguard — though for legitimate anomaly-detection tasks, keep the outliers and use DBSCAN instead (Problem 52).

---

## 42. Clustering Synthetic Customer Shopping Archetypes
**Problem:** Cluster a synthetic dataset of 500 customers (64 features: spend across 8 categories x 8 weeks, 10 true shopping archetypes) and evaluate cluster purity.

```python
import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score, homogeneity_score

rng = np.random.RandomState(42)
n_categories, n_weeks, n_archetypes, n_per_archetype = 8, 8, 10, 50

base_patterns = rng.uniform(10, 100, size=(n_archetypes, n_categories, n_weeks))
X_list, y_list = [], []
for a in range(n_archetypes):
    for _ in range(n_per_archetype):
        noisy = base_patterns[a] + rng.normal(0, 8, (n_categories, n_weeks))
        X_list.append(noisy.flatten())
        y_list.append(a)
X = np.clip(np.array(X_list), 0, None)   # 500 customers x 64 features
y_true = np.array(y_list)

labels = KMeans(n_clusters=10, random_state=42, n_init=10).fit_predict(X)

print(f"ARI: {adjusted_rand_score(y_true, labels):.3f}")
print(f"Homogeneity: {homogeneity_score(y_true, labels):.3f}")

# Purity: for each cluster, what fraction belongs to the majority true archetype?
purity = 0
for c in set(labels):
    true_in_cluster = y_true[labels == c]
    majority_count = np.bincount(true_in_cluster).max()
    purity += majority_count
print(f"Purity: {purity / len(y_true):.3f}")
```
**Explanation:** Each of the 10 archetypes (e.g., "grocery-focused steady spender," "weekend big-ticket buyer") has a distinct spend fingerprint across categories and weeks, so K-Means on the raw 64-feature vectors can recover the underlying groups reasonably well. Purity — the fraction of points in each cluster belonging to that cluster's most common true label — is an intuitive, easy-to-explain metric even though it isn't chance-corrected like ARI.

---

## 43. Image Color Quantization with K-Means
**Problem:** Compress a synthetic marketing banner design's color palette down to 6 print-ready colors using K-Means on pixel RGB values.

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans

rng = np.random.RandomState(42)
h, w = 120, 200
image = np.zeros((h, w, 3))

# Background gradient (brand color wash)
for y in range(h):
    t = y / h
    image[y, :, 0] = 0.2 + 0.5 * t
    image[y, :, 1] = 0.3 + 0.2 * t
    image[y, :, 2] = 0.6 - 0.3 * t

# Logo shapes drawn on top
yy, xx = np.mgrid[0:h, 0:w]
circle_mask = (xx - 60) ** 2 + (yy - 60) ** 2 < 35 ** 2
image[circle_mask] = [0.95, 0.75, 0.10]          # accent yellow

rect_mask = (xx > 120) & (xx < 180) & (yy > 30) & (yy < 90)
image[rect_mask] = [0.85, 0.20, 0.20]            # brand red

image = np.clip(image + rng.normal(0, 0.02, image.shape), 0, 1)  # slight texture noise
pixels = image.reshape(-1, 3)

kmeans = KMeans(n_clusters=6, random_state=42, n_init=5).fit(pixels)
quantized = kmeans.cluster_centers_[kmeans.labels_].reshape(h, w, 3)

fig, axes = plt.subplots(1, 2, figsize=(10, 5))
axes[0].imshow(image); axes[0].set_title("Original Banner Design")
axes[1].imshow(quantized); axes[1].set_title("6-Color Quantized (print-ready)")
plt.show()
```
**Explanation:** Each pixel is a point in 3D RGB space; K-Means finds 6 "representative" colors (centroids) and every pixel gets replaced by its nearest representative color. This is exactly how print shops reduce a full-color design down to a small, fixed number of spot colors to cut printing costs — the noisy gradient and shape edges get cleanly bucketed into flat color regions.

---

## 44. StandardScaler vs RobustScaler
**Problem:** Compare clustering results when scaling data that contains outliers with `StandardScaler` vs `RobustScaler`.

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=200, centers=3, cluster_std=0.6, random_state=42)
X = np.vstack([X, [[20, 20], [22, 21], [21, 23]]])  # add an outlier cluster

X_std = StandardScaler().fit_transform(X)
X_rob = RobustScaler().fit_transform(X)

labels_std = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(X_std)
labels_rob = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(X_rob)

fig, axes = plt.subplots(1, 2, figsize=(10, 4))
axes[0].scatter(X[:, 0], X[:, 1], c=labels_std); axes[0].set_title("StandardScaler")
axes[1].scatter(X[:, 0], X[:, 1], c=labels_rob); axes[1].set_title("RobustScaler")
plt.show()
```
**Explanation:** `StandardScaler` uses mean and standard deviation, both of which outliers inflate heavily, compressing the "normal" points together. `RobustScaler` uses median and interquartile range instead, which are far less sensitive to extreme values — generally preferable whenever your data has known outliers you aren't trying to remove.

---

## 45. Clustering with Weighted Features
**Problem:** Give one feature more influence over the clustering result by manually weighting it before fitting.

```python
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

rng = np.random.RandomState(0)
X = rng.normal(0, 1, (200, 3))  # 3 equally-scaled features
X_scaled = StandardScaler().fit_transform(X)

weights = np.array([3.0, 1.0, 1.0])  # feature 0 is 3x as important
X_weighted = X_scaled * weights

labels = KMeans(n_clusters=3, random_state=0, n_init=10).fit_predict(X_weighted)
print("Cluster sizes:", np.bincount(labels))
```
**Explanation:** After scaling puts every feature on equal footing, multiplying a column by a weight `> 1` effectively stretches that dimension, making Euclidean distance (and therefore K-Means) more sensitive to differences along it — a simple way to inject domain knowledge like "purchase frequency matters more than age" into an otherwise unsupervised method.

---

## 46. Seeding K-Means with Known Centroids
**Problem:** If you already know approximate starting cluster centers (e.g., from business rules), initialize K-Means with them instead of `k-means++`.

```python
import numpy as np
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=300, centers=3, random_state=42)

known_centers = np.array([[0, 0], [5, 5], [-5, 5]])  # domain-informed guesses

kmeans = KMeans(n_clusters=3, init=known_centers, n_init=1, random_state=42)
labels = kmeans.fit_predict(X)
print("Final centroids:\n", kmeans.cluster_centers_)
```
**Explanation:** Passing an explicit array to `init` (instead of `'k-means++'` or `'random'`) lets you seed the algorithm with domain knowledge — useful when you have prior expectations (e.g., known customer archetypes) you want the algorithm to refine rather than discover from scratch. Note `n_init=1` is required since you're supplying one specific starting point.

---

## 47. Internal Validation Metrics Without Ground Truth
**Problem:** When no true labels exist (the normal real-world case), compute and interpret three internal validation metrics together.

```python
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score

X, _ = make_blobs(n_samples=400, centers=4, cluster_std=0.8, random_state=42)
labels = KMeans(n_clusters=4, random_state=42, n_init=10).fit_predict(X)

print(f"Silhouette Score:        {silhouette_score(X, labels):.3f}  (higher is better, range -1 to 1)")
print(f"Calinski-Harabasz Index: {calinski_harabasz_score(X, labels):.1f}  (higher is better, unbounded)")
print(f"Davies-Bouldin Index:    {davies_bouldin_score(X, labels):.3f}  (lower is better, 0+)")
```
**Explanation:** These are "internal" metrics because they only need the data and the resulting labels — no ground truth required — which is exactly the situation real unsupervised clustering projects are in. Using all three together guards against any single metric's blind spots (e.g., Calinski-Harabasz tends to favor convex clusters, similarly to K-Means itself).

---

## 48. External Validation Metrics With Ground Truth
**Problem:** When true labels *are* available (e.g., for benchmarking a new algorithm), compute the full suite of external metrics on a synthetic customer-segment dataset.

```python
import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import (adjusted_rand_score, adjusted_mutual_info_score,
                              homogeneity_score, completeness_score, v_measure_score)

rng = np.random.RandomState(42)
n = 80

def make_segment(income, spend, tenure, freq, n):
    return np.column_stack([
        rng.normal(income, income * 0.15, n),
        rng.normal(spend, 10, n),
        rng.normal(tenure, 1.5, n),
        rng.normal(freq, 2, n)
    ])

budget  = make_segment(30000, 20, 1.5, 3, n)
regular = make_segment(60000, 50, 4,   8, n)
premium = make_segment(110000, 85, 7,  15, n)

X = np.vstack([budget, regular, premium])
y_true = np.array([0] * n + [1] * n + [2] * n)

labels = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(X)

print(f"ARI:            {adjusted_rand_score(y_true, labels):.3f}")
print(f"AMI:            {adjusted_mutual_info_score(y_true, labels):.3f}")
print(f"Homogeneity:    {homogeneity_score(y_true, labels):.3f}")
print(f"Completeness:   {completeness_score(y_true, labels):.3f}")
print(f"V-measure:      {v_measure_score(y_true, labels):.3f}")
```
**Explanation:** Homogeneity asks "does each cluster contain only one true segment?"; completeness asks "are all members of a true segment in the same cluster?"; V-measure is their harmonic mean (like an F1-score for clustering). ARI and AMI both correct for chance agreement but weight things slightly differently — using several together, as with internal metrics, avoids over-trusting one number when validating a segmentation against known customer tiers.

---

## 49. Handling Imbalanced Cluster Sizes
**Problem:** Demonstrate that K-Means struggles when true clusters have very different sizes/densities, and see how it distorts results.

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X, y_true = make_blobs(n_samples=[500, 50, 50], centers=[[0, 0], [5, 5], [-5, 5]],
                        cluster_std=[1.5, 0.3, 0.3], random_state=42)

labels = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(X)

fig, axes = plt.subplots(1, 2, figsize=(10, 4))
axes[0].scatter(X[:, 0], X[:, 1], c=y_true, cmap='viridis'); axes[0].set_title("True Groups (imbalanced)")
axes[1].scatter(X[:, 0], X[:, 1], c=labels, cmap='viridis'); axes[1].set_title("K-Means Result")
plt.show()
```
**Explanation:** K-Means implicitly assumes roughly equal-sized, equal-variance clusters because it minimizes total squared distance — a large, spread-out cluster can "absorb" part of a small, tight neighboring cluster, or a centroid meant for the large cluster can get pulled toward the small ones. GMM (with per-cluster covariance) or DBSCAN (density-based) often handle size/density imbalance more gracefully.

---

## 50. Geospatial Clustering with Haversine DBSCAN
**Problem:** Cluster GPS coordinates (latitude/longitude) using DBSCAN with the haversine distance metric, which correctly accounts for Earth's curvature.

```python
import numpy as np
from sklearn.cluster import DBSCAN

# Sample lat/lon points (degrees) for several "cities" of activity
coords_deg = np.array([
    [40.7128, -74.0060], [40.7138, -74.0055], [40.7118, -74.0070],  # NYC cluster
    [34.0522, -118.2437], [34.0532, -118.2440],                       # LA cluster
    [51.5074, -0.1278]                                                 # London (noise/outlier)
])

coords_rad = np.radians(coords_deg)
kms_per_radian = 6371.0088
epsilon = 2 / kms_per_radian  # 2 km radius

db = DBSCAN(eps=epsilon, min_samples=2, metric='haversine')
labels = db.fit_predict(coords_rad)
print("Cluster labels:", labels)
```
**Explanation:** Plain Euclidean distance on raw lat/lon degrees is inaccurate because a degree of longitude covers a different real-world distance depending on latitude. The `haversine` metric computes great-circle distance on a sphere directly, and converting `eps` from kilometers to radians lets you specify a physically meaningful radius (here, group points within 2 km of each other).

---

## 51. Time-Series Clustering via Feature Extraction
**Problem:** Cluster time series by first extracting summary statistics (mean, std, trend slope) as features, then applying K-Means.

```python
import numpy as np
from sklearn.cluster import KMeans

rng = np.random.RandomState(0)
t = np.linspace(0, 10, 100)
series = []
for _ in range(20):  # upward trending series
    series.append(0.5 * t + rng.normal(0, 0.5, 100))
for _ in range(20):  # flat/noisy series
    series.append(rng.normal(5, 1, 100))
series = np.array(series)

features = []
for s in series:
    slope = np.polyfit(t, s, 1)[0]
    features.append([s.mean(), s.std(), slope])
features = np.array(features)

labels = KMeans(n_clusters=2, random_state=0, n_init=10).fit_predict(features)
print("Cluster sizes:", np.bincount(labels))
```
**Explanation:** Raw time series are usually too high-dimensional and shift-sensitive to cluster directly with Euclidean-distance methods, so extracting hand-crafted features (mean level, volatility, trend) that capture the shape of the series turns it back into a standard tabular clustering problem. (For more advanced needs, dedicated libraries like `tslearn` support DTW-based distances directly.)

---

## 52. Anomaly Detection via DBSCAN
**Problem:** Use DBSCAN's `-1` ("noise") label as a built-in anomaly detector on a dataset with a few injected outliers.

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import DBSCAN
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=300, centers=3, cluster_std=0.6, random_state=42)
outliers = np.random.RandomState(1).uniform(low=-10, high=10, size=(15, 2))
X_full = np.vstack([X, outliers])

labels = DBSCAN(eps=0.6, min_samples=5).fit_predict(X_full)
n_anomalies = np.sum(labels == -1)
print(f"Detected {n_anomalies} anomalies out of {len(X_full)} points")

plt.scatter(X_full[:, 0], X_full[:, 1], c=(labels == -1), cmap='coolwarm')
plt.title("DBSCAN Anomaly Detection (red = anomaly)")
plt.show()
```
**Explanation:** Because DBSCAN explicitly labels any point that doesn't have enough nearby neighbors as noise (`-1`), it doubles as a lightweight anomaly/outlier detector "for free" — no separate anomaly-detection model required — which is a major practical advantage over centroid-based methods like K-Means that force every point into some cluster.

---

## 53. RFM Customer Segmentation
**Problem:** Perform Recency-Frequency-Monetary (RFM) segmentation, a standard marketing-analytics clustering workflow.

```python
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans

rng = np.random.RandomState(0)
df = pd.DataFrame({
    'customer_id': range(1, 201),
    'recency_days': rng.exponential(30, 200),      # days since last purchase
    'frequency': rng.poisson(5, 200),               # number of purchases
    'monetary': rng.gamma(2, 100, 200)              # total spend
})

X = StandardScaler().fit_transform(df[['recency_days', 'frequency', 'monetary']])
df['segment'] = KMeans(n_clusters=4, random_state=0, n_init=10).fit_predict(X)

print(df.groupby('segment')[['recency_days', 'frequency', 'monetary']].mean().round(1))
```
**Explanation:** RFM turns raw transaction history into three business-meaningful axes — how recently, how often, and how much a customer buys — and clustering on those three then naturally surfaces segments like "champions" (recent, frequent, high-spend), "at risk" (long recency, was frequent), and "new/low-value" customers, which marketing teams can act on directly.

---

## 54. Full Preprocessing + PCA + Clustering Pipeline
**Problem:** Build a complete, reusable pipeline that handles missing values, scaling, dimensionality reduction, and clustering together on a synthetic supplier scorecard.

```python
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans

rng = np.random.RandomState(42)
n = 60

def make_supplier_tier(means, n):
    return np.column_stack([rng.normal(m, abs(m) * 0.08 + 1, n) for m in means])

tier1 = make_supplier_tier([98, 50,  1.5, 3,  92, 95, 98, 99,  2, 96], n)
tier2 = make_supplier_tier([90, 300, 4.0, 7,  78, 82, 88, 93,  8, 84], n)
tier3 = make_supplier_tier([75, 900, 9.0, 14, 60, 65, 70, 82, 20, 60], n)

X = np.vstack([tier1, tier2, tier3])

# inject some missing values for realism
mask = rng.rand(*X.shape) < 0.05
X[mask] = np.nan

pipeline = Pipeline([
    ('impute', SimpleImputer(strategy='median')),
    ('scale', StandardScaler()),
    ('pca', PCA(n_components=0.95)),   # keep 95% of variance
    ('cluster', KMeans(n_clusters=3, random_state=42, n_init=10))
])

labels = pipeline.fit_predict(X)
n_components_used = pipeline.named_steps['pca'].n_components_
print(f"PCA kept {n_components_used} components to explain 95% variance")
print("Cluster sizes:", np.bincount(labels))
```
**Explanation:** Setting `PCA(n_components=0.95)` automatically keeps as many components as needed to retain 95% of the variance rather than a fixed number — combined with imputation and scaling in one `Pipeline`, this becomes a single reusable object you can call `.fit_predict()` on for any similarly-shaped dataset (e.g., a monthly refresh of the supplier scorecard), which is exactly how production clustering code is usually structured.

---

## 55. Choosing K via Multi-Seed Stability
**Problem:** For each candidate `k`, run K-Means with several random seeds and pick the `k` whose clustering is most consistent across seeds.

```python
import numpy as np
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
from sklearn.metrics import adjusted_rand_score
from itertools import combinations

X, _ = make_blobs(n_samples=400, centers=5, cluster_std=0.9, random_state=42)

for k in range(2, 8):
    label_sets = [KMeans(n_clusters=k, random_state=seed, n_init=10).fit_predict(X) for seed in range(5)]
    pairwise_ari = [adjusted_rand_score(a, b) for a, b in combinations(label_sets, 2)]
    print(f"k={k}: mean pairwise ARI across seeds = {np.mean(pairwise_ari):.3f}")
```
**Explanation:** If a given `k` is "correct" for the data's real structure, different random initializations should converge to nearly the same partition (high pairwise ARI); if `k` is wrong, different seeds tend to disagree noticeably about how to split the data. This is a more rigorous companion to the elbow/silhouette methods for choosing `k`.

---
# Part 3 — Advanced

## 56. Consensus (Ensemble) Clustering
**Problem:** Combine many different K-Means runs into a single, more robust "consensus" clustering using a co-association matrix.

```python
import numpy as np
from sklearn.cluster import KMeans, AgglomerativeClustering
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=200, centers=4, cluster_std=1.0, random_state=42)
n_samples = X.shape[0]

co_assoc = np.zeros((n_samples, n_samples))
n_runs = 30
for seed in range(n_runs):
    labels = KMeans(n_clusters=4, random_state=seed, n_init=1, init='random').fit_predict(X)
    for c in set(labels):
        idx = np.where(labels == c)[0]
        co_assoc[np.ix_(idx, idx)] += 1
co_assoc /= n_runs

distance_matrix = 1 - co_assoc
final_labels = AgglomerativeClustering(n_clusters=4, metric='precomputed', linkage='average').fit_predict(distance_matrix)
print("Final consensus cluster sizes:", np.bincount(final_labels))
```
**Explanation:** Each run of K-Means with a different random seed produces a somewhat different partition; the co-association matrix tracks how often each *pair* of points ends up in the same cluster across all runs. Clustering that matrix (treating "rarely together" as "far apart") gives a final result that's less sensitive to any single unlucky initialization — a simple form of ensemble clustering.

---

## 57. Clustering with a Precomputed Distance Matrix
**Problem:** Cluster data using a custom, domain-specific distance function (e.g., cosine distance) by precomputing the full distance matrix.

```python
import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_distances
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=100, centers=3, random_state=42)

dist_matrix = cosine_distances(X)

labels = AgglomerativeClustering(n_clusters=3, metric='precomputed', linkage='average').fit_predict(dist_matrix)
print("Cluster sizes:", np.bincount(labels))
```
**Explanation:** Passing `metric='precomputed'` lets you plug in *any* valid distance function — cosine distance (good for direction-sensitive data like text embeddings), custom weighted distances, edit distance for strings, DTW for time series, etc. — as long as you can compute a full pairwise distance matrix, decoupling the clustering algorithm from the assumption that Euclidean distance is appropriate.

---

## 58. Spectral Biclustering
**Problem:** Simultaneously cluster rows and columns of a matrix (e.g., customers x products) to find blocks of related customers and products together.

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import SpectralCoclustering
from sklearn.datasets import make_biclusters

data, rows, columns = make_biclusters(shape=(100, 50), n_clusters=4, noise=5, random_state=42)

model = SpectralCoclustering(n_clusters=4, random_state=42)
model.fit(data)

fit_data = data[np.argsort(model.row_labels_)]
fit_data = fit_data[:, np.argsort(model.column_labels_)]

fig, axes = plt.subplots(1, 2, figsize=(10, 4))
axes[0].matshow(data, cmap='viridis'); axes[0].set_title("Original")
axes[1].matshow(fit_data, cmap='viridis'); axes[1].set_title("Biclustered & Reordered")
plt.show()
```
**Explanation:** Regular clustering only groups rows *or* columns; biclustering (co-clustering) finds sub-matrices where a specific subset of rows correlates strongly with a specific subset of columns — e.g., "these 20 customers all like these 8 products" — which is exactly the recommendation-system use case this technique originated from.

---

## 59. Soft Clustering with GMM Probabilities
**Problem:** Extract full membership probabilities from a GMM (rather than a single hard label) and visualize uncertainty near cluster boundaries.

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.mixture import GaussianMixture
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=300, centers=3, cluster_std=1.5, random_state=42)
gmm = GaussianMixture(n_components=3, random_state=42).fit(X)

probs = gmm.predict_proba(X)  # shape (n_samples, n_components)
max_prob = probs.max(axis=1)  # confidence in the assigned cluster

plt.scatter(X[:, 0], X[:, 1], c=max_prob, cmap='RdYlGn', s=30)
plt.colorbar(label='Confidence (max probability)')
plt.title("GMM Soft Clustering Confidence")
plt.show()

uncertain_points = np.sum(max_prob < 0.6)
print(f"{uncertain_points} points have ambiguous cluster membership (<60% confidence)")
```
**Explanation:** Unlike K-Means, which forces a hard assignment even for a point sitting exactly between two clusters, GMM's `predict_proba` reveals *how confident* each assignment is — genuinely useful in applications like customer segmentation where "this person is 55% Segment A, 45% Segment B" is more honest and actionable than a coin-flip hard label.

---

## 60. Hierarchical Density Clustering (OPTICS Xi Method)
**Problem:** Use OPTICS' automatic "xi" cluster extraction method to find nested clusters of varying density without manually setting `eps`.

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import OPTICS
from sklearn.datasets import make_blobs

X1, _ = make_blobs(n_samples=100, centers=[[0, 0]], cluster_std=0.2, random_state=1)
X2, _ = make_blobs(n_samples=100, centers=[[3, 3]], cluster_std=0.5, random_state=1)
X3, _ = make_blobs(n_samples=100, centers=[[8, 0]], cluster_std=1.0, random_state=1)
X = np.vstack([X1, X2, X3])

optics = OPTICS(min_samples=10, xi=0.01, min_cluster_size=0.05)
optics.fit(X)

plt.figure(figsize=(10, 4))
space = np.arange(len(X))
reachability = optics.reachability_[optics.ordering_]
plt.plot(space, reachability)
plt.title("OPTICS Reachability Plot")
plt.ylabel("Reachability distance")
plt.show()

print("Clusters found:", len(set(optics.labels_)) - (1 if -1 in optics.labels_ else 0))
```
**Explanation:** The "xi" method automatically detects steep drops in the reachability plot to define cluster boundaries, effectively giving hierarchical, DBSCAN-like results across multiple density scales at once — closer in spirit to the popular external `hdbscan` library than plain DBSCAN.

---

## 61. Clustering with Mahalanobis Distance
**Problem:** Cluster elongated, correlated data using Mahalanobis distance (which accounts for feature covariance) instead of Euclidean distance.

```python
import numpy as np
from scipy.spatial.distance import pdist, squareform
from sklearn.cluster import AgglomerativeClustering

rng = np.random.RandomState(0)
X1 = rng.multivariate_normal([0, 0], [[3, 2.8], [2.8, 3]], 100)
X2 = rng.multivariate_normal([10, 10], [[3, 2.8], [2.8, 3]], 100)
X = np.vstack([X1, X2])

cov = np.cov(X, rowvar=False)
inv_cov = np.linalg.inv(cov)
dist_matrix = squareform(pdist(X, metric='mahalanobis', VI=inv_cov))

labels = AgglomerativeClustering(n_clusters=2, metric='precomputed', linkage='average').fit_predict(dist_matrix)
print("Cluster sizes:", np.bincount(labels))
```
**Explanation:** When features are strongly correlated (here, both dimensions move together diagonally), Euclidean distance treats a diagonal step and a perpendicular step of the same length as equally "far," which misrepresents the data's actual shape. Mahalanobis distance rescales by the (inverse) covariance matrix, effectively measuring distance in units of standard deviation along the data's natural axes.

---

## 62. Feature Selection Before Clustering
**Problem:** Remove low-variance and highly correlated features from a synthetic company financial dataset before clustering, to reduce noise and redundancy.

```python
import numpy as np
import pandas as pd
from sklearn.feature_selection import VarianceThreshold
from sklearn.cluster import KMeans

rng = np.random.RandomState(42)
n = 200

revenue = rng.normal(5, 2, n)
profit = revenue * 0.3 + rng.normal(0, 0.2, n)                    # highly correlated with revenue
debt_ratio = rng.normal(0.6, 0.2, n)
interest_coverage = 10 - debt_ratio * 8 + rng.normal(0, 0.3, n)   # highly correlated with debt_ratio
region_code = np.full(n, 3) + rng.normal(0, 0.001, n)             # near-constant (low variance)
growth_rate = rng.normal(4, 3, n)

df = pd.DataFrame({
    'revenue': revenue, 'profit': profit, 'debt_ratio': debt_ratio,
    'interest_coverage': interest_coverage, 'region_code': region_code,
    'growth_rate': growth_rate
})

# Step 1: remove near-constant features
selector = VarianceThreshold(threshold=0.01)
df_reduced = pd.DataFrame(selector.fit_transform(df), columns=df.columns[selector.get_support()])

# Step 2: drop one of any pair of highly correlated features (|corr| > 0.9)
corr_matrix = df_reduced.corr().abs()
upper = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
to_drop = [col for col in upper.columns if any(upper[col] > 0.9)]
df_final = df_reduced.drop(columns=to_drop)

print(f"Original features: {df.shape[1]}, After selection: {df_final.shape[1]}")
print("Dropped:", to_drop)
labels = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(df_final)
```
**Explanation:** A feature with almost no variance — like a `region_code` that's nearly constant across the dataset — contributes little to distinguishing points, and two highly correlated features (like `profit` derived directly from `revenue`, or `interest_coverage` derived from `debt_ratio`) effectively "double count" the same underlying signal, silently giving it more weight than intended in a Euclidean-distance-based algorithm. Removing both issues produces a leaner, more balanced feature set before clustering.

---

## 63. Incremental Clustering with partial_fit
**Problem:** Cluster a data *stream* incrementally using `MiniBatchKMeans.partial_fit`, without ever loading the full dataset into memory at once.

```python
import numpy as np
from sklearn.cluster import MiniBatchKMeans
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=10000, centers=5, random_state=42)

mbk = MiniBatchKMeans(n_clusters=5, random_state=42, n_init=3)

batch_size = 500
for i in range(0, len(X), batch_size):
    batch = X[i:i + batch_size]
    mbk.partial_fit(batch)

final_labels = mbk.predict(X)
print("Final cluster sizes:", np.bincount(final_labels))
print("Final centroids:\n", mbk.cluster_centers_)
```
**Explanation:** `partial_fit` updates the model incrementally on each new chunk of data instead of requiring the whole dataset upfront — the exact pattern needed for online/streaming scenarios (e.g., clustering user events as they arrive in real time) where data is too large or too continuous to batch-process all at once.

---

## 64. Using Cluster Labels as Features for Classification
**Problem:** Engineer a new feature by clustering the data first, then feed the cluster label into a downstream supervised classifier.

```python
import numpy as np
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.datasets import make_classification

X, y = make_classification(n_samples=500, n_features=10, n_informative=6, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

kmeans = KMeans(n_clusters=5, random_state=42, n_init=10).fit(X_train)
train_cluster_feat = kmeans.predict(X_train).reshape(-1, 1)
test_cluster_feat = kmeans.predict(X_test).reshape(-1, 1)

X_train_aug = np.hstack([X_train, train_cluster_feat])
X_test_aug = np.hstack([X_test, test_cluster_feat])

clf = RandomForestClassifier(random_state=42).fit(X_train_aug, y_train)
print(f"Test accuracy with cluster feature: {clf.score(X_test_aug, y_test):.3f}")

clf_baseline = RandomForestClassifier(random_state=42).fit(X_train, y_train)
print(f"Test accuracy without cluster feature: {clf_baseline.score(X_test, y_test):.3f}")
```
**Explanation:** This is a common "semi-supervised feature engineering" trick: clustering discovers latent structure (unsupervised), and passing the resulting group ID into a supervised model gives it a compact, non-linear summary of neighborhood similarity that raw features alone might miss — sometimes boosting accuracy, though it's not guaranteed and should be validated (as done here) against a baseline.

---

## 65. Cluster-Based Missing Value Imputation
**Problem:** Impute missing values more intelligently by using each point's cluster-mates' values instead of the global column mean.

```python
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer

rng = np.random.RandomState(0)
df = pd.DataFrame(rng.normal(0, 1, (200, 3)), columns=['a', 'b', 'c'])
df.iloc[:100, 0] += 10  # create two natural groups
mask = rng.rand(*df.shape) < 0.1
df_missing = df.mask(mask)

# Step 1: rough clustering using only complete rows' available info (simple global impute first)
rough_fill = SimpleImputer(strategy='mean').fit_transform(df_missing)
clusters = KMeans(n_clusters=2, random_state=0, n_init=10).fit_predict(rough_fill)

# Step 2: impute using per-cluster means instead of the global mean
df_imputed = df_missing.copy()
df_imputed['cluster'] = clusters
for col in ['a', 'b', 'c']:
    cluster_means = df_imputed.groupby('cluster')[col].transform('mean')
    df_imputed[col] = df_imputed[col].fillna(cluster_means)
df_imputed = df_imputed.drop(columns='cluster')

print("Missing values remaining:", df_imputed.isna().sum().sum())
```
**Explanation:** Filling a missing value with the *global* mean ignores that the point might belong to a subgroup with a very different typical value (e.g., filling a missing "income" with the overall average when the person clearly belongs to the high-income cluster). A quick rough clustering pass first, followed by per-cluster mean imputation, produces more contextually accurate fills.

---

## 66. Estimating K with the Gap Statistic
**Problem:** Implement the Gap Statistic — comparing real data's inertia to that of randomly generated reference data — to more rigorously choose `k`.

```python
import numpy as np
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=300, centers=4, cluster_std=0.8, random_state=42)

def compute_gap(X, k, n_refs=10, random_state=42):
    rng = np.random.RandomState(random_state)
    real_inertia = KMeans(n_clusters=k, random_state=random_state, n_init=10).fit(X).inertia_

    ref_inertias = []
    mins, maxs = X.min(axis=0), X.max(axis=0)
    for _ in range(n_refs):
        random_ref = rng.uniform(mins, maxs, X.shape)
        ref_inertias.append(KMeans(n_clusters=k, random_state=random_state, n_init=10).fit(random_ref).inertia_)

    gap = np.mean(np.log(ref_inertias)) - np.log(real_inertia)
    return gap

for k in range(1, 8):
    gap = compute_gap(X, k)
    print(f"k={k}: gap statistic = {gap:.3f}")
```
**Explanation:** The gap statistic compares how much better your real data clusters versus a null reference of uniformly random points with the same bounding box — a large gap at some `k` means your data has meaningfully more cluster structure than random noise would at that `k`, giving a more statistically principled answer than eyeballing an elbow curve.

---

## 67. Multi-Modal Data: GMM vs K-Means
**Problem:** Compare how K-Means and GMM handle overlapping, elliptical clusters of different sizes and orientations.

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.mixture import GaussianMixture

rng = np.random.RandomState(0)
X1 = rng.multivariate_normal([0, 0], [[4, 3.5], [3.5, 4]], 200)
X2 = rng.multivariate_normal([5, 0], [[1, -0.2], [-0.2, 1]], 100)
X = np.vstack([X1, X2])

km_labels = KMeans(n_clusters=2, random_state=0, n_init=10).fit_predict(X)
gmm_labels = GaussianMixture(n_components=2, random_state=0).fit_predict(X)

fig, axes = plt.subplots(1, 2, figsize=(10, 4))
axes[0].scatter(X[:, 0], X[:, 1], c=km_labels, cmap='viridis'); axes[0].set_title("K-Means")
axes[1].scatter(X[:, 0], X[:, 1], c=gmm_labels, cmap='viridis'); axes[1].set_title("GMM")
plt.show()
```
**Explanation:** Because one true cluster here is a large, diagonally-stretched ellipse and the other is a small, tight circle, K-Means' assumption of equal-variance spherical clusters causes it to draw an inappropriate straight-line boundary through the elongated cluster. GMM's per-component covariance matrices let it correctly wrap an ellipse around the stretched cluster and a circle around the tight one.

---

## 68. Constrained Clustering (Must-Link / Cannot-Link)
**Problem:** Incorporate prior knowledge — pairs of points that *must* be in the same cluster, or *must not* be — into a simple constrained clustering approach.

```python
import numpy as np
from sklearn.cluster import AgglomerativeClustering
from scipy.spatial.distance import pdist, squareform
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=50, centers=3, cluster_std=1.2, random_state=42)
dist_matrix = squareform(pdist(X))

must_link = [(0, 1), (2, 3)]        # force these pairs together
cannot_link = [(0, 10)]              # force these pairs apart

# Enforce constraints by editing the distance matrix directly
for i, j in must_link:
    dist_matrix[i, j] = dist_matrix[j, i] = 0.0
for i, j in cannot_link:
    dist_matrix[i, j] = dist_matrix[j, i] = dist_matrix.max() * 10

labels = AgglomerativeClustering(n_clusters=3, metric='precomputed', linkage='average').fit_predict(dist_matrix)
print(f"Points {must_link[0]} same cluster: {labels[must_link[0][0]] == labels[must_link[0][1]]}")
print(f"Points {cannot_link[0]} same cluster: {labels[cannot_link[0][0]] == labels[cannot_link[0][1]]}")
```
**Explanation:** Real-world clustering often comes with partial supervision — e.g., "we already know these two support tickets are duplicates" (must-link) or "these two customers are definitely different segments" (cannot-link). Manually zeroing-out or inflating specific entries in a precomputed distance matrix is a lightweight way to bake such constraints into standard algorithms (dedicated libraries like `scikit-learn-extra`'s constrained variants offer more principled approaches for heavier use).

---

## 69. Full Random-Seed Stability Assessment
**Problem:** Build a complete stability report for a chosen `k`, including mean/variance of inertia and pairwise ARI, across many random seeds.

```python
import numpy as np
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
from sklearn.metrics import adjusted_rand_score
from itertools import combinations

X, _ = make_blobs(n_samples=400, centers=5, cluster_std=1.0, random_state=42)
k = 5
n_seeds = 15

inertias, all_labels = [], []
for seed in range(n_seeds):
    km = KMeans(n_clusters=k, random_state=seed, n_init=1, init='random').fit(X)
    inertias.append(km.inertia_)
    all_labels.append(km.labels_)

pairwise_ari = [adjusted_rand_score(a, b) for a, b in combinations(all_labels, 2)]

print(f"Inertia:      mean={np.mean(inertias):.1f}, std={np.std(inertias):.1f}")
print(f"Pairwise ARI: mean={np.mean(pairwise_ari):.3f}, std={np.std(pairwise_ari):.3f}, min={np.min(pairwise_ari):.3f}")
```
**Explanation:** A trustworthy clustering solution should have both low variance in inertia (the algorithm reliably finds a similarly-good solution) and high, consistent pairwise ARI (different runs agree on the actual grouping) — reporting both together, as here, gives a fuller stability picture than checking either alone, and is good practice before presenting clustering results as "the" answer.

---

## 70. Comparing Dimensionality Reduction Methods for Clustering
**Problem:** Compare clustering quality after reducing dimensionality with PCA vs. Truncated SVD vs. no reduction at all, on the synthetic 64-feature customer spending dataset.

```python
import numpy as np
from sklearn.decomposition import PCA, TruncatedSVD
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, adjusted_rand_score

rng = np.random.RandomState(42)
n_categories, n_weeks, n_archetypes, n_per_archetype = 8, 8, 10, 50

base_patterns = rng.uniform(10, 100, size=(n_archetypes, n_categories, n_weeks))
X_list, y_list = [], []
for a in range(n_archetypes):
    for _ in range(n_per_archetype):
        noisy = base_patterns[a] + rng.normal(0, 8, (n_categories, n_weeks))
        X_list.append(noisy.flatten())
        y_list.append(a)
X = np.clip(np.array(X_list), 0, None)   # 500 customers x 64 features
y_true = np.array(y_list)

methods = {
    'No reduction': X,
    'PCA (10 comps)': PCA(n_components=10, random_state=42).fit_transform(X),
    'TruncatedSVD (10 comps)': TruncatedSVD(n_components=10, random_state=42).fit_transform(X)
}

for name, X_reduced in methods.items():
    labels = KMeans(n_clusters=10, random_state=42, n_init=10).fit_predict(X_reduced)
    sil = silhouette_score(X_reduced, labels)
    ari = adjusted_rand_score(y_true, labels)
    print(f"{name:25s} silhouette={sil:.3f}  ARI={ari:.3f}")
```
**Explanation:** PCA centers the data first (requires dense data), while Truncated SVD works directly on sparse matrices without centering — making SVD the standard choice for sparse, high-dimensional data like TF-IDF text vectors, while PCA is more common for dense numeric data like this spending-pattern matrix. Comparing metrics side-by-side, as here, is how you'd empirically justify picking one over the other for a given dataset.

---

## 71. Topic-Based Document Clustering with LDA
**Problem:** Instead of clustering raw TF-IDF vectors, first extract latent topics with LDA, then cluster documents based on their topic distributions.

```python
import numpy as np
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation
from sklearn.cluster import KMeans

docs = [
    "The government passed a new tax policy this week.",
    "Congress debates the budget and economic reforms.",
    "The basketball team won the championship game.",
    "Fans celebrated the historic sports victory.",
    "Scientists discovered a new exoplanet using telescopes.",
    "Researchers published findings on space exploration."
]

vectorizer = CountVectorizer(stop_words='english')
X_counts = vectorizer.fit_transform(docs)

lda = LatentDirichletAllocation(n_components=3, random_state=42)
topic_distributions = lda.fit_transform(X_counts)

labels = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(topic_distributions)
for doc, label, topics in zip(docs, labels, topic_distributions):
    print(f"[Cluster {label}] topics={np.round(topics, 2)} | {doc[:40]}...")
```
**Explanation:** LDA represents each document as a probability distribution over latent "topics" (learned automatically from word co-occurrence patterns) rather than raw word counts, giving a lower-dimensional, more semantically meaningful representation for clustering — documents about politics and documents about sports end up with very different topic-probability vectors even if they happen to share a few common words.

---

## 72. Spectral Clustering on Graph Data
**Problem:** Cluster nodes of a graph (given as an adjacency matrix) into communities using spectral clustering's affinity-matrix mode.

```python
import numpy as np
from sklearn.cluster import SpectralClustering

# Adjacency matrix for a small graph with two loosely-connected communities
adjacency = np.array([
    [0, 1, 1, 0, 0, 0],
    [1, 0, 1, 0, 0, 0],
    [1, 1, 0, 1, 0, 0],   # bridge node
    [0, 0, 1, 0, 1, 1],
    [0, 0, 0, 1, 0, 1],
    [0, 0, 0, 1, 1, 0],
])

labels = SpectralClustering(n_clusters=2, affinity='precomputed', random_state=42).fit_predict(adjacency)
print("Community assignment per node:", labels)
```
**Explanation:** Passing `affinity='precomputed'` tells spectral clustering to treat your matrix directly as a graph similarity/adjacency matrix rather than computing one from coordinate data — this is exactly how spectral clustering doubles as a community-detection algorithm for social networks, citation graphs, or any relational dataset with no natural "coordinates."

---

## 73. End-to-End Customer Segmentation Project
**Problem:** Put together a realistic, complete segmentation workflow: load data, clean it, scale it, choose `k`, cluster, and profile the resulting segments.

```python
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

rng = np.random.RandomState(42)
df = pd.DataFrame({
    'age': rng.randint(18, 70, 500),
    'annual_income': rng.normal(60000, 20000, 500).clip(15000),
    'spending_score': rng.randint(1, 100, 500),
    'tenure_years': rng.exponential(3, 500).clip(0, 20)
})

# 1. Clean
df = df.dropna()

# 2. Scale
features = ['age', 'annual_income', 'spending_score', 'tenure_years']
X_scaled = StandardScaler().fit_transform(df[features])

# 3. Choose k
best_k, best_score = 2, -1
for k in range(2, 8):
    labels = KMeans(n_clusters=k, random_state=42, n_init=10).fit_predict(X_scaled)
    score = silhouette_score(X_scaled, labels)
    if score > best_score:
        best_k, best_score = k, score

# 4. Final clustering
df['segment'] = KMeans(n_clusters=best_k, random_state=42, n_init=10).fit_predict(X_scaled)

# 5. Profile segments
print(f"Chosen k={best_k} (silhouette={best_score:.3f})\n")
print(df.groupby('segment')[features].mean().round(1))
print("\nSegment sizes:\n", df['segment'].value_counts())
```
**Explanation:** This mirrors a real analytics deliverable: the technical clustering step is often the *smallest* part of the work — cleaning, scaling, defensibly choosing `k`, and then translating clusters back into human-readable profiles ("Segment 2 = young, high-spend, low-tenure — likely new enthusiastic customers") is what actually makes the analysis useful to a business stakeholder.

---

## 74. The Curse of Dimensionality in Clustering
**Problem:** Empirically demonstrate how distance-based clustering degrades as dimensionality increases, by tracking how "meaningful" distances become.

```python
import numpy as np
from sklearn.datasets import make_blobs
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

for n_features in [2, 10, 50, 200, 1000]:
    X, y_true = make_blobs(n_samples=300, centers=4, n_features=n_features,
                            cluster_std=1.0, random_state=42)
    labels = KMeans(n_clusters=4, random_state=42, n_init=10).fit_predict(X)
    sil = silhouette_score(X, labels)

    # ratio of max to min pairwise distance — closer to 1 means distances are less meaningful
    from sklearn.metrics.pairwise import euclidean_distances
    dists = euclidean_distances(X[:100])
    dists = dists[np.triu_indices_from(dists, k=1)]
    contrast = dists.max() / dists.min()

    print(f"dims={n_features:5d}  silhouette={sil:.3f}  max/min distance ratio={contrast:.2f}")
```
**Explanation:** As dimensionality grows, pairwise distances between points tend to become increasingly similar to one another (the max/min distance ratio shrinks toward 1), meaning "near" and "far" lose their usual meaning — this is exactly why clustering quality (silhouette score) tends to degrade in very high dimensions, and why dimensionality reduction (PCA, t-SNE, autoencoders) is often a necessary preprocessing step rather than an optional nicety.

---

## 75. Building a Reusable Clustering Evaluation Framework
**Problem:** Write a single reusable function that runs multiple clustering algorithms over a range of `k` values and returns a ranked comparison table.

```python
import pandas as pd
from sklearn.cluster import KMeans, AgglomerativeClustering
from sklearn.mixture import GaussianMixture
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score
from sklearn.datasets import make_blobs

def evaluate_clustering(X, k_range=range(2, 8)):
    results = []
    algorithms = {
        'KMeans': lambda k: KMeans(n_clusters=k, random_state=42, n_init=10),
        'Agglomerative': lambda k: AgglomerativeClustering(n_clusters=k),
        'GMM': lambda k: GaussianMixture(n_components=k, random_state=42)
    }
    for name, factory in algorithms.items():
        for k in k_range:
            model = factory(k)
            labels = model.fit_predict(X)
            if len(set(labels)) < 2:
                continue
            results.append({
                'algorithm': name,
                'k': k,
                'silhouette': silhouette_score(X, labels),
                'calinski_harabasz': calinski_harabasz_score(X, labels),
                'davies_bouldin': davies_bouldin_score(X, labels)
            })
    df = pd.DataFrame(results)
    return df.sort_values('silhouette', ascending=False).reset_index(drop=True)

X, _ = make_blobs(n_samples=400, centers=4, cluster_std=0.9, random_state=42)
report = evaluate_clustering(X)
print(report.head(10).round(3))
```
**Explanation:** Wrapping the whole "try several algorithms, try several k values, score everything the same way" workflow into one function turns a one-off script into a reusable tool you can point at *any* new dataset — exactly the kind of utility worth keeping in a personal or team toolkit, and a natural capstone that ties together nearly every concept from the earlier 74 problems.

---

# Part 4 — Expert / Specialized

## 76. Fuzzy C-Means Soft Clustering
**Problem:** Cluster customers where membership shouldn't be all-or-nothing (e.g., a customer half-resembling "budget" and half "premium" shoppers) using fuzzy c-means instead of hard K-Means.

```python
import numpy as np
import skfuzzy as fuzz
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=300, centers=3, cluster_std=1.2, random_state=42)

# skfuzzy expects features as rows, samples as columns
cntr, u, u0, d, jm, p, fpc = fuzz.cluster.cmeans(
    X.T, c=3, m=2.0, error=0.005, maxiter=1000, seed=42
)

hard_labels = np.argmax(u, axis=0)          # if you need a hard assignment
membership_of_point_0 = u[:, 0]              # soft membership vector for the first point

print("Fuzzy Partition Coefficient (1.0 = perfectly crisp):", round(fpc, 3))
print("Point 0 memberships across the 3 clusters:", membership_of_point_0.round(3))
```
**Explanation:** Unlike K-Means' hard `argmin` assignment, fuzzy c-means (FCM) returns a full membership vector `u` per point summing to 1 across clusters — useful when "how confidently does this point belong here" matters as much as "which cluster." The fuzziness parameter `m` (typically 1.5–3.0) controls how soft the boundaries are; `m` close to 1 approaches hard K-Means.

---

## 77. HDBSCAN for Variable-Density Clusters
**Problem:** DBSCAN's single global `eps` fails when clusters have very different densities (e.g., a tight cluster of frequent buyers next to a sparse cluster of occasional ones). Use HDBSCAN, which doesn't need a fixed `eps`.

```python
import numpy as np
import hdbscan
from sklearn.datasets import make_blobs

# Two clusters at very different densities, plus a sparse one
X1, _ = make_blobs(n_samples=200, centers=[[0, 0]], cluster_std=0.3, random_state=1)
X2, _ = make_blobs(n_samples=200, centers=[[6, 6]], cluster_std=1.8, random_state=2)
X = np.vstack([X1, X2])

clusterer = hdbscan.HDBSCAN(min_cluster_size=15, min_samples=5)
labels = clusterer.fit_predict(X)

print("Clusters found (excluding noise):", len(set(labels)) - (1 if -1 in labels else 0))
print("Noise points:", (labels == -1).sum())
print("Cluster persistence scores:", clusterer.cluster_persistence_.round(3))
```
**Explanation:** HDBSCAN builds a hierarchy of DBSCAN results across a range of `eps` values and extracts the most *stable* clusters from it, so a single global density threshold is no longer required — exactly the case where plain DBSCAN under- or over-merges. `cluster_persistence_` gives a per-cluster confidence score, higher meaning the cluster held together across a wider range of density thresholds.

---

## 78. Self-Organizing Maps for Clustering
**Problem:** Cluster data onto a 2D grid where similar clusters end up spatially near each other on the grid — useful for visual exploration, not just partitioning.

```python
import numpy as np
from minisom import MiniSom
from sklearn.preprocessing import StandardScaler
from sklearn.datasets import make_blobs

X, y_true = make_blobs(n_samples=300, centers=5, cluster_std=0.8, random_state=42)
X_scaled = StandardScaler().fit_transform(X)

som = MiniSom(x=7, y=7, input_len=X_scaled.shape[1], sigma=1.0, learning_rate=0.5, random_seed=42)
som.random_weights_init(X_scaled)
som.train_random(X_scaled, num_iteration=2000)

# Assign each point to its Best Matching Unit (BMU) grid cell
bmu_coords = np.array([som.winner(x) for x in X_scaled])
grid_labels = bmu_coords[:, 0] * 7 + bmu_coords[:, 1]   # flatten (row, col) into one label per cell

print("Distinct grid cells activated:", len(set(grid_labels)))
```
**Explanation:** A Self-Organizing Map (SOM) is a neural-network-based clustering method where a 2D grid of neurons is trained so that topologically close neurons respond to similar inputs — the grid position itself becomes a meaningful 2D embedding of cluster similarity, which plain K-Means labels don't give you. Grid cells (not just final labels) are often merged afterward using a distance threshold ("U-Matrix") to get a smaller number of final clusters.

---

## 79. Subspace Clustering via Feature Subsets
**Problem:** In high-dimensional data, different clusters may only be separable using different subsets of features (e.g., one customer segment separates on spend + frequency, another only on region + tenure). Approximate a CLIQUE-style subspace search.

```python
import numpy as np
import pandas as pd
from itertools import combinations
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

rng = np.random.RandomState(42)
df = pd.DataFrame({
    'spend': rng.normal(100, 30, 400),
    'frequency': rng.normal(10, 3, 400),
    'region_score': rng.normal(0, 1, 400),      # only meaningful for a different segment
    'tenure_years': rng.exponential(3, 400)
})

best_subspace, best_score = None, -1
for r in range(2, len(df.columns) + 1):
    for subset in combinations(df.columns, r):
        X_sub = df[list(subset)].values
        labels = KMeans(n_clusters=4, random_state=42, n_init=10).fit_predict(X_sub)
        if len(set(labels)) < 2:
            continue
        score = silhouette_score(X_sub, labels)
        if score > best_score:
            best_score, best_subspace = score, subset

print(f"Best-separating feature subspace: {best_subspace} (silhouette={best_score:.3f})")
```
**Explanation:** This brute-force subspace search is a simplified stand-in for algorithms like CLIQUE or PROCLUS — it exhaustively scores every feature combination by clustering quality and keeps the best one. It doesn't scale past a handful of features (the combinations explode), but it demonstrates the core subspace-clustering insight: the "best" clustering can depend entirely on *which* features you include, not just how many clusters you ask for.

---

## 80. Per-Cluster Silhouette Diagnostic Plot
**Problem:** A single average silhouette score hides whether the problem is one bad cluster or a systemic issue. Build the classic per-cluster silhouette diagram to see which clusters are weak.

```python
import numpy as np
import matplotlib.pyplot as plt
from matplotlib import cm
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
from sklearn.metrics import silhouette_samples, silhouette_score

X, _ = make_blobs(n_samples=400, centers=4, cluster_std=[0.5, 0.5, 1.5, 0.5], random_state=42)
labels = KMeans(n_clusters=4, random_state=42, n_init=10).fit_predict(X)
sample_scores = silhouette_samples(X, labels)
avg_score = silhouette_score(X, labels)

fig, ax = plt.subplots(figsize=(8, 6))
y_lower = 10
for i in range(4):
    cluster_scores = np.sort(sample_scores[labels == i])
    y_upper = y_lower + len(cluster_scores)
    ax.fill_betweenx(np.arange(y_lower, y_upper), 0, cluster_scores,
                      facecolor=cm.viridis(i / 4), alpha=0.7)
    ax.text(-0.05, y_lower + 0.5 * len(cluster_scores), str(i))
    y_lower = y_upper + 10

ax.axvline(avg_score, color='red', linestyle='--', label=f'Average = {avg_score:.3f}')
ax.set_xlabel("Silhouette coefficient")
ax.set_ylabel("Cluster")
ax.legend()
plt.title("Per-Cluster Silhouette Diagnostic")
plt.tight_layout(); plt.show()
```
**Explanation:** Clusters whose silhouette bars are consistently below the red average line (or that dip below zero) are the ones actually dragging down overall quality — often signaling that cluster should be split, merged into a neighbor, or that its points are genuinely ambiguous. This diagnostic is far more actionable than a single scalar silhouette score for deciding *what to fix*, not just *whether something's wrong*.

---

## 81. Clustering Document Embeddings
**Problem:** Group short text documents (support tickets, reviews) using dense embeddings rather than sparse TF-IDF, which better captures semantic similarity beyond exact word overlap.

```python
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.cluster import KMeans
from sklearn.preprocessing import normalize

documents = [
    "the app crashes every time I open the camera",
    "camera feature keeps closing the app unexpectedly",
    "billing charged me twice this month",
    "I was double charged on my last invoice",
    "love the new dark mode, looks great",
    "dark theme update is beautiful, nice job"
]

# A lightweight embedding proxy: TF-IDF -> SVD (dense, semantic-ish, low-dimensional)
tfidf = TfidfVectorizer(stop_words='english')
X_tfidf = tfidf.fit_transform(documents)
embeddings = normalize(TruncatedSVD(n_components=4, random_state=42).fit_transform(X_tfidf))

labels = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(embeddings)
for doc, label in zip(documents, labels):
    print(f"[Cluster {label}] {doc}")
```
**Explanation:** This uses TF-IDF + SVD as a dependency-free stand-in for a proper embedding model (e.g., sentence-transformers), but the clustering step afterward is identical either way: embed, normalize, then K-Means (or cosine-based clustering — see Problem 83). Swapping in real sentence embeddings typically improves cluster quality on paraphrased or semantically-similar-but-lexically-different text, which pure TF-IDF (see Problem 36) misses.

---

## 82. Autoencoder-Based Deep Clustering
**Problem:** For data with complex non-linear structure, learn a compressed representation with a neural autoencoder first, then cluster in that learned space instead of the raw feature space.

```python
import numpy as np
from sklearn.neural_network import MLPRegressor
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
from sklearn.preprocessing import StandardScaler

X, _ = make_blobs(n_samples=500, centers=5, n_features=20, cluster_std=2.0, random_state=42)
X_scaled = StandardScaler().fit_transform(X)

# A simple "autoencoder" built from an MLP trained to reconstruct its own input,
# with a narrow hidden layer acting as the compressed bottleneck.
bottleneck_size = 5
autoencoder = MLPRegressor(
    hidden_layer_sizes=(15, bottleneck_size, 15),
    activation='relu', max_iter=2000, random_state=42
)
autoencoder.fit(X_scaled, X_scaled)   # reconstruct the input itself

# Extract the bottleneck activations manually via the learned first two weight layers
hidden1 = np.maximum(0, X_scaled @ autoencoder.coefs_[0] + autoencoder.intercepts_[0])
bottleneck = np.maximum(0, hidden1 @ autoencoder.coefs_[1] + autoencoder.intercepts_[1])

labels = KMeans(n_clusters=5, random_state=42, n_init=10).fit_predict(bottleneck)
print("Cluster sizes in the learned 5-D bottleneck space:", np.bincount(labels))
```
**Explanation:** This is a simplified "deep clustering" pattern (compare to full Deep Embedded Clustering, which jointly optimizes reconstruction and cluster assignment loss) — train an autoencoder, take the compressed bottleneck layer as the new feature space, then cluster there instead of on raw features. It helps most when raw features are high-dimensional and non-linearly entangled, at the cost of losing the direct interpretability of clustering on named columns.

---

## 83. Clustering with Cosine Distance for Text/Embeddings
**Problem:** Euclidean distance is a poor fit for high-dimensional embeddings where *direction* matters more than magnitude. Cluster using cosine distance instead.

```python
import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_distances
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=200, centers=4, n_features=10, cluster_std=1.5, random_state=42)

# Precompute a cosine distance matrix, then cluster on it directly
dist_matrix = cosine_distances(X)
clustering = AgglomerativeClustering(
    n_clusters=4, metric='precomputed', linkage='average'
)
labels = clustering.fit_predict(dist_matrix)

print("Cluster sizes with cosine distance:", np.bincount(labels))
```
**Explanation:** K-Means only supports Euclidean distance natively (it's built into how centroids are computed), so cosine-based clustering requires either normalizing vectors to unit length before K-Means (a common workaround — Euclidean distance on unit vectors becomes monotonic with cosine distance) or, as shown here, using a distance-agnostic algorithm like Agglomerative Clustering with `metric='precomputed'` on a cosine distance matrix.

---

## 84. Biclustering (Co-Clustering) Rows and Columns
**Problem:** Simultaneously cluster customers *and* the products they buy, so that a discovered "cluster" is really a coherent block of (customer group, product group) — useful for recommendation and market-basket analysis.

```python
import numpy as np
from sklearn.cluster import SpectralCoclustering

rng = np.random.RandomState(42)
# Simulate a customer x product purchase-frequency matrix with 3 hidden co-clusters
n_customers, n_products = 60, 40
data = np.zeros((n_customers, n_products))
for block in range(3):
    rows = slice(block * 20, (block + 1) * 20)
    cols = slice(block * 13, (block + 1) * 13 + 1)
    data[rows, cols] = rng.poisson(lam=5, size=data[rows, cols].shape)
data += rng.poisson(lam=0.3, size=data.shape)  # background noise

model = SpectralCoclustering(n_clusters=3, random_state=42)
model.fit(data)

print("Customers in co-cluster 0:", np.sum(model.rows_[0]))
print("Products in co-cluster 0:", np.sum(model.columns_[0]))
reordered = data[np.argsort(model.row_labels_)][:, np.argsort(model.column_labels_)]
```
**Explanation:** Unlike standard clustering, which only groups rows, biclustering (co-clustering) simultaneously finds row groups *and* column groups such that each (row-group, column-group) block is internally coherent — exactly the shape of a customer-segment-to-product-affinity discovery task. `reordered` sorts the matrix so the discovered blocks become visually contiguous, which is the standard way to sanity-check a biclustering result.

---

## 85. Sliding-Window Streaming Clustering
**Problem:** Cluster an incoming stream of events using only a recent sliding window, so clusters can drift over time as old data ages out — unlike batch clustering, which assumes a fixed dataset.

```python
import numpy as np
from collections import deque
from sklearn.cluster import KMeans

rng = np.random.RandomState(42)
window = deque(maxlen=200)   # keep only the most recent 200 points
current_model = None

def new_event(t):
    # cluster centers drift slowly over time to simulate concept drift
    drift = t / 500
    return rng.normal(loc=[drift, -drift], scale=0.5, size=2)

for t in range(1, 601):
    window.append(new_event(t))
    if t % 100 == 0 and len(window) >= 50:
        current_model = KMeans(n_clusters=2, random_state=42, n_init=5).fit(np.array(window))
        print(f"t={t}: refit on window, centers=\n{current_model.cluster_centers_.round(2)}")
```
**Explanation:** Refitting on a bounded sliding window (rather than all history, or a single one-time fit) lets cluster centers track gradual drift in a live stream — the trade-off is a hyperparameter you now have to tune (window size, refit cadence) that balances responsiveness to genuine drift against noisy over-reaction to short-term fluctuation. Production systems often use `MiniBatchKMeans.partial_fit()` (Problem 63) alongside window-based forgetting, rather than one or the other alone.

---

## 86. K-Modes for Pure Categorical Data
**Problem:** K-Means needs numeric distance, which doesn't make sense for pure categorical data (no natural "average" of `{red, blue, green}`). Implement K-Modes, which uses mode instead of mean and Hamming distance instead of Euclidean.

```python
import numpy as np
import pandas as pd

rng = np.random.RandomState(42)
df = pd.DataFrame({
    'plan_tier': rng.choice(['free', 'pro', 'enterprise'], 200),
    'device': rng.choice(['ios', 'android', 'web'], 200),
    'region': rng.choice(['us', 'eu', 'apac'], 200)
})

def k_modes(df, k, n_iter=10, random_state=42):
    rng = np.random.RandomState(random_state)
    X = df.values
    modes = X[rng.choice(len(X), k, replace=False)].copy()

    for _ in range(n_iter):
        # Hamming distance: count mismatched categorical fields
        distances = np.array([[np.sum(row != mode) for mode in modes] for row in X])
        labels = distances.argmin(axis=1)
        for c in range(k):
            cluster_rows = X[labels == c]
            if len(cluster_rows) == 0:
                continue
            modes[c] = [pd.Series(cluster_rows[:, j]).mode()[0] for j in range(X.shape[1])]

    return labels, modes

labels, modes = k_modes(df, k=3)
print("Cluster sizes:", np.bincount(labels))
print("Cluster modes (representative category combo per cluster):\n", modes)
```
**Explanation:** K-Modes swaps K-Means' two numeric ingredients for categorical equivalents: **Hamming distance** (count of mismatched fields) replaces Euclidean distance, and the **mode** (most frequent category per field) replaces the mean as the cluster "center." This from-scratch version mirrors what the `kmodes` PyPI package does, useful when you can't add a dependency or want to see the mechanics explicitly.

---

## 87. Dunn Index for Cluster Validity
**Problem:** Silhouette and Davies-Bouldin are the common internal validity metrics (Problem 47), but the Dunn Index — ratio of minimum inter-cluster distance to maximum intra-cluster diameter — is a classic alternative worth having in the toolkit.

```python
import numpy as np
from scipy.spatial.distance import cdist
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=300, centers=4, cluster_std=0.7, random_state=42)
labels = KMeans(n_clusters=4, random_state=42, n_init=10).fit_predict(X)

def dunn_index(X, labels):
    clusters = [X[labels == c] for c in np.unique(labels)]

    # Minimum distance between any two points in different clusters
    inter_dists = [
        cdist(clusters[i], clusters[j]).min()
        for i in range(len(clusters)) for j in range(i + 1, len(clusters))
    ]
    # Maximum distance between any two points in the same cluster (cluster "diameter")
    intra_diams = [cdist(c, c).max() for c in clusters if len(c) > 1]

    return min(inter_dists) / max(intra_diams)

print(f"Dunn Index: {dunn_index(X, labels):.3f}  (higher is better; well-separated, compact clusters -> larger value)")
```
**Explanation:** The Dunn Index directly encodes the two things a "good" clustering wants: clusters far apart from each other (large numerator) and internally tight (small denominator). It's more sensitive to a single outlier or single close pair than silhouette (since it uses `min`/`max` rather than an average), which is exactly why it's typically reported *alongside* silhouette/Davies-Bouldin rather than instead of them.

---

## 88. Semi-Supervised Clustering with Label Propagation
**Problem:** You have a small number of confidently labeled points (e.g., known fraud cases) and a much larger pool of unlabeled ones — propagate the known labels through the unlabeled data using cluster structure.

```python
import numpy as np
from sklearn.semi_supervised import LabelSpreading
from sklearn.datasets import make_blobs

X, y_true = make_blobs(n_samples=300, centers=3, cluster_std=0.9, random_state=42)

# Simulate: only 5% of points have a known label, rest are -1 (unlabeled)
rng = np.random.RandomState(42)
y_partial = np.full(len(y_true), -1)
known_idx = rng.choice(len(y_true), size=15, replace=False)
y_partial[known_idx] = y_true[known_idx]

model = LabelSpreading(kernel='knn', n_neighbors=7, alpha=0.2)
model.fit(X, y_partial)
propagated_labels = model.transduction_

accuracy_on_originally_unlabeled = np.mean(
    propagated_labels[y_partial == -1] == y_true[y_partial == -1]
)
print(f"Propagated labels for {len(y_true) - 15} previously-unlabeled points")
print(f"Accuracy vs. true labels: {accuracy_on_originally_unlabeled:.1%}")
```
**Explanation:** `LabelSpreading` builds a similarity graph over *all* points (labeled and unlabeled) and iteratively spreads label information along graph edges — conceptually a supervised cousin of clustering, since it relies on the same "nearby points are similar" assumption but gets to anchor on the few labels you do have. This is the standard approach when full labeling is expensive but a small trusted seed set exists (e.g., a handful of analyst-confirmed fraud cases).

---

## 89. Density-Based Algorithm Face-Off: DBSCAN vs HDBSCAN vs OPTICS
**Problem:** These three density-based algorithms are often used interchangeably; run all three on the same tricky dataset (nested density levels + noise) to see concretely where they diverge.

```python
import numpy as np
import hdbscan
from sklearn.cluster import DBSCAN, OPTICS
from sklearn.datasets import make_blobs

rng = np.random.RandomState(42)
X_dense, _ = make_blobs(n_samples=150, centers=[[0, 0]], cluster_std=0.3, random_state=1)
X_sparse, _ = make_blobs(n_samples=150, centers=[[5, 5]], cluster_std=1.2, random_state=2)
X_noise = rng.uniform(-3, 8, size=(30, 2))
X = np.vstack([X_dense, X_sparse, X_noise])

results = {
    'DBSCAN (eps=0.5)': DBSCAN(eps=0.5, min_samples=5).fit_predict(X),
    'DBSCAN (eps=1.2)': DBSCAN(eps=1.2, min_samples=5).fit_predict(X),
    'OPTICS': OPTICS(min_samples=5, xi=0.05).fit_predict(X),
    'HDBSCAN': hdbscan.HDBSCAN(min_cluster_size=10).fit_predict(X),
}

for name, labels in results.items():
    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    n_noise = (labels == -1).sum()
    print(f"{name:20s}  clusters={n_clusters}  noise_points={n_noise}")
```
**Explanation:** A single `eps` for DBSCAN either merges the sparse cluster into noise (too small) or swallows the dense cluster's boundary into the sparse one (too large) — this dataset is specifically constructed so no single `eps` works well for both densities at once. OPTICS and HDBSCAN both handle variable density by building a hierarchy internally rather than committing to one global threshold, which is exactly why they tend to win on datasets like this one; HDBSCAN additionally gives a stability/persistence score per cluster (Problem 77) that OPTICS doesn't.

---

## 90. Cluster-and-Extend for Large-Scale Data
**Problem:** A dataset is too large to cluster directly with an algorithm like Agglomerative Clustering (which is O(n²) or worse). Cluster a representative sample, then assign the remaining points to the nearest learned cluster.

```python
import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.neighbors import KNeighborsClassifier
from sklearn.datasets import make_blobs

X_full, _ = make_blobs(n_samples=50000, centers=6, cluster_std=1.0, random_state=42)

# Step 1: cluster only a manageable sample with an otherwise-expensive algorithm
rng = np.random.RandomState(42)
sample_idx = rng.choice(len(X_full), size=2000, replace=False)
X_sample = X_full[sample_idx]
sample_labels = AgglomerativeClustering(n_clusters=6, linkage='ward').fit_predict(X_sample)

# Step 2: train a fast classifier on the sample's labels, then extend to everyone else
extender = KNeighborsClassifier(n_neighbors=5).fit(X_sample, sample_labels)
full_labels = extender.predict(X_full)

print(f"Clustered {len(X_sample):,} points directly, extended to {len(X_full):,} total")
print("Final cluster sizes:", np.bincount(full_labels))
```
**Explanation:** This "cluster a sample, then classify the rest" pattern sidesteps the scalability limits of algorithms that don't have a native large-data mode (Agglomerative, Spectral, DBSCAN-on-huge-data) by treating the sample's cluster labels as ground truth and using any fast supervised classifier (KNN here, but a decision tree or logistic regression work too) to generalize. The main risk is sample representativeness — a sample that misses a rare cluster entirely means that cluster is invisible in the final result.

---

## 91. Cluster-Based Anomaly Scoring
**Problem:** Rather than a binary "is this an outlier" flag (Problem 52's DBSCAN noise label), produce a continuous anomaly *score* per point based on distance to its nearest cluster centroid — useful for ranking transactions by suspicion level.

```python
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

rng = np.random.RandomState(42)
df = pd.DataFrame({
    'transaction_amount': np.concatenate([rng.normal(50, 15, 480), rng.normal(50, 15, 20) + rng.uniform(200, 500, 20)]),
    'transaction_hour': np.concatenate([rng.normal(14, 3, 480), rng.uniform(1, 4, 20)])
})

X_scaled = StandardScaler().fit_transform(df)
kmeans = KMeans(n_clusters=4, random_state=42, n_init=10).fit(X_scaled)

# Anomaly score = distance to the point's own assigned cluster centroid
labels = kmeans.labels_
distances_to_own_centroid = np.linalg.norm(X_scaled - kmeans.cluster_centers_[labels], axis=1)
df['anomaly_score'] = distances_to_own_centroid
df['anomaly_rank'] = df['anomaly_score'].rank(ascending=False)

print("Top 5 most anomalous transactions:")
print(df.sort_values('anomaly_score', ascending=False).head(5))
```
**Explanation:** Every point already has a well-defined "distance to its assigned centroid" from ordinary K-Means fitting — reusing that number directly as a continuous anomaly score, instead of just using cluster membership, turns any clustering result into a ranked fraud/anomaly-review queue essentially for free. This complements density-based outlier detection (DBSCAN noise, Problem 52 / Isolation-Forest-style methods) rather than replacing it — centroid-distance scoring assumes roughly convex clusters, and can miss anomalies that sit *inside* a cluster's convex hull but in a locally sparse pocket.

---

## 92. Multi-View Clustering on Concatenated Feature Sets
**Problem:** A customer can be described by two very different "views" — behavioral features (clicks, purchases) and demographic features (age, income) — that live on different scales and possibly encode conflicting structure. Cluster using both views together, correctly weighted.

```python
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans

rng = np.random.RandomState(42)
behavioral_view = pd.DataFrame({
    'sessions_per_week': rng.poisson(5, 400),
    'avg_session_minutes': rng.exponential(8, 400),
    'items_viewed': rng.poisson(12, 400)
})
demographic_view = pd.DataFrame({
    'age': rng.randint(18, 70, 400),
    'income': rng.normal(60000, 20000, 400).clip(15000)
})

# Scale each view independently BEFORE concatenating, so one view can't dominate
# purely because it happens to have larger raw numeric ranges
behavioral_scaled = StandardScaler().fit_transform(behavioral_view)
demographic_scaled = StandardScaler().fit_transform(demographic_view)

# Optionally weight views by importance (here: behavioral counts for slightly more)
combined = np.hstack([behavioral_scaled * 1.2, demographic_scaled * 1.0])

labels = KMeans(n_clusters=4, random_state=42, n_init=10).fit_predict(combined)
print("Segment sizes using both behavioral and demographic views:", np.bincount(labels))
```
**Explanation:** The critical step is scaling each view *independently* before concatenation — scaling the combined matrix all at once would still let a view with more columns (or more variance) implicitly dominate the distance calculation. Explicit per-view weights (the `* 1.2` / `* 1.0` here) let a domain expert encode "behavioral signal should count for more than demographics" directly, rather than leaving that decision to whatever the raw feature scales happen to produce.

---

## 93. Time-Series Clustering with Dynamic Time Warping
**Problem:** Two time series can follow the same *shape* while being shifted or stretched in time (e.g., two stores' weekly sales patterns, one a few days ahead of the other). Euclidean distance penalizes this misalignment; Dynamic Time Warping (DTW) doesn't.

```python
import numpy as np
from sklearn.cluster import AgglomerativeClustering

def dtw_distance(s1, s2):
    n, m = len(s1), len(s2)
    dtw_matrix = np.full((n + 1, m + 1), np.inf)
    dtw_matrix[0, 0] = 0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = abs(s1[i - 1] - s2[j - 1])
            dtw_matrix[i, j] = cost + min(
                dtw_matrix[i - 1, j], dtw_matrix[i, j - 1], dtw_matrix[i - 1, j - 1]
            )
    return dtw_matrix[n, m]

rng = np.random.RandomState(42)
base_pattern = np.sin(np.linspace(0, 4 * np.pi, 50))
series = []
for _ in range(12):
    shift = rng.randint(-5, 5)
    noise = rng.normal(0, 0.1, 50)
    shifted = np.roll(base_pattern, shift) + noise
    series.append(shifted)
series = np.array(series)

n = len(series)
dist_matrix = np.zeros((n, n))
for i in range(n):
    for j in range(i + 1, n):
        d = dtw_distance(series[i], series[j])
        dist_matrix[i, j] = dist_matrix[j, i] = d

labels = AgglomerativeClustering(n_clusters=2, metric='precomputed', linkage='average').fit_predict(dist_matrix)
print("Cluster assignment per series:", labels)
```
**Explanation:** DTW finds the optimal non-linear alignment between two sequences before measuring distance, so two shifted-but-same-shaped series score as *close*, where plain Euclidean distance (comparing point 1 to point 1, point 2 to point 2, etc.) would score them as far apart purely due to the shift. This from-scratch DTW is O(n·m) per pair and fine for small series/small n; production use typically reaches for `dtaidistance` or `tslearn`, which implement the same idea with much faster (often C-accelerated) DTW.

---

## 94. Weighted K-Means for Business-Critical Points
**Problem:** Not all points should count equally — a high-value customer's location in feature space should pull the centroid more than a low-value one. Use sample weights so K-Means' centroid update reflects business importance, not just count.

```python
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans

rng = np.random.RandomState(42)
df = pd.DataFrame({
    'engagement_score': rng.normal(50, 15, 300),
    'recency_days': rng.exponential(20, 300),
    'lifetime_value': rng.exponential(200, 300)  # used only as a weight, not a clustering feature
})

X = df[['engagement_score', 'recency_days']].values
weights = df['lifetime_value'].values

unweighted = KMeans(n_clusters=3, random_state=42, n_init=10).fit(X)
weighted = KMeans(n_clusters=3, random_state=42, n_init=10).fit(X, sample_weight=weights)

print("Unweighted centroids:\n", unweighted.cluster_centers_.round(2))
print("Weighted centroids (pulled toward high-lifetime-value points):\n", weighted.cluster_centers_.round(2))
```
**Explanation:** `sample_weight` changes the centroid-update math directly — a point with weight 5 counts as if it appeared 5 times when averaging positions within a cluster — so high-value customers exert proportionally more influence over where each segment's "center" ends up, without duplicating rows or being included as a clustering feature themselves (which would bias distance calculations instead of just the averaging step).

---

## 95. Explaining Clusters with a Surrogate Decision Tree
**Problem:** Stakeholders don't want "cluster 2" — they want "customers over 45 with income above $70k." Train a shallow decision tree to predict cluster labels from the original features, and read off the splits as a plain-English rule.

```python
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.tree import DecisionTreeClassifier, export_text

rng = np.random.RandomState(42)
df = pd.DataFrame({
    'age': rng.randint(18, 70, 400),
    'income': rng.normal(60000, 20000, 400).clip(15000),
    'spending_score': rng.randint(1, 100, 400)
})

X_scaled = StandardScaler().fit_transform(df)
df['segment'] = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(X_scaled)

# Train a shallow, interpretable surrogate model to reproduce the cluster labels
surrogate = DecisionTreeClassifier(max_depth=3, random_state=42)
surrogate.fit(df[['age', 'income', 'spending_score']], df['segment'])

print(f"Surrogate tree fidelity (accuracy vs. actual cluster labels): {surrogate.score(df[['age', 'income', 'spending_score']], df['segment']):.1%}")
print(export_text(surrogate, feature_names=['age', 'income', 'spending_score']))
```
**Explanation:** The surrogate tree isn't the clustering algorithm itself — it's trained *afterward* to approximate the existing cluster assignments using simple, auditable if/else rules on the original (unscaled, human-readable) features. A high "fidelity" score means the tree's rules are a trustworthy plain-language explanation of the clusters; a low one means the true cluster boundaries are more complex than any shallow tree can capture, and the explanation should be treated as approximate.

---

## 96. Frequency Encoding High-Cardinality Categoricals Before Clustering
**Problem:** One-hot encoding (Problem 17) blows up dimensionality when a categorical column has hundreds of distinct values (e.g., ZIP code, product SKU). Use frequency encoding instead to keep it clustering-friendly.

```python
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans

rng = np.random.RandomState(42)
zip_codes = [f"Z{100 + i}" for i in range(150)]   # 150 distinct ZIPs -- too many to one-hot sensibly
df = pd.DataFrame({
    'zip_code': rng.choice(zip_codes, 500, p=np.array([1/(i+1) for i in range(150)]) / sum(1/(i+1) for i in range(150))),
    'purchase_amount': rng.exponential(80, 500)
})

# Frequency encoding: replace each category with how often it appears
zip_freq = df['zip_code'].value_counts(normalize=True)
df['zip_frequency'] = df['zip_code'].map(zip_freq)

X = StandardScaler().fit_transform(df[['zip_frequency', 'purchase_amount']])
df['segment'] = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(X)

print("Segment sizes:", df['segment'].value_counts().to_dict())
print("Avg ZIP frequency and purchase amount per segment:\n", df.groupby('segment')[['zip_frequency', 'purchase_amount']].mean())
```
**Explanation:** Frequency encoding compresses an arbitrarily-high-cardinality column into a single numeric feature representing "how common is this category," which is often exactly the signal that matters for clustering (dense/popular ZIP vs. rare/niche one) without the dimensionality explosion of one-hot encoding 150+ columns. The trade-off: two different ZIP codes with coincidentally similar frequencies become indistinguishable to the clustering algorithm — target encoding or embeddings are the next step up if that distinction matters.

---

## 97. Cluster Stability via Adjusted Mutual Information
**Problem:** Problem 69 checked stability across random seeds using ARI against a fixed reference; here, use Adjusted Mutual Information (AMI) — a metric that, unlike ARI, handles very different numbers of clusters between two runs gracefully.

```python
import numpy as np
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
from sklearn.metrics import adjusted_mutual_info_score

X, _ = make_blobs(n_samples=400, centers=5, cluster_std=1.3, random_state=42)

seeds = [1, 2, 3, 4, 5]
all_labels = [KMeans(n_clusters=5, random_state=s, n_init=10).fit_predict(X) for s in seeds]

ami_scores = []
for i in range(len(all_labels)):
    for j in range(i + 1, len(all_labels)):
        ami = adjusted_mutual_info_score(all_labels[i], all_labels[j])
        ami_scores.append(ami)

print(f"Pairwise AMI across {len(seeds)} seeds: mean={np.mean(ami_scores):.3f}, min={np.min(ami_scores):.3f}")
print("AMI close to 1.0 = highly stable clustering; close to 0 = essentially random agreement")
```
**Explanation:** AMI adjusts mutual information for the fact that two purely random labelings can still overlap by chance (worse when cluster counts differ), which is exactly the failure mode that makes raw mutual information misleading for stability checks. Prefer AMI over ARI specifically when comparing runs that might legitimately produce different numbers of clusters (e.g., comparing K-Means at fixed k against HDBSCAN's auto-discovered cluster count) — ARI assumes a shared partition structure that AMI doesn't require.

---

## 98. Two-Stage Coarse-to-Fine Clustering
**Problem:** A single flat clustering pass sometimes misses meaningful sub-structure within a cluster (e.g., "high spenders" as one segment hides a further split between "high spend, high frequency" and "high spend, one-time big purchase"). Cluster in two stages: coarse groups first, then refine each independently.

```python
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans

rng = np.random.RandomState(42)
df = pd.DataFrame({
    'total_spend': np.concatenate([rng.normal(50, 15, 300), rng.normal(500, 100, 200)]),
    'purchase_frequency': np.concatenate([rng.poisson(3, 300), np.concatenate([rng.poisson(15, 100), rng.poisson(1, 100)])])
})

X_scaled = StandardScaler().fit_transform(df)

# Stage 1: coarse split (e.g., low spend vs. high spend)
coarse_labels = KMeans(n_clusters=2, random_state=42, n_init=10).fit_predict(X_scaled)
df['coarse_segment'] = coarse_labels

# Stage 2: refine each coarse segment independently
df['fine_segment'] = -1
for coarse_id in df['coarse_segment'].unique():
    mask = df['coarse_segment'] == coarse_id
    if mask.sum() < 10:
        continue
    sub_scaled = StandardScaler().fit_transform(df.loc[mask, ['total_spend', 'purchase_frequency']])
    sub_labels = KMeans(n_clusters=2, random_state=42, n_init=10).fit_predict(sub_scaled)
    # Make fine labels globally unique: coarse_id * 10 + local sub-cluster id
    df.loc[mask, 'fine_segment'] = coarse_id * 10 + sub_labels

print(df.groupby('fine_segment')[['total_spend', 'purchase_frequency']].agg(['mean', 'count']))
```
**Explanation:** Refitting K-Means *within* each coarse cluster (rather than just asking for more clusters globally, e.g. `n_clusters=4` in one pass) lets each sub-clustering step use a scaler and cluster count tuned to that subgroup's own internal variance, which a single global pass can't do — a subgroup with tight, low variance sub-structure benefits from its own local scaling rather than being drowned out by a very different subgroup's scale in a single flat run.

---

## 99. Visualizing Clusters with UMAP
**Problem:** t-SNE (Problem 38) is the classic choice for visualizing high-dimensional clusters in 2D, but UMAP is now a common faster alternative that also better preserves global (not just local) structure.

```python
import numpy as np
import matplotlib.pyplot as plt
import umap
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X, y_true = make_blobs(n_samples=800, centers=6, n_features=30, cluster_std=2.5, random_state=42)
labels = KMeans(n_clusters=6, random_state=42, n_init=10).fit_predict(X)

reducer = umap.UMAP(n_neighbors=15, min_dist=0.1, random_state=42)
embedding = reducer.fit_transform(X)

plt.figure(figsize=(8, 6))
scatter = plt.scatter(embedding[:, 0], embedding[:, 1], c=labels, cmap='tab10', s=15)
plt.legend(*scatter.legend_elements(), title="Cluster")
plt.title("UMAP Projection Colored by Cluster Assignment")
plt.tight_layout(); plt.show()
```
**Explanation:** UMAP tends to run noticeably faster than t-SNE on larger datasets and, because it optimizes a different objective (preserving both local neighborhoods and more of the overall topological structure), often produces embeddings where inter-cluster distances are more meaningful — t-SNE is well known for making cluster *separation* look good while distorting relative cluster *sizes and distances*. `n_neighbors` and `min_dist` are UMAP's two main tuning knobs: smaller `n_neighbors` emphasizes fine local structure, larger emphasizes the global picture.

---

## 100. A Production-Ready sklearn Pipeline for Clustering
**Problem:** Wrap scaling, dimensionality reduction, and clustering into a single `sklearn.pipeline.Pipeline` object so the entire workflow is one reusable, serializable unit rather than a sequence of manual steps.

```python
import numpy as np
import pandas as pd
import joblib
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans

rng = np.random.RandomState(42)
df = pd.DataFrame({
    'age': rng.randint(18, 70, 500),
    'income': rng.normal(60000, 20000, 500).clip(15000),
    'spending_score': rng.randint(1, 100, 500),
    'tenure_years': rng.exponential(3, 500).clip(0, 20)
})

clustering_pipeline = Pipeline([
    ('scaler', StandardScaler()),
    ('pca', PCA(n_components=0.95, random_state=42)),   # keep 95% of variance
    ('kmeans', KMeans(n_clusters=4, random_state=42, n_init=10))
])

clustering_pipeline.fit(df)
df['segment'] = clustering_pipeline.predict(df)

# Persist the whole pipeline -- scaler, PCA, and fitted centroids together --
# so new data can be scored identically in production without re-deriving any step
joblib.dump(clustering_pipeline, 'clustering_pipeline.joblib')
loaded_pipeline = joblib.load('clustering_pipeline.joblib')

print("Segment sizes:", df['segment'].value_counts().to_dict())
print("Components kept by PCA:", clustering_pipeline.named_steps['pca'].n_components_)
```
**Explanation:** Bundling every preprocessing step into one `Pipeline` guarantees that new data gets *exactly* the same scaling and PCA transformation used during fitting — a common production bug is scaling new data with a freshly-fit scaler instead of the one saved from training, which silently produces wrong cluster assignments. This is the natural production counterpart to Problem 73's "profile and evaluate" project and Problem 75's evaluation framework: this one is about shipping the winning approach, not choosing it.

---

## Quick Reference: Choosing an Algorithm

| Situation | Recommended Algorithm |
|---|---|
| Roughly spherical, similar-sized clusters, know `k` | K-Means / MiniBatchKMeans |
| Arbitrary shapes, unknown `k`, need outlier detection | DBSCAN / OPTICS |
| Variable density across clusters | HDBSCAN |
| Elliptical clusters, need soft/probabilistic assignment | Gaussian Mixture Model |
| Need genuinely soft (non-probabilistic) membership | Fuzzy C-Means |
| Need a full hierarchy / dendrogram, small-to-medium data | Agglomerative Clustering |
| Very large / streaming data | MiniBatchKMeans / BIRCH |
| Non-convex shapes via graph structure | Spectral Clustering |
| Automatically discover cluster count | Mean Shift / OPTICS / DBSCAN / HDBSCAN |
| Pure categorical data | K-Modes |
| Simultaneous row + column structure | Biclustering (SpectralCoclustering) |

**End of set — 100 problems covering Beginner → Intermediate → Advanced → Expert/Specialized clustering with scikit-learn.**
