/**
 * Maximum Marginal Relevance (Carbonell & Goldstein, 1998).
 *
 *     MMR(d) = λ · sim(d, query) - (1 - λ) · max_{d' in selected} sim(d, d')
 *
 * Greedy. En cada iteración elige el doc que maximiza relevancia menos
 * redundancia respecto a lo ya elegido. λ=1 → ranking puro; λ=0 →
 * diversidad pura. Sweet spot para asistentes: 0.5–0.7.
 */

export interface MmrCandidate {
  id: string;
  embedding: number[];
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

export function cosine(a: number[], b: number[]): number {
  const denom = norm(a) * norm(b);
  return denom === 0 ? 0 : dot(a, b) / denom;
}

export function mmr(
  query: number[],
  candidates: MmrCandidate[],
  k: number,
  lambda: number,
): string[] {
  const selected: MmrCandidate[] = [];
  const remaining = [...candidates];

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      const simQ = cosine(query, c.embedding);
      const simS =
        selected.length === 0
          ? 0
          : Math.max(...selected.map((s) => cosine(s.embedding, c.embedding)));
      const score = lambda * simQ - (1 - lambda) * simS;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected.map((s) => s.id);
}
