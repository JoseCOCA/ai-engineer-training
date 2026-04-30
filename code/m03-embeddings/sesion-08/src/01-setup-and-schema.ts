/**
 * Aplica el schema base (extensión vector + tabla products + índice
 * sobre model+version). Es idempotente: se puede correr múltiples veces.
 *
 * No crea el índice HNSW — eso lo hace 02-ingest-catalog.ts después
 * del bulk insert (build batch es más eficiente que mantener el índice
 * incrementalmente durante INSERTs).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createPool } from "./lib/db.js";

const SCHEMA_PATH = fileURLToPath(
  new URL("../sql/01-schema.sql", import.meta.url),
);

async function main(): Promise<void> {
  const pool = createPool();
  try {
    const sql = readFileSync(SCHEMA_PATH, "utf8");
    await pool.query(sql);

    const versionRes = await pool.query<{ extversion: string }>(
      "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
    );
    console.log(
      `✓ Extensión vector instalada (versión ${versionRes.rows[0]?.extversion ?? "?"})`,
    );

    const colsRes = await pool.query<{
      column_name: string;
      data_type: string;
      udt_name: string;
    }>(
      `SELECT column_name, data_type, udt_name
         FROM information_schema.columns
        WHERE table_name = 'products'
        ORDER BY ordinal_position`,
    );
    console.log("✓ Tabla products creada con columnas:");
    for (const r of colsRes.rows) {
      console.log(
        `    ${r.column_name.padEnd(20)} ${r.udt_name === "vector" ? "vector(768)" : r.data_type}`,
      );
    }

    const idxRes = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'products' ORDER BY indexname`,
    );
    for (const r of idxRes.rows) {
      console.log(`✓ Índice ${r.indexname}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
