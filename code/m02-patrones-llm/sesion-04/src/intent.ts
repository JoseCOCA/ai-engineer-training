/**
 * Clasificador de intent con generateObject + Zod.
 *
 * Patrón canónico para routing en TiendaPro:
 *   1. Cliente envía mensaje.
 *   2. classifyIntent → enum + confidence + reasoning.
 *   3. Si confidence < umbral, pedir aclaración o derivar.
 *   4. Si confidence ≥ umbral, disparar el flow correspondiente.
 */
import { generateObject } from "ai";
import { z } from "zod";
import { llm } from "./lib/llm.js";

export const intentSchema = z.object({
  intent: z
    .enum(["pregunta", "reclamo", "derivar"])
    .describe("La intención principal del mensaje"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confianza entre 0 y 1; 1 = totalmente seguro"),
  reasoning: z
    .string()
    .max(200)
    .describe("Razonamiento corto de 1 frase explicando la clasificación"),
});

export type Intent = z.infer<typeof intentSchema>;

const SYSTEM_PROMPT = `Eres un clasificador de intención para el asistente de e-commerce TiendaPro.

Categorías:
- "pregunta": el cliente quiere información (productos, políticas, precios, plazos).
- "reclamo": el cliente reporta un problema (pedido no llegó, producto roto, mal cobro).
- "derivar": el cliente pide hablar con humano, está fuera de tema o el mensaje es ambiguo.

Si la confianza es baja (<0.7), prefiere "derivar".`;

export async function classifyIntent(message: string): Promise<Intent> {
  const { object } = await generateObject({
    model: llm,
    system: SYSTEM_PROMPT,
    prompt: message,
    schema: intentSchema,
    temperature: 0.2,
  });
  return object;
}
