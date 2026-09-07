# Flyweight

**Category:** Structural
**Also known as:** Cache

## Intent
Use sharing to support large numbers of fine-grained objects efficiently, drastically reducing memory usage.

## Motivation
Picture a text editor storing one object per character, each carrying its own font, size, and color:

```python
class Character:
    def __init__(self, char, font, size, color):
        self.char = char
        self.font = font    # a heavy font object, possibly megabytes of glyph data
        self.size = size
        self.color = color
        self.x = 0
        self.y = 0

document = [Character(c, "Arial", 12, "black") for c in "A 500,000-character document..."]
```

If a document has 500,000 characters, and each `Character` duplicates a full font object, memory usage explodes — even though the vast majority of characters share the *exact same* font, size, and color. Only the character glyph and position are genuinely unique per instance; everything else is needlessly duplicated 500,000 times.

Flyweight fixes this by splitting object state into **intrinsic** (shared, context-free — the font itself) and **extrinsic** (unique per instance — position, the specific character). Only one shared font object is ever created per distinct (font, size, color) combination; the editor stores it once and every character references the same shared instance.

## Applicability — When to Use
- The application uses a very large number of similar objects.
- Storage costs are high because of sheer object quantity.
- Most object state can be made extrinsic (moved outside the shared object).
- Many groups of objects can be replaced by relatively few shared objects once extrinsic state is removed.

## Structure
```
Client --------> FlyweightFactory --------> Flyweight (shared, intrinsic state only)
   |  passes extrinsic state at call time         ^
   \------------------------------------------------/
```

## Participants
| Role | Responsibility |
|---|---|
| `Flyweight` | Stores intrinsic (shareable) state; its methods accept extrinsic state as parameters. |
| `FlyweightFactory` | Creates and manages flyweight objects, ensuring they're shared (not duplicated) via a cache keyed on intrinsic state. |
| `Client` | Maintains extrinsic state and passes it to flyweight operations; holds references to shared flyweights rather than owning duplicated copies. |

## Basic Implementation
```python
class TreeType:
    """Flyweight: shared, intrinsic state (expensive to duplicate)."""

    def __init__(self, name: str, color: str, texture: str) -> None:
        self.name = name
        self.color = color
        self.texture = texture   # imagine this is a large sprite/bitmap

    def draw(self, x: int, y: int) -> None:
        print(f"Drawing {self.name} ({self.color}) at ({x}, {y})")


class TreeTypeFactory:
    _types: dict[tuple, TreeType] = {}

    @classmethod
    def get_tree_type(cls, name: str, color: str, texture: str) -> TreeType:
        key = (name, color, texture)
        if key not in cls._types:
            cls._types[key] = TreeType(name, color, texture)
            print(f"Created new TreeType: {key}")
        return cls._types[key]


class Tree:
    """Extrinsic state (position) held per-instance; intrinsic state shared."""

    def __init__(self, x: int, y: int, tree_type: TreeType) -> None:
        self.x = x
        self.y = y
        self.tree_type = tree_type

    def draw(self) -> None:
        self.tree_type.draw(self.x, self.y)


forest: list[Tree] = []
for i in range(5):
    tree_type = TreeTypeFactory.get_tree_type("Oak", "Green", "oak_texture.png")
    forest.append(Tree(x=i, y=i * 2, tree_type=tree_type))

for tree in forest:
    tree.draw()

print("Unique TreeType objects created:", len(TreeTypeFactory._types))  # 1
```

## Real-World Example: Text Editor Character Rendering with Memory Comparison

This extends the motivating scenario into working, measurable code — a document of characters where formatting (font/size/color) is shared via Flyweight, with an explicit before/after object count to make the memory savings concrete.

