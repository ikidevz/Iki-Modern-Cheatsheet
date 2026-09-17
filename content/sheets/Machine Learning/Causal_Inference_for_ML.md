# Causal Inference for ML Cheatsheet

## Overview

Most ML models answer "what will happen" — causal inference answers "what would happen if I intervened." This distinction matters enormously whenever a model's output is meant to drive a decision (who to target with a discount, which treatment to prescribe) rather than just predict an outcome that will happen regardless of what you do. This sheet covers the core assumptions, common estimation methods, uplift modeling, and the pitfalls that make causal claims from ML models unreliable.

```bash
pip install scikit-learn causalml econml --break-system-packages
```

---

## 1. Correlation vs. Causation: Core Assumptions

A predictive model can find that ice cream sales correlate with drowning deaths — both are driven by a third factor (hot weather), and neither causes the other. To estimate a genuine causal effect from observational data, you generally need:

- **No unmeasured confounding (ignorability)**: all variables that affect both the treatment assignment and the outcome must be measured and accounted for. This is the assumption that's hardest to verify and most often violated.
- **Positivity (overlap)**: every unit must have a non-zero probability of receiving either treatment or control, given their covariates — you can't estimate an effect for a group that never actually receives one of the treatments.
- **SUTVA (Stable Unit Treatment Value Assumption)**: one unit's treatment doesn't affect another unit's outcome (no interference/spillover), and there's only one version of the treatment.

```python
import numpy as np
import pandas as pd

# Simulated example: does a marketing email CAUSE higher purchase amounts,
# or do naturally high-spending customers just happen to get emailed more often (confounding)?
np.random.seed(42)
n = 2000
customer_value_tier = np.random.normal(0, 1, n)  # unmeasured-in-practice "quality" of customer
# Confounding: high-value customers are MORE LIKELY to receive the email (not random assignment)
email_sent = (np.random.normal(customer_value_tier, 1, n) > 0.5).astype(int)
# True causal effect of the email is +5, but customer_value_tier ALSO independently drives purchases
purchase_amount = 50 + 5 * email_sent + 20 * customer_value_tier + np.random.normal(0, 5, n)

df = pd.DataFrame({"email_sent": email_sent, "purchase_amount": purchase_amount, "customer_value_tier": customer_value_tier})

naive_estimate = df[df.email_sent == 1].purchase_amount.mean() - df[df.email_sent == 0].purchase_amount.mean()
print(f"Naive difference in means: {naive_estimate:.2f}")  # inflated — confounds the true effect (5) with selection bias
```

---

## 2. Randomized Experiments vs. Observational Methods

```python
# The gold standard: RANDOMIZE treatment assignment, breaking any link between
# treatment and pre-existing confounders (like customer_value_tier)
random_assignment = np.random.binomial(1, 0.5, n)
purchase_amount_rct = 50 + 5 * random_assignment + 20 * customer_value_tier + np.random.normal(0, 5, n)
df_rct = pd.DataFrame({"treatment": random_assignment, "purchase": purchase_amount_rct})

rct_estimate = df_rct[df_rct.treatment == 1].purchase.mean() - df_rct[df_rct.treatment == 0].purchase.mean()
print(f"RCT estimate (should be close to the true effect of 5): {rct_estimate:.2f}")
```

**Why randomization works:** by assigning treatment independent of any covariate, randomization ensures treatment and control groups are statistically identical *in expectation* on every measured AND unmeasured factor — the confounding that plagued the observational estimate above simply can't occur, because treatment assignment has no relationship to `customer_value_tier` at all.

When randomization isn't possible or ethical (you can't randomly assign who smokes to study lung cancer), observational methods try to approximate this balance after the fact.

---

## 3. Propensity Score Matching and Inverse Propensity Weighting

