# NLP Fundamentals Cheatsheet

## Overview

This sheet covers the pipeline that turns raw text into something a model can consume — tokenization, classical representations, embeddings, and a practical (not mathematical) overview of transformers via Hugging Face. For a deeper dive into the attention mechanism itself, see the Sequence Models & Attention sheet.

```bash
pip install transformers scikit-learn nltk --break-system-packages
```

---

## 1. Tokenization Approaches

| Approach | Unit | Vocabulary size | Handles unseen words? |
|---|---|---|---|
| Word-level | Whole words | Large (100k+) | No — out-of-vocabulary words become `<UNK>` |
| Character-level | Individual characters | Tiny (~100) | Yes, but loses word-level structure, long sequences |
| Subword (BPE/WordPiece) | Frequent character sequences | Moderate (30k-100k) | Yes — unseen words split into known subword pieces |

Subword tokenization is the modern default (used by BERT, GPT, and nearly every current LLM) because it handles rare/unseen words gracefully without exploding vocabulary size or sequence length.

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")  # WordPiece

text = "Tokenization handles unfamiliarwordxyz gracefully."
tokens = tokenizer.tokenize(text)
print(tokens)
# Note the unfamiliar word gets split into known subword pieces, e.g.:
# ['token', '##ization', 'handles', 'unf', '##ami', '##liar', '##word', '##xy', '##z', 'gracefully', '.']

ids = tokenizer.encode(text)
print(f"Token IDs: {ids}")
print(f"Decoded back: {tokenizer.decode(ids)}")
```

**BPE (Byte-Pair Encoding) vs. WordPiece:** both iteratively merge frequent character pairs into subword units. BPE (used by GPT models) merges purely based on frequency; WordPiece (used by BERT) merges based on which pair most increases the training data's likelihood under a language model — a subtle difference in practice, but both solve the same OOV problem.

---

## 2. Text Preprocessing

```python
import re
import nltk
from nltk.corpus import stopwords
from nltk.stem import PorterStemmer, WordNetLemmatizer

# nltk.download('stopwords'); nltk.download('wordnet')  # one-time setup

text = "The runners were running rapidly toward the finish lines."
words = re.findall(r"\b\w+\b", text.lower())

stop_words = set(stopwords.words("english"))
words_no_stop = [w for w in words if w not in stop_words]
print("After stopword removal:", words_no_stop)

stemmer = PorterStemmer()
stemmed = [stemmer.stem(w) for w in words_no_stop]
print("Stemmed:      ", stemmed)  # crude, rule-based chopping: "running" -> "run", "rapidly" -> "rapidli"

lemmatizer = WordNetLemmatizer()
lemmatized = [lemmatizer.lemmatize(w, pos="v") for w in words_no_stop]
print("Lemmatized:   ", lemmatized)  # dictionary-aware: "running" -> "run", correctly
```

**When to skip preprocessing entirely:** modern transformer-based models are trained on raw(ish) text and already handle casing, stopwords, and morphology implicitly through subword tokenization and learned embeddings. Aggressive stemming/stopword removal is mostly relevant for classical bag-of-words/TF-IDF pipelines — applying it before a BERT-style model usually *hurts* performance by destroying information the model would otherwise use.

---

## 3. TF-IDF and Bag-of-Words

Still a legitimate, fast, interpretable baseline — don't reach for a transformer before trying this.

```python
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer

corpus = [
    "the cat sat on the mat",
    "the dog sat on the log",
    "cats and dogs are great pets",
]

# Bag-of-words: raw counts
bow = CountVectorizer()
bow_matrix = bow.fit_transform(corpus)
print("Vocabulary:", bow.get_feature_names_out())
print("BoW matrix:\n", bow_matrix.toarray())

