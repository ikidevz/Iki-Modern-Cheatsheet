# Anomaly Detection & Imbalanced Learning Cheatsheet

## Overview

Rare-event detection (fraud, defects, intrusions) shares a common thread: the interesting class is a tiny minority, standard accuracy is meaningless, and often you don't even have clean labels for what "anomalous" means. This sheet covers unsupervised anomaly detection, resampling strategies for imbalanced classification, and the evaluation and production discipline specific to this problem shape.

```bash
pip install scikit-learn imbalanced-learn --break-system-packages
```

---

## 1. Unsupervised Anomaly Detection

When you don't have (enough) labeled anomalies to train a classifier, unsupervised methods flag points that look structurally different from the bulk of the data.

```python
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.svm import OneClassSVM
from sklearn.datasets import make_blobs

# Normal data clustered together, plus a few scattered outliers
X_normal, _ = make_blobs(n_samples=300, centers=1, cluster_std=1.0, random_state=42)
X_outliers = np.random.uniform(low=-10, high=10, size=(15, 2))
X = np.vstack([X_normal, X_outliers])

# Isolation Forest: anomalies are "easier to isolate" — they require FEWER random splits
# to separate from the rest of the data, because they're sparse in unusual regions of feature space
iso_forest = IsolationForest(contamination=0.05, random_state=42)  # contamination = expected anomaly fraction
predictions = iso_forest.fit_predict(X)  # -1 = anomaly, 1 = normal
print(f"Isolation Forest flagged {np.sum(predictions == -1)} anomalies")

anomaly_scores = iso_forest.score_samples(X)  # lower (more negative) = more anomalous

# One-Class SVM: learns a boundary around the "normal" region, flags anything outside it
ocsvm = OneClassSVM(nu=0.05, kernel="rbf", gamma="scale")  # nu ≈ expected fraction of outliers
ocsvm_predictions = ocsvm.fit_predict(X)
print(f"One-Class SVM flagged {np.sum(ocsvm_predictions == -1)} anomalies")
```

```python
# Autoencoder reconstruction error: train on NORMAL data only, anomalies reconstruct poorly
import torch
import torch.nn as nn

class Autoencoder(nn.Module):
    def __init__(self, input_dim, encoding_dim=8):
        super().__init__()
        self.encoder = nn.Sequential(nn.Linear(input_dim, 16), nn.ReLU(), nn.Linear(16, encoding_dim))
        self.decoder = nn.Sequential(nn.Linear(encoding_dim, 16), nn.ReLU(), nn.Linear(16, input_dim))

    def forward(self, x):
        return self.decoder(self.encoder(x))

model = Autoencoder(input_dim=2)
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
X_normal_tensor = torch.tensor(X_normal, dtype=torch.float32)

# Train ONLY on normal data — the model learns to reconstruct normal patterns well
for epoch in range(100):
    optimizer.zero_grad()
    reconstructed = model(X_normal_tensor)
    loss = nn.functional.mse_loss(reconstructed, X_normal_tensor)
    loss.backward()
    optimizer.step()

# At inference: anomalies (never seen during training) reconstruct poorly -> high error
X_test_tensor = torch.tensor(X, dtype=torch.float32)
with torch.no_grad():
    reconstruction_errors = ((model(X_test_tensor) - X_test_tensor) ** 2).mean(dim=1)
threshold = reconstruction_errors[:len(X_normal)].quantile(0.95)  # threshold from normal data's error distribution
flagged = reconstruction_errors > threshold
print(f"Autoencoder flagged {flagged.sum().item()} anomalies")
```

---

## 2. Resampling Strategies

```python
from imblearn.over_sampling import SMOTE, ADASYN
from imblearn.under_sampling import RandomUnderSampler
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split

X_imb, y_imb = make_classification(n_samples=2000, weights=[0.95, 0.05], random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X_imb, y_imb, stratify=y_imb, random_state=42)

print(f"Original class distribution: {np.bincount(y_train)}")

# SMOTE: generates SYNTHETIC minority examples by interpolating between real minority neighbors
smote = SMOTE(random_state=42)
X_smote, y_smote = smote.fit_resample(X_train, y_train)
print(f"After SMOTE: {np.bincount(y_smote)}")

# ADASYN: like SMOTE, but generates MORE synthetic samples for minority examples that are
# harder to classify (near the decision boundary) — adaptively focuses where it's needed most
adasyn = ADASYN(random_state=42)
X_adasyn, y_adasyn = adasyn.fit_resample(X_train, y_train)

# Random undersampling: simply drops majority-class examples to balance the classes
undersampler = RandomUnderSampler(random_state=42)
X_under, y_under = undersampler.fit_resample(X_train, y_train)
print(f"After undersampling: {np.bincount(y_under)}")

# Class weighting: no resampling at all — just tell the loss function to penalize
# minority-class mistakes more heavily
from sklearn.linear_model import LogisticRegression
weighted_model = LogisticRegression(class_weight="balanced", max_iter=1000)
weighted_model.fit(X_train, y_train)
```

