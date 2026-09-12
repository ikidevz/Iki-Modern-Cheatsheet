# 🤖 Snowpark, Cortex & ML

> Lower priority for a pure data-engineering role, but this is the surface you'll hit when DE work meets ML handoff — Snowpark for compute-pushdown Python, Cortex for zero-infra LLM calls, Model Registry for serving.

---

## 1. Snowpark (DataFrame API that compiles to SQL, runs in-warehouse)

The core idea: write Python/Scala/Java that **never leaves Snowflake's compute** — no data egress, no separate Spark cluster.

```python
from snowflake.snowpark import Session
from snowflake.snowpark.functions import col, sum_

session = Session.builder.configs({
    "account": "myaccount", "user": "svc_user",
    "role": "TRANSFORMER_ROLE", "warehouse": "TRANSFORM_WH",
    "database": "SALES_DB", "schema": "PUBLIC",
    "private_key_path": "/path/rsa_key.p8"
}).create()

# DataFrame API — lazy, compiles down to SQL, executes on the warehouse (not client-side)
df = session.table("orders") \
    .filter(col("order_date") > "2026-01-01") \
    .group_by("customer_id") \
    .agg(sum_("amount").alias("total_spend"))

df.show()                 # triggers execution
df.write.save_as_table("customer_totals", mode="overwrite")

# Inspect the generated SQL without executing (useful for debugging/optimization)
print(df.queries["queries"][0])

# Joins, same lazy-pushdown behavior as filters/aggregates
customers_df = session.table("customers")
joined = df.join(customers_df, df["customer_id"] == customers_df["customer_id"])
```

> 🔑 **Why this matters vs. pulling data into pandas:** `df.to_pandas()` pulls everything into client memory — fine for small results, a mistake for anything table-sized. Snowpark keeps transformations pushed down and executing inside the warehouse; only call `.to_pandas()`/`.collect()` on already-aggregated, small results.

### 1.1 Snowpark DataFrame Reader/Writer Options

```python
# Reading from a stage directly into a DataFrame (schema inference for semi-structured)
df = session.read.option("compression", "gzip").json("@my_stage/events/")

# Writing with explicit mode control
df.write.mode("append").save_as_table("orders_history")
df.write.mode("overwrite").save_as_table("orders_snapshot")

# Writing to a temp/transient table for pipeline intermediates
df.write.save_as_table("scratch_calc", table_type="temporary")
```

---

## 2. User-Defined Functions & Procedures (UDFs/UDTFs/Stored Procs)

```python
from snowflake.snowpark.functions import udf
from snowflake.snowpark.types import StringType

@udf(name="mask_email", is_permanent=True, stage_location="@my_stage", replace=True)
def mask_email(email: str) -> str:
    return email.split("@")[0][:2] + "***@" + email.split("@")[1]
```

```sql
-- Once registered, it's callable as plain SQL — this is how Python logic gets exposed to analysts
SELECT mask_email(email) FROM customers;
```

```python
# Vectorized UDFs (process a batch of rows via pandas Series — much faster than row-by-row)
from snowflake.snowpark.functions import pandas_udf
import pandas as pd

@pandas_udf(name="bulk_score", is_permanent=True, stage_location="@my_stage", replace=True)
def bulk_score(amounts: pd.Series) -> pd.Series:
    return amounts * 1.1

# Stored procedures for multi-step orchestration logic that needs to run server-side
from snowflake.snowpark.functions import sproc

@sproc(name="rebuild_summary", is_permanent=True, stage_location="@my_stage", replace=True)
def rebuild_summary(session: Session) -> str:
    session.sql("TRUNCATE TABLE orders_summary").collect()
    session.table("orders").group_by("customer_id").agg(sum_("amount")).write.save_as_table("orders_summary", mode="append")
    return "done"
```

```sql
CALL rebuild_summary();

-- Wire a stored proc into a Task for scheduled server-side pipelines
CREATE TASK refresh_summary_task
    WAREHOUSE = etl_wh
    SCHEDULE = 'USING CRON 0 * * * * UTC'
AS
CALL rebuild_summary();
```

