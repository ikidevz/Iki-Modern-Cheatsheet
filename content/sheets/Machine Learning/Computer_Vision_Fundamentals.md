# Computer Vision Fundamentals Cheatsheet

## Overview

This sheet covers the pipeline from raw images to a trained classifier: preprocessing and augmentation, why CNNs are built the way they are, and transfer learning — which, for the overwhelming majority of real-world CV tasks, is what you should reach for instead of training from scratch.

```bash
pip install torch torchvision --break-system-packages
```

---

## 1. Image Preprocessing and Augmentation

```python
import torch
import torchvision.transforms as T
from torchvision import models
from PIL import Image

# Standard preprocessing to match what pretrained models expect
preprocess = T.Compose([
    T.Resize(256),
    T.CenterCrop(224),                          # ImageNet-pretrained models expect 224x224
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406],     # ImageNet channel-wise mean/std — must match training data
                std=[0.229, 0.224, 0.225]),
])

# Augmentation — applied ONLY during training, never at validation/test time
train_augmentation = T.Compose([
    T.RandomResizedCrop(224),
    T.RandomHorizontalFlip(p=0.5),
    T.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
    T.RandomRotation(degrees=15),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

val_transform = T.Compose([
    T.Resize(256),
    T.CenterCrop(224),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])
```

**Why normalization matters:** pretrained backbones were trained with inputs scaled to a specific mean/std. Feeding them raw `[0, 255]` pixel values (or a different normalization) shifts every activation downstream and can silently tank transfer-learning performance without throwing an error.

**Augmentation choices should reflect real-world variation** — random horizontal flips make sense for natural photos, but would corrupt a task like reading text or classifying handedness in an image. Match your augmentation policy to what actually varies at inference time.

---

## 2. CNN Fundamentals

### Why convolutions fit image data
- **Local receptive fields**: each filter looks at a small spatial neighborhood, matching the intuition that nearby pixels are more related than distant ones.
- **Weight sharing**: the same filter slides across the whole image, so a feature detector (e.g., "vertical edge") learned in one location is reused everywhere — this is what makes CNNs dramatically more parameter-efficient than a fully-connected network on images.
- **Pooling** (max or average) progressively reduces spatial resolution, building translation invariance (an object is still detected if it shifts slightly) and reducing computation for deeper layers.
- **Receptive field growth**: stacking convolutional layers increases the effective receptive field — deeper layers "see" a larger region of the original image, enabling them to recognize larger, more abstract patterns (edges → textures → parts → objects).

```python
import torch.nn as nn

class SimpleCNN(nn.Module):
    def __init__(self, num_classes=10):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=3, padding=1),   # 3 input channels (RGB) -> 32 filters
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2),                                # halves spatial dimensions

            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(2),
        )
        self.classifier = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),   # global average pool — works for any input size
            nn.Flatten(),
            nn.Linear(64, num_classes),
        )

    def forward(self, x):
        x = self.features(x)
        return self.classifier(x)

model = SimpleCNN(num_classes=10)
dummy_input = torch.randn(4, 3, 224, 224)  # batch of 4 RGB images
output = model(dummy_input)
print(f"Output shape: {output.shape}")  # [4, 10] — 10 class logits per image
```

---

## 3. Transfer Learning

Training a CNN from scratch needs enormous labeled datasets (ImageNet-scale) to learn good low-level features (edges, textures) from nothing. Transfer learning reuses a backbone already trained on a huge dataset and adapts it to your (usually much smaller) task.

```python
from torchvision.models import resnet50, ResNet50_Weights

# Load a backbone pretrained on ImageNet
backbone = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2)

# Option A: Feature extraction — freeze the backbone, train only a new classifier head
for param in backbone.parameters():
    param.requires_grad = False

num_classes = 5  # your task's number of classes
backbone.fc = nn.Linear(backbone.fc.in_features, num_classes)  # replace the final layer
# Only backbone.fc.parameters() have requires_grad=True now

optimizer = torch.optim.AdamW(backbone.fc.parameters(), lr=1e-3)  # only train the new head

# Option B: Fine-tuning — unfreeze some/all layers and train with a small learning rate
for param in backbone.layer4.parameters():  # unfreeze just the last residual block
    param.requires_grad = True

optimizer_finetune = torch.optim.AdamW([
    {"params": backbone.fc.parameters(), "lr": 1e-3},        # new head: larger LR, learning from scratch
    {"params": backbone.layer4.parameters(), "lr": 1e-5},    # pretrained layers: tiny LR, gentle adaptation
])
```

