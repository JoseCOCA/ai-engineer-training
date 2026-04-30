/**
 * Validación de citas: cada source_id citado debe estar en el contexto.
 *
 * Es el chequeo de Nivel 1 contra alucinación: detecta cuando el LLM
 * inventó un id que no existe entre los chunks recuperados.
 */
export interface RagCitation {
  source_id: string;
  claim: string;
}

export interface CitationValidation {
  ok: boolean;
  invalidCitations: string[];
}

export function validateCitations(
  citations: RagCitation[],
  contextIds: string[],
): CitationValidation {
  const valid = new Set(contextIds);
  const invalid = citations
    .map((c) => c.source_id)
    .filter((id) => !valid.has(id));
  return { ok: invalid.length === 0, invalidCitations: invalid };
}
