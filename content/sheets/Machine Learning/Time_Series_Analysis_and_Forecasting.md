# Time Series Analysis & Forecasting Cheatsheet

## Overview

Time series data breaks several assumptions standard ML relies on — observations aren't independent, and the future must never leak into training. This sheet covers decomposition, stationarity, the ARIMA family, Prophet, and the evaluation practices specific to forecasting.

```bash
pip install statsmodels prophet --break-system-packages
```

---

## 1. Decomposition: Trend, Seasonality, Residual

Any time series can be thought of as a combination of a long-term trend, a repeating seasonal pattern, and leftover residual noise.

```python
import numpy as np
import pandas as pd
from statsmodels.tsa.seasonal import seasonal_decompose

# Simulate a series with trend + weekly seasonality + noise
dates = pd.date_range("2023-01-01", periods=365, freq="D")
trend = np.linspace(100, 150, 365)
seasonality = 10 * np.sin(2 * np.pi * np.arange(365) / 7)  # weekly pattern
noise = np.random.normal(0, 3, 365)
series = pd.Series(trend + seasonality + noise, index=dates)

# Additive: trend + seasonality + residual (use when seasonal swings stay roughly CONSTANT in size)
decomposition_additive = seasonal_decompose(series, model="additive", period=7)

# Multiplicative: trend * seasonality * residual (use when seasonal swings GROW with the trend's level)
decomposition_multiplicative = seasonal_decompose(series, model="multiplicative", period=7)

print("Trend component (first 5):", decomposition_additive.trend.dropna().head().values.round(1))
print("Seasonal component (first 7, one full cycle):", decomposition_additive.seasonal.head(7).values.round(1))
```

**Additive vs. multiplicative — how to tell which fits:** plot the series. If the amplitude of seasonal swings stays roughly the same regardless of the trend's level, use additive. If seasonal swings grow proportionally larger as the trend rises (e.g., holiday sales spikes that get bigger every year as the business grows), use multiplicative.

---

## 2. Stationarity, Differencing, and the ADF Test

Most classical forecasting models (ARIMA in particular) assume the series is **stationary** — its statistical properties (mean, variance) don't change over time. Most real series aren't stationary as-is, and need transforming first.

```python
from statsmodels.tsa.stattools import adfuller

def check_stationarity(series, name="series"):
    result = adfuller(series.dropna())
    print(f"{name} — ADF Statistic: {result[0]:.3f}, p-value: {result[1]:.4f}")
    print(f"  {'Stationary' if result[1] < 0.05 else 'NOT stationary'} (at 5% significance)")

check_stationarity(series, "original series")

# Differencing: subtract each value from the previous one — removes trend
differenced = series.diff().dropna()
check_stationarity(differenced, "first-differenced series")

# Seasonal differencing: subtract the value from one full season ago — removes seasonality
seasonally_differenced = series.diff(7).dropna()
check_stationarity(seasonally_differenced, "seasonally differenced series")
```

**Reading the ADF test:** the null hypothesis is "the series is non-stationary." A low p-value (< 0.05) lets you reject that null and conclude the series is likely stationary. If the original series fails this test, differencing once (or twice, rarely more) usually fixes it — this is exactly the "I" (Integrated) in ARIMA.

---

## 3. ARIMA/SARIMA: Parameter Selection with ACF/PACF

ARIMA(p, d, q) has three components: **p** (autoregressive order — how many past values predict the current one), **d** (differencing order — how many times to difference for stationarity), **q** (moving average order — how many past forecast errors to incorporate).

```python
from statsmodels.graphics.tsaplots import plot_acf, plot_pacf
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX

# ACF (autocorrelation) helps choose q: look for where it CUTS OFF (drops sharply to near-zero)
# PACF (partial autocorrelation) helps choose p: same idea, but for the AR order
# plot_acf(differenced, lags=20)
# plot_pacf(differenced, lags=20)

# Fit ARIMA — p=2 (AR order), d=1 (one differencing), q=1 (MA order)
model = ARIMA(series, order=(2, 1, 1))
fitted = model.fit()
print(fitted.summary().tables[1])  # coefficient table

forecast = fitted.forecast(steps=14)
print(f"14-day forecast:\n{forecast.head()}")

# SARIMA adds seasonal components: (p,d,q) x (P,D,Q,s) where s = season length
sarima_model = SARIMAX(series, order=(1, 1, 1), seasonal_order=(1, 1, 1, 7))
sarima_fitted = sarima_model.fit(disp=False)
sarima_forecast = sarima_fitted.forecast(steps=14)
```

**Practical shortcut:** rather than manually reading ACF/PACF plots, `pmdarima`'s `auto_arima` grid-searches over (p,d,q) combinations using an information criterion (AIC/BIC) — a reasonable starting point before manually refining.

