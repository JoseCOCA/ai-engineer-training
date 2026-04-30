/**
 * Embedea el catálogo y lo persiste en pgvector.
 *
 * Patrón:
 *   1. Embed por lotes (embedMany) → 12 vectores 768D.
 *   2. UPSERT: INSERT ... ON CONFLICT (id) DO UPDATE.
 *   3. Crear índice HNSW al final (build batch).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { createPool, vectorToSql } from "./lib/db.js";
import {
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  embedTexts,
  productAsDoc,
  type Product,
} from "./lib/util.js";

const CATALOG_PATH = fileURLToPath(
  new URL("../data/catalog.json", import.meta.url),
);
const HNSW_PATH = fileURLToPath(
  new URL("../sql/02-index-hnsw.sql", import.meta.url),
);

async function main(): Promise<void> {
  const catalog: Product[] = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const pool = createPool();

  try {
    console.log(
      `Embedeando ${catalog.length} productos con ${EMBEDDING_MODEL} (768D)...`,
    );
    const docs = catalog.map(productAsDoc);
    const vectors = await embedTexts(docs);

    for (let i = 0; i < catalog.length; i++) {
      const p = catalog[i];
      await pool.query(
        `INSERT INTO products
            (id, name, category, description, embedding, embedding_model, embedding_version)
         VALUES ($1, $2, $3, $4, $5::vector, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            description = EXCLUDED.description,
            embedding = EXCLUDED.embedding,
            embedding_model = EXCLUDED.embedding_model,
            embedding_version = EXCLUDED.embedding_version,
            indexed_at = now()`,
        [
          p.id,
          p.name,
          p.category,
          p.description,
          vectorToSql(vectors[i]),
          EMBEDDING_MODEL,
          EMBEDDING_VERSION,
        ],
      );
      console.log(`  ✓ ${p.id.padEnd(14)} — ${p.name}`);
    }

    console.log(
      `\n${catalog.length} productos insertados (model=${EMBEDDING_MODEL}, version=${EMBEDDING_VERSION}).\n`,
    );

    console.log("Construyendo índice HNSW (m=16, ef_construction=64)...");
    const t0 = performance.now();
    await pool.query(readFileSync(HNSW_PATH, "utf8"));
    const elapsed = (performance.now() - t0).toFixed(0);
    console.log(`✓ Índice products_embedding_hnsw_idx listo (${elapsed} ms).\n`);

    const cnt = await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM products",
    );
    const idxSize = await pool.query<{ size: string }>(
      `SELECT pg_size_pretty(pg_relation_size('products_embedding_hnsw_idx')) AS size`,
    );
    console.log("Verificación final:");
    console.log(`  SELECT count(*) FROM products → ${cnt.rows[0].n}`);
    console.log(`  Tamaño del índice: ${idxSize.rows[0].size}`);
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
