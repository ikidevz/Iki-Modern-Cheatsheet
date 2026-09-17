# Recommender Systems Cheatsheet

## Overview

Recommendation is a distinct ML problem shape: you're not predicting a single label, you're ranking a huge catalog for each user, usually from implicit signals (clicks, views) rather than clean explicit labels. This sheet covers collaborative filtering, matrix factorization, content-based approaches for cold-start, and the ranking-specific evaluation metrics that make this different from a standard classifier.

```bash
pip install scikit-surprise scipy scikit-learn --break-system-packages
```

---

## 1. Collaborative Filtering: User-Based vs. Item-Based

Collaborative filtering recommends based on patterns of behavior across many users, without needing to understand *why* users like what they like.

```python
import numpy as np
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity

# User-item rating matrix (rows = users, columns = items), 0 = not rated
ratings = np.array([
    [5, 3, 0, 1],
    [4, 0, 0, 1],
    [1, 1, 0, 5],
    [1, 0, 0, 4],
    [0, 1, 5, 4],
])

# --- User-based: find similar USERS, recommend what they liked ---
user_similarity = cosine_similarity(ratings)
print("User similarity matrix:\n", user_similarity.round(2))

def user_based_predict(ratings, user_similarity, user_idx, item_idx):
    sims = user_similarity[user_idx]
    item_ratings = ratings[:, item_idx]
    rated_mask = item_ratings > 0
    if rated_mask.sum() == 0:
        return 0
    return np.dot(sims[rated_mask], item_ratings[rated_mask]) / np.sum(np.abs(sims[rated_mask]))

# --- Item-based: find similar ITEMS, recommend items similar to what the user already liked ---
item_similarity = cosine_similarity(ratings.T)

def item_based_predict(ratings, item_similarity, user_idx, item_idx):
    user_ratings = ratings[user_idx]
    sims = item_similarity[item_idx]
    rated_mask = user_ratings > 0
    if rated_mask.sum() == 0:
        return 0
    return np.dot(sims[rated_mask], user_ratings[rated_mask]) / np.sum(np.abs(sims[rated_mask]))

print(f"User-based prediction (user 0, item 2): {user_based_predict(ratings, user_similarity, 0, 2):.2f}")
print(f"Item-based prediction (user 0, item 2): {item_based_predict(ratings, item_similarity, 0, 2):.2f}")
```

**Why item-based tends to scale better:** the number of items is usually far more stable than the number of users (a catalog grows slowly; users churn constantly), so item-item similarity can be precomputed and cached, refreshed periodically rather than recomputed per-request. User-user similarity, by contrast, needs to account for a constantly shifting, much larger user base, making it harder to precompute efficiently at scale.

---

## 2. Matrix Factorization

Matrix factorization decomposes the sparse user-item matrix into two smaller dense matrices — a latent factor vector per user and per item — such that their product approximates the observed ratings, and generalizes to the unobserved ones.

```python
import numpy as np

def matrix_factorization_sgd(R, n_factors=5, n_epochs=100, lr=0.01, reg=0.02):
    n_users, n_items = R.shape
    P = np.random.normal(0, 0.1, (n_users, n_factors))  # user latent factors
    Q = np.random.normal(0, 0.1, (n_items, n_factors))  # item latent factors

    for epoch in range(n_epochs):
        for u in range(n_users):
            for i in range(n_items):
                if R[u, i] > 0:  # only train on OBSERVED ratings
                    error = R[u, i] - P[u] @ Q[i]
                    # Gradient step with L2 regularization to prevent overfitting to sparse observations
                    P[u] += lr * (error * Q[i] - reg * P[u])
                    Q[i] += lr * (error * P[u] - reg * Q[i])
    return P, Q

P, Q = matrix_factorization_sgd(ratings, n_factors=3, n_epochs=200)
predicted_ratings = P @ Q.T
print("Predicted full rating matrix:\n", predicted_ratings.round(2))
```

### SVD, ALS, and implicit vs. explicit feedback

