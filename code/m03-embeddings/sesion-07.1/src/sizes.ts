/**
 * Compara 4 configuraciones de tamaño/overlap sobre el manual.
 * Reporta cantidad de chunks, tokens totales y tokens duplicados.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { encode } from "gpt-tokenizer";

const MANUAL_PATH = fileURLToPath(new URL("../data/manual.md", import.meta.url));

interface Config {
  label: string;
  size: number;
  overlap: number;
}

const CONFIGS: Config[] = [
  { label: "Tiny", size: 200, overlap: 0 },
  { label: "Default", size: 800, overlap: 100 },
  { label: "Big", size: 2000, overlap: 0 },
  { label: "Heavy overlap", size: 800, overlap: 400 },
];

async function main(): Promise<void> {
  const manual = readFileSync(MANUAL_PATH, "utf8");
  const totalTokens = encode(manual).length;

  console.log(`Manual: ${manual.length} chars, ~${totalTokens} tokens\n`);
  console.log(
    `${"Config".padEnd(20)}${"Size".padStart(8)}${"Overlap".padStart(10)}${"Chunks".padStart(10)}${"Total tok".padStart(14)}${"Extra tok".padStart(14)}`,
  );
  console.log("-".repeat(76));

  for (const cfg of CONFIGS) {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: cfg.size,
      chunkOverlap: cfg.overlap,
      separators: ["\n\n", "\n", ". ", " ", ""],
    });
    const docs = await splitter.createDocuments([manual]);

    const totalEmbedTokens = docs
      .map((d) => encode(d.pageContent).length)
      .reduce((a, b) => a + b, 0);

    const extra = totalEmbedTokens - totalTokens;

    console.log(
      `${cfg.label.padEnd(20)}${String(cfg.size).padStart(8)}${String(cfg.overlap).padStart(10)}${String(docs.length).padStart(10)}${String(totalEmbedTokens).padStart(14)}${String(extra).padStart(14)}`,
    );
  }

  console.log("");
  console.log("'Extra tok' = tokens duplicados por overlap. Pequeño en relativo, prácticamente gratis.");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
