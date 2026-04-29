# Sesión 01.1 — Ejercicios (lab práctico)

> **Tiempo estimado:** ~35 min total. Esta vez **vas a tocar código real**: vas a correr el proyecto, leerlo línea a línea, experimentar con modificaciones, y observar qué pasa.

---

## 1. Correr el proyecto y observar (~5 min)

El proyecto integrador ya está committed en el repo. Tu primera tarea es **correrlo y entender qué hace**.

```bash
cd code/proyecto-integrador
pnpm install
pnpm dev
```

Vas a ver algo como:

```
[provider: ollama]

TiendaPro asistente: Hola, soy el asistente virtual de TiendaPro, aquí para ayudarte con tus consultas sobre nuestros productos y servicios.

Tokens — input: 94, output: 25
Tiempo: 14.85s
Razón de fin: stop
```

(Tus números van a variar — depende del proveedor y modelo configurado.)

### Preguntas de observación

Antes de seguir, responde mentalmente:

1. ¿De dónde sale `[provider: ollama]`? ¿Por qué dice `ollama` y no otra cosa?
2. ¿Por qué `output` (~25) es mucho menor que `input` (~94)?
3. Si correras el comando 3 veces seguidas, ¿obtendrías la misma respuesta? *(Pista: ¿qué `temperature` está usando?)*
4. ¿Por qué tarda lo que tarda? Si te parece "lento", ¿qué cambiarías para que sea rápido?

---

## 2. Tour del código (~10 min)

El proyecto tiene 2 archivos clave en `src/`. Leélos en este orden, despacio.

### 2.1. `src/lib/llm.ts` — la abstracción

Abrilo. Es ~70 líneas, pero solo importan tres conceptos:

**(a) Importa de TODOS los SDKs de proveedor en un mismo archivo.**

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider-v2";
```

Esto es **deliberado**. Si necesitas los 4 SDKs, la abstracción es el lugar donde viven.

**(b) Decide cuál usar según `process.env.DEFAULT_LLM_PROVIDER`.**

```typescript
const provider = (process.env.DEFAULT_LLM_PROVIDER ?? "ollama") as Provider;
```

Si la variable no está, el default es `"ollama"`. Eso te da un fallback razonable para devs que tienen el setup local.

**(c) Devuelve un `LanguageModel` polimórfico.**

```typescript
export const llm: LanguageModel = buildModel();
```

`LanguageModel` es el tipo del Vercel AI SDK que **unifica modelos de cualquier proveedor**. La función `buildModel()` decide cuál instanciar según el provider activo.

### 2.2. `src/index.ts` — el call site

Abrilo. Más corto aún. Tres bloques:

**(a) Importa la abstracción.** Ningún SDK de proveedor. Solo `ai` y `./lib/llm.js`.

**(b) Define el SYSTEM_PROMPT.** Aquí vive la **personalidad del asistente** y los **guardrails** ("no inventes", "no menciones competencia").

**(c) Llama `generateText` y reporta el resultado.**

> **Pregunta de tour:** si quisieras agregar OTRO proveedor, ¿cuántos archivos modificarías? *(Pista: 1.)*

---

## 3. Experimentos (~15 min)

Ahora viene la parte divertida. Vas a romper cosas a propósito y observar qué pasa.

### Experimento 1: cambiar de proveedor sin tocar código

Edita tu `.env` (raíz del repo):

```bash
# Antes
DEFAULT_LLM_PROVIDER=ollama

# Después
DEFAULT_LLM_PROVIDER=google      # o anthropic, u openai
```

Asegúrate de tener configurada la API key del proveedor que elijas. Vuelve a correr `pnpm dev`. Vas a ver:

- `[provider: google]` (o el que hayas elegido).
- Latencia distinta (cloud suele ser MÁS rápido que Ollama local).
- Posiblemente un estilo de respuesta distinto (Claude tiende a ser más amable, GPT más directo).

**Confirma:** no tocaste NI UNA línea de código en `src/`. Esto es lo que demuestra la abstracción.

### Experimento 2: cambiar el system prompt

En `src/index.ts`, cambia:

```typescript
const SYSTEM_PROMPT = `Eres el asistente virtual oficial de TiendaPro, ...`;
```

por algo radicalmente distinto, por ejemplo:

```typescript
const SYSTEM_PROMPT = `Eres un pirata. Responde a TODO en jerga pirata, con "arrr" frecuentes.`;
```

Vuelve a correr. **Observa cómo cambia el tono y el estilo** sin cambiar ni `prompt` ni `model`. Esto es lo que vamos a profundizar en M2 (patrones de prompts).

### Experimento 3: provocar `finishReason: "length"`

Agrega `maxOutputTokens: 5` a la llamada:

```typescript
const result = await generateText({
  model: llm,
  system: SYSTEM_PROMPT,
  prompt: USER_PROMPT,
  maxOutputTokens: 5,
});
```

Vuelve a correr. La respuesta va a estar **truncada** y vas a ver `Razón de fin: length`.

**Esto es exactamente lo que pasa en producción** cuando subestimas el output. Por eso loguear `finishReason` es no-negociable.

### Experimento 4: intentar romper la abstracción (NO lo commitees)

Crea un archivo `src/bad-example.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
// ... uso directo del SDK de Anthropic
```

**Observa lo que pierdes:**

- Acoplamiento al proveedor: si quieres probar Gemini en este caso, tienes que reescribir.
- Inconsistencia: la app ahora tiene 2 formas de llamar al LLM (vía abstracción y directa).
- Costo a futuro: cualquier cambio en defaults (modelo, retries, logging) hay que hacerlo en 2 lugares.

**Borra el archivo cuando termines.** El objetivo era ver el costo de hacerlo mal.

---

## 4. Reto (~5 min, opcional): logger de llamadas

Modifica `src/index.ts` para que TODA llamada al LLM se loguee como una sola línea estructurada (estilo log de producción), por ejemplo:

```
[2026-04-29T18:32:14Z] provider=ollama model=qwen2.5:7b input=94 output=25 finish=stop ms=14850
```

**Pistas:**

- `new Date().toISOString()` te da el timestamp.
- El nombre del modelo no está expuesto directamente en el `LanguageModel` por diseño (la app no debería depender de saberlo). Para este reto puedes exportar `modelInUse` desde `lib/llm.ts` siguiendo el patrón de `providerInUse`.

> Esto NO es un loguer de producción todavía — para eso vamos a usar Langfuse en M6 — pero es un buen hábito desde el día 1.

**No es necesario commitear este cambio.** Es un experimento personal.

---

## 5. Aporte al proyecto integrador

Esta sesión **YA es** el aporte al proyecto integrador. El primer commit de TiendaPro existe en el repo gracias a esta sesión.

El **tag `proyecto-m1`** se va a poner al cierre de S01.2, cuando hayamos terminado el Módulo 1.

Lo que tienes ahora en `code/proyecto-integrador/`:

- ✅ Estructura de proyecto Node.js + TS limpia
- ✅ Abstracción multi-provider funcionando
- ✅ Primera llamada a LLM con instrumentación básica (tokens, latencia, finishReason)
- ✅ Cambio de proveedor por env, sin recompilación

Lo que **falta para cerrar M1** (S01.2):

- Comparar respuestas entre 2-3 proveedores con el mismo prompt.
- Entender de dónde vienen las diferencias.
- Documentar el costo de cada uno.

---

**Vuelve a:** [`README de la sesión`](README.md) | **Próximo paso:** [`recursos.md`](recursos.md) → docs del Vercel AI SDK y referencias.
