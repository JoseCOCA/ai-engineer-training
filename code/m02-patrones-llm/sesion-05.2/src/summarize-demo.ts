/**
 * Demo de summarization.
 *
 * Genera 25 turnos donde el cliente menciona Ana y TP-451200.
 * Aplica summarizeOldMessages sobre los primeros 20 turnos.
 * Verifica que el resumen conserve esos datos críticos.
 */
import { ConversationStore, newId } from "./lib/conversation.js";
import { summarizeOldMessages } from "./summarize.js";

const TURNS: { role: "user" | "assistant"; content: string }[] = [
  { role: "user", content: "Hola, soy Ana." },
  { role: "assistant", content: "¡Hola Ana! ¿En qué te puedo ayudar?" },
  { role: "user", content: "Mi pedido TP-451200 no llegó hace 14 días." },
  { role: "assistant", content: "Lamento la demora. Voy a revisar el estado del pedido TP-451200." },
  { role: "user", content: "Quería que llegue para un regalo el sábado." },
  { role: "assistant", content: "Entiendo la urgencia. Veamos opciones." },
  { role: "user", content: "Si no llega, prefiero el reembolso." },
  { role: "assistant", content: "Anotado. Si pasamos el viernes sin entrega, procesamos reembolso." },
  ...Array.from({ length: 12 }, (_, i) => ({
    role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: `Conversación de relleno turno ${i + 9}: hablamos sobre detalles operativos del envío y opciones de devolución.`,
  })),
  { role: "user", content: "¿Tienes actualización del transporte?" },
  { role: "assistant", content: "Estoy consultando ahora con la transportista." },
  { role: "user", content: "Avísame en cuanto sepas." },
];

async function main(): Promise<void> {
  const store = new ConversationStore();
  for (const t of TURNS) {
    store.addMessage({
      id: newId(),
      role: t.role,
      content: t.content,
      createdAt: new Date().toISOString(),
    });
  }

  const oldTurns = store.getHistory().slice(0, 20).map((m) => ({ role: m.role, content: m.content }));
  console.log(`Resumiendo ${oldTurns.length} turnos viejos...`);
  const summary = await summarizeOldMessages(oldTurns);

  console.log("\n=== Resumen generado ===");
  console.log(summary);
  console.log("");

  const checks = [
    { needle: "Ana", desc: "nombre del cliente" },
    { needle: "TP-451200", desc: "ID de pedido" },
  ];

  for (const c of checks) {
    const found = summary.includes(c.needle);
    console.log(`${found ? "✓" : "✗"} ${c.desc}: "${c.needle}" ${found ? "presente" : "AUSENTE"}`);
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
