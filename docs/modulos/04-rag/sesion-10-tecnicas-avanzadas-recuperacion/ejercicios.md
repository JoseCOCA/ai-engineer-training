# Sesión 10 — Ejercicios

> **Tiempo estimado:** ~65 min total. Cuatro demos sobre el catálogo de TiendaPro: hybrid search (denso + BM25 + RRF), query rewriting con LLM, HyDE y MMR. Scripts en [`code/m04-rag/sesion-10/`](../../../../code/m04-rag/sesion-10/).

---

## Setup base

Reutilizamos el corpus de S08 + S09. Si todavía no lo tienes cargado:

```bash
docker compose up -d postgres
pnpm install
pnpm --filter @curso-ai/m03-sesion-08 setup-schema
pnpm --filter @curso-ai/m03-sesion-08 ingest-catalog
```

Para hybrid search, agregamos una columna `tsvector` y un índice GIN al schema:

```bash
pnpm --filter @curso-ai/m04-sesion-10 setup-fts
```

`.env` (mismo que S09):

```bash
GOOGLE_GENERATIVE_AI_API_KEY=tu_api_key
POSTGRES_USER=curso
POSTGRES_PASSWORD=curso
POSTGRES_DB=curso_ai
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

> **Nota:** los scripts asumen que `setup-fts` ya corrió. Es idempotente — puedes correrlo varias veces sin error.

---

## 1. Ejercicio guiado: hybrid search (denso + BM25 + RRF)

**Objetivo:** ver el caso clásico donde el dense retrieval falla (query con término exacto) y hybrid lo resuelve.

### 1.1. Probarlo

```bash
pnpm --filter @curso-ai/m04-sesion-10 hybrid-search
```

El script ejecuta tres queries en tres modos cada una:

- **Solo denso** — kNN con embeddings (lo de S09).
- **Solo sparse** — BM25 con `ts_rank_cd` sobre el `tsvector`.
- **Hybrid** — RRF sobre los rankings denso y sparse.

Las queries:

- "tengo problemas con TP-MOCH-02" — incluye un id exacto.
- "quiero algo con membrana Vibram" — término técnico raro.
- "mochila para senderismo" — query semántica clásica.

### 1.2. Salida esperada (forma)

```
Query: "tengo problemas con TP-MOCH-02"
  Solo denso:   [TP-MOCH-03, TP-MOCH-01, TP-CALZ-01]   ← no encuentra el código
  Solo sparse:  [TP-MOCH-02, TP-MOCH-01, TP-MOCH-03]   ← encuentra el exacto
  Hybrid (RRF): [TP-MOCH-02, TP-MOCH-01, TP-MOCH-03]   ← lo correcto

Query: "mochila para senderismo"
  Solo denso:   [TP-MOCH-01, TP-MOCH-02, TP-MOCH-03]   ← bien
  Solo sparse:  [TP-MOCH-01, TP-MOCH-03, TP-CALZ-01]   ← decente
  Hybrid (RRF): [TP-MOCH-01, TP-MOCH-03, TP-MOCH-02]   ← mejor
```

### 1.3. Para revisar

Abre [`src/01-hybrid-search.ts`](../../../../code/m04-rag/sesion-10/src/01-hybrid-search.ts) y mira:

- Cómo se calcula el ranking sparse (`ts_rank_cd`).
- Cómo se calcula el dense (igual que S09).
- Cómo se aplica RRF en [`src/lib/rrf.ts`](../../../../code/m04-rag/sesion-10/src/lib/rrf.ts) — son ~15 líneas.

¿Qué pasaría si subes `k=60` a `k=10` en la fórmula RRF? Pruébalo, observa cómo se acentúan los rangos altos.

---

## 2. Ejercicio guiado: query rewriting (multi-query)

**Objetivo:** ver cómo un LLM cheap puede salvar queries cortas o ambiguas reescribiéndolas en variantes.

### 2.1. Probarlo

```bash
pnpm --filter @curso-ai/m04-sesion-10 query-rewriting
```

El script:

1. Toma una query "pobre" del usuario (ej: "algo grande para llevar cosas").
2. Llama a Gemini Flash con un prompt JSON que devuelve 3 variantes.
3. Hace dense retrieval con la original + las 3 variantes (4 búsquedas en paralelo).
4. Fusiona los 4 rankings con RRF.
5. Compara contra el retrieval original sin rewriting.

### 2.2. Salida esperada (forma)

```
Query original: "algo grande para llevar cosas"

Variantes generadas:
  [1] mochila grande de gran capacidad
  [2] mochila para cargar equipo o ropa de varios días
  [3] mochila técnica de gran volumen para travesías largas

Retrieval sin rewriting:
  [TP-MOCH-03, TP-MOCH-01, TP-MOCH-02]   ← Daypack 18L primero (dudoso)

Retrieval con multi-query + RRF:
  [TP-MOCH-02, TP-MOCH-01, TP-MOCH-03]   ← Summit 65L primero (correcto)

