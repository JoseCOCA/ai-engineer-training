/**
 * Smoke test del setup del curso.
 *
 * Verifica que:
 *  1) ANTHROPIC_API_KEY está presente en el entorno.
 *  2) La API de Anthropic responde correctamente.
 *
 * Uso:
 *   pnpm install
 *   pnpm smoke-test
 *
 * Las variables de entorno se cargan vía --env-file=../../.env
 * (definido en el script smoke-test del package.json).
 *
 * Modelo: usamos Haiku 4.5 hardcoded por ser el más barato.
 * Las sesiones reales del curso usarán DEFAULT_MODEL del .env.
 */

import Anthropic from "@anthropic-ai/sdk";

const SMOKE_TEST_MODEL = "claude-haiku-4-5-20251001";

// Precios aproximados de Haiku 4.5 (USD por 1M tokens) — valores informativos.
// Verifica los precios actuales en https://www.anthropic.com/pricing
const PRICE_INPUT_PER_MTOK = 1.0;
const PRICE_OUTPUT_PER_MTOK = 5.0;

function fail(message: string): never {
  console.error(`\n  ERROR: ${message}\n`);
  process.exit(1);
}

function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * PRICE_INPUT_PER_MTOK;
  const outputCost = (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_MTOK;
  return inputCost + outputCost;
}

async function main(): Promise<void> {
  console.log("\n== Curso AI Engineer — Smoke Test ==\n");

  // Paso 1: validar variables de entorno
  console.log("Verificando variables de entorno...");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    fail(
      "ANTHROPIC_API_KEY no está definida. Revisa que tu .env exista en " +
        "la raíz del repo y contenga la key. Ver docs/01-setup.md sección 4.",
    );
  }
  if (!apiKey.startsWith("sk-ant-")) {
    fail(
      "ANTHROPIC_API_KEY no parece tener el formato correcto " +
        '(debe empezar con "sk-ant-"). Revisa la key en console.anthropic.com.',
    );
  }
  console.log("  OK: ANTHROPIC_API_KEY presente\n");

  // Paso 2: llamada mínima a la API
  console.log("Llamando a la API de Anthropic...");
  console.log(`  Modelo: ${SMOKE_TEST_MODEL}`);
  const userPrompt = "Saluda en español en 5 palabras o menos";
  console.log(`  Mensaje: "${userPrompt}"\n`);

  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.create({
      model: SMOKE_TEST_MODEL,
      max_tokens: 50,
      messages: [{ role: "user", content: userPrompt }],
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    fail(
      `La llamada a Anthropic falló: ${errorMessage}\n  ` +
        "Posibles causas: API key inválida, sin créditos, sin conexión a internet.",
    );
  }

  // Paso 3: extraer texto de la respuesta
  const textBlock = response.content.find((block) => block.type === "text");
  const text = textBlock?.type === "text" ? textBlock.text : "[respuesta sin texto]";

  console.log("Respuesta recibida:");
  console.log(`  "${text.trim()}"\n`);

  // Paso 4: métricas de uso
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costUsd = estimateCostUsd(inputTokens, outputTokens);

  console.log("Métricas:");
  console.log(`  Input tokens:   ${inputTokens.toString().padStart(4)}`);
  console.log(`  Output tokens:  ${outputTokens.toString().padStart(4)}`);
  console.log(`  Costo aprox:    USD ${costUsd.toFixed(5)}\n`);

  console.log("== Setup verificado correctamente ==\n");
}

main().catch((err) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  fail(`Error inesperado: ${errorMessage}`);
});
