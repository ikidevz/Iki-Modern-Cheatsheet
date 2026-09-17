# RAG & Vector Search Cheatsheet

## Overview

Retrieval-Augmented Generation grounds an LLM's output in retrieved documents rather than relying solely on what it memorized during training — the practical fix for hallucination and stale knowledge. This sheet covers the full pipeline: chunking, embedding, indexing, retrieval, and the failure modes that determine whether a RAG system actually works or just looks like it does in a demo.

```bash
pip install sentence-transformers chromadb rank-bm25 --break-system-packages
```

---

## 1. Why RAG

An LLM's parametric knowledge is frozen at training time and can't reliably cite specifics it wasn't trained on (your company's internal docs, this morning's news, a proprietary codebase). RAG retrieves relevant text at query time and inserts it into the context window, so the model generates from source material it can (in principle) be checked against — rather than from an internal, unverifiable "memory."

```
User query → [Retriever] → relevant chunks → [LLM generates answer using those chunks as context]
```

This does **not** eliminate hallucination entirely — a model can still misread or misuse retrieved context — but it substantially reduces confabulation about facts the retrieved documents actually contain, and it makes answers auditable (you can check the retrieved source).

---

## 2. Document Chunking

```python
def fixed_size_chunking(text, chunk_size=500, overlap=50):
    """Simple sliding-window chunking with overlap to avoid cutting relevant context at boundaries."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap  # overlap ensures continuity across chunk boundaries
    return chunks

def semantic_chunking(text, sentences_per_chunk=5):
    """Chunk along sentence boundaries instead of raw character counts — avoids splitting mid-sentence."""
    import re
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [
        " ".join(sentences[i:i + sentences_per_chunk])
        for i in range(0, len(sentences), sentences_per_chunk)
    ]

sample_text = "..." * 100  # your document text
chunks = semantic_chunking(sample_text, sentences_per_chunk=5)
print(f"Produced {len(chunks)} chunks")
```

**Effect on retrieval relevance:**
- **Too small** (e.g., single sentences): chunks lack context to be individually meaningful, and you need more chunks to cover an idea — increasing noise in retrieval.
- **Too large** (e.g., whole documents): a chunk relevant to only one sentence's worth of the query still drags in a lot of irrelevant text, diluting the embedding and wasting context window.
- **Structure-aware chunking** (by section headers, paragraphs, or semantic similarity between adjacent sentences) generally beats naive fixed-size splitting for real documents.

---

## 3. Embedding Models and Similarity Search

```python
from sentence_transformers import SentenceTransformer
import numpy as np

embedder = SentenceTransformer("all-MiniLM-L6-v2")  # fast, solid general-purpose choice

documents = [
    "The return policy allows refunds within 30 days of purchase.",
    "Our premium plan includes priority customer support.",
    "Shipping typically takes 3-5 business days within the country.",
]
doc_embeddings = embedder.encode(documents, normalize_embeddings=True)

query = "How long do I have to return an item?"
query_embedding = embedder.encode(query, normalize_embeddings=True)

# Cosine similarity — since embeddings are normalized, this is just a dot product
similarities = doc_embeddings @ query_embedding
best_match_idx = np.argmax(similarities)
print(f"Best match: '{documents[best_match_idx]}' (score: {similarities[best_match_idx]:.3f})")
```

### Approximate nearest neighbor (ANN) indexes

Brute-force similarity search is O(n) per query — fine for thousands of chunks, too slow for millions. ANN indexes like **HNSW** (Hierarchical Navigable Small World graphs) trade a small amount of recall for massive speedups by organizing embeddings into a searchable graph structure instead of scanning every vector.

```python
import chromadb

client = chromadb.Client()
collection = client.create_collection("docs")  # uses HNSW under the hood by default

collection.add(
    documents=documents,
    embeddings=doc_embeddings.tolist(),
    ids=[f"doc_{i}" for i in range(len(documents))],
)

results = collection.query(query_embeddings=[query_embedding.tolist()], n_results=2)
print(results["documents"])
```

---

## 4. Vector Databases

| Option | Good for |
|---|---|
| `pgvector` (Postgres extension) | Already running Postgres, want vectors alongside relational data, moderate scale |
| Chroma / FAISS (local) | Prototyping, small-to-medium datasets, no separate infrastructure |
| Pinecone / Weaviate / Qdrant (managed/dedicated) | Production scale, need managed infra, advanced filtering, high query throughput |

