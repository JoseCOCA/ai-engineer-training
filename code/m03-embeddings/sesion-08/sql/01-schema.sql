-- S08 — Schema base de pgvector para el catálogo de TiendaPro.
--
-- Idempotente: se puede ejecutar múltiples veces sin error.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS products (
    id                   TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    category             TEXT NOT NULL,
    description          TEXT NOT NULL,
    embedding            vector(768) NOT NULL,
    embedding_model      TEXT NOT NULL,
    embedding_version    INT  NOT NULL,
    indexed_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice secundario sobre (model, version) para que la app filtre rápido
-- las queries cuando coexisten múltiples generaciones de embeddings.
CREATE INDEX IF NOT EXISTS products_model_version_idx
    ON products(embedding_model, embedding_version);
