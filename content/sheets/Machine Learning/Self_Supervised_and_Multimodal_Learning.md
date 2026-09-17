# Self-Supervised & Multimodal Learning Cheatsheet

## Overview

Labeled data is expensive; raw data is (relatively) cheap. Self-supervised learning generates training signal from the structure of unlabeled data itself, and it's the training paradigm behind essentially every modern foundation model. This sheet covers the main pretext tasks, contrastive learning, and multimodal architectures that connect text, images, and audio in a shared representation space.

```bash
pip install torch transformers --break-system-packages
```

---

## 1. Self-Supervised Pretext Tasks

A "pretext task" is a task the model can be trained on using only the structure of the raw data — no human labels required — chosen because solving it forces the model to learn generally useful representations.

| Pretext task | Domain | Idea |
|---|---|---|
| Masked language modeling (MLM) | Text | Hide ~15% of tokens, predict them from context (BERT) |
| Next-token prediction | Text | Predict the next token given everything before it (GPT) |
| Masked image modeling (MIM) | Images | Hide patches of an image, reconstruct them (MAE, BEiT) |
| Rotation prediction | Images | Rotate an image randomly, predict the rotation angle |
| Contrastive prediction | Any | Pull representations of "related" pairs together, push unrelated pairs apart |

```python
import torch
import torch.nn as nn

# Masked Language Modeling — illustrative, simplified version of what BERT does
def create_mlm_batch(token_ids, mask_token_id, vocab_size, mask_prob=0.15):
    labels = token_ids.clone()
    mask = torch.rand(token_ids.shape) < mask_prob
    masked_input = token_ids.clone()
    masked_input[mask] = mask_token_id
    labels[~mask] = -100  # -100 is ignored by CrossEntropyLoss — only compute loss on masked positions
    return masked_input, labels

token_ids = torch.randint(0, 30000, (4, 20))  # batch of 4 sequences, length 20
masked_input, labels = create_mlm_batch(token_ids, mask_token_id=103, vocab_size=30000)
print(f"Fraction of tokens masked: {(labels != -100).float().mean():.2%}")
```

```python
# Masked Image Modeling — mask random patches, train a model to reconstruct pixel values
def mask_image_patches(patches, mask_ratio=0.75):
    """patches: [batch, num_patches, patch_dim]. MAE-style: mask a HIGH ratio (75%) — much higher than MLM's 15%."""
    num_patches = patches.size(1)
    num_masked = int(num_patches * mask_ratio)
    mask = torch.zeros(patches.size(0), num_patches, dtype=torch.bool)
    for i in range(patches.size(0)):
        masked_idx = torch.randperm(num_patches)[:num_masked]
        mask[i, masked_idx] = True
    return mask

patches = torch.randn(4, 196, 768)  # e.g., a 224x224 image split into 14x14=196 patches
mask = mask_image_patches(patches)
print(f"Masked {mask.float().mean():.0%} of patches")
```

**Why MAE masks so much more aggressively than BERT (75% vs. 15%):** images have far more spatial redundancy than text — a masked patch can often be roughly inferred just by interpolating from nearby patches at a low mask ratio, so a much higher ratio is needed to force the model to learn genuinely useful high-level representations rather than just local interpolation.

---

## 2. Contrastive Learning

Contrastive objectives train a model to produce similar embeddings for "positive" pairs (two augmented views of the same image, or a matching image-caption pair) and dissimilar embeddings for "negative" pairs (everything else in the batch).

```python
import torch.nn.functional as F

def simclr_loss(z1, z2, temperature=0.5):
    """
    z1, z2: embeddings of two augmented views of the SAME batch of images, [batch, dim]
    Every other image in the batch (and its augmented view) serves as a negative.
    """
    batch_size = z1.size(0)
    z1, z2 = F.normalize(z1, dim=1), F.normalize(z2, dim=1)
    representations = torch.cat([z1, z2], dim=0)  # [2*batch, dim]

    similarity_matrix = torch.matmul(representations, representations.T) / temperature

    # Mask out self-similarity (diagonal) — a sample is never its own negative
    mask = torch.eye(2 * batch_size, dtype=torch.bool)
    similarity_matrix.masked_fill_(mask, float("-inf"))

    # Positive pairs: z1[i] <-> z2[i], at offset `batch_size` in the concatenated tensor
    positive_indices = torch.cat([
        torch.arange(batch_size, 2 * batch_size),
        torch.arange(0, batch_size),
    ])
    loss = F.cross_entropy(similarity_matrix, positive_indices)
    return loss

z1 = torch.randn(8, 128)  # embeddings from augmented view 1
z2 = torch.randn(8, 128)  # embeddings from augmented view 2 of the SAME 8 images
loss = simclr_loss(z1, z2)
print(f"SimCLR contrastive loss: {loss.item():.4f}")
```

