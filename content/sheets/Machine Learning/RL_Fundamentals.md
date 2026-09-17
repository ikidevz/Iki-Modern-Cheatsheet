# RL Fundamentals Cheatsheet

## Overview

Reinforcement learning is fundamentally different from supervised learning: there's no fixed labeled dataset, just an agent interacting with an environment, receiving delayed and often sparse rewards, and having to figure out which of its past actions actually caused a good or bad outcome. This sheet covers the foundational framework (MDPs), value functions, tabular Q-learning, and the exploration/exploitation tradeoff that has no equivalent in supervised learning.

```bash
pip install numpy gymnasium --break-system-packages
```

---

## 1. Markov Decision Processes

An MDP is defined by:
- **States (S)**: all possible situations the agent can be in.
- **Actions (A)**: what the agent can do in each state.
- **Transitions P(s'|s,a)**: the probability of ending up in state s' after taking action a in state s.
- **Rewards R(s,a,s')**: the immediate payoff for that transition.
- **The Markov assumption**: the future depends only on the current state, not the history of how you got there — all relevant information must be encoded in the state itself.

```python
import numpy as np

# A tiny 4-state grid world MDP
# States: 0, 1, 2, 3 (3 is a terminal "goal" state)
# Actions: 0 = left, 1 = right
n_states, n_actions = 4, 2

# Deterministic transitions for this toy example: action moves you left/right, clamped at boundaries
def transition(state, action):
    if state == 3:  # terminal state
        return state, 0
    next_state = max(0, state - 1) if action == 0 else min(3, state + 1)
    reward = 10 if next_state == 3 else -1  # -1 per step encourages reaching the goal quickly
    return next_state, reward

print(transition(2, 1))  # (3, 10) — moving right from state 2 reaches the goal
```

**Why the Markov assumption matters in practice:** if your state representation doesn't capture everything relevant (e.g., a robot's state that omits its velocity, only position), the environment effectively becomes non-Markovian from the agent's point of view — the same observed state can lead to different outcomes depending on hidden history, which breaks the theoretical guarantees behind most RL algorithms and makes learning much harder.

---

## 2. Value Functions and Bellman Equations

- **State-value function V(s)**: expected total future reward starting from state s, following a given policy.
- **Action-value function Q(s,a)**: expected total future reward starting from state s, taking action a, then following the policy.

The Bellman equation expresses each value recursively in terms of the *next* state's value — this recursive structure is what every value-based RL algorithm exploits:

```
Q(s,a) = R(s,a) + γ * max_a'[Q(s', a')]
```

where `γ` (gamma, the discount factor) controls how much future rewards matter relative to immediate ones — closer to 1 means the agent cares about long-term consequences; closer to 0 means it's short-sighted.

```python
def bellman_backup(Q, state, action, next_state, reward, gamma=0.9):
    """One step of the Bellman update — the foundation of Q-learning below."""
    best_next_value = np.max(Q[next_state])
    target = reward + gamma * best_next_value
    return target
```

---

## 3. Tabular Q-Learning and SARSA

Both learn a Q-table (one entry per state-action pair) by repeatedly interacting with the environment and updating estimates toward the Bellman target.

```python
def q_learning(n_episodes=500, alpha=0.1, gamma=0.9, epsilon=0.1):
    Q = np.zeros((n_states, n_actions))

    for episode in range(n_episodes):
        state = 0
        while state != 3:
            # Epsilon-greedy action selection
            if np.random.random() < epsilon:
                action = np.random.randint(n_actions)  # explore
            else:
                action = np.argmax(Q[state])            # exploit

            next_state, reward = transition(state, action)

            # Q-LEARNING is OFF-POLICY: the update uses the BEST possible next action,
            # regardless of what action the agent will actually take next
            best_next_q = np.max(Q[next_state])
            Q[state, action] += alpha * (reward + gamma * best_next_q - Q[state, action])

            state = next_state
    return Q

Q_learned = q_learning()
print("Learned Q-table:\n", Q_learned.round(2))
print(f"Optimal policy: {['left' if a == 0 else 'right' for a in np.argmax(Q_learned, axis=1)]}")
```

```python
def sarsa(n_episodes=500, alpha=0.1, gamma=0.9, epsilon=0.1):
    Q = np.zeros((n_states, n_actions))

    for episode in range(n_episodes):
        state = 0
        action = np.random.randint(n_actions) if np.random.random() < epsilon else np.argmax(Q[state])

        while state != 3:
            next_state, reward = transition(state, action)
            next_action = np.random.randint(n_actions) if np.random.random() < epsilon else np.argmax(Q[next_state])

            # SARSA is ON-POLICY: the update uses the action the agent will ACTUALLY take next,
            # which includes exploration — makes it more "cautious" around risky states
            Q[state, action] += alpha * (reward + gamma * Q[next_state, next_action] - Q[state, action])

            state, action = next_state, next_action
    return Q

Q_sarsa = sarsa()
print("SARSA Q-table:\n", Q_sarsa.round(2))
```

**On-policy vs. off-policy, concretely:** in a "cliff walking" environment, Q-learning learns the objectively optimal (risky, cliff-hugging) path because it always bootstraps from the best possible next action, while SARSA learns a safer path that accounts for the actual epsilon-greedy exploration risk of occasionally slipping off the cliff — a good illustration of how the two algorithms can converge to meaningfully different behavior even on the same environment.

---

## 4. Exploration vs. Exploitation

The agent needs to try actions it hasn't confirmed are good (**exploration**) to discover better strategies, while also using what it already knows works (**exploitation**) to actually accumulate reward — pure exploitation gets stuck at whatever looks best early on; pure exploration never capitalizes on what's been learned.

```python
def epsilon_greedy(Q, state, epsilon):
    if np.random.random() < epsilon:
        return np.random.randint(Q.shape[1])  # explore: uniformly random action
    return np.argmax(Q[state])                 # exploit: best known action

# Decaying epsilon: explore heavily early, exploit more as the agent learns
def decayed_epsilon(episode, start=1.0, end=0.05, decay_episodes=300):
    return max(end, start - (start - end) * (episode / decay_episodes))

for ep in [0, 100, 200, 300, 400]:
    print(f"Episode {ep}: epsilon = {decayed_epsilon(ep):.3f}")
```

**Why pure exploitation fails:** if the agent always picks the currently-best-looking action from the very first episode, it will never discover that a different, unexplored action might actually be better — it gets permanently anchored to whatever happened to look good based on early, limited (and possibly unlucky) experience.

---

## 5. Reward Shaping and Its Pitfalls

Reward shaping adds intermediate rewards to guide learning toward a sparse, delayed final goal faster — but poorly designed shaped rewards can teach the agent to optimize the *proxy* reward instead of the actual intended objective.

```python
# Sparse reward: only rewarded at the very end — hard to learn from, especially with long episodes
def sparse_reward(state, goal_reached):
    return 100 if goal_reached else 0

# Shaped reward: rewards INCREMENTAL progress toward the goal
def shaped_reward(distance_to_goal_before, distance_to_goal_after):
    return distance_to_goal_before - distance_to_goal_after  # positive if the agent got closer
```

**Reward hacking, a classic real example:** a boat-racing RL agent given reward for hitting checkpoints (a shaped reward meant to encourage progress along the race track) discovered it could spin in a small circle, repeatedly re-triggering nearby checkpoints, and rack up more reward than actually finishing races — the shaped reward diverged from the real objective ("win the race") in a way the reward function's designer hadn't anticipated. **The general lesson**: always sanity-check a shaped reward by asking "what is the laziest, most degenerate way to maximize this exact reward signal?"

---

## 6. When RL Is (and Isn't) the Right Framing

| Situation | Better framing |
|---|---|
| Sequential decisions affect future states/options, delayed reward | RL — this is exactly what it's built for |
| Single-shot decision, immediate reward, no state transitions | Multi-armed bandit — simpler, faster to converge, no need for a full MDP |
| Correct action for a given input is knowable from labeled data | Supervised learning — much more sample-efficient than RL when labels exist |
| Environment is expensive or risky to interact with (real-world robotics, healthcare) | Offline RL, simulation-based training, or a non-RL approach entirely — online RL's trial-and-error can be costly or dangerous |

**Rule of thumb:** don't reach for RL just because a problem *can* be framed sequentially — if a supervised approach with labeled "correct" actions is available, it will almost always be more sample-efficient and easier to train reliably than RL, which has to discover good behavior through trial and error rather than direct supervision.

## Common Pitfalls

- **Using a discount factor of 1.0 (or very close to it)** in an environment with infinite/long episodes — value estimates can diverge; a discount slightly below 1 keeps the math well-behaved.
- **Confusing Q-learning and SARSA's update targets** — a common source of subtly wrong implementations that still "sort of" learn something, masking the bug.
- **Reward shaping without checking for degenerate exploits** — always ask what the laziest reward-maximizing behavior looks like before trusting a shaped reward.
- **Fixed (non-decaying) epsilon throughout training** — wastes exploration budget late in training when the agent should mostly be exploiting what it has already learned.
- **Applying tabular Q-learning to large or continuous state spaces** — the Q-table becomes infeasible; that's exactly the problem Deep RL (see the next sheet) is built to solve.

---

## 7. End-to-End Worked Example: Solving FrozenLake With Tabular Q-Learning

```python
import numpy as np
import gymnasium as gym

env = gym.make("FrozenLake-v1", is_slippery=True)  # slippery = stochastic transitions, a harder/more realistic case
n_states = env.observation_space.n
n_actions = env.action_space.n

Q = np.zeros((n_states, n_actions))
alpha, gamma = 0.1, 0.99
n_episodes = 10000

def decayed_epsilon(episode, start=1.0, end=0.01, decay_episodes=8000):
    return max(end, start - (start - end) * (episode / decay_episodes))

episode_rewards = []
for episode in range(n_episodes):
    state, _ = env.reset()
    epsilon = decayed_epsilon(episode)
    total_reward = 0
    done = False

    while not done:
        if np.random.random() < epsilon:
            action = env.action_space.sample()
        else:
            action = np.argmax(Q[state])

        next_state, reward, terminated, truncated, _ = env.step(action)
        done = terminated or truncated

        # Q-learning update
        best_next = np.max(Q[next_state])
        Q[state, action] += alpha * (reward + gamma * best_next - Q[state, action])

        state = next_state
        total_reward += reward

    episode_rewards.append(total_reward)

# Evaluate the learned policy over the last 1000 episodes vs. the first 1000
print(f"Success rate, first 1000 episodes:  {np.mean(episode_rewards[:1000]):.3f}")
print(f"Success rate, last 1000 episodes:   {np.mean(episode_rewards[-1000:]):.3f}")

# Evaluate the FINAL greedy policy (no exploration) over 100 fresh episodes
test_successes = 0
for _ in range(100):
    state, _ = env.reset()
    done = False
    while not done:
        action = np.argmax(Q[state])  # pure exploitation — no more exploration once evaluating
        state, reward, terminated, truncated, _ = env.step(action)
        done = terminated or truncated
    test_successes += reward
print(f"Final greedy policy success rate: {test_successes / 100:.3f}")
```

**Why "slippery" matters for this exercise:** FrozenLake's stochastic version means the agent's chosen action only succeeds with some probability — it can slide to an unintended adjacent tile. This makes the Bellman equation's expectation over `P(s'|s,a)` genuinely matter (rather than being trivially deterministic), and is a good concrete illustration of why RL has to reason probabilistically about outcomes, not just plan a single deterministic path.

---

## 8. Advanced & Lesser-Known Techniques

- **Double Q-learning**: standard Q-learning's `max` operator systematically overestimates action values (since it both selects and evaluates the best action using the same noisy estimates) — Double Q-learning maintains two separate Q-tables, using one to select the best action and the other to evaluate it, reducing this overestimation bias.
- **Eligibility traces (TD(λ))**: a middle ground between one-step TD updates (like Q-learning above) and full Monte Carlo returns — propagates reward information back across multiple recently-visited states in a single update, often speeding up learning compared to pure one-step bootstrapping.
- **Model-based RL**: instead of learning a value function or policy purely from trial-and-error, learn a model of the environment's transition dynamics `P(s'|s,a)` directly, then plan using that learned model (e.g., via simulated rollouts) — can be far more sample-efficient than model-free methods when the environment model is learnable, at the cost of compounding model errors if the learned dynamics are inaccurate.
- **Reward-free / intrinsic motivation**: in sparse-reward environments, augment the extrinsic reward with an intrinsic curiosity signal (e.g., reward for visiting novel states, or for states where a learned dynamics model has high prediction error) — helps agents explore effectively even when useful extrinsic reward is rare or absent for long stretches.

---

## 9. Practice Exercises

1. Run the FrozenLake example with `is_slippery=False` (deterministic) and compare how much faster the agent converges to a high success rate compared to the stochastic version.
2. Implement Double Q-learning (two Q-tables) on the same environment and compare the learned Q-values' magnitude against standard Q-learning — do you observe the expected overestimation in vanilla Q-learning?
3. Sweep the discount factor `gamma` across {0.5, 0.9, 0.99, 0.999} and observe how it changes the learned policy's behavior on a longer-horizon environment.
4. Implement SARSA on the slippery FrozenLake environment and compare its learned policy's risk-taking behavior against Q-learning's, similar to the on-policy/off-policy cliff-walking discussion in this sheet.
5. Design a deliberately mis-specified shaped reward for a simple grid-world (e.g., reward for moving toward a wrong intermediate landmark) and demonstrate the resulting degenerate/reward-hacking behavior the agent learns.

---

## 10. More Examples

### Example: A multi-armed bandit — RL's simpler cousin, for single-shot decisions

```python
import numpy as np

class EpsilonGreedyBandit:
    """No state transitions, just repeated single-shot choices — simpler than a full MDP,
    appropriate when there's no sequential structure (e.g., choosing which ad variant to show)."""
    def __init__(self, n_arms, epsilon=0.1):
        self.n_arms = n_arms
        self.epsilon = epsilon
        self.counts = np.zeros(n_arms)
        self.values = np.zeros(n_arms)

    def select_arm(self):
        if np.random.random() < self.epsilon:
            return np.random.randint(self.n_arms)
        return np.argmax(self.values)

    def update(self, arm, reward):
        self.counts[arm] += 1
        # Incremental average update — equivalent to a running mean, no need to store all past rewards
        self.values[arm] += (reward - self.values[arm]) / self.counts[arm]

true_arm_rewards = [0.3, 0.5, 0.8, 0.4]  # unknown to the agent — it must discover arm 2 is best
bandit = EpsilonGreedyBandit(n_arms=4)
for _ in range(1000):
    arm = bandit.select_arm()
    reward = np.random.binomial(1, true_arm_rewards[arm])
    bandit.update(arm, reward)

print(f"Estimated values: {bandit.values.round(3)}")
print(f"Best arm found: {np.argmax(bandit.values)} (true best: {np.argmax(true_arm_rewards)})")
```

### Example: Value iteration — solving an MDP exactly when the full model is known

```python
import numpy as np

def value_iteration(n_states, n_actions, transition_fn, gamma=0.9, threshold=1e-6):
    """When P(s'|s,a) and R(s,a) are FULLY KNOWN (unlike the trial-and-error setting
    Q-learning assumes), value iteration solves the MDP exactly via dynamic programming."""
    V = np.zeros(n_states)
    while True:
        delta = 0
        for s in range(n_states):
            if s == n_states - 1:  # terminal state
                continue
            action_values = []
            for a in range(n_actions):
                next_s, reward = transition_fn(s, a)
                action_values.append(reward + gamma * V[next_s])
            new_v = max(action_values)
            delta = max(delta, abs(new_v - V[s]))
            V[s] = new_v
        if delta < threshold:
            break
    return V

V_optimal = value_iteration(4, 2, transition)  # reusing `transition` from section 1
print(f"Optimal state values: {V_optimal.round(2)}")
```

### Example: Comparing greedy, epsilon-greedy, and UCB action selection

```python
import numpy as np

def ucb_select(values, counts, total_steps, c=2.0):
    """Upper Confidence Bound: balances exploitation (high value) with exploration
    (arms tried FEWER times get an exploration bonus) — a principled alternative to epsilon-greedy."""
    if 0 in counts:
        return np.argmin(counts)  # always try untried arms first
    ucb_values = values + c * np.sqrt(np.log(total_steps) / counts)
    return np.argmax(ucb_values)

# UCB tends to converge faster than epsilon-greedy in practice because its exploration
# is TARGETED at genuinely under-explored arms, rather than uniformly random
```

---

## 11. Quick-Reference Cheat-Table

| Situation | Choice |
|---|---|
| Single-shot decision, no state | Multi-armed bandit, not full RL |
| Small, discrete state/action space | Tabular Q-learning |
| Want the safer (not just optimal) policy | SARSA (on-policy) |
| Want the objectively optimal policy | Q-learning (off-policy) |
| Full environment model known | Value iteration / policy iteration |
| Environment model unknown, must learn by trial and error | Model-free methods (Q-learning, SARSA) |

## 12. FAQ

**Q: Q-learning or SARSA — which should I use?**
A: Q-learning if you want the theoretically optimal policy; SARSA if you want a policy that accounts for exploration risk during learning (often safer in risky environments).

**Q: Why does my agent exploit a shaped reward in a weird way?**
A: Classic reward hacking — always ask "what's the laziest way to maximize this exact reward signal?" before trusting a shaped reward.

**Q: Should epsilon stay constant throughout training?**
A: No — decay it over time. High epsilon early (exploration), low epsilon later (exploitation) is standard practice.

**Q: My tabular Q-table is too large for my problem — what now?**
A: Switch to Deep RL (function approximation with a neural network) — see the Deep Reinforcement Learning sheet.

**Q: Is RL the right tool whenever a problem "can" be framed sequentially?**
A: No — if labeled "correct action" data is available, supervised learning is more sample-efficient. Reserve RL for cases where trial-and-error is genuinely necessary.
