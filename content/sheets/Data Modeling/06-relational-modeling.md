# 6. Relational Modeling

## Core Idea

Relational modeling organizes data into **tables (relations)** connected via **keys**, enforced by **constraints**, following the rules of relational algebra. This is the foundation of SQL databases (PostgreSQL, MySQL, SQL Server, Oracle).

## Relationship Types & How They're Implemented

### One-to-One (1:1)
Implementation: FK on either table, marked `UNIQUE`.
```sql
CREATE TABLE employee (
    employee_id INT PRIMARY KEY,
    name VARCHAR(100)
);

CREATE TABLE employee_badge (
    badge_id INT PRIMARY KEY,
    employee_id INT UNIQUE NOT NULL REFERENCES employee(employee_id)
);
```

### One-to-Many (1:N)
Implementation: FK on the "many" side.
```sql
CREATE TABLE customer (
    customer_id INT PRIMARY KEY,
    name VARCHAR(100)
);

CREATE TABLE order_table (
    order_id INT PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customer(customer_id)
);
```

### Many-to-Many (M:N)
Implementation: Junction table with composite PK (or surrogate PK + unique composite index).
```sql
CREATE TABLE student (
    student_id INT PRIMARY KEY,
    name VARCHAR(100)
);

CREATE TABLE course (
    course_id INT PRIMARY KEY,
    title VARCHAR(100)
);

CREATE TABLE enrollment (
    student_id INT REFERENCES student(student_id),
    course_id INT REFERENCES course(course_id),
    enrollment_date DATE,
    PRIMARY KEY (student_id, course_id)
);
```

### Self-Referencing Relationship
A table references itself — common for hierarchies (org charts, category trees, comment threads).
```sql
CREATE TABLE employee (
    employee_id INT PRIMARY KEY,
    name VARCHAR(100),
    manager_id INT REFERENCES employee(employee_id)  -- points to another employee
);
```

## Join Types (How Relationships Get Queried)

| Join | Returns |
|---|---|
| `INNER JOIN` | Only matching rows in both tables |
| `LEFT JOIN` | All rows from left table + matches from right (NULLs if no match) |
| `RIGHT JOIN` | All rows from right table + matches from left |
| `FULL OUTER JOIN` | All rows from both, matched where possible |
| `CROSS JOIN` | Cartesian product (every row × every row) — rarely intentional |
| `SELF JOIN` | A table joined to itself (e.g., employee-manager lookup) |

Example — get every customer's orders, including customers with none:
```sql
SELECT c.name, o.order_id
FROM customer c
LEFT JOIN order_table o ON c.customer_id = o.customer_id;
```

## Referential Integrity

The rule that a foreign key value must either be NULL or match an existing primary key value in the referenced table. The database enforces this automatically once FK constraints exist — you can't insert an `Order` with a `customer_id` that doesn't exist in `Customer`.

### ON DELETE / ON UPDATE Behaviors

| Behavior | Effect |
|---|---|
| `CASCADE` | Deleting/updating the parent automatically deletes/updates children |
| `RESTRICT` / `NO ACTION` | Blocks the delete/update if children exist |
| `SET NULL` | Sets the FK to NULL in children when parent is deleted |
| `SET DEFAULT` | Sets FK to a default value |

```sql
customer_id INT REFERENCES customer(customer_id) ON DELETE CASCADE
```

**On-the-job judgment call:** `CASCADE` is convenient but dangerous for financial/audit data — deleting a customer shouldn't silently wipe their order history. Prefer `RESTRICT` (or soft-deletes) for anything with compliance implications.

## Constraint Types Recap

| Constraint | Purpose |
|---|---|
| `PRIMARY KEY` | Uniquely identifies a row |
| `FOREIGN KEY` | Enforces relationship integrity |
| `UNIQUE` | No duplicate values allowed |
| `NOT NULL` | Value required |
| `CHECK` | Custom business-rule validation |
| `DEFAULT` | Auto-fill value if none provided |

## Handling Hierarchies & Trees in Relational Models

| Pattern | How it Works | Best For |
|---|---|---|
| **Adjacency List** | Each row stores `parent_id` | Simple, easy to update; slow for deep-tree queries |
| **Path Enumeration** | Store full path as string (`/1/4/9/`) | Fast ancestor/descendant lookups; harder to update |
| **Nested Sets** | Store `left`/`right` bounds per node | Very fast reads; expensive updates/inserts |
| **Closure Table** | Separate table listing every ancestor-descendant pair | Flexible, good balance; extra storage |

## Common Mistakes

- Forgetting to index foreign key columns (kills JOIN performance).
- Using `CASCADE` deletes without considering audit/compliance needs.
- Modeling a hierarchy with adjacency list, then needing recursive queries the team doesn't know how to write (`WITH RECURSIVE` in Postgres).
- Not enforcing constraints at the DB level and relying solely on application code (leads to orphaned/invalid data when a second app or manual script touches the DB).

---
[← Previous: Physical Modeling](05-physical-modeling.md) | [Back to index](00-README.md) | [Next: Dimensional Modeling →](07-dimensional-modeling.md)
