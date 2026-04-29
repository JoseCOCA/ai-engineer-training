/**
 * Imprime la matriz de similitud coseno entre todos los productos
 * del catálogo. Permite ver el "espacio semántico" desde adentro:
 * qué productos están cerca de qué.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { embedBatch, cosineSimilarity } from "./lib/embeddings.js";
import type { Product } from "./lib/keyword-search.js";

const CATALOG_PATH = fileURLToPath(
  new URL("../data/catalog.json", import.meta.url),
);

function productAsDoc(p: Product): string {
  return `${p.name}. ${p.description} Categoría: ${p.category}. Tags: ${p.tags.join(", ")}.`;
}

function shortName(name: string, len = 6): string {
  return name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, len);
}

async function main(): Promise<void> {
  const catalog: Product[] = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));

  console.log(`Embedeando ${catalog.length} productos...\n`);
  const docs = catalog.map(productAsDoc);
  const vectors = await embedBatch(docs);

  const labels = catalog.map((p) => shortName(p.name));

  process.stdout.write("                      ");
  labels.forEach((l) => process.stdout.write(`${l.padStart(6)} `));
  console.log("");

  for (let i = 0; i < catalog.length; i++) {
    process.stdout.write(catalog[i].name.padEnd(22).slice(0, 22));
    for (let j = 0; j < catalog.length; j++) {
      const sim = cosineSimilarity(vectors[i], vectors[j]);
      process.stdout.write(`${sim.toFixed(2).padStart(6)} `);
    }
    console.log("");
  }

  console.log("");
  console.log("Observaciones:");
  console.log("- 1.00 en la diagonal: todo producto es idéntico a sí mismo.");
  console.log("- Productos de la misma categoría tienen similitud alta entre sí (~0.7-0.85).");
  console.log("- Productos de categorías relacionadas (ej. botas y mochilas → senderismo) caen ~0.5-0.65.");
  console.log("- Productos no relacionados (linterna vs chaqueta) caen ~0.3-0.45.");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
