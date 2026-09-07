# Time & Space Complexity — Complete Cheat Sheet

## 📖 Overview

**Big O notation** describes how the runtime or memory use of an algorithm grows as the input size `n` grows. It captures the **worst-case upper bound** — a guarantee that the algorithm won't do worse than this, no matter how nasty the input is.

Big O deliberately throws away detail that doesn't matter at scale:

- **Drop constants:** `O(2n)` → `O(n)` (doing something twice is still "linear")
- **Drop lower-order terms:** `O(n² + n)` → `O(n²)` (the n² term dominates as n grows)
- **Focus on the dominant term** as `n → ∞`

This is why an algorithm that's technically `O(n² + 1000n)` is still called `O(n²)` — for large enough `n`, the `n²` term swamps everything else, even if the constant looks scary for small `n`.

---

## 🪜 The Complexity Ladder (Best → Worst)

| Notation | Name | Feel | Example |
|---|---|---|---|
| O(1) | Constant | Instant, regardless of size | Array index access, hash lookup |
| O(log n) | Logarithmic | Barely grows | Binary search, balanced BST ops |
| O(n) | Linear | Grows proportionally | Single loop, linear scan |
| O(n log n) | Linearithmic | Slightly worse than linear | Merge sort, heap sort, sorting in general |
| O(n²) | Quadratic | Grows fast | Nested loops, bubble/insertion sort |
| O(n³) | Cubic | Grows faster | Triple nested loops, naive matrix multiply |
| O(2ⁿ) | Exponential | Explodes | Naive recursive Fibonacci, generating all subsets |
| O(n!) | Factorial | Explodes violently | Generating all permutations, brute-force TSP |

### Visualizing growth

```
n = 10:          n = 100:            n = 1,000:
O(1)     = 1      O(1)     = 1        O(1)     = 1
O(log n) = 3      O(log n) = 7        O(log n) = 10
O(n)     = 10     O(n)     = 100      O(n)     = 1,000
O(n log n)= 33    O(n log n)= 664     O(n log n)= 9,966
O(n²)    = 100    O(n²)    = 10,000   O(n²)    = 1,000,000
O(2ⁿ)    = 1,024  O(2ⁿ)    = astronomically large (~10^30)
```

| n | O(log n) | O(n) | O(n log n) | O(n²) | O(2ⁿ) |
|---|---|---|---|---|---|
| 10 | 3 | 10 | 33 | 100 | 1,024 |
| 100 | 7 | 100 | 664 | 10,000 | ~10³⁰ |
| 1,000 | 10 | 1,000 | 9,966 | 1,000,000 | astronomically large |
| 1,000,000 | 20 | 1,000,000 | ~20,000,000 | 10¹² | never finishes |
| 1,000,000,000 | 30 | 10⁹ | ~30,000,000,000 | 10¹⁸ | never finishes |

**Takeaway:** an O(2ⁿ) algorithm is fine for `n = 20` and unusable by `n = 50`. An O(n log n) algorithm handles a billion elements in about 30 billion basic operations — a modern computer chews through that in seconds.

---

## 🧮 Time Complexity Walkthrough

### O(1) — Constant Time

The operation takes the same amount of time no matter how big the input is.

```python
arr = [10, 20, 30, 40, 50]
element = arr[2]          # always one step, regardless of array size
hash_table["key"]         # hash lookup, same story
stack.append(x)           # push to the end of a dynamic array
```

### O(log n) — Logarithmic Time

Each step eliminates a **fraction** (usually half) of the remaining input.

```python
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = left + (right - left) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1       # throw away the left half
        else:
            right = mid - 1      # throw away the right half
    return -1
```

Why O(log n): each iteration cuts the search space in half. Starting from `n` elements, it takes about `log₂(n)` halvings to get down to 1 element.

### O(n) — Linear Time

Work grows proportionally with input size — a single pass touches every element once.

```python
for i in range(n):
    print(i)          # runs exactly n times
```

### O(n log n) — Linearithmic Time

Typically: do an O(log n) amount of work, `n` times — or split the problem in half `log n` times, doing O(n) work at each level (this is exactly what merge sort does).

```python
def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])       # log n levels of splitting
    right = merge_sort(arr[mid:])
    return merge(left, right)          # O(n) work to merge at each level
```

### O(n²) — Quadratic Time

Nested loops over the same input — each of `n` elements is compared/combined with each of the other `n`.

```python
for i in range(n):
    for j in range(n):
        print(i, j)        # runs n × n times
```

Classic culprits: brute-force pair checking, bubble sort, checking all pairs for a condition.

### O(2ⁿ) — Exponential Time

Each step branches into (roughly) two more steps — very common in naive recursive solutions without memoization.

```python
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)     # 2 recursive calls at every level
```

