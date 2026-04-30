/**
 * Demo 2 — Dos tools y combinación.
 *
 * searchCatalog(query) — busca productos por keyword (mock).
 * getStockLevel(productId) — devuelve stock disponible (mock).
 *
 * El agente decide cuáles tools usar y en qué orden, según la pregunta.
 */
import { tool } from "ai";
import { z } from "zod";
import { runAgent } from "./lib/agent.js";

interface MockProduct {
  id: string;
  name: string;
  category: string;
  stock: number;
}

const CATALOG: MockProduct[] = [
  { id: "TP-MOCH-01", name: "Mochila Trekker 30L", category: "mochilas", stock: 12 },
  { id: "TP-MOCH-02", name: "Mochila Summit 65L", category: "mochilas", stock: 5 },
  { id: "TP-MOCH-03", name: "Mochila City Daypack 18L", category: "mochilas", stock: 8 },
  { id: "TP-TIENDA-01", name: "Tienda 2P Ultra-Light", category: "tiendas", stock: 4 },
  { id: "TP-TIENDA-02", name: "Tienda Familiar 4P", category: "tiendas", stock: 2 },
  { id: "TP-CALZ-01", name: "Botas Trail Pro Mid", category: "calzado", stock: 7 },
];

const tools = {
  searchCatalog: tool({
    description:
      "Busca productos en el catálogo de TiendaPro por keyword. Devuelve id, nombre y categoría de los que matchean.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "Keyword o frase corta a buscar (ej: 'mochila', 'tienda 4 personas').",
        ),
    }),
    execute: async ({ query }: { query: string }) => {
      const q = query.toLowerCase();
      const matches = CATALOG.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
      );
      return matches.map((p) => ({ id: p.id, name: p.name, category: p.category }));
    },
  }),
  getStockLevel: tool({
    description:
      "Obtiene el stock disponible de un producto específico por su id.",
    inputSchema: z.object({
      productId: z.string().describe("ID exacto del producto, ej: 'TP-MOCH-01'."),
    }),
    execute: async ({ productId }: { productId: string }) => {
      const p = CATALOG.find((x) => x.id === productId);
      if (!p) return { productId, found: false };
      return { productId, found: true, stock: p.stock };
    },
  }),
};

const QUERIES = [
  "¿Tienen mochilas?",
  "¿Hay stock de TP-CALZ-01?",
  "¿Tienen mochilas y cuál tiene más stock?",
];

async function main(): Promise<void> {
  for (const query of QUERIES) {
    console.log(`=== Query: "${query}" ===\n`);

    const result = await runAgent(query, tools, {
      maxIter: 5,
      onStep: (step) => {
        if (step.toolCalls.length > 0) {
          console.log(`[step ${step.iteration}] toolCalls:`);
          step.toolCalls.forEach((c) => {
            console.log(`  ${c.name}(${JSON.stringify(c.args)})`);
          });
          step.toolResults.forEach((r) => {
            console.log(`  → ${JSON.stringify(r.output)}`);
          });
        } else if (step.text) {
          console.log(`[step ${step.iteration}] finishReason: ${step.finishReason}`);
          console.log(`  text: "${step.text}"`);
        }
      },
    });

    if (result.ok) {
      console.log(
        `\n✓ ${result.iterations} iters, ${result.totalTokens} tokens, ${result.elapsedMs}ms\n`,
      );
    } else {
      console.log(`\n✗ ${result.reason}\n`);
    }
  }

  console.log(
    "Nota que cuando hay múltiples productos, el agente llama a getStockLevel en paralelo (mismo step).",
  );
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
