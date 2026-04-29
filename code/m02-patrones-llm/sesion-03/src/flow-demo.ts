/**
 * Llena logs/calls.jsonl con varias llamadas en distintos flows
 * para que aggregate.ts tenga datos para resumir.
 */
import { chat } from "./lib/chat.js";

const FLOWS = [
  {
    flow: "chat-default",
    runs: 3,
    user: "Saluda al cliente en una frase.",
  },
  {
    flow: "intent-classifier",
    runs: 2,
    user: "Clasifica este mensaje en {pregunta, reclamo, derivar}: 'no me llegó el pedido'.",
  },
  {
    flow: "product-suggester",
    runs: 2,
    user: "Sugiere 3 productos relacionados con una mochila de senderismo.",
  },
];

async function main(): Promise<void> {
  for (const block of FLOWS) {
    for (let i = 0; i < block.runs; i++) {
      const r = await chat({
        system: "Eres el asistente virtual de TiendaPro.",
        messages: [{ role: "user", content: block.user }],
        flow: block.flow,
        maxOutputTokens: 100,
      });
      console.log(
        `[${block.flow}] run ${i + 1}: ${r.outputTokens} out, ${r.latencyMs}ms, $${r.costUsd.toFixed(7)}`,
      );
    }
  }

  console.log("");
  console.log("Llamadas registradas. Corre `pnpm run aggregate` para ver el resumen.");
}

main().catch((error: unknown) => {
  console.error("Error:", error);
  process.exit(1);
});
