# Bridge

**Category:** Structural
**Also known as:** Handle/Body

## Intent
Decouple an abstraction from its implementation so the two can vary independently.

## Motivation
Imagine a `Notification` abstraction (`Alert`, `Reminder`, `Digest`) that must be delivered through multiple channels (`Email`, `SMS`, `Push`). Modeling this with plain inheritance quickly explodes:

```python
class AlertEmail(Notification): ...
class AlertSMS(Notification): ...
class AlertPush(Notification): ...
class ReminderEmail(Notification): ...
class ReminderSMS(Notification): ...
class ReminderPush(Notification): ...
class DigestEmail(Notification): ...
# ... 3 notification types x 3 channels = 9 classes, and growing multiplicatively
```

Every new notification type multiplies by every existing channel, and vice versa. The two dimensions of variation — *what kind of message* and *how it's delivered* — are fundamentally independent, but inheritance forces them into one combined hierarchy.

Bridge splits this into two separate, small hierarchies connected by composition: a `Notification` abstraction that *has a* `Channel`, instead of *is a* channel-specific subclass. Now `3 + 3` classes replace `3 x 3`.

## Applicability — When to Use
- You want to avoid a permanent binding between an abstraction and its implementation (e.g., to switch implementations at runtime).
- Both the abstraction and its implementation should be independently extensible via subclasses.
- Changes in the implementation should have no impact on client code using the abstraction.
- You're facing a combinatorial explosion of subclasses from two or more independent dimensions of variation.

## Structure
```
Abstraction ------has-a-----> Implementor (interface)
     ^                              ^
     |                              |
RefinedAbstraction          ConcreteImplementorA / B
```

## Participants
| Role | Responsibility |
|---|---|
| `Abstraction` | Defines the high-level control interface; holds a reference to an `Implementor`. |
| `RefinedAbstraction` | Extends the abstraction's interface with more specific variants. |
| `Implementor` | Declares the low-level, primitive operations the abstraction is built on. |
| `ConcreteImplementor` | Implements the `Implementor` interface for one specific platform/technology. |

## Basic Implementation
```python
from abc import ABC, abstractmethod


# Implementor hierarchy
class Renderer(ABC):
    @abstractmethod
    def render_circle(self, radius: float) -> str: ...


class VectorRenderer(Renderer):
    def render_circle(self, radius: float) -> str:
        return f"Drawing a vector circle of radius {radius}"


class RasterRenderer(Renderer):
    def render_circle(self, radius: float) -> str:
        return f"Drawing pixels for a circle of radius {radius}"


# Abstraction hierarchy
class Shape(ABC):
    def __init__(self, renderer: Renderer) -> None:
        self.renderer = renderer

    @abstractmethod
    def draw(self) -> str: ...


class Circle(Shape):
    def __init__(self, renderer: Renderer, radius: float) -> None:
        super().__init__(renderer)
        self.radius = radius

    def draw(self) -> str:
        return self.renderer.render_circle(self.radius)

    def resize(self, factor: float) -> None:
        self.radius *= factor


c1 = Circle(VectorRenderer(), 5)
c2 = Circle(RasterRenderer(), 5)
print(c1.draw())
print(c2.draw())
```

## Real-World Example: Notifications × Delivery Channels

Extending the motivating example into working code: notification *types* (Abstraction) stay completely decoupled from delivery *channels* (Implementor), so either dimension can grow without touching the other.

