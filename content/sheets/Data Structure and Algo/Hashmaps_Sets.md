# Hashmaps & Sets — Complete Cheat Sheet

## 📖 Overview

A **HashMap** (dict / Map) stores **key → value** pairs and gives O(1) average-time insert, lookup, and delete. A **Set** is the same idea with no values attached — just unique elements with O(1) average membership checks.

Both are built on a **hash function**: a formula that converts a key into an array index, so the underlying storage can jump straight to (roughly) the right slot instead of scanning.

```
key "Alice" → hash function → index 7 → bucket[7] = ("Alice", 95)
```

When two different keys hash to the same index (a **collision**), most implementations store a small list ("chain") at that index and fall back to a linear scan within it — which is where the O(n) worst case comes from.

---

## 🎯 When to Use

| Signal | Structure |
|---|---|
| "Have I seen this before?" | Set |
| Need to count / track frequency of items | HashMap |
| Need O(1) lookup by some key | HashMap |
| Need to find a "complement" (`target - x`) | HashMap |
| Need to remove duplicates | Set |
| Need to group items by some computed signature | HashMap of lists |
| Need set math: union / intersection / difference | Set |
| Need a fast way to map one thing to another (old → new, name → id) | HashMap |

---

## 🧩 Core Patterns

### Pattern 1: Complement Lookup

Store what you've seen; for each new element, check if its "partner" already exists.

```python
def two_sum(nums, target):
    seen = {}  # value -> index
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:      # O(1) check
            return [seen[complement], i]
        seen[num] = i
    return []
```

**Trace for `nums = [2, 7, 11, 15]`, `target = 9`:**

```
i=0, num=2 → complement=7, seen={} → not found → seen={2: 0}
i=1, num=7 → complement=2, seen={2: 0} → FOUND! return [0, 1]
```

### Pattern 2: Frequency Counting

```python
from collections import defaultdict, Counter

# Manual
word_count = {}
for word in words:
    word_count[word] = word_count.get(word, 0) + 1

# defaultdict — no need to check if key exists
word_count = defaultdict(int)
for word in words:
    word_count[word] += 1

# Counter — purpose-built, has extras like most_common()
word_count = Counter(words)
word_count.most_common(3)     # top 3 most frequent
```

### Pattern 3: Grouping by Signature

Compute a key that's the same for all items in a group, and bucket them.

```python
def group_anagrams(words):
    groups = defaultdict(list)
    for word in words:
        key = ''.join(sorted(word))   # "eat" -> "aet"
        groups[key].append(word)
    return list(groups.values())
```

### Pattern 4: Membership / Deduplication with Sets

```python
def contains_duplicate(nums):
    return len(nums) != len(set(nums))

def dedupe_preserve_order(items):
    seen = set()
    result = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result
```

### Pattern 5: Set Math

```python
purchasers  = {101, 102, 103, 104}
subscribers = {102, 104, 105}

purchasers | subscribers   # union: {101, 102, 103, 104, 105}
purchasers & subscribers   # intersection: {102, 104}
purchasers - subscribers   # difference: {101, 103}  (bought but never subscribed)
purchasers ^ subscribers   # symmetric difference: {101, 103, 105}
```

---

## 💻 Core Templates

```python
# Basic dict operations
d = {}
d["key"] = "value"       # insert/update — O(1) avg
value = d.get("key")     # safe lookup, returns None if missing — O(1) avg
value = d["key"]         # raises KeyError if missing
"key" in d                # membership check — O(1) avg
del d["key"]              # delete — O(1) avg
d.keys(), d.values(), d.items()   # views for iteration

# Set operations
s = set()
s.add(x)                  # O(1) avg
s.discard(x)               # O(1) avg, no error if missing
s.remove(x)                 # O(1) avg, raises KeyError if missing
x in s                      # O(1) avg
```

---

## 📝 Must-Know Problems

### 1. Two Sum

**Problem:** Given an array and a target, return indices of two numbers that add up to the target.

- Input: `nums = [2, 7, 11, 15]`, `target = 9` → Output: `[0, 1]`

Solution and trace shown above under Pattern 1. **Time:** O(n) — single pass. **Space:** O(n) — the `seen` dict.

**Why it matters:** the "complement lookup" pattern generalizes to any "find a matching pair" problem — recommendation engines pairing complementary items, duplicate/near-duplicate detection, matching transactions.

### 2. Contains Duplicate

**Problem:** Does the array contain any value more than once?

- Input: `[1, 2, 3, 1]` → Output: `True`

```python
def contains_duplicate(nums):
    seen = set()
    for num in nums:
        if num in seen:
            return True
        seen.add(num)
    return False
```

**Time:** O(n). **Space:** O(n).

