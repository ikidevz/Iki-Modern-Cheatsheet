# Singleton

**Category:** Creational
**Also known as:** —

## Intent
Ensure a class has only **one instance**, and provide a single, well-defined global point of access to it.

## Motivation
Some objects genuinely only make sense as one instance across an application's lifetime — a logger, an application config, a hardware driver, a connection pool. If nothing enforces this, different parts of the codebase can end up creating their own copies, and those copies silently disagree with each other.

Consider the naive approach:

```python
# main.py
config = AppConfig("config.yaml")

# some_module.py
config = AppConfig("config.yaml")   # a second, independent instance!
```

Both objects load the same file, but they are **not the same object**. If one is mutated at runtime (e.g., a feature flag is toggled), the other never sees the change. Singleton exists to close this gap: it makes the class itself responsible for guaranteeing there is exactly one instance, and for handing that same instance to every caller.

## Applicability — When to Use
- Exactly one instance of a class must exist and be reachable from many unrelated parts of the code.
- That single instance needs to be extended by subclassing without breaking the code that uses it.
- You need controlled, lazy access to a shared, expensive-to-create resource (DB pool, hardware handle, cache).

## Structure
```
Client -------> Singleton
                 - instance: Singleton (class attribute)
                 + get_instance(): Singleton
```

## Participants
| Role | Responsibility |
|---|---|
| `Singleton` | Declares the class-level accessor that returns the unique instance; responsible for creating it on first request. |
| `Client` | Accesses the Singleton exclusively through its accessor, never via a "normal" constructor call. |

## Basic Implementation

### Option 1 — Override `__new__`
```python
class Singleton:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, value=None):
        if not hasattr(self, "_initialized"):
            self.value = value
            self._initialized = True


a = Singleton("first")
b = Singleton("second")
print(a is b)     # True
print(a.value)    # 'first' — init only ran once
```

### Option 2 — Metaclass (cleaner when you need several distinct singletons)
```python
class SingletonMeta(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]


class Logger(metaclass=SingletonMeta):
    def __init__(self):
        self.logs = []

    def log(self, msg):
        self.logs.append(msg)


l1, l2 = Logger(), Logger()
assert l1 is l2
```

### Option 3 — Module-level singleton (the idiomatic Python approach)
```python
# config.py
class _Config:
    def __init__(self):
        self.settings = {}

config = _Config()   # import this everywhere: `from config import config`
```
Python modules are only executed once and cached in `sys.modules`, so a module-level instance is naturally a singleton — no boilerplate required. This is the preferred approach in most Python codebases; reach for `__new__`/metaclass tricks only when you need lazy creation or subclassable singletons.

## Real-World Example: Thread-Safe Application Configuration Manager

A configuration manager is a textbook singleton use case: it reads environment variables and a config file once, caches the result, and must behave identically no matter which module asks for it — including under concurrent access from multiple threads.

```python
import json
import os
import threading
from pathlib import Path
from typing import Any


class ConfigurationManager:
    """
    Thread-safe singleton that loads configuration once from a file and
    environment variable overrides, then serves it to the whole app.
    """

    _instance: "ConfigurationManager | None" = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        # Double-checked locking: avoid grabbing the lock on the hot path
        # once the instance already exists.
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, config_path: str = "config.json") -> None:
        if getattr(self, "_initialized", False):
            return  # __init__ runs on every call; only configure once
        with self._lock:
            self._settings: dict[str, Any] = self._load(config_path)
            self._initialized = True

    def _load(self, config_path: str) -> dict[str, Any]:
        settings: dict[str, Any] = {}
        path = Path(config_path)
        if path.exists():
            settings.update(json.loads(path.read_text()))

        # Environment variables override file-based config, e.g. APP_DEBUG=true
        for key, value in os.environ.items():
            if key.startswith("APP_"):
                settings[key[4:].lower()] = value
        return settings

    def get(self, key: str, default: Any = None) -> Any:
        with self._lock:
            return self._settings.get(key, default)

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._settings[key] = value

    @classmethod
    def reset_for_testing(cls) -> None:
        """Escape hatch — singletons are notoriously hard to test without this."""
        with cls._lock:
            cls._instance = None


# --- Usage across "different modules" ---
config_a = ConfigurationManager("config.json")
config_a.set("feature_flag_dark_mode", True)

config_b = ConfigurationManager()   # elsewhere in the codebase
print(config_b.get("feature_flag_dark_mode"))   # True — same underlying instance
print(config_a is config_b)                      # True
```

This example demonstrates the parts a toy singleton usually skips: **thread safety** via double-checked locking, **lazy, one-time initialization** that ignores arguments on subsequent calls, and a **`reset_for_testing()` escape hatch**, which every real singleton needs because global state otherwise leaks between unit tests.

## Implementation Notes
- **Thread safety matters.** The naive `if cls._instance is None: cls._instance = ...` has a race condition under multithreading; use a lock (as above) or initialize eagerly at import time (module-level singleton) to sidestep it entirely.
- **`__init__` still runs every time** the class is "called," even after `__new__` returns the cached instance — guard it, or do initialization work inside `__new__`.
- **Prefer module-level singletons** in Python unless you specifically need lazy construction, inheritance, or parameterized first-time construction — they're simpler and thread-safe by default.
- **Always provide a reset/teardown hook** for tests; otherwise singleton state bleeds across test cases in unpredictable ways.

## Consequences

**Pros**
- Guarantees a single instance and a controlled, well-known access point.
- Lazy initialization — the instance is created only when first needed.
- Reduces global-namespace pollution compared to bare global variables.

**Cons**
- Introduces global state, which hides dependencies between components and makes control flow harder to trace.
- Violates Single Responsibility — the class manages both its own job and its lifecycle/instantiation policy.
- Makes unit testing harder: instances persist across tests unless explicitly reset, and mocking a singleton usually requires extra machinery.
- Needs explicit care (locks) to be safe under concurrency.

## Common Pitfalls
- **Hidden coupling:** code that quietly depends on `Singleton.get_instance()` is harder to unit test than code that receives its dependency via constructor injection — consider whether dependency injection is a better fit before reaching for Singleton.
- **Forgetting `__init__` reruns:** without the `_initialized` guard, every call to `Singleton(x)` silently resets state.
- **Treating Singleton as an excuse for global mutable state:** it doesn't fix the design problems of global variables — it just gives them a name and a class.

## Real-World Examples
- Database connection pools
- Application-wide logging objects
- Configuration/settings managers
- `None`, `True`, `False` are effectively singletons at the CPython interpreter level

## Related Patterns
- [Factory Method](../creational/factory-method.md) — factories are frequently implemented as singletons.
- [Facade](../structural/facade.md) — facades are often singletons since one instance is usually sufficient.
- [Flyweight](../structural/flyweight.md) — shares the idea of a single shared cache/registry, but for many shared objects keyed by state, not one instance.
