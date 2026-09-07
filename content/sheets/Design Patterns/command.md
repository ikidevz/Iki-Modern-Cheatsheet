# Command

**Category:** Behavioral
**Also known as:** Action, Transaction

## Intent
Encapsulate a request as an object, letting you parameterize clients with different requests, queue or log requests, and support undoable operations.

## Motivation
A text editor's toolbar needs buttons for Bold, Italic, Save, and Undo. If each button directly calls editor methods, the button code and the editor become tangled, and undo becomes nearly impossible to implement generically:

```python
def on_bold_button_click():
    editor.apply_bold()   # how do we undo this generically, alongside every other action?

def on_save_button_click():
    editor.save()          # this one shouldn't even be undoable
```

There's no uniform way to record "what just happened" so it can be reversed, replayed, or queued — every action type needs its own bespoke undo logic wired in by hand, if it's even possible at all.

Command solves this by wrapping every action — the receiver plus the specific operation and its parameters — inside an object with a uniform `execute()` (and optionally `undo()`) method. The button (Invoker) only ever calls `execute()`; it never needs to know what the command actually does.

## Applicability — When to Use
- You want to parameterize objects with an action to perform (callbacks modeled as objects, not just functions).
- You need to queue, schedule, or execute requests at different times, potentially on a different thread or machine.
- You want to support undo/redo.
- You want to assemble complex operations from simple ones (macro commands).

## Structure
```
Invoker --calls--> Command (interface)
                       + execute()
                       + undo()
                          ^
                          |
                  ConcreteCommand --acts on--> Receiver
```

## Participants
| Role | Responsibility |
|---|---|
| `Command` | Declares the interface for executing (and undoing) an operation. |
| `ConcreteCommand` | Binds a `Receiver` to an action; implements `execute()` by invoking the corresponding operation(s) on the receiver. |
| `Receiver` | Knows how to actually perform the operations associated with a request. |
| `Invoker` | Asks the command to carry out the request; may keep a history for undo/redo. |
| `Client` | Creates a `ConcreteCommand` and sets its `Receiver`. |

## Basic Implementation
```python
from abc import ABC, abstractmethod


class Light:
    """Receiver"""

    def __init__(self, name: str) -> None:
        self.name = name
        self.is_on = False

    def turn_on(self) -> None:
        self.is_on = True
        print(f"{self.name} light ON")

    def turn_off(self) -> None:
        self.is_on = False
        print(f"{self.name} light OFF")


class Command(ABC):
    @abstractmethod
    def execute(self) -> None: ...

    @abstractmethod
    def undo(self) -> None: ...


class TurnOnCommand(Command):
    def __init__(self, light: Light) -> None:
        self.light = light

    def execute(self) -> None:
        self.light.turn_on()

    def undo(self) -> None:
        self.light.turn_off()


class TurnOffCommand(Command):
    def __init__(self, light: Light) -> None:
        self.light = light

    def execute(self) -> None:
        self.light.turn_off()

    def undo(self) -> None:
        self.light.turn_on()


class RemoteControl:
    """Invoker"""

    def __init__(self) -> None:
        self._history: list[Command] = []

    def press(self, command: Command) -> None:
        command.execute()
        self._history.append(command)

    def press_undo(self) -> None:
        if self._history:
            self._history.pop().undo()


living_room = Light("Living Room")
remote = RemoteControl()
remote.press(TurnOnCommand(living_room))
remote.press(TurnOffCommand(living_room))
remote.press_undo()   # turns it back on
```

## Real-World Example: Text Editor with Undo/Redo and Macro Commands

A fuller demonstration: a text editor where every edit is a Command, supporting both linear undo/redo history and **macro commands** that bundle several commands into one undoable unit — exactly how real editors implement "undo" for compound operations like find-and-replace-all.

