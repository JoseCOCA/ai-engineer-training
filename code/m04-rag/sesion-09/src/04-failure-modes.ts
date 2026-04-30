/**
 * Demo 4 — Provocar los modos de fallar del RAG.
 *
 * Cuatro escenarios que reproducen los modos descritos en el README §4.6:
 *   A. Query OOD con threshold sano → retrieval vacío + LLM dice "no sé".
 *   B. Misma query con threshold=0 → entra contexto irrelevante → alucinación
 *      grounded.
 *   C. Falso positivo del retriever → contexto plausible pero off-topic.
 *   D. Recall bajo simulado (K=1) → respuesta estrecha, alternativas perdidas.
 *
 * Reconocer cada modo en producción es la mitad del debug.
 */
import { createPool } from "./lib/db.js";
import { runRag } from "./lib/rag.js";

interface Scenario {
  label: string;
  query: string;
  k: number;
  threshold: number;
  comentario: string;
}

const SCENARIOS: Scenario[] = [
  {
    label: "A · Query OOD con threshold sano (0.55)",
    query: "¿Cuál es la capital de Marte?",
    k: 3,
    threshold: 0.55,
    comentario:
      "Esperado: retrieval vacío, respuesta 'No tengo información'. Correcto.",
  },
  {
    label: "B · Misma query con threshold=0",
    query: "¿Cuál es la capital de Marte?",
    k: 3,
    threshold: 0,
    comentario:
      "Esperado: entran chunks irrelevantes, riesgo alto de alucinación grounded.",
  },
  {
    label: "C · Falso positivo del retriever",
    query: "¿Hacen envíos rápidos y baratos?",
    k: 3,
    threshold: 0.4,
    comentario:
      "Esperado: el retriever puede traer productos cuya descripción matchea palabras pero no responden la política de envíos.",
  },
  {
    label: "D · Recall bajo (K=1) sobre pregunta amplia",
    query: "¿Qué opciones tienen para acampar con familia?",
    k: 1,
    threshold: 0.5,
    comentario:
      "Esperado: una sola opción, perdiendo alternativas relevantes (subir K + reranking lo arregla).",
  },
];

async function main(): Promise<void> {
  const pool = createPool();
  try {
    for (const sc of SCENARIOS) {
      console.log(`=== ${sc.label} ===`);
      console.log(`Query: "${sc.query}"`);
      console.log(`Setup: k=${sc.k}, threshold=${sc.threshold}`);
      console.log(`${sc.comentario}\n`);

      const result = await runRag(pool, sc.query, {
        k: sc.k,
        threshold: sc.threshold,
        flow: `m04-s09-failure-${sc.label[0].toLowerCase()}`,
      });

      const chunks =
        result.chunks.length === 0
          ? "(retrieval vacío)"
          : result.chunks
              .map((c) => `${c.id}@${c.similarity.toFixed(2)}`)
              .join(", ");
      console.log(`  Chunks: ${chunks}`);
      console.log(`  Respuesta: ${result.response.text.replace(/\n/g, "\n  ")}\n`);
    }

    console.log("Lectura sugerida:");
    console.log(
      "  - A vs B: el threshold no es un parámetro decorativo. Bajarlo convierte 'no sé' honesto en alucinación.",
    );
    console.log(
      "  - C: cuando el retriever falla por similitud léxica, la solución es hybrid search + reranking (S10/S11).",
    );
    console.log(
      "  - D: recall bajo es un problema del retriever, no del LLM. Subir K + reranking es el patrón estándar.",
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
