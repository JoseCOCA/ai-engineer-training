# Sesión 03 — Wrappers y abstracciones sobre el modelo

> **Módulo:** 2 — Patrones de aplicaciones LLM · **Duración estimada:** 2h (~50 min lectura + ~70 min práctica) · **Formato:** 50% teoría / 50% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión vas a poder:

- Justificar por qué **toda app LLM en producción tiene un wrapper** propio sobre el SDK del proveedor, en vez de llamar a `generateText` directamente desde la lógica de negocio.
- Diseñar la **API de un chat service**: input tipado, output tipado, opciones de inferencia, manejo de streaming.
- Implementar **retry con backoff exponencial** para errores transitorios (rate limit, 5xx, timeout) sin reintentar errores irrecuperables (4xx, prompt inválido).
- Implementar **fallback entre proveedores** cuando el primario falla — y entender los compromisos (calidad, costo, semántica).
- Instrumentar latencia, tokens, costo por llamada en un único punto.
- Distinguir entre **wrapper "tonto"** (passthrough) y **wrapper de servicio** (con políticas de producción).

## 2. Prerequisitos

- **S02** completa. Especialmente: parámetros de inferencia explícitos, `streamText` vs `generateText`, `finishReason`.
- Proyecto integrador con `src/lib/llm.ts` ya importando la abstracción multi-provider de Vercel AI SDK.

## 3. Conceptos clave

- **Wrapper:** capa que envuelve al SDK del proveedor para exponer una API ajustada al producto. NO es solo "una función que llama a `generateText`": es la frontera entre tu lógica de negocio y el ecosistema LLM.
- **Chat service:** wrapper especializado para conversación. Recibe `system + messages`, devuelve `text + metadata` con la forma que tu app necesita.
- **Retry policy:** decisión de qué errores reintentar, cuántas veces, con qué espera entre intentos.
- **Backoff exponencial con jitter:** estrategia de espera donde cada intento espera más que el anterior, con un componente aleatorio para evitar tormentas de reintentos sincronizados.
- **Fallback:** cuando un proveedor falla repetidamente, conmutar a otro proveedor "espejo" para que el usuario reciba una respuesta. Implica aceptar diferencias en estilo, calidad y costo.
- **Idempotencia en LLMs:** el mismo input puede dar outputs distintos. Los reintentos en LLMs NO son idempotentes salvo `temperature = 0` + `seed`. Implicación: reintentar puede generar respuestas distintas, no la misma.

## 4. Teoría

### 4.1. Por qué wrappers — el argumento canónico

Hasta ahora TiendaPro hace algo así:

```typescript
const result = await generateText({
  model: llm,
  system: SYSTEM_PROMPT,
  prompt: userMessage,
});
```

Funciona para una demo. **No funciona en producción.** Cinco razones — todas reales, todas costosas si las ignoras:

#### 1. Punto único de instrumentación

Sin wrapper, tu logging, métricas y trazas se tienen que escribir en **cada call site** del LLM. Cuando agregues un nuevo flow (clasificación, resumen, recomendación) hay que duplicar el logging. Olvidarse en un solo lugar significa que ese flow es invisible en producción.

Con wrapper: una única función que loguea entrada, salida, latencia, tokens y costo. Todos los call sites lo heredan gratis.

#### 2. Retries sin esfuerzo

Las APIs LLM **fallan más de lo que crees**:

| Error | Frecuencia esperada | Es transitorio |
|-------|---------------------|----------------|
| `429 Too Many Requests` | Alta — depende de tu rate limit | Sí (esperar y reintentar) |
| `503 Service Unavailable` | Media — proveedor bajo carga | Sí |
| `500 Internal Server Error` | Baja, pero pasa | Sí |
| `400 Bad Request` | Bug en tu código | NO (reintentar es perder tiempo) |
| `401 Unauthorized` | API key mal | NO |
| `Network timeout` | Variable | Sí |

Sin wrapper, manejarlos en cada call site es repetitivo y se olvida. Con wrapper, es transparente.

#### 3. Fallback entre proveedores

Si Anthropic se cae **a las 3am de tu zona horaria**, ¿tu producto se cae? Con la abstracción de S01.1 puedes cambiar de proveedor en `.env` — pero eso requiere intervención humana. Con un wrapper que detecta el patrón "primario muerto, secundario vivo" y conmuta automáticamente, no.

#### 4. Caching transversal

Algunas respuestas se pueden cachear (mismas FAQs respondidas igual). Sin wrapper, el caching tiene que vivir en cada lugar. Con wrapper, decides una vez y aplica en toda la app.

#### 5. Migración de proveedor o SDK