```python
from __future__ import annotations
from abc import ABC, abstractmethod


class TextDocument:
    """Receiver"""

    def __init__(self) -> None:
        self.text = ""

    def insert(self, position: int, text: str) -> None:
        self.text = self.text[:position] + text + self.text[position:]

    def delete(self, position: int, length: int) -> str:
        removed = self.text[position:position + length]
        self.text = self.text[:position] + self.text[position + length:]
        return removed


class Command(ABC):
    @abstractmethod
    def execute(self) -> None: ...

    @abstractmethod
    def undo(self) -> None: ...


class InsertTextCommand(Command):
    def __init__(self, doc: TextDocument, position: int, text: str) -> None:
        self.doc = doc
        self.position = position
        self.text = text

    def execute(self) -> None:
        self.doc.insert(self.position, self.text)

    def undo(self) -> None:
        self.doc.delete(self.position, len(self.text))


class DeleteTextCommand(Command):
    def __init__(self, doc: TextDocument, position: int, length: int) -> None:
        self.doc = doc
        self.position = position
        self.length = length
        self._deleted_text = ""   # captured on execute, needed to undo

    def execute(self) -> None:
        self._deleted_text = self.doc.delete(self.position, self.length)

    def undo(self) -> None:
        self.doc.insert(self.position, self._deleted_text)


class MacroCommand(Command):
    """Composes several commands into one undoable unit."""

    def __init__(self, commands: list[Command]) -> None:
        self.commands = commands

    def execute(self) -> None:
        for command in self.commands:
            command.execute()

    def undo(self) -> None:
        for command in reversed(self.commands):   # undo in reverse order
            command.undo()


class EditorHistory:
    """Invoker with full undo/redo stacks."""

    def __init__(self) -> None:
        self._undo_stack: list[Command] = []
        self._redo_stack: list[Command] = []

    def do(self, command: Command) -> None:
        command.execute()
        self._undo_stack.append(command)
        self._redo_stack.clear()   # a new action invalidates the redo history

    def undo(self) -> None:
        if not self._undo_stack:
            return
        command = self._undo_stack.pop()
        command.undo()
        self._redo_stack.append(command)

    def redo(self) -> None:
        if not self._redo_stack:
            return
        command = self._redo_stack.pop()
        command.execute()
        self._undo_stack.append(command)


doc = TextDocument()
history = EditorHistory()

history.do(InsertTextCommand(doc, 0, "Hello"))
print(repr(doc.text))                              # 'Hello'

history.do(InsertTextCommand(doc, 5, ", World"))
print(repr(doc.text))                              # 'Hello, World'

# A "replace" is a macro: delete the old word, insert the new one — one undo step.
replace_world_with_python = MacroCommand([
    DeleteTextCommand(doc, 7, 5),                    # remove "World"
    InsertTextCommand(doc, 7, "Python"),
])
history.do(replace_world_with_python)
print(repr(doc.text))                              # 'Hello, Python'

history.undo()
print("After undo:", repr(doc.text))               # 'Hello, World' — the whole macro reverses at once

history.redo()
print("After redo:", repr(doc.text))               # 'Hello, Python'
```

The `MacroCommand` here is the key upgrade: it shows Command's composability — a "replace" operation that's really two edits becomes a single undo step, because `MacroCommand` is itself just another `Command` that can be nested, stored, and undone exactly like any primitive one.

## Implementation Notes
- Commands that mutate state and need to be undoable must **capture whatever data undo requires at execute-time** (see `DeleteTextCommand` storing `_deleted_text`) — undo can't be implemented generically without remembering what was actually changed.
- Clear the redo stack whenever a *new* action is performed (see `EditorHistory.do`) — otherwise "redo" after a fresh edit would incorrectly resurrect a since-abandoned future.
- For commands that need to cross process/thread boundaries (job queues), keep them serializable — avoid storing live object references inside a command that might be pickled and sent elsewhere.

## Consequences

**Pros**
- Decouples the class that invokes the operation (Invoker) from the class that performs it (Receiver).
- New commands can be added without changing existing invoker code (Open/Closed).
- Supports undo/redo, macro commands, and deferred/queued execution naturally.

**Cons**
- Increases the number of classes — a new class for every distinct command, which can feel heavyweight for very simple actions.

## Common Pitfalls
- Implementing `execute()` without capturing enough state to make `undo()` correct — leads to "undo" that doesn't fully restore prior state.
- Forgetting to clear the redo stack on a new action, producing a corrupted, nonsensical redo history.

## Real-World Examples
- GUI button/menu actions bound to Command objects.
- Task queues and job schedulers (each job is a serializable command).
- Redo/undo stacks in text editors and graphics/design software.

## Related Patterns
- [Chain of Responsibility](../behavioral/chain-of-responsibility.md) — commands can be passed along a chain of handlers.
- [Memento](../behavioral/memento.md) — often used alongside Command to implement undo by snapshotting state instead of (or in addition to) reversing individual operations.
- [Strategy](#) — structurally similar, but Strategy usually describes *how* to do something (an interchangeable algorithm), while Command describes *what* (and *when*) to do it, including undo.
