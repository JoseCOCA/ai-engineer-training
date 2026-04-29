# Sesión 00.2 — Cómo funciona un LLM por dentro (lo justo para construir bien)

> **Módulo:** 1 — Fundamentos · **Duración estimada:** 1h (≈40 min lectura + 20 min ejercicios) · **Formato:** 60% teoría / 40% práctica conceptual

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión vas a poder:

- Explicar qué es un token y por qué pensar en tokens (no en palabras) cambia tu forma de medir prompts y costos.
- Describir, sin matemáticas, qué hace un Transformer y por qué fue una revolución frente a las arquitecturas anteriores.
- Explicar por qué la generación de un LLM es **autoregresiva y secuencial**, y qué consecuencias tiene eso para latencia, costo y diseño de UX (streaming).
- Decidir qué valor de **temperature, top-p y top-k** usar según la naturaleza de la tarea (determinista vs. creativa).
- Razonar sobre el **context window**: qué es, por qué tiene límite, y cómo afecta tus decisiones de chunking, RAG y caching.
- Entender por qué los LLMs **alucinan** y cómo eso debe condicionar tu arquitectura (RAG, guardrails, evaluación).
- Identificar las 3 fases del entrenamiento de un LLM (pre-training, SFT, RLHF) y cómo cada una explica el comportamiento del modelo en producción.

## 2. Prerequisitos

- Haber leído [`S00.1 — Panorama IA y rol del AI Engineer`](../sesion-00.1-panorama-ia/) para tener el stack mental.
- Conocer el concepto de "función matemática" como caja negra (entrada → salida). No hace falta saber cálculo.

## 3. Conceptos clave

- **Token:** unidad mínima de procesamiento de un LLM. Un fragmento de texto convertido a un número entero (un ID en el vocabulario del modelo).
- **Embedding:** vector numérico que representa el "significado" de un token aprendido durante el entrenamiento. Tokens semánticamente similares tienen embeddings similares.
- **Transformer:** la arquitectura neuronal que está detrás de todos los LLMs modernos. Su innovación clave es el mecanismo de **atención**, que permite que cada token "mire" a todos los demás en paralelo.
- **Generación autoregresiva:** el modelo genera un token a la vez, usando todos los tokens previos (input + lo que ya generó) como contexto para predecir el siguiente.
- **Temperature:** parámetro que controla cuán "creativa" o "predecible" es la salida. Bajo (0–0.3) → determinista. Alto (0.8–1.0) → más diverso, más impredecible.
- **Context window:** la cantidad máxima de tokens (input + output) que el modelo puede manejar en una sola llamada. Hoy va de 8K a 1M+ según el modelo.
- **Alucinación:** cuando el modelo genera contenido que suena plausible pero es incorrecto. Es una **propiedad del diseño**, no un bug.

## 4. Teoría

### 4.1. Por qué te conviene saber esto (aunque no entrenes modelos)

No necesitás saber cómo funciona el motor de un coche para conducir hasta el supermercado. Pero **sí lo necesitás si querés ganar una carrera, diagnosticar por qué pierde potencia en cuestas, o decidir qué modelo comprar para tu uso específico**.

Lo mismo aplica a los LLMs en producción. Podés construir un MVP sin entender nada de lo que sigue. Pero en el momento que tu producto:

- Empiece a ser caro y necesités optimizarlo,
- Empiece a alucinar y necesités acotarlo,
- Necesite responder en menos de 2 segundos y veas que no llegás,
- Tenga que manejar conversaciones largas sin perder el hilo,

vas a necesitar este capítulo. Lo que sigue es **el modelo mental mínimo** para tomar mejores decisiones. Sin matemáticas, sin código, sin papers.

### 4.2. Tokens: la unidad atómica

Un LLM **no procesa palabras**. Procesa **tokens**.

