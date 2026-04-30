/**
 * Demo 1 — Hybrid search: dense + sparse (BM25-like) + RRF.
 *
 * Tres queries que muestran:
 *   - dónde dense gana (queries semánticas).
 *   - dónde sparse gana (códigos exactos, jerga rara).
 *   - cómo hybrid captura ambas fortalezas sin tener que decidir a priori.
 */
import { createPool } from "./lib/db.js";
import {
  denseRetrieve,
  fetchProducts,
  hybridRetrieve,
  sparseRetrieve,
} from "./lib/retrievers.js";

const QUERIES = [
  "tengo problemas con TP-MOCH-02",
  "quiero algo con membrana Vibram",
  "mochila para senderismo",
];

const K = 5;

function fmtList(ids: string[], names: Map<string, { name: string }>): string {
  return ids
    .map((id) => `${id}${names.has(id) ? ` (${names.get(id)?.name})` : ""}`)
    .join(", ");
}

async function main(): Promise<void> {
  const pool = createPool();
  try {
    for (const q of QUERIES) {
      console.log(`Query: "${q}"`);

      const [dense, sparse, hybrid] = await Promise.all([
        denseRetrieve(pool, q, K),
        sparseRetrieve(pool, q, K),
        hybridRetrieve(pool, q, K),
      ]);

      const allIds = new Set<string>([
        ...dense.map((r) => r.id),
        ...sparse.map((r) => r.id),
        ...hybrid.map((r) => r.id),
      ]);
      const names = await fetchProducts(pool, [...allIds]);

      console.log(`  Solo denso:   [${fmtList(dense.map((r) => r.id), names)}]`);
      console.log(`  Solo sparse:  [${fmtList(sparse.map((r) => r.id), names)}]`);
      console.log(`  Hybrid (RRF): [${fmtList(hybrid.map((r) => r.id), names)}]`);
      console.log("");
    }

    console.log("Lectura sugerida:");
    console.log("  - Query 1 (código exacto): sparse encuentra TP-MOCH-02; dense suele perderlo.");
    console.log("  - Query 2 (jerga 'Vibram'): sparse encuentra el match exacto; dense alisa.");
    console.log("  - Query 3 (semántica): dense funciona bien; hybrid sostiene la calidad.");
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
