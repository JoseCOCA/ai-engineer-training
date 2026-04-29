/**
 * Comparativa multi-provider — Sesión 01.2.
 *
 * Corre EL MISMO prompt contra todos los proveedores LLM configurados
 * en el .env de la raíz del repo, y reporta:
 *   - La respuesta completa de cada uno (para comparar estilo y calidad)
 *   - Tokens de input y output
 *   - Costo estimado en USD (snapshot abril 2026)
 *   - Latencia total
 *   - Throughput de generación (tokens/segundo)
 *
 * El objetivo pedagógico es que veas con tus propios ojos:
 *   - Que la MISMA llamada produce respuestas distintas según el proveedor.
 *   - Que el costo varía órdenes de magnitud entre tiers.
 *   - Que la latencia depende mucho del proveedor y del hardware.
 *
 * Uso:
 *   pnpm install
 *   pnpm compare
 *
 * Si quieres cambiar el prompt, edita la constante PROMPT abajo.
 */
import { generateText, type LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider-v2";

// ---------------------------------------------------------------------------
// Lo que vas a comparar — modifica libremente.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
  "Eres un asistente útil. Responde en español neutro, claro y conciso.";

const PROMPT =
  "Como cliente, ayudame a decidir entre comprar un libro impreso o un e-reader. " +
  "Listame 3 ventajas y 3 desventajas de cada opción. Sé breve.";

// ---------------------------------------------------------------------------
// Configuración de proveedores.
// Precios snapshot abril 2026 — verifica en https://artificialanalysis.ai
// ---------------------------------------------------------------------------

interface ProviderConfig {
  id: string;
  modelLabel: string;
  isAvailable: () => boolean;
  buildModel: () => LanguageModel;
  pricePerMillionInput: number;
  pricePerMillionOutput: number;
}

const providers: ProviderConfig[] = [
  {
    id: "ollama",
    modelLabel: process.env.OLLAMA_MODEL ?? "qwen2.5:7b",
    isAvailable: () => Boolean(process.env.OLLAMA_BASE_URL),
    buildModel: () => {
      const ollama = createOllama({
        baseURL: `${process.env.OLLAMA_BASE_URL}/api`,
      });
      return ollama(process.env.OLLAMA_MODEL ?? "qwen2.5:7b");
    },
    pricePerMillionInput: 0,
    pricePerMillionOutput: 0,
  },
  {
    id: "google",
    modelLabel: process.env.GOOGLE_MODEL ?? "gemini-2.5-flash",
    isAvailable: () => Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    buildModel: () => google(process.env.GOOGLE_MODEL ?? "gemini-2.5-flash"),
    pricePerMillionInput: 0.2,
    pricePerMillionOutput: 1.0,
  },
  {
    id: "anthropic",
    modelLabel: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
    isAvailable: () => Boolean(process.env.ANTHROPIC_API_KEY),
    buildModel: () =>
      anthropic(process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001"),
    pricePerMillionInput: 1.0,
    pricePerMillionOutput: 5.0,
  },
  {
    id: "openai",
    modelLabel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    isAvailable: () => Boolean(process.env.OPENAI_API_KEY),
    buildModel: () => openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
    pricePerMillionInput: 0.15,
    pricePerMillionOutput: 0.6,
  },
];

interface RunOK {
  kind: "ok";
  id: string;
  modelLabel: string;
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}

interface RunError {
  kind: "error";
  id: string;
  modelLabel: string;
  message: string;
}

type RunResult = RunOK | RunError;

async function runProvider(p: ProviderConfig): Promise<RunResult> {
  try {
    const model = p.buildModel();
    const start = Date.now();
    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: PROMPT,
    });
    const latencyMs = Date.now() - start;

    const inputTokens = result.usage.inputTokens ?? 0;
    const outputTokens = result.usage.outputTokens ?? 0;
    const costUsd =
      (inputTokens / 1_000_000) * p.pricePerMillionInput +
      (outputTokens / 1_000_000) * p.pricePerMillionOutput;

    return {
      kind: "ok",
      id: p.id,
      modelLabel: p.modelLabel,
      text: result.text,
      inputTokens,
      outputTokens,
      costUsd,
      latencyMs,
    };
  } catch (error) {
    return {
      kind: "error",
      id: p.id,
      modelLabel: p.modelLabel,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function fmtCost(usd: number): string {
  if (usd === 0) return "free (local)";
  if (usd < 0.0001) return `$${usd.toExponential(2)}`;
  return `$${usd.toFixed(6)}`;
}

async function main(): Promise<void> {
  const available = providers.filter((p) => p.isAvailable());

  console.log("=".repeat(72));
  console.log("Comparativa multi-provider — Sesión 01.2");
  console.log("=".repeat(72));
  console.log();
  console.log(`System: ${SYSTEM_PROMPT}`);
  console.log(`Prompt: ${PROMPT}`);
  console.log();
  console.log(
    `Proveedores disponibles (${available.length}/${providers.length}): ${available.map((p) => p.id).join(", ") || "ninguno"}`,
  );

  if (available.length === 0) {
    console.log();
    console.error(
      "Configura al menos un proveedor LLM en tu .env (ver env.example en la raíz del repo).",
    );
    process.exit(1);
  }

  console.log();
  console.log("Ejecutando llamadas en serie...");
  console.log();

  const results: RunResult[] = [];
  for (const p of available) {
    process.stdout.write(`  ${p.id.padEnd(10)} `);
    const r = await runProvider(p);
    results.push(r);
    if (r.kind === "ok") {
      console.log(`OK  (${r.latencyMs}ms, ${r.outputTokens} tokens out)`);
    } else {
      console.log(`ERROR  ${r.message}`);
    }
  }

  const oks = results.filter((r): r is RunOK => r.kind === "ok");

  console.log();
  console.log("=".repeat(72));
  console.log("RESPUESTAS (mismo prompt, distintos proveedores)");
  console.log("=".repeat(72));

  for (const r of oks) {
    console.log();
    console.log(`--- ${r.id} (${r.modelLabel}) ---`);
    console.log(r.text);
  }

  console.log();
  console.log("=".repeat(72));
  console.log("MÉTRICAS");
  console.log("=".repeat(72));
  console.log();

  const cols = [
    "Provider".padEnd(11),
    "Input".padStart(7),
    "Output".padStart(7),
    "Cost (USD)".padStart(14),
    "Latency".padStart(10),
    "Tok/s".padStart(7),
  ];
  const header = cols.join("  ");
  console.log(header);
  console.log("-".repeat(header.length));

  for (const r of oks) {
    const tokensPerSec = r.outputTokens / (r.latencyMs / 1000);
    const row = [
      r.id.padEnd(11),
      String(r.inputTokens).padStart(7),
      String(r.outputTokens).padStart(7),
      fmtCost(r.costUsd).padStart(14),
      `${r.latencyMs}ms`.padStart(10),
      tokensPerSec.toFixed(1).padStart(7),
    ].join("  ");
    console.log(row);
  }

  console.log();
  console.log(
    "Nota: precios snapshot abril 2026. Verifica vivos en artificialanalysis.ai",
  );
}

main().catch((error: unknown) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
