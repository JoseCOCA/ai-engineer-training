/**
 * Tool searchCatalog (M5).
 *
 * Envuelve el RAG pipeline de M4 (`runRagPipeline`) como una tool
 * de LangChain consumible por el catalog worker.
 *
 * El RAG pipeline sigue corriendo con Vercel AI SDK por dentro
 * (retrieve pgvector + listwise rerank con Gemini). Acá solo lo
 * exponemos como tool del agente.
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { PgVectorStore } from "../../retrieval/index.js";
import {
  embedQuery,
  runRagPipeline,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
} from "../../rag/index.js";

let cachedStore: PgVectorStore | null = null;

function getStore(): PgVectorStore {
  if (!cachedStore) {
    cachedStore = new PgVectorStore({
      embedder: embedQuery,
      embeddingModel: EMBEDDING_MODEL,
      embeddingVersion: EMBEDDING_VERSION,
    });
  }
  return cachedStore;
}

export async function closeCatalogStore(): Promise<void> {
  if (cachedStore) {
    await cachedStore.close();
    cachedStore = null;
  }
}

export const searchCatalogTool = tool(
  async ({ query }: { query: string }) => {
    const result = await runRagPipeline(getStore(), query);
    if (result.chunks.length === 0) {
      return JSON.stringify({
        found: false,
        message: "No encontré productos en el catálogo que respondan esa consulta.",
      });
    }
    return JSON.stringify({
      found: true,
      answer: result.answer,
      citations: result.citations.map((c) => c.source_id),
      chunks: result.chunks.map((c) => ({ id: c.id, name: c.name, category: c.category })),
    });
  },
  {
    name: "searchCatalog",
    description:
      "Busca productos en el catálogo de TiendaPro y devuelve una respuesta con citas. Úsala cuando el usuario pregunte por productos, características, recomendaciones o disponibilidad.",
    schema: z.object({
      query: z.string().describe("La consulta del usuario sobre productos del catálogo."),
    }),
  },
);
