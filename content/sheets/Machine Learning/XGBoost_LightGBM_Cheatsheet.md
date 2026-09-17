# XGBoost / LightGBM Cheatsheet

## Overview

Gradient boosting on trees is the single most-used approach for tabular ML in industry — it consistently outperforms deep learning on structured/tabular data with far less tuning effort. This sheet covers the hyperparameters that actually move the needle, handling categorical features, imbalanced data, and reading feature importance correctly.

```bash
pip install xgboost lightgbm shap --break-system-packages
```

---

## 1. Key Hyperparameters

These five control almost all of the bias/variance tradeoff in gradient boosting:

| Hyperparameter | What it controls | Typical range |
|---|---|---|
| `learning_rate` (`eta`) | Step size — smaller = more robust but needs more trees | 0.01 – 0.3 |
| `max_depth` | Tree complexity — deeper = more interactions captured, more overfitting risk | 3 – 10 |
| `n_estimators` | Number of boosting rounds | 100 – 5000 (paired with early stopping) |
| `subsample` | Row sampling per tree — < 1.0 adds randomness, reduces overfitting | 0.6 – 1.0 |
| `colsample_bytree` | Column sampling per tree | 0.6 – 1.0 |
| Regularization (`reg_alpha`/`reg_lambda` for L1/L2, `min_child_weight`) | Penalizes complex trees directly | Problem-dependent |

**Rule of thumb:** lower `learning_rate` and raise `n_estimators` together (with early stopping) — this combination almost always beats a high learning rate with few trees, at the cost of training time.

```python
import xgboost as xgb
import lightgbm as lgb
import numpy as np
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

X, y = make_classification(n_samples=5000, n_features=30, n_informative=15, weights=[0.85, 0.15], random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
X_train, X_val, y_train, y_val = train_test_split(X_train, y_train, test_size=0.2, stratify=y_train, random_state=42)

xgb_model = xgb.XGBClassifier(
    n_estimators=2000,
    learning_rate=0.03,
    max_depth=5,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_lambda=1.0,
    eval_metric="auc",
    early_stopping_rounds=50,
    random_state=42,
)
xgb_model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
print(f"XGBoost best iteration: {xgb_model.best_iteration}")
print(f"XGBoost test AUC: {roc_auc_score(y_test, xgb_model.predict_proba(X_test)[:, 1]):.4f}")
```

---

## 2. Early Stopping and Validation Sets

Never pick `n_estimators` by hand — set it high and let early stopping find the point where validation performance stops improving.

```python
lgb_model = lgb.LGBMClassifier(
    n_estimators=2000,
    learning_rate=0.03,
    max_depth=5,
    num_leaves=31,          # LightGBM's primary complexity knob — grows leaf-wise, not depth-wise
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
)
lgb_model.fit(
    X_train, y_train,
    eval_set=[(X_val, y_val)],
    eval_metric="auc",
    callbacks=[lgb.early_stopping(stopping_rounds=50, verbose=False)],
)
print(f"LightGBM best iteration: {lgb_model.best_iteration_}")
print(f"LightGBM test AUC: {roc_auc_score(y_test, lgb_model.predict_proba(X_test)[:, 1]):.4f}")
```

**Key difference in tree growth:** XGBoost grows level-wise (depth-first, balanced) by default; LightGBM grows leaf-wise (always splits the leaf with the highest loss reduction), which is faster and often more accurate but more prone to overfitting on small datasets — control it with `num_leaves` and `min_child_samples`.

---

## 3. Handling Categorical Features

| Library | Native categorical support |
|---|---|
| LightGBM | Yes — pass a `category` dtype column or list column names via `categorical_feature` |
| XGBoost | Yes since v1.5+ with `enable_categorical=True` and pandas `category` dtype, but one-hot/target encoding is still common in practice |
| CatBoost | Best-in-class native handling (ordered target statistics) — worth reaching for when categoricals dominate |

```python
import pandas as pd

df = pd.DataFrame({
    "amount": np.random.exponential(100, 1000),
    "merchant_category": pd.Categorical(np.random.choice(["grocery", "electronics", "travel", "dining"], 1000)),
    "is_fraud": np.random.binomial(1, 0.1, 1000),
})

# LightGBM: just tell it which columns are categorical
lgb_native = lgb.LGBMClassifier(n_estimators=200, random_state=42)
lgb_native.fit(
    df[["amount", "merchant_category"]], df["is_fraud"],
    categorical_feature=["merchant_category"],
)

# XGBoost: enable_categorical + category dtype
xgb_native = xgb.XGBClassifier(n_estimators=200, enable_categorical=True, tree_method="hist", random_state=42)
xgb_native.fit(df[["amount", "merchant_category"]], df["is_fraud"])
```

