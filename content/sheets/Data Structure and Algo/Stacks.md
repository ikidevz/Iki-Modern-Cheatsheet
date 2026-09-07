# Stacks — Complete Cheat Sheet

## 📖 Overview

A **Stack** follows **LIFO** — Last In, First Out. You can only add or remove from one end (the "top"), like a stack of plates: the last plate you put down is the first one you pick back up. Every core operation — push, pop, peek — runs in O(1).

Stacks show up everywhere under the hood: the **call stack** that manages function calls, the undo button in almost every app, and the browser's back button.

---

## 🎯 When to Use

- Need to **match pairs** — brackets, tags, nested delimiters
- Need the **most recent** item first — undo/redo, history
- **Parsing or evaluating expressions**
- **"Next greater/smaller element"** style problems — think **monotonic stack**
- Implementing **iterative DFS** without recursion
- Anything that needs to be processed in **reverse order** of arrival

---

## 🧩 Core Operations

```python
stack = []
stack.append(x)     # push  — O(1)
top = stack[-1]      # peek  — O(1)
stack.pop()           # pop   — O(1), removes AND returns
len(stack) == 0        # is_empty check
```

A full class version, for clarity on what each op does:

```python
class Stack:
    def __init__(self):
        self.items = []

    def push(self, item):
        self.items.append(item)

    def pop(self):
        return self.items.pop() if not self.is_empty() else None

    def peek(self):
        return self.items[-1] if not self.is_empty() else None

    def is_empty(self):
        return len(self.items) == 0

    def size(self):
        return len(self.items)
```

---

## 🧩 Pattern 1: Matching Pairs

Push openers; on a closer, check the top of the stack matches — pop if it does, fail if it doesn't.

```python
def is_valid(s):
    stack = []
    mapping = {')': '(', ']': '[', '}': '{'}
    for char in s:
        if char in mapping:              # closing bracket
            if not stack or stack[-1] != mapping[char]:
                return False
            stack.pop()
        else:                             # opening bracket
            stack.append(char)
    return not stack
```

**Trace for `"{[()]}"`:**

```
'{' → push  → stack: ['{']
'[' → push  → stack: ['{', '[']
'(' → push  → stack: ['{', '[', '(']
')' → match → stack: ['{', '[']       (popped '(')
']' → match → stack: ['{']            (popped '[')
'}' → match → stack: []               (popped '{')
Result: stack empty → Valid!
```

---

## 🧩 Pattern 2: Monotonic Stack

Maintain the stack in strictly increasing or decreasing order. When a new element would break that order, pop elements until it doesn't — each pop is a chance to answer a query ("what's the next greater element for the one I just popped?").

```python
def daily_temperatures(temperatures):
    n = len(temperatures)
    result = [0] * n
    stack = []  # store indices, temps at those indices stay decreasing

    for i, temp in enumerate(temperatures):
        while stack and temperatures[stack[-1]] < temp:
            prev_index = stack.pop()
            result[prev_index] = i - prev_index   # found the "next warmer day"
        stack.append(i)

    return result
```

**Trace for `[73, 74, 75, 71, 69, 72, 76, 73]`:**

```
i=0 temp=73 → stack: [0]
i=1 temp=74 > 73 → pop 0, result[0]=1 → stack: [1]
i=2 temp=75 > 74 → pop 1, result[1]=1 → stack: [2]
i=3 temp=71 < 75 → stack: [2, 3]
i=4 temp=69 < 71 → stack: [2, 3, 4]
i=5 temp=72 > 69, 71 → pop 4 (result[4]=1), pop 3 (result[3]=2) → stack: [2, 5]
i=6 temp=76 > 72, 75 → pop 5 (result[5]=1), pop 2 (result[2]=4) → stack: [6]
i=7 temp=73 < 76 → stack: [6, 7]

Result: [1, 1, 4, 2, 1, 1, 0, 0]
```

Every index is pushed once and popped at most once, so despite the nested-looking `while`, this is **O(n)** overall, not O(n²).

---

## 🧩 Pattern 3: Stack + HashMap (Min Stack)

Combine a stack with an auxiliary structure to answer O(1) queries a plain stack can't.

