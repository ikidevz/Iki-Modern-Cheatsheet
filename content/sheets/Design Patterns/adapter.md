# Adapter

**Category:** Structural
**Also known as:** Wrapper

## Intent
Convert the interface of a class into another interface clients expect. Adapter lets classes with incompatible interfaces work together.

## Motivation
Third-party and legacy code rarely speaks the exact interface your application wants. Suppose your app is built around a clean `PaymentProcessor.pay(amount: float)` interface, but the payment SDK you're forced to integrate exposes `make_charge(cents: int, currency_code: str) -> dict`. You can't edit the SDK's source, and rewriting your entire app around its interface would ripple through every call site:

```python
# Every call site now has to know SDK-specific quirks:
result = legacy_gateway.make_charge(int(amount * 100), "USD")
if result["status"] != "success":
    raise PaymentError(result["error_message"])
```

Adapter solves this by concentrating all that translation logic in **one place** — a wrapper class that implements the interface your code expects, and internally calls the SDK correctly.

## Applicability — When to Use
- You want to use an existing class, but its interface doesn't match what your code needs.
- You want a reusable class that cooperates with classes that don't share a compatible interface, including ones you don't control.
- You need to integrate several existing subclasses that lack some common functionality that can't be added to their shared superclass.

## Structure
```
Client --> Target (interface expected by client)
                ^
                |
             Adapter -----wraps----> Adaptee (incompatible interface)
```

## Participants
| Role | Responsibility |
|---|---|
| `Target` | The interface the client code expects and depends on. |
| `Adaptee` | The existing class with a useful but incompatible interface. |
| `Adapter` | Implements `Target`, translating calls into calls the `Adaptee` understands. |
| `Client` | Uses objects conforming to `Target`, unaware an adapter is involved. |

## Basic Implementation
```python
from abc import ABC, abstractmethod


# Target interface the client code expects
class PaymentProcessor(ABC):
    @abstractmethod
    def pay(self, amount: float) -> str: ...


# Adaptee: an existing third-party class with an incompatible interface
class LegacyStripeGateway:
    def make_charge(self, cents: int) -> str:
        return f"Charged {cents} cents via legacy Stripe gateway"


# Adapter bridges the gap
class StripeAdapter(PaymentProcessor):
    def __init__(self, gateway: LegacyStripeGateway) -> None:
        self._gateway = gateway

    def pay(self, amount: float) -> str:
        cents = int(round(amount * 100))
        return self._gateway.make_charge(cents)


def checkout(processor: PaymentProcessor, amount: float) -> None:
    print(processor.pay(amount))


checkout(StripeAdapter(LegacyStripeGateway()), 19.99)
```

## Real-World Example: Unifying Three Incompatible Weather APIs

A weather dashboard needs to pull data from three different providers, each returning wildly different response shapes and units. The application should work with one clean `WeatherReading` type regardless of provider.

