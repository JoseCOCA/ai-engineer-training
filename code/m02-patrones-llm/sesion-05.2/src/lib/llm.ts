import { type LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider-v2";

export type Provider = "ollama" | "google" | "anthropic" | "openai";

const provider = (process.env.DEFAULT_LLM_PROVIDER ?? "ollama") as Provider;

function buildModel(): LanguageModel {
  switch (provider) {
    case "ollama": {
      const baseURL = process.env.OLLAMA_BASE_URL;
      if (!baseURL) throw new Error("OLLAMA_BASE_URL no configurada.");
      const ollama = createOllama({ baseURL: `${baseURL}/api` });
      return ollama(process.env.OLLAMA_MODEL ?? "qwen2.5:7b");
    }
    case "google":
      if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY no configurada.");
      }
      return google(process.env.GOOGLE_MODEL ?? "gemini-2.5-flash");
    case "anthropic":
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY no configurada.");
      }
      return anthropic(
        process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      );
    case "openai":
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY no configurada.");
      }
      return openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini");
    default: {
      const exhaustive: never = provider;
      throw new Error(`Proveedor LLM desconocido: ${exhaustive}`);
    }
  }
}

export const llm: LanguageModel = buildModel();
export const providerInUse: Provider = provider;
