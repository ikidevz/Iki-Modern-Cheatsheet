# Google Looker Studio Cheatsheet — *Bonus (Data Analyst focus)*

> Free, self-service BI and dashboarding tool (formerly **Google Data Studio**) — the most common last-mile tool Data Analysts use on top of BigQuery.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Type | Free, web-based BI / data visualization & reporting tool |
| Relation to Looker | Different product from full **Looker** (LookML-based enterprise BI); Looker Studio is lighter-weight and free |
| Best for | Dashboards, ad-hoc reports, sharing insights broadly, marketing/exec reporting |
| Not for | Heavy governed semantic layers at large scale (use full Looker), huge/complex live queries (pre-aggregate in BQ first) |

---

## 2. Core Concepts

| Concept | Description |
|---|---|
| **Data Source** | A connection to a dataset (BigQuery table/view, Sheets, GA4, CSV, etc.) |
| **Report** | The dashboard/canvas made of charts, filters, and pages |
| **Field** | A dimension or metric from a data source |
| **Calculated Field** | A formula-derived field (like a spreadsheet formula) |
| **Blend** | Joins 2+ data sources on a common key directly in the report |
| **Data freshness / Cache** | Controls how often Looker Studio re-queries the underlying source |
| **Community connectors** | Third-party/custom connectors beyond Google's native ones (built with Apps Script) |

---

## 3. Connecting to BigQuery

1. **Add Data Source → BigQuery**
2. Choose: "My Projects" table/view, or write a **Custom Query** (raw SQL).
3. Choose connection mode:
   - **Live connection** — always queries BQ directly (fresh, but can be slow/costly on big tables).
   - **Extract** — snapshots data into Looker Studio's own fast in-memory store (faster, cheaper, needs manual/scheduled refresh).

### Example custom queries used as a data source

```sql
-- Custom query 1: Pre-aggregated daily sales (cheaper than pulling raw rows)
SELECT
  DATE(order_ts) AS order_date,
  country,
  SUM(amount) AS total_sales,
  COUNT(DISTINCT user_id) AS unique_customers
FROM `my_project.marts.fct_orders`
GROUP BY 1, 2
```

```sql
-- Custom query 2: Parameterized by a Looker Studio date-range parameter
SELECT country, SUM(amount) AS total_sales
FROM `my_project.marts.fct_orders`
WHERE order_ts BETWEEN @DS_START_DATE AND @DS_END_DATE
GROUP BY 1
```

💡 **Best practice:** For large or frequently-viewed dashboards, pre-aggregate in BigQuery (a view or Dataform mart) and/or use **Extract** mode — don't let every dashboard viewer trigger a full-table BQ scan.

---

## 4. Calculated Fields — Common Functions

```
-- Basic arithmetic / ratio
SUM(revenue) / SUM(orders)

-- Conditional (CASE WHEN)
CASE
  WHEN Country = "PH" THEN "Philippines"
  ELSE "Other"
END

-- Nested conditions for cohort buckets
CASE
  WHEN Lifetime_Value > 1000 THEN "High Value"
  WHEN Lifetime_Value > 100 THEN "Mid Value"
  ELSE "Low Value"
END

-- Date functions
PARSE_DATE("%Y%m%d", date_string)
DATE_DIFF(CURRENT_DATE(), order_date)
WEEK_NUMBER(order_date)

-- String functions
CONCAT(first_name, " ", last_name)
REGEXP_EXTRACT(url, "utm_source=([^&]+)")
REGEXP_MATCH(email, "^.+@company\.com$")

-- Aggregations
COUNT_DISTINCT(user_id)
SUM(CASE WHEN status = "completed" THEN amount ELSE 0 END)

-- Percent of total (table calculation)
SUM(revenue) / SUM(SUM(revenue))

-- Year-over-year style comparison (with a comparison date range enabled)
(SUM(revenue) - SUM(revenue, comparisonDateRange)) / SUM(revenue, comparisonDateRange)
```

---

## 5. Chart Types Quick Reference

| Chart | Best for |
|---|---|
| Scorecard | Single KPI (total revenue, DAU) |
| Time series | Trends over time |
| Bar / Column | Category comparisons |
| Table (with heatmap/bars) | Detailed breakdowns, ranked lists |
| Pie / Donut | Simple part-to-whole (use sparingly) |
| Geo map | Location-based metrics |
| Combo chart | Two related metrics at different scales (e.g., revenue + conversion rate) |

---

## 6. Filters & Interactivity

