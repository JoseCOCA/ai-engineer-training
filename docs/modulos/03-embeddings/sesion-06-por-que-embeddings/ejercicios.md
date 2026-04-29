# Sesión 06 — Ejercicios

> **Tiempo estimado:** ~70 min total. Comparativa empírica keyword vs búsqueda semántica sobre el catálogo de TiendaPro, similitud entre productos y reto adversarial. Scripts en [`code/m03-embeddings/sesion-06/`](../../../../code/m03-embeddings/sesion-06/).

---

## Setup

```bash
cd code/m03-embeddings/sesion-06
pnpm install
```

`.env` configurado en la raíz con **Gemini API key** (los ejercicios usan `gemini-embedding-001` por su free tier amplio). Si preferís otro proveedor, los scripts mostraron cómo cambiar.

---

## 1. Ejercicio guiado: keyword vs semantic search

**Objetivo:** ver con tus propios ojos por qué la búsqueda por keyword cae y la semántica resuelve.

### 1.1. Setup del corpus

`data/catalog.json` tiene 12 productos (los mismos de M2 — S05.1). El script:

1. Embedeaa los 12 productos al iniciar.
2. Define 5 queries representativas, mezclando casos fáciles y difíciles.
3. Para cada query corre **dos búsquedas en paralelo**: keyword (filtro de S05.1) y semántica (con embeddings).
4. Imprime los top-3 resultados de cada una lado a lado.

### 1.2. Probarlo

```bash
pnpm run compare
```

Salida esperada (snippet):

```
=== Query: "mochila para senderismo de fin de semana" ===
Keyword:    1. Mochila Trekker 30L
            2. Mochila Summit 65L
            3. Mochila City Daypack 18L
Semántica:  1. Mochila Trekker 30L      (0.78)
            2. Mochila Summit 65L       (0.71)
            3. Botas Trail Pro Mid      (0.62)

=== Query: "algo para cargar mis cosas en una caminata" ===
Keyword:    (sin resultados)
Semántica:  1. Mochila Trekker 30L      (0.65)
            2. Mochila Summit 65L       (0.61)
            3. Mochila City Daypack 18L (0.55)

=== Query: "rucksack para hiking" ===
Keyword:    (sin resultados)
Semántica:  1. Mochila Trekker 30L      (0.71)
            2. Mochila Summit 65L       (0.68)
            3. Mochila City Daypack 18L (0.59)

=== Query: "estoy buscando una mocila grande" (typo) ===
Keyword:    (sin resultados)
Semántica:  1. Mochila Summit 65L       (0.72)
            2. Mochila Trekker 30L      (0.65)
            3. Mochila City Daypack 18L (0.58)
```

### 1.3. Pregunta para ti

Lista los 5 modos de fallo de keyword search (vistos en el README) y empareja cada uno con la query del script donde lo viste reproducirse.

> **Mapeo:**
> - Sinónimos → "rucksack"
> - Paráfrasis → "algo para cargar mis cosas..."
> - Errores de tipeo → "mocila"
> - Multilingüe → "rucksack" (es inglés en un catálogo en español)
> - Conceptos compuestos → algunos de los queries del script (ej. "equipo para acampar con familia").

---

## 2. Ejercicio: similitud entre productos

**Objetivo:** ver el espacio semántico desde adentro — qué productos están cerca de qué.

### 2.1. Tu tarea

`src/similarity-matrix.ts`:

1. Embedeaa los 12 productos.
2. Calcula la matriz de similitud coseno entre todos los pares.
3. Imprime la matriz como tabla (filas y columnas son los productos, celdas son la similitud).

### 2.2. Probarlo

```bash
pnpm run similarity
```

Salida esperada (snippet, valores aproximados):

```
                   Trek30  Sum65  City18  T2P  Fam4  Bot   ZapT  Shel  Pol  Lin  Bas  Hor
Trekker 30L         1.00   0.81  0.74    0.55 0.51  0.58  0.49  0.43 0.38 0.33 0.45 0.34
Summit 65L          0.81   1.00  0.66    0.62 0.59  0.60  0.45  0.45 0.40 0.35 0.50 0.37
City Daypack 18L    0.74   0.66  1.00    0.41 0.38  0.42  0.40  0.42 0.36 0.34 0.38 0.30
Tienda 2P           0.55   0.62  0.41    1.00 0.78  0.46  0.34  0.41 0.45 0.38 0.39 0.55
Tienda Familiar 4P  0.51   0.59  0.38    0.78 1.00  0.41  0.30  0.37 0.42 0.36 0.36 0.51
Botas Trail Pro     0.58   0.60  0.42    0.46 0.41  1.00  0.74  0.40 0.36 0.32 0.46 0.32
...
```

### 2.3. Qué observar

- Las 3 mochilas son altamente similares entre sí (~0.7-0.81). Esperado.
- Las 2 tiendas son similares entre sí (~0.78). Esperado.
- Botas y zapatillas son similares (~0.74). Esperado.
- Cocina (hornillo) está cerca de tiendas (0.55) — porque "camping" agrupa. Esperado.
- City Daypack 18L está MÁS cerca de Trekker 30L (0.74) que de las botas (0.42). El catálogo separa "outdoor" de "urbano" por cluster.

### 2.4. Pregunta para ti

Si tu app quiere recomendar productos relacionados al que el cliente está mirando, ¿qué umbral de similitud pondrías como `MIN_RELATED`? ¿Qué pasa si lo bajas a 0.4 o lo subes a 0.7?

> **Razonamiento:** umbral típico **0.55-0.65**. Por debajo entran productos casi-aleatorios (linterna recomendada cuando mirabas chaqueta — incoherente). Por encima de 0.7 solo entran productos casi-iguales (tres mochilas), perdiendo cross-sell. La métrica sale del eval set: ¿qué umbral maximiza CTR sin sacrificar relevancia?

