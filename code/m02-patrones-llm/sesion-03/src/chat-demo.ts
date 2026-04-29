/**
 * Demo del chat service básico.
 *
 * Ejecuta una llamada normal a través de chat() y muestra la
 * respuesta + métricas instrumentadas (latencia, tokens, costo,
 * flow, attempts, fallbackUsed).
 */
import { chat } from "./lib/chat.js";

async function main(): Promise<void> {
  const response = await chat({
    system:
      "Eres el asistente virtual oficial de TiendaPro. Responde con tono amable y conciso.",
    messages: [
      { role: "user", content: "Preséntate brevemente. Una sola frase." },
    ],
    flow: "chat-default",
  });

  console.log(`[provider: ${response.provider}]`);
  console.log(`[flow: ${response.flow}]`);
  console.log("");
  console.log(`→ Respuesta: ${response.text}`);
  console.log("");
  console.log(
    `Tokens — input: ${response.inputTokens}, output: ${response.outputTokens}`,
  );
  console.log(`Latencia: ${response.latencyMs}ms`);
  console.log(`Costo estimado: $${response.costUsd.toFixed(7)}`);
  console.log(`finishReason: ${response.finishReason}`);
  console.log(
    `attempts: ${response.attempts}, fallbackUsed: ${response.fallbackUsed}`,
  );
}

main().catch((error: unknown) => {
  console.error("Error:", error);
  process.exit(1);
});
