/**
 * Demo 1 — Approval gate con interrupt.
 *
 * Un agente intenta cancelar un pedido (operación destructiva).
 * Antes de ejecutar la tool, el grafo se pausa con `interrupt` y
 * espera aprobación. Simulamos dos paths: aprobado y rechazado.
 *
 * El interrupt requiere checkpointer.
 */
import {
  Annotation,
  StateGraph,
  START,
  END,
  MemorySaver,
  Command,
  interrupt,
} from "@langchain/langgraph";

const State = Annotation.Root({
  orderId: Annotation<string>({ reducer: (_l: string, r: string) => r, default: () => "" }),
  reason: Annotation<string>({ reducer: (_l: string, r: string) => r, default: () => "" }),
  approval: Annotation<"yes" | "no" | "">({ reducer: (_l, r) => r, default: () => "" }),
  result: Annotation<string>({ reducer: (_l: string, r: string) => r, default: () => "" }),
});

type StateType = typeof State.State;

async function approvalGate(state: StateType): Promise<Partial<StateType>> {
  const decision = interrupt({
    type: "approve_cancel_order",
    question: `¿Aprobar cancelación del pedido ${state.orderId}?`,
    metadata: {
      orderId: state.orderId,
      reason: state.reason,
    },
  });

  console.log(`  [approvalGate] decisión recibida: "${decision}"`);
  return { approval: decision === "yes" ? "yes" : "no" };
}

async function executeCancellation(state: StateType): Promise<Partial<StateType>> {
  console.log(`  [executeCancellation] CANCELANDO pedido ${state.orderId}...`);
  return {
    result: `Pedido ${state.orderId} cancelado correctamente. Reembolso en 3-5 días.`,
  };
}

async function abortCancellation(state: StateType): Promise<Partial<StateType>> {
  console.log(`  [abortCancellation] cancelación rechazada por el operador`);
  return {
    result: `Cancelación del pedido ${state.orderId} fue rechazada por el operador.`,
  };
}

const graph = new StateGraph(State)
  .addNode("approvalGate", approvalGate)
  .addNode("executeCancellation", executeCancellation)
  .addNode("abortCancellation", abortCancellation)
  .addEdge(START, "approvalGate")
  .addConditionalEdges("approvalGate", (s) => (s.approval === "yes" ? "executeCancellation" : "abortCancellation"), {
    executeCancellation: "executeCancellation",
    abortCancellation: "abortCancellation",
  })
  .addEdge("executeCancellation", END)
  .addEdge("abortCancellation", END)
  .compile({ checkpointer: new MemorySaver() });

async function runScenario(label: string, decision: "yes" | "no"): Promise<void> {
  console.log(`\n=== ${label} (decisión simulada: ${decision}) ===`);

  const threadId = `thread-${decision}-${Date.now()}`;
  const config = { configurable: { thread_id: threadId } };

  console.log("Paso 1: invocación inicial — el grafo se pausa en el approval gate");
  const intermediate = await graph.invoke(
    { orderId: "P-1234", reason: "El usuario pidió cancelar por demora", approval: "" },
    config,
  );
  console.log(`  estado intermedio: approval="${intermediate.approval ?? ""}", result="${intermediate.result ?? ""}"`);

  console.log("Paso 2: el humano decide → reanudamos con Command({ resume })");
  const final = await graph.invoke(new Command({ resume: decision }), config);
  console.log(`  resultado final: ${final.result}`);
}

async function main(): Promise<void> {
  await runScenario("A · Aprobado", "yes");
  await runScenario("B · Rechazado", "no");

  console.log("\nLectura sugerida:");
  console.log("  - El interrupt pausa el grafo y persiste el estado vía checkpointer.");
  console.log("  - El humano puede tardar horas/días en decidir; el thread_id permite retomar.");
  console.log("  - En producción, el frontend renderiza la pregunta del interrupt y recoge la decisión.");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