```python
from sklearn.linear_model import LogisticRegression

# Step 1: model the PROBABILITY of receiving treatment given observed covariates (the propensity score)
propensity_model = LogisticRegression()
propensity_model.fit(df[["customer_value_tier"]], df["email_sent"])
propensity_scores = propensity_model.predict_proba(df[["customer_value_tier"]])[:, 1]
df["propensity_score"] = propensity_scores

# --- Propensity Score Matching: pair each treated unit with an untreated unit of SIMILAR propensity ---
from sklearn.neighbors import NearestNeighbors

treated = df[df.email_sent == 1]
control = df[df.email_sent == 0]

nn = NearestNeighbors(n_neighbors=1).fit(control[["propensity_score"]])
distances, indices = nn.kneighbors(treated[["propensity_score"]])
matched_control = control.iloc[indices.flatten()]

matched_effect = treated.purchase_amount.values.mean() - matched_control.purchase_amount.values.mean()
print(f"Propensity-matched estimate: {matched_effect:.2f}")  # should be much closer to the true effect (5)

# --- Inverse Propensity Weighting: reweight EVERY unit instead of discarding unmatched ones ---
df["ipw_weight"] = np.where(
    df.email_sent == 1, 1 / df.propensity_score, 1 / (1 - df.propensity_score)
)
weighted_treated_mean = np.average(df[df.email_sent == 1].purchase_amount, weights=df[df.email_sent == 1].ipw_weight)
weighted_control_mean = np.average(df[df.email_sent == 0].purchase_amount, weights=df[df.email_sent == 0].ipw_weight)
print(f"IPW estimate: {weighted_treated_mean - weighted_control_mean:.2f}")
```

**Matching vs. weighting tradeoff:** matching discards unmatched units (can lose a lot of data if overlap is poor, but is simple and intuitive), while IPW keeps all data but can become unstable when propensity scores are close to 0 or 1 (a unit that was almost certain to get one treatment gets an enormous weight, dominating the estimate).

---

## 4. Uplift / Treatment-Effect Modeling

Beyond estimating one average effect, uplift modeling estimates the effect *for each individual* — critical for targeting decisions (who should get the discount, not just "do discounts work on average").

```python
# T-Learner (two-model approach): train separate outcome models for treated and control groups,
# then the difference in their predictions estimates the individual treatment effect (ITE)
from sklearn.ensemble import RandomForestRegressor

X = df[["customer_value_tier"]]
model_treated = RandomForestRegressor(random_state=42).fit(X[df.email_sent == 1], df[df.email_sent == 1].purchase_amount)
model_control = RandomForestRegressor(random_state=42).fit(X[df.email_sent == 0], df[df.email_sent == 0].purchase_amount)

individual_treatment_effect = model_treated.predict(X) - model_control.predict(X)
df["predicted_uplift"] = individual_treatment_effect

# Targeting decision: only send the email to customers with high PREDICTED uplift,
# not just high predicted purchase amount (some high-spenders would buy anyway — zero incremental value)
top_targets = df.sort_values("predicted_uplift", ascending=False).head(int(0.2 * len(df)))
print(f"Average predicted uplift among top 20% targets: {top_targets.predicted_uplift.mean():.2f}")
print(f"Average predicted uplift among ALL customers: {df.predicted_uplift.mean():.2f}")
```

**Why this differs fundamentally from a standard predictive model:** a model predicting "will this customer purchase" would happily target customers who'd buy anyway regardless of the email — wasting marketing spend on zero incremental value. Uplift modeling specifically targets customers where the *intervention itself* changes the outcome, which is the actual business question for a targeting decision.

---

## 5. Difference-in-Differences and Instrumental Variables (Conceptual)

**Difference-in-Differences (DiD)**: compares the *change* over time in a treated group against the *change* over time in an untreated (control) group — useful when you have before/after data and a group that wasn't exposed to the treatment, and helps control for time trends that would confound a simple before/after comparison within just the treated group.

```
DiD estimate = (Treated_after - Treated_before) - (Control_after - Control_before)
```

**Instrumental Variables (IV)**: used when there's unmeasured confounding you can't fully adjust for, but you have access to an "instrument" — a variable that affects the treatment but has NO direct effect on the outcome except through the treatment. Classic example: using distance to the nearest college as an instrument for "years of education" when studying education's effect on earnings, since distance plausibly affects whether someone attends college but doesn't directly affect their earnings otherwise.

