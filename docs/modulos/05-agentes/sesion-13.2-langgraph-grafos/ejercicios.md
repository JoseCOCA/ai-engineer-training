# Sesión 13.2 — Ejercicios

> **Tiempo estimado:** ~45 min total. Tres demos con LangGraph.js: hello world, ReAct agent, conditional routing. Scripts en [`code/m05-agentes/sesion-13.2/`](../../../../code/m05-agentes/sesion-13.2/).

---

## Setup base

```bash
pnpm install
```

`.env` con `GOOGLE_GENERATIVE_AI_API_KEY`.

---

## 1. Ejercicio guiado: hello world graph

**Objetivo:** ver la mecánica de `StateGraph` con dos nodos triviales y entender cómo se mueve el estado.

### 1.1. Probarlo

```bash
pnpm --filter @curso-ai/m05-sesion-13.2 hello-world
```

Define un `State` con `counter` y `messages`. Tres nodos: `incrementCounter`, `appendMessage`, `format`. Aristas lineales. La salida muestra cómo se mergea el estado en cada paso.

### 1.2. Para revisar

Abre `src/01-hello-world.ts` y modifica:
- Cambia el reducer de `messages` por uno que sobrescriba (sin `concat`). ¿Qué pasa?
- Agrega un cuarto nodo entre `appendMessage` y `format`. ¿Cómo declaras la nueva arista?

---

## 2. Ejercicio guiado: ReAct agent con `createReactAgent`

**Objetivo:** ver el equivalente LangGraph del demo de S12, y notar lo que el helper hace por vos.

### 2.1. Probarlo

```bash
pnpm --filter @curso-ai/m05-sesion-13.2 tool-agent
```

Una query, dos tools (`searchCatalog`, `getStockLevel`), `createReactAgent` arma el grafo internamente. Imprime los `messages` finales para que veas el flow.

### 2.2. Para reflexionar

- `createReactAgent` arma un grafo de 2 nodos (`agent`, `tools`) con conditional edges. Equivalente al `runAgent` de S12 — pero como grafo.
- Si querés ver el grafo: `console.log((await agent.getGraphAsync()).drawMermaid())`. Te imprime un diagrama Mermaid.

---

## 3. Ejercicio guiado: conditional routing (el patrón del integrador)

**Objetivo:** rutear a workers distintos según intent. Es el patrón que usaremos en el integrador en S14.2.

### 3.1. Probarlo

```bash
pnpm --filter @curso-ai/m05-sesion-13.2 routing
```

Tres queries que disparan tres branches:

- "¿Tienen mochilas?" → `catalogWorker`
- "¿Cuándo llega mi pedido P-1234?" → `ordersWorker`
- "Hola, ¿cómo estás?" → `generalWorker`

Cada worker es una función simple (no LLM real, mock para que sea claro). El classifier es un LLM que devuelve uno de tres valores. La conditional edge rutea.

### 3.2. Salida esperada (forma)

```
=== Query: "¿Tienen mochilas?" ===
[classify] intent=catalog
[catalogWorker] answer="Tenemos 3 mochilas..."

=== Query: "¿Cuándo llega mi pedido P-1234?" ===
[classify] intent=orders
[ordersWorker] answer="Tu pedido P-1234 está en camino..."

=== Query: "Hola, ¿cómo estás?" ===
[classify] intent=general
[generalWorker] answer="Lo siento, no puedo ayudarte con esa consulta."
```

### 3.3. Para revisar

- Mira `src/03-routing.ts`. La conditional edge usa el map style: `{ catalog: "catalogWorker", orders: "ordersWorker", general: "generalWorker" }`.
- Cambia un valor que devuelve el classifier por algo que no esté en el map. ¿Qué pasa? LangGraph lanza error en runtime — el grafo es estricto.

---

## Bonus (opcional)

1. **Visualiza el grafo.** `await graph.getGraphAsync()` devuelve un objeto con `drawMermaid()`. Pega el output en https://mermaid.live para ver el diagrama.
2. **Paralelismo.** Modifica el classifier para devolver dos branches a la vez (`["catalog", "orders"]`). Observa cómo LangGraph dispara ambos workers en paralelo y mergea los resultados.
3. **Test unitario de un nodo.** Escribe un test (vitest) que invoque `catalogWorker(state)` directamente con un estado mock y verifique el delta. Es una de las ventajas pedagógicas del modelo: nodos testeables aislados.

---

**Próxima sesión:** [`S13.3 — Estado, errores y observabilidad`](../sesion-13.3-estado-errores-observabilidad/) → checkpointers, retries, fallbacks, logging estructurado.