| | Feature extraction (frozen backbone) | Full fine-tuning |
|---|---|---|
| Data needed | Small (hundreds of images can work) | Larger (thousands+) |
| Training speed | Fast — far fewer trainable parameters | Slower |
| Risk | Underfitting if task is very different from ImageNet | Overfitting / catastrophic forgetting if data is small |
| When to use | Small dataset, task similar to ImageNet | Larger dataset, or task domain differs significantly (medical, satellite imagery) |

**ResNet vs. EfficientNet vs. ViT:** ResNet is the reliable, well-understood default. EfficientNet gets better accuracy-per-parameter through systematic width/depth/resolution scaling. Vision Transformers (ViT) apply the transformer architecture to image patches and can outperform CNNs given enough pretraining data, but tend to need more data or aggressive augmentation to match CNN performance on smaller datasets, since they lack the CNN's built-in translation-invariance bias.

---

## 4. Object Detection and Segmentation Overview

| Task | Output | Example models |
|---|---|---|
| Classification | One label per image | ResNet, EfficientNet |
| Object detection | Bounding boxes + labels for each object | YOLO, Faster R-CNN |
| Semantic segmentation | Per-pixel class label | U-Net, DeepLab |
| Instance segmentation | Per-pixel label AND separates individual object instances | Mask R-CNN |

The key difference from plain classification: these tasks must localize *where* something is, not just *what* is present — which means the loss function and output structure both change (bounding box regression + classification loss for detection; per-pixel cross-entropy for segmentation).

```python
# Illustrative use of a pretrained detection model
from torchvision.models.detection import fasterrcnn_resnet50_fpn, FasterRCNN_ResNet50_FPN_Weights

detector = fasterrcnn_resnet50_fpn(weights=FasterRCNN_ResNet50_FPN_Weights.DEFAULT)
detector.eval()

image_tensor = torch.randn(1, 3, 224, 224)  # replace with a real preprocessed image
with torch.no_grad():
    predictions = detector(image_tensor)
print(predictions[0].keys())  # dict_keys(['boxes', 'labels', 'scores'])
```

---

## 5. Common Failure Modes

- **Dataset bias**: a classifier trained mostly on photos taken in good lighting will fail on low-light images at inference time — always match the training distribution to the deployment distribution, or augment to cover the gap.
- **Class imbalance in image data**: rare classes need oversampling, class-weighted loss, or targeted data collection — the same fixes as tabular imbalanced learning, see the Anomaly Detection & Imbalanced Learning sheet.
- **Augmentation that changes the label**: e.g., randomly flipping an image horizontally when the task is to detect text orientation, or rotating an image of a handwritten "6" into a "9" — always sanity-check that your augmentation policy preserves label validity for your specific task.

---

## 6. Practical Tooling

```python
# torchvision.datasets and DataLoader for a full training pipeline
from torchvision.datasets import ImageFolder
from torch.utils.data import DataLoader

train_dataset = ImageFolder(root="data/train", transform=train_augmentation)
val_dataset = ImageFolder(root="data/val", transform=val_transform)

train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True, num_workers=4)
val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False, num_workers=4)

print(f"Classes found: {train_dataset.classes}")
```

**When to reach for a pretrained model vs. training your own:** almost always start with transfer learning unless (a) your images are extremely unlike natural photos (e.g., raw sensor data, spectrograms) where ImageNet features transfer poorly, or (b) you have a genuinely massive labeled dataset and compute budget and are chasing the last few points of accuracy for a specialized domain.

## Common Pitfalls

- **Mismatched normalization** between training and inference preprocessing — a common, hard-to-spot bug that silently degrades accuracy.
- **Applying test-time augmentation transforms** (random crops, flips) to validation/test data — validation should use a fixed, deterministic transform.
- **Freezing the entire backbone when the task domain is very different from ImageNet** (e.g., medical X-rays) — feature extraction alone may underfit; some fine-tuning is usually needed.
- **Using too high a learning rate when fine-tuning pretrained layers** — this can rapidly destroy the useful pretrained weights ("catastrophic forgetting"); use a much smaller LR for pretrained layers than for the new head.
- **Ignoring class imbalance in the training set** — a detector/classifier trained on imbalanced data will systematically underperform on rare classes without correction.