Vercel AI SDK pasó de v3 a v4 a v5 en ~18 meses. Cada versión cambió la API mínima. Sin wrapper, migrar es tocar **todos** los call sites. Con wrapper, tocas un único archivo.

> **La regla:** apenas tu app tenga **dos call sites al LLM**, ya tienes wrapper. La duplicación se cobra rápido.

### 4.2. Anatomía de un chat service

El wrapper típico para conversación tiene esta forma:

```typescript
export interface ChatRequest {
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface ChatResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  provider: Provider;
  finishReason: string;
  costUsd?: number;
}

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  // 1. Aplicar defaults sensatos
  // 2. Llamar al proveedor con retry
  // 3. Medir latencia
  // 4. Calcular costo
  // 5. Loguear
  // 6. Devolver respuesta normalizada
}
```

Tres principios que importan:

**Tipado fuerte.** El input y output son tipos. Si mañana agregas un campo (cost, traceId, evaluationScore), TypeScript te avisa dónde lo tienes que tocar.

**Defaults explícitos en el wrapper.** Si no pasas `temperature`, el wrapper aplica el default **del producto** (e.g. `0.5` para chat conversacional), no el default arbitrario del proveedor.

**Output normalizado entre proveedores.** Independiente de si la respuesta vino de Anthropic, OpenAI o Ollama, tu app ve siempre el mismo shape. Esa normalización ya viene en gran parte hecha por Vercel AI SDK; el wrapper la sella y la extiende.

#### Streaming en el wrapper

Conviene que el wrapper exponga **dos primitivas**: una para `generateText` y otra para `streamText`.

```typescript
export async function chat(req: ChatRequest): Promise<ChatResponse> { ... }
export async function chatStream(req: ChatRequest): AsyncIterable<string> & {
  finished: Promise<ChatResponse>;
} { ... }
```

`chatStream` devuelve un iterable de chunks **+ una promise** que resuelve al final con la metadata completa. Así, tu UI consume los chunks para mostrar texto, y al final logueas la metadata como en `chat`.

### 4.3. Retry con backoff exponencial

#### El patrón

```
Intento 1 → falla
Esperar  ~0.2s + jitter
Intento 2 → falla
Esperar  ~0.4s + jitter
Intento 3 → falla
Esperar  ~0.8s + jitter
Intento 4 → falla
Tirar el error final
```

Tres parámetros que tienes que decidir:

| Parámetro | Valor típico | Cómo elegirlo |
|-----------|--------------|---------------|
| `maxRetries` | `3` | Más de 3 raramente ayuda. Si 3 no funcionaron, el proveedor está caído |
| `baseDelayMs` | `200–500` | Bajo impacta poco a la latencia normal; alto da más oxígeno al proveedor |
| `factor` | `2` | Duplicar es estándar (exponential). Bájalo si quieres reintentos más rápidos |

#### El jitter

Si 1.000 instancias de tu app fallan al mismo tiempo y todas reintentan en exactamente `200ms`, vas a generar una **tormenta sincronizada** que tira al proveedor de nuevo.

Solución: suma un componente aleatorio (jitter) para desincronizar.

```typescript
const delay = baseDelayMs * Math.pow(factor, attempt - 1)
            + Math.random() * baseDelayMs;
```

#### Qué reintentar y qué NO

```typescript
function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Rate limit, server errors, timeouts
  if (error.message.includes("429")) return true;
  if (error.message.includes("503")) return true;
  if (error.message.includes("502")) return true;
  if (error.message.includes("500")) return true;
  if (error.message.includes("timeout")) return true;
  if (error.message.includes("ECONNRESET")) return true;
  if (error.message.includes("ETIMEDOUT")) return true;

  // No reintentar 4xx (excepto 429), errores de validación, prompts inválidos
  return false;
}
```

> **Patrón de oro:** si el error es de **tu lado** (input mal, schema inválido, key revocada), reintentar es perder tiempo y dinero. Solo reintenta lo que **podría arreglarse esperando**.

#### Idempotencia en LLMs — la trampa

Los LLMs **NO son idempotentes**. Reintentar la misma llamada con `temperature > 0` puede dar respuestas distintas. Implicaciones:

- En reintentos, el usuario puede ver una respuesta distinta entre el intento 2 y el 3 si ambos "responden" (uno falla, el otro éxito tras retry interno del proveedor).
- Para tareas críticas, considera `temperature = 0` + `seed` para hacer los reintentos deterministas.
- Si haces side effects (escribir en BD, enviar email), **los reintentos pueden duplicar acciones**. Tools (M5) tienen que ser idempotentes por diseño.

### 4.4. Fallback entre proveedores

