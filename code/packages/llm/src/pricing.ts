/**
 * Snapshot de precios USD por 1M tokens (abril 2026).
 * Para producción real, integrar con la API de billing del proveedor.
 */
import type { Provider } from "./providers.js";

interface PriceEntry {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  reasoningUsdPer1M?: number;
}

const PRICES: Record<string, PriceEntry> = {
  "google:gemini-2.5-flash": { inputUsdPer1M: 0.2, outputUsdPer1M: 1.0 },
  "google:gemini-2.5-pro": { inputUsdPer1M: 3.0, outputUsdPer1M: 12.0 },
  "anthropic:claude-haiku-4-5-20251001": {
    inputUsdPer1M: 1.0,
    outputUsdPer1M: 5.0,
  },
  "anthropic:claude-sonnet-4-6": { inputUsdPer1M: 3.0, outputUsdPer1M: 15.0 },
  "anthropic:claude-opus-4": { inputUsdPer1M: 15.0, outputUsdPer1M: 75.0 },
  "openai:gpt-4o-mini": { inputUsdPer1M: 0.15, outputUsdPer1M: 0.6 },
  "openai:gpt-5-nano": { inputUsdPer1M: 1.0, outputUsdPer1M: 8.0 },
  "openai:gpt-5": { inputUsdPer1M: 10.0, outputUsdPer1M: 40.0 },
  "ollama:*": { inputUsdPer1M: 0, outputUsdPer1M: 0 },
};

export interface UsageInput {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
}

export function priceFor(
  provider: Provider,
  modelId: string,
  usage: UsageInput,
): number {
  const exactKey = `${provider}:${modelId}`;
  const wildcardKey = `${provider}:*`;

  const entry = PRICES[exactKey] ?? PRICES[wildcardKey];
  if (!entry) return 0;

  const input = (usage.inputTokens / 1_000_000) * entry.inputUsdPer1M;
  const output = (usage.outputTokens / 1_000_000) * entry.outputUsdPer1M;
  const reasoning = entry.reasoningUsdPer1M
    ? ((usage.reasoningTokens ?? 0) / 1_000_000) * entry.reasoningUsdPer1M
    : ((usage.reasoningTokens ?? 0) / 1_000_000) * entry.outputUsdPer1M;

  return input + output + reasoning;
}
