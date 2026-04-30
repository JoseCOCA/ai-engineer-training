# Sesión 13.3 — Recursos

---

## Persistencia

- **LangGraph Persistence Concepts.** [https://langchain-ai.github.io/langgraphjs/concepts/persistence/](https://langchain-ai.github.io/langgraphjs/concepts/persistence/)
- **`@langchain/langgraph-checkpoint-sqlite`.** Implementación SQLite. [https://www.npmjs.com/package/@langchain/langgraph-checkpoint-sqlite](https://www.npmjs.com/package/@langchain/langgraph-checkpoint-sqlite)
- **`@langchain/langgraph-checkpoint-postgres`.** Implementación Postgres. [https://www.npmjs.com/package/@langchain/langgraph-checkpoint-postgres](https://www.npmjs.com/package/@langchain/langgraph-checkpoint-postgres)

## Error handling

- **LangChain — Runnable Retry y Fallbacks.** Guía de `withRetry` y `withFallbacks`. [https://js.langchain.com/docs/how_to/fallbacks/](https://js.langchain.com/docs/how_to/fallbacks/)
- **AWS — Exponential Backoff and Jitter.** Por qué jitter es importante. [https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)

## Observabilidad

- **LangSmith.** El producto comercial de LangChain para tracing. [https://smith.langchain.com/](https://smith.langchain.com/)
- **Langfuse.** Alternativa open-source. [https://langfuse.com/](https://langfuse.com/)
- **OpenTelemetry — LLM Semantic Conventions.** Estándar emergente para tracing de LLMs. [https://opentelemetry.io/docs/specs/semconv/gen-ai/](https://opentelemetry.io/docs/specs/semconv/gen-ai/)

---

## Para tener en mente al avanzar

S14.1 entra en multi-agente: cómo varios agentes especializados se coordinan. El estado y la observabilidad de S13.3 son la base para que multi-agente funcione: un grafo con 5 workers necesita persistencia y traces o es indebuggeable.
