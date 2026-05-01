# TiendaPro — Proyecto integrador

Asistente conversacional para un e-commerce ficticio. Crece módulo a módulo a lo largo del curso.

## Estado actual — Hito M6 (`proyecto-m6`) — CIERRE DEL CURSO

**Asistente conversacional multi-agente con observabilidad y deployment listo para producción.** Capacidades finales del proyecto integrador:

- **Chat service base** — `@curso-ai/llm` con retry + fallback + instrumentación.
- **Guardrails** de input/output (`src/lib/guardrails.ts`).
- **RAG pipeline (M4)**: retrieve pgvector → listwise rerank → structured output con citas validadas. Envuelto como tool del catalog worker.
- **Supervisor multi-agente con LangGraph (M5)**: classifier puro que rutea a 3 workers especializados (`catalogWorker`, `ordersWorker`, `escalationWorker`). Tools aisladas por worker.
- **Sandboxing**: `recursionLimit=25` + output validation con zod en el grafo.
- **Observabilidad con Langfuse (M6)**: cada `runAgent()` emite trace + span con userId/sessionId opcional. Si las env keys no están, las funciones son no-ops y el agente funciona idéntico.
- **Deployment con Docker (M6)**: `Dockerfile` multi-stage + `docker-compose.production.yml` con postgres + healthcheck.
- **Memoria conversacional** — `ConversationStore` por turnos del usuario.
- **Tests Ring 1** — unit del validador de citas + del classifier (`test:rag`, `test:agent`).
- **Suite de evals Ring 2** — `evals/eval-set.json` + runner con 5 asserts (`test:evals`).

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
=== TiendaPro — conversación con Carlos (M5 multi-agente) ===

> Hola, soy Carlos. Estoy buscando equipo de senderismo.
  [intent: escalation, 850ms]
  ¡Hola Carlos! Soy el asistente de TiendaPro. ¿En qué puedo ayudarte?

> ¿Tienen mochilas para senderismo de fin de semana?
  [intent: catalog, 2400ms]
  Para senderismo de fin de semana recomiendo la Mochila Trekker 30L (TP-MOCH-01)...

> ¿Cuál es el estado de mi pedido P-1234?
  [intent: orders, 1120ms]
  Tu pedido P-1234 está en tránsito y llega el 2026-05-03.

> Esto no funciona NADA, no me sirve nada de lo que dices
  [intent: escalation, 980ms]
  Lamento la frustración, Carlos. Te derivé al equipo humano. Tu ticket es TKT-3812.
```

## Tests

```bash
pnpm test                # todos los tests (snapshot + regression + retrieval + rag + agent)
pnpm run test:snapshot   # snapshot del template renderizado
pnpm run test:regression # regression sobre eval-set de prompts (hace llamadas reales)
pnpm run test:retrieval  # smoke test del retriever pgvector
pnpm run test:rag        # unit del validador de citas RAG
pnpm run test:agent      # unit del classifier del supervisor multi-agente (M5)
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
├── index.ts                     ← demo de conversación con multi-agente (M5)
├── lib/
│   ├── intent.ts                ← classifyIntent legacy del M2 (mantenido para compatibilidad)
│   ├── guardrails.ts            ← validateInput / validateOutput
│   ├── catalog.ts               ← findProducts(query) — legacy del M2
│   ├── logger.ts                ← logChatResponse → logs/calls.jsonl
│   └── prompts.ts               ← render bound al directorio prompts/
├── retrieval/
│   └── pgvector-store.ts        ← cliente pgvector (M3)
├── rag/                         ← M4: pipeline RAG (ahora envuelto como tool)
│   ├── pipeline.ts              ← runRagPipeline
│   ├── citations.ts             ← validateCitations
│   └── embedder.ts              ← embedQuery con gemini-embedding-001
└── agent/                       ← M5: supervisor multi-agente con LangGraph
    ├── index.ts                 ← runAgent(query) → { answer, intent, elapsedMs }
    ├── supervisor.ts            ← StateGraph con classifier + workers + validateOutput
    ├── tools/
    │   ├── search-catalog.ts    ← envuelve runRagPipeline como LangChain tool
    │   ├── get-order-status.ts  ← BD mock de pedidos
    │   └── escalate-to-human.ts ← creación de ticket
    └── workers/
        ├── catalog-worker.ts    ← createReactAgent con searchCatalog
        ├── orders-worker.ts     ← createReactAgent con getOrderStatus
        └── escalation-worker.ts ← createReactAgent con escalateToHuman

__tests__/
├── prompts.snapshot.test.ts     ← snapshot del template renderizado
├── prompts.regression.test.ts   ← regression sobre eval-set.json
├── retrieval.test.ts            ← smoke del retriever pgvector
├── rag.test.ts                  ← unit del validador de citas (M4)
└── agent.test.ts                ← unit del classifier multi-agente (M5)

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
| `proyecto-m5` | M5 — Agentes | Supervisor multi-agente con LangGraph: catalog (RAG) + orders + escalation. Tools aisladas, output validation, recursionLimit |
| `proyecto-m6` | M6 — LLMOps | Observabilidad con Langfuse + Dockerfile multi-stage + docker-compose.production con healthcheck |

## Documentación pedagógica

Cada capacidad de TiendaPro se desarrolla en su sesión correspondiente bajo `docs/modulos/MM-modulo-slug/sesion-NN.X-tema/`.

## Proveedor recomendado del Módulo 1

Tras la comparativa de [S01.2](../../docs/modulos/01-fundamentos/sesion-01.2-respuesta-comparativa/), la recomendación canónica del curso para el MVP de TiendaPro es **Google Gemini 2.5 Flash**:

- **Free tier amplio** (~1.500 req/día) — no obstaculiza el desarrollo ni los ejercicios.
- **Cloud-only**, no requiere hardware local potente.
- **Latencia razonable** y **costo proyectado** ~$104/mes a 10K mensajes/día (vs ~$385/mes con Claude Haiku 4.5).

Esta es **una recomendación, no una imposición**. La abstracción multi-provider absorbe el cambio. A revisar en **Módulo 4** cuando podamos comparar proveedores con métricas de calidad rigurosas (RAGAS, Promptfoo).
