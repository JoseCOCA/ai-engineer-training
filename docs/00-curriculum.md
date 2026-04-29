# 00 — Diseño curricular maestro

> **Léeme primero.** Este documento define el curso entero: a quién va dirigido, qué vas a aprender, en qué orden, con qué stack y cómo se evalúa. Sin esto leído, los módulos individuales pierden contexto.

---

## 1. Filosofía del curso

El curso se construye sobre tres principios que vas a ver repetidos hasta el cansancio:

1. **Conceptos antes que código.** Un AI Engineer no es alguien que copia ejemplos de la documentación de OpenAI — es alguien que entiende qué problema está resolviendo, por qué la arquitectura X es mejor que la Y, y qué tradeoffs estás aceptando cuando eliges un framework.
2. **La IA es una herramienta. Tú diriges, la IA ejecuta.** El humano siempre lidera. No vamos a tratar al LLM como una caja mágica — vamos a entenderlo como un componente más, con su propio modelo de costes, latencias, modos de fallar y patrones de uso correcto.
3. **Cimientos sólidos antes que frameworks.** Vamos a entender qué hace LangChain ANTES de usar LangChain. Vamos a entender qué es un embedding ANTES de elegir una BBDD vectorial. Si el framework desaparece mañana, lo que aprendiste sigue valiendo.

**Lo que este curso NO es:**
- No es un tour de productos comerciales ni un catálogo de APIs.
- No es un curso de Machine Learning (no entrenamos modelos desde cero, no hablamos de backprop).
- No es un curso de "prompt engineering" — es un curso de **AI engineering**, que es algo mucho más amplio.

## 2. Audiencia

**Para quién:**
- Ingenieros de software con experiencia (backend idealmente).
- Que ya construyeron sistemas en producción.
- Que entienden APIs REST, bases de datos relacionales, async/await, contenedores.
- Que quieren entrar a AI Engineering **sin volverse data scientists**.

**Prerequisitos asumidos:**
- Programación a nivel intermedio/senior (cualquier lenguaje tipado o no).
- Git, terminal, Docker básico.
- HTTP, REST, JSON.
- SQL básico.
- Comodidad leyendo documentación técnica en inglés.

**No asume:**
- Python (hay un onboarding rápido en `02-python-para-js-devs.md`).
- Conocimiento previo de ML, deep learning ni de LLMs.
- Matemáticas más allá del nivel de bachillerato.

## 3. Estrategia de lenguaje: TypeScript-first híbrido

El curso usa **TypeScript como lenguaje principal** y **Python solo donde es estrictamente necesario**.

| Capa | Lenguaje | Por qué |
|------|----------|---------|
| App layer (wrappers, agentes, RAG, APIs, UI) | **TypeScript** | El SDK de Anthropic, Vercel AI SDK, LangChain.js y LangGraph.js están maduros. Si vienes de backend JS/TS, aprovechas 100% tu skill. |
| Embeddings con HuggingFace, evaluación con RAGAS, scripts ML específicos | **Python** | Ecosistema irrenunciable en estos puntos puntuales. |

Cuando una sesión use Python, vas a verlo marcado explícitamente con un badge `[Python]`. El resto es TS por defecto.

## 4. Stack tecnológico completo

> **Filosofía del stack:** el curso adopta el patrón de **abstracción de proveedores LLM desde el día 1**. No hay un único proveedor obligatorio — se usa una capa de abstracción (Vercel AI SDK) que permite cambiar de modelo cambiando una sola línea. Esto refleja cómo se construyen sistemas de IA en producción real, donde casarse con un proveedor es un riesgo operacional y económico que rara vez tiene sentido.