| | Explicit feedback | Implicit feedback |
|---|---|---|
| Signal | Star ratings, thumbs up/down | Clicks, views, purchases, watch time |
| Interpretation | Direct preference statement | Signal of interest, but absence ≠ dislike (could just mean "not seen") |
| Common algorithm | SVD, SGD-based matrix factorization (as above) | ALS (Alternating Least Squares) with a confidence-weighted loss |

```python
# ALS is well-suited to implicit feedback: instead of predicting a rating,
# it predicts a "preference" (1 if interacted, 0 if not) weighted by a confidence score
# derived from interaction strength (e.g., number of times clicked/watched)
def implicit_confidence(interaction_count, alpha=40):
    return 1 + alpha * interaction_count  # more interactions -> higher confidence in inferred preference
```

**Why implicit feedback needs different handling:** with explicit ratings, a missing entry simply means "not rated" — genuinely unknown. With implicit feedback, a missing entry (no click) is ambiguous: it could mean the user isn't interested, OR that the item was never shown to them. ALS-based implicit models handle this by treating all unobserved interactions as *weak negative* signal, weighted by a confidence term rather than the observed/unobserved binary being taken at face value.

---

## 3. Content-Based Filtering for Cold-Start

Collaborative filtering has no signal for a new user (no interaction history) or a new item (no one has interacted with it yet) — the classic "cold-start" problem. Content-based filtering sidesteps this by using item/user attributes directly.

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Represent items by their content/attributes (e.g., product descriptions)
item_descriptions = [
    "wireless bluetooth headphones noise cancelling",
    "wired gaming headset with microphone",
    "bluetooth speaker portable waterproof",
    "wireless earbuds sport running",
]

tfidf = TfidfVectorizer()
item_features = tfidf.fit_transform(item_descriptions)
item_content_similarity = cosine_similarity(item_features)

def recommend_similar_items(item_idx, similarity_matrix, top_k=2):
    scores = similarity_matrix[item_idx]
    similar_indices = np.argsort(scores)[::-1][1:top_k+1]  # exclude the item itself
    return similar_indices

print(f"Items similar to item 0: {recommend_similar_items(0, item_content_similarity)}")
# A brand-new item with a similar description gets recommended immediately — no interaction
# history needed, solving the cold-start problem that pure collaborative filtering can't handle
```

---

## 4. Hybrid Approaches

Production systems almost always blend collaborative and content signals rather than picking one exclusively.

```python
def hybrid_score(collaborative_score, content_score, weight=0.7):
    """Simple weighted blend — weight collaborative signal higher once enough interaction data exists."""
    return weight * collaborative_score + (1 - weight) * content_score

def adaptive_hybrid_score(collaborative_score, content_score, user_interaction_count, threshold=10):
    """Adaptive blending: lean on content-based signal for cold-start users, collaborative signal for established ones."""
    weight = min(1.0, user_interaction_count / threshold)
    return weight * collaborative_score + (1 - weight) * content_score
```

This adaptive pattern — gradually shifting weight from content-based to collaborative signal as a user accumulates interaction history — is a common, practical way to handle the cold-start-to-warm-start transition smoothly rather than switching abruptly between two separate systems.

---

## 5. Evaluation: precision@k, recall@k, NDCG

Standard regression/classification metrics don't fit ranking tasks — what matters is whether the *top* recommendations are good, not the accuracy of every predicted score.

```python
def precision_at_k(recommended_items, relevant_items, k):
    recommended_k = recommended_items[:k]
    hits = len(set(recommended_k) & set(relevant_items))
    return hits / k

def recall_at_k(recommended_items, relevant_items, k):
    recommended_k = recommended_items[:k]
    hits = len(set(recommended_k) & set(relevant_items))
    return hits / len(relevant_items) if relevant_items else 0

def ndcg_at_k(recommended_items, relevant_items, k):
    """NDCG rewards relevant items MORE if they appear EARLIER in the ranking — order matters, not just presence."""
    dcg = sum(
        1 / np.log2(i + 2) for i, item in enumerate(recommended_items[:k]) if item in relevant_items
    )
    ideal_dcg = sum(1 / np.log2(i + 2) for i in range(min(k, len(relevant_items))))
    return dcg / ideal_dcg if ideal_dcg > 0 else 0

