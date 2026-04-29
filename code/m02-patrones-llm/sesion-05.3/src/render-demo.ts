/**
 * Demo del prompt template engine.
 * Renderiza customer-support con variables y muestra el error
 * cuando falta una variable obligatoria.
 */
import { render, PromptRenderError } from "./lib/prompt-template.js";

function ok(): void {
  console.log("=== customer-support.system con userName=Ana, locale=es-AR ===");
  const out = render("customer-support.system", {
    userName: "Ana",
    locale: "es-AR",
  });
  console.log(out);
}

function missingVar(): void {
  console.log("=== Var faltante (locale) ===");
  try {
    render("customer-support.system", { userName: "Carlos" });
    console.log("(no debería haber llegado acá)");
  } catch (error) {
    if (error instanceof PromptRenderError) {
      console.log(`Error: ${error.message}`);
    } else {
      throw error;
    }
  }
}

function intentClassifier(): void {
  console.log("");
  console.log("=== intent-classifier.system (sin variables) ===");
  const out = render("intent-classifier.system", {});
  console.log(out);
}

function main(): void {
  ok();
  console.log("");
  missingVar();
  intentClassifier();
}

main();
