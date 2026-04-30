# Sesión 11.3 — Evaluación de calidad con RAGAS y Promptfoo

> **Módulo:** 4 — Arquitectura RAG · **Duración estimada:** 1.5h (~45 min lectura + ~45 min práctica) · **Formato:** 60% teoría / 40% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión podrás:

- Diseñar un **eval set** representativo y escalable para tu sistema RAG: cómo se construye, qué tamaño tiene sentido, cómo se mantiene.
- Distinguir las **métricas canónicas** de evaluación RAG (faithfulness, answer relevance, context precision, context recall) y entender qué mide cada una.
- Operar **Promptfoo** (TS) sobre el integrador: configuración, asserts, integración con CI.
- Operar **RAGAS** (Python) como complemento: cuándo elegirlo sobre Promptfoo y viceversa.
- Definir una **estrategia de evals**: qué se mide en cada PR, qué corre en nightly, qué corre solo en release candidates.

## 2. Prerequisitos

- **Todo el módulo M4** (S09 → S11.2). El integrador con pipeline RAG ya conectado.
- **Python 3.10+** (opcional, solo si quieres correr la parte de RAGAS).
- **GOOGLE_GENERATIVE_AI_API_KEY** configurada — Promptfoo y RAGAS hacen llamadas reales al LLM.

## 3. Conceptos clave

- **Eval set:** colección de pares `(input, expected)` que representa el dominio. Es la verdad de tu sistema. Sin eval set, no se puede medir.
- **Faithfulness:** porcentaje de claims de la respuesta que están soportados por el contexto. Mide alucinación grounded.
- **Answer relevance:** qué tan bien la respuesta aborda la pregunta del usuario. Una respuesta puede ser fiel pero off-topic.
- **Context precision:** de los chunks recuperados, qué porcentaje son realmente relevantes. Mide ruido del retriever.
- **Context recall:** de los chunks ideales (ground truth), qué porcentaje están en el top-K. Mide si el retriever encuentra lo necesario.
- **LLM judge:** patrón donde un LLM (idealmente más capaz que el generador) evalúa una métrica de calidad sobre las respuestas.
- **Promptfoo:** framework TS para evaluar prompts y sistemas LLM. Asserts incluyen `equals`, `contains`, `llm-rubric`, `factuality`. CI-friendly.
- **RAGAS:** framework Python específico para RAG. Implementa faithfulness, answer relevance, context precision/recall con LLM judge.
- **Drift de modelo:** cambio de comportamiento del LLM (versión nueva del proveedor) que degrada métricas sin que cambies tu código. Solo se detecta con evals periódicas.

## 4. Teoría

### 4.1. Por qué evals son no-negociables en sistemas RAG

Sin eval set, lo único que sabes es "¿funcionó esta respuesta puntual?". Y "esta funciona" no escala a un producto.

Tres problemas operativos que solo los evals resuelven:

1. **Regresiones invisibles.** Cambias el threshold de retrieval de 0.55 a 0.50. Algunas queries mejoran, otras empeoran. Sin eval set, solo descubrís el problema cuando un usuario se queja.
2. **Drift de modelo.** El proveedor actualiza Gemini Flash a una versión nueva. Tu pipeline no cambió, pero las respuestas son distintas. Sin evals, descubrís el cambio cuando ya está en producción.
3. **Decisiones técnicas no medidas.** ¿Conviene agregar reranking? ¿HyDE? ¿Subir K=3 a K=5? Cada una de estas decisiones tiene un costo. Sin evals, las decisiones son opinión.

> **Regla:** todo cambio significativo al pipeline RAG debe pasar por un eval set antes de mergearse. CI bloquea PRs que degradan métricas más allá de un umbral aceptable.

### 4.2. Cómo se construye un eval set

#### Tamaño mínimo

- **30 casos** para arrancar — suficiente para detectar diferencias gruesas (regresiones del 10%+).
- **100 casos** para producción — captura la mayor parte de la cola larga.
- **300+ casos** cuando el sistema está maduro y quieres detectar regresiones más sutiles.

No empieces con 1000. Empieza con 30, mide, y crece el set cuando descubras gaps.

#### Estructura básica

