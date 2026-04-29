# Sesión 02 — Mecánica básica del LLM: tokens, contexto, parámetros y tools

> **Módulo:** 2 — Patrones de aplicaciones LLM · **Duración estimada:** 2h (~50 min lectura + ~70 min práctica) · **Formato:** 50% teoría / 50% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión vas a poder:

- Explicar **qué es un token** desde el punto de vista del modelo (no solo "una palabrita") y por qué tokenización afecta costo, calidad y multilingüismo.
- Describir cómo funciona la **context window**, qué cabe dentro y qué pasa cuando se llena.
- Manipular conscientemente los **parámetros de inferencia** (`temperature`, `top_p`, `top_k`, `maxOutputTokens`, `stop`, `seed`, `frequencyPenalty`, `presencePenalty`) y predecir el efecto de cada uno.
- Reconocer cuándo un modelo está consumiendo **reasoning tokens** (thinking de Gemini 2.5, o-series de OpenAI, extended thinking de Claude) y cómo afecta latencia y costo.
- Explicar conceptualmente qué son los **tools / function calling** y cuándo justifica usarlos (la implementación profunda llega en M5).
- Decidir entre **`generateText` vs `streamText`** según UX y caso de uso.

## 2. Prerequisitos

- Módulo 1 completo. Especialmente:
  - **S00.2** — Cómo funciona un LLM por dentro (Transformer, atención, generación token por token).
  - **S01.1 / S01.2** — Vercel AI SDK + estructura de la respuesta + multi-provider.
- Proyecto integrador (`code/proyecto-integrador/`) corriendo, con al menos un proveedor configurado en `.env`.

## 3. Conceptos clave

- **Token:** unidad mínima de procesamiento del modelo. No es una letra ni una palabra: es un fragmento de texto definido por un vocabulario aprendido (BPE — Byte Pair Encoding). El mismo texto produce **distinta cantidad de tokens según el tokenizer** del proveedor.
- **Context window:** la cantidad máxima de tokens (input + output) que el modelo puede considerar en una sola llamada. Hoy va de 8K (modelos viejos) a 1M+ (Gemini Pro, Claude Sonnet preview).
- **Parámetros de inferencia:** controles que tienes en CADA llamada para ajustar el comportamiento del modelo. NO son hiperparámetros de entrenamiento — son del momento de la inferencia.
- **Reasoning tokens:** tokens que algunos modelos generan internamente como "pensamiento" antes de la respuesta final. No los ves, pero **los pagas**.
- **Tool calling (function calling):** mecanismo por el cual el modelo decide invocar una función externa (consultar BD, hacer una API call) en vez de responder directo. La función la ejecuta tu código, no el modelo.
- **Streaming:** recibir la respuesta token a token mientras el modelo la genera, en lugar de esperar al texto completo.

## 4. Teoría

### 4.1. Tokens en profundidad

Un LLM **no procesa caracteres ni palabras**. Procesa tokens — IDs numéricos en un vocabulario fijo aprendido durante el entrenamiento. El proceso es:

```
"Hola, ¿cómo estás?"
        ↓ tokenizer
[10001, 24, 9876, 5544, 33]
        ↓ embedding
[vector1, vector2, vector3, vector4, vector5]
        ↓ Transformer
... (genera el siguiente token)
```

#### Byte Pair Encoding (BPE) — la idea esencial

El tokenizer se construye iterativamente:

1. Empiezas con caracteres o bytes.
2. Buscas los pares más frecuentes en el corpus (`th`, `er`, `ing`, `ción`).
3. Los reemplazas por un nuevo token.
4. Repites hasta llenar el vocabulario (típicamente 30K–200K tokens).

**Consecuencia inmediata:** las palabras frecuentes en el idioma del corpus de entrenamiento son 1 token. Las raras se parten en sub-palabras.

| Texto | Tokens GPT-4 (aprox.) | Notas |
|-------|----------------------|-------|
| `"hello"` | 1 | Inglés común |
| `"hello world"` | 2 | Espacio + palabra → 1 token cada uno |
| `"antidisestablishmentarianism"` | ~6 | Palabra rara, se parte |
| `"hola"` | 1–2 | Depende del tokenizer |
| `"¿cómo estás?"` | 4–6 | Caracteres acentuados y `¿` consumen extra |
| `"こんにちは"` | 5–10 | Idiomas no-latinos pueden ser 1 token por carácter |

