# Orchestration and DAGs

Orchestration represents pipeline work as a dependency graph so tasks run in order, parallelize safely, and expose retries and failure states.

## Use when

- A workflow has multiple steps, schedules, dependencies, or backfills.
- Retries, notifications, and operational history need central control.
- Independent work can run in parallel.

```python
extract >> transform >> publish
extract >> quality_check
[transform, quality_check] >> publish
```

Keep tasks focused, make them idempotent, pass data through durable storage rather than task memory, and monitor duration and freshness.