```json
[
  {
    "id": "catalog_basic_01",
    "type": "catalog",
    "input": "¿Qué mochila me recomiendan para senderismo de un día?",
    "expected": {
      "must_cite": ["TP-MOCH-01"],
      "must_not_invent": true,
      "must_match_llm_rubric": "La respuesta recomienda al menos una mochila adecuada para senderismo corto y cita un id válido."
    }
  },
  {
    "id": "ood_01",
    "type": "out_of_distribution",
    "input": "¿Cuánto cuesta enviar un paquete a Marte?",
    "expected": {
      "must_say_no_information": true,
      "must_not_cite_anything": true
    }
  }
]
```

Los asserts son **declarativos**. Cada framework (Promptfoo, RAGAS) los ejecuta a su manera.

#### Estrategia de cobertura

Tu eval set debería cubrir:

- **Casos felices** (queries para las que el sistema tiene respuesta clara): 50-60%.
- **Casos OOD** (queries fuera del corpus): 15-20%. Validan que el sistema diga "no sé".
- **Casos ambiguos** (preguntas cortas, vagas): 10-15%. Validan que el retriever sea razonable.
- **Casos adversariales** (queries diseñadas para invitar a inventar): 10-15%. Validan que el control de alucinaciones aguante.

### 4.3. Las métricas canónicas

#### Recall@K (retrieval-only)

Para cada query con un `expected_doc_id` conocido, ¿en qué fracción de queries el doc esperado aparece en el top-K?

```
Recall@5 = #queries_con_doc_esperado_en_top_5 / #total_queries
```

- **Métrica primaria del retriever.** Si `Recall@5 < 0.7`, ningún truco posterior va a salvar tu RAG.
- **Limitación:** no mide calidad de la generación, solo encontrar.

#### Faithfulness

Una respuesta es fiel si TODOS sus claims están soportados por el contexto.

```
Faithfulness = claims_soportados / claims_totales
```

- **Métrica primaria contra alucinación grounded.**
- **Implementación canónica:** un LLM judge descompone la respuesta en claims atómicos y verifica cada uno contra el contexto.

#### Answer relevance

¿Qué tan bien la respuesta aborda la pregunta del usuario?

- Implementación: el judge genera N posibles preguntas que la respuesta podría estar respondiendo. Mide la similitud semántica entre esas preguntas y la pregunta original.
- **Captura un fallo común:** respuestas técnicamente correctas pero que no contestan lo que el usuario preguntó.

#### Context precision y context recall

Sobre los chunks recuperados:

- **Context precision:** qué fracción son **realmente** relevantes a la pregunta. Detecta ruido en el retriever.
- **Context recall:** qué fracción de los chunks ideales (ground truth) se trajeron. Detecta gaps en el retriever.

Las dos juntas son F1 del retriever. RAGAS las separa porque cada una sugiere acciones distintas:
- Precision baja → mejorar threshold, reranker.
- Recall bajo → ampliar K, hybrid search, query rewriting.

### 4.4. Promptfoo (TypeScript)

Promptfoo es el framework default para evals desde TS. Ventajas: vive en el mismo repo que tu código, usa npm/pnpm, integra con CI nativo, asserts simples.

#### Estructura mínima

```yaml
# evals/promptfoo.yaml

prompts:
  - file://prompts/rag-prompt.ts

providers:
  - id: rag-pipeline
    config:
      script: file://evals/run-pipeline.ts

tests:
  - vars:
      query: "¿Tienen mochilas para senderismo?"
    assert:
      - type: contains
        value: "TP-MOCH"
      - type: llm-rubric
        value: "La respuesta recomienda al menos una mochila adecuada y cita su id."
      - type: not-contains
        value: "TP-XXX"  # un id inventado, no debe aparecer

  - vars:
      query: "¿Cuánto cuesta enviar a Marte?"
    assert:
      - type: contains
        value: "No tengo información"
```

#### Asserts más útiles

| Assert | Uso |
|--------|-----|
| `contains`, `not-contains` | Validar presencia/ausencia de palabras o ids |
| `equals`, `regex` | Comparación estricta |
| `llm-rubric` | LLM judge con un criterio en lenguaje natural |
| `factuality` | Compara respuesta vs ground truth con LLM |
| `latency` | Falla si supera un límite de ms |
| `cost` | Falla si supera un presupuesto de tokens |

