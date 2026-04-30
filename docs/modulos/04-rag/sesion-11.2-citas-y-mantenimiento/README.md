# Sesión 11.2 — Citas, control de alucinaciones y mantenimiento del índice

> **Módulo:** 4 — Arquitectura RAG · **Duración estimada:** 1.5h (~45 min lectura + ~45 min práctica) · **Formato:** 60% teoría / 40% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión podrás:

- Diseñar un sistema de **citas verificables**: cómo se piden, cómo se extraen, cómo se validan contra el contexto recuperado.
- Implementar **faithfulness checks programáticos** que detectan alucinación grounded antes de devolver la respuesta al usuario.
- Operar el **mantenimiento del índice** ante cambios de modelo de embeddings: dual-write, switch atómico, garbage collection.
- Reconocer cuándo un índice está **stale** y necesita refresh (modelo nuevo, corpus actualizado, schema migrado).
- Conectar el pipeline RAG completo al **proyecto integrador** y dejar el asistente respondiendo sobre el catálogo real, con citas y control de alucinaciones.

## 2. Prerequisitos

- **S09, S10 y S11.1 completas.** Pipeline RAG con retrieval + reranking + augmentación funcionando sobre el catálogo.
- **El proyecto integrador** con el retriever pgvector instalado (M3) y el asistente conversacional (M2). En esta sesión se conectan.

## 3. Conceptos clave

- **Cita:** referencia explícita en la respuesta a la(s) fuente(s) que la fundamenta. Formato típico: id del documento entre paréntesis o brackets.
- **Citation extraction:** parsing de la respuesta del LLM para identificar qué fuentes citó.
- **Citation validation:** chequeo de que cada cita corresponde a una fuente que efectivamente estuvo en el contexto.
- **Faithfulness (groundedness):** propiedad de una respuesta que afirma sólo cosas presentes en el contexto. Métrica primaria contra alucinación grounded.
- **LLM judge:** patrón donde se usa un LLM (idealmente más capaz que el generador) para evaluar la fidelidad de una respuesta contra su contexto.
- **Schema migration de embeddings:** cambio del modelo, dimensión o versión que requiere re-indexar el corpus.
- **Dual-write:** durante la migración, escribir en ambos schemas (viejo y nuevo) para que la app pueda hacer rollback sin pérdida.
- **Stale index:** un índice cuyas referencias no reflejan el estado actual del corpus (productos borrados, descripciones cambiadas, modelo viejo).

## 4. Teoría

### 4.1. Por qué las citas son obligatorias en producción

Sin citas, una respuesta de un sistema RAG es **indistinguible de una alucinación**. El usuario tiene que confiar a ciegas. Tres consecuencias prácticas:

1. **No podes auditar.** Cuando un usuario reporta "esta respuesta es incorrecta", no sabes si el bug está en el retrieval o en la generación.
2. **No puedes hacer eval.** Las métricas de faithfulness y context precision necesitan saber qué fuentes apoyan qué claims.
3. **No puedes ofrecer trazabilidad.** En contextos regulados (finanzas, salud, legal), citar la fuente no es una mejora estética — es un requisito legal.

> **Regla:** todo sistema RAG en producción debe poder responder, ante cualquier respuesta dada, "¿de qué documentos salió esto?". Si no puede, no está listo para producción.

### 4.2. Cómo se piden citas en el prompt

Hay tres formatos comunes:

#### Formato A — IDs inline entre paréntesis

```
Te recomendamos la Mochila Trail (TP-MOCH-01), ideal para senderismo
de 1 a 2 días por su capacidad de 30L.
```

- **Pros:** humano-friendly, fácil parsing con regex (`/\(TP-[A-Z]+-\d+\)/g`).
- **Contras:** el LLM puede confundirse y citar IDs que vio en el contexto pero no apoyan la afirmación específica.

#### Formato B — Footnotes

```
Te recomendamos la Mochila Trail [1], ideal para senderismo
de 1 a 2 días por su capacidad de 30L.

Fuentes:
[1] TP-MOCH-01 — Mochila Trekker 30L
```

- **Pros:** lectura fluida, separación clara entre respuesta y fuentes.
- **Contras:** parsing un poco más complejo, requiere instrucciones más estrictas.

#### Formato C — Structured output

```json
{
  "answer": "Te recomendamos la Mochila Trekker 30L, ideal para senderismo de 1 a 2 días.",
  "citations": [
    { "claim": "ideal para senderismo de 1 a 2 días", "source_id": "TP-MOCH-01" }
  ]
}
```

