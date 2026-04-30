# Sesión 11.2 — Ejercicios

> **Tiempo estimado:** ~45 min total. Tres demos sobre el catálogo + cambios al proyecto integrador (swap del asistente al pipeline RAG real con citas y validación). Scripts en [`code/m04-rag/sesion-11.2/`](../../../../code/m04-rag/sesion-11.2/).

---

## Setup base

Mismo setup que S09/S10/S11.1.

```bash
docker compose up -d postgres
pnpm install
pnpm --filter @curso-ai/m03-sesion-08 setup-schema
pnpm --filter @curso-ai/m03-sesion-08 ingest-catalog
```

---

## 1. Ejercicio guiado: citas verificadas con structured output

**Objetivo:** ver cómo `generateObject` + zod garantiza que cada respuesta del LLM venga con citas estructuradas, y cómo validarlas contra el contexto recuperado.

### 1.1. Probarlo

```bash
pnpm --filter @curso-ai/m04-sesion-11.2 citas-verificadas
```

El script:

1. Hace retrieval top-3 sobre una query.
2. Llama al LLM con un schema `{ answer: string, citations: { source_id, claim }[] }`.
3. Valida que cada `source_id` citado esté en el contexto recuperado.
4. Imprime: respuesta + citas + flag de validación.

### 1.2. Salida esperada (forma)

```
Query: "¿qué mochila me recomiendan para senderismo de un día?"

Contexto recuperado:
  TP-MOCH-01, TP-MOCH-03, TP-MOCH-02

Respuesta estructurada:
  answer: "Para un día de senderismo recomendamos la Mochila Trekker 30L
           (TP-MOCH-01) por su capacidad y espalda ventilada."
  citations:
    [TP-MOCH-01] Mochila Trekker 30L con espalda ventilada para 1-2 días

Validación:
  ✓ TP-MOCH-01 está en el contexto recuperado.
  Resultado: respuesta válida.
```

### 1.3. Para revisar

- En `src/01-citas-verificadas.ts`, fíjate cómo se define el schema con zod y cómo se pasa a `generateObject`.
- Cambia la query a algo OOD ("¿venden raquetas de tenis?") y observa el comportamiento. El sistema debería responder vacío y NO inventar citas.

---

## 2. Ejercicio guiado: faithfulness check programático (LLM judge mini)

**Objetivo:** implementar un faithfulness check liviano que detecta cuando una respuesta afirma cosas no presentes en el contexto.

### 2.1. Probarlo

```bash
pnpm --filter @curso-ai/m04-sesion-11.2 faithfulness-check
```

El script ejecuta dos casos:

- **Caso A:** una respuesta fiel (toda la info está en el contexto).
- **Caso B:** una respuesta inventada (afirma un dato que no está en el contexto, ejemplo "incluye un poncho gratis").

Para cada caso, llama a un LLM judge que evalúa si la respuesta está fundamentada y devuelve `{ faithful: boolean, reasoning: string }`.

### 2.2. Salida esperada (forma)

```
Caso A — respuesta fiel:
  Respuesta: "La Mochila Trekker 30L (TP-MOCH-01) tiene espalda ventilada y bolsillo para hidratación."
  Judge: { faithful: true, reasoning: "Todos los claims están en la descripción del producto." }

Caso B — respuesta inventada:
  Respuesta: "La Mochila Trekker 30L (TP-MOCH-01) tiene espalda ventilada e incluye un poncho gratis."
  Judge: { faithful: false, reasoning: "La afirmación 'incluye un poncho gratis' no está presente en el contexto." }
```

### 2.3. Para reflexionar

- El judge usa el mismo modelo (Gemini Flash) que la generación. En producción, lo ideal es usar un modelo MÁS capaz como judge (Gemini Pro, Claude Sonnet) para evitar el sesgo de "el modelo se aprueba a sí mismo".
- Este check vive **fuera del path crítico** en producción: se corre en CI y en monitoreo nocturno, no en cada respuesta al usuario (latencia + costo).

---

## 3. Ejercicio guiado: simulación de migración de modelo de embeddings

**Objetivo:** ver el patrón dual-write + switch + GC sin necesidad de un segundo modelo real (la migración se simula con la misma versión, marcando v1 vs v2 en el schema).

