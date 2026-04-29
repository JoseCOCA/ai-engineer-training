# Sesión 05.2 — Memoria conversacional e historial

> **Módulo:** 2 — Patrones de aplicaciones LLM · **Duración estimada:** 1h (~25 min lectura + ~35 min práctica) · **Formato:** 50% teoría / 50% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión vas a poder:

- Explicar **por qué la API LLM es stateless** y qué significa eso para tu app.
- Diseñar la **estructura de un mensaje** (`role`, `content`, `metadata`) y por qué esa forma simple basta para casi todos los casos.
- Implementar **memoria corta con ventana deslizante** y elegir el tamaño correcto según costo y calidad.
- Implementar **memoria larga con summarization** de turnos viejos para conversaciones extensas sin que el contexto explote.
- Reconocer cuándo necesitas **memoria semántica** (M3-M4) y por qué no la usamos todavía.

## 2. Prerequisitos

- **S05.1** completa (especialmente: budget de tokens y truncado responsable).
- `chat()` y `chatStream()` del proyecto integrador funcionando con history (en S03 ya aceptas `messages: ChatMessage[]`).

## 3. Conceptos clave

- **API stateless:** cada llamada al LLM es independiente. El modelo NO recuerda la llamada anterior. Si quieres conversación, **tú** mandas el historial cada vez.
- **Mensaje:** unidad atómica del historial. Al menos `{ role, content }`. Roles típicos: `system`, `user`, `assistant`, `tool`.
- **Sliding window:** mantener solo los últimos N mensajes (o últimos N tokens) en cada llamada. Lo viejo se descarta.
- **Summarization de historial:** comprimir turnos viejos en un resumen y mantener intactos los recientes. Mejor calidad que sliding window puro a costo de una llamada extra.
- **Memoria semántica:** indexar todo el historial con embeddings y traer los pedazos relevantes para el turno actual. Fuera de alcance en M2.

## 4. Teoría

### 4.1. Stateless por diseño

La API de cualquier proveedor LLM es **stateless**. Hago una llamada con `messages: [...]` y el modelo me responde. Hago otra llamada después: el modelo no sabe nada de la primera. **Cada llamada es un evento aislado.**

Implicación inmediata: **si quieres que el asistente "recuerde" lo que dijo el usuario hace 3 mensajes, tienes que mandarle esos mensajes cada vez**.

```typescript
// Turno 1
const r1 = await chat({
  system: "Eres asistente de TiendaPro.",
  messages: [{ role: "user", content: "Quiero una mochila." }],
});

// Turno 2 — para que recuerde, REEN VIAS la conversación
const r2 = await chat({
  system: "Eres asistente de TiendaPro.",
  messages: [
    { role: "user", content: "Quiero una mochila." },
    { role: "assistant", content: r1.text },
    { role: "user", content: "¿Cuál de esas para 1 día?" },
  ],
});
```

**El historial vive en TU app, no en el LLM.** Tu trabajo es:

1. Persistir el historial (memoria, archivo, BD).
2. Decidir qué mandarle al modelo en cada turno (todo, una ventana, un resumen).
3. Aplicar budget para que no explote.

### 4.2. Estructura de mensaje

El SDK de Vercel acepta:

```typescript
type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};
```

Esto basta para el 95% de los casos. Si necesitas más, agregas metadata **fuera** del mensaje (no se envía al modelo, se usa en tu app):

```typescript
interface StoredMessage extends Message {
  id: string;          // para idempotencia, dedup, resume
  createdAt: string;   // timestamp
  flow?: string;       // qué flow lo originó (ver S03)
  userId?: string;     // a qué usuario pertenece
  tokensApprox?: number; // contar tokens locales para budget
}
```

Cuando armas la llamada al LLM, **proyectas** `StoredMessage[] → Message[]` quitando metadata.

### 4.3. Memoria corta — ventana deslizante

El patrón más simple: mantener los últimos N mensajes (o últimos N tokens) en cada turno.

