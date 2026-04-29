/**
 * FAQ matching con embeddings.
 *
 * Embedeaa las preguntas frecuentes y, dado un mensaje del usuario,
 * encuentra la FAQ semánticamente más cercana. Si la similitud
 * supera el umbral, devuelve la respuesta. Si no, deriva a humano.
 *
 * Esto es la forma simple del FAQ-bot. En M4 vamos a hacerlo bien
 * con RAG: embedear chunks + LLM genera respuesta combinando varios.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { embedBatch, embedOne, cosineSimilarity } from "./lib/embeddings.js";

interface Faq {
  id: string;
  question: string;
  answer: string;
}

const FAQS_PATH = fileURLToPath(new URL("../data/faqs.json", import.meta.url));

const MIN_SIMILARITY = 0.7;

const USER_QUERIES = [
  "¿en cuánto me llega el pedido?",
  "no me cobraron bien",
  "puedo cambiar la dirección",
  "qué método de pago aceptan",
  "hablemos del clima",
];

async function main(): Promise<void> {
  const faqs: Faq[] = JSON.parse(readFileSync(FAQS_PATH, "utf8"));

  console.log(`Embedeando ${faqs.length} preguntas frecuentes...\n`);
  const faqVectors = await embedBatch(faqs.map((f) => f.question));

  for (const query of USER_QUERIES) {
    console.log(`Query: "${query}"`);
    const queryVec = await embedOne(query);

    let bestIdx = -1;
    let bestScore = -1;
    for (let i = 0; i < faqs.length; i++) {
      const sim = cosineSimilarity(queryVec, faqVectors[i]);
      if (sim > bestScore) {
        bestScore = sim;
        bestIdx = i;
      }
    }

    if (bestScore >= MIN_SIMILARITY) {
      const matched = faqs[bestIdx];
      console.log(`  → Match: "${matched.question}" (${bestScore.toFixed(2)})`);
      console.log(`  → Respuesta: ${matched.answer}\n`);
    } else {
      console.log(`  → Sin match suficiente (mejor: ${bestScore.toFixed(2)})`);
      console.log(`  → Derivar a humano.\n`);
    }
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
