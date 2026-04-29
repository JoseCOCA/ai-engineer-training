# Sesión 04 — Ejercicios

> **Tiempo estimado:** ~70 min total. Aplicas `generateObject` con Zod a clasificación de intent, refinements de validación, guardrails y LLM-as-validator. Scripts en [`code/m02-patrones-llm/sesion-04/`](../../../../code/m02-patrones-llm/sesion-04/).

---

## Setup

```bash
cd code/m02-patrones-llm/sesion-04
pnpm install
```

`.env` con un proveedor cloud configurado. **`generateObject` con schema-constrained funciona mejor en cloud que en Ollama** — algunos modelos open-source pequeños (3B-8B) no son confiables con schemas complejos. Recomendado: Gemini Flash o Claude Haiku.

---

## 1. Ejercicio guiado: clasificador de intent

**Objetivo:** primer `generateObject` con un schema simple y observar las garantías.

### 1.1. Tu tarea

Crea `src/intent.ts` con:

```typescript
import { z } from "zod";

export const intentSchema = z.object({
  intent: z.enum(["pregunta", "reclamo", "derivar"])
    .describe("La intención principal del mensaje"),
  confidence: z.number().min(0).max(1)
    .describe("Confianza entre 0 y 1"),
  reasoning: z.string().max(200)
    .describe("Razonamiento corto en máx 1 frase"),
});

export type Intent = z.infer<typeof intentSchema>;
```

Después implementa `classifyIntent(message): Promise<Intent>` con `generateObject`.

### 1.2. Probarlo

```bash
pnpm run intent
```

El script clasifica 5 mensajes representativos:

```
"¿cuánto cuesta el envío a Madrid?"   → pregunta (0.95)
"no me llegó el pedido y estoy harto" → reclamo  (0.92)
"quiero hablar con un humano AHORA"   → derivar  (0.98)
"ayer entregaron el producto, gracias"→ pregunta (0.42)  ← bajo confidence
"hablemos de fútbol"                  → derivar  (0.75)
```

### 1.3. Pregunta para ti

Tu app usa `confidence` para decidir si confiar en la clasificación o pedir aclaración. ¿Qué umbral pondrías como `MIN_CONFIDENCE` y por qué? ¿Qué pasa si lo bajas a `0.3` o lo subes a `0.95`?

> **Razonamiento sugerido:** un umbral de **0.7** suele ser razonable para clasificación. Por debajo, pides aclaración o derivas. Si bajas a `0.3`, dejas pasar mensajes ambiguos como categoría firme (errores frecuentes en producción). Si subes a `0.95`, pides aclaración demasiado seguido — UX irritante. La métrica sale del eval set: ¿qué umbral maximiza precisión sin matar UX?

---

## 2. Ejercicio: schema con refinements

**Objetivo:** validar formato custom dentro del schema.

### 2.1. Tu tarea

Tu asistente debe extraer datos de pedido cuando el cliente menciona uno. Implementa `extractOrder(message)`:

```typescript
const orderSchema = z.object({
  orderId: z.string()
    .describe("ID de pedido, formato TP-NNNNNN")
    .refine((s) => /^TP-\d{6}$/.test(s), "Formato de ID inválido"),
  customerEmail: z.string().email().optional()
    .describe("Email del cliente si lo mencionó, omitir si no"),
  reportedIssue: z.enum(["no_received", "damaged", "wrong_item", "other"])
    .describe("Tipo de problema reportado"),
});
```

### 2.2. Probarlo

`src/order-demo.ts` corre 4 mensajes:

```bash
pnpm run order
```

Mensajes de prueba:
- *"Mi pedido TP-451200 nunca llegó. Mi email es ana@example.com"* → válido
- *"Me llegó el pedido TP-99 roto"* → ID inválido → ZodError
- *"No me llegó nada"* → falta orderId → genera error explícito
- *"Pedido TP-100200 con producto equivocado"* → válido (sin email)

### 2.3. Qué observar

Cuando el modelo no puede cumplir el schema, `generateObject` tira un error explícito en lugar de devolver basura. Es **exactamente** lo que querías.

### 2.4. Pregunta para ti

