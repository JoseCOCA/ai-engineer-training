# Sesión 08 — Bases de datos vectoriales

> **Módulo:** 3 — Embeddings y búsqueda vectorial · **Duración estimada:** 2h (~50 min lectura + ~70 min práctica) · **Formato:** 50% teoría / 50% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión podrás:

- Explicar **qué resuelve una base de datos vectorial** que un Postgres "normal" no, y cuándo justifica el costo operativo.
- Distinguir las **familias de índices ANN** (Flat, IVF, HNSW, PQ) y elegir la adecuada según volumen, recall y latencia.
- Operar **pgvector** en profundidad: extensión, tipo `vector(N)`, operadores de distancia, índices HNSW e IVFFlat con sus parámetros.
- Combinar **filtros estructurados con búsqueda vectorial** y entender los gotchas de filtrar pre vs post-ANN.
- Comparar **pgvector vs Qdrant** (modelos de datos, payload filtering) y ubicar a Pinecone, Chroma, Weaviate y Milvus en el mapa.
- Diseñar el **versionado del modelo de embeddings** en el schema, para poder cambiar el modelo sin perder lo indexado.
- Indexar el catálogo de **TiendaPro** en pgvector y exponer un retriever consumible desde el asistente.

## 2. Prerequisitos

- **S06, S07.1, S07.2, S07.3** completas.
- **Docker** instalado y `docker compose` funcionando. El repo trae un `docker-compose.yml` con `pgvector/pgvector:pg16` listo para levantar.
- **psql** local (opcional pero recomendado). Si no, las queries se ejecutan vía script TS contra Postgres.

## 3. Conceptos clave

- **Vector DB:** sistema especializado en almacenar vectores densos y resolver consultas de **k-nearest neighbors (kNN)** sobre ellos. La diferencia con un Postgres "normal" no es el storage, es la **estructura de índice** que permite kNN sub-lineal sobre millones de vectores.
- **ANN (Approximate Nearest Neighbors):** algoritmos que devuelven los vecinos más cercanos con **alta probabilidad** pero sin garantía de exactitud. A cambio: latencia órdenes de magnitud menor que brute force.
- **Recall@K:** porcentaje de los K vecinos verdaderos que devuelve un índice ANN. Métrica primaria de calidad de un índice.
- **HNSW (Hierarchical Navigable Small World):** índice ANN basado en grafos en capas. Trade-off típico: muy buen recall + latencia, mayor memoria y tiempo de build. **El default profesional para volúmenes medianos.**
- **IVFFlat:** índice basado en clustering. Más liviano en memoria, peor recall que HNSW a misma latencia. Útil en datasets muy grandes con restricciones de memoria.
- **Product Quantization (PQ):** técnica de compresión de vectores que reduce memoria a costa de precisión. Combinable con IVF (`IVFPQ`).
- **Payload / metadata:** datos no vectoriales adjuntos a cada vector (ID, categoría, autor, timestamp). Filtrar por payload es operación de primera clase en una vector DB seria.
- **Versionado de embeddings:** registrar `embedding_model` + `embedding_version` por vector. Sin esto, migrar de modelo es una pesadilla.

## 4. Teoría

### 4.1. Por qué una vector DB y no Postgres a secas

Postgres puede guardar vectores: `column embedding REAL[]` o `vector(N)` con la extensión pgvector. La pregunta no es **si puede guardarlos** — la respuesta es sí en cualquier base — sino **si puede buscarlos eficientemente**.

#### El problema central: kNN no escala con brute force

Encontrar los K vectores más cercanos a una query implica calcular la distancia contra **cada vector del corpus**:

```
Para cada vec_i en corpus:
    d_i = distancia(query, vec_i)
return top-K(d_i)
```

Costo: `O(N · D)` por query, donde `N` es el tamaño del corpus y `D` la dimensión del vector.

| N (corpus) | D (dim) | Tiempo brute force típico |
|------------|---------|---------------------------|
| 1.000 | 768 | < 1 ms |
| 100.000 | 768 | ~50 ms |
| 10.000.000 | 768 | ~5 s |
| 1.000.000.000 | 768 | inviable en línea |