| Categoría | Tecnología | Cuándo entra |
|-----------|-----------|--------------|
| LLM local (default) | Ollama + Qwen 2.5 / Llama 3.1 / Mistral | Módulo 1 |
| LLM cloud gratuito (default) | Google Gemini 2.5 Flash (free tier amplio) | Módulo 1 |
| LLM cloud premium (comparativa) | Anthropic Claude (Haiku / Sonnet) | Módulo 1 |
| LLM cloud open-source (mención) | Groq, OpenRouter, Cerebras | Módulo 1 |
| Capa de abstracción LLM (TS) | **Vercel AI SDK** | Módulo 1 (desde el smoke test) |
| Orquestación de agentes (TS) | LangChain.js + LangGraph.js | Módulo 5 |
| Orquestación alternativa (Python) | Pydantic AI | Módulo 5 (mención) |
| BBDD vectorial principal | PostgreSQL + pgvector | Módulo 3 |
| BBDD vectorial comparativa | Qdrant | Módulo 3 |
| BBDD vectorial mención | Pinecone, Chroma | Módulo 3 |
| Observabilidad principal | Langfuse (open-source) | Módulo 6 (intro temprana en Módulo 2) |
| Observabilidad mención | LangSmith, Logfire | Módulo 5–6 |
| Evaluación LLMs | Promptfoo (TS), RAGAS (Python) | Módulo 4 + transversal |
| Deployment | Docker, docker-compose, Cloud Run / Railway | Módulo 6 |

**Costo estimado del curso completo:** entre **USD 0 y USD 5**. Si trabajas exclusivamente con Ollama local + Gemini free tier, el costo es cero. Solo gastarías dinero si decides usar Anthropic o OpenAI para las sesiones de comparativa, y aún así los proveedores suelen incluir créditos gratuitos al registrarse.

## 5. Mapa de aprendizaje y dependencias entre módulos

```
┌──────────────────────────────────────────────────────────────────┐
│ Módulo 1: Fundamentos                                            │
│  Qué es un LLM, primera llamada, estructura de respuesta         │
└──────────────────────────────────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ Módulo 2: Patrones de aplicaciones LLM                           │
│  Wrappers, prompts, contexto, salidas estructuradas, memoria     │
│  → Construye el "asistente base" del proyecto integrador         │
└──────────────────────────────────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ Módulo 3: Embeddings y búsqueda vectorial                        │
│  Chunking, embeddings, BBDD vectoriales, búsqueda semántica      │
│  → Indexa el catálogo y FAQs del proyecto                        │
└──────────────────────────────────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ Módulo 4: RAG                                                    │
│  Retrieval, reranking, generación con citas                      │
│  → El asistente ahora responde sobre el catálogo real            │
└──────────────────────────────────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ Módulo 5: Orquestación de agentes                                │
│  Function calling, LangGraph, multi-agente                       │
│  → El asistente accede a pedidos, recomienda, escala a humanos   │
└──────────────────────────────────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ Módulo 6: LLMOps + Lab Productividad del AI Engineer             │
│  Producción, observabilidad, costes, A/B testing                 │
│  → El asistente se despliega y se mide en prod                   │
└──────────────────────────────────────────────────────────────────┘
```

**Cada módulo agrega una capa real al producto integrador.** No hay ejercicios desconectados — todo construye el mismo producto.

## 6. Proyecto integrador: Agente de soporte para e-commerce

**El producto:** un asistente conversacional que un e-commerce ficticio (le vamos a llamar **TiendaPro**) puede integrar en su web/WhatsApp/etc. para:

- Responder preguntas sobre productos del catálogo.
- Resolver dudas sobre políticas (envíos, devoluciones, pagos).
- Consultar el estado de un pedido por número o email del cliente.
- Recomendar productos según necesidad expresada.
- Escalar a humano cuando no puede resolver.

**Por qué este caso:** combina los cuatro patrones más comunes de AI engineering en producción real — conversacional, RAG sobre datos propios, agente con function calling sobre BD, y orquestación multi-agente.

**Cómo crece a lo largo del curso:**

