# Sesión 03 — Ejercicios

> **Tiempo estimado:** ~70 min total. Construyes paso a paso un chat service con retry, fallback e instrumentación. Los scripts viven en [`code/m02-patrones-llm/sesion-03/`](../../../../code/m02-patrones-llm/sesion-03/).

---

## Setup

```bash
cd code/m02-patrones-llm/sesion-03
pnpm install
```

`.env` configurado en la raíz, con al menos un proveedor cloud y Ollama (para probar fallback). Si solo tienes uno, los ejercicios funcionan, pero el de fallback (3) requiere dos.

---

## 1. Ejercicio guiado: chat service básico

**Objetivo:** construir el wrapper mínimo viable y entender el shape correcto.

### 1.1. Estructura

El archivo `src/chat.ts` ya está creado con un esqueleto:

```typescript
export interface ChatRequest { ... }
export interface ChatResponse { ... }
export async function chat(req: ChatRequest): Promise<ChatResponse> {
  // TODO: implementar
}
```

### 1.2. Tu tarea

Implementa `chat()` con estas reglas:

1. Aplica defaults de producto: `temperature = 0.5`, `maxOutputTokens = 500`.
2. Convierte `messages` (rol + content) a la forma que pide Vercel AI SDK (`generateText` acepta `messages` directo).
3. Mide latencia con `Date.now()` antes y después.
4. Calcula costo con la función `priceFor(model, inputTokens, outputTokens)` ya provista en `src/pricing.ts`.
5. Devuelve `ChatResponse` normalizada.

### 1.3. Validación

```bash
pnpm run chat
```

Salida esperada:

```
[provider: google]
[flow: chat-default]

→ Respuesta: ¡Hola! Soy el asistente de TiendaPro, encantado de ayudarte.

Tokens — input: 78, output: 19
Latencia: 1240 ms
Costo estimado: $0.0000346
finishReason: stop
```

### 1.4. Pregunta para ti

¿Por qué el wrapper aplica defaults aunque el caller los puede pasar explícitos? Escribe la respuesta en una frase.

> **Razonamiento sugerido:** porque la mayoría de los call sites no van a pasarlos. Si el wrapper no aplica defaults razonables del producto, esos call sites heredan defaults arbitrarios del proveedor (por ejemplo `temperature = 1`), que es justo lo que el wrapper debería evitar.

---

## 2. Ejercicio: retry con backoff exponencial

**Objetivo:** agregar retry transparente al wrapper.

### 2.1. Tu tarea

Implementa `withRetry(fn, opts)` en `src/retry.ts` con:

- `maxRetries: 3` por defecto.
- `baseDelayMs: 200` por defecto.
- `factor: 2` por defecto.
- Jitter: `Math.random() * baseDelayMs`.
- `shouldRetry(error)` que retorna `true` solo para errores de red, 429, 5xx, timeout.

Después, envuelve la llamada a `generateText` dentro de `chat()` con `withRetry`.

### 2.2. Probarlo

`src/retry-demo.ts` simula un error transitorio que se resuelve al tercer intento (mockea `generateText`):

```bash
pnpm run retry-demo
```

Salida esperada:

```
[Intento 1] simulando rate limit...
[Intento 2] simulando rate limit...
[Intento 3] OK
Respuesta final tras 2 retries: "...".
```

### 2.3. Pregunta para ti

¿Qué pasa si tu retry hace **5 intentos** con backoff `200, 400, 800, 1600, 3200` ms y la API tiene un timeout total de 10 segundos por request?

> **Razonamiento sugerido:** la suma de las esperas (`200 + 400 + 800 + 1600 = 3000ms` antes del 5º intento) más la latencia normal de cada intento puede exceder el timeout total disponible para que tu app responda. Si el cliente HTTP corta a los 10s y reintentas 5 veces, el último retry probablemente no completa. Conclusión: ajusta `maxRetries` al budget de latencia que tienes para responderle al usuario.

---

## 3. Ejercicio: fallback entre proveedores

**Objetivo:** agregar fallback de proveedor primario (cloud) a secundario (Ollama) cuando el primario falla.

### 3.1. Tu tarea

En `src/chat.ts`, implementa `chatWithFallback`:

```typescript
async function chatWithFallback(req: ChatRequest): Promise<ChatResponse> {
  try {
    return await chatPrimary(req);
  } catch (err) {
    if (!shouldFallback(err)) throw err;
    console.warn("[fallback] primary failed → using secondary");
    const response = await chatSecondary(req);
    return { ...response, fallbackUsed: true };
  }
}
```

Para el ejercicio:

- `chatPrimary`: usa el proveedor configurado en `DEFAULT_LLM_PROVIDER`.
- `chatSecondary`: usa siempre Ollama (asume `OLLAMA_BASE_URL` configurado).
- `shouldFallback`: misma lógica que `shouldRetry`.

### 3.2. Probarlo

`src/fallback-demo.ts` fuerza un fallo en el primario apuntando a una URL inválida y observa el fallback:

```bash
pnpm run fallback-demo
```

Salida esperada (si Ollama está corriendo):

```
[primary: bad-provider] simulando caída...
[fallback] primary failed → using secondary
[fallback: ollama]
→ Respuesta: ...
fallbackUsed: true
```

### 3.3. Pregunta para ti

Tu fallback de Gemini Flash a Claude Sonnet operó silenciosamente durante un fin de semana — 60K mensajes. ¿Cuál es el costo aproximado del fallback comparado con el primario? Asume 1000 tokens input + 200 tokens output por mensaje.