```python
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class WeatherReading:
    """The uniform shape the rest of the app works with."""
    city: str
    temperature_celsius: float
    humidity_percent: float
    source: str


class WeatherProvider(ABC):
    """Target interface."""

    @abstractmethod
    def get_weather(self, city: str) -> WeatherReading: ...


# --- Adaptee 1: returns Fahrenheit, nested JSON-like dict ---
class LegacyUSWeatherAPI:
    def fetch(self, location: str) -> dict:
        return {
            "loc": location,
            "temp_f": 77.0,
            "rh": 0.55,   # relative humidity as a fraction
        }


class USWeatherAdapter(WeatherProvider):
    def __init__(self, api: LegacyUSWeatherAPI) -> None:
        self._api = api

    def get_weather(self, city: str) -> WeatherReading:
        data = self._api.fetch(city)
        celsius = (data["temp_f"] - 32) * 5 / 9
        return WeatherReading(
            city=data["loc"],
            temperature_celsius=round(celsius, 1),
            humidity_percent=data["rh"] * 100,
            source="LegacyUSWeatherAPI",
        )


# --- Adaptee 2: XML-style flat object with abbreviated fields ---
class EuroMetService:
    class Reading:
        def __init__(self, t: float, h: int) -> None:
            self.t = t   # already Celsius
            self.h = h   # already a percentage

    def query(self, city_code: str) -> "EuroMetService.Reading":
        return EuroMetService.Reading(t=25.0, h=60)


class EuroMetAdapter(WeatherProvider):
    def __init__(self, service: EuroMetService) -> None:
        self._service = service

    def get_weather(self, city: str) -> WeatherReading:
        reading = self._service.query(city_code=city.upper()[:3])
        return WeatherReading(
            city=city,
            temperature_celsius=reading.t,
            humidity_percent=float(reading.h),
            source="EuroMetService",
        )


# --- Adaptee 3: async-style callback API (adapted to a synchronous call) ---
class SensorNetworkClient:
    def request_reading(self, sensor_id: str, on_result) -> None:
        # Simulates a callback-based SDK by invoking the callback immediately
        on_result({"sensor": sensor_id, "celsius": 24.3, "humidity_pct": 58})


class SensorNetworkAdapter(WeatherProvider):
    def __init__(self, client: SensorNetworkClient) -> None:
        self._client = client

    def get_weather(self, city: str) -> WeatherReading:
        result: dict = {}
        self._client.request_reading(city, on_result=result.update)
        return WeatherReading(
            city=city,
            temperature_celsius=result["celsius"],
            humidity_percent=result["humidity_pct"],
            source="SensorNetworkClient",
        )


def print_dashboard(providers: list[WeatherProvider], city: str) -> None:
    for provider in providers:
        reading = provider.get_weather(city)
        print(f"[{reading.source}] {reading.city}: "
              f"{reading.temperature_celsius}°C, {reading.humidity_percent:.0f}% humidity")


providers: list[WeatherProvider] = [
    USWeatherAdapter(LegacyUSWeatherAPI()),
    EuroMetAdapter(EuroMetService()),
    SensorNetworkAdapter(SensorNetworkClient()),
]
print_dashboard(providers, "Manila")
```

This example shows Adapter earning its keep at scale: three genuinely incompatible APIs (different units, different shapes, even a different calling convention — callback vs. return value) are all normalized behind one `WeatherProvider` interface, so `print_dashboard()` never needs to know or care which provider it's talking to.

## Implementation Notes
- Python also supports **duck typing**, which can reduce the *need* for a formal Adapter in dynamically-typed code — if the Adaptee already happens to expose a method with the right name and signature, no adapter is required. Reach for a real Adapter class when names/signatures/units genuinely differ, as in the example above.
- There are two classic flavors: **object adapters** (composition — shown above, generally preferred in Python) and **class adapters** (multiple inheritance from both `Target` and `Adaptee`) — composition is usually safer and more flexible since it doesn't require Python's MRO to cooperate.
- Keep adapters **thin** — their only job is translation. If an adapter starts accumulating business logic, that logic likely belongs elsewhere.

## Consequences

**Pros**
- Single Responsibility — separates interface/data-format conversion from primary business logic.
- Open/Closed — new adapters can be introduced without breaking existing client code.

**Cons**
- Increases overall code complexity — sometimes it's simpler to change the service class directly, if you control it.

## Common Pitfalls
- Letting an adapter silently swallow or mistranslate errors from the adaptee — error semantics need translating too, not just happy-path data.
- Writing one "God Adapter" that wraps many unrelated Adaptees instead of one focused adapter per Adaptee — this reintroduces the coupling problem Adapter is meant to solve.

## Real-World Examples
- Wrapping a third-party payment/SMS/weather/logging SDK behind your own interface.
- `zip`/`itertools` adapters that make one iterable interface behave like another.
- ORMs adapting different database drivers to one common `Connection`/`Cursor` interface.

## Related Patterns
- [Bridge](../structural/bridge.md) — Bridge is designed up-front to let abstraction and implementation vary independently; Adapter is applied retroactively to make unrelated classes work together.
- [Decorator](../structural/decorator.md) — same wrapping structure, but Decorator adds responsibilities instead of translating an interface.
- [Facade](../structural/facade.md) — defines a *new*, simplified interface, whereas Adapter reuses/adapts an *existing* interface to match one the client already expects.
