# State

**Category:** Behavioral
**Also known as:** Objects for States

## Intent
Allow an object to alter its behavior when its internal state changes. The object will appear to change its class.

## Motivation
An order-processing system needs different behavior depending on the order's current status — a `Draft` order can be edited and submitted; a `Submitted` order can be approved or rejected but not edited; a `Shipped` order can't be cancelled at all. Modeling this with a status flag and conditionals spreads the same tangled logic across every method:

```python
class Order:
    def submit(self):
        if self.status == "draft":
            self.status = "submitted"
        else:
            raise InvalidTransition(f"Cannot submit from {self.status}")

    def cancel(self):
        if self.status in ("draft", "submitted"):
            self.status = "cancelled"
        elif self.status == "shipped":
            raise InvalidTransition("Cannot cancel a shipped order")
        # every method needs its own copy of this branching, and it's easy for
        # two methods to quietly disagree about which transitions are legal
```

Every operation repeats its own version of "which states allow this?", and there's no single place that defines the order's complete state machine — the rules are smeared across every method, drifting out of sync as the code evolves.

State fixes this by giving each status its own class implementing a shared interface. The `Order` (Context) simply delegates every operation to its current state object, which alone decides what's legal and what state comes next — the full state machine becomes visible, one class per state, instead of scattered conditionals.

## Applicability — When to Use
- An object's behavior depends on its state and must change its behavior at runtime depending on that state.
- Operations have large, multipart conditional statements that depend on the object's state, and those branches change together.
- State transitions should be explicit, easy to extend, and independently testable.

## Structure
```
Context                     State (interface)
  - state: State               + handle(context)
  + request()                       ^
       | delegates to               |
       v                    ConcreteStateA / B / C
   state.handle(self)       (each may transition context to a new state)
```

## Participants
| Role | Responsibility |
|---|---|
| `Context` | Holds a reference to the current `State`; delegates state-specific requests to it. |
| `State` | Declares the interface encapsulating behavior associated with a state of the `Context`. |
| `ConcreteState` | Implements behavior specific to one state, and decides which state (if any) follows it. |

## Basic Implementation
```python
from __future__ import annotations
from abc import ABC, abstractmethod


class TrafficLightState(ABC):
    @abstractmethod
    def next(self, light: "TrafficLight") -> None: ...

    @abstractmethod
    def name(self) -> str: ...


class RedState(TrafficLightState):
    def next(self, light: "TrafficLight") -> None:
        light.state = GreenState()

    def name(self) -> str:
        return "RED"


class GreenState(TrafficLightState):
    def next(self, light: "TrafficLight") -> None:
        light.state = YellowState()

    def name(self) -> str:
        return "GREEN"


class YellowState(TrafficLightState):
    def next(self, light: "TrafficLight") -> None:
        light.state = RedState()

    def name(self) -> str:
        return "YELLOW"


class TrafficLight:
    """Context"""

    def __init__(self) -> None:
        self.state: TrafficLightState = RedState()

    def change(self) -> None:
        print(f"{self.state.name()} -> ", end="")
        self.state.next(self)
        print(self.state.name())


light = TrafficLight()
for _ in range(4):
    light.change()
```

## Real-World Example: Order Workflow State Machine

This turns the motivating scenario into a complete, correctly-encapsulated state machine: each order status is its own class, each one explicitly declares which operations it allows, and illegal transitions raise a clear error instead of silently corrupting state.

