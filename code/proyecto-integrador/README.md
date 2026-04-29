# TiendaPro — Proyecto integrador

Asistente conversacional para un e-commerce ficticio. Crece módulo a módulo a lo largo del curso.

## Estado actual — Hito M2 (`proyecto-m2`)

**Asistente conversacional con personalidad.** Capacidades implementadas:

- **Chat service** — consume `chat()` y `chatStream()` desde `@curso-ai/llm` (workspace package). Retry exponencial + fallback al proveedor secundario + instrumentación por flow + onComplete callback para logging.
- **Logger propio** (`src/lib/logger.ts`) — sink local que escribe `logs/calls.jsonl` desde el callback de `@curso-ai/llm`.
- **Clasificación estructurada de intent** (`src/lib/intent.ts`) — `generateObject` + Zod sobre `pregunta | reclamo | derivar`.
- **Guardrails** de input/output (`src/lib/guardrails.ts`) — patrones sospechosos, longitud, mención de competidores.
- **Inyección de contexto** desde catálogo (`src/lib/catalog.ts` + `data/catalog.json`) usando query-then-inject.
- **Memoria conversacional** — `ConversationStore` desde `@curso-ai/llm` con sliding window por tokens.
- **Prompts versionados** en `prompts/` con renderer bound al directorio del proyecto (`src/lib/prompts.ts` usa `makePromptRenderer` de `@curso-ai/llm`).
- **Tests** (snapshot + regression) en `__tests__/` con Vitest.

## Setup

Desde la **raíz del repo** (no desde aquí):

```bash
pnpm install   # instala todo el workspace, incluyendo @curso-ai/llm
```

`.env` configurado en la raíz del repo (siguiendo `env.example`).

## Ejecutar la conversación demo

```bash
# Desde la raíz del repo:
pnpm dev

# O desde aquí:
pnpm run dev
```

Salida esperada (resumida):

```
=== TiendaPro — conversación con Carlos ===

> Hola, soy Carlos. Estoy buscando equipo de senderismo.
  [intent: pregunta (0.74)]
  ¡Hola Carlos! Encantado de ayudarte. ¿Buscas algo en particular...?
  [1820ms, 35 out, $0.000043]

> ¿Tienen mochilas para senderismo de fin de semana?
  [intent: pregunta (0.95)]
  [products injected: 3]
  Para senderismo de 1-2 días te recomiendo la Mochila Trekker 30L...
```

## Tests

```bash
pnpm test                # snapshot + regression
pnpm run test:snapshot   # solo snapshot del template
pnpm run test:regression # solo regression sobre eval set (hace llamadas reales)
```

## Cambiar de proveedor LLM

Edita `DEFAULT_LLM_PROVIDER` en el `.env` de la raíz. Valores: `ollama` | `google` | `anthropic` | `openai`.

**No necesitas tocar el código** — la abstracción en `@curso-ai/llm` se encarga.

## Estructura

```
prompts/
├── customer-support.system.md   ← system del chat principal
├── intent-classifier.system.md  ← system del clasificador
├── summarizer.system.md         ← system del resumidor de turnos viejos
└── eval-set.json                ← casos de regression

data/
└── catalog.json                 ← 12 productos mock

src/
├── index.ts                     ← demo de conversación de 5 turnos
└── lib/
    ├── intent.ts                ← classifyIntent con generateObject + Zod
    ├── guardrails.ts            ← validateInput / validateOutput
    ├── catalog.ts               ← findProducts(query) sobre catalog.json (M3 lo cambia por embeddings)
    ├── logger.ts                ← logChatResponse → logs/calls.jsonl
    └── prompts.ts               ← render bound al directorio prompts/

__tests__/
├── prompts.snapshot.test.ts     ← snapshot del template renderizado
└── prompts.regression.test.ts   ← regression sobre eval-set.json
```

La frontera del producto LLM (chat, retry, fallback, providers, conversation store, prompt-template engine) vive en `code/packages/llm/` (`@curso-ai/llm`).

## Hitos por módulo

| Tag | Módulo | Hito |
|-----|--------|------|
| `proyecto-m1` | M1 — Fundamentos | "Hola, soy el asistente": primera llamada con abstracción multi-provider |
| `proyecto-m2` | M2 — Patrones LLM | Asistente conversacional con personalidad, intent, guardrails, contexto, memoria, prompts versionados, tests |
| `proyecto-m3` | M3 — Embeddings (próximo) | Catálogo y FAQs indexados con embeddings + pgvector |
| `proyecto-m4` | M4 — RAG | Asistente que responde sobre el catálogo con citas |
| `proyecto-m5` | M5 — Agentes | Function calling + supervisor multi-agente |
| `proyecto-m6` | M6 — LLMOps | Asistente desplegado y monitoreado en producción |

## Documentación pedagógica

Cada capacidad de TiendaPro se desarrolla en su sesión correspondiente bajo `docs/modulos/MM-modulo-slug/sesion-NN.X-tema/`.

## Proveedor recomendado del Módulo 1

Tras la comparativa de [S01.2](../../docs/modulos/01-fundamentos/sesion-01.2-respuesta-comparativa/), la recomendación canónica del curso para el MVP de TiendaPro es **Google Gemini 2.5 Flash**:

- **Free tier amplio** (~1.500 req/día) — no obstaculiza el desarrollo ni los ejercicios.
- **Cloud-only**, no requiere hardware local potente.
- **Latencia razonable** y **costo proyectado** ~$104/mes a 10K mensajes/día (vs ~$385/mes con Claude Haiku 4.5).

Esta es **una recomendación, no una imposición**. La abstracción multi-provider absorbe el cambio. A revisar en **Módulo 4** cuando podamos comparar proveedores con métricas de calidad rigurosas (RAGAS, Promptfoo).
