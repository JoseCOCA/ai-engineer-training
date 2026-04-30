/**
 * Demo 3 — Escalation a humano como tool del agente.
 *
 * Un mini-agente con tres tools: searchCatalog, getStockLevel,
 * escalateToHuman. El system prompt dice cuándo escalar (frustración,
 * fuera de alcance, error repetido).
 *
 * Tres queries muestran cuándo cada path se dispara.
 */
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";

const searchCatalog = tool(
  async ({ query }: { query: string }) => {
    if (query.toLowerCase().includes("mochila")) {
      return JSON.stringify([{ id: "TP-MOCH-01", name: "Mochila Trekker 30L" }]);
    }
    return JSON.stringify([]);
  },
  {
    name: "searchCatalog",
    description: "Busca productos en el catálogo de TiendaPro por keyword.",
    schema: z.object({ query: z.string() }),
  },
);

const getStockLevel = tool(
  async ({ productId }: { productId: string }) => {
    return JSON.stringify({ productId, stock: 12 });
  },
  {
    name: "getStockLevel",
    description: "Obtiene stock disponible de un producto por id.",
    schema: z.object({ productId: z.string() }),
  },
);

const escalations: Array<{ reason: string; context: string; ticketId: string }> = [];

const escalateToHuman = tool(
  async ({ reason, context }: { reason: string; context: string }) => {
    const ticketId = `TKT-${Math.floor(Math.random() * 9000) + 1000}`;
    escalations.push({ reason, context, ticketId });
    console.log(`    [escalateToHuman] ticket=${ticketId}, reason="${reason.slice(0, 60)}..."`);
    return JSON.stringify({
      ticketId,
      message: `Te derivé a un agente humano. Ticket #${ticketId}.`,
    });
  },
  {
    name: "escalateToHuman",
    description:
      "Deriva al usuario a un agente humano cuando: (a) el usuario está frustrado o agresivo, (b) la consulta excede tus capacidades (no es sobre productos ni pedidos), o (c) ya intentaste múltiples veces y no pudiste resolver.",
    schema: z.object({
      reason: z.string().describe("Motivo de la escalación, en una oración."),
      context: z.string().describe("Contexto que el agente humano necesita para retomar la conversación."),
    }),
  },
);

const SYSTEM_PROMPT = [
  "Eres el asistente de TiendaPro, un e-commerce de outdoor.",
  "Tu alcance: productos del catálogo y pedidos. Para todo lo demás, escalas a humano.",
  "",
  "REGLAS DE ESCALACIÓN (importantes):",
  "1. Si el usuario expresa frustración o agresividad → llama a escalateToHuman con reason='frustración'.",
  "2. Si la pregunta NO es sobre productos ni pedidos → llama a escalateToHuman con reason='fuera de alcance'.",
  "3. Si ya intentaste resolver y no pudiste → llama a escalateToHuman con reason='no_resoluble'.",
  "",
  "En el contexto de cada escalación, incluye qué dijo el usuario y qué intentaste.",
].join("\n");

const llm = new ChatGoogleGenerativeAI({
  model: process.env.GOOGLE_MODEL ?? "gemini-2.5-flash",
  temperature: 0,
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const agent = createReactAgent({
  llm,
  tools: [searchCatalog, getStockLevel, escalateToHuman],
  prompt: SYSTEM_PROMPT,
});

const QUERIES = [
  "¿tienen mochilas?",
  "Esto no funciona NADA, ya hice 5 intentos y nadie me responde, estoy harto",
  "¿pueden enviar un paquete a la luna?",
];

async function main(): Promise<void> {
  for (const query of QUERIES) {
    console.log(`\n=== Query: "${query}" ===`);
    const result = await agent.invoke({ messages: [new HumanMessage(query)] });
    const last = result.messages[result.messages.length - 1];
    const text = typeof last.content === "string" ? last.content : "";
    console.log(`  → ${text.slice(0, 200)}`);
  }

  console.log(`\n=== Resumen de escalaciones (${escalations.length}) ===`);
  for (const esc of escalations) {
    console.log(`  ticket=${esc.ticketId}`);
    console.log(`    reason: ${esc.reason}`);
    console.log(`    context: ${esc.context.slice(0, 120)}...`);
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
