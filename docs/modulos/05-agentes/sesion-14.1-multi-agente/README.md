# Sesión 14.1 — Arquitecturas multi-agente y patrones de comunicación

> **Módulo:** 5 — Orquestación de agentes · **Duración estimada:** 1.5h (~45 min lectura + ~45 min práctica) · **Formato:** 60% teoría / 40% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión podrás:

- Distinguir los **cuatro patrones canónicos** de multi-agente (Supervisor, Hierarchical, Network, Sequential) y elegir el correcto según el problema.
- Implementar un **supervisor** que rutea entre N workers especializados — el patrón más usado en producción.
- Implementar una **cadena secuencial** (research → write → review) donde el output de cada agente alimenta al siguiente.
- Reconocer cuándo **un solo agente con muchas tools** vence a multi-agente, y cuándo no.
- Diseñar la **comunicación entre agentes**: estado compartido, mensajes explícitos, handoffs.

## 2. Prerequisitos

- **S13.2 + S13.3 completas.** `StateGraph`, conditional edges, checkpointer entendidos.
- **`GOOGLE_GENERATIVE_AI_API_KEY`** configurada.

## 3. Conceptos clave

- **Multi-agente:** sistema con N agentes que se coordinan para resolver una tarea. Cada agente tiene su rol (su system prompt), sus tools y su contexto.
- **Supervisor:** un agente "gerente" que recibe la query, decide qué worker debe atenderla, y delega.
- **Worker:** agente especializado en una tarea (ej: catalog worker, orders worker, escalation worker).
- **Hierarchical:** supervisor → sub-supervisor → workers. Útil cuando hay 10+ workers que se agrupan por dominio.
- **Network (peer-to-peer):** los agentes se llaman entre sí sin un coordinador central. Más flexible, más caótico.
- **Sequential:** los agentes corren en orden fijo. Output de uno = input del siguiente. Útil para pipelines de generación (research → draft → critique → revise).
- **Handoff:** transferencia de control de un agente a otro. Puede ser explícita (tool `handoffTo`) o implícita (conditional edge).
- **Estado compartido:** el `State` del grafo. Todos los agentes leen y mutan el mismo estado.

## 4. Teoría

### 4.1. ¿Por qué multi-agente?

Un solo agente con todas las tools del mundo **funciona** — y a veces **funciona mejor** que multi-agente. Antes de meter complejidad, considera el caso simple.

#### Cuándo multi-agente NO ayuda

- **Un solo dominio cohesivo.** "Buscar productos del catálogo + verificar stock" es una sola tarea conceptual. Agente único con dos tools alcanza.
- **N tools < 10.** Un solo agente maneja bien hasta ~10 tools. Más allá, el LLM se confunde sobre cuándo usar cada una.
- **Calidad consistente importa.** Cada hop entre agentes pierde contexto. La respuesta del worker se "traduce" por el supervisor; matices se pierden.

#### Cuándo multi-agente SÍ ayuda

- **Múltiples dominios** con system prompts incompatibles. Un agente que es a la vez asistente de soporte (cordial, conciso) y analista de fraude (escéptico, suspicaz) tiene un system prompt esquizofrénico. Mejor dos agentes.
- **Especialización con datos privados.** El catalog worker tiene acceso a `searchCatalog` y BD de productos; el orders worker tiene acceso a la BD de pedidos con datos sensibles. Aislar el acceso por agente es **principio de menor privilegio**.
- **Modelos distintos por agente.** Un classifier rápido y barato (Haiku, Flash) + un generator más capaz (Sonnet, Pro). Cada uno con su modelo óptimo.
- **Paralelismo de tareas.** Research multi-fuente: 3 agentes buscan en paralelo, supervisor agrega.

> **Regla:** multi-agente es la respuesta cuando hay **especialización**. No cuando hay solo **muchas tools**.

### 4.2. Los cuatro patrones canónicos

#### Patrón 1: Supervisor

```
       ┌─────────────┐
       │  supervisor │  ← rutea según query
       └──────┬──────┘
              │
       ┌──────┼──────┬──────┐
       ▼      ▼      ▼      ▼
   worker1 worker2 worker3 ...
       │      │      │
       └──────┼──────┘
              ▼
            END
```

