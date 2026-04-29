/**
 * Demo: la API es stateless. Sin historial el modelo "olvida".
 *
 * Modo A: cada turno es una llamada fresca, sin pasar mensajes
 * anteriores. El modelo no recuerda nada.
 *
 * Modo B: cada turno acumula el historial. El modelo "recuerda"
 * lo dicho en turnos anteriores porque lo está leyendo cada vez.
 */
import { generateText } from "ai";
import { llm, providerInUse } from "./lib/llm.js";

const SYSTEM = "Eres el asistente virtual de TiendaPro. Responde de forma concisa y amable.";

const TURNS = [
  "Hola, soy Ana.",
  "¿Cuál es mi nombre?",
  "¿Te lo había dicho?",
];

async function modeStateless(): Promise<void> {
  console.log("=== Modo A: stateless (cada turno aislado) ===");
  for (const turn of TURNS) {
    const result = await generateText({
      model: llm,
      system: SYSTEM,
      prompt: turn,
      temperature: 0.3,
      maxOutputTokens: 120,
    });
    console.log(`> ${turn}`);
    console.log(`  ${result.text}\n`);
  }
}

async function modeWithHistory(): Promise<void> {
  console.log("=== Modo B: con historial acumulado ===");
  const messages: { role: "user" | "assistant"; content: string }[] = [];

  for (const turn of TURNS) {
    messages.push({ role: "user", content: turn });
    const result = await generateText({
      model: llm,
      system: SYSTEM,
      messages,
      temperature: 0.3,
      maxOutputTokens: 120,
    });
    messages.push({ role: "assistant", content: result.text });

    console.log(`> ${turn}`);
    console.log(`  ${result.text}\n`);
  }
}

async function main(): Promise<void> {
  console.log(`[provider: ${providerInUse}]\n`);
  await modeStateless();
  console.log("");
  await modeWithHistory();
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
