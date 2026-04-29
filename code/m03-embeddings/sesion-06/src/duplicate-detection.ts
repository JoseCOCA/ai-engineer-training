/**
 * Reto S06: detección de duplicados en el catálogo.
 *
 * Dado un set de candidatos a producto nuevo, marca los que son
 * "probablemente duplicados" de algo ya existente.
 *
 * En producción real, este script se correría antes de aceptar
 * uploads de proveedores nuevos al catálogo.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { embedBatch, cosineSimilarity } from "./lib/embeddings.js";
import type { Product } from "./lib/keyword-search.js";

const CATALOG_PATH = fileURLToPath(
  new URL("../data/catalog.json", import.meta.url),
);

const DUP_THRESHOLD = 0.85;

const NEW_CANDIDATES = [
  "Mochila técnica para excursiones de varios días",
  "Linterna LED frontal con batería USB",
  "Saco de dormir invierno -10°C",
  "Mochila ergonómica trekking 1-2 días",
  "Tienda canadiense 3 personas",
];

function productAsDoc(p: Product): string {
  return `${p.name}. ${p.description}`;
}

async function main(): Promise<void> {
  const catalog: Product[] = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));

  console.log(`Embedeando catálogo (${catalog.length}) + candidatos (${NEW_CANDIDATES.length})...\n`);
  const catalogVectors = await embedBatch(catalog.map(productAsDoc));
  const candidateVectors = await embedBatch(NEW_CANDIDATES);

  for (let i = 0; i < NEW_CANDIDATES.length; i++) {
    const cand = NEW_CANDIDATES[i];
    let bestScore = -1;
    let bestProduct: Product | null = null;

    for (let j = 0; j < catalog.length; j++) {
      const sim = cosineSimilarity(candidateVectors[i], catalogVectors[j]);
      if (sim > bestScore) {
        bestScore = sim;
        bestProduct = catalog[j];
      }
    }

    console.log(`"${cand}"`);
    console.log(`  Mejor match: ${bestProduct?.name} (${bestScore.toFixed(2)})`);
    if (bestScore >= DUP_THRESHOLD) {
      console.log(`  → PROBABLE DUPLICADO`);
    } else if (bestScore >= 0.7) {
      console.log(`  → similar pero no duplicado claro (revisar manual)`);
    } else {
      console.log(`  → producto nuevo, no hay duplicado claro`);
    }
    console.log("");
  }

  console.log(`Umbral de duplicado: ${DUP_THRESHOLD}. Bájalo para más candidatos a revisión, súbelo para menos falsos positivos.`);
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