Un token es un fragmento de texto que el modelo convierte a un número entero (un ID en su vocabulario). El proceso de partir el texto en tokens se llama **tokenización**.

Reglas aproximadas:

- En **inglés**: 1 token ≈ 4 caracteres ≈ 0.75 palabras.
- En **español**: 1 token ≈ 3 caracteres ≈ 0.5–0.6 palabras (el español usa MÁS tokens por palabra porque tiene más combinaciones de letras menos frecuentes en el corpus de entrenamiento).
- Los espacios y signos de puntuación CUENTAN como parte de tokens.
- Las palabras comunes son 1 token. Las raras se parten en varios.

**Ejemplos (tokenizer de GPT-4):**

| Texto | Cómo se tokeniza | Tokens |
|-------|------------------|--------|
| `Hello world` | `Hello`, ` world` | 2 |
| `Hola mundo` | `H`, `ola`, ` mundo` | 3 |
| `antidisestablishmentarianism` | `antid`, `ises`, `tablish`, `mentarian`, `ism` | 5 |
| `🚀 Vamos!` | `🚀`, ` Vamos`, `!` | 3 |
| `function getUser(id) { return db.find(id); }` | (sub-tokens de código) | ~13 |

#### Por qué importa pensar en tokens

1. **Costo.** Te cobran por token, no por palabra ni por carácter. Si tu prompt está en español, vas a usar más tokens que el equivalente en inglés. **Calcular costos en palabras te da estimaciones malas.**
2. **Context window.** El límite del modelo está en tokens. Un libro de 80.000 palabras en español puede ser ~120K-160K tokens — más que el context window de muchos modelos.
3. **Truncamiento.** Si tu prompt + output esperado superan el context window, el modelo va a truncar. A veces sin avisar.
4. **Diseño de prompts.** Cada palabra del system prompt te cuesta. Empezá por lo importante.