### 2.1 UDTFs (table functions — one input row, multiple output rows)

```python
from snowflake.snowpark.functions import udtf
from snowflake.snowpark.types import StructType, StructField, StringType

@udtf(output_schema=StructType([StructField("word", StringType())]))
class SplitWords:
    def process(self, text: str):
        for word in text.split():
            yield (word,)

session.udtf.register(SplitWords, name="split_words", is_permanent=True, stage_location="@my_stage")
```

```sql
SELECT t.word FROM support_tickets, TABLE(split_words(complaint_text)) t;
```

---

## 3. Snowpark Container Services (custom runtime beyond Python UDFs)

For workloads that don't fit the UDF/stored-procedure model (custom ML serving images, long-running services, GPU workloads):

```yaml
# spec.yaml
spec:
  containers:
    - name: model-server
      image: /sales_db/public/my_repo/model-server:latest
      resources:
        requests:
          nvidia.com/gpu: 1
  endpoints:
    - name: api
      port: 8000
      public: true
```

```bash
snow spcs image-repository create my_repo
docker push <repo_url>/model-server:latest
snow spcs service create model_service --spec-path spec.yaml --compute-pool gpu_pool
```

```sql
CREATE COMPUTE POOL gpu_pool
    MIN_NODES = 1 MAX_NODES = 2
    INSTANCE_FAMILY = GPU_NV_S;

SHOW SERVICES;
SELECT SYSTEM$GET_SERVICE_STATUS('model_service');
```

> Use Container Services when a workload genuinely needs a custom runtime/GPU/long-running process that a Python UDF can't provide — for most feature engineering and standard model training, Snowpark ML (below) is simpler and sufficient.

---

## 4. Snowpark ML (feature engineering + model training, in-warehouse)

```python
from snowflake.ml.modeling.preprocessing import StandardScaler
from snowflake.ml.modeling.linear_model import LogisticRegression
from snowflake.ml.modeling.model_selection import GridSearchCV

# Preprocessing runs distributed on the warehouse, not client-side
scaler = StandardScaler(input_cols=["amount", "tenure_days"], output_cols=["amount_s", "tenure_s"])
scaled_df = scaler.fit(df).transform(df)

model = LogisticRegression(input_cols=["amount_s", "tenure_s"], label_cols=["churned"], output_cols=["prediction"])
model.fit(scaled_df)
predictions = model.predict(scaled_df)

# Hyperparameter search, distributed across the warehouse
grid = GridSearchCV(
    estimator=LogisticRegression(input_cols=["amount_s", "tenure_s"], label_cols=["churned"]),
    param_grid={"C": [0.1, 1.0, 10.0]},
)
grid.fit(scaled_df)
```

---

## 5. Feature Store

```python
from snowflake.ml.feature_store import FeatureStore, FeatureView, Entity

fs = FeatureStore(session=session, database="SALES_DB", name="FEATURE_STORE", default_warehouse="TRANSFORM_WH")

customer_entity = Entity(name="customer", join_keys=["customer_id"])
fs.register_entity(customer_entity)

fv = FeatureView(
    name="customer_spend_features",
    entities=[customer_entity],
    feature_df=session.table("orders").group_by("customer_id").agg(sum_("amount").alias("total_spend")),
    refresh_freq="1 day"   # backed by a Dynamic Table under the hood
)
fs.register_feature_view(fv)

# Retrieve features for training (point-in-time correct joins handled automatically)
training_data = fs.generate_dataset(spine_df=labels_df, features=[fv])

# Online retrieval for real-time inference (low-latency feature lookup)
online_features = fs.retrieve_feature_values(spine_df=inference_spine, features=[fv])
```

> 🔑 **What the Feature Store actually solves:** point-in-time-correct joins between label data and feature history (avoiding training/serving skew and label leakage) — it's backed by Dynamic Tables, so freshness follows the same `TARGET_LAG` model you already know.

---

## 6. Model Registry

```python
from snowflake.ml.registry import Registry

reg = Registry(session=session, database_name="SALES_DB", schema_name="MODELS")

model_ref = reg.log_model(
    model=model,
    model_name="churn_model",
    version_name="v1",
    conda_dependencies=["scikit-learn"],
    metrics={"accuracy": 0.87, "auc": 0.91}
)

# Serve predictions directly in SQL — no separate serving infra to stand up
```

