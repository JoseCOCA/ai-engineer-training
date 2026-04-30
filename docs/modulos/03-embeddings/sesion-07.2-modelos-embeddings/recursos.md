# Sesión 07.2 — Recursos complementarios

Material opcional sobre teoría de embeddings y modelos.

---

## Lectura obligada (1 elemento)

- **Chip Huyen — _Designing your evaluation pipeline for foundation models_** — capítulo aplicado a embeddings y RAG. La intuición correcta para elegir modelos.
  - https://huyenchip.com/2025/01/07/agents.html (incluye sección sobre embeddings)

## Cómo se entrenan los embeddings

- **Sentence-BERT paper (Reimers & Gurevych, 2019)** — el paper que definió los modelos de embeddings modernos.
  - https://arxiv.org/abs/1908.10084
- **SimCSE paper (Gao et al., 2021)** — contrastive learning auto-supervisado.
  - https://arxiv.org/abs/2104.08821
- **Hugging Face — _Training Sentence Transformers_** — tutorial práctico para entrenar embedders propios.
  - https://huggingface.co/blog/how-to-train-sentence-transformers

## Benchmark MTEB

- **MTEB Leaderboard**
  - https://huggingface.co/spaces/mteb/leaderboard
- **MTEB paper (Muennighoff et al., 2023)**
  - https://arxiv.org/abs/2210.07316
- **MMTEB (multilingüe)**
  - https://github.com/embeddings-benchmark/mteb

## Modelos cloud

- **Gemini Embedding** — el que usamos en el curso.
  - https://ai.google.dev/gemini-api/docs/embeddings
- **OpenAI text-embedding-3** — segundo más popular en producción.
  - https://platform.openai.com/docs/guides/embeddings
- **Voyage AI** — embeddings dedicados, top en MTEB para retrieval.
  - https://docs.voyageai.com
- **Cohere Embed** — multilingüe fuerte.
  - https://docs.cohere.com/docs/embeddings
- **Mistral AI Embed** — alternativa europea.
  - https://docs.mistral.ai/capabilities/embeddings/

## Modelos open-source

- **sentence-transformers** (la lib canónica).
  - https://www.sbert.net
- **BAAI/bge-m3** — multilingüe + multi-functional (dense + sparse + colbert).
  - https://huggingface.co/BAAI/bge-m3
- **jinaai/jina-embeddings-v3** — comercial-friendly, fuerte performance.
  - https://huggingface.co/jinaai/jina-embeddings-v3
- **mixedbread-ai/mxbai-embed-large-v1** — top entre open-source.
  - https://huggingface.co/mixedbread-ai/mxbai-embed-large-v1
- **nomic-embed-text-v1.5** — open con MRL nativo.
  - https://huggingface.co/nomic-ai/nomic-embed-text-v1.5

## Matryoshka Representation Learning

- **MRL paper (Kusupati et al., 2022)**
  - https://arxiv.org/abs/2205.13147
- **Nomic — _Introducing Matryoshka_**
  - https://www.nomic.ai/blog/posts/nomic-embed-matryoshka

## Multilingüe y español

- **Cohere — _The state of multilingual embeddings_**
  - https://cohere.com/blog/state-of-multilingual-embeddings
- **Sentence-Transformers — modelos multilingües**
  - https://www.sbert.net/docs/sentence_transformer/pretrained_models.html#multi-lingual-models
- **MTEB — Spanish leaderboard** (si está disponible al momento)
  - https://huggingface.co/spaces/mteb/leaderboard (filtro por idioma)

## Operacional

- **Pinecone — _Embedding inference performance_** — comparativas latencia/throughput.
  - https://www.pinecone.io/learn/llama-2/
- **Hugging Face Inference Endpoints** — alternativa a API cloud para self-host gestionado.
  - https://huggingface.co/inference-endpoints

---

**Vuelve a:** [`README de la sesión`](README.md) · [`Curriculum maestro`](../../../00-curriculum.md)
