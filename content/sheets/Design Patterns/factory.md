# Factory

**Category:** Creational
**Also known as:** Virtual Constructor

## Intent

Define an interface for creating an object, but let subclasses decide which class to instantiate. Factory Method lets a class defer instantiation to subclasses.

## Motivation

Direct object creation (`SomeClass()`) hardwires your code to one concrete class. That's fine until you need variants:

```python
def export_report(data, fmt):
    if fmt == "pdf":
        exporter = PDFExporter()
    elif fmt == "csv":
        exporter = CSVExporter()
    elif fmt == "html":
        exporter = HTMLExporter()
    # every new format means editing this function again
    return exporter.export(data)
```

This `if/elif` ladder violates the Open/Closed Principle: adding a new export format means modifying existing, already-tested code. Worse, this decision logic tends to get duplicated at every call site that needs an exporter.

Factory Method fixes this by pushing the "which concrete class?" decision into an overridable method, so each variant lives in its own small, focused class, and the calling code depends only on an abstract interface.

## Applicability — When to Use

- A class can't anticipate the exact class of objects it must create ahead of time.
- You want subclasses to specify the objects they create, rather than the base class deciding.
- You want to give users of a library/framework an extension point for its internal object creation, without forcing them to subclass the whole framework.

## Structure

```
Creator                       Product
+ factory_method(): Product   (interface)
+ some_operation()               ^
      ^                          |
      |                    ConcreteProduct
ConcreteCreator
+ factory_method(): ConcreteProduct
```

## Participants

| Role              | Responsibility                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `Product`         | The common interface for objects the factory method creates.                                                                           |
| `ConcreteProduct` | A specific implementation of `Product`.                                                                                                |
| `Creator`         | Declares the factory method and usually contains business logic that relies on `Product` objects, without knowing their concrete type. |
| `ConcreteCreator` | Overrides the factory method to return a specific `ConcreteProduct`.                                                                   |

## Basic Implementation

```python
from abc import ABC, abstractmethod


class Transport(ABC):
    @abstractmethod
    def deliver(self) -> str: ...


class Truck(Transport):
    def deliver(self) -> str:
        return "Delivering by road in a truck"


class Ship(Transport):
    def deliver(self) -> str:
        return "Delivering by sea in a ship"


class Logistics(ABC):
    """Creator"""

    @abstractmethod
    def create_transport(self) -> Transport:
        """The factory method"""
        ...

    def plan_delivery(self) -> str:
        transport = self.create_transport()
        return transport.deliver()


class RoadLogistics(Logistics):
    def create_transport(self) -> Transport:
        return Truck()


class SeaLogistics(Logistics):
    def create_transport(self) -> Transport:
        return Ship()


for logistics in (RoadLogistics(), SeaLogistics()):
    print(logistics.plan_delivery())
```

## Real-World Example: Pluggable Notification System

A common production need: send notifications through different channels (email, SMS, push) chosen at runtime by configuration, with the ability for third-party plugins to register new channels **without editing this file**.

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class Notification:
    recipient: str
    subject: str
    body: str


class NotificationSender(ABC):
    """Product interface"""

    @abstractmethod
    def send(self, notification: Notification) -> bool: ...


class EmailSender(NotificationSender):
    def send(self, notification: Notification) -> bool:
        print(f"[EMAIL] to={notification.recipient} subject={notification.subject!r}")
        print(f"        {notification.body}")
        return True


class SMSSender(NotificationSender):
    def send(self, notification: Notification) -> bool:
        # SMS has no subject line — squeeze it into the body
        text = f"{notification.subject}: {notification.body}"[:160]
        print(f"[SMS] to={notification.recipient} text={text!r}")
        return True


class PushSender(NotificationSender):
    def send(self, notification: Notification) -> bool:
        print(f"[PUSH] to={notification.recipient} title={notification.subject!r}")
        return True


