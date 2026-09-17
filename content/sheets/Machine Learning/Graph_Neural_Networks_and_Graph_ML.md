# Graph Neural Networks & Graph ML Cheatsheet

## Overview

Some data isn't naturally tabular, sequential, or grid-shaped — it's relational: social networks, molecules, transaction networks, knowledge graphs. This sheet covers how to represent graph data, how message-passing GNNs learn from it, and when a simpler graph embedding technique is enough.

```bash
pip install torch torch-geometric networkx --break-system-packages
```

---

## 1. Graph Representation

A graph is defined by nodes (entities), edges (relationships), and optionally features on each:

```python
import torch
import networkx as nx

# A small social network: 5 users, edges = "follows"
edges = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 0), (1, 3)]
G = nx.Graph()
G.add_edges_from(edges)

# Adjacency matrix — dense representation, fine for small graphs
adj_matrix = nx.to_numpy_array(G)
print("Adjacency matrix:\n", adj_matrix)

# Edge index — the sparse representation GNN libraries actually use (2 x num_edges)
edge_index = torch.tensor(list(G.edges), dtype=torch.long).t().contiguous()
edge_index = torch.cat([edge_index, edge_index.flip(0)], dim=1)  # make undirected explicit both ways
print("Edge index shape:", edge_index.shape)

# Node features — e.g., account age, activity level, one-hot category
node_features = torch.randn(5, 8)  # 5 nodes, 8 features each
```

**When a problem is actually a graph problem:** ask whether the *relationships between entities* carry predictive signal beyond what's captured in each entity's own features. If "who my neighbors are" changes the answer (fraud rings, molecule reactivity, citation influence), it's a graph problem. If entities are independent, plain tabular ML is simpler and usually just as good.

---

## 2. Message Passing: GCN, GraphSAGE, GAT

The core idea behind every GNN: each node updates its representation by aggregating information from its neighbors, repeated over several layers so information can propagate further with each hop.

```python
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GCNConv, SAGEConv, GATConv

class GCN(nn.Module):
    """Graph Convolutional Network — aggregates neighbor features with fixed (degree-normalized) weights."""
    def __init__(self, in_dim, hidden_dim, out_dim):
        super().__init__()
        self.conv1 = GCNConv(in_dim, hidden_dim)
        self.conv2 = GCNConv(hidden_dim, out_dim)

    def forward(self, x, edge_index):
        x = F.relu(self.conv1(x, edge_index))
        x = F.dropout(x, p=0.5, training=self.training)
        return self.conv2(x, edge_index)

class GraphSAGE(nn.Module):
    """Samples a fixed-size neighborhood and aggregates (mean/pool/LSTM) — scales to large graphs."""
    def __init__(self, in_dim, hidden_dim, out_dim):
        super().__init__()
        self.conv1 = SAGEConv(in_dim, hidden_dim)
        self.conv2 = SAGEConv(hidden_dim, out_dim)

    def forward(self, x, edge_index):
        x = F.relu(self.conv1(x, edge_index))
        return self.conv2(x, edge_index)

class GAT(nn.Module):
    """Graph Attention Network — learns attention weights per edge instead of using fixed/uniform weights."""
    def __init__(self, in_dim, hidden_dim, out_dim, heads=4):
        super().__init__()
        self.conv1 = GATConv(in_dim, hidden_dim, heads=heads)
        self.conv2 = GATConv(hidden_dim * heads, out_dim, heads=1)

    def forward(self, x, edge_index):
        x = F.elu(self.conv1(x, edge_index))
        return self.conv2(x, edge_index)

model = GCN(in_dim=8, hidden_dim=16, out_dim=2)
out = model(node_features, edge_index)
print(f"GCN output shape: {out.shape}")  # [5, 2] — a 2-class prediction per node
```

| Model | Aggregation | Scales to huge graphs? | Learns edge importance? |
|---|---|---|---|
| GCN | Fixed, degree-normalized average of neighbors | Moderate | No — uniform per structural position |
| GraphSAGE | Samples a fixed neighborhood size, then aggregates | Yes — built for this | No |
| GAT | Learned attention weight per neighbor | Moderate-to-good | Yes |

---

## 3. Task Types: Node, Link, and Graph-Level Prediction

