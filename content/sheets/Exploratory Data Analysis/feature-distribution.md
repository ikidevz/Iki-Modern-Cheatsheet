# Feature Distribution

Distribution shape guides transformations, visualization choices, and model assumptions.

## Inspect

- Symmetric distributions have mean and median in similar locations.
- Positive skew has a long right tail.
- Negative skew has a long left tail.
- Wide ranges may require standardization or robust scaling.
- Heavy tails may reflect valid business behavior rather than bad data.

```python
numeric = df.select_dtypes("number")
skewed = numeric.skew().abs().sort_values(ascending=False)
print(skewed[skewed > 1])
```

For positive skew, consider `log1p` or a root transform. For other shapes, evaluate Yeo-Johnson, quantile transforms, or robust scaling while preserving interpretability.
