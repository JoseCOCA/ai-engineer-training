# Setup Check — Smoke test del entorno

Pequeño script que verifica que tu setup del curso está completo. No es contenido pedagógico — solo es una herramienta de diagnóstico.

## Qué hace

1. Comprueba que `ANTHROPIC_API_KEY` está en el entorno y tiene formato válido.
2. Hace una llamada mínima a Anthropic (Claude Haiku, el modelo más barato).
3. Imprime la respuesta, las métricas de tokens y el costo aproximado.

## Cómo correrlo

Desde la raíz del repo, con tu `.env` ya configurado:

```bash
cd code/00-setup-check
pnpm install
pnpm smoke-test
```

Si ves `== Setup verificado correctamente ==`, todo funciona.

## Costo

Aproximadamente **USD 0.00003** por ejecución (Haiku 4.5, ~25 tokens en total).

## Si falla

Revisa la sección 7 de [`docs/01-setup.md`](../../docs/01-setup.md) — _Solución de problemas comunes_.
