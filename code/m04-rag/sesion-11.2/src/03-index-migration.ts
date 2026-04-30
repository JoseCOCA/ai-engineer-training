/**
 * Demo 3 — Migración de modelo de embeddings simulada (dual-write + switch + GC).
 *
 * Para no requerir un segundo modelo real, simulamos la migración cambiando
 * solo `embedding_version` (1 → 2). En migración real, también cambiaría el
 * vector porque el modelo nuevo viviría en otro espacio.
 *
 * Pasos:
 *   1. Estado inicial: rows con version=1.
 *   2. Dual-write: insertamos rows con version=2 (mismo embedding por simplicidad).
 *   3. Comparación: query con version=1 vs version=2. En migración real, los
 *      resultados diferirían.
 *   4. GC: borramos rows con version=1.
 *   5. Verificación: queries siguen funcionando.
 *
 * Al final del script, restauramos el estado inicial para que el resto del
 * curso funcione (re-insertamos version=1 y borramos version=2).
 */
import { createPool, vectorToSql } from "./lib/db.js";
import { EMBEDDING_MODEL, embedQuery } from "./lib/embed.js";
import { retrieveProducts } from "./lib/retrieve.js";

const QUERY = "mochila para senderismo";

interface CountRow {
  n: string;
}

async function countByVersion(pool: import("pg").Pool, version: number): Promise<number> {
  const res = await pool.query<CountRow>(
    "SELECT count(*)::text AS n FROM products WHERE embedding_model = $1 AND embedding_version = $2",
    [EMBEDDING_MODEL, version],
  );
  return Number.parseInt(res.rows[0]?.n ?? "0", 10);
}

async function main(): Promise<void> {
  const pool = createPool();
  try {
    console.log("=== Paso 1: estado inicial ===");
    const initialV1 = await countByVersion(pool, 1);
    const initialV2 = await countByVersion(pool, 2);
    console.log(`  v1: ${initialV1} rows · v2: ${initialV2} rows\n`);

    if (initialV1 === 0) {
      console.log("(no hay rows v1; corre la ingesta de S08 primero: pnpm --filter @curso-ai/m03-sesion-08 ingest-catalog)");
      return;
    }

    console.log("=== Paso 2: dual-write — insertando v2 (simulado) ===");
    await pool.query(
      `INSERT INTO products (id, name, category, description, embedding,
                             embedding_model, embedding_version)
       SELECT id || '_v2', name, category, description, embedding,
              embedding_model, 2
         FROM products
        WHERE embedding_model = $1 AND embedding_version = 1
       ON CONFLICT (id) DO NOTHING`,
      [EMBEDDING_MODEL],
    );
    const afterDualV1 = await countByVersion(pool, 1);
    const afterDualV2 = await countByVersion(pool, 2);
    console.log(`  v1: ${afterDualV1} rows · v2: ${afterDualV2} rows`);
    console.log("  (los IDs v2 tienen sufijo _v2 para no chocar con la PK; en migración real iría en columna nueva o tabla nueva)\n");

    console.log("=== Paso 3: comparación de resultados v1 vs v2 ===");
    const v1Res = await retrieveProducts(pool, QUERY, 3, 0, 1);
    const v2Res = await retrieveProducts(pool, QUERY, 3, 0, 2);
    console.log(`  Query: "${QUERY}"`);
    console.log(`  v1 → ${v1Res.map((r) => r.id).join(", ")}`);
    console.log(`  v2 → ${v2Res.map((r) => r.id).join(", ")}`);
    console.log("  (en migración real, comparar con un eval set y decidir si hacer el switch)\n");

    console.log("=== Paso 4: GC — borrando rows v2 simulados (rollback del demo) ===");
    const del = await pool.query(
      "DELETE FROM products WHERE embedding_model = $1 AND embedding_version = 2",
      [EMBEDDING_MODEL],
    );
    console.log(`  Borrados: ${del.rowCount} rows\n`);

    console.log("=== Paso 5: estado final ===");
    const finalV1 = await countByVersion(pool, 1);
    const finalV2 = await countByVersion(pool, 2);
    console.log(`  v1: ${finalV1} rows · v2: ${finalV2} rows`);
    console.log("  ✓ Estado restaurado al inicial; el resto del curso sigue funcionando.\n");

    console.log("Lectura sugerida:");
    console.log("  - El patrón real: dual-write → smoke test con eval set → switch atómico (variable de entorno) → GC tras safety period.");
    console.log("  - El versionado en el schema (embedding_model + embedding_version) es lo que hace todo esto posible sin downtime.");
    console.log("  - NUNCA sobrescribir embeddings in-place. Romperás el ranking durante toda la ventana de migración.");

    await embedQuery("warmup");
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
