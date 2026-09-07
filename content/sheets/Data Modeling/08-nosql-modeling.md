# 8. NoSQL Data Modeling

## Core Mindset Shift

> **Relational modeling:** model the data structure first, then figure out how to query it.
> **NoSQL modeling:** model around your **access patterns** first — how will this data be queried? — then structure the data to make those queries fast, often duplicating data on purpose.

There's no universal normalization theory in NoSQL; each database family has its own modeling logic.

## 1. Document Stores (MongoDB, Couchbase, Firestore)

Data is stored as nested JSON-like documents. Related data is often **embedded** rather than joined.

### Embedding vs Referencing

| Approach | When to Use | Example |
|---|---|---|
| **Embed** | Child data is always accessed with the parent, has a bounded size, and doesn't need independent querying | Order embeds its line items |
| **Reference** | Child data is large, unbounded, shared across multiple parents, or queried independently | Order references a `customer_id` instead of embedding full customer profile |

### Example: Embedded Order Document
```json
{
  "_id": "order_1001",
  "customer_id": "cust_55",
  "order_date": "2026-08-20",
  "items": [
    { "product": "Laptop", "qty": 1, "price": 899.00 },
    { "product": "Mouse", "qty": 2, "price": 15.00 }
  ],
  "total": 929.00,
  "shipping_address": {
    "street": "123 Rizal St",
    "city": "Davao",
    "zip": "8000"
  }
}
```
`items` and `shipping_address` are embedded because they're always read/written together with the order and rarely queried independently.

### Example: Referencing (Avoiding Unbounded Growth)
```json
// customers collection
{ "_id": "cust_55", "name": "Jane Doe", "email": "jane@example.com" }

// orders collection — references customer instead of embedding
{ "_id": "order_1001", "customer_id": "cust_55", "total": 929.00 }
```
If a customer could have thousands of orders, embedding all orders inside the customer document would make it grow unbounded — reference instead.

### Document Modeling Rules of Thumb
- Data accessed together should live together (denormalize for read speed).
- Avoid unbounded arrays inside a document (a customer's "all-time orders" list could grow forever).
- Duplicate small, rarely-changing data (e.g., a `product_name` snapshot on an order) to avoid extra lookups.

## 2. Key-Value Stores (Redis, DynamoDB, Riak)

Data is a simple key → value mapping. Modeling is about **designing the key structure** to support your access patterns.

### Key Design Pattern
```
user:1001                → { name, email, ... }
user:1001:sessions        → [session1, session2]
cart:1001                 → { items: [...] }
leaderboard:global        → sorted set of scores
```

### DynamoDB Single-Table Design (Advanced Pattern)
DynamoDB modeling often puts multiple entity types in **one table**, using composite partition/sort keys to support several access patterns without joins.

```
PK              | SK              | Attributes
CUSTOMER#55     | METADATA        | name, email
CUSTOMER#55     | ORDER#1001      | order_date, total
CUSTOMER#55     | ORDER#1002      | order_date, total
PRODUCT#88      | METADATA        | name, price
```
Query "all orders for customer 55" → `PK = CUSTOMER#55 AND SK begins_with ORDER#`. This is the opposite of relational thinking: you design the table around *the queries*, not the entities.

## 3. Wide-Column Stores (Cassandra, HBase, Bigtable)

Rows can have different columns; data is partitioned by a **partition key** and sorted by a **clustering key**. Designed for massive write throughput.

```sql
CREATE TABLE sensor_readings (
    sensor_id UUID,
    reading_time TIMESTAMP,
    temperature DOUBLE,
    humidity DOUBLE,
    PRIMARY KEY (sensor_id, reading_time)
) WITH CLUSTERING ORDER BY (reading_time DESC);
```
`sensor_id` = partition key (distributes data across nodes); `reading_time` = clustering key (sorts data within a partition). Query pattern: "get latest readings for sensor X" — extremely fast because it's a single partition scan.

**Cassandra modeling rule:** "Query-first design" — literally write out every query you need to support *before* designing tables, and create a denormalized table per query pattern if needed.

## 4. Graph Databases (Neo4j, Amazon Neptune)

Data is modeled as **nodes** (entities) and **edges** (relationships), both of which can carry properties. Best for highly interconnected data where relationship traversal matters more than tabular structure.

```
(Person {name: "Jane"}) -[:FRIENDS_WITH {since: 2020}]-> (Person {name: "John"})
(Person {name: "Jane"}) -[:WORKS_AT]-> (Company {name: "Acme Corp"})
```

Example Cypher query — find friends-of-friends:
```cypher
MATCH (p:Person {name: "Jane"})-[:FRIENDS_WITH]->()-[:FRIENDS_WITH]->(fof)
RETURN DISTINCT fof.name
```

**When to reach for graph modeling:** social networks, recommendation engines, fraud detection (ring detection), knowledge graphs — anywhere relationship *depth* and *traversal* matter more than aggregate reporting.

## Choosing a NoSQL Model: Quick Decision Guide

| Need | Choice |
|---|---|
| Flexible schema, nested/hierarchical data, general app backend | Document store |
| Simple, ultra-fast lookups by key (caching, sessions) | Key-value store |
| Massive write throughput, time-series, IoT data | Wide-column store |
| Deep relationship traversal (friends-of-friends, fraud rings) | Graph database |

## Common Mistakes

- Applying relational normalization instincts to a document store, leading to excessive references/joins that NoSQL databases handle poorly.
- Letting an embedded array grow unbounded (e.g., embedding all comments ever made on a viral post inside one document — hits document size limits).
- Designing a Cassandra/DynamoDB table without listing access patterns first, then discovering it can't support a needed query without a full table scan.
- Ignoring eventual consistency implications — some NoSQL systems trade strict consistency for availability/partition tolerance (CAP theorem); model with that trade-off in mind.

---
[← Previous: Dimensional Modeling](07-dimensional-modeling.md) | [Back to index](00-README.md) | [Next: Notations & Tools →](09-notations-tools.md)
