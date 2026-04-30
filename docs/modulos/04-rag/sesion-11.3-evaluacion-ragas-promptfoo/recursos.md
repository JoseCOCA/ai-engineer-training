# Sesión 11.3 — Recursos

> Material complementario sobre evaluación de sistemas RAG.

---

## RAGAS

- **Es et al. (2023) — "RAGAS: Automated Evaluation of Retrieval Augmented Generation".** Paper original. Define las cuatro métricas que vimos. [arXiv:2309.15217](https://arxiv.org/abs/2309.15217)
- **RAGAS Documentation.** Doc oficial con ejemplos y reportes. [https://docs.ragas.io/](https://docs.ragas.io/)
- **RAGAS GitHub.** Código + issues abiertos para entender limitaciones. [https://github.com/explodinggradients/ragas](https://github.com/explodinggradients/ragas)

## Promptfoo

- **Promptfoo Documentation.** Guía completa, asserts, configuración CI. [https://www.promptfoo.dev/docs/intro](https://www.promptfoo.dev/docs/intro)
- **Promptfoo — "Testing RAG applications".** Patrones específicos para RAG. [https://www.promptfoo.dev/docs/guides/evaluate-rag/](https://www.promptfoo.dev/docs/guides/evaluate-rag/)
- **Promptfoo — `llm-rubric` deep dive.** Cómo escribir rubrics que sean precisos pero no demasiado estrictos. [https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/)

## Estrategias de evaluación

- **Hugging Face — "RAG Evaluation".** Tutorial completo con código. Buena referencia. [https://huggingface.co/learn/cookbook/rag_evaluation](https://huggingface.co/learn/cookbook/rag_evaluation)
- **OpenAI Cookbook — "Evals".** Patrones para evaluación de sistemas LLM. Aplicable a RAG. [https://cookbook.openai.com/examples/evaluation/getting_started_with_openai_evals](https://cookbook.openai.com/examples/evaluation/getting_started_with_openai_evals)
- **Anthropic — "Evals best practices".** Patrones de eval set y CI. [https://docs.anthropic.com/en/docs/test-and-evaluate/develop-tests](https://docs.anthropic.com/en/docs/test-and-evaluate/develop-tests)

## Métricas y benchmarks

- **BEIR Benchmark.** Suite de tareas de retrieval. Útil para calibrar expectativas de Recall@K en distintos dominios. [https://github.com/beir-cellar/beir](https://github.com/beir-cellar/beir)
- **MTEB Leaderboard.** Comparativa de modelos de embeddings. Decisiones de Recall@K dependen del modelo. [https://huggingface.co/spaces/mteb/leaderboard](https://huggingface.co/spaces/mteb/leaderboard)

## Charlas y videos

- **"Evaluating RAG" — RAGAS team** (~30 min). Tutorial práctico de las 4 métricas. [https://www.ragas.io/blog](https://www.ragas.io/blog)
- **"Building Production-Ready RAG Applications" — Jerry Liu** (~30 min). Incluye sección de evals con métricas concretas. [https://www.youtube.com/watch?v=TRjq7t2Ms5I](https://www.youtube.com/watch?v=TRjq7t2Ms5I)
- **"Why your RAG isn't working" — LlamaIndex** (~20 min). Cómo el eval set ayuda a diagnosticar fallos. [https://www.llamaindex.ai/blog](https://www.llamaindex.ai/blog)

---

## Para tener en mente al avanzar

Con el cierre de M4 entras al **Módulo 5 — Orquestación de agentes**. El asistente conversacional con RAG queda listo. En M5 le sumamos:

- Function calling para consultar pedidos por ID o email del cliente.
- Recomendaciones personalizadas con tools.
- Escalamiento a humano cuando no puede resolver.
- Patrones multi-agente con LangGraph.

El eval set que armaste en S11.3 sigue valiendo: cada feature nueva agrega casos al set y el sistema RAG sigue siendo medido para que las nuevas tools no rompan lo viejo.
