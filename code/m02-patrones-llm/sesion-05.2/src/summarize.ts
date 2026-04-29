/**
 * summarizeOldMessages: comprime turnos viejos en un único bloque
 * de resumen para conservar contexto sin pagar todos los tokens.
 *
 * Importante:
 *  - temperature=0 para no inventar.
 *  - Prompt explícito: NO inventes datos. NO incluyas saludos.
 *  - Conservar datos críticos: nombre/email del cliente, IDs de pedido,
 *    productos consultados, problemas reportados.
 */
import { generateText } from "ai";
import { llm } from "./lib/llm.js";
import type { Message } from "./lib/conversation.js";

const SUMMARY_SYSTEM = `Resumes conversaciones entre un cliente y el asistente de TiendaPro en máximo 150 palabras.

Conserva en el resumen:
- Nombre/email del cliente si se mencionaron.
- IDs de pedido (formato TP-NNNNNN).
- Productos consultados o comprados.
- Problemas reportados.
- Decisiones pendientes.

NO inventes datos no presentes en la conversación.
NO incluyas saludos, despedidas ni small talk.
Devuelve SOLO el resumen, sin preámbulo.`;

export async function summarizeOldMessages(messages: Message[]): Promise<string> {
  const transcript = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const result = await generateText({
    model: llm,
    system: SUMMARY_SYSTEM,
    prompt: transcript,
    temperature: 0,
    maxOutputTokens: 250,
  });

  return result.text;
}
