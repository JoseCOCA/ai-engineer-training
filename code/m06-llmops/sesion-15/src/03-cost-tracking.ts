/**
 * Demo 3 — Cost tracking por flow.
 *
 * Simula 30 invocaciones del agente con tres tipos de query
 * (catalog, orders, escalation). Para cada una calcula el costo en
 * USD y agrega por flow. Imprime un reporte CPQ.
 *
 * Precios usados: Gemini 2.5 Flash (paid tier) — input $0.30/1M, output $2.50/1M
 * (snapshot al 2026-04; consulta ai.google.dev para precios actuales).
 */
import { priceFor } from "@curso-ai/llm";

interface MockInvocation {
  flow: "catalog" | "orders" | "escalation";
  inputTokens: number;
  outputTokens: number;
}

function mockInvocation(): MockInvocation {
  const r = Math.random();
  if (r < 0.5) {
    return {
      flow: "catalog",
      inputTokens: 1200 + Math.floor(Math.random() * 800),
      outputTokens: 80 + Math.floor(Math.random() * 120),
    };
  }
  if (r < 0.85) {
    return {
      flow: "orders",
      inputTokens: 350 + Math.floor(Math.random() * 200),
      outputTokens: 50 + Math.floor(Math.random() * 80),
    };
  }
  return {
    flow: "escalation",
    inputTokens: 250 + Math.floor(Math.random() * 150),
    outputTokens: 60 + Math.floor(Math.random() * 100),
  };
}

interface FlowStats {
  calls: number;
  totalInput: number;
  totalOutput: number;
  totalCost: number;
}

async function main(): Promise<void> {
  const N = 30;
  const stats: Record<string, FlowStats> = {};

  for (let i = 0; i < N; i++) {
    const inv = mockInvocation();
    const cost = priceFor("google", "gemini-2.5-flash", {
      inputTokens: inv.inputTokens,
      outputTokens: inv.outputTokens,
      reasoningTokens: 0,
    });

    const acc = stats[inv.flow] ?? { calls: 0, totalInput: 0, totalOutput: 0, totalCost: 0 };
    acc.calls += 1;
    acc.totalInput += inv.inputTokens;
    acc.totalOutput += inv.outputTokens;
    acc.totalCost += cost;
    stats[inv.flow] = acc;
  }

  console.log(`=== Cost tracking — ${N} invocaciones simuladas ===\n`);

  console.log(
    "Flow            Calls   Avg in/out tokens     Avg cost      Total cost",
  );
  console.log(
    "-----------     -----   ------------------    ----------    -----------",
  );

  let grandTotal = 0;
  let grandCalls = 0;
  for (const [flow, acc] of Object.entries(stats)) {
    const avgIn = (acc.totalInput / acc.calls).toFixed(0);
    const avgOut = (acc.totalOutput / acc.calls).toFixed(0);
    const avgCost = (acc.totalCost / acc.calls).toFixed(6);
    const total = acc.totalCost.toFixed(6);
    console.log(
      `${flow.padEnd(15)} ${acc.calls.toString().padStart(5)}   ${avgIn.padStart(6)} / ${avgOut.padStart(6).padEnd(8)}    $${avgCost}  $${total}`,
    );
    grandTotal += acc.totalCost;
    grandCalls += acc.calls;
  }

  const cpq = grandTotal / grandCalls;
  console.log("");
  console.log(`CPQ promedio: $${cpq.toFixed(6)}`);
  console.log(`Proyección a 10K queries/día: $${(cpq * 10_000).toFixed(2)}`);
  console.log(`Proyección a 1M queries/mes: $${(cpq * 1_000_000).toFixed(2)}`);

  console.log("");
  console.log("Lectura sugerida:");
  console.log("  - El flow 'catalog' es el más caro (RAG + rerank consumen más tokens).");
  console.log("  - Si tu producto es free-tier, esos costos tienen que ser bajos.");
  console.log("  - Optimizaciones obvias: reducir tokens de input via mejor prompting + caching de respuestas frecuentes.");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
