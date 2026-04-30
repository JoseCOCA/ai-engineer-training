# Sesión 08 — Recursos complementarios

Material opcional sobre bases de datos vectoriales, índices ANN, pgvector y comparativas.

---

## Lectura obligada (1 elemento)

- **pgvector — README oficial.** Lectura corta y completa: tipos, operadores, índices, parámetros.
  - https://github.com/pgvector/pgvector

## Índices ANN — los papers que importan

- **HNSW — Malkov & Yashunin, 2018.**
  - https://arxiv.org/abs/1603.09320
- **Faiss — Library for Efficient Similarity Search (Johnson et al., 2017)** — referencia integral de IVF, PQ, HNSW.
  - https://arxiv.org/abs/1702.08734
- **DiskANN — Microsoft, 2019** — ANN sobre disco en lugar de RAM, para corpus enormes.
  - https://www.microsoft.com/en-us/research/publication/diskann-fast-accurate-billion-point-nearest-neighbor-search-on-a-single-node/

## pgvector en profundidad

- **Supabase — _pgvector: Embeddings and Vector Similarity_** — guía aplicada con queries de ejemplo.
  - https://supabase.com/docs/guides/ai/vector-columns
- **Crunchy Data — _Tuning HNSW indexes in pgvector_** — `m`, `ef_construction`, `ef_search`.
  - https://www.crunchydata.com/blog/hnsw-indexes-with-postgres-and-pgvector
- **Postgres — `EXPLAIN ANALYZE` cheat sheet**
  - https://www.postgresql.org/docs/current/sql-explain.html

## Vector DBs alternativas

- **Qdrant — Documentation**
  - https://qdrant.tech/documentation/
- **Pinecone — Concepts and best practices**
  - https://docs.pinecone.io/guides/get-started/overview
- **Chroma**
  - https://docs.trychroma.com
- **Weaviate**
  - https://weaviate.io/developers/weaviate
- **Milvus / Zilliz Cloud**
  - https://milvus.io/docs

## Comparativas y benchmarks

- **ANN-Benchmarks** — el benchmark de referencia para comparar índices ANN open-source.
  - https://ann-benchmarks.com
- **Pinecone — _Vector database benchmarks_**
  - https://www.pinecone.io/learn/vector-database-benchmarks/
- **Qdrant — _Performance benchmarks vs pgvector / Weaviate / Milvus_**
  - https://qdrant.tech/benchmarks/

## Filtros + ANN — el problema operativo

- **Qdrant — _Filterable HNSW: how filters integrate into the search_**
  - https://qdrant.tech/articles/filtrable-hnsw/
- **pgvector — _Combining filters with vector search_** (issues + threads de discusión)
  - https://github.com/pgvector/pgvector/issues/259

## Versionado y operación

- **Honeycomb — _Versioning embeddings in production_**
  - https://www.honeycomb.io/blog/versioning-embeddings-machine-learning
- **Eugene Yan — _Real-time machine learning: challenges and solutions_** (sección sobre reindexación)
  - https://eugeneyan.com/writing/real-time-recommendations/

## Hardware y costos

- **Pinecone — _Cost and scale_**
  - https://www.pinecone.io/learn/series/scaling/
- **OpenAI — _Embeddings: cost and dimensionality_**
  - https://platform.openai.com/docs/guides/embeddings#which-distance-function-should-i-use

---

**Vuelve a:** [`README de la sesión`](README.md) · [`Curriculum maestro`](../../../00-curriculum.md)
