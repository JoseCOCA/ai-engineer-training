# Código S06 — Por qué embeddings

Acompaña a [`docs/modulos/03-embeddings/sesion-06-por-que-embeddings/`](../../../docs/modulos/03-embeddings/sesion-06-por-que-embeddings/).

## Setup

Desde la raíz del repo:

```bash
pnpm install
```

`.env` configurado en la raíz con `GOOGLE_GENERATIVE_AI_API_KEY` (los demos usan `gemini-embedding-001`).

## Estructura

```
data/
├── catalog.json           ← 12 productos (mismo de S05.1)
└── faqs.json              ← 8 preguntas frecuentes

src/
├── compare.ts             ← keyword vs semántica sobre 5 queries
├── similarity-matrix.ts   ← matriz de similitud entre todos los productos
├── faq-matching.ts        ← matching de query → FAQ por similitud coseno
├── duplicate-detection.ts ← detector de duplicados (reto)
└── lib/
    ├── embeddings.ts      ← embedOne, embedBatch, cosineSimilarity
    └── keyword-search.ts  ← filtro de S05.1 portado para comparar
```

## Scripts

| Script | Comando | Qué muestra |
|--------|---------|-------------|
| Compare | `pnpm run compare` | Keyword vs semántica lado a lado sobre 5 queries |
| Similarity | `pnpm run similarity` | Matriz coseno entre los 12 productos |
| FAQ | `pnpm run faq` | Matching query→FAQ con umbral 0.7 |
| Duplicates | `pnpm run duplicates` | Reto: detector de candidatos duplicados |