El supervisor es un agente que decide a qué worker delegar. Implementación con LangGraph: classifier → conditional edge → workers. Es exactamente el patrón de S13.2.

**Cuándo usarlo:** la mayoría de los casos de soporte, asistentes con múltiples capacidades, routers de intent.

**Anti-patrón:** un supervisor que reescribe la respuesta del worker antes de devolverla. Pierde matices del worker; introduce alucinación. Si el worker ya generó respuesta de calidad, el supervisor solo debe **rutear**, no reformular.

#### Patrón 2: Hierarchical

```
              ┌─────────────────┐
              │  meta-supervisor│
              └────┬───────┬────┘
                   │       │
        ┌──────────┘       └──────────┐
        ▼                             ▼
┌──────────────┐              ┌──────────────┐
│  supervisorA │              │  supervisorB │
└──┬──────┬────┘              └──┬──────┬────┘
   │      │                      │      │
   ▼      ▼                      ▼      ▼
 w1     w2                     w3     w4
```

Dos niveles. El meta-supervisor decide el área (soporte vs ventas). El supervisor de cada área rutea a su worker.

**Cuándo usarlo:** sistemas con 15+ agentes especializados que se agrupan en dominios.

**Costo:** dos hops de routing por query. Latencia y costo se duplican.

#### Patrón 3: Network (peer-to-peer)

```
   ┌───────┐         ┌───────┐
   │agente1│ ←──────→│agente2│
   └───┬───┘         └───┬───┘
       ↕                  ↕
   ┌───────┐         ┌───────┐
   │agente3│ ←──────→│agente4│
   └───────┘         └───────┘
```

Los agentes se invocan entre sí sin un coordinador central. Cualquiera puede pasar control a cualquiera vía un `handoff`.

**Cuándo usarlo:** investigación abierta, brainstorming, escenarios donde el flujo no es predecible.

**Anti-patrón:** sin guardrails, los agentes pueden entrar en loop (A llama a B, B llama a A). Necesita `MAX_HOPS` global.

#### Patrón 4: Sequential

```
  query → agent1 → agent2 → agent3 → END
          (research) (write) (review)
```

Cadena fija. Cada agente toma el output del anterior como input. Útil para tareas multi-stage donde el orden importa.

**Cuándo usarlo:** generación de contenido (research → outline → draft → revise), pipelines de procesamiento (extract → transform → validate → output).

**Diferencia con un solo agente con tools:** las tools se invocan a discreción del LLM; en sequential, el orden está garantizado por el grafo. **Más predecible, menos flexible.**

### 4.3. Estado compartido vs mensajes explícitos

Dos formas de comunicar agentes:

#### Forma A: estado compartido (LangGraph default)

Cada agente lee y muta el `State`. Lo que un agente "deja" en el state, el siguiente lo lee.

```typescript
const State = Annotation.Root({
  query: Annotation<string>,
  intent: Annotation<string>,        // classifier escribe acá
  draftAnswer: Annotation<string>,   // worker escribe acá
  finalAnswer: Annotation<string>,   // formatter escribe acá
});
```

**Pro:** simple, inspeccionable, type-safe.
**Contra:** todos los agentes ven todo el estado. Si quieres aislar info entre agentes, no podes.

#### Forma B: mensajes explícitos

Cada agente recibe un mensaje del agente anterior (formato `Message` de LangChain).

```typescript
const State = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});
```

Cada agente lee el último mensaje y agrega su respuesta. Comunicación tipo conversación entre agentes.

**Pro:** modela bien escenarios donde los agentes "conversan" (debate, negociación).
**Contra:** los matices se pierden si un agente reformula demasiado.

> **Regla operativa:** estado compartido para casi todo. Mensajes explícitos solo cuando los agentes literalmente conversan entre sí.

### 4.4. Handoffs explícitos

En LangGraph 1.x, un agente puede "transferir el turno" a otro vía un `Command`:

