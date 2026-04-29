/**
 * Comparativa empírica: keyword vs semantic search sobre el catálogo
 * de TiendaPro.
 *
 * Ejecuta 5 queries representativas con casos cómodos (matchean por
 * keyword) y casos difíciles (sinónimos, paráfrasis, errores tipo,
 * multilingüe). Imprime top-3 resultados de ambos métodos lado a lado.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { embedBatch, embedOne, cosineSimilarity } from "./lib/embeddings.js";
import { keywordSearch, type Product } from "./lib/keyword-search.js";

const CATALOG_PATH = fileURLToPath(
  new URL("../data/catalog.json", import.meta.url),
);

const QUERIES = [
  "mochila para senderismo de fin de semana",
  "algo para cargar mis cosas en una caminata",
  "rucksack para hiking",
  "estoy buscando una mocila grande",
  "necesito equipo para acampar con mi familia",
];

function productAsDoc(p: Product): string {
  return `${p.name}. ${p.description} Categoría: ${p.category}. Tags: ${p.tags.join(", ")}.`;
}

interface SemanticHit {
  product: Product;
  score: number;
}

function topKSemantic(
  catalogVectors: number[][],
  catalog: Product[],
  queryVec: number[],
  k: number,
): SemanticHit[] {
  return catalog
    .map((p, i) => ({
      product: p,
      score: cosineSimilarity(queryVec, catalogVectors[i]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

async function main(): Promise<void> {
  const catalog: Product[] = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));

  console.log(`Embedeando ${catalog.length} productos del catálogo...\n`);
  const docs = catalog.map(productAsDoc);
  const catalogVectors = await embedBatch(docs);

  for (const query of QUERIES) {
    console.log(`=== Query: "${query}" ===`);

    const kw = keywordSearch(catalog, query, 3);

    const queryVec = await embedOne(query);
    const sem = topKSemantic(catalogVectors, catalog, queryVec, 3);

    const maxRows = Math.max(kw.length, sem.length, 1);
    console.log(`${pad("Keyword", 12)}    ${pad("Semántica", 12)}`);
    for (let i = 0; i < maxRows; i++) {
      const k = kw[i]?.name ?? "(sin resultado)";
      const s = sem[i]
        ? `${sem[i].product.name} (${sem[i].score.toFixed(2)})`
        : "(sin resultado)";
      console.log(`${pad(`${i + 1}. ${k}`, 38)}  ${pad(s, 38)}`);
    }
    console.log("");
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
