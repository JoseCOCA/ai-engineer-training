# Sesión 06 — Por qué embeddings: del texto al vector

> **Módulo:** 3 — Embeddings y búsqueda vectorial · **Duración estimada:** 2h (~50 min lectura + ~70 min práctica) · **Formato:** 50% teoría / 50% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión podrás:

- Explicar **por qué la búsqueda por keyword falla** en muchos casos reales y qué problema resuelve la búsqueda semántica.
- Definir qué es un **embedding** desde el punto de vista operacional: una función `text → vector` aprendida que preserva similitud semántica.
- Calcular **similitud entre dos textos** usando coseno, y razonar sobre cuándo usar coseno vs dot product vs distancia L2.
- Reconocer las **4 aplicaciones canónicas** de embeddings: búsqueda semántica, clustering, recomendación, clasificación.
- Diseñar el **pipeline básico** texto → embed → index → query → retrieve, y entender dónde gastas tiempo y dinero en cada etapa.

## 2. Prerequisitos

- Módulos 1 y 2 completos. En particular **S05.1 — Inyección de contexto** (introdujimos query-then-inject con keyword filter; en M3 lo cambiamos por búsqueda semántica).
- Familiaridad con álgebra lineal a nivel intuición (qué es un vector, qué es producto punto). NO requerimos saber LinAlg avanzada.

## 3. Conceptos clave

- **Embedding (vector denso):** representación numérica de un texto en un espacio de N dimensiones (típicamente 384, 768, 1536, 3072) donde **textos con significado similar quedan cerca**.
- **Espacio semántico:** la región del espacio vectorial donde viven todos los embeddings. La métrica de "cerca" / "lejos" en este espacio aproxima similitud de significado.
- **Similitud de coseno:** mide el ángulo entre dos vectores. Va de -1 (opuestos) a +1 (idénticos en dirección). Es la métrica por defecto para embeddings de texto.
- **Búsqueda semántica:** dada una query, encontrar los textos del corpus más cercanos en el espacio vectorial — independientemente de las palabras exactas.
- **Pipeline RAG en formación:** la base de M4. En M3 construimos las piezas (embed, index, retrieve); en M4 las atamos con generación.

## 4. Teoría

### 4.1. El problema: keyword search no entiende significado

En **S05.1** tu `findProducts(query)` filtra el catálogo por keywords. Funciona para casos obvios:

```
Query: "mochila"  → 3 mochilas del catálogo. ✓
```

Y falla para casos reales:

```
Query: "algo para cargar mis cosas en una caminata"   → 0 resultados. ✗
Query: "necesito una bolsa para llevar mis cosas"      → 0 resultados. ✗
Query: "rucksack para hiking"                          → 0 resultados. ✗
```

El catálogo tiene mochilas. El cliente las quiere. Pero **la palabra "mochila" no aparece** en su consulta. La búsqueda por keyword es **sensible a la forma** del texto, no a su **significado**.

#### Las 5 formas en que keyword search rompe en producción

1. **Sinónimos:** "mochila" / "bolso" / "morral" / "rucksack". El usuario usa una palabra; tu catálogo otra.
2. **Paráfrasis:** "para llevar cosas en la espalda" describe una mochila sin nombrarla.
3. **Conceptos compuestos:** "equipo para acampar con familia" requiere entender que se relaciona con "tienda 4 personas + cocina + linterna".
4. **Errores de tipeo:** "mocila" no matchea "mochila" en regex literal.
5. **Multilingüe:** "backpack" / "rucksack" / "Rucksack" deberían encontrar la misma mochila.

Podrías parchar cada uno: diccionario de sinónimos, fuzzy matching, listas de stop words, traducción. Funciona... hasta que no funciona. **Embeddings resuelven los 5 al mismo tiempo, sin parches.**

### 4.2. Qué es un embedding — la idea operacional

Un **embedding** es el output de una función `embed: string → Vector<float, N>` aprendida durante el entrenamiento de un modelo, donde:

- `N` es la **dimensión** del espacio (típicamente 384, 768, 1536, 3072 según el modelo).
- Los vectores resultantes preservan la propiedad: **textos con significado similar producen vectores cercanos** en este espacio.

