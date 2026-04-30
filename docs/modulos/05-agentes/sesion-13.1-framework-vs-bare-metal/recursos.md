# Sesión 13.1 — Recursos

> Comparativas y referencias sobre frameworks de agentes vs bare metal.

---

## Comparativas y análisis

- **Anthropic — "Building Effective Agents".** Posición canónica: empezá simple. Lectura recomendada antes de adoptar framework. [https://www.anthropic.com/research/building-effective-agents](https://www.anthropic.com/research/building-effective-agents)
- **Hamel Husain — "What I learned building agentic systems".** Análisis crítico de frameworks vs bare metal con casos reales. [https://hamel.dev/](https://hamel.dev/)
- **LangChain Blog — "When to use a framework".** Posición de los autores de LangChain sobre cuándo NO usarlo (interesante). [https://blog.langchain.dev/](https://blog.langchain.dev/)

## Vercel AI SDK

- **Vercel AI SDK — Agents Docs.** El `stopWhen` y patrones recomendados. [https://sdk.vercel.ai/docs/foundations/agents](https://sdk.vercel.ai/docs/foundations/agents)
- **Vercel AI SDK Source.** El loop interno es legible: ~150 líneas. [https://github.com/vercel/ai/tree/main/packages/ai](https://github.com/vercel/ai/tree/main/packages/ai)

## LangGraph (preview)

- **LangGraph.js Docs — Conceptual Guide.** Conceptos centrales antes de meterse en código. Lectura previa a S13.2. [https://langchain-ai.github.io/langgraphjs/concepts/](https://langchain-ai.github.io/langgraphjs/concepts/)
- **LangGraph.js — Examples.** Galería de patrones reales. [https://langchain-ai.github.io/langgraphjs/tutorials/](https://langchain-ai.github.io/langgraphjs/tutorials/)

## Otros frameworks mencionados

- **Mastra.** Framework TS-first relativamente nuevo. [https://mastra.ai/](https://mastra.ai/)
- **OpenAI Assistants API.** Servicio managed de OpenAI. [https://platform.openai.com/docs/assistants/overview](https://platform.openai.com/docs/assistants/overview)
- **Pydantic AI.** Framework Python con type safety fuerte. [https://ai.pydantic.dev/](https://ai.pydantic.dev/)
- **CrewAI.** Multi-agente opinionado. [https://www.crewai.com/](https://www.crewai.com/)
- **AutoGen.** Multi-agente de Microsoft. [https://microsoft.github.io/autogen/](https://microsoft.github.io/autogen/)

## Charlas

- **"Don't build agents... yet" — Various** (~varios). Argumento contrario a la adopción temprana. Útil como contrapeso al hype.
- **"LangGraph in production" — LangChain** (~30 min). Casos de uso reales con LangGraph. [https://www.youtube.com/results?search_query=langgraph+production](https://www.youtube.com/results?search_query=langgraph+production)

---

## Para tener en mente al avanzar

S13.2 entra en LangGraph.js a fondo. Vamos a construir un agente con `StateGraph`, `nodes`, `edges`, `conditional edges` — los conceptos que abstraen lo que en bare metal hicimos manualmente. Comparar mentalmente "esto en bare metal sería X" mientras lees el código de LangGraph es buena práctica.
