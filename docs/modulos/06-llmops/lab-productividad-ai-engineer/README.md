# Lab — Productividad del AI Engineer: SDD, agentes, MCPs, skills

> **Módulo:** 6 — Despliegue y puesta en producción · **Duración estimada:** 2h (~70 min lectura + ~50 min práctica) · **Formato:** 70% teoría / 30% práctica

---

## 1. Objetivos de aprendizaje

Al terminar este lab podrás:

- Articular qué es **Spec-Driven Development (SDD)** y por qué se vuelve importante cuando trabajas con agentes que escriben código.
- Operar **Claude Code** como agente de programación: hooks, slash commands, skills, settings, agentes especializados.
- Entender el **Model Context Protocol (MCP)**: qué problema resuelve, cómo se diseña un server, ejemplos prácticos.
- Diseñar un **skill custom** para encapsular un workflow repetitivo en un agente.
- Reconocer los **patrones reales de productividad** que un AI Engineer aplica para construir sistemas (incluido este curso).

## 2. Prerequisitos

- **Todo el curso hasta S15.**
- Acceso a un agente de programación (Claude Code, Cursor, Copilot Workspace, etc).
- Comodidad usando la terminal y Git.

## 3. Conceptos clave

- **Spec-Driven Development (SDD):** disciplina donde antes de escribir código, escribís especificaciones (intent, requirements, scenarios) que el agente puede validar y usar como guía. Inversión del flujo "código primero, doc después".
- **Claude Code:** CLI agente de Anthropic para ingeniería de software. Tools nativas (Read/Write/Edit/Bash), hooks customizables, skills, sub-agentes especializados.
- **MCP (Model Context Protocol):** protocolo abierto de Anthropic para conectar LLMs con sistemas externos (BD, APIs, herramientas) de forma estructurada. Standard que evita que cada framework tenga su propio formato de tools.
- **Skill:** unidad reutilizable de capacidad para un agente. Tiene un trigger, instrucciones, posiblemente referencias a archivos. El agente carga el skill cuando detecta el contexto.
- **Slash command:** invocación explícita de un workflow (`/sdd-explore`, `/security-review`, `/loop`).
- **Hook:** shell command que se dispara en respuesta a eventos del agente (post-tool-call, before-prompt, etc). Permite extender el comportamiento sin tocar el agente.
- **Sub-agente:** agente especializado que el agente principal puede delegar tareas. Cada uno con su contexto, tools y system prompt.

## 4. Teoría

### 4.1. Por qué Spec-Driven Development importa con agentes

Cuando tú eres el único que escribe código, "lo escribo y después documento" funciona. La única persona que tiene que entender el intent eres tú.

Cuando un agente escribe código por vos, el problema cambia. El agente NO recuerda lo que conversaron ayer. El agente NO sabe por qué elegiste esta arquitectura. Si el intent vive en tu cabeza, el agente está pegando código a ciegas.

**SDD invierte el flujo:**

```
intent (markdown) → especificación (markdown) → diseño (markdown) → tareas → código
```

Cada paso es un artefacto inspeccionable. Cuando el agente lee la spec antes de codear, sus decisiones tienen ancla. Cuando tú lees el plan antes de aprobar, puedes vetar errores antes de que existan.

#### El ciclo SDD canónico

| Fase | Output | Quién decide |
|------|--------|--------------|
| `explore` | Investigación de opciones, comparativa | Tú (el agente investiga) |
| `propose` | Propuesta de change con trade-offs | Tú (el agente propone) |
| `spec` | Requirements y scenarios concretos | Tú (el agente formaliza) |
| `design` | Arquitectura del cambio | Tú (el agente diseña) |
| `tasks` | Checklist de implementación | El agente |
| `apply` | Código que implementa los tasks | El agente |
| `verify` | Validación de que el código cumple la spec | El agente + tests |
| `archive` | Cierre del cambio, persistencia | El agente |

Cada fase puede iterar. La idea es que problemas se detecten **antes** de codear, no después.

