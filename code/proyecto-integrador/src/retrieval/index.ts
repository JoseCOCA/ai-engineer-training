/**
 * Retrieval — punto de entrada del módulo de búsqueda vectorial.
 *
 * Re-exports el cliente y los tipos. El cableado al asistente
 * conversacional sucede en el Módulo 4 (RAG).
 */
export {
  PgVectorStore,
  type PgVectorStoreOptions,
  type SearchOptions,
  type SearchResult,
} from "./pgvector-store.js";