```typescript
function buildContextWindow(history: Message[], maxMessages = 10): Message[] {
  return history.slice(-maxMessages);
}
```

**Ventajas:**

- Trivial de implementar y entender.
- Costo predecible: input crece hasta el techo y se estabiliza.
- Sin llamadas extras.

**Limitaciones:**

- Si la conversación es larga y el usuario hace referencia a algo dicho hace 30 turnos, el modelo no lo va a saber.
- "El cliente me dijo su email hace 20 mensajes pero no lo conservé" → el asistente vuelve a pedirlo y rompe la UX.

#### Sliding por mensajes vs por tokens

Por mensajes (`slice(-N)`) es simple pero **N mensajes ≠ M tokens**: un mensaje del usuario puede ser una oración o un párrafo de 800 tokens.

Por tokens es más sano:

```typescript
function buildContextByTokens(history: Message[], maxTokens: number): Message[] {
  const reversed = [...history].reverse();
  const kept: Message[] = [];
  let used = 0;
  for (const msg of reversed) {
    const t = countTokens(msg.content);
    if (used + t > maxTokens) break;
    kept.unshift(msg);
    used += t;
  }
  return kept;
}
```

> **Patrón:** sliding por tokens con un budget. Lo conectas con el `enforceContextBudget` de S05.1.

### 4.4. Memoria larga — summarization de turnos viejos

Cuando una conversación dura horas o días, sliding window puro pierde información valiosa. La técnica clásica:

1. Mantener los últimos K turnos **literales** (memoria reciente).
2. Resumir los turnos anteriores a K en un único `assistant` o `system` con el resumen.
3. Cada cierto número de turnos, **re-resumir** mezclando el resumen viejo + los nuevos turnos que ahora se descartan.

```
Turno 1-5:  [s1, m1, m2, m3, m4, m5]   ← solo originales
...
Turno 10:   [s1, RESUMEN(m1..m5), m6, m7, m8, m9, m10]
...
Turno 20:   [s1, RESUMEN(m1..m15), m16..m20]
```

#### Cómo se hace el resumen

Una llamada al LLM con un prompt estilo:

```
Resume la siguiente conversación entre un cliente y el asistente
de TiendaPro en máx 200 palabras. Conserva: nombre del cliente si
se mencionó, productos mirados, problemas reportados, decisiones
pendientes. Descarta saludos y small talk.

[mensajes a resumir]
```

**Costos a tener en cuenta:**

- **Una llamada extra cada N turnos.** Bajo overhead si N es grande (cada 10-20 turnos).
- **El resumen pierde matices.** Datos exactos (números de pedido, montos) tienen que caber en el resumen — verificar en eval set.
- **El resumen puede alucinar.** Por eso `temperature = 0` y el prompt "no inventes datos no presentes".

#### Cuándo NO usar summarization

- Conversaciones cortas (≤10 turnos). Sliding window basta.
- Información crítica donde no puedes perder un detalle (legal, médico). Mejor: persistir todo y aplicar memoria semántica selectiva.
- Costo de la llamada de resumen > ahorro en tokens del contexto reducido. Calcular antes de adoptar.

### 4.5. Memoria semántica (preview de M3-M4)

Para conversaciones realmente largas o multi-sesión (mismo usuario vuelve días después), el patrón profesional es:

1. **Embedear** cada turno (en M3 vemos cómo).
2. **Persistir** en una BD vectorial (en M3-M4).
3. **Recuperar** los turnos semánticamente relevantes para el mensaje actual.
4. Inyectarlos como contexto.

Es la versión "RAG sobre tu propia conversación". **No la implementamos en M2** porque requiere las herramientas que llegan en M3-M4. Lo importante hoy: saber que existe y por qué no es un sliding window con summarization.

### 4.6. System prompt en el historial

Pregunta común: ¿el `system` cuenta para la ventana?

**Respuesta corta:** **el system es siempre fijo** — lo mandas en CADA llamada, no se trunca ni se resume.

