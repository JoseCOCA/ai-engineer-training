# Sesión 01.2 — Comparativa multi-provider

Script de exploración para correr el MISMO prompt contra todos los proveedores LLM configurados en tu `.env` y ver lado a lado:

- La respuesta de cada uno (compara estilo, calidad, formato).
- Tokens de input/output (cada proveedor tokeniza distinto).
- Costo estimado en USD (snapshot abril 2026).
- Latencia y throughput (tokens/segundo).

## Uso

```bash
cd code/m01-fundamentos/sesion-01.2
pnpm install
pnpm compare
```

Reusa el `.env` de la raíz del repo. Si no tienes ningún proveedor configurado, el script te avisa y termina con error.

## Modificar el experimento

El prompt y el system prompt están como constantes al inicio de `compare.ts`. Edítalos para experimentar con prompts más cortos/largos, distinto idioma, distinto tono, etc., y observa cómo cambian las métricas.

## Documentación pedagógica

Esta sesión se desarrolla en [`docs/modulos/01-fundamentos/sesion-01.2-respuesta-comparativa/`](../../../docs/modulos/01-fundamentos/sesion-01.2-respuesta-comparativa/).
