# Sesión 11.1 — Recursos

> Lecturas y referencias para profundizar reranking, context expansion y lost-in-the-middle.

---

## Reranking

### Cross-encoders y bi-encoders

- **Reimers & Gurevych (2019) — "Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks".** Paper que sistematiza la diferencia entre bi-encoder y cross-encoder. Lectura corta, conviene leer la sección 2. [arXiv:1908.10084](https://arxiv.org/abs/1908.10084)
- **BAAI/bge-reranker-v2-m3.** Cross-encoder open-source multilingüe, MIT. La opción default cuando puedes correr modelos localmente. [https://huggingface.co/BAAI/bge-reranker-v2-m3](https://huggingface.co/BAAI/bge-reranker-v2-m3)
- **Cohere — "Rerank API".** Documentación del reranker comercial más usado. Útil para benchmark de costos. [https://docs.cohere.com/docs/reranking](https://docs.cohere.com/docs/reranking)

### LLM-as-reranker

- **Sun et al. (2023) — "Is ChatGPT Good at Search? Investigating Large Language Models as Re-Ranking Agents".** Paper que sistematiza pointwise/pairwise/listwise con LLMs. La referencia académica directa. [arXiv:2304.09542](https://arxiv.org/abs/2304.09542)
- **LangChain — LLM Listwise Reranker.** Implementación de referencia. [https://js.langchain.com/docs/integrations/document_compressors/](https://js.langchain.com/docs/integrations/document_compressors/)

## Context expansion / parent-document

- **LangChain — "Parent Document Retriever".** Patrón canónico, con explicación pedagógica. [https://js.langchain.com/docs/how_to/parent_document_retriever/](https://js.langchain.com/docs/how_to/parent_document_retriever/)
- **LlamaIndex — "Sentence Window Retrieval".** Patrón hermano del anterior. [https://docs.llamaindex.ai/en/stable/examples/node_postprocessor/MetadataReplacementDemo/](https://docs.llamaindex.ai/en/stable/examples/node_postprocessor/MetadataReplacementDemo/)
- **Microsoft — "Retrieval Augmented Generation with Long Context Models".** Análisis empírico de cuándo expandir contexto vs no. [https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/rag/rag-information-retrieval](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/rag/rag-information-retrieval)

## Lost-in-the-middle

- **Liu et al. (2023) — "Lost in the Middle: How Language Models Use Long Contexts".** El paper canónico sobre el sesgo. Lectura obligatoria si vas a operar prompts con muchos chunks. [arXiv:2307.03172](https://arxiv.org/abs/2307.03172)
- **Anthropic — "Long Context Prompting Tips".** Recomendaciones específicas para Claude pero aplicables a otros modelos. [https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips)
- **Google — "Gemini Long Context".** Parámetros y recomendaciones específicas para Gemini con context window grande. [https://ai.google.dev/gemini-api/docs/long-context](https://ai.google.dev/gemini-api/docs/long-context)

## Charlas y videos

- **"Reranking in RAG" — LlamaIndex** (~15 min). Visualización con benchmarks reales. [https://www.llamaindex.ai/blog/](https://www.llamaindex.ai/blog/)
- **"Lost in the Middle, explained" — Yannic Kilcher** (~25 min). Análisis del paper de Liu et al. en formato accesible. [https://www.youtube.com/results?search_query=lost+in+the+middle+yannic](https://www.youtube.com/results?search_query=lost+in+the+middle+yannic)

---

## Para tener en mente al avanzar

S11.2 es la sesión donde el integrador se pone al día con todo lo que vimos: pgvector + retrieval + (opcionalmente) reranking + citas obligatorias + control de alucinaciones + mantenimiento del índice (re-embed cuando cambia el modelo). S11.3 cierra con evaluación sistemática (RAGAS, Promptfoo).

**Patrón mental del módulo:**
- S09 = bases del pipeline.
- S10 = mejorar el retriever.
- S11.1 = mejorar la augmentación.
- S11.2 = aterrizar todo en el integrador con citas y mantenimiento.
- S11.3 = saber si lo que armaste funciona.
