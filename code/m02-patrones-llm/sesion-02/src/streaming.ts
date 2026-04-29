/**
 * S02 — Ejercicio 3: generateText vs streamText.
 *
 * Ejecuta el mismo prompt dos veces:
 *  1) con generateText (bloqueante hasta tener la respuesta completa)
 *  2) con streamText    (recibe la respuesta token a token)
 *
 * Imprime Total Time y Time-to-First-Token (TTFT) para que veas
 * la diferencia operacional. El total es similar; el TTFT cambia
 * radicalmente. Es lo que hace que el chat se sienta vivo.
 */
import { generateText, streamText } from "ai";
import { llm, providerInUse } from "./lib/llm.js";

const SYSTEM_PROMPT =
  "Eres un asistente de e-commerce. Responde con tono amable y conciso.";

const USER_PROMPT =
  "Explica brevemente qué es una política de devolución estándar y qué incluye. Aproximadamente 150 palabras.";

async function withGenerateText(): Promise<void> {
  console.log("=== generateText ===");
  const start = Date.now();
  const result = await generateText({
    model: llm,
    system: SYSTEM_PROMPT,
    prompt: USER_PROMPT,
    temperature: 0.5,
    maxOutputTokens: 400,
  });
  const totalMs = Date.now() - start;

  console.log(result.text);
  console.log("");
  console.log(`Total time: ${(totalMs / 1000).toFixed(2)}s`);
  console.log(`Time to first token: ${(totalMs / 1000).toFixed(2)}s`);
  console.log("");
}

async function withStreamText(): Promise<void> {
  console.log("=== streamText ===");
  const start = Date.now();
  let firstTokenAt: number | null = null;

  const result = streamText({
    model: llm,
    system: SYSTEM_PROMPT,
    prompt: USER_PROMPT,
    temperature: 0.5,
    maxOutputTokens: 400,
  });

  for await (const chunk of result.textStream) {
    if (firstTokenAt === null) firstTokenAt = Date.now() - start;
    process.stdout.write(chunk);
  }

  const totalMs = Date.now() - start;
  console.log("");
  console.log("");
  console.log(`Total time: ${(totalMs / 1000).toFixed(2)}s`);
  console.log(
    `Time to first token: ${((firstTokenAt ?? totalMs) / 1000).toFixed(2)}s`,
  );
  console.log("");
}

async function main(): Promise<void> {
  console.log(`[provider: ${providerInUse}]`);
  console.log("");

  await withGenerateText();
  await withStreamText();

  console.log(
    "Observa la diferencia entre Total time y Time to first token.",
  );
  console.log(
    "Streaming mantiene TTFT bajo aunque el total sea similar — eso hace la UX.",
  );
}

main().catch((error: unknown) => {
  console.error("Error:", error);
  process.exit(1);
});
