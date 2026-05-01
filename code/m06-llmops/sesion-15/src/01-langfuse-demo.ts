/**
 * Demo 1 — Langfuse: trace + spans + generation + score.
 *
 * Si LANGFUSE_PUBLIC_KEY/LANGFUSE_SECRET_KEY están en .env, los eventos
 * se envían al dashboard. Si no, se imprime la estructura local para
 * que veas el formato.
 */
import { generateText } from "ai";
import { Langfuse } from "langfuse";
import { buildModel, PRIMARY_PROVIDER } from "@curso-ai/llm";

interface LangfuseLite {
  trace(opts: Record<string, unknown>): TraceLite;
  flushAsync?(): Promise<void>;
}
interface TraceLite {
  span(opts: Record<string, unknown>): SpanLite;
  generation(opts: Record<string, unknown>): GenerationLite;
  score(opts: Record<string, unknown>): void;
  update(opts: Record<string, unknown>): void;
}
interface SpanLite {
  end(opts: Record<string, unknown>): void;
}
interface GenerationLite {
  end(opts: Record<string, unknown>): void;
}

function makeLangfuseClient(): LangfuseLite {
  const pk = process.env.LANGFUSE_PUBLIC_KEY;
  const sk = process.env.LANGFUSE_SECRET_KEY;
  if (!pk || !sk) {
    console.log("⚠ LANGFUSE_PUBLIC_KEY/SECRET no configuradas — usando stub local.\n");
    return makeStubClient();
  }
  return new Langfuse({
    publicKey: pk,
    secretKey: sk,
    baseUrl: process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com",
  }) as unknown as LangfuseLite;
}

function makeStubClient(): LangfuseLite {
  let traceCount = 0;
  return {
    trace(opts) {
      const id = `trace-${++traceCount}`;
      console.log(`[stub trace ${id}]`, JSON.stringify(opts, null, 2));
      let spanCount = 0;
      return {
        span(spanOpts) {
          const sid = `${id}-span-${++spanCount}`;
          console.log(`  [stub span ${sid}]`, JSON.stringify(spanOpts, null, 2));
          return {
            end(endOpts) {
              console.log(`  [stub span ${sid} end]`, JSON.stringify(endOpts, null, 2));
            },
          };
        },
        generation(genOpts) {
          const gid = `${id}-gen-${++spanCount}`;
          console.log(`  [stub generation ${gid}]`, JSON.stringify(genOpts, null, 2));
          return {
            end(endOpts) {
              console.log(`  [stub generation ${gid} end]`, JSON.stringify(endOpts, null, 2));
            },
          };
        },
        score(scoreOpts) {
          console.log(`  [stub score ${id}]`, JSON.stringify(scoreOpts, null, 2));
        },
        update(updateOpts) {
          console.log(`  [stub trace ${id} update]`, JSON.stringify(updateOpts, null, 2));
        },
      };
    },
  };
}

async function classify(query: string): Promise<string> {
  return query.toLowerCase().includes("mochila") ? "catalog" : "general";
}

async function main(): Promise<void> {
  const langfuse = makeLangfuseClient();

  const userId = "user-42";
  const sessionId = `session-${Date.now()}`;
  const query = "¿tienen mochilas?";

  const trace = langfuse.trace({
    name: "agent.invoke",
    userId,
    sessionId,
    input: { query },
    metadata: { module: "M6", version: "demo-15" },
  });

  const classifySpan = trace.span({ name: "classify", input: { query } });
  const intent = await classify(query);
  classifySpan.end({ output: { intent } });

  const { model, modelId, provider } = buildModel(PRIMARY_PROVIDER);
  const generation = trace.generation({
    name: "answer",
    model: modelId,
    modelParameters: { temperature: 0.2 },
    input: [{ role: "user", content: query }],
  });
  const result = await generateText({
    model,
    messages: [{ role: "user", content: query }],
    temperature: 0.2,
  });
  generation.end({
    output: result.text,
    usage: {
      input: result.usage.inputTokens ?? 0,
      output: result.usage.outputTokens ?? 0,
      total: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
    },
  });

  trace.update({ output: result.text });

  trace.score({ name: "thumbs_up", value: 1 });
  trace.score({ name: "faithfulness", value: 0.9, comment: "auto-judge stub" });

  console.log(`\nProvider: ${provider} (${modelId})`);
  console.log(`Query: ${query}`);
  console.log(`Intent: ${intent}`);
  console.log(`Respuesta: ${result.text.slice(0, 150)}...`);

  if (typeof langfuse.flushAsync === "function") {
    await langfuse.flushAsync();
    console.log("\n✓ Eventos enviados a Langfuse.");
  } else {
    console.log("\n(stub local — sin envío a Langfuse)");
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
