# Sesión 07.2 — Teoría de embeddings y modelos

> **Módulo:** 3 — Embeddings y búsqueda vectorial · **Duración estimada:** 1.5h (~40 min lectura + ~50 min práctica) · **Formato:** 60% teoría / 40% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión vas a poder:

- Explicar **cómo se entrena un modelo de embeddings** (contrastive learning) con la intuición correcta — sin entrar en matemática avanzada.
- Razonar sobre **dimensiones del embedding** (384, 768, 1536, 3072) y los trade-offs costo-calidad-almacenamiento.
- Leer el **MTEB leaderboard** y elegir un modelo adecuado para tu caso.
- Distinguir las **familias principales de modelos**: cloud comerciales (Gemini, OpenAI, Voyage, Cohere) vs open-source (sentence-transformers, BGE-M3, Jina v3).
- Decidir entre **cloud API vs self-hosted (Python con sentence-transformers)** según costo, latencia, compliance y volumen.
- Comparar empíricamente dos modelos sobre el mismo corpus y entender qué significan las diferencias.

## 2. Prerequisitos

- **S06** (qué es un embedding, similitud coseno) y **S07.1** (chunking) completas.
- Para los ejercicios de Python (opcionales): Python 3.10+. Si no tenés Python, los ejercicios principales corren todos en TypeScript.

## 3. Conceptos clave

- **Contrastive learning:** técnica de entrenamiento donde se le muestra al modelo pares de textos similares (positivos) y disímiles (negativos), aprendiendo a acercar los positivos y separar los negativos en el espacio vectorial.
- **Dimensiones (embedding size):** el número de floats que tiene cada vector. Más dimensiones = más capacidad expresiva, pero más almacenamiento y cómputo.
- **Normalización L2:** dividir cada vector por su norma para que tenga longitud 1. Convierte coseno y dot product en métricas equivalentes y simplifica retrieval.
- **MTEB (Massive Text Embedding Benchmark):** el benchmark estándar que rankea modelos en ~50 tareas (retrieval, clustering, classification, etc.) en múltiples idiomas.
- **Matryoshka Representation Learning (MRL):** técnica donde el modelo se entrena para que **prefijos del vector** sean también buenos embeddings (vector de 768 → truncar a 256 sigue funcionando). Reduce costos de storage y query.

## 4. Teoría

### 4.1. Cómo se entrenan los embeddings — la idea

Un modelo de embeddings no es magia. Es una red neuronal entrenada con un objetivo concreto: **textos similares deben producir vectores cercanos; textos disímiles, vectores lejanos**.

#### Contrastive learning — la receta básica

1. **Conjunto de entrenamiento:** millones de pares de textos `(a, b)` etiquetados como:
   - **Positivos** (`a` y `b` son similares): pregunta y respuesta correcta, dos paráfrasis, dos versiones del mismo doc.
   - **Negativos** (`a` y `b` son disímiles): textos de temas distintos.

2. **Loss function:** la pérdida penaliza cuando dos positivos están lejos y cuando dos negativos están cerca. Famosa: **InfoNCE** o **triplet loss** (anchor, positivo, negativo).

3. **Resultado:** después de millones de pares, el modelo aprende un mapeo `texto → vector` donde la geometría del espacio refleja semántica.

#### De dónde salen los pares

- **Pregunta-respuesta de Stack Overflow.**
- **Pares de Wikipedia** (oración + título de sección).
- **Reformulaciones humanas** (mismo texto en distintos idiomas, distintas parafrases).
- **Mining de datos no etiquetados** con técnicas auto-supervisadas (BERT, SimCSE).

> **Implicación práctica:** un modelo entrenado mayoritariamente con contenido inglés va a ser **mejor en inglés** que en español. Si tu producto opera en español, eligí modelos multilingües (Gemini, sentence-transformers/paraphrase-multilingual, Cohere multilingual) o modelos español-first. Más en S07.2.7.

### 4.2. Dimensiones del embedding — el trade-off

Cada modelo produce vectores de dimensión fija. Las más comunes:

| Dimensión | Modelos típicos | Storage por 1M vectores | Velocidad de retrieval |
|-----------|-----------------|-------------------------|-----------------------|
| 384 | sentence-transformers/all-MiniLM-L6-v2 | ~1.5 GB | Más rápida |
| 768 | Gemini Embedding, BGE-M3, BERT-base | ~3 GB | Estándar |
| 1024 | Cohere multilingual | ~4 GB | Estándar |
| 1536 | OpenAI text-embedding-3-small | ~6 GB | Más lenta |
| 3072 | OpenAI text-embedding-3-large | ~12 GB | Más lenta |

