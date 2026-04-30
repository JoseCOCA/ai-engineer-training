# TiendaPro — Proyecto integrador

Asistente conversacional para un e-commerce ficticio. Crece módulo a módulo a lo largo del curso.

## Estado actual — Hito M4 (`proyecto-m4`)

**Asistente conversacional con RAG real sobre catálogo, citas validadas y suite de evals.** Capacidades acumuladas:

- **Chat service** — consume `chat()` y `chatStream()` desde `@curso-ai/llm`. Retry + fallback + instrumentación por flow.
- **Logger propio** (`src/lib/logger.ts`) — sink que escribe `logs/calls.jsonl` desde el callback de `@curso-ai/llm`.
- **Clasificación estructurada de intent** (`src/lib/intent.ts`) — `generateObject` + Zod sobre `pregunta | reclamo | derivar`.
- **Guardrails** de input/output (`src/lib/guardrails.ts`).
- **RAG pipeline real** (`src/rag/`, M4): retrieve pgvector → listwise rerank con Gemini Flash → structured output `{ answer, citations[] }` con zod → validación de citas (Nivel 1). Reemplaza el `findProducts` keyword del M2 cuando el intent es `pregunta`. Si retrieval vacío o citas inválidas → fallback al chat sin contexto.
- **Memoria conversacional** — `ConversationStore` desde `@curso-ai/llm` con sliding window por tokens.
- **Prompts versionados** en `prompts/`.
- **Tests Ring 1** — unit del validador de citas (`__tests__/rag.test.ts`) + snapshot/regression de prompts.
- **Suite de evals Ring 2** — `evals/eval-set.json` con 15 casos (catalog/OOD/adversarial) + runner Promptfoo-like (`evals/run-evals.ts`) con 5 asserts y threshold configurable para CI.

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
pnpm test                # snapshot + regression + retrieval + rag
pnpm run test:snapshot   # snapshot del template renderizado
pnpm run test:regression # regression sobre eval-set de prompts (hace llamadas reales)
pnpm run test:retrieval  # smoke test del retriever pgvector
pnpm run test:rag        # unit del validador de citas RAG
pnpm run test:evals      # Ring 2: eval set RAG completo (Promptfoo-like)
```

`test:evals` corre el pipeline RAG completo contra `evals/eval-set.json`. Requiere Postgres con catálogo indexado y `GOOGLE_GENERATIVE_AI_API_KEY`. Threshold configurable con `EVALS_THRESHOLD=0.85`.

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

sql/
└── 001-products-schema.sql      ← schema pgvector (M3)

scripts/
└── index-catalog.ts             ← ingesta del catálogo en pgvector (M3)

src/
├── index.ts                     ← demo de conversación con RAG (M4)
├── lib/
│   ├── intent.ts                ← classifyIntent con generateObject + Zod
│   ├── guardrails.ts            ← validateInput / validateOutput
│   ├── catalog.ts               ← findProducts(query) — fallback legacy del M2
│   ├── logger.ts                ← logChatResponse → logs/calls.jsonl
│   └── prompts.ts               ← render bound al directorio prompts/
├── retrieval/
│   └── pgvector-store.ts        ← cliente pgvector (M3)
└── rag/                         ← M4: pipeline RAG completo
    ├── pipeline.ts              ← runRagPipeline (retrieve + rerank + cite)
    ├── citations.ts             ← validateCitations (Nivel 1)
    └── embedder.ts              ← embedQuery con gemini-embedding-001

__tests__/
├── prompts.snapshot.test.ts     ← snapshot del template renderizado
├── prompts.regression.test.ts   ← regression sobre eval-set.json
├── retrieval.test.ts            ← smoke del retriever pgvector
└── rag.test.ts                  ← unit del validador de citas

evals/                           ← M4: Ring 2 del integrador
├── eval-set.json                ← 15 casos catalog/OOD/adversarial
└── run-evals.ts                 ← runner con asserts + threshold para CI
```

La frontera del producto LLM (chat, retry, fallback, providers, conversation store, prompt-template engine) vive en `code/packages/llm/` (`@curso-ai/llm`).

## Hitos por módulo

| Tag | Módulo | Hito |
|-----|--------|------|
| `proyecto-m1` | M1 — Fundamentos | "Hola, soy el asistente": primera llamada con abstracción multi-provider |
| `proyecto-m2` | M2 — Patrones LLM | Asistente conversacional con personalidad, intent, guardrails, contexto, memoria, prompts versionados, tests |
| `proyecto-m3` | M3 — Embeddings | Catálogo indexado en pgvector con `gemini-embedding-001` |
| `proyecto-m4` | M4 — RAG | Asistente que responde sobre el catálogo con retrieval + rerank + citas validadas + suite de evals |
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
