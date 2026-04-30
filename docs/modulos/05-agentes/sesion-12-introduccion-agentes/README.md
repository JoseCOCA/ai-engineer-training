# Sesión 12 — Introducción a agentes de IA

> **Módulo:** 5 — Orquestación de agentes · **Duración estimada:** 2h (~55 min lectura + ~65 min práctica) · **Formato:** 60% teoría / 40% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión podrás:

- Distinguir un **agente** de un **chatbot con tools** y de un **pipeline determinista** — y saber cuándo cada uno es la respuesta.
- Explicar el **patrón ReAct** (Reason + Act) y por qué es la base de la mayoría de los agentes modernos.
- Implementar un **agent loop manual** end-to-end usando solo el Vercel AI SDK, sin framework de agentes.
- Diseñar **tools** apropiadas: schema con zod, descripción que el modelo pueda razonar, manejo de errores.
- Reconocer las **condiciones de terminación** sanas: max iterations, finalAnswer tool, timeout, error budget.
- Identificar los **modos de fallar** específicos de agentes (loops infinitos, tool hallucination, sobre-uso de tools).

## 2. Prerequisitos

- **M4 completo.** El integrador con pipeline RAG funcionando.
- **`GOOGLE_GENERATIVE_AI_API_KEY`** configurada.
- **Lectura recomendada:** revisión rápida de S04 (salidas estructuradas y guardrails) — los agentes los usan intensivamente.

## 3. Conceptos clave

- **Agente de IA:** sistema donde un LLM **decide su propio flujo** mediante tools, en lugar de seguir un pipeline predefinido. La diferencia clave con un pipeline es que el agente puede llamar a la misma tool N veces o ignorarla, según razone.
- **Tool:** función externa que el agente puede invocar. Tiene un nombre, una descripción legible para el LLM, un schema de inputs (zod) y una implementación.
- **Tool calling:** mecanismo del LLM para emitir, en lugar de texto, una llamada estructurada a una tool. Vercel AI SDK lo expone vía el parámetro `tools` de `generateText` y `streamText`.
- **ReAct (Reason + Act):** patrón canónico donde el agente alterna pasos de razonamiento ("pensemos: necesito X") con pasos de acción (llamada a tool) hasta llegar a la respuesta. Yao et al. (2022) sistematizaron este patrón.
- **Agent loop:** el bucle que orquesta `LLM → tool calls → tool results → LLM → ...` hasta que el LLM emite una respuesta final.
- **Termination condition:** la regla que decide cuándo el agente para. Puede ser un `finalAnswer` explícito, un máximo de iteraciones, un timeout, o un error.
- **Tool hallucination:** el LLM "inventa" una llamada a una tool que no existe, o pasa argumentos que no cumplen el schema. Lo detectamos con validación zod, no con el LLM.

## 4. Teoría

### 4.1. ¿Qué es exactamente un agente?

Un sistema con LLM puede operar en tres modos, ordenados por autonomía creciente:

```
Pipeline determinista       Chat con tool calling     Agente
       ↓                            ↓                   ↓
 LLM ejecuta exactamente   LLM puede llamar tools   LLM decide qué hacer,
 la secuencia que el       cuando el código se      cuántas veces, en
 código orquesta.          lo permite.              qué orden, hasta cuándo.
 (RAG de M4 entra aquí)    (Una tool por turno)     (Loop autónomo)
```

**Un agente es lo que hicimos en M4 + autonomía sobre el flujo.** En M4 el código decidía: "siempre retrieve → siempre rerank → siempre generate". En un agente, el LLM puede decidir: "esta query la respondo de memoria, no necesito retrieve" o "necesito retrieve, después orderStatus, después un segundo retrieve para confirmar".

#### Cuándo NO usar un agente

- **Tareas con flujo conocido y estable** → pipeline determinista. Más barato, más rápido, más debugeable.
- **Una pregunta = una respuesta sin dependencias** → chat con RAG (lo de M4).
- **Latencia crítica < 1s** → cada iteración del loop suma 500ms-2s. Un agente promedio tarda 3-10s.

> **Regla:** un agente es la respuesta cuando hay **incertidumbre sobre el flujo**. Si sabes la secuencia de pasos antes de empezar, no necesitas un agente.

### 4.2. El patrón ReAct

Yao et al. (2022) propusieron alternar **razonamiento explícito** con **acción**:

```
Thought: el usuario quiere saber el estado del pedido P-1234.
Action: getOrderStatus({ id: "P-1234" })
Observation: { status: "in_transit", eta: "2026-05-03" }
Thought: tengo la respuesta. La traduzco a lenguaje natural para el usuario.
Final Answer: "Tu pedido P-1234 está en camino, llega el 3 de mayo."
```

Tres aprendizajes clave del paper:

1. **Forzar el "Thought" mejora la precisión.** El LLM razona mejor cuando explicita su plan antes de actuar.
2. **El loop puede ser largo.** ReAct asume que pueden hacer falta muchas iteraciones para llegar a la respuesta.
3. **Los errores son recuperables.** Si una tool falla, el LLM puede leer el error como `Observation` y replanificar.

#### Implementación moderna con tool calling nativo

Los SDKs modernos (Vercel AI SDK, OpenAI SDK, Anthropic SDK) implementan ReAct **implícitamente**: cuando le pasás `tools` al `generateText`, el modelo decide si responde con texto o con llamadas a tools. El loop lo implementás vos:

```typescript
let iteration = 0;
while (iteration < MAX_ITER) {
  const result = await generateText({ model, tools, messages });

  if (result.finishReason === "stop") {
    return result.text;  // el modelo terminó
  }

  // si el modelo llamó tools, ejecútalas y agrega los resultados al historial
  for (const call of result.toolCalls) {
    const output = await runTool(call.toolName, call.args);
    messages.push(toolResultMessage(call.toolCallId, output));
  }
  iteration++;
}
throw new Error("Max iterations reached");
```

**El `Thought` ya no es explícito** en este patrón porque está embebido en el reasoning interno del modelo. Si quieres ReAct explícito (útil para debug y trazabilidad), pides al modelo que devuelva razonamiento antes de cada tool call. Lo verás en el ejercicio 3.

### 4.3. Anatomía de una tool

Una tool de Vercel AI SDK tiene cuatro partes:

