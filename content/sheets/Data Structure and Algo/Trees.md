# Trees — Complete Cheat Sheet

## 📖 Overview

A **Tree** is a hierarchical structure: one **root** node, with **children** branching downward, and no cycles. A tree with `n` nodes always has exactly `n - 1` edges. Because every subtree is itself a valid tree, recursion is the natural tool for almost everything you do with trees.

```
        1              root
       / \
      2   3            level 1
     / \   \
    4   5   6           level 2 (leaves: 4, 5, 6)
```

- **Root:** the top node (1)
- **Leaf:** a node with no children (4, 5, 6)
- **Height** of a node: longest path down to a leaf
- **Depth** of a node: distance from the root up to it
- **Subtree:** any node plus everything below it

---

## 🎯 When to Use

- Hierarchical data — file systems, org charts, category trees, DOM
- Sorted data that needs efficient search **and** insert/delete → **BST**
- Nested structure parsing — JSON/XML, mathematical expressions
- Decision logic / classification (decision trees)
- Autocomplete / prefix matching → **Trie**, a specialized tree

---

## 🌳 Tree Types

| Type | Property |
|---|---|
| Binary Tree | Each node has at most 2 children |
| Binary Search Tree (BST) | For every node: left subtree < node < right subtree |
| Balanced BST (AVL, Red-Black) | Height difference between subtrees is bounded (usually ≤ 1) |
| Complete Binary Tree | Every level full except possibly the last, filled left to right |
| Full Binary Tree | Every node has 0 or 2 children, never 1 |
| Perfect Binary Tree | All leaves at the same depth, every internal node has 2 children |
| Trie (prefix tree) | Each edge represents a character; used for strings |

---

## 🧭 Traversals

| Traversal | Order | Typical Use |
|---|---|---|
| Inorder (DFS) | Left → Root → Right | Produces sorted order on a BST |
| Preorder (DFS) | Root → Left → Right | Copying a tree, prefix expression notation |
| Postorder (DFS) | Left → Right → Root | Deleting a tree, postfix expression notation |
| Level Order (BFS) | Level by level, left to right | Shortest path in an unweighted tree, level-based logic |

```python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def inorder(root):
    if not root: return []
    return inorder(root.left) + [root.val] + inorder(root.right)

def preorder(root):
    if not root: return []
    return [root.val] + preorder(root.left) + preorder(root.right)

def postorder(root):
    if not root: return []
    return postorder(root.left) + postorder(root.right) + [root.val]
```

**Trace of all three on the tree above (`1` root, `2,3` children, `4,5` under `2`, `6` under `3`):**

```
Inorder:   4, 2, 5, 1, 3, 6
Preorder:  1, 2, 4, 5, 3, 6
Postorder: 4, 5, 2, 6, 3, 1
```

---

## 🧩 The Universal Recursive Pattern

Almost every tree problem follows this shape:

```python
def tree_function(root):
    if not root:                              # 1. base case — usually the empty tree
        return base_value
    left_result = tree_function(root.left)     # 2. recurse left
    right_result = tree_function(root.right)   # 2. recurse right
    return combine(root.val, left_result, right_result)   # 3. combine
```

Almost all differences between tree problems come down to what `base_value` and `combine` are.

```python
def max_depth(root):
    if not root:
        return 0
    return 1 + max(max_depth(root.left), max_depth(root.right))

def count_nodes(root):
    if not root:
        return 0
    return 1 + count_nodes(root.left) + count_nodes(root.right)

def sum_tree(root):
    if not root:
        return 0
    return root.val + sum_tree(root.left) + sum_tree(root.right)
```

---

## 🧩 Level Order (BFS) Template

```python
from collections import deque

def level_order(root):
    if not root:
        return []
    result, queue = [], deque([root])
    while queue:
        level = []
        for _ in range(len(queue)):          # process exactly one level at a time
            node = queue.popleft()
            level.append(node.val)
            if node.left: queue.append(node.left)
            if node.right: queue.append(node.right)
        result.append(level)
    return result
```

**Trace on the sample tree:**

```
queue=[1] → process 1, push 2,3 → level=[1]
queue=[2,3] → process both, push 4,5,6 → level=[2,3]
queue=[4,5,6] → process all, push nothing → level=[4,5,6]
Result: [[1], [2,3], [4,5,6]]
```

---

## 📝 Must-Know Problems

### 1. Maximum Depth of Binary Tree — see recursive pattern above. **Time:** O(n). **Space:** O(h), h = tree height (call stack).

### 2. Invert Binary Tree

**Problem:** Mirror a binary tree — swap every node's left and right children.