`fib(30)` alone makes over 2.6 million calls. Fixing this with memoization (Dynamic Programming) drops it to O(n).

### O(n!) — Factorial Time

Every ordering of `n` items — generating all permutations is the textbook example.

```python
def permute(nums):
    result = []
    def backtrack(current):
        if len(current) == len(nums):
            result.append(current[:])
            return
        for num in nums:
            if num not in current:
                current.append(num)
                backtrack(current)
                current.pop()
    backtrack([])
    return result
```

---

## 🗂️ Data Structure Operation Complexity

| Structure | Access | Search | Insert | Delete | Space | Notes |
|---|---|---|---|---|---|---|
| Array (static) | O(1) | O(n) | O(n) | O(n) | O(n) | Insert/delete shift elements |
| Dynamic Array (list) | O(1) | O(n) | O(1) amortized at end, O(n) elsewhere | O(n) | O(n) | Occasional O(n) resize, amortizes to O(1) |
| Linked List (singly) | O(n) | O(n) | O(1) at known node | O(1) at known node | O(n) | O(1) only if you already hold the pointer |
| Doubly Linked List | O(n) | O(n) | O(1) at known node | O(1) at known node | O(n) | Can delete without a previous pointer |
| Stack | O(n) | O(n) | O(1) top | O(1) top | O(n) | LIFO only |
| Queue | O(n) | O(n) | O(1) end | O(1) front | O(n) | FIFO only |
| HashMap / HashSet | — | O(1) avg, O(n) worst | O(1) avg | O(1) avg | O(n) | Worst case from hash collisions |
| BST (balanced) | O(log n) | O(log n) | O(log n) | O(log n) | O(n) | AVL / Red-Black guarantee this |
| BST (unbalanced/degenerate) | O(n) | O(n) | O(n) | O(n) | O(n) | Sorted input inserted in order → linked list |
| Heap (binary) | O(1) peek | O(n) | O(log n) | O(log n) | O(n) | Only root guaranteed min/max |
| Trie | — | O(L) | O(L) | O(L) | O(total characters) | L = length of the word/key |
| Union-Find (path compression + rank) | — | O(α(n)) ≈ O(1) | O(α(n)) ≈ O(1) | — | O(n) | α = inverse Ackermann, effectively constant |

---

## 🔃 Sorting Algorithm Complexity

| Algorithm | Best | Average | Worst | Space | Stable? | Notes |
|---|---|---|---|---|---|---|
| Bubble Sort | O(n) | O(n²) | O(n²) | O(1) | Yes | Best case only with early-exit optimization on a sorted array |
| Insertion Sort | O(n) | O(n²) | O(n²) | O(1) | Yes | Great for small or nearly-sorted arrays |
| Selection Sort | O(n²) | O(n²) | O(n²) | O(1) | No | Always O(n²), even on sorted input |
| Merge Sort | O(n log n) | O(n log n) | O(n log n) | O(n) | Yes | Consistent, predictable, needs extra space |
| Quick Sort | O(n log n) | O(n log n) | O(n²) | O(log n) | No | Worst case on already-sorted input with a bad pivot choice |
| Heap Sort | O(n log n) | O(n log n) | O(n log n) | O(1) | No | In-place, consistent, not stable |
| Counting Sort | O(n + k) | O(n + k) | O(n + k) | O(k) | Yes | k = range of values; bad when k >> n |
| Radix Sort | O(d·(n+k)) | O(d·(n+k)) | O(d·(n+k)) | O(n+k) | Yes | d = number of digits |

**Picking a sort:**
- Need guaranteed O(n log n) and don't mind extra space → **Merge Sort**
- Need in-place and average-case speed, worst case is acceptable risk → **Quick Sort**
- Need in-place AND guaranteed O(n log n) → **Heap Sort**
- Integers in a small known range → **Counting Sort** / **Radix Sort**
- Nearly-sorted or small (< ~20 elements) → **Insertion Sort**

---

## 🔍 Searching Algorithm Complexity

| Algorithm | Time | Space | Requirement |
|---|---|---|---|
| Linear Search | O(n) | O(1) | None |
| Binary Search (iterative) | O(log n) | O(1) | Sorted data, random access |
| Binary Search (recursive) | O(log n) | O(log n) | Sorted data, random access (extra space = call stack) |
| DFS (tree/graph) | O(V + E) | O(V) | — |
| BFS (tree/graph) | O(V + E) | O(V) | — |
| Hash lookup | O(1) avg | O(n) total structure | Data already indexed in a HashMap |

---

## 🧠 Recursion & Space Complexity

Every recursive call adds a **stack frame**. The maximum depth of recursion determines the auxiliary space used, independent of how much time the algorithm takes.

