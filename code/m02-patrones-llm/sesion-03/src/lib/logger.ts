/**
 * Logger append-only a logs/calls.jsonl.
 *
 * Formato JSONL: una línea = un JSON. Lo más simple y portable
 * para análisis offline. En producción real, este logger envía
 * a Langfuse / Helicone / un OTel collector.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const LOG_FILE = fileURLToPath(new URL("../../logs/calls.jsonl", import.meta.url));

let initialized = false;

function ensureInit(): void {
  if (initialized) return;
  mkdirSync(dirname(LOG_FILE), { recursive: true });
  initialized = true;
}

export function appendLog(record: object): void {
  ensureInit();
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...record }) + "\n";
  appendFileSync(LOG_FILE, line, "utf8");
}

export function getLogFilePath(): string {
  return LOG_FILE;
}
