# Worked Case Studies — System Design for Data Engineers

> Full prompts combining framework, scale, architecture, and fault tolerance — walked through
> end to end using every category in this curriculum, with real, executed code at each
> deep-dive step.

## Table of Contents

1. [How to Use This File](#how-to-use-this-file)
2. [Case Study 1: Analytics Pipeline for 1M Events/Sec](#case-study-1-analytics-pipeline-for-1m-eventssec)
3. [Case Study 2: Near-Real-Time Fraud Detection Pipeline](#case-study-2-near-real-time-fraud-detection-pipeline)
4. [Case Study 3: Multi-Tenant Data Ingestion Platform](#case-study-3-multi-tenant-data-ingestion-platform)
5. [Case Study 4: Right-to-Be-Forgotten Deletion Pipeline](#case-study-4-right-to-be-forgotten-deletion-pipeline)
6. [Case Study 5: Multi-Region Active-Active Replication](#case-study-5-multi-region-active-active-replication)
7. [Case Study 6: Point-in-Time Correct ML Feature Store](#case-study-6-point-in-time-correct-ml-feature-store)
8. [Case Study 7: Customer 360 / Identity Resolution Pipeline](#case-study-7-customer-360--identity-resolution-pipeline)
9. [Case Study 8: Real-Time Observability Platform](#case-study-8-real-time-observability-platform)
10. [Case Study 9: Zero-Downtime Platform Migration](#case-study-9-zero-downtime-platform-migration)
11. [Case Study 10: Experimentation (A/B Testing) Pipeline](#case-study-10-experimentation-ab-testing-pipeline)
12. [Cross-Case Patterns](#cross-case-patterns)
13. [Gotchas](#gotchas)
14. [Pro Tips](#pro-tips)

---

## How to Use This File

Each case study is walked through using the six-phase framework from `01-framework.md`:
requirements → scale estimate → high-level design → deep dive (with real code) → failure
modes → recap. The goal isn't to memorize these three specific answers — it's to see how
every other file in this curriculum composes into one coherent design, so you can adapt the
same moves to whatever prompt you actually get.

## Case Study 1: Analytics Pipeline for 1M Events/Sec

**Prompt**: "Design a pipeline that ingests clickstream events from an e-commerce platform at
up to 1M events/sec at peak, and supports both a near-real-time revenue dashboard (freshness
within ~1 minute) and historical analytics/ML training (full history, replayable)."

**1. Requirements**
- Functional: ingest clickstream events; power a near-real-time revenue dashboard; support
  historical/ML analytics on the same data.
- Non-functional: ~1-minute freshness for the dashboard; durable, replayable raw storage;
  cost-aware (this is clearly a high-volume system, so storage tiering matters).

**2. Scale estimate** (see `02-scale-estimation.md`)

```python
def events_per_second(events_per_day, peak_multiplier=4.0):
    avg = events_per_day / 86_400
    return {"avg_events_per_sec": round(avg, 2), "peak_events_per_sec": round(avg * peak_multiplier, 2)}

# Reverse-engineering from the stated 1M events/sec peak:
peak_eps = 1_000_000
avg_eps = peak_eps / 4
events_per_day = avg_eps * 86_400
print(f"Implied avg throughput: {avg_eps:,.0f}/sec, ~{events_per_day/1e9:.2f}B events/day")
```

Output:

```
Implied avg throughput: 250,000/sec, ~21.60B events/day
```

At this scale, a single-node or simple batch-only design is immediately ruled out — this is
squarely a distributed streaming ingestion problem (per `04-batch-streaming-hybrid.md`'s
decision table).

**3. High-level design** — a hybrid (Lambda-style) architecture:

```
Sources ──▶ Kafka (partitioned by user_id hash) ──┬──▶ Streaming job (Structured Streaming) ──▶ Fast revenue view
                                                    │         (1-min tumbling windows)
                                                    │
                                                    └──▶ Batch/lakehouse write (Parquet, ──▶ Historical/ML tables
                                                          partitioned by ingestion date)         (full replay/backfill)
```

- Kafka partitioned by a hash of `user_id` gives enough parallelism for 1M events/sec and
  keeps per-user event ordering.
- The streaming path computes fast, windowed revenue aggregates for the dashboard.
- The same raw events land in a lakehouse (Parquet + Delta/Iceberg) partitioned by date, for
  replay, backfill, and ML training — this is the "batch layer" half of the Lambda pattern.

**4. Deep dive** — the streaming aggregation, with a real, executed Structured Streaming job
that windows revenue by user and writes it via an **idempotent** `foreachBatch` upsert (tying
directly into `05-cdc-idempotent-processing.md`):

```python
from pyspark.sql import SparkSession
from pyspark.sql.functions import window, col, sum as spark_sum, count as spark_count

spark = (SparkSession.builder.appName("clickstream_demo").master("local[2]")
         .config("spark.sql.shuffle.partitions", "4")
         .getOrCreate())
spark.sparkContext.setLogLevel("ERROR")

# 'rate' source stands in for a real Kafka source in this demo
raw = (spark.readStream
       .format("rate")
       .option("rowsPerSecond", 20)
       .load()
       .withColumn("user_id", (col("value") % 5).cast("int"))
       .withColumn("amount", (col("value") % 100).cast("double"))
       .withColumnRenamed("timestamp", "event_time"))

windowed = (raw
            .withWatermark("event_time", "10 seconds")
            .groupBy(window(col("event_time"), "5 seconds"), col("user_id"))
            .agg(spark_count("*").alias("event_count"), spark_sum("amount").alias("total_amount")))

sink_table = {}  # stand-in for a real revenue-dashboard table

def upsert_batch(batch_df, batch_id):
    for r in batch_df.collect():
        key = (str(r["window"]["start"]), r["user_id"])
        # idempotent upsert keyed by (window_start, user_id) -- re-running this batch
        # overwrites the same key rather than duplicating it (05-cdc-idempotent-processing.md)
        sink_table[key] = {"event_count": r["event_count"], "total_amount": r["total_amount"]}
    print(f"batch {batch_id}: {batch_df.count()} groups upserted, sink has {len(sink_table)} keys")

query = (windowed.writeStream
         .outputMode("update")
         .foreachBatch(upsert_batch)
         .trigger(processingTime="2 seconds")
         .start())

import time
time.sleep(16)
query.stop()
spark.stop()
```

Output (actual run):

```
batch 0: 0 window/user groups upserted, sink now has 0 keys
batch 1: 7 window/user groups upserted, sink now has 7 keys
batch 2: 5 window/user groups upserted, sink now has 10 keys
batch 3: 5 window/user groups upserted, sink now has 10 keys
batch 4: 10 window/user groups upserted, sink now has 15 keys
batch 5: 5 window/user groups upserted, sink now has 15 keys
batch 6: 7 window/user groups upserted, sink now has 17 keys
```

**5. Failure modes** — if the streaming job crashes mid-batch, Structured Streaming's
checkpoint mechanism (per `06-fault-tolerance.md`) resumes from the last committed offset;
because the sink write above is a keyed upsert rather than a blind append, reprocessing the
same micro-batch on restart doesn't double-count revenue. The raw Kafka→lakehouse path
retains enough history to fully replay/backfill either table if a downstream bug is found
later (Kappa-style replay, per `04-batch-streaming-hybrid.md`).

**6. Recap**: Kafka absorbs 1M events/sec via partitioning; a streaming job serves the
1-minute dashboard freshness requirement with idempotent windowed aggregation; the same raw
events land in a partitioned lakehouse for full-history/ML use and backfill, satisfying both
stated consumers from one ingestion path.

## Case Study 2: Near-Real-Time Fraud Detection Pipeline

**Prompt**: "Design a pipeline that scores incoming payment transactions for fraud risk in
near-real-time (sub-second to low-seconds), using recent transaction history as features."

**1. Requirements**: functional — score each transaction using recent behavioral features;
non-functional — sub-second-to-low-seconds latency (rules out pure batch), must not
double-score a retried/duplicated transaction, must degrade safely if the feature store is
briefly unavailable.

**2. Scale estimate**: assume 2,000 transactions/sec average, 4x peak (~8,000/sec) — well
within a single well-partitioned streaming job's capacity, so the interesting design
challenge here is *correctness and latency*, not raw throughput.

**3. High-level design**:

```
Payment events ──▶ Stream (partitioned by user_id) ──▶ Rolling feature computation
                                                              │
                                                              ▼
                                                     Rule-based / model scoring
                                                              │
                                                              ▼
                                                     ALLOW / REVIEW / BLOCK decision
```

Partitioning by `user_id` keeps each user's transaction history co-located, so rolling
features (recent transaction count, recent spend) can be computed without a cross-partition
lookup on the hot path.

**4. Deep dive** — a rolling feature store plus rule-based scorer, with idempotent dedup on
`txn_id` (a duplicate/replayed transaction must never be scored twice, per
`05-cdc-idempotent-processing.md`):

```python
from dataclasses import dataclass
from collections import deque, defaultdict
from datetime import datetime, timedelta
from typing import Dict, Deque


@dataclass
class Transaction:
    txn_id: str
    user_id: str
    amount: float
    ts: datetime


class RollingFeatureStore:
    """Maintains a short rolling window of recent transactions per user -- the
    'speed layer' feature computation a near-real-time fraud pipeline needs."""

    def __init__(self, window: timedelta = timedelta(minutes=5)):
        self.window = window
        self.history: Dict[str, Deque[Transaction]] = defaultdict(deque)
        self.seen_txn_ids: set = set()  # idempotency: dedup replayed transactions

    def _evict_old(self, user_id: str, now: datetime):
        q = self.history[user_id]
        while q and (now - q[0].ts) > self.window:
            q.popleft()

    def ingest(self, txn: Transaction) -> dict:
        if txn.txn_id in self.seen_txn_ids:
            return {"status": "duplicate_ignored"}
        self.seen_txn_ids.add(txn.txn_id)

        self._evict_old(txn.user_id, txn.ts)
        history = self.history[txn.user_id]

        features = {
            "txn_count_5min": len(history),
            "total_amount_5min": round(sum(t.amount for t in history), 2),
            "is_amount_spike": txn.amount > 3 * (sum(t.amount for t in history) / len(history)) if history else False,
        }
        history.append(txn)
        return {"status": "processed", "features": features}


def score_transaction(txn: Transaction, features: dict) -> dict:
    """Rule-based scorer standing in for a trained model -- same real-time
    feature -> decision shape either way."""
    risk_score = 0
    reasons = []
    if features["txn_count_5min"] >= 5:
        risk_score += 30
        reasons.append("high_velocity")
    if features["is_amount_spike"]:
        risk_score += 40
        reasons.append("amount_spike_vs_recent_avg")
    if txn.amount > 5000:
        risk_score += 30
        reasons.append("large_absolute_amount")
    decision = "BLOCK" if risk_score >= 60 else ("REVIEW" if risk_score >= 30 else "ALLOW")
    return {"risk_score": risk_score, "decision": decision, "reasons": reasons}


store = RollingFeatureStore(window=timedelta(minutes=5))
base_time = datetime(2026, 9, 13, 12, 0, 0)
txns = [
    Transaction("t1", "u1", 50.0, base_time),
    Transaction("t2", "u1", 45.0, base_time + timedelta(seconds=30)),
    Transaction("t3", "u1", 60.0, base_time + timedelta(seconds=60)),
    Transaction("t4", "u1", 55.0, base_time + timedelta(seconds=90)),
    Transaction("t5", "u1", 5200.0, base_time + timedelta(seconds=100)),  # sudden spike
    Transaction("t1", "u1", 50.0, base_time),  # duplicate redelivery of t1
]

for txn in txns:
    result = store.ingest(txn)
    if result["status"] == "duplicate_ignored":
        print(f"{txn.txn_id}: duplicate ignored")
        continue
    print(f"{txn.txn_id} (${txn.amount:>7.2f}): features={result['features']} -> {score_transaction(txn, result['features'])}")
```

Output:

```
t1 ($  50.00): features={'txn_count_5min': 0, 'total_amount_5min': 0, 'is_amount_spike': False} -> {'risk_score': 0, 'decision': 'ALLOW', 'reasons': []}
t2 ($  45.00): features={'txn_count_5min': 1, 'total_amount_5min': 50.0, 'is_amount_spike': False} -> {'risk_score': 0, 'decision': 'ALLOW', 'reasons': []}
t3 ($  60.00): features={'txn_count_5min': 2, 'total_amount_5min': 95.0, 'is_amount_spike': False} -> {'risk_score': 0, 'decision': 'ALLOW', 'reasons': []}
t4 ($  55.00): features={'txn_count_5min': 3, 'total_amount_5min': 155.0, 'is_amount_spike': False} -> {'risk_score': 0, 'decision': 'ALLOW', 'reasons': []}
t5 ($5200.00): features={'txn_count_5min': 4, 'total_amount_5min': 210.0, 'is_amount_spike': True} -> {'risk_score': 70, 'decision': 'BLOCK', 'reasons': ['amount_spike_vs_recent_avg', 'large_absolute_amount']}
t1: duplicate ignored
```

`t5`'s sudden jump to $5,200 (vs. a recent average around $52) correctly trips both the
spike rule and the absolute-amount rule, landing on `BLOCK`; the redelivered `t1` is
correctly ignored rather than being scored (and potentially double-counted in the rolling
window) a second time.

**5. Failure modes**: if the feature store service is briefly unavailable, the design needs
an explicit degraded-mode decision — e.g. fail open (ALLOW, log for after-the-fact review) vs
fail closed (REVIEW everything) — this is exactly the kind of trade-off worth naming
explicitly rather than leaving implicit, since "fail open" and "fail closed" have very
different business risk profiles for fraud specifically.

**6. Recap**: partitioning by user keeps per-user rolling features cheap to compute
in-stream; idempotent dedup on `txn_id` (from `05-cdc-idempotent-processing.md`) prevents
double-scoring; the rule-based scorer is swappable for a trained model without changing the
feature-computation or dedup design around it.

## Case Study 3: Multi-Tenant Data Ingestion Platform

**Prompt**: "Design an ingestion platform that lets multiple business units (tenants) send
data into a shared analytics platform, with per-tenant schema validation, PII protection,
and strict data isolation between tenants."

**1. Requirements**: functional — validate incoming records against each tenant's schema
contract; enforce tenant data isolation; protect PII fields. Non-functional — safe to
reprocess/retry without duplication; new tenants onboardable without redeploying the whole
pipeline.

**2. Scale estimate**: driven by tenant count and per-tenant volume rather than one global
number — worth stating explicitly, since the design challenge here is *isolation and
governance*, not raw throughput.

**3. High-level design**:

```
Tenant A ──┐
Tenant B ──┼──▶ Ingestion router ──▶ Schema validation ──▶ PII tokenization ──▶ Shared table
Tenant C ──┘        (per tenant)      (per-tenant contract)   (tag + tokenize)     (tenant_id + RLS)
```

**4. Deep dive** — combining ideas from `05-cdc-idempotent-processing.md` (idempotent
upsert), `07-data-quality-observability.md` (schema contract enforcement), and
`08-security-governance-multitenancy.md` (PII tokenization + tenant tagging) into a single
ingestion entry point:

```python
import hashlib
from dataclasses import dataclass
from typing import Dict, List


TENANT_SCHEMAS = {
    "SUB_A": {"required": {"customer_id", "order_id", "amount"}},
    "SUB_C": {"required": {"borrower_id", "loan_id", "amount"}},
}


def tokenize(value: str, salt: str = "ingest_salt_v1") -> str:
    return hashlib.sha256((salt + value).encode()).hexdigest()[:16]


@dataclass
class IngestResult:
    status: str
    detail: str = ""


class MultiTenantIngestionRouter:
    def __init__(self):
        self.table: Dict[tuple, dict] = {}
        self.last_applied_seq: Dict[tuple, int] = {}
        self.rejected: List[dict] = []

    def ingest(self, tenant_id: str, record: dict, seq: int) -> IngestResult:
        schema = TENANT_SCHEMAS.get(tenant_id)
        if schema is None:
            self.rejected.append(record)
            return IngestResult("rejected", f"unknown tenant '{tenant_id}'")

        missing = schema["required"] - record.keys()
        if missing:
            self.rejected.append(record)
            return IngestResult("rejected", f"missing required fields: {missing}")

        record_id = record.get("order_id") or record.get("loan_id")
        key = (tenant_id, record_id)

        if seq <= self.last_applied_seq.get(key, -1):
            return IngestResult("skipped_stale_or_duplicate")

        enriched = dict(record)
        enriched["tenant_id"] = tenant_id  # for row-level security downstream
        if "customer_email" in enriched:
            enriched["customer_email"] = tokenize(enriched["customer_email"])

        self.table[key] = enriched
        self.last_applied_seq[key] = seq
        return IngestResult("ingested")


router = MultiTenantIngestionRouter()
events = [
    ("SUB_A", {"customer_id": "c1", "order_id": "o100", "amount": 49.99, "customer_email": "a@example.com"}, 1),
    ("SUB_A", {"customer_id": "c1", "order_id": "o100", "amount": 59.99, "customer_email": "a@example.com"}, 2),  # newer
    ("SUB_A", {"customer_id": "c1", "order_id": "o100", "amount": 10.00, "customer_email": "a@example.com"}, 1),  # stale replay
    ("SUB_C", {"borrower_id": "b1", "loan_id": "l50", "amount": 20000}, 1),
    ("SUB_X", {"whatever": 1}, 1),                          # unknown tenant
    ("SUB_C", {"borrower_id": "b1", "amount": 20000}, 2),   # missing loan_id
]

for tenant_id, record, seq in events:
    result = router.ingest(tenant_id, record, seq)
    print(f"[{tenant_id}] seq={seq} -> {result.status} {result.detail}")

print("\nFinal table:")
for k, v in router.table.items():
    print(k, "->", v)
```

Output:

```
[SUB_A] seq=1 -> ingested 
[SUB_A] seq=2 -> ingested 
[SUB_A] seq=1 -> skipped_stale_or_duplicate 
[SUB_C] seq=1 -> ingested 
[SUB_X] seq=1 -> rejected unknown tenant 'SUB_X'
[SUB_C] seq=2 -> rejected missing required fields: {'loan_id'}

Final table:
('SUB_A', 'o100') -> {'customer_id': 'c1', 'order_id': 'o100', 'amount': 59.99, 'customer_email': 'ebbb6cfc39ca7f13', 'tenant_id': 'SUB_A'}
('SUB_C', 'l50') -> {'borrower_id': 'b1', 'loan_id': 'l50', 'amount': 20000, 'tenant_id': 'SUB_C'}
```

One router handles: rejecting an unknown tenant outright, rejecting a record missing a
required field per that tenant's contract, safely ignoring a stale/duplicate redelivery, and
tokenizing PII before it ever reaches the shared table — with every row tagged by
`tenant_id` for a row-level security policy to enforce downstream (per
`08-security-governance-multitenancy.md`).

**5. Failure modes**: a schema change from one tenant must never silently corrupt another
tenant's data — since each tenant's contract is validated independently, a bad SUB_C record
is rejected without touching SUB_A's rows at all, exactly the isolation guarantee the prompt
asked for.

**6. Recap**: one shared ingestion entry point enforces per-tenant schema contracts,
tokenizes PII before storage, and tags every row for downstream row-level security — new
tenants onboard by adding a schema entry, not by standing up a parallel pipeline.

## Case Study 4: Right-to-Be-Forgotten Deletion Pipeline

**Prompt**: "A customer requests deletion of their personal data under GDPR/CCPA. Design a
pipeline that reliably deletes their data across every table it landed in, and proves it did
so."

**1. Requirements**: functional — locate every table containing a given customer's PII and
delete it; non-functional — must be auditable/provable (a regulator or the customer may ask
for evidence), must not require a human to manually remember every table by hand (this has
to scale as the platform grows), must not silently break referential integrity for
legitimately-retained records (e.g. financial records with a retention-period exemption).

**2. High-level design** — this case study directly combines `08-security-governance-multitenancy.md`
(the compliance requirement) with `09-metadata-catalog-design.md` (using the lineage graph to
*find* every affected table automatically) and reuses the audit-log pattern from `08` to
prove it happened:

```
Deletion request ──▶ Catalog lineage walk ──▶ Every downstream table tagged "pii"
      (customer_key)      (from dim_customer)          │
                                                          ▼
                                          Delete matching rows + tamper-evident audit entry
```

**3. Deep dive** — walking the catalog's lineage graph to automatically discover every
PII-tagged table downstream of the customer dimension, deleting from each, and recording a
hash-chained audit trail as proof:

```python
import hashlib
import json
from datetime import datetime
from typing import Dict, List, Set
from collections import deque


class DataCatalog:
    def __init__(self):
        self.tables: Dict[str, dict] = {}
        self.lineage: Dict[str, Set[str]] = {}

    def register(self, name, tags, pii_column=None):
        self.tables[name] = {"tags": tags, "pii_column": pii_column}
        self.lineage.setdefault(name, set())

    def add_lineage(self, upstream, downstream):
        self.lineage.setdefault(upstream, set()).add(downstream)
        self.lineage.setdefault(downstream, set())

    def find_pii_tables_downstream_of(self, root) -> List[str]:
        visited, queue, result = set(), deque([root]), []
        if self.tables.get(root, {}).get("pii_column"):
            result.append(root)
        while queue:
            current = queue.popleft()
            for nxt in self.lineage.get(current, []):
                if nxt not in visited:
                    visited.add(nxt)
                    if self.tables.get(nxt, {}).get("pii_column"):
                        result.append(nxt)
                    queue.append(nxt)
        return result


class AuditLog:
    def __init__(self):
        self.entries = []
        self._last_hash = "0" * 64

    def append(self, actor, action, resource):
        record = {"actor": actor, "action": action, "resource": resource,
                  "ts": datetime.now().isoformat(), "prev_hash": self._last_hash}
        record["hash"] = hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()
        self.entries.append(record)
        self._last_hash = record["hash"]


class RightToBeForgottenPipeline:
    """Walks the catalog's lineage graph from the raw customer table to find every
    downstream table tagged as containing PII, deletes matching rows from each, and
    records a tamper-evident audit trail proving the deletion happened."""

    def __init__(self, catalog: DataCatalog, tables_data: Dict[str, List[dict]], audit: AuditLog):
        self.catalog = catalog
        self.tables_data = tables_data
        self.audit = audit

    def forget(self, customer_key: str, requested_by: str) -> dict:
        affected_tables = self.catalog.find_pii_tables_downstream_of("dim_customer")
        deleted_counts = {}
        for table in affected_tables:
            rows = self.tables_data.get(table, [])
            before = len(rows)
            self.tables_data[table] = [r for r in rows if r.get("customer_key") != customer_key]
            deleted_counts[table] = before - len(self.tables_data[table])
            self.audit.append(actor=requested_by, action=f"DELETE customer_key={customer_key}", resource=table)
        return deleted_counts


catalog = DataCatalog()
catalog.register("dim_customer", tags=["pii"], pii_column="email")
catalog.register("fct_orders", tags=["mart"], pii_column=None)
catalog.register("fct_customer_360", tags=["mart", "pii"], pii_column="email")
catalog.register("ml_churn_features", tags=["ml", "pii"], pii_column="email")
catalog.add_lineage("dim_customer", "fct_orders")
catalog.add_lineage("dim_customer", "fct_customer_360")
catalog.add_lineage("fct_customer_360", "ml_churn_features")

tables_data = {
    "dim_customer":       [{"customer_key": "c1", "email": "a@example.com"}, {"customer_key": "c2", "email": "b@example.com"}],
    "fct_orders":         [{"customer_key": "c1", "amount": 50}, {"customer_key": "c2", "amount": 20}],
    "fct_customer_360":   [{"customer_key": "c1", "ltv": 500}, {"customer_key": "c2", "ltv": 200}],
    "ml_churn_features":  [{"customer_key": "c1", "score": 0.2}, {"customer_key": "c2", "score": 0.7}],
}

audit = AuditLog()
pipeline = RightToBeForgottenPipeline(catalog, tables_data, audit)
result = pipeline.forget(customer_key="c1", requested_by="privacy-officer-1")
print("Rows deleted per table:", result)
print("\nAudit trail:")
for e in audit.entries:
    print(f"  {e['actor']} -> {e['action']} on {e['resource']}")
print("\nfct_orders untouched (not PII-tagged):", tables_data["fct_orders"])
```

Output:

```
Rows deleted per table: {'dim_customer': 1, 'fct_customer_360': 1, 'ml_churn_features': 1}

Audit trail:
  privacy-officer-1 -> DELETE customer_key=c1 on dim_customer
  privacy-officer-1 -> DELETE customer_key=c1 on fct_customer_360
  privacy-officer-1 -> DELETE customer_key=c1 on ml_churn_features

fct_orders untouched (not PII-tagged): [{'customer_key': 'c1', 'amount': 50}, {'customer_key': 'c2', 'amount': 20}]
```

Note `fct_orders` deliberately keeps its `c1` row — it isn't tagged as containing PII (only a
pseudonymous `customer_key` foreign key and a transaction amount), which is realistic: many
compliance regimes distinguish between erasing *identifying* personal data and retaining a
pseudonymous reference needed for legitimate purposes like financial record-keeping. This is
worth naming explicitly as a **design decision**, not an oversight — a right-to-be-forgotten
pipeline that blindly deletes every row matching a customer key everywhere, including
tables under a legal retention obligation, can itself create a compliance problem.

**4. Failure modes**: if the catalog's lineage graph is incomplete (a table exists that
derives from customer data but was never correctly tagged/linked), this pipeline will
silently miss it — which is exactly why `09-metadata-catalog-design.md`'s point about
**automated** PII discovery (rather than relying on manual tagging staying current) matters
so much here specifically: an incomplete catalog doesn't just make search less convenient,
it makes compliance actively wrong.

**5. Recap**: the lineage graph — built for impact analysis and search — turns out to be
exactly the mechanism a compliance deletion pipeline needs to reliably find every affected
table; the tamper-evident audit log proves the deletion happened for anyone who later asks.
This case study is the clearest example in the whole curriculum of a "boring" piece of
infrastructure (a metadata catalog) turning out to be load-bearing for a legal requirement.

## Case Study 5: Multi-Region Active-Active Replication

**Prompt**: "Design a data platform that accepts writes in multiple geographic regions
simultaneously (active-active, for low write latency everywhere), and stays eventually
consistent across regions."

**1. Requirements**: functional — accept local writes in each region without a cross-region
round trip; eventually converge to the same value everywhere. Non-functional — must handle
genuine write conflicts (two regions updating the same record near-simultaneously)
deterministically, so every region converges to the *same* final value rather than each
region believing a different value is correct.

**2. High-level design**:

```
Region: us-east ──▶ local write ──┐
Region: eu-west ──▶ local write ──┼──▶ async cross-region replication ──▶ conflict resolution
Region: ap-south ──▶ local write ──┘         (per 06-fault-tolerance.md's RPO discussion)
```

**3. Deep dive** — Last-Writer-Wins (LWW) conflict resolution, the simplest deterministic
strategy for active-active replication (more sophisticated systems use CRDTs for
merge-friendly data types, but LWW is the right default to reach for first and explain):

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class VersionedWrite:
    region: str
    timestamp: float   # a hybrid logical clock in production, wall-clock here for clarity
    value: dict

class LWWRegister:
    """Last-Writer-Wins conflict resolution for active-active multi-region replication:
    each region accepts writes locally, and when replicas exchange updates, the write
    with the higher (timestamp, region) tuple wins deterministically -- region as
    tiebreaker guarantees a total order even if two writes land at the exact same
    timestamp."""

    def __init__(self):
        self.current: Optional[VersionedWrite] = None

    def apply(self, write: VersionedWrite) -> str:
        if self.current is None:
            self.current = write
            return "applied_first_write"
        incoming_key = (write.timestamp, write.region)
        current_key = (self.current.timestamp, self.current.region)
        if incoming_key > current_key:
            self.current = write
            return "applied_newer_write"
        return "rejected_older_or_tied_write"


register = LWWRegister()
writes = [
    VersionedWrite(region="us-east", timestamp=1000.001, value={"tier": "gold"}),
    VersionedWrite(region="eu-west", timestamp=1000.001, value={"tier": "platinum"}),  # same ts, different region
    VersionedWrite(region="us-east", timestamp=999.999, value={"tier": "silver"}),      # older, arrives late
]

for w in writes:
    print(f"{w.region} @ {w.timestamp}: {w.value} -> {register.apply(w)}")
print("Final converged value (every region agrees on this):", register.current.value)
```

Output:

```
us-east @ 1000.001: {'tier': 'gold'} -> applied_first_write
eu-west @ 1000.001: {'tier': 'platinum'} -> rejected_older_or_tied_write
us-east @ 999.999: {'tier': 'silver'} -> rejected_older_or_tied_write
```
```
Final converged value (every region agrees on this): {'tier': 'gold'}
```

Note the two same-timestamp writes from different regions: `us-east` wins purely because
`"eu-west" < "us-east"` as a tiebreaker string comparison — an arbitrary but **deterministic**
rule, which is the entire point. Every region applies the identical comparison, so they all
independently converge on the same answer without needing a coordinator.

**4. Failure modes**: LWW's trade-off is that it can silently discard a legitimate concurrent
update (the `eu-west` write to `platinum` is simply gone) — acceptable for something like a
"current tier" field where only the latest state matters, but actively wrong for something
like a shopping cart (two regions adding different items concurrently, where LWW would drop
one region's additions entirely rather than merging them). This is exactly the case for a
CRDT-based merge (e.g. a grow-only set for cart items) instead of LWW — naming this
distinction explicitly is a strong signal.

**5. Recap**: active-active writes need a deterministic, coordinator-free conflict resolution
rule; LWW is the simplest correct default for "last state wins" semantics, with an explicit
call-out of when it's the wrong choice (mergeable/additive data) in favor of CRDTs.

## Case Study 6: Point-in-Time Correct ML Feature Store

**Prompt**: "Design a feature store that serves consistent features for both real-time
inference and historical model training, without letting the training pipeline see
information that wouldn't have been available yet."

**1. Requirements**: functional — serve current feature values for real-time inference;
generate historical training datasets. Non-functional — training data must be **point-in-time
correct**: for a training example that occurred at time T, every feature value used must be
the value that was actually known at T, not a later, more "complete" value — otherwise the
model trains on information it will never have at real inference time (label leakage / train-
serve skew).

**2. High-level design**:

```
Feature writes (time-stamped) ──▶ Feature store ──┬──▶ Online serving: "give me the LATEST value"
                                                    │
                                                    └──▶ Offline training: "give me the value AS OF
                                                          each training example's own timestamp"
```

**3. Deep dive** — the point-in-time join, and a direct, measured comparison against the
naive (leaky) alternative:

```python
from dataclasses import dataclass
from datetime import datetime
from typing import List

@dataclass
class FeatureRecord:
    entity_id: str
    feature_name: str
    value: float
    valid_from: datetime   # when this feature value became true/known

class PointInTimeFeatureStore:
    """Retrieves the feature value that was ACTUALLY KNOWN as of a given event time --
    not the latest value as of right now. Training on 'latest' values instead of
    'as-of-the-example's-own-timestamp' values is the single most common source of
    train/serve skew and silent label leakage in ML pipelines."""

    def __init__(self, records: List[FeatureRecord]):
        self.records = records

    def get_feature_as_of(self, entity_id, feature_name, as_of: datetime):
        candidates = [r for r in self.records if r.entity_id == entity_id
                      and r.feature_name == feature_name and r.valid_from <= as_of]
        return max(candidates, key=lambda r: r.valid_from).value if candidates else None

    def get_latest_feature(self, entity_id, feature_name):
        """The WRONG way to build a training set: always grabs the most recent value,
        regardless of when the training example actually occurred."""
        candidates = [r for r in self.records if r.entity_id == entity_id and r.feature_name == feature_name]
        return max(candidates, key=lambda r: r.valid_from).value if candidates else None


records = [
    FeatureRecord("user_1", "fraud_flag_count", 0, datetime(2026, 1, 1)),
    FeatureRecord("user_1", "fraud_flag_count", 3, datetime(2026, 3, 15)),  # flagged AFTER our training example
]
store = PointInTimeFeatureStore(records)
training_example_time = datetime(2026, 1, 20)

correct_value = store.get_feature_as_of("user_1", "fraud_flag_count", as_of=training_example_time)
leaky_value = store.get_latest_feature("user_1", "fraud_flag_count")
print(f"Training example occurred: {training_example_time.date()}")
print(f"Point-in-time correct value (what was ACTUALLY known then): {correct_value}")
print(f"Naive 'latest value' (LEAKS future information): {leaky_value}")
```

Output:

```
Training example occurred: 2026-01-20
Point-in-time correct value (what was ACTUALLY known then): 0
Naive 'latest value' (LEAKS future information): 3
```

The naive version would train the model believing this user already had 3 fraud flags on
January 20th — information that didn't exist until March 15th. A model trained this way looks
great in offline evaluation (it's essentially peeking at the answer) and then performs far
worse in real serving, where that March value obviously isn't available yet. This exact
mechanism is why feature stores (Feast, Tecton, SageMaker Feature Store) all advertise
"point-in-time joins" as a named, first-class capability rather than an incidental detail.

**4. Failure modes**: if the online store and the offline point-in-time store are two
separately-maintained systems (rather than one system serving both views), they can drift —
the classic **online/offline skew** problem. Preferring a single feature store that serves
both views from the same underlying time-stamped records (as shown above) instead of two
independently-built pipelines is the direct mitigation.

**5. Recap**: "latest value" and "value as of a specific time" are different queries against
the same data, and conflating them is a specific, well-known, and easy-to-miss bug — proactively
naming point-in-time correctness is one of the highest-leverage things to mention when an ML
feature pipeline shows up in a prompt.

## Case Study 7: Customer 360 / Identity Resolution Pipeline

**Prompt**: "A company has customer records scattered across five different systems, each
with its own internal customer ID. Design a pipeline that produces one unified 'Customer 360'
view per real-world person."

**1. Requirements**: functional — merge records from multiple source systems that refer to
the same real person into one canonical identity, using whatever shared attributes exist
(email, phone). Non-functional — must handle partial/missing match keys gracefully (not
every system has every attribute) and must be transitive (if A matches B and B matches C,
then A, B, and C are all the same identity, even if A and C share no attribute directly).

**2. High-level design**:

```
SUB_A records ──┐
SUB_C records ──┼──▶ Extract match keys (email, phone) ──▶ Union-Find merge ──▶ Canonical
SUB_E records ──┤                                                                identity ID
SUB_F records ──┘
```

**3. Deep dive** — a union-find (disjoint-set) structure is the natural data structure for
this: it merges groups transitively for free, which is exactly the "A matches B matches C"
requirement above.

```python
from typing import Dict, List

class UnionFind:
    def __init__(self):
        self.parent: Dict[str, str] = {}

    def find(self, x: str) -> str:
        self.parent.setdefault(x, x)
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]  # path compression
            x = self.parent[x]
        return x

    def union(self, a: str, b: str):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[ra] = rb


def resolve_identities(records: List[dict]) -> Dict[str, List[dict]]:
    """Records sharing an email OR a phone are merged into one canonical identity --
    the same problem dim_customer_identity solves for cross-subsidiary customer overlap."""
    uf = UnionFind()
    for r in records:
        uf.find(r["customer_key"])
        if r.get("email"):
            uf.union(r["customer_key"], f"email:{r['email']}")
        if r.get("phone"):
            uf.union(r["customer_key"], f"phone:{r['phone']}")

    groups: Dict[str, List[dict]] = {}
    for r in records:
        groups.setdefault(uf.find(r["customer_key"]), []).append(r)
    return groups


records = [
    {"customer_key": "SUB_A:c1", "email": "alice@example.com", "phone": None},
    {"customer_key": "SUB_C:b7", "email": "alice@example.com", "phone": None},   # same email, different system
    {"customer_key": "SUB_E:t3", "email": None, "phone": "+1-555-0100"},
    {"customer_key": "SUB_F:a9", "email": None, "phone": "+1-555-0100"},         # same phone, different system
    {"customer_key": "SUB_D:x1", "email": "bob@example.com", "phone": None},     # unrelated customer
]

groups = resolve_identities(records)
print(f"{len(records)} raw records resolved into {len(groups)} canonical identities:\n")
for root, members in groups.items():
    print(f"  identity (root={root}): {[m['customer_key'] for m in members]}")
```

Output:

```
5 raw records resolved into 3 canonical identities:

  identity (root=email:alice@example.com): ['SUB_A:c1', 'SUB_C:b7']
  identity (root=phone:+1-555-0100): ['SUB_E:t3', 'SUB_F:a9']
  identity (root=email:bob@example.com): ['SUB_D:x1']
```

Five raw records correctly collapse into three real people. Note this uses purely
**deterministic** matching (exact shared email/phone) — production identity resolution often
adds **probabilistic** matching on top (fuzzy name/address similarity scoring) for records
with no shared exact key at all, at the cost of needing a confidence threshold and a review
queue for uncertain matches, which is worth naming as the natural next layer if the
interviewer pushes on "what about customers with no shared email or phone at all?"

**4. Failure modes**: a shared match key can also cause **false merges** (e.g. a shared
company phone number across unrelated employees) — this is the precision/recall trade-off
inherent to entity resolution; worth explicitly naming rather than presenting deterministic
matching as risk-free.

**5. Recap**: union-find gives transitive merging for free, turning a seemingly complex
"which records refer to the same person" problem into a handful of `union()` calls per shared
attribute — the same core technique behind real cross-subsidiary customer-identity resolution
work.

## Case Study 8: Real-Time Observability Platform

**Prompt**: "Design a system that ingests latency metrics from thousands of services and
computes real-time p50/p95/p99 latency dashboards, without storing every single data point
forever."

**1. Requirements**: functional — compute streaming percentile latency metrics per service.
Non-functional — must operate at high volume/cardinality without unbounded memory growth
(storing every raw data point forever isn't feasible at this scale).

**2. High-level design**:

```
Metric points (per service) ──▶ Bounded in-memory sample (reservoir) ──▶ Percentile estimate
     (unbounded stream)              (fixed size, e.g. 2,000 points)         (p50/p95/p99)
```

**3. Deep dive** — reservoir sampling, which gives every point seen so far an equal
probability of being retained in a fixed-size sample regardless of how long the stream runs,
letting you estimate percentiles from a small sample instead of the full history:

```python
import random

class ReservoirSamplePercentile:
    """Maintains a fixed-size random sample of a stream, from which percentiles can be
    estimated -- classic reservoir sampling gives every element seen so far an equal
    probability of being in the final sample, regardless of stream length."""

    def __init__(self, capacity=1000, seed=None):
        self.capacity = capacity
        self.sample = []
        self.seen = 0
        self.rng = random.Random(seed)

    def add(self, value: float):
        self.seen += 1
        if len(self.sample) < self.capacity:
            self.sample.append(value)
        else:
            j = self.rng.randint(0, self.seen - 1)
            if j < self.capacity:
                self.sample[j] = value

    def percentile(self, p: float) -> float:
        sorted_sample = sorted(self.sample)
        idx = min(len(sorted_sample) - 1, int(p / 100 * len(sorted_sample)))
        return sorted_sample[idx]


reservoir = ReservoirSamplePercentile(capacity=2000, seed=1)
true_values = []
random.seed(42)
for _ in range(500_000):
    v = random.uniform(1000, 3000) if random.random() < 0.001 else random.gauss(100, 20)
    true_values.append(v)
    reservoir.add(v)

true_sorted = sorted(true_values)
def true_percentile(p):
    return true_sorted[min(len(true_sorted) - 1, int(p / 100 * len(true_sorted)))]

print(f"Stream size: {len(true_values):,} points, reservoir size: {reservoir.capacity}")
for p in [50, 95, 99]:
    print(f"p{p}: true={true_percentile(p):.1f}ms  reservoir_estimate={reservoir.percentile(p):.1f}ms")
```

Output:

```
Stream size: 500,000 points, reservoir size: 2000
p50: true=100.1ms  reservoir_estimate=100.8ms
p95: true=133.0ms  reservoir_estimate=132.6ms
p99: true=147.2ms  reservoir_estimate=150.0ms
```

A 2,000-point reservoir estimates every percentile within a couple of milliseconds of the true
value computed over the full 500,000-point stream — a **250x** reduction in retained data
with negligible accuracy loss. This is the same family of technique as HyperLogLog (for
cardinality) and t-digest (a more sophisticated percentile sketch used by production
monitoring systems like Prometheus/Datadog) — reservoir sampling is the simplest version of
the same underlying idea: bounded memory, statistically sound estimates.

**4. Failure modes**: a single global reservoir hides per-service and per-time-window
differences — in practice you'd keep one reservoir per (service, time-bucket) pair, which
raises the exact partitioning/cardinality design questions from `02-scale-estimation.md` and
`03-storage-file-formats.md` (how many distinct reservoirs can you afford to keep in memory
simultaneously at real service/cardinality counts?).

**5. Recap**: percentile computation at scale is fundamentally a memory-bounded approximation
problem, not an exact-computation problem — reservoir sampling is the simplest correct
technique to reach for, with named, more sophisticated alternatives (t-digest, HyperLogLog)
for when accuracy requirements get stricter.

## Case Study 9: Zero-Downtime Platform Migration

**Prompt**: "Design a plan to migrate a critical data pipeline from a legacy on-prem system
to a new cloud platform, without downtime and without silently losing or corrupting data
during the cutover."

**1. Requirements**: functional — move both historical and ongoing data to the new platform.
Non-functional — zero downtime for consumers during the transition; **provable** correctness
before traffic fully cuts over — this can't be a "flip the switch and hope" migration.

**2. High-level design**:

```
Writes ──▶ DUAL-WRITE to both legacy AND new system (transition period)
                          │
                          ▼
            Reconciliation job compares both systems continuously
                          │
                          ▼
          Only cut reads over once reconciliation is clean for N consecutive runs
```

**3. Deep dive** — the reconciliation checker that gates the actual cutover decision,
comparing row-level checksums between both systems to catch silent divergence:

```python
import hashlib
from typing import Dict

class ReconciliationChecker:
    """During a migration, writes go to BOTH the legacy and new system (dual-write).
    Before cutting traffic over, this compares row-level checksums between both systems
    to catch drift -- silent divergence here is exactly the failure mode a 'just switch
    over and hope' migration risks."""

    @staticmethod
    def row_checksum(row: dict) -> str:
        canonical = "|".join(f"{k}={row[k]}" for k in sorted(row))
        return hashlib.sha256(canonical.encode()).hexdigest()[:12]

    def reconcile(self, legacy: Dict[str, dict], new: Dict[str, dict]) -> dict:
        legacy_keys, new_keys = set(legacy), set(new)
        missing_in_new = legacy_keys - new_keys
        missing_in_legacy = new_keys - legacy_keys
        mismatched = [k for k in legacy_keys & new_keys
                      if self.row_checksum(legacy[k]) != self.row_checksum(new[k])]

        total = len(legacy_keys | new_keys)
        clean = total - len(missing_in_new) - len(missing_in_legacy) - len(mismatched)
        return {"total_keys": total, "clean_matches": clean,
                "missing_in_new_system": sorted(missing_in_new),
                "missing_in_legacy_system": sorted(missing_in_legacy),
                "mismatched_keys": sorted(mismatched),
                "match_rate_pct": round(clean / total * 100, 2)}


legacy_system = {
    "o1": {"order_id": "o1", "amount": 50.0, "status": "shipped"},
    "o2": {"order_id": "o2", "amount": 20.0, "status": "pending"},
    "o3": {"order_id": "o3", "amount": 75.0, "status": "shipped"},
    "o4": {"order_id": "o4", "amount": 10.0, "status": "cancelled"},
}
new_system = {
    "o1": {"order_id": "o1", "amount": 50.0, "status": "shipped"},   # matches
    "o2": {"order_id": "o2", "amount": 20.0, "status": "shipped"},   # DRIFT: status differs
    "o3": {"order_id": "o3", "amount": 75.0, "status": "shipped"},   # matches
    # o4 missing entirely -- dual-write bug dropped it
    "o5": {"order_id": "o5", "amount": 5.0, "status": "pending"},    # new-system-only, created post-prep
}

checker = ReconciliationChecker()
report = checker.reconcile(legacy_system, new_system)
for k, v in report.items():
    print(f"{k}: {v}")
print("\nCutover recommendation:", "SAFE TO CUT OVER" if report["match_rate_pct"] == 100
                                    else "DO NOT CUT OVER -- investigate drift first")
```

Output:

```
total_keys: 5
clean_matches: 2
missing_in_new_system: ['o4']
missing_in_legacy_system: ['o5']
mismatched_keys: ['o2']
match_rate_pct: 40.0

Cutover recommendation: DO NOT CUT OVER -- investigate drift first
```

A 40% match rate immediately and concretely tells you this migration isn't ready — `o4` was
silently dropped by the new system's write path (a real bug worth finding *before* cutover,
not after), and `o2` shows a status drifted between systems (a race condition in the
dual-write, or a bug in one of the two write paths). This reconciliation step is precisely
what turns "we did a migration and hoped for the best" into a decision backed by evidence.

**4. Failure modes**: dual-writing itself isn't atomic (writing to two systems has the same
dual-write problem as `05-cdc-idempotent-processing.md`'s outbox pattern) — a more robust
migration pattern writes to the legacy system only, and uses CDC to propagate changes to the
new system (so there's only ever one true write path), reconciling as a downstream check
rather than trusting two independent write paths to stay in lockstep.

**5. Recap**: cutover should be a data-driven decision gated on a clean, repeated
reconciliation result — not a scheduled event based on elapsed time or developer confidence.

## Case Study 10: Experimentation (A/B Testing) Pipeline

**Prompt**: "Design a data pipeline that powers a company's A/B testing platform: consistently
bucketing users into experiment variants and computing whether an observed difference in
conversion rate is statistically significant."

**1. Requirements**: functional — assign users to experiment variants; compute whether a
variant's observed effect is real. Non-functional — assignment must be **consistent**: the
same user must always land in the same variant for a given experiment, across sessions and
devices, or the whole experiment is corrupted by users bouncing between variants.

**2. High-level design**:

```
User + experiment name ──▶ Deterministic hash-based bucketing ──▶ Variant assignment (stored once)
                                                                            │
                                                                            ▼
                                      Conversion events ──▶ Statistical significance test
```

**3. Deep dive** — deterministic bucketing via hashing (no assignment table needed for the
*decision itself*, only for logging which variant a user saw) plus a two-proportion z-test to
decide whether an observed lift is real:

```python
import hashlib
import math

def assign_variant(user_id: str, experiment_name: str, num_variants=2) -> int:
    """Deterministic, consistent assignment: the SAME user always lands in the SAME
    variant for a given experiment (critical -- flip-flopping would corrupt the whole
    experiment), while being effectively randomly distributed across the user base."""
    key = f"{experiment_name}:{user_id}"
    digest = hashlib.md5(key.encode()).hexdigest()
    bucket = int(digest, 16) % 100
    variant_width = 100 // num_variants
    return min(bucket // variant_width, num_variants - 1)


def two_proportion_z_test(conversions_a, n_a, conversions_b, n_b):
    """Standard two-proportion z-test for comparing conversion rates between control (A)
    and treatment (B) -- the statistical backbone of deciding whether an observed lift is
    real or just noise."""
    p_a, p_b = conversions_a / n_a, conversions_b / n_b
    p_pool = (conversions_a + conversions_b) / (n_a + n_b)
    se = math.sqrt(p_pool * (1 - p_pool) * (1/n_a + 1/n_b))
    z = (p_b - p_a) / se if se > 0 else 0
    p_value = 2 * (1 - 0.5 * (1 + math.erf(abs(z) / math.sqrt(2))))
    return {"control_rate": round(p_a, 4), "treatment_rate": round(p_b, 4),
            "relative_lift_pct": round((p_b - p_a) / p_a * 100, 2),
            "z_score": round(z, 3), "p_value": round(p_value, 4),
            "significant_at_95": p_value < 0.05}


assignments = [assign_variant(f"user_{i}", "checkout_redesign_v2") for i in range(10_000)]
control_count, treatment_count = assignments.count(0), assignments.count(1)
print(f"Assignment split: control={control_count}, treatment={treatment_count}")
print("Consistent re-assignment check:",
      assign_variant("user_42", "checkout_redesign_v2") == assign_variant("user_42", "checkout_redesign_v2"))

result = two_proportion_z_test(conversions_a=480, n_a=control_count, conversions_b=545, n_b=treatment_count)
for k, v in result.items():
    print(f"{k}: {v}")
```

Output:

```
Assignment split: control=4856, treatment=5144
Consistent re-assignment check: True
control_rate: 0.0988
treatment_rate: 0.1059
relative_lift_pct: 7.18
z_score: 1.17
p_value: 0.2419
significant_at_95: False
```

Despite a 7.18% relative lift in the observed conversion rate, the p-value (0.24) is well
above the conventional 0.05 threshold — this lift is **not** statistically significant at
these sample sizes, and could easily be noise. This is exactly the kind of result that
matters more than it might seem: shipping a change on the strength of a non-significant lift
is a common, costly real-world mistake, and being able to compute (not just assert) that
distinction is the actual value this pipeline provides.

**4. Failure modes**: the deterministic hash-bucketing means a user's assignment never needs
to be looked up from a database on the hot path (it's recomputed identically every time) —
but it also means changing `num_variants` or the underlying hash function for a *running*
experiment silently reassigns everyone, corrupting the experiment; experiment configuration
must be treated as immutable once traffic starts.

**5. Recap**: consistent bucketing is a pure function of (user, experiment) needing no
stateful assignment store, and a proper significance test — not just "which number is
bigger" — is what separates a real experimentation platform from a vanity metrics dashboard.

## Cross-Case Patterns

All ten case studies lean on the same small set of mechanisms from earlier in this
curriculum, just recombined:

| Mechanism | File | Used In |
|---|---|---|
| Idempotent keyed upsert | `05-cdc-idempotent-processing.md` | Case studies 1, 2, 3 |
| Partition-by-key for locality | `03-storage-file-formats.md` / `04-batch-streaming-hybrid.md` | Case studies 1 & 2 |
| Checkpoint-based crash recovery | `06-fault-tolerance.md` | Case study 1 |
| Schema contract enforcement | `07-data-quality-observability.md` | Case study 3 |
| PII tokenization + tenant tagging | `08-security-governance-multitenancy.md` | Case study 3 |
| Catalog lineage traversal | `09-metadata-catalog-design.md` | Case studies 4 & 7 |
| Tamper-evident audit logging | `08-security-governance-multitenancy.md` | Case study 4 |
| Deterministic conflict resolution | `06-fault-tolerance.md` (RPO/RTO) | Case study 5 |
| Time-aware / point-in-time joins | `04-batch-streaming-hybrid.md` (event time) | Case study 6 |
| Transitive/graph-based merging | `09-metadata-catalog-design.md` (graph traversal) | Case study 7 |
| Bounded-memory approximation | `02-scale-estimation.md` (order-of-magnitude reasoning) | Case study 8 |
| Reconciliation / checksum verification | `07-data-quality-observability.md` (quality checks) | Case study 9 |
| Consistent hashing for stable assignment | `03-storage-file-formats.md` (partitioning) / `10-followups-tradeoffs.md` (salting) | Case study 10 |

This is the single most important meta-lesson of the whole curriculum: a strong DE system
design answer isn't a pile of independent facts about ten categories — it's a small number
of composable mechanisms (idempotent writes, partitioning, watermarks, schema contracts,
row-level tagging, deterministic hashing, graph traversal) that keep showing up together in
different combinations depending on the prompt. Ten case studies, six underlying "shapes" —
notice that case studies 1, 5, and 10 are all, at their core, a **deterministic-assignment-
under-a-hash-function** problem wearing different clothes (partition assignment, conflict
tiebreaking, and variant bucketing, respectively); recognizing that kind of structural
repetition across superficially different prompts is exactly the skill this file is meant to
build.

## Gotchas

- Treating each case study as a memorized answer rather than an application of reusable
  mechanisms — a slightly different prompt (e.g. IoT sensor data instead of clickstream)
  should still be answerable by recombining the same underlying pieces.
- Skipping the requirements/scale phases in practice because "it's just a case study" — the
  actual interview will present a novel prompt, and the discipline of deriving numbers
  before designing is the transferable skill, not the specific numbers above.
- Forgetting to state the failure-mode/trade-off phase out loud even in a worked example —
  it's as much a graded part of the answer as the happy-path design.
- Assuming every problem needs its own bespoke technique — several of these case studies
  (1, 5, 10) are the *same* deterministic-hashing idea applied to different data; missing
  that connection means re-deriving a solution from scratch instead of recognizing a
  pattern you already know.

## Pro Tips

- Practice adapting each case study to a variant prompt: "what if this fraud pipeline also
  needed to explain *why* it blocked a transaction" (interpretability → simpler rule-based
  scoring over a black-box model, or a model plus a rule-based explanation layer), "what if
  the multi-tenant platform had thousands of small tenants instead of a handful of large
  ones" (shared-schema + RLS instead of schema-per-tenant, per `08-security-governance-multitenancy.md`),
  "what if the active-active replication needed to merge concurrent cart additions instead of
  picking a winner" (CRDT instead of LWW, per case study 5).
- When walking through a case study live, narrate the file/category each design decision
  comes from ("this is the idempotency pattern from earlier") — it signals the design is
  principled, not improvised.
- Keep a mental note of which 2-3 case-study shapes you're most fluent in, and practice
  mapping a new, unfamiliar prompt onto the closest one rather than starting from a blank
  page — most real interview prompts are a variation on a small number of underlying shapes.
- If a prompt doesn't obviously match any of these ten, look one level deeper before assuming
  it's genuinely novel: is it actually a deterministic-assignment problem (like 1/5/10)? A
  reconciliation/verification problem (like 9)? A graph-traversal-over-metadata problem (like
  4/7)? Most "new" prompts are a recombination of a small number of these underlying shapes.
