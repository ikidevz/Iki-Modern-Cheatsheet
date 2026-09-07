# Prototype

**Category:** Creational
**Also known as:** Clone

## Intent
Specify the kinds of objects to create using a prototypical instance, and create new objects by **copying** this prototype rather than instantiating from scratch.

## Motivation
Some objects are expensive or awkward to build from zero: they might require a database round trip, heavy computation, or deeply nested configuration. If you need many objects that are *mostly* the same, rebuilding each one from scratch wastes that cost repeatedly:

```python
# Expensive: re-runs full initialization (loads defaults, validates, etc.) every time
default_enemy = Enemy(sprite=load_sprite("orc.png"), hp=100, damage=15, ai=load_ai_tree("orc.json"))
enemy_2 = Enemy(sprite=load_sprite("orc.png"), hp=100, damage=15, ai=load_ai_tree("orc.json"))
enemy_3 = Enemy(sprite=load_sprite("orc.png"), hp=100, damage=15, ai=load_ai_tree("orc.json"))
```

Prototype solves this by building the expensive object **once**, then cloning it for every subsequent copy — cloning is typically far cheaper than re-running full initialization, and it also decouples the calling code from the object's concrete class.

## Applicability — When to Use
- The classes to instantiate are specified at runtime (e.g., loaded dynamically from config or plugins).
- You want to avoid building a factory hierarchy that parallels the class hierarchy of products.
- Instances of a class have only a few different combinations of state, and pre-built prototypes are cheaper to copy than to reconstruct.

## Structure
```
Prototype (interface)
  + clone(): Prototype
       ^
       |
ConcretePrototype
  + clone(): ConcretePrototype   # returns a copy of itself
```

## Participants
| Role | Responsibility |
|---|---|
| `Prototype` | Declares the cloning interface. |
| `ConcretePrototype` | Implements the operation for cloning itself. |
| `Client` | Creates new objects by asking a prototype to clone itself, instead of calling `new`/a constructor directly. |

## Basic Implementation
```python
import copy
from dataclasses import dataclass


@dataclass
class Address:
    city: str
    zip_code: str


@dataclass
class Employee:
    name: str
    role: str
    address: Address

    def clone(self) -> "Employee":
        return copy.deepcopy(self)


template = Employee(name="Template", role="Engineer", address=Address("Manila", "1000"))

alice = template.clone()
alice.name = "Alice"

bob = template.clone()
bob.name = "Bob"
bob.address.city = "Cebu"   # deep copy: doesn't affect alice or template

print(alice)
print(bob)
print(template)
```

### Prototype Registry
```python
class PrototypeRegistry:
    def __init__(self) -> None:
        self._prototypes: dict[str, Employee] = {}

    def register(self, key: str, prototype: Employee) -> None:
        self._prototypes[key] = prototype

    def create(self, key: str) -> Employee:
        return self._prototypes[key].clone()


registry = PrototypeRegistry()
registry.register("engineer", template)
new_hire = registry.create("engineer")
```

## Real-World Example: Game Enemy Spawner with Prototype Registry

A game level needs to spawn dozens of enemies of a handful of types, each requiring expensive one-time setup (sprite loading, AI behavior tree parsing) but differing only in position and minor stat tweaks per spawn.