```sql
SELECT churn_model!predict(amount_s, tenure_s) FROM customer_features;
```

```python
# Model versioning & comparison
reg.get_model("churn_model").show_versions()
reg.get_model("churn_model").default = "v1"

# Compare metrics across versions before promoting
m = reg.get_model("churn_model")
for v in m.show_versions()["name"]:
    print(v, m.version(v).get_metric("auc"))
```

---

## 7. Cortex AI Functions (zero-infra LLM calls, billed per-token/call)

The fastest path from "I have data in a table" to "I have an LLM opinion about that data" — no endpoint to deploy, no API key to manage outside Snowflake.

```sql
-- General-purpose LLM completion
SELECT SNOWFLAKE.CORTEX.COMPLETE(
    'llama3.1-70b',
    'Summarize this customer complaint in one sentence: ' || complaint_text
) AS summary
FROM support_tickets;

-- Sentiment scoring (returns -1 to 1)
SELECT ticket_id, SNOWFLAKE.CORTEX.SENTIMENT(complaint_text) AS sentiment
FROM support_tickets;

-- Translation
SELECT SNOWFLAKE.CORTEX.TRANSLATE(review_text, 'es', 'en') FROM reviews;

-- Summarization built-in (no prompt engineering needed for the basic case)
SELECT SNOWFLAKE.CORTEX.SUMMARIZE(long_transcript) FROM call_transcripts;

-- Structured extraction — pull typed fields out of unstructured text
SELECT SNOWFLAKE.CORTEX.EXTRACT_ANSWER(complaint_text, 'What product was affected?')
FROM support_tickets;

-- Batch-friendly usage inside a Dynamic Table (enrichment pipeline, auto-refreshing)
CREATE DYNAMIC TABLE enriched_tickets
    TARGET_LAG = '1 hour' WAREHOUSE = etl_wh
AS
SELECT
    ticket_id,
    complaint_text,
    SNOWFLAKE.CORTEX.SENTIMENT(complaint_text) AS sentiment,
    SNOWFLAKE.CORTEX.COMPLETE('llama3.1-70b', 'Categorize this complaint in one word: ' || complaint_text) AS category
FROM support_tickets;

-- Cortex Search — managed vector search / retrieval over Snowflake tables (RAG building block)
CREATE CORTEX SEARCH SERVICE support_search
    ON complaint_text
    WAREHOUSE = search_wh
    TARGET_LAG = '1 hour'
AS
    SELECT ticket_id, complaint_text FROM support_tickets;

-- Query it
SELECT * FROM TABLE(
    support_search!SEARCH('billing issue refund', 5)   -- top 5 semantically relevant rows
);

-- Cortex Analyst — natural-language-to-SQL over a defined semantic model (self-serve BI on top of Cortex)
```

> 🔑 **Why a DE cares about Cortex specifically:** these are plain SQL functions — they slot directly into existing `SELECT`/`Task`/`Dynamic Table` pipelines with zero new infrastructure, unlike standing up a separate model-serving endpoint. This is often the fastest way to add "AI enrichment" to an existing ELT pipeline without an ML platform project.

### 7.1 Cortex Fine-Tuning

```sql
-- Fine-tune a base model on your own labeled data, still fully in-Snowflake
SELECT SNOWFLAKE.CORTEX.FINETUNE(
    'CREATE',
    'my_custom_classifier',
    'llama3.1-8b',
    'SELECT prompt, completion FROM training_data'
);

SELECT SNOWFLAKE.CORTEX.FINETUNE('DESCRIBE', 'my_custom_classifier');
```

---

## 8. External Functions (calling out to non-Snowflake services)

For logic that must live outside Snowflake (a proprietary scoring API, a legacy system call):

