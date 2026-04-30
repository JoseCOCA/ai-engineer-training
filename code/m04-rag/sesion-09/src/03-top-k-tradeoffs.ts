/**
 * Demo 3 — Trade-offs de top-K.
 *
 * Misma query, distintos K. Reportamos latencia, tokens y respuesta.
 * El objetivo es ver el codo: a partir de qué K dejas de ganar calidad
 * y solo sumas costo y latencia.
 */
import { createPool } from "./lib/db.js";
import { runRag } from "./lib/rag.js";

const QUERY = "¿qué tienen para senderismo de varios días?";
const KS = [1, 3, 10];
const THRESHOLD = 0.5;

async function main(): Promise<void> {
  const pool = createPool();
  try {
    console.log(`Query: "${QUERY}"\n`);

    for (const k of KS) {
      const result = await runRag(pool, QUERY, {
        k,
        threshold: THRESHOLD,
        flow: `m04-s09-topk-${k}`,
      });

      const chunkSummary =
        result.chunks.length === 0
          ? "(vacío)"
          : result.chunks.map((c) => `${c.id}@${c.similarity.toFixed(2)}`).join(", ");

      console.log(`--- K=${k} ---`);
      console.log(`  Chunks: ${chunkSummary}`);
      console.log(
        `  Latencia: ${result.response.latencyMs}ms · ` +
          `tokens in/out: ${result.response.inputTokens}/${result.response.outputTokens}`,
      );
      console.log(`  Respuesta: ${result.response.text.replace(/\n/g, " ").slice(0, 220)}...\n`);
    }

    console.log("Lectura sugerida:");
    console.log("  - K=1 puede dejar afuera alternativas relevantes.");
    console.log("  - K=3 suele ser el sweet spot para asistentes conversacionales.");
    console.log("  - K=10 sube tokens de input (y costo) sin necesariamente subir calidad.");
    console.log("  - El 'codo' depende del corpus: mídelo con tu eval set, no a ojo.");
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
