/**
 * Guardrails — validaciones pre/post llamada al LLM.
 *
 * Estas son una CAPA de seguridad, no THE seguridad. La defensa
 * profunda viene del system prompt, structured outputs y
 * (opcionalmente) content moderation externa.
 */

export class GuardrailViolation extends Error {
  public readonly kind: string;
  constructor(kind: string, message: string) {
    super(message);
    this.kind = kind;
    this.name = "GuardrailViolation";
  }
}

const SUSPICIOUS_INPUT_PATTERNS = [
  /ignore previous (instructions|prompt)/i,
  /you are now/i,
  /system prompt/i,
  /forget your (rules|instructions)/i,
  /act as (a |an )?(?:dan|jailbreak)/i,
];

export function validateInput(text: string): void {
  if (!text || text.trim().length < 1) {
    throw new GuardrailViolation("input_empty", "Mensaje vacío.");
  }

  if (text.length > 4000) {
    throw new GuardrailViolation(
      "input_too_long",
      `Mensaje excede 4000 caracteres (${text.length}).`,
    );
  }

  for (const re of SUSPICIOUS_INPUT_PATTERNS) {
    if (re.test(text)) {
      throw new GuardrailViolation(
        "input_suspicious",
        `Patrón sospechoso detectado: ${re}`,
      );
    }
  }
}

const BANNED_OUTPUT_TERMS = ["amazon", "mercadolibre", "mercado libre", "shopify", "aliexpress"];

export function validateOutput(text: string): void {
  if (!text || text.trim().length < 1) {
    throw new GuardrailViolation("output_empty", "Respuesta vacía.");
  }

  if (text.length > 2000) {
    throw new GuardrailViolation(
      "output_too_long",
      `Respuesta excede 2000 caracteres (${text.length}).`,
    );
  }

  const lower = text.toLowerCase();
  for (const term of BANNED_OUTPUT_TERMS) {
    if (lower.includes(term)) {
      throw new GuardrailViolation(
        "output_competitor_mention",
        `Mención de competidor detectada: "${term}".`,
      );
    }
  }
}
