# Model Interpretability & Explainability Cheatsheet

## Overview

A model that performs well but can't be explained is a liability the moment a stakeholder asks "why did it make that decision" or a regulator asks the same thing formally. This sheet covers SHAP and LIME for explaining individual predictions, partial dependence and permutation importance for global behavior, and the caveats that keep an explanation from being misleading.

```bash
pip install shap lime --break-system-packages
```

---

## 1. SHAP Values

SHAP (SHapley Additive exPlanations) assigns each feature a contribution to a specific prediction, derived from cooperative game theory — the "fair" way to split credit for a prediction among features, based on averaging over all possible feature orderings.

### TreeSHAP vs. KernelSHAP

| | TreeSHAP | KernelSHAP |
|---|---|---|
| Works on | Tree-based models (XGBoost, LightGBM, Random Forest) | Any model (model-agnostic) |
| Speed | Fast — exploits tree structure exactly | Slow — samples feature coalitions, approximate |
| Exactness | Exact Shapley values | Approximation, more samples = more accurate |
| When to use | Always, if your model is tree-based | Neural nets, SVMs, anything without a specialized explainer |

```python
import shap
import numpy as np
import xgboost as xgb
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split

X, y = make_classification(n_samples=2000, n_features=15, n_informative=8, random_state=42)
feature_names = [f"feature_{i}" for i in range(15)]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = xgb.XGBClassifier(n_estimators=200, max_depth=4, random_state=42).fit(X_train, y_train)

# TreeSHAP — fast and exact for tree models
explainer = shap.TreeExplainer(model)
shap_values = explainer(X_test[:200])  # returns an Explanation object

# Global importance: mean |SHAP value| per feature
mean_abs_shap = np.abs(shap_values.values).mean(axis=0)
for name, val in sorted(zip(feature_names, mean_abs_shap), key=lambda x: -x[1])[:5]:
    print(f"{name}: {val:.4f}")

# Explaining ONE prediction — this is what makes SHAP useful for stakeholder-facing explanations
single_prediction_shap = shap_values[0]
print(f"\nBase value (average model output): {single_prediction_shap.base_values:.3f}")
print("Per-feature contribution to this prediction:")
for name, val in zip(feature_names, single_prediction_shap.values):
    if abs(val) > 0.01:
        print(f"  {name}: {val:+.3f}")
```

### Reading a summary/force plot correctly
- A **summary plot** shows every feature's SHAP values across all test samples — the spread tells you not just importance, but whether high feature values push predictions up or down.
- A **force plot** for a single prediction shows features "pushing" the prediction above or below the base rate (the average model output) — red pushes toward the positive class, blue pushes toward the negative class.
- **The base value matters**: SHAP contributions are relative to the *average* prediction, not zero. A feature with a "+0.3" contribution means it pushed this prediction 0.3 above what an average input would get — not that it alone explains 0.3 of the outcome in isolation.

### KernelSHAP for non-tree models

```python
from sklearn.linear_model import LogisticRegression

linear_model = LogisticRegression(max_iter=1000).fit(X_train, y_train)

# KernelSHAP needs a background dataset to simulate "feature absence"
background = shap.sample(X_train, 50)
kernel_explainer = shap.KernelExplainer(linear_model.predict_proba, background)
kernel_shap_values = kernel_explainer.shap_values(X_test[:5], nsamples=100)  # slow — keep sample sizes small
print("KernelSHAP shape:", np.array(kernel_shap_values).shape)
```

---

## 2. LIME: Local Surrogate Models

LIME explains a single prediction by fitting a simple, interpretable model (usually linear) to the model's behavior in a small neighborhood around that specific input — perturbing the input slightly and seeing how the prediction changes.

```python
from lime.lime_tabular import LimeTabularExplainer

lime_explainer = LimeTabularExplainer(
    X_train, feature_names=feature_names, class_names=["neg", "pos"], mode="classification"
)

explanation = lime_explainer.explain_instance(
    X_test[0], model.predict_proba, num_features=5
)
print("LIME explanation for one prediction:")
for feature, weight in explanation.as_list():
    print(f"  {feature}: {weight:+.3f}")
```

### Where LIME breaks down
- The "neighborhood" is defined by random perturbation — for non-linear models with sharp decision boundaries, a linear surrogate fit locally can be a poor approximation even in a small radius.
- Results are **unstable**: running LIME twice on the same instance can give noticeably different explanations because of the random sampling involved.
- LIME's perturbation strategy for tabular data (usually sampling from feature marginal distributions) can generate unrealistic combinations of feature values that would never occur in real data, distorting the local approximation.
- SHAP is generally preferred when a fast, exact explainer (TreeSHAP) is available; LIME is more useful for model types (or data types like images/text) where no specialized SHAP explainer exists.

