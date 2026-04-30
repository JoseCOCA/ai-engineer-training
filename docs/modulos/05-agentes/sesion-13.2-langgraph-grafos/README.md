# Sesión 13.2 — LangGraph y grafos de ejecución

> **Módulo:** 5 — Orquestación de agentes · **Duración estimada:** 1.5h (~45 min lectura + ~45 min práctica) · **Formato:** 60% teoría / 40% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión podrás:

- Explicar el modelo mental de **grafo de ejecución**: nodos como funciones de estado, aristas como transiciones, estado como tipo central.
- Construir un agente con **`StateGraph`** de LangGraph.js: definir el estado, declarar nodos y aristas, compilar y ejecutar.
- Usar **`conditional edges`** para rutear el flujo según el estado actual (ej: "si intent es X, ir al worker A").
- Entender el patrón **ReAct con `createReactAgent`** y cuándo usar el helper vs construir el grafo manualmente.
- Reconocer cuándo el modelo de grafo gana sobre un loop manual (multi-branch, HITL, paralelismo) y cuándo es overkill.

## 2. Prerequisitos

- **S12 + S13.1 completas.** Agent loop manual entendido + decisión consciente de adoptar framework.
- **`GOOGLE_GENERATIVE_AI_API_KEY`** configurada.
- **LangGraph.js v1.x** ya cableado en el workspace de la sesión.

## 3. Conceptos clave

- **Grafo:** abstracción donde un agente se define como nodos (funciones que mutan el estado) y aristas (transiciones entre nodos).
- **`StateGraph`:** la API principal de LangGraph. Define el shape del estado y la topología del grafo.
- **Estado (State):** objeto compartido que cada nodo lee y muta. Definido con annotations (zod o LangGraph Annotations API).
- **Nodo:** función `(state) => Partial<State>`. Recibe el estado, devuelve los campos que modifica. LangGraph mergea automáticamente.
- **Arista (edge):** transición fija de un nodo a otro. `addEdge("nodeA", "nodeB")`.
- **Conditional edge:** transición dinámica que decide a qué nodo ir según el estado. `addConditionalEdges("nodeA", routerFn)`.
- **`START` / `END`:** nodos especiales. `START` es el punto de entrada; llegar a `END` termina la ejecución.
- **`MessagesAnnotation`:** annotation pre-built para grafos conversacionales con historial de mensajes (acumulable).
- **`createReactAgent`:** helper de LangGraph que arma un grafo ReAct estándar (tool-calling loop) en una línea.

## 4. Teoría

### 4.1. ¿Por qué un grafo?

En S12 implementaste un loop. Un loop es un grafo trivial: un solo nodo (el LLM) que se repite a sí mismo hasta terminar. **Funciona perfecto cuando el flujo es lineal.**

El problema empieza cuando aparecen branches:

```
                    ┌─────────────┐
   query ─────────→ │  classifier │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │ catalog │  │ orders  │  │ general │
        └────┬────┘  └────┬────┘  └────┬────┘
             │            │            │
             └────────────┼────────────┘
                          ▼
                    ┌─────────────┐
                    │   format    │
                    └──────┬──────┘
                           │
                           ▼
                          END
```

Implementar esto en bare metal es código de spaghetti — `if-else` anidados, estado compartido implícito, debug imposible. **Un grafo lo expresa naturalmente.**

> **Regla:** si tu agente tiene 3+ branches o 2+ paths que convergen, el grafo gana. Por debajo de eso, el loop manual es más simple.

### 4.2. Las tres primitivas: estado, nodos, aristas

#### Estado

El estado es un objeto que vive durante toda la ejecución. Cada nodo puede leerlo y mutarlo.

```typescript
import { Annotation } from "@langchain/langgraph";

const State = Annotation.Root({
  query: Annotation<string>,
  intent: Annotation<string>,
  result: Annotation<string>,
});
```

