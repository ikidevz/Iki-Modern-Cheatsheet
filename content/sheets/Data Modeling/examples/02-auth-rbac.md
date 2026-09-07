# 2. User Authentication & Role-Based Access Control (RBAC)

## Scenario

Almost every application needs to answer: "Who is this user, and what are they allowed to do?" This example models a flexible RBAC system where users have roles, roles have permissions, and (optionally) permissions can be granted directly to a user as an override.

## Entities & Relationships

| Entity | Description |
|---|---|
| User | An account holder |
| Role | A named collection of permissions (e.g., "Admin", "Editor") |
| Permission | A single allowed action (e.g., "delete_post", "view_billing") |
| User_Role | Junction: which roles a user has (M:N) |
| Role_Permission | Junction: which permissions a role grants (M:N) |
| User_Permission | Optional direct override grants/denies for a specific user |

```
User N───N Role  (via User_Role)
Role N───N Permission (via Role_Permission)
User N───N Permission (via User_Permission, for overrides)
```

## Schema (PostgreSQL)

```sql
CREATE TABLE app_user (
    user_id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE role (
    role_id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,       -- 'admin', 'editor', 'viewer'
    description VARCHAR(255)
);

CREATE TABLE permission (
    permission_id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,       -- 'delete_post', 'view_billing'
    description VARCHAR(255)
);

CREATE TABLE user_role (
    user_id BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    role_id INT NOT NULL REFERENCES role(role_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permission (
    role_id INT NOT NULL REFERENCES role(role_id) ON DELETE CASCADE,
    permission_id INT NOT NULL REFERENCES permission(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Optional: direct user-level override (grant or explicit deny)
CREATE TABLE user_permission (
    user_id BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    permission_id INT NOT NULL REFERENCES permission(permission_id) ON DELETE CASCADE,
    effect VARCHAR(5) NOT NULL CHECK (effect IN ('grant','deny')),
    PRIMARY KEY (user_id, permission_id)
);

CREATE INDEX idx_user_role_user ON user_role(user_id);
CREATE INDEX idx_role_permission_role ON role_permission(role_id);
```

## Sample Queries

**All effective permissions for a user (roles + overrides, with deny taking precedence):**
```sql
WITH role_perms AS (
    SELECT DISTINCT p.code
    FROM user_role ur
    JOIN role_permission rp ON ur.role_id = rp.role_id
    JOIN permission p ON rp.permission_id = p.permission_id
    WHERE ur.user_id = 42
),
overrides AS (
    SELECT p.code, up.effect
    FROM user_permission up
    JOIN permission p ON up.permission_id = p.permission_id
    WHERE up.user_id = 42
)
SELECT rp.code
FROM role_perms rp
WHERE rp.code NOT IN (SELECT code FROM overrides WHERE effect = 'deny')
UNION
SELECT code FROM overrides WHERE effect = 'grant';
```

**Check if a specific user can perform an action:**
```sql
SELECT EXISTS (
    SELECT 1
    FROM user_role ur
    JOIN role_permission rp ON ur.role_id = rp.role_id
    JOIN permission p ON rp.permission_id = p.permission_id
    WHERE ur.user_id = 42 AND p.code = 'delete_post'
) AND NOT EXISTS (
    SELECT 1 FROM user_permission
    WHERE user_id = 42 AND permission_id = (SELECT permission_id FROM permission WHERE code = 'delete_post')
    AND effect = 'deny'
) AS can_delete_post;
```

**All users with a given role:**
```sql
SELECT u.email
FROM app_user u
JOIN user_role ur ON u.user_id = ur.user_id
JOIN role r ON ur.role_id = r.role_id
WHERE r.name = 'admin';
```

## Advanced / Edge-Case Queries

**Orphaned roles — roles that grant zero permissions (likely misconfigured or leftover):**
```sql
SELECT r.role_id, r.name
FROM role r
LEFT JOIN role_permission rp ON r.role_id = rp.role_id
WHERE rp.permission_id IS NULL;
```

**Unused roles — roles no user currently holds (candidates for cleanup):**
```sql
SELECT r.role_id, r.name
FROM role r
LEFT JOIN user_role ur ON r.role_id = ur.role_id
WHERE ur.user_id IS NULL;
```

**Data integrity check — users with a conflicting override (both grant AND deny for the same permission, which should never happen given the PK):**
```sql
-- With the schema as defined this can't occur (PK prevents two rows for the same pair),
-- but if overrides ever allow history/multiple rows, this catches the conflict:
SELECT user_id, permission_id, COUNT(DISTINCT effect) AS conflicting_effects
FROM user_permission
GROUP BY user_id, permission_id
HAVING COUNT(DISTINCT effect) > 1;
```

**Redundant permission assignments — a user holds the same permission via more than one role (not wrong, but worth knowing when simplifying role structures):**
```sql
SELECT ur.user_id, p.code, COUNT(DISTINCT r.role_id) AS granting_roles
FROM user_role ur
JOIN role r ON ur.role_id = r.role_id
JOIN role_permission rp ON r.role_id = rp.role_id
JOIN permission p ON rp.permission_id = p.permission_id
GROUP BY ur.user_id, p.code
HAVING COUNT(DISTINCT r.role_id) > 1;
```

**Security review — users with the broadest effective access (highest permission count), useful for periodic access audits:**
```sql
SELECT u.email, COUNT(DISTINCT p.permission_id) AS permission_count
FROM app_user u
JOIN user_role ur ON u.user_id = ur.user_id
JOIN role_permission rp ON ur.role_id = rp.role_id
JOIN permission p ON rp.permission_id = p.permission_id
GROUP BY u.email
ORDER BY permission_count DESC
LIMIT 10;
```

## Design Decisions & Trade-offs

- **Roles sit between users and permissions** instead of assigning permissions directly to users — this is the core RBAC value: change what "Editor" means once, and every editor updates automatically. Assigning 50 permissions individually to 500 users doesn't scale.
- **`user_permission` overrides add flexibility but add complexity.** Many systems skip this table entirely and rely purely on roles for simplicity. Only add it if there's a real need for per-user exceptions (e.g., "this one viewer also needs billing access").
- **`effect` (grant/deny) on overrides matters for precedence rules** — decide explicitly whether deny always wins over grant (safer default) and document it, since this logic lives in application/query code, not enforced by the schema itself.
- **Junction tables use composite primary keys** (`user_id, role_id`) rather than a surrogate `id` — there's no need for a role assignment to have its own identity beyond the pair itself.

## Common Pitfalls

- Hardcoding role checks in application code (`if user.role == 'admin'`) instead of querying permissions — breaks the moment you need more granular access control.
- Not indexing junction table foreign keys, making permission checks (which run on nearly every request) slow.
- Building a system with only "roles," no way to represent common real-world needs like temporary access grants or per-resource permissions (e.g., "editor of *this* document only") — those require an additional resource-scoped permission model, a common follow-up requirement.
- Forgetting `ON DELETE CASCADE` on junction tables, leaving orphaned rows when a user or role is deleted.

---
[← Previous: E-Commerce](01-ecommerce-order-management.md) | [Back to index](00-README.md) | [Next: Social Network →](03-social-network.md)
