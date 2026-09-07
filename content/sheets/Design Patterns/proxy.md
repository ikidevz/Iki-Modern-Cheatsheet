# Proxy

**Category:** Structural
**Also known as:** Surrogate

## Intent
Provide a surrogate or placeholder for another object to **control access** to it.

## Motivation
Some objects are expensive to create, sensitive to expose directly, or physically remote. Consider a dashboard that displays user profile pictures — loading every full-resolution image eagerly, even ones scrolled off-screen, wastes bandwidth and memory:

```python
class UserGallery:
    def __init__(self, user_ids):
        # Eagerly loads EVERY image up front, even ones never scrolled to
        self.images = [RealImage(f"user_{uid}.jpg") for uid in user_ids]
```

If the gallery has 500 users, this loads 500 full images immediately, even though the user might only ever scroll through 10 of them. What's needed is something that *looks and behaves* like the real image to calling code, but defers the actual expensive load until the image is genuinely about to be displayed.

Proxy solves this — and a family of related problems (access control, remote calls, logging) — by inserting a stand-in object that implements the exact same interface as the real object, and decides when (or whether) to actually delegate to it.

## Applicability — When to Use
- **Virtual proxy** — lazy initialization of an expensive object, deferred until first real use.
- **Protection proxy** — controlling access to an object based on caller permissions.
- **Remote proxy** — representing an object that lives in a different address space (another process/machine).
- **Logging/caching/smart-reference proxy** — adding side effects (logging, caching, reference counting) transparently around access to an object.

## Structure
```
Client --> Subject (interface)
              ^        ^
              |        |
           Proxy   RealSubject
        (controls access, delegates to RealSubject)
```

## Participants
| Role | Responsibility |
|---|---|
| `Subject` | The common interface for `RealSubject` and `Proxy`, so a proxy can be used anywhere the real object is expected. |
| `RealSubject` | The actual object the proxy represents and controls access to. |
| `Proxy` | Maintains a reference to the `RealSubject`; controls access to it (creating it lazily, checking permissions, caching, logging) before/instead of delegating. |

## Basic Implementation
```python
from abc import ABC, abstractmethod


class Image(ABC):
    @abstractmethod
    def display(self) -> None: ...


class RealImage(Image):
    """Expensive to create — simulates loading a large file from disk."""

    def __init__(self, filename: str) -> None:
        self.filename = filename
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        print(f"Loading {self.filename} from disk...")

    def display(self) -> None:
        print(f"Displaying {self.filename}")


class ImageProxy(Image):
    """Virtual proxy: defers expensive creation until actually needed."""

    def __init__(self, filename: str) -> None:
        self.filename = filename
        self._real_image: RealImage | None = None

    def display(self) -> None:
        if self._real_image is None:
            self._real_image = RealImage(self.filename)  # lazy init
        self._real_image.display()


gallery = [ImageProxy("photo1.png"), ImageProxy("photo2.png")]
print("Gallery created — nothing loaded yet.")
gallery[0].display()   # loads photo1.png now
gallery[0].display()   # reuses already-loaded image
```

## Real-World Example: Combined Caching + Protection Proxy for an API Client

A more realistic production scenario layers *two* proxy concerns at once: expensive external API calls should be cached to avoid redundant network traffic, and only authorized roles should be able to trigger certain endpoints — all while the calling code just sees a plain `APIClient` interface.

