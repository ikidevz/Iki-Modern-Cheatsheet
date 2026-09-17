# Fine-tuning & PEFT Cheatsheet

## Overview

Full fine-tuning of a modern LLM means updating billions of parameters — expensive in compute, memory, and storage (a full copy of the model per fine-tune). Parameter-efficient fine-tuning (PEFT) methods like LoRA and QLoRA get most of the benefit at a fraction of the cost. This sheet covers when each approach is worth it, how LoRA/QLoRA actually work, and how to avoid wrecking a good base model with a bad fine-tune.

```bash
pip install transformers peft bitsandbytes accelerate trl --break-system-packages
```

---

## 1. Full Fine-Tuning vs. PEFT

| | Full fine-tuning | PEFT (LoRA/QLoRA) |
|---|---|---|
| Parameters updated | All (billions) | A small fraction (often < 1%) |
| GPU memory needed | Very high — optimizer states scale with full parameter count | Much lower — optimizer states only track the small adapter |
| Storage per fine-tune | A full model copy (tens of GB) | A few MB–hundreds of MB adapter file |
| Training speed | Slower | Faster |
| Typical accuracy vs. full fine-tuning | Ceiling | Usually within a small margin, sometimes matching it |
| When it's worth the cost | Deep domain shift, abundant compute/data, need the absolute best possible performance | Almost everywhere else — the practical default |

---

## 2. LoRA: Low-Rank Adapters

LoRA's insight: the *change* in weights needed to adapt a pretrained model to a new task tends to have low "intrinsic rank" — it can be well-approximated by the product of two small matrices, rather than a full-rank update to the entire weight matrix.

```python
import torch
import torch.nn as nn

class LoRALayer(nn.Module):
    """
    Wraps a frozen linear layer with a trainable low-rank update:
    output = frozen_layer(x) + (alpha/rank) * (x @ A @ B)
    """
    def __init__(self, original_layer: nn.Linear, rank=8, alpha=16):
        super().__init__()
        self.original_layer = original_layer
        for param in self.original_layer.parameters():
            param.requires_grad = False  # freeze the pretrained weights entirely

        in_dim, out_dim = original_layer.in_features, original_layer.out_features
        self.A = nn.Parameter(torch.randn(in_dim, rank) * 0.01)  # small random init
        self.B = nn.Parameter(torch.zeros(rank, out_dim))        # zero init -> starts as a no-op
        self.scaling = alpha / rank

    def forward(self, x):
        frozen_output = self.original_layer(x)
        lora_update = (x @ self.A @ self.B) * self.scaling
        return frozen_output + lora_update

# Original layer has in_dim * out_dim parameters (e.g., 4096*4096 = ~16.7M for a typical attention projection)
original = nn.Linear(4096, 4096)
lora_wrapped = LoRALayer(original, rank=8)

trainable_params = sum(p.numel() for p in lora_wrapped.parameters() if p.requires_grad)
total_params = sum(p.numel() for p in lora_wrapped.parameters())
print(f"Trainable: {trainable_params:,} / Total: {total_params:,} "
      f"({100 * trainable_params / total_params:.2f}%)")
# Only A and B are trainable: 4096*8 + 8*4096 ≈ 65K params, vs 16.7M in the full layer
```

**Why zero-init `B`:** starting the LoRA update at exactly zero means the adapted model behaves identically to the base model before any training happens, so training starts from a known-good point rather than a randomly-perturbed one.

### Using the `peft` library in practice

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model, TaskType

model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.1-8B")
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B")

lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=8,                 # rank — the key size/capacity tradeoff knob
    lora_alpha=16,        # scaling factor, commonly set to 2x the rank
    lora_dropout=0.05,
    target_modules=["q_proj", "v_proj"],  # which layers get adapters — attention projections are the common target
)

peft_model = get_peft_model(model, lora_config)
peft_model.print_trainable_parameters()
# Typically prints something like: "trainable params: 4,194,304 || all params: 8,034,000,000 || trainable%: 0.05"
```

---

## 3. QLoRA: Quantization + LoRA

QLoRA combines LoRA with 4-bit quantization of the frozen base model, dramatically cutting memory requirements — enough to fine-tune a 65B-parameter model on a single high-memory consumer GPU in the original QLoRA paper's benchmarks.

```python
from transformers import BitsAndBytesConfig

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",              # "NormalFloat4" — a quantization scheme tuned for normally-distributed weights
    bnb_4bit_compute_dtype=torch.bfloat16,  # compute still happens in higher precision, just storage is 4-bit
    bnb_4bit_use_double_quant=True,         # quantizes the quantization constants too, saves a bit more memory
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    quantization_config=bnb_config,
    device_map="auto",
)

