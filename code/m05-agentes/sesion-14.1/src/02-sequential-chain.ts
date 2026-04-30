/**
 * Demo 2 — Sequential chain: research → draft → review.
 *
 * Tres agentes en orden fijo. Cada uno tiene un system prompt
 * especializado y opera sobre el output del anterior.
 */
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const State = Annotation.Root({
  question: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
  research: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
  draft: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
  finalAnswer: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
});

type StateType = typeof State.State;

const llm = new ChatGoogleGenerativeAI({
  model: process.env.GOOGLE_MODEL ?? "gemini-2.5-flash",
  temperature: 0.3,
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

async function researcher(state: StateType): Promise<Partial<StateType>> {
  const response = await llm.invoke([
    {
      role: "system",
      content: "Eres un researcher. Dado una pregunta, devuelve 3 puntos clave en bullet points cortos. Sin redactar prosa.",
    },
    { role: "user", content: state.question },
  ]);
  const research = typeof response.content === "string" ? response.content : "";
  console.log(`  [researcher] ${research.split("\n")[0]}...`);
  return { research };
}

async function writer(state: StateType): Promise<Partial<StateType>> {
  const response = await llm.invoke([
    {
      role: "system",
      content: "Eres un writer. Dado puntos clave, redacta un párrafo cohesivo de 4-5 oraciones. Tono profesional y conciso.",
    },
    {
      role: "user",
      content: `Pregunta: ${state.question}\n\nPuntos clave:\n${state.research}`,
    },
  ]);
  const draft = typeof response.content === "string" ? response.content : "";
  console.log(`  [writer] redactó ${draft.length} caracteres`);
  return { draft };
}

async function reviewer(state: StateType): Promise<Partial<StateType>> {
  const response = await llm.invoke([
    {
      role: "system",
      content:
        "Eres un editor crítico. Dado un párrafo, devuélvelo pulido: corrige redundancias, mejora claridad, mantiene la longitud. Devuelve SOLO el párrafo final.",
    },
    { role: "user", content: state.draft },
  ]);
  const finalAnswer = typeof response.content === "string" ? response.content : "";
  console.log(`  [reviewer] revisó`);
  return { finalAnswer };
}

const graph = new StateGraph(State)
  .addNode("researcher", researcher)
  .addNode("writer", writer)
  .addNode("reviewer", reviewer)
  .addEdge(START, "researcher")
  .addEdge("researcher", "writer")
  .addEdge("writer", "reviewer")
  .addEdge("reviewer", END)
  .compile();

const QUESTION = "¿Por qué un agente es mejor que un pipeline determinista para asistencia conversacional con muchas tools?";

async function main(): Promise<void> {
  console.log(`=== Sequential chain: research → draft → review ===`);
  console.log(`Pregunta: "${QUESTION}"\n`);

  const result = await graph.invoke({ question: QUESTION });

  console.log("\n--- Research (output del researcher) ---");
  console.log(result.research);

  console.log("\n--- Draft (output del writer) ---");
  console.log(result.draft);

  console.log("\n--- Final (output del reviewer) ---");
  console.log(result.finalAnswer);

  console.log("\nObserva la mejora progresiva en cada etapa. Tradeoff: 3 llamadas LLM en vez de 1.");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
