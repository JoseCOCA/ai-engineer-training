# Sesión 00.3 — Python para devs JS/TS (lab práctico)

> **Módulo:** 1 — Fundamentos · **Duración estimada:** 1h (≈10 min lectura + ~50 min lab) · **Formato:** lab práctico

---

## Cómo es distinta esta sesión

A diferencia de S00.1 y S00.2, **esta sesión NO es lectura + ejercicios**. Es un **lab práctico** apoyado en un documento de referencia ya existente. El objetivo es que escribas, ejecutes y traduzcas código Python con paralelos a TS, **haciendo**, no leyendo.

> **Documento de referencia (única "teoría" de esta sesión):**
> [`docs/02-python-para-js-devs.md`](../../../02-python-para-js-devs.md) — onboarding completo de Python para devs JS/TS, con paralelos lado a lado, cheatsheet y mini-ejemplo. Léelo en diagonal antes de hacer los ejercicios; vas a volver a él como referencia mientras los haces.

## 1. Objetivos de aprendizaje

Al terminar esta sesión vas a poder:

- Crear un proyecto Python con `uv` (el equivalente de `pnpm` en Python).
- Escribir y ejecutar un script Python básico con types, sin que te resulte ajeno.
- Traducir funciones TS a Python idiomático y viceversa, manteniendo type safety.
- Usar Pydantic como equivalente de Zod para validar datos.
- Computar tu primer **embedding** real (preview de M3) — el primer tangible de IA del curso.

## 2. Prerequisitos

- Haber leído (al menos en diagonal) [`docs/02-python-para-js-devs.md`](../../../02-python-para-js-devs.md). El lab presupone que tienes contexto sobre la sintaxis y el tooling.
- Tener Python 3.10+ disponible (lo verifica el ejercicio 1).
- 1 GB de espacio libre en disco (uno de los ejercicios descarga un modelo ~80 MB).

## 3. Cómo abordar la sesión

Te propongo este orden, que es el de [`ejercicios.md`](ejercicios.md):

1. **Setup (10 min)** — instalar `uv` si no lo tienes, crear tu primer proyecto Python.
2. **Hello world side-by-side (10 min)** — escribir el mismo programa en TS y en Python para sentirlo en los dedos.
3. **Translation challenges (15 min)** — 3 funciones TS para traducir a Python.
4. **Embedding real (15 min)** — instalar `sentence-transformers`, generar tu primer embedding, calcular similaridad semántica entre frases. **Este es el mejor ejercicio de la sesión.**
5. **Aporte a TiendaPro:** sin código por ahora.

Si te quedas sin tiempo, **el orden importa**: ejercicios 1-3 son los que más rendimiento te dan. El 4 es premio si llegas.

## 4. Conexión con TiendaPro

Esta sesión no agrega código a TiendaPro, pero te prepara para los puntos del proyecto donde Python es la herramienta correcta:

- **Módulo 3:** generación de embeddings del catálogo de TiendaPro con `sentence-transformers` (HuggingFace). El ejercicio 4 es el "hola mundo" de eso.
- **Módulo 4:** evaluación de calidad RAG con `RAGAS`. El test set que vas a correr está escrito en Python.
- **Módulo 6:** scripts puntuales de análisis de logs o experimentos ad-hoc, donde Python tiene un ecosistema más maduro.

Todo el resto del curso (la app, el agente, la API, la UI) sigue en TypeScript.

## 5. Cheatsheet de bolsillo

Para los reflejos rápidos mientras haces los ejercicios. Si te encuentras googleando algo más allí de esto, conviene volver al [`doc 02`](../../../02-python-para-js-devs.md).

| TS | Python |
|----|--------|
| `const x = 5` | `x = 5` |
| `const x: number = 5` | `x: int = 5` |
| `function add(a: number, b: number): number { return a + b }` | `def add(a: int, b: int) -> int: return a + b` |
| `[1, 2, 3].map(n => n * 2)` | `[n * 2 for n in [1, 2, 3]]` |
| `if (x === null)` | `if x is None:` |
| `await fetch(url)` | `await client.get(url)` |
| `try { ... } catch (e) { ... }` | `try: ... except Exception as e: ...` |
| `import { z } from 'zod'` | `from pydantic import BaseModel` |
| `interface User { name: string }` | `class User(BaseModel): name: str` |

---

**Siguiente paso:** [`ejercicios.md`](ejercicios.md) → 4 ejercicios prácticos que vas a EJECUTAR (~50 min).

**Próxima sesión:** [`S01.1 — Setup del entorno + primera llamada a un LLM`](../../sesion-01.1-setup-primera-llamada/) → primer commit de TiendaPro y primera llamada API real. Cierre del Módulo 1.
