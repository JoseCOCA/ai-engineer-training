/**
 * Utilidades compartidas por los demos de S08.
 */
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_VERSION = 1;

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
}

export function productAsDoc(p: Product): string {
  return `${p.name}. ${p.description} Categoría: ${p.category}.`;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: google.textEmbeddingModel(EMBEDDING_MODEL),
    values: texts,
  });
  return embeddings;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}
