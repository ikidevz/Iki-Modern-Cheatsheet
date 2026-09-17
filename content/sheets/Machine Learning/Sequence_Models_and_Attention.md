# Sequence Models & Attention Cheatsheet

## Overview

This sheet traces the evolution of sequence modeling: RNNs and LSTMs, why they hit a ceiling on long sequences, and how the attention mechanism solved that ceiling and became the foundation of transformers. If NLP Fundamentals gave you the "what," this is the "how it actually works."

```bash
pip install torch --break-system-packages
```

---

## 1. RNN and LSTM/GRU Mechanics

A vanilla RNN processes a sequence one step at a time, carrying a hidden state forward:

```
h_t = tanh(W_x * x_t + W_h * h_{t-1} + b)
```

Each `h_t` is supposed to summarize everything relevant from the sequence so far. The problem: during backpropagation through time, gradients get multiplied by the same weight matrix at every step — over long sequences, this product either shrinks toward zero (**vanishing gradients**, the network "forgets" long-range dependencies) or explodes (numerical instability).

**LSTMs and GRUs** fix this with gating mechanisms that let gradients flow through mostly unchanged over long distances:

```python
import torch
import torch.nn as nn

# Vanilla RNN — struggles with long-range dependencies
rnn = nn.RNN(input_size=10, hidden_size=20, batch_first=True)

# LSTM — has separate cell state (long-term memory) + hidden state (short-term/output),
# regulated by input/forget/output gates
lstm = nn.LSTM(input_size=10, hidden_size=20, batch_first=True)

# GRU — simplified LSTM, fewer parameters, often comparable performance
gru = nn.GRU(input_size=10, hidden_size=20, batch_first=True)

x = torch.randn(4, 15, 10)  # batch=4, sequence_length=15, input_dim=10
output, (h_n, c_n) = lstm(x)
print(f"LSTM output shape: {output.shape}")  # [4, 15, 20] — hidden state at every timestep
print(f"Final hidden state: {h_n.shape}, final cell state: {c_n.shape}")
```