#### Integración con CI

```yaml
# .github/workflows/evals.yml
on: [pull_request]
jobs:
  rag-evals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm exec promptfoo eval -c evals/promptfoo.yaml --output evals/results.json
        env:
          GOOGLE_GENERATIVE_AI_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
      - run: pnpm exec promptfoo test --threshold 0.85
```

El último paso falla si pasan menos del 85% de los asserts.

### 4.5. RAGAS (Python)

RAGAS es el framework académico de referencia para evals de RAG. Ventajas: implementa las cuatro métricas canónicas con LLM judge bien calibrado, basado en literatura. Desventajas: vive en Python (otro lenguaje en tu stack), las métricas con LLM judge son lentas y caras.

#### Estructura mínima

```python
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision, context_recall
from datasets import Dataset

eval_set = Dataset.from_dict({
    "question": [...],
    "answer": [...],          # respuesta generada por tu RAG
    "contexts": [[...], ...], # chunks recuperados por tu retriever
    "ground_truth": [...],    # respuesta esperada (para context_recall y answer_relevancy)
})

result = evaluate(
    eval_set,
    metrics=[faithfulness, answer_relevancy, context_precision, context_recall],
    llm=...,
    embeddings=...,
)

print(result)
# faithfulness: 0.92, answer_relevancy: 0.87, context_precision: 0.81, context_recall: 0.78
```

#### Cuándo usar RAGAS y cuándo Promptfoo

| Caso | Recomendación |
|------|---------------|
| Tests rápidos en cada PR (presupuesto < 1 min) | Promptfoo con asserts livianos |
| Eval profundo en nightly (presupuesto < 30 min) | Promptfoo con `llm-rubric` + RAGAS sobre subset |
| Reportes para stakeholders (ejecutivos, compliance) | RAGAS con las 4 métricas canónicas |
| Comparativa de modelos / pipelines en R&D | RAGAS para granularidad por métrica |

**Default profesional:** Promptfoo en CI, RAGAS en pipeline nocturno y reportes.

### 4.6. Estrategia de evals: tres rings

```
       Ring 3: Eval set completo
       ┌────────────────────────────────────┐
       │  RAGAS sobre 200+ casos.           │
       │  Nightly o pre-release.            │
       │  Reportes a stakeholders.          │
       └────────────────────────────────────┘
                    │
                    ▼
       Ring 2: Subset de regresión
       ┌────────────────────────────────────┐
       │  Promptfoo + llm-rubric sobre ~30. │
       │  En cada PR a main.                │
       │  Bloquea merge si threshold falla. │
       └────────────────────────────────────┘
                    │
                    ▼
       Ring 1: Smoke tests
       ┌────────────────────────────────────┐
       │  Vitest unit + asserts heurísticas │
       │  En cada commit.                   │
       │  No requiere LLM. Latencia <5s.    │
       └────────────────────────────────────┘
```

- **Ring 1:** validación de citas (Nivel 1), no llama al LLM. Latencia despreciable.
- **Ring 2:** ~30 casos de eval set de PR. Llama al LLM pero acotado. Costo: ~5 centavos por PR.
- **Ring 3:** eval set completo. Llama mucho al LLM. Costo: 1-5 USD por corrida. Solo en nightly o pre-release.

> **No empieces con Ring 3.** Empieza con Ring 1 (validación de citas, lo que hicimos en S11.2). Suma Ring 2 cuando el equipo está a 2-3 PR/día. Suma Ring 3 cuando tienes un eval set maduro y stakeholders que piden números.

### 4.7. Mantenimiento del eval set

El eval set **es código**. Vive en el repo, se versiona, se cubre por code review, se actualiza con cada feature.

Anti-patrones frecuentes:

- **Eval set de juguete.** 5 casos felices, ninguno OOD ni adversarial. Te da falsa confianza.
- **Eval set sin ground truth.** Casos sin `expected` claro vuelven los asserts `llm-rubric` muy ruidosos.
- **Eval set inmutable.** Nunca agregas casos nuevos. La cobertura se erosiona con cada feature.
- **Eval set duplicado de los datos de entrenamiento.** Si tu modelo (o tu corpus) ya vió esos casos exactos, las métricas mienten.