Coste: +1 LLM call (~620ms), 4 retrievals paralelos.
```

### 2.3. Para reflexionar

- Las variantes incluyen "jerga del dominio" (técnica, travesías). Esto es deliberado: el catálogo usa esa jerga, así que las variantes acercan la query al estilo del corpus. Es un primo cercano a HyDE.
- ¿Cuándo NO querrías hacer rewriting? Pregúntate qué pasa con queries muy específicas ("¿la TP-CALZ-02 viene en talla 42?"). El rewriting puede diluir la especificidad.

---

## 3. Ejercicio guiado: HyDE (Hypothetical Document Embeddings)

**Objetivo:** sentir el efecto del gap query↔documento y cómo HyDE lo cierra.

### 3.1. Probarlo

```bash
pnpm --filter @curso-ai/m04-sesion-10 hyde
```

El script ejecuta una query coloquial sobre un catálogo técnico, en dos modos:

- **Embedding directo** de la query.
- **HyDE**: el LLM escribe un párrafo "hipotético" como si fuera la descripción del producto ideal, embedea esa respuesta y hace kNN.

### 3.2. Salida esperada (forma)

```
Query: "necesito algo para no pasarme frío arriba en la montaña"

Modo A — Embedding directo de la query:
  Top-3: [TP-ROPA-01 (0.51), TP-ROPA-02 (0.49), TP-ACCS-01 (0.42)]
  Comentario: aparece la chaqueta y el forro pero el score es bajo.

Modo B — HyDE:
  Documento hipotético generado:
    "Chaqueta de tres capas impermeable y transpirable diseñada para
     condiciones de montaña, con capucha ajustable, costuras selladas
     y aislamiento térmico..."
  Top-3 con HyDE: [TP-ROPA-01 (0.78), TP-ROPA-02 (0.71), ...]
  Comentario: scores notablemente más altos. El espacio vectorial
  premia la cercanía al estilo del corpus.

Coste: +1 LLM call (~700ms).
```

### 3.3. Para reflexionar

- El "documento hipotético" puede contener detalles inventados (precio, color, marca). **No le pasamos al LLM final el documento hipotético** — solo lo usamos para encontrar los productos reales en pgvector.
- Si la query ya está en estilo de catálogo ("chaqueta impermeable transpirable mountain"), HyDE aporta poco. Pruébalo cambiando la `QUERY` en el script.

---

## 4. Ejercicio guiado: MMR para diversidad

**Objetivo:** observar el problema de "top-K homogéneo" y cómo MMR lo corrige.

### 4.1. Probarlo

```bash
pnpm --filter @curso-ai/m04-sesion-10 mmr
```

El script:

1. Hace kNN con K=10 sobre una query amplia ("equipamiento para acampar").
2. Devuelve el top-5 naive (los 5 más similares a la query).
3. Aplica MMR sobre los 10 candidatos con λ=0.7 y devuelve el top-5 diverso.
4. Imprime ambos para comparar.

### 4.2. Salida esperada (forma)

```
Query: "equipamiento para acampar"

Top-5 naive (ranking puro):
  [1] TP-TIENDA-01 — Tienda 2P Ultra-Light
  [2] TP-TIENDA-02 — Tienda Familiar 4P
  [3] TP-COCINA-01 — Hornillo Compact Gas
  [4] TP-MOCH-02  — Mochila Summit 65L
  [5] TP-ACCS-01  — Linterna Frontal Lumin 400

Top-5 con MMR (λ=0.7):
  [1] TP-TIENDA-01 — Tienda 2P Ultra-Light
  [2] TP-COCINA-01 — Hornillo Compact Gas
  [3] TP-MOCH-02  — Mochila Summit 65L
  [4] TP-ACCS-01  — Linterna Frontal Lumin 400
  [5] TP-CALZ-01  — Botas Trail Pro Mid

Diferencia: en MMR, las dos tiendas no aparecen ambas en el top-5.
La segunda tienda quedó relegada porque ya había una muy similar.
El usuario ve un kit más completo en lugar de "dos tiendas".
```

### 4.3. Para revisar

- Cambia `LAMBDA` a `1.0` y vuelve a correr. La salida debería ser idéntica al naive (MMR colapsa a top-K).
- Cambia `LAMBDA` a `0.0`. La salida ignora la query: solo busca diversidad. Útil para entender el efecto.
- En el caso de TiendaPro con N=12 productos los efectos son pequeños; con miles de productos en clusters densos, MMR cambia la experiencia notablemente.

---

## Bonus (opcional): combinar técnicas

1. **Hybrid + MMR.** Modifica `01-hybrid-search.ts` para que después del RRF aplique MMR. Devuelve top-5 diverso de un pool top-15.
2. **Rewriting + HyDE.** Por cada variante de query generada, aplica HyDE en lugar de embedear directo. Cuatro retrievals con cuatro documentos hipotéticos. Costo: 1 + 4 LLM calls. ¿Vale la pena para tu caso?
3. **Mide.** Escribe 10 pares (query, producto_id_esperado) sobre el catálogo de TiendaPro. Calcula Recall@5 con: ingenuo, hybrid, hybrid + rewriting, hybrid + MMR. Anota cuál sube más por dólar/segundo.

---

**Próxima sesión:** [`S11.1 — Augmentación y combinación de contexto recuperado`](../sesion-11.1-augmentacion-contexto/) → reranking con cross-encoder, parent-document, context expansion.