---

## 7. End-to-End Worked Example: Transfer Learning Pipeline From Frozen to Fine-Tuned

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.models import resnet18, ResNet18_Weights
from torch.utils.data import DataLoader, TensorDataset

# Simulate a small labeled image dataset (5 classes, 224x224 RGB) — stand-in for a real ImageFolder dataset
n_samples, n_classes = 200, 5
X = torch.randn(n_samples, 3, 224, 224)
y = torch.randint(0, n_classes, (n_samples,))
train_loader = DataLoader(TensorDataset(X[:160], y[:160]), batch_size=16, shuffle=True)
val_loader = DataLoader(TensorDataset(X[160:], y[160:]), batch_size=16)

backbone = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1)
backbone.fc = nn.Linear(backbone.fc.in_features, n_classes)

def evaluate(model, loader):
    model.eval()
    correct, total = 0, 0
    with torch.no_grad():
        for xb, yb in loader:
            preds = model(xb).argmax(dim=1)
            correct += (preds == yb).sum().item()
            total += yb.size(0)
    return correct / total

# --- Phase 1: freeze the backbone, train only the new classification head ---
for param in backbone.parameters():
    param.requires_grad = False
for param in backbone.fc.parameters():
    param.requires_grad = True

optimizer = torch.optim.AdamW(backbone.fc.parameters(), lr=1e-3)
for epoch in range(5):
    backbone.train()
    for xb, yb in train_loader:
        optimizer.zero_grad()
        loss = F.cross_entropy(backbone(xb), yb)
        loss.backward()
        optimizer.step()
print(f"After frozen-backbone phase: val acc = {evaluate(backbone, val_loader):.3f}")

# --- Phase 2: unfreeze the last block, fine-tune with a much smaller LR for pretrained layers ---
for param in backbone.layer4.parameters():
    param.requires_grad = True

optimizer = torch.optim.AdamW([
    {"params": backbone.fc.parameters(), "lr": 1e-3},
    {"params": backbone.layer4.parameters(), "lr": 1e-5},  # gentle nudge, not a rewrite
])
for epoch in range(5):
    backbone.train()
    for xb, yb in train_loader:
        optimizer.zero_grad()
        loss = F.cross_entropy(backbone(xb), yb)
        loss.backward()
        optimizer.step()
print(f"After fine-tuning phase: val acc = {evaluate(backbone, val_loader):.3f}")
```

This two-phase pattern — feature extraction first, then a careful, low-LR fine-tune of just the later layers — is the standard practical recipe: it avoids catastrophically destroying pretrained weights with a large gradient update while a randomly-initialized head is still producing large, noisy losses in the first few epochs.

---

## 8. Advanced & Lesser-Known Techniques

- **Mixup and CutMix augmentation**: blend two training images (and their labels proportionally) to create synthetic training examples — surprisingly effective at improving generalization and calibration, especially on smaller datasets.
- **Test-time augmentation (TTA)**: apply several augmented versions of a test image (different crops/flips) at inference time and average the predictions — trades inference-time compute for a reliable, if modest, accuracy boost, without any retraining.
- **Progressive resizing**: start training at a smaller image resolution (e.g., 128x128) for speed, then increase to full resolution (224x224+) for the final epochs — often converges faster overall than training at full resolution throughout.
- **Grad-CAM**: a visualization technique that highlights which regions of an input image most influenced a CNN's prediction — useful both for debugging (is the model looking at the actual object, or a spurious background cue?) and as an interpretability tool alongside the SHAP/LIME techniques from the Model Interpretability sheet.
- **Self-training / pseudo-labeling**: for a small labeled set with a much larger unlabeled pool, use a trained model to generate confident pseudo-labels on the unlabeled data, then retrain including those pseudo-labeled examples — a lightweight bridge toward the self-supervised techniques in the Self-Supervised & Multimodal Learning sheet.

---

## 9. Practice Exercises

1. Implement the two-phase transfer learning pipeline above on a real small image dataset (e.g., a Kaggle cats-vs-dogs subset) and report validation accuracy at each phase.
2. Add Mixup augmentation to the training loop and measure its effect on validation accuracy and on calibration (Brier score, adapting from the Model Evaluation sheet).
3. Implement basic test-time augmentation (horizontal flip + original, averaged) and quantify the accuracy change versus single-pass inference.
4. Freeze different numbers of layers (just `fc`, `fc + layer4`, `fc + layer4 + layer3`) and plot validation accuracy against training time for each configuration — find the best accuracy/cost tradeoff for your dataset size.
5. Implement Grad-CAM for one of your trained models and visually inspect whether misclassified examples show the model attending to irrelevant regions of the image.

---

## 10. More Examples

### Example: Building a custom Dataset class for images with metadata

```python
from torch.utils.data import Dataset
from PIL import Image
import pandas as pd

