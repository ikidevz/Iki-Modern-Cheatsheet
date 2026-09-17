# Data Quality Gates

Data quality gates validate schema, completeness, uniqueness, freshness, and business rules at pipeline boundaries.

## Use when

- A dataset is shared or business-critical.
- Silent corruption costs more than a delayed run.
- Data contracts need executable enforcement.

## Example

```sql
SELECT COUNT(*) AS invalid_rows
FROM staging.orders
WHERE customer_id IS NULL OR amount < 0;

SELECT order_id
FROM staging.orders
GROUP BY order_id
HAVING COUNT(*) > 1;
```

Set thresholds with owners, separate blocking checks from warnings, and publish failure details so operators can repair the source quickly.
