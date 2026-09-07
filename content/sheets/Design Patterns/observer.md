# Observer

**Category:** Behavioral
**Also known as:** Publish-Subscribe, Dependents, Listener

## Intent
Define a one-to-many dependency between objects so that when one object (the Subject) changes state, all its dependents (Observers) are notified and updated automatically.

## Motivation
A stock-trading dashboard needs several independent widgets — a price chart, a portfolio value calculator, a price-alert notifier — to react whenever a stock's price changes. Wiring the price source to know about every widget directly creates the same tangled-coupling problem seen elsewhere:

```python
class Stock:
    def __init__(self, chart_widget, portfolio_widget, alert_widget):
        self.chart_widget = chart_widget
        self.portfolio_widget = portfolio_widget
        self.alert_widget = alert_widget   # Stock now needs to know about every widget that cares

    def set_price(self, price):
        self.price = price
        self.chart_widget.update(price)
        self.portfolio_widget.update(price)
        self.alert_widget.update(price)
        # adding a new widget means editing Stock itself
```

`Stock` shouldn't need to know how many widgets are watching it, or even that "widgets" are the thing watching — a logging service, an email alerter, or a future feature might want to watch too. Observer decouples this: `Stock` just maintains a list of anonymous subscribers and calls `update()` on each; subscribers can be added or removed freely, and `Stock` never needs to change to support a new kind of watcher.

## Applicability — When to Use
- A change to one object requires changing others, and you don't know in advance how many objects need to change.
- An object should be able to notify other objects without making assumptions about who those objects are (loose coupling).
- You need a one-to-many relationship between objects, established and torn down dynamically at runtime.

## Structure
```
Subject                    Observer (interface)
  + subscribe(observer)       + update(data)
  + unsubscribe(observer)          ^
  + notify()                       |
       | notifies each      ConcreteObserverA / B
       v
   [ Observer, Observer, ... ]
```

## Participants
| Role | Responsibility |
|---|---|
| `Subject` | Maintains a list of observers; provides methods to attach/detach them, and notifies them of state changes. |
| `Observer` | Declares the update interface invoked by the subject when its state changes. |
| `ConcreteSubject` | Stores state of interest to observers, and sends notifications when it changes. |
| `ConcreteObserver` | Maintains a reference to a `ConcreteSubject`; implements `update()` to keep its own state consistent with the subject's. |

## Basic Implementation
```python
from __future__ import annotations
from abc import ABC, abstractmethod


class Observer(ABC):
    @abstractmethod
    def update(self, temperature: float) -> None: ...


class WeatherStation:
    """Subject"""

    def __init__(self) -> None:
        self._observers: list[Observer] = []
        self._temperature: float = 0.0

    def subscribe(self, observer: Observer) -> None:
        self._observers.append(observer)

    def unsubscribe(self, observer: Observer) -> None:
        self._observers.remove(observer)

    def set_temperature(self, value: float) -> None:
        self._temperature = value
        self._notify()

    def _notify(self) -> None:
        for observer in self._observers:
            observer.update(self._temperature)


class PhoneDisplay(Observer):
    def update(self, temperature: float) -> None:
        print(f"[Phone] Current temp: {temperature}°C")


class WebDashboard(Observer):
    def update(self, temperature: float) -> None:
        print(f"[Dashboard] Temperature updated to {temperature}°C")


station = WeatherStation()
phone = PhoneDisplay()
dashboard = WebDashboard()

station.subscribe(phone)
station.subscribe(dashboard)

station.set_temperature(28.5)

station.unsubscribe(phone)
station.set_temperature(30.0)   # only the dashboard updates now
```

## Real-World Example: Stock Ticker with Typed Events and Threshold Alerts

Extending the motivating scenario into working code: a `Stock` subject that pushes a rich event object (not just a bare number), multiple observer types reacting differently to the same event, and an alert observer that only fires when a threshold is crossed.

