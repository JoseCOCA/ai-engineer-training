# Sesión 11.1 — Ejercicios

> **Tiempo estimado:** ~30 min total. Tres demos sobre el catálogo de TiendaPro: LLM-as-reranker (listwise), context expansion con productos hermanos, y lost-in-the-middle (efecto del orden del contexto). Scripts en [`code/m04-rag/sesion-11.1/`](../../../../code/m04-rag/sesion-11.1/).

---

## Setup base

Mismo setup que S09/S10. Catálogo indexado en pgvector.

```bash
docker compose up -d postgres
pnpm install
pnpm --filter @curso-ai/m03-sesion-08 setup-schema
pnpm --filter @curso-ai/m03-sesion-08 ingest-catalog
```

`.env` con `GOOGLE_GENERATIVE_AI_API_KEY` y las variables de Postgres.

---

## 1. Ejercicio guiado: LLM como reranker (listwise)

**Objetivo:** ver cómo un segundo pase con LLM puede reordenar los top-15 de un retrieval ingenuo y mover el documento ideal del rank 6-10 al top-3.

### 1.1. Probarlo

```bash
pnpm --filter @curso-ai/m04-sesion-11.1 reranking
```

El script:

1. Hace un retrieval denso ingenuo top-15 sobre una query.
2. Le pide a Gemini Flash (en modo listwise, una sola llamada) que devuelva los IDs ordenados por relevancia.
3. Compara: top-5 ingenuo vs top-5 reranked.

### 1.2. Salida esperada (forma)

```
Query: "necesito botas que aguanten lluvia y barro"

Retrieval ingenuo top-15:
   1. TP-CALZ-02 (Zapatillas Run-Trail X)         (0.62)
   2. TP-ROPA-01 (Chaqueta Shell 3L)              (0.58)
   3. TP-CALZ-01 (Botas Trail Pro Mid)            (0.57)
   4. TP-MOCH-01 (Mochila Trekker 30L)            (0.41)
   ...

LLM reranking (listwise, ~700ms):
   1. TP-CALZ-01 (Botas Trail Pro Mid) ← subió de #3 a #1
   2. TP-CALZ-02 (Zapatillas Run-Trail X)
   3. TP-ROPA-01 (Chaqueta Shell 3L)

Comentario: el reranker entiende que la query pide BOTAS específicamente,
no zapatillas; y que la chaqueta no resuelve el pedido de calzado.
```

### 1.3. Para revisar

- Abre [`src/lib/rerank.ts`](../../../../code/m04-rag/sesion-11.1/src/lib/rerank.ts) y mira el prompt. Es listwise: una sola llamada con todos los chunks.
- Cambia el modelo del reranker a Pro (`GOOGLE_MODEL=gemini-2.5-pro`) y compara calidad. ¿La mejora justifica el costo?
- ¿Qué pasaría si pasas top-50 en lugar de top-15? Pruébalo. Cuándo el context window empieza a presionar.

---

## 2. Ejercicio guiado: context expansion (parent-document a nivel catálogo)

**Objetivo:** ver cómo enriquecer el contexto pasado al LLM con productos hermanos de la misma categoría mejora las recomendaciones.

### 2.1. Probarlo

```bash
pnpm --filter @curso-ai/m04-sesion-11.1 context-expansion
```

El script ejecuta dos modos sobre la misma query:

- **Modo A — chunk solo:** retrieve top-3, pasa esos 3 al LLM.
- **Modo B — chunk + hermanos:** retrieve top-3 y, para cada uno, suma 1-2 productos de la misma categoría como contexto adicional. El LLM ve más opciones para recomendar.

### 2.2. Salida esperada (forma)

