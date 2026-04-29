/**
 * Regression tests sobre el eval set.
 *
 * Para cada caso ejecuta classifyIntent y verifica el assert.
 *
 * NOTA: este test hace llamadas reales al LLM y consume tokens.
 * En CI, considera si quieres correrlo en cada PR (caro) o solo en
 * cron diario / al cambiar prompts.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { classifyIntent } from "../src/lib/intent.js";

interface EvalCase {
  id: string;
  input: string;
  type: "intent";
  assert: { intent: string; minConfidence?: number };
}

const EVAL_PATH = fileURLToPath(
  new URL("../prompts/eval-set.json", import.meta.url),
);

const evalSet = JSON.parse(readFileSync(EVAL_PATH, "utf8")) as EvalCase[];
const intentCases = evalSet.filter((c) => c.type === "intent");

describe("intent-classifier — eval set", () => {
  for (const c of intentCases) {
    test(c.id, async () => {
      const result = await classifyIntent(c.input);
      expect(result.intent).toBe(c.assert.intent);
      if (c.assert.minConfidence !== undefined) {
        expect(result.confidence).toBeGreaterThanOrEqual(c.assert.minConfidence);
      }
    });
  }
});
