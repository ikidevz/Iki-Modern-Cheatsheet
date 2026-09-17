# Distributed & Large-Scale Training Cheatsheet

## Overview

When a model or dataset outgrows a single GPU, training has to be split across multiple devices — this sheet covers the two fundamental ways to split the work (data vs. model parallelism), mixed-precision training for speed, the frameworks that implement all this, and the practical bottlenecks that determine when scaling stops paying off.

```bash
pip install torch deepspeed --break-system-packages
```

---

## 1. Data Parallelism

The simplest and most common form of distributed training: copy the full model onto every GPU, split each batch across them, and synchronize gradients after every step.

```python
import torch
import torch.nn as nn
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP

def setup_ddp(rank, world_size):
    dist.init_process_group("nccl", rank=rank, world_size=world_size)
    torch.cuda.set_device(rank)

def train_ddp(rank, world_size, model, dataset):
    setup_ddp(rank, world_size)
    model = model.to(rank)
    ddp_model = DDP(model, device_ids=[rank])

    sampler = torch.utils.data.distributed.DistributedSampler(dataset, num_replicas=world_size, rank=rank)
    loader = torch.utils.data.DataLoader(dataset, batch_size=32, sampler=sampler)

    optimizer = torch.optim.AdamW(ddp_model.parameters(), lr=1e-4)

    for epoch in range(10):
        sampler.set_epoch(epoch)  # ensures each GPU sees a different shuffle each epoch
        for batch_x, batch_y in loader:
            batch_x, batch_y = batch_x.to(rank), batch_y.to(rank)
            optimizer.zero_grad()
            loss = nn.functional.cross_entropy(ddp_model(batch_x), batch_y)
            loss.backward()  # DDP automatically all-reduces gradients across GPUs here
            optimizer.step()
```

**Gradient synchronization overhead:** after each backward pass, every GPU's gradients must be averaged across all GPUs (an "all-reduce" operation) before the optimizer step — this is a communication cost that grows with model size and number of GPUs, and becomes the dominant bottleneck when per-step compute time is small relative to the communication needed to synchronize.

---

## 2. Model and Pipeline Parallelism

When a model is too large to fit on a single GPU even at batch size 1, data parallelism alone can't help — the model itself must be split.

```python
# Model parallelism: different LAYERS live on different GPUs
class ModelParallelNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.layer1 = nn.Linear(1024, 1024).to("cuda:0")
        self.layer2 = nn.Linear(1024, 1024).to("cuda:1")

    def forward(self, x):
        x = self.layer1(x.to("cuda:0"))
        x = self.layer2(x.to("cuda:1"))  # data must physically move between GPUs mid-forward-pass
        return x
```

```python
# Pipeline parallelism: splits layers across devices LIKE model parallelism, but processes
# multiple micro-batches concurrently so GPUs aren't idle waiting for each other
# (illustrative — real implementations use libraries like DeepSpeed or PyTorch's pipeline API)
pipeline_stages = [
    "GPU 0: layers 1-8",
    "GPU 1: layers 9-16",
    "GPU 2: layers 17-24",
    "GPU 3: layers 25-32",
]
# Without pipelining, GPU 1 sits idle while GPU 0 processes a batch, then GPU 0 sits idle
# while GPU 1 processes it, etc. Pipelining overlaps this by feeding in the NEXT micro-batch
# to GPU 0 as soon as it hands off the current one to GPU 1.
```

| | Data parallelism | Model parallelism | Pipeline parallelism |
|---|---|---|---|
| Splits | Batches across devices | Layers across devices | Layers across devices, with overlapped execution |
| Use when | Model fits on one GPU, dataset/compute is the bottleneck | Model itself doesn't fit on one GPU | Model doesn't fit on one GPU, want to reduce idle time vs. plain model parallelism |
| Communication pattern | Gradient all-reduce after each step | Activations passed between GPUs mid-forward/backward | Same as model parallel, but pipelined to overlap compute |