LangGraph genera el tipo `typeof State.State` automáticamente. Cada `Annotation<T>` es un campo del estado.

Para campos que **acumulan** (mensajes, historial, logs), usas un reducer:

```typescript
const State = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});
```

LangGraph aplica el reducer cuando dos nodos escriben al mismo campo.

#### Nodo

Un nodo es una función que recibe el estado y devuelve los campos a actualizar:

```typescript
async function classifyIntent(state: typeof State.State): Promise<Partial<typeof State.State>> {
  const intent = await detectIntent(state.query);
  return { intent };
}
```

LangGraph hace el merge: el estado pasado al siguiente nodo es `{ ...prev, ...result }`.

#### Arista

```typescript
const graph = new StateGraph(State)
  .addNode("classify", classifyIntent)
  .addNode("answer", answerNode)
  .addEdge(START, "classify")
  .addEdge("classify", "answer")
  .addEdge("answer", END);
```

`addEdge(from, to)` es una transición fija. Tras `from` siempre se ejecuta `to`.

#### Conditional edge — el corazón del modelo

```typescript
graph.addConditionalEdges(
  "classify",
  (state) => {
    if (state.intent === "catalog") return "catalogWorker";
    if (state.intent === "orders") return "ordersWorker";
    return "fallback";
  },
);
```

La función router recibe el estado y devuelve **el nombre del próximo nodo** (o un array si quieres disparar varios en paralelo).

### 4.3. El patrón ReAct con `createReactAgent`

LangGraph trae un helper que arma el loop ReAct (LLM ↔ tools) en una línea:

```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const agent = createReactAgent({
  llm: new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash", temperature: 0 }),
  tools: [searchCatalogTool, getStockTool],
  prompt: "Eres un asistente de TiendaPro...",
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "¿Tienen mochilas?" }],
});
```

Por dentro arma un grafo con dos nodos (`agent` que llama al LLM, `tools` que ejecuta tool calls) y una conditional edge que decide si terminar o seguir. Es **exactamente** lo que hicimos manualmente en S12 — pero como grafo.

> **Cuándo usar `createReactAgent`:** flujo ReAct estándar, sin lógica intermedia entre el LLM y las tools. Cuando necesitás más (validación, HITL, multi-agente), construye el grafo manualmente con `StateGraph`.

### 4.4. Tools en LangGraph

LangGraph reusa el formato de tools de LangChain. Difieren ligeramente del Vercel AI SDK pero la idea es la misma:

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const searchCatalog = tool(
  async ({ query }) => {
    const products = await db.search(query);
    return JSON.stringify(products);
  },
  {
    name: "searchCatalog",
    description: "Busca productos en el catálogo de TiendaPro.",
    schema: z.object({
      query: z.string().describe("Keyword corto."),
    }),
  },
);
```

Diferencias con el Vercel AI SDK:

- LangChain `tool()` espera el schema como `schema`, no `inputSchema`.
- El return debe ser **string** o un `ToolMessage`. Si devolvés un objeto, LangChain lo serializa.
- La firma del callback es `(args, config) => result`, similar pero no idéntica.

Las tools que armaste con Vercel AI SDK NO se pueden usar tal cual en LangGraph. Es un **costo real de la migración**.

### 4.5. Conditional routing — el caso real

Aprovechemos la fortaleza del grafo: rutear a workers según intent.

```typescript
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

const State = Annotation.Root({
  query: Annotation<string>,
  intent: Annotation<"catalog" | "orders" | "general">,
  answer: Annotation<string>,
});

async function classify(state: typeof State.State) {
  const intent = await detectIntent(state.query);  // tu LLM clasificador
  return { intent };
}

async function catalogWorker(state: typeof State.State) {
  const answer = await ragPipeline(state.query);
  return { answer };
}

async function ordersWorker(state: typeof State.State) {
  const answer = await orderTool(state.query);
  return { answer };
}

