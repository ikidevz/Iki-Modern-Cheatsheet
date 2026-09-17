# Deep Learning Basics Cheatsheet

## Overview

This sheet is the on-ramp from classical ML to neural networks — the architecture vocabulary, training mechanics, and the PyTorch/Keras patterns you'll reuse in every deep learning task that follows in this index (NLP, computer vision, LLMs, RL).

```bash
pip install torch torchvision --break-system-packages
```

---

## 1. Neural Network Basics

A neural network is a stack of linear transformations separated by non-linear activation functions — without the non-linearity, stacking layers would collapse to a single linear transformation, no matter how many layers you add.

### Activation functions

| Function | Shape | Use case | Weakness |
|---|---|---|---|
| ReLU | `max(0, x)` | Default for hidden layers | "Dead" neurons (stuck outputting 0) |
| Leaky ReLU | Small negative slope instead of 0 | Fixes dead ReLU | Extra hyperparameter |
| Sigmoid | Squashes to (0, 1) | Binary output layer | Vanishing gradients when saturated |
| Softmax | Squashes a vector to sum to 1 | Multi-class output layer | N/A — it's the standard choice there |
| GELU | Smooth approximation of ReLU | Transformers (default in most LLMs) | Slightly more compute than ReLU |

### Backpropagation intuition

Backprop is the chain rule applied systematically: the loss is a function of the output, the output is a function of the last layer's weights and the previous layer's output, and so on back to the input. Each layer's gradient is computed using the gradient that flowed back from the layer after it — this is why frameworks build a **computation graph** during the forward pass, so they know exactly how to apply the chain rule during the backward pass.

```python
import torch
import torch.nn as nn

# A minimal illustration of what autograd does under the hood
x = torch.tensor([2.0], requires_grad=True)
w = torch.tensor([3.0], requires_grad=True)
b = torch.tensor([1.0], requires_grad=True)

y = w * x + b          # forward pass builds the graph
loss = (y - 10.0) ** 2 # some loss

loss.backward()        # backprop: computes d(loss)/dw, d(loss)/dx, d(loss)/db
print(f"dL/dw = {w.grad.item():.2f}, dL/dx = {x.grad.item():.2f}, dL/db = {b.grad.item():.2f}")
```

---

## 2. Loss Functions, Optimizers, and Learning Rate Scheduling

| Task | Loss function |
|---|---|
| Binary classification | `BCEWithLogitsLoss` (combines sigmoid + BCE, more numerically stable) |
| Multi-class classification | `CrossEntropyLoss` (combines softmax + NLL) |
| Regression | `MSELoss` or `L1Loss` |

```python
# Optimizer comparison
model = nn.Linear(10, 1)

sgd = torch.optim.SGD(model.parameters(), lr=0.01, momentum=0.9)
adam = torch.optim.Adam(model.parameters(), lr=0.001, betas=(0.9, 0.999))
adamw = torch.optim.AdamW(model.parameters(), lr=0.001, weight_decay=0.01)  # decoupled weight decay — the modern default

# Learning rate scheduling — decay the LR over training
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(adamw, T_max=100)
for epoch in range(100):
    # ... training step ...
    scheduler.step()

# Alternative: reduce LR when validation loss plateaus
plateau_scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(adamw, mode="min", patience=5, factor=0.5)
```

**SGD vs. Adam:** SGD with momentum generalizes slightly better in some settings (classic CV benchmarks) but needs careful LR tuning and takes longer to converge. Adam/AdamW adapts the learning rate per-parameter, converges faster, and is far more forgiving of the initial LR choice — it's the default starting point for almost everything, especially transformers.

---

## 3. PyTorch vs. TensorFlow/Keras: Core API Differences

| | PyTorch | Keras/TensorFlow |
|---|---|---|
| Execution model | Eager by default (dynamic graph) | Eager by default (TF2+), can compile to a static graph |
| Training loop | You write it explicitly | `model.fit()` handles it, or write custom loops with `tf.GradientTape` |
| Debugging | Standard Python debugger works naturally | Also debuggable, slightly more abstraction to peel back |
| Ecosystem | Dominant in research, Hugging Face, most new LLM work | Strong in production tooling (TF Serving, TFLite), still common in industry |
| Learning curve | Explicit — you see every step | Faster to a working model, less visible mechanics |

```python
# PyTorch: explicit training loop
class SimpleNet(nn.Module):
    def __init__(self, in_dim, hidden_dim, out_dim):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, out_dim),
        )
    def forward(self, x):
        return self.net(x)

model = SimpleNet(10, 32, 1)
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
loss_fn = nn.MSELoss()

X = torch.randn(100, 10)
y = torch.randn(100, 1)

for epoch in range(5):
    optimizer.zero_grad()          # clear gradients from the previous step
    preds = model(X)               # forward pass
    loss = loss_fn(preds, y)       # compute loss
    loss.backward()                # backward pass — populates .grad on every parameter
    optimizer.step()               # apply the gradient update
    print(f"Epoch {epoch}: loss={loss.item():.4f}")
```

