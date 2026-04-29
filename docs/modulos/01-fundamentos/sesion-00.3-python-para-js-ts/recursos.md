# Sesión 00.3 — Recursos complementarios

Material opcional para seguir profundizando en Python, especialmente orientado al uso que le vas a dar en el resto del curso (embeddings, evaluación, scripts ML).

---

## Documento canónico del curso

- [`docs/02-python-para-js-devs.md`](../../../02-python-para-js-devs.md) — el onboarding completo. Es la fuente de verdad y la referencia que vas a abrir más veces durante el resto del curso.

## Tooling moderno

- **uv (Astral)** — el gestor de proyectos Python que usamos en todo el curso. La docu oficial es excelente y corta.
  - https://docs.astral.sh/uv/
- **ruff** — linter + formatter ultra-rápido escrito en Rust. Equivalente a Biome para TS. Súper recomendado tenerlo configurado en tu editor.
  - https://docs.astral.sh/ruff/
- **mypy** — type checker. Sin esto, los type hints son sólo decoración.
  - https://mypy.readthedocs.io/

## Para el AI Engineer

Estas son las librerías Python que vas a usar en el curso, en el orden en que aparecen:

- **sentence-transformers** — generar embeddings con modelos de HuggingFace. Lo usaste en el ejercicio 4 y vuelve en M3.
  - https://www.sbert.net/
- **transformers (HuggingFace)** — la librería madre. Útil cuando necesités modelos más allá de embeddings (cross-encoders, rerankers, etc.).
  - https://huggingface.co/docs/transformers
- **RAGAS** — framework de evaluación específico para RAG. Aparece en M4.
  - https://docs.ragas.io/
- **Pydantic** — validación de datos al estilo Zod. La usás cuando quieras tipos en runtime.
  - https://docs.pydantic.dev/
- **FastAPI** — si en algún momento exponés un endpoint Python (poco frecuente en el curso, pero útil saberlo). Es el "Express de Python", muy adoptado en el ecosistema AI.
  - https://fastapi.tiangolo.com/

## Aprendizaje general de Python (para devs JS/TS)

- **Real Python** — tutoriales de altísima calidad sobre temas concretos. Búsqueda directa por el concepto que necesités.
  - https://realpython.com/
- **Python by Comparison** — recurso pago pero muy útil si querés un mapeo sistemático JS↔Python (similar al doc 02 pero más extenso).
  - https://pythonbycomparison.com/

## Para mantener el reflejo (cheatsheets útiles)

- **PEP 8** — la guía oficial de estilo. Es leve, vale la pena leerla una vez para no escribir Python "con acento JS".
  - https://peps.python.org/pep-0008/
- **Python Cheatsheet (mattmakai)** — cheatsheet visual con todo lo básico.
  - https://www.pythoncheatsheet.org/

## Cuando algo no funciona

- **Stack Overflow Python tag** — sigue siendo la fuente número uno para errores específicos.
- **Python Discord** (`https://pythondiscord.com/`) — comunidad activa, pueden ayudar en tiempo real.
- **uv issues** — si el problema es con tooling, los maintainers de Astral son MUY responsivos.
  - https://github.com/astral-sh/uv/issues

---

**Vuelve a:** [`README de la sesión`](README.md) · [`docs/02-python-para-js-devs.md`](../../../02-python-para-js-devs.md) · [`Curriculum maestro`](../../../00-curriculum.md)