> **La regla práctica del español:** cuenta entre **0.5 y 0.7 palabras por token**. El inglés, **0.75**. El japonés/chino/coreano, **0.3–0.5**. Esto significa que **el mismo contenido cuesta más en español que en inglés**, simplemente por tokenización.

#### Cómo verlo con tus propios ojos

El playground oficial de OpenAI ([platform.openai.com/tokenizer](https://platform.openai.com/tokenizer)) y el de Anthropic muestran exactamente cómo se tokeniza un texto. Es la forma más rápida de internalizar el concepto.

En código, vas a usar el script `tokenize.ts` de los ejercicios, que tokeniza el mismo texto contra varios proveedores y muestra la diferencia.

#### Asimetría de costo input/output — la explicación

Ya viste en S00.1 que **output cuesta 3-5× más que input**. Ahora puedes entender por qué:

- **Input:** el modelo lee los tokens en una sola pasada (forward pass) sobre la attention. Es paralelizable.
- **Output:** el modelo genera **un token a la vez**, y para cada uno hace otro forward pass. Es secuencial. Cada token de output requiere atender a TODOS los tokens previos (input + output ya generado).

Por eso: input es O(N) en tiempo de cómputo, output es O(N²). El precio refleja eso.

### 4.2. Context window: qué cabe y qué se descarta

La context window es el **tamaño máximo de tokens (input + output) que el modelo procesa en una sola llamada**.

Snapshot de referencia (abril 2026):

| Modelo | Context window | Qué significa en práctica |
|--------|----------------|---------------------------|
| GPT-3.5 (legacy) | 4K | Una conversación corta |
| Claude Haiku 4.5 | 200K | ~150 páginas de texto |
| Claude Sonnet 4.6 | 200K (1M preview) | Libros enteros |
| GPT-5 | 256K | Documentos extensos completos |
| Gemini 2.5 Pro | 1M+ | Codebase entero, libros múltiples |
| Llama 3.1:8B (Ollama) | 128K | Generoso para self-hosted |

#### Qué cabe dentro

```
┌─────────────────────────── context window ───────────────────────────┐
│ system prompt    │ historial │ contexto RAG │ user msg │ ← input ─── │
│                                                          ↓           │
│ ──────────────────────────────────────────── reasoning tokens ────── │
│                                                          ↓           │
│ ───────────────────────────────────────────── output tokens ──────── │
└──────────────────────────────────────────────────────────────────────┘
```

**Todos esos componentes comparten el mismo presupuesto.** Si tu system prompt mide 3K tokens y el historial 5K, te quedan ~192K para el contexto RAG y la respuesta (con Haiku/Sonnet).

#### Qué pasa cuando se llena

Tres comportamientos posibles según el SDK/proveedor:

1. **Error:** el SDK te devuelve un error explícito (`context_length_exceeded`, similar). Es lo más común con APIs cloud.
2. **Truncado silencioso:** el proveedor descarta los tokens más viejos sin avisarte (raro, pero pasa con configuraciones específicas).
3. **`finishReason: "length"`** en el output: el modelo se cortó a mitad de respuesta porque chocó con el límite. Lo viste en S01.2.

#### Antipatrón clásico: "tengo 1M de context, le meto el catálogo entero"

El context window grande es una **invitación al desperdicio**. Tres razones por las que NO quieres llenar la ventana aunque puedas:

- **Costo:** pagas por cada token de input. 1M tokens son ~$1 en Gemini Flash, ~$3 en Sonnet, ~$15 en Opus. **Por llamada.** Si tienes 10K llamadas/día, sale el sueldo de un junior.
- **Latencia:** procesar 1M tokens lleva varios segundos. La UX se degrada drásticamente con context > 100K.
- **Calidad:** los modelos sufren *lost in the middle*. Información que está en el medio de un prompt largo es ignorada con más frecuencia que la del principio o del final.

> **La regla:** trata a la context window como espacio de RAM premium. Mete lo que necesitas, no lo que cabe.

### 4.3. Parámetros de inferencia

Cada llamada a un LLM acepta un set de parámetros que controlan **cómo se sampleaa el siguiente token**. Vamos uno por uno con la intuición correcta.

#### `temperature`

Controla la aleatoriedad del sampling. Internamente afecta cómo se aplana o agudiza la distribución de probabilidades del siguiente token.

| Valor | Comportamiento | Cuándo usarlo |
|-------|----------------|---------------|
| `0` | Determinístico (siempre el token más probable) | Clasificación, extracción, structured outputs, debugging |
| `0.2–0.3` | Casi-determinístico, pequeñas variaciones | Respuestas de soporte donde quieres consistencia con algo de naturalidad |
| `0.7` | Creatividad moderada, natural | Default de muchos proveedores. Conversación general |
| `1.0` | Creativo, variado | Brainstorming, copy creativo, lluvia de ideas |
| `> 1.2` | Caótico, salidas inestables | Casi nunca. Experimental |

> **Importante:** `temperature = 0` no garantiza reproducibilidad **bit a bit** entre llamadas (los proveedores aplican micro-optimizaciones que pueden generar varianza). Pero sí garantiza que vas a obtener salidas **muy** parecidas. Para reproducibilidad estricta, usá `seed` (cuando esté disponible).

#### `top_p` (nucleus sampling)

En vez de muestrear sobre toda la distribución, considera solo el conjunto **más pequeño** de tokens cuya probabilidad acumulada sume `top_p`. Por ejemplo, `top_p = 0.9` mantiene los tokens que cubren el 90% de la masa de probabilidad y descarta el resto.

- **Default típico:** `0.9` o `1.0`.
- **Relación con temperature:** son dos formas de controlar la aleatoriedad. **Modifica UNA, no las dos al mismo tiempo.** Si bajas temperature, deja top_p en default. Si bajas top_p, deja temperature en default.

#### `top_k`

Considera solo los `k` tokens más probables. `top_k = 40` ignora todos menos los 40 más probables. Es una forma más burda que `top_p` y muchos proveedores ya no la exponen. Si está disponible y sabes lo que haces, úsala. Si no, ignórala.

#### `maxOutputTokens`

Límite duro de cuántos tokens puede generar el modelo. **Configúralo siempre.**

```typescript
generateText({
  model: llm,
  prompt: "...",
  maxOutputTokens: 500, // ← evita respuestas runaway
})
```

Sin este límite, el modelo puede generar respuestas larguísimas que cuestan dinero, latencia y degradan UX. Si chocas con `finishReason: "length"`, sabes que tu respuesta se truncó — sube el límite o divide el prompt.

#### `stop` (stop sequences)

Strings que, cuando aparecen en la salida, hacen que el modelo deje de generar.

```typescript
stopSequences: ["</answer>", "User:"]
```

Útil para forzar formatos custom. Por ejemplo, si pides al modelo que responda en formato `Q: ... A: ...` y quieres que pare al ver `Q:`, usas stop sequences.

#### `seed`

Disponible en algunos proveedores (OpenAI, vía Vercel AI SDK). Hace que para el mismo prompt + mismos parámetros, la salida sea reproducible **siempre que el modelo no cambie de versión internamente**. Útil para tests.

#### `frequencyPenalty` y `presencePenalty`

Penalizan tokens que aparecen muchas veces (frequency) o que ya aparecieron (presence) para reducir repetición.

- `frequencyPenalty: 0.5` → reduce probabilidad de tokens que se repiten.
- `presencePenalty: 0.5` → reduce probabilidad de tokens que ya aparecieron, sin importar cuántas veces.

Default `0`. Subilos a `0.1–0.3` solo si ves al modelo repetirse. **No son sustitutos de un mejor prompt** — si tienes que penalizar repetición, probablemente el prompt es mejorable.

#### Tabla de defaults peligrosos

| Parámetro | Default usual | Riesgo si no lo configuras |
|-----------|---------------|------------------------|
| `temperature` | 0.7–1.0 | Comportamiento no determinístico cuando lo necesitas determinístico |
| `maxOutputTokens` | "ilimitado" o muy alto | Respuestas runaway, costo y latencia explotando |
| `top_p` | 0.9–1.0 | Generalmente seguro, no necesitas cambiarlo |

> **Patrón de producción:** configura `temperature` y `maxOutputTokens` **explícitos en TODA llamada**. Nunca confíes en el default del proveedor.

### 4.4. Reasoning tokens — el costo invisible

Algunos modelos **generan tokens internos antes de la respuesta final**. Los usan para "pensar" — descomponen el problema, exploran opciones, validan lógica.

Modelos con reasoning interno:

| Modelo | Modo |
|--------|------|
| **OpenAI o-series** (o3, o4) | Reasoning siempre activo |
| **Gemini 2.5 Flash / Pro** | "Thinking mode" opcional |
| **Claude Sonnet 4.6 / Opus 4** | "Extended thinking" opcional |

**Implicación operacional:**

```
Llamada estándar:        input → [output]
Llamada con reasoning:   input → [reasoning hidden] → [output]
                                  ↑
                                  Tokens que NO ves pero pagas
```

En `result.usage` muchos proveedores exponen `reasoningTokens` separados. **Sumalos al cálculo de costo** porque a veces son 5-10× más que los tokens de output visible.

> **Patrón:** activa reasoning solo cuando la tarea lo justifique (matemática, código complejo, planificación). Para clasificación o respuestas simples, **lo gastas de gusto**.

### 4.5. Tools (function calling) — solo intro

Un **tool** es una función que el modelo puede decidir invocar para obtener información o ejecutar una acción que NO puede hacer por sí solo (consultar BD, hacer un fetch, ejecutar código, leer un archivo).

#### El flujo conceptual

```
1. Tú defines un tool con nombre, descripción y schema de parámetros.
2. Lo pasas a la llamada al LLM.
3. El modelo, durante la generación, decide:
   a) Responder directo con texto, O
   b) "Llamar al tool" devolviendo un JSON con los args.
4. Tu código ejecuta el tool (es código TUYO, no del modelo).
5. Devuelves el resultado al modelo.
6. El modelo genera la respuesta final usando ese resultado.
```

#### Ejemplo conceptual con TiendaPro

```typescript
const consultarPedido = {
  description: "Obtener el estado de un pedido por ID",
  parameters: z.object({ orderId: z.string() }),
  execute: async ({ orderId }) => db.findOrder(orderId),
};

// El modelo, ante "¿dónde está mi pedido 1234?", invoca consultarPedido({orderId: "1234"})
```

#### Por qué importa ya en S02

Aunque la implementación profunda llega en **M5 — Orquestación de agentes**, conviene saber desde ya que:

- **`finishReason: "tool-calls"`** que viste en S01.2 indica que el modelo quiso invocar un tool.
- Los tools consumen **tokens de input adicionales** (la descripción del tool va en el contexto cada llamada).
- Cada interacción tool-call → tool-result → respuesta final son **múltiples llamadas al modelo**, no una.

### 4.6. `generateText` vs `streamText`

Vercel AI SDK te ofrece dos primitivas principales:

| Primitiva | Cuándo usarla |
|-----------|---------------|
| `generateText` | Necesitas la respuesta completa antes de procesarla. Ej: clasificación, extracción, structured outputs, scripts batch |
| `streamText` | UX conversacional. El usuario ve la respuesta aparecer en tiempo real |

#### El argumento técnico para streaming

Una respuesta de 300 tokens con un modelo de 50 tokens/segundo lleva **6 segundos**. Sin streaming, el usuario espera 6 segundos viendo un spinner. Con streaming, ve la primera palabra en ~200ms y la respuesta fluyendo.

**Time to First Token (TTFT)** es la métrica clave de UX en chat. Streaming mantiene TTFT bajo aunque el total sea alto.

#### Cuándo NO streamear

- Si tienes que validar la respuesta entera antes de mostrarla (structured outputs con schema, JSON parsing).
- Si el flujo es batch / async sin usuario esperando.
- Si necesitas aplicar guardrails post-generación al texto completo.

> **Patrón de TiendaPro:** chat usa `streamText`. Clasificación de intent y consulta de pedido (intermediarios internos) usan `generateText`.

## 5. Patrones y antipatrones

### Patrones

- **Setear `temperature` y `maxOutputTokens` explícitos en TODA llamada de producción.** El default es lo que usa cualquiera; tú eres el ingeniero.
- **`temperature = 0` para tareas estructuradas** (clasificación, extracción, JSON). Aceptas algo de aleatoriedad solo en generación creativa o conversacional.
- **Stream para chat, generate para todo lo demás.** TTFT manda la UX conversacional.
- **Loguear `reasoningTokens` cuando el modelo lo expone.** Es la diferencia entre saber qué pagas y descubrirlo en la factura.
- **Pensar el contexto como RAM cara.** Mete lo necesario, no lo que cabe.

### Antipatrones

- **Tunear `temperature` y `top_p` simultáneamente.** Modificás una a la vez para razonar el efecto.
- **Llenar la context window porque "tengo 1M de tokens".** Costo + latencia + lost-in-the-middle te van a romper la app.
- **Ignorar `finishReason: "length"`.** Significa que tu respuesta llegó truncada al usuario. Es un bug, no un detalle.
- **Activar reasoning para tareas simples.** Pagás 5-10× más sin que el resultado mejore.
- **Usar `frequencyPenalty` / `presencePenalty` como sustituto de prompt mejor.** Tratar el síntoma sin tratar la causa.

## 6. Conexión con TiendaPro

Hasta ahora TiendaPro hace UNA llamada con defaults. En esta sesión vas a:

- Setear `temperature` y `maxOutputTokens` explícitos en `index.ts`.
- Agregar logging de `reasoningTokens` cuando el proveedor lo expone.
- Reemplazar `generateText` por `streamText` para que el "Hola, soy el asistente" aparezca por streaming (UX conversacional).
- Documentar en el README del proyecto qué parámetros usas y por qué.

Estos cambios NO son cosméticos: son la base mecánica sobre la que construimos los wrappers (S03), las salidas estructuradas (S04) y el resto del módulo. Sin parámetros explícitos, el resto del módulo es arena.

## 7. Resumen

Tres ideas para llevarte:

1. **Tokens son la unidad operacional del LLM**, y la tokenización es asimétrica (output 3-5× más caro que input por una razón técnica) y dependiente del idioma (español cuesta más que inglés). Aceptá esto desde el día 1 — todo el modelado de costos del curso depende de ello.
2. **Los parámetros de inferencia son palancas que controlas en cada llamada.** `temperature` y `maxOutputTokens` siempre explícitos. El resto, default salvo razón concreta. Y nunca toques `temperature` y `top_p` a la vez.
3. **El context window grande NO es invitación a llenarlo.** Pagás por cada token, sufrís latencia y los modelos pierden información en el medio de prompts gigantes. Trata la ventana como RAM cara.

## 8. Preguntas de auto-evaluación

Si no puedes responderlas sin volver a leer, no aprendiste el concepto.

1. Por qué el output cuesta 3-5× más que el input. Da la razón técnica, no la económica.
2. Tu app reporta el mismo prompt que cuesta **40 tokens** en GPT-4 y **52 tokens** en Claude. ¿Por qué pasa esto y qué implicación tiene si quisieras hacer un benchmark de costo "fair"?
3. ¿En qué casos configuras `temperature = 0`? ¿En cuáles `temperature = 0.7`? Da un ejemplo de cada uno aplicado a TiendaPro.
4. Tu modelo tiene 200K de context window. Tu prompt mide 195K. ¿Cuál es el problema, aunque "técnicamente entre"?
5. Activaste "extended thinking" en Claude para una tarea de clasificación de intent. La latencia se duplicó y el costo se cuadruplicó. ¿Qué hiciste mal?
6. ¿Cuándo usas `streamText` y cuándo `generateText` en TiendaPro? Da un caso de cada uno.

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 4 ejercicios prácticos con scripts ejecutables (~70 min).

**Próxima sesión:** [`S03 — Wrappers y abstracciones sobre el modelo`](../sesion-03-wrappers/) → construimos la capa que toda app LLM en producción necesita: punto único de instrumentación, retries, fallback entre proveedores y streaming bien hecho.
