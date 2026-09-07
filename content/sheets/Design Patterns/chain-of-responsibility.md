# Chain of Responsibility

**Category:** Behavioral
**Also known as:** CoR, Chain of Command

## Intent
Avoid coupling the sender of a request to its receiver by giving more than one object a chance to handle the request. Chain the receiving objects and pass the request along until an object handles it.

## Motivation
An HTTP request typically needs several independent checks before it reaches business logic: authentication, rate limiting, request logging, input validation. Cramming all of this into one function creates a rigid, hard-to-extend mess:

```python
def handle_request(request):
    if not is_authenticated(request):
        return error_response(401)
    if is_rate_limited(request):
        return error_response(429)
    log_request(request)
    if not is_valid(request):
        return error_response(400)
    return actual_handler(request)
    # adding a new check means editing this function and re-testing everything
```

Every new cross-cutting concern (CORS, compression, caching) means editing this single function, risking breaking the ones already there, and the order of checks is baked in rigidly. Chain of Responsibility decouples these checks into independent handler objects, each deciding whether to process the request itself or pass it further down the chain — new handlers are added by linking in a new object, not by editing existing code.

## Applicability — When to Use
- More than one object may handle a request, and the handler isn't known in advance.
- You want to issue a request to one of several objects without specifying the receiver explicitly.
- The set of handlers and their order should be configurable at runtime, not hardcoded.

## Structure
```
Client --> Handler1 --next--> Handler2 --next--> Handler3 --next--> None
           (checks, else forwards)
```

## Participants
| Role | Responsibility |
|---|---|
| `Handler` | Declares the interface for handling requests and (optionally) a reference to the next handler in the chain. |
| `ConcreteHandler` | Handles requests it's responsible for; forwards everything else to its successor. |
| `Client` | Initiates the request into the chain, without knowing which handler will ultimately process it. |

## Basic Implementation
```python
from __future__ import annotations
from abc import ABC, abstractmethod


class SupportHandler(ABC):
    def __init__(self) -> None:
        self._next: SupportHandler | None = None

    def set_next(self, handler: "SupportHandler") -> "SupportHandler":
        self._next = handler
        return handler   # allows chaining: h1.set_next(h2).set_next(h3)

    def handle(self, ticket_level: int, message: str) -> str:
        if self._next:
            return self._next.handle(ticket_level, message)
        return f"No handler available for: {message}"


class Level1Support(SupportHandler):
    def handle(self, ticket_level: int, message: str) -> str:
        if ticket_level <= 1:
            return f"[Level 1] Resolved: {message}"
        return super().handle(ticket_level, message)


class Level2Support(SupportHandler):
    def handle(self, ticket_level: int, message: str) -> str:
        if ticket_level <= 2:
            return f"[Level 2] Resolved: {message}"
        return super().handle(ticket_level, message)


class ManagerSupport(SupportHandler):
    def handle(self, ticket_level: int, message: str) -> str:
        if ticket_level <= 3:
            return f"[Manager] Resolved: {message}"
        return super().handle(ticket_level, message)


l1, l2, mgr = Level1Support(), Level2Support(), ManagerSupport()
l1.set_next(l2).set_next(mgr)

print(l1.handle(1, "Password reset"))
print(l1.handle(3, "Refund escalation"))
print(l1.handle(5, "CEO complaint"))
```

## Real-World Example: HTTP Middleware Pipeline

This turns the motivating scenario into working code: a configurable chain of middleware handlers, each independently responsible for one concern, any of which can short-circuit the chain (e.g., reject an unauthenticated request) without the others knowing.

