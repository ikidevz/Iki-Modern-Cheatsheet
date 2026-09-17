# Generative Models for Vision Cheatsheet

## Overview

Three families dominate image generation, and they arrived in roughly this order of practical adoption: GANs (adversarial, fast to sample, notoriously unstable to train), VAEs (probabilistic, stable, blurrier outputs), and diffusion models (currently dominant — high quality, but slow to sample without extra tricks). This sheet covers how each works, how to condition generation, and how to evaluate what comes out.

```bash
pip install torch torchvision diffusers --break-system-packages
```

---

## 1. GANs: Generator/Discriminator, Mode Collapse, Stabilization

A GAN pits two networks against each other: a **generator** that tries to produce realistic fake images from random noise, and a **discriminator** that tries to distinguish real images from the generator's fakes. Training alternates between improving each.

```python
import torch
import torch.nn as nn

class Generator(nn.Module):
    def __init__(self, latent_dim=100, img_channels=3, feature_dim=64):
        super().__init__()
        self.net = nn.Sequential(
            nn.ConvTranspose2d(latent_dim, feature_dim * 4, 4, 1, 0), nn.BatchNorm2d(feature_dim * 4), nn.ReLU(True),
            nn.ConvTranspose2d(feature_dim * 4, feature_dim * 2, 4, 2, 1), nn.BatchNorm2d(feature_dim * 2), nn.ReLU(True),
            nn.ConvTranspose2d(feature_dim * 2, feature_dim, 4, 2, 1), nn.BatchNorm2d(feature_dim), nn.ReLU(True),
            nn.ConvTranspose2d(feature_dim, img_channels, 4, 2, 1), nn.Tanh(),  # Tanh -> output in [-1, 1]
        )
    def forward(self, z):
        return self.net(z.view(z.size(0), -1, 1, 1))

class Discriminator(nn.Module):
    def __init__(self, img_channels=3, feature_dim=64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(img_channels, feature_dim, 4, 2, 1), nn.LeakyReLU(0.2, True),
            nn.Conv2d(feature_dim, feature_dim * 2, 4, 2, 1), nn.BatchNorm2d(feature_dim * 2), nn.LeakyReLU(0.2, True),
            nn.Conv2d(feature_dim * 2, 1, 4, 1, 0), nn.Sigmoid(),  # real/fake probability
        )
    def forward(self, x):
        return self.net(x).view(-1)

# Adversarial training loop (simplified)
G, D = Generator(), Discriminator()
opt_G = torch.optim.Adam(G.parameters(), lr=2e-4, betas=(0.5, 0.999))
opt_D = torch.optim.Adam(D.parameters(), lr=2e-4, betas=(0.5, 0.999))
criterion = nn.BCELoss()

real_images = torch.randn(8, 3, 32, 32)  # stand-in for a real image batch
batch_size = real_images.size(0)

# --- Train Discriminator: maximize log(D(real)) + log(1 - D(G(z))) ---
opt_D.zero_grad()
real_labels, fake_labels = torch.ones(batch_size), torch.zeros(batch_size)
d_loss_real = criterion(D(real_images), real_labels)
z = torch.randn(batch_size, 100)
fake_images = G(z)
d_loss_fake = criterion(D(fake_images.detach()), fake_labels)  # detach — don't backprop into G here
d_loss = d_loss_real + d_loss_fake
d_loss.backward()
opt_D.step()

# --- Train Generator: maximize log(D(G(z))) (fool the discriminator) ---
opt_G.zero_grad()
g_loss = criterion(D(fake_images), real_labels)  # generator "wants" D to say these are real
g_loss.backward()
opt_G.step()

print(f"D loss: {d_loss.item():.4f}, G loss: {g_loss.item():.4f}")
```

### Mode collapse and stabilization tricks
**Mode collapse**: the generator finds a small set of outputs that reliably fool the discriminator and stops producing diverse samples — technically "winning" locally while failing the actual goal.

| Trick | What it does |
|---|---|
| Label smoothing | Use 0.9 instead of 1.0 for "real" labels — prevents the discriminator from becoming overconfident |
| Feature matching | Generator loss matches discriminator's intermediate features instead of just the final score |
| Wasserstein loss (WGAN) | Replaces the discriminator with a "critic" scoring realism on a continuous scale, with gradient penalty — much more stable gradients |
| Spectral normalization | Constrains the discriminator's Lipschitz constant, preventing it from overpowering the generator |
| Minibatch discrimination | Lets the discriminator compare samples within a batch, directly penalizing low diversity |

---

## 2. Variational Autoencoders (VAEs)

