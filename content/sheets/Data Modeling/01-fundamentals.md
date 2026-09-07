# 1. Fundamentals of Data Modeling

## What is Data Modeling?

Data modeling is the process of defining how data is structured, stored, and related within a system — turning business requirements into a blueprint a database can implement.

**Analogy:** Data modeling is to a database what architectural blueprints are to a building. You wouldn't pour concrete before drawing the plans; you shouldn't create tables before modeling the data.

## Why It Matters (On-the-Job Reasoning)

- **Prevents data integrity issues** — bad models let contradictory or duplicate data exist.
- **Impacts performance** — a poorly modeled schema causes slow joins, bloated storage, and painful migrations later.
- **Drives communication** — a model is a shared language between engineers, analysts, and business stakeholders.
- **Reduces long-term cost** — fixing a modeling mistake after production launch is far more expensive than fixing it on a whiteboard.

## The Three Levels of Modeling

| Level          | Audience                 | Focus                                                      | Example                                               |
| -------------- | ------------------------ | ---------------------------------------------------------- | ----------------------------------------------------- |
| **Conceptual** | Business stakeholders    | Entities & relationships, no tech detail                   | "A Customer places an Order"                          |
| **Logical**    | Data architects/analysts | Precise attributes, keys, normalization, still DB-agnostic | `Customer(customer_id PK, name, email)`               |
| **Physical**   | DBAs/Engineers           | Actual implementation in a specific DBMS                   | `customer_id INT PRIMARY KEY AUTO_INCREMENT` in MySQL |

## The Data Modeling Process (Typical Workflow)

1. **Gather requirements** — interview stakeholders, review existing reports/queries.
2. **Identify entities** — the "nouns" of the business (Customer, Order, Product).
3. **Define relationships** — how entities connect and at what cardinality.
4. **Build conceptual model** — high-level ER diagram, no attributes yet.
5. **Build logical model** — add attributes, keys, apply normalization rules.
6. **Build physical model** — choose data types, indexes, partitioning for the target DBMS.
7. **Validate against use cases** — run through sample queries/reports to confirm the model supports them.
8. **Iterate** — models evolve; document changes and version them.

## Core Vocabulary

| Term                | Meaning                                                                       |
| ------------------- | ----------------------------------------------------------------------------- |
| **Entity**          | A distinct object/concept the business cares about (e.g., Customer, Product)  |
| **Attribute**       | A property of an entity (e.g., Customer.email)                                |
| **Relationship**    | An association between two or more entities                                   |
| **Cardinality**     | How many instances of one entity relate to another (1:1, 1:N, M:N)            |
| **Key**             | An attribute (or set of) that uniquely identifies a record                    |
| **Schema**          | The overall structure — collection of tables/entities and their relationships |
| **Normalization**   | Organizing data to reduce redundancy                                          |
| **Denormalization** | Deliberately adding redundancy to optimize read performance                   |

## Types of Data Models by Use Case

- **OLTP (Online Transaction Processing)** — optimized for writes/updates, highly normalized. Think: order-processing system.
- **OLAP (Online Analytical Processing)** — optimized for reads/aggregation, often dimensional (star schema). Think: BI dashboards.
- **Operational vs Analytical** — operational = "run the business" (current state), analytical = "understand the business" (historical trends).

## Common On-the-Job Triggers to Revisit a Model

- A new feature needs a relationship the current schema can't express.
- Query performance degrades as data volume grows.
- Reporting requires joins across too many tables (may need denormalization/warehouse).
- Duplicate or conflicting data appears (normalization gap).