A 100K vectores, brute force es aceptable. A 10M, ya estás incumpliendo SLA. A 1B, necesitas sí o sí un índice ANN.

> **Regla:** hasta ~50K-100K vectores, **brute force es la opción correcta**. Solo introduce HNSW o IVF cuando el volumen lo justifique. Los índices ANN tienen costos: build time, memoria, mantenimiento, y reducen recall.

#### Lo que aporta una vector DB sobre "Postgres + arrays"

1. **Tipo nativo `vector(N)`** con representación binaria compacta (4 bytes por dim, 768 dim = 3 KB).
2. **Índices ANN nativos:** HNSW, IVFFlat, PQ.
3. **Operadores de distancia:** `<->` (L2), `<#>` (dot negativo), `<=>` (coseno) con planificador integrado.
4. **Filtros estructurados** combinables con kNN sin perder el índice (con caveats — ver 4.5).
5. **Persistencia, replicación, backups** del mismo nivel que tu base relacional.

En el ecosistema, esto se logra de dos maneras:
- **Postgres con extensión** (pgvector) — vives en la base que ya conoces.
- **Vector DB dedicada** (Qdrant, Pinecone, Weaviate, Milvus, Chroma) — la base es vectorial nativa y agrega features especializadas (multi-tenant, sharding, filtros sobre payload jerárquico).

### 4.2. Índices ANN — las cuatro familias que importan

#### A. Flat (sin índice — brute force)

- Compara contra todos los vectores. Recall = 100%.
- **Latencia** lineal en N.
- **Memoria** mínima (solo guarda los vectores).
- **Cuándo usarlo:** N < 100K, o cuando necesitas garantía de recall exacto.

#### B. IVFFlat (Inverted File con vectores planos)

- **Idea:** clustering del corpus en `lists` clusters. Cada cluster tiene un centroide. Al buscar, comparas contra los centroides primero, luego contra los vectores de los clusters más cercanos (`probes`).
- **Build time:** rápido (k-means sobre el corpus).
- **Memoria:** baja (solo los vectores + centroides).
- **Recall:** controlable con `probes`. Más probes → más recall, más latencia.
- **Parámetros pgvector:** `lists = sqrt(N)` aproximadamente, `probes = 1-100` en query time.
- **Cuándo usarlo:** corpus muy grande (>1M) donde HNSW no entra en memoria.

#### C. HNSW (Hierarchical Navigable Small World)

- **Idea:** grafo en capas donde cada nodo tiene aristas a sus vecinos cercanos. La capa superior tiene pocos nodos con saltos largos; las capas inferiores tienen más nodos con saltos cortos. La búsqueda navega de capa en capa hasta el kNN final.
- **Build time:** lento (insertar cada vector requiere navegación + creación de aristas).
- **Memoria:** alta (el grafo se mantiene en RAM para latencia baja).
- **Recall:** muy bueno. Controlable con `m` (vecinos por nodo) y `ef_construction` (profundidad de búsqueda al construir) y `ef_search` (profundidad al consultar).
- **Cuándo usarlo:** **default profesional para 100K - 100M vectores**. Mejor recall@latencia que IVFFlat en casi todos los benchmarks.

#### D. Product Quantization (PQ) y derivados

- **Idea:** comprimir cada vector dividiéndolo en sub-vectores y reemplazando cada uno por el índice del centroide de un sub-codebook. Un vector de 768 dim float32 (3 KB) puede comprimirse a 96 bytes — 30× menos memoria.
- **Trade-off:** se pierde precisión en el cálculo de distancia. Combinable con IVF (`IVFPQ`) o HNSW (`HNSWPQ`).
- **Cuándo usarlo:** corpus enorme (>100M) donde la memoria del índice domina el costo de infra.
- **En pgvector:** soporte experimental para PQ; Faiss y Milvus son los referentes.

#### Tabla de decisión

