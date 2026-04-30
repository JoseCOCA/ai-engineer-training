# Sesión 13.1 — Framework vs construir el tuyo

> **Módulo:** 5 — Orquestación de agentes · **Duración estimada:** 1h (~30 min lectura + ~30 min práctica) · **Formato:** 60% teoría / 40% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión podrás:

- Comparar **bare metal** (Vercel AI SDK + tu loop) contra **frameworks** (LangGraph, OpenAI Assistants, Mastra, Pydantic AI) en líneas de código, debugabilidad y portabilidad.
- Identificar las **señales** de cuándo el framework justifica su costo: complejidad del flujo, persistencia, observabilidad, multi-agente.
- Reconocer los **costos ocultos** de adoptar un framework: aprendizaje, lock-in, abstracciones que oscurecen bugs, dependencias.
- Tomar una decisión **fundamentada** sobre qué adoptar para un proyecto concreto.

## 2. Prerequisitos

- **S12 completa.** Entender el agent loop manual con Vercel AI SDK.
- Tener al menos un agente bare metal corriendo localmente.

## 3. Conceptos clave

- **Bare metal:** implementación con SDK del modelo + tu propio loop. Sin framework de agentes encima. Lo que hicimos en S12.
- **Framework de agentes:** librería que abstrae el loop, el manejo de estado, las transiciones, el tool calling, la observabilidad. Ejemplos: LangGraph, Mastra, Pydantic AI.
- **Servicio managed:** infraestructura externa que ejecuta agentes. Ejemplo: OpenAI Assistants API. Vos defines tools y prompts; ellos corren el loop.
- **Persistencia (checkpointing):** guardar el estado del agente entre invocaciones. Sin esto, cada conversación arranca de cero. Frameworks suelen incluirlo.
- **Lock-in:** dependencia conceptual y operativa de un framework. Cambiarlo después implica reescribir gran parte del código.
- **Abstracción que oscurece:** cuando el framework hace tantas cosas implícitas que es imposible saber qué pasó cuando algo falla.

## 4. Teoría

### 4.1. ¿Qué hace un framework de agentes que tú no estás haciendo?

Mirá lo que tu loop manual de S12 cubre:

- ✅ Tool calling (vía Vercel AI SDK).
- ✅ Loop con max_iter, timeout, token budget.
- ✅ Logging básico vía `onStep`.
- ✅ Termination conditions múltiples.

Lo que un framework típicamente agrega:

- 🟡 **Persistencia de estado entre invocaciones.** Sin esto, cada llamada arranca limpia. Útil para conversaciones multi-turno largas o agentes que dura horas/días.
- 🟡 **Grafo declarativo de transiciones.** En lugar de `if intent === "X" then call worker A`, defines nodos y aristas en un DSL. Fundamental cuando hay 10+ branches.
- 🟡 **Time travel / replay.** Volver a un step previo, modificar inputs, re-ejecutar. Útil para debug y para HITL.
- 🟡 **Observabilidad estructurada.** Cada step se loguea con metadata, integrable directo a Langfuse/LangSmith.
- 🟡 **Multi-agente.** Patrones de supervisor, hierarchical, network — el framework te da las primitivas.
- 🟡 **Streaming intermedio.** Streamear los pasos del agente al frontend en tiempo real, no solo la respuesta final.

> **Pregunta operativa:** ¿alguna de las 🟡 es crítica para tu producto? Si dos o más → el framework probablemente vale la pena. Si ninguna → bare metal es más sano.

### 4.2. Comparativa: las cuatro opciones reales en TS

#### Opción A — Bare metal (Vercel AI SDK + tu loop)

Lo que hicimos en S12. El SDK te da `generateText`, `tool`, `streamText`. El resto lo orquestas tú.

| | |
|---|---|
| **Líneas de código** | Pocas para el loop básico (~80 líneas). Crece linealmente con la complejidad. |
| **Curva de aprendizaje** | Mínima. Si conoces el SDK, ya está. |
| **Lock-in** | Bajo. El loop es código tuyo. Migrar de proveedor LLM es una línea. |
| **Persistencia** | Tu responsabilidad. |
| **Observabilidad** | Tu responsabilidad (loguea lo que quieras). |
| **Multi-agente** | Tu responsabilidad (más loops anidados o orquestados). |
| **Cuándo elegir** | MVPs, prototipos, agentes simples (1-3 tools, flujo lineal). |

#### Opción B — LangGraph.js

Framework de orquestación basado en grafos. El agente es un `StateGraph` con `nodes` y `edges`. Lo cubrimos a fondo en S13.2.

