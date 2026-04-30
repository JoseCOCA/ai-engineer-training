# Sesión 11.1 — Augmentación y combinación de contexto recuperado

> **Módulo:** 4 — Arquitectura RAG · **Duración estimada:** 1h (~30 min lectura + ~30 min práctica) · **Formato:** 60% teoría / 40% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión podrás:

- Explicar qué es **reranking** y por qué un primer pase de retrieval no alcanza para producción seria.
- Distinguir tres familias de rerankers (cross-encoder, LLM-as-reranker, modelos comerciales tipo Cohere) y elegir la correcta según presupuesto y latencia.
- Aplicar **context expansion** y **parent-document retrieval**: chunk pequeño para encontrar, contexto ancho para generar.
- Reconocer el efecto **lost-in-the-middle** y mitigarlo con reordering del contexto antes de pasarlo al LLM.
- Combinar las tres técnicas con las de S10 sin que el pipeline se descontrole en latencia.

## 2. Prerequisitos

- **S09 y S10 completas.** Pipeline RAG funcionando, hybrid search disponible.
- **Catálogo de TiendaPro** indexado en pgvector con la columna `tsvector` agregada en S10 (no obligatoria para los demos de hoy, pero útil si combinas).

## 3. Conceptos clave

- **Reranking:** un segundo pase que toma los top-N candidatos del retriever inicial (típicamente N=20-50) y los reordena con un modelo más preciso (y más caro), devolviendo un top-K final menor (3-10).
- **Cross-encoder:** modelo que toma `(query, documento)` juntos como input y devuelve un score de relevancia. Más preciso que el bi-encoder (que codifica query y doc por separado), pero **no escalable** para todo el corpus — solo se usa en reranking.
- **LLM-as-reranker:** patrón donde se le pide a un LLM scoring de relevancia chunk-query. Más caro y lento que un cross-encoder dedicado, pero aprovecha modelos que ya tienes en el stack.
- **Context expansion:** pasar al LLM más texto que el chunk recuperado — su párrafo padre, sus vecinos, el documento completo. Mejora la coherencia de la respuesta.
- **Parent-document retrieval:** un caso específico de expansion. Indexas chunks pequeños (mejor retrieval), pero pasas al LLM el documento padre (mejor generación).
- **Lost-in-the-middle:** sesgo documentado de los LLMs por el cual prestan más atención al inicio y al final del prompt que al medio. Reordenar el contexto explota este sesgo a tu favor.

## 4. Teoría

### 4.1. Por qué reranking

El retriever inicial (denso, sparse o hybrid) optimiza para **velocidad sobre todo el corpus**. Su trabajo es bajar de N=10.000 a N=20-50 candidatos en milisegundos. A esa escala, no puede permitirse modelos finos.

Pero los top-20 candidatos están **ordenados aproximadamente bien**. Es muy común que el documento perfecto esté en posición 7 cuando debería estar en posición 1. Si tu LLM solo ve el top-3, ese documento no entra.

**Reranking es un segundo pase** que toma esos top-20 y los reordena con un modelo más preciso. La aritmética típica:

| Etapa | Cuántos | Modelo | Latencia |
|-------|---------|--------|----------|
| Retrieval | 10K → 20-50 | Bi-encoder + BM25 + RRF | ~50ms |
| Reranking | 20-50 → 5 | Cross-encoder o LLM | ~200-1000ms |
| Generation | 5 → respuesta | LLM principal | ~500-2000ms |

El reranker corre sobre **decenas** de pares, no sobre miles. Por eso puedes permitirte un modelo más caro: el costo por par es alto pero el total acotado.

#### Por qué no usar el cross-encoder desde el principio

Un cross-encoder ve `(query, documento)` como un único input. Para 10.000 documentos, eso son 10.000 inferencias por query. **Inviable**. El bi-encoder (embeddings) precomputa el embedding de cada doc una vez y al search-time solo computa el de la query — operación O(N) sobre vectores precalculados.

