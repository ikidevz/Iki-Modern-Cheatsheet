# Facade

**Category:** Structural
**Also known as:** —

## Intent
Provide a unified, higher-level interface to a set of interfaces in a subsystem. Facade makes a complex subsystem easier to use.

## Motivation
A realistic order-processing flow touches many subsystems: inventory checks, payment charging, shipment scheduling, and customer notification. Without a facade, every place in the codebase that needs to "place an order" has to orchestrate all four itself:

```python
if inventory.check_stock(item, qty):
    inventory.reserve(item, qty)
    charge_result = payment.charge(customer, amount)
    if charge_result.success:
        shipment.schedule(customer.address, item, qty)
        notifier.send(customer.email, "Order confirmed")
    else:
        inventory.release(item, qty)
        notifier.send(customer.email, "Payment failed")
# repeated, slightly differently, at every call site that places an order
```

Every caller now needs deep knowledge of four subsystems and their correct interaction order — and any bug fix (like the missing inventory release on a different failure path) has to be found and fixed in every duplicated copy.

Facade collects this orchestration into one class with a simple method (`place_order()`), so callers depend on one clean interface instead of four intertwined ones.

## Applicability — When to Use
- You want a simple, limited interface to a complex subsystem.
- There are many dependencies between client code and the implementation classes of an abstraction.
- You want to layer your subsystems — a facade defines a clean entry point per layer, decoupling layers from each other's internals.

## Structure
```
Client ---uses---> Facade -----coordinates-----> SubsystemA
                                              \--> SubsystemB
                                              \--> SubsystemC
```

## Participants
| Role | Responsibility |
|---|---|
| `Facade` | Knows which subsystem classes are responsible for a request and delegates client requests to the right objects, in the right order. |
| `Subsystem classes` | Implement subsystem functionality; have no knowledge of the facade and can be used directly by clients that need finer control. |
| `Client` | Uses the `Facade` for common tasks, and can still reach subsystem classes directly for advanced/uncommon needs. |

## Basic Implementation
```python
class Amplifier:
    def on(self) -> None: print("Amplifier on")
    def set_volume(self, level: int) -> None: print(f"Volume set to {level}")


class DVDPlayer:
    def on(self) -> None: print("DVD player on")
    def play(self, movie: str) -> None: print(f"Playing '{movie}'")


class Projector:
    def on(self) -> None: print("Projector on")
    def set_input(self, source: str) -> None: print(f"Projector input: {source}")


class Lights:
    def dim(self, level: int) -> None: print(f"Lights dimmed to {level}%")


class HomeTheaterFacade:
    """Simplifies coordinating several subsystem objects."""

    def __init__(self) -> None:
        self.amp = Amplifier()
        self.dvd = DVDPlayer()
        self.projector = Projector()
        self.lights = Lights()

    def watch_movie(self, movie: str) -> None:
        print("Get ready to watch a movie...")
        self.lights.dim(10)
        self.projector.on()
        self.projector.set_input("DVD")
        self.amp.on()
        self.amp.set_volume(7)
        self.dvd.on()
        self.dvd.play(movie)


theater = HomeTheaterFacade()
theater.watch_movie("The Matrix")
```

## Real-World Example: Order Placement Facade

Turning the motivating scenario into working code, including the error-handling path (releasing reserved inventory on payment failure) that's so easy to get inconsistent without a facade.

