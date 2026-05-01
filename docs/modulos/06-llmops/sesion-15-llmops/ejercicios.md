# Sesión 15 — Ejercicios

> **Tiempo estimado:** ~60 min total. Cuatro demos: instrumentación con Langfuse, A/B testing de prompts, cost tracking por flow, y deployment con Docker. Scripts en [`code/m06-llmops/sesion-15/`](../../../../code/m06-llmops/sesion-15/).

---

## Setup base

```bash
pnpm install
```

`.env` con:

```bash
GOOGLE_GENERATIVE_AI_API_KEY=tu_key
# Para Langfuse (opcional — si no configuras, los demos imprimen el trace local):
LANGFUSE_PUBLIC_KEY=pk_...
LANGFUSE_SECRET_KEY=sk_...
LANGFUSE_HOST=https://cloud.langfuse.com
```

Puedes crear cuenta gratuita en [https://cloud.langfuse.com](https://cloud.langfuse.com) o levantar Langfuse self-hosted con su `docker-compose`.

---

## 1. Ejercicio guiado: instrumentación con Langfuse

```bash
pnpm --filter @curso-ai/m06-sesion-15 langfuse-demo
```

El script ejecuta un mini-pipeline (classify → answer) que emite trace + spans + generation + score a Langfuse. Si no configuraste keys, imprime los eventos al stdout para que veas la estructura.

### Para revisar

- En el dashboard de Langfuse: Traces → buscar el último → expandir spans.
- Cada span muestra input/output/duration; cada generation muestra tokens y costo.
- Los scores aparecen en una pestaña aparte; puedes filtrar por valor.

---

## 2. Ejercicio guiado: A/B testing de prompts

```bash
pnpm --filter @curso-ai/m06-sesion-15 ab-testing
```

Dos variantes de prompt para responder consultas de productos. El script:

1. Define 6 queries de eval.
2. Asigna cada `userId` a una variante de forma determinista (hash → bucket).
3. Ejecuta ambas variantes para cada query.
4. Imprime tabla comparativa: latencia promedio, tokens promedio, longitud de respuesta promedio.

### Para reflexionar

- En producción, el bucketing es por `userId`. En el demo es por `userId` mock para que veas el patrón.
- Las métricas comparativas aquí son baratas (latencia, tokens). Faithfulness comparativa requeriría un eval set anotado y LLM judge — ese paso entra en Promptfoo (S11.3).

---

## 3. Ejercicio guiado: cost tracking por flow

```bash
pnpm --filter @curso-ai/m06-sesion-15 cost-tracking
```

Simula 30 invocaciones del agente con tres tipos de query (catalog, orders, escalation). Para cada una calcula el costo basado en tokens reales (Gemini Flash precio público) y agrega por `flow`.

Imprime un reporte:

```
Flow              Calls   Avg cost  Total cost
catalog           14      $0.0008   $0.0112
orders            10      $0.0003   $0.0030
escalation         6      $0.0005   $0.0030

CPQ promedio: $0.0006
Proyección a 10K queries/día: $6.00
```

### Para revisar

- Si tu producto cobra por user, ese CPQ tiene que ser sostenible vs lo que cobras.
- Los flows más caros (catalog por el rerank + RAG) son candidatos a optimización: caching, modelo más barato, etc.

---

## 4. Ejercicio guiado: deployment con Docker

```bash
cat code/m06-llmops/sesion-15/Dockerfile
cat code/m06-llmops/sesion-15/docker-compose.yml
```

El demo trae un Dockerfile multi-stage para el integrador y un compose con healthcheck.

```bash
# Build:
docker build -t tiendapro-agent ./code/m06-llmops/sesion-15
# Levantar (necesita pgvector ya corriendo):
docker compose -f code/m06-llmops/sesion-15/docker-compose.yml up
```

### Para revisar

- El Dockerfile usa multi-stage: imagen final solo con `dist/` y `node_modules/` de producción.
- El healthcheck llama a `/health` que verifica conexión a Postgres (no llama al LLM — eso iría en `/ready`).
- Variables de entorno se inyectan via env file, NO se hardcodean en la imagen.

---

## Bonus

1. **Webhook scoring.** Modifica el demo de Langfuse para que después de cada trace, llame a un LLM judge y agregue un score de faithfulness. En producción esto va offline o cada N traces.
2. **Cost cap por usuario.** Implementa en el demo de cost-tracking un cap diario (`MAX_TOKENS_PER_USER_PER_DAY=20000`). Si lo excede, devuelve mensaje degradado.
3. **Canary con feature flag.** Diseña en pseudocódigo cómo agregarías un feature flag para que solo el 5% de los users use la variante nueva del prompt.

---

**Próxima sesión:** [`Lab — Productividad del AI Engineer`](../../lab-productividad-ai-engineer/) → SDD, Claude Code, MCPs.
