/**
 * Comparativa de métricas: coseno, dot product y L2.
 *
 * 1. Sobre vectores normalizados (default de Gemini), las tres métricas
 *    producen el MISMO ranking.
 * 2. Sobre vectores des-normalizados artificialmente (multiplicados por
 *    una magnitud aleatoria por vector), dot product y L2 se rompen
 *    porque las magnitudes mandan; coseno se mantiene.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import {
  cosine,
  dot,
  l2,
  productAsDoc,
  topK,
  type Product,
} from "./lib/util.js";

const CATALOG_PATH = fileURLToPath(
  new URL("../data/catalog.json", import.meta.url),
);

const QUERIES = [
  "algo para cargar mis cosas en una caminata",
  "tienda de campaña para acampar en familia",
  "iluminación para uso nocturno",
];

function rankNames(
  items: Array<{ p: Product; vec: number[] }>,
  q: number[],
  metric: "cosine" | "dot" | "l2",
): string[] {
  const ascending = metric === "l2";
  const top = topK(
    items,
    (x) => {
      if (metric === "cosine") return cosine(q, x.vec);
      if (metric === "dot") return dot(q, x.vec);
      return l2(q, x.vec);
    },
    3,
    ascending,
  );
  return top.map((t) => t.item.p.name);
}

async function main(): Promise<void> {
  const catalog: Product[] = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const docs = catalog.map(productAsDoc);

  console.log(`Embedeando ${catalog.length} productos con Gemini (768D)...\n`);
  const { embeddings: corpus } = await embedMany({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    values: docs,
  });

  // Versión des-normalizada: cada vector se multiplica por un factor
  // aleatorio en [0.5, 3.0]. Los rankings de dot y L2 deberían romperse.
  const desnormFactors = corpus.map(() => 0.5 + Math.random() * 2.5);
  const corpusDesnorm = corpus.map((v, i) =>
    v.map((x) => x * desnormFactors[i]),
  );

  for (const q of QUERIES) {
    const { embeddings: qVecs } = await embedMany({
      model: google.textEmbeddingModel("gemini-embedding-001"),
      values: [q],
    });
    const qVec = qVecs[0];

    console.log(`Query: "${q}"\n`);

    const itemsNorm = catalog.map((p, i) => ({ p, vec: corpus[i] }));
    console.log("Sobre vectores normalizados:");
    console.log(`  Coseno: ${rankNames(itemsNorm, qVec, "cosine").join(" | ")}`);
    console.log(`  Dot:    ${rankNames(itemsNorm, qVec, "dot").join(" | ")}`);
    console.log(`  L2:     ${rankNames(itemsNorm, qVec, "l2").join(" | ")}`);

    const itemsDesnorm = catalog.map((p, i) => ({
      p,
      vec: corpusDesnorm[i],
    }));
    console.log("\nSobre vectores DES-normalizados artificialmente:");
    console.log(
      `  Coseno: ${rankNames(itemsDesnorm, qVec, "cosine").join(" | ")}`,
    );
    console.log(
      `  Dot:    ${rankNames(itemsDesnorm, qVec, "dot").join(" | ")}`,
    );
    console.log(
      `  L2:     ${rankNames(itemsDesnorm, qVec, "l2").join(" | ")}`,
    );
    console.log("");
  }

  console.log(
    "Conclusión: con vectores normalizados, las 3 métricas producen el mismo ranking.\n" +
      "Si tu modelo no normaliza, normaliza tú antes de indexar — o usa coseno.",
  );
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