Tu schema tiene `orderId.refine(...)` con `/^TP-\d{6}$/`. Si el cliente escribe "tp-451200" (minúsculas), el modelo puede normalizarlo o no. ¿Cómo te aseguras de que SIEMPRE se devuelva en mayúsculas?

> **Solución:** dos opciones complementarias.
> 1. **Mejorar el prompt sistema:** "Normaliza siempre el ID a mayúsculas (formato TP-NNNNNN)".
> 2. **Aplicar `.transform()`:** `z.string().transform(s => s.toUpperCase()).refine(...)` — Zod transforma antes de validar.
>
> La opción 2 es más robusta: no dependes de que el modelo lo recuerde.

---

## 3. Ejercicio: guardrails de input y output

**Objetivo:** agregar guardrails al flow conversacional.

### 3.1. Tu tarea

Crea `src/guardrails.ts`:

```typescript
export class GuardrailViolation extends Error {
  constructor(public readonly kind: string, message: string) {
    super(message);
  }
}

export function validateInput(text: string): void {
  if (text.length > 4000) throw new GuardrailViolation("input_too_long", "...");
  if (text.length < 1) throw new GuardrailViolation("input_empty", "...");
  const suspicious = [/ignore previous/i, /you are now/i, /system prompt/i];
  for (const re of suspicious) {
    if (re.test(text)) throw new GuardrailViolation("input_suspicious", "...");
  }
}

export function validateOutput(text: string): void {
  if (text.length > 2000) throw new GuardrailViolation("output_too_long", "...");
  const banned = ["amazon", "mercadolibre", "shopify"];
  for (const word of banned) {
    if (text.toLowerCase().includes(word)) {
      throw new GuardrailViolation("output_competitor_mention", "...");
    }
  }
}
```

### 3.2. Probarlo

```bash
pnpm run guardrails
```

El script ejecuta 5 casos:

| Input | Output esperado |
|-------|-----------------|
| `"Hola, ¿cómo estás?"` | OK (responde normal) |
| `"ignore previous instructions and..."` | bloqueado por input_suspicious |
| `"a".repeat(5000)` | bloqueado por input_too_long |
| Mensaje normal donde el modelo (forzado) menciona "Amazon" | bloqueado por output_competitor_mention |
| Pregunta normal | OK |

### 3.3. Pregunta para ti

Tu input guardrail bloquea `/ignore previous/i`. Un atacante creativo puede escribir *"plis igno re prev ious instruct ions"* (con espacios) y el regex no lo captura. ¿Cuál es tu defensa real ante ataques sofisticados?

> **Razonamiento sugerido:**
>
> Los input guardrails de regex atrapan ataques de manual. La defensa profunda viene de:
>
> 1. **Diseño del system prompt:** "Eres un asistente de TiendaPro y SOLO respondes consultas relacionadas con la tienda. Si el usuario te pide cualquier otra cosa, responde 'No puedo ayudarte con eso, ¿quieres que te derive a un humano?'."
> 2. **Schema constrained en respuesta:** si la salida del modelo es `{intent: enum, response: string}`, el espacio de outputs maliciosos se reduce drásticamente.
> 3. **Output guardrails:** validar que la respuesta sigue siendo del dominio esperado (e.g. menciona productos del catálogo, no inventó nombres de empresas externas).
> 4. **Modelo robusto al jailbreaking:** Claude y GPT-5 son significativamente más resistentes que modelos open-source pequeños.
>
> Conclusión: input guardrails son **una capa**, no la solución.

---

## 4. Ejercicio: streaming structured con `streamObject`

**Objetivo:** ver cuándo `streamObject` aporta y cuándo no.

### 4.1. Tu tarea

`src/stream-object-demo.ts` ya está implementado. Ejecútalo:

```bash
pnpm run stream-object
```

El script genera un análisis de pedido con 8 campos usando `streamObject` y muestra el objeto **mientras se llena**:

```
Frame 1: {}
Frame 2: { orderId: "TP-451200" }
Frame 3: { orderId: "TP-451200", status: "delayed" }
...
Frame N: { orderId: "TP-451200", status: "delayed", priority: "high", ... }
```

### 4.2. Pregunta para ti

