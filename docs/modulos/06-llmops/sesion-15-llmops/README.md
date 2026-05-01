# Sesión 15 — LLMOps: producción, observabilidad, KPIs, costes, A/B testing

> **Módulo:** 6 — Despliegue y puesta en producción · **Duración estimada:** 2h (~60 min lectura + ~60 min práctica) · **Formato:** 60% teoría / 40% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión podrás:

- Explicar **qué es LLMOps** y en qué difiere de DevOps tradicional cuando hay un LLM en el path crítico.
- Diseñar **observabilidad estructurada** para sistemas LLM con Langfuse: traces, sessions, costs, scores.
- Definir **KPIs operacionales** relevantes (latencia p50/p95/p99, cost per query, faithfulness, satisfaction) y SLOs realistas.
- Implementar **A/B testing de prompts** con un harness que enrutea X% del tráfico a la variante.
- Aplicar **gestión de costos** por flow, por user, por modelo, con alertas y caps.
- Diseñar el **deployment** del integrador con Docker + healthchecks + variables de entorno seguras.

## 2. Prerequisitos

- **Todo el curso hasta M5.** El integrador con multi-agente funcionando.
- Cuenta gratuita en **Langfuse Cloud** ([https://cloud.langfuse.com](https://cloud.langfuse.com)) o instancia self-hosted con `docker compose`.
- **Docker** instalado para los demos de deployment.

## 3. Conceptos clave

- **LLMOps:** disciplina que adapta DevOps para sistemas con LLMs. Foco en observabilidad de calidad (no solo de latencia/errores), gestión de costos, evaluación continua, gestión de prompts y modelos como artefactos versionados.
- **Trace:** ejecución completa de un agente para una query. Compuesto por `spans` (steps individuales).
- **Session:** agrupación de traces de la misma conversación de un usuario. Permite analítica end-to-end.
- **SLO (Service Level Objective):** umbral operacional definido. Ejemplo: "99% de queries responden en menos de 3s".
- **A/B testing:** ejecutar dos variantes (de un prompt, modelo o pipeline) en producción con tráfico real y comparar métricas.
- **Canary deployment:** desplegar la versión nueva al X% del tráfico (5%, 10%, 25%) antes de pasar al 100%.
- **Cost per query (CPQ):** costo promedio en USD de responder una query del usuario. KPI primario para la economía del producto.
- **Score:** anotación que un trace puede recibir post-hoc (faithfulness, satisfaction, helpfulness). Se calcula con LLM judge o feedback humano.

## 4. Teoría

### 4.1. ¿Qué hace distinto a LLMOps?

DevOps tradicional optimiza tres ejes: latencia, disponibilidad, throughput. LLMOps agrega tres dimensiones que no existían en sistemas determinísticos:

#### Dimensión 1: calidad como métrica continua

Un endpoint REST con 200 OK en 100ms es operacionalmente perfecto. Pero si el LLM responde algo factualmente incorrecto, está roto sin que se note. Sin observabilidad de **calidad** (faithfulness, satisfaction, hallucination rate), tu SLO te miente.

#### Dimensión 2: costos variables por query

Un endpoint REST cuesta lo mismo cada vez. Una query LLM cuesta lo que cuestan sus tokens. La cuenta del fin de mes sorprende — un agente que entra en loop puede consumir $50 en una query mal ruteada.

#### Dimensión 3: drift de modelo

Tu código no cambió; el comportamiento sí. El proveedor actualizó el modelo, retiró una versión, ajustó RLHF, cambió defaults. Sin monitoreo de calidad, no se ve hasta que un usuario reporta.

> **Regla:** la observabilidad LLM no es "logs en JSON". Es traces estructurados + costs + scores de calidad continuos.

### 4.2. Langfuse: el toolkit base

Langfuse es la herramienta open-source de referencia. Tres conceptos:

#### Trace

Una ejecución completa. Tiene name, input, output, metadata, tokens, cost.

```typescript
import { Langfuse } from "langfuse";

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com",
});

const trace = langfuse.trace({
  name: "agent.invoke",
  userId: "user-42",
  sessionId: "session-abc",
  input: { query: "¿tienen mochilas?" },
  metadata: { version: "M5", agent: "supervisor" },
});

// más tarde
trace.update({ output: "Te recomiendo TP-MOCH-01...", level: "DEFAULT" });
```

#### Span

Step interno del trace. El supervisor genera un span "classify", el catalog worker un span "rag", etc. Cada span tiene su input/output/duration.

```typescript
const classifySpan = trace.span({ name: "classify", input: { query } });
const intent = await classify(query);
classifySpan.end({ output: { intent } });
```

#### Generation

Subcaso de span: una llamada a LLM. Langfuse calcula tokens y costo automáticamente si declarás el modelo.

```typescript
const generation = trace.generation({
  name: "rag-answer",
  model: "gemini-2.5-flash",
  input: messages,
});
const result = await llm.invoke(messages);
generation.end({
  output: result.content,
  usage: { input: result.usage.input, output: result.usage.output },
});
```

#### Score

Anotación post-hoc al trace. Pueden venir de LLM judge automático o de feedback de usuario.

```typescript
trace.score({ name: "faithfulness", value: 0.92 });
trace.score({ name: "user_thumbs_up", value: 1 });
```

#### Sessions

Agrupar traces por `sessionId` te da analítica de la conversación entera: cuántos turnos, drop-off rate, satisfacción agregada.

### 4.3. KPIs operacionales para sistemas LLM

| KPI | Fórmula | SLO típico |
|-----|---------|-----------|
| **Latencia p95** | percentil 95 de duration_ms | < 3000 ms |
| **Latencia p99** | percentil 99 | < 8000 ms |
| **Disponibilidad** | requests no erroreados / total | > 99.5% |
| **Cost per query (CPQ)** | total_cost_usd / queries | <= $0.01 conversacional |
| **Faithfulness rate** | % de traces con faithfulness > 0.85 | > 90% |
| **Hallucination rate** | % con citas inválidas o fuera de contexto | < 5% |
| **Drop-off rate** | sessions con < 2 turnos / total | < 30% |
| **Thumbs up rate** | feedback positivo / feedback total | > 75% |

#### Cómo medirlos

- **Latencia, disponibilidad, CPQ:** directos del trace. Langfuse los grafica nativo.
- **Faithfulness, hallucination:** LLM judge offline (RAGAS) o online cada N traces.
- **Drop-off, thumbs up:** del feedback de usuario en frontend.

> **Regla:** define los SLOs antes de pasar a producción. Sin SLO, no hay alerta cuando el sistema degrada.

### 4.4. A/B testing de prompts

Cambiar un prompt en producción sin medir es fe ciega. El patrón canónico:

#### Estructura

```typescript
const PROMPT_VARIANTS = {
  control: "v1.0 — Eres el asistente de TiendaPro. Sé conciso.",
  variant: "v1.1 — Eres el asistente de TiendaPro. Responde en máx 3 oraciones, con tono cercano.",
};

function getVariant(userId: string): "control" | "variant" {
  // hash determinista del userId → bucket. 50/50 en este ejemplo.
  const bucket = parseInt(hash(userId).slice(0, 4), 16) % 100;
  return bucket < 50 ? "control" : "variant";
}

// en el handler
const variant = getVariant(userId);
const prompt = PROMPT_VARIANTS[variant];
const trace = langfuse.trace({ name: "agent.invoke", metadata: { variant } });
```

#### Métricas a comparar

- Faithfulness por variante.
- Latencia por variante (un prompt más largo es más lento).
- Costo por variante (más tokens de input).
- Satisfaction (thumbs up rate) por variante.

Después de N días con tráfico significativo, comparas. Si la `variant` mejora satisfacción sin empeorar latencia ni costo en exceso, **promueves** y el control deja de existir.

#### Anti-patrones

- **A/B sin métrica clara.** "El prompt nuevo se siente mejor" no es testeable.
- **A/B con tráfico bajo.** Con < 1000 queries, las diferencias son ruido.
- **A/B sin asignación determinista por usuario.** Si el mismo usuario ve ambas variantes, contaminás los datos.
- **A/B que cambia más de una variable.** Si cambias prompt + modelo simultáneamente, no sabes cuál movió la aguja.

### 4.5. Gestión de costos

La factura mensual es la métrica que te despierta a las 3am.

#### Por qué los costos LLM se descontrolan

- **Tools que devuelven mucho contexto** que infla el prompt del siguiente turn.
- **Loops sin termination** (lo viste en S12).
- **Conversaciones largas sin truncamiento** del historial.
- **Reranking + RAG combinados** sin necesidad real (cada técnica suma una llamada LLM).

#### Mitigaciones canónicas

| Técnica | Reducción típica |
|---------|------------------|
| Cache de respuestas frecuentes (intent classification) | 30-60% |
| Modelos cheaper para sub-tasks (Flash/Haiku para classifier) | 40-70% en sub-task |
| Truncado de historial conversacional | 20-40% |
| Cap por usuario (max tokens/día) | bound, no reduction |
| Prompt caching nativo del proveedor (Anthropic, Gemini) | 50-90% en prompts repetitivos |

#### Implementación de cap

```typescript
async function checkUserBudget(userId: string, estimatedTokens: number) {
  const used = await redis.get(`budget:${userId}:${today()}`);
  if ((used ?? 0) + estimatedTokens > DAILY_USER_BUDGET) {
    throw new BudgetExceededError(`User ${userId} excedió budget diario`);
  }
}

await checkUserBudget(userId, 2000);
const result = await agent.invoke(query);
await redis.incr(`budget:${userId}:${today()}`, result.totalTokens);
```

#### Alertas

Configura alertas en Langfuse / tu APM cuando:
- CPQ promedio sube X% día sobre día.
- Algún usuario excede 10× el promedio en 1 hora.
- Cost total del día va a superar el budget mensual / 30.

### 4.6. Deployment patterns

#### Canary deployment

Desplegar la versión nueva al 5% del tráfico, monitorear KPIs, si están bien subir a 25%, después 100%. Permite detectar regresiones con bajo blast radius.

```yaml
# Docker Compose simplificado
services:
  agent-v1:
    image: tiendapro/agent:v1
    scale: 19  # 95% del tráfico
  agent-v2:
    image: tiendapro/agent:v2
    scale: 1   # 5% del tráfico
```

El load balancer rutea proporcionalmente.

#### Blue-green deployment

Dos environments idénticos. Nueva versión va a "green" mientras "blue" sirve. Cuando green pasa healthchecks, switch del LB. Rollback = re-switch.

**Pro:** rollback instantáneo.
**Contra:** requiere 2× infra durante el deploy.

#### Rolling update

Reemplazar instancias una a una. Default de Kubernetes Deployments.

**Pro:** simple, no requiere doble infra.
**Contra:** transición no es atómica; durante el deploy hay versiones mezcladas.

> **Para el integrador:** rolling update con healthcheck es suficiente. Canary tiene sentido cuando hay tráfico real y SLOs estrictos.

### 4.7. Variables de entorno y secretos

Reglas mínimas para producción:

- **Nunca hardcodear API keys.** En variables de entorno o vault (HashiCorp Vault, AWS Secrets Manager).
- **`.env` en `.gitignore`.** Solo committear `env.example` con valores placeholder.
- **Diferenciar dev / staging / prod.** Variables distintas, modelos potencialmente distintos (ej: stub LLM en staging).
- **Rotación periódica.** Cada 90 días para keys de proveedores LLM.
- **Mínimo privilegio.** El agente NO necesita la key del admin de la BD; necesita una con permisos read-only sobre las tablas que usa.

### 4.8. Healthchecks

Endpoint `/health` que verifica:
- Proceso corriendo (trivial).
- Conexión a la BD (pgvector responde).
- Llave de API válida (1 llamada cheap al LLM, ej: count tokens en string fijo).
- Cache (Redis si hay) responde.

Devuelve 200 si todo OK; 503 si algo falla. El LB usa esto para sacar instancias enfermas.

> **No incluyas el LLM call en el liveness probe** — un blip del proveedor saca todas tus instancias. El LLM va en `/ready`, no en `/health` (liveness).

## 5. Patrones y antipatrones

### Patrones

- **Langfuse desde el día 1.** No esperes a producción para sumar observabilidad.
- **Sessions y traces estructurados.** Sin esto, debug es imposible.
- **SLOs definidos antes del deploy.** Sin SLO, no hay alerta.
- **A/B testing con asignación determinista por user_id.** Mismo user → misma variante siempre.
- **Caps de costo por usuario.** Sin esto, un user malicioso puede gastar tu mes de presupuesto.
- **Healthchecks separados de liveness.** Liveness = "el proceso está vivo"; readiness = "puedo atender tráfico".

### Antipatrones

- **Logs sin structure.** Strings con `console.log` no son observabilidad.
- **Sin alertas en CPQ.** Te enteras cuando llega la factura.
- **Pushear cambios de prompt sin A/B.** Producción es donde se sabe si el prompt mejora.
- **Variables de entorno en config files committed.** Filtración de keys garantizada.
- **API key en logs.** Cuando logueas todo el request, la key viaja en headers.
- **Skip de healthchecks "porque tarda mucho".** El proveedor LLM en el liveness es bug.

## 6. Conexión con TiendaPro

Esta sesión cierra el Módulo 6 con producción real:

- **Langfuse instrumentado** en `src/agent/index.ts`. Cada `runAgent()` genera un trace con sub-spans por nodo.
- **A/B testing harness** en `evals/ab-testing.ts`: rutea queries a dos variantes de prompt, mide faithfulness y latencia comparativas.
- **Cost tracking** por `flow` (catalog/orders/escalation).
- **Dockerfile multi-stage** + `docker-compose.production.yml` con healthcheck, postgres y env management.
- **`/health` endpoint** mock (en demo standalone).

Todo opcional: si no configuras `LANGFUSE_*` en `.env`, el integrador sigue funcionando sin tracing externo.

## 7. Resumen

Tres ideas para llevarte:

1. **LLMOps no es DevOps con un LLM.** Agrega observabilidad de calidad, gestión de costos variables y monitoreo de drift. Cada uno es una capa nueva.
2. **A/B testing es el mecanismo para mejorar prompts en producción.** Sin métricas comparativas, los cambios son fe.
3. **Costo y calidad se compensan.** Sin SLOs explícitos y caps por usuario, el sistema entrega calidad inconsistente o factura impredecible.

## 8. Preguntas de auto-evaluación

1. Tu agente en producción tiene latencia p95 = 4s y CPQ = $0.05. Te piden bajar el CPQ 50% sin tocar la calidad. ¿Tres palancas que evalúas en orden?
2. Diferencia entre `trace`, `span` y `generation` en Langfuse. ¿Cuándo usarías cada uno?
3. A/B testing con 200 queries por variante. La diferencia de faithfulness es 2 puntos. ¿Es significativa? ¿Qué dato adicional pedis?
4. Tu canary al 5% muestra que la versión nueva tiene latencia 30% peor pero faithfulness 5% mejor. ¿Promueves, retrocedes o esperas? Justifica.
5. Diseña los 3 SLOs del integrador de TiendaPro. Argumenta cada número.
6. Tu factura de Gemini se duplicó este mes sin que el tráfico crezca. ¿Tres causas probables y qué dato pedis primero?

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 4 demos: Langfuse, A/B testing, cost tracking, deployment.

**Próxima sesión:** [`Lab — Productividad del AI Engineer`](../lab-productividad-ai-engineer/) → cierra el curso con SDD, MCPs, agentes para devs.
