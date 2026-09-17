# Batch Processing

Batch processing accumulates data over a period and handles it in a scheduled, high-throughput run.

## Use when

- Reports, reconciliation, or model training tolerate delay.
- Large volumes are cheaper to process together.
- Simpler failure recovery is more valuable than low latency.

## Example

```python
daily = spark.read.parquet("s3://lake/events/")
(daily.groupBy("country").sum("revenue")
    .write.mode("overwrite")
    .partitionBy("country")
    .parquet("s3://mart/daily"))
```

Make runs idempotent, record input and output partitions, and support backfills explicitly.
