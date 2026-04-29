/**
 * Retry con backoff exponencial + jitter.
 *
 * - maxRetries: cuántos intentos adicionales tras el primero.
 * - baseDelayMs: espera mínima inicial.
 * - factor: multiplicador entre intentos (típicamente 2 → exponencial).
 * - shouldRetry: predicado que decide si un error es transitorio.
 *
 * Patrón AWS estándar. Sin jitter, clusters grandes generan
 * tormentas sincronizadas que tiran al proveedor.
 */
export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  factor?: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
}

const DEFAULT_OPTS: Required<Omit<RetryOptions, "onRetry">> = {
  maxRetries: 3,
  baseDelayMs: 200,
  factor: 2,
  shouldRetry: defaultShouldRetry,
};

export function defaultShouldRetry(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();

  // Errores transitorios — vale reintentar.
  if (msg.includes("429")) return true;
  if (msg.includes("rate limit")) return true;
  if (msg.includes("503")) return true;
  if (msg.includes("502")) return true;
  if (msg.includes("500")) return true;
  if (msg.includes("timeout")) return true;
  if (msg.includes("etimedout")) return true;
  if (msg.includes("econnreset")) return true;
  if (msg.includes("fetch failed")) return true;
  if (msg.includes("network")) return true;

  // 4xx (excepto 429), key inválida, prompt malformado: NO reintentar.
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<{ value: T; attempts: number }> {
  const merged = { ...DEFAULT_OPTS, ...opts };
  let lastError: unknown;

  for (let attempt = 1; attempt <= merged.maxRetries + 1; attempt++) {
    try {
      const value = await fn();
      return { value, attempts: attempt };
    } catch (error) {
      lastError = error;
      const isLast = attempt === merged.maxRetries + 1;
      const retryable = merged.shouldRetry(error);

      if (isLast || !retryable) break;

      const delay =
        merged.baseDelayMs * Math.pow(merged.factor, attempt - 1) +
        Math.random() * merged.baseDelayMs;

      opts.onRetry?.(attempt, error);
      await sleep(delay);
    }
  }

  throw lastError;
}
