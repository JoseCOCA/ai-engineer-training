# Sesión 00.2 — Ejercicios

> **Tiempo estimado:** ~20 min total. Esta vez sí vas a tocar UNA herramienta práctica (un tokenizer online), pero todavía no escribimos código TS — eso empieza en S01.1.

---

## 1. Ejercicio guiado: tokenización en práctica

Abre el [**OpenAI Tokenizer**](https://platform.openai.com/tokenizer) (es público, sin login). Vas a tokenizar 5 strings y completar la tabla.

**Tarea:** copia y pega cada string, anota cuántos tokens tiene, y escribe en una frase qué te llamó la atención.

| String | Tokens | Observación |
|--------|--------|-------------|
| `Hello world` | ? | |
| `Hola mundo, ¿cómo estás?` | ? | |
| `antidisestablishmentarianism` | ? | |
| `🚀 Vamos a construir productos con IA 🤖` | ? | |
| `function getUser(id) { return db.find(id); }` | ? | |

**Pregunta de cierre:** ¿qué string tiene la peor relación palabras-por-token? ¿Por qué crees que pasa?

---

### Resultados aproximados (para contrastar después de hacerlo)

| String | Tokens (aprox.) | Por qué |
|--------|-----------------|---------|
| `Hello world` | 2 | Ambas palabras comunes en inglés, 1 token cada una. |
| `Hola mundo, ¿cómo estás?` | 9-11 | El español tokeniza peor; el `¿` y los acentos suman tokens extra. |
| `antidisestablishmentarianism` | 5-6 | Palabra rara, se parte en sub-palabras BPE. |
| `🚀 Vamos a construir productos con IA 🤖` | 13-15 | Emojis suelen ser 1-2 tokens cada uno; el español suma overhead. |
| `function getUser(id) { return db.find(id); }` | 12-15 | El código tokeniza relativamente bien (sintaxis común), pero los símbolos y espacios también cuentan. |

**Lección:** un párrafo en inglés ≈ 1.3 tokens/palabra. En español ≈ 1.7-2 tokens/palabra. **Tus prompts en español son ~50% más caros por palabra.** Tenelo presente cuando estimes costo.

---

## 2. Ejercicios libres

### 2.1. Predecir el comportamiento de temperature

**Sin probar nada todavía**, escribe tu predicción de qué va a pasar para cada caso:

Dado el prompt: `"Dame 3 nombres para una cafetería temática de ciencia ficción."`

- Con `temperature = 0`, ¿qué pasa si lo corres 5 veces?
- Con `temperature = 0.7`, ¿qué pasa si lo corres 5 veces?
- Con `temperature = 1.5`, ¿qué pasa si lo corres 5 veces?

Una vez que tengas tus predicciones escritas, **anótalas y conservalas**. En S01.2 vamos a hacer este experimento real con la primera llamada al LLM, y vas a poder contrastar.

> **Predicciones esperables:**
> - `temp = 0`: las 5 corridas dan los **mismos 3 nombres** (o muy similares). Determinista.
> - `temp = 0.7`: las 5 corridas dan nombres **distintos pero coherentes** con la temática.
> - `temp = 1.5`: variedad alta, posiblemente con nombres incoherentes, raros, o con mezclas extrañas de palabras.

### 2.2. Razonar sobre context window

Tienes un asistente que usa Claude Sonnet 4.6 (context window: 1M tokens). Tu setup actual:

- System prompt: 5K tokens
- Historial de conversación: 50K tokens (sesión larga, varias horas)
- RAG con catálogo (top-10 productos): 8K tokens
- Mensaje del usuario: 0.5K tokens
- Output esperado: 1K tokens

**Preguntas:**

1. ¿Cuántos tokens te quedan libres antes de chocar con el límite?
2. Si en lugar de Sonnet 4.6 usas Haiku 4.5 (200K context), ¿sigues entrando? ¿Cuánto te queda?
3. Si el costo del modelo principal sube y quieres reducir input, ¿qué dos optimizaciones de las vistas en S00.1 podrías aplicar PRIMERO antes de cambiar de modelo?

> **Soluciones:**
> 1. Total usado = 5 + 50 + 8 + 0.5 + 1 = **64.5K**. Libre = 1M - 64.5K = **~935K tokens**.
> 2. En Haiku: total 64.5K, libre 200K - 64.5K = **~135K**. Sí entras cómodo.
> 3. (a) **Caching del system prompt + RAG estable** → reduce hasta 80% del costo del input fijo. (b) **Resumir el historial cada N mensajes** → de 50K a 5K reduce ~70% del input variable.

### 2.3. Reflexión: temperature por tipo de tarea en TiendaPro

Para cada uno de los siguientes mensajes que llegarían al asistente de TiendaPro, decide qué `temperature` usarías y por qué (1 frase de justificación):

1. *"¿Cuál es el estado de mi pedido #12345?"*
2. *"Recomiéndame un regalo para mi mamá que cumple 60."*
3. *"¿Hacen envíos a Ushuaia?"*
4. *"Escribime un chiste sobre mi compra anterior."*
5. *"Resumime las características técnicas del producto X."*

> **Sugerencia (no canónica):**
> 1. → `0` (consulta a BBDD, respuesta única correcta).
> 2. → `0.7-0.8` (quieres variedad y creatividad en las sugerencias).
> 3. → `0` (información factual sobre logística, sí o no).
> 4. → `0.9-1.0` (humor requiere diversidad).
> 5. → `0.3-0.5` (resumen estructurado pero con voz natural, no robotizado).

---

## 3. Reto: lectura forense de un producto LLM

Elige UN producto LLM que uses regularmente (ChatGPT, Claude.ai, Cursor, Perplexity, Notion AI, etc.) y obsérvalo durante una sesión real (5-10 minutos). Anota:

1. **¿Hay streaming?** ¿Empieza a mostrar texto en <500ms o tienes que esperar la respuesta completa?
2. **Latencia hasta el primer token vs. latencia total.** ¿Sientes diferencia entre "rápido en empezar" y "rápido en terminar"?
3. **Adivina la temperature.** Si pides lo mismo dos veces, ¿te da respuestas idénticas o variadas? ¿Qué te dice eso?
4. **¿Cómo manejan el context cuando se llena?** ¿Te avisan? ¿Hacen resumen automático? ¿Truncan en silencio?
5. **¿Detectaste alguna alucinación?** ¿Cómo te la "vendieron"? ¿Tono confiado o tono cauto?

Haz un mini-informe de 5 puntos (uno por pregunta). El objetivo: entrenar el ojo para leer las decisiones de diseño que hay detrás de un producto LLM.

---

## 4. Aporte al proyecto integrador

TiendaPro sigue sin código (S01.1 arranca eso). Pero ya puedes cerrar 3 decisiones de diseño que vas a aplicar después:

1. **Streaming sí/no:** ¿usamos `streamText` desde el día 1 o `generateText`? *(Pista: respuesta correcta única.)*
2. **Temperature por defecto:** ¿qué temperature seteamos como default del asistente, sabiendo que después la vamos a ajustar por tipo de mensaje?
3. **Tope de output:** ¿qué `max_output_tokens` razonable seteamos para un asistente conversacional de e-commerce?

Anota tus respuestas en el mismo doc local que arrancaste en S00.1. En S01.2 vamos a comparar tus respuestas con lo que terminamos implementando.

---

**Vuelve a:** [`README de la sesión`](README.md) | **Próximo paso:** [`recursos.md`](recursos.md) → bibliografía complementaria opcional.
