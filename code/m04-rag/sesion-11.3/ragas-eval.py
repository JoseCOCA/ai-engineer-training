"""
RAGAS — script opcional Python para correr las 4 métricas canónicas
sobre el eval set del integrador.

Requiere:
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    export GOOGLE_API_KEY=...

Lee `code/proyecto-integrador/evals/eval-set.json` y, para cada caso,
invoca el runner del integrador (vía subprocess) para capturar
(answer, contexts). Luego corre RAGAS sobre el dataset.

Este script es DEMOSTRATIVO. La integración fina con el pipeline RAG
real requiere o bien exponer el pipeline como endpoint o serializar
sus salidas. Acá usamos un mock simple por simplicidad.
"""
from __future__ import annotations

import json
from pathlib import Path

EVAL_SET_PATH = (
    Path(__file__).parent.parent.parent
    / "proyecto-integrador"
    / "evals"
    / "eval-set.json"
)


def main() -> None:
    if not EVAL_SET_PATH.exists():
        print(f"Eval set no encontrado en: {EVAL_SET_PATH}")
        print("Asegúrate de haber clonado el repo completo del curso.")
        return

    with EVAL_SET_PATH.open("r", encoding="utf-8") as f:
        eval_set = json.load(f)

    print(f"Eval set cargado: {len(eval_set)} casos.")
    print()
    print("Tipos de casos:")
    by_type: dict[str, int] = {}
    for c in eval_set:
        by_type[c["type"]] = by_type.get(c["type"], 0) + 1
    for t, n in by_type.items():
        print(f"  {t}: {n}")

    print()
    print("Próximos pasos para correr RAGAS de verdad:")
    print("  1. Expón el pipeline RAG del integrador como función llamable")
    print("     desde Python (vía HTTP, IPC o invocando tsx por subprocess).")
    print("  2. Por cada caso del eval set, ejecuta el pipeline y captura")
    print("     (question, answer, contexts).")
    print("  3. Construye un Dataset de Hugging Face con esas columnas.")
    print("  4. Llama a `evaluate(dataset, metrics=[faithfulness, answer_relevancy,")
    print("     context_precision, context_recall], llm=...)`")
    print("  5. Imprime el resultado. RAGAS devuelve un dict con cada métrica.")
    print()
    print("Ejemplo mínimo del paso 4:")
    print("""
    from ragas import evaluate
    from ragas.metrics import (
        faithfulness, answer_relevancy,
        context_precision, context_recall,
    )
    from datasets import Dataset

    ds = Dataset.from_dict({
        "question": questions,
        "answer": answers,
        "contexts": contexts_list,
        "ground_truth": ground_truths,
    })
    result = evaluate(ds, metrics=[
        faithfulness, answer_relevancy,
        context_precision, context_recall,
    ])
    print(result)
    """)


if __name__ == "__main__":
    main()