> **Para qué tipo de cambios usar SDD.** Para refactors grandes, features complejas, cambios arquitectónicos. NO para fix de typo o cambio mecánico — la sobrecarga no se justifica.

### 4.2. Claude Code como agente de programación

Claude Code es uno de los agentes más capaces hoy para ingeniería real. Tres aspectos que importan:

#### Hooks: extensibilidad sin tocar el agente

Un hook es un shell command que el agente ejecuta en eventos específicos. Configurado en `settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "pnpm lint $CLAUDE_FILE_PATHS"
          }
        ]
      }
    ]
  }
}
```

Después de cada `Write` o `Edit`, corre `pnpm lint` sobre los archivos tocados. Si falla, el agente lo ve y corrige.

#### Skills: capacidades empaquetadas

Un skill es un archivo markdown con frontmatter que describe **cuándo se activa**:

```markdown
---
name: schema-migration
description: |
  Trigger: cuando el usuario pide modificar un schema de Postgres
  o agrega una columna a una tabla existente.
---

Cuando se detecta este contexto:
1. Lee la migración actual.
2. Verifica que la columna nueva NO sea NOT NULL sin default.
3. Genera la migración como dual-write si es destructiva.
4. Nunca uses ALTER COLUMN en producción.
```

El agente carga el skill cuando detecta el trigger en el contexto. Permite que conocimiento de dominio sea reutilizable y versionado.

#### Sub-agentes y Agent Teams Lite

Un sub-agente es un agente con su contexto propio. El orquestador delega:

```
orchestrator (tú conversas con este)
   │
   ├─ explore-agent  (investiga, devuelve resumen)
   ├─ apply-agent    (implementa, devuelve diff)
   └─ verify-agent   (testea, devuelve report)
```

El orquestador infla menos su contexto al delegar. Cada sub-agente tiene tools acotadas a su tarea.

> **Patrón Agent Teams Lite.** Combina SDD + sub-agentes. Esta sesión y las anteriores fueron producidas con este patrón.

### 4.3. Model Context Protocol (MCP)

#### Qué problema resuelve MCP

Antes de MCP, cada framework de agentes tenía su propio formato de tools (Vercel AI SDK, LangChain, OpenAI Assistants — todos distintos). Si querías que tu agente acceda a Postgres, tenías que escribir un wrapper para cada framework.

**MCP es un protocolo estandarizado.** Un "MCP server" expone tools en un formato común. Cualquier "MCP client" (Claude Code, Cursor, Continue, etc) puede conectarse y usar esas tools.

#### Anatomía de un MCP server

```typescript
import { McpServer } from "@modelcontextprotocol/sdk";

const server = new McpServer({ name: "tiendapro-agent", version: "1.0" });

server.tool(
  "searchCatalog",
  "Busca productos en el catálogo de TiendaPro.",
  { query: { type: "string" } },
  async ({ query }) => {
    const results = await db.searchProducts(query);
    return { content: [{ type: "text", text: JSON.stringify(results) }] };
  },
);

server.start();
```

Cualquier MCP client puede ahora consumir `searchCatalog`. Cuando agregás un cliente nuevo (Cursor el lunes, Claude Code el martes), no toca tu código del server.

#### Cuándo escribir un MCP server propio

- **Datos privados que tu equipo consulta seguido** (BD interna, wiki, herramientas de tickets).
- **APIs internas que quieres que cualquier agente del equipo pueda usar.**
- **Workflows complejos que componen múltiples APIs y conviene encapsular.**

NO escribas MCP para lo que ya existe (Postgres, GitHub, Slack — todos tienen MCP servers oficiales o de la comunidad).

#### Catálogo de MCPs útiles

- **filesystem** (oficial Anthropic) — leer/escribir archivos del sandbox.
- **postgres** — queries SQL.
- **github** — issues, PRs, code search.
- **slack** — mensajes y canales.
- **fetch** — peticiones HTTP genéricas.
- **memory** (oficial) — el "engram" de Claude Code: persistencia de hechos entre sesiones.

