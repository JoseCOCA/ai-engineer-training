/**
 * LLM-as-reranker en modo listwise.
 *
 * Una sola llamada al LLM con la query y los N candidatos. Devuelve un
 * orden de IDs. Más eficiente y de mejor calidad que pointwise (N llamadas)
 * en la mayoría de los casos hasta context window razonable.
 */
import { z } from "zod";
import { generateObject } from "ai";
import { buildModel, PRIMARY_PROVIDER } from "@curso-ai/llm";

export interface RerankerInput {
  id: string;
  text: string;
}

const RankingSchema = z.object({
  ranking: z.array(z.string()),
});

const RERANKER_SYSTEM = [
  "Eres un reranker de documentos para un sistema de búsqueda en un catálogo de productos de outdoor.",
  "Recibes una pregunta del usuario y un conjunto de documentos candidatos.",
  "Tu tarea es devolver el orden de los IDs de los documentos por relevancia descendente respecto a la pregunta.",
  "Considera relevancia funcional (¿el producto resuelve la necesidad del usuario?), NO solo similitud léxica.",
  "Devuelve TODOS los IDs recibidos, sin omitir ninguno y sin agregar ninguno.",
].join("\n");

function formatCandidates(items: RerankerInput[]): string {
  return items.map((it) => `- ${it.id}: ${it.text}`).join("\n");
}

export async function listwiseRerank(
  query: string,
  candidates: RerankerInput[],
): Promise<string[]> {
  if (candidates.length === 0) return [];

  const { model } = buildModel(PRIMARY_PROVIDER);
  const { object } = await generateObject({
    model,
    schema: RankingSchema,
    system: RERANKER_SYSTEM,
    prompt: [
      `Pregunta del usuario: "${query}"`,
      "",
      "Documentos candidatos:",
      formatCandidates(candidates),
      "",
      "Devuelve el ranking ordenado de los IDs.",
    ].join("\n"),
    temperature: 0,
  });

  const validIds = new Set(candidates.map((c) => c.id));
  const filtered = object.ranking.filter((id) => validIds.has(id));

  for (const c of candidates) {
    if (!filtered.includes(c.id)) filtered.push(c.id);
  }

  return filtered;
}