A VAE learns to encode inputs into a *distribution* over a latent space (not a single point), then decode a sample from that distribution back into an image — the probabilistic framing is what enables sampling new, plausible images from the latent space.

```python
class VAE(nn.Module):
    def __init__(self, input_dim=784, hidden_dim=400, latent_dim=20):
        super().__init__()
        self.fc1 = nn.Linear(input_dim, hidden_dim)
        self.fc_mu = nn.Linear(hidden_dim, latent_dim)      # mean of the latent distribution
        self.fc_logvar = nn.Linear(hidden_dim, latent_dim)  # log-variance of the latent distribution
        self.fc2 = nn.Linear(latent_dim, hidden_dim)
        self.fc3 = nn.Linear(hidden_dim, input_dim)

    def encode(self, x):
        h = torch.relu(self.fc1(x))
        return self.fc_mu(h), self.fc_logvar(h)

    def reparameterize(self, mu, logvar):
        # The reparameterization trick: sample noise separately so gradients can flow through mu/logvar
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mu + eps * std

    def decode(self, z):
        h = torch.relu(self.fc2(z))
        return torch.sigmoid(self.fc3(h))

    def forward(self, x):
        mu, logvar = self.encode(x)
        z = self.reparameterize(mu, logvar)
        return self.decode(z), mu, logvar

def vae_loss(recon_x, x, mu, logvar):
    recon_loss = nn.functional.binary_cross_entropy(recon_x, x, reduction="sum")
    # KL divergence between the learned latent distribution and a standard normal prior
    kl_div = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp())
    return recon_loss + kl_div  # the reconstruction/KL tradeoff, in one loss

vae = VAE()
x = torch.rand(16, 784)  # flattened 28x28 images, e.g. MNIST
recon, mu, logvar = vae(x)
loss = vae_loss(recon, x, mu, logvar)
print(f"VAE loss: {loss.item():.2f}")
```

**The reconstruction/KL tradeoff:** reconstruction loss alone would let the model memorize training images with sharp, distinct latent codes (great reconstruction, useless for generating *new* images). The KL term pulls the latent distribution toward a standard normal prior, ensuring the latent space is smooth and sample-able — but pushing the KL term too hard causes "posterior collapse" (the model ignores the latent code, reconstructions become blurry averages). This tension is why VAE outputs are characteristically blurrier than GAN or diffusion outputs.

---

## 3. Diffusion Models

Diffusion models learn to reverse a gradual noising process: start with a real image, add Gaussian noise over many steps until it's pure noise, then train a network to predict (and remove) the noise at each step. Generation runs this in reverse — start from pure noise, iteratively denoise.

```python
import torch

def forward_diffusion(x0, t, betas):
    """Adds noise to a clean image x0 according to a fixed noise schedule, for training."""
    alphas = 1.0 - betas
    alphas_cumprod = torch.cumprod(alphas, dim=0)
    sqrt_alphas_cumprod_t = alphas_cumprod[t].sqrt()
    sqrt_one_minus_alphas_cumprod_t = (1 - alphas_cumprod[t]).sqrt()

    noise = torch.randn_like(x0)
    # x_t is a weighted mix of the clean image and pure noise, weighted by the schedule at step t
    x_t = sqrt_alphas_cumprod_t * x0 + sqrt_one_minus_alphas_cumprod_t * noise
    return x_t, noise  # noise is the training TARGET — the model learns to predict this

# A simplified training step: the model (usually a U-Net) predicts the noise that was added
def diffusion_training_step(model, x0, betas, optimizer):
    t = torch.randint(0, len(betas), (x0.size(0),))
    x_t, true_noise = forward_diffusion(x0, t, betas)
    predicted_noise = model(x_t, t)
    loss = nn.functional.mse_loss(predicted_noise, true_noise)
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    return loss.item()

betas = torch.linspace(1e-4, 0.02, 1000)  # linear noise schedule over 1000 steps
```

**Why diffusion overtook GANs:**
- Training is far more stable — a straightforward regression objective (predict the noise), no adversarial min-max game to balance.
- Better mode coverage — diffusion models don't suffer from mode collapse the way GANs do, producing more diverse outputs.
- The tradeoff: sampling requires iterating through many denoising steps (though distillation techniques like DDIM and consistency models have cut this from ~1000 steps to as few as 1-4 in modern samplers).

### Using a pretrained diffusion pipeline

```python
# from diffusers import StableDiffusionPipeline
# pipe = StableDiffusionPipeline.from_pretrained("runwayml/stable-diffusion-v1-5")
# image = pipe("a watercolor painting of a mountain lake at sunrise").images[0]
# image.save("output.png")
```

