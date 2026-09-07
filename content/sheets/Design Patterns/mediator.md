# Mediator

**Category:** Behavioral
**Also known as:** Controller

## Intent
Define an object that encapsulates how a set of objects interact. Mediator promotes loose coupling by keeping objects from referring to each other explicitly, letting you vary their interaction independently.

## Motivation
A signup form has fields that affect one another: checking "Ship to billing address" should disable the shipping-address fields; selecting "Business account" should reveal a Tax ID field; submitting should be disabled until required fields are valid. Wiring these relationships directly between widgets doesn't scale:

```python
class ShipToBillingCheckbox:
    def on_change(self, checked):
        shipping_address_field.set_enabled(not checked)
        submit_button.update_state()   # every widget now needs a reference to every other widget it affects

class AccountTypeDropdown:
    def on_change(self, value):
        tax_id_field.set_visible(value == "business")
        submit_button.update_state()
```

Every widget ends up holding direct references to several other widgets, and that web of references only gets worse as more fields and rules are added — reusing any one widget elsewhere means dragging its whole tangle of dependencies along with it.

Mediator breaks this apart: widgets talk only to a central `FormMediator`, never to each other directly. Each widget notifies the mediator "I changed," and the mediator alone decides what that means for the rest of the form.

## Applicability — When to Use
- A set of objects communicate in complex, well-defined ways, and the resulting interdependencies are unstructured and hard to follow.
- Reusing an object is difficult because it refers to and communicates with many other objects.
- You want to customize behavior distributed across several classes without excessive subclassing.

## Structure
```
Colleague A --\                 /--> Colleague B
               >--> Mediator <--
Colleague C --/                 \--> Colleague D
```

## Participants
| Role | Responsibility |
|---|---|
| `Mediator` | Declares an interface for communicating with `Colleague` objects. |
| `ConcreteMediator` | Implements cooperative behavior by coordinating `Colleague` objects; knows and maintains its colleagues. |
| `Colleague` | Communicates with its mediator whenever it would otherwise have communicated with another colleague directly. |

## Basic Implementation
```python
from __future__ import annotations
from abc import ABC, abstractmethod


class ChatMediator(ABC):
    @abstractmethod
    def send(self, message: str, sender: "User") -> None: ...


class ChatRoom(ChatMediator):
    def __init__(self) -> None:
        self._users: list[User] = []

    def register(self, user: "User") -> None:
        self._users.append(user)

    def send(self, message: str, sender: "User") -> None:
        for user in self._users:
            if user is not sender:
                user.receive(message, sender.name)


class User:
    def __init__(self, name: str, mediator: ChatMediator) -> None:
        self.name = name
        self._mediator = mediator

    def send(self, message: str) -> None:
        print(f"{self.name} sends: {message}")
        self._mediator.send(message, self)

    def receive(self, message: str, sender_name: str) -> None:
        print(f"  {self.name} received from {sender_name}: {message}")


room = ChatRoom()
alice = User("Alice", room)
bob = User("Bob", room)
carol = User("Carol", room)
room.register(alice)
room.register(bob)
room.register(carol)

alice.send("Hey everyone!")
```

## Real-World Example: Signup Form Field Coordination

This turns the motivating scenario into working code: form widgets that only ever talk to a `FormMediator`, which alone knows the cross-field rules — checkbox state disabling fields, dropdown selection revealing fields, and overall form validity gating the submit button.