#### El patrón básico

```typescript
async function chatWithFallback(req: ChatRequest): Promise<ChatResponse> {
  try {
    return await chatPrimary(req);
  } catch (error) {
    if (isRetryable(error)) {
      console.warn(`Primary failed, falling back to secondary`);
      return await chatSecondary(req);
    }
    throw error;
  }
}
```

#### Decisiones que tienes que tomar

**¿Qué proveedores son fallback aceptables?** No es trivial:

- **Costo:** si tu primario es Gemini Flash ($0.20/1M input) y tu fallback es Claude Sonnet ($3/1M), un fallback prolongado **multiplica tu factura por 15**.
- **Calidad:** estilo distinto, capacidades distintas, longitud de contexto distinta.
- **Latencia:** un fallback más lento puede degradar UX más que un error rápido en algunos casos.
- **Compliance:** el fallback puede vivir en otra jurisdicción, otro régimen de datos.

**¿Cuándo dejas de hacer fallback?** Estrategia *circuit breaker*: si el primario falla N veces en M segundos, conmuta al fallback **temporalmente** y reintenta el primario después de un tiempo. Sin esto, cada llamada paga la latencia del intento al primario antes del fallback.

> **Para TiendaPro en M2:** un fallback simple "primario falla → secundario" sin circuit breaker es suficiente. El circuit breaker entra en M6 — LLMOps.

#### Antipatrón: fallback silencioso

Hacer fallback **sin alertar** es darse a uno mismo en el pie. Si tu fallback es 10× más caro y opera durante un fin de semana sin que nadie sepa, te despertás el lunes con una factura record.

**Patrón correcto:** fallback **emite una métrica/alerta**. El producto sigue funcionando para el usuario, pero el equipo se entera **inmediatamente**.

### 4.5. Streaming con UX correcta

`streamText` no es solo "mostrar token por token". Hay tres detalles operacionales que cambian la calidad del producto:

#### 1. Manejo de errores **mid-stream**

El stream puede empezar bien y reventar a la mitad. Tu UI necesita:

```typescript
try {
  for await (const chunk of result.textStream) {
    appendToUI(chunk);
  }
  const finalResult = await result;  // ← acá puede tirar
  logSuccess(finalResult);
} catch (error) {
  appendToUI("\n\n[Error: la respuesta se interrumpió. Intenta de nuevo.]");
  logError(error);
}
```

#### 2. Cancelación

El usuario cierra la pestaña, navega a otra ruta, escribe otro mensaje. Tu chat tiene que **cancelar** el stream activo en lugar de seguir gastando tokens.

```typescript
const controller = new AbortController();

const result = streamText({
  model: llm,
  prompt: "...",
  abortSignal: controller.signal,
});

// Cuando el usuario cancela:
controller.abort();
```

#### 3. Finalización con metadata

Al terminar el stream, todavía necesitas la metadata (`usage`, `finishReason`, `providerMetadata`). En Vercel AI SDK, eso se obtiene del `result.usage`, `result.finishReason` (promesas) tras consumir el stream. Tu wrapper debe encapsular ese patrón.

### 4.6. Instrumentación en un único lugar

Cada llamada al LLM debería emitir un evento estructurado. Forma mínima:

```typescript
{
  timestamp: "2026-04-29T12:00:00Z",
  provider: "google",
  model: "gemini-2.5-flash",
  inputTokens: 234,
  outputTokens: 87,
  reasoningTokens: 0,
  latencyMs: 1820,
  costUsd: 0.000134,
  finishReason: "stop",
  retries: 0,
  fallbackUsed: false,
  traceId: "tp-2025-04-29-12345",
  flow: "chat-default",
  user: "tp-user-789",
}
```

Por ahora, hace falta `console.log` con esta forma. En **M6 — LLMOps** lo enchufamos a Langfuse y tenemos dashboards reales.

> **Patrón clave:** el `flow` (qué función LLM se está usando — `chat-default`, `intent-classifier`, `product-recommender`) es la dimensión que más vas a usar para análisis. Sin él, no puedes responder *"¿cuánto me cuesta el clasificador de intent al mes?"*.

#### Cálculo de costo en el wrapper

Tener una tabla simple de precios por modelo, indexada por proveedor + modelo + tipo (input/output/reasoning). El wrapper consulta la tabla con los `usage` reportados y agrega `costUsd` al evento.

```typescript
const PRICES_USD_PER_1M = {
  "google:gemini-2.5-flash": { input: 0.20, output: 1.00 },
  "anthropic:claude-haiku-4-5-20251001": { input: 1.00, output: 5.00 },
  "ollama:*": { input: 0, output: 0 },
};
```