---

## 3. Mixed-Precision Training

```python
import torch
from torch.cuda.amp import autocast, GradScaler

model = nn.Linear(512, 512).cuda()
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
scaler = GradScaler()  # handles gradient scaling to prevent underflow in FP16

for batch_x, batch_y in dataloader:
    batch_x, batch_y = batch_x.cuda(), batch_y.cuda()
    optimizer.zero_grad()

    with autocast(dtype=torch.bfloat16):  # forward pass runs in reduced precision automatically
        output = model(batch_x)
        loss = nn.functional.mse_loss(output, batch_y)

    scaler.scale(loss).backward()  # scales the loss up before backward to avoid tiny-gradient underflow
    scaler.step(optimizer)          # unscales gradients before the actual optimizer step
    scaler.update()                 # adjusts the scale factor for the next iteration
```

**Why gradient scaling is needed with FP16 (less so with BF16):** FP16 has a much smaller representable range than FP32, so small gradient values can underflow to exactly zero during backpropagation, silently halting learning for those parameters. Scaling the loss up before the backward pass (then unscaling gradients before the optimizer step) keeps values within FP16's representable range. BF16 has the same range as FP32 (just less precision), so it's far less prone to underflow and often used without a `GradScaler` at all — the tradeoff is BF16 uses more memory bandwidth per bit of precision headroom than FP16.

---

## 4. Distributed Training Frameworks

```python
# PyTorch FSDP (Fully Sharded Data Parallel): shards model parameters, gradients, AND optimizer
# states across GPUs — unlike DDP, no single GPU needs to hold a full copy of everything
from torch.distributed.fsdp import FullyShardedDataParallel as FSDP

model = FSDP(large_model)  # automatically shards parameters across available GPUs

# DeepSpeed: implements ZeRO (Zero Redundancy Optimizer) stages, each sharding progressively more
deepspeed_config = {
    "train_batch_size": 256,
    "zero_optimization": {
        "stage": 3,  # stage 3 shards parameters, gradients, AND optimizer states (most memory-efficient)
    },
    "bf16": {"enabled": True},
}
```

| Framework | Key idea | Best for |
|---|---|---|
| PyTorch DDP | Full model replica per GPU, gradient sync | Models that fit comfortably on one GPU, straightforward scaling |
| PyTorch FSDP | Shards parameters/gradients/optimizer state across GPUs | Large models that don't fit as full replicas, native PyTorch integration |
| DeepSpeed (ZeRO) | Progressive sharding stages (1: optimizer state, 2: +gradients, 3: +parameters) | Very large models, need fine-grained control over the memory/communication tradeoff |
| Horovod | Framework-agnostic (works with TensorFlow, PyTorch), ring-allreduce | Multi-framework environments, mature HPC-style clusters |

**Why FSDP/ZeRO matter beyond DDP:** DDP requires every GPU to hold a full copy of the model, gradients, AND optimizer states (which for Adam-family optimizers can be 2-3x the model size itself) — for large models, this triples or quadruples the effective memory requirement per GPU. Sharding these across GPUs (each GPU holds only its slice) is what makes training models far larger than a single GPU's memory would otherwise allow.

---

## 5. Checkpointing Strategies

```python
def save_checkpoint(model, optimizer, epoch, step, path):
    torch.save({
        "epoch": epoch,
        "step": step,
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
    }, path)

def load_checkpoint(model, optimizer, path):
    checkpoint = torch.load(path)
    model.load_state_dict(checkpoint["model_state_dict"])
    optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
    return checkpoint["epoch"], checkpoint["step"]

# Checkpoint on a schedule AND handle preemption gracefully
checkpoint_every_n_steps = 1000
for step, batch in enumerate(dataloader):
    # ... training step ...
    if step % checkpoint_every_n_steps == 0:
        save_checkpoint(model, optimizer, epoch, step, f"checkpoint_step_{step}.pt")
```

