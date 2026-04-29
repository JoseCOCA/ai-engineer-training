/**
 * summarizeOldMessages: comprime turnos viejos en un resumen para
 * conservar contexto sin pagar todos los tokens.
 *
 * Carga el system prompt desde prompts/summarizer.system.md.
 */
import { generateText } from "ai";
import { buildModel, PRIMARY_PROVIDER, type ChatMessage } from "@curso-ai/llm";
import { render } from "./prompts.js";

export async function summarizeOldMessages(messages: ChatMessage[]): Promise<string> {
  const { model } = buildModel(PRIMARY_PROVIDER);
  const systemPrompt = render("summarizer.system");

  const transcript = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: transcript,
    temperature: 0,
    maxOutputTokens: 250,
  });

  return result.text;
}