async function generalWorker(state: typeof State.State) {
  const answer = `Lo siento, no puedo ayudarte con esa consulta.`;
  return { answer };
}

const graph = new StateGraph(State)
  .addNode("classify", classify)
  .addNode("catalog", catalogWorker)
  .addNode("orders", ordersWorker)
  .addNode("general", generalWorker)
  .addEdge(START, "classify")
  .addConditionalEdges("classify", (state) => state.intent, {
    catalog: "catalog",
    orders: "orders",
    general: "general",
  })
  .addEdge("catalog", END)
  .addEdge("orders", END)
  .addEdge("general", END)
  .compile();

const result = await graph.invoke({ query: "¿Tienen mochilas?" });
console.log(result.answer);
```

Cinco cosas a notar:

1. **El estado declara explícitamente `intent`** con sus valores válidos. Si el classifier devuelve algo distinto, falla en runtime — pero al menos se ve.
2. **`addConditionalEdges` con map.** El segundo argumento es la función router; el tercero es un map del valor al nombre del nodo. Más legible que el `if-else` puro.
3. **Cada worker termina con `END`.** Tres ramas independientes que convergen al final.
4. **`graph.compile()`** valida la topología (todos los nodos referenciados existen, etc.) y devuelve un objeto invocable.
5. **`graph.invoke(initialState)`** ejecuta. Devuelve el estado final.

### 4.6. Diferencias importantes con bare metal

#### Diferencia 1: el estado es centralizado

En bare metal, el estado vive en variables locales del loop. En LangGraph, vive en el `State` y se pasa entre nodos. Ventaja: cada nodo es testeable aislado (lo invocás con un estado mock, verificás el delta).

#### Diferencia 2: el flujo es declarativo

En bare metal, el flujo es imperativo (`while`, `if-else`, `for`). En LangGraph, lo declarás como nodos y aristas. Ventaja: el grafo es **inspeccionable** (`graph.getGraph().drawMermaid()` te da un diagrama).

#### Diferencia 3: paralelismo built-in

```typescript
graph.addConditionalEdges("classify", () => ["catalog", "orders"]);
// dispara catalog Y orders en paralelo
```

En bare metal, puedes con `Promise.all`, pero el orquestador sabe que es paralelo solo por convención. En LangGraph es first-class.

#### Diferencia 4: checkpointing first-class

LangGraph soporta checkpointers (memory, SQLite, Postgres) que pausan y reanudan grafos. Sin esto, persistencia es tu problema. Lo veremos a fondo en S13.3.

### 4.7. Cuándo NO usar LangGraph

A pesar de las virtudes, NO conviene:

- **Agente lineal con 1-2 tools.** El SDK de Vercel + un loop te lleva más rápido.
- **No vas a usar checkpointers ni multi-agente ni HITL.** Estás pagando complejidad sin recibir nada.
- **Tu equipo no se siente cómodo con DSLs.** El modelo de grafo requiere aprender la API.
- **Necesitas un binding muy específico de un proveedor (ej: structured output con JSON Schema custom).** A veces los wrappers de LangChain abstraen mal y perdés capacidades del SDK del proveedor.

### 4.8. La integración con Gemini en LangGraph

Para usar Gemini con LangGraph en TS:

```typescript
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0,
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});
```

Esto reemplaza al `buildModel(PRIMARY_PROVIDER)` que usábamos con Vercel AI SDK. **Es otro SDK** — LangChain con su propia capa de abstracción de modelos.

> **Consecuencia operativa:** en el integrador hasta M4, los modelos vienen de `@curso-ai/llm` (que usa Vercel AI SDK). En M5 con LangGraph, vamos a tener **dos integraciones de Gemini coexistiendo**: la del SDK de Vercel para el RAG pipeline (M4) y la de LangChain para el supervisor multi-agente (M5). No es ideal, pero es el costo real de mezclar frameworks. En S14.2 evaluamos consolidar.

## 5. Patrones y antipatrones

### Patrones

- **Estado plano y bien tipado.** Annotations explícitas; un campo por concepto.
- **Nodos puros.** Recibe estado, devuelve delta. Sin side effects globales.
- **Routing con map**, no `if-else` en la función router. Más legible.
- **Reducers para campos acumulables.** `messages`, `logs`, `errors` deben sumar, no sobreescribir.
- **`compile()` antes de usar.** El grafo no se invoca crudo; se compila primero.
- **`graph.getGraph().drawMermaid()` en debug.** Visualizar el grafo sirve mucho cuando crece.

### Antipatrones

- **Estado con campos que no usa nadie.** El estado es contrato: no metas basura.
- **Side effects en nodos** (escribir BD, mandar email). Pone esos efectos en tools, no en nodos.
- **Conditional edges con lógica complicada inline.** Extrae la decisión en una función con nombre.
- **Mezclar tools de Vercel AI SDK con LangGraph.** No son compatibles. Re-escribilas con `tool()` de `@langchain/core/tools`.
- **Sin checkpointer en agentes que duran horas.** Vas a perder estado en el primer crash.

## 6. Conexión con TiendaPro

S13.2 NO modifica el integrador. Los demos de esta sesión usan el catálogo mock para mantener la independencia. El swap del integrador a LangGraph + multi-agente ocurre en **S14.2** (después de S13.3 con error handling y observabilidad y de S14.1 con patrones multi-agente).

Lo que vas a ver al ejecutar los ejercicios:

- **01-hello-world:** un grafo trivial con dos nodos para entender la mecánica de estado/nodo/arista.
- **02-tool-agent:** un agente ReAct con `createReactAgent` y dos tools de catálogo. La versión LangGraph del demo de S12.
- **03-conditional-routing:** el caso real — un classifier ruta a tres workers distintos según intent. **Este es el patrón que usaremos en el integrador en S14.2.**

## 7. Resumen

Tres ideas para llevarte:

1. **El grafo es el modelo mental.** Estado + nodos + aristas. Cuando el flujo deja de ser lineal, el grafo gana.
2. **`createReactAgent` para el caso simple, `StateGraph` para el caso real.** El helper te da el loop ReAct en una línea; cuando necesitas branches, conditional edges o HITL, vas al `StateGraph`.
3. **El costo real es la migración de tools.** Las tools de Vercel AI SDK no son las de LangChain. Mantenelas aisladas para que migrar sea solo reescribirlas, no reescribir el flujo entero.

## 8. Preguntas de auto-evaluación

1. Tu agente tiene 4 branches según intent. Argumenta con dos puntos por qué `StateGraph` con conditional edges es mejor que un `if-else` en bare metal.
2. ¿Qué hace `Annotation<string[]>({ reducer: (l, r) => l.concat(r) })` y por qué es importante para campos como `messages`?
3. Diferencia operativa entre `addEdge("a", "b")` y `addConditionalEdges("a", router)`. Da un ejemplo de cada uno.
4. Implementaste un agente con `createReactAgent` y funciona pero hay un bug que cuesta debuggear. ¿Cuándo y cómo migrarías a `StateGraph` manual?
5. Tu integrador tiene tools en Vercel AI SDK del M4. Migrás a LangGraph. ¿Qué cambios necesitás hacer y qué NO cambia?
6. Diseña el grafo (en pseudocódigo) de un asistente de soporte que: clasifica intent, si es `pregunta` hace RAG, si es `pedido` consulta una BD, si es `escalation` deriva a humano, y al final formatea la respuesta. Identifica nodos, aristas y dónde están los conditional edges.

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 3 demos en LangGraph.

**Próxima sesión:** [`S13.3 — Estado, errores y observabilidad`](../sesion-13.3-estado-errores-observabilidad/) → checkpointers, retries, logging, fallbacks.