class ImageMetadataDataset(Dataset):
    """A custom Dataset combining image files with tabular metadata — common in
    real applications (e.g., product images + price/category for e-commerce classification)."""
    def __init__(self, csv_path, image_dir, transform=None):
        self.metadata = pd.read_csv(csv_path)  # expects columns: filename, label
        self.image_dir = image_dir
        self.transform = transform

    def __len__(self):
        return len(self.metadata)

    def __getitem__(self, idx):
        row = self.metadata.iloc[idx]
        image = Image.open(f"{self.image_dir}/{row['filename']}").convert("RGB")
        if self.transform:
            image = self.transform(image)
        return image, row["label"]
```

### Example: Detecting and handling class imbalance in an image dataset

```python
from torch.utils.data import WeightedRandomSampler
import numpy as np

# Suppose 900 images are "normal" and 100 are "defective" — a 9:1 imbalance
labels = np.array([0] * 900 + [1] * 100)
class_counts = np.bincount(labels)
class_weights = 1.0 / class_counts
sample_weights = class_weights[labels]  # each SAMPLE gets its class's weight

sampler = WeightedRandomSampler(sample_weights, num_samples=len(labels), replacement=True)
# Using this sampler in a DataLoader means minority-class images are seen roughly as
# often as majority-class images across an epoch, without discarding any majority data
```

### Example: Simple image similarity search using embeddings

```python
import torch
from torchvision.models import resnet18, ResNet18_Weights
import torch.nn as nn

backbone = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1)
embedding_model = nn.Sequential(*list(backbone.children())[:-1])  # drop the final classification layer
embedding_model.eval()

def get_embedding(image_tensor):
    with torch.no_grad():
        return embedding_model(image_tensor.unsqueeze(0)).flatten()

catalog_images = torch.randn(20, 3, 224, 224)  # stand-in for a real product catalog
catalog_embeddings = torch.stack([get_embedding(img) for img in catalog_images])

query_image = torch.randn(3, 224, 224)
query_embedding = get_embedding(query_image)

similarities = torch.cosine_similarity(query_embedding.unsqueeze(0), catalog_embeddings)
most_similar_idx = similarities.argmax().item()
print(f"Most visually similar catalog item: index {most_similar_idx} (similarity: {similarities[most_similar_idx]:.3f})")
```

---

## 11. Quick-Reference Cheat-Table

| Scenario | Recommendation |
|---|---|
| Small dataset, task similar to ImageNet | Frozen backbone, train only new head |
| Larger dataset or different domain | Fine-tune later layers with a small LR |
| Need object locations, not just labels | Object detection (YOLO, Faster R-CNN) |
| Need per-pixel classification | Semantic/instance segmentation (U-Net, Mask R-CNN) |
| Very different domain (medical, satellite) | More aggressive fine-tuning, possibly train from scratch |
| Limited compute at inference | Smaller backbone (EfficientNet family) or distillation |

## 12. FAQ

**Q: Should I always use data augmentation?**
A: Yes for training data — but validate that your augmentation policy doesn't invalidate the label (e.g., don't flip images where left/right orientation matters).

**Q: Why did fine-tuning suddenly destroy my model's performance?**
A: Learning rate too high for pretrained layers — this causes catastrophic forgetting. Use a much smaller LR (10-100x lower) for pretrained layers than for a new head.

**Q: ResNet, EfficientNet, or ViT — which backbone should I pick?**
A: ResNet as a reliable, well-understood default. EfficientNet for better accuracy-per-parameter. ViT if you have ample pretraining/fine-tuning data — it needs more data to match CNN performance on smaller datasets.

**Q: My model performs great in testing but poorly in production — why?**
A: Check for a preprocessing/normalization mismatch, or a dataset bias (training images don't match real-world deployment conditions like lighting/angle).

**Q: Is GPU necessary for computer vision work?**
A: For training, essentially yes for anything beyond tiny models/datasets. For inference with small models, CPU can be entirely sufficient.
