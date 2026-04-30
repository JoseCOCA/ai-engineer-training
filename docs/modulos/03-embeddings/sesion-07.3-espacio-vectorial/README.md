# Sesión 07.3 — Espacio vectorial, búsqueda semántica y pre-procesamiento

> **Módulo:** 3 — Embeddings y búsqueda vectorial · **Duración estimada:** 1.5h (~40 min lectura + ~50 min práctica) · **Formato:** 60% teoría / 40% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión podrás:

- Razonar sobre la **geometría del espacio vectorial** donde viven los embeddings y entender qué significa "cerca" o "lejos" en alta dimensión.
- Elegir entre **coseno, dot product, distancia L2 y Manhattan** según el caso, y reconocer cuándo son equivalentes.
- Implementar **búsqueda semántica end-to-end** combinando top-K con un threshold mínimo de similitud.
- **Calibrar un threshold** usando la distribución empírica de similitudes positivas vs negativas, en lugar de adivinar.
- Distinguir qué pasos de **pre-procesamiento de texto** ayudan con embeddings densos y cuáles son herencia obsoleta del NLP clásico.
- Identificar los **casos donde la búsqueda semántica falla** (SKUs, negaciones, números) y planear una mitigación operativa.

## 2. Prerequisitos

- **S06** (qué es un embedding y similitud coseno), **S07.1** (chunking) y **S07.2** (modelos y dimensiones) completas.
- El catálogo de TiendaPro (mismos 12 productos que en S07.2). Lo reutilizamos como corpus de los ejercicios.

## 3. Conceptos clave

- **Métrica de distancia:** función `(vector, vector) → número` que cuantifica cercanía. Las cuatro que importan en práctica: coseno, dot product, L2 (euclidiana), L1 (Manhattan).
- **Curse of dimensionality:** en alta dimensión, casi todos los pares de vectores aleatorios están a distancias parecidas. La consecuencia operativa: el contraste entre el "más cercano" y el "promedio" se aplana, y los thresholds absolutos se vuelven frágiles.
- **Top-K:** estrategia de retrieval que devuelve los K resultados con mayor similitud, sin importar el valor absoluto.
- **Threshold:** umbral mínimo de similitud por debajo del cual un resultado se descarta como "no relevante".
- **Híbrido top-K + threshold:** patrón profesional. Pides los K más cercanos y filtras los que estén por debajo del umbral.
- **Hybrid search (denso + léxico):** combinar embeddings con BM25 / búsqueda por keyword. Resuelve los casos donde el embedding solo no alcanza. Lo profundizamos en M4.

## 4. Teoría

### 4.1. El espacio vectorial — la intuición

Cada modelo de embeddings define un espacio de N dimensiones donde cada texto del corpus es un punto. Toda decisión de retrieval se reduce a **medir cercanía entre puntos**.

#### Cómo se ve este espacio

En 2 dimensiones es trivial: dos vectores son "cercanos" si el ángulo entre ellos es chico o si su distancia euclidiana es chica. En 768, 1536 o 3072 dimensiones, la intuición visual deja de aplicar y necesitas confiar en las métricas. Pero hay tres propiedades del espacio que conviene entender:

1. **No es uniforme.** Los modelos modernos colocan los vectores de texto natural en una **región acotada** (típicamente cerca de la superficie de una hiperesfera de radio 1, porque casi todos devuelven vectores normalizados — ver S07.2.4.3). Vectores aleatorios no se parecen en nada al output real del modelo.
2. **Es anisotrópico.** Algunas direcciones del espacio son "más densas" (muchos textos cerca) y otras casi vacías. Las primeras dimensiones del vector tienden a capturar variabilidad genérica (largo del texto, registro), las posteriores capturan matices semánticos más finos.
3. **La distancia absoluta no significa nada por sí sola.** Una similitud coseno de `0.65` puede ser "muy alta" en un modelo y "media" en otro (lo viste en S07.2.1). Lo que importa es **el ranking dentro del mismo modelo y el contraste con la distribución de tu corpus**.

