# Sesión 13.3 — Gestión de estado, errores y observabilidad

> **Módulo:** 5 — Orquestación de agentes · **Duración estimada:** 1.5h (~45 min lectura + ~45 min práctica) · **Formato:** 60% teoría / 40% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión podrás:

- Operar **checkpointers** de LangGraph para persistir el estado entre invocaciones (memory, SQLite).
- Implementar **error handling** robusto: retries con backoff exponencial, fallbacks a proveedor secundario, mensajes degradados.
- Diseñar **observabilidad estructurada**: trace logging por step compatible con Langfuse/LangSmith.
- Reconocer cuándo un agente necesita persistencia (conversaciones largas, jobs en background) y cuándo no.
- Distinguir tipos de errores: transitorios (retry), del dominio (fallback), fatales (escalación).

## 2. Prerequisitos

- **S13.2 completa.** `StateGraph`, nodos, conditional edges entendidos.
- **`GOOGLE_GENERATIVE_AI_API_KEY`** configurada.

## 3. Conceptos clave

- **Checkpointer:** componente que persiste el estado del grafo después de cada step. LangGraph trae `MemorySaver` (in-process), `SqliteSaver` (archivo local) y soporte para Postgres.
- **Thread:** identificador de una "sesión" o "conversación". Cada thread tiene su propio estado persistido. El thread_id permite reanudar.
- **Time travel:** capacidad de volver a un step previo y re-ejecutar desde ahí. Útil para HITL y debug.
- **Error transitorio:** error que probablemente desaparece reintentando (timeout, 503, rate limit). Tratamiento: backoff exponencial + retry.
- **Error del dominio:** error que indica que el flujo eligió mal (tool no aplicable, datos faltantes). Tratamiento: fallback a otra rama del grafo.
- **Error fatal:** error que el agente no puede recuperar (auth fallida, BD caída). Tratamiento: respuesta degradada al usuario + log al equipo.
- **Trace:** serie ordenada de eventos del agente (step inicio, tool call, tool result, step fin) que cuenta qué pasó.
- **Span:** unidad atómica de un trace (un step, una tool call). Tiene start, end, metadata.

## 4. Teoría

### 4.1. Checkpointers — persistencia first-class

Sin checkpointer, cada `graph.invoke()` arranca de cero. Con checkpointer, puedes:

```typescript
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();
const graph = workflow.compile({ checkpointer });

// Primera invocación con thread_id
const result1 = await graph.invoke(
  { messages: [{ role: "user", content: "hola" }] },
  { configurable: { thread_id: "user-42" } },
);

// Más tarde — retoma desde donde quedó
const result2 = await graph.invoke(
  { messages: [{ role: "user", content: "y mi pedido?" }] },
  { configurable: { thread_id: "user-42" } },
);
// El estado de result1 está en result2; el grafo "recordó".
```

#### Implementaciones de checkpointer

| Implementación | Persistencia | Cuándo |
|---------------|--------------|--------|
| `MemorySaver` | RAM del proceso | Tests, demos, single-process. Se pierde al reiniciar. |
| `SqliteSaver` | Archivo local | Dev, single-machine, prototipo. |
| `PostgresSaver` | BD compartida | Producción multi-instancia. |
| Custom | Lo que vos quieras | Redis, MongoDB, S3. La interfaz es chica. |

> **Regla:** dev arranca con `MemorySaver`. Cuando el agente sale a más de una máquina, migras a Postgres. SQLite es opción intermedia para single-machine que reinicia.

#### Time travel

Con checkpointer activo, puedes inspeccionar el historial:

```typescript
const history = [];
for await (const state of graph.getStateHistory({ configurable: { thread_id: "user-42" } })) {
  history.push(state);
}
```

Cada item del historial es un snapshot de un step. Útil para:
- **Debug:** "¿qué estado tenía el grafo cuando falló?"
- **HITL:** un humano revisa el estado y decide cómo continuar (S14.2).
- **Re-ejecución desde un punto:** modificar inputs en step N y re-ejecutar desde ahí.

### 4.2. Errores: tres categorías y tres tratamientos

Los errores en agentes no son uniformes. Tratarlos todos igual es perezoso y produce sistemas frágiles.

#### Categoría 1: errores transitorios

Características: el mismo input, segundos después, funciona. Ejemplos:

- Rate limit del LLM (429).
- Timeout del proveedor (504).
- Error transitorio de red.
- Conflicto de concurrencia en una BD.

**Tratamiento canónico:** retry con backoff exponencial + jitter.

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransient(err) || i === maxAttempts) throw err;
      const delay = Math.min(1000 * 2 ** (i - 1), 10_000) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}
