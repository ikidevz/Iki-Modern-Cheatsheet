# Data Lakehouse

A lakehouse adds transactional metadata and indexing, such as Delta Lake or Apache Iceberg, to object storage.

## Use when

- One storage layer must serve analytics, ML, and raw data.
- ACID updates, time travel, and schema enforcement are needed.
- Open file formats and low-cost storage matter.

## Example

```python
from delta.tables import DeltaTable

target_path = "s3://lake/sales"
df.write.format("delta").mode("append").save(target_path)

DeltaTable.forPath(spark, target_path).alias("target").merge(
    updates.alias("source"), "target.id = source.id"
).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()
```

## Trade-offs

A lakehouse reduces duplicate copies and supports time travel, but compaction, metadata management, and platform compatibility add operational work.