```python
from __future__ import annotations
from dataclasses import dataclass


@dataclass
class Customer:
    name: str
    email: str
    address: str


class InventoryService:
    def __init__(self) -> None:
        self._stock = {"widget": 50, "gadget": 5}

    def check_stock(self, item: str, qty: int) -> bool:
        return self._stock.get(item, 0) >= qty

    def reserve(self, item: str, qty: int) -> None:
        self._stock[item] -= qty
        print(f"[Inventory] Reserved {qty}x {item} (remaining: {self._stock[item]})")

    def release(self, item: str, qty: int) -> None:
        self._stock[item] += qty
        print(f"[Inventory] Released {qty}x {item} back to stock")


class PaymentGateway:
    def charge(self, customer: Customer, amount: float) -> bool:
        print(f"[Payment] Charging {customer.name} ${amount:.2f}...")
        success = amount <= 500   # simulate a simple decline rule
        print(f"[Payment] {'Approved' if success else 'Declined'}")
        return success


class ShippingService:
    def schedule(self, address: str, item: str, qty: int) -> str:
        tracking_id = f"TRK-{hash((address, item, qty)) % 100000:05d}"
        print(f"[Shipping] Scheduled {qty}x {item} to {address} (tracking: {tracking_id})")
        return tracking_id


class NotificationService:
    def send(self, email: str, message: str) -> None:
        print(f"[Notify] -> {email}: {message}")


class OrderFacade:
    """Single, simple entry point that coordinates four subsystems correctly."""

    def __init__(self) -> None:
        self.inventory = InventoryService()
        self.payment = PaymentGateway()
        self.shipping = ShippingService()
        self.notifications = NotificationService()

    def place_order(self, customer: Customer, item: str, qty: int, unit_price: float) -> bool:
        if not self.inventory.check_stock(item, qty):
            self.notifications.send(customer.email, f"Sorry, {item} is out of stock.")
            return False

        self.inventory.reserve(item, qty)
        amount = qty * unit_price

        if not self.payment.charge(customer, amount):
            self.inventory.release(item, qty)   # correctly undone, every single time
            self.notifications.send(customer.email, "Payment failed. Your order was cancelled.")
            return False

        tracking_id = self.shipping.schedule(customer.address, item, qty)
        self.notifications.send(
            customer.email,
            f"Order confirmed! {qty}x {item} is on its way (tracking: {tracking_id}).",
        )
        return True


order_system = OrderFacade()
alice = Customer("Alice", "alice@example.com", "123 Main St")

print("--- Order 1: succeeds ---")
order_system.place_order(alice, "widget", qty=4, unit_price=10.0)

print("\n--- Order 2: payment declined, inventory correctly released ---")
order_system.place_order(alice, "widget", qty=2, unit_price=300.0)

print("\n--- Order 3: out of stock ---")
order_system.place_order(alice, "gadget", qty=10, unit_price=50.0)
```

The facade guarantees the inventory-release-on-failure logic runs **exactly once, correctly**, no matter how many places in the app call `place_order()` — that consistency guarantee is the real value Facade brings beyond just "fewer lines at the call site."

## Implementation Notes
- A facade should **simplify**, not **restrict** — keep subsystem classes (`InventoryService`, `PaymentGateway`, etc.) public and independently usable for the rare caller that needs finer-grained control (e.g., an admin tool that manually adjusts inventory).
- Resist the urge to add business logic that doesn't belong to orchestration into the facade itself — it should coordinate subsystems, not reimplement their responsibilities.
- A facade is a great place to centralize **cross-cutting error handling** (like the inventory release above) that's easy to get inconsistent when duplicated across call sites.

## Consequences

**Pros**
- Isolates client code from subsystem complexity and its correct call ordering.
- Promotes weak coupling between subsystem and clients.
- Doesn't prevent advanced clients from accessing subsystem classes directly when needed.

**Cons**
- A facade can become a "god object" coupled to every class in the subsystem if its scope isn't kept intentionally narrow.

## Common Pitfalls
- Letting the facade accumulate unrelated responsibilities over time until it becomes a dumping ground for miscellaneous logic — keep it focused on orchestration.
- Hiding subsystem classes entirely (making them private) so advanced callers who genuinely need finer control have no way to get it.

## Real-World Examples
- `requests.get(url)` hides socket handling, connection pooling, redirects, etc.
- ORM `save()` methods hiding SQL generation, connection management, and transaction handling.
- Checkout/order-placement flows coordinating inventory, payment, shipping, and notifications, as shown above.

## Related Patterns
- [Adapter](../structural/adapter.md) — Adapter makes an *existing* interface usable; Facade defines a *new*, simplified one over several classes.
- [Mediator](../behavioral/mediator.md) — similar centralizing role, but Mediator adds new peer-to-peer behavior between colleagues, while Facade just simplifies access to an existing subsystem.
- [Singleton](../creational/singleton.md) — facades are frequently implemented as singletons since one facade instance is usually enough.