| Corpus | Índice recomendado | Razón |
|--------|--------------------|-------|
| < 50K | **Flat (brute force)** | Recall exacto, latencia aceptable, simplicidad |
| 50K - 1M | **HNSW** | Mejor balance recall/latencia |
| 1M - 100M | **HNSW** o **IVFFlat** | HNSW si la RAM alcanza, IVFFlat si no |
| > 100M | **IVFPQ / HNSWPQ** | Reducción de memoria por cuantización |

### 4.3. pgvector en profundidad

`pgvector` es la extensión que convierte Postgres en una vector DB capaz. Se distribuye como una imagen Docker (`pgvector/pgvector:pg16`) o como paquete del SO.

#### Tipo y schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE products (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    category      TEXT NOT NULL,
    description   TEXT NOT NULL,
    embedding     vector(768) NOT NULL,
    embedding_model    TEXT NOT NULL,   -- 'gemini-embedding-001'
    embedding_version  INT  NOT NULL,   -- 1, 2, 3 según re-indexings
    indexed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Notas críticas:

- **`vector(768)`** fija la dimensión a nivel de schema. Si cambias de modelo a otro de dimensión distinta, **no es una migración trivial** (ver 4.6).
- **`embedding_model` y `embedding_version`** son **obligatorios en cualquier sistema serio**. Sin ellos, no puedes saber qué vectores son válidos cuando el modelo cambia.
- **`indexed_at`** te da auditoría: cuándo se generó este vector, útil para debug.

#### Operadores de distancia

pgvector expone tres operadores de distancia:

| Operador | Métrica | Cuándo usarlo |
|----------|---------|----------------|
| `<->` | L2 (euclidiana) | Vectores no normalizados; cuando tu índice está optimizado para L2 |
| `<#>` | Dot product **negativo** | Vectores normalizados (Gemini, OpenAI); el más rápido |
| `<=>` | Coseno (`1 - cos`) | Eval / análisis con rango interpretable |

> **Cuidado con `<#>`:** devuelve **dot product negativo** para que `ORDER BY ... ASC` ordene de mayor similitud a menor (igual que las otras dos métricas). Es un detalle de la API que confunde la primera vez.

#### Query básica con kNN

```sql
SELECT id, name, category, (embedding <#> $1) * -1 AS similarity
FROM products
WHERE embedding_model = 'gemini-embedding-001'
  AND embedding_version = 1
ORDER BY embedding <#> $1
LIMIT 10;
```

Lo que pasa aquí:

1. Filtra por modelo+versión (sin esto, cuando cambies el modelo te traes vectores de otro espacio mezclados).
2. Ordena por dot negativo ascendente (= similitud descendente).
3. Multiplica por -1 al imprimir para que el `similarity` sea legible.
4. `LIMIT 10` aplica el top-K.

#### Crear un índice HNSW

```sql
CREATE INDEX products_embedding_hnsw_idx
ON products
USING hnsw (embedding vector_ip_ops)   -- inner product (dot)
WITH (m = 16, ef_construction = 64);
```

- `vector_ip_ops` para dot product. Las otras opciones: `vector_l2_ops` (L2) y `vector_cosine_ops` (coseno).
- `m = 16` (aristas por nodo): default razonable. Mayor → mejor recall, más memoria.
- `ef_construction = 64`: profundidad de búsqueda al construir. Mayor → mejor índice, más tiempo de build.

En query time, puedes ajustar `ef_search`:

```sql
SET hnsw.ef_search = 100;   -- default 40
```

Más alto → más recall, más latencia. **Ajústalo con tu eval set, no a ojo.**

#### Crear un índice IVFFlat

```sql
CREATE INDEX products_embedding_ivf_idx
ON products
USING ivfflat (embedding vector_ip_ops)
WITH (lists = 100);     -- ~ sqrt(N) para N=10K
```

```sql
SET ivfflat.probes = 10;   -- default 1, mayor → más recall
```

> **Regla operativa:** crea el índice **después** de hacer la carga inicial (build batch es más rápido que mantener el índice incremental durante un INSERT masivo). Para HNSW, el orden importa; para IVFFlat, también necesitas datos suficientes para que `lists` clusters tenga sentido.

#### EXPLAIN ANALYZE — ver que el índice se usa