**Why LSTM gating helps:** the forget gate learns *when* to discard old information and the input gate learns *when* to write new information into the cell state — critically, the cell state update is mostly additive (not repeatedly multiplied through a nonlinearity like the vanilla RNN's hidden state), which keeps gradients from vanishing over long sequences.

---

## 2. Sequence-to-Sequence Models and the Bottleneck

Before attention, sequence-to-sequence (seq2seq) models used an encoder RNN to compress an entire input sequence into a single fixed-size vector, then a decoder RNN generated the output from that one vector.

```
Input sequence → [Encoder RNN] → single context vector → [Decoder RNN] → Output sequence
```

**The bottleneck**: for long sequences, cramming everything relevant into one fixed-size vector loses information — the decoder has no way to "look back" at specific parts of the input when generating each output token. This bottleneck is exactly what motivated attention: instead of one compressed vector, let the decoder access *all* of the encoder's hidden states and learn which ones matter for each output step.

---

## 3. Attention From First Principles

### Query, Key, Value

Every attention computation follows the same recipe:
1. **Query (Q)**: "what am I looking for?" — derived from the current position.
2. **Key (K)**: "what do I contain?" — derived from every position being attended to.
3. **Value (V)**: "what do I actually contribute if selected?" — also derived from every position being attended to.

Attention score = how well a query matches a key → softmax to get weights → weighted sum of values.

```python
import torch
import torch.nn.functional as F
import math

def scaled_dot_product_attention(Q, K, V, mask=None):
    d_k = Q.size(-1)
    scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)  # scale by sqrt(d_k) — see below
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float("-inf"))
    attention_weights = F.softmax(scores, dim=-1)
    output = torch.matmul(attention_weights, V)
    return output, attention_weights

batch, seq_len, d_model = 2, 5, 16
Q = torch.randn(batch, seq_len, d_model)
K = torch.randn(batch, seq_len, d_model)
V = torch.randn(batch, seq_len, d_model)

output, weights = scaled_dot_product_attention(Q, K, V)
print(f"Output shape: {output.shape}")            # [2, 5, 16]
print(f"Attention weights shape: {weights.shape}") # [2, 5, 5] — how much each position attends to every other
print(f"Weights sum to 1 per row: {weights[0, 0].sum().item():.3f}")
```

**Why scale by `sqrt(d_k)`:** without scaling, dot products grow large in magnitude as dimensionality increases, pushing softmax into regions with extremely small gradients (saturation). Dividing by `sqrt(d_k)` keeps the scores in a range where softmax gradients stay well-behaved.

---

## 4. Self-Attention, Cross-Attention, and Multi-Head Attention

| Type | Q comes from | K, V come from | Used in |
|---|---|---|---|
| Self-attention | Same sequence | Same sequence | Encoder layers, decoder layers (with causal masking) |
| Cross-attention | Decoder | Encoder output | Encoder-decoder models (translation, summarization) |

```python
class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, num_heads):
        super().__init__()
        assert d_model % num_heads == 0
        self.num_heads = num_heads
        self.d_k = d_model // num_heads
        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, d_model)
        self.W_v = nn.Linear(d_model, d_model)
        self.W_o = nn.Linear(d_model, d_model)

    def forward(self, x, mask=None):
        batch_size, seq_len, d_model = x.shape

        # Project and reshape into (batch, num_heads, seq_len, d_k) — each head sees a slice of d_model
        Q = self.W_q(x).view(batch_size, seq_len, self.num_heads, self.d_k).transpose(1, 2)
        K = self.W_k(x).view(batch_size, seq_len, self.num_heads, self.d_k).transpose(1, 2)
        V = self.W_v(x).view(batch_size, seq_len, self.num_heads, self.d_k).transpose(1, 2)

        attn_output, _ = scaled_dot_product_attention(Q, K, V, mask)

        # Concatenate heads back together
        attn_output = attn_output.transpose(1, 2).contiguous().view(batch_size, seq_len, d_model)
        return self.W_o(attn_output)

mha = MultiHeadAttention(d_model=64, num_heads=8)
x = torch.randn(2, 10, 64)
out = mha(x)
print(f"Multi-head attention output shape: {out.shape}")  # [2, 10, 64]
```

**Why multiple heads help:** a single attention computation learns one "type" of relationship (e.g., syntactic agreement). Multiple heads, each with their own learned Q/K/V projections, let the model attend to different kinds of relationships in parallel (one head might track subject-verb agreement, another might track coreference) — then combine them.

---

## 5. Positional Encoding

Attention itself has no notion of order — it's a set operation over positions. Without positional information, "the cat chased the dog" and "the dog chased the cat" would produce identical attention patterns per-token.

```python
def sinusoidal_positional_encoding(seq_len, d_model):
    position = torch.arange(seq_len).unsqueeze(1).float()
    div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
    pe = torch.zeros(seq_len, d_model)
    pe[:, 0::2] = torch.sin(position * div_term)
    pe[:, 1::2] = torch.cos(position * div_term)
    return pe

pe = sinusoidal_positional_encoding(seq_len=50, d_model=64)
print(f"Positional encoding shape: {pe.shape}")  # [50, 64], added directly to token embeddings
```

| Scheme | Idea | Used in |
|---|---|---|
| Sinusoidal | Fixed sin/cos functions of position | Original Transformer |
| Learned | A trainable embedding table indexed by position | BERT, GPT-2 |
| Rotary (RoPE) | Rotates Q/K vectors by an angle proportional to position | LLaMA, most modern LLMs |

RoPE has become the dominant choice in current LLMs because it naturally encodes *relative* position (how far apart two tokens are) rather than only absolute position, and generalizes better to sequence lengths longer than what the model was trained on.

---

## 6. When an RNN Is Still the Right Choice

- **Streaming/online inference** where you must process one token at a time with strict low latency and constant memory — an RNN's O(1) per-step update can beat a transformer's need to reprocess (or cache) the whole context.
- **Very long sequences with tight memory budgets** — plain self-attention is O(n²) in sequence length; an RNN is O(n). (Note: many modern long-context transformer variants mitigate this with sparse/linear attention, narrowing this gap.)
- **Small models/edge deployment** where a small LSTM is cheaper to run than even a small transformer.
- **Genuinely small datasets** where a transformer's larger parameter count and weaker inductive bias toward sequential order make it more prone to overfitting than a recurrent model.

## Common Pitfalls

- **Forgetting the causal mask in decoder self-attention** — without it, the model can "cheat" by attending to future tokens during training, which it won't have access to at inference time.
- **Not scaling attention scores by `sqrt(d_k)`** — leads to softmax saturation and poor gradient flow, especially with larger `d_model`.
- **Assuming more attention heads is always better** — beyond a point, additional heads mostly redistribute the same total representational capacity rather than adding new capability.
- **Ignoring positional encoding entirely** — a transformer without any positional signal cannot distinguish word order at all.
- **Using vanilla RNNs on long sequences** where an LSTM/GRU (or a transformer) is a straightforward and usually necessary upgrade.

---

## 7. End-to-End Worked Example: A Minimal Transformer Encoder Block From Scratch

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math

class TransformerEncoderBlock(nn.Module):
    """A single, complete transformer encoder block: multi-head self-attention + feedforward,
    each wrapped with a residual connection and layer normalization."""
    def __init__(self, d_model, num_heads, d_ff, dropout=0.1):
        super().__init__()
        self.attention = nn.MultiheadAttention(d_model, num_heads, dropout=dropout, batch_first=True)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.feedforward = nn.Sequential(
            nn.Linear(d_model, d_ff), nn.GELU(), nn.Dropout(dropout), nn.Linear(d_ff, d_model),
        )
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, mask=None):
        # Pre-norm variant: normalize BEFORE the sublayer, a common modern choice for training stability
        attn_out, attn_weights = self.attention(self.norm1(x), self.norm1(x), self.norm1(x), attn_mask=mask)
        x = x + self.dropout(attn_out)          # residual connection #1
        ff_out = self.feedforward(self.norm2(x))
        x = x + self.dropout(ff_out)             # residual connection #2
        return x, attn_weights

