# Sesión 05.2 — Ejercicios

> **Tiempo estimado:** ~35 min total. Construyes un store conversacional simple, le agregas sliding window por tokens y summarization. Scripts en [`code/m02-patrones-llm/sesion-05.2/`](../../../../code/m02-patrones-llm/sesion-05.2/).

---

## Setup

```bash
cd code/m02-patrones-llm/sesion-05.2
pnpm install
```

`.env` con un proveedor configurado.

---

## 1. Ejercicio guiado: stateless vs con historial

**Objetivo:** observar empíricamente la diferencia entre llamadas aisladas (modelo "olvida") y conversación con historial (modelo "recuerda").

### 1.1. Tu tarea

Ejecuta:

```bash
pnpm run stateless-vs-history
```

El script ejecuta dos veces la misma secuencia de 3 turnos:

```
Turno 1: "Hola, soy Ana."
Turno 2: "¿Cuál es mi nombre?"
Turno 3: "¿Te lo había dicho?"
```

**Modo A (stateless):** cada turno se manda como una llamada independiente, sin historial.
**Modo B (con historial):** cada turno acumula el historial.

### 1.2. Salida esperada (resumida)

```
=== Modo A: stateless ===
Turno 1: ¡Hola Ana! ¿En qué te ayudo?
Turno 2: No tengo esa información. ¿Cómo te llamas?
Turno 3: No recuerdo conversaciones previas...

=== Modo B: con historial ===
Turno 1: ¡Hola Ana! ¿En qué te ayudo?
Turno 2: Tu nombre es Ana.
Turno 3: Sí, me lo dijiste en el saludo inicial.
```

### 1.3. Pregunta para ti

¿Qué cambia entre los dos modos a nivel de tokens y latencia? Si tu producto tiene 30 turnos por conversación, ¿cuál es la implicación operacional?

> **Razonamiento:** modo B paga input proporcional al historial acumulado. En el turno 30, mandas 29 mensajes anteriores cada vez. Sin sliding window por tokens, el costo por turno crece linealmente y la latencia también. Sliding window estabiliza ambos.

---

## 2. Ejercicio: sliding window por tokens

**Objetivo:** implementar el truncado responsable.

### 2.1. Tu tarea

`src/lib/conversation.ts` tiene un `ConversationStore` con stub. Implementa:

```typescript
class ConversationStore {
  private messages: StoredMessage[] = [];

  addMessage(msg: StoredMessage): void { ... }

  getHistory(): StoredMessage[] { ... }

  getContextWindow(maxTokens: number): Message[] {
    // Devuelve los mensajes más recientes hasta llegar a maxTokens.
    // Cuenta tokens con gpt-tokenizer.
  }
}
```

### 2.2. Probarlo

```bash
pnpm run sliding-window
```

El script:
1. Genera 30 turnos sintéticos.
2. Pide ventana de 1000 tokens.
3. Reporta cuántos turnos entraron y cuál es el primer mensaje conservado.

Salida esperada:

```
Total mensajes generados: 30
Tokens totales aprox: 4500
Ventana solicitada: 1000 tokens
Mensajes conservados: 7 (turnos 24-30)
Primer mensaje conservado: "Turno 24: ..."
```

### 2.3. Pregunta para ti

Tu sliding window descarta el turno 1 donde el cliente dijo su nombre. En el turno 25 el asistente le pregunta el nombre otra vez — UX mala. ¿Qué solución de S04/S05.2 atacaría esto sin recurrir a memoria semántica?

> **Razonamiento:** **summarization de turnos viejos** (próximo ejercicio). Resumes los turnos descartados manteniendo datos críticos (nombre, email, productos consultados) y agregas ese resumen al system prompt. El asistente "recuerda" sin tener los mensajes literales.

---

## 3. Ejercicio: summarization de turnos viejos

**Objetivo:** implementar el patrón completo y medir el costo extra.

### 3.1. Tu tarea

En `src/summarize.ts`, implementa `summarizeOldMessages(messages: Message[]): Promise<string>`:

```typescript
const SUMMARY_PROMPT = `Resume esta conversación entre un cliente y el asistente de TiendaPro en máximo 150 palabras.
Conserva en el resumen:
- Nombre/email del cliente si se mencionaron.
- Productos consultados o comprados.
- Problemas reportados.
- Decisiones pendientes.
NO inventes datos no presentes en la conversación. NO incluyas saludos.`;
```

