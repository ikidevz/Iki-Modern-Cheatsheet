# Hyperparameter Optimization & AutoML Cheatsheet

## Overview

Grid search doesn't scale past a handful of hyperparameters, and random search — while a solid default — doesn't get smarter as it goes. This sheet covers Bayesian optimization with Optuna (the practical modern default), and a clear-eyed look at what AutoML frameworks automate well versus what they quietly get wrong.

```bash
pip install optuna --break-system-packages
```

---

## 1. Grid vs. Random vs. Bayesian Optimization

| Method | Strategy | Scales to many params? | Learns from past trials? |
|---|---|---|---|
| Grid search | Exhaustive over a fixed grid | No — combinatorial explosion | No |
| Random search | Random samples from distributions | Yes, better than grid | No |
| Bayesian optimization | Builds a probabilistic model of the objective, samples where it expects improvement | Yes | Yes — this is the whole point |

**Why Bayesian optimization pays off:** with an expensive-to-train model (a large XGBoost model, a neural net), you can't afford to randomly try 500 combinations. Bayesian methods use a surrogate model (Optuna defaults to a Tree-structured Parzen Estimator) to predict which untried region of the search space is most likely to improve on the best result so far, focusing the budget where it matters.

```python
import numpy as np
from sklearn.datasets import make_classification
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.ensemble import RandomForestClassifier
import time

X, y = make_classification(n_samples=3000, n_features=25, n_informative=15, random_state=42)

# Random search baseline for comparison
from sklearn.model_selection import RandomizedSearchCV
from scipy.stats import randint

start = time.time()
random_search = RandomizedSearchCV(
    RandomForestClassifier(random_state=42),
    param_distributions={"n_estimators": randint(50, 500), "max_depth": randint(3, 20)},
    n_iter=20, cv=3, scoring="roc_auc", random_state=42, n_jobs=-1,
)
random_search.fit(X, y)
print(f"Random search best: {random_search.best_score_:.4f} in {time.time()-start:.1f}s")
```

---

## 2. Optuna: Search Space, Pruning, and Parallelization

### Basic study

```python
import optuna
from sklearn.ensemble import RandomForestClassifier

def objective(trial):
    params = {
        "n_estimators": trial.suggest_int("n_estimators", 50, 500),
        "max_depth": trial.suggest_int("max_depth", 3, 20),
        "min_samples_leaf": trial.suggest_int("min_samples_leaf", 1, 10),
        "max_features": trial.suggest_categorical("max_features", ["sqrt", "log2", None]),
    }
    model = RandomForestClassifier(random_state=42, n_jobs=-1, **params)
    scores = cross_val_score(model, X, y, cv=StratifiedKFold(3), scoring="roc_auc")
    return scores.mean()

optuna.logging.set_verbosity(optuna.logging.WARNING)  # quiet the trial-by-trial spam
study = optuna.create_study(direction="maximize")
study.optimize(objective, n_trials=30)

print(f"Best value: {study.best_value:.4f}")
print(f"Best params: {study.best_params}")
```

### Pruning trials early

For iterative models (gradient boosting, neural nets), Optuna can kill a clearly-underperforming trial partway through training instead of wasting the full budget on it:

```python
import xgboost as xgb
from sklearn.model_selection import train_test_split
from optuna.integration import XGBoostPruningCallback

X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

def xgb_objective(trial):
    params = {
        "max_depth": trial.suggest_int("max_depth", 3, 10),
        "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
        "subsample": trial.suggest_float("subsample", 0.5, 1.0),
        "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
        "eval_metric": "auc",
    }
    pruning_callback = XGBoostPruningCallback(trial, "validation_0-auc")
    model = xgb.XGBClassifier(n_estimators=500, random_state=42, **params)
    model.fit(
        X_train, y_train, eval_set=[(X_val, y_val)],
        callbacks=[pruning_callback], verbose=False,
    )
    return model.best_score

study_xgb = optuna.create_study(
    direction="maximize",
    pruner=optuna.pruners.MedianPruner(n_startup_trials=5),
)
study_xgb.optimize(xgb_objective, n_trials=30)
print(f"Best XGBoost AUC: {study_xgb.best_value:.4f}")
```

### Parallelizing a study

```python
# Optuna supports distributed studies backed by a shared storage (e.g., a database)
# study = optuna.create_study(
#     study_name="xgb_tuning",
#     storage="sqlite:///optuna_study.db",  # or a postgres URL for true multi-machine parallelism
#     direction="maximize",
#     load_if_exists=True,
# )
# Then run study.optimize(...) from multiple processes/machines pointed at the same storage
```

---

## 3. Multi-Objective Tuning

Real deployments rarely optimize accuracy alone — latency, model size, and memory footprint often matter just as much.