**The role of negative sampling:** the more (and harder) negatives in a batch, the more the model is forced to learn fine-grained distinctions rather than trivial shortcuts. This is why contrastive methods like SimCLR benefit heavily from large batch sizes (more in-batch negatives) or a memory bank/queue of negatives (as in MoCo) when large batches aren't feasible.

---

## 3. Multimodal Architectures

### Joint embedding space (CLIP-style)

CLIP trains an image encoder and a text encoder **jointly**, using a contrastive objective so that matching image-caption pairs land close together in a shared embedding space, and non-matching pairs land far apart.

```python
def clip_loss(image_embeds, text_embeds, temperature=0.07):
    image_embeds = F.normalize(image_embeds, dim=1)
    text_embeds = F.normalize(text_embeds, dim=1)

    logits = torch.matmul(image_embeds, text_embeds.T) / temperature  # [batch, batch]
    labels = torch.arange(logits.size(0))  # the diagonal is the correct image-text match

    loss_i2t = F.cross_entropy(logits, labels)       # for each image, find the right caption
    loss_t2i = F.cross_entropy(logits.T, labels)     # for each caption, find the right image
    return (loss_i2t + loss_t2i) / 2

image_embeds = torch.randn(16, 512)  # from an image encoder (e.g., a ViT)
text_embeds = torch.randn(16, 512)   # from a text encoder (e.g., a transformer), same dim as images
loss = clip_loss(image_embeds, text_embeds)
print(f"CLIP-style contrastive loss: {loss.item():.4f}")
```

### Cross-attention fusion (Flamingo-style)

Instead of a shared embedding space, some multimodal models keep separate encoders and fuse modalities via cross-attention layers inserted into a language model — image features act as keys/values that text tokens (queries) attend to, letting a frozen or lightly-tuned LLM "see" images without retraining the whole model from scratch.

| Approach | Strength | Weakness |
|---|---|---|
| Joint embedding (CLIP) | Fast similarity search, great for retrieval/zero-shot classification | Doesn't generate text — no language modeling capability |
| Cross-attention fusion (Flamingo) | Can generate fluent text grounded in images, reuses a pretrained LLM | More complex architecture, heavier compute per forward pass |

---

## 4. Fine-Tuning a Self-Supervised Backbone vs. Training Supervised From Scratch

```python
from transformers import CLIPModel, CLIPProcessor

clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

# Zero-shot classification — no fine-tuning at all, just compare embeddings
# candidate_labels = ["a photo of a cat", "a photo of a dog", "a photo of a car"]
# inputs = processor(text=candidate_labels, images=my_image, return_tensors="pt", padding=True)
# outputs = clip_model(**inputs)
# probs = outputs.logits_per_image.softmax(dim=1)

# Fine-tuning: unfreeze the vision encoder (or just a new head) and train on labeled task data
for param in clip_model.text_model.parameters():
    param.requires_grad = False  # freeze what you don't need to adapt
```

Starting from a self-supervised backbone consistently beats training from scratch when labeled data is limited — the backbone has already learned general-purpose features from a much larger unlabeled corpus, and fine-tuning only has to adapt those features to the specific task rather than learn everything from zero.

---

## 5. Evaluating Representation Quality

```python
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score

# Linear probing: freeze the pretrained encoder, train ONLY a linear classifier on top
# A high linear-probe accuracy means the representations are already well-organized —
# a strong encoder should make even a simple linear boundary work well.
frozen_embeddings = torch.randn(500, 512)  # stand-in for real encoder output on a labeled eval set
labels = torch.randint(0, 10, (500,))

probe_scores = cross_val_score(
    LogisticRegression(max_iter=1000), frozen_embeddings.numpy(), labels.numpy(), cv=5
)
print(f"Linear probe accuracy: {probe_scores.mean():.3f} ± {probe_scores.std():.3f}")
```

**Downstream transfer performance** — how well the representations perform after fine-tuning on a *different* task than they were pretrained for — is the more realistic and widely reported evaluation, since it reflects the actual use case (adapt a general-purpose backbone to your specific problem).

---

## 6. Practical Use

- **Zero-shot image classification**: compare an image embedding against text embeddings of candidate class descriptions ("a photo of a {label}") — no task-specific training data needed at all, as shown in the CLIP zero-shot example above.
- **Embedding-based multimodal search**: embed a large corpus of images (or products, documents) once, then retrieve by embedding a text query and finding nearest neighbors — the same vector-search infrastructure as RAG (see the RAG & Vector Search sheet), just with image embeddings instead of text-chunk embeddings.

## Common Pitfalls

