# Sesión 10 — Técnicas avanzadas de recuperación

> **Módulo:** 4 — Arquitectura RAG · **Duración estimada:** 2h (~55 min lectura + ~65 min práctica) · **Formato:** 60% teoría / 40% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión podrás:

- Explicar **qué falla en el RAG ingenuo** y diagnosticar cuál de cuatro técnicas avanzadas ataca cada modo de fallar.
- Implementar **hybrid search** (denso + BM25) y combinar rankings con **Reciprocal Rank Fusion**.
- Aplicar **query rewriting** con un LLM cheap para cubrir queries cortas, ambiguas o mal formuladas.
- Aplicar **HyDE (Hypothetical Document Embeddings)** y reconocer cuándo el gap query-documento justifica el truco.
- Aplicar **MMR (Maximum Marginal Relevance)** para devolver resultados relevantes pero diversos en lugar de top-K casi idénticos.
- Evaluar el **costo operacional** de cada técnica (latencia, tokens, complejidad) y decidir cuáles adoptar y cuáles no.

## 2. Prerequisitos

- **S09 completa.** Pipeline RAG ingenuo funcionando sobre el catálogo de TiendaPro.
- **pgvector** indexado con productos (S08). Para hybrid search agregamos una columna `tsvector` adicional.
- **Variable** `GOOGLE_GENERATIVE_AI_API_KEY` configurada (los demos usan Gemini Flash).

## 3. Conceptos clave

- **Dense retrieval:** lo que ya hicimos en S09. Usar embeddings y similitud semántica. Bueno para sinónimos, paráfrasis, intent.
- **Sparse retrieval (BM25):** ranking lexical clásico basado en frecuencia de términos. Bueno para términos exactos, identificadores, nombres propios, jerga técnica.
- **Hybrid search:** combinar dense + sparse. Captura ambas fortalezas.
- **RRF (Reciprocal Rank Fusion):** algoritmo simple para fusionar dos rankings. `score(d) = Σ 1/(k + rank_i(d))`. Sin pesos, sin calibración, robusto.
- **Query rewriting:** un LLM cheap reformula la query del usuario en N variantes (sinónimos, especificaciones, generalizaciones) antes del retrieval.
- **Multi-query:** hacer el retrieval con cada variante y fusionar los resultados (RRF). Sube recall a costo de latencia + 1 llamada LLM.
- **HyDE:** un LLM genera una "respuesta hipotética" a la pregunta. Embedemos esa respuesta (no la pregunta). Útil cuando el estilo de la query es muy distinto al estilo del corpus.
- **MMR (Maximum Marginal Relevance):** algoritmo greedy que mezcla relevancia con diversidad. Penaliza incluir documentos muy similares a otros ya elegidos.

## 4. Teoría

### 4.1. Por qué el RAG ingenuo no alcanza siempre

El retriever denso tiene puntos ciegos predecibles:

| Punto ciego | Ejemplo | Lo que falla |
|-------------|---------|--------------|
| Identificadores y códigos | "tengo problemas con el TP-MOCH-02" | El embedding "alisa" el código; ranking lexical lo encontraría exacto |
| Nombres propios y marcas | "membrana Vibram" | Mismo problema: el modelo de embeddings no privilegia tokens raros |
| Queries muy cortas | "envío" | Poco contenido semántico, varios sentidos posibles |
| Queries mal formuladas | "cosa para no mojarme" | Lenguaje vago lejos del estilo del catálogo |
| Queries largas y enredadas | un párrafo del usuario | Mezcla múltiples intents que el retrieval ranking no separa bien |
| Top-K homogéneo | "mochilas" → top-5 son 5 mochilas trekking casi clones | El ranking premia similitud pero ignora diversidad |

Las cuatro técnicas que vemos hoy atacan estos puntos ciegos por separado. **No son alternativas — son herramientas complementarias.** Un sistema serio acaba combinando 2-3 de ellas, con costo proporcional.