---

## 3. Partial Dependence, Permutation Importance, and Built-in Importance

| Method | What it shows | Captures interactions? |
|---|---|---|
| Partial Dependence Plot (PDP) | Average predicted outcome as ONE feature varies, others held at observed values | No — assumes features are independent |
| Individual Conditional Expectation (ICE) | Same as PDP but per-instance, not averaged | Reveals heterogeneity PDP averages away |
| Permutation Importance | Drop in performance when a feature's values are shuffled | Indirectly, but doesn't show direction |
| Built-in (tree) importance | Gain/split-count from training | Biased toward high-cardinality features |

```python
from sklearn.inspection import PartialDependenceDisplay, permutation_importance
from sklearn.ensemble import RandomForestClassifier

rf = RandomForestClassifier(n_estimators=200, random_state=42).fit(X_train, y_train)

# Permutation importance — model-agnostic, computed on held-out data (more trustworthy than built-in importance)
perm_result = permutation_importance(rf, X_test, y_test, n_repeats=10, random_state=42, scoring="roc_auc")
perm_importance_df = sorted(
    zip(feature_names, perm_result.importances_mean, perm_result.importances_std),
    key=lambda x: -x[1]
)
print("Permutation importance (mean ± std):")
for name, mean, std in perm_importance_df[:5]:
    print(f"  {name}: {mean:.4f} ± {std:.4f}")

# Partial dependence for the top feature — shows the SHAPE of the relationship, not just importance
# PartialDependenceDisplay.from_estimator(rf, X_test, features=[0], feature_names=feature_names)  # plotting call
```

**Why permutation importance on test data beats built-in tree importance:** built-in importance is computed from training-set splits and can be inflated for features the model overfit to; permutation importance measures the actual drop in *held-out* performance, which is closer to what you actually care about.

---

## 4. Counterfactual Explanations

A counterfactual answers: "what's the smallest change to this input that would flip the prediction?" — useful for actionable explanations (e.g., "if your income were $5,000 higher, this loan would be approved").

```python
def simple_counterfactual_search(model, x, feature_idx, target_class, step=0.1, max_steps=50):
    """Naive 1D search: nudge a single feature until the prediction flips."""
    x = x.copy()
    original_pred = model.predict([x])[0]
    for _ in range(max_steps):
        if model.predict([x])[0] == target_class:
            return x, True
        x[feature_idx] += step
    return x, False

cf_x, flipped = simple_counterfactual_search(model, X_test[0], feature_idx=2, target_class=1)
print(f"Counterfactual found: {flipped}")
```

For real applications, use a dedicated library like `dice-ml` or `alibi`, which optimize for *plausible* and *sparse* counterfactuals (changing as few features as possible, staying within realistic value ranges) rather than a naive single-feature search.

---

## 5. Interpretability Caveats

- **Correlated features distort every method above.** If `income` and `credit_limit` are highly correlated, SHAP/permutation importance can split credit between them arbitrarily, understating the true importance of "the underlying factor" they both represent.
- **Explanations describe correlation the model learned, not causation.** A feature with high SHAP importance is important *to the model's decision process* — it is not necessarily a causal driver of the real-world outcome. See the Causal Inference sheet for the distinction.
- **PDPs assume feature independence**, which is often false — a PDP for `age` while holding `years_of_experience` fixed can describe combinations that never occur in reality (a 22-year-old with 30 years of experience).
- **Global importance can hide important local behavior** — a feature that matters enormously for a small subgroup but not at all for everyone else can show up as "moderately important" on average.

---

## 6. Regulatory/Compliance Angle

In credit, hiring, insurance, and similar high-stakes domains, explainability isn't optional — regulations in many jurisdictions (e.g., adverse action notices under US fair lending law, GDPR's "right to explanation" discussions in the EU) require that a rejected applicant can be told *why*.

Practical implications:
- Favor inherently interpretable models (logistic regression, shallow trees) or be prepared to defend a post-hoc explanation method (SHAP is generally viewed more favorably than LIME due to its theoretical grounding and stability).
- Document which features drive decisions and retain the ability to regenerate an explanation for any historical prediction — this means versioning your model *and* your explainer together.
- Be alert to proxy discrimination: a feature that's legal to use (like zip code) can act as a proxy for a protected attribute (like race), and SHAP will happily assign it high importance without flagging that risk — a fairness audit is a separate, necessary step, not a byproduct of interpretability tooling.

## Common Pitfalls

