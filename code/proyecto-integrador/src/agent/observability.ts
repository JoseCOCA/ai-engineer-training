/**
 * Observabilidad del agente con Langfuse (M6).
 *
 * Si LANGFUSE_PUBLIC_KEY/LANGFUSE_SECRET_KEY están configuradas, los
 * eventos se envían al dashboard. Si no, las funciones son no-ops:
 * el integrador funciona idéntico sin observabilidad externa.
 */
import { Langfuse } from "langfuse";

type LangfuseLevel = "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";

export interface ObservabilitySpan {
  end(opts?: { output?: unknown; level?: LangfuseLevel; statusMessage?: string }): void;
}

export interface ObservabilityTrace {
  span(opts: { name: string; input?: unknown }): ObservabilitySpan;
  update(opts: { output?: unknown; level?: LangfuseLevel }): void;
  score(opts: { name: string; value: number; comment?: string }): void;
}

let cachedClient: Langfuse | null | undefined;

function getClient(): Langfuse | null {
  if (cachedClient !== undefined) return cachedClient;
  const pk = process.env.LANGFUSE_PUBLIC_KEY;
  const sk = process.env.LANGFUSE_SECRET_KEY;
  if (!pk || !sk) {
    cachedClient = null;
    return null;
  }
  cachedClient = new Langfuse({
    publicKey: pk,
    secretKey: sk,
    baseUrl: process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com",
  });
  return cachedClient;
}

const NOOP_SPAN: ObservabilitySpan = {
  end: () => undefined,
};

const NOOP_TRACE: ObservabilityTrace = {
  span: () => NOOP_SPAN,
  update: () => undefined,
  score: () => undefined,
};

export interface TraceOptions {
  name: string;
  input?: unknown;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export function startTrace(opts: TraceOptions): ObservabilityTrace {
  const client = getClient();
  if (!client) return NOOP_TRACE;
  const trace = client.trace({
    name: opts.name,
    input: opts.input,
    userId: opts.userId,
    sessionId: opts.sessionId,
    metadata: opts.metadata,
  });
  return {
    span: (spanOpts) => {
      const span = trace.span({ name: spanOpts.name, input: spanOpts.input });
      return {
        end: (endOpts) => {
          span.end({
            output: endOpts?.output,
            level: endOpts?.level,
            statusMessage: endOpts?.statusMessage,
          });
        },
      };
    },
    update: (updateOpts) => trace.update({ output: updateOpts.output }),
    score: (scoreOpts) =>
      trace.score({ name: scoreOpts.name, value: scoreOpts.value, comment: scoreOpts.comment }),
  };
}

export async function flushObservability(): Promise<void> {
  const client = getClient();
  if (client) await client.flushAsync();
}
