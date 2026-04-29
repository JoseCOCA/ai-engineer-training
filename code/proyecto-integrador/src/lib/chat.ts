/**
 * Chat service — frontera del producto.
 *
 * Lo único de la app que importa el SDK del proveedor LLM. El resto
 * del código (index.ts, intent.ts, summarize.ts) consume chat() y
 * chatStream() desde aquí.
 *
 * Incluye: defaults de producto, retry con backoff, fallback al
 * proveedor secundario, instrumentación (latencia/tokens/costo/flow)
 * y logging append-only a logs/calls.jsonl.
 */
import { generateText, streamText } from "ai";
import {
  buildModel,
  FALLBACK_PROVIDER,
  PRIMARY_PROVIDER,
  type Provider,
} from "./providers.js";
import { priceFor } from "./pricing.js";
import { defaultShouldRetry, withRetry } from "./retry.js";
import { appendLog } from "./logger.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  system?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  flow?: string;
  abortSignal?: AbortSignal;
}

export interface ChatResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  latencyMs: number;
  provider: Provider;
  modelId: string;
  finishReason: string;
  costUsd: number;
  attempts: number;
  fallbackUsed: boolean;
  flow: string;
}

const DEFAULT_TEMPERATURE = 0.5;
const DEFAULT_MAX_OUTPUT = 500;
const DEFAULT_FLOW = "unknown";

async function callProvider(
  provider: Provider,
  req: ChatRequest,
): Promise<Omit<ChatResponse, "attempts" | "fallbackUsed" | "flow">> {
  const { model, modelId, provider: resolved } = buildModel(provider);
  const start = Date.now();

  const result = await generateText({
    model,
    system: req.system,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: req.temperature ?? DEFAULT_TEMPERATURE,
    maxOutputTokens: req.maxOutputTokens ?? DEFAULT_MAX_OUTPUT,
    abortSignal: req.abortSignal,
  });

  const latencyMs = Date.now() - start;
  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;
  const reasoningTokens = result.usage.reasoningTokens ?? 0;

  return {
    text: result.text,
    inputTokens,
    outputTokens,
    reasoningTokens,
    latencyMs,
    provider: resolved,
    modelId,
    finishReason: result.finishReason,
    costUsd: priceFor(resolved, modelId, {
      inputTokens,
      outputTokens,
      reasoningTokens,
    }),
  };
}

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const flow = req.flow ?? DEFAULT_FLOW;
  let attempts = 0;
  let fallbackUsed = false;
  let response: Omit<ChatResponse, "attempts" | "fallbackUsed" | "flow">;

  try {
    const result = await withRetry(() => callProvider(PRIMARY_PROVIDER, req), {
      onRetry: (attempt, error) => {
        console.warn(
          `[chat][${flow}] retry ${attempt}: ${error instanceof Error ? error.message : error}`,
        );
      },
    });
    response = result.value;
    attempts = result.attempts;
  } catch (primaryError) {
    if (
      !defaultShouldRetry(primaryError) ||
      PRIMARY_PROVIDER === FALLBACK_PROVIDER
    ) {
      throw primaryError;
    }
    console.warn(
      `[chat][${flow}] primary (${PRIMARY_PROVIDER}) failed → fallback to ${FALLBACK_PROVIDER}`,
    );
    response = await callProvider(FALLBACK_PROVIDER, req);
    attempts = 1;
    fallbackUsed = true;
  }

  const fullResponse: ChatResponse = { ...response, attempts, fallbackUsed, flow };
  appendLog(fullResponse);
  return fullResponse;
}

export interface ChatStreamResult {
  textStream: AsyncIterable<string>;
  finished: Promise<ChatResponse>;
}

export function chatStream(req: ChatRequest): ChatStreamResult {
  const flow = req.flow ?? DEFAULT_FLOW;
  const { model, modelId, provider } = buildModel(PRIMARY_PROVIDER);

  const start = Date.now();

  const result = streamText({
    model,
    system: req.system,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: req.temperature ?? DEFAULT_TEMPERATURE,
    maxOutputTokens: req.maxOutputTokens ?? DEFAULT_MAX_OUTPUT,
    abortSignal: req.abortSignal,
  });

  let resolveFinished: (r: ChatResponse) => void;
  let rejectFinished: (e: unknown) => void;
  const finished = new Promise<ChatResponse>((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });

  async function* iterate(): AsyncIterable<string> {
    let collected = "";
    try {
      for await (const chunk of result.textStream) {
        collected += chunk;
        yield chunk;
      }

      const usage = await result.usage;
      const finishReason = await result.finishReason;
      const latencyMs = Date.now() - start;

      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;
      const reasoningTokens = usage.reasoningTokens ?? 0;

      const full: ChatResponse = {
        text: collected,
        inputTokens,
        outputTokens,
        reasoningTokens,
        latencyMs,
        provider,
        modelId,
        finishReason: finishReason ?? "stop",
        costUsd: priceFor(provider, modelId, {
          inputTokens,
          outputTokens,
          reasoningTokens,
        }),
        attempts: 1,
        fallbackUsed: false,
        flow,
      };

      appendLog(full);
      resolveFinished(full);
    } catch (error) {
      const isAbort =
        error instanceof Error &&
        (error.name === "AbortError" || error.message.includes("aborted"));

      if (isAbort) yield "[CANCELLED]";
      else yield `\n\n[Error: la respuesta se interrumpió. Intenta de nuevo.]`;
      rejectFinished(error);
    }
  }

  return { textStream: iterate(), finished };
}
