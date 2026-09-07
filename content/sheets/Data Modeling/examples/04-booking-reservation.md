# 4. Booking / Reservation System

## Scenario

A system for booking resources with fixed availability — hotel rooms, appointment slots, equipment rentals. The central challenge isn't the entities themselves, it's **preventing double-booking** through correct modeling and constraints.

## Entities & Relationships

| Entity | Description |
|---|---|
| Resource | The bookable thing (a room, a doctor's time slot, a piece of equipment) |
| Customer | The person making the booking |
| Booking | A reservation of a resource for a time range |
| Availability_Block | Optional: explicit windows when a resource CAN be booked (e.g., business hours) |

```
Customer 1───N Booking N───1 Resource
Resource 1───N Availability_Block
```

## Schema (PostgreSQL)

```sql
CREATE TABLE resource (
    resource_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL   -- 'room', 'appointment_slot', 'equipment'
);

CREATE TABLE customer (
    customer_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE booking (
    booking_id BIGSERIAL PRIMARY KEY,
    resource_id BIGINT NOT NULL REFERENCES resource(resource_id),
    customer_id BIGINT NOT NULL REFERENCES customer(customer_id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('confirmed','cancelled','completed')),
    CHECK (end_time > start_time)
);

-- Prevent double-booking at the database level using an exclusion constraint
-- (requires the btree_gist extension in PostgreSQL)
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE booking
ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (
    resource_id WITH =,
    tsrange(start_time, end_time) WITH &&
) WHERE (status = 'confirmed');

CREATE INDEX idx_booking_resource_time ON booking(resource_id, start_time, end_time);
```

## Sample Queries

**Check resource availability for a given window:**
```sql
SELECT NOT EXISTS (
    SELECT 1 FROM booking
    WHERE resource_id = 10
      AND status = 'confirmed'
      AND tsrange(start_time, end_time) && tsrange('2026-09-05 10:00', '2026-09-05 11:00')
) AS is_available;
```

**All upcoming bookings for a customer:**
```sql
SELECT b.booking_id, r.name AS resource_name, b.start_time, b.end_time
FROM booking b
JOIN resource r ON b.resource_id = r.resource_id
WHERE b.customer_id = 55
  AND b.start_time > now()
  AND b.status = 'confirmed'
ORDER BY b.start_time;
```

**Resource utilization report (hours booked per resource this week):**
```sql
SELECT r.name,
       SUM(EXTRACT(EPOCH FROM (b.end_time - b.start_time)) / 3600) AS hours_booked
FROM booking b
JOIN resource r ON b.resource_id = r.resource_id
WHERE b.start_time >= date_trunc('week', now())
  AND b.status = 'confirmed'
GROUP BY r.name
ORDER BY hours_booked DESC;
```

## Advanced / Edge-Case Queries

**Find the next available slot for a resource of a given duration (gap-finding):**
```sql
WITH busy AS (
    SELECT start_time, end_time
    FROM booking
    WHERE resource_id = 10 AND status = 'confirmed'
      AND start_time >= now()
    ORDER BY start_time
),
gaps AS (
    SELECT end_time AS gap_start,
           LEAD(start_time) OVER (ORDER BY start_time) AS gap_end
    FROM busy
)
SELECT gap_start, gap_end
FROM gaps
WHERE gap_end - gap_start >= INTERVAL '1 hour'
ORDER BY gap_start
LIMIT 1;
```

**Resources with the highest cancellation rate (may indicate a scheduling/quality problem):**
```sql
SELECT r.name,
       COUNT(*) FILTER (WHERE b.status = 'cancelled') * 100.0 / COUNT(*) AS cancel_rate_pct
FROM booking b
JOIN resource r ON b.resource_id = r.resource_id
GROUP BY r.name
HAVING COUNT(*) >= 10
ORDER BY cancel_rate_pct DESC;
```

**Customers with high booking-then-cancel behavior (no-show / flake risk scoring):**
```sql
SELECT c.name,
       COUNT(*) FILTER (WHERE b.status = 'cancelled') AS cancellations,
       COUNT(*) AS total_bookings
FROM booking b
JOIN customer c ON b.customer_id = c.customer_id
GROUP BY c.name
HAVING COUNT(*) FILTER (WHERE b.status = 'cancelled')::NUMERIC / COUNT(*) > 0.4
ORDER BY cancellations DESC;
```

**Peak booking hours heatmap (which hour-of-day is busiest, for capacity planning):**
```sql
SELECT EXTRACT(HOUR FROM start_time) AS hour_of_day,
       COUNT(*) AS bookings
FROM booking
WHERE status = 'confirmed'
GROUP BY hour_of_day
ORDER BY bookings DESC;
```

**Verify the exclusion constraint is doing its job (should always return zero rows — a sanity/regression check):**
```sql
SELECT b1.booking_id, b2.booking_id
FROM booking b1
JOIN booking b2 ON b1.resource_id = b2.resource_id
    AND b1.booking_id < b2.booking_id
    AND tsrange(b1.start_time, b1.end_time) && tsrange(b2.start_time, b2.end_time)
WHERE b1.status = 'confirmed' AND b2.status = 'confirmed';
```

## Design Decisions & Trade-offs

- **The `EXCLUDE` constraint is the star of this design.** Application-level checks ("query for overlaps, then insert if none found") have a race condition: two users can pass the availability check simultaneously and both insert overlapping bookings. A database-level exclusion constraint makes double-booking *physically impossible*, closing that race condition entirely — this is a case where physical modeling (cheatsheet file 5) directly solves a business-critical bug class.
- **`status = 'confirmed'` is included in the exclusion constraint's WHERE clause** so cancelled bookings don't block the slot from being rebooked.
- **Time ranges use PostgreSQL's `tsrange` type** rather than separate comparison logic (`start_time < X AND end_time > Y`) — range types make overlap checks both correct and readable, and they're what the exclusion constraint requires.
- **`Availability_Block` is optional** — only needed if resources have variable availability windows (e.g., a doctor works Mon-Fri 9-5 but not weekends). Simple always-available resources (a meeting room) can skip it.

## Common Pitfalls

- Relying only on application-level "check then insert" logic for double-booking prevention — this is a race condition waiting to happen under concurrent load, especially for popular resources.
- Modeling `start_time`/`end_time` as separate unrelated columns without a range type, making overlap queries error-prone (easy to get the boundary logic wrong, e.g., `<` vs `<=`).
- Forgetting time zones — always store timestamps in UTC (`TIMESTAMPTZ` in Postgres) and convert to local time only at display time.
- Not indexing `(resource_id, start_time, end_time)` together, causing slow availability lookups once bookings scale up.

---
[← Previous: Social Network](03-social-network.md) | [Back to index](00-README.md) | [Next: Blog/CMS →](05-blog-cms.md)
