/**
 * Setup de full-text search en pgvector.
 *
 * Aplica `sql/01-add-fts.sql` que agrega:
 *  - columna `search_doc` (tsvector ponderado A=name, B=description, C=category)
 *  - índice GIN sobre esa columna
 *
 * Idempotente — corrida múltiple no rompe nada.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createPool } from "./lib/db.js";

const SQL_PATH = fileURLToPath(
  new URL("../sql/01-add-fts.sql", import.meta.url),
);

async function main(): Promise<void> {
  const pool = createPool();
  try {
    const sql = readFileSync(SQL_PATH, "utf8");
    await pool.query(sql);
    console.log("✓ Schema FTS aplicado (search_doc + índice GIN).");

    const res = await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM products WHERE search_doc IS NOT NULL",
    );
    console.log(
      `✓ ${res.rows[0]?.n ?? 0} productos con search_doc poblado (columna generada automáticamente).`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
