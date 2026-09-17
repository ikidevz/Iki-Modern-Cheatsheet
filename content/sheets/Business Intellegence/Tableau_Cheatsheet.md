# Tableau Cheatsheet for Data & Analytics

> A structured Tableau reference — connecting to data, dimensions vs. measures, calculated fields, LOD expressions, table calculations, parameters, chart building, and publishing.

## 📑 Table of Contents

1. [🧠 Core Concepts: Dimensions, Measures & the Data Pane](#core-concepts-dimensions-measures-data-pane)
2. [🔌 Connecting to Data](#connecting-to-data)
3. [🧮 Calculated Fields: Syntax Basics](#calculated-fields-syntax-basics)
4. [🎯 Level of Detail (LOD) Expressions](#level-of-detail-lod-expressions)
5. [📊 Table Calculations](#table-calculations)
6. [🎛️ Parameters](#parameters)
7. [🧩 Sets & Groups](#sets-groups)
8. [🚰 Filters & Order of Operations](#filters-order-of-operations)
9. [📈 Chart Types & the Marks Card](#chart-types-marks-card)
10. [🖼️ Dashboards, Actions & Interactivity](#dashboards-actions-interactivity)
11. [📖 Stories](#stories)
12. [🧹 Tableau Prep Basics](#tableau-prep-basics)
13. [🔗 Joins, Relationships & Blending](#joins-relationships-blending)
14. [📅 Date & Time Handling](#date-time-handling)
15. [⚡ Performance Optimization](#performance-optimization)
16. [🔐 Publishing, Permissions & Governance](#publishing-permissions-governance)
17. [🧰 Tableau Desktop Shortcuts](#tableau-desktop-shortcuts)
18. [⚠️ Common Gotchas](#common-gotchas)
19. [🎯 Best Practices](#best-practices)
20. [💡 Pro Tips](#pro-tips)
21. [🔤 Advanced String & Regex Calculations](#advanced-string-regex-calculations)
22. [📉 Statistical & Forecasting Features](#statistical-forecasting-features)
23. [🗺️ Mapping & Spatial Analysis](#mapping-spatial-analysis)
24. [🖥️ Server/Cloud Administration](#server-cloud-administration)
25. [🐍 Integrating R & Python (TabPy)](#integrating-r-python-tabpy)
26. [📚 Worked Examples Across Business Scenarios](#worked-examples-across-business-scenarios-tableau)

## ⚡ Quick Reference

**Core workflow cheatsheet**

| Task                          | How                                                                    |
| -------------------------------- | ------------------------------------------------------------------------- |
| New calculated field            | Right-click in Data pane → Create → Calculated Field                       |
| Aggregate LOD (fixed)            | `{ FIXED [Customer] : SUM([Sales]) }`                                     |
| Running total                    | `RUNNING_SUM(SUM([Sales]))` (table calc)                                   |
| Rank within partition            | `RANK(SUM([Sales]))` or `INDEX()` for row number                          |
| Year-over-year                   | `(ZN(SUM([Sales])) - LOOKUP(ZN(SUM([Sales])), -1)) / ABS(LOOKUP(ZN(SUM([Sales])), -1))` |
| Parameter reference in calc      | `[Parameter Name]`                                                        |
| Change aggregation of a field    | Right-click pill → Measure (Sum/Avg/...) or drag to Marks/Rows/Columns    |
| Dashboard action (filter)        | Dashboard → Actions → Add Action → Filter                                 |
| Publish to server                | Server → Publish Workbook                                                 |
| Extract vs. Live connection      | Data source → bottom-left toggle "Extract" / "Live"                       |

**Pill color = data role**

| Color   | Meaning                                    |
| --------- | --------------------------------------------- |
| Blue    | Discrete field (categorical, blue pill)       |
| Green   | Continuous field (numeric axis, green pill)   |
| Blue #, Green # | The same field can be either — right-click → Convert to Discrete/Continuous |

## 🧠 Core Concepts: Dimensions, Measures & the Data Pane

```text
Dimension  → qualitative/categorical field (Region, Product, Date as discrete) — controls granularity, usually blue
Measure    → quantitative field (Sales, Profit) — gets aggregated (SUM, AVG, ...), usually green
Discrete   → creates headers/distinct axis labels (blue pill)
Continuous → creates a continuous axis (green pill)
```

Dragging a field to Rows/Columns/Marks doesn't just place it — it changes the **level of detail** of the view. Every dimension on the view (Rows, Columns, Marks Color/Detail/Label) partitions the data further; this is the single most important mental model in Tableau.

## 🔌 Connecting to Data

```text
Data → Connect to Data → choose a connector:
  File-based:   Excel, CSV, Text, JSON, PDF, Spatial file, Statistical file (SAS/SPSS/R)
  Server-based: Snowflake, BigQuery, Redshift, SQL Server, PostgreSQL, MySQL, Databricks, ...
  Web/other:    Google Sheets, Salesforce, Google Analytics, OData, Web Data Connector

Live connection   → every interaction queries the source directly (always current, but source-load-bound)
Extract (.hyper)  → Tableau's own columnar engine pulls a snapshot into a local/server-hosted file
                    (fast, works offline, needs manual/scheduled refresh)
```

```text
Data source page: drag tables in, define joins/relationships,
                   set up custom SQL if needed (bottom option), preview & set field types
```

## 🧮 Calculated Fields: Syntax Basics

```
// Basic arithmetic & string
[Profit] / [Sales]
[First Name] + " " + [Last Name]

// IF / CASE logic
IF [Sales] > 1000 THEN "High" ELSEIF [Sales] > 500 THEN "Medium" ELSE "Low" END
CASE [Region] WHEN "West" THEN 1 WHEN "East" THEN 2 ELSE 0 END

// Aggregation inside a calc
SUM([Sales]) - SUM([Cost])
{ SUM([Sales]) }                       // whole-table aggregate, ignores view filters (fixed LOD shorthand)

// Type conversion
INT([Order ID])
STR([Order Date])
DATE([Order Date String])

// Null handling
IFNULL([Sales], 0)
ZN([Sales])                            // shorthand for "zero if null" on numeric fields
ISNULL([Discount])

// String functions
LEFT([Name], 3)  RIGHT([Name], 4)  MID([Name], 2, 5)
CONTAINS([Name], "Corp")
REGEXP_EXTRACT([Email], '(.+)@')
REGEXP_REPLACE([Phone], '[^0-9]', '')
TRIM([Name])  UPPER([Name])  LOWER([Name])
```

## 🎯 Level of Detail (LOD) Expressions

LOD expressions compute an aggregation at a **different granularity** than the view — the single most powerful (and most confused-about) Tableau feature.

```
// FIXED — ignores the view's dimensions entirely, computes at exactly the specified level
{ FIXED [Customer ID] : SUM([Sales]) }              // total sales per customer, regardless of what's on the view

// INCLUDE — adds a dimension to the view's granularity (finer than the view)
{ INCLUDE [Product] : SUM([Sales]) }                // useful inside a view aggregated above product level

// EXCLUDE — removes a dimension from the view's granularity (coarser than the view)
{ EXCLUDE [Sub-Category] : SUM([Sales]) }            // "total for the parent category" while still showing sub-category rows

// Common pattern: customer segmentation by lifetime value
{ FIXED [Customer ID] : SUM([Sales]) } > 10000       // then bucket TRUE/FALSE as a dimension

// Nested LOD: average order size per customer, then average that across customers
AVG({ FIXED [Customer ID] : SUM([Sales]) })
```

**Evaluation order matters:** `FIXED` LODs compute *before* dimension filters (unless "Context Filter" is used), `INCLUDE`/`EXCLUDE` compute relative to the view's current dimensions — see the [Filters & Order of Operations](#filters-order-of-operations) section.

## 📊 Table Calculations

Table calculations run **after** the query returns (post-aggregation), operating on what's already on the view — direction (addressing/partitioning) matters.

```
RUNNING_SUM(SUM([Sales]))                    // cumulative total along the table's addressing direction
RUNNING_AVG(SUM([Sales]))
WINDOW_SUM(SUM([Sales]))                     // total across the whole partition (not cumulative)
RANK(SUM([Sales]))                           // 1 = highest by default
RANK_UNIQUE(SUM([Sales]))                    // no ties (1,2,3... even with equal values)
INDEX()                                      // row number within the partition
FIRST()  LAST()                              // offset from first/last row in partition
LOOKUP(SUM([Sales]), -1)                     // value from the previous row (for period-over-period)
(ZN(SUM([Sales])) - LOOKUP(ZN(SUM([Sales])), -1)) / ABS(LOOKUP(ZN(SUM([Sales])), -1))   // % change vs. prior period
PERCENTILE(SUM([Sales]), 0.9)
TOTAL(SUM([Sales]))                          // grand total, ignores partitioning (like a FIXED LOD for the whole pane)
```

Right-click any table calc pill → **Edit Table Calculation** to set **Compute Using** (addressing: which dimension the calc "moves across") and the **Specific Dimensions**/partitioning — getting this wrong is the #1 source of "my running total resets in the wrong place" bugs.

## 🎛️ Parameters

```text
Data pane → Create Parameter → set data type, allowable values (list/range/all), default value
Use in a calculated field:     IF [Metric Picker] = "Profit" THEN SUM([Profit]) ELSE SUM([Sales]) END
Show a parameter control:      right-click parameter → Show Parameter Control (adds a UI widget to the view)
Drive a reference line:        set the reference line's value to a parameter for a user-adjustable threshold
Dynamic parameters (recent):   parameter values auto-populate from a field instead of a static list
```

Parameters are single global values shared across the whole workbook (not per-sheet like filters) — changing one updates every sheet that references it.

## 🧩 Sets & Groups

```text
Group  → merges specific dimension members into named buckets (e.g., "West Coast" = CA+OR+WA); static membership
Set    → a boolean "in/out" bucket of members, can be static (manually chosen) or dynamic (Top N, condition-based)

Combined Set: right-click two sets → Create Combined Set → union/intersection/"in one but not other"
"In/Out of Set" as a dimension: drag a set to Color/Filter to visualize membership directly
```

```
// Set-driven calc: flag customers in a dynamic Top 10 by Sales set
IF [Top 10 Customers] THEN "Top 10" ELSE "Other" END
```

## 🚰 Filters & Order of Operations

Tableau's filter pipeline runs in a fixed order — understanding it explains almost every "why doesn't my number match" LOD/filter conflict:

```text
1. Extract Filters
2. Data Source Filters
3. Context Filters          ← everything below is computed relative to this filtered set
4. FIXED LOD Expressions    ← FIXED ignores dimension filters, but NOT context filters
5. Dimension Filters
6. INCLUDE/EXCLUDE LOD Expressions
7. Measure Filters
8. Table Calculation Filters
```

```text
To make a normal dimension filter affect a FIXED LOD calculation, promote that filter to a
Context Filter (right-click the filter pill → Add to Context) — this reorders it above FIXED LODs.
```

## 📈 Chart Types & the Marks Card

```text
Marks Card channels: Color, Size, Label, Detail, Tooltip, Shape, Path, Angle (varies by mark type)
Mark types: Automatic, Bar, Line, Area, Square, Circle, Shape, Text, Map, Pie, Gantt, Polygon, Density (heatmap)

Show Me panel: quick-build common chart types from selected fields — good starting point, not a ceiling
```

```text
Common patterns:
  Bar chart         → 1 dimension (Rows or Columns) + 1 measure
  Line chart         → date dimension (continuous, green) on Columns + measure on Rows
  Dual-axis combo    → drag a second measure to the opposite axis, right-click → Dual Axis, then Synchronize Axis
  Heatmap            → two dimensions on Rows/Columns, a measure on Color, Square mark type
  Highlight table    → same as heatmap but with Text mark type + Color
  Bullet graph       → built via Show Me once you have an actual + target measure pair
  Bar-in-bar         → two measures on the same axis with different colors, offset via a dual-axis trick
  Small multiples    → a dimension on Rows or Columns beyond the main chart's dimensions ("trellis")
  Map                → geographic role assigned to a field (auto-detected for Country/State/City/Zip)
```

## 🖼️ Dashboards, Actions & Interactivity

```text
Dashboard → drag sheets onto the canvas, arrange in Tiled or Floating containers
Dashboard → Actions:
  Filter action    → clicking a mark in Sheet A filters Sheet B
  Highlight action → clicking/hovering highlights related marks without filtering
  URL action       → click sends the user to a URL (can embed field values in the URL)
  Parameter action → clicking a mark sets a parameter's value (drives what-if / dynamic titles)
  Set action        → clicking a mark adds/removes that member from a Set (used for "click to drill" patterns)

Dashboard sizing: Fixed size (specific pixel dimensions) vs. Automatic (responsive, more layout risk)
Device Designer: build separate phone/tablet/desktop layouts from the same dashboard
```

## 📖 Stories

```text
Story → a sequence of dashboard/sheet "story points," each with a caption, for a guided narrative walkthrough.
Used for presenting a sequence of findings rather than a single always-on operational dashboard.
```

## 🧹 Tableau Prep Basics

```text
Tableau Prep Builder: a visual ETL tool (separate app), flow = a chain of steps
Steps: Clean (rename/split/filter/group-and-replace), Union, Join, Aggregate, Pivot, Script (Python/R via TabPy/Rserve)
Output: publish to Tableau Server/Cloud as a flow (schedulable) or write to a .hyper extract / database
```

```text
Prep's "Clean" step shows a live data-quality histogram per column (null %, distinct values,
data type mismatches) as you build — the fastest way to spot dirty data before it hits a workbook.
```

## 🔗 Joins, Relationships & Blending

```text
Join        → traditional SQL-style join at the data-source level (INNER/LEFT/RIGHT/FULL), fixes granularity upfront
Relationship → newer default (logical layer): tables stay at their native granularity, Tableau auto-adjusts
               the join type per query based on which fields are actually used on the sheet — avoids fan-out/
               duplication bugs that plain joins can cause with one-to-many data
Blending    → combines two separate DATA SOURCES (not tables in one source) using a linking field;
              secondary source is aggregated to the primary's granularity before combining — more limited
              than a join/relationship (no row-level detail from the secondary source)
```

## 📅 Date & Time Handling

```
DATEPART('quarter', [Order Date])
DATETRUNC('month', [Order Date])
DATEDIFF('day', [Order Date], [Ship Date])
DATEADD('month', 3, [Order Date])
MAKEDATE(2026, 9, 15)
```

```text
Discrete date pill (blue)    → creates date headers (e.g., "Sep 2026" as a label), good for categorical grouping
Continuous date pill (green) → creates a true continuous timeline axis, good for trend lines
Right-click a date field → choose a level of granularity (Year/Quarter/Month/Week/Day) or Custom for fiscal years
```

## ⚡ Performance Optimization

```text
- Extract instead of Live for anything with heavy or repeated filtering (extracts are columnar & pre-aggregated)
- Hide unused fields in the data source (Data → Hide All Unused Fields) — fewer columns = smaller extract, faster queries
- Filter early: use Data Source Filters/Context Filters to shrink the working set before LODs & viz filters run
- Avoid excessive quick table calcs and nested LODs stacked on huge extracts — they can't be pushed down to the DB
- Use the Performance Recording dashboard (Help → Settings and Performance → Start Performance Recording) to
  find the actual slow query/render step instead of guessing
- Aggregate measures rather than showing row-level detail marks whenever the use case allows it
- Materialize calculated fields into the extract instead of leaving them as always-recomputed live formulas
  where they're used often across many sheets
```

## 🔐 Publishing, Permissions & Governance

```text
Tableau Server / Tableau Cloud: workbooks live in Projects, permission rules set at Project/Workbook/View level
Permission templates: Viewer, Explorer (can interact/edit web-authoring, not Desktop), Creator (full Desktop rights)
Row-Level Security (RLS): a User Filter or an entitlement table joined on the logged-in username/USERNAME() function,
                           so the same published workbook shows each viewer only their own rows
Subscriptions: scheduled email snapshots of a view; Alerts: trigger an email when a measure crosses a threshold
Certified data sources: a governance flag marking a published data source as the trusted/blessed version
```

## 🧰 Tableau Desktop Shortcuts

| Action                     | Shortcut          |
| --------------------------- | ------------------- |
| Show Me panel               | `Ctrl+1`            |
| Swap Rows/Columns           | `Ctrl+W`            |
| New calculated field        | `Ctrl+Shift+C` (from Analysis menu, or right-click in Data pane) |
| New worksheet                | `Ctrl+M`            |
| Duplicate sheet              | Right-click tab → Duplicate |
| Undo / Redo                  | `Ctrl+Z` / `Ctrl+Y` |
| Present mode                 | `F7`                |
| Refresh data source           | `F5`                |

## ⚠️ Common Gotchas

- **`FIXED` LODs are computed before dimension filters, but after context filters** — a dimension filter that doesn't visibly change a `{ FIXED ... }` result usually means it needs to be promoted to a Context Filter.
- **Table calculations depend entirely on what's on the view** — remove a dimension from Rows/Columns and a `RUNNING_SUM`/`RANK` can silently recompute over a different partition, changing the numbers without any error.
- **Blending aggregates the secondary data source before combining it** — you lose row-level detail from that source, which is a common source of "the blended total doesn't match a straight join" confusion.
- **Discrete vs. continuous date pills produce structurally different views**, not just different formatting — switching one to the other can rearrange the whole chart.
- **`{ SUM([Sales]) }` (an LOD with no dimensions specified) computes over the entire data source**, ignoring viz-level filters — easy to mistake for "total for what I'm currently looking at."
- **A join can silently duplicate rows (fan-out)** on a one-to-many relationship where a Relationship (Tableau's newer logical layer) would have avoided it by adjusting granularity per query.
- **Extracts don't auto-refresh** — a published dashboard on an extract can look "stuck" until its scheduled refresh runs or someone refreshes manually.

## 🎯 Best Practices

- Build governed, certified data sources centrally rather than letting every author reconnect to raw tables and redefine the same calculated fields.
- Name calculated fields descriptively and document non-obvious LOD/table-calc logic in the calculation's comments (`// like this`).
- Default to Relationships over hard joins at the data-source level unless you specifically need row-level detail from a joined table.
- Design dashboards for the target device (Device Designer) rather than relying on one Automatic-size layout to work everywhere.
- Keep row-level security logic in a dedicated entitlement table joined cleanly, not scattered across ad hoc `IF USERNAME() = ...` calculated fields.
- Use extracts for anything published broadly — it isolates dashboard performance from source-system load.

## 💡 Pro Tips

1. **`ZN()` inside a table calc prevents null-related gaps from breaking `RUNNING_SUM`/`LOOKUP`** chains — cheap insurance.
2. **Ctrl-drag a pill** to duplicate it instead of dragging a fresh copy from the Data pane — keeps formatting.
3. **Double-click a blank area of Rows/Columns** to type a calculated field inline without leaving the shelf.
4. **Right-click → Describe** on any calculated field shows its full dependency formula — faster than hunting the Data pane.
5. **Set actions replace the older "highlight + filter" workaround pattern** for interactive drill-downs — use them for click-to-select behavior.
6. **`INDEX()` combined with a parameter makes a dynamic Top-N filter** that updates without editing the calc.
7. **Performance Recording** (Help menu) pinpoints the exact slow step (query vs. layout vs. render) instead of guessing at "the dashboard feels slow."
8. **Dashboard extensions** (Objects → Extension) can embed write-back forms, custom visuals, or external app panels directly inside a dashboard.
9. **Duplicate a data source as a live connection for development, and swap to extract only at publish time** — faster iteration during build, production performance at ship time.
10. **Use `WINDOW_AVG` as a reference-line-like band** inside the same viz to show "this category vs. the overall average" without a separate calc.

## 🔤 Advanced String & Regex Calculations

```
// Parsing structured text fields
SPLIT([Full Path], "/", -1)                        // last path segment (negative index counts from the end)
REGEXP_EXTRACT([Log Line], 'status=(\d{3})')        // pull the HTTP status code out of a raw log string
REGEXP_EXTRACT_NTH([Email], '(.+)@(.+)', 2)         // 2nd capture group — the domain part of an email
REGEXP_MATCH([SKU], '^[A-Z]{2}-\d{4}$')             // boolean: does the SKU match an expected pattern

// Fuzzy/approximate matching patterns
IF CONTAINS(LOWER([Company Name]), "corp") THEN "Corporate"
ELSEIF CONTAINS(LOWER([Company Name]), "llc") THEN "LLC"
ELSE "Other" END

// Dynamic string building for tooltips/labels
"Revenue: " + STR(ROUND(SUM([Sales]),0)) + " (" + STR(ROUND([% of Total]*100,1)) + "%)"
```

## 📉 Statistical & Forecasting Features

```text
Analytics pane (drag onto a view): Trend Line, Reference Line/Band, Forecast, Cluster, Average Line,
                                    Distribution Band, Box Plot

Trend Line: right-click → Edit Trend Lines to choose model type (Linear, Logarithmic, Exponential,
            Polynomial, Power) and see R², p-value directly in the tooltip.

Forecast (Analysis → Forecast → Show Forecast): built-in exponential smoothing forecast extending a
          time series forward, with a shaded confidence interval band — no formula required, but only
          appropriate for series with enough historical periods and reasonably regular seasonality.

Cluster (drag "Cluster" from Analytics pane onto Color): k-means clustering directly on the view's
         measures, auto-selects a cluster count (adjustable) — useful for quick customer/product segmentation
         without leaving the visual analysis flow.

Statistical summary card: right-click a continuous axis → Describe, or hover totals for quick
                           mean/median/std dev/quartile readouts without building a separate calc.
```

```
// Manual statistical calcs when you need more control than the Analytics pane offers
WINDOW_STDEV(SUM([Sales]))
WINDOW_MEDIAN(SUM([Sales]))
(SUM([Sales]) - WINDOW_AVG(SUM([Sales]))) / WINDOW_STDEV(SUM([Sales]))   // z-score within the current partition
```

## 🗺️ Mapping & Spatial Analysis

```text
Geographic roles: assign automatically detected fields (Country, State, City, Zip/Postal Code, Airport) via
                   right-click → Geographic Role, or map custom location names manually (Map → Edit Locations)
Custom geocoding: for non-standard regions (sales territories, store catchment areas), import a custom
                   geocoding file or join against a spatial file (Shapefile, GeoJSON, KML)
Spatial join: MAKEPOINT()/MAKELINE() calculated fields, or a spatial file join based on geographic
              intersection (e.g., "which sales territory polygon does this store's lat/long fall inside")
Spatial calculations:
  DISTANCE([Store Location], [Customer Location], "mi")     // great-circle distance between two points
  BUFFER([Store Location], 5, "mi")                          // a 5-mile radius polygon around a point
Density map: change Mark type to Density for a heatmap of point concentration instead of individual marks
             — much more legible than thousands of overlapping circle marks at a national scale.
```

## 🖥️ Server/Cloud Administration

```text
Site structure: Server → Sites → Projects (nested folders) → Workbooks/Data Sources, each with its own
                permission rules (can cascade from Project down, or be overridden per-item)

Content migration: Tableau Content Migration Tool for moving/promoting content between Dev → Test → Prod
                    sites in a governed release process, instead of manual re-publishing

Alerts: set on a reference line/measure threshold directly from a published view — subscribers get an
        email the next time the underlying data crosses that threshold on refresh

Data-driven alerts vs. Subscriptions: Subscriptions send a scheduled snapshot regardless of the data;
                                       Alerts only fire when a specific condition is met — pick based on
                                       whether the audience needs "every week" vs. "only when something changes"

Extract refresh scheduling: Server → Schedules — chain multiple workbooks/data sources to a shared refresh
                             schedule instead of each author independently setting their own cadence
```

## 🐍 Integrating R & Python (TabPy)

```text
TabPy (Tableau Python Server) / Rserve: external analytics servers Tableau can call from a calculated
                                          field, passing the view's current data and returning a result
                                          back into the visualization — used for models/logic beyond DAX-
                                          style native calculations (e.g., a trained scikit-learn model's
                                          prediction, a custom statistical test).
```

```
// A calculated field calling out to a TabPy-hosted Python function
SCRIPT_REAL(
  "return tabpy.query('churn_model', _arg1, _arg2)['response']",
  SUM([Recency]), SUM([Frequency])
)
```

## 📚 Worked Examples Across Business Scenarios {#worked-examples-across-business-scenarios-tableau}

### 1. Executive KPI Dashboard with Dual-Axis Combo & Reference Lines

**Scenario:** Leadership wants one view showing monthly revenue (bars) against a target line (reference), with a rolling 3-month trend line overlaid.

```text
1. Build the base bar chart: Month (continuous, green) on Columns, SUM(Revenue) on Rows.
2. Drag a second SUM(Revenue) pill onto the same Rows shelf → right-click → Dual Axis → Synchronize Axis.
3. Change the second mark's type to Line, then right-click it → Add Table Calculation → Moving Average
   (3 periods) for the rolling trend.
4. Analytics pane → drag "Reference Line" onto the primary axis, set value to a Target parameter so
   leadership can adjust the goal without editing the workbook.
5. Color the bars conditionally: a calculated field IF SUM([Revenue]) >= [Target] THEN "On Track" ELSE
   "Behind" END, dropped on Color.
```

### 2. Customer Cohort Analysis with LOD Expressions

**Scenario:** Show average revenue per customer, bucketed by how many months since their first purchase, without a separate data-prep step.

```
// First purchase date per customer, computed once regardless of view filters
{ FIXED [Customer ID] : MIN([Order Date]) }

// Months since first purchase — a calculated field built on the LOD above
DATEDIFF('month', { FIXED [Customer ID] : MIN([Order Date]) }, [Order Date])

// Drop "Months Since First Purchase" on Columns, AVG(Sales) on Rows, First-Purchase-Month on Color
// for a classic cohort curve, entirely inside one calculated Tableau view (no pre-aggregated source table needed).
```

### 3. Dynamic Top-N Filter Driven by a Parameter

**Scenario:** Let viewers toggle between Top 5 / Top 10 / Top 20 products by sales without duplicating the sheet.

```
// Parameter: Top N Selector, integer, list of allowable values [5, 10, 20]

// Calculated field used as a filter
Top N Flag = RANK(SUM([Sales])) <= [Top N Selector]

// Drag Top N Flag to the Filters shelf, set to True — the view now respects whatever the
// parameter control is set to, with zero duplicated sheets to maintain.
```

### 4. Sales Forecasting for Inventory Planning

**Scenario:** An operations team needs a 6-month forward forecast of unit demand to plan inventory, with a visible confidence band for risk-aware ordering.

```text
1. Build a monthly time series: Month (continuous) on Columns, SUM(Units Sold) on Rows.
2. Analysis menu → Forecast → Show Forecast — Tableau auto-detects seasonality and extends the line
   with a shaded confidence band for the next several periods.
3. Analysis → Forecast → Describe Forecast to check the model quality (MASE, seasonality strength)
   before trusting it for a real ordering decision — a poor-quality forecast is flagged here, not hidden.
4. Right-click the forecasted portion → Format to visually distinguish "actual" vs. "forecasted" periods
   so viewers don't mistake a projection for a fact.
```

### 5. Row-Level Security via an Entitlement Table

**Scenario:** Regional managers should each see only their own region's data in one shared published dashboard.

```text
1. Build an entitlement table: two columns, Username and Region (one row per manager-region pair,
   supports a manager covering multiple regions).
2. Join (or blend) the entitlement table into the data source on Region.
3. Create a calculated field: User Filter = { FIXED : MAX(IF [Username] = USERNAME() THEN 1 ELSE 0 END) }
   evaluated per region — or more simply, drag the entitlement table's Username field to a filter and
   set it to USERNAME() via a calculated boolean field, then drop that field on Filters set to True.
4. Publish once — Tableau Server evaluates USERNAME() per viewer at render time, so the same published
   dashboard shows different rows to different logged-in users automatically.
```

### 6. Diagnosing and Fixing a Slow Dashboard

**Scenario:** A published dashboard takes 15+ seconds to load and stakeholders are complaining.

```text
1. Help → Settings and Performance → Start Performance Recording, then interact with the dashboard normally.
2. Stop recording — Tableau opens a workbook showing exactly which query/render/layout step consumed
   the most time, instead of guessing.
3. Common fixes found this way: switch a Live connection to an Extract; add a Context Filter so
   downstream FIXED LODs operate on a pre-shrunk dataset instead of the full table; hide unused fields
   in the data source to shrink the extract; replace an excessive number of quick table calcs stacked
   on a huge extract with pre-aggregated fields computed upstream in Prep or the source database.
4. Re-run Performance Recording after each change to confirm the actual bottleneck moved, rather than
   assuming a fix worked.
```

### 7. Bullet Graph for Sales Rep Goal Tracking

**Scenario:** Show each sales rep's actual performance against their quota in a compact, precise format better suited to comparing many reps than a gauge chart.

```text
1. Build a bar chart: Sales Rep on Rows, SUM(Actual Sales) on Columns.
2. Show Me panel → select Bullet Graph (Tableau auto-detects the actual + target measure pairing once
   both SUM(Actual) and SUM(Quota) are on the view).
3. Right-click the axis → Edit Reference Line to add qualitative bands (e.g., <70% quota = red zone,
   70-95% = yellow, 95%+ = green) for at-a-glance status per rep without reading exact numbers.
```
