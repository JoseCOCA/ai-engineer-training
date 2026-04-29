/**
 * Comparativa fixed-size vs recursive sobre el manual de TiendaPro.
 * Imprime los primeros 3 chunks de cada estrategia para que veas
 * cómo cortan el texto.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { fixedSizeChunker } from "./lib/chunkers.js";

const MANUAL_PATH = fileURLToPath(new URL("../data/manual.md", import.meta.url));

function preview(text: string, n = 200): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > n ? `${trimmed.slice(0, n)}…` : trimmed;
}

async function main(): Promise<void> {
  const manual = readFileSync(MANUAL_PATH, "utf8");

  console.log("=== Fixed-size (size=400, overlap=50) ===\n");
  const fixed = fixedSizeChunker(manual, { chunkSize: 400, overlap: 50 });
  for (let i = 0; i < Math.min(3, fixed.length); i++) {
    console.log(`Chunk ${i} [${fixed[i].metadata.startChar}..${fixed[i].metadata.endChar}]`);
    console.log(preview(fixed[i].text));
    console.log("");
  }
  console.log(`Total chunks fixed-size: ${fixed.length}\n`);

  console.log("=== Recursive (size=400, overlap=50, separators \\n\\n→\\n→. → ) ===\n");
  const recursive = new RecursiveCharacterTextSplitter({
    chunkSize: 400,
    chunkOverlap: 50,
    separators: ["\n\n", "\n", ". ", " ", ""],
  });
  const recursiveDocs = await recursive.createDocuments([manual]);
  for (let i = 0; i < Math.min(3, recursiveDocs.length); i++) {
    console.log(`Chunk ${i}`);
    console.log(preview(recursiveDocs[i].pageContent));
    console.log("");
  }
  console.log(`Total chunks recursive: ${recursiveDocs.length}\n`);

  console.log("Observá cómo recursive corta en \\n\\n cuando puede, manteniendo párrafos enteros.");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
