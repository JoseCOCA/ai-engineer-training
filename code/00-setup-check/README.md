# Setup Check — Smoke test multi-provider

Pequeño script que verifica que tu setup del curso está completo. No es contenido pedagógico — es una herramienta de diagnóstico, pero ya muestra en la práctica el patrón de **abstracción de proveedores LLM** que se estudia formalmente en el Módulo 2.

## Qué hace

1. Detecta qué proveedores LLM tienes configurados en `.env`:
   - Ollama (local)
   - Google Gemini
   - Anthropic Claude
   - OpenAI
2. Para cada proveedor disponible, hace una llamada mínima usando **una sola interfaz** (`generateText` del Vercel AI SDK).
3. Reporta para cada uno: respuesta, tokens, costo aproximado y tiempo de respuesta.

## Cómo correrlo

Desde la raíz del repo, con tu `.env` ya configurado (al menos un proveedor):

```bash
cd code/00-setup-check
pnpm install
pnpm smoke-test
```

Si ves `== Setup verificado correctamente ==`, todo funciona.

## Costo

- **Ollama:** gratis, local.
- **Google Gemini:** gratis (tier gratuito).
- **Anthropic / OpenAI:** centavos por ejecución completa (50 tokens máximo por llamada).

## Si falla

Revisa la sección 7 de [`docs/01-setup.md`](../../docs/01-setup.md) — _Solución de problemas comunes_.

## Nota técnica

El smoke test usa `generateText` del **Vercel AI SDK** como capa de abstracción. La misma función llama a cualquier proveedor — solo cambia el `model` que le pasas. Esta es la base del patrón de abstracción que vas a profundizar en el Módulo 2.
