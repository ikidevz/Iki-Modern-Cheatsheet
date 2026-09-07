# 18. Polymorphic Associations (Pattern Deep-Dive)

## The Problem

You need `Comment` to be attachable to a `Post`, a `Photo`, OR a `Video`. Same problem shows up with `Like`, `Attachment`, `Tag`, or any "this can belong to one of several different entity types" relationship. Unlike previous examples, this file focuses on **one recurring pattern** and compares three relational solutions plus the NoSQL alternative — because getting this wrong is one of the most common real-world relational modeling mistakes.

## Solution 1: Multiple Nullable Foreign Keys ("Exclusive Arc")

Add one FK column per possible parent type; exactly one is populated per row, the rest are NULL.

```sql
CREATE TABLE comment (
    comment_id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES post(post_id),
    photo_id BIGINT REFERENCES photo(photo_id),
    video_id BIGINT REFERENCES video(video_id),
    content TEXT NOT NULL,
    CHECK (
        (post_id IS NOT NULL)::INT +
        (photo_id IS NOT NULL)::INT +
        (video_id IS NOT NULL)::INT = 1
    )  -- exactly one parent must be set
);
```

| Pros | Cons |
|---|---|
| Real foreign key constraints — full referential integrity | Adding a new commentable type (e.g., `Story`) requires a schema migration (new column) |
| Easy to understand and query per-type | Gets unwieldy past 3-4 possible parent types; lots of NULL columns |

## Solution 2: Generic Polymorphic Columns ("Poor Man's Polymorphism")

A single `parent_type` + `parent_id` pair, with no database-level FK constraint (since a plain FK can't conditionally point to different tables).

```sql
CREATE TABLE comment (
    comment_id BIGSERIAL PRIMARY KEY,
    parent_type VARCHAR(20) NOT NULL CHECK (parent_type IN ('post','photo','video')),
    parent_id BIGINT NOT NULL,
    content TEXT NOT NULL
);

CREATE INDEX idx_comment_parent ON comment(parent_type, parent_id);
```

**Fetching comments requires application-level type dispatch:**
```sql
-- Application code decides which table to join based on parent_type
SELECT * FROM comment WHERE parent_type = 'post' AND parent_id = 501;
```

| Pros | Cons |
|---|---|
| Adding a new type needs zero schema changes | **No real foreign key** — the database cannot verify `parent_id` actually exists, or enforce `ON DELETE CASCADE` |
| Compact, one table for all comments regardless of type | Risk of orphaned rows if a post is deleted and nothing cleans up its comments |
| Simple to query across all comment types at once | Can't easily `JOIN` directly without conditional logic in the app or a `UNION` |

**This is the most common pattern in the wild (Rails' `polymorphic: true`, Django's `GenericForeignKey`) — convenient, but always a deliberate trade-off of referential integrity for flexibility.**

## Solution 3: Supertype/Subtype Table ("Commentable" Base Entity) — Best Relational Practice

Introduce a shared parent concept (`commentable`) that `Post`, `Photo`, and `Video` all reference — inverting the relationship so comments have one real, enforceable foreign key.

```sql
CREATE TABLE commentable (
    commentable_id BIGSERIAL PRIMARY KEY
);

CREATE TABLE post (
    post_id BIGINT PRIMARY KEY REFERENCES commentable(commentable_id),
    title VARCHAR(255),
    content TEXT
);

CREATE TABLE photo (
    photo_id BIGINT PRIMARY KEY REFERENCES commentable(commentable_id),
    image_url VARCHAR(500)
);

CREATE TABLE video (
    video_id BIGINT PRIMARY KEY REFERENCES commentable(commentable_id),
    video_url VARCHAR(500)
);

CREATE TABLE comment (
    comment_id BIGSERIAL PRIMARY KEY,
    commentable_id BIGINT NOT NULL REFERENCES commentable(commentable_id) ON DELETE CASCADE,
    content TEXT NOT NULL
);
```

**Fetching comments is now a single simple join, real FK, real cascade:**
```sql
SELECT * FROM comment WHERE commentable_id = 501;
```

| Pros | Cons |
|---|---|
| Full referential integrity — a real FK, `ON DELETE CASCADE` works correctly | Requires restructuring `Post`/`Photo`/`Video` to reference the shared supertype |
| Adding a new commentable type needs no changes to `comment` at all | An extra join layer (`commentable`) added to the model, more upfront design work |
| Genuinely the most "correct" relational solution | Less commonly implemented in practice because it requires planning ahead |

## Decision Guide

| If... | Choose |
|---|---|
| Only 2-3 fixed parent types, unlikely to grow | Solution 1 (multiple nullable FKs) |
| Rapid development, many parent types, some integrity risk is acceptable, and cleanup is handled carefully in app code | Solution 2 (generic polymorphic columns) |
| You control the schema for all parent types and want the most robust, migration-friendly long-term design | Solution 3 (supertype/subtype table) |
| The relationship is genuinely this flexible AND the rest of the app is document-oriented anyway | Consider NoSQL (see below) |

## NoSQL: Why This Problem Mostly Disappears

Document stores don't need any of these three patterns, because a reference is just a value — it doesn't need a rigid, single target table.

```json
{
  "_id": "comment_9001",
  "parent": { "type": "photo", "id": "photo_204" },
  "content": "Beautiful shot!"
}
```
There's no schema-level concept of "foreign key to exactly one table" to work around in the first place — `parent.type` and `parent.id` behave exactly like Solution 2, but without feeling like a workaround, since document databases were never designed around rigid single-table foreign keys. The trade-off is the same as elsewhere in NoSQL (see cheatsheet file 8): you gain flexibility, but the database itself won't catch a `parent.id` that points to nothing.

## Common Pitfalls

- Choosing Solution 2 (generic polymorphic columns) without any cleanup strategy for orphaned rows — deleting a `post` doesn't automatically delete its comments since there's no real FK, so a background job or application-level cascade logic is required.
- Adding a 4th, 5th, 6th nullable FK column to Solution 1 as new types get added — a sign it's time to migrate to Solution 3 rather than keep bolting on columns.
- Using Solution 2 with `parent_id` as `INT` when different parent tables use different ID types or ranges — always double check ID type consistency across all polymorphic targets.
- Forgetting the "exactly one parent set" `CHECK` constraint in Solution 1 — without it, a comment could end up with zero or multiple parents, which is nonsensical.

---
[← Previous: Job Board / Recruitment](17-job-board-recruitment.md) | [Back to index](00-README.md) | [Next: Survey / Dynamic Form Builder →](19-survey-dynamic-form-builder.md)
