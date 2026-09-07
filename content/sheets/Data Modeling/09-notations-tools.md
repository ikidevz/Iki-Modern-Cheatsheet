# 9. Notations & Tools

## ER Diagram Notations

### 1. Crow's Foot Notation (Most Common in Industry)

Uses line endings shaped like a "crow's foot" to show cardinality directly on the connecting line.

| Symbol | Meaning |
|---|---|
| `——|` | Exactly one |
| `——O` | Zero (optional) |
| `——<` | Many (crow's foot) |
| `——O<` | Zero or many |
| `——|<` | One or many |

Example — Customer to Order (one customer has zero or many orders; each order belongs to exactly one customer):
```
[Customer] ——|————O<—— [Order]
```

**Why it's popular:** Cardinality and optionality are readable directly on the diagram without extra labels — most modern tools (dbdiagram.io, MySQL Workbench, Lucidchart) default to this.

### 2. Chen Notation (Academic/Textbook Standard)

Uses diamonds for relationships and explicit `1`/`N`/`M` labels.

```
[Customer] ——1——(places)——N—— [Order]
```
Entities = rectangles, relationships = diamonds, attributes = ovals connected to entities. More verbose but very explicit — common in academic courses and formal specification documents.

### 3. UML Class Diagram Notation

Borrowed from software engineering; entities become "classes" with attributes and methods, relationships use association lines with multiplicity labels (`1`, `0..*`, `1..*`).

```
Customer "1" -- "0..*" Order
```
Common when data modeling overlaps with object-oriented system design (e.g., modeling both the database and the application's domain objects together).

### Notation Comparison

| Notation | Best For | Verbosity |
|---|---|---|
| Crow's Foot | Industry/production ER diagrams | Compact |
| Chen | Academic teaching, formal docs | Verbose but explicit |
| UML | Cross-discipline (dev + data) projects | Moderate |

## Common Data Modeling Tools

| Tool | Type | Notes |
|---|---|---|
| **dbdiagram.io** | Free, code-based (DBML) | Fast for quick ERDs, great for docs/wikis, exports SQL |
| **Lucidchart** | GUI-based diagramming | Great for conceptual diagrams & stakeholder collaboration |
| **draw.io / diagrams.net** | Free, GUI-based | General-purpose, no DB-specific validation |
| **ERwin Data Modeler** | Enterprise-grade | Strong for large enterprise logical/physical modeling, forward/reverse engineering |
| **MySQL Workbench** | Free, DB-specific | Reverse-engineers existing MySQL schemas into ERDs |
| **pgModeler** | Free, PostgreSQL-specific | Generates PostgreSQL DDL directly from diagrams |
| **SQLDBM** | Cloud-based | Good for team collaboration on cloud warehouse schemas |
| **dbt (data build tool)** | Not a diagramming tool, but modeling-adjacent | Used to define/document transformation models in the analytics/warehouse layer |

### Example DBML (dbdiagram.io syntax)
```dbml
Table customer {
  customer_id int [pk]
  name varchar
  email varchar [unique]
}

Table order_table {
  order_id int [pk]
  customer_id int [ref: > customer.customer_id]
  order_date date
}
```
This single block auto-generates a visual ER diagram with crow's foot notation — a fast way to prototype and share a schema with a team.

## Choosing a Tool: Quick Guide

| Situation | Tool |
|---|---|
| Quick diagram to share in Slack/docs | dbdiagram.io |
| Whiteboarding with non-technical stakeholders | Lucidchart / draw.io |
| Enterprise-scale modeling with governance needs | ERwin |
| Need to reverse-engineer an existing MySQL DB | MySQL Workbench |
| Need to generate real PostgreSQL DDL from a diagram | pgModeler |

## Reading an ER Diagram — Checklist

When handed someone else's ERD, check:
1. **Entities** — what are the boxes?
2. **Keys** — which attribute(s) are underlined / marked PK?
3. **Relationship lines** — what do the crow's-foot symbols say about cardinality?
4. **Optionality** — is the "zero" circle present, or is it mandatory?
5. **Junction tables** — any table that looks like it exists purely to connect two others (M:N resolution)?

---
[← Previous: NoSQL Modeling](08-nosql-modeling.md) | [Back to index](00-README.md) | [Next: Best Practices & Anti-patterns →](10-best-practices-antipatterns.md)
