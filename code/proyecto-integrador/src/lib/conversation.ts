/**
 * ConversationStore — almacena el historial completo en memoria
 * y expone un getContextWindow(maxTokens) que decide qué mandar
 * al modelo en el próximo turno.
 *
 * Patrón: tu app es la dueña del historial. La API LLM es stateless.
 *
 * Persistencia simple a JSONL incluida (ver saveTo / loadFrom).
 * Para producción real, BD relacional con índices.
 */
import { encode } from "gpt-tokenizer";
import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: Role;
  content: string;
}

export interface StoredMessage extends Message {
  id: string;
  createdAt: string;
  flow?: string;
}

function tokens(text: string): number {
  return encode(text).length;
}

export class ConversationStore {
  private messages: StoredMessage[] = [];

  addMessage(msg: StoredMessage): void {
    this.messages.push(msg);
  }

  getHistory(): StoredMessage[] {
    return [...this.messages];
  }

  size(): number {
    return this.messages.length;
  }

  /**
   * Devuelve los mensajes más recientes que entran en maxTokens.
   * Mantiene el orden cronológico (oldest first).
   */
  getContextWindow(maxTokens: number): Message[] {
    const reversed = [...this.messages].reverse();
    const kept: Message[] = [];
    let used = 0;

    for (const m of reversed) {
      const t = tokens(m.content);
      if (used + t > maxTokens) break;
      kept.unshift({ role: m.role, content: m.content });
      used += t;
    }

    return kept;
  }

  saveTo(path: string): void {
    mkdirSync(dirname(path), { recursive: true });
    const lines = this.messages.map((m) => JSON.stringify(m)).join("\n") + "\n";
    appendFileSync(path, lines, "utf8");
  }

  static loadFrom(path: string): ConversationStore {
    const store = new ConversationStore();
    if (!existsSync(path)) return store;
    const content = readFileSync(path, "utf8").trim();
    if (!content) return store;
    for (const line of content.split("\n")) {
      const msg = JSON.parse(line) as StoredMessage;
      store.messages.push(msg);
    }
    return store;
  }
}

export function newId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
