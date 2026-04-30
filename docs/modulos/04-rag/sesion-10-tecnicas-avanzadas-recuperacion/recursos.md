# Sesión 10 — Recursos

> Material complementario para profundizar S10. Organizado por técnica.

---

## Hybrid search y BM25

- **Robertson & Zaragoza (2009) — "The Probabilistic Relevance Framework: BM25 and Beyond".** El paper canónico de BM25. Lectura recomendada para entender de dónde sale la fórmula. [https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf)
- **PostgreSQL — Full Text Search.** Documentación oficial sobre `tsvector`, `to_tsvector`, `ts_rank_cd`, índices GIN. Lectura obligatoria si vas a operar hybrid en pgvector. [https://www.postgresql.org/docs/current/textsearch.html](https://www.postgresql.org/docs/current/textsearch.html)
- **Elastic — "Practical BM25".** Explicación visual con ejemplos. Útil aunque no uses Elasticsearch. [https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables](https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables)

## Reciprocal Rank Fusion

- **Cormack, Clarke & Buettcher (2009) — "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods".** El paper de 4 páginas que introdujo RRF. La referencia académica directa. [https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)
- **Microsoft Learn — "Hybrid search using RRF".** Doc operativa de Azure AI Search; útil porque muestra cómo RRF se aplica en sistemas reales. [https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking](https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking)

## Query rewriting y multi-query

- **LangChain — Multi-Query Retriever.** Documentación de la implementación más popular de multi-query rewriting. [https://js.langchain.com/docs/how_to/MultiQueryRetriever/](https://js.langchain.com/docs/how_to/MultiQueryRetriever/)
- **Ma et al. (2023) — "Query Rewriting for Retrieval-Augmented Large Language Models".** Paper que sistematiza la técnica. [arXiv:2305.14283](https://arxiv.org/abs/2305.14283)

## HyDE

- **Gao et al. (2022) — "Precise Zero-Shot Dense Retrieval without Relevance Labels".** El paper original de HyDE. Lectura corta, vale la pena. [arXiv:2212.10496](https://arxiv.org/abs/2212.10496)
- **LangChain — HyDE Retriever.** Implementación de referencia para ver cómo encaja en un pipeline de framework. [https://js.langchain.com/docs/integrations/retrievers/hyde/](https://js.langchain.com/docs/integrations/retrievers/hyde/)

## MMR (Maximum Marginal Relevance)

- **Carbonell & Goldstein (1998) — "The Use of MMR, Diversity-Based Reranking for Reordering Documents and Producing Summaries".** Paper original. Sigue siendo la referencia. [https://www.cs.cmu.edu/~jgc/publication/The_Use_MMR_Diversity_Based_LTMIR_1998.pdf](https://www.cs.cmu.edu/~jgc/publication/The_Use_MMR_Diversity_Based_LTMIR_1998.pdf)
- **LlamaIndex — MMR.** Implementación con explicación pedagógica de cuándo usarlo. [https://docs.llamaindex.ai/en/stable/module_guides/querying/retriever/](https://docs.llamaindex.ai/en/stable/module_guides/querying/retriever/)

## Comparativas y benchmarks

- **BEIR Benchmark.** Suite de benchmarks para retrieval. Útil para ver cómo rinde dense vs hybrid en tareas distintas. [https://github.com/beir-cellar/beir](https://github.com/beir-cellar/beir)
- **MTEB Leaderboard.** Ranking público de modelos de embeddings para retrieval. Útil para decidir cuándo cambiar de modelo de embeddings antes que sumar técnicas avanzadas. [https://huggingface.co/spaces/mteb/leaderboard](https://huggingface.co/spaces/mteb/leaderboard)

## Charlas y videos

- **"Advanced RAG Techniques" — LlamaIndex** (~25 min). Buen resumen práctico de todas las técnicas que vimos hoy más reranking. [https://www.youtube.com/watch?v=ZZ4QeR9OJZE](https://www.youtube.com/watch?v=ZZ4QeR9OJZE)
- **"Hybrid Search 101" — Pinecone** (~12 min). Visualización del problema de dense-only y cómo hybrid lo arregla. [https://www.pinecone.io/learn/hybrid-search-intro/](https://www.pinecone.io/learn/hybrid-search-intro/)

---

## Para tener en mente al avanzar

S11 va a llegar con reranking con cross-encoder, citas, control de alucinaciones y evaluación con RAGAS/Promptfoo. Las técnicas de hoy operan en el **retriever**; las de S11 operan **después del retriever** (filtrado y re-ordenamiento) y en la **evaluación** del sistema completo.

**Patrón mental:**
- S09 = bases del pipeline RAG.
- S10 = mejorar el retriever.
- S11 = mejorar la augmentation, la generation y la evaluación.
- M5 = cuando ese retriever se pone en función de un agente con tools.
