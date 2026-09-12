# MLflow & ML Cheatsheet

> The end-to-end ML lifecycle on Databricks — experiment tracking, model packaging, registry/governance, serving, feature management, and GenAI/LLMOps.

---

## 1. MLflow's Four Components

| Component | Purpose |
|-----------|---------|
| **Tracking** | Log parameters, metrics, artifacts, and models from training runs |
| **Projects** | Packaging format for reproducible runs (less commonly used standalone on Databricks, since jobs/bundles serve a similar purpose) |
| **Models** | Standard format for packaging models from any framework for downstream deployment |
| **Model Registry** | Versioned, governed store of models with stage/alias management (now unified with Unity Catalog) |

---

## 2. Experiment Tracking

```python
import mlflow

mlflow.set_experiment("/Users/me/churn-model")

with mlflow.start_run(run_name="rf-baseline"):
    mlflow.log_param("n_estimators", 100)
    mlflow.log_param("max_depth", 8)

    model.fit(X_train, y_train)
    preds = model.predict(X_test)

    mlflow.log_metric("accuracy", accuracy_score(y_test, preds))
    mlflow.log_metric("f1", f1_score(y_test, preds))

    mlflow.log_artifact("confusion_matrix.png")
    mlflow.sklearn.log_model(
        model,
        artifact_path="model",
        registered_model_name="catalog.schema.churn_model",
        signature=mlflow.models.infer_signature(X_train, preds),
        input_example=X_train.iloc[:5]
    )
```

**Nested runs** — useful for hyperparameter sweeps or multi-step pipelines where you want a parent run summarizing many child runs:
```python
with mlflow.start_run(run_name="hp_sweep") as parent:
    for depth in [4, 8, 12]:
        with mlflow.start_run(run_name=f"depth_{depth}", nested=True):
            mlflow.log_param("max_depth", depth)
            ...
```

**Autologging (zero-code tracking):**
```python
mlflow.autolog()   # auto-tracks params/metrics/model for supported frameworks
# framework-specific: mlflow.sklearn.autolog(), mlflow.xgboost.autolog(), mlflow.pytorch.autolog()
```

### Model Signatures & Input Examples
A **signature** records the expected input/output schema (column names and types) of a model — this lets MLflow validate inputs at serving time and is required for many serving/UC workflows. An **input example** is a small sample of real input data logged alongside the model, useful for documentation and automated testing of the serving endpoint.

---

## 3. Comparing & Querying Runs

```python
runs = mlflow.search_runs(experiment_ids=["123"], order_by=["metrics.f1 DESC"])
best_run_id = runs.iloc[0]["run_id"]
```

```python
from mlflow import MlflowClient
client = MlflowClient()
run = client.get_run(best_run_id)
print(run.data.metrics, run.data.params)
```

The **Experiments UI** supports parallel-coordinates plots for visually comparing hyperparameters across dozens of runs at once, and can be filtered/sorted like a spreadsheet by any logged param or metric.

---

## 4. Model Packaging: `pyfunc` Flavor

MLflow's `pyfunc` is a universal wrapper — any model (sklearn, custom Python, a full LLM pipeline with pre/post-processing) can be logged and served the same way, regardless of the underlying framework.

```python
import mlflow.pyfunc

class MyModel(mlflow.pyfunc.PythonModel):
    def load_context(self, context):
        self.model = joblib.load(context.artifacts["model_path"])

    def predict(self, context, model_input):
        return self.model.predict(model_input)

mlflow.pyfunc.log_model(
    artifact_path="model",
    python_model=MyModel(),
    artifacts={"model_path": "local_model.pkl"},
    registered_model_name="catalog.schema.my_model"
)
```

Native flavors also exist for: `sklearn`, `xgboost`, `lightgbm`, `pytorch`, `tensorflow`, `spark` (MLlib), `transformers`, `langchain`, `openai`, and more — each handles framework-specific serialization automatically.

### Model Evaluation
```python
result = mlflow.evaluate(
    model="models:/catalog.schema.churn_model/3",
    data=eval_df,
    targets="churned",
    model_type="classifier"
)
print(result.metrics)   # auto-computed accuracy, F1, ROC-AUC, etc. with logged plots
```
`mlflow.evaluate()` standardizes model quality checks across runs, and also supports **LLM-as-judge** evaluation metrics for GenAI use cases (relevance, toxicity, groundedness).

---

## 5. Model Registry — Unity Catalog Models

