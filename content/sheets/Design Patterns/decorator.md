# Decorator

**Category:** Structural
**Also known as:** Wrapper

## Intent
Attach additional responsibilities to an object dynamically. Decorators provide a flexible alternative to subclassing for extending behavior.

## Motivation
Suppose a coffee shop app models drinks as classes, and every combination of add-ons needs its own subclass:

```python
class Coffee: ...
class CoffeeWithMilk(Coffee): ...
class CoffeeWithSugar(Coffee): ...
class CoffeeWithMilkAndSugar(Coffee): ...
class CoffeeWithMilkAndSugarAndWhippedCream(Coffee): ...
# every new topping doubles the number of combinations
```

With `n` optional add-ons, you'd need up to `2^n` subclasses to cover every combination — completely unworkable past a handful of options. And the combinations are only known at order time (a runtime decision), not compile/class-definition time.

Decorator solves this by wrapping the base object in layers, each layer adding one responsibility and forwarding to the object it wraps. Combinations become **runtime composition** (stack decorators as needed) instead of **compile-time subclassing** (define a class per combination).

## Applicability — When to Use
- You need to add responsibilities to individual objects dynamically and transparently, without affecting other objects of the same class.
- Subclassing is impractical because responsibilities can combine in many ways (combinatorial explosion).
- You want responsibilities to be added *and removed* at runtime.

## Structure
```
Component (interface)
  + operation()
     ^        ^
     |        |
ConcreteComponent   Decorator ---wraps---> Component
                       + operation()  # calls wrapped.operation() + extra behavior
                          ^
                          |
                 ConcreteDecoratorA / B
```

## Participants
| Role | Responsibility |
|---|---|
| `Component` | The common interface for both wrapped and unwrapped objects. |
| `ConcreteComponent` | The base object that decorators will wrap. |
| `Decorator` | Implements `Component`, holds a reference to a wrapped `Component`, and delegates to it. |
| `ConcreteDecorator` | Adds a specific responsibility before/after delegating to the wrapped object. |

## Basic Implementation
```python
from abc import ABC, abstractmethod


class Coffee(ABC):
    @abstractmethod
    def cost(self) -> float: ...

    @abstractmethod
    def description(self) -> str: ...


class SimpleCoffee(Coffee):
    def cost(self) -> float:
        return 2.00

    def description(self) -> str:
        return "Coffee"


class CoffeeDecorator(Coffee):
    def __init__(self, coffee: Coffee) -> None:
        self._coffee = coffee

    def cost(self) -> float:
        return self._coffee.cost()

    def description(self) -> str:
        return self._coffee.description()


class MilkDecorator(CoffeeDecorator):
    def cost(self) -> float:
        return super().cost() + 0.50

    def description(self) -> str:
        return super().description() + " + Milk"


class SugarDecorator(CoffeeDecorator):
    def cost(self) -> float:
        return super().cost() + 0.25

    def description(self) -> str:
        return super().description() + " + Sugar"


order = SugarDecorator(MilkDecorator(SimpleCoffee()))
print(order.description(), "->", f"${order.cost():.2f}")
# Coffee + Milk + Sugar -> $2.75
```

> Python's built-in `@decorator` function syntax is a related but distinct idea — it wraps *functions*, applying the same "wrap and extend behavior" principle at the language level.

## Real-World Example: Layered Middleware for a Data Fetcher

A common backend need: wrap a data-fetching function with caching, retry logic, and logging — each concern independent, each optional, each composable in any order.