| | |
|---|---|
| **Líneas de código** | Más boilerplate inicial, pero crece sub-linealmente con complejidad. |
| **Curva de aprendizaje** | Media. Conceptos: StateGraph, nodes, edges, conditional edges, checkpointers. |
| **Lock-in** | Medio. La definición del grafo es código LangGraph; las tools y nodes son funciones que puedes migrar. |
| **Persistencia** | First-class (checkpointers para Memory, SQLite, Postgres). |
| **Observabilidad** | First-class (LangSmith integrado, exportable a otros). |
| **Multi-agente** | First-class (supervisor, hierarchical, network). |
| **Cuándo elegir** | Agentes complejos con flujos no lineales, multi-turno, HITL, observabilidad estructurada. |

#### Opción C — OpenAI Assistants API

Servicio managed: vos defines tools, prompts y archivos; OpenAI corre el loop en su infra.

| | |
|---|---|
| **Líneas de código** | Mínimas. Vos solo defines y consultas. |
| **Curva de aprendizaje** | Baja. APIs simples. |
| **Lock-in** | Alto. Lock-in de proveedor (OpenAI). Migrar a Anthropic implica reescribir el agente. |
| **Persistencia** | First-class (threads). |
| **Observabilidad** | Limitada (lo que el dashboard de OpenAI te muestra). |
| **Multi-agente** | No nativo. |
| **Cuándo elegir** | Equipos sin presupuesto de infra, OpenAI ya en stack, agente simple. |

#### Opción D — Mastra (TS-first, opensource)

Framework relativamente nuevo, opensource, optimizado para TS. Combina algunas ideas de LangGraph con APIs más concisas.

| | |
|---|---|
| **Líneas de código** | Comparable a LangGraph, sintaxis más TS-idiomática. |
| **Curva de aprendizaje** | Media-baja si vienes de TS. |
| **Lock-in** | Medio. |
| **Persistencia** | First-class. |
| **Observabilidad** | Integrada (incluye dashboard propio). |
| **Multi-agente** | First-class. |
| **Cuándo elegir** | Equipos que quieren un framework TS nativo y aceptan que aún es joven. |

#### Otras menciones

- **Pydantic AI** (Python): muy buen DX en Python con type safety fuerte. Si tu stack es Python, considéralo serio.
- **CrewAI**, **AutoGen**, **AgentForge**: frameworks de "multi-agente by default". Más opinionados, menos flexibles.

### 4.3. Cuándo el framework justifica su costo

Tres preguntas operativas que ayudan a decidir:

#### Pregunta 1: ¿Cuántos branches condicionales tiene tu agente?

```
0-2 branches  → bare metal sobra.
3-5 branches  → frontera. Bare metal funciona pero el código se vuelve un if-else gigante.
6+ branches   → framework con grafo declarativo gana claramente.
```

Ejemplo: un agente de soporte que rutea entre `consulta_catalogo`, `consulta_pedido`, `escalation`, `out_of_scope` tiene 4 branches. Está en la frontera.

#### Pregunta 2: ¿Necesitas persistencia entre invocaciones?

```
"Cada query es independiente" → no necesitas persistencia → bare metal sobra.
"Una conversación dura 1 hora" → persistencia útil → framework gana.
"Un agente trabaja en background por días" → persistencia obligatoria → framework gana fuerte.
```

#### Pregunta 3: ¿Vas a operar esto en producción con SLA?

```
"Es un experimento / interno" → bare metal sobra.
"Es producto con usuarios reales" → observabilidad estructurada importa → framework con LangSmith/Langfuse pre-integrado vale.
```

> **Heurística agregada:** suma los puntos. 0-1 puntos → bare metal. 2 puntos → frontera, decide por aprendizaje del equipo. 3 puntos → framework.

### 4.4. Costos ocultos de adoptar un framework

#### Costo 1: la abstracción que oscurece

Cuando el framework hace algo implícito (mergea estados, retry implícito, cachea resultados), debugar un fallo significa entender QUÉ hizo el framework antes de poder arreglarlo. La regla "cuando algo falla, leer la lib" se cumple antes de lo que crees.

#### Costo 2: dependencias que rotan

Frameworks de agentes evolucionan rápido. LangGraph 0.2 a 0.3 cambió APIs centrales. Mastra está en beta. OpenAI Assistants v1 → v2 también rompió integraciones. Tu costo no es solo aprender el framework hoy — es **mantenerse al día**.

#### Costo 3: lock-in conceptual

Después de seis meses con LangGraph, tu equipo "piensa en grafos". Volver a bare metal o cambiar a otro framework requiere reescribir mental y físicamente. Esto no es siempre malo (la abstracción puede ser correcta) pero es real.

#### Costo 4: dependencias que no necesitabas

LangGraph trae LangChain como dep. LangChain trae 50+ integraciones que probablemente no usás. Tu bundle / docker image crece.

### 4.5. Decisión consciente para el curso

Para el curso vamos a usar **bare metal en S12** y **LangGraph.js en S13.2-S13.3**. La razón es pedagógica: queremos que entiendas qué hace el framework antes de adoptarlo.

**Para tu próximo proyecto real**, la decisión depende del proyecto. La tabla siguiente es nuestra recomendación canónica:

