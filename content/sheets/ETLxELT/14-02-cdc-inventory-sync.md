# Example 2: CDC-Based Near-Real-Time Inventory Sync

**Pipeline Type: ELT** — CDC events land raw and append-only in Snowflake first; the MERGE/transform into `inventory_current` happens after load, inside the warehouse.

## Scenario & Business Context

A warehouse management system's inventory counts must reach the analytics warehouse within minutes so that a stockout-risk dashboard stays accurate. Daily batch sync is too slow, and polling the source database frequently would add unacceptable load to a system serving live warehouse operations.

## Architecture

```
MySQL (inventory DB, binlog enabled)
   │  log-based CDC (no polling load)
   ▼
Debezium Connector
   │  publishes row-level change events
   ▼
Kafka topic: inventory_changes
   │  Kafka Connect Snowflake Sink
   ▼
Snowflake raw.inventory_changes  (append-only, Bronze)
   │  dbt incremental MERGE model
   ▼
Snowflake curr.inventory_current  (Gold — current state)
   │
   ▼
Stockout Risk Dashboard
```

## Full Implementation

### 1. Debezium connector config

```json
{
  "name": "inventory-connector",
  "config": {
    "connector.class": "io.debezium.connector.mysql.MySqlConnector",
    "database.hostname": "inventory-db.internal",
    "database.server.id": "184054",
    "database.server.name": "inventory",
    "table.include.list": "warehouse.inventory",
    "database.history.kafka.bootstrap.servers": "kafka:9092",
    "database.history.kafka.topic": "schema-changes.inventory",
    "snapshot.mode": "initial",
    "tombstones.on.delete": "true"
  }
}
```

### 2. Kafka Connect Snowflake sink (simplified)

```json
{
  "name": "snowflake-sink-inventory",
  "config": {
    "connector.class": "com.snowflake.kafka.connector.SnowflakeSinkConnector",
    "topics": "inventory_changes",
    "snowflake.topic2table.map": "inventory_changes:raw.inventory_changes",
    "buffer.flush.time": "60",
    "buffer.count.records": "10000"
  }
}
```

### 3. Incremental MERGE model (dbt)

```sql
-- models/curr/inventory_current.sql
{{ config(materialized='incremental', unique_key='sku') }}

WITH latest_change AS (
  SELECT
    payload:after:sku::STRING          AS sku,
    payload:after:quantity::NUMBER     AS quantity,
    payload:source:ts_ms::NUMBER       AS change_ts,
    payload:op::STRING                 AS op   -- 'c'=create, 'u'=update, 'd'=delete
  FROM {{ source('raw', 'inventory_changes') }}
  {% if is_incremental() %}
  WHERE payload:source:ts_ms::NUMBER > (SELECT MAX(change_ts) FROM {{ this }})
  {% endif %}
  QUALIFY ROW_NUMBER() OVER (PARTITION BY payload:after:sku::STRING ORDER BY payload:source:ts_ms::NUMBER DESC) = 1
)

SELECT sku, quantity, change_ts, op
FROM latest_change
WHERE op != 'd'
```

```sql
-- post-hook (config block) handles deletes separately:
{{ config(
    materialized='incremental',
    unique_key='sku',
    post_hook="DELETE FROM {{ this }} WHERE sku IN (
      SELECT payload:after:sku::STRING FROM {{ source('raw','inventory_changes') }}
      WHERE payload:op::STRING = 'd'
      AND payload:source:ts_ms::NUMBER > (SELECT COALESCE(MAX(change_ts),0) FROM {{ this }})
    )"
) }}
```

### 4. Freshness monitoring

```yaml
# models/curr/schema.yml
sources:
  - name: raw
    tables:
      - name: inventory_changes
        loaded_at_field: "payload:source:ts_ms::NUMBER"
        freshness:
          warn_after: {count: 10, period: minute}
          error_after: {count: 30, period: minute}
```

## Design Rationale

- **Log-based CDC (Debezium)** instead of polling avoids adding query load to a database serving live warehouse operations, and captures deletes — which a timestamp-based incremental pull would miss entirely (see file 02).
- **Kafka as durable buffer** decouples the source system's availability from the warehouse's ingestion schedule; if Snowflake sink is down for 20 minutes, no events are lost — they replay from Kafka once it recovers.
- **`QUALIFY` dedup + idempotent MERGE** ensures the pipeline is safe to re-run or reprocess a Kafka partition without creating incorrect quantities (see file 04 — Idempotency).
- **Separate delete handling** — CDC delete events don't have an `after` payload, so they're processed via a dedicated post-hook rather than folded into the main MERGE logic.

## Production Considerations

- **Schema evolution** — Debezium publishes schema alongside each event; alert if the MySQL table schema changes unexpectedly (see file 02 — Schema Drift).
- **Kafka topic retention** — set retention long enough (e.g., 7 days) to allow reprocessing after a downstream outage without needing a full Debezium re-snapshot.
- **Exactly-once vs at-least-once** — this design tolerates at-least-once delivery because the MERGE is idempotent; don't assume Kafka guarantees exactly-once without additional transactional configuration (see file 06).

## How to Extend This Example

- Add a **history table** (`inventory_history`) alongside `inventory_current` to preserve the full CDC log for auditability (SCD Type 4 pattern, see file 03).
- Fan out the same Kafka topic to a Flink job for real-time low-stock alerting, in addition to the batched Snowflake sink.
- Add **row-count reconciliation** — periodically compare `inventory_current` totals against a direct MySQL count to catch silent sync drift.