```python
from __future__ import annotations
import time
import random
from abc import ABC, abstractmethod


class DataFetcher(ABC):
    @abstractmethod
    def fetch(self, key: str) -> str: ...


class APIDataFetcher(DataFetcher):
    """ConcreteComponent: the real, 'expensive' operation being decorated."""

    def fetch(self, key: str) -> str:
        print(f"    [API] Fetching '{key}' from remote service...")
        if random.random() < 0.3:
            raise ConnectionError("Simulated network failure")
        return f"data-for-{key}"


class FetcherDecorator(DataFetcher):
    def __init__(self, fetcher: DataFetcher) -> None:
        self._fetcher = fetcher

    def fetch(self, key: str) -> str:
        return self._fetcher.fetch(key)


class LoggingDecorator(FetcherDecorator):
    def fetch(self, key: str) -> str:
        print(f"[LOG] fetch('{key}') called")
        start = time.perf_counter()
        result = super().fetch(key)
        elapsed = (time.perf_counter() - start) * 1000
        print(f"[LOG] fetch('{key}') returned in {elapsed:.1f}ms")
        return result


class CachingDecorator(FetcherDecorator):
    def __init__(self, fetcher: DataFetcher) -> None:
        super().__init__(fetcher)
        self._cache: dict[str, str] = {}

    def fetch(self, key: str) -> str:
        if key in self._cache:
            print(f"[CACHE] hit for '{key}'")
            return self._cache[key]
        result = super().fetch(key)
        self._cache[key] = result
        return result


class RetryDecorator(FetcherDecorator):
    def __init__(self, fetcher: DataFetcher, max_attempts: int = 3) -> None:
        super().__init__(fetcher)
        self._max_attempts = max_attempts

    def fetch(self, key: str) -> str:
        last_error: Exception | None = None
        for attempt in range(1, self._max_attempts + 1):
            try:
                return super().fetch(key)
            except ConnectionError as e:
                last_error = e
                print(f"[RETRY] attempt {attempt} failed: {e}")
        raise last_error  # type: ignore[misc]


# Stack decorators in whatever order the situation calls for:
#   caching (outermost) -> logging -> retry -> the real fetcher (innermost)
fetcher: DataFetcher = CachingDecorator(
    LoggingDecorator(
        RetryDecorator(APIDataFetcher(), max_attempts=3)
    )
)

print("--- First call (cache miss) ---")
print("Result:", fetcher.fetch("user:42"))

print("\n--- Second call (cache hit, nothing else runs) ---")
print("Result:", fetcher.fetch("user:42"))
```

Notice how each decorator only knows about the single `fetch()` method it wraps — `CachingDecorator` short-circuits everything beneath it on a hit, while `LoggingDecorator` and `RetryDecorator` compose freely in any order the caller chooses, without any of the three decorator classes knowing the others exist.

## Implementation Notes
- **Order matters.** `Caching(Logging(fetcher))` logs only on cache misses; `Logging(Caching(fetcher))` logs every call including cache hits — choose the stacking order deliberately based on what behavior you want.
- Python's function/method `@decorator` syntax is the same idea applied to callables rather than objects — for simple single-method wrapping, a function decorator is often more idiomatic than a full class-based Decorator; reach for the OOP pattern shown here when the component has multiple methods that all need consistent wrapping, or when decorators need their own internal state (like `CachingDecorator`'s cache dict).
- Keep the `Decorator` base class delegating everything by default (see `FetcherDecorator` above) so each concrete decorator only overrides what it actually changes.

## Consequences

**Pros**
- More flexible than static inheritance — combine behaviors at runtime, in any order, without a combinatorial class explosion.
- Avoids a single feature-laden class high in the hierarchy trying to do everything.
- Single Responsibility — each decorator handles exactly one concern.

**Cons**
- Results in many small, similar-looking wrapper objects that can be harder to debug (deep call stacks through several layers).
- Stacking order can matter and produce subtle bugs if chosen carelessly.
- Removing one specific wrapper from the middle of an existing stack is awkward — decorators aren't addressable individually once composed.

## Common Pitfalls
- Forgetting that decorator order changes behavior (see caching/logging example above) and picking an order that silently hides bugs (e.g., wrapping retry *inside* logging so retried attempts are never logged).
- Decorators that don't fully implement the component interface, breaking transparency — client code should never be able to tell it's talking to a decorated object versus a plain one.

## Real-World Examples
- Python's function/method decorators (`@staticmethod`, `@property`, `@lru_cache`)
- Java I/O streams (`BufferedReader(FileReader(...))`)
- Middleware chains in web frameworks (each middleware wraps the request handler)

## Related Patterns
- [Adapter](../structural/adapter.md) — changes an object's interface; Decorator keeps the interface but adds behavior.
- [Composite](../structural/composite.md) — a Decorator is essentially a Composite restricted to exactly one child.
- [Strategy](#) — Strategy changes the object's *guts* (swap an algorithm); Decorator changes its *skin* (wrap with added behavior).
