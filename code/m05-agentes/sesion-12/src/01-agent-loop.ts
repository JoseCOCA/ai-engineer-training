/**
 * Demo 1 — Agent loop manual con una sola tool.
 *
 * Tool: getProductCount(category) — devuelve un número mock.
 * Agente: decide cuándo llamar la tool y cuándo responder.
 */
import { tool } from "ai";
import { z } from "zod";
import { runAgent } from "./lib/agent.js";

const COUNTS: Record<string, number> = {
  mochilas: 3,
  tiendas: 2,
  calzado: 2,
  ropa: 2,
  accesorios: 2,
  cocina: 1,
};

const tools = {
  getProductCount: tool({
    description:
      "Obtiene la cantidad de productos disponibles en una categoría del catálogo de TiendaPro.",
    inputSchema: z.object({
      category: z
        .string()
        .describe(
          "Nombre de la categoría en minúsculas (ej: 'mochilas', 'tiendas', 'calzado').",
        ),
    }),
    execute: async ({ category }: { category: string }) => {
      const key = category.trim().toLowerCase();
      const count = COUNTS[key] ?? 0;
      return { category: key, count };
    },
  }),
};

const QUERY = "¿Cuántos productos tienen en mochilas y cuántos en tiendas?";

async function main(): Promise<void> {
  console.log(`=== Agent loop ===`);
  console.log(`Pregunta: "${QUERY}"\n`);

  const result = await runAgent(QUERY, tools, {
    maxIter: 5,
    onStep: (step) => {
      console.log(`[step ${step.iteration}] LLM piensa...`);
      if (step.toolCalls.length > 0) {
        console.log(`  toolCalls:`);
        step.toolCalls.forEach((c) => {
          console.log(`    ${c.name}(${JSON.stringify(c.args)})`);
        });
        step.toolResults.forEach((r) => {
          console.log(`  → ${r.name}: ${JSON.stringify(r.output)}`);
        });
      }
      if (step.text) {
        console.log(`  finishReason: ${step.finishReason}`);
        console.log(`  text: "${step.text}"`);
      }
      console.log(
        `  [tokens in/out: ${step.inputTokens}/${step.outputTokens}, ${step.elapsedMs}ms]\n`,
      );
    },
  });

  if (result.ok) {
    console.log(`✓ Terminó en ${result.iterations} iteraciones, ${result.totalTokens} tokens, ${result.elapsedMs}ms`);
  } else {
    console.log(`✗ Falló: ${result.reason} (${result.iterations} iters, ${result.totalTokens} tokens)`);
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
