/**
 * Logger del proyecto integrador.
 *
 * Sink simple: append-only JSONL en logs/calls.jsonl.
 * Recibe el ChatResponse de @curso-ai/llm vía el callback onComplete
 * y lo serializa con timestamp.
 *
 * En producción real, este logger envía a Langfuse / Helicone /
 * un OTel collector (lo cubrimos en M6).
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ChatResponse } from "@curso-ai/llm";

const LOG_FILE = fileURLToPath(new URL("../../logs/calls.jsonl", import.meta.url));

let initialized = false;

function ensureInit(): void {
  if (initialized) return;
  mkdirSync(dirname(LOG_FILE), { recursive: true });
  initialized = true;
}

export function logChatResponse(response: ChatResponse): void {
  ensureInit();
  const line =
    JSON.stringify({ timestamp: new Date().toISOString(), ...response }) + "\n";
  appendFileSync(LOG_FILE, line, "utf8");
}

export function getLogFilePath(): string {
  return LOG_FILE;
}
