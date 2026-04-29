# Sesión 07.1 — Chunking de documentos: estrategias y trade-offs

> **Módulo:** 3 — Embeddings y búsqueda vectorial · **Duración estimada:** 1h (~25 min lectura + ~35 min práctica) · **Formato:** 50% teoría / 50% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión vas a poder:

- Explicar **por qué un documento entero no se embedea de una vez** y qué problemas surgen si lo haces.
- Distinguir las **4 estrategias canónicas de chunking**: fixed-size, recursive (text splitter jerárquico), semantic y structural — con sus casos de uso.
- Decidir el **tamaño del chunk** y el **overlap** correcto según el modelo de embeddings y el tipo de documento.
- Diseñar la **metadata por chunk** que tu retrieval va a necesitar (source, chunk_id, position, parent_doc, headings).
- Evaluar si tu chunking está bien: heurísticas operacionales antes de pasar a métricas formales (que entran en M4 con RAGAS).

## 2. Prerequisitos

- **S06** completa. En particular: pipeline embed → index → query, similitud coseno, qué es un espacio semántico.

## 3. Conceptos clave

- **Chunk:** fragmento del documento original que se embedeaa como una unidad. Un mismo doc se parte en N chunks; cada uno produce un vector.
- **Tamaño del chunk:** medido en tokens o caracteres. Típicamente 200–1000 tokens según el caso. Demasiado chico pierde contexto; demasiado grande diluye señal.
- **Overlap:** repetición de N tokens entre chunks consecutivos para que la información en los bordes no se corte. Típico: 10-20% del chunk size.
- **Metadata:** datos sobre el chunk que NO se embedean pero acompañan al vector (source, chunk_id, parent_doc, position, headings, timestamp). Críticos para el retrieve y la citación.
- **Splitter:** función que dado un documento devuelve `Chunk[]`. Distintas estrategias = distintos splitters.

## 4. Teoría

### 4.1. Por qué chunking

Un LLM tiene context window grande (128K-1M). Pero los **modelos de embeddings tienen un límite mucho menor** — típicamente **512-8192 tokens** por input. Razones:

1. **Límite del modelo de embeddings.** Casi todos están entrenados con secuencias cortas. Pasar más texto truncate o tira error.
2. **Calidad del embedding.** Aunque entre, un embedding de 8K tokens "promedia" demasiado: el detalle de la página 7 se diluye en el ruido.
3. **Granularidad del retrieve.** Si embedeás un documento de 50 páginas como una unidad, el sistema solo puede decir "este doc es relevante" — no "el párrafo 3 de la página 12". Los usuarios quieren respuestas, no documentos.
4. **Costo y latencia del retrieve.** Trabajar con miles de chunks chicos es más rápido y eficiente que hacer brute force sobre megachunks.

> **La regla:** chunkear convierte un corpus con cientos/miles de documentos en un corpus con miles/millones de chunks **donde cada chunk es una unidad de respuesta semántica autónoma**. Esa autonomía es la propiedad clave.

### 4.2. Las 4 estrategias canónicas

#### A. Fixed-size — partir cada N tokens

La más simple. Recorrés el texto y cortás cada `chunk_size` tokens (con overlap opcional).

```
Texto original: "El asistente de TiendaPro responde sobre productos. La política de envíos..."
Chunks (size=10, overlap=2):
  [El asistente de TiendaPro responde sobre productos. La política]
  [productos. La política de envíos...]
```

**Ventajas:** trivial de implementar, predecible, control total sobre el tamaño.

**Desventajas:** corta a mitad de oración, a mitad de palabra, ignora estructura. Calidad mediocre para texto natural.

**Cuándo usarla:** prototipos, datos sin estructura clara, cuando el chunking importa menos que el embedding.

#### B. Recursive — el text splitter jerárquico

El estándar de facto en producción. Intenta partir por separadores semánticos en orden de prioridad:

```
Prioridad: ["\n\n", "\n", ". ", " ", ""]
```

1. Si el chunk cabe en `chunk_size`, listo.
2. Si no, intenta partir por `\n\n` (párrafos).
3. Si todavía no cabe, intenta `\n` (líneas).
4. Sigue bajando hasta cortar por palabra o, en última instancia, por carácter.

```
Texto: "Política de envíos.\n\nLos envíos a península llegan en 2-4 días...\n\nPara zonas..."

Recursive intentará primero por \n\n (párrafos), respetando la estructura.
```

**Ventajas:** respeta párrafos y oraciones cuando es posible. Es el balance pragmático entre simplicidad y calidad.

**Desventajas:** sigue siendo "tonto" — no entiende el contenido, solo la estructura textual.

**Implementación canónica:** `RecursiveCharacterTextSplitter` de LangChain. Lo usamos en los ejercicios.

**Cuándo usarlo:** **default profesional para texto natural**. El 80% de los casos que vas a ver en M4 usan recursive.

