# Sesión 09 — Ejercicios

> **Tiempo estimado:** ~65 min total. Cuatro demos ejecutables que muestran el pipeline RAG completo sobre el catálogo de TiendaPro ya indexado en pgvector. Scripts en [`code/m04-rag/sesion-09/`](../../../../code/m04-rag/sesion-09/).

---

## Setup base

Estos ejercicios reutilizan el corpus de productos indexado en S08. Si no lo tienes cargado:

```bash
docker compose up -d postgres
pnpm install
pnpm --filter @curso-ai/m03-sesion-08 setup-schema
pnpm --filter @curso-ai/m03-sesion-08 ingest-catalog
```

Verifica que hay vectores en pgvector:

```bash
docker compose exec postgres psql -U curso -d curso_ai -c "SELECT count(*) FROM products;"
```

`.env` requerido (en la raíz del repo):

```bash
GOOGLE_GENERATIVE_AI_API_KEY=tu_api_key
POSTGRES_USER=curso
POSTGRES_PASSWORD=curso
POSTGRES_DB=curso_ai
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

> **Nota sobre el LLM:** los demos usan `gemini-2.5-flash` por default (free tier amplio). Si quieres correr con Ollama local, exporta `DEFAULT_LLM_PROVIDER=ollama` antes de los scripts. La capa de abstracción en `@curso-ai/llm` se ocupa del resto.

---

## 1. Ejercicio guiado: RAG ingenuo end-to-end

**Objetivo:** ver el pipeline completo en ~80 líneas de TS. Embedding de la query → top-K en pgvector → prompt aumentado → respuesta del LLM con citas.

### 1.1. Probarlo

```bash
pnpm --filter @curso-ai/m04-sesion-09 naive-rag
```

El script:

1. Toma una pregunta hardcodeada del usuario.
2. Llama al embedder (Gemini) sobre la pregunta.
3. Hace kNN en pgvector con K=3 y threshold=0.55.
4. Construye un prompt con el system de RAG + los chunks recuperados.
5. Llama al LLM y muestra la respuesta.

### 1.2. Salida esperada (resumida)

```
Pregunta: "¿qué mochila me recomiendas para una caminata de 3 días?"

Top-K recuperado (k=3, threshold=0.55):
  [1] P-005 — Mochila trekking 50L           (0.71)
  [2] P-002 — Mochila ligera 25L              (0.62)
  [3] P-009 — Mochila de viaje 40L            (0.58)

Respuesta del LLM:
  Para una caminata de 3 días, la opción más adecuada del catálogo es
  la Mochila trekking 50L (P-005), pensada para travesías de varios
  días con capacidad de carga suficiente. Si vas con equipo mínimo,
  la Mochila de viaje 40L (P-009) también puede servir...
```

### 1.3. Para revisar

Abre [`src/01-naive-rag.ts`](../../../../code/m04-rag/sesion-09/src/01-naive-rag.ts) e identifica las tres etapas del pipeline. Pregúntate:

- ¿Qué pasaría si remuevo el threshold? Cambia `THRESHOLD` a `0` y vuelve a correr.
- ¿Qué pasaría si paso K=20? Cambia `K` y observa la respuesta y el tiempo de latencia.
- ¿Qué pasa si la query es claramente OOD? Cambia la pregunta a `"¿cuánto cuesta un viaje a Marte?"` y ejecuta.

---

## 2. Ejercicio guiado: RAG vs no-RAG (cuándo ayuda y cuándo no)

**Objetivo:** sentir en la práctica que RAG no es magia universal. Hay queries donde aporta enormemente, otras donde es indiferente y algunas donde puede confundir.

### 2.1. Probarlo

```bash
pnpm --filter @curso-ai/m04-sesion-09 rag-vs-no-rag
```

El script ejecuta tres queries en dos modos cada una (con RAG y sin RAG) y muestra las respuestas lado a lado:

- **Query A — específica del catálogo:** "¿Tienen una linterna para acampar?"
- **Query B — general:** "¿Qué debo llevar en mi primer trekking?"
- **Query C — alucinable:** "¿Cuál es la garantía de la mochila azul XYZ-9999?"

### 2.2. Salida esperada (interpretación)

| Query | Sin RAG | Con RAG | Lectura |
|-------|---------|---------|---------|
| A | Respuesta genérica sobre linternas en general | Recomienda productos concretos del catálogo, con id | RAG aporta |
| B | Lista razonable de equipo de trekking | Misma lista, posiblemente menos completa porque el contexto sesga | RAG no aporta y puede restar |
| C | Inventa un producto y una garantía | Responde "no tengo información sobre ese producto en el catálogo" | RAG previene alucinación |

### 2.3. Para reflexionar

- En la query B, RAG **podría** empeorar la respuesta. ¿Por qué? Porque le pasamos contexto del catálogo (productos), pero la pregunta no es sobre productos, es sobre asesoramiento general. El contexto sesga la respuesta hacia los productos recuperados.
- ¿Cómo decidiría tu app cuándo usar RAG y cuándo no? Esto se llama **routing** y es un patrón completo. En este curso lo introducimos en S12 (agentes).

---

## 3. Ejercicio guiado: efecto cuantificable de top-K

**Objetivo:** medir el impacto de K en latencia, costo (tokens de input) y calidad de respuesta.

### 3.1. Probarlo

```bash
pnpm --filter @curso-ai/m04-sesion-09 top-k-tradeoffs
```

El script corre la misma query con K=1, K=3 y K=10, y para cada uno reporta:

- Tiempo total (retrieval + LLM).
- Tokens de input estimados.
- Tokens de output.
- La respuesta generada.

### 3.2. Salida esperada (forma)

```
Query: "¿Tienen mochilas para senderismo?"

