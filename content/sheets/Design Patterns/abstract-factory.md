# Abstract Factory

**Category:** Creational
**Also known as:** Kit

## Intent
Provide an interface for creating **families of related or dependent objects** without specifying their concrete classes.

## Motivation
Imagine building a payments module that must support multiple providers — say Stripe and PayPal — where each provider needs its own matching `PaymentGateway`, `Refunder`, and `Receipt` implementations. If you let client code mix and match:

```python
gateway = StripeGateway()
refunder = PayPalRefunder()   # oops — wrong provider!
```

...you get subtle, hard-to-catch bugs: a refund routed through the wrong provider's API will simply fail, or worse, silently do nothing. The families of objects (gateway, refunder, receipt formatter) for a single provider must always be used **together** — never mixed across providers.

Abstract Factory solves this by putting one factory method per product *inside a single factory interface per family*. Client code asks one factory object for everything it needs, so it's structurally impossible to accidentally mix providers.

## Applicability — When to Use
- A system must be independent of how its products are created, composed, and represented.
- A system should be configurable with one of multiple families of related products.
- You need to enforce, at the type level, that a family of related products is always used together.

## Structure
```
AbstractFactory                    AbstractProductA   AbstractProductB
+ create_product_a()                     ^                  ^
+ create_product_b()                     |                  |
      ^                          ProductA1/ProductA2  ProductB1/ProductB2
      |
WinFactory / MacFactory  -->  creates matching ProductA/ProductB variants
```

## Participants
| Role | Responsibility |
|---|---|
| `AbstractFactory` | Declares creation methods for each product in the family. |
| `ConcreteFactory` | Implements creation methods to produce one specific, mutually-compatible family of products. |
| `AbstractProduct` | Declares the interface for one kind of product object. |
| `ConcreteProduct` | A specific product produced by a specific factory, compatible only with its own family. |

## Basic Implementation
```python
from abc import ABC, abstractmethod


# --- Abstract products ---
class Button(ABC):
    @abstractmethod
    def render(self) -> str: ...


class Checkbox(ABC):
    @abstractmethod
    def render(self) -> str: ...


# --- Concrete products: Windows family ---
class WinButton(Button):
    def render(self) -> str:
        return "[ Windows Button ]"


class WinCheckbox(Checkbox):
    def render(self) -> str:
        return "[x] Windows Checkbox"


# --- Concrete products: macOS family ---
class MacButton(Button):
    def render(self) -> str:
        return "( macOS Button )"


class MacCheckbox(Checkbox):
    def render(self) -> str:
        return "(x) macOS Checkbox"


# --- Abstract factory ---
class GUIFactory(ABC):
    @abstractmethod
    def create_button(self) -> Button: ...

    @abstractmethod
    def create_checkbox(self) -> Checkbox: ...


class WinFactory(GUIFactory):
    def create_button(self) -> Button:
        return WinButton()

    def create_checkbox(self) -> Checkbox:
        return WinCheckbox()


class MacFactory(GUIFactory):
    def create_button(self) -> Button:
        return MacButton()

    def create_checkbox(self) -> Checkbox:
        return MacCheckbox()


def render_ui(factory: GUIFactory) -> None:
    print(factory.create_button().render())
    print(factory.create_checkbox().render())


render_ui(WinFactory())
render_ui(MacFactory())
```

## Real-World Example: Multi-Cloud Storage & Queue Provisioning

A backend that must deploy to either AWS or GCP needs a `BlobStorage` and a `MessageQueue` for each cloud — and it is critical that a GCP storage bucket is never paired with an AWS SQS queue by mistake. Abstract Factory enforces that pairing structurally.

