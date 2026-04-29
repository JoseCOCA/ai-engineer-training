# Sesión 02 — Ejercicios

> **Tiempo estimado:** ~70 min total. Cuatro ejercicios prácticos con scripts ejecutables. Todos los scripts viven en [`code/m02-patrones-llm/sesion-02/`](../../../../code/m02-patrones-llm/sesion-02/).

---

## Setup

Desde la raíz del repo:

```bash
cd code/m02-patrones-llm/sesion-02
pnpm install
```

Asegúrate de tener `.env` configurado en la raíz del repo (ya lo hiciste en S01.1) con al menos un proveedor activo. Para varios ejercicios conviene tener **Ollama + Gemini** ambos configurados.

---

## 1. Ejercicio guiado: el efecto de `temperature`

**Objetivo:** ver con tus propios ojos la diferencia entre `temperature = 0`, `0.7` y `1.2` sobre el mismo prompt.

### 1.1. Correr el script

```bash
pnpm run temperature
```

El script ejecuta la misma llamada **3 veces** con cada valor de temperature y te muestra las salidas lado a lado.

### 1.2. Qué observar

- Con `temperature = 0`, las 3 corridas deberían ser **idénticas o casi idénticas**.
- Con `temperature = 0.7`, ves **variaciones naturales** entre corridas: distinto orden de ideas, palabras diferentes, mismo significado.
- Con `temperature = 1.2`, puedes ver el modelo **derrapar** — frases que pierden coherencia, repeticiones, formato roto.

### 1.3. Pregunta para ti

Sin mirar el código, ¿qué `temperature` usarías para?:

- Clasificar mensajes entrantes en `pregunta | reclamo | derivar` → ?
- Generar el mensaje de bienvenida del asistente → ?
- Sugerir 5 productos relacionados de un catálogo → ?

> **Razonamiento sugerido:** clasificación → `0` (quieres determinismo). Bienvenida → `0.3-0.5` (algo de naturalidad sin que el resultado varíe entre cada usuario). Sugerencias → `0.7` (creatividad útil sin perder relevancia).

---

## 2. Ejercicio: tokenización en español vs inglés

**Objetivo:** medir empíricamente cuánto más cuesta tokenizar español que inglés con el tokenizer de OpenAI.

### 2.1. Correr el script

```bash
pnpm run tokenize
```

El script tokeniza varios pares de textos equivalentes (ES/EN) y compara la cantidad de tokens.

### 2.2. Salida esperada (snippet)

```
"Hello world"          →  2 tokens
"Hola mundo"           →  3 tokens

"How can I help you?"  →  6 tokens
"¿En qué puedo ayudarte?" → 9 tokens

Promedio español: 1.4× más tokens que inglés equivalente
```

### 2.3. Pregunta para ti

Si tu producto opera principalmente en español y procesas **10K mensajes/día**, ¿cuál es el sobrecosto mensual frente a operar en inglés?

Asume:
- Promedio: 1.000 tokens input + 200 tokens output por mensaje (en inglés).
- Mismo contenido en español: factor 1.4 sobre tokens (input y output).
- Modelo: Gemini Flash (~$0.20/1M input, $1/1M output).

> **Cálculo:**
>
> Inglés mensual: `(10K × 30 × 1K input × $0.20/1M) + (10K × 30 × 200 output × $1/1M) = $60 + $60 = $120/mes`
>
> Español mensual: `$120 × 1.4 = $168/mes`
>
> **Sobrecosto:** $48/mes (~40%) solo por tokenización.
>
> **Lección:** modelos con tokenizers más eficientes para español (Mistral, Llama 3.x) pueden cambiar el cálculo. Vale la pena medir antes de decidir un modelo para un producto LATAM.

---

## 3. Ejercicio: `generateText` vs `streamText`

**Objetivo:** sentir la diferencia de UX entre llamada bloqueante y streaming.

### 3.1. Correr el script

```bash
pnpm run streaming
```

El script ejecuta el mismo prompt dos veces:

1. Con `generateText` — verás un spinner durante varios segundos, después la respuesta aparece de golpe.
2. Con `streamText` — verás la respuesta aparecer **token a token** desde casi instantáneamente.

### 3.2. Métricas visibles

El script imprime:

```
=== generateText ===
Total time: 4.32s
Time to first token: 4.32s

=== streamText ===
Total time: 4.18s
Time to first token: 0.31s
```

**Observa la diferencia entre `Total time` y `Time to first token`.** El total es similar — el modelo genera lo mismo. Lo que cambia es **cuándo el usuario empieza a ver algo**.

### 3.3. Pregunta para ti

¿En qué interacciones de TiendaPro **no** usarías streaming? Piensa en al menos 2 casos.

> **Razonamiento sugerido:**
>
> 1. **Clasificación de intent interna.** El usuario no espera ese paso — es un intermediario entre la pregunta y la respuesta. Streamear ahí no agrega valor.
> 2. **Generación con structured output (JSON con schema).** Necesitas validar el JSON entero antes de procesarlo. Streamear y parsear parcial es complejo y tiene casos borde feos.
> 3. **Resumen de pedido en email transaccional.** Es batch — no hay usuario esperando. Streamear no aporta nada.

---

## 4. Ejercicio: `maxOutputTokens` y `finishReason`

**Objetivo:** experimentar el corte por límite de output.

### 4.1. Correr el script

