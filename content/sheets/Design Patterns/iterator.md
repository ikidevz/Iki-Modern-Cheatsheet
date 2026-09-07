# Iterator

**Category:** Behavioral
**Also known as:** Cursor

## Intent
Provide a way to access the elements of an aggregate object sequentially without exposing its underlying representation.

## Motivation
Different data sources store their items very differently — a list keeps them contiguous in memory, a paginated API fetches them in batches over the network, a tree stores them nested. Code that needs to process "all the items" shouldn't have to special-case each storage strategy:

```python
# Without a uniform way to iterate, calling code has to know internal structure:
if isinstance(source, list):
    for item in source:
        process(item)
elif isinstance(source, PaginatedAPI):
    page = source.get_page(1)
    while page:
        for item in page.items:
            process(item)
        page = source.get_page(page.next_page_number) if page.has_next else None
# every new data source type means another branch, everywhere iteration happens
```

Iterator fixes this by extracting traversal into its own object with a uniform "give me the next item" interface. The caller never needs to know whether it's iterating a plain list, paginated API results, or a tree — it just keeps asking for the next item until there isn't one.

Python bakes this pattern directly into the language via the `__iter__`/`__next__` protocol and the `for` statement.

## Applicability — When to Use
- You want to traverse a collection without exposing its internal structure.
- You need to support multiple traversals, or multiple *simultaneous* traversals, of the same collection.
- You want one uniform interface for traversing genuinely different underlying structures (trees, graphs, paginated remote data).

## Structure
```
Aggregate (interface)          Iterator (interface)
  + create_iterator()             + has_next()
       ^                          + next()
       |                              ^
ConcreteAggregate ------creates------ ConcreteIterator
```

## Participants
| Role | Responsibility |
|---|---|
| `Iterator` | Declares the interface for accessing and traversing elements (`__next__` in Python). |
| `ConcreteIterator` | Implements the traversal algorithm and tracks the current position. |
| `Aggregate` | Declares an interface for creating an `Iterator` object (`__iter__` in Python). |
| `ConcreteAggregate` | Implements the iterator-creation interface, returning an instance of the appropriate `ConcreteIterator`. |

## Basic Implementation

### Custom collection using the iterator protocol
```python
from __future__ import annotations
from collections.abc import Iterator, Iterable


class BookShelf(Iterable):
    def __init__(self) -> None:
        self._books: list[str] = []

    def add(self, book: str) -> None:
        self._books.append(book)

    def __iter__(self) -> Iterator[str]:
        return BookShelfIterator(self._books)


class BookShelfIterator(Iterator[str]):
    def __init__(self, books: list[str]) -> None:
        self._books = books
        self._index = 0

    def __next__(self) -> str:
        if self._index >= len(self._books):
            raise StopIteration
        book = self._books[self._index]
        self._index += 1
        return book


shelf = BookShelf()
shelf.add("Clean Code")
shelf.add("Design Patterns")
shelf.add("Refactoring")

for book in shelf:          # uses __iter__ under the hood
    print(book)
```

## Real-World Example: Uniform Iteration Over a Paginated API and a Binary Tree

Two genuinely different data sources — a remote paginated API and an in-memory binary search tree — both exposed through the exact same iteration interface, so client code processes either one identically.