**When a plain index is enough:** for a few thousand to low tens of thousands of chunks, an in-memory FAISS index or a simple `pgvector` column often outperforms the operational overhead of standing up a dedicated vector database. Reach for a dedicated vector DB when you need horizontal scaling, high query-per-second throughput, real-time upserts at scale, or advanced metadata filtering combined with vector search.

---

## 5. Hybrid Search: Keyword + Vector

Pure vector search can miss exact-match cases (a specific product SKU, an error code, an acronym) that a keyword search handles trivially — and vice versa, keyword search misses semantically related but differently-worded content. Hybrid search combines both.

```python
from rank_bm25 import BM25Okapi

tokenized_docs = [doc.lower().split() for doc in documents]
bm25 = BM25Okapi(tokenized_docs)

def hybrid_search(query, top_k=2, alpha=0.5):
    """alpha weights vector score vs. BM25 score — tune based on your corpus/query mix."""
    query_emb = embedder.encode(query, normalize_embeddings=True)
    vector_scores = doc_embeddings @ query_emb
    vector_scores = (vector_scores - vector_scores.min()) / (vector_scores.max() - vector_scores.min() + 1e-9)

    bm25_scores = np.array(bm25.get_scores(query.lower().split()))
    bm25_scores = (bm25_scores - bm25_scores.min()) / (bm25_scores.max() - bm25_scores.min() + 1e-9)

    combined_scores = alpha * vector_scores + (1 - alpha) * bm25_scores
    top_indices = np.argsort(combined_scores)[::-1][:top_k]
    return [(documents[i], combined_scores[i]) for i in top_indices]

for doc, score in hybrid_search("30 day refund window"):
    print(f"{score:.3f}: {doc}")
```

---

## 6. Common Failure Modes

- **Irrelevant retrieval**: the top-k chunks returned don't actually address the query — often due to poor chunking, a mismatched embedding model (e.g., using a model not tuned for your domain's vocabulary), or a query phrased very differently from how the source documents phrase the same concept.
- **Context stuffing**: cramming in the top-20 retrieved chunks "just in case" dilutes the model's attention and increases the chance it ignores or misweights the actually-relevant chunk (compounding the "lost in the middle" effect described in the LLM Fundamentals sheet). Retrieve fewer, more precisely relevant chunks over more, loosely relevant ones.
- **Evaluating retrieval and generation together, conflated**: if the final answer is wrong, is it because retrieval missed the right chunk, or because generation misused a chunk that WAS retrieved correctly? Evaluate these separately:

```python
def evaluate_retrieval_only(retriever, eval_queries_with_gold_docs, k=5):
    """Measures whether the RIGHT document was retrieved, independent of what the LLM does with it."""
    hits = 0
    for query, gold_doc_id in eval_queries_with_gold_docs:
        retrieved_ids = retriever.search(query, top_k=k)
        if gold_doc_id in retrieved_ids:
            hits += 1
    return hits / len(eval_queries_with_gold_docs)  # this is "recall@k"

# Only after confirming retrieval quality is solid should you debug generation quality separately,
# e.g. by manually inspecting cases where the correct chunk WAS retrieved but the answer was still wrong
```

## Common Pitfalls

- **Chunking without overlap** — relevant context that spans a chunk boundary gets split and neither half retrieves well on its own.
- **Using a general-purpose embedding model on highly specialized/technical text** (legal, medical, code) without checking whether a domain-specific or fine-tuned embedding model would retrieve meaningfully better.
- **Retrieving too many chunks "for safety"** — degrades generation quality via context dilution rather than improving it.
- **Never re-evaluating retrieval quality as the underlying document corpus grows** — an embedding model and chunking strategy that worked well on a small corpus can degrade as more (and more similar) documents are added, increasing near-duplicate competition for the top-k slots.
- **Conflating a generation failure with a retrieval failure** — always check whether the right chunk was retrieved before concluding the LLM "hallucinated."

---

## 7. End-to-End Worked Example: A Complete RAG Pipeline From Documents to Answer

