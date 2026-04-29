# Código S05.2 — Memoria conversacional

Acompaña a [`docs/modulos/02-patrones-llm/sesion-05.2-memoria-conversacional/`](../../../docs/modulos/02-patrones-llm/sesion-05.2-memoria-conversacional/).

## Setup

```bash
pnpm install
```

`.env` configurado en la raíz.

## Estructura

```
src/
├── stateless-vs-history.ts ← demo: API stateless vs con historial
├── sliding-window-demo.ts  ← sliding window por tokens
├── summarize.ts            ← summarizeOldMessages()
├── summarize-demo.ts       ← demo verificando que se preservan datos críticos
├── persist-demo.ts         ← persistencia JSONL (reto)
└── lib/
    ├── conversation.ts     ← ConversationStore con sliding + persist
    └── llm.ts              ← resolver de modelo según .env
```

## Scripts

| Script | Comando | Qué muestra |
|--------|---------|-------------|
| Stateless vs history | `pnpm run stateless-vs-history` | Diferencia entre llamadas aisladas y con historial acumulado |
| Sliding window | `pnpm run sliding-window` | Truncado responsable por tokens sobre 30 turnos |
| Summarize | `pnpm run summarize` | Resumen de 20 turnos preservando nombre + ID de pedido |
| Persist | `pnpm run persist` | Persistencia simple a JSONL (corre 2 veces) |