### 3. Group Anagrams

**Problem:** Group words that are anagrams of each other.

- Input: `["eat", "tea", "tan", "ate", "nat", "bat"]`
- Output: `[["eat","tea","ate"], ["tan","nat"], ["bat"]]`

Solution shown under Pattern 3.

**Trace:**
```
"eat" → sorted "aet" → groups = {"aet": ["eat"]}
"tea" → sorted "aet" → groups = {"aet": ["eat", "tea"]}
"tan" → sorted "ant" → groups = {"aet": [...], "ant": ["tan"]}
"ate" → sorted "aet" → groups["aet"] += "ate"
"nat" → sorted "ant" → groups["ant"] += "nat"
"bat" → sorted "abt" → new group
```

**Time:** O(n · k log k) where k = average word length (sorting each word). **Space:** O(n · k).

### 4. Top K Frequent Elements

**Problem:** Return the k most frequent elements.

- Input: `nums = [1,1,1,2,2,3]`, `k = 2` → Output: `[1, 2]`

```python
from collections import Counter
import heapq

def top_k_frequent(nums, k):
    count = Counter(nums)
    return heapq.nlargest(k, count.keys(), key=count.get)
```

**Time:** O(n log k) using a heap (see the Heaps sheet). **Space:** O(n).

### 5. Longest Consecutive Sequence

**Problem:** Find the length of the longest run of consecutive integers (order in the array doesn't matter).

- Input: `[100, 4, 200, 1, 3, 2]` → Output: `4` (the sequence `1, 2, 3, 4`)

```python
def longest_consecutive(nums):
    num_set = set(nums)
    longest = 0
    for num in num_set:
        if num - 1 not in num_set:      # only start counting from sequence starts
            length = 1
            while num + length in num_set:
                length += 1
            longest = max(longest, length)
    return longest
```

**Key insight:** only start counting from numbers that are the *start* of a sequence (no `num - 1` in the set) — this keeps the total work O(n) instead of O(n²), because every number is visited by its inner `while` loop at most once across the whole run.

---

## 📊 Complexity Reference

| Operation | HashMap | Set |
|---|---|---|
| Insert | O(1) avg, O(n) worst | O(1) avg, O(n) worst |
| Delete | O(1) avg, O(n) worst | O(1) avg, O(n) worst |
| Search / membership | O(1) avg, O(n) worst | O(1) avg, O(n) worst |
| Iteration | O(n) | O(n) |
| Space | O(n) | O(n) |

**Why "worst case O(n)"?** If every key hashes to the same bucket (a pathological or adversarial hash function), lookups degrade to a linear scan through that one bucket. This is rare in practice with good hash functions, but it's why "O(1)" for hash-based structures always comes with an "average case" asterisk.

---

## ⚠️ Common Mistakes

- Using a **mutable object** (like a list) as a dict key or set element — they aren't hashable. Use a tuple instead: `d[(x, y)] = value`.
- Assuming iteration order is meaningful for your logic. Modern Python preserves insertion order, but relying on it silently couples your code to an implementation detail — be explicit if order matters.
- Calling `dict[key]` when the key might not exist (raises `KeyError`) instead of `.get(key)` or `.get(key, default)`.
- Forgetting that checking `x in list` is O(n) — converting to a `set` first before repeated membership checks is one of the most common "quick win" optimizations.
- Mutating a dict/set while iterating over it — raises `RuntimeError` in Python. Iterate over a copy (`list(d.keys())`) if you need to modify during the loop.

---

## 💡 Interview Tips

1. If you catch yourself writing a nested loop to check "does this exist elsewhere in the array," pause — a HashMap probably turns it into a single pass.
2. State the trade-off out loud: "I can do this with two pointers in O(1) space if the array is sorted, or with a HashMap in O(n) space if it isn't."
3. For frequency problems, `collections.Counter` is usually cleaner than manual dict bookkeeping — mention you know about it even if you write it manually to show the mechanics.

---

## 🔗 Related Topics

- **Two Pointers** — an alternative to HashMap for sorted-array pair problems; O(1) space instead of O(n), but requires sorted input.
- **Sliding Window** — frequently pairs with a HashMap to track the contents/frequency of the current window.
- **Graphs** — an adjacency list *is* a HashMap (key = node, value = list of neighbors).
- **Trees** — HashMaps show up for parent-pointer maps, memoization in tree DP, and node cloning.

---

## 🚀 Practice List

**Easy:** Two Sum, Contains Duplicate, Valid Anagram, Jewels and Stones, Single Number, Ransom Note

**Medium:** Group Anagrams, Top K Frequent Elements, Longest Consecutive Sequence, Subarray Sum Equals K, 4Sum II, Insert Delete GetRandom O(1)
