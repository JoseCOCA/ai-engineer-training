/**
 * Reciprocal Rank Fusion (Cormack et al., 2009).
 *
 * Fusiona N rankings en uno solo. Ignora los scores absolutos: solo
 * importa el rank de cada documento en cada lista. Sin hiperparámetros
 * que calibrar (k es robusto en ~60).
 *
 *     RRF_score(d) = Σ_i 1 / (k + rank_i(d))
 */

export interface RrfResult {
  id: string;
  score: number;
}

export function rrf(rankings: string[][], k = 60): RrfResult[] {
  const scores = new Map<string, number>();

  for (const ranking of rankings) {
    ranking.forEach((id, idx) => {
      const rank = idx + 1;
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
    });
  }

  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
