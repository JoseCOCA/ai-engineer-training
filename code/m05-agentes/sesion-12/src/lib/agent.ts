/**
 * Agent loop manual + termination conditions.
 *
 * Implementa el patrón canónico:
 *   while (no done) {
 *     result = LLM(messages, tools)
 *     if (no toolCalls) → return result.text
 *     for each toolCall: execute, push result to messages
 *   }
 *
 * Termination conditions:
 *   - finishReason === "stop" (LLM emite respuesta final)
 *   - max_iterations
 *   - token_budget
 *   - wall_clock_timeout
 *   - loop detection (mismas args repetidas)
 */
import { generateText, type ToolSet, type ModelMessage } from "ai";
import { buildModel, PRIMARY_PROVIDER } from "@curso-ai/llm";

export interface AgentOptions {
  maxIter?: number;
  tokenBudget?: number;
  timeoutMs?: number;
  detectLoops?: boolean;
  system?: string;
  onStep?: (step: AgentStep) => void;
}

export interface AgentStep {
  iteration: number;
  toolCalls: Array<{ name: string; args: unknown }>;
  toolResults: Array<{ name: string; output: unknown }>;
  text?: string;
  finishReason: string;
  inputTokens: number;
  outputTokens: number;
  elapsedMs: number;
}

export type AgentResult =
  | { ok: true; text: string; iterations: number; totalTokens: number; elapsedMs: number }
  | { ok: false; reason: "max_iter" | "token_budget" | "timeout" | "loop_detected"; partial?: string; iterations: number; totalTokens: number; elapsedMs: number };

const DEFAULT_MAX_ITER = 10;
const DEFAULT_TOKEN_BUDGET = 50_000;
const DEFAULT_TIMEOUT_MS = 30_000;

function hashCall(name: string, args: unknown): string {
  return `${name}::${JSON.stringify(args)}`;
}

export async function runAgent(
  query: string,
  tools: ToolSet,
  opts: AgentOptions = {},
): Promise<AgentResult> {
  const maxIter = opts.maxIter ?? DEFAULT_MAX_ITER;
  const tokenBudget = opts.tokenBudget ?? DEFAULT_TOKEN_BUDGET;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const detectLoops = opts.detectLoops ?? true;

  const { model } = buildModel(PRIMARY_PROVIDER);
  const messages: ModelMessage[] = [{ role: "user", content: query }];

  const start = Date.now();
  let totalTokens = 0;
  const recentCalls = new Map<string, number>();

  for (let iteration = 1; iteration <= maxIter; iteration++) {
    const elapsed = Date.now() - start;
    if (elapsed > timeoutMs) {
      return {
        ok: false,
        reason: "timeout",
        iterations: iteration - 1,
        totalTokens,
        elapsedMs: elapsed,
      };
    }
    if (totalTokens > tokenBudget) {
      return {
        ok: false,
        reason: "token_budget",
        iterations: iteration - 1,
        totalTokens,
        elapsedMs: elapsed,
      };
    }

    const stepStart = Date.now();
    const result = await generateText({
      model,
      system: opts.system,
      messages,
      tools,
      temperature: 0.2,
    });

    const stepElapsed = Date.now() - stepStart;
    const inputTokens = result.usage.inputTokens ?? 0;
    const outputTokens = result.usage.outputTokens ?? 0;
    totalTokens += inputTokens + outputTokens;

    const toolCalls = result.toolCalls.map((c) => ({
      name: c.toolName,
      args: c.input,
    }));

    if (detectLoops && toolCalls.length > 0) {
      for (const c of toolCalls) {
        const h = hashCall(c.name, c.args);
        const count = (recentCalls.get(h) ?? 0) + 1;
        recentCalls.set(h, count);
        if (count >= 3) {
          opts.onStep?.({
            iteration,
            toolCalls,
            toolResults: [],
            finishReason: result.finishReason,
            inputTokens,
            outputTokens,
            elapsedMs: stepElapsed,
          });
          return {
            ok: false,
            reason: "loop_detected",
            iterations: iteration,
            totalTokens,
            elapsedMs: Date.now() - start,
          };
        }
      }
    }

    if (result.finishReason === "stop" || toolCalls.length === 0) {
      opts.onStep?.({
        iteration,
        toolCalls: [],
        toolResults: [],
        text: result.text,
        finishReason: result.finishReason,
        inputTokens,
        outputTokens,
        elapsedMs: stepElapsed,
      });
      return {
        ok: true,
        text: result.text,
        iterations: iteration,
        totalTokens,
        elapsedMs: Date.now() - start,
      };
    }

    messages.push(...result.response.messages);

    const toolResults = result.toolResults.map((r) => ({
      name: r.toolName,
      output: r.output,
    }));

    opts.onStep?.({
      iteration,
      toolCalls,
      toolResults,
      finishReason: result.finishReason,
      inputTokens,
      outputTokens,
      elapsedMs: stepElapsed,
    });
  }

  return {
    ok: false,
    reason: "max_iter",
    iterations: maxIter,
    totalTokens,
    elapsedMs: Date.now() - start,
  };
}