> **Regla práctica:** antes de adoptar cualquier técnica avanzada, **medí el RAG ingenuo con un eval set**. Si Recall@5 ya es 0.95, no necesitas hybrid search; si es 0.4, bajar a entender por qué (chunking, modelo de embeddings, queries fuera de distribución) probablemente ayuda más que sumar capas.

### 4.2. Hybrid search: denso + sparse

El retrieval denso falla en queries con términos exactos. El retrieval sparse (BM25) falla en queries con sinónimos. **Hybrid los combina.**

#### BM25 en una línea

BM25 es una función de ranking que para cada documento calcula:

```
score(D, Q) = Σ_{t in Q} IDF(t) · (tf(t,D) · (k+1)) / (tf(t,D) + k · (1 - b + b · |D|/avgdl))
```

Conceptualmente:

- **IDF (inverse document frequency):** los términos raros pesan más.
- **Saturación de tf:** repetir un término cinco veces no da 5× score; satura.
- **Penalización por longitud:** documentos largos no ganan automáticamente por contener más términos.

En Postgres, BM25 vive bajo la forma de `tsvector` + `ts_rank_cd`. Es una **aproximación** de BM25, no la fórmula exacta, pero el comportamiento práctico es muy similar.

#### Schema mínimo para hybrid en pgvector

```sql
ALTER TABLE products
  ADD COLUMN search_doc tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(category, '')), 'C')
  ) STORED;

CREATE INDEX products_search_doc_gin ON products USING GIN (search_doc);
```

Notas:

- `setweight(..., 'A')` es ranking ponderado: el `name` pesa más que la `description`.
- Usar `'spanish'` activa el stemmer en español. "mochilas" y "mochila" colapsan al mismo token.
- `STORED` mantiene la columna actualizada automáticamente.

#### Reciprocal Rank Fusion (RRF)

¿Cómo combinar el ranking denso con el sparse? Tres opciones:

- **Score linear combinada.** `score = α · dense_score + (1-α) · sparse_score`. Problema: las escalas de los scores son incomparables sin normalización agresiva.
- **Normalización + score lineal.** Mejor, pero dependes del rango observado de cada ranking.
- **RRF.** Ignora los scores. Solo importa el **rank** de cada documento en cada lista. Robusto, sin hiperparámetros que calibrar.

```
RRF_score(d) = Σ_i 1 / (k + rank_i(d))     (típicamente k=60)
```

En código:

```typescript
function rrf(rankings: string[][], k = 60): Array<{ id: string; score: number }> {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, idx) => {
      const rank = idx + 1;
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
    });
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
```

**Veinte líneas. Ese es el algoritmo entero.** No tiene pesos, no requiere normalización, no se rompe cuando una de las listas es más corta. Es el default profesional.

#### Cuándo hybrid no aporta

- Corpus donde los nombres propios y códigos no aparecen en queries (asistentes muy abiertos).
- Idiomas con stemming pobre en Postgres.
- Queries siempre largas y descriptivas (los embeddings ya son fuertes ahí).

### 4.3. Query rewriting con LLM

La query del usuario rara vez es óptima para el retriever. Un LLM cheap puede reescribirla en N variantes que cubren más superficie semántica.

#### El patrón de tres reescrituras

Pedirle al LLM que devuelva tres variantes:

1. **Reformulación general** ("¿Tienen mochilas para senderismo?" → "Mochila de senderismo / mochila trekking / mochila para excursión").
2. **Reformulación específica** (descomponer "necesito algo para acampar 4 días" en "tienda de campaña 4 personas / saco de dormir / colchoneta").
3. **Reformulación con jerga del dominio** ("mochila grande" → "mochila técnica de gran capacidad / mochila expedición 65L").

Hacés retrieval con cada variante (más la original = 4 listas), fusionás con RRF.

#### Coste y trade-off