- **Pros:** máxima trazabilidad por claim, parsing trivial, validable con zod.
- **Contras:** el LLM debe seguir el schema (zod + `generateObject` lo facilita), latencia ligeramente mayor.

> **Default profesional para asistentes conversacionales:** formato A (IDs inline) por ergonomía. **Default para sistemas regulados:** formato C (structured) por trazabilidad estricta.

### 4.3. Citation validation: tres niveles

Una cita en el output **no garantiza** que la afirmación sea fiel. Validar requiere comparar contra el contexto recuperado.

#### Nivel 1: el ID citado existe en el contexto

```typescript
const citedIds = extractIds(response);  // ["TP-MOCH-01", "TP-MOCH-99"]
const contextIds = chunks.map((c) => c.id);
const invalid = citedIds.filter((id) => !contextIds.includes(id));
if (invalid.length > 0) {
  // El LLM citó un ID que no estaba en el contexto. Es una invención.
}
```

Es el chequeo **mínimo viable**. Detecta el caso obvio: el LLM inventó un ID que no existe.

#### Nivel 2: el claim coincide con el contenido del documento citado

Más sofisticado. Para cada `(claim, source_id)`, verificas si la afirmación del claim está soportada por el texto del documento `source_id`. Implementaciones:

- **Heurísticas:** keywords del claim presentes en el documento (rápido, falsos positivos).
- **NLI (Natural Language Inference):** modelo que clasifica `entailment | neutral | contradiction` (más preciso, requiere modelo adicional).
- **LLM judge:** un segundo LLM evalúa si el documento apoya el claim (caro pero alta calidad).

#### Nivel 3: la respuesta completa es fiel al contexto

La métrica RAGAS de **faithfulness**: descomponer la respuesta en claims atómicos, validar cada claim contra el contexto. Score = % de claims fundamentados.

**Para esta sesión nos quedamos en niveles 1-2.** Faithfulness con RAGAS entra en S11.3.

### 4.4. Control de alucinaciones: defensa en capas

Tres capas, cada una más cara que la anterior:

#### Capa 1: prompt engineering (gratis, primer filtro)

- "No inventes datos que no estén en el contexto."
- "Cita el id de cada producto que menciones."
- "Si el contexto no contiene la respuesta, dí: 'No tengo información sobre eso'."
- Temperature baja (0.0–0.3).

Esto reduce alucinación entre un 30% y 60% según el modelo. Lo implementaste ya en S09.

#### Capa 2: structured output (barato, gran impacto)

Forzar al LLM a devolver `{ answer, citations[] }` con zod schema garantiza que **siempre haya citas presentes y bien formateadas**. Sin esto, el LLM puede "olvidarse" de citar bajo presión de longitud o complejidad de la pregunta.

#### Capa 3: post-validation programática (medio, cierre)

Después de recibir la respuesta:

1. **Validate IDs:** todos los IDs citados existen en el contexto recuperado (Nivel 1 de §4.3).
2. **Heuristic checks:** la respuesta no menciona números/cantidades que no estén en el contexto (precios, tallas, plazos).
3. **Reject + retry:** si falla, descartá la respuesta y volvé a pedirle al LLM con feedback explícito.

```typescript
const result = await ragPipeline(query);
const validated = validateCitations(result, chunks);
if (!validated.ok) {
  // Retry con system prompt enriquecido: "intentaste citar TP-MOCH-99 que no existe"
  return retryWithFeedback(query, validated.errors);
}
return result;
```

#### Capa 4: LLM judge (caro, máxima precisión)

Un segundo LLM evalúa si la respuesta es fiel al contexto. Esto se usa típicamente **fuera del path crítico** (en eval sets, monitoreo offline) por costo. Lo profundizamos en S11.3 con RAGAS.

> **Combinación recomendada para producción:** capas 1 + 2 + 3 en el path crítico. Capa 4 en monitoreo nocturno y CI.

### 4.5. Mantenimiento del índice ante cambio de modelo

Esto es la realidad: **vas a cambiar el modelo de embeddings**. Razones típicas:

- Sale uno nuevo con mejor recall en tu dominio.
- El proveedor sube precios y bajas a uno open-source.
- Cambias dimensión (768 → 1536) buscando precisión.
- Compliance te obliga a salir del proveedor cloud.

Cualquier cambio invalida el índice existente. Reindexar 1M de documentos puede tomar horas y costar dinero. **Hacerlo sin downtime** requiere planificación.

