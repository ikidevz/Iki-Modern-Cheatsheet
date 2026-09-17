# MLOps Cheatsheet

## Overview

A model that works in a notebook is not a model in production. This sheet covers the operational discipline that keeps a model reliable after it ships: versioning, deployment patterns, monitoring for drift, retraining pipelines, and governance.

```bash
pip install mlflow wandb evidently --break-system-packages
```

---

## 1. Model Versioning and Experiment Tracking

```python
import mlflow

mlflow.set_experiment("fraud_detection_v2")

with mlflow.start_run(run_name="xgboost_baseline"):
    params = {"max_depth": 5, "learning_rate": 0.03, "n_estimators": 500}
    mlflow.log_params(params)

    # ... train your model ...
    # model.fit(X_train, y_train)

    mlflow.log_metric("val_auc", 0.912)
    mlflow.log_metric("val_pr_auc", 0.734)

    # Log the model artifact itself, versioned alongside its metrics and params
    # mlflow.xgboost.log_model(model, "model", registered_model_name="fraud_detector")

# Querying past runs to compare experiments
runs = mlflow.search_runs(experiment_names=["fraud_detection_v2"], order_by=["metrics.val_auc DESC"])
print(runs[["run_id", "params.max_depth", "metrics.val_auc"]].head())
```

**Why this matters beyond "nice to have":** six months from now, when a stakeholder asks "why did we choose this model over the one from last quarter," or when you need to reproduce a specific model version for a compliance audit, an untracked notebook history is not an answer. MLflow/W&B make every run's parameters, metrics, code version, and data version reconstructible.

---

## 2. Deployment Patterns

```python
# Batch scoring: run predictions on a schedule, write results to a table/warehouse
def batch_scoring_job(model, data_source, output_table):
    df = data_source.read()
    df["prediction"] = model.predict(df[feature_columns])
    output_table.write(df)
# Good for: recommendations refreshed nightly, risk scores computed daily — no real-time need

# Real-time API: score on-demand, low-latency response required
from fastapi import FastAPI
import numpy as np

app = FastAPI()

@app.post("/predict")
def predict(features: dict):
    X = np.array([[features[col] for col in feature_columns]])
    prediction = model.predict_proba(X)[0, 1]
    return {"fraud_probability": float(prediction)}
# Good for: fraud checks at checkout, live personalization — needs to respond within a user-facing request

# Shadow deployment: run the NEW model alongside the current production model,
# log both predictions, but only serve the OLD model's result to users
def shadow_deployment_predict(current_model, shadow_model, X):
    production_prediction = current_model.predict(X)
    shadow_prediction = shadow_model.predict(X)  # computed but never shown to users
    log_comparison(production_prediction, shadow_prediction)  # compare offline before promoting
    return production_prediction
```

**Why shadow deployment matters:** it lets you validate a new model's real-world behavior on live traffic — including edge cases and data drift a static test set won't reveal — without any risk of it actually affecting users, before deciding whether to promote it.

---

## 3. Feature Stores and Training/Serving Skew

See the dedicated Feature Stores & ML Data Pipelines sheet for the full treatment — briefly: a feature store ensures the exact same feature computation logic runs at training time (batch, over historical data) and serving time (real-time, over live data), preventing the common and hard-to-debug failure mode where a feature is computed slightly differently in each path.

---

## 4. Monitoring: Drift and Performance Decay

```python
from scipy.stats import ks_2samp
import numpy as np

def detect_feature_drift(reference_data, current_data, feature_name, threshold=0.05):
    """Kolmogorov-Smirnov test: are the reference (training) and current (production) distributions
    for this feature statistically distinguishable?"""
    statistic, p_value = ks_2samp(reference_data[feature_name], current_data[feature_name])
    drifted = p_value < threshold
    return drifted, p_value

reference = np.random.normal(50, 10, 1000)   # feature distribution AT TRAINING TIME
current = np.random.normal(58, 12, 1000)     # feature distribution IN PRODUCTION, several months later

drifted, p_value = detect_feature_drift(
    pd.DataFrame({"f": reference}), pd.DataFrame({"f": current}), "f"
)
print(f"Drift detected: {drifted} (p={p_value:.4f})")
```

| Type | What it measures | Detection approach |
|---|---|---|
| Data drift | Input feature distributions shift over time | KS test, population stability index (PSI), monitoring summary statistics |
| Concept drift | The relationship between features and target changes | Requires labels — track live performance metrics over time, not just feature stats |
| Performance decay | Actual model accuracy/AUC degrading | Direct metric tracking once ground-truth labels become available (may lag predictions by days/weeks) |

