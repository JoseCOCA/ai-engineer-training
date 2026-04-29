# Sesión 01.1 — Setup del entorno + primera llamada a un LLM

> **Módulo:** 1 — Fundamentos · **Duración estimada:** 1h (~25 min lectura + ~35 min lab) · **Formato:** 40% teoría / 60% lab (invertido respecto a S00.x — esta sesión es práctica)

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión vas a poder:

- Correr el primer commit del proyecto integrador (TiendaPro) y obtener una respuesta real de un LLM.
- Explicar la **anatomía de una llamada** con Vercel AI SDK: provider → model → `generateText`.
- Entender por qué la app **nunca importa SDKs de proveedores directamente** y dónde vive la única excepción (`src/lib/llm.ts`).
- Cambiar de proveedor LLM **sin tocar una sola línea de código de la aplicación**, solo editando `.env`.
- Leer la **estructura de la respuesta** (`text`, `usage`, `finishReason`) y conectar lo que ves con la teoría de S00.2 (tokens, generación autoregresiva).
- Distinguir cuándo usar `generateText` y cuándo `streamText`.

## 2. Prerequisitos

- Haber completado **S00.1** (panorama y stack mental) y **S00.2** (cómo funciona un LLM por dentro).
- Tener el setup del entorno hecho según [`docs/01-setup.md`](../../../01-setup.md): Node.js 20+, pnpm, al menos un proveedor LLM configurado (Ollama local recomendado, Gemini free tier como alternativa).
- Haber copiado `env.example` a `.env` en la raíz del repo y completado al menos una API key o tener Ollama corriendo.

## 3. Conceptos clave

- **Vercel AI SDK (`ai`):** la librería de abstracción de proveedores LLM que usamos en todo el curso. Provee funciones genéricas como `generateText` y `streamText` que aceptan **cualquier modelo** que implemente la interfaz `LanguageModel`.
- **`LanguageModel`:** el tipo polimórfico que unifica modelos de Anthropic, Google, OpenAI, Ollama y otros. Tu código consume `LanguageModel`, no implementaciones concretas.
- **Capa de abstracción:** el archivo (`src/lib/llm.ts`) que importa los SDKs de proveedor y devuelve un `LanguageModel` configurado según `.env`. Es la única pieza del proyecto que conoce los detalles de los proveedores.
- **`generateText`:** función de `ai` que ejecuta una llamada completa al modelo y devuelve la respuesta cuando termina.
- **`streamText`:** equivalente a `generateText` pero entrega tokens a medida que se generan (UX conversacional).

## 4. Teoría

### 4.1. Anatomía de una llamada con Vercel AI SDK

Toda interacción con un LLM en este curso se reduce a **3 piezas**:

```typescript
import { generateText } from "ai";       // ← función genérica
import { llm } from "./lib/llm.js";      // ← modelo (LanguageModel)

const result = await generateText({
  model: llm,                            // ← qué modelo usar
  system: "Eres el asistente de TiendaPro...",
  prompt: "Hola",
});
```

Las **3 piezas**:

1. **El verb (`generateText`)** — qué quieres hacer (generar texto, generar JSON, llamar tools, hacer streaming).
2. **El modelo (`llm`)** — qué LLM ejecutar. Polimórfico: puede ser cualquier proveedor.
3. **Los argumentos (`system`, `prompt`, etc.)** — el contenido y la configuración de la llamada.

**El truco pedagógico está en el punto 2.** El verb no sabe ni le importa qué hay dentro de `llm`. Eso lo decide la capa de abstracción.

### 4.2. Por qué importar de `ai` y no del SDK del proveedor

Hay dos formas de hacer una llamada a Anthropic con TypeScript. Aquí está la diferencia, y por qué este curso elige una sobre la otra:

#### Forma A — directo al SDK del proveedor (ANTIPATRÓN para este curso)

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hola" }],
});
```

**Problema:** estás casado con Anthropic. Cambiar a Gemini = reescribir esta función. Cambiar a Ollama local = reescribirla otra vez. Probar Sonnet vs Haiku = sí, también es código.

#### Forma B — vía Vercel AI SDK (PATRÓN del curso)

```typescript
import { generateText } from "ai";
import { llm } from "./lib/llm.js";

const result = await generateText({
  model: llm,
  prompt: "Hola",
});
```

**Beneficio:** la app **no sabe** qué proveedor está detrás. Cambiar de Anthropic a Gemini a Ollama = editar una línea en `.env`. Cero refactor.

> **La regla del curso:** los `import` de `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai` y `ollama-ai-provider-v2` **viven SOLO en `src/lib/llm.ts`**. Si alguna vez ves uno de estos imports en otro lado, es un bug arquitectural.

### 4.3. La estructura de la respuesta

El objeto que devuelve `generateText` no es solo el texto — trae toda la metadata que necesitas para entender qué pasó:

```typescript
const result = await generateText({ model: llm, prompt: "..." });