Native handling avoids the dimensionality explosion of one-hot encoding high-cardinality categoricals and generally captures categorical splits (e.g., "grocery or dining vs. everything else") that one-hot + a tree can't express in a single split.

---

## 4. Imbalanced Classification

```python
# Method 1: scale_pos_weight — upweights the minority class in the loss function
neg, pos = np.bincount(y_train)
scale_pos_weight = neg / pos
print(f"scale_pos_weight = {scale_pos_weight:.2f}")

xgb_weighted = xgb.XGBClassifier(
    n_estimators=500, learning_rate=0.05, max_depth=5,
    scale_pos_weight=scale_pos_weight, eval_metric="aucpr", random_state=42,
)
xgb_weighted.fit(X_train, y_train)

# Method 2: LightGBM's built-in class_weight
lgb_weighted = lgb.LGBMClassifier(n_estimators=500, class_weight="balanced", random_state=42)
lgb_weighted.fit(X_train, y_train)

print(f"Weighted XGBoost PR-AUC: {roc_auc_score(y_test, xgb_weighted.predict_proba(X_test)[:, 1]):.4f}")
```

For severe imbalance, also evaluate with PR-AUC (see the Model Evaluation sheet) rather than ROC-AUC or accuracy — `scale_pos_weight` shifts *where* the loss focuses, but the right evaluation metric determines whether that shift is actually helping.

---

## 5. Feature Importance: Gain vs. Split Count vs. SHAP

| Method | What it measures | Weakness |
|---|---|---|
| `weight` / split count | How many times a feature is used to split | Biased toward high-cardinality features that get split on often but each split barely helps |
| `gain` | Average loss reduction from splits using this feature | Better than split count, but still doesn't show *direction* or per-prediction effect |
| SHAP values | Per-prediction, additive contribution of each feature | Most reliable and interpretable — see the Model Interpretability sheet |

```python
import shap

# Built-in importance (gain-based)
importance_df = pd.DataFrame({
    "feature": [f"f{i}" for i in range(X_train.shape[1])],
    "gain": xgb_model.feature_importances_,
}).sort_values("gain", ascending=False)
print(importance_df.head())

# SHAP for a more trustworthy, per-prediction view
explainer = shap.TreeExplainer(xgb_model)
shap_values = explainer.shap_values(X_test[:100])
mean_abs_shap = np.abs(shap_values).mean(axis=0)
top_shap = pd.DataFrame({"feature": importance_df["feature"], "mean_abs_shap": mean_abs_shap}) \
    .sort_values("mean_abs_shap", ascending=False)
print(top_shap.head())
```

---

## 6. XGBoost vs. LightGBM vs. CatBoost

| | XGBoost | LightGBM | CatBoost |
|---|---|---|---|
| Tree growth | Level-wise (default) | Leaf-wise | Symmetric/oblivious trees |
| Speed on large data | Good | Fastest, especially wide data | Slower to train, fast to predict |
| Categorical handling | Manual/basic native support | Good native support | Best-in-class native support |
| Overfitting on small data | Moderate risk | Higher risk (leaf-wise growth) | Lower risk (ordered boosting reduces target leakage) |
| Defaults | Need more tuning | Need more tuning | Strong out-of-the-box defaults |
| Ecosystem/maturity | Most widely used, most Stack Overflow answers | Very fast, popular in competitions | Best when categoricals dominate the dataset |

**Practical default:** start with LightGBM for speed during experimentation, switch to XGBoost if you need its more mature deployment tooling, or reach for CatBoost when your dataset is categorical-heavy and you want strong defaults with less tuning.

## Common Pitfalls

- **Setting `n_estimators` by hand instead of using early stopping** — you'll either underfit (too few trees) or overfit and waste compute (too many).
- **Ignoring `num_leaves` in LightGBM** — leaf-wise growth can overfit fast on small datasets if `num_leaves` is left high relative to `max_depth`.
- **One-hot encoding high-cardinality categoricals** instead of using native categorical support — this both explodes dimensionality and produces worse splits.
- **Using accuracy instead of PR-AUC/F1** to tune `scale_pos_weight` on imbalanced data — you can "fix" accuracy while making the model useless for the minority class.
- **Reading `gain`-based importance as causal** — it reflects how useful a feature was for reducing loss in this specific tree structure, not a causal effect on the outcome.

