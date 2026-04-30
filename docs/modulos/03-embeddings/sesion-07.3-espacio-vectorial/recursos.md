# Sesión 07.3 — Recursos complementarios

Material opcional sobre geometría del espacio vectorial, métricas, pre-procesamiento y casos de fallo.

---

## Lectura obligada (1 elemento)

- **Pinecone — _Why distance metrics matter for vector search_** — explicación clara de cuándo coseno, dot y L2 son equivalentes y cuándo no.
  - https://www.pinecone.io/learn/vector-similarity/

## Geometría del espacio vectorial

- **DeepLearning.AI — _Vector Databases: from Embeddings to Applications_** (curso corto, gratuito).
  - https://learn.deeplearning.ai/courses/vector-databases-embeddings-applications
- **Aggarwal et al., _On the Surprising Behavior of Distance Metrics in High Dimensional Space_** — referencia clásica sobre la curse of dimensionality aplicada a métricas.
  - https://bib.dbvis.de/uploadedFiles/155.pdf
- **Anisotropy of Embeddings — Ethayarajh, 2019** — análisis del problema de anisotropía en embeddings de transformers.
  - https://arxiv.org/abs/1909.00512

## Métricas y similitud

- **Sentence-Transformers — _Computing Sentence Embeddings_** — métricas y código de referencia.
  - https://www.sbert.net/docs/sentence_transformer/usage/semantic_textual_similarity.html
- **Faiss — Index types & metrics** — la doc de Faiss explica qué métrica conviene a qué índice.
  - https://github.com/facebookresearch/faiss/wiki/MetricType-and-distances

## Calibración de threshold

- **OpenAI — _Embedding-based search and threshold tuning_** (cookbook).
  - https://cookbook.openai.com/examples/clustering
- **Pinecone — _How to set the right similarity threshold_**
  - https://www.pinecone.io/learn/series/faiss/locality-sensitive-hashing/

## Pre-procesamiento (lo que SÍ y lo que NO)

- **Hugging Face — _Tokenizer behavior and casing_** — por qué un modelo cased trata "Apple" distinto a "apple".
  - https://huggingface.co/docs/transformers/main_classes/tokenizer
- **SBERT FAQ — _Should I lowercase my text?_**
  - https://www.sbert.net/docs/faq.html#do-i-need-to-lowercase-my-text
- **Stanford NLP — _The myth of stop words_** (artículo clásico que ya en 2018 cuestionaba removerlos).
  - https://nlp.stanford.edu/IR-book/html/htmledition/dropping-common-terms-stop-words-1.html

## Modos de fallo y hybrid search

- **Lewis et al., _Retrieval-Augmented Generation_** — paper original de RAG, contexto sobre las limitaciones del retrieval denso.
  - https://arxiv.org/abs/2005.11401
- **Pinecone — _Hybrid search: combining dense and sparse_** — patrón estándar.
  - https://www.pinecone.io/learn/hybrid-search-intro/
- **Reciprocal Rank Fusion (RRF) paper — Cormack et al., 2009**
  - https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf
- **Anthropic — _Contextual Retrieval_** — refinamiento de RAG con re-escritura de chunks.
  - https://www.anthropic.com/news/contextual-retrieval

## Negaciones y queries complejas

- **Hossain et al., _An Analysis of Natural Language Inference Benchmarks through the Lens of Negation_** — por qué los modelos densos manejan mal las negaciones.
  - https://aclanthology.org/2020.emnlp-main.732/

## Operacional

- **Weaviate — _Hybrid search with BM25 + vector_** — implementación práctica de fusión.
  - https://weaviate.io/blog/hybrid-search-explained
- **Vespa — _Why text preprocessing is dead for transformer-based search_**
  - https://blog.vespa.ai/from-research-to-production-scaling-a-state-of-the-art-machine-learning-system/

---

**Vuelve a:** [`README de la sesión`](README.md) · [`Curriculum maestro`](../../../00-curriculum.md)