```

LangChain trae `withRetry` integrado en sus modelos:

```typescript
const llm = new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash" })
  .withRetry({ stopAfterAttempt: 3 });
```

#### Categoría 2: errores del dominio

Características: el agente eligió mal o le faltan datos. Ejemplos:

- El usuario pide un pedido por id pero ese id no existe.
- Una tool devuelve "no encontré nada" pero el agente esperaba info.
- El classifier devuelve un intent inválido.

**Tratamiento canónico:** fallback a otra rama del grafo o a un mensaje al usuario pidiendo más info.

```typescript
graph.addConditionalEdges("ordersWorker", (state) => {
  if (state.error?.kind === "not_found") return "askForMoreInfo";
  if (state.answer) return END;
  return "fallback";
});
```

**El error del dominio NO se reintenta.** Reintentando con los mismos inputs vuelve a fallar.

#### Categoría 3: errores fatales

Características: el sistema no puede continuar. Ejemplos:

- Falta una API key crítica.
- La BD está caída sin replica.
- Error de configuración en producción.

**Tratamiento canónico:** respuesta degradada al usuario ("estamos teniendo problemas, intenta más tarde") + log + alerta al equipo.

```typescript
try {
  return await graph.invoke(input);
} catch (err) {
  alertOps(err, { traceId, userId });
  return { answer: "Estamos teniendo problemas técnicos. Por favor, intenta nuevamente en unos minutos." };
}
```

> **Regla:** clasifica errores antes de manejarlos. Tratar todos los errores igual (siempre retry, siempre fallback, siempre alertar) produce sistemas que retryan errores fatales y se quedan callados ante errores del dominio.

### 4.3. Fallbacks de proveedor LLM

Patrón frecuente: si el provider primario falla (rate limit duro, caída), fallback al secundario.

```typescript
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAnthropic } from "@langchain/anthropic";

const primary = new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash" });
const secondary = new ChatAnthropic({ model: "claude-haiku-4-5" });

const resilientLlm = primary.withFallbacks({ fallbacks: [secondary] });
```

LangChain ejecuta `primary` y si falla, ejecuta `secondary`. La diferencia con retry: **fallback usa otro proveedor**, retry usa el mismo.

> **Cuándo NO usar fallback:** si la calidad de los dos providers difiere mucho, las respuestas inconsistentes confunden al usuario y al eval set. En ese caso, mejor degradar al usuario ("intenta más tarde") que entregar respuesta de menor calidad.

### 4.4. Trace logging estructurado

Sin trace, debugar un agente que falla en producción es imposible. Los logs deben:

- **Ser estructurados** (JSON, no texto plano).
- **Tener trace_id y span_id** para correlacionar steps de la misma ejecución.
- **Incluir tokens, latencia, costo** para análisis post-hoc.
- **Ser exportables** a un sistema de observabilidad (Langfuse, LangSmith, OpenTelemetry).

#### Formato canónico

```json
{
  "trace_id": "trc_abc123",
  "span_id": "spn_001",
  "parent_span_id": null,
  "name": "agent.invoke",
  "start_time": "2026-05-01T10:00:00.000Z",
  "end_time": "2026-05-01T10:00:02.300Z",
  "duration_ms": 2300,
  "metadata": {
    "thread_id": "user-42",
    "input_tokens": 350,
    "output_tokens": 120,
    "model": "gemini-2.5-flash"
  }
}
```

#### LangSmith / Langfuse — observabilidad gratis

LangGraph se integra con LangSmith con dos variables de entorno:

```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=tu_api_key
```

Exporta automáticamente cada step + tool call a un dashboard navegable. **No requiere cambios de código.** Para Langfuse hay un plugin similar.

> **Regla:** desde el día 1, agrega observabilidad estructurada. Después es muy difícil retrocompatibilizar.

### 4.5. Patrones combinados

Un agente robusto en producción combina las tres capas:

```typescript
import { MemorySaver } from "@langchain/langgraph";

const llm = new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash" })
  .withRetry({ stopAfterAttempt: 3 })
  .withFallbacks({ fallbacks: [secondaryLlm] });

const graph = workflow.compile({
  checkpointer: new MemorySaver(),
});

// trace logging via env vars
process.env.LANGCHAIN_TRACING_V2 = "true";