```python
# import pmdarima as pm
# auto_model = pm.auto_arima(series, seasonal=True, m=7, trace=True, suppress_warnings=True)
# print(auto_model.summary())
```

---

## 4. Prophet: Holidays, Changepoints, and When It Beats ARIMA

Prophet is designed for business-style time series with strong seasonality and known holiday effects, and is more forgiving of missing data and outliers than ARIMA.

```python
from prophet import Prophet

# Prophet requires columns named exactly 'ds' (date) and 'y' (value)
df_prophet = pd.DataFrame({"ds": dates, "y": series.values})

model = Prophet(
    yearly_seasonality=True,
    weekly_seasonality=True,
    changepoint_prior_scale=0.05,  # controls flexibility of the trend — higher = more responsive to trend shifts
)

# Adding known holiday effects — Prophet models a distinct effect around each holiday date
holidays = pd.DataFrame({
    "holiday": "promo_event",
    "ds": pd.to_datetime(["2023-11-24", "2023-12-25"]),
    "lower_window": -1,  # effect starts 1 day before
    "upper_window": 1,   # effect lasts 1 day after
})
model_with_holidays = Prophet(holidays=holidays)
model_with_holidays.fit(df_prophet)

future = model_with_holidays.make_future_dataframe(periods=30)
forecast = model_with_holidays.predict(future)
print(forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].tail())

# Changepoints: Prophet automatically detects points where the trend's growth rate shifts
# fig = model_with_holidays.plot(forecast)
# fig2 = model_with_holidays.plot_components(forecast)  # shows trend, weekly, yearly, holiday effects separately
```

| | ARIMA/SARIMA | Prophet |
|---|---|---|
| Best for | Well-behaved, statistically stationary-after-differencing series | Strong seasonality, known holidays/events, business-style data |
| Handles missing data | Poorly — needs preprocessing | Gracefully — designed for messy real-world data |
| Interpretability | Statistical (coefficients have precise meaning) | Component-based (trend, weekly, yearly, holidays viewable separately) |
| Setup effort | More manual tuning (p,d,q selection) | Faster to get a reasonable first result |
| Multiple seasonalities | Awkward (SARIMA handles one seasonal period well) | Handles multiple seasonalities (daily + weekly + yearly) natively |

---

## 5. Cross-Validation for Time Series

Random k-fold cross-validation is invalid for time series — it would train on future data and test on the past, an information leak that inflates apparent performance.

```python
from sklearn.model_selection import TimeSeriesSplit

# Rolling-origin cross-validation: each fold's training window only ever includes PAST data
tscv = TimeSeriesSplit(n_splits=5)
for fold, (train_idx, test_idx) in enumerate(tscv.split(series)):
    train_dates = series.index[train_idx]
    test_dates = series.index[test_idx]
    print(f"Fold {fold}: train up to {train_dates[-1].date()}, test {test_dates[0].date()} to {test_dates[-1].date()}")
```

```python
# Prophet has built-in rolling-origin cross-validation utilities
from prophet.diagnostics import cross_validation, performance_metrics

cv_results = cross_validation(
    model_with_holidays, initial="180 days", period="30 days", horizon="14 days"
)
metrics = performance_metrics(cv_results)
print(metrics[["horizon", "mae", "mape"]].head())
```

---

## 6. Forecast Evaluation: MAPE/MASE and Backtesting Against a Naive Baseline

```python
def mean_absolute_percentage_error(y_true, y_pred):
    return np.mean(np.abs((y_true - y_pred) / y_true)) * 100

def mean_absolute_scaled_error(y_true, y_pred, y_train):
    """MASE scales the forecast error against the error of a naive 'repeat yesterday's value' baseline.
    MASE < 1 means the model beats the naive baseline; MASE > 1 means it's WORSE than doing nothing clever."""
    naive_errors = np.abs(np.diff(y_train))
    mae_naive = naive_errors.mean()
    mae_model = np.abs(y_true - y_pred).mean()
    return mae_model / mae_naive

# ALWAYS compare against a naive baseline — "predict tomorrow = today" or "predict this week = same week last year"
naive_forecast = series.shift(1).dropna()
actual = series[1:]
naive_mae = np.abs(actual - naive_forecast).mean()
print(f"Naive baseline MAE: {naive_mae:.2f}")

# A model is only worth its complexity if it clears this bar convincingly
```

**Why the naive baseline matters so much in forecasting specifically:** many real-world series are dominated by strong autocorrelation (tomorrow really does look a lot like today), which means even a trivial "repeat the last value" forecast can be surprisingly hard to beat. Always report your model's improvement over this baseline — a "70% accurate" forecast is meaningless without knowing what a naive guess would have scored.

