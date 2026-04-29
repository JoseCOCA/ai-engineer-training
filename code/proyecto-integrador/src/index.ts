/**
 * TiendaPro — primer commit del asistente.
 *
 * Hace UNA llamada al LLM configurado vía .env y muestra:
 *   - Qué proveedor está activo
 *   - La respuesta del modelo
 *   - Tokens usados (input/output)
 *   - Latencia
 *   - Razón de fin
 *
 * Esta es la "Hello, World!" del proyecto integrador.
 */
import { generateText } from "ai";
import { llm, providerInUse } from "./lib/llm.js";

const SYSTEM_PROMPT = `Eres el asistente virtual oficial de TiendaPro, un e-commerce.
Responde con tono amable, profesional y conciso. No menciones a la competencia.
No inventes información sobre productos, pedidos o políticas — si no sabés algo,
ofrecé derivar a un humano.`;

const USER_PROMPT = "Preséntate brevemente al cliente. Una sola frase.";

async function main(): Promise<void> {
  console.log(`[provider: ${providerInUse}]`);
  console.log("");

  const start = Date.now();

  const result = await generateText({
    model: llm,
    system: SYSTEM_PROMPT,
    prompt: USER_PROMPT,
  });

  const elapsedMs = Date.now() - start;

  console.log(`TiendaPro asistente: ${result.text}`);
  console.log("");
  console.log(
    `Tokens — input: ${result.usage.inputTokens}, output: ${result.usage.outputTokens}`,
  );
  console.log(`Tiempo: ${(elapsedMs / 1000).toFixed(2)}s`);
  console.log(`Razón de fin: ${result.finishReason}`);
}

main().catch((error: unknown) => {
  console.error("Error al llamar al LLM:", error);
  process.exit(1);
});