# LoRA adapters are still trained in full precision — only the FROZEN base model is 4-bit
peft_model = get_peft_model(model, lora_config)
```

**Why this works:** the frozen base model's weights only need to be read during the forward/backward pass, not updated — so storing them at 4-bit precision (with compute temporarily upcast to bfloat16 for numerical stability) barely affects quality while cutting memory roughly 4x compared to full 16-bit weights.

---

## 4. Instruction Tuning and RLHF/DPO (Conceptual)

| Stage | What it does |
|---|---|
| Pretraining | Learn general language modeling from massive unlabeled text |
| Instruction tuning (SFT) | Fine-tune on (instruction, good response) pairs so the model follows instructions instead of just continuing text |
| RLHF | Train a reward model on human preference comparisons, then use RL (typically PPO) to optimize the LLM against that reward |
| DPO (Direct Preference Optimization) | Skips the separate reward model and RL loop — directly optimizes the LLM on preference pairs with a closed-form loss, simpler and more stable to train than RLHF |

```python
# Conceptual DPO loss — encourages higher probability for the "chosen" response
# relative to the "rejected" response, compared to a frozen reference model
def dpo_loss_conceptual(policy_chosen_logps, policy_rejected_logps,
                         ref_chosen_logps, ref_rejected_logps, beta=0.1):
    policy_logratios = policy_chosen_logps - policy_rejected_logps
    ref_logratios = ref_chosen_logps - ref_rejected_logps
    logits = beta * (policy_logratios - ref_logratios)
    loss = -torch.nn.functional.logsigmoid(logits)
    return loss.mean()
```

DPO's practical appeal: RLHF requires training and maintaining a separate reward model plus a full RL training loop (notoriously fiddly to stabilize); DPO reformulates the same underlying objective as a simple supervised loss over preference pairs, using the base model as its own implicit reward signal.

---

## 5. Dataset Construction for Fine-Tuning

- **Quality over quantity**: a few hundred carefully curated, correct, diverse examples routinely outperform tens of thousands of noisy or repetitive ones — the LIMA paper's finding that ~1,000 high-quality examples can rival much larger instruction-tuning datasets is a widely cited example of this.
- **Diversity of format and phrasing**: if every training example uses the exact same phrasing template, the model learns to match that template rather than the underlying task, and generalizes poorly to differently-phrased real requests.
- **Avoiding catastrophic forgetting**: fine-tuning too aggressively (too many epochs, too high a learning rate, too narrow a dataset) can degrade the base model's general capabilities. Mitigations: keep learning rates low, limit epochs (often 1-3 for instruction tuning), and mix in a small amount of general-purpose data alongside task-specific examples if broad capability retention matters.

```python
# A minimal instruction-tuning dataset format
training_examples = [
    {"instruction": "Summarize this in one sentence.", "input": "...", "output": "..."},
    {"instruction": "Translate to French.", "input": "Good morning.", "output": "Bonjour."},
]

def format_prompt(example):
    return f"### Instruction:\n{example['instruction']}\n\n### Input:\n{example['input']}\n\n### Response:\n{example['output']}"
```

---

## 6. Evaluating a Fine-Tune

```python
# Held-out task performance: did the fine-tune improve on the target task?
def evaluate_task_performance(model, eval_dataset):
    correct = 0
    for example in eval_dataset:
        prediction = model.generate(example["input"])
        correct += (prediction.strip() == example["expected_output"].strip())
    return correct / len(eval_dataset)