- **+1 llamada LLM** (la de rewriting). Modelo cheap + temperatura baja + JSON estructurado.
- **+3-4 retrievals** en paralelo (no serializados — son independientes).
- **Latencia total** sube de ~250ms (retrieval directo) a ~1500ms (LLM rewrite + retrievals + fusión).
- **Recall** sube notable cuando las queries son cortas o ambiguas; aporta poco cuando ya son descriptivas.

#### Patrón concreto del prompt

```
[System]
Reescribe la pregunta del usuario en 3 variantes alternativas para mejorar la búsqueda en
nuestro catálogo. Devolvé un JSON con la siguiente forma:
{
  "variantes": ["variante 1", "variante 2", "variante 3"]
}
- Una variante con sinónimos.
- Una variante más específica (descompone si la query mezcla intents).
- Una variante con la jerga típica del dominio (productos de outdoor).
No agregues texto fuera del JSON.

[User]
Pregunta original: "{query}"
```

> **Antipatrón:** generar variantes y fusionarlas con la original incluida pero sin pesos. La query original suele ser la mejor — pesarla 1× y las variantes 1× cada una desbalancea hacia las variantes. Solución: incluir la original en el RRF (las variantes refuerzan documentos relevantes pero la original sigue ahí).

### 4.4. HyDE — Hypothetical Document Embeddings

La intuición: la **query** y el **documento que la responde** suelen estar en estilos distintos. La query es corta e informal ("algo para acampar 4 personas"); el documento es descriptivo y técnico ("Tienda de túnel para 4 personas con vestíbulo y dos accesos…"). Embebiendo la query, navegás un espacio donde los documentos no son los vecinos más cercanos.

**HyDE invierte el flujo:**

1. Le pedís al LLM que escriba una **respuesta hipotética** a la query.
2. Embedés esa respuesta (no la query).
3. Hacés kNN con ese embedding.

La respuesta hipotética **se parece mucho más al estilo del corpus**, así que cae más cerca de los documentos relevantes en el espacio vectorial.

#### Cuándo aporta y cuándo no

- **Aporta** cuando hay un gap de estilo grande query↔documento. Catálogos técnicos consultados con lenguaje coloquial son el caso típico.
- **No aporta** cuando los documentos son ya parecidos a las queries (FAQs en formato pregunta-respuesta). Ahí HyDE introduce ruido al inventar texto.
- **Costo:** +1 llamada LLM (~400 tokens output). Latencia +500-800ms.

#### Antipatrón frecuente

Pasarle al LLM la respuesta hipotética **al final del pipeline** como si fuera contexto. La respuesta hipotética es **un artefacto interno del retrieval**, no debe llegar a la generación. Solo se usa para encontrar los documentos. Una vez encontrados, se generan con el contexto real.

### 4.5. MMR — Maximum Marginal Relevance

El top-K naive premia similitud a la query. Cuando hay 30 mochilas trekking similares, el top-5 son las 5 más similares entre sí — y el usuario ve **cinco veces lo mismo**.

MMR corrige esto eligiendo greedyly:

```
MMR(d) = λ · sim(d, query) - (1 - λ) · max_{d' in seleccionados} sim(d, d')
```

- λ = 1 → ranking puro (igual a top-K).
- λ = 0 → diversidad pura (ignora la query, solo evita repetir).
- λ = 0.5-0.7 → el sweet spot para asistentes conversacionales.

#### Algoritmo

```typescript
function mmr(
  query: number[],
  candidates: Array<{ id: string; embedding: number[] }>,
  k: number,
  lambda: number,
): string[] {
  const selected: typeof candidates = [];
  const remaining = [...candidates];

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      const simQuery = cosine(query, c.embedding);
      const simSelected =
        selected.length === 0
          ? 0
          : Math.max(...selected.map((s) => cosine(s.embedding, c.embedding)));
      const score = lambda * simQuery - (1 - lambda) * simSelected;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected.map((s) => s.id);
}
```

Notas operativas:

- MMR opera sobre un pool de candidatos pre-filtrado por kNN (top-20 o 50). No se aplica sobre todo el corpus.
- Pedís a pgvector los embeddings, no solo los IDs, porque MMR los necesita para `sim(d, d')`.
- Costo: O(K · |candidates| · |embedding|). Trivial para K=5 sobre 50 candidatos.

#### Cuándo aporta

- Asistentes conversacionales con catálogos donde hay clusters densos.
- Búsqueda exploratoria del usuario ("muéstrame opciones").
- Resúmenes multi-documento donde quieres cubrir distintos aspectos.

#### Cuándo NO aporta

- FAQ con respuestas únicas (quieres la mejor, no diversidad).
- Catálogos donde los productos son inherentemente diversos.

### 4.6. Comparativa: cuándo aplicar qué

| Técnica | Mejora primaria | Costo extra | Latencia extra | Cuándo aporta |
|---------|-----------------|-------------|----------------|---------------|
| Hybrid search | Recall en términos exactos | 1 índice GIN | +20-40ms | Catálogos con códigos/marcas/jerga |
| Query rewriting | Recall en queries cortas/ambiguas | 1 LLM call | +500-800ms | Asistentes conversacionales con queries informales |
| HyDE | Recall cuando hay gap query↔doc | 1 LLM call | +500-1000ms | Corpus técnico consultado con lenguaje coloquial |
| MMR | Diversidad del top-K | 0 (cómputo local) | +5-20ms | Búsqueda exploratoria con clusters densos |

**Las cuatro NO se contraponen.** Hybrid search se aplica al retrieval; query rewriting va antes del retrieval; HyDE reemplaza el embedder de query; MMR se aplica al ranking final. Un sistema avanzado los combina.

#### Pipeline típico avanzado

```
query usuario
   │
   ▼
[query rewriting] → 4 variantes (incluida la original)
   │
   ▼
para cada variante:
   ├─ [HyDE] (opcional) → genera doc hipotético, embede
   ├─ [hybrid] → dense rank + sparse rank → RRF
   │
   ▼
fusión global (RRF de las 4 listas)
   │
   ▼
[MMR] sobre el top-50 → top-5 diverso
   │
   ▼
[reranking con cross-encoder] (S11.1)
   │
   ▼
contexto al LLM
```

> **Recordatorio:** este pipeline es **avanzado**. El 80% de las apps en producción no lo necesitan completo. Empezá ingenuo, medí, agregá técnicas según los modos de fallar que observas.

### 4.7. Cómo medir si valió la pena

Cada técnica que sumas tiene que justificarse en métricas, no en estética. Tres preguntas operativas:

1. **¿Subió Recall@K?** Mide con un eval set de 30+ pares `(query, doc_ids esperados)`.
2. **¿Subió la calidad de la respuesta final?** Faithfulness y answer relevance (RAGAS, S11.3).
3. **¿El costo extra de latencia y dinero es aceptable para tu UX y tu presupuesto?**

Si las tres respuestas son sí, la técnica entra. Si alguna es no, queda como hipótesis para reevaluar cuando cambien las restricciones.

## 5. Patrones y antipatrones

### Patrones

- **Empezá con hybrid search.** Es la mejora con mejor relación costo/beneficio en la mayoría de los corpus reales.
- **Usá RRF para fusionar rankings.** Sin hiperparámetros, robusto, 20 líneas.
- **Generá variantes de query con un modelo cheap y temperatura baja.** Un Flash/Haiku es suficiente; no uses Opus para reescribir.
- **Aplicá MMR sobre un pool de top-N**, no sobre todo el corpus.
- **Mide cada técnica antes y después con un eval set.** Si no mides, sumas complejidad sin saber si ayuda.

### Antipatrones

