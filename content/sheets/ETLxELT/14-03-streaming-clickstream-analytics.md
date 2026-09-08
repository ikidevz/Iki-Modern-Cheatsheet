# Example 3: Streaming Clickstream Analytics

**Pipeline Type: ETL** — Flink transforms (windowed aggregation) happen in-flight *before* data is loaded into Redis/Snowflake; nothing raw is landed first.

## Scenario & Business Context

The product team wants a live "active users right now" and "page views per minute" dashboard, updated within seconds, to monitor the impact of a marketing campaign launch in real time.

## Architecture

```
Web/App SDK → Kafka topic "clickstream"
                  │
                  ▼
           Flink Job (1-min tumbling window aggregation)
                  │
       ┌──────────┴──────────┐
       ▼                     ▼
   Redis (live dashboard)   Snowflake (historical analysis)
```

## Full Implementation

### 1. Event schema (Kafka, Avro)

```json
{
  "type": "record",
  "name": "ClickEvent",
  "fields": [
    {"name": "event_id", "type": "string"},
    {"name": "user_id", "type": "string"},
    {"name": "page_url", "type": "string"},
    {"name": "event_time", "type": "long"}
  ]
}
```

### 2. Flink SQL job

```sql
CREATE TABLE clickstream (
  event_id STRING,
  user_id STRING,
  page_url STRING,
  event_time TIMESTAMP(3),
  WATERMARK FOR event_time AS event_time - INTERVAL '10' SECOND
) WITH (
  'connector' = 'kafka',
  'topic' = 'clickstream',
  'properties.bootstrap.servers' = 'kafka:9092',
  'format' = 'avro'
);

CREATE TABLE page_metrics_redis (
  window_start TIMESTAMP(3),
  page_url STRING,
  views BIGINT,
  unique_users BIGINT
) WITH (
  'connector' = 'redis',
  'command' = 'HSET',
  'key-pattern' = 'metrics:{page_url}'
);

INSERT INTO page_metrics_redis
SELECT
  window_start,
  page_url,
  COUNT(*) AS views,
  COUNT(DISTINCT user_id) AS unique_users
FROM TABLE(
  TUMBLE(TABLE clickstream, DESCRIPTOR(event_time), INTERVAL '1' MINUTE)
)
GROUP BY window_start, page_url;
```

### 3. Parallel sink to Snowflake for historical analysis

```sql
CREATE TABLE page_metrics_snowflake (
  window_start TIMESTAMP(3),
  page_url STRING,
  views BIGINT,
  unique_users BIGINT
) WITH (
  'connector' = 'snowflake',
  'table-name' = 'analytics.page_metrics_1min'
);

INSERT INTO page_metrics_snowflake
SELECT window_start, page_url, COUNT(*), COUNT(DISTINCT user_id)
FROM TABLE(TUMBLE(TABLE clickstream, DESCRIPTOR(event_time), INTERVAL '1' MINUTE))
GROUP BY window_start, page_url;
```

### 4. Late-data handling

```sql
-- Allow 10 seconds of lateness via watermark above; explicitly drop anything later
-- to avoid unbounded state growth in the windowed aggregation.
```

## Design Rationale

- **Tumbling 1-minute windows** give clean, non-overlapping buckets ideal for a "per minute" metric — a sliding window would smooth the numbers but add unnecessary complexity for this use case (see file 06 — Windowing Strategies).
- **Dual sink (Redis + Snowflake)** separates concerns: Redis serves sub-second dashboard reads; Snowflake retains historical data for trend analysis — no single system is forced to do both jobs well.
- **Watermarking with bounded lateness** (10 seconds) balances completeness against unbounded state growth — a hard trade-off in any streaming aggregation.
- **At-least-once + idempotent HSET** — Redis `HSET` overwrites by key, so replaying an already-processed window doesn't double-count (see file 06 — Delivery Guarantees).

## Production Considerations

- Monitor **Flink checkpointing** — if checkpoints fail repeatedly, the job may reprocess large amounts of state on restart, causing metric spikes.
- Set **Kafka consumer lag alerts** — rising lag on the `clickstream` topic signals the Flink job can't keep up with event volume.
- Cap Redis key TTLs (e.g., 24 hours) so live-dashboard keys don't accumulate indefinitely.

## How to Extend This Example

- Add **session windows** (see file 06) to compute per-user session length alongside the per-minute view counts.
- Feed the same Kafka topic into a batch Spark job nightly to recompute exact historical aggregates as a Lambda-architecture correctness check against the streaming numbers (see file 06 — Lambda vs Kappa).
- Add anomaly detection on `views` — a sudden drop to zero likely indicates SDK/tracking failure rather than an actual traffic drop.
