# Reverse ETL Cheatsheet for Data Engineers

> A structured reference for pushing modeled warehouse data back into operational tools (CRM, support desk, ad platforms, email) — sync patterns, mapping and identity resolution, sync frequency trade-offs, and how Reverse ETL fits alongside CDC and traditional ETL.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 When to Use Reverse ETL](#when-to-use-reverse-etl)
4. [🏗️ Reference Architecture](#reference-architecture)
5. [🗺️ Field Mapping and Sync Definitions](#field-mapping-and-sync-definitions)
6. [🆔 Identity Resolution Across Systems](#identity-resolution-across-systems)
7. [🔁 Sync Strategies: Full vs Incremental](#sync-strategies-full-vs-incremental)
8. [⏱️ Sync Frequency Trade-offs](#sync-frequency-trade-offs)
9. [🛡️ Write-Path Safety and Rate Limits](#write-path-safety-and-rate-limits)
10. [🔄 Idempotency on the Destination Side](#idempotency-on-the-destination-side)
11. [🛠️ Tooling Landscape](#tooling-landscape)
12. [🧪 Testing Reverse ETL Syncs](#testing-reverse-etl-syncs)
13. [🔍 Monitoring and Alerting](#monitoring-and-alerting)
14. [⚠️ Common Gotchas](#common-gotchas)
15. [✅ Best Practices Checklist](#best-practices-checklist)
16. [📚 Reverse ETL vs CDC vs Traditional ETL](#reverse-etl-vs-cdc-vs-traditional-etl)
17. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| Direction | Warehouse → operational SaaS tool (opposite of ETL/ELT) |
| Common destinations | Salesforce, HubSpot, Zendesk, Intercom, Google/Meta Ads, Braze |
| Sync unit | A defined mapping: warehouse model → destination object/field |
| Identity resolution | A shared key (email, external ID) maps warehouse rows to destination records |
| Write safety | Respect destination rate limits; batch writes; upsert, never blind create |
| Common tools | Hightouch, Census, Fivetran (destinations), custom API scripts |

## 🧠 Core Concept

Reverse ETL takes data that's already been extracted, cleaned, and modeled in the warehouse — the "single source of truth" — and **pushes it back out** into the operational tools that sales, support, and marketing teams actually work in every day, so those teams don't have to context-switch into a BI tool to see warehouse-computed insights (like a customer health score or lifetime value).

```text
Traditional ETL:   operational tools --> warehouse (data flows IN for analysis)
Reverse ETL:       warehouse --> operational tools (modeled insight flows BACK OUT for action)

Example: a "customer_ltv" score computed in the warehouse from years of order history
         gets synced into Salesforce, so a sales rep sees it right on the account record.
```

## 🎯 When to Use Reverse ETL

**Use Reverse ETL when:**
- A modeled insight (churn risk, LTV, lead score) only has value if it reaches people in the tool they already work in daily.
- The warehouse is the best (or only) place capable of the underlying computation — joining data from many sources that no single operational tool has access to.
- Operational teams currently rely on manual CSV exports/imports to get warehouse insights into their tools — a clear sign a scheduled sync would help.

**Avoid Reverse ETL when:**
- The operational tool already has native access to the data it needs (e.g., a CRM's own activity data doesn't need a warehouse round-trip).
- The insight needs to be truly real-time (sub-minute) — most Reverse ETL tools sync on a schedule (minutes to hours), not continuously; consider a direct application integration instead.
- The volume/complexity doesn't justify the tooling — a one-off manual export might be perfectly fine for a rarely-needed sync.

## 🏗️ Reference Architecture

```text
Warehouse (modeled table: mart.customer_health_scores)
        │
        ▼
Reverse ETL tool (Hightouch/Census) — reads on a schedule, maps fields, calls destination API
        │
        ▼
Destination (Salesforce Account.Health_Score__c field)
```

```sql
-- The warehouse model is the source of truth — Reverse ETL just needs a clean, well-defined table to read from
CREATE OR REPLACE TABLE mart.customer_health_scores AS
SELECT
    c.customer_id,
    c.email,                          -- used for identity resolution in the destination
    compute_health_score(c.customer_id) AS health_score,
    CURRENT_TIMESTAMP() AS computed_at
FROM core.dim_customer c
WHERE c.is_current;
```

## 🗺️ Field Mapping and Sync Definitions

```yaml
# A sync definition — the core artifact of any Reverse ETL tool
sync:
  name: customer_health_to_salesforce
  source:
    model: mart.customer_health_scores
  destination:
    type: salesforce
    object: Account
  mapping:
    - source_field: email
      destination_field: PersonEmail   # used for matching, not just writing
    - source_field: health_score
      destination_field: Health_Score__c
    - source_field: computed_at
      destination_field: Health_Score_Updated_At__c
  matching:
    strategy: upsert
    match_on: PersonEmail
  schedule: "*/30 * * * *"   # every 30 minutes
```

Explicit, version-controlled sync definitions (rather than click-ops configuration buried in a SaaS tool's UI) mean field mappings are reviewable in a pull request, just like any other data pipeline change.

## 🆔 Identity Resolution Across Systems

```sql
-- The warehouse needs a reliable key that ALSO exists in the destination system —
-- email is common but imperfect (people change emails, share addresses); a stable external ID is better when available
SELECT
    c.customer_id,
    c.email,
    c.salesforce_account_id   -- if previously captured, this is a far more reliable match key than email
FROM core.dim_customer c;
```

```python
def resolve_identity_before_sync(customer):
    """Prefer a previously-captured destination-native ID; fall back to email matching,
    and log a warning when falling back, since email matching is inherently fuzzier."""
    if customer.salesforce_account_id:
        return {"match_field": "Id", "match_value": customer.salesforce_account_id}
    logging.warning(f"No Salesforce ID for {customer.customer_id}, falling back to email match")
    return {"match_field": "PersonEmail", "match_value": customer.email}
```

Identity resolution is the single highest-risk step in Reverse ETL: a bad match either creates duplicate records in the destination or silently overwrites the wrong record — always prefer a stable, previously-verified destination-native ID over a fuzzy field like email when one is available.

## 🔁 Sync Strategies: Full vs Incremental

```sql
-- Full sync: re-send every row every time — simple, but wasteful and rate-limit-hungry at scale
SELECT * FROM mart.customer_health_scores;

-- Incremental sync: only send rows that changed since the last sync
SELECT * FROM mart.customer_health_scores
WHERE computed_at > (SELECT MAX(last_synced_at) FROM sync_state WHERE sync_name = 'customer_health_to_salesforce');
```

| Strategy | Pros | Cons |
|---|---|---|
| Full sync | Simple, self-healing (fixes any destination drift every run) | Wasteful at scale, can hit destination API rate limits |
| Incremental sync | Efficient, respects rate limits | Requires reliable change tracking; a missed run needs a "catch-up" full sync to self-heal |

Most production Reverse ETL setups use incremental syncs day-to-day, with an occasional (e.g., weekly) full sync as a safety net to catch and correct any destination-side drift.

## ⏱️ Sync Frequency Trade-offs

| Frequency | Use case | Trade-off |
|---|---|---|
| Every few minutes | Sales needs near-real-time lead scoring | Higher API call volume, higher rate-limit risk |
| Hourly | Most operational use cases (health scores, usage metrics) | Good balance for the large majority of syncs |
| Daily | Less time-sensitive enrichment (firmographic data, historical aggregates) | Lowest cost, simplest to reason about |

Match sync frequency to how quickly the destination's consumers (sales reps, support agents) actually act on the data — syncing every 5 minutes for a metric a rep checks once a day is pure overhead.

## 🛡️ Write-Path Safety and Rate Limits

```python
def sync_with_rate_limit_handling(records, destination_client, batch_size=200):
    for batch in chunks(records, batch_size):
        try:
            destination_client.bulk_upsert(batch)
        except RateLimitExceeded as e:
            time.sleep(e.retry_after_seconds)
            destination_client.bulk_upsert(batch)   # retry after backoff
        except PartialBatchFailure as e:
            log_failed_records(e.failed_records)    # don't let one bad record fail the whole batch silently
            destination_client.bulk_upsert(e.succeeded_records)
```

Writing to an operational SaaS tool is fundamentally different from writing to your own warehouse — you don't control the destination's rate limits, schema quirks, or validation rules, so defensive batching, backoff, and partial-failure handling are mandatory, not optional polish.

## 🔄 Idempotency on the Destination Side

```python
def upsert_to_salesforce(record, external_id_field="Warehouse_Customer_Id__c"):
    """Use an EXTERNAL ID field the destination supports for native upsert,
    so a retried sync never creates a duplicate record."""
    salesforce_client.upsert(
        object_type="Account",
        external_id_field=external_id_field,
        external_id_value=record["customer_id"],
        fields=record,
    )
```

Most CRM/marketing platforms support an "external ID" concept specifically for this integration pattern — always use it rather than a plain "create" call, for the same idempotency reasons covered in [idempotent-pipelines.md](./Idempotent_Pipelines_Cheat_Sheet.md).

## 🛠️ Tooling Landscape

| Category | Tools |
|---|---|
| Managed Reverse ETL platforms | Hightouch, Census, Polytomic |
| ELT platforms with reverse capability | Fivetran (destinations), Airbyte |
| Custom/code-first | Direct API scripts orchestrated via Airflow/Dagster, for destinations with no managed connector |

## 🧪 Testing Reverse ETL Syncs

```python
def test_sync_upserts_not_duplicates(sandbox_destination):
    record = {"customer_id": "C042", "email": "test@example.com", "health_score": 87}
    sync_record(record, sandbox_destination)
    sync_record(record, sandbox_destination)   # sync twice
    matches = sandbox_destination.query(f"email = '{record['email']}'")
    assert len(matches) == 1   # not duplicated

def test_identity_resolution_prefers_native_id_over_email():
    customer = {"customer_id": "C042", "salesforce_account_id": "001xx0001", "email": "old@example.com"}
    resolved = resolve_identity_before_sync(customer)
    assert resolved["match_field"] == "Id"   # not the fuzzier email fallback

def test_sync_handles_partial_batch_failure_gracefully(mock_destination):
    mock_destination.fail_record("C013")
    result = sync_with_rate_limit_handling(test_batch, mock_destination)
    assert "C013" in result.failed
    assert all(r not in result.failed for r in test_batch if r["customer_id"] != "C013")
```

## 🔍 Monitoring and Alerting

```python
metrics = {
    "sync_name": "customer_health_to_salesforce",
    "records_attempted": len(batch),
    "records_succeeded": succeeded_count,
    "records_failed": failed_count,
    "sync_duration_seconds": elapsed,
    "rate_limit_hits": rate_limit_hit_count,
}
emit_metrics(metrics)
```

Track sync success rate, per-run failure counts (with enough detail to identify *which* records failed and why), and destination-side rate-limit hit frequency — a sync that "succeeds" while silently dropping 5% of records on every run is a common, easy-to-miss failure mode.

## ⚠️ Common Gotchas

- **Fuzzy identity matching (email-only) creating duplicate destination records** — prefer a stable, previously-verified external ID whenever one exists.
- **Blind "create" calls instead of upsert** — every retried sync then creates a fresh duplicate record in the destination.
- **No backoff/retry handling for destination rate limits** — a sync that fails outright on the first rate-limit response, instead of backing off and retrying, drops data silently.
- **Syncing far more frequently than consumers actually need** — needless API call volume increases both cost and rate-limit risk for no real benefit.
- **No monitoring for partial batch failures** — a sync can report "success" at the job level while individual records within a batch silently failed.
- **Treating the destination schema as static** — a SaaS tool renaming or restricting a custom field breaks the sync exactly like any other schema evolution problem, and needs the same discipline. See [schema-evolution.md](./Schema_Evolution_Cheat_Sheet.md).

## ✅ Best Practices Checklist

- [ ] Sync definitions (mappings, matching keys, schedule) are version-controlled, not click-ops only
- [ ] Identity resolution prefers a stable external ID over fuzzy fields like email
- [ ] Writes use upsert with an external ID field, never blind create
- [ ] Rate limits are handled with batching and exponential backoff
- [ ] Sync frequency matches how quickly consumers actually act on the data, not the maximum possible frequency
- [ ] Partial batch failures are captured and alerted on, not just overall job success/failure
- [ ] An occasional full sync exists as a self-healing safety net alongside incremental syncs

## 📚 Reverse ETL vs CDC vs Traditional ETL

| Dimension | Traditional ETL/ELT | CDC | Reverse ETL |
|---|---|---|---|
| Direction | Source system → warehouse | Source system → warehouse (continuous) | Warehouse → operational tool |
| Purpose | Bring data in for modeling/analysis | Keep warehouse close to a live source | Push modeled insight back out for action |
| Typical latency | Hours (batch) | Seconds-minutes | Minutes-hours (scheduled) |

See [change-data-capture.md](./Change_Data_Capture_Cheat_Sheet.md) for the inbound-continuous pattern this complements.

## 💡 Pro Tips

1. **Always use upsert with a stable external ID**, never a blind create, on every destination write.
2. **Prefer a previously-captured destination-native ID over email matching** whenever your data has one.
3. **Version-control sync definitions** so field mappings go through the same review process as any other pipeline code.
4. **Match sync frequency to actual consumer behavior**, not the tool's maximum polling rate.
5. **Build in backoff and partial-failure handling from day one** — writing to a SaaS API is fundamentally less forgiving than writing to your own warehouse.
6. **Run an occasional full sync as a safety net** alongside incremental syncs, to self-heal any destination-side drift.
7. **Monitor at the record level, not just the job level** — a "successful" sync can still silently drop individual failed records.
8. **Treat destination schema changes like any schema evolution risk** — a renamed CRM field breaks the sync just as surely as a renamed warehouse column.
9. **Keep the warehouse model that feeds the sync clean and well-tested** — Reverse ETL is only as trustworthy as the upstream model it reads from.
10. **Start with the highest-value, lowest-risk sync** (e.g., a read-mostly enrichment field) before syncing anything that triggers automated downstream actions (like an email campaign) in the destination tool.
