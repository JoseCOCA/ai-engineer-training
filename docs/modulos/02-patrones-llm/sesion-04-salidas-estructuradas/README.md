# Sesión 04 — Salidas estructuradas, JSON y guardrails

> **Módulo:** 2 — Patrones de aplicaciones LLM · **Duración estimada:** 2h (~50 min lectura + ~70 min práctica) · **Formato:** 50% teoría / 50% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión vas a poder:

- Explicar **por qué parsear texto libre del modelo es frágil** y qué problemas concretos genera en producción.
- Distinguir las **tres formas de forzar formato estructurado**: prompt-only, JSON mode y schema-constrained generation. Saber cuándo elegir cada una.
- Implementar **`generateObject` con Zod** para tener salidas tipadas y validadas en TypeScript.
- Diseñar **schemas idiomáticos** con enums, refinements, valores opcionales y descripciones que el modelo entiende.
- Implementar **guardrails básicos**: validación de input antes de llamar al LLM, validación de output después, fallbacks cuando algo no cuadra.
- Reconocer cuándo usar **LLM-as-validator** (un LLM que verifica la salida de otro LLM) y entender sus límites.
- Aplicar streaming sobre estructuras (`streamObject`) y entender por qué a veces no compensa.

## 2. Prerequisitos

- **S02** (parámetros de inferencia, finishReason) y **S03** (chat service con instrumentación) completas.
- Familiaridad con [Zod](https://zod.dev) o validador equivalente. Si no usaste Zod antes, los ejercicios introducen lo necesario.

## 3. Conceptos clave

- **Salida estructurada (*structured output*):** el LLM devuelve datos con una forma garantizada (JSON con un schema definido), no texto libre.
- **JSON mode:** modo de los proveedores que fuerza al modelo a generar JSON sintácticamente válido. NO garantiza que el JSON cumpla un schema concreto.
- **Schema-constrained generation:** modo más fuerte donde el modelo es restringido durante la generación a producir solo tokens compatibles con el schema. Hoy: GPT-5, Claude 4.x, Gemini 2.5 lo soportan vía Vercel AI SDK.
- **Guardrails:** capas de seguridad alrededor del LLM. Input guardrails (validar antes de llamar) + output guardrails (validar después).
- **LLM-as-validator:** patrón donde un segundo LLM evalúa si la salida del primero cumple criterios cualitativos (tono, completitud, seguridad).
- **Prompt injection:** input de usuario diseñado para que el modelo ignore instrucciones del sistema. Es el ataque más común a apps LLM.

## 4. Teoría

### 4.1. Por qué parsear texto libre es frágil

Hasta ahora `chat()` devuelve `text: string`. Para mostrar al usuario, perfecto. Para **decidir lógica de negocio**, no.

Imagina que tu asistente de TiendaPro tiene que clasificar el mensaje del usuario en `pregunta`, `reclamo` o `derivar` y enrutar a un flow distinto:

```typescript
const text = await chat({ ... });
const intent = text.toLowerCase().trim();
if (intent === "pregunta") doQuestion();
else if (intent === "reclamo") doComplaint();
else if (intent === "derivar") escalate();
else // ???
```

Tres semanas en producción y tu log se llena de:

- `"La intención es: pregunta"` (el modelo agregó preámbulo).
- `"\"pregunta\""` (el modelo agregó comillas).
- `"Pregunta."` (mayúscula y punto final).
- `"pregunta o reclamo, no estoy seguro"` (el modelo dudó).
- `"Question"` (el modelo a veces responde en inglés).
- `"derivacion"` (sin tilde, sin la categoría exacta).

Cada caso rompe la lógica. La solución no es un parser más complejo — es **forzar el formato desde la generación**.

### 4.2. Tres formas de forzar formato

#### A. Prompt-only — la opción más débil

```typescript
const result = await chat({
  system: 'Devuelve SOLO una de estas palabras: pregunta, reclamo, derivar. Sin explicación, sin comillas, sin más texto.',
  messages: [{ role: 'user', content: userMessage }],
});
```

**Garantías:** muy bajas. El modelo cumple ~80-90% de las veces dependiendo del modelo y la temperature, pero un 10% de fallos en producción es inaceptable.

**Cuándo usarlo:** prototipos rápidos. Idealmente nunca en producción.

#### B. JSON mode — formato sintáctico garantizado

Casi todos los proveedores cloud soportan un "modo JSON" donde la salida es **garantizadamente JSON válido sintácticamente**.

```typescript
const result = await chat({
  system: 'Devuelve un JSON {"intent": "pregunta"|"reclamo"|"derivar"}.',
  messages: [{ role: 'user', content: userMessage }],
  // En Vercel AI SDK: response_format: { type: "json_object" } via providerOptions
});
const parsed = JSON.parse(result.text); // garantizado válido
```

**Garantías:** sintaxis JSON válida. **NO** garantiza schema correcto.

**Lo que puede fallar:**
- `{"intent": "Pregunta"}` (mayúscula no permitida por tu enum).
- `{"category": "pregunta"}` (cambió el nombre del campo).
- `{"intent": "pregunta", "explanation": "..."}` (agregó campos extra).

#### C. Schema-constrained — la opción correcta

El modelo se restringe durante la generación a producir solo tokens compatibles con un schema (tipos, enums, requeridos). Vercel AI SDK lo expone con `generateObject` + `streamObject`.

```typescript
import { generateObject } from "ai";
import { z } from "zod";

const intentSchema = z.object({
  intent: z.enum(["pregunta", "reclamo", "derivar"]),
  confidence: z.number().min(0).max(1),
});

const { object } = await generateObject({
  model,
  system: "Clasifica el mensaje del usuario.",
  prompt: userMessage,
  schema: intentSchema,
});

// object es { intent, confidence } TIPADO y VALIDADO
```

**Garantías:** la salida cumple el schema. Si el modelo no puede cumplirlo, tira un error explícito en lugar de devolver basura.

**Cuándo usarlo:** **siempre que tu app vaya a tomar decisiones programáticas** sobre la salida del LLM.

#### Tabla resumen

| Forma | Garantías | Latencia | Cuándo |
|-------|-----------|----------|--------|
| Prompt-only | Bajas (~80-90% match) | Igual | Nunca en producción |
| JSON mode | JSON sintácticamente válido | Igual o un poco más | Cuando el SDK no soporta schema |
| Schema-constrained | Cumple schema, tipado | Marginalmente más lenta | **Default para lógica programática** |

### 4.3. Vercel AI SDK + Zod — el setup canónico

Zod es el validador de schema más usado en TS. Vercel AI SDK acepta schemas Zod directo en `generateObject`.

#### Patrón base

```typescript
import { generateObject } from "ai";
import { z } from "zod";

const productRecommendation = z.object({
  productId: z.string(),
  reason: z.string().describe("Razón corta por la que se recomienda este producto"),
  confidence: z.number().min(0).max(1),
});

const { object } = await generateObject({
  model: llm,
  system: "Eres un experto en recomendar productos del catálogo de TiendaPro.",
  prompt: `Cliente quiere: ${userQuery}\nCatálogo: ${catalogJson}`,
  schema: productRecommendation,
  temperature: 0.3, // bajo: queremos consistencia
});
```

#### `.describe()` — cómo el modelo lee tu schema

Zod permite agregar descripciones a los campos:

```typescript
z.object({
  intent: z.enum(["pregunta", "reclamo", "derivar"])
    .describe("La intención principal del mensaje del usuario"),
  urgent: z.boolean().describe("True si el cliente expresa frustración o pide respuesta inmediata"),
});
```

Estas descripciones **viajan al prompt** automáticamente. El modelo las lee y las usa para razonar sobre los valores.

> **Patrón:** trata las descripciones de schema como **mini-prompts**. Un campo bien descrito necesita menos prompt sistema.

#### Schemas comunes

```typescript
// Enum con valores cerrados
const status = z.enum(["pending", "shipped", "delivered", "cancelled"]);

// Opcional
const phone = z.string().optional();

// Refinement (validación custom)
const orderId = z.string().refine(
  (s) => /^TP-\d{6}$/.test(s),
  { message: "ID inválido" },
);

// Array tipado
const items = z.array(z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
}));

// Discriminated union
const event = z.discriminatedUnion("type", [
  z.object({ type: z.literal("question"), text: z.string() }),
  z.object({ type: z.literal("complaint"), text: z.string(), severity: z.enum(["low", "high"]) }),
]);
```

> **Antipatrón a evitar:** schemas con `z.any()` o `z.unknown()`. Si pones eso, perdés todas las garantías. Si no sabes la forma exacta, primero entiende el dominio — no le pases la duda al modelo.

### 4.4. Guardrails — capas de seguridad

Un guardrail es una validación que ejecutas **antes o después** de llamar al LLM, fuera del LLM mismo. Tres categorías:

#### A. Input guardrails (antes de la llamada)

Validar el mensaje del usuario para descartar lo malicioso o inválido.

```typescript
function validateUserInput(input: string): void {
  if (input.length > 4000) throw new Error("Mensaje demasiado largo");
  if (input.length < 1) throw new Error("Mensaje vacío");

  const blockedPatterns = [
    /ignore previous instructions/i,
    /you are now/i,
    /system prompt/i,
  ];
  for (const re of blockedPatterns) {
    if (re.test(input)) throw new Error("Patrón sospechoso detectado");
  }
}
```

**Lo que un input guardrail NO puede:**

- Detener prompt injection sofisticada. Los patrones explícitos solo capturan ataques de manual. Un atacante con dos minutos de creatividad pasa el filtro.
- Reemplazar la separación `system` vs `user` en el prompt. La defensa real está en el diseño del system prompt, no en el filtro.

> **Realidad:** los input guardrails reducen el ruido obvio. La protección de fondo viene de:
> 1. Diseñar el system prompt asumiendo input hostil.
> 2. Restringir lo que el modelo puede hacer (structured outputs limitan los outputs posibles).
> 3. Output guardrails que validan que la respuesta sigue siendo del dominio esperado.

#### B. Output guardrails (después de la llamada)

Validar que la respuesta del modelo cumple criterios antes de mostrarla al usuario o usarla para lógica.

```typescript
function validateAssistantOutput(text: string): void {
  if (text.length > 2000) throw new Error("Respuesta excesivamente larga");

  const competitorMentions = ["amazon", "mercadolibre", "shopify"];
  for (const word of competitorMentions) {
    if (text.toLowerCase().includes(word)) {
      throw new Error(`Mención de competidor detectada: ${word}`);
    }
  }

  // Schema validation cuando aplica
  try {
    intentSchema.parse(JSON.parse(text));
  } catch {
    throw new Error("Salida no cumple schema");
  }
}
```

**Patrón crítico:** cuando un output guardrail falla, **no muestres la respuesta cruda al usuario**. O bien:

1. **Reintenta con el modelo** — a veces falla puntualmente y al segundo intento funciona.
2. **Devuelve respuesta de fallback** preconfigurada ("No puedo responder eso. ¿Quieres que te derive a un humano?").
3. **Escala** a un humano si es crítico.

#### C. Content moderation

Servicios externos que clasifican texto en categorías (toxicidad, sexual, violencia, etc.). Útiles para apps abiertas al público.

- **OpenAI Moderation API** (gratis, no requiere cuenta paga).
- **Azure Content Safety**.
- **Llama Guard** (open-source, self-hosted).

Para TiendaPro en M2 esto está fuera de alcance. Lo mencionamos en M6 cuando se hablan operaciones reales.

### 4.5. Streaming structured outputs

Vercel AI SDK ofrece `streamObject` — recibe el objeto **mientras se genera**.

```typescript
const { partialObjectStream } = streamObject({
  model,
  schema: intentSchema,
  prompt: userMessage,
});

for await (const partial of partialObjectStream) {
  // partial puede ser { intent: "pre" } durante la generación
  // hasta convertirse en { intent: "pregunta", confidence: 0.9 } al final
  ui.update(partial);
}
```

**Cuándo NO compensa:**

- **Lógica programática.** Si vas a usar el objeto para decidir routing o ejecutar algo, esperá al objeto completo. Trabajar con un objeto parcial es código frágil y casos borde feos.
- **Schemas pequeños.** Si el objeto tiene 3-4 campos, la mejora UX es marginal — las latencias son similares al objeto entero.

**Cuándo sí compensa:**

- **UX donde mostrás progresivo al usuario** (formularios autocompletados, descripciones largas).
- **Schemas grandes** (un análisis con 20+ campos donde cada uno aporta valor visualmente).

### 4.6. LLM-as-validator (intro)

Es el patrón "un LLM revisa la salida de otro LLM". Útil cuando los criterios de calidad son **cualitativos** y no expresables como schema.

Ejemplo:

```typescript
const draftAnswer = await chat({ system: "...", messages: [...] });

const review = await generateObject({
  model: secondLLM,
  schema: z.object({
    isAcceptable: z.boolean(),
    issues: z.array(z.string()),
  }),
  prompt: `Evalúa esta respuesta a un cliente. ¿Es:
  - amable y profesional?
  - sin mención de competidores?
  - clara sobre los próximos pasos?

  Respuesta a evaluar: "${draftAnswer.text}"`,
});

if (!review.isAcceptable) {
  // Reintento o fallback
}
```

**Costos a tener en cuenta:**

- **Doblas la latencia:** el draft + la revisión.
- **Doblas el costo:** dos llamadas en lugar de una.
- **No es perfecto:** el validador también puede equivocarse.

**Cuándo justifica:**

- Tareas críticas donde un error es muy caro (legal, médico, contratos).
- Etapa de evaluación offline (NO en cada respuesta a usuario, sino sobre un eval set).
- Output filter para casos donde el costo extra de un 10% lo permite.

> Profundizamos en LLM-as-judge en **M4 — RAG** cuando hablamos de evaluación con RAGAS y Promptfoo.

## 5. Patrones y antipatrones

### Patrones

- **Schema-constrained outputs para todo lo que va a lógica programática.** Es el default profesional.
- **Descripciones en los campos del schema.** Convertí cada `.describe()` en una mini-instrucción para el modelo.
- **Validación pre y post llamada.** Input guardrails para descartar ruido obvio; output guardrails para asegurar que lo que sale es del dominio esperado.
- **Fallback predefinido cuando el guardrail falla.** Nunca mostrar al usuario una respuesta que no validó.
- **`temperature` baja para structured outputs** (0 a 0.3). La determinación es más importante que la creatividad acá.

### Antipatrones

- **Parsear texto libre con regex y switch para decisiones de negocio.** Te va a explotar en producción.
- **`z.any()` / `z.unknown()` en schemas.** Si no sabes la forma, no estás listo para usar structured outputs en ese caso.
- **Guardrails de input como única defensa contra prompt injection.** Son una capa, no la solución.
- **LLM-as-validator en cada respuesta a usuario.** Doblas costo y latencia para una mejora marginal — úsalo offline o solo en casos críticos.
- **Streaming structured outputs cuando el caller necesita el objeto completo.** Trabajar con objetos parciales es frágil.

## 6. Conexión con TiendaPro

Hasta acá `chat()` devuelve texto libre — bien para chat conversacional. Pero TiendaPro va a necesitar **clasificación de intent** para routing, y eso debe ser estructurado.

En esta sesión:

1. **Crear `src/lib/intent.ts`** con `classifyIntent(message): Promise<{intent, confidence, reasoning}>` usando `generateObject` + Zod.
2. **Agregar guardrails** en `src/lib/chat.ts`: validación de input (longitud, patrones obvios) y validación de output (longitud máxima, prohibición de mencionar competidores explícitos).
3. **Migrar el flujo conversacional**: cuando llega un mensaje, primero `classifyIntent` (interno, `generateText` interno), después según el intent disparar el flow apropiado o caer en chat genérico.
4. **Estructurar la respuesta del asistente** cuando es informativa: `{ kind: "answer" | "escalate" | "ask_more", message: string, ... }`.

Esto sienta la base para M4 (RAG) y M5 (agentes con tools): cada paso del flujo devuelve estructura validada.

## 7. Resumen

Tres ideas para llevarte:

1. **Texto libre + lógica de negocio = bug-en-producción asegurado.** Apenas tu app tome decisiones sobre la salida del modelo, esa salida tiene que ser estructurada y tipada. `generateObject` con Zod es el patrón profesional.
2. **Schema descriptivo > prompt sistema masivo.** Las descripciones del schema viajan al modelo y son más fáciles de mantener que un system prompt monolítico. Trata cada `.describe()` como una mini-instrucción.
3. **Guardrails son capas, no soluciones.** Input guardrails atrapan ruido obvio; output guardrails atrapan respuestas fuera del dominio. La defensa real contra prompt injection es el diseño del system prompt + structured outputs que limitan lo que el modelo puede generar.

## 8. Preguntas de auto-evaluación

1. Tienes que clasificar un mensaje en 3 categorías. Dame 3 razones por las que un schema constrained es estrictamente mejor que un prompt-only "responde solo una palabra".
2. ¿Qué tres cosas hace `.describe("...")` en un campo Zod desde la perspectiva del LLM y desde la perspectiva del developer?
3. Tu app tiene un guardrail que bloquea "ignore previous instructions". ¿Cuáles son las dos limitaciones reales de esa estrategia?
4. ¿Cuándo NO conviene usar `streamObject`? Da un caso concreto de TiendaPro donde el objeto entero es necesario antes de seguir.
5. Vas a usar LLM-as-validator para revisar las respuestas del asistente principal. Lista 2 razones por las que NO quieres esto en cada turno y 1 caso donde sí justifica.
6. Tu schema tiene un campo opcional `phone: z.string().optional()` y a veces el modelo lo omite. Si querías que SIEMPRE lo intente y que devuelva `null` si no lo sabe, ¿cómo cambiarías el schema?

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 4 ejercicios + reto + aporte al proyecto integrador.

**Próxima sesión:** [`S05.1 — Inyección de contexto desde archivos, web y BD`](../sesion-05.1-inyeccion-contexto/) → cómo darle al modelo información que no estaba en su entrenamiento, sin caer en los antipatrones de "meto todo el contexto al prompt".