```python
from __future__ import annotations
from collections.abc import Iterator, Iterable
from dataclasses import dataclass, field


# --- Data source 1: a simulated paginated API ---
class PaginatedAPI:
    """Simulates a remote API that only returns data in pages of a fixed size."""

    def __init__(self, all_items: list[str], page_size: int = 3) -> None:
        self._all_items = all_items
        self._page_size = page_size

    def fetch_page(self, page_number: int) -> list[str]:
        print(f"    [Network] fetching page {page_number}...")
        start = page_number * self._page_size
        return self._all_items[start:start + self._page_size]


class PaginatedAPIIterator(Iterator[str]):
    """Fetches pages lazily, one at a time, hiding pagination from the caller."""

    def __init__(self, api: PaginatedAPI) -> None:
        self._api = api
        self._page_number = 0
        self._buffer: list[str] = []
        self._exhausted = False

    def __next__(self) -> str:
        if not self._buffer and not self._exhausted:
            self._buffer = self._api.fetch_page(self._page_number)
            self._page_number += 1
            if not self._buffer:
                self._exhausted = True
        if not self._buffer:
            raise StopIteration
        return self._buffer.pop(0)


class RemoteCollection(Iterable[str]):
    def __init__(self, api: PaginatedAPI) -> None:
        self._api = api

    def __iter__(self) -> Iterator[str]:
        return PaginatedAPIIterator(self._api)


# --- Data source 2: a binary search tree, traversed in-order ---
@dataclass
class TreeNode:
    value: int
    left: "TreeNode | None" = None
    right: "TreeNode | None" = None


class BinaryTree(Iterable[int]):
    def __init__(self, root: TreeNode | None = None) -> None:
        self.root = root

    def __iter__(self) -> Iterator[int]:
        return self._in_order(self.root)

    def _in_order(self, node: TreeNode | None) -> Iterator[int]:
        """A generator naturally implements the iterator protocol."""
        if node is None:
            return
        yield from self._in_order(node.left)
        yield node.value
        yield from self._in_order(node.right)


def process_all(source: Iterable) -> None:
    """Client code — works identically regardless of the underlying structure."""
    for item in source:
        print("  processing:", item)


print("--- Iterating a paginated remote API ---")
remote = RemoteCollection(PaginatedAPI(["a", "b", "c", "d", "e", "f", "g"], page_size=3))
process_all(remote)

print("\n--- Iterating a binary tree (in-order) ---")
tree = BinaryTree(TreeNode(5, TreeNode(3, TreeNode(1), TreeNode(4)), TreeNode(8)))
process_all(tree)

print("\n--- Two independent, simultaneous traversals of the same tree ---")
it1, it2 = iter(tree), iter(tree)
print("it1:", next(it1), next(it1))   # 1, 3
print("it2:", next(it2))              # 1 — completely independent position
```

`process_all()` never changes between the paginated API and the binary tree — that's the entire point. And the final block demonstrates a property plain indexing can't give you for free: two fully independent, simultaneous traversals of the same tree, each tracking its own position.

## Implementation Notes
- Prefer a **generator function** (`yield`) over a hand-written `__next__` class whenever the traversal logic is straightforward — it implements the iterator protocol automatically and is far less boilerplate (see `BinaryTree._in_order` above vs. the hand-rolled `BookShelfIterator`).
- For expensive or remote data sources, make the iterator **lazy** — fetch only what's needed for the next `__next__()` call (see `PaginatedAPIIterator` buffering one page at a time), rather than eagerly loading everything up front.
- `__iter__` should always return a **fresh** iterator with its own independent position — reusing a single stateful iterator object across multiple `for` loops is a classic bug (the second loop silently starts wherever the first left off).

## Consequences

**Pros**
- Simplifies client code that needs to traverse collections — one uniform loop works everywhere.
- Multiple iterators can traverse the same collection independently and in parallel.
- Single Responsibility — separates the traversal algorithm from the collection's own responsibilities.

**Cons**
- Can be overkill for simple collections since Python's built-in iteration already covers most needs without custom classes.
- Custom iterators can be less efficient than direct indexed access for data structures that support O(1) random access.

## Common Pitfalls
- Making `__iter__` return `self` on a stateful object instead of a fresh iterator — breaks the ability to run two independent traversals at once.
- Eagerly materializing an entire remote/expensive collection inside `__iter__` instead of fetching lazily inside `__next__` — defeats the purpose for large or paginated data sources.

## Real-World Examples
- Python's `for` loop, generators, and every built-in container (`list`, `dict`, `set`) implementing `__iter__`.
- Database cursors that fetch rows lazily, page by page.
- File readers iterating line by line without loading the whole file into memory.

## Related Patterns
- [Composite](../structural/composite.md) — iterators are frequently used to traverse Composite trees (as shown with the binary tree above).
- [Factory Method](../creational/factory-method.md) — `create_iterator()` / `__iter__` is itself a factory method.
- [Memento](../behavioral/memento.md) — can be combined with Iterator to capture/restore a traversal's current position.