- **Treating SHAP/LIME output as a causal explanation** rather than a description of the model's learned behavior.
- **Using LIME when a TreeSHAP-compatible model is available** — TreeSHAP is faster, exact, and more stable.
- **Reading built-in tree feature importance as final** without cross-checking against permutation importance or SHAP.
- **Ignoring correlated features** when interpreting importance rankings — consider grouping correlated features before attributing importance.
- **Skipping a fairness/proxy-discrimination review** just because a model is "explainable" — interpretability and fairness are related but distinct concerns.

---

## 7. End-to-End Worked Example: Explaining a Loan-Approval Model End to End

```python
import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.inspection import permutation_importance

np.random.seed(42)
n = 3000
df = pd.DataFrame({
    "income": np.random.lognormal(10.5, 0.5, n),
    "credit_score": np.random.normal(680, 80, n).clip(300, 850),
    "debt_to_income": np.random.beta(2, 5, n),
    "years_employed": np.random.exponential(5, n),
    "zip_code_risk_score": np.random.normal(0, 1, n),  # a plausible proxy-discrimination risk feature
})
# Approval driven mostly by credit_score and debt_to_income, with a little noise
logit = 0.01 * (df.credit_score - 650) - 3 * df.debt_to_income + 0.05 * np.log(df.income) - 5
df["approved"] = (1 / (1 + np.exp(-logit)) > np.random.random(n)).astype(int)

X, y = df.drop(columns="approved"), df["approved"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = xgb.XGBClassifier(n_estimators=200, max_depth=4, random_state=42).fit(X_train, y_train)

# 1. Global explanation: SHAP summary
explainer = shap.TreeExplainer(model)
shap_values = explainer(X_test)
mean_abs_shap = pd.Series(np.abs(shap_values.values).mean(axis=0), index=X.columns).sort_values(ascending=False)
print("Global feature importance (mean |SHAP|):\n", mean_abs_shap)

# 2. Cross-check against permutation importance computed on held-out data
perm = permutation_importance(model, X_test, y_test, n_repeats=20, random_state=42, scoring="roc_auc")
perm_df = pd.Series(perm.importances_mean, index=X.columns).sort_values(ascending=False)
print("\nPermutation importance:\n", perm_df)

# 3. Explain a SPECIFIC denied applicant — this is the "adverse action" use case
denied_idx = X_test[model.predict(X_test) == 0].index[0]
applicant_shap = shap_values[X_test.index.get_loc(denied_idx)]
print(f"\nExplanation for applicant {denied_idx} (denied):")
for feature, value in sorted(zip(X.columns, applicant_shap.values), key=lambda x: x[1])[:3]:
    print(f"  {feature}: {value:+.3f} (pushed toward denial)")

# 4. Fairness/proxy-discrimination check: is a plausible proxy feature carrying real weight?
if mean_abs_shap["zip_code_risk_score"] > mean_abs_shap.median():
    print("\nWARNING: zip_code_risk_score has above-median importance — "
          "worth auditing as a potential proxy for a protected characteristic.")
```

This is the complete loop a regulated-industry team actually needs: global importance for model documentation, a cross-check via a second method (permutation importance) to catch SHAP artifacts from correlated features, a per-applicant explanation for an adverse-action notice, and an explicit proxy-discrimination check — interpretability tooling alone doesn't do this last step for you.

---

## 8. Advanced & Lesser-Known Techniques

- **SHAP interaction values** (`explainer.shap_interaction_values(X)`, TreeSHAP only): decomposes each prediction into main effects AND pairwise interaction effects — reveals cases where two features only matter *together* (e.g., high debt-to-income is only harmful when income is also low), which single-feature SHAP values average away.
- **Anchors**: an alternative to LIME that produces *rules* ("IF credit_score > 700 AND debt_to_income < 0.3 THEN approved, with 95% precision") rather than linear weights — often more intuitive for non-technical stakeholders than a list of feature weights.
- **Global surrogate models**: fit a simple, fully interpretable model (a shallow decision tree) to mimic a complex model's predictions across the whole dataset — gives a holistic, if approximate, picture of the complex model's overall logic, complementing SHAP's per-prediction view.
- **Concept activation vectors (TCAV)**, for deep learning specifically: tests whether a human-understandable concept (e.g., "stripes" for a zebra classifier) is represented in a specific layer's activations and how much it influences a prediction — a way to interpret deep vision/language models beyond simple feature attribution.

---

## 9. Practice Exercises