| Method | How | Tradeoff |
|---|---|---|
| SMOTE | Synthetic minority oversampling via interpolation | Can create unrealistic points in sparse regions; doesn't help if minority class is genuinely noisy |
| ADASYN | SMOTE variant, focuses on hard-to-classify minority points | Same risks as SMOTE, slightly more targeted |
| Random undersampling | Drop majority examples | Throws away potentially useful data; risky with already-small datasets |
| Class weighting | Reweight the loss function | No data modification, but doesn't help methods that don't support weights directly |

**Practical default:** try class weighting first — it's the cheapest to apply and doesn't risk generating unrealistic synthetic data or discarding real data. Reach for SMOTE/ADASYN when class weighting alone doesn't move the needle enough, and validate carefully that synthetic points aren't introducing noise into ambiguous regions of feature space.

---

## 3. Why Accuracy Is Meaningless on a 99:1 Split

```python
# A model that always predicts the majority class
always_majority = np.zeros_like(y_test)
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

print(f"'Always majority' accuracy: {accuracy_score(y_test, always_majority):.3f}")  # ~0.95, looks great
print(f"'Always majority' F1 (minority class): {f1_score(y_test, always_majority, pos_label=1):.3f}")  # 0.0 — useless
```

**What to report instead:** precision, recall, F1, and especially PR-AUC for the minority class specifically — see the Model Evaluation & Metrics sheet for the full reasoning behind why PR-AUC (not ROC-AUC) is the more honest metric under severe imbalance.

---

## 4. Threshold Selection Without a Labeled Validation Set

For unsupervised anomaly detection, there's often no ground truth to tune a threshold against. Practical fallbacks:

```python
# Statistical threshold: flag points beyond N standard deviations from the mean anomaly score
scores = iso_forest.score_samples(X)
threshold_statistical = scores.mean() - 3 * scores.std()

# Percentile threshold: flag the top X% most anomalous points, based on domain knowledge
# of roughly how prevalent anomalies are expected to be
threshold_percentile = np.percentile(scores, 5)  # flag the bottom 5% of scores as anomalous

# Business-driven threshold: pick the threshold based on operational capacity —
# e.g., "our fraud review team can investigate 200 cases/day" directly bounds how
# aggressive the threshold can be, independent of any statistical criterion
```

---

## 5. Time-Aware Anomaly Detection

A static threshold breaks down when the "normal" pattern itself changes over time (daily/weekly seasonality, trends) — a value that's anomalous at 3am might be completely normal at 3pm.

```python
def seasonal_baseline_anomaly(values, timestamps, hour_of_day, window=7):
    """Compare each value against the historical distribution for the SAME hour of day, not a global average."""
    import pandas as pd
    df = pd.DataFrame({"value": values, "hour": hour_of_day})
    hourly_stats = df.groupby("hour")["value"].agg(["mean", "std"])
    df = df.join(hourly_stats, on="hour")
    df["z_score"] = (df["value"] - df["mean"]) / df["std"]
    return df["z_score"].abs() > 3  # flag values far from the hour-specific expected range

# Without this seasonality awareness, a static global threshold will systematically
# flag every overnight low-traffic period as "anomalous" even though it's perfectly normal
```

See the Time Series Analysis & Forecasting sheet for a deeper treatment of seasonality and decomposition.

---

## 6. Production Concerns: Alert Fatigue and Precision/Recall Tuning

```python
def cost_aware_threshold_selection(y_true, scores, investigation_capacity_per_day, avg_daily_volume):
    """Pick the threshold that flags exactly as many cases as the operational team can actually review."""
    flag_rate = investigation_capacity_per_day / avg_daily_volume
    threshold = np.percentile(scores, 100 * (1 - flag_rate))
    return threshold
```

**Alert fatigue is a real, measurable cost**: a model tuned purely to maximize recall (catch every possible case) at the expense of precision will flood an on-call or review team with false positives — and teams predictably start ignoring or rubber-stamping alerts once volume exceeds what they can meaningfully review, which defeats the model's entire purpose. Tuning the precision/recall tradeoff to match actual operational review capacity is not a compromise on model quality — it's the metric that actually determines whether the system gets used correctly in practice.

## Common Pitfalls

