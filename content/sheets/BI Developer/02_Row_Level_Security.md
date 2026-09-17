# 🔒 Row-Level Security (RLS) — BI Developer Cheatsheet (Deep Dive)

## Table of Contents
1. [What It Is](#1-what-it-is)
2. [Static vs Dynamic RLS](#2-static-vs-dynamic-rls)
3. [Entitlement/Mapping Table Pattern](#3-entitlementmapping-table-pattern-tool-agnostic)
4. [Power BI RLS — In Depth](#4-power-bi-rls--in-depth)
5. [Tableau RLS — In Depth](#5-tableau-rls--in-depth)
6. [Hierarchical / Manager RLS Pattern](#6-hierarchical--manager-rls-pattern)
7. [Row-Level Security vs Object-Level Security](#7-row-level-security-vs-object-level-security)
8. [Testing RLS: A Checklist](#8-testing-rls-a-checklist)
9. [Performance Considerations](#9-performance-considerations)
10. [Best Practices](#10-best-practices-both-tools)

---

## 1. What It Is

RLS restricts the **rows of data a user can see** based on their identity or role — enforced at the data model/query level, not just hidden in the UI. This is a critical distinction: hiding a visual or filtering in the report canvas is **not** security, because a user could still access the underlying dataset via export, API, or a new report built on the same dataset. Real RLS is enforced by the query engine itself, so no matter how a user queries the data, restricted rows never return.

**Threat model RLS protects against:**
- A regional sales manager building their own report on a shared dataset and accidentally (or intentionally) seeing other regions' data.
- Exporting to Excel/CSV and bypassing report-level filters.
- Querying the dataset via API (e.g., Power BI REST API, Tableau's VizQL Data Service) — RLS still applies since it's enforced at the model layer.

---

## 2. Static vs Dynamic RLS

| Type | Description | Example | Maintenance Cost |
|---|---|---|---|
| **Static** | Fixed roles with hardcoded filter conditions, one role per segment | Role "APAC" → `Region = "APAC"` | High — new role needed for every new segment/user group |
| **Dynamic** | Filter driven by logged-in user via a mapping/entitlement table | `Region = LOOKUPVALUE(UserRegionMap[Region], UserRegionMap[Email], USERPRINCIPALNAME())` | Low — just add a row to the mapping table |

**Rule of thumb:** use static RLS only when the number of segments is small and stable (e.g., 3 business units that rarely change). Use dynamic RLS for anything user-specific, frequently changing, or with more than ~10 segments.

---

## 3. Entitlement/Mapping Table Pattern (Tool-Agnostic)

```
Table: UserAccessMap
| UserEmail          | Region | Department | ManagerFlag |
|---------------------|--------|------------|-------------|
| ann@company.com     | APAC   | Sales      | FALSE       |
| ben@company.com     | EMEA   | Finance    | TRUE        |
| cara@company.com    | AMER   | Sales      | FALSE       |
```

This table joins to fact/dimension tables and filters based on the current user's identity function (`USERPRINCIPALNAME()` in Power BI, `USERNAME()` in Tableau).

### Supporting Multiple Values per User (Many-to-Many Access)

Some users need access to **multiple** regions, not just one. Use a bridge table instead of a flat one:

```
Table: UserAccessBridge
| UserEmail          | Region |
|---------------------|--------|
| dana@company.com    | APAC   |
| dana@company.com    | EMEA   |   -- Dana sees both APAC and EMEA
```

In this pattern, the RLS filter becomes a semi-join / `IN` style filter rather than a single-value lookup (see Power BI example in Section 4.3).

---

## 4. Power BI RLS — In Depth

### 4.1 Basic Setup
- Defined in **Roles** (Modeling → Manage Roles) using DAX filter expressions on tables.
- Common functions: `USERPRINCIPALNAME()`, `USERNAME()`, `LOOKUPVALUE()`, `CUSTOMDATA()`, `TREATAS()`.
- Two enforcement mechanisms:
  - **Row filters** — a DAX boolean expression directly on a table, e.g. `[Region] = "APAC"`.
  - **Relationship propagation** — the filter applied to a dimension table propagates to fact tables through the relationship (make sure the cross-filter direction actually reaches the fact table).

### 4.2 Simple Dynamic RLS (Single Value per User)
```dax
-- Role: "Dynamic Region", applied as a row filter on dim_region
[RegionName] = LOOKUPVALUE(
    UserAccessMap[Region],
    UserAccessMap[UserEmail], USERPRINCIPALNAME()
)
```

### 4.3 Dynamic RLS with Multiple Values per User (Bridge Table Pattern)
```dax
-- Role: "Dynamic Region - Multi", applied as a row filter on dim_region
[RegionName] IN
    CALCULATETABLE(
        VALUES(UserAccessBridge[Region]),
        FILTER(UserAccessBridge, UserAccessBridge[UserEmail] = USERPRINCIPALNAME())
    )
```
Alternative using `TREATAS` to push a filtered table of allowed regions onto the dimension:
```dax
[Allowed Regions] :=
TREATAS (
    FILTER ( UserAccessBridge, UserAccessBridge[UserEmail] = USERPRINCIPALNAME() ),
    dim_region[RegionName]
)
```

### 4.4 Testing
- Use **"View As Roles"** in Power BI Desktop (Modeling tab) before publishing — you can simulate a specific `USERPRINCIPALNAME()` value.
- In the Service, admins can test via **"Test as role"** on the dataset settings page.

### 4.5 Object-Level Security (OLS)
OLS hides entire **tables or columns** (not just rows) from certain roles — e.g., hiding a `Salary` column from everyone except HR. Configured via **Tabular Editor** (not natively in Power BI Desktop):

```
Tabular Editor > Roles > [HR_Only role] > Table Permissions
  -> Set "Salary" column metadata permission = None for all other roles
```

### 4.6 Gotchas
- RLS + bi-directional relationships can cause ambiguous or leaking filters — test both directions carefully.
- RLS does **not** apply to dataset owners/admins with edit/build access — enforce via **workspace roles** too (Viewer vs Contributor vs Admin).
- RLS with DirectQuery pushes the filter into the generated SQL — verify with **DAX Studio's "Server Timings"** that the `WHERE` clause actually includes the RLS predicate.
- RLS roles are **not applied in Power BI Desktop by default** — you must explicitly use "View As" to test; otherwise you're seeing unfiltered data while building.

---

## 5. Tableau RLS — In Depth

### 5.1 User Filters (Simple, Manual)
Right-click a field → Create → User Filter → manually map each username to allowed values. **Only use this for a handful of users** — it doesn't scale and requires manual updates.

### 5.2 Dynamic Filtering with USERNAME() / ISMEMBEROF()
```
// Calculated field: "Is Authorized"
IIF([Region] = LOOKUP(MIN([Allowed Region]), 0), 1, 0)

// Simpler pattern using a join to an entitlement table:
[Entitled Region] = [Region]   -- after joining UserAccessMap on USERNAME()
```

Common working pattern — join the entitlement table to your main data source on `UserEmail = USERNAME()`, then add this as a **Data Source Filter**:
```
Filter: [Entitled Region] = [Region]
```
This ensures the filter is applied at the data source level (affects every sheet using that source), not just a single worksheet.

### 5.3 Group-Based RLS with ISMEMBEROF()
If users are managed via Active Directory groups synced to Tableau Server:
```
IIF(ISMEMBEROF('APAC_Sales_Group'), 1, 0) = 1
```

### 5.4 Multi-Value Entitlements (Bridge Table)
Similar to Power BI — join a `UserAccessBridge` table (`UserEmail`, `Region`) to the fact table on `Region`, and add a **Data Source Filter**:
```
[Bridge.UserEmail] = USERNAME()
```
This performs an implicit `INNER JOIN` filter — only rows where the bridge table has a matching entry for the current user AND region survive.

### 5.5 Testing
- Use **"View as"** in Tableau Server/Cloud (available to site admins) to preview a workbook as a specific user.
- In Tableau Desktop, temporarily hardcode `USERNAME()` via a parameter to simulate different users before publishing.

---

## 6. Hierarchical / Manager RLS Pattern

A common enterprise requirement: **a manager should see their own data plus all of their direct/indirect reports' data.**

### Entitlement table with a hierarchy path
```
Table: dim_employee
| EmployeeID | ManagerID | EmployeeName | HierarchyPath   |
|------------|-----------|--------------|-----------------|
| 101        | NULL      | CEO          | /101/           |
| 102        | 101       | VP Sales     | /101/102/       |
| 103        | 102       | Regional Mgr | /101/102/103/   |
| 104        | 103       | Sales Rep    | /101/102/103/104/ |
```

**Power BI DAX pattern** (row filter on `dim_employee`, using PATHCONTAINS):
```dax
PATHCONTAINS(
    LOOKUPVALUE(dim_employee[HierarchyPath], dim_employee[Email], USERPRINCIPALNAME()),
    EARLIER(dim_employee[EmployeeID])
)
-- Simplified using variables:
VAR CurrentUserPath = LOOKUPVALUE(dim_employee[HierarchyPath], dim_employee[Email], USERPRINCIPALNAME())
RETURN
    PATHCONTAINS(dim_employee[HierarchyPath], LOOKUPVALUE(dim_employee[EmployeeID], dim_employee[Email], USERPRINCIPALNAME()))
    || dim_employee[HierarchyPath] = CurrentUserPath
```
This lets a manager see all rows where their own `EmployeeID` appears anywhere in the report-row's `HierarchyPath` — i.e., anyone below them in the org chart.

**Tableau equivalent:** precompute the hierarchy path in the data source (via SQL `WITH RECURSIVE` CTE, see the SQL cheatsheet) and use a `CONTAINS()` calculated field comparing the logged-in manager's path substring against each row's path.

---

## 7. Row-Level Security vs Object-Level Security

| Aspect | Row-Level Security (RLS) | Object-Level Security (OLS) |
|---|---|---|
| Restricts | Specific **rows** based on a condition | Entire **tables or columns** |
| Example | Regional manager sees only their region's rows | Only HR role can see the `Salary` column at all |
| Power BI Tool | Manage Roles (native) | Tabular Editor (external tool) |
| Tableau Tool | Data source filters / user filters | Not natively supported — often handled via separate published data sources with restricted columns, or Ask Data/permissions |

Use **both together** for full protection: OLS to prevent a sensitive column from being visible to any unauthorized role, RLS to restrict which rows of the remaining data are visible.

---

## 8. Testing RLS: A Checklist

- [ ] Test as **at least 3 different users/roles**, including one with no matching entitlement rows (should see zero rows, not an error or all rows).
- [ ] Test a user assigned to **multiple** entitlement values (if using the bridge-table pattern).
- [ ] Confirm RLS applies to **exports** (CSV/Excel/PDF) — not just the visual canvas.
- [ ] Confirm RLS applies when the dataset is used as a source for a **new report** built by an end user.
- [ ] Confirm workspace/project **permission levels** don't inadvertently grant edit access that bypasses RLS (e.g., Contributors/Admins can see raw data in Desktop).
- [ ] For DirectQuery/Live models, inspect the generated SQL (DAX Studio / Tableau's Performance Recording) to confirm the RLS predicate is actually pushed down.
- [ ] Re-test after any relationship or model schema change — RLS can silently break if a relationship direction changes.

---

## 9. Performance Considerations

- RLS filters are evaluated on **every single query** — an inefficient `LOOKUPVALUE` or nested subquery in the RLS DAX can slow down every visual on the report.
- Prefer **indexed/small mapping tables** — an entitlement table with millions of rows will slow every query; keep it as small and well-modeled as possible.
- For DirectQuery sources, ensure the underlying database has an **index on the join/filter columns** used by RLS (e.g., `UserEmail`, `Region`).
- Avoid RLS logic that requires scanning the entire fact table (e.g., filtering based on an aggregated calculation) — RLS predicates should ideally be simple equality/`IN` filters on dimension tables.

---

## 10. Best Practices (Both Tools)

- Keep the entitlement table **separate from fact tables** for maintainability, and refresh it on the same schedule as your main model.
- Always **test with multiple role/user combinations**, not just admin.
- Document RLS logic in the data dictionary — it's a common audit/compliance requirement (SOX, GDPR, HIPAA).
- Consider **performance impact** — RLS filters run on every query; index/optimize mapping tables.
- Combine RLS with **OLS** and **workspace/project-level permissions** for full defense-in-depth.
- Automate entitlement table updates from your identity provider (e.g., sync from Azure AD groups or an HR system) rather than manual spreadsheet edits.
- Log and periodically **audit** who has access to what — especially for datasets containing PII or financial data.
