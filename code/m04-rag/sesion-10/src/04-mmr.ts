/**
 * Demo 4 — MMR (Maximum Marginal Relevance) para diversidad.
 *
 *  1. kNN con K=10 sobre una query amplia.
 *  2. Top-5 naive (los 5 más similares a la query).
 *  3. Top-5 con MMR (λ=0.7) sobre los 10 candidatos.
 *  4. Comparativa lado a lado.
 *
 * Cuando el corpus tiene clusters densos (ej: muchas mochilas similares),
 * MMR cambia la experiencia del usuario al evitar resultados clónicos.
 */
import { createPool } from "./lib/db.js";
import { embedQuery } from "./lib/embed.js";
import { denseRetrieve, fetchProductsWithEmbeddings } from "./lib/retrievers.js";
import { mmr } from "./lib/mmr.js";

const QUERY = "equipamiento para acampar";
const POOL_SIZE = 10;
const TOP_K = 5;
const LAMBDA = 0.7;

async function main(): Promise<void> {
  const pool = createPool();
  try {
    console.log(`Query: "${QUERY}"\n`);

    const candidates = await denseRetrieve(pool, QUERY, POOL_SIZE);
    if (candidates.length === 0) {
      console.log("(retrieval vacío — verifica que el catálogo esté indexado)");
      return;
    }

    const naiveTopK = candidates.slice(0, TOP_K).map((r) => r.id);

    const enriched = await fetchProductsWithEmbeddings(
      pool,
      candidates.map((c) => c.id),
    );
    const queryVec = await embedQuery(QUERY);
    const mmrTopK = mmr(
      queryVec,
      enriched.map((p) => ({ id: p.id, embedding: p.embedding })),
      TOP_K,
      LAMBDA,
    );

    const enrichedById = new Map(enriched.map((p) => [p.id, p]));

    console.log(`Top-${TOP_K} naive (ranking puro):`);
    naiveTopK.forEach((id, i) => {
      const p = enrichedById.get(id);
      console.log(`  ${i + 1}. ${id.padEnd(14)} ${p?.name ?? "?"} [${p?.category ?? "?"}]`);
    });
    console.log("");

    console.log(`Top-${TOP_K} con MMR (λ=${LAMBDA}):`);
    mmrTopK.forEach((id, i) => {
      const p = enrichedById.get(id);
      console.log(`  ${i + 1}. ${id.padEnd(14)} ${p?.name ?? "?"} [${p?.category ?? "?"}]`);
    });
    console.log("");

    console.log("Lectura sugerida:");
    console.log("  - λ=1.0 colapsa a ranking puro (idéntico al naive).");
    console.log("  - λ=0.0 ignora la query y solo busca diversidad.");
    console.log("  - 0.5–0.7 es el sweet spot para asistentes conversacionales.");
    console.log("  - El efecto se nota más cuando el corpus tiene clusters densos. Con N=12 productos diversos, la diferencia es sutil.");
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
