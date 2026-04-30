/**
 * Demo 1 — LLM-as-reranker (listwise).
 *
 *  1. Retrieval denso ingenuo top-15 sobre la query.
 *  2. Una llamada listwise a Gemini Flash que devuelve el ranking
 *     reordenado por relevancia funcional.
 *  3. Comparativa: top-5 ingenuo vs top-5 reranked.
 *
 * El reranker entiende intent (botas != zapatillas) mientras que la
 * similitud denso solo mide cercanía semántica.
 */
import { createPool } from "./lib/db.js";
import { denseRetrieve } from "./lib/retrievers.js";
import { listwiseRerank } from "./lib/rerank.js";

const QUERY = "necesito botas que aguanten lluvia y barro";
const RETRIEVE_K = 15;
const FINAL_K = 5;

async function main(): Promise<void> {
  const pool = createPool();
  try {
    console.log(`Query: "${QUERY}"\n`);

    const candidates = await denseRetrieve(pool, QUERY, RETRIEVE_K);
    if (candidates.length === 0) {
      console.log("(retrieval vacío — verifica que el catálogo esté indexado)");
      return;
    }

    console.log(`Retrieval ingenuo top-${candidates.length}:`);
    candidates.slice(0, FINAL_K).forEach((c, i) => {
      console.log(
        `  ${(i + 1).toString().padStart(2)}. ${c.id.padEnd(14)} ${c.name.padEnd(32)} (${(c.similarity ?? 0).toFixed(2)})`,
      );
    });
    console.log("");

    const start = Date.now();
    const reranked = await listwiseRerank(
      QUERY,
      candidates.map((c) => ({
        id: c.id,
        text: `${c.name}. ${c.description} Categoría: ${c.category}.`,
      })),
    );
    const elapsedMs = Date.now() - start;

    const byId = new Map(candidates.map((c) => [c.id, c]));

    console.log(`LLM reranking listwise (${elapsedMs}ms):`);
    reranked.slice(0, FINAL_K).forEach((id, i) => {
      const c = byId.get(id);
      const originalRank = candidates.findIndex((x) => x.id === id) + 1;
      const movedFrom = originalRank !== i + 1 ? ` ← era #${originalRank}` : "";
      console.log(
        `  ${(i + 1).toString().padStart(2)}. ${id.padEnd(14)} ${(c?.name ?? "?").padEnd(32)}${movedFrom}`,
      );
    });
    console.log("");

    console.log("Lectura sugerida:");
    console.log("  - Si el reranker movió botas por encima de zapatillas, es una señal de que entiende intent y no solo similitud.");
    console.log("  - Coste: 1 LLM call (típicamente ~500-1000ms con Flash). Latencia constante respecto a N candidatos hasta donde quepa el context window.");
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
