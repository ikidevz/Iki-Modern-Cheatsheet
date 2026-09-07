# 1. E-Commerce / Order Management

## Scenario

You're building the data model for an online store: customers browse products, add them to orders, pay, and get shipments. This is the single most common real-world modeling exercise — and a good template for most transactional (OLTP) systems.

## Entities & Relationships

| Entity | Description |
|---|---|
| Customer | A registered buyer |
| Address | Shipping/billing addresses (a customer can have several) |
| Product | An item for sale |
| Category | Product grouping |
| Order | A purchase transaction |
| Order_Item | Line items within an order (resolves Order↔Product M:N) |
| Payment | Payment record for an order |
| Shipment | Delivery tracking for an order |

```
Customer 1───N Address
Customer 1───N Order
Order    1───N Order_Item ───N 1 Product
Product  N───1 Category
Order    1───1 Payment
Order    1───N Shipment
```

## Schema (PostgreSQL)

```sql
CREATE TABLE customer (
    customer_id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE address (
    address_id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customer(customer_id) ON DELETE CASCADE,
    line1 VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE category (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_category_id INT REFERENCES category(category_id)  -- self-referencing for subcategories
);

CREATE TABLE product (
    product_id BIGSERIAL PRIMARY KEY,
    category_id INT REFERENCES category(category_id),
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE order_table (
    order_id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customer(customer_id),
    shipping_address_id BIGINT NOT NULL REFERENCES address(address_id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','paid','shipped','delivered','cancelled')),
    order_date TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE order_item (
    order_id BIGINT NOT NULL REFERENCES order_table(order_id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES product(product_id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL,  -- snapshot of price at purchase time
    PRIMARY KEY (order_id, product_id)
);

CREATE TABLE payment (
    payment_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES order_table(order_id),
    amount NUMERIC(10,2) NOT NULL,
    method VARCHAR(30) NOT NULL,
    paid_at TIMESTAMP,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending','completed','failed','refunded'))
);

CREATE TABLE shipment (
    shipment_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES order_table(order_id),
    carrier VARCHAR(50),
    tracking_number VARCHAR(100),
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP
);

CREATE INDEX idx_order_customer ON order_table(customer_id);
CREATE INDEX idx_order_item_product ON order_item(product_id);
CREATE INDEX idx_product_category ON product(category_id);
```

## Sample Queries

**Customer's full order history with totals:**
```sql
SELECT o.order_id, o.order_date, o.status,
       SUM(oi.quantity * oi.unit_price) AS order_total
FROM order_table o
JOIN order_item oi ON o.order_id = oi.order_id
WHERE o.customer_id = 55
GROUP BY o.order_id, o.order_date, o.status
ORDER BY o.order_date DESC;
```

**Best-selling products this month:**
```sql
SELECT p.name, SUM(oi.quantity) AS units_sold
FROM order_item oi
JOIN product p ON oi.product_id = p.product_id
JOIN order_table o ON oi.order_id = o.order_id
WHERE o.order_date >= date_trunc('month', now())
GROUP BY p.name
ORDER BY units_sold DESC
LIMIT 10;
```

**Orders pending shipment:**
```sql
SELECT order_id, order_date
FROM order_table
WHERE status = 'paid'
ORDER BY order_date ASC;
```

## Advanced / Edge-Case Queries

**Abandoned carts — orders stuck in `pending` beyond a threshold (never paid):**
```sql
SELECT o.order_id, o.customer_id, o.order_date
FROM order_table o
WHERE o.status = 'pending'
  AND o.order_date < now() - INTERVAL '24 hours';
```

**Frequently bought together (basic market-basket analysis):**
```sql
SELECT oi1.product_id AS product_a, oi2.product_id AS product_b, COUNT(*) AS times_bought_together
FROM order_item oi1
JOIN order_item oi2 ON oi1.order_id = oi2.order_id AND oi1.product_id < oi2.product_id
GROUP BY oi1.product_id, oi2.product_id
ORDER BY times_bought_together DESC
LIMIT 10;
```

