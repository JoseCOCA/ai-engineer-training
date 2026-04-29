/**
 * Demo del clasificador de intent.
 * Ejecuta varios mensajes representativos para ver cómo se comporta
 * el schema constrained y los confidence resultantes.
 */
import { classifyIntent } from "./intent.js";

const MESSAGES = [
  "¿cuánto cuesta el envío a Madrid?",
  "no me llegó el pedido y estoy harto, hace 2 semanas que espero",
  "quiero hablar con un humano AHORA",
  "ayer entregaron el producto, gracias",
  "hablemos de fútbol",
];

async function main(): Promise<void> {
  for (const msg of MESSAGES) {
    const result = await classifyIntent(msg);
    console.log(
      `"${msg}"\n  → ${result.intent} (${result.confidence.toFixed(2)})  · ${result.reasoning}\n`,
    );
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
