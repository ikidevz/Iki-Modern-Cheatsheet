# Memento

**Category:** Behavioral
**Also known as:** Token, Snapshot

## Intent
Without violating encapsulation, capture and externalize an object's internal state so it can be restored later.

## Motivation
Undo functionality needs access to an object's *past* internal state — but exposing every field through public getters/setters just so an external `History` class can save and restore them breaks encapsulation and invites misuse:

```python
class Document:
    def __init__(self):
        self.content = ""
        self.cursor_position = 0
        self._formatting_state = {}   # meant to be private!

    # Now forced to expose internals just so History can snapshot them:
    def get_formatting_state(self): return self._formatting_state
    def set_formatting_state(self, state): self._formatting_state = state
```

Once `_formatting_state` has a public getter/setter, *anything* in the codebase can read or mutate it directly, not just the undo system — the class's encapsulation boundary has effectively been dissolved for the sake of one feature.

Memento solves this by letting the object snapshot *itself*: it alone knows how to package its private state into an opaque `Memento` object, and it alone knows how to unpack one to restore itself. External code (`History`) stores mementos, but can never see or touch what's inside them.

## Applicability — When to Use
- A snapshot of an object's state must be saved so it can be restored later (undo, checkpoints, rollbacks).
- Exposing the object's internals directly, just to take the snapshot, would break encapsulation.

## Structure
```
Originator ---creates---> Memento (opaque to everyone but Originator)
    ^                          ^
    |                          |
    \----restores from---------/
                ^
                |
           Caretaker (stores mementos, never inspects them)
```

## Participants
| Role | Responsibility |
|---|---|
| `Originator` | Creates a `Memento` containing a snapshot of its current internal state; can restore its state from a `Memento`. |
| `Memento` | Stores the `Originator`'s internal state; exposes no public interface to anyone but the `Originator` that created it. |
| `Caretaker` | Keeps track of mementos over time, but never examines or modifies their contents. |

## Basic Implementation
```python
from __future__ import annotations
from dataclasses import dataclass


@dataclass(frozen=True)
class EditorMemento:
    """Immutable snapshot — opaque to the Caretaker."""
    _content: str


class TextEditor:
    """Originator"""

    def __init__(self) -> None:
        self.content = ""

    def type(self, text: str) -> None:
        self.content += text

    def save(self) -> EditorMemento:
        return EditorMemento(self.content)

    def restore(self, memento: EditorMemento) -> None:
        self.content = memento._content


class History:
    """Caretaker — stores mementos, doesn't peek inside them."""

    def __init__(self) -> None:
        self._snapshots: list[EditorMemento] = []

    def push(self, memento: EditorMemento) -> None:
        self._snapshots.append(memento)

    def pop(self) -> EditorMemento | None:
        return self._snapshots.pop() if self._snapshots else None


editor = TextEditor()
history = History()

editor.type("Hello")
history.push(editor.save())

editor.type(", world!")
history.push(editor.save())

editor.type(" This part is a mistake.")
print("Before undo:", editor.content)

last_good = history.pop()          # discard current
if (previous := history.pop()) is not None:
    editor.restore(previous)
print("After undo:", editor.content)
```

## Real-World Example: Game State Checkpoints with Bounded History

A game needs "rewind" checkpoints, but full game state (inventory, position, health, quest flags) is large — so the caretaker needs a **bounded** history that evicts the oldest checkpoint once a limit is reached, without ever needing to know what's inside a checkpoint.

