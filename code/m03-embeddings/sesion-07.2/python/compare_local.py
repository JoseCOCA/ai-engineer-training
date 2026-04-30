"""
Reto S07.2 (Python opcional): embedder local con sentence-transformers.

Carga `paraphrase-multilingual-mpnet-base-v2` (768D, multilingüe),
embedeaa los 12 productos del catálogo y resuelve 3 queries.

Compara con la salida de Gemini para validar que ambos rankean
productos similares pese a vivir en espacios distintos.

Setup:
    python3 -m venv venv
    source venv/bin/activate  # o venv\\Scripts\\activate en Windows
    pip install -r requirements.txt

Ejecutar:
    python compare_local.py
"""
import json
import time
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
CATALOG_PATH = Path(__file__).parent.parent / "data" / "catalog.json"

QUERIES = [
    "algo para cargar mis cosas en una caminata",
    "necesito iluminar el sendero de noche",
    "rucksack para hiking de fin de semana",
]


def product_as_doc(p: dict) -> str:
    return f"{p['name']}. {p['description']} Categoría: {p['category']}."


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def main() -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    print(f"Cargando modelo {MODEL_NAME}...")
    t0 = time.time()
    model = SentenceTransformer(MODEL_NAME)
    print(f"Modelo cargado en {time.time() - t0:.2f}s")
    print()

    docs = [product_as_doc(p) for p in catalog]
    print(f"Embedeando {len(catalog)} productos...")
    t0 = time.time()
    corpus_vecs = model.encode(docs, normalize_embeddings=True)
    print(f"Embeddings de corpus en {time.time() - t0:.2f}s")
    print()

    for query in QUERIES:
        print(f'Query: "{query}"')
        t0 = time.time()
        q_vec = model.encode([query], normalize_embeddings=True)[0]
        q_time = time.time() - t0

        scored = sorted(
            ((cosine(q_vec, corpus_vecs[i]), p) for i, p in enumerate(catalog)),
            key=lambda x: -x[0],
        )[:3]

        for score, p in scored:
            print(f"  {p['name']:30s} ({score:.2f})")
        print(f"  [query embed: {q_time * 1000:.0f}ms]")
        print()

    print("Latencia local típica: 30-80ms por query (CPU).")
    print("Comparable: Gemini API call ~50-200ms incluye round-trip.")


if __name__ == "__main__":
    main()
