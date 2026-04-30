/**
 * Demo 2 — ReAct agent con createReactAgent.
 *
 * Dos tools (searchCatalog, getStockLevel). El helper arma el grafo
 * internamente con la conditional edge "¿hay tool calls? sí → ejecutar tools, no → end".
 *
 * Equivalente conceptual al runAgent de S12 (bare metal), pero como grafo.
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";

interface MockProduct {
  id: string;
  name: string;
  category: string;
  stock: number;
}

const CATALOG: MockProduct[] = [
  { id: "TP-MOCH-01", name: "Mochila Trekker 30L", category: "mochilas", stock: 12 },
  { id: "TP-MOCH-02", name: "Mochila Summit 65L", category: "mochilas", stock: 5 },
  { id: "TP-MOCH-03", name: "Mochila City Daypack 18L", category: "mochilas", stock: 8 },
  { id: "TP-CALZ-01", name: "Botas Trail Pro Mid", category: "calzado", stock: 7 },
];

const searchCatalog = tool(
  async ({ query }: { query: string }) => {
    const q = query.toLowerCase();
    const matches = CATALOG.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
    );
    return JSON.stringify(matches.map((p) => ({ id: p.id, name: p.name, category: p.category })));
  },
  {
    name: "searchCatalog",
    description: "Busca productos en el catálogo de TiendaPro por keyword.",
    schema: z.object({
      query: z.string().describe("Keyword corto, ej: 'mochila'."),
    }),
  },
);

const getStockLevel = tool(
  async ({ productId }: { productId: string }) => {
    const p = CATALOG.find((x) => x.id === productId);
    return JSON.stringify(p ? { productId, found: true, stock: p.stock } : { productId, found: false });
  },
  {
    name: "getStockLevel",
    description: "Obtiene el stock disponible de un producto por id.",
    schema: z.object({
      productId: z.string().describe("ID exacto del producto, ej: 'TP-MOCH-01'."),
    }),
  },
);

const QUERY = "¿Tienen mochilas y cuál tiene más stock?";

async function main(): Promise<void> {
  const llm = new ChatGoogleGenerativeAI({
    model: process.env.GOOGLE_MODEL ?? "gemini-2.5-flash",
    temperature: 0,
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });

  const agent = createReactAgent({
    llm,
    tools: [searchCatalog, getStockLevel],
    prompt: "Eres un asistente del e-commerce TiendaPro. Responde de forma concisa, máximo 2 oraciones.",
  });

  console.log(`=== ReAct agent con createReactAgent ===`);
  console.log(`Query: "${QUERY}"\n`);

  const result = await agent.invoke({
    messages: [new HumanMessage(QUERY)],
  });

  console.log("Mensajes intermedios y final:");
  for (const [i, msg] of result.messages.entries()) {
    const role = msg.getType();
    const content =
      typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    const preview = content.length > 100 ? content.slice(0, 100) + "..." : content;
    console.log(`  [${i}] ${role}: ${preview}`);
  }

  const lastMessage = result.messages[result.messages.length - 1];
  const finalContent = typeof lastMessage.content === "string" ? lastMessage.content : "";
  console.log(`\nRespuesta final: ${finalContent}`);

  console.log("\nDiagrama del grafo interno:");
  console.log((await agent.getGraphAsync()).drawMermaid());
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