```python
from sentence_transformers import SentenceTransformer
import numpy as np
from anthropic import Anthropic

client = Anthropic()
embedder = SentenceTransformer("all-MiniLM-L6-v2")

# 1. A small internal knowledge base (in practice, loaded from real documents)
knowledge_base = [
    "Our standard return policy allows returns within 30 days of delivery for a full refund.",
    "Premium members get free returns within 60 days instead of the standard 30.",
    "Digital products and gift cards are non-refundable once redeemed.",
    "Shipping costs are non-refundable unless the return is due to our error.",
    "International orders have a 45-day return window due to longer transit times.",
]

# 2. Chunk (already short here) and embed
kb_embeddings = embedder.encode(knowledge_base, normalize_embeddings=True)

def retrieve(query, top_k=2):
    query_embedding = embedder.encode(query, normalize_embeddings=True)
    scores = kb_embeddings @ query_embedding
    top_indices = np.argsort(scores)[::-1][:top_k]
    return [(knowledge_base[i], float(scores[i])) for i in top_indices]

def answer_with_rag(query):
    retrieved = retrieve(query, top_k=2)
    context = "\n".join(f"- {doc}" for doc, score in retrieved)

    prompt = f"""Answer the question using ONLY the context below. If the context doesn't
contain enough information, say so explicitly rather than guessing.

Context:
{context}

Question: {query}

Answer:"""

    response = client.messages.create(
        model="claude-sonnet-4-6", max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text, retrieved

query = "I'm a premium member with an international order, how long do I have to return it?"
answer, sources = answer_with_rag(query)
print(f"Answer: {answer}")
print(f"\nRetrieved sources (score):")
for doc, score in sources:
    print(f"  [{score:.3f}] {doc}")
```

**Why this example is deliberately tricky:** the query combines TWO relevant facts (premium membership AND international shipping) that live in two separate knowledge base entries with somewhat conflicting return windows (60 days vs. 45 days) — a well-built RAG system needs to retrieve both relevant chunks and let the model reason about how they interact, rather than naively applying just one. This is exactly the kind of case worth including in a retrieval evaluation set (see section 6 of the base sheet).

---

## 8. Advanced & Lesser-Known Techniques

- **Query rewriting / expansion**: before embedding the user's raw query, use an LLM to rewrite it into a more retrieval-friendly form (expanding abbreviations, resolving pronouns from conversation history, or generating multiple paraphrased versions to retrieve with and merge) — often meaningfully improves recall for conversational or under-specified queries.
- **HyDE (Hypothetical Document Embeddings)**: instead of embedding the query directly, first ask an LLM to generate a *hypothetical answer* to the query, then embed and search with THAT — since a hypothetical answer's embedding is often closer to a real relevant document's embedding than the original (often shorter, differently-phrased) query would be.
- **Re-ranking**: retrieve a larger initial candidate set (e.g., top 20) with a fast embedding-based search, then re-score that smaller set with a more expensive but more accurate cross-encoder model that jointly processes the query and each candidate — combines the speed of vector search with the precision of a heavier model, applied only to a manageable candidate set.
- **Parent-child chunking**: index small, precise chunks for retrieval matching, but return their larger enclosing "parent" chunk (a full paragraph or section) as the actual context fed to the LLM — combines precise retrieval with sufficient surrounding context for the generator.

```python
# Simplified re-ranking sketch
from sentence_transformers import CrossEncoder

cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

def retrieve_and_rerank(query, initial_k=10, final_k=3):
    initial_candidates = retrieve(query, top_k=initial_k)
    pairs = [[query, doc] for doc, _ in initial_candidates]
    rerank_scores = cross_encoder.predict(pairs)
    reranked = sorted(zip(initial_candidates, rerank_scores), key=lambda x: -x[1])
    return [doc for (doc, _), _ in reranked[:final_k]]
```

---

## 9. Practice Exercises

1. Extend the worked example's knowledge base with 10+ more entries, including some deliberately similar/overlapping ones, and evaluate retrieval recall@2 on a hand-written set of 10 test queries with known correct source documents.
2. Implement HyDE for one query in the example above (generate a hypothetical answer, embed it, retrieve with it) and compare the retrieved documents against retrieving with the raw query embedding.
3. Implement the parent-child chunking pattern: split documents into small sentence-level chunks for indexing, but track and return the full source document as context — compare answer quality against sentence-only context.
4. Add a cross-encoder re-ranking step to the pipeline and measure how often the top-1 re-ranked result differs from the top-1 pure vector-search result.
5. Deliberately construct a query the knowledge base cannot answer, and verify whether the RAG prompt's explicit "say so if you don't know" instruction actually prevents a hallucinated answer — try this with and without that instruction to see the difference.

