# Sesión 05.1 — Inyección de contexto desde archivos, web y bases de datos

> **Módulo:** 2 — Patrones de aplicaciones LLM · **Duración estimada:** 1.5h (~35 min lectura + ~55 min práctica) · **Formato:** 50% teoría / 50% práctica

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión vas a poder:

- Justificar **por qué un LLM necesita contexto externo** y qué problemas concretos resuelve eso (alucinaciones, datos privados, datos recientes).
- Distinguir las **tres fuentes de contexto** (archivos, APIs/web, BD relacional) y cuándo conviene cada una.
- Aplicar los **tres patrones de inyección** (full-content, summary-then-inject, query-then-inject) y elegir el correcto según costo, latencia y completitud.
- Reconocer cuándo **`promptCaching`** ahorra dinero y cuándo no aplica.
- Evitar los antipatrones más caros: contexto enorme en system prompt, contexto stale, inyección sin presupuesto de tokens.

> **Importante:** esta sesión es la **antesala conceptual** de M3 (embeddings) y M4 (RAG). Acá hacemos *retrieval clásico* (lookup por keys, queries SQL, fetch HTTP). En M3-M4 vemos la versión semántica (embeddings + búsqueda vectorial). El **patrón** es el mismo: traer lo justo, inyectar bien.

## 2. Prerequisitos

- **S02–S04** completas. Especialmente: estructura de la respuesta, wrapper con instrumentación, structured outputs.
- Familiaridad con `fetch` y JSON. Las consultas a SQL son ilustrativas — se pueden replicar con un JSON mock.

## 3. Conceptos clave

- **Inyección de contexto:** agregar al prompt información que el modelo NO tiene de entrenamiento (catálogo propio, FAQs, datos del cliente, datos recientes).
- **Fuente:** de dónde viene el contexto. Tres principales: **archivos** (JSON, MD, PDF), **APIs/web** (HTTP fetch, REST, scraping), **BD relacional** (SQL).
- **Patrón de inyección:** estrategia para componer el prompt. Trade-off entre completitud, costo y latencia.
- **Prompt caching:** mecanismo de algunos proveedores donde el bloque inicial del prompt (system + contexto estable) se cachea y se cobra al 10-25% del precio normal en llamadas siguientes.
- **Lost in the middle:** el modelo presta menos atención a información en el centro de un prompt largo. Implicación: orden importa.
- **Knowledge cutoff:** la fecha hasta la cual el modelo tiene datos de entrenamiento. Cualquier dato posterior **debes inyectarlo**.

## 4. Teoría

### 4.1. Por qué inyectar contexto

Un LLM solo sabe dos cosas:

1. **Lo que aprendió en entrenamiento** — corpus público hasta su knowledge cutoff. NO sabe nada de tu negocio, tu catálogo, tus clientes, tus precios.
2. **Lo que le pasas en la llamada** — system prompt, mensajes, contexto inyectado, tools.

Si tu app necesita responder *"¿la mochila Trekker 30L tiene compartimento para laptop?"*, el modelo NO lo sabe. **Tienes que decírselo en la llamada.**

#### Tres problemas concretos que resuelve la inyección de contexto

**Alucinaciones** (el modelo inventa datos plausibles pero falsos): si tu app inyecta *"el catálogo actual incluye: ... [datos reales]"* y el system prompt dice *"responde solo con info del catálogo o deriva si no encuentras"*, las alucinaciones bajan drásticamente.

**Datos privados** (el modelo no tiene acceso a tu DB): el modelo no sabe el estado de un pedido específico. Lo consultas tú en tu DB y se lo inyectas como parte del prompt.

**Datos recientes** (el modelo tiene knowledge cutoff): si Gemini 2.5 Flash fue entrenado con datos hasta abril 2025, no sabe nada que pasó después. Si te pregunta sobre un evento de marzo 2026, **tienes que inyectarlo**.

### 4.2. Las tres fuentes de contexto

#### A. Archivos locales (JSON, MD, CSV, PDF)

```typescript
const catalog = JSON.parse(readFileSync("data/catalog.json", "utf8"));
const relevantProducts = catalog.filter((p) => p.category === userInterest);

const result = await chat({
  system: `Eres el asistente de TiendaPro. Responde sobre el catálogo:\n${JSON.stringify(relevantProducts)}`,
  messages: [{ role: "user", content: userMessage }],
});
```

**Cuándo conviene:** datos chicos (~hasta 100 entradas), estables, fáciles de versionar en git. Catálogos pequeños, FAQs, políticas, configuraciones.