```sql
CREATE API INTEGRATION my_api_integration
    API_PROVIDER = aws_api_gateway
    API_AWS_ROLE_ARN = 'arn:aws:iam::123456789:role/my-role'
    ENABLED = TRUE
    API_ALLOWED_PREFIXES = ('https://xyz.execute-api.us-east-1.amazonaws.com/');

CREATE EXTERNAL FUNCTION call_scoring_api(input STRING)
    RETURNS STRING
    API_INTEGRATION = my_api_integration
    AS 'https://xyz.execute-api.us-east-1.amazonaws.com/prod/score';

SELECT call_scoring_api(customer_features) FROM customers;
```

> Use sparingly — every row triggers a network call, which is far slower and more expensive than an in-warehouse UDF. Reserve for logic that genuinely cannot be replicated inside Snowflake (proprietary external systems, licensed third-party scoring engines).

---

## 9. Cost Awareness for This Category

```sql
-- Cortex function usage & credit cost — separate line item from warehouse compute
SELECT function_name, SUM(token_credits) AS credits
FROM snowflake.account_usage.cortex_functions_usage_history
WHERE start_time > DATEADD('day', -30, CURRENT_TIMESTAMP())
GROUP BY 1
ORDER BY 2 DESC;

-- Container Services compute pool cost
SELECT compute_pool_name, SUM(credits_used) AS credits
FROM snowflake.account_usage.compute_pool_metering_history
WHERE start_time > DATEADD('day', -30, CURRENT_TIMESTAMP())
GROUP BY 1;
```

> 🔑 **Cost gotcha:** running `SNOWFLAKE.CORTEX.COMPLETE()` inside a Dynamic Table or Task on a large, frequently-refreshing table means re-scoring every row on every refresh unless the query is written to only process *new* rows (e.g., joined against a Stream, or filtered on a watermark column) — an easy way to silently rack up large token costs.

---

## 10. Quick Reference: Databricks ↔ Snowflake ML

| Databricks concept | Snowflake equivalent |
|---|---|
| Spark DataFrame API | Snowpark DataFrame API |
| MLflow Tracking | Snowpark ML experiment tracking (`snowflake.ml.registry`) |
| MLflow Model Registry | Snowflake Model Registry |
| Databricks Feature Store | Snowflake Feature Store |
| Model Serving endpoints | `model!predict()` inline SQL calls, or Snowpark Container Services for custom serving |
| Databricks Foundation Model APIs | Cortex `COMPLETE` / `SUMMARIZE` / `SENTIMENT` |
| Vector Search (Databricks) | Cortex Search |
| Genie (NL-to-SQL) | Cortex Analyst |
| Databricks Model Serving (custom containers) | Snowpark Container Services |
| Pandas UDFs (Spark) | `@pandas_udf` (Snowpark) |

---

## 11. Interview / Self-Check Q&A

**Q: Why is calling `.to_pandas()` early in a Snowpark pipeline usually a mistake?**
A: It pulls the full result set out of Snowflake's compute into client memory, forfeiting the pushdown execution Snowpark is designed for — it should be called only on already-small, aggregated results, not on raw or lightly-filtered tables.

**Q: When would you reach for Snowpark Container Services instead of a Python UDF?**
A: When the workload needs a custom runtime, GPU access, or a long-running service process that the sandboxed UDF execution model can't support — most standard feature engineering and model scoring fits comfortably inside UDFs/Snowpark ML.

**Q: What specific problem does the Feature Store solve that a plain Dynamic Table of features wouldn't?**
A: Point-in-time-correct joins between labels and historical feature values, preventing label leakage — a naive join against the latest feature values would let a model "see the future" relative to when a label was actually generated.

**Q: Why should you be cautious about calling `SNOWFLAKE.CORTEX.COMPLETE()` inside a Dynamic Table defined over a large base table?**
A: Without careful incremental filtering, every refresh re-scores every row from scratch, since Cortex functions are non-deterministic/not incrementally cacheable by the optimizer in the same way — this can silently multiply token costs on every refresh cycle.

**Q: Why would you use an External Function instead of just writing the logic as a Snowpark UDF?**
A: Only when the logic must genuinely live outside Snowflake — a proprietary third-party API, a legacy system with no portable equivalent — since External Functions incur per-row network call overhead and cost far more than in-warehouse UDF execution.
