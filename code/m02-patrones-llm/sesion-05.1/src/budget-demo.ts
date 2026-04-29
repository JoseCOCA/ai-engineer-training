/**
 * Demo del budget de tokens.
 *
 * Tres casos:
 *  1) Normal — todo entra dentro del presupuesto.
 *  2) Historial inflado — se trunca conservando lo reciente.
 *  3) Patológico — system prompt excede su budget → error explícito.
 */
import { enforceContextBudget, ContextBudgetExceeded } from "./budget.js";

const LIMITS = {
  systemPrompt: 1500,
  history: 4000,
  ragChunks: 6000,
  reservedForResponse: 1500,
  hardCeiling: 13000,
};

function fakeMessages(count: number, baseLength = 60): string[] {
  return Array.from({ length: count }, (_, i) =>
    `Mensaje #${i + 1}: ${"a".repeat(baseLength)}`,
  );
}

function caseNormal(): void {
  console.log("--- Caso 1: normal ---");
  const result = enforceContextBudget(
    {
      systemPrompt: "Eres el asistente de TiendaPro. Responde con tono amable.",
      history: fakeMessages(8),
      ragChunks: fakeMessages(3, 150),
    },
    LIMITS,
  );
  console.log(`Total tokens: ${result.totalTokens}`);
  console.log(`History truncados: ${result.trimmed.history}`);
  console.log(`Chunks truncados: ${result.trimmed.ragChunks}`);
  console.log("");
}

function caseHistoryInflated(): void {
  console.log("--- Caso 2: historial inflado (40 mensajes largos) ---");
  const result = enforceContextBudget(
    {
      systemPrompt: "Eres el asistente de TiendaPro.",
      history: fakeMessages(40, 200),
      ragChunks: [],
    },
    LIMITS,
  );
  console.log(`Total tokens: ${result.totalTokens}`);
  console.log(
    `History conservados: ${result.history.length} (truncados ${result.trimmed.history})`,
  );
  console.log(`Primer mensaje conservado: "${result.history[0]?.slice(0, 40)}..."`);
  console.log(`Último mensaje conservado: "${result.history.at(-1)?.slice(0, 40)}..."`);
  console.log("");
}

function casePathological(): void {
  console.log("--- Caso 3: system prompt excedido ---");
  try {
    enforceContextBudget(
      {
        systemPrompt: "x".repeat(20000), // ~5K tokens, excede el budget de 1500
        history: [],
        ragChunks: [],
      },
      LIMITS,
    );
  } catch (error) {
    if (error instanceof ContextBudgetExceeded) {
      console.log(`✓ Atrapado: ${error.message}`);
    } else {
      throw error;
    }
  }
  console.log("");
}

function main(): void {
  caseNormal();
  caseHistoryInflated();
  casePathological();
}

main();
