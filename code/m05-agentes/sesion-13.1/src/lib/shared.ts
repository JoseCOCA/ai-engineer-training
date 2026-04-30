/**
 * Tools y system prompt compartidos por las dos implementaciones.
 *
 * Esto es lo que es PORTABLE entre bare metal y framework. Si mañana
 * migráramos a LangGraph, este archivo va tal cual; solo cambiaría el
 * orquestador.
 */
import { tool } from "ai";
import { z } from "zod";

interface MockProduct {
  id: string;
  name: string;
  category: string;
}

const CATALOG: MockProduct[] = [
  { id: "TP-MOCH-01", name: "Mochila Trekker 30L", category: "mochilas" },
  { id: "TP-MOCH-02", name: "Mochila Summit 65L", category: "mochilas" },
  { id: "TP-MOCH-03", name: "Mochila City Daypack 18L", category: "mochilas" },
  { id: "TP-TIENDA-01", name: "Tienda 2P Ultra-Light", category: "tiendas" },
  { id: "TP-CALZ-01", name: "Botas Trail Pro Mid", category: "calzado" },
];

export const sharedTools = {
  searchCatalog: tool({
    description: "Busca productos en el catálogo de TiendaPro por keyword.",
    inputSchema: z.object({
      query: z.string().describe("Keyword corto, ej: 'mochila'."),
    }),
    execute: async ({ query }: { query: string }) => {
      const q = query.toLowerCase();
      return CATALOG.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
      );
    },
  }),
};

export const SYSTEM_PROMPT = [
  "Eres un asistente del e-commerce TiendaPro.",
  "Usa la tool searchCatalog para responder consultas sobre productos.",
  "Responde de forma concisa, máximo 2 oraciones.",
].join("\n");

export const QUERY = "¿Qué mochilas tienen?";
