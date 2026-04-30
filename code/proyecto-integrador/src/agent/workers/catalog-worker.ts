/**
 * Catalog worker — agente especializado en consultas de catálogo.
 *
 * Tools aisladas: solo searchCatalog. NO tiene acceso a getOrderStatus
 * ni a escalateToHuman (principio de menor privilegio).
 */
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { searchCatalogTool } from "../tools/search-catalog.js";

export function buildCatalogWorker() {
  const llm = new ChatGoogleGenerativeAI({
    model: process.env.GOOGLE_MODEL ?? "gemini-2.5-flash",
    temperature: 0.2,
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });

  return createReactAgent({
    llm,
    tools: [searchCatalogTool],
    prompt: [
      "Eres el worker de catálogo de TiendaPro, un e-commerce de productos de outdoor.",
      "Usa la tool searchCatalog para responder sobre productos.",
      "Mantén el tono cercano y servicial, máximo 4 oraciones.",
      "Si searchCatalog devuelve found=false, responde literalmente: \"No tengo información sobre eso en el catálogo de TiendaPro.\"",
      "Cita los IDs de los productos que menciones (ej: TP-MOCH-01).",
    ].join("\n"),
  });
}