### 4.4. Workflow real de un AI Engineer (cómo se hizo este curso)

El curso entero (~16K líneas, 6 módulos, 21 sesiones, 5 hitos del integrador) se produjo con un patrón replicable. Ahora que termina, vale la pena hacerlo explícito:

#### Fase 0: scoping

- Conversación con humano para entender objetivos, audiencia, formato.
- Escribir el currículo maestro (`docs/00-curriculum.md`).
- Decisiones arquitectónicas grandes (TS-first híbrido, Vercel AI SDK como abstracción, multi-provider, etc).

#### Fase 1: producción de cada sesión

Por cada sesión:

1. **Plan corto** — 2-3 minutos. Confirmar alcance, decisiones de stack, demos a producir.
2. **README** (60-70% del esfuerzo) — teoría con ejemplos, decisiones argumentadas, antipatrones explícitos, conexión con el integrador.
3. **Ejercicios** — demos ejecutables, comentarios pedagógicos, "para reflexionar" sections.
4. **Recursos** — bibliografía curada con links a papers, docs oficiales, charlas.
5. **Código TS** — paquete pnpm autocontenido, type-check limpio, cero dependencias innecesarias.
6. **Voseo gate** — grep estricto contra voseo rioplatense antes del commit.
7. **Type-check del workspace** — `pnpm -r run type-check` sobre todos los paquetes.
8. **Commit** — conventional commits, mensaje descriptivo.

#### Fase 2: integrador por módulo

Al final de cada módulo (M1-M5), un commit que conecta lo aprendido al producto integrador (TiendaPro):

- M1 → "hola soy el asistente"
- M2 → personalidad + memoria + intent
- M3 → catálogo en pgvector
- M4 → RAG con citas validadas
- M5 → multi-agente con LangGraph
- M6 → producción con Langfuse + Docker

#### Fase 3: rituales transversales

- **Memoria persistente (engram).** Cada sesión arranca leyendo session_summary previo. Cada sesión termina con session_summary nuevo.
- **Decisiones documentadas.** Cuando se eligió pgvector sobre Qdrant, hybrid sobre dense puro, LangGraph sobre Mastra, queda escrito **el porqué**.
- **Voseo gate.** Sin esto, el español rioplatense aparece automático en cada sesión y degrada la consistencia del curso.

> **El metanivel:** este curso te enseñó a construir sistemas con AI. El proceso de producción usó AI para construirlo. La inversión es deliberada: AI engineering aplicado a AI engineering.

### 4.5. Patrones de productividad que se generalizan

#### Patrón 1: paralelismo de agentes

Cuando hay tareas independientes (investigar tres opciones de DB vectorial, leer cinco archivos para entender el codebase), lanza agentes en paralelo. Cada uno con su contexto chico, devuelve resumen al orquestador.

#### Patrón 2: aislar contexto

El contexto del orquestador es caro. Cualquier cosa que NO tenga que aterrizar ahí, va a un sub-agente. Lectura masiva de archivos, exploración de código, búsqueda web — todo en sub-agentes.

#### Patrón 3: skills en lugar de instrucciones repetidas

Si te encuentras explicando el mismo workflow al agente cada semana, escríbelo como skill.

#### Patrón 4: hooks para garantías invariantes

"Después de cada Edit, corré lint." "Después de cada commit, corré tests." Esto es hook, no instrucción al agente. El agente puede olvidar; el hook no.

#### Patrón 5: SDD para cambios grandes, freestyle para cambios chicos

No metas SDD para fix de typo. Reservalo para refactors, features no-triviales, cambios arquitectónicos.

### 4.6. Cómo seguir aprendiendo

Este curso terminó. La industria no.