---

## 10. More Examples

### Example: Metadata filtering combined with vector search

```python
import chromadb

client = chromadb.Client()
collection = client.create_collection("support_docs")

collection.add(
    documents=["Return policy for electronics.", "Return policy for clothing.", "Shipping info for international orders."],
    embeddings=[[0.1]*384, [0.15]*384, [0.9]*384],  # stand-in embeddings
    metadatas=[{"category": "returns", "region": "US"}, {"category": "returns", "region": "US"}, {"category": "shipping", "region": "international"}],
    ids=["doc1", "doc2", "doc3"],
)

# Combine vector similarity with a hard metadata constraint — common in real systems
# where a query should only search within a specific category or the user's region
results = collection.query(
    query_embeddings=[[0.12]*384],
    where={"category": "returns"},  # metadata filter applied BEFORE/alongside vector ranking
    n_results=2,
)
print(results["documents"])
```

### Example: Multi-query retrieval — searching with several rephrasings and merging results

```python
from sentence_transformers import SentenceTransformer
import numpy as np

embedder = SentenceTransformer("all-MiniLM-L6-v2")
documents = ["Refunds are processed within 5-7 business days.", "Contact support for order issues.", "Free shipping on orders over $50."]
doc_embeddings = embedder.encode(documents, normalize_embeddings=True)

def multi_query_retrieve(query_variants, top_k=2):
    all_scores = np.zeros(len(documents))
    for query in query_variants:
        q_emb = embedder.encode(query, normalize_embeddings=True)
        all_scores += doc_embeddings @ q_emb  # accumulate scores across rephrasings
    top_indices = np.argsort(all_scores)[::-1][:top_k]
    return [documents[i] for i in top_indices]

# An LLM could generate these variants automatically from one original user query
query_variants = ["how long for a refund", "when will I get my money back", "refund processing time"]
print(multi_query_retrieve(query_variants))
```

### Example: Incremental index updates without full re-indexing

```python
import chromadb

client = chromadb.Client()
collection = client.get_or_create_collection("live_kb")

# Adding a new document to an EXISTING index — no need to rebuild from scratch
collection.add(documents=["New policy: extended holiday returns through January 31."], ids=["doc_new_1"])

# Updating an existing document when content changes
collection.update(ids=["doc_new_1"], documents=["Updated: extended holiday returns through February 15."])

# Deleting outdated content
collection.delete(ids=["doc_new_1"])
```

---

## 11. Quick-Reference Cheat-Table

| Scale | Recommendation |
|---|---|
| Few thousand chunks | In-memory FAISS or `pgvector` |
| Large scale, high QPS | Dedicated vector DB (Pinecone/Weaviate/Qdrant) |
| Need exact keyword matches too | Hybrid search (vector + BM25) |
| Need highest precision on top results | Retrieve wide, re-rank with a cross-encoder |
| Query differs greatly from document phrasing | HyDE or query rewriting |
| Need full source context, not just a snippet | Parent-child chunking |

## 12. FAQ

**Q: Why is my RAG system still hallucinating despite retrieval?**
A: RAG reduces but doesn't eliminate hallucination — the model can still misread or over-generalize from retrieved context. Add explicit "say so if you don't know" instructions and citation checking.

**Q: How many chunks should I retrieve per query?**
A: Fewer, more precisely relevant chunks generally beat more, loosely relevant ones — context stuffing dilutes attention and can hurt more than help.

**Q: My retrieval looks fine but answers are still wrong — what's broken?**
A: Evaluate retrieval and generation separately. If the right chunk WAS retrieved but the answer is still wrong, that's a generation problem, not a retrieval problem.

**Q: Fixed-size or semantic chunking — which should I use?**
A: Semantic/structure-aware chunking (by paragraph, section) generally retrieves better than naive fixed-size splitting, especially for real documents with meaningful structure.

**Q: Do I need a dedicated vector database from day one?**
A: No — for small-to-medium datasets, a simple FAISS index or `pgvector` column is often sufficient and much less operational overhead.