| Módulo | Hito del proyecto | Qué se agrega |
|--------|-------------------|---------------|
| M1 | "Hola, soy el asistente" | Primera llamada API funcionando, setup base |
| M2 | Asistente conversacional con personalidad | Wrapper, gestión de conversación, prompts estructurados, guardrails básicos |
| M3 | Catálogo y FAQs indexados | Datos normalizados + embeddings + pgvector |
| M4 | Asistente que responde sobre el catálogo | Retrieval, reranking, citas, evaluación con Promptfoo |
| M5 | Asistente que consulta pedidos y recomienda | Function calling, agente con tools, supervisor + workers |
| M6 | Asistente desplegado y monitoreado | Producción, Langfuse, A/B testing de prompts |

**El código del proyecto vive en `code/proyecto-integrador/`** y cada hito de módulo es un commit etiquetado con tag `proyecto-m{N}`.

## 7. Estructura de los módulos y splits de sesiones

El temario original tiene 16 sesiones (S00 a S15) más un Lab. Algunas sesiones son **demasiado densas para 1-2h**, así que las partimos. Las nuevas sub-sesiones se numeran como `S00.1`, `S00.2`, etc.

### Módulo 1 — Fundamentos de productos con IA *(reorganizado)*
| Sesión | Tema | Duración estim. | Status |
|--------|------|-----------------|--------|
| S00.1 | Panorama IA y rol del AI Engineer | 1h | Original (parte de S00) |
| S00.2 | Cómo funciona un LLM por dentro (lo justo para construir bien) | 1h | Original (parte de S00) |
| S00.3 | Python para devs JS/TS | 1h | **Nueva** (onboarding) |
| S01.1 | Setup del entorno + primera llamada a un LLM | 1h | Original (parte de S01) |
| S01.2 | Estructura de la respuesta + comparativa proveedores | 1h | Original (parte de S01) |

### Módulo 2 — Patrones de aplicaciones LLM
| Sesión | Tema | Duración estim. |
|--------|------|-----------------|
| S02 | Mecánica básica de un LLM: tokens, contexto, parámetros y tools | 2h |
| S03 | Wrappers y abstracciones sobre el modelo | 2h |
| S04 | Salidas estructuradas, JSON y guardrails | 2h |
| S05.1 | Inyección de contexto desde archivos, web y bases de datos | 1.5h |
| S05.2 | Memoria conversacional e historial | 1h |
| S05.3 | Personalización de prompts por usuario/rol + testing | 1.5h |

### Módulo 3 — Embeddings y búsqueda vectorial
| Sesión | Tema | Duración estim. |
|--------|------|-----------------|
| S06 | Por qué embeddings: del texto al vector | 2h |
| S07.1 | Chunking de documentos: estrategias y trade-offs | 1h |
| S07.2 | Teoría de embeddings y modelos | 1.5h |
| S07.3 | Espacio vectorial, búsqueda semántica y pre-procesamiento | 1.5h |
| S08 | Bases de datos vectoriales | 2h |

### Módulo 4 — Arquitectura RAG
| Sesión | Tema | Duración estim. |
|--------|------|-----------------|
| S09 | Fundamentos de RAG y técnicas de recuperación | 2h |
| S10 | Técnicas avanzadas de recuperación | 2h |
| S11.1 | Augmentación y combinación de contexto recuperado | 1h |
| S11.2 | Citas, control de alucinaciones y mantenimiento del índice | 1.5h |
| S11.3 | Evaluación de calidad con RAGAS y Promptfoo | 1.5h |

### Módulo 5 — Orquestación de agentes
| Sesión | Tema | Duración estim. |
|--------|------|-----------------|
| S12 | Introducción a agentes de IA | 2h |
| S13.1 | Cuándo usar un framework de agentes y cuándo construir el tuyo | 1h |
| S13.2 | LangGraph y grafos de ejecución | 1.5h |
| S13.3 | Gestión de estado, errores y observabilidad de agentes | 1.5h |
| S14.1 | Arquitecturas multi-agente y patrones de comunicación | 1.5h |
| S14.2 | Human-in-the-loop, seguridad y sandboxing | 1h |

