# Schema Evolution

Schema evolution changes data structures over time while keeping producers, consumers, storage, and historical data compatible.

## Compatibility rules

- Prefer additive changes with nullable fields or defaults.
- Deploy consumers before producers for breaking changes.
- Version event contracts when compatibility cannot be maintained.
- Backfill new fields before making them required.

```sql
ALTER TABLE mart.orders
ADD COLUMN currency VARCHAR DEFAULT 'USD';

UPDATE mart.orders
SET currency = 'USD'
WHERE currency IS NULL;
```

Enforce compatibility in CI or the schema registry, and communicate removals with a deprecation window.
