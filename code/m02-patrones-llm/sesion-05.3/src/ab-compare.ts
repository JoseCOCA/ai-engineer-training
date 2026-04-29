/**
 * A/B comparativa entre dos versiones del prompt de intent classifier
 * sobre el eval set de TiendaPro.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { classifyIntent } from "./lib/intent.js";

interface EvalCase {
  id: string;
  input: string;
  type: "intent";
  assert: { intent: string; minConfidence?: number };
}

const EVAL_PATH = fileURLToPath(
  new URL("../prompts/eval-set.json", import.meta.url),
);

function loadEvalSet(): EvalCase[] {
  return JSON.parse(readFileSync(EVAL_PATH, "utf8")) as EvalCase[];
}

interface RunResult {
  id: string;
  input: string;
  predictedIntent: string;
  confidence: number;
  expectedIntent: string;
  passed: boolean;
}

async function runVariant(
  evalSet: EvalCase[],
  promptName: string,
): Promise<RunResult[]> {
  const results: RunResult[] = [];
  for (const c of evalSet) {
    const r = await classifyIntent(c.input, promptName);
    const passed =
      r.intent === c.assert.intent &&
      (c.assert.minConfidence === undefined ||
        r.confidence >= c.assert.minConfidence);
    results.push({
      id: c.id,
      input: c.input,
      predictedIntent: r.intent,
      confidence: r.confidence,
      expectedIntent: c.assert.intent,
      passed,
    });
  }
  return results;
}

function summary(label: string, results: RunResult[]): void {
  const passed = results.filter((r) => r.passed).length;
  console.log(
    `${label} accuracy: ${passed}/${results.length} (${Math.round((passed / results.length) * 100)}%)`,
  );
}

async function main(): Promise<void> {
  const evalSet = loadEvalSet();
  console.log(`Casos en eval set: ${evalSet.length}\n`);

  console.log("Corriendo V1 (intent-classifier.system)...");
  const v1 = await runVariant(evalSet, "intent-classifier.system");

  console.log("Corriendo V2 (intent-classifier.system.v2)...");
  const v2 = await runVariant(evalSet, "intent-classifier.system.v2");

  console.log("");
  summary("V1", v1);
  summary("V2", v2);

  console.log("");
  console.log("Casos donde difieren:");
  let differs = 0;
  for (let i = 0; i < v1.length; i++) {
    if (v1[i].predictedIntent !== v2[i].predictedIntent) {
      differs += 1;
      const c1 = v1[i].passed ? "✓" : "✗";
      const c2 = v2[i].passed ? "✓" : "✗";
      console.log(
        `  ${v1[i].id} (esperado: ${v1[i].expectedIntent})`,
      );
      console.log(`    V1=${c1}${v1[i].predictedIntent} (${v1[i].confidence.toFixed(2)})`);
      console.log(`    V2=${c2}${v2[i].predictedIntent} (${v2[i].confidence.toFixed(2)})`);
    }
  }
  if (differs === 0) {
    console.log("  (ninguno — ambas versiones predicen igual)");
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
