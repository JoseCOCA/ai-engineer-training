# Sesión 09 — Fundamentos de RAG y técnicas de recuperación

> **Módulo:** 4 — Arquitectura RAG · **Duración estimada:** 2h (~55 min lectura + ~65 min práctica) · **Formato:** 60% teoría / 40% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión podrás:

- Explicar **qué problema resuelve RAG** y cuándo NO es la respuesta correcta.
- Describir el **pipeline canónico** (Retrieve → Augment → Generate) y qué responsabilidad tiene cada etapa.
- Distinguir el **conocimiento parametrizado** (lo que el LLM aprendió en pre-entrenamiento) del **conocimiento externalizado** (lo que vive en tu base, fuera del modelo).
- Implementar un **RAG ingenuo end-to-end** sobre el catálogo de TiendaPro, ejecutable y medible.
- Identificar los **modos de fallar** del retrieval: query fuera de distribución, contexto irrelevante, alucinación con contexto, contradicciones.
- Calibrar **top-K y threshold** con criterios operativos en lugar de copiar defaults.
- Conocer las **métricas básicas** de evaluación de retrieval (Recall@K, MRR, hit rate) y dónde encajan dentro del módulo.

## 2. Prerequisitos

- **Módulo 3 completo.** Catálogo de TiendaPro indexado en pgvector con `gemini-embedding-001`.
- **Módulo 2 completo.** Wrappers, abstracción de proveedores y manejo de prompts.
- **Docker** levantado con `pgvector/pgvector:pg16`. El docker-compose del repo lo trae listo.
- **Variable** `GOOGLE_GENERATIVE_AI_API_KEY` configurada (free tier de Gemini alcanza para todo el módulo).

## 3. Conceptos clave

- **RAG (Retrieval-Augmented Generation):** patrón donde el LLM recibe, junto con la pregunta, un contexto recuperado dinámicamente de una base externa. La respuesta se genera **a partir del contexto**, no del conocimiento parametrizado del modelo.
- **Conocimiento parametrizado:** lo que el modelo "sabe" porque sus pesos lo aprendieron en pre-entrenamiento. Es estático, está congelado al cutoff de entrenamiento, y no es trazable a una fuente concreta.
- **Conocimiento externalizado:** lo que vive en una base controlada por ti (catálogo, FAQs, manuales, tickets). Es actualizable, trazable y auditable.
- **Retrieve:** dada una query del usuario, encontrar los **K documentos más relevantes** del corpus.
- **Augment:** combinar la pregunta original con los documentos recuperados en un único prompt para el LLM.
- **Generate:** el LLM produce la respuesta a partir del prompt aumentado, **idealmente apoyándose solo en el contexto**.
- **Top-K:** cuántos documentos se le pasan al LLM. Hay un sweet spot: pocos = falta contexto, muchos = ruido y costo.
- **Threshold de similitud:** corte mínimo de score por debajo del cual un resultado se descarta. Sin esto, siempre devuelves K resultados aunque ninguno sea relevante.
- **Hallucination con contexto (grounded hallucination):** el LLM inventa aunque tenga el contexto correcto delante. El retrieval funcionó; el prompting falló.
- **Recall@K:** porcentaje de los documentos relevantes verdaderos que aparecen en el top-K. Métrica primaria del retriever.
- **MRR (Mean Reciprocal Rank):** posición promedio del primer documento relevante. Penaliza no solo "encontrarlo" sino "encontrarlo arriba".

## 4. Teoría

### 4.1. Por qué RAG existe

Un LLM tiene dos limitaciones estructurales que ningún tamaño de modelo resuelve por sí solo:

1. **Cutoff de entrenamiento.** Los pesos del modelo se congelaron en una fecha. Si tu negocio cambió desde entonces (precios, políticas, catálogo), el modelo no se entera.
2. **No tiene acceso a tus datos privados.** El catálogo de TiendaPro, las FAQs internas y las políticas de devolución no están en su pre-entrenamiento. Y no quieres que estén — son tus datos.

La opción ingenua para resolver esto es **fine-tuning**: re-entrenar el modelo con tus datos. Tres problemas en producción:

- **Costo.** Re-entrenar incluso un modelo mediano cuesta y requiere infra ML.
- **Tiempo.** Cada actualización del catálogo implica un re-entrenamiento. Si el catálogo cambia diario, no escala.
- **Trazabilidad nula.** Una respuesta del modelo fine-tuneado no apunta a una fuente. No puedes auditar qué documento generó qué frase.

