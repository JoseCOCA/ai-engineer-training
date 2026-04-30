/**
 * Runner Promptfoo-like sobre el pipeline RAG del integrador (Ring 2).
 *
 * Lee evals/eval-set.json, ejecuta el pipeline por cada caso y aplica
 * los asserts declarados. Imprime un reporte agregado y sale con código
 * 1 si menos del THRESHOLD pasan (para integrar en CI).
 *
 * Asserts soportados:
 *   - must_cite_any_of: alguna de las citas debe ser uno de los IDs.
 *   - must_say_no_information: la respuesta dice "no tengo información".
 *   - must_not_cite_anything: la respuesta no cita ningún producto.
 *   - must_not_contain: la respuesta NO contiene ninguna de estas frases.
 *   - must_match_rubric: LLM judge evalúa si el criterio se cumple.
 *
 * No usamos la CLI de Promptfoo porque la suite evalúa un pipeline
 * compuesto (retrieve + rerank + generate), no un prompt directo. El
 * patrón conceptual es el mismo: read eval set → run → assert → report.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { generateObject } from "ai";
import { buildModel, PRIMARY_PROVIDER } from "@curso-ai/llm";
import { PgVectorStore } from "../src/retrieval/index.js";
import {
  embedQuery,
  runRagPipeline,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
} from "../src/rag/index.js";

interface EvalCase {
  id: string;
  type: "catalog" | "out_of_distribution" | "adversarial";
  input: string;
  expected: {
    must_cite_any_of?: string[];
    must_say_no_information?: boolean;
    must_not_cite_anything?: boolean;
    must_not_contain?: string[];
    must_match_rubric?: string;
  };
}

interface AssertResult {
  type: string;
  passed: boolean;
  detail?: string;
}

interface CaseReport {
  id: string;
  type: string;
  input: string;
  passed: boolean;
  retrieved: string[];
  citations: string[];
  answer: string;
  asserts: AssertResult[];
}

const EVAL_PATH = fileURLToPath(new URL("./eval-set.json", import.meta.url));
const PASS_THRESHOLD = Number.parseFloat(process.env.EVALS_THRESHOLD ?? "0.8");

const RubricSchema = z.object({
  satisfies: z.boolean(),
  reasoning: z.string(),
});

async function judgeRubric(
  rubric: string,
  answer: string,
): Promise<{ ok: boolean; reasoning: string }> {
  const { model } = buildModel(PRIMARY_PROVIDER);
  const { object } = await generateObject({
    model,
    schema: RubricSchema,
    system: [
      "Eres un evaluador objetivo. Dado un criterio y una respuesta, debes determinar si la respuesta satisface el criterio.",
      "Evalúa estrictamente: si el criterio es ambiguo o no se cumple claramente, devuelve satisfies=false.",
    ].join("\n"),
    prompt: [`Criterio: ${rubric}`, "", `Respuesta: ${answer}`].join("\n"),
    temperature: 0,
  });
  return { ok: object.satisfies, reasoning: object.reasoning };
}

const NO_INFO_PATTERNS = [
  /no tengo información/i,
  /no tengo info/i,
  /no encontré información/i,
  /no consta/i,
];

function saysNoInformation(text: string): boolean {
  return NO_INFO_PATTERNS.some((p) => p.test(text));
}

async function evaluateCase(
  store: PgVectorStore,
  c: EvalCase,
): Promise<CaseReport> {
  const result = await runRagPipeline(store, c.input);
  const asserts: AssertResult[] = [];

  if (c.expected.must_cite_any_of) {
    const citedIds = result.citations.map((x) => x.source_id);
    const hit = c.expected.must_cite_any_of.some((id) => citedIds.includes(id));
    asserts.push({
      type: "must_cite_any_of",
      passed: hit,
      detail: `esperado uno de [${c.expected.must_cite_any_of.join(", ")}], citados [${citedIds.join(", ")}]`,
    });
  }

  if (c.expected.must_say_no_information) {
    asserts.push({
      type: "must_say_no_information",
      passed: saysNoInformation(result.answer),
    });
  }

  if (c.expected.must_not_cite_anything) {
    asserts.push({
      type: "must_not_cite_anything",
      passed: result.citations.length === 0,
      detail: `citas: [${result.citations.map((x) => x.source_id).join(", ")}]`,
    });
  }

  if (c.expected.must_not_contain) {
    const violations = c.expected.must_not_contain.filter((phrase) =>
      result.answer.toLowerCase().includes(phrase.toLowerCase()),
    );
    asserts.push({
      type: "must_not_contain",
      passed: violations.length === 0,
      detail: violations.length > 0 ? `violaciones: [${violations.join(", ")}]` : undefined,
    });
  }

  if (c.expected.must_match_rubric) {
    const judge = await judgeRubric(c.expected.must_match_rubric, result.answer);
    asserts.push({
      type: "must_match_rubric",
      passed: judge.ok,
      detail: judge.reasoning,
    });
  }

  if (!result.validation.ok) {
    asserts.push({
      type: "internal_citation_validation",
      passed: false,
      detail: `IDs inválidos en citas: [${result.validation.invalidCitations.join(", ")}]`,
    });
  }

  return {
    id: c.id,
    type: c.type,
    input: c.input,
    passed: asserts.every((a) => a.passed),
    retrieved: result.chunks.map((x) => x.id),
    citations: result.citations.map((x) => x.source_id),
    answer: result.answer,
    asserts,
  };
}

async function main(): Promise<void> {
  const evalSet: EvalCase[] = JSON.parse(readFileSync(EVAL_PATH, "utf8"));
  console.log(`Cargados ${evalSet.length} casos del eval set.\n`);

  const store = new PgVectorStore({
    embedder: embedQuery,
    embeddingModel: EMBEDDING_MODEL,
    embeddingVersion: EMBEDDING_VERSION,
  });

  const reports: CaseReport[] = [];
  try {
    for (const c of evalSet) {
      process.stdout.write(`[${c.id}] (${c.type})... `);
      try {
        const report = await evaluateCase(store, c);
        reports.push(report);
        console.log(report.passed ? "✓" : "✗");
        if (!report.passed) {
          for (const a of report.asserts) {
            if (!a.passed) {
              console.log(`    ✗ ${a.type}: ${a.detail ?? "(sin detalle)"}`);
            }
          }
        }
      } catch (err) {
        console.log(`error: ${(err as Error).message}`);
        reports.push({
          id: c.id,
          type: c.type,
          input: c.input,
          passed: false,
          retrieved: [],
          citations: [],
          answer: "",
          asserts: [
            {
              type: "internal_error",
              passed: false,
              detail: (err as Error).message,
            },
          ],
        });
      }
    }
  } finally {
    await store.close();
  }

  const passed = reports.filter((r) => r.passed).length;
  const total = reports.length;
  const passRate = total > 0 ? passed / total : 0;

  console.log("\n=== Reporte agregado ===");
  console.log(`Casos: ${passed}/${total} (${(passRate * 100).toFixed(1)}%)`);

  const byType = new Map<string, { passed: number; total: number }>();
  for (const r of reports) {
    const acc = byType.get(r.type) ?? { passed: 0, total: 0 };
    acc.total += 1;
    if (r.passed) acc.passed += 1;
    byType.set(r.type, acc);
  }
  for (const [type, acc] of byType) {
    console.log(`  ${type}: ${acc.passed}/${acc.total} (${((acc.passed / acc.total) * 100).toFixed(0)}%)`);
  }

  console.log(`\nThreshold: ${(PASS_THRESHOLD * 100).toFixed(0)}%`);

  if (passRate < PASS_THRESHOLD) {
    console.log("✗ Pass rate por debajo del threshold. Falla.");
    process.exit(1);
  }
  console.log("✓ Pass rate >= threshold. OK.");
}

main().catch((err: unknown) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