```python
from __future__ import annotations
from abc import ABC, abstractmethod


class InvalidTransition(Exception):
    pass


class OrderState(ABC):
    """Every method has a safe default: 'not allowed from this state'."""

    def submit(self, order: "Order") -> None:
        raise InvalidTransition(f"Cannot submit an order in '{self.name}' state")

    def approve(self, order: "Order") -> None:
        raise InvalidTransition(f"Cannot approve an order in '{self.name}' state")

    def ship(self, order: "Order") -> None:
        raise InvalidTransition(f"Cannot ship an order in '{self.name}' state")

    def cancel(self, order: "Order") -> None:
        raise InvalidTransition(f"Cannot cancel an order in '{self.name}' state")

    @property
    @abstractmethod
    def name(self) -> str: ...


class DraftState(OrderState):
    name = "draft"

    def submit(self, order: "Order") -> None:
        print(f"  Order {order.order_id}: draft -> submitted")
        order.state = SubmittedState()

    def cancel(self, order: "Order") -> None:
        print(f"  Order {order.order_id}: draft -> cancelled")
        order.state = CancelledState()


class SubmittedState(OrderState):
    name = "submitted"

    def approve(self, order: "Order") -> None:
        print(f"  Order {order.order_id}: submitted -> approved")
        order.state = ApprovedState()

    def cancel(self, order: "Order") -> None:
        print(f"  Order {order.order_id}: submitted -> cancelled")
        order.state = CancelledState()


class ApprovedState(OrderState):
    name = "approved"

    def ship(self, order: "Order") -> None:
        print(f"  Order {order.order_id}: approved -> shipped")
        order.state = ShippedState()

    def cancel(self, order: "Order") -> None:
        print(f"  Order {order.order_id}: approved -> cancelled")
        order.state = CancelledState()


class ShippedState(OrderState):
    name = "shipped"
    # No transitions allowed out of 'shipped' — every method uses the base class's
    # default, which correctly raises InvalidTransition for submit/approve/ship/cancel.


class CancelledState(OrderState):
    name = "cancelled"
    # A terminal state — same story, nothing is legal from here either.


class Order:
    """Context: delegates every operation to its current state object."""

    def __init__(self, order_id: str) -> None:
        self.order_id = order_id
        self.state: OrderState = DraftState()

    def submit(self) -> None:
        self.state.submit(self)

    def approve(self) -> None:
        self.state.approve(self)

    def ship(self) -> None:
        self.state.ship(self)

    def cancel(self) -> None:
        self.state.cancel(self)

    @property
    def status(self) -> str:
        return self.state.name


order = Order("ORD-1001")
print("Status:", order.status)

order.submit()
print("Status:", order.status)

order.approve()
print("Status:", order.status)

order.ship()
print("Status:", order.status)

print("\n--- Attempting an illegal transition ---")
try:
    order.cancel()   # shipped orders cannot be cancelled
except InvalidTransition as e:
    print("Rejected:", e)

print("\n--- A second order, cancelled early ---")
order2 = Order("ORD-1002")
order2.submit()
order2.cancel()
print("Status:", order2.status)
```

Every legal transition — and, just as importantly, every **illegal** one — is now defined in exactly one place per state, and `ShippedState`/`CancelledState` get correct "nothing is allowed here" behavior for free just by inheriting the base class's defaults, without writing a single explicit `if` statement anywhere in `Order`.

## Implementation Notes
- Giving `OrderState` sensible **default implementations that raise** (rather than making every method abstract) lets terminal/restrictive states like `ShippedState` and `CancelledState` be defined with almost no code — they inherit "not allowed" for free and only need to override what they actually support.
- State objects here are stateless themselves (no per-instance data), so they could safely be shared as [Flyweight](../structural/flyweight.md)/module-level singletons instead of instantiated fresh on every transition — a worthwhile optimization once a state machine sees heavy traffic.
- Keep transition logic **inside** the state classes (`order.state = SubmittedState()`), not in the `Context`'s public methods — that's what keeps the full state machine's rules colocated with each state instead of leaking back into `Order`.

## Consequences

**Pros**
- Organizes state-specific code into separate classes (Single Responsibility) instead of scattering conditionals.
- Eliminates bulky, duplicated conditional statements across every method.
- Makes state transitions explicit and easy to extend (Open/Closed) — a new state is a new class, not an edit to existing ones.

**Cons**
- Can be overkill for a state machine with very few states that rarely changes — a single status flag with one `if` might be perfectly fine.
- Increases the number of classes in the codebase, one per state.

## Common Pitfalls
- Forgetting to define a safe default for "operation not allowed" in the base `State` class, leaving some states with silently missing behavior instead of a clear error.
- Letting the `Context` (not the `State` objects) decide the next state — this defeats the pattern's purpose and drags the tangled conditional logic right back into the context class.

## Real-World Examples
- Order/document workflow states (`Draft` → `Submitted` → `Approved` → `Shipped`)
- TCP connection states
- Media player states (`Playing`, `Paused`, `Stopped`)

## Related Patterns
- [Strategy](#) — nearly identical structure, but Strategy's algorithm is chosen by the *client* and stays fixed, while State's transitions happen *automatically*, driven by the state objects themselves.
- [Singleton](../creational/singleton.md) — stateless State objects can safely be shared as singletons.
- [Flyweight](../structural/flyweight.md) — shared, stateless State instances behave like flyweights.
