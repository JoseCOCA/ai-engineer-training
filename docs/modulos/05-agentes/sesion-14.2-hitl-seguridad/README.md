# Sesión 14.2 — Human-in-the-loop, seguridad y sandboxing

> **Módulo:** 5 — Orquestación de agentes · **Duración estimada:** 1h (~30 min lectura + ~30 min práctica) · **Formato:** 60% teoría / 40% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión podrás:

- Implementar **approval gates** que pausan el agente antes de ejecutar tools destructivas y esperan aprobación humana.
- Aplicar **sandboxing por agente:** budget de tokens, max iterations, output validation con zod.
- Diseñar **escalation a humano** como tool de primera clase del agente.
- Reconocer las cinco categorías de **side effects peligrosos** (BD destructiva, mensajes a terceros, transacciones financieras, datos privados, código ejecutable).
- Cerrar el módulo conectando todo lo aprendido en el integrador con tag `proyecto-m5`.

## 2. Prerequisitos

- **S13 + S14.1 completas.** LangGraph con checkpointer, multi-agente entendido.
- **`GOOGLE_GENERATIVE_AI_API_KEY`** y catálogo de TiendaPro indexado en pgvector (M3).

## 3. Conceptos clave

- **Human-in-the-loop (HITL):** patrón donde el agente pausa, presenta su intención al usuario o a un operador humano, y solo continúa con aprobación.
- **Approval gate:** punto del grafo donde la ejecución se detiene esperando confirmación. LangGraph lo soporta vía `interrupt` + checkpointer.
- **Sandboxing:** conjunto de restricciones que limitan lo que el agente puede hacer: tokens máximos, iteraciones máximas, tools permitidas, validación de outputs.
- **Side effect peligroso:** acción del agente que tiene consecuencias irreversibles o de alto costo. Cinco categorías: BD destructiva, comunicación con terceros, transacciones financieras, exposición de datos privados, ejecución de código.
- **Escalation:** transferencia explícita del control al humano (operador real o canal externo). Modela "el agente reconoce que no puede o no debe continuar".
- **Output validation:** verificar que el output del agente cumple un schema zod antes de devolverlo al usuario. Última línea de defensa contra alucinación con efectos.

## 4. Teoría

### 4.1. Por qué HITL no es opcional para tools destructivas

Un agente con tool `cancelOrder(orderId)` puede, en teoría, cancelar el pedido de cualquier usuario si el LLM se confunde. Sin gate, el daño es real e irreversible.

> **Regla:** ninguna tool con efecto destructivo debe ser invocable sin aprobación explícita. Cero excepciones.

Las cinco categorías de side effects que SIEMPRE necesitan HITL:

| Categoría | Ejemplo | Riesgo |
|-----------|---------|--------|
| BD destructiva | `cancelOrder`, `deleteUser`, `dropTable` | Pérdida irreversible de datos |
| Comunicación con terceros | `sendEmail`, `postToSlack`, `notifyCustomer` | Spam, daño reputacional |
| Transacciones financieras | `chargeCard`, `refundOrder`, `createInvoice` | Pérdida monetaria |
| Datos privados | `exportUserData`, `getCustomerPII` | Compliance, leak |
| Ejecución de código | `runShellCommand`, `executePython` | RCE, fuga de secrets |

#### Tools "read-only" no necesitan HITL

`searchCatalog`, `getOrderStatus`, `getStockLevel` — todas read-only. No causan daño. **No las gates.** El costo de pausar destruye la UX sin proteger nada.

### 4.2. Cómo se implementa un approval gate en LangGraph

LangGraph soporta `interrupt`: una primitiva que pausa el grafo en un nodo y permite reanudar después.

```typescript
import { interrupt, Command } from "@langchain/langgraph";

async function approveCancelOrder(state) {
  const decision = interrupt({
    question: `¿Aprobar cancelación del pedido ${state.orderId}?`,
    metadata: { orderId: state.orderId, reason: state.reason },
  });

  if (decision === "yes") {
    return new Command({ goto: "executeCancellation" });
  }
  return new Command({ goto: "abort", update: { answer: "Cancelación abortada por el operador." } });
}

const graph = workflow.compile({ checkpointer: new MemorySaver() });

// Primera invocación pausa en el interrupt
const result1 = await graph.invoke(input, { configurable: { thread_id: "user-42" } });

// Más tarde, retomamos con la decisión
const result2 = await graph.invoke(
  new Command({ resume: "yes" }),
  { configurable: { thread_id: "user-42" } },
);
```

Notas operativas:

- **Requiere checkpointer** (sin él, no hay forma de retomar).
- **El thread_id identifica la sesión pausada.** En producción, lo persistes en tu sistema (Redis, BD).
- **El humano NO está en línea con el LLM.** El humano puede tardar horas/días. El frontend renderiza la pregunta, recoge la decisión, y reanuda cuando el humano responde.

### 4.3. Sandboxing: las cuatro capas

#### Capa 1: budget de iteraciones

```typescript
graph.invoke(input, {
  configurable: { thread_id: "..." },
  recursionLimit: 25,  // <-- max iteraciones del grafo
});
```

Sin esto, un agente buggy puede consumir miles de iteraciones antes de fallar.

#### Capa 2: budget de tokens

LangChain no trae budget de tokens nativo, pero podes implementarlo en un nodo "guard":

```typescript
const State = Annotation.Root({
  // ...
  totalTokens: Annotation<number>({ reducer: (l, r) => l + r, default: () => 0 }),
});

async function checkBudget(state) {
  if (state.totalTokens > 50_000) {
    return new Command({ goto: "abort", update: { answer: "Excedimos el presupuesto de la consulta." } });
  }
  return {};
}
```

#### Capa 3: tools permitidas por worker

Lo viste en S14.1: cada worker tiene SUS tools, no las globales. Aislamiento por agente.

#### Capa 4: output validation con zod

Antes de devolver la respuesta al usuario, validas contra un schema:

```typescript
const FinalAnswerSchema = z.object({
  answer: z.string().min(1).max(2000),
  intent: z.enum(["catalog", "orders", "escalation"]),
});

const validated = FinalAnswerSchema.safeParse(state);
if (!validated.success) {
  return { answer: "Tuvimos un problema procesando tu solicitud, por favor intenta de nuevo." };
}
```

Esta capa atrapa: respuestas vacías, respuestas demasiado largas, intent inválido, mezclas raras del estado.

### 4.4. Escalation a humano como tool de primera clase

`escalateToHuman` no es una tool destructiva — pero es **el patrón más importante de HITL no-bloqueante**: el agente reconoce que no puede continuar y delega.

```typescript
const escalateToHuman = tool(
  async ({ reason, context }) => {
    const ticket = await ticketingSystem.create({ reason, context });
    return JSON.stringify({ ticketId: ticket.id, message: `Te derivé a un agente humano. Ticket #${ticket.id}.` });
  },
  {
    name: "escalateToHuman",
    description: "Cuando el usuario está frustrado o la consulta excede tus capacidades, deriva a un agente humano.",
    schema: z.object({
      reason: z.string().describe("Motivo de la escalación."),
      context: z.string().describe("Contexto que el humano necesita para retomar."),
    }),
  },
);
```

Tres principios de diseño:

1. **El agente decide cuándo escalar.** No el código orquestador. El system prompt debe decir explícitamente cuándo escalar.
2. **El agente captura contexto.** El humano necesita saber qué intentó el bot y qué dijo el usuario.
3. **El usuario es notificado.** "Te derivé a un agente humano" es un mensaje deliberado, no un error.

### 4.5. Output validation: la última línea de defensa

Aunque el agente respete su system prompt, valida el output. Casos reales que solo se atrapan acá:

- Respuesta vacía (LLM se cortó por max tokens).
- Respuesta con datos PII no autorizados (filtrado por regex).
- Respuesta que cita IDs inexistentes (validación contra el contexto, como en M4 §S11.2).
- Respuesta con tono incorrecto (rubric con LLM judge ligero).

```typescript
async function validateOutput(state) {
  const issues = [];
  if (!state.answer || state.answer.length < 5) issues.push("respuesta vacía");
  if (state.answer.length > 2000) issues.push("respuesta demasiado larga");
  if (/\b\d{16}\b/.test(state.answer)) issues.push("posible número de tarjeta");
  if (issues.length > 0) {
    return { answer: "Lo siento, no pude generar una respuesta válida. Por favor reformula." };
  }
  return {};
}
```

### 4.6. Pipeline de seguridad combinado

Un sistema en producción combina las cuatro capas:

```
     ┌────────────────────┐
     │     query usuario   │
     └──────────┬──────────┘
                ▼
     ┌────────────────────┐
     │  guardrail input   │ ← rechaza prompts maliciosos
     └──────────┬──────────┘
                ▼
     ┌────────────────────┐
     │     supervisor     │ ← classifier
     └──────────┬──────────┘
                ▼
     ┌────────────────────┐
     │     worker         │ ← read-only tools
     └──────────┬──────────┘
                ▼
     ┌────────────────────┐
     │  approval gate     │ ← solo si tool destructiva
     └──────────┬──────────┘
                ▼
     ┌────────────────────┐
     │  output validation │ ← schema + heurísticas
     └──────────┬──────────┘
                ▼
     ┌────────────────────┐
     │     respuesta      │
     └────────────────────┘