```python
from __future__ import annotations
import copy
import time
from dataclasses import dataclass, field


def load_sprite(path: str) -> str:
    time.sleep(0.05)   # simulate an expensive disk/network load
    return f"<sprite:{path}>"


def load_ai_behavior(path: str) -> dict:
    time.sleep(0.05)   # simulate parsing a heavy behavior tree
    return {"source": path, "states": ["idle", "chase", "attack"]}


@dataclass
class Enemy:
    kind: str
    sprite: str
    hp: int
    damage: int
    ai_behavior: dict
    x: float = 0.0
    y: float = 0.0

    def clone(self) -> "Enemy":
        # deepcopy protects ai_behavior (a mutable dict) from being shared
        return copy.deepcopy(self)

    def __repr__(self) -> str:
        return f"Enemy({self.kind}, hp={self.hp}, pos=({self.x:.0f},{self.y:.0f}))"


class EnemyPrototypeRegistry:
    """Builds each enemy type ONCE, then serves cheap clones forever after."""

    def __init__(self) -> None:
        self._prototypes: dict[str, Enemy] = {}

    def register_type(self, kind: str, sprite_path: str, hp: int, damage: int, ai_path: str) -> None:
        self._prototypes[kind] = Enemy(
            kind=kind,
            sprite=load_sprite(sprite_path),      # expensive — happens once
            hp=hp,
            damage=damage,
            ai_behavior=load_ai_behavior(ai_path),  # expensive — happens once
        )

    def spawn(self, kind: str, x: float, y: float, hp_bonus: int = 0) -> Enemy:
        enemy = self._prototypes[kind].clone()      # cheap — no I/O
        enemy.x, enemy.y = x, y
        enemy.hp += hp_bonus
        return enemy


registry = EnemyPrototypeRegistry()
start = time.perf_counter()
registry.register_type("orc", "orc.png", hp=100, damage=15, ai_path="orc_ai.json")
registry.register_type("goblin", "goblin.png", hp=40, damage=8, ai_path="goblin_ai.json")
setup_time = time.perf_counter() - start

start = time.perf_counter()
wave = [
    registry.spawn("orc", x=10, y=20),
    registry.spawn("orc", x=15, y=22, hp_bonus=20),   # elite variant
    registry.spawn("goblin", x=5, y=5),
    registry.spawn("goblin", x=6, y=8),
    registry.spawn("goblin", x=7, y=4),
]
spawn_time = time.perf_counter() - start

for enemy in wave:
    print(enemy)
print(f"One-time prototype setup: {setup_time*1000:.1f}ms")
print(f"Spawning {len(wave)} clones:   {spawn_time*1000:.1f}ms")
```

The output makes the pattern's payoff concrete: prototype setup (loading sprites and AI trees) costs tens of milliseconds and happens **twice**, while spawning five enemies from those prototypes costs almost nothing, because cloning skips all the expensive I/O and parsing entirely.

## Implementation Notes
- Python's `copy` module gives you this pattern almost for free: `copy.copy()` for a shallow clone, `copy.deepcopy()` for a fully independent one. Implement `__copy__`/`__deepcopy__` on a class only when the default field-by-field copy isn't correct (e.g., you need to reset a cache, regenerate an ID, or skip copying an unpicklable resource handle).
- Watch out for **shared mutable state** after a shallow copy — `copy.copy()` will happily give two "independent" objects a reference to the *same* underlying list or dict. Use `deepcopy` (or a custom `__copy__`) whenever a field is itself mutable and shouldn't be shared.
- A **Prototype Registry** (as in both examples) is the idiomatic complement — it turns "build one of these" into "look up a name, then clone," which pairs Prototype nicely with configuration-driven or plugin-based systems.

## Consequences

**Pros**
- Clones objects without coupling client code to their concrete classes.
- Removes repeated, expensive initialization code from the hot path.
- Produces complex, pre-configured objects conveniently — clone-then-tweak instead of build-from-scratch.

**Cons**
- Cloning objects with circular references requires careful handling (Python's `deepcopy` handles this correctly by tracking already-copied objects via a memo dict, but custom `__deepcopy__` implementations must do the same).
- Deep-copying every field isn't always correct or desired — some fields (e.g., a database connection) should never be cloned, and need explicit exclusion.

## Common Pitfalls
- Using `copy.copy()` (shallow) when nested mutable fields actually need independence — leads to "spooky action at a distance" bugs where mutating one clone mutates another.
- Forgetting that a prototype registry's entries are themselves mutable — always clone *before* handing an object to calling code, never hand out the stored prototype directly.

## Real-World Examples
- Python's `copy.copy()` / `copy.deepcopy()` are direct language-level support for this pattern.
- Game engines cloning pre-configured "template" enemies/objects/prefabs.
- Spreadsheet and document editors duplicating a cell/page/slide as a starting point.

## Related Patterns
- [Abstract Factory](../creational/abstract-factory.md) — prototypes can be used as the products a factory returns.
- [Composite](../structural/composite.md) / [Decorator](../structural/decorator.md) — often implemented with Prototype to deep-clone complex object trees in one call.
- [Builder](../creational/builder.md) — an alternative when construction must follow a specific multi-step process instead of copying an existing instance.
