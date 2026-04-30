/**
 * Utilidades compartidas por los demos de S07.3.
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

export function dot(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Dimensiones distintas: ${a.length} vs ${b.length}`);
  }
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function norm(v: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

export function normalize(v: number[]): number[] {
  const n = norm(v);
  if (n === 0) return v.slice();
  return v.map((x) => x / n);
}

export function cosine(a: number[], b: number[]): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

export function l2(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Dimensiones distintas: ${a.length} vs ${b.length}`);
  }
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

export function topK<T>(
  items: T[],
  scoreFn: (item: T) => number,
  k: number,
  ascending = false,
): Array<{ item: T; score: number }> {
  const ranked = items
    .map((item) => ({ item, score: scoreFn(item) }))
    .sort((a, b) => (ascending ? a.score - b.score : b.score - a.score));
  return ranked.slice(0, k);
}

/**
 * Histograma ASCII en consola. Devuelve una string para imprimir.
 *
 * - `bins` define los bordes de los buckets.
 * - Cada serie se dibuja con un caracter distinto.
 */
export function asciiHistogram(
  series: Array<{ name: string; values: number[]; char: string }>,
  bins: number[],
  width = 50,
): string {
  const counts: Record<string, number[]> = {};
  for (const s of series) {
    counts[s.name] = new Array(bins.length - 1).fill(0);
    for (const v of s.values) {
      for (let i = 0; i < bins.length - 1; i++) {
        if (v >= bins[i] && v < bins[i + 1]) {
          counts[s.name][i] += 1;
          break;
        }
      }
    }
  }

  const allMax = Math.max(
    ...series.flatMap((s) => counts[s.name]),
    1,
  );

  const lines: string[] = [];
  for (let i = 0; i < bins.length - 1; i++) {
    const label = bins[i].toFixed(2);
    let row = `  ${label} | `;
    for (const s of series) {
      const n = counts[s.name][i];
      const len = Math.round((n / allMax) * width);
      row += s.char.repeat(len);
    }
    lines.push(row);
  }
  lines.push(`         +${"-".repeat(width + 2)}`);
  return lines.join("\n");
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, x) => s + x, 0) / values.length;
}

export function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  const v = values.reduce((s, x) => s + (x - m) ** 2, 0) / values.length;
  return Math.sqrt(v);
}
