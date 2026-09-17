# Correlation Analysis

Correlation measures the strength and direction of a relationship, but it does not establish causation.

## Methods

- Pearson measures linear association between numeric variables.
- Spearman measures monotonic association using ranks.
- Kendall is useful with small samples or many ties.
- Point-biserial correlation compares a binary variable with a continuous one.

```python
corr = df.select_dtypes("number").corr(method="spearman")
print(corr.round(2))
```

Inspect the scatter plot behind a large coefficient. Nonlinear relationships, outliers, and shared time trends can make correlation misleading. In modeling work, use the matrix to flag redundancy, not to remove variables automatically.
