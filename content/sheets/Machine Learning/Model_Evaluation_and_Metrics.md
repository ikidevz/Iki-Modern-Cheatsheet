# Model Evaluation & Metrics Cheatsheet

## Overview

Picking the wrong metric is one of the most common — and most consequential — mistakes in applied ML. A model can look great on accuracy and be useless in production, or look mediocre on RMSE and be exactly what the business needs. This sheet covers classification metrics, regression metrics, calibration, and how to connect any of it back to a real decision.

---

## 1. Classification Metrics Beyond Accuracy

### Why accuracy misleads

```python
import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix,
    classification_report, precision_recall_curve, roc_curve
)
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.datasets import make_classification

# Simulate a 95:5 imbalanced dataset — e.g. fraud detection
X, y = make_classification(
    n_samples=2000, weights=[0.95, 0.05], n_informative=10, random_state=42
)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, stratify=y, random_state=42)

# A model that always predicts the majority class
lazy_preds = np.zeros_like(y_test)
print(f"'Always predict 0' accuracy: {accuracy_score(y_test, lazy_preds):.3f}")
# This will print something like 0.95 — impressive-looking and completely useless
```

A model that never catches a single fraud case still scores ~95% accuracy on a 95:5 split. Accuracy is only a reasonable primary metric when classes are roughly balanced *and* false positives/negatives have similar costs.

### Precision, Recall, F1, ROC-AUC, PR-AUC

| Metric | Answers | Use when |
|---|---|---|
| Precision | Of predicted positives, how many are correct? | False positives are costly (e.g., flagging a legitimate transaction as fraud) |
| Recall | Of actual positives, how many did we catch? | False negatives are costly (e.g., missing a cancer diagnosis) |
| F1 | Harmonic mean of precision/recall | Need one number balancing both, no strong asymmetry |
| ROC-AUC | Ranking quality across all thresholds | Balanced-ish classes, care about ranking not just a single cutoff |
| PR-AUC | Ranking quality, weighted toward the positive class | **Imbalanced** classes — ROC-AUC can look deceptively good here |

```python
model = LogisticRegression(max_iter=1000, class_weight="balanced")
model.fit(X_train, y_train)
y_pred = model.predict(X_test)
y_proba = model.predict_proba(X_test)[:, 1]

print(f"Precision: {precision_score(y_test, y_pred):.3f}")
print(f"Recall:    {recall_score(y_test, y_pred):.3f}")
print(f"F1:        {f1_score(y_test, y_pred):.3f}")
print(f"ROC-AUC:   {roc_auc_score(y_test, y_proba):.3f}")
print(f"PR-AUC:    {average_precision_score(y_test, y_proba):.3f}")
print()
print(classification_report(y_test, y_pred))
```

**Why PR-AUC matters more under imbalance:** ROC-AUC's false-positive-rate axis is normalized by the (large) number of true negatives, so even a mediocre classifier can post a high ROC-AUC on a 95:5 split. PR-AUC's precision axis is directly sensitive to how many false positives pile up relative to true positives, which is usually what you actually care about.

---

## 2. Confusion Matrices and Cost-Sensitive Thresholds

The default `0.5` probability threshold is arbitrary — it's rarely the threshold that minimizes real-world cost.

```python
cm = confusion_matrix(y_test, y_pred)
print("Confusion Matrix:\n", cm)
tn, fp, fn, tp = cm.ravel()
print(f"TN={tn}, FP={fp}, FN={fn}, TP={tp}")

# Suppose a false negative (missed fraud) costs $500, a false positive (annoyed customer) costs $5
def total_cost(y_true, y_proba, threshold, fn_cost=500, fp_cost=5):
    preds = (y_proba >= threshold).astype(int)
    cm = confusion_matrix(y_true, preds)
    tn, fp, fn, tp = cm.ravel()
    return fn * fn_cost + fp * fp_cost

thresholds = np.linspace(0.05, 0.95, 19)
costs = [total_cost(y_test, y_proba, t) for t in thresholds]
best_threshold = thresholds[int(np.argmin(costs))]
print(f"Cost-minimizing threshold: {best_threshold:.2f} (vs. default 0.5)")
```

This is the difference between "an ML metric" and "a business decision" — the right threshold depends entirely on the relative cost of each error type, which a generic metric like accuracy or F1 can't tell you on its own.

---

## 3. Regression Metrics

| Metric | Formula intuition | Sensitivity to outliers |
|---|---|---|
| MAE | Average absolute error | Robust — treats all errors linearly |
| RMSE | Square root of average squared error | Sensitive — large errors dominate |
| MAPE | Average absolute % error | Undefined/unstable near zero actuals |

