# Sesión 03 — Recursos complementarios

Material opcional. Selección curada — no consumas todo, vuelve a ello cuando lo necesites.

---

## Patrones de wrapper y diseño de servicios LLM

- **Hamel Husain — _LLM Patterns_** — uno de los mejores resúmenes de patrones reales de aplicaciones LLM en producción.
  - https://hamel.dev/blog/posts/llm-patterns/
- **Eugene Yan — _Patterns for Building LLM-based Systems & Products_** — taxonomía amplia y referenciada.
  - https://eugeneyan.com/writing/llm-patterns/
- **Anthropic Engineering — _Building effective agents_** — incluye patrones aplicables a wrappers, no solo a agentes.
  - https://www.anthropic.com/research/building-effective-agents

## Retry y backoff

- **AWS Architecture Blog — _Exponential Backoff And Jitter_** — el canónico. Explica por qué jitter no es opcional.
  - https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
- **Google Cloud — _Retry strategies_** — guía operacional para APIs.
  - https://cloud.google.com/storage/docs/retry-strategy
- **Anthropic — _Errors and rate limits_** — tabla oficial de qué errores reintentar.
  - https://docs.anthropic.com/en/api/errors

## Idempotencia y reintentos en sistemas distribuidos

- **Designing Data-Intensive Applications** (Martin Kleppmann), capítulo 8. La referencia conceptual sobre idempotencia y consistencia. No es específico de LLMs pero los conceptos se traducen.
- **Stripe — _Designing robust and predictable APIs with idempotency_** — patrón canónico de idempotency keys, aplicable directo a tools en M5.
  - https://stripe.com/blog/idempotency

## Streaming y UX

- **Vercel AI SDK — _Streaming UI_**
  - https://ai-sdk.dev/docs/ai-sdk-ui/streaming
- **Smashing Magazine — _Designing for AI: Streaming responses_** — UX considerations de chat con streaming.
  - https://www.smashingmagazine.com/2024/02/designing-ai-driven-experiences/

## Observabilidad y costo

- **Langfuse — _Concepts: Traces, observations, scores_** — modelo de observabilidad específico a LLM apps. Lo enchufamos en M6.
  - https://langfuse.com/docs/tracing
- **Helicone — _Cost Observability_** — alternativa a Langfuse, más enfocada en costos.
  - https://docs.helicone.ai/features/advanced-usage/custom-properties

## Fallback y resiliencia

- **Netflix — _Fault Tolerance in a High Volume Distributed System_** — origen del patrón Hystrix / circuit breaker.
  - https://netflixtechblog.com/fault-tolerance-in-a-high-volume-distributed-system-91ab4faae74a
- **Microsoft — _Cloud Design Patterns: Circuit Breaker_** — la versión canónica del patrón.
  - https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker

## Para profundizar

- **Chip Huyen — _AI Engineering_** (O'Reilly, 2024). Capítulo 5 ("Inference Optimization") y capítulo 8 ("Production Patterns") cubren todo lo de esta sesión y mucho más.

---

**Vuelve a:** [`README de la sesión`](README.md) · [`Curriculum maestro`](../../../00-curriculum.md)
