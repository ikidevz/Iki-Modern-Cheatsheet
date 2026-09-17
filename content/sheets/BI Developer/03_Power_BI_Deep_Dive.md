# ⚡ Power BI Deep Dive — BI Developer Cheatsheet (Deep Dive)

## Table of Contents
1. [Architecture](#1-architecture)
2. [Storage Modes](#2-storage-modes)
3. [DAX Fundamentals](#3-dax-fundamentals)
4. [DAX Pattern Library](#4-dax-pattern-library)
5. [Power Query (M) In Depth](#5-power-query-m-in-depth)
6. [Data Modeling Best Practices](#6-data-modeling-best-practices)
7. [Advanced Modeling: Many-to-Many & Bridge Tables](#7-advanced-modeling-many-to-many--bridge-tables)
8. [Performance Tuning Workflow](#8-performance-tuning-workflow)
9. [Deployment & Governance](#9-deployment--governance)
10. [Worked Example: Building a Sales Analysis Model](#10-worked-example-building-a-sales-analysis-model)

---

## 1. Architecture

```
Power Query (M)  →  Tabular Model (VertiPaq engine)  →  DAX  →  Report Canvas
   (ETL/Shape)         (Compressed columnar store)     (Calc)     (Visuals)
```

- **Power Query (M)**: the transformation engine — loads, shapes, cleans data before it hits the model.
- **VertiPaq**: Power BI's in-memory columnar storage engine. Compresses data column-by-column, uses dictionary encoding for repeated values (great for low-cardinality columns).
- **DAX (Data Analysis Expressions)**: the formula language for measures and calculated columns, evaluated against the Tabular model.
- **Report Canvas**: visuals generate DAX queries under the hood every time a filter/slicer changes.

---

## 2. Storage Modes

| Mode | Engine | Use Case |
|---|---|---|
| Import | VertiPaq (in-memory columnar) | Default; fastest, needs refresh |
| DirectQuery | Pass-through to source | Real-time/huge data, source does the work |
| Live Connection | Connects to existing Power BI/AS model | Reuse of certified enterprise models |
| Dual | Table can act as Import or DirectQuery depending on query | Composite models, dimension tables |

---

## 3. DAX Fundamentals

| Concept | Explanation |
|---|---|
| **Calculated Column** | Computed row-by-row, stored in the model (uses row context) |
| **Measure** | Computed at query time based on filter context (aggregation) |
| **Row Context** | Exists in calculated columns and iterator functions (e.g., `SUMX`) |
| **Filter Context** | Set by slicers, filters, rows/columns in visuals; modified by `CALCULATE` |
| **Context Transition** | Row context converted to filter context inside `CALCULATE`/iterators |

**Golden Rule:** Measures > Calculated Columns when possible (smaller model, dynamic to filter context).

### Understanding Context with an Example

```dax
-- Calculated column (row context: evaluated once per row of the Sales table)
Sales[LineTotal] = Sales[Quantity] * Sales[UnitPrice]

-- Measure (filter context: recalculates based on whatever filters are active)
Total Sales = SUM(Sales[LineTotal])
```
If a user filters to "Region = APAC", the `LineTotal` column doesn't change (it was computed once at refresh time), but `[Total Sales]` recalculates because it responds to the active filter context.

### Context Transition Example
```dax
-- Inside an iterator, each row's context is temporarily turned into a filter
-- context so CALCULATE/measures evaluate correctly for that single row.
Customer Lifetime Value =
SUMX(
    dim_customer,
    CALCULATE([Total Sales])   -- context transition: filters to the current customer row
)
```

---

## 4. DAX Pattern Library

### 4.1 Basic Aggregations
```dax
Total Sales = SUM(Sales[SalesAmount])
Order Count = DISTINCTCOUNT(Sales[OrderID])
Avg Order Value = DIVIDE([Total Sales], [Order Count])
```

### 4.2 Filtered Measures
```dax
Sales APAC = CALCULATE([Total Sales], dim_region[Region] = "APAC")
Sales Excl Returns = CALCULATE([Total Sales], Sales[OrderType] <> "Return")

-- Multiple conditions
Sales APAC Electronics =
CALCULATE(
    [Total Sales],
    dim_region[Region] = "APAC",
    dim_product[Category] = "Electronics"
)
```

### 4.3 ALL / ALLEXCEPT / ALLSELECTED
```dax
-- % of total regardless of any filters
% of Grand Total = DIVIDE([Total Sales], CALCULATE([Total Sales], ALL(Sales)))

-- Keep Region filter but remove Product filter
Sales Ignoring Product = CALCULATE([Total Sales], ALLEXCEPT(dim_product, dim_product[Category]))

-- Respect user's slicer selections but ignore visual-level filters (e.g., for a "% of subtotal shown" calc)
% of Visible Total = DIVIDE([Total Sales], CALCULATE([Total Sales], ALLSELECTED()))
```

### 4.4 Time Intelligence
```dax
Sales YTD = TOTALYTD([Total Sales], 'Date'[Date])
Sales MTD = TOTALMTD([Total Sales], 'Date'[Date])
Sales QTD = TOTALQTD([Total Sales], 'Date'[Date])

Sales PY = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Date'[Date]))
Sales PY MTD = CALCULATE([Total Sales], DATEADD('Date'[Date], -1, YEAR))

YoY Growth % = DIVIDE([Total Sales] - [Sales PY], [Sales PY])

-- Rolling 12-month total
Sales Rolling 12M =
CALCULATE(
    [Total Sales],
    DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -12, MONTH)
)

-- Moving average (3-month)
Sales Moving Avg 3M =
AVERAGEX(
    DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -3, MONTH),
    [Total Sales]
)
```

### 4.5 Ranking & Top N
```dax
Sales Rank = RANKX(ALL(dim_product[ProductName]), [Total Sales])

-- Dynamic Top N with a "show top N" parameter
Top N Sales =
VAR TopN = SELECTEDVALUE('TopN Parameter'[Value], 10)
VAR CurrentRank = [Sales Rank]
RETURN
    IF(CurrentRank <= TopN, [Total Sales])
```

### 4.6 Variance & What-If Analysis
```dax
-- What-if parameter: "Price Increase %"
Price Increase % = GENERATESERIES(0, 0.2, 0.01)   -- 0% to 20% in 1% steps (What-If Parameter)

Adjusted Revenue =
VAR IncreasePct = SELECTEDVALUE('Price Increase %'[Price Increase % Value], 0)
RETURN [Total Sales] * (1 + IncreasePct)

Variance to Budget = [Total Sales] - [Budget Amount]
Variance % = DIVIDE([Variance to Budget], [Budget Amount])
```

### 4.7 Iterators (Row-by-Row then Aggregate)
```dax
Weighted Avg Price = SUMX(Sales, Sales[Qty] * Sales[UnitPrice]) / SUM(Sales[Qty])

-- Count of distinct customers who bought more than $1000
High Value Customers =
COUNTROWS(
    FILTER(
        VALUES(dim_customer[CustomerID]),
        CALCULATE([Total Sales]) > 1000
    )
)
```

### 4.8 Dynamic RLS Lookup (see RLS cheatsheet for full context)
```dax
Region Filter = LOOKUPVALUE(UserAccessMap[Region], UserAccessMap[Email], USERPRINCIPALNAME())
```

### 4.9 Handling Blanks & Divide-by-Zero
```dax
Safe Ratio = DIVIDE([Numerator Measure], [Denominator Measure], 0)  -- returns 0 instead of erroring
Sales or Zero = COALESCE([Total Sales], 0)
```

---

## 5. Power Query (M) In Depth

### 5.1 Query Folding
Query folding means Power Query translates your steps into native queries (SQL) executed **at the source**, instead of pulling all data first and transforming locally. Check via right-click a step → **"View Native Query"**. If greyed out, folding has broken at that step (often caused by custom M functions, `Table.Buffer`, or certain type conversions applied too early).

```m
let
    Source = Sql.Database("server", "db"),
    Filtered = Table.SelectRows(Source, each [OrderDate] >= #date(2024,1,1)),  -- folds to WHERE clause
    Renamed = Table.RenameColumns(Filtered, {{"Amt", "SalesAmount"}})          -- folds fine
in
    Renamed
```

### 5.2 Parameters for Environment-Agnostic Connections
```m
// Parameter: ServerName (text), DatabaseName (text)
let
    Source = Sql.Database(ServerName, DatabaseName)
in
    Source
```
Swap `ServerName`/`DatabaseName` values between Dev/Test/Prod without editing every query.

### 5.3 Merge (Join) and Append (Union)
```m
// Merge = JOIN
let
    Orders = Source{[Item="Orders"]}[Data],
    Customers = Source{[Item="Customers"]}[Data],
    Merged = Table.NestedJoin(Orders, {"CustomerID"}, Customers, {"CustomerID"}, "CustomerDetails", JoinKind.LeftOuter),
    Expanded = Table.ExpandTableColumn(Merged, "CustomerDetails", {"CustomerName", "Region"})
in
    Expanded

// Append = UNION of two tables with the same schema
let
    Combined = Table.Combine({Orders2023, Orders2024})
in
    Combined
```

### 5.4 Custom Function Example
```m
// A reusable function to clean phone numbers
(PhoneNumber as text) as text =>
let
    Cleaned = Text.Select(PhoneNumber, {"0".."9"})
in
    Cleaned

// Applied to a column:
Table.TransformColumns(Source, {{"Phone", CleanPhoneNumber, type text}})
```

### 5.5 Error Handling
```m
let
    Source = Excel.Workbook(File.Contents(FilePath)),
    SafeExtract = try Source{[Item="Sheet1"]}[Data] otherwise #table({}, {})
in
    SafeExtract
```

### 5.6 Incremental Refresh Setup (M requirements)
```m
// RangeStart and RangeEnd parameters (datetime type) are required
let
    Source = Sql.Database("server", "db"),
    Filtered = Table.SelectRows(Source, each [OrderDate] >= RangeStart and [OrderDate] < RangeEnd)
in
    Filtered
```

---

## 6. Data Modeling Best Practices

- Build a **star schema**: fact tables (transactions) + dimension tables (descriptive attributes).
- Set relationship cardinality correctly (usually **one-to-many**, single direction).
- Avoid **bi-directional filtering** unless necessary (causes ambiguity, performance cost).
- Hide foreign keys and technical columns from report view.
- Mark a proper **Date table** (`Mark as Date Table`) for time intelligence functions to work.
- Use **surrogate keys** (integer IDs) for relationships instead of natural keys (strings) — smaller, faster joins.
- Set default **summarization** and **data category** (e.g., "Country/Region" for geo fields) on columns to guide report authors.

---

## 7. Advanced Modeling: Many-to-Many & Bridge Tables

**Scenario:** A single bank account can have multiple account holders, and one person can hold multiple accounts.

```
dim_customer  ──┐
                ├──  bridge_account_holder (CustomerID, AccountID)  ──┐
dim_account   ──┘                                                     ├── fct_transactions
```

```dax
-- Measure automatically respects the bridge table relationship
Total Transactions by Customer =
CALCULATE(
    SUM(fct_transactions[Amount]),
    bridge_account_holder
)
```
Set both relationships from `bridge_account_holder` to `dim_customer` and `dim_account` as **one-to-many**, avoiding a direct many-to-many relationship on the fact table itself where possible — it's more transparent and performs better.

---

## 8. Performance Tuning Workflow

| Tool | Purpose |
|---|---|
| **Performance Analyzer** (in Desktop) | Measure visual render/query time per visual on a page |
| **DAX Studio** | Query timing, server timings, query plans, view generated SQL for DirectQuery |
| **VertiPaq Analyzer** | Column cardinality, table size, compression ratio |
| **Tabular Editor** | Bulk metadata edits, best-practice rule checks (BPA), OLS |

### Step-by-Step Tuning Process
1. **Baseline** — run Performance Analyzer, note slowest visuals (>1 second is worth investigating).
2. **Isolate** — copy the slow visual's DAX query into DAX Studio, run with "Server Timings" enabled.
3. **Diagnose** — check the split between **Formula Engine (FE)** time vs. **Storage Engine (SE)** time. High FE time usually means DAX logic is inefficient (e.g., row-by-row iteration); high SE time usually means the model needs aggregations or the column has high cardinality.
4. **Fix** — common fixes:
   - Replace nested `CALCULATE` + `FILTER(ALL(...))` patterns with `KEEPFILTERS` or simpler boolean filters.
   - Add **variables (`VAR`)** to avoid recomputation of the same sub-expression.
   - Reduce cardinality (e.g., split a DateTime column into Date + Time).
   - Add **aggregation tables** for DirectQuery models on large fact tables.
5. **Re-test** — confirm improvement with Performance Analyzer again.

### Tips
- Reduce **cardinality** of high-distinct-value columns (e.g., don't import a GUID column unless needed).
- Avoid unnecessary calculated columns; prefer measures.
- Use **variables (`VAR`)** in DAX to avoid repeated evaluation of the same expression.
- Limit visuals per page; too many visuals = too many DAX queries generated per render.
- Use **aggregation tables** for big fact tables with DirectQuery.

---

## 9. Deployment & Governance

- **Workspaces** → **Apps** for structured distribution to business users.
- **Deployment Pipelines** (Dev → Test → Prod) for controlled promotion, with rules to swap data sources per stage.
- **Gateways** (On-premises data gateway) for on-prem source refresh in Import/DirectQuery scenarios.
- **Dataset certification/endorsement** to mark trusted, single-source-of-truth models — encourages reuse instead of duplicate datasets.
- **Sensitivity labels** (Microsoft Purview integration) for data classification and DLP.
- **Shared/Certified datasets**: build reports on top of an existing certified dataset ("Live Connection") instead of creating a new one, to avoid semantic drift.

---

## 10. Worked Example: Building a Sales Analysis Model

**Step 1 — Load & shape in Power Query:**
```m
// stg_sales query
let
    Source = Sql.Database("prodserver", "SalesDB"),
    Filtered = Table.SelectRows(Source{[Schema="dbo",Item="Sales"]}[Data], each [OrderDate] >= #date(2022,1,1)),
    RenamedCols = Table.RenameColumns(Filtered, {{"Amt", "SalesAmount"}}),
    TypedCols = Table.TransformColumnTypes(RenamedCols, {{"SalesAmount", type number}, {"OrderDate", type date}})
in
    TypedCols
```

**Step 2 — Model relationships:**
```
dim_date (1) ───< (∞) fct_sales
dim_product (1) ───< (∞) fct_sales
dim_customer (1) ───< (∞) fct_sales
dim_region (1) ───< (∞) dim_customer
```

**Step 3 — Core measures:**
```dax
Total Sales = SUM(fct_sales[SalesAmount])
Sales YTD = TOTALYTD([Total Sales], dim_date[Date])
Sales PY = CALCULATE([Total Sales], SAMEPERIODLASTYEAR(dim_date[Date]))
YoY Growth % = DIVIDE([Total Sales] - [Sales PY], [Sales PY])
```

**Step 4 — Apply RLS (see RLS cheatsheet), certify the dataset, publish to a Power BI App.**

This mirrors the recommended flow: **shape → model → measure → secure → govern → distribute.**
