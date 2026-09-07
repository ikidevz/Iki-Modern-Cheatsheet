# Heaps (Priority Queues) — Complete Cheat Sheet

## 📖 Overview

A **Heap** is a complete binary tree with one guarantee about ordering:

- **Min-Heap:** every parent is ≤ its children → the smallest element is always at the root.
- **Max-Heap:** every parent is ≥ its children → the largest element is always at the root.

That's a *weaker* guarantee than a fully sorted structure — a heap only promises the root is correct, not that the whole thing is in order. This weaker guarantee is exactly why heaps are fast: maintaining it costs O(log n) per operation instead of the O(n) an insert into a fully sorted array would cost.

```
Min-Heap:              Not a valid Min-Heap (5 > 3, breaks the rule):
      1                       1
     / \                     / \
    3   6                   5   6
   / \                     / \
  5   9                   3   9
```

Because a heap is a **complete** tree (every level full except possibly the last, filled left to right), it can be stored compactly as a plain **array** — no pointers needed at all.

---

## 🎯 When to Use

- Need repeated access to the **current min or max** as data changes
- **"K largest / K smallest / Top K"** problems
- **Priority scheduling** — process the most urgent/important item next
- **Merging K sorted lists or streams**
- Tracking a **running median** of a data stream
- Graph algorithms that need "closest/cheapest next node" — **Dijkstra's shortest path**, **Prim's MST**

---

## 🗺️ Array Representation

No pointers — parent/child positions are computed directly from the index:

```
For a node at index i:
  parent(i) = (i - 1) // 2
  left(i)   = 2*i + 1
  right(i)  = 2*i + 2

Array: [1, 3, 6, 5, 9]
Index:  0  1  2  3  4

Tree:         1(0)
             /    \
          3(1)    6(2)
          /  \
       5(3)  9(4)
```

---

## 🧩 Core Templates

Python's built-in `heapq` module implements a **min-heap only**. For a max-heap, negate values going in and out.

```python
import heapq

# Basics
heap = []
heapq.heappush(heap, 5)          # O(log n)
heapq.heappush(heap, 2)
heapq.heappush(heap, 8)
smallest = heap[0]                # peek — O(1), NOT guaranteed to be sorted beyond the root
heapq.heappop(heap)                 # remove & return smallest — O(log n)

# Build a heap from an existing list — O(n), NOT O(n log n)!
nums = [5, 2, 8, 1, 9]
heapq.heapify(nums)                  # in-place, O(n)

# Max-heap: negate on the way in and out
max_heap = []
heapq.heappush(max_heap, -5)
heapq.heappush(max_heap, -2)
largest = -heapq.heappop(max_heap)    # 5

# Push then pop as one O(log n) operation (slightly cheaper than separate calls)
heapq.heapreplace(heap, new_val)        # pops smallest, THEN pushes new_val
heapq.heappushpop(heap, new_val)        # pushes new_val, THEN pops smallest

# Built-in K-largest / K-smallest — O(n log k)
heapq.nlargest(k, nums)
heapq.nsmallest(k, nums)

# Custom priority with tuples — compares element by element, so add a tiebreaker
# to avoid comparing unorderable objects when priorities tie
heapq.heappush(heap, (priority, tiebreak_index, item))
```

**Why `heapify` is O(n), not O(n log n):** intuitively you'd think "n inserts × O(log n) each = O(n log n)," but `heapify` doesn't insert one at a time — it works bottom-up, and most nodes are near the bottom of the tree where "sift down" only has a short distance to travel. The math works out to O(n) overall. This matters: if you already have all your data upfront, always prefer `heapify()` over `n` separate `heappush()` calls.

---

## 🧩 Pattern 1: Fixed-Size Heap for "Top K"

Keep a heap of exactly size `k`. For each new element, compare against the heap's worst-so-far and swap it in only if the new element is better.

```python
def find_kth_largest(nums, k):
    heap = nums[:k]
    heapq.heapify(heap)              # min-heap of the first k elements
    for num in nums[k:]:
        if num > heap[0]:             # bigger than our current smallest-of-the-top-k?
            heapq.heapreplace(heap, num)   # pop smallest, push num
    return heap[0]                     # kth largest = smallest item still in the heap
```

