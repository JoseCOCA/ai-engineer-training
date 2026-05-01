---
name: curso-ai-conventions
description: |
  Trigger: cuando el agente está trabajando en el repo `curso-ai`
  (cualquier path bajo `docs/modulos/`, `code/m0[1-6]-*/`,
  `code/proyecto-integrador/`).

  Aplica las convenciones pedagógicas y técnicas usadas para
  producir el curso AI Engineer.
---

## Convenciones del repo `curso-ai`

### Idioma y tono

- **Español neutro estricto.** Cero voseo rioplatense.
  - Sí: "puedes", "tienes", "haces", "deci la verdad" → "di la verdad".
  - No: "podés", "tenés", "hacés", "decí".
  - Antes de cada commit: `grep -nE "\b(decí|tenés|querés|podés|sabés|hacés|sos)\b" docs/...` en los archivos modificados.

- **Tono profesional, directo, pedagógico.** Sin slang, sin jerga regional.

### Estructura de cada sesión

```
docs/modulos/MM-modulo-slug/sesion-NN.X-tema-slug/
├── README.md       — teoría 60% + estructura por secciones
├── ejercicios.md   — demos prácticos con scripts
└── recursos.md     — bibliografía curada
```

```
code/mMM-modulo-slug/sesion-NN.X/
├── package.json    — paquete pnpm autocontenido
├── tsconfig.json   — strict, ESM, noEmit
└── src/            — demos con sufijo numérico (01-, 02-, etc)
```

### Patrón pedagógico de cada README

1. Objetivos de aprendizaje (lista de bullets accionables).
2. Prerequisitos.
3. Conceptos clave (glosario corto).
4. Teoría (sub-secciones 4.1, 4.2... con ejemplos y antipatrones).
5. Patrones y antipatrones (lista explícita).
6. Conexión con TiendaPro (qué cambia en el integrador).
7. Resumen (3 ideas para llevarse).
8. Preguntas de auto-evaluación (6 preguntas, no triviales).

### Convenciones de código

- **TypeScript estricto.** `tsconfig` con `strict: true`, `noEmit: true`.
- **Type-check obligatorio antes del commit:** `pnpm -r run type-check`.
- **Conventional commits.** `feat(...)`, `fix(...)`, `chore(...)`, `docs(...)`.
- **Sin Co-Authored-By ni atribución AI** en los commits.
- **Sin comments innecesarios.** El código debe leerse solo.

### Workspaces

- pnpm workspaces. Cada sesión es un paquete autocontenido.
- Compartido: `code/packages/llm/` (`@curso-ai/llm`) — abstracción multi-provider.
- Integrador: `code/proyecto-integrador/` (`@curso-ai/proyecto-integrador`) — TiendaPro.

### Hitos y tags

- Cada módulo cierra con un commit `feat(proyecto-integrador): cierra Módulo N`.
- Tag `proyecto-m{N}` por hito (`proyecto-m1` a `proyecto-m6`).

### Stack canónico

- LLM cloud default: Gemini 2.5 Flash (free tier amplio).
- LLM local: Ollama (qwen2.5:7b u otros).
- Embeddings: gemini-embedding-001 (768D).
- Vector DB: pgvector sobre Postgres.
- Frameworks de agentes: bare metal Vercel AI SDK (M5 S12) + LangGraph.js (M5 S13.2+).
- Evals: Promptfoo (CI) + RAGAS (nightly opcional).
- Observabilidad: Langfuse.

### Cuando producís una sesión nueva

1. Plan corto en 2-3 sentencias antes de codear.
2. Producir README → ejercicios → recursos → código (en ese orden).
3. Voseo gate con grep antes del commit.
4. Type-check del workspace completo.
5. Commit conventional + descriptivo.
6. Si es cierre de módulo: actualizar `code/proyecto-integrador/README.md` + tag.
