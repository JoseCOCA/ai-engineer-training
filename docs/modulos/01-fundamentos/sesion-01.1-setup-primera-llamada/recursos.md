# Sesión 01.1 — Recursos complementarios

Material de referencia para profundizar en el Vercel AI SDK y los proveedores que usás en el proyecto.

---

## Vercel AI SDK (la herramienta central del curso)

- **Documentación oficial** — la principal fuente de verdad sobre `generateText`, `streamText`, `generateObject`, tools, etc.
  - https://ai-sdk.dev/docs/introduction
- **AI SDK Cookbook** — recetas listas para casos comunes (chat con memoria, RAG, tools, streaming a UI). Vas a volver a esto a lo largo del curso.
  - https://ai-sdk.dev/cookbook
- **Repositorio de ejemplos** — proyectos completos (Next.js + Chat, agentes, RAG con pgvector). Útil cuando querés ver "código real" de cómo se hace algo.
  - https://github.com/vercel/ai/tree/main/examples
- **API Reference de `LanguageModel`** — el tipo polimórfico que está detrás de toda la abstracción.
  - https://ai-sdk.dev/docs/reference/ai-sdk-core/language-model

## Documentación de los proveedores configurados

- **Anthropic Claude** (modelo de la familia que usamos como referencia "balanceada"):
  - API docs: https://docs.anthropic.com/en/api/messages
  - Pricing: https://www.anthropic.com/pricing
  - Models: https://docs.anthropic.com/en/docs/about-claude/models
- **Google Gemini** (cloud free tier, ideal para el curso):
  - API docs: https://ai.google.dev/gemini-api/docs
  - Pricing: https://ai.google.dev/pricing
  - AI Studio (consola): https://aistudio.google.com/
- **OpenAI** (incluido por completitud, opcional):
  - API docs: https://platform.openai.com/docs/api-reference
  - Pricing: https://openai.com/api/pricing
- **Ollama** (motor local):
  - Docs: https://github.com/ollama/ollama/blob/main/docs/README.md
  - Catálogo de modelos: https://ollama.com/library
  - REST API reference: https://github.com/ollama/ollama/blob/main/docs/api.md
- **`ollama-ai-provider-v2`** (el bridge entre Ollama y AI SDK v5):
  - https://github.com/nordwestt/ollama-ai-provider-v2

## Sobre el patrón de abstracción de proveedores

- **Vercel AI SDK — Provider Architecture** — cómo está diseñado internamente el SDK para soportar múltiples proveedores. Útil si querés entender QUÉ hace el polimorfismo.
  - https://ai-sdk.dev/docs/foundations/providers-and-models
- **Anthropic Engineering Blog — Building agents with the Anthropic SDK** — buen contraste para entender el costo de NO tener abstracción.
  - https://www.anthropic.com/engineering

## Tokenización y conteo (relacionado con S00.2)

- **OpenAI Tokenizer (web)** — para ver cómo se tokeniza tu prompt. Lo usaste en S00.2.
  - https://platform.openai.com/tokenizer
- **`tiktoken` para JS/TS** — el tokenizer de OpenAI como librería. Te permite contar tokens **antes** de mandar el prompt.
  - https://github.com/dqbd/tiktoken
- **Anthropic — Token Counting docs** — cada proveedor tokeniza distinto; Anthropic publica su tokenizer para que puedas estimar localmente.
  - https://docs.anthropic.com/en/docs/build-with-claude/token-counting

## Lecturas más allá del SDK

- **Simon Willison — _LLM CLI tools_** — herramientas y ejemplos prácticos de cómo consumir LLMs desde scripts. Buen material para reforzar el "modo CLI".
  - https://simonwillison.net/tags/llm/
- **AI Engineer Summit talks (YouTube)** — charlas reales de ingenieros que construyen productos. Filtrá por las que mencionan multi-provider.
  - https://www.youtube.com/@aiDotEngineer

---

**Vuelve a:** [`README de la sesión`](README.md) · [`Curriculum maestro`](../../../00-curriculum.md)
