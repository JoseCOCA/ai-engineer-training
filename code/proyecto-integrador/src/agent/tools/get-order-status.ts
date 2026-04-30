/**
 * Tool getOrderStatus (M5).
 *
 * Mock de consulta a una BD de pedidos. En producción real esto
 * golpearía un microservicio o BD; mantenemos mock para que el demo
 * sea reproducible sin servicios externos.
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";

interface MockOrder {
  id: string;
  email: string;
  status: "pending" | "in_transit" | "delivered" | "cancelled";
  eta: string | null;
  items: Array<{ productId: string; qty: number }>;
}

const MOCK_ORDERS: MockOrder[] = [
  {
    id: "P-1234",
    email: "carlos@example.com",
    status: "in_transit",
    eta: "2026-05-03",
    items: [{ productId: "TP-MOCH-01", qty: 1 }],
  },
  {
    id: "P-2222",
    email: "ana@example.com",
    status: "delivered",
    eta: null,
    items: [{ productId: "TP-CALZ-01", qty: 1 }],
  },
];

export const getOrderStatusTool = tool(
  async ({ orderId, email }: { orderId?: string; email?: string }) => {
    let order: MockOrder | undefined;
    if (orderId) {
      order = MOCK_ORDERS.find((o) => o.id === orderId);
    } else if (email) {
      order = MOCK_ORDERS.find((o) => o.email === email);
    }

    if (!order) {
      return JSON.stringify({ found: false, message: "No encontré ese pedido." });
    }
    return JSON.stringify({ found: true, order });
  },
  {
    name: "getOrderStatus",
    description:
      "Obtiene el estado de un pedido. Recibe orderId (formato P-XXXX) o email del cliente. Úsala cuando el usuario pregunte por un pedido, su estado, su fecha de entrega o sus items.",
    schema: z.object({
      orderId: z.string().optional().describe("ID del pedido, ej: 'P-1234'."),
      email: z.string().optional().describe("Email del cliente, si no tiene el id del pedido."),
    }),
  },
);
