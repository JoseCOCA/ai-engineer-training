/**
 * Pool de Postgres + helpers para pgvector.
 * Mismo patrón que S08/S09.
 */
import pg from "pg";

export function createPool(): pg.Pool {
  return new pg.Pool({
    user: process.env.POSTGRES_USER ?? "curso",
    password: process.env.POSTGRES_PASSWORD ?? "curso",
    database: process.env.POSTGRES_DB ?? "curso_ai",
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
  });
}

export function vectorToSql(arr: number[]): string {
  return `[${arr.join(",")}]`;
}
