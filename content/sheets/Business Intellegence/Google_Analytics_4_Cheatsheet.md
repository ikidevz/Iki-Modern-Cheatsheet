# Google Analytics 4 (GA4) Cheatsheet for Data & Analytics

> A structured GA4 reference — the event-based data model, setup, standard & Exploration reports, the BigQuery export schema, the Data API, and the gotchas that trip up anyone coming from Universal Analytics.

## 📑 Table of Contents

1. [🧠 Core Concepts: The Event-Based Data Model](#core-concepts-the-event-based-data-model)
2. [⚙️ Setting Up GA4](#setting-up-ga4)
3. [🎯 Key Events (Conversions)](#key-events-conversions)
4. [📊 Standard Reports](#standard-reports)
5. [🔍 Explorations](#explorations)
6. [👥 Audiences](#audiences)
7. [🔗 Attribution Models](#attribution-models)
8. [🐞 DebugView & Real-Time Debugging](#debugview-real-time-debugging)
9. [☁️ BigQuery Export Schema](#bigquery-export-schema)
10. [🧮 Common BigQuery Queries on GA4 Export](#common-bigquery-queries-on-ga4-export)
11. [🔌 GA4 Data API](#ga4-data-api)
12. [📐 Core Dimensions & Metrics Reference](#core-dimensions-metrics-reference)
13. [🍪 Consent Mode & Data Thresholds](#consent-mode-data-thresholds)
14. [🔄 GA4 vs. Universal Analytics](#ga4-vs-universal-analytics)
15. [🔐 Data Retention & Privacy Controls](#data-retention-privacy-controls)
16. [⚠️ Common Gotchas](#common-gotchas)
17. [🎯 Best Practices](#best-practices)
18. [💡 Pro Tips](#pro-tips)
19. [🛒 Enhanced E-commerce Events Deep Dive](#enhanced-e-commerce-events-deep-dive)
20. [📱 GA4 for App Analytics (Firebase)](#ga4-for-app-analytics-firebase)
21. [🖥️ Server-Side Tagging](#server-side-tagging)
22. [🧮 Advanced BigQuery Patterns](#advanced-bigquery-patterns)
23. [📚 Worked Examples Across Business Scenarios](#worked-examples-across-business-scenarios-ga4)

## ⚡ Quick Reference

**Core workflow cheatsheet**

| Task                              | Where / How                                                        |
| ------------------------------------ | -------------------------------------------------------------------- |
| Mark an event as a Key Event          | Admin → Events → toggle "Mark as key event"                          |
| Create a custom dimension              | Admin → Custom definitions → Create custom dimension                  |
| Build a funnel                         | Explore → Funnel exploration template                                 |
| Debug events live                      | Admin → DebugView (with the debug_mode param or a debug extension)    |
| Link to BigQuery                       | Admin → Product Links → BigQuery Links                                |
| Query the BigQuery export              | `SELECT * FROM \`project.analytics_XXXX.events_YYYYMMDD\``            |
| Pull data programmatically             | GA4 Data API `runReport` (REST or client libraries)                   |
| Build a segment/audience               | Admin → Audiences → New audience                                      |

**Event parameter cheat sheet**

| Concept              | GA4 term                                                        |
| ----------------------- | -------------------------------------------------------------------- |
| A user action            | `event` (e.g. `page_view`, `purchase`, `sign_up`)                     |
| Extra detail on an event | `event_params` (key/value pairs attached to the event)               |
| User-level attribute      | `user_properties`                                                     |
| A "goal" event            | `key_event` (formerly "conversion")                                   |
| Session identifier         | `ga_session_id` (an event param, not a top-level column)              |

## 🧠 Core Concepts: The Event-Based Data Model

```text
Everything in GA4 is an event — there's no separate "pageview" vs. "event" hit type like Universal Analytics had.
Every interaction (page_view, scroll, click, purchase, custom action) is logged as one event with:
  event_name    → what happened ("purchase")
  event_params  → contextual detail attached to that event (page_location, value, currency, items, ...)
  user_properties → attributes of the user, persist across sessions (e.g., a CRM-derived customer_tier)
```

```text
Automatically collected events: first_visit, session_start, page_view, user_engagement, scroll (90%), click (outbound)
Enhanced measurement events (toggle per stream): scrolls, outbound clicks, site search, video engagement,
                                                  file downloads, form interactions
Recommended events: Google-defined names/params for common actions (purchase, sign_up, login, search, ...) —
                     using the standard names unlocks pre-built reports and e-commerce features
Custom events: anything you name and define yourself when no recommended event fits
```

## ⚙️ Setting Up GA4

```text
Account → Property → Data Stream (Web / iOS app / Android app) → each stream has its own Measurement ID (G-XXXXXXX)

gtag.js (web):
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXX');
</script>

// Sending a custom event
gtag('event', 'purchase', {
  transaction_id: 'T12345',
  value: 49.99,
  currency: 'USD',
  items: [{ item_id: 'SKU123', item_name: 'Widget', price: 49.99, quantity: 1 }]
});
```

Most implementations go through Google Tag Manager (GTM) rather than hardcoded `gtag.js` calls — a GA4 Configuration tag plus GA4 Event tags, triggered by GTM triggers, is the common production pattern.

## 🎯 Key Events (Conversions)

Google renamed **conversions** to **key events** in GA4 (to disambiguate from Google Ads "conversions") — the underlying mechanism is unchanged: mark any event as a key event and it's counted toward key-event metrics and reports.

```text
Admin → Events → find the event → toggle "Mark as key event"
   or: Admin → Key events → New key event (type an event name that will fire in the future)

An event marked as a key event is retroactively counted in key-event reports from that point forward
(not retroactively for events that already happened before the toggle).

Key events CAN also be imported into Google Ads as a "conversion" for bidding — that's a separate,
additional step (Admin → Google Ads Links / Conversions), not automatic.
```

## 📊 Standard Reports

```text
Reports snapshot: high-level overview across Acquisition, Engagement, Monetization, Retention
Realtime: users active in the last 30 minutes, live event stream
Life cycle reports: Acquisition (traffic sources), Engagement (events, pages, screens), Monetization
                     (e-commerce, in-app purchases, ads), Retention (cohort-style returning-user view)
User reports: Demographics, Tech (browser/OS/device), User attributes
Advertising: Attribution reports, campaign/channel performance, conversion paths
```

## 🔍 Explorations

The Explore section is GA4's flexible, ad hoc analysis workspace — templates build a starting canvas you customize with any dimensions/metrics/segments.

```text
Free Form         → pivot-table-style, choose your own rows/columns/values
Funnel Exploration → step-by-step conversion funnel with drop-off %, open vs. closed funnels, elapsed time
Path Exploration    → tree graph of the sequence of events/pages a user takes forward or backward from a step
Segment Overlap      → Venn-diagram-style view of how user segments intersect
Cohort Exploration    → group users by an acquisition date cohort, track a metric (e.g. retention) over subsequent periods
User Explorer          → individual user activity timelines (subject to data-threshold suppression on small properties)
Trip Exploration (mobile) → screen-to-screen or event-to-event navigation flow, similar to Path but session-scoped
```

## 👥 Audiences

```text
Admin → Audiences → New audience: build from event/parameter conditions, sequences (ordered steps within a
                     time window), or a prebuilt template (e.g. "Purchasers," "Churned users")
Audiences can be used for: remarketing (Google Ads sync), Analytics segmentation, and audience-triggered
                            personalization via linked products
Audience membership is evaluated going forward from creation — it is NOT retroactively backfilled over
historical data by default.
```

## 🔗 Attribution Models

```text
Data-driven attribution (DDA): GA4's default — uses your own conversion data + machine learning to distribute
                                credit across touchpoints; requires enough data volume to train per-property
Other rule-based options (also available for comparison): Last click, First click, Linear, Time decay,
                                                            Position-based
Lookback window: default 90 days for most key events (30 days for app install key events)
Attribution reports (Advertising → Attribution) let you compare models side-by-side and inspect conversion paths
```

## 🐞 DebugView & Real-Time Debugging

```text
Admin → DebugView shows a live stream of events tagged with debug_mode=true, including full event_params —
        the fastest way to confirm a new event/parameter is firing correctly before waiting for it to
        appear in standard reports (which can take up to ~24-48 hours to fully process).

Enable debug mode:
  gtag('config', 'G-XXXXXXX', { 'debug_mode': true });     // web
  Chrome extension: "Google Analytics Debugger"
  Mobile: adb shell setprop debug.firebase.analytics.app <package_name>   // Android
```

## ☁️ BigQuery Export Schema

Linking a GA4 property to BigQuery (Admin → BigQuery Links) exports raw event-level data — one row per event, in daily-sharded tables, inside a dataset named `analytics_<property_id>`.

```text
Dataset: analytics_<property_id>
Tables:
  events_YYYYMMDD             → the finalized daily export, one row per event
  events_intraday_YYYYMMDD    → today's streaming (partial, continuously updated) table, if streaming export is on
  pseudonymous_users_*        → latest per-user state (pseudonymous IDs), on newer export configurations
  users_*                     → latest per-user state (for properties using User-ID)

Key top-level columns: event_date, event_timestamp, event_name, user_pseudo_id, user_id, platform,
                        device (STRUCT), geo (STRUCT), traffic_source (STRUCT), app_info / web_info (STRUCT)

Nested/repeated fields (require UNNEST to read):
  event_params    → ARRAY<STRUCT<key STRING, value STRUCT<string_value, int_value, float_value, double_value>>>
  user_properties → same key/value STRUCT shape as event_params
  items           → ARRAY of e-commerce line-item STRUCTs (item_id, item_name, price, quantity, ...)
```

Tables are **date-sharded** (`events_20260915`), not partitioned in the traditional BigQuery sense — query across a date range with a wildcard table and a `_TABLE_SUFFIX` filter, not a `WHERE event_date BETWEEN` on a single non-wildcard table.

## 🧮 Common BigQuery Queries on GA4 Export

```sql
-- Page views by day across a date range (wildcard table + _TABLE_SUFFIX)
SELECT
  event_date,
  COUNT(*) AS page_views
FROM `my-project.analytics_123456789.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260801' AND '20260831'
  AND event_name = 'page_view'
GROUP BY event_date
ORDER BY event_date;

-- Pull a specific event_param value out of the nested array
SELECT
  event_name,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_location,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS session_id
FROM `my-project.analytics_123456789.events_20260915`
WHERE event_name = 'page_view';

-- Sessions and pageviews per user (session_id + user_pseudo_id define a session)
SELECT
  user_pseudo_id,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS session_id,
  COUNTIF(event_name = 'page_view') AS pageviews
FROM `my-project.analytics_123456789.events_20260915`
GROUP BY 1, 2;

-- Flatten e-commerce items for revenue analysis
SELECT
  event_date,
  item.item_name,
  SUM(item.price * item.quantity) AS revenue
FROM `my-project.analytics_123456789.events_*`,
  UNNEST(items) AS item
WHERE event_name = 'purchase'
  AND _TABLE_SUFFIX BETWEEN '20260801' AND '20260831'
GROUP BY 1, 2
ORDER BY revenue DESC;
```

## 🔌 GA4 Data API

The Data API is GA4's programmatic reporting interface (successor to the old Reporting API) — same dimension/metric model as the UI, callable via REST or client libraries.

```python
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import RunReportRequest, DateRange, Dimension, Metric

client = BetaAnalyticsDataClient()

request = RunReportRequest(
    property="properties/123456789",
    dimensions=[Dimension(name="country")],
    metrics=[Metric(name="activeUsers"), Metric(name="sessions")],
    date_ranges=[DateRange(start_date="2026-08-01", end_date="2026-08-31")],
)
response = client.run_report(request)

for row in response.rows:
    print(row.dimension_values[0].value, row.metric_values[0].value, row.metric_values[1].value)
```

```json
// Equivalent raw REST request
POST https://analyticsdata.googleapis.com/v1beta/properties/123456789:runReport
{
  "dateRanges": [{ "startDate": "2026-08-01", "endDate": "2026-08-31" }],
  "dimensions": [{ "name": "country" }],
  "metrics": [{ "name": "activeUsers" }, { "name": "sessions" }],
  "orderBys": [{ "metric": { "metricName": "activeUsers" }, "desc": true }],
  "limit": "10"
}
```

Use the **Data API** for programmatic pulls of processed/aggregated report-style data (dimension + metric combinations, rate-limited, quota-managed) — use the **BigQuery export** when you need raw event-level rows, custom joins, or historical reprocessing beyond what the API's dimension/metric model exposes.

## 📐 Core Dimensions & Metrics Reference

```text
Common dimensions: date, country, city, deviceCategory, browser, operatingSystem, sessionDefaultChannelGroup,
                    sessionSource, sessionMedium, sessionCampaignName, pagePath, pageTitle, eventName,
                    landingPage, newVsReturning
Common metrics:     activeUsers, totalUsers, newUsers, sessions, engagedSessions, engagementRate,
                     averageSessionDuration, eventCount, conversions (key events), eventValue,
                     totalRevenue, purchaseRevenue, itemsViewed, addToCarts, checkouts
```

## 🍪 Consent Mode & Data Thresholds

```text
Consent Mode: gtag('consent', 'default'/'update', { ad_storage, analytics_storage, ... }) adjusts what GA4
              collects based on a user's cookie/consent choice; without analytics_storage consent, GA4 uses
              modeled/cookieless pings and behavioral modeling to estimate gaps in reporting.

Data thresholds: Google suppresses reports that could re-identify a small number of users when Google Signals
                 (or certain demographic/interest dimensions) are enabled — you'll see "Data thresholds applied"
                 with rows silently omitted rather than an error, on properties/report combinations with low volume.
```

## 🔄 GA4 vs. Universal Analytics

```text
Universal Analytics (UA)                     GA4
─────────────────────────                    ───
Session-based hit model (pageview/event/...)  Pure event-based model (everything is an event)
Goals                                         Key events (formerly "conversions")
Bounce rate = single-hit sessions             Engagement rate = inverse framing (engaged sessions / sessions);
                                               bounce rate exists too, defined as the complement
Views (multiple per property)                 No Views — use Explorations/comparisons/sub-properties instead
Default 4-day-max session timeout             Configurable session timeout (default 30 min)
Custom Dimensions: session/hit/user/product   Custom Dimensions: event-scoped or user-scoped only
scope (4 scope types)
Client-side sampling in standard reports      Sampling only in Explorations beyond certain thresholds;
                                               standard reports are unsampled
```

UA (Universal Analytics) stopped processing new hits in mid-2023 for standard properties — any legacy UA-era implementation still referenced in older docs/dashboards is fully retired and GA4 is the only current version.

## 🔐 Data Retention & Privacy Controls

```text
Admin → Data Settings → Data Retention: event-level data retention window (2 or 14 months) — this controls
        how far back Explorations with user-scoped dimensions can look; aggregated standard reports are
        not subject to this same deletion.
Admin → Data Settings → Data Collection: toggles for Google Signals (cross-device data via signed-in Google users)
IP anonymization is the default/only behavior in GA4 (no opt-in toggle like old UA _anonymizeIp).
```

## ⚠️ Common Gotchas

- **Key events are counted only from the moment you mark them** — flipping the toggle doesn't retroactively count historical events that already fired before that point.
- **`event_params` values are typed across four mutually-exclusive columns** (`string_value`, `int_value`, `float_value`, `double_value`) — only one is populated per key, and picking the wrong one in a query returns `NULL` instead of an error.
- **BigQuery export tables are date-sharded, not partitioned** — a query without `_TABLE_SUFFIX` filtering on a wildcard table scans (and bills for) every day of data ever exported.
- **Data thresholds silently drop rows rather than erroring** — a report that looks incomplete or "off" on a low-traffic property/segment may just be threshold suppression, not a tracking bug.
- **Explorations can be sampled on high-traffic properties/date ranges; standard reports are not** — the same metric can show slightly different numbers in the two places for exactly this reason.
- **GA4 has no Views** — there's no built-in way to create isolated filtered copies of a property's data the way UA Views did; use separate properties, Explorations comparisons, or BigQuery-side filtering instead.
- **`gtag('config', ...)` sends an automatic `page_view` event on every call** — calling `config` more than once per page load (a common SPA mistake) can silently double-count pageviews unless `send_page_view: false` is set for subsequent calls.

## 🎯 Best Practices

- Use Google's recommended event names and parameters wherever one fits, instead of inventing a custom event that duplicates existing functionality — it unlocks pre-built e-commerce/reporting features.
- Set up DebugView verification for every new event/parameter before considering the implementation "done" — waiting for it to appear in standard reports the next day is a slow, error-prone feedback loop.
- Link to BigQuery from day one on any property where deeper analysis is likely — raw event data isn't retroactively exportable once time has passed, only forward from the link date.
- Keep custom dimension/parameter naming consistent across web and app streams if a property spans both — mismatched names fragment the same real-world concept into two separate fields.
- Document key event definitions (what exactly counts and why) somewhere outside the GA4 UI — the toggle itself doesn't capture business context for future team members.

## 💡 Pro Tips

1. **`debug_mode` events don't count toward regular reporting** — safe to fire as many test events as needed without polluting production data.
2. **The `items` array on e-commerce events can carry custom item-level parameters** (not just the standard fields) for richer product-level analysis.
3. **A sequential audience (ordered steps within a time window)** catches funnels a simple "did X and Y" condition-based audience would miss.
4. **Compare Data-Driven Attribution against Last Click in the Attribution report** before trusting DDA blindly on a low-volume property — it needs enough conversion data to model well.
5. **`_TABLE_SUFFIX` range queries plus a `WHERE event_name = ...` filter early** dramatically cuts BigQuery bytes scanned versus filtering after the fact.
6. **Cross-domain measurement requires explicit configuration** (Admin → Data Streams → Configure tag settings → Configure your domains) — without it, sessions split at the domain boundary and traffic looks self-referral.
7. **The GA4 Data API's `limit`/`offset` and `orderBys` let you paginate large dimension combinations** server-side instead of pulling everything and sorting client-side.
8. **User-scoped custom dimensions persist across sessions**, while event-scoped ones only apply to the specific event they were sent with — pick the scope based on whether the value describes the user or just this moment.
9. **Looker Studio (free) connects directly to both the GA4 property and its BigQuery export** — use the property connector for quick dashboards, the BigQuery connector when you need custom SQL-modeled data.
10. **Realtime reports only show ~30 minutes of activity** — for anything needing a longer live-monitoring window, build a scheduled query against the `events_intraday_*` BigQuery table instead.

## 🛒 Enhanced E-commerce Events Deep Dive

```javascript
// The standard e-commerce funnel, as recommended GA4 events — using the right names unlocks
// pre-built e-commerce reports automatically
gtag('event', 'view_item', {
  currency: 'USD',
  value: 49.99,
  items: [{ item_id: 'SKU123', item_name: 'Widget', item_category: 'Gadgets', price: 49.99 }]
});

gtag('event', 'add_to_cart', {
  currency: 'USD',
  value: 49.99,
  items: [{ item_id: 'SKU123', item_name: 'Widget', quantity: 1, price: 49.99 }]
});

gtag('event', 'begin_checkout', {
  currency: 'USD',
  value: 49.99,
  items: [{ item_id: 'SKU123', item_name: 'Widget', quantity: 1, price: 49.99 }]
});

gtag('event', 'add_shipping_info', { currency: 'USD', value: 49.99, shipping_tier: 'Standard' });
gtag('event', 'add_payment_info', { currency: 'USD', value: 49.99, payment_type: 'Credit Card' });

gtag('event', 'purchase', {
  transaction_id: 'T12345',
  currency: 'USD',
  value: 49.99,
  tax: 4.50,
  shipping: 5.00,
  coupon: 'SUMMER10',
  items: [{ item_id: 'SKU123', item_name: 'Widget', quantity: 1, price: 49.99 }]
});

gtag('event', 'refund', { transaction_id: 'T12345', currency: 'USD', value: 49.99 });
```

```text
The full funnel view (Monetization → Purchase journey report) automatically stitches these events into
a step-by-step drop-off funnel — but ONLY if the standard event names and item-array structure are used
consistently; custom event names for the same actions won't populate the built-in e-commerce reports.
```

## 📱 GA4 for App Analytics (Firebase)

```text
GA4 unified web and app analytics under one property type — app data streams are powered by the
Firebase SDK under the hood, sharing the same event/parameter data model as web.

Firebase SDK event logging (Android/Kotlin example):
  firebaseAnalytics.logEvent("purchase") {
      param(FirebaseAnalytics.Param.VALUE, 49.99)
      param(FirebaseAnalytics.Param.CURRENCY, "USD")
  }

App-specific automatically collected events: first_open, app_update, os_update, app_remove,
                                              in_app_purchase, app_exception, notification_receive

Cross-platform user identification: a shared user_id (set via setUserId()) lets GA4 stitch the same
                                     person's web session and app session into one user journey when
                                     they're logged in on both — without it, web and app are separate,
                                     pseudonymous user_pseudo_id populations even in the same property.

Deep linking & attribution: Firebase Dynamic Links (legacy, being sunset) or platform-native deep links
                             feed install-attribution data into GA4's Acquisition reports for app streams.
```

## 🖥️ Server-Side Tagging

```text
Server-side GTM (sGTM): instead of the browser sending hits directly to Google's collection endpoint,
                         the browser sends one first-party request to a tagging SERVER you control
                         (typically Cloud Run/App Engine), which then fans it out to GA4, Ads, and other
                         destinations.

Benefits:
  - First-party cookie/data collection improves resilience against browser ITP/ad-blocker restrictions
  - Enrich or filter events server-side before they leave your infrastructure (e.g., strip PII, add a
    server-only computed field, deduplicate)
  - Centralize destination configuration (GA4, Ads, Meta CAPI, etc.) in one server container instead
    of loading multiple third-party scripts client-side, improving page load performance

Trade-offs: added infrastructure to host/maintain, and it doesn't eliminate the need for the client-side
            tag entirely — sGTM is a relay/processing layer, not a replacement for sending events at all.
```

## 🧮 Advanced BigQuery Patterns

```sql
-- User-level funnel: % of users completing each step of a checkout funnel, in order
WITH funnel AS (
  SELECT
    user_pseudo_id,
    MAX(IF(event_name = 'view_item', 1, 0)) AS viewed,
    MAX(IF(event_name = 'add_to_cart', 1, 0)) AS added_to_cart,
    MAX(IF(event_name = 'begin_checkout', 1, 0)) AS began_checkout,
    MAX(IF(event_name = 'purchase', 1, 0)) AS purchased
  FROM `my-project.analytics_123456789.events_*`
  WHERE _TABLE_SUFFIX BETWEEN '20260801' AND '20260831'
  GROUP BY user_pseudo_id
)
SELECT
  SUM(viewed) AS step1_viewed,
  SUM(IF(viewed = 1, added_to_cart, 0)) AS step2_added_to_cart,
  SUM(IF(added_to_cart = 1, began_checkout, 0)) AS step3_began_checkout,
  SUM(IF(began_checkout = 1, purchased, 0)) AS step4_purchased
FROM funnel;

-- Session reconstruction: session-level summary from raw events (GA4 has no pre-built "sessions" table)
SELECT
  user_pseudo_id,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS session_id,
  MIN(event_timestamp) AS session_start,
  MAX(event_timestamp) AS session_end,
  COUNTIF(event_name = 'page_view') AS pageviews,
  COUNTIF(event_name = 'purchase') AS purchases,
  SUM(IF(event_name = 'purchase',
      (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'value'), 0)) AS session_revenue
FROM `my-project.analytics_123456789.events_20260915`
GROUP BY 1, 2;

-- Cross-platform user stitching: combine web + app activity for logged-in users sharing a user_id
SELECT
  user_id,
  platform,
  COUNT(*) AS events,
  COUNT(DISTINCT (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id')) AS sessions
FROM `my-project.analytics_123456789.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260801' AND '20260831'
  AND user_id IS NOT NULL
GROUP BY 1, 2
ORDER BY user_id, platform;

-- Attribution-style last-non-direct-click source/medium per conversion
SELECT
  event_date,
  traffic_source.source AS source,
  traffic_source.medium AS medium,
  COUNTIF(event_name = 'purchase') AS purchases,
  SUM(IF(event_name = 'purchase',
      (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'value'), 0)) AS revenue
FROM `my-project.analytics_123456789.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260801' AND '20260831'
GROUP BY 1, 2, 3
ORDER BY revenue DESC;
```

## 📚 Worked Examples Across Business Scenarios {#worked-examples-across-business-scenarios-ga4}

### 1. Setting Up and Verifying a New Key Event End-to-End

**Scenario:** A product team ships a new "Start Free Trial" button and needs it tracked as a key event, verified working before reporting on it in a launch review.

```javascript
// 1. Instrument the event where the button is clicked
document.getElementById('start-trial-btn').addEventListener('click', () => {
  gtag('event', 'start_trial', {
    plan_type: 'Pro',
    debug_mode: true   // temporarily, for verification — remove before final ship
  });
});
```

```text
2. Open Admin → DebugView, click the button on a staging/debug session, confirm the event appears
   with the correct plan_type parameter within seconds.
3. Admin → Events → find "start_trial" (it must fire at least once before it's selectable) →
   toggle "Mark as key event."
4. Remove the debug_mode: true flag before the production release — DebugView events don't populate
   standard reports, so leaving it in would silently exclude real users' trial starts from reporting.
5. Confirm in the standard Conversions report the following day that start_trial counts are appearing
   (standard reports can take up to 24-48 hours to fully process new data).
```

### 2. Building a Marketing Channel Performance Query in BigQuery

**Scenario:** Marketing needs a weekly report of revenue by acquisition channel that the GA4 UI's session-scoped attribution model doesn't slice exactly the way finance wants.

```sql
SELECT
  FORMAT_DATE('%Y-%W', PARSE_DATE('%Y%m%d', event_date)) AS year_week,
  traffic_source.source AS source,
  traffic_source.medium AS medium,
  COUNT(DISTINCT user_pseudo_id) AS unique_visitors,
  COUNTIF(event_name = 'purchase') AS purchases,
  SUM(IF(event_name = 'purchase',
      (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'value'), 0)) AS revenue
FROM `my-project.analytics_123456789.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260801' AND '20260831'
GROUP BY 1, 2, 3
ORDER BY year_week, revenue DESC;
```

```text
Scheduled as a BigQuery scheduled query, writing results to a summary table that Looker Studio or a
Sheets connector picks up for the weekly deck — avoids re-deriving this from the raw export by hand
every week, and avoids the GA4 UI's default session-scoped attribution model when a different logic
(e.g., first-touch) is what finance actually wants to report on.
```

### 3. Debugging a "Missing" Key Event with DebugView

**Scenario:** A key event that used to fire reliably has stopped appearing in reports after a recent site redesign.

```text
1. Admin → DebugView, load the affected page/flow on a debug-enabled session — confirm whether the
   event fires at all client-side (if it never appears here, the instrumentation itself broke, likely
   in the redesign's JS changes).
2. If it DOES appear in DebugView but not in standard reports: check whether it's a data-threshold
   suppression issue (low volume + Google Signals enabled) rather than a tracking break — the
   Explorations "Data thresholds applied" indicator is the tell here.
3. If the event fires with different/missing parameters than before (e.g., item_id no longer populated
   because the redesign changed the DOM structure a script was reading from), the event still "exists"
   but downstream reports keyed on that parameter will look broken even though the event count itself
   looks fine.
```

### 4. Building a Consent-Aware Implementation

**Scenario:** A property serving EU traffic needs to respect cookie consent choices while still collecting what GA4 allows under Consent Mode.

```javascript
// Set default consent state BEFORE the GA4 config call, denying by default until the user responds
gtag('consent', 'default', {
  ad_storage: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500   // give the CMP banner up to 500ms to report the user's actual choice first
});

gtag('js', new Date());
gtag('config', 'G-XXXXXXX');

// When the user accepts via the cookie consent banner
function onConsentAccepted() {
  gtag('consent', 'update', {
    ad_storage: 'granted',
    analytics_storage: 'granted'
  });
}
```

```text
With analytics_storage denied, GA4 still receives cookieless "consent mode pings" and uses behavioral
modeling to estimate the gap in reporting rather than collecting nothing at all — reports on a
consent-heavy property will show a blend of real + modeled data, which is expected behavior, not a bug.
```

### 5. Cross-Platform Funnel Analysis (Web → App)

**Scenario:** A company wants to see how many users who first engaged on the web later completed a purchase in the mobile app.

```sql
WITH web_first_touch AS (
  SELECT user_id, MIN(event_timestamp) AS first_web_event
  FROM `my-project.analytics_123456789.events_*`
  WHERE platform = 'WEB' AND user_id IS NOT NULL
    AND _TABLE_SUFFIX BETWEEN '20260701' AND '20260731'
  GROUP BY user_id
),
app_purchase AS (
  SELECT user_id, MIN(event_timestamp) AS first_app_purchase
  FROM `my-project.analytics_123456789.events_*`
  WHERE platform IN ('IOS', 'ANDROID') AND event_name = 'purchase' AND user_id IS NOT NULL
    AND _TABLE_SUFFIX BETWEEN '20260701' AND '20260831'
  GROUP BY user_id
)
SELECT COUNT(*) AS web_to_app_converters
FROM web_first_touch w
JOIN app_purchase a ON w.user_id = a.user_id
WHERE a.first_app_purchase > w.first_web_event;
```

```text
This cross-platform stitching only works for users with a populated user_id (set via setUserId() on
both the web and app SDKs when they're logged in) — pseudonymous user_pseudo_id values are NOT
comparable across platforms, since they're generated independently per device/browser.
```
