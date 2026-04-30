# Sesión 14.1 — Recursos

---

## Patrones multi-agente

- **LangGraph — Multi-Agent Systems.** Doc oficial con los 4 patrones canónicos. [https://langchain-ai.github.io/langgraphjs/concepts/multi_agent/](https://langchain-ai.github.io/langgraphjs/concepts/multi_agent/)
- **LangGraph Tutorial — Multi-agent Supervisor.** Ejemplo trabajado. [https://langchain-ai.github.io/langgraphjs/tutorials/multi_agent/agent_supervisor/](https://langchain-ai.github.io/langgraphjs/tutorials/multi_agent/agent_supervisor/)
- **LangGraph Tutorial — Hierarchical Agent Teams.** Patrón hierarchical. [https://langchain-ai.github.io/langgraphjs/tutorials/multi_agent/hierarchical_agent_teams/](https://langchain-ai.github.io/langgraphjs/tutorials/multi_agent/hierarchical_agent_teams/)

## Análisis crítico

- **Anthropic — "Building Effective Agents".** Sección sobre orquestación: prefer multi-step agents over multi-agent when possible. [https://www.anthropic.com/research/building-effective-agents](https://www.anthropic.com/research/building-effective-agents)
- **"Multi-Agent Patterns" — varios autores.** Comparativas críticas. [https://www.deeplearning.ai/short-courses/](https://www.deeplearning.ai/short-courses/)

## Frameworks orientados a multi-agente

- **CrewAI.** Multi-agente opinionado, "agentes como roles". [https://www.crewai.com/](https://www.crewai.com/)
- **AutoGen.** Microsoft, conversacional entre agentes. [https://microsoft.github.io/autogen/](https://microsoft.github.io/autogen/)
- **MetaGPT.** Multi-agente para roles de equipo de software. [https://github.com/geekan/MetaGPT](https://github.com/geekan/MetaGPT)

---

## Para tener en mente al avanzar

S14.2 cierra el módulo con HITL (human-in-the-loop), seguridad y sandboxing. Acá entran los guardrails que multi-agente requiere para producción: approval gates antes de tools destructivas, budget caps, validación de output, escalation a humano cuando el sistema no está seguro. Y aterriza todo en el integrador de TiendaPro con tag `proyecto-m5`.
