-- S08 — Índice HNSW sobre embedding usando dot product.
--
-- vector_ip_ops = inner product. Con vectores normalizados (Gemini),
-- inner product es equivalente a coseno y más rápido.
--
-- Parámetros (defaults razonables):
--   m = 16                  → vecinos por nodo del grafo
--   ef_construction = 64    → profundidad de búsqueda durante el build

CREATE INDEX IF NOT EXISTS products_embedding_hnsw_idx
    ON products
    USING hnsw (embedding vector_ip_ops)
    WITH (m = 16, ef_construction = 64);

-- Después del bulk insert, actualizar estadísticas para que el planner
-- decida bien cuándo usar el índice.
ANALYZE products;