Después modifica `ConversationStore.getContextWindow(maxTokens)` para que:

1. Si el historial cabe entero, lo devuelve tal cual.
2. Si excede, **resume los más viejos** y devuelve `[summary_message, ...recent_messages]`.

### 3.2. Probarlo

```bash
pnpm run summarize
```

El script:
1. Genera 25 turnos donde en el turno 1 el cliente dice "Soy Ana" y en el turno 3 menciona "pedido TP-451200".
2. Aplica getContextWindow con techo bajo (1000 tokens).
3. Imprime el resumen generado y verifica que conserve "Ana" y "TP-451200".

### 3.3. Pregunta para ti

Activar summarization agrega ~600 ms de latencia y ~$0.0002 por turno cada vez que se dispara. ¿Cómo decides CUÁNDO disparar el resumen para no pagarlo en cada turno?

> **Razonamiento sugerido:**
>
> Tres estrategias:
>
> 1. **Por umbral:** "si el historial supera el budget, resume". Reactivo, simple, costo solo cuando hace falta.
> 2. **Por cadencia:** "cada N turnos, re-resumir". Predecible, costo amortizado.
> 3. **Híbrido:** umbral + cadencia mínima ("nunca resumir más seguido que cada 5 turnos").
>
> En TiendaPro: estrategia 1 (umbral). Más simple, suficiente.

---

## 4. Reto: persistencia con archivo

**Objetivo:** persistir el historial entre ejecuciones.

### 4.1. Tu tarea

Extiende `ConversationStore` con:

```typescript
saveTo(path: string): void { ... }
static loadFrom(path: string): ConversationStore { ... }
```

Implementa con JSONL en `data/conversations/{conversationId}.jsonl`. Cada línea = un mensaje.

### 4.2. Probarlo

```bash
pnpm run persist
# Primera corrida: agrega 3 mensajes y guarda.
pnpm run persist
# Segunda corrida: carga y muestra los mensajes guardados.
```

### 4.3. Pregunta para ti

JSONL en archivo es bueno para POCs, pero tiene 3 problemas en producción real. Lístalos.

> **Razonamiento sugerido:**
>
> 1. **Concurrencia:** dos procesos escribiendo el mismo archivo se corrompen. Solución: BD relacional o KV con locks.
> 2. **Lecturas grandes:** cargar el archivo entero para leer el último mensaje es O(N). Para 1M conversaciones × 100 mensajes, no escala.
> 3. **Sin queries:** no puedes "traerme las últimas 20 conversaciones del cliente X" sin escanear todo. BD relacional + índices resuelve.
>
> En TiendaPro real iríamos a Postgres con tabla `conversations` + tabla `messages` con FK, índices por `conversation_id` y `created_at`.

---

## 5. Aporte al proyecto integrador

Hito acumulado de M2 hasta acá: TiendaPro tiene chat service + intent + guardrails + contexto + ahora **conversación con memoria**.

### 5.1. Tarea

1. Copia `src/lib/conversation.ts` a `code/proyecto-integrador/src/lib/conversation.ts`.
2. Copia `src/summarize.ts` a `code/proyecto-integrador/src/lib/summarize.ts`.
3. Modifica `code/proyecto-integrador/src/index.ts` para que ejecute una conversación de 4-5 turnos seguidos:

```typescript
const conv = new ConversationStore();
const turns = [
  "Hola, soy Carlos.",
  "¿Tienen mochilas para senderismo de fin de semana?",
  "¿Cuál de las que mencionaste pesa menos?",
  "¿Y el envío a Buenos Aires?",
];
for (const turn of turns) {
  conv.addMessage({ role: "user", content: turn, ... });
  const window = conv.getContextWindow(4000);
  const response = await chat({ system: SYSTEM, messages: window, flow: "chat-default" });
  conv.addMessage({ role: "assistant", content: response.text, ... });
  console.log(`> ${turn}\n  ${response.text}\n`);
}
```

### 5.2. Validación

El asistente debería **recordar el nombre Carlos** en el turno 2 si pregunta algo personalizado, **recordar las mochilas mencionadas** en el turno 3, etc.

> Mantenlo en local. Commit `proyecto-m2` viene tras S05.3.

---

**Vuelve a:** [`README de la sesión`](README.md) | **Próximo paso:** [`recursos.md`](recursos.md).