```sql
EXPLAIN ANALYZE
SELECT id, name FROM products
ORDER BY embedding <#> $1
LIMIT 10;
```

Buscas en el output: `Index Scan using products_embedding_hnsw_idx`. Si dice `Seq Scan`, el planner no usó el índice — investiga (datos muy chicos, parámetros de índice mal, o filtros que invalidan).

### 4.4. Filtros estructurados + búsqueda vectorial

Casi nunca queremos solo "el más cercano semánticamente". Queremos "el más cercano semánticamente **dentro de** una categoría / del usuario X / con stock > 0". Esto es **filtros + ANN**, y tiene gotchas.

#### Tres formas de combinar filtros con kNN

**A. Pre-filter (filtra primero, kNN sobre el subset)**

```sql
SELECT id FROM products
WHERE category = 'mochilas'
ORDER BY embedding <#> $1
LIMIT 5;
```

- **Ventaja:** resultado correcto siempre (kNN se hace sobre lo filtrado).
- **Desventaja:** el índice ANN puede no usarse si el subset filtrado es mucho menor que el corpus. pgvector cae a brute force sobre el subset (lo que está bien si el subset es chico, mal si es del orden de N).

**B. Post-filter (kNN primero, filtra después)**

```sql
WITH top_k AS (
    SELECT id, category FROM products
    ORDER BY embedding <#> $1
    LIMIT 50
)
SELECT id FROM top_k WHERE category = 'mochilas' LIMIT 5;
```

- **Ventaja:** usa el índice ANN al máximo.
- **Desventaja:** si tu filtro es muy selectivo (`category = 'una-categoría-rara'`), te quedas sin resultados aunque haya productos relevantes más allá del top-50.

**C. Iterative deepening (aumentar K hasta llenar)**

Empezar con `LIMIT 50`, post-filtrar; si no hay K resultados, expandir a `LIMIT 200`, repetir.

- Patrón razonable cuando el filtro es selectivo y necesitas K garantizados.
- Implementable en código de aplicación, no en SQL puro.

> **Patrón recomendado para TiendaPro:** **pre-filter cuando el filtro reduce a un subset chico** (categoría, marca), **post-filter cuando el filtro es laxo** (precio < X). Mide con tu corpus.

#### Filtros de payload en Qdrant — la otra escuela

Qdrant integra los filtros directamente en la búsqueda HNSW: durante la travesía del grafo, descarta nodos que no cumplen el filtro. Resultado: filtros + ANN sin perder el índice. pgvector tiene esto en evolución constante; Qdrant lo tiene maduro hace tiempo.

### 4.5. Versionado del modelo de embeddings

El error más común es **olvidarse de versionar**. Aparece cuando intentas migrar de modelo y descubres que no puedes mezclar vectores viejos con nuevos.

#### Por qué versionar

Los embeddings de modelos distintos viven en espacios distintos. Si tu tabla `products` tiene mitad de filas con `gemini-embedding-001` y mitad con `text-embedding-3-small`, **comparar similitudes entre ambos no significa nada**.

#### El patrón

```sql
ALTER TABLE products ADD COLUMN embedding_model TEXT NOT NULL;
ALTER TABLE products ADD COLUMN embedding_version INT NOT NULL;

CREATE INDEX products_model_version_idx
ON products(embedding_model, embedding_version);
```

Cada query de retrieval **filtra por modelo + versión activos**:

```sql
WHERE embedding_model = $current_model AND embedding_version = $current_version
```

#### Estrategia de migración

1. **Re-ingest paralelo:** mantienes ambas versiones del vector por un tiempo.
2. **Switch:** la app cambia el `current_model` / `current_version` cuando todos los rows nuevos están listos.
3. **GC:** borras los vectores viejos cuando estás seguro.

```sql
-- 1. Agregar la columna nueva (otra dimensión si cambia el modelo)
ALTER TABLE products ADD COLUMN embedding_v2 vector(1536);

-- 2. Backfill async (script): poblar embedding_v2 con el modelo nuevo

-- 3. Cambiar la app para leer embedding_v2 en queries

-- 4. Después de confirmar: drop la columna vieja
ALTER TABLE products DROP COLUMN embedding;
ALTER TABLE products RENAME COLUMN embedding_v2 TO embedding;
```