class NotifierCreator(ABC):
    """Creator: defines the workflow, defers the 'which sender?' decision."""

    @abstractmethod
    def create_sender(self) -> NotificationSender:
        """The factory method"""
        ...

    def notify(self, recipient: str, subject: str, body: str) -> bool:
        sender = self.create_sender()          # factory method call
        notification = Notification(recipient, subject, body)
        success = sender.send(notification)
        self._log(success, notification)
        return success

    def _log(self, success: bool, notification: Notification) -> None:
        status = "OK" if success else "FAILED"
        print(f"  -> delivery {status} for {notification.recipient}")


class EmailNotifier(NotifierCreator):
    def create_sender(self) -> NotificationSender:
        return EmailSender()


class SMSNotifier(NotifierCreator):
    def create_sender(self) -> NotificationSender:
        return SMSSender()


class PushNotifier(NotifierCreator):
    def create_sender(self) -> NotificationSender:
        return PushSender()


# A small registry lets new channels be "plugged in" via config,
# without ever touching this dispatch code again.
NOTIFIER_REGISTRY: dict[str, type[NotifierCreator]] = {
    "email": EmailNotifier,
    "sms": SMSNotifier,
    "push": PushNotifier,
}


def send_via(channel: str, recipient: str, subject: str, body: str) -> bool:
    notifier_cls = NOTIFIER_REGISTRY[channel]
    return notifier_cls().notify(recipient, subject, body)


send_via("email", "alice@example.com", "Order Shipped", "Your order #123 has shipped.")
send_via("sms", "+1-555-0100", "Order Shipped", "Your order #123 has shipped.")
```

Notice `notify()` — the shared workflow in `NotifierCreator` — never knows or cares which concrete `NotificationSender` it's using. New channels (Slack, WhatsApp, webhook) are added by writing one new `NotifierCreator`/`NotificationSender` pair and registering it, with **zero changes** to existing, tested code — exactly the Open/Closed benefit Factory Method is designed to deliver.

## Implementation Notes

- In Python, a **module-level function** or a `classmethod` is often a lighter-weight substitute for a full Creator class hierarchy — reach for the full pattern when the _rest_ of the Creator's behavior (like `notify()`/`plan_delivery()` above) is substantial and shared.
- A **registry dict** (as in the example) is a very common, idiomatic Python complement to Factory Method — it turns "add a new subclass" into "add a new subclass + one registry entry," and enables plugin-style extension without touching dispatch logic.
- Careful not to conflate this with the plain **"factory function"** idiom (a function that just returns different objects based on a parameter) — that's a simpler, non-polymorphic cousin, useful for smaller cases where a full Creator/Product hierarchy would be overkill.

## Consequences

**Pros**

- Avoids tight coupling between creator and concrete products.
- Single Responsibility — object-creation code is isolated in one place per variant.
- Open/Closed — new product types are added via new classes, not edits to existing ones.

**Cons**

- Requires creating a new subclass for every new product type, which can add many small classes for simple variations.

## Common Pitfalls

- Introducing Factory Method when a simple `if/else` or dict-based factory function would be perfectly readable — don't reach for class hierarchies until variation and shared behavior justify them.
- Forgetting to make the factory method abstract/required — if `ConcreteCreator` forgets to override it, you get a confusing runtime error instead of a clear contract violation.

## Real-World Examples

- `logging.getLogger()` returns differently configured loggers depending on context.
- Document editors that create different document types (`Word`, `PDF`) via a common `create_document()` method.
- Django's `forms.ModelForm` metaclass deciding which field class to instantiate per model field type.

## Related Patterns

- [Abstract Factory](../creational/abstract-factory.md) — often implemented using a set of Factory Methods, one per product in the family.
- [Prototype](../creational/prototype.md) — an alternative to Factory Method when creation is expensive and cloning is cheaper.
- [Template Method](#) — Factory Method is a specialization of Template Method focused specifically on object creation.