```python
# Keras equivalent — the same training loop, hidden behind .fit()
# import tensorflow as tf
# keras_model = tf.keras.Sequential([
#     tf.keras.layers.Dense(32, activation="relu", input_shape=(10,)),
#     tf.keras.layers.Dense(1),
# ])
# keras_model.compile(optimizer="adamw", loss="mse")
# keras_model.fit(X.numpy(), y.numpy(), epochs=5, batch_size=32)
```

---

## 4. Training Loop Mechanics

```python
from torch.utils.data import DataLoader, TensorDataset

dataset = TensorDataset(X, y)
train_loader = DataLoader(dataset, batch_size=16, shuffle=True)

n_epochs = 10
best_val_loss = float("inf")
patience, patience_counter = 3, 0

for epoch in range(n_epochs):
    model.train()  # enables dropout/batchnorm training behavior
    epoch_loss = 0.0
    for batch_X, batch_y in train_loader:
        optimizer.zero_grad()
        preds = model(batch_X)
        loss = loss_fn(preds, batch_y)
        loss.backward()
        optimizer.step()
        epoch_loss += loss.item()

    model.eval()  # disables dropout, freezes batchnorm running stats
    with torch.no_grad():  # no need to track gradients for validation
        val_loss = loss_fn(model(X), y).item()  # using train set as a stand-in for validation here

    print(f"Epoch {epoch}: train_loss={epoch_loss/len(train_loader):.4f}, val_loss={val_loss:.4f}")

    # Early stopping
    if val_loss < best_val_loss:
        best_val_loss = val_loss
        patience_counter = 0
        torch.save(model.state_dict(), "best_model.pt")  # checkpoint the best model
    else:
        patience_counter += 1
        if patience_counter >= patience:
            print("Early stopping triggered")
            break
```

**Key concepts:**
- **Batching**: process data in small groups (not one sample at a time, not the whole dataset at once) — balances gradient noise (helps escape sharp local minima) against compute efficiency (GPU parallelism).
- **Epoch**: one full pass through the training data.
- **`model.train()` vs. `model.eval()`**: critical — forgetting to call `.eval()` before validation/inference means dropout is still randomly zeroing activations and batch norm is using batch statistics instead of running averages, both of which corrupt your validation numbers.

---

## 5. Regularization

```python
class RegularizedNet(nn.Module):
    def __init__(self, in_dim, hidden_dim, out_dim, dropout_p=0.3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden_dim),
            nn.BatchNorm1d(hidden_dim),   # normalizes activations, stabilizes training, mild regularization effect
            nn.ReLU(),
            nn.Dropout(dropout_p),        # randomly zeroes activations during training only
            nn.Linear(hidden_dim, out_dim),
        )
    def forward(self, x):
        return self.net(x)

# Weight decay (L2 regularization) is passed to the optimizer, not the model
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=0.01)
```

| Technique | What it does | When to use |
|---|---|---|
| Dropout | Randomly zeroes activations during training | Fully-connected layers, prevents co-adaptation |
| Batch normalization | Normalizes layer inputs per mini-batch | Speeds up/stabilizes training, mild regularization |
| Weight decay | Penalizes large weights (L2 on parameters) | Nearly always — a sane default in the optimizer |
| Early stopping | Halts training when validation loss stops improving | Always — cheap insurance against overfitting |

---

## 6. Common Architectures Overview

| Architecture | Built for | Key idea |
|---|---|---|
| CNN | Images, grid-structured data | Local receptive fields + weight sharing via convolution |
| RNN/LSTM/GRU | Sequences (before transformers) | Recurrent hidden state carries information forward in time |
| Transformer | Sequences (text, and increasingly everything else) | Self-attention — every position can directly attend to every other position |

See the **NLP Fundamentals**, **Computer Vision Fundamentals**, and **Sequence Models & Attention** sheets for deep dives into each.

## Common Pitfalls

- **Forgetting `optimizer.zero_grad()`** — gradients accumulate by default in PyTorch; without clearing them, each step's gradient is contaminated by the previous step's.
- **Forgetting `model.eval()` during validation/inference** — dropout and batch norm behave differently in train vs. eval mode, and leaving train-mode behavior on corrupts your metrics.
- **Learning rate too high** — loss diverges or oscillates wildly; too low — training crawls. Start with Adam's default (1e-3) and adjust from there.
- **Not shuffling training data** — especially damaging if the data is ordered by class or time, since the model sees a biased sequence of batches.
- **Ignoring gradient explosion in deep/recurrent networks** — watch for NaN losses; gradient clipping (`torch.nn.utils.clip_grad_norm_`) is a cheap fix.