```python
from __future__ import annotations
import time
from abc import ABC, abstractmethod


class APIClient(ABC):
    """Subject interface"""

    @abstractmethod
    def get_user_data(self, user_id: str) -> dict: ...

    @abstractmethod
    def delete_user(self, user_id: str) -> bool: ...


class RealAPIClient(APIClient):
    """RealSubject: the actual, slow, real network calls."""

    def get_user_data(self, user_id: str) -> dict:
        print(f"    [Network] GET /users/{user_id} ...")
        time.sleep(0.05)   # simulate network latency
        return {"id": user_id, "name": f"User {user_id}", "email": f"user{user_id}@example.com"}

    def delete_user(self, user_id: str) -> bool:
        print(f"    [Network] DELETE /users/{user_id} ...")
        time.sleep(0.05)
        return True


class CachingProxy(APIClient):
    """Caches read operations; write operations always pass through and invalidate the cache."""

    def __init__(self, client: APIClient, ttl_seconds: float = 5.0) -> None:
        self._client = client
        self._ttl = ttl_seconds
        self._cache: dict[str, tuple[float, dict]] = {}

    def get_user_data(self, user_id: str) -> dict:
        cached = self._cache.get(user_id)
        if cached and (time.time() - cached[0]) < self._ttl:
            print(f"[Cache] hit for user {user_id}")
            return cached[1]
        data = self._client.get_user_data(user_id)
        self._cache[user_id] = (time.time(), data)
        return data

    def delete_user(self, user_id: str) -> bool:
        result = self._client.delete_user(user_id)
        self._cache.pop(user_id, None)   # invalidate stale cache entry
        return result


class AuthorizationError(Exception):
    pass


class ProtectionProxy(APIClient):
    """Restricts sensitive operations (delete) to admin callers."""

    def __init__(self, client: APIClient, current_role: str) -> None:
        self._client = client
        self._role = current_role

    def get_user_data(self, user_id: str) -> dict:
        return self._client.get_user_data(user_id)   # reads allowed for everyone

    def delete_user(self, user_id: str) -> bool:
        if self._role != "admin":
            raise AuthorizationError(f"Role '{self._role}' cannot delete users")
        return self._client.delete_user(user_id)


def build_client(role: str) -> APIClient:
    """Layer proxies: Protection wraps Caching wraps the RealAPIClient."""
    real = RealAPIClient()
    cached = CachingProxy(real, ttl_seconds=5.0)
    return ProtectionProxy(cached, current_role=role)


# --- As a regular (non-admin) user ---
client = build_client(role="member")
print("--- First call (cache miss) ---")
print(client.get_user_data("42"))
print("--- Second call (cache hit) ---")
print(client.get_user_data("42"))

print("\n--- Attempting delete as non-admin ---")
try:
    client.delete_user("42")
except AuthorizationError as e:
    print("Blocked:", e)

# --- As an admin ---
admin_client = build_client(role="admin")
print("\n--- Delete as admin ---")
admin_client.delete_user("42")
```

Stacking `ProtectionProxy` around `CachingProxy` around `RealAPIClient` shows how proxies compose just like decorators — each layer adds one orthogonal concern (authorization, then caching) while `APIClient` calling code never changes, and never even needs to know proxies are involved at all.

## Implementation Notes
- Proxy and Decorator are **structurally identical** (both wrap an object behind the same interface) — the difference is intent: Decorator *adds* behavior, Proxy *controls access* (may refuse, defer, or redirect the call entirely). In practice the two often get combined, as in the example above.
- Always invalidate caches on writes (see `delete_user` clearing the cache entry above) — a caching proxy that only caches reads but never invalidates on writes will happily serve stale data forever.
- Keep the proxy's interface **exactly** matching the real subject's — any divergence breaks the transparency that makes Proxy useful in the first place.

## Consequences

**Pros**
- Controls access to the real object without the client needing to know a proxy is involved.
- Manages the lifecycle of the real object (lazy creation, connection pooling, cleanup).
- Adds behavior (logging, caching, access control) transparently, and proxies can be layered for multiple concerns at once.

**Cons**
- Adds a layer of indirection, which can add latency, especially when several proxies are stacked.
- Increases code complexity with an extra class per proxied concern.

## Common Pitfalls
- Caching writes as if they were reads, or forgetting to invalidate cache entries on mutation — leads to serving stale data.
- Letting a protection proxy's authorization check drift out of sync with the real subject's actual sensitive operations as the codebase evolves.

## Real-World Examples
- ORMs' lazy-loaded relationships (`user.orders` only queries the DB when accessed).
- `unittest.mock` objects acting as proxies/stand-ins for real dependencies in tests.
- gRPC/RPC client stubs acting as remote proxies; API client SDKs with built-in caching and auth layers.

## Related Patterns
- [Adapter](../structural/adapter.md) — Adapter changes the interface; Proxy keeps the same interface as the real subject.
- [Decorator](../structural/decorator.md) — structurally identical, but Decorator *adds* responsibilities while Proxy *controls* access; the two are frequently layered together, as shown above.
- [Facade](../structural/facade.md) — Facade simplifies access to a whole subsystem; Proxy controls access to a single object behind the same interface.
