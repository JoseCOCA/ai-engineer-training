/**
 * TiendaPro — proyecto integrador.
 *
 * Conversación con asistente con personalidad + RAG sobre catálogo real.
 *
 * Estado al cierre del Módulo 4:
 *   - chat service desde @curso-ai/llm (retry/fallback/instrumentación).
 *   - logging vía onComplete callback → logs/calls.jsonl.
 *   - clasificación de intent estructurada con Zod.
 *   - guardrails de input/output.
 *   - **RAG pipeline (M4):** retrieve pgvector + listwise rerank + structured
 *     output con citas validadas. Reemplaza el findProducts keyword del M2.
 *   - memoria conversacional con sliding window por tokens.
 *   - prompts versionados desde archivos.
 *
 * Si el retrieval devuelve vacío (query OOD o threshold filtra todo),
 * el flow cae al chat genérico sin contexto inyectado.
 */
import { chat, ConversationStore, newId } from "@curso-ai/llm";
import { classifyIntent } from "./lib/intent.js";
import {
  GuardrailViolation,
  validateInput,
  validateOutput,
} from "./lib/guardrails.js";
import { logChatResponse } from "./lib/logger.js";
import { render } from "./lib/prompts.js";
import { PgVectorStore } from "./retrieval/index.js";
import { embedQuery, runRagPipeline, EMBEDDING_MODEL, EMBEDDING_VERSION } from "./rag/index.js";

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

  const ragStore = new PgVectorStore({
    embedder: embedQuery,
    embeddingModel: EMBEDDING_MODEL,
    embeddingVersion: EMBEDDING_VERSION,
  });

  console.log(`=== TiendaPro — conversación con ${USER_NAME} ===`);
  console.log("");

  try {
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

      let responseText: string;
      let metricsLine: string;
      let ragHandled = false;

      if (intent.intent === "pregunta") {
        const rag = await runRagPipeline(ragStore, userTurn);
        if (rag.chunks.length > 0 && rag.validation.ok) {
          ragHandled = true;
          responseText = rag.answer;
          console.log(`  [retrieved: ${rag.chunks.map((c) => c.id).join(", ")}]`);
          metricsLine = `[rag: ${rag.metrics.totalMs}ms (retrieve ${rag.metrics.retrieveMs} + rerank ${rag.metrics.rerankMs} + gen ${rag.metrics.generateMs}), ${rag.citations.length} citas]`;
        } else if (rag.chunks.length > 0 && !rag.validation.ok) {
          console.log(
            `  [rag: citas inválidas (${rag.validation.invalidCitations.join(",")}) — fallback a chat sin contexto]`,
          );
          responseText = "";
          metricsLine = "";
        } else {
          console.log("  [retrieval vacío — fallback a chat sin contexto]");
          responseText = "";
          metricsLine = "";
        }
      } else {
        responseText = "";
        metricsLine = "";
      }

      if (!ragHandled) {
        const window = conv.getContextWindow(CONTEXT_BUDGET_TOKENS);
        const response = await chat({
          system: supportSystem,
          messages: window.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
          flow: `chat-${intent.intent}`,
          maxOutputTokens: 300,
          onComplete: logChatResponse,
        });
        responseText = response.text;
        metricsLine = `[${response.latencyMs}ms, ${response.outputTokens} out, $${response.costUsd.toFixed(6)}]`;
      }

      try {
        validateOutput(responseText);
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
        content: responseText,
        createdAt: new Date().toISOString(),
        flow: `chat-${intent.intent}`,
      });

      console.log(`  ${responseText}`);
      console.log(`  ${metricsLine}`);
      console.log("");
    }

    console.log(`=== Fin de la conversación. Mensajes totales: ${conv.size()} ===`);
  } finally {
    await ragStore.close();
  }
}

runConversation().catch((error: unknown) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
