# Sesión 08 — Ejercicios

> **Tiempo estimado:** ~70 min total. Levantas pgvector con Docker, creas el schema, indexas el catálogo, ejecutas búsqueda con threshold, comparas estrategias de filtrado y, opcionalmente, haces un mirror en Qdrant. Cierras integrando el retriever en el proyecto integrador (TiendaPro). Scripts en [`code/m03-embeddings/sesion-08/`](../../../../code/m03-embeddings/sesion-08/).

---

## Setup base

Desde la raíz del repo:

```bash
docker compose up -d postgres        # levanta pgvector/pgvector:pg16
pnpm install
```

`.env` con (si no lo tienes):

```bash
GOOGLE_GENERATIVE_AI_API_KEY=tu_api_key
POSTGRES_USER=curso
POSTGRES_PASSWORD=curso
POSTGRES_DB=curso_ai
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

Verifica que Postgres está arriba:

```bash
docker compose ps postgres
docker compose exec postgres psql -U curso -d curso_ai -c "SELECT version();"
```

> **Nota:** todos los scripts de la sesión usan `pg` (node-postgres) y se conectan con las variables de entorno de arriba. Si no usas Docker, configura las variables apuntando a tu Postgres con la extensión `vector` instalada.

---

## 1. Ejercicio guiado: setup del schema

**Objetivo:** crear la extensión `vector`, la tabla `products` con versionado de embeddings y el índice HNSW.

### 1.1. Probarlo

```bash
pnpm run setup-schema
```

El script:

1. Conecta a Postgres con `pg`.
2. Ejecuta `sql/01-schema.sql` que crea la extensión, la tabla `products` y un índice secundario sobre `(embedding_model, embedding_version)`.
3. Imprime el esquema final con `\d products` equivalente.

### 1.2. Salida esperada

```
✓ Extensión vector instalada (versión 0.x.x)
✓ Tabla products creada con columnas:
    id            TEXT PRIMARY KEY
    name          TEXT
    category      TEXT
    description   TEXT
    embedding     vector(768)
    embedding_model     TEXT
    embedding_version   INT
    indexed_at    TIMESTAMPTZ
✓ Índice products_model_version_idx creado
```

### 1.3. Pregunta para ti

¿Por qué creamos el índice HNSW en un script separado (ejercicio siguiente) y no en este?

> **Razonamiento:**
>
> Los índices ANN (HNSW e IVFFlat) son **mucho más rápidos de construir en bulk sobre datos ya cargados** que mantenidos incrementalmente durante INSERTs. Si creas el índice en una tabla vacía y después insertas 1M de filas, cada INSERT actualiza el grafo HNSW — caro. Si insertas todo primero y construyes el índice después, el motor lo arma en una pasada optimizada. La regla operativa: **bulk insert → crear índice**, en ese orden.

---

## 2. Ejercicio: ingesta del catálogo

**Objetivo:** embedear los 12 productos de TiendaPro con Gemini y persistirlos en pgvector. Crear el índice HNSW al final.

### 2.1. Probarlo

```bash
pnpm run ingest-catalog
```

El script:

1. Carga `data/catalog.json` (12 productos).
2. Llama a `embedMany(...)` de Gemini con los textos `productAsDoc(p)`.
3. Hace `INSERT ... ON CONFLICT (id) DO UPDATE` para que sea idempotente.
4. Ejecuta `sql/02-index-hnsw.sql` para crear el índice HNSW con `vector_ip_ops` (dot product).
5. Imprime un sumario.

### 2.2. Salida esperada (snippet)

```
Embedeando 12 productos con gemini-embedding-001 (768D)...
✓ TP-MOCH-01 — Mochila Trekker 30L (1.2 KB embed)
✓ TP-MOCH-02 — Mochila Summit 65L
...
12 productos insertados (model=gemini-embedding-001, version=1).

Construyendo índice HNSW (m=16, ef_construction=64)...
✓ Índice products_embedding_hnsw_idx listo (123 ms).