```python
from __future__ import annotations
from abc import ABC, abstractmethod
from datetime import datetime


# --- Implementor hierarchy: HOW a message gets delivered ---
class Channel(ABC):
    @abstractmethod
    def deliver(self, recipient: str, subject: str, body: str) -> None: ...


class EmailChannel(Channel):
    def deliver(self, recipient: str, subject: str, body: str) -> None:
        print(f"[EMAIL -> {recipient}] {subject}\n  {body}")


class SMSChannel(Channel):
    def deliver(self, recipient: str, subject: str, body: str) -> None:
        text = f"{subject}: {body}"[:160]
        print(f"[SMS -> {recipient}] {text}")


class PushChannel(Channel):
    def deliver(self, recipient: str, subject: str, body: str) -> None:
        print(f"[PUSH -> {recipient}] {subject}")


# --- Abstraction hierarchy: WHAT kind of message it is ---
class Notification(ABC):
    def __init__(self, channel: Channel) -> None:
        self._channel = channel   # the bridge to the implementor

    @abstractmethod
    def send(self, recipient: str) -> None: ...


class AlertNotification(Notification):
    """High-priority, immediate notification."""

    def __init__(self, channel: Channel, message: str) -> None:
        super().__init__(channel)
        self.message = message

    def send(self, recipient: str) -> None:
        self._channel.deliver(recipient, subject="⚠ ALERT", body=self.message)


class ReminderNotification(Notification):
    """Scheduled, lower-priority notification."""

    def __init__(self, channel: Channel, task: str, due: datetime) -> None:
        super().__init__(channel)
        self.task = task
        self.due = due

    def send(self, recipient: str) -> None:
        body = f"'{self.task}' is due {self.due:%Y-%m-%d %H:%M}"
        self._channel.deliver(recipient, subject="Reminder", body=body)


class DigestNotification(Notification):
    """Batched summary of multiple events."""

    def __init__(self, channel: Channel, items: list[str]) -> None:
        super().__init__(channel)
        self.items = items

    def send(self, recipient: str) -> None:
        body = "; ".join(self.items)
        self._channel.deliver(recipient, subject=f"Daily Digest ({len(self.items)} items)", body=body)


# Any notification type can use any channel — 3 + 3 classes, not 3 x 3.
notifications: list[tuple[Notification, str]] = [
    (AlertNotification(SMSChannel(), "Server CPU at 95%"), "+1-555-0100"),
    (ReminderNotification(EmailChannel(), "Submit report", datetime(2026, 9, 5, 17, 0)), "alice@example.com"),
    (DigestNotification(PushChannel(), ["3 new comments", "1 mention", "PR approved"]), "bob-device-42"),
    (AlertNotification(EmailChannel(), "Server CPU at 95%"), "ops@example.com"),  # same alert, different channel
]

for notification, recipient in notifications:
    notification.send(recipient)
```

Swapping `AlertNotification`'s channel from SMS to Email required **zero changes** to `AlertNotification` itself — that's the independent variation Bridge is designed to deliver. A new channel (Slack, webhook) or a new notification type (Warning) can each be added as a single new small class, without touching the other hierarchy at all.

## Implementation Notes
- The key tell that you need Bridge (vs. plain inheritance) is **two or more independent dimensions of variation** — if you catch yourself naming classes like `AlertEmail`, `AlertSMS`, `ReminderEmail`, that's the multiplicative-explosion smell.
- In Python, since types aren't enforced at compile time, it's tempting to skip the formal `Implementor` ABC — but keeping it explicit documents the contract and helps tooling/IDE autocompletion, especially as the number of concrete implementors grows.
- Bridge is a **structural** pattern about composition — don't confuse it with Adapter; Bridge is designed in from the start, Adapter is bolted on afterward to reconcile something pre-existing.

## Consequences

**Pros**
- Decouples interface from implementation — both can evolve independently.
- Avoids combinatorial subclass explosion across two or more dimensions of variation.
- Hides implementation details from the client, which only depends on the Abstraction.

**Cons**
- Adds indirection and up-front design complexity, which can be overkill for a class that isn't expected to grow multiple independent variants.

## Common Pitfalls
- Applying Bridge preemptively to classes that only vary along one dimension — wait for a second dimension of variation to actually appear before splitting the hierarchy.
- Letting the Abstraction reach into Implementor-specific details (breaking encapsulation) instead of relying solely on the `Implementor` interface.

## Real-World Examples
- GUI frameworks separating a cross-platform widget abstraction from platform-specific rendering engines.
- Database drivers where a `Connection` abstraction bridges to vendor-specific implementations.
- Notification/messaging systems separating message type from delivery channel, as shown above.

## Related Patterns
- [Adapter](../structural/adapter.md) — Bridge is designed up front for parallel hierarchies; Adapter is applied after the fact to reconcile incompatible interfaces.
- [Abstract Factory](../creational/abstract-factory.md) — can be used to create and configure a particular Bridge (e.g., picking a matched Abstraction + Implementor pair).
- [Strategy](#) — structurally similar (composition over inheritance), but Strategy focuses on interchangeable algorithms, not parallel class hierarchies.
