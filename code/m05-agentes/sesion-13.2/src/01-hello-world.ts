/**
 * Demo 1 — Hello world graph.
 *
 * Tres nodos triviales muestran la mecánica de StateGraph:
 *   - el estado se mueve por las aristas
 *   - cada nodo retorna SOLO los campos que modifica
 *   - LangGraph mergea automáticamente
 */
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";

const State = Annotation.Root({
  counter: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
  messages: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  finalText: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
});

type StateType = typeof State.State;

async function incrementCounter(state: StateType): Promise<Partial<StateType>> {
  console.log(`  [incrementCounter] counter ${state.counter} → ${state.counter + 1}`);
  return { counter: state.counter + 1 };
}

async function appendMessage(state: StateType): Promise<Partial<StateType>> {
  const msg = `step ${state.counter}: hola desde el grafo`;
  console.log(`  [appendMessage] ${msg}`);
  return { messages: [msg] };
}

async function format(state: StateType): Promise<Partial<StateType>> {
  const finalText = `Counter terminó en ${state.counter}, mensajes: [${state.messages.join("; ")}]`;
  console.log(`  [format] ${finalText}`);
  return { finalText };
}

const graph = new StateGraph(State)
  .addNode("increment", incrementCounter)
  .addNode("append", appendMessage)
  .addNode("format", format)
  .addEdge(START, "increment")
  .addEdge("increment", "append")
  .addEdge("append", "format")
  .addEdge("format", END)
  .compile();

async function main(): Promise<void> {
  console.log("=== Hello world graph ===\n");
  const result = await graph.invoke({ counter: 0, messages: [], finalText: "" });
  console.log("\nEstado final:");
  console.log(`  counter: ${result.counter}`);
  console.log(`  messages: ${JSON.stringify(result.messages)}`);
  console.log(`  finalText: "${result.finalText}"`);

  console.log("\nDiagrama del grafo (Mermaid):");
  console.log((await graph.getGraphAsync()).drawMermaid());
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