```python
class MinStack:
    def __init__(self):
        self.stack = []
        self.min_stack = []   # min_stack[i] = min of stack[0..i]

    def push(self, val):
        self.stack.append(val)
        current_min = min(val, self.min_stack[-1]) if self.min_stack else val
        self.min_stack.append(current_min)

    def pop(self):
        self.stack.pop()
        self.min_stack.pop()

    def top(self):
        return self.stack[-1]

    def get_min(self):
        return self.min_stack[-1]   # O(1)!
```

---

## 📝 Must-Know Problems

### 1. Valid Parentheses — see Pattern 1 above.
**Time:** O(n). **Space:** O(n) worst case (all openers).

### 2. Daily Temperatures — see Pattern 2 above.
**Time:** O(n) amortized. **Space:** O(n).

### 3. Evaluate Reverse Polish Notation

**Problem:** Evaluate a math expression given in postfix notation (operands first, operator last).

- Input: `["2", "1", "+", "3", "*"]` → Output: `9` (meaning `(2 + 1) * 3`)

```python
def eval_rpn(tokens):
    stack = []
    operators = {'+', '-', '*', '/'}
    for token in tokens:
        if token in operators:
            b = stack.pop()
            a = stack.pop()
            if token == '+': result = a + b
            elif token == '-': result = a - b
            elif token == '*': result = a * b
            else: result = int(a / b)   # truncate toward zero
            stack.append(result)
        else:
            stack.append(int(token))
    return stack[-1]
```

**Trace:** `["2","1","+","3","*"]` → push 2 → push 1 → `+`: pop 1, pop 2, push 3 → push 3 → `*`: pop 3, pop 3, push 9 → result `9`.

**Time:** O(n). **Space:** O(n).

### 4. Min Stack — see Pattern 3 above.
**Time:** O(1) for all operations. **Space:** O(n).

### 5. Asteroid Collision

**Problem:** Asteroids move left (`-`) or right (`+`); when two collide, the smaller explodes (equal sizes: both explode).

- Input: `[5, 10, -5]` → Output: `[5, 10]` (10 destroys -5)

```python
def asteroid_collision(asteroids):
    stack = []
    for a in asteroids:
        alive = True
        while alive and a < 0 and stack and stack[-1] > 0:
            if stack[-1] < -a:
                stack.pop()          # top asteroid destroyed, keep checking
            elif stack[-1] == -a:
                stack.pop()          # both destroyed
                alive = False
            else:
                alive = False        # current asteroid destroyed
        if alive:
            stack.append(a)
    return stack
```

**Time:** O(n) — each asteroid is pushed and popped at most once. **Space:** O(n).

---

## 📊 Complexity Reference

| Feature | Stack | Queue | Array |
|---|---|---|---|
| Access pattern | LIFO | FIFO | Random access |
| Add | Top only, O(1) | End only, O(1) | Anywhere, O(n) shifting |
| Remove | Top only, O(1) | Front only, O(1) | Anywhere, O(n) shifting |
| Use case | Undo, backtrack, parse, DFS | Process in order, BFS | General purpose |

---

## ⚠️ Common Mistakes

- Not checking `if not stack` before `pop()` or peeking — crashes on empty stack.
- Forgetting `pop()` both **removes and returns** — don't call it twice expecting the same value from both calls.
- Using `stack[0]` (bottom) when you meant `stack[-1]` (top).
- Trying to solve an "in original order" problem with a plain stack — a stack naturally reverses order, which is the opposite of what you want unless that's the point.

---

## 💡 Interview Tips

1. Say "LIFO" out loud when you recognize the pattern — it's a quick signal you know why a stack fits.
2. For "next greater/smaller element" problems, say "monotonic stack" specifically — it's a well-known named pattern and shows depth.
3. Always check for empty stack before popping — interviewers watch for this.
4. If a problem feels like "process in reverse," think stack; if it feels like "process in original order, level by level," think queue.

---

## 🔗 Related Topics

- **Trees** — iterative DFS traversal (inorder/preorder/postorder) uses an explicit stack.
- **Linked Lists** — can be reversed by pushing every node onto a stack, then popping (LIFO naturally flips the order).
- **Recursion** — every function call implicitly uses the call stack; deep recursion can cause a stack overflow the same way an unbounded explicit stack would.
- **Backtracking** — DFS + undo, which is exactly what a stack-based traversal does explicitly.

---

## 🚀 Practice List

**Easy:** Valid Parentheses, Baseball Game, Backspace String Compare, Min Stack

**Medium:** Daily Temperatures, Evaluate Reverse Polish Notation, Decode String, Asteroid Collision, Next Greater Element II
