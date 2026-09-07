# 14. Event Ticketing

## Scenario

A ticketing platform for concerts/events with assigned seating. The core challenge is a sharper version of the booking-system problem (example 4): **thousands of people may try to buy the same popular seat within seconds of tickets going on sale**, and the system must guarantee no seat is ever sold twice, while also supporting a waitlist when an event sells out.

## Entities & Relationships

| Entity | Description |
|---|---|
| Venue | A physical location with a seating layout |
| Seat | An individual seat within a venue |
| Event | A specific show/performance at a venue on a date |
| Ticket | A seat reserved/sold for a specific event |
| Order | A customer's purchase (can include multiple tickets) |
| Waitlist | Customers waiting for a sold-out event |

```
Venue 1───N Seat
Venue 1───N Event
Event 1───N Ticket N───1 Seat
Order 1───N Ticket
Event 1───N Waitlist
```

## Schema (PostgreSQL)

```sql
CREATE TABLE venue (
    venue_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255)
);

CREATE TABLE seat (
    seat_id BIGSERIAL PRIMARY KEY,
    venue_id INT NOT NULL REFERENCES venue(venue_id),
    section VARCHAR(20) NOT NULL,
    row_label VARCHAR(10) NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    UNIQUE (venue_id, section, row_label, seat_number)
);

CREATE TABLE event (
    event_id BIGSERIAL PRIMARY KEY,
    venue_id INT NOT NULL REFERENCES venue(venue_id),
    name VARCHAR(255) NOT NULL,
    event_datetime TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'on_sale'
        CHECK (status IN ('scheduled','on_sale','sold_out','completed','cancelled'))
);

CREATE TABLE customer (
    customer_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE customer_order (
    order_id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customer(customer_id),
    order_date TIMESTAMP NOT NULL DEFAULT now(),
    total_amount NUMERIC(10,2) NOT NULL
);

-- One row per seat per event — the UNIQUE constraint IS the anti-double-sell mechanism
CREATE TABLE ticket (
    ticket_id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES event(event_id),
    seat_id BIGINT NOT NULL REFERENCES seat(seat_id),
    order_id BIGINT REFERENCES customer_order(order_id),  -- NULL = held but not yet purchased
    status VARCHAR(20) NOT NULL DEFAULT 'available'
        CHECK (status IN ('available','held','sold','cancelled')),
    held_until TIMESTAMP,             -- reservation expiry for in-progress checkouts
    price NUMERIC(10,2) NOT NULL,
    UNIQUE (event_id, seat_id)        -- ONE seat can only have ONE ticket row per event
);

CREATE TABLE waitlist (
    waitlist_id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES event(event_id),
    customer_id BIGINT NOT NULL REFERENCES customer(customer_id),
    joined_at TIMESTAMP NOT NULL DEFAULT now(),
    notified_at TIMESTAMP,
    UNIQUE (event_id, customer_id)
);

CREATE INDEX idx_ticket_event_status ON ticket(event_id, status);
```

## Sample Queries

**Safely reserve a seat during checkout (prevents double-sell via row locking):**
```sql
BEGIN;

-- Lock the row so no other transaction can grab this seat simultaneously
SELECT ticket_id, status FROM ticket
WHERE event_id = 501 AND seat_id = 8842
FOR UPDATE;

-- Only proceed if it's actually available
UPDATE ticket
SET status = 'held', held_until = now() + INTERVAL '10 minutes'
WHERE event_id = 501 AND seat_id = 8842 AND status = 'available';

-- Application checks: did the UPDATE affect a row? If not, seat was already taken.

COMMIT;
```

**Release expired holds (run periodically or on next access):**
```sql
UPDATE ticket
SET status = 'available', order_id = NULL, held_until = NULL
WHERE status = 'held' AND held_until < now();
```

**Available seats for an event, grouped by section:**
```sql
SELECT s.section, COUNT(*) AS available_seats
FROM ticket t
JOIN seat s ON t.seat_id = s.seat_id
WHERE t.event_id = 501 AND t.status = 'available'
GROUP BY s.section;
```

**Add a customer to the waitlist when an event is sold out:**
```sql
INSERT INTO waitlist (event_id, customer_id)
VALUES (501, 77)
ON CONFLICT (event_id, customer_id) DO NOTHING;
```

## Design Decisions & Trade-offs

- **`UNIQUE (event_id, seat_id)` on `ticket` is the core anti-double-sell mechanism** — it makes it physically impossible for two `ticket` rows to represent the same seat at the same event, similar in spirit to the exclusion constraint used in the booking example (example 4), but simpler here since seats are discrete units rather than continuous time ranges.
- **`SELECT ... FOR UPDATE` locks the row during checkout** so that if two customers click "buy" on the same seat within milliseconds, the second one's transaction waits for the first to finish, then sees the updated (`held` or `sold`) status and fails cleanly — this closes the same race condition class discussed in the booking example, adapted to seat inventory instead of time ranges.
- **`status = 'held'` with `held_until`** models the "seat is in someone's cart during checkout" state — a deliberately temporary reservation that auto-expires, preventing seats from being locked forever by abandoned checkouts.
- **Waitlist has its own table rather than overloading `ticket`** — a waitlist entry isn't a ticket (no seat assigned yet), so keeping it separate avoids awkward nullable columns and status values that don't apply to real tickets.

## Common Pitfalls

- Checking seat availability and then inserting/updating in two separate, unguarded steps — a textbook race condition that leads to the same seat being sold to two different customers under load (exactly the bug `FOR UPDATE` or an exclusion constraint prevents).
- Not expiring `held` tickets, causing seats to become permanently unavailable when customers abandon checkout mid-purchase.
- Modeling seats as a simple `available_count` integer on the event instead of individual seat rows — works for general-admission events, but breaks the moment assigned seating is needed (can't say *which* seats are taken).
- Forgetting a waitlist notification workflow entirely, leaving customers with no path back in when tickets free up from cancellations.

---
[← Previous: Ride-Sharing / Logistics](13-ride-sharing-logistics.md) | [Back to index](00-README.md) | [Next: Learning Management System →](15-learning-management-system.md)