---

## 3. Ejercicio: similitud query ↔ FAQs

**Objetivo:** aplicar embeddings a otro caso (FAQs en lugar de productos) y notar que el patrón es el mismo.

### 3.1. Setup

`data/faqs.json` tiene 8 preguntas frecuentes con su respuesta:

```json
[
  { "id": "faq-envio-tiempo",
    "question": "¿Cuánto tarda el envío?",
    "answer": "Los envíos a península llegan en 2-4 días hábiles..." },
  ...
]
```

### 3.2. Tu tarea

`src/faq-matching.ts`:

1. Embedeaa las 8 preguntas (usando solo el campo `question`).
2. Para cada query del usuario, encuentra la FAQ más similar.
3. Si la similitud > 0.7, devuelve la respuesta. Si no, devuelve "no encontrada, derivá a humano".

### 3.3. Probarlo

```bash
pnpm run faq
```

Salida esperada:

```
Query: "¿en cuánto me llega el pedido?"
  → Match: "¿Cuánto tarda el envío?" (0.83)
  → Respuesta: Los envíos a península llegan en 2-4 días hábiles...

Query: "no me cobraron bien"
  → Match: "¿Cómo gestiono un cobro incorrecto?" (0.74)
  → Respuesta: Si detectás un cobro incorrecto, abrí ticket...

Query: "hablemos del clima"
  → Sin match suficiente (mejor: 0.31)
  → Derivar a humano.
```

### 3.4. Pregunta para ti

¿Qué pasa si tu eval set no tenía la pregunta *"¿hacen envíos a Canarias?"* y un cliente la hace? El sistema con embeddings, ¿qué devuelve aproximadamente?

> **Razonamiento:** semánticamente "¿hacen envíos a Canarias?" es similar a "¿Cuánto tarda el envío?" o "¿Cuál es la cobertura de envío?". El sistema va a devolver UNA de esas FAQs (probablemente con similitud 0.6-0.75), pero la respuesta NO va a mencionar Canarias específicamente. Resultado: el cliente recibe info genérica de envíos, lo cual puede o no satisfacer su consulta. Esto es exactamente el problema que **RAG generativo** (M4) resuelve: pasar la FAQ recuperada al LLM como contexto y dejar que responda con esa info.

---

## 4. Reto: detectar duplicados

**Objetivo:** una aplicación distinta — detectar productos duplicados (mismo significado, distinto nombre).

### 4.1. Setup

Te dan 5 nombres de producto que **podrían** ser duplicados:

```typescript
const NEW_PRODUCTS = [
  "Mochila técnica para excursiones de varios días",  // ← ¿es como Summit 65L?
  "Linterna LED frontal con batería USB",              // ← ¿es como Lumin 400?
  "Saco de dormir invierno -10°C",                     // ← producto nuevo
  "Mochila ergonómica trekking 1-2 días",              // ← ¿es como Trekker 30L?
  "Tienda canadiense 3 personas",                      // ← ¿es como Tienda 2P?
];
```

### 4.2. Tu tarea

`src/duplicate-detection.ts`:

1. Para cada producto candidato, embedealo.
2. Calcula similitud contra los 12 productos del catálogo existente.
3. Si la mejor similitud > 0.85, márcalo como "probable duplicado".
4. Imprime el reporte.

### 4.3. Probarlo

```bash
pnpm run duplicates
```

Salida esperada (aproximada):

```
"Mochila técnica para excursiones de varios días"
  Mejor match: Mochila Summit 65L (0.87)
  → PROBABLE DUPLICADO

"Linterna LED frontal con batería USB"
  Mejor match: Linterna Frontal Lumin 400 (0.91)
  → PROBABLE DUPLICADO

"Saco de dormir invierno -10°C"
  Mejor match: Forro polar Therm-200 (0.48)
  → producto nuevo, no hay duplicado claro

"Mochila ergonómica trekking 1-2 días"
  Mejor match: Mochila Trekker 30L (0.92)
  → PROBABLE DUPLICADO

"Tienda canadiense 3 personas"
  Mejor match: Tienda 2P Ultra-Light (0.81)
  → similar pero no duplicado claro (revisar manual)
```

### 4.4. Pregunta para ti

Tu sistema marca "Tienda canadiense 3 personas" con 0.81 — está justo abajo del umbral 0.85. ¿Por qué no es trivial decidir si es duplicado o no? Pensá en al menos 2 razones.

> **Razonamiento:**
>
> 1. **El umbral 0.85 es arbitrario.** No hay un valor universal — sale del eval set y depende del modelo, dominio e idioma.
> 2. **"3 personas" vs "2 personas" es una diferencia OPERACIONALMENTE importante** (capacidad de uso) pero TEXTUALMENTE menor — embeddings no distinguen bien matices numéricos.
> 3. **Por eso la deduplicación nunca es 100% automática.** Lo correcto: usar embeddings para flagear candidatos a revisión humana, no para decidir solo.
> 4. **Hybrid: combinar similitud semántica + reglas de negocio** (capacidad, marca, precio) da mejor precisión.

---

## 5. Aporte al proyecto integrador

**Esta sesión NO modifica TiendaPro.** El cambio llega en S08 cuando tengamos pgvector listo y podamos persistir embeddings.

Lo que sí puedes hacer ahora — opcional — es escribir 3 queries de TiendaPro que tu keyword search actual NO resuelve y que querrías ver funcionando en S08. Las usaremos como casos de regresión cuando migremos a búsqueda semántica.

> Mantenelo en local. Sin commit hasta el cierre M3.

---

**Vuelve a:** [`README de la sesión`](README.md) | **Próximo paso:** [`recursos.md`](recursos.md).
