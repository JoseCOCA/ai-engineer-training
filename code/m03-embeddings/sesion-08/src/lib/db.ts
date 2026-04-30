/**
 * Pool de conexión a Postgres + helpers para pgvector.
 *
 * Formato de vector como string ('[a,b,c]') con cast ::vector en el SQL.
 * Es la forma más simple de trabajar con node-postgres sin depender de
 * adaptadores de tipo.
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