recommended = [3, 1, 5, 2, 4]
relevant = {1, 2, 5}

print(f"Precision@3: {precision_at_k(recommended, relevant, 3):.3f}")
print(f"Recall@3:    {recall_at_k(recommended, relevant, 3):.3f}")
print(f"NDCG@3:      {ndcg_at_k(recommended, relevant, 3):.3f}")
```

**Why plain RMSE misleads for ranking:** RMSE treats every rating prediction as equally important, but a recommender's actual job is to get the *top few* items right — a model can have excellent RMSE across the whole matrix while still ranking the best items 15th instead of 1st, which is what a user actually experiences as a bad recommendation. NDCG and precision/recall@k directly measure ranking quality where RMSE cannot.

---

## 6. Production Concerns

```
User request → [Candidate Generation: cheap, high-recall, narrows millions → hundreds]
             → [Ranking: expensive, high-precision model, scores hundreds → orders the top few]
             → Final recommendations shown to user
```

- **Candidate generation vs. ranking stages**: it's computationally infeasible to run an expensive, feature-rich ranking model against an entire catalog for every request. A fast, simpler candidate generation stage (e.g., ANN search over embeddings, or simple collaborative filtering) narrows the field first, and a heavier, more accurate ranking model (e.g., a gradient-boosted tree or neural ranker) only scores the much smaller candidate set.
- **Serving latency**: recommendation is almost always a real-time, user-facing request — precomputing embeddings/similarities offline and doing lightweight lookups at request time is standard; retraining the whole model synchronously per-request is not viable.

## Common Pitfalls

- **Treating implicit feedback (clicks) as if it were explicit preference (ratings)** — absence of a click doesn't mean dislike, and needs a confidence-weighted approach, not a naive missing-value fill.
- **Ignoring the cold-start problem** — pure collaborative filtering silently fails (or falls back to generic popularity) for new users/items unless a content-based or hybrid fallback exists.
- **Evaluating with RMSE instead of ranking metrics** — optimizes for the wrong thing relative to what users actually experience.
- **Skipping a separate candidate generation stage** and trying to rank the full catalog per-request — doesn't scale past small catalogs.
- **Popularity bias unchecked** — collaborative filtering can systematically over-recommend already-popular items, starving less popular (but potentially well-matched) items of exposure; worth explicitly monitoring catalog coverage, not just accuracy metrics.

---

## 7. End-to-End Worked Example: A Small Hybrid Recommender With Proper Train/Test Splitting

```python
import numpy as np
import pandas as pd

np.random.seed(42)
n_users, n_items = 50, 30

# Simulate implicit interactions (1 = interacted, 0 = no recorded interaction)
true_user_factors = np.random.normal(0, 1, (n_users, 5))
true_item_factors = np.random.normal(0, 1, (n_items, 5))
interaction_probs = 1 / (1 + np.exp(-(true_user_factors @ true_item_factors.T)))
interactions = (np.random.random((n_users, n_items)) < interaction_probs).astype(int)

# Leave-one-out split: for each user, hold out ONE interacted item as the test target —
# the standard evaluation protocol for implicit-feedback recommenders
def leave_one_out_split(interactions):
    train = interactions.copy()
    test_items = {}
    for user in range(interactions.shape[0]):
        interacted = np.where(interactions[user] == 1)[0]
        if len(interacted) > 1:
            held_out = np.random.choice(interacted)
            train[user, held_out] = 0
            test_items[user] = held_out
    return train, test_items

train_matrix, test_items = leave_one_out_split(interactions)

