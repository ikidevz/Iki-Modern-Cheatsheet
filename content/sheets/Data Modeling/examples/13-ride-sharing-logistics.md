# 13. Ride-Sharing / Logistics

## Scenario

A ride-hailing app matches riders with nearby drivers and tracks a trip through a strict sequence of states. Two modeling challenges dominate this domain: **geospatial queries** ("find drivers near me") and **state machine integrity** ("a trip can't jump from 'requested' straight to 'completed'").

## Entities & Relationships

| Entity | Description |
|---|---|
| Rider | A customer requesting rides |
| Driver | A driver account, with a current location |
| Vehicle | The car a driver uses |
| Trip | A single ride from request to completion |
| Trip_Status_History | Audit trail of every state transition a trip goes through |

```
Rider 1───N Trip N───1 Driver
Driver 1───1 Vehicle (simplified; could be 1:N for multi-vehicle drivers)
Trip 1───N Trip_Status_History
```

## Schema (PostgreSQL with PostGIS for geospatial data)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE rider (
    rider_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL
);

CREATE TABLE driver (
    driver_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    is_online BOOLEAN NOT NULL DEFAULT false,
    current_location GEOGRAPHY(POINT, 4326),   -- lat/long, updated frequently
    location_updated_at TIMESTAMP
);

CREATE TABLE vehicle (
    vehicle_id BIGSERIAL PRIMARY KEY,
    driver_id BIGINT NOT NULL REFERENCES driver(driver_id),
    make VARCHAR(50), model VARCHAR(50), plate_number VARCHAR(20) UNIQUE
);

CREATE TABLE trip (
    trip_id BIGSERIAL PRIMARY KEY,
    rider_id BIGINT NOT NULL REFERENCES rider(rider_id),
    driver_id BIGINT REFERENCES driver(driver_id),   -- NULL until matched
    pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
    dropoff_location GEOGRAPHY(POINT, 4326) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested','matched','in_progress','completed','cancelled')),
    requested_at TIMESTAMP NOT NULL DEFAULT now(),
    fare_amount NUMERIC(10,2)
);

-- Full audit trail of state transitions
CREATE TABLE trip_status_history (
    history_id BIGSERIAL PRIMARY KEY,
    trip_id BIGINT NOT NULL REFERENCES trip(trip_id),
    status VARCHAR(20) NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_driver_location ON driver USING GIST (current_location);
CREATE INDEX idx_trip_status_history_trip ON trip_status_history(trip_id, changed_at);
```

## Sample Queries

**Find the 5 nearest available drivers to a pickup point (geospatial query):**
```sql
SELECT driver_id, name,
       ST_Distance(current_location, ST_MakePoint(121.05, 14.55)::geography) AS distance_meters
FROM driver
WHERE is_online = true
ORDER BY current_location <-> ST_MakePoint(121.05, 14.55)::geography
LIMIT 5;
```

**Enforce valid state transitions (application-layer state machine, backed by the CHECK constraint for valid values):**
```sql
-- Valid transitions: requested -> matched -> in_progress -> completed
--                     requested/matched -> cancelled
-- Enforced in application code before UPDATE; every change also logged:
BEGIN;
UPDATE trip SET status = 'matched', driver_id = 88 WHERE trip_id = 5001 AND status = 'requested';
INSERT INTO trip_status_history (trip_id, status) VALUES (5001, 'matched');
COMMIT;
```

**A driver's completed trip history with earnings:**
```sql
SELECT trip_id, requested_at, fare_amount
FROM trip
WHERE driver_id = 88 AND status = 'completed'
ORDER BY requested_at DESC;
```

**Full timeline of a trip (for support/dispute resolution):**
```sql
SELECT status, changed_at
FROM trip_status_history
WHERE trip_id = 5001
ORDER BY changed_at ASC;
```

## Design Decisions & Trade-offs

- **`driver.current_location` is a single mutable field, updated on every GPS ping** — unlike the banking/inventory examples, location history usually doesn't need to be preserved forever, so overwriting is appropriate here (a rare case where a "current state" column, not a ledger, is the right call — always match the pattern to the actual business need for history).
- **`trip_status_history` provides the audit trail that `trip.status` alone can't** — the main `trip` row always reflects only the *current* state (fast to query), while the history table answers "when exactly did this trip get cancelled, and what was the state before that" for support and dispute resolution.
- **Geospatial indexing (`GIST`) on `current_location`** is essential — without it, "find nearby drivers" degenerates into a full table scan computing distance for every driver, which doesn't scale past a small fleet.
- **State transitions are validated in application code, not purely by the database** — a `CHECK` constraint can validate that a status value is one of the allowed strings, but validating *transition* rules (can't go from 'requested' directly to 'completed') typically requires either application logic or a more advanced trigger-based state machine, since standard `CHECK` constraints can't reference the row's previous value.

## Common Pitfalls

- Recomputing every driver's distance from a rider in application code (pulling all driver rows into memory) instead of using a spatial index and database-native distance functions — this doesn't scale.
- Not logging state transitions, making it impossible to investigate "the app says my trip was cancelled by the driver, but I never got a notification" support disputes.
- Storing pickup/dropoff as separate `lat`/`lng` float columns instead of a proper geography type — loses access to built-in distance, radius, and polygon (geofencing) queries.
- Allowing a trip to be matched to a driver who is already on another active trip — needs an application-level (or constraint-based) check that a driver has at most one active trip at a time.

---
[← Previous: Healthcare / Patient Records](12-healthcare-patient-records.md) | [Back to index](00-README.md) | [Next: Event Ticketing →](14-event-ticketing.md)