> **Herramienta práctica:** [OpenAI Tokenizer](https://platform.openai.com/tokenizer) te permite pegar un texto y ver exactamente cómo se tokeniza. Lo vas a usar en el ejercicio 1 de esta sesión.

#### Byte-pair encoding (BPE) en una frase

La técnica que usan casi todos los LLMs modernos para tokenizar se llama **byte-pair encoding (BPE)**. La intuición: empieza con caracteres individuales y va combinando los pares más frecuentes hasta tener un vocabulario de ~30K-200K tokens. Eso permite manejar cualquier texto (incluso palabras inventadas o emojis) sin que el vocabulario explote.

### 4.3. Embeddings: del texto a vectores

Una vez tokenizado el texto, cada token se convierte en un **vector**: una lista larga de números (típicamente 1.024 a 8.192 dimensiones).

Ese vector es el **embedding**. Y representa el "significado" del token, aprendido durante el entrenamiento.

**Propiedad clave:** tokens con significado parecido tienen embeddings parecidos. *"Rey"* y *"Reina"* están cerca en el espacio vectorial. *"Perro"* y *"Pizza"* están lejos. Esto es lo que hace posible la **búsqueda semántica** (Módulo 3) y RAG (Módulo 4).

```
Espacio de embeddings (simplificado a 2D para visualizar):

         Reina  ●
                                          
   Rey  ●          Mujer ●                 
                                          
                Hombre ●                   
                                Pizza ●    
                                          
                                    Perro ●
```

> **Por ahora** te alcanza con saber: hay un paso de "texto → vector" que sucede ANTES de que el modelo procese nada. Cuando lleguemos a M3, vas a usar este mismo concepto de embeddings para indexar el catálogo de TiendaPro y permitir búsqueda semántica.

### 4.4. El bloque Transformer en una página

El Transformer es la arquitectura neuronal que alimenta a todos los LLMs modernos (GPT, Claude, Gemini, Llama, Qwen, etc.). Antes de Transformers, los modelos procesaban el texto **palabra por palabra, en orden**. Después de Transformers, lo procesan **todo en paralelo**. Esa fue la revolución.

#### Las 3 ideas del Transformer (sin matemáticas)

**1. Self-attention: cada token mira a todos los demás.**

Cuando el modelo procesa la frase *"El gato comió la comida porque tenía hambre"*, necesita decidir a qué se refiere "tenía hambre" — ¿al gato o a la comida? El mecanismo de atención permite que cada token "mire" a todos los demás y calcule cuánto le importa cada uno. En este caso, "tenía hambre" mira a "gato" con mucha atención y a "comida" con poca.

Esto se hace **en paralelo para todos los tokens**, no secuencialmente. Es lo que permite entrenar modelos gigantes en hardware moderno.

**2. Multi-head attention: múltiples "puntos de vista" simultáneos.**

El Transformer no hace UNA sola atención. Hace muchas en paralelo (8, 16, 32 "cabezas"). Cada cabeza puede aprender a capturar un tipo de relación distinto: una cabeza puede aprender concordancias gramaticales, otra referencias pronominales, otra relaciones temporales. **Cada cabeza es un punto de vista sobre el mismo texto.**

**3. Stacking: capas y capas de atención.**

Un Transformer tiene típicamente **decenas a cientos de bloques apilados** (GPT-3 tiene 96 capas; los modelos frontera actuales tienen muchas más). Cada bloque refina la representación del bloque anterior. Las capas bajas capturan patrones locales (sintaxis, palabras adyacentes); las altas capturan abstracciones (intención, sentimiento, estilo).

> **Para profundizar (sin matemáticas):** [3Blue1Brown — *But what is a GPT? Visual intro to transformers*](https://www.youtube.com/watch?v=wjZofJX0v4M). Es la explicación visual más clara que existe. Link en [`recursos.md`](recursos.md).

### 4.5. Generación autoregresiva: token por token

Acá está la parte más importante de toda la sesión. Léela dos veces.

Cuando le pasás un prompt al LLM, **el modelo no genera la respuesta entera de una vez**. Hace lo siguiente:

```
1. Lee TODO tu input (prompt + contexto + historial).
2. Predice cuál es el token MÁS PROBABLE que viene a continuación.
3. Agrega ese token al final del input.
4. Vuelve al paso 2 con el input ya extendido.
5. Repite hasta llegar a un token de "fin" o al límite de output que pediste.
```

Esto se llama **generación autoregresiva**: cada token nuevo depende de TODOS los anteriores (input + lo que ya generó).

#### Las consecuencias prácticas son enormes

**1. Por qué el output cuesta más que el input.**

Procesar el input se hace **en paralelo** (gracias al Transformer). Procesar el output es **secuencial**: hay que correr el modelo una vez por cada token generado. Si tu output son 500 tokens, el modelo hizo 500 pasadas completas. Por eso el output cuesta 3-5× más por token que el input.

**2. Por qué la latencia depende del output, no del input.**

Si pedís una respuesta corta (50 tokens), el modelo responde rápido aunque tu input sea largo. Si pedís una respuesta larga (2000 tokens), va a tardar mucho aunque tu input sea corto. **El modelo no puede "pensar antes" — tiene que generar token por token.**

**3. Por qué existe el streaming.**

Como el modelo genera token por token, **podés mostrarle al usuario cada token a medida que sale**, en lugar de esperar a tener la respuesta completa. Esto reduce drásticamente la **latencia percibida**: el usuario ve algo en 200ms aunque la respuesta completa tarde 5 segundos. Casi todos los productos LLM modernos usan streaming en la UI.

**4. Por qué `max_output_tokens` es un parámetro crítico.**

Si no lo seteás, el modelo puede irse de mano y generar miles de tokens, costándote dinero y haciendo lenta la respuesta. **Siempre seteá un límite razonable** según el caso de uso.

### 4.6. Sampling: temperature, top-p, top-k

En cada paso de la generación, el modelo no devuelve UN token. Devuelve una **distribución de probabilidad** sobre todos los tokens del vocabulario. Algo como:

```
Próximo token después de "El gato comió la":
  ratón:    32%
  comida:   28%
  pelota:   12%
  pasta:     5%
  croqueta:  4%
  ...
```

¿Cómo elige cuál devolver? Eso lo controla el **sampling**, configurable con tres parámetros:

#### Temperature

La temperature **escala las probabilidades** antes de samplear:

- **`temperature = 0`** → siempre elige la opción más probable. Determinista. Misma entrada → misma salida.
- **`temperature = 0.7`** (default frecuente) → balance entre seguir lo más probable y permitir variación.
- **`temperature = 1.0`** → respeta la distribución original del modelo. Diverso, creativo.
- **`temperature > 1`** → "calienta" la distribución, hace que opciones improbables suban. Caótico, raramente útil en producción.

#### Top-p (nucleus sampling)

Antes de samplear, descarta los tokens cuya probabilidad acumulada supere `p`. Por ejemplo:

- **`top_p = 0.1`** → solo considera los tokens que cubren el 10% superior de probabilidad. Muy conservador.
- **`top_p = 0.9`** → considera los tokens que cubren el 90% superior. Solo descarta opciones muy improbables.

#### Top-k

Antes de samplear, conserva solo los **k tokens más probables**.

- **`top_k = 1`** → equivalente a `temperature = 0`.
- **`top_k = 50`** → solo considera los 50 candidatos más probables.

#### Cómo elegir en la práctica

| Tipo de tarea | Temperature recomendada | Por qué |
|---------------|------------------------|---------|
| Clasificación, extracción de datos | **0** | Querés respuestas idénticas para inputs idénticos. Reproducibilidad. |
| Asistente factual (FAQs, soporte) | **0.2 – 0.4** | Algo de variación natural pero respuestas consistentes. |
| Generación general (chatbot, documentación) | **0.5 – 0.7** | Default razonable. Variedad sin perder coherencia. |
| Brainstorming creativo | **0.8 – 1.0** | Querés diversidad y "ideas raras". |
| Escritura artística | **0.9 – 1.2** | Aceptás caos a cambio de originalidad. |

> **Antipatrón muy común:** usar `temperature = 1` para clasificar. El modelo va a darte respuestas distintas para el mismo input y vas a volver loco a tu sistema downstream.

### 4.7. Context window: el espacio donde sucede todo

El **context window** es la cantidad máxima de tokens que el modelo puede manejar en una sola llamada — sumando **input + output**.

| Modelo | Context window |
|--------|----------------|
| GPT-3.5 (legacy) | 16K tokens |
| Claude Haiku 4.5 | 200K |
| GPT-5 | 400K |
| Claude Sonnet 4.6 | 1M (en preview) |
| Gemini 2.5 Pro | 1M (estable) |

**¿Por qué hay un límite?** Porque la atención del Transformer es **cuadrática en la longitud**: si duplicás los tokens, el costo computacional se cuadruplica. Modelos con context window de 1M+ usan optimizaciones (sparse attention, sliding windows) para hacerlo viable.

#### Implicaciones prácticas

1. **Tu prompt + output esperado tienen que caber.** Si pedís 2000 tokens de output con un prompt de 199K tokens en Haiku 4.5 (200K context), te quedás corto.

2. **Más context NO siempre es mejor.** Existe el efecto **"lost in the middle"**: los modelos prestan más atención al **principio y al final** del contexto, y olvidan lo del medio. Si tenés información crítica, ponela al principio o al final del prompt, no enterrada en el medio.

3. **El costo crece con el contexto.** Un prompt de 50K tokens es 50× más caro que uno de 1K. **El context grande es una herramienta cara**, úsala cuando aporta valor real.

4. **El caching cambia la economía del context.** Si el bloque inicial del prompt es estable (system prompt, contexto de RAG fijo), podés activar caching del proveedor y pagar 10-25% del precio normal. Lo cubrimos en S04.

### 4.8. Por qué los LLMs alucinan

Un LLM **no recupera información de una base de datos**. Genera texto **prediciendo el token siguiente más probable**. Cuando el modelo no tiene información sobre algo, **no devuelve "no sé" — devuelve la continuación que estadísticamente sonaría correcta** dado lo que conoce.

Eso es una **alucinación**: contenido plausible pero falso.

#### Por qué es estructural, no un bug

- Durante el entrenamiento, el modelo nunca aprendió a decir "no sé". Aprendió a continuar texto.
- El modelo no tiene un mecanismo interno para saber qué partes de su conocimiento son confiables y cuáles inventadas.
- A más larga la respuesta, más oportunidades de alucinar.

#### Cómo se mitiga (preview de RAG y evaluación)

1. **RAG (Módulo 4):** en lugar de confiar en el conocimiento del modelo, le inyectás información factual en el prompt y le pedís que responda **basándose solo en esa información**. La alucinación baja drásticamente.
2. **Citas obligatorias:** pedirle al modelo que cite la fuente concreta de cada afirmación. Lo cubrimos en S11.2.
3. **Evaluación automática (Módulo 4):** medir tasa de alucinación con eval sets y herramientas como RAGAS.
4. **Guardrails:** validar la salida antes de mostrarla al usuario.

> **La regla de oro:** si tu producto no puede tolerar información falsa, **no podés usar el LLM como fuente de verdad**. Tiene que haber una fuente confiable detrás (BBDD, API, documento), y el LLM solo orquesta y formula la respuesta.

### 4.9. Cómo se entrena un modelo (alto nivel)

Saber esto te ayuda a entender **por qué los modelos se comportan como se comportan**. Hay 3 fases:

**Fase 1 — Pre-training.**
Le mostrás al modelo **trillones de tokens** de texto de internet (Common Crawl, libros, código, Wikipedia). El objetivo único: predecir el próximo token. Esta fase aprende **idioma, hechos del mundo, gramática, código, razonamiento básico**. Toma meses, miles de GPUs, cuesta millones de dólares. Solo lo hacen los grandes (OpenAI, Anthropic, Google, Meta, Mistral, xAI).

**Fase 2 — Supervised Fine-Tuning (SFT).**
Le mostrás al modelo decenas de miles de **pares "instrucción → respuesta ideal"** escritos por humanos. Le enseñás a SEGUIR INSTRUCCIONES (no solo continuar texto). Sin esta fase, GPT-3 escribía continuaciones de tu prompt; con SFT, ChatGPT te responde tu pregunta.

**Fase 3 — RLHF (Reinforcement Learning from Human Feedback).**
Humanos comparan **dos respuestas del modelo** a la misma pregunta y eligen cuál es mejor. Esos rankings entrenan un *reward model*, que después se usa para refinar el modelo principal. Esto es lo que hace que los modelos sean **útiles, seguros y alineados**: rechacen pedidos peligrosos, no inventen tanto, sean amables.

#### Por qué te interesa esto

- **Sesgos:** vienen del pre-training (refleja sesgos de internet) y del RLHF (refleja preferencias de los anotadores). Son inevitables, pero conocidos.
- **Cut-off date:** todo lo que pasó después del corte de entrenamiento NO existe para el modelo. Por eso necesitás RAG si querés información actualizada.
- **Diferencias entre proveedores:** Claude tiende a ser "más amable y cauto" que GPT en parte por diferencias en RLHF y en la *Constitutional AI* de Anthropic. Esto NO es opinión — es una decisión de diseño documentada.
- **Fine-tuning open-source:** podés tomar un modelo open-source (Llama, Mistral) y hacerle SFT con tus propios datos. Los grandes ya hicieron el costoso pre-training; vos refinás encima.

## 5. Patrones y antipatrones

### Patrones

- **Pensar en tokens, no en palabras.** Cada decisión de prompt y de modelo se toma en tokens.
- **`temperature = 0` para tareas deterministas.** Si necesitás reproducibilidad (clasificación, extracción), no negocies este parámetro.
- **Streaming en cualquier UX conversacional.** La generación es secuencial; ocultarlo al usuario es desperdiciar UX gratis.
- **Información crítica al principio o al final del prompt.** Por el efecto "lost in the middle".
- **Asumir que el modelo PUEDE alucinar y diseñar el sistema en consecuencia.** Si necesitás verdad, ponela en el contexto, no en el modelo.

### Antipatrones

- **Estimar costo en palabras.** Subestimás 30-50% en español.
- **`temperature = 1` para clasificación.** Vas a tener resultados distintos al mismo input.
- **No setear `max_output_tokens`.** Te puede salir caro y lento sin querer.
- **Pasar 100K tokens de contexto "por las dudas".** Caro, lento y *lost in the middle*.
- **Asumir que el modelo "sabe" algo.** El modelo predice; no recupera.

## 6. Conexión con TiendaPro

Tres decisiones técnicas que ya podemos anticipar para TiendaPro a la luz de esta sesión:

1. **Streaming desde el primer commit.** El asistente va a ser conversacional. Vamos a usar `streamText` (Vercel AI SDK) en lugar de `generateText` para que el usuario vea respuesta inmediata. Esto se aplica desde M2.

2. **Temperature distinta por tipo de mensaje.**
   - *"¿Cuál es el estado de mi pedido X?"* → `temperature = 0`. Respuesta basada en datos, sin variación.
   - *"Recomendame algo para una cena romántica"* → `temperature = 0.7`. Querés sugerencias variadas y "humanas".
   - El asistente va a tener que **identificar el tipo de mensaje** y elegir parámetros (preview de M5 — agentes con routing).

3. **Catálogo en RAG, no en context window.** Aunque Sonnet 4.6 tenga 1M de context, meter el catálogo entero en cada prompt es:
   - Carísimo (pagás el catálogo entero por mensaje).
   - Lento (el modelo procesa todo el input).
   - Vulnerable a *lost in the middle*.

   La solución: **embeddings del catálogo en pgvector** + búsqueda semántica que recupere los 5-10 productos relevantes al prompt. Esto es M3 y M4.

## 7. Resumen

Tres ideas para llevarte:

1. **El LLM tokeniza, embebe, atiende y predice token por token.** Todo el resto (sampling, context window, alucinaciones, costo asimétrico) se deriva de este pipeline.
2. **La generación es autoregresiva y secuencial.** Eso explica por qué el output cuesta más que el input, por qué la latencia depende del output, y por qué el streaming existe.
3. **Las alucinaciones son un rasgo del diseño, no un bug.** Si tu producto necesita verdad, no la pongas en el modelo: ponela en el contexto vía RAG.

## 8. Preguntas de auto-evaluación

1. ¿Por qué un texto en español usa más tokens que el equivalente en inglés? ¿Qué consecuencia práctica tiene esto para el costo de tu producto?
2. Explica con tus propias palabras por qué el output de un LLM cuesta 3-5× más que el input.
3. Tenés un caso de uso de extracción de datos estructurados (JSON) desde texto libre. ¿Qué `temperature` usás y por qué?
4. ¿Qué es el efecto *"lost in the middle"* y cómo afecta tus decisiones de diseño de prompt?
5. ¿Por qué no podés "arreglar" las alucinaciones desde el prompt? ¿Cuáles son las dos estrategias correctas para mitigarlas?

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 3 ejercicios prácticos (~20 min).

**Próxima sesión:** [`S00.3 — Python para devs JS/TS`](../sesion-00.3-python-para-js-ts/) → onboarding rápido al lenguaje secundario del curso.