- **Report-level filters**: apply to every page.
- **Page-level / chart-level filters**: scoped narrower.
- **Filter controls**: dropdown/date-range widgets viewers can adjust themselves.
- **Cross-filtering**: clicking a data point in one chart filters others on the page.
- **Parameters**: let viewers pass a custom input value into a custom query (e.g., choose a lookback window).

---

## 7. Sharing & Permissions

| Level | Who can |
|---|---|
| **Viewer** | View the report only |
| **Editor** | Edit the report layout/charts |
| Data source permissions | Separate from report permissions — control who can edit *data connections* vs just the *report* |

- Share via link (like Google Docs), embed via iframe, or schedule **email delivery** (PDF snapshot on a recurring schedule).
- "Owner's credentials" vs "Viewer's own credentials" mode for BigQuery — determines whose IAM permissions are used to query (important for cost attribution & row-level security).

---

## 8. Automating Around Looker Studio with Python

Looker Studio itself has no public API for programmatically building report layouts, but Data Analysts commonly automate everything **around** it with Python:

### Refresh an "Extract" data source's underlying BigQuery table on a schedule
```python
# Runs as a Cloud Function/Composer task; Looker Studio's Extract is then
# refreshed manually or on the report's own refresh schedule.
from google.cloud import bigquery

def refresh_dashboard_table(request):
    client = bigquery.Client()
    client.query("""
        CREATE OR REPLACE TABLE `my_project.marts.dashboard_daily_sales` AS
        SELECT DATE(order_ts) AS order_date, country, SUM(amount) AS total_sales
        FROM `my_project.marts.fct_orders`
        GROUP BY 1, 2
    """).result()
    return "OK"
```

### Manage report/data-source sharing permissions (Drive API)
Looker Studio reports and data sources are Drive files under the hood, so sharing can be automated via the Drive API:
```python
from googleapiclient.discovery import build
from google.oauth2 import service_account

creds = service_account.Credentials.from_service_account_file(
    "key.json", scopes=["https://www.googleapis.com/auth/drive"]
)
drive_service = build("drive", "v3", credentials=creds)

drive_service.permissions().create(
    fileId="REPORT_FILE_ID",   # the ID from the Looker Studio report URL
    body={"type": "group", "role": "reader", "emailAddress": "analysts@company.com"},
    sendNotificationEmail=False,
).execute()
```

### Build a "Linking API" URL to spin up a pre-configured report copy
Looker Studio's **Linking API** lets you construct a URL (from Python, a script, or a web app) that opens the report-creation flow pre-filled with a given data source — handy for templated report generation:
```python
import urllib.parse

def build_report_link(template_report_id: str, data_source_id: str, report_name: str) -> str:
    base = f"https://lookerstudio.google.com/reporting/create"
    params = {
        "c.reportId": template_report_id,
        "ds.connector": "bigQuery",
        "ds.datasourceName": data_source_id,
        "r.reportName": report_name,
    }
    return f"{base}?{urllib.parse.urlencode(params)}"

print(build_report_link("abc123", "my_project.marts.fct_orders", "Q3 Sales Report"))
```

---

## 9. Performance Tips

- Prefer **Extracts** over Live connection for dashboards with many concurrent viewers.
- Reduce the number of fields/charts per page — each chart is a separate query.
- Use a **custom query** with pre-filtered/aggregated logic instead of pulling a huge raw table and filtering in Looker Studio.
- Avoid Blends where a single BigQuery `JOIN` (in a view) would be far more efficient.

---

## 10. Pricing

Looker Studio itself is **free**. You only pay for the underlying data source costs — e.g., BigQuery query costs incurred by "Live connection" dashboards, especially with many viewers ("Viewer's credentials" mode multiplies query cost by unique viewers).

---

## 11. Common Gotchas

- "Viewer's own credentials" mode can cause unexpected BigQuery costs/errors if viewers lack BQ permissions.
- Live-connected dashboards on large tables can feel slow and rack up BQ scan costs — mitigate with extracts or materialized/aggregated views.
- Calculated fields defined in the report aren't reusable elsewhere — for shared logic, define it once upstream in a BigQuery view/Dataform model instead.
- Blends have a limited number of join keys/fields — complex multi-source joins are better done upstream in BigQuery.
- Cached data can look "stale" to viewers — check data freshness settings if numbers seem outdated.

---

## 12. Useful Links

- Docs: https://support.google.com/looker-studio
- Looker Studio vs (full) Looker: https://cloud.google.com/looker
- Linking API reference: https://developers.google.com/looker-studio/integrate/linking-api
