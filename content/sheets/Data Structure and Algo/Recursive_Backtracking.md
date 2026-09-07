# Recursive Backtracking — Complete Cheat Sheet

## 📖 Overview

**Backtracking** builds a solution one choice at a time, and the moment a partial solution can't possibly lead anywhere valid, it **undoes the last choice** and tries a different one. It's DFS through a tree of decisions, with the ability to prune entire branches early instead of exploring them to the end.

```
Building subsets of [1, 2]:

                    []
                 /      \
              [1]        []
             /   \       /  \
        [1,2]   [1]   [2]   []
          ↑ leaf  ↑ leaf ↑leaf ↑leaf

Each leaf (and every intermediate node, for subsets) is a valid answer.
```

The word "backtracking" specifically refers to the **undo** step — after exploring a branch fully, you reverse whatever change you made before trying the next option, so the state is clean for the next choice.

---

## 🎯 When to Use

- The problem wants **ALL** solutions, or **every way** to do something — not just one
- There are explicit **constraints** a solution must satisfy
- A solution is built up **incrementally**, and partial validity can be checked as you go
- Combinatorics: subsets, permutations, combinations
- Keywords: "all possible," "generate all," "find all," "every way to"

---

## 🧩 The Three Pillars

Every backtracking problem answers three questions:

1. **Choice** — at this step, what are the options?
2. **Constraint** — when is a choice invalid, and can I detect that *before* fully exploring it (pruning)?
3. **Goal** — how do I know a solution is complete?

---

## 🧩 The Universal Template

```python
def backtrack(state, choices):
    if is_complete(state):                  # Goal
        result.append(state.copy())          # copy! state keeps mutating after this
        return

    for choice in choices:
        if is_valid(choice, state):           # Constraint
            make_choice(state, choice)         # Choose
            backtrack(state, next_choices)      # Explore
            undo_choice(state, choice)           # Un-choose — the "backtrack"
```

**Why `.copy()` matters:** `state` is a single mutable object being built and torn down throughout the whole recursion. If you append a *reference* to it instead of a copy, every entry in `result` ends up pointing at the same object — which will have been mutated back to empty (or something else entirely) by the time you're done. This is the single most common backtracking bug.

---

## 📝 Must-Know Problems

### 1. Subsets

**Problem:** Return all possible subsets of a set of distinct integers.

- Input: `[1, 2, 3]` → Output: `[[], [1], [2], [1,2], [3], [1,3], [2,3], [1,2,3]]`

```python
def subsets(nums):
    result = []
    def backtrack(start, current):
        result.append(current[:])            # every partial state is itself a valid subset
        for i in range(start, len(nums)):
            current.append(nums[i])            # choose
            backtrack(i + 1, current)            # explore
            current.pop()                         # un-choose
    backtrack(0, [])
    return result
```

**Key insight:** unlike permutations, every node in the recursion tree — not just the leaves — is a valid answer, so the result is appended at the *top* of the function, before the loop.

**Time:** O(n · 2ⁿ) — 2ⁿ subsets, O(n) to copy each. **Space:** O(n) recursion depth + O(n · 2ⁿ) output.

### 2. Permutations

**Problem:** Return all possible orderings of a set of distinct integers.

- Input: `[1, 2, 3]` → Output: `[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]`

```python
def permute(nums):
    result = []
    def backtrack(current, used):
        if len(current) == len(nums):           # Goal: used every number exactly once
            result.append(current[:])
            return
        for i, num in enumerate(nums):
            if i not in used:                     # Constraint: not already used
                current.append(num)                 # Choose
                used.add(i)
                backtrack(current, used)              # Explore
                used.remove(i)                          # Un-choose
                current.pop()
    backtrack([], set())
    return result
```

**Key insight:** unlike subsets, we track *which indices are used* rather than a start index, because every element can still be picked from any position — order matters and every element must appear exactly once.

**Time:** O(n · n!) — n! permutations, O(n) to copy each. **Space:** O(n) recursion depth.

### 3. Combination Sum

**Problem:** Given candidates (can be reused) and a target, find all unique combinations that sum to the target.

- Input: `candidates = [2,3,6,7]`, `target = 7` → Output: `[[2,2,3],[7]]`

```python
def combination_sum(candidates, target):
    result = []
    def backtrack(start, current, remaining):
        if remaining == 0:                        # Goal
            result.append(current[:])
            return
        if remaining < 0:                          # Constraint: pruned, overshoot
            return
        for i in range(start, len(candidates)):
            current.append(candidates[i])
            backtrack(i, current, remaining - candidates[i])   # note: i, not i+1 — allows reuse
            current.pop()
    backtrack(0, [], target)
    return result
```

**Key insight:** passing `i` (not `i + 1`) to the recursive call allows the same element to be reused; the `remaining < 0` check prunes a branch the moment it can't possibly work, instead of exploring it fully first.

**Time:** O(2ᵗ) in the worst case (t = target), heavily pruned in practice. **Space:** O(target / min(candidates)) recursion depth.

### 4. N-Queens

**Problem:** Place `n` queens on an `n×n` board so none attack each other.

