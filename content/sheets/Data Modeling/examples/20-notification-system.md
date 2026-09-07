# 20. Notification System

## Scenario

A cross-cutting notification system: events happen elsewhere in the product (a comment, a payment, a system alert), and users receive them across multiple channels (in-app, email, push, SMS) according to their own preferences. The modeling focus: **decoupling the notification's content from its delivery**, since one logical notification can fan out into several delivery attempts.

## Entities & Relationships

| Entity | Description |
|---|---|
| Notification | One logical event to communicate to a user |
| Notification_Channel | A delivery method (email, push, sms, in_app) |
| User_Notification_Preference | Per-user, per-type settings for which channels to use |
| Notification_Delivery | One attempted delivery of a notification through one channel |

```
User 1───N Notification
Notification 1───N Notification_Delivery N───1 Notification_Channel
User 1───N User_Notification_Preference N───1 Notification_Channel
```

## Schema (PostgreSQL)

```sql
CREATE TABLE app_user (
    user_id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    push_token VARCHAR(255)
);

CREATE TABLE notification_channel (
    channel_id SERIAL PRIMARY KEY,
    name VARCHAR(20) UNIQUE NOT NULL   -- 'email','push','sms','in_app'
);

-- One row per (user, notification_type, channel) — governs delivery decisions
CREATE TABLE user_notification_preference (
    user_id BIGINT NOT NULL REFERENCES app_user(user_id),
    notification_type VARCHAR(50) NOT NULL,   -- 'comment_reply','payment_receipt','security_alert'
    channel_id INT NOT NULL REFERENCES notification_channel(channel_id),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (user_id, notification_type, channel_id)
);

-- The logical event — exists once regardless of how many channels it fans out to
CREATE TABLE notification (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(user_id),
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    related_entity_type VARCHAR(50),    -- polymorphic-style reference, see example 18
    related_entity_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    read_at TIMESTAMP                   -- NULL = unread (for in-app notification center)
);

-- One row per actual delivery attempt through a specific channel
CREATE TABLE notification_delivery (
    delivery_id BIGSERIAL PRIMARY KEY,
    notification_id BIGINT NOT NULL REFERENCES notification(notification_id) ON DELETE CASCADE,
    channel_id INT NOT NULL REFERENCES notification_channel(channel_id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','sent','delivered','failed','bounced')),
    attempted_at TIMESTAMP,
    error_message VARCHAR(500)
);

CREATE INDEX idx_notification_user_unread ON notification(user_id, read_at);
CREATE INDEX idx_delivery_notification ON notification_delivery(notification_id);
CREATE INDEX idx_delivery_status_pending ON notification_delivery(status) WHERE status = 'pending';
```

## Sample Queries

**Determine which channels to deliver a new notification through (respecting preferences, defaulting to enabled if unset):**
```sql
SELECT nc.name AS channel
FROM notification_channel nc
LEFT JOIN user_notification_preference unp
    ON unp.channel_id = nc.channel_id
    AND unp.user_id = 42
    AND unp.notification_type = 'comment_reply'
WHERE COALESCE(unp.is_enabled, true) = true;
```

**A user's in-app notification center (unread first):**
```sql
SELECT notification_id, title, body, created_at, read_at
FROM notification
WHERE user_id = 42
ORDER BY read_at IS NULL DESC, created_at DESC
LIMIT 20;
```

**Mark all notifications as read:**
```sql
UPDATE notification
SET read_at = now()
WHERE user_id = 42 AND read_at IS NULL;
```

**Retry failed deliveries (worker/cron query):**
```sql
SELECT nd.delivery_id, n.title, nc.name AS channel
FROM notification_delivery nd
JOIN notification n ON nd.notification_id = n.notification_id
JOIN notification_channel nc ON nd.channel_id = nc.channel_id
WHERE nd.status = 'failed'
  AND nd.attempted_at > now() - INTERVAL '1 day';
```

**Delivery success rate by channel (ops dashboard):**
```sql
SELECT nc.name,
       COUNT(*) FILTER (WHERE nd.status = 'delivered') * 100.0 / COUNT(*) AS success_rate_pct
FROM notification_delivery nd
JOIN notification_channel nc ON nd.channel_id = nc.channel_id
GROUP BY nc.name;
```

## Design Decisions & Trade-offs

- **`notification` (the logical event) is separate from `notification_delivery` (each channel attempt)** — a single notification might successfully deliver via push but fail via email; tracking these independently is essential for both user experience (don't show "failed" in the UI just because email bounced) and operational monitoring (which channel is unreliable right now).
- **`user_notification_preference` defaults to "enabled" when no row exists** (handled via `COALESCE` in the query) rather than requiring an explicit row per user per type per channel — avoids needing to pre-populate millions of preference rows for every new user; only opt-outs need to be recorded.
- **`related_entity_type` / `related_entity_id` uses the generic polymorphic pattern** (see example 18, Solution 2) — a notification can point back to a comment, a payment, or any other entity, and new notification-triggering features shouldn't require schema changes here.
- **`read_at` (nullable timestamp) instead of a boolean `is_read`** — captures *when* it was read for free, useful for "read within X minutes" engagement metrics, at no extra modeling cost over a plain boolean.

## Common Pitfalls

- Merging `notification` and `notification_delivery` into one table — makes it impossible to represent "delivered via push, failed via email" for the same logical event, and complicates the unread/read-state logic (which conceptually belongs to the *notification*, not to any one channel attempt).
- Not indexing `notification_delivery.status` for pending/failed rows, making retry-worker queries slow as delivery volume grows (a partial index `WHERE status = 'pending'` — as shown above — keeps this fast even with huge historical delivery volumes).
- Requiring an explicit preference row for every user/type/channel combination instead of defaulting sensibly — creates unnecessary write load and a painful backfill problem whenever a new notification type is introduced.
- No retry/backoff strategy modeled at all — treating delivery as fire-and-forget instead of tracking status transitions means transient failures (a bounced push token, a temporary email outage) silently drop notifications instead of being retried.

---
[← Previous: Survey / Dynamic Form Builder](19-survey-dynamic-form-builder.md) | [Back to index](00-README.md)
