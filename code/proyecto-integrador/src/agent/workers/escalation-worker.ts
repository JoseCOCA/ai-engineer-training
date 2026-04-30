/**
 * Escalation worker — usa la tool escalateToHuman para crear un ticket
 * y comunicar al usuario.
 */
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { escalateToHumanTool } from "../tools/escalate-to-human.js";

export function buildEscalationWorker() {
  const llm = new ChatGoogleGenerativeAI({
    model: process.env.GOOGLE_MODEL ?? "gemini-2.5-flash",
    temperature: 0.2,
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });

  return createReactAgent({
    llm,
    tools: [escalateToHumanTool],
    prompt: [
      "Eres el worker de escalación de TiendaPro.",
      "Tu trabajo es derivar al usuario a un agente humano usando la tool escalateToHuman.",
      "Captura un buen contexto en el campo `context` (qué pidió el usuario, en qué estado está la conversación).",
      "Después comunica al usuario el ticket creado con tono empático.",
    ].join("\n"),
  });
}
