# Scikit-learn (General) Cheatsheet

## Overview

This is the "plumbing" sheet — not a specific algorithm, but the workflow that makes any scikit-learn model reproducible and safe from leakage: `Pipeline`/`ColumnTransformer` for preprocessing, cross-validation strategies, hyperparameter search, custom components, and persistence. If the Machine Learning Algorithms sheet is *what* model to use, this is *how* to wire it up correctly.

---

## 1. Pipeline & ColumnTransformer

The single most important habit in scikit-learn: **never fit a preprocessing step on the full dataset before splitting.** `Pipeline` enforces this automatically — preprocessing is fit only on training folds during cross-validation, and refit cleanly at prediction time.

```python
import pandas as pd
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

# Example mixed-type dataframe
df = pd.DataFrame({
    "age": [25, np.nan, 40, 35, 29],
    "income": [50000, 62000, np.nan, 71000, 48000],
    "city": ["NYC", "LA", "NYC", "SF", np.nan],
    "target": [0, 1, 1, 1, 0],
})
X, y = df.drop(columns="target"), df["target"]
numeric_features = ["age", "income"]
categorical_features = ["city"]

numeric_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler()),
])

categorical_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("onehot", OneHotEncoder(handle_unknown="ignore")),
])

preprocessor = ColumnTransformer(transformers=[
    ("num", numeric_transformer, numeric_features),
    ("cat", categorical_transformer, categorical_features),
])

full_pipeline = Pipeline(steps=[
    ("preprocess", preprocessor),
    ("classifier", LogisticRegression(max_iter=1000)),
])

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.4, random_state=42)
full_pipeline.fit(X_train, y_train)
print(f"Accuracy: {full_pipeline.score(X_test, y_test):.3f}")
```

**Why this matters:** if you'd called `SimpleImputer().fit_transform(X)` on the whole dataset before splitting, the median/mode used to fill training rows would be computed partly from test data — a subtle but real leakage source that inflates your reported performance.

---

## 2. Cross-Validation Strategies

| Strategy | Use when | sklearn class |
|---|---|---|
| K-Fold | Generic i.i.d. data | `KFold` |
| Stratified K-Fold | Classification, especially imbalanced classes | `StratifiedKFold` |
| Group K-Fold | Multiple rows per entity (patient, user) — must not leak across folds | `GroupKFold` |
| Time Series Split | Time-ordered data — never train on the future | `TimeSeriesSplit` |
| Leave-One-Out | Very small datasets | `LeaveOneOut` |

```python
from sklearn.model_selection import (
    KFold, StratifiedKFold, GroupKFold, TimeSeriesSplit, cross_val_score
)
from sklearn.datasets import make_classification

Xc, yc = make_classification(n_samples=300, weights=[0.9, 0.1], random_state=42)

# Plain K-Fold can produce folds with very few (or zero) minority-class examples
kfold_scores = cross_val_score(LogisticRegression(max_iter=1000), Xc, yc, cv=KFold(5, shuffle=True, random_state=42))

# Stratified preserves the class ratio in every fold — the right default for classification
skfold_scores = cross_val_score(LogisticRegression(max_iter=1000), Xc, yc, cv=StratifiedKFold(5, shuffle=True, random_state=42))

print(f"KFold scores:           {kfold_scores.round(3)}")
print(f"StratifiedKFold scores: {skfold_scores.round(3)}")

# Time series: fold boundaries only ever move forward
tscv = TimeSeriesSplit(n_splits=5)
for i, (train_idx, test_idx) in enumerate(tscv.split(Xc)):
    print(f"Fold {i}: train size={len(train_idx)}, test size={len(test_idx)}")
```

**Group K-Fold gotcha:** if you have multiple rows per user and split randomly, the model can "see" a user in training and get evaluated on that same user in test — leaking identity-specific patterns and overstating generalization. Use `GroupKFold(n_splits=5).split(X, y, groups=user_ids)` instead.

---