```python
# A simple performance-decay monitor
def monitor_performance_over_time(predictions_log, labels_log, window_days=7):
    import pandas as pd
    merged = pd.merge(predictions_log, labels_log, on="request_id")
    merged["date"] = pd.to_datetime(merged["timestamp"]).dt.date
    daily_auc = merged.groupby("date").apply(
        lambda g: roc_auc_score(g["actual_label"], g["predicted_score"]) if g["actual_label"].nunique() > 1 else np.nan
    )
    return daily_auc

# Alert if the rolling metric drops meaningfully below the validated baseline from training
```

**Data drift vs. concept drift, and why the distinction matters operationally:** data drift can often be detected immediately (you have the features in real time), while concept drift usually requires waiting for ground-truth labels to arrive — which can lag by days or weeks (e.g., "did this transaction turn out to be fraud" is only confirmed after a chargeback investigation). A monitoring system needs both a fast, label-free data drift check AND a slower, label-dependent performance check.

---

## 5. Retraining Triggers and Champion/Challenger

```python
def should_trigger_retraining(current_performance, baseline_performance, drift_detected, threshold=0.05):
    performance_degraded = (baseline_performance - current_performance) > threshold
    return performance_degraded or drift_detected

# Champion/challenger: the current production model ("champion") is compared against
# a newly retrained candidate ("challenger") before any promotion decision
def champion_challenger_comparison(champion_metrics, challenger_metrics, min_improvement=0.01):
    improvement = challenger_metrics["auc"] - champion_metrics["auc"]
    return improvement > min_improvement  # only promote if the challenger CLEARLY beats the champion
```

**Retraining triggers, in practice:** a fixed schedule (retrain monthly) is simple but can retrain unnecessarily often or miss a fast-moving drift event; a pure drift-triggered approach is more responsive but needs reliable drift detection to avoid retraining on noise. Most mature systems combine both — a baseline schedule plus drift-triggered early retraining when monitoring flags a clear problem.

---

## 6. Model Governance

```python
# Reproducibility: pin EVERYTHING needed to recreate a specific production model
model_manifest = {
    "model_version": "fraud_v2.3.1",
    "training_data_snapshot": "s3://data-lake/fraud/2026-08-15/",
    "code_commit_hash": "a1b2c3d4",
    "dependencies_lockfile": "requirements-lock.txt",
    "hyperparameters": {"max_depth": 5, "learning_rate": 0.03},
    "approval": {"approved_by": "risk_team_lead", "date": "2026-08-20"},
}

# Rollback plan: always be able to revert to the previous production model instantly
def rollback_to_previous_version(model_registry, current_version):
    previous_version = model_registry.get_previous_version(current_version)
    model_registry.promote_to_production(previous_version)
    return previous_version
```

**Approval gates** — a human sign-off step before a new model reaches production, especially in regulated domains — aren't just bureaucracy; they're the point where someone with business context reviews whether a statistically-better model might have unacceptable behavior on an edge case, a fairness concern, or an interpretability requirement that offline metrics alone wouldn't catch.

## Common Pitfalls

- **No rollback plan** — when (not if) a new model misbehaves in production, the time to figure out how to revert is not during the incident.
- **Monitoring only data drift, not performance decay** — data can look stable while the actual relationship between features and target has shifted (concept drift), silently degrading real performance.
- **Retraining on a fixed schedule only, with no drift-based trigger** — leaves the system exposed between scheduled retrains if something changes quickly (a new fraud pattern, a product launch that shifts user behavior).
- **Promoting a challenger model based on a single offline metric improvement** without shadow-testing on live traffic first — offline validation sets don't always reflect current production data characteristics.
- **Treating experiment tracking as optional** — an untracked model in production is a liability the first time someone needs to reproduce, audit, or debug it.

---

## 7. End-to-End Worked Example: A Minimal Drift-Triggered Retraining Pipeline

