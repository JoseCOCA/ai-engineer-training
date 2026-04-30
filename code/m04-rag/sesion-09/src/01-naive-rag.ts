/**
 * Demo 1 — RAG ingenuo end-to-end.
 *
 * Pipeline canónico en su versión más simple posible:
 *  1. embedQuery sobre la pregunta del usuario.
 *  2. kNN en pgvector con K + threshold.
 *  3. construir prompt con el contexto recuperado.
 *  4. llamar al LLM y mostrar la respuesta.
 *
 * Este es el punto de partida de cualquier RAG. Antes de meter hybrid
 * search, query rewriting o reranking, asegúrate de que el ingenuo
 * mide bien sobre tu eval set.
 */
import { createPool } from "./lib/db.js";
import { runRag } from "./lib/rag.js";

const QUERY = "¿qué mochila me recomiendas para una caminata de 3 días?";
const K = 3;
const THRESHOLD = 0.55;

async function main(): Promise<void> {
  const pool = createPool();
  try {
    console.log(`Pregunta: "${QUERY}"\n`);

    const result = await runRag(pool, QUERY, {
      k: K,
      threshold: THRESHOLD,
      flow: "m04-s09-naive",
    });

    console.log(`Top-K recuperado (k=${K}, threshold=${THRESHOLD}):`);
    if (result.chunks.length === 0) {
      console.log("  (vacío — ningún producto pasó el threshold)\n");
    } else {
      for (const [i, c] of result.chunks.entries()) {
        console.log(
          `  [${i + 1}] ${c.id} — ${c.name.padEnd(32)} (${c.similarity.toFixed(2)})`,
        );
      }
      console.log("");
    }

    console.log("Respuesta del LLM:");
    console.log(`  ${result.response.text.replace(/\n/g, "\n  ")}\n`);

    console.log(
      `Métricas: provider=${result.response.provider}, modelo=${result.response.modelId}, ` +
        `latencia=${result.response.latencyMs}ms, ` +
        `tokens in/out=${result.response.inputTokens}/${result.response.outputTokens}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
