/**
 * Demo 2 — Error handling: transitorio vs dominio vs fatal.
 *
 * Tres escenarios provocados:
 *   A. Transitorio: una función falla 2 veces y a la 3a tiene éxito.
 *      El retry lo cubre.
 *   B. Dominio: una "tool" devuelve {found:false}. El grafo rutea
 *      a una rama de fallback en lugar de reintentar.
 *   C. Fatal: error inesperado. El try/catch externo devuelve respuesta
 *      degradada al usuario.
 */
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";

const State = Annotation.Root({
  query: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
  result: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
  notFound: Annotation<boolean>({ reducer: (_l, r) => r, default: () => false }),
});

type StateType = typeof State.State;

class TransientError extends Error {
  readonly transient = true;
}

let attemptCounter = 0;

async function flakyOperation(): Promise<string> {
  attemptCounter += 1;
  if (attemptCounter < 3) {
    throw new TransientError(`flaky failure (intento ${attemptCounter})`);
  }
  return `éxito en intento ${attemptCounter}`;
}

async function withRetry<T>(fn: () => Promise<T>, max = 3): Promise<T> {
  for (let i = 1; i <= max; i++) {
    try {
      return await fn();
    } catch (err) {
      const isTransient = err instanceof TransientError;
      if (!isTransient || i === max) throw err;
      const delay = 100 * 2 ** (i - 1) + Math.random() * 50;
      console.log(`    [retry] intento ${i} falló (${(err as Error).message}); reintento en ${Math.round(delay)}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

async function lookupOrder(state: StateType): Promise<Partial<StateType>> {
  const id = state.query;
  const found = id === "P-1234";
  if (!found) return { notFound: true, result: "" };
  return { result: `Pedido ${id} encontrado: en tránsito.`, notFound: false };
}

async function fallbackOrder(_state: StateType): Promise<Partial<StateType>> {
  return {
    result:
      "No encontré ese pedido. ¿Puedes confirmarme el ID o el correo asociado?",
  };
}

const orderGraph = new StateGraph(State)
  .addNode("lookup", lookupOrder)
  .addNode("fallback", fallbackOrder)
  .addEdge(START, "lookup")
  .addConditionalEdges("lookup", (s) => (s.notFound ? "fallback" : END), {
    fallback: "fallback",
    [END]: END,
  })
  .addEdge("fallback", END)
  .compile();

async function scenarioA(): Promise<void> {
  console.log("=== A · Transitorio (retry) ===");
  attemptCounter = 0;
  try {
    const result = await withRetry(flakyOperation, 3);
    console.log(`  ✓ ${result}\n`);
  } catch (err) {
    console.log(`  ✗ falló definitivamente: ${(err as Error).message}\n`);
  }
}

async function scenarioB(): Promise<void> {
  console.log("=== B · Dominio (fallback de flujo) ===");

  const found = await orderGraph.invoke({ query: "P-1234", result: "", notFound: false });
  console.log(`  Query "P-1234": ${found.result}`);

  const missing = await orderGraph.invoke({ query: "P-9999", result: "", notFound: false });
  console.log(`  Query "P-9999": ${missing.result}\n`);
}

async function scenarioC(): Promise<void> {
  console.log("=== C · Fatal (degradación al usuario) ===");
  try {
    throw new Error("Auth backend caído (simulado)");
  } catch (err) {
    console.log(`  Error capturado: ${(err as Error).message}`);
    console.log(`  Respuesta al usuario: "Estamos teniendo problemas técnicos. Intenta nuevamente en unos minutos."`);
    console.log(`  → en producción: alertOps(err, { traceId, userId })\n`);
  }
}

async function main(): Promise<void> {
  await scenarioA();
  await scenarioB();
  await scenarioC();

  console.log("Resumen:");
  console.log("  - Transitorio → retry. Retry SOLO si el error es marcable como transient.");
  console.log("  - Dominio → fallback en el flujo del grafo (no reintentar).");
  console.log("  - Fatal → respuesta degradada + alerta. NO reintentar, NO ocultar.");
}

main().catch((err: unknown) => {
  console.error("Error fatal externo:", err);
  process.exit(1);
});
