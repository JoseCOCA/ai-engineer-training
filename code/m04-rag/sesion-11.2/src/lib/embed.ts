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
