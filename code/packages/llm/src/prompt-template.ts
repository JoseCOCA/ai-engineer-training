/**
 * Render minimalista de prompt templates.
 *
 * makePromptRenderer(promptsDir) crea un render() bound a un
 * directorio específico. Esto permite que distintos packages
 * (proyecto integrador, otros productos) tengan sus propios
 * directorios de prompts sin conflictos.
 *
 * - Lee {promptsDir}/<name>.md
 * - Reemplaza {{var}} por vars[var]. Si falta una variable, falla
 *   con error explícito.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export class PromptRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptRenderError";
  }
}

export type PromptRenderer = (
  name: string,
  vars?: Record<string, string>,
) => string;

export function makePromptRenderer(promptsDir: string): PromptRenderer {
  return function render(
    name: string,
    vars: Record<string, string> = {},
  ): string {
    const path = resolve(promptsDir, `${name}.md`);
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
  };
}
