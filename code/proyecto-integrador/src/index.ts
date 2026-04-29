/**
 * TiendaPro — proyecto integrador.
 *
 * Conversación de 5 turnos con asistente con personalidad.
 * Estado al cierre del Módulo 2:
 *   - chat service desde @curso-ai/llm (retry/fallback/instrumentación).
 *   - logging vía onComplete callback → logs/calls.jsonl.
 *   - clasificación de intent estructurada con Zod.
 *   - guardrails de input/output.
 *   - inyección de contexto desde catálogo (query-then-inject).
 *   - memoria conversacional con sliding window por tokens.
 *   - prompts versionados desde archivos.
 *
 * En Módulo 3 reemplazamos el findProducts() (keyword) por búsqueda
 * semántica con embeddings + pgvector.
 */
import { chat, ConversationStore, newId } from "@curso-ai/llm";
import { classifyIntent } from "./lib/intent.js";
import {
  GuardrailViolation,
  validateInput,
  validateOutput,
} from "./lib/guardrails.js";
import { findProducts } from "./lib/catalog.js";
import { logChatResponse } from "./lib/logger.js";
import { render } from "./lib/prompts.js";

const USER_NAME = "Carlos";
const LOCALE = "es-ES";
const CONTEXT_BUDGET_TOKENS = 4000;

const TURNS = [
  "Hola, soy Carlos. Estoy buscando equipo de senderismo.",
  "¿Tienen mochilas para senderismo de fin de semana?",
  "¿Cuál de las que mencionaste es más liviana?",
  "Genial, ¿y unas botas que combinen?",
  "Perfecto. ¿Hacen envío a Madrid?",
];

async function runConversation(): Promise<void> {
  const conv = new ConversationStore();
  const supportSystem = render("customer-support.system", {
    userName: USER_NAME,
    locale: LOCALE,
  });

  console.log(`=== TiendaPro — conversación con ${USER_NAME} ===`);
  console.log("");

  for (const userTurn of TURNS) {
    console.log(`> ${userTurn}`);

    try {
      validateInput(userTurn);
    } catch (error) {
      if (error instanceof GuardrailViolation) {
        console.log(`  [bloqueado por input guardrail: ${error.kind}]`);
        console.log("");
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

    const intent = await classifyIntent(userTurn);
    console.log(`  [intent: ${intent.intent} (${intent.confidence.toFixed(2)})]`);

    let augmentedSystem = supportSystem;
    if (intent.intent === "pregunta") {
      const products = findProducts(userTurn, { limit: 3, onlyInStock: true });
      if (products.length > 0) {
        augmentedSystem += `\n\nProductos relevantes del catálogo:\n${JSON.stringify(products, null, 2)}`;
        console.log(`  [products injected: ${products.length}]`);
      }
    }

    const window = conv.getContextWindow(CONTEXT_BUDGET_TOKENS);
    const response = await chat({
      system: augmentedSystem,
      messages: window.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
      flow: `chat-${intent.intent}`,
      maxOutputTokens: 300,
      onComplete: logChatResponse,
    });

    try {
      validateOutput(response.text);
    } catch (error) {
      if (error instanceof GuardrailViolation) {
        console.log(`  [bloqueado por output guardrail: ${error.kind}]`);
        console.log("");
        continue;
      }
      throw error;
    }

    conv.addMessage({
      id: newId(),
      role: "assistant",
      content: response.text,
      createdAt: new Date().toISOString(),
      flow: `chat-${intent.intent}`,
    });

    console.log(`  ${response.text}`);
    console.log(
      `  [${response.latencyMs}ms, ${response.outputTokens} out, $${response.costUsd.toFixed(6)}]`,
    );
    console.log("");
  }

  console.log(`=== Fin de la conversación. Mensajes totales: ${conv.size()} ===`);
}

runConversation().catch((error: unknown) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