```
embed("mochila de senderismo")     → [0.12, -0.34, 0.78, ..., 0.05]   ← 768 floats
embed("rucksack para hiking")      → [0.14, -0.31, 0.81, ..., 0.07]   ← muy similar al anterior
embed("zapatillas de running")     → [0.41,  0.22, 0.15, ..., 0.91]   ← vector distinto (otra zona del espacio)
```

#### "Aprendido" significa qué exactamente

Durante el entrenamiento del modelo de embeddings, se le mostraron millones de pares de textos junto con la información de qué pares son **similares semánticamente** y cuáles no (con técnicas como contrastive learning). El modelo aprende a ubicar textos en un espacio donde la distancia refleje similitud.

**No vamos a entrenar uno** en este curso. Usamos modelos pre-entrenados (Gemini Embedding, OpenAI text-embedding-3, sentence-transformers, BGE-M3). El detalle del entrenamiento entra en S07.2.

#### Embedding vs token embedding

Atención al nombre — en LLM hay dos cosas que se llaman "embedding":

| Concepto | Qué es | Cuándo lo usas |
|----------|--------|----------------|
| **Token embedding** (interno del LLM) | Vector de cada token individual dentro de la red neuronal. Lo viste en S00.2. | Nunca lo manipulás directamente |
| **Sentence/document embedding** | Vector de un texto completo (oración, párrafo, documento) producido por un modelo dedicado. | **Esto es lo que vemos en M3** |

En el resto del curso, "embedding" significa sentence/document embedding salvo aclaración explícita.

### 4.3. Similitud de vectores — qué métrica usar

Dado dos vectores `a` y `b`, ¿cómo medís cuán similares son? Tres opciones, y la elección importa.

#### Coseno

$$\cos(\theta) = \frac{a \cdot b}{\|a\| \|b\|}$$

Mide el **ángulo** entre los vectores, ignorando la magnitud.

- Rango: `[-1, 1]`. `1` = misma dirección, `0` = ortogonales, `-1` = opuestos.
- **Es la métrica default para embeddings de texto.**

#### Dot product (producto punto)

$$a \cdot b = \sum_i a_i b_i$$

Considera tanto dirección como magnitud.

- Rango: `(-∞, ∞)`. Sin techo.
- **Equivalente a coseno cuando los vectores están normalizados a longitud 1**, lo cual es lo más común.

#### Distancia euclidiana (L2)

$$\|a - b\|_2 = \sqrt{\sum_i (a_i - b_i)^2}$$

Mide la distancia "en línea recta" entre los puntos.

- Rango: `[0, ∞)`. `0` = idénticos.
- Útil cuando la magnitud importa (clustering, no tanto search).

#### Cuál usar — la regla práctica

| Caso | Métrica recomendada | Por qué |
|------|--------------------|---------|
| Búsqueda semántica de texto | **Coseno** (o dot con vectores normalizados) | Estándar de la industria, los modelos se entrenan optimizando coseno |
| Clustering de documentos | Coseno o L2 según el algoritmo | K-means clásico usa L2; HDBSCAN funciona mejor con coseno |
| Cuando el modelo lo dice | Lo que el modelo recomiende | Algunos modelos están entrenados para una métrica específica (Jina v3 dice "cosine"; algunos OpenAI dicen "dot product") |

> **Para todo M3, M4 y M5 usamos coseno con vectores normalizados.** Es lo que más vas a ver en producción real.

### 4.4. Espacio semántico — la intuición

Imagina un espacio de 768 dimensiones (no puedes visualizarlo, pero confía en la intuición). Después de embedear todos los productos del catálogo de TiendaPro, los vectores se distribuyen así:

```
        zona "outdoor / senderismo"
    ┌──────────────────────────────┐
    │  • Mochila Trekker 30L       │
    │    • Mochila Summit 65L      │
    │  • Botas Trail Pro Mid       │
    │      • Zapatillas Run-Trail  │
    │   • Bastones Telescópicos    │
    │  • Tienda 2P Ultra-Light     │
    └──────────────────────────────┘
                 ...
        zona "ropa / abrigo"
    ┌──────────────────────────────┐
    │  • Chaqueta Shell 3L         │
    │     • Forro polar Therm-200  │
    └──────────────────────────────┘
                 ...
        zona "iluminación"
    ┌──────────────────────────────┐
    │  • Linterna Frontal Lumin    │
    └──────────────────────────────┘
```