#### La maldición de la dimensionalidad — qué te afecta y qué no

En la teoría, en alta dimensión los vectores aleatorios convergen a estar todos a la misma distancia. La consecuencia naive sería que retrieval no funciona. En la práctica con embeddings:

- **Los vectores de texto natural NO son aleatorios.** Viven en un manifold (subespacio curvo) de mucha menor dimensión efectiva. Por eso el retrieval funciona.
- **Lo que sí te afecta:** los **valores absolutos de similitud comprimen su rango**. En 384 dim puedes ver similitudes en `[0.3, 0.95]`; en 3072 dim el mismo corpus puede caer en `[0.55, 0.92]`. **Tus thresholds tienen que ser específicos al modelo y la dimensión.**

> **Patrón:** nunca migres de modelo y reutilices el threshold viejo. Re-calibra siempre.

### 4.2. Métricas de distancia — cuál usar y cuándo

Cuatro métricas dominan. Las dos primeras son las que vas a usar el 99% del tiempo.

#### A. Similitud coseno

Mide el ángulo entre dos vectores ignorando la magnitud:

```
cos(a, b) = (a · b) / (||a|| · ||b||)
```

- Rango: `[-1, 1]` (en práctica con embeddings de texto, `[0, 1]` porque casi nunca aparecen vectores opuestos).
- **Ignora la magnitud:** dos textos del mismo significado dan cos `≈ 1` aunque tengan magnitudes distintas.
- **Default profesional para texto.** Es lo que asume la mayoría de las bases vectoriales y de los benchmarks.

#### B. Dot product

```
dot(a, b) = a · b
```

- Sin normalizar el resultado por las magnitudes.
- **Sobre vectores normalizados (||a|| = ||b|| = 1), dot product y coseno son idénticos.** La mayoría de los modelos modernos devuelven vectores normalizados → puedes usar dot product, que es **más rápido** porque te ahorras dos raíces cuadradas.
- **Sobre vectores no normalizados, dot product favorece magnitudes grandes.** Si un vector es "más largo" gana ranking sin que el contenido sea más relevante. Es un sesgo a evitar salvo que sepas lo que haces.

#### C. Distancia euclidiana (L2)

```
L2(a, b) = sqrt( Σ (a_i - b_i)² )
```

- Rango: `[0, ∞)`. `0` = idéntico, mayor = más lejano.
- **Sobre vectores normalizados, L2 y coseno son equivalentes en ranking** (relacionados por una transformación monótona). Producen el mismo orden — el "más cercano" en L2 es el "más similar" en coseno.
- **Sobre vectores no normalizados, L2 también penaliza diferencias de magnitud**, no solo de dirección.

#### D. Distancia Manhattan (L1)

```
L1(a, b) = Σ |a_i - b_i|
```

- Suma absoluta de diferencias por dimensión.
- **Raramente usada con embeddings densos.** Tiene su lugar en otros campos (imágenes, ML clásico) pero para texto, coseno y dot dominan.

#### Tabla de decisión

| Caso | Métrica recomendada | Por qué |
|------|---------------------|---------|
| Vectores normalizados (default moderno) | **Dot product** | Equivalente a coseno, más rápido |
| Vectores no normalizados | **Coseno** | Ignora magnitud, más estable |
| Base vectorial con índice nativo (pgvector, Qdrant) | **La que el índice optimiza** | HNSW con coseno suele ser la combinación documentada |
| Eval / debugging | **Coseno** | Rango interpretable `[-1, 1]` |

> **Regla operativa:** verifica si el modelo devuelve vectores normalizados (calcula `Σ x²` sobre cualquier vector — si da `1.0 ± 0.001`, está normalizado). Si lo está, usa dot product en producción y coseno para análisis. Si no, normaliza tú en el wrapper antes de indexar.