---

## 7. End-to-End Worked Example: Full Tuning Workflow With Early Stopping and SHAP

```python
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, average_precision_score
import optuna

X, y = make_classification(n_samples=8000, n_features=30, n_informative=15, weights=[0.88, 0.12], random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
X_train, X_val, y_train, y_val = train_test_split(X_train, y_train, test_size=0.2, stratify=y_train, random_state=42)

neg, pos = np.bincount(y_train)

def objective(trial):
    params = {
        "max_depth": trial.suggest_int("max_depth", 3, 9),
        "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
        "subsample": trial.suggest_float("subsample", 0.6, 1.0),
        "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
        "reg_lambda": trial.suggest_float("reg_lambda", 0.1, 10.0, log=True),
        "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
        "scale_pos_weight": neg / pos,
        "eval_metric": "aucpr",  # optimize for PR-AUC directly, given the class imbalance
    }
    model = xgb.XGBClassifier(n_estimators=1000, early_stopping_rounds=30, random_state=42, **params)
    model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    preds = model.predict_proba(X_test)[:, 1]
    return average_precision_score(y_test, preds)

optuna.logging.set_verbosity(optuna.logging.WARNING)
study = optuna.create_study(direction="maximize")
study.optimize(objective, n_trials=25)

print("Best params:", study.best_params)
print(f"Best PR-AUC: {study.best_value:.4f}")

# Train the final model with the best params found
final_params = {**study.best_params, "scale_pos_weight": neg / pos, "eval_metric": "aucpr"}
final_model = xgb.XGBClassifier(n_estimators=1000, early_stopping_rounds=30, random_state=42, **final_params)
final_model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)

print(f"Final test ROC-AUC: {roc_auc_score(y_test, final_model.predict_proba(X_test)[:, 1]):.4f}")
print(f"Final test PR-AUC:  {average_precision_score(y_test, final_model.predict_proba(X_test)[:, 1]):.4f}")

import shap
explainer = shap.TreeExplainer(final_model)
shap_values = explainer.shap_values(X_test[:200])
top_features = np.argsort(-np.abs(shap_values).mean(axis=0))[:5]
print("Top 5 features by mean |SHAP|:", top_features)
```

This mirrors a realistic workflow: optimize directly for the metric that matters (PR-AUC under imbalance, not accuracy), let early stopping pick `n_estimators` automatically inside each trial, and finish with SHAP to sanity-check the winning model isn't leaning on something suspicious (a leaked ID column, a proxy variable) before shipping it.

---

## 8. Advanced & Lesser-Known Techniques

- **Monotonic constraints**: `monotone_constraints=(1, 0, -1, ...)` (XGBoost) or `monotone_constraints=[1, 0, -1, ...]` (LightGBM) force specific features to have a strictly non-decreasing (1), unconstrained (0), or non-increasing (-1) relationship with the prediction — critical in regulated domains (credit, insurance) where a model exhibiting a counter-intuitive relationship (e.g., "higher income lowers approval odds" due to noise) is a compliance risk even if it slightly improves offline accuracy.
- **`interaction_constraints`** (XGBoost): restricts which features are allowed to interact within a single tree — useful for enforcing domain knowledge (e.g., "geographic features should never interact with financial features") or improving interpretability.
- **DART booster** (`booster="dart"`): applies dropout to trees during boosting, randomly muting a subset of previously-built trees at each new iteration — can reduce overfitting further than standard shrinkage alone, at the cost of slower training and slightly trickier tuning.
- **GPU-accelerated training**: both libraries support `tree_method="gpu_hist"` (XGBoost) or `device="gpu"` (LightGBM) for substantial speedups on large datasets — often the single highest-leverage change for iterating faster during heavy hyperparameter search.
- **Multi-output / multi-class specifics**: for multi-class problems, LightGBM's `num_class` parameter and XGBoost's `multi:softprob` objective handle this natively, but feature importance and SHAP interpretation become per-class — always check whether a "globally important" feature is actually only driving one specific class's predictions.

---

## 9. Practice Exercises

