# Sesión 01.2 — Ejercicios (lab práctico)

> **Tiempo estimado:** ~35 min total. Vas a correr la comparativa multi-provider, leer el output con criterio, modificar el prompt para ver cómo cambian las métricas, y cerrar el módulo con una decisión informada de proveedor para TiendaPro.

---

## 1. Correr la comparativa (~5 min)

```bash
cd code/m01-fundamentos/sesion-01.2
pnpm install
pnpm compare
```

El script:

1. Detecta qué proveedores tienes configurados en `.env`.
2. Ejecuta el MISMO prompt contra todos los disponibles, en serie.
3. Reporta latencia, tokens, costo estimado y throughput.
4. Imprime las respuestas completas para que puedas comparar lado a lado.

### Output esperado (ejemplo real, abril 2026 con 3 proveedores)

```
Provider       Input   Output      Cost (USD)     Latency    Tok/s
------------------------------------------------------------------
ollama            71      375    free (local)     72158ms      5.2
google            54      335       $0.000346     13093ms     25.6
anthropic         81      240       $0.001281      3175ms     75.6
```

(Tus números van a variar — modelo, hardware, conexión, hora del día.)

---

## 2. Leer el output con criterio (~10 min)

El verdadero trabajo no es correr el script — es **leer lo que dice**. Responde estas 5 preguntas con los datos de TU corrida:

### 2.1. Tokens de input — ¿por qué difieren?

Si tu output mostró:

```
ollama:    71 input tokens
google:    54 input tokens
anthropic: 81 input tokens
```

con el mismo prompt y system prompt para los 3.

**Pregunta:** ¿por qué cada proveedor reporta una cuenta distinta? *(Pista: relee S00.2, sección 4.2.)*

> **Respuesta esperada:** cada modelo usa su propio tokenizer (vocabulario y BPE). El mismo texto se segmenta en distinto número de tokens según el modelo. Esto significa que **comparar precios "por token" entre proveedores requiere normalizar** — un proveedor con precio menor por token puede ser más caro al final si tokeniza peor para tu idioma.

### 2.2. Output tokens — ¿por qué difieren tanto?

Mismo prompt, mismas instrucciones de "sé breve". Aun así, las longitudes pueden variar 50% o más. ¿Por qué?

> **Respuesta esperada:** RLHF y defaults distintos. Algunos proveedores son entrenados para ser más extensos por defecto (Gemini), otros para ser más concisos (Claude Haiku con su énfasis en velocidad). Si quieres respuestas comparables en longitud, **tienes que pedirlo explícitamente con instrucciones más estrictas** ("máximo 100 palabras", "exactamente 6 ítems") o setear `maxOutputTokens`.

### 2.3. Costo — ¿qué proveedor "gana"?

A partir de tus números, calcula:

- Costo de UN mensaje en cada proveedor.
- Costo si TiendaPro recibe 10.000 mensajes/día.
- Costo a 100.000 mensajes/día.

> **Ejemplo de cálculo con los números de la corrida real:**
> - Ollama: $0/mes (local, asumiendo hardware ya pagado)
> - Gemini Flash: $0.000346 × 10.000 × 30 = **~$104/mes** a 10K msj/día. **~$1.040/mes** a 100K.
> - Anthropic Haiku: $0.001281 × 10.000 × 30 = **~$385/mes** a 10K msj/día. **~$3.850/mes** a 100K.
>
> Anthropic cuesta ~3.7× más que Gemini en este caso. ¿Lo justifica la diferencia de calidad? Esa pregunta solo se responde con evaluación rigurosa (M4).

### 2.4. Latencia y throughput — ¿qué importa más para UX?

Mira las dos métricas:

- **Latencia total** (ms): cuánto tarda en terminar.
- **Throughput** (tokens/s): cuán rápido GENERA tokens una vez que arranca.

**Pregunta:** si vas a hacer streaming en la UI (que vas a hacer en S04), ¿qué métrica le importa más al usuario y por qué?

> **Respuesta esperada:** **throughput** (tokens/s). Con streaming, el usuario ve el primer token rápido y va leyendo a medida que sale. Lo que percibe como "rápido" o "lento" es la velocidad de generación, no el tiempo total. Una respuesta de 500 tokens a 80 tok/s "se siente" muchísimo más rápida que una de 100 tokens a 10 tok/s, aunque la latencia total sea similar.

### 2.5. Calidad subjetiva — lee las respuestas

Compara las respuestas de cada proveedor mirando:

- **Estructura:** ¿usan markdown? ¿bullets? ¿headers?
- **Tono:** ¿formal? ¿amable? ¿directo?
- **Adherencia al prompt:** ¿pidió 3 ventajas y 3 desventajas y eso dio? ¿O agregó una "recomendación final" que no pediste?
- **Claridad:** ¿hay redundancia? ¿hay relleno?