- **Reporting accuracy on a severely imbalanced dataset** without minority-class-specific metrics.
- **Applying SMOTE before splitting into train/test** — this leaks synthetic points derived from test-set neighbors into training, inflating reported performance. Always resample only the training fold.
- **Using a static anomaly threshold on seasonal data** — leads to systematic false positives during predictable low/high periods.
- **Optimizing purely for recall in a production alerting system** — ignores the real, measurable cost of alert fatigue and reduced trust in the system.
- **Assuming unsupervised anomaly scores are calibrated probabilities** — they're relative rankings, not well-calibrated likelihoods; treat the threshold as a tunable operational knob, not a fixed statistical cutoff.

---

## 7. End-to-End Worked Example: Fraud Detection From Raw Data to Cost-Aware Threshold

```python
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from imblearn.over_sampling import SMOTE
from sklearn.metrics import precision_recall_curve, average_precision_score, confusion_matrix

np.random.seed(42)
n = 10000
df = pd.DataFrame({
    "transaction_amount": np.random.exponential(80, n),
    "hour_of_day": np.random.randint(0, 24, n),
    "merchant_risk_score": np.random.beta(2, 8, n),
    "customer_tenure_days": np.random.exponential(400, n),
})
# Fraud is rare and driven by a combination of factors, with noise
fraud_logit = (
    3 * df.merchant_risk_score + 0.01 * df.transaction_amount
    - 0.001 * df.customer_tenure_days + np.random.normal(0, 1, n) - 6
)
df["is_fraud"] = (1 / (1 + np.exp(-fraud_logit)) > np.random.random(n)).astype(int)
print(f"Fraud rate: {df.is_fraud.mean():.3%}")

X, y = df.drop(columns="is_fraud"), df["is_fraud"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, stratify=y, random_state=42)

# Approach A: class weighting only
model_weighted = RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=42)
model_weighted.fit(X_train, y_train)

# Approach B: SMOTE on TRAINING data only (never on test data — see the leakage pitfall in this sheet)
smote = SMOTE(random_state=42)
X_train_smote, y_train_smote = smote.fit_resample(X_train, y_train)
model_smote = RandomForestClassifier(n_estimators=300, random_state=42)
model_smote.fit(X_train_smote, y_train_smote)

for name, model in [("Class-weighted", model_weighted), ("SMOTE", model_smote)]:
    proba = model.predict_proba(X_test)[:, 1]
    print(f"{name} — PR-AUC: {average_precision_score(y_test, proba):.4f}")

# Pick an operating threshold based on review team capacity, not a default 0.5
proba_best = model_weighted.predict_proba(X_test)[:, 1]
review_capacity_fraction = 0.02  # team can review roughly the top 2% highest-risk transactions
threshold = np.percentile(proba_best, 100 * (1 - review_capacity_fraction))

flagged = (proba_best >= threshold).astype(int)
tn, fp, fn, tp = confusion_matrix(y_test, flagged).ravel()
print(f"\nAt operational threshold {threshold:.3f}:")
print(f"  Flagged {flagged.sum()} transactions ({flagged.mean():.1%} of test set)")
print(f"  Caught {tp} of {tp + fn} actual fraud cases (recall = {tp / (tp + fn):.2%})")
print(f"  Precision among flagged = {tp / (tp + fp):.2%}")
```

This mirrors the actual decision-making flow in a production fraud team: compare modeling approaches on PR-AUC (not accuracy), then translate the winning model's scores into an operational threshold set by review *capacity* rather than an arbitrary statistical cutoff — directly applying the alert-fatigue discussion from section 6 of the base sheet.

---

## 8. Advanced & Lesser-Known Techniques

- **Ensemble of anomaly detectors**: combine Isolation Forest, One-Class SVM, and autoencoder reconstruction error into a single anomaly score (e.g., by rank-averaging each method's output) — different methods catch different kinds of anomalies, and an ensemble is often more robust than any single method alone.
- **Local Outlier Factor (LOF)**: unlike Isolation Forest (which looks at global structure), LOF compares a point's local density to its neighbors' local density — better suited for datasets with anomalies in varying-density regions, where a single global threshold from Isolation Forest might miss anomalies embedded in a dense cluster.
- **Focal loss** for imbalanced classification with neural networks: down-weights the loss contribution from easy, well-classified examples (which are usually majority-class) and focuses gradient updates on hard, often minority-class examples — an alternative to class weighting or resampling, popular in imbalanced object detection tasks.
- **Cost-sensitive learning at the algorithm level**: rather than resampling data or reweighting post-hoc, some algorithms (certain SVM formulations, cost-sensitive decision trees) can directly incorporate an asymmetric misclassification cost matrix into their optimization objective.

---

## 9. Practice Exercises

1. Compare Isolation Forest, One-Class SVM, and the autoencoder approach from this sheet on the SAME synthetic dataset with a known ground-truth anomaly label (used only for evaluation, not training) — compute each method's precision/recall against that ground truth.
2. Implement Local Outlier Factor (`sklearn.neighbors.LocalOutlierFactor`) on a dataset with two clusters of very different densities, each containing a few anomalies, and compare its detections against Isolation Forest's.
3. Re-run the fraud worked example with `review_capacity_fraction` set to 0.5%, 2%, and 10% — plot how precision and recall trade off as capacity changes.
4. Implement focal loss for a simple neural network binary classifier and compare its performance against class-weighted cross-entropy on a severely imbalanced synthetic dataset (99:1).
5. Simulate concept drift by shifting the fraud-generating logistic function's coefficients partway through a "time-ordered" version of the dataset, and demonstrate how a static-threshold monitoring approach fails to catch the resulting change in false-negative rate without an explicit drift check (connecting to the MLOps sheet's drift monitoring).