### Módulo 6 — Despliegue y puesta en producción
| Sesión | Tema | Duración estim. |
|--------|------|-----------------|
| S15 | LLMOps: producción, observabilidad, KPIs, costes, A/B testing | 2h |
| Lab | Productividad del AI Engineer: Spec-Driven Development, agentes, MCPs, skills | 2h |

**Total estimado:** ~22 sesiones × 1.5h promedio ≈ **33h** de contenido, sin contar el tiempo de práctica del proyecto integrador (estimado 30-50h adicionales).

## 8. Estructura de cada sesión

Cada sesión sigue el mismo formato — **predecible y consumible en 1-2h**:

```
docs/modulos/MM-modulo/sesion-NN-tema/
├── README.md       ← Teoría + diagramas (lectura ~30-45 min)
├── ejercicios.md   ← Práctica guiada paso a paso (~30-60 min)
└── recursos.md     ← Enlaces, papers, lecturas opcionales

code/mMM-modulo/sesion-NN/
└── ...             ← Código de los ejercicios y demos
```

**Cada README de sesión tiene esta plantilla:**

1. **Objetivos de aprendizaje** — al terminar esto vas a poder X, Y, Z.
2. **Prerequisitos** — qué sesiones previas tienes que haber completado.
3. **Conceptos clave** — los 3-5 conceptos centrales con definiciones.
4. **Teoría** — desarrollo del tema con diagramas y ejemplos.
5. **Patrones y antipatrones** — qué hacer y qué evitar.
6. **Conexión con el proyecto integrador** — qué de lo que aprendiste vas a aplicar al producto.
7. **Resumen** — los 3 puntos que te tienes que llevar.
8. **Preguntas de auto-evaluación** — si no puedes responderlas, relee.

**Cada `ejercicios.md` tiene:**

1. **Ejercicio guiado** — paso a paso con código.
2. **Ejercicios libres** — variantes y experimentos.
3. **Reto** — algo más difícil para consolidar.
4. **Aporte al proyecto integrador** — el commit del módulo.

## 9. Sistema de evaluación

El curso es **autodidacta** pero está diseñado para evaluarte de forma honesta:

1. **Preguntas de auto-evaluación** al final de cada README. Si no puedes responderlas sin volver a leer, no aprendiste el concepto.
2. **Ejercicios prácticos** — código que tiene que correr y producir el output esperado.
3. **Hito del proyecto integrador** al final de cada módulo. Es el indicador más fuerte de progreso real.
4. **Retos opcionales** para empujarte más allá.

**No hay exámenes.** El proyecto integrador en producción al final del curso es el examen.

## 10. Convenciones del repo

### Lenguaje y estilo
- Markdown en español neutro (sin voseo ni regionalismos).
- Bloques de código con highlighting de lenguaje.
- Diagramas en Mermaid (compatible con GitHub).
- Tablas para comparativas y referencias rápidas.

### Convención de commits
**Conventional Commits** sin atribución de IA.

| Tipo | Cuándo se usa |
|------|---------------|
| `feat` | Nueva sesión, nuevo ejercicio, nueva funcionalidad del proyecto |
| `docs` | Cambios solo en documentación |
| `chore` | Setup, configuración, tooling |
| `fix` | Corrección de errores en docs o código |
| `refactor` | Reestructuración sin cambio de funcionalidad |

**Formato:**
```
<tipo>(<alcance>): <descripción corta>

[cuerpo opcional explicando el porqué]
```

**Ejemplos:**
```
feat(m01-s01.1): agrega sesión de setup y primera llamada API
docs(curriculum): clarifica splits de sesiones del módulo 5
chore(repo): añade docker-compose con pgvector
```

### Tags de hitos del proyecto integrador
Al cerrar cada módulo, se etiqueta el commit con:
```
proyecto-m1, proyecto-m2, ..., proyecto-m6
```

