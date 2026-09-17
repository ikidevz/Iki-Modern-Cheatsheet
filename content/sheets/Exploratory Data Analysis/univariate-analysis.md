# Univariate Analysis

Examine one variable at a time to understand its distribution, frequency, range, and unusual values.

## Numeric variables

- Use histograms for frequency and shape.
- Use box plots for quartiles, spread, and possible outliers.
- Use density plots to compare distribution shape.

## Categorical variables

- Use counts and proportions for each level.
- Group rare levels deliberately instead of hiding them.
- Check unexpected spelling, casing, and category drift.

```python
print(df["segment"].value_counts(dropna=False))
print(df["segment"].value_counts(normalize=True, dropna=False))
```

Choose plots and summaries that match the variable's type and measurement scale.
