# Sesión 07.1 — Ejercicios

> **Tiempo estimado:** ~35 min total. Comparas las 4 estrategias de chunking sobre el mismo manual y observas trade-offs. Scripts en [`code/m03-embeddings/sesion-07.1/`](../../../../code/m03-embeddings/sesion-07.1/).

---

## Setup

```bash
cd code/m03-embeddings/sesion-07.1
pnpm install
```

`data/manual.md` es un manual de envíos y devoluciones de TiendaPro de ~1500 palabras con headings H1/H2/H3 estructurados.

---

## 1. Ejercicio guiado: fixed-size vs recursive

**Objetivo:** ver cómo ambas estrategias parten el mismo doc y por qué recursive gana.

### 1.1. Probarlo

```bash
pnpm run compare-splitters
```

El script:
1. Carga `data/manual.md`.
2. Aplica fixed-size chunking (size=400, overlap=50).
3. Aplica recursive chunking (size=400, overlap=50, separadores `["\n\n", "\n", ". ", " ", ""]`).
4. Imprime los primeros 3 chunks de cada uno.

### 1.2. Qué observar

- **Fixed-size:** el primer chunk corta a mitad de oración (`...El asistente de TiendaP`) y pierde contexto.
- **Recursive:** corta en `\n\n` (entre párrafos) cuando puede, manteniendo unidades semánticas.

### 1.3. Pregunta para ti

Toma el primer chunk de fixed-size y el primero de recursive. ¿Cuál de los dos puede responder por sí solo a "¿cuáles son los plazos de envío?" si lo embedeamos? ¿Por qué importa esto cuando hagamos retrieval?

> **Razonamiento:** el chunk de recursive es probable que mantenga el párrafo entero "Política de envíos: a península 2-4 días, a islas 4-7 días". El de fixed-size puede haber cortado al final del primer plazo. En retrieval, el de recursive devuelve respuesta completa; el de fixed-size devuelve un fragmento truncado que el LLM va a tener que "completar adivinando" — fuente clásica de alucinaciones en RAG mal hecho.

---

## 2. Ejercicio: structural chunking sobre Markdown

**Objetivo:** explotar la estructura del doc para producir chunks con metadata jerárquica.

### 2.1. Probarlo

```bash
pnpm run structural
```

El script:
1. Carga `data/manual.md`.
2. Lo recorre detectando `#`, `##`, `###`.
3. Cada sección se vuelve un chunk con `headings: ["Política de envíos", "Zonas remotas"]`.
4. Si una sección excede el chunk_size, aplica recursive **dentro** de la sección manteniendo el heading path.

### 2.2. Salida esperada (snippet)

```
=== Chunk 0 ===
headings: ["Política de envíos"]
text: "Política de envíos\n\nLos envíos a península llegan en 2-4 días hábiles..."

=== Chunk 1 ===
headings: ["Política de envíos", "Zonas remotas"]
text: "Zonas remotas\n\nPara Canarias y Baleares, los plazos son 4-7 días hábiles..."

=== Chunk 2 ===
headings: ["Política de envíos", "Costos"]
...
```

### 2.3. Pregunta para ti

Tu app necesita filtrar el retrieval por sección ("solo respuestas que vengan de 'Política de devoluciones'"). ¿Cómo aprovechás la metadata `headings` que produjo el splitter?

> **Razonamiento:** en pgvector (S08) puedes agregar `WHERE metadata->>'headings' @> '["Política de devoluciones"]'::jsonb`. Reduce drásticamente el espacio de búsqueda y mejora precisión cuando sabes a qué sección pertenece la query (el clasificador de S04 puede determinarlo).

---

## 3. Ejercicio: tamaño del chunk y trade-offs

**Objetivo:** ver el efecto de variar `chunk_size` y `overlap` sobre el mismo doc.

### 3.1. Probarlo

```bash
pnpm run sizes
```

El script chunka el manual con 4 configuraciones distintas:

| Config | Size | Overlap | Chunks | Tokens duplicados |
|--------|------|---------|--------|-------------------|
| Tiny | 200 | 0 | ~12 | 0 |
| Default | 800 | 100 | ~3 | ~200 |
| Big | 2000 | 0 | ~1 | 0 |
| Heavy overlap | 800 | 400 | ~6 | ~1600 |

### 3.2. Qué observar

- **Tiny:** muchos chunks chicos. Costoso en almacenamiento y queries; cada chunk pierde contexto.
- **Default (800/100):** balance — pocos chunks, cada uno autónomo.
- **Big (2000/0):** todo el doc cabe en 1 chunk → retrieval pierde granularidad.
- **Heavy overlap (800/400):** mucha redundancia → pagas por embedear texto repetido.

### 3.3. Pregunta para ti

Tu corpus tiene 1M de documentos × 500 tokens promedio. Con Default (800/100), ¿aproximadamente cuántos chunks total y cuántos tokens más vas a embedear vs sin overlap?

> **Cálculo:**
>
> - Total tokens corpus: 1M × 500 = 500M tokens.
> - Sin overlap: 500M / 800 = ~625K chunks.
> - Con overlap 100 (12.5%): 500M × 1.125 / 800 = ~703K chunks → ~78K chunks extra.
> - Costo extra de embedear: ~78K × 800 = 62M tokens × $0.025/1M (Gemini) = **$1.55** una sola vez.
> - El overlap es **prácticamente gratis** en almacenamiento incremental. Esto es por lo que se usa por default.

---

## 4. Reto: chunker custom con respeto a oraciones

**Objetivo:** implementar un chunker simple que **siempre corta en límites de oración** (nunca a mitad).

### 4.1. Tu tarea

Implementa `sentenceAwareChunker(text, options)`:

1. Tokeniza el texto en oraciones (regex simple: `[.!?]\s+`).
2. Acumula oraciones en un buffer hasta que el siguiente exceda `chunk_size` (en chars, no tokens — para simplificar).
3. Cuando vaya a exceder, cierra el chunk y empieza otro con `overlap_sentences` últimas del anterior.

### 4.2. Probarlo

```bash
pnpm run sentence-aware
```

### 4.3. Pregunta para ti

¿En qué casos tu sentence-aware chunker es mejor que recursive? ¿En cuáles peor?

> **Razonamiento:**
>
> **Mejor:** garantiza chunks que terminan en `.` / `!` / `?` — buenos para citación literal, no hay frases truncadas.
>
> **Peor:**
> - **Documentos sin oraciones claras** (código, JSON, listas con `-`) → tu regex de oraciones no encuentra nada y cae todo en un solo chunk.
> - **Texto muy estructurado por encabezados** → tu chunker mete varias secciones juntas; structural chunking sería mejor.
> - **Recursive con buenos separadores ya logra el 90% de esto** sin necesidad de regex de oraciones.
>
> Conclusión: sentence-aware es un nicho. Recursive bien configurado (con `". "` como separador prioritario) cubre lo mismo en la mayoría de los casos.

---

## 5. Aporte al proyecto integrador

Esta sesión NO modifica TiendaPro. La integración llega en S08. Por ahora, considera qué chunker vas a usar para:

- **Catálogo de productos:** un producto = un chunk natural (`name + description + tags`). No hace falta partir.
- **FAQs:** cada FAQ = un chunk (1-3 oraciones, cabe en 100-200 tokens).
- **Manual de políticas:** structural chunking respetando H1/H2 + recursive como fallback dentro de cada sección.

---

**Vuelve a:** [`README de la sesión`](README.md) | **Próximo paso:** [`recursos.md`](recursos.md).
