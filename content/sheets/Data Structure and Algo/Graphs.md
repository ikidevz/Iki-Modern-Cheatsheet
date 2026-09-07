# Graphs — Complete Cheat Sheet

## 📖 Overview

A **Graph** `G = (V, E)` is a set of **vertices** (nodes) connected by **edges**. It's the most general way to model relationships — trees, linked lists, and grids are all special cases of graphs. Anything that's "things connected to other things" — maps, social networks, dependency chains, web pages — is naturally a graph.

```
Undirected:        Directed:           Weighted:
  A --- B            A --> B             A --5-- B
  |     |             ^     \             |       |
  C --- D             C <----D           3|       |7
                                           C ------D
                                               2
```

Before touching a graph problem, clarify four things:

| Question | Options | Why it matters |
|---|---|---|
| Directed? | A→B only, or A↔B | Changes how you build the adjacency list and detect cycles |
| Weighted? | Edges have a cost, or all equal | Determines BFS vs. Dijkstra for shortest path |
| Cyclic? | Can you loop back to a visited node | Determines if topological sort is even possible |
| Connected? | Can every node reach every other node | Determines if you need to loop over all nodes as potential starts |

---

## 🎯 When to Use

- Data models **relationships** — social networks, dependencies, maps, recommendation graphs
- Need **shortest path**, **reachability**, or **connectivity**
- **Cycle detection** — circular dependencies, deadlock detection
- **Grid problems** where each cell connects to its neighbors ("number of islands," "rotting oranges")
- **Scheduling with dependencies** — course prerequisites, build systems

---

## 🗺️ Representations

