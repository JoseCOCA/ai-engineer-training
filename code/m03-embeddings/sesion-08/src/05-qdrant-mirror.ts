/**
 * Mirror del catálogo en Qdrant. Opcional — requiere el perfil docker
 * 'qdrant':
 *
 *   docker compose --profile qdrant up -d qdrant
 *
 * Conecta a http://localhost:6333, recrea la colección 'products' y
 * ejecuta la misma query que el ejercicio 4 con filtro por categoría
 * para comparar la API con pgvector.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { QdrantClient } from "@qdrant/js-client-rest";
import {
  EMBEDDING_MODEL,
  embedTexts,
  embedQuery,
  productAsDoc,
  type Product,
} from "./lib/util.js";

const CATALOG_PATH = fileURLToPath(
  new URL("../data/catalog.json", import.meta.url),
);

const COLLECTION = "products";
const QDRANT_URL =
  process.env.QDRANT_URL ?? `http://localhost:${process.env.QDRANT_PORT ?? "6333"}`;

async function main(): Promise<void> {
  const catalog: Product[] = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const client = new QdrantClient({ url: QDRANT_URL });

  // Recrear colección (idempotente para los ejercicios).
  const exists = await client.collectionExists(COLLECTION);
  if (exists.exists) {
    await client.deleteCollection(COLLECTION);
  }
  await client.createCollection(COLLECTION, {
    vectors: { size: 768, distance: "Dot" },
  });
  console.log(
    `Qdrant collection '${COLLECTION}' creada (size=768, distance=Dot).`,
  );

  // Embedear y subir.
  const docs = catalog.map(productAsDoc);
  const vectors = await embedTexts(docs);

  await client.upsert(COLLECTION, {
    wait: true,
    points: catalog.map((p, i) => ({
      id: i + 1,
      vector: vectors[i],
      payload: {
        product_id: p.id,
        name: p.name,
        category: p.category,
        embedding_model: EMBEDDING_MODEL,
      },
    })),
  });
  console.log(`${catalog.length} puntos insertados con payload.\n`);

  // Query con filtro por categoría.
  const QUERY = "opciones livianas para uno o dos días";
  const CATEGORY_TARGET = "mochilas";

  const qVec = await embedQuery(QUERY);
  const result = await client.search(COLLECTION, {
    vector: qVec,
    limit: 5,
    filter: {
      must: [{ key: "category", match: { value: CATEGORY_TARGET } }],
    },
  });

  console.log(`Query: "${QUERY}"`);
  console.log(`Filter: category == "${CATEGORY_TARGET}"\n`);
  console.log("Resultados (Qdrant):");
  result.forEach((r, i) => {
    const name = (r.payload?.name as string) ?? "?";
    console.log(
      `  ${i + 1}. ${name.padEnd(28)} (score=${r.score.toFixed(2)})`,
    );
  });

  console.log("\nComparativa rápida con pgvector:");
  console.log("  • Misma calidad (modelo idéntico).");
  console.log("  • Latencia similar a este volumen.");
  console.log(
    "  • API: Qdrant integra el filtro al search, sin pensar pre/post.",
  );
  console.log(
    "  • Operación: Qdrant es servicio extra; pgvector vive en tu DB.",
  );
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