```python
from abc import ABC, abstractmethod


# --- Abstract products ---
class BlobStorage(ABC):
    @abstractmethod
    def upload(self, key: str, data: bytes) -> str:
        """Returns a URI to the uploaded object."""


class MessageQueue(ABC):
    @abstractmethod
    def publish(self, topic: str, message: str) -> None: ...


# --- AWS family ---
class S3Storage(BlobStorage):
    def upload(self, key: str, data: bytes) -> str:
        print(f"[S3] Uploading {len(data)} bytes to bucket/{key}")
        return f"s3://my-bucket/{key}"


class SQSQueue(MessageQueue):
    def publish(self, topic: str, message: str) -> None:
        print(f"[SQS] Publishing to queue '{topic}': {message}")


# --- GCP family ---
class GCSStorage(BlobStorage):
    def upload(self, key: str, data: bytes) -> str:
        print(f"[GCS] Uploading {len(data)} bytes to bucket/{key}")
        return f"gs://my-bucket/{key}"


class PubSubQueue(MessageQueue):
    def publish(self, topic: str, message: str) -> None:
        print(f"[PubSub] Publishing to topic '{topic}': {message}")


# --- Abstract factory ---
class CloudProviderFactory(ABC):
    @abstractmethod
    def create_storage(self) -> BlobStorage: ...

    @abstractmethod
    def create_queue(self) -> MessageQueue: ...


class AWSProviderFactory(CloudProviderFactory):
    def create_storage(self) -> BlobStorage:
        return S3Storage()

    def create_queue(self) -> MessageQueue:
        return SQSQueue()


class GCPProviderFactory(CloudProviderFactory):
    def create_storage(self) -> BlobStorage:
        return GCSStorage()

    def create_queue(self) -> MessageQueue:
        return PubSubQueue()


class OrderProcessingService:
    """Client code — completely unaware of which cloud it's running on."""

    def __init__(self, factory: CloudProviderFactory) -> None:
        self.storage = factory.create_storage()
        self.queue = factory.create_queue()

    def process_order(self, order_id: str, payload: bytes) -> None:
        uri = self.storage.upload(f"orders/{order_id}.json", payload)
        self.queue.publish("order-events", f"Order {order_id} stored at {uri}")


def get_factory(cloud: str) -> CloudProviderFactory:
    factories: dict[str, type[CloudProviderFactory]] = {
        "aws": AWSProviderFactory,
        "gcp": GCPProviderFactory,
    }
    return factories[cloud]()


# Deployment config picks the family once — everything downstream is consistent.
service = OrderProcessingService(get_factory("aws"))
service.process_order("1001", b'{"item": "widget", "qty": 3}')

service_gcp = OrderProcessingService(get_factory("gcp"))
service_gcp.process_order("1002", b'{"item": "gadget", "qty": 1}')
```

Because `OrderProcessingService` only ever receives a single `CloudProviderFactory`, it is **impossible** for it to end up with an S3 bucket and a Pub/Sub topic at the same time — the family boundary is enforced by the type system, not by convention or code review.

## Implementation Notes
- Abstract Factory pairs naturally with [Singleton](../creational/singleton.md) — you typically only need one instance of `AWSProviderFactory` per process, so the concrete factories are often cached/singleton-ish.
- If you only ever need to swap *one* product (not a whole family), you likely want [Factory Method](../creational/factory-method.md) instead — reach for Abstract Factory specifically when products must travel together as a compatible set.
- Adding a **new product to the family** (e.g., a third `SecretsManager` product) requires touching the abstract factory interface *and* every concrete factory — plan for this cost up front; it's the main scalability limitation of this pattern.

## Consequences

**Pros**
- Guarantees compatibility between products of the same family — mixing families becomes structurally impossible.
- Isolates concrete classes from client code; client code only ever depends on abstract interfaces.
- Adding a new product *family* (e.g., a third cloud provider) is easy — just one new factory class.

**Cons**
- Adding a new *kind* of product (a new abstract method) requires changing the abstract factory interface and every concrete factory — harder to extend in that dimension than Factory Method.

## Common Pitfalls
- Using Abstract Factory when there's really only one product varying, not a family — that's over-engineering; use Factory Method instead.
- Letting client code reach past the factory to instantiate a concrete product directly "just this once" — this reintroduces the exact coupling/mismatch risk the pattern exists to prevent.

## Real-World Examples
- Cross-platform UI toolkits (widget families per OS theme)
- Database driver factories that produce matching Connection/Command/Reader objects per vendor
- Multi-cloud SDKs provisioning matching storage/queue/secrets clients per provider

## Related Patterns
- [Factory Method](../creational/factory-method.md) — Abstract Factory is often implemented with a set of Factory Methods.
- [Singleton](../creational/singleton.md) — concrete factories are frequently singletons.
- [Builder](../creational/builder.md) — focuses on step-by-step construction of one complex object rather than families of related products.
- [Prototype](../creational/prototype.md) — factories can be composed of prototypes to clone instead of instantiate.