Asigna una nota subjetiva del 1 al 10 a cada uno y justifica. **Esta es tu evaluación humana** — vale tanto como cualquier benchmark cuando estás eligiendo para un producto concreto.

---

## 3. Modificar el experimento (~10 min)

Edita el `PROMPT` y/o `SYSTEM_PROMPT` en `compare.ts` y vuelve a correr `pnpm compare`. Prueba al menos **dos** de las siguientes variaciones:

### Variación A — prompt más corto

```typescript
const PROMPT = "¿Conviene un libro impreso o un e-reader? Responde en una frase.";
```

**Observa:**
- ¿Cuántos tokens ahora?
- ¿Cambia el costo proporcionalmente?
- ¿Cambia la diferencia entre proveedores?

### Variación B — prompt en inglés

```typescript
const SYSTEM_PROMPT = "You are a helpful assistant. Respond clearly and concisely.";
const PROMPT = "Help me decide between buying a printed book or an e-reader. List 3 pros and 3 cons of each. Be brief.";
```

**Observa:**
- ¿Bajan los tokens? *(Spoiler: sí, español tokeniza peor.)*
- ¿Cambia el estilo de las respuestas?
- ¿Es la misma diferencia entre proveedores?

### Variación C — pedir formato JSON estructurado

```typescript
const PROMPT =
  "Responde en JSON estricto con esta estructura: " +
  '{ "libro_impreso": { "ventajas": [...], "desventajas": [...] }, ' +
  '"e_reader": { "ventajas": [...], "desventajas": [...] } }. ' +
  "Sin texto antes ni después del JSON.";
```

**Observa:**
- ¿Cuál proveedor produce JSON limpio? ¿Cuál mete texto antes/después?
- ¿Cuál tiene menos errores de formato?
- *(Esto es preview de M2 — salidas estructuradas. Hay formas mejores que pedirlo en el prompt.)*

### Variación D — temperature explícita

Modifica la llamada en `compare.ts`:

```typescript
const result = await generateText({
  model,
  system: SYSTEM_PROMPT,
  prompt: PROMPT,
  temperature: 0,             // ← agrega esta línea
});
```

Corre la comparación 2 veces seguidas. **Observa:** las respuestas con `temperature: 0` deberían ser **idénticas o casi-idénticas** entre corridas (determinismo). Sin esa línea, son distintas. Esto es lo que viste en S00.2 sobre sampling.

---

## 4. Reto opcional — calidad subjetiva con LLM-as-judge (~10 min)

Esto es preview profundo de M4 (evaluación). Si te queda tiempo:

Modifica `compare.ts` para que, después de obtener todas las respuestas, haga **una llamada extra** a Claude (o Gemini) con un prompt como:

```
Evalúa las siguientes 3 respuestas a la misma pregunta, calificándolas del 1 al 10 en:
- Claridad
- Estructura
- Concisión
- Utilidad práctica

Pregunta: "<el PROMPT>"

Respuestas:
1. (de ollama):    <texto>
2. (de google):    <texto>
3. (de anthropic): <texto>

Devuelve solo un JSON con la forma:
{ "ollama": {...}, "google": {...}, "anthropic": {...} }
```

Esto se llama **LLM-as-judge** y es una técnica central de evaluación moderna. Tiene sus problemas (sesgo del juez, posición), pero como herramienta exploratoria es muy útil.

**No es necesario commitear este cambio.** Es para que veas el patrón en acción.

---

## 5. Aporte al proyecto integrador

A partir de los datos de TU corrida y tu evaluación subjetiva, **decide**:

> ¿Qué proveedor dejas como `DEFAULT_LLM_PROVIDER` para el cierre del Módulo 1 de TiendaPro?

No hay una respuesta universalmente correcta. Lo importante es que tu decisión tenga **justificación basada en datos** (no en marketing). Una decisión razonable de cierre puede ser:

- **Ollama** si priorizas trabajar offline, sin costo, y aceptas latencia más alta para desarrollo.
- **Gemini Flash** si quieres cloud + free tier amplio + balance de costo y velocidad.
- **Claude Haiku** si priorizas velocidad y calidad consistente, y aceptas pagar ~3-5× más que Gemini.

Documenta tu elección en `code/proyecto-integrador/README.md` con un comentario corto al final, algo como:

> ## Proveedor por defecto del Módulo 1
>
> Decisión tras la comparativa de S01.2: **Gemini 2.5 Flash**.
> Razones: free tier amplio para desarrollo, latencia <15s aceptable para MVP, costo proyectado a 10K msj/día = ~$104/mes (vs $385/mes Anthropic).
> A revisar en M4 cuando tengamos métricas de calidad rigurosas.

**Esto cierra el Módulo 1.** El próximo paso es taggear el commit como `proyecto-m1`.

---

**Vuelve a:** [`README de la sesión`](README.md) | **Próximo paso:** [`recursos.md`](recursos.md) → fuentes para mantener actualizada la comparativa.
