# Sesión 01.2 — Estructura de la respuesta + comparativa de proveedores

> **Módulo:** 1 — Fundamentos · **Duración estimada:** 1h (~25 min lectura + ~35 min lab) · **Formato:** 40% teoría / 60% lab · **Hito:** cierre del Módulo 1 con tag `proyecto-m1`

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión vas a poder:

- Leer y aprovechar la **estructura completa de la respuesta** del LLM (más allí de `text` y `usage`): `finishReason`, `warnings`, `providerMetadata`, `request`, `response`.
- Hacer una **comparativa "fair" entre proveedores** controlando las variables que importan (mismo prompt, mismo system, mismo idioma, mismo timestamp).
- Calcular el **costo real** de una llamada a partir de los tokens reportados, y proyectarlo a volumen mensual.
- Explicar **por qué dos proveedores responden diferente** al mismo prompt: tokenización, RLHF, defaults internos.
- Tomar una **decisión informada** de qué proveedor usar para qué tipo de tarea, basándote en datos en lugar de marketing.
- Cerrar el Módulo 1 con confianza para arrancar el Módulo 2.

## 2. Prerequisitos

- **S01.1** completada (proyecto integrador corriendo, abstracción multi-provider entendida).
- Tener **al menos 2 proveedores configurados** en `.env` para que la comparativa tenga sentido. Lo ideal: Ollama (local), Gemini (cloud free), y opcionalmente Anthropic.

## 3. Conceptos clave

- **Estructura de la respuesta:** el objeto que devuelve `generateText` no es solo el texto. Trae metadata operacional crítica para producción.
- **Tokenización por proveedor:** cada modelo usa su propio tokenizer. Mismo texto → cuentas distintas de tokens. Conclusión: el costo "comparable" entre proveedores requiere normalizar.
- **Comparativa fair:** evaluar dos proveedores sobre el mismo input, mismo system, mismo formato esperado. Cualquier diferencia en una de estas variables invalida la comparación.
- **Costo proyectado:** el costo de UNA llamada ($0.001) parece nada. Multiplicado por 100.000 mensajes/día puede ser $3.000/mes. La economía de los LLMs se vive en volumen, no en llamadas individuales.
- **Throughput (tokens/segundo):** métrica clave de UX que muchas veces importa más que la latencia total.

## 4. Teoría

### 4.1. Anatomía profunda de la respuesta

En S01.1 vimos lo básico: `result.text`, `result.usage`, `result.finishReason`. El objeto que devuelve `generateText` (Vercel AI SDK v5) tiene **mucho más**:

```typescript
const result = await generateText({ model: llm, prompt: "..." });

result.text                      // string con la respuesta
result.usage                     // { inputTokens, outputTokens, totalTokens, ... }
result.finishReason              // razón por la que se detuvo el modelo
result.warnings                  // problemas no fatales detectados por el SDK
result.providerMetadata          // metadata específica del proveedor
result.request                   // request HTTP serializado (debug)
result.response                  // response HTTP cruda (debug)
result.steps                     // útil cuando hay tool calls (M5)
```

#### Los 4 campos que vas a usar en producción

**`usage`** — tokens reales según el proveedor. Es lo que te van a facturar.

```typescript
const { inputTokens, outputTokens } = result.usage;
console.log(`Input: ${inputTokens}, Output: ${outputTokens}`);
```

> **Ojo:** `inputTokens` puede diferir de tu cuenta local con `tiktoken` porque cada proveedor tokeniza distinto. Para presupuestar exacto, **usa el número que devuelve el proveedor**.

**`finishReason`** — por qué se detuvo el modelo. Los valores comunes:

| Valor | Significado | Acción |
|-------|-------------|--------|
| `"stop"` | Terminó normalmente | OK |
| `"length"` | Chocó con `maxOutputTokens` | Respuesta truncada — subir el límite o partir el prompt |
| `"tool-calls"` | Decidió invocar un tool | Manejar el tool call (M5) |
| `"content-filter"` | El proveedor bloqueó la salida | Revisar el prompt, considerar otro proveedor |
| `"error"` | Algo salió mal a nivel proveedor | Revisar `warnings` |

**`warnings`** — el SDK detectó algo raro pero no fatal. Por ejemplo:
- Te pasaste con un parámetro que el proveedor no soporta.
- El modelo no soporta una feature que pediste (ej. JSON schema en un modelo viejo).
- Inconsistencias entre lo que pediste y lo que el proveedor devolvió.

> **Patrón de producción:** loguear `warnings` siempre. Es señal temprana de incompatibilidades.

**`providerMetadata`** — metadata específica del proveedor que el SDK no normaliza. Por ejemplo:
- Anthropic devuelve `cacheReadInputTokens` y `cacheCreationInputTokens` (caching).
- Google devuelve metadata de safety ratings.
- OpenAI devuelve sistema de fingerprint para reproducibilidad.

