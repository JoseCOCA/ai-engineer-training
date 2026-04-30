# Sesión 12 — Recursos

> Material complementario sobre agentes con LLM.

---

## Lecturas fundamentales

- **Yao et al. (2022) — "ReAct: Synergizing Reasoning and Acting in Language Models".** El paper que sistematizó el patrón Reason+Act. Lectura obligatoria. [arXiv:2210.03629](https://arxiv.org/abs/2210.03629)
- **Anthropic — "Building Effective Agents".** Guía con patrones reales y antipatrones. Muy actual. [https://www.anthropic.com/research/building-effective-agents](https://www.anthropic.com/research/building-effective-agents)
- **OpenAI — "A Practical Guide to Building Agents".** Otra perspectiva del mismo tema, complementaria. [https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)

## Vercel AI SDK — tools y agent patterns

- **Vercel AI SDK Docs — Tool Calling.** Documentación oficial. Es la API que usamos en los demos. [https://sdk.vercel.ai/docs/foundations/tools](https://sdk.vercel.ai/docs/foundations/tools)
- **Vercel AI SDK Docs — Agents.** Patrones recomendados, incluyendo `stopWhen` y batching. [https://sdk.vercel.ai/docs/foundations/agents](https://sdk.vercel.ai/docs/foundations/agents)
- **Vercel AI SDK Cookbook — Agent.** Ejemplos copiables. [https://sdk.vercel.ai/cookbook/node/multi-step-tool-call](https://sdk.vercel.ai/cookbook/node/multi-step-tool-call)

## Antipatrones y debugging

- **LangChain Blog — "Agent Failure Modes".** Repaso pragmático de modos de fallar y cómo detectarlos. [https://blog.langchain.dev/](https://blog.langchain.dev/)
- **Hugging Face — "Agents Course".** Curso libre con ejemplos en Python; los conceptos aplican igual en TS. [https://huggingface.co/learn/agents-course/](https://huggingface.co/learn/agents-course/)

## Charlas y videos

- **"Agents Don't Replace Pipelines" — Lance Martin (LangChain)** (~25 min). Argumenta cuándo agente vs pipeline. [https://blog.langchain.dev/](https://blog.langchain.dev/)
- **"Building Agents with the AI SDK" — Vercel** (~20 min). Tutorial práctico del SDK que usamos. [https://www.youtube.com/c/vercel](https://www.youtube.com/c/vercel)

## Frameworks (preview de S13)

- **LangGraph.js Docs.** El framework de agentes basado en grafos. Lo cubrimos en S13.2. [https://langchain-ai.github.io/langgraphjs/](https://langchain-ai.github.io/langgraphjs/)
- **Pydantic AI.** Framework de agentes en Python con type safety fuerte. Mención en S13.1. [https://ai.pydantic.dev/](https://ai.pydantic.dev/)
- **OpenAI Assistants API.** Servicio managed de OpenAI para agentes. Mención en S13.1 con sus tradeoffs. [https://platform.openai.com/docs/assistants/overview](https://platform.openai.com/docs/assistants/overview)

---

## Para tener en mente al avanzar

S13.1 va a ser comparativa pura: el mismo agente que armamos hoy, escrito en LangGraph, escrito en OpenAI Assistants, escrito bare metal. Vas a poder comparar lineas de código, debugabilidad y portabilidad. Después de S13.1 sabrás cuándo te conviene el framework y cuándo no.
