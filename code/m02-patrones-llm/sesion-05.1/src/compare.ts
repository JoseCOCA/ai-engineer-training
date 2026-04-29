/**
 * Comparativa empírica: full-content vs query-then-inject.
 *
 * Misma pregunta, mismo modelo, distinta estrategia de inyección.
 * Reporta tokens, latencia y costo de cada uno.
 *
 * Precios USD/1M (snapshot abr-2026):
 *  - google:gemini-2.5-flash → input $0.20, output $1.00
 *  - anthropic:claude-haiku-4-5 → input $1.00, output $5.00
 *  - openai:gpt-4o-mini → input $0.15, output $0.60
 *  - ollama:* → 0 (local)
 */
import { generateText } from "ai";
import { llm, providerInUse } from "./lib/llm.js";
import { findProducts, loadCatalog } from "./lib/catalog.js";

const QUESTION = "Busco una mochila para senderismo de 1-2 días.";

const PRICE: Record<string, { in: number; out: number }> = {
  google: { in: 0.2, out: 1.0 },
  anthropic: { in: 1.0, out: 5.0 },
  openai: { in: 0.15, out: 0.6 },
  ollama: { in: 0, out: 0 },
};

const SYSTEM_BASE =
  "Eres el asistente de TiendaPro, un e-commerce outdoor. Responde de forma concisa, recomendando productos del catálogo proporcionado.";

function priceUsd(provider: string, inT: number, outT: number): number {
  const p = PRICE[provider] ?? { in: 0, out: 0 };
  return (inT / 1_000_000) * p.in + (outT / 1_000_000) * p.out;
}

interface Stats {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
  text: string;
}

async function fullContent(): Promise<Stats> {
  const catalog = loadCatalog();
  const system = `${SYSTEM_BASE}\n\nCatálogo completo (${catalog.length} productos):\n${JSON.stringify(catalog, null, 2)}`;

  const start = Date.now();
  const result = await generateText({
    model: llm,
    system,
    prompt: QUESTION,
    temperature: 0.3,
    maxOutputTokens: 250,
  });
  const latencyMs = Date.now() - start;

  return {
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    latencyMs,
    costUsd: priceUsd(providerInUse, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
    text: result.text,
  };
}

async function queryThenInject(): Promise<Stats> {
  const products = findProducts(QUESTION, { limit: 3, onlyInStock: true });
  const system = `${SYSTEM_BASE}\n\nProductos relevantes para la consulta:\n${JSON.stringify(products, null, 2)}`;

  const start = Date.now();
  const result = await generateText({
    model: llm,
    system,
    prompt: QUESTION,
    temperature: 0.3,
    maxOutputTokens: 250,
  });
  const latencyMs = Date.now() - start;

  return {
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    latencyMs,
    costUsd: priceUsd(providerInUse, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
    text: result.text,
  };
}

function printStats(label: string, s: Stats): void {
  console.log(`=== ${label} ===`);
  console.log(`Input tokens:  ${s.inputTokens}`);
  console.log(`Output tokens: ${s.outputTokens}`);
  console.log(`Latencia:      ${s.latencyMs}ms`);
  console.log(`Costo:         $${s.costUsd.toFixed(6)}`);
  console.log("");
  console.log(s.text);
  console.log("");
}

async function main(): Promise<void> {
  console.log(`Pregunta: "${QUESTION}"\n`);

  const full = await fullContent();
  printStats("Full-content", full);

  const queried = await queryThenInject();
  printStats("Query-then-inject", queried);

  const inputReduction = ((1 - queried.inputTokens / full.inputTokens) * 100).toFixed(0);
  const costReduction = ((1 - queried.costUsd / full.costUsd) * 100).toFixed(0);

  console.log(`Reducción de input: ${inputReduction}%`);
  console.log(`Reducción de costo: ${costReduction}%`);
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