```bash
pnpm run max-tokens
```

El script pide al modelo "Explica qué es un Transformer en 200 palabras" pero le pone `maxOutputTokens: 30`.

### 4.2. Qué vas a ver

```
Respuesta (truncada): Un Transformer es una arquitectura de red neuronal introducida en 2017 que revolucionó el procesamiento de lenguaje natural mediante el mecanismo de atención que permite procesar...
finishReason: length
```

La respuesta está cortada a mitad de oración. `finishReason: "length"` te dice que el modelo no terminó de hablar — chocó con el techo.

### 4.3. Tarea

1. Modifica el script para que `maxOutputTokens` sea **300** y observa que la respuesta termina sola con `finishReason: "stop"`.
2. Vuélvelo a poner en **30** y observa que el corte vuelve.

### 4.4. Pregunta para ti

En producción, **¿qué haces cuando una respuesta llega con `finishReason: "length"`?** Lista 3 acciones razonables, en orden.

> **Razonamiento sugerido:**
>
> 1. **Loguear el evento** con prompt + tokens reales. Es señal de que tu límite o tu prompt están mal calibrados.
> 2. **Subir `maxOutputTokens`** si el caso de uso justifica respuestas más largas. Súbelo con criterio — no a 4K "por las dudas".
> 3. **Acortar el prompt** si el output truncado se debe a que el input es excesivamente largo. Revisa si estás pasando contexto que no aporta.
> 4. **Pedir continuación** (avanzado): hacer una llamada follow-up "continúa donde te cortaste". Costoso y frágil — úsalo solo si las opciones 1-3 no aplican.

---

## 5. Reto: stop sequences para forzar formato

**Objetivo:** usar `stopSequences` para parsear formato custom.

### 5.1. Setup

Quieres que el modelo te dé hasta 5 sugerencias de productos relacionados, una por línea, en formato:

```
1. Producto A
2. Producto B
3. Producto C
END
```

Quieres que el modelo se detenga **antes** de seguir charlando.

### 5.2. Tu tarea

Edita `code/m02-patrones-llm/sesion-02/stop-sequences.ts` (template provisto):

1. Diseña un prompt que pida exactamente ese formato.
2. Configura `stopSequences: ["END"]` para que se detenga limpiamente.
3. Parsea la salida para devolver un array `string[]`.
4. Testéalo con 3 productos distintos como input.

### 5.3. Valida

```bash
pnpm run stop-sequences
```

Salida esperada:

```
[
  "1. Mochila ergonómica de senderismo",
  "2. Botella térmica 1L",
  "3. Linterna recargable USB",
  "4. Crema solar SPF 50",
  "5. Calcetines de trekking"
]
finishReason: stop
```

### 5.4. Pregunta para ti

¿Por qué stop sequences es **frágil** como técnica de parsing? Piensa en al menos 2 problemas.

> **Razonamiento sugerido:**
>
> 1. **El modelo puede no respetar el formato.** Si pides `END` al final pero el modelo decide que no es necesario, te quedás esperando. Stop sequences asume que el modelo sí lo va a generar.
> 2. **El delimitador puede aparecer dentro del contenido.** Si pides stop en `"User:"` pero un producto se llama "Auriculares Bluetooth User: Edition", se corta donde no quieres.
> 3. **Dos modelos del mismo proveedor pueden interpretar el formato distinto.** Lo que funciona con Sonnet 4.6 puede romper con Sonnet 4.7.
>
> **Por eso vamos a S04: salidas estructuradas con schema.** Stop sequences es un parche; structured outputs es la solución correcta cuando necesitas formato confiable.

---

## 6. Aporte al proyecto integrador

Hito de esta sesión sobre TiendaPro: **mecánica básica explícita en la única llamada que tenemos**.

### 6.1. Tarea

Edita `code/proyecto-integrador/src/index.ts` y aplica los cambios:

1. **Setear parámetros explícitos:**

   ```typescript
   const result = await generateText({
     model: llm,
     system: SYSTEM_PROMPT,
     prompt: USER_PROMPT,
     temperature: 0.5,         // ← natural pero no aleatorio
     maxOutputTokens: 200,     // ← respuesta concisa
   });
   ```

2. **Agregar logging de reasoning tokens** cuando el proveedor los expone:

   ```typescript
   if (result.usage.reasoningTokens) {
     console.log(`Reasoning tokens: ${result.usage.reasoningTokens}`);
   }
   ```

3. **Migrar a `streamText`** para que el saludo aparezca por streaming. La nueva versión usa `for await` sobre `result.textStream`.

### 6.2. Salida esperada

```
[provider: ollama]

TiendaPro asistente: ¡Hola! Soy el asistente virtual de TiendaPro, listo para ayudarte con cualquier consulta sobre productos o pedidos.

Tokens — input: 67, output: 24
Tiempo: 1.42s
Razón de fin: stop
```

(Streaming hace que las palabras aparezcan progresivamente.)

### 6.3. Valida

```bash
cd code/proyecto-integrador
pnpm dev
```

> **Importante:** este cambio NO genera commit propio aún. Lo agrupamos con los aportes de S03 y S04 en un solo commit `proyecto-m2-parcial-1` al cerrar S04. Mientras tanto trabajalo en local sin commitear.

---

**Vuelve a:** [`README de la sesión`](README.md) | **Próximo paso:** [`recursos.md`](recursos.md) → material complementario.
