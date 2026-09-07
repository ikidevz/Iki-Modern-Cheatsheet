# 4. Normalization & Denormalization

## Why Normalize?

Normalization organizes data to **eliminate redundancy** and **prevent update/insert/delete anomalies**. Each normal form (NF) is a stricter rule than the last.

## The Normal Forms

### Unnormalized (UNF) — Starting Point

```
OrderID | Customer      | Products
1       | Jane Doe      | Laptop, Mouse
2       | John Smith    | Keyboard
```
Problem: `Products` holds multiple values in one cell — not atomic.

### 1NF — Atomic Values, No Repeating Groups

Rule: Every column holds a single, indivisible value; no repeating groups.

```
OrderID | Customer   | Product
1       | Jane Doe   | Laptop
1       | Jane Doe   | Mouse
2       | John Smith | Keyboard
```
Fixed the multivalued cell, but now `Customer` repeats for every product — redundancy remains.

### 2NF — No Partial Dependency (applies to composite PKs)

Rule: Every non-key attribute must depend on the **whole** primary key, not just part of it.

Problem table (PK = `OrderID + Product`):
```
OrderID | Product  | Quantity | CustomerName
```
`CustomerName` depends only on `OrderID`, not on `Product` → partial dependency. Split it out:

```
Order(OrderID PK, CustomerName)
OrderDetail(OrderID FK, Product, Quantity)
```

### 3NF — No Transitive Dependency

Rule: Non-key attributes must depend **only** on the key, not on other non-key attributes.

Problem table:
```
OrderID | CustomerID | CustomerCity
```
`CustomerCity` depends on `CustomerID`, not directly on `OrderID` → transitive dependency. Split it out:

```
Order(OrderID PK, CustomerID FK)
Customer(CustomerID PK, CustomerCity)
```

### BCNF (Boyce-Codd Normal Form) — Stricter 3NF

Rule: For every functional dependency `A → B`, `A` must be a **superkey**. Handles edge cases 3NF misses, typically when a table has multiple overlapping candidate keys.

Example edge case: A table `(Student, Course, Instructor)` where each Instructor teaches only one Course, but a Course can have multiple Instructors — `Instructor → Course` is a dependency where `Instructor` isn't a superkey. Split into two tables to fix it.

### 4NF — No Multivalued Dependency

Rule: No row should contain two or more independent multivalued facts about an entity.

Problem: A `Employee(EmployeeID, Skill, Language)` table where skills and languages are independent lists — this creates a combinatorial mess. Split into `Employee_Skill` and `Employee_Language`.

### 5NF — No Join Dependency (Rare, Advanced)

Ensures a table can't be split into smaller tables without losing information when reconstructed via joins. Mostly relevant in complex many-to-many-to-many scenarios. Rarely a day-to-day concern outside specialized data architecture work.

## Normalization Cheat Table

| Normal Form | Fixes |
|---|---|
| 1NF | Repeating groups / non-atomic values |
| 2NF | Partial dependency on composite key |
| 3NF | Transitive dependency |
| BCNF | Overlapping candidate keys |
| 4NF | Independent multivalued facts |
| 5NF | Join dependency across 3+ tables |

**On-the-job target:** Most OLTP systems aim for **3NF**. It's the sweet spot between eliminating redundancy and keeping queries manageable.

## Why (and When) to Denormalize

Denormalization intentionally reintroduces redundancy to **optimize read performance**, usually at the cost of write complexity and storage.

| Reason | Example |
|---|---|
| Avoid expensive joins | Store `customer_name` directly on `Order` for reporting instead of joining `Customer` every time |
| Speed up read-heavy analytics | Precompute `total_sales` per day instead of aggregating on every dashboard load |
| Support dimensional/OLAP models | Star schemas are deliberately denormalized (see file 7) |
| Reduce query complexity for APIs | Flatten nested data for a single-table lookup |

## Denormalization Trade-off Table

| Pros | Cons |
|---|---|
| Faster reads, fewer joins | Risk of data inconsistency (same value stored twice) |
| Simpler queries for reporting | More complex updates (must update all copies) |
| Better for OLAP/analytics workloads | More storage used |

## Practical Rule of Thumb

> Normalize for **transactional integrity** (OLTP). Denormalize for **read performance** (OLAP/reporting). Many real systems do both: a normalized operational database feeding a denormalized data warehouse.

## Common Mistakes

- Over-normalizing an analytics table, forcing 10-way joins for a simple report.
- Denormalizing prematurely in an OLTP system "for performance" before there's an actual bottleneck — adds update-anomaly risk for no proven benefit.
- Forgetting to keep denormalized copies in sync (e.g., updating `Customer.name` but forgetting the cached copy on `Order`).

---
[← Previous: Logical Modeling](03-logical-modeling.md) | [Back to index](00-README.md) | [Next: Physical Data Modeling →](05-physical-modeling.md)