1. Take the loan-approval example above and add two highly correlated features (`credit_score` and a noisy duplicate `credit_score_v2`). Recompute SHAP importance — observe how the true signal splits between them, understating each one's individual apparent importance.
2. Compute SHAP interaction values for the loan model and identify the strongest pairwise interaction — does it match domain intuition?
3. Fit a global surrogate decision tree (`max_depth=3`) to approximate the XGBoost model's predictions. Report its fidelity (agreement rate with the real model) and compare its "explanation" of the top split to the SHAP summary.
4. Implement the proxy-discrimination check as a reusable function that flags any feature whose name matches a configurable list of "risk" keywords (zip, age, gender-adjacent terms) AND has above-median SHAP importance.
5. Compare LIME and TreeSHAP explanations for the same 5 individual predictions — measure how often they agree on the top-1 most important feature, and investigate any disagreements.

---

## 10. More Examples

### Example: SHAP for a regression model (not just classification)

```python
import shap
import xgboost as xgb
from sklearn.datasets import fetch_california_housing

X, y = fetch_california_housing(return_X_y=True, as_frame=True)
reg_model = xgb.XGBRegressor(n_estimators=200, max_depth=4, random_state=42).fit(X, y)

explainer = shap.TreeExplainer(reg_model)
shap_values = explainer(X[:500])

# For regression, SHAP values are in the SAME UNITS as the target — directly interpretable
print(f"Base value (average predicted house value): {shap_values.base_values[0]:.3f}")
print(f"House #0's actual prediction: {reg_model.predict(X[:1])[0]:.3f}")
print("Feature contributions for house #0:")
for name, val in zip(X.columns, shap_values.values[0]):
    print(f"  {name}: {val:+.3f}")
```

### Example: Explaining a neural network with DeepSHAP

```python
import torch
import torch.nn as nn
import shap

model = nn.Sequential(nn.Linear(10, 32), nn.ReLU(), nn.Linear(32, 1), nn.Sigmoid())
background = torch.randn(50, 10)   # a representative sample used to estimate feature "absence"
test_inputs = torch.randn(5, 10)

deep_explainer = shap.DeepExplainer(model, background)
shap_values = deep_explainer.shap_values(test_inputs)
print(f"DeepSHAP values shape: {shap_values.shape}")  # one value per feature per test sample
```

### Example: A simple, from-scratch permutation importance to demystify the built-in version

```python
import numpy as np
from sklearn.metrics import roc_auc_score

def manual_permutation_importance(model, X, y, feature_idx, n_repeats=10):
    baseline_score = roc_auc_score(y, model.predict_proba(X)[:, 1])
    importances = []
    X_permuted = X.copy()
    for _ in range(n_repeats):
        np.random.shuffle(X_permuted[:, feature_idx])  # break this feature's relationship with y
        permuted_score = roc_auc_score(y, model.predict_proba(X_permuted)[:, 1])
        importances.append(baseline_score - permuted_score)  # how much did performance DROP?
        X_permuted[:, feature_idx] = X[:, feature_idx]  # restore before shuffling the next repeat
    return np.mean(importances), np.std(importances)

# This IS what sklearn.inspection.permutation_importance does internally — no magic involved
```

---

## 11. Quick-Reference Cheat-Table

| Need | Use |
|---|---|
| Fast, exact explanation for tree models | TreeSHAP |
| Explanation for any model type | KernelSHAP or LIME |
| Global feature ranking | Mean \|SHAP\| or permutation importance |
| Relationship shape for one feature | Partial Dependence Plot |
| Per-instance heterogeneity | ICE plots |
| "What would flip this decision?" | Counterfactual explanation |
| Regulatory/adverse-action explanation | SHAP (per-prediction) + documented methodology |

## 12. FAQ

**Q: SHAP or LIME — which should I default to?**
A: SHAP whenever a fast exact explainer (TreeSHAP) is available for your model type. Reserve LIME for models without a specialized SHAP explainer.

**Q: Two correlated features split importance oddly — is SHAP broken?**
A: No — this is expected behavior. Correlated features genuinely have ambiguous individual credit; consider grouping them conceptually before interpreting.

**Q: Does high feature importance mean the feature is causally driving the outcome?**
A: No — it means the feature is useful for the model's predictions. Causal claims need the methods in the Causal Inference sheet, not interpretability tools.

**Q: My LIME explanations change every time I re-run them — is that a bug?**
A: No — LIME's random perturbation sampling makes it inherently somewhat unstable. This instability is itself a reason to prefer SHAP when possible.

**Q: Is a "more interpretable" model always the safer choice?**
A: Not automatically — a well-explained black-box model with SHAP can be more transparent in practice than a "simple" model whose coefficients are still routinely misread by stakeholders.