```python
from __future__ import annotations
from dataclasses import dataclass


@dataclass(frozen=True)
class TextFormat:
    """Flyweight: intrinsic, shareable formatting state."""
    font: str
    size: int
    color: str
    bold: bool = False


class TextFormatFactory:
    """Ensures identical formats are never created twice."""

    _cache: dict[tuple, TextFormat] = {}

    @classmethod
    def get_format(cls, font: str, size: int, color: str, bold: bool = False) -> TextFormat:
        key = (font, size, color, bold)
        if key not in cls._cache:
            cls._cache[key] = TextFormat(font, size, color, bold)
        return cls._cache[key]

    @classmethod
    def format_count(cls) -> int:
        return len(cls._cache)


class CharacterGlyph:
    """A single character in the document — extrinsic state only (char + position)."""

    __slots__ = ("char", "x", "y", "format")

    def __init__(self, char: str, x: int, y: int, fmt: TextFormat) -> None:
        self.char = char
        self.x = x
        self.y = y
        self.format = fmt   # a *reference* to a shared flyweight, not a copy


class Document:
    def __init__(self) -> None:
        self.characters: list[CharacterGlyph] = []

    def type_text(self, text: str, x: int, y: int, font: str, size: int, color: str, bold: bool = False) -> None:
        fmt = TextFormatFactory.get_format(font, size, color, bold)   # shared lookup
        for i, char in enumerate(text):
            self.characters.append(CharacterGlyph(char, x + i, y, fmt))

    def render(self) -> None:
        for glyph in self.characters:
            f = glyph.format
            style = "bold " if f.bold else ""
            print(f"'{glyph.char}' at ({glyph.x},{glyph.y}) — {style}{f.font} {f.size}pt {f.color}")


doc = Document()
doc.type_text("Hello, ", x=0, y=0, font="Arial", size=12, color="black")
doc.type_text("World", x=7, y=0, font="Arial", size=12, color="black", bold=True)
doc.type_text("!", x=12, y=0, font="Arial", size=12, color="black")

doc.render()

print(f"\nTotal characters: {len(doc.characters)}")
print(f"Unique TextFormat objects created: {TextFormatFactory.format_count()}")
# 13 characters share only 2 distinct TextFormat flyweights (bold vs. non-bold),
# instead of 13 duplicated font/size/color bundles.
```

Scaled up to a real document with hundreds of thousands of characters but only a handful of distinct formatting combinations, this is the difference between allocating a few `TextFormat` objects total versus one per character — exactly the memory pressure Flyweight exists to relieve.

## Implementation Notes
- Use `__slots__` on the extrinsic-state class (as in `CharacterGlyph` above) for an additional memory win — it prevents Python from allocating a full `__dict__` per instance, which matters even more once you're already creating hundreds of thousands of them.
- Make the `Flyweight` class immutable (e.g., `@dataclass(frozen=True)`) — since it's shared by many extrinsic-state owners, any accidental mutation would corrupt state for all of them simultaneously.
- The factory's cache key must capture **all** intrinsic state — if two logically different flyweights hash to the same key, they'll incorrectly be treated as identical and shared.

## Consequences

**Pros**
- Massively reduces memory usage when object counts are large and intrinsic state is highly repetitive.

**Cons**
- Trades memory for CPU time (extra lookups, and recomputing/passing extrinsic context on every call).
- Adds complexity by splitting state into intrinsic/extrinsic, which can be error-prone if the split isn't obvious.

## Common Pitfalls
- Making the flyweight mutable — a single accidental write corrupts every object sharing that flyweight.
- Storing what should be extrinsic state (like position) *inside* the shared flyweight by mistake, silently breaking sharing correctness.
- Applying Flyweight prematurely to object counts too small to matter — profile first; this pattern adds real complexity and only pays off at scale.

## Real-World Examples
- Glyph/character rendering in text editors (one glyph/style object shared, position stored separately).
- Game engines rendering thousands of identical trees, bullets, or particles.
- String interning (`sys.intern` in Python — identical strings share memory automatically).

## Related Patterns
- [Composite](../structural/composite.md) — Flyweight leaf nodes are often shared within a Composite tree.
- [Singleton](../creational/singleton.md) — the flyweight factory's shared cache behaves like a registry of singletons per key.
- [State](../behavioral/state.md) / [Strategy](#) — State/Strategy objects can be implemented as flyweights if they hold no instance-specific data.
