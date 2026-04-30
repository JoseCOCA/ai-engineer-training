/**
 * Pipeline RAG: retrieve + augment + generate.
 *
 * Las tres etapas viven separadas para que cada demo de la sesión pueda
 * inspeccionar etapas intermedias (chunks recuperados, prompt rendido)
 * sin tener que reimplementar la pipeline.
 */
import type pg from "pg";
import { chat, type ChatResponse } from "@curso-ai/llm";
import { vectorToSql } from "./db.js";
import { EMBEDDING_MODEL, EMBEDDING_VERSION, embedQuery } from "./embed.js";

export interface RetrievedChunk {
  id: string;
  name: string;
  category: string;
  description: string;
  similarity: number;
}

export interface RetrieveOptions {
  k?: number;
  threshold?: number;
}

export const DEFAULT_K = 3;
export const DEFAULT_THRESHOLD = 0.55;

export async function retrieve(
  pool: pg.Pool,
  query: string,
  opts: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  const k = opts.k ?? DEFAULT_K;
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;

  const qVec = await embedQuery(query);
  const qSql = vectorToSql(qVec);

  const res = await pool.query<{
    id: string;
    name: string;
    category: string;
    description: string;
    similarity: string;
  }>(
    `SELECT id, name, category, description,
            (embedding <#> $1::vector) * -1 AS similarity
       FROM products
      WHERE embedding_model = $2 AND embedding_version = $3
      ORDER BY embedding <#> $1::vector
      LIMIT $4`,
    [qSql, EMBEDDING_MODEL, EMBEDDING_VERSION, k],
  );

  return res.rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      description: r.description,
      similarity: Number(r.similarity),
    }))
    .filter((r) => r.similarity >= threshold);
}

/**
 * System prompt de RAG. Las tres líneas finales son las que más reducen
 * alucinación en producción (ver README §4.4).
 */
export const RAG_SYSTEM_PROMPT = [
  "Eres un asistente del e-commerce TiendaPro.",
  "Respondes ÚNICAMENTE con la información del contexto proporcionado más abajo.",
  "Si el contexto no contiene la respuesta, responde literalmente: \"No tengo información sobre eso en el catálogo de TiendaPro\".",
  "No inventes precios, características, stock ni productos que no estén explícitamente en el contexto.",
  "Cuando uses información del contexto, cita el id del producto entre paréntesis (ej. TP-MOCH-01).",
].join("\n");

export function formatContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "(sin resultados relevantes)";
  return chunks
    .map(
      (c, i) =>
        `[${i + 1}] ${c.id} — ${c.name}\n    ${c.description} Categoría: ${c.category}.`,
    )
    .join("\n");
}

export function buildUserPrompt(query: string, chunks: RetrievedChunk[]): string {
  return [
    "Contexto recuperado:",
    "---",
    formatContext(chunks),
    "---",
    "",
    `Pregunta del usuario: ${query}`,
  ].join("\n");
}

export interface RagRunResult {
  query: string;
  chunks: RetrievedChunk[];
  systemPrompt: string;
  userPrompt: string;
  response: ChatResponse;
}

export async function runRag(
  pool: pg.Pool,
  query: string,
  opts: RetrieveOptions & { temperature?: number; flow?: string } = {},
): Promise<RagRunResult> {
  const chunks = await retrieve(pool, query, opts);
  const userPrompt = buildUserPrompt(query, chunks);

  const response = await chat({
    system: RAG_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    temperature: opts.temperature ?? 0.2,
    flow: opts.flow ?? "m04-s09-rag",
  });

  return { query, chunks, systemPrompt: RAG_SYSTEM_PROMPT, userPrompt, response };
}

export async function runWithoutRag(
  query: string,
  opts: { temperature?: number; flow?: string } = {},
): Promise<ChatResponse> {
  const systemNoRag = [
    "Eres un asistente del e-commerce TiendaPro.",
    "Responde la pregunta del usuario de la mejor manera posible.",
  ].join("\n");

  return chat({
    system: systemNoRag,
    messages: [{ role: "user", content: query }],
    temperature: opts.temperature ?? 0.2,
    flow: opts.flow ?? "m04-s09-no-rag",
  });
}