> **Regla mental:** bi-encoder para encontrar, cross-encoder para reordenar.

### 4.2. Tres familias de rerankers

#### Familia A: cross-encoders dedicados

Modelos transformer entrenados específicamente para devolver un score `(query, doc) → [0,1]`.

- **Open-source populares:** `BAAI/bge-reranker-base` y `bge-reranker-v2-m3`. Multilingüe, MIT.
- **Comerciales:** Cohere Rerank (calidad alta, free tier limitado).
- **Latencia típica:** 5-30ms por par. Para top-50 candidatos: 250-1500ms.
- **Pros:** muy precisos, pensados específicamente para esta tarea.
- **Contras:** requieren infra adicional (HuggingFace local, o API externa con su key y costo).

#### Familia B: LLM-as-reranker

Patrón donde le pides al LLM que ya tienes en el stack que score chunks contra la query.

Hay tres variantes:

- **Pointwise:** una llamada por chunk pidiéndole un score 0-10. N llamadas en paralelo.
- **Pairwise:** comparar chunks de a dos ("¿cuál es más relevante para X?"). N² llamadas. Costoso.
- **Listwise:** una sola llamada con todos los chunks pidiéndole que devuelva el ranking. Una llamada, mejor calidad, pero limitado por context window.

**Listwise es el más usado en producción** porque combina calidad alta con costo controlado.

- **Latencia típica:** 1 llamada al LLM (~500-1500ms), independiente de N (hasta donde quepa el context window).
- **Pros:** cero infra adicional, aprovechas el modelo que ya pagas.
- **Contras:** más caro por inferencia que un cross-encoder dedicado, calidad ligeramente menor.

#### Familia C: modelos comerciales tipo Cohere Rerank

API SaaS especializada en reranking.

- **Pros:** zero-ops, calidad alta, fácil integración.
- **Contras:** vendor lock, otra API key, datos pasan por terceros (compliance), costo por query (~$1 por 1000 calls a la fecha de redacción).
- **Cuándo usarlos:** equipos sin presupuesto de infra ML pero con presupuesto de API.

#### Cómo elegir

| Caso | Recomendación |
|------|---------------|
| Empezando, ya tienes Gemini / Claude | LLM-as-reranker listwise |
| Volumen alto (>100K queries/día) | Cross-encoder open-source self-hosted |
| Latencia crítica (<200ms p95) | Cross-encoder open-source o Cohere |
| Compliance impide enviar contexto a terceros | Cross-encoder open-source obligatorio |

### 4.3. Context expansion / parent-document retrieval

El tradeoff de chunking que vimos en S07.1: chunks chicos rankean mejor, chunks grandes generan mejor.

**Patrón:** indexa chico, recupera chico, pero al LLM **mándale grande**.

#### Variante A: parent-document

Indexas cada párrafo (chunk hijo). El retrieval devuelve el chunk hijo. Al construir el prompt, en lugar de pasarle ese párrafo, le pasas el documento padre completo (o una sección).

```
Documento original (1500 tokens)
   │
   ├─ chunk hijo 1 (200 tokens) → indexado
   ├─ chunk hijo 2 (200 tokens) → indexado  ← match
   ├─ chunk hijo 3 (200 tokens) → indexado
   └─ ...

Retrieval: chunk hijo 2
LLM ve: documento original completo (1500 tokens)
```

#### Variante B: sentence-window

Indexas oraciones. Al recuperar la oración relevante, expandes a una ventana de ±N oraciones.

#### Variante C: aplicada al catálogo de TiendaPro

Tu catálogo no tiene "documentos padres" naturales — cada producto es atómico. Pero puedes simular la idea: cuando recuperas el producto P-X, también pasas al LLM **otros 2 productos de la misma categoría** como contexto adicional. El LLM gana visión sobre alternativas y puede recomendar mejor.

Esta es la versión "ligera" del patrón. Para corpus de documentos largos (manuales, FAQs largas), parent-document estricto rinde más.

