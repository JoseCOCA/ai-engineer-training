# 02 — Python para devs JS/TS

> **Esta guía es un onboarding rápido, no un curso de Python.** El objetivo es que puedas leer y escribir el código Python que aparece en sesiones puntuales del curso, sin que la sintaxis te frene. Tiempo estimado de lectura: 60 minutos. Si después quieres profundizar, sigue [Real Python](https://realpython.com/) o el [tutorial oficial](https://docs.python.org/3/tutorial/).

---

## 1. ¿Por qué Python aquí si el curso es TypeScript-first?

El curso usa TypeScript para el 80% del trabajo, pero hay tres áreas donde Python sigue siendo el estándar de facto:

1. **Embeddings con modelos de HuggingFace** (Módulo 3) — la librería `sentence-transformers` no tiene equivalente real en JS.
2. **Evaluación con RAGAS** (Módulos 4 y 6) — framework Python para medir calidad de RAG.
3. **Scripts puntuales de procesamiento de datos** (Módulo 3) — chunking avanzado, normalización, ETL.

Para todo lo demás (wrappers, agentes, RAG, APIs, UI) usamos TypeScript con Vercel AI SDK.

**Lo que vas a hacer en Python:** leer scripts, ajustar parámetros, ejecutar y ver resultados. **Lo que NO vas a hacer:** desarrollar features grandes ni montar arquitectura compleja en Python.

---

## 2. Filosofía y mental model — diferencias clave

| Tema | JS/TS | Python |
|------|-------|--------|
| Filosofía | "Hay muchas formas de hacerlo" | "Debe haber una forma obvia" ([Zen de Python](https://peps.python.org/pep-0020/)) |
| Indentación | Estética, no obligatoria | **Sintáctica — importa** |
| Tipos | TS chequea en compilación, JS no en runtime | Type hints opcionales, NO chequean en runtime (`mypy`/`pyright` lo hacen estáticamente) |
| Convención de nombres | `camelCase` para variables/funciones, `PascalCase` para clases | `snake_case` para variables/funciones, `PascalCase` para clases |
| Punto y coma | Opcional (recomendado) | No se usa |
| Llaves `{}` para bloques | Sí | No, los bloques son por indentación |
| Equivalente de `npm` | `npm`, `pnpm`, `yarn` | `pip`, `poetry`, **`uv`** (recomendado) |
| Versión moderna | TypeScript 5+ | Python 3.11+ |

**Tip mental:** si vienes de TypeScript con tipado estricto, Pydantic + type hints + mypy te dan una experiencia comparable.

---

## 3. Setup con uv (repaso)

`uv` es el gestor moderno de proyectos Python — equivalente a `pnpm` para JS. Reemplaza `pip`, `venv`, `poetry` y `pyenv`.

```bash
# Crear un proyecto nuevo
mkdir mi-script && cd mi-script
uv init                          # crea pyproject.toml + estructura

# Instalar dependencias (lo crea en .venv automáticamente)
uv add anthropic pydantic httpx

# Ejecutar un script (uv activa el venv automáticamente)
uv run python script.py

# Añadir una dep de desarrollo
uv add --dev mypy ruff pytest
```

Equivalencias:

| Acción | JS/TS | Python con uv |
|--------|-------|---------------|
| Crear proyecto | `pnpm init` | `uv init` |
| Instalar dependencia | `pnpm add lodash` | `uv add lodash` |
| Instalar dev dep | `pnpm add -D vitest` | `uv add --dev pytest` |
| Ejecutar script | `pnpm tsx script.ts` | `uv run python script.py` |
| Lockfile | `pnpm-lock.yaml` | `uv.lock` |
| Carpeta de deps | `node_modules/` | `.venv/` |
| Manifest | `package.json` | `pyproject.toml` |

---

## 4. Sintaxis básica con paralelos JS/TS

### Variables y primitivos

```typescript
// JS/TS
const name = "Ana";
let count = 0;
const isReady: boolean = true;
const price: number = 19.99;
```

```python
# Python
name = "Ana"             # str (inferido)
count = 0                # int
is_ready: bool = True    # snake_case y True/False con mayúscula
price: float = 19.99
```

**Notas:**
- Python no tiene `const`/`let`. Por convención, las constantes van `EN_MAYUSCULAS`.
- Booleanos: `True` y `False` (mayúscula inicial).
- Nulo: `None` (no `null`/`undefined`).

### Listas, tuplas, diccionarios y sets

```typescript
// JS/TS
const lista = [1, 2, 3];
lista.push(4);
const longitud = lista.length;
const obj = { name: "Ana", age: 30 };
const valor = obj.name;
const claves = Object.keys(obj);
const conjunto = new Set([1, 2, 3]);
```

```python
# Python
lista = [1, 2, 3]
lista.append(4)
longitud = len(lista)

# dict — equivalente a un object/Record
obj = {"name": "Ana", "age": 30}
valor = obj["name"]            # bracket notation, NO obj.name
claves = list(obj.keys())

# tupla — lista inmutable, NO existe en JS
tupla = (1, 2, 3)              # tupla[0] = 99 -> TypeError
coords: tuple[float, float] = (1.5, 3.2)

# set — igual que en JS
conjunto = {1, 2, 3}           # literal de set
```

**Importante:** los `dict` no se acceden con `.` como en JS. Siempre `dict["key"]` o `dict.get("key")` (devuelve `None` si no existe).

### Strings y f-strings

```typescript
// JS/TS
const greeting = `Hola ${name}, tienes ${age} años`;
const upper = name.toUpperCase();
const pieces = "a,b,c".split(",");
```

```python
# Python — f-strings (formato moderno)
greeting = f"Hola {name}, tienes {age} años"
upper = name.upper()                      # método sin paréntesis para llamar
pieces = "a,b,c".split(",")               # devuelve lista
```

### Funciones

```typescript
// JS/TS
function suma(a: number, b: number = 0): number {
  return a + b;
}
const sumaArrow = (a: number, b = 0): number => a + b;
```

```python
# Python — la versión "normal"
def suma(a: int, b: int = 0) -> int:
    return a + b

# Equivalente arrow function (limitada — una sola expresión)
suma_lambda = lambda a, b=0: a + b
```

**Type hints son opcionales pero RECOMENDADAS** — actúan como documentación y se chequean estáticamente con `mypy` o `pyright`. **No se validan en runtime.**

### List comprehensions (muy "Pythonic")

```typescript
// JS/TS
const dobles = nums.map(n => n * 2);
const pares = nums.filter(n => n % 2 === 0);
const paresDobles = nums
  .filter(n => n % 2 === 0)
  .map(n => n * 2);
```

```python
# Python — list comprehensions
dobles = [n * 2 for n in nums]
pares = [n for n in nums if n % 2 == 0]
pares_dobles = [n * 2 for n in nums if n % 2 == 0]

# Dict comprehension
cuadrados = {n: n * n for n in range(5)}    # {0:0, 1:1, 2:4, 3:9, 4:16}
```

**Verás esto MUCHO en código Python.** Es el idioma natural — más limpio que `map`/`filter` encadenados.

### Clases

```typescript
// JS/TS
class Persona {
  constructor(public name: string, public age: number) {}
  saludar(): string {
    return `Hola, soy ${this.name}`;
  }
}
const p = new Persona("Ana", 30);
```

```python
# Python — la forma "moderna" usa dataclasses
from dataclasses import dataclass

@dataclass
class Persona:
    name: str
    age: int

    def saludar(self) -> str:
        return f"Hola, soy {self.name}"

p = Persona("Ana", 30)    # SIN "new" — solo se llama la clase
```

**Cosas raras viniendo de TS:**
- No hay `new`. Llamar `Clase(args)` ya construye.
- En métodos, el primer parámetro es `self` explícito (no `this` automático).
- `@dataclass` genera `__init__`, `__repr__`, `__eq__` automáticamente — equivalente a una `record` o un objeto plano TS.

---

## 5. Type hints

Los type hints son **declarativos, no se ejecutan**. Sirven para:
- Documentar tu código.
- Que tu IDE te dé autocompletado real.
- Que `mypy` o `pyright` detecten errores antes de correr.

```python
from typing import Optional

# Optional[X] equivale a X | None — como en TS sería: X | null
def buscar_user(id: int) -> Optional[dict]:
    if id < 0:
        return None
    return {"id": id, "name": "..."}

# Python 3.10+ acepta también la sintaxis pipe (más como TS)
def buscar_user_v2(id: int) -> dict | None:
    pass

# Listas, dicts y tuples genéricos (Python 3.9+)
nombres: list[str] = []
puntuaciones: dict[str, int] = {}
coords: tuple[float, float] = (0.0, 0.0)
```

**No vas a obtener errores de runtime por tipos mal usados.** Si necesitas validación real (recibiendo data de un LLM, por ejemplo), usa Pydantic.

---

## 6. Pydantic — el "Zod" de Python

**Pydantic es una de las librerías más importantes de Python para AI Engineering.** La vas a usar para extraer JSON estructurado de respuestas de LLMs, validar configs, y modelar entidades.

```typescript
// JS/TS con Zod
import { z } from "zod";

const UserSchema = z.object({
  name: z.string(),
  age: z.number().int().positive(),
  email: z.string().email().optional(),
});

const user = UserSchema.parse(data);    // throw si no valida
```

```python
# Python con Pydantic
from pydantic import BaseModel, EmailStr, PositiveInt

class User(BaseModel):
    name: str
    age: PositiveInt
    email: EmailStr | None = None

user = User(**data)    # ValidationError si no valida
# o User.model_validate(data)  para obj genérico
```

**Diferencias importantes:**
- Pydantic valida en runtime (no solo en type-check).
- Conversiones automáticas: si llega `"30"` como `age`, Pydantic lo convierte a `int 30`.
- Genera schemas JSON automáticamente — **clave para function calling con LLMs**.

---

## 7. Async/await

Python tiene async/await, pero el modelo es ligeramente distinto a JS.

```typescript
// JS/TS
async function fetchData(): Promise<string> {
  const res = await fetch("https://api.com/data");
  return await res.text();
}

await fetchData();    // top-level await funciona en módulos ESM modernos
```

```python
# Python
import asyncio
import httpx

async def fetch_data() -> str:
    async with httpx.AsyncClient() as client:
        res = await client.get("https://api.com/data")
        return res.text

# Python NO tiene top-level await en scripts normales.
# Necesitas un event loop:
asyncio.run(fetch_data())
```

**Diferencias clave:**
- No hay `fetch` nativo — usa `httpx` (sync + async, recomendado) o `aiohttp` (solo async).
- `with` (context manager) es como `using` en C#: cleanup automático al salir del bloque.
- En scripts simples, arrancas con `asyncio.run(main())`.
- En notebooks Jupyter, sí hay top-level await — funciona como en JS.

---

## 8. Manejo de errores

```typescript
// JS/TS
try {
  await algo();
} catch (err) {
  console.error(err);
} finally {
  cleanup();
}
```

```python
# Python
try:
    await algo()
except Exception as err:
    print(err)
except ValueError as err:        # más específico antes que más general
    print(f"Valor inválido: {err}")
finally:
    cleanup()
```

**Diferencias:**
- `except` en lugar de `catch`.
- Puedes tener múltiples `except` por tipo de excepción.
- Los tipos de excepciones son clases reales — puedes definir las tuyas heredando de `Exception`.

---

## 9. Patrones que vas a ver mucho

### Context managers (`with`)

Cualquier cosa que tenga `setup` y `cleanup` (archivos, conexiones, locks):

```python
# Lectura de archivo — el archivo se cierra solo al salir del with
with open("data.json") as f:
    contenido = f.read()

# HTTP client — la conexión se cierra al salir
async with httpx.AsyncClient() as client:
    res = await client.get(url)
```

### Decorators

Como decorators en TS/Java/Python — wrappean una función:

```python
from functools import cache

@cache    # memoización automática por argumentos
def expensive_operation(x: int) -> int:
    return x ** 2

@dataclass    # convierte la clase en dataclass (genera __init__ etc.)
class Config:
    api_key: str
```

### Walrus operator `:=`

Asignación dentro de una expresión (Python 3.8+):

```python
# Sin walrus
data = fetch()
if data:
    process(data)

# Con walrus — más conciso
if (data := fetch()):
    process(data)
```

### Unpacking

```python
# Lista
a, b, c = [1, 2, 3]
first, *rest = [1, 2, 3, 4]    # first=1, rest=[2,3,4]

# Dict
def f(name: str, age: int): pass
data = {"name": "Ana", "age": 30}
f(**data)    # equivalente a f(name="Ana", age=30)

# Tupla
def coords() -> tuple[int, int]:
    return (3, 5)
x, y = coords()
```

---

## 10. Gotchas para devs JS

### 1. Indentación es sintaxis

```python
def f(x):
    if x > 0:
        return x        # 4 espacios
       return -x        # IndentationError — mal alineado
```

Configura tu editor: **4 espacios, no tabs**. (PEP 8)

### 2. `==` vs `is`

- `==` compara valores (como `===` en JS).
- `is` compara **identidad** (mismo objeto en memoria).

```python
a = [1, 2]
b = [1, 2]
a == b    # True
a is b    # False — son objetos distintos

x = None
x is None    # ✅ siempre usa `is None`, NO `== None`
```

### 3. Argumentos default mutables — TRAMPA

```python
# MAL — el [] se crea UNA SOLA VEZ y se reutiliza entre llamadas
def add_to(item, items=[]):
    items.append(item)
    return items

add_to(1)    # [1]
add_to(2)    # [1, 2]  — sorpresa!

# BIEN
def add_to(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items
```

### 4. `self` explícito

```python
class A:
    def metodo(self, x):    # self es OBLIGATORIO como primer parámetro
        return self.atributo + x    # self.atributo, no this.atributo
```

### 5. Nombre canónico, no método de instancia

```python
len(lista)            # SI — len() es función global
lista.length          # NO — no existe

str(numero)           # SI — str() es constructor/conversor
numero.toString()     # NO — no existe
```

### 6. Falsy se evalúa más cosas

```python
# Estos son falsy en Python:
not 0
not ""
not []        # lista vacía
not {}        # dict vacío
not None
not False

if not lista:
    print("lista vacía o no existe")
```

---

## 11. Cheatsheet rápido

| Acción | JS/TS | Python |
|--------|-------|--------|
| Imprimir | `console.log(x)` | `print(x)` |
| Longitud | `arr.length` | `len(arr)` |
| Convertir a string | `String(x)` o `` `${x}` `` | `str(x)` o `f"{x}"` |
| JSON parse | `JSON.parse(s)` | `json.loads(s)` |
| JSON stringify | `JSON.stringify(o)` | `json.dumps(o)` |
| Iterar array | `for (const x of arr)` | `for x in arr:` |
| Iterar con índice | `arr.forEach((x, i) => ...)` | `for i, x in enumerate(arr):` |
| Verificar key en objeto | `"k" in obj` | `"k" in dict` |
| Falsy negation | `!x` | `not x` |
| Spread en objeto | `{...a, ...b}` | `{**a, **b}` |
| Spread en lista | `[...a, ...b]` | `[*a, *b]` o `a + b` |
| Async sleep | `await new Promise(r => setTimeout(r, 1000))` | `await asyncio.sleep(1)` |
| Map | `arr.map(f)` | `[f(x) for x in arr]` |
| Filter | `arr.filter(p)` | `[x for x in arr if p(x)]` |
| Reduce | `arr.reduce((a,b) => a+b, 0)` | `sum(arr)` o `functools.reduce(...)` |
| Sort | `arr.sort((a,b) => a-b)` | `sorted(arr)` o `arr.sort()` |
| Chequeo de tipo | `typeof x === "string"` | `isinstance(x, str)` |

---

## 12. Mini-ejemplo completo

Para amarrar todo, este es un script Python que llama a Anthropic, usa Pydantic para validar la respuesta y maneja errores:

```python
"""Ejemplo de un script Python típico que vas a ver en este curso."""

import asyncio
import os
from anthropic import AsyncAnthropic
from pydantic import BaseModel, ValidationError


class Sentimiento(BaseModel):
    """Modelo de la respuesta esperada del LLM."""
    polaridad: str    # "positivo" | "negativo" | "neutro"
    confianza: float  # entre 0 y 1


async def analizar(texto: str) -> Sentimiento | None:
    client = AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Analiza el sentimiento del siguiente texto y responde "
                    f'SOLO con JSON {{"polaridad": "...", "confianza": 0.X}}: '
                    f"{texto}"
                ),
            }
        ],
    )

    raw = response.content[0].text
    try:
        return Sentimiento.model_validate_json(raw)
    except ValidationError as err:
        print(f"Respuesta inválida del LLM: {err}")
        return None


if __name__ == "__main__":
    resultado = asyncio.run(analizar("Esta laptop es maravillosa, muy contento."))
    print(resultado)
```

Si entiendes este código, **estás listo para todas las sesiones Python del curso**.

---

## 13. Próximo paso

→ [`modulos/01-fundamentos/`](modulos/01-fundamentos/) — Módulo 1: Fundamentos de productos con IA

Empezamos con la sesión 00.1 — Panorama IA y rol del AI Engineer.
