# Sesión 05.3 — Personalización de prompts por usuario/rol + testing

> **Módulo:** 2 — Patrones de aplicaciones LLM · **Duración estimada:** 1.5h (~40 min lectura + ~50 min práctica) · **Formato:** 50% teoría / 50% práctica · **Cierra Módulo 2** con tag `proyecto-m2`

---

## 1. Objetivos de aprendizaje

Al terminar esta sesión vas a poder:

- Argumentar por qué **los prompts son código** y deben tratarse como tal: archivos versionados, revisados, testeados.
- Diseñar **prompt templates** parametrizables por usuario, rol o segmento, manteniendo los textos fuera del código TypeScript.
- Aplicar los **tres niveles de testing** de prompts: snapshot (renderizado), regression (eval set), runtime (spot checks).
- Reconocer cuándo introducir **Promptfoo** y qué problema resuelve sobre tests caseros.
- Diseñar un eval set inicial mínimo (10-20 casos) que detecte regresiones reales.

## 2. Prerequisitos

- **S02–S05.2** completas. En particular: chat service con flow logging (S03), structured outputs (S04), conversation store (S05.2).
- Familiaridad con Vitest o herramienta equivalente de testing (los ejemplos usan Vitest).

## 3. Conceptos clave

- **Prompt como código:** archivos versionados, revisados en PR y testeados antes de un deploy. Lo opuesto a strings hardcoded en cualquier parte de la app.
- **Prompt template:** prompt con placeholders (`{{userName}}`, `{{role}}`, `{{contextChunks}}`) que se llenan en runtime con datos del request.
- **Eval set:** colección de casos de prueba (input + criterios de aceptación) que sirven para detectar regresiones de calidad cuando cambias el prompt o el modelo.
- **Snapshot test:** test que compara el prompt **renderizado** contra una versión grabada. Falla si el prompt cambia inesperadamente. Es testing del template, no del modelo.
- **Regression test:** test que ejecuta la cadena completa (template → LLM → respuesta) sobre un eval set y verifica que la respuesta cumple criterios.
- **LLM-as-judge:** un LLM evalúa si la respuesta del LLM principal cumple criterios cualitativos. Patrón canónico para regression tests.

## 4. Teoría

### 4.1. Por qué los prompts son código

Hasta acá viste prompts como strings dentro de archivos TS. Funciona para una sesión inicial. **No funciona** para un producto real.

Imagina dos escenarios después de 6 meses de TiendaPro en producción:

**Escenario A — prompts en strings hardcoded:**

- ¿Qué prompt usaba el clasificador de intent en la versión que se desplegó hace 3 meses? → buscar en historial de git, leer el commit que cambió ese string.
- ¿Cambió alguien el system prompt y rompió la calidad? → no hay forma de saber sin tests.
- Querés que el equipo de producto pueda iterar el tono del asistente → ahora tienen que tocar TS.

**Escenario B — prompts en archivos versionados con tests:**

- Cada prompt vive en `prompts/intent-classifier.md` o `prompts/customer-support.system.md`.
- Hay snapshot tests del prompt renderizado: si cambias una variable, el test falla y ves el diff exacto.
- Hay regression tests sobre un eval set: si el cambio degrada calidad, sabes antes de mergear.
- Producto puede editar `.md` sin tocar código.

**El argumento es el mismo que con SQL queries en archivos `.sql`, o YAML para configs.** Cada vez que un texto controla comportamiento, separarlo del código tiene retorno. Para LLMs es **extra crítico** porque:

1. **Cambios de prompt afectan calidad sin error visible.** El test verde puede ocultar regresión semántica.
2. **Modelos cambian sin que cambies código.** Cuando el proveedor actualiza Claude Haiku 4.5 → 4.6, tus tests son lo único que detecta degradación.
3. **A/B testing de prompts** requiere poder versionarlos y referenciarlos por id.

### 4.2. Prompt templates — parametrización

#### Template literal vs sistema dedicado

**Opción A — template literal de TS:**

```typescript
const SYSTEM_PROMPT = (userName: string, locale: string) => `
Eres el asistente virtual de TiendaPro.
Hablas con ${userName} en idioma ${locale}.
Responde con tono amable y conciso.
`;
```

Funciona para casos simples. Las variables están en el código.

**Opción B — archivo separado + render:**

```typescript
// prompts/customer-support.system.md
Eres el asistente virtual de TiendaPro.
Hablas con {{userName}} en idioma {{locale}}.
Responde con tono amable y conciso.
```

```typescript
import { render } from "./lib/prompt-template.js";
const system = render("customer-support.system", { userName: "Ana", locale: "es-AR" });
```

**Cuándo cada una:** template literal es válido para prompts cortos y estables. Archivo separado se justifica cuando:

- Hay >5 prompts en la app.
- Producto/contenido toca prompts.
- Querés diff fácil (`git diff prompts/`).
- Vas a hacer A/B testing.

**Para TiendaPro a partir de M2** vamos a archivo separado. La inversión paga en M3-M5 cuando los prompts crecen.

