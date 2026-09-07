# 9. Hierarchical Data (Org Chart / Category Tree / Comment Threads)

## Scenario

Three very common real-world hierarchies — an employee org chart, a nested product category tree, and threaded comments — all share the same underlying modeling problem: **representing parent-child relationships of arbitrary, unknown depth.** This example walks through all four classic patterns using one running example (an org chart) so you can compare them directly.

## The Four Patterns

### Pattern 1: Adjacency List (Simplest)

Each row stores a direct reference to its parent.

```sql
CREATE TABLE employee (
    employee_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    manager_id BIGINT REFERENCES employee(employee_id)  -- NULL for the CEO/root
);
```

**Query: direct reports of a manager (easy):**
```sql
SELECT name FROM employee WHERE manager_id = 1;
```

**Query: entire org chart under a manager (requires recursion):**
```sql
WITH RECURSIVE org_chart AS (
    SELECT employee_id, name, manager_id, 0 AS depth
    FROM employee WHERE employee_id = 1
    UNION ALL
    SELECT e.employee_id, e.name, e.manager_id, oc.depth + 1
    FROM employee e
    JOIN org_chart oc ON e.manager_id = oc.employee_id
)
SELECT * FROM org_chart ORDER BY depth;
```

| Pros | Cons |
|---|---|
| Simple schema, trivial to insert/update/move a node | Reading a full subtree requires recursive queries |
| Matches how most people naturally think about the data | Deep trees can make recursive queries slow at scale |

### Pattern 2: Path Enumeration

Store the full ancestor path as a string on each row.

```sql
CREATE TABLE employee (
    employee_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    path VARCHAR(255) NOT NULL   -- e.g., '1/4/9' means employee 9 reports up through 4, then 1
);
```

**Query: all descendants of employee 1 (fast, no recursion needed):**
```sql
SELECT * FROM employee WHERE path LIKE '1/%';
```

**Query: all ancestors of employee 9 (parse the path):**
```sql
-- path = '1/4/9' → ancestors are 1 and 4
SELECT * FROM employee WHERE employee_id IN (1, 4);
```

| Pros | Cons |
|---|---|
| Fast ancestor/descendant queries, no recursion | Moving a subtree requires updating the path on every descendant |
| Easy to sort hierarchically (`ORDER BY path`) | Path string has a practical depth/length limit |

### Pattern 3: Nested Sets

Store `left` and `right` boundary numbers that encode tree position.

```sql
CREATE TABLE employee (
    employee_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    lft INT NOT NULL,
    rgt INT NOT NULL
);
```

**Query: all descendants (very fast, no recursion, no LIKE):**
```sql
SELECT child.name
FROM employee parent
JOIN employee child ON child.lft BETWEEN parent.lft AND parent.rgt
WHERE parent.employee_id = 1;
```

| Pros | Cons |
|---|---|
| Extremely fast reads for descendant/ancestor queries | Inserting/moving a node requires renumbering potentially many rows |
| Good for trees that are read far more than written | Hard to reason about and maintain by hand; usually needs helper functions |

**When to use:** Read-heavy, rarely-restructured trees (e.g., a static product category tree that admins update occasionally, but millions of customers browse).

### Pattern 4: Closure Table

A separate table lists every ancestor-descendant pair, including a node's relationship to itself.

```sql
CREATE TABLE employee (
    employee_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE employee_closure (
    ancestor_id BIGINT NOT NULL REFERENCES employee(employee_id),
    descendant_id BIGINT NOT NULL REFERENCES employee(employee_id),
    depth INT NOT NULL,       -- 0 = self, 1 = direct child, 2 = grandchild, etc.
    PRIMARY KEY (ancestor_id, descendant_id)
);
```

**Query: all descendants of employee 1 at any depth (simple join, no recursion):**
```sql
SELECT e.name, ec.depth
FROM employee_closure ec
JOIN employee e ON ec.descendant_id = e.employee_id
WHERE ec.ancestor_id = 1 AND ec.depth > 0
ORDER BY ec.depth;
```

**Query: direct children only:**
```sql
SELECT e.name
FROM employee_closure ec
JOIN employee e ON ec.descendant_id = e.employee_id
WHERE ec.ancestor_id = 1 AND ec.depth = 1;
```

| Pros | Cons |
|---|---|
| Fast for both ancestor AND descendant queries, no recursion | Extra table to maintain; more storage (grows with tree depth × breadth) |
| Moving a subtree is more manageable than nested sets | Insert logic is more complex than adjacency list |

**When to use:** Trees that need both frequent reads at any depth AND reasonably frequent structural changes — a good middle ground between adjacency list and nested sets.

## Pattern Comparison Summary

| Pattern | Read Descendants | Read Ancestors | Insert/Move Cost | Complexity |
|---|---|---|---|---|
| Adjacency List | Slow (recursive) | Slow (recursive) | Cheap | Lowest |
| Path Enumeration | Fast | Medium (parse path) | Expensive on move | Medium |
| Nested Sets | Very Fast | Very Fast | Very Expensive | High |
| Closure Table | Fast | Fast | Medium | Medium-High |