# General capability regression: did fine-tuning HURT unrelated capabilities?
# Run the fine-tuned model against a general benchmark (e.g., MMLU) and compare to the base model's score
# base_score = evaluate_on_mmlu(base_model)
# finetuned_score = evaluate_on_mmlu(finetuned_model)
# A meaningful drop here signals catastrophic forgetting, even if task performance improved
```

**The two-sided check that's easy to skip:** it's tempting to only measure whether the fine-tune improved on its target task and declare victory. Always also check general capability retention — a fine-tune that gains 10 points on your task but loses 15 points of broad reasoning ability is often a net loss in a production system that needs to handle varied user input.

## Common Pitfalls

- **Choosing too high a LoRA rank "to be safe"** — higher rank increases trainable parameters and compute without reliably improving quality; rank 8-64 covers the large majority of practical use cases, and larger isn't automatically better.
- **Fine-tuning on a narrow dataset for too many epochs** — a common recipe for catastrophic forgetting and overfitting to quirks of the training set's phrasing.
- **Skipping a held-out eval set entirely** and judging fine-tune quality by spot-checking a handful of outputs — too noisy to trust.
- **Forgetting to freeze the base model's parameters** when manually wrapping layers with LoRA — if the base weights remain trainable, you lose the memory savings and defeat the purpose of PEFT.
- **Deploying a QLoRA-trained adapter without merging or matching quantization** at inference time — inference infrastructure needs to either load the same quantized base + adapter combination, or merge the adapter into a dequantized base model, depending on the serving setup.

---

## 7. End-to-End Worked Example: Full LoRA Fine-Tuning Loop With Evaluation

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, Trainer
from peft import LoraConfig, get_peft_model, TaskType
from datasets import Dataset
import torch

model_name = "meta-llama/Llama-3.2-1B"  # a small model for illustration — same pattern scales up
tokenizer = AutoTokenizer.from_pretrained(model_name)
tokenizer.pad_token = tokenizer.eos_token
base_model = AutoModelForCausalLM.from_pretrained(model_name, torch_dtype=torch.bfloat16)

lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM, r=8, lora_alpha=16, lora_dropout=0.05,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
)
peft_model = get_peft_model(base_model, lora_config)
peft_model.print_trainable_parameters()

# A small instruction-tuning dataset
raw_examples = [
    {"instruction": "Summarize in one sentence.", "input": "The company reported record profits this quarter, driven by strong cloud revenue growth.", "output": "The company posted record profits this quarter thanks to cloud revenue growth."},
    {"instruction": "Convert to a polite tone.", "input": "Send me the report now.", "output": "Could you please send me the report at your earliest convenience?"},
]

def format_example(ex):
    prompt = f"### Instruction:\n{ex['instruction']}\n\n### Input:\n{ex['input']}\n\n### Response:\n{ex['output']}{tokenizer.eos_token}"
    tokenized = tokenizer(prompt, truncation=True, max_length=256, padding="max_length")
    tokenized["labels"] = tokenized["input_ids"].copy()
    return tokenized

dataset = Dataset.from_list(raw_examples).map(format_example)

training_args = TrainingArguments(
    output_dir="./lora_output",
    num_train_epochs=3,           # small dataset -> few epochs to avoid overfitting/forgetting
    per_device_train_batch_size=2,
    learning_rate=2e-4,           # LoRA typically uses a HIGHER LR than full fine-tuning, since
                                   # only a small number of parameters are being updated
    logging_steps=1,
    save_strategy="epoch",
    bf16=True,
)

trainer = Trainer(model=peft_model, args=training_args, train_dataset=dataset)
trainer.train()

# Save just the small adapter — not a full model copy
peft_model.save_pretrained("./lora_adapter")

# Later: load the base model fresh and attach the adapter
from peft import PeftModel
reloaded_base = AutoModelForCausalLM.from_pretrained(model_name, torch_dtype=torch.bfloat16)
reloaded_peft = PeftModel.from_pretrained(reloaded_base, "./lora_adapter")

# Optional: merge the adapter into the base weights for simpler deployment (no PEFT wrapper needed at inference)
merged_model = reloaded_peft.merge_and_unload()
```