#### Más dimensiones, ¿siempre mejor?

No. La relación **dimensión → calidad** es subaditiva: pasar de 384 a 768 mejora notablemente; de 1536 a 3072, mejora marginal pero el storage se duplica.

**Regla práctica:**

- 384 dim: prototipos rápidos, datasets chicos, hardware limitado.
- 768 dim: **default profesional** para la mayoría de los casos.
- 1536+ dim: solo cuando tu eval set demuestra que la dimensión extra importa para tu dominio.

#### Matryoshka Representation Learning (MRL)

Algunos modelos modernos (Gemini Embedding, OpenAI text-embedding-3, Nomic Embed) están entrenados con MRL: **el prefijo del vector también es un buen embedding**.

```
Vector de 3072: [d0, d1, d2, ..., d3071]
Si truncás a 768: [d0, d1, ..., d767]   ← sigue funcionando casi igual de bien
Si truncás a 256: [d0, d1, ..., d255]   ← útil para storage barato con calidad reducida
```

Permite:
- Almacenar la versión 768 para búsqueda y la versión 3072 para reranking.
- Bajar la dimensión sin re-embedear el corpus entero.
- Trade-off elegible en runtime: ¿prefiero velocidad o calidad?

> Ejercicio 2 muestra cómo aprovechar MRL en práctica con Gemini Embedding.

### 4.3. Normalización L2

Casi todos los modelos modernos devuelven vectores **ya normalizados a longitud 1** (L2 norm = 1). Esto significa:

- **Coseno y dot product son equivalentes.** Podés usar el más rápido (dot product) sin sacrificar precisión.
- **Las distancias L2 también son equivalentes a coseno** módulo una transformación lineal.
- **Promediar vectores normalizados produce vectores no normalizados** — re-normalizá si vas a comparar.

```typescript
function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}
```

Si dudás si tu modelo devuelve normalizado, calculá `Σ x²` sobre cualquier vector. Si da `1.0 ± 0.001`, está normalizado.

### 4.4. MTEB — cómo se compara modelos