### 4.3. Búsqueda semántica end-to-end

Con un corpus indexado y una métrica elegida, la consulta sigue siempre el mismo patrón:

```
1. Embed de la query                 → vector_q
2. Comparar vector_q con cada vec_i  → score_i
3. Ordenar por score descendente
4. Devolver los K mejores            → top-K
```

La pregunta de ingeniería no es **cómo** sino **cuántos resultados devolver y bajo qué criterio**. Hay tres estrategias.

#### A. Top-K puro

Devolver los K más cercanos sin importar el valor absoluto.

- **Ventaja:** simple, predecible, siempre devuelve algo.
- **Desventaja:** si la query no tiene resultados relevantes, devuelves K basura igual. El consumidor (LLM, UI) tiene que filtrar.

#### B. Threshold puro

Devolver todos los resultados con `score >= τ` (umbral fijo).

- **Ventaja:** "calidad" garantizada por el umbral.
- **Desventaja:** algunas queries devuelven 0 resultados, otras 200. UX inconsistente. Y el threshold global es muy frágil (ver 4.4).

#### C. Híbrido top-K + threshold mínimo (recomendado)

```
top_k_results = top_K(query, K=10)
relevant      = [r for r in top_k_results if r.score >= τ_min]
return relevant
```

- Pides un K generoso (10-20) y filtras por umbral.
- **Si nada pasa el umbral, devuelves vacío y el consumidor decide qué hacer** (responder "no encontré nada", caer a búsqueda léxica, derivar a humano).
- Es el patrón que vamos a usar en M4 cuando ataquemos RAG.

> **Regla:** la decisión de qué hacer con un retrieve vacío vive arriba del retriever, no adentro. El retriever devuelve lo que hay. La política la define la app.

### 4.4. Threshold de similitud — el punto de corte

¿Cuánto vale `τ_min`? La respuesta seria es **mídelo, no lo adivines**.

#### Por qué los thresholds globales son trampa

"Usa siempre 0.7" es un consejo que vas a leer en blogs y que se rompe en cuanto cambias de modelo, dominio o idioma. Razones:

1. **Cada modelo distribuye sus similitudes en un rango distinto** (vimos en S07.2.1 que Gemini suele estar en rangos más bajos que OpenAI para los mismos pares).
2. **Cada dominio tiene su escala.** Tu catálogo outdoor puede tener pares relevantes en `[0.55, 0.85]` y pares irrelevantes en `[0.35, 0.55]`. En FAQs legales, los relevantes pueden empezar en `0.75`.
3. **Cada idioma cambia la distribución.** Modelos multilingües tienden a producir scores más bajos en cross-lingüe que en mono-lingüe.

#### Cómo se calibra un threshold — el procedimiento

Necesitas dos conjuntos pequeños y curados:

1. **Pares positivos:** ~30-50 pares `(query, doc)` donde el doc ES la respuesta correcta para la query. Etiquetados a mano.
2. **Pares negativos:** ~30-50 pares donde el doc NO es relevante. Pueden ser pares aleatorios del corpus.

Luego:

```
1. Embed todos los textos.
2. Calcula la similitud coseno de cada par.
3. Plotea la distribución (histograma) de positivos vs negativos.
4. Identifica el punto de corte donde se cruzan las distribuciones.
```

```
Distribución típica:
      Negativos                          Positivos
        ▓▓▓▓▓                             ░░░░░
        ▓▓▓▓▓▓▓▓                        ░░░░░░░░░
        ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░         ░░░░░░░░░░░░░
       0.30      0.50      0.65    0.75      0.90
                          ↑ τ ≈ 0.65 (punto de mínimo solapamiento)
```

