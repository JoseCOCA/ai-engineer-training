/**
 * Supervisor multi-agente del integrador (M5).
 *
 * Patrón A — classifier puro: el supervisor solo clasifica el intent y
 * rutea al worker correspondiente. NO reformula la respuesta del worker.
 *
 * Workers:
 *   - catalogWorker (tool: searchCatalog → RAG pipeline de M4)
 *   - ordersWorker  (tool: getOrderStatus)
 *   - escalationWorker (tool: escalateToHuman)
 */
import { z } from "zod";
import {
  Annotation,
  StateGraph,
  START,
  END,
} from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import {
  buildCatalogWorker,
  buildOrdersWorker,
  buildEscalationWorker,
} from "./workers/index.js";

export const IntentEnum = z.enum(["catalog", "orders", "escalation"]);
export type Intent = z.infer<typeof IntentEnum>;

const State = Annotation.Root({
  query: Annotation<string>({ reducer: (_l: string, r: string) => r, default: () => "" }),
  intent: Annotation<Intent>({
    reducer: (_l: Intent, r: Intent) => r,
    default: () => "escalation" as Intent,
  }),
  answer: Annotation<string>({ reducer: (_l: string, r: string) => r, default: () => "" }),
});

export type SupervisorState = typeof State.State;

function buildClassifierLlm(): ChatGoogleGenerativeAI {
  return new ChatGoogleGenerativeAI({
    model: process.env.GOOGLE_MODEL ?? "gemini-2.5-flash",
    temperature: 0,
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
}

async function classify(state: SupervisorState): Promise<Partial<SupervisorState>> {
  const structured = buildClassifierLlm().withStructuredOutput(z.object({ intent: IntentEnum }));
  const result = await structured.invoke([
    {
      role: "system",
      content: [
        "Clasifica la intención del usuario en una de tres categorías:",
        "- catalog: pregunta sobre productos del catálogo (mochilas, tiendas, ropa, accesorios, etc).",
        "- orders: consulta sobre el estado de un pedido (id que empieza con P-, o email).",
        "- escalation: cualquier otra cosa (frustración, fuera de alcance, charla casual, no estás seguro).",
      ].join("\n"),
    },
    { role: "user", content: state.query },
  ]);
  return { intent: result.intent };
}

const FinalAnswerSchema = z.object({
  answer: z.string().min(1).max(2000),
});

async function validateOutput(state: SupervisorState): Promise<Partial<SupervisorState>> {
  const parsed = FinalAnswerSchema.safeParse({ answer: state.answer });
  if (!parsed.success) {
    return {
      answer: "Lo siento, no pude generar una respuesta válida. ¿Puedes reformular?",
    };
  }
  return {};
}

export function buildSupervisorGraph() {
  const catalogWorker = buildCatalogWorker();
  const ordersWorker = buildOrdersWorker();
  const escalationWorker = buildEscalationWorker();

  async function catalogNode(state: SupervisorState): Promise<Partial<SupervisorState>> {
    const result = await catalogWorker.invoke({ messages: [new HumanMessage(state.query)] });
    const last = result.messages[result.messages.length - 1];
    return { answer: typeof last.content === "string" ? last.content : "" };
  }

  async function ordersNode(state: SupervisorState): Promise<Partial<SupervisorState>> {
    const result = await ordersWorker.invoke({ messages: [new HumanMessage(state.query)] });
    const last = result.messages[result.messages.length - 1];
    return { answer: typeof last.content === "string" ? last.content : "" };
  }

  async function escalationNode(state: SupervisorState): Promise<Partial<SupervisorState>> {
    const result = await escalationWorker.invoke({ messages: [new HumanMessage(state.query)] });
    const last = result.messages[result.messages.length - 1];
    return { answer: typeof last.content === "string" ? last.content : "" };
  }

  return new StateGraph(State)
    .addNode("classify", classify)
    .addNode("catalog", catalogNode)
    .addNode("orders", ordersNode)
    .addNode("escalation", escalationNode)
    .addNode("validateOutput", validateOutput)
    .addEdge(START, "classify")
    .addConditionalEdges("classify", (s: SupervisorState) => s.intent, {
      catalog: "catalog",
      orders: "orders",
      escalation: "escalation",
    })
    .addEdge("catalog", "validateOutput")
    .addEdge("orders", "validateOutput")
    .addEdge("escalation", "validateOutput")
    .addEdge("validateOutput", END)
    .compile();
}
