/**
 * Demo del patrón LLM-as-validator.
 *
 *  1. Generamos una respuesta normal con generateText.
 *  2. La pasamos por reviewAnswer (segundo LLM con schema).
 *  3. Medimos latencia y costo extra del paso de validación.
 *
 * Ojo: este patrón duplica latencia y costo. Está pensado para
 * casos críticos o eval offline, NO para cada turno en producción.
 */
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { llm } from "./lib/llm.js";

const reviewSchema = z.object({
  isAcceptable: z.boolean().describe("Si la respuesta cumple los criterios."),
  issues: z
    .array(
      z.enum(["tono_no_amable", "menciona_competidor", "info_inventada", "off_topic", "respuesta_incompleta"]),
    )
    .describe("Lista de problemas detectados; vacío si OK."),
  suggestion: z
    .string()
    .max(200)
    .optional()
    .describe("Si isAcceptable=false, sugerencia corta de mejora."),
});

type Review = z.infer<typeof reviewSchema>;

const QUESTION = "Quiero comprar una mochila de senderismo. ¿Cuál me recomiendas?";

const SYSTEM_BASE = `Eres el asistente virtual de TiendaPro. Sé amable, conciso y mantente en el dominio del e-commerce. NO menciones competidores ni inventes datos sobre productos específicos del catálogo.`;

const SYSTEM_REVIEWER = `Eres un revisor de calidad de respuestas para soporte de e-commerce TiendaPro. Evalúas si una respuesta:
1. Tiene tono amable y profesional.
2. NO menciona competidores (Amazon, MercadoLibre, etc.).
3. NO inventa datos específicos sobre productos del catálogo.
4. Está en el dominio del e-commerce.
5. Está completa para la pregunta.

Devuelve isAcceptable=false si detectás cualquier problema.`;

async function reviewAnswer(question: string, answer: string): Promise<Review> {
  const { object } = await generateObject({
    model: llm,
    system: SYSTEM_REVIEWER,
    prompt: `Pregunta del cliente: ${question}\nRespuesta del asistente: ${answer}`,
    schema: reviewSchema,
    temperature: 0,
  });
  return object;
}

async function main(): Promise<void> {
  console.log("Pregunta:", QUESTION);
  console.log("");

  const t1 = Date.now();
  const draft = await generateText({
    model: llm,
    system: SYSTEM_BASE,
    prompt: QUESTION,
    temperature: 0.5,
    maxOutputTokens: 250,
  });
  const draftMs = Date.now() - t1;

  console.log("=== Draft (turno 1) ===");
  console.log(draft.text);
  console.log(`\nLatencia draft: ${draftMs}ms · tokens: ${draft.usage.outputTokens} out`);
  console.log("");

  const t2 = Date.now();
  const review = await reviewAnswer(QUESTION, draft.text);
  const reviewMs = Date.now() - t2;

  console.log("=== Review (turno 2) ===");
  console.log(JSON.stringify(review, null, 2));
  console.log(`\nLatencia review: ${reviewMs}ms`);
  console.log("");

  console.log("=== Sumario ===");
  console.log(`Latencia total: ${draftMs + reviewMs}ms (${draftMs} draft + ${reviewMs} review)`);
  console.log(
    `→ El validador agrega ~${reviewMs}ms a CADA respuesta. Para 100K msgs/día = ~${Math.round((reviewMs * 100) / 1000)} h-cpu/día extra.`,
  );
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
