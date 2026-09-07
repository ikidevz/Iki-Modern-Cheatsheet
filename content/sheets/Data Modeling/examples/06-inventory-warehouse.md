# 6. Inventory & Warehouse Management

## Scenario

Track stock levels of products across multiple warehouse locations, with every movement (received, sold, transferred, adjusted) recorded for auditability. The key modeling challenge: **never store a "current stock" number as the only source of truth** — always derive it from an immutable ledger of movements.

## Entities & Relationships

| Entity | Description |
|---|---|
| Product | An item tracked in inventory |
| Warehouse | A physical storage location |
| Stock_Level | Current quantity of a product at a warehouse (derived/cached) |
| Stock_Movement | Immutable log of every inventory change |
| Supplier | Where restocked inventory comes from |

```
Product N───N Warehouse   (via Stock_Level — current snapshot)
Product 1───N Stock_Movement N───1 Warehouse
Supplier 1───N Stock_Movement  (for 'received' movements)
```

## Schema (PostgreSQL)

```sql
CREATE TABLE supplier (
    supplier_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE warehouse (
    warehouse_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255)
);

CREATE TABLE product (
    product_id BIGSERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    reorder_threshold INT NOT NULL DEFAULT 10
);

-- Immutable ledger: the SOURCE OF TRUTH for all inventory changes
CREATE TABLE stock_movement (
    movement_id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES product(product_id),
    warehouse_id INT NOT NULL REFERENCES warehouse(warehouse_id),
    movement_type VARCHAR(20) NOT NULL
        CHECK (movement_type IN ('received','sold','transferred_in','transferred_out','adjustment')),
    quantity INT NOT NULL,               -- positive for inbound, negative for outbound
    supplier_id INT REFERENCES supplier(supplier_id),  -- only for 'received'
    reference_id VARCHAR(50),            -- e.g., order_id or transfer_id that caused this
    occurred_at TIMESTAMP NOT NULL DEFAULT now(),
    CHECK (quantity != 0)
);

-- Derived/cached current stock — kept in sync via trigger or application logic
CREATE TABLE stock_level (
    product_id BIGINT NOT NULL REFERENCES product(product_id),
    warehouse_id INT NOT NULL REFERENCES warehouse(warehouse_id),
    quantity_on_hand INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (product_id, warehouse_id)
);

CREATE INDEX idx_movement_product_warehouse ON stock_movement(product_id, warehouse_id, occurred_at);
```

### Keeping `stock_level` in Sync (Trigger Approach)

```sql
CREATE OR REPLACE FUNCTION update_stock_level() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO stock_level (product_id, warehouse_id, quantity_on_hand, last_updated)
    VALUES (NEW.product_id, NEW.warehouse_id, NEW.quantity, now())
    ON CONFLICT (product_id, warehouse_id)
    DO UPDATE SET
        quantity_on_hand = stock_level.quantity_on_hand + NEW.quantity,
        last_updated = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_movement_insert
AFTER INSERT ON stock_movement
FOR EACH ROW EXECUTE FUNCTION update_stock_level();
```

## Sample Queries

**Current stock for a product across all warehouses:**
```sql
SELECT w.name AS warehouse, sl.quantity_on_hand
FROM stock_level sl
JOIN warehouse w ON sl.warehouse_id = w.warehouse_id
WHERE sl.product_id = 200;
```

**Products below reorder threshold:**
```sql
SELECT p.name, w.name AS warehouse, sl.quantity_on_hand, p.reorder_threshold
FROM stock_level sl
JOIN product p ON sl.product_id = p.product_id
JOIN warehouse w ON sl.warehouse_id = w.warehouse_id
WHERE sl.quantity_on_hand < p.reorder_threshold;
```

**Full movement history for a product (audit trail):**
```sql
SELECT movement_type, quantity, occurred_at, reference_id
FROM stock_movement
WHERE product_id = 200
ORDER BY occurred_at DESC;
```

**Reconciliation check — verify `stock_level` matches the sum of movements:**
```sql
SELECT sm.product_id, sm.warehouse_id,
       SUM(sm.quantity) AS calculated_stock,
       sl.quantity_on_hand AS cached_stock
FROM stock_movement sm
JOIN stock_level sl ON sm.product_id = sl.product_id AND sm.warehouse_id = sl.warehouse_id
GROUP BY sm.product_id, sm.warehouse_id, sl.quantity_on_hand
HAVING SUM(sm.quantity) != sl.quantity_on_hand;
```

