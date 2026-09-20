# Insights and Observations Cheatsheet

> The close-out stage of EDA: turn everything the previous eight passes surfaced into decisions, risks, and well-scoped questions for whoever picks up the work next. Conceptual rather than syntax-heavy, like the collection's other process-oriented cheatsheets (A/B Testing, Data Governance Frameworks) — but same TOC / quick-reference / gotchas skeleton.

## 📑 Table of Contents

1. [🎯 Purpose of This Stage](#purpose-of-this-stage)
2. [⚡ Quick Reference: What to Record](#quick-reference-what-to-record)
3. [🔍 Recording Patterns and Segments](#recording-patterns-and-segments)
4. [🚧 Recording Data Quality Issues](#recording-data-quality-issues)
5. [🚩 Flagging Anomalies for Investigation](#flagging-anomalies-for-investigation)
6. [🧮 Variable Usefulness Triage](#variable-usefulness-triage)
7. [🧠 Separating Evidence from Interpretation](#separating-evidence-from-interpretation)
8. [📐 Documenting Scope](#documenting-scope)
9. [✅ Handoff Checklist](#handoff-checklist)
10. [🗣️ Stakeholder-Specific Summarization](#stakeholder-specific-summarization)
11. [📊 Prioritizing Follow-Ups: Impact vs. Effort](#prioritizing-follow-ups-impact-vs-effort)
12. [🌉 The EDA-to-Modeling Bridge](#the-eda-to-modeling-bridge)
13. [📝 Worked Examples](#worked-examples)
14. [⚠️ Gotchas](#gotchas)
15. [🎯 Best Practices](#best-practices)

## 🎯 Purpose of This Stage

Every prior cheatsheet in this set (data overview, missing values, descriptive statistics, univariate, bivariate, correlation, outlier detection, feature distribution) produces *findings*. This stage converts findings into three concrete outputs that the next phase — modeling, dashboarding, or a business decision — actually needs:

1. A short list of **decisions** already made (how missingness was treated, which outliers were capped, which transform was applied, and why).
2. A short list of **open risks** that weren't resolved (a data quality issue with no clear fix yet, a pattern that needs more data to confirm).
3. A short list of **owned next actions**, not just observations left dangling.

## ⚡ Quick Reference: What to Record

| Category | Question to answer | Where it came from |
| --- | --- | --- |
| Patterns & segments | Which relationships are strong enough to act on? | Bivariate / correlation passes |
| Data quality issues | What's broken, and is the cause known? | Data overview / missing values passes |
| Anomalies | What needs a human to look at it before anyone trusts the number? | Outlier detection pass |
| Variable usefulness | Keep, transform, drop, or flag as leakage-risk? | All prior passes combined |
| Assumptions | What does every downstream conclusion silently depend on? | Every pass |
| Scope | Population, time window, filters applied? | Data overview pass |

## 🔍 Recording Patterns and Segments

Write down the relationship, its strength, and the evidence — not just the conclusion:

```text
FINDING: Enterprise segment shows ~5x the average revenue of Consumer,
with proportionally larger variance (std $3,003 vs. $393).
EVIDENCE: Grouped mean/median/std from the bivariate pass, n=66 Enterprise rows.
CAVEAT: Small n for Enterprise relative to other segments — confirm this
holds with more data before sizing a business decision on it.
```

A pattern recorded without its evidence and caveats degrades into an unverifiable claim by the time it reaches a stakeholder two steps removed from the analysis.

## 🚧 Recording Data Quality Issues

```text
ISSUE: satisfaction_score missing on 8% of rows.
LIKELY CAUSE: Newer signups haven't had time to respond to the survey (MAR
with respect to signup recency) — not confirmed to be unrelated to
satisfaction itself (MNAR risk not ruled out).
TREATMENT APPLIED: Segment-wise median imputation + a
"satisfaction_score_was_missing" indicator retained as a feature.
OWNER / NEXT ACTION: Flag to the survey team that response rate is
uneven by segment; re-evaluate once more data accumulates.
```

## 🚩 Flagging Anomalies for Investigation

Not every anomaly needs to be resolved before handoff — but every one needs to be *named*, with its current status:

```text
ANOMALY: 8 customers with revenue 6-12x their segment's typical value.
STATUS: Confirmed real (large one-time enterprise contracts), not a data
entry error — cross-checked against the source billing system.
TREATMENT: Kept in the dataset; flagged with an is_outlier indicator
rather than removed, since they're legitimate and would understate
total revenue if dropped.
```

## 🧮 Variable Usefulness Triage

Sort every column into one of four buckets before handoff, so the next person doesn't have to re-derive the same judgment:

| Bucket | Meaning | Example from this dataset |
| --- | --- | --- |
| **Useful as-is** | Clean, interpretable, ready to use | `tenure_months` |
| **Useful after treatment** | Needed a fix, now ready | `revenue` (after log transform / outlier flag) |
| **Redundant** | Strongly duplicates another column's information | (none flagged here — correlation pass found no pairs above 0.8) |
| **Leakage risk** | Only knowable *after* the outcome you're trying to predict | A "cancellation reason" field, if predicting churn |

## 🧠 Separating Evidence from Interpretation

Keep the two visibly separate in any written summary — merging them is the single most common way an EDA write-up misleads its reader:

```text
EVIDENCE: Churn rate is 34.8% for Enterprise vs. ~28% for Consumer/SMB,
but the chi-square test for segment vs. churn is not significant
(p=0.554, n=500).
INTERPRETATION: The apparent gap is plausibly noise at this sample size;
don't act on it as a confirmed segment effect without more data.
```

## 📐 Documenting Scope

Every finding is only valid within the population, time window, and filters it was computed on — state them explicitly:

```text
SCOPE: 500 customers who signed up between 2023-01-01 and 2024-01-10.
Excludes customers who signed up before this window. All statistics
above are unweighted (no adjustment for the actual customer base's
segment mix, if it differs from this sample's 50/37/13 split).
```

## 🗣️ Stakeholder-Specific Summarization

The same EDA produces different write-ups depending on who's reading — the underlying evidence doesn't change, but the altitude and vocabulary do:

| Audience | Wants | Skip |
| --- | --- | --- |
| Executive / business stakeholder | The 2-3 sentence "so what," in dollars or customers, with a clear ask | Statistical test names, method details, code |
| Fellow analyst | Full evidence, caveats, and method — enough to disagree with your read | Business framing they already have |
| Engineer / modeler | Column-level treatment decisions, leakage risks, feature readiness | Narrative framing, business impact |

```text
EXECUTIVE VERSION:
Enterprise customers generate ~5x the revenue of Consumer customers,
but this comes from just 66 of our 500 sampled accounts. Before
building a strategy around this, we need a larger Enterprise sample
to confirm the pattern holds.

ANALYST VERSION:
Enterprise segment mean revenue $2,628.94 vs. Consumer $515.93
(grouped bivariate pass), n=66 vs. n=249. Variance also scales with
segment (std $3,003 vs. $393) — Welch's t-test, not Student's, would
be the appropriate follow-up test given the unequal variances. Flag:
small Enterprise n limits confidence in the point estimate.

ENGINEER VERSION:
revenue: log1p-transformed for modeling (raw skew 6.97 -> -0.60 after
transform), outlier flag column added (is_outlier, 8 rows, confirmed
real via billing system — do not drop). segment: one-hot, 3 levels,
no rare-level collapsing needed. No leakage risk identified in
current feature set.
```

Writing three versions of the same finding isn't three times the work — it's the same evidence and caveats, filtered to what each reader will actually act on.

## 📊 Prioritizing Follow-Ups: Impact vs. Effort

An EDA pass typically surfaces more open questions than anyone has time to chase immediately. A simple 2x2 sort keeps the handoff from turning into an undifferentiated wall of bullet points:

| | Low effort to resolve | High effort to resolve |
| --- | --- | --- |
| **High impact if resolved** | Do next — quick wins | Plan deliberately, get a named owner and a timeline |
| **Low impact if resolved** | Nice-to-have, batch with other small fixes | Deprioritize explicitly — say so, don't just omit it |

```text
Segment-vs-churn significance (needs 12+ more months of data): HIGH
impact / HIGH effort -> plan deliberately, revisit next quarter.

satisfaction_score's uneven response rate by segment: MEDIUM impact
/ LOW effort (one conversation with the survey team) -> do next.

Investigating the exact cause of the 5 orphaned order_id foreign
keys: LOW impact (5 of 1,200 rows) / LOW effort -> batch with other
small data-quality fixes, not urgent on its own.
```

The point isn't the specific quadrant labels — it's that every open item gets a deliberate placement instead of an implicit "we'll see," which is how genuinely important follow-ups quietly never happen.

## 🌉 The EDA-to-Modeling Bridge

When the next step is a model rather than a dashboard or a business decision, the handoff needs a few specific things a general write-up often omits:

- **Per-feature readiness**, not just per-feature findings: which columns are model-ready as-is, which need the transform already identified in the [Feature Distribution Cheatsheet](09_Feature_Distribution_Cheatsheet.md), and which need an encoding decision from the [Univariate Analysis Cheatsheet](04_Univariate_Analysis_Cheatsheet.md)'s high-cardinality guidance.
- **Explicit leakage review**: for every column, could it only be known *after* the outcome you're predicting? (A cancellation reason field is fine for churn analysis, disqualifying for churn *prediction*.)
- **The train/test split implication of anything found**: if there's a time trend (checked in the [Descriptive Statistics Cheatsheet](03_Descriptive_Statistics_Cheatsheet.md)'s drift section) or a segment imbalance, a random split may not be the right validation strategy — a time-based or stratified split might be needed instead.
- **Baseline expectations**: if bivariate/correlation analysis found no strong linear predictor of the target, say so explicitly — it sets the modeling team's expectations (a simple linear model likely won't perform well; tree-based or interaction-aware models may be needed) rather than letting them discover it after building one.

```text
MODELING HANDOFF NOTE:
Target: churned (binary, 29% positive rate).
No single numeric feature shows |Spearman rho| > 0.3 with revenue
(not the target, but flagged since a model might use it) — expect
that a simple linear baseline on the numeric features alone will
underperform; segment and region interactions may carry more signal
than raw magnitudes do.
No leakage risk identified in the current feature set.
Recommend a stratified split by segment, given the 66/185/249
imbalance across segments.
```

## ✅ Handoff Checklist

- [ ] Schema and data grain are documented (one row = ?).
- [ ] Every missing-value treatment is recorded, with the reasoning (MCAR/MAR/MNAR judgment) behind it.
- [ ] Every outlier treatment is recorded, with cause (error / rare-event / heavy-tail) and action taken.
- [ ] Distributions and key relationships have been reviewed, not just computed.
- [ ] Potential confounding and leakage have been considered for the variables likely to feed a model.
- [ ] Every open question has a named owner and a next action — not left as an unattributed observation.

## 📝 Worked Examples

**1. An EDA summary write-up (customer dataset)**

```text
## EDA Summary — Customer Dataset (500 rows, 2023-01-01 to 2024-01-10)

**Grain & quality:** One row per customer at signup. No duplicate rows.
region missing on 3% of rows (filled "Unknown"); satisfaction_score
missing on 8% (segment-median imputed, indicator retained — MNAR not
ruled out, flagged for follow-up with the survey team).

**Key pattern:** Revenue scales strongly with segment (Enterprise ~5x
Consumer), with proportionally larger variance in Enterprise. Tenure
and satisfaction show no meaningful linear or rank correlation with
revenue in this sample (Spearman |rho| < 0.1 throughout).

**Data quality flag:** 8 customers show revenue 6-12x their segment's
typical value; confirmed as real large contracts via the billing
system, kept and flagged rather than removed.

**Open risk:** Segment-vs-churn gap (34.8% Enterprise vs. ~28% others)
is not statistically significant at this sample size (p=0.554) — do
not treat as confirmed without more data.

**Next actions:**
- [Data team] Investigate why satisfaction_score response rate differs
  by segment.
- [Analytics] Revisit the segment-churn relationship once 12+ more
  months of data are available.
```

**2. A healthcare readmission EDA summary, written for a modeling handoff**

Same skeleton, different domain — note how the modeling-specific bridge content from the section above shows up explicitly rather than being left implicit:

```text
## EDA Summary — 30-Day Readmission Dataset (12,400 discharge records)

**Grain & quality:** One row per discharge (a patient with 2 admissions
in-window contributes 2 rows — confirmed intentional with the clinical
team, not a duplicate). length_of_stay missing on 1.2% of rows,
plausibly MCAR (no relationship found to any observed column via the
multivariate probe, pseudo-R^2 = 0.01) — median-imputed.

**Key pattern:** Readmission rate is 3.2x higher for discharges with
5+ prior admissions in the past year vs. 0-1 (evidence: grouped
proportions, chi-square p<0.001, n=12,400 — large enough sample that
this finding is on much firmer ground than the segment-churn example
above).

**Leakage risk flagged:** discharge_disposition_code partially encodes
whether a readmission was already anticipated by clinical staff at
discharge time — recommend the modeling team review this column
specifically before including it as a predictive feature.

**Data quality flag:** 340 records (2.7%) have a discharge date before
their recorded admission date — a data entry error, not a rare valid
event. Excluded from analysis pending a source-system fix, not
imputed, since there's no defensible way to correct a reversed date
pair.

**Next actions:**
- [Data engineering] Fix the discharge-before-admission date bug at
  the source; re-run this EDA once corrected.
- [Modeling team] Review discharge_disposition_code for leakage before
  using it as a feature; recommend a stratified split by facility
  given uneven volume across the 14 facilities in scope.
```

**3. A short executive-only version of the same readmission finding**

```text
Patients with 5+ hospital admissions in the past year are readmitted
at more than 3x the rate of patients with 0-1 prior admissions — a
strong, statistically solid pattern (12,400 records). Recommend
prioritizing a targeted follow-up-care program for this high-risk
group; full modeling work is in progress to identify who else may be
at elevated risk beyond this one factor.
```

Verdict: the executive version drops the statistical language entirely and leads with the action-relevant number — it's derived from the same evidence as the analyst-facing write-up above it, just filtered to what a decision-maker needs in three sentences.

## ⚠️ Gotchas

- **An observation without its evidence is a claim, not a finding** — anyone repeating it two steps removed from the analysis will treat it as settled fact regardless of how tentative it actually was.
- **"No significant relationship found" is not the same as "no relationship exists"** — it means the data at hand couldn't distinguish it from noise; say which, explicitly, especially with a small subgroup like the 66-row Enterprise segment here.
- **Treating every anomaly as "resolved" by writing it down is a false sense of closure** — an anomaly you can't yet explain should be flagged as an open risk, not silently folded into the summary as if it were understood.
- **Skipping the scope statement lets a finding get generalized past the population it was actually computed on** — a pattern found in 500 signups from a 13-month window is not automatically true of the full customer base or of future signups.
- **A handoff checklist with no owners attached to its open items functions as a list of things that will never get done** — every unresolved question needs a name next to it, not just a bullet point.
- **An executive summary that strips out caveats entirely can turn a tentative pattern into a false certainty** — trim the statistical vocabulary, not the honesty about sample size or significance; "a strong, statistically solid pattern" (worked example 3) still signals confidence level without requiring the reader to know what a chi-square test is.
- **An impact/effort prioritization is only as good as an honest effort estimate** — the temptation to mark inconvenient-but-important items as "high effort" to justify deprioritizing them defeats the entire point of the framework.
- **A modeling handoff that lists findings but not per-feature readiness leaves the modeling team re-deriving decisions the EDA already made** — "no strong linear predictor found" is a finding; "expect a linear baseline to underperform, consider tree-based models" is the same finding translated into something actionable for that specific audience.

## 🎯 Best Practices

1. **Write findings as evidence + interpretation + caveat, every time** — never let the conclusion stand alone without what it's based on and what could make it wrong.
2. **Distinguish "resolved" from "flagged for follow-up"** explicitly in every write-up — don't let an open risk read like a closed one.
3. **Triage every variable's usefulness before handoff** — useful, useful-after-treatment, redundant, or leakage-risk — so the next person doesn't redo the judgment call from scratch.
4. **State the scope of every finding** (population, time window, filters) in the same breath as the finding itself.
5. **Assign an owner to every open item** — an EDA summary with unowned open questions is a to-do list disguised as a report.
6. **Write the same finding at multiple altitudes when the audience spans stakeholders** — the underlying evidence stays fixed; only the vocabulary and level of detail should change per reader.
7. **Sort open follow-ups by impact and effort explicitly** — an undifferentiated list of "things to look into" reliably gets triaged by recency or loudness instead of actual importance.
8. **Translate findings into per-feature modeling guidance whenever the handoff feeds a model** — "readiness," "leakage risk," and "split strategy" are questions a modeling team needs answered, not questions they should have to re-derive from your prose.
