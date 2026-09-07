# 16. Messaging / Chat System

## Scenario

A chat application supporting both 1:1 direct messages and group conversations, with read receipts. The key modeling decision: **unify 1:1 and group chats under a single "conversation" concept** rather than building two separate systems, since a 1:1 chat is really just a group conversation with exactly two participants.

## Entities & Relationships

| Entity | Description |
|---|---|
| User | A chat participant |
| Conversation | A chat thread — could be 1:1 or group |
| Conversation_Participant | Junction: who's in a conversation (M:N) |
| Message | An individual message within a conversation |
| Message_Read_Receipt | Tracks which users have read which messages |

```
User N───N Conversation   (via Conversation_Participant)
Conversation 1───N Message N───1 User (sender)
Message N───N User        (via Message_Read_Receipt)
```

## Schema (PostgreSQL)

```sql
CREATE TABLE app_user (
    user_id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE conversation (
    conversation_id BIGSERIAL PRIMARY KEY,
    is_group BOOLEAN NOT NULL DEFAULT false,
    group_name VARCHAR(100),          -- only used when is_group = true
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE conversation_participant (
    conversation_id BIGINT NOT NULL REFERENCES conversation(conversation_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES app_user(user_id),
    joined_at TIMESTAMP NOT NULL DEFAULT now(),
    last_read_message_id BIGINT,      -- denormalized pointer for fast "unread count" queries
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE message (
    message_id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversation(conversation_id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES app_user(user_id),
    content TEXT NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT now()
    -- sequential message_id also serves as a reliable ordering key within a conversation
);

-- Detailed per-message read tracking (optional — many apps only need last_read_message_id above)
CREATE TABLE message_read_receipt (
    message_id BIGINT NOT NULL REFERENCES message(message_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES app_user(user_id),
    read_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, user_id)
);

CREATE INDEX idx_message_conversation ON message(conversation_id, sent_at);
CREATE INDEX idx_conversation_participant_user ON conversation_participant(user_id);
```

### Enforcing "Exactly One 1:1 Conversation Per Pair" (Application-Level Pattern)

```sql
-- Before creating a new 1:1 conversation, check if one already exists between the two users
SELECT cp1.conversation_id
FROM conversation_participant cp1
JOIN conversation_participant cp2 ON cp1.conversation_id = cp2.conversation_id
JOIN conversation c ON cp1.conversation_id = c.conversation_id
WHERE cp1.user_id = 10 AND cp2.user_id = 20 AND c.is_group = false;
```

## Sample Queries

**All messages in a conversation, oldest first (paginated):**
```sql
SELECT m.message_id, u.username, m.content, m.sent_at
FROM message m
JOIN app_user u ON m.sender_id = u.user_id
WHERE m.conversation_id = 500
ORDER BY m.message_id ASC
LIMIT 50 OFFSET 0;
```

**A user's conversation list with the most recent message (typical inbox view):**
```sql
SELECT c.conversation_id, c.is_group, c.group_name,
       lm.content AS last_message, lm.sent_at AS last_message_at
FROM conversation_participant cp
JOIN conversation c ON cp.conversation_id = c.conversation_id
JOIN LATERAL (
    SELECT content, sent_at FROM message
    WHERE conversation_id = c.conversation_id
    ORDER BY message_id DESC LIMIT 1
) lm ON true
WHERE cp.user_id = 10
ORDER BY lm.sent_at DESC;
```

**Unread message count per conversation (using the denormalized pointer):**
```sql
SELECT c.conversation_id,
       COUNT(m.message_id) AS unread_count
FROM conversation_participant cp
JOIN conversation c ON cp.conversation_id = c.conversation_id
JOIN message m ON m.conversation_id = c.conversation_id
    AND m.message_id > COALESCE(cp.last_read_message_id, 0)
WHERE cp.user_id = 10
GROUP BY c.conversation_id;
```

**Mark a conversation as read (update the pointer — O(1), no need to touch every message):**
```sql
UPDATE conversation_participant
SET last_read_message_id = (
    SELECT MAX(message_id) FROM message WHERE conversation_id = 500
)
WHERE conversation_id = 500 AND user_id = 10;
```

## Design Decisions & Trade-offs

- **1:1 and group chats share the same `conversation` table**, distinguished only by `is_group` and participant count — this avoids duplicating the entire messaging schema for what is fundamentally the same concept (a set of participants exchanging messages), and it means a 1:1 chat can be trivially "upgraded" to a group chat by adding participants.
- **`last_read_message_id` on `conversation_participant` is a deliberate denormalization** for fast unread-count queries — computing "how many unread messages" by checking a full `message_read_receipt` table for every message would be far more expensive at scale than comparing against a single stored pointer. The trade-off: this only tells you "read up to X," not exactly *which* messages were read if reads happen out of order (rare in chat UIs, so usually an acceptable simplification).
- **`message_read_receipt` (fine-grained, per-message) is kept as an optional addition**, not the primary read-tracking mechanism — apps that need to show "seen by Alice, Bob" per message (common in group chats) need this table; apps that only need a simple unread badge count can skip it entirely and rely solely on `last_read_message_id`.
- **`message_id` (an auto-incrementing key) doubles as the ordering key** within a conversation — more reliable than `sent_at` alone, since two messages could theoretically share the same timestamp at millisecond precision under load; a strictly increasing ID guarantees a stable order.

## Common Pitfalls

- Building separate tables/logic for 1:1 vs. group chats — leads to duplicated code paths and awkward migrations when a 1:1 chat needs to become a group (e.g., "add someone to this conversation").
- Computing unread counts by scanning full message history against `message_read_receipt` on every inbox load instead of maintaining a lightweight pointer like `last_read_message_id` — a common performance bottleneck as message volume grows.
- Relying solely on `sent_at` timestamps for message ordering in a high-throughput chat, risking same-millisecond collisions; use a sequential ID (or a dedicated sequence/snowflake ID) as the authoritative order.
- Not indexing `(conversation_id, sent_at)` or `(conversation_id, message_id)` together, making "load the last 50 messages" queries slow once conversations accumulate thousands of messages.

---
[← Previous: Learning Management System](15-learning-management-system.md) | [Back to index](00-README.md) | [Next: Job Board / Recruitment →](17-job-board-recruitment.md)
