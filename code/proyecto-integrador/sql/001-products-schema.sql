-- TiendaPro — schema del catálogo en pgvector.
--
-- Idempotente: se puede ejecutar múltiples veces sin error.
-- Aplica:
--   1. Extensión vector.
--   2. Tabla products con metadata completa (price, inStock, tags) +
--      embedding + versionado de modelo.
--   3. Índices secundarios para filtros (category, model+version).
--   4. Índice HNSW sobre embedding usando dot product.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS products (
    id                   TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    category             TEXT NOT NULL,
    price                NUMERIC(10, 2) NOT NULL,
    description          TEXT NOT NULL,
    in_stock             BOOLEAN NOT NULL,
    tags                 TEXT[] NOT NULL DEFAULT '{}',
    embedding            vector(768) NOT NULL,
    embedding_model      TEXT NOT NULL,
    embedding_version    INT  NOT NULL,
    indexed_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_category_idx
    ON products(category);

CREATE INDEX IF NOT EXISTS products_model_version_idx
    ON products(embedding_model, embedding_version);

CREATE INDEX IF NOT EXISTS products_embedding_hnsw_idx
    ON products
    USING hnsw (embedding vector_ip_ops)
    WITH (m = 16, ef_construction = 64);
