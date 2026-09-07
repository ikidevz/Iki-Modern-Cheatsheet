# Builder

**Category:** Creational
**Also known as:** —

## Intent
Separate the construction of a complex object from its representation, so the same construction process can create different representations.

## Motivation
Objects with many optional configuration knobs tend to spiral into unreadable constructors:

```python
house = House(4, 1, 2, False, False, None, "brick", True, 2, "gray", None)
```

What does the fourth `False` mean? This is the classic **telescoping constructor** problem. Making every parameter a keyword argument helps a little, but a giant constructor is still one big, error-prone step — there's no way to build the object incrementally, validate as you go, or reuse partial configurations.

Builder fixes this by extracting construction into its own object with small, named, chainable steps, so intent is explicit at every step and the finished product is only returned once fully assembled.

## Applicability — When to Use
- Constructing an object requires many optional steps or parameters.
- You want the construction algorithm to be independent of the parts that make up the object, so the same steps can produce different representations (e.g., a report builder that outputs HTML or PDF).
- You want to build immutable, complex objects step by step and only expose them once complete and valid.

## Structure
```
Director ---uses---> Builder (interface)
                        + build_part_a()
                        + build_part_b()
                        + get_result()
                             ^
                             |
                      ConcreteBuilder --> Product
```

## Participants
| Role | Responsibility |
|---|---|
| `Builder` | Declares step methods common to all representations, plus a way to retrieve the finished product. |
| `ConcreteBuilder` | Implements the steps, tracking the product under construction. |
| `Director` | Optional — encapsulates a specific *recipe* of builder calls for a common configuration. |
| `Product` | The complex object being built. |

## Basic Implementation
```python
from __future__ import annotations
from dataclasses import dataclass


@dataclass
class House:
    walls: int = 0
    doors: int = 0
    windows: int = 0
    has_garage: bool = False
    has_pool: bool = False


class HouseBuilder:
    def __init__(self) -> None:
        self._house = House()

    def with_walls(self, n: int) -> "HouseBuilder":
        self._house.walls = n
        return self

    def with_doors(self, n: int) -> "HouseBuilder":
        self._house.doors = n
        return self

    def with_windows(self, n: int) -> "HouseBuilder":
        self._house.windows = n
        return self

    def with_garage(self) -> "HouseBuilder":
        self._house.has_garage = True
        return self

    def with_pool(self) -> "HouseBuilder":
        self._house.has_pool = True
        return self

    def build(self) -> House:
        result, self._house = self._house, House()
        return result


class Director:
    @staticmethod
    def build_minimal_house(builder: HouseBuilder) -> House:
        return builder.with_walls(4).with_doors(1).with_windows(2).build()

    @staticmethod
    def build_luxury_house(builder: HouseBuilder) -> House:
        return (
            builder.with_walls(8)
            .with_doors(3)
            .with_windows(10)
            .with_garage()
            .with_pool()
            .build()
        )


builder = HouseBuilder()
starter_home = Director.build_minimal_house(builder)
mansion = Director.build_luxury_house(builder)
print(starter_home)
print(mansion)
```

## Real-World Example: HTTP Request Builder with Validation

A robust HTTP client builder needs to accumulate headers, query params, auth, and a body across many optional calls, validate the result before sending, and stay immutable once built — very close to real client libraries like `httpx`'s request objects.

