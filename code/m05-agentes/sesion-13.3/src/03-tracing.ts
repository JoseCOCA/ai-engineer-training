/**
 * Demo 3 — Trace logging estructurado.
 *
 * Cada step del grafo se persiste a logs/agent-trace.jsonl con un formato
 * compatible con observabilidad estándar:
 *   { trace_id, span_id, parent_span_id, name, start_time, end_time,
 *     duration_ms, metadata }
 *
 * En producción esto se exporta a Langfuse / LangSmith / OpenTelemetry.
 * Acá lo dejamos en archivo para mostrar la estructura.
 */
import { writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { randomBytes } from "node:crypto";

const LOG_PATH = fileURLToPath(new URL("../logs/agent-trace.jsonl", import.meta.url));

interface Span {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  name: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  metadata: Record<string, unknown>;
}

function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

function ensureLogFile(): void {
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  writeFileSync(LOG_PATH, "");
}

function emitSpan(span: Span): void {
  appendFileSync(LOG_PATH, JSON.stringify(span) + "\n");
}

const State = Annotation.Root({
  query: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
  intent: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
  answer: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
  trace_id: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
});

type StateType = typeof State.State;

async function withSpan<T>(
  trace_id: string,
  parent_span_id: string | null,
  name: string,
  metadata: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const span_id = randomId("spn");
  const startMs = Date.now();
  const start_time = new Date(startMs).toISOString();
  const result = await fn();
  const endMs = Date.now();
  emitSpan({
    trace_id,
    span_id,
    parent_span_id,
    name,
    start_time,
    end_time: new Date(endMs).toISOString(),
    duration_ms: endMs - startMs,
    metadata,
  });
  return result;
}

async function classify(state: StateType): Promise<Partial<StateType>> {
  return withSpan(state.trace_id, null, "classify", { input_chars: state.query.length }, async () => {
    await new Promise((r) => setTimeout(r, 80));
    const intent = state.query.toLowerCase().includes("mochila") ? "catalog" : "general";
    return { intent };
  });
}

async function answer(state: StateType): Promise<Partial<StateType>> {
  return withSpan(state.trace_id, null, "answer", { intent: state.intent }, async () => {
    await new Promise((r) => setTimeout(r, 120));
    const answer =
      state.intent === "catalog"
        ? `[mock] Tenemos varias mochilas. Te paso 3 opciones.`
        : `[mock] No estoy seguro de poder ayudarte con eso.`;
    return { answer };
  });
}

const graph = new StateGraph(State)
  .addNode("classify", classify)
  .addNode("answer", answer)
  .addEdge(START, "classify")
  .addEdge("classify", "answer")
  .addEdge("answer", END)
  .compile();

async function main(): Promise<void> {
  ensureLogFile();

  const queries = [
    "¿Tienen mochilas?",
    "¿Cuál es la capital de Francia?",
  ];

  for (const query of queries) {
    const trace_id = randomId("trc");
    console.log(`=== Query: "${query}" (trace_id=${trace_id}) ===`);
    const result = await withSpan(trace_id, null, "agent.invoke", { query }, async () => {
      return graph.invoke({ query, intent: "", answer: "", trace_id });
    });
    console.log(`  intent=${result.intent}, answer="${result.answer}"\n`);
  }

  console.log(`Spans escritos en: ${LOG_PATH}`);
  console.log("");
  console.log("Análisis sugerido:");
  console.log("  cat logs/agent-trace.jsonl | jq 'select(.name==\"answer\") | .duration_ms'");
  console.log("  cat logs/agent-trace.jsonl | jq -s 'group_by(.name) | map({step:.[0].name, avg:(map(.duration_ms)|add/length)})'");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
