# Código S05.1 — Inyección de contexto desde archivos, web y BD

Acompaña a [`docs/modulos/02-patrones-llm/sesion-05.1-inyeccion-contexto/`](../../../docs/modulos/02-patrones-llm/sesion-05.1-inyeccion-contexto/).

## Setup

```bash
pnpm install
```

`.env` configurado en la raíz. Ejercicio 4 (web-context) requiere conexión a internet.

## Estructura

```
data/
└── catalog.json          ← 12 productos mock de TiendaPro

src/
├── compare.ts            ← full-content vs query-then-inject
├── budget.ts             ← enforceContextBudget(parts, limits)
├── budget-demo.ts        ← runner del budget
├── caching-sim.ts        ← simulador de ahorro con prompt caching
├── web-context.ts        ← fetch a API externa con timeout/fallback
└── lib/
    ├── catalog.ts        ← findProducts(query) sobre catalog.json
    └── llm.ts            ← resolver de modelo según .env
```

## Scripts

| Script | Comando | Qué muestra |
|--------|---------|-------------|
| Compare | `pnpm run compare` | Full-content vs query-then-inject (tokens, latencia, costo) |
| Budget | `pnpm run budget` | Truncado responsable de history y rag chunks |
| Caching sim | `pnpm run caching-sim` | Cálculo del ahorro con prompt caching |
| Weather | `pnpm run weather "Madrid"` | Reto: contexto desde web con timeout |
