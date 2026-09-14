# Scale & Capacity Estimation — System Design for Data Engineers

> Back-of-envelope math: events/day → throughput, storage, and cost. The estimation step
> interviewers use to check whether your architecture actually holds up, or whether you'd
> pick the same design for 10K events/day as for 10 billion.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Quick-Reference Table: Useful Numbers](#quick-reference-table-useful-numbers)
3. [The Estimation Pipeline](#the-estimation-pipeline)
4. [Events/Day → Throughput](#eventsday--throughput)
5. [Storage Estimation](#storage-estimation)
6. [Cost Estimation](#cost-estimation)
7. [Little's Law for Concurrency](#littles-law-for-concurrency)
8. [Python: A Complete Estimation Toolkit](#python-a-complete-estimation-toolkit)
9. [Worked Example: Clickstream Analytics](#worked-example-clickstream-analytics)
10. [Compute Cost Estimation (Bytes-Scanned Pricing)](#compute-cost-estimation-bytes-scanned-pricing)
11. [Worked Example: IoT Sensor Bursty Traffic](#worked-example-iot-sensor-bursty-traffic)
12. [Network Bandwidth Estimation](#network-bandwidth-estimation)
13. [Peak vs. Average, and Why It Matters](#peak-vs-average-and-why-it-matters)
14. [When Estimation Should Change the Architecture](#when-estimation-should-change-the-architecture)
15. [Gotchas](#gotchas)
16. [Pro Tips](#pro-tips)

---

## Core Concepts

Capacity estimation converts a vague scale statement ("we have a lot of users") into
concrete numbers you can design against: events per second, bytes per day, storage growth
per year, and rough dollar cost. You are not aiming for precision — you're aiming for the
right **order of magnitude**, fast, narrated out loud.

Three numbers matter more than any others in a DE context:
1. **Throughput** (events/sec, both average and peak) — drives partition counts, consumer
   parallelism, and whether batch is even viable.
2. **Storage growth** (GB/day, TB/year) — drives partitioning/retention policy and storage
   tier choice.
3. **Cost** (rough $/month) — drives whether the "textbook best" design is actually
   appropriate, or over-engineered for the budget implied by the prompt.

## Quick-Reference Table: Useful Numbers

Numbers worth memorizing so you're not deriving them from scratch mid-interview:

| Quantity | Approximate Value |
|---|---|
| Seconds per day | 86,400 |
| Seconds per month | ~2,592,000 (30 days) |
| 1 million events/day | ~11.6 events/sec average |
| 1 billion events/day | ~11,600 events/sec average |
| Typical JSON event size | 0.5–2 KB |
| Typical Parquet compression vs. raw JSON | 4x–10x smaller |
| Typical replication factor (Kafka/HDFS) | 3 |
| S3 Standard storage | ~$0.023/GB-month |
| S3 Infrequent Access | ~$0.0125/GB-month |
| Snowflake/BigQuery storage | ~$0.02–0.025/GB-month (compressed) |
| Reading 1 GB from disk | ~20 ms (SSD), ~2–5 ms (NVMe) |
| Network round trip, same region | ~0.5–2 ms |
| Network round trip, cross-region | ~50–150 ms |

These let you sanity-check answers quickly: if someone estimates 50 TB/day from 1M events/day
at 500 bytes each, that's obviously wrong (1M × 500 bytes ≈ 500 MB/day) — a good estimation
habit catches your own arithmetic errors before the interviewer does.

## The Estimation Pipeline

```
Stated/assumed scale (e.g. "50M DAU, 20 events/user/day")
        │
        ▼
Events/day  ──▶  Events/sec (avg + peak)  ──▶  Concurrency / partition count
        │
        ▼
Avg record size  ──▶  Raw bytes/day  ──▶  Compressed + replicated bytes/day
        │
        ▼
Retention period  ──▶  Total storage footprint  ──▶  Rough $/month
```

Always derive numbers in this order — throughput and storage both start from the same
events/day figure, so getting that one number right (and narrating how you got it) anchors
everything downstream.

## Events/Day → Throughput

```python
def events_per_second(events_per_day: float, peak_multiplier: float = 3.0) -> dict:
    """peak_multiplier: how much higher peak traffic runs vs. average -- 3x-5x is a
    reasonable default for consumer-facing systems with daily/weekly usage cycles."""
    avg_per_sec = events_per_day / 86_400
    peak_per_sec = avg_per_sec * peak_multiplier
    return {
        "avg_events_per_sec": round(avg_per_sec, 2),
        "peak_events_per_sec": round(peak_per_sec, 2),
    }


print(events_per_second(events_per_day=500_000_000, peak_multiplier=4))
```

Output:

```
{'avg_events_per_sec': 5787.04, 'peak_events_per_sec': 23148.15}
```

**Why peak matters more than average**: your infrastructure has to survive the peak, not
just the daily average. A design that comfortably handles ~5,800 events/sec average but
falls over at the ~23,000 events/sec peak (e.g. flash sale, morning login spike, end-of-month
batch close) is a design that fails in production even though its "average" numbers looked fine.

## Storage Estimation

```python
def storage_estimate(events_per_day: float, avg_record_bytes: float,
                      retention_days: int, replication_factor: int = 3,
                      compression_ratio: float = 0.25) -> dict:
    """
    compression_ratio: fraction of original size remaining after compression
    (0.25 == 4x compression, typical for columnar Parquet/ORC on semi-structured events).
    """
    raw_bytes_per_day = events_per_day * avg_record_bytes
    compressed_bytes_per_day = raw_bytes_per_day * compression_ratio
    stored_bytes_per_day = compressed_bytes_per_day * replication_factor
    total_stored_bytes = stored_bytes_per_day * retention_days

    def to_human(n_bytes):
        for unit in ["B", "KB", "MB", "GB", "TB", "PB"]:
            if n_bytes < 1024:
                return f"{n_bytes:.2f} {unit}"
            n_bytes /= 1024
        return f"{n_bytes:.2f} EB"

    return {
        "raw_per_day": to_human(raw_bytes_per_day),
        "compressed_per_day": to_human(compressed_bytes_per_day),
        "stored_per_day_with_replication": to_human(stored_bytes_per_day),
        "total_stored_over_retention": to_human(total_stored_bytes),
    }


print(storage_estimate(events_per_day=500_000_000, avg_record_bytes=500,
                        retention_days=365, replication_factor=3, compression_ratio=0.25))
```

Output:

```
{'raw_per_day': '232.83 GB', 'compressed_per_day': '58.21 GB',
 'stored_per_day_with_replication': '174.62 GB', 'total_stored_over_retention': '62.24 TB'}
```

Note the **replication factor** is about durability (3 copies in Kafka/HDFS-style storage),
while **compression ratio** is about format efficiency — these are independent multipliers
and it's a common mistake to only apply one of them.

## Cost Estimation

```python
def storage_cost_estimate(total_bytes: float, price_per_gb_month: float = 0.023) -> float:
    """Default approximates S3 Standard per-GB/month; swap in the actual provider rate
    (Snowflake/BigQuery/GCS/ADLS all land in a similar $0.015-0.025/GB-month band)."""
    gb = total_bytes / (1024 ** 3)
    return round(gb * price_per_gb_month, 2)


raw_bytes_per_day = 500_000_000 * 500
total_bytes = raw_bytes_per_day * 0.25 * 3 * 365
print("Est. monthly storage cost ($):", storage_cost_estimate(total_bytes))
```

Output:

```
Est. monthly storage cost ($): 1465.96
```

This is intentionally rough — it excludes compute (the usually-larger cost line item for
Spark/warehouse queries), but it's exactly the kind of number an interviewer wants to hear
you produce out loud when they ask "roughly what would this cost to run?" Compute cost is
much harder to estimate generically since it depends heavily on query patterns; it's fine to
say so and instead reason about *cost drivers* (bytes scanned per query, clustering/partition
pruning effectiveness, warehouse idle time) rather than a fabricated dollar figure.

## Little's Law for Concurrency

Little's Law (`L = λ × W`) relates the number of items "in flight" (`L`) to the arrival rate
(`λ`) and the average time each item spends in the system (`W`). In a DE context this answers
"how many concurrent consumer tasks / partitions / connections do I need to keep up?"

```python
from dataclasses import dataclass


@dataclass
class LittlesLawResult:
    concurrency_needed: float


def littles_law(arrival_rate_per_sec: float, avg_processing_time_sec: float) -> LittlesLawResult:
    """L = lambda * W -- concurrent workers/partitions needed to keep up with an arrival
    rate given an average per-item processing time."""
    return LittlesLawResult(concurrency_needed=round(arrival_rate_per_sec * avg_processing_time_sec, 2))


ll = littles_law(arrival_rate_per_sec=23_148.15, avg_processing_time_sec=0.05)
print("Concurrent workers needed at peak:", ll.concurrency_needed)
```

Output:

```
Concurrent workers needed at peak: 1157.41
```

If each event takes 50ms to process end-to-end and you're receiving ~23K events/sec at peak,
you need roughly 1,157 units of concurrency (partitions × consumers-per-partition, or
worker threads) in flight simultaneously to avoid unbounded queue growth. This is exactly
the kind of number that turns "we'll use Kafka with some partitions" into "we need on the
order of ~1,200 partitions/consumer-slots at peak, so realistically N partitions with M
consumer instances each running P threads."

## Python: A Complete Estimation Toolkit

Putting it together into one reusable module you could sketch from memory:

```python
def full_estimate(events_per_day: float, avg_record_bytes: float, retention_days: int,
                   peak_multiplier: float = 4.0, replication_factor: int = 3,
                   compression_ratio: float = 0.25, price_per_gb_month: float = 0.023,
                   avg_processing_time_sec: float = 0.05) -> dict:
    throughput = events_per_second(events_per_day, peak_multiplier)
    storage = storage_estimate(events_per_day, avg_record_bytes, retention_days,
                                replication_factor, compression_ratio)
    raw_bytes_per_day = events_per_day * avg_record_bytes
    total_bytes = raw_bytes_per_day * compression_ratio * replication_factor * retention_days
    cost = storage_cost_estimate(total_bytes, price_per_gb_month)
    concurrency = littles_law(throughput["peak_events_per_sec"], avg_processing_time_sec)

    return {
        "throughput": throughput,
        "storage": storage,
        "monthly_storage_cost_usd": cost,
        "peak_concurrency_needed": concurrency.concurrency_needed,
    }


import json
print(json.dumps(full_estimate(events_per_day=500_000_000, avg_record_bytes=500,
                                retention_days=365), indent=2))
```

Output:

```json
{
  "throughput": {"avg_events_per_sec": 5787.04, "peak_events_per_sec": 23148.15},
  "storage": {
    "raw_per_day": "232.83 GB",
    "compressed_per_day": "58.21 GB",
    "stored_per_day_with_replication": "174.62 GB",
    "total_stored_over_retention": "62.24 TB"
  },
  "monthly_storage_cost_usd": 1465.96,
  "peak_concurrency_needed": 1157.41
}
```

## Worked Example: Clickstream Analytics

**Prompt**: "Design an analytics pipeline for an e-commerce site with 50M daily active
users, each generating ~20 click/view/purchase events/day, average event size 500 bytes,
1-year retention."

```
events_per_day = 50,000,000 users * 20 events/user = 1,000,000,000 events/day
```

Running `full_estimate(events_per_day=1_000_000_000, avg_record_bytes=500, retention_days=365)`
gives ~11,574 events/sec average, ~46,296/sec peak (4x multiplier), ~124 TB total storage
over the year, and ~$2,900/month in raw storage cost — before compute. That single set of
numbers is enough to justify (out loud, to the interviewer) choices like: a distributed
streaming ingestion layer (Kafka/Kinesis) rather than a single-node queue, partitioning by
event date + a hash of user ID, and a tiered storage policy (hot for 30 days, cold/archive
after that) to control the $2,900/month before it compounds across additional data domains.

## Compute Cost Estimation (Bytes-Scanned Pricing)

Storage cost is usually the smaller line item — most modern warehouses (BigQuery, Snowflake
with certain configurations) price **compute by bytes scanned per query**, and query volume
across a whole organization can dwarf storage cost:

```python
def compute_cost_estimate(queries_per_day, avg_bytes_scanned_per_query, price_per_tb_scanned=5.0):
    tb_scanned_per_day = (queries_per_day * avg_bytes_scanned_per_query) / (1024**4)
    monthly_tb = tb_scanned_per_day * 30
    return {
        "tb_scanned_per_day": round(tb_scanned_per_day, 4),
        "monthly_cost_usd": round(monthly_tb * price_per_tb_scanned, 2),
    }


print(compute_cost_estimate(queries_per_day=5000, avg_bytes_scanned_per_query=2 * 1024**3))
```

Output:

```
{'tb_scanned_per_day': 9.7656, 'monthly_cost_usd': 1464.84}
```

**Partition pruning directly reduces this bill** — every byte a query doesn't have to scan
because of good partition/clustering design is a byte you don't pay for:

```python
def compute_cost_with_pruning(queries_per_day, avg_bytes_scanned_per_query, prune_fraction, price_per_tb_scanned=5.0):
    effective_bytes = avg_bytes_scanned_per_query * (1 - prune_fraction)
    return compute_cost_estimate(queries_per_day, effective_bytes, price_per_tb_scanned)


no_pruning = compute_cost_estimate(queries_per_day=5000, avg_bytes_scanned_per_query=2 * 1024**3)
with_pruning = compute_cost_with_pruning(queries_per_day=5000, avg_bytes_scanned_per_query=2 * 1024**3, prune_fraction=0.9)
print("No partition pruning:", no_pruning)
print("With 90% partition pruning:", with_pruning)
print(f"Savings: {(1 - with_pruning['monthly_cost_usd']/no_pruning['monthly_cost_usd'])*100:.1f}%")
```

Output:

```
No partition pruning: {'tb_scanned_per_day': 9.7656, 'monthly_cost_usd': 1464.84}
With 90% partition pruning: {'tb_scanned_per_day': 0.9766, 'monthly_cost_usd': 146.48}
Savings: 90.0%
```

This is a concrete, quantified answer to "how would partitioning help with cost" — a
recurring bridge between this file and `03-storage-file-formats.md`.

## Worked Example: IoT Sensor Bursty Traffic

Not every system has a smooth consumer-style daily curve. IoT/sensor systems are a useful
contrast case: normal operation is steady and low, but a **reconnect storm** (e.g. every
device buffering and flushing at once after a network outage) can spike traffic far more
than the 3-5x multiplier that's typical for consumer apps.

```python
def events_per_second(events_per_day, peak_multiplier=4.0):
    avg = events_per_day / 86_400
    return {"avg_events_per_sec": round(avg, 2), "peak_events_per_sec": round(avg * peak_multiplier, 2)}


iot_sensors = 50_000
readings_per_sensor_per_day = 1440  # once per minute
iot_events_per_day = iot_sensors * readings_per_sensor_per_day

print("IoT baseline (normal peak multiplier):", events_per_second(iot_events_per_day, peak_multiplier=1.2))
print("IoT during a mass-reconnect storm:", events_per_second(iot_events_per_day, peak_multiplier=15))
```

Output:

```
IoT baseline (normal peak multiplier): {'avg_events_per_sec': 833.33, 'peak_events_per_sec': 1000.0}
IoT during a mass-reconnect storm: {'avg_events_per_sec': 833.33, 'peak_events_per_sec': 12500.0}
```

The design implication: a consumer-app assumption of "4x peak multiplier" would badly
under-provision this system for the specific failure mode that matters most for IoT — a
network blip causing every device to reconnect and flush its buffer simultaneously. Naming
this domain-specific risk (rather than reusing a generic multiplier) is exactly the kind of
detail that separates a memorized formula from real understanding of the domain.

## Network Bandwidth Estimation

Worth a quick mention alongside throughput and storage — ingestion bandwidth is occasionally
the actual bottleneck, particularly for bursty/IoT-style workloads or cross-region transfer:

```python
def bandwidth_estimate(events_per_sec, avg_record_bytes):
    bits_per_sec = events_per_sec * avg_record_bytes * 8
    return {"Mbps": round(bits_per_sec / 1_000_000, 2), "Gbps": round(bits_per_sec / 1_000_000_000, 3)}


peak_eps = events_per_second(iot_events_per_day, peak_multiplier=15)["peak_events_per_sec"]
print("Bandwidth at IoT reconnect-storm peak:", bandwidth_estimate(peak_eps, avg_record_bytes=200))
```

Output:

```
Bandwidth at IoT reconnect-storm peak: {'Mbps': 20.0, 'Gbps': 0.02}
```

Twenty Mbps is trivial for a typical data center ingest endpoint but could matter a great
deal for constrained links (satellite/cellular IoT backhaul, a single regional ingestion
point serving many remote sites) — worth naming as a possible bottleneck specifically when
the prompt hints at constrained or remote connectivity.

## Peak vs. Average, and Why It Matters

- **Design for peak, size cost for average.** Your architecture (partition counts, consumer
  scaling, warehouse concurrency) must handle peak load without falling over; your cost
  model should usually be based on average utilization plus autoscaling, not provisioning
  everything permanently at peak capacity.
- **Peak multiplier depends on the domain.** E-commerce: 3-5x around sales events. B2B SaaS:
  often a flatter curve (2x business-hours vs. off-hours). IoT/sensor data: can be extremely
  bursty (10x+) around specific triggering events.
- **State your assumed multiplier out loud.** "I'll assume a 4x peak-to-average ratio, which
  is typical for consumer traffic with daily cycles" is a complete, defensible sentence.

## When Estimation Should Change the Architecture

| If your numbers show... | ...consider |
|---|---|
| < ~1K events/sec, GB-scale/day | A single scheduled batch job may be entirely sufficient — no streaming platform needed |
| Tens of thousands of events/sec | Distributed streaming ingestion (Kafka/Kinesis/Pub-Sub) with multiple partitions |
| TB-scale storage/day | Columnar formats + partitioning become mandatory, not optional |
| PB-scale total storage | Storage tiering (hot/warm/cold) and lifecycle policies become a first-class design element |
| High peak-to-average ratio | Autoscaling consumers/warehouses, backpressure handling, and buffering become important |
| Tight freshness SLA + huge scale | Hybrid/Lambda-style design (streaming path for freshness, batch path for correctness) |

## Gotchas

- Forgetting to apply **both** compression and replication (or double counting one of them)
  is one of the most common estimation errors — narrate each multiplier separately.
- Using average throughput to size infrastructure that must survive peak load — this is the
  single most consequential estimation mistake because it produces designs that pass the
  interview but would fall over in production.
- Treating your estimate as exact. Round aggressively and say "roughly" — a confidently wrong
  precise number is worse than an honestly rough one.
- Ignoring **growth over time**. A 1-year snapshot estimate is fine for an interview, but
  mentioning "and this grows ~30%/year with the business, so partitioning/lifecycle policy
  needs to be revisited annually" shows deeper judgment.

## Pro Tips

- Always state your assumptions as you make them ("assuming 500-byte average event size,
  which is typical for a JSON clickstream event with a handful of fields").
- Anchor unfamiliar numbers to memorized reference points from the quick-reference table
  above rather than guessing blind.
- When the math gets complex, simplify by rounding to the nearest power of 10 first, get the
  order of magnitude right, then refine — this keeps you from stalling mid-calculation.
- Always connect the resulting number back to a design decision immediately — an estimate
  that doesn't change anything about your design wasn't worth doing out loud.
