# Código S07.3 — Espacio vectorial, búsqueda semántica y pre-procesamiento

Acompaña a [`docs/modulos/03-embeddings/sesion-07.3-espacio-vectorial/`](../../../docs/modulos/03-embeddings/sesion-07.3-espacio-vectorial/).

## Setup

Desde la raíz del repo:

```bash
pnpm install
```

`.env` con `GOOGLE_GENERATIVE_AI_API_KEY` (obligatorio). No se requiere ninguna otra variable.

## Estructura

```
data/
├── catalog.json          ← 12 productos (mismo que S07.2)
└── labeled-pairs.json    ← ~30 pares (query, productId, label) para calibración

src/
├── compare-distances.ts        ← coseno vs dot vs L2 sobre normalizados y no
├── threshold-calibration.ts    ← histograma + threshold sugerido por percentil
├── preprocess-test.ts          ← efecto de lowercase / sin puntuación / sin stop words
├── failure-modes.ts            ← SKU como query, negación, número
└── lib/
    └── util.ts                 ← cosine, dot, l2, normalize, productAsDoc, histogram
```

## Scripts

| Script | Comando | Qué muestra |
|--------|---------|-------------|
| Compare distances | `pnpm run compare-distances` | Ranking con 3 métricas, normalizados vs no |
| Threshold calibration | `pnpm run threshold-calibration` | Histograma de positivos vs negativos + τ sugerido |
| Preprocess test | `pnpm run preprocess-test` | Cambio de top-3 según pre-procesamiento |
| Failure modes | `pnpm run failure-modes` | SKU + negación + número: por qué fallan |
