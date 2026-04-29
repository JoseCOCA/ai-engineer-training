# Código S04 — Salidas estructuradas, JSON, guardrails

Acompaña a [`docs/modulos/02-patrones-llm/sesion-04-salidas-estructuradas/`](../../../docs/modulos/02-patrones-llm/sesion-04-salidas-estructuradas/).

## Setup

```bash
pnpm install
```

`.env` configurado en la raíz. Recomendado un proveedor cloud (Gemini Flash o Claude Haiku) — los modelos open-source pequeños (3B-8B) en Ollama no son siempre confiables con schemas complejos.

## Scripts

| Script | Comando | Qué muestra |
|--------|---------|-------------|
| Intent | `pnpm run intent` | `classifyIntent()` con generateObject + Zod sobre 5 mensajes |
| Order | `pnpm run order` | Schema con `.refine()` y `.transform()` extrayendo datos de pedido |
| Guardrails | `pnpm run guardrails` | Input + output guardrails sobre 5 casos |
| Stream object | `pnpm run stream-object` | streamObject completándose frame por frame |
| Validator | `pnpm run validator` | LLM-as-validator midiendo latencia/costo extra |

## Estructura

```
src/
├── intent.ts             ← classifyIntent() con schema
├── intent-demo.ts        ← runner del intent
├── order-demo.ts         ← schema con refine + transform
├── guardrails.ts         ← validateInput / validateOutput
├── guardrails-demo.ts    ← runner de guardrails
├── stream-object-demo.ts ← streamObject de un análisis de pedido
├── validator-demo.ts     ← LLM-as-validator pattern
└── lib/
    └── llm.ts            ← resolver de modelo según .env
```
