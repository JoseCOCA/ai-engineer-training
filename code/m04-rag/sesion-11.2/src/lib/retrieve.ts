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

export async function retrieveProducts(
  pool: pg.Pool,
  query: string,
  k = 3,
  threshold = 0.55,
  embeddingVersion = EMBEDDING_VERSION,
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
    [qSql, EMBEDDING_MODEL, embeddingVersion, k],
  );

  return res.rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      description: r.description,
      similarity: Number(r.similarity),
    }))
    .filter((r) => (r.similarity ?? 0) >= threshold);
}
