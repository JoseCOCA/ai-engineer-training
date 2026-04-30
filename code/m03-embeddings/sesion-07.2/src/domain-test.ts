/**
 * Test de matiz de dominio.
 *
 * Calcula la similitud entre 5 pares de productos diseñados para
 * probar si el modelo entiende los matices del dominio outdoor.
 *
 * Si los rankings esperados se cumplen, el modelo está bien.
 * Si no, considerá: mejor metadata, pre-filtrar por categoría,
 * fine-tuning del embedder.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { cosine, productAsDoc, type Product } from "./lib/util.js";

const CATALOG_PATH = fileURLToPath(
  new URL("../data/catalog.json", import.meta.url),
);

interface Pair {
  a: string;
  b: string;
  expectedRange: [number, number];
  rationale: string;
}

const PAIRS: Pair[] = [
  {
    a: "TP-MOCH-01",
    b: "TP-MOCH-02",
    expectedRange: [0.7, 0.9],
    rationale: "Ambas mochilas — alto",
  },
  {
    a: "TP-MOCH-01",
    b: "TP-TIENDA-01",
    expectedRange: [0.45, 0.65],
    rationale: "Ambos outdoor pero categorías distintas — medio",
  },
  {
    a: "TP-MOCH-01",
    b: "TP-COCINA-01",
    expectedRange: [0.4, 0.6],
    rationale: "Outdoor con propósito distinto — bajo-medio",
  },
  {
    a: "TP-MOCH-01",
    b: "TP-ROPA-02",
    expectedRange: [0.35, 0.55],
    rationale: "Uso adyacente — bajo-medio",
  },
  {
    a: "TP-MOCH-01",
    b: "TP-ACCS-01",
    expectedRange: [0.3, 0.5],
    rationale: "Categorías muy distintas — bajo",
  },
];

async function main(): Promise<void> {
  const catalog: Product[] = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));

  console.log(`Embedeando ${catalog.length} productos...\n`);
  const docs = catalog.map(productAsDoc);
  const { embeddings: vectors } = await embedMany({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    values: docs,
  });

  const idToVec = new Map<string, number[]>();
  catalog.forEach((p, i) => idToVec.set(p.id, vectors[i]));

  let passed = 0;

  for (const pair of PAIRS) {
    const va = idToVec.get(pair.a);
    const vb = idToVec.get(pair.b);
    if (!va || !vb) continue;

    const sim = cosine(va, vb);
    const inRange =
      sim >= pair.expectedRange[0] && sim <= pair.expectedRange[1];
    const ok = inRange ? "✓" : "✗";
    if (inRange) passed += 1;

    const aName = catalog.find((p) => p.id === pair.a)?.name ?? pair.a;
    const bName = catalog.find((p) => p.id === pair.b)?.name ?? pair.b;
    console.log(
      `${ok} ${aName} vs ${bName}: ${sim.toFixed(2)} (esperado [${pair.expectedRange[0]}-${pair.expectedRange[1]}]) — ${pair.rationale}`,
    );
  }

  console.log("");
  console.log(`Resultado: ${passed}/${PAIRS.length} pares dentro del rango esperado.`);
  if (passed < PAIRS.length) {
    console.log(
      "→ El modelo no captura todos los matices del dominio. Soluciones: mejor metadata en el chunk, pre-filtrar por categoría, o fine-tuning.",
    );
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