# TF-IDF: downweights words common across all documents (like "the"), upweights distinctive ones
tfidf = TfidfVectorizer()
tfidf_matrix = tfidf.fit_transform(corpus)
print("\nTF-IDF matrix:\n", tfidf_matrix.toarray().round(2))
```

**Why TF-IDF often beats raw counts:** a word like "the" appears in every document and carries no discriminative signal — TF-IDF's inverse-document-frequency term automatically suppresses it, while a rare, topic-specific word gets amplified.

---

## 4. Word Embeddings vs. Contextual Embeddings

| | Word2Vec / GloVe | Contextual (BERT, etc.) |
|---|---|---|
| One vector per word? | Yes — fixed, regardless of context | No — same word gets different vectors depending on sentence |
| Handles polysemy ("bank" = river bank vs. financial bank)? | No | Yes |
| Training | Predict context from word (or vice versa) | Masked language modeling / next-token prediction on huge corpora |
| Typical use today | Fast, cheap baselines, low-resource settings | Default choice when compute allows |

```python
# Static embeddings: "bank" gets ONE vector no matter the sentence
# (illustrative — requires downloading pretrained vectors)
# from gensim.models import KeyedVectors
# word2vec = KeyedVectors.load_word2vec_format("GoogleNews-vectors.bin", binary=True)
# print(word2vec.most_similar("king", topn=5))

# Contextual embeddings: "bank" gets a DIFFERENT vector depending on context
from transformers import AutoTokenizer, AutoModel
import torch

tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
model = AutoModel.from_pretrained("bert-base-uncased")

def get_word_embedding(sentence, word):
    inputs = tokenizer(sentence, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs)
    tokens = tokenizer.convert_ids_to_tokens(inputs["input_ids"][0])
    word_idx = tokens.index(word)
    return outputs.last_hidden_state[0, word_idx]

emb_river = get_word_embedding("I sat by the river bank fishing.", "bank")
emb_money = get_word_embedding("I deposited money at the bank.", "bank")
similarity = torch.cosine_similarity(emb_river.unsqueeze(0), emb_money.unsqueeze(0))
print(f"Cosine similarity between the two 'bank' embeddings: {similarity.item():.3f}")
# Expect a moderate similarity, NOT ~1.0 — the two senses of "bank" get distinguishable vectors
```

---

## 5. Transformers Overview

### Attention intuition
Attention lets every token in a sequence directly look at every other token and decide how much to "attend" to it, rather than passing information sequentially through a chain (as in an RNN). This is what allows transformers to capture long-range dependencies efficiently and to parallelize training across the whole sequence at once. See the **Sequence Models & Attention** sheet for the query/key/value mechanics.

### Encoder vs. decoder models

| Type | Examples | Good at | Attention pattern |
|---|---|---|---|
| Encoder-only | BERT, RoBERTa | Classification, embeddings, extraction | Bidirectional — sees the whole input at once |
| Decoder-only | GPT family, LLaMA | Text generation | Causal/masked — each token only sees previous tokens |
| Encoder-decoder | T5, BART | Translation, summarization | Encoder is bidirectional, decoder is causal + attends to encoder output |

---

## 6. Practical Use of Pretrained Models via Hugging Face

```python
from transformers import pipeline

# Sentiment classification — zero setup, pretrained model + tokenizer bundled
classifier = pipeline("sentiment-analysis")
result = classifier("This cheatsheet is actually pretty useful.")
print(result)

# Sentence embeddings for downstream tasks (search, clustering, classification features)
from transformers import AutoTokenizer, AutoModel
import torch.nn.functional as F

def mean_pooling(model_output, attention_mask):
    token_embeddings = model_output.last_hidden_state
    mask = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    return torch.sum(token_embeddings * mask, 1) / torch.clamp(mask.sum(1), min=1e-9)

sentences = ["Machine learning is fascinating.", "I love studying neural networks."]
tok = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
mdl = AutoModel.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")

encoded = tok(sentences, padding=True, truncation=True, return_tensors="pt")
with torch.no_grad():
    model_output = mdl(**encoded)
embeddings = mean_pooling(model_output, encoded["attention_mask"])
embeddings = F.normalize(embeddings, p=2, dim=1)  # normalize for cosine similarity

similarity = torch.cosine_similarity(embeddings[0].unsqueeze(0), embeddings[1].unsqueeze(0))
print(f"Sentence similarity: {similarity.item():.3f}")
```

## Common Pitfalls

- **Aggressively stemming/removing stopwords before a transformer model** — destroys information the model would otherwise use effectively.
- **Treating word embeddings as context-independent** when using a model like BERT — the whole point of contextual embeddings is that the same word gets different vectors in different sentences.
- **Truncating without checking sequence length limits** — silently cutting off the end of long documents can drop the most important content depending on where it appears.
- **Using an encoder-only model (BERT) for generation** or a decoder-only model (GPT) for tasks that need bidirectional context (like fill-in-the-blank classification) — match the architecture to the task.
- **Forgetting to normalize embeddings before cosine similarity** — unnormalized vectors can make similarity scores misleading.

---

## 7. End-to-End Worked Example: Building a Text Classifier Two Ways (TF-IDF vs. Transformer)

```python
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score

