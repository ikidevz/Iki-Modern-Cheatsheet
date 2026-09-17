# Deep Reinforcement Learning Cheatsheet

## Overview

Tabular RL breaks down the moment state spaces get large or continuous — you can't build a Q-table over every possible pixel configuration of an Atari game. Deep RL replaces the table with a neural network function approximator, unlocking RL on rich, high-dimensional state spaces, at the cost of new instability challenges this sheet covers.

```bash
pip install torch gymnasium --break-system-packages
```

---

## 1. Deep Q-Networks (DQN)

DQN approximates Q(s,a) with a neural network instead of a table, and introduces two key stabilization tricks that made deep RL actually trainable.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import random
from collections import deque

class QNetwork(nn.Module):
    def __init__(self, state_dim, action_dim, hidden_dim=128):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(state_dim, hidden_dim), nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim), nn.ReLU(),
            nn.Linear(hidden_dim, action_dim),  # one Q-value output per action
        )
    def forward(self, x):
        return self.net(x)

class ReplayBuffer:
    """Experience replay: store past transitions, sample randomly to break correlation between consecutive updates."""
    def __init__(self, capacity=10000):
        self.buffer = deque(maxlen=capacity)

    def push(self, state, action, reward, next_state, done):
        self.buffer.append((state, action, reward, next_state, done))

    def sample(self, batch_size):
        batch = random.sample(self.buffer, batch_size)
        states, actions, rewards, next_states, dones = zip(*batch)
        return (torch.tensor(states, dtype=torch.float32),
                torch.tensor(actions, dtype=torch.long),
                torch.tensor(rewards, dtype=torch.float32),
                torch.tensor(next_states, dtype=torch.float32),
                torch.tensor(dones, dtype=torch.float32))

    def __len__(self):
        return len(self.buffer)

state_dim, action_dim = 4, 2  # e.g., CartPole: 4-dim state, 2 discrete actions
q_network = QNetwork(state_dim, action_dim)
target_network = QNetwork(state_dim, action_dim)
target_network.load_state_dict(q_network.state_dict())  # start identical to the online network

optimizer = torch.optim.Adam(q_network.parameters(), lr=1e-3)
replay_buffer = ReplayBuffer()

def dqn_update(batch_size=64, gamma=0.99):
    if len(replay_buffer) < batch_size:
        return None
    states, actions, rewards, next_states, dones = replay_buffer.sample(batch_size)

    current_q = q_network(states).gather(1, actions.unsqueeze(1)).squeeze(1)

    with torch.no_grad():
        # TARGET NETWORK: a periodically-frozen copy used to compute the Bellman target,
        # preventing the "moving target" instability of updating Q toward a rapidly-shifting estimate of itself
        max_next_q = target_network(next_states).max(dim=1)[0]
        target_q = rewards + gamma * max_next_q * (1 - dones)

    loss = F.mse_loss(current_q, target_q)
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    return loss.item()

# Periodically sync the target network (e.g., every 1000 steps)
def sync_target_network():
    target_network.load_state_dict(q_network.state_dict())
```

**Why experience replay matters:** consecutive frames/states in an RL trajectory are highly correlated (state at time t is very similar to state at t+1), which violates the i.i.d. assumption most gradient-based optimization relies on. Sampling randomly from a large buffer of past transitions breaks this correlation and reuses data more efficiently.

**Why a target network matters:** without it, the Bellman target `reward + gamma * max_a' Q(s',a')` uses the SAME network being updated, so every update shifts the target itself — a moving-target problem that can make training oscillate or diverge. Freezing a separate target network and only syncing it periodically stabilizes the target long enough for learning to actually converge.

---

## 2. Policy Gradient Methods

Instead of learning value estimates and deriving a policy from them, policy gradient methods directly parameterize and optimize the policy itself — useful when the action space is large, continuous, or when a stochastic policy is inherently desirable.