**Cuándo NO conviene:** datos que cambian frecuentemente (precios dinámicos, stock), datos grandes (>1MB), datos propios de cada usuario.

#### B. APIs / web

```typescript
const orderStatus = await fetch(`https://api.tiendapro.com/orders/${orderId}`)
  .then((r) => r.json());

const result = await chat({
  system: `Estado del pedido del cliente: ${JSON.stringify(orderStatus)}`,
  messages: [...]
});
```

**Cuándo conviene:** datos en sistemas externos (CRM, ERP, marketplace API), datos recientes (estado del pedido, stock), info pública (clima, noticias, FX).

**Cuándo tener cuidado:** latencia añadida (cada fetch suma a tu TTFT), errores del servicio externo (¿qué hace tu app si la API cae?), rate limits propios y de terceros.

#### C. Bases de datos relacionales

```typescript
const order = await db.query(
  `SELECT id, status, eta, items FROM orders WHERE id = $1`,
  [orderId],
);

const result = await chat({
  system: `Datos del pedido:\n${JSON.stringify(order)}`,
  messages: [...]
});
```

**Cuándo conviene:** datos transaccionales propios (pedidos, clientes, transacciones, tickets de soporte). La fuente de verdad de tu negocio.

**Patrón crítico:** **NUNCA construyas SQL con strings concatenados desde input del usuario al LLM**. SQL injection clásica + LLM injection se combinan de formas creativas. Usa siempre parámetros bind o un ORM con tipos.

#### Tabla resumen

| Fuente | Casos típicos | Latencia | Frescura | Riesgos principales |
|--------|---------------|----------|----------|---------------------|
| Archivo | Catálogo pequeño, FAQs | Mínima (lectura local) | Stale entre deploys | Datos viejos sin avisar |
| API/web | Estado de pedido, datos externos | Media (HTTP) | Tiempo real | Caída del servicio, rate limits |
| BD | Datos transaccionales | Baja-media (query SQL) | Tiempo real | SQL injection, queries N+1 |

### 4.3. Tres patrones de inyección

Una vez que tienes la fuente, **cómo** lo inyectas importa tanto como qué inyectas.

#### Patrón A. Full-content — todo al prompt

Pasas el dataset entero al system prompt:

```typescript
const ALL_PRODUCTS = JSON.parse(readFileSync("catalog.json"));

const result = await chat({
  system: `Catálogo de TiendaPro:\n${JSON.stringify(ALL_PRODUCTS)}\n\nResponde sobre estos productos.`,
  messages: [...]
});
```

**Cuándo conviene:** datasets pequeños (~5-50 items), lookup difícil de implementar (consultas en lenguaje natural sin coincidencia exacta).

**Costos:** el dataset entero cuenta como input tokens en CADA llamada. Para 200 productos × 500 tokens cada uno = 100K tokens de input por turno. **Caro y lento.**

#### Patrón B. Summary-then-inject

Resumes el dataset una vez (offline o periódicamente) y inyectas el resumen.

```typescript
const SUMMARY = `Catálogo TiendaPro: 200 productos en 5 categorías:
- Mochilas (35 modelos, $20-$200)
- Tiendas de campaña (28 modelos, $80-$800)
- ...`;

const result = await chat({
  system: `Resumen del catálogo:\n${SUMMARY}`,
  ...
});
```

**Cuándo conviene:** el modelo necesita una **visión general**, no items específicos. Útil para descubrimiento ("¿qué tipos de productos venden?") o ruteo a sub-agentes.

**Costos:** input pequeño y estable, alto recall a nivel de categoría, **bajo recall a nivel de item específico**.

#### Patrón C. Query-then-inject (el patrón profesional)

1. **Tu código** decide qué necesita el modelo según el mensaje del usuario.
2. **Consultás** la fuente (filter en JSON, fetch a API, query SQL) trayendo SOLO lo relevante.
3. **Inyectás** el subset al prompt.

```typescript
async function answerProductQuestion(userMessage: string) {
  // 1. Identificar de qué producto/categoría habla
  const { category, productHint } = await classifyTopic(userMessage);

  // 2. Traer SOLO lo relevante
  const products = await db.query(
    `SELECT * FROM products WHERE category = $1 AND name ILIKE $2 LIMIT 5`,
    [category, `%${productHint}%`],
  );

  // 3. Inyectar el subset
  return chat({
    system: `Productos relevantes:\n${JSON.stringify(products)}`,
    messages: [{ role: "user", content: userMessage }],
  });
}
```

**Cuándo conviene:** **siempre que sea posible.** Es el patrón profesional.

**Por qué gana:**
- **Costo bajo:** input mínimo y estable.
- **Latencia razonable:** una query rápida + una llamada al LLM.
- **Calidad alta:** el modelo recibe info exacta, sin "lost in the middle".
- **Escalable:** funciona igual con 50 o 50K items en la base.

**El paso 1 (clasificar/identificar) puede ser:**
- Reglas (regex, keywords) si el dominio es chico.
- Otro LLM con structured outputs (lo que aprendiste en S04).
- En M3 — embeddings + búsqueda vectorial. Es el upgrade de este patrón.

#### Cómo elegir

```
   ¿Cuántos items hay en la fuente?
       /          \
    ≤20           >20
     |             |
