/**
 * Budget de tokens explícito para el contexto de un prompt.
 *
 * Cada parte tiene un techo. Si una parte excede su budget, la
 * truncamos al INICIO (preservando lo más reciente — útil sobre
 * todo para historial conversacional).
 *
 * Si la suma total supera el hardCeiling, fallamos explícito.
 * Acá decides: resumir partes viejas, pedir nueva conversación,
 * o subir el modelo.
 */
import { encode } from "gpt-tokenizer";

export interface BudgetParts {
  systemPrompt: string;
  history: string[]; // messages serializados
  ragChunks: string[]; // chunks de contexto inyectado
}

export interface BudgetLimits {
  systemPrompt: number;
  history: number;
  ragChunks: number;
  reservedForResponse: number;
  hardCeiling: number;
}

export interface BudgetResult {
  systemPrompt: string;
  history: string[];
  ragChunks: string[];
  trimmed: { history: number; ragChunks: number };
  totalTokens: number;
}

export class ContextBudgetExceeded extends Error {
  constructor(public readonly totalTokens: number, public readonly ceiling: number) {
    super(
      `Context budget exceeded: ${totalTokens} tokens > ${ceiling} ceiling. Resume historial viejo o reduce ragChunks.`,
    );
    this.name = "ContextBudgetExceeded";
  }
}

function countTokens(text: string): number {
  return encode(text).length;
}

function trimFromStart(items: string[], maxTokens: number): { kept: string[]; trimmed: number } {
  // Conservamos los más recientes (al final del array) hasta llenar el budget.
  const reversed = [...items].reverse();
  const kept: string[] = [];
  let used = 0;
  let trimmed = 0;

  for (const item of reversed) {
    const tokens = countTokens(item);
    if (used + tokens <= maxTokens) {
      kept.unshift(item);
      used += tokens;
    } else {
      trimmed += 1;
    }
  }

  return { kept, trimmed };
}

export function enforceContextBudget(
  parts: BudgetParts,
  limits: BudgetLimits,
): BudgetResult {
  // 1. System prompt: NO se trunca. Si no entra, fallas explícito.
  const systemTokens = countTokens(parts.systemPrompt);
  if (systemTokens > limits.systemPrompt) {
    throw new ContextBudgetExceeded(systemTokens, limits.systemPrompt);
  }

  // 2. History: trunca conservando lo más reciente.
  const trimmedHistory = trimFromStart(parts.history, limits.history);
  const historyTokens = trimmedHistory.kept.reduce(
    (s, m) => s + countTokens(m),
    0,
  );

  // 3. RAG chunks: trunca conservando los primeros (asumimos que están ordenados por relevancia).
  const ragKept: string[] = [];
  let ragTrimmed = 0;
  let ragUsed = 0;
  for (const chunk of parts.ragChunks) {
    const t = countTokens(chunk);
    if (ragUsed + t <= limits.ragChunks) {
      ragKept.push(chunk);
      ragUsed += t;
    } else {
      ragTrimmed += 1;
    }
  }

  const total = systemTokens + historyTokens + ragUsed + limits.reservedForResponse;
  if (total > limits.hardCeiling) {
    throw new ContextBudgetExceeded(total, limits.hardCeiling);
  }

  return {
    systemPrompt: parts.systemPrompt,
    history: trimmedHistory.kept,
    ragChunks: ragKept,
    trimmed: { history: trimmedHistory.trimmed, ragChunks: ragTrimmed },
    totalTokens: total,
  };
}