```typescript
import { tool } from "ai";
import { z } from "zod";

const getWeather = tool({
  description: "Obtiene el clima actual de una ciudad. Úsala cuando el usuario pregunte por el clima.",
  inputSchema: z.object({
    city: z.string().describe("Nombre de la ciudad, ej: 'Buenos Aires'"),
  }),
  execute: async ({ city }) => {
    const data = await fetch(`https://api.weather.com/${city}`);
    return data.json();
  },
});
```

- **`description`:** texto que el modelo lee para decidir cuándo invocar la tool. **Es lo más importante.** Ambigua = el modelo no la usa o la usa mal.
- **`inputSchema`:** zod schema. El modelo lee la descripción de cada campo (`describe()`) para saber qué pasar.
- **`execute`:** la implementación. Recibe los inputs validados, devuelve el resultado.
- **`description` de cada parámetro** con `.describe()`: el modelo NO ve los nombres de variables, solo descripciones.

#### Anti-patrones frecuentes en tools

- **Descripción ambigua o genérica** ("Útil para preguntas sobre clima" → mejor "Obtiene el clima actual de una ciudad por nombre").
- **Schema laxo sin `describe()`** → el modelo adivina qué pasar.
- **Tool que devuelve toda la BD** → satura el context window del LLM. Devolvé solo lo relevante.
- **Tool con efectos colaterales irreversibles sin guardrail** → el agente puede llamarla N veces (S14.2 cubre HITL para esto).

### 4.4. El agent loop con Vercel AI SDK

El SDK ofrece dos formas de implementar el loop:

#### Forma A: loop manual (lo que ves abajo)

```typescript
async function runAgent(query: string): Promise<string> {
  const messages: ModelMessage[] = [{ role: "user", content: query }];

  for (let i = 0; i < MAX_ITER; i++) {
    const result = await generateText({ model, tools, messages });

    if (result.toolCalls.length === 0) {
      return result.text;
    }

    messages.push({ role: "assistant", content: result.content });
    for (const call of result.toolCalls) {
      const output = await executeTool(call);
      messages.push({
        role: "tool",
        content: [{ type: "tool-result", toolCallId: call.toolCallId, output }],
      });
    }
  }
  throw new Error(`Max iterations (${MAX_ITER}) reached`);
}
```

**Pro:** explicit, debuggable, sin dependencias extra.
**Contra:** boilerplate.

#### Forma B: `stopWhen` del SDK (loop automático)

```typescript
const result = await generateText({
  model,
  tools,
  messages: [{ role: "user", content: query }],
  stopWhen: stepCountIs(10),  // máximo 10 iteraciones
});
return result.text;
```

El SDK hace el loop por vos hasta que el modelo emite respuesta final o se cumple `stopWhen`.

**Pro:** una línea.
**Contra:** menos control sobre cada step (logging, validación, intervención).

> **Regla del curso:** empezamos con la forma A para entender qué hace el loop. Migramos a la forma B (o a frameworks como LangGraph) cuando ya entendemos el modelo.

### 4.5. Termination conditions

Un agente sin condición de parada es un loop infinito esperando tu factura del LLM. Tres mecanismos, en orden de criticidad:

#### Mecanismo 1: max iterations (obligatorio)

```typescript
const MAX_ITER = 10;
for (let i = 0; i < MAX_ITER; i++) { ... }
```

**Es el cinturón de seguridad.** Sin esto, no tienes agente, tienes bomba de tiempo.

#### Mecanismo 2: finalAnswer implícito

El loop termina cuando el modelo emite texto sin tool calls. Esto está incorporado al loop básico — si `result.toolCalls.length === 0`, salís.

#### Mecanismo 3: token / cost budget

```typescript
let totalTokens = 0;
for (...) {
  const result = await generateText({...});
  totalTokens += result.usage.totalTokens;
  if (totalTokens > TOKEN_BUDGET) {
    return "Lo siento, no pude resolver tu solicitud en el presupuesto disponible.";
  }
}
```

Útil cuando el agente puede hacer muchas tool calls caras (RAG, otro LLM, APIs pagas).

#### Mecanismo 4: timeout wall clock

```typescript
const start = Date.now();
for (...) {
  if (Date.now() - start > MAX_MS) throw new TimeoutError();
}
```

Útil cuando el agente está en un endpoint con SLA de respuesta.

**Combinación recomendada:** los cuatro a la vez. Defaults razonables:
- `MAX_ITER = 10`
- `MAX_TOKENS = 50_000`
- `MAX_MS = 30_000` (30s)
- `finalAnswer` implícito vía `toolCalls.length === 0`

### 4.6. Modos de fallar específicos de agentes

#### Modo 1: loop infinito (sin progreso)

El modelo llama a la misma tool con los mismos argumentos una y otra vez. **Causa:** la tool no devuelve la info que el modelo espera, o el modelo no entiende el resultado.

**Síntomas:** mismo `toolCallName + args` repetidos. **Debug:** loguea cada iteración y aplica detección de loops (mismo args dos veces seguidas → escalar).

#### Modo 2: tool hallucination

El modelo emite un tool call con un nombre que no existe, o args que no cumplen el schema.

**Síntomas:** error de validación de zod. **Mitigación:** el SDK rechaza la llamada, devolvés un mensaje "tool no existe" y el modelo replanifica.

#### Modo 3: sobre-uso de tools

El modelo llama a tools donde no hace falta — preguntás "¿cuánto es 2+2?" y el agente llama a `searchCatalog`.

**Causa:** descripciones de tools demasiado generales o instrucciones del system prompt que no dejan claro cuándo NO usar tools.

**Mitigación:** mejorar `description` de cada tool y agregar al system prompt: "responde directamente cuando puedas hacerlo sin tools".

#### Modo 4: contexto que crece sin parar

Cada iteración agrega messages al historial. Después de 10 iteraciones, el prompt puede tener 30K tokens.

**Mitigación:** trunca historial viejo, resume con un LLM cheap, o limita `MAX_ITER` agresivamente.

#### Modo 5: tool result que satura el LLM

Una tool devuelve 5K tokens (ej: lista entera de un catálogo). El LLM se distrae.

**Mitigación:** la tool debe devolver lo relevante, no todo. Si necesita devolver mucho, pásalo por un summarize.

### 4.7. ¿Cuándo conviene un agente sobre RAG ingenuo?

Tabla de decisión que te conviene tener en la cabeza:

| Caso | RAG ingenuo (M4) | Agente (M5) |
|------|-----------------|-------------|
| "¿qué mochilas tienen?" | ✅ una pasada de retrieve + gen | ❌ overkill |
| "¿cuál es el estado de mi pedido P-1234?" | ❌ no hay retrieval, hay BD lookup | ✅ tool getOrderStatus |
| "Necesito una mochila Y saber si llega antes del viernes" | ❌ dos sub-tareas independientes | ✅ tool RAG + tool orderStatus |
| "¿Qué me recomendas según mis compras pasadas?" | ❌ requiere historial + catálogo | ✅ tool getHistory + tool RAG |
| "Hola, ¿quién eres?" | overkill | overkill — chat directo basta |

**Regla:** mientras la respuesta es resoluble con una sola fuente de información, RAG ingenuo gana. Cuando aparecen múltiples fuentes o decisiones condicionales, el agente justifica su costo.

## 5. Patrones y antipatrones

### Patrones

- **Empieza con un loop manual.** Antes de adoptar LangGraph o un framework, implementa el loop a mano. Te da intuición.
- **Tools focalizadas y bien descritas.** Una tool por capacidad concreta, descripción clara, schema con `.describe()` en cada campo.
- **Termination conditions múltiples.** max_iter + budget + timeout + finalAnswer. No confíes en una sola.
- **Loguea cada iteración.** Tool calls, args, results, tokens. Sin esto no se debuggea.
- **Validá schemas con zod.** No confíes en que el LLM siempre cumple el schema; el SDK valida pero el código del execute también puede defenderse.
- **Reescribir el system prompt cuando sale mal.** El 80% de los problemas de agentes son problemas de prompt.

### Antipatrones

- **Sin max_iter.** Loop infinito a la espera de la factura.
- **Tools que devuelven todo el dataset.** Saturás el context window.
- **Descripciones de tools genéricas.** El modelo no sabe cuándo invocarlas.
- **Resultados de tool sin estructura.** Devolvé objetos JSON, no strings con párrafos largos.
- **Llamar a frameworks "porque es más profesional".** Sin entender el loop, los frameworks oscurecen los bugs.
- **Side effects sin HITL.** Tools que escriben a BD, mandan emails, cobran tarjetas — ver S14.2.

## 6. Conexión con TiendaPro

S12 introduce el patrón pero **no modifica el integrador todavía**. El swap unificado (supervisor multi-agente con tools de catálogo, pedidos, escalamiento) ocurre en S14.2 después de pasar por LangGraph y los patrones multi-agente.

Lo que vas a ver al ejecutar los demos:

- **01-agent-loop:** loop manual de un agente con una tool simple (`getProductCount`). Sin RAG, sin BD; muestra la mecánica pura.
- **02-tool-calling:** dos tools (`searchCatalog`, `getStockLevel`) y queries que requieren combinarlas.
- **03-react-explicit:** ReAct con razonamiento explícito visible en cada step (útil para debug).
- **04-termination-conditions:** los cuatro mecanismos de parada en acción + provocamos cada modo de fallar.

## 7. Resumen

Tres ideas para llevarte:

1. **Agente = LLM + tools + autonomía sobre el flujo.** No es un nombre fancy para "chat con tools". Lo distintivo es que el LLM decide qué hacer y cuántas veces.
2. **El loop es simple. Lo difícil son las tools.** Las tools mal descritas o que devuelven mal el resultado son la fuente del 80% de los problemas en agentes.
3. **Termination conditions múltiples y observabilidad.** Un agente sin max_iter es un bug; un agente sin logs es indebuggeable. Los dos son no-negociables desde el día uno.

## 8. Preguntas de auto-evaluación

1. Tu RAG ingenuo de M4 funciona perfecto para preguntas sobre el catálogo. Te piden agregar consultas de pedidos por id. ¿Por qué un agente es la respuesta correcta y un segundo pipeline RAG no?
2. Diseña la `description` de una tool `cancelOrder(orderId)` que tu agente puede llamar. Tres versiones: una mala, una buena, y una excelente. Justifica las diferencias.
3. Tu agente entra en loop: llama a `getStockLevel("TP-MOCH-01")` cinco veces seguidas con los mismos args. ¿Cuáles son las dos hipótesis principales sobre la causa? ¿Qué dato logueas para distinguirlas?
4. Tienes un agente con `MAX_ITER = 10`. Un caso de eval lo agota sin llegar a respuesta. ¿Qué tres acciones tomas en orden antes de subir el límite a 20?
5. Diferencia operativa entre un **chat con tool calling** (un solo turno) y un **agente** (loop con múltiples tool calls). Da un caso donde cada uno es la respuesta correcta.
6. Tu equipo propone que el agente tenga acceso a una tool `executeSql(query)` con SQL libre sobre la BD de TiendaPro. ¿Por qué es una mala idea y qué propones en su lugar?

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 4 demos prácticos del agent loop sin framework.

**Próxima sesión:** [`S13.1 — Cuándo usar framework vs construir el tuyo`](../sesion-13.1-framework-vs-bare-metal/) → comparativa Vercel AI SDK + LangGraph + OpenAI Assistants.