Models registered with a **3-level name** (`catalog.schema.model_name`) live in Unity Catalog — governed exactly like tables, with the same GRANT/lineage/audit features.

```python
mlflow.set_registry_uri("databricks-uc")

model_uri = f"models:/catalog.schema.churn_model/3"        # by version
model_uri = "models:/catalog.schema.churn_model@champion"  # by alias

model = mlflow.pyfunc.load_model(model_uri)
```

```sql
GRANT EXECUTE ON MODEL catalog.schema.churn_model TO `ds-team`;
SHOW GRANTS ON MODEL catalog.schema.churn_model;
```

**Aliases replace legacy stages** (`Staging`/`Production`) — assign meaningful, mutable pointers that downstream consumers reference instead of hardcoding a version number:
```python
from mlflow import MlflowClient
client = MlflowClient()
client.set_registered_model_alias("catalog.schema.churn_model", "champion", version=3)
client.set_registered_model_alias("catalog.schema.churn_model", "challenger", version=4)
```

### Champion/Challenger Workflow
1. Train a new candidate model, register it as a new version.
2. Assign it the `@challenger` alias.
3. Run it side-by-side (shadow traffic or A/B test) against the current `@champion`.
4. If it outperforms on real traffic metrics, promote it: reassign `@champion` to the new version.
5. Keep the alias pointer stable in serving/application code — only the underlying version changes.

---

## 6. Model Serving

```python
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()
w.serving_endpoints.create(
    name="churn-model-endpoint",
    config={
        "served_entities": [{
            "entity_name": "catalog.schema.churn_model",
            "entity_version": "3",
            "workload_size": "Small",
            "scale_to_zero_enabled": True
        }]
    }
)
```

```bash
curl -X POST https://<workspace>/serving-endpoints/churn-model-endpoint/invocations \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"dataframe_records": [{"feature1": 1.2, "feature2": 3.4}]}'
```

**Serving options:**
| Type | Use case |
|------|----------|
| **Real-time Model Serving** | Low-latency REST endpoint, autoscaling, scale-to-zero |
| **Batch Inference** | `model.predict()` over a Spark DataFrame for large-scale scoring |
| **Foundation Model APIs** | Pay-per-token access to hosted LLMs (Llama, DBRX, etc.) |
| **External Models** | Proxy/gateway to third-party APIs (OpenAI, Anthropic) with unified governance |

```python
# Batch inference pattern
import mlflow
model_udf = mlflow.pyfunc.spark_udf(spark, model_uri="models:/catalog.schema.churn_model@champion")
scored_df = df.withColumn("prediction", model_udf(*feature_cols))
```

### Inference Tables & Monitoring
Serving endpoints can automatically log every request/response pair to a **Delta inference table** — this is the foundation for **Lakehouse Monitoring**, which tracks prediction drift, data drift (vs. the training distribution), and quality metrics over time without custom instrumentation.

```python
w.serving_endpoints.update_config(
    name="churn-model-endpoint",
    auto_capture_config={"catalog_name": "catalog", "schema_name": "schema", "table_name_prefix": "churn_inference"}
)
```

---

## 7. Feature Engineering / Feature Store

Unity Catalog–governed **feature tables** (regular Delta tables with a primary key) enable point-in-time-correct feature lookups and eliminate train/serve skew — the classic bug where training used a feature's *current* value but serving computes it differently or at a different point in time.

```python
from databricks.feature_engineering import FeatureEngineeringClient, FeatureLookup

fe = FeatureEngineeringClient()

fe.create_table(
    name="catalog.schema.customer_features",
    primary_keys=["customer_id"],
    df=features_df,
    description="Customer aggregated features"
)

training_set = fe.create_training_set(
    df=labels_df,
    feature_lookups=[
        FeatureLookup(table_name="catalog.schema.customer_features",
                      feature_names=["total_spend", "tenure_days"],
                      lookup_key="customer_id")
    ],
    label="churned"
)
training_df = training_set.load_df()

# Automatically looks up latest features at serving time too — no manual re-implementation needed
fe.log_model(model=model, artifact_path="model", flavor=mlflow.sklearn,
             training_set=training_set, registered_model_name="catalog.schema.churn_model")
```

### Point-in-Time Joins
When building a training set from a feature table, `FeatureLookup` can accept a `timestamp_lookup_key` so that each label row is joined against the feature values **as they existed at that historical point in time**, not the current values — this is essential for avoiding label leakage in time-series-sensitive ML problems.

