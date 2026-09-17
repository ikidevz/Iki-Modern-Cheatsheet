# Feature Stores & ML Data Pipelines Cheatsheet

## Overview

This sheet covers the data engineering layer purpose-built for ML: feature stores as the bridge between offline training and online serving, batch vs. streaming feature computation, and the training/serving skew that breaks models in production despite passing every offline test.

```bash
pip install feast --break-system-packages
```

---

## 1. Feature Store Concepts: Offline Store vs. Online Store

| | Offline store | Online store |
|---|---|---|
| Purpose | Historical features for training | Low-latency features for real-time inference |
| Typical backend | Data warehouse (BigQuery, Snowflake, S3/Parquet) | Key-value store (Redis, DynamoDB) |
| Query pattern | Large batch reads, point-in-time joins | Single-key lookups, milliseconds latency |
| Data volume | Full history | Latest value(s) per entity |

```python
# Feast feature definitions — the same feature definition serves BOTH stores,
# which is the whole point: one source of truth for "how is this feature computed"
from feast import Entity, FeatureView, Field, FileSource
from feast.types import Float32, Int64
from datetime import timedelta

customer = Entity(name="customer_id", join_keys=["customer_id"])

customer_stats_source = FileSource(
    path="data/customer_stats.parquet",
    timestamp_field="event_timestamp",
)

customer_features = FeatureView(
    name="customer_stats",
    entities=[customer],
    ttl=timedelta(days=1),
    schema=[
        Field(name="avg_transaction_amount", dtype=Float32),
        Field(name="transaction_count_7d", dtype=Int64),
    ],
    source=customer_stats_source,
)
```