#### Trade-offs de expansion

- **Pro:** más contexto al LLM → respuesta más coherente, menos alucinación, más recomendaciones.
- **Contra:** más tokens → más costo, más latencia, más riesgo de **dilución del contexto**.
- **Lo importante:** la expansión no debe ser "más por las dudas". Debe responder a una hipótesis sobre qué falta en el chunk recuperado para que la respuesta sea correcta.

### 4.4. Lost-in-the-middle: el sesgo del orden

Liu et al. (2023) demostraron que los LLMs prestan **más atención** a la información en los extremos del prompt (inicio y final) que al medio. Esto se llama **lost-in-the-middle**.

#### El experimento canónico

Le das al LLM 20 documentos y le preguntas algo respondible solo con uno de ellos. Variás la posición del documento relevante:

```
Posición 1  (inicio)  → accuracy ~80%
Posición 10 (medio)   → accuracy ~50%
Posición 20 (final)   → accuracy ~75%
```

La curva tiene forma de **U**: bien en los extremos, peor en el medio.

#### Cómo mitigarlo

Tres estrategias, en orden de efectividad:

**1. Trunca agresivamente.** Si tienes 20 chunks pero los 10 últimos no aportan, no los pases. Menos contexto bien ordenado supera a más contexto diluido.

**2. Reordena "U-shape".** Pon los chunks más relevantes en las posiciones 1 y N, los menos relevantes al medio.

```
Top-N por relevancia:  [A, B, C, D, E, F, G]
Reordering U-shape:    [A, C, E, G, F, D, B]
                        ↑ más relevante     ↑ siguiente más relevante
```

**3. Pon la pregunta del usuario al final.** El LLM atiende más a las últimas tokens del prompt. Si la pregunta va antes del contexto, el modelo "olvida" qué le preguntaste.

#### Anti-anti-patrón

Como el modelo da más peso al final, hay quienes ponen toda la info crítica al final. Funciona en parte, pero **el sistema prompt al inicio sigue siendo importante**: ahí van las instrucciones (no inventes, cita, formato). El sweet spot es:

```
[System al inicio: instrucciones]
[Contexto en el medio, con los más relevantes en los extremos del bloque]
[Pregunta del usuario al final, antes de "responde:"]
```

### 4.5. Pipeline conjunto S09 + S10 + S11.1

```
query usuario
   │
   ▼
[query rewriting]  (S10) → 4 variantes
   │
   ▼
[hybrid retrieval] (S10) por variante → 4 listas → RRF → top-50
   │
   ▼
[reranking]        (S11.1) → top-10
   │
   ▼
[MMR]              (S10) → top-5 diverso
   │
   ▼
[context expansion] (S11.1) → top-5 + N productos relacionados
   │
   ▼
[reorder U-shape]  (S11.1) → orden óptimo
   │
   ▼
prompt aumentado al LLM principal
   │
   ▼
respuesta (con citas, S11.2)
```

**No todos los pasos están siempre presentes.** Cada uno se justifica con métricas (Recall@K, faithfulness, latencia). El pipeline ideal de tu app es el que pasa el eval set con el menor costo.

### 4.6. Decisiones operativas

#### ¿Qué N pasar al reranker?

- 20-30 si usas cross-encoder local (latencia controlable).
- 10-15 si usas LLM-as-reranker listwise (limitado por context window).
- 50-100 solo si tu reranker es muy rápido y tu eval set demuestra que el doc ideal a veces está en rank 40+.

#### ¿Reranker antes o después de MMR?

**Antes.** Reordenas por relevancia, después diversificas. Si haces MMR primero, pierdes la chance de que el reranker mejore el orden.

#### ¿Cuándo NO usar reranker?

- Top-K ingenuo ya da Recall@K bueno (>0.9 en tu eval set).
- Latencia p95 es restricción dura y no puedes gastar 500ms más.
- Corpus chico (< 100 docs) donde el retrieval directo ya es suficiente.

