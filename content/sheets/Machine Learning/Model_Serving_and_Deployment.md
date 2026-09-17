# Model Serving & Deployment Cheatsheet

## Overview

Training a good model is half the job — this sheet covers the engineering layer that turns it into a fast, reliable production endpoint: serving frameworks, latency optimization, deployment patterns, and the observability needed to know when serving itself (not the model's accuracy) is the problem.

```bash
pip install fastapi uvicorn onnx onnxruntime --break-system-packages
```

---

## 1. Serving Frameworks

```python
# Simple FastAPI serving — fine for low-to-moderate traffic, full control over the request/response contract
from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import numpy as np

app = FastAPI()
model = joblib.load("model_pipeline.joblib")  # load once at startup, not per-request

class PredictionRequest(BaseModel):
    features: list[float]

class PredictionResponse(BaseModel):
    prediction: float
    probability: float

@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    X = np.array([request.features])
    prob = model.predict_proba(X)[0, 1]
    return PredictionResponse(prediction=float(prob > 0.5), probability=float(prob))

# Run with: uvicorn app:app --host 0.0.0.0 --port 8000 --workers 4
```

```python
# Triton Inference Server — for high-throughput, multi-model, multi-framework serving
# (illustrative config, not Python code — Triton is configured via a model repository structure)
triton_config_example = """
name: "fraud_model"
platform: "onnxruntime_onnx"
max_batch_size: 32
dynamic_batching {
  preferred_batch_size: [8, 16, 32]
  max_queue_delay_microseconds: 5000
}
"""
```

| Framework | Best for |
|---|---|
| FastAPI + Uvicorn | Full control, simple deployments, easy to reason about, good for low-moderate QPS |
| TorchServe / TF Serving | Framework-native serving with built-in versioning, metrics, batching |
| Triton | Highest throughput, multi-framework, GPU-optimized, dynamic batching built-in |

---

## 2. Latency Optimization

```python
# Quantization: reduce numeric precision of weights to speed up inference and shrink model size
import torch

model_fp32 = torch.nn.Linear(512, 512)  # stand-in for a real model
model_int8 = torch.quantization.quantize_dynamic(
    model_fp32, {torch.nn.Linear}, dtype=torch.qint8
)
# int8 inference is typically 2-4x faster on CPU with minimal accuracy loss for many model types

# ONNX export: convert a PyTorch model to a framework-agnostic format optimized for inference
dummy_input = torch.randn(1, 512)
torch.onnx.export(
    model_fp32, dummy_input, "model.onnx",
    input_names=["input"], output_names=["output"],
    dynamic_axes={"input": {0: "batch_size"}},  # allow variable batch sizes at inference
)

import onnxruntime as ort
session = ort.InferenceSession("model.onnx")
outputs = session.run(None, {"input": dummy_input.numpy()})
```

```python
# Batching requests: process multiple incoming requests together instead of one at a time
import asyncio
from collections import deque

class RequestBatcher:
    """Accumulates requests for a short window, then scores them together — much better
    GPU utilization than scoring one request at a time."""
    def __init__(self, model, max_batch_size=32, max_wait_ms=10):
        self.model = model
        self.max_batch_size = max_batch_size
        self.max_wait_ms = max_wait_ms
        self.queue = deque()

    async def predict(self, features):
        future = asyncio.get_event_loop().create_future()
        self.queue.append((features, future))
        if len(self.queue) >= self.max_batch_size:
            await self._flush()
        return await future

    async def _flush(self):
        batch = [self.queue.popleft() for _ in range(len(self.queue))]
        features_batch = np.array([f for f, _ in batch])
        predictions = self.model.predict(features_batch)
        for (_, future), pred in zip(batch, predictions):
            future.set_result(pred)
```

**Model distillation for inference speed:** train a smaller "student" model to mimic a larger "teacher" model's outputs (matching soft probability distributions, not just hard labels) — the student can run significantly faster at inference time while retaining much of the teacher's accuracy, useful when the training-time model is too large/slow for production latency requirements.

---

## 3. Deployment Patterns

```python
# Blue/green deployment: TWO complete production environments, switch traffic atomically
def blue_green_switch(load_balancer, new_environment):
    load_balancer.route_all_traffic(new_environment)
    # Old environment ("blue") stays running, untouched, for instant rollback if needed

# Canary release: route a SMALL percentage of traffic to the new model, monitor, then ramp up
def canary_rollout(traffic_router, new_model_percentage):
    traffic_router.set_split(new_model=new_model_percentage, old_model=100 - new_model_percentage)
    # Gradually increase new_model_percentage (e.g., 5% -> 25% -> 50% -> 100%) while monitoring metrics
```

| Pattern | Rollback speed | Risk exposure | Infra cost |
|---|---|---|---|
| Blue/green | Instant (flip the router) | Full traffic hits new version immediately once switched | Double (two full environments) |
| Canary | Fast (route traffic back) | Limited to the canary percentage while validating | Lower — partial capacity for the canary |
| Shadow (see MLOps sheet) | N/A — new model never serves real users | None | Extra compute to run both models, but zero user risk |

---

## 4. Autoscaling and GPU vs. CPU Serving

```python
# Autoscaling configuration concept (e.g., Kubernetes HPA)
autoscaling_config = {
    "min_replicas": 2,
    "max_replicas": 20,
    "target_metric": "requests_per_second",
    "target_value": 100,  # scale up when average RPS per replica exceeds this
    "scale_down_cooldown_seconds": 300,  # avoid thrashing — don't scale down too eagerly
}
```

| | GPU serving | CPU serving |
|---|---|---|
| Best for | Large models (LLMs, deep vision models), high per-request compute | Small-to-medium models, tabular ML, high request volume with low per-request compute |
| Cost profile | High fixed cost, needs high utilization to be worth it | Lower fixed cost, scales more granularly |
| Batching benefit | Large — GPUs are throughput-oriented, underutilized at batch size 1 | Smaller — CPUs don't get the same parallelism boost from batching |

**Practical guidance:** a small XGBoost or scikit-learn model almost never needs GPU serving — the overhead of moving data to/from GPU memory can exceed the compute savings for small models. Reserve GPU serving for models where the per-request compute (large neural nets) genuinely justifies it, and batch aggressively when you do use it.

---

## 5. Caching Strategies

```python
from functools import lru_cache
import hashlib

# In-process cache for pure, deterministic feature transformations
@lru_cache(maxsize=10000)
def cached_feature_lookup(customer_id):
    return expensive_feature_computation(customer_id)

# Distributed cache (e.g., Redis) for sharing across multiple serving replicas
def get_prediction_with_cache(redis_client, request_hash, model, features):
    cached = redis_client.get(request_hash)
    if cached is not None:
        return cached
    prediction = model.predict(features)
    redis_client.setex(request_hash, ttl=300, value=prediction)  # 5-minute TTL
    return prediction
```

**When caching pays off:** high-repeat traffic patterns (identical or near-identical requests, common in FAQ-style LLM applications or popular-item recommendation lookups) benefit enormously. Caching is far less useful — and can be actively harmful (staleness) — for genuinely unique per-request inputs like personalized real-time fraud scoring, where cache hit rates would be near zero anyway.

---

## 6. Observability for Serving

```python
import time
from prometheus_client import Histogram, Counter

request_latency = Histogram("model_prediction_latency_seconds", "Prediction latency")
error_counter = Counter("model_prediction_errors_total", "Total prediction errors")

@app.post("/predict")
def predict_with_monitoring(request: PredictionRequest):
    start = time.time()
    try:
        X = np.array([request.features])
        prob = model.predict_proba(X)[0, 1]
        return PredictionResponse(prediction=float(prob > 0.5), probability=float(prob))
    except Exception as e:
        error_counter.inc()
        raise
    finally:
        request_latency.observe(time.time() - start)
```

**Metrics specific to serving (distinct from model-quality metrics in the MLOps sheet):**
- **Latency percentiles (p50/p95/p99)** — the average latency can look fine while a meaningful fraction of requests time out; p99 catches this.
- **Throughput** — requests handled per second, tracked against capacity planning targets.
- **Error rate** — separate from model accuracy; this catches infrastructure failures (OOM, malformed input, timeout) that have nothing to do with whether the model itself is "good."

## Common Pitfalls

- **Loading the model fresh on every request** instead of once at startup — adds enormous, unnecessary latency to every single call.
- **No batching for GPU-served models** — leaves most of a GPU's throughput capacity unused, an expensive mistake at scale.
- **Blue/green deployment without validating the new environment first** (via canary or shadow) — you find out about problems only after 100% of traffic has already switched.
- **Ignoring p99 latency in favor of average latency** — a "fast on average" service can still be timing out for a meaningful fraction of users.
- **Quantizing a model without validating accuracy impact** — always benchmark accuracy on a held-out set post-quantization; the impact varies significantly by model architecture and isn't always negligible.

---

## 7. End-to-End Worked Example: A Serving API With Batching, Caching, and Monitoring Combined

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
import time
import hashlib
import asyncio
import joblib
from collections import deque

app = FastAPI()
model = joblib.load("model_pipeline.joblib")  # loaded ONCE at startup

# --- In-memory cache with TTL ---
_cache = {}
CACHE_TTL_SECONDS = 60

def get_cache_key(features):
    return hashlib.sha256(str(features).encode()).hexdigest()

def cache_get(key):
    entry = _cache.get(key)
    if entry and (time.time() - entry["timestamp"]) < CACHE_TTL_SECONDS:
        return entry["value"]
    return None

def cache_set(key, value):
    _cache[key] = {"value": value, "timestamp": time.time()}

# --- Simple request batcher ---
class Batcher:
    def __init__(self, model, max_batch_size=16, max_wait_seconds=0.02):
        self.model = model
        self.max_batch_size = max_batch_size
        self.max_wait_seconds = max_wait_seconds
        self.pending = []
        self.lock = asyncio.Lock()

    async def predict(self, features):
        future = asyncio.get_event_loop().create_future()
        async with self.lock:
            self.pending.append((features, future))
            should_flush = len(self.pending) >= self.max_batch_size
        if should_flush:
            await self._flush()
        else:
            asyncio.create_task(self._flush_after_delay())
        return await future

    async def _flush_after_delay(self):
        await asyncio.sleep(self.max_wait_seconds)
        await self._flush()

    async def _flush(self):
        async with self.lock:
            if not self.pending:
                return
            batch = self.pending
            self.pending = []
        X = np.array([f for f, _ in batch])
        predictions = self.model.predict_proba(X)[:, 1]
        for (_, future), pred in zip(batch, predictions):
            if not future.done():
                future.set_result(float(pred))

batcher = Batcher(model)

# --- Basic monitoring counters ---
request_count = 0
error_count = 0
latencies = deque(maxlen=1000)

class PredictionRequest(BaseModel):
    features: list[float]

@app.post("/predict")
async def predict(request: PredictionRequest):
    global request_count, error_count
    start = time.time()
    request_count += 1
    try:
        cache_key = get_cache_key(request.features)
        cached = cache_get(cache_key)
        if cached is not None:
            return {"probability": cached, "cached": True}

        probability = await batcher.predict(request.features)
        cache_set(cache_key, probability)
        return {"probability": probability, "cached": False}
    except Exception:
        error_count += 1
        raise HTTPException(status_code=500, detail="Prediction failed")
    finally:
        latencies.append(time.time() - start)

@app.get("/health")
def health():
    p50 = np.percentile(latencies, 50) if latencies else 0
    p99 = np.percentile(latencies, 99) if latencies else 0
    return {
        "status": "healthy" if error_count / max(request_count, 1) < 0.01 else "degraded",
        "total_requests": request_count,
        "error_rate": error_count / max(request_count, 1),
        "latency_p50_ms": round(p50 * 1000, 1),
        "latency_p99_ms": round(p99 * 1000, 1),
    }
```

This single file demonstrates every serving concern from the base sheet working together: caching short-circuits repeated requests, the batcher groups concurrent requests for more efficient scoring, and the `/health` endpoint exposes exactly the p50/p99 latency and error-rate metrics a real observability stack (Prometheus, Datadog) would scrape.

---

## 8. Advanced & Lesser-Known Techniques

- **Graceful degradation / fallback models**: when the primary model's service is degraded (high latency, elevated errors) or a required feature is unavailable, fall back to a simpler, more robust model (or even a rule-based heuristic) rather than failing the request entirely — trades some accuracy for reliability during incidents.
- **Warm-up requests**: many serving stacks (especially GPU-backed ones, or those using JIT compilation like `torch.compile`) have a slow first inference due to lazy initialization/compilation — sending synthetic "warm-up" requests immediately after a new instance starts, before it receives real traffic, avoids the first real user experiencing that latency spike.
- **Multi-model endpoints**: serving several related models (e.g., one per region, or one per customer segment) behind a single endpoint with request-time routing logic, sharing infrastructure while keeping model logic separated — common in Triton and SageMaker multi-model endpoints.
- **Adaptive batching**: rather than a fixed `max_wait_seconds`, dynamically adjust the batching window based on current traffic volume — batch aggressively (longer wait) during high traffic to maximize throughput, and minimize wait time during low traffic to protect latency for the few requests that do arrive.

---

## 9. Practice Exercises

1. Load-test the serving example above (e.g., with a simple async client sending concurrent requests) and measure how p50/p99 latency change as you vary `max_batch_size` and `max_wait_seconds`.
2. Implement a fallback: if the primary model raises an exception, fall back to a simple rule-based heuristic and log that the fallback path was used, without failing the request.
3. Add a warm-up routine that fires several synthetic requests through the batcher immediately at application startup, and measure the latency difference for the first real request with vs. without warm-up.
4. Extend the cache to use a proper TTL-aware LRU eviction policy (rather than an unbounded dict) and benchmark memory usage under sustained high-cardinality traffic.
5. Implement basic canary routing: given two loaded model versions, route a configurable percentage of requests to each, log which version served each request, and compute a simple online comparison of their prediction distributions.

---

## 10. More Examples

### Example: Serving multiple model versions side by side for comparison

```python
from fastapi import FastAPI
import joblib

app = FastAPI()
models = {
    "v1": joblib.load("model_v1.joblib"),
    "v2": joblib.load("model_v2.joblib"),
}

@app.post("/predict/{version}")
def predict_versioned(version: str, features: list[float]):
    if version not in models:
        return {"error": f"Unknown model version: {version}"}
    import numpy as np
    proba = models[version].predict_proba(np.array([features]))[0, 1]
    return {"version": version, "probability": float(proba)}
```

### Example: Circuit breaker pattern for a flaky downstream dependency

```python
import time

class CircuitBreaker:
    """Stops calling a failing dependency after too many failures, giving it time to
    recover instead of piling on more load — a standard resilience pattern for serving."""
    def __init__(self, failure_threshold=5, recovery_timeout=30):
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.opened_at = None

    def call(self, fn, *args, **kwargs):
        if self.opened_at and (time.time() - self.opened_at) < self.recovery_timeout:
            raise Exception("Circuit breaker OPEN — failing fast instead of calling the dependency")

        try:
            result = fn(*args, **kwargs)
            self.failure_count = 0  # reset on success
            self.opened_at = None
            return result
        except Exception as e:
            self.failure_count += 1
            if self.failure_count >= self.failure_threshold:
                self.opened_at = time.time()
            raise
```

### Example: Exporting a scikit-learn model to ONNX for cross-platform serving

```python
from skl2onnx import to_onnx
from sklearn.ensemble import RandomForestClassifier
import numpy as np

model = RandomForestClassifier(n_estimators=100).fit(np.random.randn(100, 10), np.random.randint(0, 2, 100))
onnx_model = to_onnx(model, np.zeros((1, 10), dtype=np.float32))

with open("model.onnx", "wb") as f:
    f.write(onnx_model.SerializeToString())

# Now servable from ANY language/runtime with ONNX Runtime bindings (C++, Java, JS, etc.) —
# not locked into a Python-only serving stack
```

---

## 11. Quick-Reference Cheat-Table

| Situation | Choice |
|---|---|
| Low-moderate traffic, full control | FastAPI + Uvicorn |
| High throughput, GPU-optimized | Triton |
| Small tabular model | CPU serving — GPU rarely worth it |
| Large neural net, high per-request compute | GPU serving with batching |
| High-repeat query patterns | Add caching |
| New model version | Canary or blue/green — never switch 100% traffic blind |

## 12. FAQ

**Q: Does my small XGBoost model need GPU serving?**
A: Almost never — the overhead of moving data to/from GPU memory can exceed the compute savings for small models. CPU serving is usually the right call.

**Q: Why is average latency fine but users still complain about slowness?**
A: Check p99 latency, not just average — a "fast on average" service can still be timing out for a meaningful fraction of requests.

**Q: Do I need batching if I'm not using a GPU?**
A: Less critical, but still valuable — CPUs get a smaller parallelism benefit from batching than GPUs, but batching still reduces per-request overhead.

**Q: Blue/green or canary deployment — which is safer?**
A: Canary — it limits risk exposure to a small percentage of traffic while validating, whereas blue/green switches all traffic to the new version at once (though rollback is instant either way).

**Q: Should I quantize my model for faster inference?**
A: Usually a good default for latency-sensitive serving, but always validate accuracy impact post-quantization — it isn't always negligible depending on the architecture.
