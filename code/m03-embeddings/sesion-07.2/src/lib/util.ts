/**
 * Utilities compartidas por los demos de S07.2.
 */
export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
}

export function productAsDoc(p: Product): string {
  return `${p.name}. ${p.description} Categoría: ${p.category}.`;
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Dimensiones distintas: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function topK<T>(
  items: T[],
  scoreFn: (item: T) => number,
  k: number,
): Array<{ item: T; score: number }> {
  return items
    .map((item) => ({ item, score: scoreFn(item) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
