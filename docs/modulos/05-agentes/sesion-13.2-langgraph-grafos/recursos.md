# Sesión 13.2 — Recursos

> Material complementario sobre LangGraph.js.

---

## LangGraph.js

- **LangGraph.js Conceptual Guide.** Modelo mental, glosario, cuándo usarlo. Lectura previa recomendada. [https://langchain-ai.github.io/langgraphjs/concepts/](https://langchain-ai.github.io/langgraphjs/concepts/)
- **LangGraph.js Tutorials.** Galería de ejemplos progresivos. Pasar al menos por "Quickstart" y "Multi-agent". [https://langchain-ai.github.io/langgraphjs/tutorials/](https://langchain-ai.github.io/langgraphjs/tutorials/)
- **LangGraph.js Reference — `StateGraph`.** API oficial. [https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html)
- **LangGraph.js Reference — `createReactAgent`.** API del helper que armamos en el demo 2. [https://langchain-ai.github.io/langgraphjs/reference/functions/langgraph_prebuilt.createReactAgent.html](https://langchain-ai.github.io/langgraphjs/reference/functions/langgraph_prebuilt.createReactAgent.html)

## Tools de LangChain

- **`@langchain/core/tools` — `tool()`.** Definición canónica de tools en LangChain. Distinta del Vercel AI SDK. [https://js.langchain.com/docs/concepts/tools/](https://js.langchain.com/docs/concepts/tools/)
- **LangChain Models — `ChatGoogleGenerativeAI`.** Wrapper de Gemini para LangChain. [https://js.langchain.com/docs/integrations/chat/google_generativeai/](https://js.langchain.com/docs/integrations/chat/google_generativeai/)

## Visualización

- **Mermaid Live Editor.** Para visualizar el output de `graph.getGraphAsync().drawMermaid()`. [https://mermaid.live/](https://mermaid.live/)

## Comparativas y deep dives

- **"From scratch to LangGraph" — LangChain blog.** Migración paso a paso de bare metal a LangGraph. Útil después de S13.1. [https://blog.langchain.dev/](https://blog.langchain.dev/)
- **"LangGraph vs Agents SDK" — varios.** Comparativas con OpenAI Assistants. [https://www.youtube.com/results?search_query=langgraph+vs+openai+assistants](https://www.youtube.com/results?search_query=langgraph+vs+openai+assistants)

---

## Para tener en mente al avanzar

S13.3 entra en lo que más justifica adoptar LangGraph: **persistencia de estado, error handling robusto, y observabilidad estructurada**. Vas a ver checkpointers (memory, SQLite), retries con backoff, fallbacks y trace logging que se exporta a Langfuse / LangSmith. Todo eso en bare metal cuesta cientos de líneas; en LangGraph son configuraciones.
