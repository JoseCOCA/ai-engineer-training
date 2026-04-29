# Curso AI Engineer

Curso completo de AI Engineer construido como **repositorio público de aprendizaje**: documentación en Markdown + ejercicios hands-on + un proyecto integrador acumulativo (agente de soporte para e-commerce) que crece sesión a sesión.

> **Filosofía del curso:** conceptos antes que código. Diseño antes que framework. Entender antes que copiar.

---

## ¿A quién está dirigido?

- Ingenieros de software con experiencia (idealmente backend) que quieren entrar a AI Engineering sin volverse data scientists.
- Asume conocimiento sólido de programación, APIs REST, bases de datos relacionales y arquitectura de software.
- **No asume Python**: el curso es **TypeScript-first híbrido** — usamos TS donde se puede (la mayor parte del trabajo de un AI Engineer hoy) y Python solo donde es estrictamente necesario.

## Stack

| Capa | Tecnología |
|------|-----------|
| Lenguajes | TypeScript (principal), Python (puntual) |
| LLM proveedores | Ollama (local), Google Gemini (free tier), Anthropic Claude (comparativa), OpenAI (comparativa) |
| Capa de abstracción | **Vercel AI SDK** — proveedor-agnóstico desde el día 1 |
| App framework | LangChain.js, LangGraph.js |
| BBDD vectorial | PostgreSQL + pgvector (principal), Qdrant (comparativa) |
| Observabilidad | Langfuse (principal), LangSmith, Logfire |
| Evaluación | Promptfoo, RAGAS, DeepEval |
| Deployment | Docker, docker-compose, Cloud Run / Railway |

Todo lo necesario corre **localmente** vía `docker-compose`.

## Cómo usar este repo

1. Empieza por [`docs/00-curriculum.md`](docs/00-curriculum.md) — el diseño curricular maestro. **Léelo antes de tocar código.**
2. Sigue con [`docs/01-setup.md`](docs/01-setup.md) — instalación y configuración del entorno.
3. Si vienes de JS/TS sin Python, lee [`docs/02-python-para-js-devs.md`](docs/02-python-para-js-devs.md).
4. Recorre los módulos en orden. Cada sesión vive en `docs/modulos/MM-modulo/sesion-NN-tema/` y tiene:
   - `README.md` — teoría
   - `ejercicios.md` — práctica guiada
   - `recursos.md` — lecturas y referencias
5. El código de cada sesión vive en `code/mMM-modulo/sesion-NN/` (sandbox autónomo, clonable y ejecutable aisladamente).
6. El proyecto integrador (agente de soporte e-commerce) vive en `code/proyecto-integrador/` y se construye módulo a módulo.

## Estructura del repo

```
.
├── docs/
│   ├── 00-curriculum.md             ← diseño curricular maestro
│   ├── 01-setup.md
│   ├── 02-python-para-js-devs.md
│   └── modulos/
│       ├── 01-fundamentos/
│       ├── 02-patrones-llm/
│       ├── 03-embeddings/
│       ├── 04-rag/
│       ├── 05-agentes/
│       └── 06-llmops/
├── code/                            ← monorepo pnpm workspace
│   ├── 00-setup-check/              ← smoke test del entorno
│   ├── packages/
│   │   └── llm/                     ← @curso-ai/llm (frontera consolidada en M2)
│   ├── m01-fundamentos/             ← sandboxes por sesión (autocontenidos)
│   ├── m02-patrones-llm/
│   ├── m03-embeddings/
│   ├── m04-rag/
│   ├── m05-agentes/
│   ├── m06-llmops/
│   └── proyecto-integrador/         ← TiendaPro, consume @curso-ai/llm
├── pnpm-workspace.yaml
├── docker-compose.yml
└── env.example                      ← copiar a .env (ver docs/01-setup.md)
```

**Nota:** los sandboxes de cada sesión (`code/mMM-modulo/sesion-NN/`) son **autocontenidos**: tienen su propio `package.json` y duplican la abstracción multi-provider para que el alumno pueda clonar/copiar una sesión y correrla aisladamente. El proyecto integrador, en cambio, consume el package compartido `@curso-ai/llm` para evolucionar sin duplicación entre sesiones.

## Mapa de los 6 módulos

1. **Fundamentos de productos con IA** — qué es un AI Engineer, panorama LLM, primera llamada API. *(cerrado, tag `proyecto-m1`)*
2. **Patrones de aplicaciones LLM** — wrappers, prompts estructurados, contexto, memoria conversacional, guardrails. *(cerrado, tag `proyecto-m2`)*
3. **Embeddings y búsqueda vectorial** — chunking, embeddings, BBDD vectoriales, búsqueda semántica.
4. **Arquitectura RAG** — retrieval, reranking, generación con citas, evaluación de calidad.
5. **Orquestación de agentes** — function calling, LangGraph, multi-agente.
6. **Despliegue y puesta en producción** — LLMOps, observabilidad, costes, Spec-Driven Development.

Detalle completo en [`docs/00-curriculum.md`](docs/00-curriculum.md).

## Estado del curso

🚧 **En desarrollo.** Las sesiones se publican en orden. Cada commit corresponde a una sesión completa o un hito del repo.

## Setup rápido

```bash
# 1. Configura el .env (al menos un proveedor LLM)
cp env.example .env

# 2. Instala todas las dependencias del workspace
pnpm install

# 3. Verifica que el entorno funciona
pnpm run smoke-test

# 4. Corre el proyecto integrador en su estado actual
pnpm dev
```

## Licencia

Este repositorio usa **licenciamiento dual** para distinguir entre código y contenido pedagógico:

- **Código** — todo lo que vive en `code/`, los bloques de código dentro de la documentación, y los archivos de configuración (`package.json`, `docker-compose.yml`, `env.example`, etc.) está licenciado bajo [**MIT**](LICENSE). Libre uso comercial y privado con atribución.
- **Contenido pedagógico** — `README.md`, todo lo que vive en `docs/` y el material escrito de las sesiones está licenciado bajo [**Creative Commons Attribution 4.0 International (CC BY 4.0)**](LICENSE-CONTENT). Libre uso comercial y derivados con atribución obligatoria al autor.

**Atribución sugerida si reutilizas el material:**

> "Curso de AI Engineer" por José Coca, licenciado bajo CC BY 4.0.
> Fuente: https://github.com/JoseCOCA/ai-engineer-training