## 3. GridSearchCV vs. RandomizedSearchCV vs. Bayesian Search

| Method | How it searches | Best for |
|---|---|---|
| `GridSearchCV` | Exhaustive over a fixed grid | Small search spaces, need reproducible full coverage |
| `RandomizedSearchCV` | Random samples from distributions | Larger spaces — often finds a near-optimal point far faster than grid |
| Bayesian (Optuna) | Models the objective, samples informed by past trials | Expensive-to-train models, continuous hyperparameters, tight budgets |

```python
from sklearn.model_selection import RandomizedSearchCV
from scipy.stats import loguniform, randint
from sklearn.ensemble import RandomForestClassifier

param_distributions = {
    "n_estimators": randint(100, 500),
    "max_depth": randint(3, 20),
    "min_samples_leaf": randint(1, 10),
}

random_search = RandomizedSearchCV(
    RandomForestClassifier(random_state=42),
    param_distributions=param_distributions,
    n_iter=25,          # only 25 combinations tried, vs. potentially hundreds in a full grid
    cv=5,
    scoring="roc_auc",
    n_jobs=-1,
    random_state=42,
)
random_search.fit(Xc, yc)
print("Best params:", random_search.best_params_)
print(f"Best CV ROC-AUC: {random_search.best_score_:.3f}")
```

See the Hyperparameter Optimization & AutoML sheet for the full Optuna workflow.

---

## 4. Custom Transformers and Estimators

Writing your own `BaseEstimator`/`TransformerMixin` subclass lets custom logic slot cleanly into a `Pipeline` — including cross-validation and grid search over its own parameters.

```python
from sklearn.base import BaseEstimator, TransformerMixin

class OutlierClipper(BaseEstimator, TransformerMixin):
    """Clips numeric features to within [lower_pct, upper_pct] learned from training data."""

    def __init__(self, lower_pct=1, upper_pct=99):
        self.lower_pct = lower_pct
        self.upper_pct = upper_pct

    def fit(self, X, y=None):
        X = np.asarray(X, dtype=float)
        self.lower_bounds_ = np.percentile(X, self.lower_pct, axis=0)
        self.upper_bounds_ = np.percentile(X, self.upper_pct, axis=0)
        return self  # fit must return self

    def transform(self, X):
        X = np.asarray(X, dtype=float).copy()
        return np.clip(X, self.lower_bounds_, self.upper_bounds_)

# Drop straight into a pipeline — GridSearchCV can tune lower_pct/upper_pct like any other param
clipping_pipeline = Pipeline([
    ("clip", OutlierClipper(lower_pct=5, upper_pct=95)),
    ("scale", StandardScaler()),
    ("model", LogisticRegression(max_iter=1000)),
])
```

**Rules for a well-behaved custom transformer:**
- `fit()` learns parameters from training data only and stores them with a trailing underscore (`self.lower_bounds_`), the sklearn convention for "fitted attributes."
- `fit()` must return `self`.
- `transform()` must not look at `y` and must not refit anything.
- Inheriting `TransformerMixin` gives you `fit_transform()` for free.

---

## 5. Model Persistence

```python
import joblib

# Save a fitted pipeline (preprocessing + model together — this is the point of using Pipeline)
joblib.dump(full_pipeline, "model_pipeline.joblib")

# Load it back
loaded_pipeline = joblib.load("model_pipeline.joblib")
predictions = loaded_pipeline.predict(X_test)
```

**Version compatibility gotchas:**
- A pipeline pickled with one scikit-learn version can fail to load (or silently behave differently) with another — pin `scikit-learn` version in your `requirements.txt`/deployment environment.
- Custom transformer classes must be **importable from the same module path** at load time — pickling stores a reference to the class, not the class definition itself.
- Prefer `joblib` over raw `pickle` for anything containing large NumPy arrays — it handles them more efficiently.
- For long-term/cross-version safety in production, consider exporting to `ONNX` or storing preprocessing logic as explicit, versioned code rather than relying solely on a pickled object.