- **Apilar todas las técnicas porque están de moda.** Cada una agrega latencia, costo y superficie de bugs. Calibralas.
- **Combinar scores denso + sparse con `α + (1-α)` sin normalizar.** Los rangos son incomparables; RRF lo evita.
- **Generar 10 variantes de query.** Más allá de 3-4 hay rendimientos decrecientes y costo creciente.
- **Pasar la respuesta hipotética de HyDE al LLM final como contexto.** Es un artefacto interno, contamina la respuesta.
- **MMR con λ=0.** Resultados completamente desacoplados de la query.
- **Adoptar técnicas avanzadas sin haber medido el ingenuo.** No sabes cuál falla; estás resolviendo problemas que no tienes.

## 6. Conexión con TiendaPro

En esta sesión los demos exploran las cuatro técnicas sobre el catálogo ya indexado, pero el integrador **todavía no las adopta**. La razón:

- **Hybrid search** depende de una columna `tsvector` adicional en el schema. Migración pequeña pero real, que conviene hacer junto con el switch del asistente al retriever pgvector (S11.2).
- **Query rewriting y HyDE** suman llamadas LLM al pipeline del integrador, lo que afecta el budget de latencia conversacional. Antes de incorporarlos, quieres tener Promptfoo (S11.3) corriendo para detectar regresiones.
- **MMR** es la técnica con menor riesgo, pero su valor depende de qué porcentaje de queries del usuario produce clusters densos en el top-K. Mide primero, adopta después.

> **Decisión arquitectónica del módulo:** el swap del asistente para usar pgvector + (algunas de) estas técnicas se hace en S11.2 después de tener citas y mantenimiento del índice claros. Esto deja al integrador estable mientras exploramos.

## 7. Resumen

Tres ideas para llevarte:

1. **Las técnicas avanzadas atacan modos de fallar específicos.** Hybrid → términos exactos. Rewriting → queries cortas. HyDE → gap de estilo. MMR → diversidad. Reconocer el modo te dice qué técnica aplicar.
2. **RRF es el algoritmo de fusión por defecto.** 20 líneas, sin hiperparámetros, robusto. Cualquier sistema que combine rankings debería usarlo (o demostrar por qué no).
3. **Mide antes y después.** Cada técnica tiene un costo. Si el RAG ingenuo ya da Recall@5 = 0.9, agregar capas es over-engineering. Si da 0.4, el problema puede estar antes (chunking, embedding, queries OOD) y ninguna técnica avanzada va a salvarte.

## 8. Preguntas de auto-evaluación

1. Tu RAG sobre el catálogo de TiendaPro falla cuando el usuario pone un código exacto ("¿qué pasó con TP-MOCH-02?"). ¿Cuál de las cuatro técnicas adoptarías y por qué? ¿Cuál sería la peor elección?
2. Implementas query rewriting con Gemini Pro (modelo grande). El equipo se queja de latencia y costo. ¿Qué dos cambios puedes hacer sin romper el pipeline?
3. Tu eval set tiene 50 pares pregunta-doc esperado. Recall@5 ingenuo = 0.78. Pruebas hybrid → 0.84. Pruebas hybrid + HyDE → 0.85. Pruebas hybrid + HyDE + rewriting → 0.86. ¿Qué configuración llevarías a producción? Justifica.
4. MMR con λ=0.7 en un corpus de FAQs únicas (cada FAQ tiene una respuesta clara y diferente). ¿Cuál es el problema? ¿Qué λ tiene más sentido y por qué?
5. Diferencia operativa entre **multi-query rewriting** y **HyDE**. Da un ejemplo de query donde cada uno aporta más que el otro.
6. RRF con `k=60`. ¿Qué efecto tiene cambiarlo a `k=10`? ¿Y a `k=300`? Razona qué pasa con la diferencia de score entre rank 1 y rank 50 en cada caso.

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 4 demos prácticos de las cuatro técnicas.

**Próxima sesión:** [`S11.1 — Augmentación y combinación de contexto recuperado`](../sesion-11.1-augmentacion-contexto/) → reranking con cross-encoder, parent-document retrieval, context expansion.