---

## 4. Conditioning Generation

| Conditioning signal | Mechanism |
|---|---|
| Class label | Concatenate a class embedding to the noise/latent vector, or use conditional batch norm |
| Text prompt | Cross-attention layers where image features (Q) attend to text embeddings (K, V) from a language encoder (e.g., CLIP's text encoder) |
| Reference image | ControlNet-style side-networks that inject structural guidance (edges, pose, depth) into a pretrained diffusion model |

Text-to-image models like Stable Diffusion interleave cross-attention layers throughout the denoising U-Net, letting the text prompt influence generation at every resolution/stage rather than just at the input.

---

## 5. Evaluating Generated Images

| Metric | Measures | Limitation |
|---|---|---|
| Inception Score (IS) | Confidence + diversity of a pretrained classifier's predictions on generated images | Doesn't compare against real images at all — can be gamed |
| Fréchet Inception Distance (FID) | Distance between feature distributions of real vs. generated images | Sensitive to sample size, doesn't capture all quality dimensions (e.g., text-image alignment) |
| CLIPScore | Alignment between a text prompt and the generated image, via CLIP embeddings | Only useful for text-to-image, not unconditional generation |

```python
# FID computation is typically done via a library rather than from scratch
# from torchmetrics.image.fid import FrechetInceptionDistance
# fid = FrechetInceptionDistance(feature=2048)
# fid.update(real_images_uint8, real=True)
# fid.update(generated_images_uint8, real=False)
# print(f"FID: {fid.compute().item():.2f}")  # lower is better
```

**Limitation to keep in mind:** none of these metrics fully capture human aesthetic judgment or subtle artifacts (extra fingers, inconsistent lighting) — automated metrics are a useful proxy for tracking training progress, not a substitute for human evaluation before shipping.

---

## 6. Practical Tooling

- **Stable Diffusion / ComfyUI pipelines**: the `diffusers` library provides pretrained pipelines (text-to-image, image-to-image, inpainting) that can be run with a few lines of code, as shown above.
- **LoRA fine-tuning for image models**: the same low-rank adaptation idea from LLM fine-tuning applies here — freeze the base diffusion model and train small rank-decomposed adapter matrices to teach it a new style or subject with far less compute and data than full fine-tuning. See the Fine-tuning & PEFT sheet for the underlying LoRA mechanics.

## Common Pitfalls

- **Judging GAN training progress by loss values alone** — adversarial losses don't decrease monotonically the way a normal training loss does; visually inspecting generated samples is essential.
- **Setting the VAE's KL weight without tuning** — too high causes posterior collapse (blurry, generic outputs); too low causes an unstructured latent space that can't be sampled from meaningfully.
- **Assuming lower FID always means better images** — FID can be dominated by texture/color statistics and miss structural or semantic errors.
- **Using too few denoising steps at inference** without a distilled sampler — naive diffusion sampling with few steps produces noticeably degraded images unless you're using a technique specifically designed for few-step sampling (DDIM, consistency models).
- **Not detaching the generator's output when training the discriminator** — forgetting `.detach()` wastes compute backpropagating into the generator during the discriminator's update step and can destabilize training.

---

## 7. End-to-End Worked Example: Training a Small DCGAN on Toy Data With Stabilization Tricks

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

torch.manual_seed(42)

class SimpleGenerator(nn.Module):
    def __init__(self, latent_dim=64, img_dim=28*28):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(latent_dim, 256), nn.BatchNorm1d(256), nn.ReLU(True),
            nn.Linear(256, 512), nn.BatchNorm1d(512), nn.ReLU(True),
            nn.Linear(512, img_dim), nn.Tanh(),
        )
    def forward(self, z):
        return self.net(z)

class SimpleDiscriminator(nn.Module):
    def __init__(self, img_dim=28*28):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(img_dim, 512), nn.LeakyReLU(0.2), nn.Dropout(0.3),
            nn.Linear(512, 256), nn.LeakyReLU(0.2), nn.Dropout(0.3),
            nn.Linear(256, 1),  # no sigmoid here — we'll use BCEWithLogitsLoss for numerical stability
        )
    def forward(self, x):
        return self.net(x)

latent_dim = 64
G = SimpleGenerator(latent_dim)
D = SimpleDiscriminator()
opt_G = torch.optim.Adam(G.parameters(), lr=2e-4, betas=(0.5, 0.999))
opt_D = torch.optim.Adam(D.parameters(), lr=2e-4, betas=(0.5, 0.999))
criterion = nn.BCEWithLogitsLoss()