### Estructura de directorios de código
```
code/
├── m01-fundamentos/
│   ├── sesion-00.1/
│   ├── sesion-00.2/
│   └── ...
├── m02-patrones-llm/
├── m03-embeddings/
├── m04-rag/
├── m05-agentes/
├── m06-llmops/
└── proyecto-integrador/
    ├── README.md           ← qué es y cómo correrlo
    ├── apps/
    ├── packages/
    └── ...
```

El proyecto integrador usa **monorepo con pnpm workspaces** desde el Módulo 2 (cuando se justifica la complejidad).

## 11. Cómo seguir el curso

1. **No saltes módulos.** Cada uno depende del anterior.
2. **Haz los ejercicios.** Leer no es aprender — hacer es aprender.
3. **Construye el proyecto integrador en paralelo.** No lo dejes para el final.
4. **Si una sesión te lleva más del doble del tiempo estimado**, no te preocupes — ajusta el ritmo. Pero si te lleva menos de la mitad, probablemente la estás leyendo en piloto automático.
5. **Si no puedes explicarle el concepto a otra persona, no lo entendiste.** Prueba explicárselo a un compañero, a un rubber duck o a una IA.

## 12. Roadmap del repo

- [x] Estructura base + README + curriculum maestro
- [x] `01-setup.md` — instalación del entorno
- [x] `02-python-para-js-devs.md` — Python primer
- [x] Módulo 1 — Fundamentos (5 sesiones) — tag `proyecto-m1`
- [ ] Módulo 2 — Patrones de aplicaciones LLM (6 sesiones)
- [ ] Módulo 3 — Embeddings y búsqueda vectorial (5 sesiones)
- [ ] Módulo 4 — RAG (5 sesiones)
- [ ] Módulo 5 — Orquestación de agentes (6 sesiones)
- [ ] Módulo 6 — LLMOps + Lab (2 sesiones)
- [ ] Proyecto integrador completo desplegado

## 13. Referencias de syllabi públicos del dominio

Este temario converge con el cuerpo de conocimiento abierto de AI Engineering. Si quieres contrastar el alcance del curso con otros materiales públicos, o profundizar en un tema concreto, estos son los recursos de referencia:

- **Andrej Karpathy** — *Intro to Large Language Models* y *Let's build GPT from scratch* (YouTube). Fundamentos accesibles para ingenieros.
- **DeepLearning.AI Short Courses** — [deeplearning.ai/short-courses](https://www.deeplearning.ai/short-courses/). Catálogo amplio de cursos cortos y gratuitos sobre LLMs, RAG, agentes y evaluación.
- **Hugging Face Course** — [huggingface.co/learn](https://huggingface.co/learn). NLP, transformers, deep learning aplicado y agentes.
- **OpenAI Cookbook** — [cookbook.openai.com](https://cookbook.openai.com). Recetas prácticas de LLMs, function calling, embeddings, evaluación.
- **Anthropic Courses** — [github.com/anthropics/courses](https://github.com/anthropics/courses). Prompt engineering, tool use y RAG con Claude.
- **Chip Huyen** — *AI Engineering* (O'Reilly, 2024). Libro de referencia para el rol completo, alineado con el alcance de este curso.
- **Hamel Husain & Jason Liu** — cursos en Maven sobre evaluación de LLMs y construcción de productos IA en producción.
- **LangChain Academy** — [academy.langchain.com](https://academy.langchain.com). Agentes, LangGraph y observabilidad.
- **Pinecone Learn** — [pinecone.io/learn](https://www.pinecone.io/learn/). Recurso canónico sobre embeddings, chunking y arquitecturas RAG.
- **Promptfoo y RAGAS** — documentación oficial de las herramientas de evaluación que se usan en el curso.

El temario aquí presentado refleja el consenso de la industria sobre qué necesita saber un AI Engineer hoy, organizado con el énfasis particular de este curso: **TypeScript-first, multi-provider, conceptos sobre frameworks y proyecto integrador real desde el día 1**.

---

**Próximo paso:** [`01-setup.md`](01-setup.md) → instalación y configuración del entorno.
