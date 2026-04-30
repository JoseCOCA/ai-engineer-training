/**
 * Demo 2 — Context expansion: parent-document a nivel catálogo.
 *
 * Para cada producto recuperado, sumamos 1-2 productos hermanos de la
 * misma categoría como contexto adicional. El LLM gana visión sobre
 * alternativas y puede recomendar comparando.
 *
 * Comparativa: top-3 solo vs top-3 + hermanos.
 */
import { chat } from "@curso-ai/llm";
import { createPool } from "./lib/db.js";
import { denseRetrieve, findSiblingsByCategory, type ProductRow } from "./lib/retrievers.js";

const QUERY = "qué me recomiendan para acampar 4 días con la familia";
const TOP_K = 3;
const SIBLINGS_PER_HIT = 2;

const RAG_SYSTEM = [
  "Eres un asistente del e-commerce TiendaPro.",
  "Respondes ÚNICAMENTE con la información del contexto.",
  "Cuando recomiendes productos, cita el id entre paréntesis.",
  "Si tienes alternativas, compáralas brevemente.",
].join("\n");

function formatContext(items: ProductRow[]): string {
  return items
    .map(
      (p, i) =>
        `[${i + 1}] ${p.id} — ${p.name}\n    ${p.description} Categoría: ${p.category}.`,
    )
    .join("\n");
}

async function ask(query: string, context: ProductRow[], flow: string): Promise<string> {
  const userPrompt = [
    "Contexto recuperado:",
    "---",
    formatContext(context),
    "---",
    "",
    `Pregunta: ${query}`,
  ].join("\n");

  const res = await chat({
    system: RAG_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
    temperature: 0.2,
    flow,
  });
  return res.text;
}

async function main(): Promise<void> {
  const pool = createPool();
  try {
    console.log(`Query: "${QUERY}"\n`);

    const top = await denseRetrieve(pool, QUERY, TOP_K);
    if (top.length === 0) {
      console.log("(retrieval vacío)");
      return;
    }

    console.log("Modo A — top-3 solo:");
    console.log(`  Contexto: ${top.map((p) => p.id).join(", ")}`);
    const respA = await ask(QUERY, top, "m04-s11.1-context-a");
    console.log(`  Respuesta:\n    ${respA.replace(/\n/g, "\n    ")}\n`);

    const expanded: ProductRow[] = [];
    const seen = new Set<string>();
    for (const hit of top) {
      if (!seen.has(hit.id)) {
        expanded.push(hit);
        seen.add(hit.id);
      }
      const siblings = await findSiblingsByCategory(
        pool,
        hit.category,
        [...seen],
        SIBLINGS_PER_HIT,
      );
      for (const s of siblings) {
        if (!seen.has(s.id)) {
          expanded.push(s);
          seen.add(s.id);
        }
      }
    }

    console.log("Modo B — top-3 + hermanos por categoría:");
    console.log(`  Contexto: ${expanded.map((p) => p.id).join(", ")}`);
    const respB = await ask(QUERY, expanded, "m04-s11.1-context-b");
    console.log(`  Respuesta:\n    ${respB.replace(/\n/g, "\n    ")}\n`);

    console.log("Lectura sugerida:");
    console.log("  - El modo B suele dar respuestas más completas con alternativas reales.");
    console.log("  - Coste extra: tokens en el prompt (~30%). Latencia adicional típicamente baja (los hermanos se traen en una sola query).");
    console.log("  - Cuándo NO conviene: si los hermanos son muy distintos al hit original, agregas ruido. Mide en tu eval set.");
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