#### Sintaxis de templates

Tres opciones razonables:

| Sintaxis | Pros | Cons |
|----------|------|------|
| `{{var}}` (Mustache/Handlebars-like) | Simple, soportado por muchas libs | Sin lógica condicional sin Handlebars completo |
| `${var}` (template literal) | Nativo de TS | Solo en código TS, no en `.md` |
| Jinja-like (`{% if %}`) | Lógica completa | Más superficie de error, otra dependencia |

Para el curso usamos `{{var}}` con un render minimalista (regex). Suficiente para 99% de casos. Si necesitas condicionales, considerá Handlebars.

### 4.3. Roles y personalización

Tu app probablemente atiende a más de un tipo de usuario o caso. Tres dimensiones de personalización típicas:

#### Por rol del usuario

- **Cliente final (B2C):** tono amable, menos jerga técnica.
- **Operador interno:** tono directo, jerga del negocio aceptada, atajos.
- **Vendor / partner:** tono profesional con SLA mencionados.

Implementación: distinto template según `userRole`.

```
prompts/
├── customer-support.system.md       ← B2C
├── operator-internal.system.md      ← interno
└── vendor-partner.system.md         ← partners
```

#### Por idioma / locale

```
prompts/customer-support.system.{locale}.md
  customer-support.system.es-AR.md
  customer-support.system.es-ES.md
  customer-support.system.en-US.md
```

#### Por segmento o feature flag

```
prompts/customer-support.system.premium.md   ← clientes premium
prompts/customer-support.system.standard.md  ← clientes regulares
```

#### Cómo NO hacerlo

```typescript
// ❌ Prompt monolítico con un montón de condicionales en el texto
"Eres asistente. Si el usuario es premium di 'estimado'. Si es cliente B2C usa..."
```

Esto crece exponencialmente y se vuelve imposible de mantener.

### 4.4. Testing de prompts — tres niveles

#### Nivel 1 — Snapshot test del prompt renderizado

**Qué:** verifica que el resultado de `render(template, variables)` sea exactamente lo esperado.

**Por qué importa:** si alguien edita el `.md` y cambia el sentido sin querer, el snapshot test falla. **No prueba calidad** — prueba estabilidad del template.

```typescript
// __tests__/prompts.snapshot.test.ts
import { render } from "../src/lib/prompt-template.js";

test("customer-support system prompt renders for Ana es-AR", () => {
  const out = render("customer-support.system", {
    userName: "Ana",
    locale: "es-AR",
  });
  expect(out).toMatchSnapshot();
});
```

**Costo:** muy bajo. **Valor:** alto cuando el equipo crece y varias personas tocan los archivos.

#### Nivel 2 — Regression test sobre un eval set

**Qué:** ejecuta el flow completo (template → LLM → respuesta) sobre un set de casos y verifica criterios.

**Estructura del eval set:**

```typescript
const EVAL_SET = [
  {
    id: "intent-clear-question",
    input: "¿Cuánto cuesta el envío?",
    expected: { intent: "pregunta", minConfidence: 0.7 },
  },
  {
    id: "intent-clear-complaint",
    input: "Mi pedido no llegó y estoy harto",
    expected: { intent: "reclamo", minConfidence: 0.8 },
  },
  // ...
];
```

**Criterios de aceptación:**

- **Determinísticos:** schema match, valor exacto en un campo, longitud, regex.
- **Cualitativos (LLM-as-judge):** "¿la respuesta es amable?", "¿menciona productos del catálogo?". Un LLM evalúa según una rubrica que defines.

**Cuándo correrlo:**

- En cada PR que toque un prompt o un wrapper.
- En CI antes de mergear a main.
- En cron diario para detectar drift por cambios de modelo del proveedor.

**Cuántos casos:** **20-50 casos cubren el 80% de los problemas**. No necesitas 1000 al principio. Empiezas chico y agregas cuando descubras un fallo en producción.

> **Patrón fundamental:** **cuando un usuario reporta un problema, agregas ese caso al eval set ANTES de fixearlo**. Así el fix queda cubierto y la regresión nunca vuelve.

#### Nivel 3 — Runtime spot checks

**Qué:** muestrear N% del tráfico real, evaluarlo (con LLM-as-judge o flag manual) y vigilarlo en dashboard.

**Por qué necesitas esto además del eval set:** el eval set es estático. La realidad cambia: nuevos productos, nuevas formas de preguntar, nuevos abusos. Spot checks son tu radar para casos no anticipados.

Implementación con la instrumentación de S03: tu logger ya guarda `flow`, `text`, `costUsd`. Agregas un job aparte que toma 1% de las respuestas, las pasa por un LLM-judge y emite métrica.

> Profundizamos en M4 con RAGAS y M6 con observabilidad de producción.

### 4.5. Promptfoo — cuándo introducirlo

