/**
 * RAG pipeline del integrador (M4 — S11.2).
 *
 * Conecta el retriever pgvector (M3) con el asistente conversacional (M2).
 * El flow:
 *   1. retrieve top-K con threshold (descarta queries OOD).
 *   2. listwise rerank con LLM cheap.
 *   3. structured generation con citas obligatorias (zod).
 *   4. validación de citas: cada source_id citado debe estar en el contexto.
 *
 * Si el retrieval devuelve vacío, runRagPipeline retorna chunks=[]. El
 * caller decide qué hacer (responder "no tengo información" o seguir flow
 * normal sin contexto).
 */
import { z } from "zod";
import { generateObject } from "ai";
import { buildModel, PRIMARY_PROVIDER } from "@curso-ai/llm";
import { PgVectorStore, type SearchResult } from "../retrieval/index.js";
import { EMBEDDING_MODEL, EMBEDDING_VERSION, embedQuery } from "./embedder.js";
import { validateCitations, type RagCitation } from "./citations.js";

export type { RagCitation };

export const DEFAULT_RETRIEVE_K = 8;
export const DEFAULT_RERANK_FINAL_K = 3;
export const DEFAULT_THRESHOLD = 0.55;

const RagAnswerSchema = z.object({
  answer: z.string().describe("Respuesta natural al usuario, con IDs de productos entre paréntesis."),
  citations: z
    .array(
      z.object({
        source_id: z.string(),
        claim: z.string(),
      }),
    )
    .describe("Lista de citas explícitas, una por afirmación apoyada en un producto."),
});

const RankingSchema = z.object({
  ranking: z.array(z.string()),
});

const RAG_SYSTEM_PROMPT = [
  "Eres un asistente de TiendaPro, un e-commerce de productos de outdoor.",
  "Respondes ÚNICAMENTE con la información del contexto proporcionado.",
  "Si el contexto no contiene la respuesta, responde con answer='No tengo información sobre eso en el catálogo' y citations=[].",
  "Cuando recomiendes un producto, cita su id entre paréntesis dentro de answer (ej. \"recomendamos la mochila X (TP-MOCH-01)\") Y agrégalo a citations.",
  "Mantén el tono cercano y servicial pero conciso. Máximo 4 oraciones.",
].join("\n");

const RERANKER_SYSTEM = [
  "Eres un reranker de productos para una búsqueda en el catálogo de TiendaPro.",
  "Recibes una pregunta del usuario y un conjunto de productos candidatos.",
  "Devuelve los IDs ordenados por relevancia funcional descendente respecto a la pregunta.",
  "Considera intent (qué problema quiere resolver el usuario), no solo similitud léxica.",
  "Devuelve TODOS los IDs recibidos, sin omitir ni inventar.",
].join("\n");

export interface RagPipelineOptions {
  k?: number;
  rerankFinalK?: number;
  threshold?: number;
  rerank?: boolean;
}

export interface RagPipelineResult {
  answer: string;
  citations: RagCitation[];
  chunks: SearchResult[];
  validation: { ok: boolean; invalidCitations: string[] };
  metrics: {
    retrieveMs: number;
    rerankMs: number;
    generateMs: number;
    totalMs: number;
  };
}

function formatContext(items: SearchResult[]): string {
  if (items.length === 0) return "(sin resultados relevantes)";
  return items
    .map((p, i) => `[${i + 1}] ${p.id} — ${p.name} (categoría: ${p.category})`)
    .join("\n");
}

async function listwiseRerank(query: string, items: SearchResult[]): Promise<string[]> {
  if (items.length <= 1) return items.map((c) => c.id);

  const { model } = buildModel(PRIMARY_PROVIDER);
  const candidatesText = items
    .map((c) => `- ${c.id}: ${c.name} (${c.category})`)
    .join("\n");

  const { object } = await generateObject({
    model,
    schema: RankingSchema,
    system: RERANKER_SYSTEM,
    prompt: [
      `Pregunta del usuario: "${query}"`,
      "",
      "Productos candidatos:",
      candidatesText,
      "",
      "Devuelve el ranking ordenado de los IDs.",
    ].join("\n"),
    temperature: 0,
  });

  const validIds = new Set(items.map((c) => c.id));
  const filtered = object.ranking.filter((id) => validIds.has(id));
  for (const c of items) {
    if (!filtered.includes(c.id)) filtered.push(c.id);
  }
  return filtered;
}

export async function runRagPipeline(
  store: PgVectorStore,
  query: string,
  opts: RagPipelineOptions = {},
): Promise<RagPipelineResult> {
  const k = opts.k ?? DEFAULT_RETRIEVE_K;
  const finalK = opts.rerankFinalK ?? DEFAULT_RERANK_FINAL_K;
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const doRerank = opts.rerank ?? true;

  const t0 = Date.now();
  const candidates = await store.searchProducts({ query, k, threshold });
  const tRetrieve = Date.now();

  if (candidates.length === 0) {
    return {
      answer: "No tengo información sobre eso en el catálogo de TiendaPro.",
      citations: [],
      chunks: [],
      validation: { ok: true, invalidCitations: [] },
      metrics: {
        retrieveMs: tRetrieve - t0,
        rerankMs: 0,
        generateMs: 0,
        totalMs: tRetrieve - t0,
      },
    };
  }

  let ordered: SearchResult[];
  let tRerank = tRetrieve;
  if (doRerank && candidates.length > 1) {
    const rankedIds = await listwiseRerank(query, candidates);
    const byId = new Map(candidates.map((c) => [c.id, c]));
    ordered = rankedIds.map((id) => byId.get(id)).filter((x): x is SearchResult => Boolean(x));
    tRerank = Date.now();
  } else {
    ordered = [...candidates];
  }

  const top = ordered.slice(0, finalK);

  const { model } = buildModel(PRIMARY_PROVIDER);
  const { object } = await generateObject({
    model,
    schema: RagAnswerSchema,
    system: RAG_SYSTEM_PROMPT,
    prompt: [
      "Contexto recuperado:",
      "---",
      formatContext(top),
      "---",
      "",
      `Pregunta del usuario: ${query}`,
    ].join("\n"),
    temperature: 0.2,
  });
  const tGenerate = Date.now();

  const validation = validateCitations(object.citations, top.map((c) => c.id));

  return {
    answer: object.answer,
    citations: object.citations,
    chunks: top,
    validation,
    metrics: {
      retrieveMs: tRetrieve - t0,
      rerankMs: tRerank - tRetrieve,
      generateMs: tGenerate - tRerank,
      totalMs: tGenerate - t0,
    },
  };
}

export { EMBEDDING_MODEL, EMBEDDING_VERSION, embedQuery };