# Synthetic labeled text data — pretend these are support tickets
texts = [
    "My package never arrived and tracking shows no updates",
    "The app crashes every time I try to log in",
    "I love how fast shipping was, thank you!",
    "Billing charged me twice for the same order",
    "Great customer service, resolved my issue quickly",
    "App keeps freezing on the checkout screen",
] * 50  # repeated for a larger toy dataset
labels = [0, 1, 2, 0, 2, 1] * 50  # 0=shipping, 1=technical, 2=positive_feedback

X_train, X_test, y_train, y_test = train_test_split(texts, labels, test_size=0.2, random_state=42, stratify=labels)

# --- Approach 1: classical TF-IDF + Logistic Regression baseline ---
tfidf = TfidfVectorizer(max_features=500, ngram_range=(1, 2), stop_words="english")
X_train_tfidf = tfidf.fit_transform(X_train)
X_test_tfidf = tfidf.transform(X_test)

baseline = LogisticRegression(max_iter=1000)
baseline.fit(X_train_tfidf, y_train)
baseline_preds = baseline.predict(X_test_tfidf)
print(f"TF-IDF baseline — accuracy: {accuracy_score(y_test, baseline_preds):.3f}, "
      f"macro F1: {f1_score(y_test, baseline_preds, average='macro'):.3f}")

# --- Approach 2: pretrained transformer embeddings + a lightweight classifier on top ---
from transformers import AutoTokenizer, AutoModel
import torch

tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
embed_model = AutoModel.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")

def embed_texts(text_list, batch_size=32):
    all_embeddings = []
    for i in range(0, len(text_list), batch_size):
        batch = text_list[i:i + batch_size]
        encoded = tokenizer(batch, padding=True, truncation=True, return_tensors="pt")
        with torch.no_grad():
            output = embed_model(**encoded)
        mask = encoded["attention_mask"].unsqueeze(-1).expand(output.last_hidden_state.size()).float()
        pooled = (output.last_hidden_state * mask).sum(1) / mask.sum(1).clamp(min=1e-9)
        all_embeddings.append(pooled)
    return torch.cat(all_embeddings).numpy()

X_train_emb = embed_texts(X_train)
X_test_emb = embed_texts(X_test)

transformer_classifier = LogisticRegression(max_iter=1000)
transformer_classifier.fit(X_train_emb, y_train)
transformer_preds = transformer_classifier.predict(X_test_emb)
print(f"Transformer embeddings — accuracy: {accuracy_score(y_test, transformer_preds):.3f}, "
      f"macro F1: {f1_score(y_test, transformer_preds, average='macro'):.3f}")
```

**Why run both:** on genuinely small, repetitive, or highly keyword-driven text, the TF-IDF baseline is often shockingly competitive — and it's orders of magnitude cheaper to train and serve. The transformer approach earns its cost on more nuanced text, paraphrased inputs, or when the training set is small but the pretrained model has "seen" similar semantic patterns during pretraining. Always run the cheap baseline first.

---

## 8. Advanced & Lesser-Known Techniques

- **Byte-level BPE** (used by GPT-family tokenizers): operates on raw UTF-8 bytes rather than Unicode characters, guaranteeing that *any* input string — including unusual scripts, emoji, or malformed text — can always be tokenized without an unknown-token fallback.
- **Sentence-level embeddings via pooling strategy choice**: mean pooling (used above) is a common default, but `[CLS]`-token pooling (using just the special classification token's final representation) or max pooling can perform better or worse depending on the specific pretrained model — always check what pooling strategy a given sentence-embedding model was actually trained/tuned with.
- **Domain-adaptive pretraining**: before fine-tuning a general-purpose model (like BERT) on a small labeled dataset, continuing the original masked-language-modeling pretraining objective on a large corpus of *unlabeled* in-domain text (e.g., legal documents, clinical notes) first can meaningfully improve downstream performance — often more impactful than architecture changes.
- **N-gram features for keyword-heavy tasks**: `TfidfVectorizer(ngram_range=(1,2))` captures short phrases ("not good" vs. "good" alone) that unigram bag-of-words misses entirely — a cheap upgrade before reaching for anything more complex.

---

## 9. Practice Exercises

1. Extend the worked example's dataset with more genuinely diverse, less repetitive examples (or a real public dataset like 20 Newsgroups) and compare the TF-IDF vs. transformer gap on realistic data.
2. Swap mean pooling for `[CLS]`-token pooling in the embedding function and compare downstream classifier accuracy.
3. Compute cosine similarity between embeddings of a word used in two very different senses (like "bank" in the sheet's example) using three different pretrained models — do all of them distinguish the senses equally well?
4. Add bigrams and trigrams to the TF-IDF vectorizer and identify (via the classifier's learned coefficients) which multi-word phrases carry the most predictive weight for each class.
5. Implement a simple keyword-based baseline (e.g., presence of "crash," "freeze," "bug" → technical) and compare its accuracy against both the TF-IDF and transformer approaches — how much of the classification task can trivial keyword matching solve on its own?

---

## 10. More Examples

### Example: Named entity recognition with a pretrained pipeline

```python
from transformers import pipeline

