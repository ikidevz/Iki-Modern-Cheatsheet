# Excel & Google Sheets Cheatsheet for Data & Analytics

> A side-by-side reference for spreadsheet-based analytics work — formula syntax, lookups, pivoting, data connections, and automation in both Excel and Google Sheets, with the differences called out wherever they trip people up.

## 📑 Table of Contents

1. [🧮 Core Concepts: Workbooks, Sheets & References](#core-concepts-workbooks-sheets-references)
2. [🔍 Lookup Functions](#lookup-functions)
3. [🎯 Conditional & Aggregation Functions](#conditional-aggregation-functions)
4. [🔤 Text Functions](#text-functions)
5. [📅 Date & Time Functions](#date-time-functions)
6. [🧩 Array & Dynamic Array Functions](#array-dynamic-array-functions)
7. [🧹 Data Cleaning & Validation](#data-cleaning-validation)
8. [📊 PivotTables / Pivot Tables](#pivottables-pivot-tables)
9. [🔗 Importing & Connecting External Data](#importing-connecting-external-data)
10. [⚙️ Power Query vs. Sheets QUERY/IMPORT Functions](#power-query-vs-sheets-query-import-functions)
11. [🧠 Power Pivot & DAX vs. Sheets Alternatives](#power-pivot-dax-vs-sheets-alternatives)
12. [📈 Charts & Conditional Formatting](#charts-conditional-formatting)
13. [🤝 Collaboration & Version Control](#collaboration-version-control)
14. [🤖 Automation: VBA vs. Google Apps Script](#automation-vba-vs-google-apps-script)
15. [⌨️ Keyboard Shortcuts](#keyboard-shortcuts)
16. [📚 Excel vs. Google Sheets: Function & Feature Comparison](#excel-vs-google-sheets-function-feature-comparison)
17. [📏 Scale & Performance Limits](#scale-performance-limits)
18. [🔐 Security & Sharing](#security-sharing)
19. [⚠️ Common Gotchas](#common-gotchas)
20. [🎯 Best Practices for Analysts](#best-practices-for-analysts)
21. [💡 Pro Tips](#pro-tips)
22. [💰 Financial & Statistical Functions](#financial-statistical-functions)
23. [🎛️ What-If Analysis & Optimization](#what-if-analysis-optimization)
24. [📊 Advanced PivotTable Techniques](#advanced-pivottable-techniques)
25. [🖱️ Form Controls & Interactive Spreadsheet Dashboards](#form-controls-interactive-spreadsheet-dashboards)
26. [🤖 Advanced Apps Script & VBA](#advanced-apps-script-vba)
27. [📚 Worked Examples Across Business Scenarios](#worked-examples-across-business-scenarios)

## ⚡ Quick Reference

**Formula syntax cheatsheet**

| Task                     | Excel                                              | Google Sheets                                          |
| ------------------------ | --------------------------------------------------- | -------------------------------------------------------- |
| Modern lookup             | `=XLOOKUP(val, lookup_rng, return_rng)`             | `=XLOOKUP(val, lookup_rng, return_rng)`                  |
| Conditional sum           | `=SUMIFS(sum_rng, crit_rng1, crit1, ...)`           | `=SUMIFS(sum_rng, crit_rng1, crit1, ...)`                |
| Spill an array            | `=UNIQUE(FILTER(A2:A100, B2:B100="Open"))`          | `=UNIQUE(FILTER(A2:A100, B2:B100="Open"))`               |
| SQL-style query           | *(no native equivalent — use Power Query/Tables)*  | `=QUERY(A1:D, "select A, sum(D) where B='X' group by A")` |
| Pull external range       | *(Power Query / external workbook links)*           | `=IMPORTRANGE("sheet_url", "Sheet1!A1:D")`                |
| Named ranges              | Formulas → Define Name                              | Data → Named ranges                                       |
| Reusable custom function  | LAMBDA + Name Manager, or VBA `Function`             | `=LAMBDA(...)` + named function, or Apps Script           |
| Data source refresh       | Data → Refresh All (Power Query/Pivot)               | Data → Data connectors, or `IMPORTDATA`/`IMPORTRANGE`     |
| Macro / scripting         | VBA (`Alt+F11`), Office Scripts (web)                | Apps Script (Extensions → Apps Script), JavaScript-based  |
| Absolute reference        | `$A$1` (toggle with `F4`)                            | `$A$1` (toggle with `Ctrl+Y` / `Cmd+Y` after typing `F4` doesn't work — retype `$`) |

**Where each tool wins**

| Strength                                   | Excel                     | Google Sheets            |
| ------------------------------------------- | -------------------------- | -------------------------- |
| Offline, large-file, heavy computation      | ✅ (1M+ rows, Power Pivot)  | ⚠️ (slows well before 1M) |
| Real-time multi-user co-editing             | ⚠️ (needs OneDrive/SP)     | ✅ native                   |
| SQL-like ad hoc querying without add-ins    | ❌                          | ✅ `QUERY()`                |
| Pulling data from another live spreadsheet  | ⚠️ (linked workbooks, brittle) | ✅ `IMPORTRANGE`        |
| In-cell array/dynamic spill formulas        | ✅ (2019+/365)              | ✅                          |
| Enterprise data modeling (star schema)      | ✅ Power Pivot/Power BI tie-in | ⚠️ limited              |
| Free, browser-only access                   | ⚠️ (Excel Online, reduced) | ✅                          |
| Scripting with modern JS ecosystem          | ❌ (VBA is dated)           | ✅ Apps Script (V8 JS)      |

## 🧮 Core Concepts: Workbooks, Sheets & References

```text
Excel                                   Google Sheets
─────                                   ──────────────
Workbook (.xlsx) → Worksheets           Spreadsheet (Sheets file) → Sheets
Cell: A1                                 Cell: A1
Relative ref: A1                         Relative ref: A1
Absolute ref: $A$1                       Absolute ref: $A$1
Mixed ref: $A1 or A$1                    Mixed ref: $A1 or A$1
Cross-sheet: Sheet2!A1                   Cross-sheet: Sheet2!A1
Cross-workbook: [Book2.xlsx]Sheet1!A1    Cross-file: IMPORTRANGE() only
Table object: Insert → Table (Ctrl+T)    "Named range" + banded rows (no real Table object until recent smart-fill features)
```

Excel Tables (`Ctrl+T`) give you structured references (`=Table1[Revenue]`), auto-expanding ranges, and automatic formula fill-down — there's no direct Google Sheets equivalent, though named ranges + `ARRAYFORMULA` cover some of the same ground.

```
=SUM(Table1[Revenue])              ' Excel structured reference
=SUM(FILTER(Revenue, Region="US")) ' Sheets: closest equivalent pattern
```

## 🔍 Lookup Functions

```
' XLOOKUP — the modern default in both tools (Excel 365+, all current Sheets)
=XLOOKUP(F2, A:A, C:C, "Not found", 0)          ' exact match, custom "not found"
=XLOOKUP(F2, A:A, C:C, , 0, -1)                 ' search bottom-to-top

' VLOOKUP — still everywhere in legacy files; approximate match is the classic bug source
=VLOOKUP(F2, A:D, 3, FALSE)                     ' FALSE/0 = exact match (almost always what you want)
=VLOOKUP(F2, A:D, 3, TRUE)                      ' TRUE = approximate — requires sorted lookup column

' INDEX/MATCH — pre-XLOOKUP standard, still the most flexible (works left-lookup, 2D lookup)
=INDEX(C:C, MATCH(F2, A:A, 0))
=INDEX(A:D, MATCH(F2, A:A, 0), MATCH("Revenue", A1:D1, 0))   ' 2D lookup by row + column

' HLOOKUP — horizontal version, rare in practice
=HLOOKUP(F2, A1:Z2, 2, FALSE)

' Multiple criteria lookup
=INDEX(D:D, MATCH(1, (A:A=F2)*(B:B=G2), 0))     ' array-entered (Ctrl+Shift+Enter in old Excel)
=XLOOKUP(F2&G2, A:A&B:B, D:D)                   ' concatenated-key XLOOKUP, works in both

' Sheets-only: QUERY as a lookup engine
=QUERY(A:D, "select D where A='"&F2&"' and B='"&G2&"'", 0)
```

## 🎯 Conditional & Aggregation Functions

```
=SUMIF(A:A, "West", C:C)                        ' single condition
=SUMIFS(C:C, A:A, "West", B:B, ">="&DATE(2026,1,1))  ' multiple conditions (AND)
=COUNTIFS(A:A, "West", B:B, "<>")                ' count with multiple conditions
=AVERAGEIFS(C:C, A:A, "West", D:D, "Open")
=MAXIFS(C:C, A:A, "West")  /  =MINIFS(C:C, A:A, "West")

' SUMPRODUCT — the pre-SUMIFS Swiss-army knife, still needed for OR logic
=SUMPRODUCT((A:A="West")+(A:A="East"), C:C)      ' sum where region is West OR East

' Aggregate with visible-only rows (filtered data)
=SUBTOTAL(109, C2:C100)                          ' 109 = SUM ignoring filtered/hidden rows
=AGGREGATE(9, 5, C2:C100)                        ' Excel-only, more error-handling options

' Google Sheets-only shortcut for grouped aggregation
=QUERY(A:D, "select A, sum(C) group by A order by sum(C) desc")
```

## 🔤 Text Functions

```
=CONCATENATE(A1, " ", B1)      ' or the newer =A1&" "&B1 / =TEXTJOIN(" ", TRUE, A1:B1)
=TEXTJOIN(", ", TRUE, A1:A10)  ' TRUE = ignore blanks
=LEFT(A1, 3)  =RIGHT(A1, 4)  =MID(A1, 2, 5)
=TRIM(A1)                      ' strip leading/trailing/repeated spaces
=CLEAN(A1)                     ' strip non-printing characters
=UPPER(A1) / =LOWER(A1) / =PROPER(A1)
=SUBSTITUTE(A1, "-", "")       ' replace all occurrences
=REPLACE(A1, 1, 3, "XXX")      ' replace by position
=FIND("@", A1)                 ' case-sensitive position; errors if not found
=SEARCH("@", A1)               ' case-insensitive position; errors if not found
=TEXTSPLIT(A1, ",")            ' Excel 365 — split into spilled columns
=SPLIT(A1, ",")                ' Sheets equivalent
=TEXTBEFORE(A1, "@") / =TEXTAFTER(A1, "@")   ' Excel 365
=REGEXEXTRACT(A1, "\d+")       ' Sheets-only native regex (no REGEX* functions in Excel)
=REGEXMATCH(A1, "^\d{3}-\d{4}$")
=REGEXREPLACE(A1, "[^0-9]", "")
```

## 📅 Date & Time Functions

```
=TODAY()  =NOW()
=DATE(2026, 9, 15)
=YEAR(A1) / =MONTH(A1) / =DAY(A1) / =WEEKDAY(A1, 2)   ' 2 = Mon=1..Sun=7
=EOMONTH(A1, 0)                 ' last day of A1's month; EOMONTH(A1, 1) = next month
=EDATE(A1, 3)                   ' add 3 months
=DATEDIF(A1, B1, "Y")           ' full years between dates (undocumented but works in both)
=NETWORKDAYS(A1, B1)            ' business days, excludes weekends
=NETWORKDAYS.INTL(A1, B1, 1, holidays_range)   ' custom weekend pattern + holiday list
=WORKDAY(A1, 10)                ' date 10 business days after A1
=DATEVALUE("2026-09-15")        ' text → serial date
=TEXT(A1, "yyyy-mm-dd")         ' date → formatted text
```

**Serial date gotcha:** both tools store dates as a day count from an epoch (Excel: Jan 1, 1900; Sheets: Dec 30, 1899 — one day apart, so cross-tool date math on raw serials can be off by a day if you're not careful with formatted values).

## 🧩 Array & Dynamic Array Functions

```
=UNIQUE(A2:A100)                                ' distinct values, spills down
=SORT(A2:B100, 2, FALSE)                        ' sort by column 2, descending
=SORTBY(A2:A100, B2:B100, -1)                   ' sort A by a separate key range B
=FILTER(A2:D100, C2:C100="Open")                ' rows matching a condition
=SEQUENCE(10)                                   ' 1..10 spilled down
=SEQUENCE(3, 4, 1, 1)                           ' 3x4 grid starting at 1, step 1
=LET(x, A1*2, y, B1*3, x+y)                     ' name intermediate values in one formula
=LAMBDA(x, y, x+y)                              ' reusable custom function (define via Name Manager in Excel)
=MAP(A2:A10, LAMBDA(x, x*1.1))                  ' apply a lambda across a range
=REDUCE(0, A2:A10, LAMBDA(acc, x, acc+x))       ' fold/accumulate
=BYROW(A2:C10, LAMBDA(row, SUM(row)))           ' row-wise aggregation
=ARRAYFORMULA(A2:A100*B2:B100)                  ' Sheets-only: force any formula to operate on a whole range
```

`ARRAYFORMULA` has no direct Excel equivalent because modern Excel spills natively — a plain `=A2:A100*B2:B100` in one cell already spills without a wrapper. In Sheets, most non-array functions need `ARRAYFORMULA` to broadcast over a range.

## 🧹 Data Cleaning & Validation

```
=IFERROR(A1/B1, 0)              ' catch #DIV/0! and other errors
=IFNA(VLOOKUP(...), "Missing")  ' catch #N/A specifically
=ISBLANK(A1) / =ISNUMBER(A1) / =ISTEXT(A1) / =ISERROR(A1)
=TRIM(CLEAN(SUBSTITUTE(A1, CHAR(160), " ")))   ' strip non-breaking spaces + whitespace + junk chars
```

**Data Validation (Excel: Data → Data Validation; Sheets: Data → Data validation)**

```text
Excel: dropdown list, whole number/decimal range, date range, text length, custom formula
Sheets: dropdown (list from range or items), checkbox, number/date/text criteria, custom formula
Both support: reject invalid input vs. show a warning, input/error messages
```

Remove duplicates: Excel — Data → Remove Duplicates; Sheets — Data → Data cleanup → Remove duplicates (or `=UNIQUE()` for a non-destructive version).

## 📊 PivotTables / Pivot Tables

```text
Excel: Insert → PivotTable → drag fields into Rows/Columns/Values/Filters
       - Value field settings: Sum, Count, Average, % of Column Total, Running Total, Rank
       - Group dates: right-click → Group → Months/Quarters/Years
       - Calculated field: PivotTable Analyze → Fields, Items & Sets → Calculated Field
       - Slicers & Timelines for interactive filtering, can connect one slicer to multiple pivots

Sheets: Insert → Pivot table → same Rows/Columns/Values/Filters model
       - Summarize by: SUM/COUNTA/AVERAGE/MIN/MAX/... plus "Show as % of" options
       - Calculated field: Add field → Calculated field (uses SUMIFS-style logic)
       - No native slicers-on-pivots equivalent to Excel Slicers, but Filter views serve a similar role
```

Both support pivoting off a Table/named range so the pivot auto-expands when new rows are added — set this up once rather than re-selecting the source range every refresh.

## 🔗 Importing & Connecting External Data

```
' Google Sheets
=IMPORTRANGE("https://docs.google.com/spreadsheets/d/XXXX", "Sheet1!A1:D100")  ' live pull from another Sheet
=IMPORTDATA("https://example.com/data.csv")     ' pull a public CSV/TSV by URL
=IMPORTHTML("https://example.com/page", "table", 1)  ' scrape an HTML table
=IMPORTXML("https://example.com/page", "//div[@class='price']")  ' XPath scrape
' Sheets: Extensions → connected sheets links directly to BigQuery for query-in-place access

' Excel
Data → Get Data → From File / From Database / From Web / From Online Services
Data → Existing Connections → refresh linked workbook / ODBC / OLE DB sources
Data → Refresh All   ' re-pull every connection + recalc every pivot fed by them
```

`IMPORTRANGE` requires a one-time manual authorization click the first time each source sheet is referenced — a common "why is my formula showing #REF!" moment for new collaborators.

## ⚙️ Power Query vs. Sheets QUERY/IMPORT Functions

Power Query (Excel's Get & Transform, M language) is a full ETL layer with a step-by-step applied-steps pane; Sheets has no direct equivalent — its `QUERY()` function is closer to inline SQL than a reusable pipeline.

```m
// Power Query M — filter, add column, group — recorded as UI steps, editable as code
let
    Source = Csv.Document(File.Contents("C:\data\sales.csv")),
    Promoted = Table.PromoteHeaders(Source),
    Filtered = Table.SelectRows(Promoted, each [Region] = "West"),
    Added = Table.AddColumn(Filtered, "Margin", each [Revenue] - [Cost]),
    Grouped = Table.Group(Added, {"Category"}, {{"Total", each List.Sum([Revenue]), type number}})
in
    Grouped
```

```
' Google Sheets QUERY — SQL-like syntax, one formula, no reusable pipeline
=QUERY(Sales!A:F, "select C, sum(D) where B='West' group by C order by sum(D) desc label sum(D) 'Total'", 1)
```

## 🧠 Power Pivot & DAX vs. Sheets Alternatives

Power Pivot adds an in-workbook data model (multiple related tables, DAX measures, millions of rows) — Sheets has no built-in equivalent; the closest options are `QUERY()` across ranges, Apps Script, or connecting the sheet to BigQuery/Looker Studio for real modeling. See the separate **Power BI / DAX Cheatsheet** for full DAX syntax — the same measure language works inside Excel's Power Pivot.

```
' Power Pivot DAX measure, written in the Excel data model
Total Revenue := SUM(Sales[Revenue])
YoY Growth := DIVIDE([Total Revenue] - CALCULATE([Total Revenue], SAMEPERIODLASTYEAR('Date'[Date])), CALCULATE([Total Revenue], SAMEPERIODLASTYEAR('Date'[Date])))
```

## 📈 Charts & Conditional Formatting

```text
Both: Insert → Chart, choose type, bind to a range/Table
Excel: chart types include Combo, Waterfall, Funnel, Treemap, Sunburst, Box & Whisker, Map charts
Sheets: chart types include most standard ones + Geo chart, Org chart, native Sparkline via =SPARKLINE()

Conditional formatting rules (both): color scale, data bar, icon set, custom formula rule
=$C2<0                          ' custom-formula CF rule: highlight negative values (applied to a range starting at C2)
```

`=SPARKLINE(A2:L2)` gives Sheets an in-cell mini-chart with no setup; Excel's closest equivalent is Insert → Sparklines, which lives in the cell but isn't a formula.

## 🤝 Collaboration & Version Control

```text
Google Sheets: real-time co-editing by default, cell-level edit history (File → Version history),
               comments/suggestions like a Doc, protected ranges (Data → Protected sheets and ranges)

Excel: co-editing requires the file to live in OneDrive/SharePoint (Excel Online or desktop with AutoSave on),
       version history via OneDrive/SharePoint, sheet/range protection (Review → Protect Sheet/Workbook),
       Track Changes exists but is legacy and limited compared to Sheets' native history
```

## 🤖 Automation: VBA vs. Google Apps Script

```vba
' Excel VBA — event-driven macro, runs inside the workbook
Sub RefreshAndExport()
    ThisWorkbook.RefreshAll
    Application.Wait Now + TimeValue("0:00:03")
    ActiveSheet.ExportAsFixedFormat Type:=xlTypePDF, Filename:="C:\out\report.pdf"
End Sub
```

```javascript
// Google Apps Script — JavaScript (V8 runtime), runs on Google's servers
function refreshAndEmail() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Report");
  const pdf = DriveApp.getFileById(ss.getId()).getAs("application/pdf");
  MailApp.sendEmail("team@example.com", "Weekly report", "See attached", {attachments: [pdf]});
}

// Time-driven trigger, set from Triggers panel or code
function createTrigger() {
  ScriptApp.newTrigger('refreshAndEmail').timeBased().everyDays(1).atHour(7).create();
}
```

Office Scripts (TypeScript-based, browser-only, works with Power Automate) is Microsoft's newer answer to Apps Script for cloud automation, separate from classic desktop VBA.

## ⌨️ Keyboard Shortcuts

| Action                     | Excel (Win)     | Excel (Mac)        | Google Sheets            |
| --------------------------- | ---------------- | -------------------- | --------------------------- |
| Autosum                    | `Alt+=`          | `Shift+Cmd+T`        | `Alt+Shift+=`                |
| Insert new sheet           | `Shift+F11`      | `Shift+Fn+F11`       | `Shift+F11`                  |
| Toggle absolute ref        | `F4`             | `Cmd+T`               | `F4` (or retype `$`)         |
| Fill down                  | `Ctrl+D`         | `Cmd+D`               | `Ctrl+D`                     |
| Insert current date        | `Ctrl+;`         | `Ctrl+;`              | `Ctrl+;`                     |
| Open Name Box / go to      | `Ctrl+G` / `F5`  | `Cmd+G`               | `Ctrl+Alt+Shift+H` (varies)  |
| Filter toggle              | `Ctrl+Shift+L`   | `Cmd+Shift+F`         | `Ctrl+Shift+R`               |
| Show formulas               | `Ctrl+\``        | `Ctrl+\``             | `Ctrl+\``                    |
| New comment                 | `Shift+F2`       | `Fn+Shift+F2`         | `Ctrl+Alt+M`                 |

## 📚 Excel vs. Google Sheets: Function & Feature Comparison

```
Excel                            Google Sheets
─────                            ──────────────
XLOOKUP / VLOOKUP / INDEX-MATCH  XLOOKUP / VLOOKUP / INDEX-MATCH (same syntax)
Power Query (M)                  QUERY() / IMPORTRANGE (no reusable pipeline UI)
Power Pivot + DAX data model     No native equivalent (use Connected Sheets → BigQuery)
Tables (Ctrl+T, structured refs) Named ranges + banded rows (weaker structured-ref support)
VBA macros                       Apps Script (JavaScript/V8)
Office Scripts (TypeScript)      Apps Script covers the same cloud-automation role
Slicers on PivotTables           Filter views (different mechanism, similar goal)
Native 3D/Map/Waterfall charts   Fewer built-in chart types, but native Geo chart & Sparkline()
REGEXEXTRACT/MATCH/REPLACE       Native — Excel has no REGEX* worksheet functions (Power Query M does)
1M+ row files, add-ins, offline  Real-time co-editing, browser-native, simpler sharing
```

## 📏 Scale & Performance Limits

| Limit                        | Excel                          | Google Sheets                     |
| ------------------------------ | -------------------------------- | ------------------------------------ |
| Max rows per sheet            | 1,048,576                        | 10,000,000 cells total across the file (not a fixed row count) |
| Max columns per sheet         | 16,384 (XFD)                     | 18,278 (ZZZ)                        |
| Practical "feels slow" point  | Several hundred thousand rows with heavy formulas | Tens of thousands of rows with volatile/array formulas |
| Best for very large data      | Power Pivot data model (compressed, columnar) | Connected Sheets → BigQuery         |

## 🔐 Security & Sharing

```text
Excel: workbook/sheet password protection, Information Rights Management (IRM) via Microsoft 365,
       mark-as-final (soft protection, not real security), external link warnings

Sheets: link-based sharing tiers (view/comment/edit), domain-restricted sharing, protected ranges,
       "prevent editors from changing access/sharing," expiring access, version history as an
       implicit audit trail (every edit is attributable and revertible)
```

## ⚠️ Common Gotchas

- **`VLOOKUP`'s default 4th argument is `TRUE` (approximate match)** if you omit it in older habits — always pass `FALSE`/`0` unless you specifically want a sorted-range lookup, or you'll get silently wrong answers instead of an error.
- **`IMPORTRANGE` needs a one-time authorization per source spreadsheet** — a formula that looks broken (`#REF!`) may just be waiting for that click.
- **Excel and Sheets serial-date epochs differ by one day** (Excel's Feb 29, 1900 doesn't exist but is counted; Sheets doesn't have this bug) — raw serial numbers copied between tools can be off by a day even though formatted dates look identical.
- **`QUERY()`'s SQL dialect isn't standard SQL** — no real `JOIN`, string literals need single quotes even inside double-quoted formula text, and column references use spreadsheet letters (`A`, `B`) not header names by default.
- **A PivotTable/Pivot table doesn't auto-refresh on source data changes** — you must explicitly refresh (Excel: right-click → Refresh; Sheets: usually auto-updates, but calculated fields and some connected sources still need a manual refresh).
- **Structured references (`Table1[Column]`) only exist in Excel Tables**, not in a plain range — converting a range to a Table changes how absolute/relative fill behaves, which can silently break formulas copied from outside the Table.
- **Apps Script and VBA are not portable to each other** — a workbook automated in VBA has zero equivalent when the file is converted to Sheets, and vice versa; automation has to be rebuilt, not ported.
- **Google Sheets' 10-million-cell limit is a whole-file budget**, not per-sheet — a workbook with many sheets can hit it well before any single sheet looks large.

## 🎯 Best Practices for Analysts

- Convert raw ranges to Excel Tables / keep Sheets ranges named — every downstream formula, pivot, and chart becomes more resilient to row insertions.
- Prefer `XLOOKUP`/`FILTER`/`UNIQUE` over legacy `VLOOKUP`+helper-column combinations where the tool version supports it — fewer intermediate columns, fewer copy-paste errors.
- Keep raw data, transformation, and presentation on separate sheets/tabs — never build formulas that both clean and display in the same range.
- For anything used by more than one person, document assumptions in a dedicated "Notes"/"ReadMe" tab rather than scattered cell comments.
- Push heavy transformation logic into Power Query (Excel) rather than deeply nested formulas — it's reproducible, auditable step-by-step, and doesn't recalculate on every keystroke.
- In Sheets, prefer `QUERY()` for grouped aggregation over long `SUMIFS` chains once you're combining more than 2-3 conditions — it's more maintainable and usually faster.

## 💡 Pro Tips

1. **`LET()` and `LAMBDA()`** turn a wall of nested formulas into named, readable steps — available in both modern Excel and Sheets.
2. **Freeze panes on header rows** before sharing any analytical workbook — it's a two-second fix that saves every reader from losing their place.
3. **`Ctrl+\`` (backtick) toggles formula view** — the fastest way to audit someone else's spreadsheet logic.
4. **Named ranges make formulas self-documenting** — `=SUMIFS(Revenue, Region, "West")` reads better than `=SUMIFS(C:C, A:A, "West")`.
5. **Sheets' version history (`File → Version history → See version history`) is a free undo-anything safety net** — name key versions before a big cleanup pass.
6. **Use Power Query's "Close & Load To... → Connection Only"** for staging tables you don't want cluttering the workbook but still want feeding a pivot or data model.
7. **`=SPARKLINE()` in a KPI table beats a separate chart** for at-a-glance trend context in a dense report.
8. **Data Validation dropdowns sourced from a named range** (not a hardcoded list) let you add new valid values without editing the validation rule itself.
9. **Conditional formatting with a custom formula rule** (`=$C2<0`) is more powerful than the built-in presets — it can reference other cells and combine conditions.
10. **In Apps Script, batch reads/writes with `getValues()`/`setValues()`** instead of looping cell-by-cell — looping `getRange(i,1).getValue()` is dramatically slower and the single most common Apps Script performance mistake.

## 💰 Financial & Statistical Functions

```
' Time value of money
=NPV(0.08, C2:C6)                          ' net present value of a cash flow series at an 8% discount rate
=IRR(C2:C6)                                ' internal rate of return, iterative solve
=XIRR(C2:C6, A2:A6)                        ' IRR for irregularly-spaced dates (real-world cash flows)
=PMT(0.05/12, 60, -20000)                  ' monthly loan payment: 5% APR, 60 months, $20,000 principal
=FV(0.06/12, 120, -200)                    ' future value of $200/month for 10 years at 6% APR
=PV(0.04, 10, -1000)                       ' present value of a 10-year, $1,000/yr annuity at 4%
=RATE(60, -400, 20000)                     ' solve for interest rate given payment/term/principal

' Statistical
=STDEV.S(C2:C100)  =STDEV.P(C2:C100)       ' sample vs. population standard deviation
=CORREL(C2:C100, D2:D100)                  ' correlation coefficient between two ranges
=TREND(C2:C20, A2:A20, A21:A25)            ' linear-regression forecast for new x values
=FORECAST.LINEAR(A21, C2:C20, A2:A20)      ' single-point linear forecast (successor to =FORECAST)
=SLOPE(C2:C20, A2:A20)  =INTERCEPT(C2:C20, A2:A20)   ' regression line coefficients
=RSQ(C2:C20, A2:A20)                       ' R² of a linear fit
=PERCENTILE.INC(C2:C100, 0.9)              ' 90th percentile
=QUARTILE.INC(C2:C100, 3)                  ' 3rd quartile (75th percentile)
```

Google Sheets supports the same function names for all of the above (`NPV`, `IRR`, `XIRR`, `TREND`, `FORECAST.LINEAR`, `STDEV.S`, etc.) — this is one of the more consistent corners between the two tools.

## 🎛️ What-If Analysis & Optimization

```text
Excel Goal Seek (Data → What-If Analysis → Goal Seek):
  "What input value makes this formula hit a target output?" — single-variable, single-cell solve.
  e.g., "What price gets my margin to exactly 40%?" — set cell: Margin%, to value: 0.40, by changing: Price

Excel Data Table (Data → What-If Analysis → Data Table):
  builds a grid of outputs across a range of one or two input variables — good for sensitivity tables
  (e.g., monthly payment across a grid of interest rates × loan terms)

Excel Scenario Manager (Data → What-If Analysis → Scenario Manager):
  save and switch between named sets of input assumptions ("Best Case" / "Worst Case" / "Base Case")

Excel Solver (Data → Solver, an add-in — enable via File → Options → Add-ins):
  true optimization: maximize/minimize an objective cell subject to constraints across multiple
  changing cells (e.g., maximize profit subject to a production-capacity constraint)

Google Sheets equivalents:
  No native Goal Seek/Scenario Manager — approximate with a manual binary-search formula, or
  Tools → Script editor for a custom Apps Script solve.
  Tools → Solver-like optimization is not native; the closest is a community add-on, or exporting
  the problem to a proper solver library via Apps Script/BigQuery ML.
```

```
' Manual "Goal Seek"-style binary search pattern in Sheets, when no add-in is available
' (paste as a helper column iterating toward a target, or drive it with Apps Script)
=IF(ABS(target - current_output) < tolerance, input_guess, "keep adjusting")
```

## 📊 Advanced PivotTable Techniques

```text
Calculated Field (both tools): a new field computed FROM other pivot fields
  Excel: PivotTable Analyze → Fields, Items & Sets → Calculated Field → e.g. =Revenue-Cost
  Sheets: Add field (under Values) → Calculated field → same idea, SUMIFS-style formula text

Calculated Item (Excel-only): a new member WITHIN an existing field, computed from other members
  e.g., a "Q1 Total" item that sums Jan+Feb+Mar within the Month field — no direct Sheets equivalent

=GETPIVOTDATA("Revenue", $A$3, "Region", "West", "Category", "Electronics")
  ' pulls a single value out of a PivotTable by field/item, stays correct even if the pivot layout changes
  ' (Excel auto-generates this when you click into a pivot cell from another formula; Sheets has no
  '  direct equivalent — reference the pivot's output cell directly instead, which is layout-fragile)

Grouping numeric fields into custom bins:
  Excel: right-click a numeric row field → Group → set Starting/Ending/By interval (e.g., age bands of 10)
  Sheets: right-click a row → Create pivot group rule → set bucket size, or pre-bucket with a helper
          column (nested IFS/tiering formula) before building the pivot

Pivot Charts: Excel — Insert → PivotChart directly off a pivot; auto-updates when the pivot's fields change.
              Sheets — build a normal chart off the pivot's output range; it does NOT auto-follow field
              changes the way an Excel PivotChart does.
```

## 🖱️ Form Controls & Interactive Spreadsheet Dashboards

```text
Excel Form Controls (Developer tab → Insert → Form Controls):
  Combo Box / List Box  → linked to a cell, drives INDEX/CHOOSE-based dashboards without a real dropdown validation
  Option Buttons         → mutually exclusive choice, linked cell returns the selected index
  Check Box               → linked cell returns TRUE/FALSE, drives conditional logic or filters
  Scroll Bar / Spin Button → linked cell steps a numeric value up/down — handy for a "what-if" input slider

Google Sheets equivalents:
  Dropdown (data validation "List") + checkbox (Insert → Checkbox, a native cell type) cover most of the
  same ground; Sheets has no native option-button/spin-button widget — approximate with a dropdown
  or a +/- button pair wired via Apps Script onEdit.
```

```
' A classic "linked-cell dashboard" pattern: a form control writes a value into $B$1,
' every KPI/chart on the dashboard reads from a formula keyed off that one cell
=INDEX(RevenueByRegion, MATCH($B$1, RegionList, 0))
' Swap the Combo Box's linked cell and the whole dashboard's charts/KPIs update together
```

## 🤖 Advanced Apps Script & VBA

```javascript
// Google Apps Script — custom function callable directly as a spreadsheet formula
/**
 * Converts a currency amount using a live exchange rate service.
 * @param {number} amount The amount to convert.
 * @param {string} from The source currency code.
 * @param {string} to The target currency code.
 * @return {number} The converted amount.
 * @customfunction
 */
function CONVERTCURRENCY(amount, from, to) {
  const rate = UrlFetchApp.fetch(`https://api.exchange.example.com/${from}/${to}`);
  return amount * JSON.parse(rate.getContentText()).rate;
}
// Usable in any cell as: =CONVERTCURRENCY(A2, "USD", "EUR")

// onEdit trigger — runs automatically whenever a user edits the sheet (simple trigger, limited permissions)
function onEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() === "Orders" && e.range.getColumn() === 4) {
    sheet.getRange(e.range.getRow(), 5).setValue(new Date());   // stamp a "last modified" column
  }
}
```

```vba
' Excel VBA — UserForm-driven data entry (Developer → Insert UserForm, then wire a Submit button)
Private Sub btnSubmit_Click()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("Orders")
    Dim nextRow As Long
    nextRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 1
    ws.Cells(nextRow, 1).Value = txtCustomer.Value
    ws.Cells(nextRow, 2).Value = txtAmount.Value
    ws.Cells(nextRow, 3).Value = Now
    Unload Me
End Sub

' Custom VBA function callable as a worksheet formula
Function TaxBracket(income As Double) As String
    Select Case income
        Case Is < 40000: TaxBracket = "10%"
        Case Is < 90000: TaxBracket = "22%"
        Case Else: TaxBracket = "32%"
    End Select
End Function
' Usable in a cell as: =TaxBracket(A2)
```

## 📚 Worked Examples Across Business Scenarios

### 1. Monthly Sales Dashboard (PivotTable + Slicers + Sparklines)

**Scenario:** A retail analyst needs a one-page dashboard showing revenue by region and category, updated monthly, that a sales manager can filter interactively without touching formulas.

```text
1. Convert the raw sales export to an Excel Table (Ctrl+T) so the pivot source auto-expands each month.
2. Insert → PivotTable: Rows = Region, Columns = Category, Values = Sum of Revenue.
3. Insert → Slicer on Region and Month; connect the same slicers to a second pivot (Report Connections)
   showing Top 10 Products so both views filter together.
4. Add a KPI row above the pivot: =SUM(Table1[Revenue]) for the headline number, with
   =SPARKLINE not available in Excel — use Insert → Sparklines → Line, bound to the last 12 monthly totals.
5. Conditional-format the pivot's value cells with a color scale to surface regional weak spots at a glance.
```

### 2. Dynamic Multi-Sheet Order Lookup

**Scenario:** Customer service reps need to look up an order's status by ID, where orders live across three regional sheets (US, EU, APAC) that get appended to weekly.

```
' On a "Lookup" sheet, a single search box drives all three regions via nested IFERROR fallthrough
=IFERROR(XLOOKUP($B$1, US!A:A, US!D:D),
  IFERROR(XLOOKUP($B$1, EU!A:A, EU!D:D),
    IFERROR(XLOOKUP($B$1, APAC!A:A, APAC!D:D), "Order not found")))

' Sheets: same pattern, or consolidate first with a QUERY union for a single searchable range
=QUERY({US!A:D; EU!A:D; APAC!A:D}, "select * where Col1 = '"&B1&"'")
```

### 3. Cleaning a Messy CRM Export

**Scenario:** A CRM export has inconsistent casing, stray whitespace, embedded non-breaking spaces from copy-paste, and phone numbers in five different formats.

```
=PROPER(TRIM(CLEAN(SUBSTITUTE(A2, CHAR(160), " "))))       ' name: standardize case + strip junk whitespace
=REGEXREPLACE(B2, "[^0-9]", "")                             ' Sheets: strip every non-digit from a phone field
=TEXTJOIN("-", TRUE, MID(C2,1,3), MID(C2,4,3), MID(C2,7,4)) ' reformat a cleaned 10-digit string as (XXX)-XXX-XXXX-style
=IF(LEN(TRIM(D2))=0, "Missing", TRIM(D2))                   ' flag blank-after-trim fields instead of silently keeping them
```

Then Data → Remove Duplicates on the cleaned columns (never on the raw ones — trailing whitespace makes near-identical rows look distinct).

### 4. Cohort Retention Table

**Scenario:** A subscription business wants to see, for each signup month, what % of customers were still active in month 1, 2, 3... after signup.

```text
1. Build a helper column: Months Since Signup = DATEDIF(SignupDate, ActivityDate, "M")
2. Pivot: Rows = Signup Month, Columns = Months Since Signup, Values = Count Distinct Customer ID
   (Excel: enable "Add this data to the Data Model" when creating the pivot to unlock Distinct Count as
    a value summarization; Sheets: use a SUMPRODUCT/COUNTIFS-driven matrix instead, since Sheets pivots
    don't offer a native distinct-count aggregation)
3. Convert each column to a % of that row's Month-0 count for the classic retention-curve look:
   =D5/$B5   (assuming column B holds each cohort's Month-0 count)
4. Color-scale conditional format the resulting percentage grid for an at-a-glance heatmap.
```

### 5. NPV/IRR Investment Decision Model

**Scenario:** Comparing two capital projects with different upfront costs and multi-year cash flow profiles to decide which to fund.

```
' Project A: -$50,000 upfront, then $15,000/year for 5 years
=NPV(0.08, C3:C7) + C2          ' C2 holds the negative upfront investment, added outside NPV's own discounting
=IRR(C2:C7)                     ' solves for the discount rate that makes NPV = 0

' Decision rule laid out in the sheet itself, not just the raw numbers:
=IF(NPV_A > NPV_B, "Fund Project A", IF(NPV_B > NPV_A, "Fund Project B", "Tie — use IRR or payback period"))

' Sensitivity: build a Data Table (What-If Analysis) with discount rate down the rows (6%-12%)
' to show how sensitive the funding decision is to the assumed cost of capital.
```

### 6. Automated Weekly Report Export

**Scenario:** Every Friday at 7am, a summary sheet should be exported as PDF and emailed to a distribution list — without a human remembering to run it.

```javascript
// Google Apps Script — schedule with a time-driven trigger (Triggers panel or code)
function emailWeeklyReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheetByName("Raw Data").getRange("A1").setValue(new Date());  // force a fresh timestamp/recalc
  SpreadsheetApp.flush();
  const pdf = DriveApp.getFileById(ss.getId())
    .getAs("application/pdf")
    .setName(`Weekly Report - ${Utilities.formatDate(new Date(), "GMT", "yyyy-MM-dd")}.pdf`);
  MailApp.sendEmail({
    to: "team-dist@example.com",
    subject: "Weekly Sales Report",
    body: "Attached is this week's automated summary.",
    attachments: [pdf]
  });
}
```

```vba
' Excel VBA — a Workbook_Open-triggered check, paired with Windows Task Scheduler opening the file weekly
Sub ExportWeeklyPDF()
    Sheets("Summary").ExportAsFixedFormat Type:=xlTypePDF, _
        Filename:="C:\Reports\Weekly_" & Format(Now, "yyyy-mm-dd") & ".pdf"
    Call SendReportEmail   ' a separate Outlook-automation sub, omitted here for brevity
End Sub
```

### 7. Live Cross-Workbook Budget Tracker (Sheets)

**Scenario:** Department heads each maintain their own budget spreadsheet; finance needs a single rolled-up view that updates automatically as departments edit their sheets.

```
' In the central Finance sheet, pull each department's totals via IMPORTRANGE
=IMPORTRANGE("https://docs.google.com/spreadsheets/d/DEPT_A_ID", "Budget!B2:B13")
=IMPORTRANGE("https://docs.google.com/spreadsheets/d/DEPT_B_ID", "Budget!B2:B13")

' Then QUERY the combined range for a rolled-up monthly total across all departments
=QUERY({DeptA_Range; DeptB_Range; DeptC_Range}, "select Col1, sum(Col2) group by Col1 label Col1 'Month', sum(Col2) 'Total'")

' Each department sheet needs a one-time IMPORTRANGE authorization click from an editor with access —
' set this up once per source sheet immediately after creating the tracker, not on first real use.
```