Este campo es donde vive la información proveedor-específica que no encaja en el modelo común.

### 4.2. Por qué dos proveedores responden distinto al MISMO prompt

Tres razones principales:

**1. Tokenización diferente.**
Cada modelo tiene su propio vocabulario y BPE. Para *"libro impreso"*:
- GPT-4 puede usar 4 tokens.
- Claude puede usar 5 tokens.
- Gemini puede usar 3 tokens.

Esto afecta el **costo** y el **comportamiento** (los modelos son sensibles a cómo se segmenta el texto).

**2. RLHF / alignment distinto.**
Cada proveedor entrena el comportamiento "deseable" según sus criterios:
- **Anthropic** (Claude) — Constitutional AI, optimiza para "útil, honesto, inofensivo". Tiende a ser más cauto, más estructurado, más amable.
- **OpenAI** (GPT) — RLHF clásico con anotadores. Tiende a ser más directo, más asertivo.
- **Google** (Gemini) — RLHF con foco en multimodal y contexto largo. Tiende a ser más verbose, formato Markdown rico.
- **Meta / Mistral / Qwen** (open-source) — varía según el fine-tuning posterior. Suele depender del operador (Ollama-served vs cloud-hosted).

Estas diferencias **NO son aleatorias** — son decisiones de diseño documentadas. Vas a notar el "estilo Claude" vs "estilo GPT" vs "estilo Gemini" muy rápido.

**3. Defaults internos distintos.**
Cada proveedor aplica defaults que no especificas:
- `temperature` por defecto: típicamente entre 0.7 y 1.0, pero varía.
- `top_p` por defecto: idem.
- `max_tokens` por defecto: algunos proveedores tienen un límite implícito (a veces sorprendentemente bajo).
- Reasoning interno: Gemini 2.5+ y o3+ de OpenAI pueden hacer "thinking" antes de generar (consume tokens y latencia).

> **Implicación práctica:** si no seteas explícitamente `temperature` y `maxOutputTokens`, estás dejando que el proveedor decida por vos. **No lo hagas** en producción.

### 4.3. Cómo hacer una comparativa fair

Si quieres comparar dos proveedores en serio (no anecdóticamente), necesitas **controlar las variables** que afectan el resultado:

| Variable | Cómo controlarla |
|----------|------------------|
| Prompt | Idéntico, mismo texto byte por byte |
| System prompt | Idéntico |
| Temperature | Mismo valor explícito (ideal: `0` para reproducibilidad) |
| Max output tokens | Mismo valor explícito |
| Idioma | Mismo idioma para todas las llamadas |
| Hora del día | Mismo momento (carga del proveedor varía por hora) |
| Network | Misma conexión, mismo route si es posible |
| Volumen | Suficiente para ser estadísticamente significativo (no 1 muestra) |

El script `compare.ts` de esta sesión cumple lo esencial: mismo prompt, mismo system, ejecución secuencial y cercana en tiempo. Para una comparativa de **producción** querrías:

- Múltiples corridas (10-100) con la misma config para promediar.
- `temperature = 0` para minimizar varianza.
- Métricas de calidad además de costo/latencia (ver M4 — evaluación con LLM-as-judge y RAGAS).

Para esta sesión, **una corrida sirve para formarte una intuición**. No es benchmark publicable, pero ya rompe muchos mitos.

### 4.4. Cálculo de costo en la práctica

La fórmula es simple:

```
costo_usd = (input_tokens / 1.000.000) × precio_input_por_millón
          + (output_tokens / 1.000.000) × precio_output_por_millón
```

El script `compare.ts` lo hace por vos con un snapshot de precios de abril 2026 hardcodeado. **En producción**, mejor:

1. **Usar la API del proveedor** para obtener costo actualizado (Anthropic, OpenAI, Google tienen endpoints de billing).
2. **Aplicar caching** cuando aplique. Anthropic y Google pueden cobrar input cacheado al 10-25% del precio normal. Lo cubrimos en S04.
3. **Loguear costo por request** a un sistema de observabilidad (Langfuse en M6).

#### Proyección a volumen — el reality check

Una llamada cuesta $0.001. Suena gratis. Multiplica:

- 10.000 mensajes/día × $0.001 = **$10/día = $300/mes**
- 100.000 mensajes/día × $0.001 = **$100/día = $3.000/mes**
- 1.000.000 mensajes/día × $0.001 = **$1.000/día = $30.000/mes**

**Esta es la realidad de operar productos LLM.** El costo unitario es bajo. El costo total puede ser brutal. Por eso elegir el modelo "suficiente" en lugar del "mejor" no es tacañería — es ingeniería.

### 4.5. Cuándo elegir qué proveedor — heurística práctica

No hay un "mejor proveedor". Hay un mejor proveedor **para tu caso concreto**. Heurística que funciona:

| Criterio principal | Elige |
|--------------------|-------|
| **Costo más bajo posible**, calidad básica suficiente | Gemini Flash, GPT-5 nano, Claude Haiku 4.5 |
| **Mejor calidad, costo no es el constraint** | Claude Opus 4, GPT-5, Gemini Ultra |
| **Velocidad máxima** (latencia y throughput) | Groq, Cerebras (servir modelos open-source rápido) |
| **Datos sensibles, no pueden salir del país/red** | Self-hosted con Ollama, o BAA con cloud provider |
| **Multimodal** (imágenes, audio, video) | Gemini, GPT-4o, Claude (en ese orden de capacidad de contexto) |
| **Contexto muy largo** (>200K tokens) | Gemini Pro, Claude Sonnet 4.6 (1M preview) |
| **Function calling robusto** | Claude (mejor adherencia a JSON), GPT (gran ecosistema) |
| **Open-source para fine-tunear** | Llama, Qwen, Mistral (vía Ollama o HuggingFace) |

> **No te quedes con un solo proveedor.** Justo por eso construimos la abstracción en S01.1. Vas a querer Sonnet para tareas complejas, Haiku/Flash para alta volumen, y Ollama para desarrollo. Todo desde el mismo código.

## 5. Patrones y antipatrones

### Patrones

- **Loguear `usage`, `finishReason`, `warnings` y `providerMetadata` en TODA llamada de producción.** En M6 lo automatizamos con Langfuse.
- **Setear `temperature` y `maxOutputTokens` explícitamente.** Nunca confíes en defaults del proveedor.
- **Comparar proveedores con prompts realistas de tu producto**, no con benchmarks genéricos.
- **Calcular costo proyectado a volumen** antes de decidir un proveedor para producción.

### Antipatrones

- **"Anthropic es mejor que OpenAI"** — afirmación sin contexto. Mejor para qué tarea, qué prompt, qué idioma, qué presupuesto.
- **Comparar precios sin considerar tokenización.** Un proveedor "más barato por token" puede ser más caro porque tokeniza peor.
- **Decidir proveedor por una sola corrida.** La varianza es alta — necesitas múltiples muestras o `temperature = 0`.
- **No medir `tokens/segundo`.** A veces la métrica que importa para UX es throughput, no latencia total.

## 6. Conexión con TiendaPro

Esta sesión cierra el Módulo 1. **El proyecto integrador queda con:**

- Estructura de proyecto Node.js + TS funcional.
- Abstracción multi-provider operativa (la pieza arquitectural más importante del curso).
- Primera llamada con instrumentación básica (tokens, latencia, finishReason).
- **Decisión informada del proveedor por defecto** para el MVP de TiendaPro, basada en lo que viste en la comparativa.

A partir de **M2 (Patrones de aplicaciones LLM)** vamos a:

- Agregarle estructura conversacional (memoria, historial).
- Construir prompts más sofisticados (sistema, roles, ejemplos, salidas estructuradas).
- Introducir guardrails serios.
- Empezar a usar `streamText` para UX conversacional.

El **tag `proyecto-m1`** marca este punto como referencia para volver, comparar progreso, o reiniciar desde aquí si te pierdes más adelante.

## 7. Resumen

Tres ideas para llevarte:

1. **La respuesta del LLM es un objeto rico, no un string.** `usage`, `finishReason`, `warnings` y `providerMetadata` son tu instrumental de vuelo en producción.
2. **Los proveedores difieren por diseño** (tokenización, RLHF, defaults). No son intercambiables a ciegas — la abstracción te permite el switch, pero tienes que **medir** antes de decidir.
3. **El costo se vive en volumen, no en llamadas individuales.** $0.001 × 100.000/día = $3.000/mes. La economía del LLM es la primera dimensión de diseño, no la última.

## 8. Preguntas de auto-evaluación

1. Acabas de recibir `result.warnings: [{ message: "Provider does not support 'topK' for this model" }]`. ¿Qué pasó y qué haces?
2. Tu app reporta `result.finishReason: "length"` el 30% de las llamadas. ¿Cuáles son las 3 acciones más razonables a investigar, en orden?
3. La cuenta de tokens del provider y la de tu `tiktoken` local difieren. ¿Cuál usas para presupuestar? ¿Por qué?
4. Tienes que elegir entre Gemini Flash y Claude Haiku para un asistente de FAQs de TiendaPro con ~50K consultas/día. ¿Qué información NECESITAS antes de decidir? Lista 4 cosas.
5. ¿Por qué la comparativa de `compare.ts` (1 corrida) NO sería válida como benchmark para una decisión de producción? ¿Qué le agregarías para que lo sea?

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 4 ejercicios prácticos con el script de comparación (~35 min).

**Próximo módulo:** **Módulo 2 — Patrones de aplicaciones LLM** (S02 en adelante). Empieza la construcción real de TiendaPro con prompts estructurados, contexto, memoria y streaming.