---

## 7. End-to-End Worked Example: Training a Full MLP With Checkpointing and LR Scheduling

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset, random_split

torch.manual_seed(42)

# Synthetic tabular classification data
n_samples, n_features, n_classes = 5000, 20, 3
X = torch.randn(n_samples, n_features)
true_weights = torch.randn(n_features, n_classes)
y = (X @ true_weights + 0.5 * torch.randn(n_samples, n_classes)).argmax(dim=1)

dataset = TensorDataset(X, y)
train_size = int(0.8 * n_samples)
train_ds, val_ds = random_split(dataset, [train_size, n_samples - train_size])
train_loader = DataLoader(train_ds, batch_size=64, shuffle=True)
val_loader = DataLoader(val_ds, batch_size=256)

class MLP(nn.Module):
    def __init__(self, in_dim, hidden_dim, out_dim, dropout=0.3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden_dim), nn.BatchNorm1d(hidden_dim), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim), nn.BatchNorm1d(hidden_dim), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden_dim, out_dim),
        )
    def forward(self, x):
        return self.net(x)

model = MLP(n_features, 64, n_classes)
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", patience=3, factor=0.5)

best_val_loss = float("inf")
patience, patience_counter = 8, 0

for epoch in range(100):
    model.train()
    train_loss = 0.0
    for xb, yb in train_loader:
        optimizer.zero_grad()
        loss = F.cross_entropy(model(xb), yb)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)  # guard against exploding gradients
        optimizer.step()
        train_loss += loss.item() * xb.size(0)
    train_loss /= len(train_ds)

    model.eval()
    val_loss, val_correct = 0.0, 0
    with torch.no_grad():
        for xb, yb in val_loader:
            logits = model(xb)
            val_loss += F.cross_entropy(logits, yb).item() * xb.size(0)
            val_correct += (logits.argmax(dim=1) == yb).sum().item()
    val_loss /= len(val_ds)
    val_acc = val_correct / len(val_ds)

    scheduler.step(val_loss)
    current_lr = optimizer.param_groups[0]["lr"]

    if epoch % 5 == 0:
        print(f"Epoch {epoch:3d} | train_loss={train_loss:.4f} val_loss={val_loss:.4f} "
              f"val_acc={val_acc:.3f} lr={current_lr:.2e}")

    if val_loss < best_val_loss:
        best_val_loss, patience_counter = val_loss, 0
        torch.save(model.state_dict(), "best_mlp.pt")
    else:
        patience_counter += 1
        if patience_counter >= patience:
            print(f"Early stopping at epoch {epoch}")
            break

model.load_state_dict(torch.load("best_mlp.pt"))
print("Loaded best checkpoint for final evaluation/deployment.")
```

This combines nearly everything the sheet covers into one realistic loop: batch norm + dropout regularization, gradient clipping, a plateau-based LR scheduler, checkpointing the best model (not just the last one), and early stopping — the actual shape of a training script you'd write for a real tabular deep learning task.

---

## 8. Advanced & Lesser-Known Techniques

- **Warmup + cosine decay**: many modern training recipes linearly ramp the learning rate up from ~0 over the first few hundred steps before applying cosine decay — warmup avoids destabilizing large early updates when the model's weights (and Adam's moment estimates) are still poorly initialized.
- **Label smoothing** (`nn.CrossEntropyLoss(label_smoothing=0.1)`): softens hard one-hot targets slightly, discouraging the model from becoming overconfident and often improving generalization and calibration simultaneously.
- **Gradient accumulation for larger effective batch sizes** on limited memory — see the Distributed & Large-Scale Training sheet for the full pattern.
- **Weight initialization schemes**: Kaiming/He initialization (`nn.init.kaiming_normal_`) is tuned for ReLU-family activations; Xavier/Glorot initialization suits tanh/sigmoid. Poor initialization can make a network fail to train at all regardless of optimizer/LR choices, especially in deep networks without normalization layers.
- **Stochastic Weight Averaging (SWA)**: average model weights across the last several epochs (or a dedicated SWA phase with a constant/cyclical LR) rather than just using the final epoch's weights — often finds a flatter, better-generalizing minimum at near-zero extra training cost.

---

## 9. Practice Exercises

1. Remove batch normalization and dropout from the MLP above, retrain, and compare the train/validation loss gap — quantify the regularization effect.
2. Implement a linear warmup (first 5 epochs) followed by cosine decay, and compare final validation accuracy against the `ReduceLROnPlateau` version used above.
3. Deliberately set the learning rate to 1.0 (far too high) and observe the loss curve — then reduce it by orders of magnitude until training stabilizes, and record at what LR training first becomes stable.
4. Add `label_smoothing=0.1` to the loss function and compare the model's calibration (Brier score, using the Model Evaluation sheet's approach adapted for multi-class) against the unsmoothed version.
5. Implement Stochastic Weight Averaging using `torch.optim.swa_utils` and compare its validation accuracy against standard training with early stopping on this same dataset.

---

## 10. More Examples

### Example: A custom loss function for asymmetric regression penalties

```python
import torch

