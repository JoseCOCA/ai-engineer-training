# Código S05.3 — Prompts versionados, snapshot y regression tests

Acompaña a [`docs/modulos/02-patrones-llm/sesion-05.3-prompts-testing/`](../../../docs/modulos/02-patrones-llm/sesion-05.3-prompts-testing/).

## Setup

```bash
pnpm install
```

`.env` configurado en la raíz. Los regression tests hacen llamadas reales al LLM (~10 llamadas por corrida).

## Estructura

```
prompts/
├── customer-support.system.md        ← system del chat principal
├── intent-classifier.system.md       ← system v1 del clasificador
├── intent-classifier.system.v2.md    ← system v2 (mejorado)
└── eval-set.json                     ← 8 casos de prueba

src/
├── render-demo.ts                    ← demo del template engine
├── ab-compare.ts                     ← compara v1 vs v2 sobre eval set
└── lib/
    ├── prompt-template.ts            ← render(name, vars) con regex {{var}}
    ├── intent.ts                     ← classifyIntent que carga el prompt desde archivo
    └── llm.ts                        ← resolver de modelo según .env

__tests__/
├── prompts.snapshot.test.ts          ← snapshot del template renderizado
└── prompts.regression.test.ts        ← regression sobre eval-set.json
```

## Scripts

| Script | Comando | Qué muestra |
|--------|---------|-------------|
| Render demo | `pnpm run render-demo` | Render de templates + error si falta variable |
| A/B compare | `pnpm run ab-compare` | V1 vs V2 sobre eval set (~16 llamadas) |
| Snapshot | `pnpm run test:snapshot` | Snapshot del template renderizado |
| Regression | `pnpm run test:regression` | Regression con LLM real sobre eval set (~8 llamadas) |
| Todos | `pnpm test` | Snapshot + regression |
