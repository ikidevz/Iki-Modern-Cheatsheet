# 3. Logical Data Modeling

## Purpose

Take the conceptual model and add precision: attributes, data types (generic, not DB-specific), keys, and relationship rules — while remaining independent of any specific database engine.

## From Conceptual to Logical: What Changes

| Conceptual | Logical |
|---|---|
| `Customer` (box) | `Customer(customer_id, first_name, last_name, email, phone)` |
| "places" relationship | Foreign key `Order.customer_id → Customer.customer_id` |
| M:N relationship | Resolved into a junction table |

## Keys — The Backbone of Logical Modeling

| Key Type | Definition | Example |
|---|---|---|
| **Primary Key (PK)** | Uniquely identifies each row | `customer_id` |
| **Candidate Key** | Any column(s) that *could* be the PK | `email` (also unique) |
| **Alternate Key** | Candidate key not chosen as PK | `email` if `customer_id` is PK |
| **Composite Key** | PK made of 2+ columns | `(order_id, product_id)` in Order_Item |
| **Foreign Key (FK)** | References a PK in another table | `Order.customer_id → Customer.customer_id` |
| **Surrogate Key** | Artificial key with no business meaning (auto-increment, UUID) | `customer_id = 1001` |
| **Natural Key** | Key derived from real-world data | `email`, `ssn`, `isbn` |

**On-the-job rule of thumb:** Prefer surrogate keys for PKs in most operational systems — natural keys can change (emails get updated, SSNs get corrected) and that breaks every FK pointing to them.

## Resolving Many-to-Many Relationships

Conceptual: `Student M:N Course`

Logical resolution — introduce a junction/associative entity:

```
Student(student_id PK, name, email)
Course(course_id PK, title, credits)
Enrollment(student_id FK, course_id FK, enrollment_date, grade)
    PK = (student_id, course_id)   -- composite key
```

## Attribute-Level Decisions

- **Data type (generic):** Text, Number, Date, Boolean, Decimal — exact precision comes later (physical).
- **Nullability:** Can this attribute be empty? (`middle_name` → nullable; `email` → not null)
- **Derived vs stored:** Should `total_price` be stored, or calculated from `quantity * unit_price` at query time? (Storing it is a denormalization decision — see file 4.)
- **Multivalued attributes:** If an entity could have many values for one attribute (e.g., a Customer with multiple phone numbers), it usually becomes its own entity (`Phone(customer_id FK, phone_number, type)`).

## Worked Example: Logical Model for E-Commerce

```
Customer(customer_id PK, first_name, last_name, email UNIQUE, created_at)

Order(order_id PK, customer_id FK → Customer, order_date, status)

Product(product_id PK, name, category_id FK → Category, price)

Category(category_id PK, category_name)

Order_Item(order_id FK, product_id FK, quantity, unit_price)
    PK = (order_id, product_id)

Payment(payment_id PK, order_id FK → Order (UNIQUE), amount, method, paid_at)
```

Notice:
- `Order_Item` is the resolved junction table for the Order↔Product M:N relationship.
- `Payment.order_id` is marked UNIQUE to enforce the 1:1 relationship with Order.

## Relationship Rules to Document

For every FK relationship, capture:
1. **Cardinality** (1:1, 1:N, M:N)
2. **Optionality** (can the FK be null?)
3. **On-delete behavior** (cascade, restrict, set null) — this bridges into physical modeling but should be decided logically first.

Example: If a `Customer` is deleted, should their `Orders` be deleted too (cascade), or should deletion be blocked (restrict) to preserve financial history? — This is a business decision, not just a technical one.

## Common Mistakes

- Skipping key definition and letting every table have an auto-increment ID with no thought to natural/candidate keys (leads to duplicate data — e.g., two `Customer` rows with the same email).
- Not resolving M:N relationships before moving to physical design.
- Conflating logical and physical too early (e.g., deciding `VARCHAR(255)` at this stage — save exact types for physical modeling).
- Ignoring nullability rules, leading to ambiguous "empty string vs null" bugs later.

---
[← Previous: Conceptual Modeling](02-conceptual-modeling.md) | [Back to index](00-README.md) | [Next: Normalization & Denormalization →](04-normalization-denormalization.md)
