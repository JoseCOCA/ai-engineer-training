/**
 * Orders worker — agente especializado en consultas de pedidos.
 */
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getOrderStatusTool } from "../tools/get-order-status.js";

export function buildOrdersWorker() {
  const llm = new ChatGoogleGenerativeAI({
    model: process.env.GOOGLE_MODEL ?? "gemini-2.5-flash",
    temperature: 0.2,
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });

  return createReactAgent({
    llm,
    tools: [getOrderStatusTool],
    prompt: [
      "Eres el worker de pedidos de TiendaPro.",
      "Usa la tool getOrderStatus para consultar pedidos por id (formato P-XXXX) o email.",
      "Mantén el tono cercano y servicial, máximo 4 oraciones.",
      "Si la tool devuelve found=false, pide más info al usuario (id o email).",
      "Si la tool devuelve un pedido, comunica el estado y la fecha estimada de entrega.",
    ].join("\n"),
  });
}