```python
class PolicyNetwork(nn.Module):
    def __init__(self, state_dim, action_dim, hidden_dim=128):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(state_dim, hidden_dim), nn.ReLU(),
            nn.Linear(hidden_dim, action_dim),
        )
    def forward(self, x):
        return F.softmax(self.net(x), dim=-1)  # outputs a probability distribution over actions

policy = PolicyNetwork(state_dim, action_dim)
policy_optimizer = torch.optim.Adam(policy.parameters(), lr=1e-3)

def reinforce_update(states, actions, returns):
    """REINFORCE: increase probability of actions that led to high returns, decrease for low returns."""
    action_probs = policy(states)
    log_probs = torch.log(action_probs.gather(1, actions.unsqueeze(1)).squeeze(1))

    # Baseline subtraction (returns - mean) reduces variance without introducing bias
    returns = (returns - returns.mean()) / (returns.std() + 1e-8)
    loss = -(log_probs * returns).mean()  # negative because we're doing gradient ASCENT on expected return

    policy_optimizer.zero_grad()
    loss.backward()
    policy_optimizer.step()
    return loss.item()
```

**REINFORCE's variance problem:** the raw policy gradient estimate uses the full episode return as a signal, which is extremely noisy — two nearly-identical trajectories can receive very different total returns due to environment stochasticity unrelated to the action being reinforced. This high variance makes learning slow and unstable; the fix is to subtract a "baseline" (as shown above, or ideally a learned value function — leading directly to actor-critic methods).

---

## 3. Actor-Critic Methods

Combines a policy (**actor**, choosing actions) with a value estimator (**critic**, evaluating states) — the critic provides a much lower-variance training signal for the actor than raw episode returns.

```python
class ActorCritic(nn.Module):
    def __init__(self, state_dim, action_dim, hidden_dim=128):
        super().__init__()
        self.shared = nn.Sequential(nn.Linear(state_dim, hidden_dim), nn.ReLU())
        self.actor_head = nn.Linear(hidden_dim, action_dim)   # outputs action logits
        self.critic_head = nn.Linear(hidden_dim, 1)            # outputs a single state-value estimate

    def forward(self, x):
        shared_features = self.shared(x)
        action_probs = F.softmax(self.actor_head(shared_features), dim=-1)
        state_value = self.critic_head(shared_features)
        return action_probs, state_value

model = ActorCritic(state_dim, action_dim)

def actor_critic_update(state, action, reward, next_state, done, optimizer, gamma=0.99):
    action_probs, value = model(state)
    _, next_value = model(next_state)

    # TD error (advantage estimate): how much better/worse this transition was than the critic expected
    td_target = reward + gamma * next_value * (1 - done)
    advantage = (td_target - value).detach()  # detach — advantage is a signal for the actor, not a target for it

    actor_loss = -torch.log(action_probs[action]) * advantage
    critic_loss = F.mse_loss(value, td_target.detach())

    loss = actor_loss + critic_loss
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
```

---

## 4. PPO and Trust-Region Methods

Vanilla policy gradients are prone to catastrophically large updates — a single bad batch can push the policy into a much worse region it never recovers from. **PPO (Proximal Policy Optimization)** clips the policy update to stay within a "trust region" of the previous policy, becoming the practical default for stability.

```python
def ppo_loss(old_log_probs, new_log_probs, advantages, epsilon=0.2):
    ratio = torch.exp(new_log_probs - old_log_probs)  # how much the policy has changed for this action

    unclipped = ratio * advantages
    clipped = torch.clamp(ratio, 1 - epsilon, 1 + epsilon) * advantages

    # Taking the MINIMUM creates a pessimistic bound — large beneficial ratio changes get clipped,
    # so the policy can't run away and overcommit to a single good-looking update
    loss = -torch.min(unclipped, clipped).mean()
    return loss

# Illustrative values
old_log_probs = torch.tensor([-0.5, -0.7, -0.3])
new_log_probs = torch.tensor([-0.3, -0.9, -0.2])
advantages = torch.tensor([1.0, -0.5, 0.8])
print(f"PPO loss: {ppo_loss(old_log_probs, new_log_probs, advantages).item():.4f}")
```

**Why this became the practical default:** PPO gets most of the stability benefit of more mathematically rigorous trust-region methods (like TRPO, which explicitly constrains a KL-divergence bound via a more complex constrained optimization), using a much simpler first-order clipping objective — making it dramatically easier to implement and tune while still preventing destructively large policy updates.

