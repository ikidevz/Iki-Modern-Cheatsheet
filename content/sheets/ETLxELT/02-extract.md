# Extract

## Source Types

**Definition:** The category of system data is being pulled from, which determines the extraction method, tooling, and constraints available.

**Key Points:**
- Databases — OLTP systems (Postgres, MySQL, SQL Server) via JDBC/ODBC or log-based CDC.
- APIs — REST/GraphQL, usually paginated and rate-limited.
- Files — CSV, JSON, Parquet, Avro dropped in SFTP/S3/GCS buckets.
- Event Streams — Kafka, Kinesis, Pub/Sub — continuous event feeds.
- SaaS Applications — Salesforce, HubSpot, Stripe — via managed connectors or native APIs.

**Example:**
```
Postgres (JDBC) → Airbyte connector → staging schema
Stripe API → Fivetran connector → raw.stripe_transactions
S3 CSV drop → scheduled loader → raw.landing_zone
```

**When to Use / Trade-offs:**
- Managed connectors (Fivetran/Airbyte) reduce engineering effort for common SaaS/DB sources.
- Custom extraction is justified when a source has no reliable connector, or when fine-grained control (custom retry logic, field-level filtering) is required.

**Common Pitfalls:**
- Building custom API extraction for a source that already has a well-maintained managed connector.
- Not documenting source system quirks (timezone, soft-deletes, nullable business keys) that later break downstream logic.

---

## Extraction Patterns

**Definition:** The strategy used to determine which rows are pulled on each pipeline run.

**Key Points:**
- Full Load — pull the entire dataset every run.
- Incremental Load — pull only new/changed rows using a watermark column.
- CDC (Change Data Capture) — capture row-level inserts/updates/deletes from the database transaction log.

**Example:**

| Pattern | Latency | Source Load | Complexity |
|---|---|---|---|
| Full Load | High | High | Low |
| Incremental (timestamp) | Medium | Low | Medium |
| CDC (log-based) | Low | Very Low | High |

```sql
-- Incremental extraction watermark
SELECT * FROM source_table WHERE updated_at > :last_run_timestamp;
```

**When to Use / Trade-offs:**
- Full load is fine for small reference tables (< tens of thousands of rows).
- Incremental load is the default for most operational tables.
- CDC is worth the added complexity for high-volume tables or near-real-time requirements, and it also captures deletes, which timestamp-based incremental often misses.

**Common Pitfalls:**
- Using an `updated_at` watermark on a table where deletes aren't tracked — deleted rows silently vanish downstream without being recorded as deletes.
- Clock skew between application servers causing missed or duplicated rows at the watermark boundary.

---

## Schema Drift

**Definition:** Unannounced changes to a source system's schema — new columns, changed types, renamed or removed fields — that can silently break or corrupt downstream pipelines.

**Key Points:**
- Common causes: application deploys, third-party API version changes, manual database edits.
- Left unhandled, schema drift causes pipeline failures, silent data loss, or type-casting errors.

**Example:**
- A SaaS API adds a new `discount_code` field with no deprecation notice — a strict schema pipeline fails; a permissive one silently drops the field.

**When to Use / Trade-offs:**
- Strict schema enforcement (fail on drift) is safer for critical financial or compliance data.
- Permissive schema handling (ignore/log unknown fields) is better for high-velocity, low-risk sources where uptime matters more than catching every change immediately.

**Common Pitfalls:**
- No alerting on schema changes — teams find out weeks later when a report looks wrong.
- Silently coercing type mismatches (e.g., string to int) instead of flagging them, corrupting data quietly.

---

## Schema-on-Read vs Schema-on-Write

**Definition:** Determines *when* a schema is enforced — at the moment data is written (write) or at the moment it's queried (read).

**Key Points:**
- Schema-on-write — schema enforced at ingestion (traditional warehouses); malformed data is rejected immediately.
- Schema-on-read — schema applied at query time (data lakes); ingestion is flexible, validation happens later.

**Example:**
- Schema-on-write: loading into a Snowflake table with a fixed `NUMBER(10,2)` column rejects non-numeric input at load time.
- Schema-on-read: dumping raw JSON into S3, then applying a schema only when queried via Athena/Presto.

**When to Use / Trade-offs:**
- Schema-on-write catches bad data early but is rigid to evolving sources.
- Schema-on-read is flexible for ingestion but pushes the burden of dealing with malformed data downstream to every consumer.

**Common Pitfalls:**
- Schema-on-read with no documentation or shared schema registry, leaving each consumer to guess the structure independently.

---

## Rate Limiting & Pagination Handling

**Definition:** Techniques for extracting data from APIs without violating provider limits or missing records across paginated responses.

**Key Points:**
- Respect `Retry-After` headers and documented rate-limit quotas.
- Implement exponential backoff on `429`/`503` responses.
- Handle pagination via `offset/limit`, `cursor`, or `page tokens`, depending on the API's design.
- Checkpoint pagination progress so a failed run resumes mid-extraction rather than restarting from page one.

**Example:**
```python
while next_cursor:
    resp = api_get(url, params={"cursor": next_cursor})
    if resp.status_code == 429:
        time.sleep(backoff_seconds)
        continue
    save_checkpoint(next_cursor)
    next_cursor = resp.json().get("next_cursor")
```

**When to Use / Trade-offs:**
- Cursor-based pagination is generally more reliable than offset-based for large or frequently-changing datasets (offsets shift as rows are inserted/deleted mid-extraction).

**Common Pitfalls:**
- No checkpointing — a failure on page 400 of 500 forces a full restart.
- Ignoring rate-limit headers and getting the extraction job's IP/API key temporarily banned.