Both methods require domain-specific assumptions (parallel trends for DiD; instrument validity for IV) that can't be fully verified from data alone — they rest partly on argument and domain knowledge, not just statistics.

---

## 6. Common Pitfalls in Practice

- **Confounding**: the single most common way causal claims go wrong — an unmeasured variable driving both "treatment" and outcome, mimicking a causal relationship that isn't there (as in the email example above).
- **Selection bias**: if the sample itself was selected based on the outcome or a variable related to it (e.g., only studying customers who didn't churn), any causal estimate from that sample can be systematically distorted.
- **Mistaking feature importance for causal effect**: a feature with high SHAP importance or permutation importance in a predictive model reflects predictive usefulness, not a causal driver — see the Model Interpretability sheet's caveats section for the same point from the explainability angle.

```python
# Illustrating the trap directly: a feature can be highly PREDICTIVE without being CAUSAL
# "Carrying an umbrella" predicts rain (people check the forecast) — but doesn't CAUSE rain.
# A model will happily assign umbrella-carrying high importance for predicting rain.
```

## Common Pitfalls (Summary)

- **Treating a correlational finding from a predictive model as license to intervene** — "high-value customers get more emails" is not evidence that "sending more emails creates high-value customers."
- **Ignoring positivity violations** — if certain covariate combinations NEVER receive one of the treatments in your data, no method can honestly estimate an effect for that subgroup; check for this before trusting propensity-based estimates.
- **Trusting IPW estimates without checking for extreme weights** — near-zero or near-one propensity scores produce enormous weights that a few outlier units can dominate; consider trimming or stabilizing weights.
- **Assuming DiD's parallel trends assumption holds without checking it** — plot pre-treatment trends for both groups; if they weren't moving in parallel before the treatment, the method's core assumption is already violated.
- **Using a weak instrument in IV analysis** — an instrument only weakly related to the treatment produces unstable, high-variance estimates even if technically valid.

---

## 7. End-to-End Worked Example: Full Causal Analysis Pipeline With Sensitivity Checks

```python
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.ensemble import RandomForestRegressor

np.random.seed(42)
n = 5000

# A more realistic scenario: does a loyalty program membership CAUSE higher spending,
# controlling for observed confounders (age, prior spend)?
age = np.random.normal(40, 12, n)
prior_spend = np.random.lognormal(6, 0.5, n)
# Confounding: older, higher-prior-spend customers are more likely to join the loyalty program
membership_logit = 0.02 * (age - 40) + 0.3 * (np.log(prior_spend) - 6) - 0.5
membership = (1 / (1 + np.exp(-membership_logit)) > np.random.random(n)).astype(int)
# True causal effect of membership is +150, but confounded by age and prior_spend
current_spend = 500 + 150 * membership + 5 * age + 0.8 * prior_spend + np.random.normal(0, 50, n)

df = pd.DataFrame({"age": age, "prior_spend": prior_spend, "membership": membership, "current_spend": current_spend})

# STEP 1: naive comparison — inflated by confounding
naive = df[df.membership == 1].current_spend.mean() - df[df.membership == 0].current_spend.mean()
print(f"Naive difference: {naive:.1f} (confounded, biased away from the true effect of ~150)")

# STEP 2: estimate propensity scores
propensity_model = LogisticRegression()
propensity_model.fit(df[["age", "prior_spend"]], df["membership"])
df["propensity"] = propensity_model.predict_proba(df[["age", "prior_spend"]])[:, 1]

# STEP 3: CHECK POSITIVITY before trusting any downstream estimate
print(f"\nPropensity score range: [{df.propensity.min():.3f}, {df.propensity.max():.3f}]")
extreme_low = (df.propensity < 0.05).sum()
extreme_high = (df.propensity > 0.95).sum()
print(f"Units with extreme propensity (<0.05 or >0.95): {extreme_low + extreme_high} / {n}")
# If this number is large, IPW estimates below will be unstable — trim before proceeding

# STEP 4: IPW estimate, with trimming for stability
trimmed = df[(df.propensity > 0.05) & (df.propensity < 0.95)].copy()
trimmed["weight"] = np.where(
    trimmed.membership == 1, 1 / trimmed.propensity, 1 / (1 - trimmed.propensity)
)
ipw_treated = np.average(trimmed[trimmed.membership == 1].current_spend, weights=trimmed[trimmed.membership == 1].weight)
ipw_control = np.average(trimmed[trimmed.membership == 0].current_spend, weights=trimmed[trimmed.membership == 0].weight)
print(f"\nIPW estimate (trimmed): {ipw_treated - ipw_control:.1f}")

# STEP 5: T-learner for individual treatment effects, as a cross-check via a different method
model_t = RandomForestRegressor(random_state=42).fit(
    df[df.membership == 1][["age", "prior_spend"]], df[df.membership == 1].current_spend
)
model_c = RandomForestRegressor(random_state=42).fit(
    df[df.membership == 0][["age", "prior_spend"]], df[df.membership == 0].current_spend
)
ite = model_t.predict(df[["age", "prior_spend"]]) - model_c.predict(df[["age", "prior_spend"]])
print(f"T-learner average treatment effect: {ite.mean():.1f}")
```

**The point of running IPW and a T-learner side by side:** if two different, independently-reasoned causal estimation methods converge on similar numbers, that's meaningfully more trustworthy than either alone — and if they diverge sharply, that's a signal to investigate (a positivity violation, an unmodeled non-linearity, or unmeasured confounding) before reporting any single number as "the" causal effect.

---

## 8. Advanced & Lesser-Known Techniques

- **Doubly robust estimation**: combines an outcome model (like the T-learner) AND a propensity model (like IPW) into a single estimator that remains consistent even if *one* of the two models is misspecified — a meaningful robustness improvement over relying on either approach alone.
- **Regression discontinuity design (RDD)**: when treatment assignment is determined by a sharp threshold on some running variable (e.g., students scoring above 70% get a scholarship), compare outcomes for units just above vs. just below the cutoff — approximates a local randomized experiment near the threshold without needing full randomization.
- **Synthetic control methods**: when there's only one treated unit (e.g., one state that passed a policy) and many untreated units, construct a weighted combination of untreated units that closely matches the treated unit's pre-treatment trajectory, then use that synthetic combination as the counterfactual for what would have happened without treatment.
- **Sensitivity analysis for unmeasured confounding**: since the "no unmeasured confounding" assumption is never fully verifiable, sensitivity analyses (e.g., the E-value) quantify how strong an unmeasured confounder would need to be to fully explain away an observed effect — a way to communicate how fragile or robust a causal claim is, rather than presenting a point estimate as if it were certain.

---

## 9. Practice Exercises

1. Re-run the worked example without trimming extreme propensity scores and compare the (likely much less stable) IPW estimate against the trimmed version.
2. Implement a doubly robust estimator (combining the propensity model and the T-learner's outcome models) and compare its estimate against IPW and the T-learner individually, including under a deliberately misspecified propensity model.
3. Simulate an unmeasured confounder (a variable that affects both treatment and outcome but is excluded from the propensity/outcome models) and observe how much bias it introduces into each estimation method.
4. Implement a simple regression discontinuity design on simulated data where treatment is sharply assigned by a threshold, and compare the RDD estimate near the cutoff against the true simulated effect.
5. Compute a basic E-value-style sensitivity check for the worked example's IPW estimate: how strong would a hypothetical unmeasured confounder need to be (in terms of its association with both treatment and outcome) to fully explain away the estimated effect?

---

## 10. More Examples

### Example: Simple A/B test analysis as the cleanest form of causal inference

```python
import numpy as np
from scipy import stats

# The randomized experiment IS the causal inference — no adjustment needed, unlike observational methods
control_conversions, control_n = 120, 5000
treatment_conversions, treatment_n = 145, 5000

control_rate = control_conversions / control_n
treatment_rate = treatment_conversions / treatment_n

# Two-proportion z-test for statistical significance
pooled_rate = (control_conversions + treatment_conversions) / (control_n + treatment_n)
se = np.sqrt(pooled_rate * (1 - pooled_rate) * (1/control_n + 1/treatment_n))
z_score = (treatment_rate - control_rate) / se
p_value = 2 * (1 - stats.norm.cdf(abs(z_score)))

print(f"Control: {control_rate:.3%}, Treatment: {treatment_rate:.3%}")
print(f"Lift: {(treatment_rate - control_rate) / control_rate:.2%}, p-value: {p_value:.4f}")
```

### Example: Checking the parallel trends assumption before trusting a DiD estimate

```python
import numpy as np
import pandas as pd

# Simulated pre-treatment period data for a treated and control group
periods = np.arange(-5, 0)  # 5 periods BEFORE treatment
treated_pretrend = 100 + 2 * periods + np.random.normal(0, 1, 5)
control_pretrend = 90 + 2 * periods + np.random.normal(0, 1, 5)  # same SLOPE, different level — good sign

df_pretrend = pd.DataFrame({"period": periods, "treated": treated_pretrend, "control": control_pretrend})
treated_slope = np.polyfit(df_pretrend.period, df_pretrend.treated, 1)[0]
control_slope = np.polyfit(df_pretrend.period, df_pretrend.control, 1)[0]
print(f"Treated pre-trend slope: {treated_slope:.2f}, Control pre-trend slope: {control_slope:.2f}")
print("Parallel trends assumption looks" + (" reasonable" if abs(treated_slope - control_slope) < 0.5 else " QUESTIONABLE"))
# If slopes diverge substantially BEFORE treatment even started, DiD's core assumption is violated
```

### Example: Heterogeneous treatment effects — who benefits most?

```python
import pandas as pd
import numpy as np

# Reusing the T-learner's individual treatment effects from the base sheet's worked example
df_with_ite = pd.DataFrame({"age": np.random.normal(40, 12, 500), "predicted_uplift": np.random.normal(50, 30, 500)})

# Segment customers by predicted uplift to find WHO the treatment works best for
df_with_ite["uplift_segment"] = pd.qcut(df_with_ite["predicted_uplift"], q=4, labels=["low", "medium-low", "medium-high", "high"])
segment_summary = df_with_ite.groupby("uplift_segment", observed=True).agg(
    avg_age=("age", "mean"), avg_uplift=("predicted_uplift", "mean")
)
print(segment_summary)
# If "high uplift" customers skew notably younger/older, that's an actionable targeting insight
# beyond just "the treatment works on average"
```

---

## 11. Quick-Reference Cheat-Table

| Situation | Method |
|---|---|
| Can randomize treatment | Randomized experiment (gold standard) |
| Can't randomize, have rich covariates | Propensity score matching / IPW |
| Want robustness to model misspecification | Doubly robust estimation |
| Sharp threshold determines treatment | Regression discontinuity design |
| One treated unit, many controls | Synthetic control |
| Before/after data with a control group | Difference-in-differences (check parallel trends first!) |
| Need individual-level effects for targeting | Uplift/T-learner modeling |

## 12. FAQ

**Q: Does a feature's high importance in my predictive model mean it causes the outcome?**
A: No — feature importance reflects predictive usefulness, not causation. Use the methods in this sheet for actual causal claims.

**Q: Is a randomized experiment always possible?**
A: No — often unethical, impractical, or too slow. Observational methods (propensity matching, IPW, DiD, IV) approximate randomization's balance after the fact, with weaker guarantees.

**Q: How do I know if I have unmeasured confounding?**
A: You generally can't be fully certain — that's why sensitivity analyses (e.g., E-values) exist, to quantify how strong a hidden confounder would need to be to explain away your result.

**Q: Matching or weighting (IPW) — which should I use?**
A: Matching is more intuitive but discards unmatched units; IPW keeps all data but is unstable with extreme propensity scores. Trim extreme scores before using IPW.

**Q: My uplift model targets a different group than my predictive model would — which is right for a marketing campaign?**
A: The uplift model — a predictive model targets people likely to convert regardless of intervention, wasting spend on people who'd act anyway. Uplift modeling targets where the intervention itself changes the outcome.
