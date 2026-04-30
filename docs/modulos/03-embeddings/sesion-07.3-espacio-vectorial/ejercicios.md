# Sesión 07.3 — Ejercicios

> **Tiempo estimado:** ~50 min total. Comparas métricas de distancia, calibras un threshold, mides el efecto del pre-procesamiento y reproduces casos de fallo de la búsqueda semántica. Scripts en [`code/m03-embeddings/sesion-07.3/`](../../../../code/m03-embeddings/sesion-07.3/).

---

## Setup

```bash
cd code/m03-embeddings/sesion-07.3
pnpm install
```

`.env` con `GOOGLE_GENERATIVE_AI_API_KEY` (obligatorio). No se necesita ninguna otra variable. Todos los scripts corren en TypeScript contra el catálogo de TiendaPro (12 productos).

---

## 1. Ejercicio guiado: coseno vs dot vs L2 sobre el mismo corpus

**Objetivo:** verificar empíricamente que coseno, dot product y L2 producen el **mismo ranking** sobre vectores normalizados, y observar qué cambia cuando los vectores no están normalizados.

### 1.1. Probarlo

```bash
pnpm run compare-distances
```

El script:

1. Embedea los 12 productos con Gemini Embedding (768D, vectores normalizados).
2. Para 3 queries, calcula el top-5 con coseno, dot product y L2.
3. Repite el cálculo con los mismos vectores **desnormalizados artificialmente** (multiplicados por una magnitud aleatoria por vector) para mostrar el sesgo del dot product cuando las magnitudes varían.

### 1.2. Salida esperada (snippet)

```
Query: "algo para cargar mis cosas en una caminata"

Sobre vectores normalizados:
  Coseno:  Mochila Trekker 30L | Mochila Summit 65L | Mochila City Daypack 18L
  Dot:     Mochila Trekker 30L | Mochila Summit 65L | Mochila City Daypack 18L
  L2:      Mochila Trekker 30L | Mochila Summit 65L | Mochila City Daypack 18L
  → Los 3 rankings son idénticos. ✓

Sobre vectores DES-normalizados artificialmente:
  Coseno:  Mochila Trekker 30L | Mochila Summit 65L | Mochila City Daypack 18L
  Dot:     Mochila Summit 65L | Mochila Trekker 30L | Hornillo Compact Gas
  L2:      Mochila Trekker 30L | Hornillo Compact Gas | Mochila Summit 65L
  → Coseno se mantiene; dot y L2 se rompen porque las magnitudes mandan.
```

### 1.3. Pregunta para ti

Si tu modelo devuelve vectores normalizados, ¿qué métrica eliges en producción y por qué?

> **Razonamiento:**
>
> - **Dot product en producción:** equivalente a coseno con vectores normalizados, pero ahorra dos raíces cuadradas por comparación. En millones de queries, el ahorro suma.
> - **Coseno en eval/debugging:** el rango `[-1, 1]` es interpretable de un vistazo. Útil cuando estás analizando resultados a mano.
> - **L2 cuando tu base vectorial lo optimiza nativamente:** algunos índices HNSW están más afinados para L2 que para dot. Dado que sobre vectores normalizados producen el mismo ranking, vas con la métrica que el motor optimiza.
>
> **Lo que no se hace:** elegir L2 sobre vectores no normalizados pensando que "es más matemáticamente correcto". Sobre vectores no normalizados, las magnitudes contaminan el ranking. Si tu modelo no normaliza, normaliza tú antes de indexar.

---

## 2. Ejercicio: calibrar un threshold con datos reales

**Objetivo:** usar un set chico de pares etiquetados (positivos vs negativos) para calibrar el threshold de similitud sobre TiendaPro con Gemini.

### 2.1. Probarlo

```bash
pnpm run threshold-calibration
```

El script:

1. Lee `data/labeled-pairs.json` con ~30 pares etiquetados como `relevant` o `irrelevant`.
2. Embedea queries y productos.
3. Calcula la similitud coseno de cada par.
4. Imprime un **histograma en consola** de la distribución de positivos vs negativos.
5. Sugiere un threshold basado en el percentil 5 de los positivos (descarta el 5% más bajo de los relevantes pero asegura recall alto).

### 2.2. Salida esperada (snippet)

