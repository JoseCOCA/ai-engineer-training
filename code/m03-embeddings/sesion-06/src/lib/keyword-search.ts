/**
 * Filtro keyword equivalente al de S05.1 (proyecto integrador).
 *
 * Aquí lo tenemos para comparar empíricamente contra búsqueda
 * semántica en `compare.ts`.
 */

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  inStock: boolean;
  tags: string[];
}

const KEYWORD_TO_CATEGORY: Record<string, string[]> = {
  mochila: ["mochilas"],
  mochilas: ["mochilas"],
  trekking: ["mochilas", "calzado"],
  senderismo: ["mochilas", "calzado", "ropa"],
  tienda: ["tiendas"],
  carpa: ["tiendas"],
  bota: ["calzado"],
  botas: ["calzado"],
  zapatillas: ["calzado"],
  chaqueta: ["ropa"],
  ropa: ["ropa"],
  forro: ["ropa"],
  linterna: ["accesorios"],
  baston: ["accesorios"],
  bastones: ["accesorios"],
  hornillo: ["cocina"],
  cocina: ["cocina"],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((s) => s.length > 2);
}

function score(product: Product, terms: string[]): number {
  const haystack = `${product.name} ${product.description} ${product.tags.join(" ")} ${product.category}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  let s = 0;
  for (const term of terms) {
    if (haystack.includes(term)) s += 1;
  }
  if (product.inStock) s += 0.5;
  return s;
}

export function keywordSearch(
  catalog: Product[],
  query: string,
  limit = 3,
): Product[] {
  const terms = tokenize(query);
  const categoryHints = new Set<string>();
  for (const term of terms) {
    const cats = KEYWORD_TO_CATEGORY[term];
    if (cats) cats.forEach((c) => categoryHints.add(c));
  }

  let pool: Product[] = catalog;
  if (categoryHints.size > 0) {
    pool = pool.filter((p) => categoryHints.has(p.category));
  }

  return pool
    .map((p) => ({ p, s: score(p, terms) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ p }) => p);
}
