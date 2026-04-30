/**
 * Demo 4 — Termination conditions y modos de fallar provocados.
 *
 * Cuatro escenarios:
 *   A. Happy path: agente termina con finishReason: stop.
 *   B. Loop detection: una tool deliberadamente confusa hace que el
 *      agente reintente.
 *   C. Token budget: presupuesto agresivo lo agota.
 *   D. Timeout: una tool con setTimeout supera el wall clock.
 *
 * Cada uno demuestra una capa de defensa distinta.
 */
import { tool } from "ai";
import { z } from "zod";
import { runAgent } from "./lib/agent.js";

const happyTools = {
  greet: tool({
    description: "Saluda al usuario por nombre. Úsala solo cuando el usuario te pida un saludo.",
    inputSchema: z.object({
      name: z.string().describe("Nombre del usuario."),
    }),
    execute: async ({ name }: { name: string }) => ({ greeting: `Hola, ${name}` }),
  }),
};

const confusingTools = {
  getProductCount: tool({
    description:
      "Obtiene la cantidad de productos en una categoría. Devuelve {count, hint} donde hint puede sugerir más búsquedas.",
    inputSchema: z.object({
      category: z.string().describe("Nombre de la categoría."),
    }),
    execute: async ({ category }: { category: string }) => ({
      category,
      count: 0,
      hint: "Categoría no encontrada. Intenta con 'mochilas' o variantes.",
    }),
  }),
};

const slowTools = {
  slowOperation: tool({
    description: "Realiza una operación lenta. Tarda mucho. NO la uses a menos que el usuario lo pida explícitamente.",
    inputSchema: z.object({
      task: z.string().describe("Nombre de la tarea."),
    }),
    execute: async ({ task }: { task: string }) => {
      await new Promise((resolve) => setTimeout(resolve, 7000));
      return { task, status: "done" };
    },
  }),
};

async function runScenario(
  label: string,
  query: string,
  tools: Parameters<typeof runAgent>[1],
  opts: Parameters<typeof runAgent>[2],
): Promise<void> {
  console.log(`=== ${label} ===`);
  console.log(`Query: "${query}"`);
  const result = await runAgent(query, tools, opts);
  if (result.ok) {
    console.log(
      `  ✓ ok: ${result.iterations} iters, ${result.totalTokens} tokens, ${result.elapsedMs}ms`,
    );
    console.log(`  Respuesta: "${result.text.slice(0, 100)}..."`);
  } else {
    console.log(`  ✗ ${result.reason}: ${result.iterations} iters, ${result.totalTokens} tokens, ${result.elapsedMs}ms`);
    console.log(`  Fallback al usuario: "Lo siento, no pude completar la solicitud."`);
  }
  console.log("");
}

async function main(): Promise<void> {
  await runScenario("A · Happy path", "Saluda a Carlos por favor", happyTools, {
    maxIter: 5,
    timeoutMs: 30_000,
  });

  await runScenario(
    "B · Loop detection",
    "Cuántos productos hay en la categoría 'xyz_inexistente'? Insiste hasta encontrarlo.",
    confusingTools,
    {
      maxIter: 10,
      detectLoops: true,
    },
  );

  await runScenario(
    "C · Token budget",
    "Saluda a Carlos por favor",
    happyTools,
    {
      maxIter: 5,
      tokenBudget: 50,
    },
  );

  await runScenario(
    "D · Timeout",
    "Realiza la operación lenta llamada 'export_total'.",
    slowTools,
    {
      maxIter: 3,
      timeoutMs: 5_000,
    },
  );

  console.log("Lectura sugerida:");
  console.log("  - Cada termination condition es una capa de defensa contra un modo de fallar distinto.");
  console.log("  - En producción, todas activas a la vez. Defaults: max_iter=10, tokens=50K, timeout=30s.");
  console.log("  - Loop detection es opcional pero atrapa el caso 'misma args repetida' antes de agotar max_iter.");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
