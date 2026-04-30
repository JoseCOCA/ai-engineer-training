-- S10 — Migración para hybrid search en pgvector.
--
-- Agrega columna `search_doc` (tsvector ponderado) e índice GIN.
-- Idempotente: se puede ejecutar múltiples veces.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS search_doc tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(category, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS products_search_doc_gin
  ON products USING GIN (search_doc);