```python
import numpy as np
import pandas as pd
from scipy.stats import ks_2samp
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
import mlflow

np.random.seed(42)

def generate_data(n, drift=False):
    """Simulates production data, optionally with a distribution shift to mimic real drift."""
    f1 = np.random.normal(0 if not drift else 2, 1, n)  # mean shifts if drift=True
    f2 = np.random.normal(0, 1, n)
    y = (f1 + f2 + np.random.normal(0, 0.5, n) > 0).astype(int)
    return pd.DataFrame({"f1": f1, "f2": f2, "y": y})

# Reference (training-time) data
reference_data = generate_data(2000, drift=False)
X_ref, y_ref = reference_data[["f1", "f2"]], reference_data["y"]
X_train, X_val, y_train, y_val = train_test_split(X_ref, y_ref, test_size=0.2, random_state=42)

mlflow.set_experiment("drift_monitoring_demo")
with mlflow.start_run(run_name="v1_baseline"):
    model = RandomForestClassifier(n_estimators=100, random_state=42).fit(X_train, y_train)
    baseline_auc = roc_auc_score(y_val, model.predict_proba(X_val)[:, 1])
    mlflow.log_metric("val_auc", baseline_auc)
    print(f"Baseline model val AUC: {baseline_auc:.3f}")

def check_for_drift_and_retrain(current_data, reference_data, model, auc_drop_threshold=0.05):
    # 1. Data drift check (label-free, can run immediately in production)
    drift_flags = {}
    for col in ["f1", "f2"]:
        _, p_value = ks_2samp(reference_data[col], current_data[col])
        drift_flags[col] = p_value < 0.05

    # 2. Performance check (requires labels — may lag in a real system)
    current_auc = roc_auc_score(current_data["y"], model.predict_proba(current_data[["f1", "f2"]])[:, 1])
    performance_degraded = (baseline_auc - current_auc) > auc_drop_threshold

    print(f"Drift detected in: {[k for k, v in drift_flags.items() if v]}")
    print(f"Current AUC: {current_auc:.3f} (baseline: {baseline_auc:.3f})")

    if any(drift_flags.values()) or performance_degraded:
        print(">>> RETRAINING TRIGGERED <<<")
        combined = pd.concat([reference_data, current_data])
        new_X, new_y = combined[["f1", "f2"]], combined["y"]
        new_X_train, new_X_val, new_y_train, new_y_val = train_test_split(new_X, new_y, test_size=0.2, random_state=42)
        new_model = RandomForestClassifier(n_estimators=100, random_state=42).fit(new_X_train, new_y_train)
        new_auc = roc_auc_score(new_y_val, new_model.predict_proba(new_X_val)[:, 1])

        with mlflow.start_run(run_name="v2_retrained_after_drift"):
            mlflow.log_metric("val_auc", new_auc)
            mlflow.log_param("triggered_by", "drift" if any(drift_flags.values()) else "performance_decay")

        # Champion/challenger: only promote if the retrained model is CLEARLY better
        if new_auc > current_auc + 0.01:
            print(f"Challenger (AUC={new_auc:.3f}) beats champion (AUC={current_auc:.3f}) — promoting.")
            return new_model
        else:
            print("Challenger did not clearly beat champion — keeping current model.")
    return model

# Simulate production data WITH drift and run the monitoring/retraining check
drifted_production_data = generate_data(500, drift=True)
final_model = check_for_drift_and_retrain(drifted_production_data, reference_data, model)
```

This ties together the full MLOps loop from the base sheet: experiment tracking (MLflow runs), a label-free drift check that can run continuously, a label-dependent performance check, an explicit retraining trigger, and a champion/challenger gate before promoting anything to production.

---

## 8. Advanced & Lesser-Known Techniques