### Online Tables
For low-latency (single-digit-millisecond) feature lookups at serving time, feature tables can be published to an **Online Table** — a serving-optimized replica kept in sync with the underlying Delta table, queried directly by Model Serving during real-time inference.

---

## 8. AutoML

```python
from databricks import automl

summary = automl.classify(
    dataset=train_df,
    target_col="churned",
    timeout_minutes=30
)
print(summary.best_trial.model_path)
```
- Automatically tries multiple algorithms/hyperparameters, produces a **leaderboard** plus **auto-generated, editable notebooks** for each trial — a strong starting point for a baseline model and for exploring the feature space, not necessarily the final production model.
- Every AutoML trial is itself a normal MLflow run, so it's fully comparable/inspectable alongside manually-trained models.

---

## 9. Hyperparameter Tuning at Scale

```python
import hyperopt
from hyperopt import fmin, tpe, hp, SparkTrials

search_space = {"max_depth": hp.quniform("max_depth", 3, 15, 1)}

def objective(params):
    ...
    return {"loss": -f1, "status": hyperopt.STATUS_OK}

best = fmin(objective, search_space, algo=tpe.suggest,
            max_evals=50, trials=SparkTrials(parallelism=4))
```
`SparkTrials` distributes hyperparameter search trials across the cluster in parallel, each trial logged as its own MLflow run automatically.

### Distributed Training
For models too large or slow to train on a single node:
| Tool | Use case |
|------|----------|
| **`TorchDistributor`** | Distribute native PyTorch training across multiple GPU nodes |
| **Ray on Databricks** | Run Ray-based distributed training/tuning workloads on a Databricks cluster |
| **Spark MLlib** | Natively distributed algorithms (e.g., ALS, distributed linear models) that don't require single-node model replication |

---

## 10. GenAI / LLMOps on Databricks (Mosaic AI)

| Capability | Purpose |
|------------|---------|
| **Foundation Model APIs** | Query hosted open models (Llama, DBRX, etc.) pay-per-token, no infra to manage |
| **Fine-Tuning API** | Fine-tune foundation models on your own data |
| **Vector Search** | Managed vector database synced from Delta tables, for RAG (retrieval-augmented generation) |
| **AI Gateway** | Unified governance/rate-limiting/usage-logging layer over any model endpoint (internal or external) |
| **Agent Framework / Mosaic AI Agents** | Build, evaluate, and deploy multi-step LLM agents with tool-calling |
| **MLflow Tracing** | Observability for LLM/agent calls — logs prompts, responses, latency, and intermediate tool calls |

```python
import mlflow.deployments
client = mlflow.deployments.get_deploy_client("databricks")
response = client.predict(
    endpoint="databricks-meta-llama-3-1-70b-instruct",
    inputs={"messages": [{"role": "user", "content": "Summarize this text..."}]}
)
```

### RAG Architecture (Typical Shape)
```
Documents → chunk & embed → Delta table → Vector Search index
                                                  │
User query → embed query → similarity search ────┘
                                                  │
                          retrieved chunks + query → LLM prompt → response
```
Vector Search indexes can be kept continuously in sync with a source Delta table, so newly ingested documents become searchable without a separate manual re-indexing step.

### Governance for GenAI
- Route all model calls (internal and third-party) through the **AI Gateway** for centralized rate limiting, usage tracking, and PII/safety guardrail enforcement.
- Use **MLflow Tracing** to capture full request/response/tool-call chains for debugging agent behavior and for compliance review of what a deployed agent actually said.
- Apply the same Unity Catalog governance to vector search indexes and registered agent models as to any other data/model asset.

---

## 11. Model Lifecycle Summary

```
Track experiments (MLflow Tracking)
        │
        ▼
Register best model (UC Model Registry: catalog.schema.model)
        │
        ▼
Assign alias (@champion / @challenger)
        │
        ▼
Deploy (Model Serving endpoint or Batch Inference)
        │
        ▼
Monitor (Lakehouse Monitoring / inference tables / drift checks)
        │
        ▼
Retrain loop
```

---

## Related Cheatsheets
- [Unity Catalog & Governance](./06-unity-catalog-governance.md) — model & feature table governance
- [DevOps & CI/CD](./10-devops-cicd.md) — packaging ML training pipelines as code
- [Orchestration & Workflows](./07-orchestration-workflows.md) — scheduling retraining pipelines
