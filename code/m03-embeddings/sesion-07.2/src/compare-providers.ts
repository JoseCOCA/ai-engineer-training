/**
 * Comparativa Gemini vs OpenAI sobre el mismo corpus.
 *
 * Si OPENAI_API_KEY no está configurada, salta esa parte y muestra
 * solo Gemini.
 *
 * Punto clave del ejercicio: las similitudes coseno NO son
 * comparables entre modelos. Lo que importa es el ranking dentro de
 * cada modelo.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { cosine, productAsDoc, topK, type Product } from "./lib/util.js";

const CATALOG_PATH = fileURLToPath(
  new URL("../data/catalog.json", import.meta.url),
);

const QUERIES = [
  "algo para cargar mis cosas en una caminata",
  "necesito iluminar el sendero de noche",
  "rucksack para hiking de fin de semana",
];

async function main(): Promise<void> {
  const catalog: Product[] = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const docs = catalog.map(productAsDoc);

  console.log(`Embedeando ${catalog.length} productos con cada modelo...\n`);

  const { embeddings: geminiCorpus } = await embedMany({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    values: docs,
  });

  let openaiCorpus: number[][] | null = null;
  if (process.env.OPENAI_API_KEY) {
    const r = await embedMany({
      model: openai.textEmbeddingModel("text-embedding-3-small"),
      values: docs,
    });
    openaiCorpus = r.embeddings;
  } else {
    console.log("(OPENAI_API_KEY no configurada → solo Gemini.)\n");
  }

  for (const q of QUERIES) {
    console.log(`Query: "${q}"\n`);

    const { embeddings: geminiQ } = await embedMany({
      model: google.textEmbeddingModel("gemini-embedding-001"),
      values: [q],
    });

    const geminiTop = topK(
      catalog.map((p, i) => ({ p, vec: geminiCorpus[i] })),
      (x) => cosine(geminiQ[0], x.vec),
      3,
    );

    console.log(`Gemini (768D):`);
    geminiTop.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.item.p.name.padEnd(28)} (${r.score.toFixed(2)})`);
    });

    if (openaiCorpus) {
      const { embeddings: oaiQ } = await embedMany({
        model: openai.textEmbeddingModel("text-embedding-3-small"),
        values: [q],
      });
      const oaiTop = topK(
        catalog.map((p, i) => ({ p, vec: openaiCorpus![i] })),
        (x) => cosine(oaiQ[0], x.vec),
        3,
      );
      console.log(`OpenAI (1536D):`);
      oaiTop.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.item.p.name.padEnd(28)} (${r.score.toFixed(2)})`);
      });
    }
    console.log("");
  }

  console.log(
    "Recordá: las similitudes absolutas NO son comparables entre modelos. Lo que importa es el ranking.",
  );
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
