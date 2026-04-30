/**
 * Demo 3 — Lost in the middle: el orden del contexto importa.
 *
 * Mismo conjunto de chunks, mismas instrucciones, misma query — pero
 * los chunks se reordenan en cuatro disposiciones distintas:
 *
 *   A. Relevante al inicio (pos 1).
 *   B. Relevante al final (pos N).
 *   C. Relevante al medio (pos N/2).
 *   D. U-shape: 1er más relevante al inicio, 2do más relevante al final.
 *
 * El LLM no debería ser indiferente a la posición. Liu et al. (2023)
 * documentaron este sesgo en profundidad.
 */
import { chat } from "@curso-ai/llm";
import { createPool } from "./lib/db.js";
import { denseRetrieve, type ProductRow } from "./lib/retrievers.js";

const QUERY = "¿tienen una linterna recargable?";
const POOL_SIZE = 7;

const SYSTEM_PROMPT = [
  "Eres un asistente del e-commerce TiendaPro.",
  "Respondes con la información del contexto.",
  "Si el contexto contiene un producto que responde la pregunta, cítalo por id.",
  "Si no encontraste un producto adecuado, di: \"No tengo información sobre eso\".",
].join("\n");

function formatContext(items: ProductRow[]): string {
  return items
    .map(
      (p, i) =>
        `[${i + 1}] ${p.id} — ${p.name}\n    ${p.description} Categoría: ${p.category}.`,
    )
    .join("\n");
}

async function ask(items: ProductRow[], flow: string): Promise<string> {
  const userPrompt = [
    "Contexto recuperado:",
    "---",
    formatContext(items),
    "---",
    "",
    `Pregunta: ${QUERY}`,
  ].join("\n");

  const res = await chat({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    temperature: 0,
    flow,
  });
  return res.text.trim();
}

function reorderRelevantFirst(items: ProductRow[], relevantId: string): ProductRow[] {
  const relevant = items.find((x) => x.id === relevantId);
  if (!relevant) return items;
  return [relevant, ...items.filter((x) => x.id !== relevantId)];
}

function reorderRelevantLast(items: ProductRow[], relevantId: string): ProductRow[] {
  const rest = items.filter((x) => x.id !== relevantId);
  const relevant = items.find((x) => x.id === relevantId);
  return relevant ? [...rest, relevant] : items;
}

function reorderRelevantMiddle(items: ProductRow[], relevantId: string): ProductRow[] {
  const rest = items.filter((x) => x.id !== relevantId);
  const mid = Math.floor(rest.length / 2);
  const relevant = items.find((x) => x.id === relevantId);
  if (!relevant) return items;
  return [...rest.slice(0, mid), relevant, ...rest.slice(mid)];
}

function reorderUshape(items: ProductRow[], relevantId: string, secondRelevantId: string): ProductRow[] {
  const relevant = items.find((x) => x.id === relevantId);
  const second = items.find((x) => x.id === secondRelevantId);
  const rest = items.filter((x) => x.id !== relevantId && x.id !== secondRelevantId);
  if (!relevant) return items;
  return [relevant, ...rest, ...(second ? [second] : [])];
}

async function main(): Promise<void> {
  const pool = createPool();
  try {
    console.log(`Query: "${QUERY}"\n`);

    const candidates = await denseRetrieve(pool, QUERY, POOL_SIZE);
    if (candidates.length < 3) {
      console.log("(no hay suficientes candidatos para el demo)");
      return;
    }

    const relevantId = candidates[0].id;
    const secondRelevantId = candidates[1].id;
    console.log(`Documento RELEVANTE elegido: ${relevantId} (${candidates[0].name})`);
    console.log(`Segundo más relevante:        ${secondRelevantId} (${candidates[1].name})`);
    console.log(`Pool total: ${candidates.length} chunks\n`);

    const orders: Array<{ label: string; items: ProductRow[]; flow: string }> = [
      {
        label: "A · Relevante al INICIO (pos 1)",
        items: reorderRelevantFirst(candidates, relevantId),
        flow: "m04-s11.1-litm-a",
      },
      {
        label: `B · Relevante al FINAL (pos ${candidates.length})`,
        items: reorderRelevantLast(candidates, relevantId),
        flow: "m04-s11.1-litm-b",
      },
      {
        label: `C · Relevante al MEDIO (pos ${Math.floor(candidates.length / 2) + 1})`,
        items: reorderRelevantMiddle(candidates, relevantId),
        flow: "m04-s11.1-litm-c",
      },
      {
        label: "D · U-SHAPE (relevantes en extremos, irrelevantes al medio)",
        items: reorderUshape(candidates, relevantId, secondRelevantId),
        flow: "m04-s11.1-litm-d",
      },
    ];

    for (const o of orders) {
      console.log(`=== ${o.label} ===`);
      console.log(`  Orden: ${o.items.map((x) => x.id).join(" → ")}`);
      const resp = await ask(o.items, o.flow);
      console.log(`  Respuesta: ${resp.replace(/\n/g, "\n    ")}\n`);
    }

    console.log("Lectura sugerida:");
    console.log("  - El efecto se acentúa con más chunks. Con 7 productos puede ser sutil; con 15-20 se nota más.");
    console.log("  - U-shape suele rendir como inicio (los extremos son fuertes).");
    console.log("  - Reordering es 'mejora gratis': 0 modelos extra, 0 latencia adicional, 0 costo. En producción, siempre.");
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
