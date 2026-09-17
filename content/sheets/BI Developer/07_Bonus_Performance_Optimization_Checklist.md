# 🚀 Bonus: Performance Optimization Checklist — BI Developer Cheatsheet (Deep Dive)

Use this checklist when a dashboard or data model is running slow. Each item includes why it matters and a concrete example.

## Table of Contents
1. [Model-Level Optimizations](#1-model-level-optimizations)
2. [Refresh & Data Pipeline Optimizations](#2-refresh--data-pipeline-optimizations)
3. [Report/Visual-Level Optimizations](#3-reportvisual-level-optimizations)
4. [Diagnostic Tools by Platform](#4-diagnostic-tools-by-platform)
5. [Full Diagnostic Workflow](#5-full-diagnostic-workflow)

---

## 1. Model-Level Optimizations

### Reduce Column Cardinality
**Why:** High-cardinality columns (many unique values) compress poorly in columnar engines like VertiPaq and Hyper, bloating model size and slowing scans.
```
Bad:  OrderDateTime (2024-05-01 14:32:07.123) — millions of unique values
Good: OrderDate (2024-05-01) + OrderTime (14:32) — split into two lower-cardinality columns
```

### Avoid Unnecessary Bi-Directional Relationships
**Why:** Bi-directional filters can create ambiguous filter paths and force the engine to evaluate more filter combinations than needed.
```
Prefer: dim_region (1) --> (∞) fct_sales   [single direction]
Avoid:  dim_region (1) <--> (∞) fct_sales  [bi-directional, unless truly required for a specific many-to-many scenario]
```

### Pre-Aggregate at the Right Grain
**Why:** If most reports only ever need daily/regional summaries, importing every individual transaction row wastes memory and slows queries.
```sql
-- Aggregation table example
CREATE TABLE agg_sales_daily AS
SELECT order_date, region, product_category,
       SUM(sales_amount) AS total_sales,
       SUM(quantity) AS total_qty
FROM fct_sales
GROUP BY order_date, region, product_category;
```
In Power BI, register this as an **Aggregation table** so detail-level queries fall back to `fct_sales` only when needed (e.g., a drill-through to line-item detail).

### Use Surrogate Integer Keys for Relationships
**Why:** Integer joins are faster and compress better than string/GUID joins.
```
Bad:  fct_sales.customer_email (VARCHAR) --> dim_customer.email (VARCHAR)
Good: fct_sales.customer_key (INT)       --> dim_customer.customer_key (INT)
```

---

## 2. Refresh & Data Pipeline Optimizations

### Use Incremental Refresh on Large Fact Tables
**Why:** Reloading years of historical data every refresh cycle wastes time and compute when only recent rows actually change.
```
Power BI Incremental Refresh Policy Example:
- Archive rows older than 3 years (not refreshed)
- Refresh only the last 10 days of data each run
- Partitioned automatically by month
```

### Push Transformations to the Source (Query Folding / ELT)
**Why:** Filtering/aggregating in the source database (which has indexes, parallelism, and often more compute) is faster than pulling raw rows and transforming client-side.
```m
// This folds to a native WHERE clause when the source supports it —
// check via "View Native Query" in Power Query
Table.SelectRows(Source, each [OrderDate] >= #date(2024,1,1))
```

### Schedule Refreshes During Off-Peak Hours
**Why:** Avoids resource contention with source systems during business hours and reduces the chance of timeout failures on large loads.

### Archive/Partition Historical Data No Longer Needed at Full Grain
**Why:** Keeps the "hot" dataset small and fast; historical detail can live in cheaper storage and be queried on-demand if truly needed.

---

## 3. Report/Visual-Level Optimizations

### Limit Visuals Per Dashboard Page
**Why:** Each visual typically triggers its own query. A page with 20 visuals can mean 20+ parallel/sequential queries hitting the model on every filter change.
```
Instead of: One page with 15 charts and 5 slicers
Prefer:     Overview page (4-6 key visuals) + drill-through detail pages
```

### Test With Realistic Data Volumes
**Why:** A model that performs fine with 10,000 sample rows in Dev can completely break down with 50 million rows in Prod. Always test performance against production-scale data (or a representative sample) before go-live.

### Reduce Table Calculation / DAX Complexity in the Visual Layer
**Why:** Complex nested calculations evaluated per-visual (rather than once in the semantic layer) get recomputed on every interaction.
```dax
-- Prefer a single well-optimized measure with VAR
Profit Margin % =
VAR TotalRevenue = [Total Sales]
VAR TotalCost = [Total Cost]
RETURN DIVIDE(TotalRevenue - TotalCost, TotalRevenue)
```

### Turn Off "Only Relevant Values" on Filters When Not Needed (Tableau)
**Why:** This setting forces a new query every time a filter changes, to compute what's "relevant" — expensive on large data sources.

---

## 4. Diagnostic Tools by Platform

| Platform | Tool | What It Shows |
|---|---|---|
| Power BI | **Performance Analyzer** | Per-visual render/query time on a page |
| Power BI | **DAX Studio** | Query timing, Server Timings (Formula Engine vs Storage Engine split), query plans |
| Power BI | **VertiPaq Analyzer** | Table/column size, cardinality, compression ratio |
| Power BI | **Tabular Editor (BPA)** | Best-practice rule violations (e.g., unused columns, bi-directional relationships) |
| Tableau | **Performance Recording** | Query time, layout computation time, geocoding time per event |
| Tableau | **Extract/Data Source Optimizations panel** | Extract size, hidden fields, aggregation opportunities |
| SQL Warehouse | **EXPLAIN / EXPLAIN ANALYZE** | Query execution plan, index usage, row estimates |

---

## 5. Full Diagnostic Workflow

```
1. Identify the slow report/page (user complaint, or Performance Analyzer/Recording baseline)
2. Isolate the slowest visual/query
3. Run the underlying query in DAX Studio (Power BI) or Performance Recording (Tableau)
4. Classify the bottleneck:
   ├── Formula Engine (FE) heavy → DAX/calc logic issue → simplify expression, use VAR, avoid
   │                                 iterators over large tables
   └── Storage Engine (SE) heavy → data volume/model issue → reduce cardinality, add
                                     aggregation tables, partition data
5. Apply the targeted fix
6. Re-measure to confirm improvement
7. Document the change (what was slow, what fixed it) for future reference
```

### Checklist Summary
- [ ] Reduce column **cardinality**
- [ ] Use **incremental refresh** on large fact tables
- [ ] Push transformations to the **source**
- [ ] Avoid unnecessary **bi-directional relationships**
- [ ] Pre-aggregate at the right **grain**
- [ ] Limit **visuals per dashboard page**
- [ ] Test with **realistic data volumes**
- [ ] Monitor with native diagnostic tools
- [ ] Cache/schedule refreshes during **off-peak hours**
- [ ] Archive/partition historical data no longer needed at full grain
