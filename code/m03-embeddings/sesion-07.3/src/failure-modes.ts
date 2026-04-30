/**
 * Modos de fallo de la búsqueda semántica densa.
 *
 * Tres queries problemáticas contra TiendaPro:
 *   1. SKU literal — el embedder no entiende identificadores opacos.
 *   2. Negación — los modelos densos diluyen el "sin".
 *   3. Número con unidades — el modelo no distingue "30L" de "65L".
 *
 * El script imprime el top-3 con score y un comentario sobre la
 * mitigación recomendada, sin implementarla (la implementación
 * estructural va en M4).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { cosine, productAsDoc, topK, type Product } from "./lib/util.js";

const CATALOG_PATH = fileURLToPath(
  new URL("../data/catalog.json", import.meta.url),
);

interface Case {
  query: string;
  problem: string;
  mitigation: string;
}

const CASES: Case[] = [
  {
    query: "TP-MOCH-01",
    problem: "SKU literal — sin significado semántico para el embedder.",
    mitigation:
      "Detectar el patrón ^TP-[A-Z]+-\\d+$ con regex y match exacto por id antes de pasar al retrieval semántico.",
  },
  {
    query: "mochila sin compartimento para laptop",
    problem:
      'Negación: los modelos densos diluyen el "sin". El top-1 acaba siendo justamente la mochila CON compartimento para laptop.',
    mitigation:
      'Parser de query (LLM o reglas) que separa "deseado" de "descartado" + filtro post-retrieval por metadata estructurada.',
  },
  {
    query: "mochila de 30 litros",
    problem:
      "Las 3 mochilas del catálogo aparecen con scores parecidos. El embedder no usa los 30L como discriminante fuerte.",
    mitigation:
      "Extraer número + unidad de la query (LLM o regex), filtrar por metadata (capacity_liters ≈ 30) y luego rankear semántico sobre el subconjunto.",
  },
];

async function main(): Promise<void> {
  const catalog: Product[] = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const docs = catalog.map(productAsDoc);

  console.log(`Embedeando ${catalog.length} productos...\n`);
  const { embeddings: corpus } = await embedMany({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    values: docs,
  });

  const queries = CASES.map((c) => c.query);
  const { embeddings: qVecs } = await embedMany({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    values: queries,
  });

  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    const qVec = qVecs[i];
    const top = topK(
      catalog.map((p, j) => ({ p, vec: corpus[j] })),
      (x) => cosine(qVec, x.vec),
      3,
    );

    console.log(`Query: "${c.query}"`);
    top.forEach((r, idx) => {
      console.log(
        `  ${idx + 1}. ${r.item.p.name.padEnd(28)} (${r.score.toFixed(2)})`,
      );
    });
    console.log(`→ Problema: ${c.problem}`);
    console.log(`  Mitigación: ${c.mitigation}`);
    console.log("");
  }

  console.log(
    "Estos fallos no se resuelven cambiando el modelo de embeddings.\n" +
      "La solución estructural es hybrid search (denso + léxico + filtros)\n" +
      "y la vamos a implementar en M4 — S10.",
  );
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