---

## 5. Continuous Action Spaces

For actions that are continuous values (steering angle, joint torque) rather than a discrete choice, the network outputs distribution parameters instead of a probability per discrete action.

```python
class ContinuousPolicy(nn.Module):
    """Outputs mean and log-std of a Gaussian distribution over continuous actions."""
    def __init__(self, state_dim, action_dim, hidden_dim=128):
        super().__init__()
        self.shared = nn.Sequential(nn.Linear(state_dim, hidden_dim), nn.ReLU())
        self.mean_head = nn.Linear(hidden_dim, action_dim)
        self.log_std = nn.Parameter(torch.zeros(action_dim))  # learned, state-independent in this simple version

    def forward(self, x):
        mean = self.mean_head(self.shared(x))
        std = torch.exp(self.log_std)
        return torch.distributions.Normal(mean, std)

policy = ContinuousPolicy(state_dim=4, action_dim=2)
dist = policy(torch.randn(1, 4))
action = dist.sample()
log_prob = dist.log_prob(action).sum(dim=-1)
print(f"Sampled continuous action: {action}, log_prob: {log_prob.item():.3f}")
```

| Algorithm family | Approach |
|---|---|
| DDPG | Deterministic policy + a critic, works well for continuous control but can be sensitive to hyperparameters |
| SAC (Soft Actor-Critic) | Adds an entropy bonus to encourage exploration, generally more stable and sample-efficient than DDPG |
| PPO (continuous variant) | Same clipped-objective idea as discrete PPO, just with a Gaussian policy head as shown above |

---

## 6. RLHF as an Applied Case

Reinforcement Learning from Human Feedback applies the actor-critic/PPO machinery above to align a language model with human preferences, treating the LLM itself as the policy:

```
1. Collect human preference comparisons: "response A is better than response B" for various prompts
2. Train a reward model to predict human preference scores from these comparisons
3. Use PPO to fine-tune the LLM (the "actor") to maximize the reward model's score,
   with a KL-divergence penalty against the original model to prevent it from drifting
   too far and degenerating (e.g., producing text that "games" the reward model but reads as gibberish)
```

The KL penalty against the reference (pre-RLHF) model plays exactly the same stabilizing role as PPO's clipping objective in classic RL — preventing the policy (here, the LLM) from making destructively large jumps away from a known-good starting point. See the Fine-tuning & PEFT sheet's discussion of DPO for a more recent, simpler alternative to this full RLHF pipeline.

## Common Pitfalls

- **No target network in DQN** (or syncing it too frequently) — reintroduces the moving-target instability the target network exists to fix.
- **Forgetting to detach the advantage estimate** in actor-critic updates — lets gradients flow into the critic through the actor's loss term, corrupting training.
- **Using vanilla policy gradients (REINFORCE) without a baseline** — the resulting variance makes training painfully slow or unstable for anything beyond toy problems.
- **Setting PPO's clip range too wide** — defeats the purpose of trust-region stability; too narrow — learning becomes overly conservative and slow.
- **Insufficient exploration in continuous control** — a Gaussian policy with too small a learned std can collapse to near-deterministic behavior before it has explored enough of the action space.

---

## 7. End-to-End Worked Example: Training DQN on CartPole

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import random
from collections import deque
import gymnasium as gym

env = gym.make("CartPole-v1")
state_dim = env.observation_space.shape[0]
action_dim = env.action_space.n

class QNetwork(nn.Module):
    def __init__(self, state_dim, action_dim):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(state_dim, 128), nn.ReLU(),
            nn.Linear(128, 128), nn.ReLU(),
            nn.Linear(128, action_dim),
        )
    def forward(self, x):
        return self.net(x)

q_net = QNetwork(state_dim, action_dim)
target_net = QNetwork(state_dim, action_dim)
target_net.load_state_dict(q_net.state_dict())
optimizer = torch.optim.Adam(q_net.parameters(), lr=1e-3)
replay_buffer = deque(maxlen=10000)

def select_action(state, epsilon):
    if random.random() < epsilon:
        return env.action_space.sample()
    with torch.no_grad():
        return q_net(torch.tensor(state, dtype=torch.float32)).argmax().item()