> **Antipatrón:** sobrescribir `embedding` in-place sin downtime. Vas a tener queries durante la migración que ven mitad de los rows sin re-embedear → resultados garbage.

### 4.6. Comparativa: pgvector vs Qdrant vs el resto

#### pgvector

- **Postgres + extensión.** Mismo motor que tu base relacional.
- **Pro:** un solo sistema (storage, índice, replicación), DBA puede usar herramientas conocidas, transacciones, integración trivial con datos relacionales.
- **Contra:** filtros + ANN no son first-class; HNSW se construye en RAM (límites en datasets enormes); concurrent build hasta versiones recientes era flojo.
- **Cuándo elegirlo:** **default profesional cuando ya usas Postgres**. Cubre el 80% de casos.

#### Qdrant

- **Vector DB nativa, escrita en Rust.** REST + gRPC.
- **Pro:** filtros como ciudadano de primera, HNSW maduro, payload anidado, snapshots, multi-tenant, cluster scaling.
- **Contra:** servicio adicional para operar, tu data se duplica (relacional + Qdrant), sincronización a tu cargo.
- **Cuándo elegirlo:** filtros complejos, multi-tenancy fuerte, o equipo dispuesto a operar un servicio dedicado.

#### Pinecone

- **Vector DB SaaS** (managed). No corres infra.
- **Pro:** zero-ops, escalado automático, latencia consistente.
- **Contra:** pricing puede escalar feo, vendor lock, los datos viven en Pinecone (compliance).
- **Cuándo elegirlo:** equipos que no quieren operar infra y aceptan el costo SaaS.

#### Chroma

- **Open-source, embebida o servicio.**
- **Pro:** API muy simple, ideal para prototipos rápidos y notebooks.
- **Contra:** menos maduro en producción, performance flojo en datasets grandes.
- **Cuándo elegirlo:** prototipo o notebook; **no para producción seria**.

#### Weaviate / Milvus

- **Open-source, vector DBs nativas con features avanzadas** (módulos, hybrid search nativo, reranking).
- **Cuándo elegirlas:** features específicas que pgvector y Qdrant no tienen, o equipos con experiencia previa.

### Tabla resumen

| Sistema | Setup | Filtros | Volumen | Lock-in | Curso |
|---------|-------|---------|---------|---------|-------|
| pgvector | Trivial (Docker) | OK con caveats | 10M-100M | Cero | **Default** |
| Qdrant | Docker | Excelente | 100M+ | Bajo | Comparativa |
| Pinecone | SaaS | Bueno | Cualquiera | Alto | Mención |
| Chroma | Pip / npm | OK | <10M | Bajo | Mención |
| Weaviate | Docker / SaaS | Excelente | 100M+ | Medio | Mención |

## 5. Patrones y antipatrones

### Patrones

- **Versiona el modelo y la versión por vector.** Sin esto, cualquier migración de modelo es un caos.
- **Crea el índice ANN después del bulk insert inicial.** Ahorra horas en datasets grandes.
- **Pre-filtra cuando el filtro reduce el corpus drásticamente; post-filtra cuando es laxo.** Mide con `EXPLAIN ANALYZE`.
- **Calibra `ef_search` (HNSW) o `probes` (IVFFlat) con tu eval set.** Default rara vez es lo óptimo.
- **Mantén el índice por categoría/tenant/usuario si la app lo permite.** Índices más pequeños son más rápidos y se construyen antes.
- **Loguea latencia p50/p95/p99 del retrieval.** Te alerta de degradación antes que el usuario.

### Antipatrones

