# Example 9: Real-Time Fraud Detection Streaming Pipeline

**Pipeline Type: Hybrid (ETL + ELT)** — the real-time Flink velocity features are transformed in-flight before serving (ETL); the historical features are loaded raw and transformed nightly in-warehouse via dbt before being pushed out (ELT).

## Scenario & Business Context

A payments company needs to score transactions for fraud risk within 200ms of the transaction occurring, using both real-time signals (velocity of transactions in the last 5 minutes) and precomputed historical features (customer's average transaction size).

## Architecture

```
Transaction Service → Kafka topic "transactions"
                            │
                ┌───────────┴────────────┐
                ▼                        ▼
        Flink job (real-time         Feature Store
        velocity features)           (precomputed historical
                │                     features, batch-updated)
                └───────────┬────────────┘
                             ▼
                  Fraud Scoring Service
                  (combines both feature sets, calls ML model)
                             │
                             ▼
                  Decision: approve / flag / block
                             │
                             ▼
              Kafka topic "fraud_decisions" → downstream systems
```

## Full Implementation

### 1. Real-time velocity features (Flink)

```sql
CREATE TABLE transactions (
  transaction_id STRING,
  customer_id STRING,
  amount DECIMAL(12,2),
  event_time TIMESTAMP(3),
  WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND
) WITH (
  'connector' = 'kafka', 'topic' = 'transactions', 'format' = 'avro'
);

-- Sliding 5-minute window: transaction count and total amount per customer
CREATE TABLE customer_velocity_features (
  customer_id STRING,
  window_end TIMESTAMP(3),
  txn_count_5min BIGINT,
  total_amount_5min DECIMAL(12,2)
) WITH (
  'connector' = 'upsert-kafka', 'topic' = 'customer_velocity_features'
);

INSERT INTO customer_velocity_features
SELECT
  customer_id,
  window_end,
  COUNT(*) AS txn_count_5min,
  SUM(amount) AS total_amount_5min
FROM TABLE(
  HOP(TABLE transactions, DESCRIPTOR(event_time), INTERVAL '30' SECOND, INTERVAL '5' MINUTE)
)
GROUP BY customer_id, window_end;
```

### 2. Historical features (batch, precomputed nightly, served via low-latency store)

```sql
-- dbt model, refreshed nightly, then pushed to a low-latency feature store (Redis/DynamoDB)
-- models/marts/fraud/customer_historical_features.sql
SELECT
  customer_id,
  AVG(amount)                        AS avg_transaction_amount_90d,
  STDDEV(amount)                     AS stddev_transaction_amount_90d,
  COUNT(DISTINCT merchant_id)        AS distinct_merchants_90d
FROM {{ ref('stg_transactions') }}
WHERE transaction_date >= CURRENT_DATE - 90
GROUP BY customer_id
```

```python
# Nightly job: push dbt output into Redis for low-latency lookup during scoring
def sync_features_to_redis():
    df = query_snowflake("SELECT * FROM marts.customer_historical_features")
    for _, row in df.iterrows():
        redis_client.hset(f"features:{row.customer_id}", mapping=row.to_dict())
```

### 3. Fraud scoring service (combines real-time + historical features)

```python
def score_transaction(transaction):
    velocity = kafka_consumer_get_latest("customer_velocity_features", transaction.customer_id)
    historical = redis_client.hgetall(f"features:{transaction.customer_id}")

    features = {
        "amount": transaction.amount,
        "txn_count_5min": velocity.get("txn_count_5min", 0),
        "amount_zscore": (transaction.amount - float(historical.get("avg_transaction_amount_90d", 0)))
                         / max(float(historical.get("stddev_transaction_amount_90d", 1)), 1),
        "is_new_merchant": transaction.merchant_id not in historical.get("known_merchants", []),
    }

    risk_score = ml_model.predict_proba(features)

    if risk_score > 0.9:
        decision = "block"
    elif risk_score > 0.6:
        decision = "flag"
    else:
        decision = "approve"

    publish_decision(transaction.transaction_id, decision, risk_score)
    return decision
```

### 4. Monitoring model drift

```sql
-- Daily check: has the distribution of risk scores shifted meaningfully?
-- A sudden shift may indicate model drift or a change in fraud patterns.
SELECT
  DATE(scored_at) AS score_date,
  AVG(risk_score) AS avg_risk_score,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY risk_score) AS p95_risk_score
FROM fraud_decisions
GROUP BY DATE(scored_at)
ORDER BY score_date DESC
LIMIT 14;
```

## Design Rationale

- **Split real-time vs historical features** — velocity (last 5 minutes) genuinely needs streaming freshness, while a customer's 90-day average transaction size doesn't change meaningfully minute-to-minute; computing it via nightly batch and serving from Redis avoids unnecessary streaming compute cost (see file 06 — Lambda-style split).
- **Sliding window (`HOP`) rather than tumbling** for velocity — fraud patterns are about recent behavior *right now*, and a sliding window updates every 30 seconds rather than waiting for a fixed window boundary to close, reducing detection latency (see file 06 — Windowing Strategies).
- **Upsert-kafka sink** for velocity features keeps only the latest value per customer, avoiding unbounded topic growth from a naturally overlapping/updating feature.
- **Explicit decision thresholds returned alongside raw risk score** — supports auditability; a flagged transaction can always be traced back to the exact score and feature values that triggered it.

## Production Considerations

- **Feature store staleness** — if the nightly historical feature sync fails, the scoring service should fail safe (e.g., fall back to a conservative default) rather than scoring against stale or missing data silently.
- **Latency budget** — with a 200ms target, feature store reads (Redis) must be sub-10ms; avoid synchronous calls to slower systems (e.g., a live SQL query) in the scoring hot path.
- **Model drift monitoring** is not optional in fraud — attacker behavior adapts, so score distributions should be reviewed regularly, not treated as a "set and forget" model.

## How to Extend This Example

- Add a **shadow-mode deployment** for new model versions — score transactions with both old and new models, log both, but only act on the old model's decision until the new model is validated against real outcomes.
- Feed confirmed fraud outcomes (chargebacks, manual review results) back into a **labeled training dataset** pipeline to continuously retrain the model (see file 08 — Architecture Patterns, feedback loops).
- Add **explainability logging** (e.g., SHAP values) alongside each decision so flagged transactions can be reviewed by a human fraud analyst with context on *why* the model flagged them.