**Trace for `nums = [3,2,1,5,6,4]`, `k = 2` (find 2nd largest):**

```
heap = [3,2] → heapify → [2,3]
num=1: 1 > heap[0]=2? No → skip
num=5: 5 > 2? Yes → replace → pop 2, push 5 → heap=[3,5]
num=6: 6 > 3? Yes → replace → pop 3, push 6 → heap=[5,6]
num=4: 4 > 5? No → skip
Result: heap[0] = 5 ✓ (2nd largest of [3,2,1,5,6,4] is indeed 5)
```

**Why a min-heap for finding the *largest*:** the heap holds the "top k so far," and the smallest member of that group (`heap[0]`) is the one most likely to get bumped out by a new, bigger arrival — so it needs to be instantly accessible, which is exactly what a min-heap gives you.

---

## 🧩 Pattern 2: Two Heaps for Median

Split the data into a max-heap for the lower half and a min-heap for the upper half, kept balanced in size.

```python
class MedianFinder:
    def __init__(self):
        self.small = []   # max-heap (negated), holds the lower half
        self.large = []   # min-heap, holds the upper half

    def add_num(self, num):
        heapq.heappush(self.small, -num)
        # move the largest of the lower half into the upper half,
        # guaranteeing every value in `small` <= every value in `large`
        heapq.heappush(self.large, -heapq.heappop(self.small))
        if len(self.large) > len(self.small):
            heapq.heappush(self.small, -heapq.heappop(self.large))

    def find_median(self):
        if len(self.small) > len(self.large):
            return -self.small[0]
        return (-self.small[0] + self.large[0]) / 2
```

**Why this works:** `small`'s root is the largest of the lower half; `large`'s root is the smallest of the upper half. If the heaps are balanced in size, the median is either the root of the larger heap (odd total) or the average of both roots (even total) — no sorting required, O(log n) per insertion.

---

## 🧩 Pattern 3: Merge K Sorted Sequences

Push one "current" element from each sequence; repeatedly pop the smallest and push its successor.

```python
def merge_k_lists(lists):
    heap = []
    for i, node in enumerate(lists):
        if node:
            heapq.heappush(heap, (node.val, i, node))   # i breaks ties between equal values

    dummy = ListNode()
    current = dummy
    while heap:
        val, i, node = heapq.heappop(heap)
        current.next = node
        current = current.next
        if node.next:
            heapq.heappush(heap, (node.next.val, i, node.next))
    return dummy.next
```

**Why the tiebreaker `i` matters:** if two nodes have the same `val`, Python's tuple comparison would try to compare the `node` objects next — which either errors or behaves unpredictably since `ListNode` isn't orderable. Including the list index as a tiebreaker guarantees the comparison never needs to look past it.

---

## 📝 Must-Know Problems

### 1. Kth Largest Element in an Array — see Pattern 1. **Time:** O(n log k). **Space:** O(k).

### 2. Top K Frequent Elements

**Problem:** Return the `k` most frequent elements.

- Input: `nums = [1,1,1,2,2,3]`, `k = 2` → Output: `[1, 2]`

```python
from collections import Counter

def top_k_frequent(nums, k):
    count = Counter(nums)
    return heapq.nlargest(k, count.keys(), key=count.get)
```

**Time:** O(n log k). **Space:** O(n).

### 3. Merge K Sorted Lists — see Pattern 3 above. **Time:** O(n log k), n = total nodes, k = number of lists. **Space:** O(k).

### 4. Find Median from Data Stream — see Pattern 2 above. **Time:** O(log n) per insertion, O(1) per median query. **Space:** O(n).

### 5. Task Scheduler

**Problem:** Given tasks and a cooldown `n` between identical tasks, find the minimum time to finish all tasks.

- Input: `tasks = ["A","A","A","B","B","B"]`, `n = 2` → Output: `8` (`A B idle A B idle A B`)