**Why checkpointing frequency matters for long runs:** a multi-day or multi-week training run on expensive hardware WILL eventually hit a hardware failure, preemption (common on spot/cheaper cloud instances), or a bug that crashes the job. Checkpointing too infrequently risks losing substantial compute time; checkpointing too frequently adds I/O overhead (writing large model states to disk) that can itself measurably slow down training — the right frequency balances expected time-to-failure against checkpoint write cost.

---

## 6. Communication Bottlenecks and When Scaling Stops Paying Off

```python
# Gradient accumulation: simulate a larger effective batch size WITHOUT more GPUs,
# by accumulating gradients over several forward/backward passes before stepping the optimizer
accumulation_steps = 4
optimizer.zero_grad()
for i, (batch_x, batch_y) in enumerate(dataloader):
    loss = compute_loss(model, batch_x, batch_y) / accumulation_steps  # scale down to average correctly
    loss.backward()  # gradients ACCUMULATE across these calls (no zero_grad in between)
    if (i + 1) % accumulation_steps == 0:
        optimizer.step()
        optimizer.zero_grad()
```

**When scaling stops paying off:** adding more GPUs to a data-parallel job increases the fixed cost of gradient synchronization every step, while the useful compute per GPU per step stays the same (or shrinks, if the per-GPU batch size shrinks to keep the global batch size constant). Beyond a certain point — which depends on the model size, interconnect bandwidth (NVLink vs. slower networking), and per-step compute time — the communication overhead dominates and additional GPUs yield diminishing or even negative returns on wall-clock training time. Gradient accumulation is the standard workaround when you want a larger effective batch size without paying this communication cost for more physical GPUs.

## Common Pitfalls

- **Not calling `sampler.set_epoch()` in DDP** — every GPU ends up seeing data in the exact same shuffle order every epoch, weakening the randomization data parallelism is supposed to provide.
- **Using FP16 without gradient scaling** — silent gradient underflow that looks like slow/stalled convergence rather than an obvious error.
- **Choosing DDP for a model too large to fit as a full replica per GPU** — leads to OOM; FSDP or model/pipeline parallelism is needed instead.
- **Checkpointing too infrequently on preemptible/spot instances** — a preemption can wipe out far more compute time than a slightly more frequent checkpoint schedule would have cost.
- **Scaling to more GPUs without checking communication overhead** — past a certain point, more GPUs can make a data-parallel job SLOWER in wall-clock time, not faster, if the interconnect can't keep up with gradient synchronization demands.

---

## 7. End-to-End Worked Example: A Complete Multi-GPU Training Script With DDP, AMP, and Checkpointing

