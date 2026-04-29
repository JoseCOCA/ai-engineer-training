/**
 * Structural chunking sobre Markdown:
 * cada sección H1/H2/H3 = un chunk con metadata.headings = path.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { markdownStructuralChunker } from "./lib/chunkers.js";

const MANUAL_PATH = fileURLToPath(new URL("../data/manual.md", import.meta.url));

function preview(text: string, n = 180): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > n ? `${trimmed.slice(0, n)}…` : trimmed;
}

function main(): void {
  const manual = readFileSync(MANUAL_PATH, "utf8");
  const chunks = markdownStructuralChunker(manual, {
    source: "manual",
    fallbackChunkSize: 1500,
  });

  console.log(`Total chunks: ${chunks.length}\n`);

  for (const c of chunks) {
    console.log(`=== ${c.metadata.chunkId} ===`);
    console.log(`headings: ${JSON.stringify(c.metadata.headings ?? [])}`);
    console.log(`text: ${preview(c.text)}`);
    console.log("");
  }

  console.log("La metadata 'headings' permite filtrar el retrieval por sección en S08 (pgvector + JSONB).");
}

main();
