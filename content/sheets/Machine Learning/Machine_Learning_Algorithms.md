# Machine Learning Algorithms Cheatsheet

## Overview

This sheet covers the core supervised learning algorithm families you'll reach for on tabular data: linear models, decision trees, ensembles, SVMs, and simple probabilistic/instance-based baselines. For each, the goal isn't just "here's the API" — it's understanding the assumptions and failure modes well enough to know *when* to reach for it.

```
Data comes in → what shape is it? → what does that suggest?
├─ Linear relationship, need interpretability → Linear/Logistic Regression
├─ Non-linear, mixed feature types, need interpretability → Decision Tree
├─ Non-linear, need accuracy over interpretability → Ensembles (RF, GBM)
├─ High-dimensional, small-to-medium data → SVM
└─ Need a fast, dumb baseline → Naive Bayes / KNN
```

---

## 1. Linear & Logistic Regression

### Assumptions (linear regression)
- **Linearity**: the relationship between features and target is linear in the coefficients.
- **Independence**: residuals aren't correlated with each other (violated in time series without care).
- **Homoscedasticity**: residual variance is constant across the range of predictions.
- **No/low multicollinearity**: correlated features inflate coefficient variance and make them unstable.
- **Normally distributed residuals**: matters for valid confidence intervals/p-values, not for point predictions.

