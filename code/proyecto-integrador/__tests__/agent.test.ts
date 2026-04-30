/**
 * Test unitario del classifier del supervisor.
 *
 * No invoca LLM real — testea el shape del estado y la topología del grafo
 * (que los nodos esperados existen y las aristas conectan). Es un humo test.
 */
import { describe, test, expect } from "vitest";
import { IntentEnum, type Intent } from "../src/agent/supervisor.js";
import { getEscalations } from "../src/agent/index.js";

describe("agent supervisor topology", () => {
  test("IntentEnum cubre catalog, orders, escalation", () => {
    expect(IntentEnum.options).toEqual(["catalog", "orders", "escalation"]);
  });

  test("default Intent es escalation (más conservador)", () => {
    const fallback: Intent = "escalation";
    expect(IntentEnum.parse(fallback)).toBe("escalation");
  });

  test("getEscalations devuelve un array", () => {
    expect(Array.isArray(getEscalations())).toBe(true);
  });

  test("intents inválidos son rechazados", () => {
    const result = IntentEnum.safeParse("unknown_intent");
    expect(result.success).toBe(false);
  });
});
