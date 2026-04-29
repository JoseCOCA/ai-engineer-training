# Sesión 04 — Recursos complementarios

Material opcional. Selección curada para profundizar.

---

## Salidas estructuradas y schema-constrained generation

- **Vercel AI SDK — `generateObject`** — referencia oficial.
  - https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
- **OpenAI — Structured Outputs** — guía oficial sobre por qué schema-constrained es mejor que JSON mode.
  - https://platform.openai.com/docs/guides/structured-outputs
- **Anthropic — JSON outputs** — patrón canónico con tools y structured outputs.
  - https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/increase-consistency
- **Pydantic AI — _Why structured?_** — argumento conceptual claro (aplicable a TS).
  - https://ai.pydantic.dev/why/

## Zod (schema validation)

- **Documentación oficial de Zod**
  - https://zod.dev
- **Total TypeScript — _Schemas with Zod_** — tutorial denso para internalizar refinements y transforms.
  - https://www.totaltypescript.com/tutorials/zod
- **JSON Schema vs Zod** — diferencias que importan cuando trabajás con providers que esperan uno u otro.
  - https://github.com/colinhacks/zod#comparison

## Guardrails y prompt injection

- **OWASP Top 10 for LLM Applications** — el documento de referencia. LLM01: Prompt Injection es la entrada principal.
  - https://owasp.org/www-project-top-10-for-large-language-model-applications/
- **Simon Willison — _Prompt injection_** — colección continua de ejemplos reales y discusión técnica. Lectura semi-obligatoria.
  - https://simonwillison.net/tags/prompt-injection/
- **Anthropic — _Prompt engineering: Use system prompts_** — defensa de fondo basada en diseño del prompt.
  - https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags
- **Lakera — _The Ultimate Guide to Prompt Injection_** — práctico, con taxonomía de ataques.
  - https://www.lakera.ai/blog/guide-to-prompt-injection

## Content moderation

- **OpenAI Moderation API** — gratis, sirve como baseline.
  - https://platform.openai.com/docs/guides/moderation
- **Llama Guard** — modelo open-source para moderación local.
  - https://huggingface.co/meta-llama/LlamaGuard-7b
- **Azure Content Safety** — alternativa cloud robusta.
  - https://learn.microsoft.com/en-us/azure/ai-services/content-safety/

## LLM-as-judge / LLM-as-validator

- **Anthropic — _Building evaluations_** — incluye patrones de LLM-as-judge.
  - https://docs.anthropic.com/en/docs/test-and-evaluate/develop-tests
- **Hamel Husain — _Your AI product needs evals_** — el post canónico sobre evaluación. Lectura obligatoria antes de M4.
  - https://hamel.dev/blog/posts/evals/
- **Eugene Yan — _LLM-Evaluators (LLM-Judges)_** — taxonomía y warnings.
  - https://eugeneyan.com/writing/llm-evaluators/

## Streaming structured outputs

- **Vercel AI SDK — `streamObject`**
  - https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data#streamobject

## Frameworks de guardrails

- **Guardrails AI** (Python) — framework dedicado, con biblioteca de validators.
  - https://www.guardrailsai.com
- **NeMo Guardrails** (NVIDIA) — alternativa con DSL declarativo.
  - https://github.com/NVIDIA/NeMo-Guardrails

---

**Vuelve a:** [`README de la sesión`](README.md) · [`Curriculum maestro`](../../../00-curriculum.md)