```
Query: "¿qué me recomiendan para acampar 4 días con la familia?"

Modo A (top-3 solo):
  Contexto: TP-TIENDA-02, TP-MOCH-02, TP-COCINA-01
  Respuesta: "Te recomendamos la Tienda Familiar 4P (TP-TIENDA-02) y la
              Mochila Summit 65L (TP-MOCH-02) para llevar el equipo..."

Modo B (top-3 + hermanos):
  Contexto: TP-TIENDA-02, TP-TIENDA-01 (hermano),
            TP-MOCH-02, TP-MOCH-03 (hermano),
            TP-COCINA-01
  Respuesta: "Para 4 días con familia te recomendamos la Tienda Familiar 4P
              (TP-TIENDA-02) por su capacidad. Si prefieren algo más liviano,
              la Tienda 2P Ultra-Light (TP-TIENDA-01) puede combinarse con
              una segunda. Para cargar el equipo, la Mochila Summit 65L
              (TP-MOCH-02) o la urbana Daypack si solo necesitan cosas livianas..."

Coste: +tokens en el prompt (~30%), +pocos ms.
```

### 2.3. Para reflexionar

- En el modo B, el LLM puede comparar entre alternativas. Esto es exactamente lo que un asistente de e-commerce debería hacer.
- Pero **no toda expansion ayuda**: si los hermanos son muy distintos al chunk recuperado, agregas ruido. Mide en tu eval set si recall y faithfulness mejoran o solo subió el costo.

---

## 3. Ejercicio guiado: lost-in-the-middle

**Objetivo:** sentir empíricamente cómo el orden del contexto cambia la respuesta del LLM, aun cuando el contenido es idéntico.

### 3.1. Probarlo

```bash
pnpm --filter @curso-ai/m04-sesion-11.1 lost-middle
```

El script toma 7 chunks (con uno claramente relevante, marcado como "RELEVANTE") y los pasa al LLM en cuatro órdenes distintos:

- **Orden A — relevante al inicio (pos 1).**
- **Orden B — relevante al final (pos 7).**
- **Orden C — relevante al medio (pos 4).**
- **Orden D — U-shape: relevante al inicio, segundo más relevante al final, irrelevantes al medio.**

Por cada orden, se pregunta al LLM y se imprime la respuesta. La query y el chunk relevante son los mismos en los cuatro casos.

### 3.2. Salida esperada (forma)

```
Query: "¿Tienen una linterna recargable?"

Orden A (relevante en pos 1):
  Respuesta: "Sí, contamos con la Linterna Frontal Lumin 400 (TP-ACCS-01),
              recargable por USB con autonomía de 8h..."
  ✓ Encuentra el dato y responde correctamente.

Orden B (relevante en pos 7, último):
  Respuesta: "Sí, contamos con la Linterna Frontal Lumin 400 (TP-ACCS-01)..."
  ✓ También funciona — los extremos son fuertes.

Orden C (relevante en pos 4, medio):
  Respuesta: "[respuesta más vaga, posiblemente menciona linternas en general
              sin citar el id, o dice 'no tengo info']"
  ✗ El modelo se "perdió" la info en el medio.

Orden D (U-shape):
  Respuesta: "Sí, contamos con la Linterna Frontal Lumin 400..."
  ✓ U-shape recupera la atención del modelo.
```

### 3.3. Para reflexionar

- El efecto se acentúa con **más chunks**. Con 3 chunks no se nota; con 15-20 sí.
- En producción, **siempre reordenar después del reranking** y antes de pasar al LLM. Es una mejora gratis (no requiere modelo extra ni latencia).
- ¿En qué casos el orden NO importa tanto? Cuando el contexto entero es relevante (no hay distractores) y cabe holgado en el context window. Pero esto no se sabe sin medir.

---

## Bonus (opcional)

1. **Combina rerank + expansion + reorder.** Modifica `01-llm-reranking.ts` para que después del rerank: aplique context expansion sobre el top-3 y reordene los chunks finales en U-shape. Compara la respuesta contra el ingenuo de S09.
2. **Pointwise vs listwise.** Modifica `01-llm-reranking.ts` para que rerankee uno por uno (N llamadas paralelas, score 0-10 por chunk). Compara latencia, costo y calidad.
3. **Mide.** Construye 10 pares (query, doc_id_esperado). Calcula Recall@5 y MRR de: ingenuo, ingenuo + rerank, ingenuo + rerank + reorder. Anota la mejora por dólar/segundo.

---

**Próxima sesión:** [`S11.2 — Citas, control de alucinaciones y mantenimiento del índice`](../sesion-11.2-citas-y-mantenimiento/) → cierra el módulo + entra el swap del integrador a pgvector + reranking.
