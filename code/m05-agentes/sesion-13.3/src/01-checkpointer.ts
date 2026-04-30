/**
 * Demo 1 — Checkpointer + threads.
 *
 * MemorySaver persiste el estado entre invocaciones del mismo thread_id.
 * Threads distintos son independientes.
 */
import {
  Annotation,
  StateGraph,
  START,
  END,
  MemorySaver,
} from "@langchain/langgraph";

const State = Annotation.Root({
  messages: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  turn: Annotation<number>({ reducer: (_l, r) => r, default: () => 0 }),
});

type StateType = typeof State.State;

async function recordTurn(state: StateType): Promise<Partial<StateType>> {
  return { turn: state.turn + 1 };
}

const graph = new StateGraph(State)
  .addNode("recordTurn", recordTurn)
  .addEdge(START, "recordTurn")
  .addEdge("recordTurn", END)
  .compile({ checkpointer: new MemorySaver() });

async function main(): Promise<void> {
  const threadA = { configurable: { thread_id: "user-A" } };
  const threadB = { configurable: { thread_id: "user-B" } };

  console.log("=== Thread A · invocación 1 ===");
  const a1 = await graph.invoke({ messages: ["hola"], turn: 0 }, threadA);
  console.log(`  turn=${a1.turn}, messages=${JSON.stringify(a1.messages)}\n`);

  console.log("=== Thread A · invocación 2 (mismo thread) ===");
  const a2 = await graph.invoke({ messages: ["¿y mi pedido?"], turn: a1.turn }, threadA);
  console.log(`  turn=${a2.turn}, messages=${JSON.stringify(a2.messages)}`);
  console.log("  (notar que messages acumula y turn incrementa)\n");

  console.log("=== Thread B · invocación nueva (otro thread) ===");
  const b1 = await graph.invoke({ messages: ["hola"], turn: 0 }, threadB);
  console.log(`  turn=${b1.turn}, messages=${JSON.stringify(b1.messages)}`);
  console.log("  (thread B parte limpio)\n");

  console.log("=== Historial de Thread A ===");
  let count = 0;
  for await (const snapshot of graph.getStateHistory(threadA)) {
    console.log(
      `  [snapshot ${count}] turn=${snapshot.values.turn}, messages=${JSON.stringify(snapshot.values.messages)}`,
    );
    count += 1;
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
