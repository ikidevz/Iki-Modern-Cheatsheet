# Outlier Detection

An outlier may be a data entry error, a rare but valid event, or the phenomenon you need to study. Its cause determines the treatment.

## Detection methods

- IQR rule: values outside $Q1 - 1.5 \times IQR$ or $Q3 + 1.5 \times IQR$.
- Z-scores for approximately symmetric numeric variables.
- Box plots and scatter plots for visual inspection.
- Isolation Forest or other robust methods for multivariate data.

```python
q1, q3 = df["amount"].quantile([0.25, 0.75])
iqr = q3 - q1
lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
outliers = df[(df["amount"] < lower) | (df["amount"] > upper)]
```

Remove confirmed errors, cap values only with a defensible reason, transform heavy tails when appropriate, and keep genuine rare events.