Verificación final:
  SELECT count(*) FROM products → 12
  Tamaño del índice: 24 KB
```

### 2.3. Pregunta para ti

El script usa `INSERT ... ON CONFLICT (id) DO UPDATE`. ¿Por qué no `DELETE + INSERT`? ¿Qué riesgo cubrimos?

> **Razonamiento:**
>
> - `DELETE + INSERT` deja la tabla **temporalmente vacía** entre las dos operaciones (sin transacción) o requiere bloquear la tabla (con transacción). Cualquier query de retrieval durante esa ventana retorna 0 resultados — al usuario le aparece "no hay productos". Operacionalmente inaceptable.
> - `UPSERT` (INSERT ... ON CONFLICT) reemplaza fila por fila. La tabla nunca queda vacía; cada producto se actualiza atómicamente. Las queries en curso ven o el vector viejo o el nuevo, nunca un agujero.
> - **Patrón aplicable a todo data en producción:** prefiere upserts atómicos sobre delete-then-insert, salvo casos donde la tabla DEBE quedar exactamente como el dump (caso raro).

---

## 3. Ejercicio: búsqueda con top-K + threshold

**Objetivo:** ejecutar consultas semánticas reales contra pgvector y observar EXPLAIN ANALYZE para confirmar que el índice se está usando.

### 3.1. Probarlo

```bash
pnpm run search
```

El script ejecuta 4 queries:

1. `"algo para cargar mis cosas en una caminata"`
2. `"iluminación para uso nocturno"`
3. `"tienda de campaña para cuatro personas"`
4. `"texto absurdo que no debería matchear nada"`  ← debería retornar 0 con threshold

Para cada query:
- Embedea con Gemini.
- Llama `SELECT id, name, category, (embedding <#> $1) * -1 AS similarity FROM products WHERE ... ORDER BY embedding <#> $1 LIMIT 10`.
- Filtra en código los que tienen `similarity >= 0.55`.
- Imprime resultados.
- Una vez ejecuta `EXPLAIN ANALYZE` para verificar el uso del índice.

### 3.2. Salida esperada (snippet)

```
Query: "algo para cargar mis cosas en una caminata"
  Top con similitud >= 0.55:
    1. Mochila Trekker 30L      (0.71)
    2. Mochila Summit 65L       (0.65)
    3. Mochila City Daypack 18L (0.59)

Query: "texto absurdo que no debería matchear nada"
  Top con similitud >= 0.55:
    (vacío)
  → Mejor un retorno vacío que K resultados irrelevantes.

EXPLAIN ANALYZE para query 1:
  Index Scan using products_embedding_hnsw_idx on products  (cost=...)
  Execution Time: 4.2 ms
```

### 3.3. Pregunta para ti

Si `EXPLAIN ANALYZE` muestra `Seq Scan` en lugar de `Index Scan`, ¿qué causas razonables hay y cómo las descartas?

> **Razonamiento:**
>
> - **El corpus es muy chico (12 productos):** el planificador puede decidir que un seq scan es más barato que cargar el índice HNSW. **Esperable y correcto.** En producción con N grande, el planner debería elegir el índice automáticamente.
> - **Filtro WHERE invalida el índice:** si filtras por `category = 'mochilas'` y el índice HNSW no incluye `category`, el planificador puede caer a seq scan + filtro post. Solución: índice combinado o pre-filter explícito en el query.
> - **`enable_seqscan = off`** (a usar solo en dev/eval, no en prod) fuerza al planificador a probar el índice. Si aun así no lo usa, hay un problema real.
> - **Estadísticas desactualizadas:** `ANALYZE products` después de bulk insert ayuda al planificador. Worth ejecutar después de la ingesta inicial.

---

## 4. Ejercicio: filtros + búsqueda — pre vs post-filter

**Objetivo:** ver empíricamente la diferencia entre filtrar antes vs después del retrieval semántico, con un filtro selectivo (`category = 'mochilas'`) y otro laxo (`indexed_at > 'fecha'`).

### 4.1. Probarlo

```bash
pnpm run filter
```

El script ejecuta la misma query (`"opciones livianas para uno o dos días"`) bajo cuatro estrategias:

1. **Sin filtro** — referencia.
2. **Pre-filter por categoría** — `WHERE category = 'mochilas' ORDER BY embedding <#> $1 LIMIT 5`.
3. **Post-filter por categoría** — `... ORDER BY embedding <#> $1 LIMIT 50` y luego `category = 'mochilas' LIMIT 5` en código.
4. **Pre-filter laxo (timestamp)** — `WHERE indexed_at > now() - interval '1 hour' ORDER BY embedding <#> $1 LIMIT 5`.

Imprime para cada uno: top-3, similitudes, tiempo aproximado y plan reportado por EXPLAIN.

### 4.2. Salida esperada (snippet)

```
1) Sin filtro:
   Top-3: Trekker 30L | Summit 65L | City Daypack 18L
   Plan:  Index Scan (HNSW)   — 3 ms

2) Pre-filter category = 'mochilas':
   Top-3: Trekker 30L | Summit 65L | City Daypack 18L
   Plan:  Bitmap Heap Scan + Filter  — 2 ms
   → Filtro selectivo (3 de 12). El planner cae a seq scan sobre el subset, lo cual es correcto.

3) Post-filter category = 'mochilas':
   Top-3 antes del filtro: Trekker 30L | Summit 65L | City Daypack 18L | Linterna | Forro
   Top-3 después del filtro: Trekker 30L | Summit 65L | City Daypack 18L
   Plan:  Index Scan (HNSW) — 4 ms
   → Usa el índice. OK acá porque mochilas son comunes; con categoría rara podría no encontrar 3.

4) Pre-filter laxo (timestamp):
   Top-3: Trekker 30L | Summit 65L | City Daypack 18L
   Plan:  Index Scan (HNSW) + Filter — 5 ms
   → Filtro no muy selectivo. El planner igual usa el índice.
```

### 4.3. Pregunta para ti

Para una app de e-commerce con 1M productos en 50 categorías, una query típica filtra por una categoría que tiene ~20K productos. ¿Pre o post-filter? ¿Por qué?

> **Razonamiento sugerido:**
>
> - **Pre-filter** sobre `category` con índice B-tree en `category` + index ANN sobre `embedding`. El planner suele combinar: filtrar por categoría primero (deja 20K), luego ANN sobre el subset. **20K es ya un volumen donde el índice ANN aporta sobre brute force.** Si pgvector no combina bien (depende de la versión), considera un índice ANN **parcial** por categoría.
> - **Post-filter** acá es riesgoso: si traes top-50 sin filtro y la categoría buscada es minoritaria, vas a recibir muy pocos resultados. Con 50 categorías y filtro por una, en promedio 50/50 = 1 de cada 50 resultados sería de la categoría → top-50 te da ~1 resultado de la categoría.
> - **Para casos muy selectivos** (filtro por `tenant_id` con miles de tenants), considera **un índice por tenant** o un sistema con filtros first-class como Qdrant.

---

## 5. Ejercicio opcional: mirror en Qdrant

**Objetivo:** ver en práctica un cliente Qdrant — la API es muy distinta de pgvector y entender la diferencia ayuda a decidir entre los dos.

### 5.1. Probarlo

```bash
docker compose --profile qdrant up -d qdrant
pnpm run qdrant-mirror
```

El script:

1. Conecta al Qdrant local (`http://localhost:6333`).
2. Crea (o resetea) la colección `products` con `size: 768, distance: "Dot"`.
3. Inserta los 12 productos con payload (`name`, `category`).
4. Ejecuta la misma query que en el ejercicio 3 con filtro por categoría.
5. Compara el resultado y la API con pgvector.

### 5.2. Salida esperada (snippet)

```
Qdrant collection 'products' creada (size=768, distance=Dot).
12 puntos insertados con payload.

Query: "opciones livianas para uno o dos días"
Filter: category == "mochilas"

Resultados (Qdrant):
  1. Mochila Trekker 30L      (score=0.72)
  2. Mochila Summit 65L       (score=0.66)
  3. Mochila City Daypack 18L (score=0.60)

Comparativa rápida con pgvector:
  • Misma calidad (modelo idéntico).
  • Latencia similar a este volumen.
  • API: Qdrant integra el filtro al search, sin tener que pensar en pre/post.
  • Operación: Qdrant es un servicio extra a operar; pgvector vive en tu DB.
```

### 5.3. Pregunta para ti

Si tu equipo ya tiene Postgres operado y no tiene experiencia con Qdrant, ¿qué argumento técnico justifica adoptar Qdrant en lugar de quedarse con pgvector?

> **Razonamiento:**
>
> - **Filtros complejos sobre payload anidado:** Qdrant los maneja sin perder el índice ANN; pgvector cae a estrategias de pre/post-filter con caveats.
> - **Multi-tenant a escala:** Qdrant tiene shard keys y collection-per-tenant más natural; en pgvector hay que diseñarlo a mano.
> - **Sharding horizontal nativo:** si el corpus crece a 100M+ y necesitas distribuir, Qdrant lo soporta out-of-the-box.
> - **Snapshots y backup vector-first:** Qdrant tiene mejor tooling específico para datasets vectoriales.
>
> **Si nada de lo anterior se aplica a tu caso, quédate con pgvector.** No adoptes un sistema más por curiosidad — el costo operativo es real.

---

## 6. Aporte al proyecto integrador (TiendaPro)

Esta sesión cierra el Módulo 3 con el **primer índice real** del catálogo dentro del integrador. El cambio se hace en `code/proyecto-integrador/`:

```
code/proyecto-integrador/
├── sql/
│   └── 001-products-schema.sql      ← schema con embedding_model + embedding_version
├── src/
│   └── retrieval/
│       ├── pgvector-store.ts         ← cliente postgres + métodos
│       └── index.ts                  ← export del retriever
├── scripts/
│   └── index-catalog.ts              ← embedea catalog.json e ingesta
└── package.json                      ← añade pg + tsx command "index-catalog"
```

### 6.1. Probarlo

```bash
docker compose up -d postgres
cd code/proyecto-integrador
pnpm run index-catalog
```

Lo que pasa:

1. El script lee `data/catalog.json` (12 productos con price/tags/inStock).
2. Embedea cada uno con `productAsDoc(p)` (concatena `name + description + categoría`).
3. Aplica el schema `sql/001-products-schema.sql` (idempotente).
4. Hace UPSERT en `products` con `embedding_model = 'gemini-embedding-001'`, `embedding_version = 1`.
5. Crea el índice HNSW si no existe.

### 6.2. El retriever que queda expuesto

```typescript
import { PgVectorStore } from "./retrieval";

const store = new PgVectorStore();
const results = await store.searchProducts({
  query: "mochila para senderismo de fin de semana",
  k: 10,
  threshold: 0.55,
});
// → [{ id, name, category, similarity }]
```

**El asistente conversacional NO usa todavía** este retriever — sigue con el `findProducts` por keyword del Módulo 2. El swap entra en M4 cuando arranquemos RAG.

### 6.3. Test de humo del retriever

```bash
pnpm run test
```

El test (`__tests__/retrieval.test.ts`) hace:

1. Skip si `POSTGRES_HOST` no está disponible.
2. Conecta, busca `"mochila urbana"` y verifica que `City Daypack 18L` aparece en el top-3.
3. Busca un texto absurdo y verifica que el retorno está vacío con threshold 0.55.

### 6.4. Cierre del Módulo 3 — tag

Después de este ejercicio el repo recibe el tag `proyecto-m3`. El estado del integrador al cerrar M3:

- Asistente conversacional con personalidad (M2).
- Catálogo indexado en pgvector con HNSW + versionado de modelo (M3).
- Retriever expuesto pero NO conectado al asistente (entra en M4).

---

**Vuelve a:** [`README de la sesión`](README.md) | **Próximo paso:** [`recursos.md`](recursos.md).
