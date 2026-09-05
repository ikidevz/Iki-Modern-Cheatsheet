## Loading data

Two common paths: bulk loads via `COPY INTO`, and continuous micro-batches via Snowpipe.

| Method | Best for |
| --- | --- |
| `COPY INTO` | Bulk loads from a stage |
| Snowpipe | Continuous micro-batches |

```sql
COPY INTO my_table
FROM @my_stage
FILE_FORMAT = (TYPE = PARQUET);
```

> Gotcha: Snowpipe billing is per-file, so batch small files upstream before loading.

1. Stage the files
2. Run the copy
3. Verify row counts
