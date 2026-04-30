/**
 * Comparativa pre-filter vs post-filter sobre la categoría.
 *
 * Ejecuta la misma query bajo cuatro estrategias y muestra el plan que
 * usa Postgres en cada caso.
 */
import { performance } from "node:perf_hooks";
import { createPool, vectorToSql } from "./lib/db.js";
import {
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  embedQuery,
} from "./lib/util.js";

const QUERY = "opciones livianas para uno o dos días";
const CATEGORY_TARGET = "mochilas";

interface Row {
  id: string;
  name: string;
  category: string;
  similarity: number;
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  const r = await fn();
  const ms = (performance.now() - t0).toFixed(1);
  console.log(`   tiempo: ${ms} ms`);
  void label;
  return r;
}

async function main(): Promise<void> {
  const pool = createPool();
  try {
    const qVec = await embedQuery(QUERY);
    const qSql = vectorToSql(qVec);

    console.log(`Query: "${QUERY}"\n`);

    // 1) Sin filtro
    console.log("1) Sin filtro:");
    const r1 = await timed("sin-filtro", () =>
      pool.query<Row>(
        `SELECT id, name, category, (embedding <#> $1::vector) * -1 AS similarity
           FROM products
          WHERE embedding_model = $2 AND embedding_version = $3
          ORDER BY embedding <#> $1::vector
          LIMIT 5`,
        [qSql, EMBEDDING_MODEL, EMBEDDING_VERSION],
      ),
    );
    printTop(r1.rows);

    // 2) Pre-filter por categoría
    console.log(`\n2) Pre-filter category = '${CATEGORY_TARGET}':`);
    const r2 = await timed("pre-filter", () =>
      pool.query<Row>(
        `SELECT id, name, category, (embedding <#> $1::vector) * -1 AS similarity
           FROM products
          WHERE embedding_model = $2 AND embedding_version = $3
            AND category = $4
          ORDER BY embedding <#> $1::vector
          LIMIT 5`,
        [qSql, EMBEDDING_MODEL, EMBEDDING_VERSION, CATEGORY_TARGET],
      ),
    );
    printTop(r2.rows);

    // 3) Post-filter por categoría (top-50 sin filtro, luego filter en código)
    console.log(`\n3) Post-filter category = '${CATEGORY_TARGET}':`);
    const r3 = await timed("post-filter", () =>
      pool.query<Row>(
        `SELECT id, name, category, (embedding <#> $1::vector) * -1 AS similarity
           FROM products
          WHERE embedding_model = $2 AND embedding_version = $3
          ORDER BY embedding <#> $1::vector
          LIMIT 50`,
        [qSql, EMBEDDING_MODEL, EMBEDDING_VERSION],
      ),
    );
    const filtered3 = r3.rows
      .map((r) => ({ ...r, similarity: Number(r.similarity) }))
      .filter((r) => r.category === CATEGORY_TARGET)
      .slice(0, 5);
    console.log("   Antes del filter: " + r3.rows.slice(0, 5).map((r) => r.name).join(" | "));
    console.log("   Después del filter:");
    printTop(filtered3);

    // 4) Pre-filter laxo (timestamp)
    console.log("\n4) Pre-filter laxo (indexed_at en la última hora):");
    const r4 = await timed("pre-filter-laxo", () =>
      pool.query<Row>(
        `SELECT id, name, category, (embedding <#> $1::vector) * -1 AS similarity
           FROM products
          WHERE embedding_model = $2 AND embedding_version = $3
            AND indexed_at > now() - interval '1 hour'
          ORDER BY embedding <#> $1::vector
          LIMIT 5`,
        [qSql, EMBEDDING_MODEL, EMBEDDING_VERSION],
      ),
    );
    printTop(r4.rows);

    console.log("\nLectura:");
    console.log("  - Filtro selectivo (categoría) → planner suele pre-filtrar.");
    console.log("  - Filtro laxo (timestamp) → planner usa el índice ANN.");
    console.log("  - Post-filter es elegante para filtros laxos pero cae si la categoría es minoritaria.");
  } finally {
    await pool.end();
  }
}

function printTop(rows: Array<Row | { name: string; similarity: number | string }>): void {
  if (rows.length === 0) {
    console.log("   (sin resultados)");
    return;
  }
  rows.slice(0, 3).forEach((r, i) => {
    const sim = Number(r.similarity);
    console.log(
      `   ${i + 1}. ${r.name.padEnd(28)} (${sim.toFixed(2)})`,
    );
  });
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