ner = pipeline("ner", aggregation_strategy="simple")
text = "Sarah Chen joined Anthropic in San Francisco last March."
entities = ner(text)
for entity in entities:
    print(f"{entity['word']}: {entity['entity_group']} (confidence: {entity['score']:.2f})")
```

### Example: Building a simple n-gram language model to understand what transformers replaced

```python
from collections import defaultdict, Counter
import random

def build_bigram_model(text):
    words = text.lower().split()
    bigrams = defaultdict(Counter)
    for w1, w2 in zip(words[:-1], words[1:]):
        bigrams[w1][w2] += 1
    return bigrams

def generate_from_bigrams(bigrams, start_word, length=10):
    current = start_word
    output = [current]
    for _ in range(length):
        if current not in bigrams:
            break
        next_word = random.choices(
            list(bigrams[current].keys()), weights=list(bigrams[current].values())
        )[0]
        output.append(next_word)
        current = next_word
    return " ".join(output)

corpus = "the cat sat on the mat the cat ran to the door the dog sat on the rug"
bigram_model = build_bigram_model(corpus)
print(generate_from_bigrams(bigram_model, "the"))
```

This toy bigram model illustrates the core autoregressive idea (predict the next word from context) that transformers scale up dramatically — from "context = 1 previous word" here to "context = thousands of previous tokens, weighted by learned attention" in a modern LLM.

### Example: Detecting language of a text before routing to a language-specific pipeline

```python
from transformers import pipeline

lang_detector = pipeline("text-classification", model="papluca/xlm-roberta-base-language-detection")
texts = ["Hello, how are you?", "Bonjour, comment allez-vous?", "Hola, ¿cómo estás?"]
for text in texts:
    result = lang_detector(text)[0]
    print(f"'{text}' -> {result['label']} (confidence: {result['score']:.2f})")
```

---

## 11. Quick-Reference Cheat-Table

| Task | Approach |
|---|---|
| Fast, interpretable baseline | TF-IDF + Logistic Regression |
| Handle unseen/rare words | Subword tokenization (BPE/WordPiece) |
| Same word, different meaning per context | Contextual embeddings (BERT-family) |
| Sentence/document similarity | Sentence-transformer embeddings + cosine similarity |
| Generation task | Decoder-only model (GPT-family) |
| Classification/extraction task | Encoder-only model (BERT-family) |
| Translation/summarization | Encoder-decoder model (T5/BART) |

## 12. FAQ

**Q: Should I always remove stopwords and stem my text?**
A: Only for classical bag-of-words/TF-IDF pipelines. For transformer-based models, skip this — it removes information the model would otherwise use.

**Q: Word2Vec or BERT embeddings — which should I use?**
A: BERT-style contextual embeddings almost always, unless you have strict latency/resource constraints where Word2Vec's simplicity and speed matter more than the accuracy gap.

**Q: My model can't classify a word it never saw during training — why?**
A: If you're using word-level tokenization, that word is likely `<UNK>`. Subword tokenization avoids this entirely by falling back to known sub-pieces.

**Q: Why do sentence embeddings need normalization before cosine similarity?**
A: Cosine similarity is about direction, not magnitude — without normalizing, embeddings with larger magnitude can distort similarity comparisons.

**Q: Can I use a BERT-style model to generate new text?**
A: Not naturally — BERT is bidirectional and trained for masked prediction, not left-to-right generation. Use a decoder-only (GPT-family) model for generation tasks.
