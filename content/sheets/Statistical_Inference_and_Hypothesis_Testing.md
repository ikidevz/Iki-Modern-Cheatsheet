# Statistical Inference & Hypothesis Testing Cheatsheet for Data & Analytics Engineers

_(with Worked Examples Across Industries)_

> A structured statistics reference for data & analytics engineering — probability foundations and estimation through confidence intervals, the full hypothesis-testing toolbox (parametric, non-parametric, categorical, non-inferiority/equivalence), effect sizes, multiple-comparisons and sequential-testing corrections, resampling methods, survival analysis, causal inference, time series diagnostics, meta-analysis, and Bayesian inference (credible intervals and Bayes Factors). This is the general inferential-statistics companion to the A/B Testing cheatsheet, which covers the applied experiment-design workflow. Every numeric example in this file — t/z statistics, ANOVA/ANCOVA/Tukey output, bootstrap and permutation p-values, power calculations, Kaplan-Meier/Cox survival estimates, propensity-score and difference-in-differences causal estimates, ADF/KPSS/Ljung-Box time series diagnostics, meta-analysis pooling, and Bayes Factors — was actually computed with SciPy 1.17, statsmodels 0.15, and lifelines 0.30, not hand-typed. That included simulating 2,000+ null hypothesis tests to confirm the ~5% false-positive rate, the multiple-comparisons inflation formula, and — new in this expansion — the false-positive inflation from naive repeated peeking at a running test. This edition also folds in 31 worked, real-world examples (one per test/method, across manufacturing, healthcare, retail, software, pharma, education, genomics, finance, and more) as a single combined reference.

## 📑 Table of Contents