```typescript
import { Command } from "@langchain/langgraph";

async function classify(state) {
  const intent = await llm.invoke(state.query);
  if (intent === "catalog") {
    return new Command({ goto: "catalogWorker", update: { intent } });
  }
  if (intent === "orders") {
    return new Command({ goto: "ordersWorker", update: { intent } });
  }
  return new Command({ goto: "fallback", update: { intent } });
}
```

`Command` retorna desde un nodo y dice "ahora ve a este otro nodo". Reemplaza la conditional edge con lógica embebida en el nodo. **Útil cuando la decisión depende de tools** que el classifier llamó.

### 4.5. Multi-agente vs single agent con muchas tools

Compara los dos enfoques para "asistente que busca catálogo Y consulta pedidos":

#### Single agent

```typescript
const agent = createReactAgent({
  llm,
  tools: [searchCatalog, getStockLevel, getOrderStatus, escalateHuman],
  prompt: "Eres un asistente de TiendaPro. Usa las tools que necesites.",
});
```

**Pro:** simple, una sola implementación, menos hops.
**Contra:** el system prompt debe cubrir todos los casos. El LLM puede confundir cuándo usar cada tool.

#### Multi-agent supervisor

```typescript
// 1 supervisor + 3 workers (catalog, orders, escalation)
// 4 system prompts especializados, cada worker con sus tools.
```

**Pro:** especialización, tools aisladas por worker, modelos distintos por worker.
**Contra:** más complejidad, más latencia (2 LLM calls por query: classifier + worker), más superficie de bugs.

#### Heurística

| | Single agent | Multi-agent supervisor |
|---|---|---|
| Tools < 5 | ✅ | ❌ overkill |
| Tools 5-15 con dominios separables | ⚠️ depende | ✅ |
| Tools > 15 | ❌ se confunde | ✅ |
| Tasks con system prompts incompatibles | ❌ | ✅ |
| SLA de latencia agresivo (<1s) | ✅ | ❌ |
| Acceso a datos por permisos por agente | ❌ | ✅ |

**Para el integrador de TiendaPro** caemos en multi-agente porque:
- Más de 5 tools (catalog + RAG + orders + escalation + posiblemente pricing/shipping en el futuro).
- Dominios separables.
- Acceso a datos por agente (orders tiene datos sensibles).

### 4.6. Diseñar el supervisor: tres patrones

#### Patrón A: classifier puro

El supervisor solo clasifica el intent y rutea. No genera respuesta.

```typescript
async function supervisor(state) {
  const { intent } = await classifierLlm.withStructuredOutput(IntentSchema).invoke(state.query);
  return { intent };
}
graph.addConditionalEdges("supervisor", (s) => s.intent, { catalog: "...", orders: "...", general: "..." });
```

**Más simple, más rápido, más auditable.** Es el patrón que hicimos en S13.2.

#### Patrón B: classifier + post-processing

El supervisor clasifica, espera la respuesta del worker, y la reformula antes de devolver al usuario.

```typescript
graph.addEdge("worker", "supervisor_format");
graph.addEdge("supervisor_format", END);
```

**Pro:** consistencia de tono entre workers.
**Contra:** doble LLM call → más caro y más lento. **Y reformular pierde matices** que el worker había agregado.

> **Recomendación:** evita B salvo que tengas una razón muy clara. Si el problema es consistencia de tono, fíjalo en el system prompt de cada worker.

#### Patrón C: supervisor con tools de delegación

El supervisor es un ReAct agent con "tools" que en realidad son los workers.

```typescript
const callCatalogWorker = tool(
  async ({ query }) => catalogWorker.invoke({ query }),
  { name: "callCatalogWorker", description: "Llama al worker de catálogo." },
);
```

**Pro:** muy flexible (el supervisor puede llamar a varios workers en paralelo).
**Contra:** difícil de debuggear, costoso, y el supervisor puede entrar en loops.

> **Recomendación:** A para el 90% de los casos. B en los casos donde la consistencia de tono justifica el costo. C solo en escenarios complejos donde el supervisor realmente necesita orquestar múltiples workers en una sola query.

## 5. Patrones y antipatrones

### Patrones

