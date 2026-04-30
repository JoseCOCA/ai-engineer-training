# Sesión 11.3 — Ejercicios

> **Tiempo estimado:** ~45 min total. Construir el eval set del integrador, configurar Promptfoo y correrlo. Opcional: script Python con RAGAS. Archivos en [`code/proyecto-integrador/evals/`](../../../../code/proyecto-integrador/evals/) y [`code/m04-rag/sesion-11.3/`](../../../../code/m04-rag/sesion-11.3/).

---

## Setup base

```bash
docker compose up -d postgres
pnpm install
pnpm --filter @curso-ai/proyecto-integrador index-catalog  # asegura el catálogo en pgvector
```

`.env` con `GOOGLE_GENERATIVE_AI_API_KEY` y las variables de Postgres.

Promptfoo viene como dependencia del paquete S11.3. Para verlo:

```bash
pnpm --filter @curso-ai/m04-sesion-11.3 exec promptfoo --version
```

---

## 1. Ejercicio guiado: revisar el eval set del integrador

**Objetivo:** entender la estructura del eval set y qué cubre cada caso.

Abre [`code/proyecto-integrador/evals/eval-set.json`](../../../../code/proyecto-integrador/evals/eval-set.json). Vas a ver ~15 casos clasificados en tres tipos:

- **catalog:** queries para las que el sistema debe recuperar productos concretos. Aserts: `must_cite_any_of`, `must_match_rubric`.
- **out_of_distribution:** queries fuera del catálogo. Asert: `must_say_no_information`.
- **adversarial:** queries que invitan a inventar datos. Asert: `must_not_contain` (precios, garantías, regalos no presentes).

Cada caso tiene `id`, `input`, `type`, y `expected`. Es JSON plano para que sea fácil agregar casos nuevos.

### Para revisar

- Modifica un caso del eval set: cambia el `must_cite_any_of` para forzar un fallo. Corre Promptfoo (siguiente ejercicio) y verifica que el assert lo detecta.
- Suma un caso adversarial sobre el catálogo de TiendaPro. Idea: "¿La mochila TP-MOCH-01 tiene garantía de 5 años?". El sistema debe decir que no tiene esa información.

---

## 2. Ejercicio guiado: correr Promptfoo sobre el integrador

**Objetivo:** ver la suite Ring 2 funcionando end-to-end.

### 2.1. Probarlo

```bash
pnpm --filter @curso-ai/proyecto-integrador test:evals
```

El script lee el eval set, llama al pipeline RAG por cada caso y aplica los asserts.

### 2.2. Salida esperada (forma)

```
[
  {
    "id": "catalog_basic_01",
    "input": "¿Qué mochila me recomiendan para senderismo de un día?",
    "passed": true,
    "asserts": [
      { "type": "must_cite_any_of", "value": ["TP-MOCH-01", "TP-MOCH-03"], "passed": true },
      { "type": "must_match_rubric", "value": "...", "passed": true }
    ]
  },
  ...
]
Resumen: 14/15 casos pasaron (93%).
```

### 2.3. Para reflexionar

- El runner de Promptfoo del integrador es ad-hoc (script TS) en lugar de la CLI oficial. La razón: la CLI está pensada para evaluar prompts directos al LLM, mientras que aquí evaluamos un pipeline completo. El patrón es el mismo: leer eval set, ejecutar pipeline, aplicar asserts.
- El `must_match_rubric` es un LLM judge ligero (un modelo cheap evalúa si la respuesta cumple un criterio). Para un eval set de 15 casos, esto cuesta ~3-5 centavos por corrida.

---

## 3. Ejercicio guiado: análisis de fallos

**Objetivo:** cuando un caso falla, el reporte debe permitir diagnosticar dónde falló (retrieval, generación, validación).

### 3.1. Forzar un fallo

Edita `eval-set.json` y cambia un caso `catalog` para que su `must_cite_any_of` requiera un id que no existe (ej: `["TP-XXX-99"]`). Corre los evals de nuevo:

```bash
pnpm --filter @curso-ai/proyecto-integrador test:evals
```

### 3.2. Salida esperada

```
{
  "id": "catalog_basic_01",
  "input": "...",
  "passed": false,
  "actual": {
    "answer": "...",
    "citations": ["TP-MOCH-01"],
    "chunks_recuperados": ["TP-MOCH-01", "TP-MOCH-03"]
  },
  "asserts": [
    { "type": "must_cite_any_of", "value": ["TP-XXX-99"], "passed": false }
  ]
}
```

El reporte muestra qué se recuperó, qué se citó y qué falló. Esto es la diferencia entre un test que dice "rojo" y uno que ayuda a debuggear.

### 3.3. Restaurar

Vuelve a poner el id correcto y verifica que pasa.

---

## 4. Ejercicio opcional (Python): RAGAS sobre el integrador

**Objetivo:** ver las cuatro métricas canónicas de RAGAS sobre el mismo eval set.

> **Nota:** este ejercicio requiere Python 3.10+ y `pip install ragas datasets`. Si no quieres meter Python, puedes saltearlo — la suite Promptfoo del ejercicio 2 cubre la práctica core de la sesión.

### 4.1. Probarlo

```bash
cd code/m04-rag/sesion-11.3
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python ragas-eval.py
```

El script:

1. Lee `eval-set.json` del integrador.
2. Para cada caso, llama al pipeline RAG (vía `subprocess`) y captura `(answer, contexts)`.
3. Calcula las 4 métricas canónicas con RAGAS (faithfulness, answer_relevancy, context_precision, context_recall).
4. Imprime el reporte agregado.

### 4.2. Salida esperada (forma)

```
Evaluating 15 cases...

Metric                  | Mean    | Min     | Max
faithfulness            | 0.91    | 0.66    | 1.00
answer_relevancy        | 0.85    | 0.70    | 0.95
context_precision       | 0.82    | 0.50    | 1.00
context_recall          | 0.78    | 0.40    | 1.00
```

### 4.3. Para reflexionar

- RAGAS tarda mucho más que Promptfoo: cada métrica es una llamada LLM por caso. Para 15 casos × 4 métricas = 60 llamadas LLM. Plan en consecuencia.
- Las 4 métricas son **ortogonales**. Faithfulness alta + answer_relevancy baja = el sistema responde algo fiel al contexto pero no contesta la pregunta. Investigación en el sistema, no en RAGAS.

---

## Bonus (opcional)

1. **CI con threshold.** Configura GitHub Actions para que `pnpm test:evals` falle si menos del 80% de los asserts pasan.
2. **Eval set creciente.** Agrega 5 casos nuevos al eval set: 2 happy, 1 OOD, 1 adversarial, 1 ambiguo. Corre los evals y mira qué métricas cambian.
3. **Comparación de pipelines.** Crea una variante del pipeline que NO use rerank (`runRagPipeline(store, query, { rerank: false })`) y corre el eval set con ambas. Mide la diferencia en `must_cite_any_of` pass rate.

---

**Cierre del módulo:** después de pasar la suite de evals, hacemos el commit `feat(proyecto-integrador): cierra Módulo 4 con asistente RAG sobre catálogo` y el tag `proyecto-m4`.