| Representation | Space | Check if edge (u,v) exists | Get all neighbors of u | Best for |
|---|---|---|---|---|
| Adjacency List | O(V + E) | O(degree of u) | O(1) to get the list | Sparse graphs — the default choice |
| Adjacency Matrix | O(V²) | O(1) | O(V) | Dense graphs, or when O(1) edge lookup matters most |
| Edge List | O(E) | O(E) | O(E) | Simple algorithms, sorting edges by weight (Kruskal's) |

```python
# Adjacency list — most common representation
graph = {i: [] for i in range(n)}
for u, v in edges:
    graph[u].append(v)
    graph[v].append(u)          # only add this line if the graph is undirected

# Adjacency list with weights
graph = {i: [] for i in range(n)}
for u, v, weight in edges:
    graph[u].append((v, weight))

# Adjacency matrix
matrix = [[0] * n for _ in range(n)]
for u, v in edges:
    matrix[u][v] = 1
    matrix[v][u] = 1             # only if undirected
```

---

## 🧩 DFS vs. BFS — When to Use Which

| Use DFS when... | Use BFS when... |
|---|---|
| Checking if *any* path exists | Finding the **shortest** path (unweighted graph) |
| Detecting cycles | Doing level-order / "distance from start" processing |
| Topological sorting | Finding all nodes within k steps |
| You need to explore deeply before backtracking | You need to explore breadth-first, layer by layer |

```python
# DFS — recursive
def dfs(node, visited, graph):
    if node in visited:
        return
    visited.add(node)
    for neighbor in graph[node]:
        dfs(neighbor, visited, graph)

# DFS — iterative, with an explicit stack
def dfs_iterative(start, graph):
    visited = set()
    stack = [start]
    while stack:
        node = stack.pop()
        if node in visited:
            continue
        visited.add(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                stack.append(neighbor)
    return visited

# BFS — shortest path in an unweighted graph
from collections import deque
def bfs_shortest_path(graph, start, target):
    queue = deque([(start, 0)])
    visited = {start}
    while queue:
        node, dist = queue.popleft()
        if node == target:
            return dist
        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, dist + 1))
    return -1     # target unreachable
```

**Why BFS gives the shortest path and DFS doesn't:** BFS explores the graph in "rings" — everything 1 edge away, then everything 2 edges away, and so on — so the *first* time it reaches the target is guaranteed to be via the fewest edges. DFS commits to one path all the way down before backtracking, so it might stumble onto the target via a long, roundabout route first.

---

## 🧩 Cycle Detection

**Undirected graph:** a cycle exists if, during DFS, you reach a node that's already visited **and it isn't the node you just came from**.

```python
def has_cycle_undirected(graph, n):
    visited = set()
    def dfs(node, parent):
        visited.add(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                if dfs(neighbor, node):
                    return True
            elif neighbor != parent:      # visited, and not where we came from → cycle
                return True
        return False
    return any(dfs(node, -1) for node in range(n) if node not in visited)
```

**Directed graph:** needs a 3-state DFS, because "already visited" isn't enough — you specifically need to catch a **back edge** to a node still on the current recursion path.

```python
def has_cycle_directed(graph, n):
    state = [0] * n     # 0 = unvisited, 1 = visiting (on current path), 2 = done
    def dfs(node):
        if state[node] == 1:
            return True          # back edge to a node on the current path → cycle
        if state[node] == 2:
            return False          # already fully explored, safe
        state[node] = 1
        for neighbor in graph[node]:
            if dfs(neighbor):
                return True
        state[node] = 2
        return False
    return any(dfs(node) for node in range(n) if state[node] == 0)
```

---

## 🧩 Topological Sort (Kahn's Algorithm, BFS-based)

Orders nodes so every edge `u → v` has `u` appearing before `v`. Only possible on a **DAG** (Directed Acyclic Graph).

```python
from collections import deque

def topo_sort(graph, in_degree, n):
    queue = deque([i for i in range(n) if in_degree[i] == 0])   # start with no prerequisites
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor in graph[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)
    return order if len(order) == n else []    # fewer than n processed → a cycle exists
```

**Key insight:** a node with `in_degree == 0` has no unmet prerequisites, so it's safe to process next. As each node is processed, it "removes" its outgoing edges by decrementing the in-degree of its neighbors — if that empties out the queue before every node is processed, there must be a cycle blocking the remaining nodes.

---

## 📝 Must-Know Problems

### 1. Number of Islands

**Problem:** Count connected groups of `'1'`s (land) in a grid, where connections are up/down/left/right.

```python
def num_islands(grid):
    if not grid:
        return 0
    rows, cols = len(grid), len(grid[0])

    def dfs(r, c):
        if r < 0 or r >= rows or c < 0 or c >= cols or grid[r][c] != '1':
            return
        grid[r][c] = '0'          # mark visited by sinking the island
        dfs(r+1, c); dfs(r-1, c); dfs(r, c+1); dfs(r, c-1)

    count = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1':
                dfs(r, c)
                count += 1          # found a new island's starting point
    return count
```

**Time:** O(rows × cols). **Space:** O(rows × cols) worst case (recursion depth on an all-land grid).

### 2. Course Schedule (Cycle Detection)

**Problem:** Given course prerequisites, determine if it's possible to finish all courses (i.e. the prerequisite graph has no cycle).

```python
def can_finish(num_courses, prerequisites):
    graph = {i: [] for i in range(num_courses)}
    in_degree = [0] * num_courses
    for course, prereq in prerequisites:
        graph[prereq].append(course)
        in_degree[course] += 1

    order = topo_sort(graph, in_degree, num_courses)   # from the template above
    return len(order) == num_courses
```

**Time:** O(V + E). **Space:** O(V + E).

### 3. Clone Graph

**Problem:** Deep-copy a connected undirected graph.

```python
def clone_graph(node):
    if not node:
        return None
    visited = {}   # original node -> cloned node

    def dfs(n):
        if n in visited:
            return visited[n]
        clone = Node(n.val)
        visited[n] = clone
        for neighbor in n.neighbors:
            clone.neighbors.append(dfs(neighbor))
        return clone

    return dfs(node)
```

**Key insight:** the `visited` HashMap does double duty — it prevents infinite loops on cycles, *and* it's exactly the mapping needed to wire up cloned neighbors correctly.

**Time:** O(V + E). **Space:** O(V).

### 4. Number of Connected Components

**Problem:** Count connected components in an undirected graph.

```python
def count_components(n, edges):
    graph = {i: [] for i in range(n)}
    for u, v in edges:
        graph[u].append(v)
        graph[v].append(u)

    visited = set()
    def dfs(node):
        visited.add(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                dfs(neighbor)

    count = 0
    for node in range(n):
        if node not in visited:
            dfs(node)
            count += 1
    return count
```

**Time:** O(V + E). **Space:** O(V).

---

## 📊 Classic Algorithms Reference

| Algorithm | Time | Space | Use Case |
|---|---|---|---|
| DFS | O(V + E) | O(V) | Reachability, cycle detection, path existence, topological sort |
| BFS | O(V + E) | O(V) | Shortest path in an unweighted graph, level-order processing |
| Dijkstra's | O((V + E) log V) | O(V) | Shortest path, non-negative weights, uses a **heap** |
| Bellman-Ford | O(V · E) | O(V) | Shortest path, handles **negative** weights, detects negative cycles |
| Floyd-Warshall | O(V³) | O(V²) | All-pairs shortest paths |
| Prim's | O(E log V) | O(V) | Minimum spanning tree, uses a **heap** |
| Kruskal's | O(E log E) | O(V) | Minimum spanning tree, uses **Union-Find** |
| Topological Sort (Kahn's) | O(V + E) | O(V) | Ordering tasks with dependencies (DAG only) |

```python
# Dijkstra's shortest path — uses a heap
import heapq

def dijkstra(graph, start, n):
    distances = [float('inf')] * n
    distances[start] = 0
    heap = [(0, start)]           # (distance, node)

    while heap:
        dist, node = heapq.heappop(heap)
        if dist > distances[node]:
            continue                # stale entry, skip
        for neighbor, weight in graph[node]:
            new_dist = dist + weight
            if new_dist < distances[neighbor]:
                distances[neighbor] = new_dist
                heapq.heappush(heap, (new_dist, neighbor))
    return distances
```

---

## ⚠️ Common Mistakes

- Forgetting to mark nodes **visited** → infinite loop on any graph with a cycle.
- Using DFS when the shortest **unweighted** path is needed — use BFS instead.
- Using BFS/DFS instead of Dijkstra when edges have **weights** — unweighted-graph algorithms don't account for edge cost.
- Not handling **disconnected** graphs — loop over *every* node as a potential starting point, not just node 0.
- Building an undirected adjacency list but only adding the edge in one direction (`graph[u].append(v)` without also `graph[v].append(u)`).
- Using plain "visited" for directed-graph cycle detection instead of the 3-state (unvisited/visiting/done) approach — a node reachable two different ways looks like a false cycle otherwise.

---

## 💡 Interview Tips

1. Before writing any code, state the graph's properties out loud: directed or undirected, weighted or not, and how you'll represent it. This alone prevents a large fraction of graph bugs.
2. If the problem says "shortest path," immediately ask (or state): are all edges the same weight? If yes, BFS; if no, Dijkstra.
3. For grid problems, mention you're treating each cell as a graph node with up-to-4 (or 8, if diagonals count) neighbors — grid problems are graph problems in disguise.
4. Mention time/space in terms of V and E, not just "n" — it signals you're thinking about the actual graph structure, not just array size.

---

## 🔗 Related Topics

- **Trees** are a special case of graphs: connected, acyclic, undirected, exactly `V - 1` edges.
- **HashMap** implements both the adjacency list and the visited set.
- **Heaps** power Dijkstra's and Prim's algorithms — anywhere you need "cheapest next option" efficiently.
- **Backtracking** — "find all paths" style graph problems are backtracking applied to a graph instead of a tree.
- **Union-Find** — an alternative to DFS/BFS for connectivity questions and cycle detection in undirected graphs, and the backbone of Kruskal's algorithm.

---

## 🚀 Practice List

**Easy:** Find if Path Exists in Graph, Flood Fill

**Medium:** Number of Islands, Course Schedule, Clone Graph, Number of Connected Components, Pacific Atlantic Water Flow, Rotting Oranges, Course Schedule II

**Hard:** Word Ladder, Alien Dictionary, Reconstruct Itinerary, Network Delay Time (Dijkstra)
