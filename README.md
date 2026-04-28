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
| BBDD vectorial | PostgreSQL + pgvector (principal), Qdrant, Pinecone, Chroma (comparativa) |
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
5. El código de cada sesión vive en `code/mMM-modulo/sesion-NN/`.
6. El proyecto integrador (agente de soporte e-commerce) vive en `code/proyecto-integrador/` y se construye módulo a módulo.

## Estructura del repo

```
.
├── docs/
│   ├── 00-curriculum.md          ← diseño curricular maestro
│   ├── 01-setup.md
│   ├── 02-python-para-js-devs.md
│   ├── modulos/
│   │   ├── 01-fundamentos/
│   │   ├── 02-cag/
│   │   ├── 03-data-driven/
│   │   ├── 04-rag/
│   │   ├── 05-agentes/
│   │   └── 06-llmops/
│   └── proyectos/
├── code/
│   ├── m01-fundamentos/
│   ├── m02-cag/
│   ├── m03-data-driven/
│   ├── m04-rag/
│   ├── m05-agentes/
│   ├── m06-llmops/
│   └── proyecto-integrador/
├── docker-compose.yml
└── env.example                   ← copiar a .env (ver docs/01-setup.md)
```

## Mapa de los 6 módulos

1. **Fundamentos de productos con IA** — qué es un AI Engineer, panorama LLM, primera llamada API.
2. **Arquitecturas CAG (Cache Augmented Generation)** — wrappers de modelos, gestión de contexto, productos conversacionales.
3. **Data-driven AI** — embeddings, BBDD vectoriales, normalización de datos.
4. **Arquitectura RAG** — retrieval, reranking, generación con citas, evaluación de calidad.
5. **Orquestación de agentes** — function calling, LangGraph, multi-agente.
6. **Despliegue y puesta en producción** — LLMOps, observabilidad, costes, Spec-Driven Development.

Detalle completo en [`docs/00-curriculum.md`](docs/00-curriculum.md).

## Estado del curso

🚧 **En desarrollo.** Las sesiones se publican en orden. Cada commit corresponde a una sesión completa o un hito del repo.

## Licencia

Material educativo. Compártelo, mejóralo, critícalo.
