# Sesión 02 — Recursos complementarios

Material opcional. **No es necesario consumir todo** — son referencias para profundizar cuando lo necesites.

---

## Tokenizers — playgrounds

- **OpenAI Tokenizer** — el más conocido. Tokeniza con los vocabularios de GPT-3.5/4/4o. Ideal para internalizar el concepto.
  - https://platform.openai.com/tokenizer
- **Tiktokenizer** (third-party, multi-modelo) — compara tokenizadores de varios modelos lado a lado.
  - https://tiktokenizer.vercel.app
- **Hugging Face Tokenizer Playground** — para modelos open-source (Llama, Mistral, Qwen).
  - https://huggingface.co/spaces/Xenova/the-tokenizer-playground

## Documentación oficial de los parámetros

- **Vercel AI SDK — Settings** — referencia de qué parámetros soporta cada proveedor a través del SDK.
  - https://ai-sdk.dev/docs/ai-sdk-core/settings
- **OpenAI — API Reference: Sampling Parameters** — definición canónica de `temperature`, `top_p`, `frequency_penalty`, `presence_penalty`, `seed`.
  - https://platform.openai.com/docs/api-reference/chat/create
- **Anthropic — Messages API** — `temperature`, `top_p`, `top_k`, `stop_sequences`.
  - https://docs.anthropic.com/en/api/messages
- **Google AI — Gemini API Parameters**
  - https://ai.google.dev/gemini-api/docs/text-generation

## Reasoning tokens

- **OpenAI — Reasoning** — explicación oficial del o-series y su modelo de cobranza por reasoning tokens.
  - https://platform.openai.com/docs/guides/reasoning
- **Anthropic — Extended thinking** — cómo funciona y cuándo activarlo en Claude.
  - https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking
- **Google — Gemini 2.5 thinking** — modo thinking de Gemini.
  - https://ai.google.dev/gemini-api/docs/thinking

## Lecturas conceptuales sobre tokenización

- **Andrej Karpathy — _Let's build the GPT Tokenizer_** (2h, YouTube). Construye un BPE desde cero. Si quieres entender de verdad por qué un emoji puede ser 8 tokens, este es el video.
  - https://www.youtube.com/watch?v=zduSFxRajkE
- **Hugging Face — _Tokenizers_ chapter** — explicación textual completa de BPE, WordPiece, SentencePiece.
  - https://huggingface.co/learn/nlp-course/chapter6/

## Lost in the Middle (por qué llenar el contexto degrada calidad)

- **Liu et al. — _Lost in the Middle: How Language Models Use Long Contexts_** (2023). El paper que documenta sistemáticamente el efecto. Lectura corta, alta densidad.
  - https://arxiv.org/abs/2307.03172

## Streaming — referencias prácticas

- **Vercel AI SDK — `streamText`** — patrones de UI con streaming en frameworks frontend.
  - https://ai-sdk.dev/docs/ai-sdk-core/generating-text#streamtext
- **Vercel AI SDK — UI hooks** — `useChat` y `useCompletion` para integrar streaming en React/Next/Svelte.
  - https://ai-sdk.dev/docs/ai-sdk-ui/chatbot

## Tools / Function calling — preview de M5

- **Anthropic — Tool use** — referencia oficial de tool calling con Claude.
  - https://docs.anthropic.com/en/docs/build-with-claude/tool-use
- **Vercel AI SDK — Tools and Tool Calling** — abstracción multi-provider.
  - https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling

## Para pegarlo todo

- **Chip Huyen — _AI Engineering_** (O'Reilly, 2024). Capítulo 4 ("Inference") cubre todo lo de esta sesión y profundiza en consideraciones de producción.
- **Hamel Husain — _Your AI product needs evals_** (post). No es de esta sesión, pero quedate con el link: lo vas a necesitar en M4.
  - https://hamel.dev/blog/posts/evals/

---

**Vuelve a:** [`README de la sesión`](README.md) · [`Curriculum maestro`](../../../00-curriculum.md)