RAG resuelve los tres: **el conocimiento vive fuera del modelo, en una base que actualizás cuando quieras, y cada respuesta puede citar de dónde salió**.

> **Cuándo RAG NO es la respuesta:**
> - Tareas que el LLM ya hace bien con conocimiento general (resumir, traducir, reescribir).
> - Razonamiento puro sobre la query del usuario (matemática, lógica). El contexto no aporta.
> - Catálogos diminutos (< 50 entradas) que entran en el prompt directamente: pásalos enteros, evita la infraestructura.

### 4.2. La anatomía del pipeline canónico

```
┌────────────┐
│  Usuario   │  "¿Tienen mochilas para senderismo?"
└──────┬─────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  1. RETRIEVE                                                │
│   - Embedder convierte la query → vector                    │
│   - Vector store devuelve top-K productos similares         │
│   - Filtros (categoría, stock) y threshold de similitud     │
└──────────────────────────┬──────────────────────────────────┘
                           │  k documentos relevantes
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  2. AUGMENT                                                 │
│   - Combina la pregunta + los k documentos en un prompt     │
│   - System prompt: "responde solo con el contexto, cita"    │
│   - User prompt: el contexto + la pregunta original         │
└──────────────────────────┬──────────────────────────────────┘
                           │  prompt aumentado
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  3. GENERATE                                                │
│   - LLM produce la respuesta apoyado en el contexto         │
│   - Idealmente: incluye citas a las fuentes recuperadas     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌────────────┐
│  Respuesta │
└────────────┘
```

Las tres etapas están desacopladas. Esto es deliberado: cada una se evalúa, optimiza y reemplaza por separado.

| Etapa | Responsable | Métrica primaria |
|-------|-------------|------------------|
| Retrieve | Vector store + embedder | Recall@K, MRR |
| Augment | Tu código (template del prompt) | Calidad del prompt rendido |
| Generate | LLM + system prompt | Faithfulness, hallucination rate |

> **Regla clave:** cuando RAG falla, primero diagnosticá **dónde** falló. Una respuesta mala puede deberse a un retrieval mediocre, a un prompt que confunde al LLM, o al LLM ignorando el contexto. Los tres se corrigen distinto.

### 4.3. La etapa Retrieve

Ya conoces casi todo de Módulo 3. Lo que cambia en RAG es **qué haces con el resultado**.

#### El retriever ideal

Una función con esta firma:

```typescript
async function retrieve(query: string, opts?: {
  k?: number;
  threshold?: number;
  filters?: Record<string, unknown>;
}): Promise<RetrievedChunk[]>;

interface RetrievedChunk {
  id: string;
  content: string;       // el texto plano que el LLM va a leer
  score: number;         // similitud (0-1), ordenado descendente
  metadata: Record<string, unknown>;  // categoría, fuente, fecha, etc.
}
```

Tres decisiones operativas:

- **K.** Cantidad de chunks a devolver. **Default razonable: 3-5 para respuestas conversacionales.** Más arriba si el LLM tiene context window grande y el costo no preocupa.
- **Threshold.** Corte mínimo de similitud. Sin threshold devolvés siempre K resultados, aunque ninguno sea relevante. **Default razonable: 0.55-0.65 con embeddings normalizados (Gemini, OpenAI).** Calibralo con un eval set.
- **Filtros.** Categoría, tenant, idioma, fecha. **Aplicalos antes o después del kNN según selectividad** (ver S08 para el detalle del trade-off).

#### Resultado vacío: una opción válida

Cuando el threshold filtra todo, el retriever devuelve `[]`. Este es un resultado **diseñado**, no un bug. Significa: "ningún documento del corpus es lo suficientemente relevante para esta query". El LLM, con instrucciones correctas, responde "no encontré información sobre eso". Esto es **infinitamente mejor** que pasarle K resultados irrelevantes y dejar que invente.

> **Antipatrón frecuente:** bajar el threshold para "siempre tener algo". El resultado es alucinación con contexto: el LLM toma fragmentos sin relación y arma una respuesta plausible pero incorrecta. La medicina es peor que la enfermedad.

### 4.4. La etapa Augment

Augment es **construcción de prompt**. Y todo lo que vimos en Módulo 2 sobre prompts aplica acá: rol, contexto, instrucciones, formato de salida, restricciones.

La estructura canónica:

```
[System]
Sos un asistente de TiendaPro.
Respondes ÚNICAMENTE con la información del contexto proporcionado.
Si el contexto no contiene la respuesta, di: "No tengo información sobre eso en este momento".
No inventes precios, características ni stock que no estén explícitamente en el contexto.
Cuando uses información del contexto, cita el id del producto entre paréntesis: (ej. P-042).

[User]
Contexto recuperado:
---
[1] P-012 — Mochila Trail 35L
    Mochila técnica de senderismo. Capacidad 35L. Material ripstop. Categoría: mochilas.
[2] P-018 — Mochila Day Pack 20L
    Mochila ligera para uso diario. Capacidad 20L. Categoría: mochilas.
---

Pregunta del usuario: ¿Tienen mochilas para senderismo?
```

Tres decisiones de diseño que cambian completamente el resultado:

#### Decisión 1: orden de la información

El **recency bias** y el **primacy bias** del LLM están bien documentados. Lo que va al principio y al final del prompt pesa más. Patrón canónico: **system al principio, contexto en el medio, pregunta al final**, justo antes de "responde". Esta es la disposición que más respeta la instrucción de "respondé sólo con el contexto".

#### Decisión 2: cómo formatear los chunks

```
[1] P-012 — Mochila Trail 35L
    Descripción...
```

Ese formato cumple tres funciones:

- **Numeración** ([1], [2]) → facilita citas posteriores ("según [1]...").
- **ID estable** (P-012) → permite trazabilidad entre la respuesta y la fuente.
- **Título humano** (Mochila Trail 35L) → ayuda al LLM a desambiguar entre chunks similares.

Pasarle al LLM solo `description` sin estructura es un error frecuente. Confunde, mezcla, atribuye mal.

#### Decisión 3: instrucciones contra alucinación

La instrucción "respondé sólo con el contexto" es **necesaria pero insuficiente**. Tres complementos que mueven la aguja:

- **"Si el contexto no contiene la respuesta, di 'no tengo información sobre eso'."** Le da una salida válida cuando no hay nada que decir.
- **"No inventes datos que no estén explícitamente en el contexto."** Activa una segunda capa de control.
- **"Cita el id del producto cuando uses su información."** Fuerza la trazabilidad y reduce el incentivo a fabricar.

Estas tres instrucciones reducen alucinación en RAG entre un 30% y un 60% según el modelo y la tarea. **No son opcionales en producción.**

### 4.5. La etapa Generate

La generación es donde el LLM toma el prompt aumentado y produce la respuesta. Las decisiones acá son las mismas de Módulo 2 — temperatura, max tokens, modelo — con tres consideraciones específicas de RAG:

- **Temperatura baja** (0.0 a 0.3). En RAG quieres respuestas reproducibles y atadas al contexto. Temperatura alta invita al modelo a "interpretar creativamente" el contexto, que es exactamente lo que no quieres.
- **Modelo capaz pero no necesariamente el más caro.** Gemini Flash o Claude Haiku son suficientes para la mayoría de RAGs conversacionales. Subir a Pro/Sonnet/Opus rara vez mejora la calidad si el retrieval es bueno.
- **Cuidado con el context window.** Pasar K=20 chunks de 1500 tokens cada uno son 30K tokens **antes** de la pregunta. Costo y latencia crecen linealmente. La cuenta importa.

#### Faithfulness vs Helpfulness

En RAG hay un trade-off central:

- **Faithfulness** (fidelidad): la respuesta sólo afirma cosas que están literalmente en el contexto.
- **Helpfulness** (utilidad): la respuesta es útil al usuario, lo que a veces requiere conectar piezas, inferir, recomendar.

Un asistente perfectamente fiel pero inútil ("no tengo información") frustra. Un asistente perfectamente útil pero infiel inventa. **Producto = balance**, calibrado con tu eval set y tu tolerancia al riesgo. RAGAS, que verás en S11.3, mide ambas dimensiones por separado.

### 4.6. Modos de fallar del RAG

Cuando un RAG da una respuesta mala, casi siempre encaja en uno de estos cinco patrones. Aprender a clasificarlos es la mitad del debug.

#### Modo 1: query fuera de distribución (OOD)

El usuario pregunta algo que no está en el corpus. "¿Cuánto cuesta enviar a Marte?". El retrieval devuelve los K menos malos, todos irrelevantes. Sin threshold, los pasamos al LLM. Resultado: alucinación.

**Solución:** threshold + instrucción "si nada es relevante, di 'no tengo información'".

#### Modo 2: contexto irrelevante (false positive del retriever)

