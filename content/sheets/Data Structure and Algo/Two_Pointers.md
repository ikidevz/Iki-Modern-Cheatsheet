# Two Pointers — Complete Cheat Sheet

## 📖 Overview

**Two Pointers** means walking through a data structure with two indices instead of one, moving them according to some rule, so you avoid re-scanning the same data repeatedly. It's one of the most common ways to turn an O(n²) brute-force loop into O(n).

The technique comes in three flavors, and it's worth being explicit about which one you're using, because they solve different problem shapes:

1. **Opposite direction** — pointers start at both ends and move toward the middle.
2. **Same direction (fast & slow)** — both pointers start at the beginning and move at different speeds or under different conditions.
3. **Sliding window** — a specialized same-direction variant where the two pointers bound a *contiguous* window (its own cheat sheet, since it's a big enough topic on its own).

---

## 🎯 When to Use

- The array/string is **sorted**, or can be sorted without losing needed info
- You need to find a **pair** or **triplet** meeting some condition
- You need to **remove duplicates** or partition data **in-place**
- You're checking for a **palindrome**
- You're working with a **linked list** and need cycle detection or the middle node
- You need to **merge** two sorted sequences

---

## 🧩 Pattern 1: Opposite Direction

Start at both ends, move inward based on a comparison.

```
[1, 2, 3, 4, 5]
 ↑           ↑
left        right

if sum == target: found it
if sum < target: left += 1   (need a bigger value)
if sum > target: right -= 1  (need a smaller value)
```

```python
def two_sum_sorted(numbers, target):
    left, right = 0, len(numbers) - 1
    while left < right:
        current_sum = numbers[left] + numbers[right]
        if current_sum == target:
            return [left + 1, right + 1]   # 1-indexed, LeetCode convention
        elif current_sum < target:
            left += 1
        else:
            right -= 1
    return []
```

**Why it works:** because the array is sorted, moving `left` up strictly increases the sum, and moving `right` down strictly decreases it — every step is guaranteed progress toward the target, so no pair is ever skipped.

---

## 🧩 Pattern 2: Same Direction (Fast & Slow)

Both pointers start together; one moves faster or under a different condition than the other. `slow` tracks the "write position" of a result being built in-place; `fast` scans ahead.

```
Remove duplicates from [1, 1, 2, 2, 3]:

[1, 1, 2, 2, 3]
 S  F              nums[S]==nums[F] → just move fast

[1, 1, 2, 2, 3]
 S     F           nums[S]!=nums[F] → slow+=1, copy nums[F] to nums[S]

[1, 2, 2, 2, 3]
    S     F        nums[S]==nums[F] → just move fast

[1, 2, 2, 2, 3]
    S        F     nums[S]!=nums[F] → slow+=1, copy

[1, 2, 3, 2, 3]
       S      F     done — return slow+1 = 3
```

```python
def remove_duplicates(nums):
    if not nums:
        return 0
    slow = 0
    for fast in range(1, len(nums)):
        if nums[fast] != nums[slow]:
            slow += 1
            nums[slow] = nums[fast]
    return slow + 1
```

**Fast & slow for linked lists (cycle detection / find middle):**

```python
def has_cycle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next          # 1 step
        fast = fast.next.next     # 2 steps
        if slow == fast:
            return True            # they meet → cycle
    return False
```

Why this works: imagine two runners on a track. If the track loops (a cycle exists), the faster runner eventually laps the slower one. If it doesn't loop, the faster runner just reaches the end first.

---

## 📝 Must-Know Problems

### 1. Two Sum II — Input Array Is Sorted

Covered above under Pattern 1. **Time:** O(n). **Space:** O(1) — the key advantage over the HashMap version of Two Sum.

### 2. Remove Duplicates from Sorted Array

Covered above under Pattern 2. **Time:** O(n). **Space:** O(1).

### 3. Container With Most Water

**Problem:** Given heights, find two lines that, together with the x-axis, form the container holding the most water.

- Input: `height = [1,8,6,2,5,4,8,3,7]` → Output: `49`

```python
def max_area(height):
    left, right = 0, len(height) - 1
    max_water = 0
    while left < right:
        width = right - left
        current_height = min(height[left], height[right])
        max_water = max(max_water, width * current_height)
        # always move the shorter line — moving the taller one can't help
        if height[left] < height[right]:
            left += 1
        else:
            right -= 1
    return max_water
```

**Key insight:** moving the pointer at the *taller* line can only decrease the width while the height stays capped by the shorter line — it can never improve the area. So it's always correct (and necessary for O(n)) to move the shorter one.

**Time:** O(n). **Space:** O(1).

### 4. Valid Palindrome

**Problem:** Check if a string is a palindrome, ignoring non-alphanumeric characters and case.

- Input: `"A man, a plan, a canal: Panama"` → Output: `True`

```python
def is_palindrome(s):
    left, right = 0, len(s) - 1
    while left < right:
        while left < right and not s[left].isalnum():
            left += 1
        while left < right and not s[right].isalnum():
            right -= 1
        if s[left].lower() != s[right].lower():
            return False
        left += 1
        right -= 1
    return True
```

**Time:** O(n). **Space:** O(1).

### 5. 3Sum

**Problem:** Find all unique triplets that sum to zero.

- Input: `[-1, 0, 1, 2, -1, -4]` → Output: `[[-1, -1, 2], [-1, 0, 1]]`

```python
def three_sum(nums):
    nums.sort()
    result = []
    for i in range(len(nums) - 2):
        if i > 0 and nums[i] == nums[i - 1]:
            continue                       # skip duplicate anchors
        left, right = i + 1, len(nums) - 1
        while left < right:
            total = nums[i] + nums[left] + nums[right]
            if total == 0:
                result.append([nums[i], nums[left], nums[right]])
                while left < right and nums[left] == nums[left + 1]:
                    left += 1               # skip duplicate lefts
                while left < right and nums[right] == nums[right - 1]:
                    right -= 1              # skip duplicate rights
                left += 1
                right -= 1
            elif total < 0:
                left += 1
            else:
                right -= 1
    return result
```

**Key insight:** sort first, fix one element, then use the opposite-direction two-pointer pattern on the rest. This turns an O(n³) brute force into O(n²).

**Time:** O(n²). **Space:** O(1) extra (excluding the sort and output).

---

## 📊 Complexity Comparison

| Approach | Time | Space |
|---|---|---|
| Brute force (nested loops, all pairs) | O(n²) | O(1) |
| Two Pointers (sorted input) | O(n) | O(1) |
| HashMap (unsorted input) | O(n) | O(n) |

**Choosing between Two Pointers and HashMap for pair-sum problems:**

| Question | If yes... |
|---|---|
| Is the data already sorted, or is sorting it acceptable? | Two Pointers — O(1) space |
| Is the data unsorted and sorting would lose needed info (like original indices)? | HashMap — O(n) space, no sort needed |
| Memory constrained? | Two Pointers |
| Need every complementary pair without an O(n log n) sort cost? | HashMap |

---

## ⚠️ Common Mistakes

- Forgetting to move a pointer, causing an infinite loop.
- Applying the opposite-direction pattern to **unsorted** data — it silently gives wrong answers instead of erroring.
- Off-by-one errors: `left < right` vs `left <= right` changes whether the pointers can point to the same element.
- Not handling edge cases: empty array, single element, all identical elements.
- In 3Sum-style problems, forgetting to skip duplicates — produces duplicate triplets in the output.

---

## 💡 Interview Tips

1. Ask "is this sorted?" early — it's often the deciding factor between a two-pointer and a HashMap approach.
2. Draw the pointer movement on a small example before coding — most bugs in two-pointer code come from an unclear mental model of *when* each pointer should move.
3. State the pattern name out loud ("I'll use opposite-direction two pointers here") — it signals recognition, and helps the interviewer follow your reasoning.

---

## 🔗 Related Topics

- **Sliding Window** is a specialized two-pointer technique for *contiguous* subarrays/substrings.
- **Binary Search** also narrows a search space, but by jumping to a midpoint (O(log n)) rather than walking pointers inward (O(n)).
- **Linked Lists** — fast/slow pointers are *the* standard technique for cycle detection, finding the middle, and detecting palindromes in a list.

---

## 🚀 Practice List

**Easy:** Valid Palindrome, Merge Sorted Array, Move Zeroes, Reverse String, Two Sum II

**Medium:** 3Sum, Sort Colors, Container With Most Water, Longest Substring Without Repeating Characters, 4Sum, Trapping Rain Water
