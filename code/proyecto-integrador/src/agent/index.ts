/**
 * API pública del agente multi-agente (M5).
 *
 * Una sola función: runAgent(query) → { answer, intent, metrics }.
 *
 * Encapsula el supervisor + workers + tools + sandboxing. Quien
 * consume el agente (src/index.ts) no necesita conocer LangGraph.
 */
import { buildSupervisorGraph, type SupervisorState, type Intent } from "./supervisor.js";
import { closeCatalogStore } from "./tools/index.js";

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

export async function runAgent(query: string): Promise<RunAgentResult> {
  const graph = getGraph();
  const start = Date.now();

  const result = (await graph.invoke(
    { query, intent: "escalation", answer: "" },
    { recursionLimit: 25 },
  )) as SupervisorState;

  return {
    answer: result.answer,
    intent: result.intent,
    elapsedMs: Date.now() - start,
  };
}

export async function shutdownAgent(): Promise<void> {
  await closeCatalogStore();
  cachedGraph = null;
}

export type { Intent } from "./supervisor.js";
export { getEscalations } from "./tools/index.js";
