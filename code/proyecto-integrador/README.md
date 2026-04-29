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

## Proveedor por defecto del Módulo 1

Tras la comparativa de [S01.2](../../docs/modulos/01-fundamentos/sesion-01.2-respuesta-comparativa/), la recomendación canónica del curso para el MVP de TiendaPro es **Google Gemini 2.5 Flash** porque:

- **Free tier amplio** (~1.500 req/día) — no obstaculiza el desarrollo ni los ejercicios.
- **Cloud-only**, no requiere hardware local potente (ideal para alumnos con cualquier setup).
- **Latencia razonable** para MVP (~13s en respuestas de ~300 tokens, según comparativa de S01.2).
- **Costo proyectado** a 10K mensajes/día ≈ **$104/mes** (vs ~$385/mes con Claude Haiku 4.5).

Esta es **una recomendación, no una imposición**. Si preferís trabajar offline o con otro proveedor, cambiá `DEFAULT_LLM_PROVIDER` en `.env` a `ollama`, `anthropic` u `openai` según necesidad. La abstracción multi-provider absorbe el cambio.

A revisar en **Módulo 4** cuando podamos comparar proveedores con métricas de calidad rigurosas (RAGAS, Promptfoo).
