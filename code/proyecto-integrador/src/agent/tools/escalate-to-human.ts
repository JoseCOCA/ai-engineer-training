/**
 * Tool escalateToHuman (M5).
 *
 * Crea un "ticket" mock y devuelve el id al usuario. En producción
 * esto golpea un sistema de tickets (Zendesk, Intercom, Jira).
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";

interface EscalationRecord {
  ticketId: string;
  reason: string;
  context: string;
  createdAt: string;
}

const escalations: EscalationRecord[] = [];

export function getEscalations(): readonly EscalationRecord[] {
  return escalations;
}

export const escalateToHumanTool = tool(
  async ({ reason, context }: { reason: string; context: string }) => {
    const ticketId = `TKT-${Math.floor(Math.random() * 9000) + 1000}`;
    escalations.push({
      ticketId,
      reason,
      context,
      createdAt: new Date().toISOString(),
    });
    return JSON.stringify({
      ticketId,
      message: `Te derivé a un agente humano. Tu ticket es ${ticketId}; alguien del equipo te contactará pronto.`,
    });
  },
  {
    name: "escalateToHuman",
    description:
      "Deriva al usuario a un agente humano cuando: (a) está frustrado o agresivo, (b) la consulta excede tu alcance (no es sobre productos ni pedidos), (c) ya intentaste resolver y no pudiste.",
    schema: z.object({
      reason: z.string().describe("Motivo de la escalación, una oración."),
      context: z.string().describe("Contexto que el agente humano necesita para retomar."),
    }),
  },
);