## 5. Patrones y antipatrones

### Patrones

- **Reranking listwise con un LLM cheap es la primera mejora razonable** sobre un retriever decente.
- **Indexa fino, genera grueso.** Chunks chicos para encontrar, contexto expandido para generar.
- **Reordena el contexto antes de pasarlo al LLM.** U-shape o "más relevante al inicio y al final".
- **La pregunta del usuario al final del prompt.** Siempre.
- **Mediciones específicas:** Recall@5 antes y después del rerank, faithfulness antes y después de expandir, accuracy antes y después de reorder.

### Antipatrones

- **Pasar el doc hipotético de HyDE al LLM final.** El doc hipotético es solo para retrieval (esto ya lo viste en S10).
- **Expandir el contexto sin medir.** Más tokens no siempre mejoran la respuesta; pueden diluirla.
- **Reranker pero sin retriever previo decente.** El reranker reordena lo que llega — si el retriever ya filtró mal, el reranker no salva la situación.
- **Pasar el reranker score al LLM como contexto.** El LLM no necesita saber el score; solo el orden.
- **Reordering sin medir.** Asumir que U-shape ayuda en tu caso; mide con tu eval set.

## 6. Conexión con TiendaPro

Igual que S10, los demos de S11.1 trabajan sobre el catálogo indexado pero **no modifican todavía el integrador**. El swap del asistente entra unificado en S11.2 (citas + control de alucinaciones + mantenimiento del índice). Esto deja la modificación del producto contenida en una sola sesión y bien acompañada por evaluación (S11.3).

Lo que vas a ver al ejecutar los ejercicios:

- **01-llm-reranking:** un retrieval ingenuo top-15 reordenado a top-5 con Gemini Flash en modo listwise. Comparativa con el orden naive.
- **02-context-expansion:** un retrieval top-3 expandido con productos hermanos de la misma categoría. Comparativa de respuesta.
- **03-lost-in-the-middle:** misma respuesta pedida con el contexto en cuatro órdenes distintos. Mide cómo cambia la respuesta del LLM.

## 7. Resumen

Tres ideas para llevarte:

1. **Reranking es una segunda capa de filtro, no un reemplazo del retriever.** Bi-encoder rápido encuentra; cross-encoder o LLM lento reordena. Las dos capas son complementarias.
2. **Indexa fino, genera grueso.** El chunk que rankea bien no es el contexto que genera bien. Separa ambas decisiones.
3. **El orden del contexto importa.** El LLM no es indiferente a la posición. Reordering U-shape + pregunta al final son las mejoras más baratas y de mayor impacto.

## 8. Preguntas de auto-evaluación

1. Tu retrieval ingenuo da Recall@5 = 0.65 sobre tu eval set. Sube a 0.85 cuando aumentas a Recall@20. ¿Qué te dice esto sobre la utilidad de un reranker en tu caso?
2. Le pides a Gemini Flash que rerankeen 50 candidatos en una sola llamada listwise. La respuesta excede el context window. ¿Tres mitigaciones, en orden de impacto?
3. Tu sistema usa parent-document retrieval. Un usuario reporta que las respuestas mencionan información que no está en el chunk recuperado. ¿Es un bug o un feature? Justifica.
4. Tienes 10 chunks recuperados. Los reordenas U-shape: relevante en pos 1 y 10, irrelevantes en el medio. La accuracy mejora 8%. ¿Cuál sería tu siguiente experimento?
5. Tu equipo propone usar Cohere Rerank (API externa). ¿Tres preguntas técnicas y operacionales que harías antes de aceptar?
6. Diferencia operativa entre reranking pointwise, pairwise y listwise. Da un caso donde elegirías cada uno.

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 3 demos prácticos.

**Próxima sesión:** [`S11.2 — Citas, control de alucinaciones y mantenimiento del índice`](../sesion-11.2-citas-y-mantenimiento/) → cierra el módulo + entra el swap del integrador a pgvector.
