/**
 * Reto S07.1: chunker que siempre corta en límites de oración.
 *
 * Demuestra el comportamiento: nunca corta a mitad de palabra ni
 * a mitad de oración. La trade-off: en docs sin oraciones claras
 * (código, JSON, listas) cae en un solo chunk gigante.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sentenceAwareChunker } from "./lib/chunkers.js";

const MANUAL_PATH = fileURLToPath(new URL("../data/manual.md", import.meta.url));

function preview(text: string, n = 200): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > n ? `${trimmed.slice(0, n)}…` : trimmed;
}

function main(): void {
  const manual = readFileSync(MANUAL_PATH, "utf8");

  const chunks = sentenceAwareChunker(manual, {
    maxChars: 800,
    overlapSentences: 1,
    source: "manual",
  });

  console.log(`Total chunks: ${chunks.length}\n`);
  for (let i = 0; i < Math.min(5, chunks.length); i++) {
    console.log(`Chunk ${i} [${chunks[i].text.length} chars]`);
    console.log(preview(chunks[i].text));
    console.log("");
  }

  // Caso patológico: todo el texto en una sola línea sin puntuación
  console.log("=== Caso patológico: texto sin puntuación ===");
  const blob = "esto es un texto muy largo sin puntuacion ".repeat(50);
  const fail = sentenceAwareChunker(blob, {
    maxChars: 200,
    overlapSentences: 0,
    source: "blob",
  });
  console.log(`Chunks producidos: ${fail.length}`);
  console.log(`Tamaño del primero: ${fail[0]?.text.length} chars`);
  console.log("(Sin oraciones marcadas, todo cae en un único chunk gigante.)");
}

main();