```python
# --- Node classification: predict a label for each node (e.g., "is this account fraudulent?") ---
node_logits = model(node_features, edge_index)
node_preds = node_logits.argmax(dim=1)

# --- Link prediction: predict whether an edge should exist (e.g., "will these users connect?") ---
def link_prediction_score(node_embeddings, node_i, node_j):
    return torch.sigmoid((node_embeddings[node_i] * node_embeddings[node_j]).sum())

embeddings = GraphSAGE(8, 16, 16)(node_features, edge_index)
score = link_prediction_score(embeddings, 0, 2)
print(f"Predicted likelihood of an edge between node 0 and node 2: {score.item():.3f}")

# --- Graph classification: predict a label for the WHOLE graph (e.g., "is this molecule toxic?") ---
from torch_geometric.nn import global_mean_pool

class GraphClassifier(nn.Module):
    def __init__(self, in_dim, hidden_dim, num_classes):
        super().__init__()
        self.conv1 = GCNConv(in_dim, hidden_dim)
        self.conv2 = GCNConv(hidden_dim, hidden_dim)
        self.classifier = nn.Linear(hidden_dim, num_classes)

    def forward(self, x, edge_index, batch):
        x = F.relu(self.conv1(x, edge_index))
        x = F.relu(self.conv2(x, edge_index))
        x = global_mean_pool(x, batch)  # pools all node embeddings into ONE vector per graph
        return self.classifier(x)
```

---

## 4. Scaling to Large Graphs

Full-batch training (loading the entire graph and all neighbors at once) doesn't fit in memory past a few hundred thousand nodes. Two standard fixes:

```python
from torch_geometric.loader import NeighborLoader

# Neighbor sampling: for each mini-batch of target nodes, sample a fixed number of
# neighbors at each hop, rather than the full neighborhood
# loader = NeighborLoader(
#     data,
#     num_neighbors=[10, 5],   # sample 10 neighbors at hop 1, 5 neighbors of THOSE at hop 2
#     batch_size=128,
#     input_nodes=data.train_mask,
# )
# for batch in loader:
#     out = model(batch.x, batch.edge_index)
#     loss = F.cross_entropy(out[:batch.batch_size], batch.y[:batch.batch_size])
```

This is exactly what GraphSAGE was originally designed for — bounding the neighborhood size per layer keeps both memory and the "neighbor explosion" (exponential growth of the receptive field with depth) under control.

---

## 5. Graph Embeddings as a Simpler Alternative

Before reaching for a full GNN, consider whether a structural embedding method is enough — much cheaper to train and often sufficient for downstream tasks like clustering or as features in an XGBoost model.

```python
# Node2Vec: learns node embeddings via biased random walks, then a skip-gram objective
# (same underlying idea as Word2Vec, applied to random walks over the graph instead of sentences)
from torch_geometric.nn import Node2Vec

# node2vec = Node2Vec(
#     edge_index, embedding_dim=64, walk_length=20, context_size=10,
#     walks_per_node=10, p=1, q=1,  # p, q control walk bias: BFS-like vs. DFS-like exploration
# )
```

**When embeddings are enough vs. when you need a full GNN:** if the downstream task only needs a general-purpose structural representation (nodes that are "close" in the graph should have similar embeddings) and you don't have rich node features to combine with structure, Node2Vec/DeepWalk is faster and simpler. If you have informative node features AND want the model to learn task-specific ways of combining structure with those features, a GNN (which jointly uses both) usually wins.

---

## 6. Common Applications

| Application | Task type | Why graphs help |
|---|---|---|
| Fraud detection on transaction graphs | Node/edge classification | Fraud rings show up as unusual connectivity patterns invisible to per-transaction features alone |
| Recommendation | Link prediction | User-item interactions are naturally a bipartite graph |
| Molecule property prediction | Graph classification | A molecule's structure (atoms as nodes, bonds as edges) directly determines its chemical properties |
| Knowledge graph completion | Link prediction | Inferring missing facts from existing entity-relationship structure |

## Common Pitfalls

- **Using a GNN when node features already contain all the signal** — if connectivity doesn't add information beyond each node's own attributes, you're adding complexity for no gain.
- **Full-batch training on a graph that doesn't fit in memory** — leads to OOM crashes or forces you onto much smaller hardware than necessary; use neighbor sampling instead.
- **Over-smoothing with too many GNN layers** — stacking many message-passing layers can cause all node representations to converge toward the same value, since information from increasingly distant (and increasingly numerous) neighbors gets averaged together. 2-3 layers is a common practical ceiling before over-smoothing sets in.
- **Ignoring class imbalance in node classification** — the same imbalanced-learning fixes apply here (see the Anomaly Detection & Imbalanced Learning sheet).
- **Leaking test-set edges into the training graph structure** during link prediction — the graph structure used for message passing during training must exclude the edges you're trying to predict.

---

## 7. End-to-End Worked Example: Node Classification on a Citation-Style Graph