- **Using too small a batch size for contrastive learning** — fewer in-batch negatives makes the task too easy and the learned representations weaker.
- **Comparing raw (unnormalized) embeddings with cosine similarity** — always L2-normalize embeddings before computing similarity, or the magnitude of the vector (not just its direction) will distort comparisons.
- **Expecting a joint-embedding model like CLIP to generate text** — it's built for similarity/retrieval, not generation; for grounded text generation you need a cross-attention fusion architecture or a vision-language model built for that purpose.
- **Zero-shot evaluation on classes far outside the pretraining distribution** — CLIP's zero-shot performance depends heavily on whether similar concepts appeared in its training captions; niche/specialized domains often need fine-tuning.
- **Skipping linear-probe evaluation** and jumping straight to full fine-tuning — a quick linear probe is a cheap, fast signal for whether a backbone's representations are worth building on before investing in expensive full fine-tuning.

---

## 7. End-to-End Worked Example: A Minimal SimCLR-Style Contrastive Pretraining Loop

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.transforms as T

torch.manual_seed(42)

# Two DIFFERENT random augmentations of the same underlying image form a positive pair
augmentation = T.Compose([
    T.RandomResizedCrop(32, scale=(0.5, 1.0)),
    T.RandomHorizontalFlip(),
    T.ColorJitter(0.4, 0.4, 0.4, 0.1),
])

class SimpleEncoder(nn.Module):
    """Stand-in for a real CNN backbone (e.g., a small ResNet)."""
    def __init__(self, out_dim=128):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.AdaptiveAvgPool2d(1),
        )
        self.projection_head = nn.Sequential(  # SimCLR-specific: a small MLP applied ONLY during pretraining
            nn.Linear(64, 128), nn.ReLU(), nn.Linear(128, out_dim)
        )

    def forward(self, x):
        features = self.conv(x).flatten(1)
        projected = self.projection_head(features)
        return features, projected

def simclr_loss(z1, z2, temperature=0.5):
    batch_size = z1.size(0)
    z1, z2 = F.normalize(z1, dim=1), F.normalize(z2, dim=1)
    representations = torch.cat([z1, z2], dim=0)
    similarity = torch.matmul(representations, representations.T) / temperature
    mask = torch.eye(2 * batch_size, dtype=torch.bool)
    similarity.masked_fill_(mask, float("-inf"))
    positive_indices = torch.cat([torch.arange(batch_size, 2 * batch_size), torch.arange(0, batch_size)])
    return F.cross_entropy(similarity, positive_indices)

model = SimpleEncoder()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

# Stand-in unlabeled image batch (in practice, loaded from a real unlabeled dataset)
raw_images = torch.rand(32, 3, 32, 32)

for epoch in range(20):
    # Create two augmented views of the SAME batch
    view1 = torch.stack([augmentation(img) for img in raw_images])
    view2 = torch.stack([augmentation(img) for img in raw_images])

    _, z1 = model(view1)
    _, z2 = model(view2)

    loss = simclr_loss(z1, z2)
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()

    if epoch % 5 == 0:
        print(f"Epoch {epoch}: contrastive loss = {loss.item():.4f}")

# After pretraining: DISCARD the projection head, keep only the backbone's raw features
# for downstream fine-tuning or linear probing — this is standard SimCLR practice
frozen_backbone = model.conv
print("Pretraining complete. Backbone features ready for downstream linear probing or fine-tuning.")
```

**Why discard the projection head:** the projection head is trained specifically to make the contrastive loss's geometry work well, which empirically makes the *pre-projection* features more linearly separable and more broadly useful for downstream tasks than the post-projection embeddings — a somewhat counterintuitive but well-replicated finding from the original SimCLR paper.

---

## 8. Advanced & Lesser-Known Techniques

- **Momentum encoders (MoCo)**: instead of relying on a large batch for enough negatives, maintain a slowly-updated ("momentum") copy of the encoder and a queue of past embeddings as negatives — decouples negative-sample count from GPU memory/batch size constraints.
- **BYOL (Bootstrap Your Own Latent)**: achieves strong self-supervised representations *without any negative samples at all*, using an asymmetric architecture (an online network and a slowly-updated target network) — challenges the assumption that contrastive learning strictly needs negatives to avoid representational collapse.
- **DINO**: a self-distillation approach for vision transformers that produces embeddings with strong emergent properties (e.g., attention maps that naturally segment objects) without any labels or explicit segmentation supervision.
- **Multimodal contrastive extensions beyond CLIP**: ALIGN, video-text models (e.g., aligning video clips with narration), and audio-text models all apply the same core contrastive recipe (matching pairs pulled together, mismatched pairs pushed apart) across different modality combinations.

---

## 9. Practice Exercises

1. Vary the temperature parameter in the SimCLR loss (try 0.1, 0.5, 1.0) and observe how it changes the sharpness of the similarity distribution and training dynamics.
2. Train the contrastive model with a much smaller batch size (8) vs. a larger one (128, if hardware allows) and compare downstream linear-probe accuracy — connect this to the "why batch size matters for negatives" discussion in the sheet.
3. Implement linear probing: freeze the pretrained backbone, train a logistic regression on top of its features for a small labeled subset, and compare against training a classifier from randomly-initialized (non-pretrained) features on the same labeled subset.
4. Remove the projection head entirely and compute the contrastive loss directly on the backbone's raw features — compare downstream linear-probe performance against the version that uses (and later discards) a projection head.
5. Implement a simple CLIP-style joint embedding using two small encoders (one for short synthetic "captions" as token sequences, one for corresponding synthetic image tensors) and verify that matching pairs get higher cosine similarity than mismatched pairs after training.

---

## 10. More Examples

### Example: Using CLIP for zero-shot image classification, end to end

```python
from transformers import CLIPModel, CLIPProcessor
from PIL import Image
import torch

