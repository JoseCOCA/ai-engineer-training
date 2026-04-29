/**
 * Clasificador de intent que carga el system prompt desde archivo
 * versionado en lugar de tener el string en código.
 */
import { generateObject } from "ai";
import { z } from "zod";
import { llm } from "./llm.js";
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
  const systemPrompt = render(promptName);
  const { object } = await generateObject({
    model: llm,
    system: systemPrompt,
    prompt: message,
    schema: intentSchema,
    temperature: 0.2,
  });
  return object;
}