> **Nota práctica:** rara vez las distribuciones son disjuntas. Hay zona gris donde coexisten relevantes y no relevantes. Tu elección de τ es una decisión de **trade-off precision vs recall**:
> - τ alto → menos falsos positivos, pierdes algunos relevantes (precision alta, recall baja).
> - τ bajo → atrapas todos los relevantes pero entran negativos (recall alta, precision baja).
> En RAG, **cuesta más alucinar que omitir**. Empieza con τ alto y bájalo si el sistema responde "no sé" demasiado seguido.

En el **ejercicio 2** de esta sesión vas a calibrar τ sobre TiendaPro y ver el histograma en consola.

### 4.5. Pre-procesamiento de texto — qué SÍ y qué NO

El NLP clásico (pre-2018, antes de BERT) limpiaba el texto agresivamente: lowercase, quitar puntuación, quitar stop words, stemming. Con embeddings densos modernos, **la mayoría de esos pasos hacen daño o son irrelevantes**. Razón: el modelo ya vio inglés/español "natural" durante entrenamiento, con mayúsculas, puntuación y palabras funcionales. Si le das texto distinto al de entrenamiento, lo confundes.

#### Lo que SÍ ayuda

| Paso | Por qué | Cuándo aplicarlo |
|------|---------|------------------|
| **Quitar HTML / Markdown ruido** | El modelo embedearía `<div class="...">` como texto literal | Antes de chunking |
| **Normalizar Unicode (NFC)** | `ñ` puede llegar como dos codepoints distintos según fuente | Siempre |
| **Colapsar whitespace** | Múltiples espacios o saltos no aportan, ocupan tokens | Siempre |
| **Deduplicar chunks idénticos** | Mismos vectores ocupan storage y diluyen retrieval | Después de chunking, antes de indexar |
| **Truncar al límite del modelo** | El modelo silenciosamente trunca a 512/8192 tokens — si no controlas tú, pierdes visibilidad | Antes de embed |
| **Adjuntar metadata estructural en el texto** | "Categoría: mochilas. Producto: ..." mejora retrieval cuando el query menciona la categoría | Caso por caso |

#### Lo que NO se hace (con embeddings densos modernos)

| Paso | Por qué no |
|------|-----------|
| **Lowercase agresivo** | Algunos modelos son case-sensitive (BERT base). El casing aporta señal: "Apple" vs "apple". Salvo que el modelo sea explícitamente uncased, **dejá el casing original**. |
| **Remover stop words** ("el", "la", "de") | Los modelos modernos las usan para entender estructura sintáctica. Quitarlas degrada la calidad. |
| **Stemming / lemmatización** | El tokenizer del modelo ya maneja morfología vía subpalabras (BPE, WordPiece). Stemming destruye señal. |
| **Quitar toda puntuación** | "Soy un médico" vs "Soy, un médico" cambian sutilmente. Los modelos lo aprovechan. |
| **Traducir todo al inglés "porque el modelo es mejor en inglés"** | Si el modelo es multilingüe, pierdes la riqueza del original. Si no es multilingüe, elige otro modelo. |

> **Regla:** si tienes dudas, embedea el texto **tal como lo recibes**. Los pre-procesamientos clásicos del NLP son optimizaciones para modelos viejos. Los modelos densos modernos prefieren ver la entrada cruda.

#### Tres excepciones a la regla "no preproceses"

1. **Texto generado por máquina:** logs, JSON, XML — sí preprocesa, porque el modelo no fue entrenado en ese formato.
2. **Texto extremadamente ruidoso:** OCR de calidad baja, transcripciones automáticas con errores. Hay que limpiar ortografía obvia.
3. **Texto en idiomas raros para tu modelo:** si tu modelo no fue entrenado fuerte en el idioma del corpus, considera traducir o cambiar de modelo.

### 4.6. Cuándo la búsqueda semántica falla — y qué hacer

La búsqueda por embeddings es poderosa pero no es bala de plata. Hay clases enteras de queries donde **falla sistemáticamente**.

#### A. Identificadores opacos (SKUs, códigos, IDs)

```
Query: "TP-MOCH-01"
```