def train_step(batch_size=64, gamma=0.99):
    if len(replay_buffer) < batch_size:
        return
    batch = random.sample(replay_buffer, batch_size)
    states, actions, rewards, next_states, dones = zip(*batch)
    states = torch.tensor(np.array(states), dtype=torch.float32)
    actions = torch.tensor(actions, dtype=torch.long)
    rewards = torch.tensor(rewards, dtype=torch.float32)
    next_states = torch.tensor(np.array(next_states), dtype=torch.float32)
    dones = torch.tensor(dones, dtype=torch.float32)

    current_q = q_net(states).gather(1, actions.unsqueeze(1)).squeeze(1)
    with torch.no_grad():
        max_next_q = target_net(next_states).max(dim=1)[0]
        target_q = rewards + gamma * max_next_q * (1 - dones)

    loss = F.mse_loss(current_q, target_q)
    optimizer.zero_grad()
    loss.backward()
    torch.nn.utils.clip_grad_norm_(q_net.parameters(), max_norm=10)
    optimizer.step()

n_episodes = 300
episode_rewards = []
epsilon = 1.0

for episode in range(n_episodes):
    state, _ = env.reset()
    total_reward = 0
    done = False
    while not done:
        action = select_action(state, epsilon)
        next_state, reward, terminated, truncated, _ = env.step(action)
        done = terminated or truncated
        replay_buffer.append((state, action, reward, next_state, float(done)))
        state = next_state
        total_reward += reward
        train_step()

    epsilon = max(0.01, epsilon * 0.99)  # decay exploration over episodes
    if episode % 10 == 0:
        target_net.load_state_dict(q_net.state_dict())  # periodic target network sync

    episode_rewards.append(total_reward)
    if episode % 25 == 0:
        print(f"Episode {episode}: reward={total_reward:.0f}, avg last 25={np.mean(episode_rewards[-25:]):.1f}, epsilon={epsilon:.3f}")

print(f"\nFinal average reward (last 25 episodes): {np.mean(episode_rewards[-25:]):.1f}")
# CartPole is considered "solved" around an average reward of 195+ over 100 consecutive episodes
```

Watch the `avg last 25` trend over training — a healthy DQN run shows steady (if noisy) improvement, while a broken one (e.g., missing target network sync, or too aggressive an epsilon decay) often shows reward that improves briefly then collapses back down, a classic symptom of the instabilities this sheet's stabilization tricks exist to prevent.

---

## 8. Advanced & Lesser-Known Techniques

- **Double DQN**: apply the same overestimation-bias fix from tabular Double Q-learning to the deep setting — use the online network to *select* the best next action, but the target network to *evaluate* it, rather than letting the target network do both.
- **Dueling DQN architecture**: split the network into two streams — one estimating the state's overall value V(s), one estimating each action's *advantage* over that baseline — often improves learning efficiency, especially in states where the choice of action doesn't matter much.
- **Prioritized experience replay**: instead of sampling uniformly from the replay buffer, sample transitions with probability proportional to their TD error (how "surprising" they were) — focuses training on the most informative transitions rather than treating all past experience equally.
- **Generalized Advantage Estimation (GAE)**: used with PPO/actor-critic methods, GAE blends multi-step returns at different horizons (weighted by a parameter λ) to balance the bias/variance tradeoff in advantage estimation more flexibly than a single-step TD error alone.

---

## 9. Practice Exercises

1. Run the DQN example above with the target network sync frequency set to every episode vs. every 50 episodes — compare training stability.
2. Implement Double DQN (change only the target computation) and compare the learned Q-values' magnitude against standard DQN on the same environment.
3. Implement a simple Dueling DQN architecture (separate value and advantage streams, combined at the output) and compare sample efficiency (episodes to reach a reward threshold) against the standard architecture.
4. Implement PPO's clipped objective (from section 4 of this sheet) on CartPole using a simple policy network, and compare training stability against the REINFORCE implementation from section 2.
5. Add prioritized experience replay to the DQN implementation above (weight sampling probability by absolute TD error) and measure whether it reaches a given reward threshold in fewer episodes than uniform replay sampling.

---

## 10. More Examples

### Example: Reward normalization for training stability

```python
import numpy as np