Full-content   ¿Necesitás items específicos?
                  /             \
                 SÍ              NO
                 |                |
        Query-then-inject    Summary-then-inject
```

### 4.4. El costo real del contexto

Tres dimensiones que casi nadie mide hasta que es tarde:

#### Costo en tokens

Cada token de contexto **es input que pagas en CADA llamada**. Si tu system prompt + RAG es 3K tokens y atiendes 100K mensajes/día con Gemini Flash:

```
3K × 100K × $0.20/1M = $60/día = $1.800/mes
```

Solo de contexto. Sin contar la respuesta.

#### Costo en latencia

Procesar 10K tokens de input lleva más tiempo que procesar 1K. Para Gemini Flash:

| Input tokens | TTFT aproximado |
|--------------|-----------------|
| 1K | 200-400ms |
| 10K | 600-1200ms |
| 100K | 3-6s |
| 1M | 30-60s |

**TTFT alto degrada UX irreversiblemente.** No hay forma de "compensar después".

#### Calidad: lost in the middle

Los modelos prestan **más atención al principio y al final** del prompt. Información en el medio de un prompt largo es ignorada con más frecuencia.

**Implicaciones operacionales:**

- **Pone el contexto crítico al final** del prompt, justo antes del mensaje del usuario.
- **No metas todo el catálogo** — el item que el cliente pregunta puede estar en la posición 47 de 200 y el modelo lo ignorá.
- **Acotá los chunks** a lo realmente necesario (vamos a profundizar en M3 con chunking strategies).

### 4.5. Prompt caching — la palanca grande

Anthropic, OpenAI y Google ofrecen *prompt caching*: el bloque inicial del prompt (system + contexto estable) se cachea y se cobra al **10-25% del precio normal** en llamadas siguientes (durante un TTL — típicamente 5-10 minutos).

#### Cómo se ve

```typescript
const result = await generateText({
  model: anthropic("claude-haiku-4-5"),
  messages: [
    { role: "system", content: LARGE_STABLE_CONTEXT, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
    { role: "user", content: userMessage },
  ],
});
```

#### Cuándo te ahorra dinero

- **System prompts grandes y estables** — políticas, FAQs, descripción del producto. Si el system es el mismo en cada llamada, lo pagas barato del 2do turno en adelante.
- **Contexto compartido entre usuarios** — el catálogo, manuales de producto. Mismo bloque para todos.
- **Volumen alto** — 1 ahorro por llamada × 100K llamadas/día = ahorro real.

#### Cuándo NO aplica

- Cada usuario tiene contexto distinto (memoria conversacional propia, datos del pedido específico).
- El system es chico (1-2 KB).
- Volumen bajo (la primera llamada paga precio completo; el ahorro acumula con volumen).

#### Cálculo de ahorro

Si `system + contexto` mide 5K tokens y atiendes 100K msg/día:

```
Sin caching: 5K × 100K × $1/1M = $500/día (Claude Haiku input)
Con caching: ~$50/día (10% del precio en hits) + $5/día (~1% misses)
            ≈ $55/día
Ahorro:      ~$445/día = ~$13K/mes
```

> Profundizamos prompt caching como técnica formal en **M6 — LLMOps**. Acá basta saber que existe y cuándo aplica.

### 4.6. Antipatrones frecuentes

#### Todo el contexto en el system prompt

```typescript
// 🚫 NO
const SYSTEM = `Eres el asistente de TiendaPro. Catálogo:
${JSON.stringify(ALL_500_PRODUCTS)}
FAQs:
${ALL_FAQ_MARKDOWN}
Políticas:
${POLICIES_PDF_TEXT}`;
```

Costo masivo, latencia explosiva, lost-in-the-middle severo.

#### Contexto stale

Cargás `catalog.json` en memoria al boot. Tres semanas después, los precios cambiaron pero tu app sigue inyectando los viejos. Soluciones: TTL, invalidación reactiva, fetch on-demand para datos críticos.

#### Inyección sin presupuesto

Tu app no tiene un límite explícito de tokens de contexto. Un día llega un cliente con 200 mensajes de historial + 50 productos en el carrito + 15 tickets viejos y se pasa de 200K tokens. **Error de context length, request fallido, cliente frustrado.**

**Patrón:** *budget* explícito por dimensión.

```typescript
const CONTEXT_BUDGET = {
  systemPrompt: 1500,
  conversationHistory: 4000,
  ragChunks: 6000,
  reservedForResponse: 1500,
}; // total ~13K, dentro del límite del modelo elegido.
```

Si una dimensión se pasa, **truncá** o **resumí** antes de armar el prompt. Esto se profundiza con memoria conversacional en S05.2.

## 5. Patrones y antipatrones

### Patrones

- **Query-then-inject como default.** Trae solo lo necesario; el modelo se concentra mejor.
- **Contexto crítico al final del prompt**, justo antes del mensaje del usuario, para mitigar lost-in-the-middle.
- **Budget de tokens por dimensión.** Truncar/resumir antes de exceder.
- **Prompt caching cuando el system prompt es grande, estable y compartido entre usuarios.**
- **Fail visible si una fuente externa falla.** No silencios — el usuario tiene que saber que algo falló o el modelo va a alucinar.

### Antipatrones

- **Catálogo entero en system prompt** "porque entra en context window". Pagás caro, latencia mala, calidad cae.
- **Cargar JSON al boot y nunca refrescar.** Datos stale es bug invisible que aparece en demos.
- **SQL construido por concatenación con input del usuario.** Injection clásica + LLM = compromiso del sistema.
- **Sin presupuesto de tokens.** Un día explotás en context length.
- **Contexto en el medio del prompt.** Lost in the middle te hace dudar de la calidad del modelo cuando el problema es tu prompt.

## 6. Conexión con TiendaPro

Hasta aquí TiendaPro responde con personalidad pero sin saber nada de productos reales. En esta sesión:

1. **Crear `data/catalog.json`** con un mock de ~12 productos (mochilas, tiendas, calzado, etc.) con `id`, `name`, `category`, `price`, `description`, `inStock`.
2. **Crear `src/lib/catalog.ts`** con `findProducts(query)` — filtro simple por keyword/categoría sobre el JSON. Esta es la "consulta" del query-then-inject (en M3 lo cambiamos por embeddings).
3. **Modificar `src/index.ts`** para que cuando el `intent` sea `pregunta`, primero llame a `findProducts(...)` con keywords del mensaje y le pase los resultados como contexto al `chatStream`.

El asistente de TiendaPro pasa de "habla genérico" a "responde sobre los 12 productos del catálogo" — sin RAG semántico aún, pero con el patrón correcto.

## 7. Resumen

Tres ideas para llevarte:

1. **El LLM solo sabe lo que entrenó + lo que pasas.** Para tu producto, lo segundo es el 99%. Aprender a inyectar contexto bien es el 80% del trabajo de AI Engineer.
2. **Query-then-inject es el patrón profesional.** Full-content es vago; summary-only pierde detalle. Filtrar y pasar solo lo relevante gana en costo, latencia y calidad.
3. **El contexto cuesta — en tokens, latencia y atención del modelo.** Budget explícito + prompt caching donde aplique + contexto crítico al final del prompt. Sin estas tres prácticas, los costos y la UX te van a matar antes de M4.

## 8. Preguntas de auto-evaluación

1. ¿Cuáles son las tres fuentes principales de contexto y un caso típico para cada una en TiendaPro?
2. Tu app tiene un catálogo de 500 productos. ¿Por qué pasarlo entero en el system prompt es mala idea? Dame 3 razones técnicas distintas.
3. ¿Qué es "lost in the middle" y qué implicancia operacional tiene para el ORDEN en que armas tu prompt?
4. Tu system prompt es 8K tokens de FAQs y políticas, idéntico para todos los usuarios. Atendés 50K msg/día con Claude Haiku. Estima el ahorro mensual de activar prompt caching.
5. Diferencia entre los patrones full-content, summary-then-inject y query-then-inject. Da un ejemplo de TiendaPro donde cada uno es la elección correcta.
6. Tu app inyecta `JSON.stringify(orders.find(...))` directo al prompt. ¿Qué problema de seguridad puede tener esto si `orders` viene de input del usuario? Pista: una palabra que termina en "injection".

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 3 ejercicios + reto + aporte al proyecto integrador.

**Próxima sesión:** [`S05.2 — Memoria conversacional e historial`](../sesion-05.2-memoria-conversacional/) → cómo darle al asistente memoria de la conversación sin que el contexto explote.
