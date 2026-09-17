# Slowly Changing Dimensions

Slowly Changing Dimensions (SCDs) preserve or overwrite dimension history when business attributes change.

## Common choices

- **Type 1:** overwrite the old value when history is not needed.
- **Type 2:** create a versioned row with validity dates for historical reporting.

```sql
UPDATE dim_customer
SET valid_to = CURRENT_DATE, is_current = false
WHERE customer_id = :id AND is_current = true;

INSERT INTO dim_customer (customer_id, segment, valid_from, is_current)
VALUES (:id, :segment, CURRENT_DATE, true);
```

Document the dimension grain, handle late-arriving changes, and join facts to the version valid at event time.
