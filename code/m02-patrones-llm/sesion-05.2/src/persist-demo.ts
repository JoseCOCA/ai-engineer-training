/**
 * Reto S05.2: persistencia simple a JSONL.
 *
 * Primera corrida: agrega 3 mensajes y guarda.
 * Segunda corrida: carga el archivo y muestra los mensajes existentes.
 * Tercera corrida: agrega 1 más, carga + agrega.
 */
import { ConversationStore, newId } from "./lib/conversation.js";
import { fileURLToPath } from "node:url";

const PATH = fileURLToPath(
  new URL("../data/conversations/demo.jsonl", import.meta.url),
);

function main(): void {
  let store = ConversationStore.loadFrom(PATH);
  console.log(`Mensajes cargados: ${store.size()}`);

  if (store.size() === 0) {
    console.log("Primera corrida: agregando 3 mensajes y guardando...");
    const seed: { role: "user" | "assistant"; content: string }[] = [
      { role: "user", content: "Hola, soy Carlos." },
      { role: "assistant", content: "¡Hola Carlos! ¿En qué te ayudo?" },
      { role: "user", content: "Quiero info sobre mochilas." },
    ];
    for (const t of seed) {
      store.addMessage({
        id: newId(),
        role: t.role,
        content: t.content,
        createdAt: new Date().toISOString(),
      });
    }
    store.saveTo(PATH);
    console.log(`Guardado en: ${PATH}`);
  } else {
    console.log("Reanudando conversación existente:");
    for (const m of store.getHistory()) {
      console.log(`  [${m.role}] ${m.content}`);
    }
    console.log("");
    console.log("Borra data/conversations/demo.jsonl si quieres empezar de cero.");
  }
}

main();
