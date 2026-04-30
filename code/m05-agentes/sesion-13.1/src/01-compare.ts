/**
 * Comparativa lado a lado: bare metal manual vs stopWhen del SDK.
 *
 * Mismo agente (1 tool, 1 query, 1 system prompt). Dos orquestadores.
 *
 * El objetivo es sentir cómo difieren en líneas de código,
 * trazabilidad y control sobre cada step.
 */
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { buildModel, PRIMARY_PROVIDER } from "@curso-ai/llm";
import { sharedTools, SYSTEM_PROMPT, QUERY } from "./lib/shared.js";

interface RunSummary {
  text: string;
  iterations: number;
  totalTokens: number;
  elapsedMs: number;
}

async function modeBareMetal(): Promise<RunSummary> {
  const { model } = buildModel(PRIMARY_PROVIDER);
  const messages: ModelMessage[] = [{ role: "user", content: QUERY }];
  const start = Date.now();
  let totalTokens = 0;

  for (let i = 1; i <= 10; i++) {
    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      messages,
      tools: sharedTools,
      temperature: 0,
    });

    totalTokens += (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0);

    console.log(`[modeA step ${i}] toolCalls=${result.toolCalls.length}, finishReason=${result.finishReason}`);

    if (result.toolCalls.length === 0 || result.finishReason === "stop") {
      return {
        text: result.text,
        iterations: i,
        totalTokens,
        elapsedMs: Date.now() - start,
      };
    }

    messages.push(...result.response.messages);
  }
  throw new Error("max_iter alcanzado");
}

async function modeStopWhen(): Promise<RunSummary> {
  const { model } = buildModel(PRIMARY_PROVIDER);
  const start = Date.now();

  const result = await generateText({
    model,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: QUERY }],
    tools: sharedTools,
    temperature: 0,
    stopWhen: stepCountIs(10),
  });

  const elapsedMs = Date.now() - start;
  const totalTokens =
    (result.totalUsage.inputTokens ?? 0) + (result.totalUsage.outputTokens ?? 0);

  for (const [idx, step] of result.steps.entries()) {
    console.log(
      `[modeB step ${idx + 1}] toolCalls=${step.toolCalls?.length ?? 0}, finishReason=${step.finishReason}`,
    );
  }

  return {
    text: result.text,
    iterations: result.steps.length,
    totalTokens,
    elapsedMs,
  };
}

async function main(): Promise<void> {
  console.log(`Query: "${QUERY}"\n`);

  console.log("=== Modo A · Bare metal manual ===");
  const a = await modeBareMetal();
  console.log(
    `\nResultado: "${a.text}"\n  ${a.iterations} iters, ${a.totalTokens} tokens, ${a.elapsedMs}ms\n`,
  );

  console.log("=== Modo B · SDK con stopWhen ===");
  const b = await modeStopWhen();
  console.log(
    `\nResultado: "${b.text}"\n  ${b.iterations} iters, ${b.totalTokens} tokens, ${b.elapsedMs}ms\n`,
  );

  console.log("=== Diferencias clave ===");
  console.log("Modo A:");
  console.log("  - Loop explícito en código tuyo. Cada step inspeccionable.");
  console.log("  - Termination conditions y observabilidad las defines tú.");
  console.log("  - Más boilerplate, pero más control.");
  console.log("");
  console.log("Modo B:");
  console.log("  - Una sola llamada a generateText. El SDK orquesta.");
  console.log("  - result.steps[] expone metadata de cada step ex-post.");
  console.log("  - Menos código, menos control. No podes inyectar lógica entre steps.");
  console.log("");
  console.log("Regla: si tu agente es simple, modo B alcanza. Si necesitas inyección entre steps (HITL, validación, custom logging), modo A.");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
