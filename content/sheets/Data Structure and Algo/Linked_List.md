# Linked Lists — Complete Cheat Sheet

## 📖 Overview

A **Linked List** is a chain of **nodes**. Each node holds some data and a pointer to the next node — nothing more. Unlike an array, the nodes aren't stored in one contiguous memory block; they're scattered, connected purely by pointers.

```
Array in memory:                Linked List in memory:
Address: 1000 1004 1008 1012    Address: 1000        2500        1200
Value:   [10] [20] [30] [40]    Value:   [10|2500] → [20|1200] → [30|None]
         one continuous block            scattered, linked by addresses
```

This trade-off defines everything about linked lists: you give up O(1) random access (you can't jump to "the 5th node," you have to walk there) in exchange for O(1) insertion/deletion once you're at the right spot, with no shifting of other elements.

**Types:** Singly linked (next only), Doubly linked (next and prev), Circular (last node points back to first).

---

## 🎯 When to Use

- Frequent insertions/deletions at the **front** of a collection
- Size changes unpredictably and often
- You don't need random access by index
- Building blocks for other structures: LRU caches, adjacency lists, undo/redo stacks

---

## ⚖️ Array vs. Linked List

| Operation | Array | Linked List |
|---|---|---|
| Access by index | O(1) ✅ | O(n) ❌ |
| Insert at beginning | O(n) ❌ | O(1) ✅ |
| Insert at end | O(1)* ✅ | O(1)** ✅ |
| Delete at beginning | O(n) ❌ | O(1) ✅ |
| Delete at end | O(1) ✅ | O(n) ❌ (unless doubly linked) |
| Search | O(n) | O(n) |
| Memory pattern | Contiguous, cache-friendly | Scattered, pointer overhead |

\*Amortized for dynamic arrays. \*\*Requires a tail pointer.

**Use an array when:** you need fast random access, know the size roughly in advance, and do a lot of reading.
**Use a linked list when:** you insert/delete at the front constantly, the size is unpredictable, and you don't need indexed access.

---

## 🧩 Core Building Blocks

```python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

# Build 1 -> 2 -> 3 -> None
head = Node(1)
head.next = Node(2)
head.next.next = Node(3)
```

### Insert / Delete / Search

```python
class LinkedList:
    def __init__(self):
        self.head = None

    def insert_front(self, data):          # O(1)
        new_node = Node(data)
        new_node.next = self.head
        self.head = new_node

    def insert_end(self, data):             # O(n) without a tail pointer
        new_node = Node(data)
        if not self.head:
            self.head = new_node
            return
        current = self.head
        while current.next:
            current = current.next
        current.next = new_node

    def delete(self, key):                   # O(n)
        current = self.head
        if current and current.data == key:
            self.head = current.next
            return
        prev = None
        while current and current.data != key:
            prev = current
            current = current.next
        if not current:
            return
        prev.next = current.next

    def search(self, key):                    # O(n)
        current = self.head
        while current:
            if current.data == key:
                return True
            current = current.next
        return False
```

---

## 🧩 Pattern 1: Reversal

```python
def reverse_list(head):
    prev = None
    current = head
    while current:
        next_node = current.next     # save before we overwrite
        current.next = prev           # reverse the pointer
        prev = current                 # advance prev
        current = next_node            # advance current
    return prev                        # new head
```

**Trace for `1 -> 2 -> 3 -> None`:**

```
Start: prev=None, current=1
Step 1: save next=2, 1.next=None, prev=1, current=2  → None<-1   2->3->None
Step 2: save next=3, 2.next=1,    prev=2, current=3  → None<-1<-2   3->None
Step 3: save next=None, 3.next=2, prev=3, current=None → None<-1<-2<-3
Loop ends (current is None). Return prev (3) as new head.
```

**Time:** O(n). **Space:** O(1).

---

## 🧩 Pattern 2: Fast & Slow Pointers

The single most important linked-list technique. `slow` moves 1 step, `fast` moves 2 steps.

```python
# Cycle detection
def has_cycle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow == fast:
            return True
    return False

# Find the middle node
def find_middle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    return slow          # middle node (or second middle for even length)
```

**Uses:** cycle detection, finding the middle (needed for merge sort on a list, or palindrome checks), finding the start of a cycle (Floyd's algorithm, phase 2), finding the nth node from the end (offset the fast pointer by n first).

---

## 🧩 Pattern 3: The Dummy Node Trick

A placeholder node before the real head eliminates special-casing "is this the first node?"

```python
# Without dummy — extra code to handle the first node
def merge_no_dummy(l1, l2):
    if not l1: return l2
    if not l2: return l1
    if l1.data <= l2.data:
        head = l1; l1 = l1.next
    else:
        head = l2; l2 = l2.next
    current = head
    # ... rest of the merge logic

# With dummy — no special case needed
def merge_two_lists(l1, l2):
    dummy = Node(0)
    current = dummy
    while l1 and l2:
        if l1.data <= l2.data:
            current.next, l1 = l1, l1.next
        else:
            current.next, l2 = l2, l2.next
        current = current.next
    current.next = l1 if l1 else l2
    return dummy.next        # skip the dummy itself
```

---

## 📝 Must-Know Problems

### 1. Reverse Linked List — see Pattern 1. **Time:** O(n). **Space:** O(1).

### 2. Linked List Cycle — see Pattern 2. **Time:** O(n). **Space:** O(1) (vs. O(n) for a HashSet-of-visited-nodes approach).

### 3. Merge Two Sorted Lists — see Pattern 3. **Time:** O(n + m). **Space:** O(1) auxiliary (reuses existing nodes).

### 4. Remove Nth Node From End

**Problem:** Remove the nth node from the end of the list, in one pass.

- Input: `1->2->3->4->5`, `n = 2` → Output: `1->2->3->5`

```python
def remove_nth_from_end(head, n):
    dummy = Node(0)
    dummy.next = head
    fast = slow = dummy
    for _ in range(n):
        fast = fast.next          # advance fast n steps first
    while fast.next:
        fast = fast.next
        slow = slow.next          # now slow is right before the node to remove
    slow.next = slow.next.next
    return dummy.next
```

**Key insight:** offsetting `fast` by `n` steps before moving both pointers together means when `fast` reaches the end, `slow` is exactly `n` nodes behind it. **Time:** O(n), one pass. **Space:** O(1).

### 5. Palindrome Linked List

**Problem:** Check if a linked list reads the same forwards and backwards.

```python
def is_palindrome(head):
    # find middle
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    # reverse second half
    prev = None
    while slow:
        next_node = slow.next
        slow.next = prev
        prev = slow
        slow = next_node
    # compare halves
    left, right = head, prev
    while right:
        if left.data != right.data:
            return False
        left = left.next
        right = right.next
    return True
```

**Time:** O(n). **Space:** O(1) — reuses the list itself instead of copying to an array.

---

## 📊 Complexity Reference

| Operation | Array | Linked List | Notes |
|---|---|---|---|
| Access i-th element | O(1) | O(n) | Array wins |
| Insert at front | O(n) | O(1) | Linked list wins |
| Insert at end | O(1)* | O(1)** | Tie with a tail pointer |
| Insert at middle | O(n) | O(n)† | Linked list better if position is known |
| Delete at front | O(n) | O(1) | Linked list wins |
| Delete at end | O(1) | O(n) | Array wins (unless doubly linked) |
| Search | O(n) | O(n) | Tie |

\*Amortized. \*\*Needs tail pointer. †O(1) if you already hold a pointer to that position.

---

## ⚠️ Common Mistakes

- Overwriting `current.next` **before** saving it — you lose the rest of the list.
- Not checking for `None`/`null` before dereferencing `.next`.
- Forgetting to update `head` when the head node itself changes (e.g. after reversal, or deleting the first node).
- Infinite loops from a pointer that never advances.
- Off-by-one errors in fast/slow starting positions — trace through a 2-3 node example to sanity check.

---

## 💡 Interview Tips

1. Draw boxes and arrows — linked list bugs are almost always easier to spot visually than in your head.
2. State your plan: "I'll use a dummy node to avoid special-casing the head" or "I'll use fast/slow pointers."
3. Test with small examples: empty list, one node, two nodes — these catch most edge-case bugs.
4. Walk through your pointer logic by hand before typing code, especially for reversal and merge problems.

---

## 🔗 Related Topics

- **Two Pointers** — fast/slow is the linked-list-specific application of this pattern.
- **Stack** — reversing a list via push-then-pop-all is an alternative to the iterative pointer-swap method.
- **HashMap** — needed for problems like cloning a list with random pointers (map original node → cloned node).
- **Recursion** — many linked-list problems (reverse, merge) have elegant recursive solutions using O(n) call-stack space instead of O(1) iterative space.

---

## 🚀 Practice List

**Easy:** Reverse Linked List, Merge Two Sorted Lists, Linked List Cycle, Remove Duplicates from Sorted List, Middle of the Linked List, Palindrome Linked List

**Medium:** Add Two Numbers, Remove Nth Node From End, Reorder List, Linked List Cycle II, Sort List, Copy List with Random Pointer