#### El patrón canónico: dual-write

```
                        ┌──────────────────────┐
                        │   App de producción  │
                        │   (lee modelo activo)│
                        └─────────┬────────────┘
                                  │
       ┌──────────────────────────┴───────────────────────────┐
       │                                                      │
       ▼                                                      ▼
┌──────────────┐                                     ┌──────────────┐
│ index_v1     │  ← versión actual                   │ index_v2     │  ← versión nueva
│ (modelo old) │                                     │ (modelo new) │
└──────────────┘                                     └──────────────┘
```

Pasos:

1. **Migración del schema.** Agregas columnas nuevas (`embedding_v2 vector(1536)`, `embedding_model_v2 text`, etc.) o un schema separado. Sin tocar el viejo.
2. **Re-ingest async.** Script que pobla las columnas nuevas con embeddings del modelo nuevo. Puede tardar horas. Mientras tanto, la app sigue leyendo las viejas.
3. **Smoke test.** Con un pool de queries conocidas, comparas resultados v1 vs v2. ¿Recall@K mejora? ¿Latencia es aceptable? ¿Algún test de regresión rompe?
4. **Switch atómico.** Cambias la variable `EMBEDDING_VERSION` en la app de v1 a v2. La app empieza a embedear queries con el modelo nuevo y leer la columna nueva. Fácil rollback: revierte la variable.
5. **Garbage collection.** Después de un período de safety (días/semanas), eliminás las columnas viejas.

#### Versionado obligatorio en el schema

Esto ya lo viste en S08:

```sql
embedding_model    TEXT NOT NULL,   -- 'gemini-embedding-001'
embedding_version  INT  NOT NULL,   -- 1, 2, 3, ...
```

Sin estas columnas, las migraciones son imposibles **sin downtime**. Es el patrón crítico que hace que todo lo demás funcione.

#### Anti-patrones

- **Sobrescribir embeddings in-place.** Durante la ventana de re-ingest, queries devuelven mezcla de modelos viejos y nuevos. Resultado: ranking incoherente.
- **No filtrar por `embedding_model + embedding_version` en cada query.** Después de la migración, si te quedan rows del modelo viejo y no las filtras, te las trae mezcladas.
- **Migrar sin smoke test.** Cambiar de modelo "porque era más nuevo" sin medir es perder calidad sin saberlo.

### 4.6. Stale index: cuando los datos del corpus cambian

Otra fuente de degradación del retrieval: el corpus cambió pero el índice no.

#### Tres tipos de staleness

| Tipo | Ejemplo | Solución |
|------|---------|----------|
| Documentos **borrados** del corpus | Producto descontinuado, FAQ retirada | Hard delete del row + del embedding |
| Documentos **modificados** | Descripción actualizada, política cambia | Re-embed solo de los rows afectados |
| Documentos **nuevos** | Producto nuevo en catálogo | Insert + embed del row nuevo |

#### Patrón operativo

- **CDC (Change Data Capture)** sobre la tabla canónica. Cada cambio dispara un trigger o un evento.
- **Worker async** que consume los eventos y actualiza el índice vectorial.
- **Reconciliación periódica** (diaria/semanal) que compara el corpus con el índice y corrige drift.

En el integrador esto se simula simple: un script `sync-index.ts` que compara `code/proyecto-integrador/data/catalog.json` con `products` en pgvector y aplica los deltas.

### 4.7. Aterrizaje en el integrador

Hasta ahora el integrador estaba dividido:

- M2: asistente conversacional con `findProducts` keyword. Funciona pero es primitivo.
- M3: retriever pgvector indexado. Funcional pero **el chat no lo usaba**.

En S11.2 hacemos el swap:

```
Usuario → Intent classifier (M2, sigue igual)
   │
   ├─ intent = "consulta_catalogo" → RAG pipeline (NUEVO)
   │     ├─ retrieve (pgvector dense)
   │     ├─ rerank (LLM listwise)
   │     └─ generate con citas + validación
   │
   ├─ intent = "consulta_pedido" → mock M2 (sigue igual)
   ├─ intent = "consulta_politica" → mock M2 (sigue igual)
   └─ intent = "saludo / fuera_alcance" → mock M2 (sigue igual)
```

**Decisiones aplicadas:**

