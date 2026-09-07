# Sliding Window — Complete Cheat Sheet

## 📖 Overview

**Sliding Window** maintains a **contiguous** range (the "window") over an array or string, expanding and contracting it as needed instead of recomputing from scratch for every possible window. It's a specialized two-pointer technique, restricted to problems where the answer has to be a *contiguous* chunk of the data.

The core saving: a brute-force approach recalculates something (a sum, a count, a set of characters) for every possible window from scratch — O(n²) or worse. Sliding window updates that state incrementally as the window moves — add what just entered, remove what just left — bringing it down to O(n).

```
Brute force: recompute sum for every window of size k
[1, 2, 3, 4, 5], k=3
sum([1,2,3]) = 6   ← recomputed from scratch
sum([2,3,4]) = 9   ← recomputed from scratch
sum([3,4,5]) = 12  ← recomputed from scratch
                     O(n·k) total

Sliding window: reuse the previous sum
sum = 1+2+3 = 6
slide: sum = sum - 1 + 4 = 9    ← O(1) update
slide: sum = sum - 2 + 5 = 12   ← O(1) update
                                   O(n) total
```

---

## 🎯 When to Use

- The problem involves a **contiguous** subarray or substring
- Keywords: "contiguous," "substring," "subarray," "window," "at most K," "at least K," "exactly K"
- You need the **longest / shortest / max / min** of something over contiguous ranges
- A brute-force approach would recompute overlapping work

**Not** for problems about non-contiguous subsequences — that's a different family (often DP or backtracking).

---

## 🧩 Fixed-Size Window

The window size `k` is given up front. Slide it one step at a time: add the new right edge, remove the old left edge.

```python
def max_sum_subarray(arr, k):
    window_sum = sum(arr[:k])
    max_sum = window_sum
    for i in range(k, len(arr)):
        window_sum += arr[i] - arr[i - k]   # add new right edge, drop old left edge
        max_sum = max(max_sum, window_sum)
    return max_sum
```

**Trace for `arr = [2, 1, 5, 1, 3, 2]`, `k = 3`:**

```
Initial window [2,1,5]: sum=8, max=8
i=3: sum = 8 - 2 + 1 = 7,  max=8
i=4: sum = 7 - 1 + 3 = 9,  max=9
i=5: sum = 9 - 5 + 2 = 6,  max=9
Result: 9  (window [5,1,3])
```

---

## 🧩 Variable-Size Window

The window size isn't fixed — it grows by moving `right`, and shrinks by moving `left` whenever it becomes "invalid" per the problem's condition.

```python
left = 0
window_state = {}          # or a running sum, a set, a counter, etc.
result = 0

for right in range(len(arr)):
    # 1. expand: fold arr[right] into window_state

    while window_is_invalid(window_state):   # 2. contract while invalid
        # remove arr[left] from window_state
        left += 1

    result = max(result, right - left + 1)    # 3. update answer with current valid window
```

**Recognizing which type you need:**

| Fixed window | Variable window |
|---|---|
| "size K" is explicitly given | "longest" / "shortest" |
| "K consecutive elements" | "at most K" / "at least K" |
| One pass, one width the whole time | Width changes as you scan |

---

## 📝 Must-Know Problems

### 1. Maximum Sum Subarray of Size K — see Fixed-Size Window above.
**Time:** O(n). **Space:** O(1).

### 2. Longest Substring Without Repeating Characters

**Problem:** Find the length of the longest substring with no repeated characters.

- Input: `"abcabcbb"` → Output: `3` (`"abc"`)

```python
def length_of_longest_substring(s):
    char_set = set()
    left = 0
    max_length = 0
    for right in range(len(s)):
        while s[right] in char_set:      # shrink until the duplicate is gone
            char_set.remove(s[left])
            left += 1
        char_set.add(s[right])
        max_length = max(max_length, right - left + 1)
    return max_length
```

**Trace for `"abcabcbb"`:**

```
right=0 'a': set={}, add 'a' → set={a}, len=1, max=1
right=1 'b': not dup, add 'b' → set={a,b}, len=2, max=2
right=2 'c': not dup, add 'c' → set={a,b,c}, len=3, max=3
right=3 'a': dup! remove s[left]='a', left=1, set={b,c} → 'a' now ok, add → set={a,b,c}, len=3, max=3
right=4 'b': dup! remove s[left]='b', left=2, set={a,c} → 'b' ok, add → set={a,b,c}, len=3, max=3
right=5 'c': dup! remove s[left]='c', left=3, set={a,b} → 'c' ok, add → set={a,b,c}, len=3, max=3
right=6 'b': dup! shrink until 'b' removed → left ends at 5, set={c} → add 'b' → set={b,c}, len=2
right=7 'b': dup! shrink → set={} → add 'b' → set={b}, len=1
Result: max=3
```

**Time:** O(n) — each character is added and removed from the set at most once. **Space:** O(min(n, alphabet size)).

### 3. Minimum Window Substring

