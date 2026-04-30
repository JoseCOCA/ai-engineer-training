# Sesión 13.1 — Ejercicios

> **Tiempo estimado:** ~30 min total. Comparativa lado a lado de implementaciones del mismo agente. Scripts en [`code/m05-agentes/sesion-13.1/`](../../../../code/m05-agentes/sesion-13.1/).

---

## Setup base

```bash
pnpm install
```

Mismo `.env` que S12.

---

## 1. Ejercicio guiado: el mismo agente, dos implementaciones

**Objetivo:** ver el mismo agente escrito en dos niveles de abstracción y comparar líneas de código, debugabilidad y tradeoffs.

### 1.1. Probarlo

```bash
pnpm --filter @curso-ai/m05-sesion-13.1 compare
```

El script ejecuta el mismo agente (1 tool: `searchCatalog`, 1 query) en dos modos:

- **Modo A — Bare metal manual:** usa el helper `runAgent` de S12. Loop explícito, termination conditions explícitas, observabilidad explícita vía `onStep`.
- **Modo B — `stopWhen` del Vercel AI SDK:** una sola llamada a `generateText` con `stopWhen: stepCountIs(10)`. El SDK orquesta el loop por dentro.

Compara: líneas de código, latencia, tokens, info disponible para debug.

### 1.2. Salida esperada (forma)

```
=== Modo A · Bare metal manual ===
[step 1] toolCalls: [searchCatalog({query:"mochila"})]
  → [3 productos]
[step 2] finishReason: stop
  text: "Tenemos 3 mochilas..."
✓ 2 iters, 410 tokens, 1850ms.

=== Modo B · SDK con stopWhen ===
text: "Tenemos 3 mochilas..."
steps: 2 (info embedded en result.steps[])
totalTokens: ~410
elapsedMs: ~1820

Diferencia clave:
  - Modo A: debug step a step, override fácil de cualquier paso, instrumentación punto por punto.
  - Modo B: una llamada, menos código, menos control.
```

### 1.3. Para reflexionar

- Si tu caso es simple (este agente con 1 tool), `stopWhen` es suficiente y el bare metal manual es over-engineering.
- Si necesitas inyectar lógica entre steps (validación, HITL, logging custom), el bare metal manual lo permite y `stopWhen` no.

---

## 2. Ejercicio guiado: el costo de leer el framework

**Objetivo:** experimentar el "costo oculto" cuando algo falla y necesitas saber qué hace el framework.

### 2.1. La pregunta

Cuando ejecutas el modo B, el SDK envía mensajes intermedios al modelo (tool calls + tool results). ¿En qué orden? ¿Qué metadata agrega? ¿Cómo formatea los tool results?

### 2.2. Cómo investigarlo

Tres caminos:

1. **Documentación del SDK.** Buscá `stopWhen` en [https://sdk.vercel.ai/docs/foundations/agents](https://sdk.vercel.ai/docs/foundations/agents).
2. **Source del SDK.** Abrí `node_modules/ai/dist/index.mjs` y buscá la función que orquesta los steps. **Es legible** — son ~100 líneas.
3. **Logs del SDK.** Activa `DEBUG=ai:*` y mira lo que imprime.

El ejercicio: en menos de 10 minutos, contesta: ¿cómo difiere el `messages` array entre modo A y modo B en el step 2?

### 2.3. Lección

En modo A, vos sabes EXACTAMENTE qué hay en `messages` porque vos lo construiste. En modo B, el SDK lo construye y vos asumís que está bien.

> Esto es la abstracción que oscurece. Es el costo más subestimado cuando se adopta un framework.

---

## 3. Ejercicio guiado: probar la portabilidad

**Objetivo:** ver que las tools y el system prompt son **portables** entre implementaciones, mientras que el orquestador no lo es.

### 3.1. Lo que vas a notar

Abre `src/01-compare.ts`. Las tools (`searchCatalog`) y el system prompt están en `src/lib/shared.ts`. Las dos implementaciones (modo A y modo B) los importan idénticos.

### 3.2. La lección portable

Si mañana quieres migrar a LangGraph (S13.2):

- ✅ Las tools van tal cual.
- ✅ El system prompt va tal cual.
- ⚠️ El orquestador (loop) hay que reescribirlo.

Si tu código tiene esa separación, la migración es de un día. Si las tools están entrelazadas con el loop, son semanas.

### 3.3. Para revisar

Un anti-ejemplo: imagina que dentro de la `execute` de una tool, accedes al estado del loop ("si llevo 3 iteraciones, devuelve menos resultados"). Eso entrelaza tool con orquestador. Migrar a otro framework requiere repensar la tool. **Mantenlas puras.**

---

## Bonus (opcional)

1. **`stopWhen` con condición custom.** El SDK soporta `stopWhen` con función arbitraria. Implementa una que pare cuando el agente ya hizo 3 tool calls (independientemente de si finalizó). Compara con el bare metal manual.
2. **Switch a LangGraph "fake".** Reescribe el `runAgent` de modo A en estilo "grafo": una función `agentNode(state)` que devuelve `{ next: 'tool' | 'end', ... }`. Te prepara mentalmente para S13.2.
3. **Mide.** Corre cada modo 10 veces y promedia tokens y latencia. ¿Hay diferencia significativa?

---

**Próxima sesión:** [`S13.2 — LangGraph y grafos de ejecución`](../sesion-13.2-langgraph-grafos/) → primer agente real con LangGraph.js.