**Net revenue by category (after discounts implied by unit_price vs. current price):**
```sql
SELECT c.name,
       SUM(oi.quantity * oi.unit_price) AS net_revenue
FROM order_item oi
JOIN product p ON oi.product_id = p.product_id
JOIN category c ON p.category_id = c.category_id
JOIN order_table o ON oi.order_id = o.order_id
WHERE o.status IN ('paid','shipped','delivered')
GROUP BY c.name
ORDER BY net_revenue DESC;
```

**Fraud signal — customers with an unusually high cancellation/return rate:**
```sql
SELECT customer_id,
       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_count,
       COUNT(*) AS total_orders,
       ROUND(COUNT(*) FILTER (WHERE status = 'cancelled')::NUMERIC / COUNT(*), 2) AS cancel_rate
FROM order_table
GROUP BY customer_id
HAVING COUNT(*) >= 5
   AND COUNT(*) FILTER (WHERE status = 'cancelled')::NUMERIC / COUNT(*) > 0.5
ORDER BY cancel_rate DESC;
```

**Detect likely duplicate orders (same customer, same items, placed within minutes of each other — often an accidental double-click on checkout):**
```sql
SELECT o1.order_id, o2.order_id AS possible_duplicate_of
FROM order_table o1
JOIN order_table o2
  ON o1.customer_id = o2.customer_id
 AND o1.order_id < o2.order_id
 AND ABS(EXTRACT(EPOCH FROM (o1.order_date - o2.order_date))) < 300
WHERE EXISTS (
    SELECT 1 FROM order_item oi1
    WHERE oi1.order_id = o1.order_id
    AND NOT EXISTS (
        SELECT 1 FROM order_item oi2
        WHERE oi2.order_id = o2.order_id
        AND oi2.product_id = oi1.product_id AND oi2.quantity = oi1.quantity
    )
);
```

## Design Decisions & Trade-offs

- **`unit_price` is snapshotted on `order_item`, not looked up from `product.price`.** If the product price later changes, historical orders must still reflect what the customer actually paid. This is a deliberate, small denormalization for correctness, not performance (see cheatsheet file 4).
- **`Payment` has a `UNIQUE` constraint on `order_id`** to enforce a 1:1 relationship — one order, one payment record (refunds/partial payments would need a redesign to `1:N` if the business requires split payments).
- **`category_id` self-references itself** to support nested categories (Electronics → Laptops → Gaming Laptops) without a separate table — see cheatsheet file 6 for hierarchy patterns.
- **Status fields use `CHECK` constraints** instead of a separate lookup table — reasonable when the list of statuses is small and rarely changes. If statuses needed metadata (e.g., display color, sort order), a `status` lookup table would be better.

## NoSQL Variant: Product Catalog as a Document Store

Product catalogs often have highly variable attributes per category (a laptop has RAM/CPU; a t-shirt has size/color) — a poor fit for a rigid relational schema without heavy use of EAV (an anti-pattern, see cheatsheet file 10). A document store handles this naturally:

```json
{
  "_id": "product_8821",
  "sku": "LAP-8821",
  "name": "UltraBook Pro 14",
  "category": "Electronics > Laptops",
  "price": 1299.00,
  "attributes": {
    "ram_gb": 16,
    "cpu": "Core i7",
    "storage_gb": 512
  },
  "is_active": true
}
```
```json
{
  "_id": "product_4410",
  "sku": "TSH-4410",
  "name": "Classic Cotton Tee",
  "category": "Apparel > T-Shirts",
  "price": 19.99,
  "attributes": {
    "size": "L",
    "color": "Navy",
    "material": "100% Cotton"
  },
  "is_active": true
}
```
The `attributes` object varies per product type without requiring schema migrations — a real advantage over relational EAV tables. Orders/payments still tend to stay relational (or in a strongly consistent store) because they need transactional guarantees (see cheatsheet file 8 on NoSQL trade-offs).

## Common Pitfalls

- Storing `total` on `order_table` without a trigger/recalculation strategy, letting it drift from the actual sum of `order_item` rows.
- Forgetting `unit_price` snapshotting, causing historical order totals to silently change when product prices update.
- Not indexing `order_item.product_id`, making "best-selling products" queries slow at scale.
- Modeling `Address` as a single field on `Customer` instead of its own table — breaks the moment a customer needs multiple addresses (common requirement).

---
[← Back to index](00-README.md) | [Next: Auth & RBAC →](02-auth-rbac.md)
