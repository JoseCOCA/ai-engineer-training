/**
 * Búsqueda con top-K + threshold mínimo + EXPLAIN ANALYZE.
 *
 * Operador <#> (dot product negativo): pgvector lo invierte para que
 * ORDER BY ... ASC corresponda a similitud descendente. Multiplicamos
 * por -1 al imprimir para que el score sea legible.
 */
import { createPool, vectorToSql } from "./lib/db.js";
import {
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  embedQuery,
} from "./lib/util.js";

const QUERIES = [
  "algo para cargar mis cosas en una caminata",
  "iluminación para uso nocturno",
  "tienda de campaña para cuatro personas",
  "texto absurdo que no debería matchear nada xyz123",
];

const THRESHOLD = 0.55;
const K = 10;

interface Row {
  id: string;
  name: string;
  category: string;
  similarity: number;
}

async function main(): Promise<void> {
  const pool = createPool();
  try {
    for (const q of QUERIES) {
      const qVec = await embedQuery(q);
      const qSql = vectorToSql(qVec);

      const res = await pool.query<Row>(
        `SELECT id, name, category, (embedding <#> $1::vector) * -1 AS similarity
           FROM products
          WHERE embedding_model = $2 AND embedding_version = $3
          ORDER BY embedding <#> $1::vector
          LIMIT $4`,
        [qSql, EMBEDDING_MODEL, EMBEDDING_VERSION, K],
      );

      const filtered = res.rows
        .map((r) => ({ ...r, similarity: Number(r.similarity) }))
        .filter((r) => r.similarity >= THRESHOLD);

      console.log(`Query: "${q}"`);
      console.log(`  Top con similitud >= ${THRESHOLD}:`);
      if (filtered.length === 0) {
        console.log("    (vacío)");
        console.log(
          "    → Mejor un retorno vacío que K resultados irrelevantes.",
        );
      } else {
        filtered.slice(0, 5).forEach((r, i) => {
          console.log(
            `    ${i + 1}. ${r.name.padEnd(28)} (${r.similarity.toFixed(2)})`,
          );
        });
      }
      console.log("");
    }

    // EXPLAIN ANALYZE sobre la primera query
    const firstVec = await embedQuery(QUERIES[0]);
    const explain = await pool.query<{ "QUERY PLAN": string }>(
      `EXPLAIN ANALYZE
       SELECT id, name FROM products
       WHERE embedding_model = $2 AND embedding_version = $3
       ORDER BY embedding <#> $1::vector
       LIMIT 10`,
      [vectorToSql(firstVec), EMBEDDING_MODEL, EMBEDDING_VERSION],
    );
    console.log(`EXPLAIN ANALYZE para la primera query:`);
    for (const row of explain.rows) {
      console.log(`  ${row["QUERY PLAN"]}`);
    }
    console.log(
      "\nNota: con N=12 el planner suele caer a Seq Scan; el índice HNSW empieza a ganar a partir de unos miles de filas.",
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