---

## 6. Common API Patterns

Every scikit-learn estimator follows the same contract, which is why pipelines and grid search "just work" across wildly different model types:

| Method | Contract |
|---|---|
| `fit(X, y=None)` | Learns parameters from data, returns `self` |
| `transform(X)` | Applies a learned transformation (transformers only) |
| `fit_transform(X, y=None)` | Shortcut for `fit(X, y).transform(X)` — sometimes more efficient than calling separately |
| `predict(X)` | Returns predictions (estimators only) |
| `predict_proba(X)` | Returns class probabilities (classifiers that support it) |
| `score(X, y)` | Returns a default metric (R² for regressors, accuracy for classifiers) |

```python
# Because every estimator honors this contract, this loop works regardless of model type:
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC

models = {
    "LogReg": LogisticRegression(max_iter=1000),
    "Tree": DecisionTreeClassifier(random_state=42),
    "SVM": SVC(),
}
for name, model in models.items():
    model.fit(Xc_train := Xc[:200], yc_train := yc[:200])
    print(f"{name}: {model.score(Xc[200:], yc[200:]):.3f}")
```

## Common Pitfalls

- **Fitting a scaler/imputer before train/test split** — always split first, or better, always use a `Pipeline` so it's structurally impossible to get wrong.
- **Passing `y` into a transformer's `transform()` logic** — transformers should be blind to labels at transform time, even if `fit()` used them (as in target encoding).
- **Forgetting `handle_unknown="ignore"` on `OneHotEncoder`** — a category seen only at prediction time will crash the pipeline without it.
- **Using `GridSearchCV` on continuous hyperparameter ranges** — you're limited to whatever discrete grid you specify; `RandomizedSearchCV` with a distribution (or Optuna) explores the continuous space properly.
- **Not setting `random_state`** — makes CV scores and grid search results irreproducible between runs.

---

## 7. End-to-End Worked Example: A Production-Ready Pipeline From Raw CSV to Deployed Model

This walks through the full workflow this sheet covers, combined into one coherent pipeline — the shape you'd actually ship.

```python
import pandas as pd
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold, RandomizedSearchCV
from sklearn.metrics import classification_report
from scipy.stats import randint
import joblib

# 1. Simulate a realistic messy dataset
np.random.seed(42)
n = 2000
df = pd.DataFrame({
    "age": np.random.normal(40, 12, n),
    "income": np.random.lognormal(10.5, 0.4, n),
    "region": np.random.choice(["North", "South", "East", "West", None], n, p=[0.3, 0.3, 0.2, 0.15, 0.05]),
    "tenure_months": np.random.exponential(24, n),
    "churned": np.random.binomial(1, 0.2, n),
})
df.loc[df.sample(frac=0.05, random_state=1).index, "age"] = np.nan  # inject missingness

X, y = df.drop(columns="churned"), df["churned"]
numeric_features = ["age", "income", "tenure_months"]
categorical_features = ["region"]

# 2. Build the preprocessing + model pipeline
preprocessor = ColumnTransformer([
    ("num", Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), numeric_features),
    ("cat", Pipeline([("impute", SimpleImputer(strategy="most_frequent")), ("onehot", OneHotEncoder(handle_unknown="ignore"))]), categorical_features),
])
pipeline = Pipeline([("preprocess", preprocessor), ("model", RandomForestClassifier(random_state=42))])

# 3. Split BEFORE any fitting happens
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

# 4. Tune hyperparameters with cross-validation, entirely within the pipeline
param_dist = {
    "model__n_estimators": randint(100, 400),
    "model__max_depth": randint(4, 20),
    "model__min_samples_leaf": randint(1, 8),
}
search = RandomizedSearchCV(
    pipeline, param_dist, n_iter=20, cv=StratifiedKFold(5, shuffle=True, random_state=42),
    scoring="roc_auc", n_jobs=-1, random_state=42,
)
search.fit(X_train, y_train)
print("Best params:", search.best_params_)

# 5. Final evaluation on the untouched test set
print(classification_report(y_test, search.best_estimator_.predict(X_test)))

# 6. Persist the WHOLE pipeline — preprocessing and model travel together
joblib.dump(search.best_estimator_, "churn_pipeline.joblib")

# 7. Simulate loading in a fresh process and scoring new, raw data (including a NaN and unseen-ish category)
loaded = joblib.load("churn_pipeline.joblib")
new_customer = pd.DataFrame({"age": [np.nan], "income": [55000], "region": ["North"], "tenure_months": [6]})
print("Predicted churn probability:", loaded.predict_proba(new_customer)[0, 1])
```

