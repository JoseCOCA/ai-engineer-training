/**
 * Demo 3 — HyDE (Hypothetical Document Embeddings).
 *
 *  1. LLM genera un párrafo "hipotético" como si fuera la descripción del
 *     producto ideal que responde la query.
 *  2. Embedemos ese párrafo (no la query original).
 *  3. Hacemos kNN con ese embedding.
 *
 * Atención: el documento hipotético es un artefacto interno del retrieval.
 * NO se le pasa al LLM final como contexto — solo se usa para encontrar
 * los documentos reales del corpus.
 */
import { generateText } from "ai";
import { buildModel, PRIMARY_PROVIDER } from "@curso-ai/llm";
import { createPool, vectorToSql } from "./lib/db.js";
import { EMBEDDING_MODEL, EMBEDDING_VERSION, embedQuery } from "./lib/embed.js";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { fetchProducts } from "./lib/retrievers.js";

const QUERY = "necesito algo para no pasarme frío arriba en la montaña";
const K = 5;

const HYDE_SYSTEM = [
  "Eres un redactor de fichas de producto de un e-commerce de outdoor (TiendaPro).",
  "Dada una pregunta de un cliente, escribe el párrafo descriptivo del producto IDEAL que respondería a esa pregunta.",
  "Tono: técnico, conciso (3-4 oraciones).",
  "No menciones marca, precio ni stock.",
  "Centra la descripción en características funcionales (material, capacidad, peso, uso recomendado).",
].join("\n");

async function generateHypotheticalDoc(query: string): Promise<string> {
  const { model } = buildModel(PRIMARY_PROVIDER);
  const { text } = await generateText({
    model,
    system: HYDE_SYSTEM,
    prompt: `Pregunta del cliente: "${query}"`,
    temperature: 0.3,
    maxOutputTokens: 200,
  });
  return text.trim();
}

async function embedDoc(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: google.textEmbeddingModel(EMBEDDING_MODEL),
    value: text,
  });
  return embedding;
}

async function knnByVector(
  pool: import("pg").Pool,
  vector: number[],
  k: number,
): Promise<Array<{ id: string; similarity: number }>> {
  const qSql = vectorToSql(vector);
  const res = await pool.query<{ id: string; similarity: string }>(
    `SELECT id, (embedding <#> $1::vector) * -1 AS similarity
       FROM products
      WHERE embedding_model = $2 AND embedding_version = $3
      ORDER BY embedding <#> $1::vector
      LIMIT $4`,
    [qSql, EMBEDDING_MODEL, EMBEDDING_VERSION, k],
  );
  return res.rows.map((r) => ({ id: r.id, similarity: Number(r.similarity) }));
}

async function main(): Promise<void> {
  const pool = createPool();
  try {
    console.log(`Query: "${QUERY}"\n`);

    console.log("Modo A — Embedding directo de la query:");
    const directVec = await embedQuery(QUERY);
    const directRanked = await knnByVector(pool, directVec, K);
    const directNames = await fetchProducts(
      pool,
      directRanked.map((r) => r.id),
    );
    for (const r of directRanked) {
      console.log(
        `  ${r.id} — ${directNames.get(r.id)?.name ?? "?"} (sim ${r.similarity.toFixed(2)})`,
      );
    }
    console.log("");

    console.log("Modo B — HyDE:");
    const hypothetical = await generateHypotheticalDoc(QUERY);
    console.log(`  Documento hipotético generado:\n    "${hypothetical}"\n`);

    const hydeVec = await embedDoc(hypothetical);
    const hydeRanked = await knnByVector(pool, hydeVec, K);
    const hydeNames = await fetchProducts(
      pool,
      hydeRanked.map((r) => r.id),
    );
    for (const r of hydeRanked) {
      console.log(
        `  ${r.id} — ${hydeNames.get(r.id)?.name ?? "?"} (sim ${r.similarity.toFixed(2)})`,
      );
    }
    console.log("");

    console.log("Lectura sugerida:");
    console.log("  - Las similitudes con HyDE suelen ser más altas porque el doc hipotético cae más cerca del estilo del corpus.");
    console.log("  - Coste: +1 LLM call (~500-1000ms).");
    console.log("  - Recuerda: el doc hipotético NO se pasa al LLM final. Solo se usa para encontrar los productos reales.");
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
