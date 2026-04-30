/**
 * ¿Cuánto cambia el embedding según el pre-procesamiento?
 *
 * Toma una query y genera 4 variantes:
 *   - original
 *   - lowercased
 *   - sin puntuación
 *   - sin stop words (lista heurística)
 *
 * Para cada variante: top-3 contra el catálogo y similitud coseno
 * del top-1 contra la variante original.
 *
 * Conclusión esperada: lowercase y sin puntuación son ~ruido; sin
 * stop words rompe el ranking.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import {
  cosine,
  productAsDoc,
  topK,
  type Product,
} from "./lib/util.js";

const CATALOG_PATH = fileURLToPath(
  new URL("../data/catalog.json", import.meta.url),
);

const QUERY = "Algo para CARGAR mis cosas, en una caminata!!";

const STOP_WORDS_ES = new Set([
  "a",
  "al",
  "algo",
  "de",
  "del",
  "el",
  "en",
  "la",
  "las",
  "lo",
  "los",
  "mi",
  "mis",
  "para",
  "por",
  "que",
  "se",
  "su",
  "sus",
  "un",
  "una",
  "unas",
  "unos",
  "y",
]);

function lowercase(s: string): string {
  return s.toLowerCase();
}

function stripPunctuation(s: string): string {
  return s.replace(/[.,;:!?¡¿"'()\[\]{}]/g, "").replace(/\s+/g, " ").trim();
}

function removeStopWords(s: string): string {
  return s
    .split(/\s+/)
    .filter((w) => !STOP_WORDS_ES.has(w.toLowerCase().replace(/[.,;:!?]/g, "")))
    .join(" ");
}

async function main(): Promise<void> {
  const catalog: Product[] = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const docs = catalog.map(productAsDoc);

  console.log(`Embedeando ${catalog.length} productos...\n`);
  const { embeddings: corpus } = await embedMany({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    values: docs,
  });

  const variants = [
    { name: "original           ", text: QUERY },
    { name: "lowercased         ", text: lowercase(QUERY) },
    { name: "sin puntuación     ", text: stripPunctuation(QUERY) },
    { name: "sin stop words     ", text: removeStopWords(QUERY) },
  ];

  const { embeddings: variantVecs } = await embedMany({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    values: variants.map((v) => v.text),
  });

  const refVec = variantVecs[0];

  console.log(`Query original: "${QUERY}"\n`);
  console.log(
    "Variante              | Texto resultante                                  | Top-3                                                  | sim vs original",
  );
  console.log(
    "----------------------|---------------------------------------------------|--------------------------------------------------------|----------------",
  );

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const vVec = variantVecs[i];
    const top = topK(
      catalog.map((p, j) => ({ p, vec: corpus[j] })),
      (x) => cosine(vVec, x.vec),
      3,
    );
    const names = top.map((t) => t.item.p.name).join(" | ");
    const simVsOriginal = cosine(refVec, vVec).toFixed(4);
    const textTrunc = v.text.padEnd(49).slice(0, 49);
    console.log(
      `${v.name} | ${textTrunc} | ${names.padEnd(54).slice(0, 54)} | ${simVsOriginal}`,
    );
  }

  console.log("");
  console.log(
    "Lectura: similitud cercana a 1.0 = el embedding casi no cambió.\n" +
      "Cambios fuertes (ej. quitar stop words) modifican qué entiende el modelo.\n" +
      "Para embeddings densos modernos, la regla es: pre-procesa lo mínimo.",
  );
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