```python
import torch
import torch.nn.functional as F
from torch_geometric.nn import GCNConv
from torch_geometric.data import Data

torch.manual_seed(42)

# Simulate a small citation-network-style graph: 100 papers, each connected to a few others,
# with a topic label per paper and a bag-of-words style feature vector
n_nodes, n_features, n_classes = 100, 32, 4
x = torch.randn(n_nodes, n_features)
y = torch.randint(0, n_classes, (n_nodes,))

# Random-ish edges, biased so nodes of the SAME class are somewhat more likely to connect
# (mimicking real citation graphs, where papers tend to cite similar-topic papers)
edges = []
for i in range(n_nodes):
    for j in range(i + 1, n_nodes):
        same_class_bonus = 0.15 if y[i] == y[j] else 0.02
        if torch.rand(1).item() < same_class_bonus:
            edges.append((i, j))
edge_index = torch.tensor(edges, dtype=torch.long).t().contiguous()
edge_index = torch.cat([edge_index, edge_index.flip(0)], dim=1)  # undirected

# Train/val/test masks — a common pattern for node classification (ALL nodes are used for
# message passing, but only a SUBSET have their labels used for the loss at any given stage)
perm = torch.randperm(n_nodes)
train_mask = torch.zeros(n_nodes, dtype=torch.bool); train_mask[perm[:60]] = True
val_mask   = torch.zeros(n_nodes, dtype=torch.bool); val_mask[perm[60:80]] = True
test_mask  = torch.zeros(n_nodes, dtype=torch.bool); test_mask[perm[80:]] = True

data = Data(x=x, edge_index=edge_index, y=y, train_mask=train_mask, val_mask=val_mask, test_mask=test_mask)

class GCN(torch.nn.Module):
    def __init__(self, in_dim, hidden_dim, out_dim):
        super().__init__()
        self.conv1 = GCNConv(in_dim, hidden_dim)
        self.conv2 = GCNConv(hidden_dim, out_dim)

    def forward(self, x, edge_index):
        x = F.relu(self.conv1(x, edge_index))
        x = F.dropout(x, p=0.5, training=self.training)
        return self.conv2(x, edge_index)

model = GCN(n_features, 32, n_classes)
optimizer = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=5e-4)

def evaluate(mask):
    model.eval()
    with torch.no_grad():
        pred = model(data.x, data.edge_index).argmax(dim=1)
        return (pred[mask] == data.y[mask]).float().mean().item()

best_val_acc, patience_counter = 0, 0
for epoch in range(200):
    model.train()
    optimizer.zero_grad()
    out = model(data.x, data.edge_index)
    # CRITICAL: loss is computed ONLY on train_mask nodes, even though message passing used ALL nodes' features
    loss = F.cross_entropy(out[data.train_mask], data.y[data.train_mask])
    loss.backward()
    optimizer.step()

    val_acc = evaluate(data.val_mask)
    if val_acc > best_val_acc:
        best_val_acc, patience_counter = val_acc, 0
        torch.save(model.state_dict(), "best_gcn.pt")
    else:
        patience_counter += 1
        if patience_counter > 30:
            print(f"Early stopping at epoch {epoch}")
            break

    if epoch % 40 == 0:
        print(f"Epoch {epoch}: loss={loss.item():.3f}, val_acc={val_acc:.3f}")

model.load_state_dict(torch.load("best_gcn.pt"))
print(f"Final test accuracy: {evaluate(data.test_mask):.3f}")
```

This "transductive" setup (all nodes present during training, but only some have visible labels) is the classic node-classification pattern and is distinct from typical supervised learning, where test examples are never seen at all during training — here, the model DOES see test nodes' features and graph position during message passing, just never their labels.

---

## 8. Advanced & Lesser-Known Techniques

- **Heterogeneous graphs**: real-world graphs often have multiple node types (users, products, reviews) and edge types (purchased, reviewed, friends-with) — libraries like PyTorch Geometric support `HeteroData` and relation-specific message passing (`HeteroConv`) rather than forcing everything into one homogeneous graph.
- **Temporal graph networks**: for graphs that evolve over time (transaction networks, evolving social graphs), temporal GNNs incorporate edge timestamps directly into message passing, rather than treating the graph as a single static snapshot.
- **Positional encodings for graphs**: unlike sequences, graphs don't have an inherent linear order, so several schemes (Laplacian eigenvector-based, random-walk-based) exist to give GNNs a sense of each node's structural "position," improving performance on tasks sensitive to global graph structure.
- **Jumping Knowledge Networks**: instead of only using the final layer's node representations, combine representations from ALL layers (via concatenation, max, or LSTM aggregation) — helps mitigate over-smoothing by letting the model choose how much "locality" vs. "global context" each node's final representation should reflect.

---

## 9. Practice Exercises

