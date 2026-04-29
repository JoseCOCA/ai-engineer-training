/**
 * S02 — Reto: stop sequences para forzar formato.
 *
 * Pide al modelo 5 sugerencias de productos relacionados, una por
 * línea, en formato:
 *
 *   1. Producto A
 *   2. Producto B
 *   ...
 *   5. Producto E
 *   END
 *
 * Configura stopSequences=["END"] para que el modelo se detenga
 * limpiamente en lugar de seguir charlando después.
 *
 * Después parsea la salida a un array string[].
 *
 * NOTA: stop sequences es FRÁGIL como técnica de parsing
 * (ver pregunta 5.4 del ejercicio). En S04 vamos a hacerlo bien
 * con structured outputs y schema validation.
 */
import { generateText } from "ai";
import { llm, providerInUse } from "./lib/llm.js";

const SYSTEM_PROMPT = `Eres un asistente de e-commerce especializado en productos outdoor.
Responde EXACTAMENTE en el formato pedido y nada más.`;

const STOP_TOKEN = "END";

const buildPrompt = (productInput: string) => `
Producto que está mirando el cliente: "${productInput}"

Sugiere exactamente 5 productos relacionados que combinen bien con ese producto.
Formato OBLIGATORIO (una sugerencia por línea, numeradas, terminando con la palabra ${STOP_TOKEN} en su propia línea):

1. <nombre del producto>
2. <nombre del producto>
3. <nombre del producto>
4. <nombre del producto>
5. <nombre del producto>
${STOP_TOKEN}
`;

async function suggest(productInput: string): Promise<string[]> {
  const result = await generateText({
    model: llm,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(productInput),
    temperature: 0.5,
    maxOutputTokens: 200,
    stopSequences: [STOP_TOKEN],
  });

  const lines = result.text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+\S/.test(line));

  return lines;
}

const TEST_PRODUCTS = [
  "Mochila de senderismo 30L",
  "Bicicleta de montaña aro 29",
  "Tienda de campaña 2 personas",
];

async function main(): Promise<void> {
  console.log(`[provider: ${providerInUse}]`);
  console.log("");

  for (const product of TEST_PRODUCTS) {
    console.log(`### Producto: ${product}`);
    const suggestions = await suggest(product);
    console.log(JSON.stringify(suggestions, null, 2));
    console.log("");
  }

  console.log(
    "Ojo: stop sequences es frágil. Si el modelo no genera 'END', te quedás esperando.",
  );
  console.log("En S04 lo resolvemos correctamente con structured outputs.");
}

main().catch((error: unknown) => {
  console.error("Error:", error);
  process.exit(1);
});