```python
import os
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.distributed as dist
import torch.multiprocessing as mp
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data import DataLoader, TensorDataset, DistributedSampler
from torch.cuda.amp import autocast, GradScaler

def setup(rank, world_size):
    os.environ["MASTER_ADDR"] = "localhost"
    os.environ["MASTER_PORT"] = "12355"
    dist.init_process_group("nccl", rank=rank, world_size=world_size)
    torch.cuda.set_device(rank)

def cleanup():
    dist.destroy_process_group()

def train_worker(rank, world_size, n_epochs=5, checkpoint_path="ddp_checkpoint.pt"):
    setup(rank, world_size)

    model = nn.Sequential(nn.Linear(128, 256), nn.ReLU(), nn.Linear(256, 10)).to(rank)
    model = DDP(model, device_ids=[rank])
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
    scaler = GradScaler()

    # Resume from checkpoint if one exists (handles preemption gracefully)
    start_epoch = 0
    if os.path.exists(checkpoint_path):
        checkpoint = torch.load(checkpoint_path, map_location=f"cuda:{rank}")
        model.load_state_dict(checkpoint["model_state_dict"])
        optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        start_epoch = checkpoint["epoch"] + 1
        if rank == 0:
            print(f"Resumed from epoch {start_epoch}")

    X = torch.randn(2000, 128)
    y = torch.randint(0, 10, (2000,))
    dataset = TensorDataset(X, y)
    sampler = DistributedSampler(dataset, num_replicas=world_size, rank=rank)
    loader = DataLoader(dataset, batch_size=32, sampler=sampler)

    for epoch in range(start_epoch, n_epochs):
        sampler.set_epoch(epoch)  # different shuffle per epoch across all ranks
        model.train()
        epoch_loss = 0.0

        for batch_x, batch_y in loader:
            batch_x, batch_y = batch_x.to(rank), batch_y.to(rank)
            optimizer.zero_grad()

            with autocast(dtype=torch.bfloat16):
                loss = F.cross_entropy(model(batch_x), batch_y)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            epoch_loss += loss.item()

        # Only rank 0 logs and checkpoints, to avoid redundant I/O across GPUs
        if rank == 0:
            print(f"Epoch {epoch}: avg loss = {epoch_loss / len(loader):.4f}")
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
            }, checkpoint_path)

    cleanup()

def main():
    world_size = torch.cuda.device_count()
    if world_size < 2:
        print("This example needs 2+ GPUs to demonstrate DDP meaningfully; running conceptually.")
        return
    mp.spawn(train_worker, args=(world_size,), nprocs=world_size, join=True)

if __name__ == "__main__":
    main()
```

This combines every piece from the base sheet into one script: `DistributedSampler` with `set_epoch()` for correct shuffling, mixed-precision training with `GradScaler`, checkpointing gated to rank 0 only (avoiding every GPU redundantly writing the same file), and resume-from-checkpoint logic to survive a preemption — the actual shape of a production multi-GPU training entrypoint.

---

## 8. Advanced & Lesser-Known Techniques

- **Elastic training** (`torchrun` with elastic parameters): allows the number of participating workers to change during training (nodes joining or leaving), rather than requiring a fixed `world_size` for the entire job — valuable on spot/preemptible infrastructure where node availability fluctuates.
- **Activation checkpointing (gradient checkpointing)**: trades compute for memory by NOT storing all intermediate activations during the forward pass, instead recomputing them during the backward pass as needed — lets you fit larger batch sizes or models in the same GPU memory, at the cost of roughly 20-30% more compute time.
- **Sequence/context parallelism**: for extremely long sequences (relevant to long-context LLM training), splits a single sequence's computation across multiple GPUs (rather than splitting by batch or by layer) — necessary when even a single long sequence's activation memory doesn't fit on one device.
- **Communication-computation overlap**: modern distributed training frameworks overlap gradient all-reduce communication with the backward pass computation itself (rather than waiting for the full backward pass to finish before starting communication) — a significant practical speedup that DDP implements automatically but is worth understanding when diagnosing why scaling efficiency falls short of the naive expectation.

---

## 9. Practice Exercises

1. Run the DDP worked example (or a scaled-down single-GPU-per-process simulation) with and without `autocast`/`GradScaler`, and measure the difference in memory usage and training speed.
2. Deliberately kill the training process mid-epoch and restart it — verify it resumes from the correct epoch using the checkpoint, rather than restarting from scratch.
3. Implement activation checkpointing (`torch.utils.checkpoint`) on a deep MLP and measure the peak memory reduction against the same model without checkpointing, along with the resulting change in epoch training time.
4. Profile the gradient synchronization time vs. compute time per step as you scale from 2 to 4 (simulated or real) GPUs, and identify the point where communication overhead becomes a significant fraction of total step time.
5. Implement gradient accumulation (from section 6 of the base sheet) alongside DDP to simulate an effective batch size 4x larger than what fits in memory per GPU, and verify the resulting gradients are mathematically equivalent (up to floating-point precision) to true large-batch training.

---

## 10. More Examples

### Example: Estimating memory requirements before launching a training job

