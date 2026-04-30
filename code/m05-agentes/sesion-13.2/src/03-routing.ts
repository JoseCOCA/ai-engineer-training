/**
 * Demo 3 — Conditional routing: classifier → workers según intent.
 *
 * Patrón canónico que usaremos en el integrador en S14.2:
 *   classify → (catalog | orders | general) → END
 *
 * Workers son mocks; lo importante es ver la mecánica del grafo.
 */
import { z } from "zod";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const IntentEnum = z.enum(["catalog", "orders", "general"]);
type Intent = z.infer<typeof IntentEnum>;

const State = Annotation.Root({
  query: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
  intent: Annotation<Intent>({ reducer: (_l, r) => r, default: () => "general" as Intent }),
  answer: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
});

type StateType = typeof State.State;

const classifierLlm = new ChatGoogleGenerativeAI({
  model: process.env.GOOGLE_MODEL ?? "gemini-2.5-flash",
  temperature: 0,
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

async function classify(state: StateType): Promise<Partial<StateType>> {
  const structured = classifierLlm.withStructuredOutput(
    z.object({ intent: IntentEnum }),
  );
  const result = await structured.invoke([
    {
      role: "system",
      content: [
        "Clasifica la intención del usuario en una de estas 3 categorías:",
        "- catalog: pregunta sobre productos del catálogo (mochilas, tiendas, etc).",
        "- orders: consulta sobre el estado de un pedido (id, fecha, envío).",
        "- general: saludo, charla casual, o consulta fuera de alcance.",
        "Devuelve solo la etiqueta, en inglés.",
      ].join("\n"),
    },
    { role: "user", content: state.query },
  ]);
  console.log(`  [classify] intent="${result.intent}"`);
  return { intent: result.intent };
}

async function catalogWorker(state: StateType): Promise<Partial<StateType>> {
  const answer = `[catalogWorker mock] Tenemos varios productos relacionados con "${state.query}". Te paso 3 opciones del catálogo.`;
  console.log(`  [catalogWorker] ${answer}`);
  return { answer };
}

async function ordersWorker(state: StateType): Promise<Partial<StateType>> {
  const answer = `[ordersWorker mock] Estoy consultando el estado de tu pedido. Pregunta original: "${state.query}".`;
  console.log(`  [ordersWorker] ${answer}`);
  return { answer };
}

async function generalWorker(state: StateType): Promise<Partial<StateType>> {
  const answer = `[generalWorker mock] Lo siento, no puedo ayudarte con esa consulta específica. ¿Sobre qué producto o pedido te puedo informar?`;
  console.log(`  [generalWorker] ${answer}`);
  return { answer };
}

const graph = new StateGraph(State)
  .addNode("classify", classify)
  .addNode("catalogWorker", catalogWorker)
  .addNode("ordersWorker", ordersWorker)
  .addNode("generalWorker", generalWorker)
  .addEdge(START, "classify")
  .addConditionalEdges("classify", (state: StateType) => state.intent, {
    catalog: "catalogWorker",
    orders: "ordersWorker",
    general: "generalWorker",
  })
  .addEdge("catalogWorker", END)
  .addEdge("ordersWorker", END)
  .addEdge("generalWorker", END)
  .compile();

const QUERIES = [
  "¿Tienen mochilas?",
  "¿Cuándo llega mi pedido P-1234?",
  "Hola, ¿cómo estás?",
];

async function main(): Promise<void> {
  for (const query of QUERIES) {
    console.log(`\n=== Query: "${query}" ===`);
    const result = await graph.invoke({ query });
    console.log(`  → answer: ${result.answer}`);
  }

  console.log("\nDiagrama del grafo:");
  console.log((await graph.getGraphAsync()).drawMermaid());
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
