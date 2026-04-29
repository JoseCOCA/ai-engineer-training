# Sesión 00.3 — Ejercicios (lab Python)

> **Tiempo estimado:** ~50 min total. Esta sesión es 100% práctica — vas a ejecutar todo. Ten abierto en otra pestaña [`docs/02-python-para-js-devs.md`](../../../02-python-para-js-devs.md) como referencia.

---

## 1. Setup (~10 min)

### 1.1. Verificar Python

```bash
python3 --version
```

Si te muestra `Python 3.10.x` o superior, estás bien. Si es 3.9 o anterior, instala una versión moderna (`uv` que vamos a instalar abajo te lo soluciona también).

### 1.2. Instalar `uv`

`uv` es el gestor de proyectos Python que usaremos en todo el curso. Es a Python lo que `pnpm` es a Node.js: rápido, todo-en-uno, lockfile real.

```bash
# Linux / macOS
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Verifica:

```bash
uv --version
```

### 1.3. Crear tu primer proyecto Python

```bash
mkdir -p ~/playground/python-lab && cd ~/playground/python-lab
uv init
ls
```

Vas a ver:

```
README.md     hello.py     pyproject.toml     .python-version
```

`pyproject.toml` es el equivalente de tu `package.json`. `hello.py` es el script de ejemplo.

### 1.4. Ejecutar el script

```bash
uv run hello.py
```

> **Si te aparece "Hello from python-lab!"** estás listo.

**Pregunta de cierre:** ¿qué hizo `uv run` por debajo? *(Pista: si miras `ls -la`, vas a ver una carpeta `.venv` que no estaba antes.)*

---

## 2. Hello world side-by-side (~10 min)

Vas a escribir el mismo programa **dos veces**: una en TS, una en Python. La idea es que sientas las diferencias en los dedos, no en la teoría.

**Especificación:** un script que reciba un nombre por línea de comandos y diga `"Hola, <nombre>! Tienes <n> letras en tu nombre."`. Si no se pasa nombre, default a `"AI Engineer"`.

### Versión TypeScript (referencia)

Crea `~/playground/python-lab/hello.ts`:

```typescript
const args = process.argv.slice(2);
const name = args[0] ?? "AI Engineer";

console.log(`Hola, ${name}! Tienes ${name.length} letras en tu nombre.`);
```

Si tienes `tsx` instalado: `npx tsx hello.ts AnaMaria`.

### Versión Python — escribila vos

Edita `~/playground/python-lab/hello.py` para que haga lo mismo. Pistas:

- Argumentos de línea de comandos: `import sys; sys.argv` (lista de strings).
- f-strings: `f"Hola, {name}!"`
- Default value: `name = sys.argv[1] if len(sys.argv) > 1 else "AI Engineer"`

Ejecuta: `uv run hello.py AnaMaria`.

> **Solución:**
>
> ```python
> import sys
>
> name = sys.argv[1] if len(sys.argv) > 1 else "AI Engineer"
>
> print(f"Hola, {name}! Tienes {len(name)} letras en tu nombre.")
> ```

**Observa:**

- No hay `;` al final de líneas.
- Indentación es sintaxis (no decoración).
- `len(name)` en lugar de `name.length` — `len` es una función built-in, no un método.
- f-strings son `f"..."` con `{var}` interpolado, equivalente a template literals.

---

## 3. Translation challenges (~15 min)

Tres funciones TypeScript para traducir a Python idiomático. **No mires la solución hasta intentarlo**.

### 3.1. Función simple con types

```typescript
function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

console.log(celsiusToFahrenheit(25)); // 77
```

> **Solución:**
>
> ```python
> def celsius_to_fahrenheit(celsius: float) -> float:
>     return (celsius * 9) / 5 + 32
>
> print(celsius_to_fahrenheit(25))  # 77.0
> ```
>
> Ojo: en Python la convención es `snake_case` para funciones, no `camelCase`. Y los type hints NO son obligatorios en runtime — son documentación para humanos y para `mypy`. Python no rompe si pasas un string.

### 3.2. Validación con tipo (Zod → Pydantic)

```typescript
import { z } from "zod";

const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(0).max(150),
});

const user = UserSchema.parse({ name: "Ana", email: "ana@x.com", age: 30 });
console.log(user);
```

Traducilo a Python con `pydantic`. Pistas:

- Instala pydantic en tu proyecto: `uv add pydantic email-validator`.
- Importa `from pydantic import BaseModel, EmailStr, Field`.
- `Field(ge=0, le=150)` es el equivalente de `.min(0).max(150)` en Zod.

> **Solución:**
>
> ```python
> from pydantic import BaseModel, EmailStr, Field
>
> class User(BaseModel):
>     name: str
>     email: EmailStr
>     age: int = Field(ge=0, le=150)
>
> user = User(name="Ana", email="ana@x.com", age=30)
> print(user)
> # name='Ana' email='ana@x.com' age=30
> ```

### 3.3. Procesamiento de array (map + filter + reduce)

```typescript
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const sumOfSquaresOfEvens = numbers
  .filter((n) => n % 2 === 0)
  .map((n) => n * n)
  .reduce((acc, n) => acc + n, 0);