```python
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class Request:
    path: str
    headers: dict[str, str] = field(default_factory=dict)
    ip: str = "0.0.0.0"


@dataclass
class Response:
    status: int
    body: str


class Middleware(ABC):
    def __init__(self) -> None:
        self._next: Middleware | None = None

    def set_next(self, handler: "Middleware") -> "Middleware":
        self._next = handler
        return handler

    def handle(self, request: Request) -> Response:
        if self._next:
            return self._next.handle(request)
        return Response(200, f"OK: {request.path}")   # end of chain: the "real" handler

    @abstractmethod
    def process(self, request: Request) -> Response | None:
        """Return a Response to short-circuit, or None to continue the chain."""


class ChainedMiddleware(Middleware):
    """Base that wires process() into the standard handle()/forward flow."""

    def handle(self, request: Request) -> Response:
        result = self.process(request)
        if result is not None:
            return result   # this middleware handled it — chain stops here
        return super().handle(request)


class AuthMiddleware(ChainedMiddleware):
    def process(self, request: Request) -> Response | None:
        if "Authorization" not in request.headers:
            print("[Auth] Rejected: missing token")
            return Response(401, "Unauthorized")
        print("[Auth] OK")
        return None   # pass to the next handler


_rate_limit_counts: dict[str, int] = {}


class RateLimitMiddleware(ChainedMiddleware):
    def __init__(self, max_requests: int = 3) -> None:
        super().__init__()
        self._max = max_requests

    def process(self, request: Request) -> Response | None:
        count = _rate_limit_counts.get(request.ip, 0) + 1
        _rate_limit_counts[request.ip] = count
        if count > self._max:
            print(f"[RateLimit] Rejected: {request.ip} exceeded {self._max} requests")
            return Response(429, "Too Many Requests")
        print(f"[RateLimit] OK ({count}/{self._max})")
        return None


class LoggingMiddleware(ChainedMiddleware):
    def process(self, request: Request) -> Response | None:
        print(f"[Log] {request.ip} -> {request.path}")
        return None   # logging never blocks the chain


# Build the pipeline once; order is explicit and easy to change.
pipeline = AuthMiddleware()
pipeline.set_next(RateLimitMiddleware(max_requests=2)).set_next(LoggingMiddleware())

authed_request = Request(path="/api/orders", headers={"Authorization": "Bearer xyz"}, ip="10.0.0.5")
unauthed_request = Request(path="/api/orders", ip="10.0.0.9")

print("--- Request 1 (authorized) ---")
print(pipeline.handle(authed_request))

print("\n--- Request 2 (authorized, still under rate limit) ---")
print(pipeline.handle(authed_request))

print("\n--- Request 3 (authorized, now over rate limit) ---")
print(pipeline.handle(authed_request))

print("\n--- Request 4 (unauthenticated) ---")
print(pipeline.handle(unauthed_request))
```

Each middleware is completely independent — `RateLimitMiddleware` doesn't know `AuthMiddleware` exists, and either one can be reordered, removed, or a new one (compression, CORS) inserted, by editing only the pipeline construction line, never the middleware classes themselves.

## Implementation Notes
- Splitting `handle()` (the forwarding mechanics) from `process()` (the actual check) as shown above keeps each concrete handler focused purely on its own logic, avoiding repetition of the "call `super().handle()`" boilerplate.
- Always provide a sensible **default at the end of the chain** (the base `handle()` returning a 200 above) — an unhandled request silently falling off the end of the chain is a common source of confusing bugs.
- Chain length and order should typically be configured in one place (like the `pipeline = ...` block above), not scattered — that's what keeps the chain's behavior auditable.

## Consequences

**Pros**
- Reduces coupling between sender and receivers — the client doesn't know or care which handler ultimately processes the request.
- Follows Single Responsibility — each handler encapsulates one processing rule.
- Follows Open/Closed — new handlers are added by linking in a new object, without touching existing ones.

**Cons**
- A request can silently go unhandled if the chain isn't configured with a sensible fallback.
- Can be harder to observe/debug at runtime since the flow isn't explicit at any single call site — tracing a bug means stepping through the whole chain.

## Common Pitfalls
- Forgetting to call the next handler (or forgetting a fallback at the end) — requests either get stuck or silently dropped.
- Ordering handlers incorrectly (e.g., logging before auth, so unauthenticated requests are never logged, or vice versa when you wanted the opposite).

## Real-World Examples
- Middleware pipelines in web frameworks (Django, Express, Flask) — each middleware can handle or pass along a request.
- Event bubbling in GUI frameworks and the DOM.
- Logging frameworks where a message passes through handlers per severity level.

## Related Patterns
- [Composite](../structural/composite.md) — CoR is often applied within a Composite tree, where a component's parent acts as its successor.
- [Command](../behavioral/command.md) — requests can be modeled as Command objects passed along the chain.
- [Mediator](../behavioral/mediator.md) — CoR passes a request along a linear chain; Mediator has colleagues communicate indirectly through a central hub instead.