El retrieval devuelve documentos que **parecen** relevantes por similitud léxica/semántica pero **no responden** la pregunta. Ejemplo: el usuario pregunta "¿hacen envíos internacionales?", el retrieval devuelve productos cuya descripción menciona "envío" sin hablar de la política internacional.

**Solución:** mejor retriever (S10 — hybrid search, query rewriting), reranking (S11.1).

#### Modo 3: respuesta correcta enterrada (recall low)

El documento que tiene la respuesta existe en el corpus pero no entra en el top-K. Rank 47 cuando K=5.

**Solución:** ampliar K + reranking, o mejorar el retriever (chunking, hybrid).

#### Modo 4: alucinación grounded

El contexto correcto está en el prompt, pero el LLM lo ignora o reescribe. "El producto P-012 es una mochila de 35 litros" → el modelo responde "P-012 es una mochila de 50 litros".

**Solución:** prompt más estricto, citas obligatorias, modelo más capaz, temperatura más baja, evaluación con RAGAS faithfulness.

#### Modo 5: contradicciones entre chunks

Top-K devuelve dos documentos que se contradicen entre sí (versiones distintas de un manual, FAQ vieja + FAQ nueva). El LLM elige uno arbitrariamente o mezcla ambos.

**Solución:** mantenimiento del índice (S11.2), versionado de documentos, dedupe.

> **Patrón de debug:** cuando una respuesta sale mal, **inspeccioná primero los chunks recuperados**. ¿Estaba ahí la respuesta? Si no estaba → modo 1, 2 o 3 (problema de retrieval). Si estaba → modo 4 (problema de generación). Si estaba dos veces y contradictoria → modo 5 (problema de datos).

### 4.7. Top-K y threshold: calibración operativa

Defaults razonables como punto de partida:

| Caso | K sugerido | Threshold sugerido |
|------|-----------|--------------------|
| Asistente conversacional sobre catálogo | 3-5 | 0.55 |
| FAQ de soporte (respuesta única esperada) | 1-3 | 0.65 |
| Resumen multi-documento | 8-15 | 0.50 |
| Reranking posterior | 20-50 (luego rerankeás) | 0.40 |

Estos son **puntos de partida**, no verdades. La forma correcta de calibrar:

1. **Construí un eval set** de 30-100 pares `(pregunta, doc_ids esperados)`.
2. **Medí Recall@K** para varios K (1, 3, 5, 10, 20).
3. **Buscá el codo** de la curva: el K más allá del cual ganar recall cuesta mucho más contexto.
4. **Calibrá threshold** en paralelo: ¿a qué corte tu precisión sigue siendo aceptable?

S11.3 entra en RAGAS y Promptfoo, que automatizan esto. En S09 alcanza con entender el principio.

### 4.8. Métricas básicas (las verás en profundidad en S11.3)

#### Métricas del retriever

- **Recall@K:** de los documentos verdaderamente relevantes para una query, ¿qué porcentaje aparece en el top-K? Métrica primaria del retriever.
- **MRR (Mean Reciprocal Rank):** posición promedio del primer documento relevante. Si suele aparecer en el rank 3, MRR = 1/3 ≈ 0.33. Captura la idea de "no alcanza con encontrarlo, hay que encontrarlo arriba".
- **Hit Rate@K:** ¿en qué fracción de queries hubo al menos un relevante en el top-K? Métrica binaria, útil para alarmas.

#### Métricas del sistema completo

- **Faithfulness:** ¿la respuesta solo afirma cosas presentes en el contexto?
- **Answer Relevance:** ¿la respuesta contesta la pregunta?
- **Context Relevance:** ¿el contexto recuperado era relevante?

Las tres se miden con un LLM judge (RAGAS las implementa así). Lo importante por ahora: **estas métricas son ortogonales**. Una respuesta puede ser fiel pero no contestar la pregunta. Otra puede contestar pero inventar. Otra puede tener contexto excelente y aun así dar respuesta mala. Por eso medimos las tres.

## 5. Patrones y antipatrones

### Patrones

- **Empezá por RAG ingenuo, medí, y solo después agregá complejidad.** El 80% de las apps con RAG en producción que funcionan bien hoy son ingenuas + buen prompt + buen eval set.
- **Devolvé `[]` cuando el threshold filtra todo.** Mejor "no sé" que alucinación.
- **Citá las fuentes en la respuesta.** Reduce alucinación y permite auditoría.
- **Loguea la query, los chunks recuperados y la respuesta** en producción. Sin esto no puedes debuggear modos de fallar.
- **Mantén prompt y modelo separados del retriever.** El día que cambies el modelo, no quieres que el retriever cambie también.
- **Calibrá K y threshold con un eval set, no a ojo.** Defaults sirven para arrancar; producción exige medir.

