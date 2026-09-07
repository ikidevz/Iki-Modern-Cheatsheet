# 2. Conceptual Data Modeling

## Purpose

Capture **what** the business deals with — entities and relationships — without worrying about attributes, data types, or database engines. This is the model you'd sketch on a whiteboard with a product manager.

## Core Building Blocks

### Entities
A "thing" the business tracks. Drawn as a rectangle.

```
[Customer]   [Order]   [Product]
```

### Relationships
A verb connecting two entities. Drawn as a line (often labeled).

```
[Customer] ---places---> [Order]
[Order] ---contains---> [Product]
```

### Cardinality (How many relate to how many)

| Type | Notation | Example |
|------|----------|---------|
| **One-to-One (1:1)** | `1 —— 1` | A `Person` has one `Passport` |
| **One-to-Many (1:N)** | `1 —— N` | A `Customer` places many `Orders` |
| **Many-to-Many (M:N)** | `N —— N` | `Students` enroll in many `Courses`, `Courses` have many `Students` |

### Example Diagram (text form)

```
[Customer] 1 ────< N [Order] N >──── M [Product]
                (places)      (contains, via Order_Item)
```

Note: M:N relationships almost always resolve into a **junction/associative entity** once you move to the logical model (e.g., `Order_Item` bridging `Order` and `Product`).

## Ordinality (Optional vs Mandatory)

Cardinality tells you *how many*; ordinality tells you *whether it's required*.

| Symbol | Meaning |
|--------|---------|
| `0` | Optional (may have zero) |
| `1` | Mandatory (must have at least one) |

Example: A `Customer` **may** have zero or many `Orders` (0..N) — not every customer has ordered yet. But every `Order` **must** belong to exactly one `Customer` (1..1).

## Worked Example: E-Commerce Domain

**Step 1 — List the entities (nouns):**
Customer, Order, Product, Category, Payment, Shipping Address

**Step 2 — List the relationships (verbs):**
- Customer **places** Order
- Order **includes** Product(s)
- Product **belongs to** Category
- Order **has** Payment
- Customer **has** Shipping Address

**Step 3 — Assign cardinality:**
| Relationship | Cardinality |
|---|---|
| Customer → Order | 1 : N |
| Order → Product | M : N |
| Product → Category | N : 1 |
| Order → Payment | 1 : 1 |
| Customer → Shipping Address | 1 : N |

## Tips for Running a Conceptual Modeling Session

- Use business language, not database terms — say "a customer can place many orders," not "one-to-many foreign key."
- Don't get pulled into attributes yet ("what fields does Order need?") — that's logical modeling. Stay high-level.
- Validate entities by asking: "Would the business track a list of these?" If yes, it's likely an entity.
- Watch for hidden many-to-many relationships — they usually need a junction entity later.

## Common Mistakes

- Modeling an **attribute as an entity** (e.g., making "Email" its own box instead of a Customer attribute).
- Missing the **junction entity** for M:N relationships early on — fine at conceptual level, but flag it for logical modeling.
- Overcomplicating with implementation details (e.g., worrying about indexes) — save that for physical modeling.

---
[← Previous: Fundamentals](01-fundamentals.md) | [Back to index](00-README.md) | [Next: Logical Data Modeling →](03-logical-modeling.md)
