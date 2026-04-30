/**
 * Demo 1 — Supervisor + 2 workers especializados + escalation.
 *
 * Patrón A (classifier puro): el supervisor solo clasifica el intent
 * y rutea. No reformula. Cada worker tiene tools aisladas.
 */
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import {
  Annotation,
  StateGraph,
  START,
  END,
} from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";

const IntentEnum = z.enum(["catalog", "orders", "escalation"]);
type Intent = z.infer<typeof IntentEnum>;

const State = Annotation.Root({
  query: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
  intent: Annotation<Intent>({ reducer: (_l, r) => r, default: () => "escalation" as Intent }),
  answer: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
});

type StateType = typeof State.State;

const llm = new ChatGoogleGenerativeAI({
  model: process.env.GOOGLE_MODEL ?? "gemini-2.5-flash",
  temperature: 0,
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const searchCatalog = tool(
  async ({ query }: { query: string }) => {
    if (query.toLowerCase().includes("mochila")) {
      return JSON.stringify([
        { id: "TP-MOCH-01", name: "Mochila Trekker 30L" },
        { id: "TP-MOCH-02", name: "Mochila Summit 65L" },
      ]);
    }
    return JSON.stringify([]);
  },
  {
    name: "searchCatalog",
    description: "Busca productos en el catálogo de TiendaPro por keyword.",
    schema: z.object({ query: z.string() }),
  },
);

const getOrderStatus = tool(
  async ({ orderId }: { orderId: string }) => {
    if (orderId === "P-1234") {
      return JSON.stringify({ orderId, status: "in_transit", eta: "2026-05-03" });
    }
    return JSON.stringify({ orderId, status: "not_found" });
  },
  {
    name: "getOrderStatus",
    description: "Obtiene el estado de un pedido por id.",
    schema: z.object({ orderId: z.string() }),
  },
);

const catalogAgent = createReactAgent({
  llm,
  tools: [searchCatalog],
  prompt: "Eres el worker de catálogo de TiendaPro. Usa searchCatalog y responde con productos concretos.",
});

const ordersAgent = createReactAgent({
  llm,
  tools: [getOrderStatus],
  prompt: "Eres el worker de pedidos de TiendaPro. Usa getOrderStatus y responde con info concreta.",
});

async function supervisor(state: StateType): Promise<Partial<StateType>> {
  const structured = llm.withStructuredOutput(z.object({ intent: IntentEnum }));
  const result = await structured.invoke([
    {
      role: "system",
      content: [
        "Clasifica la intención del usuario en una de 3 categorías:",
        "- catalog: pregunta sobre productos del catálogo.",
        "- orders: consulta sobre el estado de un pedido (id que empieza con P-).",
        "- escalation: cualquier otra cosa o no estás seguro.",
      ].join("\n"),
    },
    { role: "user", content: state.query },
  ]);
  console.log(`  [supervisor] intent="${result.intent}"`);
  return { intent: result.intent };
}

async function catalogWorker(state: StateType): Promise<Partial<StateType>> {
  const result = await catalogAgent.invoke({ messages: [new HumanMessage(state.query)] });
  const last = result.messages[result.messages.length - 1];
  const answer = typeof last.content === "string" ? last.content : "";
  console.log(`  [catalogWorker] respondió`);
  return { answer };
}

async function ordersWorker(state: StateType): Promise<Partial<StateType>> {
  const result = await ordersAgent.invoke({ messages: [new HumanMessage(state.query)] });
  const last = result.messages[result.messages.length - 1];
  const answer = typeof last.content === "string" ? last.content : "";
  console.log(`  [ordersWorker] respondió`);
  return { answer };
}

async function escalationWorker(_state: StateType): Promise<Partial<StateType>> {
  const answer = "No estoy seguro de poder ayudarte con eso. ¿Quieres que te derive a un agente humano?";
  console.log(`  [escalationWorker] handoff`);
  return { answer };
}

const graph = new StateGraph(State)
  .addNode("supervisor", supervisor)
  .addNode("catalogWorker", catalogWorker)
  .addNode("ordersWorker", ordersWorker)
  .addNode("escalationWorker", escalationWorker)
  .addEdge(START, "supervisor")
  .addConditionalEdges("supervisor", (s) => s.intent, {
    catalog: "catalogWorker",
    orders: "ordersWorker",
    escalation: "escalationWorker",
  })
  .addEdge("catalogWorker", END)
  .addEdge("ordersWorker", END)
  .addEdge("escalationWorker", END)
  .compile();

const QUERIES = [
  "¿Tienen mochilas?",
  "¿Cuándo llega mi pedido P-1234?",
  "Cuéntame un chiste sobre programadores",
];

async function main(): Promise<void> {
  for (const query of QUERIES) {
    console.log(`\n=== Query: "${query}" ===`);
    const result = await graph.invoke({ query });
    console.log(`  → answer: ${result.answer}`);
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
