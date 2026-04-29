/**
 * Lee logs/calls.jsonl y agrega costo y volumen por flow.
 *
 * En producción, esto lo hace tu sistema de observabilidad
 * (Langfuse, Helicone, Grafana). Acá lo hacemos en local para
 * mostrar el patrón conceptual.
 */
import { readFileSync, existsSync } from "node:fs";
import { getLogFilePath } from "./lib/logger.js";

interface LogRecord {
  flow: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

interface FlowAgg {
  count: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  totalLatencyMs: number;
}

function main(): void {
  const path = getLogFilePath();

  if (!existsSync(path)) {
    console.log("No hay logs aún. Corre `pnpm run flow-demo` primero.");
    return;
  }

  const content = readFileSync(path, "utf8").trim();
  if (!content) {
    console.log("Log vacío.");
    return;
  }

  const records: LogRecord[] = content
    .split("\n")
    .map((line) => JSON.parse(line) as LogRecord);

  const byFlow = new Map<string, FlowAgg>();

  for (const r of records) {
    const flow = r.flow ?? "unknown";
    const existing = byFlow.get(flow) ?? {
      count: 0,
      costUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalLatencyMs: 0,
    };
    existing.count += 1;
    existing.costUsd += r.costUsd ?? 0;
    existing.inputTokens += r.inputTokens ?? 0;
    existing.outputTokens += r.outputTokens ?? 0;
    existing.totalLatencyMs += r.latencyMs ?? 0;
    byFlow.set(flow, existing);
  }

  console.log("=== Costo por flow (todo el log) ===");
  console.log("");

  let totalCost = 0;
  let totalCount = 0;

  const sorted = Array.from(byFlow.entries()).sort(
    (a, b) => b[1].costUsd - a[1].costUsd,
  );

  for (const [flow, agg] of sorted) {
    const avgLatency = Math.round(agg.totalLatencyMs / agg.count);
    console.log(
      `  ${flow.padEnd(22)} $${agg.costUsd.toFixed(6).padStart(10)}  ${String(agg.count).padStart(4)} llamadas  avg ${avgLatency}ms`,
    );
    totalCost += agg.costUsd;
    totalCount += agg.count;
  }

  console.log("");
  console.log(
    `  ${"TOTAL".padEnd(22)} $${totalCost.toFixed(6).padStart(10)}  ${String(totalCount).padStart(4)} llamadas`,
  );
}

main();
