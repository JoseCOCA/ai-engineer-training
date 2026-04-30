# Sesión 11.2 — Recursos

> Lecturas y referencias sobre citas, control de alucinaciones y mantenimiento del índice.

---

## Citas en sistemas RAG

- **Anthropic — "Citations in Claude".** Documentación del feature nativo de Claude para citas inline. Aunque uses otro modelo, la propuesta de diseño es educativa. [https://docs.anthropic.com/en/docs/build-with-claude/citations](https://docs.anthropic.com/en/docs/build-with-claude/citations)
- **Liu et al. (2023) — "Evaluating Verifiability in Generative Search Engines".** Estudio sobre cuántas citas de los buscadores generativos están realmente fundamentadas. Lectura útil para calibrar expectativas. [arXiv:2304.09848](https://arxiv.org/abs/2304.09848)
- **Vercel AI SDK — `generateObject`.** API que usamos en los demos para forzar structured output con zod. [https://sdk.vercel.ai/docs/ai-sdk-core/generating-structured-data](https://sdk.vercel.ai/docs/ai-sdk-core/generating-structured-data)

## Faithfulness y control de alucinaciones

- **Es et al. (2023) — "RAGAS: Automated Evaluation of Retrieval Augmented Generation".** Define faithfulness, answer relevance, context precision/recall. Lectura recomendada antes de S11.3. [arXiv:2309.15217](https://arxiv.org/abs/2309.15217)
- **Galileo — "Hallucination Detection in RAG".** Análisis empírico de técnicas de detección. Útil para entender el espacio de soluciones. [https://www.rungalileo.io/blog](https://www.rungalileo.io/blog)
- **Manakul et al. (2023) — "SelfCheckGPT: Zero-Resource Black-Box Hallucination Detection".** Técnica que detecta alucinaciones generando múltiples respuestas y midiendo consistencia. [arXiv:2303.08896](https://arxiv.org/abs/2303.08896)

## Mantenimiento de índices vectoriales

- **pgvector — "Upgrading and migrations".** Doc oficial sobre migraciones. [https://github.com/pgvector/pgvector#hnsw](https://github.com/pgvector/pgvector#hnsw)
- **Qdrant — "Migrating from one model to another".** Patrón aplicable a cualquier vector DB. [https://qdrant.tech/articles/dataset-quality/](https://qdrant.tech/articles/dataset-quality/)
- **Pinecone — "How to update embeddings".** Versión SaaS del mismo problema. [https://docs.pinecone.io/guides/data/upsert-data](https://docs.pinecone.io/guides/data/upsert-data)

## Charlas y videos

- **"Building Reliable RAG Systems" — Anthropic** (~30 min). Cita reliability como pilar central. [https://www.anthropic.com/research](https://www.anthropic.com/research)
- **"How to Evaluate RAG Pipelines" — Pinecone** (~25 min). Buen resumen de faithfulness, citas, eval sets. [https://www.pinecone.io/learn/series/rag/](https://www.pinecone.io/learn/series/rag/)

---

## Para tener en mente al avanzar

S11.3 cierra el módulo con la **suite de evaluación**. Vas a aplicar RAGAS y Promptfoo sobre el integrador que acabas de modificar en S11.2. Vas a ver Recall@K, faithfulness y answer relevance como números concretos sobre el catálogo de TiendaPro. La medición es lo que separa "funciona en mi máquina" de "está listo para producción".
