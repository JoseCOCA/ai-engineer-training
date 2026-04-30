/**
 * Indexa el catálogo de TiendaPro en pgvector.
 *
 * Pasos:
 *   1. Aplica el schema (idempotente).
 *   2. Embedea los 12 productos con Gemini Embedding.
 *   3. UPSERT en products con embedding_model + embedding_version.
 *
 * El índice HNSW vive en el SQL del schema y se crea idempotente.
 *
 * Uso:
 *   docker compose up -d postgres
 *   pnpm run index-catalog
 */
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { loadCatalog, type Product } from "../src/lib/catalog.js";
import { PgVectorStore } from "../src/retrieval/index.js";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_VERSION = 1;

function productAsDoc(p: Product): string {
  const tagsTxt = p.tags.length > 0 ? ` Etiquetas: ${p.tags.join(", ")}.` : "";
  return `${p.name}. ${p.description} Categoría: ${p.category}.${tagsTxt}`;
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: google.textEmbeddingModel(EMBEDDING_MODEL),
    values: texts,
  });
  return embeddings;
}

async function main(): Promise<void> {
  const catalog = loadCatalog();
  console.log(
    `Indexando ${catalog.length} productos con ${EMBEDDING_MODEL} (768D)...`,
  );

  const store = new PgVectorStore({
    embedder: async (text) => (await embedTexts([text]))[0],
    embeddingModel: EMBEDDING_MODEL,
    embeddingVersion: EMBEDDING_VERSION,
  });

  try {
    await store.applySchema();
    console.log("✓ Schema aplicado.");

    const docs = catalog.map(productAsDoc);
    const vectors = await embedTexts(docs);

    await store.upsertProducts(
      catalog.map((p, i) => ({ ...p, embedding: vectors[i] })),
    );
    const total = await store.count();
    console.log(
      `✓ ${total} productos en pgvector (model=${EMBEDDING_MODEL}, version=${EMBEDDING_VERSION}).`,
    );

    const sample = await store.searchProducts({
      query: "mochila para senderismo",
      k: 3,
      threshold: 0.5,
    });
    console.log("\nTest de humo — query 'mochila para senderismo':");
    sample.forEach((r, i) => {
      console.log(
        `  ${i + 1}. ${r.name.padEnd(28)} (${r.similarity.toFixed(2)})`,
      );
    });
  } finally {
    await store.close();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