```python
def multi_objective(trial):
    params = {
        "n_estimators": trial.suggest_int("n_estimators", 20, 300),
        "max_depth": trial.suggest_int("max_depth", 2, 15),
    }
    model = RandomForestClassifier(random_state=42, n_jobs=-1, **params)
    scores = cross_val_score(model, X, y, cv=3, scoring="roc_auc")
    accuracy = scores.mean()
    # Proxy for inference cost: more trees & deeper trees = slower predictions
    model_complexity = params["n_estimators"] * params["max_depth"]
    return accuracy, model_complexity

mo_study = optuna.create_study(directions=["maximize", "minimize"])
mo_study.optimize(multi_objective, n_trials=30)

# Optuna exposes the Pareto front — the set of trials where you can't improve one
# objective without sacrificing the other
pareto_trials = mo_study.best_trials
print(f"Found {len(pareto_trials)} Pareto-optimal trials")
for t in pareto_trials[:3]:
    print(f"  AUC={t.values[0]:.4f}, complexity={t.values[1]:.0f}, params={t.params}")
```

---

## 4. AutoML Frameworks

| Framework | Automates | Doesn't automate |
|---|---|---|
| Auto-sklearn | Algorithm selection + hyperparameter search + ensembling over sklearn models | Feature engineering domain logic, leakage checks |
| H2O AutoML | Model search across GBMs, GLMs, deep learning, stacking | Deep understanding of *why* a model works, business-metric alignment |
| AutoGluon | Strong defaults, stacking/bagging, tabular/text/image | Data quality issues, label noise |

```python
# Illustrative — actual usage requires the package installed and more setup
# from autogluon.tabular import TabularPredictor
# predictor = TabularPredictor(label="target").fit(train_data, time_limit=600)
# leaderboard = predictor.leaderboard(test_data)
```

**What AutoML frameworks genuinely save you:** the tedious, mechanical parts — trying a dozen algorithm families, sweeping their hyperparameters, and building a stacked ensemble of the survivors. This is real time saved, especially for a solid baseline.

