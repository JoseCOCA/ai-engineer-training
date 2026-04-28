/**
 * Smoke test multi-provider del setup del curso.
 *
 * Detecta qué proveedores LLM están configurados en el entorno
 * y prueba todos los disponibles haciendo una llamada mínima
 * a cada uno. Reporta tokens, costo aproximado y latencia.
 *
 * Esta es la primera muestra práctica del patrón de abstracción
 * de proveedores: una sola función (generateText del Vercel AI SDK)
 * sirve para llamar a Ollama, Gemini, Claude u OpenAI sin cambiar
 * el código del consumidor.
 *
 * Uso:
 *   pnpm install
 *   pnpm smoke-test
 *
 * Las variables de entorno se cargan via --env-file=../../.env
 * (configurado en el script smoke-test del package.json).
 */

import { generateText, type LanguageModel } from "ai";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider";

// ---------------------------------------------------------------------------
// Configuración de proveedores
// ---------------------------------------------------------------------------

type ProviderResult =
  | { kind: "skipped"; reason: string }
  | {
      kind: "ok";
      response: string;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      costNote: string;
      elapsedMs: number;
    }
  | { kind: "error"; message: string };

interface ProviderConfig {
  id: string;
  label: string;
  modelLabel: () => string;
  isAvailable: () => boolean;
  skipReason: () => string;
  buildModel: () => LanguageModel;
  estimateCostUsd: (inputTokens: number, outputTokens: number) => number;
  costNote: string;
}

// Modelos por defecto — se pueden sobrescribir vía env
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";
const GOOGLE_MODEL = process.env.GOOGLE_MODEL || "gemini-2.0-flash-exp";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const providers: ProviderConfig[] = [
  {
    id: "ollama",
    label: "Ollama (local)",
    modelLabel: () => OLLAMA_MODEL,
    isAvailable: () => Boolean(process.env.OLLAMA_BASE_URL),
    skipReason: () => "OLLAMA_BASE_URL no definida",
    buildModel: () => {
      const ollama = createOllama({
        baseURL: `${process.env.OLLAMA_BASE_URL}/api`,
      });
      return ollama(OLLAMA_MODEL);
    },
    estimateCostUsd: () => 0,
    costNote: "local",
  },
  {
    id: "google",
    label: "Google Gemini",
    modelLabel: () => GOOGLE_MODEL,
    isAvailable: () => Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    skipReason: () => "GOOGLE_GENERATIVE_AI_API_KEY no definida",
    buildModel: () => google(GOOGLE_MODEL),
    estimateCostUsd: () => 0,
    costNote: "free tier",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    modelLabel: () => ANTHROPIC_MODEL,
    isAvailable: () => Boolean(process.env.ANTHROPIC_API_KEY),
    skipReason: () => "ANTHROPIC_API_KEY no definida",
    buildModel: () => anthropic(ANTHROPIC_MODEL),
    // Precios Haiku 4.5: USD/1M tokens — verifica anthropic.com/pricing
    estimateCostUsd: (i, o) => (i / 1_000_000) * 1.0 + (o / 1_000_000) * 5.0,
    costNote: "pago por uso",
  },
  {
    id: "openai",
    label: "OpenAI",
    modelLabel: () => OPENAI_MODEL,
    isAvailable: () => Boolean(process.env.OPENAI_API_KEY),
    skipReason: () => "OPENAI_API_KEY no definida",
    buildModel: () => openai(OPENAI_MODEL),
    // Precios gpt-4o-mini aproximados — verifica openai.com/pricing
    estimateCostUsd: (i, o) => (i / 1_000_000) * 0.15 + (o / 1_000_000) * 0.6,
    costNote: "pago por uso",
  },
];

// ---------------------------------------------------------------------------
// Lógica del smoke test
// ---------------------------------------------------------------------------

const PROMPT = "Saluda en español en 5 palabras o menos";
const MAX_TOKENS = 50;

async function testProvider(p: ProviderConfig): Promise<ProviderResult> {
  if (!p.isAvailable()) {
    return { kind: "skipped", reason: p.skipReason() };
  }

  const model = p.buildModel();
  const start = Date.now();

  try {
    const result = await generateText({
      model,
      prompt: PROMPT,
      maxOutputTokens: MAX_TOKENS,
    });

    const elapsedMs = Date.now() - start;
    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;

    return {
      kind: "ok",
      response: result.text.trim(),
      inputTokens,
      outputTokens,
      costUsd: p.estimateCostUsd(inputTokens, outputTokens),
      costNote: p.costNote,
      elapsedMs,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: "error", message };
  }
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

// ---------------------------------------------------------------------------
// Programa principal
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("\n== Curso AI Engineer — Smoke Test ==\n");

  // Detección
  console.log("Detectando proveedores configurados...");
  const detection = providers.map((p) => ({
    provider: p,
    available: p.isAvailable(),
  }));

  for (const { provider, available } of detection) {
    const status = available ? "[OK]  " : "[SKIP]";
    const label = pad(provider.label, 22);
    const detail = available ? provider.modelLabel() : `(${provider.skipReason()})`;
    console.log(`  ${status} ${label} ${detail}`);
  }
  console.log();

  const availableCount = detection.filter((d) => d.available).length;
  if (availableCount === 0) {
    console.error(
      "ERROR: ningún proveedor configurado.\n" +
        "       Define al menos uno en .env: OLLAMA_BASE_URL,\n" +
        "       GOOGLE_GENERATIVE_AI_API_KEY, ANTHROPIC_API_KEY u OPENAI_API_KEY.\n" +
        "       Ver docs/01-setup.md sección 3.\n",
    );
    process.exit(1);
  }

  // Pruebas
  console.log(`Probando ${availableCount} proveedor(es)...\n`);
  let passed = 0;

  for (const p of providers) {
    const result = await testProvider(p);

    if (result.kind === "skipped") continue;

    console.log(`[${p.label} — ${p.modelLabel()}]`);

    if (result.kind === "error") {
      console.log(`  ERROR:        ${result.message}`);
      console.log();
      continue;
    }

    passed += 1;
    console.log(`  Respuesta:    "${result.response}"`);
    console.log(`  Tokens:       in=${result.inputTokens} out=${result.outputTokens}`);
    console.log(
      `  Costo:        USD ${result.costUsd.toFixed(5)} (${result.costNote})`,
    );
    console.log(`  Tiempo:       ${(result.elapsedMs / 1000).toFixed(3)} s`);
    console.log();
  }

  console.log(
    passed === availableCount
      ? "== Setup verificado correctamente =="
      : "== Setup parcialmente verificado ==",
  );
  console.log(
    `${passed} de ${availableCount} proveedores configurados respondieron correctamente.\n`,
  );

  if (passed === 0) process.exit(1);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n  ERROR inesperado: ${message}\n`);
  process.exit(1);
});
