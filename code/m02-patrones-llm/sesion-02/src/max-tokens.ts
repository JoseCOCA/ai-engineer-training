/**
 * S02 — Ejercicio 4: maxOutputTokens y finishReason.
 *
 * Hace una llamada con maxOutputTokens deliberadamente bajo (30)
 * para forzar el corte por límite. Verás finishReason: "length"
 * y la respuesta cortada a mitad de oración.
 *
 * Tarea sugerida: cambia MAX_OUTPUT a 300 y ejecuta de nuevo.
 * La respuesta debería terminar sola con finishReason: "stop".
 */
import { generateText } from "ai";
import { llm, providerInUse } from "./lib/llm.js";

const MAX_OUTPUT = 30;

async function main(): Promise<void> {
  console.log(`[provider: ${providerInUse}]`);
  console.log(`[maxOutputTokens: ${MAX_OUTPUT}]`);
  console.log("");

  const result = await generateText({
    model: llm,
    system: "Eres un asistente técnico claro y conciso.",
    prompt: "Explica qué es un Transformer en aproximadamente 200 palabras.",
    temperature: 0.5,
    maxOutputTokens: MAX_OUTPUT,
  });

  console.log("Respuesta:");
  console.log(result.text);
  console.log("");
  console.log(
    `Tokens — input: ${result.usage.inputTokens}, output: ${result.usage.outputTokens}`,
  );
  console.log(`finishReason: ${result.finishReason}`);
  console.log("");

  if (result.finishReason === "length") {
    console.log(
      "→ La respuesta llegó truncada al usuario. En producción, esto es un bug.",
    );
    console.log(
      "  Acciones razonables: 1) loguear, 2) subir maxOutputTokens, 3) acortar prompt.",
    );
  } else {
    console.log("→ El modelo terminó por sí mismo. maxOutputTokens es suficiente.");
  }
}

main().catch((error: unknown) => {
  console.error("Error:", error);
  process.exit(1);
});
