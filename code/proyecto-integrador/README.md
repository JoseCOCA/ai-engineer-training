# TiendaPro — Proyecto integrador

Asistente conversacional para un e-commerce ficticio. Crece módulo a módulo a lo largo del curso.

## Estado actual

**Hito M1.1 — primer "Hola, mundo".** El asistente hace UNA llamada al LLM configurado y muestra: provider activo, respuesta, tokens, latencia.

Cada cierre de módulo agrega una capa nueva (RAG en M3, agentes en M5, despliegue en M6).

## Setup

Desde la raíz del repo, asegurate de tener `.env` configurado siguiendo `env.example`. El proyecto **reusa el `.env` de la raíz** — no necesita uno propio.

```bash
cd code/proyecto-integrador
pnpm install
pnpm dev
```

## Cambiar de proveedor LLM

Editá `DEFAULT_LLM_PROVIDER` en `.env` (raíz del repo). Valores válidos: `ollama` | `google` | `anthropic` | `openai`.

**No necesitás tocar el código del proyecto** — la abstracción en `src/lib/llm.ts` se encarga.

## Estructura

```
src/
├── index.ts          ← punto de entrada
└── lib/
    └── llm.ts        ← abstracción multi-provider (la única pieza que importa SDKs)
```

## Salida esperada

```
[provider: ollama]

TiendaPro asistente: ¡Hola! Soy el asistente virtual de TiendaPro, ¿en qué puedo ayudarte hoy?

Tokens — input: 67, output: 21
Tiempo: 1.84s
Razón de fin: stop
```

(Los números varían según proveedor y modelo.)

## Documentación pedagógica

Esta sesión se desarrolla en [`docs/modulos/01-fundamentos/sesion-01.1-setup-primera-llamada/`](../../docs/modulos/01-fundamentos/sesion-01.1-setup-primera-llamada/).
