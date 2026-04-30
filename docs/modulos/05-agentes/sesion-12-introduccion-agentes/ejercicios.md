# Sesión 12 — Ejercicios

> **Tiempo estimado:** ~65 min total. Cuatro demos del agent loop sin framework: loop básico, tool calling con dos tools, ReAct explícito y los 4 mecanismos de terminación. Scripts en [`code/m05-agentes/sesion-12/`](../../../../code/m05-agentes/sesion-12/).

---

## Setup base

```bash
pnpm install
```

`.env` con `GOOGLE_GENERATIVE_AI_API_KEY` (o el provider que prefieras vía `DEFAULT_LLM_PROVIDER`).

---

## 1. Ejercicio guiado: agent loop manual con una tool

**Objetivo:** ver el loop más simple posible. Una tool, una pregunta del usuario, el agente decide cuándo llamarla y cuándo responder.

### 1.1. Probarlo

```bash
pnpm --filter @curso-ai/m05-sesion-12 agent-loop
```

El script:

1. Define una tool `getProductCount(category)` mock (devuelve un número).
2. Implementa el loop manual: llama al LLM, ejecuta tool calls, repite hasta `finishReason === "stop"` o `MAX_ITER`.
3. Imprime cada step (tool call + result) para que veas la mecánica.

### 1.2. Salida esperada (forma)

```
=== Agent loop ===
Pregunta: "¿Cuántos productos tienen en mochilas y cuántos en tiendas?"

[step 1] LLM piensa...
  toolCalls: [
    { name: "getProductCount", args: { category: "mochilas" } },
    { name: "getProductCount", args: { category: "tiendas" } }
  ]
  ejecutando: getProductCount({"category":"mochilas"}) → { count: 3 }
  ejecutando: getProductCount({"category":"tiendas"}) → { count: 2 }

[step 2] LLM piensa...
  finishReason: stop
  text: "Tenemos 3 mochilas y 2 tiendas en el catálogo."
```

### 1.3. Para revisar

- Abre `src/01-agent-loop.ts`. Identifica las tres partes: definición de tool, loop, terminación.
- Cambia el `MAX_ITER` a 1 y vuelve a correr. ¿Qué pasa?
- Cambia la pregunta a algo que NO requiera tool (ej: "¿Cuál es la capital de Francia?"). El loop debería terminar en step 1 sin tool calls.

---

## 2. Ejercicio guiado: dos tools y combinación

**Objetivo:** ver cómo el agente combina múltiples tools para responder preguntas que requieren múltiples sub-tareas.

### 2.1. Probarlo

```bash
pnpm --filter @curso-ai/m05-sesion-12 tool-calling
```

El script define:

- `searchCatalog(query)` — busca productos por keyword (mock simple).
- `getStockLevel(productId)` — devuelve cantidad disponible (mock).

Hace tres queries que requieren combinaciones distintas:

- "¿Tienen mochilas?" → solo `searchCatalog`.
- "¿Hay stock de TP-MOCH-01?" → solo `getStockLevel`.
- "¿Tienen mochilas y cuál tiene más stock?" → `searchCatalog` + N llamadas a `getStockLevel`.

### 2.2. Salida esperada (forma)

```
Query: "¿Tienen mochilas y cuál tiene más stock?"

[step 1] toolCalls: [searchCatalog({query:"mochilas"})]
  → [{id:"TP-MOCH-01"}, {id:"TP-MOCH-02"}, {id:"TP-MOCH-03"}]

[step 2] toolCalls: [
  getStockLevel({productId:"TP-MOCH-01"}),
  getStockLevel({productId:"TP-MOCH-02"}),
  getStockLevel({productId:"TP-MOCH-03"})
]
  → 12, 5, 8

[step 3] finishReason: stop
  text: "Tenemos 3 mochilas. La de mayor stock es TP-MOCH-01 con 12 unidades."
```

### 2.3. Para reflexionar

- Observa que en step 2, el agente llama 3 veces a `getStockLevel` **en paralelo** (un solo step). Eso es **batching de tool calls**, soportado nativamente por la mayoría de LLMs.
- Si el agente NO batch (una llamada por step), latencia y costo se multiplican. Verifica con tu modelo.

---

## 3. Ejercicio guiado: ReAct con razonamiento explícito