# Stand-in for a real image dataset, flattened and scaled to [-1, 1] to match generator's Tanh output
real_data = torch.rand(1000, 28*28) * 2 - 1

n_epochs, batch_size = 50, 64
label_smoothing = 0.9  # real labels are 0.9 instead of 1.0 — prevents an overconfident discriminator

for epoch in range(n_epochs):
    idx = torch.randperm(real_data.size(0))[:batch_size]
    real_batch = real_data[idx]

    # --- Train Discriminator ---
    opt_D.zero_grad()
    real_labels = torch.full((batch_size, 1), label_smoothing)
    fake_labels = torch.zeros(batch_size, 1)

    d_loss_real = criterion(D(real_batch), real_labels)
    z = torch.randn(batch_size, latent_dim)
    fake_batch = G(z)
    d_loss_fake = criterion(D(fake_batch.detach()), fake_labels)
    d_loss = d_loss_real + d_loss_fake
    d_loss.backward()
    opt_D.step()

    # --- Train Generator ---
    opt_G.zero_grad()
    g_loss = criterion(D(fake_batch), torch.ones(batch_size, 1))  # generator wants D to say "real"
    g_loss.backward()
    opt_G.step()

    if epoch % 10 == 0:
        # Monitor discriminator confidence — a healthy GAN keeps D's accuracy well below 100%
        with torch.no_grad():
            d_acc_real = (torch.sigmoid(D(real_batch)) > 0.5).float().mean().item()
            d_acc_fake = (torch.sigmoid(D(fake_batch)) < 0.5).float().mean().item()
        print(f"Epoch {epoch}: D_loss={d_loss.item():.3f} G_loss={g_loss.item():.3f} "
              f"D_acc_real={d_acc_real:.2f} D_acc_fake={d_acc_fake:.2f}")
```

**What to watch during training:** if `D_acc_real` and `D_acc_fake` both sit near 1.0 for many epochs, the discriminator has "won" and stopped providing useful gradient to the generator (a common GAN failure mode) — this is exactly the instability that label smoothing, and more aggressive fixes like WGAN-GP, exist to address.

---

## 8. Advanced & Lesser-Known Techniques

- **Classifier-free guidance** (diffusion models): instead of training a separate classifier to steer generation toward a condition (class/text), randomly drop the conditioning signal during training some fraction of the time, then at inference time extrapolate between the conditional and unconditional predictions — this is the mechanism behind the "guidance scale" slider in tools like Stable Diffusion, letting users trade prompt adherence against diversity/quality.
- **Latent diffusion**: instead of running the diffusion process in full pixel space (computationally expensive at high resolution), first compress images into a smaller latent space with a pretrained autoencoder, then run diffusion in that compressed latent space — the core efficiency trick behind Stable Diffusion's practicality on consumer hardware.
- **Progressive growing** (historical GAN technique): start training a GAN at very low resolution (4x4) and progressively add layers to increase resolution as training stabilizes — helped early high-resolution GANs (like ProGAN, StyleGAN's predecessor) achieve much better results than training at full resolution from the start.
- **Consistency models**: a distillation technique that trains a model to map any point on a diffusion trajectory directly to the final clean image in a single step, enabling near-instant sampling — a major recent direction for closing diffusion's sampling-speed gap with GANs.

---

## 9. Practice Exercises

1. Retrain the DCGAN example without label smoothing and compare the discriminator accuracy curves — does it destabilize faster?
2. Implement a simple gradient penalty term (WGAN-GP style) and add it to the discriminator loss; compare training stability against the vanilla BCE version above.
3. Implement the reparameterization trick's effect directly: train the VAE from section 2 with the KL term weight set to 0, 1, and 10, and visually/qualitatively compare reconstruction sharpness vs. latent space smoothness (samples from random latent vectors) at each setting.
4. Implement a minimal classifier-free guidance mechanism: train a class-conditional generator that also learns to generate unconditionally (by randomly zeroing the class embedding 10% of the time), then extrapolate between conditional and unconditional outputs at inference and observe the effect of increasing guidance strength.
5. Compute FID (using a library like `torchmetrics`) between a small set of real images and GAN-generated images at three different training checkpoints (early, middle, late) — chart how it changes over training.

---

## 10. More Examples

### Example: Conditional GAN — generating images of a SPECIFIC requested class

```python
import torch
import torch.nn as nn