### 3.1. Probarlo

```bash
pnpm --filter @curso-ai/m04-sesion-11.2 index-migration
```

El script:

1. Verifica el estado actual: `embedding_version=1`.
2. Hace un dual-write: agrega rows con `embedding_version=2` (mismo embedding, solo cambia la columna).
3. Compara el resultado de una query con `version=1` vs `version=2` (deberían ser idénticos en este caso).
4. Hace GC: borra los rows con `embedding_version=1`.
5. Verifica que las queries siguen funcionando con `version=2`.

### 3.2. Salida esperada

```
Estado inicial: 12 rows con embedding_version=1.

Dual-write: insertando 12 rows con embedding_version=2...
Estado intermedio: 12 rows v1 + 12 rows v2 (24 total).

Query con version=1: TP-MOCH-01, TP-MOCH-03, TP-MOCH-02
Query con version=2: TP-MOCH-01, TP-MOCH-03, TP-MOCH-02
✓ Resultados consistentes (esperado: en migración real con modelo nuevo, los resultados serían distintos).

GC: borrando rows con embedding_version=1...
Estado final: 12 rows con embedding_version=2.

✓ La aplicación ahora lee version=2 sin downtime.
```

### 3.3. Para revisar

- En migración real, los resultados del paso 3 SÍ difieren. La idea es comparar y decidir si el modelo nuevo da mejor recall antes del switch atómico.
- El smoke test que **no incluimos** acá pero deberías hacer en producción: medir Recall@5 en tu eval set con v1 y con v2 ANTES de hacer el switch.

---

## 4. Cambio en el proyecto integrador (TiendaPro)

Este es el cambio importante de S11.2. El asistente conversacional pasa de `findProducts` keyword (M2) al pipeline RAG real.

### 4.1. Qué cambia

- **Nuevo módulo:** `code/proyecto-integrador/src/rag/pipeline.ts` con `runRagPipeline(query)` que devuelve `{ answer, citations[] }`.
- **Modificación:** `code/proyecto-integrador/src/index.ts` ahora llama a `runRagPipeline` cuando el intent es `consulta_catalogo`.
- **Validación de citas** post-respuesta: si el LLM cita un id inexistente, se descarta y se hace retry con feedback.
- **Tests:** `__tests__/rag.test.ts` con casos del catálogo + validación de citas.

### 4.2. Probarlo

Asegúrate de que el catálogo está indexado en pgvector:

```bash
pnpm --filter @curso-ai/proyecto-integrador index-catalog
```

Corre el asistente:

```bash
pnpm --filter @curso-ai/proyecto-integrador dev
```

Pregúntale algo del catálogo:

```
> ¿qué mochilas tienen para senderismo?

Para senderismo te recomendamos la Mochila Trekker 30L (TP-MOCH-01),
ergonómica con espalda ventilada e ideal para 1-2 días, y la Mochila
Summit 65L (TP-MOCH-02) si planeas travesías de 4-7 días con sistema
de carga ajustable.
```

Las citas inline (TP-MOCH-01, TP-MOCH-02) son **verificadas contra el contexto** antes de devolver al usuario.

### 4.3. Tests de regresión

```bash
pnpm --filter @curso-ai/proyecto-integrador test:rag
```

El test suite valida:
- Cada respuesta sobre catálogo incluye al menos una cita.
- Cada cita corresponde a un producto existente.
- Queries OOD obtienen "no tengo información" en lugar de invención.

---

## Bonus (opcional)

1. **Faithfulness en el path crítico.** Modifica `pipeline.ts` para que cada respuesta se valide con el LLM judge antes de devolverla. Mide latencia adicional. ¿Vale la pena?
2. **Cita por claim.** Cambia el schema a `{ claims: { text, source_id }[] }` para citar **cada afirmación individual**, no solo IDs en bloque. Compara la calidad y el costo.
3. **Sync index real.** Modifica el JSON del catálogo (cambia una descripción, agrega un producto nuevo, borra otro). Crea un script `sync-index.ts` que aplique los deltas a pgvector.

---

**Próxima sesión:** [`S11.3 — Evaluación con RAGAS y Promptfoo`](../sesion-11.3-evaluacion-ragas-promptfoo/) → suite de evals automatizada que mide todo lo que armaste.