```python
# O(n) time, O(n) space — one stack frame per element
def sum_list(arr, i=0):
    if i == len(arr):
        return 0
    return arr[i] + sum_list(arr, i + 1)

# O(log n) time, O(log n) space — halves each call
def binary_search_recursive(arr, target, left=0, right=None):
    if right is None:
        right = len(arr) - 1
    if left > right:
        return -1
    mid = left + (right - left) // 2
    if arr[mid] == target:
        return mid
    elif arr[mid] < target:
        return binary_search_recursive(arr, target, mid + 1, right)
    else:
        return binary_search_recursive(arr, target, left, mid - 1)
```

**Memoization** trades space for time when subproblems overlap:

```python
# Without memo: O(2ⁿ) time, O(n) space (call stack)
# With memo:    O(n) time,   O(n) space (call stack + memo table)
def fib_memo(n, memo={}):
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fib_memo(n - 1, memo) + fib_memo(n - 2, memo)
    return memo[n]
```

---

## 💾 What Counts as "Space"?

- **Input space** — the memory the input itself occupies. Usually **excluded** from the analysis (you can't avoid storing the input).
- **Auxiliary space** — extra memory the algorithm allocates beyond the input. This is what people usually mean by "O(1) space" or "in-place."
- **Total space** = input space + auxiliary space.

```python
# O(1) auxiliary space — a fixed number of variables, regardless of input size
def swap(a, b):
    temp = a
    a = b
    b = temp

# O(n) auxiliary space — a new structure that scales with input
def create_copy(arr):
    return [item for item in arr]

# O(log n) auxiliary space — no new data structure, but call-stack depth scales with log n
def binary_search_recursive(arr, target, left, right):
    if left > right:
        return -1
    mid = (left + right) // 2
    # ...
```

---

## ⚡ Quick Rules for Analysis

1. **Drop constants:** O(2n) → O(n)
2. **Drop lower-order terms:** O(n² + n) → O(n²)
3. **Sequential blocks add:** one O(n) step followed by an O(m) step → O(n + m)
4. **Nested loops multiply:** a loop inside a loop → O(n × m)
5. **Halving input each step** → O(log n)
6. **Branching into k choices, n levels deep** → O(kⁿ)
7. **A loop that does O(log n) work n times** → O(n log n) — this is exactly how comparison sorts land at O(n log n)

### Common Code-Shape → Complexity Map

| Code shape | Complexity |
|---|---|
| Single loop over n | O(n) |
| Two separate (not nested) loops over n | O(n) |
| Nested loop, both over n | O(n²) |
| Loop that halves the range each iteration | O(log n) |
| Nested loop where inner depends on outer (`for j in range(i)`) | O(n²) (still, just half the constant) |
| Recursive call that halves input | O(log n) |
| Recursive call, 2 branches, input shrinks by 1 each time | O(2ⁿ) |
| Recursive call, 2 branches, input halves each time | O(n) (fewer total calls than it looks) |

---

## 🛠️ Optimization Cheatsheet

| Bottleneck | Fix |
|---|---|
| O(n) lookup / "is X in this list?" repeated many times | HashMap / Set → O(1) lookup |
| O(n) search on data you control the order of | Sort once, then Binary Search |
| O(n²) nested loop checking pairs | Two Pointers or Sliding Window → O(n) |
| Repeated overlapping subproblems in recursion | Memoization / Dynamic Programming |
| O(n) recursive space you don't need | Convert to an iterative loop with an explicit stack/variables |
| Need min/max repeatedly as data changes | Heap (Priority Queue) |
| Need to know if two elements are in the same group repeatedly | Union-Find |

---

## 🏗️ Memory Hierarchy (Fastest → Slowest, Smallest → Largest)

```
Registers  →  Cache (L1/L2/L3)  →  RAM  →  Disk (SSD/HDD)  →  Network
 fastest, tiny                                          slowest, largest
```

This matters for **why** Big O isn't the whole story in practice — an O(n) algorithm with great cache locality (like scanning an array) can outperform an O(log n) algorithm that jumps around memory unpredictably (like a poorly-balanced tree), for small-to-medium `n`.

---

## 🎯 Interview Checklist

- State the time **and** space complexity of your solution before or right after finishing it — don't wait to be asked.
- If you have a brute-force idea, mention it (`"the naive approach is O(n²), but we can do better with a HashMap"`) — this shows you're thinking about trade-offs, not just reaching for the first working answer.
- Know the complexity of the built-in operations you're using: `list.insert(0, x)` is O(n), `dict[key]` is O(1) average, `sorted()` is O(n log n), `x in list` is O(n) but `x in set` is O(1).
- When in doubt about worst case vs average case (especially for HashMaps and Quick Sort), mention both.

---
**Rule of thumb:** if you can't state the Big O of your own solution, you don't fully understand it yet — go back and trace through what happens as `n` doubles.

