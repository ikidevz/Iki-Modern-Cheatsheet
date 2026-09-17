# Descriptive Statistics

Summarize central tendency, spread, and shape to build a numeric baseline before visual analysis.

## Measures

- Mean is useful but sensitive to extreme values.
- Median is more robust for skewed data.
- Mode is useful for discrete and categorical values.
- Standard deviation and variance describe spread.
- Quantiles and interquartile range show the middle of the distribution.
- Skewness and kurtosis describe asymmetry and tail behavior.

```python
numeric_summary = df.describe().round(3)
category_summary = df.describe(include="object")
print(numeric_summary)
print(category_summary)
```

Compare statistics across meaningful groups when the overall summary hides important differences.
