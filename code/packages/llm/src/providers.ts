/**
 * Resolver de modelo según .env. La única pieza de la lib que importa
 * SDKs específicos del proveedor.
 */
import { type LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider-v2";

export type Provider = "ollama" | "google" | "anthropic" | "openai";

export interface ResolvedModel {
  model: LanguageModel;
  provider: Provider;
  modelId: string;
}

export function buildModel(provider: Provider): ResolvedModel {
  switch (provider) {
    case "ollama": {
      const baseURL = process.env.OLLAMA_BASE_URL;
      if (!baseURL) throw new Error("OLLAMA_BASE_URL no configurada.");
      const ollama = createOllama({ baseURL: `${baseURL}/api` });
      const modelId = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";
      return { model: ollama(modelId), provider, modelId };
    }
    case "google": {
      if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY no configurada.");
      }
      const modelId = process.env.GOOGLE_MODEL ?? "gemini-2.5-flash";
      return { model: google(modelId), provider, modelId };
    }
    case "anthropic": {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY no configurada.");
      }
      const modelId =
        process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
      return { model: anthropic(modelId), provider, modelId };
    }
    case "openai": {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY no configurada.");
      }
      const modelId = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
      return { model: openai(modelId), provider, modelId };
    }
    default: {
      const exhaustive: never = provider;
      throw new Error(`Proveedor LLM desconocido: ${exhaustive}`);
    }
  }
}

export const PRIMARY_PROVIDER: Provider =
  (process.env.DEFAULT_LLM_PROVIDER as Provider) ?? "ollama";

export const FALLBACK_PROVIDER: Provider = "ollama";