- **Canary + shadow combined**: deploy a challenger model in shadow mode (logging predictions, serving nothing) for an initial validation period, then — once shadow metrics look healthy — promote it into a canary (serving a small percentage of real traffic) before full rollout, layering both safety nets rather than choosing one.
- **Automated rollback triggers**: rather than relying on a human noticing a production incident, configure automated alerts that trigger an immediate rollback to the previous model version if a key metric (error rate, latency, a proxy for accuracy) crosses a hard threshold within minutes of a new deployment.
- **Model cards and datasheets**: standardized documentation artifacts (popularized by Google's "Model Cards" and "Datasheets for Datasets" papers) that accompany a model into production, documenting intended use, known limitations, evaluation results across subgroups, and training data provenance — increasingly expected for governance and compliance purposes, not just nice-to-have documentation.
- **Feature attribution monitoring**: beyond monitoring raw feature distributions, monitor the *distribution of SHAP values* over time — a shift in which features are driving predictions (even without a corresponding shift in raw feature distributions) can be an earlier and more direct signal of concept drift than watching input features alone.

---

## 9. Practice Exercises

1. Modify the worked example so drift occurs gradually over many small batches rather than all at once, and tune the KS-test's sensitivity (sample size, significance threshold) to detect it as early as possible without excessive false alarms.
2. Implement an automated rollback: simulate a "bad" model deployment (deliberately degraded), monitor a proxy metric in real time, and trigger an automatic revert to the previous model once the metric crosses a threshold.
3. Draft a model card for one of the models built in this cheatsheet collection (e.g., the fraud detector from the Anomaly Detection sheet), covering intended use, training data description, and known limitations.
4. Extend the drift monitor to track feature-level SHAP value distributions (using the Model Interpretability sheet's TreeSHAP approach) in addition to raw feature distributions, and compare which signal detects a synthetic drift scenario earlier.
5. Implement a full champion/challenger A/B test simulation: route a configurable percentage of "production" requests to each model, log outcomes, and compute a statistically-grounded comparison (e.g., a simple two-proportion z-test) before deciding whether to promote the challenger.

---

## 10. More Examples

### Example: A model registry workflow with stage transitions

```python
import mlflow
from mlflow import MlflowClient

client = MlflowClient()

# Register a trained model, then move it through lifecycle stages explicitly
model_uri = "runs:/<run_id>/model"
registered = mlflow.register_model(model_uri, "fraud_detector")

# Explicit stage transitions create an audit trail: Staging -> Production -> Archived
client.transition_model_version_stage(name="fraud_detector", version=registered.version, stage="Staging")
# ... after validation passes ...
client.transition_model_version_stage(name="fraud_detector", version=registered.version, stage="Production")
```

### Example: Logging a full evaluation report as an MLflow artifact

```python
import mlflow
import json

evaluation_report = {
    "overall_auc": 0.91,
    "subgroup_performance": {
        "region_us": {"auc": 0.92, "n": 5000},
        "region_eu": {"auc": 0.88, "n": 3000},  # worth flagging — meaningfully lower than the US subgroup
    },
    "fairness_checks": {"demographic_parity_diff": 0.03},
}

with mlflow.start_run():
    with open("eval_report.json", "w") as f:
        json.dump(evaluation_report, f, indent=2)
    mlflow.log_artifact("eval_report.json")
    # Artifacts like this travel WITH the run, making subgroup performance auditable later
```

### Example: A minimal data validation gate before training even starts

```python
import pandas as pd

def validate_training_data(df, expected_schema, max_null_fraction=0.05):
    """Fail FAST and LOUD before wasting compute training on bad data — a cheap,
    high-value check that belongs at the very start of every training pipeline."""
    errors = []
    for col, dtype in expected_schema.items():
        if col not in df.columns:
            errors.append(f"Missing expected column: {col}")
        elif df[col].dtype != dtype:
            errors.append(f"Column {col} has dtype {df[col].dtype}, expected {dtype}")
        elif df[col].isnull().mean() > max_null_fraction:
            errors.append(f"Column {col} has {df[col].isnull().mean():.1%} nulls, exceeding {max_null_fraction:.0%} threshold")

    if errors:
        raise ValueError("Data validation failed:\n" + "\n".join(errors))
    print("Data validation passed.")

schema = {"age": "float64", "income": "float64", "region": "object"}
# validate_training_data(training_df, schema)  # raises before a single training step runs on bad data
```

---

## 11. Quick-Reference Cheat-Table

| Situation | Action |
|---|---|
| Data distribution shifted | Check with KS test / PSI |
| Model accuracy dropped, labels available | Confirmed concept drift — trigger retraining |
| No labels yet, only fresh input data | Data drift check only — performance check will lag |
| New model ready | Shadow deploy first, then canary, then full rollout |
| Something broke in production | Roll back immediately, investigate after |
| New model marginally better offline | Don't promote without shadow/canary validation |

## 12. FAQ

**Q: Data drift detected — do I need to retrain immediately?**
A: Not necessarily — data drift doesn't always mean the feature-target relationship changed (concept drift). Check actual performance metrics before triggering an expensive retrain.

**Q: How often should I retrain on a schedule?**
A: Combine a baseline schedule with drift-triggered early retraining — pure schedule-based retraining can miss fast-moving drift; pure drift-triggered can be noisy without a schedule as a backstop.

**Q: Do I need shadow deployment if I already do canary releases?**
A: They serve different purposes — shadow validates behavior with zero user risk before any real traffic exposure; canary validates with limited real traffic exposure. Layering both is safest for high-stakes models.

**Q: Is a slightly better offline metric enough to promote a challenger model?**
A: No — validate via shadow/canary on live traffic first. Offline validation sets don't always reflect current production data characteristics.

**Q: What's the single most important thing to have before deploying any model?**
A: A rollback plan — the moment (not "if") something goes wrong, you need to revert instantly, not figure out how during an incident.