class MiniTransformerEncoder(nn.Module):
    def __init__(self, vocab_size, d_model=128, num_heads=4, d_ff=512, num_layers=3, max_len=100):
        super().__init__()
        self.token_embedding = nn.Embedding(vocab_size, d_model)
        self.register_buffer("positional_encoding", self._sinusoidal_pe(max_len, d_model))
        self.layers = nn.ModuleList([
            TransformerEncoderBlock(d_model, num_heads, d_ff) for _ in range(num_layers)
        ])
        self.final_norm = nn.LayerNorm(d_model)

    def _sinusoidal_pe(self, max_len, d_model):
        position = torch.arange(max_len).unsqueeze(1).float()
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe = torch.zeros(max_len, d_model)
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        return pe

    def forward(self, token_ids):
        seq_len = token_ids.size(1)
        x = self.token_embedding(token_ids) + self.positional_encoding[:seq_len]
        for layer in self.layers:
            x, _ = layer(x)
        return self.final_norm(x)

model = MiniTransformerEncoder(vocab_size=10000, d_model=128, num_heads=4, num_layers=3)
tokens = torch.randint(0, 10000, (2, 20))  # batch of 2 sequences, length 20
output = model(tokens)
print(f"Encoder output shape: {output.shape}")  # [2, 20, 128] — one contextualized vector per token

n_params = sum(p.numel() for p in model.parameters())
print(f"Total parameters: {n_params:,}")
```

Building this from scratch — rather than only calling `AutoModel.from_pretrained(...)` — is what makes concepts like residual connections, pre-norm vs. post-norm, and positional encoding integration concrete instead of abstract. Every production transformer (BERT, GPT, LLaMA) is fundamentally this block, stacked deeper, with architectural tweaks (RoPE instead of sinusoidal PE, RMSNorm instead of LayerNorm, SwiGLU instead of a plain GELU feedforward) layered on top.

---

## 8. Advanced & Lesser-Known Techniques

- **Pre-norm vs. post-norm**: the original Transformer paper used post-norm (normalize *after* the residual add); most modern large models use pre-norm (as implemented above) because it produces more stable gradients in very deep stacks, at a small cost in final performance for shallow models.
- **RMSNorm**: a simplified, slightly faster alternative to LayerNorm that skips mean-centering and only rescales by the root-mean-square of activations — used in LLaMA and several other modern LLMs.
- **Grouped-query attention (GQA)**: a middle ground between full multi-head attention (every head has its own K/V projections) and multi-query attention (all heads share one K/V projection) — groups of heads share K/V projections, substantially reducing memory bandwidth for the KV cache during inference with a small quality cost, widely used in modern efficient LLM serving.
- **Sliding window / local attention**: restricts each token's attention to a fixed-size local window instead of the full sequence, reducing the O(n²) cost to O(n·w) — used in long-context models to make very long sequences tractable, sometimes combined with periodic "global" tokens that attend to everything.
- **FlashAttention**: an IO-aware exact attention algorithm that restructures the computation to minimize slow GPU memory reads/writes rather than approximating attention — a substantial real-world speedup with no accuracy tradeoff, now standard in most production transformer implementations.

---

## 9. Practice Exercises

1. Modify the `MiniTransformerEncoder` above to use post-norm instead of pre-norm, and compare training stability (loss curve smoothness) on a toy sequence classification task as you increase `num_layers` from 3 to 12.
2. Implement causal masking for the attention block above (so it behaves as a decoder block) and verify a token at position `i` cannot attend to positions `> i` by inspecting the attention weights.
3. Replace the sinusoidal positional encoding with a learned `nn.Embedding` for positions and compare downstream task performance on a short-sequence task.
4. Implement grouped-query attention as a modification of `nn.MultiheadAttention` (or from scratch) and measure the KV cache memory savings for a given number of heads and groups.
5. Visualize the attention weights from a trained instance of this model on a specific input sequence — identify whether any particular head specializes in attending to adjacent tokens vs. distant ones.

---

## 10. More Examples

### Example: Visualizing attention weights on a real sentence

```python
from transformers import AutoTokenizer, AutoModel
import torch

tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
model = AutoModel.from_pretrained("bert-base-uncased", output_attentions=True)

sentence = "The cat sat on the mat because it was tired."
inputs = tokenizer(sentence, return_tensors="pt")
with torch.no_grad():
    outputs = model(**inputs)

tokens = tokenizer.convert_ids_to_tokens(inputs["input_ids"][0])
# attentions: tuple of (num_layers) tensors, each [batch, num_heads, seq_len, seq_len]
last_layer_attention = outputs.attentions[-1][0]  # last layer, first (only) batch item

it_idx = tokens.index("it")
head_0_attention_from_it = last_layer_attention[0, it_idx]  # head 0's attention FROM "it" to all tokens
top_attended = torch.topk(head_0_attention_from_it, k=3)
print(f"'it' attends most strongly to: {[tokens[i] for i in top_attended.indices]}")
# A well-trained model often resolves "it" -> "cat" (coreference), visible directly in attention weights
```

### Example: A simple encoder-decoder for sequence-to-sequence translation-style tasks

```python
import torch
import torch.nn as nn

class Seq2SeqWithAttention(nn.Module):
    """Minimal encoder-decoder with cross-attention — the architecture behind translation/summarization."""
    def __init__(self, vocab_size, d_model=64, num_heads=4):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.encoder = nn.TransformerEncoderLayer(d_model, num_heads, batch_first=True)
        self.decoder = nn.TransformerDecoderLayer(d_model, num_heads, batch_first=True)
        self.output_proj = nn.Linear(d_model, vocab_size)

    def forward(self, src_tokens, tgt_tokens):
        src_emb = self.embedding(src_tokens)
        tgt_emb = self.embedding(tgt_tokens)
        memory = self.encoder(src_emb)  # encode the FULL source sequence bidirectionally
        causal_mask = nn.Transformer.generate_square_subsequent_mask(tgt_tokens.size(1))
        decoded = self.decoder(tgt_emb, memory, tgt_mask=causal_mask)  # cross-attends to `memory`
        return self.output_proj(decoded)

model = Seq2SeqWithAttention(vocab_size=5000)
src = torch.randint(0, 5000, (2, 10))
tgt = torch.randint(0, 5000, (2, 8))
logits = model(src, tgt)
print(f"Output logits shape: {logits.shape}")  # [2, 8, 5000] — a distribution over vocab per target position
```

### Example: Comparing parameter counts — RNN vs. Transformer at similar capacity

```python
import torch.nn as nn

lstm = nn.LSTM(input_size=256, hidden_size=512, num_layers=2, batch_first=True)
transformer_layer = nn.TransformerEncoderLayer(d_model=256, nhead=8, dim_feedforward=1024)

lstm_params = sum(p.numel() for p in lstm.parameters())
transformer_params = sum(p.numel() for p in transformer_layer.parameters())
print(f"LSTM (2 layers): {lstm_params:,} params")
print(f"Transformer (1 layer): {transformer_params:,} params")
# Rough parameter parity doesn't mean equal compute cost — transformers parallelize
# across the sequence dimension during training, while RNNs are inherently sequential
```

---

## 11. Quick-Reference Cheat-Table

| Need | Choice |
|---|---|
| Streaming/low-memory sequence processing | RNN/LSTM |
| Best general sequence accuracy | Transformer |
| Very long sequences, limited memory | Sliding window / linear attention transformer variants |
| Fast inference with many heads | Grouped-query attention |
| Positional info that generalizes to longer sequences | RoPE |
| Deep transformer stack stability | Pre-norm architecture |

## 12. FAQ

**Q: Why do transformers need positional encoding at all?**
A: Self-attention is inherently order-agnostic (a set operation) — without positional information, word order would be invisible to the model.

**Q: LSTM or Transformer — which should I default to today?**
A: Transformer, for nearly all cases with sufficient data/compute. Reach for LSTM only under tight latency/memory constraints or genuinely small datasets.

**Q: Why does my causal (decoder) model perform badly without a mask?**
A: Without causal masking, the model can "cheat" by attending to future tokens during training — it won't have access to those at real inference time, so training and inference diverge.

**Q: Do more attention heads always help?**
A: Not indefinitely — beyond a point, additional heads mostly redistribute existing representational capacity rather than adding new capability.

**Q: What's the practical difference between self-attention and cross-attention?**
A: Self-attention relates a sequence to itself; cross-attention relates one sequence (e.g., a decoder) to a different sequence (e.g., an encoder's output) — used in translation/RAG-style architectures.