```python
def solve_n_queens(n):
    result = []
    cols, diagonals, anti_diagonals = set(), set(), set()
    board = [['.'] * n for _ in range(n)]

    def backtrack(row):
        if row == n:                               # Goal: placed a queen in every row
            result.append([''.join(r) for r in board])
            return
        for col in range(n):
            diag, anti_diag = row - col, row + col
            if col in cols or diag in diagonals or anti_diag in anti_diagonals:
                continue                              # Constraint: under attack, skip
            cols.add(col); diagonals.add(diag); anti_diagonals.add(anti_diag)
            board[row][col] = 'Q'
            backtrack(row + 1)                          # Explore
            cols.remove(col); diagonals.remove(diag); anti_diagonals.remove(anti_diag)
            board[row][col] = '.'                          # Un-choose

    backtrack(0)
    return result
```

**Key insight:** every cell on the same diagonal shares the same `row - col`; every cell on the same anti-diagonal shares the same `row + col`. Tracking these in sets turns an O(n) attack check into O(1).

**Time:** O(n!), heavily pruned by the constant-time attack checks. **Space:** O(n).

### 5. Word Search

**Problem:** Given a grid of letters and a word, determine if the word can be constructed from adjacent cells (no cell reused).

```python
def exist(board, word):
    rows, cols = len(board), len(board[0])

    def backtrack(r, c, i):
        if i == len(word):                          # Goal: matched every character
            return True
        if (r < 0 or r >= rows or c < 0 or c >= cols
                or board[r][c] != word[i]):            # Constraint: out of bounds or mismatch
            return False

        temp = board[r][c]
        board[r][c] = '#'                              # mark visited (choose)
        found = (backtrack(r+1, c, i+1) or backtrack(r-1, c, i+1) or
                 backtrack(r, c+1, i+1) or backtrack(r, c-1, i+1))
        board[r][c] = temp                              # restore (un-choose)
        return found

    return any(backtrack(r, c, 0) for r in range(rows) for c in range(cols))
```

**Key insight:** temporarily overwriting the visited cell (instead of a separate `visited` set) is a cheap O(1) way to prevent reuse within the current path, and it's undone immediately on the way back out — classic backtracking.

**Time:** O(rows · cols · 4^L), L = word length. **Space:** O(L) recursion depth.

---

## 📊 Complexity by Problem Shape

| Problem | Choices per step | Steps | Time (before pruning) |
|---|---|---|---|
| Subsets | 2 (include / exclude) | n | O(2ⁿ) |
| Permutations | n, n-1, n-2, ... | n | O(n!) |
| Combinations (choose k of n) | shrinking | k | O(C(n, k)) |
| Combination Sum (with reuse) | up to n | up to target | O(2^target) worst case |
| N-Queens | n, aggressively pruned | n | O(n!) unpruned, far less in practice |

Space: O(depth of recursion) for the call stack, plus O(number of results × size of each) to store the output.

---

## ⚠️ Common Mistakes

- Forgetting `.copy()` (or `current[:]`) when appending to results — later mutations silently corrupt every stored answer.
- Forgetting the **undo** step after recursing — without it, backtracking degrades into "explore forward only," and later branches see stale state from earlier ones.
- Not pruning early — checking validity only once a full solution is built wastes enormous amounts of work; check as early as possible (after every partial choice, not just at the end).
- Not skipping duplicate choices when the input has repeated values but the problem wants unique results — usually requires sorting first, then skipping adjacent duplicates at the same recursion depth.
- Passing `i + 1` when reuse should be allowed (or vice versa) — this is the single easiest way to break Combination Sum-style problems.

---

## 💡 Interview Tips

1. Explicitly state the three pillars before coding: "the choice at each step is X, the constraint is Y, and I know I'm done when Z."
2. Mention pruning opportunities out loud, even simple ones — "I'll stop exploring this branch early if the running sum already exceeds the target" shows you're not just brute-forcing.
3. If asked for time complexity, give the *theoretical* worst case (e.g. O(2ⁿ)) and mention that pruning makes the *practical* runtime much better — both halves of that answer matter.
4. Draw the decision tree for a tiny input (n=2 or 3) before coding — it makes the choose/explore/un-choose structure concrete.

---

## 🔗 Related Topics

- Backtracking **is** DFS on a decision tree (**Trees**), with an explicit undo step.
- It uses the call stack the same way an explicit **Stack** would for iterative DFS.
- **Graphs** — "find all paths" problems are backtracking on a graph instead of an implicit tree.
- Contrast with **Dynamic Programming**: DP applies when subproblems *overlap* and you want an optimal value (memoize to avoid recomputation); backtracking applies when you need *every* solution and choices don't share reusable overlapping subresults in the same way.

---

## 🚀 Practice List

**Easy:** Binary Tree Paths (backtracking on a tree)

**Medium:** Subsets, Permutations, Combination Sum, Combination Sum II, Word Search, Palindrome Partitioning, Letter Combinations of a Phone Number, Generate Parentheses

**Hard:** N-Queens, Word Search II, Sudoku Solver