#### C. Semantic chunking — partir por cambios de tema

En lugar de partir por tamaño o estructura, partís donde **cambia el significado**:

1. Embedeás cada oración del documento.
2. Calculás similitud coseno entre oraciones consecutivas.
3. Los **valles de similitud** (donde dos oraciones consecutivas son disimilares) marcan el límite del chunk.

```
Oración 1: "Política de envíos a península..."
Oración 2: "Los plazos son de 2-4 días..."         ← similar (0.78)
Oración 3: "Política de devoluciones..."           ← cambio (0.32) ← cortar aquí
Oración 4: "Tienes 30 días para devolver..."       ← similar (0.74)
```

**Ventajas:** chunks más coherentes que recursive, especialmente en docs largos con múltiples temas mezclados.

**Desventajas:** caro (un embedding por oración), complejo de tunear, marginal mejora en muchos casos.

**Cuándo usarlo:** documentos largos con cambios temáticos suaves (libros, transcripciones, papers). Para FAQs cortas o un catálogo, **no compensa**.

#### D. Structural — explotar la estructura del documento

Para documentos con estructura conocida (Markdown con `#`, HTML con `<h1>`, código con funciones), partís según los marcadores de la estructura.

```
# Política de envíos
Los envíos a península llegan en 2-4 días...

## Zonas remotas
Para Canarias y Baleares...

# Política de devoluciones
Tienes 30 días...
```

Splitter inteligente: cada sección H1/H2/H3 es un chunk con metadata de la jerarquía.

**Ventajas:** la metadata jerárquica (heading path) es oro para retrieval ("muéstrame todos los chunks bajo 'Política de envíos'").

**Desventajas:** requiere que la estructura sea consistente. Se rompe en documentos mal formados.

**Cuándo usarlo:** **cualquier doc con estructura clara**: docs técnicas, runbooks, manuales. Combina bien con recursive (structural primero, recursive como fallback dentro de cada sección).

### 4.3. Tamaño del chunk y overlap — la decisión operacional

#### Tamaño

| Caso de uso | Tamaño típico | Razón |
|-------------|---------------|-------|
| FAQs cortas (1-3 oraciones) | 100-300 tokens | Cada FAQ es una unidad, no la dividas |
| Wiki / docs técnicas | 500-800 tokens | Balance entre detalle y cohesión |
| Libros / transcripciones | 800-1500 tokens | Más contexto por chunk para entender narrativa |
| Código | 200-500 tokens (o por función) | Cada función / clase es la unidad natural |

**Regla práctica:** tamaño tal que un humano lea el chunk solo y entienda lo que dice. Si no lo entiende, el LLM tampoco.

#### Overlap

El overlap repite N tokens entre chunks consecutivos. Sirve para que información que cae en el borde de un chunk también aparezca al inicio del siguiente.

| Overlap | Cuándo | Trade-off |
|---------|--------|-----------|
| **0%** | Documentos con cortes naturales claros (FAQs, secciones) | Sin redundancia, riesgo de perder info de borde |
| **10-15%** | Default razonable | Pequeña redundancia, mitiga bordes |
| **20-30%** | Documentos densos donde cada oración cuenta | Más redundancia, más almacenamiento |
| **>30%** | Casi nunca | Desperdicio: pagas por embedear texto repetido |

> **Patrón:** chunk_size 800, overlap 100-150. Default razonable para 80% de casos.

### 4.4. Metadata por chunk — donde está la ingeniería real

Sin metadata, tu chunk es un texto suelto. Con metadata, puedes filtrar, citar, debuggear, etiquetar. Forma típica:

```typescript
interface Chunk {
  text: string;             // el texto a embedear
  metadata: {
    source: string;         // ID del doc original (faq-envio.md, manual-v3.pdf)
    chunkId: string;        // ID único del chunk dentro del doc (faq-envio.md:c0, c1, c2)
    position: number;       // índice del chunk dentro del doc (0, 1, 2, ...)
    headings?: string[];    // jerarquía de headings si es structural
    sourceUrl?: string;     // dónde linkear cuando citamos
    createdAt?: string;     // para invalidación de chunks viejos
  };
}
```

#### Casos de uso de la metadata

- **Citación en RAG (M4):** "según el chunk faq-envio.md:c2..." → mostrar al usuario una cita verificable.
- **Filtrado pre-retrieve:** "solo busca en chunks de la categoría 'políticas'".
- **Re-indexación incremental:** invalidar chunks de un doc específico sin tocar el resto.
- **Debugging:** "este resultado raro vino del chunk X del doc Y → ir a verificar el doc fuente".

> **Patrón:** la metadata se decide ANTES de embedear. Si después te das cuenta que falta un campo, hay que re-indexar todo. Diseñala con cuidado.

### 4.5. Heurísticas para evaluar si tu chunking está bien

