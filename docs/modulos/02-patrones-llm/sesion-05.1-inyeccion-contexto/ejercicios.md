# Sesión 05.1 — Ejercicios

> **Tiempo estimado:** ~55 min total. Aplicas los tres patrones de inyección sobre el catálogo mock de TiendaPro y mides el costo de cada uno. Scripts en [`code/m02-patrones-llm/sesion-05.1/`](../../../../code/m02-patrones-llm/sesion-05.1/).

---

## Setup

```bash
cd code/m02-patrones-llm/sesion-05.1
pnpm install
```

`.env` con un proveedor configurado. El catálogo mock vive en `data/catalog.json`.

---

## 1. Ejercicio guiado: full-content vs query-then-inject

**Objetivo:** medir empíricamente cuánto cuesta cada patrón sobre el mismo dataset y la misma pregunta.

### 1.1. Tu tarea

Ejecuta el comparador:

```bash
pnpm run compare
```

El script:
1. Toma una pregunta del cliente: *"Busco una mochila para senderismo de 1-2 días."*
2. La responde dos veces sobre los **12 productos del catálogo**:
   - **Full-content:** pasa los 12 productos al system prompt.
   - **Query-then-inject:** filtra a los 3 más relevantes (categoría=mochila + keywords) y pasa solo esos.
3. Reporta tokens, latencia y costo de ambos.

### 1.2. Salida esperada

```
Pregunta: "Busco una mochila para senderismo de 1-2 días."

=== Full-content ===
Input tokens: 1240
Output tokens: 142
Latencia: 1840ms
Costo: $0.000390

=== Query-then-inject ===
Input tokens: 320
Output tokens: 138
Latencia: 980ms
Costo: $0.000202

Reducción de input: 74%
Reducción de costo: 48%
```

### 1.3. Pregunta para ti

Solo cambiaste cómo inyectas el catálogo — bajaste el costo casi a la mitad y la latencia un 47%. Si tu producto procesa 50K mensajes/día, ¿cuánto te ahorras al mes solo aplicando este patrón?

> **Cálculo aproximado:**
>
> - Diferencia: ~$0.000188 por mensaje.
> - 50K × 30 días = 1.5M mensajes/mes.
> - Ahorro: 1.5M × $0.000188 = **~$282/mes**.
>
> Por una decisión de arquitectura. **Por eso query-then-inject es el patrón profesional.**

---

## 2. Ejercicio: budget de tokens

**Objetivo:** implementar un budget explícito y truncado responsable.

### 2.1. Tu tarea

En `src/budget.ts`, implementa `enforceContextBudget(parts: { systemPrompt, history, ragChunks })` que:

1. Cuenta tokens de cada parte (estimación rápida con `gpt-tokenizer`).
2. Si alguna parte excede su budget, devuelve la versión truncada (al final, NO al medio — para preservar reciente).
3. Si el total excede el modelo, lanza error explícito (ahí decides si resumir o pedir conversación nueva).

Budget propuesto:

```typescript
const BUDGET = {
  systemPrompt: 1500,
  history: 4000,
  ragChunks: 6000,
  reservedForResponse: 1500,
  hardCeiling: 13000, // suma máxima permitida
};
```

### 2.2. Probarlo

```bash
pnpm run budget
```

El script ejecuta 3 casos:

- Caso normal (todo dentro del budget).
- Historial inflado (40 mensajes) → truncado a los últimos 4000 tokens.
- Caso patológico (todo excedido) → error explícito.

### 2.3. Pregunta para ti

¿Por qué truncas el historial **al inicio** en lugar de **al final**? Piensa la implicación en UX.

> **Razonamiento sugerido:** los mensajes recientes son los que el usuario acaba de escribir; truncar el final equivale a "olvidar lo último que dijiste", lo que rompe la conversación. Mantener los últimos N tokens preserva el contexto activo. La parte vieja (saludo inicial, charla de hace 30 mensajes) es más prescindible. En S05.2 vamos a refinar esto con summarization de historial viejo.

---

## 3. Ejercicio: simulación de prompt caching

**Objetivo:** entender el ahorro con un cálculo concreto.

### 3.1. Tu tarea

`src/caching-sim.ts` simula un escenario:

- System + contexto estable de 5K tokens, idéntico para todos los usuarios.
- 100 llamadas simuladas con prompts cortos del usuario (~50 tokens cada uno).
- Calcula el costo total con y sin caching, asumiendo:
  - Sin caching: input cuesta $1/1M.
  - Con caching: primera llamada $1/1M, siguientes $0.10/1M (10%).

### 3.2. Probarlo

```bash
pnpm run caching-sim
```

Salida esperada:

```
Sin caching:  100 × 5K input × $1/1M = $0.500
Con caching:  1 × 5K × $1/1M + 99 × 5K × $0.10/1M = $0.0545
Ahorro:       $0.4455 (89%)
```

### 3.3. Pregunta para ti

Tu system es **chico (300 tokens)** pero atiendes un volumen muy alto. ¿Compensa activar caching? ¿Y si tu system es **enorme (20K tokens)** pero solo atiendes 50 llamadas/día?

> **Razonamiento:** el ahorro absoluto = `tamaño_system × N_llamadas × ($1 - $0.10)/1M`. Compensa cuando:
>
> 1. **Tamaño del system × volumen** generan un costo significativo en absoluto.
> 2. El TTL del caché dura entre llamadas (5-10 min en proveedores actuales).
>
> Para un system de 300 tokens × 1M llamadas/mes: ahorro ≈ 300 × 1M × $0.90/1M = **$270/mes**. Vale la pena.
> Para un system de 20K tokens × 50 llamadas/día (1500/mes): ahorro ≈ 20K × 1500 × $0.90/1M = **$27/mes**. Compensa pero es marginal.

---

## 4. Reto: contexto desde web

**Objetivo:** integrar una fuente externa con manejo de errores correcto.

### 4.1. Tu tarea

Crea `src/web-context.ts` que:

1. Recibe una pregunta del cliente sobre clima en una ciudad.
2. Hace fetch a una API pública gratuita (ej. `wttr.in/CIUDAD?format=j1`).
3. Inyecta los datos relevantes (temp actual, condición, próximos días) al prompt.
4. Maneja:
   - Timeout (si la API tarda >3s, fallback a "no puedo consultar el clima ahora").
   - Error 4xx/5xx (idem).
   - Ciudad inexistente (idem).

### 4.2. Probarlo

```bash
pnpm run weather "Madrid"
pnpm run weather "Tokio"
pnpm run weather "Ciudad-Que-No-Existe"
```

### 4.3. Pregunta para ti

Tu app inyecta el JSON crudo de wttr.in (~3KB). ¿Cómo lo reducirías a lo justo? Piensa 2 transformaciones simples antes de inyectar.

> **Razonamiento sugerido:**
>
> 1. **Selección de campos:** extraer solo `temp_C`, `weatherDesc`, `precipMM`, `humidity`. Ignorar metadata, traducciones y el forecast horario detallado si solo te importa el día.
> 2. **Resumen textual:** convertir `{temp_C: 22, weatherDesc: "Sunny"}` a `"22°C, soleado"`. Ahorra tokens (JSON keys cuestan) y es más fácil de entender para el modelo.
> 3. **Truncado:** si pides 7 días de forecast pero solo necesitas hoy y mañana, recortar el array.

---

## 5. Aporte al proyecto integrador

Hito acumulado de M2 hasta acá: TiendaPro tiene chat service (S03), structured outputs (S04) y ahora **inyección de contexto** desde el catálogo.

### 5.1. Tarea

1. Copia `data/catalog.json` a `code/proyecto-integrador/data/catalog.json`.
2. Copia `src/lib/catalog.ts` a `code/proyecto-integrador/src/lib/catalog.ts`.
3. Modifica `code/proyecto-integrador/src/index.ts`:
   - Después de `classifyIntent(...)`, si el intent es `pregunta` y el mensaje parece ser sobre productos, llama a `findProducts(message)`.
   - Pasa los productos relevantes en el system prompt al `chatStream`.

### 5.2. Validación

```
[provider: google]
[flow: pregunta-producto]
[products injected: 3]

TiendaPro: Para senderismo de 1-2 días te recomiendo la mochila Trekker 30L, que tiene compartimento ventilado y...

Latencia: 1340ms
Tokens — input: 412, output: 156
Costo estimado: $0.000238
```

> Mantenlo en local. El commit `proyecto-m2` viene al final del módulo, después de S05.3.

---

**Vuelve a:** [`README de la sesión`](README.md) | **Próximo paso:** [`recursos.md`](recursos.md).