Cuando alguien busca *"algo para cargar mis cosas en una caminata"*, su query se embedeaa y cae cerca del cluster "outdoor / senderismo" — específicamente cerca de las mochilas. La búsqueda devuelve esos productos, **aunque la palabra "mochila" no aparezca en la query**.

#### Visualización en 2D — qué sí y qué no

Vas a ver gráficos donde alguien proyecta embeddings de 768D a 2D usando PCA o t-SNE para visualizar. Útil **para intuición**, pero ojo:

- El espacio real tiene cientos de dimensiones; 2D pierde casi toda la información.
- Distancias en la proyección 2D NO se corresponden 1:1 con distancias en el espacio original.
- t-SNE puede inventar clusters que no existen en el espacio real (efecto conocido).

> **Regla:** las visualizaciones 2D son para enseñar la idea. Para decidir, usá las métricas de similitud sobre los embeddings completos.

### 4.5. Las 4 aplicaciones canónicas de embeddings

#### A. Búsqueda semántica (lo que vemos en M3)

Pipeline:

```
1. Embedeás el corpus offline (catálogo, FAQs, docs)
2. Indexás los vectores en una BBDD vectorial
3. En query time: embedeás la consulta del usuario
4. La BBDD devuelve los top-K vectores más cercanos
5. Muestras esos resultados (M3) o los inyectas al LLM (M4 - RAG)
```

Caso típico: catálogo de productos, base de conocimiento, soporte.

#### B. Clustering

Agrupar documentos similares automáticamente.

Caso típico: detectar temas en tickets de soporte ("muchos clientes hablan del problema X"), descubrimiento de tópicos en feedback.

#### C. Recomendación

Recomendar items similares al que el usuario consume.

Caso típico: "porque viste X, te puede gustar Y" basado en similitud de embeddings de descripciones.

#### D. Clasificación

Clasificar texto sin entrenar un modelo: embedeás ejemplos de cada clase, embedeás el texto nuevo, asignás a la clase del centroide más cercano.

Caso típico: clasificación de intent (alternativa al LLM-classifier de S04 — más barato, menos flexible).

> En M3-M4 nos enfocamos en **A. Búsqueda semántica**. Las otras 3 quedan como conocimiento de stack mental.

### 4.6. El pipeline básico — dónde gastas tiempo y dinero

```
TEXTO ───▶ embed() ───▶ VECTOR ───▶ index ───▶ store
                          ▲                       │
                          │                       │
QUERY ───▶ embed() ───────┘    ┌──────────────────┘
                               ▼
                         buscar top-K
                               │
                               ▼
                         RESULTADOS
```

Cada flecha tiene su costo:

| Etapa | Costo dominante | Cuándo te duele |
|-------|-----------------|------------------|
| **embed corpus** (offline) | API calls al modelo de embeddings | Cuando indexás 100K+ documentos por primera vez |
| **index/store** | Cómputo del índice (HNSW, IVFFlat) | Cuando re-indexás todo |
| **embed query** (online) | API call por cada consulta del usuario | Volumen alto: cada usuario que pregunta |
| **buscar top-K** | Cómputo de similitud sobre el índice | Bases muy grandes (millones+) |
| **almacenar vectores** | RAM/disco | Vectores grandes × muchos documentos |

Order of magnitude para tu intuición:

- **Embedear** un texto de 100 palabras con Gemini text-embedding-004: `~5-50 ms` y casi gratis ($0.025/1M caracteres). 
- **Buscar top-K** en pgvector con índice HNSW sobre 100K vectores: `~5-15 ms`.
- **Buscar top-K** en pgvector sobre 10M vectores: `~20-100 ms` (con índice; sin índice no escala).

Para TiendaPro con un catálogo chico (~1000 productos + ~500 FAQs), todo es trivial. Pero conviene entender qué se va a doler en producción real.

## 5. Patrones y antipatrones

### Patrones