- **Pipeline simple por defecto.** Solo dense + rerank listwise + citas inline. Hybrid + HyDE + MMR quedan como hipótesis a validar con métricas en S11.3.
- **Citas obligatorias** con structured output (`{ answer, citations[] }`) y validación de que cada `source_id` esté en el contexto.
- **Fallback al M2.** Si el retrieval devuelve vacío después del threshold, el sistema responde "no tengo información" en lugar de caer al keyword `findProducts`. La razón: el threshold es deliberado; "no sé" es la respuesta correcta.
- **Tests de regresión.** El test suite del integrador se amplía con casos donde se valida que las citas existen y son válidas.

## 5. Patrones y antipatrones

### Patrones

- **Citas obligatorias y validadas.** Cada respuesta del sistema RAG debe ser auditable.
- **Structured output con zod** para garantizar formato de citas consistente.
- **Defensa en capas contra alucinación:** prompt + structured + post-validation.
- **Versionado del modelo y la versión** en el schema. Sin esto, las migraciones son imposibles.
- **Dual-write durante migraciones.** Permite rollback sin pérdida.
- **Reconciliación periódica** del índice contra el corpus canónico.

### Antipatrones

- **Citas "por las dudas" sin validación.** El LLM cita IDs inventados; nadie verifica.
- **Sobrescribir embeddings in-place** durante la migración. Resultados garbage durante la ventana.
- **Mezclar versiones del modelo en una sola tabla** sin filtro `WHERE embedding_version = X`. Espacios vectoriales distintos comparados como si fueran iguales.
- **Ignorar el corpus stale.** Productos borrados que siguen apareciendo en respuestas son un bug de datos, no del retriever.
- **Reintentar indefinidamente cuando la validación falla.** Después de N retries, devolvé "no tengo información" en lugar de loop infinito.

## 6. Conexión con TiendaPro

**Esta es la sesión donde el integrador adopta RAG real.** Cambios concretos en `code/proyecto-integrador/`:

- **Nuevo módulo `src/rag/pipeline.ts`** con `runRagPipeline(query)` que devuelve `{ answer, citations[] }`.
- **Modificación de `src/index.ts`** para que cuando el intent classifier devuelva `consulta_catalogo`, el flow llame a `runRagPipeline` en lugar de `findProducts` keyword.
- **Validación de citas** post-respuesta (Nivel 1: IDs en contexto).
- **Tests de regresión** para que cada cambio al pipeline se mida automáticamente.

`findProducts` keyword del M2 se mantiene como utility para tests viejos pero **no se llama desde el flow principal**.

## 7. Resumen

Tres ideas para llevarte:

1. **Sin citas no hay producción.** Todo sistema RAG en serio debe poder explicar de dónde salió cada afirmación. Sin esto, no puedes auditar, evaluar ni cumplir compliance.
2. **Defensa en capas contra alucinación.** Prompt + structured output + post-validation. Cada capa cuesta poco pero el efecto compuesto es grande.
3. **El índice se mantiene, no se construye una vez.** Cambios de modelo, corpus que cambia, productos que se agregan. Diseñá el sistema para que reindexar parcialmente sea trivial.

## 8. Preguntas de auto-evaluación

1. Tu sistema RAG cita IDs que no están en el contexto. ¿En qué nivel de validación lo detectas? ¿Qué haces cuando lo detectas? Da las dos opciones (falla rápida vs retry con feedback).
2. Migrar de `gemini-embedding-001` (768D) a un modelo de 1536D. Lista los 5 pasos del dual-write y qué pasa si saltas cada uno.
3. Tu integrador responde "no tengo información sobre la mochila azul XYZ" cuando el catálogo SÍ tiene esa mochila. ¿Es un bug de retrieval, de generation o de validation? ¿Cómo lo confirmás?
4. Tu equipo propone meter las citas como JSON estructurado (formato C). El producto manager prefiere las inline (formato A) por estética. Da tres argumentos técnicos para defender el formato C en un sistema regulado.
5. Tu eval set detecta que después de cambiar el modelo de embeddings, Recall@5 bajó del 0.85 al 0.72. La migración ya está en producción. ¿Tres acciones inmediatas en orden de prioridad?
6. Tu corpus de catálogo se actualiza diariamente (productos nuevos, precios). ¿Qué patrón de mantenimiento del índice elegirías y por qué? ¿Qué métricas operacionales monitoreas?

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 3 demos prácticos + cambios al integrador.

**Próxima sesión:** [`S11.3 — Evaluación con RAGAS y Promptfoo`](../sesion-11.3-evaluacion-ragas-promptfoo/) → cierra el módulo con suite de evals automatizada.
