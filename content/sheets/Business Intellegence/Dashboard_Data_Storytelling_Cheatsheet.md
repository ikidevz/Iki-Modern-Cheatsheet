# Dashboard & Data Storytelling Principles Cheatsheet

> A structured reference for designing dashboards and communicating data effectively — chart selection, visual hierarchy, color and typography, decluttering, narrative structure, and the anti-patterns to avoid. Tool-agnostic: applies whether you're building in Tableau, Power BI, Looker, or a hand-rolled web dashboard.

## 📑 Table of Contents

1. [🧭 Purpose First: What Kind of Dashboard Is This?](#purpose-first-what-kind-of-dashboard-is-this)
2. [🗣️ Audience & Requirements Gathering](#audience-requirements-gathering)
3. [📊 Chart Selection Guide](#chart-selection-guide)
4. [🧱 Visual Hierarchy & Layout](#visual-hierarchy-layout)
5. [🎨 Color Theory for Dashboards](#color-theory-for-dashboards)
6. [🔤 Typography & Labeling](#typography-labeling)
7. [🧹 Decluttering: Data-Ink Ratio & Chartjunk](#decluttering-data-ink-ratio-chartjunk)
8. [👁️ Pre-Attentive Attributes](#pre-attentive-attributes)
9. [📝 Annotation & Providing Context](#annotation-providing-context)
10. [📖 Narrative Structure for Data Storytelling](#narrative-structure-for-data-storytelling)
11. [🚫 Common Dashboard Anti-Patterns](#common-dashboard-anti-patterns)
12. [♿ Accessibility](#accessibility)
13. [🔀 Dashboard Types Compared](#dashboard-types-compared)
14. [🖱️ Interactivity & Drill-Down Design](#interactivity-drill-down-design)
15. [⚡ Performance & Load-Time Considerations](#performance-load-time-considerations)
16. [✅ Pre-Ship Checklist](#pre-ship-checklist)
17. [⚠️ Common Gotchas](#common-gotchas)
18. [🎯 Best Practices](#best-practices)
19. [💡 Pro Tips](#pro-tips)
20. [🧠 Cognitive Biases & Data Perception](#cognitive-biases-data-perception)
21. [🗣️ Presenting to Different Stakeholder Levels](#presenting-to-different-stakeholder-levels)
22. [🔎 A Dashboard Critique Framework](#a-dashboard-critique-framework)
23. [🧩 Building a Design System for a Dashboard Suite](#building-a-design-system-for-a-dashboard-suite)
24. [📚 Worked Examples Across Business Scenarios](#worked-examples-across-business-scenarios-dashboard)

## ⚡ Quick Reference

**Chart selection at a glance**

| You want to show...                      | Reach for...                                     |
| -------------------------------------------- | ---------------------------------------------------- |
| Trend over time                              | Line chart                                            |
| Comparison across categories (few)           | Bar chart (horizontal if labels are long)             |
| Comparison across many categories            | Sorted horizontal bar / dot plot                      |
| Part-to-whole, one moment in time            | Stacked bar or 100% stacked bar (avoid pie beyond ~4 slices) |
| Part-to-whole over time                      | Stacked area chart (only if total matters as much as parts) |
| Distribution of a single variable            | Histogram / box plot                                  |
| Relationship between two numeric variables   | Scatter plot                                          |
| Relationship between three+ variables        | Bubble chart (size = 3rd variable), or small multiples |
| Geographic pattern                           | Choropleth or symbol map                              |
| A single key number                          | Big Number / KPI card, with a trend sparkline         |
| Flow / funnel between stages                 | Funnel chart or Sankey diagram                        |
| Deviation from a target/threshold            | Bullet chart or variance bar (diverging color)         |

**Dashboard purpose at a glance**

| Type          | Refresh cadence     | Primary use                                | Design bias                         |
| --------------- | --------------------- | --------------------------------------------- | -------------------------------------- |
| Operational      | Real-time / minutes    | Monitor & react right now (ops, support)       | High density, alert-style color use     |
| Analytical        | Hourly / daily          | Explore & investigate a question               | Interactivity, drill-down, filters      |
| Strategic          | Weekly / monthly          | Track KPIs against goals for decision-makers    | Simplicity, few metrics, clear trend      |

## 🧭 Purpose First: What Kind of Dashboard Is This?

Before choosing a single chart, answer: **who looks at this, how often, and what decision or action does it drive?** A dashboard without a clear decision it supports tends to accumulate charts nobody uses.

```text
Operational dashboard → "Is something wrong right now?" (e.g., server error rate, live queue depth)
Analytical dashboard   → "Why did this happen? Let me dig in." (e.g., a self-serve funnel explorer)
Strategic dashboard     → "Are we on track against our goals?" (e.g., monthly exec KPI review)
```

Mixing these three purposes into one dashboard is the single most common design failure — an exec-level strategic view cluttered with real-time operational noise serves neither audience well.

## 🗣️ Audience & Requirements Gathering

```text
Questions to ask before building anything:
  - Who is the primary viewer, and what decision do they make with this?
  - How often will they look at it, and in what context (a meeting, a phone check, an always-on wall display)?
  - What's the one metric that, if it changed, someone would actually act on?
  - What comparison matters — vs. last period, vs. target, vs. a peer segment?
  - What's the acceptable latency between something happening and it showing up here?

Avoid designing from "what data do we have" — design from "what question does this answer,"
then find the data. Dashboards built data-first tend to become an unfocused wall of every available metric.
```

## 📊 Chart Selection Guide

```text
Match the chart to the COMPARISON being made, not to what looks impressive:

Time series          → line chart (trend), or bar chart if there are few discrete periods to compare
Ranking               → sorted horizontal bar chart (easier to read long category labels than vertical)
Part-to-whole          → stacked bar/100% stacked bar; pie/donut only for 2-4 slices with a clear leader
Correlation             → scatter plot; add a trend line only if the relationship is genuinely linear
Distribution shape       → histogram (single variable) or box/violin plot (compare distributions across groups)
Outliers/anomalies         → highlight directly on a time series (annotation) rather than a separate chart
Geographic comparison       → choropleth for rates/normalized values, symbol/bubble map for raw counts
                              (choropleth on raw counts misleadingly favors large-area regions)
```

**Chart types to avoid or use sparingly:** 3D charts (distort perceived value), pie charts with more than ~5 slices, dual-axis line charts with unrelated scales (invites false correlation reading), radar/spider charts for more than 3-4 axes (hard to compare area visually).

## 🧱 Visual Hierarchy & Layout

```text
Reading patterns: Western-language readers scan in a Z-pattern (top-left → top-right → diagonal → bottom-right)
                  for open layouts, or an F-pattern for text-dense pages — place the most important
                  KPI/number top-left, supporting detail below and to the right.

Layout principles:
  - Biggest, boldest element = the thing that matters most (usually a single headline KPI)
  - Group related charts visually (proximity, shared background panel, consistent spacing)
  - Align chart edges to an invisible grid — misaligned panels read as "unfinished" even with good data
  - Leave whitespace — a dashboard with zero breathing room between panels is harder to scan, not more efficient
  - Put filters/controls in a consistent, expected location (top or left rail) across every dashboard in a suite
```

## 🎨 Color Theory for Dashboards

```text
Sequential palette   → ordered/continuous data, one hue ramping light→dark (e.g., low→high revenue)
Diverging palette      → data with a meaningful midpoint (e.g., profit/loss, above/below target) —
                        two hues diverging from a neutral center, NOT a rainbow
Categorical palette      → unordered categories (regions, product lines) — distinct hues, limit to ~8 before
                          colors become hard to visually distinguish and legends become a lookup chore
Highlight color            → reserve ONE accent color for "the thing I want you to notice" — if everything
                            is highlighted, nothing is

Consistency: the same category (e.g., "West" region) should be the same color on every chart across a
             dashboard/suite — remapping colors per chart forces the viewer to re-learn the legend each time.
Avoid: red/green as the only signal for good/bad (color-blind accessibility — pair with icons/shape/position too).
```

## 🔤 Typography & Labeling

```text
- Use a clear sans-serif for on-screen dashboards; reserve serif fonts for print-style reports
- Limit to 2 font weights/sizes for hierarchy (e.g., bold headline number, regular supporting label) —
  more than that and the hierarchy itself becomes noise
- Label axes and units explicitly ($ vs. %, thousands vs. millions) — never make the viewer guess scale
- Direct-label data points/bars where there's room, instead of forcing a legend lookup for every value
- Round numbers to the precision the decision actually needs — "$1.2M" reads faster than "$1,247,382.19"
  in an executive KPI card, even if the underlying data is exact
- Write chart titles as the TAKEAWAY, not the topic: "Revenue grew 12% QoQ" beats "Quarterly Revenue"
  when the dashboard's job is to communicate a finding, not just display data
```

## 🧹 Decluttering: Data-Ink Ratio & Chartjunk

Edward Tufte's data-ink ratio principle: maximize the proportion of a chart's ink that represents actual data, minimize everything else.

```text
Remove by default, add back only if it earns its place:
  - Heavy gridlines (use light gray, or none, instead of dark black gridlines)
  - 3D effects, drop shadows, gradient fills on bars (pure decoration, can also visually distort values)
  - Redundant legends when direct labels already identify each series
  - Borders/boxes around every single chart panel (whitespace alone often separates panels just as well)
  - Excessive decimal precision that adds visual noise without adding decision-relevant information
  - A legend for a single-series chart (nothing to distinguish — delete it)

"Chartjunk" (Tufte's term): any visual element that doesn't encode data and doesn't aid comprehension —
                             decorative icons, unnecessary color variation, ornamental backgrounds.
```

## 👁️ Pre-Attentive Attributes

Pre-attentive attributes are visual properties the brain registers in milliseconds, before conscious "reading" — leverage these instead of forcing the viewer to read every label.

```text
Pre-attentive: color (hue), size, position, orientation, shape, length, color intensity/saturation
NOT pre-attentive: text content itself — reading a number requires conscious processing, seeing "the
                    biggest bar" or "the red one" does not.

Practical use: color the one bar/segment that matters instead of writing "NOTE: this one is important"
               as a text label — the eye finds it instantly via pre-attentive color processing.
```

## 📝 Annotation & Providing Context

```text
Raw numbers without context invite misinterpretation. Add:
  - A comparison baseline: vs. last period, vs. target, vs. a benchmark/peer group
  - Reference lines: a target line, an average line, a goal threshold, directly on the chart
  - Event annotations: mark a known cause on a time series (e.g., "Marketing campaign launched" at the
    exact date a spike occurred) so viewers don't have to guess or ask in a meeting
  - Confidence/uncertainty indicators when a number is an estimate or based on a small sample —
    an unlabeled precise-looking number implies more certainty than may actually exist
  - Explicit "as of" timestamps — a number without a freshness indicator can be silently stale and
    trusted anyway
```

## 📖 Narrative Structure for Data Storytelling

```text
Situation → Complication → Resolution (a classic narrative arc, adapted for data):
  Situation:     establish the baseline/context ("Revenue has grown steadily for 6 quarters")
  Complication:   introduce the tension/finding ("...but churn in the SMB segment jumped 40% last month")
  Resolution:      what it means and/or what to do ("...concentrated in accounts onboarded via Partner X —
                    recommend pausing that channel pending a review")

Alternative structure — the "inverted pyramid" (journalism-style):
  Lead with the headline finding first, then supporting detail, then full methodology/caveats last —
  respects that most viewers stop reading after the first screen.

A data story answers three questions in order: What happened? So what (why does it matter)? Now what
(what should we do)? A dashboard that only answers "what happened" leaves the audience to do the
interpretive work themselves — often incorrectly, or not at all.
```

## 🚫 Common Dashboard Anti-Patterns

```text
- "Data dump" dashboards: every available metric crammed onto one screen with no hierarchy or focus
- Vanity metrics: prominently featuring numbers that always go up and drive no decision (e.g., total
  cumulative signups on an exec dashboard, when active/retained users is the metric that matters)
- Mismatched refresh expectations: a dashboard that looks real-time but only refreshes nightly, with
  no visible "last updated" timestamp to signal the lag
- Chart-type mismatch: a pie chart with 15 slices, a 3D bar chart, a dual-axis chart pairing unrelated
  scales to imply a correlation that isn't really there
- Inconsistent color mapping across a dashboard suite (region "West" is blue on one page, orange on another)
- No baseline/comparison: a number presented in isolation ("Revenue: $2.4M") with nothing to judge it against
- Filter/control sprawl: a dozen filters with no sensible default view, forcing every viewer to configure
  the dashboard themselves before it's useful
- Truncated or non-zero-baseline axes on bar charts, which visually exaggerates small differences
```

## ♿ Accessibility

```text
- Don't rely on color alone to convey meaning — pair with icons, patterns, direct labels, or position
- Maintain sufficient contrast ratio between text and background (aim for WCAG AA: 4.5:1 for normal text)
- Choose color-blind-safe palettes for categorical charts (avoid red/green as the only distinguishing pair)
- Provide alt text/data tables as an alternative to purely visual charts where the platform supports it
- Keep interactive elements (filters, tabs, tooltips) keyboard-navigable, not mouse-hover-only
- Test at the actual viewing size/device — a dashboard fine on a 27" monitor may be unreadable on a
  conference-room TV or a phone
```

## 🔀 Dashboard Types Compared

```text
Static report (PDF/emailed snapshot)  → fixed point-in-time, no interactivity, good for formal distribution
Interactive dashboard (BI tool)        → filters, drill-down, tooltips; good for self-serve exploration
Embedded dashboard (in a product)       → surfaces analytics inside an app's own UI for end users
Wallboard / TV display                  → auto-cycling, glanceable, zero interactivity, designed for a room,
                                          not a desk — needs larger fonts and far less density than a desktop view
```

## 🖱️ Interactivity & Drill-Down Design

```text
- Default to a sensible pre-filtered view (e.g., "This Quarter," "My Team") rather than an empty/all-time
  blank state that requires configuration before the dashboard shows anything useful
- Design drill-downs to go from summary → detail in a predictable direction (click a bar to see its
  breakdown), not require the viewer to already know where detail lives
- Keep the number of simultaneous filters low on a viewer-facing dashboard (3-5 is a reasonable ceiling) —
  more than that usually signals the dashboard is trying to serve too many distinct questions at once
- Surface the current filter state clearly and persistently (a filter "breadcrumb" bar) so a viewer
  returning to a saved link isn't confused about why the numbers look different from what they remember
```

## ⚡ Performance & Load-Time Considerations

```text
- Aggregate at the source (pre-computed rollup tables) rather than asking the dashboard to aggregate
  millions of raw rows on every load
- Limit the number of live queries fired per page load — each visual issuing its own uncached query to
  a live source compounds load time linearly with chart count
- Cache/extract for viewer-facing dashboards that don't need to-the-second freshness; reserve true live
  connections for genuinely operational, real-time use cases
- Paginate or pre-filter high-cardinality drill-down tables rather than rendering every row by default
```

## ✅ Pre-Ship Checklist

```text
□ Does every chart answer a question someone actually asked, or is it "just in case"?
□ Is there a clear headline number/takeaway visible without scrolling or clicking?
□ Does every number have a comparison point (vs. target, vs. prior period, vs. peer)?
□ Is the color mapping consistent with other dashboards this audience already uses?
□ Is there a visible "last updated" / data-freshness indicator?
□ Have you tested it at the actual device/screen size it will be viewed on?
□ Would someone unfamiliar with the underlying data understand what "good" looks like at a glance?
□ Have you removed every element that doesn't represent data or aid comprehension?
```

## ⚠️ Common Gotchas

- **A truncated (non-zero) y-axis on a bar chart visually exaggerates small differences** — appropriate on a line chart showing a narrow trend range, actively misleading on a bar chart where length itself implies magnitude.
- **Dual-axis charts with unrelated scales invite false-correlation reading** — two lines that happen to move together can look causally linked purely because of how the axes were scaled, regardless of the underlying data.
- **A dashboard with no visible refresh timestamp gets trusted as "live" even when it isn't** — viewers assume freshness unless told otherwise, so silent staleness causes real decision errors.
- **"More metrics" isn't more informative past a certain density** — cognitive load rises faster than insight once a dashboard exceeds roughly 5-9 things to track at a glance (a well-known short-term memory limit).
- **Averages hide the distribution** — a KPI card showing "average load time: 1.2s" can mask a bimodal reality (most users at 0.5s, a meaningful segment at 8s) that a histogram or percentile breakdown would reveal.
- **Rainbow/high-saturation categorical palettes beyond ~8 colors become indistinguishable** — viewers start relying on legend lookup for every data point instead of pattern-matching color directly, defeating the purpose of color-coding.
- **Pie charts with many slices or near-equal-sized slices are genuinely hard to compare by angle** — human perception is much better at comparing bar lengths than pie-slice areas/angles.

## 🎯 Best Practices

- Start every dashboard build from the decision it needs to support, not from the tables/fields available — work backward from the question to the data, not forward from the data to whatever charts fit it.
- Establish a shared color/style system across a dashboard suite so viewers build pattern recognition once and reuse it everywhere, rather than re-learning conventions per dashboard.
- Default every chart's comparison to something meaningful (prior period, target, benchmark) rather than shipping bare current-state numbers.
- Write chart and dashboard titles as findings, not topics, whenever the goal is communication rather than pure exploration.
- Review a finished dashboard by asking a person unfamiliar with the data to explain what it's telling them — confusion at that stage means the design, not the data, needs work.
- Separate operational, analytical, and strategic use cases into distinct dashboards rather than one dashboard trying to serve all three audiences.

## 💡 Pro Tips

1. **Small multiples (a grid of identical small charts, one per category) often beat a single cluttered combined chart** for comparing many series — the eye can pattern-match across a grid faster than it can decode 12 overlapping lines.
2. **Sort bar charts by value, not alphabetically**, unless alphabetical order itself is the point (e.g., a fixed list of named regions users expect in a stable position).
3. **A sparkline next to a KPI number gives trend context in almost no extra space** — often more useful than the number alone.
4. **Use a bullet chart instead of a gauge/speedometer for actual-vs-target** — gauges are visually appealing but notoriously hard to read precisely; bullet charts convey the same info in far less space, more accurately.
5. **Reserve red exclusively for "needs attention"** across an entire dashboard suite — if red is also used decoratively elsewhere, it stops functioning as an alert signal.
6. **Test dashboards on the actual device they'll be viewed on** (a TV in a hallway reads very differently than a laptop at a desk) before finalizing font sizes and density.
7. **Annotate known external events directly on time-series charts** (a launch, an outage, a pricing change) — it pre-empts the "why did this spike?" question in every review meeting.
8. **A dashboard's first version should almost always have fewer charts than the initial request list** — negotiate down to the vital few before building, then add back only what proves genuinely needed after real usage.
9. **Percent-change framing can mislead on small base numbers** ("200% increase" sounds dramatic when it's 1 → 3) — pair percentage change with the absolute numbers whenever the base is small.
10. **Build a "definitions" or "methodology" panel/page alongside any dashboard shared broadly** — it prevents the same "how is this metric calculated?" question from recurring in every review.

## 🧠 Cognitive Biases & Data Perception

```text
Anchoring: the first number a viewer sees disproportionately shapes how they judge everything after it
           — putting a large, unqualified total at the very top of a dashboard can anchor a viewer's
           sense of "good" or "bad" before they've seen the actual comparison that should inform that judgment.

Framing effects: the same data reads differently depending on how it's phrased — "95% success rate"
                 and "5% failure rate" describe identical data but provoke different reactions; choose
                 framing deliberately based on what the audience needs to focus on, and disclose the
                 choice rather than exploiting it.

Confirmation bias: viewers tend to notice and trust data that confirms what they already believed, and
                    scrutinize or dismiss data that contradicts it — a dashboard designer can (unintentionally
                    or not) reinforce this by choosing chart types, colors, or comparisons that flatter a
                    preferred narrative. Neutral framing and consistent baselines across time/segments guard
                    against this.

Recency bias: the most recent data point in a time series gets outsized weight in a viewer's takeaway,
              even when it's a single noisy outlier — pairing a raw time series with a rolling average
              or a clearly marked confidence band helps viewers calibrate how much weight to give the
              latest point.

Simpson's Paradox: an aggregated trend can reverse direction when the same data is broken into subgroups
                    (e.g., overall conversion rate rising while it's actually falling in every individual
                    segment, because segment mix shifted) — always sanity-check an aggregate metric's
                    story against its component breakdown before presenting it as a clean trend.
```

## 🗣️ Presenting to Different Stakeholder Levels

```text
Executives / leadership:
  - Lead with the decision or recommendation, not the methodology
  - One headline number + trend, minimal supporting detail visible by default
  - Comparisons framed in business terms (revenue, cost, risk) rather than statistical terms (p-values, R²)
  - Time budget: assume 30 seconds of attention before they either engage further or move on

Analysts / domain experts:
  - Show the full breakdown, segment-level detail, and methodology alongside the headline
  - Expect and invite questions about data lineage, definitions, and edge cases
  - Interactive drill-down matters more here than for an exec audience — they'll want to self-serve deeper

Operations / frontline teams:
  - Glanceable, real-time, action-oriented — "is something wrong right now that I need to respond to"
  - Minimal historical context needed; the current state and a clear threshold/alert matter most
  - Design for a shared, ambient display (a wallboard) as often as for a focused desk session

Mismatching the level of detail to the audience is one of the most common dashboard-design failures —
an ops-style dense real-time view shown to an executive audience overwhelms without informing, while
an exec-style single-KPI view handed to an analyst under-serves their actual investigative need.
```

## 🔎 A Dashboard Critique Framework

```text
A structured way to review a dashboard (yours or someone else's) before it ships:

1. Purpose test: can you state, in one sentence, the decision this dashboard supports? If not, that's
   the first thing to fix — everything else is downstream of answering this.
2. Five-second test: cover the dashboard, uncover it for five seconds, cover it again — what's the one
   thing you remember? It should match the dashboard's actual primary purpose.
3. Comparison test: pick any three numbers on the dashboard — does each have a clear point of comparison
   (a target, a prior period, a benchmark) or is it presented in isolation?
4. Chart-fit test: for each chart, ask "does this chart type match the comparison being made" (see the
   Chart Selection Guide) rather than "does this look impressive."
5. Noise audit: for each visual element, ask "does removing this lose any information a viewer needs?"
   If not, remove it (see Decluttering).
6. Color audit: is color used consistently, and does it map to meaning rather than decoration? Would it
   still work for a color-blind viewer?
7. Freshness check: is it obvious, without asking anyone, how current this data is?
8. Stranger test: would someone unfamiliar with the underlying data understand what "good" looks like,
   without a live explanation from the person who built it?
```

## 🧩 Building a Design System for a Dashboard Suite

```text
When an organization has more than a handful of dashboards, inconsistency between them becomes its own
source of confusion — a design system solves this the same way it does for product UI:

Color mapping: fix a single color-to-category mapping across every dashboard (e.g., "West region is
               always this specific blue") in a shared palette reference, not decided ad hoc per dashboard.
Typography scale: standard font sizes for headline KPI / section header / body label / footnote across
                   every dashboard, so visual hierarchy reads the same way everywhere.
Component library: reusable KPI card, filter bar, and chart-title patterns (in whichever BI tool is in
                    use — a Tableau/Power BI/Looker "starter template" workbook) so every new dashboard
                    starts from the same visual baseline instead of reinventing layout decisions.
Naming conventions: consistent metric names and definitions across every dashboard — "Active Users"
                     should mean the same underlying calculation everywhere it appears, with a single
                     documented source of truth (a metrics glossary/semantic layer) rather than each
                     dashboard author defining it independently.
Governance: a lightweight review step (even just a peer-review checklist) before a new dashboard is
            published broadly, checking it against the design system and the critique framework above.
```

## 📚 Worked Examples Across Business Scenarios {#worked-examples-across-business-scenarios-dashboard}

### 1. Redesigning a Cluttered Executive Dashboard

**Scenario:** An exec dashboard has grown organically over two years to 22 charts on one page, with no clear hierarchy, and leadership says "we don't actually look at this anymore."

```text
Before: 22 charts, uniform size, no color consistency, no headline number, alphabetically-ordered
        regions, a legend-dependent 12-color categorical chart, three different chart types showing
        overlapping information (a KPI table AND a bar chart AND a line chart all showing revenue).

Audit using the critique framework:
  - Purpose test fails: no single sentence describes what decision this serves — it's several
    dashboards' worth of content stacked into one page.
  - Five-second test: viewers report remembering "it's busy," not any specific finding.

Redesign:
  1. Split into three focused views by decision type: a Strategic KPI summary (this page), a Regional
     Deep-Dive (drill-down page), and a Monthly Ops Detail (separate, ops-audience dashboard).
  2. Strategic page keeps exactly 4 KPI cards (Revenue, Active Customers, Churn %, Cash Position),
     each with a sparkline and a vs.-target/vs.-prior-period comparison — nothing else above the fold.
  3. Sort the one remaining regional bar chart by value, not alphabetically; recolor to the org's
     standard region-color mapping instead of a default 12-color palette.
  4. Move the granular monthly detail tables to the Ops Detail dashboard, linked via a "See detail" action.
  Result: the exec page drops from 22 charts to 5, each answering a specific, previously-implicit question.
```

### 2. Choosing the Right Chart for a Churn Analysis

**Scenario:** A team has a churn rate that "looks flat" on their current dashboard but leadership suspects something's wrong underneath.

```text
Current chart: a single line showing overall monthly churn rate — flat around 4% for six months.

Applying Simpson's Paradox check: break the aggregate down by customer segment (SMB vs. Enterprise vs.
Mid-Market). The breakdown reveals SMB churn rising from 6% to 11% while Enterprise churn fell from
2% to 0.5% over the same period — the aggregate stayed flat only because segment mix shifted toward
more Enterprise customers, masking a real and worsening SMB problem.

Redesign: replace the single aggregate line with a small-multiples view (one small line chart per
segment, same y-axis scale) so no single aggregate number can hide a subgroup reversal like this again.
```

### 3. Turning a Dashboard Finding into a Narrative Slide

**Scenario:** An analyst found a meaningful insight in a self-serve dashboard and needs to present it in a leadership meeting, where a live filterable dashboard isn't the right format.

```text
Situation: "Q3 revenue grew 8% overall, in line with plan."
Complication: "But that growth was entirely driven by one channel (Partner X), which now represents
               60% of new revenue — up from 30% a year ago."
Resolution: "This concentration is a risk if Partner X's terms change; recommend a Q4 initiative to
             diversify acquisition channels, with a target of reducing Partner X's share to 45%."

Slide structure: one slide per beat (Situation / Complication / Resolution), each with exactly one
chart supporting that beat's claim — the small-multiples channel-mix-over-time chart goes on the
Complication slide, not buried in an appendix; the appendix holds the full dashboard export for anyone
who wants to dig into methodology after the meeting, not during it.
```

### 4. Handling Small-Sample-Size Data Responsibly

**Scenario:** A newly-launched product feature has only 40 users so far, and a dashboard is being built to track its early performance.

```text
Risk: with n=40, a "conversion rate" metric can swing from 20% to 35% based on 6 users' behavior —
presenting it with the same visual confidence as a metric based on 40,000 users would mislead viewers
into over-reacting to noise.

Design response:
  1. Add an explicit sample-size annotation directly on the chart ("n=40 users — early data, interpret
     with caution") rather than relying on a viewer to notice or ask.
  2. Use a wider, visibly uncertain confidence band on any trend line, or avoid a trend line entirely
     in favor of a simple point-in-time number until the sample is large enough for a trend to be meaningful.
  3. Avoid a precise-looking decimal ("23.7% conversion") that implies more certainty than 40 users can
     support — round to a level of precision honest about the underlying sample.
  4. Set a visible threshold in the dashboard for when it will graduate to standard trend reporting
     (e.g., "full trend view unlocks at n=500") so stakeholders know this is a temporary, caveated view.
```

### 5. Designing a Wallboard for a Support Operations Team

**Scenario:** A customer support team wants a TV display in their workspace showing real-time queue health.

```text
Design differences from a desktop analytical dashboard:
  - Font sizes 3-4x larger than a desktop dashboard — readable from 15+ feet away, not 18 inches
  - Auto-cycling between 2-3 screens (Queue Depth → Agent Status → SLA Breach Risk) every 15-20 seconds,
    since there's no one sitting at it to click through views
  - Color used almost entirely for alert status (green/yellow/red thresholds on queue depth and SLA
    risk) rather than for categorical distinction — at a glance, not for detailed reading
  - Zero interactivity, zero filters — a wallboard is watched, not operated
  - Refresh interval matched to how fast the underlying reality actually changes (e.g., every 30 seconds
    for a live queue) rather than inheriting a daily-batch refresh cadence from an unrelated analytical dashboard
```

### 6. Running a Stakeholder Interview Before Building Anything

**Scenario:** A VP asks for "a dashboard on customer health" with no further detail — a classic underspecified request that, built literally, becomes an unfocused data dump.

```text
Structured interview questions actually asked:
  Q: "When you say customer health, what would make you personally check this dashboard on a Monday morning?"
  A: "Whether any of our top 20 accounts show signs of reducing usage before their renewal comes up."

  Q: "What would you actually DO if you saw a warning sign here?"
  A: "Have our customer success manager reach out proactively."

  Q: "How would you compare 'reducing usage' — vs. last month, vs. their own historical baseline, or
      vs. other similar accounts?"
  A: "Vs. their own baseline — different accounts have very different normal usage levels."

Result: the request "a dashboard on customer health" becomes a specific, buildable spec — a Top-20-accounts
watchlist, each account's current usage vs. its own trailing-90-day baseline, sorted by degree of decline,
refreshed daily, with a one-click "flag for CSM outreach" action — instead of a generic multi-metric
customer-health dashboard nobody asked for and few would actually use.
```
