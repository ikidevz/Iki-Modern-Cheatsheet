# 3. Social Network

## Scenario

Users create posts, follow each other, and like/comment on posts. This is the classic "everything connects to everything" domain — a great showcase for self-referencing relationships and heavy M:N patterns, and a common case where graph or document databases genuinely outperform relational designs.

## Entities & Relationships

| Entity | Description |
|---|---|
| User | An account |
| Follow | Self-referencing M:N: users follow other users |
| Post | Content a user shares |
| Comment | A reply to a post (can itself be replied to — self-referencing) |
| Like | M:N between users and posts (or comments) |

```
User N───N User        (via Follow — self-referencing)
User 1───N Post
Post 1───N Comment      (self-referencing for reply threads)
User N───N Post         (via Like)
```

## Schema (PostgreSQL — Relational Approach)

```sql
CREATE TABLE app_user (
    user_id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Self-referencing M:N: who follows whom
CREATE TABLE follow (
    follower_id BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    followee_id BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    followed_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id),
    CHECK (follower_id != followee_id)   -- can't follow yourself
);

CREATE TABLE post (
    post_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Self-referencing for threaded replies
CREATE TABLE comment (
    comment_id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES post(post_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES app_user(user_id),
    parent_comment_id BIGINT REFERENCES comment(comment_id),  -- NULL = top-level comment
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE post_like (
    user_id BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    post_id BIGINT NOT NULL REFERENCES post(post_id) ON DELETE CASCADE,
    liked_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, post_id)
);

CREATE INDEX idx_follow_followee ON follow(followee_id);
CREATE INDEX idx_post_user ON post(user_id);
CREATE INDEX idx_comment_post ON comment(post_id);
```

## Sample Queries

**Generate a feed: posts from people I follow, newest first:**
```sql
SELECT p.post_id, p.content, p.created_at, u.username
FROM post p
JOIN app_user u ON p.user_id = u.user_id
WHERE p.user_id IN (
    SELECT followee_id FROM follow WHERE follower_id = 42
)
ORDER BY p.created_at DESC
LIMIT 20;
```

**Like count and whether the current user liked a post:**
```sql
SELECT p.post_id,
       COUNT(pl.user_id) AS like_count,
       BOOL_OR(pl.user_id = 42) AS liked_by_me
FROM post p
LEFT JOIN post_like pl ON p.post_id = pl.post_id
WHERE p.post_id = 1001
GROUP BY p.post_id;
```

**Follower / following counts:**
```sql
SELECT
  (SELECT COUNT(*) FROM follow WHERE followee_id = 42) AS followers,
  (SELECT COUNT(*) FROM follow WHERE follower_id = 42) AS following;
```

**Threaded comments for a post (recursive):**
```sql
WITH RECURSIVE comment_tree AS (
    SELECT comment_id, parent_comment_id, content, 0 AS depth
    FROM comment WHERE post_id = 1001 AND parent_comment_id IS NULL
    UNION ALL
    SELECT c.comment_id, c.parent_comment_id, c.content, ct.depth + 1
    FROM comment c
    JOIN comment_tree ct ON c.parent_comment_id = ct.comment_id
)
SELECT * FROM comment_tree ORDER BY depth;
```

## Advanced / Edge-Case Queries

**Mutual followers between two users (self-join on `follow` twice):**
```sql
SELECT f1.followee_id AS mutual_user_id
FROM follow f1
JOIN follow f2 ON f1.followee_id = f2.followee_id
WHERE f1.follower_id = 42 AND f2.follower_id = 99;
```

**"People you may know" — 2nd-degree connections not already followed:**
```sql
SELECT DISTINCT f2.followee_id AS suggested_user_id
FROM follow f1
JOIN follow f2 ON f1.followee_id = f2.follower_id
WHERE f1.follower_id = 42
  AND f2.followee_id != 42
  AND f2.followee_id NOT IN (SELECT followee_id FROM follow WHERE follower_id = 42);
```

**Follow-back rate — of the people I follow, what percentage follow me back:**
```sql
SELECT
    COUNT(*) FILTER (WHERE f2.follower_id IS NOT NULL) * 100.0 / COUNT(*) AS follow_back_rate_pct
FROM follow f1
LEFT JOIN follow f2 ON f1.followee_id = f2.follower_id AND f2.followee_id = f1.follower_id
WHERE f1.follower_id = 42;
```