result.text          // string con la respuesta
result.usage         // { inputTokens, outputTokens, totalTokens }
result.finishReason  // "stop" | "length" | "tool-calls" | "content-filter" | "error" | "other" | "unknown"
result.warnings      // problemas no fatales detectados por el SDK
```

#### Cada campo te dice algo

- **`text`** — lo obvio: la respuesta. Pero es solo eso, no metadata.
- **`usage.inputTokens`** — cuántos tokens contó el proveedor en TU prompt (system + user + history). Te permite estimar costo. **Suele ser distinto a tu cuenta local con tiktoken porque cada proveedor tokeniza diferente.**
- **`usage.outputTokens`** — cuántos tokens generó el modelo. Es el factor caro (3-5× input, ver S00.1).
- **`finishReason`** — por qué se detuvo el modelo:
  - `"stop"` — terminó de forma natural (el modelo decidió que ya respondió). **Lo que quieres en la mayoría de casos.**
  - `"length"` — chocó con `maxOutputTokens`. **Ojo:** la respuesta está truncada a la mitad. Necesitas subir el límite o cambiar el prompt.
  - `"tool-calls"` — el modelo decidió invocar un tool en lugar de responder texto. Lo cubrimos en M5.
  - `"content-filter"` — el proveedor bloqueó la respuesta por políticas. Más común con OpenAI y Anthropic.
- **`warnings`** — el SDK detectó algo raro pero no bloqueante. Vale la pena loguearlo en producción.

> **Patrón de producción:** loguear `finishReason` y `usage` en TODA llamada al LLM. En M6 vamos a hacer esto sistemáticamente con Langfuse.

### 4.4. `generateText` vs `streamText` — cuándo cada uno

Ambas funciones hacen lo mismo conceptualmente: llamar al modelo y devolver la respuesta. La diferencia está en **cuándo te entregan los tokens**.

| | `generateText` | `streamText` |
|---|---|---|
| **Cómo entrega tokens** | Espera a tener TODA la respuesta y la devuelve de una | Devuelve un stream que emite cada token a medida que sale |
| **Latencia percibida por el usuario** | Igual a la latencia real (esperas 5s por una respuesta de 5s) | Mucho menor (ves el primer token en ~200ms) |
| **Complejidad de uso** | Simple (await + response) | Requiere consumir un stream + manejar lifecycle |
| **Cuándo usarlo** | Scripts, batch jobs, llamadas internas no visibles al usuario | UX conversacional, cualquier lugar donde el usuario ESPERA |

**Decisión para S01.1: `generateText`.** Es nuestro primer "funciona", queremos ver la respuesta completa con sus tokens y latencia. **En S04 vamos a refactorizar a `streamText` cuando agreguemos la UX conversacional.**

## 5. Patrones y antipatrones

### Patrones

- **Importar SDKs de proveedor SOLO en `lib/llm.ts`.** Toda otra parte del código importa `{ llm } from './lib/llm.js'`.
- **Loguear `usage` y `finishReason` en producción.** Te ahorra horas de debugging.
- **Usar `generateText` para tareas internas, `streamText` para UX conversacional.** Decisión por contexto, no por preferencia.
- **Configurar el proveedor por `.env`, no por código.** Cambiar proveedor = cambiar variable de entorno, deploy nuevo.

### Antipatrones

- **Importar `@anthropic-ai/sdk` (o cualquier SDK de proveedor) en cualquier sitio fuera de `lib/llm.ts`.** Acopla la app al proveedor.
- **Ignorar `finishReason`.** Si la respuesta es `length`, está truncada y vos no lo sabes.
- **No loguear tokens.** Tu factura te va a sorprender.
- **Hardcodear el modelo en la llamada.** El modelo se elige en `lib/llm.ts`, no en cada call site.

## 6. Conexión con TiendaPro

**El commit de esta sesión ES el primer commit del proyecto integrador.** Por primera vez, TiendaPro existe como código. Pero todavía es un esqueleto:

- ✅ Tiene la abstracción multi-provider funcionando.
- ✅ Hace una llamada real a un LLM.
- ✅ Reporta tokens y latencia (instrumento básico).
- ❌ NO tiene UI, NO tiene memoria, NO tiene tools, NO tiene RAG.

Es **deliberadamente mínimo**. Cada módulo siguiente agrega una capa. El hito `proyecto-m1` se etiqueta cuando completes S01.2 (comparativa de proveedores).

## 7. Resumen

Tres ideas para llevarte:

1. **Toda llamada a un LLM en este curso pasa por `generateText` (o `streamText`) del Vercel AI SDK con un modelo polimórfico.** El proveedor concreto vive **detrás de la abstracción** y se decide por env.
2. **`src/lib/llm.ts` es la única excepción al "no importar SDKs de proveedor".** Es la frontera entre "lo que cambia" (proveedores) y "lo que no cambia" (la app).
3. **La respuesta del LLM trae mucho más que `text`.** `usage` y `finishReason` son críticos para producción.

## 8. Preguntas de auto-evaluación

1. ¿Por qué la app importa `llm` desde `./lib/llm.js` en vez de importar `anthropic` del SDK directamente? Da DOS razones distintas a las del README.
2. Si tu llamada devuelve `finishReason: "length"`, ¿qué pasó y qué puedes hacer al respecto?
3. ¿Cuándo usarías `generateText` y cuándo `streamText` en TiendaPro? Da un ejemplo de cada uno.
4. Tienes un compañero que copia tu código y agrega una línea `import OpenAI from "openai"` en `src/index.ts`. ¿Por qué es un problema y cómo se lo explicarías sin sonar dogmático?
5. La cuenta de tokens del SDK (`usage.inputTokens`) y la cuenta local con `tiktoken` te dan números distintos para el mismo prompt. ¿Por qué?

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 4 ejercicios para correr el proyecto, leer el código y experimentar (~35 min).

**Próxima sesión:** [`S01.2 — Estructura de la respuesta + comparativa proveedores`](../sesion-01.2-respuesta-comparativa/) → cierra el Módulo 1 con tag `proyecto-m1`.
