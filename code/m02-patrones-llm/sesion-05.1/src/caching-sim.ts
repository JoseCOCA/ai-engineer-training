/**
 * Simulación de ahorro con prompt caching.
 *
 * No hace llamadas reales. Calcula con números:
 *  - System+contexto estable de 5K tokens, idéntico para todas las llamadas.
 *  - 100 llamadas con prompts cortos del usuario.
 *  - Sin caching: input full price.
 *  - Con caching: 1ª llamada full price, siguientes a 10% (típico).
 */

const SYSTEM_TOKENS = 5000;
const N_CALLS = 100;

const PRICE_INPUT_FULL_USD_PER_1M = 1.0;
const PRICE_INPUT_CACHED_USD_PER_1M = 0.1;

function noCachingCost(): number {
  return (SYSTEM_TOKENS * N_CALLS * PRICE_INPUT_FULL_USD_PER_1M) / 1_000_000;
}

function withCachingCost(): number {
  const firstCall = (SYSTEM_TOKENS * PRICE_INPUT_FULL_USD_PER_1M) / 1_000_000;
  const remainingCalls =
    (SYSTEM_TOKENS * (N_CALLS - 1) * PRICE_INPUT_CACHED_USD_PER_1M) / 1_000_000;
  return firstCall + remainingCalls;
}

function main(): void {
  const without = noCachingCost();
  const withCache = withCachingCost();
  const savings = without - withCache;
  const savingsPct = (savings / without) * 100;

  console.log(`Escenario: ${N_CALLS} llamadas con system+contexto de ${SYSTEM_TOKENS} tokens.`);
  console.log("");
  console.log(`Sin caching:  ${N_CALLS} × ${SYSTEM_TOKENS} × $${PRICE_INPUT_FULL_USD_PER_1M}/1M = $${without.toFixed(4)}`);
  console.log(
    `Con caching:  1 × ${SYSTEM_TOKENS} × $${PRICE_INPUT_FULL_USD_PER_1M}/1M + ${N_CALLS - 1} × ${SYSTEM_TOKENS} × $${PRICE_INPUT_CACHED_USD_PER_1M}/1M = $${withCache.toFixed(4)}`,
  );
  console.log("");
  console.log(`Ahorro absoluto:    $${savings.toFixed(4)}`);
  console.log(`Ahorro porcentual:  ${savingsPct.toFixed(0)}%`);
  console.log("");
  console.log("Proyección a volumen:");
  console.log(`  10K llamadas/día → ahorro ~$${(savings * 100 * 30).toFixed(0)}/mes`);
  console.log(`  100K llamadas/día → ahorro ~$${(savings * 1000 * 30).toFixed(0)}/mes`);
}

main();
