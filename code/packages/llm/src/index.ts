/**
 * @curso-ai/llm — barrel de exports.
 *
 * Punto único de import para apps que consumen la lib. La regla
 * arquitectural es: la app NO importa `ai` ni `@ai-sdk/*`. Importa
 * desde acá y no se entera del SDK del proveedor.
 */
export {
  buildModel,
  FALLBACK_PROVIDER,
  PRIMARY_PROVIDER,
  type Provider,
  type ResolvedModel,
} from "./providers.js";

export { priceFor, type UsageInput } from "./pricing.js";

export {
  defaultShouldRetry,
  withRetry,
  type RetryOptions,
} from "./retry.js";

export {
  chat,
  chatStream,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type ChatStreamResult,
} from "./chat.js";

export {
  ConversationStore,
  newId,
  type Message,
  type Role,
  type StoredMessage,
} from "./conversation.js";

export {
  makePromptRenderer,
  PromptRenderError,
  type PromptRenderer,
} from "./prompt-template.js";