## Common Pitfalls

- **Using random k-fold CV on time-ordered data** — always use rolling-origin/expanding-window splits instead.
- **Ignoring the naive baseline** — a sophisticated model that barely beats "repeat yesterday" isn't earning its complexity.
- **Choosing additive vs. multiplicative decomposition without checking the data** — visually inspect whether seasonal amplitude grows with the trend before picking.
- **Applying MAPE to a series that can be at or near zero** — MAPE becomes unstable/undefined; use MASE or a scaled error metric instead in that case.
- **Forgetting to seasonally difference before fitting ARIMA on strongly seasonal data** — plain ARIMA without a seasonal component (or SARIMA) will systematically miss recurring patterns.

---

## 7. End-to-End Worked Example: Comparing Naive, SARIMA, and Prophet on the Same Series

```python
import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX
from prophet import Prophet
from sklearn.metrics import mean_absolute_error

np.random.seed(42)
dates = pd.date_range("2022-01-01", periods=730, freq="D")
trend = np.linspace(200, 320, 730)
yearly_seasonality = 30 * np.sin(2 * np.pi * np.arange(730) / 365.25)
weekly_seasonality = 15 * np.sin(2 * np.pi * np.arange(730) / 7)
noise = np.random.normal(0, 8, 730)
series = pd.Series(trend + yearly_seasonality + weekly_seasonality + noise, index=dates, name="sales")

# Split: last 30 days held out for evaluation, everything before is training data
train, test = series[:-30], series[-30:]

# --- Baseline: naive seasonal (repeat the value from exactly 7 days ago) ---
naive_forecast = train[-7:].values.tolist() * 5  # repeat the last week's pattern
naive_forecast = pd.Series(naive_forecast[:30], index=test.index)

# --- SARIMA ---
sarima_model = SARIMAX(train, order=(1, 1, 1), seasonal_order=(1, 1, 1, 7)).fit(disp=False)
sarima_forecast = sarima_model.forecast(steps=30)

# --- Prophet ---
prophet_df = pd.DataFrame({"ds": train.index, "y": train.values})
prophet_model = Prophet(yearly_seasonality=True, weekly_seasonality=True)
prophet_model.fit(prophet_df)
future = prophet_model.make_future_dataframe(periods=30)
prophet_forecast = prophet_model.predict(future).set_index("ds")["yhat"].tail(30)
prophet_forecast.index = test.index

# --- Compare against the naive baseline, as this sheet insists on ---
for name, forecast in [("Naive seasonal", naive_forecast), ("SARIMA", sarima_forecast), ("Prophet", prophet_forecast)]:
    mae = mean_absolute_error(test, forecast)
    print(f"{name:15s} MAE: {mae:.2f}")
```

**What this comparison typically reveals:** on a series with clean, regular seasonality like this synthetic one, SARIMA and Prophet often land close to each other and both clearly beat the naive baseline — but the margin over naive is the number that actually justifies the complexity. If a real series showed SARIMA/Prophet barely beating the naive seasonal baseline, that would be a strong signal to simplify rather than over-invest in tuning either model further.

---

## 8. Advanced & Lesser-Known Techniques

