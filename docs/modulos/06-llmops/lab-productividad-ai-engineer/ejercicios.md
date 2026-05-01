# Lab — Ejercicios

> **Tiempo estimado:** ~50 min total. Dos demos: MCP server mínimo + skill custom para Claude Code. Scripts en [`code/m06-llmops/lab-productividad/`](../../../../code/m06-llmops/lab-productividad/).

---

## Setup base

```bash
pnpm install
```

Para el demo de MCP, necesitas el SDK oficial:

```bash
# Ya viene como dep del paquete; pnpm install lo trae.
```

---

## 1. Ejercicio guiado: MCP server mínimo

```bash
pnpm --filter @curso-ai/m06-lab demo-mcp
```

El script implementa un MCP server stdio con dos tools:

- `searchCatalog(query)` — usa el catálogo mock de TiendaPro.
- `getOrderStatus(orderId)` — usa pedidos mock.

Imprime un manifiesto JSON-RPC mostrando las tools y un ejemplo de invocación. En producción, este server lo conectarías a Claude Code via `~/.claude/mcp_config.json` o equivalente, y cualquier sesión podría usar las tools.

### Para revisar

- El protocolo MCP es JSON-RPC sobre stdio (también soporta HTTP). El demo muestra el handshake.
- En producción, el server corre como proceso aparte; el client lo invoca cuando el LLM llama una tool.
- Authentication / authorization NO están en el demo — en MCP real las definís según el deployment.

---

## 2. Ejercicio guiado: skill custom

Mira [`docs/modulos/06-llmops/lab-productividad-ai-engineer/skills/curso-ai-conventions/SKILL.md`](skills/curso-ai-conventions/SKILL.md). Es un skill que un agente puede cargar para entender las convenciones del curso (español neutro, type-check antes del commit, voseo gate, etc).

Para activarlo en Claude Code:

1. Copia el directorio `skills/curso-ai-conventions/` a `~/.claude/skills/curso-ai-conventions/`.
2. En tu próxima sesión, el agente lo va a sugerir cuando detecte que estás trabajando en este repo.

### Para revisar

- El skill es un markdown con frontmatter. El agente lo lee cuando el `description` matchea el contexto.
- En lugar de repetir las convenciones cada sesión, vivien encapsuladas y versionadas.
- Patrón aplicable a CUALQUIER repo: convenciones de testing, naming, branch flow, etc.

---

## Bonus

1. **MCP server con BD real.** Modifica el demo para que `searchCatalog` consulte el pgvector real del integrador en lugar del mock.
2. **Skill para SDD.** Escribe un skill que active el flow `explore → propose → spec → design → tasks → apply → verify` cuando detecte que el cambio es no-trivial.
3. **Hook de pre-commit.** Configura un hook en `~/.claude/settings.json` que corra `pnpm -r run type-check` antes de cualquier commit. Si falla, el commit no avanza.

---

**Cierre del curso:** después de este lab cerramos el integrador con tag `proyecto-m6` y agregamos el resumen final del curso al README principal del repo.
