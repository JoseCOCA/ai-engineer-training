/**
 * Calibración de threshold con pares etiquetados.
 *
 * Lee data/labeled-pairs.json (queries con productId + label
 * "relevant" / "irrelevant"), embedea todo, calcula la similitud
 * coseno de cada par y muestra:
 *   - histograma ASCII de positivos vs negativos
 *   - estadísticos (μ, σ, mín, máx, p5)
 *   - threshold sugerido = p5 de los positivos
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import {
  asciiHistogram,
  cosine,
  mean,
  percentile,
  productAsDoc,
  stddev,
  type Product,
} from "./lib/util.js";

interface LabeledPair {
  query: string;
  productId: string;
  label: "relevant" | "irrelevant";
}

const CATALOG_PATH = fileURLToPath(
  new URL("../data/catalog.json", import.meta.url),
);
const PAIRS_PATH = fileURLToPath(
  new URL("../data/labeled-pairs.json", import.meta.url),
);

async function main(): Promise<void> {
  const catalog: Product[] = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const pairs: LabeledPair[] = JSON.parse(readFileSync(PAIRS_PATH, "utf8"));

  const uniqueQueries = Array.from(new Set(pairs.map((p) => p.query)));

  console.log(
    `Embedeando ${catalog.length} productos y ${uniqueQueries.length} queries únicas...\n`,
  );

  const { embeddings: corpusVecs } = await embedMany({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    values: catalog.map(productAsDoc),
  });
  const productIdToVec = new Map<string, number[]>();
  catalog.forEach((p, i) => productIdToVec.set(p.id, corpusVecs[i]));

  const { embeddings: queryVecs } = await embedMany({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    values: uniqueQueries,
  });
  const queryToVec = new Map<string, number[]>();
  uniqueQueries.forEach((q, i) => queryToVec.set(q, queryVecs[i]));

  const positives: number[] = [];
  const negatives: number[] = [];

  for (const pair of pairs) {
    const qv = queryToVec.get(pair.query);
    const pv = productIdToVec.get(pair.productId);
    if (!qv || !pv) continue;
    const sim = cosine(qv, pv);
    if (pair.label === "relevant") positives.push(sim);
    else negatives.push(sim);
  }

  const bins: number[] = [];
  for (let v = 0.25; v <= 0.85; v += 0.05) bins.push(Number(v.toFixed(2)));

  console.log("=== Distribución de similitudes ===\n");
  console.log(
    asciiHistogram(
      [
        { name: "negativos", values: negatives, char: "░" },
        { name: "positivos", values: positives, char: "▓" },
      ],
      bins,
      40,
    ),
  );
  console.log("");
  console.log(`Negativos (n=${negatives.length}):`);
  console.log(
    `  μ=${mean(negatives).toFixed(3)}  σ=${stddev(negatives).toFixed(3)}  ` +
      `mín=${Math.min(...negatives).toFixed(3)}  máx=${Math.max(...negatives).toFixed(3)}`,
  );
  console.log(`Positivos (n=${positives.length}):`);
  console.log(
    `  μ=${mean(positives).toFixed(3)}  σ=${stddev(positives).toFixed(3)}  ` +
      `mín=${Math.min(...positives).toFixed(3)}  ` +
      `p5=${percentile(positives, 5).toFixed(3)}  ` +
      `máx=${Math.max(...positives).toFixed(3)}`,
  );

  const tau = percentile(positives, 5);
  const fnRate =
    positives.filter((s) => s < tau).length / Math.max(positives.length, 1);
  const fpRate =
    negatives.filter((s) => s >= tau).length / Math.max(negatives.length, 1);

  console.log("");
  console.log(`Threshold sugerido (p5 de positivos): τ = ${tau.toFixed(3)}`);
  console.log(
    `  Falsos negativos esperados: ${(fnRate * 100).toFixed(1)}% de positivos descartados.`,
  );
  console.log(
    `  Falsos positivos esperados: ${(fpRate * 100).toFixed(1)}% de negativos sobre el umbral.`,
  );
  console.log("");
  console.log(
    "Recuerda: este threshold es específico al modelo (Gemini), al corpus (TiendaPro)\n" +
      "y al idioma (español). Si cambia algo, recalibra con un set nuevo.",
  );
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