Un SKU no tiene "significado" semántico — es una etiqueta arbitraria. El modelo no fue entrenado con tu nomenclatura, así que el embedding del SKU no se parece al embedding de la mochila.

**Mitigación:** detectar el patrón (regex `^[A-Z]+-[A-Z]+-\d+$`) y caer a búsqueda por keyword exacta sobre el campo `id`. NO mezclar este path con el retrieval semántico.

#### B. Negaciones

```
Query: "mochila sin compartimento para laptop"
Top resultado: Mochila City Daypack 18L (CON compartimento para laptop)
```

Los embeddings densos **capturan mal las negaciones**. El modelo ve "mochila" + "compartimento" + "laptop" y devuelve productos que mencionan esas palabras — el "sin" se diluye.

**Mitigación:**
- Detección de negaciones en la query con un clasificador chico o con el LLM (puedes pedirle al LLM que reescriba la query separando lo deseado de lo descartado).
- Re-ranking con LLM sobre el top-K: "de estos productos, ¿cuáles cumplen 'sin compartimento para laptop'?".
- Filtrar por metadata estructurada cuando exista (`has_laptop_sleeve: false`).

#### C. Números y unidades

```
Query: "mochila de 30 litros"
```

A veces funciona, a veces no. Los modelos grandes (Gemini, OpenAI 3-large) capturan números relativamente bien en contextos comunes; los chicos (MiniLM) los confunden. **Nunca confíes en que "30L" matchea exactamente con "30 litros".**

**Mitigación:** extraer parámetros estructurados de la query (LLM) y filtrar por metadata antes del retrieval semántico (`capacity_liters >= 25 AND <= 35`).

#### D. Términos del dominio raros

```
Query: "tienda con vestíbulo"   (en outdoor, "vestíbulo" es el porche externo de la tienda)
```

Si el modelo nunca vio "vestíbulo" en este sentido durante entrenamiento, no va a relacionarlo con tiendas de campaña.

**Mitigación:**
- Glosario de dominio: en el chunk del producto, agregar sinónimos del dominio ("vestíbulo, porche, área cubierta exterior").
- Fine-tuning del embedder con tu corpus (avanzado, M4-M5).

#### El patrón general — hybrid search

Las tres mitigaciones convergen en una idea: **la búsqueda densa sola no alcanza para todos los casos**. La solución profesional es **combinarla con búsqueda léxica** (BM25, full-text search) y, opcionalmente, con filtros estructurados.

```
              Query
                |
        ┌───────┴───────┐
        ▼               ▼
  Búsqueda densa    Búsqueda léxica (BM25)
  (top-30 por       (top-30 por keyword
   similitud)        match)
        │               │
        └──────┬────────┘
               ▼
          Fusión (RRF, weighted sum)
               │
               ▼
        Re-ranking (opcional)
               │
               ▼
            Top-K final
```

En **M4 (S10 — técnicas avanzadas de recuperación)** vamos a implementar este pipeline. Por ahora, suficiente con saber que existe y que la búsqueda densa pura es el **piso**, no el techo.

## 5. Patrones y antipatrones

### Patrones

- **Normaliza una vez al ingestar y trabaja con dot product en queries.** Te ahorra cómputo en el path caliente.
- **Calibra el threshold con datos reales antes de exponer el feature.** Sin calibración, vas a ciegas.
- **Devuelve K=10-20 y filtra por threshold.** Mejor que K fijo o threshold puro.
- **Loguea el score del top-1 y del top-K-th** en cada retrieval. Te alerta cuándo la calidad se degrada (drift de modelo, drift de corpus).
- **Pre-procesa solo lo mínimo:** HTML, Unicode, espacios. El resto, déjalo crudo.
- **Tipa explícitamente las clases de query que vas a fallar** (SKUs, negaciones, números) y rutea cada una a la solución adecuada antes de llegar al retrieval semántico.

### Antipatrones

