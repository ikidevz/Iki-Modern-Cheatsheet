# The Complete Redis Production Guide: From Basics to Advanced Patterns

> A production-oriented Redis reference: core data types, real Python implementation patterns (sessions, caching, rate limiting, locks, leaderboards, carts, queues), performance, and operations. A quick command reference and generic key-command table (not in the original) have been added up front for fast lookup — the deep-dive explanations and production code follow below.

## 📑 Table of Contents

- [Introduction to Redis](#introduction-to-redis)
  - [Why Redis?](#why-redis)
  - [When to Use Redis](#when-to-use-redis)
- [⚡ Quick Command Reference](#quick-command-reference)
- [Core Data Types Deep Dive](#core-data-types-deep-dive)
  - [1. String - The Foundation](#1-string---the-foundation)
  - [2. Hash - Structured Objects](#2-hash---structured-objects)
  - [3. List - Ordered Collections](#3-list---ordered-collections)
  - [4. Set - Unique Collections](#4-set---unique-collections)
  - [5. Sorted Set (ZSet) - Ranked Collections](#5-sorted-set-zset---ranked-collections)
  - [6. Bitmap - Space-Efficient Flags](#6-bitmap---space-efficient-flags)
- [Production-Ready Python Implementation](#production-ready-python-implementation)
  - [Installation & Setup](#installation-setup)
  - [1. Session Management](#1-session-management)
  - [2. Caching Layer](#2-caching-layer)
  - [3. Rate Limiter](#3-rate-limiter)
  - [4. Distributed Lock](#4-distributed-lock)
  - [5. Gaming Leaderboard](#5-gaming-leaderboard)
  - [6. Shopping Cart (Hash)](#6-shopping-cart-hash)
  - [7. Message Queue (List)](#7-message-queue-list)
- [Performance Optimization](#performance-optimization)
  - [Memory Optimization](#memory-optimization)
  - [Connection Optimization](#connection-optimization)
  - [Query Optimization](#query-optimization)
- [Best Practices & Common Pitfalls](#best-practices-common-pitfalls)
  - [Security Best Practices](#security-best-practices)
  - [Data Persistence](#data-persistence)
  - [Common Pitfalls to Avoid](#common-pitfalls-to-avoid)
- [Monitoring & Troubleshooting](#monitoring-troubleshooting)
  - [Key Metrics to Monitor](#key-metrics-to-monitor)
  - [Health Check Script](#health-check-script)
  - [Common Issues and Solutions](#common-issues-and-solutions)
- [Production Deployment Checklist](#production-deployment-checklist)
  - [Pre-deployment](#pre-deployment)
  - [Post-deployment](#post-deployment)
  - [Scaling Strategies](#scaling-strategies)
- [Conclusion](#conclusion)
- [Additional Resources](#additional-resources)

## Introduction to Redis

Redis (Remote Dictionary Server) is an in-memory data structure store used as a database, cache, message broker, and streaming engine. Its sub-millisecond response times make it ideal for high-performance applications that require real-time data access.

### Why Redis?

**Speed:** Redis operates entirely in-memory, delivering response times under 1ms for most operations. This makes it 100-1000x faster than traditional disk-based databases for read operations.

**Versatility:** Unlike simple key-value stores, Redis supports rich data structures (strings, hashes, lists, sets, sorted sets, bitmaps) that map directly to real-world use cases.

**Simplicity:** Redis has a straightforward API and doesn't require complex query languages or schemas, making it easy to adopt and maintain.

**Scalability:** With built-in replication, persistence, and clustering support, Redis scales from prototype to enterprise-grade applications.

### When to Use Redis

**Perfect for:**

- Session storage and user state management
- Real-time analytics and leaderboards
- Caching frequently accessed data
- Rate limiting and API throttling
- Pub/sub messaging systems
- Temporary data with TTL requirements

**Not ideal for:**

- Complex relational queries with multiple joins
- Primary data storage requiring ACID guarantees
- Large binary objects (>100MB)
- Full-text search (use Elasticsearch instead)

---

## ⚡ Quick Command Reference

**Data types at a glance**

| Type | Think of it as | Typical use cases | Notes |
|---|---|---|---|
| String | A single value (text, number, or binary) | Sessions, caches, counters, locks | O(1) get/set, up to 512MB |
| Hash | An object / dict of field→value | User profiles, shopping carts | O(1) per field, cheaper than many separate string keys |
| List | A linked list | Queues, timelines, recent-items feeds | O(1) push/pop at head or tail, O(n) to access the middle |
| Set | An unordered unique collection | Tags, membership checks, dedup | O(1) membership check, supports union/intersect/diff |
| Sorted Set (ZSet) | A set ordered by a numeric score | Leaderboards, ranked feeds, priority queues | O(log n) insert/update, range queries by rank or score |
| Bitmap | A string treated as a bit array | Feature flags, daily-active-user tracking | Extremely memory-efficient for boolean-per-ID data |

**Generic key commands** *(apply to keys of any type — missing from the original guide)*

| Command | Purpose |
|---|---|
| `EXISTS key` | Check whether a key exists |
| `DEL key [key ...]` | Delete one or more keys |
| `TYPE key` | Get the data type stored at a key |
| `EXPIRE key seconds` | Set a TTL on a key |
| `TTL key` / `PTTL key` | Time-to-live in seconds / ms (`-1` = no TTL, `-2` = key doesn't exist) |
| `PERSIST key` | Remove a key's TTL, making it permanent |
| `RENAME key newkey` | Rename a key |
| `COPY source destination` | Copy a key's value to a new key |
| `KEYS pattern` | Find keys matching a glob pattern — ⚠️ blocks the server, avoid in production |
| `SCAN cursor [MATCH pattern] [COUNT n]` | Non-blocking, cursor-based key iteration — the production-safe alternative to `KEYS` |
| `RANDOMKEY` | Return a random key from the current database |
| `DBSIZE` | Number of keys in the current database |
| `FLUSHDB` / `FLUSHALL` | Delete all keys in the current / all databases — ⚠️ destructive |
| `OBJECT ENCODING key` | Inspect the internal encoding Redis chose for a key (useful for memory tuning) |

**Per-type command quick reference**

```redis
# STRING
SET key value | GET key | SETEX key 3600 value | SETNX key value
INCR key | DECR key | INCRBY key 10 | APPEND key " more"

# HASH
HSET key field value | HGET key field | HGETALL key | HDEL key field
HINCRBY key field 5 | HEXISTS key field | HKEYS key | HVALS key

# LIST
LPUSH key value | RPUSH key value | LPOP key | RPOP key
LRANGE key 0 10 | LLEN key | BLPOP key timeout | LTRIM key 0 99

# SET
SADD key member | SREM key member | SISMEMBER key member | SMEMBERS key
SCARD key | SINTER key1 key2 | SUNION key1 key2 | SDIFF key1 key2 | SPOP key

# SORTED SET (ZSET)
ZADD key score member | ZRANGE key 0 10 WITHSCORES | ZREVRANGE key 0 10
ZRANK key member | ZSCORE key member | ZINCRBY key 10 member
ZCOUNT key min max | ZRANGEBYSCORE key min max

# BITMAP
SETBIT key offset value | GETBIT key offset | BITCOUNT key
BITOP AND dest key1 key2 | BITPOS key 1
```

Full explanations, real-world use cases, and pro tips for each type are in [Core Data Types Deep Dive](#core-data-types-deep-dive) below.

## Core Data Types Deep Dive

Understanding Redis data types is crucial for choosing the right tool for your use case. Let's explore each type with practical examples.

### 1. String - The Foundation

Strings are the most basic Redis type, capable of storing text, numbers, or binary data up to 512MB.

**Key Commands:**

```redis
SET key value              # Basic set
GET key                    # Retrieve value
SETEX key 3600 value      # Set with 3600s expiration
SETNX key value           # Set only if key doesn't exist
INCR key                  # Atomic increment
DECR key                  # Atomic decrement
INCRBY key 10             # Increment by amount
APPEND key " more"        # Append to existing value
```

**Real-World Use Cases:**

_Session Management:_ Store user session data with automatic expiration.

```
session:a1b2c3 → {"user_id": 123, "role": "admin", "login_time": "2025-01-02"}
```

_Distributed Caching:_ Cache expensive database queries or API responses.

```
cache:user:123 → {"name": "John", "email": "john@example.com"}
```

_Distributed Locks:_ Implement mutexes across multiple servers.

```
lock:payment:order_456 → "server-1-uuid-xyz"
```

_Counters:_ Track page views, downloads, or API calls atomically.

```
counter:page_views:homepage → 1547823
```

**Pro Tips:**

- Always set expiration times on session data to prevent memory bloat
- Use `SETNX` for implementing locks to ensure atomicity
- Leverage `INCR`/`DECR` for counters instead of GET-modify-SET to avoid race conditions
- Consider compression for large string values to save memory

### 2. Hash - Structured Objects

Hashes store field-value pairs, perfect for representing objects without JSON serialization overhead.

**Key Commands:**

```redis
HSET key field value           # Set single field
HMSET key f1 v1 f2 v2         # Set multiple fields
HGET key field                 # Get single field
HGETALL key                    # Get all fields
HINCRBY key field 5            # Increment field by 5
HDEL key field                 # Delete field
HEXISTS key field              # Check if field exists
HKEYS key                      # Get all field names
HVALS key                      # Get all values
```

**Real-World Use Cases:**

_Shopping Cart:_ Store cart items with quantities and metadata.

```
cart:user123 → {
  "product_1": '{"qty": 2, "price": 29.99}',
  "product_2": '{"qty": 1, "price": 99.99}'
}
```

_User Profiles:_ Store user attributes without JSON overhead.

```
user:123 → {
  "name": "John Doe",
  "email": "john@example.com",
  "age": "30",
  "country": "USA"
}
```

_Feature Flags:_ Manage per-user feature toggles.

```
features:user123 → {
  "dark_mode": "true",
  "beta_features": "false",
  "premium": "true"
}
```

**Pro Tips:**

- Hashes are more memory-efficient than separate string keys when you have many fields
- Use `HINCRBY` for inventory tracking to avoid race conditions
- Set TTL on the entire hash key, not individual fields
- Keep field names short to save memory

### 3. List - Ordered Collections

Lists are linked lists of strings, ideal for queues and timelines where order matters.

**Key Commands:**

```redis
LPUSH key value              # Push to left (head)
RPUSH key value              # Push to right (tail)
LPOP key                     # Pop from left
RPOP key                     # Pop from right
LRANGE key 0 10              # Get range of elements
LLEN key                     # Get list length
BLPOP key timeout            # Blocking pop (wait for item)
LTRIM key 0 99               # Keep only first 100 items
```

**Real-World Use Cases:**

_Message Queue:_ Implement task queues for background processing.

```
queue:emails → ["task1", "task2", "task3"]
```

_Activity Feed:_ Store recent user activities in chronological order.

```
feed:user123 → ["Posted photo", "Liked comment", "Added friend"]
```

_Recent Items:_ Track user's recent searches or viewed products.

```
recent:searches:user123 → ["laptop", "mouse", "keyboard"]
```

**Pro Tips:**

- Use `LPUSH` + `RPOP` for FIFO queue (first in, first out)
- Use `RPUSH` + `RPOP` for LIFO stack (last in, first out)
- Use `BLPOP` for worker queues to avoid polling
- Use `LTRIM` to cap list size and prevent unbounded growth
- Lists are not suitable for searching - use sets instead

### 4. Set - Unique Collections

Sets store unique, unordered strings, perfect for membership testing and set operations.

**Key Commands:**

```redis
SADD key member              # Add member
SREM key member              # Remove member
SISMEMBER key member         # Check membership (O(1))
SMEMBERS key                 # Get all members
SCARD key                    # Get count
SINTER key1 key2             # Intersection
SUNION key1 key2             # Union
SDIFF key1 key2              # Difference
SPOP key                     # Remove random member
```

**Real-World Use Cases:**

_Unique Visitors:_ Track unique IP addresses or user IDs.

```
visitors:2025-01-02 → {"192.168.1.1", "10.0.0.5", "172.16.0.1"}
```

_Tag System:_ Store unique tags for articles or products.

```
tags:article123 → {"redis", "database", "caching", "performance"}
```

_Social Relationships:_ Store followers, friends, or blocked users.

```
followers:user123 → {"user456", "user789", "user012"}
```

**Pro Tips:**

- Use `SISMEMBER` for fast O(1) membership checks (whitelists/blacklists)
- Leverage `SINTER` to find common interests between users
- Use `SUNION` to aggregate tags across multiple items
- Sets are unordered - use sorted sets if order matters

### 5. Sorted Set (ZSet) - Ranked Collections

Sorted sets maintain unique members ordered by a score, combining the benefits of sets and ordered lists.

**Key Commands:**

```redis
ZADD key score member         # Add with score
ZRANGE key 0 10 WITHSCORES   # Get range (ascending)
ZREVRANGE key 0 10           # Get range (descending)
ZRANK key member             # Get rank (0-based, ascending)
ZREVRANK key member          # Get rank (descending)
ZSCORE key member            # Get score
ZINCRBY key 10 member        # Increment score
ZREM key member              # Remove member
ZCOUNT key min max           # Count in score range
ZRANGEBYSCORE key min max    # Get by score range
```

**Real-World Use Cases:**

_Leaderboards:_ Rank players by score in real-time.

```
leaderboard:global → {
  "player1": 15000,
  "player2": 12500,
  "player3": 10000
}
```

_Priority Queue:_ Order tasks by priority or timestamp.

```
tasks:pending → {
  "task1": 1704153600,  # timestamp as score
  "task2": 1704153700,
  "task3": 1704153800
}
```

_Rate Limiting:_ Implement sliding window rate limiter.

```
rate_limit:user123 → {
  "req1": 1704153600.123,
  "req2": 1704153601.456,
  "req3": 1704153602.789
}
```

**Pro Tips:**

- Use timestamps as scores for time-based ordering
- Use `ZREMRANGEBYSCORE` to expire old entries in sliding windows
- Sorted sets are perfect for "top N" queries with `ZREVRANGE`
- Use `ZINCRBY` for real-time score updates (upvotes, points)

### 6. Bitmap - Space-Efficient Flags

Bitmaps are strings treated as bit arrays, incredibly space-efficient for boolean flags.

**Key Commands:**

```redis
SETBIT key offset value       # Set bit at position
GETBIT key offset             # Get bit at position
BITCOUNT key                  # Count set bits
BITOP AND dest key1 key2      # Bitwise operations
BITPOS key 1                  # Find first set bit
```

**Real-World Use Cases:**

_Daily Active Users:_ Track user logins across days.

```
users:active:2025-01-02 → Bitmap where bit position = user_id
```

_Feature Access:_ Track feature usage per user.

```
features:analytics → Bitmap where bit N = user N has access
```

_Real-time Analytics:_ Track event occurrences efficiently.

```
events:signup:2025-01 → Bitmap where bit position = day of month
```

**Pro Tips:**

- 1 million users take only ~122KB (vs 8MB with sets)
- Use `BITOP` for complex analytics (users active both Monday AND Tuesday)
- Perfect for retention analysis and cohort tracking
- Map entity IDs to small integers for bit positions

---

## Production-Ready Python Implementation

Let's implement the seven most common Redis patterns used in production systems.

### Installation & Setup

```bash
pip install redis
```

### 1. Session Management

**Definition:** Session management stores user authentication and state data in Redis, allowing fast access across multiple servers without database queries.

**Purpose:**

- Maintain user login state across distributed applications
- Enable horizontal scaling without sticky sessions
- Provide fast session lookups (sub-millisecond)
- Automatic session expiration for security
- Share sessions across microservices

**Implementation:**

```python
import redis
import json
import uuid
from datetime import datetime
from typing import Optional

class SessionManager:
    def __init__(self, host='localhost', port=6379, db=0):
        """Initialize Redis connection with production settings"""
        self.client = redis.Redis(
            host=host,
            port=port,
            db=db,
            decode_responses=True,
            socket_keepalive=True,
            socket_connect_timeout=5,
            retry_on_timeout=True
        )

    def create_session(self, user_id: str, data: dict, ttl: int = 3600) -> str:
        """
        Create user session with auto-expiration

        Args:
            user_id: Unique user identifier
            data: Session data dictionary
            ttl: Time to live in seconds (default 1 hour)

        Returns:
            session_id: Generated session identifier
        """
        session_id = str(uuid.uuid4())
        key = f"session:{session_id}"

        data['user_id'] = user_id
        data['created_at'] = datetime.now().isoformat()
        data['last_accessed'] = datetime.now().isoformat()

        self.client.setex(key, ttl, json.dumps(data))
        return session_id

    def get_session(self, session_id: str) -> Optional[dict]:
        """
        Retrieve and refresh session data

        Args:
            session_id: Session identifier

        Returns:
            Session data dictionary or None if not found
        """
        key = f"session:{session_id}"
        data = self.client.get(key)

        if data:
            session_data = json.loads(data)
            # Update last accessed time
            session_data['last_accessed'] = datetime.now().isoformat()
            # Refresh TTL
            ttl = self.client.ttl(key)
            if ttl > 0:
                self.client.setex(key, ttl, json.dumps(session_data))
            return session_data

        return None

    def update_session(self, session_id: str, data: dict) -> bool:
        """Update session data while preserving TTL"""
        key = f"session:{session_id}"
        existing = self.get_session(session_id)

        if existing:
            existing.update(data)
            ttl = self.client.ttl(key)
            self.client.setex(key, ttl, json.dumps(existing))
            return True

        return False

    def delete_session(self, session_id: str):
        """Delete session (logout)"""
        self.client.delete(f"session:{session_id}")

    def extend_session(self, session_id: str, additional_ttl: int = 3600):
        """Extend session expiration time"""
        key = f"session:{session_id}"
        current_ttl = self.client.ttl(key)
        if current_ttl > 0:
            self.client.expire(key, current_ttl + additional_ttl)

# Usage Example
sm = SessionManager()

# Login - create session
session_id = sm.create_session(
    user_id='user123',
    data={'name': 'John Doe', 'role': 'admin', 'permissions': ['read', 'write']},
    ttl=7200  # 2 hours
)

# Check authentication
session_data = sm.get_session(session_id)
if session_data:
    print(f"Authenticated as {session_data['name']}")

# Update session
sm.update_session(session_id, {'last_page': '/dashboard'})

# Logout
sm.delete_session(session_id)
```

**Advanced Tips:**

- Implement session fixation protection by regenerating session IDs after login
- Store minimal data in sessions - reference user ID and fetch details from cache
- Use Redis keyspace notifications to track session expirations
- Implement "Remember Me" with separate long-lived tokens

---

### 2. Caching Layer

**Definition:** A caching layer stores frequently accessed data in memory to reduce database load and improve response times by orders of magnitude.

**Purpose:**

- Reduce database query load by 70-90%
- Dramatically improve API response times (from seconds to milliseconds)
- Lower infrastructure costs by reducing database reads
- Handle traffic spikes without overwhelming backend systems
- Cache expensive computations and API responses
- Implement cache invalidation strategies

**Implementation:**

```python
import redis
import json
import hashlib
from functools import wraps
from typing import Any, Optional, Callable

class CacheManager:
    def __init__(self, host='localhost', port=6379, db=0):
        self.client = redis.Redis(
            host=host,
            port=port,
            db=db,
            decode_responses=True
        )

    def generate_key(self, prefix: str, *args, **kwargs) -> str:
        """
        Generate deterministic cache key from function arguments

        Args:
            prefix: Key prefix (usually function name)
            args: Positional arguments
            kwargs: Keyword arguments

        Returns:
            Cache key string
        """
        data = json.dumps({
            'args': args,
            'kwargs': kwargs
        }, sort_keys=True)
        hash_key = hashlib.md5(data.encode()).hexdigest()
        return f"cache:{prefix}:{hash_key}"

    def get(self, key: str) -> Optional[Any]:
        """Get cached value"""
        data = self.client.get(key)
        return json.loads(data) if data else None

    def set(self, key: str, value: Any, ttl: int = 300):
        """
        Set cache with TTL

        Args:
            key: Cache key
            value: Value to cache (must be JSON serializable)
            ttl: Time to live in seconds (default 5 minutes)
        """
        self.client.setex(key, ttl, json.dumps(value))

    def delete(self, key: str):
        """Delete cache entry"""
        self.client.delete(key)

    def delete_pattern(self, pattern: str):
        """
        Delete all keys matching pattern

        WARNING: Use with caution in production
        """
        for key in self.client.scan_iter(match=pattern):
            self.client.delete(key)

    def get_or_set(self, key: str, factory: Callable, ttl: int = 300) -> Any:
        """
        Get from cache or compute and cache the result

        Args:
            key: Cache key
            factory: Function to call if cache miss
            ttl: Cache TTL

        Returns:
            Cached or computed value
        """
        value = self.get(key)
        if value is None:
            value = factory()
            self.set(key, value, ttl)
        return value

def cached(prefix: str, ttl: int = 300, key_builder: Optional[Callable] = None):
    """
    Decorator for caching function results

    Args:
        prefix: Cache key prefix
        ttl: Time to live in seconds
        key_builder: Custom function to build cache key

    Usage:
        @cached('user_profile', ttl=600)
        def get_user_profile(user_id):
            return expensive_db_query(user_id)
    """
    def decorator(func: Callable) -> Callable:
        cache = CacheManager()

        @wraps(func)
        def wrapper(*args, **kwargs):
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                cache_key = cache.generate_key(prefix, *args, **kwargs)

            result = cache.get(cache_key)

            if result is None:
                result = func(*args, **kwargs)
                if result is not None:  # Don't cache None values
                    cache.set(cache_key, result, ttl)

            return result

        # Add cache control methods to function
        wrapper.cache = cache
        wrapper.invalidate = lambda *args, **kwargs: cache.delete(
            cache.generate_key(prefix, *args, **kwargs)
        )
        wrapper.invalidate_all = lambda: cache.delete_pattern(f"cache:{prefix}:*")

        return wrapper
    return decorator

# Usage Examples

# Example 1: Simple decorator usage
@cached('user_profile', ttl=600)
def get_user_profile(user_id: int) -> dict:
    """Expensive database query"""
    print(f"Cache miss - fetching user {user_id} from database")
    # Simulate expensive operation
    import time
    time.sleep(1)
    return {
        'id': user_id,
        'name': 'John Doe',
        'email': 'john@example.com'
    }

# First call - cache miss
profile = get_user_profile(123)  # Takes 1 second

# Second call - cache hit
profile = get_user_profile(123)  # Returns instantly

# Invalidate specific cache
get_user_profile.invalidate(123)

# Invalidate all user profiles
get_user_profile.invalidate_all()


# Example 2: Custom key builder
def build_search_key(query: str, filters: dict):
    return f"search:{query}:{json.dumps(filters, sort_keys=True)}"

@cached('search_results', ttl=300, key_builder=build_search_key)
def search_products(query: str, filters: dict) -> list:
    """Search with complex filters"""
    print(f"Searching for: {query} with filters: {filters}")
    # Expensive search operation
    return [{'id': 1, 'name': 'Product 1'}]


# Example 3: Manual cache control
cache = CacheManager()

def get_dashboard_data(user_id: int) -> dict:
    """Get or compute dashboard data"""
    return cache.get_or_set(
        key=f"dashboard:{user_id}",
        factory=lambda: compute_expensive_dashboard(user_id),
        ttl=600
    )

def compute_expensive_dashboard(user_id: int) -> dict:
    """Expensive computation"""
    return {
        'total_sales': 15000,
        'orders': 42,
        'revenue': 125000
    }
```

**Cache Invalidation Strategies:**

1. **Time-based (TTL):** Simplest approach, cache expires after fixed time
2. **Write-through:** Update cache when database is updated
3. **Write-behind:** Update database asynchronously, cache first
4. **Cache-aside:** Application checks cache, loads from DB on miss
5. **Event-based:** Invalidate cache when specific events occur

**Advanced Tips:**

- Use shorter TTLs for frequently changing data (1-5 minutes)
- Use longer TTLs for stable data (1-24 hours)
- Implement cache warming for critical pages during deployment
- Use cache stampede protection for high-traffic keys
- Monitor cache hit ratio - aim for 80%+ hit rate
- Consider using Redis Hash for caching related items together

---

### 3. Rate Limiter

**Definition:** Rate limiting controls how many requests a user or service can make within a time window, preventing abuse and ensuring fair resource usage.

**Purpose:**

- Protect APIs from abuse and DDoS attacks
- Ensure fair usage across all users
- Prevent service degradation during traffic spikes
- Implement tiered access (free vs paid users)
- Comply with third-party API rate limits
- Reduce costs from excessive API calls
- Maintain system stability under load

**Implementation:**

```python
import redis
import time
from typing import Tuple

class RateLimiter:
    def __init__(self, host='localhost', port=6379, db=0):
        self.client = redis.Redis(host=host, port=port, db=db)

    def is_allowed(
        self,
        identifier: str,
        max_requests: int = 100,
        window: int = 60
    ) -> bool:
        """
        Sliding window rate limiter

        Args:
            identifier: Unique identifier (user_id, ip_address, api_key)
            max_requests: Maximum requests allowed
            window: Time window in seconds

        Returns:
            True if request is allowed, False if rate limited
        """
        key = f"rate_limit:{identifier}"
        now = time.time()
        window_start = now - window

        # Use pipeline for atomic operations
        pipe = self.client.pipeline()

        # Remove old entries outside the window
        pipe.zremrangebyscore(key, 0, window_start)

        # Count current requests in window
        pipe.zcard(key)

        # Add current request
        pipe.zadd(key, {str(now): now})

        # Set expiration
        pipe.expire(key, window)

        results = pipe.execute()
        current_requests = results[1]

        return current_requests < max_requests

    def get_remaining(
        self,
        identifier: str,
        max_requests: int = 100,
        window: int = 60
    ) -> Tuple[int, int]:
        """
        Get remaining requests and reset time

        Returns:
            (remaining_requests, seconds_until_reset)
        """
        key = f"rate_limit:{identifier}"
        now = time.time()
        window_start = now - window

        # Clean old entries
        self.client.zremrangebyscore(key, 0, window_start)

        # Get current count
        current = self.client.zcard(key)
        remaining = max(0, max_requests - current)

        # Get oldest request in window
        oldest = self.client.zrange(key, 0, 0, withscores=True)
        if oldest:
            reset_time = int(window - (now - oldest[0][1]))
        else:
            reset_time = window

        return remaining, reset_time

    def reset(self, identifier: str):
        """Reset rate limit for identifier"""
        self.client.delete(f"rate_limit:{identifier}")

class AdvancedRateLimiter:
    """Token bucket rate limiter for more flexible rate limiting"""

    def __init__(self, host='localhost', port=6379, db=0):
        self.client = redis.Redis(host=host, port=port, db=db)

    def is_allowed(
        self,
        identifier: str,
        tokens: int = 100,
        refill_rate: int = 10,
        refill_interval: int = 1
    ) -> bool:
        """
        Token bucket algorithm

        Args:
            identifier: Unique identifier
            tokens: Maximum tokens (burst capacity)
            refill_rate: Tokens added per interval
            refill_interval: Refill interval in seconds

        Returns:
            True if request allowed
        """
        key = f"token_bucket:{identifier}"
        now = time.time()

        # Lua script for atomic token bucket
        lua_script = """
        local key = KEYS[1]
        local max_tokens = tonumber(ARGV[1])
        local refill_rate = tonumber(ARGV[2])
        local refill_interval = tonumber(ARGV[3])
        local now = tonumber(ARGV[4])

        local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1]) or max_tokens
        local last_refill = tonumber(bucket[2]) or now

        -- Calculate tokens to add
        local time_passed = now - last_refill
        local tokens_to_add = math.floor(time_passed / refill_interval) * refill_rate
        tokens = math.min(tokens + tokens_to_add, max_tokens)

        -- Try to consume token
        if tokens >= 1 then
            tokens = tokens - 1
            redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
            redis.call('EXPIRE', key, 3600)
            return 1
        else
            return 0
        end
        """

        result = self.client.eval(
            lua_script,
            1,
            key,
            tokens,
            refill_rate,
            refill_interval,
            now
        )

        return result == 1

# Usage Examples

# Example 1: API endpoint protection
limiter = RateLimiter()

def api_endpoint(user_id: str):
    """Protected API endpoint"""
    if not limiter.is_allowed(user_id, max_requests=100, window=60):
        remaining, reset = limiter.get_remaining(user_id, 100, 60)
        return {
            'error': 'Rate limit exceeded',
            'retry_after': reset
        }, 429

    # Process request
    return {'success': True, 'data': 'response'}, 200


# Example 2: Tiered rate limiting
def tiered_api_endpoint(user_id: str, tier: str):
    """Different limits based on user tier"""
    limits = {
        'free': (10, 60),      # 10 requests per minute
        'basic': (100, 60),     # 100 requests per minute
        'premium': (1000, 60)   # 1000 requests per minute
    }

    max_requests, window = limits.get(tier, (10, 60))

    if not limiter.is_allowed(f"{user_id}:{tier}", max_requests, window):
        return {'error': 'Rate limit exceeded'}, 429

    return {'success': True}, 200


# Example 3: Decorator for automatic rate limiting
from functools import wraps

def rate_limit(max_requests=100, window=60):
    """Decorator to add rate limiting to any function"""
    def decorator(func):
        limiter = RateLimiter()

        @wraps(func)
        def wrapper(*args, **kwargs):
            # Extract identifier (first argument)
            identifier = str(args[0]) if args else 'anonymous'

            if not limiter.is_allowed(identifier, max_requests, window):
                raise Exception('Rate limit exceeded')

            return func(*args, **kwargs)

        return wrapper
    return decorator

@rate_limit(max_requests=5, window=60)
def send_email(user_id: str, message: str):
    """Send email with rate limiting"""
    print(f"Sending email to {user_id}: {message}")
```

**Rate Limiting Strategies:**

1. **Fixed Window:** Simple counter reset at fixed intervals
2. **Sliding Window:** More accurate, considers request timestamp
3. **Token Bucket:** Allows bursts, refills gradually
4. **Leaky Bucket:** Smooth rate, no bursts allowed

**Advanced Tips:**

- Use different limits for different endpoints (stricter for expensive operations)
- Implement progressive rate limiting (warn before blocking)
- Whitelist trusted IPs or services
- Log rate limit violations for security monitoring
- Return `Retry-After` header in 429 responses
- Consider distributed rate limiting for multi-server setups

---

### 4. Distributed Lock

**Definition:** A distributed lock ensures that only one process can execute a critical section of code at a time across multiple servers, preventing race conditions and data corruption.

**Purpose:**

- Prevent duplicate payment processing
- Ensure only one worker processes a job
- Coordinate inventory updates across servers
- Prevent race conditions in distributed systems
- Implement leader election patterns
- Synchronize file uploads or data imports
- Maintain data consistency in microservices

**Implementation:**

```python
import redis
import uuid
import time
from contextlib import contextmanager
from typing import Optional

class DistributedLock:
    def __init__(self, host='localhost', port=6379, db=0):
        self.client = redis.Redis(host=host, port=port, db=db)

    def acquire(
        self,
        lock_name: str,
        timeout: int = 10,
        blocking_timeout: Optional[int] = None,
        retry_interval: float = 0.1
    ) -> Optional[str]:
        """
        Acquire distributed lock

        Args:
            lock_name: Name of the lock
            timeout: Lock expiration time in seconds
            blocking_timeout: How long to wait for lock (None = try once)
            retry_interval: Time between retry attempts

        Returns:
            Lock identifier if acquired, None if failed
        """
        identifier = str(uuid.uuid4())
        lock_key = f"lock:{lock_name}"

        if blocking_timeout is None:
            # Non-blocking attempt
            if self.client.set(lock_key, identifier, nx=True, ex=timeout):
                return identifier
            return None

        # Blocking attempt with timeout
        end_time = time.time() + blocking_timeout

        while time.time() < end_time:
            if self.client.set(lock_key, identifier, nx=True, ex=timeout):
                return identifier
            time.sleep(retry_interval)

        return None

    def release(self, lock_name: str, identifier: str) -> bool:
        """
        Release distributed lock safely

        Args:
            lock_name: Name of the lock
            identifier: Lock identifier from acquire()

        Returns:
            True if released, False if lock was already released or expired
        """
        lock_key = f"lock:{lock_name}"

        # Lua script ensures atomic check-and-delete
        lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """

        result = self.client.eval(lua_script, 1, lock_key, identifier)
        return result == 1

    def extend(self, lock_name: str, identifier: str, timeout: int = 10) -> bool:
        """
        Extend lock expiration time

        Args:
            lock_name: Name of the lock
            identifier: Lock identifier
            timeout: Additional time in seconds

        Returns:
            True if extended, False if lock doesn't exist or wrong identifier
        """
        lock_key = f"lock:{lock_name}"

        lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("expire", KEYS[1], ARGV[2])
        else
            return 0
        end
        """

        result = self.client.eval(lua_script, 1, lock_key, identifier, timeout)
        return result == 1

# Context manager for automatic lock cleanup
@contextmanager
def distributed_lock(lock_name: str, timeout: int = 10, blocking_timeout: int = 5):
    """
    Context manager for distributed locks

    Usage:
        with distributed_lock('payment:order_123', timeout=30):
            # Critical section
            process_payment()
    """
    lock = DistributedLock()
    identifier = lock.acquire(lock_name, timeout, blocking_timeout)

    if identifier is None:
        raise Exception(f"Could not acquire lock: {lock_name}")

    try:
        yield lock, identifier
    finally:
        lock.release(lock_name, identifier)

# Usage Examples

# Example 1: Prevent duplicate payment processing
def process_payment(order_id: str, amount: float):
    """Process payment with lock to prevent double-charging"""
    lock_name = f"payment:{order_id}"

    with distributed_lock(lock_name, timeout=30, blocking_timeout=5):
        # Only one server can execute this
        print(f"Processing payment for order {order_id}")

        # Check if already processed
        if is_payment_processed(order_id):
            print("Payment already processed")
            return

        # Process payment
        charge_credit_card(amount)
        mark_payment_as_processed(order_id)

        print("Payment completed successfully")

# Example 2: Ensure single cron job execution
def daily_report_job():
    """Ensure only one server runs the daily report"""
    lock = DistributedLock()
    identifier = lock.acquire('daily_report', timeout=3600, blocking_timeout=0)

    if identifier is None:
        print("Another server is already running the report")
        return

    try:
        print("Generating daily report...")
        generate_report()
        print("Report completed")
    finally:
        lock.release('daily_report', identifier)

# Example 3: Inventory update coordination
def update_inventory(product_id: str, quantity_change: int):
    """Update inventory across distributed system"""
    with distributed_lock(f"inventory:{product_id}", timeout=5):
        current = get_inventory(product_id)
        new_quantity = current + quantity_change

        if new_quantity < 0:
            raise Exception("Insufficient inventory")

        set_inventory(product_id, new_quantity)

# Stub functions for examples
def is_payment_processed(order_id): return False
def charge_credit_card(amount): pass
def mark_payment_as_processed(order_id): pass
def generate_report(): pass
def get_inventory(product_id): return 100
def set_inventory(product_id, quantity): pass
```

**Advanced Lock Patterns:**

1. **Redlock Algorithm:** For stronger consistency across Redis clusters
2. **Fencing Tokens:** Use incrementing counters to detect stale locks
3. **Lock Renewal:** Extend lock for long-running operations
4. **Fair Locks:** Queue-based locks for FIFO ordering

**Common Pitfalls:**

- Never use locks without timeouts (can deadlock)
- Always release locks in finally blocks
- Use unique identifiers to prevent releasing others' locks
- Consider network delays when setting timeouts
- Monitor lock contention and adjust timeout values

---

### 5. Gaming Leaderboard

**Definition:** A leaderboard system ranks players by score in real-time using Redis sorted sets, providing instant updates and queries for competitive gaming features.

**Purpose:**

- Display real-time rankings for competitive games
- Enable social features (comparing with friends)
- Motivate user engagement through competition
- Support seasonal/tournament leaderboards
- Provide instant score updates without database lag
- Scale to millions of players efficiently
- Power achievement and reward systems

**Implementation:**

```python
import redis
from typing import List, Tuple, Optional

class Leaderboard:
    def __init__(self, host='localhost', port=6379, db=0):
        self.client = redis.Redis(
            host=host,
            port=port,
            db=db,
            decode_responses=True
        )

    def add_score(self, leaderboard: str, player: str, score: float):
        """
        Add or update player score

        Args:
            leaderboard: Leaderboard name (e.g., 'global', 'weekly')
            player: Player identifier
            score: Player score
        """
        key = f"leaderboard:{leaderboard}"
        self.client.zadd(key, {player: score})

    def increment_score(self, leaderboard: str, player: str, amount: float):
        """
        Increment player score atomically

        Args:
            leaderboard: Leaderboard name
            player: Player identifier
            amount: Score increment (can be negative)
        """
        key = f"leaderboard:{leaderboard}"
        self.client.zincrby(key, amount, player)

    def get_top(self, leaderboard: str, count: int = 10) -> List[Tuple[str, float]]:
        """
        Get top N players

        Args:
            leaderboard: Leaderboard name
            count: Number of top players to retrieve

        Returns:
            List of (player, score) tuples
        """
        key = f"leaderboard:{leaderboard}"
        return self.client.zrevrange(key, 0, count - 1, withscores=True)

    def get_bottom(self, leaderboard: str, count: int = 10) -> List[Tuple[str, float]]:
        """Get bottom N players"""
        key = f"leaderboard:{leaderboard}"
        return self.client.zrange(key, 0, count - 1, withscores=True)

    def get_rank(self, leaderboard: str, player: str) -> Optional[int]:
        """
        Get player rank (1-based)

        Returns:
            Player rank or None if player not found
        """
        key = f"leaderboard:{leaderboard}"
        rank = self.client.zrevrank(key, player)
        return rank + 1 if rank is not None else None

    def get_score(self, leaderboard: str, player: str) -> Optional[float]:
        """Get player score"""
        key = f"leaderboard:{leaderboard}"
        return self.client.zscore(key, player)

    def get_around_player(
        self,
        leaderboard: str,
        player: str,
        range_size: int = 5
    ) -> List[Tuple[str, float]]:
        """
        Get players around a specific player

        Args:
            leaderboard: Leaderboard name
            player: Player identifier
            range_size: Number of players above and below

        Returns:
            List of (player, score) tuples centered on player
        """
        key = f"leaderboard:{leaderboard}"
        rank = self.client.zrevrank(key, player)

        if rank is None:
            return []

        start = max(0, rank - range_size)
        end = rank + range_size

        return self.client.zrevrange(key, start, end, withscores=True)

    def get_rank_range(
        self,
        leaderboard: str,
        start_rank: int,
        end_rank: int
    ) -> List[Tuple[str, float]]:
        """
        Get players in rank range

        Args:
            start_rank: Starting rank (1-based)
            end_rank: Ending rank (1-based, inclusive)
        """
        key = f"leaderboard:{leaderboard}"
        # Convert to 0-based indices
        return self.client.zrevrange(
            key,
            start_rank - 1,
            end_rank - 1,
            withscores=True
        )

    def get_score_range(
        self,
        leaderboard: str,
        min_score: float,
        max_score: float
    ) -> List[Tuple[str, float]]:
        """Get players within score range"""
        key = f"leaderboard:{leaderboard}"
        return self.client.zrangebyscore(
            key,
            min_score,
            max_score,
            withscores=True
        )

    def remove_player(self, leaderboard: str, player: str):
        """Remove player from leaderboard"""
        key = f"leaderboard:{leaderboard}"
        self.client.zrem(key, player)

    def get_total_players(self, leaderboard: str) -> int:
        """Get total number of players"""
        key = f"leaderboard:{leaderboard}"
        return self.client.zcard(key)

    def get_percentile(self, leaderboard: str, player: str) -> Optional[float]:
        """
        Get player percentile (0-100)

        Returns:
            Percentile ranking (higher is better)
        """
        key = f"leaderboard:{leaderboard}"
        rank = self.client.zrevrank(key, player)
        total = self.client.zcard(key)

        if rank is None or total == 0:
            return None

        percentile = ((total - rank - 1) / total) * 100
        return round(percentile, 2)

# Advanced Leaderboard with Time-based Features
class AdvancedLeaderboard(Leaderboard):
    """Leaderboard with seasonal and historical features"""

    def add_score_with_metadata(
        self,
        leaderboard: str,
        player: str,
        score: float,
        metadata: dict
    ):
        """Add score and store metadata separately"""
        # Add to leaderboard
        self.add_score(leaderboard, player, score)

        # Store metadata
        meta_key = f"leaderboard:{leaderboard}:meta:{player}"
        self.client.hmset(meta_key, metadata)
        self.client.expire(meta_key, 86400 * 30)  # 30 days

    def get_player_details(self, leaderboard: str, player: str) -> dict:
        """Get player score, rank, and metadata"""
        score = self.get_score(leaderboard, player)
        rank = self.get_rank(leaderboard, player)
        percentile = self.get_percentile(leaderboard, player)

        meta_key = f"leaderboard:{leaderboard}:meta:{player}"
        metadata = self.client.hgetall(meta_key)

        return {
            'player': player,
            'score': score,
            'rank': rank,
            'percentile': percentile,
            'metadata': metadata
        }

    def archive_leaderboard(self, leaderboard: str, archive_name: str):
        """Archive current leaderboard (e.g., end of season)"""
        source = f"leaderboard:{leaderboard}"
        dest = f"leaderboard:{archive_name}"

        # Copy to archive
        for player, score in self.client.zrangebyscore(
            source, '-inf', '+inf', withscores=True
        ):
            self.client.zadd(dest, {player: score})

        # Set expiration on archive (1 year)
        self.client.expire(dest, 86400 * 365)

    def reset_leaderboard(self, leaderboard: str):
        """Reset leaderboard (new season)"""
        key = f"leaderboard:{leaderboard}"
        self.client.delete(key)

# Usage Examples

lb = Leaderboard()

# Example 1: Basic leaderboard operations
lb.add_score('global', 'player1', 1500)
lb.add_score('global', 'player2', 2000)
lb.add_score('global', 'player3', 1750)

# Increment score (player earned 50 points)
lb.increment_score('global', 'player1', 50)

# Get top 10 players
top_players = lb.get_top('global', 10)
for i, (player, score) in enumerate(top_players, 1):
    print(f"{i}. {player}: {score}")

# Get player's rank and score
rank = lb.get_rank('global', 'player1')
score = lb.get_score('global', 'player1')
print(f"Player1 is rank #{rank} with {score} points")

# Get players around player1
nearby = lb.get_around_player('global', 'player1', range_size=3)
print("Players near player1:", nearby)


# Example 2: Weekly leaderboard with reset
import time
from datetime import datetime, timedelta

def get_weekly_leaderboard_name():
    """Generate weekly leaderboard name"""
    # ISO week format: 2025-W01
    return f"weekly:{datetime.now().strftime('%Y-W%W')}"

def update_weekly_score(player: str, score: float):
    """Update both global and weekly leaderboards"""
    lb.add_score('global', player, score)
    weekly_board = get_weekly_leaderboard_name()
    lb.add_score(weekly_board, player, score)


# Example 3: Friends leaderboard
def get_friends_leaderboard(player: str, friends: List[str]) -> List[Tuple[str, float]]:
    """Get leaderboard filtered to friends only"""
    scores = []
    for friend in [player] + friends:
        score = lb.get_score('global', friend)
        if score is not None:
            scores.append((friend, score))

    # Sort by score descending
    return sorted(scores, key=lambda x: x[1], reverse=True)


# Example 4: Achievement system based on rank
def check_rank_achievements(player: str):
    """Award achievements based on rank"""
    rank = lb.get_rank('global', player)

    if rank == 1:
        award_achievement(player, 'Champion')
    elif rank <= 10:
        award_achievement(player, 'Top 10')
    elif rank <= 100:
        award_achievement(player, 'Top 100')

    percentile = lb.get_percentile('global', player)
    if percentile >= 99:
        award_achievement(player, 'Top 1%')

def award_achievement(player: str, achievement: str):
    print(f"🏆 {player} earned: {achievement}")


# Example 5: Real-time leaderboard updates with pub/sub
def broadcast_rank_change(player: str, old_rank: int, new_rank: int):
    """Notify clients of rank changes"""
    message = {
        'player': player,
        'old_rank': old_rank,
        'new_rank': new_rank,
        'timestamp': time.time()
    }
    # Publish to Redis pub/sub
    lb.client.publish('leaderboard:updates', str(message))
```

**Leaderboard Patterns:**

1. **Global Leaderboard:** All-time rankings
2. **Seasonal Leaderboard:** Weekly/monthly with resets
3. **Friends Leaderboard:** Filtered to social connections
4. **Regional Leaderboard:** Geo-based rankings
5. **Multiple Leaderboards:** Different game modes/categories

**Advanced Tips:**

- Use time-based leaderboard names for automatic rotation
- Archive old leaderboards instead of deleting
- Implement rank-based rewards (top 10, top 100, etc.)
- Use ZUNIONSTORE for combining multiple leaderboards
- Cache frequently accessed ranges (top 100)
- Consider storing additional metadata in hashes
- Implement anti-cheat by monitoring suspicious score jumps

---

### 6. Shopping Cart (Hash)

**Definition:** A shopping cart stores user's selected items using Redis hashes, providing fast access and updates without database writes for every cart modification.

**Purpose:**

- Provide instant cart updates without page refresh
- Persist carts across sessions and devices
- Reduce database load from frequent cart changes
- Support guest checkout (cart before login)
- Enable cart recovery for abandoned checkouts
- Scale during high-traffic sales events
- Store temporary data with automatic expiration

**Implementation:**

```python
import redis
import json
from typing import Dict, Optional
from decimal import Decimal

class ShoppingCart:
    def __init__(self, host='localhost', port=6379, db=0):
        self.client = redis.Redis(
            host=host,
            port=port,
            db=db,
            decode_responses=True
        )

    def add_item(
        self,
        user_id: str,
        product_id: str,
        quantity: int,
        product_data: dict
    ):
        """
        Add item to cart

        Args:
            user_id: User identifier (or session ID for guests)
            product_id: Product identifier
            quantity: Quantity to add
            product_data: Product details (name, price, etc.)
        """
        cart_key = f"cart:{user_id}"

        # Get existing item if any
        existing = self.client.hget(cart_key, product_id)

        if existing:
            item_data = json.loads(existing)
            item_data['quantity'] += quantity
        else:
            item_data = {
                'quantity': quantity,
                'product': product_data,
                'added_at': int(time.time())
            }

        self.client.hset(cart_key, product_id, json.dumps(item_data))

        # Set 7-day expiration
        self.client.expire(cart_key, 86400 * 7)

    def remove_item(self, user_id: str, product_id: str):
        """Remove item from cart"""
        cart_key = f"cart:{user_id}"
        self.client.hdel(cart_key, product_id)

    def update_quantity(self, user_id: str, product_id: str, quantity: int):
        """
        Update item quantity

        Args:
            quantity: New quantity (0 to remove item)
        """
        if quantity <= 0:
            self.remove_item(user_id, product_id)
            return

        cart_key = f"cart:{user_id}"
        item_data = self.client.hget(cart_key, product_id)

        if item_data:
            data = json.loads(item_data)
            data['quantity'] = quantity
            self.client.hset(cart_key, product_id, json.dumps(data))

    def get_cart(self, user_id: str) -> Dict[str, dict]:
        """
        Get all cart items

        Returns:
            Dictionary of {product_id: item_data}
        """
        cart_key = f"cart:{user_id}"
        cart = self.client.hgetall(cart_key)
        return {k: json.loads(v) for k, v in cart.items()}

    def get_item(self, user_id: str, product_id: str) -> Optional[dict]:
        """Get specific cart item"""
        cart_key = f"cart:{user_id}"
        item_data = self.client.hget(cart_key, product_id)
        return json.loads(item_data) if item_data else None

    def get_item_count(self, user_id: str) -> int:
        """Get total number of unique items"""
        cart_key = f"cart:{user_id}"
        return self.client.hlen(cart_key)

    def get_total_quantity(self, user_id: str) -> int:
        """Get total quantity of all items"""
        cart = self.get_cart(user_id)
        return sum(item['quantity'] for item in cart.values())

    def get_total_price(self, user_id: str) -> float:
        """Calculate cart total price"""
        cart = self.get_cart(user_id)
        total = sum(
            item['quantity'] * item['product']['price']
            for item in cart.values()
        )
        return round(total, 2)

    def clear_cart(self, user_id: str):
        """Clear entire cart"""
        self.client.delete(f"cart:{user_id}")

    def merge_carts(self, guest_id: str, user_id: str):
        """
        Merge guest cart into user cart after login

        Args:
            guest_id: Guest session ID
            user_id: Logged-in user ID
        """
        guest_cart = self.get_cart(guest_id)

        for product_id, item_data in guest_cart.items():
            # Check if item exists in user cart
            existing = self.get_item(user_id, product_id)

            if existing:
                # Combine quantities
                new_quantity = existing['quantity'] + item_data['quantity']
                self.update_quantity(user_id, product_id, new_quantity)
            else:
                # Add to user cart
                self.add_item(
                    user_id,
                    product_id,
                    item_data['quantity'],
                    item_data['product']
                )

        # Clear guest cart
        self.clear_cart(guest_id)

    def apply_coupon(self, user_id: str, coupon_code: str, discount: float):
        """Store applied coupon in cart"""
        cart_key = f"cart:{user_id}"
        self.client.hset(cart_key, '_coupon', json.dumps({
            'code': coupon_code,
            'discount': discount
        }))

    def get_cart_summary(self, user_id: str) -> dict:
        """
        Get complete cart summary

        Returns:
            Dictionary with items, totals, and coupon info
        """
        cart = self.get_cart(user_id)

        # Separate coupon from items
        coupon = cart.pop('_coupon', None)

        subtotal = sum(
            item['quantity'] * item['product']['price']
            for item in cart.values()
        )

        discount = 0
        if coupon:
            coupon_data = json.loads(coupon) if isinstance(coupon, str) else coupon
            discount = subtotal * coupon_data['discount']

        return {
            'items': cart,
            'item_count': len(cart),
            'total_quantity': sum(item['quantity'] for item in cart.values()),
            'subtotal': round(subtotal, 2),
            'discount': round(discount, 2),
            'total': round(subtotal - discount, 2),
            'coupon': json.loads(coupon) if coupon else None
        }

# Usage Examples

cart = ShoppingCart()

# Example 1: Add items to cart
cart.add_item(
    user_id='user123',
    product_id='prod_laptop_001',
    quantity=1,
    product_data={
        'name': 'Gaming Laptop',
        'price': 1299.99,
        'sku': 'LAPTOP-001',
        'image': 'laptop.jpg'
    }
)

cart.add_item(
    user_id='user123',
    product_id='prod_mouse_001',
    quantity=2,
    product_data={
        'name': 'Wireless Mouse',
        'price': 29.99,
        'sku': 'MOUSE-001'
    }
)

# Example 2: Update quantity
cart.update_quantity('user123', 'prod_mouse_001', 3)

# Example 3: Get cart summary
summary = cart.get_cart_summary('user123')
print(f"Cart Total: ${summary['total']}")
print(f"Items: {summary['item_count']}")

# Example 4: Apply coupon
cart.apply_coupon('user123', 'SAVE20', 0.20)  # 20% off
summary = cart.get_cart_summary('user123')
print(f"After discount: ${summary['total']}")

# Example 5: Merge guest cart after login
# User browses as guest
cart.add_item('guest_abc123', 'prod_keyboard_001', 1, {
    'name': 'Mechanical Keyboard',
    'price': 89.99
})

# User logs in
cart.merge_carts(guest_id='guest_abc123', user_id='user123')

# Example 6: Abandoned cart recovery
def get_abandoned_carts(hours_threshold: int = 24) -> List[str]:
    """Find carts abandoned for X hours"""
    abandoned = []

    # Scan for cart keys
    for key in cart.client.scan_iter(match='cart:*'):
        ttl = cart.client.ttl(key)
        # Calculate how long ago cart was last modified
        max_ttl = 86400 * 7  # 7 days
        age_hours = (max_ttl - ttl) / 3600

        if age_hours >= hours_threshold:
            user_id = key.decode().split(':')[1]
            abandoned.append(user_id)

    return abandoned

# Send recovery emails
for user_id in get_abandoned_carts(hours_threshold=24):
    summary = cart.get_cart_summary(user_id)
    if summary['item_count'] > 0:
        send_cart_recovery_email(user_id, summary)

def send_cart_recovery_email(user_id, summary):
    print(f"Sending recovery email to {user_id}")
    print(f"Cart value: ${summary['total']}")
```

**Shopping Cart Best Practices:**

1. **Guest Carts:** Use session IDs for anonymous users
2. **Cart Expiration:** Set reasonable TTL (7-30 days)
3. **Price Validation:** Always validate prices server-side before checkout
4. **Inventory Checks:** Verify stock availability at checkout
5. **Cart Recovery:** Track abandoned carts for marketing
6. **Multi-device:** Sync carts across devices using user ID

**Advanced Tips:**

- Store cart metadata (coupon, shipping method) in same hash
- Implement cart versioning for price changes
- Use pub/sub to sync cart updates in real-time
- Add cart analytics (most added/removed items)
- Implement "Save for Later" feature with separate hash
- Track cart value for sales funnel analysis

---

### 7. Message Queue (List)

**Definition:** A message queue enables asynchronous task processing by storing jobs in Redis lists, allowing workers to process tasks independently without blocking the main application.

**Purpose:**

- Offload slow operations (email sending, image processing)
- Decouple services for better scalability
- Handle background jobs without blocking users
- Ensure tasks are processed even if servers restart
- Enable retry logic for failed tasks
- Distribute work across multiple workers
- Implement priority queues for urgent tasks

**Implementation:**

```python
import redis
import json
import time
from typing import Optional, Callable
from enum import Enum
import threading

class Priority(Enum):
    LOW = 'low'
    NORMAL = 'normal'
    HIGH = 'high'
    CRITICAL = 'critical'

class MessageQueue:
    def __init__(self, host='localhost', port=6379, db=0):
        self.client = redis.Redis(
            host=host,
            port=port,
            db=db,
            decode_responses=True
        )

    def enqueue(self, queue_name: str, message: dict, priority: Priority = Priority.NORMAL):
        """
        Add message to queue

        Args:
            queue_name: Queue identifier
            message: Message data (must be JSON serializable)
            priority: Message priority
        """
        queue_key = f"queue:{queue_name}:{priority.value}"

        # Add metadata
        message['_enqueued_at'] = time.time()
        message['_priority'] = priority.value

        self.client.rpush(queue_key, json.dumps(message))

    def dequeue(
        self,
        queue_name: str,
        timeout: int = 0,
        priorities: Optional[List[Priority]] = None
    ) -> Optional[dict]:
        """
        Remove and return message from queue

        Args:
            queue_name: Queue identifier
            timeout: Blocking timeout in seconds (0 = non-blocking)
            priorities: List of priorities to check (in order)

        Returns:
            Message dict or None if queue empty
        """
        if priorities is None:
            priorities = [Priority.CRITICAL, Priority.HIGH, Priority.NORMAL, Priority.LOW]

        queue_keys = [f"queue:{queue_name}:{p.value}" for p in priorities]

        if timeout > 0:
            result = self.client.blpop(queue_keys, timeout)
            if result:
                return json.loads(result[1])
        else:
            for key in queue_keys:
                result = self.client.lpop(key)
                if result:
                    return json.loads(result)

        return None

    def size(self, queue_name: str, priority: Optional[Priority] = None) -> int:
        """Get queue size"""
        if priority:
            return self.client.llen(f"queue:{queue_name}:{priority.value}")

        # Total across all priorities
        total = 0
        for p in Priority:
            total += self.client.llen(f"queue:{queue_name}:{p.value}")
        return total

    def peek(self, queue_name: str, count: int = 1, priority: Priority = Priority.NORMAL) -> list:
        """View messages without removing"""
        queue_key = f"queue:{queue_name}:{priority.value}"
        messages = self.client.lrange(queue_key, 0, count - 1)
        return [json.loads(msg) for msg in messages]

    def clear(self, queue_name: str, priority: Optional[Priority] = None):
        """Clear queue"""
        if priority:
            self.client.delete(f"queue:{queue_name}:{priority.value}")
        else:
            for p in Priority:
                self.client.delete(f"queue:{queue_name}:{p.value}")

class TaskQueue:
    """Advanced task queue with retry and dead letter queue"""

    def __init__(self, host='localhost', port=6379, db=0):
        self.client = redis.Redis(host=host, port=port, db=db, decode_responses=True)
        self.mq = MessageQueue(host, port, db)

    def enqueue_task(
        self,
        queue_name: str,
        task_type: str,
        data: dict,
        priority: Priority = Priority.NORMAL,
        max_retries: int = 3
    ):
        """Enqueue task with retry support"""
        message = {
            'task_type': task_type,
            'data': data,
            'retry_count': 0,
            'max_retries': max_retries,
            'task_id': f"{queue_name}:{int(time.time() * 1000)}"
        }
        self.mq.enqueue(queue_name, message, priority)

    def process_task(self, queue_name: str, task: dict, handler: Callable) -> bool:
        """
        Process task with automatic retry on failure

        Returns:
            True if successful, False if failed
        """
        try:
            handler(task)
            return True
        except Exception as e:
            print(f"Task failed: {e}")

            if task['retry_count'] < task['max_retries']:
                # Retry
                task['retry_count'] += 1
                task['last_error'] = str(e)
                task['retried_at'] = time.time()

                # Exponential backoff
                delay = 2 ** task['retry_count']
                time.sleep(delay)

                self.mq.enqueue(queue_name, task, Priority(task['_priority']))
                print(f"Retrying task (attempt {task['retry_count']})")
            else:
                # Move to dead letter queue
                self.move_to_dlq(queue_name, task, str(e))

            return False

    def move_to_dlq(self, queue_name: str, task: dict, error: str):
        """Move failed task to dead letter queue"""
        dlq_key = f"queue:{queue_name}:dead_letter"
        task['error'] = error
        task['failed_at'] = time.time()
        self.client.rpush(dlq_key, json.dumps(task))
        print(f"Task moved to DLQ: {task['task_id']}")

# Worker Implementation
class Worker:
    """Background worker to process queue tasks"""

    def __init__(self, queue_name: str, handlers: dict):
        self.queue_name = queue_name
        self.handlers = handlers
        self.task_queue = TaskQueue()
        self.running = False

    def start(self):
        """Start worker in separate thread"""
        self.running = True
        thread = threading.Thread(target=self._run)
        thread.daemon = True
        thread.start()
        print(f"Worker started for queue: {self.queue_name}")

    def stop(self):
        """Stop worker gracefully"""
        self.running = False
        print("Worker stopping...")

    def _run(self):
        """Main worker loop"""
        mq = MessageQueue()

        while self.running:
            try:
                # Blocking dequeue with 5 second timeout
                task = mq.dequeue(self.queue_name, timeout=5)

                if task:
                    print(f"Processing task: {task['task_type']}")

                    handler = self.handlers.get(task['task_type'])
                    if handler:
                        self.task_queue.process_task(
                            self.queue_name,
                            task,
                            handler
                        )
                    else:
                        print(f"No handler for task type: {task['task_type']}")

            except Exception as e:
                print(f"Worker error: {e}")
                time.sleep(1)

# Usage Examples

# Example 1: Simple task queue
mq = MessageQueue()

# Producer: Enqueue tasks
mq.enqueue('emails', {
    'to': 'user@example.com',
    'subject': 'Welcome!',
    'body': 'Welcome to our service'
}, priority=Priority.HIGH)

mq.enqueue('image_processing', {
    'image_id': 'img123',
    'operation': 'resize',
    'dimensions': '800x600'
}, priority=Priority.NORMAL)

# Consumer: Process tasks
def email_worker():
    """Worker that processes email queue"""
    mq = MessageQueue()

    while True:
        task = mq.dequeue('emails', timeout=10)

        if task:
            print(f"Sending email to {task['to']}")
            send_email(task['to'], task['subject'], task['body'])
        else:
            print("No tasks, waiting...")

# Example 2: Task handlers with retry
task_queue = TaskQueue()

def send_email_handler(task):
    """Handler for email tasks"""
    data = task['data']
    # Simulate email sending
    if random.random() > 0.7:  # 30% failure rate
        raise Exception("SMTP connection failed")
    print(f"Email sent to {data['to']}")

def process_image_handler(task):
    """Handler for image processing"""
    data = task['data']
    print(f"Processing image {data['image_id']}")
    # Process image...
    time.sleep(2)

# Enqueue with retry support
task_queue.enqueue_task(
    queue_name='processing',
    task_type='send_email',
    data={'to': 'user@example.com', 'subject': 'Hello'},
    priority=Priority.HIGH,
    max_retries=3
)

# Example 3: Multi-threaded workers
handlers = {
    'send_email': send_email_handler,
    'process_image': process_image_handler
}

# Start multiple workers
worker1 = Worker('processing', handlers)
worker2 = Worker('processing', handlers)
worker1.start()
worker2.start()

# Workers run in background
time.sleep(30)
worker1.stop()
worker2.stop()

# Example 4: Priority queue
mq = MessageQueue()

# Critical task - process immediately
mq.enqueue('tasks', {'type': 'system_alert'}, Priority.CRITICAL)

# Normal tasks
for i in range(10):
    mq.enqueue('tasks', {'type': 'regular_task', 'id': i}, Priority.NORMAL)

# Worker automatically processes critical tasks first
task = mq.dequeue('tasks')
print(f"Processing: {task}")  # Will be system_alert

# Example 5: Scheduled tasks with delay
def schedule_task(queue_name: str, task: dict, delay_seconds: int):
    """Schedule task to run after delay"""
    scheduled_key = f"queue:{queue_name}:scheduled"
    execute_at = time.time() + delay_seconds

    mq.client.zadd(scheduled_key, {json.dumps(task): execute_at})

def process_scheduled_tasks(queue_name: str):
    """Move scheduled tasks to main queue when ready"""
    scheduled_key = f"queue:{queue_name}:scheduled"
    now = time.time()

    # Get tasks ready to execute
    ready_tasks = mq.client.zrangebyscore(scheduled_key, 0, now)

    for task_json in ready_tasks:
        task = json.loads(task_json)
        mq.enqueue(queue_name, task)
        mq.client.zrem(scheduled_key, task_json)

# Schedule email for 1 hour from now
schedule_task('emails', {'to': 'user@example.com'}, delay_seconds=3600)

# Stub functions
import random
def send_email(to, subject, body): pass
```

**Message Queue Patterns:**

1. **Worker Pool:** Multiple workers consuming from same queue
2. **Priority Queue:** Different queues for different priorities
3. **Delayed Tasks:** Schedule tasks for future execution
4. **Dead Letter Queue:** Store failed tasks for manual review
5. **Fan-out:** One task creates multiple sub-tasks

**Advanced Tips:**

- Use `BLPOP` instead of polling for better performance
- Implement circuit breakers for failing external services
- Monitor queue depth to detect processing bottlenecks
- Use separate queues for different task types
- Implement task timeouts to prevent stuck workers
- Store task results in Redis for status checking
- Use Redis Streams for more advanced queue features

---

## Performance Optimization

### Memory Optimization

**1. Choose the Right Data Type**

```python
# Bad: Storing 1M user flags as strings
for user_id in range(1000000):
    client.set(f"premium:{user_id}", "1")  # ~50MB

# Good: Using bitmap
for user_id in range(1000000):
    client.setbit("premium_users", user_id, 1)  # ~122KB
```

**2. Use Pipelining for Bulk Operations**

```python
# Bad: Individual commands (slow)
for i in range(1000):
    client.set(f"key:{i}", f"value:{i}")  # 1000 round trips

# Good: Pipelining (fast)
pipe = client.pipeline()
for i in range(1000):
    pipe.set(f"key:{i}", f"value:{i}")
pipe.execute()  # 1 round trip
```

**3. Set Appropriate TTLs**

```python
# Always set expiration on temporary data
client.setex("session:abc123", 3600, session_data)  # 1 hour
client.expire("cache:user:123", 300)  # 5 minutes

# Monitor keys without TTL
no_ttl_keys = [key for key in client.scan_iter() if client.ttl(key) == -1]
```

**4. Compress Large Values**

```python
import gzip
import json

def set_compressed(key, data, ttl=300):
    """Store compressed JSON"""
    json_data = json.dumps(data)
    compressed = gzip.compress(json_data.encode())
    client.setex(key, ttl, compressed)

def get_compressed(key):
    """Retrieve and decompress"""
    compressed = client.get(key)
    if compressed:
        json_data = gzip.decompress(compressed).decode()
        return json.loads(json_data)
    return None
```

### Connection Optimization

**Use Connection Pooling**

```python
# Good: Reuse connections
pool = redis.ConnectionPool(
    host='localhost',
    port=6379,
    max_connections=50,
    socket_keepalive=True,
    socket_connect_timeout=5,
    retry_on_timeout=True
)
client = redis.Redis(connection_pool=pool)
```

### Query Optimization

**1. Avoid KEYS in Production**

```python
# Bad: KEYS blocks Redis
all_keys = client.keys("user:*")  # Blocks server!

# Good: SCAN doesn't block
for key in client.scan_iter(match="user:*", count=100):
    process(key)
```

**2. Use Lua Scripts for Complex Operations**

```python
# Atomic increment with max value
lua_script = """
local current = redis.call('GET', KEYS[1]) or 0
current = tonumber(current)
local max = tonumber(ARGV[1])

if current < max then
    return redis.call('INCR', KEYS[1])
else
    return current
end
"""

result = client.eval(lua_script, 1, 'counter', 100)
```

**3. Batch Operations with Transactions**

```python
# Use MULTI/EXEC for related operations
pipe = client.pipeline()
pipe.set('user:123:name', 'John')
pipe.set('user:123:email', 'john@example.com')
pipe.sadd('users', '123')
pipe.execute()
```

---

## Best Practices & Common Pitfalls

### Security Best Practices

**1. Never Expose Redis to the Internet**

```bash
# redis.conf
bind 127.0.0.1
protected-mode yes
requirepass your_strong_password_here
```

**2. Use Authentication**

```python
client = redis.Redis(
    host='localhost',
    port=6379,
    password='your_strong_password'
)
```

**3. Implement Rate Limiting on Redis Access**

```python
# Prevent abuse of Redis commands
def safe_scan(pattern, max_iterations=1000):
    count = 0
    for key in client.scan_iter(match=pattern):
        if count >= max_iterations:
            raise Exception("Scan iteration limit exceeded")
        yield key
        count += 1
```

### Data Persistence

**Configure Persistence Strategy**

```bash
# RDB (snapshot)
save 900 1      # Save after 900 sec if 1 key changed
save 300 10     # Save after 300 sec if 10 keys changed
save 60 10000   # Save after 60 sec if 10000 keys changed

# AOF (append-only file)
appendonly yes
appendfsync everysec  # Good balance of safety and performance
```

**Backup Strategy**

```python
import subprocess
from datetime import datetime

def backup_redis():
    """Create Redis backup"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"redis_backup_{timestamp}.rdb"

    # Trigger background save
    client.bgsave()

    # Wait for save to complete
    while client.lastsave() < time.time():
        time.sleep(1)

    # Copy RDB file
    subprocess.run(['cp', '/var/lib/redis/dump.rdb', f'/backups/{filename}'])
    print(f"Backup created: {filename}")
```

### Common Pitfalls to Avoid

**1. Not Setting Expiration**

```python
# Bad: Memory leak
client.set('temp_data', value)

# Good: Automatic cleanup
client.setex('temp_data', 3600, value)
```

**2. Using Large Keys**

```python
# Bad: Large keys slow down operations
client.set('huge_key', 'x' * 10_000_000)  # 10MB

# Good: Split into smaller chunks or use different storage
```

**3. N+1 Query Problem**

```python
# Bad: Multiple round trips
user_ids = [1, 2, 3, 4, 5]
users = [client.get(f'user:{uid}') for uid in user_ids]

# Good: Use MGET for multiple keys
keys = [f'user:{uid}' for uid in user_ids]
users = client.mget(keys)
```

**4. Not Handling Connection Failures**

```python
# Good: Retry logic with exponential backoff
def redis_get_with_retry(key, max_retries=3):
    for attempt in range(max_retries):
        try:
            return client.get(key)
        except redis.ConnectionError:
            if attempt == max_retries - 1:
                raise
            wait_time = 2 ** attempt
            time.sleep(wait_time)
```

**5. Blocking the Server**

```python
# Bad: Blocks Redis
client.keys('*')
client.sort('large_list')

# Good: Non-blocking alternatives
for key in client.scan_iter():
    process(key)
```

---

## Monitoring & Troubleshooting

### Key Metrics to Monitor

**1. Memory Usage**

```python
def check_memory():
    """Monitor Redis memory usage"""
    info = client.info('memory')

    used_memory_mb = info['used_memory'] / 1024 / 1024
    max_memory_mb = info.get('maxmemory', 0) / 1024 / 1024

    print(f"Used Memory: {used_memory_mb:.2f} MB")

    if max_memory_mb > 0:
        usage_percent = (used_memory_mb / max_memory_mb) * 100
        print(f"Memory Usage: {usage_percent:.2f}%")

        if usage_percent > 80:
            print("WARNING: High memory usage!")
```

**2. Command Statistics**

```python
def analyze_commands():
    """Analyze most used commands"""
    info = client.info('commandstats')

    commands = []
    for key, value in info.items():
        if key.startswith('cmdstat_'):
            cmd_name = key.replace('cmdstat_', '')
            commands.append((cmd_name, value['calls']))

    # Sort by frequency
    commands.sort(key=lambda x: x[1], reverse=True)

    print("Top 10 Commands:")
    for cmd, count in commands[:10]:
        print(f"  {cmd}: {count:,}")
```

**3. Slow Log Analysis**

```python
def check_slow_queries():
    """Find slow queries"""
    slow_log = client.slowlog_get(10)

    for entry in slow_log:
        duration_ms = entry['duration'] / 1000
        print(f"Slow query: {entry['command']} ({duration_ms:.2f}ms)")
```

**4. Key Space Analysis**

```python
def analyze_keyspace():
    """Analyze key patterns and sizes"""
    patterns = {}

    for key in client.scan_iter(count=1000):
        # Extract pattern (e.g., "user:123" -> "user:*")
        pattern = ':'.join(key.split(':')[:-1]) + ':*' if ':' in key else 'other'

        if pattern not in patterns:
            patterns[pattern] = {'count': 0, 'total_size': 0}

        patterns[pattern]['count'] += 1

        # Get approximate size
        key_type = client.type(key)
        if key_type == 'string':
            size = len(client.get(key) or '')
        elif key_type == 'hash':
            size = len(str(client.hgetall(key)))
        else:
            size = 0

        patterns[pattern]['total_size'] += size

    # Print analysis
    print("Key Space Analysis:")
    for pattern, stats in sorted(patterns.items(),
                                 key=lambda x: x[1]['count'],
                                 reverse=True)[:10]:
        avg_size = stats['total_size'] / stats['count'] if stats['count'] > 0 else 0
        print(f"  {pattern}: {stats['count']} keys, avg size: {avg_size:.0f} bytes")
```

### Health Check Script

```python
def redis_health_check():
    """Comprehensive Redis health check"""
    try:
        # 1. Check connection
        client.ping()
        print("✓ Redis connection OK")

        # 2. Check memory
        info = client.info('memory')
        used_memory_mb = info['used_memory'] / 1024 / 1024
        print(f"✓ Memory usage: {used_memory_mb:.2f} MB")

        # 3. Check connected clients
        clients_count = client.client_list()
        print(f"✓ Connected clients: {len(clients_count)}")

        # 4. Check replication
        replication_info = client.info('replication')
        role = replication_info['role']
        print(f"✓ Role: {role}")

        if role == 'master':
            connected_slaves = replication_info['connected_slaves']
            print(f"  Slaves: {connected_slaves}")

        # 5. Check persistence
        rdb_last_save = client.lastsave()
        print(f"✓ Last save: {datetime.fromtimestamp(rdb_last_save)}")

        # 6. Check keyspace
        keyspace_info = client.info('keyspace')
        total_keys = sum(db_info['keys'] for db_info in keyspace_info.values())
        print(f"✓ Total keys: {total_keys:,}")

        print("\n✅ Redis is healthy!")
        return True

    except Exception as e:
        print(f"\n❌ Health check failed: {e}")
        return False

# Run health check
redis_health_check()
```

### Common Issues and Solutions

**Issue 1: High Memory Usage**

```python
# Solution: Find large keys
def find_large_keys(threshold_mb=1):
    """Find keys larger than threshold"""
    threshold_bytes = threshold_mb * 1024 * 1024
    large_keys = []

    for key in client.scan_iter(count=100):
        size = client.memory_usage(key)
        if size and size > threshold_bytes:
            large_keys.append((key, size / 1024 / 1024))

    for key, size_mb in sorted(large_keys, key=lambda x: x[1], reverse=True):
        print(f"Large key: {key} ({size_mb:.2f} MB)")
```

**Issue 2: Slow Performance**

```python
# Check for blocking commands
def check_blocking_commands():
    """Detect potentially blocking operations"""
    slow_commands = ['KEYS', 'FLUSHDB', 'FLUSHALL', 'SORT']

    info = client.info('commandstats')
    for key, value in info.items():
        cmd = key.replace('cmdstat_', '').upper()
        if cmd in slow_commands and value['calls'] > 0:
            print(f"⚠️  Blocking command detected: {cmd} ({value['calls']} calls)")
```

**Issue 3: Connection Pool Exhaustion**

```python
# Monitor connection pool
def monitor_connection_pool(pool):
    """Check connection pool health"""
    print(f"Pool connections in use: {pool._in_use_connections}")
    print(f"Pool available connections: {pool._available_connections}")
    print(f"Pool created connections: {pool._created_connections}")

    if len(pool._in_use_connections) == pool.max_connections:
        print("⚠️  Connection pool exhausted!")
```

---

## Production Deployment Checklist

### Pre-deployment

- ✅ Set `maxmemory` and eviction policy
- ✅ Enable password authentication
- ✅ Configure persistence (RDB + AOF)
- ✅ Set up monitoring and alerting
- ✅ Plan backup strategy
- ✅ Configure replication for high availability
- ✅ Tune kernel parameters (TCP backlog, etc.)
- ✅ Set appropriate `timeout` for idle connections

### Post-deployment

- ✅ Verify all connections use connection pooling
- ✅ Monitor memory usage trends
- ✅ Check slow query log regularly
- ✅ Set up automated backups
- ✅ Test failover procedures
- ✅ Document key naming conventions
- ✅ Create runbook for common issues

### Scaling Strategies

**1. Vertical Scaling**

- Increase RAM (Redis is memory-bound)
- Use faster CPUs for complex operations
- Upgrade to NVMe storage for persistence

**2. Horizontal Scaling**

- Use Redis Cluster for automatic sharding
- Implement read replicas for read-heavy workloads
- Use separate Redis instances for different use cases

**3. Optimize Application Code**

- Use pipelining for bulk operations
- Implement connection pooling
- Cache query results appropriately
- Use appropriate data structures

---

## Conclusion

Redis is a powerful tool that can dramatically improve application performance when used correctly. The key to success is understanding your use case and choosing the right data structures and patterns.

**Remember:**

- Always set TTLs on temporary data
- Use connection pooling in production
- Monitor memory usage and slow queries
- Choose the right data structure for your use case
- Test failover and recovery procedures
- Keep Redis secure and isolated

**Next Steps:**

1. Start with simple use cases (caching, sessions)
2. Measure performance improvements
3. Gradually adopt advanced patterns
4. Monitor and optimize continuously
5. Consider Redis Cluster for large-scale deployments

---

## Additional Resources

- **Official Documentation:** https://redis.io/documentation
- **Redis Commands:** https://redis.io/commands
- **Redis Python Client:** https://redis-py.readthedocs.io/
- **Redis Best Practices:** https://redis.io/topics/best-practices
- **Redis University:** https://university.redis.com/

---

_Last Updated: January 2025_