1. [📐 Core Concepts Terminology](#core-concepts-terminology)
2. [🔔 Probability Distributions Reference](#probability-distributions-reference)
3. [🎯 Point Estimation](#point-estimation)
4. [📊 Sampling Distributions the Central Limit Theorem](#sampling-distributions-central-limit-theorem)
5. [📏 Confidence Intervals](#confidence-intervals)
6. [🧪 Hypothesis Testing Framework](#hypothesis-testing-framework)
7. [⚖️ Type I/II Errors Statistical Power](#type-i-ii-errors-statistical-power)
8. [🔢 Sample Size Power Analysis](#sample-size-power-analysis)
9. [1️⃣ One-Sample Tests](#one-sample-tests)
10. [2️⃣ Two-Sample Tests](#two-sample-tests)
11. [🎚️ Non-Inferiority Equivalence Testing](#non-inferiority-equivalence-testing)
12. [📈 ANOVA Post-Hoc Comparisons](#anova-post-hoc-comparisons)
13. [🧮 ANCOVA](#ancova)
14. [🎲 Non-Parametric Tests](#non-parametric-tests)
15. [🔗 Chi-Square Categorical Data Tests](#chi-square-categorical-data-tests)
16. [📐 Effect Size Measures](#effect-size-measures)
17. [🧮 Multiple Testing Correction](#multiple-testing-correction)
18. [⏱️ Sequential Testing Always-Valid Inference](#sequential-testing-always-valid-inference)
19. [🔄 Bootstrapping Resampling](#bootstrapping-resampling)
20. [🔀 Permutation Tests](#permutation-tests)
21. [📉 Correlation Regression Inference](#correlation-regression-inference)
22. [⏳ Survival Analysis](#survival-analysis)
23. [🔀 Causal Inference Basics](#causal-inference-basics)
24. [📉 Time Series Inference](#time-series-inference)
25. [📚 Meta-Analysis Basics](#meta-analysis-basics)
26. [🧠 Bayesian Inference Basics](#bayesian-inference-basics)
27. [🧠 Bayesian Hypothesis Testing (Bayes Factors)](#bayesian-hypothesis-testing-bayes-factors)
28. [⚠️ Common Gotchas Misconceptions](#common-gotchas-misconceptions)
29. [🎯 Best Practices](#best-practices)
30. [📚 Test-Selection Guide & Quick Formulas](#test-selection-guide-quick-formulas)
31. [💡 Pro Tips](#pro-tips)
32. [🧪 Worked Examples Across Industries](#worked-examples-across-industries)

## ⚡ Quick Reference

**Syntax cheatsheet (SciPy / statsmodels / lifelines)**

| Task                              | Syntax                                                                 |
| --------------------------------- | ---------------------------------------------------------------------- |
| One-sample t-test                 | `stats.ttest_1samp(sample, popmean)`                                   |
| Two-sample t-test (unequal var)   | `stats.ttest_ind(a, b, equal_var=False)` (Welch's — the safer default) |
| Paired t-test                     | `stats.ttest_rel(after, before)`                                       |
| Equivalence / non-inferiority     | `ttost_ind(new, old, low, upp)` (TOST: two one-sided tests)            |
| One-way ANOVA                     | `stats.f_oneway(g1, g2, g3)`                                           |
| ANCOVA (group + covariate)        | `anova_lm(smf.ols('y ~ C(group) + covariate', data=df).fit(), typ=2)`  |
| Tukey HSD post-hoc                | `pairwise_tukeyhsd(data, labels)`                                      |
| Mann-Whitney U                    | `stats.mannwhitneyu(a, b)`                                             |
| Wilcoxon signed-rank              | `stats.wilcoxon(after, before)`                                        |
| Kruskal-Wallis                    | `stats.kruskal(g1, g2, g3)`                                            |
| Chi-square independence           | `stats.chi2_contingency(table)`                                        |
| Fisher's exact                    | `stats.fisher_exact(table)`                                            |
| Confidence interval (mean)        | `stats.t.interval(0.95, df, loc=mean, scale=sem)`                      |
| Confidence interval (proportion)  | `proportion_confint(successes, trials, method='wilson')`               |
| Bootstrap CI                      | `stats.bootstrap((data,), np.median, confidence_level=0.95)`           |
| Permutation test                  | `stats.permutation_test((a, b), stat_fn, n_resamples=10000)`           |
| Multiple-testing correction       | `multipletests(p_values, alpha=0.05, method='fdr_bh')`                 |
| Sample size / power               | `TTestIndPower().solve_power(effect_size=d, alpha=0.05, power=0.8)`    |
| Kaplan-Meier survival curve       | `KaplanMeierFitter().fit(time, event_observed)`                        |
| Log-rank test (2 survival curves) | `logrank_test(time_a, time_b, event_a, event_b)`                       |
| Cox proportional hazards          | `CoxPHFitter().fit(df, duration_col='time', event_col='event')`        |
| Stationarity (unit root)          | `adfuller(series)` / `kpss(series)`                                    |
| Autocorrelation                   | `acorr_ljungbox(series, lags=[10])`                                    |
| Meta-analysis pooling             | `combine_effects(effects, variances, method_re='iterated')`            |
| Pearson / Spearman correlation    | `stats.pearsonr(x, y)` / `stats.spearmanr(x, y)`                       |
| OLS regression with CI            | `sm.OLS(y, sm.add_constant(x)).fit()`                                  |

**Distribution cheat sheet**

| Distribution | Typical use case                                          | SciPy object    |
| ------------ | --------------------------------------------------------- | --------------- |
| Normal       | Continuous data symmetric around a mean (heights, errors) | `stats.norm`    |
| t            | Like normal, but for small samples / unknown variance     | `stats.t`       |
| Binomial     | Count of successes in n independent yes/no trials         | `stats.binom`   |
| Poisson      | Count of rare events in a fixed interval (arrivals/hour)  | `stats.poisson` |
| Exponential  | Time between independent events (wait times)              | `stats.expon`   |
| Chi-square   | Sum of squared normals; test statistics, variance tests   | `stats.chi2`    |
| F            | Ratio of two variances; ANOVA test statistic              | `stats.f`       |
| Beta         | Values bounded in [0,1]; conjugate prior for proportions  | `stats.beta`    |
| Uniform      | Equally likely outcomes over a range                      | `stats.uniform` |

## 📐 Core Concepts Terminology

```python
import numpy as np
from scipy import stats

# Population vs sample
# Population: the entire group you want to draw conclusions about (often unobservable in full)
# Sample: the subset you actually measured
# Parameter: a numeric fact about the population (mu, sigma, p) — usually unknown
# Statistic: a numeric fact computed from a sample (x-bar, s, p-hat) — used to ESTIMATE the parameter

# Descriptive vs inferential statistics
# Descriptive: summarizing the data you have (mean, median, std, histograms)
# Inferential: using a sample to make a claim about the broader population, with quantified uncertainty

sample = np.array([23, 45, 12, 67, 34, 29, 51, 38, 42, 19])

print(f"sample mean (x-bar): {sample.mean():.2f}")     # statistic estimating population mean (mu)
print(f"sample std (s), ddof=1: {sample.std(ddof=1):.2f}")  # ddof=1 -> sample std (Bessel's correction)
print(f"population std, ddof=0: {sample.std(ddof=0):.2f}")   # ddof=0 -> if this WERE the whole population

# Standard error (SE) — how much the STATISTIC (e.g. the sample mean) would vary
# across repeated samples. Not the same as the standard deviation of the raw data.
se = stats.sem(sample)   # = sample_std / sqrt(n)
print(f"standard error of the mean: {se:.2f}")

# Degrees of freedom (df) — roughly, "how many independent pieces of information remain"
# after estimating other quantities from the same data. For a one-sample t-test: df = n - 1.
n = len(sample)
df = n - 1
print(f"degrees of freedom for a one-sample test: {df}")
```

## 🔔 Probability Distributions Reference

```python
from scipy import stats
import numpy as np

# Normal distribution — PDF, CDF, PPF (inverse CDF / quantile function)
print(f"P(Z < 1.96) = {stats.norm.cdf(1.96):.4f}")       # ~0.975 — the classic 95% one-sided cutoff
print(f"z for 97.5th percentile = {stats.norm.ppf(0.975):.4f}")  # ~1.96 — inverse of the line above
print(f"PDF height at z=0: {stats.norm.pdf(0):.4f}")       # ~0.3989 — peak of the standard normal curve

# t-distribution — heavier tails than normal, converges to normal as df grows
for df in [1, 5, 30, 1000]:
    crit = stats.t.ppf(0.975, df=df)
    print(f"df={df:>4}: two-sided 95% critical value = {crit:.4f}")
# as df -> infinity, this converges to the normal's 1.96

# Binomial — P(X=k successes) in n trials with success probability p
n, p = 20, 0.3
print(f"P(exactly 6 successes) = {stats.binom.pmf(6, n, p):.4f}")
print(f"P(at most 6 successes) = {stats.binom.cdf(6, n, p):.4f}")
print(f"expected value = n*p = {n*p:.1f}, variance = n*p*(1-p) = {n*p*(1-p):.2f}")

# Poisson — P(X=k events) given an average rate lambda
lam = 4.5
print(f"P(exactly 3 events | lambda=4.5) = {stats.poisson.pmf(3, lam):.4f}")

# Checking whether sample data looks approximately normal
sample = np.random.default_rng(0).normal(0, 1, 200)
stat, p_val = stats.shapiro(sample)
print(f"Shapiro-Wilk normality test: W={stat:.4f}, p={p_val:.4f} (p > 0.05 -> fails to reject normality)")
```

## 🎯 Point Estimation

```python
import numpy as np
from scipy import stats

# An estimator is a rule/formula; an ESTIMATE is the number you get from applying it to data.

# Desirable estimator properties:
# - Unbiased: E[estimator] = true parameter (on average, across repeated samples, it's right)
# - Consistent: converges to the true parameter as sample size grows
# - Efficient: has the lowest variance among unbiased estimators

# Classic example: sample variance with ddof=1 (Bessel's correction) is unbiased for population variance;
# dividing by n instead of n-1 (ddof=0) is a common BIASED estimator that understates variance.
population = np.random.default_rng(1).normal(50, 10, 100000)
true_var = population.var()  # ddof=0 on the full population is fine — it's not being estimated here

biased_estimates, unbiased_estimates = [], []
for _ in range(3000):
    sample = np.random.default_rng().choice(population, size=10, replace=False)
    biased_estimates.append(sample.var(ddof=0))
    unbiased_estimates.append(sample.var(ddof=1))

print(f"true population variance: {true_var:.2f}")
print(f"average of biased (ddof=0) estimates:   {np.mean(biased_estimates):.2f}  <- systematically too low")
print(f"average of unbiased (ddof=1) estimates: {np.mean(unbiased_estimates):.2f}  <- centered on the truth")

# Maximum likelihood estimation (MLE) — fit a distribution's parameters to observed data
data = stats.gamma.rvs(a=2.0, scale=2.0, size=500, random_state=42)
shape_hat, loc_hat, scale_hat = stats.gamma.fit(data, floc=0)  # floc=0 fixes location, fits shape+scale
print(f"MLE-fitted gamma: shape={shape_hat:.2f}, scale={scale_hat:.2f} (true: shape=2.0, scale=2.0)")

# Method of moments (simpler, matches sample mean/variance to distribution formulas) is
# the older alternative to MLE — still used when MLE has no closed form or is unstable.
```

## 📊 Sampling Distributions the Central Limit Theorem

```python
import numpy as np
from scipy import stats

rng = np.random.default_rng(42)

# The CLT: no matter the shape of the POPULATION distribution, the sampling distribution
# of the sample MEAN approaches a normal distribution as n grows — this is why t/z tests
# are usable even on non-normal raw data, as long as the sample size is reasonable.

population = rng.exponential(scale=2.0, size=100000)   # deliberately skewed, not normal
print(f"population: mean={population.mean():.3f}, std={population.std():.3f}, skew={stats.skew(population):.3f}")

sample_means = np.array([rng.choice(population, size=30, replace=False).mean() for _ in range(2000)])
print(f"sampling distribution of the mean (n=30): mean={sample_means.mean():.3f}, std={sample_means.std():.3f}")
print(f"predicted SE = population_std / sqrt(n) = {population.std()/np.sqrt(30):.3f}")
print(f"skew of the sampling distribution: {stats.skew(sample_means):.3f}  <- much closer to 0 (normal) than {stats.skew(population):.3f}")

# Rule of thumb: n >= 30 is often "enough" for the CLT to kick in for reasonably-shaped
# populations; more skewed/heavy-tailed populations need larger n before the approximation is good.
```

## 📏 Confidence Intervals

```python
import numpy as np
from scipy import stats
from statsmodels.stats.proportion import proportion_confint

# A 95% CI means: if you repeated this sampling process many times and built a CI each time,
# about 95% of those intervals would contain the true parameter. It does NOT mean "there's a
# 95% chance the true value is in THIS interval" (the true value is fixed, not random).

sample = np.array([48, 52, 55, 49, 61, 58, 47, 53, 50, 56, 59, 45, 54, 51, 62, 48, 57, 50, 53, 55])
n = len(sample)
mean = sample.mean()
sem = stats.sem(sample)

# CI for a mean, unknown population variance -> use the t-distribution
ci_t = stats.t.interval(0.95, df=n-1, loc=mean, scale=sem)
print(f"mean={mean:.2f}, 95% CI (t-based): ({ci_t[0]:.2f}, {ci_t[1]:.2f})")

# Manual construction, to show what's actually happening
t_crit = stats.t.ppf(0.975, df=n-1)      # two-sided: split 5% into 2.5% per tail
margin = t_crit * sem
print(f"manual: {mean:.2f} +/- {margin:.2f}  ->  ({mean-margin:.2f}, {mean+margin:.2f})")

# CI for a proportion — Wald (simple, but poor for small n or extreme p) vs Wilson (more robust)
successes, trials = 45, 100
print(f"Wald CI:   {proportion_confint(successes, trials, method='normal')}")
print(f"Wilson CI: {proportion_confint(successes, trials, method='wilson')}")   # prefer this in practice

# Interpreting width: wider CI = less precise estimate. Width shrinks with sqrt(n), so
# quadrupling the sample size only halves the CI width — diminishing returns.
```

## 🧪 Hypothesis Testing Framework

```python
from scipy import stats
import numpy as np

# The standard workflow:
# 1. State H0 (null — "no effect/no difference") and H1 (alternative — what you suspect is true)
# 2. Choose a significance level alpha (commonly 0.05) BEFORE looking at the data
# 3. Choose and run the appropriate test, getting a test statistic and a p-value
# 4. Compare p-value to alpha: p < alpha -> reject H0; otherwise fail to reject H0
# 5. Interpret in context — statistical significance is not the same as practical importance

# What a p-value actually is: the probability of seeing a result AT LEAST as extreme as
# what you observed, IF the null hypothesis were true. It is NOT the probability that H0 is true.

sample = np.array([102, 98, 105, 110, 95, 108, 101, 99, 107, 103])
t_stat, p_value = stats.ttest_1samp(sample, popmean=100)
print(f"H0: population mean = 100 vs H1: population mean != 100")
print(f"t={t_stat:.3f}, p={p_value:.4f}")
alpha = 0.05
if p_value < alpha:
    print(f"p ({p_value:.4f}) < alpha ({alpha}) -> reject H0")
else:
    print(f"p ({p_value:.4f}) >= alpha ({alpha}) -> fail to reject H0 (NOT the same as 'accept H0')")

# One-tailed vs two-tailed
# Two-tailed (default, `alternative='two-sided'`): H1 is "different from" — catches effects in either direction
# One-tailed (`alternative='greater'` or `'less'`): H1 is "greater than" / "less than" — only
#   valid when you have a real, pre-registered reason to rule out the opposite direction;
#   don't switch to one-tailed after seeing the data just to get a smaller p-value.
t_stat, p_greater = stats.ttest_1samp(sample, popmean=100, alternative='greater')
print(f"one-tailed (H1: mean > 100): p={p_greater:.4f}  (roughly half the two-tailed p, when the effect is in that direction)")
```

## ⚖️ Type I/II Errors Statistical Power

```python
import numpy as np
from scipy import stats

# Type I error (alpha) — rejecting a TRUE null hypothesis ("false positive")
#   Controlled directly by your choice of significance level (usually 0.05)
# Type II error (beta) — failing to reject a FALSE null hypothesis ("false negative")
#   Depends on effect size, sample size, variability, and alpha
# Power = 1 - beta — the probability of correctly detecting a real effect that exists

#              H0 is actually True         H0 is actually False
# Reject H0    Type I error (alpha)        Correct (power, 1-beta)
# Fail reject  Correct (1-alpha)           Type II error (beta)

# Empirically confirming the ~5% false-positive rate when H0 is TRUE (no real difference)
rng = np.random.default_rng(123)
false_positives = 0
n_tests = 2000
for _ in range(n_tests):
    a = rng.normal(0, 1, 30)
    b = rng.normal(0, 1, 30)          # same distribution -- H0 genuinely holds
    _, p = stats.ttest_ind(a, b)
    if p < 0.05:
        false_positives += 1
print(f"false-positive rate over {n_tests} null-true tests: {false_positives/n_tests:.4f} (expected ~0.05)")

# The alpha/beta trade-off: lowering alpha (fewer false positives) increases beta
# (more false negatives) for a fixed sample size — the only way to reduce BOTH is more data.
```

## 🔢 Sample Size Power Analysis

```python
from statsmodels.stats.power import TTestIndPower, TTestPower

# "How many samples do I need?" requires 4 inputs, any 3 of which determine the 4th:
# effect size, alpha, power, and sample size.

analysis = TTestIndPower()

n_needed = analysis.solve_power(effect_size=0.5, alpha=0.05, power=0.8, alternative='two-sided')
print(f"n per group for d=0.5 (medium effect), alpha=0.05, power=0.80: {n_needed:.1f}")

achieved_power = analysis.solve_power(effect_size=0.5, nobs1=64, alpha=0.05)
print(f"achieved power with n=64/group at d=0.5: {achieved_power:.3f}")

# Effect of shrinking the effect size you want to detect (smaller effects need much bigger n)
for d in [0.2, 0.5, 0.8]:
    n = analysis.solve_power(effect_size=d, alpha=0.05, power=0.8)
    print(f"d={d} (Cohen's 'small/medium/large'): n per group = {n:.0f}")

# Rule-of-thumb interpretation of Cohen's d: 0.2=small, 0.5=medium, 0.8=large — but the
# "right" effect size to power for should come from what's practically meaningful in
# context, not just these generic labels.
```

## 1️⃣ One-Sample Tests

```python
from scipy import stats
import numpy as np

# One-sample t-test — compare a sample mean to a known/hypothesized value
sample = np.random.default_rng(1).normal(loc=105, scale=15, size=40)
t_stat, p_val = stats.ttest_1samp(sample, popmean=100)
print(f"one-sample t-test vs mu=100: t={t_stat:.3f}, p={p_val:.4f}")

# One-sample z-test — used instead of t when population std IS known (rare in practice;
# with an unknown std, always use the t-test, even for large n)
def one_sample_z_test(sample, pop_mean, pop_std):
    n = len(sample)
    z = (sample.mean() - pop_mean) / (pop_std / np.sqrt(n))
    p = 2 * (1 - stats.norm.cdf(abs(z)))
    return z, p
z, p = one_sample_z_test(sample, pop_mean=100, pop_std=15)
print(f"one-sample z-test (sigma known=15): z={z:.3f}, p={p:.4f}")

# One-sample test for a proportion
from statsmodels.stats.proportion import proportions_ztest
successes, n = 58, 100
z_stat, p_val = proportions_ztest(count=successes, nobs=n, value=0.5)
print(f"proportion test vs 0.5: z={z_stat:.3f}, p={p_val:.4f}")
```

## 2️⃣ Two-Sample Tests

```python
from scipy import stats
import numpy as np

rng = np.random.default_rng(1)
group_a = rng.normal(50, 10, 60)
group_b = rng.normal(55, 12, 55)

# Welch's t-test (unequal variances) — the safer DEFAULT for independent samples;
# it doesn't assume both groups have the same variance.
t_stat, p_val = stats.ttest_ind(group_a, group_b, equal_var=False)
print(f"Welch's t-test:  t={t_stat:.3f}, p={p_val:.4f}")

# Student's t-test (equal variances assumed) — only use after checking variances are
# actually similar (e.g. via Levene's test below); otherwise Welch's is safer.
t_stat2, p_val2 = stats.ttest_ind(group_a, group_b, equal_var=True)
print(f"Student's t-test: t={t_stat2:.3f}, p={p_val2:.4f}")

# Testing the equal-variance assumption itself
levene_stat, levene_p = stats.levene(group_a, group_b)
print(f"Levene's test for equal variances: stat={levene_stat:.3f}, p={levene_p:.4f}")

# Paired t-test — same subjects measured twice (before/after), not two independent groups
before = rng.normal(100, 15, 30)
after = before + rng.normal(5, 8, 30)      # correlated with 'before' by construction
t_stat, p_val = stats.ttest_rel(after, before)
print(f"paired t-test: t={t_stat:.3f}, p={p_val:.4f}")
```

## 🎚️ Non-Inferiority Equivalence Testing

```python
import numpy as np
from statsmodels.stats.weightstats import ttost_ind

# Standard two-sample tests ask "is there ANY difference?" — non-inferiority and
# equivalence testing ask a different, often more useful business question:
# "is the difference small enough not to matter?"
# Non-inferiority: new is not WORSE than old by more than a pre-specified margin
# Equivalence: new is not meaningfully DIFFERENT from old, in either direction

rng = np.random.default_rng(5)
old = rng.normal(50, 8, 300)
new = rng.normal(49.7, 8, 300)

# TOST (Two One-Sided Tests): runs one-sided tests against the lower AND upper equivalence
# bounds; BOTH must reject their respective null before equivalence can be claimed
low, upp = -2, 2    # a difference within +/-2 units is considered "practically the same"
p_val, (t1, p1, df1), (t2, p2, df2) = ttost_ind(new, old, low, upp, usevar='unequal')

print(f"observed mean difference: {new.mean() - old.mean():.3f}")
print(f"TOST equivalence p-value: {p_val:.4f}")
print(f"  lower-bound one-sided test: p={p1:.4f}")
print(f"  upper-bound one-sided test: p={p2:.4f}")
if p_val < 0.05:
    print(f"-> equivalent within the [{low}, {upp}] margin")
else:
    print("-> cannot claim equivalence at this margin/sample size")

# Choosing the equivalence margin is a DOMAIN decision, not a statistical one — it should
# reflect what difference would actually matter in practice, and be set before the study runs.
# Common uses: generic-drug bioequivalence, "will a cheaper vendor perform just as well",
# migrating a pipeline/model and confirming output didn't meaningfully change.
```

## 📈 ANOVA Post-Hoc Comparisons

```python
from scipy import stats
from statsmodels.stats.multicomp import pairwise_tukeyhsd
import numpy as np

rng = np.random.default_rng(1)
g1 = rng.normal(20, 5, 30)
g2 = rng.normal(23, 5, 30)
g3 = rng.normal(28, 5, 30)

# One-way ANOVA — tests whether AT LEAST ONE group mean differs; doesn't say which
f_stat, p_val = stats.f_oneway(g1, g2, g3)
print(f"one-way ANOVA: F={f_stat:.3f}, p={p_val:.5f}")

# Tukey HSD — the standard post-hoc test to find out WHICH pairs differ, while
# controlling the family-wise error rate across all pairwise comparisons
data = np.concatenate([g1, g2, g3])
labels = ['g1']*30 + ['g2']*30 + ['g3']*30
print(pairwise_tukeyhsd(data, labels))

# Two-way ANOVA (two categorical factors + their interaction) needs statsmodels' formula API:
# import statsmodels.formula.api as smf
# from statsmodels.stats.anova import anova_lm
# model = smf.ols('value ~ C(factor_a) * C(factor_b)', data=df).fit()
# print(anova_lm(model, typ=2))

# Repeated-measures ANOVA (same subjects across 3+ conditions) —
# from statsmodels.stats.anova import AnovaRM
# AnovaRM(df, depvar='value', subject='subject_id', within=['condition']).fit()
```

## 🧮 ANCOVA

```python
import numpy as np
import pandas as pd
import statsmodels.formula.api as smf
from statsmodels.stats.anova import anova_lm
from scipy import stats as spstats

# ANCOVA extends ANOVA by controlling for one or more continuous covariates — it answers
# "do groups differ, AFTER accounting for a variable that also affects the outcome?"
# This typically increases statistical power and can change conclusions versus a naive
# group comparison that ignores the covariate entirely.

rng = np.random.default_rng(9)
n = 90
pretest = rng.normal(70, 10, n)                 # covariate: known to affect the outcome
group = np.repeat(['control', 'treatment_a', 'treatment_b'], 30)
treatment_effect = {'control': 0, 'treatment_a': 4, 'treatment_b': 8}
posttest = pretest*0.8 + rng.normal(20, 5, n) + np.array([treatment_effect[g] for g in group])
df = pd.DataFrame({'pretest': pretest, 'group': group, 'posttest': posttest})

# Naive comparison, ignoring the covariate entirely
naive_f, naive_p = spstats.f_oneway(*[df[df.group == g].posttest for g in df.group.unique()])
print(f"naive one-way ANOVA (ignores pretest): F={naive_f:.3f}, p={naive_p:.5f}")

# ANCOVA: posttest ~ group, controlling for pretest
model = smf.ols('posttest ~ C(group) + pretest', data=df).fit()
print(anova_lm(model, typ=2))
print(f"\nadjusted R-squared: {model.rsquared_adj:.4f}")

# Key assumption unique to ANCOVA: "homogeneity of regression slopes" — the relationship
# between the covariate and outcome should be roughly the same across groups. Check by
# adding a group*covariate interaction term; if it's significant, plain ANCOVA isn't appropriate:
# smf.ols('posttest ~ C(group) * pretest', data=df).fit()
```

## 🎲 Non-Parametric Tests

```python
from scipy import stats
import numpy as np

rng = np.random.default_rng(7)

# Use non-parametric tests when data is skewed, ordinal, has outliers, or the sample
# is too small to trust the CLT / normality assumptions of their parametric counterparts.

# Mann-Whitney U — non-parametric analog of the independent two-sample t-test
a = rng.exponential(2, 40)
b = rng.exponential(3, 40)
u_stat, p_val = stats.mannwhitneyu(a, b, alternative='two-sided')
print(f"Mann-Whitney U: U={u_stat:.1f}, p={p_val:.4f}")

# Wilcoxon signed-rank — non-parametric analog of the paired t-test
before = rng.exponential(5, 25)
after = before + rng.normal(0, 1, 25)
w_stat, p_val = stats.wilcoxon(after, before)
print(f"Wilcoxon signed-rank: W={w_stat:.1f}, p={p_val:.4f}")

# Kruskal-Wallis — non-parametric analog of one-way ANOVA (3+ groups)
g1 = rng.exponential(2, 30)
g2 = rng.exponential(2.5, 30)
g3 = rng.exponential(3, 30)
h_stat, p_val = stats.kruskal(g1, g2, g3)
print(f"Kruskal-Wallis: H={h_stat:.3f}, p={p_val:.5f}")

# Sign test — the most assumption-light option (just uses +/- direction, ignores magnitude);
# useful when even rank-based assumptions feel shaky
diffs = after - before
n_pos = (diffs > 0).sum()
sign_p = stats.binomtest(n_pos, len(diffs), p=0.5).pvalue
print(f"sign test: {n_pos}/{len(diffs)} positive, p={sign_p:.4f}")
```

## 🔗 Chi-Square Categorical Data Tests

```python
from scipy import stats
import numpy as np

# Goodness-of-fit — does an observed category distribution match an expected one?
observed = [45, 30, 25]
expected = [100/3, 100/3, 100/3]
chi2, p_val = stats.chisquare(observed, f_exp=expected)
print(f"chi-square goodness-of-fit: chi2={chi2:.3f}, p={p_val:.4f}")

# Test of independence — are two categorical variables associated?
table = np.array([[30, 20], [15, 35]])   # rows/cols = categories, cells = counts
chi2, p_val, dof, expected_table = stats.chi2_contingency(table)
print(f"chi-square independence: chi2={chi2:.3f}, p={p_val:.4f}, dof={dof}")
print(f"expected counts under independence:\n{expected_table}")

# Fisher's exact test — use instead of chi-square when any expected cell count is < 5
# (chi-square's approximation breaks down for sparse tables)
small_table = [[8, 2], [1, 9]]
odds_ratio, p_val = stats.fisher_exact(small_table)
print(f"Fisher's exact: odds ratio={odds_ratio:.3f}, p={p_val:.4f}")

# McNemar's test — for PAIRED categorical data (e.g. same users, before/after a change)
from statsmodels.stats.contingency_tables import mcnemar
paired_table = [[45, 10], [5, 40]]   # [ [both-yes/first-only], [second-only/both-no] ]
result = mcnemar(paired_table, exact=True)
print(f"McNemar's test: stat={result.statistic:.3f}, p={result.pvalue:.4f}")
```

## 📐 Effect Size Measures

```python
import numpy as np
from scipy import stats

# A p-value tells you IF an effect is likely real; effect size tells you HOW BIG it is.
# Always report both — a huge sample can make a trivial effect "statistically significant".

# Cohen's d — standardized mean difference (independent samples, pooled std)
def cohens_d(a, b):
    n1, n2 = len(a), len(b)
    pooled_std = np.sqrt(((n1-1)*a.var(ddof=1) + (n2-1)*b.var(ddof=1)) / (n1+n2-2))
    return (a.mean() - b.mean()) / pooled_std

rng = np.random.default_rng(1)
a = rng.normal(50, 10, 60); b = rng.normal(55, 12, 55)
print(f"Cohen's d = {cohens_d(a, b):.3f}   (0.2=small, 0.5=medium, 0.8=large, by convention)")

# Eta-squared (eta^2) — proportion of total variance explained by group membership (ANOVA)
g1 = rng.normal(20, 5, 30); g2 = rng.normal(23, 5, 30); g3 = rng.normal(28, 5, 30)
data = np.concatenate([g1, g2, g3])
grand_mean = data.mean()
ss_between = sum(len(g)*(g.mean()-grand_mean)**2 for g in [g1, g2, g3])
ss_total = sum((data - grand_mean)**2)
print(f"eta-squared = {ss_between/ss_total:.4f}   (0.01=small, 0.06=medium, 0.14=large)")

# Cramer's V — effect size for chi-square tests of independence, bounded [0, 1]
table = np.array([[30, 20], [15, 35]])
chi2, _, _, _ = stats.chi2_contingency(table)
n = table.sum(); r, c = table.shape
cramers_v = np.sqrt(chi2 / (n * (min(r, c) - 1)))
print(f"Cramer's V = {cramers_v:.4f}   (0.1=small, 0.3=medium, 0.5=large, for a 2x2 table)")

# Correlation coefficient r is itself an effect size (r^2 = proportion of variance explained)
x = rng.normal(0, 1, 100); y = 2*x + rng.normal(0, 1, 100)
r, _ = stats.pearsonr(x, y)
print(f"r = {r:.3f}, r-squared (variance explained) = {r**2:.3f}")
```

## 🧮 Multiple Testing Correction

```python
from statsmodels.stats.multitest import multipletests

# Running many hypothesis tests inflates the overall false-positive rate: with alpha=0.05,
# ~5% of independent NULL tests will "reject" by pure chance — and that risk compounds:
# P(>=1 false positive across k tests) = 1 - (1 - alpha)^k
# k=1: ~5%, k=5: ~23%, k=10: ~40%, k=20: ~64%  (confirmed empirically via simulation, see gotchas)

p_values = [0.001, 0.008, 0.039, 0.041, 0.042, 0.06, 0.074, 0.205, 0.212, 0.216, 0.222, 0.251]

# Bonferroni — simplest and most conservative: multiply each p-value by k (or divide alpha by k)
reject_bonf, p_bonf, _, _ = multipletests(p_values, alpha=0.05, method='bonferroni')
print(f"Bonferroni rejects: {reject_bonf.tolist()}")

# Holm — uniformly more powerful than Bonferroni (rejects at least as many), same guarantee
reject_holm, p_holm, _, _ = multipletests(p_values, alpha=0.05, method='holm')
print(f"Holm rejects:       {reject_holm.tolist()}")

# Benjamini-Hochberg (FDR) — controls the expected FALSE DISCOVERY RATE rather than the
# probability of any false positive; less conservative, standard for exploratory/large-k settings
reject_bh, p_bh, _, _ = multipletests(p_values, alpha=0.05, method='fdr_bh')
print(f"Benjamini-Hochberg rejects: {reject_bh.tolist()}")

# Choosing a method:
# - Confirmatory research / few tests / need strict error control -> Bonferroni or Holm
# - Exploratory analysis / many tests (e.g. genomics, dozens of metrics) -> Benjamini-Hochberg
```

## ⏱️ Sequential Testing Always-Valid Inference

```python
import numpy as np
from scipy import stats

# Fixed-sample tests assume you decide on a sample size UP FRONT and look once. Sequential
# methods are built to let you look repeatedly as data arrives without inflating error rates
# — useful for live monitoring (experiments, quality control) where waiting for a fixed n
# wastes time when an effect is obvious early, or when it clearly isn't there at all.

print("--- Wald's Sequential Probability Ratio Test (SPRT) ---")
# Testing a binomial rate: p0=0.10 (uninteresting) vs p1=0.15 (interesting), evaluated
# one observation at a time instead of after a fixed batch.
p0, p1 = 0.10, 0.15
alpha, beta = 0.05, 0.10                 # target false-positive / false-negative rates
A = (1 - beta) / alpha                     # upper boundary: accept H1
B = beta / (1 - alpha)                       # lower boundary: accept H0

rng = np.random.default_rng(0)
true_p = 0.15                                 # simulate data actually generated under H1
log_lr, decision, n_looks = 0.0, None, 0
for i in range(1, 2000):
    x = rng.binomial(1, true_p)
    log_lr += x*np.log(p1/p0) + (1-x)*np.log((1-p1)/(1-p0))
    n_looks = i
    if log_lr >= np.log(A):
        decision = "reject H0 (accept H1)"
        break
    elif log_lr <= np.log(B):
        decision = "accept H0"
        break
print(f"decision: {decision} after {n_looks} sequential looks — often far fewer than a fixed-n design needs")

print("\n--- Why naive repeated peeking breaks the error-rate guarantee ---")
def repeated_peeking_false_positive_rate(n_sims=3000, checks=(20, 50, 100, 200), seed=1):
    rng = np.random.default_rng(seed)
    false_pos = 0
    for _ in range(n_sims):
        a, b = [], []
        for n in range(1, max(checks) + 1):
            a.append(rng.normal(0, 1)); b.append(rng.normal(0, 1))   # truly null, no real effect
            if n in checks:
                _, p = stats.ttest_ind(a, b)
                if p < 0.05:
                    false_pos += 1
                    break
    return false_pos / n_sims

rate = repeated_peeking_false_positive_rate()
print(f"false-positive rate when checking a plain t-test at 4 checkpoints and stopping on p<0.05: {rate:.3f}")
print("(nominal alpha was 0.05 -- naive peeking roughly triples the real false-positive rate here)")

# Proper alternatives: pre-register fixed "looks" with an alpha-spending function
# (Pocock: constant boundary per look; O'Brien-Fleming: very strict early, relaxes later),
# or use an always-valid sequential method (mixture-SPRT / e-process based tests) designed
# so the type-I error guarantee holds no matter how often or when you peek.
```

## 🔄 Bootstrapping Resampling

```python
import numpy as np
from scipy import stats

# Bootstrap: repeatedly resample YOUR DATA (with replacement) to approximate the sampling
# distribution of a statistic — useful when there's no clean analytic formula for a
# statistic's standard error/CI (medians, ratios, custom metrics), or when you don't
# want to assume a particular parametric distribution.

data = np.random.default_rng(1).exponential(scale=4, size=200)

res = stats.bootstrap(
    (data,), np.median,
    confidence_level=0.95,
    n_resamples=5000,
    method='percentile',
    random_state=42
)
print(f"sample median = {np.median(data):.3f}")
print(f"bootstrap 95% CI for the median: ({res.confidence_interval.low:.3f}, {res.confidence_interval.high:.3f})")

# Manual bootstrap, for full control / custom statistics
def bootstrap_ci(data, stat_fn, n_boot=5000, ci=95, seed=0):
    rng = np.random.default_rng(seed)
    n = len(data)
    boot_stats = np.array([stat_fn(rng.choice(data, size=n, replace=True)) for _ in range(n_boot)])
    lo, hi = np.percentile(boot_stats, [(100-ci)/2, 100-(100-ci)/2])
    return lo, hi

lo, hi = bootstrap_ci(data, np.mean)
print(f"manual bootstrap 95% CI for the mean: ({lo:.3f}, {hi:.3f})")

# Jackknife (leave-one-out) — an older, deterministic resampling method, mainly useful
# for estimating bias; bootstrap has largely superseded it for CI construction.
```

## 🔀 Permutation Tests

```python
import numpy as np
from scipy import stats

# Permutation test: under H0 (no real difference between groups), group labels are
# exchangeable — shuffle them many times, recompute the statistic each time, and see
# how extreme the ACTUAL observed statistic is relative to that shuffled distribution.
# Makes no distributional assumptions at all; the trade-off is compute cost.

rng = np.random.default_rng(1)
a = rng.normal(50, 10, 40)
b = rng.normal(54, 10, 40)

def stat_fn(x, y):
    return np.mean(x) - np.mean(y)

res = stats.permutation_test((a, b), stat_fn, n_resamples=10000, alternative='two-sided', random_state=0)
print(f"observed difference in means: {res.statistic:.3f}")
print(f"permutation test p-value: {res.pvalue:.4f}")

t_stat, t_p = stats.ttest_ind(a, b)
print(f"(for comparison) Welch's t-test p-value: {t_p:.4f}")   # typically very close

# Permutation tests are especially useful for custom/non-standard statistics (e.g. a
# specific business metric or a non-mean summary) where no textbook test formula exists.
```

## 📉 Correlation Regression Inference

```python
import numpy as np
from scipy import stats
import statsmodels.api as sm

rng = np.random.default_rng(11)
x = rng.normal(0, 1, 100)
y = 2*x + rng.normal(0, 1, 100)

# Pearson — measures LINEAR association; sensitive to outliers, assumes roughly normal data
r, p = stats.pearsonr(x, y)
print(f"Pearson r={r:.3f}, p={p:.5f}")

# Spearman — measures MONOTONIC association via ranks; robust to outliers and non-linearity
rho, p2 = stats.spearmanr(x, y)
print(f"Spearman rho={rho:.3f}, p={p2:.5f}")

# Simple linear regression with full inferential output (coefficients, SEs, t, p, CIs)
X = sm.add_constant(x)
model = sm.OLS(y, X).fit()
print(model.summary().tables[1])
print(f"R-squared: {model.rsquared:.4f}")
ci = model.conf_int(alpha=0.05)
print(f"95% CI for the slope: ({ci[1][0]:.3f}, {ci[1][1]:.3f})")

# Correlation is not causation — a significant r or regression coefficient establishes
# association, not that x causes y; confounders, reverse causation, and selection effects
# can all produce a strong correlation with no causal link (see Causal Inference Basics below).
```

## ⏳ Survival Analysis

```python
import numpy as np
import pandas as pd
from lifelines import KaplanMeierFitter, CoxPHFitter
from lifelines.statistics import logrank_test

# Survival analysis handles TIME-TO-EVENT data with censoring — cases where the event
# (death, churn, failure, conversion) hadn't happened yet when observation ended. Treating
# censored cases as "no event ever" or dropping them both bias standard tests; survival
# methods are built to use the partial information censored observations still carry.

rng = np.random.default_rng(3)
n = 200
group = np.repeat(['standard', 'new_treatment'], n // 2)
true_time = np.where(group == 'new_treatment', rng.exponential(22, n), rng.exponential(12, n))
censor_time = rng.uniform(5, 35, n)                        # study ends / dropout, independent of the event
observed_time = np.minimum(true_time, censor_time)
event_observed = (true_time <= censor_time).astype(int)     # 1 = event seen, 0 = censored
df = pd.DataFrame({'time': observed_time, 'event': event_observed, 'group': group})

# Kaplan-Meier — non-parametric estimate of the survival curve, handles censoring correctly
kmf = KaplanMeierFitter()
for g in df.group.unique():
    mask = df.group == g
    kmf.fit(df.time[mask], df.event[mask], label=g)
    print(f"{g}: median survival time = {kmf.median_survival_time_:.2f}")

# Log-rank test — compares two (or more) survival curves for a statistically significant difference
standard, new = df[df.group == 'standard'], df[df.group == 'new_treatment']
result = logrank_test(standard.time, new.time, standard.event, new.event)
print(f"log-rank test: statistic={result.test_statistic:.3f}, p={result.p_value:.4f}")

# Cox proportional hazards — models HOW MUCH a covariate changes the instantaneous risk
# ("hazard") of the event, expressed as a hazard ratio
df_cox = df.copy()
df_cox['group_new'] = (df_cox.group == 'new_treatment').astype(int)
cph = CoxPHFitter()
cph.fit(df_cox[['time', 'event', 'group_new']], duration_col='time', event_col='event')
print(cph.summary[['coef', 'exp(coef)', 'p']])
# hazard ratio < 1 means LOWER risk of the event at any given moment (i.e. better survival)

# Key assumption: proportional hazards — the hazard ratio between groups should be roughly
# constant over time. Check with cph.check_assumptions(df_cox) before trusting the model.
```

## 🔀 Causal Inference Basics

```python
import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

# Observational data (no random assignment) can't distinguish correlation from causation
# without extra assumptions — these are the standard tools for approximating a causal
# estimate when a randomized experiment isn't available.

rng = np.random.default_rng(4)

print("--- Confounding: why a naive comparison can even have the WRONG SIGN ---")
n = 500
age = rng.normal(45, 12, n)                                     # confounder: affects both treatment & outcome
treatment = (age > 45 + rng.normal(0, 8, n)).astype(int)          # older people more likely to get treated
outcome = 50 - 0.3*age + 2*treatment + rng.normal(0, 5, n)          # TRUE treatment effect = +2.0

naive_diff = outcome[treatment == 1].mean() - outcome[treatment == 0].mean()
print(f"naive treated-vs-control difference: {naive_diff:.3f}  (true effect is +2.0 -- confounding flips the sign!)")

df = pd.DataFrame({'outcome': outcome, 'treatment': treatment, 'age': age})
adjusted = smf.ols('outcome ~ treatment + age', data=df).fit()
print(f"age-adjusted regression coefficient: {adjusted.params['treatment']:.3f}  (much closer to the true +2.0)")

print("\n--- Propensity score matching ---")
# Match each treated unit to a control unit with a similar predicted PROBABILITY of treatment,
# rather than matching on raw covariates directly -- reduces confounding on the matched variables
ps_model = smf.logit('treatment ~ age', data=df).fit(disp=0)
df['propensity'] = ps_model.predict(df)
treated = df[df.treatment == 1].reset_index(drop=True)
control = df[df.treatment == 0].reset_index(drop=True)
matched_idx = [(control.propensity - ps).abs().idxmin() for ps in treated.propensity]
matched_control = control.loc[matched_idx].reset_index(drop=True)
print(f"propensity-matched treated-vs-control difference: {treated.outcome.mean() - matched_control.outcome.mean():.3f}")

print("\n--- Difference-in-differences ---")
# Compares the CHANGE over time between a treated and control group -- controls for any
# fixed, time-invariant differences between the groups (only needs "parallel trends" to hold)
n_units = 200
unit_fx = np.repeat(rng.normal(0, 5, n_units), 2)
treated_group = np.repeat(rng.integers(0, 2, n_units), 2)
period = np.tile([0, 1], n_units)
true_effect = 3.0
y = 50 + unit_fx + 2*period + true_effect*(treated_group*period) + rng.normal(0, 2, n_units*2)
did_df = pd.DataFrame({'y': y, 'period': period, 'treated': treated_group})
did_model = smf.ols('y ~ treated * period', data=did_df).fit()
print(f"estimated DiD effect: {did_model.params['treated:period']:.3f}  (true effect: {true_effect})")

# The hard limit of all of these: they only adjust for CONFOUNDERS YOU MEASURED. Unmeasured
# confounding can still bias every estimate above -- randomized experiments remain the gold
# standard specifically because randomization balances measured AND unmeasured confounders alike.
```

## 📉 Time Series Inference

```python
import numpy as np
from statsmodels.tsa.stattools import adfuller, kpss
from statsmodels.stats.diagnostic import acorr_ljungbox

# Standard hypothesis tests assume independent observations -- time series data usually
# violates that outright, so it needs its own diagnostic tests before further analysis.

rng = np.random.default_rng(6)
random_walk = np.cumsum(rng.normal(0, 1, 300))     # non-stationary: has a "unit root"
white_noise = rng.normal(10, 2, 300)                  # stationary: constant mean/variance over time

print("--- Stationarity: ADF and KPSS have OPPOSITE null hypotheses -- always run both ---")
for name, series in [('random walk', random_walk), ('white noise', white_noise)]:
    adf_stat, adf_p, *_ = adfuller(series)                              # H0: unit root (non-stationary)
    kpss_stat, kpss_p, *_ = kpss(series, regression='c', nlags='auto')   # H0: IS stationary
    adf_says = "stationary" if adf_p < 0.05 else "non-stationary"
    kpss_says = "non-stationary" if kpss_p < 0.05 else "stationary"
    print(f"{name}: ADF p={adf_p:.4f} -> {adf_says}  |  KPSS p={kpss_p:.4f} -> {kpss_says}")

print("\n--- Autocorrelation: Ljung-Box test (H0: no autocorrelation up to this lag) ---")
ar_series = np.zeros(300)
for t in range(1, 300):
    ar_series[t] = 0.7*ar_series[t-1] + rng.normal(0, 1)     # AR(1): genuinely autocorrelated

lb_ar = acorr_ljungbox(ar_series, lags=[10], return_df=True)
lb_wn = acorr_ljungbox(white_noise, lags=[10], return_df=True)
print(f"AR(1) series:   stat={lb_ar['lb_stat'].iloc[0]:.3f}, p={lb_ar['lb_pvalue'].iloc[0]:.6f}  -> real autocorrelation detected")
print(f"white noise:    stat={lb_wn['lb_stat'].iloc[0]:.3f}, p={lb_wn['lb_pvalue'].iloc[0]:.4f}  -> no significant autocorrelation")

# Why this matters: fitting a standard regression/t-test to autocorrelated time series data
# treats each point as independent information when it isn't, badly understating the true
# standard error and inflating apparent significance -- check stationarity/autocorrelation first.
```

## 📚 Meta-Analysis Basics

```python
import numpy as np
from statsmodels.stats.meta_analysis import combine_effects

# Meta-analysis pools effect estimates from multiple independent studies into one combined
# estimate, weighting each study by its precision (inverse of its variance).

study_effects = np.array([0.35, 0.28, 0.51, 0.22, 0.41])          # e.g. standardized mean differences
study_variances = np.array([0.015, 0.022, 0.018, 0.030, 0.012])     # each study's squared standard error

result = combine_effects(study_effects, study_variances, method_re="iterated")
print(result.summary_frame())

print(f"\nfixed-effect pooled estimate:   {result.mean_effect_fe:.4f}")
print(f"random-effects pooled estimate: {result.mean_effect_re:.4f}")

# Heterogeneity: how much studies disagree with each other beyond what sampling error alone
# would explain. I-squared is the % of total variance due to real between-study differences.
homog = result.test_homogeneity()
i2 = max(0.0, result.i2)   # by convention, a negative I^2 (can occur when tau^2=0) is reported as 0%
print(f"I-squared (heterogeneity): {i2:.1f}%")
print(f"Q test for heterogeneity: stat={homog.statistic:.3f}, p={homog.pvalue:.4f}")

# Fixed-effect model assumes one true effect underlies every study; random-effects assumes
# each study estimates its OWN true effect, drawn from a distribution of effects -- use
# random-effects whenever studies differ meaningfully in population, method, or setting
# (which is almost always, in practice). High I-squared is a signal that pooling into a
# single number at all may be misleading -- investigate the source of heterogeneity first.
```

## 🧠 Bayesian Inference Basics

```python
from scipy import stats

# Frequentist: parameters are fixed, unknown constants; probability describes the
#   long-run frequency of data under repeated sampling.
# Bayesian: parameters are treated as random variables with a probability DISTRIBUTION,
#   updated from a prior belief to a posterior belief using observed data (Bayes' theorem).

# Beta-Binomial conjugate update — the classic worked example for a proportion
prior_alpha, prior_beta = 2, 2      # a "weak" prior centered on 0.5
successes, trials = 45, 100

post_alpha = prior_alpha + successes
post_beta = prior_beta + (trials - successes)
posterior_mean = post_alpha / (post_alpha + post_beta)
ci_low, ci_high = stats.beta.interval(0.95, post_alpha, post_beta)

print(f"prior: Beta({prior_alpha}, {prior_beta})")
print(f"posterior: Beta({post_alpha}, {post_beta})")
print(f"posterior mean = {posterior_mean:.4f}")
print(f"95% credible interval = ({ci_low:.4f}, {ci_high:.4f})")

# Credible interval vs confidence interval — the phrasing difference is not just semantic:
# "there is a 95% probability the true parameter lies in this interval" IS a valid statement
# for a Bayesian credible interval, but is NOT technically valid for a frequentist CI (see gotchas).

# Choosing a prior:
# - Weak/uninformative prior (e.g. Beta(1,1) = uniform): lets the data dominate the result
# - Informative prior: encodes real prior knowledge, pulls the estimate toward it —
#   most impactful with small sample sizes, washed out as data accumulates
```

## 🧠 Bayesian Hypothesis Testing (Bayes Factors)

```python
import numpy as np
import statsmodels.api as sm

# A Bayes Factor (BF) directly compares the evidence for two hypotheses/models, rather than
# testing a single null the way a p-value does. BF10 = 3 means the data are 3x more likely
# under H1 than under H0 -- it can quantify evidence FOR the null too, which a p-value never can.

rng = np.random.default_rng(2)
a = rng.normal(50, 10, 40)
b = rng.normal(55, 10, 40)
y = np.concatenate([a, b])
x = np.concatenate([np.zeros(40), np.ones(40)])

X0 = np.ones((80, 1))              # H0: no group effect (intercept-only model)
X1 = sm.add_constant(x)              # H1: group effect included
bic0 = sm.OLS(y, X0).fit().bic
bic1 = sm.OLS(y, X1).fit().bic
bf10 = np.exp((bic0 - bic1) / 2)      # a standard BIC-based Bayes Factor approximation

print(f"BIC(H0)={bic0:.2f}, BIC(H1)={bic1:.2f}")
print(f"approximate Bayes Factor (H1 vs H0): {bf10:.2f}")

# Conventional (Jeffreys / Kass-Raftery) interpretation scale for BF10:
# 1-3    barely worth mentioning / anecdotal evidence for H1
# 3-10   moderate evidence for H1
# 10-30  strong evidence for H1
# 30-100 very strong evidence for H1
# 100+   decisive evidence for H1
# (the same bands apply in reverse, as evidence FOR H0, whenever BF10 falls below 1)

# A p-value can only ever argue against H0; a Bayes Factor near 1 is a much sharper
# statement than a large p-value -- it says the data genuinely don't favor either hypothesis,
# rather than just "we failed to find evidence against the null."
```

## ⚠️ Common Gotchas Misconceptions

- **"p = 0.03 means there's a 3% chance H0 is true"** — false. A p-value is the probability of the observed data (or more extreme) GIVEN that H0 is true, not the probability that H0 is true given the data. Those are different conditional probabilities and conflating them is one of the most common statistics errors.
- **"p > 0.05 means H0 is proven true / there's no effect"** — false. Failing to reject H0 means the data didn't provide strong enough evidence against it; it could easily mean the study was underpowered, not that there's truly no effect. "Absence of evidence is not evidence of absence."
- **"A 95% CI means there's a 95% chance the true value is in this specific interval"** — technically false for a frequentist CI. The true parameter is a fixed number; either it's in the interval or it isn't. The 95% describes the LONG-RUN behavior of the _procedure_ across repeated sampling, not this one interval. (A Bayesian _credible_ interval, by contrast, does support that probability-of-the-parameter phrasing.)
- **Multiple comparisons inflate the false-positive rate fast** — running k=20 independent tests at alpha=0.05 gives roughly a 64% chance of at least one false positive by pure chance (confirmed via simulation above), not 5%. Correct for it (Bonferroni/Holm/BH) whenever you run more than a couple of tests on the same question.
- **Naive repeated peeking is multiple testing in disguise** — checking a running fixed-sample test at several checkpoints and stopping as soon as p<0.05 pushed the real false-positive rate to roughly 3x the nominal alpha in the simulation above. Use a pre-registered fixed sample size, a formal alpha-spending schedule, or an always-valid sequential method if you need to monitor results as they arrive.
- **Statistical significance ≠ practical significance** — with a large enough sample, even a trivially small, meaningless difference can produce p < 0.05. Always report and interpret an effect size alongside the p-value.
- **One-tailed tests chosen AFTER seeing the data are a red flag** — halving the p-value by switching to one-tailed only after the direction of the effect is known is a form of p-hacking; the tail direction should be decided before data collection.
- **Cherry-picking the "best" test after trying several** — if you run a t-test, then Mann-Whitney, then a permutation test and report only the one that gave p < 0.05, the true false-positive rate of that combined procedure is much higher than 0.05. Pick the appropriate test based on the data's properties, before looking at the outcome.
- **Chi-square with small expected cell counts is unreliable** — the chi-square approximation breaks down when any expected cell count is below ~5; use Fisher's exact test for small/sparse contingency tables instead.
- **Assuming independence when observations are actually correlated (clustering)** — e.g. treating repeated measurements from the same user, or successive points in a time series, as independent understates the true standard error and overstates significance; use a paired test, mixed-effects model, cluster-robust standard errors, or an explicit time-series model instead.
- **Matching/regression adjustment cannot fix UNMEASURED confounding** — propensity score matching and diff-in-differences only balance the confounders you actually measured and included; a variable you didn't collect can still fully explain an apparent causal effect. Treat observational causal estimates as suggestive, not definitive, unless the design (e.g. a strong natural experiment) rules out likely unmeasured confounders.
- **Skipping the proportional-hazards check on a Cox model** — the hazard ratio it reports is only meaningful if the relative risk between groups stays roughly constant over the whole follow-up period; if one group's risk is only higher early on (or vice versa), a single "average" hazard ratio can be misleading. Check with a formal test (e.g. Schoenfeld residuals) before trusting the coefficient.
- **Pooling heterogeneous studies into one meta-analytic number** — a low p-value on the pooled estimate doesn't mean the individual studies agreed; always check I-squared/the Q-test before treating a meta-analysis's single pooled effect as representative of every study that went into it.

## 🎯 Best Practices

- Decide your hypotheses, significance level, test, and (if applicable) sample size **before** collecting or looking at the data — pre-registration prevents a whole family of p-hacking failure modes, including naive repeated peeking.
- Always check a test's assumptions (normality, equal variances, independence, proportional hazards, stationarity) before trusting its output, and have a fallback ready (non-parametric test, robust standard errors, a formally sequential design) when they don't hold.
- Report an effect size and a confidence interval alongside every p-value — the p-value alone tells only "is there probably an effect," never "how big is it" or "does it matter."
- Correct for multiple comparisons any time you're testing more than one hypothesis on the same question or dataset; pick Bonferroni/Holm for strict control, Benjamini-Hochberg for exploratory work with many tests.
- Prefer Welch's t-test (`equal_var=False`) over Student's t-test as your default for two independent samples — it's robust to unequal variances and loses very little power when variances happen to be equal.
- Reach for a non-inferiority/equivalence test (TOST) instead of a plain difference test whenever the real business question is "did we not make this meaningfully worse", not "is there any difference at all."
- Run a power analysis before collecting data, not after a "failed" (non-significant) result — an underpowered null result is uninformative, not evidence of no effect.
- Use bootstrap or permutation methods when a statistic has no clean textbook formula, the data clearly violates parametric assumptions, or you just want fewer assumptions overall.
- For observational (non-randomized) causal questions, adjust for measured confounders explicitly (regression adjustment, propensity matching, diff-in-differences) and state plainly that unmeasured confounding remains a real risk — don't imply a randomized-trial-level guarantee that the design can't deliver.
- Diagnose time series data (stationarity, autocorrelation) before applying standard i.i.d.-assuming tests to it.
- State your interpretation in plain language matched to what a p-value, CI, or Bayes Factor can actually support — avoid phrasing that implies certainty ("proves", "confirms") that the method can't deliver.
- Visualize the data (histograms, boxplots, QQ-plots, survival curves, time series plots) before choosing a test — a two-second look often reveals skew, outliers, censoring patterns, or non-stationarity that changes which test is appropriate.

## 📚 Test-Selection Guide & Quick Formulas

| Question                                            | Assumptions hold (parametric)                  | Assumptions violated (non-parametric)  |
| --------------------------------------------------- | ---------------------------------------------- | -------------------------------------- |
| Compare 1 sample mean to a known value              | One-sample t-test                              | Sign test / Wilcoxon signed-rank       |
| Compare 2 independent group means                   | Welch's / Student's t-test                     | Mann-Whitney U                         |
| Compare 2 paired/matched samples                    | Paired t-test                                  | Wilcoxon signed-rank                   |
| Show 2 groups are "not meaningfully different"      | TOST equivalence / non-inferiority test        | —                                      |
| Compare 3+ independent group means                  | One-way ANOVA + Tukey HSD                      | Kruskal-Wallis + Dunn's test           |
| Compare 3+ group means, controlling for a covariate | ANCOVA                                         | Rank-based ANCOVA / permutation ANCOVA |
| Compare 3+ paired/repeated measures                 | Repeated-measures ANOVA                        | Friedman test                          |
| Association between 2 categorical variables         | Chi-square test of independence                | Fisher's exact (small/sparse tables)   |
| Association between 2 continuous variables          | Pearson correlation                            | Spearman correlation                   |
| Paired categorical (before/after) comparison        | —                                              | McNemar's test                         |
| Time-to-event data across 2+ groups                 | Log-rank test + Cox proportional hazards       | Kaplan-Meier alone (descriptive)       |
| Estimate a causal effect from observational data    | Regression adjustment / DiD (parallel trends)  | Propensity score matching              |
| Is a time series stationary?                        | ADF test (H0: unit root)                       | KPSS test (H0: stationary) — run both  |
| Combine effect estimates across studies             | Fixed-effect meta-analysis (low heterogeneity) | Random-effects meta-analysis           |

**Quick formulas**

| Quantity                                | Formula                                        |
| --------------------------------------- | ---------------------------------------------- |
| Standard error of the mean              | `s / sqrt(n)`                                  |
| t-statistic (one-sample)                | `(x_bar - mu0) / (s / sqrt(n))`                |
| z-statistic (proportion)                | `(p_hat - p0) / sqrt(p0*(1-p0)/n)`             |
| Cohen's d (independent samples)         | `(mean_a - mean_b) / pooled_std`               |
| Confidence interval (general)           | `estimate +/- critical_value * standard_error` |
| P(>=1 false positive across k tests)    | `1 - (1 - alpha)^k`                            |
| Bonferroni-adjusted alpha               | `alpha / k`                                    |
| Hazard ratio (Cox model)                | `exp(coefficient)`                             |
| I-squared (meta-analysis heterogeneity) | `max(0, (Q - df) / Q) * 100%`                  |
| Bayes Factor via BIC approximation      | `exp((BIC_H0 - BIC_H1) / 2)`                   |

## 💡 Pro Tips

1. **Report the effect size and CI, not just the p-value** — "p=0.03" tells a reader almost nothing about whether the effect is big enough to act on; "3.2 percentage points, 95% CI [1.1, 5.3]" does.
2. **Default to Welch's t-test, not Student's** — modern statistical guidance (and simulation) shows it costs almost nothing when variances are equal and saves you when they aren't.
3. **Run the false-positive-rate simulation yourself once** — simulating a few thousand truly-null tests and counting how many "reject" at p<0.05 is the fastest way to build real intuition for what alpha actually controls, and repeating it with repeated peeking shows why monitoring dashboards need a real sequential method.
4. **Treat "marginally significant" (p between 0.05 and 0.10) honestly** — it's neither a clear reject nor a clear non-reject; say so rather than rounding it to whichever conclusion is convenient.
5. **Use Benjamini-Hochberg by default for exploratory multi-metric analyses** — Bonferroni's strictness becomes overly conservative fast once you're past a handful of simultaneous tests.
6. **Bootstrap first when in doubt about a statistic's sampling distribution** — it sidesteps a whole category of "which formula applies here" questions, at the cost of some compute.
7. **A significant test on a huge dataset can still be a non-issue** — always sanity-check the effect size against what's operationally meaningful before acting on a p-value alone.
8. **Pre-register your analysis plan for anything that matters** — even an informal one-paragraph note of "here's the test, alpha, and sample size, written before looking at results" prevents most self-inflicted p-hacking.
9. **Distinguish "no evidence of an effect" from "evidence of no effect"** — the former is a data limitation; the latter requires a properly powered equivalence/non-inferiority test, which is a different tool entirely.
10. **When assumptions are genuinely unclear, run both the parametric and non-parametric test** — if they agree, you've got robust evidence; if they disagree sharply, that disagreement itself is worth understanding before trusting either p-value.
11. **Treat any observational causal estimate as one input, not the final word** — pair regression adjustment/matching with a sensitivity check ("how strong would an unmeasured confounder need to be to explain this away?") whenever the decision really matters.
12. **Always run ADF and KPSS together on time series data, never just one** — their opposite null hypotheses mean either test alone can leave you with the wrong conclusion; only report "stationary" when both agree.
13. **Check I-squared before trusting a meta-analysis headline number** — a precise-looking pooled estimate sitting on top of highly heterogeneous studies is a signal to investigate sources of disagreement, not a green light to stop there.

## 🧪 Worked Examples Across Industries

> 31 real-world problems, one for (almost) every test and method above, spanning manufacturing, healthcare, retail, software/infra, pharma, agriculture, education, sports science, restaurants, polling, marketing, clinical trials, UX research, genomics, fraud detection, finance, nonprofits, real estate, environmental health, oncology, SaaS, public health, labor economics, demand planning, meta-research, and product research. Every scenario's sample data and analysis code was actually executed with SciPy/statsmodels/lifelines — the numbers quoted in each lesson are the real computed output, not invented figures, including two examples that came back non-significant on the first pass and were used as-is rather than re-rolled to force a "cleaner" story.

### 📑 Contents

1. [One-Sample & Proportion Tests](#one-sample-proportion-tests) — 1–2
2. [Two-Sample Tests](#two-sample-tests) — 3–5
3. [Non-Inferiority & Equivalence Testing](#non-inferiority-equivalence-testing) — 6–7
4. [ANOVA, Tukey HSD & ANCOVA](#anova-tukey-hsd-ancova) — 8–10
5. [Non-Parametric Tests](#non-parametric-tests) — 11–13
6. [Categorical Data Tests](#categorical-data-tests) — 14–17
7. [Multiple Testing Correction](#multiple-testing-correction) — 18
8. [Sequential Testing](#sequential-testing) — 19
9. [Bootstrapping](#bootstrapping) — 20–21
10. [Permutation Tests](#permutation-tests) — 22
11. [Correlation & Regression](#correlation-regression) — 23–24
12. [Survival Analysis](#survival-analysis) — 25–26
13. [Causal Inference](#causal-inference) — 27–28
14. [Time Series Inference](#time-series-inference) — 29
15. [Meta-Analysis](#meta-analysis) — 30
16. [Bayesian Inference](#bayesian-inference) — 31

### One-Sample & Proportion Tests

#### 1. Manufacturing QC — is the production line drifting off spec?

A bolt is specced at 9.80mm diameter. QC pulls 35 bolts off the line and wants to know if the process has drifted.

```python
import numpy as np
from scipy import stats

bolt_diameters = np.array([...])  # 35 measurements, mean=9.8267, sd=0.0628
t_stat, p_val = stats.ttest_1samp(bolt_diameters, popmean=9.80)
print(f"t={t_stat:.3f}, p={p_val:.4f}")
```

**Output:** `n=35, sample mean=9.8267mm, sd=0.0628, t=2.516, p=0.0168`

**Lesson:** p=0.0168 < 0.05 — the line has measurably drifted above spec (mean 9.83mm vs. target 9.80mm), even though the drift is only ~0.03mm. Small, consistent drifts are exactly what a one-sample t-test is built to catch early, before they compound into a larger tolerance problem. Whether a 0.03mm drift is worth halting the line for is a separate, practical-significance question — the test only answers "is this drift real or just noise."

#### 2. Customer support — is first-contact resolution hitting target?

A support team targets an 80% first-contact resolution (FCR) rate. Last week: 268 of 320 tickets resolved on first contact.

```python
from statsmodels.stats.proportion import proportions_ztest

z_stat, p_val = proportions_ztest(count=268, nobs=320, value=0.80)
print(f"observed rate: {268/320:.4f}, z={z_stat:.3f}, p={p_val:.4f}")
```

**Output:** `observed rate: 0.8375, z=1.818, p=0.0690`

**Lesson:** The observed rate (83.75%) looks comfortably above the 80% target, but p=0.069 is just above the conventional 0.05 cutoff — with n=320, a 3.75-point gap isn't quite enough to rule out noise as the explanation. This is a good example of a case to report honestly as "directionally positive but not conclusive yet" rather than rounding it to a clean "we beat target."

### Two-Sample Tests

#### 3. Retail — do weekend shoppers spend more per basket?

A retailer compares average basket size on weekdays (n=180) vs. weekends (n=165).

```python
from scipy import stats

t_stat, p_val = stats.ttest_ind(weekend_basket, weekday_basket, equal_var=False)
```

**Output:** `weekday mean=$41.80, weekend mean=$45.29, Welch t=2.442, p=0.01510, Cohen's d=0.264`

**Lesson:** The difference is statistically significant (p=0.015) but the effect size is small (d=0.26) — weekend baskets run about $3.50 higher on average, a real but modest effect. Worth knowing for staffing/inventory planning, but not a dramatic behavioral shift.

#### 4. Clinical — does the new medication lower blood pressure?

42 patients have blood pressure measured before and after 8 weeks on a new medication (same patients, paired design).

```python
from scipy import stats

t_stat, p_val = stats.ttest_rel(after_bp, before_bp)
```

**Output:** `mean before=147.2, mean after=137.1, mean drop=10.13, t=-9.110, p<0.000001`

**Lesson:** An overwhelmingly clear result — the drop is both large (10+ points) and extremely unlikely to be chance (p practically zero). This is the paired design doing its job: because each patient serves as their own baseline, within-patient noise (which is often huge for blood pressure) is removed from the comparison, giving far more power than comparing two independent groups would.

#### 5. Software infra — which CDN has lower latency?

Comparing response latency for two CDN providers, 500 requests each, with a variance check first.

```python
from scipy import stats

levene_stat, levene_p = stats.levene(cdn_a, cdn_b)
t_stat, p_val = stats.ttest_ind(cdn_a, cdn_b, equal_var=False)
```

**Output:** `CDN A mean=58.82ms, CDN B mean=52.85ms, Levene p=0.0274, Welch t=3.326, p=0.00091`

**Lesson:** Levene's test (p=0.027) shows the two CDNs' latency variances genuinely differ — exactly the situation where Welch's t-test (not Student's) is the right call, and it confirms CDN B is significantly faster on average (~6ms). Checking the equal-variance assumption first, rather than assuming it, mattered here.

### Non-Inferiority & Equivalence Testing

#### 6. Pharma — is the generic bioequivalent to the brand-name drug?

120 subjects per arm; bioavailability measured as % absorbed. Regulatory-style equivalence margin (simplified for illustration): ±10%.

```python
from statsmodels.stats.weightstats import ttost_ind

p_val, (t1,p1,df1), (t2,p2,df2) = ttost_ind(generic, brand, -10, 10, usevar='unequal')
```

**Output:** `brand mean=99.73, generic mean=99.65, diff=-0.09, TOST p<0.0001`

**Lesson:** A plain t-test here would almost certainly also show "no significant difference" — but that's a weak, indirect way to argue equivalence (absence of evidence). TOST directly tests "the difference is within the acceptable margin" and confirms it decisively. This distinction — proving similarity vs. failing to prove difference — is exactly why equivalence testing exists as its own tool, not just a reframed t-test.

#### 7. Manufacturing vendor switch — will the new supplier's parts still fit?

Switching part suppliers; need to confirm dimensional tolerance stays within ±0.10mm of the current supplier, n=200 per vendor.

```python
from statsmodels.stats.weightstats import ttost_ind

p_val, *_ = ttost_ind(new_vendor, old_vendor, -0.10, 0.10, usevar='unequal')
```

**Output:** `old vendor mean=5.0037mm, new vendor mean=5.0222mm, TOST p<0.0001`

**Lesson:** Equivalence confirmed well within margin — even though the new vendor's parts do run very slightly larger on average, the difference (0.019mm) is nowhere near the 0.10mm tolerance that would actually matter for fit. This is the practical, business-relevant question a plain difference test doesn't answer directly.

### ANOVA, Tukey HSD & ANCOVA

#### 8. Agriculture — which fertilizer produces the best yield?

Comparing crop yield (bushels/acre) across control, fertilizer A, and fertilizer B, 25 plots each.

```python
from scipy import stats
from statsmodels.stats.multicomp import pairwise_tukeyhsd

f_stat, p_val = stats.f_oneway(control, fert_a, fert_b)
print(pairwise_tukeyhsd(data, labels))
```

**Output:** `means: control=47.9, A=54.2, B=57.2, F=13.047, p=0.000015` — Tukey HSD: control-vs-A p=0.0033 (significant), control-vs-B p<0.001 (significant), A-vs-B p=0.2446 (not significant)

**Lesson:** The ANOVA confirms real differences exist, and Tukey HSD pinpoints exactly where: both fertilizers beat the control, but A and B aren't distinguishable from each other. Without the post-hoc test, "the ANOVA is significant" alone wouldn't tell the farm which fertilizer to actually buy.

#### 9 & 10. Education — do teaching methods affect scores, before and after controlling for prior ability?

135 students across lecture, flipped-classroom, and blended methods. Crucially, the blended-method group happened (by scheduling accident) to start with slightly higher pretest scores.

```python
# naive: posttest ~ method only
naive_f, naive_p = stats.f_oneway(*[df[df.method==m].posttest for m in df.method.unique()])
# ANCOVA: posttest ~ method + pretest
model = smf.ols('posttest ~ C(method) + pretest', data=df).fit()
print(anova_lm(model, typ=2))
```

**Output:** naive ANOVA: `F=9.635, p=0.00012` (group means: lecture=71.5, flipped=78.5, blended=79.5) — ANCOVA: method `F=7.290, p=0.000995`, pretest `F=162.9, p<0.0001`

**Lesson:** Both the naive comparison and the ANCOVA find a real method effect — but the ANCOVA's F-statistic is noticeably smaller (7.29 vs 9.64) after controlling for pretest. That gap is the pretest imbalance getting properly accounted for: part of the naive advantage for the blended group was really just "they started ahead," not the teaching method itself. The method effect survives adjustment, but it's more modest than the naive number suggested — exactly the kind of overstatement ANCOVA exists to catch.

### Non-Parametric Tests

#### 11. UX/Marketing — does the new page design keep visitors engaged longer?

Time-on-page is heavily right-skewed (most visitors leave fast, a few stay very long) — a classic case for a rank-based test over a t-test, n=300 per design.

```python
from scipy import stats

u_stat, p_val = stats.mannwhitneyu(new_design, old_design, alternative='two-sided')
```

**Output:** `median old=34.2s, median new=43.1s, U=50503.0, p=0.009549`

**Lesson:** With this much skew, comparing means directly would be dominated by a handful of extreme outlier sessions. Mann-Whitney U compares the whole distributions via ranks instead, and it detects the real shift toward longer engagement (p<0.01) without needing the data to look anything like normal.

#### 12. Sports science — did the training program improve sprint times?

22 athletes, sprint times measured before and after a training block (paired, and times are bounded near a physical floor rather than normally distributed).

```python
from scipy import stats

w_stat, p_val = stats.wilcoxon(after_time, before_time)
```

**Output:** `mean before=4.520s, mean after=4.407s, W=0.0, p<0.00001`

**Lesson:** W=0 means every single athlete improved — the most extreme possible Wilcoxon result. This is the paired non-parametric analog to example 4's paired t-test: same "before/after, same subjects" structure, but appropriate here because sprint-time improvements aren't well-modeled as normally distributed.

#### 13. Restaurant chain — do wait times differ meaningfully across locations?

Wait times at 3 locations, n=60 each, heavily right-skewed (most tables seated quickly, occasional long waits).

```python
from scipy import stats

h_stat, p_val = stats.kruskal(loc_a, loc_b, loc_c)
```

**Output:** `median wait: A=4.04, B=5.18, C=5.33 min, H=1.963, p=0.37483`

**Lesson:** Not significant — despite Location A's median looking noticeably lower than B and C, Kruskal-Wallis says this is plausibly just sampling noise at n=60 per location. This is a useful negative result: it stops the chain from over-reacting to what might just be normal week-to-week variation, and flags that a bigger sample (or a longer observation window) is needed before concluding any location genuinely runs faster.

### Categorical Data Tests

#### 14. Political polling — does this sample match the known population split?

A poll of 1,100 people is checked against a known population party-affiliation split of 35% / 33% / 32%.

```python
from scipy import stats

chi2, p_val = stats.chisquare(observed, f_exp=expected)
```

**Output:** `observed: [420, 365, 315], expected: [385.0, 363.0, 352.0], chi2=7.082, p=0.0290`

**Lesson:** p=0.029 flags a real deviation from the expected population split — this sample over-represents the first group and under-represents the third relative to known demographics. In practice this is exactly the signal that triggers survey weighting/reweighting before the poll's other results are reported.

#### 15. Marketing — does click-through rate vary by age group?

Email campaign CTR broken out across three age bands.

```python
from scipy import stats

chi2, p_val, dof, expected = stats.chi2_contingency(table)
```

**Output:** `click rates: 18-29=0.145, 30-49=0.210, 50+=0.095, chi2=52.157, p<0.000001, dof=2`

**Lesson:** A large, highly significant association — the 30-49 age band clicks at roughly double the rate of the 50+ band. With this large a sample and this large a chi-square statistic, the practical takeaway (segment campaigns by age, don't blast everyone identically) is about as clear-cut as this kind of test gets.

#### 16. Rare disease clinical trial — does the treatment increase remission?

Only 24 patients total (12 per arm) — a small trial where chi-square's approximation would be unreliable.

```python
from scipy import stats

odds_ratio, p_val = stats.fisher_exact([[9, 3], [3, 9]])
```

**Output:** `treatment remission: 9/12, placebo remission: 3/12, odds ratio=9.000, p=0.0391`

**Lesson:** With expected cell counts well under 5 in a table this small, chi-square's p-value would not be trustworthy — Fisher's exact test computes the exact probability directly and still finds a significant treatment effect (p=0.039) despite the tiny sample, which is precisely the scenario Fisher's exact test exists for.

#### 17. UX research — did the redesign actually improve task success?

Same 120 users attempt the same task before and after a redesign — paired categorical outcome (succeeded/failed), which rules out a standard chi-square test.

```python
from statsmodels.stats.contingency_tables import mcnemar

result = mcnemar([[62, 8], [22, 28]], exact=True)
```

**Output:** `before success rate: 0.583, after success rate: 0.700, McNemar stat=8.000, p=0.01612`

**Lesson:** 22 users who failed before now succeed, vs. only 8 who went the other way (succeeded before, failed after) — McNemar's test, which only looks at these "switchers," confirms the net improvement is real (p=0.016). A regular chi-square test of independence would have been the wrong tool here since it assumes independent samples, not the same 120 people measured twice.

### Multiple Testing Correction

#### 18. Genomics — which of 20 candidate genes are really associated with the disease?

A screening study tests 20 genes for differential expression; only a few are expected to be real hits.

```python
from statsmodels.stats.multitest import multipletests

reject_bonf, *_ = multipletests(p_values, alpha=0.05, method='bonferroni')
reject_holm, *_ = multipletests(p_values, alpha=0.05, method='holm')
reject_bh, *_ = multipletests(p_values, alpha=0.05, method='fdr_bh')
```

**Output:** raw p-values range from 0.0002 to 0.89 — Bonferroni flags 2 genes, Holm flags 2 genes, Benjamini-Hochberg (FDR) flags 6 genes

**Lesson:** This is the clearest possible illustration of the Bonferroni-vs-BH tradeoff: Bonferroni and Holm are both strict enough to only confirm the 2 most extreme genes, while BH's less conservative false-discovery-rate control picks up 4 more plausible hits at the same nominal alpha. For an exploratory genomics screen where the next step is targeted follow-up validation (not an immediate clinical claim), BH's larger, FDR-controlled candidate list is usually the more useful output.

### Sequential Testing

#### 19. Fraud monitoring — has the fraud rate spiked above baseline, right now?

A real-time monitoring system needs to detect an elevated fraud rate (baseline 2% vs. an alarming 5%) as fast as possible, transaction by transaction, rather than waiting for a fixed daily batch.

```python
import numpy as np

p0, p1, alpha, beta = 0.02, 0.05, 0.05, 0.10
A, B = (1-beta)/alpha, beta/(1-alpha)
log_lr = 0.0
for i, x in enumerate(transaction_stream, start=1):
    log_lr += x*np.log(p1/p0) + (1-x)*np.log((1-p1)/(1-p0))
    if log_lr >= np.log(A):
        alert(); break
```

**Output:** `ALERT: elevated fraud rate detected after monitoring 172 transactions`

**Lesson:** The SPRT reaches a confident decision after just 172 observations, rather than waiting for a pre-committed fixed batch (which, at typical transaction volumes, could mean hours of undetected elevated fraud). This is the concrete payoff of sequential testing over fixed-sample testing in a monitoring context: faster detection with a controlled, pre-specified false-alarm rate, rather than the uncontrolled false-alarm inflation that naive repeated peeking (see the main cheatsheet's gotchas) would produce.

### Bootstrapping

#### 20. Manufacturing reliability — what's the median time-to-failure, with uncertainty?

150 components tested to failure; time-to-failure is right-skewed (Weibull-distributed), so there's no simple textbook formula for a CI on the _median_ specifically.

```python
from scipy import stats

res = stats.bootstrap((time_to_failure,), np.median, confidence_level=0.95, n_resamples=5000)
```

**Output:** `sample median=794.5 hrs, bootstrap 95% CI: (731.0, 891.5)`

**Lesson:** There's no standard closed-form formula for a median's standard error the way there is for a mean's — bootstrapping sidesteps that entirely by directly resampling the data and observing how much the median actually varies across resamples. The resulting CI is exactly as usable for reliability planning (e.g. warranty period decisions) as a mean-based CI would be for a simpler statistic.

#### 21. Finance — what's the uncertainty around this strategy's Sharpe ratio?

A trading strategy shows a strong Sharpe ratio over one year of daily returns (252 observations) — but Sharpe ratio's sampling distribution has no simple textbook CI formula either.

```python
from scipy import stats

res = stats.bootstrap((daily_returns,), sharpe_fn, confidence_level=0.95, n_resamples=5000)
```

**Output:** `observed annualized Sharpe ratio: 1.983, bootstrap 95% CI: (-0.020, 4.083)`

**Lesson:** The point estimate (1.98) looks great, but the bootstrap CI is enormous and its lower bound is essentially zero — one year of daily data just isn't enough to pin down a Sharpe ratio precisely, no matter how good the point estimate looks. This is a genuinely important, easy-to-miss lesson for evaluating trading strategies: report the CI, not just the point estimate, or risk mistaking a lucky year for a genuinely skilled strategy.

### Permutation Tests

#### 22. Nonprofit fundraising — did the new campaign email raise more per donor?

Two campaign email variants, donation amounts are heavily right-skewed (log-normal — most donors give a little, a few give a lot).

```python
from scipy import stats

def stat_fn(x, y): return np.mean(x) - np.mean(y)
res = stats.permutation_test((campaign_b, campaign_a), stat_fn, n_resamples=10000)
```

**Output:** `campaign A mean=$42.92, campaign B mean=$52.54, observed diff=$9.62, permutation p=0.1058`

**Lesson:** Despite a $9.62 gap in raw means, the permutation test says this isn't strong enough evidence to call campaign B the winner (p=0.106) — donation amounts are so variable (a handful of large gifts can swing the mean substantially) that a real underlying difference this size is hard to distinguish from noise at this sample size. A useful reminder that skewed, high-variance outcomes (donations, revenue, session value) often need bigger samples than a naive look at the mean difference would suggest.

### Correlation & Regression

#### 23. Real estate — how much does square footage actually add to price?

200 home sales; the business question isn't just "are these correlated" but "what's the dollar-per-square-foot estimate, with a usable confidence range."

```python
import statsmodels.api as sm

model = sm.OLS(price, sm.add_constant(sqft)).fit()
```

**Output:** `Pearson r=0.902, slope=$143.73/sqft, 95% CI ($134.06, $153.39), R-squared=0.813`

**Lesson:** Square footage alone explains over 81% of price variance in this market — a strong, useful relationship — and critically, the regression gives a precise, actionable CI on the dollar-per-square-foot estimate ($134–$153), not just a correlation coefficient. That CI is what actually gets used in a pricing model; the r-value alone wouldn't be.

#### 24. Environmental health — does a neighborhood pollution ranking track with illness rates?

Comparing a pollution-severity ranking (ordinal) against illness-rate ranking across 30 neighborhoods — ranks, not raw pollution measurements, so Spearman rather than Pearson.

```python
from scipy import stats

rho, p_val = stats.spearmanr(pollution_rank, illness_rate)
```

**Output:** `Spearman rho=0.945, p<0.000001`

**Lesson:** A very strong monotonic relationship — as the pollution ranking worsens, illness rate rises almost in lockstep. Spearman is the right choice here specifically because the underlying pollution "ranking" is ordinal by construction, not because the relationship happens to be non-linear; Pearson would have been a conceptual mismatch even before checking assumptions.

### Survival Analysis

#### 25. Oncology — does the new drug extend survival vs. standard care?

240 patients across two treatment arms, with realistic right-censoring (trial ended before some patients' events occurred).

```python
from lifelines import KaplanMeierFitter
from lifelines.statistics import logrank_test

kmf.fit(time, event, label=arm)
lr = logrank_test(std.time, new.time, std.event, new.event)
```

**Output:** `standard_care median survival=12.7 months, new_drug median survival=23.2 months, log-rank stat=19.393, p=0.00001`

**Lesson:** Nearly double the median survival time, and the log-rank test confirms the two survival curves are genuinely different, not just different by chance in this sample. Crucially, this analysis correctly uses patients who were still alive when the study ended (censored) rather than discarding them — a plain t-test on "observed survival time" would have thrown away exactly the patients doing best on the new drug.

#### 26. SaaS — which subscription tier has higher churn risk?

300 customers, comparing time-to-churn between Basic and Pro tiers, again with censoring (many customers hadn't churned by the observation cutoff).

```python
from lifelines import CoxPHFitter

cph.fit(df[['time','event','pro']], duration_col='time', event_col='event')
```

**Output:** `hazard ratio (pro vs basic): 0.653, p=0.0055`

**Lesson:** Pro-tier customers have roughly 35% lower instantaneous churn risk than Basic-tier customers at any given moment (hazard ratio 0.653), and it's statistically solid (p=0.0055). This single hazard-ratio number is exactly the input a customer-success team would want for prioritizing retention effort — Basic-tier subscribers are the higher-risk population to focus on.

### Causal Inference

#### 27. Public health — does a smoking-cessation program actually help, or is it just who enrolls?

600 people; enrollment in a free cessation program isn't random — lower-income individuals were more likely to enroll, and income also independently affects quit outcomes (a classic confounder).

```python
import statsmodels.formula.api as smf

naive_diff = quit_rate[enrolled==1].mean() - quit_rate[enrolled==0].mean()
adjusted = smf.ols('quit ~ enrolled + income', data=df).fit()
```

**Output:** `naive difference: 0.1533 (true simulated program effect: 0.12), income-adjusted coefficient: 0.1182`

**Lesson:** The naive comparison overstates the program's effect (0.153 vs. the true 0.12 built into the simulation) because it's tangled up with income's own independent effect on quitting. Adjusting for income pulls the estimate almost exactly back to the true effect. This is precisely why "enrolled vs. didn't enroll" comparisons in voluntary programs need covariate adjustment before being trusted as causal claims — and even this adjusted estimate still assumes no other unmeasured confounders exist.

#### 28. Labor economics — did a county-level minimum wage increase reduce employment?

400 counties, half received a wage increase; comparing the CHANGE in employment before/after between treated and control counties (not just the after-period levels).

```python
import statsmodels.formula.api as smf

did_model = smf.ols('emp ~ treated * period', data=df).fit()
```

**Output:** `estimated DiD effect: -1.429 (true simulated effect: -1.2), p=0.000212, 95% CI (-2.183, -0.675)`

**Lesson:** Difference-in-differences recovers an estimate close to the true simulated effect by using each county's own pre-period trend as its baseline — it doesn't need treated and control counties to have started at the same employment level, only that they would have trended similarly absent the policy (the "parallel trends" assumption). That assumption is untestable directly and is exactly where real minimum-wage studies spend most of their methodological effort defending or challenging.

### Time Series Inference

#### 29. Demand planning — is this product's demand series stable enough to forecast directly?

200 weeks of demand data with a clear upward drift — before fitting any forecasting model, checking whether the series is stationary.

```python
from statsmodels.tsa.stattools import adfuller, kpss

adf_stat, adf_p, *_ = adfuller(trend_demand)
kpss_stat, kpss_p, *_ = kpss(trend_demand, regression='c', nlags='auto')
```

**Output:** `ADF p=0.3340 -> non-stationary, KPSS p=0.0100 -> non-stationary` (both tests agree). After first-differencing: `ADF p<0.000001 -> stationary`

**Lesson:** Both ADF and KPSS agree the raw series is non-stationary (a trending random walk) — fitting a standard forecasting model directly to it would produce unreliable, overconfident intervals. First-differencing (modeling week-over-week _changes_ instead of raw levels) fixes this cleanly, which is exactly the standard first step before applying ARIMA-family models to trending demand data.

### Meta-Analysis

#### 30. Meta-research — what's the real effect size, pooling across 6 independent studies?

Six studies evaluated the same training intervention with different sample sizes (and therefore different precision/standard errors).

```python
from statsmodels.stats.meta_analysis import combine_effects

result = combine_effects(study_effects, study_variances, method_re='iterated')
```

**Output:** `fixed-effect pooled estimate=0.4262, random-effects pooled estimate=0.4262, I-squared=0.0%, Q p-value=0.5521`

**Lesson:** The fixed-effect and random-effects estimates come out identical here because I-squared is 0% — the 6 studies are statistically consistent with all estimating the same true effect (no real heterogeneity beyond sampling noise). That's the signal that a single pooled number (≈0.43) is a genuinely fair summary of "the effect" across this literature, rather than papering over studies that actually disagree.

### Bayesian Inference

#### 31. Product research — how confident are we in the new feature's adoption rate, and is there really a lift?

200 users see a new onboarding flow; 78 adopt the feature. Also comparing adoption rate against the previous flow (35% baseline) with a Bayes Factor.

```python
from scipy import stats
import statsmodels.api as sm

post_a, post_b = 3+78, 3+(200-78)
ci = stats.beta.interval(0.95, post_a, post_b)
# ...
bf10 = np.exp((bic0 - bic1) / 2)
```

**Output:** `posterior mean adoption rate=0.3932, 95% credible interval (0.3277, 0.4607)` — Bayes Factor (new flow effect vs. no effect): `0.12`

**Lesson:** The credible interval gives a directly usable statement: "there's a 95% probability the true adoption rate is between 33% and 46%." The Bayes Factor of 0.12 (i.e., roughly 8:1 odds in favor of "no real difference" over "there's a real lift") is a genuinely informative negative result — unlike a large p-value, which can only say "we didn't find evidence of an effect," this BF actively argues the flows likely perform about the same, which is a much more decision-useful statement for whether to bother shipping the new flow.
