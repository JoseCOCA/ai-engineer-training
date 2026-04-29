/**
 * Reto S05.1: contexto desde web.
 *
 * Pide la ciudad como argumento, hace fetch a wttr.in (clima),
 * extrae los campos relevantes, los inyecta al prompt y pide al
 * modelo que recomiende qué ropa llevar.
 *
 * Maneja:
 *  - Timeout (3s) → fallback "no puedo consultar el clima ahora".
 *  - 4xx/5xx → idem.
 *  - Sin argumento → uso.
 *
 * Uso:
 *   pnpm run weather "Madrid"
 *   pnpm run weather "Tokio"
 *   pnpm run weather "Ciudad-Que-No-Existe"
 */
import { generateText } from "ai";
import { llm, providerInUse } from "./lib/llm.js";

interface WeatherSummary {
  city: string;
  temp_C: number;
  weatherDesc: string;
  humidity: number;
  precipMM: number;
}

async function fetchWeather(city: string): Promise<WeatherSummary> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 3000);

  try {
    const res = await fetch(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
      { signal: ctrl.signal },
    );
    if (!res.ok) {
      throw new Error(`wttr.in respondió ${res.status}`);
    }
    const data = (await res.json()) as {
      current_condition?: Array<{
        temp_C: string;
        weatherDesc: Array<{ value: string }>;
        humidity: string;
        precipMM: string;
      }>;
    };
    const cur = data.current_condition?.[0];
    if (!cur) throw new Error("Sin datos current_condition");

    return {
      city,
      temp_C: Number(cur.temp_C),
      weatherDesc: cur.weatherDesc[0]?.value ?? "desconocido",
      humidity: Number(cur.humidity),
      precipMM: Number(cur.precipMM),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function answerWithWeather(city: string): Promise<void> {
  let weather: WeatherSummary | null = null;
  try {
    weather = await fetchWeather(city);
  } catch (error) {
    console.warn(
      `[fallback] no pude consultar el clima: ${error instanceof Error ? error.message : error}`,
    );
  }

  const SYSTEM = `Eres el asistente de TiendaPro. Recomiendas ropa apropiada para una salida outdoor según el clima.`;

  const userPrompt = weather
    ? `El cliente va a salir hoy a ${weather.city}. Clima actual: ${weather.temp_C}°C, ${weather.weatherDesc}, humedad ${weather.humidity}%, precip ${weather.precipMM}mm. Recomienda qué ropa y accesorios llevar (máx 3 frases).`
    : `El cliente va a salir hoy a ${city}. No tenemos datos de clima. Pregunta si conoce el pronóstico antes de recomendar.`;

  console.log(`[provider: ${providerInUse}]`);
  console.log(weather ? `[weather: ${JSON.stringify(weather)}]` : "[weather: unavailable]");
  console.log("");

  const result = await generateText({
    model: llm,
    system: SYSTEM,
    prompt: userPrompt,
    temperature: 0.4,
    maxOutputTokens: 250,
  });

  console.log(result.text);
}

async function main(): Promise<void> {
  const city = process.argv[2];
  if (!city) {
    console.error("Uso: pnpm run weather \"Madrid\"");
    process.exit(1);
  }
  await answerWithWeather(city);
}

main().catch((err: unknown) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
