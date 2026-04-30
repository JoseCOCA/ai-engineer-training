/**
 * Demo 2 — Faithfulness check programático (LLM judge mini).
 *
 * Dos casos contrastados:
 *   A. Respuesta fiel — toda la info está en el contexto.
 *   B. Respuesta inventada — afirma un dato que NO está en el contexto.
 *
 * Un LLM judge devuelve { faithful, reasoning, unfaithful_claims[] }.
 *
 * En producción, el judge corre fuera del path crítico (CI, monitoreo
 * nocturno) por costo y latencia.
 */
import { z } from "zod";
import { generateObject } from "ai";
import { buildModel, PRIMARY_PROVIDER } from "@curso-ai/llm";

const CONTEXT = [
  {
    id: "TP-MOCH-01",
    text: "Mochila Trekker 30L. Mochila ergonómica de 30L con espalda ventilada, ideal para senderismo de 1 a 2 días. Bolsillo para hidratación.",
  },
];

interface Caso {
  label: string;
  answer: string;
}

const CASOS: Caso[] = [
  {
    label: "A · Respuesta fiel",
    answer:
      "La Mochila Trekker 30L (TP-MOCH-01) tiene espalda ventilada y bolsillo para hidratación, ideal para senderismo de 1 a 2 días.",
  },
  {
    label: "B · Respuesta inventada",
    answer:
      "La Mochila Trekker 30L (TP-MOCH-01) tiene espalda ventilada e incluye un poncho gratis de regalo. Su garantía es de 5 años.",
  },
];

const FaithfulnessSchema = z.object({
  faithful: z.boolean().describe("True si TODOS los claims de la respuesta están soportados por el contexto."),
  reasoning: z.string().describe("Justificación breve (1-2 oraciones)."),
  unfaithful_claims: z
    .array(z.string())
    .describe("Lista de afirmaciones de la respuesta que NO están en el contexto. Vacía si faithful=true."),
});

const JUDGE_SYSTEM = [
  "Eres un evaluador de fidelidad para respuestas RAG.",
  "Recibes un contexto recuperado (documentos) y una respuesta a evaluar.",
  "Tu tarea: identificar afirmaciones de la respuesta que NO estén soportadas por el contexto.",
  "Una afirmación está soportada solo si el contexto la afirma explícita o claramente.",
  "Inventar precios, garantías, regalos, dimensiones o cualquier dato no presente en el contexto se considera no fiel.",
].join("\n");

function formatCtx(): string {
  return CONTEXT.map((c, i) => `[${i + 1}] ${c.id}: ${c.text}`).join("\n");
}

async function judge(answer: string): Promise<z.infer<typeof FaithfulnessSchema>> {
  const { model } = buildModel(PRIMARY_PROVIDER);
  const { object } = await generateObject({
    model,
    schema: FaithfulnessSchema,
    system: JUDGE_SYSTEM,
    prompt: [
      "Contexto:",
      "---",
      formatCtx(),
      "---",
      "",
      `Respuesta a evaluar: "${answer}"`,
    ].join("\n"),
    temperature: 0,
  });
  return object;
}

async function main(): Promise<void> {
  console.log("Contexto compartido:");
  console.log(`  ${formatCtx()}\n`);

  for (const caso of CASOS) {
    console.log(`=== ${caso.label} ===`);
    console.log(`  Respuesta: "${caso.answer}"`);

    const verdict = await judge(caso.answer);

    console.log(`  Judge:`);
    console.log(`    faithful: ${verdict.faithful}`);
    console.log(`    reasoning: ${verdict.reasoning}`);
    if (verdict.unfaithful_claims.length > 0) {
      console.log(`    unfaithful_claims:`);
      for (const c of verdict.unfaithful_claims) {
        console.log(`      - ${c}`);
      }
    }
    console.log("");
  }

  console.log("Lectura sugerida:");
  console.log("  - El judge usa el mismo modelo que la generación. En producción usa uno MÁS capaz (Pro/Sonnet) como judge.");
  console.log("  - Este check NO va en el path crítico: cuesta una llamada extra al LLM por respuesta. Úsalo en CI y monitoreo.");
  console.log("  - RAGAS (S11.3) automatiza esto sobre eval sets enteros.");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
