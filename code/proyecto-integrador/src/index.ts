/**
 * TiendaPro — proyecto integrador.
 *
 * Conversación con asistente multi-agente sobre el catálogo y pedidos.
 *
 * Estado al cierre del Módulo 5:
 *   - chat service desde @curso-ai/llm (instrumentación, retry, fallback).
 *   - clasificación estructurada de intent (M2).
 *   - guardrails de input/output.
 *   - **RAG pipeline (M4):** retrieve pgvector + listwise rerank + citas
 *     validadas, ahora envuelto como TOOL del catalog worker.
 *   - **Supervisor multi-agente con LangGraph (M5):** classifier puro
 *     que rutea a catalog/orders/escalation workers especializados.
 *     Output validation + recursionLimit de sandboxing.
 *   - memoria conversacional (M2) — preservada para los turnos donde
 *     el agente no aplica.
 *
 * Si el supervisor decide intent=escalation, no se usa RAG ni pedidos:
 * el escalation worker crea un ticket y devuelve handoff al usuario.
 */
import { ConversationStore, newId } from "@curso-ai/llm";
import {
  GuardrailViolation,
  validateInput,
  validateOutput,
} from "./lib/guardrails.js";
import { render } from "./lib/prompts.js";
import { runAgent, shutdownAgent } from "./agent/index.js";

const USER_NAME = "Carlos";
const LOCALE = "es-ES";

const TURNS = [
  "Hola, soy Carlos. Estoy buscando equipo de senderismo.",
  "¿Tienen mochilas para senderismo de fin de semana?",
  "¿Cuál es el estado de mi pedido P-1234?",
  "Y unas botas que aguanten lluvia, ¿tienen?",
  "Esto no funciona NADA, no me sirve nada de lo que dices",
];

async function runConversation(): Promise<void> {
  const conv = new ConversationStore();
  // El system del support se mantiene cargado para auditoría / regression tests.
  render("customer-support.system", { userName: USER_NAME, locale: LOCALE });

  console.log(`=== TiendaPro — conversación con ${USER_NAME} (M5 multi-agente) ===\n`);

  try {
    for (const userTurn of TURNS) {
      console.log(`> ${userTurn}`);

      try {
        validateInput(userTurn);
      } catch (error) {
        if (error instanceof GuardrailViolation) {
          console.log(`  [bloqueado por input guardrail: ${error.kind}]\n`);
          continue;
        }
        throw error;
      }

      conv.addMessage({
        id: newId(),
        role: "user",
        content: userTurn,
        createdAt: new Date().toISOString(),
      });

      const result = await runAgent(userTurn);

      try {
        validateOutput(result.answer);
      } catch (error) {
        if (error instanceof GuardrailViolation) {
          console.log(`  [bloqueado por output guardrail: ${error.kind}]\n`);
          continue;
        }
        throw error;
      }

      conv.addMessage({
        id: newId(),
        role: "assistant",
        content: result.answer,
        createdAt: new Date().toISOString(),
        flow: `agent-${result.intent}`,
      });

      console.log(`  [intent: ${result.intent}, ${result.elapsedMs}ms]`);
      console.log(`  ${result.answer}\n`);
    }

    console.log(`=== Fin de la conversación. Mensajes totales: ${conv.size()} ===`);
  } finally {
    await shutdownAgent();
  }
}

runConversation().catch((error: unknown) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
