# Debezium / CDC Tooling Cheatsheet for Data & Analytics Engineers

> A structured reference for change data capture — Debezium architecture, connector configuration (MySQL/Postgres/MongoDB/SQL Server), message envelopes, single message transforms, the outbox pattern, and operational patterns.

## 📑 Table of Contents

1. [🧠 CDC Core Concepts](#cdc-core-concepts)
2. [🚀 Setup: Kafka Connect vs Debezium Server](#setup-kafka-connect-vs-debezium-server)
3. [🔌 Connector Configuration](#connector-configuration)
4. [📨 Change Event Structure](#change-event-structure)
5. [📸 Snapshotting](#snapshotting)
6. [🔧 Single Message Transforms (SMTs)](#single-message-transforms-smts)
7. [📦 The Outbox Pattern](#the-outbox-pattern)
8. [🗺️ Topic Routing & Schema Evolution](#topic-routing-schema-evolution)
9. [🏗️ Consuming CDC Streams Downstream](#consuming-cdc-streams-downstream)
10. [📊 Monitoring & Operations](#monitoring-operations)
11. [🔄 Alternatives & Comparisons](#alternatives-comparisons)
12. [🗄️ SQL Server & Oracle Connectors](#sql-server-oracle-connectors)
13. [🧩 Debezium Embedded Engine](#debezium-embedded-engine)
14. [☸️ Deploying Kafka Connect on Kubernetes](#deploying-kafka-connect-on-kubernetes)
15. [🧪 Testing CDC Pipelines](#testing-cdc-pipelines)
16. [🔁 Exactly-Once & Idempotent Consumption Deep Dive](#exactly-once-idempotent-consumption-deep-dive)
17. [⚠️ Common Gotchas](#common-gotchas)
18. [🎯 Best Practices](#best-practices)
19. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Task                          | Command / Config                                                          |
| ------------------------------- | ----------------------------------------------------------------------------- |
| Register a connector            | `curl -X POST localhost:8083/connectors -d @mysql-connector.json`          |
| List connectors                 | `curl localhost:8083/connectors`                                           |
| Connector status                | `curl localhost:8083/connectors/<name>/status`                             |
| Restart a connector             | `curl -X POST localhost:8083/connectors/<name>/restart`                    |
| Pause / resume                  | `curl -X PUT localhost:8083/connectors/<name>/pause` (`/resume`)           |
| Delete a connector              | `curl -X DELETE localhost:8083/connectors/<name>`                          |
| Trigger ad-hoc snapshot         | Insert a signal row into the configured `signal.data.collection`           |
| Change event `op` values        | `c` (create), `u` (update), `d` (delete), `r` (read/snapshot)              |

## 🧠 CDC Core Concepts

- **Change Data Capture (CDC)** streams row-level `INSERT`/`UPDATE`/`DELETE` events out of a database as they happen, instead of periodically polling/batch-extracting.
- **Log-based CDC** (what Debezium does) reads the database's own transaction/replication log (MySQL binlog, Postgres WAL, SQL Server CT/CDC tables, MongoDB oplog/change streams) — low overhead, captures every change, preserves ordering.
- **Debezium** is a set of Kafka Connect **source connectors** that turn those logs into a stream of structured change events on Kafka topics (or, via Debezium Server, directly to Kinesis/Pub/Sub/Pulsar/etc. without Kafka).
- **One topic per table** by default — a table `inventory.orders` becomes a Kafka topic like `dbserver1.inventory.orders`, keyed by the table's primary key.
- **At-least-once delivery** — consumers must handle duplicate events (idempotent upserts keyed by primary key are the standard fix).

```
DB transaction log → Debezium connector (Kafka Connect task) → Kafka topic(s) → downstream consumers
                                                                 (or Debezium Server → Kinesis/Pub-Sub/Pulsar directly)
```

## 🚀 Setup: Kafka Connect vs Debezium Server

```bash
# Option A: Kafka Connect (distributed, standard for production)
# Run Connect workers pointed at your Kafka cluster, then register connectors via REST.
curl -X POST -H "Content-Type: application/json" \
  localhost:8083/connectors -d @mysql-connector.json

# Option B: Debezium Server (no Kafka Connect cluster needed; ships events to a sink directly)
# application.properties
debezium.sink.type=kinesis
debezium.sink.kinesis.region=us-east-1
debezium.source.connector.class=io.debezium.connector.postgresql.PostgresConnector
debezium.source.database.hostname=localhost
debezium.source.database.port=5432
debezium.source.database.user=debezium
debezium.source.database.dbname=inventory
debezium.source.topic.prefix=dbserver1
```

```yaml
# docker-compose.yml snippet for local dev (Kafka + Connect + Debezium UI)
services:
  kafka: { image: quay.io/debezium/kafka, environment: { CLUSTER_ID: dbz }, ports: ["9092:9092"] }
  connect:
    image: quay.io/debezium/connect
    environment:
      BOOTSTRAP_SERVERS: kafka:9092
      GROUP_ID: 1
      CONFIG_STORAGE_TOPIC: connect_configs
      OFFSET_STORAGE_TOPIC: connect_offsets
      STATUS_STORAGE_TOPIC: connect_statuses
    ports: ["8083:8083"]
  debezium-ui:
    image: quay.io/debezium/debezium-ui
    environment: { KAFKA_CONNECT_URIS: http://connect:8083 }
    ports: ["8080:8080"]
```

## 🔌 Connector Configuration

```json
// MySQL connector
{
  "name": "mysql-inventory-connector",
  "config": {
    "connector.class": "io.debezium.connector.mysql.MySqlConnector",
    "database.hostname": "mysql",
    "database.port": "3306",
    "database.user": "debezium",
    "database.password": "dbz",
    "database.server.id": "184054",
    "topic.prefix": "dbserver1",
    "database.include.list": "inventory",
    "table.include.list": "inventory.orders,inventory.customers",
    "schema.history.internal.kafka.bootstrap.servers": "kafka:9092",
    "schema.history.internal.kafka.topic": "schema-changes.inventory",
    "include.schema.changes": "true"
  }
}
```

```json
// PostgreSQL connector (requires logical replication + a replication slot)
{
  "name": "postgres-inventory-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres",
    "database.port": "5432",
    "database.user": "debezium",
    "database.password": "dbz",
    "database.dbname": "inventory",
    "topic.prefix": "dbserver1",
    "plugin.name": "pgoutput",
    "slot.name": "debezium_slot",
    "publication.autocreate.mode": "filtered",
    "table.include.list": "public.orders,public.customers"
  }
}
```

```json
// MongoDB connector (uses native change streams — no plugin needed)
{
  "name": "mongodb-connector",
  "config": {
    "connector.class": "io.debezium.connector.mongodb.MongoDbConnector",
    "mongodb.connection.string": "mongodb://mongo:27017/?replicaSet=rs0",
    "topic.prefix": "dbserver1",
    "collection.include.list": "inventory.orders"
  }
}
```

```sql
-- Postgres prerequisites
ALTER SYSTEM SET wal_level = 'logical';
-- restart Postgres, then grant replication + create publication (or let the connector auto-create)
CREATE PUBLICATION dbz_publication FOR TABLE orders, customers;
```

## 📨 Change Event Structure

```json
// A Debezium change event envelope (simplified, "before/after" pattern)
{
  "before": null,
  "after": {
    "id": 1001,
    "customer_id": 42,
    "amount": 59.99,
    "status": "PLACED"
  },
  "source": {
    "version": "2.6.0.Final",
    "connector": "mysql",
    "db": "inventory",
    "table": "orders",
    "ts_ms": 1718000000000,
    "file": "mysql-bin.000003",
    "pos": 154
  },
  "op": "c",
  "ts_ms": 1718000000123
}
```

| `op` value | Meaning | `before` | `after` |
| --- | --- | --- | --- |
| `c` | Create (INSERT) | `null` | row values |
| `u` | Update | pre-image (if configured) | post-image |
| `d` | Delete | pre-image | `null`, followed by a tombstone |
| `r` | Read (initial snapshot) | `null` | row values |

```
# Tombstone events: after a delete (`op: d`), Debezium emits a second record
# with the same key and a null value — this is what tells Kafka's log compaction
# to eventually remove the key entirely.
```

## 📸 Snapshotting

```json
// snapshot.mode options
"snapshot.mode": "initial"          // default: full snapshot on first start, then stream
"snapshot.mode": "no_data"          // schema-only snapshot, stream from current position
"snapshot.mode": "when_needed"      // snapshot if no valid offset is found
"snapshot.mode": "incremental"      // read-only, non-blocking snapshot alongside streaming (recommended for large tables)
```

```sql
-- Trigger an incremental (ad-hoc) snapshot via a signal table
INSERT INTO debezium_signal (id, type, data)
VALUES ('ad-hoc-1', 'execute-snapshot',
        '{"data-collections": ["inventory.orders"], "type": "incremental"}');
```

- **Initial snapshot** locks/reads the whole table before streaming begins — can be slow and briefly lock large tables depending on the connector's locking mode.
- **Incremental snapshotting** (Debezium 1.6+) chunks the table into windows and interleaves snapshot reads with live streaming, avoiding long locks — the default recommendation for large production tables.

## 🔧 Single Message Transforms (SMTs)

```json
{
  "transforms": "unwrap,route",
  "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
  "transforms.unwrap.drop.tombstones": "false",
  "transforms.unwrap.delete.handling.mode": "rewrite",
  "transforms.unwrap.add.fields": "op,source.ts_ms",

  "transforms.route.type": "org.apache.kafka.connect.transforms.RegexRouter",
  "transforms.route.regex": "dbserver1\\.inventory\\.(.*)",
  "transforms.route.replacement": "cdc.$1"
}
```

| SMT | Purpose |
| --- | --- |
| `ExtractNewRecordState` ("unwrap") | Flattens the before/after envelope into a plain row, adding `__op`/`__deleted` metadata fields — the standard choice for sinks that just want current row state |
| `RegexRouter` | Rename/redirect topics, e.g. strip the server prefix or fan multiple tables into one topic |
| `Filter` (SMT + predicate) | Drop events matching a condition (e.g., skip soft-deleted test accounts) |
| `MaskField` | Redact PII columns (e.g., `ssn`, `email`) before events leave Kafka Connect |
| `TimestampConverter` | Normalize timestamp formats/timezones downstream consumers expect |

## 📦 The Outbox Pattern

```sql
-- Application writes business data + an outbox event in the same local transaction
BEGIN;
UPDATE orders SET status = 'SHIPPED' WHERE id = 1001;
INSERT INTO outbox_event (id, aggregatetype, aggregateid, type, payload)
VALUES (gen_random_uuid(), 'Order', '1001', 'OrderShipped', '{"orderId": 1001, "status": "SHIPPED"}');
COMMIT;
```

```json
// Debezium's built-in outbox event router SMT
{
  "transforms": "outbox",
  "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
  "transforms.outbox.table.field.event.id": "id",
  "transforms.outbox.table.field.event.key": "aggregateid",
  "transforms.outbox.table.field.event.payload": "payload",
  "transforms.outbox.route.by.field": "aggregatetype",
  "transforms.outbox.route.topic.replacement": "outbox.event.${routedByValue}"
}
```

- Solves the **dual-write problem**: without the outbox table, an app can update the DB and fail to publish an event (or vice versa), leaving systems inconsistent.
- CDC on the outbox table turns "write a row" into "reliably publish a domain event," using the database's own transaction as the atomicity guarantee.
- Business-meaningful events (`OrderShipped`) replace raw row-diffs as the contract with downstream consumers — a cleaner, more stable interface than exposing internal table structure.

## 🗺️ Topic Routing & Schema Evolution

```json
"topic.prefix": "dbserver1"                 // topics become dbserver1.<db>.<table>
"table.include.list": "inventory.orders"    // only capture specific tables
"column.exclude.list": "inventory.orders.internal_notes"  // drop sensitive/unused columns
"decimal.handling.mode": "double"           // or "precise" (as a Struct) / "string"
"time.precision.mode": "connect"            // consistent timestamp precision downstream
```

- Debezium tracks **DDL changes** (`schema.history.internal.kafka.topic` for MySQL, or Postgres's own catalog) and evolves the Kafka Connect schema of the change events automatically — consumers using schema registries (Avro/Protobuf) get compatible schema evolution for free if using the Confluent/Apicurio converters.
- Use **`column.include.list`/`column.exclude.list`** to keep PII or irrelevant columns out of the event stream entirely, rather than filtering downstream.

## 🏗️ Consuming CDC Streams Downstream

```sql
-- Sink connector: JDBC sink applying CDC events as upserts (with the "unwrap" SMT applied upstream)
{
  "name": "jdbc-sink",
  "config": {
    "connector.class": "io.confluent.connect.jdbc.JdbcSinkConnector",
    "topics": "cdc.orders",
    "connection.url": "jdbc:postgresql://warehouse:5432/analytics",
    "insert.mode": "upsert",
    "pk.mode": "record_key",
    "pk.fields": "id",
    "delete.enabled": "true"
  }
}
```

```sql
-- Flink SQL consuming Debezium JSON directly (no separate unwrap step needed)
CREATE TABLE orders_cdc (
    id INT, customer_id INT, amount DECIMAL(10,2), status STRING,
    PRIMARY KEY (id) NOT ENFORCED
) WITH (
    'connector' = 'kafka',
    'topic' = 'dbserver1.inventory.orders',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'debezium-json'
);
```

- **Iceberg/Delta CDC sinks** (e.g., via Flink or Spark Structured Streaming) apply Debezium events as MERGE/upsert operations, keeping a lakehouse table in sync with an OLTP source in near real time.
- **Keyed compaction topics** — configure the Kafka topic as log-compacted so the topic itself becomes a durable "latest state" changelog, not just an event log.

## 📊 Monitoring & Operations

```bash
curl localhost:8083/connectors/mysql-inventory-connector/status
curl localhost:8083/connectors/mysql-inventory-connector/tasks/0/status
```

- **JMX metrics**: `MilliSecondsBehindSource` (replication lag — the single most important health metric), `NumberOfEventsFiltered`, `QueueRemainingCapacity`, snapshot progress counters.
- **Debezium UI** — register/manage connectors, view status and metrics without hand-rolling `curl` calls against the REST API.
- Watch for a **growing replication slot (Postgres)** — if a connector is down/lagging, the WAL cannot be recycled and can fill the disk; monitor `pg_replication_slots` directly as a backstop.

## 🔄 Alternatives & Comparisons

| Tool | Approach | Notes |
| --- | --- | --- |
| Debezium | Log-based CDC via Kafka Connect | Open source, broadest DB support, requires Kafka (or Debezium Server) |
| AWS DMS | Managed log-based CDC | Good for AWS-native pipelines, less flexible transform story |
| Fivetran / Airbyte HVR | Managed CDC + ELT | Less operational overhead, less control, cost scales with volume |
| Postgres logical replication (native) | Built-in `pglogical`/`pgoutput` | No Kafka needed for Postgres-to-Postgres, but no fan-out to arbitrary sinks |
| Maxwell's Daemon | MySQL binlog → JSON on Kafka | Lighter-weight than Debezium, MySQL-only, fewer features (no outbox pattern, fewer SMTs) |
| Oracle GoldenGate | Commercial log-based CDC | Enterprise Oracle/heterogeneous replication, licensing cost |

## 🗄️ SQL Server & Oracle Connectors

```json
// SQL Server connector — requires CDC to be enabled on the DB and each captured table
{
  "name": "sqlserver-connector",
  "config": {
    "connector.class": "io.debezium.connector.sqlserver.SqlServerConnector",
    "database.hostname": "sqlserver",
    "database.port": "1433",
    "database.user": "debezium",
    "database.password": "dbz",
    "database.names": "Inventory",
    "topic.prefix": "dbserver1",
    "table.include.list": "dbo.Orders,dbo.Customers",
    "schema.history.internal.kafka.bootstrap.servers": "kafka:9092",
    "schema.history.internal.kafka.topic": "schema-changes.inventory"
  }
}
```

```sql
-- Prerequisites: enable CDC at the database and table level
USE Inventory;
EXEC sys.sp_cdc_enable_db;
EXEC sys.sp_cdc_enable_table
    @source_schema = 'dbo', @source_name = 'Orders', @role_name = NULL, @supports_net_changes = 0;
```

```json
// Oracle connector (via LogMiner or XStream)
{
  "name": "oracle-connector",
  "config": {
    "connector.class": "io.debezium.connector.oracle.OracleConnector",
    "database.hostname": "oracle",
    "database.port": "1521",
    "database.user": "c##dbzuser",
    "database.password": "dbz",
    "database.dbname": "ORCLCDB",
    "database.pdb.name": "ORCLPDB1",
    "topic.prefix": "dbserver1",
    "schema.include.list": "DEBEZIUM",
    "database.connection.adapter": "logminer"
  }
}
```

- **SQL Server** captures changes via SQL Server's own native CDC feature (change tables populated by an agent job) rather than a direct transaction-log tail — Debezium polls those change tables.
- **Oracle** most commonly uses **LogMiner** (built into the DB, no extra licensing, higher latency) or **XStream** (lower latency, requires an additional Oracle license) to read the redo log.
- Both require more upfront DBA-side setup than MySQL/Postgres — plan for coordination with the database team before onboarding these sources.

## 🧩 Debezium Embedded Engine

```java
// Run Debezium inside your own JVM application — no Kafka Connect cluster at all.
// Useful for lightweight sync tools, custom routing logic, or embedding CDC in an existing service.
Configuration config = Configuration.create()
    .with("name", "embedded-engine")
    .with("connector.class", "io.debezium.connector.postgresql.PostgresConnector")
    .with("database.hostname", "localhost")
    .with("database.port", "5432")
    .with("database.user", "debezium")
    .with("database.password", "dbz")
    .with("database.dbname", "inventory")
    .with("topic.prefix", "dbserver1")
    .with("offset.storage", "org.apache.kafka.connect.storage.FileOffsetBackingStore")
    .with("offset.storage.file.filename", "/tmp/offsets.dat")
    .build();

DebeziumEngine<ChangeEvent<String, String>> engine = DebeziumEngine.create(Json.class)
    .using(config.asProperties())
    .notifying(record -> {
        System.out.println("Key: " + record.key() + " Value: " + record.value());
        // route directly into your own application logic, e.g., update a search index
    })
    .build();

ExecutorService executor = Executors.newSingleThreadExecutor();
executor.execute(engine);
```

- Trades Kafka Connect's operational scaffolding (REST API, distributed rebalancing, connector plugin ecosystem) for **simplicity and direct control** — a good fit when you just need CDC feeding one application, not fanning out to many consumers.
- Offset storage must be handled carefully in embedded mode — `FileOffsetBackingStore` is fine for a single instance, but doesn't work for a horizontally-scaled or highly-available deployment without a shared backing store.

## ☸️ Deploying Kafka Connect on Kubernetes

```yaml
# Using Strimzi's KafkaConnect + KafkaConnector CRDs (the standard cloud-native pattern)
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaConnect
metadata:
  name: debezium-connect-cluster
  annotations: { strimzi.io/use-connector-resources: "true" }
spec:
  version: 3.7.0
  replicas: 3
  bootstrapServers: my-kafka-cluster-kafka-bootstrap:9092
  config:
    group.id: debezium-connect-cluster
    offset.storage.topic: connect-offsets
    config.storage.topic: connect-configs
    status.storage.topic: connect-status
  build:
    output: { type: docker, image: my-registry/debezium-connect:latest }
    plugins:
      - name: debezium-postgres-connector
        artifacts:
          - type: tgz
            url: https://repo1.maven.org/.../debezium-connector-postgres-2.6.0.Final-plugin.tar.gz
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaConnector
metadata:
  name: postgres-inventory-connector
  labels: { strimzi.io/cluster: debezium-connect-cluster }
spec:
  class: io.debezium.connector.postgresql.PostgresConnector
  tasksMax: 1
  config:
    database.hostname: postgres
    database.dbname: inventory
    topic.prefix: dbserver1
    plugin.name: pgoutput
```

```bash
kubectl apply -f kafka-connect.yaml
kubectl apply -f postgres-connector.yaml
kubectl get kafkaconnectors
```

- **Strimzi** turns connector configs into native Kubernetes objects (`KafkaConnector`), so connector lifecycle is managed with `kubectl`/GitOps instead of hand-rolled `curl` calls against the Connect REST API.
- The `build` section lets Strimzi bake connector plugins into a custom image automatically instead of manually managing a plugin directory on every worker.

## 🧪 Testing CDC Pipelines

```java
// Testcontainers: spin up a real Postgres + Kafka + Debezium Connect stack for integration tests
@Testcontainers
class OrderCdcIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16")
        .withCommand("postgres -c wal_level=logical");

    @Container
    static DebeziumContainer debezium = new DebeziumContainer("debezium/connect:2.6")
        .withKafka(kafka)
        .dependsOn(kafka);

    @Test
    void insertingAnOrderProducesAChangeEvent() throws Exception {
        debezium.registerConnector("postgres-connector", buildConnectorConfig(postgres));

        try (Connection conn = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            conn.createStatement().execute("INSERT INTO orders (id, amount) VALUES (1, 99.99)");
        }

        ConsumerRecords<String, String> records = consumeFromTopic("dbserver1.public.orders", Duration.ofSeconds(10));
        assertThat(records).hasSize(1);
        assertThat(records.iterator().next().value()).contains("\"op\":\"c\"");
    }
}
```

```python
# Lighter-weight: assert on event shape using a local Kafka consumer + the Debezium testing library
# (or, for pure transform-logic tests, unit test your SMT/consumer code against a fixture JSON payload)
import json

def test_unwrap_extracts_after_state():
    envelope = json.load(open("fixtures/order_created_event.json"))
    row = unwrap_debezium_envelope(envelope)
    assert row["id"] == 1001
    assert row["__op"] == "c"
```

- **Testcontainers** (`testcontainers-java`'s `DebeziumContainer`, or the Python `testcontainers` equivalent) give the highest-fidelity CDC tests — real WAL/binlog behavior, real connector configuration — at the cost of slower test runs; reserve for a focused integration suite.
- For fast unit tests, **fixture-based testing of your own downstream consumer/SMT logic** (feed it a captured real event JSON payload) is usually sufficient and doesn't require any live database.

## 🔁 Exactly-Once & Idempotent Consumption Deep Dive

```sql
-- Idempotent upsert pattern for a downstream sink consuming CDC events
-- (works regardless of duplicate delivery, out only requires the event's own key + op)
MERGE INTO warehouse.orders AS target
USING (SELECT :id AS id, :amount AS amount, :op AS op) AS src
ON target.id = src.id
WHEN MATCHED AND src.op = 'd' THEN DELETE
WHEN MATCHED THEN UPDATE SET amount = src.amount
WHEN NOT MATCHED AND src.op != 'd' THEN INSERT (id, amount) VALUES (src.id, src.amount);
```

```java
// Kafka Connect's own exactly-once support (source connectors, Kafka 3.3+)
// Enables the framework itself to avoid duplicate delivery on connector task restart
"exactly.once.support": "required"   // worker-level Connect config, requires a transactional Kafka setup
```

- **Debezium's own delivery guarantee is at-least-once** — after a crash/restart, it resumes from the last committed offset, which can replay a small number of already-seen events; this is normal, not a bug.
- **Idempotency at the consumer** (keyed upsert/delete by primary key, as shown above) is the standard, portable way to get effectively-once *outcomes* even with at-least-once *delivery* — this works with any sink, not just ones with native transactional support.
- **Kafka Connect's exactly-once source support** (worker-level config) removes duplicate-on-restart at the Kafka-write layer itself, but downstream consumers reading from that topic still need to handle their own idempotency unless every hop in the chain is also transactional.

## ⚠️ Common Gotchas

- **Replication slots that aren't consumed will grow forever** (Postgres) — a paused/deleted connector without slot cleanup can fill disk and even take down the source database.
- **Schema history topic must never be deleted** (MySQL) — losing `schema.history.internal.kafka.topic` makes it impossible to correctly parse binlog events referencing older schema versions; back it up like you would the database itself.
- **At-least-once delivery means duplicates are normal** — downstream consumers must be idempotent (upsert by primary key, not blind append) or you will double-count.
- **Large `UPDATE`/`DELETE` transactions can spike event volume** — a single bulk update touching a million rows emits a million change events; plan Kafka partition/consumer throughput accordingly.
- **`before` image is `null` for updates unless configured** (MySQL needs `REPLICA IDENTITY FULL` in Postgres, or binlog row image settings in MySQL) — without it you can't see what changed, only the new state.
- **Initial snapshots can lock tables** depending on connector/locking mode — always prefer `incremental` snapshot mode for large, actively-written production tables.
- **Decimal precision surprises** — the default `decimal.handling.mode` can silently lose precision (`double`) unless you explicitly choose `precise` or `string` for financial data.

## 🎯 Best Practices

- Default to **incremental snapshotting** for any table beyond a few million rows.
- Apply the **`ExtractNewRecordState` (unwrap) SMT** at the source unless your downstream tool natively understands the Debezium envelope (Flink/Kafka Streams do; most JDBC sinks don't).
- Use the **outbox pattern** for publishing business events, and raw table CDC only for replication/sync use cases — don't expose internal schema as a public event contract.
- Exclude PII columns at the connector level (`column.exclude.list`) rather than relying on every downstream consumer to filter it.
- Alert on **replication lag** (`MilliSecondsBehindSource`) and **replication slot size**, not just connector "RUNNING" status — a connector can be up and still falling behind.

## 💡 Pro Tips

1. **Log-compacted Kafka topics turn a CDC stream into a durable current-state store** — consumers that come online later still get the full latest picture, not just new events.
2. **Debezium Server is the lightweight option** when you don't already run Kafka — it ships straight to Kinesis, Pub/Sub, Pulsar, or Redis Streams.
3. **Signal tables let you trigger snapshots, pause/resume, and stop connectors declaratively** — useful for automation without touching the REST API.
4. **`ts_ms` in the `source` block is the database commit time; the top-level `ts_ms` is when Debezium processed it** — use the source one for true event-time semantics downstream.
5. **Test schema evolution before it happens in prod** — add/drop a column in a staging DB and confirm your downstream sink and stream processor both handle the new schema gracefully.
6. **A tombstone-aware sink is required for deletes to actually propagate** — a sink that ignores null-value records will silently accumulate stale rows forever.