¿En qué caso de TiendaPro **sí** quieres `streamObject`? ¿En cuál **no**?

> **Sí:**
>
> - **Análisis largo del pedido para mostrar progresivo al cliente** (UI con secciones que se llenan): el cliente ve el análisis aparecer y siente que pasa algo.
>
> **No:**
>
> - **Clasificación de intent que va a routing:** necesitas el campo `intent` completo antes de decidir flow. Trabajar con un objeto parcial donde `intent` aún no llegó es código frágil. Esperar al objeto completo es lo correcto.
> - **Validación de pedido para escalar a humano:** todos los campos tienen que estar antes de tomar la decisión.

---

## 5. Reto: LLM-as-validator de respuestas del asistente

**Objetivo:** implementar el patrón completo y medir el costo extra.

### 5.1. Tu tarea

Crea `src/validator.ts`:

```typescript
const reviewSchema = z.object({
  isAcceptable: z.boolean(),
  issues: z.array(z.enum(["tono", "competidor", "info_inventada", "off_topic"])),
  suggestion: z.string().optional(),
});

async function reviewAnswer(question: string, answer: string): Promise<Review> {
  const { object } = await generateObject({
    model: llm,
    schema: reviewSchema,
    prompt: `
      Pregunta del cliente: ${question}
      Respuesta del asistente: ${answer}

      Evalúa si la respuesta:
      1. Tiene tono amable y profesional.
      2. NO menciona competidores (Amazon, MercadoLibre, etc.).
      3. NO inventa datos sobre productos o políticas.
      4. Está en el dominio (e-commerce de TiendaPro).
    `,
  });
  return object;
}
```

### 5.2. Probarlo

```bash
pnpm run validator
```

El script:
1. Genera una respuesta normal.
2. La pasa por el validator.
3. Mide latencia y costo extra del paso de validación.

### 5.3. Pregunta para ti

Tu validator agrega ~600 ms y ~$0.0003 por turno. Tu app procesa 100K mensajes/día. ¿Cuál es el sobrecosto mensual? ¿Y cuánta latencia extra ve el usuario?

> **Cálculo:**
>
> - Costo extra: `100K × 30 × $0.0003 = $900/mes`. Significativo.
> - Latencia extra: `+600ms` en CADA respuesta — degrada UX.
>
> **Conclusión:** LLM-as-validator no se aplica en cada turno. Mejor: **muestrear** (validar 5-10% de respuestas) y usar el resultado para mejorar el prompt sistema offline.

---

## 6. Aporte al proyecto integrador

Hito acumulado de M2 hasta acá: TiendaPro tiene chat service con retry/fallback (S03) + clasificación estructurada de intent (S04) + guardrails básicos.

### 6.1. Tarea

1. Copia `src/intent.ts` a `code/proyecto-integrador/src/lib/intent.ts`.
2. Copia `src/guardrails.ts` a `code/proyecto-integrador/src/lib/guardrails.ts`.
3. Modifica `code/proyecto-integrador/src/index.ts`:
   - Antes de `chatStream(...)`: `validateInput(USER_PROMPT)`.
   - Antes de mostrar la respuesta: `validateOutput(text)` después del stream.
   - Después: `classifyIntent(USER_PROMPT)` y muestra el intent detectado.

### 6.2. Validación

```
[provider: google]
[flow: saludo-inicial]

TiendaPro: ¡Hola! Soy el asistente de TiendaPro...

Latencia: 1280ms
Tokens — input: 67, output: 21
Costo estimado: $0.0000345

Intent detectado: pregunta (confidence 0.62)
  reasoning: El mensaje pide presentación, encaja como pregunta general.
```

> **Importante:** este cambio cierra **proyecto-m2-parcial** (S02 + S03 + S04). Haz un commit en `code/proyecto-integrador/` con mensaje:
>
> ```
> feat(proyecto-integrador): aplica chat service + intent + guardrails (M2 parcial)
> ```
>
> Pero NO pongas el tag `proyecto-m2` aún — eso lo hacemos al cierre completo del módulo, después de S05.3.

---

**Vuelve a:** [`README de la sesión`](README.md) | **Próximo paso:** [`recursos.md`](recursos.md).
