/**
 * Abstracción multi-provider de LLM.
 *
 * Esta es la ÚNICA pieza del proyecto que importa SDKs específicos
 * de proveedores. El resto del código consume el `llm` exportado
 * desde acá, sin saber qué hay detrás.
 *
 * Para cambiar de proveedor, modificá DEFAULT_LLM_PROVIDER en .env.
 * No deberías necesitar tocar este archivo durante el curso.
 */
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
      if (!baseURL) {
        throw new Error(
          "OLLAMA_BASE_URL no está definida. Verificá tu .env (ver env.example en la raíz del repo).",
        );
      }
      const ollama = createOllama({ baseURL: `${baseURL}/api` });
      return ollama(process.env.OLLAMA_MODEL ?? "qwen2.5:7b");
    }
    case "google":
      if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        throw new Error(
          "GOOGLE_GENERATIVE_AI_API_KEY no está definida. Conseguila en https://aistudio.google.com/app/apikey",
        );
      }
      return google(process.env.GOOGLE_MODEL ?? "gemini-2.5-flash");
    case "anthropic":
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error(
          "ANTHROPIC_API_KEY no está definida. Conseguila en https://console.anthropic.com/settings/keys",
        );
      }
      return anthropic(
        process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      );
    case "openai":
      if (!process.env.OPENAI_API_KEY) {
        throw new Error(
          "OPENAI_API_KEY no está definida. Conseguila en https://platform.openai.com/api-keys",
        );
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