- **No usar índice cuando hay >100K vectores.** Brute force a esa escala mata SLA.
- **Usar índice cuando hay 1K vectores.** El índice impone overhead sin valor agregado; brute force es mejor.
- **Mezclar vectores de modelos distintos sin filtrar por modelo.** Cada modelo vive en su espacio. Comparar similitudes entre espacios es ruido puro.
- **Sobrescribir embeddings in-place durante una migración de modelo.** Causa resultados garbage durante la ventana de migración.
- **Filtros en HNSW + post-filter cuando el filtro es muy selectivo.** Te quedas sin resultados. Pre-filtra o aumenta K iterativamente.
- **Suponer que el índice del laboratorio se reproduce en producción.** Build time, memoria y latencia cambian con el volumen real. Mide.

## 6. Conexión con TiendaPro

Esta sesión cierra el Módulo 3 con el **primer índice real del catálogo**. Lo que añadimos al integrador:

```
code/proyecto-integrador/
├── src/
│   └── retrieval/
│       ├── pgvector-store.ts   ← cliente postgres + métodos
│       └── index.ts             ← exports
├── scripts/
│   └── index-catalog.ts         ← ingesta el catálogo
└── sql/
    └── 001-products-schema.sql  ← schema con versionado
```

Decisiones aplicadas (vienen de S07.2 y S07.3):

- **Modelo:** `gemini-embedding-001` (768D, multilingüe).
- **Métrica de índice:** dot product (`vector_ip_ops` en HNSW).
- **Threshold inicial:** `0.55` (calibrar con `pnpm threshold-calibration` de S07.3 sobre corpus real cuando lo tengamos).
- **Schema:** `products` con `embedding_model` + `embedding_version` desde el día uno.
- **Estrategia:** top-K=10 + threshold mínimo. Si nada pasa, retorno vacío.

**Lo que NO entra todavía:**

- FAQs indexadas — entran en M4 cuando armemos RAG sobre FAQs.
- Hybrid search (denso + BM25) — entra en S10.
- Re-ranking con cross-encoder — entra en S11.

El asistente conversacional **todavía no usa** el retriever en M3 (sigue con el `findProducts` keyword del M2). El swap se hace en M4 cuando arrancamos RAG.

## 7. Resumen

Tres ideas para llevarte:

1. **Una vector DB no es Postgres con arrays.** Lo que la define es el **índice ANN** que permite kNN sub-lineal. Sin necesidad real de ANN (corpus < 100K), una tabla plana ya alcanza — la complejidad de operar un sistema vectorial dedicado solo se justifica con volumen.
2. **HNSW es el default profesional para 100K-100M vectores.** IVFFlat queda para escalas muy grandes con limitación de memoria; PQ entra cuando el costo de RAM domina la ecuación.
3. **Versiona el modelo + versión por vector desde el día uno.** Migrar de modelo sin esa columna es una pesadilla; con ella, es un re-embed paralelo + switch + GC.

## 8. Preguntas de auto-evaluación

1. Tu corpus tiene 30K productos y latencia objetivo p95 < 100 ms. ¿Necesitas un índice ANN? Justifica.
2. Eliges HNSW para tu índice. ¿Qué efecto tiene subir `m` de 16 a 64? ¿Y subir `ef_search` de 40 a 200?
3. Tu app filtra siempre por `tenant_id`. Tienes 1000 tenants y 10K productos por tenant. ¿Pre-filter, post-filter, o un índice por tenant? Argumenta.
4. Migras de Gemini (768D) a OpenAI text-embedding-3-large (3072D). ¿Qué pasos sigues a nivel schema y a nivel de app para no romper queries durante la migración?
5. `<->`, `<#>` y `<=>` en pgvector. ¿En qué se diferencian operativamente y cuál usarías en producción con vectores normalizados? ¿Por qué `<#>` devuelve un valor negativo?
6. Tu equipo discute si adoptar Qdrant en lugar de pgvector. Lista tres ventajas operativas reales de Qdrant para casos donde supera a pgvector, y un caso donde pgvector sigue siendo la mejor opción.

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 5 ejercicios prácticos sobre pgvector + integración con TiendaPro.

**Próxima sesión:** [`S09 — Fundamentos de RAG y técnicas de recuperación`](../../04-rag/sesion-09-fundamentos-rag/) → ahora que el catálogo está indexado, conectamos el retrieval con el LLM y armamos el pipeline RAG completo.