| Proyecto | Recomendación |
|----------|---------------|
| MVP de chatbot con 1-2 tools, flujo lineal | Bare metal |
| Asistente conversacional con RAG + 3-4 tools | Bare metal o framework, depende del equipo |
| Agente con flujo no-lineal, HITL, persistencia | LangGraph.js |
| Multi-agente con 5+ workers especializados | LangGraph.js o Mastra |
| Equipo con stack 100% Python | Pydantic AI o LangGraph (Python) |
| Necesitas zero-ops, OpenAI ya está | OpenAI Assistants |

### 4.6. Cómo migrar bare metal → framework sin dolor

Si arrancás bare metal (S12) y después necesitás framework (S13+), la migración no es de cero. Tres principios:

1. **Aísla tools y system prompts en módulos puros.** Sin importar SDK específicos. Las tools de S12 funcionan idénticas en LangGraph.
2. **Aísla la lógica de negocio del orquestador.** Si tu lógica está mezclada con el loop, migrar duele.
3. **Tests sobre el contrato del agente, no sobre el orquestador.** "Dado este input, espera este output" es portable. "El step 2 del loop emite X" no es portable.

> **Regla:** un agente bien diseñado en bare metal se puede migrar a LangGraph en una tarde. Si la migración te toma una semana, el problema no es el framework, es que la lógica estaba acoplada al loop.

## 5. Patrones y antipatrones

### Patrones

- **Empezar bare metal hasta sentir el dolor del flujo no-lineal.** Solo migrar cuando el dolor es claro.
- **Aislar tools en módulos puros** sin dependencia del orquestador. Permite migración fácil.
- **Probar la portabilidad antes de comprometerse.** Reescribir 1 caso del bare metal a LangGraph antes de migrar todo. Si el caso simple ya duele, replantear.
- **Preferir frameworks que NO se interpongan en el LLM call.** LangGraph llama directo al SDK del proveedor. Frameworks que envuelven el call agregan latencia y dificultan debug.

### Antipatrones

- **Adoptar framework "porque es lo que se usa".** Sin caso de negocio, agregás complejidad sin valor.
- **Mezclar dos frameworks en el mismo agente.** Pesadilla operativa.
- **No leer el código del framework cuando algo rompe.** Si vas a usar abstracciones, tienes que conocerlas.
- **Migrar de framework cada 6 meses persiguiendo el último hot.** Cada migración consume capital de equipo.
- **Decidir framework por marketing.** Mide en tu caso, no en demos curados.

## 6. Conexión con TiendaPro

S13.1 no modifica el integrador, pero **establece la decisión arquitectónica del módulo**: el integrador en M5 va a usar **LangGraph.js** para el supervisor multi-agente (S14.2), no bare metal.

¿Por qué LangGraph para el integrador y no bare metal?

- **5+ branches** (catalog, orders, escalation, out_of_scope, RAG) → grafo declarativo gana.
- **Persistencia útil** (conversaciones multi-turno) → checkpointer first-class vale.
- **HITL en S14.2** → el patrón está bien soportado en LangGraph.
- **Observabilidad** → integración Langfuse/LangSmith es directa.

Pero esto es decisión **deliberada para el integrador**, no recomendación universal. Para un MVP simple, bare metal sigue siendo la respuesta correcta.

## 7. Resumen

Tres ideas para llevarte:

1. **Framework no es siempre la respuesta.** Empieza bare metal, mide tu dolor, adopta framework cuando ese dolor justifique el costo.
2. **El framework no te exime de entender el loop.** Si no podes implementarlo a mano, no podes debuggearlo cuando falla.
3. **Aísla tools y lógica de negocio del orquestador.** Es lo único que sobrevive cuando cambias de framework.

## 8. Preguntas de auto-evaluación

1. Tu equipo va a construir un asistente para gestionar 12 tipos distintos de incidentes (cada uno con su flow). ¿Bare metal o framework? Justifica con dos argumentos.
2. Tu bare metal de S12 funciona perfecto en producción con 1000 usuarios. Te piden agregar persistencia para que las conversaciones duren días. ¿Refactorizas a LangGraph? ¿Qué alternativas evaluás antes?
3. Diferencia conceptual entre LangGraph y OpenAI Assistants. ¿En qué caso de negocio cada uno es claramente superior?
4. Lista tres "costos ocultos" de adoptar LangGraph que el README destaca. Da un ejemplo concreto de cada uno.
5. Tu equipo migra de bare metal a LangGraph y la migración tarda 2 semanas. ¿Qué dato te dice eso sobre la calidad del bare metal anterior?
6. Te piden que el agente del integrador soporte streaming intermedio (mostrar al usuario "estoy buscando productos..." en tiempo real). ¿Cómo abordas esto en bare metal vs LangGraph?

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → comparativa de implementación lado a lado.

**Próxima sesión:** [`S13.2 — LangGraph y grafos de ejecución`](../sesion-13.2-langgraph-grafos/) → primer agente real con LangGraph.js.