- **Coseno con vectores normalizados** como métrica default. Si tu modelo no lo dice expresamente, este es el correcto.
- **Embedear el corpus offline, una vez por documento.** No re-embedees a cada query — es costoso e innecesario.
- **Usar un solo modelo de embeddings** para todo el corpus + las queries. Mezclar modelos rompe el espacio: distancias incomparables.
- **Almacenar los vectores junto con el texto original y metadata** (id, fuente, timestamp). Vas a necesitarlo en el retrieve.
- **Re-embedear cuando cambia el modelo.** Un nuevo modelo = nuevo espacio = vectores viejos inservibles.

### Antipatrones

- **Mezclar modelos de embeddings en el mismo índice.** Vectores de Gemini y de OpenAI viven en espacios distintos — distancias entre ellos no significan nada.
- **Embedear el texto entero de un documento de 50 páginas.** Pierde detalle, lo que está en la página 30 se diluye. Lo correcto es chunking (próxima sesión, S07.1).
- **Tomar la similitud al pie de la letra.** Un score de coseno 0.85 no significa "85% similar". Es relativo al modelo y al dominio.
- **Búsqueda semántica sin pre-filtrar.** Sobre 100M vectores, hacer brute-force es prohibitivo. Necesitás un índice (HNSW, IVFFlat — S08).
- **Asumir que embeddings entienden todo.** No entienden números exactos, fechas, IDs específicos. Para esos, keyword sigue siendo mejor (o **hybrid search** — S08).

## 6. Conexión con TiendaPro

En esta sesión NO modificamos el proyecto integrador — el cambio llega cuando tengamos pgvector listo (S08). Pero ya puedes visualizar el upgrade que viene:

- **Hoy (M2):** `findProducts(query)` filtra por keywords sobre `data/catalog.json`. Cae cuando el cliente no usa la palabra exacta.
- **Después de M3 (S08):** `findProducts(query)` embedeaa la query y busca por similitud en pgvector. *"algo para cargar mis cosas en una caminata"* devuelve mochilas correctamente.

En los **ejercicios de esta sesión** vas a comparar empíricamente la búsqueda por keyword vs semántica sobre el mismo catálogo de TiendaPro. La diferencia se ve a simple vista.

## 7. Resumen

Tres ideas para llevarte:

1. **Embeddings convierten texto en vectores donde la distancia aproxima similitud semántica.** Es la pieza que permite buscar "lo que el usuario quiso decir" en lugar de "lo que el usuario escribió". Resuelve sinónimos, paráfrasis, multilingüe y errores de tipeo de un solo golpe.
2. **Coseno con vectores normalizados es la métrica default.** No la confundas con dot product (equivalente cuando hay normalización) ni con L2 (otra cosa). Y nunca mezcles vectores de modelos distintos en el mismo índice.
3. **Embedear es barato; buscar bien es donde está la ingeniería.** El cuello de botella en producción no son los embeddings (rápidos y baratos) sino indexarlos correctamente para que la búsqueda escale (M3-S08).

## 8. Preguntas de auto-evaluación

1. Tu app usa keyword search y un cliente escribe *"un equipo para llevar cosas a la espalda en una caminata de varios días"*. Tu catálogo tiene una "Mochila Summit 65L". ¿Por qué falla y qué resuelve embeddings?
2. ¿Qué quiere decir que un embedding sea "denso" y por qué importa? Compáralo con representaciones sparse como TF-IDF.
3. ¿Por qué coseno con vectores normalizados es equivalente a dot product? Da el argumento matemático en una línea.
4. Tu app indexa 50K productos hoy con Gemini embedding (768D). El equipo de ML quiere migrar a Cohere embedding (1024D). ¿Qué tienes que hacer y por qué no se puede hacer parcialmente?
5. ¿En qué casos la búsqueda por embeddings es PEOR que keyword search? Da 2 ejemplos concretos.
6. Las 4 aplicaciones canónicas de embeddings son search, clustering, recomendación, clasificación. Da un caso de TiendaPro donde aplicarías cada una.

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 3 ejercicios + reto, comparativa empírica keyword vs semantic search sobre el catálogo de TiendaPro.

**Próxima sesión:** [`S07.1 — Chunking de documentos`](../sesion-07.1-chunking/) → cómo partir documentos largos antes de embedearlos, las estrategias y sus trade-offs.
