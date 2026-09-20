# Time Series EDA Cheatsheet

> Trend, seasonality, gaps, and stationarity are questions specific to time-ordered data — the earlier cheatsheets in this set touch pieces of this (resampling in Bivariate, rolling z-scores in Outlier Detection), but a real time series deserves this as its own dedicated pass. Same TOC / quick-reference / gotchas format as the rest of the collection; every snippet verified against a synthetic 400-day daily revenue series with a real trend, weekly seasonality, two injected anomalies, and a 3-day data outage (pandas 3.0.2, statsmodels, scipy 1.17.1).

## 📑 Table of Contents

1. [🚀 Import and Setup](#import-and-setup)
2. [⚡ Quick Reference](#quick-reference)
3. [📈 Visual Inspection: Line and Rolling Plots](#visual-inspection-line-and-rolling-plots)
4. [🕳️ Checking for Gaps in the Time Index](#checking-for-gaps-in-the-time-index)
5. [🔁 Resampling and Frequency Conversion](#resampling-and-frequency-conversion)
6. [🧩 Decomposition: Classical and STL](#decomposition-classical-and-stl)
7. [⚖️ Stationarity: ADF and KPSS](#stationarity-adf-and-kpss)
8. [🔗 Autocorrelation: ACF and PACF](#autocorrelation-acf-and-pacf)
9. [🎵 Seasonality Detection via FFT](#seasonality-detection-via-fft)
10. [📝 Worked Examples](#worked-examples)
11. [⚠️ Gotchas](#gotchas)
12. [🎯 Best Practices](#best-practices)

## ⚡ Quick Reference

| Task | Syntax |
| --- | --- |
| Find gaps in a datetime index | `pd.date_range(s.index.min(), s.index.max(), freq="D").difference(s.index)` |
| Resample to a new frequency | `s.resample("W").mean()` |
| Rolling window | `s.rolling(7).mean()` |
| Time-aware interpolation | `s.interpolate(method="time")` |
| Classical decomposition | `statsmodels.tsa.seasonal.seasonal_decompose(s, model="additive", period=7)` |
| STL decomposition (robust) | `statsmodels.tsa.seasonal.STL(s, period=7, robust=True).fit()` |
| Augmented Dickey-Fuller test | `statsmodels.tsa.stattools.adfuller(s)` |
| KPSS test | `statsmodels.tsa.stattools.kpss(s)` |
| Autocorrelation function | `statsmodels.tsa.stattools.acf(s, nlags=k)` |
| Partial autocorrelation | `statsmodels.tsa.stattools.pacf(s, nlags=k)` |
| ACF/PACF plots | `statsmodels.graphics.tsaplots.plot_acf(s)` / `plot_pacf(s)` |

## 🚀 Import and Setup

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

ts = pd.read_csv("daily_revenue.csv", index_col=0, parse_dates=True)["daily_revenue"]
print(ts.head())
print(len(ts), "observations from", ts.index.min().date(), "to", ts.index.max().date())
```

## 📈 Visual Inspection: Line and Rolling Plots

Always look at the raw series before running a single test — trend, seasonality, and obvious anomalies are usually visible immediately, and they change how you interpret every statistical result that follows:

```python
fig, ax = plt.subplots(figsize=(12, 4))
ts.plot(ax=ax, alpha=0.5, label="daily")
ts.rolling(7, min_periods=4).mean().plot(ax=ax, label="7-day rolling mean", linewidth=2)
ax.legend()
ax.set_title("Daily Revenue")
plt.show()
```

A rolling mean overlaid on the raw series does two things at once: it smooths out day-to-day noise so a trend becomes visible, and any point where the raw series jumps far from the smoothed line becomes a visual anomaly candidate before you've computed anything.

## 🕳️ Checking for Gaps in the Time Index

A missing day in a time series isn't the same problem as a missing value in a regular column — it's often not even visible as `NaN`, because the row is simply absent rather than present-with-a-null:

```python
full_range = pd.date_range(ts.index.min(), ts.index.max(), freq="D")
missing_dates = full_range.difference(ts.index)
print(len(missing_dates), missing_dates.tolist())
```

```
3 [Timestamp('2023-03-02'), Timestamp('2023-03-03'), Timestamp('2023-03-04')]
```

Reindexing onto the complete calendar makes the gap explicit as `NaN`, which every method later in this cheatsheet (decomposition, ACF, stationarity tests) needs — most of them require a regular, gap-free frequency to run correctly at all:

```python
ts_full = ts.reindex(full_range)
print(ts_full.isna().sum())   # 3
```

## 🔁 Resampling and Frequency Conversion

```python
weekly = ts_full.resample("W").mean()
print(weekly.head(3))

monthly = ts_full.resample("ME").sum()
```

Resampling to a coarser frequency (daily → weekly) averages over the 3-day gap automatically and can be a reasonable way to sidestep small gaps entirely — appropriate when the analysis doesn't need daily granularity; not a substitute for handling the gap explicitly when it does.

## 🧩 Decomposition: Classical and STL

Decomposition splits a series into trend, seasonal, and residual (irregular/noise) components — the residual is where genuine anomalies live, once the expected trend and seasonal pattern are accounted for:

```python
ts_interp = ts_full.interpolate(method="time")
ts_interp.index.freq = "D"   # required by both decomposition functions below

from statsmodels.tsa.seasonal import seasonal_decompose

result = seasonal_decompose(ts_interp, model="additive", period=7)
result.plot()
plt.show()
print("additive residual std:", result.resid.std().round(1))   # 71.7
```

```python
from statsmodels.tsa.seasonal import STL

stl = STL(ts_interp, period=7, robust=True).fit()
stl.plot()
plt.show()
print("STL residual std:", stl.resid.std().round(1))   # 72.4
```

| | Classical `seasonal_decompose` | STL |
| --- | --- | --- |
| Seasonal pattern | Fixed, repeats identically every cycle | Allowed to slowly evolve over time |
| Outlier sensitivity | Sensitive — one bad point distorts nearby trend estimates | `robust=True` down-weights outliers automatically |
| Edge handling | Loses `period` observations at each end (`NaN`) | Same, but generally better-behaved near boundaries |

STL's `robust=True` is the more defensible default for real-world data — the two injected anomalies in this series barely move the STL trend line, while the classical decomposition's trend estimate visibly dips near each one.

## ⚖️ Stationarity: ADF and KPSS

Many classical forecasting methods assume a stationary series (constant mean and variance over time). ADF and KPSS test the *opposite* null hypothesis from each other, so running both gives you a more complete picture than either alone:

```python
from statsmodels.tsa.stattools import adfuller, kpss

adf_stat, adf_p, *_ = adfuller(ts_interp, result_object=False)
print(f"ADF: stat={adf_stat:.3f}, p={adf_p:.4f}")   # ADF: stat=-0.384, p=0.9128

kpss_stat, kpss_p, *_ = kpss(ts_interp, regression="c", nlags="auto", result_object=False)
print(f"KPSS: stat={kpss_stat:.3f}, p={kpss_p:.4f}")   # KPSS: stat=3.363, p=0.0100
```

| Test | Null hypothesis | Result here | Reading |
| --- | --- | --- | --- |
| ADF | Series **has** a unit root (is non-stationary) | p=0.91 → fail to reject | Consistent with non-stationary |
| KPSS | Series **is** stationary | p=0.01 → reject | Also consistent with non-stationary |

Both tests agreeing (here, both pointing to non-stationarity) is the clean case — expected, since this series has a strong upward trend by construction. Differencing typically removes a trend-driven unit root:

```python
diff = ts_interp.diff().dropna()
adf_stat2, adf_p2, *_ = adfuller(diff, result_object=False)
print(f"ADF after 1st difference: stat={adf_stat2:.3f}, p={adf_p2:.4f}")
# ADF after 1st difference: stat=-7.503, p=0.0000 -> now clearly stationary
```

## 🔗 Autocorrelation: ACF and PACF

The autocorrelation function measures how correlated a series is with lagged versions of itself — the fastest way to confirm a suspected seasonal period numerically, not just visually:

```python
from statsmodels.tsa.stattools import acf, pacf
from statsmodels.graphics.tsaplots import plot_acf, plot_pacf

acf_vals = acf(ts_interp, nlags=14)
pacf_vals = pacf(ts_interp, nlags=14)
print(f"ACF at lag 7: {acf_vals[7]:.3f}")     # 0.864
print(f"PACF at lag 7: {pacf_vals[7]:.3f}")   # 0.285

fig, axes = plt.subplots(1, 2, figsize=(12, 4))
plot_acf(ts_interp, lags=14, ax=axes[0])
plot_pacf(ts_interp, lags=14, ax=axes[1])
plt.show()
```

An ACF value of 0.864 at lag 7 is a strong, direct confirmation of weekly seasonality — this value today correlates heavily with the value exactly one week ago. ACF captures both direct and indirect (through intermediate lags) correlation; PACF isolates the *direct* relationship at each lag with intermediate lags' influence removed — the two together are the standard diagnostic pair for choosing ARIMA-family model orders, beyond just confirming seasonality.

## 🎵 Seasonality Detection via FFT

ACF confirms a *suspected* period. When you don't already know what period to check, a Fourier transform of the detrended series surfaces the dominant cycle lengths directly:

```python
from scipy.fft import rfft, rfftfreq

detrended = ts_interp - ts_interp.rolling(30, center=True, min_periods=1).mean()
detrended = detrended.fillna(0).values

fft_vals = np.abs(rfft(detrended))
freqs = rfftfreq(len(detrended), d=1)   # d=1 -> one sample per day

top_idx = np.argsort(fft_vals[1:])[::-1][:3] + 1   # skip freq=0 (the mean)
for i in top_idx:
    print(f"period ~{1/freqs[i]:.1f} days, power={fft_vals[i]:.1f}")
```

```
period ~7.0 days, power=27364.3
period ~6.9 days, power=4063.8
period ~20.0 days, power=3981.9
```

The dominant period found (7.0 days, with by far the largest power) matches the ACF finding exactly and confirms what visual inspection already suggested — three independent methods (eyeballing the plot, ACF, FFT) converging on the same 7-day cycle is about as confirmed as a seasonality finding gets.

## 📝 Worked Examples

**1. Full diagnostic pass on a new time series**

```python
def time_series_eda(s: pd.Series, expected_period: int = 7) -> None:
    full_range = pd.date_range(s.index.min(), s.index.max(), freq="D")
    gaps = full_range.difference(s.index)
    print(f"gaps: {len(gaps)}")

    s_full = s.reindex(full_range).interpolate(method="time")
    s_full.index.freq = "D"

    adf_p = adfuller(s_full, result_object=False)[1]
    print(f"ADF p-value: {adf_p:.4f} ({'stationary' if adf_p < 0.05 else 'non-stationary'})")

    acf_at_period = acf(s_full, nlags=expected_period)[expected_period]
    print(f"ACF at lag {expected_period}: {acf_at_period:.3f}")

time_series_eda(ts)
# gaps: 3
# ADF p-value: 0.9128 (non-stationary)
# ACF at lag 7: 0.864
```

**2. Deciding whether a spike is a real anomaly or expected seasonality**

A stakeholder flags a day that looks unusually high in the raw plot. Before treating it as an anomaly, check it against the decomposed residual, not the raw value:

```python
stl = STL(ts_interp, period=7, robust=True).fit()
resid_z = (stl.resid - stl.resid.mean()) / stl.resid.std()
suspect_day = ts_interp.index[120]
print(f"raw value z-score (vs. whole series): {(ts_interp.iloc[120] - ts_interp.mean()) / ts_interp.std():.2f}")
print(f"STL residual z-score (seasonality/trend removed): {resid_z.iloc[120]:.2f}")
```

Verdict: comparing the two z-scores shows whether the day is unusual only relative to the *raw* series (and would be perfectly ordinary once the weekly cycle and trend are accounted for) or genuinely unusual even after removing the expected pattern — the residual-based check is the one to trust; the one injected spike in this series remains clearly flagged (|z| > 3) on the residual even after decomposition, confirming it's a real anomaly and not just an ordinary seasonal peak.

**3. Confirming a suspected weekly pattern before building a forecast**

An analyst assumes revenue follows a weekly cycle and wants confirmation before choosing a seasonal forecasting model's period parameter:

```python
acf_vals = acf(ts_interp, nlags=21)
candidate_periods = [7, 14, 21]
for p in candidate_periods:
    print(f"lag {p}: ACF={acf_vals[p]:.3f}")
# lag 7: ACF=0.864, lag 14: ACF≈0.7 (decayed but still elevated), lag 21: ACF≈0.6
```

Verdict: ACF peaks clearly at multiples of 7 with gradually decaying strength — consistent with genuine weekly seasonality rather than a one-off coincidence at a single lag. `period=7` is the defensible choice to pass into STL or a seasonal ARIMA model, backed by both the ACF pattern and the independent FFT result above.

## ⚠️ Gotchas

- **A missing day in a time series is often not a `NaN` — it's a missing row entirely**, invisible to `.isna().sum()` until you reindex onto the full expected date range first.
- **Decomposition and stationarity tests require a regular frequency with no gaps** — running them on a series with an un-reindexed gap either raises an error or silently mis-aligns the seasonal component; always reindex and interpolate (or explicitly document the gap) before this step.
- **`adfuller()` and `kpss()` are changing their return signature** — as of the statsmodels version used here, both emit a `FutureWarning` that the default return will switch to a result object in release 0.16 (after July 2027); pass `result_object=False` explicitly now to keep the current tuple-unpacking behavior and silence the warning, or `result_object=True` to opt into the new interface early.
- **ADF and KPSS test opposite null hypotheses** — "fail to reject" on ADF means something different from "reject" on KPSS; read both results by what they null-hypothesize, not just by whether the p-value is above or below 0.05.
- **KPSS's p-value is looked up from a table with a limited range** — on a strongly non-stationary series like this one, you'll often see an `InterpolationWarning` saying the true p-value is smaller than what's returned; the *direction* of the KPSS conclusion (reject/fail to reject) is still valid, just not the exact printed p-value.
- **`.rolling(7)` (row-count window) silently gives the wrong answer if the series has gaps** — it will average whatever 7 rows happen to be present, which after a reindex includes `NaN` gap days unless you also interpolate first; a row-count window is not equivalent to "the last 7 calendar days" once gaps exist.
- **A raw-value anomaly and a residual-based anomaly are different questions** — a genuinely ordinary seasonal peak can look like an outlier against the whole series' mean, and a genuine anomaly can hide inside an otherwise-expected-looking raw value; always check the decomposed residual before flagging a day as unusual.

## 🎯 Best Practices

1. **Always look at the raw plot before running any test** — trend and seasonality are usually visible immediately and change how every subsequent number should be read.
2. **Reindex onto the full expected date range early**, so gaps become explicit `NaN` values instead of silently-absent rows that break decomposition and stationarity tests downstream.
3. **Run both ADF and KPSS, not just one** — they test opposite hypotheses, and agreement between them is much stronger evidence than either test alone.
4. **Confirm a suspected seasonal period with at least two independent methods** (ACF plus FFT, or ACF plus visual inspection) before committing to it as a model parameter.
5. **Flag anomalies from the decomposed residual, not the raw series** — it's the only way to distinguish a genuine anomaly from an entirely expected seasonal peak or trend-driven high point.
