# Bivariate Analysis

Study pairs of variables to find associations, group differences, trends, and possible confounding.

## Useful pairings

- Numeric versus numeric: scatter plots and trend lines.
- Numeric versus categorical: grouped box plots, violin plots, and group summaries.
- Categorical versus categorical: contingency tables and proportional bar charts.
- Time versus a measure: line charts with an explicit time grain.

```python
summary = df.groupby("segment", observed=True)["revenue"].agg(["count", "mean", "median"])
print(summary)
```

Treat associations as hypotheses. Check sample size, confounders, and whether a few observations drive the pattern.
