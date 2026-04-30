/**
 * Retriever denso + fetcher de productos. Versión acotada para S11.1
 * (sin sparse, sin hybrid — esos están en S10).
 */
import type pg from "pg";
import { vectorToSql } from "./db.js";
import { EMBEDDING_MODEL, EMBEDDING_VERSION, embedQuery } from "./embed.js";

export interface ProductRow {
  id: string;
  name: string;
  category: string;
  description: string;
  similarity?: number;
}

export async function denseRetrieve(
  pool: pg.Pool,
  query: string,
  k = 15,
): Promise<ProductRow[]> {
  const qVec = await embedQuery(query);
  const qSql = vectorToSql(qVec);

  const res = await pool.query<{
    id: string;
    name: string;
    category: string;
    description: string;
    similarity: string;
  }>(
    `SELECT id, name, category, description,
            (embedding <#> $1::vector) * -1 AS similarity
       FROM products
      WHERE embedding_model = $2 AND embedding_version = $3
      ORDER BY embedding <#> $1::vector
      LIMIT $4`,
    [qSql, EMBEDDING_MODEL, EMBEDDING_VERSION, k],
  );

  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description,
    similarity: Number(r.similarity),
  }));
}

export async function findSiblingsByCategory(
  pool: pg.Pool,
  category: string,
  excludeIds: string[],
  limit = 2,
): Promise<ProductRow[]> {
  const res = await pool.query<{
    id: string;
    name: string;
    category: string;
    description: string;
  }>(
    `SELECT id, name, category, description
       FROM products
      WHERE category = $1
        AND NOT (id = ANY($2))
      ORDER BY indexed_at DESC
      LIMIT $3`,
    [category, excludeIds, limit],
  );

  return res.rows;
}
