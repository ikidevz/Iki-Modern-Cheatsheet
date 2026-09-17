# Missing Values Analysis

Quantify missingness before choosing a treatment. The reason a value is missing is often more important than the percentage missing.

## Inspect

```python
missing = df.isna().sum().rename("missing").to_frame()
missing["missing_pct"] = missing["missing"] / len(df) * 100
missing.sort_values("missing_pct", ascending=False)
```

Consider whether values are missing completely at random, conditionally on other data, or because absence itself carries meaning.

## Treatment choices

- Impute numeric values with a justified mean, median, or model-based method.
- Use a mode or explicit category for categorical data when appropriate.
- Use forward/back fill only when ordering makes it valid.
- Add a missingness indicator when absence may be predictive.
- Drop rows or columns only when the loss is acceptable and documented.