## Advanced / Edge-Case Queries

**Find all leaf nodes (employees with no direct reports) — adjacency list:**
```sql
SELECT e.name
FROM employee e
LEFT JOIN employee sub ON sub.manager_id = e.employee_id
WHERE sub.employee_id IS NULL;
```

**Find siblings of a node (same manager) — adjacency list:**
```sql
SELECT sibling.name
FROM employee e
JOIN employee sibling ON sibling.manager_id = e.manager_id AND sibling.employee_id != e.employee_id
WHERE e.employee_id = 9;
```

**Find the depth of a specific node from the root — adjacency list (recursive):**
```sql
WITH RECURSIVE ancestry AS (
    SELECT employee_id, manager_id, 0 AS depth
    FROM employee WHERE employee_id = 9
    UNION ALL
    SELECT e.employee_id, e.manager_id, a.depth + 1
    FROM employee e
    JOIN ancestry a ON e.employee_id = a.manager_id
)
SELECT MAX(depth) AS depth_from_root FROM ancestry;
```

**Move a subtree in a closure table (e.g., reassigning a team to a new manager) — delete stale ancestor paths, keep internal subtree paths, re-attach to the new ancestor chain:**
```sql
BEGIN;
-- Remove old paths connecting the moved node's subtree to its FORMER ancestors (but keep paths within the subtree itself)
DELETE FROM employee_closure
WHERE descendant_id IN (SELECT descendant_id FROM employee_closure WHERE ancestor_id = 9)
  AND ancestor_id IN (SELECT ancestor_id FROM employee_closure WHERE descendant_id = 9 AND ancestor_id != 9);

-- Re-attach the subtree under the new manager (employee 5) by combining the new ancestor's paths with the subtree's internal paths
INSERT INTO employee_closure (ancestor_id, descendant_id, depth)
SELECT sup.ancestor_id, sub.descendant_id, sup.depth + sub.depth + 1
FROM employee_closure sup
JOIN employee_closure sub ON sub.ancestor_id = 9
WHERE sup.descendant_id = 5;
COMMIT;
```

**Cycle-detection safeguard (adjacency list) — catches a data bug where an employee accidentally reports (directly or transitively) to themselves, which would otherwise make `WITH RECURSIVE` loop forever:**
```sql
WITH RECURSIVE chain AS (
    SELECT employee_id, manager_id, ARRAY[employee_id] AS path
    FROM employee WHERE employee_id = 9
    UNION ALL
    SELECT e.employee_id, e.manager_id, c.path || e.employee_id
    FROM employee e
    JOIN chain c ON e.employee_id = c.manager_id
    WHERE NOT e.employee_id = ANY(c.path)   -- stop before revisiting a node
)
SELECT * FROM chain;
```

## Applying This to Comment Threads

Comment threads (see also example 3, Social Network) almost always use **adjacency list** despite its recursive-query cost, because:
- Depth is typically shallow (a few levels of replies).
- Inserts (new comments) are extremely frequent — the cheap insert of adjacency list matters more than read speed here.
- Most UIs only render a few levels deep anyway, limiting recursion cost in practice.

## Applying This to Category Trees

Product category trees typically use **nested sets** or **path enumeration** because:
- Categories are read constantly (every product page, every filter sidebar) but restructured rarely (maybe a few times a year by an admin).
- Fast descendant queries ("show me all products in Electronics, including subcategories") matter far more than fast inserts.

## NoSQL Variant: Materialized Path in a Document Store

```json
{
  "_id": "cat_electronics_laptops_gaming",
  "name": "Gaming Laptops",
  "path": ["Electronics", "Laptops", "Gaming Laptops"],
  "ancestor_ids": ["cat_electronics", "cat_electronics_laptops"]
}
```
Storing `ancestor_ids` directly on each document lets you query "all descendants of Electronics" with a simple `ancestor_ids CONTAINS 'cat_electronics'` filter — the document-database equivalent of path enumeration, avoiding recursive queries entirely (most document stores don't support recursive joins the way SQL's `WITH RECURSIVE` does).

## Common Pitfalls

- Choosing nested sets for a tree that changes structure often — the renumbering cost on every insert/move becomes a serious bottleneck.
- Using adjacency list for a deep, read-heavy tree (like a large category hierarchy) and then discovering recursive queries don't scale.
- Forgetting a depth/cycle guard in recursive queries — a data bug that creates a cycle (A reports to B, B reports to A) will cause `WITH RECURSIVE` to loop until it hits engine limits.
- Not picking the pattern based on actual read/write ratio for that specific hierarchy — the "best" pattern is genuinely different for org charts vs. category trees vs. comment threads, as shown above.

---
[← Previous: Multi-tenant SaaS](08-multi-tenant-saas.md) | [Back to index](00-README.md) | [Next: Data Warehouse Star Schema →](10-warehouse-star-schema.md)
