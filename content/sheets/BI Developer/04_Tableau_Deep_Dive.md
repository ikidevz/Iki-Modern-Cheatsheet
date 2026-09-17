# 📈 Tableau Deep Dive — BI Developer Cheatsheet (Deep Dive)

## Table of Contents
1. [Architecture](#1-architecture)
2. [Connection Types](#2-connection-types)
3. [LOD (Level of Detail) Expressions — In Depth](#3-lod-level-of-detail-expressions--in-depth)
4. [Calculated Fields vs Table Calculations](#4-calculated-fields-vs-table-calculations)
5. [Table Calculation Pattern Library](#5-table-calculation-pattern-library)
6. [Order of Operations](#6-order-of-operations-simplified)
7. [Parameters, Sets, and Groups — With Examples](#7-parameters-sets-and-groups--with-examples)
8. [Dashboard Actions — Worked Examples](#8-dashboard-actions--worked-examples)
9. [Performance Best Practices](#9-performance-best-practices)
10. [Tableau Prep Pipeline Example](#10-tableau-prep-pipeline-example)
11. [Server/Cloud Administration](#11-servercloud-administration)
12. [Worked Example: Regional Sales Analysis Workbook](#12-worked-example-regional-sales-analysis-workbook)

---

## 1. Architecture

```
Tableau Desktop (Author) → Published Data Source / Extract (Hyper) → Tableau Server/Cloud → Consumers
```

- **Tableau Desktop**: authoring tool where workbooks, calculated fields, and dashboards are built.
- **Hyper Engine**: Tableau's in-memory columnar extract engine (replaced the older TDE format) — powers fast querying of extracted data.
- **Tableau Server/Cloud**: hosts published workbooks and data sources, manages permissions, schedules extract refreshes, and serves dashboards to end users via browser/mobile.

---

## 2. Connection Types

| Type | Description | When to Use |
|---|---|---|
| **Live** | Direct query to source each interaction | Real-time needs, small/fast sources |
| **Extract (.hyper)** | Snapshot of data pulled into Tableau's columnar Hyper engine | Large datasets, performance, offline use |

### Extract Refresh Strategies
- **Full Refresh** — reloads all data; simplest but slowest for large datasets.
- **Incremental Refresh** — only pulls new/changed rows based on a specified date/datetime column; much faster for append-only fact tables.
```
Data Source > Extract > Incremental Refresh
Increment field: [OrderDate]
-- Tableau will only query rows where OrderDate > last refresh's max OrderDate
```

---

## 3. LOD (Level of Detail) Expressions — In Depth

| LOD | Behavior |
|---|---|
| `FIXED` | Computes at a specified dimension granularity, ignoring viz filters (unless context filter applied) |
| `INCLUDE` | Computes at a finer granularity than the view, then aggregates up |
| `EXCLUDE` | Removes a dimension from view-level granularity |

### FIXED — Customer's First Purchase Date
```
{ FIXED [Customer ID] : MIN([Order Date]) }
```
This value stays the same for a customer regardless of what date filter is applied to the view — useful for cohort analysis.

### INCLUDE — Average Order Value per Customer, Shown at Region Level
```
// Step 1: order-level total, INCLUDE Order ID even if the view is at Region level
{ INCLUDE [Order ID] : SUM([Sales]) }

// Step 2: average that across orders within each region (this becomes an aggregate in the view)
AVG({ INCLUDE [Order ID] : SUM([Sales]) })
```

### EXCLUDE — Total Sales Ignoring the Sub-Category Split
```
{ EXCLUDE [Sub-Category] : SUM([Sales]) }
```
Useful for showing "% of Category Total" when Sub-Category is broken out in the view:
```
SUM([Sales]) / { EXCLUDE [Sub-Category] : SUM([Sales]) }
```

### Nested LOD Example — Customers Whose First Purchase Was a High-Value Order
```
// Step 1: first order date per customer
{ FIXED [Customer ID] : MIN([Order Date]) }

// Step 2: sales amount on that first order date
{ FIXED [Customer ID] :
    SUM(IF [Order Date] = { FIXED [Customer ID] : MIN([Order Date]) } THEN [Sales] END)
}
```

### Common Use Cases Summary
| Business Question | LOD Pattern |
|---|---|
| Customer cohort / first purchase date | `FIXED [Customer] : MIN([Date])` |
| % of parent category total | `SUM([Sales]) / {EXCLUDE [Sub-Category]: SUM([Sales])}` |
| Average of an aggregate (e.g., avg order value) | `AVG({INCLUDE [Order ID]: SUM([Sales])})` |
| New vs. returning customer flag | Compare `[Order Date]` to `{FIXED [Customer]: MIN([Order Date])}` |

---

## 4. Calculated Fields vs Table Calculations

| Feature | Calculated Field | Table Calculation |
|---|---|---|
| Computed | At the data source/row level | On the aggregated result set in the view |
| Example | `[Profit]/[Sales]` | `RUNNING_SUM(SUM([Sales]))`, `WINDOW_AVG()` |
| Depends on | Data structure | Layout of the view (partitioning/addressing) |

---

## 5. Table Calculation Pattern Library

### Percent of Total
```
SUM([Sales]) / TOTAL(SUM([Sales]))
-- Set "Compute Using" to the dimension you want the % to be relative to (e.g., Table Down)
```

### Running Total
```
RUNNING_SUM(SUM([Sales]))
```

### Moving Average (3-period)
```
WINDOW_AVG(SUM([Sales]), -2, 0)   -- current + 2 previous periods
```

### Rank
```
RANK(SUM([Sales]), 'desc')
-- or RANK_UNIQUE / RANK_DENSE for tie-handling variants
```

### Year-over-Year Growth
```
(SUM([Sales]) - LOOKUP(SUM([Sales]), -1)) / ABS(LOOKUP(SUM([Sales]), -1))
-- LOOKUP(-1) references the prior period in the partition, based on "Compute Using"
```

### Addressing & Partitioning (Critical Concept)
Table calculations depend entirely on **which dimensions are "addressing" (the direction of computation) vs. "partitioning" (the reset boundary)**. E.g., for YoY growth by Region:
- **Addressing**: Year (the calculation moves across years)
- **Partitioning**: Region (calculation resets/restarts for each region)

Get this wrong and running totals/rankings will silently compute across the wrong groups.

---

## 6. Order of Operations (Simplified)

```
1. Data Source Filters
2. Context Filters
3. Dimension Filters (incl. FIXED LODs evaluated here)
4. Measure Filters / INCLUDE-EXCLUDE LODs
5. Table Calculation Filters
```
**Context filters** matter because they run before other filters and affect FIXED LOD results — use them to control filter dependency order. For example, if you want a Top-10-Customers filter to apply only *within* a selected Region filter, make the Region filter a **context filter** first.

---

## 7. Parameters, Sets, and Groups — With Examples

### Parameters — Dynamic Metric Switcher
```
Parameter: "Select Metric" (String) — values: "Sales", "Profit", "Quantity"

Calculated field: "Selected Metric Value"
CASE [Select Metric]
    WHEN "Sales" THEN SUM([Sales])
    WHEN "Profit" THEN SUM([Profit])
    WHEN "Quantity" THEN SUM([Quantity])
END
```
A single chart can now switch between metrics via a parameter control, without duplicating the view.

### Sets — Dynamic Top N Customers
```
Right-click [Customer Name] > Create > Set
Top tab: By Field > Top 10 by SUM(Sales)
```
Use the resulting set in a filter shelf, or combine with an "IN/OUT of Set" calculated field to highlight top customers within a larger view.

### Groups — Simplify a Long Category List
```
Right-click [Sub-Category] > Create > Group
Combine "Bookcases", "Chairs", "Tables" into "Furniture - Heavy"
```

---

## 8. Dashboard Actions — Worked Examples

| Action | Effect | Example |
|---|---|---|
| **Filter Action** | Selecting a mark filters other sheets | Click a region on a map → bar chart filters to that region |
| **Highlight Action** | Selecting a mark highlights related marks elsewhere | Hover a customer in a table → highlights their orders in a scatter plot |
| **URL Action** | Opens a web page/link based on selection | Click a product → opens its page on the company's internal catalog site |
| **Parameter Action** | Selecting a mark updates a parameter value | Click a bar → updates a "Selected Category" parameter used elsewhere |
| **Set Action** | Selecting marks updates set membership dynamically | Click customers on a scatter plot → adds them to a "Selected Customers" set used in a detail table |

### Example: Building a "Click to Drill Down" Interaction
```
1. Create a Filter Action: Source sheet = "Sales by Region" (map)
   Target sheets = "Sales by Product" (bar chart)
   Run action on: Select
   Clearing selection will: Show all values
2. Result: clicking a region on the map filters the bar chart to that region;
   clicking empty space resets the bar chart to show all regions.
```

---

## 9. Performance Best Practices

- Prefer **extracts** over live for large/slow sources; use **extract filters** to reduce size (e.g., only last 3 years of data).
- Use **context filters** sparingly — they force a temp table recompute for every other filter.
- Minimize the number of **marks** rendered per view (aim for a few thousand, not hundreds of thousands).
- Avoid excessive **nested calculations**; simplify calc logic and materialize complex logic upstream in the data source/Prep flow when possible.
- Reduce **quick filters** with "Only Relevant Values" (expensive, requires a query per filter change) when not strictly needed.
- Use **Tableau Prep** or the source DB for heavy transformations rather than in-viz calculations.
- Use the built-in **Performance Recording** (Help > Settings and Performance > Start Performance Recording) to identify slow queries, layout computations, or geocoding steps.
- Reduce the number of **quick filters** and **worksheets** on a single dashboard tab; use tabbed dashboards for large workbooks.

---

## 10. Tableau Prep Pipeline Example

**Scenario:** Combine two CSV exports (Orders and Returns) and clean up before publishing as a data source.

```
[Orders.csv] ──┐
               ├── Join (Left, on Order ID) ── Clean Step (trim whitespace,
[Returns.csv]──┘                                fix data types, rename cols)
                                                       │
                                                       ▼
                                          Calculated Field: "Is Returned" =
                                          IF [Return Reason] IS NOT NULL THEN "Yes" ELSE "No" END
                                                       │
                                                       ▼
                                          Output: Publish to Tableau Server
                                          as "Orders with Returns" data source
```
Prep flows are especially useful for repeatable, visual ETL that doesn't require a full dbt/warehouse setup, and they can be scheduled to run via Tableau Server/Cloud's Prep Conductor.

---

## 11. Server/Cloud Administration

- **Sites → Projects → Workbooks/Data Sources** hierarchy for organization.
- **Permissions** set at project/workbook/data source level (Explorer, Viewer, Creator roles) — use **project-level permission templates** to avoid managing permissions per-workbook.
- **Subscriptions & Alerts** for scheduled delivery and threshold-based notifications (e.g., email when a KPI crosses a limit).
- **Tableau Prep Builder** for visual ETL pipelines feeding published data sources.
- **Content Migration Tool** for moving workbooks/data sources between Server sites (Dev → Prod).
- **Extract Refresh Schedules** managed centrally in the Server/Cloud admin UI — stagger large refreshes to avoid resource contention.

---

## 12. Worked Example: Regional Sales Analysis Workbook

**Requirement:** Build an analytical workbook for regional sales managers to explore sales trends, compare against targets, and drill into customer-level detail — each manager restricted to their own region.

1. **Data Source**: Published extract of `fct_sales` joined to `dim_customer`, `dim_product`, `dim_date`, refreshed nightly (incremental refresh on `OrderDate`).
2. **RLS**: Data source filter joining to `UserAccessMap` on `USERNAME()` (see RLS cheatsheet).
3. **Sheets**:
   - Trend line: `SUM([Sales])` by `[Order Date]` (month), with a **YoY growth** table calculation.
   - Top 10 Customers: a **Set** on `[Customer Name]` filtered to top 10 by Sales.
   - Category Breakdown: `EXCLUDE` LOD to show % of category total per sub-category.
4. **Dashboard Actions**: clicking a month on the trend line filters the Top 10 Customers and Category Breakdown sheets to that month (Filter Action).
5. **Parameters**: a "Select Metric" parameter to toggle between Sales, Profit, and Quantity across all sheets.
6. **Publish**: to a "Regional Sales" project on Tableau Server with Explorer-level permissions for regional managers, Creator for the BI team.

This mirrors the general Tableau workflow: **connect/extract → model relationships → build LODs/calcs for business logic → assemble interactive dashboard → secure via RLS → publish with governed permissions.**
