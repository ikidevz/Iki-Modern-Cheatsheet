# 7. Subscription & Billing

## Scenario

A SaaS product with subscription plans, recurring invoices, and usage-based add-on charges. The modeling challenge: handle plan changes mid-cycle, proration, and a clean audit trail for every charge.

## Entities & Relationships

| Entity | Description |
|---|---|
| Plan | A subscription tier (e.g., "Pro", "Enterprise") with a base price |
| Subscription | A customer's active/historical subscription to a plan |
| Invoice | A billing document for a period |
| Invoice_Line_Item | Individual charges within an invoice (base fee, usage, proration, discounts) |
| Usage_Record | Raw usage events, aggregated into usage-based charges |

```
Customer 1───N Subscription N───1 Plan
Subscription 1───N Invoice 1───N Invoice_Line_Item
Customer 1───N Usage_Record
```

## Schema (PostgreSQL)

```sql
CREATE TABLE plan (
    plan_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    base_price NUMERIC(10,2) NOT NULL,
    billing_interval VARCHAR(10) NOT NULL CHECK (billing_interval IN ('monthly','annual'))
);

CREATE TABLE customer (
    customer_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL
);

-- History of plan changes — NOT just "current plan" on customer
CREATE TABLE subscription (
    subscription_id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customer(customer_id),
    plan_id INT NOT NULL REFERENCES plan(plan_id),
    start_date DATE NOT NULL,
    end_date DATE,                        -- NULL = currently active
    status VARCHAR(20) NOT NULL CHECK (status IN ('active','cancelled','expired'))
);

CREATE TABLE invoice (
    invoice_id BIGSERIAL PRIMARY KEY,
    subscription_id BIGINT NOT NULL REFERENCES subscription(subscription_id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','paid','failed','void')),
    issued_at TIMESTAMP NOT NULL DEFAULT now(),
    paid_at TIMESTAMP
);

CREATE TABLE invoice_line_item (
    line_item_id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES invoice(invoice_id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,     -- 'Base plan fee', 'Proration credit', 'API usage overage'
    line_type VARCHAR(20) NOT NULL CHECK (line_type IN ('base_fee','proration','usage','discount','tax')),
    amount NUMERIC(10,2) NOT NULL          -- can be negative (credits/discounts)
);

CREATE TABLE usage_record (
    usage_id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customer(customer_id),
    metric VARCHAR(50) NOT NULL,           -- 'api_calls', 'storage_gb'
    quantity NUMERIC(12,4) NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_customer ON subscription(customer_id, status);
CREATE INDEX idx_invoice_subscription ON invoice(subscription_id);
CREATE INDEX idx_usage_customer_metric_time ON usage_record(customer_id, metric, recorded_at);
```

## Sample Queries

**Current active subscription for a customer:**
```sql
SELECT s.subscription_id, p.name AS plan_name, p.base_price, s.start_date
FROM subscription s
JOIN plan p ON s.plan_id = p.plan_id
WHERE s.customer_id = 88 AND s.status = 'active';
```

**Full invoice breakdown:**
```sql
SELECT i.invoice_id, i.period_start, i.period_end, i.total_amount,
       li.description, li.line_type, li.amount
FROM invoice i
JOIN invoice_line_item li ON i.invoice_id = li.invoice_id
WHERE i.invoice_id = 5001
ORDER BY li.line_item_id;
```

**Aggregate usage for the current billing period (to generate a usage-based charge):**
```sql
SELECT metric, SUM(quantity) AS total_usage
FROM usage_record
WHERE customer_id = 88
  AND recorded_at >= '2026-08-01' AND recorded_at < '2026-09-01'
GROUP BY metric;
```

**Monthly recurring revenue (MRR) by plan:**
```sql
SELECT p.name, COUNT(*) AS active_subscribers,
       COUNT(*) * p.base_price AS mrr
FROM subscription s
JOIN plan p ON s.plan_id = p.plan_id
WHERE s.status = 'active' AND p.billing_interval = 'monthly'
GROUP BY p.name, p.base_price;
```

## Advanced / Edge-Case Queries

