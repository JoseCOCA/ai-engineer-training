/**
 * Render minimalista de prompt templates.
 *
 * - Lee prompts/<name>.md desde la raíz del paquete.
 * - Reemplaza {{var}} por vars[var]. Si falta una variable, falla
 *   con error explícito (en vez de dejar el placeholder literal).
 *
 * Sin dependencias adicionales — un regex hace el trabajo. Si tu
 * caso necesita condicionales o loops, evaluá Handlebars.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const PROMPTS_DIR = fileURLToPath(new URL("../../prompts/", import.meta.url));

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export class PromptRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptRenderError";
  }
}

export function render(name: string, vars: Record<string, string> = {}): string {
  const path = resolve(PROMPTS_DIR, `${name}.md`);
  let template: string;
  try {
    template = readFileSync(path, "utf8");
  } catch (error) {
    throw new PromptRenderError(
      `No se pudo leer el template "${name}" en ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return template.replace(PLACEHOLDER_RE, (_, key: string) => {
    if (!(key in vars)) {
      throw new PromptRenderError(
        `Variable "${key}" no provista al renderizar "${name}".`,
      );
    }
    return vars[key];
  });
}

export function listPrompts(): string[] {
  return [];
}
