/**
 * Renderer de prompts del proyecto integrador.
 *
 * Bound al directorio prompts/ de TiendaPro. Otros productos que
 * usen @curso-ai/llm crean su propio renderer apuntando a su carpeta.
 */
import { fileURLToPath } from "node:url";
import { makePromptRenderer } from "@curso-ai/llm";

const PROMPTS_DIR = fileURLToPath(new URL("../../prompts/", import.meta.url));

export const render = makePromptRenderer(PROMPTS_DIR);
