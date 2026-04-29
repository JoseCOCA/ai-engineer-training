# Código S02 — Mecánica del LLM

Demos ejecutables que acompañan a [`docs/modulos/02-patrones-llm/sesion-02-mecanica-llm/`](../../../docs/modulos/02-patrones-llm/sesion-02-mecanica-llm/).

## Setup

```bash
pnpm install
```

Asegúrate de tener `.env` configurado en la raíz del repo (siguiendo `env.example`).

## Scripts

| Script | Comando | Qué muestra |
|--------|---------|-------------|
| Temperature | `pnpm run temperature` | El mismo prompt 3× con T=0, 0.7, 1.2 |
| Tokenize | `pnpm run tokenize` | Cuántos tokens usa el mismo contenido en EN vs ES |
| Streaming | `pnpm run streaming` | Comparativa generateText vs streamText (Total time vs TTFT) |
| Max tokens | `pnpm run max-tokens` | Truncado por `maxOutputTokens` y `finishReason: "length"` |
| Stop sequences | `pnpm run stop-sequences` | Reto: usar `stopSequences` para forzar formato |

## Cambiar de proveedor

Edita `DEFAULT_LLM_PROVIDER` en el `.env` de la raíz del repo. Valores: `ollama` | `google` | `anthropic` | `openai`.

> **Nota didáctica:** `src/lib/llm.ts` es una réplica de la abstracción del proyecto integrador. Está duplicada a propósito para que esta sesión sea autocontenida.