```
=== Distribución de similitudes ===

  0.30 |                                         ░░░
  0.35 |                                       ░░░░░░░
  0.40 |                                   ░░░░░░░░░░░░░    ← negativos
  0.45 |                              ░░░░░░░░░░░░░░░░
  0.50 |                          ░░░░░░░░░░░░░
  0.55 |                       ░░░░░░░       ▓▓▓
  0.60 |                                  ▓▓▓▓▓▓▓
  0.65 |                              ▓▓▓▓▓▓▓▓▓▓▓▓▓        ← positivos
  0.70 |                          ▓▓▓▓▓▓▓▓▓▓▓
  0.75 |                       ▓▓▓▓▓▓▓
  0.80 |                  ▓▓▓▓
        +───────────────────────────────────────────────

Negativos:  μ=0.42  σ=0.06  máx=0.58
Positivos:  μ=0.68  σ=0.05  mín=0.55  p5=0.57

Threshold sugerido (p5 de positivos): τ = 0.57
Falsos negativos esperados: 5% de positivos descartados.
Falsos positivos esperados: ~3% de negativos sobre el umbral.
```

### 2.3. Pregunta para ti

¿Por qué `p5` de los positivos y no la media o la mediana? ¿En qué caso elegirías un percentil más alto o más bajo?

> **Razonamiento:**
>
> - **`p5` (percentil 5)** garantiza que **95% de los positivos pasan** el umbral. Es un trade-off conservador en favor de recall. Para RAG, es lo que quieres: cuesta más perder un doc relevante que dejar entrar uno borderline.
> - **Si tu distribución de positivos tiene cola larga inferior** (algunos positivos con score muy bajo, posiblemente mal etiquetados), `p5` te incluye basura y conviene subir a `p10` o `p20`.
> - **Si tu app es muy estricta** (asistente legal donde alucinar cuesta caro), prefieres `p25` o incluso la mediana — pierdes recall, pero los retrieves que entran son altamente confiables.
> - **Si tienes pocos positivos etiquetados** (<20), no uses percentiles bajos — el ruido del muestreo te puede dar un threshold absurdo. Usa la mediana y revísalo cuando tengas más datos.

---

## 3. Ejercicio: ¿cuánto importa pre-procesar?

**Objetivo:** medir empíricamente cuánto cambia el embedding (y el ranking) según cómo trates el texto antes de embedear.

### 3.1. Probarlo

```bash
pnpm run preprocess-test
```

El script toma una query (`"Algo para CARGAR mis cosas, en una caminata!!"`) y la embedea bajo 4 variantes:

1. **Original** (tal cual, con mayúsculas y puntuación).
2. **Lowercased** (`"algo para cargar mis cosas, en una caminata!!"`).
3. **Sin puntuación** (`"Algo para CARGAR mis cosas en una caminata"`).
4. **Sin stop words** (`"Algo CARGAR cosas caminata"` — usando lista heurística básica).

Para cada variante imprime el top-3 contra el catálogo y la similitud del top-1 vs `original`.

### 3.2. Salida esperada (snippet)

```
Query original: "Algo para CARGAR mis cosas, en una caminata!!"

Variante               | Top-3                                                    | sim(top1) vs original
-----------------------|----------------------------------------------------------|----------------------
original               | Trekker 30L | Summit 65L | City Daypack 18L              | 1.0000 (referencia)
lowercased             | Trekker 30L | Summit 65L | City Daypack 18L              | 0.9982
sin puntuación         | Trekker 30L | Summit 65L | City Daypack 18L              | 0.9994
sin stop words         | Bastones AluZ | Trekker 30L | Linterna Frontal           | 0.8731  ← rompe el ranking
```

### 3.3. Pregunta para ti

¿Cuál de los 4 pre-procesamientos vale la pena aplicar y cuál es claramente nocivo? Justifica con los números.

> **Razonamiento:**
>
> - **Lowercase y sin puntuación cambian el embedding marginalmente** (similitud > 0.99 con el original) y mantienen el ranking. **Marginalmente útil, no claramente nocivo.** Si tu pipeline ya hace lowercase por otros motivos, no rompe nada — pero tampoco gana mucho.
> - **Quitar stop words rompe el ranking.** El score del top-1 cae a `0.87` y el orden cambia: aparece "Bastones" arriba porque "caminata" y "cargar" son las palabras dominantes una vez quitadas las funcionales, y eso desambigua mal. **Antipatrón claro.**
> - **Conclusión operativa:** confía en el modelo. Pre-procesa solo lo que el modelo no entendería: HTML, ruido binario, encodings raros. Lowercase, puntuación y stop words son optimizaciones del NLP pre-2018 que no aplican a embeddings densos modernos.

