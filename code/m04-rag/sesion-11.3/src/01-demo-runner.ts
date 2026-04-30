/**
 * Demo standalone — patrón de un eval runner sobre prompts directos.
 *
 * Versión simplificada del runner que vive en el integrador
 * (`code/proyecto-integrador/evals/run-evals.ts`). Acá no hay pipeline
 * RAG ni pgvector — solo un LLM directo respondiendo. Sirve para entender
 * el patrón "read eval set → run → assert → report" sin la complejidad
 * del sistema completo.
 *
 * Asserts: contains, not_contains, llm_rubric.
 */
import { z } from "zod";
import { generateObject } from "ai";
import { chat, buildModel, PRIMARY_PROVIDER } from "@curso-ai/llm";

interface MiniCase {
  id: string;
  input: string;
  expected: {
    contains?: string[];
    not_contains?: string[];
    rubric?: string;
  };
}

const EVAL_SET: MiniCase[] = [
  {
    id: "math_basic",
    input: "¿Cuánto es 12 × 8?",
    expected: {
      contains: ["96"],
    },
  },
  {
    id: "code_no_lang_lock",
    input: "Dame un ejemplo de función que sume dos números (una sola línea de código).",
    expected: {
      not_contains: ["void"],
      rubric: "La respuesta incluye una sola línea de código que define una función para sumar dos números.",
    },
  },
  {
    id: "tone_concise",
    input: "Resume en una sola oración qué es un LLM.",
    expected: {
      rubric: "La respuesta es una sola oración (no más de un punto y aparte) que explica brevemente qué es un Large Language Model.",
    },
  },
];

const RubricSchema = z.object({
  satisfies: z.boolean(),
  reasoning: z.string(),
});

async function judgeRubric(rubric: string, answer: string): Promise<{ ok: boolean; reasoning: string }> {
  const { model } = buildModel(PRIMARY_PROVIDER);
  const { object } = await generateObject({
    model,
    schema: RubricSchema,
    system: "Eres un evaluador objetivo. Evalúa si la respuesta cumple el criterio.",
    prompt: `Criterio: ${rubric}\n\nRespuesta: ${answer}`,
    temperature: 0,
  });
  return { ok: object.satisfies, reasoning: object.reasoning };
}

interface AssertOut {
  type: string;
  passed: boolean;
  detail?: string;
}

async function runCase(c: MiniCase): Promise<{ id: string; passed: boolean; answer: string; asserts: AssertOut[] }> {
  const response = await chat({
    system: "Eres un asistente conciso y útil.",
    messages: [{ role: "user", content: c.input }],
    temperature: 0.2,
    maxOutputTokens: 200,
    flow: `m04-s11.3-demo-${c.id}`,
  });

  const asserts: AssertOut[] = [];

  if (c.expected.contains) {
    const missing = c.expected.contains.filter((s) => !response.text.includes(s));
    asserts.push({
      type: "contains",
      passed: missing.length === 0,
      detail: missing.length > 0 ? `falta: [${missing.join(", ")}]` : undefined,
    });
  }

  if (c.expected.not_contains) {
    const violations = c.expected.not_contains.filter((s) =>
      response.text.toLowerCase().includes(s.toLowerCase()),
    );
    asserts.push({
      type: "not_contains",
      passed: violations.length === 0,
      detail: violations.length > 0 ? `prohibido encontrado: [${violations.join(", ")}]` : undefined,
    });
  }

  if (c.expected.rubric) {
    const judge = await judgeRubric(c.expected.rubric, response.text);
    asserts.push({
      type: "llm_rubric",
      passed: judge.ok,
      detail: judge.reasoning,
    });
  }

  return {
    id: c.id,
    answer: response.text,
    passed: asserts.every((a) => a.passed),
    asserts,
  };
}

async function main(): Promise<void> {
  console.log(`Eval set mini: ${EVAL_SET.length} casos.\n`);
  let passed = 0;
  for (const c of EVAL_SET) {
    process.stdout.write(`[${c.id}] ${c.input.slice(0, 50)}... `);
    const r = await runCase(c);
    if (r.passed) {
      passed += 1;
      console.log("✓");
    } else {
      console.log("✗");
      console.log(`    answer: "${r.answer.replace(/\n/g, " ").slice(0, 120)}..."`);
      for (const a of r.asserts) {
        if (!a.passed) {
          console.log(`    ✗ ${a.type}: ${a.detail ?? "(sin detalle)"}`);
        }
      }
    }
  }
  const rate = passed / EVAL_SET.length;
  console.log(`\nResultado: ${passed}/${EVAL_SET.length} (${(rate * 100).toFixed(0)}%)`);
  console.log("\nLectura sugerida:");
  console.log("  - El patrón es siempre el mismo: read eval set → run → apply asserts → report.");
  console.log("  - El runner del integrador (`code/proyecto-integrador/evals/run-evals.ts`) extiende esto al pipeline RAG completo.");
  console.log("  - LLM rubric es caro y lento. Úsalo donde aporta. Asserts deterministas (contains, not_contains) son el primer filtro.");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
