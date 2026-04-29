# Sesión 05.1 — Recursos complementarios

Material opcional. Selección curada para profundizar.

---

## Patrones de inyección de contexto

- **OpenAI Cookbook — _Question answering using context_** — receta canónica de inyección de contexto previo a RAG.
  - https://cookbook.openai.com/examples/question_answering_using_a_search_api
- **Anthropic — _Reduce hallucinations_** — incluye patrones de grounding con contexto.
  - https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/reduce-hallucinations

## Lost in the Middle

- **Liu et al. — _Lost in the Middle: How Language Models Use Long Contexts_** (2023). El paper de referencia.
  - https://arxiv.org/abs/2307.03172
- **Anthropic — _Long context tips_** — guía oficial sobre orden y estructura del prompt en contextos largos.
  - https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips

## Prompt caching

- **Anthropic — Prompt caching** — referencia oficial.
  - https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- **OpenAI — Prompt caching**
  - https://platform.openai.com/docs/guides/prompt-caching
- **Google — Context caching for Gemini**
  - https://ai.google.dev/gemini-api/docs/caching
- **Vercel AI SDK — Provider options for caching** — cómo activarlo desde el SDK.
  - https://ai-sdk.dev/providers/ai-sdk-providers/anthropic

## Tokenización para presupuestar

- **gpt-tokenizer** (npm) — paquete liviano para contar tokens client-side, usado en los ejercicios.
  - https://github.com/niieani/gpt-tokenizer
- **OpenAI — Counting tokens** — guía oficial.
  - https://cookbook.openai.com/examples/how_to_count_tokens_with_tiktoken

## Bases de datos y LLMs (preview de M5)

- **Vercel AI SDK — Tools for SQL queries** — patrón de tools para que el LLM consulte BD de forma controlada.
  - https://ai-sdk.dev/cookbook/node/sql-query-generation
- **Simon Willison — _Datasette + LLM_** — colección de patrones para integrar LLMs con BD.
  - https://simonwillison.net/tags/datasette/

## Seguridad

- **OWASP — _LLM01: Prompt Injection_** — incluye casos de injection vía contexto inyectado.
  - https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- **PortSwigger — _Web LLM attacks_** — laboratorio interactivo con ejemplos de injection vía contexto.
  - https://portswigger.net/web-security/llm-attacks

## Para profundizar (preview de M3-M4)

- **Pinecone Learn — _What is RAG?_** — la versión semántica de lo que vimos acá.
  - https://www.pinecone.io/learn/retrieval-augmented-generation/
- **DeepLearning.AI — _Building Applications with Vector Databases_** — short course gratuito, prepara M3.
  - https://www.deeplearning.ai/short-courses/building-applications-vector-databases/

---

**Vuelve a:** [`README de la sesión`](README.md) · [`Curriculum maestro`](../../../00-curriculum.md)
