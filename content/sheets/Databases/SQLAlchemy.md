# SQLAlchemy Cheat Sheet (Documented Edition)

> Covers both the classic (1.x) ORM style and the modern **SQLAlchemy 2.0** style.
> Where the two differ, the 2.0-style (recommended, future-proof) code is shown first,
> with the legacy equivalent noted below it.

---

## Table of Contents

1. [What Is SQLAlchemy?](#what-is-sqlalchemy)
2. [Installation](#installation)
3. [Core Concepts](#core-concepts)
4. [Basic Setup & Connection](#basic-setup--connection)
5. [Defining Models](#defining-models)
6. [Column Types](#column-types)
7. [Constraints & Indexes](#constraints--indexes)
8. [CRUD Operations](#crud-operations)
9. [Querying & Filtering](#querying--filtering)
10. [Relationships](#relationships)
11. [Joins](#joins)
12. [Aggregation & Grouping](#aggregation--grouping)
13. [Subqueries & CTEs](#subqueries--ctes)
14. [Raw SQL](#raw-sql)
15. [Session Management & Transactions](#session-management--transactions)
16. [Eager Loading (Performance)](#eager-loading-performance)
17. [Migrations with Alembic](#migrations-with-alembic)
18. [Async SQLAlchemy](#async-sqlalchemy)
19. [Common Patterns](#common-patterns)
20. [Common Errors & Fixes](#common-errors--fixes)
21. [Best Practices](#best-practices)
22. [Quick Reference Commands](#quick-reference-commands)

---

## What Is SQLAlchemy?

SQLAlchemy is a Python SQL toolkit with two layers you can use independently or together:

- **Core** — a SQL expression language for building queries as Python objects, close to raw SQL.
- **ORM** — maps Python classes to database tables so you work with objects instead of rows.

This cheat sheet focuses on the ORM, since that's how most applications use SQLAlchemy day to day.

---

## Installation

```bash
# Install SQLAlchemy
pip install sqlalchemy

# With database drivers (install the one matching your database)
pip install sqlalchemy psycopg2-binary   # PostgreSQL
pip install sqlalchemy pymysql           # MySQL
pip install sqlalchemy aiosqlite         # SQLite (async)
pip install sqlalchemy asyncpg           # PostgreSQL (async)
```

SQLite needs no extra driver — Python's standard library already includes `sqlite3`.

---

## Core Concepts

| Concept              | What it is                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| **Engine**           | The entry point to the database; manages a connection pool. Created once per application/database. |
| **Session**          | A "workspace" for ORM objects — tracks changes, and flushes/commits them to the database.          |
| **Declarative Base** | The base class your model classes inherit from, so SQLAlchemy knows how to map them to tables.     |
| **Mapped Class**     | A Python class linked to a database table (e.g. `User` ↔ `users` table).                           |
| **Unit of Work**     | SQLAlchemy's pattern of batching changes and writing them out together on `commit()`.              |

---

## Basic Setup & Connection

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Create engine — the pool of connections to your database
engine = create_engine('sqlite:///example.db', echo=False)
# echo=True prints every SQL statement SQLAlchemy runs — great for debugging

# Session factory
Session = sessionmaker(bind=engine)
session = Session()
```

### Connection String Formats

| Database           | Connection String                                       |
| ------------------ | ------------------------------------------------------- |
| SQLite (file)      | `sqlite:///example.db`                                  |
| SQLite (in-memory) | `sqlite:///:memory:`                                    |
| PostgreSQL         | `postgresql+psycopg2://user:pass@localhost:5432/dbname` |
| MySQL              | `mysql+pymysql://user:pass@localhost:3306/dbname`       |
| SQL Server         | `mssql+pyodbc://user:pass@dsn_name`                     |

> **Note:** always specify the driver explicitly (`postgresql+psycopg2://`, not just `postgresql://`)
> so it's clear which DBAPI library is in use.

---

## Defining Models

### Modern style (SQLAlchemy 2.0) — recommended

Uses `Mapped[]` type annotations and `mapped_column()`, giving you IDE autocomplete and static type checking.

```python
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from typing import Optional
from datetime import datetime

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(unique=True)
    email: Mapped[str]
    age: Mapped[Optional[int]]                     # nullable column
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    posts: Mapped[list["Post"]] = relationship(back_populates="author")

class Post(Base):
    __tablename__ = 'posts'

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str]
    content: Mapped[Optional[str]]
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))

    author: Mapped["User"] = relationship(back_populates="posts")

# Create tables
Base.metadata.create_all(engine)
```

### Legacy style (still works, widely seen in older code)

```python
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), nullable=False)
    age = Column(Integer)

    posts = relationship("Post", back_populates="author")

class Post(Base):
    __tablename__ = 'posts'

    id = Column(Integer, primary_key=True)
    title = Column(String(100), nullable=False)
    content = Column(String(500))
    user_id = Column(Integer, ForeignKey('users.id'))

    author = relationship("User", back_populates="posts")

Base.metadata.create_all(engine)
```

> **Why the change?** `declarative_base()` from `sqlalchemy.ext.declarative` still works but is
> deprecated in favor of `sqlalchemy.orm.declarative_base` / `DeclarativeBase`. New projects should
> use the `Mapped`/`mapped_column` style shown above.

---

## Column Types

```python
from sqlalchemy import Boolean, DateTime, Text, Float, Numeric, LargeBinary, JSON
from datetime import datetime

class Example(Base):
    __tablename__ = 'examples'

    id = Column(Integer, primary_key=True)
    name = Column(String(50))              # VARCHAR(50) — bounded text
    description = Column(Text)             # TEXT — unbounded text
    price = Column(Float)                  # floating point (imprecise)
    precise_price = Column(Numeric(10, 2)) # fixed-point decimal — use for money
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    metadata_blob = Column(JSON)           # stores dict/list, serialized as JSON
    raw_data = Column(LargeBinary)         # binary data (BLOB)
```

| Type                         | Use for                                                                   |
| ---------------------------- | ------------------------------------------------------------------------- |
| `Integer` / `BigInteger`     | Whole numbers                                                             |
| `String(n)`                  | Bounded text (VARCHAR)                                                    |
| `Text`                       | Long/unbounded text                                                       |
| `Float`                      | Approximate decimals (scientific data)                                    |
| `Numeric(precision, scale)`  | Exact decimals — **always use for currency**                              |
| `Boolean`                    | True/False flags                                                          |
| `DateTime` / `Date` / `Time` | Timestamps                                                                |
| `JSON`                       | Semi-structured data (supported natively on Postgres, MySQL, SQLite ≥3.9) |
| `Enum`                       | A fixed set of string values, validated at the DB level                   |

---

## Constraints & Indexes

```python
from sqlalchemy import UniqueConstraint, CheckConstraint, Index

class Product(Base):
    __tablename__ = 'products'

    id = Column(Integer, primary_key=True)
    sku = Column(String(20), nullable=False)
    price = Column(Numeric(10, 2))
    category = Column(String(50))

    __table_args__ = (
        UniqueConstraint('sku', name='uq_product_sku'),
        CheckConstraint('price >= 0', name='ck_price_positive'),
        Index('ix_product_category', 'category'),  # speeds up filtering by category
    )
```

Indexing frequently-filtered or joined-on columns (like foreign keys) is one of the highest-leverage
performance changes you can make — do it early, not after things get slow.

---

## CRUD Operations

### Create (Insert)

```python
# Single record
user = User(username='john_doe', email='john@example.com', age=25)
session.add(user)
session.commit()

# Multiple records
users = [
    User(username='alice', email='alice@example.com'),
    User(username='bob', email='bob@example.com'),
]
session.add_all(users)
session.commit()
```

`session.add()` only stages the object — nothing hits the database until `commit()` (or `flush()`).

### Read (Query) — 2.0 style with `select()`

```python
from sqlalchemy import select

# Get all
users = session.scalars(select(User)).all()

# Get first
user = session.scalars(select(User)).first()

# Get by primary key
user = session.get(User, 1)

# Filter
users = session.scalars(select(User).where(User.age > 18)).all()
user = session.scalars(select(User).where(User.username == 'john_doe')).first()
```

### Read (Query) — legacy `Query` API (still supported)

```python
users = session.query(User).all()
user = session.query(User).first()
user = session.query(User).get(1)          # deprecated; prefer session.get()
users = session.query(User).filter(User.age > 18).all()
```

> `Query.get()` is deprecated as of 1.4/2.0 — use `Session.get()` instead.

### Update

```python
# Update a single loaded object
user = session.scalars(select(User).where(User.username == 'john_doe')).first()
user.age = 26
session.commit()   # SQLAlchemy detects the change and issues UPDATE automatically

# Bulk update (skips ORM object tracking — faster for large batches)
from sqlalchemy import update
session.execute(update(User).where(User.age < 18).values(age=18))
session.commit()
```

### Delete

```python
# Delete a single loaded object
user = session.scalars(select(User).where(User.username == 'john_doe')).first()
session.delete(user)
session.commit()

# Bulk delete
from sqlalchemy import delete
session.execute(delete(User).where(User.age < 18))
session.commit()
```

> **Bulk update/delete caveat:** these bypass Python-side events (like `relationship` cascades and
> ORM-level validation) and act directly on the database rows. Use them for performance on large
> datasets; use the object-based approach when you need ORM hooks to fire.

---

## Querying & Filtering

```python
from sqlalchemy import select, and_, or_, func

# Ordering
select(User).order_by(User.age)
select(User).order_by(User.age.desc())

# Limiting / pagination
select(User).limit(5)
select(User).offset(10).limit(5)

# Counting
count = session.scalar(select(func.count()).select_from(User))

# Distinct
select(User.username).distinct()

# Combining filters
select(User).where(and_(User.age > 18, User.username.like('j%')))
select(User).where(or_(User.age > 65, User.age < 18))
```

### Filter Operators Reference

| Operator                          | Example                         | Meaning                                    |
| --------------------------------- | ------------------------------- | ------------------------------------------ |
| `==` / `!=`                       | `User.age == 25`                | Equality                                   |
| `>` `<` `>=` `<=`                 | `User.age > 18`                 | Comparison                                 |
| `.in_([...])`                     | `User.age.in_([25, 30])`        | Value in a list                            |
| `.like('%x%')`                    | `User.username.like('%john%')`  | Pattern match (case-sensitive on most DBs) |
| `.ilike('%x%')`                   | `User.username.ilike('%john%')` | Case-insensitive pattern match             |
| `.between(a, b)`                  | `User.age.between(18, 65)`      | Inclusive range                            |
| `.is_(None)` / `.isnot(None)`     | `User.email.is_(None)`          | NULL checks                                |
| `.contains(x)`                    | `User.username.contains('doe')` | Substring match                            |
| `.startswith(x)` / `.endswith(x)` | `User.username.startswith('j')` | Prefix/suffix match                        |

---

## Relationships

### One-to-Many

```python
class Department(Base):
    __tablename__ = 'departments'
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    employees: Mapped[list["Employee"]] = relationship(back_populates="department")

class Employee(Base):
    __tablename__ = 'employees'
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    department_id: Mapped[int] = mapped_column(ForeignKey('departments.id'))
    department: Mapped["Department"] = relationship(back_populates="employees")
```

### Many-to-Many

```python
from sqlalchemy import Table

user_role_association = Table(
    'user_roles', Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('role_id', Integer, ForeignKey('roles.id'), primary_key=True),
)

class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str]
    roles: Mapped[list["Role"]] = relationship(secondary=user_role_association, back_populates="users")

class Role(Base):
    __tablename__ = 'roles'
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    users: Mapped[list["User"]] = relationship(secondary=user_role_association, back_populates="roles")
```

### One-to-One

Same as one-to-many, but pass `uselist=False` on the "one" side:

```python
class Profile(Base):
    __tablename__ = 'profiles'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), unique=True)
    user: Mapped["User"] = relationship(back_populates="profile")

# on User:
profile: Mapped["Profile"] = relationship(back_populates="user", uselist=False)
```

### `back_populates` vs `backref`

- `back_populates` — **preferred**. You explicitly declare the relationship on both classes; easier
  to trace and works well with type checkers.
- `backref` — declares the relationship on one class only, and auto-generates the other side. Shorter,
  but harder to trace/type-check. Still fine for quick scripts.

### Cascades

```python
posts: Mapped[list["Post"]] = relationship(
    back_populates="author",
    cascade="all, delete-orphan",   # deleting a User deletes their Posts too
)
```

---

## Joins

```python
from sqlalchemy import select

# Inner join
select(User, Post).join(Post)

# Left outer join
select(User).outerjoin(Post)

# Filter on the joined table
select(User).join(Post).where(Post.title.like('%Python%'))

# Explicit join condition (when it can't be inferred from a FK)
select(User).join(Post, Post.user_id == User.id)
```

Accessing a relationship attribute (e.g. `user.posts`) triggers a separate query unless you've eager
loaded it — see [Eager Loading](#eager-loading-performance) below.

---

## Aggregation & Grouping

```python
from sqlalchemy import func, select

# Count
user_count = session.scalar(select(func.count(User.id)))

# Group by
age_counts = session.execute(
    select(User.age, func.count(User.id)).group_by(User.age)
).all()

# Having
popular_ages = session.execute(
    select(User.age, func.count(User.id))
    .group_by(User.age)
    .having(func.count(User.id) > 1)
).all()

# Min, Max, Avg, Sum
stats = session.execute(
    select(func.min(User.age), func.max(User.age), func.avg(User.age), func.sum(User.age))
).first()
```

---

## Subqueries & CTEs

```python
from sqlalchemy import select, func

# Subquery: users older than average age
avg_age_subq = select(func.avg(User.age)).scalar_subquery()
older_than_avg = session.scalars(
    select(User).where(User.age > avg_age_subq)
).all()

# Common Table Expression (CTE)
cte = select(User.department_id, func.count(User.id).label('cnt')) \
        .group_by(User.department_id).cte('dept_counts')

result = session.execute(select(cte)).all()
```

---

## Raw SQL

Always use `text()` — passing a bare string to `execute()` is **not supported in SQLAlchemy 2.0**.

```python
from sqlalchemy import text

result = session.execute(text("SELECT * FROM users WHERE age > :age"), {"age": 18})
rows = result.fetchall()
```

Bound parameters (`:age`) protect against SQL injection — never use Python f-strings/`%` to build SQL.

---

## Session Management & Transactions

### Context manager (recommended)

```python
with Session(engine) as session:
    with session.begin():           # transaction block: auto-commits, or rolls back on exception
        user = User(username='test')
        session.add(user)
    # transaction committed here
```

### Manual management

```python
session = Session()
try:
    user = User(username='test')
    session.add(user)
    session.commit()
except Exception:
    session.rollback()
    raise
finally:
    session.close()
```

### Scoped Sessions (for web apps / multi-threaded code)

```python
from sqlalchemy.orm import scoped_session, sessionmaker

Session = scoped_session(sessionmaker(bind=engine))
# Session() now returns the same session per thread automatically
# call Session.remove() at the end of a request/thread
```

---

## Eager Loading (Performance)

By default, relationships are **lazy-loaded** — accessing `user.posts` fires a new query the first
time it's touched. This causes the classic **N+1 query problem** when looping over many objects.

```python
from sqlalchemy.orm import joinedload, selectinload

# joinedload: one query using a SQL JOIN — good for many-to-one / one-to-one
users = session.scalars(
    select(User).options(joinedload(User.department))
).unique().all()

# selectinload: two queries, second one uses IN(...) — good for one-to-many / many-to-many
users = session.scalars(
    select(User).options(selectinload(User.posts))
).all()
```

| Strategy         | Extra queries                 | Best for                                      |
| ---------------- | ----------------------------- | --------------------------------------------- |
| `lazy` (default) | 1 per access                  | Rarely-accessed relationships                 |
| `joinedload`     | 0 (single JOIN)               | To-one relationships                          |
| `selectinload`   | 1 extra (batched `IN`)        | To-many relationships, avoids row duplication |
| `subqueryload`   | 1 extra (correlated subquery) | Large to-many sets, older SQLAlchemy versions |

---

## Migrations with Alembic

`Base.metadata.create_all()` only creates tables that don't exist yet — it won't alter existing
tables. For real projects, use **Alembic** to version-control schema changes.

```bash
pip install alembic
alembic init migrations          # scaffolds a migrations/ folder

# after editing migrations/env.py to point at your Base.metadata:
alembic revision --autogenerate -m "add age column to users"
alembic upgrade head              # apply migrations
alembic downgrade -1              # roll back one migration
```

---

## Async SQLAlchemy

SQLAlchemy 1.4+ supports async engines/sessions (requires an async driver like `asyncpg` or `aiosqlite`).

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select

engine = create_async_engine('sqlite+aiosqlite:///example.db')

async def get_users():
    async with AsyncSession(engine) as session:
        result = await session.execute(select(User))
        return result.scalars().all()
```

---

## Common Patterns

```python
# Get or create
def get_or_create(session, model, **kwargs):
    instance = session.scalars(select(model).filter_by(**kwargs)).first()
    if instance:
        return instance, False
    instance = model(**kwargs)
    session.add(instance)
    return instance, True

user, created = get_or_create(session, User, username='john')

# Pagination helper
def paginate(stmt, page, per_page=20):
    return stmt.offset((page - 1) * per_page).limit(per_page)

users = session.scalars(paginate(select(User), page=1, per_page=10)).all()
```

---

## Common Errors & Fixes

| Error                                                                                     | Likely Cause                                                     | Fix                                                                            |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `DetachedInstanceError`                                                                   | Accessing a relationship after the session that loaded it closed | Eager-load the relationship, or keep the session open while you use the object |
| `ObjectDeletedError`                                                                      | Referencing an object deleted in another session/transaction     | Re-query the object before using it                                            |
| `IntegrityError: UNIQUE constraint failed`                                                | Inserting a duplicate value into a unique column                 | Check for existing rows first, or catch and handle the exception               |
| `InvalidRequestError: Textual SQL expression ... should be explicitly declared as text()` | Passing a raw string to `execute()` in 2.0                       | Wrap it in `text("...")`                                                       |
| N+1 queries in logs (`echo=True`)                                                         | Lazy loading in a loop                                           | Use `joinedload`/`selectinload`                                                |

---

## Best Practices

1. **Use `Mapped`/`mapped_column`** (2.0 style) for new projects — better type checking and IDE support.
2. **Always use sessions in context managers** so they're closed even if an exception occurs.
3. **Commit explicitly** — nothing is written until `commit()` or `flush()`.
4. **Handle exceptions and roll back** on errors to avoid leaving a session in a bad state.
5. **Use relationships** rather than manually joining tables where possible — more readable and less error-prone.
6. **Index frequently queried and joined-on columns**, especially foreign keys.
7. **Use bulk `update()`/`delete()`** for large batch operations — they skip per-row ORM overhead.
8. **Choose eager loading deliberately** (`joinedload`/`selectinload`) to avoid N+1 queries.
9. **Never build SQL with string formatting** — always use `text()` with bound parameters.
10. **Use Alembic** for schema migrations in any project beyond a quick script.

---

## Quick Reference Commands

```bash
# Install SQLAlchemy
pip install sqlalchemy

# With database drivers
pip install sqlalchemy psycopg2-binary  # PostgreSQL
pip install sqlalchemy pymysql          # MySQL
pip install sqlalchemy aiosqlite        # SQLite (async)

# Alembic (migrations)
pip install alembic
alembic init migrations
alembic revision --autogenerate -m "message"
alembic upgrade head
```