**Why both stores exist:** training needs to efficiently scan potentially years of historical data to build a training set (a job that can take minutes and doesn't need to be fast per-row). Serving needs to fetch a single customer's current feature values in milliseconds while a user waits for a response. No single database is well-suited to both access patterns, which is why feature stores maintain two synchronized backends behind one feature definition.

---

## 2. Point-in-Time Correctness

The single most common — and most dangerous — leakage source in ML pipelines: joining a feature's *current* value to a historical training label, when the feature's value has since changed.

```python
import pandas as pd

# WRONG: joining today's feature value to a label from 6 months ago
# leaks information the model would never have had access to at prediction time back then
def naive_join_LEAKY(labels_df, features_df):
    return labels_df.merge(features_df, on="customer_id")  # ignores timestamps entirely!

# RIGHT: point-in-time join — for each label, use only feature values
# that were VALID as of that label's timestamp, not the current value
def point_in_time_join(labels_df, features_df):
    merged = pd.merge_asof(
        labels_df.sort_values("label_timestamp"),
        features_df.sort_values("feature_timestamp"),
        left_on="label_timestamp",
        right_on="feature_timestamp",
        by="customer_id",
        direction="backward",  # only look BACKWARD in time — never use a feature value from the future
    )
    return merged

labels = pd.DataFrame({
    "customer_id": [1, 1, 2],
    "label_timestamp": pd.to_datetime(["2026-01-15", "2026-03-01", "2026-02-10"]),
    "churned": [0, 1, 0],
})
features = pd.DataFrame({
    "customer_id": [1, 1, 1, 2],
    "feature_timestamp": pd.to_datetime(["2026-01-01", "2026-02-01", "2026-03-01", "2026-01-01"]),
    "avg_spend": [100, 150, 200, 80],
})

correct_training_set = point_in_time_join(labels, features)
print(correct_training_set)
# Customer 1's Jan 15 label correctly gets the Jan 1 feature value (150 or 200 would be leakage)
```

**Feast and similar feature stores implement this point-in-time join logic automatically** via `get_historical_features()` — this is one of the core value propositions of using a feature store rather than hand-rolling training set construction, since the leakage bug above is extremely easy to introduce accidentally and hard to notice (the model still trains and produces plausible-looking metrics).

---

## 3. Batch vs. Streaming Feature Computation

```python
# Batch computation: e.g., a nightly Spark/SQL job aggregating the last 7 days of transactions
batch_feature_sql = """
SELECT
    customer_id,
    AVG(amount) as avg_transaction_amount_7d,
    COUNT(*) as transaction_count_7d,
    CURRENT_TIMESTAMP() as event_timestamp
FROM transactions
WHERE transaction_date >= CURRENT_DATE - INTERVAL 7 DAY
GROUP BY customer_id
"""

# Streaming computation: e.g., a Flink/Kafka Streams job maintaining a running aggregate
# as new transaction events arrive, updated continuously rather than on a batch schedule
streaming_feature_logic = """
transactions_stream
    .keyBy(customer_id)
    .window(SlidingWindow(size=7.days, slide=1.hour))
    .aggregate(avg_amount, count)
    .sink(online_feature_store)
"""
```

**Keeping the two consistent:** the danger is defining "average transaction amount, last 7 days" slightly differently in the nightly batch job (which computes it once at midnight) versus the streaming job (which updates it continuously) — even a subtle difference in window boundaries or timezone handling produces two different numbers for "the same" feature, silently corrupting the model's inputs depending on which pipeline happens to serve a given request.

---

## 4. Training/Serving Skew

```python
# A classic skew source: different code paths compute "days since last purchase" differently
def training_time_feature(df):
    # Computed in pandas, using UTC timestamps from the batch warehouse
    return (df["snapshot_date"] - df["last_purchase_date"]).dt.days

def serving_time_feature_BUGGY(request_time, last_purchase_timestamp):
    # Computed in application code, using LOCAL server time — a subtle, easy-to-miss mismatch
    from datetime import datetime
    return (datetime.now() - last_purchase_timestamp).days  # BUG: not UTC-normalized like training!

# FIX: extract the feature computation into ONE shared function/library used by both paths
def days_since_last_purchase(reference_timestamp_utc, last_purchase_timestamp_utc):
    return (reference_timestamp_utc - last_purchase_timestamp_utc).days
# Both the training pipeline and the serving pipeline call THIS function — eliminating the
# possibility of the two paths silently diverging
```

**Why this is one of the most insidious production ML bugs:** the model trains fine, offline evaluation looks fine (because the offline eval typically reuses the training pipeline's feature computation), and it's only in production — when the *serving* pipeline's subtly different feature values reach the model — that performance quietly degrades, often without any obvious error or crash to alert you.

---

## 5. Popular Tooling

| Tool | Notes |
|---|---|
| Feast | Open-source, flexible backend choice (works with your existing warehouse + a KV store), widely adopted |
| Tecton | Managed, enterprise-focused, strong streaming feature support |
| Databricks Feature Store | Tightly integrated if already on the Databricks/Spark ecosystem |
| SageMaker Feature Store | Native integration if already on AWS/SageMaker |

**When a feature store is overkill:** if your model has a handful of features computed simply from data already colocated with your serving infrastructure, and training/serving skew hasn't actually bitten you, the operational overhead of standing up a dedicated feature store may not be worth it yet. It earns its keep as feature count grows, multiple models start sharing features, or a skew bug has already cost you a production incident.

---

## 6. Versioning Features Alongside Models

```python
# A feature's DEFINITION can change over time (e.g., "7-day average" becomes "14-day average") —
# this needs to be versioned just like model code, or reproducing an old model becomes impossible
feature_definition_v1 = {"name": "avg_transaction_amount", "window": "7d", "version": 1}
feature_definition_v2 = {"name": "avg_transaction_amount", "window": "14d", "version": 2}

# A model manifest should reference the EXACT feature version(s) it was trained against
model_manifest = {
    "model_version": "churn_predictor_v3",
    "feature_versions": {"avg_transaction_amount": 2, "transaction_count_7d": 1},
}
```

Without this, retraining a model six months later using a feature store where someone quietly redefined a feature's aggregation window produces a model that looks like a fair comparison to the old one but was actually trained on meaningfully different inputs — a subtle reproducibility failure.

## Common Pitfalls

- **Joining current feature values to historical labels** — the single most common leakage source in ML pipelines; always use point-in-time-correct joins.
- **Defining the same feature independently in batch and streaming/serving code paths** — even small definitional differences (timezone handling, window boundaries) cause skew that's very hard to detect from metrics alone.
- **Not versioning feature definitions** — makes old models impossible to honestly reproduce or compare against once feature logic changes.
- **Assuming offline evaluation catches training/serving skew** — it usually doesn't, since offline eval typically reuses the training pipeline's own feature computation, not the actual serving path.
- **Standing up a full feature store before you need one** — for small feature sets with no skew history, the operational complexity may not pay for itself yet.

---

## 7. End-to-End Worked Example: Point-in-Time-Correct Training Set Construction at Scale

```python
import pandas as pd
import numpy as np

np.random.seed(42)

# Simulate a realistic scenario: 500 customers, feature snapshots taken weekly,
# labels (did they churn in the following 30 days) generated at various points in time
customers = np.arange(500)
feature_dates = pd.date_range("2026-01-01", "2026-06-01", freq="W")

feature_rows = []
for customer in customers:
    base_engagement = np.random.uniform(0, 1)
    for date in feature_dates:
        # Engagement drifts slowly over time per customer, plus noise
        engagement = np.clip(base_engagement + np.random.normal(0, 0.05), 0, 1)
        feature_rows.append({"customer_id": customer, "feature_timestamp": date, "engagement_score": engagement})
features_df = pd.DataFrame(feature_rows)

# Labels generated at IRREGULAR points in time (e.g., whenever a customer's contract came up for renewal)
n_labels = 800
label_rows = []
for _ in range(n_labels):
    customer = np.random.choice(customers)
    label_date = np.random.choice(pd.date_range("2026-02-01", "2026-06-01", freq="D"))
    churned = np.random.binomial(1, 0.15)
    label_rows.append({"customer_id": customer, "label_timestamp": label_date, "churned": churned})
labels_df = pd.DataFrame(label_rows)

def build_training_set(labels_df, features_df):
    """Point-in-time-correct join: for each label, find the MOST RECENT feature snapshot
    that existed BEFORE the label was generated — never a snapshot from after."""
    training_rows = []
    features_by_customer = {cid: g.sort_values("feature_timestamp") for cid, g in features_df.groupby("customer_id")}

    for _, label_row in labels_df.iterrows():
        customer_features = features_by_customer.get(label_row["customer_id"])
        if customer_features is None:
            continue
        valid_features = customer_features[customer_features["feature_timestamp"] <= label_row["label_timestamp"]]
        if valid_features.empty:
            continue  # no feature snapshot existed yet at label time — correctly excluded, not filled with future data
        latest_valid = valid_features.iloc[-1]
        training_rows.append({
            "customer_id": label_row["customer_id"],
            "label_timestamp": label_row["label_timestamp"],
            "engagement_score": latest_valid["engagement_score"],
            "feature_age_days": (label_row["label_timestamp"] - latest_valid["feature_timestamp"]).days,
            "churned": label_row["churned"],
        })
    return pd.DataFrame(training_rows)

training_set = build_training_set(labels_df, features_df)
print(f"Training set size: {len(training_set)} (dropped {n_labels - len(training_set)} labels with no valid prior feature)")
print(f"Average feature staleness at label time: {training_set['feature_age_days'].mean():.1f} days")
print(training_set.head())
```

**The `feature_age_days` column earns its place here deliberately:** it surfaces something the naive version of this pipeline hides — how STALE the feature actually was at prediction time. If this averages 6 days in training but the real-time serving path always uses a feature computed within the last hour, that's a systematic difference between training and serving conditions worth investigating (a milder, harder-to-spot cousin of the training/serving skew problem in section 4 of the base sheet).

---

## 8. Advanced & Lesser-Known Techniques

- **Feature freshness SLAs**: define and monitor an explicit maximum acceptable staleness per feature (e.g., "this feature must be no more than 1 hour old at serving time") — treats feature timeliness as a measurable operational property, not an afterthought, and lets you catch a broken upstream pipeline before it silently degrades model inputs.
- **Backfilling historical features for new feature definitions**: when a new feature is added to a feature store, it typically has no historical values — backfilling computes what the feature *would have been* at past points in time, enabling retraining with the new feature without waiting weeks/months to accumulate fresh history.
- **Feature drift vs. schema drift**: beyond statistical drift in a feature's values (covered in the MLOps sheet), watch for *schema* drift — a feature silently changing type (int to float), a categorical feature gaining new unseen values, or a previously non-nullable field starting to contain nulls — often caused by an upstream data source change rather than genuine real-world drift.
- **On-demand/streaming transformations at request time**: some features can't be precomputed (e.g., "similarity between this specific search query and this specific document") — feature stores increasingly support registering these as on-demand transformations computed at request time from raw inputs, rather than requiring everything to be precomputed and stored.

---

## 9. Practice Exercises

1. Modify the worked example so some feature snapshots are deliberately delayed (simulating a slow upstream pipeline) and measure how `feature_age_days` changes — then set a freshness SLA and flag labels whose matched feature violates it.
2. Introduce a schema drift scenario (a feature that starts as a clean float column, then a batch of records has it arrive as a string) and write a validation check that would have caught it before it reached model training.
3. Implement a backfill function that computes what an engagement-score-like feature "would have been" at 5 specific past dates, using only data available up to each respective date.
4. Extend the point-in-time join function to support MULTIPLE feature tables (e.g., add a second `transaction_count` feature source) merged correctly by timestamp for each label.
5. Simulate the training/serving skew bug from this sheet directly: implement two slightly different versions of a "days since last login" feature (one UTC-based, one using local server time) and quantify how often they disagree on a simulated dataset spanning multiple timezones.

---

## 10. More Examples

### Example: Fetching historical features for training via Feast

```python
from feast import FeatureStore

store = FeatureStore(repo_path=".")

# entity_df provides the (entity_id, event_timestamp) pairs to join against —
# Feast handles the point-in-time-correct join automatically under the hood
entity_df = pd.DataFrame({
    "customer_id": [1, 2, 3],
    "event_timestamp": pd.to_datetime(["2026-01-15", "2026-02-01", "2026-01-20"]),
})

training_df = store.get_historical_features(
    entity_df=entity_df,
    features=["customer_stats:avg_transaction_amount", "customer_stats:transaction_count_7d"],
).to_df()
print(training_df)
```

### Example: Fetching online features for real-time serving

```python
# At SERVING time, fetch the LATEST feature values for a specific entity — low latency, single lookup
online_features = store.get_online_features(
    features=["customer_stats:avg_transaction_amount", "customer_stats:transaction_count_7d"],
    entity_rows=[{"customer_id": 1}],
).to_dict()
print(online_features)
# This calls the SAME feature definitions as get_historical_features above — the whole point
# of a feature store is that training and serving never diverge in how a feature is computed
```

### Example: A simple feature validation check before writing to the feature store

```python
import pandas as pd
import numpy as np

def validate_feature_freshness(feature_df, timestamp_col, max_staleness_hours=1):
    now = pd.Timestamp.now(tz="UTC")
    staleness = (now - feature_df[timestamp_col]).dt.total_seconds() / 3600
    stale_rows = (staleness > max_staleness_hours).sum()
    if stale_rows > 0:
        print(f"WARNING: {stale_rows} rows exceed the {max_staleness_hours}h freshness SLA")
    return stale_rows == 0

feature_batch = pd.DataFrame({
    "customer_id": [1, 2, 3],
    "feature_timestamp": pd.to_datetime(["2026-09-14 10:00", "2026-09-14 09:00", "2026-09-13 08:00"], utc=True),
})
validate_feature_freshness(feature_batch, "feature_timestamp", max_staleness_hours=2)
```

---

## 11. Quick-Reference Cheat-Table

| Situation | Action |
|---|---|
| Joining features to historical labels | Always use point-in-time-correct joins |
| Feature computed differently in batch vs. streaming | Extract shared logic into one function used by both |
| Small feature set, no skew history | A feature store may be overkill — plain code may suffice |
| Growing feature count, multiple models sharing features | Feature store earns its keep |
| Feature definition changes over time | Version it, and reference the exact version in the model manifest |
| New feature needs historical values | Backfill computation |

## 12. FAQ

**Q: What's the single most common leakage bug in ML pipelines?**
A: Joining a feature's CURRENT value to a historical label, instead of the value that existed AT the label's timestamp. Always use point-in-time joins.

**Q: Do I need a feature store for a small project?**
A: Not necessarily — the overhead may not be worth it until you have many features, multiple models sharing them, or have already been bitten by a training/serving skew bug.

**Q: My model trains fine and evaluates fine but performs worse in production — why?**
A: Likely training/serving skew — a feature computed subtly differently in the serving path than in training. Consolidate into one shared computation function.

**Q: Batch or streaming feature computation — which should I use?**
A: Batch for features that don't need to be extremely fresh (daily aggregates); streaming for features needing near-real-time updates. Keep both definitions synchronized carefully if you use both.

**Q: Why version feature definitions, not just model code?**
A: A feature's definition can change (e.g., window length) independent of model code — without versioning, reproducing an old model honestly becomes impossible.