Notice what this buys you: the exact same missing-value imputation and one-hot encoding logic that was fit on training data is automatically applied to the brand-new customer at the end — with zero risk of accidentally recomputing statistics on data that includes the new point, and zero manual bookkeeping about which columns need which transform.

---

## 8. Advanced & Lesser-Known Techniques

- **`FeatureUnion` / `ColumnTransformer` with `remainder`**: by default `ColumnTransformer` drops columns not explicitly listed. Setting `remainder="passthrough"` keeps them untouched, and `remainder=SomeTransformer()` applies a default transform to everything else — useful when you have many similar numeric columns and don't want to list them all individually.
- **`set_output(transform="pandas")`**: as of recent scikit-learn versions, transformers can be configured to return a DataFrame (with proper column names) instead of a raw NumPy array — makes debugging a `ColumnTransformer` output dramatically easier.

```python
preprocessor.set_output(transform="pandas")
transformed_df = preprocessor.fit_transform(X_train)
print(transformed_df.columns.tolist())  # readable, prefixed column names instead of an opaque array
```

- **`Pipeline` with `memory` caching**: for expensive preprocessing steps repeated across many `GridSearchCV` fits, `Pipeline(steps=[...], memory="cache_dir")` caches the fitted transformer for a given set of hyperparameters, avoiding redundant recomputation.
- **`HalvingRandomSearchCV` / `HalvingGridSearchCV`**: successive halving search strategies that allocate more resources (more data, more iterations) to promising hyperparameter combinations and discard weak ones early — often faster than a plain randomized search for expensive models.
- **Nested pipelines for heterogeneous ensembles**: a `Pipeline` can itself be one estimator inside a `StackingClassifier` or `VotingClassifier`, letting you combine fully different preprocessing strategies per base model (e.g., one branch scales for an SVM, another doesn't bother because it feeds a tree).

---

## 9. Practice Exercises

1. Add a `DataFrameSelector`-style custom transformer that logs which columns pass through at each pipeline stage — insert it before and after your `ColumnTransformer` to visualize the trace.
2. Break the leakage rule on purpose: fit a `StandardScaler` on the full dataset before splitting, then compare the resulting test performance against the leak-free pipeline version. Quantify the (usually small but real) inflation.
3. Extend the `OutlierClipper` custom transformer from this sheet to accept a `strategy` parameter (`"percentile"` vs. `"iqr"`) and wire it into `GridSearchCV` to tune which strategy performs best.
4. Implement `GroupKFold` on a synthetic dataset with repeated user IDs and show concretely how a plain `StratifiedKFold` leaks user identity across folds while `GroupKFold` doesn't.
5. Save a fitted pipeline with `joblib`, then intentionally load it in an environment with a different scikit-learn minor version (e.g., via a separate virtual environment) — observe and document any warnings or failures this produces.

---

## 10. More Examples

### Example: A ColumnTransformer with different scalers per numeric group

```python
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, RobustScaler, MinMaxScaler

# Different numeric columns can need different scaling strategies —
# e.g., a column with extreme outliers benefits from RobustScaler over StandardScaler
mixed_scaling = ColumnTransformer([
    ("standard", StandardScaler(), ["age", "tenure_months"]),
    ("robust", RobustScaler(), ["income"]),        # income has long-tail outliers
    ("minmax", MinMaxScaler(), ["credit_score"]),  # bounded range, MinMax preserves that structure
])
```

### Example: Custom scoring function for GridSearchCV

```python
from sklearn.metrics import make_scorer, fbeta_score
from sklearn.model_selection import GridSearchCV
from sklearn.ensemble import RandomForestClassifier

# F2 score weights recall twice as heavily as precision — useful when missing a
# positive case is worse than a false alarm (see the Model Evaluation sheet)
f2_scorer = make_scorer(fbeta_score, beta=2)

grid = GridSearchCV(
    RandomForestClassifier(random_state=42),
    param_grid={"max_depth": [5, 10, 15]},
    scoring=f2_scorer,
    cv=5,
)
```

### Example: A transformer that engineers date features automatically

```python
from sklearn.base import BaseEstimator, TransformerMixin
import pandas as pd
import numpy as np

class DateFeatureExtractor(BaseEstimator, TransformerMixin):
    """Turns a single datetime column into cyclical day-of-week/month features, fitting into any Pipeline."""
    def __init__(self, date_column):
        self.date_column = date_column

    def fit(self, X, y=None):
        return self  # nothing to learn — this is a pure, stateless transform

    def transform(self, X):
        X = X.copy()
        dates = pd.to_datetime(X[self.date_column])
        X["day_of_week_sin"] = np.sin(2 * np.pi * dates.dt.dayofweek / 7)
        X["day_of_week_cos"] = np.cos(2 * np.pi * dates.dt.dayofweek / 7)
        X["month_sin"] = np.sin(2 * np.pi * dates.dt.month / 12)
        X["month_cos"] = np.cos(2 * np.pi * dates.dt.month / 12)
        return X.drop(columns=[self.date_column])
```

The cyclical sin/cos encoding here ties directly back to the Feature Engineering sheet's datetime section — December (12) and January (1) end up close together in this representation, exactly as they should be, unlike a raw integer month column.

---

## 11. Quick-Reference Cheat-Table

| Task | Tool |
|---|---|
| Chain preprocessing + model | `Pipeline` |
| Different transforms per column type | `ColumnTransformer` |
| Classification CV with class balance | `StratifiedKFold` |
| Repeated-entity CV (users, patients) | `GroupKFold` |
| Time-ordered CV | `TimeSeriesSplit` |
| Exhaustive small search | `GridSearchCV` |
| Larger/continuous search | `RandomizedSearchCV` |
| Custom preprocessing logic | `BaseEstimator` + `TransformerMixin` |
| Persist a fitted pipeline | `joblib.dump/load` |

## 12. FAQ

**Q: Do I need a `Pipeline` if I'm careful about ordering my code correctly?**
A: In theory no, in practice yes — a `Pipeline` makes leakage *structurally impossible* rather than relying on you remembering the right order every time, including inside cross-validation folds.

**Q: `ColumnTransformer` dropped my column I forgot to list — how do I keep it?**
A: Set `remainder="passthrough"` to keep unlisted columns unchanged, or `remainder=SomeTransformer()` to apply a default transform to everything else.

**Q: Why does `GroupKFold` matter if I'm already using `StratifiedKFold`?**
A: They solve different problems — stratification balances class ratios per fold; grouping prevents the same entity's rows from appearing in both train and test. You may need both simultaneously (`StratifiedGroupKFold`).

**Q: My custom transformer works in `fit_transform()` but breaks in `GridSearchCV` — why?**
A: Likely missing `get_params()`/`set_params()` support — inheriting `BaseEstimator` gives you this automatically; don't override `__init__` with `*args`/`**kwargs`.

**Q: Is `RandomizedSearchCV` strictly worse than `GridSearchCV`?**
A: No — for the same compute budget, random search typically finds better hyperparameters when only a few dimensions actually matter, since it doesn't waste trials on a full grid over unimportant ones.
