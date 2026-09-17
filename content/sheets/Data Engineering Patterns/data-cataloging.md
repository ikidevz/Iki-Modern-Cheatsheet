# Data Cataloging Pattern

A data catalog maintains a searchable inventory of datasets, columns, owners, lineage, classifications, and quality signals.

## Use when

- Many teams and sources make data hard to find.
- Compliance requires knowing where sensitive data lives.
- Consumers need context before trusting a dataset.

## Example

```python
catalog.register(
    name="sales_daily",
    location="s3://lake/sales/",
    owner="data-platform",
    tags=["finance", "pii"],
)
catalog.set_lineage("sales_daily", upstream=["raw.orders"])
```

Catalog metadata needs ownership, automated ingestion, freshness indicators, and regular review or it will become stale.
