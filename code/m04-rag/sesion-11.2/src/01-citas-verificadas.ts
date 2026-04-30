/**
 * Demo 1 — Citas verificadas con structured output.
 *
 *  1. Retrieval top-3 sobre la query.
 *  2. generateObject con schema { answer, citations[] } forzado por zod.
 *  3. Validación: cada source_id citado debe estar en el contexto.
 *  4. Si la validación falla, se imprime el error (en producción haríamos retry con feedback).
 */
import { z } from "zod";
import { generateObject } from "ai";
import { buildModel, PRIMARY_PROVIDER } from "@curso-ai/llm";
import { createPool } from "./lib/db.js";
import { retrieveProducts, type ProductRow } from "./lib/retrieve.js";

const QUERY = "qué mochila me recomiendan para senderismo de un día";
const K = 3;

const RagAnswerSchema = z.object({
  answer: z.string().describe("Respuesta natural al usuario, con IDs entre paréntesis."),
  citations: z
    .array(
      z.object({
        source_id: z.string(),
        claim: z.string().describe("Fragmento de la respuesta que esta cita apoya."),
      }),
    )
    .describe("Lista de citas explícitas, una por afirmación."),
});

const SYSTEM_PROMPT = [
  "Eres un asistente del e-commerce TiendaPro.",
  "Respondes ÚNICAMENTE con la información del contexto.",
  "Si el contexto no contiene la respuesta, responde con answer='No tengo información sobre eso' y citations=[].",
  "Cita el id de cada producto que menciones en answer (entre paréntesis) Y en citations.",
].join("\n");

function formatContext(items: ProductRow[]): string {
  if (items.length === 0) return "(sin resultados relevantes)";
  return items
    .map(
      (p, i) =>
        `[${i + 1}] ${p.id} — ${p.name}\n    ${p.description} Categoría: ${p.category}.`,
    )
    .join("\n");
}

interface ValidationResult {
  ok: boolean;
  invalidCitations: string[];
  missingFromAnswer: string[];
}

function validateCitations(
  output: z.infer<typeof RagAnswerSchema>,
  context: ProductRow[],
): ValidationResult {
  const contextIds = new Set(context.map((c) => c.id));
  const invalidCitations = output.citations
    .map((c) => c.source_id)
    .filter((id) => !contextIds.has(id));

  const idsInAnswer = [...output.answer.matchAll(/TP-[A-Z]+-\d+/g)].map((m) => m[0]);
  const missingFromAnswer = output.citations
    .map((c) => c.source_id)
    .filter((id) => !idsInAnswer.includes(id));

  return {
    ok: invalidCitations.length === 0,
    invalidCitations,
    missingFromAnswer,
  };
}

async function main(): Promise<void> {
  const pool = createPool();
  try {
    console.log(`Query: "${QUERY}"\n`);

    const context = await retrieveProducts(pool, QUERY, K, 0.55);
    console.log(`Contexto recuperado: ${context.map((c) => c.id).join(", ") || "(vacío)"}`);

    const { model } = buildModel(PRIMARY_PROVIDER);
    const { object } = await generateObject({
      model,
      schema: RagAnswerSchema,
      system: SYSTEM_PROMPT,
      prompt: [
        "Contexto:",
        "---",
        formatContext(context),
        "---",
        "",
        `Pregunta: ${QUERY}`,
      ].join("\n"),
      temperature: 0.2,
    });

    console.log("\nRespuesta estructurada:");
    console.log(`  answer: "${object.answer}"`);
    console.log("  citations:");
    for (const c of object.citations) {
      console.log(`    [${c.source_id}] ${c.claim}`);
    }

    const validation = validateCitations(object, context);
    console.log("\nValidación:");
    if (validation.ok) {
      console.log("  ✓ Todas las citas corresponden a productos del contexto.");
    } else {
      console.log(`  ✗ Citas inválidas: ${validation.invalidCitations.join(", ")}`);
    }
    if (validation.missingFromAnswer.length > 0) {
      console.log(
        `  ⚠ IDs en citations que no aparecen en answer: ${validation.missingFromAnswer.join(", ")}`,
      );
    }

    console.log("\nLectura sugerida:");
    console.log("  - El schema con zod garantiza que SIEMPRE haya citas (aunque sean vacías para queries OOD).");
    console.log("  - La validación de IDs es Nivel 1: el chequeo más barato y eficaz contra invención de fuentes.");
    console.log("  - En producción, si validation.ok=false, retry con feedback al LLM o devolver error al usuario.");
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