Es un snapshot — desactualizado pasadas 6 meses. **Acepta el desfase**: el orden de magnitud importa más que el centavo exacto a la hora de tomar decisiones de producto.

## 5. Patrones y antipatrones

### Patrones

- **Wrapper desde el segundo call site.** Antes es prematuro. Después es deuda.
- **Retry solo a errores transitorios.** Reintentar un 400 es desperdicio.
- **Backoff exponencial con jitter.** Sin jitter, generas tormentas sincronizadas.
- **Fallback emite alerta o métrica.** Operar en fallback sin saberlo es buscar problemas.
- **Costo calculado en el wrapper.** El wrapper es el único que sabe `usage` y `model` a la vez.
- **Loguear `flow`** para poder analizar costos por funcionalidad después.

### Antipatrones

- **Llamar al SDK del proveedor desde la lógica de negocio.** Acoplas todo a un proveedor y a una versión.
- **Reintentar errores 4xx.** Pierdes tiempo y dinero.
- **Backoff sin jitter.** En clusters grandes, te genera el problema que intentabas resolver.
- **Fallback silencioso.** Diferencias de costo o calidad no detectadas se cobran caro.
- **Ignorar idempotencia.** Tools con side effects + reintentos = duplicaciones (M5 en detalle).
- **Wrapper que solo es passthrough.** Si tu wrapper es `(x) => generateText(x)`, no es wrapper, es boilerplate.

## 6. Conexión con TiendaPro

Hasta ahora `src/lib/llm.ts` exporta el `LanguageModel` directo del SDK. Es la abstracción **del proveedor**, no del **servicio**. En esta sesión vas a:

1. **Crear `src/lib/chat.ts`** con la función `chat()` que envuelve `generateText`, aplica defaults del producto, mide latencia y calcula costo.
2. **Agregar retry** en `chat()` con backoff exponencial + jitter, distinguiendo errores transitorios.
3. **Agregar fallback** entre el proveedor primario (configurado en `.env`) y un secundario predefinido (Ollama local — siempre disponible si lo tienes corriendo).
4. **Agregar `chatStream()`** para que el saludo del asistente use streaming bien hecho (con manejo de error mid-stream).
5. **Migrar `index.ts`** para usar `chat()` / `chatStream()` en lugar de llamar a `generateText` directo.

El módulo entero a partir de esta sesión consume `chat`/`chatStream` — nunca el SDK directo. Esa es la frontera arquitectural del producto.

## 7. Resumen

Tres ideas para llevarte:

1. **El wrapper es la frontera entre tu lógica de negocio y el ecosistema LLM.** Es el único lugar que conoce el SDK del proveedor; todo lo demás consume tu API. Esto te ahorra refactors masivos cuando cambia el modelo, el SDK o el proveedor.
2. **Retry + fallback son baratos de implementar y caros de no tener.** Errores 5xx, rate limits y caídas pasan TODOS los días en producción real. Sin retry, tu producto falla con cada hipo del proveedor.
3. **Instrumentación en el wrapper es la única forma escalable de saber qué hace tu app.** Latencia, tokens, costo y `flow` registrados desde el día 1 te permiten responder preguntas de negocio que de otra forma cuestan refactors enteros (e.g. *"¿cuál de mis 8 features LLM es la más cara?"*).

## 8. Preguntas de auto-evaluación

1. ¿En qué momento conviene escribir el wrapper? ¿Por qué no antes ni después?
2. Lista 3 errores que SÍ reintentar y 3 que NO. Justifica la diferencia conceptualmente.
3. ¿Qué problema resuelve el jitter en el backoff exponencial? Da un ejemplo concreto donde se nota su ausencia.
4. Tu fallback de Gemini Flash a Claude Sonnet llevó 3 horas y nadie se enteró. ¿Cuál es el costo aproximado si en esas 3 horas se atendieron 30K mensajes (1000 input + 200 output cada uno)? ¿Qué tendría que tener el wrapper para que esto no pase?
5. ¿Por qué los LLMs no son idempotentes y qué implicaciones tiene eso para tu retry logic? Da un caso concreto donde reintentar puede romper algo en TiendaPro.
6. Tu wrapper recibe `flow: "intent-classifier"` y `flow: "chat-default"`. ¿Qué pregunta de negocio puedes responder con esto que sin esto no puedes?

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 4 ejercicios + reto + aporte al proyecto integrador.

**Próxima sesión:** [`S04 — Salidas estructuradas, JSON y guardrails`](../sesion-04-salidas-estructuradas/) → cuando el modelo tiene que devolver datos parseables (no texto libre) y tu app necesita garantías sobre el shape.