1. Rerun the worked example with the "same-class bonus" set to 0 (fully random edges) — how much does test accuracy degrade, confirming that the GNN is genuinely using graph structure rather than just node features?
2. Stack the GCN to 2, 4, and 8 layers and plot test accuracy against depth — identify where over-smoothing starts to hurt performance.
3. Replace `GCNConv` with `GATConv` in the worked example and compare test accuracy — inspect the learned attention weights for a few nodes to see which neighbors the model weights most heavily.
4. Implement a simple Jumping Knowledge aggregation (concatenate outputs from all GCN layers before the final classifier) and measure whether it mitigates the over-smoothing observed in exercise 2.
5. Convert the node classification setup into a link prediction task: hide 20% of edges, train a model to predict their existence from node embeddings, and report AUC on the held-out edges.

---

## 10. More Examples

### Example: Building a graph from tabular relational data

```python
import pandas as pd
import torch

# Common real scenario: you have relational tables, not a pre-built graph
transactions = pd.DataFrame({
    "sender": ["A", "B", "A", "C", "B"],
    "receiver": ["B", "C", "C", "A", "D"],
})
nodes = sorted(set(transactions.sender) | set(transactions.receiver))
node_to_idx = {node: i for i, node in enumerate(nodes)}

edge_index = torch.tensor([
    [node_to_idx[s] for s in transactions.sender],
    [node_to_idx[r] for r in transactions.receiver],
], dtype=torch.long)
print(f"Built a graph with {len(nodes)} nodes and {edge_index.shape[1]} directed edges from raw transaction data")
```

### Example: Combining tabular node features with graph structure

```python
import torch
import torch.nn.functional as F
from torch_geometric.nn import GCNConv

# A node's features might combine intrinsic attributes with graph-derived statistics
node_features = torch.tensor([
    [100.0, 5],   # [account_balance, num_transactions] for node A
    [50.0, 12],
    [200.0, 3],
    [10.0, 20],
], dtype=torch.float)

class GraphFraudDetector(torch.nn.Module):
    def __init__(self, in_dim, hidden_dim):
        super().__init__()
        self.conv1 = GCNConv(in_dim, hidden_dim)
        self.conv2 = GCNConv(hidden_dim, 2)  # binary: fraud / not fraud

    def forward(self, x, edge_index):
        x = F.relu(self.conv1(x, edge_index))
        return self.conv2(x, edge_index)

model = GraphFraudDetector(in_dim=2, hidden_dim=16)
logits = model(node_features, edge_index)
print(f"Fraud logits per account: {logits}")
```

### Example: Graph-level pooling strategies compared

```python
from torch_geometric.nn import global_mean_pool, global_max_pool, global_add_pool
import torch

node_embeddings = torch.randn(10, 32)  # 10 nodes across (say) 2 graphs in a batch
batch_assignment = torch.tensor([0]*6 + [1]*4)  # first 6 nodes belong to graph 0, rest to graph 1

mean_pooled = global_mean_pool(node_embeddings, batch_assignment)
max_pooled = global_max_pool(node_embeddings, batch_assignment)
sum_pooled = global_add_pool(node_embeddings, batch_assignment)

print(f"Mean pooling shape: {mean_pooled.shape}")  # [2, 32] — one vector per graph
# Sum pooling is sensitive to graph SIZE (a bigger graph -> bigger magnitude sum);
# mean pooling normalizes this away; max pooling captures the "most extreme" signal per dimension
```

---

## 11. Quick-Reference Cheat-Table

| Need | Choice |
|---|---|
| Simple, fast baseline | GCN |
| Very large graphs | GraphSAGE (neighbor sampling) |
| Learn which neighbors matter most | GAT |
| No labels, just structural embeddings | Node2Vec / DeepWalk |
| Multiple node/edge types | Heterogeneous GNN (`HeteroConv`) |
| Deep stack without over-smoothing | Jumping Knowledge aggregation |

## 12. FAQ

**Q: Is a GNN always better than plain tabular ML on relational data?**
A: Only if the connectivity itself carries predictive signal beyond each node's own features — if entities are effectively independent, tabular ML is simpler and just as good.

**Q: Why did adding more GNN layers hurt performance?**
A: Over-smoothing — too many message-passing layers cause node representations to converge toward the same value. 2-3 layers is a common practical ceiling.

**Q: My GNN needs the full graph in memory — how do I scale it?**
A: Use neighbor sampling (GraphSAGE-style) instead of full-batch training — bounds the neighborhood size per layer.

**Q: Node2Vec or a full GNN — which should I pick?**
A: Node2Vec if you only need general-purpose structural embeddings without rich node features. A full GNN if you have informative node features to combine with structure.

**Q: How do I evaluate a link prediction model without leakage?**
A: Ensure the edges you're predicting are excluded from the graph structure used for message passing during training — a common and easy-to-miss leakage source.
