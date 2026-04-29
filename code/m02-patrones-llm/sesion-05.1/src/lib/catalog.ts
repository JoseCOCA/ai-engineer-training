/**
 * Acceso al catálogo mock de TiendaPro.
 *
 * Patrón query-then-inject: en lugar de pasar el catálogo entero al
 * prompt, filtramos a los items relevantes y solo esos viajan al modelo.
 *
 * En M3 cambiamos este filtro por embeddings + búsqueda vectorial.
 * El patrón general (consulta → subset → inyectar) se mantiene.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  inStock: boolean;
  tags: string[];
}

const CATALOG_PATH = fileURLToPath(
  new URL("../../data/catalog.json", import.meta.url),
);

let cache: Product[] | null = null;

export function loadCatalog(): Product[] {
  if (cache) return cache;
  const content = readFileSync(CATALOG_PATH, "utf8");
  cache = JSON.parse(content) as Product[];
  return cache;
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
  if (product.inStock) s += 0.5; // ligero boost a productos disponibles
  return s;
}

export interface FindOptions {
  limit?: number;
  onlyInStock?: boolean;
}

export function findProducts(
  query: string,
  options: FindOptions = {},
): Product[] {
  const { limit = 5, onlyInStock = false } = options;
  const catalog = loadCatalog();
  const terms = tokenize(query);

  // Filtro inicial por categoría si reconocemos keywords del dominio
  const categoryHints = new Set<string>();
  for (const term of terms) {
    const cats = KEYWORD_TO_CATEGORY[term];
    if (cats) cats.forEach((c) => categoryHints.add(c));
  }

  let pool: Product[] = catalog;
  if (categoryHints.size > 0) {
    pool = pool.filter((p) => categoryHints.has(p.category));
  }
  if (onlyInStock) {
    pool = pool.filter((p) => p.inStock);
  }

  const scored = pool
    .map((p) => ({ p, s: score(p, terms) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ p }) => p);

  return scored;
}