**Problem:** Find the smallest substring of `s` that contains every character of `t` (including duplicates).

- Input: `s = "ADOBECODEBANC"`, `t = "ABC"` → Output: `"BANC"`

```python
from collections import Counter

def min_window(s, t):
    if not t or not s:
        return ""
    required = Counter(t)
    window = {}
    have, need = 0, len(required)
    left = 0
    best_len, best_left = float('inf'), 0

    for right in range(len(s)):
        char = s[right]
        window[char] = window.get(char, 0) + 1
        if char in required and window[char] == required[char]:
            have += 1

        while have == need:                      # window is valid — try to shrink
            if right - left + 1 < best_len:
                best_len = right - left + 1
                best_left = left
            window[s[left]] -= 1
            if s[left] in required and window[s[left]] < required[s[left]]:
                have -= 1
            left += 1

    return s[best_left:best_left + best_len] if best_len != float('inf') else ""
```

**Key insight:** `have`/`need` tracks how many of `t`'s *distinct* required characters currently have enough copies in the window — once `have == need`, the window is valid, and you shrink from the left to find the minimum valid window before it becomes invalid again.

**Time:** O(n + m). **Space:** O(m) where m = size of `t`'s alphabet.

### 4. Longest Repeating Character Replacement

**Problem:** Given a string and an integer `k`, find the longest substring you can make into a single repeated character by changing at most `k` characters.

- Input: `s = "AABABBA"`, `k = 1` → Output: `4`

```python
def character_replacement(s, k):
    count = {}
    left = 0
    max_count = 0     # highest frequency of any single char in the current window
    result = 0

    for right in range(len(s)):
        count[s[right]] = count.get(s[right], 0) + 1
        max_count = max(max_count, count[s[right]])

        window_size = right - left + 1
        if window_size - max_count > k:     # too many chars would need replacing
            count[s[left]] -= 1
            left += 1

        result = max(result, right - left + 1)

    return result
```

**Key insight:** `window_size - max_count` = how many characters in the window are *not* the most frequent one — that's exactly how many replacements this window would need. If that exceeds `k`, shrink.

**Time:** O(n). **Space:** O(1) — at most 26 letters tracked.

### 5. Sliding Window Maximum

**Problem:** For every window of size `k`, return the maximum.

- Input: `nums = [1,3,-1,-3,5,3,6,7]`, `k = 3` → Output: `[3,3,5,5,6,7]`

```python
from collections import deque

def max_sliding_window(nums, k):
    dq = deque()   # store indices, values in decreasing order
    result = []
    for i, num in enumerate(nums):
        while dq and nums[dq[-1]] < num:      # remove smaller values, they're useless now
            dq.pop()
        dq.append(i)
        if dq[0] <= i - k:                     # remove index that's fallen out of the window
            dq.popleft()
        if i >= k - 1:
            result.append(nums[dq[0]])          # front of deque = max of current window
    return result
```

**Key insight:** a **monotonic deque** keeps candidate maximums in decreasing order — anything smaller than a newer element can never be the max again while that newer element is in the window, so it's safe to discard immediately.

**Time:** O(n) — each index enters and leaves the deque once. **Space:** O(k).

---

## 📊 Complexity Reference

| Approach | Time | Space |
|---|---|---|
| Brute force (recompute every window) | O(n·k) or O(n²) | O(1) |
| Sliding Window | O(n) | O(1) to O(k), depends on window state tracked |
| Sliding Window Maximum (monotonic deque) | O(n) | O(k) |

---

## ⚠️ Common Mistakes

- Fixed window: forgetting to remove the element that just left the window when sliding.
- Wrong size formula: window size is `right - left + 1`, not `right - left`.
- Fixed window: forgetting to initialize/process the first window before the main sliding loop.
- Trying to apply sliding window to a **non-contiguous** problem (subsequences) — it doesn't apply there.
- Variable window: shrinking with `if` instead of `while` — a single shrink step isn't always enough to restore validity.

---

## 💡 Interview Tips

1. Say explicitly whether it's fixed or variable size — it changes the template shape and shows you've correctly parsed the problem.
2. For variable-window problems, narrate the invariant: "the window stays valid until X, then I shrink from the left until it's valid again."
3. If you're tracking character counts, mention whether the alphabet is bounded (e.g. lowercase letters → O(1) auxiliary space) — this affects your stated space complexity.

---

## 🔗 Related Topics

- Sliding window **is** a specialized two-pointer technique — `left` and `right` bound the window.
- Frequently paired with a **HashMap/Counter** to track window contents, or a **deque** for window-maximum-style problems.
- Works on arrays and strings, not linked lists — needs contiguous, indexable access.

---

## 🚀 Practice List

**Easy:** Maximum Average Subarray I, Contains Duplicate II

**Medium:** Longest Substring Without Repeating Characters, Longest Repeating Character Replacement, Permutation in String, Fruit Into Baskets, Max Consecutive Ones III

**Hard:** Minimum Window Substring, Sliding Window Maximum, Substring with Concatenation of All Words
