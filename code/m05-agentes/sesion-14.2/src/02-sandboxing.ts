/**
 * Demo 2 — Sandboxing en 4 capas.
 *
 * Cada escenario provoca un fallo y muestra qué capa lo atrapa:
 *   1. recursionLimit → loop atrapado.
 *   2. token budget → guard manual en el grafo.
 *   3. tools aisladas → un worker NO ve las tools de otro.
 *   4. output validation con zod → respuesta inválida bloqueada.
 */
import { z } from "zod";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";

const State = Annotation.Root({
  query: Annotation<string>({ reducer: (_l: string, r: string) => r, default: () => "" }),
  totalTokens: Annotation<number>({ reducer: (l: number, r: number) => l + r, default: () => 0 }),
  answer: Annotation<string>({ reducer: (_l: string, r: string) => r, default: () => "" }),
});

type StateType = typeof State.State;

const FinalAnswerSchema = z.object({
  answer: z.string().min(5).max(2000),
});

async function loopNode(state: StateType): Promise<Partial<StateType>> {
  console.log(`  [loopNode] entré (la próxima edge me hace volver)`);
  return { totalTokens: 100 };
}

const loopGraph = new StateGraph(State)
  .addNode("loopNode", loopNode)
  .addEdge(START, "loopNode")
  .addEdge("loopNode", "loopNode")
  .compile();

async function bigConsumer(state: StateType): Promise<Partial<StateType>> {
  console.log(`  [bigConsumer] consumiendo 60K tokens...`);
  return { totalTokens: 60_000 };
}

async function checkBudget(state: StateType): Promise<Partial<StateType>> {
  if (state.totalTokens > 50_000) {
    console.log(`  [checkBudget] total=${state.totalTokens} excede budget. Aborto.`);
    return { answer: "Excedimos el presupuesto de la consulta." };
  }
  return {};
}

async function generateAnswer(_state: StateType): Promise<Partial<StateType>> {
  return { answer: "ok" };
}

const budgetGraph = new StateGraph(State)
  .addNode("bigConsumer", bigConsumer)
  .addNode("checkBudget", checkBudget)
  .addNode("generateAnswer", generateAnswer)
  .addEdge(START, "bigConsumer")
  .addEdge("bigConsumer", "checkBudget")
  .addConditionalEdges("checkBudget", (s) => (s.answer ? END : "generateAnswer"), {
    generateAnswer: "generateAnswer",
    [END]: END,
  })
  .addEdge("generateAnswer", END)
  .compile();

async function badGenerator(_state: StateType): Promise<Partial<StateType>> {
  return { answer: "ab" };
}

async function validateOutput(state: StateType): Promise<Partial<StateType>> {
  const parsed = FinalAnswerSchema.safeParse({ answer: state.answer });
  if (!parsed.success) {
    console.log(`  [validateOutput] schema rechazó: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
    return {
      answer: "Lo siento, no pude generar una respuesta válida. Por favor reformula.",
    };
  }
  return {};
}

const validationGraph = new StateGraph(State)
  .addNode("badGenerator", badGenerator)
  .addNode("validateOutput", validateOutput)
  .addEdge(START, "badGenerator")
  .addEdge("badGenerator", "validateOutput")
  .addEdge("validateOutput", END)
  .compile();

async function scenarioRecursion(): Promise<void> {
  console.log("=== Capa 1 · recursionLimit ===");
  try {
    await loopGraph.invoke({ query: "x", totalTokens: 0, answer: "" }, { recursionLimit: 5 });
    console.log("  ✗ ¡no debería llegar acá!");
  } catch (err) {
    console.log(`  ✓ atrapado: ${(err as Error).message}\n`);
  }
}

async function scenarioBudget(): Promise<void> {
  console.log("=== Capa 2 · token budget ===");
  const result = await budgetGraph.invoke({ query: "x", totalTokens: 0, answer: "" });
  console.log(`  ✓ resultado: "${result.answer}"\n`);
}

function scenarioToolIsolation(): void {
  console.log("=== Capa 3 · tools aisladas por worker ===");
  console.log("  Patrón mostrado en S14.1: catalogWorker NO tiene getOrderStatus en sus tools.");
  console.log("  Aislamiento físico (no exponer la tool) > confiar en el system prompt.\n");
}

async function scenarioOutputValidation(): Promise<void> {
  console.log("=== Capa 4 · output validation con zod ===");
  const result = await validationGraph.invoke({ query: "x", totalTokens: 0, answer: "" });
  console.log(`  ✓ resultado final: "${result.answer}"\n`);
}

async function main(): Promise<void> {
  await scenarioRecursion();
  await scenarioBudget();
  scenarioToolIsolation();
  await scenarioOutputValidation();

  console.log("Lectura sugerida:");
  console.log("  - Las cuatro capas son complementarias, no alternativas.");
  console.log("  - Cada una atrapa un modo de fallar distinto.");
  console.log("  - El costo combinado es bajo; el valor compuesto es alto.");
}

main().catch((err: unknown) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