class ConditionalGenerator(nn.Module):
    def __init__(self, latent_dim, num_classes, img_dim, embed_dim=10):
        super().__init__()
        self.label_embedding = nn.Embedding(num_classes, embed_dim)
        self.net = nn.Sequential(
            nn.Linear(latent_dim + embed_dim, 256), nn.ReLU(),
            nn.Linear(256, 512), nn.ReLU(),
            nn.Linear(512, img_dim), nn.Tanh(),
        )

    def forward(self, z, labels):
        label_emb = self.label_embedding(labels)
        combined = torch.cat([z, label_emb], dim=1)  # condition generation on the requested class
        return self.net(combined)

generator = ConditionalGenerator(latent_dim=64, num_classes=10, img_dim=784)
z = torch.randn(4, 64)
requested_labels = torch.tensor([0, 3, 7, 9])  # generate specifically THESE digits
generated_images = generator(z, requested_labels)
print(f"Generated {generated_images.shape[0]} images of the requested classes")
```

### Example: Image-to-image translation setup (e.g., sketches to photos)

```python
import torch.nn as nn

class SimpleImageToImageNet(nn.Module):
    """A minimal encoder-decoder (U-Net style, simplified) for paired image translation tasks."""
    def __init__(self):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Conv2d(3, 64, 4, 2, 1), nn.LeakyReLU(0.2),
            nn.Conv2d(64, 128, 4, 2, 1), nn.BatchNorm2d(128), nn.LeakyReLU(0.2),
        )
        self.decoder = nn.Sequential(
            nn.ConvTranspose2d(128, 64, 4, 2, 1), nn.BatchNorm2d(64), nn.ReLU(),
            nn.ConvTranspose2d(64, 3, 4, 2, 1), nn.Tanh(),
        )

    def forward(self, x):
        return self.decoder(self.encoder(x))

# Trained with a combination of an adversarial loss (from a discriminator, as in pix2pix)
# AND a pixel-wise L1 loss against the paired ground-truth target image
model = SimpleImageToImageNet()
sketch = torch.randn(1, 3, 64, 64)
generated_photo = model(sketch)
print(f"Output shape: {generated_photo.shape}")
```

### Example: Simple DDPM sampling loop (reverse diffusion)

```python
import torch

@torch.no_grad()
def sample_ddpm(model, shape, betas, n_steps):
    """Starts from pure noise and iteratively denoises — the generation-time counterpart
    to the forward_diffusion training function shown earlier in this sheet."""
    alphas = 1.0 - betas
    alphas_cumprod = torch.cumprod(alphas, dim=0)

    x = torch.randn(shape)  # start from pure Gaussian noise
    for t in reversed(range(n_steps)):
        predicted_noise = model(x, torch.tensor([t]))
        alpha_t, alpha_cumprod_t = alphas[t], alphas_cumprod[t]
        # Remove the predicted noise, scaled appropriately for this timestep
        x = (1 / alpha_t.sqrt()) * (x - (1 - alpha_t) / (1 - alpha_cumprod_t).sqrt() * predicted_noise)
        if t > 0:
            x += betas[t].sqrt() * torch.randn_like(x)  # re-inject a controlled amount of noise
    return x

# betas = torch.linspace(1e-4, 0.02, 1000); sample_ddpm(trained_model, (1, 3, 32, 32), betas, 1000)
```

---

## 11. Quick-Reference Cheat-Table

| Need | Model family |
|---|---|
| Fastest sampling | GAN |
| Most stable training | Diffusion |
| Meaningful, structured latent space | VAE |
| Highest current image quality | Diffusion (latent diffusion) |
| Text-to-image | Diffusion + cross-attention conditioning |
| Fine-tune for a new style/subject cheaply | LoRA on a pretrained diffusion model |

## 12. FAQ

**Q: Why did my GAN's generator loss go to near-zero while images still look bad?**
A: The discriminator has likely collapsed/stopped providing useful signal, or mode collapse has occurred — check output diversity, not just the loss curve.

**Q: GAN or diffusion — which should I use for a new project?**
A: Diffusion, for almost all new projects today — more stable training, better mode coverage, and the sampling-speed gap has narrowed significantly with modern samplers.

**Q: Why are VAE outputs blurry compared to GANs?**
A: The KL divergence term pulling the latent space toward a smooth prior trades off against sharp reconstruction — this tension is inherent to the VAE objective.

**Q: What does "guidance scale" actually control in a diffusion model?**
A: It controls how strongly the model steers generation toward the given prompt/condition, via classifier-free guidance — higher values increase prompt adherence at some cost to diversity/naturalness.

**Q: Do I need to train a diffusion model from scratch?**
A: Almost never — start from a pretrained model (e.g., Stable Diffusion) and fine-tune with LoRA for a new style/subject unless you have a very unusual data domain and large compute budget.