```python
from __future__ import annotations
from abc import ABC, abstractmethod


class FormMediator(ABC):
    @abstractmethod
    def notify(self, sender: "FormComponent", event: str) -> None: ...


class FormComponent(ABC):
    def __init__(self, mediator: "SignupFormMediator") -> None:
        self.mediator = mediator
        self.enabled = True
        self.visible = True


class Checkbox(FormComponent):
    def __init__(self, mediator: "SignupFormMediator", label: str) -> None:
        super().__init__(mediator)
        self.label = label
        self.checked = False

    def toggle(self) -> None:
        self.checked = not self.checked
        print(f"[{self.label}] checked = {self.checked}")
        self.mediator.notify(self, "toggled")


class Dropdown(FormComponent):
    def __init__(self, mediator: "SignupFormMediator", label: str, options: list[str]) -> None:
        super().__init__(mediator)
        self.label = label
        self.options = options
        self.value = options[0]

    def select(self, value: str) -> None:
        self.value = value
        print(f"[{self.label}] selected = {value}")
        self.mediator.notify(self, "selected")


class TextField(FormComponent):
    def __init__(self, mediator: "SignupFormMediator", label: str, required: bool = False) -> None:
        super().__init__(mediator)
        self.label = label
        self.required = required
        self.text = ""

    def set_text(self, value: str) -> None:
        self.text = value
        state = "hidden" if not self.visible else ("disabled" if not self.enabled else "editable")
        print(f"[{self.label}] ({state}) text = {value!r}")
        self.mediator.notify(self, "text_changed")

    def is_valid(self) -> bool:
        return not (self.required and self.visible and self.enabled and not self.text)


class Button(FormComponent):
    def __init__(self, mediator: "SignupFormMediator", label: str) -> None:
        super().__init__(mediator)
        self.label = label

    def set_enabled(self, enabled: bool) -> None:
        if enabled != self.enabled:
            self.enabled = enabled
            print(f"[{self.label}] enabled = {enabled}")


class SignupFormMediator(FormMediator):
    """Owns every cross-field rule. Widgets know nothing about each other."""

    def __init__(self) -> None:
        self.ship_to_billing = Checkbox(self, "Ship to billing address")
        self.shipping_address = TextField(self, "Shipping address", required=True)
        self.account_type = Dropdown(self, "Account type", ["personal", "business"])
        self.tax_id = TextField(self, "Tax ID", required=True)
        self.tax_id.visible = False
        self.submit_button = Button(self, "Submit")
        self._refresh_submit_state()

    def notify(self, sender: FormComponent, event: str) -> None:
        if sender is self.ship_to_billing and event == "toggled":
            self.shipping_address.enabled = not self.ship_to_billing.checked
            print(f"  -> shipping address enabled: {self.shipping_address.enabled}")

        elif sender is self.account_type and event == "selected":
            self.tax_id.visible = self.account_type.value == "business"
            print(f"  -> tax ID field visible: {self.tax_id.visible}")

        self._refresh_submit_state()

    def _refresh_submit_state(self) -> None:
        required_fields = [self.shipping_address, self.tax_id]
        all_valid = all(field.is_valid() for field in required_fields)
        self.submit_button.set_enabled(all_valid)


form = SignupFormMediator()

print("\n--- User checks 'business' account ---")
form.account_type.select("business")

print("\n--- User fills shipping address ---")
form.shipping_address.set_text("123 Main St")

print("\n--- User fills tax ID (now required and visible) ---")
form.tax_id.set_text("TAX-99182")

print("\n--- User checks 'ship to billing address' ---")
form.ship_to_billing.toggle()   # disables shipping_address; mediator re-checks validity
```

No widget above ever references another widget — `Checkbox` doesn't know `TextField` exists, and `Dropdown` doesn't know about `Button`. Every cross-field rule lives in exactly one place, `SignupFormMediator.notify()`, which is precisely where you'd look to understand or change the form's behavior.

## Implementation Notes
- The mediator inevitably becomes the most complex class in the system — that's expected and intentional. The goal isn't to eliminate complexity, but to **concentrate** it in one well-understood place instead of scattering it across many tangled widget-to-widget references.
- Watch the mediator's size over time: if `notify()` grows into an enormous, unreadable `if/elif` chain, consider splitting into multiple smaller mediators by feature area, or extracting individual rules into their own small rule-objects the mediator delegates to.
- Combine naturally with [Observer](../behavioral/observer.md): colleagues can "subscribe" to the mediator instead of the mediator manually enumerating them, if the set of colleagues changes dynamically.

## Consequences

**Pros**
- Reduces coupling between colleague classes — each only needs to know about the mediator, not each other.
- Centralizes control, making cross-object interaction logic easier to understand, test, and modify in one place.
- Turns many-to-many communication into one-to-many, simplifying each colleague's own protocol.

**Cons**
- The mediator itself can grow into a "god object" that's complex and hard to maintain if it absorbs too much unrelated logic.

## Common Pitfalls
- Letting colleagues bypass the mediator "just this once" for a direct reference — this immediately reintroduces the tangled coupling Mediator exists to prevent.
- Cramming unrelated concerns (validation, styling, network calls) into the mediator instead of keeping it focused purely on coordination.

## Real-World Examples
- Chat room / message broker systems
- Air traffic control coordinating planes without planes talking to each other directly
- UI dialog/form controllers coordinating widget interactions, as shown above

## Related Patterns
- [Facade](../structural/facade.md) — Facade abstracts a subsystem's interface (usually one-directional, client-to-subsystem); Mediator enables arbitrary many-to-many communication between colleagues that all know about the mediator.
- [Observer](../behavioral/observer.md) — a Mediator often uses Observer internally to notify colleagues of state changes.
- [Chain of Responsibility](../behavioral/chain-of-responsibility.md) — both decouple senders/receivers, but CoR passes a request linearly while Mediator routes through a central hub.
