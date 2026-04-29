/**
 * Wrapper minimalista del embedder de Gemini vía Vercel AI SDK.
 *
 * Usamos `gemini-embedding-001` por:
 *  - Free tier amplio (suficiente para los ejercicios del curso).
 *  - Multilingüe robusto (importante para español).
 *  - Output 768D normalizado.
 *
 * En S07.2 vamos a comparar con sentence-transformers (Python local)
 * y otros proveedores cloud.
 */
import { embed, embedMany } from "ai";
import { google } from "@ai-sdk/google";

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  throw new Error(
    "GOOGLE_GENERATIVE_AI_API_KEY no configurada. Conseguila en https://aistudio.google.com/app/apikey",
  );
}

const EMBEDDING_MODEL = "gemini-embedding-001";

export const embedder = google.textEmbeddingModel(EMBEDDING_MODEL);

export async function embedOne(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embedder,
    value: text,
  });
  return embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: embedder,
    values: texts,
  });
  return embeddings;
}

/**
 * Similitud coseno entre dos vectores.
 *
 * Si los vectores ya están normalizados (la mayoría de los modelos
 * los devuelven así), esto equivale a dot product. Lo dejamos
 * explícito acá para que vea el cálculo completo.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Dimensiones distintas: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
