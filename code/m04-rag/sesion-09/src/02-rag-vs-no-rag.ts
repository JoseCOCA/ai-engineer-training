/**
 * Demo 2 — RAG vs no-RAG, lado a lado.
 *
 * Tres queries que representan tres escenarios:
 *  A. específica del catálogo → RAG aporta.
 *  B. asesoramiento general → RAG puede sesgar y no aportar.
 *  C. invención plausible → RAG previene alucinación.
 *
 * El objetivo no es decidir un ganador, sino mostrar que RAG es una
 * decisión de routing: aplicarla siempre o nunca son ambos errores.
 */
import { createPool } from "./lib/db.js";
import { runRag, runWithoutRag } from "./lib/rag.js";

interface Scenario {
  label: string;
  query: string;
  intent: string;
}

const SCENARIOS: Scenario[] = [
  {
    label: "A · Específica del catálogo",
    query: "¿Tienen una linterna para acampar?",
    intent: "el usuario pregunta por un producto concreto del catálogo",
  },
  {
    label: "B · Asesoramiento general",
    query: "¿Qué cosas debería llevar en mi primera salida de trekking?",
    intent: "consejo general; el catálogo puede ayudar pero no es la pregunta principal",
  },
  {
    label: "C · Invención plausible",
    query: "¿Cuál es la garantía de la mochila azul XYZ-9999?",
    intent: "producto que NO existe; sin RAG el LLM podría inventar",
  },
];

function printResponse(label: string, text: string, latencyMs: number, tokensIn: number): void {
  console.log(`  ${label} (${latencyMs}ms, ${tokensIn} input tokens):`);
  console.log(`    ${text.replace(/\n/g, "\n    ")}\n`);
}

async function main(): Promise<void> {
  const pool = createPool();
  try {
    for (const sc of SCENARIOS) {
      console.log(`=== ${sc.label} ===`);
      console.log(`Query: "${sc.query}"`);
      console.log(`Intent: ${sc.intent}\n`);

      const noRag = await runWithoutRag(sc.query, { flow: "m04-s09-no-rag" });
      printResponse("Sin RAG", noRag.text, noRag.latencyMs, noRag.inputTokens);

      const withRag = await runRag(pool, sc.query, {
        k: 3,
        threshold: 0.55,
        flow: "m04-s09-with-rag",
      });
      const chunkSummary =
        withRag.chunks.length === 0
          ? "(retrieval vacío)"
          : withRag.chunks.map((c) => c.id).join(", ");
      console.log(`  Chunks recuperados: ${chunkSummary}`);
      printResponse(
        "Con RAG",
        withRag.response.text,
        withRag.response.latencyMs,
        withRag.response.inputTokens,
      );
    }

    console.log("Lectura sugerida:");
    console.log("  - A: RAG debería aportar productos concretos con id.");
    console.log("  - B: RAG puede sesgar la respuesta hacia productos cuando la pregunta es asesoramiento.");
    console.log("  - C: RAG previene la invención al devolver vacío o irrelevante y forzar el 'no tengo información'.");
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