---

## 4. Ejercicio: reproducir los modos de fallo

**Objetivo:** ver los tres casos donde la búsqueda semántica falla en TiendaPro: SKU como query, negación, número fuera de contexto.

### 4.1. Probarlo

```bash
pnpm run failure-modes
```

El script ejecuta tres queries problemáticas:

1. `"TP-MOCH-01"` — un SKU literal. Top-3 esperado: productos no relacionados con la mochila Trekker.
2. `"mochila sin compartimento para laptop"` — negación. Top-1 esperado: la City Daypack 18L (que SÍ tiene compartimento para laptop).
3. `"mochila de 30 litros"` — exigencia numérica. Resultado: la Trekker 30L aparece pero también las otras mochilas con casi el mismo score, sin que el modelo distinga la capacidad.

Para cada query imprime el top-3 con score y un comentario sobre por qué falló.

### 4.2. Salida esperada (snippet)

```
Query: "TP-MOCH-01"
  1. Mochila City Daypack 18L     (0.41)
  2. Hornillo Compact Gas         (0.39)
  3. Linterna Frontal Lumin 400   (0.38)
→ El SKU no tiene significado semántico para el embedder.
  Mitigación: regex sobre el patrón ^TP-[A-Z]+-\d+$ y match exacto por id.

Query: "mochila sin compartimento para laptop"
  1. Mochila City Daypack 18L     (0.71)   ← TIENE compartimento para laptop (fallo)
  2. Mochila Trekker 30L          (0.65)
  3. Mochila Summit 65L           (0.63)
→ La negación se diluyó. El modelo embedeó "mochila + compartimento + laptop".
  Mitigación: parser de query (LLM) que separa "deseado" de "descartado",
  o filtro post-retrieval por metadata estructurada.

Query: "mochila de 30 litros"
  1. Mochila Trekker 30L          (0.74)
  2. Mochila Summit 65L           (0.69)   ← 65L, NO es lo pedido
  3. Mochila City Daypack 18L     (0.66)
→ El embedder captura "mochila" pero "30 litros" no domina sobre la similitud
  general entre las 3 mochilas. Mitigación: extraer "capacity_liters: 30"
  con un parser y filtrar por metadata antes del retrieval semántico.
```

### 4.3. Pregunta para ti

De los tres casos, ¿cuál te parece el más urgente de mitigar en TiendaPro y por qué? ¿Cuál sería tu primer plan de mitigación realista (sin tocar el modelo)?

> **Razonamiento sugerido:**
>
> - **El más urgente probablemente es la negación.** Es el caso donde el sistema responde "lo opuesto" de lo que el cliente pidió, y el cliente lo va a notar. SKU + número son fallos "obvios" donde el cliente reformula; la negación es un fallo silencioso que erosiona la confianza.
> - **Plan realista (sin tocar el embedder):** en el wrapper del retriever, antes de embedear la query:
>   1. Detección de patrón SKU (regex) → match exacto por id.
>   2. Detección de query con negación ("sin", "no", "excepto") → reformulación con un LLM a "deseado / descartado" y filtro post-retrieval.
>   3. Extracción de números + unidades → filtros estructurados sobre metadata del producto.
> - **Profundización en M4:** el patrón profesional combina todo lo anterior con BM25 sobre el campo nombre del producto. Hybrid search es la forma estándar de cerrar estos huecos.

---

## 5. Aporte al proyecto integrador

Esta sesión NO modifica TiendaPro. Lo que aporta:

1. **Threshold inicial calibrado:** ~`0.55-0.60` para Gemini Embedding sobre el catálogo (resultado del ejercicio 2). Lo vamos a usar en S08 cuando armemos el primer retrieve sobre pgvector.
2. **Lista de modos de fallo conocidos** (SKUs, negaciones, números) que vamos a anotar como deuda y resolver en M4 con hybrid search + parsers de query.
3. **Política de pre-procesamiento:** mínima (HTML, Unicode, espacios). Sin lowercase, sin stop-words, sin stemming. Documentado para futuras sesiones.

---

**Vuelve a:** [`README de la sesión`](README.md) | **Próximo paso:** [`recursos.md`](recursos.md).
