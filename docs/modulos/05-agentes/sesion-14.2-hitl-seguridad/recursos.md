# Sesión 14.2 — Recursos

---

## HITL en LangGraph

- **LangGraph Human-in-the-loop docs.** [https://langchain-ai.github.io/langgraphjs/concepts/human_in_the_loop/](https://langchain-ai.github.io/langgraphjs/concepts/human_in_the_loop/)
- **LangGraph Tutorial — Wait for User Input.** [https://langchain-ai.github.io/langgraphjs/how-tos/wait-user-input/](https://langchain-ai.github.io/langgraphjs/how-tos/wait-user-input/)
- **LangGraph Tutorial — Tool Calling with Approval.** [https://langchain-ai.github.io/langgraphjs/how-tos/review-tool-calls/](https://langchain-ai.github.io/langgraphjs/how-tos/review-tool-calls/)

## Seguridad de agentes

- **OWASP — Top 10 for LLM Applications.** Lista de riesgos comunes incluyendo prompt injection, excesiva autonomía, manejo inseguro de output. [https://owasp.org/www-project-top-10-for-large-language-model-applications/](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- **Anthropic — "Risks of Frontier Agents".** Análisis de los riesgos de agentes con tools poderosas. [https://www.anthropic.com/research](https://www.anthropic.com/research)
- **Simon Willison — "Prompt injection attacks against tools".** Posts críticos sobre tool calling y inyección. [https://simonwillison.net/](https://simonwillison.net/)

## Sandboxing y validación

- **zod docs.** Para output validation con schemas estrictos. [https://zod.dev/](https://zod.dev/)
- **LangChain Output Parsers.** Estructuras canónicas para validar outputs. [https://js.langchain.com/docs/concepts/output_parsers/](https://js.langchain.com/docs/concepts/output_parsers/)

---

## Cierre del Módulo 5

Después de S14.2 cerramos M5 con tag `proyecto-m5`. El integrador queda con:
- Supervisor multi-agente con LangGraph (catalog + orders + escalation).
- RAG pipeline de M4 envuelto como tool del catalog worker (interoperabilidad SDK).
- Tests Ring 1 del classifier + sandboxing en cuatro capas.

El próximo paso (M6 — LLMOps) cubre producción: observabilidad estructurada con Langfuse, A/B testing, costos, deployment, KPIs.