console.log(sumOfSquaresOfEvens); // 220
```

Traducilo a Python idiomático. Vas a usar **list comprehensions** y `sum()`.

> **Solución idiomática:**
>
> ```python
> numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
>
> sum_of_squares_of_evens = sum(n * n for n in numbers if n % 2 == 0)
>
> print(sum_of_squares_of_evens)  # 220
> ```
>
> Una sola línea, perfectamente legible. Esto es **muy Pythonic** y es el patrón a usar en lugar de encadenar `.filter().map().reduce()`.

---

## 4. Tu primer embedding real (~15 min) — premio del lab

Esta es la parte más interesante. Vas a generar tu primer **embedding** — el concepto que vimos en S00.2 — y vas a usar **similaridad coseno** para medir cuánto se parecen dos textos en significado.

Es el "hola mundo" de la búsqueda semántica que vamos a construir en M3.

### 4.1. Instalar `sentence-transformers`

```bash
uv add sentence-transformers numpy
```

> Nota: la primera ejecución va a descargar un modelo (~80 MB). Es normal.

### 4.2. Crear el script

Crea `~/playground/python-lab/embeddings.py`:

```python
from sentence_transformers import SentenceTransformer
from sentence_transformers.util import cos_sim

# Modelo pequeño y rápido, 384 dimensiones por embedding.
# all-MiniLM-L6-v2 es el "hola mundo" estándar de embeddings.
model = SentenceTransformer("all-MiniLM-L6-v2")

frases = [
    "El gato está durmiendo en el sillón.",
    "Un felino descansa sobre el sofá.",
    "Estoy pensando en cambiar el sistema operativo de mi servidor.",
    "Necesito comprar comida para mi mascota.",
]

# Computar embeddings de las 4 frases.
embeddings = model.encode(frases)

print(f"Cada embedding tiene shape: {embeddings.shape}")
# (4, 384) → 4 frases, 384 dimensiones cada una.

# Comparar la frase 0 con las demás.
print("\nSimilaridad de la frase 0 con cada otra frase:")
for i, frase in enumerate(frases):
    sim = cos_sim(embeddings[0], embeddings[i]).item()
    print(f"  [{sim:.3f}]  {frase}")
```

### 4.3. Ejecutar

```bash
uv run embeddings.py
```

### 4.4. Lo que vas a ver

Algo como:

```
Cada embedding tiene shape: (4, 384)

Similaridad de la frase 0 con cada otra frase:
  [1.000]  El gato está durmiendo en el sillón.
  [0.812]  Un felino descansa sobre el sofá.
  [0.087]  Estoy pensando en cambiar el sistema operativo de mi servidor.
  [0.428]  Necesito comprar comida para mi mascota.
```

**Detente aquí un momento y piensa lo que está pasando:**

- La frase 0 vs ella misma: similaridad **1.000** (perfecto).
- La frase 0 vs su paráfrasis ("felino descansa sobre el sofá"): **~0.81** — cerca aunque las palabras sean distintas. **Esto es búsqueda semántica.**
- La frase 0 vs algo no relacionado (servidor): **~0.09** — lejos.
- La frase 0 vs algo tangencialmente relacionado ("comida para mi mascota"): **~0.43** — algo en el medio, capta que ambas hablan de mascotas.

**El modelo nunca vio estas frases**. Lo que aprendió durante el entrenamiento le permite mapear cualquier texto a un punto en un espacio de 384 dimensiones donde la cercanía corresponde a similaridad de significado.

> **Esto es la base de RAG.** Cuando en M3-M4 indexemos el catálogo de TiendaPro, vamos a hacer EXACTAMENTE esto pero con miles de productos, y vamos a guardar los embeddings en pgvector para poder buscarlos rápido.

### 4.5. Reto bonus

Modifica el script para que pida al usuario una query por consola y le devuelva la frase más similar de la lista. Es ~5 líneas más. **Esto ya es un mini buscador semántico.**

> **Solución:**
>
> ```python
> from sentence_transformers import SentenceTransformer
> from sentence_transformers.util import cos_sim
>
> model = SentenceTransformer("all-MiniLM-L6-v2")
>
> frases = [
>     "El gato está durmiendo en el sillón.",
>     "Un felino descansa sobre el sofá.",
>     "Estoy pensando en cambiar el sistema operativo de mi servidor.",
>     "Necesito comprar comida para mi mascota.",
> ]
>
> embeddings = model.encode(frases)
>
> query = input("Query: ")
> query_emb = model.encode(query)
>
> sims = cos_sim(query_emb, embeddings)[0]
> best_idx = int(sims.argmax())
>
> print(f"\nFrase más similar (sim={sims[best_idx].item():.3f}):")
> print(f"  {frases[best_idx]}")
> ```
>
> Pruébalo con queries como `"animales descansando"` o `"infraestructura"`.

---

## 5. Aporte al proyecto integrador

**TiendaPro sigue sin código.** El primer commit del proyecto integrador llega en **S01.1**, ya en TypeScript.

Lo que hiciste en el ejercicio 4 es la prueba de concepto del módulo de búsqueda semántica que vas a construir para el catálogo de TiendaPro en M3. **Guarda ese script** — vamos a referenciarlo cuando llegue el momento.

---

## Cierre

Si terminaste los 4 ejercicios:

- Tienes `uv` instalado y sabes crear proyectos Python desde cero.
- Sabes mapear los conceptos básicos de TS a Python (types, async, validación, list comprehensions).
- Computaste tu primer embedding real y entiendes por qué la similaridad semántica es la base de RAG.

**Estás listo para arrancar S01.1 — Setup + primera llamada a un LLM.** A partir de ahí volvemos a TypeScript y empieza el código real de TiendaPro.

---

**Vuelve a:** [`README de la sesión`](README.md) | **Próximo paso:** [`recursos.md`](recursos.md) → bibliografía Python opcional.
