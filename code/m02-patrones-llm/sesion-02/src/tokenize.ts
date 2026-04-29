/**
 * S02 — Ejercicio 2: tokenización en español vs inglés.
 *
 * Tokeniza varios pares de textos equivalentes (ES/EN) usando el
 * tokenizer de GPT-4 (cl100k_base) y compara la cantidad de tokens.
 *
 * Conclusión: el español genera ~1.3-1.5× más tokens que el inglés
 * para contenido equivalente. Esto se traduce en costo proporcional
 * más alto al operar productos en español.
 */
import { encode } from "gpt-tokenizer";

interface Pair {
  en: string;
  es: string;
}

const PAIRS: Pair[] = [
  {
    en: "Hello world",
    es: "Hola mundo",
  },
  {
    en: "How can I help you?",
    es: "¿En qué puedo ayudarte?",
  },
  {
    en: "Your order has been shipped and will arrive in 3 business days.",
    es: "Tu pedido ha sido enviado y llegará en 3 días hábiles.",
  },
  {
    en: "Sorry, I cannot find that product in our catalog.",
    es: "Lo siento, no puedo encontrar ese producto en nuestro catálogo.",
  },
  {
    en: "Please provide your email to receive the confirmation.",
    es: "Por favor, proporciona tu correo electrónico para recibir la confirmación.",
  },
  {
    en: "I would like to return this item because it does not match the description.",
    es: "Me gustaría devolver este artículo porque no coincide con la descripción.",
  },
];

function countTokens(text: string): number {
  return encode(text).length;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

async function main(): Promise<void> {
  console.log("Tokenización con cl100k_base (GPT-4 family)\n");

  let totalEn = 0;
  let totalEs = 0;

  for (const pair of PAIRS) {
    const enTokens = countTokens(pair.en);
    const esTokens = countTokens(pair.es);
    totalEn += enTokens;
    totalEs += esTokens;

    console.log(
      `EN [${pad(String(enTokens), 3)} tok] ${JSON.stringify(pair.en)}`,
    );
    console.log(
      `ES [${pad(String(esTokens), 3)} tok] ${JSON.stringify(pair.es)}`,
    );
    console.log("");
  }

  const ratio = totalEs / totalEn;

  console.log(`Total inglés: ${totalEn} tokens`);
  console.log(`Total español: ${totalEs} tokens`);
  console.log(`Ratio español/inglés: ${ratio.toFixed(2)}x`);
  console.log("");
  console.log(
    `Lección: el español cuesta ~${Math.round(
      (ratio - 1) * 100,
    )}% más que el inglés en este snapshot.`,
  );
  console.log(
    "Otros tokenizers (Mistral, Llama 3.x) pueden ser más eficientes en español.",
  );
}

main().catch((error: unknown) => {
  console.error("Error:", error);
  process.exit(1);
});