> **Cálculo:**
>
> - Primario (Flash): `60K × (1K × $0.20/1M + 200 × $1/1M) = 60K × ($0.0002 + $0.0002) = $24`
> - Secundario (Sonnet): `60K × (1K × $3/1M + 200 × $15/1M) = 60K × ($0.003 + $0.003) = $360`
>
> **Diferencia: $336 que nadie esperaba pagar ese fin de semana.** Por eso el fallback debe emitir alerta — no operar invisible.

---

## 4. Ejercicio: streaming con manejo de errores y cancelación

**Objetivo:** wrapper de streaming con UX correcta.

### 4.1. Tu tarea

Implementa `chatStream(req): AsyncIterable<string>` en `src/chat.ts` que:

1. Ejecute `streamText` con los mismos defaults que `chat()`.
2. Reciba un `AbortSignal` opcional para cancelación.
3. Maneje errores mid-stream sin romper el iterable (yield un mensaje de error y termina limpio).
4. Loguee la metadata final cuando el stream completa.

### 4.2. Probarlo

```bash
pnpm run streaming-demo
```

El script ejecuta `chatStream` y muestra los chunks en tiempo real. Después, ejecuta una segunda corrida que se cancela a los 500ms:

```
=== Stream completo ===
TiendaPro: Hola, soy el asistente... [respuesta completa]
[stream completed: 87 output tokens, 1840ms total]

=== Stream cancelado a 500ms ===
TiendaPro: Hola, so[CANCELLED]
[stream aborted by client]
```

### 4.3. Pregunta para ti

¿Por qué cancelar el stream cuando el usuario cierra la pestaña es tan importante? Piensa en al menos 2 razones operacionales.

> **Razonamiento sugerido:**
>
> 1. **Costo:** cada token de output que el modelo genere te lo cobran, aunque nadie lo lea. En productos con alto abandono, esto se nota.
> 2. **Concurrencia:** muchos providers tienen rate limits por requests concurrentes. Streams "zombies" cuentan contra ese límite y reducen tu capacidad para usuarios activos.
> 3. **Recursos del servidor:** cada conexión activa consume memoria y file descriptors. Streams sin cancelar acumulados pueden matar tu proceso.

---

## 5. Reto: instrumentación con `flow` y agregación

**Objetivo:** usar el campo `flow` para responder una pregunta de negocio real.

### 5.1. Tu tarea

1. Agrega un parámetro `flow` a `ChatRequest` (string, default `"unknown"`).
2. Loguea cada llamada en `logs/calls.jsonl` (un JSON por línea con todos los campos de `ChatResponse` + `flow` + timestamp).
3. Crea `src/aggregate.ts` que lee el log y emite:

```
=== Costo por flow (últimos 7 días) ===
chat-default      $1.247  ← 312 llamadas
intent-classifier $0.083  ←  98 llamadas
product-suggester $0.412  ← 156 llamadas
TOTAL             $1.742  ← 566 llamadas
```

### 5.2. Probarlo

`src/flow-demo.ts` ejecuta varias llamadas con flows distintos para llenar el log. Después corre el agregador:

```bash
pnpm run flow-demo
pnpm run aggregate
```

### 5.3. Pregunta para ti

Tu agregado dice que `intent-classifier` cuesta $0.083 al mes en 98 llamadas. ¿Qué decisión de producto podrías tomar con eso? Da 2 ejemplos.

> **Razonamiento sugerido:**
>
> 1. **Confirmar economía:** 98 llamadas/mes × $0.0008/llamada → costo despreciable. Concluir que el clasificador de intent NO es donde optimizar.
> 2. **Detectar bug si los números no cuadran:** si tu app procesa 100K mensajes/día pero el log dice solo 98 al mes, el wrapper no está siendo invocado por el `intent-classifier` flow → falta logging.
> 3. **Cambiar de modelo si justifica:** si encontrás que `chat-default` cuesta el 80% del total mensual, conviene mover ese flow a un modelo más barato O cachear FAQs comunes.

---

## 6. Aporte al proyecto integrador

Hito acumulado de M2 (S02 + S03 hasta acá): TiendaPro ya no llama al SDK directamente; consume su propio `chat`/`chatStream` con retry, fallback e instrumentación.

### 6.1. Tarea

1. Copia el `src/chat.ts` que construiste en este ejercicio a `code/proyecto-integrador/src/lib/chat.ts`.
2. Crea `code/proyecto-integrador/src/lib/pricing.ts` con la tabla de precios.
3. Migra `code/proyecto-integrador/src/index.ts` para usar `chatStream({ messages: [{ role: "user", content: USER_PROMPT }], system: SYSTEM_PROMPT, flow: "saludo-inicial" })` en lugar de `streamText` directo.
4. Confirma que `pnpm dev` desde el proyecto integrador sigue funcionando con la nueva forma.

### 6.2. Validación

```
[provider: google]
[flow: saludo-inicial]

TiendaPro: Hola, soy el asistente virtual de TiendaPro. ¿En qué puedo ayudarte hoy?

Latencia: 1280ms
Tokens — input: 67, output: 21
Costo estimado: $0.0000345
fallbackUsed: false
```

> **Importante:** este cambio NO genera commit propio. Lo agrupamos con S04 cuando cierres "asistente conversacional con personalidad + structured outputs". Mientras tanto, en local.

---

**Vuelve a:** [`README de la sesión`](README.md) | **Próximo paso:** [`recursos.md`](recursos.md).