Antes de pasar a métricas formales (M4 con RAGAS), tres preguntas operacionales:

1. **¿Un humano puede responder la pregunta del usuario leyendo solo el chunk top-1?** Si no, tus chunks son demasiado chicos o estás perdiendo el contexto necesario.
2. **¿Hay chunks que tienen >50% del mismo contenido?** Tu overlap está demasiado alto o tus separadores son malos. Estás pagando por embedear texto repetido.
3. **¿Hay chunks que no tienen sentido por sí solos** ("Por lo tanto, debes..." sin contexto)? Tu chunking corta razonamiento. Necesitás overlap, separadores mejores, o documentos mejor escritos.

Estas heurísticas detectan el 80% de los problemas de chunking sin necesidad de eval set formal.

## 5. Patrones y antipatrones

### Patrones

- **Recursive con `\n\n` → `\n` → `. ` → ` ` como default.** Cubre la mayoría de los casos sin pensar.
- **Structural primero cuando el doc tiene jerarquía clara**, recursive como fallback dentro de cada sección.
- **Metadata diseñada antes de empezar.** Es difícil de retrofittear sin re-indexar.
- **Chunk size proporcional al modelo:** 500-800 tokens si tu embedder es 512-input; 1500-3000 si tu embedder es 8192-input. Pero no llenes el techo del embedder — perdés calidad.
- **Overlap 10-15%.** Si dudás, 100 sobre 800.
- **Inspeccionar los primeros 20 chunks manualmente** antes de embedear todo. Ahorra horas de debugging.

### Antipatrones

- **Fixed-size sobre texto natural.** Cuando el chunk corta a mitad de oración, el embedding pierde semántica.
- **Chunks gigantes (>2K tokens) "por las dudas".** Diluyen señal, gastan tokens, y muchos modelos los truncan.
- **Sin overlap nunca**, salvo que tengás cortes naturales obvios. Te vas a comer info de borde.
- **Re-chunkar y re-indexar a cada cambio menor.** Diseña una estrategia, mantenla. Si tienes que cambiar, re-indexa todo y versiona el índice.
- **Metadata pobre** ("solo el texto, ya está"). Después no puedes citar, no puedes filtrar, no puedes debuggear.
- **Semantic chunking en docs cortos** (FAQs, definiciones). Es matar moscas a cañonazos.

## 6. Conexión con TiendaPro

TiendaPro va a tener dos corpus en M4:

1. **Catálogo de productos** — items chicos (un producto = un chunk natural). NO necesita chunking complejo.
2. **FAQs y políticas** — docs cortos con estructura. Algunos cortos (1-2 chunks), otros largos (políticas extensas).

**Plan de M3 hacia M4:**

- En esta sesión jugamos con chunkers sobre un manual de TiendaPro de ejemplo (`data/manual.md`).
- En **S08** indexamos el catálogo + FAQs en pgvector con metadata correcta.
- En **M4** hacemos retrieval real + generación con citas.

## 7. Resumen

Tres ideas para llevarte:

1. **Chunkear es ingeniería de retrieval, no de NLP.** No se trata de "el chunk perfecto" — se trata de que cada chunk sea **autónomo** (un humano lo entiende leyéndolo solo) y **citable** (con metadata para volver al doc origen).
2. **Recursive con separadores `\n\n → \n → . → espacio` es el default profesional.** Empieza con eso. Cambia solo cuando un caso concreto lo justifique.
3. **La metadata se decide al inicio del proyecto.** `source`, `chunkId`, `position`, `headings` son el mínimo. Sin metadata buena, retrieval es ciego: tienes vectores que no puedes explicar.

## 8. Preguntas de auto-evaluación

1. ¿Por qué embedear un documento entero como una unidad casi nunca funciona? Da 3 razones distintas.
2. Tu corpus son FAQs de 1-3 oraciones cada una. ¿Qué chunking usas y por qué? ¿Y si fueran capítulos de un manual de 500 páginas?
3. ¿Qué problema resuelve el `overlap` y cuándo lo subís a 25-30% del chunk size?
4. Diseña la metadata mínima de un chunk que viene de un PDF de 100 páginas, considerando que en M4 quieres citar "página X, sección Y" cuando respondes.
5. Estás haciendo recursive chunking con separadores `["\n\n", "\n", " "]`. Te encontrás un documento sin saltos de línea — todo en una sola línea de 5000 tokens. ¿Qué pasa con tu chunker y cómo lo arreglás?
6. ¿Cuándo NO compensa usar semantic chunking aunque tengas el cómputo? Da 2 casos.

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 3 ejercicios sobre chunking real (fixed-size, recursive, structural).

**Próxima sesión:** [`S07.2 — Teoría de embeddings y modelos`](../sesion-07.2-modelos-embeddings/) → cómo se entrenan los embedders, dimensiones, MTEB, comparativa práctica TS + Python.
