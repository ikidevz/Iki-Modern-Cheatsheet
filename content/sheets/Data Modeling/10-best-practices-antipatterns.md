# 10. Best Practices & Anti-patterns

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Table names | Plural or singular, but **consistent** across the whole schema | `customers` / `customer` (pick one) |
| Primary key | `<table>_id` or just `id` | `customer_id` |
| Foreign key | Match the referenced PK name | `customer_id` in `orders` |
| Junction tables | Combine both entity names | `student_course` or `enrollment` |
| Boolean columns | Prefix with `is_`/`has_` | `is_active`, `has_shipped` |
| Date/time columns | Suffix with `_at` (timestamp) or `_date` (date only) | `created_at`, `order_date` |
| Avoid reserved words | Don't name a column `order`, `group`, `user` without quoting | Use `order_table` or `app_user` instead |

**On-the-job rule:** Consistency beats "correctness." A team that agrees on singular table names is better off than a mixed schema with some singular, some plural.

## Documentation Practices

- Maintain a **data dictionary**: table name, column name, data type, description, nullable?, example value.
- Document **why**, not just what — e.g., "denormalized `customer_name` here for reporting speed; source of truth is `customers.name`."
- Keep ERDs in version control alongside migration scripts (DBML files work well for this — plain text, diffable).
- Record **SCD strategy** per dimension table (see file 7) so future engineers know if history is tracked.

## General Best Practices

1. **Model for the questions you'll actually ask.** Before finalizing a schema, write out 5-10 real queries/reports it needs to support.
2. **Start normalized, denormalize deliberately.** Don't denormalize "just in case" — do it in response to a measured performance need.
3. **Use surrogate keys for PKs**, keep natural/business keys as unique constraints.
4. **Enforce integrity at the database level** (constraints, FKs) — don't rely solely on application code.
5. **Version your schema.** Use migration tools (Flyway, Liquibase, Alembic, Prisma Migrate) rather than manual ad-hoc changes.
6. **Separate operational and analytical models.** Don't force your OLTP schema to also serve as your BI warehouse.
7. **Plan for growth early on volume-sensitive columns** (e.g., use `BIGINT` for PKs on tables expected to scale past 2 billion rows).
8. **Soft-delete sensitive/auditable data** (`deleted_at TIMESTAMP NULL`) instead of hard deleting, when compliance or history matters.

## Common Anti-patterns

### 1. The "God Table"
One massive table with 80+ columns trying to represent everything (e.g., a single `users` table with vendor info, customer info, and admin info all mixed in with dozens of nullable columns).
**Fix:** Split by role/responsibility; use subtype tables or separate entities.

### 2. Entity-Attribute-Value (EAV) Overuse
Storing dynamic attributes as `(entity_id, attribute_name, value)` rows to avoid schema changes.
```
entity_id | attribute   | value
1         | color       | red
1         | size        | large
```
**Problem:** Loses type safety, makes querying/reporting painful (everything becomes string comparison), no referential integrity on attribute names.
**Fix:** Use EAV only for truly unpredictable, sparse attributes (e.g., custom fields in a CMS) — and consider a JSON/JSONB column instead in modern relational DBs, which offers more query flexibility with better tooling.

### 3. Overusing Nullable Columns
A table where half the columns are nullable "just in case," making every query need extensive NULL-handling logic.
**Fix:** If a group of columns is only relevant for a subset of rows, consider splitting into a subtype table.

### 4. Ignoring Cardinality Until Production
Assuming a relationship is 1:N when it's actually M:N, discovered only after duplicate data starts appearing in production.
**Fix:** Validate cardinality assumptions with real stakeholders and sample data during conceptual modeling.

### 5. Premature Denormalization
Denormalizing before there's a proven performance problem, then suffering from data inconsistency bugs with no performance payoff to show for it.
**Fix:** Normalize first (3NF), measure actual query performance, denormalize surgically where profiling shows a real bottleneck.

### 6. No Indexing Strategy
Either zero indexes (slow reads) or an index on every column (slow writes, wasted storage).
**Fix:** Index based on actual query patterns — `WHERE`, `JOIN`, and `ORDER BY` columns — and revisit periodically using query performance logs.

### 7. Inconsistent Naming
Mixing `camelCase`, `snake_case`, singular/plural, and abbreviations across the same schema (`custID`, `customer_id`, `CustomerId` all appearing in different tables).
**Fix:** Agree on and document a naming convention before the schema grows.

### 8. Storing Calculated Values Without a Refresh Strategy
Storing `total_price` on an order but never updating it when `quantity` or `unit_price` changes elsewhere.
**Fix:** Either compute on read, or use triggers/application logic that guarantees the stored value stays in sync — and document which approach was chosen.

### 9. Treating the Conceptual Model as Optional
Jumping straight to physical tables without agreeing on entities/relationships with stakeholders first, leading to expensive schema rewrites once real requirements surface.
**Fix:** Always pass through conceptual → logical → physical, even briefly, for anything beyond a trivial schema.

## Quick Pre-Launch Checklist

- [ ] Every table has a clear primary key
- [ ] Every foreign key has an explicit ON DELETE behavior decision
- [ ] Naming conventions are consistent across all tables
- [ ] Normalization level matches the workload (3NF for OLTP, denormalized for OLAP)
- [ ] Indexes exist on FK columns and common filter/sort columns
- [ ] No unbounded arrays/EAV patterns without a documented reason
- [ ] Schema is version-controlled with a migration tool
- [ ] A data dictionary exists and is up to date

---
[← Previous: Notations & Tools](09-notations-tools.md) | [Back to index](00-README.md)