```

Cada capa cuesta poco; el efecto compuesto es lo que protege producción.

## 5. Patrones y antipatrones

### Patrones

- **HITL para tools destructivas, sin excepción.** Costo bajo, daño evitado alto.
- **Escalation como tool del agente, no edge case del orquestador.** Modela explícitamente "no puedo seguir".
- **Sandboxing en 4 capas.** Iter budget + token budget + tools por worker + output validation.
- **Output validation con schema explícito.** Atrapa lo que el system prompt no.
- **Logging exhaustivo de decisiones de HITL.** Quién aprobó qué, cuándo. Auditoría.

### Antipatrones

- **HITL para tools read-only.** Mata UX sin proteger nada.
- **Escalation que pierde contexto.** El humano arranca de cero — terrible UX.
- **Sin output validation.** Confías 100% en el LLM. Va a fallar.
- **Approval gate sin checkpointer.** No funciona — el grafo no puede pausar.
- **Limitar tools del worker SOLO con system prompt.** El LLM puede ignorar el prompt. Aislamiento físico (no exponer la tool) es más fuerte.

## 6. Conexión con TiendaPro — el cierre M5

Esta sesión cierra el Módulo 5 con el swap final del integrador. Cambios concretos en `code/proyecto-integrador/`:

```
src/agent/                    ← NUEVO en M5
├── supervisor.ts             ← classifier + grafo principal
├── tools/
│   ├── search-catalog.ts     ← envuelve el RAG pipeline de M4 como tool
│   ├── get-order-status.ts   ← consulta BD mock de pedidos (M5)
│   ├── escalate-to-human.ts  ← devuelve handoff
│   └── index.ts
├── workers/
│   ├── catalog-worker.ts     ← agente con searchCatalog
│   ├── orders-worker.ts      ← agente con getOrderStatus
│   └── escalation-worker.ts  ← agente con escalateToHuman
└── index.ts                  ← runAgent(message) → response
```

Decisiones aplicadas en el integrador M5:

- **LangGraph para el supervisor** (decisión de S13.1).
- **Patrón A — classifier puro** (decisión de S14.1). El supervisor NO reformula respuestas.
- **Sandboxing**: `recursionLimit=25`, validación de output con zod.
- **HITL mínimo**: el `escalateToHuman` se trata como tool normal (no destructiva), pero el integrador ya queda preparado para agregar approval gates en futuras tools.
- **Coexistencia con M4**: el RAG pipeline (Vercel AI SDK) sigue funcionando dentro del catalog worker, envuelto como una tool de LangChain. Las dos integraciones de Gemini coexisten.
- **Tests Ring 1** para el supervisor: validación del classifier con eval set.
- **El demo de `pnpm dev`** ahora muestra una conversación con el agente multi-agente.

## 7. Resumen

Tres ideas para llevarte:

1. **HITL no es decoración.** Cualquier tool con efecto destructivo necesita approval gate. El daño potencial supera siempre el costo de UX.
2. **Sandboxing en cuatro capas.** Budget de iteraciones, budget de tokens, aislamiento de tools por worker, output validation. Cada capa atrapa un modo de fallar distinto.
3. **Escalation como tool del agente.** El agente reconoce sus límites y delega. Modela mejor el caso real que un edge case en el orquestador.

## 8. Preguntas de auto-evaluación

1. Tu equipo propone una tool `bulkUpdatePrices(productIds, newPrice)`. ¿HITL sí o no? ¿Qué metadata debería ver el aprobador?
2. Diseña el system prompt para `escalateToHuman` que el agente debería respetar. Tres condiciones claras de "cuándo escalar".
3. Diferencia operativa entre **interrupt + checkpointer** y **un endpoint de aprobación externo (webhook)**. ¿Cuándo cada uno?
4. Tu eval set tiene 30 casos. Después de agregar output validation, 2 casos pasan a fallar (la respuesta es válida según el LLM pero el schema la rechaza). ¿Cómo decides si la regla del schema o el LLM tiene razón?
5. Tu agente tiene `recursionLimit=25`. Una query genuinamente complicada lo agota. ¿Subir a 50 o agregar un step de planning antes? Argumenta.
6. Implementas un approval gate y descubres que los humanos demoran 3 días en aprobar. ¿Tres mitigaciones operativas?

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 3 demos: approval gate, sandboxing, escalation.

**Cierre del módulo:** después de S14.2 hacemos el commit `feat(proyecto-integrador): cierra Módulo 5` y el tag `proyecto-m5`.