model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

# candidate_labels can be ANY text — no training data needed for these specific classes
candidate_labels = ["a photo of a golden retriever", "a photo of a siamese cat", "a photo of a parrot"]
image = Image.new("RGB", (224, 224), color="white")  # stand-in for a real image

inputs = processor(text=candidate_labels, images=image, return_tensors="pt", padding=True)
with torch.no_grad():
    outputs = model(**inputs)
probs = outputs.logits_per_image.softmax(dim=1)
for label, prob in zip(candidate_labels, probs[0]):
    print(f"{label}: {prob.item():.3f}")
```

### Example: Masked autoencoder-style pretraining for tabular data

```python
import torch
import torch.nn as nn

class TabularMAE(nn.Module):
    """Self-supervised pretraining adapted to TABULAR data: mask random feature values,
    train the model to reconstruct them — the same core idea as image/text masking."""
    def __init__(self, n_features, hidden_dim=64):
        super().__init__()
        self.encoder = nn.Sequential(nn.Linear(n_features, hidden_dim), nn.ReLU())
        self.decoder = nn.Linear(hidden_dim, n_features)

    def forward(self, x, mask):
        x_masked = x * (~mask)  # zero out masked features (the model must learn to fill these in)
        encoded = self.encoder(x_masked)
        return self.decoder(encoded)

model = TabularMAE(n_features=20)
x = torch.randn(32, 20)
mask = torch.rand(32, 20) < 0.3  # mask 30% of feature values per row
reconstructed = model(x, mask)
loss = nn.functional.mse_loss(reconstructed[mask], x[mask])  # loss ONLY on the masked positions
print(f"Reconstruction loss on masked values: {loss.item():.4f}")
```

### Example: Nearest-neighbor retrieval using self-supervised embeddings

```python
import torch
import torch.nn.functional as F

# Assume `frozen_backbone` produces embeddings for a catalog and a query (from earlier in this sheet)
catalog_embeddings = F.normalize(torch.randn(100, 128), dim=1)  # 100 pretrained catalog embeddings
query_embedding = F.normalize(torch.randn(1, 128), dim=1)

similarities = (catalog_embeddings @ query_embedding.T).squeeze()
top_5 = torch.topk(similarities, k=5)
print(f"Top 5 most similar catalog indices: {top_5.indices.tolist()}")
print(f"Similarity scores: {top_5.values.tolist()}")
```

---

## 11. Quick-Reference Cheat-Table

| Need | Approach |
|---|---|
| Text representation learning | Masked language modeling |
| Image representation learning | Masked image modeling or contrastive (SimCLR) |
| No negative samples needed | BYOL / DINO |
| Image-text joint embedding | CLIP-style contrastive |
| Grounded text generation from images | Cross-attention fusion (Flamingo-style) |
| Quick check of backbone quality | Linear probing |

## 12. FAQ

**Q: Why does contrastive learning need large batch sizes?**
A: More in-batch negatives make the discrimination task harder and more informative — small batches provide too few negatives for the model to learn fine-grained distinctions.

**Q: Should I keep CLIP's projection head after pretraining?**
A: No — standard practice discards it. The pre-projection backbone features are typically more useful for downstream tasks than the post-projection embeddings.

**Q: Can CLIP generate images or text?**
A: No — it's built for similarity/retrieval via a joint embedding space, not generation. For grounded generation, use a cross-attention fusion architecture instead.

**Q: How do I know if a pretrained backbone is worth fine-tuning?**
A: Run a quick linear probe first (freeze the backbone, train just a linear classifier) — a strong linear-probe result is a good, cheap signal before investing in full fine-tuning.

**Q: Why did my self-supervised pretraining not help my downstream task?**
A: The pretraining domain may be too different from your downstream domain — check whether domain-adaptive continued pretraining on in-domain unlabeled data closes the gap.