- **Empieza con un solo agente.** Si funciona, no metas multi-agente.
- **Supervisor "classifier puro"** para la mayoría de casos. Más simple, más rápido.
- **Aísla tools por worker.** Catalog worker NO tiene `getOrderStatus`. Principio de menor privilegio.
- **Mismo State compartido para todos.** Inspeccionable, type-safe, simple.
- **MAX_HOPS global.** Para network y hierarchical, sin esto entras en loop.
- **Modelos distintos por agente.** Classifier en Haiku/Flash; generador en Sonnet/Pro.

### Antipatrones

- **Multi-agente "porque suena bien".** Sin caso técnico, agrega complejidad sin valor.
- **Supervisor que reformula la respuesta del worker.** Introduce alucinación y costo extra.
- **Network sin MAX_HOPS.** Loop infinito.
- **Hierarchical de 3+ niveles.** Latencia se acumula linealmente. >2 niveles necesita justificación fuerte.
- **Compartir tools entre todos los workers.** Pierde el beneficio de aislamiento.
- **System prompts duplicados con copy-paste.** Si dos workers tienen 80% del prompt igual, son el mismo worker.

## 6. Conexión con TiendaPro

S14.1 NO modifica el integrador todavía. El swap final ocurre en **S14.2** (HITL + sandboxing) con la arquitectura completa:

```
                    ┌────────────────┐
   user query ────→ │   supervisor   │
                    │ (classifier)   │
                    └───┬───┬────┬───┘
                        │   │    │
              ┌─────────┘   │    └─────────┐
              ▼             ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────────┐
        │ catalog  │  │  orders  │  │ escalateHuman│
        │  worker  │  │  worker  │  │   (HITL)     │
        └────┬─────┘  └─────┬────┘  └──────┬───────┘
             │              │              │
             └──────────────┴──────────────┘
                            ▼
                          END
```

- **catalog worker:** envuelve el pipeline RAG de M4 (retrieve + rerank + cite).
- **orders worker:** consulta una BD mock de pedidos. Tools aisladas.
- **escalateHuman:** devuelve un handoff al usuario, pidiendo info. En S14.2 agregamos approval gate.

Lo que vas a ver al ejecutar los demos:

- **01-supervisor-workers:** patrón A (classifier puro) con 2 workers especializados.
- **02-sequential-chain:** research → draft → review como cadena fija. Útil para pipelines de generación.

## 7. Resumen

Tres ideas para llevarte:

1. **Multi-agente solo cuando hay especialización.** Si tu necesidad es "más tools", un solo agente alcanza. Si es "dominios separables, system prompts incompatibles, datos aislados", multi-agente vale.
2. **Supervisor classifier puro es el patrón ganador.** Más simple, más rápido, más auditable. Reformular respuestas del worker introduce más problemas que los que soluciona.
3. **Aislamiento de tools por worker es seguridad.** El principio de menor privilegio aplica a agentes igual que a microservicios.

## 8. Preguntas de auto-evaluación

1. Tu equipo propone un sistema con un supervisor y 8 workers especializados. ¿Qué tres preguntas operativas haces antes de aprobar la arquitectura?
2. Tu agente con 12 tools confunde cuándo usar cada una. Argumenta tres opciones (mejor system prompt, agrupar tools, multi-agente) con sus tradeoffs.
3. Diferencia operativa entre el patrón Supervisor y el patrón Sequential. Da un ejemplo donde cada uno gana.
4. Diseñas un sistema network con 5 agentes que se llaman entre sí. ¿Qué tres mecanismos agregas para que NO entre en loop infinito?
5. El supervisor reformula la respuesta del catalog worker para que tenga un tono consistente con el orders worker. Da tres argumentos para evitar este patrón y una alternativa más limpia.
6. Implementas multi-agente y la latencia p95 sube de 1.5s a 4s. ¿Cuáles son las dos causas probables y qué mides para confirmar?

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 2 demos: supervisor con workers + sequential chain.

**Próxima sesión:** [`S14.2 — HITL, seguridad y sandboxing`](../sesion-14.2-hitl-seguridad/) → cierra el módulo + swap final del integrador.