## Advanced / Edge-Case Queries

**Transfer stock between warehouses (two coordinated, balanced movements — mirrors the double-entry principle from ledgers):**
```sql
BEGIN;
INSERT INTO stock_movement (product_id, warehouse_id, movement_type, quantity, reference_id)
VALUES (200, 1, 'transferred_out', -20, 'XFER-9001');

INSERT INTO stock_movement (product_id, warehouse_id, movement_type, quantity, reference_id)
VALUES (200, 2, 'transferred_in', 20, 'XFER-9001');
COMMIT;
```

**Days of inventory remaining, based on recent sales velocity:**
```sql
WITH recent_sales AS (
    SELECT product_id, SUM(-quantity) AS units_sold_30d
    FROM stock_movement
    WHERE movement_type = 'sold' AND occurred_at > now() - INTERVAL '30 days'
    GROUP BY product_id
)
SELECT sl.product_id, sl.quantity_on_hand,
       ROUND(sl.quantity_on_hand / NULLIF(rs.units_sold_30d / 30.0, 0), 1) AS days_remaining
FROM stock_level sl
JOIN recent_sales rs ON sl.product_id = rs.product_id
ORDER BY days_remaining ASC;
```

**Data integrity check — any product/warehouse combination with negative cached stock (should never happen; signals a bug or race condition):**
```sql
SELECT * FROM stock_level WHERE quantity_on_hand < 0;
```

**Slow-moving inventory — no 'sold' movement in 90+ days, but stock still on hand:**
```sql
SELECT p.name, w.name AS warehouse, sl.quantity_on_hand
FROM stock_level sl
JOIN product p ON sl.product_id = p.product_id
JOIN warehouse w ON sl.warehouse_id = w.warehouse_id
WHERE sl.quantity_on_hand > 0
  AND NOT EXISTS (
      SELECT 1 FROM stock_movement sm
      WHERE sm.product_id = sl.product_id AND sm.warehouse_id = sl.warehouse_id
        AND sm.movement_type = 'sold' AND sm.occurred_at > now() - INTERVAL '90 days'
  );
```

**Transfer reconciliation — verify every transferred_out movement has a matching transferred_in (catches lost-in-transit bugs):**
```sql
SELECT reference_id,
       SUM(quantity) FILTER (WHERE movement_type = 'transferred_out') AS total_out,
       SUM(quantity) FILTER (WHERE movement_type = 'transferred_in') AS total_in
FROM stock_movement
WHERE reference_id LIKE 'XFER-%'
GROUP BY reference_id
HAVING SUM(quantity) != 0;   -- out (negative) + in (positive) should net to zero
```

## Design Decisions & Trade-offs

- **`stock_movement` is append-only and immutable** — no `UPDATE`/`DELETE` on this table, ever. If a mistake happens, you insert a correcting `adjustment` movement rather than editing history. This is the same principle behind accounting ledgers and event sourcing: never lose the "how did we get here" trail.
- **`stock_level` is a deliberately denormalized cache** of the ledger, updated via trigger — this is a textbook justified denormalization (cheatsheet file 4): querying "current stock" by summing potentially millions of historical movement rows on every request would be far too slow.
- **The reconciliation query exists on purpose** — any system with a cached derived value needs a way to verify it hasn't drifted from the source of truth (bugs, failed triggers, manual DB edits can all cause drift).
- **`quantity` uses signed integers** (positive = inbound, negative = outbound) rather than separate "quantity in" / "quantity out" columns — simplifies the running-total math to simple addition.

## Common Pitfalls

- Treating `stock_level` (or a single `product.quantity` column) as the only source of truth, with no movement history — makes it impossible to audit "why is stock wrong?" after the fact, and can't be reconciled.
- Allowing `UPDATE`/`DELETE` on the movement ledger — destroys the audit trail's integrity.
- Forgetting concurrency control: two simultaneous "sell 1 unit" operations against the same cached stock number can both succeed even when only 1 unit remains, unless the update is done atomically (as in the trigger's `ON CONFLICT ... DO UPDATE`, which is atomic per row).
- Not modeling multi-warehouse from day one, then having to retrofit warehouse dimensions into every table later when the business expands beyond one location.

---
[← Previous: Blog/CMS](05-blog-cms.md) | [Back to index](00-README.md) | [Next: Subscription & Billing →](07-subscription-billing.md)
