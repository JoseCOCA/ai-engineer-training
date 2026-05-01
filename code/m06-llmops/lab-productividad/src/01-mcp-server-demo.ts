/**
 * Demo — MCP server stdio mínimo.
 *
 * Expone dos tools (searchCatalog, getOrderStatus) que cualquier
 * MCP client (Claude Code, Cursor, Continue) puede consumir.
 *
 * Para conectar desde Claude Code:
 *   "mcpServers": {
 *     "tiendapro-demo": {
 *       "command": "tsx",
 *       "args": ["src/01-mcp-server-demo.ts"]
 *     }
 *   }
 *
 * Este script imprime el manifiesto + un ejemplo de invocación
 * directa para que veas la mecánica sin necesidad de un client.
 */
import { z } from "zod";

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

const MOCK_CATALOG = [
  { id: "TP-MOCH-01", name: "Mochila Trekker 30L", category: "mochilas" },
  { id: "TP-MOCH-02", name: "Mochila Summit 65L", category: "mochilas" },
  { id: "TP-CALZ-01", name: "Botas Trail Pro Mid", category: "calzado" },
];

const MOCK_ORDERS = [
  { id: "P-1234", status: "in_transit", eta: "2026-05-03" },
  { id: "P-2222", status: "delivered", eta: null },
];

const tools: ToolDefinition[] = [
  {
    name: "searchCatalog",
    description: "Busca productos en el catálogo de TiendaPro por keyword.",
    inputSchema: z.object({ query: z.string().describe("Keyword a buscar") }),
    execute: async (input) => {
      const { query } = z.object({ query: z.string() }).parse(input);
      const q = query.toLowerCase();
      return MOCK_CATALOG.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
      );
    },
  },
  {
    name: "getOrderStatus",
    description: "Obtiene el estado de un pedido por id.",
    inputSchema: z.object({ orderId: z.string().describe("ID del pedido, ej: P-1234") }),
    execute: async (input) => {
      const { orderId } = z.object({ orderId: z.string() }).parse(input);
      const order = MOCK_ORDERS.find((o) => o.id === orderId);
      return order ?? { error: "not_found", orderId };
    },
  },
];

function manifest(): Record<string, unknown> {
  return {
    protocolVersion: "2024-11-05",
    serverInfo: { name: "tiendapro-demo", version: "1.0.0" },
    capabilities: { tools: {} },
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: { type: "object", properties: extractSchemaProperties(t.inputSchema) },
    })),
  };
}

function extractSchemaProperties(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema.shape)) {
    const typed = value as z.ZodTypeAny;
    props[key] = {
      type: "string",
      description: typed.description ?? "",
    };
  }
  return props;
}

async function invokeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool no encontrada: ${name}`);
  return tool.execute(args);
}

async function main(): Promise<void> {
  console.log("=== MCP server demo (stdio) ===\n");

  console.log("Manifiesto que el server expone:");
  console.log(JSON.stringify(manifest(), null, 2));

  console.log("\n=== Invocación directa (sin client) ===");

  console.log(`\n1. searchCatalog({ query: "mochila" }):`);
  const r1 = await invokeTool("searchCatalog", { query: "mochila" });
  console.log(JSON.stringify(r1, null, 2));

  console.log(`\n2. getOrderStatus({ orderId: "P-1234" }):`);
  const r2 = await invokeTool("getOrderStatus", { orderId: "P-1234" });
  console.log(JSON.stringify(r2, null, 2));

  console.log("\n=== Cómo conectar a Claude Code ===");
  console.log("Edita ~/.claude/mcp_config.json (o el equivalente):");
  console.log(JSON.stringify(
    {
      mcpServers: {
        "tiendapro-demo": {
          command: "tsx",
          args: ["src/01-mcp-server-demo.ts"],
          cwd: process.cwd(),
        },
      },
    },
    null,
    2,
  ));
  console.log("\nTras reiniciar Claude Code, las tools estarán disponibles para cualquier sesión.");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
