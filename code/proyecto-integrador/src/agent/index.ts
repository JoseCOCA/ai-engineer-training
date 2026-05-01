/**
 * API pública del agente multi-agente (M5 + M6).
 *
 * runAgent(query, opts) → { answer, intent, elapsedMs }.
 *
 * En M6 sumamos:
 *  - Trace structurado emitido a Langfuse (si LANGFUSE_* configuradas).
 *  - userId / sessionId opcional para analítica de conversación.
 *  - shutdownAgent() flushea eventos pendientes antes de cerrar.
 */
import { buildSupervisorGraph, type SupervisorState, type Intent } from "./supervisor.js";
import { closeCatalogStore } from "./tools/index.js";
import { startTrace, flushObservability } from "./observability.js";

export interface RunAgentOptions {
  userId?: string;
  sessionId?: string;
}

export interface RunAgentResult {
  answer: string;
  intent: Intent;
  elapsedMs: number;
}

let cachedGraph: ReturnType<typeof buildSupervisorGraph> | null = null;

function getGraph(): ReturnType<typeof buildSupervisorGraph> {
  if (!cachedGraph) {
    cachedGraph = buildSupervisorGraph();
  }
  return cachedGraph;
}

export async function runAgent(
  query: string,
  opts: RunAgentOptions = {},
): Promise<RunAgentResult> {
  const graph = getGraph();
  const start = Date.now();

  const trace = startTrace({
    name: "agent.invoke",
    input: { query },
    userId: opts.userId,
    sessionId: opts.sessionId,
    metadata: { module: "M6", version: "0.6.0" },
  });

  const span = trace.span({ name: "supervisor.graph", input: { query } });

  let result: SupervisorState;
  try {
    result = (await graph.invoke(
      { query, intent: "escalation", answer: "" },
      { recursionLimit: 25 },
    )) as SupervisorState;
    span.end({ output: { intent: result.intent, length: result.answer.length } });
  } catch (err) {
    span.end({ level: "ERROR", statusMessage: (err as Error).message });
    trace.update({ output: { error: (err as Error).message }, level: "ERROR" });
    throw err;
  }

  trace.update({ output: result.answer });

  return {
    answer: result.answer,
    intent: result.intent,
    elapsedMs: Date.now() - start,
  };
}

export async function shutdownAgent(): Promise<void> {
  await flushObservability();
  await closeCatalogStore();
  cachedGraph = null;
}

export type { Intent } from "./supervisor.js";
export { getEscalations } from "./tools/index.js";