Logistic regression drops the normality/homoscedasticity assumptions (it's modeling log-odds of a binary outcome) but keeps the linearity-in-the-logit assumption.

### Regularization: L1 vs L2

| | L1 (Lasso) | L2 (Ridge) |
|---|---|---|
| Effect on coefficients | Drives some to exactly zero | Shrinks all toward zero, none exactly |
| Use case | Feature selection built-in | Multicollinearity, keep all features |
| Geometry | Diamond-shaped constraint (corners → sparsity) | Circular constraint (smooth shrinkage) |
| Elastic Net | Combines both — `l1_ratio` controls the mix | |

### Python: Regression with regularization

```python
import numpy as np
from sklearn.linear_model import LinearRegression, Ridge, Lasso, ElasticNet, LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import train_test_split
from sklearn.datasets import make_regression, make_classification

# --- Regression example ---
X, y = make_regression(n_samples=500, n_features=20, n_informative=8, noise=15, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Always scale before regularized regression — L1/L2 penalties are scale-sensitive
ridge = make_pipeline(StandardScaler(), Ridge(alpha=1.0))
lasso = make_pipeline(StandardScaler(), Lasso(alpha=0.1))
elastic = make_pipeline(StandardScaler(), ElasticNet(alpha=0.1, l1_ratio=0.5))

for name, model in [("Ridge", ridge), ("Lasso", lasso), ("ElasticNet", elastic)]:
    model.fit(X_train, y_train)
    print(f"{name} R^2: {model.score(X_test, y_test):.3f}")

# Lasso's coefficient sparsity — how many features survived?
lasso.fit(X_train, y_train)
coefs = lasso.named_steps["lasso"].coef_
print(f"Lasso zeroed out {np.sum(coefs == 0)} / {len(coefs)} features")

# --- Classification example ---
Xc, yc = make_classification(n_samples=500, n_features=20, n_informative=10, random_state=42)
Xc_train, Xc_test, yc_train, yc_test = train_test_split(Xc, yc, test_size=0.2, random_state=42)

logreg = make_pipeline(
    StandardScaler(),
    LogisticRegression(penalty="l2", C=1.0, max_iter=1000)  # C = 1/alpha, smaller C = stronger regularization
)
logreg.fit(Xc_train, yc_train)
print(f"LogReg accuracy: {logreg.score(Xc_test, yc_test):.3f}")
```

**Gotcha:** `C` in `LogisticRegression` is the *inverse* of regularization strength (unlike `alpha` in `Ridge`/`Lasso`). Small `C` = strong regularization.

---

## 2. Decision Trees

### Splitting criteria
- **Classification**: Gini impurity (default, faster) or entropy/information gain (slightly more sensitive to class imbalance in splits).
- **Regression**: MSE (variance reduction) is the default; MAE is more robust to outliers but slower to compute.

### Overfitting and pruning
Trees overfit by growing until every leaf is pure (or near-pure) — memorizing noise. Control this with:
- `max_depth` — hard cap on tree depth
- `min_samples_split` / `min_samples_leaf` — minimum samples required to split or exist in a leaf
- `max_leaf_nodes` — cap on total leaves
- `ccp_alpha` — cost-complexity pruning: grows the full tree, then prunes back branches that don't improve validation performance enough to justify their complexity

### Python: Decision tree with pruning

```python
from sklearn.tree import DecisionTreeClassifier, plot_tree
from sklearn.model_selection import cross_val_score
import matplotlib.pyplot as plt

# Unconstrained tree — will overfit
tree_overfit = DecisionTreeClassifier(random_state=42)
tree_overfit.fit(Xc_train, yc_train)
print(f"Unconstrained — train: {tree_overfit.score(Xc_train, yc_train):.3f}, "
      f"test: {tree_overfit.score(Xc_test, yc_test):.3f}")

# Pruned tree via explicit constraints
tree_pruned = DecisionTreeClassifier(
    max_depth=5, min_samples_leaf=10, random_state=42
)
tree_pruned.fit(Xc_train, yc_train)
print(f"Pruned      — train: {tree_pruned.score(Xc_train, yc_train):.3f}, "
      f"test: {tree_pruned.score(Xc_test, yc_test):.3f}")

# Cost-complexity pruning: find the best ccp_alpha via cross-validation
path = tree_overfit.cost_complexity_pruning_path(Xc_train, yc_train)
alphas = path.ccp_alphas[:-1]  # drop the trivial single-node tree
cv_scores = [
    cross_val_score(DecisionTreeClassifier(ccp_alpha=a, random_state=42), Xc_train, yc_train, cv=5).mean()
    for a in alphas[::max(1, len(alphas)//20)]  # sample alphas to keep this fast
]
best_alpha = alphas[::max(1, len(alphas)//20)][int(np.argmax(cv_scores))]
print(f"Best ccp_alpha from CV: {best_alpha:.5f}")
```

---

## 3. Ensembles: Bagging vs. Boosting

| | Bagging (Random Forest) | Boosting (Gradient Boosting) |
|---|---|---|
| Base learners | Trained in parallel, independently | Trained sequentially, each fixing prior errors |
| Reduces | Variance | Bias (and variance, with care) |
| Overfitting risk | Lower — averaging smooths noise | Higher — needs early stopping / shrinkage |
| Speed | Parallelizable, fast to train | Sequential, slower to train |
| Typical winner | Robust default, less tuning | Higher accuracy ceiling with tuning |

### Python: Random Forest vs. Gradient Boosting

```python
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier

rf = RandomForestClassifier(
    n_estimators=300, max_depth=None, max_features="sqrt",
    n_jobs=-1, random_state=42
)
rf.fit(Xc_train, yc_train)

gbm = GradientBoostingClassifier(
    n_estimators=300, learning_rate=0.05, max_depth=3,
    subsample=0.8, random_state=42  # subsample < 1.0 = stochastic gradient boosting
)
gbm.fit(Xc_train, yc_train)

print(f"Random Forest test accuracy:     {rf.score(Xc_test, yc_test):.3f}")
print(f"Gradient Boosting test accuracy: {gbm.score(Xc_test, yc_test):.3f}")

# Feature importance comparison
importances = sorted(zip(rf.feature_importances_, range(20)), reverse=True)[:5]
print("Top 5 RF features (importance, index):", importances)
```

**Note:** For production tabular work, `xgboost`/`lightgbm` almost always beat sklearn's `GradientBoostingClassifier` on speed and often accuracy — see the dedicated XGBoost/LightGBM sheet.

---

## 4. Support Vector Machines

### Kernels and margin intuition
SVMs find the hyperplane that maximizes the margin between classes. The **kernel trick** lets you do this in a higher-dimensional space without explicitly computing the transformation:

- **Linear kernel**: fast, works when classes are (nearly) linearly separable, high-dimensional sparse data (e.g., text with TF-IDF).
- **RBF kernel**: default choice for non-linear boundaries; `gamma` controls how far the influence of a single point reaches (high gamma = tighter, more complex boundary → overfitting risk).
- **Polynomial kernel**: rarely the best choice in practice; RBF usually wins when non-linearity is needed.

### When SVMs still win
- Small-to-medium datasets (thousands, not millions of rows) — SVM training is O(n²) to O(n³).
- High-dimensional data with a clear margin (text classification, bioinformatics with more features than samples).
- When you need a solid non-probabilistic baseline before reaching for deep learning.

### Python: SVM with kernel and gamma tuning

```python
from sklearn.svm import SVC
from sklearn.model_selection import GridSearchCV

svm_pipeline = make_pipeline(StandardScaler(), SVC())  # SVMs are scale-sensitive — always scale first

param_grid = {
    "svc__kernel": ["rbf", "linear"],
    "svc__C": [0.1, 1, 10],
    "svc__gamma": ["scale", 0.01, 0.1],
}
grid = GridSearchCV(svm_pipeline, param_grid, cv=5, n_jobs=-1)
grid.fit(Xc_train, yc_train)

print("Best params:", grid.best_params_)
print(f"Test accuracy: {grid.score(Xc_test, yc_test):.3f}")
```

---

## 5. Naive Bayes & k-Nearest Neighbors as Fast Baselines

Both are cheap to stand up and give you a sanity-check floor before investing in anything heavier.

- **Naive Bayes**: assumes feature independence given the class (almost always false, often works anyway). `GaussianNB` for continuous features, `MultinomialNB` for counts (text), `BernoulliNB` for binary features. Training is essentially instant — just computing class-conditional statistics.
- **k-NN**: no training phase at all (lazy learner) — prediction requires scanning (or index-searching) the training set. Sensitive to feature scale and the curse of dimensionality; `k` controls the bias/variance tradeoff (small k = low bias/high variance).

```python
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier

nb = GaussianNB()
nb.fit(Xc_train, yc_train)
print(f"Naive Bayes accuracy: {nb.score(Xc_test, yc_test):.3f}")

knn_pipeline = make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=15))
knn_pipeline.fit(Xc_train, yc_train)
print(f"KNN (k=15) accuracy: {knn_pipeline.score(Xc_test, yc_test):.3f}")

# Quick sweep to pick k
for k in [1, 5, 15, 30]:
    knn = make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=k))
    knn.fit(Xc_train, yc_train)
    print(f"  k={k}: {knn.score(Xc_test, yc_test):.3f}")
```

---

## 6. Choosing an Algorithm Family

| Situation | Reach for |
|---|---|
| Need coefficients you can explain to a regulator/exec | Linear/Logistic Regression |
| Mixed categorical+numeric features, want interpretability | Decision Tree |
| Tabular data, accuracy is the priority | Gradient Boosting (XGBoost/LightGBM) |
| Robust default with minimal tuning | Random Forest |
| < 10k rows, high-dimensional, clean margin | SVM |
| Need a same-day baseline | Naive Bayes or KNN |
| Latency-critical, must score in microseconds | Logistic Regression or a small tree (avoid ensembles/SVM) |

## Common Pitfalls

- **Not scaling before linear models/SVM/KNN** — coefficients and distances become meaningless if features are on wildly different scales. Tree-based models don't need this.
- **Comparing models on training accuracy** — always compare on held-out data; a deep unconstrained tree will always "win" on train.
- **Assuming Random Forest feature importance is causal** — it reflects how much a feature reduced impurity, not why, and is biased toward high-cardinality features.
- **Using accuracy on imbalanced classes** — a 95%-majority-class dataset gets 95% "accuracy" by predicting the majority class every time. See the Model Evaluation sheet.
- **Grid-searching SVM's `gamma`/`C` on unscaled data** — the search will land on nonsensical values because the feature scale dominates the kernel computation.

---

## 7. End-to-End Worked Example: Model Bake-Off on a Realistic Dataset

Putting every algorithm family from this sheet side-by-side on the same dataset, with the same preprocessing, is the fastest way to build intuition for their relative strengths.

```python
import pandas as pd
import numpy as np
from sklearn.datasets import fetch_california_housing, make_classification
from sklearn.model_selection import cross_validate, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
import time

X, y = make_classification(
    n_samples=3000, n_features=25, n_informative=15, n_redundant=5,
    n_clusters_per_class=3, flip_y=0.05, random_state=42
)

candidates = {
    "Logistic Regression": make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)),
    "Decision Tree":        DecisionTreeClassifier(max_depth=8, random_state=42),
    "Random Forest":        RandomForestClassifier(n_estimators=200, n_jobs=-1, random_state=42),
    "Gradient Boosting":    GradientBoostingClassifier(n_estimators=200, random_state=42),
    "SVM (RBF)":            make_pipeline(StandardScaler(), SVC()),
    "Naive Bayes":          GaussianNB(),
    "KNN":                  make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=15)),
}

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
results = []
for name, model in candidates.items():
    start = time.time()
    scores = cross_validate(model, X, y, cv=cv, scoring=["accuracy", "roc_auc"], n_jobs=-1)
    elapsed = time.time() - start
    results.append({
        "model": name,
        "accuracy": scores["test_accuracy"].mean(),
        "roc_auc": scores["test_roc_auc"].mean(),
        "fit_time_s": round(elapsed, 2),
    })

results_df = pd.DataFrame(results).sort_values("roc_auc", ascending=False)
print(results_df.to_string(index=False))
```

**Reading this table correctly:** the "winner" by raw ROC-AUC is rarely the full story — cross-reference against `fit_time_s` (does the accuracy gain justify 20x the training time?) and think about what each model would cost to maintain and explain in production. A Random Forest that's 1 point of AUC behind Gradient Boosting but trains in a third of the time, with feature importances a stakeholder can actually parse, is very often the better real-world choice.

---

## 8. Advanced & Lesser-Known Techniques

- **Stacking ensembles**: train several diverse base models (e.g., logistic regression + random forest + SVM), then train a lightweight meta-model (usually logistic regression) on their out-of-fold predictions. This can squeeze out a further accuracy gain beyond any single model or simple voting ensemble, at the cost of complexity and interpretability.

```python
from sklearn.ensemble import StackingClassifier

stacking_model = StackingClassifier(
    estimators=[
        ("rf", RandomForestClassifier(n_estimators=100, random_state=42)),
        ("svm", make_pipeline(StandardScaler(), SVC(probability=True))),
        ("nb", GaussianNB()),
    ],
    final_estimator=LogisticRegression(max_iter=1000),
    cv=5,  # out-of-fold predictions from the base models feed the meta-model, avoiding leakage
)
```

- **Monotonic constraints**: some tree-based implementations (XGBoost, LightGBM) let you force a feature's relationship with the prediction to be monotonically increasing or decreasing — useful when domain knowledge says "more income should never decrease approval probability," even if noisy training data would otherwise let the model learn a wiggly, counter-intuitive relationship.
- **Quantile regression** (`GradientBoostingRegressor(loss="quantile", alpha=0.9)`): instead of predicting the mean, predict a specific percentile of the target distribution — useful for producing prediction intervals ("we expect demand to be below X with 90% confidence") rather than a single point estimate.
- **Isotonic vs. sigmoid calibration** for SVM's `predict_proba`: SVMs don't natively produce well-calibrated probabilities; `probability=True` uses an internal 5-fold cross-validated sigmoid (Platt) calibration, which can be a bottleneck on large datasets — consider `CalibratedClassifierCV` with `method="isotonic"` for a more flexible fit if you have enough data.

---

## 9. Practice Exercises

1. Take the `make_classification` dataset above and add 5 uninformative, purely random features. Re-run the bake-off — which models' performance degrades the most, and why does that match their sensitivity to irrelevant features?
2. Force `DecisionTreeClassifier` to grow unconstrained (`max_depth=None`) and compare train vs. test accuracy. Then apply `ccp_alpha` pruning found via cross-validation and compare again — quantify the overfitting gap before and after.
3. For the SVM, run a grid search over `gamma` on both scaled and unscaled data. Explain why the unscaled search produces much worse (or degenerate) results.
4. Build a `StackingClassifier` combining three models from this sheet and compare its cross-validated ROC-AUC against the best single model. Is the improvement worth the added complexity for a hypothetical production system you'd need to explain to a non-technical stakeholder?
5. Using the fraud-style imbalanced dataset pattern from the Model Evaluation sheet, retrain Random Forest and Gradient Boosting with `class_weight="balanced"` and compare PR-AUC (not accuracy) before and after.

---

## 10. More Examples

### Example: Multi-class logistic regression with per-class regularization inspection

```python
from sklearn.datasets import load_wine
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

X, y = load_wine(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, stratify=y, random_state=42)
scaler = StandardScaler().fit(X_train)

model = LogisticRegression(max_iter=2000, multi_class="multinomial")
model.fit(scaler.transform(X_train), y_train)
print(f"Test accuracy: {model.score(scaler.transform(X_test), y_test):.3f}")
print(f"Coefficient shape (n_classes, n_features): {model.coef_.shape}")
# Each row is that class's decision boundary in feature space — inspect which features
# dominate each class's coefficients to sanity-check the model against domain knowledge
```

### Example: Decision tree as a business rule extractor

```python
from sklearn.tree import DecisionTreeClassifier, export_text

# A shallow tree is sometimes chosen NOT for accuracy, but because it can be handed to
# a business team as literal if/else rules
shallow_tree = DecisionTreeClassifier(max_depth=3, random_state=42)
shallow_tree.fit(X_train, y_train)
print(export_text(shallow_tree, feature_names=[f"feature_{i}" for i in range(X_train.shape[1])]))
```

### Example: Bagging a weak learner from scratch to build intuition

```python
from sklearn.tree import DecisionTreeClassifier
import numpy as np

def manual_bagging_predict(X_train, y_train, X_test, n_estimators=50, max_depth=3):
    n = len(X_train)
    predictions = np.zeros((n_estimators, len(X_test)))
    for i in range(n_estimators):
        bootstrap_idx = np.random.choice(n, size=n, replace=True)  # sample WITH replacement
        tree = DecisionTreeClassifier(max_depth=max_depth, random_state=i)
        tree.fit(X_train[bootstrap_idx], y_train[bootstrap_idx])
        predictions[i] = tree.predict(X_test)
    # Majority vote across all bootstrapped trees — this IS what RandomForestClassifier does internally
    return np.round(predictions.mean(axis=0)).astype(int)

manual_preds = manual_bagging_predict(X_train, y_train, X_test)
print(f"Manual bagging accuracy: {(manual_preds == y_test).mean():.3f}")
```

Building bagging by hand once demystifies `RandomForestClassifier` completely — it's this loop, plus randomized feature subsampling at each split, nothing more exotic.

---

## 11. Quick-Reference Cheat-Table

| If you need... | Reach for | Watch out for |
|---|---|---|
| Explainable coefficients | Logistic/Linear Regression | Must scale features first |
| Human-readable rules | Shallow Decision Tree | Overfits fast if unconstrained |
| Best raw accuracy on tabular data | Gradient Boosting (XGBoost/LightGBM) | Needs tuning; less interpretable |
| Robust default, low tuning effort | Random Forest | Slightly behind GBM ceiling |
| Small/high-dim data, clean margin | SVM (RBF) | O(n²)–O(n³) training cost |
| Instant same-day baseline | Naive Bayes / KNN | Naive Bayes assumes independence |

## 12. FAQ

**Q: Why does my SVM grid search give nonsense results?**
A: You almost certainly forgot to scale features first — `gamma` and `C` are meaningless on unscaled data.

**Q: Random Forest and Gradient Boosting give similar accuracy — which do I ship?**
A: Default to Random Forest unless GBM's edge is meaningful for your use case — it needs less tuning and is more forgiving of default hyperparameters.

**Q: My decision tree gets 100% train accuracy — is that good?**
A: No — that's the signature of an unconstrained tree memorizing training data. Check test accuracy and apply `max_depth`/`ccp_alpha`.

**Q: When is Naive Bayes' independence assumption not just "wrong but works"?**
A: When features are strongly correlated AND that correlation carries the actual signal (e.g., interaction effects) — then Naive Bayes systematically underperforms.

**Q: Is more `n_estimators` always better for Random Forest?**
A: More trees never hurt accuracy (they just average out variance further) but do increase training/inference cost — diminishing returns kick in well before 1000 trees for most tabular problems.