try {
  const result = await graph.invoke(
    input,
    { configurable: { thread_id: userId }, recursionLimit: 25 },
  );
  return result;
} catch (err) {
  if (isFatal(err)) {
    alertOps(err);
    return degradedResponse();
  }
  throw err;
}
```

Cinco capas:

1. **Retry** dentro del LLM call (errores transitorios del proveedor).
2. **Fallback** al provider secundario si el primario falla repetidamente.
3. **Checkpointer** para persistir el estado y permitir reanudar.
4. **`recursionLimit`** del grafo: el equivalente a `MAX_ITER` de S12.
5. **Try/catch externo** para errores fatales con respuesta degradada.

### 4.6. Cuándo cada capa importa

| Tipo de agente | Retry | Fallback LLM | Checkpointer | Trace |
|----------------|:-----:|:------------:|:------------:|:-----:|
| Demo / prototipo | opcional | innecesario | innecesario | opcional |
| Producto interno | sí | opcional | si la convo es larga | sí |
| Producto público con SLA | sí | sí | sí | sí (obligatorio) |
| Job background largo | sí | sí | obligatorio | sí |

> **Regla práctica:** la capa más fácil de subestimar es **trace logging**. Sin esto, el primer bug de producción te hace perder días.

## 5. Patrones y antipatrones

### Patrones

- **Retry solo errores transitorios.** Detecta el error type antes; no retry-es errores del dominio.
- **Backoff exponencial con jitter.** Sin jitter, miles de clientes reintentan al mismo tiempo y rompen el provider.
- **Fallback a provider secundario solo cuando la calidad lo justifica.** Si la calidad difiere, degrada al usuario.
- **Checkpointer desde el día 1.** Aunque sea `MemorySaver`. Migrar después es trivial; agregarlo después es doloroso.
- **Trace estructurado JSON con trace_id + span_id.** Sin esto, debug en producción es imposible.

### Antipatrones

- **Retry infinito.** Un loop de retries sin tope agota tu budget y nunca recupera.
- **Try/catch que silencia el error.** El error se traga, el agente sigue con un estado inválido.
- **Logs en string.** "Step 2 falló: error". Sin trace_id, sin metadata, sin nada útil para debug.
- **Checkpointer en memoria en producción multi-instancia.** Cuando el load balancer ruta a otro nodo, el thread no existe.
- **Fallback al provider más barato.** Convertís un problema de capacidad en un problema de calidad.

## 6. Conexión con TiendaPro

S13.3 NO modifica el integrador todavía. El swap unificado entra en S14.2 con todas las capas activas: retry en los LLM calls, MemorySaver para conversaciones, fallback a Anthropic si Google falla, trace estructurado a un archivo `logs/agent-trace.jsonl`.

Lo que vas a ver al ejecutar los demos:

- **01-checkpointer:** un grafo con `MemorySaver`. Misma sesión retoma estado entre invocaciones; sesiones distintas son independientes.
- **02-error-handling:** retries + fallback en acción. Provocamos errores transitorios y un error fatal.
- **03-trace-logging:** exportador de traces estructurados a JSONL local + ejemplo de cómo lo leerías para análisis.

## 7. Resumen

Tres ideas para llevarte:

1. **Checkpointer = memoria del agente.** Sin él, cada invocación es amnésica. Con él, puedes reanudar conversaciones y hacer time travel.
2. **Tres tipos de errores, tres tratamientos.** Transitorio → retry. Dominio → fallback de flujo. Fatal → degradación + alerta. Tratarlos igual es perezoso.
3. **Trace estructurado desde el día 1.** No hay debug productivo sin trace_id, span_id y metadata por step. Costo bajo, beneficio enorme.

## 8. Preguntas de auto-evaluación

1. Tu agente falla con `429 rate limit` en el LLM call. Diseña la estrategia de retry con backoff exponencial: cuántos intentos, qué delays, qué jitter. Justifica cada número.
2. Un usuario pregunta por un pedido `P-9999` que no existe. La tool devuelve `{ found: false }`. ¿Es error transitorio, del dominio o fatal? ¿Cómo lo manejas?
3. Diferencia entre `withRetry` y `withFallbacks` en LangChain. Da un caso para cada uno.
4. Tu equipo activa `LANGCHAIN_TRACING_V2=true` en producción y aparecen alertas de costos por exportación de traces. ¿Cómo balanceas observabilidad y costo?
5. Tu agente usa `MemorySaver` en producción y notas que cuando hay alta carga, las conversaciones "saltan" entre estados. ¿Cuál es la causa probable y cómo lo arreglas?
6. Diseña los tres niveles de logs (DEBUG / INFO / WARN-ERROR) para un agente de soporte. ¿Qué va en cada uno y por qué?

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 3 demos: checkpointer, error handling, trace logging.

**Próxima sesión:** [`S14.1 — Multi-agente y patrones de comunicación`](../sesion-14.1-multi-agente/) → supervisor, hierarchical, sequential.