```python
def estimate_training_memory_gb(n_params_billions, precision_bytes=2, optimizer="adamw"):
    """A quick back-of-envelope check BEFORE renting expensive multi-GPU hardware —
    avoids discovering an OOM error after an hour of setup."""
    params_memory = n_params_billions * 1e9 * precision_bytes
    gradients_memory = params_memory  # same size as parameters
    optimizer_multiplier = {"sgd": 1, "adamw": 2}[optimizer]  # AdamW stores 2 extra moment estimates
    optimizer_memory = params_memory * optimizer_multiplier
    total_bytes = params_memory + gradients_memory + optimizer_memory
    return total_bytes / 1e9

for n_params in [1, 7, 13, 70]:
    mem = estimate_training_memory_gb(n_params)
    print(f"{n_params}B model: ~{mem:.0f} GB needed for full fine-tuning (before activations)")
    # Compare against actual GPU memory (e.g., 80GB per H100) to decide if FSDP/DeepSpeed/QLoRA is required
```

### Example: A minimal all-reduce implementation to understand what DDP does under the hood

```python
import torch
import torch.distributed as dist

def manual_all_reduce_average(tensor, world_size):
    """This is conceptually what happens automatically inside DDP's backward() call —
    summing gradients across all processes, then dividing by world_size for the average."""
    dist.all_reduce(tensor, op=dist.ReduceOp.SUM)
    tensor /= world_size
    return tensor

# On each process: manual_all_reduce_average(local_gradient, world_size=4)
# Every process ends up with the IDENTICAL averaged gradient after this call —
# which is exactly why every replica's model weights stay in sync throughout training
```

### Example: Profiling to find the actual bottleneck before optimizing blindly

```python
import torch
from torch.profiler import profile, ProfilerActivity

model = torch.nn.Linear(1024, 1024).cuda()
x = torch.randn(256, 1024).cuda()

with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA], record_shapes=True) as prof:
    for _ in range(10):
        output = model(x)
        loss = output.sum()
        loss.backward()

print(prof.key_averages().table(sort_by="cuda_time_total", row_limit=10))
# Always profile BEFORE assuming the bottleneck is compute, data loading, or communication —
# the actual answer is often surprising and changes what optimization is worth pursuing
```

---

## 11. Quick-Reference Cheat-Table

| Situation | Choice |
|---|---|
| Model fits on one GPU, dataset is the bottleneck | Data parallelism (DDP) |
| Model doesn't fit on one GPU | FSDP or DeepSpeed ZeRO |
| Want larger effective batch size, no more GPUs | Gradient accumulation |
| Training on spot/preemptible instances | Frequent checkpointing + elastic training |
| Memory-constrained, can trade compute for memory | Activation checkpointing |
| FP16 gradients underflowing | Use `GradScaler`, or switch to BF16 |

## 12. FAQ

**Q: DDP or FSDP — which should I use?**
A: DDP if your model fits comfortably as a full replica per GPU. FSDP/DeepSpeed if it doesn't — they shard parameters/gradients/optimizer states instead of replicating everything.

**Q: Why is my multi-GPU training barely faster than single-GPU?**
A: Communication overhead (gradient synchronization) may be dominating — profile before assuming more GPUs will always help; past a point, scaling can yield diminishing or negative returns.

**Q: FP16 or BF16 for mixed-precision training?**
A: BF16 when your hardware supports it — same range as FP32 (less prone to underflow), often used without a `GradScaler`. FP16 needs gradient scaling to avoid underflow.

**Q: How often should I checkpoint during a long training run?**
A: Balance expected time-to-failure (especially on preemptible instances) against checkpoint I/O overhead — too infrequent risks losing significant compute; too frequent slows training.

**Q: Did I forget something if my DDP training doesn't reshuffle data properly each epoch?**
A: Yes — check that you're calling `sampler.set_epoch(epoch)` on your `DistributedSampler` every epoch; otherwise every GPU sees the identical shuffle order every time.