**Proration when a customer upgrades mid-cycle (credit for unused time on old plan, charge for remaining time on new plan):**
```sql
-- Assume: 30-day cycle, customer upgrades on day 10 (20 days remaining)
-- Credit: unused portion of old plan; Charge: prorated portion of new plan
INSERT INTO invoice_line_item (invoice_id, description, line_type, amount)
VALUES
  (5001, 'Proration credit: unused Basic plan days', 'proration', -33.33),  -- (20/30 * $50 old plan)
  (5001, 'Proration charge: remaining Pro plan days', 'proration', 66.67);  -- (20/30 * $100 new plan)
```

**Monthly churn rate (subscriptions cancelled this month / active subscriptions at month start):**
```sql
WITH month_start_active AS (
    SELECT COUNT(*) AS cnt FROM subscription
    WHERE start_date < date_trunc('month', now())
      AND (end_date IS NULL OR end_date >= date_trunc('month', now()))
),
cancelled_this_month AS (
    SELECT COUNT(*) AS cnt FROM subscription
    WHERE status = 'cancelled' AND end_date >= date_trunc('month', now())
)
SELECT (SELECT cnt FROM cancelled_this_month) * 100.0 / NULLIF((SELECT cnt FROM month_start_active), 0) AS churn_rate_pct;
```

**Customers approaching their usage-based limit (e.g., 90%+ of a soft quota, to trigger a proactive upsell email):**
```sql
SELECT customer_id, SUM(quantity) AS total_usage
FROM usage_record
WHERE metric = 'api_calls'
  AND recorded_at >= date_trunc('month', now())
GROUP BY customer_id
HAVING SUM(quantity) > 9000  -- e.g., 90% of a 10,000-call plan limit
ORDER BY total_usage DESC;
```

**Failed invoices eligible for a retry (dunning management):**
```sql
SELECT invoice_id, subscription_id, total_amount, issued_at
FROM invoice
WHERE status = 'failed'
  AND issued_at > now() - INTERVAL '7 days';
```

**Cohort revenue — total revenue by the month a customer's subscription started (basic LTV-by-cohort view):**
```sql
SELECT date_trunc('month', s.start_date) AS cohort_month,
       SUM(i.total_amount) AS cohort_revenue
FROM subscription s
JOIN invoice i ON s.subscription_id = i.subscription_id
WHERE i.status = 'paid'
GROUP BY cohort_month
ORDER BY cohort_month;
```

## Design Decisions & Trade-offs

- **`subscription` keeps a full history of plan changes** (each plan change ends one row and starts a new one) rather than a single `current_plan_id` on `customer` — this is essentially SCD Type 2 thinking (cheatsheet file 7) applied to an OLTP table: you need to know what plan a customer was on when a *past* invoice was generated, even after they've since upgraded.
- **`invoice_line_item` breaks every charge into typed rows** (base fee, proration, usage, discount) instead of a single `invoice.amount` number — this makes proration and discounts auditable and explains exactly how a total was reached, which billing support teams need constantly.
- **`usage_record` is a raw, granular event log**, aggregated at invoicing time rather than incrementally updating a running total — keeps raw data available for re-calculation if pricing logic changes retroactively, and for detailed usage analytics beyond just billing.
- **Line item amounts can be negative** (for discounts/proration credits) rather than having separate credit/debit columns — simplifies `SUM(amount)` to get the invoice total.

## Common Pitfalls

- Storing only `customer.current_plan_id` with no history — breaks the ability to correctly regenerate or audit past invoices after a plan change.
- Computing invoice totals as a single opaque number with no line-item breakdown — makes "why was I charged this much?" support tickets nearly impossible to answer.
- Not snapshotting the plan price on the invoice/line item — if `plan.base_price` changes later, historical invoices could be miscalculated if they reference the live price instead of the price at billing time.
- Mixing billing intervals (monthly/annual) in aggregate revenue queries without normalizing to a common period (e.g., annual plans need to be divided by 12 for a true MRR figure).

---
[← Previous: Inventory & Warehouse](06-inventory-warehouse.md) | [Back to index](00-README.md) | [Next: Multi-tenant SaaS →](08-multi-tenant-saas.md)