K=1:
  Latencia total: 850 ms (retrieval 220 ms + LLM 630 ms)
  Tokens input ~280  · Tokens output ~95
  Respuesta: "Sí, contamos con la Mochila trekking 50L (P-005)..."

K=3:
  Latencia total: 1140 ms
  Tokens input ~520
  Respuesta: "Sí, tenemos varias opciones: P-005 (50L), P-002 (25L), P-009 (40L)..."

K=10:
  Latencia total: 1620 ms
  Tokens input ~1340
  Respuesta: "El catálogo incluye múltiples opciones de mochilas y bolsos..."
```

### 3.3. Para revisar

- Identifica el **codo** entre K=1 y K=10: ¿desde qué K dejas de ganar calidad y solo sumas costo?
- Las cifras de tokens son estimaciones (un tokenizer aproximado). En producción se mide con el tokenizer del modelo.
- En K=10, la respuesta puede volverse más vaga porque el LLM "promedia" sobre demasiadas opciones. Esto es **dilución del contexto**.

---

## 4. Ejercicio guiado: provocar los modos de fallar

**Objetivo:** reproducir a propósito los cinco modos de fallar del pipeline RAG y observar cómo se manifiestan.

### 4.1. Probarlo

```bash
pnpm --filter @curso-ai/m04-sesion-09 failure-modes
```

El script ejecuta cuatro escenarios:

- **Escenario A — Query OOD:** "¿Cuál es la capital de Marte?". El threshold filtra todo. El LLM, con buena instrucción, responde "no tengo información".
- **Escenario B — Threshold demasiado bajo:** misma query OOD, pero con threshold=0.0. El LLM recibe contexto irrelevante y demuestra cómo aparece la alucinación grounded.
- **Escenario C — Falso positivo del retriever:** una query cuya formulación matchea léxicamente con productos no relacionados al intent real ("envío rápido y barato" — el retrieval puede traer productos cuya descripción menciona "envío" sin ser sobre la política).
- **Escenario D — Recall bajo simulado:** restringimos K=1 sobre una pregunta amplia para mostrar cómo la respuesta se vuelve estrecha.

### 4.2. Salida esperada

```
=== A. Query OOD con threshold=0.55 ===
Top-K recuperado: vacío (todos los scores < 0.55).
Respuesta: "No tengo información sobre eso en el catálogo de TiendaPro."
✓ El sistema recupera vacío y el LLM responde correctamente.

=== B. Misma query con threshold=0.0 ===
Top-K recuperado: 3 productos con scores 0.18, 0.15, 0.12.
Respuesta: "[el LLM puede producir una respuesta inventada o confusa]"
✗ Bajar el threshold convirtió un "no sé" honesto en una alucinación.

=== C. Falso positivo del retriever ===
Top-K recuperado: productos cuyo texto incluye "envío" pero no responden la pregunta.
Respuesta: respuesta plausible pero incorrecta.
✗ El retriever falló (modo 2). Hybrid search + reranking lo arreglan (S10/S11).

=== D. K=1 sobre pregunta amplia ===
Top-K recuperado: 1 producto.
Respuesta: única opción mencionada, perdiendo alternativas relevantes.
✗ Recall bajo. Subir K + reranking es la solución.
```

### 4.3. Para reflexionar

- En el escenario B, el retriever no falló — todavía estaba devolviendo los menos malos. Falló la **decisión de no filtrar**. La línea entre "buen retrieval" y "buena política de retorno vacío" es operativa, no algorítmica.
- En los escenarios C y D, el problema está en el retrieval, no en el LLM. Los modos de fallar separan el debug en capas.

---

## Bonus (opcional): tu turno

1. **Cambia el system prompt.** En [`src/lib/rag.ts`](../../../../code/m04-rag/sesion-09/src/lib/rag.ts) está la plantilla del prompt RAG. Quita la línea de "no inventes datos" y ejecuta `failure-modes` de nuevo. ¿Cuánto se degrada?
2. **Calibra threshold a ojo.** Ejecuta `naive-rag` con thresholds 0.40, 0.55, 0.70, 0.85. ¿Para qué tipo de query cada uno tiene sentido?
3. **Añade una tercera pregunta a `02-rag-vs-no-rag`.** Inventa una donde RAG sea claramente perjudicial. Si no se te ocurre, prueba con preguntas que requieran razonamiento puro ("¿cuántos kilómetros recorro si camino 4 horas a 5 km/h?").
4. **Inspecciona los chunks.** Modifica `01-naive-rag` para que también imprima la `description` completa de cada chunk recuperado. Cuando una respuesta salga mal, lo primero que vas a hacer en producción es esto.

---

**Próxima sesión:** [`S10 — Técnicas avanzadas de recuperación`](../sesion-10-tecnicas-avanzadas-recuperacion/) → hybrid search (denso + BM25), query rewriting, HyDE, multi-query.
