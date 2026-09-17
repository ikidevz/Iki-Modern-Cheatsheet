# Change Data Capture

Change Data Capture (CDC) publishes inserts, updates, and deletes from a source database instead of repeatedly scanning the full table.

## Use when

- A warehouse or replica must stay close to the source.
- Event-driven consumers need row-level changes.
- The source transaction log is available.

## Example

```python
for change in consume_changes("orders"):
    if change.operation == "DELETE":
        warehouse.delete("orders", change.key)
    else:
        warehouse.upsert("orders", change.after)
    checkpoint(change.source_lsn)
```

## Design notes

Preserve source offsets, handle tombstones, define ordering guarantees, and plan schema changes. Debezium with Kafka is a common implementation.
