import { z } from "zod";

export const SIGNOS = [
  "Áries",
  "Touro",
  "Gêmeos",
  "Câncer",
  "Leão",
  "Virgem",
  "Libra",
  "Escorpião",
  "Sagitário",
  "Capricórnio",
  "Aquário",
  "Peixes",
] as const;

export type Signo = (typeof SIGNOS)[number];

// Remove null bytes e caracteres de controle (exceto tab/newline legítimos)
function stripControlChars(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

// ─── Perfil do usuário ────────────────────────────────────────────────────────
export const profileSchema = z.object({
  nome: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .transform(stripControlChars)
    .pipe(
      z
        .string()
        .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Nome contém caracteres inválidos")
        .min(2)
    )
    .transform((v) => v.trim()),
  signo: z.enum(SIGNOS, { errorMap: () => ({ message: "Signo inválido" }) }),
  data_nascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use YYYY-MM-DD)")
    .refine((d) => {
      // Verificar se é uma data real (ex: rejeita 2023-02-31)
      const date = new Date(d + "T00:00:00Z");
      return (
        !isNaN(date.getTime()) &&
        date.toISOString().startsWith(d) &&
        date < new Date() &&
        date > new Date("1900-01-01T00:00:00Z")
      );
    }, "Data de nascimento inválida"),
  whatsapp: z
    .string()
    .min(8, "WhatsApp muito curto")
    .max(16, "WhatsApp muito longo")
    .regex(
      /^\+?[1-9]\d{7,14}$/,
      "WhatsApp inválido. Use formato internacional: +5511999999999"
    )
    .transform((v) => v.replace(/\s/g, "")),
});

export type ProfileInput = z.infer<typeof profileSchema>;

// ─── Guia de Vícios ───────────────────────────────────────────────────────────
export const CATEGORIAS_GUIA = [
  "Alimentação Emocional",
  "Relacionamentos Tóxicos",
  "Procrastinação",
  "Vício em Redes Sociais",
  "Ansiedade Crônica",
  "Cigarro",
  "Álcool",
] as const;

export type CategoriaGuia = (typeof CATEGORIAS_GUIA)[number];

export const guiaViciosSchema = z.object({
  categoria: z.enum(CATEGORIAS_GUIA, {
    errorMap: () => ({ message: "Categoria inválida." }),
  }),
});

export type GuiaViciosInput = z.infer<typeof guiaViciosSchema>;

// ─── Solicitação de leitura ───────────────────────────────────────────────────
export const readingRequestSchema = z.object({
  pergunta: z
    .string()
    .max(500, "Pergunta deve ter no máximo 500 caracteres")
    .transform(stripControlChars)
    // Rejeitar strings que parecem injeção de prompt
    .refine(
      (v) =>
        !/ignore\s+(previous|all|above)|disregard|system\s+prompt|jailbreak/i.test(v),
      "Pergunta contém conteúdo inválido"
    )
    .optional()
    .transform((v) => {
      const trimmed = v?.trim();
      // Converter string vazia para undefined
      return trimmed === "" ? undefined : trimmed;
    }),
});

export type ReadingRequestInput = z.infer<typeof readingRequestSchema>;

// ─── Webhook Kiwify ───────────────────────────────────────────────────────────
// Payload enviado pela Kiwify em cada evento de compra/assinatura.
// Eventos suportados:
//   order_approved          → compra aprovada / renovação de assinatura
//   order_refunded          → estorno / chargeback
//   subscription_canceled   → cancelamento de assinatura
//   subscription_reactivated → reativação de assinatura
//
// Validação de autenticidade:
//   • token     (no corpo) deve bater com KIWIFY_WEBHOOK_TOKEN (comparação timing-safe)
//   • Signature (no corpo) = HMAC-SHA256(KIWIFY_WEBHOOK_TOKEN, order_id)
export const kiwifyWebhookSchema = z.object({
  webhook_event_type: z
    .string()
    .min(1)
    .max(64)
    // Apenas caracteres seguros para evitar log injection
    .regex(/^[a-z_]+$/, "webhook_event_type inválido"),
  order_id: z
    .string()
    .min(1, "order_id obrigatório")
    .max(128, "order_id muito longo")
    .regex(/^[a-zA-Z0-9_-]+$/, "order_id contém caracteres inválidos"),
  order_status: z.string().max(32).optional(),
  token: z
    .string()
    .min(1, "token obrigatório")
    .max(256, "token muito longo"),
  Signature: z
    .string()
    .min(64, "Signature muito curta")
    .max(128, "Signature muito longa")
    .regex(/^[a-f0-9]+$/, "Signature deve ser hex"),
  customer: z
    .object({
      name: z.string().max(200).optional(),
      email: z.string().email().max(255).optional(),
      mobile: z.string().max(20).optional(),
      // document (CPF) não é usado — ignorado intencionalmente
    })
    .optional(),
  subscription: z
    .object({
      id: z
        .string()
        .max(128)
        .regex(/^[a-zA-Z0-9_-]*$/)
        .optional(),
      status: z.string().max(32).optional(),
      subscriber_id: z.string().max(128).optional(),
      current_period_end: z
        .string()
        .max(64)
        .refine((v) => {
          if (!v) return true;
          const d = new Date(v);
          return !isNaN(d.getTime());
        }, "current_period_end não é uma data válida")
        .optional(),
    })
    .optional(),
});

export type KiwifyWebhookPayload = z.infer<typeof kiwifyWebhookSchema>;

// ─── Magic link login ─────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z
    .string()
    .min(5, "E-mail muito curto")
    .email("E-mail inválido")
    .max(255, "E-mail muito longo")
    .toLowerCase()
    .trim(),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─── Helpers de validação de URL de redirect ──────────────────────────────────
// Permite apenas caminhos relativos seguros para evitar open redirect
export function isSafeRedirectPath(path: string): boolean {
  if (!path || typeof path !== "string") return false;
  // Deve começar com / mas não com // (que seria um redirect externo)
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  // Rejeitar URLs absolutas
  if (/^\/[a-zA-Z][a-zA-Z\d+\-.]*:/.test(path)) return false;
  // Permitir apenas caracteres seguros em caminhos
  return /^\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/.test(path);
}
