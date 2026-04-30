/**
 * Test del validador de citas del pipeline RAG (M4 — S11.2).
 *
 * Unit test puro: no requiere Postgres ni API keys. Cubre el chequeo
 * de Nivel 1 (cada source_id citado debe estar en el contexto).
 */
import { describe, test, expect } from "vitest";
import { validateCitations } from "../src/rag/citations.js";

describe("validateCitations", () => {
  test("ok cuando todas las citas están en el contexto", () => {
    const result = validateCitations(
      [
        { source_id: "TP-MOCH-01", claim: "ergonómica con espalda ventilada" },
        { source_id: "TP-MOCH-02", claim: "para travesías de varios días" },
      ],
      ["TP-MOCH-01", "TP-MOCH-02", "TP-MOCH-03"],
    );

    expect(result.ok).toBe(true);
    expect(result.invalidCitations).toHaveLength(0);
  });

  test("falla cuando una cita inventa un id inexistente", () => {
    const result = validateCitations(
      [
        { source_id: "TP-MOCH-01", claim: "real" },
        { source_id: "TP-MOCH-99", claim: "inventada" },
      ],
      ["TP-MOCH-01", "TP-MOCH-02"],
    );

    expect(result.ok).toBe(false);
    expect(result.invalidCitations).toEqual(["TP-MOCH-99"]);
  });

  test("ok cuando no hay citas (caso de retrieval vacío)", () => {
    const result = validateCitations([], []);
    expect(result.ok).toBe(true);
    expect(result.invalidCitations).toHaveLength(0);
  });

  test("falla cuando hay citas pero el contexto está vacío", () => {
    const result = validateCitations(
      [{ source_id: "TP-MOCH-01", claim: "..." }],
      [],
    );
    expect(result.ok).toBe(false);
    expect(result.invalidCitations).toEqual(["TP-MOCH-01"]);
  });

  test("reporta múltiples inválidas en orden recibido", () => {
    const result = validateCitations(
      [
        { source_id: "TP-X", claim: "..." },
        { source_id: "TP-MOCH-01", claim: "..." },
        { source_id: "TP-Y", claim: "..." },
      ],
      ["TP-MOCH-01"],
    );

    expect(result.ok).toBe(false);
    expect(result.invalidCitations).toEqual(["TP-X", "TP-Y"]);
  });
});