- **Suscribite a 1-2 newsletters de calidad.** Recomendados: [Eugene Yan](https://eugeneyan.com/), [Chip Huyen](https://huyenchip.com/), [Latent Space podcast](https://www.latent.space/), [Anthropic blog](https://www.anthropic.com/news).
- **Lee papers selectivamente.** Una decena por año, no más. Calidad > cantidad. arXiv-sanity ayuda.
- **Construí cosas chicas.** Side projects con LLMs son la forma más rápida de no oxidarse.
- **Compartí lo que aprendés.** Un blog post mensual cuesta poco y te clarifica el pensamiento.
- **No persigas el último framework.** Cada 3 meses sale uno nuevo. Profundiza en lo que tienes.

## 5. Patrones y antipatrones

### Patrones

- **SDD para cambios grandes.** Spec antes de código en refactors y features.
- **Sub-agentes para tareas independientes.** Aislamiento de contexto.
- **Skills para workflows repetitivos.** Capacidades versionadas.
- **Hooks para garantías invariantes.** Lint, tests, format — no le pidas al agente recordarlos.
- **Memoria persistente desde el día 1.** El curso usó engram desde la primera sesión; sin esto, las sesiones largas pierden contexto.
- **Aprende con proyectos reales, no con tutoriales.** Tutoriales son tres horas; lo que aprendiste resolviendo un bug raro queda años.

### Antipatrones

- **SDD para todo.** Sobrecarga matemática para cambios chicos.
- **Sub-agente sin briefing claro.** El sub-agente arranca de cero; necesita contexto explícito.
- **Skills genéricos.** Si el skill es "ayúdame a programar", no aporta. Skills son específicos.
- **Hooks que ralentizan demasiado.** Si cada Edit ejecuta un build de 30 segundos, vas a bypassearlo.
- **Frameworks de agentes "porque son lo nuevo".** Mismo error que en cualquier stack.
- **Aprender el último modelo todas las semanas.** Los fundamentos cambian poco; los modelos cambian todo el tiempo.

## 6. Conexión con TiendaPro

Este lab no agrega capacidades al integrador. Cierra el curso reflexionando sobre el proceso de construirlo.

Si quieres llevar esto al siguiente nivel:

- **Convertí TiendaPro en un MCP server** que cualquier agente externo (Claude Code, Cursor) pueda consultar.
- **Escribí un skill** para que tu agente entienda cuándo aplicar el patrón "supervisor multi-agente con LangGraph" en otros proyectos.
- **Documentá tus decisiones del curso** como ADRs (Architecture Decision Records) en un repo nuevo.

Cualquier de los tres es buen primer side project post-curso.

## 7. Resumen

Tres ideas para llevarte:

1. **Cuando trabajas con agentes, las specs no son opcionales.** Lo que vivía en tu cabeza ahora tiene que ser texto explícito.
2. **MCP es el primer protocolo serio que estandariza tools de agentes.** Vale la pena conocerlo aunque no escribas un server hoy.
3. **Productividad con AI no es "más rápido haciendo lo mismo".** Es **otras cosas posibles**: paralelismo, exploración masiva, sub-agentes especializados. Lo que era difícil ahora es trivial; lo que era imposible ahora es difícil pero hacedero.

## 8. Preguntas de auto-evaluación

1. Tu equipo decide adoptar Claude Code para los proyectos del año. ¿Qué tres convenciones de equipo escribirías el primer día? Justifica cada una.
2. Diferencia operativa entre un **slash command** y un **skill** en Claude Code. Da un ejemplo de cada uno.
3. Te piden escribir un MCP server para una API interna de tickets. Lista los 5 pasos del scaffold mínimo y qué decisiones de diseño tomas en cada uno.
4. SDD agrega tiempo upfront. Da tres argumentos a favor y dos en contra. ¿En qué tipo de equipos cada lado es más fuerte?
5. Tu equipo discute si entrenar un agente custom o usar Claude Code con skills. Argumenta cada lado con tres puntos técnicos.
6. Después de este curso, ¿cuál es el primer side project que harías? Define alcance (1 semana de trabajo), stack y métrica de éxito.

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 2 demos: MCP server mínimo + skill custom.

**Cierre del curso:** después de este lab cerramos el integrador con tag `proyecto-m6` y agregamos un resumen final del curso al README principal del repo.