```python
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.linear_model import LinearRegression
from sklearn.datasets import make_regression

Xr, yr = make_regression(n_samples=500, n_features=10, noise=20, random_state=42)
Xr_train, Xr_test, yr_train, yr_test = train_test_split(Xr, yr, test_size=0.2, random_state=42)

reg = LinearRegression().fit(Xr_train, yr_train)
preds = reg.predict(Xr_test)

mae = mean_absolute_error(yr_test, preds)
rmse = mean_squared_error(yr_test, preds) ** 0.5
mape = np.mean(np.abs((yr_test - preds) / yr_test)) * 100  # careful near yr_test == 0

print(f"MAE:  {mae:.2f}")
print(f"RMSE: {rmse:.2f}")
print(f"MAPE: {mape:.2f}%")

# Demonstrating outlier sensitivity: inject one huge error
preds_with_outlier = preds.copy()
preds_with_outlier[0] += 1000
print(f"\nWith one outlier prediction:")
print(f"MAE:  {mean_absolute_error(yr_test, preds_with_outlier):.2f}  (barely moves)")
print(f"RMSE: {mean_squared_error(yr_test, preds_with_outlier) ** 0.5:.2f}  (moves a lot)")
```

**Rule of thumb:** use RMSE when large errors are disproportionately bad (e.g., a demand forecast that's off by 1000 units is much worse than 10 forecasts off by 100 each). Use MAE when you want a metric that isn't dominated by a handful of outliers. Avoid MAPE when actuals can be near zero.

---

## 4. Calibration: Is a 70% Confident Prediction Right 70% of the Time?

A model can have great ROC-AUC (good *ranking*) while being badly *calibrated* (its probability outputs don't mean what they say). This matters whenever you use the probability itself — not just the rank — for a decision (e.g., "only act if confidence > 80%").

```python
from sklearn.calibration import calibration_curve, CalibratedClassifierCV
from sklearn.metrics import brier_score_loss

prob_true, prob_pred = calibration_curve(y_test, y_proba, n_bins=10)
print("Predicted prob bins:", prob_pred.round(2))
print("Actual observed freq:", prob_true.round(2))
# A well-calibrated model has prob_true ≈ prob_pred across bins

brier = brier_score_loss(y_test, y_proba)
print(f"Brier score (lower is better, 0 = perfect): {brier:.3f}")

# Fixing poor calibration with Platt scaling or isotonic regression
calibrated_model = CalibratedClassifierCV(
    LogisticRegression(max_iter=1000), method="isotonic", cv=5
)
calibrated_model.fit(X_train, y_train)
calibrated_proba = calibrated_model.predict_proba(X_test)[:, 1]
print(f"Brier score after calibration: {brier_score_loss(y_test, calibrated_proba):.3f}")
```

Tree ensembles (Random Forest, gradient boosting) are notoriously poorly calibrated out of the box — their "probabilities" are really vote proportions, not true probabilities. Calibrate before trusting the raw score for anything cost-sensitive.

---

## 5. Cross-Validated Metrics vs. a Single Split

A single train/test split gives you one noisy point estimate. Cross-validation gives you a distribution — and the spread matters as much as the mean.

```python
from sklearn.model_selection import cross_val_score, StratifiedKFold

cv_scores = cross_val_score(
    LogisticRegression(max_iter=1000, class_weight="balanced"),
    X, y, cv=StratifiedKFold(5, shuffle=True, random_state=42), scoring="roc_auc"
)
print(f"CV ROC-AUC: {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")
# If std is large relative to the mean, a single split's score is not trustworthy on its own
```

---

## 6. Business-Metric Alignment

The final step is translating a model metric into what a stakeholder actually cares about. Some patterns:

- **Fraud detection**: report expected dollars saved at a given threshold, not just recall.
- **Churn model**: report "of customers we'd target with a retention offer, what fraction actually would have churned" (precision at the operational threshold), since offers cost money.
- **Recommendation ranking**: precision@k / NDCG, not accuracy — see the Recommender Systems sheet.
- **Medical screening**: recall (sensitivity) is usually the headline number — missing a case is far worse than a false alarm that triggers a follow-up test.

## Common Pitfalls

- **Reporting accuracy on imbalanced data** without also reporting precision/recall/PR-AUC.
- **Using the default 0.5 threshold** when the costs of false positives and false negatives are asymmetric.
- **Trusting `predict_proba()` from a tree ensemble** without checking calibration first.
- **Reporting a single train/test split's metric** as if it were a stable estimate — always prefer cross-validated mean ± std when the dataset allows it.
- **Optimizing a proxy metric (accuracy, AUC) without checking whether it aligns with the actual business objective.**

---

## 7. End-to-End Worked Example: Choosing a Threshold From a Real Cost Model

This walks the full loop — train, evaluate across metrics, calibrate, and pick an operating threshold based on an explicit business cost model rather than a default.

```python
import numpy as np
import pandas as pd
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    roc_auc_score, average_precision_score, brier_score_loss, confusion_matrix
)

X, y = make_classification(n_samples=5000, weights=[0.92, 0.08], n_informative=12, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, stratify=y, random_state=42)

# 1. Train, then calibrate (GBM probabilities are notoriously poorly calibrated out of the box)
base_model = GradientBoostingClassifier(n_estimators=200, random_state=42)
calibrated = CalibratedClassifierCV(base_model, method="isotonic", cv=5)
calibrated.fit(X_train, y_train)
y_proba = calibrated.predict_proba(X_test)[:, 1]

# 2. Report ranking quality metrics (threshold-independent)
print(f"ROC-AUC: {roc_auc_score(y_test, y_proba):.3f}")
print(f"PR-AUC:  {average_precision_score(y_test, y_proba):.3f}")
print(f"Brier:   {brier_score_loss(y_test, y_proba):.3f}  (lower is better; checks calibration quality)")

# 3. Build an explicit cost model: a missed positive (false negative) costs 20x a false alarm
FN_COST, FP_COST = 200, 10

def expected_cost(y_true, y_proba, threshold):
    preds = (y_proba >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, preds).ravel()
    return fn * FN_COST + fp * FP_COST

thresholds = np.linspace(0.01, 0.5, 50)
costs = [expected_cost(y_test, y_proba, t) for t in thresholds]
best_idx = int(np.argmin(costs))
print(f"\nCost-optimal threshold: {thresholds[best_idx]:.3f} "
      f"(vs. naive default of 0.5, cost={expected_cost(y_test, y_proba, 0.5)})")
print(f"Cost at optimal threshold: {costs[best_idx]}")
```

**The takeaway this exercise is meant to drive home:** the "best" model configuration changes depending on what you optimize for. The same trained, calibrated model can be paired with wildly different operating thresholds depending on the FN_COST/FP_COST ratio — a fraud team and a spam-filter team with the exact same underlying model would rationally choose very different thresholds.

---

## 8. Advanced & Lesser-Known Techniques

- **Matthews Correlation Coefficient (MCC)**: a single balanced metric for binary classification that's more robust than F1 under class imbalance, since it uses all four confusion matrix cells symmetrically. `sklearn.metrics.matthews_corrcoef` — worth reporting alongside F1/PR-AUC when imbalance is severe.
- **Multi-class extensions**: `average="macro"` treats every class equally regardless of frequency (good for catching poor performance on rare classes); `average="weighted"` accounts for class frequency; `average="micro"` aggregates globally across all classes (equivalent to accuracy in the multi-class single-label case). Choosing the wrong average silently hides poor minority-class performance.
- **Bootstrapped confidence intervals for a metric**: rather than reporting a single point estimate, resample the test set with replacement many times and report the metric's distribution — gives a much more honest sense of estimate uncertainty, especially on smaller test sets.

```python
def bootstrap_metric_ci(y_true, y_proba, metric_fn, n_bootstrap=1000, ci=0.95):
    scores = []
    n = len(y_true)
    rng = np.random.RandomState(42)
    for _ in range(n_bootstrap):
        idx = rng.randint(0, n, n)
        scores.append(metric_fn(y_true[idx], y_proba[idx]))
    lower, upper = np.percentile(scores, [(1 - ci) / 2 * 100, (1 + ci) / 2 * 100])
    return np.mean(scores), lower, upper

mean_auc, lower, upper = bootstrap_metric_ci(y_test.values if hasattr(y_test, "values") else y_test, y_proba, roc_auc_score)
print(f"ROC-AUC: {mean_auc:.3f} (95% CI: [{lower:.3f}, {upper:.3f}])")
```

- **Decision curve analysis**: plots "net benefit" across a range of thresholds, explicitly incorporating the relative harm of false positives vs. false negatives — a more clinically/business-grounded alternative to ROC curves, popular in medical decision-making research.

---

## 9. Practice Exercises

1. Take a balanced dataset (50:50) and an imbalanced one (95:5) trained with the same model type. Compute accuracy, F1, ROC-AUC, and PR-AUC on both — identify which metrics stay stable across the imbalance shift and which don't.
2. Deliberately train an uncalibrated model and a calibrated one on the same data. Plot both calibration curves and compute Brier scores — quantify the calibration improvement.
3. Using the cost-model worked example above, sweep the FN_COST:FP_COST ratio from 1:1 to 50:1 and plot how the optimal threshold shifts. At what ratio does the optimal threshold effectively predict "always positive"?
4. Compute macro vs. weighted vs. micro F1 on a synthetic 5-class dataset with one severely underrepresented class, and explain the numeric gap between them.
5. Implement the bootstrap confidence interval function above for PR-AUC instead of ROC-AUC, and compare how much wider the CI is on a small (n=200) vs. large (n=5000) test set.

---

## 10. More Examples

### Example: Confusion matrix heatmap interpretation for multi-class

```python
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay
from sklearn.datasets import load_digits
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

X, y = load_digits(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
model = LogisticRegression(max_iter=2000).fit(X_train, y_train)
cm = confusion_matrix(y_test, model.predict(X_test))

# Reading a multi-class confusion matrix: off-diagonal entries reveal WHICH classes
# get confused with each other, not just the aggregate error rate
for true_class in range(10):
    most_confused_with = [i for i in range(10) if i != true_class and cm[true_class, i] > 1]
    if most_confused_with:
        print(f"Digit {true_class} most often confused with: {most_confused_with}")
```

### Example: Comparing two models with a paired statistical test, not just eyeballing scores

```python
from sklearn.model_selection import cross_val_score
from scipy.stats import wilcoxon
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier

scores_rf = cross_val_score(RandomForestClassifier(random_state=42), X, y, cv=10)
scores_gbm = cross_val_score(GradientBoostingClassifier(random_state=42), X, y, cv=10)

# Wilcoxon signed-rank test: is the DIFFERENCE between paired fold scores significant,
# or could it plausibly be noise? More rigorous than just comparing two mean scores.
stat, p_value = wilcoxon(scores_rf, scores_gbm)
print(f"RF mean: {scores_rf.mean():.3f}, GBM mean: {scores_gbm.mean():.3f}, p-value: {p_value:.4f}")
print("Difference is" + (" " if p_value < 0.05 else " NOT ") + "statistically significant at alpha=0.05")
```

### Example: Multi-label evaluation (an item can belong to several classes at once)

```python
from sklearn.metrics import hamming_loss, jaccard_score
import numpy as np

# Multi-label: each row can have MULTIPLE true labels (e.g., a document tagged with several topics)
y_true_multilabel = np.array([[1, 0, 1], [0, 1, 0], [1, 1, 0]])
y_pred_multilabel = np.array([[1, 0, 0], [0, 1, 1], [1, 1, 0]])

print(f"Hamming loss (fraction of individually wrong labels): {hamming_loss(y_true_multilabel, y_pred_multilabel):.3f}")
print(f"Jaccard score (intersection over union, averaged): {jaccard_score(y_true_multilabel, y_pred_multilabel, average='samples'):.3f}")
# Standard accuracy would harshly count row 2 as entirely wrong despite getting 2/3 labels right —
# these metrics credit PARTIAL correctness, appropriate for the multi-label setting
```

---

## 11. Quick-Reference Cheat-Table

| Situation | Use this metric |
|---|---|
| Balanced classes, general purpose | Accuracy, F1 |
| Imbalanced classes | PR-AUC, F1 (minority class) |
| False positives costly | Precision |
| False negatives costly | Recall |
| Need a threshold-independent ranking metric | ROC-AUC (balanced) / PR-AUC (imbalanced) |
| Trusting predicted probabilities directly | Check calibration (Brier score) first |
| Regression, outliers matter a lot | RMSE |
| Regression, want robustness to outliers | MAE |
| Regression, percentage terms needed | MASE (not MAPE, if values near zero) |

## 12. FAQ

**Q: My model has 99% accuracy — is it good?**
A: Not necessarily — check the class balance first. On a 99:1 split, "always predict majority" also gets 99%.

**Q: ROC-AUC looks great but the model seems useless in practice — why?**
A: Almost certainly severe class imbalance. Switch to PR-AUC, which is far more sensitive to how the minority class is actually handled.

**Q: Should I always use the 0.5 threshold for classification?**
A: No — 0.5 is a default, not a rule. Pick the threshold that minimizes actual business cost given your false-positive/false-negative cost ratio.

**Q: Are Random Forest's `predict_proba()` outputs real probabilities?**
A: Not reliably — tree ensembles are often poorly calibrated. Check with a calibration curve/Brier score, and calibrate with `CalibratedClassifierCV` if needed.

**Q: Why does my cross-validated score fluctuate so much between runs?**
A: Small test folds or genuinely high-variance data — report mean ± std, not a single number, and consider more folds or a larger dataset before trusting the point estimate.
