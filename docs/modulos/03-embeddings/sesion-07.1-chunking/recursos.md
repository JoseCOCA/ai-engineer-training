# Sesión 07.1 — Recursos complementarios

Material opcional sobre chunking — la operación más subestimada del pipeline RAG.

---

## Lectura obligada (1 elemento)

- **Greg Kamradt — _5 Levels of Text Splitting_** — el video/post canónico que ordena las estrategias de simple a complejo. Lectura corta, alta densidad.
  - https://github.com/FullStackRetrieval-com/RetrievalTutorials/blob/main/tutorials/LevelsOfTextSplitting/5_Levels_Of_Text_Splitting.ipynb

## LangChain text splitters

- **LangChain — Text Splitters overview**
  - https://js.langchain.com/docs/how_to/recursive_text_splitter
- **LangChain — `RecursiveCharacterTextSplitter`** — la implementación canónica que usamos en los ejercicios.
  - https://api.js.langchain.com/classes/_langchain_textsplitters.RecursiveCharacterTextSplitter.html
- **LangChain — Markdown / HTML / code splitters** — variantes structural prebuilt.
  - https://js.langchain.com/docs/how_to/markdown_header_metadata_splitter

## Semantic chunking

- **Greg Kamradt — Semantic Chunking notebook**
  - https://github.com/FullStackRetrieval-com/RetrievalTutorials/blob/main/tutorials/LevelsOfTextSplitting/5_Levels_Of_Text_Splitting.ipynb
- **LlamaIndex — _Semantic Chunking_**
  - https://docs.llamaindex.ai/en/stable/examples/node_parsers/semantic_chunking/

## Best practices y benchmarks

- **Anthropic — _Contextual Retrieval_** — técnica de "agregar contexto al chunk" antes de embedear, mejora retrieval significativamente.
  - https://www.anthropic.com/news/contextual-retrieval
- **Pinecone — _Chunking strategies_**
  - https://www.pinecone.io/learn/chunking-strategies/
- **Microsoft — _Optimizing chunk size and overlap for RAG_**
  - https://devblogs.microsoft.com/azure-sql/vector-database-with-azure-sql-and-llamaindex/

## Tokenización para presupuestar chunks

- **gpt-tokenizer** (npm) — el paquete que usamos para contar tokens.
  - https://github.com/niieani/gpt-tokenizer
- **`@dqbd/tiktoken`** — alternativa con tokenizers OpenAI.
  - https://www.npmjs.com/package/tiktoken

## Para profundizar (preview de M4)

- **Hamel Husain — _Evaluating chunking strategies_**
  - https://hamel.dev/blog/posts/chunk-evals/
- **RAGAS docs** — métricas formales para evaluar retrieval (incluyendo cómo afecta el chunking).
  - https://docs.ragas.io

---

**Vuelve a:** [`README de la sesión`](README.md) · [`Curriculum maestro`](../../../00-curriculum.md)
