/**
 * S02 — Ejercicio 1: el efecto de `temperature`.
 *
 * Ejecuta el mismo prompt 3 veces con cada valor de temperature
 * (0, 0.7, 1.2) y muestra las salidas lado a lado.
 *
 * Lo que tienes que observar:
 *  - temperature=0   → las 3 corridas casi idénticas
 *  - temperature=0.7 → variaciones naturales entre corridas
 *  - temperature=1.2 → puede empezar a derrapar
 */
import { generateText } from "ai";
import { llm, providerInUse } from "./lib/llm.js";

const SYSTEM_PROMPT =
  "Eres un asistente de e-commerce. Responde con tono amable y conciso.";

const USER_PROMPT =
  "Sugiere un saludo de bienvenida creativo en una sola frase.";

const TEMPERATURES = [0, 0.7, 1.2];
const RUNS_PER_TEMP = 3;

async function runOnce(temperature: number): Promise<string> {
  const result = await generateText({
    model: llm,
    system: SYSTEM_PROMPT,
    prompt: USER_PROMPT,
    temperature,
    maxOutputTokens: 80,
  });
  return result.text.trim();
}

async function main(): Promise<void> {
  console.log(`[provider: ${providerInUse}]`);
  console.log("");

  for (const temp of TEMPERATURES) {
    console.log(`=== temperature = ${temp} ===`);
    for (let i = 1; i <= RUNS_PER_TEMP; i++) {
      const text = await runOnce(temp);
      console.log(`  Corrida ${i}: ${text}`);
    }
    console.log("");
  }

  console.log(
    "Observación: con temperature=0 las salidas deberían ser idénticas o casi.",
  );
  console.log(
    "Con temperature=0.7 ves variaciones naturales. Con 1.2 puede derrapar.",
  );
}

main().catch((error: unknown) => {
  console.error("Error:", error);
  process.exit(1);
});