Buen mantenimiento: cada bug reportado por usuarios entra al eval set como caso nuevo. Cada feature nueva agrega 3-5 casos representativos. Auditoría trimestral del set para limpiar casos obsoletos.

## 5. Patrones y antipatrones

### Patrones

- **Empezar pequeño y crecer.** 30 casos > 0 casos. Después 100. Después 300.
- **Anti-patterns explícitos en el set.** Casos OOD, adversariales, ambiguos. Si solo tienes casos felices, mides poco.
- **Asserts en capas:** heurísticas baratas (contains, not-contains) + LLM rubric en los que importa.
- **Promptfoo en CI, RAGAS en nightly.** Cada framework para lo que está optimizado.
- **Cuando hay regresión, agregá el caso al eval set** y arregla. Así el set crece con realidad.

### Antipatrones

- **Mover el threshold del eval set hasta que pasen las pruebas.** Se llama "evaluación dirigida al éxito" y mata el sistema.
- **Solo `llm-rubric` para todo.** Caro, lento y depende del modelo judge. Mezcla con asserts deterministas.
- **Tests "happy path" sin OOD.** El sistema parece bueno hasta que un usuario rompe algo.
- **No registrar la versión del modelo en los resultados.** Cuando el proveedor actualiza, perdés trazabilidad de la baseline.
- **Eval set en un Notion o un Sheet.** No se versiona, no entra en review. Vive en el repo.

## 6. Conexión con TiendaPro

Esta sesión cierra el módulo M4 con la **suite de evals** del integrador. Cambios concretos:

- **Nuevo `code/proyecto-integrador/evals/eval-set.json`** con ~15 casos cubriendo catálogo / OOD / adversariales.
- **Nuevo `code/proyecto-integrador/evals/promptfoo.yaml`** + script TS que llama al pipeline RAG.
- **Nuevo `code/proyecto-integrador/evals/run-pipeline.ts`** que expone el pipeline al runner de Promptfoo.
- **Nuevo script** `pnpm test:evals` que dispara Promptfoo sobre el eval set.
- **Opcional:** un script Python `evals/ragas-eval.py` con las 4 métricas RAGAS para el subset.

Esto deja al integrador con **smoke tests Ring 1** (los unit del Nivel 1 de validación de citas que ya existen) y **Ring 2 Promptfoo** sobre ~15 casos. Ring 3 RAGAS queda como demo Python opcional.

## 7. Resumen

Tres ideas para llevarte:

1. **Sin evals no hay producción.** "Funciona en mi máquina" no escala. Eval set es código, vive en el repo, se actualiza con cada cambio.
2. **Tres rings de evals.** Smoke tests baratos en cada commit, regression set en cada PR, eval profundo en nightly. No hagas todo en todos lados.
3. **Faithfulness + Recall@K son las dos métricas que importan más.** Faithfulness mide alucinación. Recall@K mide retrieval. Si una está mal, sabes dónde está el problema.

## 8. Preguntas de auto-evaluación

1. Tu eval set tiene 30 casos, 28 son del catálogo (happy path). Recall@5 = 0.95, faithfulness = 0.91. ¿Por qué tu sistema podría estar peor de lo que indican estas métricas?
2. Diferencia operativa entre **answer relevance** y **faithfulness**. Da un ejemplo concreto donde las dos diverjan.
3. Decides correr Promptfoo en cada PR pero RAGAS solo en nightly. Justifica con tres argumentos técnicos.
4. Tu sistema falla cuando el usuario pregunta por un producto que existe en el catálogo pero está en una categoría poco frecuente. Diseña un caso de eval que detecte este fallo y di qué métrica capturará el problema.
5. El proveedor actualiza Gemini Flash a una versión nueva. Faithfulness baja del 0.92 al 0.81 sin que tú cambiaras nada. ¿Qué tres acciones tomas en orden de prioridad?
6. Tu equipo propone aumentar el eval set de 30 a 1000 casos. Da dos argumentos a favor y dos en contra del salto directo (sin pasar por 100 casos).

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → eval set + Promptfoo sobre el integrador + script RAGAS opcional.

**Cierre del módulo:** después de S11.3 hacemos el commit `feat(proyecto-integrador): cierra Módulo 4` y el tag `proyecto-m4`.
