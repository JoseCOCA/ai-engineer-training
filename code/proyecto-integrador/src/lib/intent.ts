/**
 * Clasificador de intent con generateObject + Zod.
 * Carga el system prompt desde prompts/intent-classifier.system.md.
 */
import { generateObject } from "ai";
import { z } from "zod";
import { buildModel, PRIMARY_PROVIDER } from "./providers.js";
import { render } from "./prompt-template.js";

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

export async function classifyIntent(
  message: string,
  promptName = "intent-classifier.system",
): Promise<Intent> {
  const { model } = buildModel(PRIMARY_PROVIDER);
  const systemPrompt = render(promptName);

  const { object } = await generateObject({
    model,
    system: systemPrompt,
    prompt: message,
    schema: intentSchema,
    temperature: 0.2,
  });
  return object;
}
