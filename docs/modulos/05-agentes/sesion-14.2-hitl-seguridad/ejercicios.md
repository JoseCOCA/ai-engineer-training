# Sesión 14.2 — Ejercicios

> **Tiempo estimado:** ~30 min total. Tres demos del módulo + cambios al integrador. Scripts en [`code/m05-agentes/sesion-14.2/`](../../../../code/m05-agentes/sesion-14.2/).

---

## Setup base

```bash
pnpm install
docker compose up -d postgres
pnpm --filter @curso-ai/proyecto-integrador index-catalog  # si no lo hiciste antes
```

---

## 1. Ejercicio guiado: approval gate con interrupt

```bash
pnpm --filter @curso-ai/m05-sesion-14.2 approval-gate
```

Un agente "ficticio" intenta cancelar un pedido. Antes de ejecutar la tool destructiva, el grafo se pausa (`interrupt`) esperando aprobación. El demo simula dos paths:

- Aprobado → ejecuta `cancelOrder`.
- Rechazado → aborta con mensaje al usuario.

### Para revisar

- `interrupt` requiere checkpointer (MemorySaver en el demo). Sin él, el grafo no puede pausar.
- El thread_id es el handle para retomar la sesión cuando el humano responde.

---

## 2. Ejercicio guiado: sandboxing en cuatro capas

```bash
pnpm --filter @curso-ai/m05-sesion-14.2 sandboxing
```

El demo provoca cada falla y muestra cómo cada capa la atrapa:

- **Capa 1:** loop infinito → `recursionLimit` corta.
- **Capa 2:** consumo de tokens excesivo → presupuesto disparado por un nodo guard.
- **Capa 3:** intento de llamar a una tool no asignada → la tool no existe en el worker.
- **Capa 4:** output con datos inválidos → schema zod rechaza, fallback al usuario.

---

## 3. Ejercicio guiado: escalation como tool

```bash
pnpm --filter @curso-ai/m05-sesion-14.2 escalation
```

Un mini-agente ReAct con tres tools: `searchCatalog`, `getStockLevel`, `escalateToHuman`. El system prompt instruye cuándo escalar (frustración del usuario, consulta fuera de alcance, error repetido).

Tres queries:

- "¿tienen mochilas?" → catalog
- "no funciona NADA, ya hice 5 intentos" → escalation (frustración)
- "¿pueden enviar a la luna?" → escalation (fuera de alcance)

El demo verifica que el agente capture buen contexto al escalar (motivo, contexto que el humano necesita).

---

## 4. Cambio en el proyecto integrador (TiendaPro)

Este es el cierre del Módulo 5. El asistente conversacional de TiendaPro pasa a multi-agente con LangGraph.

### 4.1. Qué cambia

```
src/agent/                    ← NUEVO en M5
├── supervisor.ts             ← classifier + grafo principal
├── tools/                    ← tools envueltas como LangChain tools
│   ├── search-catalog.ts     ← envuelve el RAG pipeline de M4
│   ├── get-order-status.ts   ← consulta BD mock de pedidos
│   └── escalate-to-human.ts
├── workers/
│   ├── catalog-worker.ts
│   ├── orders-worker.ts
│   └── escalation-worker.ts
└── index.ts                  ← runAgent(message) → response
```

`src/index.ts` ahora delega al supervisor multi-agente. El RAG pipeline de M4 sigue funcionando dentro del catalog worker (envuelto como tool LangChain).

### 4.2. Probarlo

```bash
pnpm --filter @curso-ai/proyecto-integrador dev
```

La conversación demo ahora muestra cómo el supervisor rutea a cada worker según intent.

---

## Bonus

1. **Approval gate real para una tool destructiva.** Modifica el integrador para agregar una tool `cancelOrder` y un approval gate antes. Implementa el polling del estado del thread_id desde el "frontend".
2. **Output validation con LLM rubric.** Después del worker, agrega un nodo que evalúe el output con un LLM judge ligero antes de devolver al usuario.
3. **Mide.** Corre los evals del integrador (S11.3) sobre la versión M5. ¿Subió o bajó el pass rate? ¿Por qué?

---

**Cierre del módulo:** después de pasar los demos, hacemos el commit `feat(proyecto-integrador): cierra Módulo 5` y el tag `proyecto-m5`.
