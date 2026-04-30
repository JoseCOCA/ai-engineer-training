# Código S08 — Bases de datos vectoriales

Acompaña a [`docs/modulos/03-embeddings/sesion-08-bases-vectoriales/`](../../../docs/modulos/03-embeddings/sesion-08-bases-vectoriales/).

## Setup

Desde la raíz del repo:

```bash
docker compose up -d postgres        # pgvector/pgvector:pg16
pnpm install
```

`.env` con:

```bash
GOOGLE_GENERATIVE_AI_API_KEY=tu_api_key
POSTGRES_USER=curso
POSTGRES_PASSWORD=curso
POSTGRES_DB=curso_ai
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

Para el ejercicio opcional de Qdrant:

```bash
docker compose --profile qdrant up -d qdrant
```

## Estructura

```
data/
└── catalog.json              ← 12 productos (igual que S07.2/S07.3)

sql/
├── 01-schema.sql             ← extensión vector + tabla products + índice (model, version)
└── 02-index-hnsw.sql         ← índice HNSW sobre embedding (vector_ip_ops)

src/
├── 01-setup-and-schema.ts    ← aplica sql/01-schema.sql
├── 02-ingest-catalog.ts      ← embedea + UPSERT + crea HNSW al final
├── 03-search-with-threshold.ts  ← top-K + threshold + EXPLAIN ANALYZE
├── 04-filter-by-category.ts  ← pre vs post-filter
├── 05-qdrant-mirror.ts       ← mirror del catálogo en Qdrant (opcional)
└── lib/
    ├── db.ts                 ← pool de pg + helpers
    └── util.ts               ← productAsDoc, embed helpers
```

## Scripts

| Script | Comando | Qué hace |
|--------|---------|----------|
| Setup schema | `pnpm run setup-schema` | Crea extensión vector + tabla |
| Ingest catalog | `pnpm run ingest-catalog` | Embedea + inserta + crea HNSW |
| Search | `pnpm run search` | Top-K + threshold + EXPLAIN |
| Filter | `pnpm run filter` | Pre vs post-filter por categoría |
| Qdrant mirror | `pnpm run qdrant-mirror` | Misma data en Qdrant (opcional) |

## Limpieza

Para resetear el estado:

```bash
docker compose exec postgres psql -U curso -d curso_ai -c "DROP TABLE IF EXISTS products CASCADE;"
```
