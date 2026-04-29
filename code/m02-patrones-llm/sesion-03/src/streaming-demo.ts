/**
 * Demo de chatStream():
 *  1. Stream completo, observamos chunks llegando + metadata final.
 *  2. Stream cancelado a mitad con AbortController.
 */
import { chatStream } from "./lib/chat.js";

async function fullStream(): Promise<void> {
  console.log("=== Stream completo ===");
  process.stdout.write("TiendaPro: ");

  const { textStream, finished } = chatStream({
    system: "Eres el asistente virtual de TiendaPro. Responde de forma amable.",
    messages: [
      {
        role: "user",
        content:
          "Explícame brevemente cómo funciona la política de devoluciones (~80 palabras).",
      },
    ],
    flow: "streaming-demo",
    maxOutputTokens: 200,
  });

  for await (const chunk of textStream) {
    process.stdout.write(chunk);
  }

  console.log("");
  console.log("");

  try {
    const meta = await finished;
    console.log(
      `[stream completed: ${meta.outputTokens} output tokens, ${meta.latencyMs}ms total]`,
    );
  } catch (error) {
    console.log(
      `[stream errored: ${error instanceof Error ? error.message : error}]`,
    );
  }
}

async function abortedStream(): Promise<void> {
  console.log("");
  console.log("=== Stream cancelado a 500ms ===");
  process.stdout.write("TiendaPro: ");

  const controller = new AbortController();
  const { textStream, finished } = chatStream({
    system: "Eres el asistente virtual de TiendaPro.",
    messages: [
      {
        role: "user",
        content: "Explícame con detalle todas las políticas comerciales.",
      },
    ],
    flow: "streaming-demo-abort",
    maxOutputTokens: 800,
    abortSignal: controller.signal,
  });

  setTimeout(() => controller.abort(), 500);

  for await (const chunk of textStream) {
    process.stdout.write(chunk);
  }

  console.log("");

  try {
    await finished;
  } catch {
    console.log("[stream aborted by client]");
  }
}

async function main(): Promise<void> {
  await fullStream();
  await abortedStream();
}

main().catch((error: unknown) => {
  console.error("Error:", error);
  process.exit(1);
});