**What they can't do for you:**
- Catch data leakage baked into your feature set (they'll happily achieve suspiciously good scores on a leaky dataset).
- Decide which evaluation metric actually matters for your business problem — you still have to configure this correctly.
- Do domain-informed feature engineering (a "days since last purchase" feature usually beats what an AutoML framework derives from raw timestamps).
- Guarantee interpretability — the winning ensemble is often an opaque stack of models, which may be unacceptable in regulated domains (see the Model Interpretability sheet).
- Replace understanding *why* a model works, which you need for debugging when it eventually fails in production.

---

## 5. Search Budget Planning

Rough guidance for how many trials are "enough":

| Search space size | Suggested trial budget |
|---|---|
| 1–3 hyperparameters | 20–50 trials (random search is often sufficient) |
| 4–6 hyperparameters | 50–150 trials with Bayesian optimization |
| 7+ hyperparameters, or expensive model | 150+ trials, use pruning aggressively, consider multi-fidelity (train on a data subset first) |

A useful diagnostic: plot best-value-so-far against trial number (`optuna.visualization.plot_optimization_history`). If the curve has clearly flattened well before your trial budget is exhausted, you've likely already found a near-optimal region and can stop early.

---

## 6. Avoiding Hyperparameter Overfitting to the Validation Set

If you run 500 trials against the same validation set, you *will* eventually find a hyperparameter combination that fits the validation set's noise rather than generalizing — this is the same leakage risk as looking at test data too many times.

**Mitigations:**
- Use cross-validation (not a single validation split) as the objective inside each trial, so the objective itself is less noisy.
- Hold out a final test set that is *never* touched during hyperparameter search, and check it only once at the end.
- Prefer nested cross-validation for small datasets — an outer loop for honest performance estimation, an inner loop for hyperparameter search — even though it's more expensive.
- Be suspicious of a search that finds an oddly specific "sweet spot" (e.g., `max_depth=7` beats both 6 and 8 by a wide margin) — this is a signature of overfitting to validation noise rather than a genuine effect.

```python
from sklearn.model_selection import cross_val_score

def nested_cv_objective(trial, X_outer_train, y_outer_train):
    params = {"max_depth": trial.suggest_int("max_depth", 3, 15)}
    model = RandomForestClassifier(random_state=42, **params)
    # Inner CV score used only to pick hyperparameters
    return cross_val_score(model, X_outer_train, y_outer_train, cv=3, scoring="roc_auc").mean()

# Outer loop: honest generalization estimate, hyperparameters re-tuned fresh in each outer fold
outer_cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
outer_scores = []
for train_idx, test_idx in outer_cv.split(X, y):
    inner_study = optuna.create_study(direction="maximize")
    inner_study.optimize(
        lambda trial: nested_cv_objective(trial, X[train_idx], y[train_idx]), n_trials=10
    )
    best_model = RandomForestClassifier(random_state=42, **inner_study.best_params).fit(X[train_idx], y[train_idx])
    outer_scores.append(best_model.score(X[test_idx], y[test_idx]))

print(f"Nested CV score: {np.mean(outer_scores):.4f} ± {np.std(outer_scores):.4f}")
```

## Common Pitfalls

- **Running a huge grid search when 1–3 hyperparameters actually matter** — profile which hyperparameters have the most effect before widening the search.
- **Tuning on the same validation set you use for final reporting** — this is leakage; hold out a separate test set.
- **Ignoring pruning for expensive iterative models** — wastes enormous compute finishing trials that were clearly going nowhere by round 10.
- **Trusting AutoML leaderboard scores at face value** without checking for data leakage or metric misalignment.
- **Not logging trials** — always persist Optuna studies (SQLite/Postgres storage) so a crashed run can resume instead of restarting from scratch.

---

## 7. End-to-End Worked Example: Optuna With Pruning, Persistence, and Visualization

```python
import optuna
import numpy as np
import lightgbm as lgb
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score
from optuna.integration import LightGBMPruningCallback

X, y = make_classification(n_samples=6000, n_features=25, n_informative=15, random_state=42)
X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

def objective(trial):
    params = {
        "num_leaves": trial.suggest_int("num_leaves", 15, 255),
        "learning_rate": trial.suggest_float("learning_rate", 0.005, 0.3, log=True),
        "feature_fraction": trial.suggest_float("feature_fraction", 0.5, 1.0),
        "bagging_fraction": trial.suggest_float("bagging_fraction", 0.5, 1.0),
        "min_child_samples": trial.suggest_int("min_child_samples", 5, 100),
        "lambda_l1": trial.suggest_float("lambda_l1", 1e-8, 10.0, log=True),
        "lambda_l2": trial.suggest_float("lambda_l2", 1e-8, 10.0, log=True),
    }
    pruning_callback = LightGBMPruningCallback(trial, "auc")
    model = lgb.LGBMClassifier(n_estimators=1000, random_state=42, **params)
    model.fit(
        X_train, y_train, eval_set=[(X_val, y_val)], eval_metric="auc",
        callbacks=[pruning_callback, lgb.early_stopping(30, verbose=False)],
    )
    return roc_auc_score(y_val, model.predict_proba(X_val)[:, 1])

# Persist the study to disk so it survives a crash/restart, and can be resumed or parallelized
study = optuna.create_study(
    study_name="lgbm_tuning_demo",
    storage="sqlite:///optuna_demo.db",
    direction="maximize",
    pruner=optuna.pruners.MedianPruner(n_startup_trials=5, n_warmup_steps=10),
    load_if_exists=True,
)
study.optimize(objective, n_trials=40)

print(f"Best AUC: {study.best_value:.4f}")
print(f"Best params: {study.best_params}")
print(f"Trials pruned early: {sum(1 for t in study.trials if t.state == optuna.trial.TrialState.PRUNED)} / {len(study.trials)}")

# Visualize which hyperparameters mattered most (requires plotly)
# optuna.visualization.plot_param_importances(study).show()
# optuna.visualization.plot_optimization_history(study).show()
```

Persisting to SQLite means you can kill this process, restart it later, or even launch a second process pointed at the same `optuna_demo.db` to add trials in parallel — all without losing the trials already completed. The pruning callback means trials that are clearly underperforming get killed mid-training rather than wasting the full 1000-round budget.

---

## 8. Advanced & Lesser-Known Techniques

- **Conditional search spaces**: Optuna supports defining hyperparameters that only exist conditionally on another choice (e.g., only sample `num_leaves` if `boosting_type == "gbdt"`, since it's irrelevant for `"goss"`), via ordinary Python control flow inside the objective function — no special API needed.
- **`optuna.samplers.CmaEsSampler`**: an alternative to the default TPE sampler, often stronger for continuous, low-dimensional search spaces (roughly < 10 continuous parameters) where TPE's independence assumptions between parameters can be a limitation.
- **Warm-starting a study from known-good defaults**: use `study.enqueue_trial({...})` to force specific parameter combinations (e.g., library defaults, or the winning config from a previous related study) to be tried first, giving the sampler a strong starting point.
- **Successive halving / Hyperband** (`optuna.pruners.HyperbandPruner`): allocates increasing training budget to increasingly promising trials in a principled way, often outperforming simple median pruning for very expensive models.

---

## 9. Practice Exercises

1. Run the LightGBM study above with pruning disabled (`pruner=optuna.pruners.NopPruner()`) and compare total wall-clock time against the pruned version for the same number of trials.
2. Add a conditional hyperparameter: sample `boosting_type` categorically (`"gbdt"` vs `"dart"`), and only sample a `drop_rate` parameter when `"dart"` is chosen.
3. Use `study.enqueue_trial()` to seed the search with LightGBM's library defaults before letting Optuna explore freely — does the final best score change compared to a cold start?
4. Implement the nested cross-validation pattern from this sheet on a small (n=300) dataset and compare the outer-loop honest estimate against the naive (non-nested) best CV score — quantify the optimism gap.
5. Compare `TPESampler` vs. `CmaEsSampler` on a purely continuous 5-parameter search space (e.g., tuning a neural network's learning rate, weight decay, dropout, and two layer-width parameters) over a fixed trial budget.

---

## 10. More Examples

### Example: Tuning a neural network's architecture, not just training hyperparameters

```python
import optuna
import torch
import torch.nn as nn

def build_model(trial, input_dim):
    n_layers = trial.suggest_int("n_layers", 1, 4)
    layers = []
    in_dim = input_dim
    for i in range(n_layers):
        out_dim = trial.suggest_int(f"n_units_l{i}", 16, 128, log=True)
        layers += [nn.Linear(in_dim, out_dim), nn.ReLU(), nn.Dropout(trial.suggest_float(f"dropout_l{i}", 0.0, 0.5))]
        in_dim = out_dim
    layers.append(nn.Linear(in_dim, 1))
    return nn.Sequential(*layers)

def objective(trial):
    model = build_model(trial, input_dim=20)
    # ... train and validate model, return validation metric ...
    return 0.85  # placeholder for actual training loop's validation score

study = optuna.create_study(direction="maximize")
# study.optimize(objective, n_trials=20)  # architecture search, not just hyperparameter search
```

### Example: Tuning a full preprocessing + model pipeline jointly

```python
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.decomposition import PCA
from sklearn.svm import SVC
import optuna

def pipeline_objective(trial):
    scaler_name = trial.suggest_categorical("scaler", ["standard", "robust"])
    scaler = StandardScaler() if scaler_name == "standard" else RobustScaler()
    use_pca = trial.suggest_categorical("use_pca", [True, False])

    steps = [("scale", scaler)]
    if use_pca:
        steps.append(("pca", PCA(n_components=trial.suggest_int("n_components", 2, 10))))
    steps.append(("svm", SVC(C=trial.suggest_float("C", 0.01, 100, log=True))))

    pipeline = Pipeline(steps)
    from sklearn.model_selection import cross_val_score
    return cross_val_score(pipeline, X, y, cv=5).mean()

# This tunes PREPROCESSING CHOICES alongside model hyperparameters in one unified search —
# often more impactful than only tuning the model's own parameters
```

### Example: Early-stopping-aware search budget diagnostics

```python
import optuna

def check_convergence(study, window=10):
    """A quick diagnostic: has the best score stopped improving over the last `window` trials?"""
    values = [t.value for t in study.trials if t.value is not None]
    if len(values) < window:
        return False
    recent_best = max(values[-window:])
    overall_best = max(values)
    return recent_best >= overall_best - 1e-6  # no improvement in the recent window

# Run this check periodically during a long study to decide whether to stop early and
# save compute, rather than blindly running a fixed trial budget every time
```

---

## 11. Quick-Reference Cheat-Table

| Search space size | Recommended approach |
|---|---|
| 1-3 hyperparameters | Random search, 20-50 trials |
| 4-6 hyperparameters | Bayesian optimization (Optuna), 50-150 trials |
| 7+ or expensive model | Bayesian + pruning, 150+ trials |
| Multiple competing objectives | Multi-objective Optuna study, inspect Pareto front |
| No time to build a search | AutoML framework (with leakage caution) |

## 12. FAQ

**Q: Is Bayesian optimization always better than random search?**
A: For expensive-to-train models, usually yes. For very cheap models with a huge trial budget available, the gap narrows since random search can just brute-force more of the space.

**Q: How do I know when to stop searching?**
A: Plot best-score-so-far against trial number — once the curve visibly flattens well before your budget is exhausted, further trials have low expected value.

**Q: Can AutoML replace a data scientist?**
A: It automates model/hyperparameter selection, not data leakage checks, business-metric alignment, or domain-informed feature engineering — all still require human judgment.

**Q: Why did my hyperparameter search find a suspiciously specific "sweet spot"?**
A: Possible overfitting to validation noise from too many trials against the same split — use cross-validation inside the objective, or nested CV for small datasets.

**Q: Should I always use pruning?**
A: For iterative models (boosting, neural nets) with a meaningful per-trial cost, yes — it saves substantial compute. For instant-to-train models, pruning adds overhead without much benefit.
