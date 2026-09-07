# Composite

**Category:** Structural
**Also known as:** Object Tree

## Intent
Compose objects into tree structures to represent part-whole hierarchies. Composite lets clients treat individual objects and compositions of objects **uniformly**.

## Motivation
Hierarchical data — file systems, UI layouts, org charts, permission groups — naturally contains both individual "leaf" items and "container" items that hold more items. Without a unifying abstraction, client code ends up littered with type checks:

```python
def total_size(item):
    if isinstance(item, File):
        return item.size
    elif isinstance(item, Directory):
        return sum(total_size(child) for child in item.children)
    # every new item type means another elif branch, everywhere this check happens
```

This `isinstance` branching has to be repeated at every place that processes the hierarchy, and grows worse with every new node type. Composite eliminates it by giving leaves and containers **the same interface**, so client code calls `item.size()` and never needs to know or care whether `item` is one file or an entire subtree.

## Applicability — When to Use
- You need to represent part-whole hierarchies of objects (trees).
- You want client code to ignore the difference between individual objects and compositions of objects.
- The structure can have any level of nested complexity, decided at runtime.

## Structure
```
Component (interface)
  + operation()
     ^        ^
     |        |
   Leaf   Composite ----has many----> Component
  + operation()   + operation()  # delegates to each child + own logic
                   + add(child)
                   + remove(child)
```

## Participants
| Role | Responsibility |
|---|---|
| `Component` | Declares the interface shared by both leaves and composites, including default behavior where sensible. |
| `Leaf` | Represents an object with no children; implements `Component` operations directly. |
| `Composite` | Stores child components and implements operations by delegating to (and combining results from) its children. |
| `Client` | Manipulates all objects in the tree through the `Component` interface. |

## Basic Implementation
```python
from __future__ import annotations
from abc import ABC, abstractmethod


class FileSystemComponent(ABC):
    def __init__(self, name: str) -> None:
        self.name = name

    @abstractmethod
    def size(self) -> int: ...

    @abstractmethod
    def display(self, indent: int = 0) -> None: ...


class File(FileSystemComponent):
    def __init__(self, name: str, size_kb: int) -> None:
        super().__init__(name)
        self._size = size_kb

    def size(self) -> int:
        return self._size

    def display(self, indent: int = 0) -> None:
        print(" " * indent + f"- {self.name} ({self._size} KB)")


class Directory(FileSystemComponent):
    def __init__(self, name: str) -> None:
        super().__init__(name)
        self.children: list[FileSystemComponent] = []

    def add(self, component: FileSystemComponent) -> None:
        self.children.append(component)

    def remove(self, component: FileSystemComponent) -> None:
        self.children.remove(component)

    def size(self) -> int:
        return sum(child.size() for child in self.children)

    def display(self, indent: int = 0) -> None:
        print(" " * indent + f"+ {self.name}/ ({self.size()} KB)")
        for child in self.children:
            child.display(indent + 2)


root = Directory("project")
src = Directory("src")
src.add(File("main.py", 4))
src.add(File("utils.py", 2))
root.add(src)
root.add(File("README.md", 1))

root.display()
print("Total size:", root.size(), "KB")
```

## Real-World Example: Permission Groups with Nested Roles

Access-control systems often need groups that contain both individual permissions *and* other groups (roles that inherit from other roles), and need to answer "does this identity have permission X?" uniformly across both.

```python
from __future__ import annotations
from abc import ABC, abstractmethod


class PermissionNode(ABC):
    """Component"""

    @abstractmethod
    def has_permission(self, action: str) -> bool: ...

    @abstractmethod
    def list_permissions(self, indent: int = 0) -> None: ...


class Permission(PermissionNode):
    """Leaf: a single, atomic permission."""

    def __init__(self, action: str) -> None:
        self.action = action

    def has_permission(self, action: str) -> bool:
        return self.action == action

    def list_permissions(self, indent: int = 0) -> None:
        print(" " * indent + f"- {self.action}")


class Role(PermissionNode):
    """Composite: a named bundle of permissions AND/OR other roles."""

    def __init__(self, name: str) -> None:
        self.name = name
        self._children: list[PermissionNode] = []

    def add(self, node: PermissionNode) -> "Role":
        self._children.append(node)
        return self

    def has_permission(self, action: str) -> bool:
        return any(child.has_permission(action) for child in self._children)

    def list_permissions(self, indent: int = 0) -> None:
        print(" " * indent + f"+ {self.name}")
        for child in self._children:
            child.list_permissions(indent + 2)


# Build a real-world-shaped role hierarchy:
read_perms = Role("read_permissions").add(Permission("view_dashboard")).add(Permission("view_reports"))
write_perms = Role("write_permissions").add(Permission("edit_reports")).add(Permission("delete_reports"))

editor_role = Role("Editor").add(read_perms).add(write_perms)

admin_role = Role("Admin")
admin_role.add(editor_role)                      # Admin inherits everything Editor has
admin_role.add(Permission("manage_users"))
admin_role.add(Permission("manage_billing"))

# Client code never has to know how deeply "manage_users" is nested:
print("Admin can manage_users:", admin_role.has_permission("manage_users"))
print("Admin can view_dashboard:", admin_role.has_permission("view_dashboard"))   # inherited via editor_role
print("Editor can manage_billing:", editor_role.has_permission("manage_billing"))

print()
admin_role.list_permissions()
```

This mirrors how real RBAC (role-based access control) systems are structured: a `Role` composite can contain individual `Permission` leaves *or* entire other `Role` composites (role inheritance), and `has_permission()` recurses through arbitrary nesting depth without the caller ever writing an `isinstance` check.

## Implementation Notes
- Decide up front whether `add()`/`remove()` belong on the shared `Component` interface (simpler client code, but leaves get meaningless no-op/error implementations) or only on `Composite` (safer, but callers must know which is which) — the example above takes the safer route, putting `add()` only on `Role`.
- Cycles are a real risk (a role indirectly containing itself) — if your tree is built from user input or config, validate for cycles before traversing, or you'll get infinite recursion.
- Composite pairs very naturally with [Iterator](../behavioral/iterator.md) for traversal and with [Visitor](#) when you need to add new operations across the whole tree without modifying every node class.

## Consequences

**Pros**
- Simplifies client code — it works with a uniform interface regardless of tree depth.
- Makes it easy to add new component types without touching client code.
- Recursive composition naturally models real-world hierarchies (file systems, org charts, role inheritance).

**Cons**
- Can make the design overly general, making it hard to restrict what components a particular Composite may legally contain (e.g., stopping a `File` from ever containing children).

## Common Pitfalls
- Building cyclic trees (a composite that indirectly contains itself) and then recursing without a cycle guard — instant stack overflow.
- Putting child-management methods (`add`/`remove`) on the shared interface and giving `Leaf` a silently-broken implementation instead of raising a clear error.

## Real-World Examples
- File systems (files and directories)
- GUI toolkits (widgets and containers of widgets)
- Organization charts, permission/role hierarchies, HTML/XML DOM trees

## Related Patterns
- [Decorator](../structural/decorator.md) — structurally similar (both use recursive composition) but Decorator has exactly one child and adds behavior, not a whole/part relationship.
- [Iterator](../behavioral/iterator.md) — commonly used to traverse Composite trees.
- [Visitor](#) — used to apply operations across a Composite structure without changing its classes.
