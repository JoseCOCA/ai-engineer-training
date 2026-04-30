/**
 * Embedder de queries con gemini-embedding-001 (768D).
 *
 * Coherente con el modelo y la versión que `scripts/index-catalog.ts`
 * usa para indexar el catálogo. Reutilizable desde cualquier flow del
 * integrador que necesite buscar en pgvector.
 */
import { embed } from "ai";
import { google } from "@ai-sdk/google";

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_VERSION = 1;

export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: google.textEmbeddingModel(EMBEDDING_MODEL),
    value: text,
  });
  return embedding;
}
