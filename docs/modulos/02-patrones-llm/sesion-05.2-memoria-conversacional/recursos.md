# Sesión 05.2 — Recursos complementarios

Material opcional. Selección curada para profundizar.

---

## Patrones de memoria

- **Anthropic — _Conversation history_** — guía oficial de cómo manejar historial.
  - https://docs.anthropic.com/en/docs/build-with-claude/conversation-history
- **OpenAI — _Conversation state_** — manejo del state y opciones (incluye Threads para Assistants API).
  - https://platform.openai.com/docs/guides/conversation-state
- **LangChain — _Memory types_** — taxonomía completa de tipos de memoria (buffer, summary, vector store retriever, knowledge graph). Útil para mapear qué patrón aplica a qué caso.
  - https://python.langchain.com/docs/concepts/memory/

## Resumen automático de conversaciones

- **OpenAI Cookbook — _Summarizing long documents_** — patrones aplicables a summarization de turnos viejos.
  - https://cookbook.openai.com/examples/summarizing_long_documents
- **Anthropic — _Long conversations_** — uso de extended thinking + summarization en flows largos.
  - https://docs.anthropic.com/en/docs/about-claude/use-cases/customer-support-agent

## Persistencia y storage

- **Postgres — _Designing chat application schemas_** — referencia conceptual sobre tabla `conversations` + `messages`.
  - https://medium.com/@matheusmlmarinho/database-schema-for-a-chat-application-9b40bf9d5b26
- **Mem0** — sistema open-source dedicado a memoria conversacional persistente.
  - https://github.com/mem0ai/mem0
- **Letta (ex-MemGPT)** — implementación canónica de memoria a largo plazo.
  - https://github.com/letta-ai/letta

## Memoria semántica (preview de M3)

- **Pinecone Learn — _Long-term memory in chatbots_** — patrón embeddings + retrieval aplicado a memoria, antesala de M3.
  - https://www.pinecone.io/learn/series/langchain/langchain-conversational-memory/
- **MemGPT paper** — _MemGPT: Towards LLMs as Operating Systems_ (Packer et al., 2023). Modelo conceptual interesante de jerarquías de memoria.
  - https://arxiv.org/abs/2310.08560

## Tokenización para budget

- **gpt-tokenizer** (npm) — el mismo paquete usado en S05.1.
  - https://github.com/niieani/gpt-tokenizer

---

**Vuelve a:** [`README de la sesión`](README.md) · [`Curriculum maestro`](../../../00-curriculum.md)