### Antipatrones

- **Bajar el threshold para "siempre tener algo".** Convierte alucinación en hallazgo y degrada la confianza del producto.
- **Pasar K=20 chunks "por las dudas".** Costo, latencia y dilución del contexto. Más no es mejor.
- **Confundir "el LLM no respondió bien" con "el retrieval no funcionó".** Diagnosticá primero qué etapa falló.
- **Olvidar el `id` del documento en el prompt.** Sin ID no hay citas, sin citas no hay trazabilidad.
- **Indexar todo el contenido sin chunking.** Documentos largos enteros saturan el contexto y dispersan la similitud (esto se vio en S07.1).
- **Usar el LLM más caro disponible "por si acaso".** Para RAG conversacional, Gemini Flash o Claude Haiku alcanzan en el 90% de los casos.

## 6. Conexión con TiendaPro

Esta sesión arranca el Módulo 4 conectando lo que ya teníamos. Hasta ahora:

- M2: el asistente conversaba con personalidad pero **respondía sobre el catálogo con `findProducts`** — un keyword matching primitivo sobre el JSON local.
- M3: armamos el retriever pgvector real, con embeddings y todo, **pero el asistente no lo usaba todavía**.

S09 cierra esa brecha **a nivel demo**: ejercicios ejecutables que muestran el pipeline completo (query → retrieval real → LLM) sobre el corpus ya indexado. **El swap definitivo del asistente para usar el retriever pgvector con citas y reranking ocurre al final del módulo (S11.2/S11.3)**, cuando ya tenemos hybrid search, reranking y evaluación.

Lo que el usuario va a ver al ejecutar los ejercicios:

- **01-naive-rag:** un pipeline RAG mínimo en ~80 líneas. Útil como referencia mental.
- **02-rag-vs-no-rag:** comparativa lado a lado. Cuándo RAG ayuda, cuándo no, y cuándo perjudica.
- **03-top-k-tradeoffs:** efecto cuantificable de K=1 vs K=3 vs K=10 sobre la respuesta y el costo.
- **04-failure-modes:** los cinco modos de fallar provocados a propósito, para reconocerlos en producción.

## 7. Resumen

Tres ideas para llevarte:

1. **RAG es una arquitectura, no un producto.** Tres etapas (Retrieve → Augment → Generate), cada una evaluable y reemplazable por separado. La mayoría de los problemas se diagnostican identificando en qué etapa falló.
2. **El retrieval ingenuo + buen prompt resuelve el 80% de los casos.** No empieces con hybrid search + reranker + query rewriting. Empezá con kNN + threshold + instrucciones anti-alucinación, medí, y solo agregá complejidad cuando los datos te lo pidan.
3. **`[]` es una respuesta válida.** Mejor que el sistema diga "no tengo información sobre eso" que alucinar con contexto irrelevante. Threshold + instrucción de salida son los dos mecanismos que lo hacen posible.

## 8. Preguntas de auto-evaluación

1. Tu RAG sobre el catálogo de TiendaPro responde "no, no vendemos drones" cuando el usuario pregunta por drones, pero los drones SÍ están en el catálogo. ¿Cuál de los cinco modos de fallar es? ¿Cómo lo confirmás en 2 minutos?
2. Subís el threshold de 0.55 a 0.75. ¿Qué métrica del retriever mejora y cuál empeora? ¿En qué tipo de producto preferirías 0.75?
3. Tu equipo propone "pasarle al LLM los top-50 chunks por las dudas, así nunca le falta contexto". Da tres razones técnicas concretas para rechazar el cambio.
4. Diferencia operativa entre **faithfulness** y **answer relevance**. Da un ejemplo de respuesta que sea alta en una y baja en la otra.
5. Tu RAG funciona perfecto en dev, pero en producción los usuarios reportan respuestas inventadas. ¿Qué tres logs agregarías esta misma semana para diagnosticar?
6. Te piden agregar RAG sobre los manuales internos del equipo de finanzas. Antes de prometer la fecha, ¿qué cinco preguntas haces sobre el corpus y los usuarios?

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 4 demos ejecutables sobre el catálogo de TiendaPro ya indexado.

**Próxima sesión:** [`S10 — Técnicas avanzadas de recuperación`](../sesion-10-tecnicas-avanzadas-recuperacion/) → hybrid search (denso + BM25), query rewriting, HyDE, multi-query.
