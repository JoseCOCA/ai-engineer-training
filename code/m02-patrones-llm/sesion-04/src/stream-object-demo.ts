/**
 * Demo de streamObject:
 *  - Schema con varios campos.
 *  - Imprimimos el partialObjectStream para ver cómo se va llenando.
 *
 * Sirve para sentir cuándo aporta y cuándo no:
 *  - Schemas pequeños: la mejora UX es marginal.
 *  - Lógica programática: NO uses partials, esperá al objeto completo.
 */
import { streamObject } from "ai";
import { z } from "zod";
import { llm } from "./lib/llm.js";

const orderAnalysis = z.object({
  orderId: z.string().describe("ID del pedido en formato TP-NNNNNN"),
  status: z.enum(["delayed", "on_time", "delivered", "lost"]),
  priority: z.enum(["low", "medium", "high"]),
  daysWaitingApprox: z.number().int().min(0),
  customerSentiment: z.enum(["frustrated", "neutral", "satisfied"]),
  recommendedAction: z.enum(["refund", "expedite_shipping", "contact_carrier", "escalate_human"]),
  reasoning: z.string().max(300),
  estimatedResolutionDays: z.number().int().min(0).max(30),
});

const PROMPT = `Cliente reporta:

"Mi pedido TP-451200 lo hice hace 14 días y todavía no llega. La carrera dice 'en tránsito' desde hace 9 días. Necesito ese producto YA, es para un regalo el sábado. Si no llega, quiero el dinero."

Analiza el caso y devuelve el objeto de análisis.`;

async function main(): Promise<void> {
  console.log("Generando análisis con streamObject...\n");

  const { partialObjectStream } = streamObject({
    model: llm,
    schema: orderAnalysis,
    system: "Eres un analista de soporte de e-commerce. Diagnosticas el caso y propones acción.",
    prompt: PROMPT,
    temperature: 0.2,
  });

  let frame = 0;
  for await (const partial of partialObjectStream) {
    frame += 1;
    console.log(`\n=== Frame ${frame} ===`);
    console.log(JSON.stringify(partial, null, 2));
  }

  console.log(`\n[done — ${frame} frames]`);
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
