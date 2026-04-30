/**
 * Demo 3 — ReAct con razonamiento explícito.
 *
 * Forzamos al modelo a verbalizar Thought y Observation interpretation
 * antes y después de cada tool call. Útil para debugging y para
 * trazabilidad cuando el "por qué" del agente importa.
 */
import { tool } from "ai";
import { z } from "zod";
import { runAgent } from "./lib/agent.js";

interface MockProduct {
  id: string;
  name: string;
  price: number;
  category: string;
}

const CATALOG: MockProduct[] = [
  { id: "TP-MOCH-01", name: "Mochila Trekker 30L", price: 120, category: "mochilas" },
  { id: "TP-MOCH-02", name: "Mochila Summit 65L", price: 280, category: "mochilas" },
  { id: "TP-MOCH-03", name: "Mochila City Daypack 18L", price: 65, category: "mochilas" },
  { id: "TP-CALZ-01", name: "Botas Trail Pro Mid", price: 195, category: "calzado" },
];

const tools = {
  searchCatalog: tool({
    description: "Busca productos en el catálogo por keyword. Devuelve id, nombre, precio y categoría.",
    inputSchema: z.object({
      query: z.string().describe("Keyword corto, ej: 'mochila'."),
    }),
    execute: async ({ query }: { query: string }) => {
      const q = query.toLowerCase();
      return CATALOG.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
      );
    },
  }),
};

const SYSTEM = [
  "Eres un asistente que razona en voz alta antes de actuar (patrón ReAct).",
  "",
  "Reglas estrictas de formato:",
  "- ANTES de llamar a una tool, escribe una línea que empiece con 'Thought:' explicando en 1-2 oraciones por qué la llamas.",
  "- DESPUÉS de recibir el resultado, antes de la siguiente acción, escribe 'Observation interpretation:' con tu lectura del resultado en 1 oración.",
  "- Cuando tengas la respuesta, escribe 'Final Answer:' seguido de la respuesta natural al usuario.",
  "- Sé conciso. No repitas información ya razonada.",
].join("\n");

const QUERY = "¿Cuál es la mochila más barata que tienen?";

async function main(): Promise<void> {
  console.log(`=== ReAct explícito ===`);
  console.log(`Pregunta: "${QUERY}"\n`);

  const result = await runAgent(QUERY, tools, {
    maxIter: 5,
    system: SYSTEM,
    onStep: (step) => {
      console.log(`[step ${step.iteration}]`);
      if (step.toolCalls.length > 0) {
        step.toolCalls.forEach((c) => {
          console.log(`  toolCall: ${c.name}(${JSON.stringify(c.args)})`);
        });
        step.toolResults.forEach((r) => {
          const out = JSON.stringify(r.output);
          console.log(`  Observation: ${out.length > 200 ? out.slice(0, 200) + "..." : out}`);
        });
      }
      if (step.text) {
        console.log(`  → ${step.text}`);
      }
      console.log("");
    },
  });

  if (result.ok) {
    console.log(`✓ Final: ${result.text}`);
    console.log(`  ${result.iterations} iters, ${result.totalTokens} tokens, ${result.elapsedMs}ms`);
  } else {
    console.log(`✗ ${result.reason}`);
  }

  console.log("\nNota que cada step incluye 'Thought:' y 'Observation interpretation:'.");
  console.log("Esto agrega tokens (más caro y más lento) pero da trazabilidad explícita del razonamiento.");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
