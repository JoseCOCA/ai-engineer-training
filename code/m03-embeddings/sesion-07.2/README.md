# Código S07.2 — Teoría de embeddings y modelos

Acompaña a [`docs/modulos/03-embeddings/sesion-07.2-modelos-embeddings/`](../../../docs/modulos/03-embeddings/sesion-07.2-modelos-embeddings/).

## Setup

Desde la raíz del repo:

```bash
pnpm install
```

`.env` con `GOOGLE_GENERATIVE_AI_API_KEY` (siempre necesaria) y opcional `OPENAI_API_KEY` para el ejercicio 1.

Para el reto Python (opcional):

```bash
cd python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python compare_local.py
```

## Estructura

```
data/
└── catalog.json           ← 12 productos (versión simplificada)

src/
├── compare-providers.ts   ← Gemini vs OpenAI sobre el mismo corpus
├── mrl.ts                 ← Matryoshka: trunca 3072 → 768 → 256 → 128
├── domain-test.ts         ← test de matices del dominio outdoor
└── lib/
    └── util.ts            ← cosine, productAsDoc, topK

python/
├── requirements.txt
└── compare_local.py       ← reto: sentence-transformers local
```

## Scripts

| Script | Comando | Qué muestra |
|--------|---------|-------------|
| Compare providers | `pnpm run compare-providers` | Gemini vs OpenAI top-3 lado a lado |
| MRL | `pnpm run mrl` | Truncado de Gemini 3072 → 128 dimensions |
| Domain test | `pnpm run domain-test` | Validación de rankings sobre dominio outdoor |
| Local (Python) | `python python/compare_local.py` | sentence-transformers local |