**Razón:** si el system se trunca, el modelo pierde su rol y guardrails. Eso es peor que perder mensajes viejos.

**Implicación:** budget tiene partes separadas:

```
total = system + history_recent + summary + new_user_message + reserved_response
        ↑ fijo                                                  ↑ fijo
```

System y reserva de respuesta son fijos. Los otros se manejan con sliding/summary según haga falta.

## 5. Patrones y antipatrones

### Patrones

- **Persistir todo el historial** en tu app, decidir qué mandar al modelo en cada turno (no son lo mismo).
- **Sliding window por TOKENS, no por número de mensajes.** Tu budget es en tokens.
- **System prompt fijo, fuera del sliding.** Nunca lo trunques.
- **Summarization de turnos viejos** cuando la conversación es larga, manteniendo los recientes literales.
- **Re-resumir periódicamente** para que el resumen no crezca sin techo.

### Antipatrones

- **Tirar el historial entero al modelo siempre.** Funciona en demos, explota en producción cuando un cliente charla 50 turnos.
- **No persistir el historial.** Si tu app reinicia, la conversación muere.
- **Truncar el system.** Pierdes el rol del asistente.
- **Truncar al final** (en lugar del inicio). Equivale a "olvidar lo último que dijo el usuario".
- **Summarization en cada turno.** El costo no compensa para conversaciones cortas.

## 6. Conexión con TiendaPro

TiendaPro hasta ahora hace UN turno: usuario dice algo, asistente responde, fin. Esta sesión:

1. **Crear `src/lib/conversation.ts`** con un `ConversationStore` in-memory: `addMessage`, `getHistory`, `getContextWindow(maxTokens)`.
2. **Agregar la función `summarizeOldTurns(messages)`** que reduce los más viejos a un único `assistant` con el resumen.
3. **Modificar `src/index.ts`** para que en lugar de UNA llamada, simule una conversación de 3 turnos seguidos donde el asistente "recuerda" lo dicho.

El asistente pasa de "responder un único mensaje" a "mantener una conversación coherente" — sin persistencia (eso queda como reto opcional).

## 7. Resumen

Tres ideas para llevarte:

1. **La API LLM no tiene memoria.** Cada llamada es aislada. Tu app es la dueña del historial; le decides al modelo qué darle en cada turno.
2. **Sliding window por tokens es el default.** Simple, costo predecible, suficiente para conversaciones de 10-30 turnos. Para más, agregas summarization de la parte vieja.
3. **El system prompt no se trunca jamás.** Define el rol del asistente; perderlo rompe la app. Tu budget tiene partes fijas (system + reserva de respuesta) y partes elásticas (history + RAG).

## 8. Preguntas de auto-evaluación

1. La API LLM es stateless. ¿Qué consecuencias tiene esto para el diseño de tu app de chat? Lista 3 implicaciones concretas.
2. ¿Por qué sliding window por número de mensajes es problemático y por qué por tokens es más sano? Da un caso concreto.
3. Tu conversación llegó a 50 turnos. ¿Cuándo conviene activar summarization de turnos viejos? ¿Y cuándo NO compensa?
4. El system prompt mide 1500 tokens y el modelo tiene 8K de context. Si tu sliding window es "últimos 6K tokens del historial", ¿qué problema vas a tener y cómo lo arreglas?
5. ¿Por qué memoria semántica (con embeddings) es mejor que summarization para conversaciones de meses? Pista: piensa qué pasa si el cliente vuelve después de 3 días y pregunta sobre algo que dijo el primer día.
6. Tu summarization reduce 30 turnos viejos a 200 palabras. Una semana después, descubres que el resumen omitió un detalle clave (número de pedido del cliente). ¿Qué cambiarías en tu prompt de summarization?

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 3 ejercicios + reto + aporte al proyecto integrador.

**Próxima sesión:** [`S05.3 — Personalización de prompts por usuario/rol + testing`](../sesion-05.3-prompts-testing/) → cómo organizar prompts versionados en código y testearlos antes de que rompan UX en producción.
