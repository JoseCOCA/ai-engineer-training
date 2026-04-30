/**
 * Matryoshka Representation Learning en práctica.
 *
 * Embedeaa el catálogo con Gemini (3072D) y trunca a 768/256/128
 * para ver cuánto cambia el top-3 en cada dimensión.
 *
 * Nota: Gemini Embedding soporta MRL nativo. Truncar prefijos
 * funciona porque el modelo se entrenó con ese objetivo.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { cosine, productAsDoc, topK, type Product } from "./lib/util.js";

const CATALOG_PATH = fileURLToPath(
  new URL("../data/catalog.json", import.meta.url),
);

const QUERIES = [
  "mochila para senderismo",
  "tienda de campaña para 2 personas",
  "qué llevar para correr en monte",
  "luz para uso nocturno en camping",
  "ropa abrigada para invierno",
];

const DIMENSIONS_TO_TEST = [3072, 768, 256, 128];

function truncateAndNormalize(v: number[], dim: number): number[] {
  const truncated = v.slice(0, dim);
  const norm = Math.sqrt(truncated.reduce((s, x) => s + x * x, 0));
  if (norm === 0) return truncated;
  return truncated.map((x) => x / norm);
}

async function main(): Promise<void> {
  const catalog: Product[] = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const docs = catalog.map(productAsDoc);

  console.log(`Embedeando ${catalog.length} productos con Gemini (3072D)...\n`);
  const { embeddings: corpus3072 } = await embedMany({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    values: docs,
    providerOptions: {
      google: { outputDimensionality: 3072 },
    },
  });

  const truncatedCorpus: Record<number, number[][]> = {};
  for (const d of DIMENSIONS_TO_TEST) {
    truncatedCorpus[d] = corpus3072.map((v) => truncateAndNormalize(v, d));
  }

  const summary: Record<number, number> = { 768: 0, 256: 0, 128: 0 };

  for (const q of QUERIES) {
    console.log(`Query: "${q}"`);
    const { embeddings: queryVecs } = await embedMany({
      model: google.textEmbeddingModel("gemini-embedding-001"),
      values: [q],
      providerOptions: {
        google: { outputDimensionality: 3072 },
      },
    });
    const queryFull = queryVecs[0];

    const tops: Record<number, string[]> = {};
    for (const d of DIMENSIONS_TO_TEST) {
      const queryTrunc = truncateAndNormalize(queryFull, d);
      const top = topK(
        catalog.map((p, i) => ({ p, vec: truncatedCorpus[d][i] })),
        (x) => cosine(queryTrunc, x.vec),
        3,
      );
      tops[d] = top.map((t) => t.item.p.name);
      console.log(`  dim=${String(d).padStart(4)}: ${tops[d].join(" | ")}`);
    }

    for (const d of [768, 256, 128]) {
      const same = JSON.stringify(tops[d]) === JSON.stringify(tops[3072]);
      if (!same) summary[d] += 1;
    }
    console.log("");
  }

  console.log("=== Resumen: top-3 que cambiaron vs 3072 ===");
  for (const d of [768, 256, 128]) {
    console.log(`  dim=${d}: ${summary[d]}/${QUERIES.length} queries cambiaron top-3`);
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
