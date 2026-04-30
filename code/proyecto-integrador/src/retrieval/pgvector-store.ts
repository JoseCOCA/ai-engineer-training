/**
 * PgVectorStore — cliente de pgvector para el catálogo de TiendaPro.
 *
 * Responsabilidades:
 *   - Conectarse a Postgres (Pool de pg).
 *   - Aplicar el schema (idempotente).
 *   - Hacer UPSERT del catálogo (con embeddings ya calculados).
 *   - Resolver búsquedas semánticas: top-K + threshold + filtros opcionales.
 *
 * No conoce a @curso-ai/llm — el embedder se inyecta como callback,
 * para mantener este módulo desacoplado del provider de embeddings.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { Product } from "../lib/catalog.js";

export interface SearchOptions {
  query: string;
  k?: number;
  threshold?: number;
  category?: string;
  onlyInStock?: boolean;
}

export interface SearchResult {
  id: string;
  name: string;
  category: string;
  price: number;
  inStock: boolean;
  similarity: number;
}

export interface PgVectorStoreOptions {
  embedder: (text: string) => Promise<number[]>;
  embeddingModel: string;
  embeddingVersion: number;
  poolConfig?: pg.PoolConfig;
}

const SCHEMA_PATH = fileURLToPath(
  new URL("../../sql/001-products-schema.sql", import.meta.url),
);

function vectorToSql(arr: number[]): string {
  return `[${arr.join(",")}]`;
}

function envPoolConfig(): pg.PoolConfig {
  return {
    user: process.env.POSTGRES_USER ?? "curso",
    password: process.env.POSTGRES_PASSWORD ?? "curso",
    database: process.env.POSTGRES_DB ?? "curso_ai",
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
  };
}

export class PgVectorStore {
  private readonly pool: pg.Pool;
  private readonly embedder: (text: string) => Promise<number[]>;
  private readonly embeddingModel: string;
  private readonly embeddingVersion: number;

  constructor(opts: PgVectorStoreOptions) {
    this.pool = new pg.Pool(opts.poolConfig ?? envPoolConfig());
    this.embedder = opts.embedder;
    this.embeddingModel = opts.embeddingModel;
    this.embeddingVersion = opts.embeddingVersion;
  }

  async applySchema(): Promise<void> {
    const sql = readFileSync(SCHEMA_PATH, "utf8");
    await this.pool.query(sql);
  }

  async count(): Promise<number> {
    const res = await this.pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM products",
    );
    return Number.parseInt(res.rows[0]?.n ?? "0", 10);
  }

  async upsertProducts(items: Array<Product & { embedding: number[] }>): Promise<void> {
    for (const p of items) {
      await this.pool.query(
        `INSERT INTO products
            (id, name, category, price, description, in_stock, tags,
             embedding, embedding_model, embedding_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            price = EXCLUDED.price,
            description = EXCLUDED.description,
            in_stock = EXCLUDED.in_stock,
            tags = EXCLUDED.tags,
            embedding = EXCLUDED.embedding,
            embedding_model = EXCLUDED.embedding_model,
            embedding_version = EXCLUDED.embedding_version,
            indexed_at = now()`,
        [
          p.id,
          p.name,
          p.category,
          p.price,
          p.description,
          p.inStock,
          p.tags,
          vectorToSql(p.embedding),
          this.embeddingModel,
          this.embeddingVersion,
        ],
      );
    }
  }

  async searchProducts(opts: SearchOptions): Promise<SearchResult[]> {
    const { query, k = 10, threshold = 0.55, category, onlyInStock } = opts;
    const qVec = await this.embedder(query);
    const qSql = vectorToSql(qVec);

    const filters: string[] = [
      "embedding_model = $2",
      "embedding_version = $3",
    ];
    const params: unknown[] = [qSql, this.embeddingModel, this.embeddingVersion];

    if (category) {
      params.push(category);
      filters.push(`category = $${params.length}`);
    }
    if (onlyInStock) {
      filters.push("in_stock = TRUE");
    }
    params.push(k);
    const limitParam = `$${params.length}`;

    const res = await this.pool.query<{
      id: string;
      name: string;
      category: string;
      price: string;
      in_stock: boolean;
      similarity: string;
    }>(
      `SELECT id, name, category, price, in_stock,
              (embedding <#> $1::vector) * -1 AS similarity
         FROM products
        WHERE ${filters.join(" AND ")}
        ORDER BY embedding <#> $1::vector
        LIMIT ${limitParam}`,
      params,
    );

    return res.rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        price: Number(r.price),
        inStock: r.in_stock,
        similarity: Number(r.similarity),
      }))
      .filter((r) => r.similarity >= threshold);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