# Train ALS-style matrix factorization on the train matrix only
def als_implicit(R, n_factors=5, n_iterations=15, reg=0.1, alpha=40):
    n_users, n_items = R.shape
    P = np.random.normal(0, 0.1, (n_users, n_factors))
    Q = np.random.normal(0, 0.1, (n_items, n_factors))
    C = 1 + alpha * R  # confidence weighting: observed interactions get MUCH higher confidence

    for _ in range(n_iterations):
        for u in range(n_users):
            Cu = np.diag(C[u])
            A = Q.T @ Cu @ Q + reg * np.eye(n_factors)
            b = Q.T @ Cu @ R[u]
            P[u] = np.linalg.solve(A, b)
        for i in range(n_items):
            Ci = np.diag(C[:, i])
            A = P.T @ Ci @ P + reg * np.eye(n_factors)
            b = P.T @ Ci @ R[:, i]
            Q[i] = np.linalg.solve(A, b)
    return P, Q

P, Q = als_implicit(train_matrix)
predicted_scores = P @ Q.T

# Evaluate with recall@k: for each user, is the held-out item in their top-k recommendations?
def recall_at_k(predicted_scores, train_matrix, test_items, k=5):
    hits = 0
    for user, true_item in test_items.items():
        scores = predicted_scores[user].copy()
        scores[train_matrix[user] == 1] = -np.inf  # never recommend something already interacted with
        top_k = np.argsort(scores)[::-1][:k]
        hits += int(true_item in top_k)
    return hits / len(test_items)

print(f"Recall@5: {recall_at_k(predicted_scores, train_matrix, test_items, k=5):.3f}")
print(f"Recall@10: {recall_at_k(predicted_scores, train_matrix, test_items, k=10):.3f}")
```

**Why leave-one-out (not a random row/column split) is the standard protocol here:** a random split of the interaction matrix would remove information needed to even form a meaningful "history" for some users. Leave-one-out preserves each user's interaction history (minus one item) as training signal for their own latent factors, while still providing a clean, realistic held-out target to evaluate ranking quality against — closely mirroring the real deployment scenario of "given what we know about this user, would we have surfaced the thing they actually did next."

---

## 8. Advanced & Lesser-Known Techniques

- **Two-tower neural retrieval models**: replace matrix factorization with two separate neural networks — one embedding users (from their features/history), one embedding items — trained so that a dot product between the two towers approximates interaction likelihood. This generalizes matrix factorization to incorporate rich features (not just an ID) and is the standard candidate-generation architecture at large-scale recommendation systems.
- **Sequential/session-based recommendation**: instead of treating a user's history as an unordered set, model it as a *sequence* (using an RNN or transformer, as in the Sequence Models sheet) — captures the fact that recent behavior often predicts next action better than a static aggregate of all-time preferences.
- **Bandit-based exploration in recommendation**: pure exploitation of a trained model risks a feedback loop where the system only ever learns about items it already recommends. Multi-armed bandit techniques (Thompson sampling, UCB) deliberately inject controlled exploration into the ranking to keep gathering information about under-explored items.
- **Diversity and serendipity re-ranking**: after generating a ranked list purely by predicted relevance, a re-ranking step can explicitly trade off some relevance for diversity (avoiding an all-near-duplicate top-10) — directly optimizing for relevance alone tends to produce homogeneous, filter-bubble-prone recommendations.

---

## 9. Practice Exercises

1. Re-run the worked example with `alpha` (confidence weighting) set to 1, 10, and 100 — observe how it changes recall@k, and connect this to why confidence weighting matters more for implicit than explicit feedback.
2. Implement a simple popularity baseline (always recommend the globally most-interacted-with items, excluding what the user already interacted with) and compare its recall@k against the ALS model — how much is the learned model actually beating a trivial baseline?
3. Add a content-based cold-start fallback: for a "new user" with zero training interactions, recommend based on item popularity or content similarity to a stated preference, and integrate it with the adaptive hybrid weighting formula from this sheet.
4. Implement a diversity-aware re-ranking step (e.g., penalize items too similar to already-selected items in the top-k) and measure the relevance/diversity tradeoff quantitatively.
5. Compare precision@5 and recall@5 as you vary the number of latent factors from 2 to 20 — identify where additional factors stop improving performance (a sign of overfitting to the sparse training interactions).

---

## 10. More Examples

### Example: Session-based recommendation using recent activity only

```python
import numpy as np