El **Massive Text Embedding Benchmark** ([huggingface.co/spaces/mteb/leaderboard](https://huggingface.co/spaces/mteb/leaderboard)) es la referencia para comparar modelos.

#### Estructura de MTEB

- **~50 tareas** divididas en categorías: retrieval, classification, clustering, reranking, STS (semantic textual similarity), summarization, pair classification, bitext mining.
- **Múltiples idiomas:** versión inglés (MTEB), español (MTEB-es), multilingüe (MMTEB), etc.
- **Score promedio:** los modelos se rankean por el promedio de las tareas. El "score" no es comparable entre tareas (cada una usa su métrica nativa) pero sirve como aproximación gruesa.

#### Cómo leer el leaderboard

| Modelo | Avg | Retrieval | STS | Clustering | Lang |
|--------|-----|-----------|-----|------------|------|
| voyage-3-large | 67.2 | 64.5 | 84.1 | 51.3 | EN |
| gemini-embedding-001 | 63.8 | 60.2 | 81.5 | 49.8 | Multi |
| openai-text-embedding-3-large | 62.1 | 59.3 | 79.8 | 48.9 | Multi |
| BGE-M3 | 60.5 | 59.8 | 78.2 | 47.5 | Multi |
| sentence-t/all-MiniLM-L6-v2 | 56.3 | 54.2 | 76.4 | 44.1 | EN |

**Patrones útiles:**

- Si tu caso de uso es **retrieval para RAG**, mirá la columna Retrieval, no el promedio.
- Si operás en **español**, filtrá por idioma o usá MTEB-es directamente.
- Si tenés **constraint de dimensiones** (storage), filtrá por embedding size.
- **No te obsesiones con 0.5-1 punto de diferencia** — el ruido del benchmark a veces es mayor.

> **Patrón:** tomá los **3 modelos top de tu nicho** y corré tus propios evals con tu corpus. El leaderboard es heurística, tu eval es decisión.

### 4.5. Familias de modelos — qué hay disponible

#### Cloud comerciales — la opción simple

| Modelo | Provider | Dimensiones | Multilingüe | Notas |
|--------|----------|-------------|--------------|-------|
| **gemini-embedding-001** | Google | 768 (con MRL hasta 3072) | Sí, fuerte | Free tier amplio. Lo usamos en el curso |
| **text-embedding-3-large** | OpenAI | 3072 (con MRL configurable) | Sí | Calidad alta, MRL nativo |
| **text-embedding-3-small** | OpenAI | 1536 (configurable) | Sí | Más barato, calidad razonable |
| **voyage-3** | Voyage AI | 1024 | Sí, fuerte en RAG | Optimizado para retrieval, top en MTEB |
| **embed-multilingual-v3** | Cohere | 1024 | Sí, especialmente bueno | Pricing a la par de OpenAI |

**Ventajas cloud:**
- Cero infraestructura. API call y listo.
- Calidad de vanguardia.
- Auto-actualización (a veces antes de que te enteres — ojo con drift).

**Desventajas cloud:**
- Costo proporcional al volumen (aunque embeddings son baratos).
- Datos salen de tu red — compliance puede ser bloqueante.
- Latencia de API call (~50-200ms).
- Si el provider deprecá el modelo, te toca re-indexar.

#### Open-source self-hosted — la opción de control

| Modelo | Dimensiones | Tamaño | Calidad MTEB | Notas |
|--------|-------------|--------|--------------|-------|
| **sentence-transformers/all-MiniLM-L6-v2** | 384 | 90MB | ~56 | El "default" de muchos POCs |
| **sentence-transformers/paraphrase-multilingual-mpnet-base-v2** | 768 | 470MB | ~58 (multi) | Buen balance multilingüe |
| **BAAI/bge-m3** | 1024 | 2.3GB | ~60.5 | Multilingüe + dense+sparse+colbert |
| **jinaai/jina-embeddings-v3** | 1024 | 570MB | ~62 | Performance fuerte, comercial-friendly |
| **mixedbread-ai/mxbai-embed-large-v1** | 1024 | 670MB | ~64 | Top entre open-source |

**Ventajas open-source:**
- Cero costo marginal por embedding (después del hardware).
- Datos no salen de tu red.
- Control total sobre el modelo (no se deprecá sin aviso).
- Posibilidad de fine-tuning sobre tu dominio.

**Desventajas open-source:**
- Hay que correr Python o TS server con la lib.
- GPU ayuda mucho (CPU es viable para volúmenes bajos).
- Sos responsable de actualizaciones, tunning, escalabilidad.

### 4.6. Multilingüe vs monolingüe

Un modelo "multilingüe" fue entrenado con múltiples idiomas y produce vectores comparables entre idiomas:

```
embed("backpack")        → [vector_X]
embed("mochila")         → [vector_Y]
similitud(X, Y)          → 0.85   ← alta, son la misma idea
```

Esto te da **búsqueda cross-lingüe gratis**: el cliente busca en español, el corpus está en inglés, y funciona.

**Modelos multilingües fuertes para español (snapshot abril 2026):**

- Gemini Embedding (incluido en el free tier).
- OpenAI text-embedding-3-large.
- Cohere embed-multilingual-v3.
- BGE-M3.
- Jina v3.

**Modelos monolingües (típicamente ingleses):**

- sentence-transformers/all-MiniLM-L6-v2.
- text-embedding-ada-002 (OpenAI legacy — evitar).

> **Regla:** si tu producto opera en cualquier idioma que no sea inglés, **usá multilingüe**. La performance en monolingüe inglés sobre español es mediocre.

### 4.7. Cloud vs open-source — el árbol de decisión

```
   ¿Datos sensibles que NO pueden salir de tu red?
       /                                      \
      SÍ                                       NO
      |                                         |
   Open-source                       ¿Volumen alto (>10M embeds/mes)?
   self-hosted                              /              \
                                           SÍ              NO
                                            |              |
                                Calculá: ¿GPU + ops    Cloud API
                                  cuesta menos        (default)
                                  que cloud API?
                                       /        \
                                     SÍ          NO
                                      |          |
                                Open-source    Cloud API
                                self-hosted
```

**Para TiendaPro:**
- Volumen bajo (catálogo + FAQs + queries de usuarios).
- Sin datos sensibles especiales.
- → **Gemini Embedding (cloud, free tier)** es la opción correcta. Lo usamos en S08.

**Para empresas grandes (banca, salud):**
- Compliance bloqueante.
- → **BGE-M3 o Jina v3 self-hosted** con GPU.

## 5. Patrones y antipatrones

### Patrones

- **Empezar con un modelo cloud (Gemini o OpenAI), validar el caso, después decidir si self-hostear.** Ahorra weeks de setup.
- **Un solo modelo para corpus + queries.** Mezclar modelos rompe el espacio.
- **Verificar normalización antes de asumir.** Si tu modelo devuelve vectores no normalizados, normalizalos vos en el wrapper.
- **MRL cuando el modelo lo soporta.** Almaceno 768D y consulto con 256D para velocidad — sin re-indexar.
- **Multilingüe por default si operás fuera del inglés.** No optimicés "después" — re-indexar todo es caro.

### Antipatrones

- **Elegir modelo por dimensión (1536 > 768).** Más dim ≠ mejor. Confiá en MTEB + tu eval.
- **Mezclar OpenAI con Gemini en el mismo índice.** Cada uno vive en su espacio. Las distancias entre vectores de modelos distintos no significan nada.
- **Asumir que el modelo no cambia.** Cloud providers a veces actualizan modelos sin avisar. Loguea qué modelo usaste para indexar cada vector — versionalo.
- **Self-hostear "porque es más barato"** sin calcular. Para volumen bajo, cloud sale más barato que tu sysadmin.
- **Optimizar dimensiones antes de tener un eval set.** Sin métricas, no sabés si tu cambio mejora o empeora.

## 6. Conexión con TiendaPro

TiendaPro va a usar **gemini-embedding-001** (768D, multilingüe) para indexar el catálogo y FAQs en S08. La decisión está documentada y respaldada:

- **Multilingüe**: cubre clientes en español + queries en inglés.
- **Free tier amplio**: cero costo para el curso.
- **Calidad MTEB suficiente** para un catálogo chico: ~63 promedio, ~60 retrieval.
- **MRL hasta 3072**: si en M4 vemos que necesitamos más calidad, podemos aumentar la dim sin re-indexar.

En los **ejercicios de esta sesión** comparamos gemini-embedding-001 contra OpenAI text-embedding-3-small sobre el mismo corpus para que la decisión esté basada en datos.

## 7. Resumen

Tres ideas para llevarte:

1. **Los embeddings se entrenan con contrastive learning** sobre millones de pares positivos/negativos. La consecuencia operacional: la calidad del modelo depende de qué pares vio durante el entrenamiento — un modelo entrenado en inglés es malo en español; uno entrenado en docs cortos puede fallar en docs largos.
2. **Más dimensiones NO es siempre mejor.** 768 es el sweet spot para la mayoría de los casos. MRL te permite tener flexibilidad sin re-indexar.
3. **Cloud para el 80% de casos; self-hosted cuando compliance, volumen o control lo justifican.** No empieces self-hosting "porque sí" — empezá cloud, validá, después decidí.

## 8. Preguntas de auto-evaluación

1. ¿Cómo se entrena un modelo de embeddings? Da la receta en 4 pasos (no necesitás matemática).
2. Tu app usa OpenAI text-embedding-3-large (3072D) sobre 10M chunks. El equipo propone bajar a 768D para reducir storage. ¿Cómo lo hacés sin re-indexar todo? Pista: una técnica vista en el README.
3. Estás eligiendo modelo. Tu corpus es 80% español, 20% inglés (chunks mezclados). ¿Qué columna del MTEB leaderboard es la más relevante?
4. Tu provider deprecó tu modelo de embeddings. Tu pgvector tiene 1M vectores indexados con ese modelo. ¿Qué tenés que hacer?
5. Diferencia operacional entre normalización L2 y similitud coseno. ¿Por qué la mayoría de los modelos devuelven vectores normalizados?
6. Tu app procesa 100M embeds/mes. Calculá: ¿cuesta más OpenAI text-embedding-3-small ($0.02/1M tokens × ~150 tok/chunk promedio) o una GPU NVIDIA A10G en Lambda Labs ($0.50/hora) corriendo BGE-M3?

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 3 ejercicios + reto Python.

**Próxima sesión:** [`S07.3 — Espacio vectorial, búsqueda semántica y pre-procesamiento`](../sesion-07.3-espacio-vectorial/) → distancias, normalización, pre-procesamiento de texto y umbrales en producción.
