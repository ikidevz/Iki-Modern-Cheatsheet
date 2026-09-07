# 5. Blog / CMS

## Scenario

A content management system: authors write posts, posts belong to categories and can have multiple tags, and posts go through draft/published states with revision history.

## Entities & Relationships

| Entity | Description |
|---|---|
| Author | A content creator |
| Post | An article/blog entry |
| Category | Single grouping per post (N:1) |
| Tag | Multiple labels per post (M:N) |
| Post_Revision | Version history of a post's content |

```
Author 1───N Post N───1 Category
Post   N───N Tag       (via Post_Tag)
Post   1───N Post_Revision
```

## Schema (PostgreSQL)

```sql
CREATE TABLE author (
    author_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE category (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE tag (
    tag_id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE post (
    post_id BIGSERIAL PRIMARY KEY,
    author_id BIGINT NOT NULL REFERENCES author(author_id),
    category_id INT REFERENCES category(category_id),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,               -- current published/draft content
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','published','archived')),
    published_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE post_tag (
    post_id BIGINT NOT NULL REFERENCES post(post_id) ON DELETE CASCADE,
    tag_id INT NOT NULL REFERENCES tag(tag_id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

-- Revision history: snapshot of content each time it's edited
CREATE TABLE post_revision (
    revision_id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES post(post_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    edited_by BIGINT NOT NULL REFERENCES author(author_id),
    edited_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_status_published ON post(status, published_at DESC);
CREATE INDEX idx_post_tag_tag ON post_tag(tag_id);
```

## Sample Queries

**Published posts in a category, newest first:**
```sql
SELECT p.title, p.slug, p.published_at, a.name AS author
FROM post p
JOIN author a ON p.author_id = a.author_id
WHERE p.status = 'published'
  AND p.category_id = (SELECT category_id FROM category WHERE slug = 'engineering')
ORDER BY p.published_at DESC
LIMIT 10;
```

**Posts by tag:**
```sql
SELECT p.title, p.slug
FROM post p
JOIN post_tag pt ON p.post_id = pt.post_id
JOIN tag t ON pt.tag_id = t.tag_id
WHERE t.name = 'data-modeling' AND p.status = 'published';
```

**Revision history for a post (most recent first):**
```sql
SELECT pr.revision_id, a.name AS edited_by, pr.edited_at
FROM post_revision pr
JOIN author a ON pr.edited_by = a.author_id
WHERE pr.post_id = 501
ORDER BY pr.edited_at DESC;
```

## Advanced / Edge-Case Queries

**Full-text search across published posts (PostgreSQL native text search):**
```sql
SELECT title, slug,
       ts_rank(to_tsvector('english', title || ' ' || content), query) AS rank
FROM post, to_tsquery('english', 'data & modeling') query
WHERE to_tsvector('english', title || ' ' || content) @@ query
  AND status = 'published'
ORDER BY rank DESC;
```

**Related posts by shared tags (simple content-based recommendation):**
```sql
SELECT p2.title, COUNT(*) AS shared_tags
FROM post_tag pt1
JOIN post_tag pt2 ON pt1.tag_id = pt2.tag_id AND pt1.post_id != pt2.post_id
JOIN post p2 ON pt2.post_id = p2.post_id
WHERE pt1.post_id = 501 AND p2.status = 'published'
GROUP BY p2.title
ORDER BY shared_tags DESC
LIMIT 5;
```

**Content gap report — published posts with no tags assigned:**
```sql
SELECT p.title, p.slug
FROM post p
LEFT JOIN post_tag pt ON p.post_id = pt.post_id
WHERE p.status = 'published' AND pt.tag_id IS NULL;
```

**Author productivity — published posts per month:**
```sql
SELECT a.name, date_trunc('month', p.published_at) AS month, COUNT(*) AS posts_published
FROM post p
JOIN author a ON p.author_id = a.author_id
WHERE p.status = 'published'
GROUP BY a.name, month
ORDER BY month DESC, posts_published DESC;
```

**Stale content report — published posts not updated in over a year (candidates for a refresh pass):**
```sql
SELECT title, slug, updated_at
FROM post
WHERE status = 'published'
  AND updated_at < now() - INTERVAL '1 year'
ORDER BY updated_at ASC;
```

## Design Decisions & Trade-offs

- **`post.content` always holds the current version; `post_revision` stores historical snapshots.** This keeps the common case (rendering the current post) a simple single-row lookup, while still preserving full history for rollback/audit — a good example of designing around the dominant access pattern.
- **`category` is N:1 with `post`** (one category per post) while **`tag` is M:N** — this reflects a real editorial distinction: categories are usually meant to be exclusive/structural (choose one section), tags are supplementary labels (apply many). If the business later wants posts in multiple categories, that relationship would need to become M:N too — always confirm this cardinality assumption with stakeholders early (see cheatsheet file 10, "ignoring cardinality" pitfall).
- **`slug` columns are `UNIQUE`** because they're used in URLs — enforcing uniqueness at the database level prevents broken/colliding links.
- **Composite index on `(status, published_at DESC)`** directly matches the most common query pattern (list published posts, newest first) — see cheatsheet file 5 on designing indexes around access patterns.

## NoSQL Variant: Document Store

Blog content is a natural fit for documents — a post is mostly self-contained, read far more often than written, and rarely needs relational joins at read time.

```json
{
  "_id": "post_501",
  "title": "Data Modeling 101",
  "slug": "data-modeling-101",
  "author": { "id": "author_7", "name": "Jane Doe" },
  "category": "Engineering",
  "tags": ["data-modeling", "databases", "sql"],
  "content": "...",
  "status": "published",
  "published_at": "2026-08-01T09:00:00Z",
  "revisions": [
    { "edited_at": "2026-07-28T14:00:00Z", "edited_by": "author_7" }
  ]
}
```
`author` is embedded as a small denormalized snapshot (name shown alongside posts without a join), `tags` is a simple array (no junction table needed — document databases handle small arrays natively), and full revision *content* would typically live in a separate collection if it grows large, referenced by `post_id`, to avoid unbounded document growth (see cheatsheet file 8 on embedding limits).

## Common Pitfalls

- Storing tags as a comma-separated string in a single column (`"sql,databases,tips"`) instead of a proper junction table or array type — makes filtering/searching by tag painful and error-prone.
- Overwriting `post.content` on every edit without saving to `post_revision` first, permanently losing edit history.
- Not enforcing `slug` uniqueness, leading to duplicate URLs.
- Embedding unbounded revision history directly inside a document-store post record, causing the document to balloon in size over the post's lifetime.

---
[← Previous: Booking/Reservation](04-booking-reservation.md) | [Back to index](00-README.md) | [Next: Inventory & Warehouse →](06-inventory-warehouse.md)
