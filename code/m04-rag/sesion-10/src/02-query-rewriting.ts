/**
 * Demo 2 — Query rewriting con LLM + multi-query con RRF.
 *
 *  1. LLM cheap (Gemini Flash) reescribe la query del usuario en 3 variantes.
 *  2. Hacemos dense retrieval con la original + las 3 variantes (4 búsquedas).
 *  3. Fusionamos los rankings con RRF.
 *  4. Comparamos contra el retrieval directo.
 */
import { z } from "zod";
import { generateObject } from "ai";
import { buildModel, PRIMARY_PROVIDER } from "@curso-ai/llm";
import { createPool } from "./lib/db.js";
import { denseRetrieve, fetchProducts } from "./lib/retrievers.js";
import { rrf } from "./lib/rrf.js";

const QUERY = "algo grande para llevar cosas";
const K = 5;

const VariantsSchema = z.object({
  variantes: z.array(z.string()).length(3),
});

const REWRITER_SYSTEM = [
  "Reescribe la pregunta del usuario en 3 variantes alternativas para mejorar la búsqueda en un catálogo de productos de outdoor (mochilas, tiendas, ropa, calzado, accesorios).",
  "- Una variante con sinónimos cercanos a la pregunta original.",
  "- Una variante más específica (descompone si la query mezcla intents).",
  "- Una variante con jerga del dominio (técnico, travesías, expedición).",
  "Devuelve siempre exactamente 3 variantes.",
].join("\n");

async function rewrite(query: string): Promise<string[]> {
  const { model } = buildModel(PRIMARY_PROVIDER);
  const { object } = await generateObject({
    model,
    schema: VariantsSchema,
    system: REWRITER_SYSTEM,
    prompt: `Pregunta original: "${query}"`,
    temperature: 0.3,
  });
  return object.variantes;
}

async function main(): Promise<void> {
  const pool = createPool();
  try {
    console.log(`Query original: "${QUERY}"\n`);

    const start = Date.now();
    const variants = await rewrite(QUERY);
    const rewriteMs = Date.now() - start;

    console.log("Variantes generadas:");
    variants.forEach((v, i) => console.log(`  [${i + 1}] ${v}`));
    console.log(`(rewriting: ${rewriteMs}ms)\n`);

    const direct = await denseRetrieve(pool, QUERY, K);
    const allRankings = await Promise.all(
      [QUERY, ...variants].map((q) => denseRetrieve(pool, q, K)),
    );
    const fused = rrf(allRankings.map((r) => r.map((x) => x.id))).slice(0, K);

    const allIds = new Set<string>([
      ...direct.map((r) => r.id),
      ...fused.map((r) => r.id),
    ]);
    const names = await fetchProducts(pool, [...allIds]);

    const fmt = (ids: string[]): string =>
      ids.map((id) => `${id} (${names.get(id)?.name ?? "?"})`).join(", ");

    console.log("Retrieval directo (sin rewriting):");
    console.log(`  ${fmt(direct.map((r) => r.id))}\n`);

    console.log("Retrieval con multi-query + RRF:");
    console.log(`  ${fmt(fused.map((r) => r.id))}\n`);

    console.log("Lectura sugerida:");
    console.log("  - Si la query original es vaga, las variantes deberían acercar el ranking a productos del dominio.");
    console.log("  - Coste extra: 1 LLM call (~500-800ms) + 3 retrievals adicionales en paralelo.");
    console.log("  - Para queries específicas (con id de producto), el rewriting puede DILUIR la especificidad. Mídelo.");
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