1. Train the same dataset with `tree_method="hist"` on CPU vs. `gpu_hist` (if a GPU is available) and benchmark the wall-clock time difference across 500 boosting rounds.
2. Apply a monotonic constraint to a feature you know should have a directional relationship with the target, retrain, and compare the resulting PDP/partial dependence shape against the unconstrained model's.
3. Compare `booster="gbtree"` vs. `booster="dart"` on a dataset prone to overfitting (small n, many features) — measure the train/test gap for each.
4. Reproduce the imbalanced-classification worked example above, but swap `scale_pos_weight` for SMOTE oversampling (from the Anomaly Detection sheet) and compare final PR-AUC — which approach wins on this specific dataset, and why might that not generalize to other datasets?
5. Using the same trained model, compare built-in `gain` importance, permutation importance (from the Model Interpretability sheet), and mean |SHAP value| — rank the top 5 features under each method and note where they disagree.

---

## 10. More Examples

### Example: Multi-class XGBoost with per-class evaluation

```python
import xgboost as xgb
from sklearn.datasets import load_wine
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

X, y = load_wine(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

multi_model = xgb.XGBClassifier(
    objective="multi:softprob", num_class=3, n_estimators=200, max_depth=4, random_state=42
)
multi_model.fit(X_train, y_train)
print(classification_report(y_test, multi_model.predict(X_test)))
```

### Example: Regression with XGBoost and prediction intervals via quantile objectives

```python
import xgboost as xgb
from sklearn.datasets import make_regression
from sklearn.model_selection import train_test_split

X, y = make_regression(n_samples=2000, n_features=15, noise=25, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train THREE models targeting different quantiles to build a prediction interval, not just a point estimate
models = {}
for alpha in [0.1, 0.5, 0.9]:
    models[alpha] = xgb.XGBRegressor(
        objective="reg:quantileerror", quantile_alpha=alpha, n_estimators=200, max_depth=4, random_state=42
    )
    models[alpha].fit(X_train, y_train)

lower = models[0.1].predict(X_test[:5])
median = models[0.5].predict(X_test[:5])
upper = models[0.9].predict(X_test[:5])
for i in range(5):
    print(f"Prediction {i}: [{lower[i]:.1f}, {median[i]:.1f}, {upper[i]:.1f}] (10th/50th/90th percentile)")
```

### Example: LightGBM with native missing-value handling

```python
import lightgbm as lgb
import numpy as np
import pandas as pd

# LightGBM (and XGBoost) natively learn the OPTIMAL direction to send missing values
# at each split — no imputation needed, unlike models like SVM or logistic regression
df = pd.DataFrame({
    "feature_a": [1.0, 2.0, np.nan, 4.0, 5.0, np.nan, 7.0],
    "feature_b": [10, 20, 30, np.nan, 50, 60, 70],
    "target": [0, 0, 1, 1, 0, 1, 1],
})
model = lgb.LGBMClassifier(n_estimators=50, random_state=42)
model.fit(df[["feature_a", "feature_b"]], df["target"])  # NaNs passed through directly, no imputer needed
print("Trained successfully with raw NaN values — no SimpleImputer required for tree-based models.")
```

---

## 11. Quick-Reference Cheat-Table

| Goal | Setting |
|---|---|
| Prevent overfitting | Lower `learning_rate`, raise `n_estimators`, use early stopping |
| Speed up training | Higher `learning_rate`, `tree_method="hist"` or `gpu_hist` |
| Handle imbalanced classes | `scale_pos_weight` (XGBoost) or `class_weight="balanced"` (LightGBM) |
| Handle categoricals natively | LightGBM `categorical_feature`, XGBoost `enable_categorical=True` |
| Trustworthy feature importance | SHAP > permutation importance > built-in gain |
| Fast experimentation | LightGBM (generally faster) |
| Best categorical handling | CatBoost |

## 12. FAQ

**Q: Should I manually pick `n_estimators`?**
A: No — set it high (e.g., 1000+) and let early stopping find the right value automatically per training run.

**Q: My validation AUC is great but test AUC is much worse — why?**
A: Check for leakage into the validation set (e.g., hyperparameter tuning on the same split repeatedly) or a genuine train/test distribution shift.

**Q: LightGBM overfits more than XGBoost on my small dataset — why?**
A: LightGBM's leaf-wise tree growth is more aggressive than XGBoost's level-wise default. Lower `num_leaves` and raise `min_child_samples` to compensate.

**Q: Is `gain`-based feature importance good enough for a stakeholder report?**
A: It's a reasonable starting point but is biased toward high-cardinality features — cross-check with SHAP before presenting it as authoritative.

**Q: XGBoost or LightGBM — which should I default to?**
A: LightGBM for faster iteration during experimentation; XGBoost if your deployment tooling/ecosystem is already built around it. Both reach similar accuracy with comparable tuning effort.