```python
from collections import Counter

def least_interval(tasks, n):
    counts = Counter(tasks)
    max_heap = [-count for count in counts.values()]
    heapq.heapify(max_heap)

    time = 0
    while max_heap:
        cycle = []
        for _ in range(n + 1):                 # one cooldown cycle
            if max_heap:
                cycle.append(heapq.heappop(max_heap))
        for count in cycle:
            if count + 1 < 0:                   # still has occurrences left (count is negative)
                heapq.heappush(max_heap, count + 1)
        time += len(cycle) if max_heap else n + 1 - cycle.count(0)
        time += n + 1 - len(cycle) if not max_heap else 0

    return time
```

**Key insight:** always schedule the currently most-frequent remaining task next (max-heap), which greedily keeps identical tasks as spread out as possible.

**Time:** O(n log 26) ≈ O(n) since the heap holds at most 26 task types. **Space:** O(26) ≈ O(1).

---

## 📊 Complexity Reference

| Operation | Time | Why |
|---|---|---|
| Peek min/max | O(1) | Always at the root |
| Insert (`heappush`) | O(log n) | May need to "sift up" from a leaf to the root |
| Extract min/max (`heappop`) | O(log n) | Replace root with last leaf, "sift down" to restore order |
| Build heap from array (`heapify`) | O(n) | Bottom-up construction, not n separate inserts |
| Search for an arbitrary value | O(n) | No ordering guarantee beyond parent/child |
| Delete an arbitrary value | O(n) find + O(log n) fix | Must locate it first (no shortcuts) |

Space: O(n) for the heap itself.

**Heap vs. sorted array vs. BST:**

| Need | Best structure |
|---|---|
| Just the min/max, repeatedly, with inserts in between | Heap |
| Full sorted order, iterate in order | Sorted array or BST |
| Search for an arbitrary value quickly | BST or HashMap, not a heap |
| Range queries (all values between X and Y) | BST, not a heap |

---

## ⚠️ Common Mistakes

- Assuming Python's `heapq` supports a max-heap directly — it doesn't; negate values.
- Treating a heap like a sorted array — only `heap[0]` is guaranteed correct; `heap[1]` is *not* guaranteed to be the second-smallest (it's just "some child of the root").
- Pushing `n` individual items with `heappush` when you already have all the data upfront — use `heapify()` for O(n) instead of O(n log n).
- Comparing tuples where a later element isn't orderable (e.g. raw objects) when earlier elements can tie — add an explicit tiebreaker.
- Forgetting a heap gives no O(1) way to check "is X in here?" — that requires an O(n) scan, or a companion HashMap if you need it often.

---

## 💡 Interview Tips

1. Say "min-heap" or "max-heap" explicitly, and mention the negation trick if you're using Python — interviewers will ask if they suspect you don't know `heapq` is min-only.
2. For "top K" problems, explain *why* you keep a heap of size `k` rather than pushing everything and popping k times — it's the O(n log k) vs O(n log n) distinction, and stating it shows you're optimizing deliberately.
3. If two heap items can have equal priority, mention your tiebreaker up front — it avoids an awkward bug discussion mid-interview.
4. Know when *not* to use a heap: if you need to search for an arbitrary value or need full sorted order repeatedly, a heap is the wrong tool.

---

## 🔗 Related Topics

- **Trees** — a heap is a complete binary tree, just array-backed instead of pointer-backed, with a weaker ordering guarantee than a BST.
- **Graphs** — Dijkstra's shortest path and Prim's MST both use a heap as their priority queue to always expand the cheapest frontier node next.
- **Sorting** — heap sort repeatedly extracts the max/min from a heap built out of the input array; it's how you get O(n log n) sorting with O(1) auxiliary space.
- **HashMap** — frequently paired with a heap (e.g. `Counter` + heap for Top K Frequent).

---

## 🚀 Practice List

**Easy:** Kth Largest Element in a Stream, Last Stone Weight

**Medium:** Kth Largest Element in an Array, Top K Frequent Elements, Task Scheduler, K Closest Points to Origin, Reorganize String

**Hard:** Merge K Sorted Lists, Find Median from Data Stream, Smallest Range Covering Elements from K Lists
