/**
 * Demo de fallback: forzamos al primary a fallar y vemos cómo
 * el wrapper conmuta al fallback (Ollama).
 *
 * IMPORTANTE: este script REQUIERE Ollama corriendo localmente
 * (OLLAMA_BASE_URL configurado en .env y el modelo descargado).
 * Si no tienes Ollama, este demo no completa.
 */
import { chat } from "./lib/chat.js";

// Forzamos al primary a fallar reescribiendo temporalmente la
// variable de entorno antes de importar el modelo. Como provider
// "google" sin API key real, callProvider tira en buildModel.
const ORIGINAL_PRIMARY = process.env.DEFAULT_LLM_PROVIDER;
process.env.DEFAULT_LLM_PROVIDER = "google";
const HAD_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

async function main(): Promise<void> {
  console.log("Primary forzado a 'google' SIN API key — debe disparar fallback.");
  console.log("");

  try {
    const response = await chat({
      system: "Eres el asistente virtual de TiendaPro.",
      messages: [
        {
          role: "user",
          content: "Saluda al cliente en una frase.",
        },
      ],
      flow: "fallback-test",
    });

    console.log(`[provider: ${response.provider}]`);
    console.log(`[fallbackUsed: ${response.fallbackUsed}]`);
    console.log(`→ Respuesta: ${response.text}`);
    console.log(`Latencia: ${response.latencyMs}ms`);
  } catch (error) {
    console.error(
      "El fallback también falló. ¿Está corriendo Ollama? Revisa OLLAMA_BASE_URL.",
    );
    console.error(error);
    process.exitCode = 1;
  } finally {
    process.env.DEFAULT_LLM_PROVIDER = ORIGINAL_PRIMARY;
    if (HAD_KEY) process.env.GOOGLE_GENERATIVE_AI_API_KEY = HAD_KEY;
  }
}

main();