The `merge_and_unload()` step at the end is worth calling out: it bakes the LoRA update directly into the base model's weights, producing a single standard model with no runtime PEFT dependency — useful when your serving infrastructure doesn't support (or you don't want the overhead of) loading adapters separately, at the cost of losing the ability to easily swap adapters at runtime.

---

## 8. Advanced & Lesser-Known Techniques

- **Multi-adapter serving**: because LoRA adapters are small, a single base model deployment can hot-swap between many task-specific or customer-specific adapters at inference time without reloading the (much larger) base weights — a common pattern for serving many fine-tuned "personalities" cost-effectively.
- **LoRA rank scheduling**: some recent techniques (AdaLoRA) dynamically allocate rank budget across layers during training, giving more capacity to layers that empirically need more adaptation rather than using a uniform rank everywhere.
- **Prefix tuning / prompt tuning**: alternative PEFT approaches that prepend a small number of trainable "virtual tokens" to the input instead of modifying weight matrices — generally more parameter-efficient than LoRA but often slightly less expressive, useful when even LoRA's parameter count is too much.
- **Merging multiple LoRA adapters (model souping/merging)**: adapters trained on different tasks can sometimes be linearly combined (weighted-averaged) to produce a model with blended capabilities, without any additional joint training — an active area of research with mixed but sometimes surprisingly strong results.

---

## 9. Practice Exercises

1. Run the LoRA worked example with rank 4, 16, and 64, and compare final training loss and the number of trainable parameters at each setting.
2. Fine-tune with a learning rate an order of magnitude higher than shown (2e-3) and observe signs of instability or degraded output quality compared to 2e-4.
3. Implement the QLoRA 4-bit quantization config from this sheet and compare peak GPU memory usage against standard (non-quantized) LoRA fine-tuning on the same model.
4. Train two separate LoRA adapters on two different small tasks, then experiment with loading both simultaneously (if your PEFT version supports adapter switching) and compare behavior when active vs. inactive.
5. Merge a trained LoRA adapter into its base model with `merge_and_unload()`, and verify numerically that the merged model's outputs match the unmerged PEFT-wrapped model's outputs on the same inputs.

---

## 10. More Examples

### Example: Comparing LoRA rank's effect on a toy task directly

```python
from peft import LoraConfig, get_peft_model, TaskType
from transformers import AutoModelForCausalLM
import torch

model_name = "meta-llama/Llama-3.2-1B"

def count_trainable_params(rank):
    base = AutoModelForCausalLM.from_pretrained(model_name, torch_dtype=torch.bfloat16)
    config = LoraConfig(task_type=TaskType.CAUSAL_LM, r=rank, lora_alpha=rank * 2, target_modules=["q_proj", "v_proj"])
    peft_model = get_peft_model(base, config)
    trainable = sum(p.numel() for p in peft_model.parameters() if p.requires_grad)
    return trainable

for rank in [4, 8, 16, 32, 64]:
    print(f"Rank {rank}: {count_trainable_params(rank):,} trainable parameters")
```

### Example: LoRA applied to a vision model, not just an LLM

```python
from peft import LoraConfig, get_peft_model, TaskType
from torchvision.models import resnet50, ResNet50_Weights

vision_model = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2)

# LoRA generalizes beyond transformers — apply it to convolutional layers too
lora_config = LoraConfig(
    r=8, lora_alpha=16, target_modules=["layer4.0.conv1", "layer4.0.conv2"],  # specific conv layers by name
    task_type=TaskType.FEATURE_EXTRACTION,
)
peft_vision_model = get_peft_model(vision_model, lora_config)
peft_vision_model.print_trainable_parameters()
```

### Example: Preparing a preference dataset for DPO

```python
# DPO training data format: each example is a (prompt, chosen response, rejected response) triple
dpo_dataset = [
    {
        "prompt": "Explain quantum computing simply.",
        "chosen": "Quantum computing uses quantum bits that can be both 0 and 1 at once, letting certain problems be solved much faster than with regular computers.",
        "rejected": "Quantum computing is when computers use quantum physics stuff to compute things in a quantum way using qubits and superposition and entanglement.",
    },
]
# The "chosen" response demonstrates clarity for a general audience;
# "rejected" is technically not wrong but circular/jargon-heavy — DPO trains the model
# to prefer the FORMER style, using the base model itself as an implicit reward signal
```

---

## 11. Quick-Reference Cheat-Table

| Situation | Approach |
|---|---|
| Limited GPU memory | QLoRA |
| Standard fine-tune, decent GPU | LoRA |
| Need absolute best possible performance, ample resources | Full fine-tuning |
| Aligning to human preference, simplest path | DPO |
| Aligning to human preference, more established | RLHF (reward model + PPO) |
| Serving many task-specific variants cheaply | Multi-adapter LoRA serving |

## 12. FAQ

**Q: What LoRA rank should I start with?**
A: 8-16 covers most practical use cases. Higher rank rarely helps much and increases compute/trainable parameters for little gain.

**Q: LoRA or full fine-tuning — which should I default to?**
A: LoRA, almost always — it gets most of the benefit at a fraction of the cost. Reserve full fine-tuning for deep domain shifts with abundant compute/data.

**Q: DPO or RLHF — which is simpler to implement?**
A: DPO — it reformulates the same underlying preference-alignment objective as a supervised loss, skipping the separate reward model and RL training loop RLHF requires.

**Q: My fine-tuned model got better at the target task but worse at everything else — what happened?**
A: Catastrophic forgetting — likely too many epochs, too high a learning rate, or too narrow a training set. Check general capability retention, not just target-task metrics.

**Q: Do I need to merge my LoRA adapter into the base model before deploying?**
A: Only if your serving infrastructure doesn't support loading adapters separately, or you want simpler single-model deployment. Keeping them separate allows hot-swapping multiple adapters on one base model.