---

## 10. More Examples

### Example: Multivariate anomaly detection with Mahalanobis distance

```python
import numpy as np

def mahalanobis_anomaly_score(X, reference_mean, reference_cov_inv):
    """Unlike a simple z-score per feature, Mahalanobis distance accounts for
    CORRELATIONS between features — a point can be anomalous in combination even if
    each individual feature value looks normal on its own."""
    diff = X - reference_mean
    return np.sqrt(np.einsum('ij,jk,ik->i', diff, reference_cov_inv, diff))

normal_data = np.random.multivariate_normal([0, 0], [[1, 0.8], [0.8, 1]], 500)
reference_mean = normal_data.mean(axis=0)
reference_cov_inv = np.linalg.inv(np.cov(normal_data.T))

test_points = np.array([[0, 0], [2, 2], [2, -2]])  # last point breaks the normal correlation structure
scores = mahalanobis_anomaly_score(test_points, reference_mean, reference_cov_inv)
print(f"Mahalanobis scores: {scores.round(2)}")  # the correlation-breaking point scores highest despite modest individual values
```

### Example: Combining SMOTE with Tomek links for cleaner oversampling

```python
from imblearn.combine import SMOTETomek
from sklearn.datasets import make_classification

X, y = make_classification(n_samples=1000, weights=[0.9, 0.1], random_state=42)

# SMOTE alone can generate synthetic points that land too close to the OTHER class's boundary —
# combining with Tomek link removal cleans up these ambiguous/overlapping points afterward
smote_tomek = SMOTETomek(random_state=42)
X_resampled, y_resampled = smote_tomek.fit_resample(X, y)
print(f"Before: {np.bincount(y)}, After SMOTETomek: {np.bincount(y_resampled)}")
```

### Example: Setting a dynamic threshold that adapts to recent volume

```python
import numpy as np

def adaptive_threshold(recent_scores, window=100, percentile=99):
    """Recomputes the anomaly threshold from a ROLLING window of recent scores,
    rather than a fixed value — adapts automatically as normal behavior gradually shifts."""
    if len(recent_scores) < window:
        return np.percentile(recent_scores, percentile)
    return np.percentile(recent_scores[-window:], percentile)

score_stream = np.concatenate([np.random.normal(0, 1, 200), np.random.normal(2, 1, 200)])  # a genuine level shift
thresholds_over_time = [adaptive_threshold(score_stream[:i+1]) for i in range(50, 400, 50)]
print(f"Threshold adapts over time: {[round(t, 2) for t in thresholds_over_time]}")
```

---

## 11. Quick-Reference Cheat-Table

| Situation | Approach |
|---|---|
| No labeled anomalies at all | Isolation Forest / One-Class SVM / autoencoder |
| Some labels, severe imbalance | Class weighting first, then SMOTE if needed |
| Correlated features matter | Mahalanobis distance over per-feature z-scores |
| Seasonal/time-varying "normal" | Time-aware baseline, not a static threshold |
| No labeled validation set for threshold | Percentile or business-capacity-driven threshold |
| High-volume alerting system | Tune threshold to review team capacity, not max recall |

## 12. FAQ

**Q: Should I always apply SMOTE for imbalanced data?**
A: Try class weighting first — it's cheaper and doesn't risk generating unrealistic synthetic points. Reach for SMOTE only if weighting alone isn't enough.

**Q: My anomaly detector flags too many false positives — what now?**
A: Tune the threshold to match your review team's actual capacity, not to maximize recall — unmanaged alert volume causes alert fatigue and reduces trust in the system.

**Q: Isolation Forest or autoencoder — which should I use?**
A: Isolation Forest as a fast, simple default. Autoencoders when the anomaly signal is complex/high-dimensional and worth the extra training investment.

**Q: Can I apply SMOTE before splitting into train/test?**
A: No — this leaks synthetic points derived from test-neighbors into training. Always resample training data only, after splitting.

**Q: Why is accuracy such a bad metric here?**
A: On severe imbalance, a trivial "always predict majority" model scores deceptively high accuracy while catching zero actual anomalies. Use precision/recall/PR-AUC instead.
