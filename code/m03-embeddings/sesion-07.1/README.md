# Código S07.1 — Chunking de documentos

Acompaña a [`docs/modulos/03-embeddings/sesion-07.1-chunking/`](../../../docs/modulos/03-embeddings/sesion-07.1-chunking/).

## Setup

Desde la raíz del repo:

```bash
pnpm install
```

No requiere `.env` — esta sesión es 100% offline (no hay llamadas a embeddings ni LLM).

## Estructura

```
data/
└── manual.md              ← manual de envíos+devoluciones de TiendaPro

src/
├── compare-splitters.ts   ← fixed-size vs recursive (LangChain)
├── structural.ts          ← chunker structural por headings de Markdown
├── sizes.ts               ← 4 configs de size/overlap comparadas
├── sentence-aware.ts      ← reto: chunker que respeta oraciones
└── lib/
    └── chunkers.ts        ← fixedSizeChunker, sentenceAwareChunker, markdownStructuralChunker
```

## Scripts

| Script | Comando | Qué muestra |
|--------|---------|-------------|
| Compare | `pnpm run compare-splitters` | Fixed-size vs recursive lado a lado |
| Structural | `pnpm run structural` | Chunks con metadata.headings jerárquica |
| Sizes | `pnpm run sizes` | 4 configs comparadas (Tiny / Default / Big / Heavy overlap) |
| Sentence-aware | `pnpm run sentence-aware` | Reto: chunker custom + caso patológico |