[Promptfoo](https://promptfoo.dev) es un framework dedicado a testing de prompts. Hace lo que describimos arriba con menos código:

- Eval sets en YAML.
- LLM-as-judge built-in.
- Comparación A/B entre dos versiones de prompt.
- Reportes HTML.

```yaml
# promptfooconfig.yaml
prompts:
  - "Clasifica: {{message}}"
providers:
  - google:gemini-2.5-flash
  - anthropic:claude-haiku-4-5
tests:
  - vars:
      message: "¿Cuánto cuesta el envío?"
    assert:
      - type: contains
        value: "pregunta"
```

**Cuándo introducirlo en TiendaPro:** **M4 — RAG**. En M2 tener tests caseros con Vitest + LLM-as-judge es suficiente para internalizar conceptos. Promptfoo agrega valor cuando:

- Tenés >5 prompts.
- Querés comparar modelos sistemáticamente.
- Querés que producto/QA pueda agregar casos sin tocar código.

## 5. Patrones y antipatrones

### Patrones

- **Prompts en archivos `.md` versionados, no en strings hardcoded.** Permite diff, review, testing.
- **Snapshot tests del template** para detectar cambios accidentales.
- **Eval set chico (20-50 casos) que crece con incidentes.** Cada bug reportado se vuelve un test ANTES del fix.
- **LLM-as-judge para criterios cualitativos.** Para tono, completitud, dominio. No para sintaxis (eso es schema).
- **Versioná tu eval set en git, junto con los prompts.** Son parte del producto.
- **Naming convention clara para prompts segmentados:** `<flow>.<role>.<role-modifier>.md`.

### Antipatrones

- **Prompts inline en archivos TS** que toca todo el equipo. Crece sin control.
- **Cambiar prompt en producción sin correr eval set.** Ruleta semántica.
- **Eval set gigante (500+ casos) desde el día 1.** Nadie lo mantiene; los tests viejos pierden señal.
- **Snapshot test sin revisar.** Si cada cambio "actualiza el snapshot" sin pensar, el test pierde valor.
- **No tener un set para casos adversariales** (prompt injection, jailbreak intentos, ambigüedad). Tu eval set tiene que cubrir lo malo, no solo lo feliz.

## 6. Conexión con TiendaPro

Esta sesión cierra el Módulo 2. Tareas:

1. **Mover prompts a `code/proyecto-integrador/prompts/`** como archivos `.md`:
   - `customer-support.system.md` — system del chat principal.
   - `intent-classifier.system.md` — system del clasificador.
   - `summarizer.system.md` — system del resumen de turnos viejos.
2. **Implementar `src/lib/prompt-template.ts`** con `render(name, vars)`.
3. **Migrar el código** para que `chat`, `classifyIntent` y `summarizeOldMessages` carguen el prompt desde archivo.
4. **Crear `prompts/eval-set.json`** con ~12 casos de TiendaPro.
5. **Crear `__tests__/prompts.regression.test.ts`** con tests sobre el eval set.
6. **Cerrar M2** con commit y tag `proyecto-m2`. El asistente queda con: chat service + retry/fallback + structured outputs + guardrails + memoria + contexto del catálogo + prompts versionados + tests.

## 7. Resumen

Tres ideas para llevarte:

1. **Los prompts son código.** Archivos versionados, review en PR, tests automatizados. La mayor diferencia entre "demo que funciona" y "producto que escala" pasa por acá.
2. **Tres niveles de testing complementan, no reemplazan:** snapshot del template, regression sobre eval set, spot checks runtime. Cada uno detecta una clase de fallo distinta.
3. **El eval set es un activo vivo.** Empieza chico (20 casos), crece con incidentes. Cada bug en producción se convierte en un caso de prueba ANTES del fix. Eso te garantiza que la regresión no vuelve.

## 8. Preguntas de auto-evaluación

1. ¿Por qué un string hardcoded como prompt en producción es un antipatrón? Da 3 razones operacionales distintas (no estilísticas).
2. Snapshot test, regression test y runtime spot check detectan **clases distintas de fallo**. Da un ejemplo concreto de fallo que solo cada uno atrapa.
3. Tu prompt de intent classifier funcionó bien por 3 meses. Hoy cambió Gemini 2.5 Flash a 2.6 Flash y la calidad bajó. ¿Cómo te enteras antes de que afecte usuarios?
4. ¿Cuál es el patrón canónico cuando un usuario reporta un bug de calidad ("el asistente respondió mal a X")? Pista: tiene que ver con el eval set.
5. Tu eval set tiene solo casos felices. Lista 3 categorías de casos adversariales que deberías agregar.
6. Cuándo introducirías Promptfoo y qué problema concreto te resuelve sobre tests con Vitest + LLM-as-judge caseros.

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 3 ejercicios + reto + cierre del proyecto integrador con tag `proyecto-m2`.

**Próximo módulo:** **Módulo 3 — Embeddings y búsqueda vectorial.** Cambiamos el `findProducts(query)` de S05.1 (filtro por keyword) por búsqueda semántica con embeddings + pgvector. Ahí TiendaPro deja de ser "asistente con catálogo chico" y empieza a ser "asistente que entiende lo que el cliente quiere".
