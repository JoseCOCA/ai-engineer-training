# Código S03 — Wrappers, retry, fallback, instrumentación

Acompaña a [`docs/modulos/02-patrones-llm/sesion-03-wrappers/`](../../../docs/modulos/02-patrones-llm/sesion-03-wrappers/).

## Setup

```bash
pnpm install
```

`.env` configurado en la raíz. Para el demo de fallback conviene tener Ollama corriendo además del proveedor primario.

## Estructura

```
src/
├── chat-demo.ts        ← demo del chat service
├── retry-demo.ts       ← retry con backoff exponencial
├── fallback-demo.ts    ← fallback de primary a Ollama
├── streaming-demo.ts   ← streaming con cancelación
├── flow-demo.ts        ← múltiples flows para llenar el log
├── aggregate.ts        ← agrega costo por flow
└── lib/
    ├── providers.ts    ← buildModel(provider): ResolvedModel
    ├── pricing.ts      ← snapshot de precios USD/1M
    ├── retry.ts        ← withRetry + defaultShouldRetry
    ├── logger.ts       ← appendLog → logs/calls.jsonl
    └── chat.ts         ← chat() y chatStream() (la frontera)
```

## Scripts

| Script | Comando | Qué muestra |
|--------|---------|-------------|
| Chat básico | `pnpm run chat` | Una llamada con todas las métricas |
| Retry | `pnpm run retry-demo` | Backoff exponencial sobre función mock |
| Fallback | `pnpm run fallback-demo` | Primary falla → Ollama responde |
| Streaming | `pnpm run streaming-demo` | Stream completo + stream cancelado |
| Flow demo | `pnpm run flow-demo` | Llena logs/calls.jsonl con varios flows |
| Aggregate | `pnpm run aggregate` | Resumen costo por flow |

## La regla arquitectural

**Nada de la app importa `ai` ni los SDKs de proveedores directo. Todo consume `chat` y `chatStream` desde `src/lib/chat.ts`.** Esta es la frontera arquitectural del producto.