- **Usar el threshold del blog post de turno** sin medir tu corpus. Cada modelo + dominio + idioma tiene su distribución.
- **Lowercase, stop words, stemming "porque siempre se hizo así".** Es herencia del NLP pre-BERT. Los modelos modernos prefieren texto crudo.
- **Confundir top-K con threshold.** Son herramientas distintas para problemas distintos. Combina ambas.
- **Asumir que las similitudes son comparables entre modelos.** Cada modelo vive en su espacio. Los números absolutos no se traducen.
- **Tratar la búsqueda semántica como bala de plata.** Tiene fallos predecibles (SKUs, negaciones). Diseña la app sabiendo que vas a necesitar híbrido tarde o temprano.
- **Calibrar el threshold "una vez y para siempre".** Si cambias el modelo, el corpus o el idioma dominante, recalibra.

## 6. Conexión con TiendaPro

Esta sesión NO modifica TiendaPro pero deja documentadas tres decisiones que aplicaremos en S08:

1. **Métrica:** dot product en producción (Gemini devuelve vectores normalizados), coseno en eval/debugging. pgvector soporta ambas con índices HNSW.
2. **Threshold inicial sugerido:** del orden de `0.55-0.65` para Gemini sobre el catálogo outdoor. El **ejercicio 2** te lo refina con datos reales.
3. **Estrategia de retrieval:** top-K=10 + threshold mínimo. Si el resultado queda vacío, el consumidor (asistente conversacional de M4) responde "no encontré productos relevantes" en lugar de inventar.

Los casos de fallo (SKUs, negaciones) van a aparecer en M4. Los anotamos como deuda conocida y los resolvemos cuando armemos el retriever híbrido.

## 7. Resumen

Tres ideas para llevarte:

1. **El espacio vectorial existe pero no le creas las distancias absolutas.** Las similitudes coseno entre modelos no son comparables, y la calibración del threshold tiene que hacerse contra tu corpus, con tu modelo, con tu dominio.
2. **Pre-procesar texto para embeddings densos es casi todo lo contrario de pre-procesar para keyword search.** Limpia HTML y Unicode; deja casing, puntuación y stop words. La intuición del NLP clásico te lleva por el camino equivocado.
3. **La búsqueda densa pura tiene fallos predecibles.** SKUs, negaciones, números, jerga. Diseña la app sabiendo que un retriever híbrido (denso + léxico) es el destino, y que en M4 lo armas.

## 8. Preguntas de auto-evaluación

1. Tu modelo devuelve vectores normalizados. Estás eligiendo entre coseno y dot product para el path de query. ¿Cuál usas y por qué?
2. Migras el sistema de OpenAI text-embedding-3-small a Gemini Embedding. ¿Qué tienes que rehacer respecto al threshold? ¿Por qué?
3. Tu equipo propone agregar un paso de "lowercase + remove stop words" antes de embedear, "para limpiar el ruido". ¿Qué argumento técnico das para rechazarlo?
4. Una query de usuario es `"TP-MOCH-01"`. Tu retrieval semántico devuelve productos no relacionados. ¿Por qué falla y cómo lo resuelves sin tocar el modelo de embeddings?
5. En tu calibración de threshold, las distribuciones de pares positivos y negativos se solapan en el rango `[0.55, 0.70]`. Eligiendo `τ = 0.55` o `τ = 0.70`, ¿qué trade-off estás aceptando? Para un sistema de RAG, ¿cuál prefieres?
6. Tu base vectorial soporta tanto L2 como coseno como métrica de índice. Estás indexando vectores normalizados de Gemini. ¿Importa cuál eliges? Justifica.

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 4 ejercicios prácticos sobre el catálogo de TiendaPro.

**Próxima sesión:** [`S08 — Bases de datos vectoriales`](../sesion-08-bases-vectoriales/) → cómo se almacenan e indexan vectores en producción (pgvector, Qdrant), índices HNSW/IVF, y armado del primer índice de TiendaPro.
