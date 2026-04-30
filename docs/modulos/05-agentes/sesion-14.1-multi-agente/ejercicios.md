# Sesión 14.1 — Ejercicios

> **Tiempo estimado:** ~45 min total. Dos demos: supervisor con 2 workers + sequential chain. Scripts en [`code/m05-agentes/sesion-14.1/`](../../../../code/m05-agentes/sesion-14.1/).

---

## Setup base

```bash
pnpm install
```

---

## 1. Ejercicio guiado: supervisor + 2 workers especializados

```bash
pnpm --filter @curso-ai/m05-sesion-14.1 supervisor
```

Tres queries que disparan tres branches:

- "¿Tienen mochilas?" → `catalogWorker` (con su tool `searchCatalog`)
- "¿Cuándo llega mi pedido P-1234?" → `ordersWorker` (con su tool `getOrderStatus`)
- "Bla bla bla" → `escalationWorker` (devuelve handoff)

Cada worker es un agente ReAct independiente con sus propias tools. El supervisor solo clasifica.

### Para revisar

- Las tools de cada worker están aisladas: `catalogWorker` NO puede llamar a `getOrderStatus`.
- El supervisor NO reformula respuestas: pasa el output del worker tal cual.
- Cada worker puede usar un modelo distinto (ver el comentario en el script).

---

## 2. Ejercicio guiado: sequential chain (research → draft → review)

```bash
pnpm --filter @curso-ai/m05-sesion-14.1 sequential
```

Tres agentes en cadena fija:

1. **Researcher** — toma una pregunta y devuelve 3 puntos clave (mock).
2. **Writer** — toma los puntos y redacta un párrafo.
3. **Reviewer** — toma el párrafo y devuelve una versión pulida.

Cada agente tiene su system prompt especializado. El estado compartido lleva los outputs intermedios.

### Para reflexionar

- Sequential ≠ "un agente con tres tools". El orden está garantizado por el grafo.
- Útil cuando cada paso requiere un mindset distinto (research vs write vs review). Un solo agente con esos tres mindsets en un solo prompt rinde peor.
- Tradeoff: más latencia (3 LLM calls) vs mejor calidad de cada etapa.

---

## Bonus

1. **Paralelismo en supervisor.** Modifica el demo 1 para que cuando una query es ambigua, llame a dos workers en paralelo y un nodo final agregue las respuestas.
2. **Hierarchical.** Agrega un meta-supervisor que decida entre dos áreas (soporte vs ventas), cada una con su propio supervisor y workers.
3. **Network.** Implementa un sistema donde catalog worker y orders worker pueden llamarse mutuamente (con MAX_HOPS=3). Caso de uso: "¿Cuándo llega mi pedido del producto X?" requiere ambos.

---

**Próxima sesión:** [`S14.2 — HITL, seguridad y sandboxing`](../sesion-14.2-hitl-seguridad/) → cierra el módulo + swap del integrador a multi-agente.