```python
from __future__ import annotations
from dataclasses import dataclass, field


@dataclass(frozen=True)
class HTTPRequest:
    method: str
    url: str
    headers: dict[str, str]
    params: dict[str, str]
    body: str | None
    timeout: float


class HTTPRequestBuilder:
    """Fluent, validating builder for HTTPRequest objects."""

    def __init__(self, method: str, url: str) -> None:
        self._method = method.upper()
        self._url = url
        self._headers: dict[str, str] = {}
        self._params: dict[str, str] = {}
        self._body: str | None = None
        self._timeout: float = 10.0

    def header(self, key: str, value: str) -> "HTTPRequestBuilder":
        self._headers[key] = value
        return self

    def bearer_token(self, token: str) -> "HTTPRequestBuilder":
        return self.header("Authorization", f"Bearer {token}")

    def query(self, key: str, value: str) -> "HTTPRequestBuilder":
        self._params[key] = value
        return self

    def json_body(self, payload: dict) -> "HTTPRequestBuilder":
        import json
        self._body = json.dumps(payload)
        return self.header("Content-Type", "application/json")

    def timeout(self, seconds: float) -> "HTTPRequestBuilder":
        self._timeout = seconds
        return self

    def build(self) -> HTTPRequest:
        self._validate()
        return HTTPRequest(
            method=self._method,
            url=self._url,
            headers=dict(self._headers),
            params=dict(self._params),
            body=self._body,
            timeout=self._timeout,
        )

    def _validate(self) -> None:
        if not self._url.startswith(("http://", "https://")):
            raise ValueError(f"Invalid URL: {self._url}")
        if self._method in {"GET", "HEAD"} and self._body is not None:
            raise ValueError(f"{self._method} requests cannot have a body")
        if self._timeout <= 0:
            raise ValueError("timeout must be positive")


# Building a request step by step, with validation deferred to build()
request = (
    HTTPRequestBuilder("POST", "https://api.example.com/orders")
    .bearer_token("secret-token-123")
    .query("dry_run", "false")
    .json_body({"item": "widget", "qty": 3})
    .timeout(5.0)
    .build()
)
print(request)

try:
    HTTPRequestBuilder("GET", "https://api.example.com/orders").json_body({"x": 1}).build()
except ValueError as e:
    print("Validation caught it:", e)
```

The `build()` step's validation is the key upgrade over the basic example: it demonstrates why deferring finalization matters — a `GET` request with a JSON body is caught **before** an invalid `HTTPRequest` object can ever exist, which is exactly the guarantee a good Builder should provide.

## Implementation Notes
- Return `self` from every setter to enable fluent chaining — this is idiomatic in Python builders (mirrors `str` methods like `.strip().lower()`).
- Validate in `build()`, not in each individual setter — setters should stay cheap and order-independent; only the final assembled state can be meaningfully validated.
- Use `@dataclass(frozen=True)` (or similar) for the finished product so it's immutable once built — this prevents client code from mutating a "finished" object and violating invariants the builder enforced.
- A `Director` is optional in Python; many idiomatic builders skip it and let call sites chain methods directly, reserving `Director`-style recipe methods (`build_minimal_house`) only when a configuration is reused often enough to deserve a name.

## Consequences

**Pros**
- Fine-grained control over the construction process.
- The same building code can produce different representations of the product.
- Isolates complex construction logic from business logic (Single Responsibility), and centralizes validation.

**Cons**
- Overall code complexity increases — requires several new classes for what a plain constructor might have handled.
- Tightly coupled to the specific product it builds unless deliberately generalized.

## Common Pitfalls
- Validating too early (in individual setters) instead of once in `build()` — this rejects perfectly valid *intermediate* states.
- Making the builder mutable and reusable without resetting internal state between `build()` calls, causing state to leak between products.
- Reaching for Builder when a `dataclass` with default values and keyword arguments would already be clear enough — don't build a builder for three optional fields.

## Real-World Examples
- SQL query builders (`select().where().order_by().limit()`)
- HTTP request/client builders (`httpx`, `requests.Session` configuration patterns)
- Django `ModelForm` and test data builder libraries (e.g. `factory_boy`)

## Related Patterns
- [Abstract Factory](../creational/abstract-factory.md) — returns the product immediately as a whole family; Builder constructs one complex product step by step and can expose intermediate results.
- [Composite](../structural/composite.md) — Builders are often used to construct Composite trees node by node.
- [Prototype](../creational/prototype.md) — can be combined with Builder to clone a preset configuration before customizing it further.
