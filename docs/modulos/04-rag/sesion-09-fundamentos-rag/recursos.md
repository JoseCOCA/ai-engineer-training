# Sesión 09 — Recursos

> Material complementario para ampliar S09. No es lectura obligatoria — está organizado por nivel de profundidad.

---

## Lectura corta (30-45 min)

- **Lewis et al. (2020) — "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks".** El paper original que acuñó el término RAG. Conviene leer al menos la introducción y la sección 2 (arquitectura). [arXiv:2005.11401](https://arxiv.org/abs/2005.11401)
- **Anthropic — "Contextual Retrieval".** Introduce la técnica de "contextualizar" cada chunk antes de embeberlo, con métricas concretas de mejora sobre RAG ingenuo. Útil como vista previa de S10. [https://www.anthropic.com/news/contextual-retrieval](https://www.anthropic.com/news/contextual-retrieval)
- **OpenAI Cookbook — "Retrieval Augmented Generation (RAG) with a Knowledge Base".** Tutorial práctico, equivalente al que armamos en S09. [https://cookbook.openai.com/](https://cookbook.openai.com/)

## Lectura profunda (1-3h)

- **Gao et al. (2024) — "Retrieval-Augmented Generation for Large Language Models: A Survey".** Survey extenso que organiza el campo en Naive RAG, Advanced RAG y Modular RAG. Lectura recomendada antes de S10. [arXiv:2312.10997](https://arxiv.org/abs/2312.10997)
- **LangChain Docs — "Retrieval".** Documentación de los retrievers de LangChain.js. Útil aunque en este curso construimos sin framework, para entender qué abstracción adopta el resto del ecosistema. [https://js.langchain.com/docs/concepts/retrievers/](https://js.langchain.com/docs/concepts/retrievers/)
- **Pinecone Learn — "Retrieval Augmented Generation".** Material pedagógico bien curado, incluye comparativas con fine-tuning. [https://www.pinecone.io/learn/retrieval-augmented-generation/](https://www.pinecone.io/learn/retrieval-augmented-generation/)

## Métricas y evaluación (preview de S11.3)

- **RAGAS Documentation.** Framework de evaluación específico para RAG. En S11.3 lo usamos en profundidad. Ojeo previo: faithfulness, answer relevance, context precision, context recall. [https://docs.ragas.io/](https://docs.ragas.io/)
- **Promptfoo Docs — "Testing RAG applications".** Framework TS-friendly que vamos a usar en paralelo a RAGAS. [https://www.promptfoo.dev/docs/guides/evaluate-rag/](https://www.promptfoo.dev/docs/guides/evaluate-rag/)
- **Es et al. (2023) — "RAGAS: Automated Evaluation of Retrieval Augmented Generation".** El paper de RAGAS. Define las métricas que vas a usar en producción. [arXiv:2309.15217](https://arxiv.org/abs/2309.15217)

## Charlas y videos (alternativa al texto)

- **"What is RAG?" — IBM Technology** (~7 min). Introducción visual y muy clara. [https://www.youtube.com/watch?v=T-D1OfcDW1M](https://www.youtube.com/watch?v=T-D1OfcDW1M)
- **"Building Production-Ready RAG Applications" — Jerry Liu (LlamaIndex)** (~30 min). Casos reales y antipatrones. [https://www.youtube.com/watch?v=TRjq7t2Ms5I](https://www.youtube.com/watch?v=TRjq7t2Ms5I)

## Herramientas que vas a usar en este módulo

- **pgvector** — ya instalado en S08. [https://github.com/pgvector/pgvector](https://github.com/pgvector/pgvector)
- **Vercel AI SDK** — la abstracción que usamos para el LLM. [https://sdk.vercel.ai/](https://sdk.vercel.ai/)
- **`@ai-sdk/google`** — el provider de Google Gemini. [https://sdk.vercel.ai/providers/ai-sdk-providers/google-generative-ai](https://sdk.vercel.ai/providers/ai-sdk-providers/google-generative-ai)

---

## Para tener en mente al avanzar

S10 y S11 te van a presentar técnicas más avanzadas (hybrid search, query rewriting, reranking, citas, evaluación). El criterio para adoptarlas no es "están de moda" — es "el RAG ingenuo no me da el recall/faithfulness que necesito en mi caso concreto, y esta técnica ataca exactamente la métrica que falla".

**Si todavía no mediste, no necesitas la técnica.**