class RunningNormalizer:
    """Normalizes rewards on the fly using a running mean/std — RL training is notoriously
    sensitive to reward SCALE, and this keeps gradients well-behaved without knowing the scale upfront."""
    def __init__(self, epsilon=1e-8):
        self.mean, self.var, self.count = 0.0, 1.0, epsilon

    def update(self, value):
        self.count += 1
        delta = value - self.mean
        self.mean += delta / self.count
        self.var += delta * (value - self.mean)

    def normalize(self, value):
        std = max(np.sqrt(self.var / self.count), 1e-6)
        return (value - self.mean) / std

normalizer = RunningNormalizer()
raw_rewards = [100, 105, 98, 500, 102]  # one large outlier reward
for r in raw_rewards:
    normalizer.update(r)
    print(f"Raw: {r}, normalized: {normalizer.normalize(r):.2f}")
```

### Example: Curriculum learning — gradually increasing task difficulty

```python
def get_curriculum_difficulty(episode, total_episodes, max_difficulty=10):
    """Start EASY, gradually increase difficulty as the agent improves —
    often trains faster and more reliably than throwing the agent at the hardest setting immediately."""
    progress = min(1.0, episode / (total_episodes * 0.7))  # ramp up over the first 70% of training
    return int(1 + progress * (max_difficulty - 1))

for episode in [0, 200, 500, 800, 1000]:
    print(f"Episode {episode}: difficulty level = {get_curriculum_difficulty(episode, 1000)}")
```

### Example: Evaluating a trained policy's robustness under perturbation

```python
import numpy as np

def evaluate_with_noise(policy_fn, env, noise_std=0.1, n_episodes=20):
    """A policy that only works under EXACT training conditions is fragile —
    testing with injected observation noise reveals how robust it actually is."""
    rewards = []
    for _ in range(n_episodes):
        state, _ = env.reset()
        total_reward, done = 0, False
        while not done:
            noisy_state = state + np.random.normal(0, noise_std, size=np.array(state).shape)
            action = policy_fn(noisy_state)
            state, reward, terminated, truncated, _ = env.step(action)
            done = terminated or truncated
            total_reward += reward
        rewards.append(total_reward)
    return np.mean(rewards), np.std(rewards)

# clean_perf = evaluate_with_noise(trained_policy, env, noise_std=0.0)
# noisy_perf = evaluate_with_noise(trained_policy, env, noise_std=0.2)
# A large gap between clean and noisy performance signals overfitting to exact training conditions
```

---

## 11. Quick-Reference Cheat-Table

| Situation | Choice |
|---|---|
| Discrete actions, value-based | DQN (add Double DQN to fix overestimation) |
| Need training stability | PPO |
| Continuous action space | SAC or DDPG, or continuous PPO |
| Large state space, small action space | Dueling DQN architecture |
| Aligning an LLM to preferences | RLHF (PPO) or DPO (simpler alternative) |
| High-variance policy gradients | Add a baseline (actor-critic) instead of raw REINFORCE |

## 12. FAQ

**Q: Why is my DQN unstable/diverging?**
A: Check for a missing or too-frequently-synced target network, and verify experience replay is actually breaking sample correlation.

**Q: PPO or vanilla policy gradients — which should I default to?**
A: PPO, essentially always — its clipped objective prevents the destructively large updates that make vanilla policy gradients unstable.

**Q: Do I need a target network for actor-critic methods too?**
A: Not always required the way DQN needs one, but many advanced actor-critic variants (like SAC) do use target networks for the same stabilization reason.

**Q: My continuous-control policy collapsed to near-deterministic behavior — why?**
A: The learned standard deviation in your Gaussian policy likely shrank too much — check exploration incentives and consider entropy regularization (as in SAC).

**Q: How does RLHF's KL penalty relate to PPO's clipping?**
A: Both prevent the policy from making destructively large jumps away from a known-good starting point — KL penalty in RLHF constrains drift from the reference model, PPO's clip constrains drift from the previous policy iteration.
