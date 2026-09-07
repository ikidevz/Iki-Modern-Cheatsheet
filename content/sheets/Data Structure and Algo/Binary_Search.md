# Binary Search — Complete Cheat Sheet

## 📖 Overview

**Binary Search** finds a target (or a boundary) in **O(log n)** by repeatedly halving the search space instead of scanning one element at a time. Every step throws away half of what's left — that's why 1,000,000 elements only take about 20 comparisons instead of 1,000,000.

It requires two things to work:
1. **Random access** to any position (arrays work, linked lists don't).
2. Either **sorted order**, or a **monotonic condition** — something that's `False` for a while and then flips to `True` (or vice versa) exactly once as you scan across the range.

That second requirement is broader than "sorted array" — it's why binary search shows up in surprising places like "find the minimum eating speed" or "find the square root," where there's no literal sorted array at all, just a monotonic yes/no answer as you vary a parameter.

---

## 🎯 When to Use

- The array is **sorted**, or can be treated as sorted
- You're finding a specific **boundary** or **threshold** (first/last occurrence, insertion point)
- There's a **monotonic predicate**: "if X works, does X+1 also work?" — if yes, binary search on the answer
- You have **random access** (array, not linked list)
- The brute-force scan is O(n) and the problem hints you need better

---

## 🧩 Template 1: Exact Match

The classic version — find a specific value in a sorted array.

```python
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = left + (right - left) // 2   # avoids integer overflow in other languages
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
```

**Trace for `arr = [-1, 0, 3, 5, 9, 12]`, `target = 9`:**

```
left=0, right=5 → mid=2, arr[2]=3 < 9 → left=3
left=3, right=5 → mid=4, arr[4]=9 == 9 → return 4
```

---

## 🧩 Template 2: Find a Boundary

Used when you're not looking for an exact match, but the **first position** where some condition becomes true. Note the loop condition is `left < right` (not `<=`), and there's no equality branch — you just narrow the range until `left == right`.

```python
def find_boundary(left, right, condition):
    while left < right:
        mid = left + (right - left) // 2
        if condition(mid):
            right = mid           # mid might be the answer — keep it in range
        else:
            left = mid + 1        # mid is definitely not the answer
    return left                    # left == right, pointing at the boundary
```

This template is the backbone of "First Bad Version," "find first/last occurrence," and "find insertion point" problems — you just swap in a different `condition` function.

---

## 🧩 Template 3: Binary Search on the Answer

When the "array" you're searching isn't literal data but a **range of possible answers**, and you have a way to check "does this candidate answer work?"

```python
def min_eating_speed(piles, h):
    def can_finish(speed):
        hours = sum((pile + speed - 1) // speed for pile in piles)  # ceiling division
        return hours <= h

    left, right = 1, max(piles)
    while left < right:
        mid = left + (right - left) // 2
        if can_finish(mid):
            right = mid       # mid works — maybe a smaller speed also works
        else:
            left = mid + 1    # mid too slow — need to go faster
    return left
```

**Why this is binary search:** as `speed` increases, `can_finish(speed)` goes from `False` to `True` and stays `True` — that's the monotonic property binary search needs, even though there's no sorted array in sight.

---

## 📝 Must-Know Problems

### 1. Classic Binary Search — see Template 1. **Time:** O(log n). **Space:** O(1).

### 2. First Bad Version

**Problem:** Versions `1..n` were released; version `bad` and everything after it is bad. Find the first bad version using the fewest calls to `is_bad_version(v)`.

- Input: `n = 5`, `bad = 4` → Output: `4`

```python
def first_bad_version(n):
    left, right = 1, n
    while left < right:
        mid = left + (right - left) // 2
        if is_bad_version(mid):
            right = mid          # mid might be the first bad one
        else:
            left = mid + 1        # mid is good, first bad is after it
    return left
```

**Time:** O(log n). **Space:** O(1). Direct application of Template 2.

### 3. Search in Rotated Sorted Array

**Problem:** A sorted array has been rotated at an unknown pivot. Find a target in O(log n).

- Input: `nums = [4,5,6,7,0,1,2]`, `target = 0` → Output: `4`

```python
def search_rotated(nums, target):
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = left + (right - left) // 2
        if nums[mid] == target:
            return mid
        if nums[left] <= nums[mid]:              # left half is sorted
            if nums[left] <= target < nums[mid]:
                right = mid - 1
            else:
                left = mid + 1
        else:                                       # right half is sorted
            if nums[mid] < target <= nums[right]:
                left = mid + 1
            else:
                right = mid - 1
    return -1
```

**Key insight:** even though the whole array isn't sorted, **at least one half of any split always is** — figure out which half is sorted, check if the target falls in that half's range, and recurse into the correct side.

**Time:** O(log n). **Space:** O(1).

### 4. Koko Eating Bananas — see Template 3 above. **Time:** O(n log m) where m = max pile size. **Space:** O(1).

### 5. Search a 2D Matrix

**Problem:** Search a target in a matrix where each row is sorted and the first element of each row is greater than the last element of the previous row (so the whole thing is sorted if flattened).

- Input: `matrix = [[1,3,5,7],[10,11,16,20],[23,30,34,60]]`, `target = 3` → Output: `True`

```python
def search_matrix(matrix, target):
    if not matrix or not matrix[0]:
        return False
    rows, cols = len(matrix), len(matrix[0])
    left, right = 0, rows * cols - 1
    while left <= right:
        mid = left + (right - left) // 2
        value = matrix[mid // cols][mid % cols]   # treat as a flattened 1D array
        if value == target:
            return True
        elif value < target:
            left = mid + 1
        else:
            right = mid - 1
    return False
```

**Key insight:** `mid // cols` and `mid % cols` convert a flat index back into (row, col) — no need to actually flatten the matrix into a new array.

**Time:** O(log(rows × cols)). **Space:** O(1).

---

## 📊 The Power of O(log n)

| Array Size | Linear O(n) | Binary O(log n) |
|---|---|---|
| 100 | 100 steps | 7 steps |
| 10,000 | 10,000 steps | 14 steps |
| 1,000,000 | 1,000,000 steps | 20 steps |
| 1,000,000,000 | 1 billion steps | 30 steps |

---

## 📊 Complexity Reference

| Version | Time | Space |
|---|---|---|
| Iterative binary search | O(log n) | O(1) |
| Recursive binary search | O(log n) | O(log n) (call stack) |
| Binary search on the answer | O(log(range) × cost of check function) | Usually O(1) |

---

## ⚠️ Common Mistakes

- Mixing loop conditions: `left <= right` (exact match template) vs `left < right` (boundary template) — using the wrong one causes infinite loops or an off-by-one wrong answer.
- Off-by-one narrowing: writing `left = mid` instead of `left = mid + 1` in the exact-match template can loop forever.
- Forgetting the data must be sorted, or that a monotonic condition actually exists — binary search on unsorted, non-monotonic data gives silently wrong answers, not an error.
- Not handling duplicates when a problem specifically wants the *first* or *last* occurrence rather than *any* match.
- Integer overflow from `(left + right) // 2` in languages without arbitrary-precision integers — use `left + (right - left) // 2` as a habit (harmless in Python, essential in Java/C++).

---

## 💡 Interview Tips

1. If a brute-force solution is O(n) and the problem says the input is sorted, that's a strong signal to look for O(log n) binary search.
2. Say which template you're using and why — "I'll binary search on the boundary because I need the *first* position where this condition holds."
3. For "binary search on the answer" problems, explicitly state the monotonic property you're relying on — it shows you're not just pattern-matching, you understand why it works.
4. Trace through a tiny example (3-4 elements) by hand before coding — boundary bugs are easy to catch this way.

---

## 🔗 Related Topics

- **Two Pointers** also narrows a search space, but linearly (O(n)) rather than by halving (O(log n)).
- **Trees** — a Binary Search Tree generalizes binary search into a pointer-based structure that supports efficient insert/delete too, not just search.
- **Sorting** — binary search assumes sorted input; if the data isn't sorted, an O(n log n) sort followed by O(log n) search can still beat repeated O(n) scans.
- Binary search does **not** work on linked lists — no random access means you can't jump to the midpoint in O(1).

---

## 🚀 Practice List

**Easy:** Binary Search, First Bad Version, Search Insert Position, Sqrt(x)

**Medium:** Search in Rotated Sorted Array, Find First and Last Position of Element in Sorted Array, Koko Eating Bananas, Search a 2D Matrix, Find Minimum in Rotated Sorted Array, Capacity To Ship Packages Within D Days