- **Global/cross-series forecasting models**: rather than fitting one ARIMA/Prophet model per individual series, models like DeepAR or N-BEATS train a single neural network across *many* related series simultaneously (e.g., demand for thousands of SKUs), letting the model share statistical strength across series — often outperforms per-series classical models when you have many similar but individually short/noisy series.
- **Hierarchical reconciliation**: when forecasts exist at multiple aggregation levels (e.g., total company revenue, per-region revenue, per-store revenue), naive independent forecasts at each level usually don't sum up consistently — reconciliation methods adjust forecasts post-hoc so that, e.g., regional forecasts sum exactly to the total forecast.
- **Exogenous regressors**: both SARIMAX and Prophet support incorporating external variables (weather, marketing spend, a competitor's price) that influence the series but aren't part of its own history — `SARIMAX(..., exog=external_features)` or `Prophet().add_regressor("marketing_spend")`.
- **Anomaly-robust forecasting**: a few extreme outliers in the training history (a one-off data error, a genuine one-time event) can distort classical model fits — winsorizing extreme values or explicitly modeling known one-off events (as Prophet's holiday mechanism does) prevents them from corrupting the learned seasonal/trend pattern.

---

## 9. Practice Exercises

1. Extend the worked example's test window from 30 to 90 days and observe how each method's relative performance changes as the forecast horizon lengthens.
2. Add a known external regressor (e.g., a synthetic "promotion" flag on specific dates that boosts sales) to both the SARIMAX and Prophet models and compare their forecasts with and without this regressor.
3. Inject 3 extreme outlier values into the training series (e.g., data entry errors 5x normal scale) and compare how much each model's forecast is distorted, with and without a winsorization preprocessing step.
4. Implement rolling-origin cross-validation (using `TimeSeriesSplit` or Prophet's built-in `cross_validation`) for all three methods and report MASE (not just a single-split MAE) for a more robust comparison.
5. Simulate two related series (e.g., "Region A sales" and "Region B sales" with correlated but not identical seasonality) and compare forecasting each independently with SARIMA against a simple hierarchical reconciliation of independently-forecasted regional totals against an independently-forecasted grand total.

---

## 10. More Examples

### Example: Detecting change points in a time series

```python
import numpy as np
import ruptures as rpt

np.random.seed(42)
signal = np.concatenate([np.random.normal(10, 1, 100), np.random.normal(25, 1, 100), np.random.normal(15, 1, 100)])

algo = rpt.Pelt(model="rbf").fit(signal)
change_points = algo.predict(pen=5)
print(f"Detected change points at indices: {change_points}")
# Useful for identifying WHEN a series' underlying regime shifted (a pricing change,
# a product launch, a policy change) rather than assuming stationarity throughout
```

### Example: Multiple seasonality with Prophet (daily + weekly + yearly simultaneously)

```python
from prophet import Prophet
import pandas as pd
import numpy as np

dates = pd.date_range("2024-01-01", periods=365*2, freq="D")
# A series with BOTH weekly AND yearly patterns overlapping
values = (
    100 + 20 * np.sin(2 * np.pi * np.arange(len(dates)) / 7)       # weekly
    + 40 * np.sin(2 * np.pi * np.arange(len(dates)) / 365.25)       # yearly
    + np.random.normal(0, 5, len(dates))
)
df = pd.DataFrame({"ds": dates, "y": values})

model = Prophet(weekly_seasonality=True, yearly_seasonality=True, daily_seasonality=False)
model.fit(df)
forecast = model.predict(model.make_future_dataframe(periods=60))
# model.plot_components(forecast) would show weekly and yearly patterns as SEPARATE, additive components
print(forecast[["ds", "weekly", "yearly", "yhat"]].tail())
```

### Example: Ensemble forecasting — combining multiple models' predictions

```python
import numpy as np

def ensemble_forecast(forecasts_dict, weights=None):
    """Averaging several DIFFERENT models' forecasts often beats any single model —
    especially when the models have different strengths (SARIMA for structure, Prophet for holidays)."""
    if weights is None:
        weights = {name: 1 / len(forecasts_dict) for name in forecasts_dict}
    combined = sum(np.array(forecast) * weights[name] for name, forecast in forecasts_dict.items())
    return combined

forecasts = {"sarima": np.array([100, 105, 110]), "prophet": np.array([98, 108, 112]), "naive": np.array([95, 95, 95])}
weights = {"sarima": 0.4, "prophet": 0.4, "naive": 0.2}  # weight the naive baseline lower but don't discard it
ensemble = ensemble_forecast(forecasts, weights)
print(f"Ensemble forecast: {ensemble.round(1)}")
```

---

## 11. Quick-Reference Cheat-Table

| Situation | Approach |
|---|---|
| Strong known holidays/events | Prophet |
| Clean, statistically stationary-after-differencing data | ARIMA/SARIMA |
| Multiple seasonalities (daily+weekly+yearly) | Prophet |
| Many related series to forecast at once | Global model (DeepAR, N-BEATS) |
| Always | Compare against a naive baseline first |
| Time-ordered validation | `TimeSeriesSplit` / rolling-origin CV, never random k-fold |

## 12. FAQ

**Q: Is a sophisticated forecasting model always better than a naive baseline?**
A: Not necessarily — always benchmark against a naive "repeat last value/season" baseline. Many real series are dominated by autocorrelation that's hard to meaningfully beat.

**Q: ARIMA or Prophet — which should I default to?**
A: Prophet for business-style data with clear seasonality/holidays and faster setup. ARIMA/SARIMA for cleaner, more statistically well-behaved series where interpretable coefficients matter.

**Q: Can I use regular k-fold cross-validation for time series?**
A: No — it trains on future data and tests on the past, an information leak. Always use rolling-origin/expanding-window splits.

**Q: My series isn't stationary — now what?**
A: Apply differencing (and seasonal differencing if seasonal) until the ADF test indicates stationarity — this is exactly what the "I" in ARIMA does.

**Q: MAPE or MASE — which should I report?**
A: MASE, especially if your series can have values at or near zero — MAPE becomes unstable/undefined in that case.
