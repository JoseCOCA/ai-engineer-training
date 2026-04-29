/**
 * Schema con refinement para extraer datos de pedido.
 *
 * Demuestra:
 *  - z.string().refine(...) para validar formato custom.
 *  - .transform() para normalizar (uppercase) antes de validar.
 *  - .optional() para campos no obligatorios.
 *  - Manejo de error explícito cuando el modelo no puede cumplir el schema.
 */
import { generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { llm } from "./lib/llm.js";

const orderSchema = z.object({
  orderId: z
    .string()
    .transform((s) => s.toUpperCase())
    .refine((s) => /^TP-\d{6}$/.test(s), "Formato de ID inválido (esperado TP-NNNNNN)")
    .describe("ID de pedido, formato TP-NNNNNN (en mayúsculas)"),
  customerEmail: z
    .string()
    .email()
    .optional()
    .describe("Email del cliente si lo mencionó. Omitir si no aparece."),
  reportedIssue: z
    .enum(["no_received", "damaged", "wrong_item", "other"])
    .describe("Tipo de problema reportado"),
});

type OrderData = z.infer<typeof orderSchema>;

async function extractOrder(message: string): Promise<OrderData | string> {
  try {
    const { object } = await generateObject({
      model: llm,
      system:
        "Extraes datos estructurados de un mensaje de cliente sobre un pedido. Si falta información obligatoria, no inventes — el SDK te avisará.",
      prompt: message,
      schema: orderSchema,
      temperature: 0,
    });
    return object;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return `[NoObjectGeneratedError] el modelo no pudo cumplir el schema: ${error.message}`;
    }
    if (error instanceof z.ZodError) {
      return `[ZodError] ${error.issues.map((i) => i.message).join("; ")}`;
    }
    throw error;
  }
}

const TEST_MESSAGES = [
  "Mi pedido TP-451200 nunca llegó. Mi email es ana@example.com",
  "Me llegó el pedido tp-99 roto",
  "No me llegó nada",
  "Pedido TP-100200 con producto equivocado",
];

async function main(): Promise<void> {
  for (const msg of TEST_MESSAGES) {
    console.log(`\n"${msg}"`);
    const r = await extractOrder(msg);
    console.log(JSON.stringify(r, null, 2));
  }
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
