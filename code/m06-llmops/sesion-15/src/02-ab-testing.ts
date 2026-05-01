/**
 * Demo 2 — A/B testing de prompts.
 *
 * Dos variantes de prompt para responder consultas. Cada userId se
 * asigna deterministicamente a una variante (hash → bucket).
 * El demo corre 6 queries y compara métricas entre variantes.
 */
import { createHash } from "node:crypto";
import { generateText } from "ai";
import { buildModel, PRIMARY_PROVIDER } from "@curso-ai/llm";

const PROMPTS = {
  control: "Eres el asistente de TiendaPro, un e-commerce de productos de outdoor. Sé conciso.",
  variant: [
    "Eres el asistente de TiendaPro, un e-commerce de productos de outdoor.",
    "Responde en máximo 3 oraciones.",
    "Tono cercano y servicial.",
    "Cuando recomiendes productos, menciona uno solo y por qué encaja con la consulta.",
  ].join("\n"),
};

type Variant = keyof typeof PROMPTS;

function bucketForUser(userId: string): Variant {
  const hash = createHash("sha256").update(userId).digest("hex");
  const bucket = parseInt(hash.slice(0, 4), 16) % 100;
  return bucket < 50 ? "control" : "variant";
}

interface Run {
  userId: string;
  query: string;
  variant: Variant;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  outputLength: number;
}

const QUERIES: Array<{ userId: string; query: string }> = [
  { userId: "u01", query: "¿qué mochila me recomendas para senderismo de un día?" },
  { userId: "u02", query: "necesito una tienda para 4 personas" },
  { userId: "u03", query: "¿tienen botas impermeables?" },
  { userId: "u04", query: "una chaqueta para la lluvia" },
  { userId: "u05", query: "linterna para acampar" },
  { userId: "u06", query: "bastones de trekking livianos" },
];

async function runOne(userId: string, query: string, variant: Variant): Promise<Run> {
  const { model } = buildModel(PRIMARY_PROVIDER);
  const start = Date.now();
  const result = await generateText({
    model,
    system: PROMPTS[variant],
    messages: [{ role: "user", content: query }],
    temperature: 0.2,
    maxOutputTokens: 250,
  });
  return {
    userId,
    query,
    variant,
    latencyMs: Date.now() - start,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    outputLength: result.text.length,
  };
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

async function main(): Promise<void> {
  console.log(`=== A/B testing de prompts ===\n`);

  const runs: Run[] = [];
  for (const q of QUERIES) {
    for (const variant of ["control", "variant"] as const) {
      const run = await runOne(q.userId, q.query, variant);
      const assigned = bucketForUser(q.userId);
      const marker = assigned === variant ? "←" : " ";
      console.log(
        `[${variant.padEnd(8)}] u=${q.userId} ${marker} latency=${run.latencyMs}ms tokens=${run.outputTokens} len=${run.outputLength}`,
      );
      runs.push(run);
    }
  }

  console.log(`\n=== Comparativa ===`);
  for (const variant of ["control", "variant"] as const) {
    const subset = runs.filter((r) => r.variant === variant);
    console.log(`\n${variant.toUpperCase()}:`);
    console.log(`  latencia avg: ${avg(subset.map((r) => r.latencyMs)).toFixed(0)}ms`);
    console.log(`  output tokens avg: ${avg(subset.map((r) => r.outputTokens)).toFixed(0)}`);
    console.log(`  output length avg: ${avg(subset.map((r) => r.outputLength)).toFixed(0)} chars`);
  }

  const assignments = QUERIES.map((q) => bucketForUser(q.userId));
  const controlCount = assignments.filter((v) => v === "control").length;
  console.log(`\nAsignación bucket: control=${controlCount}/${QUERIES.length}, variant=${QUERIES.length - controlCount}/${QUERIES.length}`);
  console.log("(en producción, cada user solo ve su variante asignada)");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
