# Power BI / DAX Cheatsheet for Data & Analytics

> A structured Power BI reference — data modeling, Power Query M vs. DAX, filter/row context, CALCULATE, time intelligence, common measure patterns, and performance.

## 📑 Table of Contents

1. [🧠 Core Concepts: Power BI Architecture](#core-concepts-power-bi-architecture)
2. [🗂️ Data Modeling: Star Schema & Relationships](#data-modeling-star-schema-relationships)
3. [⚙️ Power Query (M) vs. DAX — When to Use Which](#power-query-m-vs-dax-when-to-use-which)
4. [🧮 DAX Syntax Fundamentals](#dax-syntax-fundamentals)
5. [📊 Calculated Columns vs. Measures](#calculated-columns-vs-measures)
6. [🎯 Row Context vs. Filter Context](#row-context-vs-filter-context)
7. [⚡ CALCULATE: The Core of DAX](#calculate-the-core-of-dax)
8. [📅 Time Intelligence Functions](#time-intelligence-functions)
9. [🧩 Iterator (X) Functions](#iterator-x-functions)
10. [📈 Common DAX Measure Patterns](#common-dax-measure-patterns)
11. [🗃️ Table Functions](#table-functions)
12. [🔢 Variables (VAR)](#variables-var)
13. [🎨 Visuals & Report Formatting](#visuals-report-formatting)
14. [🔐 Row-Level Security (RLS)](#row-level-security-rls)
15. [🔗 Power BI Service: Workspaces, Datasets & Refresh](#power-bi-service-workspaces-datasets-refresh)
16. [⚡ Performance: VertiPaq & Optimization](#performance-vertipaq-optimization)
17. [🧰 Keyboard/Editor Tips](#keyboard-editor-tips)
18. [⚠️ Common Gotchas](#common-gotchas)
19. [🎯 Best Practices](#best-practices)
20. [💡 Pro Tips](#pro-tips)
21. [🧮 Advanced DAX Patterns](#advanced-dax-patterns)
22. [🏗️ Composite Models & Aggregations](#composite-models-aggregations)
23. [☁️ Dataflows, Fabric & Direct Lake](#dataflows-fabric-direct-lake)
24. [🔍 DAX Debugging & Tooling](#dax-debugging-tooling)
25. [📄 Paginated Reports](#paginated-reports)
26. [📚 Worked Examples Across Business Scenarios](#worked-examples-across-business-scenarios-powerbi)

## ⚡ Quick Reference

**DAX syntax cheatsheet**

| Task                        | DAX                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------- |
| Simple measure                | `Total Sales = SUM(Sales[Amount])`                                            |
| Filtered measure               | `US Sales = CALCULATE([Total Sales], Sales[Country] = "US")`                  |
| Year-to-date                   | `Sales YTD = TOTALYTD([Total Sales], 'Date'[Date])`                           |
| Prior year                     | `Sales PY = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Date'[Date]))`       |
| YoY % growth                    | `DIVIDE([Total Sales] - [Sales PY], [Sales PY])`                              |
| Rank                            | `Sales Rank = RANKX(ALL(Products[Product]), [Total Sales])`                   |
| Row-by-row aggregate            | `Weighted = SUMX(Sales, Sales[Qty] * Sales[Price])`                            |
| Remove all filters              | `Grand Total = CALCULATE([Total Sales], ALL(Sales))`                          |
| Safe divide (no /0 error)       | `DIVIDE([Profit], [Sales], 0)`                                                 |
| Distinct count                  | `Customers = DISTINCTCOUNT(Sales[CustomerID])`                                |

**Function category quick map**

| Category            | Examples                                                       |
| --------------------- | ------------------------------------------------------------------ |
| Aggregation           | `SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, DISTINCTCOUNT`             |
| Iterators (X)          | `SUMX, AVERAGEX, RANKX, FILTER, MAXX, COUNTROWS`                    |
| Time intelligence      | `TOTALYTD, DATESYTD, SAMEPERIODLASTYEAR, DATEADD, DATESBETWEEN`     |
| Filter/context          | `CALCULATE, CALCULATETABLE, ALL, ALLEXCEPT, ALLSELECTED, REMOVEFILTERS` |
| Table functions        | `FILTER, VALUES, DISTINCT, SUMMARIZE, ADDCOLUMNS, RELATEDTABLE`      |
| Relationship functions  | `RELATED, RELATEDTABLE, USERELATIONSHIP, TREATAS`                    |
| Logical                 | `IF, SWITCH, AND, OR, COALESCE`                                      |

## 🧠 Core Concepts: Power BI Architecture

```text
Power BI Desktop  → authoring tool: Power Query (data prep) + Data Model (relationships, DAX) + Report (visuals)
Power BI Service   → cloud host: Workspaces, Datasets (semantic models), Dashboards, Apps, scheduled refresh
Power BI Report Server → on-premises alternative to the cloud Service
Semantic model (dataset) → the published data model (tables, relationships, measures) that reports query against;
                            multiple reports can share one semantic model ("Live Connection")
Dataflows → Power Query logic that runs in the Service itself, reusable across multiple datasets
```

## 🗂️ Data Modeling: Star Schema & Relationships

```text
Star schema: one central Fact table (transactions, events — long, numeric, granular)
             surrounded by Dimension tables (Date, Product, Customer, Region — short, descriptive, joined by key)

Relationship cardinality: One-to-Many (most common), One-to-One, Many-to-Many (use carefully — ambiguous by default)
Cross-filter direction: Single (dimension filters fact — default & recommended) vs. Both (bidirectional — can
                         cause ambiguous filter propagation and circular logic in complex models)
Always build a proper Date dimension table and mark it as a Date Table (Model view → table → Mark as Date Table)
                         to unlock time-intelligence functions correctly
```

```dax
// Relationship must exist for RELATED to work across tables
Product Category = RELATED(Products[Category])   // used in a calculated column on the Sales fact table
```

## ⚙️ Power Query (M) vs. DAX — When to Use Which

```text
Power Query (M): runs BEFORE the model loads — reshaping, cleaning, merging, unpivoting, changing types.
                  Use for anything that should exist once, physically, in every refresh (row-level transforms).
DAX:             runs AT QUERY TIME — measures, calculated columns/tables, context-aware aggregation.
                  Use for anything that needs to react to filters/slicers dynamically.

Rule of thumb: if the transformation is the same regardless of what the user clicks, do it in Power Query.
                If it needs to change based on filter context (a slicer, a visual's rows), it must be DAX.
```

```m
// Power Query M — applied step by step, visible in the Applied Steps pane
let
    Source = Sql.Database("server", "db"),
    Sales = Source{[Schema="dbo", Item="Sales"]}[Data],
    Filtered = Table.SelectRows(Sales, each [OrderDate] >= #date(2024, 1, 1)),
    Typed = Table.TransformColumnTypes(Filtered, {{"Amount", type number}}),
    Grouped = Table.Group(Typed, {"CustomerID"}, {{"TotalSpend", each List.Sum([Amount]), type number}})
in
    Grouped
```

## 🧮 DAX Syntax Fundamentals

```dax
// Comments
// single line
/* multi
   line */

// Referencing columns and measures
Sales[Amount]              -- fully qualified column reference
[Total Sales]               -- measure reference (no table prefix)

// Operators
+ - * /                     -- arithmetic
= <> > < >= <=               -- comparison
&&  ||  NOT                  -- logical AND/OR/NOT (also AND()/OR() functions)
&                             -- string concatenation

// Data types: Whole Number, Decimal Number, Currency, Date/Time, Text, TRUE/FALSE
```

## 📊 Calculated Columns vs. Measures

```text
Calculated Column: computed row-by-row at REFRESH time, stored physically in the model (uses memory/disk),
                    has row context automatically, visible as a regular column, can be used to slice/filter.

Measure:            computed at QUERY time, NOT stored, always aggregates, has NO row context automatically
                    (only filter context) — the default, preferred choice for almost all calculations.
```

```dax
// Calculated column — one value per row, computed at refresh
Margin % = DIVIDE(Sales[Revenue] - Sales[Cost], Sales[Revenue])

// Measure — one value per filter context, computed on demand
Total Margin % = DIVIDE(SUM(Sales[Revenue]) - SUM(Sales[Cost]), SUM(Sales[Revenue]))
```

**Prefer measures over calculated columns whenever the logic is an aggregation** — calculated columns bloat the model's memory footprint and don't respond to filter context the way measures do.

## 🎯 Row Context vs. Filter Context

The two evaluation contexts are the conceptual foundation of all of DAX:

```text
Row Context:    exists inside calculated columns and iterator (X) functions — "I'm on this one row,
                what are this row's column values?" Access columns directly: Sales[Amount].

Filter Context: exists from slicers, visual filters, page filters, and CALCULATE's filter arguments —
                "which rows are currently visible to be aggregated?" Cannot access a bare column value
                without an aggregation function.

Context Transition: CALCULATE converts a row context into an equivalent filter context. This happens
                     implicitly whenever a measure is referenced inside an iterator (SUMX, FILTER, etc.).
```

```dax
// Context transition example
Weighted Revenue =
SUMX(
    Products,
    Products[Weight] * [Total Sales]     -- [Total Sales] triggers an implicit CALCULATE per row of Products
)
```

## ⚡ CALCULATE: The Core of DAX

`CALCULATE(<expression>, <filter1>, <filter2>, ...)` — modifies the filter context an expression is evaluated in. Considered the single most important function in the language.

```dax
US Sales = CALCULATE([Total Sales], Sales[Country] = "US")        -- boolean filter, adds to existing context
Non-West Sales = CALCULATE([Total Sales], Sales[Region] <> "West")

Sales Excl Category Filter =
CALCULATE([Total Sales], ALL(Products[Category]))                  -- removes any existing filter on Category

Sales No Filters At All = CALCULATE([Total Sales], ALL(Sales))     -- clears every filter on the whole table

Sales Keep Only Category =
CALCULATE([Total Sales], ALLEXCEPT(Products, Products[Category]))  -- removes all filters on Products EXCEPT Category

Sales As Selected =
CALCULATE([Total Sales], ALLSELECTED(Products))                    -- respects slicers, ignores visual-level filters — used for "% of total shown"
```

**Filter argument types:**

| Type                     | Example                                     | Behavior                              |
| --------------------------- | ---------------------------------------------- | ---------------------------------------- |
| Boolean (implicit table filter) | `Products[Color] = "Red"`               | Adds a filter, keeps existing context     |
| Table expression             | `FILTER(ALL(Products), Products[Price] > 100)` | Replaces filters on the affected columns |
| REMOVEFILTERS               | `REMOVEFILTERS(Products[Color])`             | Removes an existing filter on a column   |
| ALL                          | `ALL(Products)`                              | Removes all filters on a table           |

## 📅 Time Intelligence Functions

Requires a proper Date table (unique dates, no gaps, full years, marked as a Date Table).

```dax
Sales YTD = TOTALYTD([Total Sales], 'Date'[Date])
Sales QTD = TOTALQTD([Total Sales], 'Date'[Date])
Sales MTD = TOTALMTD([Total Sales], 'Date'[Date])

Sales Prior Year = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Date'[Date]))
Sales Prior Month = CALCULATE([Total Sales], DATEADD('Date'[Date], -1, MONTH))
Sales Prior Period = CALCULATE([Total Sales], PARALLELPERIOD('Date'[Date], -1, MONTH))

YoY Growth % =
VAR CurrentSales = [Total Sales]
VAR PriorSales = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Date'[Date]))
RETURN DIVIDE(CurrentSales - PriorSales, PriorSales)

Sales Between = CALCULATE([Total Sales], DATESBETWEEN('Date'[Date], DATE(2026,1,1), DATE(2026,6,30)))
Rolling 3M Avg = AVERAGEX(DATESINPERIOD('Date'[Date], LASTDATE('Date'[Date]), -3, MONTH), [Total Sales])
```

DAX time-intelligence functions assume regular calendar periods — for a 4-4-5 fiscal calendar or custom weeks, build the logic manually with `CALCULATE` + custom date filters instead.

## 🧩 Iterator (X) Functions

Iterators evaluate an expression row-by-row (establishing row context) and then aggregate the results — needed whenever the calculation can't be expressed as a simple `SUM(column)`.

```dax
SUMX(Sales, Sales[Qty] * Sales[UnitPrice])                 -- row-level multiply, then sum
AVERAGEX(Sales, Sales[Qty] * Sales[UnitPrice])
MAXX(Products, [Total Sales])
RANKX(ALL(Products[Product]), [Total Sales])                -- rank each product by its total sales
COUNTROWS(FILTER(Sales, Sales[Amount] > 1000))               -- count rows meeting a condition
CONCATENATEX(VALUES(Products[Product]), Products[Product], ", ")  -- comma-joined list of values
```

## 📈 Common DAX Measure Patterns

```dax
// Running total
Running Total =
CALCULATE([Total Sales], FILTER(ALLSELECTED('Date'[Date]), 'Date'[Date] <= MAX('Date'[Date])))

// % of grand total
% of Total = DIVIDE([Total Sales], CALCULATE([Total Sales], ALL(Sales)))

// Rank with ties handled
Product Rank = RANKX(ALL(Products[Product]), [Total Sales], , DESC, DENSE)

// Top N filter (used inside a visual filter, not as a measure result directly)
Top 5 Flag = IF(RANKX(ALL(Products[Product]), [Total Sales]) <= 5, 1, 0)

// New vs returning customer flag
Customer Type =
VAR FirstPurchase = CALCULATE(MIN(Sales[OrderDate]), ALLEXCEPT(Sales, Sales[CustomerID]))
RETURN IF(FirstPurchase = MIN(Sales[OrderDate]), "New", "Returning")

// Distinct count with a condition
Active Customers = CALCULATE(DISTINCTCOUNT(Sales[CustomerID]), Sales[Status] = "Active")
```

## 🗃️ Table Functions

```dax
VALUES(Products[Category])                 -- distinct values currently visible in filter context (table)
DISTINCT(Products[Category])                -- similar to VALUES but doesn't include a blank row for invalid relationships
FILTER(Sales, Sales[Amount] > 1000)          -- row subset matching a condition
ALL(Sales)                                    -- every row of the table, ignoring filters
SUMMARIZE(Sales, Products[Category], "Total", SUM(Sales[Amount]))   -- grouped table
ADDCOLUMNS(Products, "Margin", [Total Sales] - [Total Cost])         -- add a computed column to a table expr
RELATEDTABLE(Sales)                           -- rows in Sales related to the current row of a dimension table
TOPN(5, Products, [Total Sales], DESC)         -- top N rows by an expression
```

## 🔢 Variables (VAR)

`VAR` improves readability and performance by computing a sub-expression once and reusing it — avoids re-evaluating the same CALCULATE multiple times.

```dax
Profit Margin Insight =
VAR CurrentMargin = DIVIDE([Total Profit], [Total Sales])
VAR PriorMargin = CALCULATE(DIVIDE([Total Profit], [Total Sales]), SAMEPERIODLASTYEAR('Date'[Date]))
VAR Delta = CurrentMargin - PriorMargin
RETURN
    SWITCH(
        TRUE(),
        Delta > 0.02, "Improving",
        Delta < -0.02, "Declining",
        "Stable"
    )
```

## 🎨 Visuals & Report Formatting

```text
Common visuals: Card, Table, Matrix, Bar/Column, Line, Combo, Scatter, Map, Slicer, KPI, Gauge, Decomposition Tree, Key Influencers
Conditional formatting: right-click a table/matrix value field → Conditional formatting → Background color/Data bars/Icons
Bookmarks: saved states of filters/visibility, used to build "tab-like" navigation or toggle views
Drillthrough: a dedicated page that a user right-click-navigates to from a data point, carrying filter context with it
Tooltip pages: a whole report page rendered as a hover tooltip on another visual
```

## 🔐 Row-Level Security (RLS)

```text
Modeling → Manage Roles → create a role → add a DAX filter expression per table, e.g.:
    [Region] = USERPRINCIPALNAME()             -- restricts a table to rows matching the logged-in user's email
Static RLS: hardcoded role/filter combos assigned to specific users/groups in the Service
Dynamic RLS: filter expression references a table mapping usernames to allowed values (entitlement table) —
             scales without creating a new role per user
```

## 🔗 Power BI Service: Workspaces, Datasets & Refresh

```text
Workspace: a container for related reports/datasets/dashboards, with its own access permissions
Dataset (semantic model): the published data model; can be reused (Live Connection) by multiple reports
Gateway: required for the Service to refresh a dataset sourced from on-premises data
Scheduled Refresh: up to 8x/day on Pro, more frequent on Premium/Fabric capacity; Incremental Refresh
                    partitions large fact tables so only recent data re-loads each run
DirectQuery: queries the source live at report-render time (no import/refresh cycle, but slower interaction
             and DAX restrictions vs. Import mode); Composite models mix Import + DirectQuery per table
```

## ⚡ Performance: VertiPaq & Optimization

```text
VertiPaq: Power BI's in-memory columnar compression engine — favors low-cardinality columns, integers over
          strings/floats, and star schemas over snowflaked/wide flat tables.

- Reduce cardinality: use whole numbers/keys instead of long text strings as relationship columns
- Avoid unnecessary calculated columns — precompute in Power Query/the source when the logic is refresh-time-static
- Disable auto date/time hierarchies on numeric-heavy models (File → Options → Data Load) if you have a real Date table
- Use DAX Studio to profile query timings and see the generated Storage Engine (SE) vs. Formula Engine (FE) split
- Prefer measures over calculated columns wherever possible — smaller model, dynamic behavior
- Avoid bidirectional cross-filtering except where a many-to-many relationship genuinely requires it
```

## 🧰 Keyboard/Editor Tips

| Action                     | Shortcut / Path                                   |
| --------------------------- | ----------------------------------------------------- |
| New measure                 | Modeling ribbon → New Measure, or right-click table    |
| Quick measure (guided UI)    | Modeling ribbon → Quick Measure                        |
| Format DAX code              | Paste into DAX Formatter (daxformatter.com) or use Tabular Editor |
| Toggle data/model/report view | icons on the left rail of Power BI Desktop           |
| Performance analyzer         | View ribbon → Performance Analyzer → Start Recording    |

## ⚠️ Common Gotchas

- **`CALCULATE` inside an iterator triggers context transition** — a measure referenced inside `SUMX`/`FILTER` implicitly wraps in `CALCULATE`, which can silently change results if you weren't expecting the row's values to become filters.
- **`ALLSELECTED` vs. `ALL` are frequently confused** — `ALL` clears every filter unconditionally; `ALLSELECTED` respects slicers but ignores filters from the visual's own rows/columns, which is what most "% of total shown" patterns actually need.
- **Calculated columns don't respond to slicers** — they're computed once at refresh time and stored, so they can't do what a measure does; a common mistake is building a KPI as a calculated column and being confused why it doesn't change.
- **`RELATED` only works across an existing relationship in the "many" direction** (one calculated column can't `RELATED()` across a filter path that doesn't match the relationship's cardinality) — use `RELATEDTABLE` from the "one" side instead.
- **Bidirectional relationships can create ambiguous or circular filter paths** in models with more than a couple of fact-adjacent tables — default to single-direction filtering and use `CROSSFILTER()` in a specific measure when you genuinely need the other direction just once.
- **`DIVIDE()` should always replace bare `/`** in production measures — a bare division throws a visible error on a `0` denominator instead of gracefully returning blank/an alternate value.
- **Auto date/time hierarchies (on by default per date column) silently multiply model size** on wide fact tables with many date columns — turn this off globally if you have a real Date dimension table.

## 🎯 Best Practices

- Build a proper star schema with a dedicated Date table before writing any time-intelligence measure.
- Default to single-direction relationships; treat bidirectional as an exception, not a starting point.
- Write measures, not calculated columns, for anything that should react to a slicer or visual filter.
- Use `VAR` liberally — it makes complex DAX both faster (avoids re-evaluating the same expression) and dramatically easier to read.
- Keep a "Measures" table (a dummy table with no data, just holding organized measures) to keep the model's field list clean instead of scattering measures across every fact table.
- Profile with DAX Studio / Performance Analyzer before assuming a slow report is a DAX problem — it's often the visual count or a DirectQuery round-trip instead.

## 💡 Pro Tips

1. **`SWITCH(TRUE(), cond1, val1, cond2, val2, default)`** is cleaner than nested `IF`s for more than two branches.
2. **Use Tabular Editor / DAX Studio (free community tools)** for bulk-editing measures, scripting model changes, and formatting — Power BI Desktop's native DAX editor is limited for large models.
3. **`ALLEXCEPT`** is usually clearer intent than combining multiple `ALL()`+`VALUES()` calls when you want "reset everything except these specific columns."
4. **A disconnected "what-if" parameter table** (Modeling → New Parameter → Numeric range) lets users drive a measure via a slicer with no relationship needed — great for sensitivity/scenario analysis.
5. **`TREATAS`** lets you apply a filter from one table onto an unrelated table by matching column values — useful for virtual relationships without adding a physical join.
6. **Incremental refresh policies** dramatically cut refresh time on large fact tables — set them up as soon as a table crosses into the millions-of-rows range.
7. **Field parameters** let a single visual swap which measure/dimension it's showing via a slicer, instead of building a separate visual per metric.
8. **Composite models (mixing Import + DirectQuery)** let you keep a huge fact table live while importing smaller dimension tables for fast slicing.
9. **Name measures without a table prefix in formulas** (`[Total Sales]`, not `Sales[Total Sales]`) — DAX best practice, and it visually distinguishes measures from columns.
10. **Use the Performance Analyzer's "Copy query" button** to grab the exact DAX query a visual generated, then paste it into DAX Studio for deep profiling.

## 🧮 Advanced DAX Patterns

```dax
// Semi-additive measure: inventory/headcount-style balances that sum across products but NOT across time
Ending Inventory =
CALCULATE(
    SUM(Inventory[Quantity]),
    LASTDATE('Date'[Date])
)
// summing across every date in a range would double-count a balance — LASTDATE picks the correct snapshot

// Many-to-many via a bridge table (e.g., one sales rep can cover many products, and vice versa)
Bridged Sales =
CALCULATE(
    [Total Sales],
    RepProductBridge
)
// the bridge table sits between Reps and Products with no direct fact-table relationship required

// Budget vs. Actual comparison across two differently-grained fact tables
Budget vs Actual Variance =
VAR ActualAmt = [Total Sales]
VAR BudgetAmt = CALCULATE(SUM(Budget[Amount]), TREATAS(VALUES(Sales[Region]), Budget[Region]))
RETURN ActualAmt - BudgetAmt
// TREATAS applies filter context from one table onto an unrelated table by matching column values —
// avoids needing a physical relationship between Sales and Budget

// Dynamic segmentation with a disconnected table + SWITCH
Customer Segment =
VAR CustomerRevenue = [Total Sales]
RETURN
    SWITCH(
        TRUE(),
        CustomerRevenue > 100000, "Enterprise",
        CustomerRevenue > 10000, "Mid-Market",
        "SMB"
    )
```

## 🏗️ Composite Models & Aggregations

```text
Composite model: mixes storage modes within one semantic model — some tables Import (fast, cached),
                  some DirectQuery (live, source-bound), even multiple DirectQuery sources combined —
                  lets you keep a huge fact table live while importing smaller lookup/dimension tables.

Aggregations: a pre-summarized Import table sitting "in front of" a large DirectQuery detail table —
              Power BI automatically routes a query to the smaller aggregation table when the requested
              grain allows it (e.g., a report showing monthly totals hits the aggregation; a drill-down
              to daily/transaction level falls through to the DirectQuery detail table).

Set up via: Manage Aggregations (right-click the aggregation table) → map each aggregated column to its
            corresponding detail-table column and summarization function (Sum, Count, Min, Max, GroupBy).
```

## ☁️ Dataflows, Fabric & Direct Lake

```text
Power BI Dataflows: Power Query logic hosted in the Service itself (not tied to one .pbix file), writing
                     to a shared storage layer (Dataverse or Azure Data Lake) — multiple datasets/reports
                     can reuse the same cleaned, transformed tables instead of duplicating Power Query
                     logic across every workbook.

Microsoft Fabric: the unified data platform Power BI sits inside — OneLake (a single logical data lake
                   across the org), Lakehouses, Data Warehouses, and Data Engineering/Science workloads
                   sharing the same underlying storage.

Direct Lake mode: a newer storage mode (Fabric-specific) that reads Delta Lake tables directly from
                   OneLake without a traditional Import (no scheduled refresh/duplication) or the
                   query-per-interaction cost of DirectQuery — combines Import-like speed with
                   DirectQuery-like freshness, when the source is already a Fabric Lakehouse/Warehouse table.
```

## 🔍 DAX Debugging & Tooling

```text
DAX Studio (free, community tool): connect to a running Power BI Desktop session or a published dataset —
  - Run and time individual DAX queries outside the report canvas
  - View the Server Timings tab: splits query time between Storage Engine (SE, the VertiPaq scan) and
    Formula Engine (FE, row-by-row DAX evaluation) — a high FE% often signals an overly complex measure
    that could be simplified or restructured
  - Export/trace query plans for deep performance investigation

Tabular Editor (free/paid tiers): a lightweight external model editor —
  - Bulk-edit measures/columns without clicking through the Power BI Desktop UI one field at a time
  - Best Practice Analyzer (BPA): a built-in rule set flagging common modeling anti-patterns
    (bidirectional relationships, unused columns, missing descriptions, calculated columns that
    should be measures) before they ship
  - C# scripting for programmatic model changes across many measures at once

Performance Analyzer (built into Power BI Desktop): records per-visual query/render duration for the
  current report session — the first stop for "why is this specific visual slow," before reaching for
  DAX Studio's deeper query-plan tools.
```

## 📄 Paginated Reports

```text
Power BI Report Builder: a separate authoring tool (not Power BI Desktop) for pixel-perfect, print-ready,
                          multi-page reports — think "the Power BI answer to SSRS," built for invoices,
                          regulatory filings, and exact-layout documents rather than interactive exploration.
Data source: can query a Power BI semantic model directly (via DAX/MDX) or a traditional database connection.
Distribution: published to the Power BI Service alongside interactive reports, exportable to PDF/Word/Excel
              with layout fidelity that a standard Power BI report's export doesn't guarantee.
```

## 📚 Worked Examples Across Business Scenarios {#worked-examples-across-business-scenarios-powerbi}

### 1. Executive Sales Scorecard with YoY and Target Variance

**Scenario:** Leadership wants a single page showing current sales, YoY growth, and variance against an annual target, refreshed nightly.

```dax
Total Sales = SUM(Sales[Amount])

Sales PY = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Date'[Date]))

YoY Growth % = DIVIDE([Total Sales] - [Sales PY], [Sales PY])

Sales vs Target % =
VAR TargetAmt = CALCULATE(SUM(Targets[Amount]), REMOVEFILTERS('Date'), 'Date'[Year] = MAX('Date'[Year]))
RETURN DIVIDE([Total Sales], TargetAmt)
```

```text
Build three Card visuals (Total Sales, YoY Growth %, Sales vs Target %) across the top of the page,
each with conditional formatting rules (Format → Conditional formatting → Font color) so the YoY and
target cards turn red below 0%/100% respectively — an at-a-glance status read with zero extra visuals.
```

### 2. Customer Cohort Retention Matrix

**Scenario:** A subscription business needs a retention matrix (cohort month × months since signup) inside a Power BI matrix visual.

```dax
Cohort Month = CALCULATE(MIN('Date'[Date]), ALLEXCEPT(Sales, Sales[CustomerID]))

Months Since Signup = DATEDIFF([Cohort Month], MAX('Date'[Date]), MONTH)

Retention % =
VAR CohortSize = CALCULATE(DISTINCTCOUNT(Sales[CustomerID]), ALLEXCEPT(Sales, Sales[Cohort Month]))
VAR ActiveThisMonth = DISTINCTCOUNT(Sales[CustomerID])
RETURN DIVIDE(ActiveThisMonth, CohortSize)
```

```text
Matrix visual: Rows = Cohort Month, Columns = Months Since Signup, Values = Retention %,
with conditional formatting (background color scale) applied to the value cells for a heatmap effect
— Power BI matrix visuals support this natively without a custom chart.
```

### 3. Top-N Products with a "Show Others as Remainder" Pattern

**Scenario:** A product report should show the top 10 products by revenue individually, with everything else rolled into a single "Other" bar.

```dax
Product Rank = RANKX(ALL(Products[Product]), [Total Sales])

Product Label =
IF([Product Rank] <= 10, Products[Product], "Other")

Total Sales (Grouped) =
CALCULATE([Total Sales], ALLEXCEPT(Products, Products[Product Label]))
```

```text
Use Product Label (not the raw Product field) on the visual's axis, with Total Sales (Grouped) as the
value — every product ranked 11+ automatically collapses into a single "Other" bar without needing to
pre-aggregate the underlying table.
```

### 4. Dynamic What-If Scenario for Pricing Sensitivity

**Scenario:** Let a viewer drag a slider to see how a hypothetical price change would affect projected revenue, with no changes to the underlying data.

```text
1. Modeling → New Parameter → Numeric Range: "Price Change %", from -20% to +20%, increment 1%.
   Power BI auto-creates a disconnected table and a matching [Price Change % Value] measure.
2. Build a measure using that generated field:
```

```dax
Projected Revenue =
[Total Sales] * (1 + SELECTEDVALUE('Price Change %'[Price Change % Value], 0))
```

```text
3. Drop the auto-generated "Price Change %" slicer on the page — dragging it recalculates
   Projected Revenue live, with zero data refresh needed since the underlying Sales table is untouched.
```

### 5. Row-Level Security for a Multi-Region Sales Org

**Scenario:** Regional VPs should each see only their region's data in the same published report.

```dax
// RLS role expression, set in Modeling → Manage Roles → new role "RegionFilter"
[Region] = LOOKUPVALUE(UserRegionMap[Region], UserRegionMap[Email], USERPRINCIPALNAME())
```

```text
1. Build a UserRegionMap table (Email, Region) — one row per VP, imported/refreshed like any other table.
2. Create the role above, applying the DAX filter to the Sales table (or the Region dimension it relates to).
3. Assign users to the role in the Power BI Service (Dataset settings → Security) — the SAME published
   report shows different rows to different logged-in VPs automatically, no duplicate reports needed.
4. Test with "View as Roles" in Desktop before publishing to confirm the filter behaves as expected.
```

### 6. Diagnosing a Slow Report with DAX Studio

**Scenario:** A report page takes 8+ seconds to render and a specific matrix visual is suspected.

```text
1. View ribbon → Performance Analyzer → Start Recording, then refresh the visuals on the page.
2. Sort the results by Duration — identify whether the bottleneck is the DAX Query time or the
   Visual Display time (a slow visual with a fast query points to rendering complexity, not DAX).
3. For a slow query: right-click the visual's entry → Copy Query, paste into DAX Studio, run with
   Server Timings enabled.
4. A high Storage Engine (SE) time relative to Formula Engine (FE) often means the model needs better
   compression (lower-cardinality columns) or an aggregation table; a high FE time often means the
   measure itself has too much row-by-row logic that could be restructured with VAR or simplified CALCULATE calls.
```