```python
from __future__ import annotations
from dataclasses import dataclass, field, replace
from collections import deque


@dataclass(frozen=True)
class GameStateMemento:
    """Immutable, opaque snapshot — the caretaker never reads these fields."""
    _health: int
    _position: tuple[float, float]
    _inventory: tuple[str, ...]
    _quest_flags: tuple[tuple[str, bool], ...]


class GameState:
    """Originator: the live, mutable game state."""

    def __init__(self) -> None:
        self.health = 100
        self.position = (0.0, 0.0)
        self.inventory: list[str] = []
        self.quest_flags: dict[str, bool] = {}

    def save(self) -> GameStateMemento:
        return GameStateMemento(
            _health=self.health,
            _position=self.position,
            _inventory=tuple(self.inventory),
            _quest_flags=tuple(self.quest_flags.items()),
        )

    def restore(self, memento: GameStateMemento) -> None:
        self.health = memento._health
        self.position = memento._position
        self.inventory = list(memento._inventory)
        self.quest_flags = dict(memento._quest_flags)

    def __repr__(self) -> str:
        return (f"GameState(hp={self.health}, pos={self.position}, "
                f"inv={self.inventory}, flags={self.quest_flags})")


class CheckpointManager:
    """Caretaker: bounded history — old checkpoints are dropped automatically."""

    def __init__(self, max_checkpoints: int = 3) -> None:
        self._checkpoints: deque[GameStateMemento] = deque(maxlen=max_checkpoints)

    def checkpoint(self, state: GameState) -> None:
        self._checkpoints.append(state.save())
        print(f"[Checkpoint saved] ({len(self._checkpoints)}/{self._checkpoints.maxlen} slots used)")

    def rewind(self, state: GameState) -> bool:
        if not self._checkpoints:
            print("[Rewind] No checkpoints available")
            return False
        memento = self._checkpoints.pop()
        state.restore(memento)
        print("[Rewind] Restored previous checkpoint")
        return True


game = GameState()
checkpoints = CheckpointManager(max_checkpoints=3)

checkpoints.checkpoint(game)   # checkpoint 1: starting state

game.health = 80
game.position = (10.0, 5.0)
game.inventory.append("sword")
checkpoints.checkpoint(game)   # checkpoint 2

game.health = 40
game.quest_flags["defeated_dragon"] = True
checkpoints.checkpoint(game)   # checkpoint 3

game.health = 10
game.inventory.append("potion")
checkpoints.checkpoint(game)   # checkpoint 4 -- checkpoint 1 is now evicted (max=3)

print("\nCurrent:", game)

checkpoints.rewind(game)   # back to checkpoint 3's state
print("After 1 rewind:", game)

checkpoints.rewind(game)   # back to checkpoint 2's state
print("After 2 rewinds:", game)

checkpoints.rewind(game)   # back to... checkpoint 1 was evicted, this is the oldest remaining
print("After 3 rewinds:", game)
```

The `deque(maxlen=3)` in `CheckpointManager` demonstrates a real-world concern basic Memento examples usually skip: mementos can be large, so a production caretaker typically needs an explicit **retention policy** (bounded count, time-based expiry, or periodic full-vs-incremental snapshots) — all implementable entirely within the Caretaker, without the Originator or Memento ever changing.

## Implementation Notes
- Prefix memento fields with an underscore (or otherwise mark them private/internal) and keep the memento **immutable** (`frozen=True`) — this is what actually enforces "only the Originator can meaningfully read/write this," since Python has no true private access control.
- For large state, consider storing **diffs** rather than full copies, or bound the history size (as shown) — Memento's simplicity comes at a real memory cost if snapshots are frequent and large.
- Memento pairs naturally with [Command](../behavioral/command.md): a command's `undo()` can restore a memento captured before `execute()` ran, instead of (or in addition to) reversing the operation step by step.

## Consequences

**Pros**
- Preserves encapsulation — the object's internal structure is never exposed to the Caretaker.
- Simplifies the Originator by delegating state history-keeping to a separate object.

**Cons**
- Can be expensive in memory/CPU if mementos are large or created very frequently — needs an explicit retention strategy in real systems.
- The Caretaker must manage memento lifecycles carefully (as shown with bounded history) to avoid unbounded memory growth.

## Common Pitfalls
- Giving the memento a public interface for its contents "just for convenience," which quietly defeats the encapsulation guarantee the pattern exists to provide.
- Snapshotting on every tiny state change with no retention limit — memory grows unbounded in long-running applications.

## Real-World Examples
- Undo/redo stacks in text editors and image editors.
- Database transaction savepoints/rollbacks.
- Game save states / checkpoints, as shown above.

## Related Patterns
- [Command](../behavioral/command.md) — commands frequently use mementos internally to implement `undo()`.
- [Iterator](../behavioral/iterator.md) — a memento can be used to capture and restore a traversal's position.
- [Prototype](../creational/prototype.md) — a simpler alternative to Memento when a full deep copy of the object itself is affordable and sufficient.
