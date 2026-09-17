# Data Overview

Start by understanding the dataset's grain, shape, schema, and basic structure before interpreting any result.

## Checklist

- Confirm the unit of observation and whether rows are unique.
- Inspect row and column counts, names, and data types.
- Preview the first and last rows.
- Identify identifiers, targets, timestamps, and likely categorical fields.
- Check duplicate rows and impossible values.

```python
print(df.shape)
print(df.dtypes)
print(df.head())
print(df.columns.tolist())
df.info()
```

Record the initial assumptions and any schema issues so later findings have context.