**Objetivo:** sentir la diferencia cuando el agente verbaliza su razonamiento antes de cada acción. Útil para debug y para casos donde el "thought" agrega valor.

### 3.1. Probarlo

```bash
pnpm --filter @curso-ai/m05-sesion-12 react-explicit
```

El script fuerza al modelo a devolver su razonamiento antes de cada tool call vía instrucciones en el system prompt:

```
Antes de llamar a una tool, explica en 1-2 oraciones por qué la llamas
en una línea que empiece con "Thought:".
Después de recibir el resultado, antes de la siguiente acción, devuelve
una línea "Observation interpretation:".
```

### 3.2. Salida esperada (forma)

```
Query: "¿Cuál es la mochila más barata que tienen?"

[step 1]
  Thought: necesito buscar mochilas en el catálogo y luego comparar precios.
  toolCall: searchCatalog({query:"mochilas"})
  Observation: [{id:"TP-MOCH-01", price:120}, {id:"TP-MOCH-02", price:280}, ...]
  Observation interpretation: tengo 3 mochilas con precios. La más barata es TP-MOCH-01 a 120.

[step 2]
  Thought: ya tengo la respuesta directamente.
  finishReason: stop
  text: "La mochila más barata es la TP-MOCH-01 (Mochila Trekker 30L) a $120."
```

### 3.3. Para revisar

- El `Thought` y `Observation interpretation` son visibles en la respuesta. Útil para debug y para mostrar el razonamiento al usuario.
- En producción, los pasarías a un sistema de tracing (Langfuse, LangSmith) en lugar de imprimir.
- Tradeoff: ReAct explícito agrega tokens de output → más caro y más lento. Úsalo para debugging y para casos críticos, no para todo.

---

## 4. Ejercicio guiado: termination conditions y modos de fallar

**Objetivo:** provocar a propósito los modos de fallar del README y observar cómo cada termination condition los atrapa.

### 4.1. Probarlo

```bash
pnpm --filter @curso-ai/m05-sesion-12 termination
```

Cuatro escenarios:

- **A — happy path:** el agente termina solo con `finishReason: stop`.
- **B — max_iter:** una tool deliberadamente confusa hace que el agente entre en loop. `MAX_ITER=3` corta.
- **C — token budget:** una tool que devuelve mucho texto agota el budget de tokens y disparamos un fallback.
- **D — timeout:** una tool con `setTimeout` lento agota el wall clock.

### 4.2. Salida esperada (forma)

```
=== A. Happy path ===
✓ Terminó en 2 iteraciones, 320 tokens, 950ms.

=== B. Max iterations ===
✗ Loop detectado: hit MAX_ITER=3.
  Última tool call repetida: getProductCount({"category":"unknown"}) × 3.
  Fallback: "No pude resolver tu solicitud, ¿puedes reformular?"

=== C. Token budget ===
✗ Token budget agotado: 50.000 tokens.
  Fallback con respuesta parcial.

=== D. Timeout ===
✗ Timeout después de 5s.
  Fallback: "Lo siento, la consulta tomó más tiempo del esperado."
```

### 4.3. Para revisar

- Cada termination condition tiene un mensaje de fallback distinto. **No devuelvas el error técnico al usuario.** Devolvé un mensaje útil.
- El loop detection (mismas args dos veces seguidas) es opcional pero muy útil. Implementado en `src/lib/agent.ts` con un Set de hashes de tool calls.

---

## Bonus (opcional)

1. **Tool con error.** Hacé que `getStockLevel` lance un error aleatorio el 30% de las veces. Modifica el loop para que pase el error como `Observation` al modelo y veas cómo replanifica.
2. **Logs estructurados.** Reemplaza `console.log` por logs JSON con timestamp + step + tokens. Salida directa a un archivo `logs/agent-trace.jsonl`.
3. **`stopWhen` del SDK.** Reescribe `01-agent-loop.ts` usando `stopWhen: stepCountIs(N)` en vez del loop manual. Compara líneas de código y debugabilidad.

---

**Próxima sesión:** [`S13.1 — Framework vs construir el tuyo`](../sesion-13.1-framework-vs-bare-metal/) → comparativa Vercel AI SDK + LangGraph + OpenAI Assistants.