def asymmetric_mse_loss(preds, targets, over_penalty=2.0, under_penalty=1.0):
    """Penalizes over-predictions and under-predictions differently —
    e.g., for demand forecasting where under-stocking is worse than over-stocking."""
    errors = preds - targets
    loss = torch.where(errors > 0, over_penalty * errors**2, under_penalty * errors**2)
    return loss.mean()

preds = torch.tensor([10.0, 5.0, 8.0])
targets = torch.tensor([8.0, 7.0, 8.0])
print(f"Asymmetric loss: {asymmetric_mse_loss(preds, targets).item():.3f}")
print(f"Standard MSE:    {torch.nn.functional.mse_loss(preds, targets).item():.3f}")
```

### Example: Multi-task learning with shared layers and multiple heads

```python
import torch.nn as nn

class MultiTaskNet(nn.Module):
    """One shared backbone, two task-specific heads — useful when tasks share underlying structure
    (e.g., predicting both churn probability AND expected lifetime value from the same features)."""
    def __init__(self, in_dim, hidden_dim):
        super().__init__()
        self.shared = nn.Sequential(nn.Linear(in_dim, hidden_dim), nn.ReLU(), nn.Linear(hidden_dim, hidden_dim), nn.ReLU())
        self.churn_head = nn.Linear(hidden_dim, 1)      # binary classification
        self.ltv_head = nn.Linear(hidden_dim, 1)        # regression

    def forward(self, x):
        shared_features = self.shared(x)
        return torch.sigmoid(self.churn_head(shared_features)), self.ltv_head(shared_features)

model = MultiTaskNet(20, 64)
x = torch.randn(8, 20)
churn_prob, ltv_pred = model(x)

# Combined loss: weighted sum of both task losses, backpropagated through the SHARED backbone jointly
churn_loss = nn.functional.binary_cross_entropy(churn_prob, torch.randint(0, 2, (8, 1)).float())
ltv_loss = nn.functional.mse_loss(ltv_pred, torch.randn(8, 1))
combined_loss = churn_loss + 0.5 * ltv_loss  # weight terms tuned based on relative task importance/scale
```

### Example: Visualizing what a trained network has learned via weight inspection

```python
import torch.nn as nn

model = nn.Sequential(nn.Linear(10, 5), nn.ReLU(), nn.Linear(5, 1))
first_layer_weights = model[0].weight.data  # shape [5, 10]

# Each ROW is one hidden unit's learned combination of the 10 input features
for i, row in enumerate(first_layer_weights):
    top_feature = row.abs().argmax().item()
    print(f"Hidden unit {i} weights most heavily on input feature {top_feature} (weight={row[top_feature]:.3f})")
```

---

## 11. Quick-Reference Cheat-Table

| Problem | Fix |
|---|---|
| Loss is NaN | Lower learning rate, clip gradients, check for div-by-zero/log(0) |
| Loss not decreasing at all | LR too low, bad initialization, or check `zero_grad()` placement |
| Train loss low, val loss high | Overfitting — add dropout/weight decay, reduce model size, more data |
| Both train and val loss high | Underfitting — bigger model, more epochs, higher LR |
| Val metrics look wrong | Check `model.eval()` was called before validation |
| Training unstable/oscillating | Lower LR, add warmup, check batch size |

## 12. FAQ

**Q: SGD or Adam — which should I default to?**
A: AdamW for almost everything by default — it's far more forgiving of LR choice. SGD+momentum can generalize slightly better on some benchmarks but needs more careful tuning.

**Q: Why did my model's validation accuracy suddenly get worse after I added batch norm?**
A: Check you're calling `model.eval()` during validation — batch norm behaves very differently in train vs. eval mode, and this is the single most common source of this exact symptom.

**Q: Is more layers/parameters always better?**
A: No — beyond your data's capacity to support it, more parameters just means more overfitting risk and slower training, not better generalization.

**Q: Do I need to normalize my input data?**
A: Yes, almost always — unnormalized inputs cause uneven gradient scales across features and slow, unstable training.

**Q: Why is dropout hurting my small model's performance?**
A: Dropout regularizes by adding noise — if the model is already small/underfitting, dropout can push it further into underfitting. Reduce dropout rate or remove it for small models.
