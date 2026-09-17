# Idempotent Pipelines

An idempotent pipeline produces the same correct result when a run is repeated after a timeout, retry, or backfill.

## Core techniques

- Use stable business keys and `MERGE` or upsert operations.
- Replace a partition atomically instead of appending duplicates.
- Record completed run keys and source offsets.
- Keep external side effects behind deduplication keys.

```sql
MERGE INTO mart.orders AS target
USING staging.orders AS source
ON target.order_id = source.order_id
WHEN MATCHED THEN UPDATE SET status = source.status
WHEN NOT MATCHED THEN INSERT (order_id, status)
VALUES (source.order_id, source.status);
```

Idempotency makes retries, replay, and incident recovery predictable.