```python
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class PriceChangeEvent:
    symbol: str
    old_price: float
    new_price: float

    @property
    def percent_change(self) -> float:
        return ((self.new_price - self.old_price) / self.old_price) * 100


class StockObserver(ABC):
    @abstractmethod
    def on_price_change(self, event: PriceChangeEvent) -> None: ...


class Stock:
    """Subject: knows nothing about who's watching or why."""

    def __init__(self, symbol: str, initial_price: float) -> None:
        self.symbol = symbol
        self._price = initial_price
        self._observers: list[StockObserver] = []

    def subscribe(self, observer: StockObserver) -> None:
        self._observers.append(observer)

    def unsubscribe(self, observer: StockObserver) -> None:
        self._observers.remove(observer)

    def set_price(self, new_price: float) -> None:
        event = PriceChangeEvent(self.symbol, self._price, new_price)
        self._price = new_price
        for observer in list(self._observers):   # copy: safe even if a handler unsubscribes
            observer.on_price_change(event)


class PriceChartWidget(StockObserver):
    def __init__(self) -> None:
        self.history: list[float] = []

    def on_price_change(self, event: PriceChangeEvent) -> None:
        self.history.append(event.new_price)
        print(f"[Chart] {event.symbol}: plotted point at ${event.new_price:.2f}")


class PortfolioValueTracker(StockObserver):
    def __init__(self, shares_held: dict[str, int]) -> None:
        self.shares_held = shares_held
        self.total_value = 0.0

    def on_price_change(self, event: PriceChangeEvent) -> None:
        shares = self.shares_held.get(event.symbol, 0)
        delta = (event.new_price - event.old_price) * shares
        self.total_value += delta
        print(f"[Portfolio] {event.symbol} move changed portfolio by ${delta:+.2f} "
              f"(total: ${self.total_value:+.2f})")


class PriceAlertNotifier(StockObserver):
    """Only reacts when a move crosses a threshold — most events are ignored."""

    def __init__(self, threshold_percent: float = 5.0) -> None:
        self.threshold = threshold_percent

    def on_price_change(self, event: PriceChangeEvent) -> None:
        if abs(event.percent_change) >= self.threshold:
            direction = "up" if event.percent_change > 0 else "down"
            print(f"[ALERT] {event.symbol} is {direction} {abs(event.percent_change):.1f}%! "
                  f"(${event.old_price:.2f} -> ${event.new_price:.2f})")


stock = Stock("ACME", initial_price=100.0)

chart = PriceChartWidget()
portfolio = PortfolioValueTracker(shares_held={"ACME": 50})
alerts = PriceAlertNotifier(threshold_percent=5.0)

stock.subscribe(chart)
stock.subscribe(portfolio)
stock.subscribe(alerts)

print("--- Small move (no alert) ---")
stock.set_price(102.0)

print("\n--- Big move (triggers alert) ---")
stock.set_price(96.0)

print("\n--- Unsubscribing the chart, then another move ---")
stock.unsubscribe(chart)
stock.set_price(110.0)
```

`PriceAlertNotifier` illustrates something the toy example doesn't: observers don't have to react to *every* notification — each one decides independently whether an event is relevant to it, which is exactly how production event systems (webhooks, pub/sub filters) behave in practice.

## Implementation Notes
- Iterate over a **copy** of the observer list when notifying (`list(self._observers)` above) — if a handler unsubscribes itself or another observer during notification, mutating the list you're actively iterating over causes skipped or crashed notifications.
- Pass a rich, typed **event object** (like `PriceChangeEvent`) rather than bare positional values — it's easier to extend later (add a field) without breaking every observer's method signature.
- Observers are notified **synchronously and in an unspecified order** in this classic form — if you need guaranteed ordering, async delivery, or retry/backpressure, you're moving toward a full pub/sub message bus rather than in-process Observer.

## Consequences

**Pros**
- Supports loose coupling between the subject and its observers — the subject never needs to know concrete observer types.
- Open/Closed — new observer types can subscribe without any changes to the subject.
- Relationships can be established and torn down dynamically at runtime.

**Cons**
- Observers are typically notified in an unspecified/undefined order.
- Careless subscription management can cause memory leaks (observers never unsubscribed, kept alive by the subject) or cascading, hard-to-trace update chains if observers trigger further state changes.

## Common Pitfalls
- Mutating the observer list while iterating over it during notification (see the copy-the-list fix above).
- Forgetting to unsubscribe observers whose lifetime is shorter than the subject's — a classic source of memory leaks and "zombie" handlers firing on stale objects.

## Real-World Examples
- GUI event listeners (button clicks, form changes)
- Pub/Sub messaging systems (Kafka, Redis Pub/Sub, RxJS/RxPY streams)
- Model-View architectures where views observe model changes

## Related Patterns
- [Mediator](../behavioral/mediator.md) — Mediators often use Observer internally to notify colleagues of state changes.
- [Singleton](../creational/singleton.md) — the subject/event bus is sometimes a singleton.
- [State](../behavioral/state.md) — a Context object can notify observers whenever its State changes.
