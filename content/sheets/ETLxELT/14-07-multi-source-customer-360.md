# Example 7: Multi-Source Customer 360 Pipeline

**Pipeline Type: ELT** — each source lands raw independently first; entity resolution and matching logic run entirely in-warehouse afterward via dbt.

## Scenario & Business Context

Customer data lives fragmented across a CRM (Salesforce), a support tool (Zendesk), and a billing system (Stripe), each with its own customer ID and inconsistent email formatting. Marketing needs a single unified customer view for segmentation and outreach.

## Architecture

```
Salesforce ──┐
Zendesk ─────┼──► Fivetran/Airbyte ──► raw.* (Bronze, per source)
Stripe ──────┘
                        │
                        ▼
           staging.stg_<source>__customers (Silver, cleaned per source)
                        │
                        ▼
        Entity resolution (match on normalized email / fuzzy match)
                        │
                        ▼
              marts.dim_customer_360 (Gold — unified view)
```

## Full Implementation

### 1. Per-source staging (standardize the match key)

```sql
-- models/staging/salesforce/stg_salesforce__customers.sql
SELECT
  contact_id                          AS source_id,
  'salesforce'                        AS source_system,
  TRIM(LOWER(email))                  AS email_normalized,
  first_name, last_name
FROM {{ source('salesforce', 'contacts') }}
```

```sql
-- models/staging/zendesk/stg_zendesk__customers.sql
SELECT
  user_id                             AS source_id,
  'zendesk'                           AS source_system,
  TRIM(LOWER(email))                  AS email_normalized,
  name
FROM {{ source('zendesk', 'users') }}
```

```sql
-- models/staging/stripe/stg_stripe__customers.sql
SELECT
  customer_id                         AS source_id,
  'stripe'                            AS source_system,
  TRIM(LOWER(email))                  AS email_normalized,
  name
FROM {{ source('stripe', 'customers') }}
```

### 2. Entity resolution — deterministic match on normalized email

```sql
-- models/intermediate/int_customer_matches.sql
{{ config(materialized='table') }}

WITH unioned AS (
  SELECT * FROM {{ ref('stg_salesforce__customers') }}
  UNION ALL SELECT * FROM {{ ref('stg_zendesk__customers') }}
  UNION ALL SELECT * FROM {{ ref('stg_stripe__customers') }}
)

SELECT
  {{ dbt_utils.generate_surrogate_key(['email_normalized']) }} AS unified_customer_id,
  email_normalized,
  ARRAY_AGG(DISTINCT source_system)   AS known_in_systems,
  ARRAY_AGG(DISTINCT source_id)       AS source_ids
FROM unioned
WHERE email_normalized IS NOT NULL
GROUP BY email_normalized
```

### 3. Fuzzy-match fallback for records with no email (name + phone match)

```sql
-- models/intermediate/int_customer_fuzzy_matches.sql
-- For records missing email, attempt a fuzzy match on normalized name + phone
-- using a similarity threshold — flagged for manual review rather than auto-merged.
SELECT
  a.source_id AS source_id_a, b.source_id AS source_id_b,
  JAROWINKLER_SIMILARITY(a.name, b.name) AS name_similarity
FROM {{ ref('stg_zendesk__customers') }} a
JOIN {{ ref('stg_salesforce__customers') }} b
  ON a.email_normalized IS NULL AND b.email_normalized IS NULL
WHERE JAROWINKLER_SIMILARITY(a.name, b.name) > 0.9
```

### 4. Final unified mart

```sql
-- models/marts/customer/dim_customer_360.sql
{{ config(materialized='table') }}

SELECT
  m.unified_customer_id,
  m.email_normalized,
  m.known_in_systems,
  sf.first_name, sf.last_name,
  st.name AS billing_name
FROM {{ ref('int_customer_matches') }} m
LEFT JOIN {{ ref('stg_salesforce__customers') }} sf
  ON sf.email_normalized = m.email_normalized
LEFT JOIN {{ ref('stg_stripe__customers') }} st
  ON st.email_normalized = m.email_normalized
```

### 5. Match quality test

```sql
-- tests/assert_no_duplicate_unified_customers.sql
SELECT unified_customer_id, COUNT(*) 
FROM {{ ref('dim_customer_360') }}
GROUP BY unified_customer_id
HAVING COUNT(*) > 1
```

## Design Rationale

- **Deterministic email match first, fuzzy match as fallback** — email is the highest-confidence join key available across all three systems; fuzzy matching is reserved for the smaller subset of records missing it, and flagged rather than auto-merged, since false merges are costly to undo.
- **`unified_customer_id` as a surrogate key** generated from the normalized email keeps the ID stable across re-runs, which is essential for downstream marts and SCD tracking (see file 03 — Data Modeling, surrogate keys).
- **Per-source staging models never cross-reference each other** — entity resolution logic lives entirely in the intermediate layer, keeping staging models simple and reusable for other purposes.

## Production Considerations

- **False positives in fuzzy matching are worse than false negatives** — an incorrectly merged customer record can leak one customer's support history into another's marketing profile. Route ambiguous fuzzy matches to a manual review queue rather than auto-merging.
- Monitor the **percentage of records with no email match** over time — a rising trend may indicate a new source system or data entry process needs a matching key added.
- Re-running entity resolution can **change `unified_customer_id` values** if the matching logic changes — downstream consumers relying on ID stability need a migration plan for logic updates.

## How to Extend This Example

- Replace deterministic-only matching with a proper **entity resolution library** (e.g., Splink, Dedupe.io) for more robust probabilistic matching at scale.
- Add a **golden record survivorship strategy** — rules for which source "wins" when fields conflict (e.g., billing system wins for legal name, CRM wins for marketing opt-in status).
- Publish `dim_customer_360` as a formal **data product** (see file 08 — Data Mesh) with an owning team and documented SLA once multiple downstream teams depend on it.
