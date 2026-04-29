/**
 * Demo de retry sin tocar a un proveedor real.
 *
 * Mockea una función que falla con "429 rate limit" en los
 * primeros N intentos y devuelve OK después. Sirve para ver
 * el patrón de backoff exponencial con jitter sin gastar tokens.
 */
import { withRetry } from "./lib/retry.js";

let callCount = 0;
const FAIL_UNTIL_ATTEMPT = 3;

async function flakyCall(): Promise<string> {
  callCount += 1;
  console.log(`[Intento ${callCount}] llamada simulada`);
  if (callCount < FAIL_UNTIL_ATTEMPT) {
    throw new Error("429 Too Many Requests — rate limit hit");
  }
  return `OK desde intento ${callCount}`;
}

async function main(): Promise<void> {
  console.log("Simulando 2 fallos transitorios + éxito al tercer intento.");
  console.log("");

  const result = await withRetry(flakyCall, {
    maxRetries: 4,
    baseDelayMs: 200,
    factor: 2,
    onRetry: (attempt, error) => {
      console.warn(
        `  [retry ${attempt}] error: ${error instanceof Error ? error.message : error}`,
      );
    },
  });

  console.log("");
  console.log(`✓ Respuesta final: ${result.value}`);
  console.log(`Total attempts: ${result.attempts}`);
}

main().catch((error: unknown) => {
  console.error("Error final:", error);
  process.exit(1);
});
