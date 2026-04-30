# Sesión 13.3 — Ejercicios

> **Tiempo estimado:** ~45 min total. Tres demos sobre checkpointing, error handling y trace logging. Scripts en [`code/m05-agentes/sesion-13.3/`](../../../../code/m05-agentes/sesion-13.3/).

---

## Setup base

```bash
pnpm install
```

`.env` con `GOOGLE_GENERATIVE_AI_API_KEY`.

---

## 1. Ejercicio guiado: checkpointer y conversaciones multi-turno

```bash
pnpm --filter @curso-ai/m05-sesion-13.3 checkpointer
```

Un grafo simple con `MemorySaver`. Hacemos 2 invocaciones con el mismo `thread_id` y el agente recuerda el estado anterior. Luego una invocación con un thread distinto que parte limpio.

### Para revisar

- `src/01-checkpointer.ts` muestra cómo se pasa `configurable.thread_id` y cómo `getStateHistory` te lista los snapshots.
- Cambia a un thread_id distinto en el segundo invoke: el estado anterior no aparece.

---

## 2. Ejercicio guiado: error handling con retries y fallbacks

```bash
pnpm --filter @curso-ai/m05-sesion-13.3 error-handling
```

Tres escenarios:

- **A — Transitorio:** una tool simulada lanza error las primeras 2 veces y al tercer intento devuelve éxito. `withRetry({ stopAfterAttempt: 3 })` lo recupera.
- **B — Dominio:** una tool devuelve `{ found: false }` para un id inexistente. El grafo rutea a una rama de fallback ("no encontré ese pedido, ¿podes confirmar el id?").
- **C — Fatal:** simulamos auth fallida. El catch externo devuelve respuesta degradada al usuario.

---

## 3. Ejercicio guiado: trace logging estructurado a JSONL

```bash
pnpm --filter @curso-ai/m05-sesion-13.3 tracing
```

El demo registra cada step del grafo en `logs/agent-trace.jsonl` con formato:

```json
{"trace_id":"trc_abc","span_id":"spn_001","name":"classify","duration_ms":420,"input_tokens":80}
```

Después abre el JSONL y muestra cómo filtrarías eventos para analizar latencia por step.

### Para revisar

- En producción este exportador iría a Langfuse / LangSmith / OpenTelemetry. Acá lo dejamos en archivo para que veas la estructura sin depender de un servicio.
- Activá `LANGCHAIN_TRACING_V2=true` y `LANGCHAIN_API_KEY` para ver los mismos traces en el dashboard de LangSmith.

---

## Bonus

1. **SqliteSaver.** Reemplaza `MemorySaver` por `SqliteSaver` (ver `@langchain/langgraph-checkpoint-sqlite`). Reinicia el proceso entre invocaciones — el estado persiste en `agent-state.db`.
2. **Fallback a otro proveedor.** Si tienes `ANTHROPIC_API_KEY`, agrega `withFallbacks({ fallbacks: [anthropicLlm] })`. Provoca un error en Google (key inválida) y mira cómo recae a Anthropic.
3. **Trace exporter custom.** En lugar de archivo, exporta los traces a stdout con formato `pretty` para ver en consola.

---

**Próxima sesión:** [`S14.1 — Multi-agente y patrones de comunicación`](../sesion-14.1-multi-agente/) → supervisor, hierarchical, sequential.