**Trending posts — highest engagement velocity in the last 24 hours (likes weighted higher than raw recency):**
```sql
SELECT p.post_id, p.content,
       COUNT(pl.user_id) AS recent_likes
FROM post p
JOIN post_like pl ON p.post_id = pl.post_id
WHERE pl.liked_at > now() - INTERVAL '24 hours'
GROUP BY p.post_id, p.content
ORDER BY recent_likes DESC
LIMIT 10;
```

**Users who follow a lot but have very few followers back (potential bot/spam signal):**
```sql
SELECT u.username,
       (SELECT COUNT(*) FROM follow WHERE follower_id = u.user_id) AS following_count,
       (SELECT COUNT(*) FROM follow WHERE followee_id = u.user_id) AS follower_count
FROM app_user u
WHERE (SELECT COUNT(*) FROM follow WHERE follower_id = u.user_id) > 500
  AND (SELECT COUNT(*) FROM follow WHERE followee_id = u.user_id) < 10;
```

## Design Decisions & Trade-offs

- **`follow` is self-referencing** (`follower_id`/`followee_id` both point to `app_user`) rather than a separate "Follower" entity — followers/followees ARE users, not a distinct concept.
- **The `CHECK (follower_id != followee_id)` constraint** prevents a data integrity edge case (self-follows) at the database level rather than trusting application code alone.
- **Comments are self-referencing via `parent_comment_id`** to support threaded replies — this is the adjacency list pattern (see cheatsheet file 6); fine for moderate thread depths, but deeply nested threads (Reddit-style) sometimes move to closure tables for performance.
- **Feed generation via a subquery on `follow`** works fine at small-to-medium scale, but at large scale (millions of users), feeds are typically pre-computed and pushed to a cache/feed table ("fan-out on write") rather than computed live on every request — a system design consideration beyond pure data modeling.

## NoSQL Variant 1: Document Store (Denormalized Feed-Friendly)

```json
{
  "_id": "post_1001",
  "author": { "user_id": "user_42", "username": "jane_doe" },
  "content": "Excited to launch our new feature!",
  "created_at": "2026-08-20T10:00:00Z",
  "like_count": 245,
  "comment_count": 12,
  "top_comments": [
    { "user": "john_smith", "text": "Congrats!", "created_at": "2026-08-20T10:05:00Z" }
  ]
}
```
`author` is embedded (denormalized) so the feed can render without a join/lookup, and `like_count`/`comment_count` are precomputed counters rather than aggregated live — a common pattern for read-heavy social feeds. The trade-off: counters must be kept in sync via atomic increments whenever a like/comment happens.

## NoSQL Variant 2: Graph Database (Best Fit for Deep Relationship Queries)

Social graphs are the textbook use case for graph databases (see cheatsheet file 8) — "friends of friends," "mutual followers," and community detection are naturally expressed as graph traversals.

```cypher
// Model
(:User {name: "Jane"})-[:FOLLOWS]->(:User {name: "John"})
(:User {name: "Jane"})-[:POSTED]->(:Post {content: "Hello world"})
(:User {name: "John"})-[:LIKED]->(:Post {content: "Hello world"})

// Query: mutual follows (people Jane and John both follow)
MATCH (jane:User {name:"Jane"})-[:FOLLOWS]->(mutual)<-[:FOLLOWS]-(john:User {name:"John"})
RETURN mutual.name
```
Relational SQL *can* answer this (self-join on `follow` twice), but it gets expensive and unreadable as traversal depth grows (e.g., "friends of friends of friends"). Graph databases handle arbitrary-depth traversal natively and efficiently.

## Common Pitfalls

- Computing follower/like counts live on every page load at scale instead of maintaining denormalized counters — a major, very common performance bug.
- Not preventing self-follows or duplicate follows at the schema level (composite PK + CHECK constraint handles both).
- Using unbounded recursive queries for comment threads without a depth limit, risking runaway queries on deeply nested threads.
- Choosing pure relational for a feature that's fundamentally graph-shaped (e.g., "suggest people you may know" via 2nd-degree connections) — relational self-joins for this get unwieldy fast.

---
[← Previous: Auth & RBAC](02-auth-rbac.md) | [Back to index](00-README.md) | [Next: Booking/Reservation →](04-booking-reservation.md)