def session_based_recommend(session_items, item_similarity_matrix, top_k=5):
    """Recommends based ONLY on the current session's items, not the user's full lifetime
    history — appropriate for anonymous users or when recent intent matters more than history."""
    scores = np.zeros(item_similarity_matrix.shape[0])
    for item in session_items:
        scores += item_similarity_matrix[item]
    scores[session_items] = -np.inf  # never re-recommend what's already in the session
    return np.argsort(scores)[::-1][:top_k]

item_similarity = np.random.rand(50, 50)
current_session = [3, 17, 22]  # items the anonymous user viewed in THIS session
recommendations = session_based_recommend(current_session, item_similarity)
print(f"Session-based recommendations: {recommendations}")
```

### Example: Diversifying recommendations with Maximal Marginal Relevance (MMR)

```python
import numpy as np

def mmr_rerank(candidate_scores, candidate_similarity, lambda_param=0.7, top_k=5):
    """Balances relevance against diversity: lambda=1 is pure relevance ranking,
    lambda=0 is pure diversity (ignoring relevance entirely)."""
    selected = []
    remaining = list(range(len(candidate_scores)))

    while len(selected) < top_k and remaining:
        mmr_scores = []
        for idx in remaining:
            relevance = candidate_scores[idx]
            diversity_penalty = max([candidate_similarity[idx][s] for s in selected], default=0)
            mmr_scores.append(lambda_param * relevance - (1 - lambda_param) * diversity_penalty)
        best_idx = remaining[np.argmax(mmr_scores)]
        selected.append(best_idx)
        remaining.remove(best_idx)
    return selected

scores = np.array([0.9, 0.85, 0.8, 0.75, 0.7])
similarity = np.random.rand(5, 5)
diverse_top5 = mmr_rerank(scores, similarity, lambda_param=0.6)
print(f"Diversified top-5 order: {diverse_top5}")
```

### Example: Cold-start new-item recommendation via content similarity fallback

```python
def recommend_for_new_item(new_item_embedding, existing_item_embeddings, existing_item_popularity, top_k=5):
    """A brand-new item has NO interaction history — bootstrap its initial exposure
    by finding similar existing items and borrowing their audience."""
    similarities = existing_item_embeddings @ new_item_embedding
    # Weight by both similarity AND the existing item's proven popularity/audience size
    weighted_scores = similarities * np.log1p(existing_item_popularity)
    similar_items = np.argsort(weighted_scores)[::-1][:top_k]
    return similar_items  # users who liked these are good initial candidates to show the new item to
```

---

## 11. Quick-Reference Cheat-Table

| Situation | Approach |
|---|---|
| New user, no history | Content-based fallback |
| New item, no interactions | Content similarity to existing items |
| Established users/items, implicit feedback | ALS matrix factorization |
| Established users/items, explicit ratings | SVD-based matrix factorization |
| Need ranking-quality evaluation | precision@k, recall@k, NDCG (not RMSE) |
| Avoid recommending only popular items | Diversity-aware re-ranking (MMR) |

## 12. FAQ

**Q: Why does RMSE look great but user experience seems poor?**
A: RMSE evaluates every prediction equally; recommendation quality depends on the TOP few results specifically. Use precision@k/NDCG instead.

**Q: Should I treat clicks the same as explicit ratings?**
A: No — implicit feedback (clicks) needs confidence-weighted approaches (ALS-style); absence of a click doesn't mean dislike, unlike an explicit low rating.

**Q: User-based or item-based collaborative filtering — which scales better?**
A: Item-based, generally — item catalogs are more stable than user bases, letting item-item similarity be precomputed and cached more easily.

**Q: How do I stop recommending the same popular items to everyone?**
A: Add diversity-aware re-ranking (MMR) after generating a relevance-ranked list, explicitly trading some relevance for catalog diversity.

**Q: Do I need a two-stage (candidate generation + ranking) architecture?**
A: For any catalog beyond a few thousand items, yes — scoring the full catalog with an expensive ranking model per request isn't feasible.