```python
def invert_tree(root):
    if not root:
        return None
    root.left, root.right = invert_tree(root.right), invert_tree(root.left)
    return root
```

**Time:** O(n). **Space:** O(h).

### 3. Validate Binary Search Tree

**Problem:** Check if a tree satisfies the BST property everywhere, not just locally.

```python
def is_valid_bst(root, low=float('-inf'), high=float('inf')):
    if not root:
        return True
    if not (low < root.val < high):
        return False
    return (is_valid_bst(root.left, low, root.val) and
            is_valid_bst(root.right, root.val, high))
```

**Key insight:** checking only `node.left.val < node.val < node.right.val` at each node is **not enough** — a node deep in the left subtree must be less than *every* ancestor above it, not just its immediate parent. Passing down a shrinking `(low, high)` range enforces the *global* constraint.

**Time:** O(n). **Space:** O(h).

### 4. Level Order Traversal — see BFS template above. **Time:** O(n). **Space:** O(n) (widest level, worst case).

### 5. Lowest Common Ancestor of a Binary Tree

**Problem:** Find the lowest node that has both `p` and `q` as descendants.

```python
def lowest_common_ancestor(root, p, q):
    if not root or root == p or root == q:
        return root
    left = lowest_common_ancestor(root.left, p, q)
    right = lowest_common_ancestor(root.right, p, q)
    if left and right:         # p and q found on different sides — root is the split point
        return root
    return left if left else right
```

**Key insight:** if `p` and `q` are found in *different* subtrees of the current node, that node is the LCA — it's the point where their paths from the root diverge. If both come back from the same side, keep bubbling that answer up.

**Time:** O(n). **Space:** O(h).

---

## 📊 Complexity Reference

| Operation | Binary Tree (general) | BST (balanced) | BST (worst / degenerate) |
|---|---|---|---|
| Search | O(n) | O(log n) | O(n) |
| Insert | — (structure-dependent) | O(log n) | O(n) |
| Delete | — (structure-dependent) | O(log n) | O(n) |
| Traversal (any order) | O(n) | O(n) | O(n) |
| Space (recursion) | O(h) | O(log n) | O(n) |

**Degenerate BST:** inserting already-sorted data into a plain BST with no rebalancing produces a tree that's really just a linked list — every operation degrades to O(n). This is exactly why self-balancing trees (AVL, Red-Black) exist.

---

## ⚠️ Common Mistakes

- Forgetting the base case (`if not root: return ...`) → infinite recursion or a crash.
- Validating a BST by checking only immediate parent-child relationships instead of the full ancestor range.
- Confusing **height** (down to the deepest leaf) with **depth** (up from the root) — they're measured in opposite directions.
- Modifying tree structure (e.g. reassigning `.left`/`.right`) while still traversing it, causing skipped or revisited nodes.
- Assuming a tree is balanced without checking — worst-case complexity can silently become O(n) instead of O(log n).

---

## 💡 Interview Tips

1. Say "I'll use recursion" and name the base case out loud before writing code — it's the part most likely to have a subtle bug.
2. For BST problems, always ask (or state your assumption): does the tree contain duplicate values? It changes the validity condition (`<` vs `<=`).
3. If asked for an iterative solution, mention you're substituting an explicit **stack** (DFS) or **queue** (BFS) for the call stack.
4. When a problem says "path" or "distance," clarify whether it means node-to-node through the tree structure, or a straight root-to-leaf path — these require different traversal logic.

---

## 🔗 Related Topics

- **Recursion** — trees are the canonical recursive data structure; understanding trees well makes recursion click.
- **Stack** — iterative DFS traversal.
- **Queue** — BFS / level-order traversal.
- **Heaps** — a complete binary tree, but usually array-backed instead of pointer-backed, with a weaker ordering guarantee (only parent-child, not left-right).
- **Tries** — trees specialized for strings, where each edge is a character rather than an arbitrary value.
- **Graphs** — a tree is a connected, acyclic, undirected graph; tree algorithms are a special case of graph algorithms.

---

## 🚀 Practice List

**Easy:** Maximum Depth of Binary Tree, Invert Binary Tree, Same Tree, Symmetric Tree, Path Sum, Diameter of Binary Tree

**Medium:** Validate Binary Search Tree, Level Order Traversal, Lowest Common Ancestor of a BST, Kth Smallest Element in a BST, Construct Binary Tree from Preorder and Inorder Traversal, Binary Tree Right Side View

**Hard:** Binary Tree Maximum Path Sum, Serialize and Deserialize Binary Tree
