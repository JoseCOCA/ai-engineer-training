/**
 * Retrievers: dense, sparse (BM25-like vía ts_rank_cd) y hybrid (RRF).
 *
 * Cada retriever devuelve una lista ordenada de IDs. La info adicional
 * (nombre, descripción) la pueblan los demos cuando la necesitan, para
 * mantener los retrievers acotados a su responsabilidad.
 */
import type pg from "pg";
import { vectorToSql } from "./db.js";
import { EMBEDDING_MODEL, EMBEDDING_VERSION, embedQuery } from "./embed.js";
import { rrf } from "./rrf.js";

export interface Ranked {
  id: string;
  score: number;
}

export interface ProductRow {
  id: string;
  name: string;
  category: string;
  description: string;
}

export async function denseRetrieve(
  pool: pg.Pool,
  query: string,
  k = 10,
): Promise<Ranked[]> {
  const qVec = await embedQuery(query);
  const qSql = vectorToSql(qVec);

  const res = await pool.query<{ id: string; similarity: string }>(
    `SELECT id, (embedding <#> $1::vector) * -1 AS similarity
       FROM products
      WHERE embedding_model = $2 AND embedding_version = $3
      ORDER BY embedding <#> $1::vector
      LIMIT $4`,
    [qSql, EMBEDDING_MODEL, EMBEDDING_VERSION, k],
  );

  return res.rows.map((r) => ({ id: r.id, score: Number(r.similarity) }));
}

export async function sparseRetrieve(
  pool: pg.Pool,
  query: string,
  k = 10,
): Promise<Ranked[]> {
  const res = await pool.query<{ id: string; rank: string }>(
    `SELECT id,
            ts_rank_cd(search_doc, plainto_tsquery('spanish', $1)) AS rank
       FROM products
      WHERE search_doc @@ plainto_tsquery('spanish', $1)
      ORDER BY rank DESC
      LIMIT $2`,
    [query, k],
  );

  return res.rows.map((r) => ({ id: r.id, score: Number(r.rank) }));
}

export async function hybridRetrieve(
  pool: pg.Pool,
  query: string,
  k = 10,
  rrfK = 60,
): Promise<Ranked[]> {
  const [dense, sparse] = await Promise.all([
    denseRetrieve(pool, query, k),
    sparseRetrieve(pool, query, k),
  ]);

  const fused = rrf([dense.map((d) => d.id), sparse.map((s) => s.id)], rrfK);
  return fused.slice(0, k);
}

export async function fetchProducts(
  pool: pg.Pool,
  ids: string[],
): Promise<Map<string, ProductRow>> {
  if (ids.length === 0) return new Map();
  const res = await pool.query<ProductRow>(
    `SELECT id, name, category, description
       FROM products
      WHERE id = ANY($1)`,
    [ids],
  );
  return new Map(res.rows.map((r) => [r.id, r]));
}

export async function fetchProductsWithEmbeddings(
  pool: pg.Pool,
  ids: string[],
): Promise<Array<ProductRow & { embedding: number[] }>> {
  if (ids.length === 0) return [];
  const res = await pool.query<{
    id: string;
    name: string;
    category: string;
    description: string;
    embedding: string;
  }>(
    `SELECT id, name, category, description, embedding::text AS embedding
       FROM products
      WHERE id = ANY($1)`,
    [ids],
  );

  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description,
    embedding: parsePgVector(r.embedding),
  }));
}

function parsePgVector(text: string): number[] {
  const trimmed = text.trim().replace(/^\[|\]$/g, "");
  return trimmed.split(",").map((x) => Number.parseFloat(x));
}
