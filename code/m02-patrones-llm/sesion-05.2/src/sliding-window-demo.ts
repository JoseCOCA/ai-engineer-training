/**
 * Demo del sliding window por tokens.
 *
 * Genera 30 mensajes sintéticos, pide ventana de 1000 tokens,
 * reporta cuántos entraron y cuál es el primer mensaje conservado.
 */
import { encode } from "gpt-tokenizer";
import { ConversationStore, newId } from "./lib/conversation.js";

const TOTAL_TURNS = 30;
const WINDOW_TOKENS = 1000;

function generate(store: ConversationStore): void {
  for (let i = 1; i <= TOTAL_TURNS; i++) {
    store.addMessage({
      id: newId(),
      role: i % 2 === 1 ? "user" : "assistant",
      content: `Turno ${i}: ${"contenido sintético ".repeat(8)}fin`,
      createdAt: new Date().toISOString(),
    });
  }
}

function main(): void {
  const store = new ConversationStore();
  generate(store);

  const all = store.getHistory();
  const totalTokens = all.reduce((s, m) => s + encode(m.content).length, 0);

  const window = store.getContextWindow(WINDOW_TOKENS);
  const windowTokens = window.reduce((s, m) => s + encode(m.content).length, 0);

  console.log(`Total mensajes generados: ${all.length}`);
  console.log(`Tokens totales aprox: ${totalTokens}`);
  console.log(`Ventana solicitada: ${WINDOW_TOKENS} tokens`);
  console.log(`Mensajes conservados: ${window.length} (turnos ${all.length - window.length + 1}-${all.length})`);
  console.log(`Tokens en la ventana: ${windowTokens}`);
  console.log(`Primer mensaje conservado: "${window[0]?.content.slice(0, 50)}..."`);
  console.log(`Último mensaje conservado: "${window.at(-1)?.content.slice(0, 50)}..."`);
}

main();
